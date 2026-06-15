"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Building2, Eye, EyeOff, Shield } from "lucide-react";

interface LoginFormProps {
  keycloakEnabled: boolean;
}

export default function LoginForm({ keycloakEnabled }: LoginFormProps) {
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);

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
      OIDC_EXCHANGE_FAILED: "Keycloak sign-in failed. Check client secret and redirect URI.",
      keycloak_unavailable: "Keycloak is not available on this environment. Use email and password.",
      access_denied: "Keycloak sign-in was cancelled.",
      invalid_credentials: "Invalid email or password.",
      missing_fields: "Email and password are required.",
      rate_limited: "Too many login attempts. Please wait 1 minute.",
      server_error: "Login failed. Please try again.",
    };

    toast.error(messages[error] || `Sign-in error: ${error}`);
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4" data-no-translate>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">SmartSocietyHub</h1>
          <p className="text-sm text-text-secondary mt-1">
            Smart society living, billing, security & community
          </p>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-text-primary mb-6">Sign in to your account</h2>
          <form
            method="POST"
            action="/api/auth/login"
            encType="application/x-www-form-urlencoded"
          >
            <input type="hidden" name="redirect" value="1" />
            <div className="form-group">
              <label htmlFor="email" className="label">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                autoFocus
                className="input"
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="label">
                Password
              </label>
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
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary w-full btn-lg mt-2">
              Sign In
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
                Sign in with Keycloak
              </a>
            </>
          ) : null}

          <div className="mt-4 text-center">
            <p className="text-sm text-text-secondary">
              Don&apos;t have an account?{" "}
              <Link href="/join" className="text-primary font-medium hover:underline">
                Join Society
              </Link>
            </p>

            <p className="text-sm text-text-secondary mt-2">
              Chairman?{" "}
              <Link href="/register" className="text-primary font-medium hover:underline">
                Create Society
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
