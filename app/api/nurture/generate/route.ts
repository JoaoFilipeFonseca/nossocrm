/**
 * POST /api/nurture/generate — BRIEF 7/7b. Gera rascunhos de uma onda para a fila.
 *
 * Autenticado (admin). Para um piloto (contactIds) ou por segmento (limit), gera
 * os emails personalizados (IA no tom da marca, fallback determinístico) e
 * insere-os em nurture_emails como 'pending'. Nada é enviado. Idempotente por
 * (contact_id, wave, step): re-gerar não duplica.
 *
 * Body: { wave?: string, step?: number, contactIds?: string[], segment?: string, limit?: number }
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createStaticAdminClient } from '@/lib/supabase/staticAdminClient';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { generateNurtureDrafts, type NurtureContext } from '@/lib/nurture/content';
import { isSegment, type Segment } from '@/lib/nurture/segments';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const DEFAULT_WAVE = 'reactivacao-2026-q3';

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

  let body: { wave?: string; step?: number; contactIds?: string[]; segment?: string; limit?: number } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* vazio */
  }
  const wave = (body.wave || DEFAULT_WAVE).trim();
  const step = Math.max(1, Math.min(3, Math.floor(Number(body.step) || 1)));
  const limit = Math.max(1, Math.min(200, Math.floor(Number(body.limit) || 20)));
  const filterSegment = body.segment && isSegment(body.segment) ? (body.segment as Segment) : null;
  const contactIds = Array.isArray(body.contactIds) ? body.contactIds.filter((x) => typeof x === 'string') : [];

  const admin = createStaticAdminClient();

  // 1) Seleccionar contactos-alvo: com email, com segmento, não opt-out.
  let q = admin
    .from('contacts')
    .select('id, name, email, source, segment, attribution')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .not('email', 'is', null)
    .neq('email', '')
    .not('segment', 'is', null)
    .or('email_opt_out.is.null,email_opt_out.eq.false');

  if (contactIds.length > 0) {
    q = q.in('id', contactIds);
  } else {
    if (filterSegment) q = q.eq('segment', filterSegment);
    q = q.order('created_at', { ascending: true }).limit(limit);
  }

  const { data: cData, error: cErr } = await q;
  if (cErr) return json({ error: `contacts: ${cErr.message}` }, 200);
  const contacts = (cData ?? []) as Array<{
    id: string;
    name: string | null;
    email: string;
    source: string | null;
    segment: string;
    attribution: { is_test?: boolean } | null;
  }>;

  const skipped = { no_segment: 0, is_test: 0, already_queued: 0 };
  const eligible = contacts.filter((c) => {
    if (!isSegment(c.segment)) {
      skipped.no_segment += 1;
      return false;
    }
    if (c.attribution?.is_test === true) {
      skipped.is_test += 1;
      return false;
    }
    return true;
  });
  if (eligible.length === 0) return json({ ok: true, generated: 0, skipped });

  const ids = eligible.map((c) => c.id);

  // 2) Já em fila para esta onda/passo? (idempotência)
  const { data: existing } = await admin
    .from('nurture_emails')
    .select('contact_id')
    .eq('organization_id', orgId)
    .eq('wave', wave)
    .eq('step', step)
    .in('contact_id', ids);
  const existingSet = new Set(((existing ?? []) as Array<{ contact_id: string }>).map((r) => r.contact_id));

  // 3) Contexto: funil (board) + negócio mais recente por contacto.
  const { data: deals } = await admin
    .from('deals')
    .select('id, contact_id, created_at, boards(name)')
    .in('contact_id', ids)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  const topDeal = new Map<string, { dealId: string; boardName: string | null }>();
  for (const d of (deals ?? []) as Array<{ id: string; contact_id: string; boards: { name?: string } | { name?: string }[] | null }>) {
    if (topDeal.has(d.contact_id)) continue; // já ordenado desc → primeiro = mais recente
    const bname = Array.isArray(d.boards) ? d.boards[0]?.name : d.boards?.name;
    topDeal.set(d.contact_id, { dealId: d.id, boardName: bname ?? null });
  }

  const now = Date.now();
  const targets = eligible.filter((c) => !existingSet.has(c.id));
  skipped.already_queued = eligible.length - targets.length;
  if (targets.length === 0) return json({ ok: true, generated: 0, skipped });

  const contexts: NurtureContext[] = targets.map((c) => {
    const td = topDeal.get(c.id);
    return {
      contactId: c.id,
      dealId: td?.dealId ?? null,
      name: c.name || '',
      email: c.email,
      source: c.source,
      boardName: td?.boardName ?? null,
      segment: c.segment as Segment,
      daysSinceCreated: null,
    };
  });

  // 4) Gerar e inserir na fila como pending.
  const drafts = await generateNurtureDrafts(admin, orgId, contexts, step);
  const byContact = new Map(drafts.map((d) => [d.contactId, d]));

  const rows = targets.map((c) => {
    const d = byContact.get(c.id)!;
    const td = topDeal.get(c.id);
    return {
      organization_id: orgId,
      contact_id: c.id,
      deal_id: td?.dealId ?? null,
      segment: c.segment,
      wave,
      step,
      to_email: c.email,
      subject: d.subject,
      body_text: d.bodyText,
      body_html: d.bodyHtml,
      status: 'pending',
      generated_by: d.generatedBy,
      personalization: { name: c.name, source: c.source, board: td?.boardName ?? null },
    };
  });

  const { data: inserted, error: insErr } = await admin
    .from('nurture_emails')
    .upsert(rows, { onConflict: 'contact_id,wave,step', ignoreDuplicates: true })
    .select('id');
  if (insErr) return json({ error: `insert: ${insErr.message}`, skipped }, 200);

  return json({ ok: true, generated: (inserted ?? []).length, skipped });
}
