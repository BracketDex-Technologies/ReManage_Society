# Privileged MFA Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish verified, session-scoped MFA for privileged users so management navigation and APIs are available only after a real MFA verification.

**Architecture:** Add encrypted TOTP enrollment to the user record and a short-lived pending-MFA challenge. The password login flow issues that challenge for privileged users; verification mints a signed application session with MFA evidence. The existing permission policy and navigation bridge consume that evidence unchanged, while the user-context exposes it to every navigation surface.

**Tech Stack:** Next.js 16 route handlers, React 19, Prisma, `otpauth`, `qrcode`, `jose`, Vitest.

---

## File structure

- Create: `src/lib/mfa/totp.ts` — encryption, TOTP generation, verification, and privileged-role helpers.
- Create: `src/lib/mfa/totp.test.ts` — unit contract for secret encryption and code verification.
- Create: `src/app/api/auth/mfa/enroll/route.ts` — authenticated enrollment setup and confirmation.
- Create: `src/app/api/auth/mfa/verify/route.ts` — rate-limited pending-login challenge verification.
- Create: `src/app/(auth)/mfa/page.tsx` — MFA challenge screen.
- Modify: `prisma/schema.prisma` — encrypted TOTP fields and enrollment timestamp.
- Modify: `src/lib/session.ts`, `src/lib/auth.ts`, `src/lib/rate-limit.ts` — pending and verified session claims plus MFA limiter.
- Modify: `src/app/api/auth/login/route.ts`, `src/app/api/auth/me/route.ts`, `src/app/api/auth/callback/route.ts` — trusted MFA creation and exposure.
- Modify: `src/lib/user-context.tsx`, `src/components/layout/{Sidebar,Header,BottomNav,GuardRedirect}.tsx`, `src/app/(dashboard)/profile/page.tsx` — propagate MFA state into navigation.
- Modify: `src/lib/navigation/legacy-role-bridge.test.ts`, `src/lib/navigation/use-persona-nav.test.ts`, and auth route tests — regression coverage.

### Task 1: Create the TOTP domain contract

**Files:**
- Create: `src/lib/mfa/totp.ts`
- Create: `src/lib/mfa/totp.test.ts`
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Write failing unit tests for encrypted secrets and MFA codes**

```ts
expect(encryptTotpSecret("BASE32SECRET")).not.toContain("BASE32SECRET");
expect(decryptTotpSecret(encryptTotpSecret("BASE32SECRET"))).toBe("BASE32SECRET");
expect(verifyTotp(secret, currentCode)).toBe(true);
expect(verifyTotp(secret, "000000")).toBe(false);
expect(requiresMfa("chairman")).toBe(true);
expect(requiresMfa("member")).toBe(false);
```

- [ ] **Step 2: Run the targeted test and confirm it fails because the module is absent**

Run: `npm exec vitest run src/lib/mfa/totp.test.ts`

- [ ] **Step 3: Install the audited TOTP library and implement the small domain module**

Run: `npm install otpauth`

The module must use AES-256-GCM with `MFA_ENCRYPTION_KEY`, `OTPAuth.TOTP` using SHA-1, six digits, and a 30-second period, and accept one adjacent time window. It must return `false` for missing/invalid codes and never log a secret or code.

- [ ] **Step 4: Re-run the targeted test**

Run: `npm exec vitest run src/lib/mfa/totp.test.ts`

Expected: PASS.

