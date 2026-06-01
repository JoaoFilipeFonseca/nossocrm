// /api/financeiro/summary — Visão de Gestor (NS-1 Fase 3).
// Junta, para o período pedido: comissões líquidas (negócios ganhos),
// investimento (anúncios do Meta + despesas) → lucro, margem, retorno,
// e a repartição "para onde foi o dinheiro". Tudo org-scoped via RLS.
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function getOrg() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }) };
  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
  if (!profile?.organization_id) return { error: NextResponse.json({ message: 'Profile not found' }, { status: 404 }) };
  return { supabase, orgId: profile.organization_id as string };
}

type CF = Record<string, unknown> | null;
const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

export async function GET(request: NextRequest) {
  const ctx = await getOrg();
  if ('error' in ctx) return ctx.error;
  const { supabase, orgId } = ctx;

  const url = new URL(request.url);
  const from = url.searchParams.get('from'); // YYYY-MM-DD (inclusive)
  const to = url.searchParams.get('to');     // YYYY-MM-DD (inclusive)
  const inPeriod = (iso: string | null) => {
    if (!iso) return false;
    const d = iso.slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  };

  // Comissão por defeito da org.
  const { data: settings } = await supabase
    .from('organization_settings')
    .select('default_commission_pct, default_consultant_share_pct')
    .eq('organization_id', orgId)
    .maybeSingle();
  const defPct = num(settings?.default_commission_pct) ?? 5;
  const defShare = num(settings?.default_consultant_share_pct) ?? 50;

  // Negócios ganhos (a comissão conta-se pela data de fecho).
  const { data: wonDeals } = await supabase
    .from('deals')
    .select('id, value, closed_at, updated_at, custom_fields')
    .eq('organization_id', orgId)
    .eq('is_won', true)
    .is('deleted_at', null);

  let comissoesCents = 0;
  let wonCount = 0;
  for (const d of wonDeals ?? []) {
    const when = (d.closed_at as string | null) ?? (d.updated_at as string | null);
    if (!inPeriod(when)) continue;
    const cf = (d.custom_fields as CF) ?? {};
    const value = num((d as { value: unknown }).value) ?? 0;
    const mode = (cf['commission_mode'] as string) || 'pct';
    const fixed = num(cf['commission_amount']);
    const pct = num(cf['commission_pct']) ?? defPct;
    const gross = mode === 'fixed' && fixed != null ? fixed : value * (pct / 100);
    const share = num(cf['consultant_share_pct']) ?? defShare;
    const net = gross * (share / 100);
    comissoesCents += Math.round(net * 100);
    wonCount += 1;
  }

  // Gasto em anúncios (Meta) no período.
  let adsQ = supabase
    .from('ad_insights')
    .select('spend, leads, date, level')
    .eq('organization_id', orgId)
    .eq('level', 'ad');
  if (from) adsQ = adsQ.gte('date', from);
  if (to) adsQ = adsQ.lte('date', to);
  const { data: ads } = await adsQ;
  let adsCents = 0;
  let leads = 0;
  for (const r of ads ?? []) {
    adsCents += Math.round((num((r as { spend: unknown }).spend) ?? 0) * 100);
    leads += Number((r as { leads: number | null }).leads ?? 0) || 0;
  }

  // Despesas no período, por categoria.
  let expQ = supabase
    .from('expenses')
    .select('amount_cents, category, spent_on')
    .eq('organization_id', orgId)
    .is('deleted_at', null);
  if (from) expQ = expQ.gte('spent_on', from);
  if (to) expQ = expQ.lte('spent_on', to);
  const { data: exps } = await expQ;
  let expensesCents = 0;
  const byCategory: Record<string, number> = {};
  for (const e of exps ?? []) {
    const c = Math.round(num((e as { amount_cents: unknown }).amount_cents) ?? 0);
    expensesCents += c;
    const cat = (e as { category: string }).category || 'Outros';
    byCategory[cat] = (byCategory[cat] ?? 0) + c;
  }

  const investimentoCents = adsCents + expensesCents;
  const lucroCents = comissoesCents - investimentoCents;
  const margem = comissoesCents > 0 ? lucroCents / comissoesCents : null;
  const retorno = investimentoCents > 0 ? comissoesCents / investimentoCents : null;

  // Repartição "para onde foi o dinheiro": anúncios + categorias de despesa.
  const breakdown: { label: string; cents: number }[] = [];
  if (adsCents > 0) breakdown.push({ label: 'Anúncios (Facebook)', cents: adsCents });
  for (const [label, cents] of Object.entries(byCategory)) breakdown.push({ label, cents });
  breakdown.sort((a, b) => b.cents - a.cents);

  return NextResponse.json({
    comissoes_liquidas_cents: comissoesCents,
    investimento_cents: investimentoCents,
    ads_cents: adsCents,
    despesas_cents: expensesCents,
    lucro_cents: lucroCents,
    margem, // 0..1 ou null
    retorno, // x ou null
    won_count: wonCount,
    leads, // leads reportadas pelo Meta no período
    custo_por_lead_cents: leads > 0 ? Math.round(adsCents / leads) : null,
    breakdown,
  });
}
