export const SUPPORTED_NOTICE_CATEGORIES = [
  "general",
  "event",
  "maintenance",
  "emergency",
  "meeting",
] as const;

export type NoticeCategory = (typeof SUPPORTED_NOTICE_CATEGORIES)[number];

export interface NoticeInput {
  societyId: string;
  title: string;
  body: string;
  category?: string;
  postedBy: string;
  isPinned?: boolean;
  expiresAt?: Date;
}

export interface NoticePlan {
  societyId: string;
  title: string;
  body: string;
  category: NoticeCategory;
  postedBy: string;
  isPinned: boolean;
  expiresAt?: string;
}

export interface NoticeRetentionInput {
  expiresAt?: Date | null;
  now: Date;
}

export interface NoticeReadDedupeInput {
  noticeId: string;
  userId: string;
}

export interface CommunityEventEnvelopeInput {
  societyId: string;
  action: string;
  clientEventId: string;
  occurredAt: Date;
  payload: Record<string, unknown>;
}

export interface CommunityEventEnvelope {
  id: string;
  queue: "community";
  name: string;
  attempts: number;
  societyId: string;
  occurredAt: string;
  clientEventId: string;
  payload: Record<string, unknown>;
}

export function normalizeNoticeCategory(category: string | undefined): NoticeCategory {
  const normalized = (category ?? "general").trim().toLowerCase();

  if (!SUPPORTED_NOTICE_CATEGORIES.includes(normalized as NoticeCategory)) {
    throw new Error(`Notice category ${category} is not supported.`);
  }

  return normalized as NoticeCategory;
}

export function planNotice(input: NoticeInput): NoticePlan {
  const societyId = requireValue(input.societyId, "societyId");
  const title = requireValue(input.title, "title");
  const body = requireValue(input.body, "body");
  const postedBy = requireValue(input.postedBy, "postedBy");
  const category = normalizeNoticeCategory(input.category);
  const isPinned = input.isPinned ?? false;

  return {
    societyId,
    title,
    body,
    category,
    postedBy,
    isPinned,
    ...(input.expiresAt
      ? { expiresAt: requireDate(input.expiresAt, "expiresAt").toISOString() }
      : {}),
  };
}

export function isNoticeExpired(input: NoticeRetentionInput): boolean {
  if (!input.expiresAt) {
    return false;
  }

  return requireDate(input.expiresAt, "expiresAt").getTime() < requireDate(input.now, "now").getTime();
}

export function isNoticeActive(input: NoticeRetentionInput): boolean {
  return !isNoticeExpired(input);
}

export function noticeReadDedupeKey(input: NoticeReadDedupeInput): string {
  const noticeId = requireValue(input.noticeId, "noticeId");
  const userId = requireValue(input.userId, "userId");

  return `${noticeId}:${userId}`;
}

export function buildCommunityEventEnvelope(
  input: CommunityEventEnvelopeInput,
): CommunityEventEnvelope {
  const societyId = requireValue(input.societyId, "societyId");
  const action = requireValue(input.action, "action");
  const clientEventId = input.clientEventId.trim();

  if (!clientEventId) {
    throw new Error("A client event id is required for offline replay safety.");
  }

  return {
    id: `community:${action}:${societyId}:${clientEventId}`,
    queue: "community",
    name: action,
    attempts: 5,
    societyId,
    occurredAt: requireDate(input.occurredAt, "occurredAt").toISOString(),
    clientEventId,
    payload: input.payload,
  };
}

export const SUPPORTED_COMPLAINT_CATEGORIES = [
  "general",
  "plumbing",
  "electrical",
  "cleanliness",
  "security",
  "parking",
] as const;

export type ComplaintCategory = (typeof SUPPORTED_COMPLAINT_CATEGORIES)[number];

export const SUPPORTED_COMPLAINT_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export type ComplaintPriority = (typeof SUPPORTED_COMPLAINT_PRIORITIES)[number];

export type ComplaintStatus = "open" | "in_progress" | "resolved" | "closed";

export type ComplaintAction = "start" | "resolve" | "close" | "reopen";

export const COMPLAINT_OPEN_STATUSES: readonly ComplaintStatus[] = ["open", "in_progress"];

export type ComplaintEscalationTarget = "none" | "secretary" | "chairman";

