import { Body, Controller, Post, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { JournalPostingLineInput } from "../../../../packages/finance-core/src/index.ts";
import type { AuthenticatedPrincipal } from "../../../../packages/security/src/index.ts";
import {
  AuthenticationGuard,
  type AuthenticatedApiRequest,
} from "../security/authentication.guard.js";
import { FinanceCoreService } from "./finance-core.service.js";
import type {
  CreateInvoiceInput,
  RecordExpenseInput,
  RecordPaymentInput,
} from "./finance-core.repository.ts";

interface SocietyFinanceRequest {
  societyId: string;
}

interface JournalVoucherRequest {
  societyId: string;
  sourceType: string;
  sourceId: string;
  idempotencyKey: string;
  narration: string;
  voucherDate?: string;
  lines: JournalPostingLineInput[];
}

interface TrialBalanceRequest {
  societyId: string;
  from?: string;
  to?: string;
}

interface CreateInvoiceRequest extends Omit<CreateInvoiceInput, "dueDate"> {
  dueDate: string;
}

interface RecordPaymentRequest extends Omit<RecordPaymentInput, "paidAt"> {
  paidAt: string;
}

interface RecordExpenseRequest extends Omit<RecordExpenseInput, "paidOn"> {
  paidOn: string;
}

@ApiTags("finance-core")
@ApiBearerAuth()
@UseGuards(AuthenticationGuard)
@Controller("api/v1/finance-core")
export class FinanceCoreController {
  constructor(private readonly financeCore: FinanceCoreService) {}

  @Post("chart-of-accounts/ensure")
  @ApiOkResponse({ description: "Ensures the default chart of accounts exists." })
  ensureChartOfAccounts(@Req() request: AuthenticatedApiRequest, @Body() body: SocietyFinanceRequest) {
    return this.financeCore.ensureChartOfAccounts(this.requirePrincipal(request), body.societyId);
  }

  @Post("journal-vouchers/plan")
  @ApiOkResponse({ description: "Returns a validated journal posting plan." })
  createJournalVoucherPlan(@Req() request: AuthenticatedApiRequest, @Body() body: JournalVoucherRequest) {
    return this.financeCore.createJournalVoucherPlan(this.requirePrincipal(request), {
      societyId: body.societyId,
      sourceType: body.sourceType,
      sourceId: body.sourceId,
      idempotencyKey: body.idempotencyKey,
      narration: body.narration,
      lines: body.lines,
    });
  }

  @Post("journal-vouchers/post")
  @ApiOkResponse({ description: "Posts a balanced journal voucher and ledger entries." })
  postJournalVoucher(@Req() request: AuthenticatedApiRequest, @Body() body: JournalVoucherRequest) {
    return this.financeCore.postJournalVoucher(this.requirePrincipal(request), {
      ...body,
      voucherDate: body.voucherDate ? new Date(body.voucherDate) : undefined,
    });
  }

  @Post("reports/trial-balance")
  @ApiOkResponse({ description: "Returns a ledger-backed trial balance." })
  getTrialBalance(@Req() request: AuthenticatedApiRequest, @Body() body: TrialBalanceRequest) {
    return this.financeCore.getTrialBalance(this.requirePrincipal(request), {
      societyId: body.societyId,
      from: body.from ? new Date(body.from) : undefined,
      to: body.to ? new Date(body.to) : undefined,
    });
  }

  @Post("invoices/create")
  @ApiOkResponse({ description: "Creates an issued invoice and posts receivable ledger entries." })
  createInvoice(@Req() request: AuthenticatedApiRequest, @Body() body: CreateInvoiceRequest) {
    return this.financeCore.createInvoice(this.requirePrincipal(request), {
      ...body,
      dueDate: new Date(body.dueDate),
    });
  }

  @Post("payments/record")
  @ApiOkResponse({ description: "Records a payment, receipt, and settlement ledger entries." })
  recordPayment(@Req() request: AuthenticatedApiRequest, @Body() body: RecordPaymentRequest) {
    return this.financeCore.recordPayment(this.requirePrincipal(request), {
      ...body,
      paidAt: new Date(body.paidAt),
    });
  }

  @Post("expenses/record")
  @ApiOkResponse({ description: "Records an expense and posts ledger entries." })
  recordExpense(@Req() request: AuthenticatedApiRequest, @Body() body: RecordExpenseRequest) {
    return this.financeCore.recordExpense(this.requirePrincipal(request), {
      ...body,
      paidOn: new Date(body.paidOn),
    });
  }

  private requirePrincipal(request: AuthenticatedApiRequest): AuthenticatedPrincipal {
    if (!request.principal) {
      throw new UnauthorizedException({
        error: "unauthorized",
        reason: "Authenticated principal is required",
      });
    }

    return request.principal;
  }
}
