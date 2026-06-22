"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CreditCard,
  LogOut,
  Mail,
  Phone,
  UserCheck,
} from "lucide-react";
import { useUser } from "@/lib/user-context";
import { useI18n } from "@/lib/i18n";
import { getPersonaLabel } from "@/lib/navigation/persona-labels";
import { usePersonaNav } from "@/lib/navigation/use-persona-nav";
import { canUseResidentSelfService } from "@/lib/roles";

export default function ProfilePage() {
  const { user } = useUser();
  const { t } = useI18n();
  const router = useRouter();
  const personaNav = usePersonaNav(
    user.societyId
      ? { subject: user.id || user.email || "user", societyId: user.societyId, role: user.role }
      : null,
  );

  const initials = (user.name || "U")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const personaLabel = personaNav ? getPersonaLabel(personaNav.persona) : user.role;

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    router.push("/login");
    router.refresh();
  };

  const quickLinks = [
    ...(canUseResidentSelfService(user.role)
      ? [
          { href: "/my-bills", label: t("My Bills"), icon: CreditCard, accent: "bg-[#FFF7ED] text-[#F97316]" },
          { href: "/my-visitors", label: t("My Visitors"), icon: UserCheck, accent: "bg-[#EFF6FF] text-[#2563EB]" },
        ]
      : []),
    { href: "/complaints", label: t("Helpdesk"), icon: AlertTriangle, accent: "bg-[#FEF3C7] text-[#D97706]" },
  ];

  return (
    <div className="mx-auto max-w-[420px] space-y-5 pb-24 animate-in fade-in duration-300">
      <div className="rounded-2xl border border-[#FED7AA]/60 bg-white p-5 shadow-sm dark:border-[#303030] dark:bg-[#1E1E1E]">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#F97316] text-xl font-black text-white">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-black text-text-primary">{user.name || t("Resident")}</h1>
            <p className="text-xs font-bold uppercase tracking-wider text-[#F97316]">{t(personaLabel)}</p>
            {user.flatNumber && (
              <p className="mt-1 text-xs font-semibold text-text-secondary">
                {user.societyName || t("Your society")} · {user.flatNumber}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-2 border-t border-[#FED7AA]/40 pt-4 dark:border-[#303030]">
          {user.email && (
            <div className="flex items-center gap-2 text-sm font-medium text-text-secondary">
              <Mail className="h-4 w-4 shrink-0" />
              <span className="truncate">{user.email}</span>
            </div>
          )}
          {user.societyAddress && (
            <div className="flex items-center gap-2 text-sm font-medium text-text-secondary">
              <Phone className="h-4 w-4 shrink-0" />
              <span className="truncate">{user.societyAddress}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center gap-3 rounded-2xl border border-[#FED7AA]/60 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 dark:border-[#303030] dark:bg-[#1E1E1E]"
          >
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${link.accent}`}>
              <link.icon className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold text-text-primary">{link.label}</p>
          </Link>
        ))}
      </div>

      <button
        type="button"
        onClick={handleLogout}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600 transition-colors hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400"
      >
        <LogOut className="h-4 w-4" />
        {t("Logout")}
      </button>
    </div>
  );
}
