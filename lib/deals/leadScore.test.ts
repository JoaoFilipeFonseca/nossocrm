import { describe, it, expect } from 'vitest';
import {
  computeLeadScore,
  computeLeadScores,
  stagePoints,
  recencyPoints,
  engagementPoints,
  type LeadScoreSignals,
} from './leadScore';

const TODAY = '2026-06-12T10:00:00Z';

function sig(partial: Partial<LeadScoreSignals> = {}): LeadScoreSignals {
  return {
    deal_id: 'd1',
    stage_order: 0,
    max_stage_order: 4,
    days_since_touch: null,
    touches: 0,
    visits: 0,
    value: null,
    snoozed_until: null,
    email_opt_out: false,
    source: null,
    ...partial,
  };
}

describe('DASH-2 leadScore — componentes', () => {
  it('etapa proporcional ao funil (1.ª etapa = 0, última = 35)', () => {
    expect(stagePoints(0, 4)).toBe(0);
    expect(stagePoints(2, 4)).toBe(18);
    expect(stagePoints(4, 4)).toBe(35);
    expect(stagePoints(3, 0)).toBe(0); // board sem etapas conhecidas não rebenta
  });

  it('recência: quanto mais fresco o toque, mais pontos; nunca tocado = 0', () => {
    expect(recencyPoints(null)).toBe(0);
    expect(recencyPoints(3)).toBe(30);
    expect(recencyPoints(20)).toBe(20);
    expect(recencyPoints(60)).toBe(8);
    expect(recencyPoints(200)).toBe(0);
  });

  it('interacções: volume + bónus de visita', () => {
    expect(engagementPoints(0, 0)).toBe(0);
    expect(engagementPoints(1, 0)).toBe(5);
    expect(engagementPoints(3, 0)).toBe(10);
    expect(engagementPoints(6, 2)).toBe(25);
  });
});

describe('DASH-2 leadScore — score, temperatura e razões', () => {
  it('lead Meta sem toque (o caso das 482) é fria, com razão honesta', () => {
    const r = computeLeadScore(sig({ source: 'Meta Ads' }), TODAY);
    expect(r.score).toBe(0);
    expect(r.temperature).toBe('frio');
    expect(r.reasons.join(' ')).toContain('sem nenhum toque');
    expect(r.reasons.join(' ')).toContain('Meta Ads');
  });

  it('negócio trabalhado e avançado é quente', () => {
    const r = computeLeadScore(
      sig({ stage_order: 3, max_stage_order: 4, days_since_touch: 3, touches: 5, visits: 2, value: 285000 }),
      TODAY
    );
    // 26 (etapa) + 30 (recência) + 25 (interacções+visita) + 5 (valor) = 86
    expect(r.score).toBe(86);
    expect(r.temperature).toBe('quente');
    expect(r.reasons.join(' ')).toContain('visita');
  });

  it('opt-out de email retira pontos e aparece nas razões', () => {
    const base = sig({ stage_order: 2, max_stage_order: 4, days_since_touch: 10, touches: 2 });
    const sem = computeLeadScore(base, TODAY);
    const com = computeLeadScore({ ...base, email_opt_out: true }, TODAY);
    expect(com.score).toBe(sem.score - 10);
    expect(com.reasons.join(' ')).toContain('não receber emails');
  });

  it('adiado é estado próprio: score 0, temperatura adiado, data na razão', () => {
    const r = computeLeadScore(sig({ snoozed_until: '2026-12-12', stage_order: 4, touches: 9 }), TODAY);
    expect(r.temperature).toBe('adiado');
    expect(r.score).toBe(0);
    expect(r.reasons[0]).toContain('12/12/2026');
  });

  it('adiado no passado já não conta como adiado', () => {
    const r = computeLeadScore(sig({ snoozed_until: '2026-01-01', days_since_touch: 5, touches: 1 }), TODAY);
    expect(r.temperature).not.toBe('adiado');
  });

  it('score nunca sai de [0,100] e razões são no máximo 5', () => {
    const r = computeLeadScore(sig({ email_opt_out: true }), TODAY);
    expect(r.score).toBeGreaterThanOrEqual(0);
    const top = computeLeadScore(
      sig({ stage_order: 9, max_stage_order: 4, days_since_touch: 1, touches: 99, visits: 9, value: 1, source: 'Idealista' }),
      TODAY
    );
    expect(top.score).toBeLessThanOrEqual(100);
    expect(top.reasons.length).toBeLessThanOrEqual(5);
  });

  it('computeLeadScores devolve o mapa por deal', () => {
    const map = computeLeadScores([sig(), sig({ deal_id: 'd2', days_since_touch: 2, touches: 1 })], TODAY);
    expect(Object.keys(map)).toEqual(['d1', 'd2']);
    expect(map.d2.score).toBeGreaterThan(map.d1.score);
  });
});
