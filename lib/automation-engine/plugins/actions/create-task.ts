// ============================================================================
// action.create_task — cria uma activity (tarefa) ligada a contact e/ou deal
// ============================================================================
// Sprint 3.0 commit 3/4.
//
// Schema: activities tem title, description, type (texto livre, ex 'call',
// 'meeting', 'follow_up'), date (timestamp ISO), completed (boolean), contact_id
// e deal_id (nullable), organization_id, owner_id.
//
// due_in_hours é um açúcar prático para o consultor: "cria a tarefa para daqui
// a 24h". Se preferires data exacta, usa due_at em ISO.
// ============================================================================

import type { AtomDefinition, AtomOutput, ExecutionContext } from '../../types';

export const actionCreateTask: AtomDefinition = {
  id: 'action.create_task',
  category: 'action',
  name: 'Criar tarefa',
  icon: '✅',
  description: 'Cria uma activity/tarefa ligada a um contacto ou deal.',

  configSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      type: { type: 'string', description: 'Ex: call, meeting, follow_up, note.' },
      contact_id: { type: 'string' },
      deal_id: { type: 'string' },
      due_in_hours: { type: 'number', description: 'Quantas horas no futuro. Default 24.' },
      due_at: { type: 'string', description: 'Data ISO exacta. Sobrepõe due_in_hours.' },
    },
    required: ['title'],
  },

  outputSchema: {
    type: 'object',
    properties: {
      activity_id: { type: 'string' },
      date: { type: 'string' },
    },
  },

  timeoutMs: 8000,

  async execute(context: ExecutionContext): Promise<AtomOutput> {
    const title = String(context.config.title ?? '').trim();
    if (!title) throw new Error('title é obrigatório');

    let date: string;
    if (typeof context.config.due_at === 'string' && context.config.due_at) {
      date = new Date(context.config.due_at).toISOString();
    } else {
      const hours = Number(context.config.due_in_hours ?? 24);
      date = new Date(Date.now() + hours * 3600 * 1000).toISOString();
    }

    const payload: Record<string, unknown> = {
      organization_id: context.organizationId,
      title,
      description: typeof context.config.description === 'string' ? context.config.description : null,
      type: typeof context.config.type === 'string' && context.config.type ? context.config.type : 'follow_up',
      date,
      completed: false,
    };

    const contactId = String(context.config.contact_id ?? '');
    const dealId = String(context.config.deal_id ?? '');
    if (contactId) payload.contact_id = contactId;
    if (dealId) payload.deal_id = dealId;
    if (!contactId && !dealId) throw new Error('preciso de contact_id ou deal_id (usa "{{ contact.id }}" / "{{ deal.id }}")');

    const { data, error } = await context.supabase
      .from('activities')
      .insert(payload)
      .select('id')
      .single();

    if (error) throw new Error(`supabase: ${error.message}`);
    return { activity_id: data.id, date };
  },
};
