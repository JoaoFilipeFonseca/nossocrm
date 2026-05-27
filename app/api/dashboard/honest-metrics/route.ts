import { createClient } from '@/lib/supabase/server';
import { getHonestMetrics } from '@/features/dashboard/honest-metrics';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ownerParam = url.searchParams.get('owner');
  const yearParam = url.searchParams.get('year');

  const ownerId = ownerParam && ownerParam.trim() !== '' ? ownerParam : null;
  let year: number | null = null;
  if (yearParam) {
    const y = Number(yearParam);
    if (!Number.isFinite(y) || y < 2024 || y > 2100) {
      return json({ error: 'Invalid year' }, 400);
    }
    year = y;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);

  try {
    const metrics = await getHonestMetrics(supabase, { ownerId, year });
    return json({ metrics });
  } catch (e) {
    return json({ error: (e as Error).message || 'Failed to compute metrics' }, 500);
  }
}
