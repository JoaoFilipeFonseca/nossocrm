// IMO-6 Fase 2b passo 2 — "Vigia de CMI" automático (Telegram, por org).
// Percorre os CMIs activos de cada org, avalia sinais (fim próximo/expirado,
// imóvel parado) com o motor `evaluateCmiWatch` e envia um digest Telegram dos
// imóveis em risco, com DEDUP DIÁRIO (imovel_cmi.last_watch_alert_on).
//
// Auth: X-Cron-Secret == backup_cron_secret (reusado, como o morning-brief).
//
// ⚠️ O motor abaixo (evaluateCmiWatch) é uma CÓPIA da fonte canónica testada
//    `lib/imoveis/cmiWatch.ts` (+8 testes). Runtimes diferentes (Deno vs Next)
//    impedem import partilhado — manter as duas em sincronia se a lógica mudar.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { loadAutomationParams } from '../_shared/automation-params.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TELEGRAM_API = 'https://api.telegram.org';
const APP_URL = 'https://crm.joaofilipefonseca.pt';

const DEFAULTS = { alerta_fim_dias: 15, sem_visita_dias: 21, skip_sundays: true };

// ── Motor puro (cópia de lib/imoveis/cmiWatch.ts) ───────────────────────────
type Severity = 'baixa' | 'media' | 'alta';
interface WatchInput {
  daysToEnd: number | null;
  leads: number;
  visitas: number;
  propostas: number;
  diasSemVisita: number | null;
}
interface WatchResult {
  shouldAlert: boolean;
  severity: Severity;
  reasons: string[];
  sugestao: string | null;
}
function evaluateCmiWatch(
  input: WatchInput,
  thresholds: { alertaFimDias: number; semVisitaDias: number },
): WatchResult {
  const { daysToEnd, leads, visitas, propostas, diasSemVisita } = input;
  const reasons: string[] = [];
  const expirado = daysToEnd != null && daysToEnd < 0;
  const fimProximo = daysToEnd != null && daysToEnd >= 0 && daysToEnd <= thresholds.alertaFimDias;

  if (expirado) reasons.push(`CMI expirou há ${Math.abs(daysToEnd!)} dias`);
  else if (fimProximo) reasons.push(daysToEnd === 0 ? 'CMI termina hoje' : `CMI termina em ${daysToEnd} dias`);

  const semVisitas = visitas === 0 || (diasSemVisita != null && diasSemVisita >= thresholds.semVisitaDias);
  if (visitas === 0) reasons.push('sem visitas registadas');
  else if (diasSemVisita != null && diasSemVisita >= thresholds.semVisitaDias) reasons.push(`${diasSemVisita} dias sem visitas`);
  if (propostas === 0) reasons.push('sem propostas');
  if (leads === 0) reasons.push('sem negócios associados');

  const parado = semVisitas && propostas === 0;
  const shouldAlert = expirado || fimProximo || parado;

  let severity: Severity = 'baixa';
  if (expirado || (daysToEnd != null && daysToEnd >= 0 && daysToEnd <= 7)) severity = 'alta';
  else if (fimProximo || parado) severity = 'media';

  let sugestao: string | null = null;
  if (shouldAlert) {
    if (expirado) sugestao = 'Falar com o proprietário para renovar o CMI (ou retirar o imóvel).';
    else if (fimProximo && parado) sugestao = 'Renovar o CMI a tempo e rever a estratégia: preço, fotos e reactivar o anúncio.';
    else if (fimProximo) sugestao = 'Falar com o proprietário sobre a renovação do CMI antes do fim.';
    else if (parado) sugestao = 'Imóvel parado: rever preço/fotos, reactivar o anúncio e procurar compradores nos cruzamentos.';
  }
  return { shouldAlert, severity, reasons, sugestao };
}

// daysToEnd: réplica de cmiCountdown (date-only, determinista em UTC).
function daysToEnd(dataFim: string | null): number | null {
  if (!dataFim) return null;
  const end = Date.parse(`${dataFim.slice(0, 10)}T00:00:00Z`);
  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const d = Math.round((end - todayUTC) / 86_400_000);
  return Number.isNaN(d) ? null : d;
}

