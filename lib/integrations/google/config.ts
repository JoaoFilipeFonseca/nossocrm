// ============================================================================
// config.ts — constantes da integração Google Calendar (Fase 2 das Tarefas)
// ============================================================================
// O CRM é a fonte da verdade: as tarefas (activities) são empurradas para um
// calendário DEDICADO do Google ("Foco Imo — Tarefas"). Um sentido só.
// ============================================================================

export const GOOGLE_OAUTH_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_OAUTH_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
export const GOOGLE_CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3';

/**
 * Scope mínimo: só dá acesso a calendários criados PELA PRÓPRIA APP.
 * O CRM não vê nem toca no resto da agenda do consultor — só no calendário
 * "Foco Imo — Tarefas" que ele próprio cria. (Regra de privacidade do João.)
 */
export const GOOGLE_OAUTH_SCOPES = ['https://www.googleapis.com/auth/calendar.app.created'].join(' ');

/** Nome do calendário dedicado criado no Google. */
export const GOOGLE_CALENDAR_NAME = 'Foco Imo — Tarefas';

/** Fuso das tarefas (Portugal continental). */
export const GOOGLE_CALENDAR_TIMEZONE = 'Europe/Lisbon';

/** Duração por omissão de uma tarefa com hora marcada (minutos). */
export const GOOGLE_EVENT_DEFAULT_MINUTES = 30;

/**
 * URL de callback do OAuth. Tem de coincidir EXACTAMENTE com uma das
 * "Authorized redirect URIs" do cliente OAuth no Google Cloud Console.
 */
export function googleRedirectUri(origin: string): string {
  return `${origin}/api/integrations/google/oauth/callback`;
}

/** Nome canónico do segredo do Vault com o refresh token de uma integração. */
export function googleRefreshTokenSecretName(integrationId: string): string {
  return `google_oauth_refresh_${integrationId}`;
}
