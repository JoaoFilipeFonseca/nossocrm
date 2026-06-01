/**
 * POST /api/contacts/[id]/suggestion-feedback — CONTACT-360-AI Fase 3.
 *
 * Regista que uma sugestão do Assistente 360 foi IGNORADA (o "aceite" é
 * registado no /enrich). Serve para a IA aprender com o que o consultor
 * rejeita. Best-effort; auth por sessão; RLS valida a org.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';

const BodySchema = z
  .object({
    campo: z.string().max(40),
    valor: z.string().max(300),
  })
  .strict();

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { id: contactId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).maybeSingle();
    const orgId = (profile as { organization_id?: string } | null)?.organization_id;
    if (!orgId) return NextResponse.json({ error: 'Sem organização' }, { status: 400 });

    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    await supabase.from('contact_ai_suggestion_events').insert({
      organization_id: orgId,
      contact_id: contactId,
      created_by: user.id,
      campo: parsed.data.campo,
      valor: parsed.data.valor,
      action: 'ignored',
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
