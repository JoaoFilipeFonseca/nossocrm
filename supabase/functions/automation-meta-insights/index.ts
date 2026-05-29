/**
 * automation-meta-insights — Sincroniza métricas do Meta Ads (Marketing API).
 *
 * Épico Meta Ads, Fase B, Commit b1.
 *
 * Disparada por cron (system_automations key `meta-insights-sync`) ou
 * manualmente pelo botão "Disparar agora" em /automacoes. Para cada integração
 * Meta activa:
 *   1. Lê o token de utilizador do Vault e a conta de anúncios selecionada.
 *   2. Pede ao Marketing API os insights por anúncio, por dia, dos últimos
 *      `lookback_days` dias (default 7).
 *   3. Faz upsert em `ad_insights` (idempotente por org+integração+ad_id+dia).
 *
 * Segurança: header `X-Cron-Secret` tem de bater com `backup_cron_secret`
 * (mesmo padrão das outras automações de sistema). Sem segredo válido → 403.
 * Devolve sempre 200 em erro lógico (não queremos retries agressivos do cron).
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// Lê `params jsonb` da row system_automations pelo key, merge com defaults.
// Falha aberta: qualquer erro devolve defaults (automação nunca parte por config).
// deno-lint-ignore no-explicit-any
async function loadAutomationParams<T extends Record<string, unknown>>(supabase: any, key: string, defaults: T): Promise<T> {
  try {
    const { data, error } = await supabase.from('system_automations').select('params').eq('key', key).maybeSingle();
    if (error || !data || !data.params || typeof data.params !== 'object') return defaults;
    return { ...defaults, ...(data.params as Record<string, unknown>) } as T;
  } catch {
    return defaults;
  }
}

const GRAPH_VERSION = 'v21.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const DEFAULTS = { lookback_days: 7 };

const SUPABASE_URL = Deno.env.get('CRM_SUPABASE_URL') ?? Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY =
  Deno.env.get('CRM_SUPABASE_SECRET_KEY') ??
  Deno.env.get('CRM_SUPABASE_SERVICE_ROLE_KEY') ??
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function toNum(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : 0;
  return Number.isFinite(n) ? n : 0;
}

function toInt(v: unknown): number {
  return Math.round(toNum(v));
}

// Soma as acções de tipo "lead" (Lead Ads / conversões de lead).
function countLeads(actions: { action_type?: string; value?: string }[] = []): number {
  let total = 0;
  for (const a of actions) {
    const t = (a.action_type ?? '').toLowerCase();
    if (t.includes('lead')) total += toInt(a.value);
  }
  return total;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface InsightRow {
  date_start?: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  actions?: { action_type?: string; value?: string }[];
}

// deno-lint-ignore no-explicit-any
type Db = any;

async function syncIntegration(
  supabase: Db,
  integ: { id: string; organization_id: string; metadata: Record<string, unknown> },
  lookbackDays: number,
): Promise<{ rows: number; account: string | null; error?: string }> {
  const meta = integ.metadata ?? {};
  const tokenName = meta.token_secret_name as string | undefined;
  const adAccount = meta.selected_ad_account_id as string | undefined;
  if (!tokenName) return { rows: 0, account: null, error: 'sem token_secret_name' };
  if (!adAccount) return { rows: 0, account: null, error: 'sem conta de anúncios selecionada' };

  const { data: token, error: tokErr } = await supabase.rpc('meta_oauth_read_token', { p_name: tokenName });
  if (tokErr || !token) return { rows: 0, account: adAccount, error: `token: ${tokErr?.message ?? 'vazio'}` };

  const until = new Date();
  const since = new Date(until.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  const fields = [
    'campaign_id', 'campaign_name', 'adset_id', 'adset_name',
    'ad_id', 'ad_name', 'spend', 'impressions', 'clicks', 'reach',
    'ctr', 'cpc', 'cpm', 'actions',
  ].join(',');

  // A Meta limita o volume por pedido (level=ad + time_increment=1). Para
  // suportar backfill plurianual, parte-se a janela em blocos de 90 dias.
  const DAY = 24 * 60 * 60 * 1000;
  const WINDOW = 90 * DAY;
  const windows: Array<[Date, Date]> = [];
  for (let s = new Date(since); s < until;) {
    const e = new Date(Math.min(until.getTime(), s.getTime() + WINDOW));
    windows.push([s, e]);
    s = new Date(e.getTime() + DAY);
  }

  let currency: string | null = null;
  const records: Record<string, unknown>[] = [];

  for (const [winStart, winEnd] of windows) {
    const timeRange = JSON.stringify({ since: ymd(winStart), until: ymd(winEnd) });
    let url: string | null =
      `${GRAPH}/${adAccount}/insights?level=ad&time_increment=1` +
      `&time_range=${encodeURIComponent(timeRange)}&fields=${fields}` +
      `&limit=200&access_token=${encodeURIComponent(token as string)}`;
    let pages = 0;
    while (url && pages < 60) {
      pages++;
      const res = await fetch(url);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = body?.error?.message ?? `HTTP ${res.status}`;
        return { rows: 0, account: adAccount, error: errMsg };
      }
      const data = (body?.data ?? []) as InsightRow[];
      for (const r of data) {
        if (!r.ad_id || !r.date_start) continue;
        records.push({
          organization_id: integ.organization_id,
          integration_id: integ.id,
          date: r.date_start,
          level: 'ad',
          ad_account_id: adAccount,
          campaign_id: r.campaign_id ?? null,
          campaign_name: r.campaign_name ?? null,
          adset_id: r.adset_id ?? null,
          adset_name: r.adset_name ?? null,
          ad_id: r.ad_id,
          ad_name: r.ad_name ?? null,
          spend: toNum(r.spend),
          impressions: toInt(r.impressions),
          clicks: toInt(r.clicks),
          leads: countLeads(r.actions),
          reach: toInt(r.reach),
          ctr: toNum(r.ctr),
          cpc: toNum(r.cpc),
          cpm: toNum(r.cpm),
          currency,
          raw: r,
          synced_at: new Date().toISOString(),
        });
      }
      url = (body?.paging?.next as string) ?? null;
    }
  }

  // A moeda da conta (uma chamada leve; opcional).
  try {
    const accRes = await fetch(
      `${GRAPH}/${adAccount}?fields=currency&access_token=${encodeURIComponent(token as string)}`,
    );
    const accBody = await accRes.json().catch(() => ({}));
    currency = (accBody?.currency as string) ?? null;
    if (currency) for (const rec of records) rec.currency = currency;
  } catch { /* moeda é best-effort */ }

  if (records.length === 0) return { rows: 0, account: adAccount };

  // upsert em lotes (backfill pode trazer milhares de linhas).
  let written = 0;
  for (let i = 0; i < records.length; i += 500) {
    const chunk = records.slice(i, i + 500);
    const { error: upErr } = await supabase
      .from('ad_insights')
      .upsert(chunk, { onConflict: 'organization_id,integration_id,ad_id,date' });
    if (upErr) return { rows: written, account: adAccount, error: `upsert: ${upErr.message}` };
    written += chunk.length;
  }

  // Criativos (best-effort): só os anúncios ainda sem criativo guardado.
  await syncCreatives(supabase, integ, records, token as string);

  return { rows: written, account: adAccount };
}

