import "server-only";
import { prisma } from "./prisma";
import { getSession } from "./auth";

interface LogActivityParams {
  action: string;
  module: string;
  targetId?: string;
  targetLabel?: string;
  details?: Record<string, unknown>;
}

export async function logActivity({
  action,
  module,
  targetId,
  targetLabel,
  details,
}: LogActivityParams) {
  try {
    const session = await getSession();
    if (!session?.societyId) return;

    await prisma.activityLog.create({
      data: {
        societyId: session.societyId,
        userId: session.userId,
        userName: session.name || "System",
        action,
        module,
        targetId,
        targetLabel,
        details: details ? JSON.stringify(details) : null,
      },
    });
  } catch (error) {
    // Don't let logging failures break the main operation
    console.error("Failed to log activity:", error);
  }
}

// Convenience helpers
export const logCreated = (module: string, targetId: string, targetLabel: string, details?: Record<string, unknown>) =>
  logActivity({ action: "created", module, targetId, targetLabel, details });

export const logUpdated = (module: string, targetId: string, targetLabel: string, details?: Record<string, unknown>) =>
  logActivity({ action: "updated", module, targetId, targetLabel, details });

export const logDeleted = (module: string, targetId: string, targetLabel: string) =>
  logActivity({ action: "deleted", module, targetId, targetLabel });

export const logPayment = (targetId: string, targetLabel: string, details?: Record<string, unknown>) =>
  logActivity({ action: "paid", module: "bill", targetId, targetLabel, details });
