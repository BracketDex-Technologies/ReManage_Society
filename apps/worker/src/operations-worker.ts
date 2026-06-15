export type OperationsWorkerCommand =
  | "amc-expiry-reminder"
  | "maintenance-due-reminder"
  | "sos-escalation"
  | "visitor-overstay-check";

export interface OperationsWorkerJobInput {
  societyId: string;
  command: OperationsWorkerCommand;
  referenceId: string;
}

export interface OperationsWorkerJob {
  id: string;
  queue: "operations";
  name: OperationsWorkerCommand;
  attempts: number;
  payload: OperationsWorkerJobInput;
}

export function buildOperationsWorkerJob(input: OperationsWorkerJobInput): OperationsWorkerJob {
  const societyId = input.societyId.trim();
  const referenceId = input.referenceId.trim();

  if (!societyId || !referenceId) {
    throw new Error("Operations worker jobs require societyId and referenceId.");
  }

  return {
    id: `operations:${input.command}:${societyId}:${referenceId}`,
    queue: "operations",
    name: input.command,
    attempts: 5,
    payload: {
      societyId,
      command: input.command,
      referenceId,
    },
  };
}
