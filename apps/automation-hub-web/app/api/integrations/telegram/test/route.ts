import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';
import { isSameOrigin, sendTelegramMessage, telegramAdmin, telegramConfigured } from '@/lib/telegram';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  if (!telegramConfigured()) return NextResponse.json({ error: 'Telegram setup is not active yet' }, { status: 503 });

  const client = await serverClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  const { data: org, error: orgError } = await client.from('automation_hub_organizations')
    .select('id').eq('owner_user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle();
  if (orgError || !org) return NextResponse.json({ error: 'Workspace unavailable' }, { status: 404 });
  const { data: link, error: linkError } = await client.from('automation_hub_telegram_links')
    .select('chat_id').eq('organization_id', org.id).maybeSingle();
  if (linkError || !link) return NextResponse.json({ error: 'Connect your Telegram chat first' }, { status: 409 });

  // Server-only atomic cooldown prevents abusive repeated test messages.
  const admin = telegramAdmin();
  const threshold = new Date(Date.now() - 60_000).toISOString();
  const { data: reserved, error: reserveError } = await admin.from('automation_hub_telegram_links')
    .update({ last_test_at: new Date().toISOString() })
    .eq('organization_id', org.id)
    .or('last_test_at.is.null,last_test_at.lt.' + threshold)
    .select('chat_id').maybeSingle();
  if (reserveError) return NextResponse.json({ error: 'Unable to reserve test message' }, { status: 500 });
  if (!reserved) return NextResponse.json({ error: 'Wait a minute before testing again' }, { status: 429 });
  try {
    await sendTelegramMessage(Number(reserved.chat_id), '✅ Automation Hub test notification. Your Telegram integration is connected.');
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Telegram delivery failed. Check your bot and chat settings.' }, { status: 502 });
  }
}
