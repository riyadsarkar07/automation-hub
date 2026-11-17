import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { sendTelegramMessage, telegramAdmin, telegramConfigured } from '@/lib/telegram';

export const runtime = 'nodejs';

type TelegramUpdate = {
  update_id?: number;
  message?: {
    text?: string;
    chat?: { id?: number; type?: string };
    from?: { is_bot?: boolean; username?: string };
  };
};

const ok = () => NextResponse.json({ ok: true });

export async function POST(request: Request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  const received = request.headers.get('x-telegram-bot-api-secret-token') || '';
  if (!telegramConfigured() || !expected) return new Response(null, { status: 503 });
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  if (!left.length || left.length !== right.length || !timingSafeEqual(left, right)) {
    return new Response(null, { status: 401 });
  }
  if (Number(request.headers.get('content-length') || 0) > 65536) {
    return new Response(null, { status: 413 });
  }
  let update: TelegramUpdate;
  try {
    const raw = await request.text();
    if (raw.length > 65536) return new Response(null, { status: 413 });
    update = JSON.parse(raw) as TelegramUpdate;
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!Number.isSafeInteger(update.update_id) || (update.update_id ?? -1) < 0) {
    return new Response(null, { status: 400 });
  }

  const admin = telegramAdmin();
  const { error: dedupError } = await admin.from('automation_hub_telegram_webhook_updates')
    .insert({ update_id: update.update_id });
  if (dedupError) {
    if (dedupError.code === '23505') return ok();
    return new Response(null, { status: 503 });
  }

  const msg = update.message;
  const chatId = msg?.chat?.id;
  if (!Number.isSafeInteger(chatId) || !chatId || chatId <= 0 ||
      msg?.chat?.type !== 'private' || msg.from?.is_bot) return ok();
  const text = typeof msg.text === 'string' ? msg.text.trim() : '';
  if (!text) return ok();

  const start = /^\/start(?:@automated_hub_bot)?(?:\s+([a-zA-Z0-9_-]{32}))?$/i.exec(text);
  if (start) {
    const code = start[1];
    if (!code) {
      await sendTelegramMessage(chatId, 'Open Automation Hub → Integrations → Telegram and select Connect to link your workspace.');
      return ok();
    }
    const codeHash = createHash('sha256').update(code).digest('hex');
    const { data: requestRecord, error } = await admin.from('automation_hub_telegram_link_requests')
      .select('organization_id,expires_at').eq('code_hash', codeHash).maybeSingle();
    if (error || !requestRecord || Date.parse(requestRecord.expires_at) < Date.now()) {
      await sendTelegramMessage(chatId, 'That link is invalid or expired. Generate a new link in Automation Hub.');
      return ok();
    }
    const { error: linkError } = await admin.from('automation_hub_telegram_links')
      .upsert({
        organization_id: requestRecord.organization_id,
        chat_id: chatId,
        username: (msg.from?.username || '').slice(0, 32) || null,
        auto_reply_enabled: false,
      }, { onConflict: 'organization_id' });
    if (linkError) {
      await sendTelegramMessage(chatId, 'This Telegram chat could not be linked. It may already belong to another workspace.');
      return ok();
    }
    await admin.from('automation_hub_telegram_link_requests')
      .delete().eq('organization_id', requestRecord.organization_id);
    await sendTelegramMessage(chatId, '✅ Telegram connected to your Automation Hub workspace. You can now enable auto replies and test notifications in Integrations.');
    return ok();
  }

  if (/^\/stop(?:@automated_hub_bot)?$/i.test(text)) {
    await admin.from('automation_hub_telegram_links').delete().eq('chat_id', chatId);
    await sendTelegramMessage(chatId, 'Telegram notifications stopped. Reconnect from Automation Hub to enable them again.');
    return ok();
  }

  const { data: link } = await admin.from('automation_hub_telegram_links')
    .select('organization_id,auto_reply_enabled').eq('chat_id', chatId).maybeSingle();
  if (!link?.auto_reply_enabled || text.startsWith('/')) return ok();

  // At most one automatic reply per chat per minute; no arbitrary AI or external data.
  const threshold = new Date(Date.now() - 60_000).toISOString();
  const { data: reserved } = await admin.from('automation_hub_telegram_links')
    .update({ last_auto_reply_at: new Date().toISOString() })
    .eq('organization_id', link.organization_id)
    .eq('auto_reply_enabled', true)
    .or('last_auto_reply_at.is.null,last_auto_reply_at.lt.' + threshold)
    .select('chat_id').maybeSingle();
  if (reserved) {
    await sendTelegramMessage(chatId, 'Thanks for your message! ✅ This is the Automation Hub auto-reply. Open your dashboard to manage integrations.');
  }
  return ok();
}
