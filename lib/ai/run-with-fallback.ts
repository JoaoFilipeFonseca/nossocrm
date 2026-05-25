/**
 * Executor com fallback automatico entre provedores AI.
 *
 * Tenta primeiro o modelo primario; se falhar (rate-limit, 5xx, network, etc.),
 * tenta automaticamente o modelo fallback. Logs em servidor mostram qual foi usado.
 *
 * NOTA: sanitização de em-dash não corre aqui — result.text do AI SDK é getter
 * readonly, mutar lança em runtime (500). Sanitização é feita nos callsites
 * cliente que consomem os outputs (ver lib/ai/sanitize.ts + DealDetailModal,
 * MessageComposerModal, etc.).
 *
 * Uso tipico em endpoints AI:
 *   const { model, fallbackModel } = await requireAITaskContext(req);
 *   const { result } = await runWithAIFallback(
 *     () => generateText({ model, prompt }),
 *     fallbackModel ? () => generateText({ model: fallbackModel, prompt }) : null,
 *   );
 */

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
    return { result, via: 'primary' };
  } catch (primaryError) {
    if (!fallbackFn) throw primaryError;
    try {
      const msg = (primaryError as Error)?.message ?? String(primaryError);
      console.warn('[AI] primary failed, trying fallback:', msg);
      const result = await fallbackFn();
      return { result, via: 'fallback', primaryError };
    } catch (fallbackError) {
      console.error('[AI] primary and fallback both failed', { primaryError, fallbackError });
      throw primaryError;
    }
  }
}
