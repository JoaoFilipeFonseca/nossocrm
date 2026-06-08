// GET /api/funnel — dados do Funil de Vendas (MKT-FUNNEL-CRM).
// Devolve os funis (boards) da org + o resultado da RPC sales_funnel para o
// funil escolhido e intervalo de datas. Auth + org-scoped. Nunca 5xx em erro lógico.
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle();
  const orgId = (profile as { organization_id?: string } | null)?.organization_id;
  if (!orgId) return NextResponse.json({ error: 'Sem organização' }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const fromRaw = searchParams.get('from');
  const toRaw = searchParams.get('to');
  // Datas: 'YYYY-MM-DD' → início/fim do dia; vazio → null (sem limite).
  const from = fromRaw ? `${fromRaw}T00:00:00` : null;
  const to = toRaw ? `${toRaw}T23:59:59` : null;

  const { data: boards } = await supabase
    .from('boards')
    .select('id, name, position')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .order('position', { ascending: true });

  const list = (boards ?? []) as Array<{ id: string; name: string; position: number }>;
  let boardId = searchParams.get('board_id');
  // Default: o funil com mais negócios abertos costuma ser o de Compradores;
  // na falta de escolha, o primeiro por posição.
  if (!boardId && list.length > 0) boardId = list[0].id;

  const { data: funnel, error } = await supabase.rpc('sales_funnel', {
    p_board_id: boardId,
    p_from: from,
    p_to: to,
  });
  if (error) return NextResponse.json({ error: error.message, boards: list, board_id: boardId }, { status: 200 });

  return NextResponse.json({ boards: list, board_id: boardId, funnel });
}
