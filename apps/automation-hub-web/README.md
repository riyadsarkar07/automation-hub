# Automation Hub Web — internal automation MVP

A customer-facing Next.js 16 application alongside the upstream n8n source.
The internal notification MVP does **not** host or embed n8n and is **not** a general-purpose background automation engine.

## Current deployment (2026-11-17)

- Dedicated Supabase project: `automation ai` (`lgcxykpoufenqcfbmdtw`, organization `Automation Ai`).
- Applied database migrations: `automation_hub_foundation` and `automation_hub_events_automation_index`.
- Four application tables have RLS enabled, and seven ownership policies are installed.
- Structural SQL permission test (`sql/002_rls_smoke.sql`): **PASS**.
- Transactional SQL isolation test with two *simulated* authenticated identities: **PASS**. This covered tenant isolation, forbidden cross-user insert/update/RPC, anonymous RPC denial, idempotency, paused state and run/event access. Temporary rows were rolled back.
- Supabase security advisors: **no security lints** at the time of verification. Unused-index informational notices are expected on empty tables.
- Vercel project: `automation-hub-web`, **Preview** environment variables configured (URL and modern publishable key, no service-role key).
- A Supabase-connected Vercel Preview deployment was built and returned HTTP 200 for `/` and `/login`. Unauthenticated `/dashboard` serves the login route.
- **Not production approved**: two genuine Auth users, email confirmation and browser workflow E2E are unverified. Production env/deployment have not been switched to the new backend.

## Local development

1. `cd apps/automation-hub-web` (this app is intentionally outside the n8n pnpm workspace).
2. `npm install` and `npm run dev`.
3. Copy `.env.example` to `.env.local`. Fill `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the intended Supabase project; **never commit secrets or service role keys**.
4. Set Supabase Authentication → URL Configuration → Site URL and allowed redirect URLs for the exact development and deployment origins.
5. Open `/login` and test signup, confirmation, workspace creation, notification automation, Run now, and private activity.

## Database migrations

- `sql/001_foundation.sql`: four owner-scoped RLS tables, restricted grants, and an invoker-rights public RPC delegating to a private owner-checking execution routine.
- `sql/002_rls_smoke.sql`: structural RLS/grants smoke assertions; **this is a test, not a migration**.
- `sql/003_events_automation_index.sql`: covering index on event `automation_id` foreign key.
- The `automation_hub_private` schema must not be added to the Supabase Data API exposed schemas.
- Before production, run real two-user Supabase Auth + Data API negative isolation tests and E2E tests under ordinary signed-in sessions, without a privileged service-role client.

## Vercel preview

Set Root Directory to `apps/automation-hub-web`. Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the intended Vercel environments. As of 2026-11-17, these are set only in **Preview** on project `automation-hub-web`, and code deploys are manually initiated from the feature branch (Vercel reports no linked Git repository when branch-scoping environment variables).

## Integrations workspace (2026-11-17)

- `/dashboard/integrations` is a protected workspace page with functional in-app notification enable/disable and an optional real test run when an active automation exists.
- `sql/004_in_app_integration_settings.sql` adds an owner-only RLS table for the workspace toggle. A restricted private-schema trigger blocks new notification runs while the channel is disabled. If no row exists, the previous default behavior remains enabled.
- Tenant-isolation checks passed under two **simulated** authenticated identities using a transaction that rolled back all test data; real multi-user browser tests are still necessary.
- Telegram has a per-workspace setup and optional auto-reply foundation; it remains **inactive** until the platform bot's server secrets, public webhook and user chat are configured. Email, WhatsApp and Facebook remain unconnected.
- Latest advisor scan also reported **Leaked Password Protection Disabled** in Supabase Auth. Enable password leak protection before a public launch: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Telegram bot (@automated_hub_bot): integration foundation

The bot is platform-owned. Each workspace owner connects **their own private chat**
using a 10-minute, 192-bit one-time deep link from `/dashboard/integrations`.
The bot token is NEVER entered by end users. Tokens, chat IDs and webhook secrets
are NOT stored in public frontend variables.

**Infrastructure installed:**
- `sql/005_telegram_shared_bot.sql`: RLS-scoped link requests and links, no end-user
  permission to forge a chat ID; webhook-update dedup ledger is server-only.
- `sql/006_telegram_outbound_rate_limit.sql`: server-side one-minute cooldown on
  Telegram outgoing test/automation messages.
- `/api/integrations/telegram/connect`: authenticated, owner-scoped connect URL.
- `/api/integrations/telegram/test`: authenticated, rate-limited test message.
- `/api/automations/run`: existing in-app automation still runs through the
  RLS-protected RPC. When the shared Telegram bot is configured and a chat is
  linked, it also attempts Telegram delivery; in-app results survive Telegram failures.
- `supabase/functions/automation-hub-telegram-webhook/index.ts`: deployed as
  `automation-hub-telegram-webhook` on Supabase with `verify_jwt=false`. The
  function authenticates every POST using Telegram's
  `X-Telegram-Bot-Api-Secret-Token` header before reading update data.
  This public endpoint avoids Vercel Preview Deployment Protection.
- `/api/telegram/webhook`: alternative Next.js route, suitable ONLY on an
  unprotected public deployment. Do not make the protected Vercel Preview public.

**Incomplete until the platform owner configures real secrets and registers a webhook:**
1. Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, and
   `SUPABASE_SERVICE_ROLE_KEY` as **server-only** Vercel Preview environment variables.
   Do not prefix any with `NEXT_PUBLIC_`. Apply the values and rebuild Preview.
2. Set `TELEGRAM_BOT_TOKEN` and the **same** `TELEGRAM_WEBHOOK_SECRET` under
   Supabase → Edge Functions → Secrets (the platform provides the
   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` Edge secrets).
