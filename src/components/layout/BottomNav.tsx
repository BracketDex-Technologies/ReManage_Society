"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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
import type { LucideIcon } from "lucide-react";
import { useUser } from "@/lib/user-context";
import { usePersonaNav } from "@/lib/navigation/use-persona-nav";
import { getNavIcon } from "@/lib/navigation/nav-icons";
import { useI18n } from "@/lib/i18n";

interface BottomNavProps {
  userRole?: string;
  userId?: string;
  societyId?: string;
}

interface QuickActionTile {
  id: string;
  href: string;
  label: string;
  iconKey: string;
  accent: string;
  iconBg: string;
}

const FALLBACK_QUICK_ACTIONS = [
  { href: "/my-visitors", label: "Pre-approve Visitor", icon: UserCheck, roles: ["member", "tenant"] as const, iconKey: "user-check" },
  { href: "/complaints", label: "Raise Complaint", icon: AlertTriangle, roles: ["member", "tenant", "guard", "watchman"] as const, iconKey: "alert-triangle" },
  { href: "/amenities", label: "Book Amenity", icon: Building2, roles: ["member", "tenant"] as const, iconKey: "building" },
  { href: "/emergency", label: "SOS", icon: Phone, roles: ["member", "tenant", "guard", "watchman"] as const, iconKey: "phone" },
] as const;

const TILE_STYLES: Record<string, { accent: string; iconBg: string }> = {
  "credit-card": { accent: "text-orange-600", iconBg: "bg-orange-50 dark:bg-orange-950/40" },
  "user-check": { accent: "text-blue-600", iconBg: "bg-blue-50 dark:bg-blue-950/40" },
  "alert-triangle": { accent: "text-amber-600", iconBg: "bg-amber-50 dark:bg-amber-950/40" },
  building: { accent: "text-violet-600", iconBg: "bg-violet-50 dark:bg-violet-950/40" },
  phone: { accent: "text-red-600", iconBg: "bg-red-50 dark:bg-red-950/40" },
  shield: { accent: "text-emerald-600", iconBg: "bg-emerald-50 dark:bg-emerald-950/40" },
  package: { accent: "text-indigo-600", iconBg: "bg-indigo-50 dark:bg-indigo-950/40" },
  megaphone: { accent: "text-orange-600", iconBg: "bg-orange-50 dark:bg-orange-950/40" },
  receipt: { accent: "text-orange-600", iconBg: "bg-orange-50 dark:bg-orange-950/40" },
  "bar-chart": { accent: "text-sky-600", iconBg: "bg-sky-50 dark:bg-sky-950/40" },
};

function tileStyle(iconKey: string) {
  return TILE_STYLES[iconKey] ?? { accent: "text-[#FF5400]", iconBg: "bg-[#FFEEE5] dark:bg-[#662200]/30" };
}

