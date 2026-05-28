/**
 * GET /api/admin/client-errors — lista últimos 30 erros da org (admin)
 * PATCH /api/admin/client-errors?id=<uuid> — marca como resolved
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

async function getAdminProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single();
  if (!profile || profile.role !== 'admin') return null;
  return profile;
}

export async function GET() {
  const supabase = await createClient();
  const profile = await getAdminProfile(supabase);
  if (!profile) return json({ error: 'Forbidden' }, 403);

  const { data, error } = await supabase
    .from('client_errors')
    .select('id, source, message, stack, url, created_at, resolved, alerted_at')
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) return json({ error: error.message }, 500);
  return json({ items: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'id required' }, 400);

  const supabase = await createClient();
  const profile = await getAdminProfile(supabase);
  if (!profile) return json({ error: 'Forbidden' }, 403);

  const body = await req.json().catch(() => ({}));
  const resolved = typeof body.resolved === 'boolean' ? body.resolved : true;

  const { error } = await supabase
    .from('client_errors')
    .update({ resolved })
    .eq('id', id)
    .eq('organization_id', profile.organization_id);

  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}
