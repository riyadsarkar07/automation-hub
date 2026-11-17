-- Automation Hub: index events by automation_id for efficient FK checks and lookups.
-- Safe additive migration; required for the automation_hub_events_automation_id_fkey.
create index if not exists ah_events_automation_idx
  on public.automation_hub_events (automation_id);
