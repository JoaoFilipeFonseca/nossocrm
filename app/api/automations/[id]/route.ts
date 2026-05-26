/**
 * GET / PATCH / DELETE /api/automations/[id]
 *
 * Sprint 2.1, commit 2 de 3.
 *
 * GET: devolve o detail da automation (igual ao que /automacoes/[id] usa)
 * PATCH: actualiza campos editáveis (name, description, icon, category,
 *        definition). Não permite alterar status por aqui (usar
 *        /activate ou /deactivate). created_by, organization_id, id
 *        nunca mudam.
 * DELETE: apaga automação e cascade nas tabelas filhas via FK.
 *
 * Auth: sessão Supabase. RLS valida org.
 */
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

interface PatchBody {
  name?: string;
  description?: string | null;
  icon?: string | null;
  category?: string | null;
  definition?: { nodes?: unknown[]; edges?: unknown[] };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase
      .from('automations')
      .select('id, name, description, category, icon, status, version, definition, total_executions, success_count, failure_count, last_execution_at, created_at, updated_at, activated_at')
      .eq('id', id)
      .maybeSingle();

    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ message: 'Automação não encontrada' }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const body = (await request.json()) as PatchBody;

    const patch: Record<string, unknown> = {};
    if (typeof body.name === 'string') {
      const t = body.name.trim();
      if (!t) return NextResponse.json({ message: 'name não pode estar vazio' }, { status: 400 });
      patch.name = t;
    }
    if ('description' in body) patch.description = body.description ?? null;
    if ('icon' in body) patch.icon = body.icon ?? '⚡';
    if ('category' in body) patch.category = body.category ?? null;

    if (body.definition && typeof body.definition === 'object') {
      patch.definition = {
        nodes: Array.isArray(body.definition.nodes) ? body.definition.nodes : [],
        edges: Array.isArray(body.definition.edges) ? body.definition.edges : [],
      };
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ message: 'Nada para actualizar' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('automations')
      .update(patch)
      .eq('id', id)
      .select('id, name, status, version, updated_at')
      .maybeSingle();

    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ message: 'Automação não encontrada' }, { status: 404 });

    revalidatePath('/automacoes');
    revalidatePath(`/automacoes/${id}`);
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const { error } = await supabase.from('automations').delete().eq('id', id);
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    revalidatePath('/automacoes');
    return NextResponse.json({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
