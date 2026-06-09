/**
 * IMO-7 Fase 3 — Plano de divulgação passo a passo.
 *
 * POST /api/imoveis/[id]/divulgacao/plano → a IA monta um plano de divulgação à medida deste
 *   imóvel + comprador-ideal (passos accionáveis na ordem certa). Cria versão nova (coluna plano).
 *   Reusa o motor IA (texto) + Brand Kit + dados do imóvel. A IA prepara; o João executa.
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

const ACCOES = ['fotos', 'portais', 'anuncio', 'cruzamentos', 'acompanhar', 'nenhuma'] as const;
const PassoSchema = z.object({
  titulo: z.string(),
  descricao: z.string(),
  accao: z.enum(ACCOES),
});
const PlanoSchema = z.object({ passos: z.array(PassoSchema) });
type PlanoOut = z.infer<typeof PlanoSchema>;

function eur(n: number | null | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await supabase
      .from('profiles').select('organization_id').eq('id', user.id).maybeSingle();
    const orgId = (profile as { organization_id?: string } | null)?.organization_id;
    if (!orgId) return NextResponse.json({ error: 'Sem organização' }, { status: 400 });

    const { data: imovel } = await supabase
      .from('imoveis')
      .select('id, organization_id, titulo_anuncio, tipologia, tipo, concelho, freguesia, preco_actual, area_util, publico_alvo, publicado_em')
      .eq('id', id).maybeSingle();
    if (!imovel || imovel.organization_id !== orgId) {
      return NextResponse.json({ error: 'Imóvel não encontrado' }, { status: 404 });
    }

    const admin = createStaticAdminClient();
    const [{ data: os }, { data: kit }] = await Promise.all([
      admin.from('organization_settings').select('ai_google_key, ai_anthropic_key').eq('organization_id', orgId).maybeSingle(),
      admin.from('ai_brand_kits').select('nome_profissional, tom_voz, segmento_alvo').eq('organization_id', orgId).maybeSingle(),
    ]);
    const keys: AIKeys = {};
    if (os?.ai_google_key) keys.google = os.ai_google_key;
    if (os?.ai_anthropic_key) keys.anthropic = os.ai_anthropic_key;
    const primarySel = getModelForFeature('workflow_desc', keys);
    const primary = primarySel.model;
    const fallback = getModelForFeature('workflow_desc', { anthropic: keys.anthropic }).model;
    if (!primary) {
      return NextResponse.json({ error: 'Sem chaves de IA configuradas para esta organização.' }, { status: 400 });
    }

    const jaPublicado = Array.isArray(imovel.publicado_em) && imovel.publicado_em.length
      ? `Já publicado em: ${imovel.publicado_em.join(', ')}.` : 'Ainda não está publicado em portais.';
    const imovelBlock = [
      `Imóvel: ${[imovel.tipologia, imovel.tipo, imovel.titulo_anuncio].filter(Boolean).join(' · ') || '—'}`,
      `Local: ${[imovel.freguesia, imovel.concelho].filter(Boolean).join(', ') || '—'}`,
      `Preço: ${eur(imovel.preco_actual as number | null)}`,
      imovel.area_util ? `Área útil: ${imovel.area_util} m²` : '',
      Array.isArray(imovel.publico_alvo) && imovel.publico_alvo.length ? `Comprador-alvo: ${imovel.publico_alvo.join('; ')}` : '',
      jaPublicado,
    ].filter(Boolean).join('\n');

    const prompt = `És o agente de divulgação de um consultor imobiliário de topo em Portugal${kit?.nome_profissional ? ` (${kit.nome_profissional})` : ''}.
Monta um PLANO DE DIVULGAÇÃO passo a passo, à medida deste imóvel e do seu comprador-alvo, em português europeu pré acordo ortográfico de 1990, SEM traços nem hífens a separar frases, com acentuação correcta. Ordena os passos do que faz primeiro para o que faz depois. Sê concreto e accionável (não genérico). NÃO inventes factos.

${imovelBlock}

Devolve em JSON um array "passos" (5 a 7 passos). Cada passo: { titulo (curto), descricao (1 a 2 frases concretas para este imóvel), accao }.
O campo "accao" liga o passo a uma zona do CRM e tem de ser EXACTAMENTE um destes valores:
- "fotos": preparar/ordenar as fotos do anúncio.
- "portais": publicar nos portais (RE/MAX, Idealista) com a copy de cada um.
- "anuncio": criar um anúncio pago na Meta para captar leads (sugere um foco; o orçamento decide-se depois).
- "cruzamentos": avisar compradores compatíveis que já existem na base do CRM.
- "acompanhar": acompanhar resultados e renovar (rever capa/preço/ângulo se não houver visitas).
- "nenhuma": passo sem ligação directa a uma zona do CRM.
Alinha a comunicação paga com as boas práticas actuais da Meta (o criativo capta; CTA a pedir mensagem privada).`;

    const { result, via } = await runWithAIFallback(
      () => generateText({ model: primary, prompt, output: Output.object({ schema: PlanoSchema }) }),
      fallback && fallback !== primary
        ? () => generateText({ model: fallback, prompt, output: Output.object({ schema: PlanoSchema }) })
        : null,
    );
    const out = result.output as PlanoOut;

    const { data: lastRow } = await admin
      .from('imovel_divulgacao').select('versao').eq('imovel_id', id).order('versao', { ascending: false }).limit(1).maybeSingle();
    const versao = ((lastRow?.versao as number | undefined) ?? 0) + 1;
    const modelo = via === 'fallback' ? `${primarySel.providerLabel} (fallback)` : primarySel.providerLabel;

    const { data: inserted, error: insErr } = await admin
      .from('imovel_divulgacao')
      .insert({ organization_id: orgId, imovel_id: id, versao, plano: out, modelo, created_by: user.id })
      .select('id, versao, plano, modelo, created_at')
      .maybeSingle();
    if (insErr) throw new Error(insErr.message);

    return NextResponse.json({ ok: true, version: inserted });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 200 });
  }
}
