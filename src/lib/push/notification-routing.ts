export interface PushEnvelope {
  type: string;
  tag?: string;
  societyId?: string;
  payload?: {
    title?: string;
    body?: string;
    url?: string;
    link?: string;
    flatNumber?: string;
  };
}

const ROUTING_MAP: Record<string, string> = {
  "visitor-approval": "/my-visitors",
  "visitor-arrived": "/visitors",
  "sos-alert": "/emergency",
  "package-arrived": "/packages",
  "notice-published": "/notices",
  "complaint-update": "/complaints",
  emergency: "/emergency",
  general: "/dashboard",
};

export function resolveNotificationUrl(envelope: PushEnvelope): string {
  const key = envelope.tag || envelope.type;
  const mapped = ROUTING_MAP[key] || ROUTING_MAP[envelope.type];
  if (mapped) return mapped;
  return envelope.payload?.url || envelope.payload?.link || "/dashboard";
}

export function buildPushPayload(envelope: PushEnvelope) {
  const tag = envelope.tag || envelope.type || "general";
  return {
    title: envelope.payload?.title || "SmartSocietyHub",
    body: envelope.payload?.body || "",
    url: resolveNotificationUrl(envelope),
    tag,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    priority: tag === "sos-alert" || tag === "emergency" ? "emergency" : "normal",
  };
}
