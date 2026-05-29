// Épico Meta Ads — Fase A, c2 — callback do OAuth.
// Valida o state, troca código -> token longo, grava a integração + token no
// Vault, subscreve a Página ao leadgen. Erros redireccionam de volta às
// definições com um código legível (nunca 500 cru ao utilizador).
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createStaticAdminClient } from '@/lib/supabase/server';
import {
  getMetaAppCredentials,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  fetchUserPages,
  fetchAdAccounts,
} from '@/lib/integrations/meta/oauth';
import { metaRedirectUri, metaTokenSecretName } from '@/lib/integrations/meta/config';

function back(origin: string, params: Record<string, string>): NextResponse {
  const qs = new URLSearchParams(params).toString();
  return NextResponse.redirect(new URL(`/settings/integracoes?${qs}#meta-ads`, origin));
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const url = req.nextUrl;

  // O utilizador cancelou o diálogo da Meta.
  if (url.searchParams.get('error')) {
    return back(origin, { meta: 'cancelado' });
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = req.cookies.get('meta_oauth_state')?.value;
  if (!code || !state || !cookieState || state !== cookieState) {
    return back(origin, { meta: 'estado_invalido' });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login', origin));

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.role !== 'admin' || !profile.organization_id) {
    return back(origin, { meta: 'sem_permissao' });
  }
  const orgId = profile.organization_id as string;

  try {
    const { appId, appSecret } = await getMetaAppCredentials();
    const redirectUri = metaRedirectUri(origin);

    const shortToken = await exchangeCodeForToken(appId, appSecret, redirectUri, code);
    const longToken = await exchangeForLongLivedToken(appId, appSecret, shortToken);
    const pages = await fetchUserPages(longToken);
    const adAccounts = await fetchAdAccounts(longToken);

    const admin = createStaticAdminClient();

    // Uma integração Meta por organização (upsert manual).
    const { data: existing } = await admin
      .from('automation_integrations')
      .select('id, metadata')
      .eq('organization_id', orgId)
      .eq('provider', 'meta')
      .maybeSingle();

    const baseMetadata = {
      pages: pages.map((p) => ({ id: p.id, name: p.name })),
      ad_accounts: adAccounts,
      connected_by: user.id,
      // Token de handshake do webhook leadgen (não sensível; valida-se também
      // a assinatura HMAC com o App Secret). Reutiliza-se se já existir.
      webhook_verify_token:
        (existing?.metadata as Record<string, unknown> | undefined)?.webhook_verify_token ??
        crypto.randomUUID(),
      // Numa reconexão (ex.: para conceder um novo scope), preservamos a conta
      // de anúncios já escolhida — senão o dashboard/sync/edição ficariam sem
      // conta seleccionada.
      selected_ad_account_id:
        (existing?.metadata as Record<string, unknown> | undefined)?.selected_ad_account_id ?? null,
    };

    let integrationId = existing?.id as string | undefined;
    if (!integrationId) {
      const { data: inserted, error: insErr } = await admin
        .from('automation_integrations')
        .insert({
          organization_id: orgId,
          provider: 'meta',
          auth_type: 'oauth2',
          account_name: pages[0]?.name ?? 'Meta',
          status: 'active',
          metadata: baseMetadata,
          created_by: user.id,
        })
        .select('id')
        .single();
      if (insErr || !inserted) throw new Error(insErr?.message || 'Falha ao criar a integração.');
      integrationId = inserted.id;
    }
    if (!integrationId) throw new Error('Integração sem identificador após o upsert.');

    // Token de longa duração no Vault (nunca em texto simples no schema public).
    const tokenName = metaTokenSecretName(integrationId);
    const { error: tokErr } = await admin.rpc('meta_oauth_store_token', {
      p_name: tokenName,
      p_token: longToken,
    });
    if (tokErr) throw new Error(`Falha ao guardar o token no Vault: ${tokErr.message}`);

    // NÃO subscrevemos nenhuma Página automaticamente: o utilizador escolhe-a
    // a seguir (evita ligar a Página errada e voltar a ela em cada reconexão).
    // Numa reconexão, preservamos a Página já escolhida.
    const prevPageId =
      (existing?.metadata as Record<string, unknown> | undefined)?.subscribed_page_id ?? null;

    await admin
      .from('automation_integrations')
      .update({
        status: 'active',
        account_name:
          (pages.find((p) => p.id === prevPageId)?.name) ?? pages[0]?.name ?? 'Meta',
        metadata: { ...baseMetadata, token_secret_name: tokenName, subscribed_page_id: prevPageId },
        last_error: pages.length === 0 ? 'Nenhuma Página de Facebook encontrada nesta conta.' : null,
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', integrationId);

    const res = back(origin, { meta: pages.length === 0 ? 'sem_pagina' : 'ligado' });
    res.cookies.delete('meta_oauth_state');
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido.';
    const res = back(origin, { meta: 'erro', detalhe: msg.slice(0, 180) });
    res.cookies.delete('meta_oauth_state');
    return res;
  }
}
