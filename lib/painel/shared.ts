// Painel Diário — tipos e helpers partilhados entre a rota agregadora (servidor)
// e os componentes (cliente). NÃO importar 'server-only' aqui.
// Copy PT-PT pré-AO 1990.

export type PainelWindow = '30d' | '90d' | '365d';

export const PAINEL_WINDOWS: PainelWindow[] = ['30d', '90d', '365d'];

export function windowDays(w: PainelWindow): number {
  return w === '30d' ? 30 : w === '365d' ? 365 : 90;
}

export function windowLabel(w: PainelWindow): string {
  return w === '30d' ? '30 dias' : w === '365d' ? '365 dias' : '90 dias';
}

/** Etapa de um funil com contagem de negócios abertos e comissão prevista. */
export interface FunnelStage {
  label: string;
  color: string; // hex resolvido
  count: number;
  valueCents: number; // comissão prevista somada dos negócios abertos nesta etapa
}

export interface PainelFunnel {
  boardId: string;
  key: string; // proprietarios | compradores | ...
  /** Nome apresentado no painel (ex.: Proprietários → "Vendedores"). */
  displayName: string;
  stages: FunnelStage[];
  wonCount: number; // fechados na janela
}

export interface PainelKpis {
  faturacaoCents: number; // comissão líquida dos negócios ganhos na janela
  pipelinePrevistoCents: number; // comissão prevista dos negócios abertos (todos)
  negociosAbertos: number;
  abertosVendedores: number;
  abertosCompradores: number;
  fechados: number; // ganhos na janela
  fechadosVendedores: number;
  fechadosCompradores: number;
}

export interface ReceitaLinha {
  key: string;
  label: string;
  cents: number;
}

export interface PipelineEtapa {
  funnelKey: string;
  funnelName: string;
  label: string;
  count: number;
  valueCents: number;
}

export interface CoracaoDia {
  tarefasPendentes: number;
  tarefasHoje: number;
  tarefasAtrasadas: number;
  tarefasFeitasHoje: number;
  tentativasHoje: number; // chamadas que não deram conversa
  realizadasHoje: number; // chamadas em que falou mesmo
}

export interface CarteiraImovel {
  id: string;
  titulo: string;
  estado: string;
  estadoLabel: string;
  diasNoMercado: number;
  visitas: number;
  propostas: number;
}

export interface Carteira {
  activos: number;
  imoveis: CarteiraImovel[];
  visitasSemana: number;
}

export interface CanalRanking {
  label: string;
  count: number;
}

export interface TopCanais {
  vendedores: CanalRanking[];
  compradores: CanalRanking[];
  totalVendedores: number;
  totalCompradores: number;
}

export interface PainelSnapshot {
  window: PainelWindow;
  generatedAt: string;
  funnels: PainelFunnel[];
  kpis: PainelKpis;
  receitaLinhas: ReceitaLinha[];
  pipelinePorEtapa: PipelineEtapa[];
  coracao: CoracaoDia;
  carteira: Carteira;
  topCanais: TopCanais;
}

// ── Cores das etapas (mesmas classes Tailwind dos boards) → hex ──────────────
const STAGE_COLOR_HEX: Record<string, string> = {
  'bg-blue-500': '#3b82f6',
  'bg-green-500': '#22c55e',
  'bg-yellow-500': '#eab308',
  'bg-orange-500': '#f97316',
  'bg-red-500': '#ef4444',
  'bg-purple-500': '#a855f7',
  'bg-pink-500': '#ec4899',
  'bg-indigo-500': '#6366f1',
  'bg-teal-500': '#14b8a6',
  'bg-cyan-500': '#06b6d4',
  'bg-violet-500': '#8b5cf6',
  'bg-slate-400': '#94a3b8',
  'bg-slate-500': '#64748b',
  'bg-amber-500': '#f59e0b',
  'bg-emerald-600': '#059669',
};

export function stageColorHex(color: string | null | undefined): string {
  if (!color) return '#3b82f6';
  if (color.startsWith('#')) return color;
  return STAGE_COLOR_HEX[color] ?? '#3b82f6';
}

// ── Nome apresentado por board ──────────────────────────────────────────────
export function boardDisplayName(key: string | null, name: string): string {
  if (key === 'proprietarios') return 'Vendedores';
  return name;
}

// ── Buckets de origem (top canais) ──────────────────────────────────────────
// Ordem importa: primeiro match ganha.
const CANAL_RULES: Array<{ re: RegExp; label: string }> = [
  { re: /whatsapp/i, label: 'WhatsApp' },
  { re: /radar|fsbo|base-proprietarios/i, label: 'FSBO / Radar Maia' },
  { re: /facebook|meta[_ -]?ads|instagram/i, label: 'Meta Ads' },
  { re: /idealista|imovirtual|casasapo|sapo|imovel|portal/i, label: 'Portais' },
  { re: /calculadora|avaliar|estudo/i, label: 'Calculadora / Estudo' },
  { re: /cips|conhecimento pessoal|c[íi]rculo|indica|refer[êe]nc/i, label: 'Círculo de influência' },
  { re: /cartaz|escala|outdoor|flyer/i, label: 'Offline / Cartaz' },
  { re: /cold|chamada|frio/i, label: 'Chamadas a frio' },
  { re: /import|remax|ghl|kw\b/i, label: 'Base / Importações' },
  { re: /form|site|contacto/i, label: 'Formulários do site' },
];

export function canalBucket(source: string | null | undefined): string {
  const s = (source ?? '').trim();
  if (!s) return 'Sem origem';
  for (const rule of CANAL_RULES) {
    if (rule.re.test(s)) return rule.label;
  }
  return 'Outros';
}

export function eur(cents: number): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(
    cents / 100,
  );
}
