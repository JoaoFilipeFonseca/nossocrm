/**
 * POST /api/integrations/google/sync — TAREFAS Fase 2.
 *
 * Empurra as tarefas do CRM para o calendário dedicado do Google.
 * Chamada por dois caminhos, ambos com X-Cron-Secret == backup_cron_secret:
 *   - TEMPO REAL: trigger na tabela `activities` (pg_net) logo que uma tarefa
 *     é criada, editada, concluída, adiada ou apagada.
 *   - REDE DE SEGURANÇA: cron de 10 em 10 minutos (corpo vazio) que drena tudo
 *     o que ficou pendente.
 *
 * O CRM é a fonte da verdade — nunca lemos a agenda pessoal do consultor.
 * Nunca devolve 5xx em erro lógico (evita retry storms do pg_net/cron).
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextRequest } from 'next/server';
import { createStaticAdminClient } from '@/lib/supabase/staticAdminClient';
import { deleteEvent, upsertEvent, type ActivityForCalendar } from '@/lib/integrations/google/calendar';
import {
  getGoogleIntegration,
  listActiveGoogleOrgs,
  markIntegration,
  openGoogleSession,
  type GoogleIntegration,
} from '@/lib/integrations/google/server';

const APP_URL = 'https://crm.joaofilipefonseca.pt';
type Admin = ReturnType<typeof createStaticAdminClient>;

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

interface ActivityRow {
  id: string;
  title: string;
  description: string | null;
  type: string | null;
  date: string;
  completed: boolean;
  deal_id: string | null;
  contact_id: string | null;
  deleted_at: string | null;
  google_event_id: string | null;
}

/** Junta título do negócio e nome do contacto às tarefas (para o evento). */
async function enrich(admin: Admin, rows: ActivityRow[]): Promise<Map<string, ActivityForCalendar>> {
  const dealIds = Array.from(new Set(rows.map((r) => r.deal_id).filter(Boolean) as string[]));
  const dealById = new Map<string, { title: string; contact_id: string | null }>();
  if (dealIds.length > 0) {
    const { data } = await admin.from('deals').select('id, title, contact_id').in('id', dealIds);
    for (const d of data ?? [])
      dealById.set(d.id as string, {
        title: d.title as string,
        contact_id: (d.contact_id as string | null) ?? null,
      });
  }

  const contactIds = Array.from(
    new Set(
      rows
        .flatMap((r) => [r.contact_id, r.deal_id ? dealById.get(r.deal_id)?.contact_id ?? null : null])
        .filter(Boolean) as string[],
    ),
  );
  const contactById = new Map<string, string>();
  if (contactIds.length > 0) {
    const { data } = await admin.from('contacts').select('id, name').in('id', contactIds);
    for (const c of data ?? []) contactById.set(c.id as string, c.name as string);
  }

  const out = new Map<string, ActivityForCalendar>();
  for (const r of rows) {
    const deal = r.deal_id ? dealById.get(r.deal_id) : undefined;
    const contactId = r.contact_id ?? deal?.contact_id ?? null;
    out.set(r.id, {
      id: r.id,
      title: r.title,
      description: r.description,
      type: r.type,
      date: r.date,
      completed: r.completed,
      dealId: r.deal_id,
      dealTitle: deal?.title ?? null,
      contactName: contactId ? contactById.get(contactId) ?? null : null,
    });
  }
  return out;
}

