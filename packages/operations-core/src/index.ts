export type VisitorStatus =
  | "expected"
  | "pending_approval"
  | "approved"
  | "inside"
  | "exited"
  | "rejected"
  | "cancelled";

export type VisitorAction = "approve" | "reject" | "cancel" | "enter" | "exit";

export const VISITOR_TERMINAL_STATUSES: readonly VisitorStatus[] = [
  "exited",
  "rejected",
  "cancelled",
];

const VISITOR_TRANSITIONS: Record<VisitorStatus, Partial<Record<VisitorAction, VisitorStatus>>> = {
  expected: { enter: "inside", cancel: "cancelled" },
  pending_approval: { approve: "approved", reject: "rejected", cancel: "cancelled" },
  approved: { enter: "inside", cancel: "cancelled" },
  inside: { exit: "exited" },
  exited: {},
  rejected: {},
  cancelled: {},
};

export interface VisitorLogInput {
  societyId: string;
  flatNumber: string;
  visitorName: string;
  phone?: string;
  purpose: string;
  vehicleNo?: string;
  isPreApproved?: boolean;
  arrivedAt: Date;
}

export interface VisitorLogPlan {
  societyId: string;
  flatNumber: string;
  visitorName: string;
  phone?: string;
  purpose: string;
  vehicleNo?: string;
  isPreApproved: boolean;
  requiresResidentApproval: boolean;
  status: VisitorStatus;
  arrivedAt: string;
  dedupeKey: string;
}

export interface ExpectedVisitorInput {
  societyId: string;
  flatNumber: string;
  visitorName: string;
  phone?: string;
  purpose: string;
  vehicleNo?: string;
  expectedAt: Date;
}

export interface ExpectedVisitorPlan {
  societyId: string;
  flatNumber: string;
  visitorName: string;
  phone?: string;
  purpose: string;
  vehicleNo?: string;
  isPreApproved: boolean;
  status: VisitorStatus;
  expectedAt: string;
}

export interface VisitorTransitionInput {
  current: VisitorStatus;
  action: VisitorAction;
}

export interface VisitorTransitionResult {
  status: VisitorStatus;
}

export interface VisitorLogDedupeInput {
  societyId: string;
  flatNumber: string;
  phone?: string;
  visitorName: string;
  arrivedAt: Date;
}

export interface PatrolScanDedupeInput {
  societyId: string;
  guardId: string;
  checkpoint: string;
  scannedAt: Date;
}

export interface GuardActionEnvelopeInput {
  societyId: string;
  guardId: string;
  action: string;
  clientEventId: string;
  occurredAt: Date;
  payload: Record<string, unknown>;
}

export interface GuardActionEnvelope {
  id: string;
  queue: "operations";
  name: string;
  attempts: number;
  societyId: string;
  guardId: string;
  occurredAt: string;
  clientEventId: string;
  payload: Record<string, unknown>;
}

export function planVisitorLog(input: VisitorLogInput): VisitorLogPlan {
  const societyId = requireValue(input.societyId, "societyId");
  const flatNumber = requireValue(input.flatNumber, "flatNumber");
  const visitorName = requireValue(input.visitorName, "visitorName");
  const purpose = requireValue(input.purpose, "purpose");
  const isPreApproved = input.isPreApproved ?? false;
  const phone = normalizeOptional(input.phone);

  return {
    societyId,
    flatNumber,
    visitorName,
    ...(phone ? { phone } : {}),
    purpose,
    ...(normalizeOptional(input.vehicleNo) ? { vehicleNo: normalizeOptional(input.vehicleNo) } : {}),
    isPreApproved,
    requiresResidentApproval: !isPreApproved,
    status: isPreApproved ? "inside" : "pending_approval",
    arrivedAt: requireDate(input.arrivedAt, "arrivedAt").toISOString(),
    dedupeKey: visitorLogDedupeKey({
      societyId,
      flatNumber,
      phone,
      visitorName,
      arrivedAt: input.arrivedAt,
    }),
  };
}

export function planExpectedVisitor(input: ExpectedVisitorInput): ExpectedVisitorPlan {
  const phone = normalizeOptional(input.phone);
  const vehicleNo = normalizeOptional(input.vehicleNo);

  return {
    societyId: requireValue(input.societyId, "societyId"),
    flatNumber: requireValue(input.flatNumber, "flatNumber"),
    visitorName: requireValue(input.visitorName, "visitorName"),
    ...(phone ? { phone } : {}),
    purpose: requireValue(input.purpose, "purpose"),
    ...(vehicleNo ? { vehicleNo } : {}),
    isPreApproved: true,
    status: "expected",
    expectedAt: requireDate(input.expectedAt, "expectedAt").toISOString(),
  };
}

