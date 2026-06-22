# 🔍 Management Pages Visibility Issue - Root Cause Analysis

## 📋 Current Issue
In the Chairman sidebar, the **MANAGEMENT** module only shows **"Smart Nudges"** navigation item, but there should be multiple management features like:
- Residents
- Tenants
- Move In / Out
- Vendor Hub
- Asset Register
- Access Control
- Audit Trail
- Settings

---

## 🎯 Root Causes - Why Other Management Pages Are NOT Visible

### **Cause #1: Missing `society:settings.manage` Permission ❌**

**File:** `packages/security/src/permission-policy.ts` (Lines 14-94)

The `committee` role (which chairman maps to) is **NOT** granted the `society:settings.manage` permission:

```typescript
const ROLE_PERMISSIONS: Record<SocietyRole | "platform_admin", readonly PermissionAction[]> = {
  committee: [
    "audit:event.read",
    "society:core.manage",              // ✅ Granted
    "society:directory.read",           // ✅ Granted
    "society:finance.read",             // ✅ Granted
    "society:occupancy.manage",         // ✅ Granted
    "operations:manage",                // ✅ Granted
    // ... other permissions
    // ❌ MISSING: "society:settings.manage"
  ],
  // ...
};
```

**Impact:**
- `/settings` page is **HIDDEN** because it requires `society:settings.manage` (line 164 in `packages/ux-core/src/index.ts`)

---

### **Cause #2: Missing MFA-Required Permission Filter ⚠️**

**File:** `packages/security/src/permission-policy.ts` (Lines 163-178)

Several management permissions require MFA verification to be granted:

```typescript
const MFA_REQUIRED_ACTIONS = new Set<PermissionAction>([
  "audit:event.read",           // 👤 For Audit Trail
  "society:core.manage",        // 👤 For Residents & Access Control
  "society:occupancy.manage",   // 👤 For Tenants & Move In/Out
  "operations:manage",          // 👤 For Vendor Hub & Asset Register
  "society:settings.manage",    // 👤 For Settings
  // ... others
]);
```

**The Problem:**
```typescript
if (isMfaEnforcementEnabled() && MFA_REQUIRED_ACTIONS.has(request.action) && !tenantContext.mfaVerified) {
  if (wouldBeAllowed) {
    return {
      allowed: false,
      reason: `MFA is required for ${request.action}`,  // ❌ Permission DENIED if MFA not verified
    };
  }
}
```

**Impact:**
- If chairman is **NOT MFA-verified**, all these management pages become **HIDDEN**:
  - `/members` (Residents)
  - `/tenants` (Tenants)
  - `/move-events` (Move In / Out)
  - `/vendors` (Vendor Hub)
  - `/assets` (Asset Register)
  - `/credentials` (Access Control)
  - `/activity-log` (Audit Trail)
  - `/settings` (Settings)

---

### **Cause #3: Only "Smart Nudges" Doesn't Require MFA 🔓**

**File:** `packages/ux-core/src/index.ts` (Line 161)

```typescript
{ 
  href: "/reminders", 
  label: "Smart Nudges", 
  iconKey: "bell", 
  sectionTitle: "MANAGEMENT", 
  sectionOrder: 5, 
  personas: ["committee", "treasurer"], 
  requiredActions: ["community:notice.manage"]  // ✅ NOT in MFA_REQUIRED_ACTIONS
}
```

**Why it's visible:**
- `community:notice.manage` is **NOT** in the MFA_REQUIRED_ACTIONS set
- Chairman already has this permission from the `committee` role (line 29 in `permission-policy.ts`)

---

## 📊 Visibility Breakdown

| Management Page | Required Permission | In committee role? | In MFA_REQUIRED? | Visible? |
|---|---|---|---|---|
| Residents | `society:core.manage` | ✅ Yes | ✅ Yes | ❌ **No** (needs MFA) |
| Tenants | `society:occupancy.manage` | ✅ Yes | ✅ Yes | ❌ **No** (needs MFA) |
| Move In / Out | `society:occupancy.manage` | ✅ Yes | ✅ Yes | ❌ **No** (needs MFA) |
| Vendor Hub | `operations:manage` | ✅ Yes | ✅ Yes | ❌ **No** (needs MFA) |
| Asset Register | `operations:manage` | ✅ Yes | ✅ Yes | ❌ **No** (needs MFA) |
| Smart Nudges | `community:notice.manage` | ✅ Yes | ❌ No | ✅ **YES** |
| Access Control | `society:core.manage` | ✅ Yes | ✅ Yes | ❌ **No** (needs MFA) |
| Audit Trail | `audit:event.read` | ✅ Yes | ✅ Yes | ❌ **No** (needs MFA) |
| Settings | `society:settings.manage` | ❌ **No** | ✅ Yes | ❌ **No** (missing perm) |

