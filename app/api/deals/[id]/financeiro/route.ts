// /api/deals/[id]/financeiro — ficha financeira por angariação (NS-1 Fase 4).
//   GET   → comissão (efectiva + override), despesas atribuídas, ganho líquido real.
//   PATCH → grava a comissão deste negócio (% ou € fixo + parte do consultor) em custom_fields.
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

async function getOrg() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }) };
  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
  if (!profile?.organization_id) return { error: NextResponse.json({ message: 'Profile not found' }, { status: 404 }) };
  return { supabase, orgId: profile.organization_id as string };
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

async function compute(supabase: Awaited<ReturnType<typeof createClient>>, orgId: string, id: string) {
  const { data: deal } = await supabase
    .from('deals')
    .select('id, value, custom_fields')
    .eq('organization_id', orgId)
    .eq('id', id)
    .maybeSingle();
  if (!deal) return null;

  const { data: settings } = await supabase
    .from('organization_settings')
    .select('default_commission_pct, default_consultant_share_pct')
    .eq('organization_id', orgId)
    .maybeSingle();
  const defPct = num(settings?.default_commission_pct) ?? 5;
  const defShare = num(settings?.default_consultant_share_pct) ?? 50;

  const cf = ((deal.custom_fields as Record<string, unknown> | null) ?? {});
  const value = num((deal as { value: unknown }).value) ?? 0;
  const mode = (cf['commission_mode'] as string) === 'fixed' ? 'fixed' : 'pct';
  const overridePct = num(cf['commission_pct']);
  const overrideAmount = num(cf['commission_amount']);
  const overrideShare = num(cf['consultant_share_pct']);

  const pct = overridePct ?? defPct;
  const share = overrideShare ?? defShare;
  const gross = mode === 'fixed' && overrideAmount != null ? overrideAmount : value * (pct / 100);
  const netCommission = gross * (share / 100);

  const { data: exps } = await supabase
    .from('expenses')
    .select('id, spent_on, category, description, amount_cents')
    .eq('organization_id', orgId)
    .eq('deal_id', id)
    .is('deleted_at', null)
    .order('spent_on', { ascending: false });
  const expensesCents = (exps ?? []).reduce((s, e) => s + (Number((e as { amount_cents: number }).amount_cents) || 0), 0);
  const netCommissionCents = Math.round(netCommission * 100);
  const grossCents = Math.round(gross * 100);
  const ganhoCents = netCommissionCents - expensesCents;

  return {
    value_cents: Math.round(value * 100),
    commission_mode: mode,
    commission_pct: overridePct ?? defPct,
    commission_amount: overrideAmount,
    consultant_share_pct: overrideShare ?? defShare,
    is_override: overridePct != null || overrideAmount != null || overrideShare != null || (cf['commission_mode'] != null),
    gross_commission_cents: grossCents,
    net_commission_cents: netCommissionCents,
    expenses_cents: expensesCents,
    ganho_liquido_cents: ganhoCents,
    margem: netCommissionCents > 0 ? ganhoCents / netCommissionCents : null,
    retorno: expensesCents > 0 ? netCommissionCents / expensesCents : null,
    expenses: (exps ?? []).map((e) => ({
      id: (e as { id: string }).id,
      spent_on: (e as { spent_on: string }).spent_on,
      category: (e as { category: string }).category,
      description: (e as { description: string | null }).description,
      amount_cents: (e as { amount_cents: number }).amount_cents,
    })),
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getOrg();
  if ('error' in ctx) return ctx.error;
  const result = await compute(ctx.supabase, ctx.orgId, id);
  if (!result) return NextResponse.json({ message: 'Negócio não encontrado.' }, { status: 404 });
  return NextResponse.json(result);
}

const PatchSchema = z.object({
  commission_mode: z.enum(['pct', 'fixed']),
  commission_pct: z.number().nonnegative().nullable().optional(),
  commission_amount: z.number().nonnegative().nullable().optional(),
  consultant_share_pct: z.number().min(0).max(100).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getOrg();
  if ('error' in ctx) return ctx.error;
  const { supabase, orgId } = ctx;

  let body: z.infer<typeof PatchSchema>;
  try {
    body = PatchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ message: 'Pedido inválido.' }, { status: 400 });
  }

  const { data: deal } = await supabase
    .from('deals')
    .select('custom_fields')
    .eq('organization_id', orgId)
    .eq('id', id)
    .maybeSingle();
  if (!deal) return NextResponse.json({ message: 'Negócio não encontrado.' }, { status: 404 });

  const cf = { ...((deal.custom_fields as Record<string, unknown> | null) ?? {}) };
  cf['commission_mode'] = body.commission_mode;
  cf['commission_pct'] = body.commission_pct ?? null;
  cf['commission_amount'] = body.commission_amount ?? null;
  cf['consultant_share_pct'] = body.consultant_share_pct ?? null;

  const { error } = await supabase
    .from('deals')
    .update({ custom_fields: cf })
    .eq('organization_id', orgId)
    .eq('id', id);
  if (error) return NextResponse.json({ message: error.message }, { status: 200 });

  const result = await compute(supabase, orgId, id);
  return NextResponse.json(result);
}
