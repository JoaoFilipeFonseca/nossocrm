// /api/expenses — despesas operacionais (NS-1 Gestão Financeira).
//   GET  → lista as despesas da org (filtros opcionais: from, to, deal_id).
//   POST → cria uma despesa.
// Utilizador autenticado; org resolvida pelo perfil; RLS reforça o âmbito.
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

async function getOrg() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }) };
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  if (!profile?.organization_id) return { error: NextResponse.json({ message: 'Profile not found' }, { status: 404 }) };
  return { supabase, userId: user.id, orgId: profile.organization_id as string };
}

export async function GET(request: NextRequest) {
  const ctx = await getOrg();
  if ('error' in ctx) return ctx.error;
  const { supabase, orgId } = ctx;

  const url = new URL(request.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const dealId = url.searchParams.get('deal_id');

  let q = supabase
    .from('expenses')
    .select('id, spent_on, category, description, amount_cents, deal_id, imovel_id, created_at')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .order('spent_on', { ascending: false })
    .order('created_at', { ascending: false });

  if (from) q = q.gte('spent_on', from);
  if (to) q = q.lte('spent_on', to);
  if (dealId) q = q.eq('deal_id', dealId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ message: error.message }, { status: 200 });

  return NextResponse.json({ expenses: data ?? [] });
}

const CreateSchema = z.object({
  spent_on: z.string().min(8), // YYYY-MM-DD
  category: z.string().min(1).max(60),
  description: z.string().max(500).nullable().optional(),
  amount: z.number().nonnegative(), // euros
  deal_id: z.string().uuid().nullable().optional(),
  imovel_id: z.string().uuid().nullable().optional(),
});

export async function POST(request: NextRequest) {
  const ctx = await getOrg();
  if ('error' in ctx) return ctx.error;
  const { supabase, userId, orgId } = ctx;

  let body: z.infer<typeof CreateSchema>;
  try {
    body = CreateSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ message: 'Pedido inválido.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      organization_id: orgId,
      created_by: userId,
      spent_on: body.spent_on,
      category: body.category,
      description: body.description ?? null,
      amount_cents: Math.round(body.amount * 100),
      deal_id: body.deal_id ?? null,
      imovel_id: body.imovel_id ?? null,
    })
    .select('id, spent_on, category, description, amount_cents, deal_id, imovel_id, created_at')
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 200 });
  return NextResponse.json({ expense: data });
}
