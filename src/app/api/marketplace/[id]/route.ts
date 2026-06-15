import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { getOccupancyContext } from "@/domain/community";


import {
  buildDeprecationHeaders,
  isNestShimEnabled,
  jsonWithHeaders,
  passThroughRateLimitHeaders,
  proxyNestJson,
} from "@/lib/api/nest-proxy";
import { shimOrFallback } from "@/lib/api/nest-shim";

const LEGACY_ROUTE = "/api/marketplace/[id]";
const NEST_GET = "/api/v1/community/marketplace/detail/get";
const NEST_PATCH = "/api/v1/community/marketplace/detail/update";
const NEST_DELETE = "/api/v1/community/marketplace/detail/remove";

async function legacyPATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, session } = await requirePermission("dashboard");
  if (error) return Response.json({ error }, { status });

  const { id } = await params;
  const body = await request.json();
  const action = body.action || "";

  const listing = await prisma.marketplaceListing.findFirst({
    where: { id, societyId: session!.societyId },
  });

  if (!listing) {
    return Response.json({ error: "Listing not found" }, { status: 404 });
  }

  // Only the owner or admin can update
  if (listing.userId !== session!.userId && !["chairman", "secretary"].includes(session!.role)) {
    return Response.json({ error: "Not authorized" }, { status: 403 });
  }

  if (action === "accept_interest" || action === "reject_interest") {
    const interestId = String(body.interestId || "");
    if (!interestId) {
      return Response.json({ error: "Interest ID required" }, { status: 400 });
    }

    const interest = await prisma.marketplaceInterest.findFirst({
      where: { id: interestId, listingId: id, societyId: session!.societyId },
      include: { person: { include: { users: true } } },
    });
    if (!interest) {
      return Response.json({ error: "Request not found" }, { status: 404 });
    }

    if (action === "reject_interest") {
      const updatedInterest = await prisma.marketplaceInterest.update({
        where: { id: interest.id },
        data: { status: "rejected" },
      });
      if (interest.person?.users.length) {
        await prisma.notification.createMany({
          data: interest.person.users.map((user) => ({
            societyId: session!.societyId!,
            userId: user.id,
            type: "marketplace",
            title: "Buy request rejected",
            message: `Your buy request for ${listing.title} was rejected by the seller.`,
            link: "/marketplace",
          })),
        });
      }
      return Response.json({ interest: updatedInterest });
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.marketplaceInterest.updateMany({
        where: { listingId: id, societyId: session!.societyId, status: "accepted", id: { not: interest.id } },
        data: { status: "rejected" },
      });
      const updatedInterest = await tx.marketplaceInterest.update({
        where: { id: interest.id },
        data: { status: "accepted" },
      });
      const updatedListing = await tx.marketplaceListing.update({
        where: { id },
        data: { status: "reserved" },
      });
      await tx.marketplaceTransaction.create({
        data: {
          societyId: session!.societyId!,
          listingId: id,
          buyerPersonId: interest.personId || null,
          sellerPersonId: listing.personId || null,
          amount: listing.price,
          status: "pending",
          notes: "Seller accepted buy request",
        },
      });
      return { interest: updatedInterest, listing: updatedListing };
    });

    if (interest.person?.users.length) {
      await prisma.notification.createMany({
        data: interest.person.users.map((user) => ({
          societyId: session!.societyId!,
          userId: user.id,
          type: "marketplace",
          title: "Buy request accepted",
          message: `Your buy request for ${listing.title} was accepted by the seller.`,
          link: "/marketplace",
        })),
      });
    }

    return Response.json(result);
  }

  const updated = await prisma.marketplaceListing.update({
    where: { id },
    data: {
      status: body.status || listing.status,
      soldAt: body.status === "sold" ? new Date() : listing.soldAt,
      archivedAt: body.status === "archived" ? new Date() : listing.archivedAt,
      title: body.title || listing.title,
      price: body.price !== undefined ? parseFloat(body.price) : listing.price,
    },
  });

  return Response.json(updated);
}

async function legacyPOST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, session } = await requirePermission("dashboard");
  if (error) return Response.json({ error }, { status });
  if (!session?.societyId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const listing = await prisma.marketplaceListing.findFirst({
    where: { id, societyId: session.societyId, archivedAt: null, status: { in: ["active", "reserved"] } },
  });

  if (!listing) {
    return Response.json({ error: "Listing not found" }, { status: 404 });
  }

  if (listing.userId === session.userId) {
    return Response.json({ error: "You cannot request your own listing" }, { status: 400 });
  }

  const context = await getOccupancyContext(session);
  let personId = context?.person?.id || null;
  if (!personId) {
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) return Response.json({ error: "User not found" }, { status: 404 });
    const person = await prisma.person.create({
      data: {
        societyId: session.societyId,
        name: user.name || session.name,
        phone: user.phone || null,
      },
    });
    await prisma.user.update({ where: { id: user.id }, data: { personId: person.id } });
    personId = person.id;
  }

  const existing = await prisma.marketplaceInterest.findFirst({
    where: { listingId: id, societyId: session.societyId, personId },
  });

  const interest = existing
    ? await prisma.marketplaceInterest.update({
        where: { id: existing.id },
        data: { status: "interested", message: body.message || existing.message || null },
      })
    : await prisma.marketplaceInterest.create({
        data: {
          societyId: session.societyId,
          listingId: id,
          personId,
          message: body.message || null,
          status: "interested",
        },
      });

  await prisma.notification.create({
    data: {
      societyId: session.societyId,
      userId: listing.userId,
      type: "marketplace",
      title: "New buy request",
      message: `${session.name} requested to buy ${listing.title}.`,
      link: "/marketplace",
    },
  });

  return Response.json({ interest }, { status: existing ? 200 : 201 });
}

async function legacyDELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, session } = await requirePermission("dashboard");
  if (error) return Response.json({ error }, { status });

  const { id } = await params;

  const listing = await prisma.marketplaceListing.findFirst({
    where: { id, societyId: session!.societyId },
  });

  if (!listing) {
    return Response.json({ error: "Listing not found" }, { status: 404 });
  }

  if (listing.userId !== session!.userId && !["chairman", "secretary"].includes(session!.role)) {
    return Response.json({ error: "Not authorized" }, { status: 403 });
  }

  await prisma.marketplaceListing.update({
    where: { id },
    data: { status: "expired", archivedAt: new Date() },
  });
  return Response.json({ success: true });
}

export const PATCH = shimOrFallback({ legacyRoute: "/api/marketplace", nestPath: "/api/v1/community/marketplace", method: "PATCH" }, legacyPATCH);
export const POST = shimOrFallback({ legacyRoute: "/api/marketplace", nestPath: "/api/v1/community/marketplace", method: "POST" }, legacyPOST);
export const DELETE = shimOrFallback({ legacyRoute: "/api/marketplace", nestPath: "/api/v1/community/marketplace", method: "DELETE" }, legacyDELETE);