export function applyVisitorTransition(input: VisitorTransitionInput): VisitorTransitionResult {
  const next = VISITOR_TRANSITIONS[input.current]?.[input.action];

  if (!next) {
    throw new Error(
      `Visitor cannot transition from ${input.current} using action ${input.action}.`,
    );
  }

  return { status: next };
}

export function visitorLogDedupeKey(input: VisitorLogDedupeInput): string {
  const societyId = requireValue(input.societyId, "societyId");
  const flatNumber = requireValue(input.flatNumber, "flatNumber");
  const identity = normalizeOptional(input.phone) ?? requireValue(input.visitorName, "visitorName");

  return `${societyId}:${flatNumber}:${identity}:${requireDate(input.arrivedAt, "arrivedAt").toISOString()}`;
}

export function patrolScanDedupeKey(input: PatrolScanDedupeInput): string {
  const societyId = requireValue(input.societyId, "societyId");
  const guardId = requireValue(input.guardId, "guardId");
  const checkpoint = requireValue(input.checkpoint, "checkpoint");

  return `${societyId}:${guardId}:${checkpoint}:${requireDate(input.scannedAt, "scannedAt").toISOString()}`;
}

export function generateVisitorPasscode(random: () => number = Math.random): string {
  return sixDigitCode(random);
}

export function generatePickupOtp(random: () => number = Math.random): string {
  return sixDigitCode(random);
}

export type PackageStatus = "received" | "notified" | "collected" | "returned" | "lost";
export type PackageAction = "notify" | "collect" | "return" | "mark_lost";

export const PACKAGE_TERMINAL_STATUSES: readonly PackageStatus[] = [
  "collected",
  "returned",
  "lost",
];

const PACKAGE_TRANSITIONS: Record<PackageStatus, Partial<Record<PackageAction, PackageStatus>>> = {
  received: { notify: "notified", collect: "collected", return: "returned", mark_lost: "lost" },
  notified: { collect: "collected", return: "returned", mark_lost: "lost" },
  collected: {},
  returned: {},
  lost: {},
};

export interface PackageIntakeInput {
  societyId: string;
  flatId: string;
  courierName?: string;
  description?: string;
  loggedBy: string;
  receivedAt: Date;
}

export interface PackageIntakePlan {
  societyId: string;
  flatId: string;
  courierName?: string;
  description?: string;
  loggedBy: string;
  status: PackageStatus;
  receivedAt: string;
  dedupeKey: string;
}

export interface PackageTransitionInput {
  current: PackageStatus;
  action: PackageAction;
}

export interface PackageDedupeInput {
  societyId: string;
  flatId: string;
  courierName?: string;
  receivedAt: Date;
}

export interface PackagePickupInput {
  expectedOtp?: string | null;
  providedOtp: string;
}

export function planPackageIntake(input: PackageIntakeInput): PackageIntakePlan {
  const societyId = requireValue(input.societyId, "societyId");
  const flatId = requireValue(input.flatId, "flatId");
  const loggedBy = requireValue(input.loggedBy, "loggedBy");
  const courierName = normalizeOptional(input.courierName);
  const description = normalizeOptional(input.description);

  return {
    societyId,
    flatId,
    ...(courierName ? { courierName } : {}),
    ...(description ? { description } : {}),
    loggedBy,
    status: "received",
    receivedAt: requireDate(input.receivedAt, "receivedAt").toISOString(),
    dedupeKey: packageIntakeDedupeKey({
      societyId,
      flatId,
      courierName,
      receivedAt: input.receivedAt,
    }),
  };
}

export function applyPackageTransition(input: PackageTransitionInput): { status: PackageStatus } {
  const next = PACKAGE_TRANSITIONS[input.current]?.[input.action];

  if (!next) {
    throw new Error(
      `Package cannot transition from ${input.current} using action ${input.action}.`,
    );
  }

  return { status: next };
}

export function packageIntakeDedupeKey(input: PackageDedupeInput): string {
  const societyId = requireValue(input.societyId, "societyId");
  const flatId = requireValue(input.flatId, "flatId");
  const courier = normalizeOptional(input.courierName) ?? "unknown";

  return `${societyId}:${flatId}:${courier}:${requireDate(input.receivedAt, "receivedAt").toISOString()}`;
}

