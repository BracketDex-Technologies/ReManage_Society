"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  BookOpen,
  Briefcase,
  Building2,
  CalendarCheck,
  Car,
  ChevronDown,
  ClipboardList,
  CreditCard,
  FileText,
  FolderOpen,
  HandCoins,
  HardDrive,
  IndianRupee,
  Megaphone,
  MessageSquare,
  MoreHorizontal,
  Package,
  Phone,
  PiggyBank,
  Receipt,
  RefreshCw,
  Scale,
  Settings,
  Shield,
  ShoppingBag,
  TrendingUp,
  User,
  UserCheck,
  UserPlus,
  Users,
  Vote,
  Wallet,
  Wrench,
} from "lucide-react";
import { useLiveData } from "@/lib/use-live-data";
import { LIVE_FAST_INTERVAL_MS, LIVE_STANDARD_INTERVAL_MS } from "@/lib/live-refresh";
import { useUser } from "@/lib/user-context";
import { formatCurrency } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import PersonaDashboardRouter from "@/components/ux/PersonaDashboardRouter";
import GuardDashboard from "./_personas/guard-dashboard";
import TreasurerDashboard from "./_personas/treasurer-dashboard";
import PlatformAdminDashboard from "./_personas/platform-admin-dashboard";
import { shapeCollectionTrend } from "./dashboard-trend";

interface DashboardData {
  totalCollected: number;
  pendingAmount: number;
  totalExpenses: number;
  totalMembers: number;
  paidCount: number;
  partialCount: number;
  pendingCount: number;
  totalFlats: number;
  period: string;
  financeScope?: string;
  financeYears?: string[];
  fundBalance: number;
  openComplaints: number;
  visitorsToday: number;
  activePolls: number;
  recentActivity?: Array<{
    id: string;
    flatNumber: string;
    ownerName: string;
    amount: number;
    status: string;
    paidVia?: string | null;
    paidAt?: string | null;
    updatedAt: string;
  }>;
}

interface AdminAnalyticsData {
  monthlyTrend: Array<{ period: string; label: string; collected: number; pending: number; expenses: number; collectionRate: number }>;
  expenseCategories: Array<{ category: string; amount: number }>;
  paymentMethods: Array<{ method: string; amount: number; count: number }>;
  aging: { current: number; days30: number; days60: number; days90Plus: number };
  topDefaulters: Array<{ flatNumber: string; ownerName: string; pending: number; billCount: number }>;
}

interface MyBillsData {
  stats: { totalPending: number; totalPaid: number };
}

interface ResidentBootstrapData {
  notices?: Array<{ id: string; title: string; category: string; createdAt: string }>;
  visitors?: Array<{ id: string; visitorName: string; purpose: string; status: string; expectedAt?: string | null; entryTime?: string | null; exitTime?: string | null }>;
  packages?: Array<{ id: string; courierName: string | null; status: string; receivedAt: string; collectedAt?: string | null }>;
  staff?: Array<{ id: string; name: string; category: string; phone: string; flatLinks?: Array<{ agreedMonthlyPay: number | null; schedule: string | null }> }>;
  forumThreads?: Array<{ id: string; title: string; author?: { name: string; role: string }; _count?: { replies: number } }>;
  events?: Array<{ id: string; title: string; venue: string | null; startDate: string; category: string }>;
  parkingSlots?: Array<{ id: string; slotNumber: string; slotType: string; level: string | null; wing: string | null; vehicleNo: string | null }>;
}

type Role = string;
type ModuleItem = {
  label: string;
  href: string;
  icon: typeof Shield;
  roles: Role[];
  note: string;
};
type Category = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: typeof Shield;
  color: string;
  shadow: string;
  modules: ModuleItem[];
};

const admin = ["chairman", "secretary", "treasurer"];
const resident = ["member", "tenant"];
const everyone = [...admin, ...resident];

const categories: Category[] = [
  {
    id: "operations",
    title: "Operations",
    subtitle: "Daily Services",
    description: "Gate, staff, parcels, and daily movement.",
    icon: Shield,
    color: "bg-[#FF5400]",
    shadow: "",
    modules: [
      { label: "Security Gate", href: "/visitors", icon: Shield, roles: [...admin, "guard", "watchman"], note: "Visitors and gate records" },
      { label: "My Visitors", href: "/my-visitors", icon: UserCheck, roles: resident, note: "Guests and approvals" },
      { label: "Staff & Daily Help", href: "/staff", icon: Briefcase, roles: everyone, note: "Daily help and attendance" },
      { label: "Parcel Desk", href: "/packages", icon: Package, roles: [...everyone, "guard", "watchman"], note: "Deliveries and pickups" },
    ],
  },
  {
    id: "finance",
    title: "Finance",
    subtitle: "Payments & Funds",
    description: "Bills, expenses, funds, payroll, and reports.",
    icon: IndianRupee,
    color: "bg-[#FFBE00] text-[#333333]",
    shadow: "",
    modules: [
      { label: "Billing & Ledger", href: "/maintenance", icon: Receipt, roles: admin, note: "Raise and collect dues" },
      { label: "My Bills", href: "/my-bills", icon: CreditCard, roles: resident, note: "Dues, rent, staff payments" },
      { label: "Expenses", href: "/expenses", icon: Wallet, roles: ["chairman", "treasurer"], note: "Society spending" },
      { label: "Fund Accounts", href: "/funds", icon: PiggyBank, roles: ["chairman", "treasurer"], note: "Reserve and corpus" },
      { label: "Budget Planning", href: "/budgets", icon: TrendingUp, roles: ["chairman", "treasurer"], note: "Plan vs actuals" },
      { label: "Staff Payroll", href: "/salaries", icon: HandCoins, roles: ["chairman", "treasurer"], note: "Society staff salary" },
      { label: "Reports", href: "/reports", icon: FileText, roles: admin, note: "Financial summaries" },
    ],
  },
  {
    id: "legal",
    title: "Free Legal Advice",
    subtitle: "Legal Help",
    description: "Free legal guidance, adviser contact, and society compliance notes.",
    icon: Scale,
    color: "bg-[#333333]",
    shadow: "",
    modules: [
      { label: "Legal Adviser Contact", href: "/settings", icon: Scale, roles: admin, note: "Advisor phone and profile" },
      { label: "Legal Documents", href: "/documents", icon: FolderOpen, roles: admin, note: "Bylaws and legal records" },
      { label: "Committee Guidance", href: "/meetings", icon: FileText, roles: admin, note: "AGM, notices, and resolutions" },
    ],
  },
  {
    id: "community",
    title: "Community",
    subtitle: "People & Shared Life",
    description: "Announcements, helpdesk, amenities, parking, and safety.",
    icon: Megaphone,
    color: "bg-[#FF5400]",
    shadow: "",
    modules: [
      { label: "Announcements", href: "/notices", icon: Megaphone, roles: everyone, note: "Society updates" },
      { label: "Helpdesk", href: "/complaints", icon: AlertTriangle, roles: everyone, note: "Complaints and requests" },
      { label: "Resident Directory", href: "/directory", icon: BookOpen, roles: everyone, note: "Find residents" },
      { label: "Discussion Forum", href: "/forum", icon: MessageSquare, roles: everyone, note: "Neighbourhood discussions" },
      { label: "Events & Calendar", href: "/events", icon: CalendarCheck, roles: everyone, note: "Society events" },
      { label: "Amenity Management", href: "/amenities", icon: Building2, roles: admin, note: "Configure amenities and view bookings" },
      { label: "Amenity Booking", href: "/amenities", icon: Building2, roles: resident, note: "Book shared spaces" },
      { label: "Buy & Sell", href: "/marketplace", icon: ShoppingBag, roles: resident, note: "Resident marketplace" },
      { label: "Parking", href: "/parking", icon: Car, roles: [...admin, ...resident], note: "Slots and vehicles" },
      { label: "SOS & Safety", href: "/emergency", icon: Phone, roles: everyone, note: "Emergency help" },
    ],
  },
  {
    id: "governance",
    title: "Governance",
    subtitle: "Decisions & Records",
    description: "Meetings, voting, and documents.",
    icon: Vote,
    color: "bg-[#FFBE00] text-[#333333]",
    shadow: "",
    modules: [
      { label: "Meetings", href: "/meetings", icon: FileText, roles: everyone, note: "Agenda and minutes" },
      { label: "Polls & Voting", href: "/polls", icon: Vote, roles: everyone, note: "Residents vote; committee publishes polls" },
      { label: "Document Vault", href: "/documents", icon: FolderOpen, roles: everyone, note: "Society records" },
    ],
  },
  {
    id: "management",
    title: "Management",
    subtitle: "Setup & Control",
    description: "Residents, tenants, vendors, assets, audit, and settings.",
    icon: Settings,
    color: "bg-[#333333]",
    shadow: "",
    modules: [
      { label: "Residents", href: "/members", icon: Users, roles: admin, note: "Owners and members" },
      { label: "Tenants", href: "/tenants", icon: UserPlus, roles: admin, note: "Tenant lifecycle" },
      { label: "Move In / Out", href: "/move-events", icon: ClipboardList, roles: admin, note: "Occupancy changes" },
      { label: "Vendor Hub", href: "/vendors", icon: Wrench, roles: admin, note: "Vendors and AMCs" },
      { label: "Asset Register", href: "/assets", icon: HardDrive, roles: admin, note: "Society assets" },
      { label: "Audit Trail", href: "/activity-log", icon: FileText, roles: admin, note: "Action history" },
      { label: "Settings", href: "/settings", icon: Settings, roles: ["chairman", "secretary"], note: "Society setup" },
    ],
  },
];

