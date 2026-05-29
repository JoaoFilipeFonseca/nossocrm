/**
 * /api/meta-ads/performance — desempenho por anúncio (Meta Ads Fase B b2).
 * Chama a RPC meta_ads_performance (scoped à org do utilizador autenticado).
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const days = Math.max(1, Math.min(365, parseInt(url.searchParams.get('days') || '30', 10)));
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase.rpc('meta_ads_performance', {
    p_from: ymd(from),
    p_to: ymd(to),
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ items: data ?? [], from: ymd(from), to: ymd(to), days });
}