/** Sincroniza uma organização. Devolve o que fez. */
async function syncOrg(
  admin: Admin,
  integration: GoogleIntegration,
  batchSize: number,
  onlyActivityId: string | null,
): Promise<{ org: string; enviadas: number; removidas: number; erros: number; error?: string }> {
  const orgId = integration.organizationId;
  let enviadas = 0;
  let removidas = 0;
  let erros = 0;

  let session;
  try {
    session = await openGoogleSession(admin, integration);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido';
    await markIntegration(admin, integration.id, msg);
    return { org: orgId, enviadas: 0, removidas: 0, erros: 1, error: msg };
  }

  // ── Remoções pendentes ────────────────────────────────────────────────────
  const { data: deletions } = await admin
    .from('google_calendar_deletions')
    .select('id, google_event_id')
    .eq('organization_id', orgId)
    .limit(batchSize);
  for (const d of deletions ?? []) {
    try {
      await deleteEvent(session.accessToken, session.calendarId, d.google_event_id as string);
      await admin.from('google_calendar_deletions').delete().eq('id', d.id as string);
      removidas += 1;
    } catch {
      erros += 1; // fica na fila para a próxima passagem
    }
  }

  // ── Tarefas pendentes ─────────────────────────────────────────────────────
  let query = admin
    .from('activities')
    .select('id, title, description, type, date, completed, deal_id, contact_id, deleted_at, google_event_id')
    .eq('organization_id', orgId);
  query = onlyActivityId
    ? query.eq('id', onlyActivityId)
    : query.eq('google_sync_pending', true).limit(batchSize);

  const { data: rows } = await query;
  const list = (rows ?? []) as ActivityRow[];
  if (list.length === 0) {
    await markIntegration(admin, integration.id, null);
    return { org: orgId, enviadas, removidas, erros };
  }

  const enriched = await enrich(admin, list);

  for (const row of list) {
    try {
      // Apagada (soft-delete): tira o evento do calendário.
      if (row.deleted_at) {
        if (row.google_event_id) {
          await deleteEvent(session.accessToken, session.calendarId, row.google_event_id);
          removidas += 1;
        }
        await admin
          .from('activities')
          .update({
            google_event_id: null,
            google_sync_pending: false,
            google_synced_at: new Date().toISOString(),
            google_sync_error: null,
          })
          .eq('id', row.id);
        continue;
      }

      const activity = enriched.get(row.id);
      if (!activity) continue;

      const eventId = await upsertEvent(
        session.accessToken,
        session.calendarId,
        activity,
        row.google_event_id,
        APP_URL,
      );
      await admin
        .from('activities')
        .update({
          google_event_id: eventId,
          google_sync_pending: false,
          google_synced_at: new Date().toISOString(),
          google_sync_error: null,
        })
        .eq('id', row.id);
      enviadas += 1;
    } catch (e) {
      erros += 1;
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      await admin
        .from('activities')
        .update({ google_sync_error: msg.slice(0, 300) })
        .eq('id', row.id);
    }
  }

  await markIntegration(admin, integration.id, erros > 0 ? `${erros} tarefa(s) por sincronizar` : null);
  return { org: orgId, enviadas, removidas, erros };
}

async function recordRun(admin: Admin, ok: boolean, error: string | null): Promise<void> {
  try {
    const { data: cur } = await admin
      .from('system_automations')
      .select('run_count, fail_count')
      .eq('key', 'google-calendar-sync')
      .maybeSingle();
    await admin
      .from('system_automations')
      .update({
        last_run_at: new Date().toISOString(),
        last_run_ok: ok,
        last_run_error: error,
        run_count: ((cur as { run_count?: number } | null)?.run_count ?? 0) + 1,
        fail_count: ((cur as { fail_count?: number } | null)?.fail_count ?? 0) + (ok ? 0 : 1),
      })
      .eq('key', 'google-calendar-sync');
  } catch {
    /* best-effort */
  }
}

export async function POST(req: NextRequest) {
  const admin = createStaticAdminClient();
  const cronSecret = req.headers.get('X-Cron-Secret') ?? '';

  const { data: expected } = await admin.rpc('get_backup_cron_secret');
  if (!expected || cronSecret !== expected) {
    return json({ error: 'forbidden' }, 403);
  }

  let body: { organization_id?: string; activity_id?: string; manual_trigger?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    /* corpo vazio = drenar tudo (cron) */
  }

  const { data: automation } = await admin
    .from('system_automations')
    .select('enabled, params')
    .eq('key', 'google-calendar-sync')
    .maybeSingle();
  if (!body.manual_trigger && automation && automation.enabled === false) {
    return json({ ok: true, skipped: 'disabled' });
  }
  const params = (automation?.params ?? {}) as { batch_size?: number };
  const batchSize = Math.min(200, Math.max(1, Math.floor(Number(params.batch_size) || 50)));

  // Uma org (tempo real) ou todas as activas (cron).
  let integrations: GoogleIntegration[];
  if (body.organization_id) {
    const one = await getGoogleIntegration(admin, body.organization_id);
    integrations = one && one.status === 'active' ? [one] : [];
  } else {
    integrations = await listActiveGoogleOrgs(admin);
  }

  if (integrations.length === 0) {
    return json({ ok: true, skipped: 'sem_integracao_activa' });
  }

  const results: Array<Awaited<ReturnType<typeof syncOrg>>> = [];
  for (const integration of integrations) {
    results.push(await syncOrg(admin, integration, batchSize, body.activity_id ?? null));
  }

  const totalErros = results.reduce((a, r) => a + r.erros, 0);
  await recordRun(admin, totalErros === 0, results.find((r) => r.error)?.error ?? null);

  return json({ ok: true, results });
}
