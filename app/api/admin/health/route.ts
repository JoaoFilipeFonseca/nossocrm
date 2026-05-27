/**
 * GET /api/admin/health
 *
 * Sprint 19 c1 — devolve estado operacional para a página /admin/saude.
 * RPC compute_health_status valida que o user é admin da org.
 */
import { createClient } from '@/lib/supabase/server';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const { data, error } = await supabase.rpc('compute_health_status');
  if (error) return json({ error: error.message }, error.message.includes('admin only') ? 403 : 500);
  return json({ health: data });
}
