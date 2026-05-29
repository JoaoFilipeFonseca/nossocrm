/**
 * /api/meta-ads/analyze — Analista IA dos anúncios (Meta Ads Fase B b2.3).
 *
 * Dois modos:
 *  - CRON (header X-Cron-Secret == backup_cron_secret): analisa TODAS as
 *    integrações Meta activas. Disparado 1x/dia pela automação `meta-ads-analyst`.
 *  - UTILIZADOR (sessão autenticada): "Analisar agora" — só a org do utilizador.
 *
 * Por anúncio: anomalias determinísticas (código) + veredicto IA
 * (parar/aumentar/testar/manter). Confiança cresce com os dias de dados
 * (cadência de decisão 3/5/8). Guarda em `ad_analyses` (upsert por dia).
 * Se houver anomalias, alerta no Telegram da org (só o essencial).
 * Devolve sempre 200 em erro lógico (regra dos webhooks/crons).
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { generateText, Output } from 'ai';
import { createClient } from '@/lib/supabase/server';
import { createStaticAdminClient } from '@/lib/supabase/staticAdminClient';
import { getModelForFeature, type AIKeys } from '@/lib/ai/router';
import { runWithAIFallback } from '@/lib/ai/run-with-fallback';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ANALYSIS_DAYS = 30;
const MAX_ADS = 40;

interface PerfRow {
  ad_id: string;
  ad_name: string | null;
  campaign_name: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  meta_leads: number;
  crm_leads: number;
  won_deals: number;
  won_value: number;
  currency: string | null;
  days_with_data: number;
}

const VerdictSchema = z.object({
  overall: z.string(),
  items: z.array(
    z.object({
      ad_id: z.string(),
      verdict: z.enum(['parar', 'aumentar', 'testar', 'manter']),
      reason: z.string(),
      suggestion: z.string(),
      impact_eur: z.number().nullable(),
    }),
  ),
});

function n(v: unknown): number {
  const x = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : 0;
  return Number.isFinite(x) ? x : 0;
}

// Confiança pela maturidade dos dados (checkpoints 3/5/8 dias).
function confidenceForDays(days: number): number {
  if (days >= 8) return 0.9;
  if (days >= 5) return 0.75;
  if (days >= 3) return 0.6;
  return 0.3;
}

// Anomalias determinísticas (independentes da IA) — base dos alertas.
function detectAnomaly(r: PerfRow, avgCpl: number, avgCtr: number): string | null {
  const leads = r.crm_leads || r.meta_leads;
  const ctr = r.impressions ? (r.clicks / r.impressions) * 100 : 0;
  if (r.spend >= 20 && leads === 0) return `Gastou ${r.spend.toFixed(2)} sem uma única lead.`;
  if (leads > 0 && avgCpl > 0) {
    const cpl = r.spend / leads;
    if (cpl > avgCpl * 2.5) return `CPL ${cpl.toFixed(2)} muito acima da média da conta (${avgCpl.toFixed(2)}).`;
  }
  if (avgCtr > 0 && r.impressions >= 1000 && ctr < avgCtr * 0.4) {
    return `CTR ${ctr.toFixed(2)}% muito abaixo da média (${avgCtr.toFixed(2)}%).`;
  }
  return null;
}

async function sendTelegram(token: string, chatId: string, text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_notification: false }),
    });
  } catch { /* alerta best-effort */ }
}

