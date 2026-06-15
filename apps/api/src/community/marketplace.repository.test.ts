import { describe, expect, it } from "vitest";
import {
  MarketplaceRepository,
  type MarketplacePersistenceClient,
} from "./marketplace.repository.ts";

interface ListingRow {
  id: string;
  societyId: string;
  userId: string;
  title: string;
  description: string | null;
  price: number | null;
  category: string;
  condition: string;
  status: string;
  moderationStatus: string;
  privacyStatus: string;
  contactPhone: string | null;
  flatNumber: string | null;
  createdAt: Date;
}

function listing(partial: Partial<ListingRow> & { id: string }): ListingRow {
  return {
    societyId: "society_a",
    userId: "owner_1",
    title: "Sofa",
    description: null,
    price: 5000,
    category: "furniture",
    condition: "good",
    status: "active",
    moderationStatus: "approved",
    privacyStatus: "society",
    contactPhone: "9999999999",
    flatNumber: "A-101",
    createdAt: new Date("2026-06-07T00:00:00.000Z"),
    ...partial,
  };
}

function createClient(options: {
  one?: ListingRow;
  many?: ListingRow[];
  existingInterest?: boolean;
}) {
  const log: Array<{ op: string; data?: Record<string, unknown> }> = [];
  const client: MarketplacePersistenceClient & { log: typeof log } = {
    log,
    marketplaceListing: {
      create: async (input) => {
        log.push({ op: "listing.create", data: input.data });
        return { id: "listing_1", createdAt: new Date(), ...(input.data as Record<string, unknown>) } as never;
      },
      findFirst: async () => (options.one ?? null) as never,
      findMany: async () => (options.many ?? []) as never,
      update: async (input) => {
        log.push({ op: "listing.update", data: input.data });
        return { ...(options.one ?? {}), ...(input.data as Record<string, unknown>) } as never;
      },
    },
    marketplaceInterest: {
      findFirst: async () =>
        options.existingInterest ? ({ id: "interest_existing" } as never) : null,
      create: async (input) => {
        log.push({ op: "interest.create", data: input.data });
        return { id: "interest_1", createdAt: new Date(), ...(input.data as Record<string, unknown>) } as never;
      },
    },
    marketplaceModeration: {
      create: async (input) => {
        log.push({ op: "moderation.create", data: input.data });
        return { id: "mod_1" };
      },
    },
  };

  return client;
}

describe("MarketplaceRepository", () => {
  it("creates an active approved listing", async () => {
    const repository = new MarketplaceRepository(createClient({}));

    await expect(
      repository.createListing({
        societyId: "society_a",
        userId: "owner_1",
        title: "Sofa",
        category: "Furniture",
        condition: "LIKE_NEW",
      }),
    ).resolves.toMatchObject({ created: true, category: "furniture", condition: "like_new" });
  });

  it("sells a listing and records soldAt", async () => {
    const client = createClient({ one: listing({ id: "listing_1", status: "reserved" }) });
    const repository = new MarketplaceRepository(client);

    await expect(
      repository.transitionListing({ societyId: "society_a", listingId: "listing_1", action: "sell" }),
    ).resolves.toMatchObject({ status: "sold" });
    expect(client.log.at(-1)?.data).toHaveProperty("soldAt");
  });

  it("expresses interest idempotently", async () => {
    const dup = new MarketplaceRepository(
      createClient({ one: listing({ id: "listing_1" }), existingInterest: true }),
    );
    await expect(
      dup.expressInterest({ societyId: "society_a", listingId: "listing_1", personId: "p1" }),
    ).resolves.toMatchObject({ replayed: true });

    const fresh = new MarketplaceRepository(createClient({ one: listing({ id: "listing_1" }) }));
    await expect(
      fresh.expressInterest({ societyId: "society_a", listingId: "listing_1", personId: "p1" }),
    ).resolves.toMatchObject({ replayed: false });
  });

  it("reports a listing and writes a moderation record", async () => {
    const client = createClient({ one: listing({ id: "listing_1" }) });
    const repository = new MarketplaceRepository(client);

    await expect(
      repository.moderateListing({
        societyId: "society_a",
        listingId: "listing_1",
        action: "report",
        reason: "spam",
      }),
    ).resolves.toMatchObject({ moderationStatus: "reported" });
    expect(client.log.some((entry) => entry.op === "moderation.create")).toBe(true);
  });

  it("hides contact for hidden_contact listings and non-active from public", async () => {
    const repository = new MarketplaceRepository(
      createClient({
        many: [
          listing({ id: "visible", privacyStatus: "society" }),
          listing({ id: "hidden_contact", privacyStatus: "hidden_contact" }),
          listing({ id: "sold", status: "sold" }),
        ],
      }),
    );

    const result = await repository.listListings("society_a", {
      userId: "viewer_1",
      isVerifiedResident: true,
      isManager: false,
    });

    expect(result.map((l) => l.id).sort()).toEqual(["hidden_contact", "visible"]);
    expect(result.find((l) => l.id === "visible")?.contactPhone).toBe("9999999999");
    expect(result.find((l) => l.id === "hidden_contact")?.contactPhone).toBeNull();
  });
});
