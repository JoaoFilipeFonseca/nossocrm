/**
 * Helper fire-and-forget para arquivar criativos gerados/enviados pelos
 * geradores IA do CRM (emails, WhatsApp, posts, etc.).
 *
 * NUNCA bloqueia a UX. Se falhar, silenciosamente ignora.
 * O criativo aparece em /criativos para reutilização e análise de performance.
 */

export type ArchiveCreativePayload = {
  type:
    | 'email'
    | 'whatsapp'
    | 'sms'
    | 'social_post'
    | 'carousel'
    | 'story'
    | 'ad_copy'
    | 'blog_article'
    | 'imovel_description'
    | 'sales_script'
    | 'briefing'
    | 'swot'
    | 'proposal'
    | 'pdf'
    | 'banner';
  channel?: string | null;
  title?: string | null;
  subject?: string | null;
  content: string;
  deal_id?: string | null;
  contact_id?: string | null;
  imovel_id?: string | null;
  prompt_key?: string | null;
  source?: 'manual' | 'auto_generator' | 'imported';
  ai_provider?: string | null;
  ai_model?: string | null;
  ai_cost_usd?: number | null;
  ai_duration_ms?: number | null;
  status?: 'draft' | 'approved' | 'sent' | 'rejected' | 'archived';
  tags?: string[];
  is_template?: boolean;
  is_favorite?: boolean;
  edited_by_human?: boolean;
};

export async function archiveCreative(payload: ArchiveCreativePayload): Promise<void> {
  if (!payload?.content || !payload?.type) return;
  if (typeof window === 'undefined') return;

  try {
    await fetch('/api/criativos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Silencioso por design — arquivar nunca pode partir UX.
  }
}
