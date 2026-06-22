"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Menu, LogOut, Settings, User, Shield, ChevronDown, Copy, Search } from "lucide-react";
import CommandPalette, { clearRecentActions, useCommandPalette } from "@/components/ux/CommandPalette";
import { useUser } from "@/lib/user-context";
import { usePersonaNav } from "@/lib/navigation/use-persona-nav";
import { getPersonaLabel } from "@/lib/navigation/persona-labels";
import { useRouter } from "next/navigation";
import NotificationCenter from "@/components/ui/NotificationCenter";
import ThemeToggle from "@/components/ui/ThemeToggle";
import LanguageSelector from "@/components/ui/LanguageSelector";
import toast from "react-hot-toast";
import { logoutCurrentTab } from "@/lib/client-session";
import { useI18n } from "@/lib/i18n";

interface HeaderProps {
  userName?: string;
  userRole?: string;
  userEmail?: string;
  joinCode?: string;
  onMenuToggle?: () => void;
}

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

const roleBadgeColors: Record<string, string> = {
  chairman: "text-primary",
  secretary: "text-primary",
  treasurer: "text-primary",
  member: "text-[#CC9900]",
  tenant: "text-[#CC9900]",
  guard: "text-[#FF5400]",
  watchman: "text-[#FF5400]",
  vendor_staff: "text-[#808080]",
  facility_manager: "text-[#808080]",
};

