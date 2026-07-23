import { describe, it, expect } from 'vitest';
import {
  CHANNELS,
  RESULTS,
  NON_CONVERSATION_RESULTS,
  channelMeta,
  RESULT_META,
  ACTOR_BADGE,
} from './vocab';
import { sourceLabel } from './sourceLabels';

describe('vocab de registo de contactos', () => {
  it('inclui SMS entre os canais', () => {
    expect(CHANNELS).toContain('sms');
    expect(channelMeta('sms').label).toBe('SMS');
  });

  it('tem os 5 resultados canónicos com rótulos', () => {
    expect(RESULTS).toEqual(['answered', 'returned', 'no_answer', 'voicemail', 'rescheduled']);
    for (const r of RESULTS) expect(RESULT_META[r]?.label).toBeTruthy();
  });

  it('no_answer e voicemail não contam como conversa (relógio continua a andar)', () => {
    expect(NON_CONVERSATION_RESULTS).toContain('no_answer');
    expect(NON_CONVERSATION_RESULTS).toContain('voicemail');
    // atendeu/retribuiu/reagendou NÃO estão na lista de exclusão
    expect(NON_CONVERSATION_RESULTS).not.toContain('answered');
    expect(NON_CONVERSATION_RESULTS).not.toContain('returned');
    expect(NON_CONVERSATION_RESULTS).not.toContain('rescheduled');
  });

  it('canal desconhecido tem fallback seguro', () => {
    expect(channelMeta('qualquer_coisa').label).toBe('qualquer_coisa');
  });

  it('badge de actor cobre humano e automação', () => {
    expect(ACTOR_BADGE.human.label).toBe('Você');
    expect(ACTOR_BADGE.automation.label).toBe('Automação');
  });
});

describe('sourceLabel (canal de aquisição)', () => {
  it('mapeia canais conhecidos', () => {
    expect(sourceLabel('meta_ads')).toBe('Meta Ads');
    expect(sourceLabel('calculadora-avaliar')).toBe('Estudo de Mercado');
    expect(sourceLabel('idealista')).toBe('Idealista');
  });

  it('omite quando não há origem', () => {
    expect(sourceLabel(null)).toBeNull();
    expect(sourceLabel('')).toBeNull();
    expect(sourceLabel(undefined)).toBeNull();
  });

  it('capitaliza origem desconhecida mas presente', () => {
    expect(sourceLabel('linkedin')).toBe('Linkedin');
  });
});
