// Streaming variant of /api/ai/actions, focused inicialmente em rewriteMessageDraft.
// Devolve text/plain stream (não JSON) — frontend vai apendendo chunks à textarea
// para UX percebida "instantânea" (1ª palavra ~1s, completa em ~8s real).
//
// Convenção do output do LLM (para parser client tolerante):
//   EMAIL    → "ASSUNTO: <linha>\n\n<corpo multi-linha>"
//   WHATSAPP → corpo directo (sem ASSUNTO)
//
// Fallback Anthropic activo em erro Gemini (não em timeout de 1ª chunk para evitar
// dupla geração paralela — stream normalmente inicia em <1s mesmo em Gemini lento).

import { streamText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { getModel, type AIProvider } from '@/lib/ai/config';
import { sanitizeIncomingMessage } from '@/lib/ai/agent/input-filter';
import { createClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { getResolvedPrompt } from '@/lib/ai/prompts/server';
import { buildCachedSystem, flattenSystem } from '@/lib/ai/cache';
import { isAIFeatureEnabled } from '@/lib/ai/features/server';

export const maxDuration = 60;
// Critico para streaming real: Vercel/Next.js pode bufferizar chunks se Node.js runtime
// + headers incorrectos. force-dynamic desactiva caching, X-Accel-Buffering:no desactiva
// proxy buffering. Mantemos Node runtime (não edge) porque precisa de Supabase server client
// que usa Node-only APIs (cookies).
export const dynamic = 'force-dynamic';

/**
 * Constrói user message estruturado e truncado (igual ao do /api/ai/actions, com 5/3 limits).
 * Duplicado para evitar ciclo de import; sincronizar se mudar.
 */
function buildUserMessage(args: {
  channelLabel: string;
  subject: string;
  message: string;
  snapshot: any;
  nba: any;
}): string {
  const { channelLabel, subject, message, snapshot, nba } = args;
  const lines: string[] = [];

  const fmtDateRel = (iso: string | null | undefined): string => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const days = Math.floor((Date.now() - d.getTime()) / 86400000);
      const dateStr = d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
      if (days === 0) return `hoje (${dateStr})`;
      if (days === 1) return `ontem (${dateStr})`;
      if (days < 30) return `há ${days} dias (${dateStr})`;
      return dateStr;
    } catch { return String(iso); }
  };

  const stripInternalLabels = (text: string): string => {
    if (!text) return '';
    return String(text)
      .replace(/\s*\[(?:Calculadora|Comparadores|Vendedores|Proprietarios|Propriet[áa]rios|Compradores|Arrendamento|Parceiros|Pipeline|Quiz|FSBO|Lead)\]\s*/gi, ' ')
      .replace(/^Deal\s*-\s*/i, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  };

  lines.push(`== CANAL ==\n${channelLabel}`);
  if (subject || message) {
    lines.push('\n== RASCUNHO ACTUAL (a melhorar) ==');
    if (subject) lines.push(`Assunto: ${subject}`);
    if (message) lines.push(`Mensagem:\n${message}`);
  } else {
    lines.push('\n== RASCUNHO ACTUAL ==\n[sem rascunho — gera mensagem nova do zero]');
  }

  const deal = snapshot?.deal;
  if (deal) {
    const title = stripInternalLabels(deal.title || '');
    const valorFmt = typeof deal.value === 'number' && deal.value > 0
      ? `${deal.value.toLocaleString('pt-PT')} €` : '';
    lines.push('\n== DEAL ==');
    if (title) lines.push(`- Assunto: ${title}`);
    if (snapshot?.stage?.label) lines.push(`- Fase do funil: ${snapshot.stage.label}`);
    if (snapshot?.board?.name) lines.push(`- Pipeline: ${snapshot.board.name}`);
    if (valorFmt) lines.push(`- Valor: ${valorFmt}`);
    if (snapshot?.cockpitSignals?.daysInStage != null) lines.push(`- Dias nesta fase: ${snapshot.cockpitSignals.daysInStage}`);
    if (snapshot?.cockpitSignals?.healthScore != null) lines.push(`- Health score: ${snapshot.cockpitSignals.healthScore}/100`);
  }

  const c = snapshot?.contact;
  if (c) {
    lines.push('\n== CONTACTO ==');
    if (c.name) lines.push(`- Nome: ${c.name}`);
    if (c.email) lines.push(`- Email: ${c.email}`);
    if (c.source) lines.push(`- Fonte do lead: ${c.source}`);
    if (c.lastInteraction) lines.push(`- Última interacção registada: ${fmtDateRel(c.lastInteraction)}`);
    if (c.notes) lines.push(`- Notas do contacto: ${String(c.notes).slice(0, 250)}`);
  }

  const acts = snapshot?.lists?.activities?.preview;
  if (Array.isArray(acts) && acts.length > 0) {
    lines.push('\n== HISTÓRICO RECENTE (últimas 5) ==');
    acts.slice(0, 5).forEach((a: any, i: number) => {
      const raw = stripInternalLabels(a.title || a.description || a.type || '');
      const t = raw.slice(0, 150);
      lines.push(`${i + 1}. [${fmtDateRel(a.date)}] ${a.type || ''} ${t}`.trim());
    });
  }

  const notes = snapshot?.lists?.notes?.preview;
  if (Array.isArray(notes) && notes.length > 0) {
    lines.push('\n== NOTAS RELEVANTES (últimas 3) ==');
    notes.slice(0, 3).forEach((n: any, i: number) => {
      const txt = String(n.content || '').slice(0, 200);
      lines.push(`${i + 1}. [${fmtDateRel(n.created_at)}] ${txt}`);
    });
  }

  if (nba) {
    const action = nba.action || nba.title;
    const reason = nba.reason;
    if (action) {
      lines.push('\n== PRÓXIMA ACÇÃO SUGERIDA (hint) ==');
      lines.push(`- Acção: ${action}`);
      if (reason) lines.push(`- Razão: ${reason}`);
    }
  }

  const formatInstruction = channelLabel === 'EMAIL'
    ? 'Devolve no formato:\nASSUNTO: <linha>\n\n<corpo do email completo, com saudação, parágrafos, CTA, assinatura>'
    : 'Devolve apenas o corpo da mensagem WhatsApp, sem prefixo ASSUNTO.';

  lines.push(`\n== INSTRUÇÃO ==\n${
    subject || message
      ? `Melhora a mensagem acima para ${channelLabel}, mantendo o conteúdo essencial mas aplicando o estilo profissional pt-PT formal do João Fonseca conforme as regras do system. Usa os dados do deal e do histórico para personalizar com factos concretos.`
      : `Cria uma mensagem nova para ${channelLabel} usando os dados acima. Aplica o estilo profissional pt-PT formal do João Fonseca conforme as regras do system. Personaliza com 1-2 factos concretos do deal ou do histórico.`
  }\n\n${formatInstruction}`);

  return lines.join('\n');
}

function errStream(message: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`ERROR: ${message}`));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200, // 200 + ERROR: prefix → frontend trata (regra webhooks NUNCA 500)
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-cache' },
  });
}

