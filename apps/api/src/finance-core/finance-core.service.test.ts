import { describe, expect, it } from "vitest";
import { SecurityPolicyService } from "../security/security-policy.service.ts";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import { FinanceCoreService } from "./finance-core.service.ts";

const treasurerPrincipal: AuthenticatedPrincipal = {
  subject: "treasurer_1",
  memberships: [
    {
      societyId: "society_a",
      roles: ["treasurer"],
      mfaVerified: true,
    },
  ],
  platformRoles: [],
};

const residentPrincipal: AuthenticatedPrincipal = {
  subject: "resident_1",
  memberships: [
    {
      societyId: "society_a",
      roles: ["resident"],
      mfaVerified: false,
    },
  ],
  platformRoles: [],
};

describe("FinanceCoreService", () => {
  it("authorizes finance reads", () => {
    const service = new FinanceCoreService(new SecurityPolicyService());

    expect(service.ensureChartOfAccountsPlan(treasurerPrincipal, "society_a")).toMatchObject({
      societyId: "society_a",
      accounts: expect.arrayContaining([
        expect.objectContaining({ code: "1100", name: "Accounts Receivable" }),
      ]),
    });
  });

  it("allows residents to read finance summaries for self-service billing", () => {
    const service = new FinanceCoreService(new SecurityPolicyService());

    expect(service.ensureChartOfAccountsPlan(residentPrincipal, "society_a")).toMatchObject({
      societyId: "society_a",
    });
  });

  it("authorizes finance management before creating a journal posting plan", () => {
    const service = new FinanceCoreService(new SecurityPolicyService());

    expect(
      service.createJournalVoucherPlan(treasurerPrincipal, {
        societyId: "society_a",
        sourceType: "MANUAL_JOURNAL",
        sourceId: "journal_1",
        idempotencyKey: "journal_1:post",
        narration: "Opening balance",
        lines: [
          { accountCode: "1010", side: "DEBIT", amount: 1000 },
          { accountCode: "5000", side: "CREDIT", amount: 1000 },
        ],
      }),
    ).toMatchObject({
      totalDebit: 1000,
      totalCredit: 1000,
    });
  });
});
