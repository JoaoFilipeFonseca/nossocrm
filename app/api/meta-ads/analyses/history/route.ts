/**
 * /api/meta-ads/analyses/history — histórico das recomendações do analista IA
 * (série diária de `ad_analyses`, mais recente primeiro), para consulta mesmo
 * depois de mudarem ou de serem dispensadas. RLS limita à org do utilizador.
 * Filtro opcional ?ad_id= para o histórico de um anúncio.
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const adId = new URL(req.url).searchParams.get('ad_id');
  let q = supabase
    .from('ad_analyses')
    .select('analyzed_at, ad_id, ad_name, verdict, confidence, reason, suggestion, impact_eur, is_anomaly')
    .order('analyzed_at', { ascending: false })
    .limit(500);
  if (adId) q = q.eq('ad_id', adId);

  const { data, error } = await q;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ items: data ?? [] });
}