3. Register this **public** webhook URL with Telegram's `setWebhook` Bot API. After filling a local ignored `.env.local`, run `node --env-file=.env.local scripts/register-telegram-webhook.mjs` (Node.js 22+). This script first checks that the token belongs to `@automated_hub_bot` and never prints the token:
   `https://lgcxykpoufenqcfbmdtw.supabase.co/functions/v1/automation-hub-telegram-webhook`
   Set `secret_token` to `TELEGRAM_WEBHOOK_SECRET` and
   `allowed_updates` to `["message"]`. Keep the bot token out of logs,
   terminal commands, GitHub commits and chat messages.
4. Verify Telegram `getWebhookInfo`, then sign in to Automation Hub,
   select **Connect Telegram**, open the one-time link and press Start.
   Refresh Integrations: it should show **Chat connected**. Test a notification,
   optionally enable Auto Reply and send a normal private-chat message.
5. `/stop` unlinks the chat. Auto Reply is a **fixed acknowledgement**, throttled
   to one reply/minute; it is NOT an AI reply model, and group chats are not supported.

**Status 2026-11-17:** Edge webhook is deployed but the bot token, webhook
secret, Vercel service-role key, and Telegram `setWebhook` registration are
NOT configured yet. Do not label Telegram "Connected" or claim actual messages
were delivered before real end-to-end validation.

## Features and limitations

- Implemented in code: marketing landing page, email/password login/signup, Supabase SSR session cookies and protected dashboard, owner workspace creation, notification automation, run history, private in-app event feed and a functional Integrations workspace page.
- The in-app runner validates owner access, paused state, and idempotency. Telegram delivery is attempted for linked chats after secure platform configuration; no external messages have been validated or sent in this setup session.
- Not implemented: email/WhatsApp/Facebook integration, n8n worker, billing, plan subscriptions, team invitations, global quotas, production monitoring and a production-grade durable Telegram message queue.
- n8n source must be used according to its license. Do not resell a hosted/white-label n8n product without the appropriate licensing review.
- Generate and commit the application's npm lockfile, switch its CI job from `npm install` to `npm ci`, and review dependency advisories before production.
- Keep PR #2 in draft; do **not** merge until Auth, RLS, billing/licensing (where relevant), and end-to-end checks pass.
