/**
 * Classificação de uma conversa de mensageria num funil (WA-4a).
 *
 * GET  /api/messaging/conversations/[id]/classify
 *   → estado actual: contacto ligado?, funil actual do negócio aberto, nº de
 *     mensagens recebidas (para o aviso de continuidade).
 *
 * POST /api/messaging/conversations/[id]/classify   body: { funnel }
 *   → o consultor carrega num botão (Comprador/Proprietário/Arrendamento) e:
 *     - se o contacto NÃO tem negócio aberto → cria um na etapa "Oportunidade"
 *       desse funil (lead com continuidade real; atribuição do canal via activity);
 *     - se já tem negócio aberto → MOVE-o para esse funil (sem duplicar);
 *     - liga a conversa ao negócio.
 *
 * Regras: contacto≠lead até o clique humano; sem duplicar negócios; tudo filtrado
 * por organization_id além do RLS.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';

type FunnelKey = 'compradores' | 'proprietarios' | 'arrendamento';

const FUNNEL_LABEL: Record<FunnelKey, string> = {
  compradores: 'Compradores',
  proprietarios: 'Proprietários',
  arrendamento: 'Arrendamento',
};

/** Normaliza para comparar nomes de funil sem acentos nem maiúsculas. */
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

async function resolveOrgId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; app_metadata?: Record<string, unknown> }
): Promise<string | undefined> {
  const fromJwt = user.app_metadata?.organization_id as string | undefined;
  if (fromJwt) return fromJwt;
  const { data } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  return data?.organization_id as string | undefined;
}

interface BoardRow {
  id: string;
  name: string;
}
interface StageRow {
  id: string;
  name: string;
  order: number;
  board_id: string;
}

