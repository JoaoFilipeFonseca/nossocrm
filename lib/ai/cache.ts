/**
 * Helpers para prompt caching cross-provider (Anthropic ephemeral + Gemini implicit).
 *
 * Anthropic: explicit, via `providerOptions.anthropic.cacheControl: { type: 'ephemeral' }`
 *            em content blocks individuais. 90% off em hits.
 * Gemini:    implicit, activado por defeito em Flash/Pro 2.5+. Nada a fazer no código,
 *            só medir no Google Cloud billing console.
 *
 * Convenção do Foco Imo:
 *   system = [ GLOBAL_RULES_BLOCK (cached), feature-specific prompt (cached) ]
 *   user   = dados dinâmicos do deal/contacto (não cached)
 *
 * Anthropic permite até 4 cache breakpoints. Usamos 2: 1 cross-feature + 1 intra-feature.
 */

import { GLOBAL_RULES_BLOCK } from './global-rules';

/**
 * Tipo do content block usado em `system` ou `messages` para AI SDK v6.
 * Quando `cached=true`, adiciona providerOptions.anthropic.cacheControl ephemeral.
 */
export type CachedBlock = {
  type: 'text';
  text: string;
  providerOptions?: Record<string, unknown>;
};

function withCache(text: string): CachedBlock {
  return {
    type: 'text',
    text,
    providerOptions: {
      anthropic: { cacheControl: { type: 'ephemeral' } },
    },
  };
}

/**
 * Constrói o array `system` para uma chamada IA do Foco Imo.
 *
 * - Block 1: GLOBAL_RULES_BLOCK (cached) — partilhado entre todas as features
 * - Block 2: prompt específico da feature (cached) — partilhado entre chamadas da mesma feature
 *
 * @param featurePrompt prompt resolvido da BD (ai_prompt_templates) ou catálogo,
 *                      JÁ SEM variáveis dinâmicas (essas vão no user message)
 */
export function buildCachedSystem(featurePrompt: string): CachedBlock[] {
  const blocks: CachedBlock[] = [withCache(GLOBAL_RULES_BLOCK)];
  if (featurePrompt && featurePrompt.trim().length > 0) {
    blocks.push(withCache(featurePrompt));
  }
  return blocks;
}

/**
 * Para AI SDK v6: passar como string única (concatenada) quando o provider
 * NÃO é Anthropic — Gemini não usa cacheControl, ignora providerOptions.
 * Mantém o mesmo conteúdo para garantir paridade de output.
 */
export function flattenSystem(blocks: CachedBlock[]): string {
  return blocks.map((b) => b.text).join('\n\n');
}

/**
 * Helper de logging para verificar cache hits em produção (Vercel logs).
 * Chamar depois de `generateText({...})`.
 *
 * AI SDK v6 expõe `result.usage` com campos providerMetadata (Anthropic):
 *   - cacheCreationInputTokens (1ª call que popula o cache)
 *   - cacheReadInputTokens (calls subsequentes que aproveitam)
 */
export function logCacheStats(label: string, result: any): void {
  const meta = result?.providerMetadata?.anthropic;
  const usage = result?.usage;
  const created = meta?.cacheCreationInputTokens ?? usage?.cacheCreationInputTokens ?? 0;
  const read = meta?.cacheReadInputTokens ?? usage?.cacheReadInputTokens ?? 0;
  const input = usage?.inputTokens ?? usage?.promptTokens ?? 0;
  const output = usage?.outputTokens ?? usage?.completionTokens ?? 0;
  if (created || read) {
    console.log(
      `[ai-cache] ${label} — input=${input} cached_created=${created} cached_read=${read} output=${output}`
    );
  } else {
    console.log(`[ai-cache] ${label} — input=${input} output=${output} (no cache stats)`);
  }
}
