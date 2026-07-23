// TAREFAS Fase 2 — callback do OAuth Google.
// Valida o state, troca o código por tokens, guarda o refresh token no Vault,
// cria o calendário dedicado e marca todas as tarefas por fazer para irem para
// lá. Erros voltam às definições com um código legível (nunca 500 cru).
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createStaticAdminClient } from '@/lib/supabase/server';
import { exchangeCodeForTokens, getGoogleAppCredentials } from '@/lib/integrations/google/oauth';
import { createDedicatedCalendar } from '@/lib/integrations/google/calendar';
import { googleRedirectUri, googleRefreshTokenSecretName } from '@/lib/integrations/google/config';

function back(origin: string, params: Record<string, string>): NextResponse {
  const qs = new URLSearchParams(params).toString();
  return NextResponse.redirect(new URL(`/settings/integracoes?${qs}#google-calendar`, origin));
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const url = req.nextUrl;

  if (url.searchParams.get('error')) {
    return back(origin, { google: 'cancelado' });
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = req.cookies.get('google_oauth_state')?.value;
  if (!code || !state || !cookieState || state !== cookieState) {
    return back(origin, { google: 'estado_invalido' });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login', origin));

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.role !== 'admin' || !profile.organization_id) {
    return back(origin, { google: 'sem_permissao' });
  }
  const orgId = profile.organization_id as string;

  try {
    const { clientId, clientSecret } = await getGoogleAppCredentials();
    const tokens = await exchangeCodeForTokens(clientId, clientSecret, googleRedirectUri(origin), code);

    if (!tokens.refreshToken) {
      // Sem refresh token não conseguimos manter a ligação viva.
      return back(origin, { google: 'sem_refresh' });
    }

    const admin = createStaticAdminClient();

    // Uma integração Google por organização.
    const { data: existing } = await admin
      .from('automation_integrations')
      .select('id, metadata')
      .eq('organization_id', orgId)
      .eq('provider', 'google')
      .maybeSingle();

    let integrationId = existing?.id as string | undefined;
    if (!integrationId) {
      const { data: inserted, error: insErr } = await admin
        .from('automation_integrations')
        .insert({
          organization_id: orgId,
          provider: 'google',
          auth_type: 'oauth2',
          account_name: 'Google Calendar',
          status: 'active',
          metadata: { connected_by: user.id },
          created_by: user.id,
        })
        .select('id')
        .single();
      if (insErr || !inserted) throw new Error(insErr?.message || 'Falha ao criar a integração.');
      integrationId = inserted.id;
    }
    if (!integrationId) throw new Error('Integração sem identificador após o upsert.');

    // Refresh token no Vault (nunca em texto simples no schema public).
    const secretName = googleRefreshTokenSecretName(integrationId);
    const { error: tokErr } = await admin.rpc('google_oauth_store_token', {
      p_name: secretName,
      p_token: tokens.refreshToken,
    });
    if (tokErr) throw new Error(`Falha ao guardar o refresh token no Vault: ${tokErr.message}`);

    // Calendário dedicado: reaproveita o que já existir, senão cria.
    const prevMeta = (existing?.metadata as Record<string, unknown> | undefined) ?? {};
    let calendarId = (prevMeta.calendar_id as string | undefined) ?? null;
    if (!calendarId) {
      calendarId = await createDedicatedCalendar(tokens.accessToken);
    }

    await admin
      .from('automation_integrations')
      .update({
        status: 'active',
        account_name: 'Google Calendar',
        metadata: {
          ...prevMeta,
          connected_by: user.id,
          calendar_id: calendarId,
          token_secret_name: secretName,
        },
        last_error: null,
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', integrationId);

    // Primeira carga: tudo o que está por fazer vai para o calendário.
    // (O trigger só marca a partir de agora; isto apanha o que já existia.)
    await admin
      .from('activities')
      .update({ google_sync_pending: true })
      .eq('organization_id', orgId)
      .eq('completed', false)
      .is('deleted_at', null);

    const res = back(origin, { google: 'ligado' });
    res.cookies.delete('google_oauth_state');
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido.';
    const res = back(origin, { google: 'erro', detalhe: msg.slice(0, 180) });
    res.cookies.delete('google_oauth_state');
    return res;
  }
}
