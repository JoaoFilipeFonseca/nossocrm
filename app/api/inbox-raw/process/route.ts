import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchAIKeysForUser } from '@/lib/ai/router';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

export const runtime = 'nodejs';
export const maxDuration = 60;

const EXTRACTION_PROMPT = `És um analista do mercado imobiliário português. Vais receber texto bruto de mensagens (WhatsApp, anúncios, notas). Para CADA mensagem distinta dentro do texto, devolve um objecto JSON com a seguinte estrutura.

Campos obrigatórios:
- intent: angariacao | procura | fsbo_tip | parceiro | evento_mercado | concorrente | irrelevante
- ownership: minha | colega | externa
- confidence_overall: 0-100
- summary: 1 frase curta em pt-PT

Campos condicionais consoante o intent:
- property (se angariacao/concorrente): { tipologia, m2, m2_terreno, m2_terraco, zona, freguesia, concelho, preco_eur, ano, piso, certificado_energetico, fsbo, caracteristicas: [] }
- contact (se relevante): { nome, apelido, telefone, email, agencia, link, role }
- market_event (se evento_mercado): { tipo, descricao, data_efectiva, impacto, fonte }
- partner (se parceiro): { role, especialidade, comissao_partilhada }

Regras críticas:
1. Português europeu — "contacto" não "contato", "ficheiro" não "arquivo", "ecrã" não "tela"
2. Se a mensagem é claramente do João (referência "eu tenho", "o meu cliente"), ownership=minha
3. Se a mensagem refere outro consultor/agência, ownership=colega
4. FSBO_TIP: SEMPRE ownership=minha (mesmo se for tip de colega — a oportunidade de angariar é sempre do João)
5. Eventos de mercado vindos de Eco/Idealista/notícias → ownership=externa
6. Se não consegues classificar com confiança >50%, marca intent=irrelevante
7. Preços: converte para inteiro EUR (sem €, sem pontos)

Devolve APENAS array JSON válido, nada mais.`;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
    if (!profile?.organization_id) return NextResponse.json({ error: 'no_organization' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const rawText = String(body.text || '').trim();
    if (!rawText) return NextResponse.json({ error: 'empty_text' }, { status: 400 });

    const keys = await fetchAIKeysForUser(supabase, user.id, profile.organization_id);
    const googleKey = keys.googleKey;
    if (!googleKey) return NextResponse.json({ error: 'no_google_key' }, { status: 400 });

    const genai = new GoogleGenerativeAI(googleKey);
    const model = genai.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
    });

    const result = await model.generateContent(EXTRACTION_PROMPT + '\n\nTexto bruto:\n' + rawText);
    const responseText = result.response.text();
    let parsed: any[] = [];
    try { parsed = JSON.parse(responseText); } catch { parsed = []; }
    if (!Array.isArray(parsed)) parsed = parsed?.records || [parsed];

    const rows = parsed.filter(p => p && typeof p === 'object').map((p) => {
      const requiresReview = (p.confidence_overall ?? 0) < 70 || !p.contact?.nome;
      return {
        organization_id: profile.organization_id,
        created_by: user.id,
        source_kind: 'paste',
        raw_text: rawText,
        intent: p.intent || 'irrelevante',
        ownership: p.intent === 'fsbo_tip' ? 'minha' : (p.ownership || 'externa'),
        confidence_overall: p.confidence_overall ?? null,
        confidence_per_field: p.confidence_per_field ?? {},
        property: p.property ?? null,
        contact: p.contact ?? null,
        market_event: p.market_event ?? null,
        partner: p.partner ?? null,
        status: 'novo',
        requires_review: requiresReview,
        notes: p.summary ?? null,
        source_attribution: p.source_attribution ?? null
      };
    });

    if (rows.length === 0) {
      return NextResponse.json({ created: 0, items: [] });
    }

    const { data: inserted, error } = await supabase.from('raw_intel').insert(rows).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ created: inserted?.length || 0, items: inserted });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
