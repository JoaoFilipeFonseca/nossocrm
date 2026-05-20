import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const TELEGRAM_API = 'https://api.telegram.org';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://crm-joao.vercel.app';

function randomSecret(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ message: 'Sem organização' }, { status: 404 });
  }
  if (profile.role !== 'admin') {
    return NextResponse.json({ message: 'Só admin pode configurar webhook' }, { status: 403 });
  }

  const { data: org } = await supabase
    .from('organization_settings')
    .select('telegram_bot_token, telegram_webhook_secret')
    .eq('organization_id', profile.organization_id)
    .single();

  if (!org?.telegram_bot_token) {
    return NextResponse.json({ message: 'Falta telegram_bot_token na organização' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action ?? 'register';

  if (action === 'delete') {
    const res = await fetch(`${TELEGRAM_API}/bot${org.telegram_bot_token}/deleteWebhook`, { method: 'POST' });
    const json = await res.json();
    return NextResponse.json({ ok: json.ok, telegram: json });
  }

  // Default: register webhook with fresh secret
  const secret = org.telegram_webhook_secret ?? randomSecret();
  const webhookUrl = `${APP_URL}/api/telegram/webhook`;

  const setRes = await fetch(`${TELEGRAM_API}/bot${org.telegram_bot_token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ['message'],
      drop_pending_updates: true,
    }),
  });
  const setJson = await setRes.json();
  if (!setJson.ok) {
    return NextResponse.json({ message: `Telegram setWebhook falhou: ${setJson.description}` }, { status: 502 });
  }

  // Persist secret
  await supabase
    .from('organization_settings')
    .update({ telegram_webhook_secret: secret })
    .eq('organization_id', profile.organization_id);

  // Check info
  const infoRes = await fetch(`${TELEGRAM_API}/bot${org.telegram_bot_token}/getWebhookInfo`);
  const infoJson = await infoRes.json();

  return NextResponse.json({ ok: true, url: webhookUrl, info: infoJson.result });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single();
  if (!profile?.organization_id) return NextResponse.json({ message: 'Sem organização' }, { status: 404 });
  if (profile.role !== 'admin') return NextResponse.json({ message: 'Só admin' }, { status: 403 });

  const { data: org } = await supabase
    .from('organization_settings')
    .select('telegram_bot_token, telegram_chat_id, telegram_webhook_secret')
    .eq('organization_id', profile.organization_id)
    .single();

  if (!org?.telegram_bot_token) {
    return NextResponse.json({ message: 'Falta telegram_bot_token' }, { status: 400 });
  }

  const infoRes = await fetch(`${TELEGRAM_API}/bot${org.telegram_bot_token}/getWebhookInfo`);
  const infoJson = await infoRes.json();
  return NextResponse.json({
    chat_id: org.telegram_chat_id,
    has_secret: !!org.telegram_webhook_secret,
    webhook: infoJson.result,
  });
}
