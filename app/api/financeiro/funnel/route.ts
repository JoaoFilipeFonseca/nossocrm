// /api/financeiro/funnel — funil do pipeline (NS-1).
// Para um board, mostra quantos negócios CHEGARAM a cada etapa (estado actual:
// um negócio na etapa 3 já passou pelas 1 e 2) + a conversão entre etapas.
// Negócios perdidos/eliminados ficam de fora. Ganhos contam como etapa final.
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

export async function GET(request: NextRequest) {
  const ctx = await getOrg();
  if ('error' in ctx) return ctx.error;
  const { supabase, orgId } = ctx;

  const { data: boards } = await supabase
    .from('boards')
    .select('id, name')
    .eq('organization_id', orgId)
    .order('name');
  const boardList = (boards ?? []).map((b: { id: string; name: string }) => ({ id: b.id, name: b.name }));
  if (boardList.length === 0) return NextResponse.json({ boards: [], board_id: null, stages: [] });

  const boardId = request.nextUrl.searchParams.get('board_id') || boardList[0].id;

  const { data: stages } = await supabase
    .from('board_stages')
    .select('id, name, label, order')
    .eq('organization_id', orgId)
    .eq('board_id', boardId)
    .order('order', { ascending: true });
  const stageList = (stages ?? []) as { id: string; name: string | null; label: string | null; order: number }[];
  const orderById = new Map(stageList.map((s) => [s.id, s.order]));
  const maxOrder = stageList.length ? Math.max(...stageList.map((s) => s.order)) : 0;

  const { data: deals } = await supabase
    .from('deals')
    .select('id, value, stage_id, is_won, is_lost')
    .eq('organization_id', orgId)
    .eq('board_id', boardId)
    .is('deleted_at', null);

  // Ordem "alcançada" por cada negócio (ganho = etapa final).
  const reached: number[] = [];
  let wonCount = 0;
  let wonValueCents = 0;
  for (const d of deals ?? []) {
    if ((d as { is_lost: boolean }).is_lost) continue;
    const won = (d as { is_won: boolean }).is_won;
    const ord = won ? maxOrder : (orderById.get((d as { stage_id: string }).stage_id as string) ?? 0);
    reached.push(ord);
    if (won) {
      wonCount += 1;
      wonValueCents += Math.round((Number((d as { value: number }).value) || 0) * 100);
    }
  }

  const total = reached.length;
  const out = stageList.map((s, i) => {
    const cumulative = reached.filter((o) => o >= s.order).length;
    return {
      label: s.label || s.name || `Etapa ${i + 1}`,
      order: s.order,
      reached: cumulative,
      pct_total: total > 0 ? cumulative / total : 0,
      conv_prev: null as number | null,
    };
  });

  // Conversão entre etapas consecutivas (etapa i / etapa i-1).
  for (let i = 1; i < out.length; i++) {
    const prevReached = out[i - 1].reached;
    out[i].conv_prev = prevReached > 0 ? out[i].reached / prevReached : null;
  }

  return NextResponse.json({
    boards: boardList,
    board_id: boardId,
    total,
    won_count: wonCount,
    won_value_cents: wonValueCents,
    stages: out,
  });
}
