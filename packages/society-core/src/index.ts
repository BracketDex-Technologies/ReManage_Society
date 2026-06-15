export type RelationshipType =
  | "OWNER"
  | "TENANT"
  | "CO_OWNER"
  | "FAMILY_MEMBER"
  | "CAREGIVER"
  | "COMMERCIAL_OPERATOR";

export type BillingResponsibility = "OWNER" | "TENANT" | "SPLIT" | "CUSTOM";
export type MoveType = "MOVE_IN" | "MOVE_OUT";
export type DirectoryViewerRole = "resident" | "committee" | "treasurer" | "society_admin";

export interface SocietySetupInput {
  societyId: string;
  societyName: string;
  address?: string;
  city?: string;
  pincode?: string;
  buildings: readonly BuildingInput[];
}

export interface BuildingInput {
  name: string;
  wings: readonly WingInput[];
}

export interface WingInput {
  name: string;
  floors: readonly FloorInput[];
}

export interface FloorInput {
  number: number;
  units: readonly UnitInput[];
}

export interface UnitInput {
  unitNumber: string;
  unitType?: string;
  usageType?: string;
}

export interface SetupUnitPlan {
  societyId: string;
  buildingName: string;
  wing: string;
  floor: number;
  unitNumber: string;
  unitType: string;
  usageType: string;
  occupancyStatus: "VACANT";
  billingStatus: "ACTIVE";
}

export interface SocietyCoreError {
  code: string;
  message: string;
  path: string;
}

export interface SocietySetupPlan {
  ready: boolean;
  societyId: string;
  societyName: string;
  summary: {
    buildings: number;
    wings: number;
    floors: number;
    units: number;
  };
  units: SetupUnitPlan[];
  errors: SocietyCoreError[];
}

export interface ImportRowInput {
  rowNumber: number;
  unitNumber: string;
  personName: string;
  phone?: string;
  email?: string;
  relationshipType: string;
  billingResponsibility?: BillingResponsibility;
}

export interface AcceptedImportRow {
  rowNumber: number;
  unitNumber: string;
  personName: string;
  phone?: string;
  email?: string;
  relationshipType: RelationshipType;
  billingResponsibility: BillingResponsibility;
}

export interface ImportRowError {
  rowNumber: number;
  field: keyof ImportRowInput;
  code: string;
  message: string;
}

export interface ImportDryRunResult {
  accepted: AcceptedImportRow[];
  errors: ImportRowError[];
}

export interface OccupancyMoveInput {
  societyId: string;
  unitId: string;
  personId: string;
  relationshipType: RelationshipType;
  moveType: MoveType;
  effectiveDate: Date;
  actorId: string;
}

export interface OccupancyMovePlan {
  societyId: string;
  unitId: string;
  personId: string;
  relationshipType: RelationshipType;
  newUnitOccupancyStatus: "OWNER_OCCUPIED" | "TENANT_OCCUPIED" | "VACANT";
  occupancyStatus: "ACTIVE" | "MOVED_OUT";
  billingResponsibility: BillingResponsibility;
  moveEvent: {
    type: "move_in" | "move_out";
    initiatedBy: string;
    residentType: "owner" | "tenant";
    status: "initiated";
    effectiveDate: string;
  };
}

export interface DirectoryPerson {
  unitNumber: string;
  personName: string;
  relationshipType: RelationshipType;
  phone?: string;
  email?: string;
  showPhone: boolean;
  showEmail: boolean;
}

export interface DirectoryViewer {
  role: DirectoryViewerRole;
}

export interface DirectoryEntry {
  unitNumber: string;
  personName: string;
  relationshipType: RelationshipType;
  phone?: string;
  email?: string;
}

const SUPPORTED_IMPORT_RELATIONSHIPS = new Set<RelationshipType>([
  "OWNER",
  "TENANT",
  "CO_OWNER",
  "FAMILY_MEMBER",
  "CAREGIVER",
  "COMMERCIAL_OPERATOR",
]);

const FULL_DIRECTORY_ROLES = new Set<DirectoryViewerRole>([
  "committee",
  "treasurer",
  "society_admin",
]);

export function createSocietySetupPlan(input: SocietySetupInput): SocietySetupPlan {
  const units: SetupUnitPlan[] = [];
  const errors: SocietyCoreError[] = [];
  const seenUnits = new Set<string>();
  let wingCount = 0;
  let floorCount = 0;

  input.buildings.forEach((building, buildingIndex) => {
    building.wings.forEach((wing, wingIndex) => {
      wingCount += 1;
      wing.floors.forEach((floor, floorIndex) => {
        floorCount += 1;
        floor.units.forEach((unit, unitIndex) => {
          const unitNumber = unit.unitNumber.trim();
          const unitKey = unitNumber.toUpperCase();
          const path = `buildings[${buildingIndex}].wings[${wingIndex}].floors[${floorIndex}].units[${unitIndex}].unitNumber`;

          if (seenUnits.has(unitKey)) {
            errors.push({
              code: "duplicate_unit",
              message: `Unit ${unitNumber} appears more than once in society ${input.societyId}.`,
              path,
            });
            return;
          }

          seenUnits.add(unitKey);
          units.push({
            societyId: input.societyId,
            buildingName: building.name.trim(),
            wing: wing.name.trim(),
            floor: floor.number,
            unitNumber,
            unitType: unit.unitType?.trim() || "2BHK",
            usageType: unit.usageType?.trim() || "RESIDENTIAL",
            occupancyStatus: "VACANT",
            billingStatus: "ACTIVE",
          });
        });
      });
    });
  });

  return {
    ready: errors.length === 0,
    societyId: input.societyId,
    societyName: input.societyName.trim(),
    summary: {
      buildings: input.buildings.length,
      wings: wingCount,
      floors: floorCount,
      units: units.length,
    },
    units,
    errors,
  };
}

