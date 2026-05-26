// ============================================================================
// event-bus.ts — Wrapper sobre Supabase Realtime + pg_notify
// ============================================================================
// Localização final: /lib/automation-engine/event-bus.ts
// ============================================================================

import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import type { SystemEvent, AutomationEvent } from './types';

// ----------------------------------------------------------------------------
// Publicar evento
// ----------------------------------------------------------------------------
export async function publishEvent(
  supabase: SupabaseClient,
  params: {
    eventType: SystemEvent | string;
    payload: Record<string, unknown>;
    organizationId: string;
    source?: string;
    idempotencyKey?: string;
  }
): Promise<string | null> {
  const { data, error } = await supabase.rpc('publish_event', {
    p_event_type: params.eventType,
    p_payload: params.payload,
    p_organization_id: params.organizationId,
    p_source: params.source ?? null,
    p_idempotency_key: params.idempotencyKey ?? null,
  });
  
  if (error) {
    console.error('[event-bus] Erro a publicar evento:', error);
    throw error;
  }
  
  return data as string | null;
}

// ----------------------------------------------------------------------------
// Subscrever a eventos em tempo real
// ----------------------------------------------------------------------------
export interface EventSubscription {
  unsubscribe: () => Promise<void>;
}

export function subscribeToEvents(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    eventTypes?: string[]; // se omitido, subscreve a todos
    onEvent: (event: AutomationEvent) => void | Promise<void>;
  }
): EventSubscription {
  const channelName = `org-events-${params.organizationId}`;
  
  const channel: RealtimeChannel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'automation_events',
        filter: `organization_id=eq.${params.organizationId}`,
      },
      async (payload) => {
        const event = payload.new as AutomationEvent;
        
        // Filtrar por tipo, se especificado
        if (params.eventTypes && !params.eventTypes.includes(event.event_type)) {
          return;
        }
        
        try {
          await params.onEvent(event);
        } catch (err) {
          console.error('[event-bus] Erro no handler:', err);
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[event-bus] Subscrito a ${channelName}`);
      }
    });
  
  return {
    async unsubscribe() {
      await supabase.removeChannel(channel);
    },
  };
}

// ----------------------------------------------------------------------------
// Marcar evento como processado
// ----------------------------------------------------------------------------
export async function markEventProcessed(
  supabase: SupabaseClient,
  eventId: string
): Promise<void> {
  const { error } = await supabase
    .from('automation_events')
    .update({
      processed: true,
      processed_at: new Date().toISOString(),
    })
    .eq('id', eventId);
  
  if (error) {
    console.error('[event-bus] Erro a marcar evento processado:', error);
  }
}

// ----------------------------------------------------------------------------
// Encontrar automações que respondem a um evento
// ----------------------------------------------------------------------------
export async function findAutomationsForEvent(
  supabase: SupabaseClient,
  event: AutomationEvent
): Promise<Array<{
  automation_id: string;
  trigger_config: Record<string, unknown>;
}>> {
  const { data, error } = await supabase
    .from('automation_triggers')
    .select('automation_id, config')
    .eq('organization_id', event.organization_id)
    .eq('trigger_type', 'event')
    .eq('is_active', true)
    .contains('config', { event_type: event.event_type });
  
  if (error) {
    console.error('[event-bus] Erro a procurar automações:', error);
    return [];
  }
  
  // Aplicar filtros adicionais do trigger (filter.X)
  return (data ?? [])
    .filter((trigger) => matchesTriggerFilter(event, trigger.config as Record<string, unknown>))
    .map((trigger) => ({
      automation_id: trigger.automation_id,
      trigger_config: trigger.config as Record<string, unknown>,
    }));
}

function matchesTriggerFilter(
  event: AutomationEvent,
  config: Record<string, unknown>
): boolean {
  const filter = config.filter as Record<string, unknown> | undefined;
  if (!filter) return true;
  
  for (const [key, expectedValue] of Object.entries(filter)) {
    const actualValue = getNestedValue(event.payload, key);
    if (actualValue !== expectedValue) return false;
  }
  
  return true;
}

function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}
