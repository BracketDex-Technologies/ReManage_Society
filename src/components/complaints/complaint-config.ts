import {
  MessageSquare,
  Droplets,
  Zap,
  Sparkles,
  Shield,
  Car,
  type LucideIcon,
} from "lucide-react";

export const COMPLAINT_CATEGORIES = [
  "general",
  "plumbing",
  "electrical",
  "cleanliness",
  "security",
  "parking",
] as const;

export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number];

export const categoryConfig: Record<
  ComplaintCategory,
  { icon: LucideIcon; label: string; defaultPriority: string }
> = {
  general: { icon: MessageSquare, label: "General", defaultPriority: "medium" },
  plumbing: { icon: Droplets, label: "Plumbing", defaultPriority: "high" },
  electrical: { icon: Zap, label: "Electrical", defaultPriority: "high" },
  cleanliness: { icon: Sparkles, label: "Cleanliness", defaultPriority: "medium" },
  security: { icon: Shield, label: "Security", defaultPriority: "urgent" },
  parking: { icon: Car, label: "Parking", defaultPriority: "medium" },
};

export const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700 font-bold",
  urgent: "bg-red-100 text-red-700 font-black",
};

export const priorityLabels: Record<string, string> = {
  low: "Standard",
  medium: "Medium",
  high: "High",
  urgent: "Critical",
};

export const statusConfig: Record<string, { label: string; color: string; step: number }> = {
  open: { label: "Open", color: "bg-red-50 text-red-600 border-red-200", step: 1 },
  in_progress: { label: "In Progress", color: "bg-amber-50 text-amber-600 border-amber-200", step: 2 },
  resolved: { label: "Resolved", color: "bg-emerald-50 text-emerald-600 border-emerald-200", step: 3 },
  closed: { label: "Closed", color: "bg-gray-50 text-gray-600 border-gray-200", step: 4 },
};

export const COMPLAINT_STEPS = [
  { key: "submitted", label: "Submitted" },
  { key: "working", label: "In Progress" },
  { key: "resolved", label: "Resolved" },
  { key: "rated", label: "Rated" },
] as const;

export function complaintStepIndex(status: string, hasRating: boolean): number {
  if (status === "closed" || hasRating) return 4;
  if (status === "resolved") return 3;
  if (status === "in_progress") return 2;
  return 1;
}
