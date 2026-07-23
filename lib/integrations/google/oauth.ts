// ============================================================================
// oauth.ts — helpers server-only do OAuth Google (Calendar)
// ============================================================================
// Espelha o padrão do Meta (lib/integrations/meta/oauth.ts):
//   - Lê Client ID/Secret do Vault via RPC (get_google_oauth_credentials).
//   - Constrói a URL de autorização (com access_type=offline p/ refresh token).
//   - Troca código -> tokens; renova o access token a partir do refresh token.
// O refresh token NUNCA fica em texto simples no schema public: vive no Vault.
// ============================================================================
import 'server-only';
import { createStaticAdminClient } from '@/lib/supabase/server';
import {
  GOOGLE_OAUTH_AUTH_URL,
  GOOGLE_OAUTH_REVOKE_URL,
  GOOGLE_OAUTH_SCOPES,
  GOOGLE_OAUTH_TOKEN_URL,
} from './config';

export interface GoogleAppCreds {
  clientId: string;
  clientSecret: string;
}

export interface GoogleTokenSet {
  accessToken: string;
  /** Só vem na primeira autorização (ou com prompt=consent). */
  refreshToken: string | null;
  expiresInSeconds: number;
}

/** Lê as credenciais da app Google do Vault (server-only, service_role). */
export async function getGoogleAppCredentials(): Promise<GoogleAppCreds> {
  const admin = createStaticAdminClient();
  const { data, error } = await admin.rpc('get_google_oauth_credentials');
  if (error) {
    throw new Error(`Falha ao ler as credenciais Google do Vault: ${error.message}`);
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.client_id || !row?.client_secret) {
    throw new Error(
      'Credenciais da app Google ausentes no Vault (google_oauth_client_id / google_oauth_client_secret).',
    );
  }
  return { clientId: row.client_id, clientSecret: row.client_secret };
}

/**
 * URL do diálogo de consentimento do Google.
 * `access_type=offline` + `prompt=consent` garantem que recebemos SEMPRE um
 * refresh token (sem isto, uma segunda autorização não devolve refresh token).
 */
export function buildAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_OAUTH_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `${GOOGLE_OAUTH_AUTH_URL}?${params.toString()}`;
}

async function tokenRequest(body: URLSearchParams): Promise<Record<string, unknown>> {
  const res = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    // corpo não-JSON
  }
  if (!res.ok) {
    const desc = (json.error_description as string) || (json.error as string) || `HTTP ${res.status}`;
    throw new Error(`Erro do OAuth Google: ${desc}`);
  }
  return json;
}

/** Troca o código de autorização por access token + refresh token. */
export async function exchangeCodeForTokens(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  code: string,
): Promise<GoogleTokenSet> {
  const json = await tokenRequest(
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code,
    }),
  );
  const accessToken = json.access_token as string | undefined;
  if (!accessToken) throw new Error('A troca de código não devolveu um access token.');
  return {
    accessToken,
    refreshToken: (json.refresh_token as string | undefined) ?? null,
    expiresInSeconds: Number(json.expires_in) || 3600,
  };
}

/** Renova o access token a partir do refresh token guardado no Vault. */
export async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<GoogleTokenSet> {
  const json = await tokenRequest(
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  );
  const accessToken = json.access_token as string | undefined;
  if (!accessToken) throw new Error('A renovação não devolveu um access token.');
  return {
    accessToken,
    refreshToken: (json.refresh_token as string | undefined) ?? null,
    expiresInSeconds: Number(json.expires_in) || 3600,
  };
}

/** Revoga o acesso no Google (usado ao desligar a integração). Best-effort. */
export async function revokeToken(token: string): Promise<void> {
  try {
    await fetch(GOOGLE_OAUTH_REVOKE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }).toString(),
    });
  } catch {
    /* best-effort: desligar no CRM nunca pode falhar por causa do Google */
  }
}
