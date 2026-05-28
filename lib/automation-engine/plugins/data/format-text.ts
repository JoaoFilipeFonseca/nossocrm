// ============================================================================
// data.format_text — gera string formatada via Liquid
// ============================================================================
// Sprint 36 c5b.
//
// Template livre com {{ variaveis }}. Util para criar copy reutilizável
// (cabeçalho de email, body de WhatsApp parametrizado, log estruturado).
// O resultado fica em {{ <node_id>.output.text }}.
//
// Nota: o LiquidJS é aplicado pelo executor no resolveConfig() antes de
// chamar execute(). Aqui só devolvemos o template já resolvido.
// ============================================================================

import type { AtomDefinition, AtomOutput, ExecutionContext } from '../../types';

export const dataFormatText: AtomDefinition = {
  id: 'data.format_text',
  category: 'data',
  name: 'Formatar texto',
  icon: '🧾',
  description: 'Gera texto formatado com {{ variáveis }} Liquid. Resultado em {{ este_no.output.text }}.',

  configSchema: {
    type: 'object',
    properties: {
      template: { type: 'string', description: 'Template Liquid. Ex: "Olá {{ contact.name }}, o seu deal vale {{ deal.value | money }}".' },
    },
    required: ['template'],
  },

  outputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string' },
    },
  },

  timeoutMs: 2000,

  async execute(context: ExecutionContext): Promise<AtomOutput> {
    return { text: String(context.config.template ?? '') };
  },
};
