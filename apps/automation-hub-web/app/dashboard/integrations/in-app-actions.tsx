'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { browserClient } from '@/lib/supabase/browser';

type Props = {
  orgId: string;
  enabled: boolean;
  settingExists: boolean;
  testAutomationId?: string;
};

export function InAppIntegrationActions({ orgId, enabled, settingExists, testAutomationId }: Props) {
  const router = useRouter();
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [hasSetting, setHasSetting] = useState(settingExists);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function updateEnabled() {
    if (busy) return;
    const next = !isEnabled;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const client = browserClient();
      const result = hasSetting
        ? await client.from('automation_hub_integrations')
            .update({ in_app_enabled: next }).eq('organization_id', orgId)
        : await client.from('automation_hub_integrations')
            .insert({ organization_id: orgId, in_app_enabled: next });
      if (result.error) throw result.error;
      setHasSetting(true);
      setIsEnabled(next);
      setNotice(next ? 'In-app notifications enabled.' : 'In-app notifications disabled. New runs are blocked.');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update integration.');
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    if (busy || !isEnabled || !testAutomationId) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { error: runError } = await browserClient().rpc('ah_run_in_app_notice', {
        p_automation_id: testAutomationId,
        p_idempotency_key: crypto.randomUUID(),
      });
      if (runError) throw runError;
      setNotice('Real in-app notification created. View it in Activity.');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to run test notification.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="integration-actions">
      <div className="integration-action-row">
        <span className={isEnabled ? 'integration-status connected' : 'integration-status off'}>
          {isEnabled ? 'Enabled' : 'Disabled'}
        </span>
        <button
          type="button"
          className="integration-button"
          aria-label={isEnabled ? 'Disable in-app notifications' : 'Enable in-app notifications'}
          onClick={updateEnabled}
          disabled={busy}
        >
          {busy ? 'Saving…' : isEnabled ? 'Disable' : 'Enable'}
        </button>
        {isEnabled && testAutomationId && (
          <button type="button" className="integration-button integration-button-accent" onClick={sendTest} disabled={busy}>
            Send test notification
          </button>
        )}
      </div>
      {isEnabled && !testAutomationId && (
        <p className="integration-help">Create an active notification automation first to send a test. <Link href="/dashboard#automations">Go to automations</Link></p>
      )}
      {notice && <p className="form-success" role="status">{notice} <Link href="/dashboard#activity">View activity</Link></p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