/** Resolve o board do funil pedido + a etapa "Oportunidade" (order=1). */
async function resolveTarget(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  funnel: FunnelKey
): Promise<{ boardId: string; boardName: string; stageId: string } | null> {
  const { data: boards } = await supabase
    .from('boards')
    .select('id, name')
    .eq('organization_id', orgId)
    .is('deleted_at', null);

  const target = (boards as BoardRow[] | null)?.find(
    (b) => normalize(b.name) === funnel
  );
  if (!target) return null;

  const { data: stages } = await supabase
    .from('board_stages')
    .select('id, name, "order", board_id')
    .eq('board_id', target.id)
    .order('order', { ascending: true });

  const list = (stages as StageRow[] | null) ?? [];
  // "Oportunidade" = etapa de ordem 1 nos 3 funis; com fallbacks defensivos.
  const stage =
    list.find((s) => s.order === 1) ??
    list.find((s) => normalize(s.name) === 'oportunidade') ??
    list.find((s) => s.order > 0) ??
    list[0];

  if (!stage) return null;
  return { boardId: target.id, boardName: target.name, stageId: stage.id };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const orgId = await resolveOrgId(supabase, user);
  if (!orgId) return NextResponse.json({ message: 'Profile not found' }, { status: 404 });

  const { data: conv } = await supabase
    .from('messaging_conversations')
    .select('id, contact_id')
    .eq('id', conversationId)
    .eq('organization_id', orgId)
    .maybeSingle();

  if (!conv) return NextResponse.json({ message: 'Conversation not found' }, { status: 404 });

  // Nº de mensagens recebidas (continuidade) — a 2.ª inbound activa o aviso.
  const { count: inboundCount } = await supabase
    .from('messaging_messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversationId)
    .eq('direction', 'inbound');

  let currentBoardId: string | null = null;
  let currentBoardName: string | null = null;
  let hasOpenDeal = false;

  if (conv.contact_id) {
    const { data: deal } = await supabase
      .from('deals')
      .select('id, board_id')
      .eq('contact_id', conv.contact_id)
      .eq('organization_id', orgId)
      .eq('status', 'open')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (deal) {
      hasOpenDeal = true;
      currentBoardId = deal.board_id;
      const { data: board } = await supabase
        .from('boards')
        .select('name')
        .eq('id', deal.board_id)
        .maybeSingle();
      currentBoardName = board?.name ?? null;
    }
  }

  return NextResponse.json({
    hasContact: !!conv.contact_id,
    inboundCount: inboundCount ?? 0,
    hasOpenDeal,
    currentBoardId,
    currentBoardName,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const { id: conversationId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const orgId = await resolveOrgId(supabase, user);
  if (!orgId) return NextResponse.json({ message: 'Profile not found' }, { status: 404 });

  let body: { funnel?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const funnel = body.funnel as FunnelKey;
  if (!funnel || !FUNNEL_LABEL[funnel]) {
    return NextResponse.json({ message: 'Funil inválido' }, { status: 400 });
  }

  // Conversa + contacto
  const { data: conv } = await supabase
    .from('messaging_conversations')
    .select('id, contact_id, external_contact_name, metadata, channel_id')
    .eq('id', conversationId)
    .eq('organization_id', orgId)
    .maybeSingle();

  if (!conv) return NextResponse.json({ message: 'Conversation not found' }, { status: 404 });
  if (!conv.contact_id) {
    return NextResponse.json(
      { message: 'Vincule um contacto a esta conversa antes de classificar.' },
      { status: 400 }
    );
  }

  const target = await resolveTarget(supabase, orgId, funnel);
  if (!target) {
    return NextResponse.json(
      { message: `Não encontrei o funil "${FUNNEL_LABEL[funnel]}" ou a sua etapa Oportunidade.` },
      { status: 404 }
    );
  }

  const label = FUNNEL_LABEL[funnel];

  // Já existe negócio aberto para o contacto? → mover (sem duplicar).
  const { data: existingDeal } = await supabase
    .from('deals')
    .select('id, board_id, stage_id')
    .eq('contact_id', conv.contact_id)
    .eq('organization_id', orgId)
    .eq('status', 'open')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let dealId: string;
  let created: boolean;

  if (existingDeal) {
    dealId = existingDeal.id;
    created = false;

    if (existingDeal.board_id !== target.boardId || existingDeal.stage_id !== target.stageId) {
      const { error: moveErr } = await supabase
        .from('deals')
        .update({ board_id: target.boardId, stage_id: target.stageId })
        .eq('id', dealId)
        .eq('organization_id', orgId);
      if (moveErr) {
        return NextResponse.json({ message: moveErr.message }, { status: 500 });
      }
    }

    await supabase.from('deal_activities').insert({
      deal_id: dealId,
      organization_id: orgId,
      contact_id: conv.contact_id,
      owner_id: user.id,
      type: 'note',
      actor: 'human',
      description: `Classificado como ${label} a partir da conversa de WhatsApp.`,
      metadata: { source: 'whatsapp', funnel, conversation_id: conversationId },
    });
  } else {
    const title = `${conv.external_contact_name || 'Contacto'} — WhatsApp`;
    const { data: newDeal, error: createErr } = await supabase
      .from('deals')
      .insert({
        organization_id: orgId,
        board_id: target.boardId,
        stage_id: target.stageId,
        status: 'open',
        is_won: false,
        contact_id: conv.contact_id,
        title,
        value: 0,
        owner_id: user.id,
      })
      .select('id')
      .single();

    if (createErr || !newDeal) {
      return NextResponse.json(
        { message: createErr?.message || 'Erro ao criar negócio' },
        { status: 500 }
      );
    }
    dealId = newDeal.id;
    created = true;

    await supabase.from('deal_activities').insert({
      deal_id: dealId,
      organization_id: orgId,
      contact_id: conv.contact_id,
      owner_id: user.id,
      type: 'note',
      actor: 'human',
      description: `Lead criado via WhatsApp e classificado como ${label}.`,
      metadata: { source: 'whatsapp', funnel, conversation_id: conversationId, auto_created: true },
    });
  }

  // Ligar a conversa ao negócio (merge de metadata).
  await supabase
    .from('messaging_conversations')
    .update({
      metadata: {
        ...((conv.metadata as Record<string, unknown>) || {}),
        deal_id: dealId,
        funnel,
      },
    })
    .eq('id', conversationId)
    .eq('organization_id', orgId);

  return NextResponse.json({
    dealId,
    created,
    boardId: target.boardId,
    boardName: target.boardName,
  });
}