export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) return errStream('Forbidden');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return errStream('Unauthorized');

  const body = await req.json().catch(() => null);
  const action = body?.action as string | undefined;
  const data = (body?.data ?? {}) as Record<string, unknown>;

  // Por enquanto, só rewriteMessageDraft. Quando estabilizar, podemos expandir.
  if (action !== 'rewriteMessageDraft') {
    return errStream(`Stream action not supported: ${action}`);
  }

  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
  if (!profile?.organization_id) return errStream('Profile not found');

  const { data: orgSettings } = await supabase
    .from('organization_settings')
    .select('ai_enabled, ai_model, ai_google_key, ai_anthropic_key')
    .eq('organization_id', profile.organization_id)
    .single();

  if (orgSettings && (orgSettings as any).ai_enabled === false) {
    return errStream('IA desactivada pela organização');
  }

  const enabled = await isAIFeatureEnabled(supabase as any, profile.organization_id as any, 'ai_email_draft');
  if (!enabled) return errStream('Função de IA desactivada');

  const apiKey: string | null = orgSettings?.ai_google_key ?? null;
  if (!apiKey) return errStream('AI consent required');

  const provider: AIProvider = 'google';
  const modelId = orgSettings?.ai_model || '';
  const model = getModel(provider, apiKey, modelId);

  // Reescrever input
  const channel = (data as any).channel === 'EMAIL' ? 'EMAIL' : 'WHATSAPP';
  const channelLabel = channel;
  const { text: safeMessage } = sanitizeIncomingMessage(String((data as any).currentMessage || ''), { org_id: profile.organization_id });
  const { text: safeSubject } = sanitizeIncomingMessage(String((data as any).currentSubject || ''), { org_id: profile.organization_id });

  const resolved = await getResolvedPrompt(supabase as any, profile.organization_id as any, 'rewrite_message_draft');
  const featurePrompt = resolved?.content || '';
  const cachedBlocks = buildCachedSystem(featurePrompt);
  const systemFlat = flattenSystem(cachedBlocks);

  const userMessage = buildUserMessage({
    channelLabel,
    subject: safeSubject,
    message: safeMessage,
    snapshot: (data as any).cockpitSnapshot,
    nba: (data as any).nextBestAction,
  });

  // Stream Gemini. Em erro, fallback Anthropic Haiku (também stream).
  // textStream da AI SDK v6 é AsyncIterable<string>.
  let result;
  let providerUsed = 'google';
  try {
    result = streamText({
      model,
      system: systemFlat,
      prompt: userMessage,
      maxRetries: 1,
    });
  } catch (err: any) {
    console.warn('[stream rewriteMessageDraft] Gemini init falhou, fallback Anthropic:', err?.message);
    const anthropicKey = (orgSettings as any)?.ai_anthropic_key;
    if (!anthropicKey) return errStream('Gemini falhou e sem chave Anthropic configurada');
    const anthropicProvider = createAnthropic({ apiKey: anthropicKey });
    result = streamText({
      model: anthropicProvider('claude-haiku-4-5-20251001'),
      system: systemFlat,
      prompt: userMessage,
      maxRetries: 1,
    });
    providerUsed = 'anthropic-haiku';
  }

  console.log(`[stream rewriteMessageDraft] channel=${channelLabel} provider=${providerUsed} streaming...`);

  // toTextStreamResponse devolve Response com text/plain chunked
  return result.toTextStreamResponse({
    headers: {
      'x-provider-used': providerUsed,
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',  // desactiva buffering em proxies (Vercel/nginx)
      'content-encoding': 'identity',  // evita compressão que bufferiza
      'transfer-encoding': 'chunked',
    },
  });
}
