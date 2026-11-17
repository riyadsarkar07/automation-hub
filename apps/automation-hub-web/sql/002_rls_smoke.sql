-- Execute only in a disposable Supabase development database with pgTAP/SQL testing access.
-- The assertions below inspect RLS/grants and can be run by a SQL test harness.
do $$
declare missing int;
begin
 select count(*) into missing from (values
 ('automation_hub_organizations'),('automation_instances'),('automation_runs'),('automation_hub_events')
 ) as required(name)
 left join pg_class c on c.relname=required.name
 left join pg_namespace n on n.oid=c.relnamespace and n.nspname='public'
 where c.oid is null or not c.relrowsecurity or n.oid is null;
 if missing>0 then raise exception 'Missing RLS on % required tables',missing; end if;
 if has_table_privilege('authenticated','public.automation_runs','INSERT')
   or has_table_privilege('authenticated','public.automation_hub_events','INSERT')
   or has_table_privilege('anon','public.automation_instances','SELECT') then
   raise exception 'Unsafe data API grants detected';
 end if;
 if has_function_privilege('anon','public.ah_run_in_app_notice(uuid,uuid)','EXECUTE') then
   raise exception 'Anon must not be able to invoke runner';
 end if;
end $$;
-- Before production, run behavioral tests using TWO real Supabase Auth users:
-- User A creates org A and automation A; User B creates org B.
-- Assert B sees zero A rows, cannot insert into org A, cannot run A automation,
-- cannot update its owner/organization reference, and cannot select A events.
