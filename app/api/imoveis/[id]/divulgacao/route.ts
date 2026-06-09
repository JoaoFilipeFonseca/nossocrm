/**
 * IMO-7 Fase 1 — Agente de Divulgação do Imóvel.
 *
 * POST /api/imoveis/[id]/divulgacao  → gera uma VERSÃO NOVA (comprador-ideal + copy dos 3 canais),
 *   reusando o motor IA (getModelForFeature + runWithAIFallback + Output.object) + Brand Kit + dados
 *   do imóvel. Nunca sobrescreve: cada geração é uma versão (histórico para comparar e a IA aprender).
 * GET /api/imoveis/[id]/divulgacao   → última versão + lista do histórico (id/versão/data).
 *
 * A IA NÃO publica nada — prepara textos para o João rever/copiar (HITL total).
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

const CanalSchema = z.object({ titulo: z.string(), corpo: z.string() });
const MetaSchema = z.object({ titulo: z.string(), corpo: z.string(), cta: z.string() });
const DivulgacaoSchema = z.object({
  comprador_ideal: z.object({
    perfis: z.array(z.string()),
    angulo: z.string(),
  }),
  copy_canais: z.object({
    remax: CanalSchema,
    idealista: CanalSchema,
    meta: MetaSchema,
  }),
});
type Divulgacao = z.infer<typeof DivulgacaoSchema>;

function eur(n: number | null | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // RLS valida a org da sessão.
    const { data: rows } = await supabase
      .from('imovel_divulgacao')
      .select('id, versao, comprador_ideal, copy_canais, modelo, created_at')
      .eq('imovel_id', id)
      .order('versao', { ascending: false })
      .limit(30);

    const list = rows ?? [];
    // Devolve as versões completas (1 utilizador, máx 30) para alternar/comparar sem chamada extra.
    return NextResponse.json({ ok: true, latest: list[0] ?? null, versions: list });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 200 });
  }
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

    // Imóvel (RLS valida a org). Só os campos que importam à copy.
    const { data: imovel } = await supabase
      .from('imoveis')
      .select('id, organization_id, titulo_anuncio, tipo, subtipo, tipologia, concelho, freguesia, distrito, preco_actual, area_util, area_terreno, quartos, quartos_suite, wcs, ano_construcao, ano_remodelacao, certificado_energetico, estado_conservacao, vista, orientacao, destaques, publico_alvo, descricao_longa, caracteristicas')
      .eq('id', id)
      .maybeSingle();
    if (!imovel || imovel.organization_id !== orgId) {
      return NextResponse.json({ error: 'Imóvel não encontrado' }, { status: 404 });
    }

    // Chaves de IA + Brand Kit (service-role).
    const admin = createStaticAdminClient();
    const [{ data: os }, { data: kit }] = await Promise.all([
      admin.from('organization_settings').select('ai_google_key, ai_anthropic_key').eq('organization_id', orgId).maybeSingle(),
      admin.from('ai_brand_kits').select('nome_profissional, tom_voz, filosofia, pilares, proposta_unica, segmento_alvo, vocabulario_banido, frases_marca').eq('organization_id', orgId).maybeSingle(),
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

    // Características activas (chaves true do jsonb).
    const caracs = imovel.caracteristicas && typeof imovel.caracteristicas === 'object'
      ? Object.entries(imovel.caracteristicas as Record<string, boolean>).filter(([, v]) => v).map(([k]) => k)
      : [];

    const imovelBlock = [
      imovel.titulo_anuncio ? `Título actual: ${imovel.titulo_anuncio}` : '',
      `Tipo: ${[imovel.tipo, imovel.subtipo, imovel.tipologia].filter(Boolean).join(' · ') || '—'}`,
      `Localização: ${[imovel.freguesia, imovel.concelho, imovel.distrito].filter(Boolean).join(', ') || '—'}`,
      `Preço: ${eur(imovel.preco_actual as number | null)}`,
      imovel.area_util ? `Área útil: ${imovel.area_util} m²` : '',
      imovel.area_terreno ? `Terreno: ${imovel.area_terreno} m²` : '',
      [imovel.quartos != null ? `${imovel.quartos} quartos` : '', imovel.quartos_suite ? `${imovel.quartos_suite} suites` : '', imovel.wcs != null ? `${imovel.wcs} WC` : ''].filter(Boolean).join(', '),
      imovel.estado_conservacao ? `Estado: ${imovel.estado_conservacao}` : '',
      imovel.ano_construcao ? `Ano construção: ${imovel.ano_construcao}` : '',
      imovel.certificado_energetico ? `Certificado energético: ${imovel.certificado_energetico}` : '',
      imovel.vista ? `Vista: ${imovel.vista}` : '',
      imovel.orientacao ? `Orientação: ${imovel.orientacao}` : '',
      Array.isArray(imovel.destaques) && imovel.destaques.length ? `Destaques: ${imovel.destaques.join('; ')}` : '',
      caracs.length ? `Equipamentos: ${caracs.join(', ')}` : '',
      Array.isArray(imovel.publico_alvo) && imovel.publico_alvo.length ? `Público-alvo registado: ${imovel.publico_alvo.join('; ')}` : '',
      imovel.descricao_longa ? `Descrição existente (referência, não copiar): ${String(imovel.descricao_longa).slice(0, 600)}` : '',
    ].filter(Boolean).join('\n');

    const banidas = Array.isArray(kit?.vocabulario_banido) && kit!.vocabulario_banido.length
      ? `Palavras a evitar (do Brand Kit): ${kit!.vocabulario_banido.join(', ')}.` : '';
    const brandBlock = kit ? [
      kit.nome_profissional ? `Consultor: ${kit.nome_profissional}` : '',
      kit.tom_voz ? `Tom de voz: ${kit.tom_voz}` : '',
      kit.proposta_unica ? `Proposta única: ${kit.proposta_unica}` : '',
      kit.segmento_alvo ? `Segmento: ${kit.segmento_alvo}` : '',
      Array.isArray(kit.pilares) && kit.pilares.length ? `Pilares: ${kit.pilares.join(', ')}` : '',
      Array.isArray(kit.frases_marca) && kit.frases_marca.length ? `Frases de marca: ${kit.frases_marca.join(' | ')}` : '',
      banidas,
    ].filter(Boolean).join('\n') : 'Sem Brand Kit configurado.';

    const prompt = `És o agente de divulgação de um consultor imobiliário de topo em Portugal (marca pessoal premium).
A partir dos dados de um imóvel, prepara material de divulgação pronto a publicar, em português europeu pré acordo ortográfico de 1990, SEM traços nem hífens a separar frases, com acentuação e cedilhas correctas. Tom humano, sóbrio e profissional. NUNCA inventes factos que não estejam nos dados (não inventes preço, áreas, equipamentos nem disponibilidade).

MARCA / TOM:
${brandBlock}

IMÓVEL:
${imovelBlock}

Produz, em JSON, três coisas:
1) comprador_ideal: { perfis: 2 a 3 perfis curtos do comprador mais provável (cruza o público-alvo, a zona, a tipologia e o preço); angulo: 1 a 2 frases com o ângulo de comunicação que melhor vende este imóvel a esse comprador }.
2) copy_canais.remax: anúncio para o portal RE/MAX. titulo curto (máximo 80 caracteres). corpo institucional e completo (3 a 4 parágrafos), termina com convite a marcar visita. Sem placeholders, sem assinatura.
3) copy_canais.idealista: anúncio para o Idealista. titulo curto e factual (máximo 60 caracteres). corpo mais curto e direto que o do RE/MAX (1 a 2 parágrafos), factual, foca características e localização.
4) copy_canais.meta: anúncio para Meta Ads (Facebook/Instagram). titulo curto e com gancho. corpo curto (2 a 4 frases) com gancho emocional alinhado ao comprador ideal. cta a pedir resposta privada por mensagem (as DMs valem ouro), por exemplo convidar a enviar mensagem com uma palavra chave. Nada de "clique aqui".

Regras de copy: trata o leitor por "você"; usa "Quando lhe for oportuno" se precisares de marcar disponibilidade; nunca proponhas Domingos; não uses placeholders entre parênteses rectos.`;

    const { result, via } = await runWithAIFallback(
      () => generateText({ model: primary, prompt, output: Output.object({ schema: DivulgacaoSchema }) }),
      fallback && fallback !== primary
        ? () => generateText({ model: fallback, prompt, output: Output.object({ schema: DivulgacaoSchema }) })
        : null,
    );
    const out = result.output as Divulgacao;

    // Próxima versão (atómico o suficiente para uso de 1 utilizador).
    const { data: lastRow } = await admin
      .from('imovel_divulgacao')
      .select('versao')
      .eq('imovel_id', id)
      .order('versao', { ascending: false })
      .limit(1)
      .maybeSingle();
    const versao = ((lastRow?.versao as number | undefined) ?? 0) + 1;
    const modelo = via === 'fallback' ? `${primarySel.providerLabel} (fallback)` : primarySel.providerLabel;

    const { data: inserted, error: insErr } = await admin
      .from('imovel_divulgacao')
      .insert({
        organization_id: orgId,
        imovel_id: id,
        versao,
        comprador_ideal: out.comprador_ideal,
        copy_canais: out.copy_canais,
        modelo,
        created_by: user.id,
      })
      .select('id, versao, comprador_ideal, copy_canais, modelo, created_at')
      .maybeSingle();
    if (insErr) throw new Error(insErr.message);

    return NextResponse.json({ ok: true, version: inserted });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 200 });
  }
}
