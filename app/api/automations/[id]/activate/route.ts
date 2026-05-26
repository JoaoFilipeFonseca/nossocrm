/**
 * POST /api/automations/[id]/activate
 *
 * Sprint 1.3, commit 2 de 4.
 *
 * Activa uma automação:
 *  1. status='active', activated_at=NOW()
 *  2. Lê automations.definition.nodes, extrai TODOS os nós com atom='trigger.event'
 *  3. Insere/actualiza automation_triggers correspondentes
 *     (trigger_type='event', config={events}, is_active=true)
 *  4. Desactiva quaisquer triggers anteriores em sobra
 *
 * Multi-trigger suportado (uma automação pode reagir a vários eventos).
 *
 * Auth: sessão Supabase. RLS valida que o user pode actualizar.
 */
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

interface AutomationNode {
  id: string;
  atom: string;
  config?: { events?: string[] } & Record<string, unknown>;
}

interface AutomationDefinition {
  nodes?: AutomationNode[];
  edges?: unknown[];
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const { data: automation, error: aErr } = await supabase
      .from('automations')
      .select('id, organization_id, definition')
      .eq('id', id)
      .maybeSingle();

    if (aErr) return NextResponse.json({ message: aErr.message }, { status: 500 });
    if (!automation) return NextResponse.json({ message: 'Automação não encontrada' }, { status: 404 });

    const def = (automation.definition as AutomationDefinition) ?? { nodes: [], edges: [] };
    const triggerNodes = (def.nodes ?? []).filter((n) => n.atom === 'trigger.event');

    if (triggerNodes.length === 0) {
      return NextResponse.json({ message: 'Automação sem nó trigger.event, não pode ser activada' }, { status: 400 });
    }

    // Valida que cada trigger tem events configurados
    for (const tn of triggerNodes) {
      const events = tn.config?.events ?? [];
      if (!Array.isArray(events) || events.length === 0) {
        return NextResponse.json({ message: `Nó trigger ${tn.id} sem config.events` }, { status: 400 });
      }
    }

    // 1. Marca automação como active
    const { error: updErr } = await supabase
      .from('automations')
      .update({ status: 'active', activated_at: new Date().toISOString() })
      .eq('id', automation.id);
    if (updErr) return NextResponse.json({ message: updErr.message }, { status: 500 });

    // 2. Desactiva triggers anteriores e remove
    await supabase.from('automation_triggers').delete().eq('automation_id', automation.id);

    // 3. Insere triggers novos
    const rows = triggerNodes.map((tn) => ({
      automation_id: automation.id,
      organization_id: automation.organization_id,
      trigger_type: 'event',
      config: { events: tn.config?.events ?? [] },
      is_active: true,
    }));
    const { error: insErr } = await supabase.from('automation_triggers').insert(rows);
    if (insErr) return NextResponse.json({ message: insErr.message }, { status: 500 });

    revalidatePath('/automacoes');
    return NextResponse.json({ status: 'active', triggers: rows.length }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
