// Run locally with: node --env-file=.env.local scripts/register-telegram-webhook.mjs
// NEVER pass tokens on the command line or commit .env.local.
const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const webhookUrl = 'https://lgcxykpoufenqcfbmdtw.supabase.co/functions/v1/automation-hub-telegram-webhook';
if (!token || !secret || !/^[A-Za-z0-9_-]{32,256}$/.test(secret)) {
  throw new Error('Set TELEGRAM_BOT_TOKEN and a 32-256 character TELEGRAM_WEBHOOK_SECRET in .env.local.');
}
async function call(method, params) {
  const response = await fetch('https://api.telegram.org/bot' + token + '/' + method, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params), signal: AbortSignal.timeout(10000),
  });
  const body = await response.json();
  if (!response.ok || !body.ok) throw new Error('Telegram Bot API call failed: ' + method);
  return body.result;
}
const bot = await call('getMe', {});
if (String(bot.username || '').toLowerCase() !== 'automated_hub_bot') {
  throw new Error('Bot token does not belong to @automated_hub_bot; webhook not registered.');
}
await call('setWebhook', { url: webhookUrl, secret_token: secret, allowed_updates: ['message'], drop_pending_updates: false });
const info = await call('getWebhookInfo', {});
if (info.url !== webhookUrl) throw new Error('Webhook registration did not match the expected URL.');
console.log('Telegram @automated_hub_bot webhook registered successfully.');
console.log('Endpoint:', webhookUrl);
console.log('Pending updates:', info.pending_update_count ?? 'unknown');
