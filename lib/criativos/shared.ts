/**
 * MKT-BIBLIOTECA — fonte única de tipos, origens, estados e helpers da biblioteca
 * de activos digitais (tabela creative_archive + bucket privado creative-archive).
 * API e UI derivam daqui (padrão AUD-D1: adicionar um valor = 1 linha).
 */

export const CREATIVE_TYPES = [
  'email',
  'whatsapp',
  'sms',
  'social_post',
  'organic_post',
  'carousel',
  'story',
  'story_cover',
  'ad_copy',
  'blog_article',
  'imovel_description',
  'sales_script',
  'briefing',
  'swot',
  'proposal',
  'pdf',
  'flyer',
  'banner',
  'idea',
  'reference',
] as const;

export type CreativeType = (typeof CREATIVE_TYPES)[number];

export const TYPE_LABELS: Record<CreativeType, string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  social_post: 'Post Social',
  organic_post: 'Post FB/IG',
  carousel: 'Carrossel',
  story: 'Story',
  story_cover: 'Capa de Story',
  ad_copy: 'Anúncio',
  blog_article: 'Blog',
  imovel_description: 'Descrição de Imóvel',
  sales_script: 'Script de Venda',
  briefing: 'Briefing',
  swot: 'SWOT',
  proposal: 'Proposta',
  pdf: 'PDF',
  flyer: 'Flyer',
  banner: 'Banner',
  idea: 'Ideia',
  reference: 'Referência',
};

export const CREATIVE_ORIGINS = ['created', 'imported', 'reference'] as const;
export type CreativeOrigin = (typeof CREATIVE_ORIGINS)[number];

export const ORIGIN_LABELS: Record<CreativeOrigin, string> = {
  created: 'Criado',
  imported: 'Importado',
  reference: 'Referência',
};

/** Estados aceites na biblioteca. 'sent' e 'rejected' são legados (continuam a ler-se). */
export const CREATIVE_STATUSES = ['draft', 'approved', 'published', 'sent', 'rejected'] as const;
export type CreativeStatus = (typeof CREATIVE_STATUSES)[number];

export const STATUS_LABELS: Record<CreativeStatus, string> = {
  draft: 'Rascunho',
  approved: 'Aprovado',
  published: 'Publicado',
  sent: 'Enviado',
  rejected: 'Rejeitado',
};

/** Os 3 estados que se oferecem na UI para mudar (legados ficam visíveis mas não se propõem). */
export const STATUS_OPTIONS: CreativeStatus[] = ['draft', 'approved', 'published'];

/** Registo de utilização de uma peça: "usei em X a Y". */
export interface CreativeUsage {
  channel: string;
  used_on: string; // YYYY-MM-DD
  note?: string;
}

/** Normaliza o jsonb de usages vindo da BD (tolerante a lixo). */
export function parseUsages(raw: unknown): CreativeUsage[] {
  if (!Array.isArray(raw)) return [];
  const out: CreativeUsage[] = [];
  for (const u of raw) {
    if (!u || typeof u !== 'object') continue;
    const channel = typeof (u as any).channel === 'string' ? (u as any).channel.trim() : '';
    const usedOn = typeof (u as any).used_on === 'string' ? (u as any).used_on.slice(0, 10) : '';
    if (!channel || !/^\d{4}-\d{2}-\d{2}$/.test(usedOn)) continue;
    const note = typeof (u as any).note === 'string' && (u as any).note.trim() ? (u as any).note.trim() : undefined;
    out.push(note ? { channel, used_on: usedOn, note } : { channel, used_on: usedOn });
  }
  return out;
}

/** Upload: tipos de ficheiro aceites na biblioteca e limites. */
export const UPLOAD_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const UPLOAD_PDF_TYPES = ['application/pdf'];
export const UPLOAD_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
export const UPLOAD_ALLOWED_TYPES = [...UPLOAD_IMAGE_TYPES, ...UPLOAD_PDF_TYPES, ...UPLOAD_VIDEO_TYPES];

export const UPLOAD_MAX_BYTES: Record<'image' | 'pdf' | 'video', number> = {
  image: 15 * 1024 * 1024,
  pdf: 25 * 1024 * 1024,
  video: 100 * 1024 * 1024,
};

export function uploadKindForMime(mime: string): 'image' | 'pdf' | 'video' | null {
  if (UPLOAD_IMAGE_TYPES.includes(mime)) return 'image';
  if (UPLOAD_PDF_TYPES.includes(mime)) return 'pdf';
  if (UPLOAD_VIDEO_TYPES.includes(mime)) return 'video';
  return null;
}

/** Tipo por omissão para um ficheiro carregado (o utilizador pode mudar no formulário). */
export function defaultTypeForMime(mime: string): CreativeType {
  const kind = uploadKindForMime(mime);
  if (kind === 'pdf') return 'flyer';
  if (kind === 'video') return 'story';
  return 'banner';
}

export const UPLOAD_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};
