/**
 * POST /api/nurture/queue/action — BRIEF 7. Aprovar / rejeitar / editar / apagar
 * emails da fila de nurture, em lote. Autenticado (sessão, RLS pela org).
 *
 * Body:
 *   { action: 'approve'|'reject'|'delete', ids: string[] }
 *   { action: 'edit', ids: [id], subject?: string, bodyText?: string }
 *
 * Só emails 'pending' ou 'rejected' podem ser aprovados; só 'pending'/'approved'
 * podem ser editados. Um email já 'sent' não se toca.
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { renderNurtureHtml } from '@/lib/nurture/content';
import { sanitizeCopy } from '@/lib/ai/sanitize';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

  const raw = (await req.json().catch(() => null)) as
    | { action?: string; ids?: string[]; subject?: string; bodyText?: string }
    | null;
  const action = raw?.action;
  const ids = Array.isArray(raw?.ids) ? raw!.ids.filter((x) => typeof x === 'string') : [];
  if (!action || ids.length === 0) return json({ error: 'action e ids obrigatórios' }, 400);

  const nowIso = new Date().toISOString();

  if (action === 'approve') {
    const { data, error } = await supabase
      .from('nurture_emails')
      .update({ status: 'approved', approved_by: user.id, approved_at: nowIso })
      .in('id', ids)
      .in('status', ['pending', 'rejected'])
      .select('id');
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, updated: (data ?? []).length });
  }

  if (action === 'reject') {
    const { data, error } = await supabase
      .from('nurture_emails')
      .update({ status: 'rejected' })
      .in('id', ids)
      .in('status', ['pending', 'approved'])
      .select('id');
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, updated: (data ?? []).length });
  }

  if (action === 'delete') {
    const { data, error } = await supabase
      .from('nurture_emails')
      .delete()
      .in('id', ids)
      .neq('status', 'sent')
      .select('id');
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, updated: (data ?? []).length });
  }

  if (action === 'edit') {
    if (ids.length !== 1) return json({ error: 'edit aceita um só id' }, 400);
    const updates: Record<string, unknown> = {};
    if (typeof raw?.subject === 'string') updates.subject = sanitizeCopy(raw.subject).trim().slice(0, 200);
    if (typeof raw?.bodyText === 'string') {
      const bt = sanitizeCopy(raw.bodyText).trim();
      updates.body_text = bt;
      updates.body_html = renderNurtureHtml(bt);
    }
    if (Object.keys(updates).length === 0) return json({ error: 'nada para editar' }, 400);
    const { data, error } = await supabase
      .from('nurture_emails')
      .update(updates)
      .eq('id', ids[0])
      .in('status', ['pending', 'approved'])
      .select('id');
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, updated: (data ?? []).length });
  }

  return json({ error: 'acção inválida' }, 400);
}
