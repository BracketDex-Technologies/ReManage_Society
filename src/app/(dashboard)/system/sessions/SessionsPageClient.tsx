"use client";

import { format } from "date-fns";
import {
  Monitor,
  Smartphone,
  Globe,
  MapPin,
  Clock,
  ShieldCheck,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

export interface SessionRow {
  id: string;
  token: string;
  os: string | null;
  browser: string | null;
  ipAddress: string | null;
  city: string | null;
  country: string | null;
  createdAt: string;
  user: { name: string; role: string };
}

interface SessionsPageClientProps {
  sessions: SessionRow[];
  currentToken?: string;
  isMember: boolean;
  revokeSession: (formData: FormData) => void;
}

export default function SessionsPageClient({
  sessions,
  currentToken,
  isMember,
  revokeSession,
}: SessionsPageClientProps) {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <ShieldCheck className="w-8 h-8 text-indigo-500" />
              <h1 className="text-3xl font-bold text-slate-800 dark:text-whiteTracking-tight">
                {t("Security & Sessions")}
              </h1>
            </div>
            <p className="text-slate-500 dark:text-slate-400">
              {t("Manage devices currently logged into your account.")}
            </p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-3 max-w-xs">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t("If you see any unrecognized activity, revoke the session immediately and change your password.")}
            </p>
          </div>
        </header>

        <div className="grid gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
              <h2 className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <Monitor className="w-4 h-4" />
                {t("Active Devices")} ({sessions.length})
              </h2>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {sessions.length === 0 ? (
                <div className="p-12 text-center">
                  <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">{t("No active sessions found.")}</p>
                </div>
              ) : (
                sessions.map((sess) => {
                  const isCurrent = sess.token === currentToken;
                  return (
                    <div
                      key={sess.id}
                      className={`p-6 flex flex-wrap items-center justify-between gap-6 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-700/30 ${
                        isCurrent ? "bg-indigo-50/30 dark:bg-indigo-900/10" : ""
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            isCurrent
                              ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                              : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          {sess.os === "Android" || sess.os === "iOS" ? (
                            <Smartphone className="w-6 h-6" />
                          ) : (
                            <Monitor className="w-6 h-6" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                              {sess.os} • {sess.browser}
                            </h3>
                            {!isMember && (
                              <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600">
                                {t("User")}: {sess.user.name} ({sess.user.role})
                              </span>
                            )}
                            {isCurrent && (
                              <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border border-indigo-200 dark:border-indigo-800">
                                {t("This Device")}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400 mt-1">
                            <span className="flex items-center gap-1.5 capitalize">
                              <Globe className="w-3.5 h-3.5 opacity-70" />
                              {sess.ipAddress}
                            </span>
                            <span className="flex items-center gap-1.5 capitalize">
                              <MapPin className="w-3.5 h-3.5 opacity-70" />
                              {sess.city}, {sess.country}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-2">
                            <Clock className="w-3.5 h-3.5 opacity-70" />
                            {t("Active since")} {format(new Date(sess.createdAt), "MMM d, yyyy")}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:items-end gap-3 w-full sm:w-auto">
                        {!isCurrent ? (
                          <form action={revokeSession}>
                            <input type="hidden" name="token" value={sess.token} />
                            <button
                              type="submit"
                              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:text-white border border-red-200 dark:border-red-900/50 hover:bg-red-600 dark:hover:bg-red-700 rounded-lg transition-all"
                            >
                              <XCircle className="w-4 h-4" />
                              {t("Revoke Access")}
                            </button>
                          </form>
                        ) : (
                          <div className="text-right">
                            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest block mb-1">
                              {t("Last Active")}
                            </span>
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                              {t("Just now")}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <footer className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-slate-400">
          <p>{t("© 2026 Internal Security Dashboard")}</p>
          <div className="flex items-center gap-6">
            <a href="/dashboard" className="text-indigo-500 hover:text-indigo-600 font-semibold flex items-center gap-1">
              {t("Go to Dashboard")}
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
