/**
 * POST /api/automations/[id]/deactivate
 *
 * Sprint 1.3, commit 2 de 4.
 *
 * Pausa uma automação: status='paused', is_active=false em todos os triggers.
 * As execuções em curso (waiting/running) continuam.
 *
 * Auth: sessão Supabase. RLS valida update.
 */
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const { data: automation, error: aErr } = await supabase
      .from('automations')
      .select('id, organization_id')
      .eq('id', id)
      .maybeSingle();
    if (aErr) return NextResponse.json({ message: aErr.message }, { status: 500 });
    if (!automation) return NextResponse.json({ message: 'Automação não encontrada' }, { status: 404 });

    const { error: updErr } = await supabase
      .from('automations')
      .update({ status: 'paused' })
      .eq('id', automation.id);
    if (updErr) return NextResponse.json({ message: updErr.message }, { status: 500 });

    await supabase
      .from('automation_triggers')
      .update({ is_active: false })
      .eq('automation_id', automation.id);

    revalidatePath('/automacoes');
    return NextResponse.json({ status: 'paused' }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
