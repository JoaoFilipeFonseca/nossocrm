// ============================================================================
// logic.wait_until — esperar evento canonico OU timeout
// ============================================================================
// Sprint 32 c3. Ticket 4.1 do automation-engine sprint plan.
//
// Mecanismo:
// 1. Atomo recebe wait_for_events[] + timeout_seconds + optional match_contact/deal
// 2. INSERT row em automation_waiting_events para cada event_type
// 3. Retorna { _suspend: true, _resumeAt: timeout } — executor agenda
//    automation_schedules para o timeout (igual a wait_fixed)
// 4. Quando evento canonico chega:
//    - automation-event-listener processa triggers (existente)
//    - Extensao processa automation_waiting_events status=pending
//    - Se match, UPDATE status='matched' + invoca automation-execute (resume)
//    - Cancel pending schedules da mesma execution_id
// 5. Quando timeout chega sem match: automation-resume retoma normalmente
//    (variables.wait_until.timeout=true)
//
// Output do atom (apos resume):
//   - matched: bool      (true se evento bateu, false se timeout)
//   - event_type: string (qual evento bateu, null se timeout)
//   - matched_at / timeout_at: ISO
// ============================================================================

import type { AtomDefinition, AtomOutput, ExecutionContext } from '../../types';

export const logicWaitUntil: AtomDefinition = {
  id: 'logic.wait_until',
  category: 'logic',
  name: 'Esperar evento ou tempo',
  icon: '⏳',
  description: 'Suspende a automacao ate um evento canonico bater OU passar o tempo limite.',

  configSchema: {
    type: 'object',
    properties: {
      wait_for_events: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        description: 'Lista de eventos canonicos que retomam (ex: message.received, contact.tag.added).',
      },
      timeout_seconds: {
        type: 'integer',
        minimum: 60,
        maximum: 60 * 60 * 24 * 30,
        default: 86400,
        description: 'Segundos ate dar timeout. Minimo 60s, maximo 30 dias.',
      },
      match_contact: {
        type: 'boolean',
        default: true,
        description: 'Se true, evento so retoma quando contact_id bate (lido de context.contactId).',
      },
      match_deal: {
        type: 'boolean',
        default: false,
        description: 'Se true, evento so retoma quando deal_id bate (lido de context.dealId).',
      },
    },
    required: ['wait_for_events'],
  },

  outputSchema: {
    type: 'object',
    properties: {
      _suspend: { type: 'boolean' },
      _resumeAt: { type: 'string', format: 'date-time' },
      matched: { type: 'boolean' },
      event_type: { type: 'string' },
      matched_at: { type: 'string', format: 'date-time' },
      timeout_at: { type: 'string', format: 'date-time' },
    },
  },

  async execute(context: ExecutionContext): Promise<AtomOutput> {
    // Se estamos a retomar (variables ja tem output deste node), devolve resultado final.
    // O listener pode ter actualizado automation_waiting_events.status=matched antes do resume.
    const prior = context.variables?.[context.nodeId]?.output as Record<string, unknown> | undefined;
    if (prior && (prior.matched === true || prior.matched === false)) {
      // Re-execucao apos resume: ler waiting_events para descobrir match real
      const { data } = await context.supabase
        .from('automation_waiting_events')
        .select('event_type, status, matched_at, timeout_at')
        .eq('execution_id', context.executionId)
        .in('status', ['matched', 'timeout'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        return {
          matched: data.status === 'matched',
          event_type: data.event_type,
          matched_at: data.matched_at,
          timeout_at: data.timeout_at,
        };
      }
    }

    const events = (context.config.wait_for_events as string[]) || [];
    if (events.length === 0) throw new Error('wait_for_events é obrigatório');

    const timeoutSeconds = Number(context.config.timeout_seconds ?? 86400);
    if (timeoutSeconds < 60) throw new Error('timeout_seconds mínimo 60s');

    const matchContact = context.config.match_contact !== false;
    const matchDeal = context.config.match_deal === true;

    const timeoutAt = new Date(Date.now() + timeoutSeconds * 1000).toISOString();

    // INSERT row(s) em automation_waiting_events — uma por event_type
    const rows = events.map((eventType) => ({
      execution_id: context.executionId,
      organization_id: context.organizationId,
      event_type: eventType,
      contact_match: matchContact && context.contactId ? context.contactId : null,
      deal_match: matchDeal && context.dealId ? context.dealId : null,
      timeout_at: timeoutAt,
      status: 'pending',
    }));

    const { error } = await context.supabase.from('automation_waiting_events').insert(rows);
    if (error) throw new Error(`Falha a registar waiting events: ${error.message}`);

    // Apos resume, este atom corre de novo — o ramo prior trata.
    return {
      _suspend: true,
      _resumeAt: timeoutAt,
      timeout_at: timeoutAt,
      // Placeholder values; o resume re-executa o atomo e o ramo prior preenche.
      matched: false,
      event_type: null,
    };
  },
};
