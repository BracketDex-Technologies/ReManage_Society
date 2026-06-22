"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
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
import { logoutCurrentTab } from "@/lib/client-session";
import { getNavIcon } from "@/lib/navigation/nav-icons";

const roleLabels: Record<string, string> = {
  chairman: "Chairman",
  secretary: "Secretary",
  treasurer: "Treasurer",
  member: "Flat Member",
  tenant: "Tenant",
  guard: "Security Guard",
  watchman: "Watchman",
  vendor_staff: "Vendor",
  facility_manager: "Facility Manager",
};

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
          mfaVerified: user.mfaVerified,
        }
      : null,
  );

  const handleLogout = async () => {
    await logoutCurrentTab();
    router.push("/login");
  };

  const visibleSections = personaNav?.navigation.sections ?? [];
  const displaySocietyName = societyName?.trim() || "ReManage";
  const displaySocietyAddress = societyAddress?.trim() || "Society";
  const displayUserRole =
    roleLabels[userRole] || userRole.charAt(0).toUpperCase() + userRole.slice(1).replace("_", " ");

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
          className="fixed inset-0 z-40 bg-[#333333]/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        data-persona={personaNav?.persona || "unknown"}
        className={`fixed left-0 top-0 z-50 flex h-[100dvh] flex-col overflow-hidden border-r border-[#E6E6E6] bg-white pb-safe transition-[width,transform] duration-300 ease-in-out dark:border-[#404040] dark:bg-[#222222] lg:static lg:z-auto lg:translate-x-0 lg:rounded-r-[1.5rem] ${
          isCompact ? "w-[4.85rem] lg:cursor-e-resize" : "w-64 max-w-[16rem]"
        } ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className={`relative overflow-hidden ${isCompact ? "p-2.5" : "p-3"}`}>
          <div className={`relative rounded-[1.15rem] border border-[#E6E6E6] bg-white dark:border-[#404040] dark:bg-[#2A2A2A] ${isCompact ? "p-1.5" : "p-2.5"}`}>
            <div className={`flex w-full items-center ${isCompact ? "justify-center" : "gap-2.5"}`}>
              <Image
                src="/logo.png"
                alt="ReManage"
                width={40}
                height={40}
                className="h-10 w-10 min-w-10 rounded-xl ring-1 ring-[#E6E6E6] dark:ring-[#404040]"
                priority
              />
              {!isCompact && (
                <div className="min-w-0 flex-1 overflow-hidden">
                  <h2 className="truncate text-sm font-bold leading-tight text-[#333333] dark:text-[#F5F5F5]" title={displaySocietyName}>
                    {displaySocietyName}
                  </h2>
                  <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-[0.14em] text-[#333333]/[0.45] dark:text-[#CCCCCC]/75" title={displaySocietyAddress}>
                    {displaySocietyAddress}
                  </p>
                </div>
              )}
              {!isCompact && (
                <button
                  type="button"
                  onClick={togglePin}
                  className={`hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF5400] lg:flex ${
                    isPinned
                      ? "border-[#FF5400]/20 bg-[#FF5400] text-white"
                      : "border-[#E6E6E6] bg-[#F7F7F7] text-[#333333]/[0.65] hover:bg-[#FFEEE5] hover:text-[#FF5400] dark:border-[#404040] dark:bg-[#2A2A2A] dark:text-[#F5F5F5]/[0.65]"
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
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#E6E6E6] bg-[#F7F7F7] text-[#333333] transition-colors hover:bg-[#FFEEE5] dark:border-[#404040] dark:bg-[#2A2A2A] dark:text-[#F5F5F5] lg:hidden"
                aria-label={t("Close menu")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <nav className={`flex-1 min-h-0 overflow-y-auto ${isCompact ? "px-2.5 py-1.5" : "px-3 py-1.5"}`}>
          <div className={isCompact ? "space-y-1.5" : "space-y-2.5"}>
            {visibleSections.map((section) => (
              <div key={section.title || "main"}>
                {section.title && !isCompact && (
                  <button
                    type="button"
                    onClick={() => toggleSection(section.title)}
                    className="flex min-h-7 w-full items-center justify-between rounded-lg px-2 pb-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#333333]/[0.45] transition-colors hover:text-[#333333] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF5400] dark:text-[#CCCCCC]/70 dark:hover:text-[#F5F5F5]"
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
                        className={`group relative flex items-center gap-2.5 rounded-xl font-bold transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF5400] ${
                          isCompact
                            ? `h-10 w-10 justify-center ${isActive ? "bg-[#FFEEE5] text-[#FF5400] dark:bg-[#FF5400]/20 dark:text-[#FF7733]" : "text-[#333333]/[0.55] hover:bg-white hover:text-[#FF5400] dark:text-[#CCCCCC] dark:hover:bg-white/[0.08] dark:hover:text-[#FF9966]"}`
                            : `min-h-10 px-2.5 py-2 text-sm ${isActive ? "bg-[#FFEEE5] text-[#333333] dark:bg-[#FF5400]/[0.18] dark:text-[#F5F5F5]" : "text-[#333333]/[0.62] hover:bg-white hover:text-[#333333] dark:text-[#CCCCCC] dark:hover:bg-white/[0.08] dark:hover:text-[#F5F5F5]"}`
                        }`}
                        onClick={onClose}
                      >
                        {isActive && !isCompact && <span className="absolute right-1.5 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-[#FF5400]" />}
                        <span className={`${isCompact ? "h-8 w-8" : "h-8 w-8"} flex shrink-0 items-center justify-center rounded-lg transition-all ${
                          isActive
                            ? "bg-[#FF5400] text-white"
                            : "bg-[#F7F7F7] text-[#333333]/[0.58] group-hover:bg-[#FFEEE5] group-hover:text-[#FF5400] dark:bg-[#2A2A2A] dark:text-[#CCCCCC] dark:group-hover:bg-[#FF5400]/[0.16] dark:group-hover:text-[#FF9966]"
                        }`}>
                          <Icon className={`${isCompact ? "h-[18px] w-[18px]" : "h-4 w-4"} shrink-0`} />
                        </span>
                        {!isCompact && <span className="truncate pr-4">{t(item.label)}</span>}
                      </Link>
                    );
                  })}
                </div>
                {isCompact && section.title && <div className="mx-auto my-2 h-px w-8 bg-[#E6E6E6]/60 dark:bg-[#404040]/55" />}
              </div>
            ))}
          </div>
        </nav>

        <div className={`mt-auto shrink-0 ${isCompact ? "p-2.5" : "p-3"}`}>
          {!isCompact && (
            <div className="mb-2 rounded-[1.15rem] border border-[#E6E6E6] bg-white p-2.5 dark:border-[#404040] dark:bg-[#2A2A2A]">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#333333]/[0.45] dark:text-[#CCCCCC]/70">
                {t("Signed in as")}
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#FFEEE5] text-[#808080] dark:bg-[#333333] dark:text-[#FFBE00]">
                  <Shield className="h-4 w-4" />
                </span>
                <span className="min-w-0 truncate text-sm font-bold text-[#333333] dark:text-[#F5F5F5]">
                  {t(displayUserRole)}
                </span>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            data-testid="mobile-sidebar-logout"
            title={t("Sign Out")}
            className={`flex items-center gap-3 border border-[#FFDDCC] bg-[#FFEEE5] font-bold text-[#993300] transition-colors hover:bg-[#FFDDCC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF7733] dark:border-[#662200]/40 dark:bg-[#662200]/20 dark:text-[#FF9966] dark:hover:bg-[#662200]/35 ${
              isCompact
                ? "h-14 w-10 flex-col justify-center gap-0.5 rounded-xl lg:h-10 lg:flex-row lg:gap-0"
                : "w-full rounded-xl px-3 py-2.5 text-sm"
            }`}
          >
            <LogOut className="h-[18px] w-[18px]" />
            {isCompact && <span className="text-[9px] font-black leading-none lg:hidden">{t("Sign Out")}</span>}
            {!isCompact && t("Sign Out")}
          </button>
        </div>
      </aside>
    </>
  );
}
