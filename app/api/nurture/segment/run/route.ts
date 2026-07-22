/**
 * POST /api/nurture/segment/run — BRIEF 7/7b. Segmenta a base.
 *
 * Autenticado (admin da org). Corre o alicerce determinístico (RPC
 * nurture_segment_base, cobre 100%) e, se pedido, deixa a IA refinar um lote
 * com base no histórico. Nunca sobrepõe correcções humanas.
 *
 * Body: { ai?: boolean, aiLimit?: number, onlyUnset?: boolean }
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createStaticAdminClient } from '@/lib/supabase/staticAdminClient';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { refineSegmentsWithAI, type SegmentContext } from '@/lib/nurture/segment';
import { isSegment, type Segment } from '@/lib/nurture/segments';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export async function POST(req: NextRequest) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .maybeSingle();
  const orgId = (profile as { organization_id?: string } | null)?.organization_id;
  const role = (profile as { role?: string } | null)?.role;
  if (!orgId) return json({ error: 'Profile not found' }, 404);
  if (role !== 'admin') return json({ error: 'Admin only' }, 403);

  let body: { ai?: boolean; aiLimit?: number; onlyUnset?: boolean } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* corpo vazio */
  }
  const onlyUnset = body.onlyUnset !== false; // default true
  const aiLimit = Math.max(0, Math.min(200, Math.floor(Number(body.aiLimit) || 0)));

  const admin = createStaticAdminClient();

  // 1) Alicerce determinístico (100%).
  const { data: countsData, error: baseErr } = await admin.rpc('nurture_segment_base', {
    p_org: orgId,
    p_only_unset: onlyUnset,
  });
  if (baseErr) return json({ error: `nurture_segment_base: ${baseErr.message}` }, 200);
  const counts = (countsData ?? []) as Array<{ segment: string; n: number }>;

  // 2) Refinamento por IA (opcional, limitado).
  let refined = 0;
  if (body.ai && aiLimit > 0) {
    try {
      // Contactos candidatos (não corrigidos à mão), com dados básicos.
      const { data: contacts } = await admin
        .from('contacts')
        .select('id, name, source, notes, created_at, segment, segment_set_by')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .neq('segment_set_by', 'human')
        .order('created_at', { ascending: true })
        .limit(aiLimit);

      const rows = (contacts ?? []) as Array<{
        id: string;
        name: string | null;
        source: string | null;
        notes: string | null;
        created_at: string;
        segment: string | null;
      }>;

      if (rows.length > 0) {
        const ids = rows.map((r) => r.id);
        // Funis (boards) de cada contacto + se fechou negócio.
        const { data: deals } = await admin
          .from('deals')
          .select('contact_id, is_won, boards(name)')
          .in('contact_id', ids)
          .is('deleted_at', null);

        const boardsByContact = new Map<string, Set<string>>();
        const wonByContact = new Set<string>();
        for (const d of (deals ?? []) as Array<{ contact_id: string; is_won: boolean; boards: { name?: string } | { name?: string }[] | null }>) {
          const bname = Array.isArray(d.boards) ? d.boards[0]?.name : d.boards?.name;
          if (bname) {
            if (!boardsByContact.has(d.contact_id)) boardsByContact.set(d.contact_id, new Set());
            boardsByContact.get(d.contact_id)!.add(bname);
          }
          if (d.is_won) wonByContact.add(d.contact_id);
        }

        const now = Date.now();
        const items: SegmentContext[] = rows.map((r) => ({
          id: r.id,
          name: r.name || '',
          source: r.source,
          boards: Array.from(boardsByContact.get(r.id) ?? []),
          hasWon: wonByContact.has(r.id),
          notes: r.notes,
          daysSinceCreated: r.created_at
            ? Math.floor((now - new Date(r.created_at).getTime()) / 86400000)
            : null,
          current: isSegment(r.segment) ? (r.segment as Segment) : null,
        }));

        const suggestions = await refineSegmentsWithAI(admin, orgId, items);
        for (const [id, sug] of suggestions) {
          const { error: upErr } = await admin
            .from('contacts')
            .update({
              segment: sug.segment,
              segment_set_by: 'ai',
              segment_rationale: sug.rationale,
              segment_updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .eq('organization_id', orgId)
            .neq('segment_set_by', 'human');
          if (!upErr) refined += 1;
        }
      }
    } catch (e) {
      console.warn('[nurture/segment/run] refino IA falhou:', (e as Error).message);
    }
  }

  return json({ ok: true, counts, refined });
}
