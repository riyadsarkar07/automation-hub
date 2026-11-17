import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';
import { isSameOrigin, reserveTelegramSend, sendTelegramMessage, telegramConfigured } from '@/lib/telegram';

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

  // One shared cooldown applies to tests and normal automation events.
  let reservedChat: number | null;
  try { reservedChat = await reserveTelegramSend(org.id); }
  catch { return NextResponse.json({ error: 'Unable to reserve test message' }, { status: 500 }); }
  if (!reservedChat) return NextResponse.json({ error: 'Wait a minute before testing again' }, { status: 429 });
  try {
    await sendTelegramMessage(reservedChat, '✅ Automation Hub test notification. Your Telegram integration is connected.');
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Telegram delivery failed. Check your bot and chat settings.' }, { status: 502 });
  }
}
