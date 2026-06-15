import { Injectable } from "@nestjs/common";
import {
  DEFAULT_FINANCE_ACCOUNTS,
  createJournalPostingPlan,
  type JournalPostingPlanInput,
} from "../../../../packages/finance-core/src/index.ts";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import { SecurityPolicyService } from "../security/security-policy.service.js";
import {
  FinanceCoreRepository,
  type CreateInvoiceInput,
  type MarkPayrollPaidInput,
  type PostJournalVoucherInput,
  type RecordPaymentInput,
  type RecordExpenseInput,
  type RecordFundTransactionInput,
  type TrialBalanceInput,
  type UpsertBudgetInput,
} from "./finance-core.repository.js";

@Injectable()
export class FinanceCoreService {
  constructor(
    private readonly securityPolicy: SecurityPolicyService,
    private readonly repository: FinanceCoreRepository = new FinanceCoreRepository(),
  ) {}

  ensureChartOfAccountsPlan(principal: AuthenticatedPrincipal, societyId: string) {
    this.securityPolicy.authorizeOrThrow(principal, "society:finance.read", societyId);

    return {
      societyId,
      accounts: DEFAULT_FINANCE_ACCOUNTS,
    };
  }

  createJournalVoucherPlan(
    principal: AuthenticatedPrincipal,
    input: JournalPostingPlanInput,
  ) {
    this.securityPolicy.authorizeOrThrow(
      principal,
      "society:finance.manage",
      input.societyId,
    );

    return createJournalPostingPlan(input);
  }

  async ensureChartOfAccounts(principal: AuthenticatedPrincipal, societyId: string) {
    this.securityPolicy.authorizeOrThrow(principal, "society:finance.manage", societyId);
    return this.repository.ensureDefaultChartOfAccounts(societyId);
  }

  async postJournalVoucher(
    principal: AuthenticatedPrincipal,
    input: PostJournalVoucherInput,
  ) {
    this.securityPolicy.authorizeOrThrow(
      principal,
      "society:finance.manage",
      input.societyId,
    );

    return this.repository.postJournalVoucher(input);
  }

  async getTrialBalance(principal: AuthenticatedPrincipal, input: TrialBalanceInput) {
    this.securityPolicy.authorizeOrThrow(principal, "society:finance.read", input.societyId);
    return this.repository.getTrialBalance(input);
  }

  async createInvoice(principal: AuthenticatedPrincipal, input: CreateInvoiceInput) {
    this.securityPolicy.authorizeOrThrow(principal, "society:finance.manage", input.societyId);
    return this.repository.createInvoice(input);
  }

  async recordPayment(principal: AuthenticatedPrincipal, input: RecordPaymentInput) {
    this.securityPolicy.authorizeOrThrow(principal, "society:finance.manage", input.societyId);
    return this.repository.recordPayment(input);
  }

  async recordExpense(principal: AuthenticatedPrincipal, input: RecordExpenseInput) {
    this.securityPolicy.authorizeOrThrow(principal, "society:finance.manage", input.societyId);
    return this.repository.recordExpense(input);
  }

  async upsertBudget(principal: AuthenticatedPrincipal, input: UpsertBudgetInput) {
    this.securityPolicy.authorizeOrThrow(principal, "society:finance.manage", input.societyId);
    return this.repository.upsertBudget(input);
  }

  async recordFundTransaction(principal: AuthenticatedPrincipal, input: RecordFundTransactionInput) {
    this.securityPolicy.authorizeOrThrow(principal, "society:finance.manage", input.societyId);
    return this.repository.recordFundTransaction(input);
  }

  async markPayrollPaid(principal: AuthenticatedPrincipal, input: MarkPayrollPaidInput) {
    this.securityPolicy.authorizeOrThrow(principal, "society:finance.manage", input.societyId);
    return this.repository.markPayrollPaid(input);
  }
}
