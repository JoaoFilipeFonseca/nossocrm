import { createClient } from '@/lib/supabase/server';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

/**
 * GET /api/dashboard/chq-breakdown?days=7&owner=<uuid>
 * Sprint 16 c1 — devolve array com CHQ por dia para a UI desenhar bar chart.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const daysParam = url.searchParams.get('days');
  const ownerParam = url.searchParams.get('owner');

  let days = 7;
  if (daysParam) {
    const d = Number(daysParam);
    if (!Number.isFinite(d) || d < 1 || d > 90) {
      return json({ error: 'days must be between 1 and 90' }, 400);
    }
    days = d;
  }

  const ownerId = ownerParam && ownerParam.trim() !== '' ? ownerParam : null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const { data, error } = await supabase.rpc('compute_chq_breakdown', {
    p_days: days,
    p_owner: ownerId,
  });

  if (error) return json({ error: error.message }, 500);
  return json({ days, breakdown: data ?? [] });
}
