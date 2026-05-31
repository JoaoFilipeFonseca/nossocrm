import { JourneyDefinition } from '@/types';
import { BOARD_TEMPLATES } from '@/lib/templates/board-templates';

export const OFFICIAL_JOURNEYS: Record<
  string,
  JourneyDefinition & { id: string; description: string; icon: string }
> = {
  INFOPRODUCER: {
    id: 'INFOPRODUCER',
    schemaVersion: '1.0',
    name: 'Infoprodutor (Completo)',
    description:
      'Playbook alinhado ao mercado para infoprodutos: Captação, Vendas, Onboarding do aluno, CS (Saúde) e Upsell (Expansão).',
    icon: '🎓',
    boards: [
      {
        slug: 'sdr',
        name: '1. Captação / Leads',
        columns: [
          { name: 'Novos Leads', color: 'bg-blue-500', linkedLifecycleStage: 'LEAD' },
          { name: 'Contatado', color: 'bg-yellow-500', linkedLifecycleStage: 'LEAD' },
          { name: 'Qualificando', color: 'bg-purple-500', linkedLifecycleStage: 'LEAD' },
          { name: 'Qualificado (MQL)', color: 'bg-green-500', linkedLifecycleStage: 'MQL' },
        ],
        strategy: {
          agentPersona: {
            name: 'Closer de DM',
            role: 'Captação e Qualificação',
            behavior:
              'Seja rápido e prático. Identifique intenção, timing e fit. Direcione para a oferta certa e elimine fricção para avançar.',
          },
          goal: {
            description: 'Aumentar MQLs qualificados a partir de leads.',
            kpi: 'MQLs',
            targetValue: '100',
            type: 'number',
          },
          entryTrigger: 'Leads vindos de ads, orgânico, direct, WhatsApp ou página de captura.',
        },
      },
      {
        slug: 'sales',
        name: '2. Vendas (Oferta / Turma)',
        columns: [
          { name: 'Descoberta', color: 'bg-blue-500', linkedLifecycleStage: 'MQL' },
          { name: 'Proposta', color: 'bg-purple-500', linkedLifecycleStage: 'PROSPECT' },
          { name: 'Negociação', color: 'bg-orange-500', linkedLifecycleStage: 'PROSPECT' },
          { name: 'Matriculado (Ganho)', color: 'bg-green-500', linkedLifecycleStage: 'CUSTOMER' },
          { name: 'Não comprou (Perdido)', color: 'bg-red-500', linkedLifecycleStage: 'OTHER' },
        ],
        strategy: {
          agentPersona: {
            name: 'Closer',
            role: 'Fecho',
            behavior:
              'Venda consultiva e objectiva. Foque-se na clareza da transformação, prova, urgência e remoção de objecções. Sem rodeios.',
          },
          goal: {
            description: 'Maximizar conversão de MQL → Matriculado.',
            kpi: 'Conversão',
            targetValue: '25',
            type: 'percentage',
          },
          entryTrigger: 'Leads qualificados que demonstraram intenção de compra.',
        },
      },
      {
        slug: 'onboarding',
        name: '3. Onboarding do Aluno (Activação)',
        columns: [
          { name: 'Boas-vindas', color: 'bg-blue-500', linkedLifecycleStage: 'CUSTOMER' },
          { name: 'Setup (Acessos)', color: 'bg-purple-500', linkedLifecycleStage: 'CUSTOMER' },
          { name: 'Primeira Entrega', color: 'bg-yellow-500', linkedLifecycleStage: 'CUSTOMER' },
          { name: 'Primeiro Resultado (Ganho)', color: 'bg-green-500', linkedLifecycleStage: 'CUSTOMER' },
        ],
        strategy: {
          agentPersona: {
            name: 'CS Educacional',
            role: 'Activação e Retenção Inicial',
            behavior:
              'Seja didáctico e acolhedor. Garanta que o aluno completa o setup e tem o primeiro resultado rápido. Reduza abandono e reembolso.',
          },
          goal: {
            description: 'Garantir activação rápida (primeiro resultado) e reduzir abandono.',
            kpi: 'Activação',
            targetValue: '70',
            type: 'percentage',
          },
          entryTrigger: 'Alunos matriculados na oferta/turma.',
        },
      },
      {
        slug: 'cs',
        name: '4. CS (Saúde do Aluno)',
        columns: BOARD_TEMPLATES.CS.stages.map(s => ({
          name: s.label,
          color: s.color,
          linkedLifecycleStage: s.linkedLifecycleStage,
        })),
        strategy: {
          agentPersona: BOARD_TEMPLATES.CS.agentPersona,
          goal: BOARD_TEMPLATES.CS.goal,
          entryTrigger: BOARD_TEMPLATES.CS.entryTrigger,
        },
      },
      {
        slug: 'expansion',
        name: '5. Upsell (Expansão)',
        columns: [
          { name: 'Identificado', color: 'bg-blue-500', linkedLifecycleStage: 'CUSTOMER' },
          { name: 'Qualificando', color: 'bg-yellow-500', linkedLifecycleStage: 'CUSTOMER' },
          { name: 'Proposta', color: 'bg-purple-500', linkedLifecycleStage: 'CUSTOMER' },
          { name: 'Negociação', color: 'bg-orange-500', linkedLifecycleStage: 'CUSTOMER' },
          { name: 'Upsell Fechado (Ganho)', color: 'bg-green-500', linkedLifecycleStage: 'CUSTOMER' },
          { name: 'Perdido', color: 'bg-red-500', linkedLifecycleStage: 'OTHER' },
        ],
        strategy: {
          agentPersona: {
            name: 'Closer de Upsell',
            role: 'Expansão / Upgrade',
            behavior:
              'Ofereça o próximo passo certo (mentoria, high ticket, upgrade). Baseie-se em sinais de envolvimento e resultados obtidos.',
          },
          goal: {
            description: 'Gerar receita de expansão (LTV).',
            kpi: 'Expansion MRR',
            targetValue: '15000',
            type: 'currency',
          },
          entryTrigger: 'Alunos saudáveis com sinais de evolução e pedido de “próximo passo”.',
        },
      },
    ],
  },
  B2B_MACHINE: {
    id: 'B2B_MACHINE',
    schemaVersion: '1.0',
    name: 'Máquina de Vendas B2B (Completa)',
    description:
      'O setup ideal para empresas SaaS. Inclui Pré-vendas (SDR), Vendas (Closer), Onboarding, CS (Saúde) e Expansão (Upsell).',
    icon: '🏭',
    boards: [
      {
        slug: 'sdr',
        name: '1. Pré-vendas (SDR)',
        columns: BOARD_TEMPLATES.PRE_SALES.stages.map(s => ({
          name: s.label,
          color: s.color,
          linkedLifecycleStage: s.linkedLifecycleStage,
        })),
        strategy: {
          agentPersona: BOARD_TEMPLATES.PRE_SALES.agentPersona,
          goal: BOARD_TEMPLATES.PRE_SALES.goal,
          entryTrigger: BOARD_TEMPLATES.PRE_SALES.entryTrigger,
        },
      },
      {
        slug: 'sales',
        name: '2. Pipeline de Vendas',
        columns: BOARD_TEMPLATES.SALES.stages.map(s => ({
          name: s.label,
          color: s.color,
          linkedLifecycleStage: s.linkedLifecycleStage,
        })),
        strategy: {
          agentPersona: BOARD_TEMPLATES.SALES.agentPersona,
          goal: BOARD_TEMPLATES.SALES.goal,
          entryTrigger: BOARD_TEMPLATES.SALES.entryTrigger,
        },
      },
      {
        slug: 'onboarding',
        name: '3. Onboarding',
        columns: BOARD_TEMPLATES.ONBOARDING.stages.map(s => ({
          name: s.label,
          color: s.color,
          linkedLifecycleStage: s.linkedLifecycleStage,
        })),
        strategy: {
          agentPersona: BOARD_TEMPLATES.ONBOARDING.agentPersona,
          goal: BOARD_TEMPLATES.ONBOARDING.goal,
          entryTrigger: BOARD_TEMPLATES.ONBOARDING.entryTrigger,
        },
      },
      {
        slug: 'cs',
        name: '4. CS (Saúde da Conta)',
        columns: BOARD_TEMPLATES.CS.stages.map(s => ({
          name: s.label,
          color: s.color,
          linkedLifecycleStage: s.linkedLifecycleStage,
        })),
        strategy: {
          agentPersona: BOARD_TEMPLATES.CS.agentPersona,
          goal: BOARD_TEMPLATES.CS.goal,
          entryTrigger: BOARD_TEMPLATES.CS.entryTrigger,
        },
      },
      {
        slug: 'expansion',
        name: '5. Expansão (Upsell)',
        columns: [
          { name: 'Identificado', color: 'bg-blue-500', linkedLifecycleStage: 'CUSTOMER' },
          { name: 'Qualificando', color: 'bg-yellow-500', linkedLifecycleStage: 'CUSTOMER' },
          { name: 'Proposta', color: 'bg-purple-500', linkedLifecycleStage: 'CUSTOMER' },
          { name: 'Negociação', color: 'bg-orange-500', linkedLifecycleStage: 'CUSTOMER' },
          { name: 'Upsell Fechado', color: 'bg-green-500', linkedLifecycleStage: 'CUSTOMER' },
          { name: 'Perdido', color: 'bg-red-500', linkedLifecycleStage: 'OTHER' },
        ],
        strategy: {
          agentPersona: {
            name: 'Expansion AM',
            role: 'Expansão / Upsell',
            behavior:
              'Trate expansão como venda consultiva para clientes activos. Valide uso/valor, descubra novas dores e construa business case. Seja objectivo e pragmático.',
          },
          goal: {
            description: 'Gerar receita de expansão com previsibilidade.',
            kpi: 'Expansion MRR',
            targetValue: '15000',
            type: 'currency',
          },
          entryTrigger: 'Clientes saudáveis com sinais de expansão (uso alto, novas squads, request de features).',
        },
      },
    ],
  },
  SIMPLE_SALES: {
    id: 'SIMPLE_SALES',
    schemaVersion: '1.0',
    name: 'Funil de Vendas Simples',
    description: 'Perfeito para começar. Um único board focado em fechar negócios rapidamente.',
    icon: '⚡',
    boards: [
      {
        slug: 'sales-simple',
        name: 'Pipeline de Vendas',
        // UX: simplest possible sales pipeline (popular labels).
        columns: [
          { name: 'Novo', color: 'bg-blue-500', linkedLifecycleStage: 'MQL' },
          { name: 'Em conversa', color: 'bg-yellow-500', linkedLifecycleStage: 'PROSPECT' },
          { name: 'Proposta', color: 'bg-purple-500', linkedLifecycleStage: 'PROSPECT' },
          { name: 'Ganho', color: 'bg-green-500', linkedLifecycleStage: 'CUSTOMER' },
          { name: 'Perdido', color: 'bg-red-500', linkedLifecycleStage: 'OTHER' },
        ],
        strategy: {
          agentPersona: BOARD_TEMPLATES.SALES.agentPersona,
          goal: BOARD_TEMPLATES.SALES.goal,
          entryTrigger: BOARD_TEMPLATES.SALES.entryTrigger,
        },
      },
    ],
  },
};
