export type CommunityWorkerCommand =
  | "notice-expiry-reminder"
  | "meeting-reminder"
  | "event-reminder"
  | "poll-closing-nudge"
  | "unread-notice-nudge"
  | "document-expiry-nudge";

export interface CommunityWorkerJobInput {
  societyId: string;
  command: CommunityWorkerCommand;
  referenceId: string;
  targetRef?: string;
}

export interface CommunityWorkerJob {
  id: string;
  queue: "community";
  name: CommunityWorkerCommand;
  attempts: number;
  payload: {
    societyId: string;
    command: CommunityWorkerCommand;
    referenceId: string;
    targetRef?: string;
  };
}

export function buildCommunityWorkerJob(input: CommunityWorkerJobInput): CommunityWorkerJob {
  const societyId = input.societyId.trim();
  const referenceId = input.referenceId.trim();

  if (!societyId || !referenceId) {
    throw new Error("Community worker jobs require societyId and referenceId.");
  }

  const targetRef = input.targetRef?.trim();
  const idSuffix = targetRef ? `:${targetRef}` : "";

  return {
    id: `community:${input.command}:${societyId}:${referenceId}${idSuffix}`,
    queue: "community",
    name: input.command,
    attempts: 5,
    payload: {
      societyId,
      command: input.command,
      referenceId,
      ...(targetRef ? { targetRef } : {}),
    },
  };
}
