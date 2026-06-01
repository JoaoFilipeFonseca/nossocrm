// /api/expenses/[id] — actualizar / eliminar uma despesa (soft-delete).
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
  return { supabase, orgId: profile.organization_id as string };
}

const PatchSchema = z.object({
  spent_on: z.string().min(8).optional(),
  category: z.string().min(1).max(60).optional(),
  description: z.string().max(500).nullable().optional(),
  amount: z.number().nonnegative().optional(),
  deal_id: z.string().uuid().nullable().optional(),
  imovel_id: z.string().uuid().nullable().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getOrg();
  if ('error' in ctx) return ctx.error;
  const { supabase, orgId } = ctx;

  let body: z.infer<typeof PatchSchema>;
  try {
    body = PatchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ message: 'Pedido inválido.' }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.spent_on !== undefined) patch.spent_on = body.spent_on;
  if (body.category !== undefined) patch.category = body.category;
  if (body.description !== undefined) patch.description = body.description;
  if (body.amount !== undefined) patch.amount_cents = Math.round(body.amount * 100);
  if (body.deal_id !== undefined) patch.deal_id = body.deal_id;
  if (body.imovel_id !== undefined) patch.imovel_id = body.imovel_id;

  const { data, error } = await supabase
    .from('expenses')
    .update(patch)
    .eq('id', id)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .select('id, spent_on, category, description, amount_cents, deal_id, imovel_id, created_at')
    .maybeSingle();

  if (error) return NextResponse.json({ message: error.message }, { status: 200 });
  if (!data) return NextResponse.json({ message: 'Despesa não encontrada.' }, { status: 404 });
  return NextResponse.json({ expense: data });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getOrg();
  if ('error' in ctx) return ctx.error;
  const { supabase, orgId } = ctx;

  const { error } = await supabase
    .from('expenses')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', orgId)
    .is('deleted_at', null);

  if (error) return NextResponse.json({ message: error.message }, { status: 200 });
  return NextResponse.json({ ok: true });
}
