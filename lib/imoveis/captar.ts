import 'server-only';
import { routedGenerate, routedGenerateMultimodal, type AIKeys } from '@/lib/ai/router';

export interface ImovelDraft {
  // identificação
  referencia: string | null;
  tipo: string | null;
  subtipo: string | null;
  estado: string | null;
  estado_conservacao: string | null;
  tipo_negocio: string | null;
  tipologia: string | null;
  // localização
  morada: string | null;
  numero_policia: string | null;
  codigo_postal: string | null;
  freguesia: string | null;
  concelho: string | null;
  distrito: string | null;
  // áreas e divisões
  area_util: number | null;
  area_bruta: number | null;
  area_terreno: number | null;
  area_dependente: number | null;
  quartos: number | null;
  quartos_suite: number | null;
  wcs: number | null;
  piso: number | null;
  pisos_imovel: number | null;
  cozinha_tipo: string | null;
  sala_m2: number | null;
  // anos
  ano_construcao: number | null;
  ano_remodelacao: number | null;
  // energia / infra
  certificado_energetico: string | null;
  ce_numero: string | null;
  ce_validade: string | null;
  aquecimento: string | null;
  tem_ac: boolean | null;
  agua: string | null;
  paineis_solares: string | null;
  caixilharia: string | null;
  vidros_duplos: boolean | null;
  orientacao: string | null;
  vista: string | null;
  // condomínio / fiscal
  tem_condominio: boolean | null;
  condominio_mensal: number | null;
  condominio_inclui: string | null;
  imi_anual: number | null;
  // preços
  preco_actual: number | null;
  preco_inicial: number | null;
  renda_mensal: number | null;
  // marketing
  titulo_anuncio: string | null;
  descricao_longa: string | null;
  destaques: string[];
  publico_alvo: string[];
  // links / refs
  link_externo: string | null;
  ref_idealista: string | null;
  ref_imovirtual: string | null;
  ref_casasapo: string | null;
  ref_kw: string | null;
  notas_privadas: string | null;
  caracteristicas: Record<string, boolean>;
  confidence: Record<string, number>;
}

const EXTRACTION_PROMPT = `És um agente que extrai dados de imóveis do mercado português. Devolve APENAS JSON válido (sem markdown, sem code fences), seguindo o schema abaixo.

REGRAS GLOBAIS:
- pt-PT formal. Nunca pt-BR.
- Preços e valores em EUROS, número inteiro (ex: 1650000).
- Áreas em m² (apenas o número).
- Boolean true/false ou null se não há informação.
- Se a fonte não tem o campo, devolve null. Não inventar.
- Para confidence: 0-100 por campo extraído (100 = explícito, 0-50 = deduzido com baixa confiança).

DEDUÇÕES PERMITIDAS:
- Freguesia conhecida → concelho (ex: "Foz do Douro" → "Porto", "Cedofeita" → "Porto", "Seroa" → "Paços de Ferreira", "Boavista" → "Porto").
- Tipologia a partir de "T3 com 6 quartos" → T3, suites separadamente.
- Se diz "moradia T6" → tipo: "moradia", tipologia: "T6" ou "V6".
- Se diz "apartamento T2" → tipo: "apartamento", tipologia: "T2".

CAMPOS:

{
  "referencia": string|null,                              // ref do portal/agência se visível
  "tipo": "apartamento"|"moradia"|"terreno"|"predio"|"loja"|"armazem"|"escritorio"|"garagem"|"quinta"|null,
  "subtipo": string|null,                                 // duplex|triplex|isolada|geminada|banda…
  "estado": "disponivel"|"reservado"|"vendido"|"retirado"|"em_avaliacao"|null,
  "estado_conservacao": "novo"|"como_novo"|"usado"|"recuperar"|"construcao"|"projecto"|null,
  "tipo_negocio": "venda"|"arrendamento"|"ambos"|"trespasse"|"permuta"|null,
  "tipologia": "T0"|"T1"|"T2"|"T3"|"T4"|"T5"|"T5+"|"V3"|"V4"|"V5"|"V5+"|"Loja"|"Armazem"|"Terreno"|null,
  "morada": string|null,
  "numero_policia": string|null,
  "codigo_postal": string|null,                           // formato XXXX-XXX
  "freguesia": string|null,
  "concelho": string|null,
  "distrito": string|null,
  "area_util": number|null,
  "area_bruta": number|null,
  "area_terreno": number|null,
  "area_dependente": number|null,
  "quartos": number|null,
  "quartos_suite": number|null,
  "wcs": number|null,
  "piso": number|null,
  "pisos_imovel": number|null,
  "cozinha_tipo": "equipada"|"semi_equipada"|"vazia"|null,
  "sala_m2": number|null,
  "ano_construcao": number|null,
  "ano_remodelacao": number|null,
  "certificado_energetico": "A+"|"A"|"B"|"B-"|"C"|"D"|"E"|"F"|"G"|"isento"|null,
  "ce_numero": string|null,
  "ce_validade": string|null,                             // YYYY-MM-DD
  "aquecimento": string|null,
  "tem_ac": boolean|null,
  "agua": string|null,
  "paineis_solares": string|null,
  "caixilharia": string|null,
  "vidros_duplos": boolean|null,
  "orientacao": "N"|"NE"|"E"|"SE"|"S"|"SO"|"O"|"NO"|null,
  "vista": string|null,                                   // mar|rio|montanha|cidade|jardim|...
  "tem_condominio": boolean|null,
  "condominio_mensal": number|null,
  "condominio_inclui": string|null,
  "imi_anual": number|null,
  "preco_actual": number|null,
  "preco_inicial": number|null,
  "renda_mensal": number|null,
  "titulo_anuncio": string|null,                          // título atractivo, máx 80 chars
  "descricao_longa": string|null,                         // descrição limpa em pt-PT, sem cabeçalhos repetidos
  "destaques": string[],                                  // 5-7 bullet points curtos
  "publico_alvo": string[],                               // ex: ["Famílias numerosas", "Investidores"]
  "link_externo": string|null,                            // URL do anúncio
  "ref_idealista": string|null,
  "ref_imovirtual": string|null,
  "ref_casasapo": string|null,
  "ref_kw": string|null,
  "notas_privadas": string|null,                          // observações úteis ao consultor
  "caracteristicas": {                                    // booleans (apenas inclui chaves quando verdadeiras OU explicitamente falsas)
    // chaves possíveis: varanda, terraco, marquise, jardim, quintal, piscina, piscina_interior, piscina_aquecida,
    // garagem, parking_exterior, arrecadacao, sotao, cave, elevador, lareira, roupeiros_embutidos,
    // portas_blindadas, alarme, videovigilancia, domotica, aspiracao_central, fibra, sistema_rega,
    // ginasio, sala_cinema, mobilado, equipado, acessivel_mobilidade
  },
  "confidence": { "<campo>": 0-100 }
}

Fonte:
`;

