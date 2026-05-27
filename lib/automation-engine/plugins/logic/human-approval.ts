// ============================================================================
// logic.human_approval — suspende automação à espera de decisão humana no Telegram
// ============================================================================
// Sprint 4.1 commit 1.
//
// Envia uma mensagem ao bot Telegram CRM com 2-3 botões inline (Aprovar /
// Rejeitar / Editar). A automação fica em status='waiting'. Quando o consultor
// carrega num botão, a Edge Function `telegram-callback` actualiza variables e
// retoma a execução com `_branch_taken = approved | rejected | edited`.
//
// O nó deve ter edges com sourceHandle = 'approved' / 'rejected' / 'edited'
// para o executor bifurcar correctamente.
//
// Timeout opcional (default 24h): se ninguém decidir, a automação resume com
// _branch_taken = 'timeout' e segue por essa edge (ou pára se não houver).
// ============================================================================

import type { AtomDefinition, AtomOutput, ExecutionContext } from '../../types';

export const logicHumanApproval: AtomDefinition = {
  id: 'logic.human_approval',
  category: 'logic',
  name: 'Aprovação humana',
  icon: '🙋',
  description: 'Envia mensagem Telegram com botões e espera decisão. Bifurca em approved/rejected/edited.',

  configSchema: {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'Texto a mostrar ao consultor (suporta {{ vars }}).' },
      approve_label: { type: 'string', description: 'Texto do botão Aprovar. Default: ✅ Aprovar.' },
      reject_label: { type: 'string', description: 'Texto do botão Rejeitar. Default: ❌ Rejeitar.' },
      edit_label: { type: 'string', description: 'Opcional. Botão extra para marcar como "precisa edição".' },
      timeout_hours: { type: 'integer', description: 'Quantas horas esperar. Default 24.', minimum: 1 },
    },
    required: ['message'],
  },

  outputSchema: {
    type: 'object',
    properties: {
      _branch_taken: { type: 'string', enum: ['approved', 'rejected', 'edited', 'timeout'] },
      _human_approval: { type: 'object' },
    },
  },

  timeoutMs: 15000,

  async execute(_context: ExecutionContext): Promise<AtomOutput> {
    throw new Error('logic.human_approval só corre dentro do Edge Function automation-execute.');
  },
};
