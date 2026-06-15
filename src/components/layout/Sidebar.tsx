"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  ChevronDown,
  LogOut,
  Pin,
  PinOff,
  Shield,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useUser } from "@/lib/user-context";
import { usePersonaNav } from "@/lib/navigation/use-persona-nav";
import { getNavIcon } from "@/lib/navigation/nav-icons";
import { getPersonaLabel } from "@/lib/navigation/persona-labels";

interface SidebarProps {
  societyName?: string;
  societyAddress?: string;
  isOpen?: boolean;
  onClose?: () => void;
  userRole?: string;
  userId?: string;
  societyId?: string;
}

export default function Sidebar({
  societyName = "ReManage",
  societyAddress = "",
  isOpen = false,
  onClose,
  userRole = "member",
  userId,
  societyId,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const [isPinned, setIsPinned] = useState(true);
  const [isHoverExpanded, setIsHoverExpanded] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const { t } = useI18n();
  const isCompact = !isPinned && !isHoverExpanded && !isOpen;
  const personaNav = usePersonaNav(
    societyId || user.societyId
      ? {
          subject: userId || user.id || user.email || "user",
          societyId: societyId || user.societyId || "",
          role: userRole,
        }
      : null,
  );

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const visibleSections = personaNav?.navigation.sections ?? [];
  const displaySocietyName = societyName?.trim() || "ReManage";
  const displaySocietyAddress = societyAddress?.trim() || "Society";
  const displayUserRole = personaNav ? getPersonaLabel(personaNav.persona) : userRole.charAt(0).toUpperCase() + userRole.slice(1).replace("_", " ");

  const toggleSection = (title: string) => {
    setCollapsedSections((current) => ({ ...current, [title]: !current[title] }));
  };

  useEffect(() => {
    const stored = localStorage.getItem("society-sidebar-pinned");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsPinned(stored === null ? true : stored === "true");
    if (stored === null) {
      localStorage.setItem("society-sidebar-pinned", "true");
    }
  }, []);

  useEffect(() => {
    const handlePointerMove = (event: MouseEvent) => {
      if (window.innerWidth < 1024 || isPinned || isOpen) return;

      if (event.clientX <= 112) {
        setIsHoverExpanded(true);
      } else if (event.clientX > 336) {
        setIsHoverExpanded(false);
      }
    };

    window.addEventListener("mousemove", handlePointerMove);
    return () => window.removeEventListener("mousemove", handlePointerMove);
  }, [isOpen, isPinned]);

  const togglePin = () => {
    setIsPinned((current) => {
      const next = !current;
      localStorage.setItem("society-sidebar-pinned", String(next));
      if (next) setIsHoverExpanded(false);
      return next;
    });
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#1C1917]/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        data-persona={personaNav?.persona || "unknown"}
        className={`fixed left-0 top-0 z-50 flex h-[100dvh] flex-col overflow-hidden border-r border-[#FED7AA] bg-white/[0.92] pb-safe shadow-[0_18px_64px_-52px_rgba(28,25,23,0.72)] backdrop-blur-xl transition-[width,transform] duration-300 ease-in-out dark:border-[#303030] dark:bg-[#1E1E1E]/[0.94] lg:static lg:z-auto lg:translate-x-0 lg:rounded-r-[1.5rem] ${
          isCompact ? "w-[4.85rem] lg:cursor-e-resize" : "w-64 max-w-[16rem]"
        } ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className={`relative overflow-hidden ${isCompact ? "p-2.5" : "p-3"}`}>
          <div className="pointer-events-none absolute -right-12 -top-16 h-28 w-28 rounded-full bg-[#FDE047]/25 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-12 left-2 h-28 w-28 rounded-full bg-[#57534E]/10 blur-2xl" />

          <div className={`relative rounded-[1.15rem] border border-[#FED7AA] bg-white/[0.78] shadow-[0_12px_38px_-32px_rgba(28,25,23,0.58)] backdrop-blur dark:border-[#303030] dark:bg-[#303030]/45 ${isCompact ? "p-1.5" : "p-2.5"}`}>
            <div className={`flex w-full items-center ${isCompact ? "justify-center" : "gap-2.5"}`}>
              <div className="flex h-10 w-10 min-w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#F97316] to-[#FDE047] text-white shadow-lg shadow-[#F97316]/20 ring-1 ring-white/50 dark:ring-white/10">
                <Building2 className="h-5 w-5" />
              </div>
              {!isCompact && (
                <div className="min-w-0 flex-1 overflow-hidden">
                  <h2 className="truncate text-sm font-bold leading-tight text-[#1C1917] dark:text-[#FAF7F5]" title={displaySocietyName}>
                    {displaySocietyName}
                  </h2>
                  <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-[0.14em] text-[#1C1917]/[0.45] dark:text-[#D6D3D1]/75" title={displaySocietyAddress}>
                    {displaySocietyAddress}
                  </p>
                </div>
              )}
              {!isCompact && (
                <button
                  type="button"
                  onClick={togglePin}
                  className={`hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F97316] lg:flex ${
                    isPinned
                      ? "border-[#F97316]/20 bg-[#F97316] text-white shadow-lg shadow-[#F97316]/20"
                      : "border-[#FED7AA] bg-[#FFF7ED] text-[#1C1917]/[0.65] hover:bg-[#F97316]/10 hover:text-[#F97316] dark:border-[#303030] dark:bg-[#303030]/50 dark:text-[#FAF7F5]/[0.65]"
                  }`}
                  title={isPinned ? t("Unpin sidebar") : t("Pin sidebar")}
                  aria-label={isPinned ? t("Unpin sidebar") : t("Pin sidebar")}
                >
                  {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#FED7AA] bg-[#FFF7ED] text-[#1C1917] transition-colors hover:bg-[#F97316]/10 dark:border-[#303030] dark:bg-[#303030]/50 dark:text-[#FAF7F5] lg:hidden"
                aria-label={t("Close menu")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <nav className={`flex-1 overflow-y-auto ${isCompact ? "px-2.5 py-1.5" : "px-3 py-1.5"}`}>
          <div className={isCompact ? "space-y-1.5" : "space-y-2.5"}>
            {visibleSections.map((section) => (
              <div key={section.title || "main"}>
                {section.title && !isCompact && (
                  <button
                    type="button"
                    onClick={() => toggleSection(section.title)}
                    className="flex min-h-7 w-full items-center justify-between rounded-lg px-2 pb-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#1C1917]/[0.45] transition-colors hover:text-[#1C1917] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F97316] dark:text-[#D6D3D1]/70 dark:hover:text-[#FAF7F5]"
                  >
                    <span>{t(section.title)}</span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${collapsedSections[section.title] ? "-rotate-90" : ""}`} />
                  </button>
                )}
                <div className={`${collapsedSections[section.title] && !isCompact ? "hidden" : "block"} ${isCompact ? "space-y-1.5" : "space-y-1"}`}>
                  {section.items.map((item) => {
                    const Icon = getNavIcon(item.iconKey);
                    const isActive = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={t(item.label)}
                        className={`group relative flex items-center gap-2.5 rounded-xl font-bold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F97316] ${
                          isCompact
                            ? `h-10 w-10 justify-center ${isActive ? "bg-[#F97316]/[0.12] text-[#F97316] shadow-[0_10px_28px_-22px_rgba(249,115,22,0.8)] dark:bg-[#F97316]/20 dark:text-[#FB923C]" : "text-[#1C1917]/[0.55] hover:-translate-y-0.5 hover:bg-white hover:text-[#F97316] dark:text-[#D6D3D1] dark:hover:bg-white/[0.08] dark:hover:text-[#FDBA74]"}`
                            : `min-h-10 px-2.5 py-2 text-sm ${isActive ? "bg-[#F97316]/10 text-[#1C1917] shadow-[0_12px_34px_-28px_rgba(249,115,22,0.86)] dark:bg-[#F97316]/[0.18] dark:text-[#FAF7F5]" : "text-[#1C1917]/[0.62] hover:-translate-y-0.5 hover:bg-white hover:text-[#1C1917] dark:text-[#D6D3D1] dark:hover:bg-white/[0.08] dark:hover:text-[#FAF7F5]"}`
                        }`}
                        onClick={onClose}
                      >
                        {isActive && !isCompact && <span className="absolute right-1.5 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-[#F97316]" />}
                        <span className={`${isCompact ? "h-8 w-8" : "h-8 w-8"} flex shrink-0 items-center justify-center rounded-lg transition-all ${
                          isActive
                            ? "bg-[#F97316] text-white shadow-lg shadow-[#F97316]/20"
                            : "bg-[#FFF7ED] text-[#1C1917]/[0.58] group-hover:bg-[#F97316]/10 group-hover:text-[#F97316] dark:bg-[#303030]/45 dark:text-[#D6D3D1] dark:group-hover:bg-[#F97316]/[0.16] dark:group-hover:text-[#FDBA74]"
                        }`}>
                          <Icon className={`${isCompact ? "h-[18px] w-[18px]" : "h-4 w-4"} shrink-0`} />
                        </span>
                        {!isCompact && <span className="truncate pr-4">{t(item.label)}</span>}
                      </Link>
                    );
                  })}
                </div>
                {isCompact && section.title && <div className="mx-auto my-2 h-px w-8 bg-[#FED7AA]/60 dark:bg-[#303030]/55" />}
              </div>
            ))}
          </div>
        </nav>

        <div className={`mt-auto ${isCompact ? "p-2.5" : "p-3"}`}>
          {!isCompact && (
            <div className="mb-2 rounded-[1.15rem] border border-[#FED7AA] bg-white/[0.78] p-2.5 shadow-[0_10px_32px_-28px_rgba(28,25,23,0.5)] dark:border-[#303030] dark:bg-[#303030]/45">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1C1917]/[0.45] dark:text-[#D6D3D1]/70">
                {t("Signed in as")}
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#F97316]/10 text-[#57534E] dark:bg-[#57534E]/[0.18] dark:text-[#FDE047]">
                  <Shield className="h-4 w-4" />
                </span>
                <span className="min-w-0 truncate text-sm font-bold text-[#1C1917] dark:text-[#FAF7F5]">
                  {t(displayUserRole)}
                </span>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            title={t("Sign Out")}
            className={`flex items-center gap-3 border border-[#FECACA] bg-[#FEE2E2] font-bold text-[#B91C1C] shadow-sm transition-all hover:bg-[#FECACA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F87171] dark:border-[#7F1D1D]/40 dark:bg-[#7F1D1D]/20 dark:text-[#FCA5A5] dark:hover:bg-[#7F1D1D]/35 ${
              isCompact
                ? "h-10 w-10 justify-center rounded-xl"
                : "w-full rounded-xl px-3 py-2.5 text-sm"
            }`}
          >
            <LogOut className="h-[18px] w-[18px]" />
            {!isCompact && t("Sign Out")}
          </button>
        </div>
      </aside>
    </>
  );
}
