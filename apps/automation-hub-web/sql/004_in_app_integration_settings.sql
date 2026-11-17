-- Per-workspace control for the ONLY currently implemented integration: in-app notifications.
-- No external provider tokens, secrets, or "connected" flags are stored here.
create table if not exists public.automation_hub_integrations (
  organization_id uuid primary key references public.automation_hub_organizations(id) on delete cascade,
  in_app_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.automation_hub_integrations enable row level security;
revoke all on public.automation_hub_integrations from anon, authenticated;
grant select, insert on public.automation_hub_integrations to authenticated;
grant update (in_app_enabled) on public.automation_hub_integrations to authenticated;

create policy "ah_integration_select_owner" on public.automation_hub_integrations
  for select to authenticated
  using (exists (
    select 1 from public.automation_hub_organizations o
    where o.id = organization_id and o.owner_user_id = (select auth.uid())
  ));
create policy "ah_integration_insert_owner" on public.automation_hub_integrations
  for insert to authenticated
  with check (exists (
    select 1 from public.automation_hub_organizations o
    where o.id = organization_id and o.owner_user_id = (select auth.uid())
  ));
create policy "ah_integration_update_owner" on public.automation_hub_integrations
  for update to authenticated
  using (exists (
    select 1 from public.automation_hub_organizations o
    where o.id = organization_id and o.owner_user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.automation_hub_organizations o
    where o.id = organization_id and o.owner_user_id = (select auth.uid())
  ));

-- Every run produced by the existing owner-checking RPC respects the workspace toggle.
-- Its existing behavior is unchanged when there is no setting row (enabled by default).
create or replace function automation_hub_private.ah_require_in_app_enabled()
returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if exists (
    select 1 from public.automation_hub_integrations i
    where i.organization_id = new.organization_id and i.in_app_enabled = false
  ) then
    raise exception 'In-app notifications are disabled for this workspace'
      using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function automation_hub_private.ah_require_in_app_enabled() from public, anon, authenticated;

create trigger ah_require_in_app_enabled_before_run
  before insert on public.automation_runs
  for each row execute function automation_hub_private.ah_require_in_app_enabled();
