"use client";

import { visitorLogDedupeKey, patrolScanDedupeKey } from "@society/operations-core";
import { mobileFetchJson, OfflineQueuedError } from "./mobile-fetch";

interface VisitorLogInput {
  societyId: string;
  clientEventId: string;
  visitorName: string;
  flatNumber: string;
  phone?: string;
  arrivedAt: string;
  purpose?: string;
}

interface PatrolScanInput {
  societyId: string;
  clientEventId: string;
  guardId: string;
  checkpoint: string;
  scannedAt: string;
}

interface VisitorRespondInput {
  visitorId: string;
  action: "approve" | "reject";
  clientEventId: string;
}

interface SosRaiseInput {
  clientEventId: string;
  message: string;
  severity?: string;
}

interface ComplaintRaiseInput {
  clientEventId: string;
  title: string;
  description: string;
  category?: string;
}

export async function queueVisitorLog(input: VisitorLogInput) {
  const body = JSON.stringify(input);
  return mobileFetchJson("/api/guard/gate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    queueOnOffline: true,
    queuePriority: "high",
    dedupeKey: visitorLogDedupeKey({
      societyId: input.societyId,
      flatNumber: input.flatNumber,
      visitorName: input.visitorName,
      phone: input.phone,
      arrivedAt: new Date(input.arrivedAt),
    }),
  });
}

export async function queuePatrolScan(input: PatrolScanInput) {
  const body = JSON.stringify(input);
  return mobileFetchJson("/api/guard/gate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, action: "patrol-scan" }),
    queueOnOffline: true,
    queuePriority: "normal",
    dedupeKey: patrolScanDedupeKey({
      societyId: input.societyId,
      guardId: input.guardId,
      checkpoint: input.checkpoint,
      scannedAt: new Date(input.scannedAt),
    }),
  });
}

export async function queueVisitorRespond(input: VisitorRespondInput) {
  const body = JSON.stringify(input);
  return mobileFetchJson(`/api/visitors/${input.visitorId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body,
    queueOnOffline: true,
    queuePriority: "high",
    dedupeKey: `visitor-respond:${input.visitorId}:${input.clientEventId}`,
  });
}

export async function queueSosRaise(input: SosRaiseInput) {
  const body = JSON.stringify(input);
  return mobileFetchJson("/api/emergency/sos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    queueOnOffline: true,
    queuePriority: "high",
    dedupeKey: `sos:${input.clientEventId}`,
  });
}

export async function queueComplaintRaise(input: ComplaintRaiseInput) {
  const body = JSON.stringify(input);
  return mobileFetchJson("/api/complaints", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    queueOnOffline: true,
    queuePriority: "normal",
    dedupeKey: `complaint:${input.clientEventId}`,
  });
}

export { OfflineQueuedError };
