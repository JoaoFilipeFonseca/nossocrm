// Adiar uma tarefa "para o dia seguinte" — regra do João: nunca cair num Domingo.
// Pura (sem server-only): usada no Painel Diário e em /activities.

/**
 * Calcula a nova data ao adiar uma tarefa.
 * - Soma `dias` (por defeito 1) à data original, preservando a hora.
 * - Se o resultado ainda ficar no passado ou hoje (tarefa atrasada), passa
 *   mesmo para o próximo dia (amanhã), não para "um dia depois do atraso".
 * - Nunca deixa a tarefa a cair num Domingo — salta para Segunda.
 */
export function adiarParaAmanha(originalISO: string, dias = 1, now: Date = new Date()): Date {
  const orig = new Date(originalISO);
  let target = new Date(orig);
  target.setDate(target.getDate() + dias);

  // Não deixar no passado/hoje: se continua atrasada, empurra para amanhã real.
  const startTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (target < startTomorrow) {
    target = new Date(startTomorrow);
    const h = Number.isNaN(orig.getHours()) ? 9 : orig.getHours();
    const m = Number.isNaN(orig.getMinutes()) ? 0 : orig.getMinutes();
    target.setHours(h, m, 0, 0);
  }

  // Domingo (0) → Segunda.
  if (target.getDay() === 0) target.setDate(target.getDate() + 1);
  return target;
}
