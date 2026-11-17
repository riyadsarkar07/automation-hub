-- Automation Hub Telegram: platform-owned bot, workspace-owned opt-in private chat.
-- No Telegram bot token is stored in Postgres or exposed to browsers.
-- Webhook uses a server-only Supabase service role key and Telegram secret header.
create table public.automation_hub_telegram_link_requests (
  organization_id uuid primary key references public.automation_hub_organizations(id) on delete cascade,
  code_hash text not null unique check (code_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table public.automation_hub_telegram_links (
  organization_id uuid primary key references public.automation_hub_organizations(id) on delete cascade,
  chat_id bigint not null unique,
  username text,
  auto_reply_enabled boolean not null default false,
  last_test_at timestamptz,
  last_auto_reply_at timestamptz,
  linked_at timestamptz not null default now()
);
create table public.automation_hub_telegram_webhook_updates (
  update_id bigint primary key,
  received_at timestamptz not null default now()
);

alter table public.automation_hub_telegram_link_requests enable row level security;
alter table public.automation_hub_telegram_links enable row level security;
alter table public.automation_hub_telegram_webhook_updates enable row level security;

revoke all on public.automation_hub_telegram_link_requests, public.automation_hub_telegram_links,
  public.automation_hub_telegram_webhook_updates from anon, authenticated;
grant select,insert,delete on public.automation_hub_telegram_link_requests to authenticated;
grant update (code_hash,expires_at,created_at) on public.automation_hub_telegram_link_requests to authenticated;
grant select,delete on public.automation_hub_telegram_links to authenticated;
grant update (auto_reply_enabled) on public.automation_hub_telegram_links to authenticated;

create policy "telegram_pending_select_owner" on public.automation_hub_telegram_link_requests
 for select to authenticated using (exists(
  select 1 from public.automation_hub_organizations o
  where o.id=organization_id and o.owner_user_id=(select auth.uid())));
create policy "telegram_pending_insert_owner" on public.automation_hub_telegram_link_requests
 for insert to authenticated with check (exists(
  select 1 from public.automation_hub_organizations o
  where o.id=organization_id and o.owner_user_id=(select auth.uid())));
create policy "telegram_pending_update_owner" on public.automation_hub_telegram_link_requests
 for update to authenticated using (exists(
  select 1 from public.automation_hub_organizations o
  where o.id=organization_id and o.owner_user_id=(select auth.uid())))
 with check (exists(
  select 1 from public.automation_hub_organizations o
  where o.id=organization_id and o.owner_user_id=(select auth.uid())));
create policy "telegram_pending_delete_owner" on public.automation_hub_telegram_link_requests
 for delete to authenticated using (exists(
  select 1 from public.automation_hub_organizations o
  where o.id=organization_id and o.owner_user_id=(select auth.uid())));
create policy "telegram_link_select_owner" on public.automation_hub_telegram_links
 for select to authenticated using (exists(
  select 1 from public.automation_hub_organizations o
  where o.id=organization_id and o.owner_user_id=(select auth.uid())));
create policy "telegram_link_update_owner" on public.automation_hub_telegram_links
 for update to authenticated using (exists(
  select 1 from public.automation_hub_organizations o
  where o.id=organization_id and o.owner_user_id=(select auth.uid())))
 with check (exists(
  select 1 from public.automation_hub_organizations o
  where o.id=organization_id and o.owner_user_id=(select auth.uid())));
create policy "telegram_link_delete_owner" on public.automation_hub_telegram_links
 for delete to authenticated using (exists(
  select 1 from public.automation_hub_organizations o
  where o.id=organization_id and o.owner_user_id=(select auth.uid())));
-- No anon/authenticated table privilege on webhook updates; service_role only.
