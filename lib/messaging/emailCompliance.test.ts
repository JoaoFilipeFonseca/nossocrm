import { describe, expect, it } from 'vitest';
import {
  appendComplianceFooter,
  buildUnsubscribeUrl,
  DEFAULT_PRIVACY_POLICY_URL,
  escapeIlike,
  unsubscribeToken,
} from './emailCompliance';

const ORG = '29455d22-ebbf-4996-ac46-a071cb4363bf';

describe('unsubscribeToken', () => {
  it('é determinista e devolve hex de 64 chars (HMAC-SHA256)', async () => {
    const a = await unsubscribeToken(ORG, 'lead@example.com', 'segredo');
    const b = await unsubscribeToken(ORG, 'lead@example.com', 'segredo');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('normaliza maiúsculas e espaços do email', async () => {
    const a = await unsubscribeToken(ORG, '  Lead@Example.COM ', 'segredo');
    const b = await unsubscribeToken(ORG, 'lead@example.com', 'segredo');
    expect(a).toBe(b);
  });

  it('muda com email, org e secret diferentes', async () => {
    const base = await unsubscribeToken(ORG, 'lead@example.com', 'segredo');
    expect(await unsubscribeToken(ORG, 'outra@example.com', 'segredo')).not.toBe(base);
    expect(await unsubscribeToken('outra-org', 'lead@example.com', 'segredo')).not.toBe(base);
    expect(await unsubscribeToken(ORG, 'lead@example.com', 'outro')).not.toBe(base);
  });
});

describe('escapeIlike', () => {
  it('escapa _ e % (emails com underscore não podem virar wildcard)', () => {
    expect(escapeIlike('joaofonseca_13_@hotmail.com')).toBe('joaofonseca\\_13\\_@hotmail.com');
    expect(escapeIlike('a%b@x.pt')).toBe('a\\%b@x.pt');
    expect(escapeIlike('normal@x.pt')).toBe('normal@x.pt');
  });
});

describe('buildUnsubscribeUrl', () => {
  it('constrói o URL público com org, email minúsculo e token', () => {
    const url = buildUnsubscribeUrl('https://crm.joaofilipefonseca.pt', ORG, 'Lead@Example.com', 'abc123');
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/unsubscribe');
    expect(parsed.searchParams.get('o')).toBe(ORG);
    expect(parsed.searchParams.get('e')).toBe('lead@example.com');
    expect(parsed.searchParams.get('t')).toBe('abc123');
  });
});

describe('appendComplianceFooter', () => {
  it('acrescenta rodapé ao text com anular subscrição + política', () => {
    const out = appendComplianceFooter({
      text: 'Olá Maria',
      senderName: 'João Fonseca · RE/MAX MAJESTIC',
      unsubscribeUrl: 'https://crm.example/unsubscribe?t=x',
      privacyPolicyUrl: DEFAULT_PRIVACY_POLICY_URL,
    });
    expect(out.text).toContain('Olá Maria');
    expect(out.text).toContain('Anular subscrição: https://crm.example/unsubscribe?t=x');
    expect(out.text).toContain(`Política de privacidade: ${DEFAULT_PRIVACY_POLICY_URL}`);
    expect(out.text).toContain('partilhou o seu contacto com João Fonseca');
    expect(out.html).toBeUndefined();
  });

  it('acrescenta rodapé ao html quando existe', () => {
    const out = appendComplianceFooter({
      text: 'corpo',
      html: '<p>corpo</p>',
      senderName: 'João Fonseca',
      unsubscribeUrl: 'https://crm.example/u',
      privacyPolicyUrl: 'https://site/privacidade',
    });
    expect(out.html).toContain('<p>corpo</p>');
    expect(out.html).toContain('href="https://crm.example/u"');
    expect(out.html).toContain('href="https://site/privacidade"');
    expect(out.html).toContain('Anular subscrição');
  });

  it('sem unsubscribeUrl mantém só a política (não rebenta)', () => {
    const out = appendComplianceFooter({
      text: 'corpo',
      html: '<p>corpo</p>',
      senderName: 'X',
      unsubscribeUrl: null,
      privacyPolicyUrl: 'https://site/privacidade',
    });
    expect(out.text).not.toContain('Anular subscrição');
    expect(out.text).toContain('https://site/privacidade');
    expect(out.html).not.toContain('Anular subscrição');
  });
});
