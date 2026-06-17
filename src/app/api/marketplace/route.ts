import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { getOccupancyContext } from "@/domain/community";
import { committeeSelfServiceError, isResidentRole } from "@/lib/roles";


import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";
import { shimOrFallback } from "@/lib/api/nest-shim";

const LEGACY_ROUTE = "/api/marketplace";
const NEST_GET = "/api/v1/community/marketplace/list";
const NEST_POST = "/api/v1/community/marketplace/create";

async function legacyGET() {
  const { error, status, session } = await requirePermission("dashboard");
  if (error) return Response.json({ error }, { status });
  if (!session?.societyId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const context = await getOccupancyContext(session);
  const marketplace = await prisma.marketplaceListing.findMany({
    where: { societyId: session!.societyId, status: { in: ["active", "reserved"] }, archivedAt: null, moderationStatus: "approved" },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      interests: {
        where: { status: { in: ["interested", "accepted", "rejected"] } },
        include: {
          person: {
            select: {
              id: true,
              name: true,
              phone: true,
              users: { select: { id: true, email: true, flat: { select: { flatNumber: true } } } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return Response.json(marketplace.map((listing) => {
    const isMine = listing.userId === session.userId;
    const myInterest = context?.person?.id
      ? listing.interests.find((interest) => interest.personId === context.person?.id)
      : null;
    return {
      ...listing,
      isMine,
      interests: isMine ? listing.interests : myInterest ? [myInterest] : [],
      myInterestStatus: myInterest?.status || null,
    };
  }));
}

async function legacyPOST(request: Request) {
  const { error, status, session } = await requirePermission("dashboard");
  if (error) return Response.json({ error }, { status });
  if (!session?.societyId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const committeeError = committeeSelfServiceError(session.role);
  if (committeeError) {
    return Response.json({ error: committeeError }, { status: 403 });
  }
  if (!isResidentRole(session.role)) {
    return Response.json({ error: "Only flat residents can post marketplace listings" }, { status: 403 });
  }

  const body = await request.json();
  const { title, description, price, category, condition, contactPhone, flatNumber, imageUrls } = body;

  if (!title) {
    return Response.json({ error: "Title is required" }, { status: 400 });
  }

  const context = await getOccupancyContext(session);
  const images = Array.isArray(imageUrls) ? imageUrls.filter((url) => typeof url === "string" && url.trim()) : [];

  const listing = await prisma.$transaction(async (tx) => {
    const created = await tx.marketplaceListing.create({
      data: {
        societyId: session!.societyId,
        userId: session!.userId,
        personId: context?.person?.id || null,
        unitOccupancyId: context?.occupancy?.id || null,
        title,
        description: description || null,
        price: price ? parseFloat(price) : null,
        category: category || "general",
        condition: condition || "good",
        contactPhone: contactPhone || null,
        flatNumber: context?.flat?.flatNumber || flatNumber || null,
        imageUrls: images.length ? JSON.stringify(images) : null,
      },
    });

    if (images.length) {
      await tx.marketplaceImage.createMany({
        data: images.map((url: string, index: number) => ({
          societyId: session.societyId,
          listingId: created.id,
          url,
          sortOrder: index,
        })),
      });
    }

    return created;
  });

  return Response.json(listing, { status: 201 });
}

export const GET = shimOrFallback({ legacyRoute: "/api/marketplace", nestPath: "/api/v1/community/marketplace", method: "GET" }, legacyGET);
export const POST = shimOrFallback({ legacyRoute: "/api/marketplace", nestPath: "/api/v1/community/marketplace", method: "POST" }, legacyPOST);
