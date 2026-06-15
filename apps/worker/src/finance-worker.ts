export type FinanceWorkerCommand =
  | "send-billing-reminders"
  | "reconcile-payments"
  | "rebuild-financial-reports";

export interface FinanceWorkerJobInput {
  societyId: string;
  command: FinanceWorkerCommand;
  period: string;
}

export interface FinanceWorkerJob {
  id: string;
  queue: "finance";
  name: FinanceWorkerCommand;
  attempts: number;
  payload: FinanceWorkerJobInput;
}

export function buildFinanceWorkerJob(input: FinanceWorkerJobInput): FinanceWorkerJob {
  const societyId = input.societyId.trim();
  const period = input.period.trim();

  if (!societyId || !period) {
    throw new Error("Finance worker jobs require societyId and period.");
  }

  return {
    id: `finance:${input.command}:${societyId}:${period}`,
    queue: "finance",
    name: input.command,
    attempts: 5,
    payload: {
      societyId,
      command: input.command,
      period,
    },
  };
}
