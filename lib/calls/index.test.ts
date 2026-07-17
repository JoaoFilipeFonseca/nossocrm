import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanPhone, telHref, shortcutCallHref, interceptCallClick, NOTTA_SHORTCUT_NAME } from './index';

const setUA = (ua: string) => {
  vi.stubGlobal('navigator', { userAgent: ua });
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('lib/calls', () => {
  it('cleanPhone mantém dígitos e +', () => {
    expect(cleanPhone(' +351 916 472 583 ')).toBe('+351916472583');
    expect(cleanPhone('91-647-2583')).toBe('916472583');
    expect(cleanPhone(null)).toBe('');
  });

  it('telHref devolve tel: ou vazio', () => {
    expect(telHref('+351 916 472 583')).toBe('tel:+351916472583');
    expect(telHref('')).toBe('');
  });

  it('shortcutCallHref corre o Atalho com o número como input', () => {
    const url = shortcutCallHref('+351 916 472 583');
    expect(url).toContain('shortcuts://run-shortcut');
    expect(url).toContain(`name=${encodeURIComponent(NOTTA_SHORTCUT_NAME)}`);
    expect(url).toContain('text=%2B351916472583');
    expect(shortcutCallHref('')).toBe('');
  });

  it('interceptCallClick desvia para o Atalho em iPhone', () => {
    setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit');
    const loc = { href: '' };
    vi.stubGlobal('window', { location: loc });
    const e = { preventDefault: vi.fn() };
    interceptCallClick(e, '+351916472583');
    expect(e.preventDefault).toHaveBeenCalled();
    expect(loc.href).toContain('shortcuts://run-shortcut');
  });

  it('interceptCallClick NÃO mexe fora do iOS (tel: segue normal)', () => {
    setUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    const e = { preventDefault: vi.fn() };
    interceptCallClick(e, '+351916472583');
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('interceptCallClick não faz nada sem número (iOS)', () => {
    setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)');
    const e = { preventDefault: vi.fn() };
    interceptCallClick(e, '');
    expect(e.preventDefault).not.toHaveBeenCalled();
  });
});
