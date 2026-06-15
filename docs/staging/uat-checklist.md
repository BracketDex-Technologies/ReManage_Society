# Staging UAT Checklist

Sign-off before release-candidate promotion. Mark pass/fail per persona.

## Committee

- [ ] Login and land on committee dashboard
- [ ] Publish notice
- [ ] Assign complaint
- [ ] View collections snapshot
- [ ] MFA prompt on document upload (privileged)

## Treasurer

- [ ] View maintenance bills / collections
- [ ] Trial balance or finance report loads
- [ ] MFA required for finance manage action

## Resident

- [ ] View my bills
- [ ] Approve/reject visitor
- [ ] Raise complaint
- [ ] Cast poll vote (single vote enforced)

## Guard

- [ ] Gate visitors list (mobile viewport)
- [ ] Log visitor / package intake
- [ ] SOS raise

## Platform admin

- [ ] System health placeholders visible
- [ ] Cross-tenant negative test (403)

## Cross-cutting

- [ ] Push subscribe works or returns graceful 503 without VAPID
- [ ] Command palette search (Ctrl/Cmd+K)
- [ ] PWA manifest loads
- [ ] Playwright a11y smoke — zero critical violations
- [ ] Backup restore drill recorded

## Sign-off

| Role | Name | Date | Pass |
|---|---|---|---|
| Product owner | | | |
| Engineering | | | |
| Ops | | | |