function lisbonToday(): string {
  // YYYY-MM-DD em Europa/Lisboa
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

const SEV_ICON: Record<Severity, string> = { alta: '🔴', media: '🟡', baixa: '⚪️' };

interface CmiRow {
  id: string;
  imovel_id: string;
  data_fim: string | null;
  last_watch_alert_on: string | null;
  imoveis: { referencia: string | null; morada: string | null; concelho: string | null } | null;
}

Deno.serve(async (req: Request) => {
  const cronSecret = req.headers.get('X-Cron-Secret') || '';
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: expectedSecret } = await supabase.rpc('get_backup_cron_secret');
  if (!expectedSecret || cronSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { 'content-type': 'application/json' } });
  }

  const params = await loadAutomationParams(supabase, 'cmi-watch', DEFAULTS);
  const alertaFimDias = Math.max(0, Math.floor(Number(params.alerta_fim_dias) || DEFAULTS.alerta_fim_dias));
  const semVisitaDias = Math.max(1, Math.floor(Number(params.sem_visita_dias) || DEFAULTS.sem_visita_dias));
  const skipSundays = params.skip_sundays !== false;

  if (skipSundays) {
    const wd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', weekday: 'short' }).format(new Date()).toLowerCase();
    if (wd.startsWith('sun')) {
      return new Response(JSON.stringify({ ok: true, skipped: 'sunday' }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
  }

  const today = lisbonToday();
  const results: Array<{ org: string; alerted: number; ok: boolean; error?: string }> = [];

  try {
    const { data: orgs, error: orgsErr } = await supabase
      .from('organization_settings')
      .select('organization_id, telegram_crm_bot_token, telegram_crm_chat_id')
      .not('telegram_crm_bot_token', 'is', null)
      .not('telegram_crm_chat_id', 'is', null);
    if (orgsErr) throw orgsErr;

    for (const org of orgs ?? []) {
      const orgId = org.organization_id as string;
      const botToken = org.telegram_crm_bot_token as string;
      const chatId = org.telegram_crm_chat_id as string;
      try {
        const { data: cmis, error: cmiErr } = await supabase
          .from('imovel_cmi')
          .select('id, imovel_id, data_fim, last_watch_alert_on, imoveis(referencia, morada, concelho)')
          .eq('organization_id', orgId)
          .eq('activo', true);
        if (cmiErr) throw cmiErr;

        const flagged: Array<{ cmiId: string; imovelId: string; label: string; sev: Severity; reasons: string[]; sugestao: string | null }> = [];

        for (const cmiRaw of (cmis ?? []) as unknown as CmiRow[]) {
          if (cmiRaw.last_watch_alert_on === today) continue; // dedup diário

          const imovelId = cmiRaw.imovel_id;
          const [dealsRes, visitasRes, propostasRes, ultimaVisitaRes] = await Promise.all([
            supabase.from('deals').select('id', { count: 'exact', head: true }).eq('imovel_id', imovelId),
            supabase.from('imovel_eventos').select('id', { count: 'exact', head: true }).eq('imovel_id', imovelId).eq('kind', 'visita'),
            supabase.from('imovel_eventos').select('id', { count: 'exact', head: true }).eq('imovel_id', imovelId).in('kind', ['proposta', 'oferta', 'contraproposta']),
            supabase.from('imovel_eventos').select('occurred_at').eq('imovel_id', imovelId).eq('kind', 'visita').order('occurred_at', { ascending: false }).limit(1).maybeSingle(),
          ]);

          let diasSemVisita: number | null = null;
          if (ultimaVisitaRes.data?.occurred_at) {
            const last = new Date(ultimaVisitaRes.data.occurred_at as string).getTime();
            diasSemVisita = Math.max(0, Math.floor((Date.now() - last) / 86_400_000));
          }

          const r = evaluateCmiWatch(
            {
              daysToEnd: daysToEnd(cmiRaw.data_fim),
              leads: dealsRes.count ?? 0,
              visitas: visitasRes.count ?? 0,
              propostas: propostasRes.count ?? 0,
              diasSemVisita,
            },
            { alertaFimDias, semVisitaDias },
          );
          if (!r.shouldAlert) continue;

          const imo = cmiRaw.imoveis;
          const label = imo?.referencia
            ? `${imo.referencia}${imo.morada ? ` · ${imo.morada}` : imo.concelho ? ` · ${imo.concelho}` : ''}`
            : (imo?.morada ?? imo?.concelho ?? 'Imóvel');
          flagged.push({ cmiId: cmiRaw.id, imovelId, label, sev: r.severity, reasons: r.reasons, sugestao: r.sugestao });
        }

        if (flagged.length === 0) {
          results.push({ org: orgId, alerted: 0, ok: true });
          continue;
        }

        const order: Severity[] = ['alta', 'media', 'baixa'];
        flagged.sort((a, b) => order.indexOf(a.sev) - order.indexOf(b.sev));

        const lines: string[] = [
          `📋 <b>Vigia de CMI</b> — ${flagged.length} ${flagged.length === 1 ? 'imóvel a precisar de atenção' : 'imóveis a precisar de atenção'}`,
          '',
        ];
        for (const f of flagged) {
          lines.push(`${SEV_ICON[f.sev]} <a href="${APP_URL}/imoveis/${f.imovelId}">${f.label}</a>`);
          lines.push(`   ${f.reasons.join(' · ')}`);
          if (f.sugestao) lines.push(`   💡 ${f.sugestao}`);
          lines.push('');
        }

        const tgRes = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: lines.join('\n'), parse_mode: 'HTML', disable_web_page_preview: true }),
        });

        if (tgRes.ok) {
          await supabase.from('imovel_cmi').update({ last_watch_alert_on: today }).in('id', flagged.map((f) => f.cmiId));
          results.push({ org: orgId, alerted: flagged.length, ok: true });
        } else {
          results.push({ org: orgId, alerted: 0, ok: false, error: `tg ${tgRes.status}` });
        }
      } catch (e) {
        results.push({ org: orgId, alerted: 0, ok: false, error: (e as Error).message });
      }
    }
  } catch (e) {
    // Nunca 500 em erro lógico — comunicar e devolver 200.
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message, results }), { status: 200, headers: { 'content-type': 'application/json' } });
  }

  return new Response(JSON.stringify({ ok: true, results }), { status: 200, headers: { 'content-type': 'application/json' } });
});