export function verifyPackagePickup(input: PackagePickupInput): boolean {
  const expected = normalizeOptional(input.expectedOtp ?? undefined);

  if (!expected) {
    throw new Error("Package has no pickup OTP set.");
  }

  const provided = requireValue(input.providedOtp, "providedOtp");
  if (expected !== provided) {
    throw new Error("Package pickup OTP does not match.");
  }

  return true;
}

export function buildGuardActionEnvelope(input: GuardActionEnvelopeInput): GuardActionEnvelope {
  const societyId = requireValue(input.societyId, "societyId");
  const guardId = requireValue(input.guardId, "guardId");
  const action = requireValue(input.action, "action");
  const clientEventId = input.clientEventId.trim();

  if (!clientEventId) {
    throw new Error("A client event id is required for offline replay safety.");
  }

  return {
    id: `operations:${action}:${societyId}:${clientEventId}`,
    queue: "operations",
    name: action,
    attempts: 5,
    societyId,
    guardId,
    occurredAt: requireDate(input.occurredAt, "occurredAt").toISOString(),
    clientEventId,
    payload: input.payload,
  };
}

export const SUPPORTED_STAFF_CATEGORIES = [
  "maid",
  "cook",
  "driver",
  "nanny",
  "gardener",
  "watchman",
  "other",
] as const;

export type StaffCategory = (typeof SUPPORTED_STAFF_CATEGORIES)[number];

export const SUPPORTED_ATTENDANCE_METHODS = ["manual", "code", "biometric"] as const;

export type AttendanceMethod = (typeof SUPPORTED_ATTENDANCE_METHODS)[number];

export interface AttendanceDedupeInput {
  societyId: string;
  staffId: string;
  checkIn: Date;
}

export function normalizeStaffCategory(category: string): StaffCategory {
  const normalized = requireValue(category, "category").toLowerCase();

  if (!SUPPORTED_STAFF_CATEGORIES.includes(normalized as StaffCategory)) {
    throw new Error(`Staff category ${category} is not supported.`);
  }

  return normalized as StaffCategory;
}

export function normalizeAttendanceMethod(method: string | undefined): AttendanceMethod {
  const normalized = (method ?? "manual").trim().toLowerCase();

  if (!SUPPORTED_ATTENDANCE_METHODS.includes(normalized as AttendanceMethod)) {
    throw new Error(`Attendance method ${method} is not supported.`);
  }

  return normalized as AttendanceMethod;
}

export function generateStaffEntryCode(random: () => number = Math.random): string {
  return sixDigitCode(random);
}

export function attendanceDedupeKey(input: AttendanceDedupeInput): string {
  const societyId = requireValue(input.societyId, "societyId");
  const staffId = requireValue(input.staffId, "staffId");

  return `${societyId}:${staffId}:${requireDate(input.checkIn, "checkIn").toISOString()}`;
}

export const SUPPORTED_INCIDENT_TYPES = [
  "theft",
  "trespassing",
  "fight",
  "suspicious",
  "accident",
  "emergency",
  "other",
] as const;

export type IncidentType = (typeof SUPPORTED_INCIDENT_TYPES)[number];

export const SUPPORTED_INCIDENT_SEVERITIES = ["low", "medium", "high", "critical"] as const;

export type IncidentSeverity = (typeof SUPPORTED_INCIDENT_SEVERITIES)[number];

export type SosEscalationTier = "guard" | "committee" | "society_admin" | "emergency_services";

export interface SosEscalationPlan {
  severity: IncidentSeverity;
  tiers: SosEscalationTier[];
  acknowledgementRequired: boolean;
}

export interface BlacklistEntry {
  id: string;
  name: string;
  phone?: string | null;
}

export interface BlacklistMatchInput {
  entries: readonly BlacklistEntry[];
  name?: string;
  phone?: string;
}

export interface SosDedupeInput {
  societyId: string;
  reportedBy: string;
  raisedAt: Date;
}

const SOS_ESCALATION_TIERS: Record<IncidentSeverity, SosEscalationTier[]> = {
  low: ["guard"],
  medium: ["guard", "committee"],
  high: ["guard", "committee", "society_admin"],
  critical: ["guard", "committee", "society_admin", "emergency_services"],
};

export function normalizeIncidentType(type: string): IncidentType {
  const normalized = requireValue(type, "type").toLowerCase();

  if (!SUPPORTED_INCIDENT_TYPES.includes(normalized as IncidentType)) {
    throw new Error(`Incident type ${type} is not supported.`);
  }

  return normalized as IncidentType;
}

