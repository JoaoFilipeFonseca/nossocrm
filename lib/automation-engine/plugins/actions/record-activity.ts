// ============================================================================
// action.record_activity — regista um toque em deal_activities
// ============================================================================
// Brief 3 (épico Coração). deal_activities é a "verdade única" dos toques que
// alimenta a timeline unificada e o deal_state_signals. Com actor='automation'
// a timeline mostra o badge 🤖.
//
// Idempotência: com idempotency=true e deal_id presente, se já existir uma
// actividade deste type para o negócio, devolve _halt (não repete a automação).
// O índice único parcial uniq_deal_activities_first_response garante-o também
// sob concorrência (corrida → 23505 → _halt).
//
// Paridade: a Edge Function automation-execute (Deno) mantém uma cópia inline
// deste átomo. Mexer aqui = mexer lá.
// ============================================================================

import type { AtomDefinition, AtomOutput, ExecutionContext } from '../../types';

export const actionRecordActivity: AtomDefinition = {
  id: 'action.record_activity',
  category: 'action',
  name: 'Registar toque',
  icon: '🕓',
  description: 'Regista um toque na timeline do negócio (deal_activities). Com actor "automation" mostra o robô. Pode ser idempotente por negócio.',

  configSchema: {
    type: 'object',
    properties: {
      deal_id: { type: 'string', description: 'ID do negócio. Usa "{{ deal.id }}".' },
      contact_id: { type: 'string', description: 'ID do contacto. Usa "{{ contact.id }}".' },
      type: { type: 'string', description: 'Tipo do toque (ex: lead_first_response). Default "note".' },
      actor: { type: 'string', enum: ['automation', 'human', 'system'], description: 'Quem originou. Default "automation".' },
      description: { type: 'string', description: 'Texto do toque na timeline.' },
      idempotency: { type: 'boolean', description: 'Se ligado e houver deal_id, não repete um toque do mesmo type no mesmo negócio.' },
    },
  },

  outputSchema: {
    type: 'object',
    properties: {
      activity_id: { type: 'string' },
      recorded_at: { type: 'string' },
      deal_id: { type: 'string' },
      contact_id: { type: 'string' },
    },
  },

  async execute(context: ExecutionContext): Promise<AtomOutput> {
    const dealId = String(context.config.deal_id ?? '').trim();
    const contactId = String(context.config.contact_id ?? '').trim();
    const type = String(context.config.type ?? 'note').trim() || 'note';
    const actor = String(context.config.actor ?? 'automation').trim() || 'automation';
    const description = context.config.description != null ? String(context.config.description) : null;
    const dedupe = context.config.idempotency === true || context.config.idempotency === 'true';
    if (!dealId && !contactId) throw new Error('record_activity precisa de deal_id ou contact_id');

    if (dedupe && dealId) {
      const { data: existing } = await context.supabase
        .from('deal_activities')
        .select('id')
        .eq('organization_id', context.organizationId)
        .eq('deal_id', dealId)
        .eq('type', type)
        .limit(1)
        .maybeSingle();
      if (existing) return { _halt: true, skipped: 'already_recorded', deal_id: dealId };
    }

    const { data, error } = await context.supabase
      .from('deal_activities')
      .insert({
        organization_id: context.organizationId,
        deal_id: dealId || null,
        contact_id: contactId || null,
        type,
        actor,
        description,
        metadata: { via: 'automation-coracao' },
      })
      .select('id')
      .maybeSingle();

    if (error) {
      if ((error as { code?: string }).code === '23505') return { _halt: true, skipped: 'unique_conflict', deal_id: dealId };
      throw new Error(`record_activity: ${error.message}`);
    }
    return {
      activity_id: data?.id ?? null,
      recorded_at: new Date().toISOString(),
      deal_id: dealId || null,
      contact_id: contactId || null,
    };
  },
};
