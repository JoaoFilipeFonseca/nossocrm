// Tipos e constantes partilhados entre server e client.
// NÃO importar 'server-only' aqui — este ficheiro é seguro em client components.

export type ImovelTipo =
  | 'apartamento' | 'moradia' | 'terreno' | 'predio'
  | 'loja' | 'armazem' | 'escritorio' | 'garagem' | 'quinta';

export type ImovelEstado = 'em_avaliacao' | 'disponivel' | 'reservado' | 'cpcv' | 'vendido' | 'suspenso' | 'anulado' | 'retirado';

export interface EstadoDef {
  value: ImovelEstado;
  label: string;
  chipClass: string;
  pillSelected: string;
  pillIdle: string;
  ordem: number;
  descricao: string;
}

// Catálogo canónico — usado em selector, badges, validações, Telegram.
export const ESTADOS_IMOVEL: EstadoDef[] = [
  { value: 'em_avaliacao', label: 'Em avaliação', ordem: 1,
    chipClass: 'bg-amber-100 text-amber-700',
    pillSelected: 'bg-amber-500 text-white border-amber-500',
    pillIdle: 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50',
    descricao: 'Captado, ainda não listado' },
  { value: 'disponivel', label: 'Disponível', ordem: 2,
    chipClass: 'bg-green-100 text-green-700',
    pillSelected: 'bg-green-600 text-white border-green-600',
    pillIdle: 'bg-white text-green-700 border-green-200 hover:bg-green-50',
    descricao: 'À venda, promoção activa' },
  { value: 'reservado', label: 'Reservado', ordem: 3,
    chipClass: 'bg-yellow-100 text-yellow-800',
    pillSelected: 'bg-yellow-500 text-white border-yellow-500',
    pillIdle: 'bg-white text-yellow-800 border-yellow-200 hover:bg-yellow-50',
    descricao: 'Cliente fez sinal, antes de CPCV' },
  { value: 'cpcv', label: 'CPCV', ordem: 4,
    chipClass: 'bg-blue-100 text-blue-700',
    pillSelected: 'bg-blue-600 text-white border-blue-600',
    pillIdle: 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50',
    descricao: 'Promessa firmada, antes de escritura' },
  { value: 'vendido', label: 'Vendido', ordem: 5,
    chipClass: 'bg-slate-700 text-white',
    pillSelected: 'bg-slate-800 text-white border-slate-800',
    pillIdle: 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100',
    descricao: 'Escritura realizada' },
  { value: 'suspenso', label: 'Suspenso', ordem: 6,
    chipClass: 'bg-slate-100 text-slate-500',
    pillSelected: 'bg-slate-400 text-white border-slate-400',
    pillIdle: 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50',
    descricao: 'Temporariamente fora do mercado' },
  { value: 'anulado', label: 'Anulado', ordem: 7,
    chipClass: 'bg-red-100 text-red-700',
    pillSelected: 'bg-red-600 text-white border-red-600',
    pillIdle: 'bg-white text-red-700 border-red-200 hover:bg-red-50',
    descricao: 'Negócio caído' },
  { value: 'retirado', label: 'Retirado', ordem: 8,
    chipClass: 'bg-slate-200 text-slate-700',
    pillSelected: 'bg-slate-600 text-white border-slate-600',
    pillIdle: 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50',
    descricao: 'Proprietário tirou do mercado' },
];

export const ESTADOS_IMOVEL_VALUES = ESTADOS_IMOVEL.map((e) => e.value);

export function getEstadoDef(estado: string | null | undefined): EstadoDef {
  return ESTADOS_IMOVEL.find((e) => e.value === estado) ?? ESTADOS_IMOVEL[0];
}
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

export interface ImovelProprietario {
  id: string;
  organization_id: string;
  imovel_id: string;
  contact_id: string | null;
  nome: string | null;
  percentagem: number | null;
  regime_bens: string | null;
  e_residente: boolean;
  notas: string | null;
  created_at: string;
}

export interface ImovelMandato {
  id: string;
  organization_id: string;
  imovel_id: string;
  tipo: 'simples' | 'exclusivo' | 'misto';
  data_inicio: string;
  data_fim: string | null;
  comissao_pct: number | null;
  comissao_paga_por: string | null;
  documento_id: string | null;
  notas: string | null;
  activo: boolean;
  created_at: string;
}

export interface ProprietarioDocumento {
  id: string;
  organization_id: string;
  proprietario_id: string;
  kind: ProprietarioDocKind;
  filename: string;
  storage_path: string;
  bytes: number | null;
  validade: string | null;
  metadata: Record<string, unknown>;
  uploaded_at: string;
}

const PROP_DOC_LABEL: Record<ProprietarioDocKind, string> = {
  cc: 'Cartão de Cidadão',
  bi: 'BI',
  nif: 'NIF (Finanças)',
  comprovativo_morada: 'Comprovativo de morada',
  certidao_casamento: 'Certidão de casamento',
  sentenca_divorcio: 'Sentença de divórcio',
  habilitacao_herdeiros: 'Habilitação de herdeiros',
  procuracao: 'Procuração',
  declaracao_nao_residencia: 'Declaração não-residência',
  outro: 'Outro',
};
export function proprietarioDocLabel(k: ProprietarioDocKind): string {
  return PROP_DOC_LABEL[k] ?? k;
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

export function formatPrecoEur(v: number | null | undefined): string {
  if (v == null) return '—';
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}

export function estadoChipClass(estado: ImovelEstado | string | null): string {
  const base = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium';
  const def = getEstadoDef(estado);
  return `${base} ${def.chipClass}`;
}

export function estadoLabel(estado: ImovelEstado | string | null): string {
  return getEstadoDef(estado).label;
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
