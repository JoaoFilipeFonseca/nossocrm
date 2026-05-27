/**
 * POST /api/deals/[id]/activities
 *
 * Sprint 11 c1 — Atom logging humano (CHQ).
 *
 * Cria uma row em `deal_activities` com type ∈ {call,meeting,visit,whatsapp,email}.
 * Estes são os tipos que a RPC `compute_honest_metrics` conta como Conversa
 * Humana Qualificada. Sem este endpoint o CHQ na subaba Honestos mostra
 * apenas contactos novos.
 *
 * Auth: sessão Supabase. RLS valida org (política "Users can insert own org
 * deal activities" já existe).
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';

const ALLOWED_TYPES = ['call', 'meeting', 'visit', 'whatsapp', 'email'] as const;

const BodySchema = z
  .object({
    type: z.enum(ALLOWED_TYPES),
    description: z.string().max(2000).nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id: dealId } = await params;
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

    // Verificar que o deal pertence à org do user (defesa em profundidade — RLS
    // também protege, mas isto dá-nos erro 404 mais claro).
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('id, organization_id')
      .eq('id', dealId)
      .maybeSingle();
    if (dealError) {
      return NextResponse.json({ error: dealError.message }, { status: 500 });
    }
    if (!deal || deal.organization_id !== profile.organization_id) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }

    const payload = {
      deal_id: dealId,
      organization_id: profile.organization_id,
      type: parsed.data.type,
      description: parsed.data.description ?? null,
      metadata: {
        ...(parsed.data.metadata ?? {}),
        via: 'log-chq-quick',
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
