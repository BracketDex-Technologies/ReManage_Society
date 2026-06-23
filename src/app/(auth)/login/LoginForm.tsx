"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import toast from "react-hot-toast";
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { setTabSessionToken } from "@/lib/client-session";
import { getDefaultRoute } from "@/lib/role-access";

export default function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");

  useEffect(() => {
    const path = window.location.pathname;
    if (path !== "/login") {
      window.location.replace(`/login${window.location.search}`);
    }
  }, []);

  useEffect(() => {
    const error = searchParams.get("error");
    if (!error) return;

    const messages: Record<string, string> = {
      access_denied: t("accessDenied"),
      invalid_credentials: t("invalidCredentials"),
      missing_fields: t("missingFields"),
      rate_limited: t("rateLimited"),
      server_error: t("serverError"),
    };

    toast.error(messages[error] || t("signInError", { error }));
  }, [searchParams, t]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    const form = event.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || t("invalidCredentials"));
        return;
      }

      if (data.expired) {
        if (data.sessionToken) setTabSessionToken(data.sessionToken);
        router.push("/expired");
        return;
      }

      if (!data.sessionToken) {
        toast.error(t("serverError"));
        return;
      }

      setTabSessionToken(data.sessionToken);
      router.push(getDefaultRoute(data.user?.role || "member"));
    } catch {
      toast.error(t("serverError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Image
            src="/logo.png"
            alt={tCommon("ReManage")}
            width={56}
            height={56}
            className="mx-auto mb-4 h-14 w-14 rounded-2xl"
            priority
          />
          <h1 className="text-2xl font-bold text-text-primary">{tCommon("ReManage")}</h1>
          <p className="text-sm text-text-secondary mt-1">{t("societySubtitle")}</p>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-text-primary mb-6">{t("signInTitle")}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email" className="label">{t("emailLabel")}</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                autoFocus
                className="input"
                placeholder={t("emailPlaceholder")}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="label">{t("passwordLabel")}</label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="input pr-10"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="input-icon-button absolute right-2 top-1/2 -translate-y-1/2"
                  aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={submitting} className="btn btn-primary w-full btn-lg mt-2">
              {submitting ? t("signIn") + "..." : t("signIn")}
            </button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-sm text-text-secondary">
              {t("noAccount")}{" "}
              <Link href="/join" className="text-primary font-medium hover:underline">
                {t("joinSociety")}
              </Link>
            </p>

            <p className="text-sm text-text-secondary mt-2">
              {tCommon("Chairman")}?{" "}
              <Link href="/register" className="text-primary font-medium hover:underline">
                {t("createSociety")}
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-text-secondary">
            Powered by{" "}
            <a href="https://www.BracketDexTechnologies.in" target="_blank" className="text-primary hover:underline">
              BracketDexTechnologies.in
            </a>{" "}
          </p>
        </div>
      </div>
    </div>
  );
}
