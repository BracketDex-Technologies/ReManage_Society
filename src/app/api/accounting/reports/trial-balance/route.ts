import { getSession } from "@/lib/auth";
import { getTrialBalance } from "@/domain/accounting-engine";
import { shimOrFallback, withDeprecationHeaders } from "@/lib/api/nest-shim";
import type { SessionPayload } from "@/lib/session";

const LEGACY_ROUTE = "/api/accounting/reports/trial-balance";

export const GET = shimOrFallback(
  {
    legacyRoute: LEGACY_ROUTE,
    nestPath: "/api/v1/finance-core/accounting/reports/trial-balance",
    method: "POST",
    allowedRoles: ["chairman", "secretary", "treasurer"],
    responseKey: "trialBalance",
    buildBody: (session: SessionPayload, request?: Request) => {
      const url = request ? new URL(request.url) : null;
      return {
        societyId: session.societyId,
        from: url?.searchParams.get("from"),
        to: url?.searchParams.get("to"),
      };
    },
  },
  async (request: Request) => {
    const session = await getSession();
    if (!session?.societyId || !["chairman", "secretary", "treasurer"].includes(session.role)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const trialBalance = await getTrialBalance({
      societyId: session.societyId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });

    return withDeprecationHeaders(
      Response.json({ trialBalance }),
      LEGACY_ROUTE,
      "/api/v1/finance-core/accounting/reports/trial-balance"
    );
  }
);
