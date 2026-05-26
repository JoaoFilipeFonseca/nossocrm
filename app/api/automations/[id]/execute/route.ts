/**
 * POST /api/automations/[id]/execute
 *
 * Sprint 1.3, commit 2 de 4.
 *
 * Dispara manualmente uma automação. Body opcional:
 *   { trigger_event?: { type, payload }, is_test?: boolean }
 *
 * Auth: sessão Supabase. Verifica que o user tem acesso à automação via RLS
 * (SELECT preliminar). Depois usa admin client para invocar a Edge Function
 * automation-execute (que requer service_role).
 *
 * Devolve { execution_id, status, ... } da Edge Function.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createStaticAdminClient } from '@/lib/supabase/server';

interface ExecuteBody {
  trigger_event?: { type: string; payload: unknown };
  is_test?: boolean;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    // Verifica acesso via RLS, traz organization_id
    const { data: automation, error: aErr } = await supabase
      .from('automations')
      .select('id, organization_id, status')
      .eq('id', id)
      .maybeSingle();

    if (aErr) return NextResponse.json({ message: aErr.message }, { status: 500 });
    if (!automation) return NextResponse.json({ message: 'Automação não encontrada' }, { status: 404 });

    const body = (await request.json().catch(() => ({}))) as ExecuteBody;

    // Invoca Edge Function via admin client (service_role)
    const admin = createStaticAdminClient();
    const { data, error } = await admin.functions.invoke('automation-execute', {
      body: {
        automation_id: automation.id,
        organization_id: automation.organization_id,
        trigger_event: body.trigger_event ?? { type: 'manual.triggered', payload: { source: 'api', user_id: user.id } },
        is_test: body.is_test ?? false,
      },
    });

    if (error) return NextResponse.json({ message: error.message ?? 'Falha ao invocar executor' }, { status: 502 });

    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
