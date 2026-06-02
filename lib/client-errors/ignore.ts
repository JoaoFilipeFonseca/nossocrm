/**
 * Classificação de erros front-end benignos que NÃO são bugs da app e não
 * afectam o utilizador — devem ser ignorados pelo ClientErrorReporter para
 * não poluírem `/saúde` nem dispararem alertas Telegram.
 *
 * Filosofia: à semelhança do que ferramentas de monitorização maduras fazem
 * com o conhecido "ResizeObserver loop", classificamos ruído de runtime como
 * não-alertável. Mantém-se TUDO o que seja um erro real da aplicação.
 *
 * Caso principal (verificado em produção, 01/06/2026):
 *   "Uncaught TypeError: Cannot read properties of null (reading 'parentNode')"
 *   com stack em `$RS` — é o `completeSegment` do runtime de streaming SSR do
 *   React 19. Corrida intermitente: a hidratação do shell-cliente (Layout)
 *   faz um re-render estrutural à montagem (ex.: `useResponsiveMode` troca a
 *   árvore desktop↔mobile conforme a largura real) e remove o *placeholder*
 *   do segmento transmitido ANTES de este completar. A página renderiza na
 *   mesma (não-fatal); é um detalhe interno do React, não da nossa app.
 */
export function isIgnorableClientError(
  message: string | null | undefined,
  stack: string | null | undefined,
): boolean {
  const m = (message || '').toLowerCase();
  const s = stack || '';

  // React 19 fizz completeSegment ($RS): corrida de streaming SSR benigna.
  if (m.includes('parentnode') && /\$RS\b/.test(s)) return true;

  // Ruído benigno conhecido dos browsers (observador de redimensionamento).
  if (m.includes('resizeobserver loop')) return true;

  return false;
}
