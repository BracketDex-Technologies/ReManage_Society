# MyGate vs Our Society SaaS Project - Feature Comparison

Last updated: 13 May 2026

This comparison is based on publicly available MyGate product pages/app listings and the real modules/routes currently present in this repository.

Sources used:
- MyGate society management app: https://mygate.com/society-management-app/
- MyGate apartment management system: https://mygate.com/apartment-management-system/
- MyGate community management: https://mygate.com/community-management/
- MyGate 250+ feature listing: https://mygate.com/offerings
- MyGate App Store listing: https://apps.apple.com/us/app/mygate-premium/id1101762651
- MyGate Google Play listing: https://play.google.com/store/apps/details?id=com.mygate.user
- MyGate FAQs: https://mygate.com/faqs

## Executive Summary

MyGate is a mature production platform covering security, accounting, payments, operations, communication, staff oversight, amenities, documents, marketplace, and compliance reporting at large scale.

Our project already has a strong SaaS foundation and many matching modules:
- multi-society join-code onboarding
- role-based dashboards
- occupancy-aware unit/person/tenant architecture
- gate console
- visitor approval/history
- package tracking
- maintenance billing
- private rent tracking
- resident staff payments
- expenses, funds, budgets, reports
- complaints, notices, polls, meetings, documents
- parking, amenities, marketplace, staff, vendors, assets

The biggest gap is not feature count. The biggest gap is production depth:
- payment gateway reconciliation
- double-entry ledger runtime
- audit-grade finance
- mobile app experience
- scalable notification delivery
- security/compliance hardening
- operational workflows around approvals, escalations, SLAs, and exports

## Status Legend

| Status | Meaning |
|---|---|
| Implemented | Working module exists in repo |
| Partial | Module exists but needs production hardening/deeper workflow |
| Missing | No meaningful runtime implementation yet |
| Planned/Foundation | Schema or page exists, but runtime is early |

## High-Level Comparison

