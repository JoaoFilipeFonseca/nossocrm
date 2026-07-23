// ============================================================================
// server.ts — estado da integração Google por organização (server-only)
// ============================================================================
// Lê a integração de `automation_integrations` (provider 'google'), renova o
// access token a partir do refresh token do Vault e garante que o calendário
// dedicado existe. Usado pela rota de sincronização e pela rota de estado.
// ============================================================================
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getGoogleAppCredentials, refreshAccessToken } from './oauth';
import { calendarExists, createDedicatedCalendar } from './calendar';
import { googleRefreshTokenSecretName } from './config';

// deno-lint-ignore no-explicit-any
type Admin = SupabaseClient<any, 'public', any>;

export interface GoogleIntegration {
  id: string;
  organizationId: string;
  status: string;
  accountName: string | null;
  calendarId: string | null;
  lastError: string | null;
  lastUsedAt: string | null;
}

interface IntegrationRow {
  id: string;
  organization_id: string;
  status: string;
  account_name: string | null;
  metadata: Record<string, unknown> | null;
  last_error: string | null;
  last_used_at: string | null;
}

function toIntegration(row: IntegrationRow): GoogleIntegration {
  return {
    id: row.id,
    organizationId: row.organization_id,
    status: row.status,
    accountName: row.account_name,
    calendarId: (row.metadata?.calendar_id as string | undefined) ?? null,
    lastError: row.last_error,
    lastUsedAt: row.last_used_at,
  };
}

/** Devolve a integração Google da org, ou null se nunca foi ligada. */
export async function getGoogleIntegration(admin: Admin, orgId: string): Promise<GoogleIntegration | null> {
  const { data } = await admin
    .from('automation_integrations')
    .select('id, organization_id, status, account_name, metadata, last_error, last_used_at')
    .eq('organization_id', orgId)
    .eq('provider', 'google')
    .maybeSingle();
  return data ? toIntegration(data as IntegrationRow) : null;
}

/** Lista as orgs com a integração Google activa (usado pelo drenar do cron). */
export async function listActiveGoogleOrgs(admin: Admin): Promise<GoogleIntegration[]> {
  const { data } = await admin
    .from('automation_integrations')
    .select('id, organization_id, status, account_name, metadata, last_error, last_used_at')
    .eq('provider', 'google')
    .eq('status', 'active');
  return ((data ?? []) as IntegrationRow[]).map(toIntegration);
}

export interface GoogleSession {
  integrationId: string;
  accessToken: string;
  calendarId: string;
}

/**
 * Prepara uma sessão pronta a escrever: access token fresco + calendário
 * garantido. Lança Error com mensagem PT se a integração não estiver utilizável.
 */
export async function openGoogleSession(admin: Admin, integration: GoogleIntegration): Promise<GoogleSession> {
  const { clientId, clientSecret } = await getGoogleAppCredentials();

  const secretName = googleRefreshTokenSecretName(integration.id);
  const { data: refreshToken, error: readErr } = await admin.rpc('google_oauth_read_token', {
    p_name: secretName,
  });
  if (readErr) throw new Error(`Falha ao ler o refresh token do Vault: ${readErr.message}`);
  if (!refreshToken) throw new Error('Sem refresh token guardado. É preciso religar a conta Google.');

  const tokens = await refreshAccessToken(clientId, clientSecret, refreshToken as string);

  // O Google pode devolver um refresh token novo — se vier, substitui o antigo.
  if (tokens.refreshToken && tokens.refreshToken !== refreshToken) {
    await admin.rpc('google_oauth_store_token', { p_name: secretName, p_token: tokens.refreshToken });
  }

  // Calendário dedicado: cria se ainda não existe (ou se foi apagado à mão).
  let calendarId = integration.calendarId;
  if (calendarId && !(await calendarExists(tokens.accessToken, calendarId))) {
    calendarId = null;
  }
  if (!calendarId) {
    calendarId = await createDedicatedCalendar(tokens.accessToken);
    const { data: cur } = await admin
      .from('automation_integrations')
      .select('metadata')
      .eq('id', integration.id)
      .maybeSingle();
    const metadata = ((cur?.metadata as Record<string, unknown>) ?? {}) as Record<string, unknown>;
    await admin
      .from('automation_integrations')
      .update({ metadata: { ...metadata, calendar_id: calendarId }, updated_at: new Date().toISOString() })
      .eq('id', integration.id);
  }

  return { integrationId: integration.id, accessToken: tokens.accessToken, calendarId };
}

/** Regista o resultado de uma corrida na integração (para a UI mostrar). */
export async function markIntegration(
  admin: Admin,
  integrationId: string,
  error: string | null,
): Promise<void> {
  try {
    await admin
      .from('automation_integrations')
      .update({
        last_error: error,
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...(error ? {} : { status: 'active' }),
      })
      .eq('id', integrationId);
  } catch {
    /* best-effort */
  }
}
