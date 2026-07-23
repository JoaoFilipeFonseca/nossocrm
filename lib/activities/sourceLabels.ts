/**
 * Rótulos legíveis do canal de aquisição da lead (source / attribution).
 * Usado nos badges rápidos do negócio.
 */

const SOURCE_LABELS: Record<string, string> = {
  meta_ads: 'Meta Ads',
  meta: 'Meta Ads',
  facebook: 'Facebook',
  instagram: 'Instagram',
  messenger: 'Messenger',
  whatsapp: 'WhatsApp',
  webhook: 'Website',
  website: 'Website',
  'calculadora-avaliar': 'Estudo de Mercado',
  calculadora: 'Estudo de Mercado',
  idealista: 'Idealista',
  imovirtual: 'Imovirtual',
  supercasa: 'SuperCasa',
  olx: 'OLX',
  custojusto: 'CustoJusto',
  telegram: 'Telegram',
  email: 'Email',
  nurture: 'Nurture',
  radar: 'Radar Maia',
  manual: 'Manual',
};

/**
 * Devolve um rótulo apresentável para o canal de aquisição, ou null se não houver
 * informação (para o chip ser omitido).
 */
export function sourceLabel(source: string | null | undefined): string | null {
  if (!source) return null;
  const key = source.toLowerCase().trim();
  if (!key) return null;
  if (SOURCE_LABELS[key]) return SOURCE_LABELS[key];
  // Fallback: capitaliza a 1.ª letra de um source desconhecido mas presente.
  return key.charAt(0).toUpperCase() + key.slice(1);
}
