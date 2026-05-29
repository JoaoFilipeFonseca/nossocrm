// ============================================================================
// oauth.ts — helpers server-only do OAuth Meta (Facebook Login for Business)
// ============================================================================
// Épico Meta Ads, Fase A, Commit 2.
//   - Lê App ID/Secret do Vault via RPC (get_meta_app_credentials).
//   - Constrói a URL de autorização.
//   - Troca código -> token curto -> token de longa duração.
//   - Lista Páginas e contas de anúncios.
//   - Subscreve uma Página ao campo `leadgen`.
// Não guarda nada: a persistência (Vault + automation_integrations) é feita na
// rota de callback. Todas as funções lançam Error com mensagem PT em falha.
// ============================================================================
import 'server-only';
import { createStaticAdminClient } from '@/lib/supabase/server';
import {
  META_GRAPH_BASE,
  META_OAUTH_DIALOG,
  META_OAUTH_SCOPES,
} from './config';

export interface MetaAppCreds {
  appId: string;
  appSecret: string;
}

export interface MetaPage {
  id: string;
  name: string;
  access_token: string;
}

export interface MetaAdAccount {
  id: string;
  name: string;
  account_id: string;
}

/** Lê as credenciais da app Meta do Vault (server-only, service_role). */
export async function getMetaAppCredentials(): Promise<MetaAppCreds> {
  const admin = createStaticAdminClient();
  const { data, error } = await admin.rpc('get_meta_app_credentials');
  if (error) {
    throw new Error(`Falha ao ler as credenciais Meta do Vault: ${error.message}`);
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.app_id || !row?.app_secret) {
    throw new Error('Credenciais da app Meta ausentes no Vault (meta_app_id / meta_app_secret).');
  }
  return { appId: row.app_id, appSecret: row.app_secret };
}

/** URL do diálogo de autorização do Facebook. */
export function buildAuthUrl(appId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    scope: META_OAUTH_SCOPES,
    response_type: 'code',
  });
  return `${META_OAUTH_DIALOG}?${params.toString()}`;
}

async function graphJson(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(url, init);
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    // corpo não-JSON
  }
  if (!res.ok) {
    const err = json?.error as { message?: string } | undefined;
    throw new Error(err?.message || `Erro da Graph API (HTTP ${res.status}).`);
  }
  return json;
}

/** Troca o código de autorização por um token curto. */
export async function exchangeCodeForToken(
  appId: string,
  appSecret: string,
  redirectUri: string,
  code: string,
): Promise<string> {
  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });
  const json = await graphJson(`${META_GRAPH_BASE}/oauth/access_token?${params.toString()}`);
  const token = json.access_token as string | undefined;
  if (!token) throw new Error('A troca de código não devolveu um token.');
  return token;
}

/** Estende um token curto para token de longa duração (~60 dias). */
export async function exchangeForLongLivedToken(
  appId: string,
  appSecret: string,
  shortToken: string,
): Promise<string> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortToken,
  });
  const json = await graphJson(`${META_GRAPH_BASE}/oauth/access_token?${params.toString()}`);
  const token = json.access_token as string | undefined;
  if (!token) throw new Error('Não foi possível obter o token de longa duração.');
  return token;
}

/** Lista as Páginas geridas pelo utilizador (inclui token de Página). */
export async function fetchUserPages(userToken: string): Promise<MetaPage[]> {
  const json = await graphJson(
    `${META_GRAPH_BASE}/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(userToken)}`,
  );
  return ((json.data as MetaPage[]) ?? []).filter((p) => p.id && p.access_token);
}

/**
 * Lista as contas de anúncios. Não bloqueia a ligação se falhar (a permissão
 * de ads pode não estar concedida ainda); a Fase A só precisa das Páginas.
 */
export async function fetchAdAccounts(userToken: string): Promise<MetaAdAccount[]> {
  try {
    const json = await graphJson(
      `${META_GRAPH_BASE}/me/adaccounts?fields=id,name,account_id&access_token=${encodeURIComponent(userToken)}`,
    );
    return (json.data as MetaAdAccount[]) ?? [];
  } catch {
    return [];
  }
}

/** Subscreve uma Página ao campo `leadgen` (recebe leads no webhook). */
export async function subscribePageToLeadgen(pageId: string, pageAccessToken: string): Promise<void> {
  const json = await graphJson(`${META_GRAPH_BASE}/${pageId}/subscribed_apps`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      subscribed_fields: 'leadgen',
      access_token: pageAccessToken,
    }).toString(),
  });
  if (json.success === false) {
    throw new Error('A Meta recusou a subscrição da Página ao leadgen.');
  }
}
