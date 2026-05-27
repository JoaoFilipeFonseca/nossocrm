import { Deal } from '@/types';

/**
 * Função pública `isDealRotting` do projeto.
 *
 * @param {Deal} deal - Parâmetro `deal`.
 * @returns {boolean} Retorna um valor do tipo `boolean`.
 */
export const isDealRotting = (deal: Deal) => {
    const dateToCheck = deal.lastStageChangeDate || deal.updatedAt;
    const diff = new Date().getTime() - new Date(dateToCheck).getTime();
    const days = diff / (1000 * 3600 * 24);
    return days > 10;
};

/**
 * Sprint 14 c1: dias decorridos desde a última mudança de fase (ou updatedAt
 * como fallback). Inteiro arredondado para baixo. Usado no badge "Xd na fase".
 */
export const daysInStage = (deal: Deal): number => {
    const dateToCheck = deal.lastStageChangeDate || deal.updatedAt;
    if (!dateToCheck) return 0;
    const diff = Date.now() - new Date(dateToCheck).getTime();
    return Math.max(0, Math.floor(diff / 86400000));
};

/**
 * Sprint 14 c1: cor do badge "Xd na fase" por temperatura do deal.
 * < 5d verde · 5-10d cinza neutro · 10-20d âmbar · > 20d vermelho.
 */
export const stageAgeBucket = (days: number): 'fresh' | 'normal' | 'warm' | 'cold' => {
    if (days < 5) return 'fresh';
    if (days < 10) return 'normal';
    if (days < 20) return 'warm';
    return 'cold';
};

/**
 * Função pública `getActivityStatus` do projeto.
 *
 * @param {Deal} deal - Parâmetro `deal`.
 * @returns {"yellow" | "red" | "green" | "gray"} Retorna um valor do tipo `"yellow" | "red" | "green" | "gray"`.
 */
export const getActivityStatus = (deal: Deal) => {
    if (!deal.nextActivity) return 'yellow';
    if (deal.nextActivity.isOverdue) return 'red';
    const activityDate = new Date(deal.nextActivity.date);
    const today = new Date();
    if (activityDate.toDateString() === today.toDateString()) return 'green';
    return 'gray';
};
