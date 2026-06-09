/**
 * IMO-7 Fase 2 — Sequência de fotos com IA de VISÃO.
 *
 * POST /api/imoveis/[id]/divulgacao/fotos → a IA OLHA para as fotos reais do imóvel e decide
 *   capa, ordem recomendada (com motivo) e quais cortar (com motivo). Cria uma VERSÃO NOVA na
 *   mesma tabela imovel_divulgacao (coluna fotos_ordem) — histórico para comparar e a IA aprender.
 *   A IA prepara; o João aplica/ignora. Nunca altera as fotos sozinha.
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
export const maxDuration = 60; // descarrega varias fotos + chamada de visao

const FotoDecisaoSchema = z.object({ foto: z.number().int(), motivo: z.string() });
const FotosSchema = z.object({
  capa: z.number().int(),
  ordem: z.array(FotoDecisaoSchema),
  cortar: z.array(FotoDecisaoSchema),
});
type FotosOut = z.infer<typeof FotosSchema>;

const MAX_FOTOS = 16;

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

    // Imóvel (RLS valida a org).
    const { data: imovel } = await supabase
      .from('imoveis').select('id, organization_id, titulo_anuncio, tipologia, concelho').eq('id', id).maybeSingle();
    if (!imovel || imovel.organization_id !== orgId) {
      return NextResponse.json({ error: 'Imóvel não encontrado' }, { status: 404 });
    }

    // Fotos (RLS) ordenadas; precisamos do storage_path para descarregar os bytes.
    const { data: fotosRaw } = await supabase
      .from('imovel_fotos')
      .select('id, storage_path, ordem, caption')
      .eq('imovel_id', id)
      .order('ordem', { ascending: true });
    const fotos = (fotosRaw ?? []).filter((f) => f.storage_path).slice(0, MAX_FOTOS);
    if (fotos.length < 2) {
      return NextResponse.json({ error: 'São precisas pelo menos 2 fotos para o agente sugerir a sequência.' }, { status: 400 });
    }

    const admin = createStaticAdminClient();

    // Chaves de IA.
    const { data: os } = await admin
      .from('organization_settings').select('ai_google_key, ai_anthropic_key').eq('organization_id', orgId).maybeSingle();
    const keys: AIKeys = {};
    if (os?.ai_google_key) keys.google = os.ai_google_key;
    if (os?.ai_anthropic_key) keys.anthropic = os.ai_anthropic_key;
    const primarySel = getModelForFeature('workflow_desc', keys);
    const primary = primarySel.model;
    const fallbackSel = getModelForFeature('workflow_desc', { anthropic: keys.anthropic });
    const fallback = fallbackSel.model;
    if (!primary) {
      return NextResponse.json({ error: 'Sem chaves de IA configuradas para esta organização.' }, { status: 400 });
    }

    // Gera URLs assinados (bucket privado, 1h) e PASSA OS URLS ao modelo de visão — o provider
    // descarrega as imagens. Assim a função não carrega bytes para memória (evita OOM com fotos grandes).
    const paths = fotos.map((f) => f.storage_path as string);
    const { data: signed } = await admin.storage.from('imovel-fotos').createSignedUrls(paths, 60 * 60);
    const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
    const imageParts: Array<Record<string, unknown>> = [];
    const indexToId: string[] = [];
    for (const f of fotos) {
      const url = urlByPath.get(f.storage_path as string);
      if (!url) continue;
      const n = indexToId.length + 1;
      indexToId.push(f.id as string);
      imageParts.push({ type: 'text', text: `Foto ${n}${f.caption ? ` (legenda: ${f.caption})` : ''}:` });
      imageParts.push({ type: 'image', image: new URL(url) });
    }
    if (indexToId.length < 2) {
      return NextResponse.json({ error: 'Não foi possível ler as fotos do imóvel.' }, { status: 400 });
    }

    const intro = `És o agente de divulgação de um consultor imobiliário de topo em Portugal. Vais ver as ${indexToId.length} fotos de um imóvel (${[imovel.tipologia, imovel.titulo_anuncio, imovel.concelho].filter(Boolean).join(' · ')}).
Analisa CADA foto pelo que mostra e decide a melhor sequência para vender mais depressa, em português europeu pré acordo ortográfico de 1990, SEM traços nem hífens a separar frases, com acentuação correcta.

Devolve em JSON:
- capa: o número da foto que deve ser a CAPA (a 1.ª impressão, a mais forte e representativa).
- ordem: a sequência recomendada das fotos a manter (inclui a capa em primeiro), cada uma com { foto: número, motivo: frase curta a explicar a posição }. Conta uma história: exterior/fachada, espaços nobres, cozinha, quartos, extras, exterior/envolvente.
- cortar: as fotos a retirar do anúncio (fracas, escuras, tremidas, repetidas ou que não acrescentam), cada uma com { foto: número, motivo: frase curta }. Se não houver nenhuma para cortar, devolve lista vazia.

Usa os números das fotos tal como aparecem ("Foto N"). Não inventes fotos que não viste.`;

    const content = [{ type: 'text', text: intro }, ...imageParts];
    const run = (model: NonNullable<typeof primary>) => generateText({
      model,
      messages: [{ role: 'user', content: content as never }],
      output: Output.object({ schema: FotosSchema }),
    });
    const { result, via } = await runWithAIFallback(
      () => run(primary),
      fallback && fallback !== primary ? () => run(fallback) : null,
    );
    const out = result.output as FotosOut;

    // Mapeia os números (1-based) de volta aos ids reais das fotos; ignora índices inválidos.
    const toId = (n: number): string | null => indexToId[n - 1] ?? null;
    const ordem = (out.ordem ?? []).map((o) => ({ id: toId(o.foto), motivo: o.motivo })).filter((o) => o.id);
    const cortar = (out.cortar ?? []).map((o) => ({ id: toId(o.foto), motivo: o.motivo })).filter((o) => o.id);
    const capaId = toId(out.capa) ?? ordem[0]?.id ?? null;
    const fotosOrdem = { capa_id: capaId, ordem, cortar };

    // Próxima versão (partilha o contador por imóvel com a copy).
    const { data: lastRow } = await admin
      .from('imovel_divulgacao').select('versao').eq('imovel_id', id).order('versao', { ascending: false }).limit(1).maybeSingle();
    const versao = ((lastRow?.versao as number | undefined) ?? 0) + 1;
    const modelo = via === 'fallback' ? `${primarySel.providerLabel} (fallback)` : primarySel.providerLabel;

    const { data: inserted, error: insErr } = await admin
      .from('imovel_divulgacao')
      .insert({ organization_id: orgId, imovel_id: id, versao, fotos_ordem: fotosOrdem, modelo, created_by: user.id })
      .select('id, versao, fotos_ordem, modelo, created_at')
      .maybeSingle();
    if (insErr) throw new Error(insErr.message);

    return NextResponse.json({ ok: true, version: inserted });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 200 });
  }
}
