/**
 * POST /api/contacts/[id]/referrals     — cria uma indicação (Indicado por / Indicou)
 * DELETE /api/contacts/[id]/referrals?referralId=...  — remove uma indicação
 *
 * CT-1 (Fase 2). Auth por sessão; RLS de contact_referrals valida a org.
 * direction = 'referredBy' (o outro indicou ESTE contacto) | 'referred' (este
 * contacto indicou o outro).
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';

const PostSchema = z
  .object({
    direction: z.enum(['referredBy', 'referred']),
    otherContactId: z.string().uuid(),
    note: z.string().max(300).optional(),
  })
  .strict();

async function resolveOrg(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' as const, status: 401 };
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  if (profileError || !profile?.organization_id) return { error: 'Profile not found' as const, status: 404 };
  return { user, organizationId: profile.organization_id as string };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { id: contactId } = await params;
    const supabase = await createClient();
    const ctx = await resolveOrg(supabase);
    if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const raw = await request.json().catch(() => null);
    const parsed = PostSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }
    const { direction, otherContactId, note } = parsed.data;
    if (otherContactId === contactId) {
      return NextResponse.json({ error: 'Um contacto não pode indicar-se a si próprio.' }, { status: 400 });
    }

    // Ambos os contactos têm de ser da org (RLS já filtra, mas confirmamos os 2 ids).
    const { data: rows, error: chkError } = await supabase
      .from('contacts')
      .select('id')
      .in('id', [contactId, otherContactId])
      .eq('organization_id', ctx.organizationId);
    if (chkError) return NextResponse.json({ error: chkError.message }, { status: 500 });
    if (!rows || rows.length !== 2) {
      return NextResponse.json({ error: 'Contacto não encontrado nesta organização.' }, { status: 404 });
    }

    const referrer = direction === 'referredBy' ? otherContactId : contactId;
    const referred = direction === 'referredBy' ? contactId : otherContactId;

    const { data: inserted, error: insertError } = await supabase
      .from('contact_referrals')
      .insert({
        organization_id: ctx.organizationId,
        referrer_contact_id: referrer,
        referred_contact_id: referred,
        note: note || null,
        created_by: ctx.user.id,
      })
      .select('id')
      .maybeSingle();
    if (insertError) {
      // Conflito de unicidade = já existe; tratamos como sucesso idempotente.
      if (insertError.code === '23505') return NextResponse.json({ ok: true, duplicate: true });
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, referralId: inserted?.id ?? null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    await params; // contactId não é necessário (RLS por org + id da linha).
    const supabase = await createClient();
    const ctx = await resolveOrg(supabase);
    if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const referralId = request.nextUrl.searchParams.get('referralId');
    if (!referralId) return NextResponse.json({ error: 'referralId em falta' }, { status: 400 });

    const { error: delError } = await supabase
      .from('contact_referrals')
      .delete()
      .eq('id', referralId);
    if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
