import { describe, it, expect } from 'vitest';
import {
  metaRedirectUri,
  metaTokenSecretName,
  META_OAUTH_SCOPES,
  META_OAUTH_DIALOG,
} from './config';

describe('meta config', () => {
  it('constrói a URL de callback exacta (tem de bater com a app Meta)', () => {
    expect(metaRedirectUri('https://crm-joao.vercel.app')).toBe(
      'https://crm-joao.vercel.app/api/integrations/meta/oauth/callback',
    );
  });

  it('nome do segredo do token é estável por integração', () => {
    expect(metaTokenSecretName('abc-123')).toBe('meta_oauth_token_abc-123');
  });

  it('pede as permissões necessárias para leads e métricas', () => {
    expect(META_OAUTH_SCOPES).toContain('leads_retrieval');
    expect(META_OAUTH_SCOPES).toContain('pages_show_list');
    expect(META_OAUTH_SCOPES).toContain('ads_read');
  });

  it('usa o diálogo OAuth do Facebook na versão configurada', () => {
    expect(META_OAUTH_DIALOG).toMatch(/^https:\/\/www\.facebook\.com\/v\d+\.\d+\/dialog\/oauth$/);
  });
});
