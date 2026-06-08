import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildCapiEvent, sha256Hex, normalizePhone, sendCapiEvents } from './capi';

describe('sha256Hex', () => {
  it('normaliza (minúsculas + trim) antes do hash → 64 hex', () => {
    const a = sha256Hex('  Joao@Example.COM ');
    const b = sha256Hex('joao@example.com');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('normalizePhone', () => {
  it('remove espaços, +, () e hífens, mantém dígitos do indicativo', () => {
    expect(normalizePhone('+351 912 345 678')).toBe('351912345678');
    expect(normalizePhone('(351) 912-345-678')).toBe('351912345678');
  });
});

describe('buildCapiEvent', () => {
  it('negócio ganho: action_source system_generated + valor/EUR + email com hash', () => {
    const ev = buildCapiEvent({
      eventName: 'Purchase',
      eventId: 'deal-123',
      eventTime: 1000,
      email: 'joao@example.com',
      phone: '+351912345678',
      value: 6250,
    });
    expect(ev.event_name).toBe('Purchase');
    expect(ev.event_time).toBe(1000);
    expect(ev.event_id).toBe('deal-123');
    expect(ev.action_source).toBe('system_generated');
    const ud = ev.user_data as { em: string[]; ph: string[] };
    expect(ud.em).toEqual([sha256Hex('joao@example.com')]);
    expect(ud.ph).toEqual([sha256Hex('351912345678')]);
    expect(ev.custom_data).toEqual({ value: 6250, currency: 'EUR' });
  });

  it('omite user_data vazio, custom_data e source quando não há dados', () => {
    const ev = buildCapiEvent({ eventName: 'Lead', eventId: 'x', eventTime: 1 });
    expect(ev.user_data).toEqual({});
    expect(ev.custom_data).toBeUndefined();
    expect(ev.event_source_url).toBeUndefined();
    expect(ev.action_source).toBe('system_generated');
  });

  it('gera event_id e event_time quando não fornecidos', () => {
    const ev = buildCapiEvent({ eventName: 'Lead' });
    expect(typeof ev.event_id).toBe('string');
    expect((ev.event_id as string).length).toBeGreaterThan(10);
    expect(typeof ev.event_time).toBe('number');
  });

  it('moeda personalizada e custom_data extra', () => {
    const ev = buildCapiEvent({ eventName: 'Purchase', eventId: 'y', eventTime: 2, value: 100, currency: 'USD', customData: { lead_event_source: 'crm' } });
    expect(ev.custom_data).toEqual({ lead_event_source: 'crm', value: 100, currency: 'USD' });
  });

  it('valor não-finito é ignorado (sem value/currency)', () => {
    const ev = buildCapiEvent({ eventName: 'Purchase', eventId: 'z', eventTime: 3, value: Number.NaN });
    expect(ev.custom_data).toBeUndefined();
  });
});

describe('sendCapiEvents', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sucesso: lê events_received e marca ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ events_received: 1, fbtrace_id: 'AbC' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const r = await sendCapiEvents({ token: 'TKN', events: [{ event_name: 'Lead' }], testEventCode: 'TEST51462' });
    expect(r.ok).toBe(true);
    expect(r.eventsReceived).toBe(1);
    expect(r.fbtraceId).toBe('AbC');
    // o test_event_code e o token vão no corpo
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.test_event_code).toBe('TEST51462');
    expect(body.access_token).toBe('TKN');
    expect(fetchMock.mock.calls[0][0]).toContain('/226877513589288/events');
  });

  it('erro da Meta: ok=false + mensagem', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Invalid OAuth access token', fbtrace_id: 'Zzz' } }),
    }));
    const r = await sendCapiEvents({ token: 'BAD', events: [{}] });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('Invalid OAuth');
    expect(r.fbtraceId).toBe('Zzz');
  });

  it('rede em baixo: nunca atira, devolve ok=false', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const r = await sendCapiEvents({ token: 'T', events: [{}] });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('network down');
  });
});
