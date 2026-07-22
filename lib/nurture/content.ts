// BRIEF 7 / 7b — Gerador de conteúdo das ondas de nurture.
//
// Por segmento, uma sequência de toques (2-3 passos). Cada email é personalizado
// (primeiro nome + contexto do histórico) e escrito no tom da marca João Fonseca:
// PT-PT pré-Acordo Ortográfico de 1990, calmo e directo, sem travessões nem
// pontos de exclamação, sem preços nem promessas, marca pessoal (sem agência).
//
// A IA escreve; se falhar ou não estiver configurada, cai num template
// determinístico por segmento (a fila nunca fica vazia). O rodapé RGPD
// (anular subscrição + política) é acrescentado no ENVIO, não aqui.

import { generateText, Output } from 'ai';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getOrgAIConfig } from '@/lib/ai/agent/agent.service';
import { getModel } from '@/lib/ai/config';
import { sanitizeCopy } from '@/lib/ai/sanitize';
import { SEGMENT_LABELS, type Segment } from './segments';

export const NURTURE_SIGNATURE = 'João Fonseca\nConsultor Imobiliário · Maia';

export interface NurtureContext {
  contactId: string;
  dealId: string | null;
  name: string;
  email: string;
  source: string | null;
  boardName: string | null;
  segment: Segment;
  daysSinceCreated: number | null;
}

export interface NurtureDraft {
  contactId: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  generatedBy: 'ai' | 'fallback';
}

/** Ângulo de cada passo por segmento. Passo 1 = primeira onda de reactivação. */
interface StepBrief {
  subjectHint: string;
  angle: string;
}

const WAVE_STEPS: Record<Segment, StepBrief[]> = {
  proprietario_vendedor: [
    {
      subjectHint: 'O valor da sua casa na Maia',
      angle:
        'Reaproximação a um proprietário. O mercado da Maia tem mexido. Oferece uma Análise Comparativa de Mercado feita por si, com dados reais da zona (nunca um número de algoritmo), gratuita e sem compromisso. Convida a responder quando lhe for oportuno.',
    },
    {
      subjectHint: 'Como está o mercado na sua zona',
      angle:
        'Segundo toque. Partilha uma leitura curta do que se passa na freguesia dele (procura, tempo médio de venda) e reforça a disponibilidade para a Análise de Mercado.',
    },
    {
      subjectHint: 'Continuo à disposição',
      angle:
        'Terceiro toque, leve. Relembra que está por perto para quando decidir avançar, sem pressão.',
    },
  ],
  comprador: [
    {
      subjectHint: 'Continua à procura de casa na Maia',
      angle:
        'Reaproximação a quem procura casa. Pergunta se ainda anda à procura e oferece ajuda para não deixar escapar a casa certa (novidades, apoio ao processo). Convida a dizer o que procura.',
    },
    {
      subjectHint: 'O que entrou de novo',
      angle:
        'Segundo toque. Oferece manter-se atento a novidades que encaixem no que ele procura e apoio no financiamento e na negociação.',
    },
    {
      subjectHint: 'Aqui para o ajudar',
      angle: 'Terceiro toque, leve. Fica disponível para quando quiser retomar a procura.',
    },
  ],
  ex_cliente: [
    {
      subjectHint: 'Um olá da minha parte',
      angle:
        'Reaproximação a um ex-cliente. Um olá simples, agradece a confiança e deixa a porta aberta para o que precisar ou para quem conheça que pense em comprar ou vender na Maia.',
    },
    {
      subjectHint: 'Se precisar, é só dizer',
      angle: 'Segundo toque. Reforça a disponibilidade e o valor de uma recomendação.',
    },
  ],
  referenciador: [
    {
      subjectHint: 'Um obrigado e um pedido',
      angle:
        'Contacto de rede. Agradece a relação e faz um pedido simples: se alguém à volta dele pensa em vender ou comprar na Maia, que o apresente. Sem pressão.',
    },
    {
      subjectHint: 'Continuamos em contacto',
      angle: 'Segundo toque, leve. Mantém a relação viva e a porta aberta.',
    },
  ],
  curioso: [
    {
      subjectHint: 'O mercado da Maia, sem compromisso',
      angle:
        'Contacto morno. Partilha que está disponível para ajudar quando fizer sentido, sem pressão, e que pode dar uma leitura do mercado da Maia se quiser.',
    },
    {
      subjectHint: 'Quando fizer sentido',
      angle: 'Segundo toque, leve. Fica à disposição para o futuro.',
    },
  ],
};

