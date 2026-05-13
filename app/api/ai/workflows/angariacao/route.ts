import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { createClient } from '@/lib/supabase/server';
import { AI_DEFAULT_MODELS } from '@/lib/ai/defaults';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface AngariacaoInput {
    zona: string;
    freguesia?: string;
    tipologia: string;
    anoConstrucao?: number;
    areaUtil?: number;
    estadoConservacao?: string;
    precoPedido?: number;
    precoMinimo?: number;
    caracteristicasDestaque?: string;
    motivacaoVenda?: string;
    exclusividade?: 'sim' | 'aberta' | 'fsbo';
    notasExtra?: string;
}

const PROMPTS: Record<string, (data: AngariacaoInput) => string> = {
    icp: (d) => `És um consultor imobiliário sénior em Portugal. Gera o **Perfil de Comprador Ideal (ICP)** para este imóvel.

DADOS DO IMÓVEL:
- Zona: ${d.zona}${d.freguesia ? `, freguesia ${d.freguesia}` : ''}
- Tipologia: ${d.tipologia}
- Ano construção: ${d.anoConstrucao ?? 'n/d'}
- Área útil: ${d.areaUtil ? d.areaUtil + ' m²' : 'n/d'}
- Estado: ${d.estadoConservacao ?? 'n/d'}
- Preço pedido: ${d.precoPedido ? d.precoPedido + ' €' : 'n/d'}${d.precoMinimo ? ` (mínimo ${d.precoMinimo} €)` : ''}
- Características destaque: ${d.caracteristicasDestaque ?? '—'}
- Motivação venda: ${d.motivacaoVenda ?? '—'}
- Exclusividade: ${d.exclusividade ?? 'n/d'}
${d.notasExtra ? '- Notas extra: ' + d.notasExtra : ''}

ESTRUTURA OBRIGATÓRIA:

## SUMÁRIO EXECUTIVO
- **Cabeçalho** numa frase: tipologia · zona · preço · posição comercial
- **3 bullets accionáveis**: maior força · maior fricção · onde focar a tua energia

## PERFIL DEMOGRÁFICO
- Idade
- Estado civil / família
- Rendimento conjunto mensal estimado
- Profissão típica
- Onde vive hoje (zona de origem)

## PERFIL PSICOGRÁFICO
- O que valoriza
- Receios e objeções esperadas
- Estilo de vida

## CRITÉRIOS DE COMPRA
- Must-haves
- Nice-to-haves
- Deal-breakers

## ONDE ENCONTRAR ESTE COMPRADOR
- Plataformas (Idealista filtros, Imovirtual, etc)
- Conteúdo a produzir
- Anúncios pagos (segmentação Facebook/Instagram/Google)
- Networking

Linguagem PT-PT, acionável, sem fluff. Máx 600 palavras.`,

    swot: (d) => `És um consultor imobiliário sénior PT. Gera análise **SWOT** para este imóvel.

DADOS:
- Zona: ${d.zona}${d.freguesia ? `, ${d.freguesia}` : ''}
- Tipologia: ${d.tipologia} | Ano: ${d.anoConstrucao ?? 'n/d'} | Área: ${d.areaUtil ?? 'n/d'} m²
- Estado: ${d.estadoConservacao ?? 'n/d'} | Preço: ${d.precoPedido ?? 'n/d'} €
- Destaque: ${d.caracteristicasDestaque ?? '—'}
- Motivação: ${d.motivacaoVenda ?? '—'}

ESTRUTURA OBRIGATÓRIA (markdown):

## ✅ FORÇAS (Strengths)
3-5 pontos. Coisas que diferenciam positivamente o imóvel.

## ❌ FRAQUEZAS (Weaknesses)
3-5 pontos. Aspetos a esconder/melhorar/preparar resposta.

## 🚀 OPORTUNIDADES (Opportunities)
3-4 pontos. Mercado, tendências, alavancas externas.

## ⚠️ AMEAÇAS (Threats)
3-4 pontos. Riscos externos (mercado, concorrência, regulamentação).

## 🎯 RECOMENDAÇÕES ESTRATÉGICAS
3 bullets accionáveis: como atacar as forças, mitigar fraquezas, capitalizar oportunidades.

Sê crítico e honesto. Máx 500 palavras. PT-PT.`,

    descricao: (d) => `És um copywriter imobiliário PT. Gera **descrição de marketing** para este imóvel para anúncios em Idealista/Imovirtual/Casa Sapo.

DADOS:
- Tipologia: ${d.tipologia} | Zona: ${d.zona}${d.freguesia ? `, ${d.freguesia}` : ''}
- Ano: ${d.anoConstrucao ?? 'n/d'} | Área: ${d.areaUtil ?? 'n/d'} m² | Estado: ${d.estadoConservacao ?? 'n/d'}
- Preço: ${d.precoPedido ?? 'n/d'} €
- Destaque: ${d.caracteristicasDestaque ?? '—'}

ENTREGA 3 VERSÕES:

## 📱 VERSÃO CURTA (140 chars) — para WhatsApp/Instagram/SMS

## 📋 VERSÃO ANÚNCIO (até 300 palavras) — para Idealista/Imovirtual
Estrutura:
- **Headline** (1 linha cativante)
- **Subheadline** (1 linha com tipologia/zona/preço)
- **Parágrafo principal** (descrição emocional, vende sensações)
- **Bullets** das características técnicas
- **Call-to-action** (visita agendada)

## 📄 VERSÃO LONGA (até 500 palavras) — para landing page/blog
Mais detalhada, com SEO em mente. Inclui parágrafo sobre a zona.

PT-PT correto. Tom: profissional mas caloroso. NUNCA "imóvel único" ou clichés baratos.`,

    pitch: (d) => `És um consultor imobiliário sénior PT a preparar a **reunião de angariação com o proprietário** deste imóvel.

DADOS:
- Tipologia: ${d.tipologia} | Zona: ${d.zona}${d.freguesia ? `, ${d.freguesia}` : ''}
- Preço pedido: ${d.precoPedido ?? 'n/d'} €${d.precoMinimo ? ` (mínimo ${d.precoMinimo} €)` : ''}
- Motivação venda: ${d.motivacaoVenda ?? '—'}
- Exclusividade: ${d.exclusividade ?? 'n/d'}

ESTRUTURA OBRIGATÓRIA:

## 🎯 OBJETIVO DA REUNIÃO
Numa frase, o que queres sair com.

## 🗣️ SCRIPT DE ABERTURA (2-3 frases)
Como começas a conversa, criando rapport.

## 💎 OS 3 VALORES QUE VAIS COMUNICAR
Cada um com:
- Nome do valor
- Por que importa para ESTE proprietário (motivação dele)
- Frase exemplo que dizes

## ❓ AS 5 PERGUNTAS-CHAVE PARA FAZER
Perguntas que te dão informação para fechar o CMI.

## ⚠️ OBJEÇÕES PROVÁVEIS + RESPOSTAS
3 objeções esperadas com resposta curta:
- Objeção: ...
- Resposta: ...

## 💰 ESTRATÉGIA DE PREÇO
Posicionamento sobre o preço pedido vs mercado.

## 📋 PEDIDO FINAL (Closing)
Frase exacta para pedir CMI exclusivo. Tom firme mas amigável.

PT-PT. Pratico, accionável. Máx 700 palavras.`,
};