const COMPLAINT_TRANSITIONS: Record<
  ComplaintStatus,
  Partial<Record<ComplaintAction, ComplaintStatus>>
> = {
  open: { start: "in_progress", resolve: "resolved", close: "closed" },
  in_progress: { resolve: "resolved", close: "closed" },
  resolved: { reopen: "in_progress", close: "closed" },
  closed: { reopen: "open" },
};

const DEFAULT_SLA_HOURS: Record<ComplaintPriority, number> = {
  urgent: 4,
  high: 24,
  medium: 48,
  low: 72,
};

const COMPLAINT_ESCALATION_TARGETS: readonly ComplaintEscalationTarget[] = [
  "none",
  "secretary",
  "chairman",
];

export const MAX_COMPLAINT_ESCALATION_LEVEL = 2;

export function normalizeComplaintCategory(category: string | undefined): ComplaintCategory {
  const normalized = (category ?? "general").trim().toLowerCase();

  if (!SUPPORTED_COMPLAINT_CATEGORIES.includes(normalized as ComplaintCategory)) {
    throw new Error(`Complaint category ${category} is not supported.`);
  }

  return normalized as ComplaintCategory;
}

export function normalizeComplaintPriority(priority: string | undefined): ComplaintPriority {
  const normalized = (priority ?? "medium").trim().toLowerCase();

  if (!SUPPORTED_COMPLAINT_PRIORITIES.includes(normalized as ComplaintPriority)) {
    throw new Error(`Complaint priority ${priority} is not supported.`);
  }

  return normalized as ComplaintPriority;
}

export function applyComplaintTransition(input: {
  current: ComplaintStatus;
  action: ComplaintAction;
}): { status: ComplaintStatus } {
  const next = COMPLAINT_TRANSITIONS[input.current]?.[input.action];

  if (!next) {
    throw new Error(
      `Complaint cannot transition from ${input.current} using action ${input.action}.`,
    );
  }

  return { status: next };
}

export function defaultSlaHours(priority: string | undefined): number {
  return DEFAULT_SLA_HOURS[normalizeComplaintPriority(priority)];
}

export function computeSlaDueAt(input: { createdAt: Date; slaHours: number }): Date {
  if (!Number.isFinite(input.slaHours) || input.slaHours <= 0) {
    throw new Error("SLA hours must be greater than zero.");
  }

  return new Date(requireDate(input.createdAt, "createdAt").getTime() + input.slaHours * 3_600_000);
}

export function isSlaBreached(input: {
  dueAt: Date;
  now: Date;
  status: ComplaintStatus;
}): boolean {
  if (!COMPLAINT_OPEN_STATUSES.includes(input.status)) {
    return false;
  }

  return requireDate(input.now, "now").getTime() > requireDate(input.dueAt, "dueAt").getTime();
}

export function nextEscalationLevel(current: number): number {
  const normalized = Number.isFinite(current) ? Math.max(0, Math.floor(current)) : 0;
  return Math.min(MAX_COMPLAINT_ESCALATION_LEVEL, normalized + 1);
}

export function escalationTarget(level: number): ComplaintEscalationTarget {
  const normalized = Number.isFinite(level) ? Math.max(0, Math.floor(level)) : 0;
  return COMPLAINT_ESCALATION_TARGETS[Math.min(MAX_COMPLAINT_ESCALATION_LEVEL, normalized)];
}

export function assertSatisfactionRating(rating: number): number {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Satisfaction rating must be an integer between 1 and 5.");
  }

  return rating;
}

export const SUPPORTED_DOCUMENT_SCOPES = ["society", "flat", "personal"] as const;

export type DocumentScope = (typeof SUPPORTED_DOCUMENT_SCOPES)[number];

export const SUPPORTED_DOCUMENT_CATEGORIES = [
  "bylaws",
  "rules",
  "noc",
  "minutes",
  "financial",
  "general",
] as const;

export type DocumentCategory = (typeof SUPPORTED_DOCUMENT_CATEGORIES)[number];

export interface DocumentScopeRef {
  category: DocumentCategory;
  scope: DocumentScope;
  ownerRef: string;
}

export interface DocumentViewer {
  userId: string;
  flatNumber?: string;
  isManager: boolean;
}

