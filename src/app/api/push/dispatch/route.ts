import { getSession } from "@/lib/auth";
import { sendPushToUser } from "@/lib/push";
import { buildPushPayload, type PushEnvelope } from "@/lib/push/notification-routing";

const VAPID_READY = Boolean(
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
);

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.societyId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!["chairman", "secretary", "treasurer"].includes(session.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!VAPID_READY) {
    return Response.json(
      {
        status: "degraded",
        sent: 0,
        reason: "VAPID keys are not configured",
      },
      { status: 503 },
    );
  }

  const envelope = (await request.json()) as PushEnvelope & { targets?: string[] };
  const payload = buildPushPayload(envelope);
  const targets = envelope.targets ?? [];

  let sent = 0;
  for (const userId of targets) {
    const result = await sendPushToUser(
      userId,
      session.societyId,
      payload.title,
      payload.body,
      payload.url,
      payload.tag,
    );
    sent += result.sent;
  }

  return Response.json({ status: "ok", sent, tag: payload.tag, url: payload.url });
}
