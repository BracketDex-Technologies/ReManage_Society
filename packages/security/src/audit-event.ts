import type { PermissionAction } from "./types.ts";

export type AuditOutcome = "allowed" | "denied" | "failed";

export interface AuditEventInput {
  actorId: string;
  societyId: string;
  action: PermissionAction;
  targetType: string;
  targetId: string;
  outcome: AuditOutcome;
  requestId: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditEvent {
  actorId: string;
  societyId: string;
  action: PermissionAction;
  targetType: string;
  targetId: string;
  outcome: AuditOutcome;
  requestId: string;
  timestamp: string;
  metadata: Readonly<Record<string, unknown>>;
}

export function createAuditEvent(input: AuditEventInput): AuditEvent {
  return Object.freeze({
    actorId: required(input.actorId, "actorId"),
    societyId: required(input.societyId, "societyId"),
    action: input.action,
    targetType: required(input.targetType, "targetType"),
    targetId: required(input.targetId, "targetId"),
    outcome: input.outcome,
    requestId: required(input.requestId, "requestId"),
    timestamp: input.timestamp ?? new Date().toISOString(),
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });
}

function required(value: string, name: string): string {
  if (!value.trim()) {
    throw new Error(`${name} is required`);
  }

  return value;
}