export function normalizeDocumentScope(scope: string | undefined): DocumentScope {
  const normalized = (scope ?? "society").trim().toLowerCase();

  if (!SUPPORTED_DOCUMENT_SCOPES.includes(normalized as DocumentScope)) {
    throw new Error(`Document scope ${scope} is not supported.`);
  }

  return normalized as DocumentScope;
}

export function normalizeDocumentCategory(category: string | undefined): DocumentCategory {
  const normalized = (category ?? "general").trim().toLowerCase();

  if (!SUPPORTED_DOCUMENT_CATEGORIES.includes(normalized as DocumentCategory)) {
    throw new Error(`Document category ${category} is not supported.`);
  }

  return normalized as DocumentCategory;
}

export function resolveDocumentOwnerRef(scope: DocumentScope, ownerRef: string | undefined): string {
  if (scope === "society") {
    return "society";
  }

  const normalized = ownerRef?.trim();
  if (!normalized) {
    throw new Error(`A ${scope}-scoped document requires an ownerRef.`);
  }

  return normalized;
}

export function encodeDocumentCategory(input: {
  category?: string;
  scope?: string;
  ownerRef?: string;
}): string {
  const category = normalizeDocumentCategory(input.category);
  const scope = normalizeDocumentScope(input.scope);
  const ownerRef = resolveDocumentOwnerRef(scope, input.ownerRef);

  return `${category}#${scope}:${ownerRef}`;
}

export function decodeDocumentCategory(encoded: string): DocumentScopeRef {
  const value = requireValue(encoded, "category");
  const hashIndex = value.indexOf("#");

  if (hashIndex === -1) {
    return { category: normalizeDocumentCategory(value), scope: "society", ownerRef: "society" };
  }

  const category = normalizeDocumentCategory(value.slice(0, hashIndex));
  const rest = value.slice(hashIndex + 1);
  const colonIndex = rest.indexOf(":");

  if (colonIndex === -1) {
    return { category, scope: "society", ownerRef: "society" };
  }

  const scope = normalizeDocumentScope(rest.slice(0, colonIndex));
  const ownerRef = resolveDocumentOwnerRef(scope, rest.slice(colonIndex + 1));

  return { category, scope, ownerRef };
}

export function resolveDocumentVisibility(input: {
  scope: DocumentScope;
  ownerRef: string;
  viewer: DocumentViewer;
}): boolean {
  if (input.scope === "society") {
    return true;
  }

  if (input.scope === "flat") {
    return input.viewer.isManager || (Boolean(input.viewer.flatNumber) && input.viewer.flatNumber === input.ownerRef);
  }

  return input.viewer.userId === input.ownerRef;
}

export function documentVersionKey(input: {
  societyId: string;
  scope: string;
  ownerRef: string;
  title: string;
}): string {
  const societyId = requireValue(input.societyId, "societyId");
  const scope = normalizeDocumentScope(input.scope);
  const ownerRef = resolveDocumentOwnerRef(scope, input.ownerRef);
  const title = requireValue(input.title, "title").toLowerCase();

  return `${societyId}:${scope}:${ownerRef}:${title}`;
}

export const SUPPORTED_MEETING_TYPES = ["agm", "sgm", "committee", "general"] as const;

export type MeetingType = (typeof SUPPORTED_MEETING_TYPES)[number];

export function normalizeMeetingType(type: string | undefined): MeetingType {
  const normalized = (type ?? "general").trim().toLowerCase();

  if (!SUPPORTED_MEETING_TYPES.includes(normalized as MeetingType)) {
    throw new Error(`Meeting type ${type} is not supported.`);
  }

  return normalized as MeetingType;
}

export type PollStatus = "active" | "closed";

export interface PollPlan {
  title: string;
  description?: string;
  options: string[];
  status: PollStatus;
}

export interface PollVoteState {
  options: readonly string[];
  votes: Record<string, number>;
  voters: readonly string[];
  status: PollStatus;
  closesAt?: Date | null;
}

export interface PollVoteResult {
  votes: Record<string, number>;
  voters: string[];
}

export interface PollTallyRow {
  index: number;
  option: string;
  count: number;
}

export interface PollTally {
  rows: PollTallyRow[];
  totalVotes: number;
}

