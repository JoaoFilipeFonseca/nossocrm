import 'server-only';
import { createClient } from '@/lib/supabase/server';

export type ImovelEstado = 'disponivel' | 'reservado' | 'vendido' | 'retirado' | 'em_avaliacao';
export type ImovelTipoNegocio = 'venda' | 'arrendamento' | 'ambos';
export type ImovelEventoKind =
  | 'visita' | 'oferta' | 'proposta' | 'contraproposta'
  | 'cpcv' | 'escritura' | 'mudanca_preco' | 'fotos_atualizadas'
  | 'retirado' | 'reactivado' | 'avaliacao' | 'nota';

export interface Imovel {
  id: string;
  organization_id: string;
  referencia: string | null;
  morada: string | null;
  freguesia: string | null;
  concelho: string | null;
  distrito: string | null;
  tipologia: string | null;
  area_util: number | null;
  area_bruta: number | null;
  ano_construcao: number | null;
  certificado_energetico: string | null;
  preco_actual: number | null;
  preco_inicial: number | null;
  preco_minimo_aceitavel: number | null;
  estado: ImovelEstado;
  tipo_negocio: ImovelTipoNegocio;
  caderneta_pdf_url: string | null;
  fotos_urls: string[];
  link_externo: string | null;
  notas_privadas: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImovelEvento {
  id: string;
  organization_id: string;
  imovel_id: string;
  kind: ImovelEventoKind;
  contact_id: string | null;
  deal_id: string | null;
  valor: number | null;
  descricao: string | null;
  metadata: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
}

export async function listImoveis(): Promise<Imovel[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('imoveis')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as Imovel[];
}

export async function getImovelById(id: string): Promise<Imovel | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('imoveis')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as Imovel | null;
}

export interface DealLite {
  id: string;
  title: string | null;
  status: string | null;
  value: number | null;
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

export function formatPrecoEur(v: number | null | undefined): string {
  if (v == null) return '—';
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}

export function estadoChipClass(estado: ImovelEstado): string {
  const base = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium';
  switch (estado) {
    case 'disponivel': return `${base} bg-green-100 text-green-700`;
    case 'reservado': return `${base} bg-amber-100 text-amber-700`;
    case 'vendido': return `${base} bg-blue-100 text-blue-700`;
    case 'retirado': return `${base} bg-slate-100 text-slate-600`;
    case 'em_avaliacao': return `${base} bg-purple-100 text-purple-700`;
    default: return `${base} bg-slate-100 text-slate-600`;
  }
}

const ESTADO_LABEL: Record<ImovelEstado, string> = {
  disponivel: 'Disponível',
  reservado: 'Reservado',
  vendido: 'Vendido',
  retirado: 'Retirado',
  em_avaliacao: 'Em avaliação',
};
export function estadoLabel(estado: ImovelEstado): string {
  return ESTADO_LABEL[estado] ?? estado;
}

const EVENTO_LABEL: Record<ImovelEventoKind, string> = {
  visita: 'Visita',
  oferta: 'Oferta',
  proposta: 'Proposta',
  contraproposta: 'Contraproposta',
  cpcv: 'CPCV',
  escritura: 'Escritura',
  mudanca_preco: 'Mudança de preço',
  fotos_atualizadas: 'Fotos actualizadas',
  retirado: 'Retirado',
  reactivado: 'Reactivado',
  avaliacao: 'Avaliação',
  nota: 'Nota',
};
export function eventoLabel(kind: ImovelEventoKind): string {
  return EVENTO_LABEL[kind] ?? kind;
}