### Task 2: Persist enrollment and issue safe session claims

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/lib/session.ts`
- Modify: `src/lib/auth.ts`
- Test: `src/lib/mfa/totp.test.ts`

- [ ] **Step 1: Add failing tests for pending and verified session claims**

```ts
expect(await decryptSession(await createMfaPendingSession(user))).toMatchObject({
  userId: user.id,
  mfaPending: true,
  mfaVerified: false,
});
expect(await decryptSession(await createSession(user, { mfaVerified: true }))).toMatchObject({
  mfaVerified: true,
  mfaVerifiedAt: expect.any(String),
});
```

- [ ] **Step 2: Add user enrollment fields and session claim support**

Add `mfaTotpSecretEncrypted String?` and `mfaEnrolledAt DateTime?` to `User`. Add `mfaPending`, `mfaVerified`, and `mfaVerifiedAt` claims to `SessionPayload`. Pending tokens must expire in five minutes and must not be accepted by normal APIs.

- [ ] **Step 3: Generate and validate Prisma artifacts, then run focused tests**

Run: `npm run db:generate && npm run db:validate && npm exec vitest run src/lib/mfa/totp.test.ts`

Expected: PASS.

### Task 3: Add enrollment and step-up verification routes

**Files:**
- Create: `src/app/api/auth/mfa/enroll/route.ts`
- Create: `src/app/api/auth/mfa/verify/route.ts`
- Modify: `src/lib/rate-limit.ts`
- Modify: `src/app/api/auth/login/route.ts`
- Test: route-level Vitest tests beside the route handlers

- [ ] **Step 1: Write failing API tests**

```ts
expect(response.status).toBe(401); // enrollment without a signed session
expect(response.status).toBe(400); // invalid TOTP confirmation
expect(response.status).toBe(429); // sixth failed MFA attempt in five minutes
expect(verified.body.sessionToken).toBeDefined();
expect((await decryptSession(verified.body.sessionToken)).mfaVerified).toBe(true);
```

- [ ] **Step 2: Implement enrollment**

`POST /api/auth/mfa/enroll` creates a secret and returns an otpauth URI plus QR data only after password/session authentication. `PATCH` accepts a code, verifies it before persisting the encrypted secret and enrollment timestamp, and invalidates the one-time pending enrollment secret on failure or completion.

- [ ] **Step 3: Implement the pending-login verifier**

Password login returns `{ mfaRequired: true, mfaChallengeToken }` for enrolled privileged roles. `POST /api/auth/mfa/verify` accepts only that signed, unexpired challenge token and a TOTP code, applies a five-attempt/five-minute user-plus-IP limiter, and returns a new MFA-verified session token.

- [ ] **Step 4: Run route tests**

Run: `npm exec vitest run src/app/api/auth/mfa src/lib/mfa/totp.test.ts`

Expected: PASS.

### Task 4: Propagate verified MFA to authorization and navigation

**Files:**
- Modify: `src/app/api/auth/me/route.ts`
- Modify: `src/lib/user-context.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/Header.tsx`
- Modify: `src/components/layout/BottomNav.tsx`
- Modify: `src/components/layout/GuardRedirect.tsx`
- Modify: `src/app/(dashboard)/profile/page.tsx`
- Test: `src/lib/navigation/legacy-role-bridge.test.ts`

- [ ] **Step 1: Write the failing chairman-navigation regression test**

```ts
const unverified = buildPersonaNavigation({ subject: "chair", societyId: "soc", role: "chairman", mfaVerified: false });
expect(managementHrefs(unverified)).toEqual(["/reminders"]);
const verified = buildPersonaNavigation({ subject: "chair", societyId: "soc", role: "chairman", mfaVerified: true });
expect(managementHrefs(verified)).toEqual(expect.arrayContaining([
  "/members", "/tenants", "/move-events", "/vendors", "/assets", "/reminders", "/credentials", "/activity-log", "/settings",
]));
```

- [ ] **Step 2: Return and consume the session claim**

`/api/auth/me` returns `mfaVerified: session.mfaVerified === true`. `UserSession` retains that boolean. Every `usePersonaNav` call passes `mfaVerified: user.mfaVerified`; no client request may set it independently.

- [ ] **Step 3: Run permission and navigation tests with production-equivalent MFA enforcement**

Run: `$env:MFA_ENFORCEMENT_ENABLED='true'; npm run test:unit -- packages/security/src/permission-policy.test.ts src/lib/navigation/legacy-role-bridge.test.ts packages/ux-core/src/ux-core.test.ts`

Expected: PASS.

### Task 5: Add the user-facing step-up flow and verify the app

**Files:**
- Create: `src/app/(auth)/mfa/page.tsx`
- Modify: `src/app/(auth)/login/LoginForm.tsx`
- Modify: `src/app/auth/complete/AuthCompleteClient.tsx`
- Test: `src/app/(auth)/auth-control-contract.test.ts`

- [ ] **Step 1: Write a failing client contract test**

```ts
expect(loginSource).toContain('mfaRequired');
expect(loginSource).toContain('router.push("/mfa")');
expect(mfaPageSource).toContain('Verification code');
expect(mfaPageSource).toContain('/api/auth/mfa/verify');
```

- [ ] **Step 2: Implement the minimal MFA challenge screen**

The screen reads the pending challenge from session storage, accepts a six-digit numeric code, posts it to the verifier, stores only the returned signed session token through the existing tab-session helper, and redirects to `/dashboard`. It displays server errors without revealing secret or verification details.

- [ ] **Step 3: Run focused UI contracts, typecheck, and runtime smoke test**

Run: `npm exec vitest run src/app/(auth)/auth-control-contract.test.ts && npm run typecheck`

Then verify `http://localhost:3000/login` and the MFA screen in the Browser: page identity, nonblank UI, no framework overlay, no relevant console errors, and valid challenge interaction.

### Task 6: Final verification and handoff

**Files:**
- Modify: none

- [ ] **Step 1: Run complete focused verification**

Run: `npm run db:validate && npm run typecheck && $env:MFA_ENFORCEMENT_ENABLED='true'; npm run test:unit -- src/lib/mfa src/app/api/auth/mfa src/lib/navigation/legacy-role-bridge.test.ts packages/security/src/permission-policy.test.ts packages/ux-core/src/ux-core.test.ts`

Expected: all commands exit 0.

- [ ] **Step 2: Review the diff and existing user changes before staging**

Run: `git status --short && git diff --check`

Expected: only intended MFA changes are staged; pre-existing login-form and auth-contract edits are preserved unless explicitly integrated.
