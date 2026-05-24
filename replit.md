# ClinicOS — Hospital Management System

A cloud-based, HIPAA-aligned Hospital Management System with role-based access, OPD patient flow, EMR, prescriptions, billing, certificates, audit logs, and analytics dashboards.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/hms run dev` — run the HMS frontend (Vite dev server)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run seed` — seed initial users, drugs, charge types, clinic settings
- Required env: `DATABASE_URL` (Postgres), `SESSION_SECRET` (JWT signing)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (artifacts/api-server, port 8080, mounted at `/api`)
- Frontend: React + Vite + Tailwind (artifacts/hms, mounted at `/`)
- DB: PostgreSQL + Drizzle ORM (lib/db)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec in lib/api-spec)
- Auth: Custom JWT (HS256) with bcrypt-style scrypt passwords, 15-min access token / 7-day refresh
- Build: esbuild (ESM bundle for server)

## Login Credentials (after seed)

| Role   | Username    | Password    |
|--------|-------------|-------------|
| Admin  | admin       | Admin@123   |
| Doctor | dr.smith    | Doctor@123  |
| Staff  | staff.jane  | Staff@123   |

## Where things live

```
artifacts/
  api-server/src/
    routes/         — Express route files (auth, patients, appointments, queue,
                      consultations, prescriptions, drugs, billing, certificates,
                      audit, dashboard, reports, settings)
    lib/auth.ts     — JWT helpers, password hashing, audit logging
    middlewares/    — authenticate.ts (JWT middleware)
  hms/src/
    pages/          — All frontend pages organized by domain:
      patients/     — PatientsPage, RegisterPatientPage, PatientDetailPage, EditPatientPage
      appointments/ — AppointmentsPage
      queue/        — QueuePage (live OPD queue with auto-refresh)
      consultations/ — ConsultationsPage, ConsultationDetailPage (SOAP notes, auto-save)
      prescriptions/ — PrescriptionsPage, PrescriptionDetailPage (print-friendly)
      billing/      — BillingPage, NewInvoicePage, InvoiceDetailPage (payment recording)
      certificates/ — CertificatesPage, CertificateDetailPage (print-friendly)
      reports/      — ReportsPage (OPD daily, revenue trend, doctor productivity)
      admin/        — UsersPage, DrugsPage, AuditLogsPage, SettingsPage
    contexts/AuthContext.tsx — JWT auth context, inactivity timeout
    components/layout/ — Layout.tsx + Sidebar.tsx (role-based nav)
    hooks/useDebounce.ts

lib/
  db/src/schema/  — Drizzle schema: users, patients, appointments, queue, consultations,
                    prescriptions, drugs, billing, certificates, vitals, audit, settings
  api-spec/       — OpenAPI spec (openapi.yaml) — source of truth for API contract
  api-client-react/ — Generated React Query hooks (from Orval)
  api-zod/         — Generated Zod schemas (from Orval)

scripts/src/seed.ts  — Database seed script
```

## Architecture decisions

- **Contract-first API**: OpenAPI spec drives Zod schema and React Query hook generation via Orval. Change the spec, run codegen, get type-safe hooks.
- **Custom JWT** instead of a library — avoids dependency, uses Node crypto. Secret from `SESSION_SECRET` env var.
- **Soft deletes** everywhere — `isActive` flag on users, patients, drugs. No hard deletes in production.
- **Audit log on every mutation** — all write operations call `logAudit(req, userId, action, resource, resourceId)` for HIPAA compliance.
- **Role-based access at two layers**: middleware checks JWT role for API endpoints; `ProtectedRoute` checks role client-side for UI routes (admin-only pages, doctor-only pages).
- **Queue auto-refresh** every 30s via `setInterval` + `queryClient.invalidateQueries` — no WebSocket needed for typical OPD scale.
- **Print-friendly pages** — prescriptions and certificates use `@media print` CSS to hide nav/sidebar; `window.print()` on button click.

## Product

- **OPD Flow**: Register patient → Book appointment → Generate queue token → Call next → Consultation (SOAP notes) → Prescription → Invoice
- **Patient EMR**: Demographics, visit history, vitals timeline, complete medical history
- **Billing**: Line-item invoices, charge type catalog, partial payments, payment mode tracking
- **Certificates**: Sick leave, fitness, medical, procedure, vaccination — print-ready with doctor signature
- **Reports**: Daily OPD summary, revenue trends (line chart), doctor productivity (bar chart + table)
- **Admin**: User management, drug master database, full audit log trail, clinic settings

## User preferences

- Currency display: INR (₹) — configurable in settings
- 15-minute inactivity auto-logout

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after editing `lib/api-spec/openapi.yaml`
- Always run `pnpm --filter @workspace/db run push` after editing `lib/db/src/schema/`
- The seed script is idempotent — safe to run multiple times
- API server `dev` script builds then starts; it does NOT hot-reload — restart the workflow after backend changes
- Do NOT run `pnpm dev` at the workspace root — use individual `--filter` commands or restart workflows

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- OpenAPI spec: `lib/api-spec/openapi.yaml`
- DB schema source of truth: `lib/db/src/schema/`
- Generated hooks: `lib/api-client-react/src/generated/api.ts`
- Generated Zod schemas: `lib/api-zod/src/generated/api.ts`
