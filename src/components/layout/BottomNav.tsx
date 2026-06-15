"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Home,
  Contact,
  Plus,
  MessageCircleMore,
  User as UserIcon,
  Shield,
  Package,
  Phone,
  X,
  UserCheck,
  AlertTriangle,
  Building2,
} from "lucide-react";
import { useUser } from "@/lib/user-context";
import { usePersonaNav } from "@/lib/navigation/use-persona-nav";
import { getNavIcon } from "@/lib/navigation/nav-icons";
import { useI18n } from "@/lib/i18n";

interface BottomNavProps {
  userRole?: string;
  userId?: string;
  societyId?: string;
}

const QUICK_ACTIONS = [
  { href: "/my-visitors", label: "Pre-approve Visitor", icon: UserCheck, roles: ["member", "tenant"] as const },
  { href: "/complaints", label: "Raise Complaint", icon: AlertTriangle, roles: ["member", "tenant", "guard", "watchman"] as const },
  { href: "/amenities", label: "Book Amenity", icon: Building2, roles: ["member", "tenant"] as const },
  { href: "/emergency", label: "SOS", icon: Phone, roles: ["member", "tenant", "guard", "watchman"] as const },
] as const;

export default function BottomNav({
  userRole = "member",
  userId,
  societyId,
}: BottomNavProps) {
  const { t } = useI18n();
  void userId;
  void societyId;

  const pathname = usePathname();
  const { user } = useUser();
  const [showActions, setShowActions] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  const personaNav = usePersonaNav(
    societyId
      ? { subject: userId || user.email || "user", societyId, role: userRole }
      : null,
  );

  useEffect(() => {
    if (!showActions) return;
    const handler = (event: MouseEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(event.target as Node)) {
        setShowActions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showActions]);

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" || pathname === "/" : pathname.startsWith(href);

  const navLinkClass = (href: string) =>
    `flex flex-col items-center justify-center w-16 gap-1 ${
      isActive(href) ? "text-[#F97316]" : "text-gray-400 hover:text-gray-600"
    }`;

  const iconStroke = (href: string) => (isActive(href) ? 2.5 : 2);

  if (personaNav?.persona === "guard") {
    const guardTabs = [
      { href: "/visitors", label: "Gate", icon: Shield },
      { href: "/packages", label: "Parcels", icon: Package },
      { href: "/emergency", label: "SOS", icon: Phone },
    ];

    return (
      <div className="fixed bottom-0 left-0 right-0 z-40 mx-auto max-w-[420px] border-t border-gray-100 bg-white pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)] lg:hidden">
        <div className="relative flex h-16 items-center justify-around px-2">
          {guardTabs.map((tab) => (
            <Link key={tab.href} href={tab.href} className={navLinkClass(tab.href)}>
              <tab.icon className="h-[22px] w-[22px]" strokeWidth={iconStroke(tab.href)} />
              <span className="text-[10px] font-semibold">{t(tab.label)}</span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  if (personaNav && personaNav.persona !== "resident" && personaNav.bottomNav.length > 0) {
    const tabs = personaNav.bottomNav.slice(0, 5);

    return (
      <div className="fixed bottom-0 left-0 right-0 z-40 mx-auto max-w-[420px] border-t border-gray-100 bg-white pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)] lg:hidden">
        <div className="relative flex h-16 items-center justify-around px-2">
          {tabs.map((tab) => {
            const Icon = getNavIcon(tab.iconKey);
            return (
              <Link key={tab.href} href={tab.href} className={navLinkClass(tab.href)}>
                <Icon className="h-[22px] w-[22px]" strokeWidth={iconStroke(tab.href)} />
                <span className="text-[10px] font-semibold">{t(tab.label)}</span>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <>
      {showActions && (
        <div className="fixed inset-0 z-50 bg-black/30 lg:hidden" aria-hidden="true" />
      )}

      <div className="fixed bottom-0 left-0 right-0 z-40 mx-auto max-w-[420px] border-t border-gray-100 bg-white pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)] lg:hidden">
        {showActions && (
          <div
            ref={sheetRef}
            className="absolute bottom-[4.5rem] left-1/2 z-50 w-[min(18rem,calc(100%-2rem))] -translate-x-1/2 rounded-2xl border border-gray-100 bg-white p-2 shadow-xl"
          >
            <div className="mb-1 flex items-center justify-between px-2 py-1">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{t("Quick Add")}</p>
              <button
                type="button"
                onClick={() => setShowActions(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close quick actions"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {QUICK_ACTIONS.filter((action) => {
              const roles: readonly string[] = action.roles;
              return roles.includes(userRole);
            }).map((action) => (
              <Link
                key={action.href}
                href={action.href}
                onClick={() => setShowActions(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-[#FFF7ED]"
              >
                <action.icon className="h-4 w-4 text-[#F97316]" />
                {t(action.label)}
              </Link>
            ))}
          </div>
        )}

        <div className="relative flex h-16 items-center justify-around px-2">
          <Link href="/dashboard" className={navLinkClass("/dashboard")}>
            <Home className="h-[22px] w-[22px]" strokeWidth={iconStroke("/dashboard")} />
            <span className="text-[10px] font-semibold">{t("Home")}</span>
          </Link>

          <Link href="/my-society" className={navLinkClass("/my-society")}>
            <Contact className="h-[22px] w-[22px]" strokeWidth={iconStroke("/my-society")} />
            <span className="text-[10px] font-semibold">{t("My Society")}</span>
          </Link>

          <div className="relative -mt-8 flex w-16 justify-center">
            <button
              type="button"
              onClick={() => setShowActions((open) => !open)}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F97316] text-white shadow-[0_4px_10px_rgba(249,115,22,0.3)] transition-transform hover:scale-105 hover:bg-[#ea580c] active:scale-95"
              aria-label="Quick actions"
              aria-expanded={showActions}
            >
              <Plus className="h-6 w-6" strokeWidth={2.5} />
            </button>
          </div>

          <Link href="/services" className={navLinkClass("/services")}>
            <MessageCircleMore className="h-[22px] w-[22px]" strokeWidth={iconStroke("/services")} />
            <span className="text-[10px] font-semibold">{t("Services")}</span>
          </Link>

          <Link href="/profile" className={navLinkClass("/profile")}>
            <UserIcon className="h-[22px] w-[22px]" strokeWidth={iconStroke("/profile")} />
            <span className="text-[10px] font-semibold">{t("Profile")}</span>
          </Link>
        </div>
      </div>
    </>
  );
}
