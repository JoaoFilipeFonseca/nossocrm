// BRIEF 7 / 7b — Gerador de conteúdo das ondas de nurture.
//
// Por segmento, uma sequência de toques (2-3 passos). Cada email é personalizado
// (primeiro nome + contexto do histórico, incluindo o imóvel que gerou a lead) e
// escrito no tom da marca João Fonseca: PT-PT pré-Acordo Ortográfico de 1990,
// calmo e directo, sem travessões nem pontos de exclamação, sem preços nem
// promessas, marca pessoal (sem agência). Com certeza (nada de "penso que").
//
// A IA escreve; se falhar ou não estiver configurada, cai num template
// determinístico por segmento (a fila nunca fica vazia). O email sai na marca
// (Verde Fonseca) com o slogan "Para a vida que vais viver." em destaque e o
// cartão de visita. O rodapé RGPD (anular subscrição + política) é acrescentado
// no ENVIO, não aqui.

import { generateText, Output } from 'ai';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getOrgAIConfig } from '@/lib/ai/agent/agent.service';
import { getModel } from '@/lib/ai/config';
import { sanitizeCopy } from '@/lib/ai/sanitize';
import { SEGMENT_LABELS, type Segment } from './segments';

export const NURTURE_SIGNATURE = 'João Fonseca\nConsultor Imobiliário · Maia';
export const NURTURE_TAGLINE = 'Para a vida que vais viver.';
export const CARTAO_URL = 'https://joaofilipefonseca.pt/cartao';

// Marca Verde Fonseca (cores retiradas do cartão /cartao).
const FOREST = '#1B3A2F';
const SAGE = '#7BAE92';
const CREAM = '#F7F5F0';
const BORDER = '#E8E5DD';
const INK = '#22221f';
const MUTED = '#5C5C58';

export interface NurtureImovel {
  tipologia?: string | null;
  freguesia?: string | null;
  area?: number | null;
}

export interface NurtureContext {
  contactId: string;
  dealId: string | null;
  name: string;
  email: string;
  source: string | null;
  boardName: string | null;
  segment: Segment;
  daysSinceCreated: number | null;
  imovel?: NurtureImovel | null;
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
        'Reaproximação a quem procura casa. Recorda concretamente o que ele procurava (tipologia e zona, se souberes) e pergunta se mantém essa procura. Oferece ajuda para não deixar escapar a casa certa. Convida a dizer o que procura hoje.',
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
        'Reaproximação a um ex-cliente. Um olá simples, agradece a confiança e deixa a porta aberta para o que precisar ou para quem conheça.',
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

/** Descreve o imóvel que gerou a lead, de forma legível (ou vazio). */
export function imovelPhrase(imovel: NurtureImovel | null | undefined): string {
  if (!imovel) return '';
  const tip = (imovel.tipologia || '').trim();
  const fre = (imovel.freguesia || '').trim();
  if (tip && fre) return `${tip} em ${fre}`;
  if (tip) return tip;
  if (fre) return `imóvel em ${fre}`;
  return '';
}

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Email da marca (Verde Fonseca): cabeçalho, slogan em destaque, corpo, cartão
 * de visita e assinatura. Recebe o corpo em texto (que pode terminar com a
 * assinatura padrão, que é removida para não duplicar). Fragmento auto-contido;
 * o rodapé RGPD é acrescentado depois, no envio.
 */
export function renderNurtureHtml(bodyText: string): string {
  // Retira a assinatura padrão do fim do corpo (a marca já a apresenta em baixo).
  let main = (bodyText || '').trim();
  const sigIdx = main.lastIndexOf('João Fonseca');
  if (sigIdx > 0 && main.slice(sigIdx).replace(/\s+/g, ' ').trim().length < 60) {
    main = main.slice(0, sigIdx).trim();
  }

  const paragraphs = main
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.7;color:${INK};">${esc(
          p,
        ).replace(/\n/g, '<br/>')}</p>`,
    )
    .join('');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid ${BORDER};border-radius:14px;overflow:hidden;">
      <tr>
        <td style="background:${FOREST};padding:26px 30px;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.3px;">João Fonseca</div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${SAGE};text-transform:uppercase;letter-spacing:2px;margin-top:3px;">Consultor Imobiliário · Maia</div>
        </td>
      </tr>
      <tr>
        <td style="background:${CREAM};padding:16px 30px;border-bottom:1px solid ${BORDER};">
          <div style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:18px;color:${FOREST};letter-spacing:0.2px;">${esc(NURTURE_TAGLINE)}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 30px 8px;">
          ${paragraphs}
        </td>
      </tr>
      <tr>
        <td style="padding:6px 30px 4px;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:16px;color:${INK};">João Fonseca</div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${MUTED};margin-top:2px;">Consultor Imobiliário · Maia</div>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 30px 30px;">
          <a href="${CARTAO_URL}" style="display:inline-block;background:${FOREST};color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;text-decoration:none;padding:11px 22px;border-radius:8px;">O meu cartão de visita</a>
        </td>
      </tr>
    </table>
  </td></tr>
</table>`;
}

