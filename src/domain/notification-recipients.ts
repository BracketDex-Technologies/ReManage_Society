export const USER_SCOPED_NOTIFICATION_TYPES: string[] = ["bill_due"];

export function requiresNotificationRecipient(type: string) {
  return USER_SCOPED_NOTIFICATION_TYPES.includes(type);
}

export function canShowBroadcastNotification(type: string) {
  return !requiresNotificationRecipient(type);
}

export function billDueRecipientUserIds(target?: { userIds?: Array<string | null | undefined> } | null) {
  return Array.from(
    new Set(
      (target?.userIds || [])
        .map((userId) => userId?.trim())
        .filter((userId): userId is string => Boolean(userId))
    )
  );
}
