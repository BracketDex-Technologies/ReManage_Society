import { Injectable } from "@nestjs/common";
import { prisma } from "../../../../packages/db/src/index.ts";
import {
  buildResidentDirectory,
  createSocietySetupPlan,
  planOccupancyMove,
  validateSocietyImportRows,
  type DirectoryEntry,
  type DirectoryViewer,
  type ImportRowError,
  type ImportRowInput,
  type OccupancyMoveInput,
  type SocietySetupInput,
} from "../../../../packages/society-core/src/index.ts";

interface UnitRecord {
  id: string;
  societyId: string;
  flatNumber: string;
  legacyFlatId?: string | null;
}

interface PersonRecord {
  id: string;
  name: string;
}

interface UserRecord {
  id: string;
  email: string;
}

interface DirectoryUnitRecord {
  flatNumber: string;
  occupancies: Array<{
    relationshipType: string;
    person: {
      id: string;
      name: string;
      phone?: string | null;
      users: Array<{
        email?: string | null;
        showPhoneInDirectory: boolean;
        showEmailInDirectory: boolean;
      }>;
    };
  }>;
}

export interface SocietyCoreTransactionClient {
  society: {
    upsert(input: {
      where: { id: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }): Promise<unknown>;
  };
  unit: {
    upsert(input: {
      where: { societyId_flatNumber: { societyId: string; flatNumber: string } };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }): Promise<UnitRecord>;
    findUnique(input: {
      where: { societyId_flatNumber: { societyId: string; flatNumber: string } } | { id: string };
    }): Promise<UnitRecord | null>;
    update(input: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
    findMany(input: Record<string, unknown>): Promise<DirectoryUnitRecord[]>;
  };
  person: {
    findFirst(input: Record<string, unknown>): Promise<PersonRecord | null>;
    create(input: { data: Record<string, unknown> }): Promise<PersonRecord>;
  };
  unitOccupancy: {
    findFirst(input: Record<string, unknown>): Promise<unknown | null>;
    create(input: { data: Record<string, unknown> }): Promise<unknown>;
    updateMany(input: Record<string, unknown>): Promise<{ count: number }>;
  };
  moveEvent: {
    create(input: { data: Record<string, unknown> }): Promise<unknown>;
  };
  user: {
    findFirst(input: Record<string, unknown>): Promise<UserRecord | null>;
    create(input: { data: Record<string, unknown> }): Promise<UserRecord>;
  };
}

export interface SocietyCorePersistenceClient extends SocietyCoreTransactionClient {
  $transaction<T>(callback: (transaction: SocietyCoreTransactionClient) => Promise<T>): Promise<T>;
}

export interface SetupCommitResult {
  societyId: string;
  unitsConfigured: number;
  ready: boolean;
  errors?: ImportRowError[];
}

export interface ImportCommitResult {
  acceptedRows: number;
  committedRows: number;
  errors: ImportRowError[];
}

export interface OccupancyCommitResult {
  societyId: string;
  unitId: string;
  occupancyStatus: "ACTIVE" | "MOVED_OUT";
  unitOccupancyStatus: "OWNER_OCCUPIED" | "TENANT_OCCUPIED" | "VACANT";
  moveEventRecorded: boolean;
}

export interface CredentialIssueInput {
  societyId: string;
  personId: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
}

export type CredentialIssueResult =
  | { issued: true; reason: string; userId: string }
  | { issued: false; reason: string; userId?: string };

@Injectable()
export class SocietyCoreRepository {
  constructor(private readonly client: SocietyCorePersistenceClient = prisma as unknown as SocietyCorePersistenceClient) {}

  async commitSetupPlan(input: SocietySetupInput): Promise<SetupCommitResult> {
    const plan = createSocietySetupPlan(input);
    if (!plan.ready) {
      return {
        societyId: input.societyId,
        unitsConfigured: 0,
        ready: false,
      };
    }

    await this.client.$transaction(async (transaction) => {
      await transaction.society.upsert({
        where: { id: input.societyId },
        create: {
          id: input.societyId,
          name: plan.societyName,
          address: input.address ?? "Pending address",
          city: input.city ?? "Pending city",
          pincode: input.pincode ?? "000000",
          totalFlats: plan.units.length,
        },
        update: {
          name: plan.societyName,
          address: input.address ?? "Pending address",
          city: input.city ?? "Pending city",
          pincode: input.pincode ?? "000000",
          totalFlats: plan.units.length,
        },
      });

      for (const unit of plan.units) {
        await transaction.unit.upsert({
          where: {
            societyId_flatNumber: {
              societyId: unit.societyId,
              flatNumber: unit.unitNumber,
            },
          },
          create: {
            societyId: unit.societyId,
            flatNumber: unit.unitNumber,
            wing: unit.wing,
            floor: unit.floor,
            unitType: unit.unitType,
            usageType: unit.usageType,
            occupancyStatus: unit.occupancyStatus,
            billingStatus: unit.billingStatus,
            isActive: true,
          },
          update: {
            wing: unit.wing,
            floor: unit.floor,
            unitType: unit.unitType,
            usageType: unit.usageType,
            occupancyStatus: unit.occupancyStatus,
            billingStatus: unit.billingStatus,
            isActive: true,
          },
        });
      }
    });

    return {
      societyId: input.societyId,
      unitsConfigured: plan.units.length,
      ready: true,
    };
  }

  async commitImportRows(
    societyId: string,
    rows: readonly ImportRowInput[],
  ): Promise<ImportCommitResult> {
    const dryRun = validateSocietyImportRows(rows);
    if (dryRun.errors.length > 0) {
      return {
        acceptedRows: dryRun.accepted.length,
        committedRows: 0,
        errors: dryRun.errors,
      };
    }

    const errors: ImportRowError[] = [];
    let committedRows = 0;

    await this.client.$transaction(async (transaction) => {
      for (const row of dryRun.accepted) {
        const unit = await transaction.unit.findUnique({
          where: {
            societyId_flatNumber: {
              societyId,
              flatNumber: row.unitNumber,
            },
          },
        });

        if (!unit) {
          errors.push({
            rowNumber: row.rowNumber,
            field: "unitNumber",
            code: "unit_not_found",
            message: `Unit ${row.unitNumber} does not exist in society ${societyId}.`,
          });
          continue;
        }

        const person = await this.findOrCreatePerson(transaction, societyId, row);
        const existingOccupancy = await transaction.unitOccupancy.findFirst({
          where: {
            societyId,
            unitId: unit.id,
            personId: person.id,
            relationshipType: row.relationshipType,
            isActive: true,
          },
        });

        if (!existingOccupancy) {
          await transaction.unitOccupancy.create({
            data: {
              societyId,
              unitId: unit.id,
              personId: person.id,
              relationshipType: row.relationshipType,
              occupancyStatus: "ACTIVE",
              billingResponsibility: row.billingResponsibility,
              isPrimaryOccupant: row.relationshipType === "OWNER" || row.relationshipType === "TENANT",
              isActive: true,
            },
          });
        }

        committedRows += 1;
      }
    });

    return {
      acceptedRows: dryRun.accepted.length,
      committedRows,
      errors,
    };
  }

  async commitOccupancyMove(input: OccupancyMoveInput): Promise<OccupancyCommitResult> {
    const plan = planOccupancyMove(input);

    return this.client.$transaction(async (transaction) => {
      const unit = await transaction.unit.findUnique({ where: { id: input.unitId } });
      if (!unit || unit.societyId !== input.societyId) {
        throw new Error(`Unit ${input.unitId} does not exist in society ${input.societyId}.`);
      }

      if (input.moveType === "MOVE_OUT") {
        await transaction.unitOccupancy.updateMany({
          where: {
            societyId: input.societyId,
            unitId: input.unitId,
            personId: input.personId,
            relationshipType: input.relationshipType,
            isActive: true,
          },
          data: {
            occupancyStatus: "MOVED_OUT",
            moveOutDate: input.effectiveDate,
            isActive: false,
          },
        });
      } else {
        await transaction.unitOccupancy.create({
          data: {
            societyId: input.societyId,
            unitId: input.unitId,
            personId: input.personId,
            relationshipType: input.relationshipType,
            occupancyStatus: "ACTIVE",
            billingResponsibility: plan.billingResponsibility,
            moveInDate: input.effectiveDate,
            isPrimaryOccupant: true,
            isActive: true,
          },
        });
      }

      await transaction.unit.update({
        where: { id: input.unitId },
        data: {
          occupancyStatus: plan.newUnitOccupancyStatus,
        },
      });

      const moveEventRecorded = await this.recordLegacyMoveEvent(transaction, unit, input, plan.moveEvent.type);

      return {
        societyId: input.societyId,
        unitId: input.unitId,
        occupancyStatus: plan.occupancyStatus,
        unitOccupancyStatus: plan.newUnitOccupancyStatus,
        moveEventRecorded,
      };
    });
  }

  async issueCredential(input: CredentialIssueInput): Promise<CredentialIssueResult> {
    if (!input.email?.trim()) {
      return {
        issued: false,
        reason: "Email is required before a credential account can be issued",
      };
    }

    const existing = await this.client.user.findFirst({
      where: {
        OR: [{ email: input.email }, { personId: input.personId }],
      },
    });

    if (existing) {
      return {
        issued: false,
        reason: "Credential account already exists",
        userId: existing.id,
      };
    }

    const user = await this.client.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        role: input.role,
        societyId: input.societyId,
        personId: input.personId,
        password: "OIDC_MANAGED_ACCOUNT",
      },
    });

