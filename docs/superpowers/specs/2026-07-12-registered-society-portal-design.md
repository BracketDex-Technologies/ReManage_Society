# Registered Society Portal Design

## Goal

Add a private portal-owner area at `/registered-society` where the developer/admin team and invited partners can see every society registered on the portal, view collection summaries, manage partner credentials, and generate a temporary chairman password when access needs to be shared.

## Constraints

- Existing `/register` society creation must keep its current behavior.
- Existing society `/login`, society users, chairman dashboard, resident flows, and memberships must remain unchanged.
- Portal-owner accounts must be separate from society users.
- Chairman plaintext passwords must not be stored or displayed after creation.

## Architecture

Create a separate `PortalAdmin` Prisma model and a separate portal session cookie. Portal admins use `/registered-society` to register the first owner account, log in, create partner accounts, view all societies, and reset a society chairman password to a generated temporary value.

The portal dashboard reads existing `Society`, `User`, `MaintenanceBill`, `Expense`, and `Flat` data. Financial summaries are calculated from existing paid amounts and approved expenses.

## User Flows

- First visit: if no portal admin exists, the page shows a first-admin registration form.
- Returning portal admin: log in with portal admin email/password.
- Dashboard: see total societies, total collection, pending collection, expenses, and one row per society.
- Partner management: create partner name/email/password from the dashboard.
- Chairman credential reset: generate a new temporary password for the chairman user of a selected society. The password is shown once.

## Security

- Portal routes use a dedicated `portal_session` cookie.
- Portal passwords are hashed with bcrypt.
- Partner creation and chairman password reset require an active portal session.
- Temporary chairman passwords are generated server-side, hashed, and returned only once in the reset response.

