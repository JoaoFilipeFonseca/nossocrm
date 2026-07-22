// BRIEF 7 / 7b — Segmentos da base para o nurture.
//
// 5 tipos, alinhados com o brief. A fonte de verdade dos slugs é a constraint
// contacts_segment_check (migração 20260722120000). A IA sugere; o João corrige.

export const SEGMENTS = [
  'proprietario_vendedor',
  'comprador',
  'ex_cliente',
  'referenciador',
  'curioso',
] as const;

export type Segment = (typeof SEGMENTS)[number];

export const SEGMENT_LABELS: Record<Segment, string> = {
  proprietario_vendedor: 'Proprietário (potencial vendedor)',
  comprador: 'Comprador',
  ex_cliente: 'Ex-cliente',
  referenciador: 'Referenciador',
  curioso: 'Curioso',
};

/** Uma linha a explicar cada segmento (ajuda o João a decidir a correcção). */
export const SEGMENT_HINTS: Record<Segment, string> = {
  proprietario_vendedor: 'Tem imóvel ou pondera vender. Toque com dados da zona e a Análise de Mercado.',
  comprador: 'Procura casa (compra ou arrendamento). Toque com novidades e apoio à procura.',
  ex_cliente: 'Já fechou negócio. Manter a relação, pedir referências, novas necessidades.',
  referenciador: 'Rede ou parceria. Cuida-se a relação para gerar recomendações.',
  curioso: 'Sem intenção clara. Aquecer aos poucos, sem pressão.',
};

export function isSegment(x: unknown): x is Segment {
  return typeof x === 'string' && (SEGMENTS as readonly string[]).includes(x);
}

export function segmentLabel(seg: string | null | undefined): string {
  return seg && isSegment(seg) ? SEGMENT_LABELS[seg] : 'Por classificar';
}
