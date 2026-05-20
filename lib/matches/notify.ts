import 'server-only';
import type { createStaticAdminClient } from '@/lib/supabase/server';
import { sendTelegramMessage } from '@/lib/notifications/telegram';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://crm-joao.vercel.app';
const MIN_SCORE_NOTIFY = 60;
const MAX_ITEMS_IN_MESSAGE = 5;

export interface MatchToNotify {
  raw_intel_id: string;
  imovel_id: string;
  score: number;
}

interface IntelRow {
  id: string;
  contact: Record<string, unknown> | null;
  property: unknown;
}

interface ImovelRow {
  id: string;
  referencia: string | null;
  titulo_anuncio: string | null;
  tipologia: string | null;
  freguesia: string | null;
  concelho: string | null;
  preco_actual: number | string | null;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatPreco(v: number | string | null): string {
  if (v == null) return '';
  const n = typeof v === 'string' ? Number(v) : v;
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 }).format(n) + '€';
}

/**
 * Envia mensagem agregada para o chat Telegram da org com os matches recem-criados
 * de score relevante. Fire-and-forget: nao bloqueia, nunca lanca.
 *
 * Filtros:
 * - Apenas matches com score >= MIN_SCORE_NOTIFY (60) entram
 * - Mostra top MAX_ITEMS_IN_MESSAGE (5) na mensagem; restantes em rodape
 * - Se org nao tem token/chat configurados, nao envia
 */
export async function notifyNewMatches(
  supabase: ReturnType<typeof createStaticAdminClient>,
  organizationId: string,
  novosCandidatos: MatchToNotify[],
): Promise<void> {
  try {
    const relevantes = novosCandidatos.filter((c) => c.score >= MIN_SCORE_NOTIFY);
    if (relevantes.length === 0) return;

    const { data: settings } = await supabase
      .from('organization_settings')
      .select('telegram_crm_bot_token, telegram_crm_chat_id')
      .eq('organization_id', organizationId)
      .maybeSingle();

    const token = (settings as { telegram_crm_bot_token?: string } | null)?.telegram_crm_bot_token;
    const chatId = (settings as { telegram_crm_chat_id?: string | number } | null)?.telegram_crm_chat_id;
    if (!token || !chatId) return;

    const intelIds = Array.from(new Set(relevantes.map((c) => c.raw_intel_id)));
    const imovelIds = Array.from(new Set(relevantes.map((c) => c.imovel_id)));

    const [intelRes, imovelRes] = await Promise.all([
      supabase.from('raw_intel').select('id, contact, property').in('id', intelIds),
      supabase.from('imoveis').select('id, referencia, titulo_anuncio, tipologia, freguesia, concelho, preco_actual').in('id', imovelIds),
    ]);

    const intelById = new Map<string, IntelRow>(((intelRes.data ?? []) as IntelRow[]).map((r) => [r.id, r]));
    const imovelById = new Map<string, ImovelRow>(((imovelRes.data ?? []) as ImovelRow[]).map((r) => [r.id, r]));

    const top = [...relevantes].sort((a, b) => b.score - a.score).slice(0, MAX_ITEMS_IN_MESSAGE);

    const linhas: string[] = [];
    for (let i = 0; i < top.length; i++) {
      const c = top[i];
      const intel = intelById.get(c.raw_intel_id);
      const imv = imovelById.get(c.imovel_id);
      if (!intel || !imv) continue;
      const contact = (intel.contact ?? {}) as Record<string, string | null>;
      const nome = contact.nome ?? 'Sem nome';
      const imovLabel = imv.referencia ?? imv.titulo_anuncio
        ?? `${imv.tipologia ?? ''} ${imv.freguesia ?? imv.concelho ?? ''}`.trim()
        ?? 'imóvel';
      const preco = formatPreco(imv.preco_actual);
      linhas.push(
        `${i + 1}. <b>${c.score} pts</b> · ${escapeHtml(nome)}\n` +
        `   bate com <a href="${APP_URL}/imoveis/${imv.id}">${escapeHtml(imovLabel)}${preco ? ` · ${preco}` : ''}</a>`
      );
    }
    if (linhas.length === 0) return;

    const restantes = relevantes.length - top.length;
    const rodape = restantes > 0 ? `\n\n<i>+${restantes} cruzamento(s) adicional(is)</i>` : '';

    const msg =
      `💎 <b>${relevantes.length} cruzamento(s) novo(s)!</b>\n\n` +
      linhas.join('\n\n') + rodape +
      `\n\n<a href="${APP_URL}/cruzamentos">Abrir Cruzamentos ↗</a>`;

    await sendTelegramMessage(token, String(chatId), msg);
  } catch (err) {
    console.error('[matches/notify] falhou:', err instanceof Error ? err.message : err);
  }
}
