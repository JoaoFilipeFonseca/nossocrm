/**
 * MKT-BIBLIOTECA Fatia 2 — POST /api/criativos/copy
 * Copy curta para os templates da marca (headline/sub/cta/legenda; flyer leva descrição
 * e destaques). Reusa o motor IA (getModelForFeature + runWithAIFallback) + Brand Kit +
 * dados do imóvel, no padrão do Agente de Divulgação (IMO-7). A IA nunca publica nada.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateText, Output } from 'ai';
import { createClient } from '@/lib/supabase/server';
import { createStaticAdminClient } from '@/lib/supabase/staticAdminClient';
import { getModelForFeature, type AIKeys } from '@/lib/ai/router';
import { runWithAIFallback } from '@/lib/ai/run-with-fallback';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BodySchema = z.object({
  format: z.enum(['anuncio', 'post', 'story', 'flyer']),
  imovel_id: z.string().uuid().nullable().optional(),
  briefing: z.string().max(500).nullable().optional(),
}).strict();

const CopySchema = z.object({
  headline: z.string(),
  sub: z.string(),
  cta: z.string(),
  legenda: z.string(),
  descricao: z.string(),
  destaques: z.array(z.string()),
});

const FORMAT_BRIEF: Record<string, string> = {
  anuncio: 'Criativo de anúncio Meta Ads (imagem 1080×1080). headline com gancho emocional (máximo 60 caracteres). sub com 1 frase factual (máximo 110 caracteres). cta a pedir mensagem privada com uma palavra chave (as DMs valem ouro; nada de "clique aqui"; máximo 50 caracteres). legenda = texto do anúncio (2 a 4 frases curtas).',
  post: 'Post orgânico de Facebook/Instagram. headline curta e humana (máximo 60 caracteres). sub com 1 frase (máximo 110 caracteres). cta suave a convidar a comentar ou enviar mensagem (máximo 50 caracteres). legenda = legenda completa do post (2 a 5 frases, termina com convite a falar por mensagem).',
  story: 'Capa de story/reel de Instagram (1080×1920, pouco texto). headline muito curta e forte (máximo 40 caracteres). sub com meia frase (máximo 70 caracteres). cta de 2 a 4 palavras (ex.: Envie VISITA). legenda = texto curto para acompanhar o story.',
  flyer: 'Flyer A4 para imprimir (one-pager). headline = título do imóvel (máximo 70 caracteres). sub com 1 frase (máximo 110 caracteres). cta com contacto directo (máximo 55 caracteres). legenda = nota curta. descricao = parágrafo de 2 a 3 frases sóbrias. destaques = 4 a 5 pontos fortes curtos (3 a 6 palavras cada).',
};

export async function POST(request: NextRequest) {
  if (!isAllowedOrigin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await supabase
      .from('profiles').select('organization_id').eq('id', user.id).maybeSingle();
    const orgId = profile?.organization_id as string | undefined;
    if (!orgId) return NextResponse.json({ error: 'Sem organização' }, { status: 400 });

    const raw = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    const { format, imovel_id, briefing } = parsed.data;

    let imovelBlock = 'Sem imóvel específico (peça genérica da marca).';
    if (imovel_id) {
      const { data: im } = await supabase
        .from('imoveis')
        .select('titulo_anuncio, tipo, tipologia, concelho, freguesia, preco_actual, area_util, quartos, wcs, destaques, descricao_longa, estado_conservacao')
        .eq('id', imovel_id)
        .maybeSingle();
      if (!im) return NextResponse.json({ error: 'Imóvel não encontrado' }, { status: 404 });
      imovelBlock = [
        im.titulo_anuncio ? `Título: ${im.titulo_anuncio}` : '',
        `Tipo: ${[im.tipo, im.tipologia].filter(Boolean).join(' ') || '—'}`,
        `Zona: ${[im.freguesia, im.concelho].filter(Boolean).join(', ') || '—'}`,
        im.preco_actual ? `Preço: ${new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(im.preco_actual as number)}` : '',
        im.area_util ? `Área útil: ${im.area_util} m²` : '',
        im.quartos != null ? `${im.quartos} quartos` : '',
        im.estado_conservacao ? `Estado: ${im.estado_conservacao}` : '',
        Array.isArray(im.destaques) && im.destaques.length ? `Destaques: ${im.destaques.join('; ')}` : '',
        im.descricao_longa ? `Descrição (referência): ${String(im.descricao_longa).slice(0, 500)}` : '',
      ].filter(Boolean).join('\n');
    }

    const admin = createStaticAdminClient();
    const [{ data: os }, { data: kit }] = await Promise.all([
      admin.from('organization_settings').select('ai_google_key, ai_anthropic_key').eq('organization_id', orgId).maybeSingle(),
      admin.from('ai_brand_kits').select('nome_profissional, tom_voz, proposta_unica, segmento_alvo, vocabulario_banido, frases_marca').eq('organization_id', orgId).maybeSingle(),
    ]);
    const keys: AIKeys = {};
    if (os?.ai_google_key) keys.google = os.ai_google_key;
    if (os?.ai_anthropic_key) keys.anthropic = os.ai_anthropic_key;
    const primarySel = getModelForFeature('workflow_desc', keys);
    const primary = primarySel.model;
    const fallback = getModelForFeature('workflow_desc', { anthropic: keys.anthropic }).model;
    if (!primary) return NextResponse.json({ error: 'Sem chaves de IA configuradas.' }, { status: 400 });

    const brandBlock = kit ? [
      kit.nome_profissional ? `Consultor: ${kit.nome_profissional}` : '',
      kit.tom_voz ? `Tom de voz: ${kit.tom_voz}` : '',
      kit.proposta_unica ? `Proposta única: ${kit.proposta_unica}` : '',
      kit.segmento_alvo ? `Segmento: ${kit.segmento_alvo}` : '',
      Array.isArray(kit.vocabulario_banido) && kit.vocabulario_banido.length ? `Palavras a evitar: ${kit.vocabulario_banido.join(', ')}` : '',
    ].filter(Boolean).join('\n') : 'Sem Brand Kit configurado.';

    const prompt = `És o copywriter de um consultor imobiliário de topo em Portugal (marca pessoal premium).
Escreve copy curta para uma peça gráfica, em português europeu pré acordo ortográfico de 1990, SEM traços nem hífens a separar frases, com acentuação correcta. Tom humano e sóbrio. NUNCA inventes factos (preço, áreas, equipamentos) que não estejam nos dados.

MARCA / TOM:
${brandBlock}

IMÓVEL:
${imovelBlock}
${briefing ? `\nINDICAÇÕES DO CONSULTOR: ${briefing}` : ''}

FORMATO PEDIDO:
${FORMAT_BRIEF[format]}

Devolve JSON com headline, sub, cta, legenda, descricao e destaques (devolve descricao vazia e destaques [] se o formato não os pedir). Respeita os limites de caracteres indicados. Trata o leitor por "você"; nunca proponhas Domingos; sem placeholders entre parênteses rectos.`;

    const { result } = await runWithAIFallback(
      () => generateText({ model: primary, prompt, output: Output.object({ schema: CopySchema }) }),
      fallback && fallback !== primary
        ? () => generateText({ model: fallback, prompt, output: Output.object({ schema: CopySchema }) })
        : null,
    );
    const out = result.output as z.infer<typeof CopySchema>;

    return NextResponse.json({ ok: true, copy: out });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 200 });
  }
}
