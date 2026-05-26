// ============================================================================
// action.modify_deal — actualiza status/valor/prioridade/tags de um deal
// ============================================================================
// Sprint 3.0 commit 2/4.
// ============================================================================

import type { AtomDefinition, AtomOutput, ExecutionContext } from '../../types';

export const actionModifyDeal: AtomDefinition = {
  id: 'action.modify_deal',
  category: 'action',
  name: 'Actualizar deal',
  icon: '💼',
  description: 'Muda status, valor, prioridade ou tags de um deal.',

  configSchema: {
    type: 'object',
    properties: {
      deal_id: { type: 'string', description: 'UUID do deal. Usa "{{ deal.id }}" para apanhar do trigger.' },
      status: { type: 'string' },
      priority: { type: 'string' },
      value: { type: 'number', description: 'Valor em EUR.' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Substitui o array de tags.' },
      append_tag: { type: 'string', description: 'Anexa uma tag sem duplicar.' },
    },
  },

  outputSchema: {
    type: 'object',
    properties: {
      deal_id: { type: 'string' },
      updated_fields: { type: 'array', items: { type: 'string' } },
    },
  },

  timeoutMs: 8000,

  async execute(context: ExecutionContext): Promise<AtomOutput> {
    const dealId = String(context.config.deal_id ?? '');
    if (!dealId) throw new Error('deal_id em falta. Usa "{{ deal.id }}" para apanhar do trigger.');

    const patch: Record<string, unknown> = {};
    if (typeof context.config.status === 'string' && context.config.status) patch.status = context.config.status;
    if (typeof context.config.priority === 'string' && context.config.priority) patch.priority = context.config.priority;
    if (context.config.value !== undefined && context.config.value !== null) {
      const v = Number(context.config.value);
      if (!Number.isFinite(v)) throw new Error('value tem de ser número');
      patch.value = v;
    }
    if (Array.isArray(context.config.tags)) patch.tags = context.config.tags.map(String);

    if (typeof context.config.append_tag === 'string' && context.config.append_tag) {
      const { data: row } = await context.supabase
        .from('deals')
        .select('tags')
        .eq('id', dealId)
        .eq('organization_id', context.organizationId)
        .maybeSingle();
      const existing = Array.isArray(row?.tags) ? (row.tags as string[]) : [];
      const tag = String(context.config.append_tag);
      patch.tags = existing.includes(tag) ? existing : [...existing, tag];
    }

    if (Object.keys(patch).length === 0) throw new Error('nenhum campo para actualizar');

    const { data, error } = await context.supabase
      .from('deals')
      .update(patch)
      .eq('id', dealId)
      .eq('organization_id', context.organizationId)
      .select('id')
      .maybeSingle();

    if (error) throw new Error(`supabase: ${error.message}`);
    if (!data) throw new Error('deal não encontrado nesta organização');

    return { deal_id: dealId, updated_fields: Object.keys(patch) };
  },
};
