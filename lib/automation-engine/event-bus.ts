// ============================================================================
// event-bus.ts — wrapper TS sobre o RPC publish_event
// ============================================================================
// Sprint 0, commit 5 de 6.
//
// Ponto único TypeScript para publicar eventos na máquina de automações.
// Chama o RPC publish_event criado pela migration core (20260526120000).
//
// Princípios:
// - Nunca atira excepção. O RPC já tem EXCEPTION WHEN OTHERS THEN NULL
//   internamente, e este wrapper apanha qualquer erro de rede ou parsing.
// - Quem publica é dono do payload. Aqui nao validamos schema, e' so transporte.
// - Devolve o event_id (UUID) em sucesso, ou null em falha ou idempotency hit.
//
// Ainda nao invocado em produção. Será chamado por:
// - Edge Functions (commit Sprint 1+)
// - API routes que queiram emitir eventos sintéticos (commit Sprint 3+)
// - Telegram router, voice pipeline, etc. (Sprint 3+)
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { SystemEvent } from './types';

/**
 * Publica um evento no automation_events via RPC publish_event.
 *
 * @param supabase Cliente Supabase (qualquer um: cliente, server, service_role).
 * @param eventType Tipo canónico ou string arbitrária (SystemEvent ou outra).
 * @param payload JSON estruturado com o conteúdo do evento.
 * @param organizationId UUID da organização dona do evento.
 * @param source Opcional. Origem livre ('contacts_table', 'meta_ads_webhook', 'manual').
 * @param idempotencyKey Opcional. Se fornecido, segunda publicação com mesma chave
 *                       para (organization_id, event_type, idempotency_key) é
 *                       silenciosamente ignorada (ON CONFLICT DO NOTHING).
 *
 * @returns event_id em sucesso. null em duplicação idempotente ou erro.
 */
export async function publishEvent(
  supabase: SupabaseClient,
  eventType: SystemEvent | string,
  payload: Record<string, unknown>,
  organizationId: string,
  source?: string,
  idempotencyKey?: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('publish_event', {
      p_event_type: eventType,
      p_payload: payload,
      p_organization_id: organizationId,
      p_source: source ?? null,
      p_idempotency_key: idempotencyKey ?? null,
    });

    if (error) {
      return null;
    }

    return (data as string | null) ?? null;
  } catch {
    return null;
  }
}
