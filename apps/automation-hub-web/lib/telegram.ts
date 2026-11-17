import 'server-only';
import { createClient } from '@supabase/supabase-js';

export const TELEGRAM_BOT_USERNAME = 'automated_hub_bot';
const telegramApi = 'https://api.telegram.org/';

export function telegramConfigured(): boolean {
  return Boolean(
    process.env.TELEGRAM_BOT_TOKEN &&
    process.env.TELEGRAM_WEBHOOK_SECRET &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL
  );
}

export function telegramAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Telegram database credentials not configured');
  // Only instantiate in server-only code, never import into a client component.
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('Telegram bot not configured');
  if (!Number.isSafeInteger(chatId) || chatId <= 0 || text.length > 4096) {
    throw new Error('Invalid Telegram message recipient or content');
  }
  const response = await fetch(telegramApi + 'bot' + token + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  });
  const result: { ok?: boolean; description?: string } = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error('Telegram API rejected this message');
  }
}


export async function reserveTelegramSend(organizationId: string): Promise<number | null> {
  const admin = telegramAdmin();
  const threshold = new Date(Date.now() - 60_000).toISOString();
  const { data, error } = await admin.from('automation_hub_telegram_links')
    .update({ last_sent_at: new Date().toISOString() })
    .eq('organization_id', organizationId)
    .or('last_sent_at.is.null,last_sent_at.lt.' + threshold)
    .select('chat_id').maybeSingle();
  if (error) throw new Error('Could not reserve Telegram delivery');
  return data ? Number(data.chat_id) : null;
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  return Boolean(origin && origin === new URL(request.url).origin);
}
