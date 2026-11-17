// Telegram Bot API webhook: independently reachable even while Vercel Preview is protected.
// Secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET (Supabase Edge Secrets).
// Supabase provides SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY at runtime.
import { createClient } from 'npm:@supabase/supabase-js@2.81.1';

type Message = {
  text?: string;
  chat?: { id?: number; type?: string };
  from?: { is_bot?: boolean; username?: string };
};
type Update = { update_id?: number; message?: Message };
const json = (status: number) => new Response(JSON.stringify({ ok: status === 200 }), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

function equalSecret(actual: string, expected: string): boolean {
  if (!expected || !actual || actual.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return mismatch === 0;
}

async function send(chatId: number, text: string, token: string) {
  const response = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('Telegram message delivery failed');
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405);
  const expected = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') || '';
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
  if (!expected || !token) return json(503);
  if (!equalSecret(request.headers.get('x-telegram-bot-api-secret-token') || '', expected)) return json(401);
  if (Number(request.headers.get('content-length') || 0) > 65536) return json(413);
  let update: Update;
  try {
    const text = await request.text();
    if (text.length > 65536) return json(413);
    update = JSON.parse(text);
  } catch { return json(400); }
  if (!Number.isSafeInteger(update.update_id) || (update.update_id ?? -1) < 0) return json(400);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json(503);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: duplicate } = await admin.from('automation_hub_telegram_webhook_updates').insert({ update_id: update.update_id });
  if (duplicate) return duplicate.code === '23505' ? json(200) : json(503);
  const message = update.message;
  const chatId = message?.chat?.id;
  if (!Number.isSafeInteger(chatId) || !chatId || chatId <= 0 || message?.chat?.type !== 'private' || message.from?.is_bot) {
    return json(200);
  }
  const incoming = typeof message.text === 'string' ? message.text.trim() : '';
  if (!incoming) return json(200);

  try {
    const start = /^\/start(?:@automated_hub_bot)?(?:\s+([a-zA-Z0-9_-]{32}))?$/i.exec(incoming);
    if (start) {
      if (!start[1]) {
        await send(chatId, 'Open Automation Hub → Integrations → Telegram and select Connect.', token);
        return json(200);
      }
      const bytes = new TextEncoder().encode(start[1]);
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
        .map(byte => byte.toString(16).padStart(2, '0')).join('');
      const { data: pending } = await admin.from('automation_hub_telegram_link_requests')
        .select('organization_id,expires_at').eq('code_hash', digest).maybeSingle();
      if (!pending || Date.parse(pending.expires_at) < Date.now()) {
        await send(chatId, 'Connection link expired or invalid. Generate another link in Automation Hub.', token);
        return json(200);
      }
      const { error } = await admin.from('automation_hub_telegram_links').upsert({
        organization_id: pending.organization_id, chat_id: chatId,
        username: (message.from?.username || '').slice(0, 32) || null,
        auto_reply_enabled: false,
      }, { onConflict: 'organization_id' });
      if (error) {
        await send(chatId, 'Unable to connect this chat. It may belong to another workspace.', token);
        return json(200);
      }
      await admin.from('automation_hub_telegram_link_requests').delete().eq('organization_id', pending.organization_id);
      await send(chatId, '✅ Telegram connected to your Automation Hub workspace. Enable Auto Reply from Integrations.', token);
      return json(200);
    }

    if (/^\/stop(?:@automated_hub_bot)?$/i.test(incoming)) {
      await admin.from('automation_hub_telegram_links').delete().eq('chat_id', chatId);
      await send(chatId, 'Telegram disconnected from Automation Hub.', token);
      return json(200);
    }

    const { data: link } = await admin.from('automation_hub_telegram_links')
      .select('organization_id,auto_reply_enabled').eq('chat_id', chatId).maybeSingle();
    if (!link?.auto_reply_enabled || incoming.startsWith('/')) return json(200);
    const cutoff = new Date(Date.now() - 60000).toISOString();
    const { data: reserved } = await admin.from('automation_hub_telegram_links')
      .update({ last_auto_reply_at: new Date().toISOString() })
      .eq('organization_id', link.organization_id).eq('auto_reply_enabled', true)
      .or('last_auto_reply_at.is.null,last_auto_reply_at.lt.' + cutoff)
      .select('chat_id').maybeSingle();
    if (reserved) await send(chatId, 'Thanks for your message! ✅ Automation Hub auto-reply received it.', token);
  } catch (err) {
    // Do not log tokens, user messages, or chat identifiers.
    console.error('Telegram webhook update failed:', err instanceof Error ? err.name : 'unknown');
    return json(503);
  }
  return json(200);
});
