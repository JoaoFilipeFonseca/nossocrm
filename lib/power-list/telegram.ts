// BRIEF 2 — Power List. Resumo Telegram: os 5 primeiros + número do dia + link.

import type { NumeroDoDia, PowerListItem } from './types';

function esc(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const SEM_DOT: Record<string, string> = { green: '🟢', amber: '🟡', red: '🔴' };

export function buildTelegramSummary(
  items: PowerListItem[],
  numeroDoDia: NumeroDoDia,
  appUrl: string,
): string {
  const dot = SEM_DOT[numeroDoDia.semaphore] || '⚪️';
  const lines: string[] = [
    `📞 <b>Power List de hoje</b> — ${items.length} ${items.length === 1 ? 'contacto' : 'contactos'} para ligar`,
    '',
    `${dot} <b>${numeroDoDia.conversasSemana}/${numeroDoDia.meta}</b> conversas esta semana`,
    '',
  ];
  items.slice(0, 5).forEach((it, i) => {
    const phone = it.phone ? ` · ${esc(it.phone)}` : '';
    lines.push(`${i + 1}. <b>${esc(it.contactName)}</b>${phone}`);
    lines.push(`   <i>${esc(it.reason)}</i>`);
  });
  if (items.length > 5) {
    lines.push('');
    lines.push(`… e mais ${items.length - 5} na lista completa.`);
  }
  lines.push('');
  lines.push(`👉 <a href="${appUrl}/hoje">Abrir a Power List</a>`);
  return lines.join('\n');
}
