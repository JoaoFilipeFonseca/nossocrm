/**
 * GET  /api/nurture/segments — lista contactos segmentados (revisão) + contagens.
 * PATCH /api/nurture/segments — correcção inline do segmento de um contacto.
 *
 * Autenticado (sessão). RLS de contacts garante a org. A correcção marca
 * segment_set_by='human' para o alicerce/IA nunca a sobreporem.
 *
 * GET query: ?segment=<slug|todos>&search=<txt>&limit=<n>&offset=<n>
 * PATCH body: { contactId: string, segment: <slug> }
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { SEGMENTS, isSegment } from '@/lib/nurture/segments';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

async function authOrg(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized', status: 401 as const };
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle();
  const orgId = (profile as { organization_id?: string } | null)?.organization_id;
  if (!orgId) return { error: 'Profile not found', status: 404 as const };
  return { orgId };
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const auth = await authOrg(supabase);
  if ('error' in auth) return json({ error: auth.error }, auth.status);

  const url = new URL(req.url);
  const segment = (url.searchParams.get('segment') || 'todos').trim();
  const search = (url.searchParams.get('search') || '').trim();
  const limit = Math.max(1, Math.min(200, Math.floor(Number(url.searchParams.get('limit')) || 50)));
  const offset = Math.max(0, Math.floor(Number(url.searchParams.get('offset')) || 0));

  // Contagens por segmento (para os separadores da UI).
  const { data: allRows } = await supabase
    .from('contacts')
    .select('segment')
    .is('deleted_at', null);
  const counts: Record<string, number> = { todos: 0 };
  for (const s of SEGMENTS) counts[s] = 0;
  counts.por_classificar = 0;
  for (const r of (allRows ?? []) as Array<{ segment: string | null }>) {
    counts.todos += 1;
    if (r.segment && isSegment(r.segment)) counts[r.segment] += 1;
    else counts.por_classificar += 1;
  }

  // Página de contactos.
  let q = supabase
    .from('contacts')
    .select('id, name, email, phone, source, segment, segment_set_by, segment_rationale', { count: 'exact' })
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1);

  if (segment === 'por_classificar') {
    q = q.is('segment', null);
  } else if (segment !== 'todos' && isSegment(segment)) {
    q = q.eq('segment', segment);
  }
  if (search) {
    const safe = search.replace(/[%_]/g, (m) => `\\${m}`);
    q = q.or(`name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`);
  }

  const { data: rows, count, error } = await q;
  if (error) return json({ error: error.message }, 500);

  return json({ counts, total: count ?? 0, contacts: rows ?? [] });
}

export async function PATCH(req: NextRequest) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);
  const supabase = await createClient();
  const auth = await authOrg(supabase);
  if ('error' in auth) return json({ error: auth.error }, auth.status);

  const raw = (await req.json().catch(() => null)) as { contactId?: string; segment?: string } | null;
  const contactId = raw?.contactId;
  const segment = raw?.segment;
  if (!contactId || !segment || !isSegment(segment)) {
    return json({ error: 'contactId e segment (válido) obrigatórios' }, 400);
  }

  const { error } = await supabase
    .from('contacts')
    .update({
      segment,
      segment_set_by: 'human',
      segment_rationale: 'Corrigido manualmente pelo João.',
      segment_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', contactId);
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true });
}
