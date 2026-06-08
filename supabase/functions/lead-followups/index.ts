// CT-AUTO Fase 2b — Motor de follow-up "nunca perder uma lead" (Telegram + tarefas, por org).
//
// Seg a Sáb às 09h percorre cada org, pede a "leva diária" de negócios a retomar
// (RPC deal_followups_due — abertos, não adiados, fora do cooldown, parados há >= período),
// cria uma tarefa "Retomar contacto" por negócio, marca-os (followupQueuedOn) para o
// cooldown não os repetir, e envia um digest no Telegram. O cooldown garante que cada lead
// volta à leva ao fim do período => nunca perder nenhuma.
//
// Auth: X-Cron-Secret == backup_cron_secret (reusado, como o cmi-watch).
// Nunca 500 em erro lógico — comunica e devolve 200.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { loadAutomationParams } from '../_shared/automation-params.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TELEGRAM_API = 'https://api.telegram.org';
const APP_URL = 'https://crm.joaofilipefonseca.pt';

const DEFAULTS = { skip_sundays: true };

function lisbonToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

interface DueRow {
  deal_id: string;
  contact_id: string | null;
  contact_name: string | null;
  board_name: string | null;
  stage_order: number;
  last_engagement: string | null;
  days_since: number | null;
  value: number | null;
}

Deno.serve(async (req: Request) => {
  const cronSecret = req.headers.get('X-Cron-Secret') || '';
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: expectedSecret } = await supabase.rpc('get_backup_cron_secret');
  if (!expectedSecret || cronSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  }

  const params = await loadAutomationParams(supabase, 'lead-followups', DEFAULTS);
  const skipSundays = params.skip_sundays !== false;
  if (skipSundays) {
    const wd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', weekday: 'short' })
      .format(new Date())
      .toLowerCase();
    if (wd.startsWith('sun')) {
      return new Response(JSON.stringify({ ok: true, skipped: 'sunday' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
  }

  const today = lisbonToday();
  const results: Array<{ org: string; queued: number; ok: boolean; error?: string }> = [];

  try {
    const { data: orgs, error: orgsErr } = await supabase
      .from('organization_settings')
      .select(
        'organization_id, telegram_crm_bot_token, telegram_crm_chat_id, followup_enabled, followup_batch_size, followup_cooldown_days',
      )
      .not('telegram_crm_bot_token', 'is', null)
      .not('telegram_crm_chat_id', 'is', null);
    if (orgsErr) throw orgsErr;

    for (const org of orgs ?? []) {
      const orgId = org.organization_id as string;
      if (org.followup_enabled === false) {
        results.push({ org: orgId, queued: 0, ok: true });
        continue;
      }
      const botToken = org.telegram_crm_bot_token as string;
      const chatId = org.telegram_crm_chat_id as string;
      const batch = Math.max(1, Math.floor(Number(org.followup_batch_size) || 10));
      const cooldown = Math.max(1, Math.floor(Number(org.followup_cooldown_days) || 30));

      try {
        const { data: due, error: dueErr } = await supabase.rpc('deal_followups_due', {
          p_org: orgId,
          p_batch: batch,
          p_cooldown: cooldown,
        });
        if (dueErr) throw dueErr;
        const rows = (due ?? []) as DueRow[];
        if (rows.length === 0) {
          results.push({ org: orgId, queued: 0, ok: true });
          continue;
        }

        // 1) Criar uma tarefa "Retomar contacto" por negócio.
        const tasks = rows.map((r) => ({
          organization_id: orgId,
          title: `Retomar contacto${r.contact_name ? `: ${r.contact_name}` : ''}`,
          description: `Negócio parado há ${r.days_since ?? '?'} dias (${r.board_name ?? 'funil'}). Retomar o contacto.`,
          type: 'follow_up',
          date: new Date().toISOString(),
          completed: false,
          deal_id: r.deal_id,
          ...(r.contact_id ? { contact_id: r.contact_id } : {}),
        }));
        const { error: taskErr } = await supabase.from('activities').insert(tasks);
        if (taskErr) throw taskErr;

        // 2) Marcar followupQueuedOn (cooldown) ANTES do Telegram — para nunca duplicar tarefas.
        const { error: markErr } = await supabase.rpc('mark_deals_followup_queued', {
          p_deal_ids: rows.map((r) => r.deal_id),
          p_day: today,
        });
        if (markErr) throw markErr;

        // 3) Digest Telegram (best-effort; as tarefas são o entregável real).
        const lines: string[] = [
          `🔔 <b>Leva de follow-up</b> — ${rows.length} ${rows.length === 1 ? 'lead para retomar' : 'leads para retomar'} hoje`,
          '',
        ];
        for (const r of rows) {
          const name = r.contact_name || 'Contacto';
          const link = r.contact_id ? `${APP_URL}/contacts/${r.contact_id}` : APP_URL;
          lines.push(
            `• <a href="${link}">${name}</a> — ${r.board_name ?? 'funil'} · parado há ${r.days_since ?? '?'} dias`,
          );
        }
        lines.push('');
        lines.push('Cada uma tem uma tarefa "Retomar contacto" criada no CRM.');

        const tgRes = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: lines.join('\n'),
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          }),
        });

        results.push({
          org: orgId,
          queued: rows.length,
          ok: true,
          ...(tgRes.ok ? {} : { error: `tg ${tgRes.status}` }),
        });
      } catch (e) {
        results.push({ org: orgId, queued: 0, ok: false, error: (e as Error).message });
      }
    }
  } catch (e) {
    // Nunca 500 em erro lógico — comunicar e devolver 200.
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message, results }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
});
