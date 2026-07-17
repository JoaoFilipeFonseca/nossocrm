/**
 * Chamadas a partir do CRM (pedido do João, 17/07/2026).
 *
 * No iPhone/iPad, "Telefonar" não abre o marcador directamente: dispara o
 * Atalho iOS "Ligar CRM" (Shortcuts), que PRIMEIRO inicia a gravação na app
 * Notta e SÓ DEPOIS liga ao número. Assim, só as chamadas feitas pelo CRM
 * ficam gravadas — chamadas normais do iPhone não passam por aqui.
 *
 * Fora do iOS (desktop/Android) mantém-se o `tel:` clássico.
 *
 * O Atalho é criado uma vez no iPhone do João (receita em
 * docs/ligar-com-gravacao-notta.md). O nome TEM de ser exactamente
 * NOTTA_SHORTCUT_NAME — é como o iOS o encontra.
 */

export const NOTTA_SHORTCUT_NAME = 'Ligar CRM';

/** Normaliza o número para marcação (dígitos e "+"). */
export function cleanPhone(phone: string | null | undefined): string {
  return (phone || '').replace(/[^\d+]/g, '');
}

/** iPhone/iPad (inclui iPadOS que se identifica como Macintosh com touch). */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return ua.includes('Macintosh') && typeof document !== 'undefined' && 'ontouchend' in document;
}

/** Href clássico de marcação. Vazio se não houver número utilizável. */
export function telHref(phone: string | null | undefined): string {
  const c = cleanPhone(phone);
  return c ? `tel:${c}` : '';
}

/** URL que corre o Atalho iOS com o número como input de texto. */
export function shortcutCallHref(phone: string | null | undefined): string {
  const c = cleanPhone(phone);
  if (!c) return '';
  return `shortcuts://run-shortcut?name=${encodeURIComponent(NOTTA_SHORTCUT_NAME)}&input=text&text=${encodeURIComponent(c)}`;
}

/**
 * Intercepta o clique num link de chamada: em iOS redirige para o Atalho
 * (gravação Notta + chamada); noutras plataformas deixa o `tel:` seguir.
 * Usar em onClick de anchors com href={telHref(...)} — assim o href renderizado
 * no servidor é estável (sem hydration mismatch) e o desvio só acontece no clique.
 */
export function interceptCallClick(e: { preventDefault: () => void }, phone: string | null | undefined): void {
  if (!isIOS()) return;
  const url = shortcutCallHref(phone);
  if (!url) return;
  e.preventDefault();
  window.location.href = url;
}
