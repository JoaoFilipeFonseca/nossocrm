import { NextResponse } from 'next/server';
import { createStaticAdminClient } from '@/lib/supabase/server';
import { normalizePhoneE164 } from '@/lib/phone';
import { metaTokenSecretName } from '@/lib/integrations/meta/config';
import { buildCapiEvent, sendCapiEvents } from '@/lib/integrations/meta/capi';

export const runtime = 'nodejs';

/**
 * POST /api/leads/captura-amc — Cano único de captação de leads (Brief 1).
 *
 * Qualquer submissão de qualquer página do João (landings on-brand, calculadoras,
 * quiz, e o fan-out do edge `submit` do portal) cria contacto + negócio no CRM
 * com proveniência obrigatória. É o mesmo padrão da recepção Meta Ads
 * (edge automation-meta-leads) e da rota /api/leads/moradia.
 *
 * Regras respeitadas:
 * - Proveniência obrigatória: `source` (+ UTMs) sempre gravados na `attribution`.
 * - contacto != lead: o negócio nasce porque o formulário É um pedido explícito.
 * - Funil Proprietários, etapa "Oportunidade" (pediu algo = lead qualificado).
 * - Nunca devolve 5xx em erro lógico (as landings usam fire-and-forget keepalive).
 * - CORS para joaofilipefonseca.pt e subdomínios (+ deploy pages.dev).
 * - Nunca envia Telegram para dados de teste (is_test=true).
 * - Multi-tenant: org configurável por env, fallback para a org do João.
 *
 * Autenticação:
 * - Chamadas de browser (landings): validação estrita + honeypot + CORS.
 * - Chamadas server-to-server de confiança (edge `submit` do portal): header
 *   `x-captura-secret` == env `CAPTURA_AMC_SECRET`. Confiança relaxa o honeypot
 *   e o consentimento (o portal já os aplicou) e permite marcar is_test.
 */

const ORG_ID =
  process.env.CAPTURA_LEAD_ORG_ID || '29455d22-ebbf-4996-ac46-a071cb4363bf';
// Funil Proprietários (vendedores) — destino por defeito. Etapa "Oportunidade"
// resolvida em runtime (nome, fallback order 1).
const BOARD_PROPRIETARIOS = 'd08c7329-9e3e-43d1-ba42-6437a8363ae8';
const STAGE_OPORTUNIDADE_ID = '7de3274e-e873-4926-9a3e-ce16a9a81140';
// Funil Compradores — destino das LPs de imóvel (o visitante quer VER a casa,
// não vender a dele). As duas boards têm uma etapa "Oportunidade".
const BOARD_COMPRADORES = 'a70c40c7-5f9f-499b-9f39-f74cd9c596cf';
const STAGE_COMPRADORES_OPORTUNIDADE_ID = '6bd91fc8-a4f5-4235-831b-e65ac9dc5154';
const STAGE_OPORTUNIDADE_NOME = 'Oportunidade';

/**
 * CAPI Lead server-side (best-effort). Espelha o Pixel do browser com o MESMO
 * event_id para a Meta deduplicar. Só para leads de LP de imóvel (compradores).
 * Nunca atira: lê o token do Vault, e se algo falhar segue sem CAPI (o Pixel do
 * browser já cobre o essencial). O cano de leads nunca pode partir por causa disto.
 */
async function dispararCapiLead(
  sb: ReturnType<typeof createStaticAdminClient>,
  opts: { eventId: string; email: string | null; phone: string | null; sourceUrl: string | null; contentIds: string[] },
): Promise<void> {
  try {
    const { data: integ } = await sb
      .from('automation_integrations')
      .select('id, metadata')
      .eq('provider', 'meta')
      .eq('organization_id', ORG_ID)
      .eq('status', 'active')
      .maybeSingle();
    if (!integ) return;
    const integration = integ as { id: string; metadata: Record<string, unknown> | null };
    const tokenName =
      (integration.metadata?.token_secret_name as string) ?? metaTokenSecretName(integration.id);
    const { data: token } = await sb.rpc('meta_oauth_read_token', { p_name: tokenName });
    if (!token || typeof token !== 'string') return;

    const event = buildCapiEvent({
      eventName: 'Lead',
      eventId: opts.eventId,
      actionSource: 'website',
      eventSourceUrl: opts.sourceUrl ?? undefined,
      email: opts.email,
      phone: opts.phone,
      customData: {
        content_ids: opts.contentIds.join(','),
        content_type: 'product',
        lead_event_source: 'lp-imovel',
      },
    });
    await sendCapiEvents({ token, events: [event] });
  } catch {
    /* best-effort: o Pixel do browser é a via primária. */
  }
}