    return {
      issued: true,
      reason: "Credential account created",
      userId: user.id,
    };
  }

  async readDirectory(societyId: string, viewer: DirectoryViewer): Promise<DirectoryEntry[]> {
    const units = await this.client.unit.findMany({
      where: {
        societyId,
        isActive: true,
      },
      orderBy: [{ wing: "asc" }, { floor: "asc" }, { flatNumber: "asc" }],
      include: {
        occupancies: {
          where: {
            isActive: true,
            occupancyStatus: "ACTIVE",
          },
          include: {
            person: {
              include: {
                users: true,
              },
            },
          },
        },
      },
    });

    return buildResidentDirectory(
      units.flatMap((unit) =>
        unit.occupancies.map((occupancy) => {
          const user = occupancy.person.users[0];
          return {
            unitNumber: unit.flatNumber,
            personName: occupancy.person.name,
            relationshipType: occupancy.relationshipType as "OWNER",
            phone: occupancy.person.phone ?? undefined,
            email: user?.email ?? undefined,
            showPhone: user?.showPhoneInDirectory ?? false,
            showEmail: user?.showEmailInDirectory ?? false,
          };
        }),
      ),
      viewer,
    );
  }

  private async findOrCreatePerson(
    transaction: SocietyCoreTransactionClient,
    societyId: string,
    row: {
      personName: string;
      phone?: string;
      email?: string;
    },
  ): Promise<PersonRecord> {
    const person = await transaction.person.findFirst({
      where: {
        societyId,
        OR: [
          ...(row.phone ? [{ phone: row.phone }] : []),
          { name: row.personName },
        ],
      },
    });

    if (person) {
      return person;
    }

    return transaction.person.create({
      data: {
        societyId,
        name: row.personName,
        phone: row.phone,
      },
    });
  }

  private async recordLegacyMoveEvent(
    transaction: SocietyCoreTransactionClient,
    unit: UnitRecord,
    input: OccupancyMoveInput,
    type: "move_in" | "move_out",
  ): Promise<boolean> {
    if (!unit.legacyFlatId) {
      return false;
    }

    await transaction.moveEvent.create({
      data: {
        flatId: unit.legacyFlatId,
        societyId: input.societyId,
        type,
        residentName: input.personId,
        residentType: input.relationshipType === "TENANT" ? "tenant" : "owner",
        status: "initiated",
        initiatedBy: input.actorId,
        completedAt: input.moveType === "MOVE_OUT" ? input.effectiveDate : undefined,
      },
    });

    return true;
  }
}
