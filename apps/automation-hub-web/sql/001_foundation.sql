-- Automation Hub: owner-scoped MVP with explicit RLS; no shared n8n schema.
create extension if not exists pgcrypto;
create table if not exists public.automation_hub_organizations (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  created_at timestamptz not null default now()
);
create index if not exists ah_org_owner_idx on public.automation_hub_organizations(owner_user_id);

create table if not exists public.automation_instances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.automation_hub_organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  kind text not null default 'in_app_notice' check (kind = 'in_app_notice'),
  status text not null default 'active' check (status in ('active','paused')),
  message text not null check (char_length(trim(message)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists ah_instances_org_created_idx on public.automation_instances(organization_id, created_at desc);

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.automation_hub_organizations(id) on delete cascade,
  automation_id uuid not null references public.automation_instances(id) on delete cascade,
  idempotency_key uuid not null,
  status text not null check (status in ('succeeded','failed')),
  summary text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz not null default now(),
  unique (automation_id, idempotency_key)
);
create index if not exists ah_runs_org_started_idx on public.automation_runs(organization_id, started_at desc);

create table if not exists public.automation_hub_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.automation_hub_organizations(id) on delete cascade,
  automation_id uuid not null references public.automation_instances(id) on delete cascade,
  run_id uuid not null unique references public.automation_runs(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);
create index if not exists ah_events_org_created_idx on public.automation_hub_events(organization_id, created_at desc);

alter table public.automation_hub_organizations enable row level security;
alter table public.automation_instances enable row level security;
alter table public.automation_runs enable row level security;
alter table public.automation_hub_events enable row level security;

revoke all on public.automation_hub_organizations,public.automation_instances,public.automation_runs,public.automation_hub_events from anon,authenticated;
grant select,insert on public.automation_hub_organizations to authenticated;
grant select,insert on public.automation_instances to authenticated;
grant update(name,status,message) on public.automation_instances to authenticated;
grant select on public.automation_runs,public.automation_hub_events to authenticated;

create policy "ah_org_read_owner" on public.automation_hub_organizations for select to authenticated
  using (owner_user_id = (select auth.uid()));
create policy "ah_org_create_owner" on public.automation_hub_organizations for insert to authenticated
  with check (owner_user_id = (select auth.uid()));

create policy "ah_instance_read_owner" on public.automation_instances for select to authenticated
  using (exists(select 1 from public.automation_hub_organizations o where o.id=organization_id and o.owner_user_id=(select auth.uid())));
create policy "ah_instance_create_owner" on public.automation_instances for insert to authenticated
  with check (exists(select 1 from public.automation_hub_organizations o where o.id=organization_id and o.owner_user_id=(select auth.uid())));
create policy "ah_instance_update_owner" on public.automation_instances for update to authenticated
  using (exists(select 1 from public.automation_hub_organizations o where o.id=organization_id and o.owner_user_id=(select auth.uid())))
  with check (exists(select 1 from public.automation_hub_organizations o where o.id=organization_id and o.owner_user_id=(select auth.uid())));

create policy "ah_runs_read_owner" on public.automation_runs for select to authenticated
  using (exists(select 1 from public.automation_hub_organizations o where o.id=organization_id and o.owner_user_id=(select auth.uid())));
create policy "ah_events_read_owner" on public.automation_hub_events for select to authenticated
  using (exists(select 1 from public.automation_hub_organizations o where o.id=organization_id and o.owner_user_id=(select auth.uid())));

-- Keep the privileged routine in a private, non-API-exposed schema.
-- The public RPC is SECURITY INVOKER and delegates to the owner-checking routine.
-- Ensure Supabase Data API exposed schemas do NOT include automation_hub_private.
create schema if not exists automation_hub_private;
revoke all on schema automation_hub_private from public, anon;
grant usage on schema automation_hub_private to authenticated;

create or replace function automation_hub_private.ah_run_in_app_notice_internal(p_automation_id uuid, p_idempotency_key uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare a record; existing_run_id uuid; new_run_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Not authenticated' using errcode='28000'; end if;
  select ai.id,ai.organization_id,ai.name,ai.message,ai.status
    into a
    from public.automation_instances ai
    join public.automation_hub_organizations o on o.id=ai.organization_id
    where ai.id=p_automation_id and o.owner_user_id=(select auth.uid());
  if not found then raise exception 'Automation not found' using errcode='42501'; end if;
  if a.status <> 'active' then raise exception 'Automation is paused' using errcode='22023'; end if;
  select id into existing_run_id from public.automation_runs where automation_id=a.id and idempotency_key=p_idempotency_key;
  if existing_run_id is not null then return existing_run_id; end if;
  insert into public.automation_runs(organization_id,automation_id,idempotency_key,status,summary)
    values(a.organization_id,a.id,p_idempotency_key,'succeeded','In-app notification created')
    on conflict(automation_id,idempotency_key) do nothing
    returning id into new_run_id;
  if new_run_id is null then
    select id into new_run_id from public.automation_runs where automation_id=a.id and idempotency_key=p_idempotency_key;
    return new_run_id;
  end if;
  insert into public.automation_hub_events(organization_id,automation_id,run_id,message)
    values(a.organization_id,a.id,new_run_id,a.message);
  return new_run_id;
end;
$$;
revoke all on function automation_hub_private.ah_run_in_app_notice_internal(uuid,uuid) from public, anon;
grant execute on function automation_hub_private.ah_run_in_app_notice_internal(uuid,uuid) to authenticated;

-- Only this invoker-rights wrapper is callable through the public Data API.
create or replace function public.ah_run_in_app_notice(p_automation_id uuid, p_idempotency_key uuid)
returns uuid language sql security invoker set search_path = '' as $
  select automation_hub_private.ah_run_in_app_notice_internal(p_automation_id, p_idempotency_key);
$;
revoke all on function public.ah_run_in_app_notice(uuid,uuid) from public, anon;
grant execute on function public.ah_run_in_app_notice(uuid,uuid) to authenticated;