export function planPoll(input: {
  title: string;
  description?: string;
  options: readonly string[];
}): PollPlan {
  const title = requireValue(input.title, "title");
  const options = (input.options ?? []).map((option) => option?.trim()).filter(Boolean) as string[];

  if (options.length < 2) {
    throw new Error("A poll requires at least two non-empty options.");
  }

  if (new Set(options).size !== options.length) {
    throw new Error("Poll options must be unique.");
  }

  const description = input.description?.trim();

  return {
    title,
    ...(description ? { description } : {}),
    options,
    status: "active",
  };
}

export function isPollOpen(input: {
  status: PollStatus;
  closesAt?: Date | null;
  now: Date;
}): boolean {
  if (input.status !== "active") {
    return false;
  }

  if (!input.closesAt) {
    return true;
  }

  return requireDate(input.closesAt, "closesAt").getTime() > requireDate(input.now, "now").getTime();
}

export function castPollVote(input: {
  state: PollVoteState;
  voterRef: string;
  optionIndex: number;
  now: Date;
}): PollVoteResult {
  const voterRef = requireValue(input.voterRef, "voterRef");

  if (!isPollOpen({ status: input.state.status, closesAt: input.state.closesAt, now: input.now })) {
    throw new Error("Poll is not open for voting.");
  }

  if (
    !Number.isInteger(input.optionIndex) ||
    input.optionIndex < 0 ||
    input.optionIndex >= input.state.options.length
  ) {
    throw new Error("Poll option index is out of range.");
  }

  if (input.state.voters.includes(voterRef)) {
    throw new Error("This voter has already voted in the poll.");
  }

  const votes: Record<string, number> = { ...input.state.votes };
  const key = String(input.optionIndex);
  votes[key] = (votes[key] ?? 0) + 1;

  return { votes, voters: [...input.state.voters, voterRef] };
}

export function tallyPoll(input: {
  options: readonly string[];
  votes: Record<string, number>;
}): PollTally {
  const rows = input.options.map((option, index) => ({
    index,
    option,
    count: input.votes[String(index)] ?? 0,
  }));

  return { rows, totalVotes: rows.reduce((sum, row) => sum + row.count, 0) };
}

export const SUPPORTED_EVENT_CATEGORIES = [
  "general",
  "festival",
  "meeting",
  "sports",
  "cultural",
  "maintenance",
] as const;

export type EventCategory = (typeof SUPPORTED_EVENT_CATEGORIES)[number];

export type EventStatus = "upcoming" | "ongoing" | "completed" | "cancelled";

export type EventAction = "start" | "complete" | "cancel";

export const EVENT_TERMINAL_STATUSES: readonly EventStatus[] = ["completed", "cancelled"];

const EVENT_TRANSITIONS: Record<EventStatus, Partial<Record<EventAction, EventStatus>>> = {
  upcoming: { start: "ongoing", cancel: "cancelled" },
  ongoing: { complete: "completed", cancel: "cancelled" },
  completed: {},
  cancelled: {},
};

export const SUPPORTED_RSVP_RESPONSES = ["attending", "maybe", "declined"] as const;

export type RsvpResponse = (typeof SUPPORTED_RSVP_RESPONSES)[number];

export function normalizeEventCategory(category: string | undefined): EventCategory {
  const normalized = (category ?? "general").trim().toLowerCase();

  if (!SUPPORTED_EVENT_CATEGORIES.includes(normalized as EventCategory)) {
    throw new Error(`Event category ${category} is not supported.`);
  }

  return normalized as EventCategory;
}

export function applyEventTransition(input: {
  current: EventStatus;
  action: EventAction;
}): { status: EventStatus } {
  const next = EVENT_TRANSITIONS[input.current]?.[input.action];

  if (!next) {
    throw new Error(`Event cannot transition from ${input.current} using action ${input.action}.`);
  }

  return { status: next };
}

export function normalizeRsvpResponse(response: string | undefined): RsvpResponse {
  const normalized = (response ?? "attending").trim().toLowerCase();

  if (!SUPPORTED_RSVP_RESPONSES.includes(normalized as RsvpResponse)) {
    throw new Error(`RSVP response ${response} is not supported.`);
  }

  return normalized as RsvpResponse;
}

export function assertRsvpCapacity(input: {
  maxAttendees?: number | null;
  currentAttending: number;
  willAttend: boolean;
}): void {
  if (!input.willAttend || input.maxAttendees == null) {
    return;
  }

  if (input.maxAttendees <= 0) {
    throw new Error("Event capacity is full.");
  }

  if (input.currentAttending >= input.maxAttendees) {
    throw new Error("Event capacity is full.");
  }
}

