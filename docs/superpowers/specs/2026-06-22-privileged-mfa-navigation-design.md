# Privileged MFA and Management Navigation Design

## Goal

Allow verified chairmen and other privileged users to access the existing management navigation and APIs in production without weakening MFA enforcement. Unverified privileged users must remain unable to access MFA-protected actions.

## Scope

The implementation supports two trusted authentication paths:

1. Password users complete an application-managed TOTP step-up challenge before receiving an MFA-verified session.
2. Keycloak users receive the same state only when a verified ID-token claim proves MFA through `amr` or `acr`.

The MFA result is session-scoped. It must never be inferred from a role, accepted from the browser, or saved as a permanent user flag.

## Authentication and Session Contract

- Add MFA enrollment data for users who can perform MFA-protected actions. TOTP secrets are stored encrypted, alongside enrollment metadata.
- Password login with a privileged role returns a short-lived pending-MFA session/challenge instead of a fully privileged session.
- The MFA verification endpoint validates the one-time code, enforces attempt limits, and creates a normal application session containing `mfaVerified: true` plus a bounded verification timestamp.
- Standard sessions continue to carry `mfaVerified: false` unless established by a trusted verifier.
- The Keycloak callback validates the ID token before reading claims. A verified `acr`/`amr` MFA signal sets the same session claim; otherwise the user enters the application step-up flow.

## Authorization and Navigation

- `evaluatePermission` remains the single enforcement point for MFA-required actions.
- `/api/auth/me` returns the session's MFA status, not a database-derived substitute.
- `UserSession` stores that status and every `usePersonaNav` caller passes it to the navigation bridge.
- The existing navigation catalog remains permission-driven. A chairman maps to `society_admin`, which already has the Settings permission; links appear only after verified MFA.
- Direct route/API requests continue to be authorized from the signed session. An unverified privileged user receives a clear MFA-required response rather than a partial page that fails silently.

## Security Requirements

- Do not remove entries from `MFA_REQUIRED_ACTIONS` as part of this work.
- Do not set `mfaVerified` based on a legacy role or client-provided request field.
- Use constant-time TOTP verification, encrypted secret storage, recovery-safe enrollment confirmation, and rate limits for verification attempts.
- Revalidate OIDC issuer, audience, signature, expiry, nonce/state, and MFA claims before trusting them.
- Expire step-up state with the application session and clear it on logout.

## Tests and Acceptance Criteria

- With MFA enforcement enabled, an unverified chairman's MANAGEMENT section contains only Smart Nudges; protected APIs return 403.
- A verified chairman sees Residents, Tenants, Move In / Out, Vendor Hub, Asset Register, Smart Nudges, Access Control, Audit Trail, and Settings; corresponding APIs are allowed.
- A secretary remains unable to see Settings unless the product policy later grants that role `society:settings.manage`.
- Password and OIDC sessions cannot claim MFA without passing their respective trusted verifier.
- Tests explicitly enable MFA enforcement so development defaults cannot make authorization tests nondeterministic.

## Non-goals

- Changing the committee/settings permission policy.
- Disabling MFA enforcement in production.
- Redesigning existing management pages.
