import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeSearchResult } from "@society/ux-core";
import { resolvePersona } from "@society/ux-core";

type SearchResult = {
  type: string;
  title: string;
  subtitle?: string;
  href: string;
  sensitive?: boolean;
};

export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = String(url.searchParams.get("q") || "").trim();
  if (q.length < 2) {
    return Response.json({ results: [] });
  }

  const isAdmin = ["chairman", "secretary", "treasurer"].includes(session.role);
  const isResident = ["member", "tenant"].includes(session.role);
  const persona = resolvePersona(session.role);
  const ownFlatFilter = !isAdmin && session.flatId ? { id: session.flatId } : undefined;
  const userFlat = !isAdmin && session.flatId
    ? await prisma.flat.findFirst({
        where: { id: session.flatId, societyId: session.societyId },
        select: { flatNumber: true },
      })
    : null;

  const canReadDirectory = isAdmin;
  const canReadCommunity = isAdmin || isResident || ["guard", "watchman"].includes(session.role);

  const [flats, users, visitors, complaints, bills, packages, notices, documents, listings, directoryPeople] = await Promise.all([
    prisma.flat.findMany({
      where: {
        societyId: session.societyId,
        ...(ownFlatFilter ? ownFlatFilter : {}),
        OR: [
          { flatNumber: { contains: q, mode: "insensitive" } },
          { ownerName: { contains: q, mode: "insensitive" } },
          { tenantName: { contains: q, mode: "insensitive" } },
          { contact: { contains: q, mode: "insensitive" } },
          { vehicleNumber: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 8,
      orderBy: { flatNumber: "asc" },
    }),
    isAdmin
      ? prisma.user.findMany({
          where: {
            societyId: session.societyId,
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
            ],
          },
          take: 8,
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    prisma.visitor.findMany({
      where: {
        societyId: session.societyId,
        ...(!isAdmin && session.flatId ? { flatId: session.flatId } : {}),
        OR: [
          { visitorName: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
          { vehicleNo: { contains: q, mode: "insensitive" } },
          { flatNumber: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 8,
      orderBy: { createdAt: "desc" },
    }),
    prisma.complaint.findMany({
      where: {
        societyId: session.societyId,
        ...(!isAdmin && userFlat?.flatNumber ? { flatNumber: userFlat.flatNumber } : {}),
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { flatNumber: { contains: q, mode: "insensitive" } },
          { raisedBy: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 8,
      orderBy: { createdAt: "desc" },
    }),
    isAdmin
      ? prisma.maintenanceBill.findMany({
          where: {
            societyId: session.societyId,
            OR: [
              { period: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { receiptNumber: { contains: q, mode: "insensitive" } },
              { flat: { flatNumber: { contains: q, mode: "insensitive" } } },
            ],
          },
          include: { flat: true },
          take: 8,
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    prisma.package.findMany({
      where: {
        societyId: session.societyId,
        ...(!isAdmin && session.flatId ? { flatId: session.flatId } : {}),
        OR: [
          { courierName: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { flat: true },
      take: 8,
      orderBy: { createdAt: "desc" },
    }),
    canReadCommunity
      ? prisma.notice.findMany({
          where: {
            societyId: session.societyId,
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { body: { contains: q, mode: "insensitive" } },
              { category: { contains: q, mode: "insensitive" } },
            ],
          },
          take: 6,
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    canReadCommunity
      ? prisma.document.findMany({
          where: {
            societyId: session.societyId,
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { category: { contains: q, mode: "insensitive" } },
            ],
          },
          take: 6,
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    canReadCommunity
      ? prisma.marketplaceListing.findMany({
          where: {
            societyId: session.societyId,
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          },
          take: 6,
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    canReadDirectory
      ? prisma.user.findMany({
          where: {
            societyId: session.societyId,
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
            ],
          },
          take: 6,
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const rawResults: SearchResult[] = [
    ...flats.map((flat) => ({
      type: "flat",
      title: `Flat ${flat.flatNumber}`,
      subtitle: flat.ownerName || flat.tenantName || flat.contact || "Unit record",
      href: isAdmin ? "/settings" : "/dashboard",
      sensitive: isResident,
    })),
    ...users.map((user) => ({
      type: "resident",
      title: user.name,
      subtitle: `${user.role} · ${user.phone || user.email}`,
      href: "/directory",
      sensitive: false,
    })),
    ...visitors.map((visitor) => ({
      type: "visitor",
      title: visitor.visitorName,
      subtitle: `Flat ${visitor.flatNumber} · ${visitor.status}`,
      href: isAdmin || ["guard", "watchman"].includes(session.role) ? "/visitors" : "/my-visitors",
    })),
    ...complaints.map((complaint) => ({
      type: "complaint",
      title: complaint.title,
      subtitle: `Flat ${complaint.flatNumber} · ${complaint.status}`,
      href: "/complaints",
    })),
    ...bills.map((bill) => ({
      type: "finance",
      title: `${bill.description || "Invoice"} · ${bill.period}`,
      subtitle: `Flat ${bill.flat.flatNumber} · ${bill.status}`,
      href: "/maintenance",
    })),
    ...packages.map((pkg) => ({
      type: "package",
      title: pkg.courierName || "Package",
      subtitle: `Flat ${pkg.flat.flatNumber} · ${pkg.status}`,
      href: "/packages",
    })),
    ...notices.map((notice) => ({
      type: "notice",
      title: notice.title,
      subtitle: notice.category,
      href: "/notices",
    })),
    ...documents.map((document) => ({
      type: "document",
      title: document.title,
      subtitle: document.category,
      href: "/documents",
    })),
    ...listings.map((listing) => ({
      type: "marketplace",
      title: listing.title,
      subtitle: listing.status,
      href: "/marketplace",
    })),
    ...directoryPeople.map((person) => ({
      type: "directory",
      title: person.name,
      subtitle: person.phone || person.role,
      href: "/directory",
      sensitive: isResident,
    })),
  ];

  const results = rawResults
    .map((item) => normalizeSearchResult(item, persona))
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .slice(0, 24);

  return Response.json({ results });
}