export default function Header({
  userName = "Admin",
  userRole = "chairman",
  userEmail = "",
  joinCode,
  onMenuToggle,
}: HeaderProps) {
  const [showProfile, setShowProfile] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { t } = useI18n();
  const { user } = useUser();
  const { open: paletteOpen, setOpen: setPaletteOpen } = useCommandPalette();
  const personaNav = usePersonaNav(
    user.societyId
      ? { subject: user.id || user.email || "user", societyId: user.societyId, role: userRole }
      : null,
  );
  const personaLabel = roleLabels[userRole] || (personaNav ? getPersonaLabel(personaNav.persona) : userRole);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowProfile(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => {
    try {
      await logoutCurrentTab();
    } catch { /* ignore */ }
    clearRecentActions();
    router.push("/login");
    router.refresh();
  };

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const canShareJoinCode = ["chairman", "secretary"].includes(userRole) && !!joinCode;

  const copyJoinCode = () => {
    if (!joinCode) return;
    navigator.clipboard.writeText(joinCode);
    toast.success("Join code copied");
  };

  return (
    <>
    <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    <header className="sticky top-0 z-30 border-b border-[#E6E6E6] bg-[#FEFDDF] dark:border-[#404040] dark:bg-[#171717]">
      <div className="lg:hidden px-2 py-2">
        <div className="flex min-h-[48px] items-center justify-between gap-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <Image
              src="/logo.png"
              alt="ReManage"
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 rounded-xl"
              priority
            />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-black tracking-tight text-text-primary">
                {t("ReManage")}
              </h1>
              <p className="truncate text-[9px] font-black uppercase tracking-[0.14em] text-text-secondary">
                {t(personaLabel)}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E6E6E6] bg-white text-text-primary active:scale-95 dark:border-[#404040] dark:bg-[#222222]"
              aria-label={t("Search")}
            >
              <Search className="h-4 w-4" />
            </button>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E6E6E6] bg-white dark:border-[#404040] dark:bg-[#222222]">
              <ThemeToggle compact />
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E6E6E6] bg-white dark:border-[#404040] dark:bg-[#222222]">
              <LanguageSelector compact />
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E6E6E6] bg-white dark:border-[#404040] dark:bg-[#222222]">
              <NotificationCenter compact />
            </div>
            <button
              onClick={onMenuToggle}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E6E6E6] bg-white text-text-primary active:scale-95 dark:border-[#404040] dark:bg-[#222222]"
              aria-label={t("Open menu")}
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
        </div>

        {canShareJoinCode && (
          <button
            type="button"
            onClick={copyJoinCode}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-[#FF5400]/20 bg-[#FFEEE5] px-3 py-1.5 text-[#FF5400]"
            title={t("Copy society join code")}
          >
            <span className="text-[9px] font-black uppercase tracking-widest text-primary/70">
              {t("Join Code")}
            </span>
            <span className="truncate font-mono text-xs font-black tracking-widest">
              {joinCode}
            </span>
            <Copy className="h-3.5 w-3.5 shrink-0" />
          </button>
        )}
      </div>

      <div className="hidden h-14 items-center justify-between px-4 lg:flex">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-sm font-bold text-text-secondary">
              {t("ReManage")}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="hidden min-h-10 items-center gap-2 rounded-xl border border-[#E6E6E6] bg-white px-3 text-sm font-semibold text-text-secondary hover:text-text-primary dark:border-[#404040] dark:bg-[#222222] lg:inline-flex"
          >
            <Search className="h-4 w-4" />
            <span>{t("Search")}</span>
            <span className="rounded-md bg-surface px-1.5 py-0.5 text-[10px] font-black">Ctrl K</span>
          </button>
          {canShareJoinCode && (
            <button
              type="button"
              onClick={copyJoinCode}
              className="hidden items-center gap-2 rounded-xl border border-[#FF5400]/20 bg-[#FFEEE5] px-3 py-1.5 text-[#FF5400] transition-colors hover:bg-[#FFDDCC] md:flex"
              title={t("Copy society join code")}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary/70">
                {t("Join Code")}
              </span>
              <span className="font-mono text-sm font-black tracking-widest">
                {joinCode}
              </span>
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}
          <LanguageSelector />
          <ThemeToggle />
          <NotificationCenter />

          {/* Profile Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowProfile(!showProfile)}
            className="flex cursor-pointer items-center gap-2.5 rounded-xl border-l border-[#E6E6E6] px-2 py-1.5 pl-3 transition-colors hover:bg-[#E6E6E6]/40 dark:border-[#404040] dark:hover:bg-[#222222]"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FF5400]">
                <span className="text-white text-xs font-bold">{initials}</span>
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-semibold text-text-primary leading-tight">{userName}</p>
                <p className="text-[10px] text-text-tertiary capitalize">{t(personaLabel)}</p>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-text-tertiary hidden sm:block transition-transform ${showProfile ? "rotate-180" : ""}`} />
            </button>

            {showProfile && (
              <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-[#E6E6E6] bg-white animate-in fade-in zoom-in-95 duration-150 dark:border-[#404040] dark:bg-[#222222]">
                {/* Profile Info */}
                <div className="border-b border-[#E6E6E6]/60 bg-[#FEFDDF] p-3 dark:border-[#404040] dark:bg-[#171717]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF5400]">
                      <span className="text-white text-sm font-bold">{initials}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-text-primary truncate">{userName}</p>
                      <p className="text-[10px] text-text-tertiary truncate">{userEmail}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Shield className={`w-3 h-3 ${roleBadgeColors[userRole] || "text-primary"}`} />
                        <span className={`text-[9px] font-bold uppercase ${roleBadgeColors[userRole] || "text-primary"}`}>{t(personaLabel)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="p-1.5">
                  <button
                    onClick={() => { setShowProfile(false); router.push("/profile"); }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-text-primary transition-colors hover:bg-[#FEFDDF] dark:hover:bg-[#171717]"
                  >
                    <User className="w-4 h-4 text-text-tertiary" /> {t("My Profile")}
                  </button>
                  {userRole === "chairman" && (
                    <button
                      onClick={() => { setShowProfile(false); router.push("/settings"); }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-text-primary transition-colors hover:bg-[#FEFDDF] dark:hover:bg-[#171717]"
                    >
                      <Settings className="w-4 h-4 text-text-tertiary" /> {t("Society Settings")}
                    </button>
                  )}
                  <div className="my-1.5 border-t border-border/30" />
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[#993300] transition-colors hover:bg-[#FFEEE5] dark:text-[#FF9966] dark:hover:bg-[#2A2A2A]"
                  >
                    <LogOut className="w-4 h-4" /> {t("Sign Out")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
    </>
  );
}