export function eventRsvpDedupeKey(input: { eventId: string; userId: string }): string {
  return `${requireValue(input.eventId, "eventId")}:${requireValue(input.userId, "userId")}`;
}

export const SUPPORTED_FORUM_CATEGORIES = [
  "general",
  "maintenance",
  "security",
  "events",
  "buy-sell",
  "lost-found",
] as const;

export type ForumCategory = (typeof SUPPORTED_FORUM_CATEGORIES)[number];

export const SUPPORTED_FORUM_MODERATION_ACTIONS = ["pin", "unpin", "lock", "unlock"] as const;

export type ForumModerationAction = (typeof SUPPORTED_FORUM_MODERATION_ACTIONS)[number];

export function normalizeForumCategory(category: string | undefined): ForumCategory {
  const normalized = (category ?? "general").trim().toLowerCase();

  if (!SUPPORTED_FORUM_CATEGORIES.includes(normalized as ForumCategory)) {
    throw new Error(`Forum category ${category} is not supported.`);
  }

  return normalized as ForumCategory;
}

export function assertThreadNotLocked(isLocked: boolean): void {
  if (isLocked) {
    throw new Error("This thread is locked and cannot accept new replies.");
  }
}

export function applyForumModeration(action: string): { isPinned?: boolean; isLocked?: boolean } {
  const normalized = (action ?? "").trim().toLowerCase();

  switch (normalized) {
    case "pin":
      return { isPinned: true };
    case "unpin":
      return { isPinned: false };
    case "lock":
      return { isLocked: true };
    case "unlock":
      return { isLocked: false };
    default:
      throw new Error(`Forum moderation action ${action} is not supported.`);
  }
}

export const SUPPORTED_LISTING_CATEGORIES = [
  "furniture",
  "electronics",
  "appliances",
  "clothing",
  "books",
  "vehicles",
  "services",
  "general",
] as const;

export type ListingCategory = (typeof SUPPORTED_LISTING_CATEGORIES)[number];

export const SUPPORTED_LISTING_CONDITIONS = ["new", "like_new", "good", "fair", "poor"] as const;

export type ListingCondition = (typeof SUPPORTED_LISTING_CONDITIONS)[number];

export const SUPPORTED_LISTING_PRIVACY = ["society", "verified_residents", "hidden_contact"] as const;

export type ListingPrivacy = (typeof SUPPORTED_LISTING_PRIVACY)[number];

export type ListingStatus = "active" | "sold" | "reserved" | "expired";

export type ListingAction = "reserve" | "release" | "sell" | "expire";

export type ModerationStatus = "pending" | "approved" | "rejected" | "reported";

export const SUPPORTED_MODERATION_ACTIONS = ["approve", "reject", "report", "archive"] as const;

export type ModerationAction = (typeof SUPPORTED_MODERATION_ACTIONS)[number];

const LISTING_TRANSITIONS: Record<ListingStatus, Partial<Record<ListingAction, ListingStatus>>> = {
  active: { reserve: "reserved", sell: "sold", expire: "expired" },
  reserved: { release: "active", sell: "sold", expire: "expired" },
  sold: {},
  expired: {},
};

export function normalizeListingCategory(category: string | undefined): ListingCategory {
  const normalized = (category ?? "general").trim().toLowerCase();

  if (!SUPPORTED_LISTING_CATEGORIES.includes(normalized as ListingCategory)) {
    throw new Error(`Listing category ${category} is not supported.`);
  }

  return normalized as ListingCategory;
}

export function normalizeListingCondition(condition: string | undefined): ListingCondition {
  const normalized = (condition ?? "good").trim().toLowerCase();

  if (!SUPPORTED_LISTING_CONDITIONS.includes(normalized as ListingCondition)) {
    throw new Error(`Listing condition ${condition} is not supported.`);
  }

  return normalized as ListingCondition;
}

export function normalizeListingPrivacy(privacy: string | undefined): ListingPrivacy {
  const normalized = (privacy ?? "society").trim().toLowerCase();

  if (!SUPPORTED_LISTING_PRIVACY.includes(normalized as ListingPrivacy)) {
    throw new Error(`Listing privacy ${privacy} is not supported.`);
  }

  return normalized as ListingPrivacy;
}