const roleLabels: Record<string, string> = {
  chairman: "Chairman",
  secretary: "Secretary",
  treasurer: "Treasurer",
  member: "Flat Member",
  tenant: "Tenant",
};

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function CategoryCard({ category, expanded, count, onClick }: { category: Category; expanded: boolean; count: number; onClick: () => void }) {
  const Icon = category.icon;
  const { t } = useI18n();
  return (
    <motion.button
      layout
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      className={`relative flex h-[176px] w-full overflow-hidden rounded-2xl ${category.color} p-4 text-left text-white transition-all duration-300 ${
        expanded
          ? `shadow-lg ${category.shadow} ring-2 ring-white/70`
          : "shadow-sm opacity-95 hover:opacity-100"
      }`}
    >
      <div className="relative z-10 flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/75">{t(category.subtitle)}</p>
            <h2 className="mt-1.5 text-2xl font-black tracking-tight">{t(category.title)}</h2>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div>
          <p className="line-clamp-2 max-w-md text-sm leading-5 text-white/85">{t(category.description)}</p>
          <div className="mt-3 flex items-center justify-between">
            <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold">{count} {t("modules")}</span>
            <span className="flex items-center gap-1 text-xs font-black">
              {expanded ? t("Hide") : t("Open")} <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </span>
          </div>
        </div>
      </div>
      <Icon className="absolute -bottom-10 -right-8 h-40 w-40 text-white/10" />
    </motion.button>
  );
}

function ModuleCard({ module }: { module: ModuleItem }) {
  const Icon = module.icon;
  const { t } = useI18n();
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
      <Link href={module.href} className="group flex min-h-[104px] flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_4px_rgba(15,23,42,0.06)] transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)] dark:border-[#404040] dark:bg-[#222222] dark:shadow-black/20 dark:hover:border-primary/40">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/7 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
            <Icon className="h-4 w-4" />
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-black text-slate-950 dark:text-[#F5F5F5]">{t(module.label)}</h3>
          <p className="mt-1 line-clamp-1 text-xs font-medium text-slate-500">{t(module.note)}</p>
        </div>
      </Link>
    </motion.div>
  );
}

