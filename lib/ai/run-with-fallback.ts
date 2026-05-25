/**
 * Executor com fallback automatico entre provedores AI.
 *
 * Tenta primeiro o modelo primario; se falhar (rate-limit, 5xx, network, etc.),
 * tenta automaticamente o modelo fallback. Logs em servidor mostram qual foi usado.
 *
 * Sanitiza determinísticamente em-dash/en-dash em todos os outputs (camada
 * final de defesa contra LLMs que ignoram a regra do prompt).
 *
 * Uso tipico em endpoints AI:
 *   const { model, fallbackModel } = await requireAITaskContext(req);
 *   const { result } = await runWithAIFallback(
 *     () => generateText({ model, prompt }),
 *     fallbackModel ? () => generateText({ model: fallbackModel, prompt }) : null,
 *   );
 */

import { sanitizeCopy, sanitizeCopyObject } from '@/lib/ai/sanitize';

function sanitizeResult<T>(result: T): T {
  if (result && typeof result === 'object') {
    const r = result as any;
    if (typeof r.text === 'string') {
      r.text = sanitizeCopy(r.text);
    }
    if (r.object && typeof r.object === 'object') {
      r.object = sanitizeCopyObject(r.object as Record<string, unknown>);
    }
  }
  return result;
}

export interface AIFallbackResult<T> {
  result: T;
  /** 'primary' se o primario funcionou, 'fallback' se foi para o fallback. */
  via: 'primary' | 'fallback';
  /** Erro do primario, presente apenas quando via === 'fallback'. */
  primaryError?: unknown;
}

export async function runWithAIFallback<T>(
  primaryFn: () => Promise<T>,
  fallbackFn: (() => Promise<T>) | null,
): Promise<AIFallbackResult<T>> {
  try {
    const result = await primaryFn();
    return { result: sanitizeResult(result), via: 'primary' };
  } catch (primaryError) {
    if (!fallbackFn) throw primaryError;
    try {
      const msg = (primaryError as Error)?.message ?? String(primaryError);
      console.warn('[AI] primary failed, trying fallback:', msg);
      const result = await fallbackFn();
      return { result: sanitizeResult(result), via: 'fallback', primaryError };
    } catch (fallbackError) {
      console.error('[AI] primary and fallback both failed', { primaryError, fallbackError });
      throw primaryError;
    }
  }
}
