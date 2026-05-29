/**
 * /api/meta-ads/analyses — devolve os veredictos do analista IA guardados
 * (último dia analisado) da org do utilizador. Lido pelo painel em /anuncios.
 */
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // Último dia com análises (RLS limita à org do utilizador).
  const { data: lastRow } = await supabase
    .from('ad_analyses')
    .select('analyzed_at')
    .order('analyzed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastDay = (lastRow as { analyzed_at?: string } | null)?.analyzed_at ?? null;
  if (!lastDay) return Response.json({ items: [], analyzed_at: null });

  const { data, error } = await supabase
    .from('ad_analyses')
    .select('ad_id, ad_name, verdict, confidence, reason, suggestion, impact_eur, is_anomaly, days_with_data')
    .eq('analyzed_at', lastDay);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ items: data ?? [], analyzed_at: lastDay });
}
