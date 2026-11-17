'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { browserClient } from '@/lib/supabase/browser';

type Props = { orgId?: string; botReady: boolean; linked: boolean; autoReplyEnabled: boolean };

export function TelegramIntegrationActions({ orgId, botReady, linked, autoReplyEnabled }: Props) {
  const router = useRouter();
  const [isLinked, setIsLinked] = useState(linked);
  const [autoReply, setAutoReply] = useState(autoReplyEnabled);
  const [url, setUrl] = useState('');
  const [expires, setExpires] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { setIsLinked(linked); setAutoReply(autoReplyEnabled); }, [linked, autoReplyEnabled]);

  async function act(work: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('');
    try { await work(); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Telegram request failed.'); }
    finally { setBusy(false); }
  }

  async function post(path: string) {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store' });
    const payload = await response.json() as { error?: string; url?: string; expires_at?: string };
    if (!response.ok) throw new Error(payload.error || 'Request unsuccessful');
    return payload;
  }

  function connect() { void act(async () => {
    const result = await post('/api/integrations/telegram/connect');
    if (!result.url || !result.expires_at) throw new Error('Invalid connect response');
    setUrl(result.url); setExpires(result.expires_at);
    setNotice('Link created. Open it, press Start in Telegram, then return and refresh.');
  }); }
  function test() { void act(async () => {
    await post('/api/integrations/telegram/test');
    setNotice('Telegram accepted the test message. Check your bot chat.');
  }); }
  function toggle() { if (!orgId) return; void act(async () => {
    const { error: dbError } = await browserClient().from('automation_hub_telegram_links')
      .update({ auto_reply_enabled: !autoReply }).eq('organization_id', orgId);
    if (dbError) throw dbError;
    setAutoReply(v => !v);
    setNotice('Auto reply preference updated.');
  }); }
  function disconnect() { if (!orgId) return; void act(async () => {
    const { error: dbError } = await browserClient().from('automation_hub_telegram_links')
      .delete().eq('organization_id', orgId);
    if (dbError) throw dbError;
    setIsLinked(false); setAutoReply(false); setUrl('');
    setNotice('Telegram chat disconnected. /stop in the bot also unlinks the chat.');
  }); }

  return <div className="integration-actions">
    <div className="integration-action-row">
      <span className={'integration-status ' + (isLinked ? 'connected' : 'pending')}>
        {isLinked ? 'Chat connected' : botReady ? 'Not connected' : 'Platform setup required'}
      </span>
      {botReady && orgId && !isLinked && <button type="button" className="integration-button integration-button-accent" onClick={connect} disabled={busy}>Connect Telegram</button>}
      {botReady && orgId && isLinked && <>
        <button type="button" className="integration-button integration-button-accent" onClick={test} disabled={busy}>Send test notification</button>
        <button type="button" className="integration-button" onClick={toggle} disabled={busy}>
          Auto Reply: {autoReply ? 'ON' : 'OFF'}
        </button>
        <button type="button" className="integration-button" onClick={disconnect} disabled={busy}>Disconnect</button>
      </>}
      {isLinked && <button type="button" className="integration-button" onClick={() => router.refresh()} disabled={busy}>Refresh status</button>}
    </div>
    {url && !isLinked && <div className="integration-note">
      <p><a href={url} target="_blank" rel="noreferrer noopener">Open one-time Telegram connect link ↗</a></p>
      <p>Expires at {new Date(expires).toLocaleTimeString()}. Open the link privately; anyone with it can claim the chat until it expires.</p>
      <button type="button" className="integration-button" onClick={() => router.refresh()}>I've pressed Start — refresh status</button>
    </div>}
    {!orgId && <p className="integration-help">Create a workspace first to connect Telegram.</p>}
    {!botReady && <p className="integration-help">The platform owner needs to configure the server-only bot token, webhook verification secret and Supabase service key. Do not paste credentials in this page or chat.</p>}
    {isLinked && <p className="integration-help">Auto Reply is optional and rate-limited to one reply per minute per chat. It is a fixed acknowledgement, not AI-generated. Use /stop in Telegram to unlink.</p>}
    {notice && <p role="status" className="form-success">{notice}</p>}
    {error && <p role="alert" className="form-error">{error}</p>}
  </div>;
}