function CategoryWorkspace({ category, isAdmin }: { category: Category; isAdmin: boolean }) {
  const { t } = useI18n();
  const quickActions = {
    operations: [
      { label: isAdmin ? "Gate Activity" : "Approve Visitors", href: isAdmin ? "/visitors" : "/my-visitors", icon: Shield },
      { label: "Parcel Desk", href: "/packages", icon: Package },
      { label: "Emergency Contacts", href: "/emergency", icon: Phone },
    ],
    finance: [
      { label: isAdmin ? "Raise Invoice" : "Pay Dues", href: isAdmin ? "/maintenance" : "/my-bills", icon: Receipt },
      { label: "Record Expense", href: "/expenses", icon: Wallet },
      { label: "View Collections", href: "/reports", icon: TrendingUp },
    ],
    community: [
      { label: "Create Notice", href: "/notices", icon: Megaphone },
      { label: "Open Complaints", href: "/complaints", icon: AlertTriangle },
      { label: "Upcoming Events", href: "/events", icon: CalendarCheck },
    ],
    legal: [
      { label: "Update Adviser", href: "/settings", icon: Scale },
      { label: "Open Documents", href: "/documents", icon: FolderOpen },
      { label: "Meeting Records", href: "/meetings", icon: FileText },
    ],
    governance: [
      { label: "New Poll", href: "/polls", icon: Vote },
      { label: "Meeting Records", href: "/meetings", icon: FileText },
      { label: "Documents", href: "/documents", icon: FolderOpen },
    ],
    management: [
      { label: "Residents", href: "/members", icon: Users },
      { label: "Tenants", href: "/tenants", icon: UserPlus },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  }[category.id] || [];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8, height: 0 }}
      animate={{ opacity: 1, y: 0, height: "auto" }}
      exit={{ opacity: 0, y: -8, height: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden rounded-b-2xl"
    >
      <div className="relative rounded-[1.75rem] border border-white/80 bg-white/95 p-5 shadow-md shadow-slate-900/5 backdrop-blur dark:border-[#404040] dark:bg-[#222222]/95 dark:shadow-black/20 sm:p-6">
        <div className={`absolute left-8 top-0 h-1.5 w-24 rounded-b-full ${category.color}`} />
        <div className="absolute -top-3 left-10 h-3 w-10 rounded-t-xl bg-white/95 dark:bg-[#222222]/95" />

        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">{t("Workspace")}</p>
            <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-[#F5F5F5]">{t(category.title)}</h2>
            <p className="mt-1 text-xs font-medium text-slate-500">{t(category.description)}</p>
          </div>
          <span className="hidden rounded-full bg-slate-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-800 dark:text-slate-300 sm:inline">
            {t("No crowded menus")}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {category.modules.map((module) => <ModuleCard key={module.href} module={module} />)}
        </div>

        {quickActions.length > 0 && (
          <div className="mt-5">
            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-500">{t("Quick Actions")}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="flex min-h-[72px] flex-col justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-950 shadow-[0_1px_4px_rgba(15,23,42,0.05)] transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:text-primary hover:shadow-[0_8px_20px_rgba(15,23,42,0.07)] dark:border-[#404040] dark:bg-[#222222] dark:text-[#F5F5F5] dark:shadow-black/20 dark:hover:border-primary/40"
                  >
                    <Icon className="h-4 w-4 text-primary" />
                    <span>{t(action.label)}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-[#404040] dark:bg-[#404040]/40">
          <BellRing className="h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-xs font-black text-slate-950 dark:text-[#F5F5F5]">{t("Recent activity")}</p>
            <p className="mt-0.5 text-xs font-medium text-slate-500">{t("Latest updates from this area appear in notifications and module pages.")}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function formatShortDate(date: string | null | undefined, language: string) {
  if (!date) return "";
  const locale = language === "hi" ? "hi-IN" : language === "mr" ? "mr-IN" : "en-IN";
  return new Date(date).toLocaleDateString(locale, { day: "numeric", month: "short" });
}

function formatShortTime(date: string | null | undefined, language: string) {
  if (!date) return "";
  const locale = language === "hi" ? "hi-IN" : language === "mr" ? "mr-IN" : "en-IN";
  return new Date(date).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

function PriorityCard({
  href,
  label,
  value,
  icon: Icon,
  gradient,
  reverse = false,
}: {
  href: string;
  label: string;
  value: string;
  icon: typeof Shield;
  gradient: string;
  reverse?: boolean;
}) {
  return (
    <Link href={href} className="group block">
      <div className={`relative flex min-h-[112px] items-center overflow-hidden border border-white/40 bg-gradient-to-br ${gradient} p-4 shadow-sm transition-transform duration-300 hover:-translate-y-1 ${reverse ? "rounded-[2rem_1.5rem_2rem_1.5rem]" : "rounded-[1.5rem_2rem_1.5rem_2rem]"}`}>
        <Icon className="absolute -bottom-3 -right-3 h-20 w-20 text-white opacity-[0.08] transition-transform duration-500 group-hover:-rotate-12 group-hover:scale-110" />
        <div className="relative z-10 flex w-full items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/30 bg-white/20 shadow-sm backdrop-blur-md">
            <Icon className="h-6 w-6 text-white" />
          </div>
          <div className="h-10 w-px shrink-0 bg-white/20" />
          <div className="min-w-0 flex-1">
            <h3 className="mb-1 truncate border-b border-white/20 pb-1 text-base font-black leading-tight text-white">{label}</h3>
            <p className="truncate text-xs font-semibold text-white/85">{value}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}

function EmptyMiniState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs font-bold text-text-secondary dark:border-[#404040] dark:bg-[#404040]/40">
      {text}
    </div>
  );
}

function DashboardAccentIllustration({ type }: { type: "bill" | "visitor" | "parcel" | "safety" | "community" }) {
  return (
    <svg className="h-16 w-20 opacity-85 transition-transform duration-500 group-hover:-translate-y-1 group-hover:rotate-2" viewBox="0 0 120 96" fill="none" aria-hidden="true">
      <rect x="16" y="20" width="72" height="58" rx="18" fill="currentColor" opacity="0.1" />
      <rect x="34" y="12" width="54" height="64" rx="14" fill="currentColor" opacity="0.08" stroke="currentColor" strokeOpacity="0.34" strokeWidth="4" />
      <path d="M45 30H76M45 44H69M45 58H74" stroke="currentColor" strokeOpacity="0.72" strokeWidth="5" strokeLinecap="round" />
      <circle cx="88" cy="64" r="18" fill="currentColor" opacity="0.16" />
      <path d={type === "visitor" ? "M84 64C84 58 92 58 92 64M82 70C86 75 94 75 98 70" : type === "parcel" ? "M80 59L88 54L96 59V69L88 74L80 69V59Z" : type === "safety" ? "M88 53L99 58V66C99 73 94 78 88 80C82 78 77 73 77 66V58L88 53Z" : "M88 54V74M80 64H96"} stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PremiumStatCard({
  href,
  title,
  value,
  note,
  icon: Icon,
  illustration,
  variant,
}: {
  href: string;
  title: string;
  value: string;
  note: string;
  icon: typeof Shield;
  illustration: "bill" | "visitor" | "parcel" | "safety" | "community";
  variant: "finance" | "visitor" | "parcel" | "helpdesk";
}) {
  const palette = {
    finance: {
      card: "border-[#E6E6E6] bg-[#FFFFFF] hover:border-[#FF9966] hover:bg-[#FFEEE5] dark:border-[#404040] dark:bg-[#222222] dark:hover:border-[#CC4400] dark:hover:bg-[#241A12]",
      chip: "bg-[#FFEEE5] text-[#C2410C] dark:bg-[#662200]/45 dark:text-[#FF9966]",
      action: "bg-[#FF5400] text-white",
      wash: "bg-[#FF5400]/10",
      illustration: "text-[#FF5400] dark:text-[#FF9966]",
    },
    visitor: {
      card: "border-[#BFDBFE] bg-[#EFF6FF] hover:border-[#93C5FD] hover:bg-[#DBEAFE] dark:border-[#404040] dark:bg-[#222222] dark:hover:border-[#31558C] dark:hover:bg-[#141B25]",
      chip: "bg-[#DBEAFE] text-[#2563EB] dark:bg-[#1E3A8A]/42 dark:text-[#93C5FD]",
      action: "bg-[#2563EB] text-white",
      wash: "bg-[#2563EB]/10",
      illustration: "text-[#2563EB] dark:text-[#93C5FD]",
    },
    parcel: {
      card: "border-[#FFCC33] bg-[#FFF9E5] hover:border-[#FFBE00] hover:bg-[#FFE699] dark:border-[#404040] dark:bg-[#222222] dark:hover:border-[#8A6A19] dark:hover:bg-[#24200E]",
      chip: "bg-[#FFF2CC] text-[#A16207] dark:bg-[#664D00]/42 dark:text-[#FFCC33]",
      action: "bg-[#CA8A04] text-white",
      wash: "bg-[#FFBE00]/12",
      illustration: "text-[#CA8A04] dark:text-[#FFCC33]",
    },
    helpdesk: {
      card: "border-[#FECACA] bg-[#FEF2F2] hover:border-[#FCA5A5] hover:bg-[#FEE2E2] dark:border-[#404040] dark:bg-[#222222] dark:hover:border-[#7A3434] dark:hover:bg-[#271616]",
      chip: "bg-[#FEE2E2] text-[#DC2626] dark:bg-[#7F1D1D]/42 dark:text-[#FCA5A5]",
      action: "bg-[#DC2626] text-white",
      wash: "bg-[#EF4444]/10",
      illustration: "text-[#DC2626] dark:text-[#FCA5A5]",
    },
  }[variant];

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <Link href={href} className={`group relative grid min-h-[124px] grid-cols-[minmax(0,1fr)_4.5rem] overflow-hidden rounded-[1.35rem] border p-3.5 shadow-[0_10px_34px_-28px_rgba(28,25,23,0.48)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_44px_-34px_rgba(28,25,23,0.58)] ${palette.card}`}>
        <div className={`absolute -right-10 -top-12 h-28 w-28 rounded-full ${palette.wash} blur-2xl transition-opacity group-hover:opacity-90`} />
        <div className="relative z-10 flex min-w-0 flex-col justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${palette.chip} ring-1 ring-inset ring-white/40 dark:ring-white/10`}>
              <Icon className="h-5 w-5" />
            </div>
            <p className="truncate text-sm font-bold text-[#333333] dark:text-[#F5F5F5]">{title}</p>
          </div>
          <div className="mt-3 min-w-0">
            <h3 className="truncate text-2xl font-bold tracking-tight text-[#333333] dark:text-[#F5F5F5]">{value}</h3>
            <p className="mt-0.5 line-clamp-1 text-xs font-semibold text-[#333333]/60 dark:text-[#CCCCCC]/82">{note}</p>
          </div>
        </div>
        <div className="relative z-10 flex flex-col items-end justify-between">
          <span className={`flex h-9 w-9 items-center justify-center rounded-full ${palette.action} shadow-sm transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5`}>
            <ArrowRight className="h-4 w-4" />
          </span>
          <div className={`opacity-50 transition-opacity group-hover:opacity-75 ${palette.illustration}`}>
            <DashboardAccentIllustration type={illustration} />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function PremiumModuleTile({
  href,
  label,
  note,
  icon: Icon,
  accent,
  hover,
  wide = false,
}: {
  href: string;
  label: string;
  note: string;
  icon: typeof Shield;
  accent: string;
  hover: string;
  wide?: boolean;
}) {
  return (
    <Link href={href} className={`group relative min-h-[112px] overflow-hidden rounded-[1.25rem] border border-[#E6E6E6] bg-white p-3 shadow-[0_8px_28px_-24px_rgba(28,25,23,0.42)] transition-all duration-300 hover:-translate-y-0.5 dark:border-[#404040] dark:bg-[#222222] ${hover} ${wide ? "md:col-span-2" : ""}`}>
      <div className="relative z-10 flex h-full flex-col justify-between">
        <div className="flex items-center justify-between">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent} ring-1 ring-inset ring-[#333333]/5 transition-transform duration-300 group-hover:scale-105 dark:ring-white/10`}>
            <Icon className="h-5 w-5" />
          </div>
          <ArrowRight className="h-4 w-4 text-[#333333]/40 transition-transform group-hover:translate-x-1 dark:text-[#CCCCCC]/70" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-[#333333] dark:text-[#F5F5F5]">{label}</h3>
          <p className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-4 text-[#333333]/[0.55] dark:text-[#CCCCCC]">{note}</p>
        </div>
      </div>
    </Link>
  );
}

function DashboardLoadingShell() {
  return (
    <div className="dashboard-flat-theme -m-3 min-h-full overflow-hidden bg-[#FEFDDF] p-2 text-[#333333] dark:bg-[#171717] dark:text-[#F5F5F5] sm:-m-4 sm:p-3 lg:-m-6 lg:p-4 xl:p-5">
      <div className="pointer-events-none fixed inset-0 opacity-80 dark:opacity-45">
        <div className="absolute left-[18%] top-[-12rem] h-[30rem] w-[30rem] rounded-full bg-[#FFBE00]/25 blur-3xl" />
        <div className="absolute right-[8%] top-[7rem] h-[24rem] w-[24rem] rounded-full bg-[#808080]/[0.18] blur-3xl" />
        <div className="absolute bottom-[-12rem] right-[28%] h-[26rem] w-[26rem] rounded-full bg-[#FF5400]/[0.16] blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-[1560px] pb-20 lg:pb-4">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
          <div className="dashboard-panel relative min-h-[260px] overflow-hidden rounded-[1.5rem] border border-[#E6E6E6] bg-white p-4 dark:border-[#404040] dark:bg-[#222222] xl:col-span-8">
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.95),rgba(255,255,255,0.72),rgba(245,245,247,0.28))] dark:bg-[linear-gradient(90deg,rgba(22,15,18,0.95),rgba(22,15,18,0.78),rgba(44,26,26,0.5))]" />
            <div className="relative z-10 flex h-full flex-col justify-center gap-3">
              <div className="h-9 w-44 animate-pulse rounded-full bg-[#FF5400]/10 dark:bg-[#404040]/55" />
              <div className="h-12 w-full max-w-[720px] animate-pulse rounded-2xl bg-[#E6E6E6]/60 dark:bg-[#404040]/55" />
              <div className="h-6 w-full max-w-[520px] animate-pulse rounded-full bg-[#E6E6E6]/60 dark:bg-[#404040]/55" />
              <div className="flex gap-3">
                <div className="h-12 w-32 animate-pulse rounded-2xl bg-[#FF5400]/18" />
                <div className="h-12 w-40 animate-pulse rounded-2xl bg-[#E6E6E6]/60 dark:bg-[#404040]/55" />
                <div className="h-12 w-36 animate-pulse rounded-2xl bg-[#808080]/12" />
              </div>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:col-span-4 xl:grid-cols-1">
            <div className="dashboard-panel min-h-[160px] animate-pulse rounded-[1.5rem] bg-white dark:bg-[#222222]" />
            <div className="dashboard-panel min-h-[108px] animate-pulse rounded-[1.5rem] bg-white dark:bg-[#222222]" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="dashboard-panel min-h-[132px] animate-pulse rounded-[1.35rem] bg-white dark:bg-[#222222]" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
          <div className="dashboard-panel min-h-[340px] animate-pulse rounded-[1.5rem] bg-white dark:bg-[#222222] xl:col-span-8" />
          <div className="dashboard-panel min-h-[340px] animate-pulse rounded-[1.5rem] bg-white dark:bg-[#222222] xl:col-span-4" />
        </div>
      </div>
    </div>
  );
}

function ResidentDashboard({
  user,
  data,
  myBills,
  bootstrap,
}: {
  user: ReturnType<typeof useUser>["user"];
  data: DashboardData | null;
  myBills: MyBillsData | null;
  bootstrap: ResidentBootstrapData | null;
}) {
  const { language, t } = useI18n();
  const notices = bootstrap?.notices || [];
  const visitors = bootstrap?.visitors || [];
  const packages = bootstrap?.packages || [];
  const openComplaints = data?.openComplaints || 0;
  const pendingDues = myBills?.stats?.totalPending || 0;
  const visitorsToday = data?.visitorsToday || 0;
  const unreadNotices = notices.length;

  return (
    <>
      {/* Mobile view: hidden on lg screens, visible on mobile/tablet */}
      <div className="dashboard-flat-theme block w-full space-y-4 pb-16 text-[#333333] dark:text-[#F5F5F5] lg:hidden">
        {/* SECTION 1 - Top Header (directly on cream/dark, clean typography) */}
        <div className="px-1 pt-4 pb-2">
          <p className="text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase tracking-[0.14em]">
            {t(greeting().charAt(0).toUpperCase() + greeting().slice(1))} <span className="text-base">👋</span>
          </p>
          <h1 className="text-2xl font-black text-gray-900 dark:text-[#F5F5F5] mt-1 leading-tight">
            {user?.name || t("Resident")}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-xs font-semibold mt-1">
            {user?.societyName || t("Your society")} · {user?.flatNumber || ""}
          </p>
        </div>

        {/* SECTION 2 - Outstanding Balance Card */}
        <div className="dashboard-accent-primary flex items-center justify-between rounded-2xl px-5 py-4 text-white">
          <div>
            <p className="text-white/80 text-[10px] font-bold uppercase tracking-wider mb-0.5">{t("Total Outstanding")}</p>
            <h2 className="text-2xl font-black tracking-tight">₹ {formatCurrency(pendingDues).replace("₹", "").trim()}</h2>
          </div>
          <Link href="/my-bills" className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-[#FF5400] transition-colors hover:bg-[#FFEEE5]">
            {t("Pay Now")}
          </Link>
        </div>

        {/* SECTION 3 - Stats Row */}
        <div className="dashboard-panel flex items-center justify-between rounded-2xl border border-[#E6E6E6] bg-white px-2 py-4 dark:border-[#404040] dark:bg-[#222222]">
          <Link href="/notices" className="flex-1 flex flex-col items-center">
            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">{t("Notices")}</span>
            <span className="text-xl font-extrabold text-[#FF5400] dark:text-[#FF7733] leading-none">{String(unreadNotices).padStart(2, "0")}</span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 font-medium">{t("Unread")}</span>
          </Link>
          <div className="w-px h-10 bg-gray-100 dark:bg-[#404040]"></div>
          <Link href="/complaints" className="flex-1 flex flex-col items-center">
            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">{t("Complaints")}</span>
            <span className="text-xl font-extrabold text-gray-900 dark:text-[#F5F5F5] leading-none">{String(openComplaints).padStart(2, "0")}</span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 font-medium">{t("Open (Stats)")}</span>
          </Link>
          <div className="w-px h-10 bg-gray-100 dark:bg-[#404040]"></div>
          <Link href="/my-visitors" className="flex-1 flex flex-col items-center">
            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">{t("Visitors")}</span>
            <span className="text-xl font-extrabold text-[#2563EB] dark:text-[#60A5FA] leading-none">{String(visitorsToday).padStart(2, "0")}</span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 font-medium">{t("Today")}</span>
          </Link>
        </div>

        {/* SECTION 4 - Quick Access Grid (wrapped in card) */}
        <div className="dashboard-panel rounded-2xl border border-[#E6E6E6] bg-white p-4 dark:border-[#404040] dark:bg-[#222222]">
          <h3 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider mb-4 px-1">{t("Quick Access")}</h3>
          <div className="grid grid-cols-4 gap-y-5 gap-x-2">
            {/* Row 1 */}
            <Link href="/my-bills" className="flex flex-col items-center gap-1.5">
              <div className="w-11 h-11 rounded-[12px] bg-[#FFFFFF] dark:bg-[#662200]/30 flex items-center justify-center border border-orange-50 dark:border-[#662200]/40">
                <Receipt className="w-5 h-5 text-[#FF5400] dark:text-[#FF7733]" strokeWidth={2} />
              </div>
              <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{t("My Bills")}</span>
            </Link>
            <Link href="/complaints" className="flex flex-col items-center gap-1.5">
              <div className="w-11 h-11 rounded-[12px] bg-[#FFF2CC] dark:bg-[#664D00]/30 flex items-center justify-center border border-yellow-50 dark:border-[#664D00]/40">
                <AlertTriangle className="w-5 h-5 text-[#D97706] dark:text-[#FFBE00]" strokeWidth={2} />
              </div>
              <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{t("Complaints")}</span>
            </Link>
            <Link href="/my-visitors" className="flex flex-col items-center gap-1.5">
              <div className="w-11 h-11 rounded-[12px] bg-[#EFF6FF] dark:bg-[#1E3A8A]/30 flex items-center justify-center border border-blue-50 dark:border-[#1E3A8A]/40">
                <UserCheck className="w-5 h-5 text-[#2563EB] dark:text-[#60A5FA]" strokeWidth={2} />
              </div>
              <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{t("Visitors")}</span>
            </Link>
            <Link href="/notices" className="flex flex-col items-center gap-1.5">
              <div className="w-11 h-11 rounded-[12px] bg-[#FFFFFF] dark:bg-[#662200]/30 flex items-center justify-center border border-orange-50 dark:border-[#662200]/40">
                <Megaphone className="w-5 h-5 text-[#FF5400] dark:text-[#FF7733]" strokeWidth={2} />
              </div>
              <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{t("Notices")}</span>
            </Link>

            {/* Row 2 */}
            <Link href="/amenities" className="flex flex-col items-center gap-1.5">
              <div className="w-11 h-11 rounded-[12px] bg-[#F5F3FF] dark:bg-[#4C1D95]/30 flex items-center justify-center border border-purple-50 dark:border-[#4C1D95]/40">
                <Building2 className="w-5 h-5 text-[#8B5CF6] dark:text-[#A78BFA]" strokeWidth={2} />
              </div>
              <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{t("Amenities")}</span>
            </Link>
            <Link href="/packages" className="flex flex-col items-center gap-1.5">
              <div className="w-11 h-11 rounded-[12px] bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 flex items-center justify-center border border-red-50 dark:border-[#7F1D1D]/40">
                <Package className="w-5 h-5 text-[#EF4444] dark:text-[#F87171]" strokeWidth={2} />
              </div>
              <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{t("Packages")}</span>
            </Link>
            <Link href="/events" className="flex flex-col items-center gap-1.5">
              <div className="w-11 h-11 rounded-[12px] bg-[#F5F3FF] dark:bg-[#4C1D95]/30 flex items-center justify-center border border-purple-50 dark:border-[#4C1D95]/40">
                <CalendarCheck className="w-5 h-5 text-[#8B5CF6] dark:text-[#A78BFA]" strokeWidth={2} />
              </div>
              <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{t("Events")}</span>
            </Link>
            <Link href="/services" className="flex flex-col items-center gap-1.5">
              <div className="w-11 h-11 rounded-[12px] bg-[#F3F4F6] dark:bg-[#374151]/40 flex items-center justify-center border border-gray-100 dark:border-[#374151]/60">
                <MoreHorizontal className="w-5 h-5 text-[#6B7280] dark:text-[#9CA3AF]" strokeWidth={2} />
              </div>
              <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">{t("More")}</span>
            </Link>
          </div>
        </div>

        {/* SECTION 5 - Go Digital Go Green Banner */}
        <div className="dashboard-subpanel relative flex items-center justify-between overflow-hidden rounded-2xl border border-[#E6E6E6] bg-[#FFF9E5] p-4 dark:border-[#404040] dark:bg-[#2A2A2A]">
          <div className="relative z-10 flex-1 pr-3">
            <h3 className="text-[#92400E] dark:text-[#FF9966] font-bold text-sm leading-tight mb-1">{t("Go Digital. Go Green.")}</h3>
            <p className="text-[#92400E]/70 dark:text-[#FF9966]/60 text-[10px] font-semibold leading-relaxed">
              {t("Get e-receipts &")}<br/>{t("secure payments.")}
            </p>
          </div>
          {/* Phone illustration */}
          <div className="relative z-10 flex-shrink-0">
            <div className="relative w-12 h-16 bg-white dark:bg-[#222222] rounded-xl border border-[#E6E6E6] dark:border-[#404040] shadow-sm flex flex-col items-center overflow-hidden">
              <div className="w-4 h-0.5 bg-[#E6E6E6] dark:bg-[#404040] rounded-b-full"></div>
              <div className="flex-1 flex flex-col items-center justify-center gap-1">
                <div className="w-6 h-6 rounded-full bg-[#D1FAE5] dark:bg-[#064E3B]/50 flex items-center justify-center">
                  <span className="text-[#059669] dark:text-[#6EE7B7] text-[10px] font-bold">₹</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 6 - Consult an Advocate Banner */}
        <Link
          href="/complaints?escalate=legal"
          className="dashboard-subpanel relative flex items-start gap-3 overflow-hidden rounded-2xl border border-[#E6E6E6] bg-[#FFEEE5] p-4 transition-colors hover:border-[#FF5400] dark:border-[#404040] dark:bg-[#2A2A2A]"
        >
          <div className="relative z-10 flex-shrink-0 mt-0.5">
            <Scale className="w-5 h-5 text-red-600 dark:text-red-400" strokeWidth={2.5} />
          </div>
          <div className="relative z-10 flex-1">
            <h3 className="text-red-800 dark:text-red-300 font-bold text-xs uppercase tracking-wider mb-1 flex items-center gap-2">
              {t("Consult an Advocate")}
              <ArrowRight className="w-3.5 h-3.5" />
            </h3>
            <p className="text-red-700/80 dark:text-red-400/80 text-[10px] font-semibold leading-relaxed">
              {t("Take your complaints to a legal case if not solved. Defaulters and rulebreakers will face legal action.")}
            </p>
          </div>
        </Link>
      </div>

      {/* Desktop view: visible on lg screens, hidden on mobile/tablet */}
      <div className="dashboard-flat-theme hidden -m-3 min-h-full overflow-x-hidden bg-[#FEFDDF] p-3 text-[#333333] dark:bg-[#171717] dark:text-[#F5F5F5] sm:-m-4 sm:p-4 lg:block lg:-m-6 lg:p-6">
        <div className="relative mx-auto max-w-[1520px] space-y-3 pb-20 lg:pb-4">
          
          {/* SECTION 1: Welcome Header Card */}
          <div className="relative overflow-hidden rounded-[1.5rem] border border-[#E6E6E6] dark:border-[#404040] bg-white/90 dark:bg-[#222222]/90 p-6 shadow-[0_18px_58px_-50px_rgba(28,25,23,0.68)]">
            <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#FF5400]/10 blur-3xl" />
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <span className="inline-flex min-h-7 items-center rounded-full border border-[#FF5400]/20 bg-[#FF5400]/10 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#FF5400] dark:text-[#FF7733]">
                  {t("Resident Hub")}
                </span>
                <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-[#F5F5F5] mt-2">
                  {t(greeting().charAt(0).toUpperCase() + greeting().slice(1))}, {user?.name || t("Resident")} 👋
                </h1>
                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mt-1">
                  {user?.societyName || t("Your society")} · {user?.flatNumber || ""}
                </p>
              </div>
            </div>
          </div>

          {/* MAIN GRID */}
          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
            
            {/* LEFT COLUMN: Main Resident Actions (col-span-8) */}
            <div className="xl:col-span-8 space-y-4">
              
              {/* Outstanding Dues and Quick Stats Side-by-Side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Outstanding Dues Card */}
                <div className="bg-[#FF5400] rounded-[1.5rem] p-6 shadow-[0_12px_30px_rgba(249,115,22,0.25)] text-white flex flex-col justify-between min-h-[160px]">
                  <div>
                    <p className="text-white/80 text-[11px] font-bold uppercase tracking-wider mb-1">{t("Outstanding Dues")}</p>
                    <h2 className="text-3xl font-black tracking-tight">₹ {formatCurrency(pendingDues).replace("₹", "").trim()}</h2>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Link href="/my-bills" className="bg-white text-[#FF5400] font-bold text-xs px-5 py-2.5 rounded-xl shadow-md hover:bg-orange-50 transition-all hover:-translate-y-0.5">
                      {t("Pay Now")}
                    </Link>
                  </div>
                </div>

                {/* Quick Stats Summary */}
                <div className="bg-white dark:bg-[#222222] border border-[#E6E6E6] dark:border-[#404040] rounded-[1.5rem] p-5 shadow-[0_14px_48px_-40px_rgba(28,25,23,0.58)] flex flex-col justify-between">
                  <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-3 uppercase tracking-wider">{t("Activity Overview")}</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <Link href="/notices" className="flex flex-col items-center bg-[#FFFFFF] dark:bg-[#662200]/25 rounded-2xl p-3 border border-orange-100 dark:border-[#662200]/40 hover:border-orange-200 dark:hover:border-[#9A3412] transition-colors">
                      <span className="text-[11px] font-semibold text-[#C2410C] dark:text-[#FF9966]">{t("Notices")}</span>
                      <span className="text-2xl font-extrabold text-[#9A3412] dark:text-[#FF7733] mt-1">{String(unreadNotices).padStart(2, "0")}</span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 font-medium">{t("Unread")}</span>
                    </Link>
                    <Link href="/complaints" className="flex flex-col items-center bg-[#FFF2CC] dark:bg-[#664D00]/25 rounded-2xl p-3 border border-yellow-100 dark:border-[#664D00]/40 hover:border-yellow-200 dark:hover:border-[#92400E] transition-colors">
                      <span className="text-[11px] font-semibold text-[#B45309] dark:text-[#FFCC33]">{t("Complaints")}</span>
                      <span className="text-2xl font-extrabold text-[#92400E] dark:text-[#FFBE00] mt-1">{String(openComplaints).padStart(2, "0")}</span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 font-medium">{t("Open (Stats)")}</span>
                    </Link>
                    <Link href="/my-visitors" className="flex flex-col items-center bg-[#EFF6FF] dark:bg-[#1E3A8A]/25 rounded-2xl p-3 border border-blue-100 dark:border-[#1E3A8A]/40 hover:border-blue-200 dark:hover:border-[#2563EB] transition-colors">
                      <span className="text-[11px] font-semibold text-[#1D4ED8] dark:text-[#93C5FD]">{t("Visitors")}</span>
                      <span className="text-2xl font-extrabold text-[#1E40AF] dark:text-[#60A5FA] mt-1">{String(visitorsToday).padStart(2, "0")}</span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 font-medium">{t("Today")}</span>
                    </Link>
                  </div>
                </div>

              </div>

              {/* Quick Access Services Card */}
              <div className="rounded-[1.5rem] border border-[#E6E6E6] dark:border-[#404040] bg-white dark:bg-[#222222] p-5 shadow-[0_14px_48px_-40px_rgba(28,25,23,0.58)]">
                <h2 className="text-lg font-bold text-gray-900 dark:text-[#F5F5F5] mb-4">{t("Quick Access Services")}</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { href: "/my-bills", label: t("My Bills"), desc: t("Pay maintenance & utility dues"), icon: Receipt, bg: "bg-[#FFFFFF] dark:bg-[#662200]/30", text: "text-[#FF5400] dark:text-[#FF7733]", border: "border-orange-100 dark:border-[#662200]/40" },
                    { href: "/complaints", label: t("Complaints"), desc: t("Review & track issues"), icon: AlertTriangle, bg: "bg-[#FFF2CC] dark:bg-[#664D00]/30", text: "text-[#D97706] dark:text-[#FFBE00]", border: "border-yellow-100 dark:border-[#664D00]/40" },
                    { href: "/my-visitors", label: t("Visitors"), desc: t("Approve & invite guests"), icon: UserCheck, bg: "bg-[#EFF6FF] dark:bg-[#1E3A8A]/30", text: "text-[#2563EB] dark:text-[#60A5FA]", border: "border-blue-100 dark:border-[#1E3A8A]/40" },
                    { href: "/notices", label: t("Notices"), desc: t("Read society circulars"), icon: Megaphone, bg: "bg-[#FFFFFF] dark:bg-[#662200]/30", text: "text-[#FF5400] dark:text-[#FF7733]", border: "border-orange-100 dark:border-[#662200]/40" },
                    { href: "/amenities", label: t("Amenities"), desc: t("Book clubhouse, gym, pool"), icon: Building2, bg: "bg-[#F5F3FF] dark:bg-[#4C1D95]/30", text: "text-[#8B5CF6] dark:text-[#A78BFA]", border: "border-purple-100 dark:border-[#4C1D95]/40" },
                    { href: "/packages", label: t("Packages"), desc: t("Track courier deliveries"), icon: Package, bg: "bg-[#FEF2F2] dark:bg-[#7F1D1D]/30", text: "text-[#EF4444] dark:text-[#F87171]", border: "border-red-100 dark:border-[#7F1D1D]/40" },
                    { href: "/events", label: t("Events"), desc: t("Upcoming society programs"), icon: CalendarCheck, bg: "bg-[#F5F3FF] dark:bg-[#4C1D95]/30", text: "text-[#8B5CF6] dark:text-[#A78BFA]", border: "border-purple-100 dark:border-[#4C1D95]/40" },
                    { href: "/directory", label: t("Resident Directory"), desc: t("Find your neighbors"), icon: User, bg: "bg-[#F3F4F6] dark:bg-[#374151]/30", text: "text-[#6B7280] dark:text-[#9CA3AF]", border: "border-gray-100 dark:border-[#374151]/40" },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link key={item.href} href={item.href} className={`group flex flex-col p-4 rounded-[1.2rem] border ${item.border} bg-white dark:bg-[#222222] hover:bg-orange-50/20 dark:hover:bg-[#FF5400]/5 hover:border-[#FF9966] dark:hover:border-[#9A3412] transition-all hover:-translate-y-0.5`}>
                        <div className={`w-10 h-10 rounded-xl ${item.bg} ${item.text} flex items-center justify-center mb-3 group-hover:scale-105 transition-transform`}>
                          <Icon className="w-5 h-5" strokeWidth={2} />
                        </div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-[#F5F5F5]">{item.label}</h3>
                        <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mt-1 leading-snug">{item.desc}</p>
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Go Green Banner */}
              <div className="rounded-[1.5rem] border border-orange-100 dark:border-[#662200]/40 bg-[#FFFFFF] dark:bg-[#662200]/20 p-6 shadow-sm flex items-center justify-between relative overflow-hidden">
                <div className="absolute -right-12 -bottom-12 h-40 w-40 rounded-full bg-[#E6E6E6]/20 blur-2xl" />
                <div className="relative z-10 max-w-xl">
                  <h3 className="text-[#92400E] dark:text-[#FF9966] font-bold text-lg mb-1">{t("Go Digital. Go Green.")}</h3>
                  <p className="text-[#92400E]/80 dark:text-[#FF9966]/60 text-sm font-semibold leading-relaxed">
                    {t("Track maintenance bills, request visitor entries, and make secure instant payments online. Together let's save paper and build a modern digital society.")}
                  </p>
                </div>
                <div className="relative z-10 hidden md:block shrink-0 ml-4">
                  <div className="w-16 h-24 bg-white dark:bg-[#222222] rounded-2xl border-2 border-[#E6E6E6] dark:border-[#404040] shadow-md flex flex-col items-center overflow-hidden">
                    <div className="w-6 h-1 bg-[#E6E6E6] dark:bg-[#404040] rounded-b-full"></div>
                    <div className="flex-1 flex flex-col items-center justify-center gap-1.5">
                      <div className="w-8 h-8 rounded-full bg-[#D1FAE5] dark:bg-[#064E3B]/50 flex items-center justify-center shadow-inner">
                        <span className="text-[#059669] dark:text-[#6EE7B7] text-sm font-bold">₹</span>
                      </div>
                      <div className="w-8 h-1 bg-[#D1FAE5] dark:bg-[#064E3B]/50 rounded-full"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Consult an Advocate Banner */}
              <Link
                href="/complaints?escalate=legal"
                className="block rounded-[1.5rem] border border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 p-6 shadow-sm flex items-start gap-4 relative overflow-hidden hover:border-red-200 dark:hover:border-red-800 transition-colors"
              >
                <div className="relative z-10 flex-shrink-0 mt-1">
                  <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center">
                    <Scale className="w-5 h-5" strokeWidth={2.5} />
                  </div>
                </div>
                <div className="relative z-10 flex-1">
                  <h3 className="text-red-800 dark:text-red-300 font-bold text-sm uppercase tracking-wider mb-1 flex items-center gap-2">
                    {t("Consult an Advocate")}
                    <ArrowRight className="w-4 h-4" />
                  </h3>
                  <p className="text-red-700/80 dark:text-red-400/80 text-xs font-semibold leading-relaxed">
                    {t("Take your complaints to a legal case if not solved. Defaulters and rulebreakers will face legal action.")}
                  </p>
                </div>
              </Link>

            </div>

            {/* RIGHT COLUMN: Real-Time Sidebar Info (col-span-4) */}
            <div className="xl:col-span-4 space-y-4">
              
              {/* Recent Notices */}
              <div className="rounded-[1.5rem] border border-[#E6E6E6] dark:border-[#404040] bg-white dark:bg-[#222222] p-5 shadow-[0_14px_48px_-40px_rgba(28,25,23,0.58)]">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-base font-bold text-gray-900 dark:text-[#F5F5F5]">{t("Recent Notices")}</h2>
                  <Link href="/notices" className="text-xs font-bold text-[#FF5400] dark:text-[#FF7733] hover:underline">{t("View All")}</Link>
                </div>
                <div className="space-y-2.5">
                  {notices.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium py-3 text-center">{t("No notices published yet.")}</p>
                  ) : (
                    notices.slice(0, 3).map((notice) => (
                      <Link key={notice.id} href="/notices" className="block p-3 rounded-xl border border-gray-100 dark:border-[#404040] hover:border-[#FF9966] dark:hover:border-[#9A3412] hover:bg-[#FFFFFF] dark:hover:bg-[#662200]/15 transition-colors">
                        <span className="inline-block px-2 py-0.5 bg-[#FFFFFF] dark:bg-[#662200]/30 text-[#FF5400] dark:text-[#FF7733] text-[10px] font-bold rounded-md mb-1.5">
                          {notice.category}
                        </span>
                        <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200 line-clamp-1">{notice.title}</h4>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">{new Date(notice.createdAt).toLocaleDateString()}</p>
                      </Link>
                    ))
                  )}
                </div>
              </div>

              {/* Pending Packages */}
              <div className="rounded-[1.5rem] border border-[#E6E6E6] dark:border-[#404040] bg-white dark:bg-[#222222] p-5 shadow-[0_14px_48px_-40px_rgba(28,25,23,0.58)]">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-base font-bold text-gray-900 dark:text-[#F5F5F5]">{t("Gate Deliveries")}</h2>
                  <Link href="/packages" className="text-xs font-bold text-[#FF5400] dark:text-[#FF7733] hover:underline">{t("View All")}</Link>
                </div>
                <div className="space-y-2.5">
                  {packages.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium py-3 text-center">{t("No packages at gate.")}</p>
                  ) : (
                    packages.filter(p => p.status === "received").slice(0, 3).map((pkg) => (
                      <div key={pkg.id} className="flex justify-between items-center p-3 rounded-xl border border-gray-100 dark:border-[#404040] bg-gray-50 dark:bg-[#171717]">
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">{pkg.courierName || t("Courier")}</h4>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{t("Received at gate")}</p>
                        </div>
                        <span className="px-2.5 py-1 bg-[#D1FAE5] dark:bg-[#064E3B]/50 text-[#065F46] dark:text-[#6EE7B7] text-[10px] font-bold rounded-lg shrink-0">
                          {t("Waiting")}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Upcoming Events */}
              <div className="rounded-[1.5rem] border border-[#E6E6E6] dark:border-[#404040] bg-white dark:bg-[#222222] p-5 shadow-[0_14px_48px_-40px_rgba(28,25,23,0.58)]">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-base font-bold text-gray-900 dark:text-[#F5F5F5]">{t("Upcoming Events")}</h2>
                  <Link href="/events" className="text-xs font-bold text-[#FF5400] dark:text-[#FF7733] hover:underline">{t("View All")}</Link>
                </div>
                <div className="space-y-2.5">
                  {bootstrap?.events && bootstrap.events.length > 0 ? (
                    bootstrap.events.slice(0, 2).map((ev) => (
                      <div key={ev.id} className="p-3 rounded-xl border border-gray-100 dark:border-[#404040]">
                        <span className="inline-block px-2 py-0.5 bg-[#F5F3FF] dark:bg-[#4C1D95]/30 text-[#8B5CF6] dark:text-[#A78BFA] text-[10px] font-bold rounded-md mb-1.5">
                          {ev.category}
                        </span>
                        <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200 line-clamp-1">{ev.title}</h4>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">📍 {ev.venue || t("Society Premises")}</p>
                        <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5">{new Date(ev.startDate).toLocaleDateString()}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium py-3 text-center">{t("No upcoming events scheduled.")}</p>
                  )}
                </div>
              </div>

            </div>

          </div>

        </div>
      </div>
    </>
  );
}

function AdminMetricCard({
  href,
  label,
  value,
  note,
  icon: Icon,
  tone,
}: {
  href: string;
  label: string;
  value: string;
  note: string;
  icon: typeof Shield;
  tone: "orange" | "green" | "blue" | "red" | "yellow" | "purple";
}) {
  const styles = {
    orange: "border-[#FDBA74] bg-[#FFEEE0] hover:border-[#F97316] dark:border-[#9A4F18] dark:bg-[#322218] dark:hover:border-[#FF9966]",
    green: "border-[#4ADE80] bg-[#DCFCE7] hover:border-[#16A34A] dark:border-[#2F7958] dark:bg-[#172D22] dark:hover:border-[#6EE7B7]",
    blue: "border-[#60A5FA] bg-[#DBEAFE] hover:border-[#2563EB] dark:border-[#31558C] dark:bg-[#1B2A3D] dark:hover:border-[#93C5FD]",
    red: "border-[#FECACA] bg-[#FEF2F2] hover:border-[#FCA5A5] dark:border-[#404040] dark:bg-[#222222] dark:hover:border-[#7A3434]",
    yellow: "border-[#FFCC33] bg-[#FFF9E5] hover:border-[#FFBE00] dark:border-[#404040] dark:bg-[#222222] dark:hover:border-[#8A6A19]",
    purple: "border-[#C084FC] bg-[#F3E8FF] hover:border-[#9333EA] dark:border-[#6B3A8F] dark:bg-[#2B1E38] dark:hover:border-[#D8B4FE]",
  }[tone];
  const iconStyles = {
    orange: "bg-[#FFEEE5] text-[#FF5400] dark:bg-[#662200]/45 dark:text-[#FF9966]",
    green: "bg-[#D1FAE5] text-[#059669] dark:bg-[#064E3B]/45 dark:text-[#6EE7B7]",
    blue: "bg-[#DBEAFE] text-[#2563EB] dark:bg-[#1E3A8A]/42 dark:text-[#93C5FD]",
    red: "bg-[#FEE2E2] text-[#DC2626] dark:bg-[#7F1D1D]/42 dark:text-[#FCA5A5]",
    yellow: "bg-[#FFF2CC] text-[#A16207] dark:bg-[#664D00]/42 dark:text-[#FFCC33]",
    purple: "bg-[#F3E8FF] text-[#7E22CE] dark:bg-[#581C87]/42 dark:text-[#D8B4FE]",
  }[tone];

  return (
    <Link href={href} className={`group relative min-h-[118px] overflow-hidden rounded-[1.35rem] border p-3.5 shadow-[0_8px_28px_-24px_rgba(28,25,23,0.42)] transition-all hover:-translate-y-0.5 ${styles}`}>
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-center justify-between gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconStyles}`}>
            <Icon className="h-5 w-5" />
          </div>
          <ArrowRight className="h-4 w-4 text-[#333333]/35 transition-transform group-hover:translate-x-1 dark:text-[#CCCCCC]/70" />
        </div>
        <div>
          <p className="text-xs font-bold text-[#333333]/55 dark:text-[#CCCCCC]/80">{label}</p>
          <h3 className="mt-0.5 truncate text-2xl font-bold tracking-tight text-[#333333] dark:text-[#F5F5F5]">{value}</h3>
          <p className="mt-0.5 line-clamp-1 text-[11px] font-semibold text-[#333333]/50 dark:text-[#CCCCCC]/72">{note}</p>
        </div>
      </div>
    </Link>
  );
}

function AdminModuleTile({ module }: { module: ModuleItem }) {
  const Icon = module.icon;
  const { t } = useI18n();
  return (
    <Link href={module.href} className="group flex min-h-[94px] items-center gap-3 rounded-[1.2rem] border border-[#E6E6E6] bg-white p-3 shadow-[0_8px_28px_-24px_rgba(28,25,23,0.38)] transition-all hover:-translate-y-0.5 hover:border-[#FF9966] hover:bg-[#FFFFFF] dark:border-[#404040] dark:bg-[#222222] dark:hover:border-[#CC4400] dark:hover:bg-[#241A12]">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFEEE5] text-[#FF5400] transition-transform group-hover:scale-105 dark:bg-[#662200]/42 dark:text-[#FF9966]">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-bold text-[#333333] dark:text-[#F5F5F5]">{t(module.label)}</h3>
        <p className="mt-0.5 line-clamp-1 text-[11px] font-semibold text-[#333333]/50 dark:text-[#CCCCCC]/72">{t(module.note)}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-[#333333]/35 transition-transform group-hover:translate-x-1 dark:text-[#CCCCCC]/70" />
    </Link>
  );
}

function AdminDashboard({
  user,
  data,
  analytics,
  visibleCategories,
  financeYear,
  onFinanceYearChange,
  loading,
  isStale,
}: {
  user: ReturnType<typeof useUser>["user"];
  data: DashboardData | null;
  analytics: AdminAnalyticsData | null;
  visibleCategories: Category[];
  financeYear: string;
  onFinanceYearChange: (year: string) => void;
  loading: boolean;
  isStale: boolean;
}) {
  const { language, t } = useI18n();
  const collected = data?.totalCollected || 0;
  const pending = data?.pendingAmount || 0;
  const expenses = data?.totalExpenses || 0;
  const fundBalance = data?.fundBalance || 0;
  const totalFlow = collected + pending;
  const collectionRate = totalFlow > 0 ? Math.round((collected / totalFlow) * 100) : 0;
  const monthlyTrend = analytics?.monthlyTrend || [];
  const collectionTrend = shapeCollectionTrend(monthlyTrend);
  const recentActivity = data?.recentActivity || [];
  const adminModules = visibleCategories
    .flatMap((category) => category.modules)
    .filter((module, index, list) => list.findIndex((item) => item.href === module.href) === index);
  const primaryModules = adminModules.filter((module) => ["/maintenance", "/members", "/visitors", "/expenses", "/reports", "/complaints", "/notices", "/meetings", "/settings"].includes(module.href)).slice(0, 9);
  const topDefaulters = analytics?.topDefaulters || [];
  const aging = analytics?.aging || { current: 0, days30: 0, days60: 0, days90Plus: 0 };
  const riskTotal = aging.current + aging.days30 + aging.days60 + aging.days90Plus;
  const financeYears = data?.financeYears || [];
  const financeScopeLabel = financeYear === "all" ? t("All time") : financeYear;

  return (
    <div className="dashboard-flat-theme -m-3 min-h-full overflow-x-hidden bg-[#FEFDDF] p-2 text-[#333333] dark:bg-[#171717] dark:text-[#F5F5F5] sm:-m-4 sm:p-3 lg:-m-6 lg:p-4 xl:p-5">
      <div className="relative mx-auto max-w-[1560px] pb-20 lg:pb-4">
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.42 }} className="grid grid-cols-1 gap-3 xl:grid-cols-12">
          <div className="dashboard-panel relative overflow-hidden rounded-[1.5rem] border border-[#E6E6E6] bg-white p-4 dark:border-[#404040] dark:bg-[#222222] lg:p-5 xl:col-span-8">
            <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#FF5400]/10 blur-3xl dark:bg-[#FF5400]/8" />
            <div className="relative z-10 flex min-h-[220px] flex-col justify-between gap-6 lg:flex-row lg:items-end">
              <div className="max-w-3xl">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex min-h-7 items-center rounded-full border border-[#FF5400]/20 bg-[#FF5400]/10 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#FF5400] dark:text-[#FF9966]">
                    {t("Admin command center")}
                  </span>
                  {isStale && <RefreshCw className="h-4 w-4 animate-spin text-[#FF5400]" />}
                </div>
                <h1 className="max-w-[920px] truncate text-3xl font-bold tracking-tight text-[#333333] dark:text-[#F5F5F5] sm:text-4xl xl:text-[3.35rem]">
                  {user?.societyName || t("Society operations")}
                </h1>
                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#333333]/60 dark:text-[#CCCCCC]/82">
                  {t("Track collections, dues, gate movement, residents, and governance work from one focused admin dashboard.")}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href="/maintenance" className="dashboard-accent-primary inline-flex min-h-10 items-center justify-center rounded-xl bg-[#FF5400] px-4 text-sm font-bold text-white">
                    {t("Raise invoices")}
                  </Link>
                  <Link href="/reports" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#E6E6E6] bg-white px-4 text-sm font-bold text-[#333333] dark:border-[#404040] dark:bg-[#2A2A2A] dark:text-[#F5F5F5]">
                    {t("View reports")}
                  </Link>
                  <Link href="/notices" className="dashboard-accent-secondary inline-flex min-h-10 items-center justify-center rounded-xl border border-[#FFBE00] bg-[#FFBE00] px-4 text-sm font-bold text-[#333333] dark:text-[#333333]">
                    {t("Create notice")}
                  </Link>
                </div>
              </div>
              <div className="grid min-w-[min(100%,22rem)] grid-cols-2 gap-2">
                <div className="dashboard-subpanel rounded-2xl border border-[#E6E6E6] bg-[#F7F7F7] p-3 dark:border-[#404040] dark:bg-[#2A2A2A]">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#333333]/45 dark:text-[#CCCCCC]/70">{t("Collection rate")}</p>
                  <p className="mt-1 text-3xl font-bold text-[#FF5400]">{collectionRate}%</p>
                </div>
                <div className="dashboard-subpanel rounded-2xl border border-[#E6E6E6] bg-[#F7F7F7] p-3 dark:border-[#404040] dark:bg-[#2A2A2A]">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#333333]/45 dark:text-[#CCCCCC]/70">{t("Fund balance")}</p>
                  <p className="mt-1 truncate text-xl font-bold text-[#059669]">{formatCurrency(fundBalance)}</p>
                </div>
              </div>
            </div>
          </div>

          <aside className="grid gap-3 md:grid-cols-2 xl:col-span-4 xl:grid-cols-1">
            <div className="dashboard-panel rounded-[1.5rem] border border-[#E6E6E6] bg-white p-4 text-[#333333] dark:border-[#404040] dark:bg-[#222222] dark:text-[#F5F5F5]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#333333]/45 dark:text-[#CCCCCC]/70">{t("Finance scope")}</p>
                  <h2 className="mt-1.5 text-2xl font-bold text-[#333333] dark:text-[#F5F5F5]">{financeScopeLabel}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={financeYear}
                    onChange={(event) => onFinanceYearChange(event.target.value)}
                    className="min-h-9 rounded-xl border border-[#E6E6E6] bg-[#F7F7F7] px-2 text-xs font-bold text-[#333333] outline-none dark:border-[#404040] dark:bg-[#2A2A2A] dark:text-[#F5F5F5]"
                    aria-label={t("Finance scope")}
                  >
                    <option value="all">{t("All time")}</option>
                    {financeYears.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  <IndianRupee className="h-6 w-6 text-[#FF5400]" />
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <div className="dashboard-subpanel rounded-xl border border-[#E6E6E6] bg-[#F7F7F7] p-2.5 dark:border-[#404040] dark:bg-[#2A2A2A]">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#333333]/45 dark:text-[#CCCCCC]/70">{t("Collected")}</p>
                  <p className="mt-1 truncate text-sm font-bold text-[#059669]">{formatCurrency(collected)}</p>
                </div>
                <div className="dashboard-subpanel rounded-xl border border-[#E6E6E6] bg-[#F7F7F7] p-2.5 dark:border-[#404040] dark:bg-[#2A2A2A]">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#333333]/45 dark:text-[#CCCCCC]/70">{t("Pending")}</p>
                  <p className="mt-1 truncate text-sm font-bold text-[#FF9966]">{formatCurrency(pending)}</p>
                </div>
              </div>
            </div>
            <Link href="/complaints" className="dashboard-panel group rounded-[1.5rem] border border-[#E6E6E6] bg-white p-4 transition-colors hover:border-[#FF5400] dark:border-[#404040] dark:bg-[#222222]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#DC2626] dark:text-[#FCA5A5]">{t("Action needed")}</p>
                  <h3 className="mt-1 text-xl font-bold text-[#333333] dark:text-[#F5F5F5]">{data?.openComplaints || 0} {t("open requests")}</h3>
                  <p className="mt-1 text-xs font-semibold text-[#333333]/55 dark:text-[#CCCCCC]/78">{t("Review resident complaints and service tickets.")}</p>
                </div>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#DC2626] text-white">
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          </aside>
        </motion.section>

        <section className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <AdminMetricCard href="/maintenance" label={t("Pending dues")} value={formatCurrency(pending)} note={`${data?.pendingCount || 0} ${t("pending bills")}`} icon={Receipt} tone="orange" />
          <AdminMetricCard href="/reports" label={t("Collected")} value={formatCurrency(collected)} note={`${data?.paidCount || 0} ${t("paid bills")}`} icon={TrendingUp} tone="green" />
          <AdminMetricCard href="/expenses" label={t("Expenses")} value={formatCurrency(expenses)} note={financeYear === "all" ? t("Society spending all time") : t("Society spending this year")} icon={Wallet} tone="blue" />
          <AdminMetricCard href="/members" label={t("Residents")} value={String(data?.totalMembers || 0)} note={`${data?.visitorsToday || 0} ${t("visitors today")}`} icon={Users} tone="purple" />
        </section>

        <section className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-12">
          <div className="dashboard-panel rounded-[1.5rem] border border-[#E6E6E6] bg-white p-4 dark:border-[#404040] dark:bg-[#222222] xl:col-span-8">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-[#333333] dark:text-[#F5F5F5]">{t("Collection performance")}</h2>
                <p className="mt-0.5 text-xs font-semibold text-[#333333]/55 dark:text-[#CCCCCC]/78">{t("Collected, pending dues, and expenses across recent months.")}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-[#333333]/65 dark:text-[#CCCCCC]/82">
                  <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#10B981]" />{t("Collected")}</span>
                  <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#FF5400]" />{t("Pending")}</span>
                  <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#3B82F6]" />{t("Expenses")}</span>
                </div>
              </div>
              <Link href="/reports" className="dashboard-subpanel hidden min-h-9 items-center rounded-xl bg-[#F7F7F7] px-3 text-xs font-bold text-[#333333]/60 dark:bg-[#2A2A2A] dark:text-[#CCCCCC] sm:inline-flex">
                {t("Reports")}
              </Link>
            </div>
            <div className="dashboard-subpanel relative h-[292px] overflow-hidden rounded-2xl border border-[#E6E6E6] bg-[#F7F7F7] p-3 dark:border-[#404040] dark:bg-[#2A2A2A] sm:p-4">
              <div className="pointer-events-none absolute inset-x-4 top-6 bottom-11 flex flex-col justify-between">
                <span className="border-t border-dashed border-[#333333]/10 dark:border-[#CCCCCC]/12" />
                <span className="border-t border-dashed border-[#333333]/10 dark:border-[#CCCCCC]/12" />
                <span className="border-t border-dashed border-[#333333]/10 dark:border-[#CCCCCC]/12" />
                <span className="border-t border-dashed border-[#333333]/10 dark:border-[#CCCCCC]/12" />
              </div>
              {collectionTrend.items.length === 0 ? (
                <EmptyMiniState text={t("Analytics will appear after bills and expenses are recorded.")} />
              ) : <div className="relative z-10 flex h-full items-end gap-2 overflow-x-auto pb-1 sm:gap-3">
                {collectionTrend.items.map((item) => (
                  <div key={item.period} className="flex min-w-[62px] flex-1 flex-col items-center justify-end gap-2">
                    <div className="flex h-[190px] w-full max-w-[76px] items-end justify-center gap-1.5 rounded-xl border border-[#E6E6E6]/80 bg-white/80 px-2 py-2 shadow-sm dark:border-[#404040] dark:bg-[#222222]/90">
                      <span className="w-3 rounded-sm bg-[#10B981] shadow-[0_2px_7px_rgba(16,185,129,0.32)]" style={{ height: `${item.collectedHeight}%` }} title={`${t("Collected")}: ${formatCurrency(item.collected)}`} />
                      <span className="w-3 rounded-sm bg-[#FF5400] shadow-[0_2px_7px_rgba(255,84,0,0.32)]" style={{ height: `${item.pendingHeight}%` }} title={`${t("Pending")}: ${formatCurrency(item.pending)}`} />
                      <span className="w-3 rounded-sm bg-[#3B82F6] shadow-[0_2px_7px_rgba(59,130,246,0.32)]" style={{ height: `${item.expensesHeight}%` }} title={`${t("Expenses")}: ${formatCurrency(item.expenses)}`} />
                    </div>
                    <div className="text-center">
                      <p className="truncate text-[11px] font-bold text-[#333333] dark:text-[#F5F5F5]">{item.label}</p>
                      <p className="text-[10px] font-bold text-[#333333]/55 dark:text-[#CCCCCC]/78">{item.collectionRate}%</p>
                    </div>
                  </div>
                ))}
              </div>}
            </div>
          </div>

          <aside className="space-y-3 xl:col-span-4">
            <div className="dashboard-panel rounded-[1.5rem] border border-[#E6E6E6] bg-white p-4 dark:border-[#404040] dark:bg-[#222222]">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-[#333333] dark:text-[#F5F5F5]">{t("Work queue")}</h2>
                  <p className="mt-0.5 text-xs font-semibold text-[#333333]/55 dark:text-[#CCCCCC]/78">{t("Tasks that need admin attention.")}</p>
                </div>
                <BellRing className="h-5 w-5 text-[#FF5400]" />
              </div>
              <div className="space-y-2">
                {[
                  { href: "/maintenance", label: t("Pending collection"), value: formatCurrency(pending), icon: Receipt, tone: "bg-[#FF5400]" },
                  { href: "/complaints", label: t("Open complaints"), value: String(data?.openComplaints || 0), icon: AlertTriangle, tone: "bg-[#EF4444]" },
                  { href: "/visitors", label: t("Gate activity today"), value: String(data?.visitorsToday || 0), icon: Shield, tone: "bg-[#60A5FA]" },
                  { href: "/polls", label: t("Active polls"), value: String(data?.activePolls || 0), icon: Vote, tone: "bg-[#A78BFA]" },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href} className="dashboard-subpanel flex items-center gap-3 rounded-xl border border-[#E6E6E6] bg-[#F7F7F7] p-2.5 transition-colors hover:border-[#FF5400] dark:border-[#404040] dark:bg-[#2A2A2A]">
                      <span className={`h-2.5 w-2.5 rounded-full ${item.tone}`} />
                      <Icon className="h-4 w-4 text-[#333333]/50 dark:text-[#CCCCCC]/78" />
                      <span className="min-w-0 flex-1 truncate text-sm font-bold text-[#333333] dark:text-[#F5F5F5]">{item.label}</span>
                      <span className="shrink-0 text-sm font-bold text-[#FF5400]">{item.value}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="dashboard-panel rounded-[1.5rem] border border-[#E6E6E6] bg-white p-4 dark:border-[#404040] dark:bg-[#222222]">
              <h2 className="text-xl font-bold text-[#333333] dark:text-[#F5F5F5]">{t("Dues risk")}</h2>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {[
                  { label: t("Now"), value: aging.current, color: "bg-[#10B981]" },
                  { label: "30", value: aging.days30, color: "bg-[#FFBE00]" },
                  { label: "60", value: aging.days60, color: "bg-[#FF5400]" },
                  { label: "90+", value: aging.days90Plus, color: "bg-[#EF4444]" },
                ].map((item) => (
                  <div key={item.label} className="dashboard-subpanel rounded-xl bg-[#F7F7F7] p-2.5 dark:bg-[#2A2A2A]">
                    <div className={`mb-2 h-1.5 rounded-full ${item.color}`} style={{ opacity: riskTotal > 0 ? 1 : 0.35 }} />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#333333]/45 dark:text-[#CCCCCC]/70">{item.label}</p>
                    <p className="mt-1 truncate text-xs font-bold text-[#333333] dark:text-[#F5F5F5]">{formatCurrency(item.value)}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-12">
          <div className="dashboard-panel rounded-[1.5rem] border border-[#E6E6E6] bg-white p-4 dark:border-[#404040] dark:bg-[#222222] xl:col-span-8">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-[#333333] dark:text-[#F5F5F5]">{t("Admin shortcuts")}</h2>
                <p className="mt-0.5 text-xs font-semibold text-[#333333]/55 dark:text-[#CCCCCC]/78">{t("High-frequency controls for society operations.")}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {primaryModules.map((module) => <AdminModuleTile key={module.href} module={module} />)}
            </div>
          </div>

          <aside className="dashboard-panel rounded-[1.5rem] border border-[#E6E6E6] bg-white p-4 dark:border-[#404040] dark:bg-[#222222] xl:col-span-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#333333] dark:text-[#F5F5F5]">{t("Recent billing")}</h2>
                <p className="mt-0.5 text-xs font-semibold text-[#333333]/55 dark:text-[#CCCCCC]/78">{t("Latest invoices and payment updates.")}</p>
              </div>
              <Link href="/maintenance" className="dashboard-subpanel rounded-xl bg-[#F7F7F7] px-3 py-2 text-xs font-bold text-[#333333]/60 dark:bg-[#2A2A2A] dark:text-[#CCCCCC]">{t("Open")}</Link>
            </div>
            <div className="space-y-2">
              {recentActivity.length === 0 ? <EmptyMiniState text={t("No recent billing activity.")} /> : recentActivity.slice(0, 5).map((item) => (
                <Link key={item.id} href="/maintenance" className="dashboard-subpanel flex items-center justify-between gap-3 rounded-xl border border-[#E6E6E6] bg-[#F7F7F7] p-2.5 transition-colors hover:border-[#FF5400] dark:border-[#404040] dark:bg-[#2A2A2A]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#333333] dark:text-[#F5F5F5]">{item.flatNumber} · {item.ownerName}</p>
                    <p className="mt-0.5 text-[11px] font-semibold text-[#333333]/50 dark:text-[#CCCCCC]/72">{formatShortDate(item.updatedAt, language)} · {t(item.status)}</p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-[#FF5400]">{formatCurrency(item.amount)}</span>
                </Link>
              ))}
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, loaded } = useUser();
  const isAdmin = admin.includes(user?.role || "");
  const { t } = useI18n();
  const [financeYear, setFinanceYear] = useState("all");
  const dashboardUrl = `/api/dashboard?year=${encodeURIComponent(financeYear)}`;
  const analyticsUrl = `/api/dashboard/analytics?year=${encodeURIComponent(financeYear)}`;

  const { data, loading, isStale } = useLiveData<DashboardData>({ url: dashboardUrl, interval: LIVE_STANDARD_INTERVAL_MS, enabled: true });
  const { data: myBills } = useLiveData<MyBillsData>({
    url: "/api/my-bills",
    interval: LIVE_FAST_INTERVAL_MS,
    enabled: loaded && !isAdmin && !!user?.flatNumber,
  });
  const { data: residentBootstrap } = useLiveData<ResidentBootstrapData>({
    url: "/api/mobile/bootstrap",
    interval: LIVE_FAST_INTERVAL_MS,
    enabled: loaded && !isAdmin,
  });
  const { data: adminAnalytics } = useLiveData<AdminAnalyticsData>({
    url: analyticsUrl,
    interval: LIVE_STANDARD_INTERVAL_MS,
    enabled: loaded && isAdmin,
  });

  const visibleCategories = useMemo(() => {
    const role = user?.role || "member";
    const filtered = categories
      .map((category) => ({ ...category, modules: category.modules.filter((module) => module.roles.includes(role)) }))
      .filter((category) => category.modules.length > 0);
    if (!admin.includes(role)) return filtered;

    const adminOrder = ["management", "operations", "finance", "legal", "community", "governance"];
    return [...filtered].sort((a, b) => adminOrder.indexOf(a.id) - adminOrder.indexOf(b.id));
  }, [user?.role]);

  if (!loaded) {
    return <DashboardLoadingShell />;
  }

  return (
    <PersonaDashboardRouter
      role={user?.role || "member"}
      committee={
        <AdminDashboard
          user={user}
          data={data}
          analytics={adminAnalytics}
          visibleCategories={visibleCategories}
          financeYear={financeYear}
          onFinanceYearChange={setFinanceYear}
          loading={loading}
          isStale={isStale}
        />
      }
      treasurer={
        <TreasurerDashboard data={data} analytics={adminAnalytics} loading={loading} />
      }
      resident={
        <ResidentDashboard
          user={user}
          data={data}
          myBills={myBills}
          bootstrap={residentBootstrap}
        />
      }
      guard={<GuardDashboard data={data} loading={loading} />}
      platformAdmin={<PlatformAdminDashboard data={data} loading={loading} />}
    />
  );
}
