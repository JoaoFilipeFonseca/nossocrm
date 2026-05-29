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
  subscribePageToLeadgen,
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

    const baseMetadata = {
      pages: pages.map((p) => ({ id: p.id, name: p.name })),
      ad_accounts: adAccounts,
      connected_by: user.id,
    };

    // Uma integração Meta por organização (upsert manual).
    const { data: existing } = await admin
      .from('automation_integrations')
      .select('id')
      .eq('organization_id', orgId)
      .eq('provider', 'meta')
      .maybeSingle();

    let integrationId = existing?.id as string | undefined;
    if (!integrationId) {
      const { data: inserted, error: insErr } = await admin
        .from('automation_integrations')
        .insert({
          organization_id: orgId,
          provider: 'meta',
          auth_type: 'oauth',
          account_name: pages[0]?.name ?? 'Meta',
          status: 'connecting',
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

    // Subscreve a primeira Página ao leadgen (Fase A: 1 Página).
    let subscribedPageId: string | null = null;
    let subError: string | null = null;
    if (pages.length > 0) {
      try {
        await subscribePageToLeadgen(pages[0].id, pages[0].access_token);
        subscribedPageId = pages[0].id;
      } catch (e) {
        subError = e instanceof Error ? e.message : 'Erro ao subscrever a Página.';
      }
    } else {
      subError = 'Nenhuma Página de Facebook encontrada nesta conta.';
    }

    await admin
      .from('automation_integrations')
      .update({
        status: subscribedPageId ? 'connected' : 'error',
        account_name: pages[0]?.name ?? 'Meta',
        metadata: { ...baseMetadata, token_secret_name: tokenName, subscribed_page_id: subscribedPageId },
        last_error: subError,
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', integrationId);

    const res = subscribedPageId
      ? back(origin, { meta: 'ligado' })
      : back(origin, { meta: 'sem_pagina' });
    res.cookies.delete('meta_oauth_state');
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido.';
    const res = back(origin, { meta: 'erro', detalhe: msg.slice(0, 180) });
    res.cookies.delete('meta_oauth_state');
    return res;
  }
}
