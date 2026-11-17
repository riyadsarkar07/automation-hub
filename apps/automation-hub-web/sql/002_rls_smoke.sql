-- Read-only structural permission checks after applying 001_foundation.sql.
-- Execute against ONLY the intended Automation Hub database. Does not replace
-- real two-user Auth/session and Data API behavioral isolation tests.
do $$
declare missing int;
begin
  select count(*) into missing
  from (values ('automation_hub_organizations'), ('automation_instances'),
               ('automation_runs'), ('automation_hub_events')) as required(name)
  left join pg_namespace n on n.nspname = 'public'
  left join pg_class c on c.relnamespace = n.oid
                       and c.relname = required.name and c.relkind in ('r', 'p')
  where c.oid is null or c.relrowsecurity is distinct from true;
  if missing > 0 then
    raise exception 'Missing RLS on % required public tables', missing;
  end if;

  -- All API writes to runs/events must go through the reviewed owner-checking RPC.
  if has_table_privilege('authenticated','public.automation_runs','INSERT')
    or has_table_privilege('authenticated','public.automation_hub_events','INSERT')
    or has_table_privilege('authenticated','public.automation_hub_organizations','UPDATE')
    or has_column_privilege('authenticated','public.automation_instances','organization_id','UPDATE')
    or has_table_privilege('anon','public.automation_instances','SELECT')
    or has_table_privilege('anon','public.automation_hub_organizations','SELECT')
    or has_table_privilege('anon','public.automation_runs','SELECT')
    or has_table_privilege('anon','public.automation_hub_events','SELECT') then
    raise exception 'Unsafe Data API table/column grants detected';
  end if;

  if has_function_privilege('anon','public.ah_run_in_app_notice(uuid,uuid)','EXECUTE')
    or has_function_privilege('anon','automation_hub_private.ah_run_in_app_notice_internal(uuid,uuid)','EXECUTE')
    or has_schema_privilege('anon','automation_hub_private','USAGE')
    or not has_function_privilege('authenticated','public.ah_run_in_app_notice(uuid,uuid)','EXECUTE') then
    raise exception 'Unsafe notification RPC privileges detected';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'ah_run_in_app_notice'
      and p.prosecdef = false
  ) or not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'automation_hub_private'
      and p.proname = 'ah_run_in_app_notice_internal' and p.prosecdef = true
  ) then
    raise exception 'Notification RPC must use an invoker wrapper and private definer';
  end if;
end $$;

-- REQUIRED BEFORE PRODUCTION: test with two real Supabase Auth accounts A and B
-- using their own signed-in clients and the publishable key (never service_role):
-- 1) A creates org A and automation A; B creates org B and automation B.
-- 2) B cannot SELECT A's org, automation, runs, or notification events.
-- 3) B cannot INSERT an automation into org A, UPDATE automation A, or
--    change its organization_id (column permission denied).
-- 4) B cannot RPC-run automation A (must return authorization error);
--    anonymous clients cannot execute the RPC at all.
-- 5) A can run automation A twice with the same idempotency key and sees
--    one run plus one notification event; a paused automation cannot run.
-- 6) Check Database API exposed schemas exclude automation_hub_private.
-- 7) Run Supabase security advisors and inspect grants/policies before launch.
