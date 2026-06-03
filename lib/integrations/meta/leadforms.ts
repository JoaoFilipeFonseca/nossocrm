// ============================================================================
// leadforms.ts — criar formulários de leads (instant forms) da Meta (MA-LEADFORM)
// ============================================================================
// Cria o formulário ao nível da PÁGINA (`/{page_id}/leadgen_forms`) usando um
// token de Página (obtido a partir do token de utilizador). Depois liga-se ao
// criativo do anúncio (reusa o pipeline do Tier 2). Tudo server-only.
// Em falha lança Error com mensagem PT (a Graph API é a autoridade final).
// ============================================================================
import 'server-only';
import { META_GRAPH_BASE } from './config';
import { metaErrorMessage } from './write';

async function graphGet(path: string, token: string): Promise<Record<string, unknown>> {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${META_GRAPH_BASE}/${path}${sep}access_token=${encodeURIComponent(token)}`, {
    headers: { 'User-Agent': 'FocoImoCRM/1.0' },
  });
  let json: Record<string, unknown> = {};
  try { json = (await res.json()) as Record<string, unknown>; } catch { /* corpo não-JSON */ }
  if (!res.ok) throw new Error(metaErrorMessage(json, res.status));
  return json;
}

async function graphPostForm(
  path: string,
  token: string,
  fields: Record<string, string>,
): Promise<Record<string, unknown>> {
  const body = new URLSearchParams({ ...fields, access_token: token });
  const res = await fetch(`${META_GRAPH_BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'FocoImoCRM/1.0' },
    body: body.toString(),
  });
  let json: Record<string, unknown> = {};
  try { json = (await res.json()) as Record<string, unknown>; } catch { /* corpo não-JSON */ }
  if (!res.ok) throw new Error(metaErrorMessage(json, res.status));
  return json;
}

/**
 * Obtém o token de acesso da Página a partir do token de utilizador (o criar de
 * formulários é uma operação ao nível da Página). Precisa de o utilizador ser
 * admin da Página e do token ter as permissões de Página.
 */
export async function getPageAccessToken(pageId: string, userToken: string): Promise<string> {
  const json = await graphGet(`${pageId}?fields=access_token`, userToken);
  const t = json.access_token as string | undefined;
  if (!t) throw new Error('Não foi possível obter o token da Página (precisa de ser admin da Página).');
  return t;
}

/** Uma pergunta do formulário. type = enum da Meta (FULL_NAME, PHONE, EMAIL, ...). */
export interface LeadFormQuestion {
  type: string;
  key?: string;
  label?: string;
}

export interface LeadFormSpec {
  name: string;
  questions: LeadFormQuestion[];
  privacyPolicyUrl: string;
  privacyLinkText?: string;
  followUpUrl: string;
  locale?: string;
  contextHeadline?: string;
  contextDescription?: string;
  thankYouTitle?: string;
  thankYouBody?: string;
  /** DRAFT = rascunho (não recolhe leads); ACTIVE = a sério. */
  status?: 'DRAFT' | 'ACTIVE';
}

/**
 * Cria um formulário de leads na Página. `userToken` é o token de longa duração
 * da integração (troca-se por um token de Página internamente). Devolve o id do
 * formulário. Lança Error PT em falha (capacidade/permissões são da Meta).
 */
export async function createLeadForm(
  pageId: string,
  userToken: string,
  spec: LeadFormSpec,
): Promise<{ form_id: string }> {
  if (!pageId) throw new Error('Página não seleccionada.');
  if (!spec.questions || spec.questions.length === 0) {
    throw new Error('O formulário precisa de pelo menos uma pergunta.');
  }
  const pageToken = await getPageAccessToken(pageId, userToken);

  const fields: Record<string, string> = {
    name: spec.name,
    locale: spec.locale ?? 'PT_PT',
    questions: JSON.stringify(spec.questions),
    privacy_policy: JSON.stringify({
      url: spec.privacyPolicyUrl,
      link_text: spec.privacyLinkText ?? 'Política de Privacidade',
    }),
    follow_up_action_url: spec.followUpUrl,
    status: spec.status ?? 'DRAFT',
  };
  if (spec.contextHeadline || spec.contextDescription) {
    fields.context_card = JSON.stringify({
      title: spec.contextHeadline ?? '',
      style: 'PARAGRAPH_STYLE',
      content: spec.contextDescription ? [spec.contextDescription] : [],
      button_text: 'Continuar',
    });
  }
  if (spec.thankYouTitle || spec.thankYouBody) {
    fields.thank_you_page = JSON.stringify({
      title: spec.thankYouTitle ?? 'Obrigado!',
      body: spec.thankYouBody ?? '',
      button_type: 'VIEW_WEBSITE',
      website_url: spec.followUpUrl,
      button_text: 'Visitar o site',
    });
  }

  const created = await graphPostForm(`${pageId}/leadgen_forms`, pageToken, fields);
  const id = (created.id as string) || '';
  if (!id) throw new Error('A Meta não devolveu o formulário criado.');
  return { form_id: id };
}

/** Lê um formulário (para verificar/pré-visualizar). */
export async function getLeadForm(formId: string, token: string): Promise<Record<string, unknown>> {
  return graphGet(`${formId}?fields=id,name,status,locale,questions,privacy_policy,follow_up_action_url`, token);
}
