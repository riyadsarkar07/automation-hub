# Automation Hub — Product Architecture & Roadmap

> **Status: proposal, not deployed software.** This document plans an independent Automation Hub product alongside the current n8n source tree. It does not claim a working SaaS dashboard, Supabase integration, payments, or deployment.

## 1. Current repository baseline (17 November 2026)

- The default branch is `main`; the repository root is the upstream-style `n8n-monorepo` (version `2.47.0` at review time), not an Automation Hub-specific web application.
- The current root README describes n8n; the codebase is a large pnpm/Turborepo monorepo.
- No Automation Hub-specific Vercel frontend, Supabase customer database, or tenant/billing subsystem was identified in the reviewed tree. Existing generic n8n Supabase nodes or Vercel AI integrations are **not** those systems.
- Upstream GitHub Actions need a dedicated review before being enabled for this fork. For example, `.github/workflows/ci-master.yml` is configured for `master`, not this repository's default branch `main`.
- Preserve upstream copyright, attribution, and license files. Do not broadly rename or rebrand n8n code as proprietary code.

## 2. Deployment architecture

```text
Customers' browser
      |
      v
Automation Hub Web (separate Next.js application on Vercel)
      |  Supabase Auth / tenant-scoped business records
      +---------------------> Supabase Postgres
      |
      v
Server-side API / signed job dispatcher
      |  private credentials, authorization, rate limits, logs
      v
Private automation service (n8n in an always-on Docker host)
      |  n8n-owned data store, persistent volume, backups
      +---------------------> Dedicated Postgres DB or isolated project
      |
      +---------------------> External APIs (Meta, WhatsApp, Gmail etc.)
```

**Important:** Do **not** deploy the complete n8n runtime as a Vercel Function. Vercel is suitable for the separate web dashboard and request/response APIs; a long-running workflow execution service needs an appropriate always-on container host. Vercel Function duration limits and n8n process requirements make a full n8n-on-Vercel deployment an unsuitable baseline.

Supabase Postgres may be used for the independent application's data. An n8n Postgres connection is also possible if configured correctly, but keep n8n's tables/credentials separate from customer data, use the recommended connection mode for a persistent service, and validate the target n8n version's database settings.

## 3. Licensing checkpoint (must resolve before offering paid plans)

The current source includes n8n's **Sustainable Use License** and separate Enterprise-licensed components. A source-available repository is not automatically unrestricted for selling a hosted or white-labeled automation editor. n8n states that offering n8n as a service or white-labeling its UI requires an appropriate commercial license/agreement.

Before implementing paid customer-facing access to n8n features, confirm the **exact product use case** with n8n licensing/legal counsel. A distinct frontend does not automatically eliminate embedded/hosting licensing obligations. Do not remove license notices or grant customers direct editor/API access on an unverified licensing assumption.

References:
- [Repository license](../../LICENSE.md)
- [n8n license FAQ](https://support.n8n.io/article/can-i-use-your-license-for-my-use-case)
- [n8n documentation](https://docs.n8n.io/)

## 4. Product MVP (only after licensing and design review)

| Area | Initial acceptance criteria |
| --- | --- |
| Landing | Responsive marketing page, pricing explanation, product boundaries and support/contact |
| Account | Supabase email sign-in, secure session handling, logout, onboarding |
| Organizations | Owner/member roles, strict tenant isolation, per-organization settings |
| Dashboard | Real automation status, recent runs, errors, and usage from backend APIs (no fake metrics) |
| Templates | Curated approved automation templates with prerequisites and clear permissions |
| Connections | Provider OAuth/approved integrations, encrypted server-side credential references; no secret exposure |
| Runs | Trigger/stop approved automations, audit trail, retry and failure alerts with idempotency |
| Billing | Plans and feature entitlements only after payment-provider and webhook verification |
| Operations | Error tracking, health checks, logs without secrets, backups, rate limiting and abuse controls |

Target supported automation channels can include email, Telegram, Meta/Facebook, WhatsApp and webhooks, subject to official API permissions/policies.

## 5. Security requirements (release blockers)

1. **Never send Supabase service-role/secret keys, n8n admin tokens, OAuth client secrets, or external API tokens to a browser.** Keep secrets in protected server environments.
2. Enable Row Level Security on every customer-visible Supabase table, with organization/user ownership checks. An `authenticated` role alone is **not** tenant authorization.
3. Verify organizations and plan entitlements server-side for **every** operation, not just on UI routes.
4. Keep the n8n editor and API private by default. Validate any public webhook signature, replay window, payload size and idempotency key.
5. Encrypt credential references; implement revocation, audit events, retention, secure backups and recovery.
6. Rate-limit API calls and third-party message sends. Respect Meta/WhatsApp/email messaging rules and consent/opt-out requirements.
7. Add deterministic tests for tenant isolation, webhook verification, auth flows, task retries, usage limits, and failure handling.
8. Scan repository history and current files for exposed credentials before any deployment. Do **not** paste secrets into source or CI.

## 6. Implementation phases

**Phase A — Foundation**
- Decide the licensing model and separate the customer app from n8n source code (prefer a dedicated `automation-hub-web` repository for simpler Vercel builds; an isolated workspace is an alternative if monorepo maintenance is acceptable).
- Create application UI shell and original design system (do not copy/rebrand the n8n editor).
- Create a Supabase project with migration-managed schema, RLS and automated policy tests.
- Document runtime topology and infrastructure ownership.

**Phase B — Working MVP**
- Secure login, real org-aware dashboard, provider connection setup and a single end-to-end approved automation.
- Add signed internal dispatch, workflow status polling/webhook handling and error reporting.
- Run integration tests on a staging stack and explicitly label what is live versus mocked.

**Phase C — Production hardening**
- Secure payments/plan provisioning after license review, account recovery, metering, limits, monitoring, data export, backups, disaster recovery.
- Add CI for the *new web app* on `main`; disable/replace upstream vendor-specific workflows as appropriate after a full inventory.
- Load-test webhook throughput, tenancy boundaries and failure recovery before inviting paying customers.

## 7. Acceptance / done definition

A milestone is complete only when source is committed, tests are reported, preview URL is verified, required secrets are configured outside the repository, DB migrations/RLS checks pass, and operational/licensing caveats are recorded. **Documentation or a screenshot alone is not a working integration.**

## 8. Official reference points

- [n8n Docker hosting](https://docs.n8n.io/hosting/installation/docker/)
- [n8n scaling / workers](https://docs.n8n.io/hosting/scaling/queue-mode/)
- [Supabase Postgres connection options](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase data security](https://supabase.com/docs/guides/api/securing-your-api)
- [Vercel Functions limits](https://vercel.com/docs/functions/limitations)