// Busca e guarda o criativo (miniatura/tipo) dos anúncios que ainda não o têm.
async function syncCreatives(
  supabase: Db,
  integ: { id: string; organization_id: string },
  records: Record<string, unknown>[],
  token: string,
): Promise<void> {
  try {
    const adIds = Array.from(new Set(records.map((r) => r.ad_id as string).filter(Boolean)));
    if (adIds.length === 0) return;

    const { data: existing } = await supabase
      .from('ad_creatives')
      .select('ad_id')
      .eq('organization_id', integ.organization_id)
      .in('ad_id', adIds);
    const have = new Set((existing ?? []).map((e: { ad_id: string }) => e.ad_id));
    const missing = adIds.filter((id) => !have.has(id)).slice(0, 300);

    const creativeFields = encodeURIComponent('creative{id,thumbnail_url,image_url,object_type,video_id}');
    for (const adId of missing) {
      try {
        const res = await fetch(
          `${GRAPH}/${adId}?fields=${creativeFields}&access_token=${encodeURIComponent(token)}`,
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) continue;
        const c = body?.creative ?? {};
        const type = c.video_id ? 'video' : (c.image_url || c.thumbnail_url) ? 'image' : 'unknown';
        await supabase.from('ad_creatives').upsert(
          {
            organization_id: integ.organization_id,
            integration_id: integ.id,
            ad_id: adId,
            creative_id: c.id ?? null,
            thumbnail_url: c.thumbnail_url ?? null,
            image_url: c.image_url ?? null,
            creative_type: type,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'organization_id,ad_id' },
        );
      } catch { /* um criativo falhar não parte o sync */ }
    }
  } catch { /* criativos são best-effort */ }
}

Deno.serve(async (req: Request) => {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Auth: X-Cron-Secret == backup_cron_secret (mesmo padrão das outras de sistema).
  const cronSecret = req.headers.get('X-Cron-Secret') ?? '';
  const { data: expectedSecret } = await supabase.rpc('get_backup_cron_secret');
  if (!expectedSecret || cronSecret !== expectedSecret) {
    return json(403, { error: 'forbidden' });
  }

  const params = await loadAutomationParams(supabase, 'meta-insights-sync', DEFAULTS);
  // Máx ~36,5 meses (a Meta rejeita início > 37 meses); o cron diário usa 7.
  // Reter o histórico todo (medição vitalícia).
  const lookbackDays = Math.max(1, Math.min(1110, Math.floor(Number(params.lookback_days) || DEFAULTS.lookback_days)));

  let ok = true;
  let errorText: string | null = null;
  const summary: Array<{ integration: string; rows: number; account: string | null; error?: string }> = [];

  try {
    const { data: integrations, error: intErr } = await supabase
      .from('automation_integrations')
      .select('id, organization_id, metadata, status')
      .eq('provider', 'meta')
      .eq('status', 'active');
    if (intErr) throw new Error(intErr.message);

    for (const integ of integrations ?? []) {
      const r = await syncIntegration(supabase, integ, lookbackDays);
      summary.push({ integration: integ.id, ...r });
      if (r.error) { ok = false; errorText = r.error; }
    }
  } catch (e) {
    ok = false;
    errorText = e instanceof Error ? e.message : String(e);
  }

  // Regista a corrida (last_run) — best-effort, melhora o que se vê em /automacoes.
  try {
    const { data: cur } = await supabase
      .from('system_automations')
      .select('run_count, fail_count')
      .eq('key', 'meta-insights-sync')
      .maybeSingle();
    await supabase
      .from('system_automations')
      .update({
        last_run_at: new Date().toISOString(),
        last_run_ok: ok,
        last_run_error: errorText,
        run_count: (cur?.run_count ?? 0) + 1,
        fail_count: (cur?.fail_count ?? 0) + (ok ? 0 : 1),
      })
      .eq('key', 'meta-insights-sync');
  } catch { /* registo é best-effort */ }

  // Sempre 200 (regra: webhooks/crons nunca 5xx em erro lógico já tratado).
  return json(200, { ok, summary });
});