async function fetchUrlViaJina(url: string): Promise<string> {
  const jinaUrl = `https://r.jina.ai/${url}`;
  const res = await fetch(jinaUrl, {
    headers: {
      'Accept': 'text/plain',
      'X-Return-Format': 'markdown',
    },
  });
  if (!res.ok) throw new Error(`Jina Reader falhou (HTTP ${res.status})`);
  return await res.text();
}

async function fetchUrlDirect(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`Fetch directo falhou (HTTP ${res.status})`);
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
    .trim();
}

/** Tenta Jina primeiro (resolve JS-rendered RE/MAX/C21/KW), fallback fetch directo. */
async function fetchUrlSmart(url: string): Promise<{ text: string; via: 'jina' | 'direct' }> {
  try {
    const text = await fetchUrlViaJina(url);
    if (text.trim().length > 200) return { text, via: 'jina' };
  } catch (err) {
    console.warn('[captar] Jina failed, falling back to direct fetch:', err);
  }
  const text = await fetchUrlDirect(url);
  return { text, via: 'direct' };
}

function emptyDraft(): ImovelDraft {
  return {
    referencia: null, tipo: null, subtipo: null, estado: null, estado_conservacao: null,
    tipo_negocio: null, tipologia: null, morada: null, numero_policia: null,
    codigo_postal: null, freguesia: null, concelho: null, distrito: null,
    area_util: null, area_bruta: null, area_terreno: null, area_dependente: null,
    quartos: null, quartos_suite: null, wcs: null, piso: null, pisos_imovel: null,
    cozinha_tipo: null, sala_m2: null,
    ano_construcao: null, ano_remodelacao: null,
    certificado_energetico: null, ce_numero: null, ce_validade: null,
    aquecimento: null, tem_ac: null, agua: null, paineis_solares: null,
    caixilharia: null, vidros_duplos: null, orientacao: null, vista: null,
    tem_condominio: null, condominio_mensal: null, condominio_inclui: null, imi_anual: null,
    preco_actual: null, preco_inicial: null, renda_mensal: null,
    titulo_anuncio: null, descricao_longa: null, destaques: [], publico_alvo: [],
    link_externo: null, ref_idealista: null, ref_imovirtual: null,
    ref_casasapo: null, ref_kw: null, notas_privadas: null,
    caracteristicas: {}, confidence: {},
  };
}

