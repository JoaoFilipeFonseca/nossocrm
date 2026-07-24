// /api/painel — Painel Diário do João Fonseca.
// Um único agregador org-scoped (via RLS) que devolve o snapshot completo:
// funis Vendedores/Compradores, KPIs, receita por linha, pipeline por etapa com
// valor previsto, o coração (tarefas + chamadas de hoje), carteira de imóveis e
// top canais. Lido na hora; o cliente refaz a cada 60s e em tempo real.
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getEstadoDef } from '@/lib/imoveis/shared';
import {
  boardDisplayName,
  canalBucket,
  stageColorHex,
  windowDays,
  type CanalRanking,
  type CarteiraImovel,
  type PainelFunnel,
  type PainelMetas,
  type PainelSnapshot,
  type PainelWindow,
  type PipelineEtapa,
  type ReceitaLinha,
} from '@/lib/painel/shared';

// Estados de imóvel que contam como carteira activa (fora do mercado saem sozinhos).
const CARTEIRA_ESTADOS = ['em_avaliacao', 'disponivel', 'reservado', 'cpcv'];
// Resultados de chamada que contam como conversa real (falou mesmo).
const CONVERSA_RESULTS = ['answered', 'returned', 'rescheduled'];

type CF = Record<string, unknown> | null;
const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Comissão líquida (cêntimos) de um negócio, com a mesma regra do /financeiro. */
function commissionCents(value: number, cf: CF, defPct: number, defShare: number): number {
  const c = cf ?? {};
  const mode = (c['commission_mode'] as string) || 'pct';
  const fixed = num(c['commission_amount']);
  const pct = num(c['commission_pct']) ?? defPct;
  const gross = mode === 'fixed' && fixed != null ? fixed : value * (pct / 100);
  const share = num(c['consultant_share_pct']) ?? defShare;
  return Math.round(gross * (share / 100) * 100);
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  const orgId = profile?.organization_id as string | undefined;
  if (!orgId) return NextResponse.json({ message: 'Profile not found' }, { status: 404 });

  const url = new URL(request.url);
  const wParam = url.searchParams.get('window');
  const win: PainelWindow = wParam === '30d' || wParam === '365d' ? wParam : '90d';
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowDays(win) * 86_400_000);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  // Âncoras para as metas: início do ano, do mês e da semana (segunda-feira).
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekStart = new Date(todayStart.getTime() - (((now.getDay() + 6) % 7) * 86_400_000));

  // ── Comissão por defeito da org ──────────────────────────────────────────
  const { data: settings } = await supabase
    .from('organization_settings')
    .select('default_commission_pct, default_consultant_share_pct')
    .eq('organization_id', orgId)
    .maybeSingle();
  const defPct = num(settings?.default_commission_pct) ?? 5;
  const defShare = num(settings?.default_consultant_share_pct) ?? 50;

  // ── Boards + etapas ──────────────────────────────────────────────────────
  const [{ data: boards }, { data: stages }] = await Promise.all([
    supabase.from('boards').select('id, name, key').eq('organization_id', orgId),
    supabase
      .from('board_stages')
      .select('id, board_id, label, color, order')
      .eq('organization_id', orgId)
      .order('order', { ascending: true }),
  ]);
  const boardByKey = new Map((boards ?? []).map((b) => [b.key as string, b]));
  const boardById = new Map((boards ?? []).map((b) => [b.id as string, b]));
  const stagesByBoard = new Map<string, { id: string; label: string; color: string }[]>();
  // Etapas "base" (Contactos) — a base por trabalhar, não conta como pipeline a sério.
  const baseStageIds = new Set<string>();
  for (const s of stages ?? []) {
    const list = stagesByBoard.get(s.board_id as string) ?? [];
    list.push({ id: s.id as string, label: s.label as string, color: s.color as string });
    stagesByBoard.set(s.board_id as string, list);
    if (String(s.label).trim().toLowerCase() === 'contactos') baseStageIds.add(s.id as string);
  }

  // ── Negócios (activos + ganhos) ──────────────────────────────────────────
  const { data: deals } = await supabase
    .from('deals')
    .select('id, board_id, stage_id, value, is_won, is_lost, closed_at, created_at, custom_fields, contact_id')
    .eq('organization_id', orgId)
    .is('deleted_at', null);
  const dealsList = deals ?? [];

  // Origens dos contactos (para top canais).
  const contactIds = Array.from(
    new Set(dealsList.map((d) => d.contact_id as string | null).filter(Boolean) as string[]),
  );
  const sourceByContact = new Map<string, string | null>();
  if (contactIds.length > 0) {
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, source')
      .in('id', contactIds);
    for (const c of contacts ?? []) sourceByContact.set(c.id as string, (c.source as string | null) ?? null);
  }

  // Acumuladores por etapa (abertos) e comissões.
  const openCountByStage = new Map<string, number>();
  const openValueByStage = new Map<string, number>();
  let pipelinePrevistoCents = 0; // só o que está a trabalhar (exclui Contactos)
  let negociosAbertos = 0;
  let abertosTrabalho = 0;
  let basePorActivar = 0;
  let abertosVendedores = 0;
  let abertosCompradores = 0;
  let faturacaoCents = 0;
  let fechados = 0;
  let fechadosVendedores = 0;
  let fechadosCompradores = 0;
  let faturacaoAnoCents = 0; // comissão ganha no ano (meta anual)
  let escriturasMes = 0; // compradores ganhos este mês
  const wonInWindowByBoard = new Map<string, number>(); // boardId → contagem
  const receitaByBoard = new Map<string, number>(); // boardId → comissão ganha na janela
  const propKey = boardByKey.get('proprietarios')?.id as string | undefined;
  const compKey = boardByKey.get('compradores')?.id as string | undefined;

  // Top canais por funil.
  const canaisVend = new Map<string, number>();
  const canaisComp = new Map<string, number>();

  for (const d of dealsList) {
    const boardId = d.board_id as string;
    const value = num(d.value) ?? 0;
    const cf = d.custom_fields as CF;
    const commission = commissionCents(value, cf, defPct, defShare);
    const isClosed = (d.is_won as boolean) || (d.is_lost as boolean);

    if (d.is_won) {
      const when = (d.closed_at as string | null) ?? (d.created_at as string | null);
      const whenDate = when ? new Date(when) : null;
      if (whenDate && whenDate >= yearStart) faturacaoAnoCents += commission;
      if (whenDate && whenDate >= monthStart && boardId === compKey) escriturasMes += 1;
      const closedInWindow = when ? new Date(when) >= windowStart : false;
      if (closedInWindow) {
        faturacaoCents += commission;
        fechados += 1;
        wonInWindowByBoard.set(boardId, (wonInWindowByBoard.get(boardId) ?? 0) + 1);
        receitaByBoard.set(boardId, (receitaByBoard.get(boardId) ?? 0) + commission);
        if (boardId === propKey) fechadosVendedores += 1;
        if (boardId === compKey) fechadosCompradores += 1;
      }
    }

    if (!isClosed) {
      const stageId = d.stage_id as string;
      openCountByStage.set(stageId, (openCountByStage.get(stageId) ?? 0) + 1);
      openValueByStage.set(stageId, (openValueByStage.get(stageId) ?? 0) + commission);
      negociosAbertos += 1;
      const isBase = baseStageIds.has(stageId);
      if (isBase) {
        basePorActivar += 1;
      } else {
        pipelinePrevistoCents += commission; // só o que está a trabalhar
        abertosTrabalho += 1;
      }
      if (boardId === propKey) abertosVendedores += 1;
      if (boardId === compKey) abertosCompradores += 1;
    }

    // Top canais: negócios entrados na janela, por funil.
    const created = d.created_at ? new Date(d.created_at as string) : null;
    if (created && created >= windowStart) {
      const bucket = canalBucket(sourceByContact.get(d.contact_id as string) ?? null);
      if (boardId === propKey) canaisVend.set(bucket, (canaisVend.get(bucket) ?? 0) + 1);
      else if (boardId === compKey) canaisComp.set(bucket, (canaisComp.get(bucket) ?? 0) + 1);
    }
  }

  // ── Funis (Vendedores + Compradores) ─────────────────────────────────────
  const funnelKeys = ['proprietarios', 'compradores'];
  const funnels: PainelFunnel[] = [];
  const pipelinePorEtapa: PipelineEtapa[] = [];
  for (const key of funnelKeys) {
    const board = boardByKey.get(key);
    if (!board) continue;
    const boardId = board.id as string;
    const displayName = boardDisplayName(key, board.name as string);
    const stageDefs = stagesByBoard.get(boardId) ?? [];
    const funnelStages = stageDefs.map((s) => {
      const count = openCountByStage.get(s.id) ?? 0;
      const valueCents = openValueByStage.get(s.id) ?? 0;
      if (count > 0) {
        pipelinePorEtapa.push({ funnelKey: key, funnelName: displayName, label: s.label, count, valueCents });
      }
      return { label: s.label, color: stageColorHex(s.color), count, valueCents };
    });
    funnels.push({
      boardId,
      key,
      displayName,
      stages: funnelStages,
      wonCount: wonInWindowByBoard.get(boardId) ?? 0,
    });
  }

  // ── Receita por linha (Vendedores, Compradores, Arrendamento, Créditos) ──
  const linhaDefs: { key: string; label: string; boardKey: string }[] = [
    { key: 'vendedores', label: 'Vendedores', boardKey: 'proprietarios' },
    { key: 'compradores', label: 'Compradores', boardKey: 'compradores' },
    { key: 'arrendamento', label: 'Arrendamento', boardKey: 'arrendamento' },
    { key: 'creditos', label: 'Créditos', boardKey: 'creditos' },
  ];
  const receitaLinhas: ReceitaLinha[] = linhaDefs.map((l) => {
    const b = boardByKey.get(l.boardKey);
    const cents = b ? receitaByBoard.get(b.id as string) ?? 0 : 0;
    return { key: l.key, label: l.label, cents };
  });

  // ── Coração: tarefas (activities) ────────────────────────────────────────
  const { data: activities } = await supabase
    .from('activities')
    .select('date, completed')
    .eq('organization_id', orgId);
  let tarefasPendentes = 0;
  let tarefasHoje = 0;
  let tarefasAtrasadas = 0;
  let tarefasFeitasHoje = 0;
  const todayISO = todayStart.toISOString().slice(0, 10);
  for (const a of activities ?? []) {
    const dISO = (a.date as string | null)?.slice(0, 10);
    const completed = a.completed as boolean;
    const isToday = dISO === todayISO;
    if (!completed) {
      tarefasPendentes += 1;
      if (isToday) tarefasHoje += 1;
      else if (dISO && dISO < todayISO) tarefasAtrasadas += 1;
    } else if (isToday) {
      tarefasFeitasHoje += 1;
    }
  }

  // ── Coração: chamadas de hoje (deal_activities) ──────────────────────────
  const { data: calls } = await supabase
    .from('deal_activities')
    .select('metadata')
    .eq('organization_id', orgId)
    .eq('type', 'call')
    .gte('created_at', todayStart.toISOString());
  let realizadasHoje = 0;
  let totalChamadas = 0;
  for (const c of calls ?? []) {
    totalChamadas += 1;
    const result = (c.metadata as Record<string, unknown> | null)?.['result'] as string | undefined;
    if (result && CONVERSA_RESULTS.includes(result)) realizadasHoje += 1;
  }
  const tentativasHoje = totalChamadas - realizadasHoje;

  // ── Agenda accionável do dia: tarefas atrasadas + de hoje, por fazer ───────
  const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);
  const { data: agendaRows } = await supabase
    .from('activities')
    .select('id, title, type, date, deal_id, contact_id')
    .eq('organization_id', orgId)
    .eq('completed', false)
    .is('deleted_at', null)
    .lt('date', tomorrowStart.toISOString())
    .order('date', { ascending: true })
    .limit(30);
  const agendaList = agendaRows ?? [];

  // Deals e contactos das tarefas (para título do negócio + telefone p/ ligar).
  const agDealIds = Array.from(new Set(agendaList.map((a) => a.deal_id as string | null).filter(Boolean) as string[]));
  const dealById = new Map<string, { title: string; contact_id: string | null }>();
  if (agDealIds.length > 0) {
    const { data: agDeals } = await supabase.from('deals').select('id, title, contact_id').in('id', agDealIds);
    for (const d of agDeals ?? [])
      dealById.set(d.id as string, { title: d.title as string, contact_id: (d.contact_id as string | null) ?? null });
  }
  const agContactIds = Array.from(
    new Set(
      agendaList
        .flatMap((a) => [a.contact_id as string | null, dealById.get(a.deal_id as string)?.contact_id ?? null])
        .filter(Boolean) as string[],
    ),
  );
  const contactById = new Map<string, { name: string; phone: string | null }>();
  if (agContactIds.length > 0) {
    const { data: agContacts } = await supabase.from('contacts').select('id, name, phone').in('id', agContactIds);
    for (const c of agContacts ?? [])
      contactById.set(c.id as string, { name: c.name as string, phone: (c.phone as string | null) ?? null });
  }

  const agendaHoje = agendaList.map((a) => {
    const dealId = (a.deal_id as string | null) ?? null;
    const deal = dealId ? dealById.get(dealId) : undefined;
    const contactId = (a.contact_id as string | null) ?? deal?.contact_id ?? null;
    const contact = contactId ? contactById.get(contactId) : undefined;
    const dISO = (a.date as string).slice(0, 10);
    return {
      id: a.id as string,
      titulo: (a.title as string) || 'Tarefa',
      tipo: (a.type as string) || 'TASK',
      quando: a.date as string,
      atrasada: dISO < todayISO,
      dealId,
      dealTitulo: deal?.title ?? null,
      contactoNome: contact?.name ?? null,
      telefone: contact?.phone ?? null,
    };
  });

  // ── Carteira de imóveis ──────────────────────────────────────────────────
  const { data: imoveis } = await supabase
    .from('imoveis')
    .select('id, referencia, morada, tipologia, concelho, estado, created_at')
    .eq('organization_id', orgId)
    .in('estado', CARTEIRA_ESTADOS)
    .order('created_at', { ascending: false })
    .limit(30);
  const imovelIds = (imoveis ?? []).map((i) => i.id as string);
  const visitasByImovel = new Map<string, number>();
  const propostasByImovel = new Map<string, number>();
  let visitasSemana = 0;
  if (imovelIds.length > 0) {
    const { data: eventos } = await supabase
      .from('imovel_eventos')
      .select('imovel_id, kind, occurred_at')
      .in('imovel_id', imovelIds);
    for (const e of eventos ?? []) {
      const iid = e.imovel_id as string;
      const kind = e.kind as string;
      if (kind === 'visita') {
        visitasByImovel.set(iid, (visitasByImovel.get(iid) ?? 0) + 1);
        if (e.occurred_at && new Date(e.occurred_at as string) >= weekAgo) visitasSemana += 1;
      } else if (kind === 'proposta' || kind === 'oferta' || kind === 'contraproposta') {
        propostasByImovel.set(iid, (propostasByImovel.get(iid) ?? 0) + 1);
      }
    }
  }
  const carteiraImoveis: CarteiraImovel[] = (imoveis ?? []).map((i) => {
    const created = i.created_at ? new Date(i.created_at as string) : now;
    const dias = Math.max(0, Math.floor((now.getTime() - created.getTime()) / 86_400_000));
    const titulo =
      (i.tipologia ? `${i.tipologia} · ` : '') +
      (i.morada || i.concelho || (i.referencia as string) || 'Imóvel');
    return {
      id: i.id as string,
      titulo,
      estado: i.estado as string,
      estadoLabel: getEstadoDef(i.estado as string).label,
      diasNoMercado: dias,
      visitas: visitasByImovel.get(i.id as string) ?? 0,
      propostas: propostasByImovel.get(i.id as string) ?? 0,
    };
  });

  // ── Metas: fonte única (org_revenue_goals do ano) + conversas da semana ──────
  const { data: goalRow } = await supabase
    .from('org_revenue_goals')
    .select('annual_target_eur, weekly_conversas, escrituras_mes, carteira_min')
    .eq('organization_id', orgId)
    .eq('year', now.getFullYear())
    .maybeSingle();
  const goal = (goalRow ?? {}) as {
    annual_target_eur?: number;
    weekly_conversas?: number;
    escrituras_mes?: number;
    carteira_min?: number;
  };
  const { data: weekTouches } = await supabase
    .from('deal_activities')
    .select('metadata')
    .eq('organization_id', orgId)
    .gte('created_at', weekStart.toISOString());
  let conversasSemana = 0;
  for (const c of weekTouches ?? []) {
    const result = (c.metadata as Record<string, unknown> | null)?.['result'] as string | undefined;
    if (result && CONVERSA_RESULTS.includes(result)) conversasSemana += 1;
  }
  const metas: PainelMetas = {
    faturacaoAnoCents,
    faturacaoAnoAlvoCents: Math.round((Number(goal.annual_target_eur) || 0) * 100),
    conversasSemana,
    conversasSemanaAlvo: Number(goal.weekly_conversas) || 25,
    escriturasMes,
    escriturasMesAlvo: Number(goal.escrituras_mes) || 1,
    carteiraActivos: carteiraImoveis.length,
    carteiraAlvo: Number(goal.carteira_min) || 5,
  };

  const rank = (m: Map<string, number>): CanalRanking[] =>
    Array.from(m.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  const canaisVendArr = rank(canaisVend);
  const canaisCompArr = rank(canaisComp);

  const snapshot: PainelSnapshot = {
    window: win,
    generatedAt: now.toISOString(),
    funnels,
    kpis: {
      faturacaoCents,
      pipelinePrevistoCents,
      negociosAbertos,
      abertosTrabalho,
      basePorActivar,
      abertosVendedores,
      abertosCompradores,
      fechados,
      fechadosVendedores,
      fechadosCompradores,
    },
    receitaLinhas,
    pipelinePorEtapa,
    coracao: {
      tarefasPendentes,
      tarefasHoje,
      tarefasAtrasadas,
      tarefasFeitasHoje,
      tentativasHoje,
      realizadasHoje,
    },
    agendaHoje,
    metas,
    carteira: {
      activos: carteiraImoveis.length,
      imoveis: carteiraImoveis,
      visitasSemana,
    },
    topCanais: {
      vendedores: canaisVendArr,
      compradores: canaisCompArr,
      totalVendedores: canaisVendArr.reduce((a, c) => a + c.count, 0),
      totalCompradores: canaisCompArr.reduce((a, c) => a + c.count, 0),
    },
  };

  return NextResponse.json(snapshot);
}
