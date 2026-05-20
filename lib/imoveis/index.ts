import 'server-only';
import { createClient } from '@/lib/supabase/server';

export type ImovelTipo =
  | 'apartamento' | 'moradia' | 'terreno' | 'predio'
  | 'loja' | 'armazem' | 'escritorio' | 'garagem' | 'quinta';

export type ImovelEstado = 'disponivel' | 'reservado' | 'vendido' | 'retirado' | 'em_avaliacao';
export type ImovelTipoNegocio = 'venda' | 'arrendamento' | 'ambos' | 'trespasse' | 'permuta';
export type EstadoConservacao = 'novo' | 'como_novo' | 'usado' | 'recuperar' | 'construcao' | 'projecto';

export type ImovelEventoKind =
  | 'visita' | 'oferta' | 'proposta' | 'contraproposta'
  | 'cpcv' | 'escritura' | 'mudanca_preco' | 'fotos_atualizadas'
  | 'retirado' | 'reactivado' | 'avaliacao' | 'nota';

export type DocumentoKind =
  | 'caderneta' | 'certidao_predial' | 'licenca_utilizacao' | 'fth'
  | 'ce' | 'planta' | 'memoria_descritiva' | 'distrato_bancario'
  | 'declaracao_condominio' | 'preferencia' | 'mandato' | 'outro';

export type ProprietarioDocKind =
  | 'cc' | 'bi' | 'nif' | 'comprovativo_morada'
  | 'certidao_casamento' | 'sentenca_divorcio' | 'habilitacao_herdeiros'
  | 'procuracao' | 'declaracao_nao_residencia' | 'outro';

export interface Imovel {
  id: string;
  organization_id: string;
  referencia: string | null;
  tipo: ImovelTipo;
  subtipo: string | null;
  estado: ImovelEstado;
  estado_conservacao: EstadoConservacao | null;
  tipo_negocio: ImovelTipoNegocio;
  morada: string | null;
  numero_policia: string | null;
  codigo_postal: string | null;
  freguesia: string | null;
  concelho: string | null;
  distrito: string | null;
  latitude: number | null;
  longitude: number | null;
  ocultar_morada: boolean;
  tipologia: string | null;
  area_util: number | null;
  area_bruta: number | null;
  area_terreno: number | null;
  area_dependente: number | null;
  quartos: number | null;
  quartos_suite: number | null;
  wcs: number | null;
  piso: number | null;
  pisos_imovel: number | null;
  cozinha_tipo: string | null;
  sala_m2: number | null;
  ano_construcao: number | null;
  ano_remodelacao: number | null;
  certificado_energetico: string | null;
  ce_numero: string | null;
  ce_validade: string | null;
  aquecimento: string | null;
  tem_ac: boolean;
  agua: string | null;
  paineis_solares: string | null;
  caixilharia: string | null;
  vidros_duplos: boolean;
  orientacao: string | null;
  vista: string | null;
  tem_condominio: boolean;
  condominio_mensal: number | null;
  condominio_inclui: string | null;
  imi_anual: number | null;
  preco_actual: number | null;
  preco_inicial: number | null;
  preco_minimo_aceitavel: number | null;
  renda_mensal: number | null;
  titulo_anuncio: string | null;
  descricao_longa: string | null;
  destaques: string[];
  publico_alvo: string[];
  publicado_em: string[];
  ref_idealista: string | null;
  ref_imovirtual: string | null;
  ref_casasapo: string | null;
  ref_kw: string | null;
  caderneta_pdf_url: string | null;
  fotos_urls: string[];
  link_externo: string | null;
  notas_privadas: string | null;
  caracteristicas: Record<string, boolean>;
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

export interface ImovelFoto {
  id: string;
  organization_id: string;
  imovel_id: string;
  storage_path: string;
  url_publica: string | null;
  ordem: number;
  caption: string | null;
  is_principal: boolean;
  width: number | null;
  height: number | null;
  bytes: number | null;
  origem: string;
  uploaded_at: string;
}

export interface ImovelDocumento {
  id: string;
  organization_id: string;
  imovel_id: string;
  kind: DocumentoKind;
  filename: string;
  storage_path: string;
  bytes: number | null;
  mime_type: string | null;
  metadata: Record<string, unknown>;
  uploaded_at: string;
}

/** Lista canónica de características booleanas (chaves de imoveis.caracteristicas jsonb). */
export const CARACTERISTICAS_CATALOG: Array<{ key: string; label: string; group: string }> = [
  { key: 'varanda', label: 'Varanda', group: 'Exterior' },
  { key: 'terraco', label: 'Terraço', group: 'Exterior' },
  { key: 'marquise', label: 'Marquise', group: 'Exterior' },
  { key: 'jardim', label: 'Jardim', group: 'Exterior' },
  { key: 'quintal', label: 'Quintal', group: 'Exterior' },
  { key: 'piscina', label: 'Piscina', group: 'Exterior' },
  { key: 'piscina_interior', label: 'Piscina interior', group: 'Exterior' },
  { key: 'piscina_aquecida', label: 'Piscina aquecida', group: 'Exterior' },
  { key: 'garagem', label: 'Garagem', group: 'Estacionamento' },
  { key: 'parking_exterior', label: 'Aparcamento exterior', group: 'Estacionamento' },
  { key: 'arrecadacao', label: 'Arrecadação', group: 'Estacionamento' },
  { key: 'sotao', label: 'Sótão', group: 'Espaços' },
  { key: 'cave', label: 'Cave', group: 'Espaços' },
  { key: 'elevador', label: 'Elevador', group: 'Espaços' },
  { key: 'lareira', label: 'Lareira', group: 'Conforto' },
  { key: 'roupeiros_embutidos', label: 'Roupeiros embutidos', group: 'Conforto' },
  { key: 'portas_blindadas', label: 'Portas blindadas', group: 'Segurança' },
  { key: 'alarme', label: 'Alarme', group: 'Segurança' },
  { key: 'videovigilancia', label: 'Vídeo-vigilância', group: 'Segurança' },
  { key: 'domotica', label: 'Domótica', group: 'Tecnologia' },
  { key: 'aspiracao_central', label: 'Aspiração central', group: 'Tecnologia' },
  { key: 'fibra', label: 'Internet fibra', group: 'Tecnologia' },
  { key: 'sistema_rega', label: 'Sistema de rega', group: 'Tecnologia' },
  { key: 'ginasio', label: 'Ginásio privativo', group: 'Lazer' },
  { key: 'sala_cinema', label: 'Sala de cinema', group: 'Lazer' },
  { key: 'mobilado', label: 'Mobilado', group: 'Estado' },
  { key: 'equipado', label: 'Equipado', group: 'Estado' },
  { key: 'acessivel_mobilidade', label: 'Acessível mobilidade reduzida', group: 'Estado' },
];

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
  return (data ?? []) as ImovelFoto[];
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
  disponivel: 'Disponível', reservado: 'Reservado', vendido: 'Vendido',
  retirado: 'Retirado', em_avaliacao: 'Em avaliação',
};
export function estadoLabel(estado: ImovelEstado): string {
  return ESTADO_LABEL[estado] ?? estado;
}

