import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "../../../../packages/db/src/index.ts";
import {
  applyListingTransition,
  applyModeration,
  isListingPubliclyVisible,
  normalizeListingCategory,
  normalizeListingCondition,
  normalizeListingPrivacy,
  resolveListingContactVisibility,
  type ListingAction,
  type ListingPrivacy,
  type ListingStatus,
} from "../../../../packages/community-core/src/index.ts";

interface ListingRecord {
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

interface InterestRecord {
  id: string;
  societyId: string;
  listingId: string;
  personId: string | null;
  message: string | null;
  status: string;
  createdAt: Date;
}

export interface MarketplacePersistenceClient {
  marketplaceListing: {
    create(input: { data: Record<string, unknown> }): Promise<ListingRecord>;
    findFirst(input: Record<string, unknown>): Promise<ListingRecord | null>;
    findMany(input: Record<string, unknown>): Promise<ListingRecord[]>;
    update(input: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<ListingRecord>;
  };
  marketplaceInterest: {
    findFirst(input: Record<string, unknown>): Promise<InterestRecord | null>;
    create(input: { data: Record<string, unknown> }): Promise<InterestRecord>;
  };
  marketplaceModeration: {
    create(input: { data: Record<string, unknown> }): Promise<{ id: string }>;
  };
}

export interface CreateListingCommand {
  societyId: string;
  userId: string;
  title: string;
  description?: string;
  price?: number;
  category?: string;
  condition?: string;
  privacyStatus?: string;
  contactPhone?: string;
  flatNumber?: string;
}

export interface TransitionListingCommand {
  societyId: string;
  listingId: string;
  action: ListingAction;
}

export interface ExpressInterestCommand {
  societyId: string;
  listingId: string;
  personId: string;
  message?: string;
}

export interface ModerateListingCommand {
  societyId: string;
  listingId: string;
  action: string;
  reason?: string;
  actorUserId?: string;
}

export interface ListingViewer {
  userId: string;
  isVerifiedResident: boolean;
  isManager: boolean;
}

@Injectable()
export class MarketplaceRepository {
  constructor(
    private readonly client: MarketplacePersistenceClient = prisma as unknown as MarketplacePersistenceClient,
  ) {}

  async createListing(command: CreateListingCommand) {
    const category = normalizeListingCategory(command.category);
    const condition = normalizeListingCondition(command.condition);
    const privacyStatus = normalizeListingPrivacy(command.privacyStatus);

    const listing = await this.client.marketplaceListing.create({
      data: {
        societyId: command.societyId,
        userId: command.userId,
        title: command.title,
        description: command.description ?? null,
        price: command.price ?? null,
        category,
        condition,
        status: "active",
        moderationStatus: "approved",
        privacyStatus,
        contactPhone: command.contactPhone ?? null,
        flatNumber: command.flatNumber ?? null,
      },
    });

    return { created: true as const, listingId: listing.id, category, condition, privacyStatus };
  }

  async transitionListing(command: TransitionListingCommand) {
    const listing = await this.requireListing(command.societyId, command.listingId);
    const { status } = applyListingTransition({
      current: listing.status as ListingStatus,
      action: command.action,
    });

    const updated = await this.client.marketplaceListing.update({
      where: { id: listing.id },
      data: {
        status,
        ...(status === "sold" ? { soldAt: new Date() } : {}),
        ...(status === "expired" ? { archivedAt: new Date() } : {}),
      },
    });

    return { transitioned: true as const, listingId: updated.id, status };
  }

  async expressInterest(command: ExpressInterestCommand) {
    const listing = await this.requireListing(command.societyId, command.listingId);

    const existing = await this.client.marketplaceInterest.findFirst({
      where: { listingId: listing.id, personId: command.personId, status: "interested" },
    });

    if (existing) {
      return { interested: true as const, replayed: true, interestId: existing.id };
    }

    const interest = await this.client.marketplaceInterest.create({
      data: {
        societyId: command.societyId,
        listingId: listing.id,
        personId: command.personId,
        message: command.message ?? null,
        status: "interested",
      },
    });

    return { interested: true as const, replayed: false, interestId: interest.id };
  }

  async moderateListing(command: ModerateListingCommand) {
    const listing = await this.requireListing(command.societyId, command.listingId);
    const change = applyModeration(command.action);

    const updated = await this.client.marketplaceListing.update({
      where: { id: listing.id },
      data: {
        ...(change.moderationStatus ? { moderationStatus: change.moderationStatus } : {}),
        ...(change.listingStatus
          ? { status: change.listingStatus, archivedAt: new Date() }
          : {}),
      },
    });

    await this.client.marketplaceModeration.create({
      data: {
        societyId: command.societyId,
        listingId: listing.id,
        action: command.action.trim().toLowerCase(),
        reason: command.reason ?? null,
        actorUserId: command.actorUserId ?? null,
      },
    });

    return {
      moderated: true as const,
      listingId: updated.id,
      moderationStatus: updated.moderationStatus,
      status: updated.status,
    };
  }

  async listListings(societyId: string, viewer: ListingViewer, includeAll = false) {
    const listings = await this.client.marketplaceListing.findMany({
      where: { societyId },
      orderBy: { createdAt: "desc" },
    });

    const isManager = viewer.isManager;

    return listings
      .filter((listing) => {
        if (isManager && includeAll) {
          return true;
        }
        return (
          isListingPubliclyVisible({
            status: listing.status,
            moderationStatus: listing.moderationStatus,
          }) || listing.userId === viewer.userId
        );
      })
      .map((listing) => {
        const showContact = resolveListingContactVisibility({
          privacyStatus: listing.privacyStatus as ListingPrivacy,
          viewer: {
            isVerifiedResident: viewer.isVerifiedResident,
            isManager,
            isOwner: listing.userId === viewer.userId,
          },
        });

        return {
          id: listing.id,
          title: listing.title,
          description: listing.description,
          price: listing.price,
          category: listing.category,
          condition: listing.condition,
          status: listing.status,
          moderationStatus: listing.moderationStatus,
          privacyStatus: listing.privacyStatus,
          flatNumber: listing.flatNumber,
          contactPhone: showContact ? listing.contactPhone : null,
          createdAt: listing.createdAt,
        };
      });
  }

  private async requireListing(societyId: string, listingId: string): Promise<ListingRecord> {
    const listing = await this.client.marketplaceListing.findFirst({
      where: { id: listingId, societyId },
    });

    if (!listing) {
      throw new NotFoundException({ error: "not_found", reason: "Listing not found" });
    }

    return listing;
  }
}
