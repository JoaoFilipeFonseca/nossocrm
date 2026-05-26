/**
 * API REST para automações.
 *
 * Sprint 1.3, commit 1 de 4.
 *
 * - POST /api/automations
 *     body: { name, description?, category?, icon?, definition: {nodes, edges}, status? }
 *     cria automação em status='draft' por defeito (a menos que body.status seja
 *     fornecido). Activação separada via /api/automations/[id]/activate.
 *
 * - GET /api/automations
 *     lista todas as automações da organização do utilizador autenticado.
 *     RLS filtra por org automaticamente.
 *
 * Auth: sessão Supabase (cookie SSR). Sem session → 401.
 * Multi-tenant: organization_id resolvido via profile do user, RLS valida.
 */
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

interface AutomationCreatePayload {
  name?: string;
  description?: string | null;
  category?: string | null;
  icon?: string | null;
  status?: 'draft' | 'active' | 'paused' | 'archived';
  definition?: { nodes?: unknown[]; edges?: unknown[] };
}

const VALID_STATUS = new Set(['draft', 'active', 'paused', 'archived']);

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile?.organization_id) {
      return NextResponse.json({ message: 'Profile sem organização' }, { status: 404 });
    }

    const body = (await request.json()) as AutomationCreatePayload;

    const name = (body.name ?? '').trim();
    if (!name) return NextResponse.json({ message: 'name é obrigatório' }, { status: 400 });

    const status = body.status && VALID_STATUS.has(body.status) ? body.status : 'draft';

    const definition = body.definition && typeof body.definition === 'object'
      ? {
          nodes: Array.isArray(body.definition.nodes) ? body.definition.nodes : [],
          edges: Array.isArray(body.definition.edges) ? body.definition.edges : [],
        }
      : { nodes: [], edges: [] };

    const payload = {
      organization_id: profile.organization_id,
      name,
      description: body.description ?? null,
      category: body.category ?? null,
      icon: body.icon ?? '⚡',
      status,
      definition,
      created_by: user.id,
    };

    const { data, error } = await supabase
      .from('automations')
      .insert(payload)
      .select('id, name, status, definition, created_at')
      .single();

    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    revalidatePath('/automacoes');
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    // RLS filtra por org. Não precisamos de adicionar where organization_id aqui.
    const { data, error } = await supabase
      .from('automations')
      .select('id, name, description, category, icon, status, version, total_executions, success_count, failure_count, last_execution_at, created_at, updated_at, activated_at')
      .order('updated_at', { ascending: false });

    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    return NextResponse.json({ automations: data ?? [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
