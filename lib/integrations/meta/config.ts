// ============================================================================
// config.ts — constantes da integração Meta Ads (Graph API + OAuth)
// ============================================================================
// Épico Meta Ads, Fase A. Valores partilhados entre rotas server e helpers.
// A versão da Graph API é uma constante única para ser fácil de actualizar.
// ============================================================================

export const META_GRAPH_VERSION = 'v21.0';
export const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
export const META_OAUTH_DIALOG = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`;

// Permissões pedidas no diálogo de autorização.
// Fase A precisa de leads + páginas; ads_read/business_management preparam a
// Fase B (métricas). Em modo de desenvolvimento o João (admin/tester) usa
// todas sem App Review.
export const META_OAUTH_SCOPES = [
  'leads_retrieval',
  'pages_show_list',
  'pages_manage_metadata',
  'pages_read_engagement',
  'ads_read',
  'business_management',
].join(',');

// Nome canónico do segredo do Vault que guarda o token de longa duração de uma
// integração. Mantido em sincronia com as RPCs meta_oauth_store/read_token.
export function metaTokenSecretName(integrationId: string): string {
  return `meta_oauth_token_${integrationId}`;
}

// URL de callback do OAuth. Tem de coincidir exactamente com uma das
// "Valid OAuth Redirect URIs" configuradas na app Meta.
export function metaRedirectUri(origin: string): string {
  return `${origin}/api/integrations/meta/oauth/callback`;
}
