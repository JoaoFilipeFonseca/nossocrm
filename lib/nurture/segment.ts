// BRIEF 7 / 7b — Refinamento de segmentação por IA.
//
// O alicerce é determinístico (RPC nurture_segment_base, cobre 100%). Este módulo
// deixa a IA rever um lote de contactos com base no histórico e sugerir o segmento
// + um racional em linguagem natural. Nunca lança: em erro ou sem IA, mantém o
// segmento actual. O João corrige por cima na UI.

import { generateText, Output } from 'ai';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getOrgAIConfig } from '@/lib/ai/agent/agent.service';
import { getModel } from '@/lib/ai/config';
import { sanitizeCopy } from '@/lib/ai/sanitize';
import { SEGMENTS, isSegment, type Segment } from './segments';

export interface SegmentContext {
  id: string;
  name: string;
  source: string | null;
  boards: string[];
  hasWon: boolean;
  notes: string | null;
  daysSinceCreated: number | null;
  current: Segment | null;
}

export interface SegmentSuggestion {
  segment: Segment;
  rationale: string;
}

const SuggestionSchema = z.object({
  suggestions: z.array(
    z.object({
      i: z.number().describe('Índice do contacto (começa em 0).'),
      segment: z.enum(SEGMENTS),
      rationale: z.string().max(240).describe('Uma frase curta a justificar, PT-PT.'),
    }),
  ),
});

const SYSTEM = [
  'És um analista de CRM imobiliário na Maia. Classificas cada contacto num de cinco segmentos,',
  'a partir do histórico real (funil onde está o negócio, origem, se já fechou negócio, notas).',
  'Segmentos:',
  '- proprietario_vendedor: tem imóvel ou pondera vender (funil Proprietários, calculadora, base de proprietários, FSBO).',
  '- comprador: procura casa para comprar ou arrendar (funil Compradores ou Arrendamento).',
  '- ex_cliente: já fechou negócio.',
  '- referenciador: contacto de rede ou parceria, gera recomendações.',
  '- curioso: sem intenção clara.',
  'Regras: escolhe sempre um dos cinco slugs exactos. O racional é uma frase curta em português de',
  'Portugal pré-Acordo Ortográfico de 1990, sem travessões nem pontos de exclamação. Não inventes',
  'factos que não estejam nos dados.',
].join('\n');

const CHUNK = 25;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Refina a segmentação de um lote por IA. Devolve um mapa id → sugestão apenas
 * para os contactos que a IA classificou. Nunca lança.
 */
export async function refineSegmentsWithAI(
  supabase: SupabaseClient,
  organizationId: string,
  items: SegmentContext[],
): Promise<Map<string, SegmentSuggestion>> {
  const result = new Map<string, SegmentSuggestion>();
  if (items.length === 0) return result;

  let config;
  try {
    config = await getOrgAIConfig(supabase, organizationId);
  } catch {
    return result;
  }
  if (!config || !config.enabled || !config.apiKey) return result;
  const model = getModel(config.provider, config.apiKey, config.model);

  for (const group of chunk(items, CHUNK)) {
    try {
      const list = group
        .map((it, i) => {
          const parts = [
            `#${i}`,
            `nome: ${it.name || 'sem nome'}`,
            `origem: ${it.source || 'desconhecida'}`,
            `funil: ${it.boards.length ? it.boards.join(', ') : 'nenhum'}`,
            `fechou negocio: ${it.hasWon ? 'sim' : 'nao'}`,
          ];
          if (it.daysSinceCreated != null) parts.push(`dias na base: ${it.daysSinceCreated}`);
          if (it.notes) parts.push(`notas: ${it.notes.slice(0, 160)}`);
          return parts.join(' · ');
        })
        .join('\n');

      const { output } = await generateText({
        model,
        system: SYSTEM,
        prompt: `Classifica cada contacto. Devolve um item por contacto com o índice "i" respectivo.\n\n${list}`,
        maxRetries: 1,
        output: Output.object({ schema: SuggestionSchema }),
      });

      const parsed = (output as z.infer<typeof SuggestionSchema> | undefined)?.suggestions ?? [];
      for (const row of parsed) {
        const it = group[row.i];
        if (!it || !isSegment(row.segment)) continue;
        const rationale = sanitizeCopy(String(row.rationale || '')).trim();
        result.set(it.id, { segment: row.segment, rationale: rationale || 'Sugerido pela análise do histórico.' });
      }
    } catch (err) {
      console.warn('[nurture] refinamento IA falhou num lote:', (err as Error)?.message);
      // mantém o determinístico deste lote
    }
  }

  return result;
}
