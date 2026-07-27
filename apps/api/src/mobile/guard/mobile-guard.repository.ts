import { HttpException, Inject, Injectable } from "@nestjs/common";
import type {
  MobileGuardOverviewDto,
  MobileGuardPasscodeResultDto,
  MobileGuardVisitorDto,
  MobileGuardVisitorStatus,
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

interface GuardFlatRecord {
  id: string;
  flatNumber: string;
  units?: Array<{
    occupancies: Array<{
      person: {
        users: Array<{ id: string }>;
      };
    }>;
  }>;
}

interface MobileGuardPersistenceClient {
  $transaction<T>(
    callback: (transaction: MobileGuardPersistenceClient) => Promise<T>,
  ): Promise<T>;
  flat: {
    findFirst(input: Record<string, unknown>): Promise<GuardFlatRecord | null>;
  };
  visitor: {
    create(input: { data: Record<string, unknown> }): Promise<GuardVisitorRecord>;
    count(input: { where: Record<string, unknown> }): Promise<number>;
    findFirst(input: Record<string, unknown>): Promise<GuardVisitorRecord | null>;
    findMany(input: Record<string, unknown>): Promise<GuardVisitorRecord[]>;
    updateMany(input: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
  };
  package: {
    count(input: { where: Record<string, unknown> }): Promise<number>;
  };
  blacklist: {
    findFirst(input: Record<string, unknown>): Promise<{ id: string } | null>;
  };
  user: {
    findMany(input: Record<string, unknown>): Promise<Array<{ id: string }>>;
  };
  notification: {
    createMany(input: { data: Array<Record<string, unknown>> }): Promise<{ count: number }>;
  };
}

export const MOBILE_GUARD_CLIENT = Symbol("MOBILE_GUARD_CLIENT");

export interface RequestMobileVisitorCommand extends RequestVisitorDto {
  societyId: string;
}

@Injectable()
export class MobileGuardRepository {
  constructor(
    @Inject(MOBILE_GUARD_CLIENT)
    private readonly client: MobileGuardPersistenceClient,
  ) {}

  async overview(societyId: string): Promise<MobileGuardOverviewDto> {
    const [inside, expected, pendingApproval, pendingParcels] = await Promise.all([
      this.client.visitor.count({
        where: { societyId, status: { in: ["inside", "in"] } },
      }),
      this.client.visitor.count({
        where: {
          societyId,
          OR: [
            { status: "expected", residentResponse: { in: ["approved", "approve"] } },
            { status: "approved" },
          ],
        },
      }),
      this.client.visitor.count({
        where: {
          societyId,
          OR: [
            { status: "expected", residentResponse: null },
            { status: "pending_approval" },
          ],
        },
      }),
      this.client.package.count({ where: { societyId, status: "received" } }),
    ]);

    return {
      gateLabel: "Main Gate",
      counts: { inside, expected, pendingApproval, pendingParcels },
    };
  }

  async listVisitors(societyId: string, status?: string): Promise<MobileGuardVisitorDto[]> {
    const visitors = await this.client.visitor.findMany({
      where: {
        societyId,
        ...(status ? { status: storedStatusFilter(status) } : {}),
      },
      orderBy: { arrivedAt: "desc" },
    });
    return visitors.map(toMobileVisitor);
  }

  async requestVisitor(command: RequestMobileVisitorCommand): Promise<MobileGuardVisitorDto> {
    const flat = await this.client.flat.findFirst({
      where: { societyId: command.societyId, flatNumber: command.flatQuery.trim(), isActive: true },
      include: {
        units: {
          include: {
            occupancies: {
              where: { isActive: true, occupancyStatus: "ACTIVE" },
              include: {
                person: {
                  include: {
                    users: { select: { id: true } },
                  },
                },
              },
            },
          },
        },
      },
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

    const occupancyUserIds = flat.units?.flatMap((unit) =>
      unit.occupancies.flatMap((occupancy) =>
        occupancy.person.users.map((user) => user.id),
      ),
    ) ?? [];
    const fallbackUsers = occupancyUserIds.length > 0
      ? []
      : await this.client.user.findMany({
        where: {
          isActive: true,
          role: { in: ["member", "tenant"] },
          OR: [
            { flatId: flat.id, societyId: command.societyId },
            {
              memberships: {
                some: {
                  societyId: command.societyId,
                  flatId: flat.id,
                  status: "active",
                },
              },
            },
          ],
        },
        select: { id: true },
      });
    const residentUserIds = [...new Set([
      ...occupancyUserIds,
      ...fallbackUsers.map((user) => user.id),
    ])];

    const visitor = await this.client.$transaction(async (transaction) => {
      const created = await transaction.visitor.create({
        data: {
          societyId: command.societyId,
          flatId: flat.id,
          flatNumber: flat.flatNumber,
          visitorName: command.visitorName.trim(),
          purpose: command.purpose.trim(),
          phone: command.phone?.trim() || null,
          vehicleNo: command.vehicleNo?.trim() || null,
          passcode: command.passcode ?? null,
          verificationMethod: "manual",
          status: "expected",
          isPreApproved: false,
          arrivedAt: new Date(),
        },
      });
      if (residentUserIds.length > 0) {
        await transaction.notification.createMany({
          data: residentUserIds.map((userId) => ({
            societyId: command.societyId,
            userId,
            type: "visitor_entry",
            title: "Visitor waiting at gate",
            message: `${created.visitorName} is waiting at the gate for Flat ${flat.flatNumber}.`,
            link: `/my-visitors?approve=${created.id}`,
          })),
        });
      }
      return created;
    });
    return toMobileVisitor(visitor);
  }

  async findVisitor(societyId: string, visitorId: string): Promise<GuardVisitorRecord | null> {
    const visitor = await this.client.visitor.findFirst({ where: { id: visitorId, societyId } });
    return visitor ? normalizeVisitorRecord(visitor) : null;
  }

  async verifyPasscode(
    societyId: string,
    visitorId: string,
    passcode: string,
  ): Promise<MobileGuardPasscodeResultDto> {
    const visitor = await this.requirePersistedVisitor(societyId, visitorId);
    if (!isResidentApproved(visitor)) {
      throw mobileGuardProblem("visitor_not_approved", "Visitor approval is required before check-in.", 409);
    }
    if (!visitor.passcode || visitor.passcode !== passcode) {
      throw mobileGuardProblem("invalid_visitor_passcode", "The visitor passcode is not valid.", 400);
    }
    const verified = await this.client.visitor.updateMany({
      where: {
        id: visitorId,
        societyId,
        passcode,
        OR: approvedStatePredicate(),
      },
      data: { verificationMethod: "passcode" },
    });
    if (verified.count !== 1) {
      throw mobileGuardProblem("invalid_visitor_passcode", "The visitor passcode is not valid.", 400);
    }
    return { id: visitorId, passcodeVerified: true };
  }

  async markEntered(societyId: string, visitorId: string): Promise<MobileGuardVisitorDto> {
    const visitor = await this.requirePersistedVisitor(societyId, visitorId);
    await this.assertNotBlacklisted(visitor);
    if (visitor.passcode && visitor.verificationMethod !== "passcode") {
      throw mobileGuardProblem("passcode_verification_required", "Verify the visitor passcode before check-in.", 409);
    }
    const entryTime = new Date();
    const updated = await this.client.visitor.updateMany({
      where: {
        id: visitor.id,
        societyId,
        OR: approvedStatePredicate(),
        ...(visitor.passcode ? { verificationMethod: "passcode" } : {}),
      },
      data: { status: "inside", entryTime },
    });
    if (updated.count !== 1) {
      throw mobileGuardProblem("visitor_not_approved", "Visitor approval is required before check-in.", 409);
    }
    return toMobileVisitor({ ...visitor, status: "inside", entryTime });
  }

  async markExited(societyId: string, visitorId: string): Promise<MobileGuardVisitorDto> {
    const visitor = await this.requirePersistedVisitor(societyId, visitorId);
    const exitTime = new Date();
    const updated = await this.client.visitor.updateMany({
      where: { id: visitor.id, societyId, status: { in: ["inside", "in"] } },
      data: { status: "exited", exitTime },
    });
    if (updated.count !== 1) {
      throw mobileGuardProblem("visitor_not_inside", "The visitor has not checked in.", 409);
    }
    return toMobileVisitor({ ...visitor, status: "exited", exitTime });
  }

  private async requirePersistedVisitor(societyId: string, visitorId: string): Promise<GuardVisitorRecord> {
    const visitor = await this.client.visitor.findFirst({ where: { id: visitorId, societyId } });
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
  const normalized = normalizeVisitorRecord(visitor);
  return {
    id: normalized.id,
    flatNumber: normalized.flatNumber,
    visitorName: normalized.visitorName,
    purpose: normalized.purpose,
    status: normalized.status as MobileGuardVisitorStatus,
    passcodeRequired: Boolean(normalized.passcode),
    residentResponse: normalized.residentResponse,
    phone: normalized.phone,
    vehicleNo: normalized.vehicleNo,
    arrivedAt: normalized.arrivedAt.toISOString(),
    entryTime: normalized.entryTime?.toISOString() ?? null,
    exitTime: normalized.exitTime?.toISOString() ?? null,
  };
}

function normalizeVisitorRecord(visitor: GuardVisitorRecord): GuardVisitorRecord {
  return {
    ...visitor,
    status: normalizeStoredStatus(visitor.status),
    residentResponse: normalizeResidentResponse(visitor.residentResponse),
  };
}

function normalizeStoredStatus(status: string): MobileGuardVisitorStatus {
  switch (status) {
    case "in":
    case "inside":
      return "inside";
    case "out":
    case "exited":
      return "exited";
    case "pending_approval":
    case "approved":
    case "expected":
      return "expected";
    case "rejected":
      return "rejected";
    case "cancelled":
      return "cancelled";
    default:
      return "cancelled";
  }
}

function normalizeResidentResponse(response: string | null): string | null {
  if (response === "approve") return "approved";
  if (response === "reject") return "rejected";
  return response;
}

function storedStatusFilter(status: string): string | { in: string[] } {
  switch (status) {
    case "inside":
    case "in":
      return { in: ["inside", "in"] };
    case "exited":
    case "out":
      return { in: ["exited", "out"] };
    case "expected":
    case "approved":
    case "pending_approval":
      return { in: ["expected", "approved", "pending_approval"] };
    default:
      return status;
  }
}

function approvedStatePredicate(): Array<Record<string, unknown>> {
  return [
    { status: "expected", residentResponse: { in: ["approved", "approve"] } },
    { status: "approved" },
  ];
}

function isResidentApproved(visitor: GuardVisitorRecord): boolean {
  return visitor.status === "approved" ||
    (
      visitor.status === "expected" &&
      ["approved", "approve"].includes(visitor.residentResponse ?? "")
    );
}