const TIPO_LABEL: Record<ImovelTipo, string> = {
  apartamento: 'Apartamento', moradia: 'Moradia', terreno: 'Terreno',
  predio: 'Prédio', loja: 'Loja', armazem: 'Armazém',
  escritorio: 'Escritório', garagem: 'Garagem', quinta: 'Quinta',
};
export function tipoLabel(tipo: ImovelTipo): string {
  return TIPO_LABEL[tipo] ?? tipo;
}

const EVENTO_LABEL: Record<ImovelEventoKind, string> = {
  visita: 'Visita', oferta: 'Oferta', proposta: 'Proposta',
  contraproposta: 'Contraproposta', cpcv: 'CPCV', escritura: 'Escritura',
  mudanca_preco: 'Mudança de preço', fotos_atualizadas: 'Fotos actualizadas',
  retirado: 'Retirado', reactivado: 'Reactivado', avaliacao: 'Avaliação', nota: 'Nota',
};
export function eventoLabel(kind: ImovelEventoKind): string {
  return EVENTO_LABEL[kind] ?? kind;
}

const DOC_LABEL: Record<DocumentoKind, string> = {
  caderneta: 'Caderneta predial',
  certidao_predial: 'Certidão registo predial',
  licenca_utilizacao: 'Licença de utilização',
  fth: 'Ficha técnica de habitação',
  ce: 'Certificado energético',
  planta: 'Planta',
  memoria_descritiva: 'Memória descritiva',
  distrato_bancario: 'Distrato bancário',
  declaracao_condominio: 'Declaração não dívida condomínio',
  preferencia: 'Direito de preferência',
  mandato: 'Mandato',
  outro: 'Outro',
};
export function documentoLabel(kind: DocumentoKind): string {
  return DOC_LABEL[kind] ?? kind;
}
