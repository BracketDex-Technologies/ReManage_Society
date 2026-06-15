export const DEFAULT_DUES_ENFORCEMENT_DAYS = 60;

export type DuesEnforcementFeature = "amenity_booking" | "guest_parking";

export interface DuesBillSnapshot {
  id: string;
  period: string;
  dueDate: Date;
  status: string;
  totalAmount: number;
  paidAmount: number;
  description?: string | null;
}

export interface DuesEnforcementEvaluation {
  blocked: boolean;
  enabled: boolean;
  maxOverdueDays: number;
  overdueBills: Array<
    DuesBillSnapshot & {
      remainingAmount: number;
      daysOverdue: number;
    }
  >;
  oldestOverdueDays: number;
  totalOverdueAmount: number;
  message: string | null;
  blockedFeatures: DuesEnforcementFeature[];
}

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

function billRemaining(bill: DuesBillSnapshot) {
  return roundMoney(Math.max(0, bill.totalAmount - (bill.paidAmount ?? 0)));
}

function daysBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

export function buildDuesEnforcementMessage(input: {
  overdueBills: Array<{ period: string; remainingAmount: number; daysOverdue: number }>;
  feature: DuesEnforcementFeature;
  maxOverdueDays: number;
}): string {
  const featureLabel =
    input.feature === "guest_parking"
      ? "guest parking requests"
      : "clubhouse and amenity bookings";

  const top = input.overdueBills[0];
  const summary =
    input.overdueBills.length === 1
      ? `${top.period} dues (₹${top.remainingAmount.toLocaleString("en-IN")}, ${top.daysOverdue} days overdue)`
      : `${input.overdueBills.length} overdue bills totalling ₹${input.overdueBills
          .reduce((sum, bill) => sum + bill.remainingAmount, 0)
          .toLocaleString("en-IN")}`;

  return `Maintenance ${summary} exceed the ${input.maxOverdueDays}-day limit. Clear dues to use ${featureLabel}. Pay from My Bills or the link sent by your society.`;
}

export function evaluateDuesEnforcement(input: {
  bills: DuesBillSnapshot[];
  now: Date;
  maxOverdueDays?: number;
  enabled?: boolean;
  feature?: DuesEnforcementFeature;
}): DuesEnforcementEvaluation {
  const enabled = input.enabled ?? true;
  const maxOverdueDays = input.maxOverdueDays ?? DEFAULT_DUES_ENFORCEMENT_DAYS;
  const feature = input.feature ?? "amenity_booking";
  const blockedFeatures: DuesEnforcementFeature[] = ["amenity_booking", "guest_parking"];

  if (!enabled) {
    return {
      blocked: false,
      enabled: false,
      maxOverdueDays,
      overdueBills: [],
      oldestOverdueDays: 0,
      totalOverdueAmount: 0,
      message: null,
      blockedFeatures,
    };
  }

  const overdueBills = input.bills
    .map((bill) => {
      const remainingAmount = billRemaining(bill);
      if (remainingAmount <= 0 || bill.status === "paid") {
        return null;
      }

      const daysOverdue = daysBetween(bill.dueDate, input.now);
      if (daysOverdue < maxOverdueDays) {
        return null;
      }

      return {
        ...bill,
        remainingAmount,
        daysOverdue,
      };
    })
    .filter((bill): bill is NonNullable<typeof bill> => bill !== null)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  const oldestOverdueDays = overdueBills.length
    ? Math.max(...overdueBills.map((bill) => bill.daysOverdue))
    : 0;
  const totalOverdueAmount = roundMoney(
    overdueBills.reduce((sum, bill) => sum + bill.remainingAmount, 0),
  );

  return {
    blocked: overdueBills.length > 0,
    enabled: true,
    maxOverdueDays,
    overdueBills,
    oldestOverdueDays,
    totalOverdueAmount,
    message: overdueBills.length
      ? buildDuesEnforcementMessage({ overdueBills, feature, maxOverdueDays })
      : null,
    blockedFeatures,
  };
}

export function assertDuesEnforcementAllows(input: {
  evaluation: DuesEnforcementEvaluation;
  feature: DuesEnforcementFeature;
}): void {
  if (!input.evaluation.blocked) {
    return;
  }

  throw new Error(
    input.evaluation.message ??
      buildDuesEnforcementMessage({
        overdueBills: input.evaluation.overdueBills,
        feature: input.feature,
        maxOverdueDays: input.evaluation.maxOverdueDays,
      }),
  );
}
