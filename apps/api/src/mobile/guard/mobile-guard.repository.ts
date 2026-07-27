import { HttpException, Inject, Injectable } from "@nestjs/common";
import type {
  MobileGuardOverviewDto,
  MobileGuardPasscodeResultDto,
  MobileGuardVisitorDto,
  RequestVisitorDto,
} from "./dto/mobile-guard.dto.ts";

interface GuardVisitorRecord {
  id: string;
  societyId: string;
  flatNumber: string;
  visitorName: string;
  purpose: string;
  status: string;
  residentResponse: string | null;
  phone: string | null;
  vehicleNo: string | null;
  passcode: string | null;
  verificationMethod: string | null;
  arrivedAt: Date;
  entryTime: Date | null;
  exitTime: Date | null;
}

interface MobileGuardPersistenceClient {
  flat: {
    findFirst(input: Record<string, unknown>): Promise<{ id: string; flatNumber: string } | null>;
  };
  visitor: {
    create(input: { data: Record<string, unknown> }): Promise<GuardVisitorRecord>;
    findFirst(input: Record<string, unknown>): Promise<GuardVisitorRecord | null>;
    findMany(input: Record<string, unknown>): Promise<GuardVisitorRecord[]>;
    update(input: { where: { id: string }; data: Record<string, unknown> }): Promise<GuardVisitorRecord>;
  };
  blacklist: {
    findFirst(input: Record<string, unknown>): Promise<{ id: string } | null>;
  };
}

export const MOBILE_GUARD_CLIENT = Symbol("MOBILE_GUARD_CLIENT");

export interface RequestMobileVisitorCommand extends RequestVisitorDto {
  societyId: string;
  actorId: string;
}

@Injectable()
export class MobileGuardRepository {
  constructor(
    @Inject(MOBILE_GUARD_CLIENT)
    private readonly client: MobileGuardPersistenceClient,
  ) {}

  async overview(societyId: string): Promise<MobileGuardOverviewDto> {
    const visitors = await this.client.visitor.findMany({
      where: { societyId, status: { in: ["expected", "inside"] } },
    });
    return {
      expectedCount: visitors.filter((visitor) => visitor.status === "expected").length,
      insideCount: visitors.filter((visitor) => visitor.status === "inside").length,
    };
  }

  async listVisitors(societyId: string, status?: string): Promise<MobileGuardVisitorDto[]> {
    const visitors = await this.client.visitor.findMany({
      where: { societyId, ...(status ? { status } : {}) },
      orderBy: { arrivedAt: "desc" },
    });
    return visitors.map(toMobileVisitor);
  }

  async requestVisitor(command: RequestMobileVisitorCommand): Promise<MobileGuardVisitorDto> {
    const flat = await this.client.flat.findFirst({
      where: { societyId: command.societyId, flatNumber: command.flatQuery.trim(), isActive: true },
    });
    if (!flat) throw mobileGuardProblem("flat_not_found", "The requested flat was not found.", 404);

    const blacklisted = await this.client.blacklist.findFirst({
      where: {
        societyId: command.societyId,
        isActive: true,
        OR: [
          { name: command.visitorName.trim() },
          ...(command.phone ? [{ phone: command.phone.trim() }] : []),
        ],
      },
    });
    if (blacklisted) throw mobileGuardProblem("visitor_blacklisted", "This visitor cannot be admitted.", 403);

    const visitor = await this.client.visitor.create({
      data: {
        societyId: command.societyId,
        flatId: flat.id,
        flatNumber: flat.flatNumber,
        visitorName: command.visitorName.trim(),
        purpose: command.purpose.trim(),
        phone: command.phone?.trim() || null,
        vehicleNo: command.vehicleNo?.trim() || null,
        passcode: command.passcode ?? null,
        status: "expected",
        isPreApproved: true,
        arrivedAt: new Date(),
      },
    });
    return toMobileVisitor(visitor);
  }

  async findVisitor(societyId: string, visitorId: string): Promise<GuardVisitorRecord | null> {
    return this.client.visitor.findFirst({ where: { id: visitorId, societyId } });
  }

  async verifyPasscode(
    societyId: string,
    visitorId: string,
    passcode: string,
    actorId: string,
  ): Promise<MobileGuardPasscodeResultDto> {
    const visitor = await this.client.visitor.findFirst({
      where: { id: visitorId, societyId, passcode },
    });
    if (!visitor) throw mobileGuardProblem("invalid_visitor_passcode", "The visitor passcode is not valid.", 400);
    await this.client.visitor.update({
      where: { id: visitor.id },
      data: { verificationMethod: "passcode" },
    });
    void actorId;
    return { id: visitor.id, passcodeVerified: true };
  }

  async markEntered(societyId: string, visitorId: string, actorId: string): Promise<MobileGuardVisitorDto> {
    const visitor = await this.requireVisitor(societyId, visitorId);
    await this.assertNotBlacklisted(visitor);
    if (visitor.passcode && visitor.verificationMethod !== "passcode") {
      throw mobileGuardProblem("passcode_verification_required", "Verify the visitor passcode before check-in.", 409);
    }
    const updated = await this.client.visitor.update({
      where: { id: visitor.id },
      data: { status: "inside", entryTime: new Date() },
    });
    void actorId;
    return toMobileVisitor(updated);
  }

  async markExited(societyId: string, visitorId: string, actorId: string): Promise<MobileGuardVisitorDto> {
    const visitor = await this.requireVisitor(societyId, visitorId);
    if (visitor.status !== "inside") {
      throw mobileGuardProblem("visitor_not_inside", "The visitor has not checked in.", 409);
    }
    const updated = await this.client.visitor.update({
      where: { id: visitor.id },
      data: { status: "exited", exitTime: new Date() },
    });
    void actorId;
    return toMobileVisitor(updated);
  }

  private async requireVisitor(societyId: string, visitorId: string): Promise<GuardVisitorRecord> {
    const visitor = await this.findVisitor(societyId, visitorId);
    if (!visitor) throw mobileGuardProblem("visitor_not_found", "The visitor was not found.", 404);
    return visitor;
  }

  private async assertNotBlacklisted(visitor: GuardVisitorRecord): Promise<void> {
    const blacklisted = await this.client.blacklist.findFirst({
      where: {
        societyId: visitor.societyId,
        isActive: true,
        OR: [
          { name: visitor.visitorName },
          ...(visitor.phone ? [{ phone: visitor.phone }] : []),
        ],
      },
    });
    if (blacklisted) throw mobileGuardProblem("visitor_blacklisted", "This visitor cannot be admitted.", 403);
  }
}

export class MobileGuardProblem extends HttpException {
  constructor(
    readonly code: string,
    message: string,
    status: number,
  ) {
    super({ error: code, message }, status);
  }
}

export function mobileGuardProblem(code: string, message: string, status: number): MobileGuardProblem {
  return new MobileGuardProblem(code, message, status);
}

function toMobileVisitor(visitor: GuardVisitorRecord): MobileGuardVisitorDto {
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
