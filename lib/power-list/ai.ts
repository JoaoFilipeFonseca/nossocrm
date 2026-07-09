// BRIEF 2 — Power List. Primeira frase sugerida para cada contacto.
//
// Uma única chamada à IA gera as frases de abertura de todos os itens (eficiente,
// frases distintas). Tom do João: calmo, directo, PT-PT pré-AO 1990, sem clichés,
// sem travessões, sem pontos de exclamação. Se a IA falhar ou não estiver
// configurada, cai num template determinístico por tipo — a lista nunca fica sem
// frases.

import { generateText, Output } from 'ai';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getOrgAIConfig } from '@/lib/ai/agent/agent.service';
import { getModel } from '@/lib/ai/config';
import { sanitizeCopy } from '@/lib/ai/sanitize';
import type { PowerListBucket } from './types';

export interface OpeningLineInput {
  contactName: string;
  source: string | null;
  boardName: string | null;
  bucket: PowerListBucket;
  status: string | null;
  daysIdle: number | null;
}

function firstName(name: string): string {
  const raw = (name || '').trim().split(/\s+/)[0] || '';
  if (!raw) return '';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function boardContext(boardName: string | null): string {
  const b = (boardName || '').toLowerCase();
  if (b.includes('proprie')) return 'sobre o imóvel que tem para vender';
  if (b.includes('arrenda')) return 'sobre o arrendamento';
  if (b.includes('compra')) return 'sobre a procura de casa';
  return 'sobre o que procura';
}

/** Frase determinística (fallback) — personalizada por nome, tipo e contexto. */
export function fallbackOpeningLine(input: OpeningLineInput): string {
  const nome = firstName(input.contactName);
  const saud = nome ? `Bom dia, ${nome}.` : 'Bom dia.';
  const ctx = boardContext(input.boardName);
  switch (input.bucket) {
    case 'lead_nova':
      return `${saud} Fala o João Fonseca. Vi que deixou o seu contacto e queria perceber melhor o que procura ${ctx.replace(/^sobre /, '')}.`;
    case 'followup':
      return `${saud} Fala o João Fonseca. Estou a retomar o nosso contacto para saber como estão as coisas ${ctx}.`;
    default:
      return `${saud} Fala o João Fonseca, da Maia. Já há algum tempo que não falávamos e lembrei-me de si ${ctx}.`;
  }
}

const LinesSchema = z.object({
  lines: z.array(
    z.object({
      i: z.number().describe('Índice do contacto (começa em 0).'),
      line: z.string().max(320).describe('A primeira frase a dizer ao telefone.'),
    }),
  ),
});

const SYSTEM = [
  'És o João Fonseca, consultor imobiliário na Maia. Escreves a primeira frase que ele vai',
  'dizer ao telefone a cada contacto da sua lista de chamadas do dia.',
  'Regras de voz: português de Portugal pré-Acordo Ortográfico de 1990; tom calmo, directo,',
  'humano e seguro; nada de clichés de vendedor; nada de travessões nem de pontos de exclamação;',
  'sem promessas nem preços. Começa sempre por cumprimentar pelo primeiro nome e identificar-se',
  '("Fala o João Fonseca"). Uma só frase (ou duas curtas) por contacto, natural para dizer em voz alta.',
  'Adapta ao contexto de cada um (origem, tipo de negócio, há quanto tempo sem falar).',
].join(' ');

/**
 * Gera as frases de abertura para todos os itens numa só chamada.
 * Devolve um array alinhado por índice com o input. Nunca lança — em erro usa fallback.
 */
export async function generateOpeningLines(
  supabase: SupabaseClient,
  organizationId: string,
  inputs: OpeningLineInput[],
): Promise<string[]> {
  if (inputs.length === 0) return [];
  const fallback = inputs.map(fallbackOpeningLine);

  try {
    const config = await getOrgAIConfig(supabase, organizationId);
    if (!config || !config.enabled || !config.apiKey) return fallback;

    const model = getModel(config.provider, config.apiKey, config.model);
    const list = inputs
      .map((it, i) => {
        const parts = [
          `#${i}`,
          `nome: ${it.contactName}`,
          `origem: ${it.source || 'desconhecida'}`,
          `negócio: ${it.boardName || 'n/d'}`,
          `tipo: ${it.bucket}`,
        ];
        if (it.daysIdle != null) parts.push(`dias sem falar: ${it.daysIdle}`);
        return parts.join(' · ');
      })
      .join('\n');

    const prompt = [
      'Gera a primeira frase para cada um destes contactos. Devolve um item por contacto,',
      'com o índice "i" correspondente. Contactos:',
      '',
      list,
    ].join('\n');

    const { output } = await generateText({
      model,
      system: SYSTEM,
      prompt,
      maxRetries: 1,
      output: Output.object({ schema: LinesSchema }),
    });

    const parsed = (output as z.infer<typeof LinesSchema> | undefined)?.lines ?? [];
    const byIndex = new Map<number, string>();
    for (const row of parsed) {
      const clean = sanitizeCopy(String(row.line || '')).trim();
      if (clean) byIndex.set(row.i, clean);
    }
    return inputs.map((_, i) => byIndex.get(i) || fallback[i]);
  } catch (err) {
    console.warn('[power-list] IA falhou, uso frases determinísticas:', (err as Error)?.message);
    return fallback;
  }
}
