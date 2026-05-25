/**
 * Processador de chamadas — recebe áudio do Supabase Storage, envia para
 * Gemini 2.5 Flash multimodal, devolve transcript + extracção estruturada
 * (summary, key_points, next_actions, decisions, mentions, sentiment).
 *
 * Output passa por sanitizeCopy/sanitizeCopyObject (zero em-dash garantido).
 */

import { generateObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import { sanitizeCopy, sanitizeCopyObject } from '@/lib/ai/sanitize';

export const CallExtractionSchema = z.object({
  transcript: z.string().describe('Transcrição literal completa da chamada em pt-PT, com mudanças de speaker indicadas como "Consultor:" e "Cliente:" quando claro.'),
  summary: z.string().max(400).describe('Sumário em 2-3 frases curtas, em pt-PT, focado no que importa (decisões, próximos passos, sinais do cliente).'),
  key_points: z.array(z.string()).max(8).describe('3 a 8 pontos-chave em bullets curtas (uma frase cada), pt-PT.'),
  next_actions: z
    .array(
      z.object({
        title: z.string().describe('Acção concreta a fazer, frase curta começando por verbo: "Enviar X", "Marcar Y", "Confirmar Z".'),
        urgency: z.enum(['low', 'medium', 'high']),
        type: z.enum(['CALL', 'MEETING', 'EMAIL', 'TASK', 'WHATSAPP']),
      })
    )
    .max(5)
    .describe('Próximas acções concretas extraídas da chamada, no máximo 5.'),
  decisions: z.array(z.string()).max(8).describe('Decisões tomadas durante a chamada (frases curtas, pt-PT). Vazio se nenhuma.'),
  mentions: z.array(z.string()).max(15).describe('Imóveis, pessoas, valores, datas ou zonas referidos. Vazio se nada relevante.'),
  sentiment: z.enum(['positive', 'neutral', 'concerned', 'blocked']).describe('Estado emocional dominante do cliente.'),
});

export type CallExtraction = z.infer<typeof CallExtractionSchema>;

const SYSTEM_PROMPT = `És um assistente de IA do CRM "Foco Imo" do consultor imobiliário João Fonseca (Porto, Portugal). Recebes a gravação áudio de uma chamada e produzes:

1. TRANSCRIÇÃO LITERAL completa em português europeu (pt-PT, pré-AO 1990). Indica mudanças de orador como "Consultor:" e "Cliente:" sempre que for claro. Não inventes — se não percebes, escreve "[inaudível]".

2. SUMÁRIO em 2-3 frases curtas, focado em decisões, próximos passos, sinais do cliente. Estilo redactor profissional, sem clichés.

3. KEY POINTS: 3-8 pontos curtos (uma frase cada). O essencial para o consultor relembrar daqui a 1 semana.

4. NEXT ACTIONS: 1-5 acções concretas a fazer pelo consultor. Comecem por verbo ("Enviar comparáveis Matosinhos", "Marcar visita Sexta", "Confirmar pré-aprovação"). Cada uma com urgência e tipo de canal.

5. DECISIONS: decisões fechadas durante a chamada (se houver).

6. MENTIONS: imóveis, pessoas, valores, datas, zonas referidos.

7. SENTIMENT: estado emocional do cliente (positive/neutral/concerned/blocked).

REGRAS DE ESCRITA (rigorosas):
- Português europeu pré-AO 1990 (contacto/actual/objectivo).
- NUNCA usar travessões longos (— ou –). Substitui sempre por vírgula, ponto ou dois-pontos.
- 3ª pessoa formal quando o output referencia o cliente em copy.
- Zero clichés imobiliários ("sonho", "paixão", etc.).
- Vocabulário: imóvel, fração, CPCV, IMT, Euribor.`;

export type ProcessCallInput = {
  audioBuffer: Uint8Array;
  audioMime: string;
  durationSeconds?: number;
};

export type ProcessCallOutput = CallExtraction & {
  providerUsed: string;
  ai_model: string;
  ai_duration_ms: number;
};

/**
 * Processa um áudio de chamada. Usa Gemini 2.5 Flash multimodal.
 * Lança em erro — caller decide UPDATE call_recordings com status='failed' + error_message.
 */
export async function processCall(input: ProcessCallInput, googleApiKey: string): Promise<ProcessCallOutput> {
  const startedAt = Date.now();
  const modelId = 'gemini-2.5-flash';

  const google = createGoogleGenerativeAI({ apiKey: googleApiKey });
  const modelInstance = google(modelId);

  const { object } = await generateObject({
    model: modelInstance,
    schema: CallExtractionSchema,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Transcreve e analisa esta chamada conforme o sistema. Devolve JSON estruturado.' },
          {
            type: 'file',
            mediaType: input.audioMime || 'audio/mpeg',
            data: input.audioBuffer,
          },
        ],
      },
    ],
    maxRetries: 1,
  });

  const sanitized = sanitizeCopyObject({
    ...object,
    transcript: sanitizeCopy(object.transcript),
    key_points: object.key_points.map(sanitizeCopy),
    decisions: object.decisions.map(sanitizeCopy),
    next_actions: object.next_actions.map((a) => ({ ...a, title: sanitizeCopy(a.title) })),
  }) as CallExtraction;

  return {
    ...sanitized,
    providerUsed: 'google',
    ai_model: modelId,
    ai_duration_ms: Date.now() - startedAt,
  };
}