export function normalizeIncidentSeverity(severity: string | undefined): IncidentSeverity {
  const normalized = (severity ?? "medium").trim().toLowerCase();

  if (!SUPPORTED_INCIDENT_SEVERITIES.includes(normalized as IncidentSeverity)) {
    throw new Error(`Incident severity ${severity} is not supported.`);
  }

  return normalized as IncidentSeverity;
}

export function computeSosEscalation(severity: string | undefined): SosEscalationPlan {
  const normalized = normalizeIncidentSeverity(severity);

  return {
    severity: normalized,
    tiers: [...SOS_ESCALATION_TIERS[normalized]],
    acknowledgementRequired: normalized === "high" || normalized === "critical",
  };
}

export function sosDedupeKey(input: SosDedupeInput): string {
  const societyId = requireValue(input.societyId, "societyId");
  const reportedBy = requireValue(input.reportedBy, "reportedBy");

  return `sos:${societyId}:${reportedBy}:${requireDate(input.raisedAt, "raisedAt").toISOString()}`;
}

export function matchBlacklist(input: BlacklistMatchInput): BlacklistEntry[] {
  const phone = normalizeOptional(input.phone);
  const name = normalizeOptional(input.name)?.toLowerCase();

  if (!phone && !name) {
    return [];
  }

  return input.entries.filter((entry) => {
    const entryPhone = normalizeOptional(entry.phone ?? undefined);
    const entryName = normalizeOptional(entry.name)?.toLowerCase();
    const phoneMatch = Boolean(phone && entryPhone && entryPhone === phone);
    const nameMatch = Boolean(name && entryName && entryName === name);
    return phoneMatch || nameMatch;
  });
}

export const SUPPORTED_VENDOR_CATEGORIES = [
  "electrical",
  "plumbing",
  "lift",
  "pest",
  "security",
  "cleaning",
  "other",
] as const;

export type VendorCategory = (typeof SUPPORTED_VENDOR_CATEGORIES)[number];

export const SUPPORTED_ASSET_CONDITIONS = [
  "excellent",
  "good",
  "fair",
  "poor",
  "out_of_order",
] as const;

export type AssetCondition = (typeof SUPPORTED_ASSET_CONDITIONS)[number];

export type CoverageStatus = "none" | "active" | "expiring_soon" | "expired";

export function normalizeVendorCategory(category: string): VendorCategory {
  const normalized = requireValue(category, "category").toLowerCase();

  if (!SUPPORTED_VENDOR_CATEGORIES.includes(normalized as VendorCategory)) {
    throw new Error(`Vendor category ${category} is not supported.`);
  }

  return normalized as VendorCategory;
}

export function normalizeAssetCondition(condition: string | undefined): AssetCondition {
  const normalized = (condition ?? "good").trim().toLowerCase();

  if (!SUPPORTED_ASSET_CONDITIONS.includes(normalized as AssetCondition)) {
    throw new Error(`Asset condition ${condition} is not supported.`);
  }

  return normalized as AssetCondition;
}

export function computeCoverageStatus(input: {
  endDate?: Date | null;
  now: Date;
  expiringWithinDays?: number;
}): CoverageStatus {
  if (!input.endDate) {
    return "none";
  }

  const end = requireDate(input.endDate, "endDate").getTime();
  const now = requireDate(input.now, "now").getTime();

  if (end < now) {
    return "expired";
  }

  const windowDays = input.expiringWithinDays ?? 30;
  const daysLeft = (end - now) / 86_400_000;

  return daysLeft <= windowDays ? "expiring_soon" : "active";
}

export function computeNextMaintenance(input: {
  lastMaintenanceAt: Date;
  maintenanceCycleDays: number;
}): Date {
  if (!Number.isFinite(input.maintenanceCycleDays) || input.maintenanceCycleDays <= 0) {
    throw new Error("Maintenance cycle must be greater than zero days.");
  }

  return new Date(
    requireDate(input.lastMaintenanceAt, "lastMaintenanceAt").getTime() +
      input.maintenanceCycleDays * 86_400_000,
  );
}

export function isMaintenanceDue(input: { nextMaintenanceAt?: Date | null; now: Date }): boolean {
  if (!input.nextMaintenanceAt) {
    return false;
  }

  return requireDate(input.nextMaintenanceAt, "nextMaintenanceAt").getTime() <=
    requireDate(input.now, "now").getTime();
}

