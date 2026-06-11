/**
 * POST /api/email/unsubscribe — anula a subscrição de emails (RGPD).
 *
 * Público (sem auth): o link vem no rodapé dos emails de automação.
 * Body: { o: organizationId, e: email, t: token HMAC }.
 * O token é validado contra o secret 'email_unsubscribe_secret' do Vault
 * (RPC service_role). Token válido → contacts.email_opt_out = true para
 * todos os contactos dessa org com esse email.
 *
 * Não expõe se o email existe ou não (resposta igual com 0 ou N contactos).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createStaticAdminClient } from '@/lib/supabase/staticAdminClient';
import { escapeIlike, unsubscribeToken } from '@/lib/messaging/emailCompliance';

export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(request: NextRequest) {
  let body: { o?: string; e?: string; t?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
  }

  const orgId = String(body.o ?? '').trim();
  const email = String(body.e ?? '').trim().toLowerCase();
  const token = String(body.t ?? '').trim();

  if (!UUID_RE.test(orgId) || !EMAIL_RE.test(email) || !/^[0-9a-f]{64}$/.test(token)) {
    return NextResponse.json({ ok: false, error: 'invalid_params' }, { status: 400 });
  }

  const supabase = createStaticAdminClient();

  const { data: secret, error: secretErr } = await supabase.rpc('get_email_unsubscribe_secret');
  if (secretErr || typeof secret !== 'string' || secret.length === 0) {
    return NextResponse.json({ ok: false, error: 'unavailable' }, { status: 503 });
  }

  const expected = await unsubscribeToken(orgId, email, secret);
  if (!constantTimeEqual(expected, token)) {
    return NextResponse.json({ ok: false, error: 'invalid_token' }, { status: 400 });
  }

  const { error: updateErr } = await supabase
    .from('contacts')
    .update({ email_opt_out: true })
    .eq('organization_id', orgId)
    .ilike('email', escapeIlike(email));
  if (updateErr) {
    return NextResponse.json({ ok: false, error: 'update_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