| Area | MyGate Capability | Our Current Capability | Status | Gap / Recommendation |
|---|---|---|---|---|
| Multi-society SaaS | Supports many societies/communities at scale | Society model, join code, society isolation via `societyId` | Partial | Add organization-level subscription, tenant isolation tests, admin console, usage limits |
| Chairman onboarding | Committee/RWA onboarding and society setup | Chairman creates society; join code generated | Implemented | Add society verification/KYC and duplicate prevention workflow |
| Resident onboarding | Resident app onboarding with flat linkage | `/join` creates User, Person, UnitOccupancy | Implemented | Add approval workflow before activation for sensitive societies |
| Unit/flat architecture | Flats, towers, owners, tenants, family | Unit, Person, UnitOccupancy foundation added | Partial | Continue migrating legacy `Flat.ownerName` assumptions |
| Role-based access | Resident, guard, committee, admin controls | Role access helper and role-based sidebar/routes | Partial | Add policy-based permission layer by role + occupancy relationship |
| Visitor management | Visitor approval, gate logs, real-time control | Gate console, visitor entry, approval, direct entry, history | Partial | Add push notifications, QR/pass support, visitor parking, blacklist escalation |
| Guard console | Dedicated guard app/training workflows | `/gate`, guard login/join, visitor/package/staff actions | Implemented | Add guard shift audit, incident reporting depth, offline mode |
| Package/delivery management | Delivery notifications and leave-at-gate flow | Package logging, resident notification, collected status | Partial | Add secure pickup verification, resident collection confirmation, package photo |
| Domestic help | Staff profiles, attendance, ratings, payments | Staff registration, flat links, gate attendance, resident payments | Partial | Add staff verification, ratings, work history, payment reports |
| Society payroll | RWA pays guards/housekeeping/staff | Staff Payroll module with salary payment and expense creation | Partial | Link payroll to staff master, attendance, contracts, approvals |
| Resident staff payments | Residents pay domestic help | Private staff payment flow in My Bills | Partial | Add staff payment reminders, receipts, staff-side acknowledgement |
| Maintenance billing | Auto-generate bills, reminders, receipts | Billing & Ledger, invoice types, due dates, late fee, receipts | Partial | Add payment gateway, reconciliation, arrears, line items, taxes |
| Online payments | UPI/cards/netbanking/wallets, reminders | UPI deep link and UTR confirmation for society bills | Partial | Integrate Razorpay/Easebuzz, webhooks, payment status verification |
| Private rent | MyGate app listing mentions rent/home payments | Private owner-to-tenant rent invoices | Partial | Add owner UPI/bank profile, tenant payment proof, owner confirmation |
| Accounting | Audit-ready reports, Tally reconciliation | Expenses, funds, budgets, reports, ledger foundation schema | Partial | Implement real ledger-entry source of truth and Tally export |
| Expense booking | Vendor expenses, GST/TDS, approvals | Expenses module with categories and CSV export | Partial | Add approval workflow, attachments, GST/TDS fields, vendor payable status |
| Fund management | Reserve/sinking/corpus handling | Fund accounts with credits/debits linked to expenses | Partial | Convert funds into ledger accounts and reconcile balances |
| Budgets | Budget vs actual | Budget Planning derives actuals from expenses/payroll/fund debits | Partial | Add hierarchical budgets, approval, category normalization |
| Financial reports | Collection, P&L, audit reports | Monthly, annual, financial reports | Partial | Make reports ledger-driven; add balance sheet, trial balance, defaulters aging |
| Helpdesk/complaints | SLA/TAT, assignment, escalation | Complaints/helpdesk module and public complaint submit | Partial | Add SLA engine, assignment queues, escalation matrix, attachments |
| Notices/announcements | Official society communication | Notices with read receipts route | Partial | Add delivery reports via email/SMS/WhatsApp |
| Polls/voting | Polls, surveys, election polls | Polls module exists | Partial | Add secret ballot/election-grade controls |
| Meetings | AGM/committee meeting minutes | Meetings module exists | Partial | Add agenda, attendance, resolutions, document export |
| Documents | Society, flat-wise, personal documents | Document Vault module exists | Partial | Add folder permissions, personal/flat document scopes, versioning |
| Amenity booking | Slot booking, pricing, cancellation policies | Amenities/facilities/bookings APIs and pages | Partial | Add paid booking, penalties, blackout dates, capacity policies |
| Parking | Resident/visitor parking, vehicle management, ANPR/boom barrier | Parking registry, assignments, marketplace/request flows | Partial | Add visitor parking capacity, enforcement, ANPR/barrier integrations |
| Vehicles | Resident vehicles, visitor vehicles | Vehicle model foundation and parking assignments | Partial | Add resident self-service vehicle update and guard lookup |
| Marketplace/classifieds | Buy/sell/community commerce | Marketplace domain and page | Partial | Add moderation, images, interest workflow, sold history |
| Community forum | Discussions/neighbourhood engagement | Forum module exists | Partial | Add moderation, reporting, topic categories |
| Events/calendar | Community events | Events module exists | Partial | Add RSVP, reminders, recurring events |
| Directory | Resident directory | Directory route/page exists | Partial | Add privacy controls per user and occupancy state |
| SOS/safety | Emergency/SOS workflows | SOS & Safety/emergency modules exist | Partial | Add escalation tree, guard dispatch, emergency contacts |
| Blacklist/security watch | Blocked visitors/people | Blacklist API exists | Partial | Add UI integration and guard warnings across visitor flows |
| Vendor management | Vendor master, contracts, AMC docs | Vendor Hub module exists | Partial | Add contract dates, AMC schedules, vendor ledger/payables |
| Asset register | Society asset tracking | Asset Register module exists | Partial | Add maintenance schedule, depreciation, warranty alerts |
| Audit trail | Audit-ready operational records | Activity Log module exists | Partial | Ensure every sensitive action writes immutable audit records |
| Mobile app | Native Android/iOS apps | Web/PWA-oriented Next.js app | Missing/Planned | Add PWA polish, Capacitor Android APK, push notifications |
| Push notifications | App notifications, visitor approval | In-app notifications and web push subscription route | Partial | Harden push delivery, fallback SMS/WhatsApp |
| WhatsApp/SMS/email | Delivery reports and reminders | Reminders route exists; no full provider integration | Missing/Partial | Integrate WhatsApp/SMS/email provider and delivery tracking |
| Compliance/security | ISO/GDPR/encryption claims publicly listed by MyGate | Basic app auth and RBAC | Missing/Partial | Add security review, rate limits, encryption policy, logs, backups, consent |
| Scale/uptime | MyGate claims high scale and uptime | Local SaaS architecture, Neon DB | Partial | Add background jobs, queues, monitoring, caching, load testing |

