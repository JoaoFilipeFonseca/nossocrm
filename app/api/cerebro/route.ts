// GET /api/cerebro — Cérebro de Marketing (MKT-BRAIN), capstone do MKT-MEASURE.
// Junta as 4 fontes (anúncios + funil/negócios + CAPI/ganhos + orgânico) e pede
// à IA os padrões + próximas acções. Tudo ao vivo, sem tabelas novas. Admin+org.
// Nunca 5xx em erro lógico.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { generateText, Output } from 'ai';
import { resolveMetaAdminContext, metaJson } from '@/lib/integrations/meta/server';
import { getPageAccessToken } from '@/lib/integrations/meta/leadforms';
import { fetchPagePosts, summarizeOrganic } from '@/lib/integrations/meta/organic';
import { computeDealCommission } from '@/lib/financeiro/commission';
import { getModelForFeature, type AIKeys } from '@/lib/ai/router';
import { runWithAIFallback } from '@/lib/ai/run-with-fallback';

const n = (v: unknown): number => (typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : 0) || 0;

const BrainSchema = z.object({
  headline: z.string(),
  insights: z.array(z.object({ title: z.string(), detail: z.string(), confidence: z.enum(['alta', 'média', 'baixa']) })).max(5),
  actions: z.array(z.object({ kind: z.enum(['reforcar', 'parar', 'repetir', 'corrigir']), text: z.string() })).max(6),
});

