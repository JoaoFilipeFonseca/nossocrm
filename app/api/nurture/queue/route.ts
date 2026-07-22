/**
 * GET /api/nurture/queue — BRIEF 7. A fila de emails de nurture para aprovação.
 *
 * Autenticado (sessão, RLS pela org). Devolve as linhas (com nome do contacto)
 * e as contagens por estado, para a UI em Mensagens › Nurture.
 *
 * Query: ?status=<estado|todos>&wave=<onda>&segment=<slug>&limit=&offset=
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isSegment } from '@/lib/nurture/segments';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STATUSES = ['pending', 'approved', 'rejected', 'sent', 'failed', 'skipped'] as const;

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const url = new URL(req.url);
  const status = (url.searchParams.get('status') || 'pending').trim();
  const wave = (url.searchParams.get('wave') || '').trim();
  const segment = (url.searchParams.get('segment') || '').trim();
  const limit = Math.max(1, Math.min(200, Math.floor(Number(url.searchParams.get('limit')) || 100)));
  const offset = Math.max(0, Math.floor(Number(url.searchParams.get('offset')) || 0));

  // Contagens por estado (para os separadores).
  const { data: allRows } = await supabase.from('nurture_emails').select('status, wave');
  const counts: Record<string, number> = { todos: 0 };
  for (const s of STATUSES) counts[s] = 0;
  const waves = new Set<string>();
  for (const r of (allRows ?? []) as Array<{ status: string; wave: string }>) {
    counts.todos += 1;
    if (r.status in counts) counts[r.status] += 1;
    if (r.wave) waves.add(r.wave);
  }

  let q = supabase
    .from('nurture_emails')
    .select(
      'id, contact_id, deal_id, segment, wave, step, to_email, subject, body_text, body_html, status, generated_by, opened_at, clicked_at, replied_at, sent_at, approved_at, created_at, contacts(name)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status !== 'todos' && (STATUSES as readonly string[]).includes(status)) q = q.eq('status', status);
  if (wave) q = q.eq('wave', wave);
  if (segment && isSegment(segment)) q = q.eq('segment', segment);

  const { data: rows, count, error } = await q;
  if (error) return json({ error: error.message }, 500);

  const items = ((rows ?? []) as Array<Record<string, unknown> & { contacts?: { name?: string } | { name?: string }[] | null }>).map(
    (r) => {
      const c = r.contacts;
      const name = Array.isArray(c) ? c[0]?.name : c?.name;
      const { contacts: _c, ...rest } = r;
      void _c;
      return { ...rest, contact_name: name ?? null };
    },
  );

  return json({ counts, total: count ?? 0, waves: Array.from(waves), items });
}
