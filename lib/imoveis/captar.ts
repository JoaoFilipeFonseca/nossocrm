import 'server-only';
import { routedGenerate, type AIKeys } from '@/lib/ai/router';

export interface ImovelDraft {
  referencia: string | null;
  morada: string | null;
  freguesia: string | null;
  concelho: string | null;
  distrito: string | null;
  tipologia: string | null;
  area_util: number | null;
  area_bruta: number | null;
  ano_construcao: number | null;
  certificado_energetico: string | null;
  preco_actual: number | null;
  preco_inicial: number | null;
  estado: string | null;
  tipo_negocio: string | null;
  link_externo: string | null;
  notas_privadas: string | null;
  confidence: Record<string, number>;
}

const EXTRACTION_PROMPT = `Extrai os dados de um imóvel a partir do texto fornecido. Devolve APENAS JSON válido (sem markdown, sem code fences), seguindo este schema exacto:

{
  "referencia": string|null,
  "morada": string|null,
  "freguesia": string|null,
  "concelho": string|null,
  "distrito": string|null,
  "tipologia": "T0"|"T1"|"T2"|"T3"|"T4"|"T5+"|"Loja"|"Armazem"|"Terreno"|null,
  "area_util": number|null,
  "area_bruta": number|null,
  "ano_construcao": number|null,
  "certificado_energetico": "A+"|"A"|"B"|"B-"|"C"|"D"|"E"|"F"|"G"|"isento"|null,
  "preco_actual": number|null,
  "preco_inicial": number|null,
  "estado": "disponivel"|"reservado"|"vendido"|"retirado"|"em_avaliacao"|null,
  "tipo_negocio": "venda"|"arrendamento"|"ambos"|null,
  "link_externo": string|null,
  "notas_privadas": string|null,
  "confidence": { "<campo>": 0-100, ... }
}

Regras:
- Use unicamente pt-PT. Nunca use vocabulário brasileiro.
- Preços em euros, número inteiro (sem ".", sem "€", sem espaços).
- Áreas em m² como número (sem "m²").
- Se a fonte não indica concelho mas indica freguesia conhecida, deduzir concelho (ex: "Cedofeita" → "Porto", "Aldoar" → "Porto", "Matosinhos-Sul" → "Matosinhos").
- Se a fonte for um link de Idealista/Imovirtual/Casa Sapo, preservar o URL em link_externo.
- Para confidence, dá um número 0-100 por campo extraído (0 = adivinhei, 100 = explícito no texto).
- Não inventar dados. Se não há informação, usa null.
- notas_privadas: 1-2 frases com observações úteis para o consultor (estado de conservação mencionado, urgência do vendedor, condições atípicas). Se não houver nada relevante, null.

Texto fonte:
`;

async function fetchUrlText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`Falha a buscar URL (HTTP ${res.status})`);
  const html = await res.text();
  return sanitizeHtml(html);
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8364;|&euro;/g, '€')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 20000);
}

function parseAIJson(raw: string): ImovelDraft {
  let cleaned = raw.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  const parsed = JSON.parse(cleaned);
  return {
    referencia: parsed.referencia ?? null,
    morada: parsed.morada ?? null,
    freguesia: parsed.freguesia ?? null,
    concelho: parsed.concelho ?? null,
    distrito: parsed.distrito ?? null,
    tipologia: parsed.tipologia ?? null,
    area_util: parsed.area_util != null ? Number(parsed.area_util) : null,
    area_bruta: parsed.area_bruta != null ? Number(parsed.area_bruta) : null,
    ano_construcao: parsed.ano_construcao != null ? Number(parsed.ano_construcao) : null,
    certificado_energetico: parsed.certificado_energetico ?? null,
    preco_actual: parsed.preco_actual != null ? Number(parsed.preco_actual) : null,
    preco_inicial: parsed.preco_inicial != null ? Number(parsed.preco_inicial) : null,
    estado: parsed.estado ?? null,
    tipo_negocio: parsed.tipo_negocio ?? null,
    link_externo: parsed.link_externo ?? null,
    notas_privadas: parsed.notas_privadas ?? null,
    confidence: parsed.confidence ?? {},
  };
}

export async function extractImovelFromInput(
  input: { kind: 'text' | 'link'; payload: string },
  keys: AIKeys,
): Promise<{ draft: ImovelDraft; modelUsed: string; sourceLength: number }> {
  let sourceText: string;
  if (input.kind === 'link') {
    sourceText = await fetchUrlText(input.payload);
    sourceText = `URL original: ${input.payload}\n\nConteúdo:\n${sourceText}`;
  } else {
    sourceText = input.payload.trim();
  }

  if (sourceText.length < 5) {
    throw new Error('Conteúdo insuficiente para extrair imóvel.');
  }

  const fullPrompt = `${EXTRACTION_PROMPT}\n${sourceText}`;
  const result = await routedGenerate({
    feature: 'imovel_extract',
    prompt: fullPrompt,
    keys,
    temperature: 0.1,
  });

  const draft = parseAIJson(result.text);
  return { draft, modelUsed: result.modelUsed, sourceLength: sourceText.length };
}