function toNum(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function extractFirstJsonObject(raw: string): string {
  // Encontra primeiro objecto JSON balanceado, ignorando texto antes/depois.
  let cleaned = raw.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  const start = cleaned.indexOf('{');
  if (start < 0) throw new Error('Sem JSON object no resultado');

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return cleaned.slice(start, i + 1);
    }
  }
  // Devolve até ao final se não fechou — JSON.parse vai falhar com mensagem clara.
  return cleaned.slice(start);
}

function extractFirstJsonArray(raw: string): string {
  let cleaned = raw.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  const start = cleaned.indexOf('[');
  if (start < 0) throw new Error('Sem JSON array no resultado');

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) return cleaned.slice(start, i + 1);
    }
  }
  return cleaned.slice(start);
}

function parseAIJson(raw: string): ImovelDraft {
  const cleaned = extractFirstJsonObject(raw);
  const p = JSON.parse(cleaned);
  const base = emptyDraft();
  return {
    ...base,
    referencia: p.referencia ?? null,
    tipo: p.tipo ?? null,
    subtipo: p.subtipo ?? null,
    estado: p.estado ?? null,
    estado_conservacao: p.estado_conservacao ?? null,
    tipo_negocio: p.tipo_negocio ?? null,
    tipologia: p.tipologia ?? null,
    morada: p.morada ?? null,
    numero_policia: p.numero_policia ?? null,
    codigo_postal: p.codigo_postal ?? null,
    freguesia: p.freguesia ?? null,
    concelho: p.concelho ?? null,
    distrito: p.distrito ?? null,
    area_util: toNum(p.area_util), area_bruta: toNum(p.area_bruta),
    area_terreno: toNum(p.area_terreno), area_dependente: toNum(p.area_dependente),
    quartos: toNum(p.quartos), quartos_suite: toNum(p.quartos_suite), wcs: toNum(p.wcs),
    piso: toNum(p.piso), pisos_imovel: toNum(p.pisos_imovel),
    cozinha_tipo: p.cozinha_tipo ?? null, sala_m2: toNum(p.sala_m2),
    ano_construcao: toNum(p.ano_construcao), ano_remodelacao: toNum(p.ano_remodelacao),
    certificado_energetico: p.certificado_energetico ?? null,
    ce_numero: p.ce_numero ?? null, ce_validade: p.ce_validade ?? null,
    aquecimento: p.aquecimento ?? null, tem_ac: p.tem_ac ?? null,
    agua: p.agua ?? null, paineis_solares: p.paineis_solares ?? null,
    caixilharia: p.caixilharia ?? null, vidros_duplos: p.vidros_duplos ?? null,
    orientacao: p.orientacao ?? null, vista: p.vista ?? null,
    tem_condominio: p.tem_condominio ?? null,
    condominio_mensal: toNum(p.condominio_mensal),
    condominio_inclui: p.condominio_inclui ?? null,
    imi_anual: toNum(p.imi_anual),
    preco_actual: toNum(p.preco_actual), preco_inicial: toNum(p.preco_inicial),
    renda_mensal: toNum(p.renda_mensal),
    titulo_anuncio: p.titulo_anuncio ?? null,
    descricao_longa: p.descricao_longa ?? null,
    destaques: Array.isArray(p.destaques) ? p.destaques.filter((s: unknown) => typeof s === 'string') : [],
    publico_alvo: Array.isArray(p.publico_alvo) ? p.publico_alvo.filter((s: unknown) => typeof s === 'string') : [],
    link_externo: p.link_externo ?? null,
    ref_idealista: p.ref_idealista ?? null,
    ref_imovirtual: p.ref_imovirtual ?? null,
    ref_casasapo: p.ref_casasapo ?? null,
    ref_kw: p.ref_kw ?? null,
    notas_privadas: p.notas_privadas ?? null,
    caracteristicas: (p.caracteristicas && typeof p.caracteristicas === 'object') ? p.caracteristicas : {},
    confidence: (p.confidence && typeof p.confidence === 'object') ? p.confidence : {},
  };
}

