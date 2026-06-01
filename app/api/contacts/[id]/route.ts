/**
 * PATCH /api/contacts/[id]
 *
 * CT-1 (Fase 2) — actualiza os campos ricos do contacto: custom_fields (saco
 * estilo Notion), notas e data de aniversário. Auth por sessão Supabase; RLS
 * de contacts valida a org. Verificação adicional: o contacto pertence à org
 * do utilizador.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';

const DiscSchema = z.enum(['D', 'I', 'S', 'C']);

const CustomFieldsSchema = z
  .object({
    address: z.string().max(500).optional(),
    familyMembers: z.string().max(500).optional(),
    pets: z.string().max(300).optional(),
    triggers: z.array(z.string().max(120)).max(20).optional(),
    disc: DiscSchema.nullable().optional(),
    quarter: z.string().max(20).optional(),
    followUp: z.boolean().optional(),
    followUpDate: z.string().max(10).optional(),
    lastActivityDate: z.string().max(10).optional(),
    lastActivityNote: z.string().max(300).optional(),
  })
  .strip();

const BodySchema = z
  .object({
    customFields: CustomFieldsSchema.optional(),
    notes: z.string().max(5000).nullable().optional(),
    birthDate: z.string().max(10).nullable().optional(),
  })
  .strict();

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }

    // Confirma que o contacto é da org do utilizador.
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

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.customFields !== undefined) {
      // Limpa chaves vazias para não acumular lixo no jsonb.
      const cf: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(parsed.data.customFields)) {
        if (v === undefined || v === null || v === '') continue;
        if (Array.isArray(v) && v.length === 0) continue;
        cf[k] = v;
      }
      updates.custom_fields = cf;
    }
    if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes || null;
    if (parsed.data.birthDate !== undefined) updates.birth_date = parsed.data.birthDate || null;

    const { error: updateError } = await supabase
      .from('contacts')
      .update(updates)
      .eq('id', contactId);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
