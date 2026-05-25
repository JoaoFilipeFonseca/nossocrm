/**
 * Processa voice input directamente do Next API (síncrono).
 * Gemini 2.5 Flash + File API. Transcrição + classificação intent + entity creation.
 *
 * Para áudios curtos (<60s) o processamento total é ~15-30s, cabe no Vercel timeout.
 * Para chamadas longas usar a Edge Function process-call.
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { sanitizeCopy } from '@/lib/ai/sanitize';

const VoiceExtractionSchema = z.object({
  transcript: z.string(),
  intent: z.enum(['task', 'note', 'lead', 'call_recording', 'unknown']),
  intent_confidence: z.number().min(0).max(1),
  summary: z.string(),
  contact_name: z.string().optional().default(''),
  contact_phone: z.string().optional().default(''),
  contact_email: z.string().optional().default(''),
  task_title: z.string().optional().default(''),
  task_due_at: z.string().optional().default(''),
  task_channel: z.enum(['CALL', 'WHATSAPP', 'EMAIL', 'MEETING', 'TASK']).optional(),
  property_description: z.string().optional().default(''),
  property_budget: z.string().optional().default(''),
  note_content: z.string().optional().default(''),
});

export type VoiceExtraction = z.infer<typeof VoiceExtractionSchema>;

const SYSTEM_PROMPT = `És um assistente IA do CRM Foco Imo do consultor imobiliário João Fonseca (Norte de Portugal). Recebes um áudio curto (voice input) onde o consultor dita rapidamente. Decides o intent e extrais dados.

INTENTS:
- 'task': pedido de tarefa/lembrete/agendamento ("lembra-me ligar à Sónia quinta", "marcar reunião com X")
- 'note': nota livre ("acabei de falar com Bruno, vai mandar caderneta sexta")
- 'lead': contacto novo ("novo lead Manuel 912345678 procura T3 350k")
- 'call_recording': descrição de chamada que acabou de fazer
- 'unknown': não conseguiste classificar

Para task_due_at: interpreta datas relativas em Europe/Lisbon. Hoje = ${new Date().toISOString()}. Devolve ISO datetime ou string vazia.

REGRAS pt-PT pré-AO 1990 (contacto/actual/objectivo). NUNCA travessões longos.`;

export type ProcessVoiceInput = {
  audioBuffer: Uint8Array;
  audioMime: string;
  contextHint?: string | null;
  googleApiKey: string;
};

export async function processVoice(input: ProcessVoiceInput): Promise<VoiceExtraction & { ai_duration_ms: number }> {
  const started = Date.now();
  const google = createGoogleGenerativeAI({ apiKey: input.googleApiKey });
  const model = google('gemini-2.5-flash');

  const userText = input.contextHint
    ? `Contexto actual no CRM: ${input.contextHint}. Analisa este áudio.`
    : 'Analisa este áudio.';

  const { object } = await generateObject({
    model,
    schema: VoiceExtractionSchema,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: userText },
          { type: 'file', mediaType: input.audioMime, data: input.audioBuffer },
        ],
      },
    ],
    maxRetries: 1,
  });

  return {
    ...object,
    transcript: sanitizeCopy(object.transcript),
    summary: sanitizeCopy(object.summary),
    task_title: sanitizeCopy(object.task_title || ''),
    note_content: sanitizeCopy(object.note_content || ''),
    ai_duration_ms: Date.now() - started,
  };
}

/**
 * Cria a entity (deal_activity, contact) com base na extracção.
 * Devolve descritor da entity criada para guardar em voice_captures.entity_created.
 */
export async function createEntityFromVoice(
  supabase: any,
  orgId: string,
  extraction: VoiceExtraction,
): Promise<any> {
  const intent = extraction.intent;

  if (intent === 'task' || intent === 'note') {
    // Tenta ligar a um contacto/deal existente
    const term = extraction.contact_name?.trim();
    if (!term) {
      return { kind: 'unmatched', summary: extraction.summary, reason: 'Nenhum contacto identificado' };
    }
    const firstWord = term.split(/\s+/)[0];
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, name')
      .eq('organization_id', orgId)
      .ilike('name', `%${firstWord}%`)
      .limit(5);

    if (!contacts || contacts.length === 0) {
      return { kind: 'unmatched', summary: extraction.summary, reason: `Contacto "${term}" não encontrado` };
    }
    const exact = contacts.find((c: any) => c.name?.toLowerCase() === term.toLowerCase());
    const chosen = exact || contacts[0];
    const { data: deals } = await supabase
      .from('deals')
      .select('id')
      .eq('organization_id', orgId)
      .eq('contact_id', chosen.id)
      .is('archived_at', null)
      .limit(1);

    const dealId = deals?.[0]?.id || null;
    if (!dealId) {
      return { kind: 'unmatched', summary: extraction.summary, reason: `${chosen.name} não tem negócio aberto` };
    }

    const desc = intent === 'task'
      ? `🎯 ${extraction.task_title || extraction.summary}${extraction.task_due_at ? ` (${extraction.task_due_at})` : ''}`
      : `📝 ${extraction.note_content || extraction.summary}`;

    const { data: act } = await supabase
      .from('deal_activities')
      .insert({
        deal_id: dealId,
        organization_id: orgId,
        type: intent === 'task' ? 'TASK' : 'NOTE',
        description: desc,
        metadata: {
          source: 'voice',
          transcript: extraction.transcript,
          task_due_at: extraction.task_due_at,
          task_channel: extraction.task_channel,
        },
      })
      .select('id')
      .single();

    return {
      kind: 'deal_activity',
      id: act?.id,
      deal_id: dealId,
      contact_id: chosen.id,
      contact_name: chosen.name,
      summary: extraction.summary,
    };
  }

  if (intent === 'lead') {
    const insertObj: any = {
      organization_id: orgId,
      name: extraction.contact_name || 'Lead sem nome',
    };
    if (extraction.contact_phone) insertObj.phone = extraction.contact_phone;
    if (extraction.contact_email) insertObj.email = extraction.contact_email;
    if (extraction.property_description || extraction.property_budget) {
      insertObj.notes = `Procura: ${extraction.property_description || ''}${extraction.property_budget ? ` | Orçamento: ${extraction.property_budget}` : ''}`.trim();
    }
    const { data: contact, error } = await supabase
      .from('contacts')
      .insert(insertObj)
      .select('id, name')
      .single();
    if (error) return { kind: 'error', error: error.message };
    return { kind: 'contact', id: contact.id, name: contact.name, summary: extraction.summary };
  }

  return { kind: 'unknown', summary: extraction.summary };
}
