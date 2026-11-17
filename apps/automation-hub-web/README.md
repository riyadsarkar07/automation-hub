# Automation Hub Web — foundation

An isolated **Next.js 16** customer-facing application alongside (not inside) the n8n editor. This is **not yet a working automation engine**.

## Local setup

1. Open this directory directly (`cd apps/automation-hub-web`). This directory is deliberately **not** included in the root pnpm workspace.
2. Run `npm install` to generate a lockfile and install dependencies, then `npm run dev`.
3. Copy `.env.example` to `.env.local` and configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from your own Supabase project. Configure email auth and the app's allowed redirect URLs in Supabase.
4. Visit `/login`. Email/password sign-in and sign-up are wired to Supabase. The dashboard verifies the account on the server.

## Vercel

Set **Root Directory** to `apps/automation-hub-web` and add the same public environment variables in Vercel. The entire n8n backend is **not** deployed by this Vercel project.

## State and limitations

- Implemented: original responsive marketing page, login/signup UI, Supabase SSR cookie integration, protected read-only dashboard shell, empty/error states, sign out.
- Not implemented: organization selection/onboarding, SQL migrations, RLS policy tests, automations creation/dispatch, live run history, provider OAuth, payments, billing, deployment, automated tests.
- The dashboard will show a database configuration warning until a reviewed tenant-safe schema is deployed. Do not create a permissive `automation_instances` table to silence that message.
- Do not treat an authenticated session as authorization to access another tenant's data. Ensure RLS policies are verified before activating the table.
- Do not provide n8n as an unlicensed hosted or white-label service.
- Install dependencies and commit the generated lockfile before production deployment. Package versions are preliminary, not validated by a local build in this PR.
