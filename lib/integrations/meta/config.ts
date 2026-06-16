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
// Fase B (métricas); ads_management permite a edição (MA-EDIT: pausar/reactivar
// anúncios e alterar orçamento do adset). Em modo de desenvolvimento o João
// (admin/tester) usa todas sem App Review. Ao acrescentar scopes, a conta tem
// de ser religada para a Meta conceder a nova permissão ao token.
export const META_OAUTH_SCOPES = [
  'leads_retrieval',
  'pages_show_list',
  'pages_manage_metadata',
  'pages_read_engagement',
  'pages_manage_ads', // MA-LEADFORM: criar/gerir formulários de leads da Página
  'ads_read',
  'ads_management',
  'business_management',
  // SOCIAL-INBOX (DMs): ler/responder DMs do Messenger + Instagram. Avançadas →
  // App Review provável para uso live; o João (admin) testa em modo de desenvolvimento.
  'pages_messaging', // Facebook Messenger (receber/enviar DMs da Página)
  'instagram_basic', // ler a conta Instagram Business ligada à Página
  'instagram_manage_messages', // Instagram DM (receber/enviar)
  // ORG-IG Fatia 2 (Alcance/Impressões orgânicas) — Página FB + conta IG.
  // Avançadas (App Review p/ live); o João (admin/tester) usa em modo de
  // desenvolvimento. Exige RELIGAR a conta para a Meta conceder ao token.
  'read_insights', // Alcance/impressões orgânicas da Página de Facebook
  'instagram_manage_insights', // Alcance/impressões/guardados da conta Instagram
].join(',');

// Nome canónico do segredo do Vault que guarda o token de longa duração de uma
// integração. Mantido em sincronia com as RPCs meta_oauth_store/read_token.
export function metaTokenSecretName(integrationId: string): string {
  return `meta_oauth_token_${integrationId}`;
}

// MA-CAPI — Conjunto de dados ("dataset"/Pixel) para onde a API de Conversões
// envia os eventos do servidor (negócio ganho → Meta). É o "João Fonseca Online".
// NOTA: por agora é uma constante; quando existir a MA-ASSET-HUB passa a vir do
// metadata da integração (cada consultor terá o seu). Reutiliza-se o mesmo token
// de longa duração do Vault (scope ads_management) — não precisa de token novo.
export const META_CAPI_DATASET_ID = '226877513589288';

// URL de callback do OAuth. Tem de coincidir exactamente com uma das
// "Valid OAuth Redirect URIs" configuradas na app Meta.
export function metaRedirectUri(origin: string): string {
  return `${origin}/api/integrations/meta/oauth/callback`;
}
