/**
 * Sanitização determinística de copy IA — última linha de defesa contra
 * em-dash (—, U+2014) e en-dash (–, U+2013) que LLMs continuam a gerar
 * apesar de regras explícitas no system prompt.
 *
 * Aplicar em TODOS os outputs IA dirigidos a humano antes de chegarem ao
 * ecrã (cliente) e antes de chegarem ao consumidor (servidor).
 *
 * Regra absoluta gravada em memory: hifens longos são o sinal mais claro
 * de texto LLM. O João detecta-os imediatamente.
 *
 * NÃO TOCA em: hífen normal `-` (palavras compostas, números 320k-360k,
 * pré-aprovação, follow-up), travessões em código `\`code\``.
 */

/**
 * Substitui em-dash/en-dash por pontuação portuguesa adequada ao contexto.
 * Heurísticas:
 *  - Entre palavras: vírgula (caso geral, ~90%)
 *  - Depois de pontuação final (. ! ?): só espaço
 *  - No início/fim de linha: removido
 *  - Vírgulas duplas resultantes: colapsadas
 */
export function sanitizeCopy(input: string | null | undefined): string {
  if (!input) return input ?? '';
  if (typeof input !== 'string') return String(input);

  let out = input;

  // 1. Em-dash/en-dash no início de linha (eventual lista) → remover
  out = out.replace(/^\s*[—–]\s+/gm, '');

  // 2. Em-dash/en-dash no fim de linha → remover
  out = out.replace(/\s+[—–]\s*$/gm, '');

  // 3. Em-dash/en-dash depois de pontuação final (. ! ? :) → só espaço
  out = out.replace(/([.!?:])\s*[—–]\s*/g, '$1 ');

  // 4. Em-dash/en-dash entre palavras (caso geral) → vírgula + espaço
  out = out.replace(/\s*[—–]\s*/g, ', ');

  // 5. Cleanup: vírgulas duplas que possam ter surgido
  out = out.replace(/,\s*,/g, ',');

  // 6. Cleanup: espaço antes de vírgula
  out = out.replace(/\s+,/g, ',');

  // 7. Cleanup: 3+ espaços consecutivos → 1
  out = out.replace(/[ \t]{3,}/g, '  ');

  return out;
}

/**
 * Sanitiza um objecto com campos comuns de copy (subject + message + content).
 * Útil para devolver result objects do AI directamente sanitizados.
 */
export function sanitizeCopyObject<T extends Record<string, unknown>>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  const COPY_FIELDS = ['subject', 'message', 'content', 'body', 'text', 'description'];
  const next: Record<string, unknown> = { ...obj };
  for (const field of COPY_FIELDS) {
    if (typeof next[field] === 'string') {
      next[field] = sanitizeCopy(next[field] as string);
    }
  }
  return next as T;
}
