import { NextResponse } from 'next/server';
import { createStaticAdminClient } from '@/lib/supabase/server';
import { normalizePhoneE164 } from '@/lib/phone';
import { sendTelegramMessage } from '@/lib/notifications/telegram';

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
// Funil Proprietários. Etapa "Oportunidade" resolvida em runtime (nome, fallback order 1).
const BOARD_PROPRIETARIOS = 'd08c7329-9e3e-43d1-ba42-6437a8363ae8';
const STAGE_OPORTUNIDADE_ID = '7de3274e-e873-4926-9a3e-ce16a9a81140';
const STAGE_OPORTUNIDADE_NOME = 'Oportunidade';

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

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

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
      channel: dadosInput ? 'ferramenta' : 'landing',
      ferramenta: str(body.ferramenta) || null,
      utm,
      imovel,
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

    // -------- 3) Resolver etapa "Oportunidade" do funil Proprietários --------
    let stageId: string | null = STAGE_OPORTUNIDADE_ID;
    {
      const { data: stage } = await sb
        .from('board_stages')
        .select('id')
        .eq('board_id', BOARD_PROPRIETARIOS)
        .eq('name', STAGE_OPORTUNIDADE_NOME)
        .limit(1)
        .maybeSingle();
      if (stage?.id) stageId = stage.id as string;
    }

    // -------- 4) Criar negócio (não duplica se já houver um aberto) --------
    let dealCreated = false;
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
        const { error: dealErr } = await sb.from('deals').insert({
          organization_id: ORG_ID,
          board_id: BOARD_PROPRIETARIOS,
          stage_id: stageId,
          contact_id: contactId,
          title: tituloImovel ? `${nome} — ${tituloImovel}` : `${nome} — ${source}`,
          status: 'open',
          value: 0,
          attribution,
        });
        dealCreated = !dealErr;
      }
    }

    // -------- 5) Alerta Telegram de lead nova (nunca para is_test) --------
    if (!isTest) {
      try {
        const { data: settings } = await sb
          .from('organization_settings')
          .select('telegram_crm_bot_token, telegram_crm_chat_id')
          .eq('organization_id', ORG_ID)
          .maybeSingle();
        const tgToken = settings?.telegram_crm_bot_token as string | undefined;
        const tgChat = settings?.telegram_crm_chat_id as string | undefined;
        if (tgToken && tgChat) {
          const contacto = [
            phone ? `📞 ${esc(phone)}` : null,
            email ? `✉️ ${esc(email)}` : null,
          ]
            .filter(Boolean)
            .join('  ');
          const imovelLinha = [imovel.tipo, imovel.tipologia, imovel.localizacao]
            .filter(Boolean)
            .join(' · ');
          const texto =
            `🟢 <b>Lead nova — captação</b>\n` +
            `👤 <b>${esc(nome)}</b>\n` +
            (contacto ? `${contacto}\n` : '') +
            `📣 Origem: <b>${esc(source)}</b>\n` +
            (imovelLinha ? `🏠 ${esc(imovelLinha)}\n` : '') +
            `\nAbrir: https://crm.joaofilipefonseca.pt/boards`;
          await sendTelegramMessage(tgToken, tgChat, texto);
        }
      } catch {
        /* Telegram best-effort: nunca bloqueia a recepção da lead. */
      }
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