export async function extractImovelFromFile(
  file: { data: ArrayBuffer; mimeType: string; name: string },
  keys: AIKeys,
): Promise<{ draft: ImovelDraft; modelUsed: string }> {
  let kindDescription: string;
  let extraInstr = '';
  if (file.mimeType.startsWith('image/')) {
    kindDescription = `Imagem do anúncio/placard (${file.name})`;
    extraInstr = 'Extrai TUDO o que conseguir ver na imagem (texto visível, preço, áreas, contactos).';
  } else if (file.mimeType.startsWith('audio/')) {
    kindDescription = `Áudio com descrição falada de um imóvel (${file.name})`;
    extraInstr = `Primeiro transcreve mentalmente o áudio. Depois extrai os campos do imóvel mencionado.
Foca-te em: tipo, tipologia, áreas, divisões, localização, preço, estado e características.
Coloca a transcrição original em "notas_privadas" (para o consultor rever).`;
  } else {
    kindDescription = `Documento (${file.name})`;
    extraInstr = 'Extrai TUDO o que conseguir ler no documento.';
  }

  const prompt = `${EXTRACTION_PROMPT}\n\nFonte: ${kindDescription}\n${extraInstr}`;

  const result = await routedGenerateMultimodal({
    feature: 'imovel_extract',
    prompt,
    files: [{ data: file.data, mimeType: file.mimeType }],
    keys,
    temperature: 0.1,
  });

  const draft = parseAIJson(result.text);
  return { draft, modelUsed: result.modelUsed };
}

export interface RawIntelDraft {
  property: Record<string, unknown>;
  contact: Record<string, unknown>;
  intent: 'angariacao' | 'procura' | 'fsbo_tip' | 'parceiro' | 'evento_mercado' | 'concorrente' | 'irrelevante';
  ownership: 'minha' | 'colega' | 'externa';
  confidence_overall: number;
  raw_segment: string;
  tags: string[];
}

const LIST_EXTRACTION_PROMPT = `Recebes um texto curto/médio de partilha entre consultores imobiliários portugueses (típico de grupos WhatsApp/Telegram). O texto pode conter:
- 1 imóvel descrito
- VÁRIOS imóveis enumerados (off-market, partilhas, "tenho aqui 3 oportunidades…")
- Procura(s) de cliente ("preciso de T2 até 250k em…")
- Mistura

Tarefa: devolve JSON ARRAY (sem markdown, sem code fences) com 1 entry por item de interesse detectado. Schema por item:

{
  "intent": "angariacao"|"procura"|"fsbo_tip"|"parceiro"|"evento_mercado"|"concorrente"|"irrelevante",
  "ownership": "minha"|"colega"|"externa",
  "property": {
    "tipologia": "T0"|"T1"|"T2"|"T3"|"T4"|"T5+"|"V3"|"V4"|"V5"|"V5+"|"Loja"|"Armazem"|"Terreno"|null,
    "tipo": "apartamento"|"moradia"|"terreno"|"loja"|"armazem"|null,
    "freguesia": string|null,
    "concelho": string|null,
    "distrito": string|null,
    "zona": string|null,
    "preco": number|null,
    "area_util": number|null,
    "wcs": number|null,
    "quartos": number|null,
    "garagem": boolean|null,
    "varanda": boolean|null,
    "estado": "off_market"|"mercado"|"reservado"|null,
    "extras": string|null
  },
  "contact": {
    "nome": string|null,
    "telefone": string|null,
    "agencia": string|null
  },
  "confidence_overall": 0-100,
  "raw_segment": string,
  "tags": string[]
}

Regras:
- pt-PT formal. Nunca pt-BR.
- Tudo o que parece imóvel à venda partilhado por colega → intent="angariacao", ownership="colega"
- Procuras de cliente → intent="procura", ownership="colega"
- FSBO (proprietário sem mediadora) → intent="fsbo_tip", ownership="minha"
- Notícias/regulação → intent="evento_mercado", ownership="externa"
- raw_segment: copia LITERAL a parte do texto fonte que originou este item.
- Preços em euros sem símbolo (260000 não "260.000€"). Areas só número.
- estado: "off_market" se mencionar off-market/privado, "mercado" se mencionar "disponível no mercado".
- tags: array com palavras chave: ["off-market", "luxo", "garagem", "centro", etc.]

Texto fonte:
`;

function parseAIJsonArray(raw: string): RawIntelDraft[] {
  const cleaned = extractFirstJsonArray(raw);
  const arr = JSON.parse(cleaned);
  if (!Array.isArray(arr)) return [];
  return arr.map((p: Record<string, unknown>) => ({
    intent: (p.intent as RawIntelDraft['intent']) ?? 'irrelevante',
    ownership: (p.ownership as RawIntelDraft['ownership']) ?? 'externa',
    property: (p.property && typeof p.property === 'object') ? p.property as Record<string, unknown> : {},
    contact: (p.contact && typeof p.contact === 'object') ? p.contact as Record<string, unknown> : {},
    confidence_overall: typeof p.confidence_overall === 'number' ? p.confidence_overall : 50,
    raw_segment: typeof p.raw_segment === 'string' ? p.raw_segment : '',
    tags: Array.isArray(p.tags) ? p.tags.filter((t: unknown) => typeof t === 'string') as string[] : [],
  }));
}

