import "server-only";
import webpush from "web-push";
import { prisma } from "./prisma";

// VAPID keys for Web Push (generate once, store in env)
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_EMAIL = process.env.VAPID_EMAIL || "mailto:admin@buzyhub.in";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
}

export async function sendPushToUser(
  userId: string,
  societyId: string,
  title: string,
  body: string,
  url?: string,
  tag?: string
) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return { sent: 0 };

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId, societyId },
  });

  let sent = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify({
          title,
          body,
          url: url || "/dashboard",
          tag: tag || "general",
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          priority: tag === "sos-alert" || tag === "emergency" ? "emergency" : "normal",
        })
      );
      sent++;
    } catch (error: unknown) {
      // If subscription is invalid (410 Gone), clean it up
      if (error instanceof Error && "statusCode" in error) {
        const statusCode = (error as { statusCode: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      }
    }
  }
  return { sent };
}

export async function sendPushToSociety(
  societyId: string,
  title: string,
  body: string,
  url?: string,
  excludeUserId?: string
) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return { sent: 0 };

  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      societyId,
      ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
    },
  });

  let sent = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify({
          title,
          body,
          url: url || "/dashboard",
          tag: "society-broadcast",
          icon: "/icons/icon-192.png",
        })
      );
      sent++;
    } catch (error: unknown) {
      if (error instanceof Error && "statusCode" in error) {
        const statusCode = (error as { statusCode: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      }
    }
  }
  return { sent };
}

// Send push to all users of a specific flat
export async function sendPushToFlat(
  societyId: string,
  flatNumber: string,
  title: string,
  body: string,
  url?: string
) {
  const flat = await prisma.flat.findFirst({
    where: { societyId, flatNumber },
  });
  if (!flat) return { sent: 0 };

  const users = await prisma.user.findMany({
    where: { societyId, flatId: flat.id },
    select: { id: true },
  });

  let totalSent = 0;
  for (const user of users) {
    const result = await sendPushToUser(user.id, societyId, title, body, url);
    totalSent += result.sent;
  }
  return { sent: totalSent };
}