## Module-by-Module Detail

### 1. Security & Gate

| Feature | MyGate | Our Project | Status |
|---|---|---|---|
| Guard app/console | Mature guard app with onboarding/training | `/gate` page with guard login/join | Implemented |
| Visitor entry | Guard logs visitors | Guard logs visitors | Implemented |
| Resident approval | One-tap approval via app notification | Notification links to My Visitors approval flow | Partial |
| Direct entry | Common real-world guard override | `Allow Entry Now` supported | Implemented |
| Visitor history | Full gate records | Today/full history toggle | Implemented |
| Package desk | Delivery tracking | Package logging, collection status | Partial |
| Staff entry | Domestic help attendance | Staff check-in/out by code | Implemented |
| Vehicle/parking at gate | Vehicle entry, visitor parking capacity, ANPR/boom barrier integrations | Vehicle number captured for visitors; parking domain exists | Partial |
| Blacklist | Security watch/blocklist | Blacklist API and gate phone check | Partial |

Recommended next work:
- Add “resident response timeline” for each visitor.
- Add package collection confirmation by resident.
- Add guard incident reports directly on gate page.
- Add visitor vehicle search and wrong-parking owner lookup.

### 2. Finance & ERP

| Feature | MyGate | Our Project | Status |
|---|---|---|---|
| Maintenance invoices | Auto billing and collections | Billing & Ledger invoice generation | Partial |
| Payment collection | UPI/cards/netbanking/wallets | UPI link + UTR confirmation | Partial |
| Receipts | Instant receipts | Receipt routes/pages exist | Implemented/Partial |
| Reminders | Automated payment reminders | Reminder routes/buttons exist | Partial |
| Defaulters | Dues tracking | Pending reports and maintenance table | Partial |
| Accounting | Audit-ready reports, Tally reconciliation | Reports + ledger foundation schema | Partial |
| Expenses | Expense booking | Expenses module | Partial |
| Funds | Corpus/sinking/reserve | Fund Accounts | Partial |
| Budgets | Budget vs actual | Budget Planning | Partial |
| Payroll | Staff payroll | Staff Payroll creates salary expenses | Partial |
| Private rent/home payments | App listing mentions rent/home payments | Private rent invoices owner-to-tenant | Partial |
| Resident staff payments | Domestic help payments | Private staff payments per flat | Partial |

Recommended next work:
- Implement ledger runtime before deepening reports.
- Add payment gateway webhooks.
- Add invoice line items instead of single amount.
- Add arrears, credit notes, reversals, and cancellation audit.
- Add owner bank/UPI profile for private rent.

### 3. Resident Experience

| Feature | MyGate | Our Project | Status |
|---|---|---|---|
| Resident dashboard | Unified resident app | Resident/member dashboard | Implemented |
| My bills | Pay society dues | My Bills page | Implemented/Partial |
| Private rent | Rent/home payments | Private Rent section | Partial |
| Staff payments | Pay domestic help | Staff Payments section | Partial |
| Visitors | Preapprove and approve visitors | My Visitors page | Partial |
| Packages | Package notifications | Parcel Desk and notifications | Partial |
| Complaints | Raise and track complaints | Helpdesk/Complaints | Partial |
| Notices | Official communications | Notices | Partial |
| Amenities | Booking shared spaces | Amenity/facility booking | Partial |
| Marketplace | Buy/sell | Marketplace | Partial |
| Directory | Contact residents | Directory | Partial |
| Community forum | Discussions | Forum | Partial |

Recommended next work:
- Improve mobile responsiveness and PWA install.
- Add resident notification center deep links for every module.
- Add payment proof upload where online gateway is not enabled.

### 4. Committee / Chairman / Treasurer