/** Template determinístico (fallback) por segmento, personalizado por nome e imóvel. */
export function fallbackDraft(ctx: NurtureContext, step: number): { subject: string; bodyText: string } {
  const nome = firstName(ctx.name);
  const saud = nome ? `Olá ${nome}.` : 'Olá.';
  const brief = stepBrief(ctx.segment, step);
  const imv = imovelPhrase(ctx.imovel);
  let corpo: string;
  switch (ctx.segment) {
    case 'proprietario_vendedor':
      corpo =
        `Fala o João Fonseca, consultor imobiliário na Maia. ` +
        (imv
          ? `Da última vez que falámos, o tema era o seu ${imv}. `
          : 'O mercado da sua zona tem mexido e lembrei-me de si. ') +
        'Se anda a pensar no valor da sua casa, posso preparar-lhe uma Análise de Mercado a sério, com dados reais da Maia e da sua freguesia. É gratuita e sem compromisso. Quando lhe for oportuno, diga-me e trato disso.';
      break;
    case 'comprador':
      corpo =
        `Fala o João Fonseca, consultor imobiliário na Maia. ` +
        (imv
          ? `Da última vez que falámos, procurava um ${imv}. Queria saber se mantém essa procura. `
          : 'Queria saber se ainda anda à procura de casa. ') +
        'Se sim, posso ajudar a não deixar escapar a certa, com as novidades da zona e apoio no processo. Diga-me o que procura hoje e vejo o que consigo fazer por si.';
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
    'ESCREVE COM CERTEZA. Se te derem o imóvel ou a zona que gerou o contacto, refere-o de forma',
    'concreta ("Da última vez que falámos, o tema era um T2 na Cidade da Maia"). NÃO uses palavras de',
    'incerteza como "penso", "julgo", "acho" ou "se não me engano". Se não houver dados do imóvel, fala',
    'da procura ou da zona em geral, sem inventar.',
    'Cada email começa por cumprimentar pelo primeiro nome. Dois a quatro parágrafos curtos.',
    'NÃO incluas assinatura, slogan nem rodapé (a marca acrescenta-os depois). Personaliza a cada',
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
          const imv = imovelPhrase(ctx.imovel);
          const parts = [
            `#${start + gi}`,
            `nome: ${ctx.name || 'sem nome'}`,
            `segmento: ${SEGMENT_LABELS[ctx.segment]}`,
            `origem: ${ctx.source || 'desconhecida'}`,
            `funil: ${ctx.boardName || 'n/d'}`,
          ];
          if (imv) parts.push(`imovel que gerou o contacto: ${imv}`);
          parts.push(`angulo deste email: ${brief.angle}`);
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