export default function BottomNav({
  userRole = "member",
  userId,
  societyId,
}: BottomNavProps) {
  const { t } = useI18n();
  void userId;

  const pathname = usePathname();
  const { user } = useUser();
  const [showActions, setShowActions] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  const personaNav = usePersonaNav(
    societyId
      ? { subject: userId || user.email || "user", societyId, role: userRole }
      : null,
  );

  const quickActionTiles = useMemo<QuickActionTile[]>(() => {
    const toTile = (id: string, href: string, label: string, iconKey: string): QuickActionTile => {
      const style = tileStyle(iconKey);
      return { id, href, label, iconKey, accent: style.accent, iconBg: style.iconBg };
    };

    if (personaNav?.quickActions?.length) {
      const tiles = personaNav.quickActions.map((action) =>
        toTile(action.id, action.href, action.label, action.iconKey),
      );

      if (
        personaNav.persona === "resident" &&
        !tiles.some((tile) => tile.href === "/amenities")
      ) {
        tiles.splice(2, 0, toTile("book-amenity", "/amenities", "Book Amenity", "building"));
      }

      return tiles;
    }

    return FALLBACK_QUICK_ACTIONS.filter((action) => {
      const roles: readonly string[] = action.roles;
      return roles.includes(userRole);
    }).map((action) => toTile(action.href, action.href, action.label, action.iconKey));
  }, [personaNav?.persona, personaNav?.quickActions, userRole]);

  useEffect(() => {
    if (!showActions) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowActions(false);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showActions]);

  useEffect(() => {
    setShowActions(false);
  }, [pathname]);

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" || pathname === "/" : pathname.startsWith(href);

  const navLinkClass = (href: string) =>
    `flex flex-col items-center justify-center w-16 gap-1 ${
      isActive(href) ? "text-[#FF5400]" : "text-[#999999] hover:text-[#333333] dark:hover:text-[#F5F5F5]"
    }`;

  const iconStroke = (href: string) => (isActive(href) ? 2.5 : 2);

  if (personaNav?.persona === "guard") {
    const guardTabs = [
      { href: "/visitors", label: "Gate", icon: Shield },
      { href: "/packages", label: "Parcels", icon: Package },
      { href: "/emergency", label: "SOS", icon: Phone },
    ];

    return (
      <div className="fixed bottom-0 left-0 right-0 z-[60] mx-auto max-w-[420px] border-t border-[#E6E6E6] bg-white pb-safe dark:border-[#404040] dark:bg-[#222222] lg:hidden">
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
      <div className="fixed bottom-0 left-0 right-0 z-[60] mx-auto max-w-[420px] border-t border-[#E6E6E6] bg-white pb-safe dark:border-[#404040] dark:bg-[#222222] lg:hidden">
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
        <div className="fixed inset-0 z-[70] lg:hidden" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-[#1a1a1a]/50 backdrop-blur-[2px]"
            onClick={() => setShowActions(false)}
            aria-label={t("Close quick actions")}
          />

          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("Quick Add")}
            className="absolute bottom-[5.25rem] left-3 right-3 mx-auto max-w-[420px] animate-in fade-in slide-in-from-bottom-4 duration-200"
          >
            <div className="overflow-hidden rounded-[1.5rem] border border-[#E6E6E6] bg-white shadow-[0_20px_60px_-20px_rgba(0,0,0,0.45)] dark:border-[#404040] dark:bg-[#222222]">
              <div className="flex items-center justify-between border-b border-[#E6E6E6] px-4 py-3 dark:border-[#404040]">
                <div>
                  <p className="text-sm font-black text-[#333333] dark:text-[#F5F5F5]">{t("Quick Add")}</p>
                  <p className="text-[11px] font-semibold text-[#808080]">{t("Common resident actions in one tap")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowActions(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F7F7F7] text-[#666666] transition-colors hover:bg-[#FFEEE5] hover:text-[#FF5400] dark:bg-[#2A2A2A] dark:text-[#CCCCCC] dark:hover:bg-[#662200]/30 dark:hover:text-[#FF7733]"
                  aria-label={t("Close")}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {quickActionTiles.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm font-semibold text-[#808080]">
                  {t("No quick actions available for this account.")}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 p-3">
                  {quickActionTiles.map((action) => {
                    const Icon = getNavIcon(action.iconKey) as LucideIcon;
                    return (
                      <Link
                        key={action.id}
                        href={action.href}
                        onClick={() => setShowActions(false)}
                        className="group flex min-h-[5.5rem] flex-col items-start justify-between rounded-2xl border border-[#E6E6E6] bg-[#FAFAFA] p-3 transition-all active:scale-[0.98] hover:border-[#FF5400]/30 hover:bg-[#FFEEE5]/40 dark:border-[#404040] dark:bg-[#2A2A2A] dark:hover:border-[#FF7733]/40 dark:hover:bg-[#662200]/20"
                      >
                        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${action.iconBg}`}>
                          <Icon className={`h-5 w-5 ${action.accent}`} strokeWidth={2.25} />
                        </span>
                        <span className="text-left text-xs font-bold leading-snug text-[#333333] group-hover:text-[#FF5400] dark:text-[#F5F5F5] dark:group-hover:text-[#FF7733]">
                          {t(action.label)}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-[80] mx-auto max-w-[420px] border-t border-[#E6E6E6] bg-white pb-safe dark:border-[#404040] dark:bg-[#222222] lg:hidden">
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
              className={`flex h-12 w-12 items-center justify-center rounded-full bg-[#FF5400] text-white shadow-[0_8px_24px_-8px_rgba(255,84,0,0.65)] transition-all hover:bg-[#CC4400] active:scale-95 ${showActions ? "rotate-45 bg-[#333333] hover:bg-[#222222] dark:bg-[#F5F5F5] dark:text-[#333333]" : ""}`}
              aria-label={t("Quick actions")}
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