export interface AmenityPolicySnapshot {
  bookingWindowDays: number;
  maxHoursPerBooking: number;
  cooldownHours: number;
  cancellationCutoffHours: number;
  requiresApproval: boolean;
}

export interface BookingBlackout {
  startTime: string;
  endTime: string;
}

export interface BookingRequestInput {
  bookingDate: Date;
  startTime: string;
  endTime: string;
  now: Date;
  policy: AmenityPolicySnapshot;
  blackouts?: readonly BookingBlackout[];
}

export interface BookingEvaluation {
  ok: boolean;
  errors: string[];
  hours: number;
}

export type WaitlistStatus = "waiting" | "notified" | "booked" | "expired";
export type WaitlistAction = "notify" | "book" | "expire";

const WAITLIST_TRANSITIONS: Record<WaitlistStatus, Partial<Record<WaitlistAction, WaitlistStatus>>> = {
  waiting: { notify: "notified", book: "booked", expire: "expired" },
  notified: { book: "booked", expire: "expired" },
  booked: {},
  expired: {},
};

export function parseTimeToMinutes(time: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(requireValue(time, "time"));

  if (!match) {
    throw new Error(`Time ${time} must be in HH:mm format.`);
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) {
    throw new Error(`Time ${time} is out of range.`);
  }

  return hours * 60 + minutes;
}

export function computeBookingHours(startTime: string, endTime: string): number {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);

  if (end <= start) {
    throw new Error("Booking end time must be after start time.");
  }

  return Math.round(((end - start) / 60) * 100) / 100;
}

export function computeBookingAmount(hours: number, ratePerHour: number): number {
  if (hours <= 0) {
    throw new Error("Booking hours must be greater than zero.");
  }

  if (ratePerHour < 0) {
    throw new Error("Rate per hour cannot be negative.");
  }

  return Math.round(hours * ratePerHour * 100) / 100;
}

export function evaluateBookingRequest(input: BookingRequestInput): BookingEvaluation {
  const errors: string[] = [];
  const startMinutes = parseTimeToMinutes(input.startTime);
  const endMinutes = parseTimeToMinutes(input.endTime);
  let hours = 0;

  if (endMinutes <= startMinutes) {
    errors.push("Booking end time must be after start time.");
  } else {
    hours = Math.round(((endMinutes - startMinutes) / 60) * 100) / 100;
    if (hours > input.policy.maxHoursPerBooking) {
      errors.push(
        `Booking exceeds the maximum of ${input.policy.maxHoursPerBooking} hours per booking.`,
      );
    }
  }

  const bookingDayUtc = utcMidnight(requireDate(input.bookingDate, "bookingDate"));
  const nowDayUtc = utcMidnight(requireDate(input.now, "now"));
  const bookingStart = bookingDayUtc + startMinutes * 60_000;

  if (bookingStart < input.now.getTime()) {
    errors.push("Booking start is in the past.");
  }

  const daysAhead = Math.floor((bookingDayUtc - nowDayUtc) / 86_400_000);
  if (daysAhead > input.policy.bookingWindowDays) {
    errors.push(
      `Booking is outside the ${input.policy.bookingWindowDays}-day booking window.`,
    );
  }

  for (const blackout of input.blackouts ?? []) {
    const blackoutStart = parseTimeToMinutes(blackout.startTime);
    const blackoutEnd = parseTimeToMinutes(blackout.endTime);
    if (startMinutes < blackoutEnd && endMinutes > blackoutStart) {
      errors.push(`Booking overlaps a blackout window (${blackout.startTime}-${blackout.endTime}).`);
    }
  }

  return { ok: errors.length === 0, errors, hours };
}

export function assertCancellationAllowed(input: {
  start: Date;
  now: Date;
  cancellationCutoffHours: number;
}): void {
  const hoursUntilStart =
    (requireDate(input.start, "start").getTime() - requireDate(input.now, "now").getTime()) /
    3_600_000;

  if (hoursUntilStart < input.cancellationCutoffHours) {
    throw new Error(
      `Cancellation requires at least ${input.cancellationCutoffHours} hours notice.`,
    );
  }
}

export function applyWaitlistTransition(input: {
  current: WaitlistStatus;
  action: WaitlistAction;
}): { status: WaitlistStatus } {
  const next = WAITLIST_TRANSITIONS[input.current]?.[input.action];

  if (!next) {
    throw new Error(
      `Waitlist cannot transition from ${input.current} using action ${input.action}.`,
    );
  }

  return { status: next };
}

