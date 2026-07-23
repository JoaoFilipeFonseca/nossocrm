/**
 * GET  /api/integrations/google/status  — estado da ligação ao Google Calendar.
 * POST /api/integrations/google/status  — { action: 'disconnect' } desliga.
 *
 * Só admin da organização. Nunca devolve tokens ao cliente.
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createStaticAdminClient } from '@/lib/supabase/server';
import { getGoogleIntegration } from '@/lib/integrations/google/server';
import { getGoogleAppCredentials, revokeToken } from '@/lib/integrations/google/oauth';
import { googleRefreshTokenSecretName } from '@/lib/integrations/google/config';

async function requireAdmin(): Promise<
  { ok: true; orgId: string } | { ok: false; res: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.role !== 'admin' || !profile.organization_id) {
    return { ok: false, res: NextResponse.json({ error: 'Sem permissão' }, { status: 403 }) };
  }
  return { ok: true, orgId: profile.organization_id as string };
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;

  const admin = createStaticAdminClient();
  const integration = await getGoogleIntegration(admin, auth.orgId);

  // Há credenciais da app no Vault? (passo do João no Google Cloud)
  let appConfigured = true;
  try {
    await getGoogleAppCredentials();
  } catch {
    appConfigured = false;
  }

  if (!integration) {
    return NextResponse.json({ connected: false, appConfigured });
  }

  // Quantas tarefas estão à espera de ir para o calendário.
  const { count: pendentes } = await admin
    .from('activities')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', auth.orgId)
    .eq('google_sync_pending', true);

  const { count: espelhadas } = await admin
    .from('activities')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', auth.orgId)
    .not('google_event_id', 'is', null);

  return NextResponse.json({
    connected: integration.status === 'active',
    appConfigured,
    status: integration.status,
    calendarReady: !!integration.calendarId,
    lastError: integration.lastError,
    lastUsedAt: integration.lastUsedAt,
    pendentes: pendentes ?? 0,
    espelhadas: espelhadas ?? 0,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;

  let body: { action?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* corpo vazio */
  }
  if (body.action !== 'disconnect') {
    return NextResponse.json({ error: 'Acção desconhecida' }, { status: 400 });
  }

  const admin = createStaticAdminClient();
  const integration = await getGoogleIntegration(admin, auth.orgId);
  if (!integration) return NextResponse.json({ ok: true, alreadyDisconnected: true });

  const secretName = googleRefreshTokenSecretName(integration.id);

  // Revoga no Google (best-effort) e apaga o refresh token do Vault.
  try {
    const { data: refreshToken } = await admin.rpc('google_oauth_read_token', { p_name: secretName });
    if (refreshToken) await revokeToken(refreshToken as string);
  } catch {
    /* best-effort */
  }
  try {
    await admin.rpc('google_oauth_delete_token', { p_name: secretName });
  } catch {
    /* best-effort */
  }

  // Marca a integração como desligada (o trigger deixa de disparar).
  await admin
    .from('automation_integrations')
    .update({ status: 'disabled', last_error: null, updated_at: new Date().toISOString() })
    .eq('id', integration.id);

  // Limpa os vestígios nas tarefas: o calendário fica como está no Google, mas
  // o CRM deixa de o considerar seu (se religar, volta a criar tudo).
  await admin
    .from('activities')
    .update({ google_event_id: null, google_sync_pending: false, google_sync_error: null })
    .eq('organization_id', auth.orgId)
    .not('google_event_id', 'is', null);

  return NextResponse.json({ ok: true });
}
