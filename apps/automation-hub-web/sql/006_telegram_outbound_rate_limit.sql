-- Shared rate-limit timestamp for bot notifications from tests and automation executions.
alter table public.automation_hub_telegram_links
  add column last_sent_at timestamptz;
-- The timestamp is updated only by the server-only service role after
-- verifying the signed-in user owns the workspace.
