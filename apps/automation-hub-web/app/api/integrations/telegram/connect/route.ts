import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';
import { TELEGRAM_BOT_USERNAME, isSameOrigin, telegramConfigured } from '@/lib/telegram';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  if (!telegramConfigured()) return NextResponse.json({ error: 'Telegram setup is not active yet' }, { status: 503 });
  const client = await serverClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

  const { data: org, error: orgError } = await client.from('automation_hub_organizations')
    .select('id').eq('owner_user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle();
  if (orgError) return NextResponse.json({ error: 'Unable to read workspace' }, { status: 500 });
  if (!org) return NextResponse.json({ error: 'Create your workspace first' }, { status: 409 });

  const code = randomBytes(24).toString('base64url'); // 32 chars, 192 bits of entropy.
  const code_hash = createHash('sha256').update(code).digest('hex');
  const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { error } = await client.from('automation_hub_telegram_link_requests')
    .upsert({ organization_id: org.id, code_hash, expires_at, created_at: new Date().toISOString() },
      { onConflict: 'organization_id' });
  if (error) return NextResponse.json({ error: 'Unable to issue one-time link' }, { status: 500 });

  return NextResponse.json(
    { url: 'https://t.me/' + TELEGRAM_BOT_USERNAME + '?start=' + code, expires_at },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
