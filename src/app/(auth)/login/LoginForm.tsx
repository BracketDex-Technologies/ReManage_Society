"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import toast from "react-hot-toast";
import { Eye, EyeOff, Shield } from "lucide-react";
import { useTranslations } from "next-intl";

interface LoginFormProps {
  keycloakEnabled: boolean;
}

export default function LoginForm({ keycloakEnabled }: LoginFormProps) {
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
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
      OIDC_EXCHANGE_FAILED: t("oidcExchangeFailed"),
      keycloak_unavailable: t("keycloakUnavailable"),
      access_denied: t("accessDenied"),
      invalid_credentials: t("invalidCredentials"),
      missing_fields: t("missingFields"),
      rate_limited: t("rateLimited"),
      server_error: t("serverError"),
    };

    toast.error(messages[error] || t("signInError", { error }));
  }, [searchParams, t]);

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
          <form
            method="POST"
            action="/api/auth/login"
            encType="application/x-www-form-urlencoded"
          >
            <input type="hidden" name="redirect" value="1" />
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                  aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary w-full btn-lg mt-2">
              {t("signIn")}
            </button>
          </form>

          {keycloakEnabled ? (
            <>
              <div className="my-6 flex items-center justify-center space-x-4">
                <div className="h-px bg-border/50 w-full" />
                <span className="text-xs text-text-tertiary uppercase font-bold tracking-wider">OR</span>
                <div className="h-px bg-border/50 w-full" />
              </div>

              <a
                href="/api/auth/login"
                className="btn btn-secondary w-full btn-lg flex items-center justify-center gap-2"
              >
                <Shield className="w-5 h-5 text-primary" />
                {t("signInWithKeycloak")}
              </a>
            </>
          ) : null}

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
            <a href="https://www.buzyhub.in" target="_blank" className="text-primary hover:underline">
              Buzyhub.in
            </a>{" "}
            | Pramod Ranpise
          </p>
        </div>
      </div>
    </div>
  );
}
