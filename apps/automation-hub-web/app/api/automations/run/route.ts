import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';
import { isSameOrigin, reserveTelegramSend, sendTelegramMessage, telegramConfigured } from '@/lib/telegram';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  const client = await serverClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 2048) return NextResponse.json({ error: 'Request too large' }, { status: 413 });
  let body: { automation_id?: string };
  try { body = await request.json() as { automation_id?: string }; }
  catch { return NextResponse.json({ error: 'Invalid JSON request' }, { status: 400 }); }
  if (!body || typeof body.automation_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.automation_id)) {
    return NextResponse.json({ error: 'Invalid automation ID' }, { status: 400 });
  }

  // RLS restricts automation lookup and RPC to the authenticated workspace owner.
  const { data: automation, error: automationError } = await client.from('automation_instances')
    .select('id,name,message,organization_id').eq('id', body.automation_id).maybeSingle();
  if (automationError || !automation) return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
  const { data: runId, error: runError } = await client.rpc('ah_run_in_app_notice', {
    p_automation_id: automation.id, p_idempotency_key: randomUUID(),
  });
  if (runError) return NextResponse.json({ error: runError.message }, { status: 400 });

  let telegram: 'not_configured' | 'not_linked' | 'rate_limited' | 'delivered' | 'delivery_failed' =
    telegramConfigured() ? 'not_linked' : 'not_configured';
  if (telegramConfigured()) {
    const { data: link } = await client.from('automation_hub_telegram_links')
      .select('organization_id').eq('organization_id', automation.organization_id).maybeSingle();
    if (link) {
      try {
        const chatId = await reserveTelegramSend(automation.organization_id);
        if (chatId) {
          await sendTelegramMessage(chatId, '✅ Automation Hub notification\n' + automation.name + '\n' + automation.message);
          telegram = 'delivered';
        } else telegram = 'rate_limited';
      } catch {
        telegram = 'delivery_failed';
      }
    }
  }
  return NextResponse.json({ ok: true, run_id: runId, telegram }, { headers: { 'Cache-Control': 'no-store' } });
}