export const SUPPORTED_PARKING_SLOT_TYPES = ["CAR", "BIKE", "EV", "VISITOR", "STAFF"] as const;

export type ParkingSlotType = (typeof SUPPORTED_PARKING_SLOT_TYPES)[number];

export const SUPPORTED_PARKING_ASSIGNMENT_TYPES = [
  "OWNER",
  "TENANT",
  "TEMPORARY",
  "STAFF",
  "VISITOR",
] as const;

export type ParkingAssignmentType = (typeof SUPPORTED_PARKING_ASSIGNMENT_TYPES)[number];

export interface ParkingSlotState {
  status: string;
  isAssigned: boolean;
}

export interface ParkingCapacitySummary {
  total: number;
  available: number;
  assigned: number;
  blocked: number;
}

export function normalizeParkingSlotType(type: string | undefined): ParkingSlotType {
  const normalized = (type ?? "CAR").trim().toUpperCase();

  if (!SUPPORTED_PARKING_SLOT_TYPES.includes(normalized as ParkingSlotType)) {
    throw new Error(`Parking slot type ${type} is not supported.`);
  }

  return normalized as ParkingSlotType;
}

export function normalizeParkingAssignmentType(type: string | undefined): ParkingAssignmentType {
  const normalized = (type ?? "OWNER").trim().toUpperCase();

  if (!SUPPORTED_PARKING_ASSIGNMENT_TYPES.includes(normalized as ParkingAssignmentType)) {
    throw new Error(`Parking assignment type ${type} is not supported.`);
  }

  return normalized as ParkingAssignmentType;
}

export function assertSlotAssignable(slot: ParkingSlotState): void {
  if (slot.status.trim().toUpperCase() !== "ACTIVE") {
    throw new Error(`Parking slot is not active (status ${slot.status}).`);
  }

  if (slot.isAssigned) {
    throw new Error("Parking slot is already assigned.");
  }
}

export function summarizeParkingCapacity(
  slots: readonly ParkingSlotState[],
): ParkingCapacitySummary {
  let available = 0;
  let assigned = 0;
  let blocked = 0;

  for (const slot of slots) {
    const isActive = slot.status.trim().toUpperCase() === "ACTIVE";
    if (slot.isAssigned) {
      assigned += 1;
    }
    if (!isActive) {
      blocked += 1;
    } else if (!slot.isAssigned) {
      available += 1;
    }
  }

  return { total: slots.length, available, assigned, blocked };
}

export function computeAttendanceDurationMinutes(checkIn: Date, checkOut: Date): number {
  const start = requireDate(checkIn, "checkIn").getTime();
  const end = requireDate(checkOut, "checkOut").getTime();

  if (end < start) {
    throw new Error("Attendance check-out cannot be before check-in.");
  }

  return Math.round((end - start) / 60_000);
}

function utcMidnight(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function sixDigitCode(random: () => number): string {
  const value = random();

  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error("Code random source must return a value in [0, 1).");
  }

  return String(Math.floor(value * 1_000_000)).padStart(6, "0");
}

function requireValue(value: string, field: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }

  return normalized;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function requireDate(value: Date, field: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error(`${field} must be a valid date.`);
  }

  return value;
}

export {
  DEFAULT_DUES_ENFORCEMENT_DAYS,
  assertDuesEnforcementAllows,
  buildDuesEnforcementMessage,
  evaluateDuesEnforcement,
  type DuesBillSnapshot,
  type DuesEnforcementEvaluation,
  type DuesEnforcementFeature,
} from "./dues-enforcement.ts";

export {
  NOC_PURPOSES,
  NOC_VALIDITY_DAYS,
  assertValidNocPurpose,
  buildNocVerificationCode,
  evaluateNocEligibility,
  nocPurposeLabel,
  type NocBillSnapshot,
  type NocEligibilityResult,
  type NocPurpose,
} from "./noc-eligibility.ts";

export {
  AMC_COMPLIANCE_ALERT_DAYS,
  complianceAlertDedupeKey,
  mapVendorCategoryToComplaintCategory,
  planSocietyComplianceAlerts,
  planVendorComplianceAlerts,
  shouldOpenComplianceTicket,
  type ComplianceAlertKind,
  type ComplianceAlertPlan,
  type ComplianceCoverageStatus,
  type VendorComplianceSnapshot,
} from "./amc-compliance.ts";
