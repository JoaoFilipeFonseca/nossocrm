/**
 * POST /api/contacts/[id]/activities
 *
 * Sprint 13 c2 — CHQ associada a contacto sem deal específico.
 * Schema deal_activities permite agora deal_id NULL desde que contact_id seja
 * preenchido (constraint deal_activities_deal_or_contact_chk).
 *
 * Auth: sessão Supabase. RLS de deal_activities valida org. Verificação
 * adicional: contact pertence à org do user.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';

const ALLOWED_TYPES = ['call', 'meeting', 'visit', 'whatsapp', 'email', 'note'] as const;

const BodySchema = z
  .object({
    type: z.enum(ALLOWED_TYPES),
    description: z.string().max(5000).nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    // CT-TIMELINE: data/hora em que a interação ocorreu (permite registo retroactivo).
    occurredAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id: contactId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();
    if (profileError || !profile?.organization_id) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const raw = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('id, organization_id')
      .eq('id', contactId)
      .maybeSingle();
    if (contactError) {
      return NextResponse.json({ error: contactError.message }, { status: 500 });
    }
    if (!contact || contact.organization_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    const payload = {
      deal_id: null,
      contact_id: contactId,
      organization_id: profile.organization_id,
      owner_id: user.id,
      type: parsed.data.type,
      description: parsed.data.description ?? null,
      metadata: {
        ...(parsed.data.metadata ?? {}),
        via: parsed.data.metadata?.via || (parsed.data.occurredAt ? 'timeline-manual' : 'log-chq-quick-contact'),
        ...(parsed.data.occurredAt ? { occurred_at: parsed.data.occurredAt } : {}),
        logged_by: user.id,
      },
    };

    const { data: inserted, error: insertError } = await supabase
      .from('deal_activities')
      .insert(payload)
      .select('id, type, created_at')
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, activity: inserted });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * DELETE /api/contacts/[id]/activities?activityId=...
 * Apaga uma entrada HUMANA da timeline (registo manual OU toque via botões de
 * contacto, ex. clique em Telefonar no modal do negócio). Entradas de
 * automação/sistema nunca se apagam. RLS confina à org.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const { id: contactId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const activityId = request.nextUrl.searchParams.get('activityId');
    if (!activityId) return NextResponse.json({ error: 'activityId em falta' }, { status: 400 });

    // A entrada tem de pertencer ao âmbito deste contacto: ligada directamente
    // (contact_id) OU a um negócio deste contacto (a timeline agrega ambos).
    const { data: row, error: rowError } = await supabase
      .from('deal_activities')
      .select('id, contact_id, deal_id, actor, type')
      .eq('id', activityId)
      .maybeSingle();
    if (rowError) return NextResponse.json({ error: rowError.message }, { status: 500 });
    if (!row) return NextResponse.json({ error: 'Registo não encontrado' }, { status: 404 });

    if (row.actor !== 'human') {
      return NextResponse.json({ error: 'Só registos humanos podem ser apagados' }, { status: 403 });
    }

    let inScope = row.contact_id === contactId;
    if (!inScope && row.deal_id) {
      const { data: deal } = await supabase
        .from('deals')
        .select('id')
        .eq('id', row.deal_id)
        .eq('contact_id', contactId)
        .maybeSingle();
      inScope = Boolean(deal);
    }
    if (!inScope) return NextResponse.json({ error: 'Registo não pertence a este contacto' }, { status: 404 });

    const { error: delError } = await supabase
      .from('deal_activities')
      .delete()
      .eq('id', activityId);
    if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