---

## 🔧 How to Fix This

### **Fix #1: Add `society:settings.manage` to Committee Role**
**File:** `packages/security/src/permission-policy.ts` (Line 15)

```typescript
const ROLE_PERMISSIONS: Record<SocietyRole | "platform_admin", readonly PermissionAction[]> = {
  committee: [
    "audit:event.read",
    "society:core.manage",
    "society:directory.read",
    "society:finance.read",
    "society:occupancy.manage",
    "society:import.manage",
    "operations:gate.manage",
    "operations:visitor.respond",
    "operations:read",
    "operations:manage",
    "operations:booking.manage",
    "operations:sos.raise",
    "community:read",
    "community:notice.manage",
    "community:helpdesk.respond",
    "community:helpdesk.manage",
    "community:document.manage",
    "community:governance.manage",
    "community:vote.cast",
    "community:rsvp.manage",
    "community:post",
    "community:moderate",
    "tenant:membership.read",
    "society:settings.manage",  // 🟢 ADD THIS LINE
  ],
  // ...
};
```

### **Fix #2: Ensure Chairman Has MFA Verified**

For chairman users, make sure MFA is properly verified in the auth flow:

1. Check if MFA is enabled during registration/login
2. Store MFA verification status in session/token
3. Verify `mfaVerified` flag is set to `true` in:
   - `src/lib/navigation/legacy-role-bridge.ts` (Line 94)
   - When creating `AuthenticatedPrincipal`

**Test the fix by checking:**
```typescript
// In browser console or API response
const principal = buildPrincipalFromLegacySession(session);
console.log(principal.memberships[0].mfaVerified); // Should be true
```

### **Fix #3 (Optional): Make MFA Optional for Committee Role**

If you want management pages visible without MFA, exclude certain actions from `MFA_REQUIRED_ACTIONS`:

**File:** `packages/security/src/permission-policy.ts` (Line 125)

```typescript
const MFA_REQUIRED_ACTIONS = new Set<PermissionAction>([
  "audit:event.read",
  "society:onboard",
  "society:core.manage",
  "society:finance.manage",
  "society:occupancy.manage",
  // Remove "operations:manage" if you want Vendor Hub & Asset Register visible without MFA
  // Remove "society:settings.manage" if you want Settings visible without MFA
  "society:import.manage",
  "community:document.manage",
  "community:governance.manage",
]);
```

---

## 📍 File Locations & Line Numbers

| File | Issue | Line(s) |
|---|---|---|
| `packages/security/src/permission-policy.ts` | Missing `society:settings.manage` for committee | 15-39 |
| `packages/security/src/permission-policy.ts` | MFA enforcement blocking most management perms | 163-178 |
| `src/lib/navigation/legacy-role-bridge.ts` | Converts chairman → society_admin → permissions | 53-63, 104-130 |
| `packages/ux-core/src/index.ts` | Navigation catalog with permission requirements | 156-164 |

---

## ✅ Quick Checklist to Resolve

- [ ] Add `society:settings.manage` to `committee` role in `permission-policy.ts`
- [ ] Verify chairman account has MFA status set to `true`
- [ ] Test by checking console: `buildPersonaNavigation(session).allowedActions`
- [ ] Refresh browser cache: `localStorage.clear()` + reload
- [ ] Verify all 8 MANAGEMENT pages now appear in sidebar
- [ ] Check MFA enforcement setting: `process.env.MFA_ENFORCEMENT_ENABLED`

---

## 🚀 Expected Result After Fix

Chairman sidebar should show MANAGEMENT module with all items:
1. ✅ Residents
2. ✅ Tenants
3. ✅ Move In / Out
4. ✅ Vendor Hub
5. ✅ Asset Register
6. ✅ Smart Nudges (already visible)
7. ✅ Access Control
8. ✅ Audit Trail
9. ✅ Settings
