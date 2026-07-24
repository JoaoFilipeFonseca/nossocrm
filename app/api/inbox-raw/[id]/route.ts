// /api/inbox-raw/[id] — editar (PATCH) e apagar (DELETE) um registo de raw intel.
// Apagar = arquivar (status='arquivado'): sai da lista, sem perda de dados.
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';

const INTENTS = ['angariacao', 'procura', 'fsbo_tip', 'parceiro', 'evento_mercado', 'concorrente', 'irrelevante'];
const OWNERSHIPS = ['minha', 'colega', 'externa'];

async function resolveOrg(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'not_authenticated' }, { status: 401 }) };
  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
  if (!profile?.organization_id) return { error: NextResponse.json({ error: 'no_org' }, { status: 404 }) };
  return { orgId: profile.organization_id as string };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { id } = await params;
    const supabase = await createClient();
    const ctx = await resolveOrg(supabase);
    if ('error' in ctx) return ctx.error;

    const body = await req.json().catch(() => ({}));
    const update: Record<string, unknown> = {};
    if (typeof body.notes === 'string') update.notes = body.notes.slice(0, 5000);
    if (typeof body.intent === 'string' && INTENTS.includes(body.intent)) update.intent = body.intent;
    if (typeof body.ownership === 'string' && OWNERSHIPS.includes(body.ownership)) update.ownership = body.ownership;
    if (body.contact && typeof body.contact === 'object') update.contact = body.contact;
    if (body.property && typeof body.property === 'object') update.property = body.property;

    if (Object.keys(update).length === 0) return NextResponse.json({ error: 'nada a actualizar' }, { status: 400 });
    update.reviewed_at = new Date().toISOString();

    const { error } = await supabase
      .from('raw_intel')
      .update(update)
      .eq('id', id)
      .eq('organization_id', ctx.orgId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { id } = await params;
    const supabase = await createClient();
    const ctx = await resolveOrg(supabase);
    if ('error' in ctx) return ctx.error;

    // Apagar da vista = arquivar (a lista ignora status='arquivado'). Reversível.
    const { error } = await supabase
      .from('raw_intel')
      .update({ status: 'arquivado' })
      .eq('id', id)
      .eq('organization_id', ctx.orgId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
}
