import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Imovel, ImovelEvento, ImovelFoto, ImovelDocumento, ImovelProprietario, ImovelMandato, ImovelCmi, ImovelAcompanhamento, ImovelFinanceiro, ProprietarioDocumento } from './shared';

export * from './shared';

export async function listImoveis(): Promise<Imovel[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('imoveis')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as unknown as Imovel[];
}

export async function getImovelById(id: string): Promise<Imovel | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('imoveis')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as Imovel | null;
}

export async function listEventosByImovelId(imovelId: string): Promise<ImovelEvento[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('imovel_eventos')
    .select('*')
    .eq('imovel_id', imovelId)
    .order('occurred_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ImovelEvento[];
}

export async function listFotosByImovelId(imovelId: string): Promise<ImovelFoto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('imovel_fotos')
    .select('*')
    .eq('imovel_id', imovelId)
    .order('ordem', { ascending: true });
  if (error) throw error;
  const fotos = (data ?? []) as ImovelFoto[];

  // Bucket imovel-fotos é privado (AUD-C2) → gerar URL assinado a partir do storage_path.
  const paths = fotos.map((f) => f.storage_path).filter(Boolean) as string[];
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from('imovel-fotos')
      .createSignedUrls(paths, 60 * 60); // 1 hora; a página re-assina a cada carregamento
    const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
    for (const f of fotos) {
      f.url_publica = (f.storage_path && byPath.get(f.storage_path)) || null;
    }
  }
  return fotos;
}

export async function listDocumentosByImovelId(imovelId: string): Promise<ImovelDocumento[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('imovel_documentos')
    .select('*')
    .eq('imovel_id', imovelId)
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ImovelDocumento[];
}

export interface DealLite {
  id: string;
  title: string | null;
  status: string | null;
  value: number | null;
}