export function applyListingTransition(input: {
  current: ListingStatus;
  action: ListingAction;
}): { status: ListingStatus } {
  const next = LISTING_TRANSITIONS[input.current]?.[input.action];

  if (!next) {
    throw new Error(`Listing cannot transition from ${input.current} using action ${input.action}.`);
  }

  return { status: next };
}

export function applyModeration(action: string): {
  moderationStatus: ModerationStatus | null;
  listingStatus: ListingStatus | null;
} {
  const normalized = (action ?? "").trim().toLowerCase();

  switch (normalized) {
    case "approve":
      return { moderationStatus: "approved", listingStatus: null };
    case "reject":
      return { moderationStatus: "rejected", listingStatus: null };
    case "report":
      return { moderationStatus: "reported", listingStatus: null };
    case "archive":
      return { moderationStatus: null, listingStatus: "expired" };
    default:
      throw new Error(`Moderation action ${action} is not supported.`);
  }
}

export function isListingPubliclyVisible(input: {
  status: string;
  moderationStatus: string;
}): boolean {
  return input.status === "active" && (input.moderationStatus === "approved" || input.moderationStatus === "pending");
}

export function resolveListingContactVisibility(input: {
  privacyStatus: ListingPrivacy;
  viewer: { isVerifiedResident: boolean; isManager: boolean; isOwner?: boolean };
}): boolean {
  if (input.viewer.isManager || input.viewer.isOwner) {
    return true;
  }

  switch (input.privacyStatus) {
    case "society":
      return true;
    case "verified_residents":
      return input.viewer.isVerifiedResident;
    case "hidden_contact":
      return false;
  }
}

export const LEGAL_CHECKLIST_DISCLAIMER =
  "This is general informational guidance and a process checklist only. It is not legal advice. Consult a qualified professional before acting.";

export interface LegalChecklistTemplate {
  id: string;
  title: string;
  category: string;
  items: readonly string[];
}

const LEGAL_CHECKLIST_TEMPLATES: readonly LegalChecklistTemplate[] = [
  {
    id: "agm-conduct",
    title: "Annual General Meeting (AGM) Conduct Checklist",
    category: "governance",
    items: [
      "Confirm AGM date complies with bye-law notice period",
      "Circulate agenda and previous minutes to all members",
      "Verify quorum requirements before starting",
      "Record attendance, resolutions, and voting outcomes",
      "Distribute approved minutes within the bye-law timeframe",
    ],
  },
  {
    id: "member-dispute",
    title: "Member Dispute Handling Checklist",
    category: "disputes",
    items: [
      "Log the complaint with date, parties, and description",
      "Acknowledge receipt to the complainant",
      "Collect documentation and statements from both sides",
      "Review applicable bye-laws and prior decisions",
      "Record the committee decision and communicate it in writing",
    ],
  },
  {
    id: "vendor-contract",
    title: "Vendor Contract Review Checklist",
    category: "contracts",
    items: [
      "Confirm scope of work, deliverables, and timelines",
      "Verify pricing, payment schedule, and penalty clauses",
      "Check insurance, licenses, and statutory compliance",
      "Define termination, renewal, and dispute-resolution terms",
      "Obtain committee approval before signing",
    ],
  },
];

export function listLegalChecklistTemplates(): {
  disclaimer: string;
  templates: LegalChecklistTemplate[];
} {
  return {
    disclaimer: LEGAL_CHECKLIST_DISCLAIMER,
    templates: LEGAL_CHECKLIST_TEMPLATES.map((template) => ({
      ...template,
      items: [...template.items],
    })),
  };
}

export function instantiateLegalChecklist(templateId: string): {
  templateId: string;
  title: string;
  category: string;
  disclaimer: string;
  items: { label: string; done: boolean }[];
} {
  const id = requireValue(templateId, "templateId");
  const template = LEGAL_CHECKLIST_TEMPLATES.find((candidate) => candidate.id === id);

  if (!template) {
    throw new Error(`Legal checklist template ${templateId} was not found.`);
  }

  return {
    templateId: template.id,
    title: template.title,
    category: template.category,
    disclaimer: LEGAL_CHECKLIST_DISCLAIMER,
    items: template.items.map((label) => ({ label, done: false })),
  };
}

function requireValue(value: string, field: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }

  return normalized;
}

function requireDate(value: Date, field: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error(`${field} must be a valid date.`);
  }

  return value;
}