async function generateForStep(step: string, input: AngariacaoInput, apiKey: string, model: string): Promise<string> {
    const promptFn = PROMPTS[step];
    if (!promptFn) throw new Error(`Step desconhecido: ${step}`);
    
    const google = createGoogleGenerativeAI({ apiKey });
    const { text } = await generateText({
        model: google(model),
        prompt: promptFn(input),
        temperature: 0.7,
    });
    return text;
}

export async function POST(req: Request): Promise<Response> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });
        
        const body = await req.json();
        const { step, input } = body as { step: string; input: AngariacaoInput };
        if (!step || !input?.zona || !input?.tipologia) {
            return Response.json({ error: 'Faltam dados obrigatórios (step, zona, tipologia)' }, { status: 400 });
        }
        
        // Get user's Google API key from user_settings (or organization_settings as fallback)
        const { data: userSettings } = await supabase
            .from('user_settings')
            .select('ai_api_key, ai_model')
            .eq('user_id', user.id)
            .single();
        
        let apiKey = userSettings?.ai_api_key as string | undefined;
        let model = (userSettings?.ai_model as string | undefined) || AI_DEFAULT_MODELS.google;
        
        if (!apiKey) {
            const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
            if (profile?.organization_id) {
                const { data: orgSettings } = await supabase
                    .from('organization_settings')
                    .select('ai_google_key, ai_model')
                    .eq('organization_id', profile.organization_id)
                    .single();
                apiKey = orgSettings?.ai_google_key as string | undefined;
                model = (orgSettings?.ai_model as string | undefined) || model;
            }
        }
        
        if (!apiKey) return Response.json({ error: 'Chave API Gemini não configurada' }, { status: 400 });
        
        const output = await generateForStep(step, input, apiKey, model);
        return Response.json({ ok: true, step, output });
    } catch (e: any) {
        console.error('[/api/ai/workflows/angariacao] ERROR:', e?.stack || e);
        return Response.json({ error: e?.message || 'Erro interno' }, { status: 500 });
    }
}
