/**
 * Sprint 29 c1 — extracao IA a partir de transcript ja feito (ex: export Notta).
 *
 * Recebe texto cru (transcript ja transcrito noutra ferramenta), pede a Gemini
 * para extrair summary + key_points + next_actions + decisions + mentions +
 * sentiment. Nao re-transcreve. Custo IA reduzido vs processamento de audio.
 *
 * Output sanitizado (zero em-dashes garantido). Pt-PT pre-AO 1990.
 */

import { generateObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import { sanitizeCopy, sanitizeCopyObject } from '@/lib/ai/sanitize';

export const CallTextExtractionSchema = z.object({
  summary: z.string().max(400).describe('Sumario em 2-3 frases curtas focado em decisoes e proximos passos. Pt-PT.'),
  key_points: z.array(z.string()).max(8).describe('3 a 8 pontos curtos (uma frase cada). Pt-PT.'),
  next_actions: z
    .array(
      z.object({
        title: z.string().describe('Accao concreta comecando por verbo: "Enviar X", "Marcar Y".'),
        urgency: z.enum(['low', 'medium', 'high']),
        type: z.enum(['CALL', 'MEETING', 'EMAIL', 'TASK', 'WHATSAPP']),
      })
    )
    .max(5)
    .describe('Proximas accoes concretas. Maximo 5.'),
  decisions: z.array(z.string()).max(8).describe('Decisoes fechadas. Vazio se nenhuma.'),
  mentions: z.array(z.string()).max(15).describe('Imoveis, pessoas, valores, datas, zonas referidos. Vazio se nada.'),
  sentiment: z.enum(['positive', 'neutral', 'concerned', 'blocked']).describe('Estado emocional dominante do cliente.'),
});

export type CallTextExtraction = z.infer<typeof CallTextExtractionSchema>;

const SYSTEM_PROMPT = `Es assistente de IA do CRM Foco Imo do consultor imobiliario Joao Fonseca (Porto). Recebes o transcript ja transcrito de uma chamada com cliente e extrais JSON estruturado.

Output:
1. summary: 2-3 frases curtas focadas em decisoes e proximos passos. Estilo redactor profissional.
2. key_points: 3-8 pontos curtos (uma frase cada). Essencial para relembrar daqui a 1 semana.
3. next_actions: 1-5 accoes concretas a fazer pelo consultor. Comecem por verbo. Cada uma com urgencia e canal.
4. decisions: decisoes fechadas na chamada.
5. mentions: imoveis, valores, datas, zonas, pessoas referidos.
6. sentiment: estado emocional dominante.

REGRAS DE ESCRITA (rigorosas):
- Portugues europeu pre-AO 1990 (contacto/actual/objectivo/projecto/optimo/exacto).
- NUNCA usar travessoes longos (— ou –). Substituir por virgula, ponto ou dois-pontos.
- 3a pessoa formal quando referenciar o cliente em copy.
- Zero cliches imobiliarios (sonho/paixao/etc).
- Vocabulario: imovel, fraccao, CPCV, IMT, Euribor.`;

export type ProcessCallTextOutput = CallTextExtraction & {
  providerUsed: string;
  ai_model: string;
  ai_duration_ms: number;
};

export async function processCallText(
  transcript: string,
  googleApiKey: string,
): Promise<ProcessCallTextOutput> {
  const startedAt = Date.now();
  const modelId = 'gemini-2.5-flash';

  const google = createGoogleGenerativeAI({ apiKey: googleApiKey });
  const modelInstance = google(modelId);

  const truncated = transcript.length > 60000 ? transcript.slice(0, 60000) + '\n[...truncado...]' : transcript;

  const { object } = await generateObject({
    model: modelInstance,
    schema: CallTextExtractionSchema,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Transcript da chamada (entre tags):\n\n<transcript>\n${truncated}\n</transcript>\n\nExtrai conforme o sistema e devolve JSON estruturado.`,
      },
    ],
    maxRetries: 1,
  });

  const sanitized = sanitizeCopyObject({
    ...object,
    key_points: object.key_points.map(sanitizeCopy),
    decisions: object.decisions.map(sanitizeCopy),
    mentions: object.mentions.map(sanitizeCopy),
    next_actions: object.next_actions.map((a) => ({ ...a, title: sanitizeCopy(a.title) })),
  }) as CallTextExtraction;

  return {
    ...sanitized,
    providerUsed: 'google',
    ai_model: modelId,
    ai_duration_ms: Date.now() - startedAt,
  };
}
