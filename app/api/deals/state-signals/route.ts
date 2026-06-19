/**
 * PONTO 1 — GET /api/deals/state-signals
 *
 * Devolve os sinais de ESTADO por negócio aberto da org (RPC my_deal_state_signals,
 * RLS via get_user_org_id). A "verdade única": etapa + último toque humano E de
 * automação + tarefas reais + estado derivado. Consumido pelo Inbox para deixar
 * de decidir "parado/risco" por deals.updated_at (que mente).
 */
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase.rpc('my_deal_state_signals');
  if (error) {
    console.error('[deals/state-signals] rpc error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ signals: data ?? [] });
}