export function validateSocietyImportRows(rows: readonly ImportRowInput[]): ImportDryRunResult {
  const accepted: AcceptedImportRow[] = [];
  const errors: ImportRowError[] = [];

  for (const row of rows) {
    const rowErrors: ImportRowError[] = [];
    const unitNumber = row.unitNumber.trim();
    const personName = row.personName.trim();
    const relationshipType = row.relationshipType.trim().toUpperCase();

    if (!unitNumber) {
      rowErrors.push({
        rowNumber: row.rowNumber,
        field: "unitNumber",
        code: "required",
        message: "Unit number is required.",
      });
    }

    if (!personName) {
      rowErrors.push({
        rowNumber: row.rowNumber,
        field: "personName",
        code: "required",
        message: "Person name is required.",
      });
    }

    if (!SUPPORTED_IMPORT_RELATIONSHIPS.has(relationshipType as RelationshipType)) {
      rowErrors.push({
        rowNumber: row.rowNumber,
        field: "relationshipType",
        code: "unsupported_relationship",
        message: `Relationship ${relationshipType} is not supported for Phase 3 import.`,
      });
    }

    errors.push(...rowErrors);

    if (rowErrors.length === 0) {
      accepted.push({
        rowNumber: row.rowNumber,
        unitNumber,
        personName,
        phone: normalizeOptional(row.phone),
        email: normalizeOptional(row.email),
        relationshipType: relationshipType as RelationshipType,
        billingResponsibility: row.billingResponsibility ?? defaultBillingResponsibility(relationshipType as RelationshipType),
      });
    }
  }

  return { accepted, errors };
}

export function planOccupancyMove(input: OccupancyMoveInput): OccupancyMovePlan {
  const movingIn = input.moveType === "MOVE_IN";
  const residentType = input.relationshipType === "TENANT" ? "tenant" : "owner";

  return {
    societyId: input.societyId,
    unitId: input.unitId,
    personId: input.personId,
    relationshipType: input.relationshipType,
    newUnitOccupancyStatus: movingIn ? unitStatusForRelationship(input.relationshipType) : "VACANT",
    occupancyStatus: movingIn ? "ACTIVE" : "MOVED_OUT",
    billingResponsibility: defaultBillingResponsibility(input.relationshipType),
    moveEvent: {
      type: movingIn ? "move_in" : "move_out",
      initiatedBy: input.actorId,
      residentType,
      status: "initiated",
      effectiveDate: input.effectiveDate.toISOString(),
    },
  };
}

export function buildResidentDirectory(
  people: readonly DirectoryPerson[],
  viewer: DirectoryViewer,
): DirectoryEntry[] {
  const canSeeFullContact = FULL_DIRECTORY_ROLES.has(viewer.role);

  return people.map((person) => ({
    unitNumber: person.unitNumber,
    personName: person.personName,
    relationshipType: person.relationshipType,
    ...(canSeeFullContact || person.showPhone ? { phone: person.phone } : {}),
    ...(canSeeFullContact || person.showEmail ? { email: person.email } : {}),
  }));
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function defaultBillingResponsibility(relationshipType: RelationshipType): BillingResponsibility {
  return relationshipType === "TENANT" ? "TENANT" : "OWNER";
}

function unitStatusForRelationship(
  relationshipType: RelationshipType,
): "OWNER_OCCUPIED" | "TENANT_OCCUPIED" {
  return relationshipType === "TENANT" ? "TENANT_OCCUPIED" : "OWNER_OCCUPIED";
}

export {
  MOVE_RESIDENT_TYPES,
  MOVE_WIZARD_STATUS,
  MOVE_WIZARD_TYPES,
  assertCanApproveMoveWizard,
  assertCanRejectMoveWizard,
  assertCanSubmitMoveWizard,
  buildMoveWizardChecklist,
  generateGatePassCode,
  isCommitteeMoveApprover,
  markChecklistItemCompleted,
  moveWizardStatusLabel,
  requiresTenantDocuments,
  shiftingChargeForMoveType,
  type MoveWizardRecord,
  type MoveWizardStatus,
  type MoveWizardType,
} from "./move-wizard.ts";