export function waveSteps(segment: Segment): number {
  return WAVE_STEPS[segment]?.length ?? 1;
}

function stepBrief(segment: Segment, step: number): StepBrief {
  const steps = WAVE_STEPS[segment] ?? WAVE_STEPS.curioso;
  return steps[Math.min(Math.max(1, step), steps.length) - 1];
}

function firstName(name: string): string {
  const raw = (name || '').trim().split(/\s+/)[0] || '';
  if (!raw) return '';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** Envolve o corpo em texto HTML simples com a marca (teal). Sem rodapé RGPD. */
export function renderNurtureHtml(bodyText: string): string {
  const paragraphs = bodyText
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 16px;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');
  return (
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#0f172a;max-width:560px;margin:0 auto;">` +
    `<div style="border-top:3px solid #0f766e;padding-top:18px;">` +
    paragraphs +
    `</div>` +
    `</div>`
  );
}

/** Template determinístico (fallback) por segmento — personalizado por nome. */
export function fallbackDraft(ctx: NurtureContext, step: number): { subject: string; bodyText: string } {
  const nome = firstName(ctx.name);
  const saud = nome ? `Bom dia, ${nome}.` : 'Bom dia.';
  const brief = stepBrief(ctx.segment, step);
  let corpo: string;
  switch (ctx.segment) {
    case 'proprietario_vendedor':
      corpo =
        'Fala o João Fonseca, consultor imobiliário na Maia. O mercado da sua zona tem mexido e lembrei-me de si. Se anda a pensar no valor da sua casa, posso preparar-lhe uma Análise de Mercado a sério, com dados reais da Maia e da sua freguesia. É gratuita e sem compromisso. Quando lhe for oportuno, diga-me e trato disso.';
      break;
    case 'comprador':
      corpo =
        'Fala o João Fonseca, consultor imobiliário na Maia. Queria saber se ainda anda à procura de casa. Se sim, posso ajudar a não deixar escapar a certa, com as novidades da zona e apoio no processo. Diga-me o que procura e vejo o que consigo fazer por si.';
      break;
    case 'ex_cliente':
      corpo =
        'Fala o João Fonseca, da Maia. Passou algum tempo e queria deixar-lhe um olá. Obrigado pela confiança de outrora. Fico à disposição para o que precisar, ou para quem conheça que pense em comprar ou vender na Maia.';
      break;
    case 'referenciador':
      corpo =
        'Fala o João Fonseca, consultor imobiliário na Maia. Um obrigado pela nossa relação. Se alguém à sua volta pensar em vender ou comprar casa na Maia, ficaria muito grato que me apresentasse. Estou cá para ajudar quem precisar.';
      break;
    default:
      corpo =
        'Fala o João Fonseca, consultor imobiliário na Maia. Fico à disposição para o ajudar quando fizer sentido, sem qualquer pressão. Se quiser, posso dar-lhe uma leitura de como está o mercado da Maia.';
      break;
  }
  return {
    subject: brief.subjectHint,
    bodyText: `${saud}\n\n${corpo}\n\n${NURTURE_SIGNATURE}`,
  };
}

const DraftSchema = z.object({
  drafts: z.array(
    z.object({
      i: z.number().describe('Índice do contacto (começa em 0).'),
      subject: z.string().max(90).describe('Assunto curto, humano, sem exclamações.'),
      body: z.string().max(1400).describe('Corpo do email, 2 a 4 parágrafos, sem rodapé nem assinatura.'),
    }),
  ),
});

function systemPrompt(): string {
  return [
    'És o João Fonseca, consultor imobiliário na Maia. Escreves emails curtos e humanos para',
    'a tua base de contactos, um por pessoa, para reatar a relação e oferecer ajuda.',
    'Voz: português de Portugal pré-Acordo Ortográfico de 1990; calmo, directo, próximo e seguro;',
    'nada de clichés de vendedor; NUNCA travessões nem pontos de exclamação; sem preços, sem promessas,',
    'sem inventar factos. Marca pessoal: assinas como João Fonseca, não menciones agência nem AMI.',
    'Cada email começa por cumprimentar pelo primeiro nome. Dois a quatro parágrafos curtos.',
    'NÃO incluas assinatura nem rodapé (são acrescentados depois). Personaliza ao contexto de cada',
    'contacto. A oferta central para proprietários é a Análise de Mercado (nunca a palavra "avaliação").',
  ].join(' ');
}

/**
 * Gera os rascunhos de um passo da onda para um conjunto de contactos.
 * Uma chamada IA por lote; devolve alinhado por contacto. Nunca lança.
 */
export async function generateNurtureDrafts(
  supabase: SupabaseClient,
  organizationId: string,
  contexts: NurtureContext[],
  step: number,
): Promise<NurtureDraft[]> {
  const fallbacks: NurtureDraft[] = contexts.map((ctx) => {
    const f = fallbackDraft(ctx, step);
    return {
      contactId: ctx.contactId,
      subject: sanitizeCopy(f.subject),
      bodyText: sanitizeCopy(f.bodyText),
      bodyHtml: renderNurtureHtml(sanitizeCopy(f.bodyText)),
      generatedBy: 'fallback',
    };
  });

  if (contexts.length === 0) return fallbacks;

  let config;
  try {
    config = await getOrgAIConfig(supabase, organizationId);
  } catch {
    return fallbacks;
  }
  if (!config || !config.enabled || !config.apiKey) return fallbacks;
  const model = getModel(config.provider, config.apiKey, config.model);

  const byIndex = new Map<number, { subject: string; body: string }>();
  const CHUNK = 8;
  for (let start = 0; start < contexts.length; start += CHUNK) {
    const group = contexts.slice(start, start + CHUNK);
    try {
      const list = group
        .map((ctx, gi) => {
          const brief = stepBrief(ctx.segment, step);
          const parts = [
            `#${start + gi}`,
            `nome: ${ctx.name || 'sem nome'}`,
            `segmento: ${SEGMENT_LABELS[ctx.segment]}`,
            `origem: ${ctx.source || 'desconhecida'}`,
            `funil: ${ctx.boardName || 'n/d'}`,
            `angulo deste email: ${brief.angle}`,
          ];
          if (ctx.daysSinceCreated != null) parts.push(`dias na base: ${ctx.daysSinceCreated}`);
          return parts.join(' · ');
        })
        .join('\n');

      const { output } = await generateText({
        model,
        system: systemPrompt(),
        prompt: `Escreve um email para cada contacto. Devolve um item por contacto com o índice "i" respectivo.\n\n${list}`,
        maxRetries: 1,
        output: Output.object({ schema: DraftSchema }),
      });

      const parsed = (output as z.infer<typeof DraftSchema> | undefined)?.drafts ?? [];
      for (const row of parsed) {
        const subject = sanitizeCopy(String(row.subject || '')).trim();
        const body = sanitizeCopy(String(row.body || '')).trim();
        if (subject && body) byIndex.set(row.i, { subject, body });
      }
    } catch (err) {
      console.warn('[nurture] geração IA falhou num lote:', (err as Error)?.message);
    }
  }

  return contexts.map((ctx, i) => {
    const ai = byIndex.get(i);
    if (!ai) return fallbacks[i];
    const bodyText = `${ai.body}\n\n${NURTURE_SIGNATURE}`;
    return {
      contactId: ctx.contactId,
      subject: ai.subject,
      bodyText,
      bodyHtml: renderNurtureHtml(bodyText),
      generatedBy: 'ai' as const,
    };
  });
}