async function analyzeOrg(admin: ReturnType<typeof createStaticAdminClient>, orgId: string, integrationId: string | null) {
  const to = new Date();
  const from = new Date(to.getTime() - ANALYSIS_DAYS * 24 * 60 * 60 * 1000);
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  const today = ymd(to);

  const { data: perf, error: perfErr } = await admin.rpc('meta_ads_performance_admin', {
    p_org: orgId,
    p_from: ymd(from),
    p_to: today,
  });
  if (perfErr) return { org: orgId, error: perfErr.message };
  const rows: PerfRow[] = (perf ?? []).map((r: Record<string, unknown>) => ({
    ad_id: String(r.ad_id),
    ad_name: (r.ad_name as string) ?? null,
    campaign_name: (r.campaign_name as string) ?? null,
    spend: n(r.spend),
    impressions: n(r.impressions),
    clicks: n(r.clicks),
    meta_leads: n(r.meta_leads),
    crm_leads: n(r.crm_leads),
    won_deals: n(r.won_deals),
    won_value: n(r.won_value),
    currency: (r.currency as string) ?? 'EUR',
    days_with_data: n(r.days_with_data),
  }));
  if (rows.length === 0) return { org: orgId, ads: 0 };

  const top = rows.slice(0, MAX_ADS);

  // Médias da conta (referência).
  const withLeads = top.filter((r) => (r.crm_leads || r.meta_leads) > 0);
  const avgCpl = withLeads.length
    ? withLeads.reduce((s, r) => s + r.spend / (r.crm_leads || r.meta_leads), 0) / withLeads.length
    : 0;
  const withImpr = top.filter((r) => r.impressions >= 1000);
  const avgCtr = withImpr.length
    ? withImpr.reduce((s, r) => s + (r.clicks / r.impressions) * 100, 0) / withImpr.length
    : 0;

  const anomalies = new Map<string, string>();
  for (const r of top) {
    const a = detectAnomaly(r, avgCpl, avgCtr);
    if (a) anomalies.set(r.ad_id, a);
  }

  // Chaves de IA da org.
  const { data: os } = await admin
    .from('organization_settings')
    .select('ai_google_key, ai_anthropic_key, telegram_crm_bot_token, telegram_crm_chat_id')
    .eq('organization_id', orgId)
    .maybeSingle();
  const keys: AIKeys = {};
  if (os?.ai_google_key) keys.google = os.ai_google_key;
  if (os?.ai_anthropic_key) keys.anthropic = os.ai_anthropic_key;

  const currency = top[0]?.currency ?? 'EUR';
  const lines = top
    .map((r) => {
      const leads = r.crm_leads || r.meta_leads;
      const cpl = leads ? (r.spend / leads).toFixed(2) : '—';
      const ctr = r.impressions ? ((r.clicks / r.impressions) * 100).toFixed(2) : '0';
      return `- ${r.ad_name || r.ad_id} (id ${r.ad_id}) | gasto ${r.spend.toFixed(2)} | leads ${leads} | CPL ${cpl} | CTR ${ctr}% | ganhos ${r.won_deals} (${r.won_value.toFixed(0)}) | dias ${r.days_with_data}${anomalies.has(r.ad_id) ? ' | ANOMALIA: ' + anomalies.get(r.ad_id) : ''}`;
    })
    .join('\n');

  const prompt = `És um analista de tráfego pago (Meta Ads) de uma imobiliária em Portugal. Moeda ${currency}.
Médias da conta: CPL ${avgCpl ? avgCpl.toFixed(2) : 'n/d'}, CTR ${avgCtr ? avgCtr.toFixed(2) + '%' : 'n/d'}.
Para cada anúncio dá um veredicto: "parar" (mau e a gastar), "aumentar" (bom, reforçar orçamento), "testar" (potencial, mudar criativo/ângulo/copy) ou "manter".
Regras: anúncios com menos de 3 dias de dados quase sempre "manter" (dados insuficientes). Foca em baixar o CPL e trazer leads mais qualificadas. Sugestões concretas e curtas. impact_eur = estimativa grosseira do que se ganha/poupa por mês (ou null).
Escreve em português europeu (pré acordo ortográfico), sem traços.

Anúncios (últimos ${ANALYSIS_DAYS} dias):
${lines}`;

  let aiItems: z.infer<typeof VerdictSchema>['items'] = [];
  let overall = '';
  try {
    const primary = getModelForFeature('generic', keys).model;
    const fallback = getModelForFeature('generic', { anthropic: keys.anthropic }).model;
    if (primary) {
      const { result } = await runWithAIFallback(
        () => generateText({ model: primary, prompt, output: Output.object({ schema: VerdictSchema }) }),
        fallback && fallback !== primary ? () => generateText({ model: fallback, prompt, output: Output.object({ schema: VerdictSchema }) }) : null,
      );
      const out = result.output as z.infer<typeof VerdictSchema>;
      aiItems = out.items ?? [];
      overall = out.overall ?? '';
    }
  } catch (e) {
    console.error('[meta-analyst] AI falhou:', e instanceof Error ? e.message : e);
  }
  const byId = new Map(aiItems.map((i) => [i.ad_id, i]));

  // Combina IA + anomalia + confiança por dias e grava.
  const toUpsert = top.map((r) => {
    const ai = byId.get(r.ad_id);
    const anomaly = anomalies.get(r.ad_id) ?? null;
    let verdict = ai?.verdict ?? 'manter';
    if (r.days_with_data < 3 && !anomaly) verdict = 'manter';
    return {
      organization_id: orgId,
      integration_id: integrationId,
      analyzed_at: today,
      ad_id: r.ad_id,
      ad_name: r.ad_name,
      verdict,
      confidence: confidenceForDays(r.days_with_data),
      reason: anomaly ? `${anomaly}${ai?.reason ? ' ' + ai.reason : ''}` : (ai?.reason ?? null),
      suggestion: ai?.suggestion ?? null,
      impact_eur: ai?.impact_eur ?? null,
      is_anomaly: !!anomaly,
      days_with_data: r.days_with_data,
      metrics: r as unknown as Record<string, unknown>,
    };
  });

  await admin.from('ad_analyses').upsert(toUpsert, { onConflict: 'organization_id,ad_id,analyzed_at' });

  // Alerta Telegram só se houver anomalias e canal configurado.
  if (anomalies.size > 0 && os?.telegram_crm_bot_token && os?.telegram_crm_chat_id) {
    const list = [...anomalies.entries()]
      .slice(0, 5)
      .map(([id, msg]) => {
        const r = top.find((x) => x.ad_id === id);
        return `• <b>${r?.ad_name || id}</b>: ${msg}`;
      })
      .join('\n');
    const text = `📊 <b>Anúncios — atenção</b>\n${anomalies.size} anúncio(s) a precisar de revisão:\n\n${list}\n\nVer em /anuncios`;
    await sendTelegram(os.telegram_crm_bot_token, os.telegram_crm_chat_id, text);
  }

  return { org: orgId, ads: top.length, anomalies: anomalies.size, overall };
}

