// ============================================================================
// action.run_ai — corre prompt IA (Gemini com fallback Anthropic)
// ============================================================================
// Sprint 4.2 commit 1.
//
// Usa o routedGenerate do lib/ai/router.ts. Como o executor corre em Deno
// (Edge Function), o átomo inline chama o endpoint Next.js /api/automations/run-ai
// que faz a chamada real (tem as API keys no env Vercel).
//
// Output principal: `text` — pode ser referenciado nos passos seguintes como
// `{{ <node_id>.output.text }}` (ex: passar a resposta da IA como body de email).
// ============================================================================

import type { AtomDefinition, AtomOutput, ExecutionContext } from '../../types';

export const actionRunAi: AtomDefinition = {
  id: 'action.run_ai',
  category: 'action',
  name: 'Correr IA',
  icon: '🧠',
  description: 'Corre um prompt IA. Output em {{ este_passo.output.text }}.',

  configSchema: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: 'O que pedir à IA. Suporta {{ contact.* }}, {{ deal.* }} etc.' },
      system: { type: 'string', description: 'Instrução de sistema opcional (papel, tom, formato).' },
      feature: {
        type: 'string',
        enum: ['generic', 'email_draft', 'whatsapp_draft', 'workflow_desc', 'workflow_icp', 'workflow_swot', 'workflow_pitch', 'deal_coach', 'imovel_extract', 'briefing'],
        description: 'Roteamento por feature (escolhe primary/fallback diferentes).',
      },
      temperature: { type: 'number', description: '0 = determinístico, 1 = criativo. Default 0.7.', minimum: 0 },
    },
    required: ['prompt'],
  },

  outputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string' },
      model_used: { type: 'string' },
      fallback_used: { type: 'boolean' },
    },
  },

  retry: { maxAttempts: 2, backoffMs: 1000 },
  timeoutMs: 60000,

  async execute(_context: ExecutionContext): Promise<AtomOutput> {
    // Executor real corre inline no Edge Function (precisa de fetch ao /api/automations/run-ai).
    // Este lib file é só para catalog/metadata.
    throw new Error('action.run_ai não corre fora do Edge Function automation-execute.');
  },
};
