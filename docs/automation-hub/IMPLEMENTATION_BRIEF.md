# Automation Hub — Implementation Brief for Coding Agent

> This is an executable **brief**, not proof that the features exist. First read [the architecture review](ARCHITECTURE_AND_ROADMAP.md), the root [LICENSE.md](../../LICENSE.md), and the current repository configuration.

## Objective

Build an original, beautiful, responsive **Automation Hub** customer-facing product for managing approved automation services. The existing n8n code is infrastructure/source material, not a ready-to-launch, unrestricted white-label product.

## Work order

### 0. Audit and decide boundaries

- Confirm `main` HEAD and report repository status, relevant scripts, deployment assumptions and license constraints.
- **Do not** rename the entire n8n monorepo, delete upstream notices, silently change existing workflows, or assume the n8n UI can be resold.
- Before developing paid customer workflows or exposing n8n to customers, document the required licensing decision.
- Prefer creating a separate `automation-hub-web` repository to avoid building the entire n8n monorepo on Vercel. If asked to keep one repo, create a distinct isolated application workspace and carefully update its workspace/build configuration.

### 1. Premium product UI, without fabricated functionality

Design an original modern SaaS UI with dark/light support, accessible contrast, responsive navigation, keyboard-friendly controls, cohesive typography, deliberate empty/loading/error states, and real data-backed status indicators. Build:

- Marketing page: clear offer, supported integrations, onboarding CTA, FAQ/contact.
- Authentication and profile.
- Organization-aware dashboard and activity timeline.
- Automations list, details and run history.
- Integrations and connection status.
- Billing/plan page with clearly marked **not yet available** states until payment integration is complete.
- Settings, help, mobile layouts.

Use a minimal, original component library and intentional spacing. Do not use mock statistics presented as production data or copy the n8n editor interface.

### 2. Supabase foundation

- Create versioned database migrations through the supported Supabase CLI flow; review the current Supabase docs first.
- Proposed business tables: `organizations`, `memberships`, `automation_templates`, `automation_instances`, `automation_runs`, `integration_connections`, `usage_events`, `subscription_entitlements`, and `audit_events`. Adapt to proven needs, not speculation.
- Make tenant keys explicit, enforce foreign keys and uniqueness, and enable RLS for every exposed table.
- Write tenant isolation tests: user A must not read, edit, run or bill organization B's resources.
- Never expose the service-role/secret key to browser bundles. Client auth uses supported Supabase SSR/session patterns.
- Restrict secret-bearing integration data to server-only storage and encrypt it at rest.

### 3. First end-to-end workflow

Implement **one** safe, approved automation from UI action to verified outcome, for example a consented contact-form notification using a provider/API authorized by the product owner.

- Authenticated request + ownership check.
- Server-side dispatch with idempotency key and safe input validation.
- Private worker/n8n service receives a signed request only through authorized endpoints.
- Persist run status, timestamps, output summary and redacted error details.
- Retry limits, timeout handling, cancellation semantics and audit events.
- Explicit user-facing status distinction: queued, running, succeeded, failed.

If n8n's commercial usage/licensing is not resolved, implement an independent test worker for the end-to-end proof instead of deploying a commercial, customer-accessible n8n service.

### 4. Deployment

- Dashboard: Vercel with isolated project root and dedicated preview/production environments.
- Auth and business database: Supabase project with RLS policies and backup plan.
- Workflow workers: separate long-running container host; never claim that deploying a Next.js dashboard to Vercel deploys n8n itself.
- n8n internal storage: persistent, backed up, separate from public customer tables.
- Secrets: only via managed environment settings. Do not check in real `.env` files, URLs with embedded passwords, admin keys or tokens.
- Keep external provider OAuth redirect URLs and webhook URLs environment-specific.

### 5. Tests and quality gates

Run and report:
1. Formatting, lint, typecheck and production build for the new application.
2. Unit/integration tests covering auth, RLS, signing, idempotency and usage limits.
3. E2E checks for onboarding, creating a workflow, inspecting run status and error handling.
4. Security checks for secret leakage, access control, CSRF where applicable, unsafe redirects, and webhook replay.
5. Mobile (360px and above), tablet and desktop UI accessibility checks.
6. Staging deployment smoke tests and migration rollback/recovery rehearsal.

Stop and report blockers accurately; do not silently skip failing checks or manufacture passing output.

## Deliverables

- A concise diff summary with changed file paths.
- Screenshots of real responsive pages, identifying demo data clearly where used.
- Documented environment-variable **names only**, with credentials configured out of band.
- Database migrations, RLS policy tests and deployment instructions.
- Commit(s) to a dedicated feature branch and an inspectable pull request (not an automatic production merge).
- List of features that **work end-to-end**, features **partially integrated**, and features **not implemented**.

## Suggested MVP completion criteria

A user signs in, selects their organization, creates one supported automation, runs it through a private authorized worker, and sees its real status in the dashboard. Cross-tenant access is denied in automated tests, setup is reproducible, and a preview deployment is verified. Licensing is resolved before any paid white-label/hosted n8n offering.

## Do not do

- Do not advertise free unrestricted reselling of n8n.
- Do not expose n8n admin credentials or Supabase secret/service-role keys to the client.
- Do not add billing UI implying payments are active until webhooks, entitlements and refund/cancellation handling are implemented.
- Do not erase the original n8n README/license or claim this source is entirely original.
- Do not deploy or merge to production without an explicit release decision.
