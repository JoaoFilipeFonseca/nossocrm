import { describe, it, expect } from 'vitest';
import { isIgnorableClientError } from './ignore';

describe('isIgnorableClientError', () => {
  it('ignora o $RS/parentNode (corrida de streaming do React 19)', () => {
    const message = "Uncaught TypeError: Cannot read properties of null (reading 'parentNode')";
    const stack =
      "TypeError: Cannot read properties of null (reading 'parentNode')\n" +
      '    at $RS (https://crm.joaofilipefonseca.pt/contacts/abc:1:62516)\n' +
      '    at https://crm.joaofilipefonseca.pt/contacts/abc:1:62585';
    expect(isIgnorableClientError(message, stack)).toBe(true);
  });

  it('ignora o ruído ResizeObserver loop', () => {
    expect(
      isIgnorableClientError('ResizeObserver loop completed with undelivered notifications.', null),
    ).toBe(true);
  });

  it('NÃO ignora um erro real de parentNode sem origem em $RS', () => {
    const message = "TypeError: Cannot read properties of null (reading 'parentNode')";
    const stack =
      "TypeError: Cannot read properties of null (reading 'parentNode')\n" +
      '    at MyComponent (https://crm.joaofilipefonseca.pt/_next/static/chunks/app.js:1:100)';
    expect(isIgnorableClientError(message, stack)).toBe(false);
  });

  it('NÃO ignora um erro genérico da aplicação', () => {
    const message = "TypeError: Cannot read properties of undefined (reading 'nome')";
    const stack = '    at DealCard (https://crm.joaofilipefonseca.pt/_next/static/chunks/app.js:1:200)';
    expect(isIgnorableClientError(message, stack)).toBe(false);
  });

  it('lida com message/stack nulos sem rebentar', () => {
    expect(isIgnorableClientError(null, null)).toBe(false);
    expect(isIgnorableClientError(undefined, undefined)).toBe(false);
  });
});
