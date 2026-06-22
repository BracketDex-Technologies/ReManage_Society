"use client";

import Image from "next/image";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import {
  clearMfaChallengeToken,
  getMfaChallengeToken,
  setTabSessionToken,
} from "@/lib/client-session";

function MfaPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const enrollmentRequired = searchParams.get("enroll") === "1";
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const tokenFromQuery = searchParams.get("token");
    const token = tokenFromQuery || getMfaChallengeToken();
    if (!token) {
      router.replace("/login?error=missing_mfa_challenge");
      return;
    }

    setChallengeToken(token);
    if (!enrollmentRequired) return;

    fetch("/api/auth/mfa/enroll", { method: "POST", headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => ({ response, body: await response.json() }))
      .then(({ response, body }) => {
        if (!response.ok) throw new Error(body.error || "Could not start MFA enrollment.");
        setQrCode(body.qrCode);
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Could not start MFA enrollment."));
  }, [enrollmentRequired, router, searchParams]);

  const completeMfa = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!challengeToken || !/^\d{6}$/.test(code)) {
      toast.error("Enter the six-digit code from your authenticator app.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(enrollmentRequired ? "/api/auth/mfa/enroll" : "/api/auth/mfa/verify", {
        method: enrollmentRequired ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${challengeToken}` },
        body: JSON.stringify({ code }),
      });
      const body = await response.json();
      if (!response.ok || !body.sessionToken) {
        toast.error(body.error || "Could not verify the MFA code.");
        return;
      }

      setTabSessionToken(body.sessionToken);
      clearMfaChallengeToken();
      router.replace("/dashboard");
    } catch {
      toast.error("Could not verify the MFA code.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4">
      <section className="card w-full max-w-md">
        <div className="mb-6 text-center">
          <Image src="/logo.png" alt="ReManage" width={56} height={56} className="mx-auto mb-4 h-14 w-14 rounded-2xl" priority />
          <h1 className="text-xl font-bold text-text-primary">{enrollmentRequired ? "Set up multi-factor authentication" : "Verify your identity"}</h1>
          <p className="mt-2 text-sm text-text-secondary">{enrollmentRequired ? "Scan this QR code with an authenticator app, then enter its six-digit code." : "Enter the six-digit code from your authenticator app."}</p>
        </div>

        {enrollmentRequired && (qrCode ? <img src={qrCode} alt="MFA setup QR code" className="mx-auto mb-6 h-56 w-56 rounded-xl bg-white p-3" /> : <div className="spinner mx-auto mb-6 !h-8 !w-8" />)}

        <form onSubmit={completeMfa}>
          <label htmlFor="mfa-code" className="label">Verification code</label>
          <input
            id="mfa-code"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            className="input text-center text-xl tracking-[0.4em]"
            placeholder="000000"
            maxLength={6}
            required
            autoFocus
          />
          <button type="submit" disabled={submitting || (enrollmentRequired && !qrCode)} className="btn btn-primary btn-lg mt-5 w-full">
            {submitting ? "Verifying..." : "Continue"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default function MfaPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-surface">
          <div className="spinner !h-8 !w-8" />
        </main>
      }
    >
      <MfaPageContent />
    </Suspense>
  );
}
