/**
 * Fila de respostas com "timing humano".
 *
 * Em vez de o agente responder na hora (soa a robô), a resposta é AGENDADA:
 *  - Primeira mensagem, ou depois de mais de 30 min de silêncio → responde ao minuto 3.
 *  - Conversa a decorrer (última troca há menos de 30 min) → responde em ~40 segundos.
 *
 * O envio em si é feito pelo tique de minuto (pg_cron → /api/cron/ai-replies),
 * porque a função de resposta só pode correr 60s e não aguenta esperar 3 minutos.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** Atraso da PRIMEIRA mensagem (ou após silêncio) — parece alguém que foi ver a conversa. */
export const FIRST_MESSAGE_DELAY_SECONDS = 180;
/** Atraso dentro de uma conversa a decorrer — rápido, como uma pessoa a conversar. */
export const ONGOING_DELAY_SECONDS = 40;
/** A partir deste silêncio, a mensagem volta a contar como "primeira". */
export const ONGOING_WINDOW_MINUTES = 30;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface EnqueueParams {
  supabase: SupabaseClient;
  organizationId: string;
  conversationId: string;
  messageId?: string | null;
  messageText: string;
}

/**
 * Decide o atraso e agenda (ou reprograma) a resposta desta conversa.
 * Uma só resposta pendente por conversa: se o cliente escreve outra vez antes da
 * hora, o relógio reinicia e responde-se uma vez só ao conjunto.
 */
export async function enqueueScheduledReply({
  supabase,
  organizationId,
  conversationId,
  messageId,
  messageText,
}: EnqueueParams): Promise<{ delaySeconds: number }> {
  // Última mensagem ANTERIOR a esta (a atual já foi inserida pelo webhook).
  let query = supabase
    .from('messaging_messages')
    .select('created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (messageId) query = query.neq('id', messageId);

  const { data: prev } = await query.maybeSingle();

  const prevAt = prev?.created_at ? new Date(prev.created_at as string).getTime() : null;
  const gapMinutes = prevAt ? (Date.now() - prevAt) / 60000 : Infinity;
  const isOngoing = gapMinutes <= ONGOING_WINDOW_MINUTES;
  const delaySeconds = isOngoing ? ONGOING_DELAY_SECONDS : FIRST_MESSAGE_DELAY_SECONDS;

  const dueAt = new Date(Date.now() + delaySeconds * 1000).toISOString();

  await supabase
    .from('scheduled_ai_replies')
    .upsert(
      {
        organization_id: organizationId,
        conversation_id: conversationId,
        // Coluna uuid: o id do provedor (wamid) não é UUID, por isso só guardamos
        // quando for mesmo um UUID interno; o cron responde na mesma pelo texto.
        last_inbound_message_id: messageId && UUID_RE.test(messageId) ? messageId : null,
        last_inbound_text: messageText,
        due_at: dueAt,
        status: 'pending',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'conversation_id' },
    );

  return { delaySeconds };
}