// ---------------------------------------------------------------------------
// CORS — reflecte a origem quando pertence aos domínios do João.
// ---------------------------------------------------------------------------
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return (
    /^https:\/\/([a-z0-9-]+\.)*joaofilipefonseca\.pt$/i.test(origin) ||
    /^https:\/\/([a-z0-9-]+\.)*pages\.dev$/i.test(origin)
  );
}

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin! : 'https://joaofilipefonseca.pt',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-captura-secret',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

// ---------------------------------------------------------------------------
// Validação de telemóvel PT com deteção de números falsos (repetidos,
// sequenciais, pares). Lógica original do João (route.reference.ts), mantida.
// ---------------------------------------------------------------------------
function isTelefoneValido(raw: string): boolean {
  let n = raw.replace(/[\s\-().]/g, '');
  n = n.replace(/^(\+351|00351)/, '');
  if (!/^[29]\d{8}$/.test(n)) return false;
  if (/^(\d)\1{8}$/.test(n)) return false;
  const asc = '0123456789';
  const desc = '9876543210';
  if (asc.includes(n) || desc.includes(n)) return false;
  const corpo = n.slice(1);
  if (asc.includes(corpo) || desc.includes(corpo)) return false;
  if (/^(\d\d)\1{3}\d?$/.test(n)) return false;
  if (new Set(n).size < 4) return false;
  return true;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function str(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

function json(body: unknown, status: number, origin: string | null) {
  return NextResponse.json(body, { status, headers: corsHeaders(origin) });
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get('origin');
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin');
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') {
      return json({ ok: false, error: 'corpo invalido' }, 400, origin);
    }

    // Confiança server-to-server (fan-out do edge submit do portal).
    const secret = process.env.CAPTURA_AMC_SECRET || '';
    const trusted =
      secret.length > 0 && req.headers.get('x-captura-secret') === secret;

    // -------- Campos (superset flexível de todas as páginas) --------
    const nome = str(body.nome ?? body.name);
    const emailRaw = str(body.email).toLowerCase();
    const email = emailRaw && EMAIL_RE.test(emailRaw) ? emailRaw : null;
    const telefoneRaw = str(body.telefone ?? body.phone ?? body.telemovel);
    const phone = telefoneRaw
      ? normalizePhoneE164(telefoneRaw, { defaultCountry: 'PT' }) || null
      : null;

    // Proveniência obrigatória: source explícito, ou origem/ferramenta, com fallback seguro.
    const source =
      str(body.source) ||
      str(body.origem) ||
      str(body.ferramenta) ||
      'landing-analise-mercado';

    // LPs de imóvel captam COMPRADORES (querem VER a casa) → funil Compradores,
    // nunca o de Proprietários. Detecta por flag explícita ou pelo source.
    const isComprador =
      str(body.funil).toLowerCase() === 'compradores' || source.startsWith('lp-imovel');
    const boardId = isComprador ? BOARD_COMPRADORES : BOARD_PROPRIETARIOS;
    const stageDefaultId = isComprador ? STAGE_COMPRADORES_OPORTUNIDADE_ID : STAGE_OPORTUNIDADE_ID;

    // event_id partilhado com o Pixel do browser, para o CAPI deduplicar.
    const eventId = str(body.event_id) || null;
    const contentIds = Array.isArray(body.content_ids)
      ? (body.content_ids as unknown[]).map(String)
      : [];

    const isTest =
      trusted && (body.is_test === true || body.is_test === 'true');

    // UTMs: aceita objecto `utm` ou campos utm_* achatados.
    const utmObj = (body.utm && typeof body.utm === 'object' ? body.utm : {}) as Record<string, unknown>;
    const utm = {
      source: str(utmObj.source ?? body.utm_source) || null,
      medium: str(utmObj.medium ?? body.utm_medium) || null,
      campaign: str(utmObj.campaign ?? body.utm_campaign) || null,
      content: str(utmObj.content ?? body.utm_content) || null,
      term: str(utmObj.term ?? body.utm_term) || null,
    };

    // Dados do imóvel/intenção (landing analise-mercado) — todos opcionais.
    const imovel = {
      tipo: str(body.tipo) || null,
      tipologia: str(body.tipologia) || null,
      localizacao: str(body.localizacao) || null,
      estado: str(body.estado) || null,
      area: str(body.area) || null,
      extras: Array.isArray(body.extras) ? (body.extras as unknown[]).map(String) : str(body.extras) || null,
      prazo: str(body.prazo ?? body.horizonte) || null,
      motivo: str(body.motivo) || null,
      horario: str(body.horario ?? body.horario_contacto) || null,
    };

    // Fan-out do portal traz dados_input/dados_output das ferramentas.
    const dadosInput = (body.dados_input && typeof body.dados_input === 'object' ? body.dados_input : null) as Record<string, unknown> | null;
    const dadosOutput = (body.dados_output && typeof body.dados_output === 'object' ? body.dados_output : null) as Record<string, unknown> | null;

    const mensagem = str(body.mensagem ?? body.nota);
    const referrer = str(body.referrer) || null;
    const landingUrl = str(body.landing_url ?? body.origem_url ?? body.url) || null;

    // -------- Honeypot (só para browser não-confiável) --------
    const honeypot = str(body.website_url ?? body._hp);
    if (!trusted && honeypot !== '') {
      // OK silencioso — não informa o bot que foi detectado.
      return json({ ok: true }, 200, origin);
    }

    // -------- Validação --------
    if (!nome || nome.length < 2 || nome.length > 80) {
      return json({ ok: false, error: 'nome obrigatorio' }, 400, origin);
    }
    // Telefone: valida com a lógica anti-fraude; browser exige válido, confiança é tolerante.
    if (telefoneRaw && !isTelefoneValido(telefoneRaw) && !trusted) {
      // Telefone inválido num post de browser: só falha se não houver email de recurso.
      if (!email) {
        return json({ ok: false, error: 'telefone invalido' }, 400, origin);
      }
    }
    if (!phone && !email) {
      return json({ ok: false, error: 'telefone ou email obrigatorio' }, 400, origin);
    }
    // Consentimento: browser exige opt-in explícito; confiança já vem consentida do portal.
    if (!trusted && body.consentimento !== true && body.consent == null) {
      return json({ ok: false, error: 'consentimento em falta' }, 400, origin);
    }

    const sb = createStaticAdminClient();

    const attribution = {
      source,
      funil: isComprador ? 'compradores' : 'proprietarios',
      channel: dadosInput ? 'ferramenta' : 'landing',
      ferramenta: str(body.ferramenta) || null,
      utm,
      imovel,
      imovel_slug: str(body.imovel_slug) || null,
      event_id: eventId,
      referrer,
      landing_url: landingUrl,
      is_test: isTest,
      captured_at: new Date().toISOString(),
    };

    // -------- Nota legível (o João abre e vê tudo) --------
    const notaLinhas: (string | null)[] = [
      `Lead de captação — ${source}.`,
      imovel.tipo || imovel.tipologia || imovel.localizacao
        ? `Imóvel: ${[imovel.tipo, imovel.tipologia].filter(Boolean).join(' ')}${imovel.localizacao ? ' · ' + imovel.localizacao : ''}`.trim()
        : null,
      imovel.area ? `Área: ${imovel.area}` : null,
      imovel.estado ? `Estado: ${imovel.estado}` : null,
      imovel.extras && (Array.isArray(imovel.extras) ? imovel.extras.length : imovel.extras)
        ? `Extras: ${Array.isArray(imovel.extras) ? imovel.extras.join(', ') : imovel.extras}`
        : null,
      imovel.prazo ? `Prazo de venda: ${imovel.prazo}` : null,
      imovel.motivo ? `Motivo: ${imovel.motivo}` : null,
      imovel.horario ? `Melhor horário: ${imovel.horario}` : null,
      mensagem ? `Mensagem: ${mensagem}` : null,
    ];
    if (dadosInput) {
      notaLinhas.push('', 'Respostas:');
      for (const [k, v] of Object.entries(dadosInput)) {
        if (k === 'consent') continue;
        notaLinhas.push(`${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`);
      }
    }
    if (dadosOutput && Object.keys(dadosOutput).length) {
      notaLinhas.push('', 'Resultado:');
      for (const [k, v] of Object.entries(dadosOutput)) {
        notaLinhas.push(`${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`);
      }
    }
    const notes = notaLinhas.filter((l) => l !== null).join('\n');

    // -------- 1) Dedup de contacto por email OU telefone (E.164), na org --------
    let contactId: string | null = null;
    {
      const orFilters: string[] = [];
      if (email) orFilters.push(`email.eq.${email}`);
      if (phone) orFilters.push(`phone.eq.${phone}`);
      if (orFilters.length) {
        const { data: existing } = await sb
          .from('contacts')
          .select('id')
          .eq('organization_id', ORG_ID)
          .or(orFilters.join(','))
          .is('deleted_at', null)
          .order('created_at')
          .limit(1)
          .maybeSingle();
        contactId = existing?.id ?? null;
      }
    }

    // -------- 2) Criar contacto se novo; senão backfill de atribuição --------
    if (!contactId) {
      const { data: novo, error: contactErr } = await sb
        .from('contacts')
        .insert({
          organization_id: ORG_ID,
          name: nome,
          email,
          phone,
          source,
          notes,
          attribution,
        })
        .select('id')
        .single();
      if (contactErr || !novo) {
        // Nunca 5xx: comunica com 200 para a landing não entrar em retry.
        return json({ ok: false, error: 'falha ao gravar contacto' }, 200, origin);
      }
      contactId = novo.id;
    } else {
      await sb
        .from('contacts')
        .update({ attribution })
        .eq('id', contactId)
        .is('attribution', null);
    }

    // -------- 3) Resolver etapa "Oportunidade" do funil escolhido --------
    let stageId: string | null = stageDefaultId;
    {
      const { data: stage } = await sb
        .from('board_stages')
        .select('id')
        .eq('board_id', boardId)
        .eq('name', STAGE_OPORTUNIDADE_NOME)
        .limit(1)
        .maybeSingle();
      if (stage?.id) stageId = stage.id as string;
    }

    // -------- 4) Criar negócio (não duplica se já houver um aberto) --------
    let dealCreated = false;
    let newDealId: string | null = null;
    if (stageId) {
      const { data: aberto } = await sb
        .from('deals')
        .select('id')
        .eq('organization_id', ORG_ID)
        .eq('contact_id', contactId)
        .eq('status', 'open')
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle();

      if (!aberto) {
        const tituloImovel = [imovel.tipo, imovel.tipologia, imovel.localizacao]
          .filter(Boolean)
          .join(' ');
        const { data: novoDeal, error: dealErr } = await sb
          .from('deals')
          .insert({
            organization_id: ORG_ID,
            board_id: boardId,
            stage_id: stageId,
            contact_id: contactId,
            title: tituloImovel ? `${nome} — ${tituloImovel}` : `${nome} — ${source}`,
            status: 'open',
            value: 0,
            attribution,
          })
          .select('id')
          .single();
        dealCreated = !dealErr;
        newDealId = novoDeal?.id ?? null;
      }
    }

    // -------- 5) Épico Coração: resposta imediata a lead nova --------
    // Publica o evento lead.captured (só para leads reais e negócios novos) e
    // acorda o listener na hora, para o email de acolhimento + push "LIGA AGORA"
    // saírem em menos de 60s. A automação (visível em /automacoes) trata do
    // email, do Telegram e do registo na timeline (actor='automation').
    if (!isTest && dealCreated && newDealId) {
      try {
        await sb.rpc('publish_event', {
          p_event_type: 'lead.captured',
          p_payload: {
            deal_id: newDealId,
            contact_id: contactId,
            source,
            is_test: false,
          },
          p_organization_id: ORG_ID,
          p_source: 'captura-amc',
          p_idempotency_key: `lead.captured:${newDealId}`,
        });
      } catch {
        /* publish best-effort: o tick do cron apanha o evento se isto falhar. */
      }
      // Nudge imediato ao listener (fire-and-forget com timeout curto).
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (url && key) {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 20000);
          try {
            await fetch(`${url}/functions/v1/automation-event-listener`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
              body: '{}',
              signal: controller.signal,
            });
          } finally {
            clearTimeout(timer);
          }
        }
      } catch {
        /* nudge best-effort: o cron corre a cada minuto como rede de segurança. */
      }
    }

    // -------- 6) CAPI Lead (só LPs de imóvel): espelha o Pixel do browser --------
    // Mesmo event_id → a Meta deduplica browser + servidor. Best-effort: se não
    // houver token/integração, segue sem CAPI (o Pixel já disparou no browser).
    if (!isTest && isComprador && eventId) {
      await dispararCapiLead(sb, {
        eventId,
        email,
        phone,
        sourceUrl: landingUrl,
        contentIds: contentIds.length ? contentIds : [source],
      });
    }

    return json(
      { ok: true, contact_id: contactId, deal_created: dealCreated, is_test: isTest },
      200,
      origin,
    );
  } catch {
    // Salvaguarda final: nunca 5xx.
    return json({ ok: false, error: 'erro inesperado' }, 200, origin);
  }
}