export async function GET(req: NextRequest) {
  const resolved = await resolveMetaAdminContext();
  if (resolved.error) return resolved.error;
  const c = resolved.ctx;

  const { searchParams } = new URL(req.url);
  const days = Math.min(370, Math.max(7, parseInt(searchParams.get('days') || '90', 10) || 90));
  const to = new Date();
  const from = new Date(to.getTime() - days * 864e5);
  const ymd = (d: Date) => d.toISOString().slice(0, 10);

  // 1) Anúncios + atribuição de ganhos (RPC admin existente)
  const { data: perf } = await c.admin.rpc('meta_ads_performance_admin', { p_org: c.orgId, p_from: ymd(from), p_to: ymd(to) });
  const ads = (perf ?? []).map((r: Record<string, unknown>) => ({
    ad_id: String(r.ad_id), ad_name: (r.ad_name as string) ?? String(r.ad_id),
    spend: n(r.spend), leads: n(r.crm_leads) || n(r.meta_leads),
    won: n(r.won_deals), won_value: n(r.won_value),
  }));
  const spend = ads.reduce((s: number, a: { spend: number }) => s + a.spend, 0);
  const adLeads = ads.reduce((s: number, a: { leads: number }) => s + a.leads, 0);

  // 2) Negócios (funil + ganhos com comissão líquida)
  const { data: settings } = await c.admin
    .from('organization_settings')
    .select('default_commission_pct, default_consultant_share_pct, ai_google_key, ai_anthropic_key')
    .eq('organization_id', c.orgId).maybeSingle();
  const defs = { defaultPct: settings?.default_commission_pct as number | null, defaultSharePct: settings?.default_consultant_share_pct as number | null };

  const { count: openCount } = await c.admin.from('deals').select('id', { count: 'exact', head: true })
    .eq('organization_id', c.orgId).is('deleted_at', null).eq('is_won', false).eq('is_lost', false);
  const { count: leadsTotal } = await c.admin.from('deals').select('id', { count: 'exact', head: true })
    .eq('organization_id', c.orgId).is('deleted_at', null).gte('created_at', from.toISOString());
  const { data: wonDeals } = await c.admin.from('deals').select('value, custom_fields')
    .eq('organization_id', c.orgId).is('deleted_at', null).eq('is_won', true)
    .gte('closed_at', from.toISOString()).lte('closed_at', to.toISOString());
  let wonValue = 0;
  for (const d of (wonDeals ?? []) as Array<{ value: unknown; custom_fields: Record<string, unknown> | null }>) {
    wonValue += computeDealCommission({ value: d.value, custom_fields: d.custom_fields }, defs).netEuros;
  }
  const wonCount = (wonDeals ?? []).length;

  // 3) Orgânico (ao vivo)
  let organic = { posts: 0, interactions: 0, top: [] as Array<{ message: string; interactions: number; media_type: string }> };
  if (c.pageId) {
    try {
      const pageToken = await getPageAccessToken(c.pageId, c.token);
      const posts = await fetchPagePosts(c.pageId, pageToken, from.toISOString(), to.toISOString());
      const sum = summarizeOrganic(posts);
      organic = { posts: sum.kpis.posts, interactions: sum.kpis.interactions, top: sum.top.slice(0, 5).map((p) => ({ message: p.message, interactions: p.interactions, media_type: p.media_type })) };
    } catch { /* orgânico best-effort */ }
  }

  const flow = {
    spend: Math.round(spend),
    interactions: organic.interactions,
    leads_total: leadsTotal ?? 0,
    open: openCount ?? 0,
    won: wonCount,
    won_value: Math.round(wonValue),
    roas: spend > 0 ? Math.round((wonValue / spend) * 10) / 10 : null,
  };
  const sources = ads.filter((a: { leads: number; spend: number }) => a.leads > 0 || a.spend > 0)
    .sort((a: { won_value: number }, b: { won_value: number }) => b.won_value - a.won_value).slice(0, 10);

  // 4) IA — padrões + acções (motor que já existe)
  const keys: AIKeys = {};
  if (settings?.ai_google_key) keys.google = settings.ai_google_key;
  if (settings?.ai_anthropic_key) keys.anthropic = settings.ai_anthropic_key;

  let brain: z.infer<typeof BrainSchema> | null = null;
  try {
    const primary = getModelForFeature('generic', keys).model;
    const fallback = getModelForFeature('generic', { anthropic: keys.anthropic }).model;
    if (primary) {
      const prompt = `És o analista de marketing de uma imobiliária em Portugal. Escreve em português europeu (pré acordo ortográfico), sem traços. Dá padrões accionáveis e curtos.
PERCURSO (${days} dias): investido ${flow.spend}€, interações orgânicas ${flow.interactions}, leads que entraram ${flow.leads_total}, em aberto ${flow.open}, ganhos ${flow.won} no valor ${flow.won_value}€, ROAS ${flow.roas ?? 'n/d'}.
ANÚNCIOS (nome | leads | ganhos | valor): ${sources.map((a: { ad_name: string; leads: number; won: number; won_value: number }) => `${a.ad_name} | ${a.leads} | ${a.won} | ${Math.round(a.won_value)}€`).join(' ; ') || 'sem dados'}.
ORGÂNICO (melhores posts | interações): ${organic.top.map((p) => `"${p.message.slice(0, 40)}" | ${p.interactions}`).join(' ; ') || 'sem dados'}.
Regras: distingue "o que traz leads" de "o que traz negócios ganhos". Aponta anúncios com muitas leads e 0 ganhos para "parar". Reforça os que dão ganhos. Repete formatos de orgânico que puxam interacção. Se a maioria está em aberto/presa, o gargalo é dentro do CRM (corrigir).
Devolve: headline (1 frase), insights (2-4, com confiança alta/média/baixa) e actions (kind reforcar/parar/repetir/corrigir).`;
      const { result } = await runWithAIFallback(
        () => generateText({ model: primary, prompt, output: Output.object({ schema: BrainSchema }) }),
        fallback && fallback !== primary ? () => generateText({ model: fallback, prompt, output: Output.object({ schema: BrainSchema }) }) : null,
      );
      brain = result.output as z.infer<typeof BrainSchema>;
    }
  } catch { /* IA best-effort — o painel mostra os números mesmo sem narrativa */ }

  return metaJson({ days, flow, sources, organic_top: organic.top, brain });
}
