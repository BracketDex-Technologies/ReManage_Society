import "server-only";
import { prisma } from "./prisma";
import { requiresNotificationRecipient } from "@/domain/notification-recipients";

interface CreateNotificationParams {
  societyId: string;
  userId?: string | null;  // null = broadcast
  type: string;
  title: string;
  message: string;
  link?: string;
}

export async function createNotification({
  societyId,
  userId,
  type,
  title,
  message,
  link,
}: CreateNotificationParams) {
  try {
    if (!userId && requiresNotificationRecipient(type)) {
      console.warn(`Skipped ${type} notification without a target userId.`);
      return;
    }

    await prisma.notification.create({
      data: {
        societyId,
        userId: userId || null,
        type,
        title,
        message,
        link,
      },
    });
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
}

// Broadcast to all society members
export async function broadcastNotification(
  societyId: string,
  type: string,
  title: string,
  message: string,
  link?: string
) {
  return createNotification({ societyId, type, title, message, link });
}
