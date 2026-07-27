import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { createAuditEvent, type AuditEvent } from "../../../../../packages/security/src/index.ts";
import type {
  MobileGuardOverviewDto,
  MobileGuardPasscodeResultDto,
  MobileGuardVisitorDto,
  RequestVisitorDto,
  VerifyVisitorPasscodeDto,
} from "./dto/mobile-guard.dto.ts";
import { MobileGuardRepository, mobileGuardProblem } from "./mobile-guard.repository.ts";
import type { MobileAuthenticatedRequest } from "../common/mobile-request.ts";

type MobileSession = NonNullable<MobileAuthenticatedRequest["mobileSession"]>;

export const MOBILE_GUARD_AUDIT = Symbol("MOBILE_GUARD_AUDIT");

export interface MobileGuardAudit {
  record(event: AuditEvent): Promise<void>;
}

@Injectable()
export class MobileGuardService {
  constructor(
    @Inject(MobileGuardRepository)
    private readonly repository: Pick<
      MobileGuardRepository,
      "overview" | "listVisitors" | "requestVisitor" | "findVisitor" | "verifyPasscode" | "markEntered" | "markExited"
    >,
    @Inject(MOBILE_GUARD_AUDIT)
    private readonly audit: MobileGuardAudit = { record: async () => undefined },
  ) {}

  async overview(session: MobileSession): Promise<MobileGuardOverviewDto> {
    this.requireGuard(session);
    return this.repository.overview(session.societyId);
  }

  async listVisitors(session: MobileSession, status?: string): Promise<MobileGuardVisitorDto[]> {
    this.requireGuard(session);
    return this.repository.listVisitors(session.societyId, status);
  }

  async requestVisitor(session: MobileSession, body: RequestVisitorDto): Promise<MobileGuardVisitorDto> {
    this.requireGuard(session);
    const visitor = await this.repository.requestVisitor({
      societyId: session.societyId,
      actorId: session.userId,
      flatQuery: body.flatQuery,
      visitorName: body.visitorName,
      purpose: body.purpose,
      phone: body.phone,
      vehicleNo: body.vehicleNo,
      passcode: body.passcode,
    });
    await this.record(session, "visitor_request", visitor.id);
    return visitor;
  }

  async getVisitor(session: MobileSession, visitorId: string): Promise<MobileGuardVisitorDto> {
    this.requireGuard(session);
    const visitor = await this.repository.findVisitor(session.societyId, visitorId);
    if (!visitor) throw mobileGuardProblem("visitor_not_found", "The visitor was not found.", 404);
    return {
      id: visitor.id,
      flatNumber: visitor.flatNumber,
      visitorName: visitor.visitorName,
      purpose: visitor.purpose,
      status: visitor.status,
      residentResponse: visitor.residentResponse,
      phone: visitor.phone,
      vehicleNo: visitor.vehicleNo,
      arrivedAt: visitor.arrivedAt.toISOString(),
      entryTime: visitor.entryTime?.toISOString() ?? null,
      exitTime: visitor.exitTime?.toISOString() ?? null,
    };
  }

  async verifyPasscode(
    session: MobileSession,
    visitorId: string,
    body: VerifyVisitorPasscodeDto,
  ): Promise<MobileGuardPasscodeResultDto> {
    this.requireGuard(session);
    const verified = await this.repository.verifyPasscode(
      session.societyId,
      visitorId,
      body.passcode,
      session.userId,
    );
    await this.record(session, "visitor_passcode_verified", visitorId);
    return verified;
  }

  async checkIn(session: MobileSession, visitorId: string): Promise<MobileGuardVisitorDto> {
    this.requireGuard(session);
    const visitor = await this.repository.findVisitor(session.societyId, visitorId);
    if (!visitor || visitor.status !== "expected" || visitor.residentResponse !== "approved") {
      throw mobileGuardProblem("visitor_not_approved", "Visitor approval is required before check-in.", 409);
    }
    const entered = await this.repository.markEntered(session.societyId, visitorId, session.userId);
    await this.record(session, "visitor_checked_in", visitorId);
    return entered;
  }

  async checkOut(session: MobileSession, visitorId: string): Promise<MobileGuardVisitorDto> {
    this.requireGuard(session);
    const exited = await this.repository.markExited(session.societyId, visitorId, session.userId);
    await this.record(session, "visitor_checked_out", visitorId);
    return exited;
  }

  private requireGuard(session: MobileSession): void {
    if (session.activeRole !== "guard" || session.activePermissionRole !== "guard") {
      throw new ForbiddenException({ error: "forbidden" });
    }
  }

  private async record(session: MobileSession, event: string, visitorId: string): Promise<void> {
    await this.audit.record(createAuditEvent({
      actorId: session.userId,
      societyId: session.societyId,
      action: "operations:gate.manage",
      targetType: "mobile_guard_visitor",
      targetId: visitorId,
      outcome: "allowed",
      requestId: session.sessionId,
      metadata: { event, activeRole: session.activeRole },
    }));
  }
}
