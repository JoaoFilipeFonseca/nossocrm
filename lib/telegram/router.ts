import 'server-only';
import { routedGenerate, type AIKeys } from '@/lib/ai/router';

export type OperationalDomain = 'imovel' | 'deal' | 'atividade' | 'sistema' | 'none';

export interface OperationalIntent {
  domain: OperationalDomain;
  action: string;
  entity_ref: string | null;
  payload: Record<string, unknown>;
  confidence: number;
  summary: string;
}

const ROUTER_PROMPT = `Es um router de intents de um CRM imobiliario portugues. Devolves APENAS JSON valido (sem markdown, sem code fences).

Contexto: utilizador escreveu mensagem curta no Telegram, possivelmente referindo o imovel "activo" definido ou um deal/tarefa.

DOMINIO "imovel" (acoes sobre imovel activo):
  - "muda_estado" -> payload: {estado: "disponivel|reservado|vendido|retirado|pausado|em_avaliacao"}
  - "muda_preco" -> payload: {preco: 285000}  // sempre numero inteiro em euros
  - "add_dono" -> payload: {nome: "Nome Completo", percentagem: 50, residente: true|false|null}
  - "attach_doc" -> payload: {kind: "caderneta|certidao|licenca_utilizacao|ftecnica|certificado_energetico|planta|mandato|outro"}

DOMINIO "deal" / "atividade" -> nao suportado nesta versao -> devolve domain="none"

DOMINIO "sistema":
  - "menu" / "parar" / "ajuda"

DOMINIO "none": quando nao se encaixa (texto longo descrevendo imovel novo, listas, procuras, conversa).

EXEMPLOS:
"ja esta vendido" -> {"domain":"imovel","action":"muda_estado","payload":{"estado":"vendido"},"confidence":95,"summary":"Marcar como vendido"}
"passa a reservado" -> {"domain":"imovel","action":"muda_estado","payload":{"estado":"reservado"},"confidence":95,"summary":"Marcar como reservado"}
"baixei para 275000" -> {"domain":"imovel","action":"muda_preco","payload":{"preco":275000},"confidence":95,"summary":"Preco 275000 EUR"}
"275 mil" -> {"domain":"imovel","action":"muda_preco","payload":{"preco":275000},"confidence":80,"summary":"Preco 275000 EUR"}
"novo preco 1.65M" -> {"domain":"imovel","action":"muda_preco","payload":{"preco":1650000},"confidence":85,"summary":"Preco 1650000 EUR"}
"o dono e o Joao Silva com 50%" -> {"domain":"imovel","action":"add_dono","payload":{"nome":"Joao Silva","percentagem":50,"residente":null},"confidence":95,"summary":"Adicionar dono Joao Silva 50%"}
"proprietario Maria Costa 100%" -> {"domain":"imovel","action":"add_dono","payload":{"nome":"Maria Costa","percentagem":100,"residente":null},"confidence":90,"summary":"Adicionar Maria Costa 100%"}
"e a caderneta" -> {"domain":"imovel","action":"attach_doc","payload":{"kind":"caderneta"},"confidence":95,"summary":"Ultimo ficheiro = caderneta"}
"isto e o CE" -> {"domain":"imovel","action":"attach_doc","payload":{"kind":"certificado_energetico"},"confidence":90,"summary":"Ultimo ficheiro = CE"}
"a planta" -> {"domain":"imovel","action":"attach_doc","payload":{"kind":"planta"},"confidence":85,"summary":"Ultimo ficheiro = planta"}
"T2 boavista 250k 3 andar bom estado" -> {"domain":"none","action":"","payload":{},"confidence":85,"summary":""}
"olá" -> {"domain":"none","action":"","payload":{},"confidence":80,"summary":""}

Schema obrigatorio:
{"domain":"...","action":"...","payload":{...},"confidence":0-100,"summary":"frase curta pt-PT"}

Mensagem do utilizador:
`;

function extractFirstJsonObject(raw: string): string {
  const start = raw.indexOf('{');
  if (start < 0) throw new Error('Sem JSON na resposta');
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < raw.length; i++) {
    const c = raw[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return raw.slice(start, i + 1); }
  }
  throw new Error('JSON sem fim');
}

export async function classifyOperational(
  text: string,
  ctx: { hasActiveImovel: boolean },
  keys: AIKeys,
): Promise<OperationalIntent> {
  const trimmed = text.trim();
  // Optimizacao: textos muito curtos ou muito longos nao se encaixam em comando operacional
  if (trimmed.length < 2 || trimmed.length > 300) {
    return { domain: 'none', action: '', entity_ref: null, payload: {}, confidence: 0, summary: '' };
  }
  try {
    const result = await routedGenerate({
      feature: 'imovel_extract',
      prompt: `${ROUTER_PROMPT}\nactivo_definido: ${ctx.hasActiveImovel}\n\n"${trimmed.slice(0, 500)}"`,
      keys,
      temperature: 0.0,
    });
    const cleaned = extractFirstJsonObject(result.text);
    const p = JSON.parse(cleaned) as Partial<OperationalIntent>;
    return {
      domain: ((p.domain as OperationalDomain) ?? 'none'),
      action: typeof p.action === 'string' ? p.action : '',
      entity_ref: typeof p.entity_ref === 'string' ? p.entity_ref : null,
      payload: typeof p.payload === 'object' && p.payload != null ? (p.payload as Record<string, unknown>) : {},
      confidence: typeof p.confidence === 'number' ? p.confidence : 0,
      summary: typeof p.summary === 'string' ? p.summary : '',
    };
  } catch {
    return { domain: 'none', action: '', entity_ref: null, payload: {}, confidence: 0, summary: '' };
  }
}
