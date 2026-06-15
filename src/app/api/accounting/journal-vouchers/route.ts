import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { postJournalVoucher } from "@/domain/accounting-engine";
import { logSecurityEvent } from "@/lib/enterprise-security";
import { shimOrFallback, withDeprecationHeaders } from "@/lib/api/nest-shim";

const ADMIN_ROLES = ["chairman", "treasurer"];
const LEGACY_ROUTE = "/api/accounting/journal-vouchers";

export const GET = shimOrFallback(
  {
    legacyRoute: LEGACY_ROUTE,
    nestPath: "/api/v1/finance-core/accounting/journal-vouchers/list",
    method: "POST",
    allowedRoles: ["chairman", "secretary", "treasurer"],
    responseKey: "vouchers",
  },
  async (request: Request) => {
    const session = await getSession();
    if (!session?.societyId || !["chairman", "secretary", "treasurer"].includes(session.role)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const vouchers = await prisma.journalVoucher.findMany({
      where: { societyId: session.societyId },
      include: {
        lines: {
          include: { account: true },
        },
      },
      orderBy: { voucherDate: "desc" },
      take: 50,
    });

    return withDeprecationHeaders(
      Response.json({ vouchers }),
      LEGACY_ROUTE,
      "/api/v1/finance-core/accounting/journal-vouchers/list"
    );
  }
);

export const POST = shimOrFallback(
  {
    legacyRoute: LEGACY_ROUTE,
    nestPath: "/api/v1/finance-core/accounting/journal-vouchers/create",
    method: "POST",
    allowedRoles: ADMIN_ROLES,
    responseKey: "voucher",
  },
  async (request: Request) => {
    const session = await getSession();
    if (!session?.societyId || !ADMIN_ROLES.includes(session.role)) {
      await logSecurityEvent({
        societyId: session?.societyId,
        userId: session?.userId,
        eventType: "access_denied",
        severity: "warning",
        path: LEGACY_ROUTE,
      });
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const body = await request.json();
      const narration = String(body.narration || "").trim();
      const lines = Array.isArray(body.lines) ? body.lines : [];

      if (!narration) {
        return Response.json({ error: "Narration is required" }, { status: 400 });
      }

      const voucher = await postJournalVoucher({
        societyId: session.societyId,
        createdBy: session.userId,
        narration,
        voucherDate: body.voucherDate ? new Date(body.voucherDate) : new Date(),
        lines,
      });

      return withDeprecationHeaders(
        Response.json({ voucher }, { status: 201 }),
        LEGACY_ROUTE,
        "/api/v1/finance-core/accounting/journal-vouchers/create"
      );
    } catch (error) {
      return withDeprecationHeaders(
        Response.json(
          { error: error instanceof Error ? error.message : "Failed to post journal voucher" },
          { status: 400 }
        ),
        LEGACY_ROUTE,
        "/api/v1/finance-core/accounting/journal-vouchers/create"
      );
    }
  }
);
