/**
 * DASH-2 — GET /api/deals/lead-scores
 *
 * Devolve os SINAIS por negócio aberto da org (RPC my_deal_lead_score_signals, RLS via
 * get_user_org_id) + a data de hoje em Lisboa. O score calcula-se no cliente com a lib
 * pura lib/deals/leadScore.ts (determinista, testada) — sem tabelas novas.
 */
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase.rpc('my_deal_lead_score_signals');
  if (error) {
    console.error('[deals/lead-scores] rpc error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date());
  return Response.json({ signals: data ?? [], today });
}