export async function POST(req: NextRequest) {
  const admin = createStaticAdminClient();

  // Modo cron?
  const cronSecret = req.headers.get('X-Cron-Secret') ?? '';
  let orgs: Array<{ id: string; integration_id: string | null }> = [];
  let isCron = false;

  if (cronSecret) {
    const { data: expected } = await admin.rpc('get_backup_cron_secret');
    if (!expected || cronSecret !== expected) {
      return Response.json({ error: 'forbidden' }, { status: 403 });
    }
    isCron = true;
    const { data: integ } = await admin
      .from('automation_integrations')
      .select('id, organization_id')
      .eq('provider', 'meta')
      .eq('status', 'active');
    orgs = (integ ?? []).map((i: { id: string; organization_id: string }) => ({ id: i.organization_id, integration_id: i.id }));
  } else {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).maybeSingle();
    const orgId = (profile as { organization_id?: string } | null)?.organization_id;
    if (!orgId) return Response.json({ error: 'Sem organização' }, { status: 400 });
    const { data: integ } = await admin
      .from('automation_integrations')
      .select('id')
      .eq('provider', 'meta')
      .eq('organization_id', orgId)
      .eq('status', 'active')
      .maybeSingle();
    orgs = [{ id: orgId, integration_id: (integ as { id?: string } | null)?.id ?? null }];
  }

  const summary: unknown[] = [];
  let ok = true;
  for (const o of orgs) {
    try {
      summary.push(await analyzeOrg(admin, o.id, o.integration_id));
    } catch (e) {
      ok = false;
      summary.push({ org: o.id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  if (isCron) {
    try {
      const { data: cur } = await admin
        .from('system_automations')
        .select('run_count, fail_count')
        .eq('key', 'meta-ads-analyst')
        .maybeSingle();
      await admin
        .from('system_automations')
        .update({
          last_run_at: new Date().toISOString(),
          last_run_ok: ok,
          last_run_error: ok ? null : 'ver logs',
          run_count: ((cur as { run_count?: number } | null)?.run_count ?? 0) + 1,
          fail_count: ((cur as { fail_count?: number } | null)?.fail_count ?? 0) + (ok ? 0 : 1),
        })
        .eq('key', 'meta-ads-analyst');
    } catch { /* best-effort */ }
  }

  return Response.json({ ok, summary });
}