| Feature | MyGate | Our Project | Status |
|---|---|---|---|
| RWA dashboard | Finance + operations dashboard | Admin dashboard | Partial |
| Flat/resident management | Owners, tenants, family | Residents, Tenants, Move In/Out | Partial |
| Settings | Society setup | Settings, join code, flats, gate staff | Implemented |
| Access control | Role-based access | Role table/helper | Partial |
| Reports | Finance/ops/compliance reports | Reports module | Partial |
| Vendor management | Vendor master | Vendor Hub | Partial |
| Asset management | Assets/AMC | Asset Register | Partial |
| Audit trail | Audit logs | Activity Log | Partial |

Recommended next work:
- Add committee member invitation/approval workflow.
- Add secretary/treasurer scoped permissions, not wildcard access.
- Add immutable audit log coverage.

## Strongest Parts of Our Current Product

1. Occupancy-aware architecture has started correctly.
   - Unit, Person, UnitOccupancy prevents the old flat-as-person problem.

2. Practical India-specific flows are being added.
   - Tenant vs owner billing responsibility.
   - Private rent separate from society dues.
   - Resident staff payments separate from society payroll.
   - Guard direct-entry vs approval.

3. Multi-module breadth is already strong.
   - Finance, gate, visitors, staff, parking, amenities, marketplace, notices, complaints, polls, meetings, documents, vendors, assets.

4. SaaS join-code model is better than manual resident-created societies.

## Biggest Gaps Against MyGate

1. Production-grade payments
   - MyGate supports multiple payment methods and reconciliation.
   - Our project currently needs gateway integration, webhook verification, and settlement reports.

2. Accounting correctness
   - MyGate positions itself as accounting/ERP-ready.
   - Our project has finance modules, but reports must eventually derive from ledger entries.

3. Mobile app maturity
   - MyGate has Android/iOS app distribution.
   - Our app is web-first and needs PWA/Capacitor/mobile push polish.

4. Notifications and delivery guarantees
   - MyGate has app notification/SMS/email-style operational depth.
   - Our notifications exist, but provider-backed delivery and read/delivery reports are incomplete.

5. Compliance/security posture
   - MyGate publicly claims enterprise security controls.
   - Our project needs rate limiting, audit hardening, encryption policy, backup/restore, monitoring, consent/privacy controls.

6. Workflow depth
   - Many modules exist but need lifecycle states, approvals, escalation, attachments, exports, and audit trails.

## Ideal Next Engineering Priorities

### Priority 1 - Stabilize Core Runtime

- Finish migrating every module from legacy `Flat.ownerName/tenantName` to UnitOccupancy.
- Add tests for owner/tenant/current occupant resolution.
- Make notification links open exact workflows.
- Lock down role permissions for secretary/treasurer/member/tenant/guard.

### Priority 2 - Make Finance Correct

- Implement ledger runtime.
- Make invoices line-item based.
- Add payment gateway and webhook reconciliation.
- Add cancellation/reversal/credit-note flows.
- Add proper defaulter aging and collection reports.

### Priority 3 - Make Gate Production-Ready

- Add guard incident logs.
- Add package collection confirmation.
- Add resident approval timeline.
- Add blacklist UI.
- Add visitor parking and vehicle owner lookup.

### Priority 4 - Improve Resident App Experience

- PWA/mobile layout polish.
- Push notification delivery.
- Better My Bills split:
  - society dues
  - private rent
  - resident staff payments
  - package notifications
  - visitor approvals

### Priority 5 - SaaS Commercial Layer

- Subscription plans.
- Trial/recharge limits.
- Feature flags by plan.
- Super admin dashboard.
- Society onboarding verification.

## Product Positioning

MyGate is already a full-scale apartment ERP and security platform.

Our project should not try to copy every feature blindly. The better strategy is:

1. Build a clean domain model first.
2. Keep society money, private owner money, and resident staff money separate.
3. Make occupancy the center of resident identity.
4. Make ledger entries the center of finance.
5. Make guard operations fast and simple.
6. Add mobile-first workflows after the web runtime stabilizes.

If executed well, this project can become a practical SaaS competitor focused on Indian society operations with clearer owner/tenant/staff/payment separation than many basic society apps.
