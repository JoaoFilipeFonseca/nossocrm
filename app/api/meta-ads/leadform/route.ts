// POST /api/meta-ads/leadform — cria um formulário de leads (instant form) na
// Página, a partir do CRM (MA-LEADFORM). Admin + org-scoped + audit. Nunca 5xx
// em erro lógico. status DRAFT = rascunho (não recolhe leads); ACTIVE = a sério.
// A ligação do formulário ao anúncio é um passo seguinte (reusa o Tier 2).
export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { resolveMetaAdminContext, metaJson } from '@/lib/integrations/meta/server';
import { createLeadForm } from '@/lib/integrations/meta/leadforms';

// Tipos de pergunta suportados (enum da Meta). Mantemos um allowlist curto e
// útil para imobiliário; o telefone é obrigatório por regra de proveniência.
const QUESTION_TYPES = ['FULL_NAME', 'PHONE', 'EMAIL', 'CITY', 'POST_CODE', 'STREET_ADDRESS'] as const;

const Schema = z.object({
  name: z.string().min(1).max(200),
  privacy_url: z.string().url().max(2000),
  follow_up_url: z.string().url().max(2000),
  question_types: z.array(z.enum(QUESTION_TYPES)).min(1).max(10).optional(),
  custom_questions: z.array(z.string().min(1).max(120)).max(5).optional(),
  locale: z.string().max(10).optional(),
  context_headline: z.string().max(120).optional(),
  context_description: z.string().max(600).optional(),
  thank_you_title: z.string().max(120).optional(),
  thank_you_body: z.string().max(600).optional(),
  status: z.enum(['DRAFT', 'ACTIVE']).optional(),
});

export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) return metaJson({ error: 'Forbidden' }, 403);

  const resolved = await resolveMetaAdminContext();
  if (resolved.error) return resolved.error;
  const c = resolved.ctx;
  if (!c.pageId) return metaJson({ error: 'Página não seleccionada na integração Meta.' }, 200);

  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await req.json());
  } catch {
    return metaJson({ error: 'Pedido inválido.' }, 400);
  }

  // Perguntas: tipos predefinidos (telefone garantido) + perguntas livres.
  const types = body.question_types ?? ['FULL_NAME', 'PHONE', 'EMAIL'];
  if (!types.includes('PHONE')) types.push('PHONE'); // proveniência: telefone obrigatório
  const questions = [
    ...types.map((type) => ({ type })),
    ...(body.custom_questions ?? []).map((label) => ({ type: 'CUSTOM', label })),
  ];

  try {
    const { form_id } = await createLeadForm(c.pageId, c.token, {
      name: body.name,
      questions,
      privacyPolicyUrl: body.privacy_url,
      followUpUrl: body.follow_up_url,
      locale: body.locale,
      contextHeadline: body.context_headline,
      contextDescription: body.context_description,
      thankYouTitle: body.thank_you_title,
      thankYouBody: body.thank_you_body,
      status: body.status ?? 'DRAFT',
    });

    await c.admin.from('audit_logs').insert({
      user_id: c.userId,
      organization_id: c.orgId,
      action: 'META_LEADFORM_CREATE',
      resource_type: 'meta_leadform',
      resource_id: c.integrationId,
      severity: 'warning',
      details: { form_id, name: body.name, status: body.status ?? 'DRAFT', page_id: c.pageId },
    });

    return metaJson({ ok: true, form_id });
  } catch (e) {
    return metaJson({ error: e instanceof Error ? e.message : 'Não foi possível criar o formulário.' }, 200);
  }
}
