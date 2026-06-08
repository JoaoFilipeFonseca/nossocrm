/**
 * POST /api/social-inbox/[id]/draft — SOCIAL-INBOX Fatia 2.
 *
 * Gera (ou regenera) o rascunho de resposta a uma DM, no tom do João, a partir da conversa
 * guardada + contexto do contacto (Contact360) quando houver. A IA NUNCA envia — o rascunho
 * fica para o João rever e enviar. Reusa o motor IA (getModelForFeature + runWithAIFallback +
 * Output.object), tal como o Assistente 360. Não precisa do token da Meta (lê da BD + IA).
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateText, Output } from 'ai';
import { createClient } from '@/lib/supabase/server';
import { createStaticAdminClient } from '@/lib/supabase/staticAdminClient';
import { getModelForFeature, type AIKeys } from '@/lib/ai/router';
import { runWithAIFallback } from '@/lib/ai/run-with-fallback';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { getContact360Context } from '@/lib/contacts/detail';

export const dynamic = 'force-dynamic';

const DraftSchema = z.object({ text: z.string() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .maybeSingle();
    const orgId = (profile as { organization_id?: string } | null)?.organization_id;
    if (!orgId) return NextResponse.json({ error: 'Sem organização' }, { status: 400 });

    // Conversa (RLS valida a org da sessão).
    const { data: conv } = await supabase
      .from('social_conversations')
      .select('id, participant_name, contact_id, platform')
      .eq('id', id)
      .maybeSingle();
    if (!conv) return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 });

    const { data: msgs } = await supabase
      .from('social_messages')
      .select('from_side, body, sent_at')
      .eq('conversation_id', id)
      .order('sent_at', { ascending: true })
      .limit(12);

    // Chaves de IA da org (service-role).
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

    // Contexto do contacto (se ligado).
    let contactBlock = 'Sem ficha de contacto ligada.';
    if (conv.contact_id) {
      try {
        const ctx = await getContact360Context(conv.contact_id as string);
        if (ctx && ctx.contact.organizationId === orgId) {
          const cf = ctx.contact.customFields ?? {};
          contactBlock = [
            `Nome: ${ctx.contact.name}`,
            cf.disc ? `DISC: ${cf.disc}` : '',
            cf.triggers?.length ? `Gatilhos: ${cf.triggers.join(', ')}` : '',
            cf.address ? `Investimento/morada: ${cf.address}` : '',
            `Negócios: ${ctx.deals.open} abertos, ${ctx.deals.won} ganhos`,
            ctx.deals.recent?.length ? `Recentes: ${ctx.deals.recent.map((d) => d.title).join('; ')}` : '',
          ]
            .filter(Boolean)
            .join('\n');
        }
      } catch {
        /* contexto best-effort */
      }
    }

    const conversa = (msgs ?? [])
      .map((m) => `${m.from_side === 'us' ? 'João' : conv.participant_name || 'Pessoa'}: ${m.body ?? ''}`)
      .join('\n');

    const prompt = `És o assistente de um consultor imobiliário de topo em Portugal (marca pessoal premium).
Uma pessoa enviou mensagens directas (DM) na página de Facebook do consultor. Escreve UMA resposta curta para o consultor ENVIAR (ele revê antes), em português europeu pré acordo ortográfico (1990), SEM traços nem hífens, com acentuação e cedilhas correctas, tom humano e de proximidade.

Regras absolutas:
- Trata a pessoa por "você". Usa "Quando lhe for oportuno" em vez de "quando lhe der jeito". Nunca proponhas Domingos.
- Termina com um CTA que peça resposta (convidar a marcar uma conversa/visita), nunca só "clique aqui".
- NÃO inventes factos que não estejam no contexto (preço, morada, disponibilidade). Se a pessoa pede algo que não sabes, convida a falar e pede os detalhes que faltam.
- NUNCA uses placeholders entre parênteses rectos ([Nome], [Seu Nome], [...]). Não incluas assinatura final (o consultor assina depois).
- Resposta curta (2 a 5 frases), pronta a enviar.

CONTEXTO DO CONTACTO:
${contactBlock}

CONVERSA (mais antiga em cima, a última mensagem é da pessoa a precisar de resposta):
${conversa || '(sem mensagens)'}

Devolve só o campo "text" com a resposta.`;

    const { result } = await runWithAIFallback(
      () => generateText({ model: primary, prompt, output: Output.object({ schema: DraftSchema }) }),
      fallback && fallback !== primary
        ? () => generateText({ model: fallback, prompt, output: Output.object({ schema: DraftSchema }) })
        : null,
    );
    const out = result.output as z.infer<typeof DraftSchema>;
    const draft = (out.text ?? '').trim();

    // Guarda o rascunho (best-effort).
    const nowISO = new Date().toISOString();
    try {
      await admin
        .from('social_conversations')
        .update({ ai_draft: draft, ai_draft_at: nowISO })
        .eq('id', id)
        .eq('organization_id', orgId);
    } catch {
      /* nao falha a resposta */
    }

    return NextResponse.json({ ok: true, draft, ai_draft_at: nowISO });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 200 });
  }
}
