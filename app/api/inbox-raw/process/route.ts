import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { routedGenerate, fetchAIKeysForUser, type AIFeature } from '@/lib/ai/router';

export const runtime = 'nodejs';
export const maxDuration = 60;

const EXTRACTION_PROMPT = [
  'És um analista do mercado imobiliário português. Vais receber texto bruto de mensagens (WhatsApp, anúncios, notas). Para CADA mensagem distinta dentro do texto, devolve um objecto JSON.',
  '',
  'Schema (devolve JSON array):',
  '- intent: angariacao | procura | fsbo_tip | parceiro | evento_mercado | concorrente | irrelevante',
  '- ownership: minha | colega | externa',
  '- confidence_overall: 0-100',
  '- summary: 1 frase curta em pt-PT',
  '- property: { tipologia, m2, m2_terreno, m2_terraco, zona, freguesia, concelho, preco_eur, ano, piso, certificado_energetico, fsbo, caracteristicas: [] }',
  '- contact: { nome, apelido, telefone, email, agencia, link, role }',
  '- market_event: { tipo, descricao, data_efectiva, impacto, fonte }',
  '- partner: { role, especialidade, comissao_partilhada }',
  '- source_attribution: nome do colega/fonte se mencionado',
  '',
  'Regras:',
  '1. Português europeu (contacto/ficheiro/ecrã, NUNCA contato/arquivo/tela)',
  '2. ownership=minha se mensagem do João, =colega se outro consultor, =externa se anúncio/notícia',
  '3. FSBO_TIP SEMPRE ownership=minha',
  '4. Confidence <50 -> intent=irrelevante',
  '5. Preços: inteiro EUR (sem símbolo)',
  '',
  'Devolve APENAS array JSON válido. Sem markdown, sem texto extra.'
].join('\n');

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const userResp = await supabase.auth.getUser();
    const user = userResp.data.user;
    if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
    if (!profile || !profile.organization_id) return NextResponse.json({ error: 'no_organization' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const rawText = String(body.text || '').trim();
    if (!rawText) return NextResponse.json({ error: 'empty_text' }, { status: 400 });

    const keys = await fetchAIKeysForUser(supabase as any, user.id);

    const result: any = await routedGenerate({
      feature: 'workflow_icp' as AIFeature,
      prompt: EXTRACTION_PROMPT + '\n\nTexto bruto:\n' + rawText,
      keys,
      temperature: 0.2
    });

    let parsed: any[] = [];
    let text: string = (result && result.text) ? String(result.text).trim() : '';
    // strip ```json fences if present
    text = text.replace(/^```(json)?\s*/i, '').replace(/```\s*$/i, '');
    try { parsed = JSON.parse(text); } catch { parsed = []; }
    if (!Array.isArray(parsed)) parsed = parsed && typeof parsed === 'object' ? [parsed] : [];

    const rows = parsed.filter((p: any) => p && typeof p === 'object').map((p: any) => {
      const hasContactName = p.contact && p.contact.nome;
      const requiresReview = (p.confidence_overall == null || p.confidence_overall < 70) || !hasContactName;
      return {
        organization_id: profile.organization_id,
        created_by: user.id,
        source_kind: 'paste',
        raw_text: rawText,
        intent: p.intent || 'irrelevante',
        ownership: p.intent === 'fsbo_tip' ? 'minha' : (p.ownership || 'externa'),
        confidence_overall: p.confidence_overall != null ? p.confidence_overall : null,
        confidence_per_field: p.confidence_per_field || {},
        property: p.property || null,
        contact: p.contact || null,
        market_event: p.market_event || null,
        partner: p.partner || null,
        status: 'novo',
        requires_review: requiresReview,
        notes: p.summary || null,
        source_attribution: p.source_attribution || null
      };
    });

    if (rows.length === 0) return NextResponse.json({ created: 0, items: [] });

    const { data: inserted, error } = await (supabase as any).from('raw_intel').insert(rows).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ created: (inserted || []).length, items: inserted });
  } catch (e: any) {
    return NextResponse.json({ error: String((e && e.message) || e) }, { status: 500 });
  }
}