const CLASSIFIER_PROMPT = `Classificas mensagens recebidas por um bot de Telegram dum consultor imobiliário em Portugal.
Categorias possíveis:
- "single": descrição de 1 imóvel para o consultor criar como angariação dele (criar em /imoveis em estado "em_avaliacao")
- "list": lista de imóveis off-market ou partilhas de colegas (criar em /matches via raw_intel)
- "procura": cliente a procurar imóvel (criar em raw_intel intent=procura)
- "command": parece um comando ou pergunta ao bot (não criar nada)
- "irrelevante": ruído, conversa, off-topic

Devolve APENAS JSON (sem markdown, sem code fences):
{
  "kind": "single" | "list" | "procura" | "command" | "irrelevante",
  "confidence": 0-100,
  "summary": "1 frase em pt-PT a descrever o que detectaste"
}

Regras de decisão:
- Se há 2+ imóveis claramente enumerados → "list"
- Se há off-market, partilha de colega, "tem clientes para?" → "list"
- Se é só 1 imóvel descrito com áreas/preço/zona → "single"
- Se é cliente a procurar imóvel ("preciso de T2 até X em Y") → "procura"
- Se há indicação clara de que é o próprio consultor a angariar (1 imóvel) → "single"

Texto:
`;

export interface ClassificationResult {
  kind: 'single' | 'list' | 'procura' | 'command' | 'irrelevante';
  confidence: number;
  summary: string;
  modelUsed: string;
}

export async function classifyTelegramMessage(text: string, keys: AIKeys): Promise<ClassificationResult> {
  const trimmed = text.trim();
  if (trimmed.length < 5) {
    return { kind: 'irrelevante', confidence: 100, summary: 'Mensagem muito curta', modelUsed: 'heuristic' };
  }
  try {
    const result = await routedGenerate({
      feature: 'imovel_extract',
      prompt: `${CLASSIFIER_PROMPT}\n${trimmed.slice(0, 5000)}`,
      keys,
      temperature: 0.0,
    });
    const cleaned = extractFirstJsonObject(result.text);
    const p = JSON.parse(cleaned);
    return {
      kind: (p.kind as ClassificationResult['kind']) ?? 'irrelevante',
      confidence: typeof p.confidence === 'number' ? p.confidence : 50,
      summary: typeof p.summary === 'string' ? p.summary : '',
      modelUsed: result.modelUsed,
    };
  } catch {
    return { kind: 'irrelevante', confidence: 30, summary: 'Erro a classificar', modelUsed: 'fallback' };
  }
}

export async function extractRawIntelList(
  text: string,
  keys: AIKeys,
): Promise<{ items: RawIntelDraft[]; modelUsed: string }> {
  const trimmed = text.trim();
  if (trimmed.length < 5) throw new Error('Conteúdo insuficiente.');

  const fullPrompt = `${LIST_EXTRACTION_PROMPT}\n${trimmed.slice(0, 20000)}`;
  const result = await routedGenerate({
    feature: 'imovel_extract',
    prompt: fullPrompt,
    keys,
    temperature: 0.1,
  });

  const items = parseAIJsonArray(result.text).filter((i) => i.intent !== 'irrelevante');
  return { items, modelUsed: result.modelUsed };
}

export async function extractImovelFromInput(
  input: { kind: 'text' | 'link'; payload: string },
  keys: AIKeys,
): Promise<{ draft: ImovelDraft; modelUsed: string; sourceLength: number; via?: string }> {
  let sourceText: string;
  let via: string | undefined;

  if (input.kind === 'link') {
    const { text, via: how } = await fetchUrlSmart(input.payload);
    sourceText = `URL original: ${input.payload}\n\nConteúdo:\n${text}`;
    via = how;
  } else {
    sourceText = input.payload.trim();
  }

  if (sourceText.length < 5) throw new Error('Conteúdo insuficiente para extrair imóvel.');

  // limita tokens — Jina pode devolver muito conteúdo
  const limited = sourceText.slice(0, 30000);

  const fullPrompt = `${EXTRACTION_PROMPT}\n${limited}`;
  const result = await routedGenerate({
    feature: 'imovel_extract',
    prompt: fullPrompt,
    keys,
    temperature: 0.1,
  });

  const draft = parseAIJson(result.text);

  // garantir link_externo preservado
  if (input.kind === 'link' && !draft.link_externo) {
    draft.link_externo = input.payload;
  }

  return { draft, modelUsed: result.modelUsed, sourceLength: limited.length, via };
}
