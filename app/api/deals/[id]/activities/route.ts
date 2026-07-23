/**
 * /api/deals/[id]/activities
 *
 * GET    — timeline de deal_activities do negócio (+ toques do contacto principal).
 * POST   — regista um toque humano (canal + resultado + nota opcional, data retroactiva).
 * DELETE — apaga um registo HUMANO da timeline (?activityId=...).
 *
 * Os tipos {call,meeting,visit,whatsapp,sms,email} são os que contam como
 * Conversa Humana Qualificada. `note` é uma anotação. O `result` (metadata.result)
 * distingue atendeu/não atendeu — ver lib/activities/vocab.ts.
 *
 * Auth: sessão Supabase. RLS de deal_activities valida org; verificação adicional
 * de que o negócio pertence à org do utilizador.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { getDealTimeline } from '@/lib/contacts/detail';
import { CHANNELS, RESULTS } from '@/lib/activities/vocab';

const ALLOWED_TYPES = [...CHANNELS, 'note'] as const;

const BodySchema = z
  .object({
    type: z.enum(ALLOWED_TYPES),
    description: z.string().max(5000).nullable().optional(),
    // Resultado do contacto (só faz sentido com um canal, não com nota).
    result: z.enum(RESULTS).nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    // Data/hora em que a interação ocorreu (permite registo retroactivo).
    occurredAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

async function resolveOrg(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' as const, status: 401 };

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  if (profileError || !profile?.organization_id) {
    return { error: 'Profile not found' as const, status: 404 };
  }
  return { user, organizationId: profile.organization_id as string };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const { id: dealId } = await params;
    const supabase = await createClient();
    const org = await resolveOrg(supabase);
    if ('error' in org) return NextResponse.json({ error: org.error }, { status: org.status });

    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('id, organization_id')
      .eq('id', dealId)
      .maybeSingle();
    if (dealError) return NextResponse.json({ error: dealError.message }, { status: 500 });
    if (!deal || deal.organization_id !== org.organizationId) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    const entries = await getDealTimeline(dealId, 100);
    return NextResponse.json({ entries });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id: dealId } = await params;
    const supabase = await createClient();
    const org = await resolveOrg(supabase);
    if ('error' in org) return NextResponse.json({ error: org.error }, { status: org.status });

    const raw = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // Verificar que o deal pertence à org do user (defesa em profundidade — RLS
    // também protege, mas isto dá-nos erro 404 mais claro). Buscamos também o
    // contacto para associar o toque à pessoa (timeline "tudo ligado").
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('id, organization_id, contact_id')
      .eq('id', dealId)
      .maybeSingle();
    if (dealError) {
      return NextResponse.json({ error: dealError.message }, { status: 500 });
    }
    if (!deal || deal.organization_id !== org.organizationId) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    const result = parsed.data.type === 'note' ? null : parsed.data.result ?? null;

    const payload = {
      deal_id: dealId,
      contact_id: deal.contact_id ?? null,
      organization_id: org.organizationId,
      owner_id: org.user.id,
      type: parsed.data.type,
      description: parsed.data.description ?? null,
      metadata: {
        ...(parsed.data.metadata ?? {}),
        via: parsed.data.metadata?.via || 'activity-modal',
        ...(result ? { result } : {}),
        ...(parsed.data.occurredAt ? { occurred_at: parsed.data.occurredAt } : {}),
        logged_by: org.user.id,
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
 * DELETE /api/deals/[id]/activities?activityId=...
 * Apaga uma entrada HUMANA da timeline. Entradas de automação/sistema nunca se
 * apagam. A entrada tem de pertencer ao negócio OU ao seu contacto principal.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const { id: dealId } = await params;
    const supabase = await createClient();
    const org = await resolveOrg(supabase);
    if ('error' in org) return NextResponse.json({ error: org.error }, { status: org.status });

    const activityId = request.nextUrl.searchParams.get('activityId');
    if (!activityId) return NextResponse.json({ error: 'activityId em falta' }, { status: 400 });

    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('id, organization_id, contact_id')
      .eq('id', dealId)
      .maybeSingle();
    if (dealError) return NextResponse.json({ error: dealError.message }, { status: 500 });
    if (!deal || deal.organization_id !== org.organizationId) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    const { data: row, error: rowError } = await supabase
      .from('deal_activities')
      .select('id, contact_id, deal_id, actor')
      .eq('id', activityId)
      .maybeSingle();
    if (rowError) return NextResponse.json({ error: rowError.message }, { status: 500 });
    if (!row) return NextResponse.json({ error: 'Registo não encontrado' }, { status: 404 });

    if (row.actor !== 'human') {
      return NextResponse.json({ error: 'Só registos humanos podem ser apagados' }, { status: 403 });
    }

    const inScope = row.deal_id === dealId || (!!deal.contact_id && row.contact_id === deal.contact_id);
    if (!inScope) return NextResponse.json({ error: 'Registo não pertence a este negócio' }, { status: 404 });

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
