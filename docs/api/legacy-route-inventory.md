# Legacy Next.js API Route Inventory

Generated: 2026-06-07

Total route files: **88**

| Legacy route | Disposition | NestJS equivalent | Source file |
|---|---|---|---|
| `/api/accounting/chart-of-accounts` | shim-to-nest | POST /api/v1/finance-core/* | `src/app/api/accounting/chart-of-accounts/route.ts` |
| `/api/accounting/journal-vouchers` | shim-to-nest | POST /api/v1/finance-core/* | `src/app/api/accounting/journal-vouchers/route.ts` |
| `/api/accounting/reports/trial-balance` | shim-to-nest | POST /api/v1/finance-core/* | `src/app/api/accounting/reports/trial-balance/route.ts` |
| `/api/activity-log` | keep-bff | — | `src/app/api/activity-log/route.ts` |
| `/api/assets/[id]` | shim-to-nest | POST /api/v1/operations/assets/* | `src/app/api/assets/[id]/route.ts` |
| `/api/assets` | shim-to-nest | POST /api/v1/operations/assets/* | `src/app/api/assets/route.ts` |
| `/api/auth/join` | keep-bff | — | `src/app/api/auth/join/route.ts` |
| `/api/auth/login` | keep-bff | — | `src/app/api/auth/login/route.ts` |
| `/api/auth/logout` | keep-bff | — | `src/app/api/auth/logout/route.ts` |
| `/api/auth/me` | keep-bff | — | `src/app/api/auth/me/route.ts` |
| `/api/auth/register` | keep-bff | — | `src/app/api/auth/register/route.ts` |
| `/api/blacklist` | shim-to-nest | POST /api/v1/operations/blacklist/* | `src/app/api/blacklist/route.ts` |
| `/api/budgets` | shim-to-nest | POST /api/v1/finance-core/* | `src/app/api/budgets/route.ts` |
| `/api/complaints/[id]` | shim-to-nest | POST /api/v1/community/helpdesk/* | `src/app/api/complaints/[id]/route.ts` |
| `/api/complaints/public` | shim-to-nest | POST /api/v1/community/helpdesk/* | `src/app/api/complaints/public/route.ts` |
| `/api/complaints` | shim-to-nest | POST /api/v1/community/helpdesk/* | `src/app/api/complaints/route.ts` |
| `/api/credentials` | shim-to-nest | POST /api/v1/society-core/credentials/issue | `src/app/api/credentials/route.ts` |
| `/api/dashboard/analytics` | keep-bff | — | `src/app/api/dashboard/analytics/route.ts` |
| `/api/dashboard` | keep-bff | — | `src/app/api/dashboard/route.ts` |
| `/api/directory` | shim-to-nest | POST /api/v1/society-core/directory/read | `src/app/api/directory/route.ts` |
| `/api/documents/[id]` | shim-to-nest | POST /api/v1/community/documents/* | `src/app/api/documents/[id]/route.ts` |
| `/api/documents` | shim-to-nest | POST /api/v1/community/documents/* | `src/app/api/documents/route.ts` |
| `/api/emergency/[id]` | shim-to-nest | POST /api/v1/operations/sos/* | `src/app/api/emergency/[id]/route.ts` |
| `/api/emergency` | shim-to-nest | POST /api/v1/operations/sos/* | `src/app/api/emergency/route.ts` |
| `/api/emergency/sos` | shim-to-nest | POST /api/v1/operations/sos/* | `src/app/api/emergency/sos/route.ts` |
| `/api/events` | shim-to-nest | POST /api/v1/community/events/* | `src/app/api/events/route.ts` |
| `/api/expenses` | shim-to-nest | POST /api/v1/finance-core/expenses/record | `src/app/api/expenses/route.ts` |
| `/api/facilities/bookings` | shim-to-nest | POST /api/v1/operations/amenities/* | `src/app/api/facilities/bookings/route.ts` |
| `/api/facilities` | shim-to-nest | POST /api/v1/operations/amenities/* | `src/app/api/facilities/route.ts` |
| `/api/forum/[threadId]` | shim-to-nest | POST /api/v1/community/forum/* | `src/app/api/forum/[threadId]/route.ts` |
| `/api/forum` | shim-to-nest | POST /api/v1/community/forum/* | `src/app/api/forum/route.ts` |
| `/api/funds/[id]/transactions` | shim-to-nest | POST /api/v1/finance-core/* | `src/app/api/funds/[id]/transactions/route.ts` |
| `/api/funds` | shim-to-nest | POST /api/v1/finance-core/* | `src/app/api/funds/route.ts` |
| `/api/guard/gate` | shim-to-nest | POST /api/v1/operations/* | `src/app/api/guard/gate/route.ts` |
| `/api/guard/join` | keep-bff | — | `src/app/api/guard/join/route.ts` |
| `/api/guard/login` | keep-bff | — | `src/app/api/guard/login/route.ts` |
| `/api/guard` | shim-to-nest | POST /api/v1/operations/* | `src/app/api/guard/route.ts` |
| `/api/guard/visitors` | shim-to-nest | POST /api/v1/operations/* | `src/app/api/guard/visitors/route.ts` |
| `/api/maintenance/bills/[id]` | shim-to-nest | POST /api/v1/finance-core/* | `src/app/api/maintenance/bills/[id]/route.ts` |
| `/api/maintenance/bills` | shim-to-nest | POST /api/v1/finance-core/* | `src/app/api/maintenance/bills/route.ts` |
| `/api/maintenance/late-fees` | shim-to-nest | POST /api/v1/finance-core/* | `src/app/api/maintenance/late-fees/route.ts` |
| `/api/maintenance/settings` | shim-to-nest | POST /api/v1/finance-core/* | `src/app/api/maintenance/settings/route.ts` |
| `/api/marketplace/[id]` | shim-to-nest | POST /api/v1/community/marketplace/* | `src/app/api/marketplace/[id]/route.ts` |
| `/api/marketplace` | shim-to-nest | POST /api/v1/community/marketplace/* | `src/app/api/marketplace/route.ts` |
| `/api/meetings` | shim-to-nest | POST /api/v1/community/meetings/* | `src/app/api/meetings/route.ts` |
| `/api/members/[id]` | shim-to-nest | POST /api/v1/society-core/directory/read | `src/app/api/members/[id]/route.ts` |
| `/api/members/import` | shim-to-nest | POST /api/v1/society-core/directory/read | `src/app/api/members/import/route.ts` |
| `/api/members` | shim-to-nest | POST /api/v1/society-core/directory/read | `src/app/api/members/route.ts` |
| `/api/mobile/bootstrap` | keep-bff | — | `src/app/api/mobile/bootstrap/route.ts` |
| `/api/move-events` | shim-to-nest | POST /api/v1/society-core/occupancy/* | `src/app/api/move-events/route.ts` |
| `/api/my-bills/[id]/pay` | keep-bff | POST /api/v1/finance-core/* | `src/app/api/my-bills/[id]/pay/route.ts` |
| `/api/my-bills` | keep-bff | POST /api/v1/finance-core/* | `src/app/api/my-bills/route.ts` |
| `/api/my-visitors` | keep-bff | — | `src/app/api/my-visitors/route.ts` |
| `/api/notices/[id]/read` | shim-to-nest | POST /api/v1/community/notices/* | `src/app/api/notices/[id]/read/route.ts` |
| `/api/notices/[id]` | shim-to-nest | POST /api/v1/community/notices/* | `src/app/api/notices/[id]/route.ts` |
| `/api/notices` | shim-to-nest | POST /api/v1/community/notices/* | `src/app/api/notices/route.ts` |
| `/api/notifications` | keep-bff | — | `src/app/api/notifications/route.ts` |
| `/api/packages` | shim-to-nest | POST /api/v1/operations/packages/* | `src/app/api/packages/route.ts` |
| `/api/parking/[id]` | shim-to-nest | POST /api/v1/operations/parking/* | `src/app/api/parking/[id]/route.ts` |
| `/api/parking/marketplace` | shim-to-nest | POST /api/v1/operations/parking/* | `src/app/api/parking/marketplace/route.ts` |
| `/api/parking` | shim-to-nest | POST /api/v1/operations/parking/* | `src/app/api/parking/route.ts` |
| `/api/polls/[id]` | shim-to-nest | POST /api/v1/community/polls/* | `src/app/api/polls/[id]/route.ts` |
| `/api/polls` | shim-to-nest | POST /api/v1/community/polls/* | `src/app/api/polls/route.ts` |
| `/api/push/dispatch` | keep-bff | — | `src/app/api/push/dispatch/route.ts` |
| `/api/push/subscribe` | keep-bff | — | `src/app/api/push/subscribe/route.ts` |
| `/api/receipts/[billId]` | shim-to-nest | POST /api/v1/finance-core/payments/record | `src/app/api/receipts/[billId]/route.ts` |
| `/api/reminders/send` | deprecate-410 | — | `src/app/api/reminders/send/route.ts` |
| `/api/rent-invoices` | shim-to-nest | POST /api/v1/finance-core/invoices/create | `src/app/api/rent-invoices/route.ts` |
| `/api/reports/annual` | shim-to-nest | POST /api/v1/finance-core/reports/* | `src/app/api/reports/annual/route.ts` |
| `/api/reports/financial` | shim-to-nest | POST /api/v1/finance-core/reports/* | `src/app/api/reports/financial/route.ts` |
| `/api/reports/monthly` | shim-to-nest | POST /api/v1/finance-core/reports/* | `src/app/api/reports/monthly/route.ts` |
| `/api/salaries/[id]/pay` | shim-to-nest | POST /api/v1/finance-core/* | `src/app/api/salaries/[id]/pay/route.ts` |
| `/api/salaries` | shim-to-nest | POST /api/v1/finance-core/* | `src/app/api/salaries/route.ts` |
| `/api/search` | keep-bff | — | `src/app/api/search/route.ts` |
| `/api/sessions/heartbeat` | keep-bff | — | `src/app/api/sessions/heartbeat/route.ts` |
| `/api/settings/flats` | keep-bff | — | `src/app/api/settings/flats/route.ts` |
| `/api/societies/join-code` | shim-to-nest | POST /api/v1/society-core/* | `src/app/api/societies/join-code/route.ts` |
| `/api/staff/attendance` | shim-to-nest | POST /api/v1/operations/staff/* | `src/app/api/staff/attendance/route.ts` |
| `/api/staff/payments` | shim-to-nest | POST /api/v1/operations/staff/* | `src/app/api/staff/payments/route.ts` |
| `/api/staff` | shim-to-nest | POST /api/v1/operations/staff/* | `src/app/api/staff/route.ts` |
| `/api/subscription` | keep-bff | — | `src/app/api/subscription/route.ts` |
| `/api/system/sync-bills` | keep-bff | — | `src/app/api/system/sync-bills/route.ts` |
| `/api/tenants` | shim-to-nest | POST /api/v1/society-core/* | `src/app/api/tenants/route.ts` |
| `/api/vendors` | shim-to-nest | POST /api/v1/operations/vendors/* | `src/app/api/vendors/route.ts` |
| `/api/visitors/[id]/qr` | shim-to-nest | POST /api/v1/operations/visitors/* | `src/app/api/visitors/[id]/qr/route.ts` |
| `/api/visitors/[id]` | shim-to-nest | POST /api/v1/operations/visitors/* | `src/app/api/visitors/[id]/route.ts` |
| `/api/visitors/preapprove` | shim-to-nest | POST /api/v1/operations/visitors/* | `src/app/api/visitors/preapprove/route.ts` |
| `/api/visitors` | shim-to-nest | POST /api/v1/operations/visitors/* | `src/app/api/visitors/route.ts` |

Regenerate:

```powershell
node scripts/generate-api-inventory.mjs
```

