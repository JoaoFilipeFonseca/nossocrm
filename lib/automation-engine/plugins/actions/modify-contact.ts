// ============================================================================
// action.modify_contact — actualiza stage/status/notas de um contacto
// ============================================================================
// Sprint 3.0 commit 1/4.
//
// Aceita contact_id do config OU usa o contact_id da execution (vindo do
// payload do trigger). Permite mudar stage/status, substituir notes
// ("notes": "novo texto") ou anexar ("append_notes": "linha extra").
//
// RLS: o executor corre com service_role, por isso pode escrever em qualquer
// contacto da organização. Validamos organization_id no WHERE para impedir
// cruzar tenants se alguém passar contact_id de outra org.
// ============================================================================

import type { AtomDefinition, AtomOutput, ExecutionContext } from '../../types';

export const actionModifyContact: AtomDefinition = {
  id: 'action.modify_contact',
  category: 'action',
  name: 'Actualizar contacto',
  icon: '👤',
  description: 'Muda stage, status, ou notas de um contacto.',

  configSchema: {
    type: 'object',
    properties: {
      contact_id: { type: 'string', description: 'UUID do contacto. Default: contact da execution.' },
      stage: { type: 'string', description: 'Nova stage (ex: lead, qualified, customer).' },
      status: { type: 'string', description: 'Novo status.' },
      notes: { type: 'string', description: 'Substitui o campo notes.' },
      append_notes: { type: 'string', description: 'Anexa uma linha ao notes existente.' },
    },
  },

  outputSchema: {
    type: 'object',
    properties: {
      contact_id: { type: 'string' },
      updated_fields: { type: 'array', items: { type: 'string' } },
    },
  },

  timeoutMs: 8000,

  async execute(context: ExecutionContext): Promise<AtomOutput> {
    const contactId = String(context.config.contact_id ?? '');
    if (!contactId) throw new Error('contact_id em falta. Usa "{{ contact.id }}" para apanhar do trigger.');

    const patch: Record<string, unknown> = {};
    if (typeof context.config.stage === 'string' && context.config.stage) patch.stage = context.config.stage;
    if (typeof context.config.status === 'string' && context.config.status) patch.status = context.config.status;
    if (typeof context.config.notes === 'string') patch.notes = context.config.notes;

    if (typeof context.config.append_notes === 'string' && context.config.append_notes) {
      const { data: row } = await context.supabase
        .from('contacts')
        .select('notes')
        .eq('id', contactId)
        .eq('organization_id', context.organizationId)
        .maybeSingle();
      const existing = (row?.notes as string | null) ?? '';
      patch.notes = existing ? `${existing}\n${context.config.append_notes}` : String(context.config.append_notes);
    }

    if (Object.keys(patch).length === 0) throw new Error('nenhum campo para actualizar (stage/status/notes/append_notes)');

    const { data, error } = await context.supabase
      .from('contacts')
      .update(patch)
      .eq('id', contactId)
      .eq('organization_id', context.organizationId)
      .select('id')
      .maybeSingle();

    if (error) throw new Error(`supabase: ${error.message}`);
    if (!data) throw new Error('contacto não encontrado nesta organização');

    return { contact_id: contactId, updated_fields: Object.keys(patch) };
  },
};
