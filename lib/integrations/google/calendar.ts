// ============================================================================
// calendar.ts — escrita no Google Calendar (calendário dedicado do CRM)
// ============================================================================
// Um sentido: o CRM empurra, o Google reflecte. Nunca lemos a agenda pessoal
// do consultor (o scope só dá acesso ao calendário criado pela própria app).
// ============================================================================
import {
  GOOGLE_CALENDAR_BASE,
  GOOGLE_CALENDAR_NAME,
  GOOGLE_CALENDAR_TIMEZONE,
  GOOGLE_EVENT_DEFAULT_MINUTES,
} from './config';

/** Campos de uma tarefa do CRM que interessam ao calendário. */
export interface ActivityForCalendar {
  id: string;
  title: string;
  description?: string | null;
  type?: string | null;
  date: string; // ISO
  completed: boolean;
  dealId?: string | null;
  dealTitle?: string | null;
  contactName?: string | null;
}

export interface GoogleEventBody {
  summary: string;
  description: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  extendedProperties: { private: Record<string, string> };
  source?: { title: string; url: string };
}

const TIPO_LABEL: Record<string, string> = {
  CALL: 'Chamada',
  MEETING: 'Reunião',
  EMAIL: 'Email',
  TASK: 'Tarefa',
  NOTE: 'Nota',
};

/**
 * Constrói o corpo do evento a partir de uma tarefa do CRM. Pura — testável.
 * Tarefa concluída fica com "✓" à frente (mantém-se no calendário como registo
 * do que foi feito, em vez de desaparecer).
 */
export function buildEventBody(activity: ActivityForCalendar, appUrl: string): GoogleEventBody {
  const start = new Date(activity.date);
  const end = new Date(start.getTime() + GOOGLE_EVENT_DEFAULT_MINUTES * 60_000);

  const tipo = TIPO_LABEL[activity.type ?? ''] ?? null;
  const titulo = (activity.title || 'Tarefa').trim();
  const summary = `${activity.completed ? '✓ ' : ''}${tipo ? `${tipo}: ` : ''}${titulo}`;

  const link = activity.dealId ? `${appUrl}/deals/${activity.dealId}/cockpit` : `${appUrl}/activities`;
  const description = [
    activity.description?.trim() || null,
    activity.dealTitle ? `Negócio: ${activity.dealTitle}` : null,
    activity.contactName ? `Contacto: ${activity.contactName}` : null,
    '',
    `Abrir no CRM: ${link}`,
    'Criado pelo Foco Imo — gere a tarefa no CRM, este evento é só o espelho.',
  ]
    .filter((l) => l !== null)
    .join('\n');

  return {
    summary,
    description,
    start: { dateTime: start.toISOString(), timeZone: GOOGLE_CALENDAR_TIMEZONE },
    end: { dateTime: end.toISOString(), timeZone: GOOGLE_CALENDAR_TIMEZONE },
    extendedProperties: { private: { crmActivityId: activity.id } },
    source: { title: 'Foco Imo', url: link },
  };
}

async function calendarFetch(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const res = await fetch(`${GOOGLE_CALENDAR_BASE}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    // 204 (delete) não devolve corpo
  }
  return { ok: res.ok, status: res.status, json };
}

function errText(json: Record<string, unknown>, status: number): string {
  const err = json.error as { message?: string } | undefined;
  return err?.message || `Erro do Google Calendar (HTTP ${status}).`;
}

/** Cria o calendário dedicado e devolve o seu id. */
export async function createDedicatedCalendar(accessToken: string): Promise<string> {
  const { ok, status, json } = await calendarFetch(accessToken, '/calendars', {
    method: 'POST',
    body: JSON.stringify({ summary: GOOGLE_CALENDAR_NAME, timeZone: GOOGLE_CALENDAR_TIMEZONE }),
  });
  if (!ok) throw new Error(errText(json, status));
  const id = json.id as string | undefined;
  if (!id) throw new Error('O Google não devolveu o id do calendário criado.');
  return id;
}

/** Confirma que o calendário ainda existe (o João pode tê-lo apagado à mão). */
export async function calendarExists(accessToken: string, calendarId: string): Promise<boolean> {
  const { ok, status } = await calendarFetch(accessToken, `/calendars/${encodeURIComponent(calendarId)}`);
  if (ok) return true;
  if (status === 404 || status === 410) return false;
  return true; // erro transitório: não assumir que desapareceu
}

/**
 * Cria ou actualiza o evento de uma tarefa. Devolve o id do evento no Google.
 * Se o evento já não existir lá (apagado à mão), volta a criá-lo.
 */
export async function upsertEvent(
  accessToken: string,
  calendarId: string,
  activity: ActivityForCalendar,
  existingEventId: string | null,
  appUrl: string,
): Promise<string> {
  const body = buildEventBody(activity, appUrl);
  const cal = encodeURIComponent(calendarId);

  if (existingEventId) {
    const { ok, status, json } = await calendarFetch(
      accessToken,
      `/calendars/${cal}/events/${encodeURIComponent(existingEventId)}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    );
    if (ok) return (json.id as string) ?? existingEventId;
    if (status !== 404 && status !== 410) throw new Error(errText(json, status));
    // 404/410 → foi apagado no Google; cai para criar de novo.
  }

  const { ok, status, json } = await calendarFetch(accessToken, `/calendars/${cal}/events`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!ok) throw new Error(errText(json, status));
  const id = json.id as string | undefined;
  if (!id) throw new Error('O Google não devolveu o id do evento criado.');
  return id;
}

/** Remove um evento. Um 404/410 conta como sucesso (já lá não estava). */
export async function deleteEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<void> {
  const { ok, status, json } = await calendarFetch(
    accessToken,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE' },
  );
  if (ok || status === 404 || status === 410) return;
  throw new Error(errText(json, status));
}
