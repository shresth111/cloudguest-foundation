
## Scope

Enhance the existing Locations module in place. No new project, no replaced routes, no duplicated components. All work extends `src/components/locations/*`, `src/services/location.service.ts`, and adds a light `customer.service.ts` layer that reuses existing organization/router/billing mocks.

## What changes

### 1. Location list (existing `/locations`)
- Extend `LocationTable.tsx` columns to include: Property Type, Location Name, Owner, Customer, Subscription, Router, Status, Created Date, Actions. Keep existing search/filters/export/create button and view toggles (table/card/map) intact — only add columns and an Owner/Customer cell.
- No route change. Sidebar unchanged (already exposes Locations).

### 2. Smart Provisioning Wizard (replaces body of existing `LocationWizard.tsx`)
Reuse the same `LocationWizard` component and its existing dialog trigger — internally swap the current 4-step form for a 9-step stepper. Steps:

1. **Customer Lookup** — Email + optional Mobile. On email blur call mock `customerService.checkOwner(email)`. Show skeleton → New Customer panel or Existing Customer card. Branch state is stored in wizard context and drives every later step.
2. **Property Information** — type, name, auto-generated code, country/state/city/address/timezone/lat/lng, optional logo.
3. **Location Owner** — new: collect name/email/mobile + auto-generated username/temp password + force-reset toggle. Existing: read-only owner card with "View Owner".
4. **Router Registration** — serial, model, RouterOS version, public IP, private IP, WireGuard toggle. Live preview card.
5. **Subscription** — plan (Trial/Starter/Professional/Enterprise/Custom), billing cycle, expiry. Existing customer: show current plan/limits/locations + "Keep existing" or "Upgrade".
6. **Feature Access** — grouped checkbox cards (Networking, Management, Analytics, Authentication, Branding, Developer).
7. **Plan Limits** — editable numeric cards for locations/routers/guests/sessions/staff/api keys/storage/sms/email.
8. **Review** — summary cards. For existing customer, also render the list of existing properties + the new one badged "New".
9. **Provision** — animated checklist timeline + progress bar calling `customerService.provision(payload)` (mock, staged setTimeouts). Ends on success screen with two variants (new vs existing) — copy credentials, download PDF (client-side jsPDF-free: use `window.print` for print, plain text blob download for PDF-substitute), print, resend welcome, open dashboard / view all locations / create another.

Validation: React Hook Form + Zod per step; Next disabled until valid. TanStack Query mutation invalidates `locationKeys.all` and `orgKeys.all` on success.

### 3. Customer/location switcher on existing dashboard
Add a `LocationSwitcher` control into `TopNavbar.tsx` (Super Admin + Org Admin only) — a shadcn `Command`-powered dropdown listing "All Properties" + each location grouped by customer. Selection writes to a new lightweight `CurrentLocationContext`; existing dashboard hooks read the id if present to scope queries (mock services accept an optional `locationId` filter — pass-through, no behavior change when unset). No dashboard layout changes beyond mounting the switcher and context provider.

### 4. Data layer
- New `src/services/customer.service.ts` with `checkOwner`, `provision`, `listCustomersWithLocations`. Backed by existing `organizationService` + `locationService` mocks. Deterministic seed so `owner@existing.com` returns an existing customer.
- New `src/hooks/useCustomer.ts` exposing `useCheckOwner` (lazy query) and `useProvisionCustomer` mutation.
- New `src/lib/provisioning-schemas.ts` — per-step Zod schemas + wizard union.
- Extend `src/types/location.ts` with `ownerName`, `ownerEmail` optional fields; extend seed generator to populate.

### 5. Access control
Wizard trigger and provisioning mutation gated to Super Admin via existing `useAuth` role check (reuses `roles.ts`). Non-super-admin sees the existing simple create flow disabled with tooltip.

## Technical notes

- No new routes. No sidebar edits (Locations already present). "Customers/Subscriptions/Plans/Feature Management" items in the user's sidebar sketch already map to existing Organizations/Billing/Branding entries — not renaming to avoid churn.
- No new npm dependencies. PDF export uses a text blob (`Download credentials.txt`) + `window.print()` for print-to-PDF, matching existing export patterns.
- Reuses existing shadcn primitives (Dialog, Card, Tabs, Progress, Command, Badge, Skeleton, Toast).
- Dark/light mode inherited from existing theme tokens; no new colors.

## Files touched

Edit: `LocationWizard.tsx`, `LocationTable.tsx`, `TopNavbar.tsx`, `location.service.ts`, `types/location.ts`, `router.tsx` (mount `CurrentLocationProvider`).
Add: `services/customer.service.ts`, `hooks/useCustomer.ts`, `context/CurrentLocationContext.tsx`, `components/layout/LocationSwitcher.tsx`, `lib/provisioning-schemas.ts`, `components/locations/wizard/` (Step1Lookup, Step2Property, Step3Owner, Step4Router, Step5Subscription, Step6Features, Step7Limits, Step8Review, Step9Provision, SuccessScreen).

## Out of scope

- Renaming sidebar sections or adding new top-level routes.
- Real backend / Supabase — everything remains mock services per prior modules.
- Redesigning existing dashboard cards or location detail tabs.
