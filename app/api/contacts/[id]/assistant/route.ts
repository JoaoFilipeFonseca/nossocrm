/**
 * POST /api/contacts/[id]/assistant — CONTACT-360-AI Fase 1.
 *
 * Gera, a pedido, o Retrato 360 + Próxima melhor acção + mensagem pronta
 * (WhatsApp/Email) a partir de tudo o que o CRM sabe da pessoa.
 * Auth por sessão (RLS valida a org no contexto); chaves de IA lidas por
 * service-role (organization_settings), tal como o analista de anúncios.
 * Reusa o motor IA: getModelForFeature + runWithAIFallback + Output.object.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateText, Output } from 'ai';
import { createClient } from '@/lib/supabase/server';
import { createStaticAdminClient } from '@/lib/supabase/staticAdminClient';
import { getModelForFeature, type AIKeys } from '@/lib/ai/router';
import { runWithAIFallback } from '@/lib/ai/run-with-fallback';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { getContact360Context, type Contact360Context } from '@/lib/contacts/detail';
import type { ContactCustomFields } from '@/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const AssistantSchema = z.object({
  retrato: z.string(),
  sinais: z.array(z.string()).max(6),
  proximaAccao: z.object({
    titulo: z.string(),
    porque: z.string(),
    confianca: z.enum(['alta', 'media', 'baixa']),
  }),
  mensagens: z.object({
    whatsapp: z.string(),
    email: z.object({ assunto: z.string(), corpo: z.string() }),
  }),
  sugestoes: z
    .array(
      z.object({
        campo: z.enum(['disc', 'triggers', 'quarter', 'familyMembers', 'pets', 'address']),
        valor: z.string(),
        rotulo: z.string(),
      }),
    )
    .max(6),
});

const DISC_LABEL: Record<string, string> = {
  D: 'D (Dominante)', I: 'I (Influente)', S: 'S (Estável)', C: 'C (Consciencioso)',
};

function fmtDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/Lisbon' });
}

function buildContextText(ctx: Contact360Context): string {
  const c = ctx.contact;
  const cf: ContactCustomFields = c.customFields ?? {};
  const lines: string[] = [];
  lines.push(`Nome: ${c.name}`);
  if (c.role) lines.push(`Cargo/relação: ${c.role}`);
  lines.push(`Estado: ${c.status} · Etapa: ${c.stage || 'n/d'}`);
  if (cf.disc) lines.push(`Perfil DISC: ${DISC_LABEL[cf.disc] ?? cf.disc}`);
  if (cf.address) lines.push(`Morada/Investimento: ${cf.address}`);
  if (cf.familyMembers) lines.push(`Família: ${cf.familyMembers}`);
  if (cf.pets) lines.push(`Animais: ${cf.pets}`);
  if (cf.triggers?.length) lines.push(`Triggers: ${cf.triggers.join(', ')}`);
  if (cf.quarter) lines.push(`Trimestre-alvo: ${cf.quarter}`);
  const birth = fmtDate(c.birthDate);
  if (birth) lines.push(`Aniversário: ${birth}`);
  const la = fmtDate(cf.lastActivityDate);
  if (la) lines.push(`Última actividade: ${la}${cf.lastActivityNote ? ' — ' + cf.lastActivityNote : ''}`);
  if (cf.followUp) lines.push(`Follow up marcado: ${fmtDate(cf.followUpDate) ?? 'sim'}`);
  if (c.notes) lines.push(`Notas: ${c.notes}`);

  if (c.attribution?.source === 'meta_ads') {
    const a = c.attribution;
    lines.push(`Origem (anúncio Meta): campanha ${a.campaign_name || a.campaign_id || 'n/d'}; anúncio ${a.ad_name || a.ad_id || 'n/d'}; formulário ${a.form_name || 'n/d'}`);
  }
  if (ctx.referrals.referredBy.length) lines.push(`Indicado por: ${ctx.referrals.referredBy.map((r) => r.name).join(', ')}`);
  if (ctx.referrals.referred.length) lines.push(`Indicou: ${ctx.referrals.referred.map((r) => r.name).join(', ')}`);

  lines.push(`Negócios: ${ctx.deals.open} abertos, ${ctx.deals.won} ganhos, ${ctx.deals.lost} perdidos.`);
  if (ctx.deals.recent.length) {
    lines.push('Negócios recentes:');
    for (const d of ctx.deals.recent) lines.push(`  - ${d.title} (${d.state}, ${d.value} EUR)`);
  }
  if (ctx.activities.length) {
    lines.push('Actividades recentes:');
    for (const a of ctx.activities.slice(0, 10)) lines.push(`  - ${a.type}${a.description ? ': ' + a.description : ''} (${fmtDate(a.at)})`);
  }
  if (ctx.comments.length) {
    lines.push('Comentários recentes:');
    for (const cm of ctx.comments.slice(0, 6)) lines.push(`  - ${cm.author}: ${cm.body}`);
  }
  return lines.join('\n');
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { id: contactId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).maybeSingle();
    const orgId = (profile as { organization_id?: string } | null)?.organization_id;
    if (!orgId) return NextResponse.json({ error: 'Sem organização' }, { status: 400 });

    // Contexto 360 (via sessão + RLS — só devolve se o contacto for acessível).
    const ctx = await getContact360Context(contactId);
    if (!ctx || ctx.contact.organizationId !== orgId) {
      return NextResponse.json({ error: 'Contacto não encontrado' }, { status: 404 });
    }

    // Chaves de IA da org (service-role, como o analista de anúncios).
    const admin = createStaticAdminClient();
    const { data: os } = await admin
      .from('organization_settings')
      .select('ai_google_key, ai_anthropic_key')
      .eq('organization_id', orgId)
      .maybeSingle();
    const keys: AIKeys = {};
    if (os?.ai_google_key) keys.google = os.ai_google_key;
    if (os?.ai_anthropic_key) keys.anthropic = os.ai_anthropic_key;

    const primary = getModelForFeature('generic', keys).model;
    const fallback = getModelForFeature('generic', { anthropic: keys.anthropic }).model;
    if (!primary) {
      return NextResponse.json({ error: 'Sem chaves de IA configuradas para esta organização.' }, { status: 400 });
    }

    const contextText = buildContextText(ctx);
    const prompt = `És o assistente de um consultor imobiliário de topo em Portugal (marca pessoal premium).
Com base APENAS nos dados abaixo sobre uma pessoa do CRM, produz, em português europeu pré acordo ortográfico (1990), SEM traços nem hífens, tom humano e de proximidade:

1) "retrato": um parágrafo curto (3 a 5 frases) que sintetiza quem é a pessoa, em que fase está, o que a move e o que importa para a próxima conversa. Não inventes dados que não estão abaixo.
2) "sinais": 2 a 4 sinais-chave muito curtos (ex.: "Urgência: mudar antes de Setembro").
3) "proximaAccao": a melhor próxima acção concreta (titulo curto + porque + confianca: alta/media/baixa conforme os dados disponíveis).
4) "mensagens": uma mensagem pronta a enviar, à medida desta pessoa:
   - "whatsapp": texto curto e caloroso, com um CTA que peça resposta (convidar a responder/marcar), nunca só "clica aqui". Trata por "você". Usa "Quando lhe for oportuno" em vez de "quando lhe der jeito". Nunca proponhas Domingos.
   - "email": { "assunto", "corpo" } no mesmo tom, um pouco mais completo.
5) "sugestoes": campos da ficha que consegues inferir COM EVIDÊNCIA nos dados abaixo (NÃO inventes). Para cada: "campo" (um de: disc, triggers, quarter, familyMembers, pets, address), "valor" (texto curto; para disc usa SÓ a letra D, I, S ou C; para triggers um único trigger por sugestão), "rotulo" (frase curta para o consultor, ex.: "Novo trigger: Crédito aprovado"). NÃO sugiras um campo que já esteja preenchido com esse valor. Se não houver nada com evidência clara, devolve lista vazia.

Regras absolutas:
- Português europeu pré acordo ortográfico (1990), sem brasileirismos.
- Usa SEMPRE a acentuação e cedilhas correctas (ção, ã, á, é, í, ó, ú, à, ç). "Sem traços" refere-se APENAS a hífens e travessões (- ou —), NUNCA aos acentos. Mesmo que os dados de entrada venham sem acentos, escreve tu com os acentos correctos.
- NUNCA uses placeholders entre parênteses rectos (ex.: [Nome], [Seu Nome], [Nome do Consultor], [...]). Não incluas o nome do consultor nem assinatura final; termina a mensagem de forma natural (o consultor assina depois).
- Se faltarem dados, mantém-te genérico mas útil; não inventes factos.

DADOS DA PESSOA:
${contextText}`;

    const { result } = await runWithAIFallback(
      () => generateText({ model: primary, prompt, output: Output.object({ schema: AssistantSchema }) }),
      fallback && fallback !== primary ? () => generateText({ model: fallback, prompt, output: Output.object({ schema: AssistantSchema }) }) : null,
    );
    const out = result.output as z.infer<typeof AssistantSchema>;

    // Fase 3 — guarda a análise (best-effort; não falha a resposta).
    let analyzedAt: string | null = null;
    try {
      const { data: saved } = await admin
        .from('contact_ai_analyses')
        .insert({ organization_id: orgId, contact_id: contactId, created_by: user.id, result: out })
        .select('created_at')
        .single();
      analyzedAt = saved?.created_at ?? null;
    } catch (e) {
      console.error('[contact-360] guardar análise falhou:', e instanceof Error ? e.message : e);
    }

    return NextResponse.json({ ok: true, assistant: out, analyzedAt });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('[contact-360] falhou:', msg);
    return NextResponse.json({ error: 'Não foi possível gerar a análise agora. Tente novamente.' }, { status: 500 });
  }
}
