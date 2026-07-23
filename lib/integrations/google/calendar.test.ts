import { describe, it, expect } from 'vitest';
import { buildEventBody } from './calendar';

const APP = 'https://crm.joaofilipefonseca.pt';

const base = {
  id: 'act-1',
  title: 'Ligar ao proprietário',
  description: 'Confirmar a visita de sábado',
  type: 'CALL',
  date: new Date(2026, 6, 24, 14, 30, 0).toISOString(),
  completed: false,
  dealId: 'deal-9',
  dealTitle: 'T3 Leça da Palmeira',
  contactName: 'Ana Silva',
};

describe('buildEventBody', () => {
  it('põe o tipo e o título no assunto do evento', () => {
    const ev = buildEventBody(base, APP);
    expect(ev.summary).toBe('Chamada: Ligar ao proprietário');
  });

  it('marca as concluídas com ✓ (fica no calendário como registo)', () => {
    const ev = buildEventBody({ ...base, completed: true }, APP);
    expect(ev.summary).toBe('✓ Chamada: Ligar ao proprietário');
  });

  it('leva negócio, contacto e link para o CRM na descrição', () => {
    const ev = buildEventBody(base, APP);
    expect(ev.description).toContain('Confirmar a visita de sábado');
    expect(ev.description).toContain('Negócio: T3 Leça da Palmeira');
    expect(ev.description).toContain('Contacto: Ana Silva');
    expect(ev.description).toContain(`${APP}/deals/deal-9/cockpit`);
  });

  it('sem negócio, o link vai para as actividades', () => {
    const ev = buildEventBody({ ...base, dealId: null, dealTitle: null }, APP);
    expect(ev.description).toContain(`${APP}/activities`);
  });

  it('dura 30 minutos e fica no fuso de Lisboa', () => {
    const ev = buildEventBody(base, APP);
    const start = new Date(ev.start.dateTime).getTime();
    const end = new Date(ev.end.dateTime).getTime();
    expect((end - start) / 60000).toBe(30);
    expect(ev.start.timeZone).toBe('Europe/Lisbon');
    expect(ev.end.timeZone).toBe('Europe/Lisbon');
  });

  it('guarda o id da tarefa do CRM no evento (para reconciliar)', () => {
    const ev = buildEventBody(base, APP);
    expect(ev.extendedProperties.private.crmActivityId).toBe('act-1');
  });

  it('aguenta tarefa sem descrição, sem negócio e sem contacto', () => {
    const ev = buildEventBody(
      { id: 'a', title: 'Tarefa solta', date: base.date, completed: false },
      APP,
    );
    expect(ev.summary).toBe('Tarefa solta');
    expect(ev.description).toContain('Abrir no CRM');
  });
});
