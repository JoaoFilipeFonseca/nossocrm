/**
 * POST /api/contacts/[id]/enrich — CONTACT-360-AI Fase 2 (auto-enriquecimento).
 *
 * Aplica UMA sugestão aceite pelo utilizador a contacts.custom_fields, fazendo
 * o merge no servidor (lê o actual, define o campo, grava). Para triggers faz
 * união (não duplica). Auth por sessão; valida a org do contacto.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import type { ContactCustomFields } from '@/types';

const BodySchema = z
  .object({
    campo: z.enum(['disc', 'triggers', 'quarter', 'familyMembers', 'pets', 'address']),
    valor: z.string().trim().min(1).max(300),
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

    const raw = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }

    // Lê o contacto (RLS confina à org) + o custom_fields actual.
    const { data: contact, error: cErr } = await supabase
      .from('contacts')
      .select('id, organization_id, custom_fields')
      .eq('id', contactId)
      .maybeSingle();
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
    if (!contact || contact.organization_id !== orgId) {
      return NextResponse.json({ error: 'Contacto não encontrado' }, { status: 404 });
    }

    const cf: ContactCustomFields = (contact.custom_fields as ContactCustomFields) ?? {};
    const { campo, valor } = parsed.data;

    if (campo === 'triggers') {
      const current = Array.isArray(cf.triggers) ? cf.triggers : [];
      const norm = (s: string) => s.trim().toLocaleLowerCase('pt-PT');
      if (!current.some((t) => norm(t) === norm(valor))) {
        cf.triggers = [...current, valor.trim()];
      }
    } else if (campo === 'disc') {
      const letter = valor.trim().toUpperCase();
      if (['D', 'I', 'S', 'C'].includes(letter)) cf.disc = letter as ContactCustomFields['disc'];
      else return NextResponse.json({ error: 'DISC inválido' }, { status: 400 });
    } else {
      // quarter | familyMembers | pets | address
      cf[campo] = valor.trim();
    }

    const { error: uErr } = await supabase
      .from('contacts')
      .update({ custom_fields: cf, updated_at: new Date().toISOString() })
      .eq('id', contactId);
    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, customFields: cf });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
