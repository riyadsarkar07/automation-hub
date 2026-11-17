import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverClient } from '@/lib/supabase/server';
import { DashboardSidebar } from '../sidebar';
import { InAppIntegrationActions } from './in-app-actions';
import { TelegramIntegrationActions } from './telegram-actions';
import { telegramConfigured } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

const plannedProviders = [
  { icon: '✉', name: 'Email', description: 'Send transactional or automation emails through an approved mail provider.', requirement: 'Requires an email delivery provider, a verified domain, and server-side credentials.' },
  { icon: '◉', name: 'WhatsApp', description: 'Send approved business messages through the WhatsApp Business Platform.', requirement: 'Requires Meta business setup, approved templates, access tokens and webhooks.' },
  { icon: 'f', name: 'Facebook Pages', description: 'Respond to Page activity with approved permissions and review.', requirement: 'Requires Meta OAuth, Page permissions, app review and webhook verification.' },
] as const;

export default async function IntegrationsPage() {
  let supabase;
  try {
    supabase = await serverClient();
  } catch {
    return <main className="dashboard-main"><h1>Configuration required</h1><p>Supabase project settings are missing.</p></main>;
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login');

  const orgResult = await supabase
    .from('automation_hub_organizations')
    .select('id,name')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  const org = orgResult.data;

  const [settingResult, automationResult, telegramResult] = org ? await Promise.all([
    supabase.from('automation_hub_integrations')
      .select('in_app_enabled')
      .eq('organization_id', org.id)
      .maybeSingle(),
    supabase.from('automation_instances')
      .select('id')
      .eq('organization_id', org.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('automation_hub_telegram_links')
      .select('organization_id,auto_reply_enabled')
      .eq('organization_id', org.id)
      .maybeSingle(),
  ]) : [{ data: null, error: null }, { data: null, error: null }, { data: null, error: null }];

  const error = orgResult.error || settingResult.error || automationResult.error || telegramResult.error;
  const telegramReady = telegramConfigured();
  const enabled = settingResult.data?.in_app_enabled !== false;

  return (
    <main className="dashboard">
      <DashboardSidebar active="integrations" email={user.email} />
      <section className="dashboard-main integrations-main">
        <header className="dashboard-header">
          <p className="eyebrow">WORKSPACE / INTEGRATIONS</p>
          <span className="status-pill">Owner-scoped</span>
        </header>
        <h1>Integrations</h1>
        <p className="muted integration-lead">
          Manage real workspace connections. The built-in notification channel works today;
          the Telegram bot can be linked by each workspace after secure platform setup. Other providers remain unconfigured.
        </p>
        <div className="integration-stats" aria-label="Integration summary">
          <div><span>Built-in channel</span><strong>{org && enabled ? '1 enabled' : '0 enabled'}</strong></div>
          <div><span>External connections</span><strong>{telegramReady && telegramResult.data ? '1 linked' : '0 connected'}</strong></div>
          <div><span>Workspace</span><strong>{org?.name || 'Not created'}</strong></div>
        </div>
        {error && <p role="alert" className="form-error">Could not load integration settings: {error.message}</p>}
        {!org && !error && (
          <div className="integration-note" role="status">
            <strong>Create a workspace first.</strong>
            <p>Integrations are owned by a workspace so users cannot change another account's settings.</p>
            <Link href="/dashboard">Create your workspace →</Link>
          </div>
        )}
        <div className="integration-section-title">
          <div><span className="eyebrow">READY TO USE</span><h2>Built-in connections</h2></div>
        </div>
        <section className="integration-card integration-featured">
          <div className="integration-card-top">
            <div className="integration-logo" aria-hidden="true">✳</div>
            <div className="integration-card-heading">
              <h3>In-app notifications</h3>
              <p>Run an approved automation to write a real, private notification to your Activity feed. No external credentials needed.</p>
            </div>
          </div>
          {org && !error
            ? <InAppIntegrationActions orgId={org.id} enabled={enabled} settingExists={!!settingResult.data} testAutomationId={automationResult.data?.id} />
            : <p className="integration-help">Available after your workspace settings load.</p>}
        </section>
        <div className="integration-section-title integration-section-spaced">
          <div><span className="eyebrow">TELEGRAM BOT</span><h2>Notification + Auto Reply</h2></div>
          <p className="muted">Platform bot • workspace-owned private chat</p>
        </div>
        <section className="integration-card integration-featured">
          <div className="integration-card-top">
            <div className="integration-logo muted-logo" aria-hidden="true">↗</div>
            <div className="integration-card-heading">
              <h3>@automated_hub_bot</h3>
              <p>Connect your Telegram chat through a one-time deep link. Get test notifications and optionally enable a basic auto reply.</p>
              <p className="integration-help"><a href="https://t.me/automated_hub_bot" target="_blank" rel="noreferrer noopener">Open bot in Telegram ↗</a></p>
            </div>
          </div>
          <TelegramIntegrationActions orgId={org?.id} botReady={telegramReady} linked={Boolean(telegramResult.data)} autoReplyEnabled={telegramResult.data?.auto_reply_enabled === true} />
        </section>
        <div className="integration-section-title integration-section-spaced">
          <div><span className="eyebrow">FUTURE CONNECTIONS</span><h2>External providers</h2></div>
          <p className="muted">No providers connected. These require separate verified setup.</p>
        </div>
        <div className="integration-catalog">
          {plannedProviders.map(provider => (
            <article key={provider.name} className="integration-card">
              <div className="integration-card-top">
                <div className="integration-logo muted-logo" aria-hidden="true">{provider.icon}</div>
                <div className="integration-card-heading">
                  <h3>{provider.name}</h3>
                  <span className="integration-status pending">Not configured</span>
                  <p>{provider.description}</p>
                </div>
              </div>
              <p className="integration-requirement">{provider.requirement}</p>
              <span className="integration-unavailable">Connection setup not yet available</span>
            </article>
          ))}
        </div>
        <p className="disclaimer">Internal notifications run inside Supabase. Telegram delivery requires server-side token setup and a connected private chat. Email, WhatsApp and Facebook remain unavailable. No credentials or OAuth tokens are accepted by this page.</p>
      </section>
    </main>
  );
}
