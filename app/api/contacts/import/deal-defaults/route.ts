import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/contacts/import/deal-defaults
 *
 * Devolve a configuração default de routing para criar Oportunidades durante
 * o import — mapeia QV → Proprietários, QC → Compradores, QAP → Proprietários,
 * QAA → Arrendamento, default → Compradores.
 *
 * Resolve dinamicamente os board_id e stage_id ('oportunidade') a partir do
 * Supabase, para não hard-codar UUIDs no frontend.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile?.organization_id) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    const orgId = profile.organization_id;

    // Buscar 3 boards e respectiva stage 'oportunidade' por nome
    const { data: stages, error: stagesError } = await supabase
      .from('board_stages')
      .select('id, name, board_id, boards!inner(id, name, organization_id)')
      .eq('name', 'oportunidade')
      .eq('boards.organization_id', orgId);

    if (stagesError) {
      return NextResponse.json({ error: stagesError.message }, { status: 400 });
    }

    type StageRow = {
      id: string;
      board_id: string;
      boards: { id: string; name: string } | { id: string; name: string }[];
    };

    const byBoardName: Record<string, { boardId: string; stageId: string }> = {};
    for (const s of (stages || []) as StageRow[]) {
      const board = Array.isArray(s.boards) ? s.boards[0] : s.boards;
      if (!board) continue;
      byBoardName[board.name] = { boardId: s.board_id, stageId: s.id };
    }

    const proprietarios = byBoardName['Proprietários'] || null;
    const compradores = byBoardName['Compradores'] || null;
    const arrendamento = byBoardName['Arrendamento'] || null;

    if (!proprietarios || !compradores || !arrendamento) {
      return NextResponse.json(
        {
          error: 'Boards Proprietários / Compradores / Arrendamento sem stage "oportunidade" — verificar migration.',
          encontrados: Object.keys(byBoardName),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      routing: {
        QV: proprietarios, // vendedor → board Proprietários
        QC: compradores, // comprador → board Compradores
        QAP: proprietarios, // proprietário-arrendar → board Proprietários
        QAA: arrendamento, // arrendatário → board Arrendamento
        default: compradores, // não qualificados → Compradores
      },
      boards: {
        proprietarios,
        compradores,
        arrendamento,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error)?.message || 'Erro inesperado' },
      { status: 500 }
    );
  }
}