export async function listProprietariosByImovelId(imovelId: string): Promise<ImovelProprietario[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('imovel_proprietarios')
    .select('*')
    .eq('imovel_id', imovelId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ImovelProprietario[];
}

export async function listMandatosByImovelId(imovelId: string): Promise<ImovelMandato[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('imovel_mandatos')
    .select('*')
    .eq('imovel_id', imovelId)
    .order('data_inicio', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ImovelMandato[];
}

export async function listCmisByImovelId(imovelId: string): Promise<ImovelCmi[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('imovel_cmi')
    .select('*')
    .eq('imovel_id', imovelId)
    .order('data_cmi', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ImovelCmi[];
}

export async function getImovelAcompanhamento(imovelId: string): Promise<ImovelAcompanhamento> {
  const supabase = await createClient();
  const [dealsRes, visitasRes, propostasRes, ultimaVisitaRes] = await Promise.all([
    supabase.from('deals').select('id', { count: 'exact', head: true }).eq('imovel_id', imovelId),
    supabase.from('imovel_eventos').select('id', { count: 'exact', head: true }).eq('imovel_id', imovelId).eq('kind', 'visita'),
    supabase.from('imovel_eventos').select('id', { count: 'exact', head: true }).eq('imovel_id', imovelId).in('kind', ['proposta', 'oferta', 'contraproposta']),
    supabase.from('imovel_eventos').select('occurred_at').eq('imovel_id', imovelId).eq('kind', 'visita').order('occurred_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  let diasSemVisita: number | null = null;
  if (ultimaVisitaRes.data?.occurred_at) {
    const last = new Date(ultimaVisitaRes.data.occurred_at).getTime();
    diasSemVisita = Math.max(0, Math.floor((Date.now() - last) / 86_400_000));
  }
  return {
    leads: dealsRes.count ?? 0,
    visitas: visitasRes.count ?? 0,
    propostas: propostasRes.count ?? 0,
    diasSemVisita,
  };
}

// NS-3 — Custo & ROI por imóvel. Receita = comissão líquida dos negócios ganhos
// ligados (mesmo cálculo do /financeiro). Custo = despesas ligadas + visitas
// estimadas (nº visitas × custo/visita configurável na org). Tudo em cêntimos.
export async function getImovelFinanceiro(imovelId: string): Promise<ImovelFinanceiro> {
  const supabase = await createClient();
  const numOf = (v: unknown): number => {
    const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN;
    return Number.isFinite(n) ? n : 0;
  };

  const { data: settings } = await supabase
    .from('organization_settings')
    .select('default_commission_pct, default_consultant_share_pct, default_visit_cost_cents')
    .maybeSingle();
  const defPct = numOf(settings?.default_commission_pct) || 5;
  const defShare = numOf(settings?.default_consultant_share_pct) || 50;
  const visitCost = Math.max(0, Math.round(numOf(settings?.default_visit_cost_cents)));

  const { data: wonDeals } = await supabase
    .from('deals')
    .select('value, custom_fields')
    .eq('imovel_id', imovelId)
    .eq('is_won', true)
    .is('deleted_at', null);
  let receitaCents = 0;
  let wonCount = 0;
  for (const d of wonDeals ?? []) {
    const cf = ((d as { custom_fields: Record<string, unknown> | null }).custom_fields) ?? {};
    const value = numOf((d as { value: unknown }).value);
    const mode = (cf['commission_mode'] as string) || 'pct';
    const fixed = cf['commission_amount'] != null ? numOf(cf['commission_amount']) : null;
    const pct = cf['commission_pct'] != null ? numOf(cf['commission_pct']) : defPct;
    const gross = mode === 'fixed' && fixed != null ? fixed : value * (pct / 100);
    const share = cf['consultant_share_pct'] != null ? numOf(cf['consultant_share_pct']) : defShare;
    receitaCents += Math.round(gross * (share / 100) * 100);
    wonCount += 1;
  }

  const { data: exps } = await supabase
    .from('expenses')
    .select('amount_cents, category')
    .eq('imovel_id', imovelId)
    .is('deleted_at', null);
  let despesasCents = 0;
  const byCat: Record<string, number> = {};
  for (const e of exps ?? []) {
    const c = Math.round(numOf((e as { amount_cents: unknown }).amount_cents));
    despesasCents += c;
    const cat = ((e as { category: string | null }).category) || 'Outros';
    byCat[cat] = (byCat[cat] ?? 0) + c;
  }
  const despesas_por_categoria = Object.entries(byCat)
    .map(([categoria, cents]) => ({ categoria, cents }))
    .sort((a, b) => b.cents - a.cents);

  const { count: visitasCount } = await supabase
    .from('imovel_eventos')
    .select('id', { count: 'exact', head: true })
    .eq('imovel_id', imovelId)
    .eq('kind', 'visita');
  const visitas = visitasCount ?? 0;
  const visitasCents = visitas * visitCost;

  const custoTotal = despesasCents + visitasCents;
  const lucro = receitaCents - custoTotal;
  const roi = custoTotal > 0 ? receitaCents / custoTotal : null;

  return {
    receita_cents: receitaCents,
    won_count: wonCount,
    despesas_cents: despesasCents,
    despesas_por_categoria,
    visitas,
    visita_custo_cents: visitCost,
    visitas_cents: visitasCents,
    custo_total_cents: custoTotal,
    lucro_cents: lucro,
    roi,
  };
}

export async function listProprietarioDocs(propId: string): Promise<ProprietarioDocumento[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('proprietario_documentos')
    .select('*')
    .eq('proprietario_id', propId)
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProprietarioDocumento[];
}

export async function listProprietarioDocsByImovel(imovelId: string): Promise<Record<string, ProprietarioDocumento[]>> {
  const supabase = await createClient();
  const { data: props } = await supabase
    .from('imovel_proprietarios').select('id').eq('imovel_id', imovelId);
  if (!props || props.length === 0) return {};
  const ids = props.map((p) => p.id);
  const { data, error } = await supabase
    .from('proprietario_documentos')
    .select('*')
    .in('proprietario_id', ids)
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  const grouped: Record<string, ProprietarioDocumento[]> = {};
  for (const d of (data ?? []) as ProprietarioDocumento[]) {
    if (!grouped[d.proprietario_id]) grouped[d.proprietario_id] = [];
    grouped[d.proprietario_id].push(d);
  }
  return grouped;
}

export async function listDealsByImovelId(imovelId: string): Promise<DealLite[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('deals')
    .select('id, title, status, value')
    .eq('imovel_id', imovelId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as DealLite[];
}
