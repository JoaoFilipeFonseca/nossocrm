import { NextRequest, NextResponse } from 'next/server';
import { createStaticAdminClient } from '@/lib/supabase/server';
import { sendTelegramMessage } from '@/lib/notifications/telegram';
import { extractImovelFromInput, extractRawIntelList, classifyTelegramMessage } from '@/lib/imoveis/captar';
import { fetchImagesFromUrl, downloadAndUploadPhotos } from '@/lib/imoveis/fotos-from-url';
import { classifyOperational } from '@/lib/telegram/router';
import { mudaEstado, mudaPreco, addProprietario, reclassifyLastDoc } from '@/lib/telegram/handlers/imovel';
import { triggerMatchesAsync } from '@/lib/matches/engine';
import type { AIKeys } from '@/lib/ai/router';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://crm-joao.vercel.app';
const PENDING_TTL_MS = 10 * 60 * 1000;
const TELEGRAM_API = 'https://api.telegram.org';

interface TelegramPhotoSize { file_id: string; file_unique_id: string; width: number; height: number; file_size?: number; }
interface TelegramDocument { file_id: string; file_unique_id: string; file_name?: string; mime_type?: string; file_size?: number; }
interface TelegramCallbackQuery { id: string; from: { id: number }; message?: { chat: { id: number } }; data?: string; }

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; type: string };
    from?: { id: number; first_name?: string };
    text?: string;
    caption?: string;
    photo?: TelegramPhotoSize[];
    document?: TelegramDocument;
    date: number;
  };
  callback_query?: TelegramCallbackQuery;
}

type Mode = 'single' | 'list' | 'procura';

interface OrgRow {
  organization_id: string;
  telegram_crm_bot_token: string | null;
  telegram_crm_webhook_secret: string | null;
  telegram_active_imovel_id: string | null;
  telegram_pending_action: { type: string; text: string; suggested_kind: Mode; summary: string; created_at: string } | null;
  telegram_busy: boolean | null;
  telegram_cancel: boolean | null;
  telegram_mode: Mode | null;
  ai_google_key: string | null;
  ai_anthropic_key: string | null;
}

// --- Telegram helpers ----

async function tgSendMenu(token: string, chatId: string) {
  const body = {
    chat_id: chatId,
    text: '<b>O que queres fazer?</b>\nEscolhe e depois envia a mensagem (texto, link ou foto):',
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🏠 Imóvel meu', callback_data: 'mode:single' }, { text: '💎 Off-market / Match', callback_data: 'mode:list' }],
        [{ text: '🔍 Procura cliente', callback_data: 'mode:procura' }, { text: '📸 Só foto', callback_data: 'mode:foto' }],
        [{ text: '📌 Imóvel activo', callback_data: 'cmd:activo' }, { text: '🧹 Esquecer activo', callback_data: 'cmd:novo' }],
        [{ text: '📋 Últimos 5', callback_data: 'cmd:ultimos' }, { text: '📊 Briefing', callback_data: 'cmd:briefing' }],
        [{ text: '⛔ Parar', callback_data: 'cmd:parar' }],
      ],
    },
  };
  await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function tgAnswerCallback(token: string, callbackId: string, text?: string) {
  await fetch(`${TELEGRAM_API}/bot${token}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackId, text: text ?? '' }),
  });
}

async function safeSend(
  supabase: ReturnType<typeof createStaticAdminClient>,
  org: { organization_id: string },
  token: string,
  chatId: string,
  text: string,
): Promise<boolean> {
  // Verifica cancel antes de enviar
  const { data } = await supabase
    .from('organization_settings')
    .select('telegram_cancel')
    .eq('organization_id', org.organization_id)
    .single();
  if (data?.telegram_cancel) return false;
  try {
    await sendTelegramMessage(token, chatId, text);
    return true;
  } catch {
    return false;
  }
}

async function clearBusy(
  supabase: ReturnType<typeof createStaticAdminClient>,
  org: { organization_id: string },
  patch: Record<string, unknown> = {},
) {
  await supabase
    .from('organization_settings')
    .update({ telegram_busy: false, telegram_cancel: false, ...patch })
    .eq('organization_id', org.organization_id);
}

async function setBusy(
  supabase: ReturnType<typeof createStaticAdminClient>,
  org: { organization_id: string },
) {
  await supabase
    .from('organization_settings')
    .update({ telegram_busy: true, telegram_cancel: false })
    .eq('organization_id', org.organization_id);
}

// --- Handler principal ----

export async function POST(request: NextRequest) {
  const secretHeader = request.headers.get('x-telegram-bot-api-secret-token');
  if (!secretHeader) return NextResponse.json({ ok: false, error: 'Missing secret' }, { status: 401 });

  let body: TelegramUpdate;
  try { body = await request.json(); }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }); }

  // Determinar chatId
  const chatId = body.message?.chat?.id
    ? String(body.message.chat.id)
    : body.callback_query?.message?.chat?.id
      ? String(body.callback_query.message.chat.id)
      : null;
  if (!chatId) return NextResponse.json({ ok: true, ignored: 'no chat' });

  const supabase = createStaticAdminClient();
  const { data: orgRaw } = await supabase
    .from('organization_settings')
    .select('organization_id, telegram_crm_bot_token, telegram_crm_webhook_secret, telegram_active_imovel_id, telegram_pending_action, telegram_busy, telegram_cancel, telegram_mode, ai_google_key, ai_anthropic_key')
    .eq('telegram_crm_chat_id', chatId)
    .maybeSingle();

  if (!orgRaw) return NextResponse.json({ ok: true, ignored: 'unknown chat' });
  const org = orgRaw as OrgRow;

  if (org.telegram_crm_webhook_secret && org.telegram_crm_webhook_secret !== secretHeader) {
    return NextResponse.json({ ok: false, error: 'Invalid secret' }, { status: 401 });
  }
  const token = org.telegram_crm_bot_token;
  if (!token) return NextResponse.json({ ok: false, error: 'No bot token' }, { status: 500 });

  // CALLBACK QUERY (botões inline)
  if (body.callback_query) {
    return await handleCallback(body.callback_query, token, chatId, supabase, org);
  }

  const message = body.message;
  if (!message) return NextResponse.json({ ok: true, ignored: 'no message' });

  // Fotos / documento imagem (sempre permitido)
  if (message.photo && message.photo.length > 0) {
    return await handleTelegramPhoto(message.photo, token, chatId, supabase, org);
  }
  if (message.document && message.document.mime_type?.startsWith('image/')) {
    return await handleTelegramDocument(message.document, token, chatId, supabase, org);
  }

  const text = (message.text ?? message.caption ?? '').trim();
  if (!text) {
    await safeSend(supabase, org, token, chatId, '🤖 Manda texto, link ou foto. /menu para ver opções.');
    return NextResponse.json({ ok: true });
  }

  // COMANDOS DE PARAGEM (sempre prioritários, mesmo durante busy)
  const lower = text.toLowerCase().trim();
  if (lower === '/parar' || lower === '/stop' || lower === '/x' || lower === 'parar' || lower === 'cancelar' || lower === 'stop') {
    await clearBusy(supabase, org, { telegram_cancel: true, telegram_pending_action: null, telegram_mode: null });
    await sendTelegramMessage(token, chatId, '⛔ <b>Parado.</b> Cancelei o que estava a fazer e limpei pendências.\n\n/menu para começar de novo.');
    return NextResponse.json({ ok: true, stopped: true });
  }

  // Outros comandos
  if (text.startsWith('/start') || lower === '/help' || lower === '/ajuda' || lower === '/menu') {
    await tgSendMenu(token, chatId);
    return NextResponse.json({ ok: true });
  }
  if (lower === '/activo' || lower === '/ativo') return await handleActivo(token, chatId, supabase, org);
  if (lower === '/novo' || lower === '/limpar') {
    await clearBusy(supabase, org, { telegram_active_imovel_id: null, telegram_pending_action: null, telegram_mode: null });
    await sendTelegramMessage(token, chatId, '🧹 Limpo.');
    return NextResponse.json({ ok: true });
  }
  if (lower === '/cancelar') {
    await clearBusy(supabase, org, { telegram_pending_action: null, telegram_mode: null });
    await sendTelegramMessage(token, chatId, '❌ Pendência limpa.');
    return NextResponse.json({ ok: true });
  }

  const keys: AIKeys = { google: org.ai_google_key ?? undefined, anthropic: org.ai_anthropic_key ?? undefined };
  if (!keys.google && !keys.anthropic) {
    await sendTelegramMessage(token, chatId, '❌ Sem chave de IA. /settings/ai no CRM.');
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // MODO WIZARD: utilizador já escolheu o tipo no menu
  if (org.telegram_mode) {
    const mode = org.telegram_mode;
    await clearBusy(supabase, org, { telegram_mode: null }); // consome o modo
    return await processWithKind(text, mode, token, chatId, supabase, org, keys);
  }

  // PENDÊNCIA — resposta à pergunta anterior
  if (org.telegram_pending_action && Date.now() - new Date(org.telegram_pending_action.created_at).getTime() < PENDING_TTL_MS) {
    return await handlePendingResponse(text, org.telegram_pending_action, token, chatId, supabase, org, keys);
  }

  // Prefixos forçados
  const forced = parseForcePrefix(text);
  if (forced) return await processWithKind(forced.text, forced.kind, token, chatId, supabase, org, keys);

  // Router operacional: comandos sobre imóvel activo (estado/preço/dono/doc)
  // Só corre se houver activo definido e texto curto — economiza chamadas IA
  if (org.telegram_active_imovel_id && text.length <= 300) {
    const op = await classifyOperational(text, { hasActiveImovel: true }, keys);
    if (op.domain === 'imovel' && op.confidence >= 75) {
      const orgCtx = { organization_id: org.organization_id, telegram_active_imovel_id: org.telegram_active_imovel_id };
      let res: { ok: boolean; mensagem: string } | null = null;
      if (op.action === 'muda_estado') {
        res = await mudaEstado(supabase, orgCtx, String(op.payload.estado ?? ''));
      } else if (op.action === 'muda_preco') {
        res = await mudaPreco(supabase, orgCtx, Number(op.payload.preco ?? 0));
      } else if (op.action === 'add_dono') {
        const pct = op.payload.percentagem != null ? Number(op.payload.percentagem) : null;
        const res2 = op.payload.residente;
        const resid = res2 == null ? null : Boolean(res2);
        res = await addProprietario(supabase, orgCtx, String(op.payload.nome ?? ''), pct, resid);
      } else if (op.action === 'attach_doc') {
        res = await reclassifyLastDoc(supabase, orgCtx, String(op.payload.kind ?? 'outro'));
      }
      if (res) {
        await safeSend(supabase, org, token, chatId, res.mensagem);
        return NextResponse.json({ ok: true, op: op.action, ok_action: res.ok });
      }
    }
  }

  // Classificação IA
  await setBusy(supabase, org);
  await safeSend(supabase, org, token, chatId, '⏳ A analisar...');
  const cls = await classifyTelegramMessage(text, keys);
  await clearBusy(supabase, org);

  if (cls.kind === 'irrelevante' || cls.kind === 'command') {
    await tgSendMenu(token, chatId);
    return NextResponse.json({ ok: true, classified: cls.kind });
  }
  if (cls.confidence >= 75) {
    const k: Mode = cls.kind === 'list' ? 'list' : cls.kind === 'procura' ? 'procura' : 'single';
    return await processWithKind(text, k, token, chatId, supabase, org, keys);
  }

  // Confidence baixa → pergunta com botões
  const suggested: Mode = cls.kind === 'list' ? 'list' : cls.kind === 'procura' ? 'procura' : 'single';
  await supabase.from('organization_settings').update({
    telegram_pending_action: { type: 'classify', text, suggested_kind: suggested, summary: cls.summary, created_at: new Date().toISOString() },
  }).eq('organization_id', org.organization_id);

  await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      parse_mode: 'HTML',
      text: `🤔 <i>${escapeHtml(cls.summary)}</i>\nConfiança: ${cls.confidence}%. <b>O que é?</b>`,
      reply_markup: {
        inline_keyboard: [
          [{ text: '🏠 Meu', callback_data: `confirm:single` }, { text: '💎 Off-market', callback_data: `confirm:list` }],
          [{ text: '🔍 Procura', callback_data: `confirm:procura` }, { text: '⛔ Cancelar', callback_data: 'cmd:cancelar' }],
        ],
      },
    }),
  });
  return NextResponse.json({ ok: true, pending: true });
}

// --- CALLBACK BUTTONS ---

async function handleCallback(
  cb: TelegramCallbackQuery,
  token: string,
  chatId: string,
  supabase: ReturnType<typeof createStaticAdminClient>,
  org: OrgRow,
) {
  const data = cb.data ?? '';
  await tgAnswerCallback(token, cb.id);

  if (data.startsWith('mode:')) {
    const mode = data.split(':')[1] as Mode | 'foto';
    if (mode === 'foto') {
      await sendTelegramMessage(token, chatId,
        `📸 Modo foto. Manda <b>uma foto</b> e eu adiciono ao imóvel activo${org.telegram_active_imovel_id ? '' : ' (precisas criar um primeiro)'}.`);
      return NextResponse.json({ ok: true });
    }
    await supabase.from('organization_settings').update({ telegram_mode: mode, telegram_pending_action: null })
      .eq('organization_id', org.organization_id);
    const label = mode === 'single' ? '🏠 Imóvel meu' : mode === 'list' ? '💎 Off-market / Match' : '🔍 Procura cliente';
    await sendTelegramMessage(token, chatId, `${label} seleccionado.\n\nAgora <b>manda o texto ou link</b>.`);
    return NextResponse.json({ ok: true });
  }

  if (data.startsWith('confirm:')) {
    const mode = data.split(':')[1] as Mode;
    const pending = org.telegram_pending_action;
    if (!pending) {
      await sendTelegramMessage(token, chatId, '⏰ Pendência expirou. /menu para começar.');
      return NextResponse.json({ ok: true });
    }
    await supabase.from('organization_settings').update({ telegram_pending_action: null })
      .eq('organization_id', org.organization_id);
    const keys: AIKeys = { google: org.ai_google_key ?? undefined, anthropic: org.ai_anthropic_key ?? undefined };
    return await processWithKind(pending.text, mode, token, chatId, supabase, org, keys);
  }

  if (data === 'cmd:activo') return await handleActivo(token, chatId, supabase, org);
  if (data === 'cmd:ultimos') return await handleUltimos(token, chatId, supabase, org);
  if (data === 'cmd:briefing') return await handleBriefing(token, chatId, supabase, org);
  if (data === 'cmd:novo') {
    await clearBusy(supabase, org, { telegram_active_imovel_id: null, telegram_pending_action: null, telegram_mode: null });
    await sendTelegramMessage(token, chatId, '🧹 Limpo.');
    return NextResponse.json({ ok: true });
  }
  if (data === 'cmd:parar' || data === 'cmd:cancelar') {
    await clearBusy(supabase, org, { telegram_cancel: true, telegram_pending_action: null, telegram_mode: null });
    await sendTelegramMessage(token, chatId, '⛔ Parado.');
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}

async function handleUltimos(token: string, chatId: string, supabase: ReturnType<typeof createStaticAdminClient>, org: OrgRow) {
  const { data } = await supabase
    .from('imoveis')
    .select('id, referencia, morada, titulo_anuncio, tipologia, concelho, preco_actual, estado, created_at')
    .eq('organization_id', org.organization_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(5);
  if (!data || data.length === 0) {
    await sendTelegramMessage(token, chatId, 'Sem imóveis ainda. /menu para começar.');
    return NextResponse.json({ ok: true });
  }
  const lines = data.map((i, idx) => {
    const rec = i as { id: string; referencia?: string | null; morada?: string | null; titulo_anuncio?: string | null; tipologia?: string | null; concelho?: string | null; preco_actual?: number | string | null; estado?: string | null };
    const label = rec.referencia ?? rec.morada ?? rec.titulo_anuncio ?? 'sem nome';
    const tip = rec.tipologia ? `${escapeHtml(rec.tipologia)} ` : '';
    const concelho = rec.concelho ? ` · ${escapeHtml(rec.concelho)}` : '';
    const preco = rec.preco_actual ? ` · ${formatPreco(Number(rec.preco_actual))}€` : '';
    const estado = rec.estado ? ` <i>(${escapeHtml(rec.estado)})</i>` : '';
    return `${idx + 1}. ${tip}<b>${escapeHtml(String(label))}</b>${concelho}${preco}${estado}\n   <a href="${APP_URL}/imoveis/${rec.id}">Abrir ↗</a>`;
  });
  await sendTelegramMessage(token, chatId, `📋 <b>Últimos 5 imóveis</b>\n\n${lines.join('\n\n')}`);
  return NextResponse.json({ ok: true });
}

async function handleBriefing(token: string, chatId: string, supabase: ReturnType<typeof createStaticAdminClient>, org: OrgRow) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString();
  const amanha = new Date(today.getTime() + 24 * 3600 * 1000).toISOString();
  const ontem = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const [imoveisHoje, emAvaliacao, intelNovo, tarefasHoje, dealsAbertos] = await Promise.all([
    supabase.from('imoveis').select('id', { count: 'exact', head: true })
      .eq('organization_id', org.organization_id).is('deleted_at', null).gte('created_at', todayIso),
    supabase.from('imoveis').select('id', { count: 'exact', head: true })
      .eq('organization_id', org.organization_id).is('deleted_at', null).eq('estado', 'em_avaliacao'),
    supabase.from('raw_intel').select('id', { count: 'exact', head: true })
      .eq('organization_id', org.organization_id).gte('created_at', ontem),
    supabase.from('activities').select('id', { count: 'exact', head: true })
      .eq('organization_id', org.organization_id).is('deleted_at', null).eq('completed', false).lt('date', amanha),
    supabase.from('deals').select('id', { count: 'exact', head: true })
      .eq('organization_id', org.organization_id).is('deleted_at', null).eq('is_won', false).eq('is_lost', false),
  ]);

  const text =
    `📊 <b>Briefing do dia</b>\n\n` +
    `🆕 Imóveis novos hoje: <b>${imoveisHoje.count ?? 0}</b>\n` +
    `⏳ Em avaliação: <b>${emAvaliacao.count ?? 0}</b>\n` +
    `💎 Intel novo (24h): <b>${intelNovo.count ?? 0}</b>\n` +
    `✅ Tarefas pendentes até hoje: <b>${tarefasHoje.count ?? 0}</b>\n` +
    `💼 Deals em aberto: <b>${dealsAbertos.count ?? 0}</b>\n\n` +
    `<a href="${APP_URL}">Abrir CRM ↗</a>`;

  await sendTelegramMessage(token, chatId, text);
  return NextResponse.json({ ok: true });
}

async function handleActivo(token: string, chatId: string, supabase: ReturnType<typeof createStaticAdminClient>, org: OrgRow) {
  if (org.telegram_active_imovel_id) {
    const { data: imv } = await supabase
      .from('imoveis').select('referencia, morada, titulo_anuncio').eq('id', org.telegram_active_imovel_id).maybeSingle();
    const label = imv?.referencia ?? imv?.morada ?? imv?.titulo_anuncio ?? 'sem nome';
    await sendTelegramMessage(token, chatId,
      `📌 Imóvel activo: <b>${escapeHtml(String(label))}</b>\n<a href="${APP_URL}/imoveis/${org.telegram_active_imovel_id}">Abrir ↗</a>`);
  } else {
    await sendTelegramMessage(token, chatId, 'Sem imóvel activo. /menu para começar.');
  }
  return NextResponse.json({ ok: true });
}

// --- Pendência por texto ---

async function handlePendingResponse(
  text: string,
  pending: NonNullable<OrgRow['telegram_pending_action']>,
  token: string,
  chatId: string,
  supabase: ReturnType<typeof createStaticAdminClient>,
  org: OrgRow,
  keys: AIKeys,
) {
  const lower = text.toLowerCase().trim();
  await supabase.from('organization_settings').update({ telegram_pending_action: null })
    .eq('organization_id', org.organization_id);

  if (/^(sim|ok|avan[çc]a|confirma|yes)$/i.test(lower)) {
    return await processWithKind(pending.text, pending.suggested_kind, token, chatId, supabase, org, keys);
  }
  if (/lista|off|match/i.test(lower)) return await processWithKind(pending.text, 'list', token, chatId, supabase, org, keys);
  if (/meu|im[oó]vel|angaria/i.test(lower)) return await processWithKind(pending.text, 'single', token, chatId, supabase, org, keys);
  if (/procura/i.test(lower)) return await processWithKind(pending.text, 'procura', token, chatId, supabase, org, keys);
  if (/^(n[aã]o|cancelar)$/i.test(lower)) {
    await sendTelegramMessage(token, chatId, '❌ Cancelado.');
    return NextResponse.json({ ok: true });
  }
  await tgSendMenu(token, chatId);
  return NextResponse.json({ ok: true });
}

// --- Dispatch ---

async function processWithKind(
  text: string,
  kind: Mode,
  token: string,
  chatId: string,
  supabase: ReturnType<typeof createStaticAdminClient>,
  org: OrgRow,
  keys: AIKeys,
) {
  if (kind === 'single') return await handleSingle(text, supabase, org, token, chatId, keys);
  return await handleListOrProcura(text, kind, supabase, org, token, chatId, keys);
}

async function handleSingle(
  text: string,
  supabase: ReturnType<typeof createStaticAdminClient>,
  org: OrgRow,
  token: string,
  chatId: string,
  keys: AIKeys,
) {
  await setBusy(supabase, org);
  await safeSend(supabase, org, token, chatId, '⏳ A criar imóvel...');
  try {
    const { draft, modelUsed } = await extractImovelFromInput({ kind: 'text', payload: text }, keys);

    // Verifica cancel antes de gravar
    const { data: cancelCheck } = await supabase
      .from('organization_settings').select('telegram_cancel').eq('organization_id', org.organization_id).single();
    if (cancelCheck?.telegram_cancel) {
      await clearBusy(supabase, org);
      return NextResponse.json({ ok: true, cancelled: true });
    }

    const payload: Record<string, unknown> = {
      organization_id: org.organization_id,
      estado: 'em_avaliacao',
      tipo: draft.tipo ?? 'apartamento',
      tipo_negocio: draft.tipo_negocio ?? 'venda',
    };
    const keysToCopy = [
      'referencia', 'subtipo', 'estado_conservacao', 'tipologia',
      'morada', 'numero_policia', 'codigo_postal', 'freguesia', 'concelho', 'distrito',
      'area_util', 'area_bruta', 'area_terreno', 'area_dependente',
      'quartos', 'quartos_suite', 'wcs', 'piso', 'pisos_imovel',
      'cozinha_tipo', 'sala_m2', 'ano_construcao', 'ano_remodelacao',
      'certificado_energetico', 'ce_numero', 'ce_validade',
      'aquecimento', 'tem_ac', 'agua', 'paineis_solares',
      'caixilharia', 'vidros_duplos', 'orientacao', 'vista',
      'tem_condominio', 'condominio_mensal', 'condominio_inclui', 'imi_anual',
      'preco_actual', 'preco_inicial', 'renda_mensal',
      'titulo_anuncio', 'descricao_longa', 'destaques', 'publico_alvo',
      'link_externo', 'ref_idealista', 'ref_imovirtual', 'ref_casasapo', 'ref_kw',
      'notas_privadas', 'caracteristicas',
    ] as const;
    for (const k of keysToCopy) {
      const v = (draft as unknown as Record<string, unknown>)[k];
      if (v != null && v !== '') payload[k] = v;
    }

    const { data, error } = await supabase.from('imoveis').insert(payload).select('id').single();
    if (error || !data) {
      await clearBusy(supabase, org);
      await safeSend(supabase, org, token, chatId, `❌ Erro a gravar: ${escapeHtml(error?.message ?? '?')}`);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
    await supabase.from('organization_settings')
      .update({ telegram_active_imovel_id: data.id })
      .eq('organization_id', org.organization_id);

    // Auto-trigger: imovel novo pode bater com procuras existentes
    triggerMatchesAsync(org.organization_id);

    let fotosImportadas = 0;
    if (draft.link_externo && /^https?:\/\//.test(draft.link_externo)) {
      try {
        const urls = await fetchImagesFromUrl(draft.link_externo);
        if (urls.length > 0) {
          const r = await downloadAndUploadPhotos(supabase as never, org.organization_id, data.id, urls,
            { maxBytes: 8 * 1024 * 1024, maxCount: 20 });
          fotosImportadas = r.ok;
        }
      } catch {}
    }

    await clearBusy(supabase, org);
    const label = draft.referencia ?? draft.morada ?? 'sem referência';
    const url = `${APP_URL}/imoveis/${data.id}`;
    const summary = [draft.tipologia && `<b>${draft.tipologia}</b>`, draft.concelho || draft.freguesia,
      draft.preco_actual && `${formatPreco(draft.preco_actual)}€`].filter(Boolean).join(' · ');

    await safeSend(supabase, org, token, chatId,
      `✅ <b>Imóvel criado:</b> ${escapeHtml(label)}\n` +
      (summary ? `${summary}\n` : '') +
      (fotosImportadas > 0 ? `📸 ${fotosImportadas} fotos do link\n` : '') +
      `\n<a href="${url}">Abrir ↗</a>\n\n` +
      `<i>Próximas fotos vão para este imóvel. /menu para outra acção.</i>`);
    return NextResponse.json({ ok: true, imovel_id: data.id, modelUsed });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro';
    await clearBusy(supabase, org);
    await safeSend(supabase, org, token, chatId, `❌ Falhou: ${escapeHtml(msg).slice(0, 200)}`);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

async function handleListOrProcura(
  text: string,
  kind: 'list' | 'procura',
  supabase: ReturnType<typeof createStaticAdminClient>,
  org: OrgRow,
  token: string,
  chatId: string,
  keys: AIKeys,
) {
  await setBusy(supabase, org);
  await safeSend(supabase, org, token, chatId, kind === 'procura' ? '⏳ A registar procura...' : '⏳ A processar lista...');
  try {
    const { items, modelUsed } = await extractRawIntelList(text, keys);
    const { data: cancelCheck } = await supabase
      .from('organization_settings').select('telegram_cancel').eq('organization_id', org.organization_id).single();
    if (cancelCheck?.telegram_cancel) {
      await clearBusy(supabase, org);
      return NextResponse.json({ ok: true, cancelled: true });
    }

    if (items.length === 0) {
      await clearBusy(supabase, org);
      await safeSend(supabase, org, token, chatId, '🤷 Sem items detectados.');
      return NextResponse.json({ ok: true, items: 0 });
    }

    const rows = items.map((it) => ({
      organization_id: org.organization_id,
      source_kind: 'telegram',
      raw_text: it.raw_segment || text,
      intent: kind === 'procura' ? 'procura' : it.intent,
      ownership: it.ownership,
      confidence_overall: it.confidence_overall,
      property: it.property,
      contact: it.contact,
      status: 'novo',
      tags: it.tags ?? [],
      source_attribution: 'telegram_bot',
    }));

    const { data, error } = await supabase.from('raw_intel').insert(rows).select('id');
    if (error) {
      await clearBusy(supabase, org);
      await safeSend(supabase, org, token, chatId, `❌ Erro: ${escapeHtml(error.message).slice(0, 200)}`);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Auto-trigger: re-corre match engine se entrou alguma procura nova
    if (kind === 'procura' || items.some((it) => it.intent === 'procura')) {
      triggerMatchesAsync(org.organization_id);
    }

    const lines = items.slice(0, 8).map((it, idx) => {
      const tip = it.property.tipologia ?? '?';
      const zona = it.property.zona ?? it.property.freguesia ?? it.property.concelho ?? '';
      const preco = it.property.preco;
      const icon = it.intent === 'procura' ? '🔍' : '🏠';
      return `${idx + 1}. ${icon} <b>${tip}</b>${zona ? ' em ' + escapeHtml(String(zona)) : ''}${preco ? ' · ' + formatPreco(Number(preco)) + '€' : ''}`;
    });

    await clearBusy(supabase, org);
    await safeSend(supabase, org, token, chatId,
      `✅ <b>${items.length} item(s) em /matches</b>\n\n${lines.join('\n')}\n\n<a href="${APP_URL}/matches">Abrir ↗</a>\n<i>Modelo: ${modelUsed}</i>`);
    return NextResponse.json({ ok: true, items: data?.length ?? 0 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro';
    await clearBusy(supabase, org);
    await safeSend(supabase, org, token, chatId, `❌ Falhou: ${escapeHtml(msg).slice(0, 200)}`);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// --- Foto/document ---

async function handleTelegramPhoto(
  photos: TelegramPhotoSize[],
  token: string,
  chatId: string,
  supabase: ReturnType<typeof createStaticAdminClient>,
  org: OrgRow,
) {
  if (!org.telegram_active_imovel_id) {
    await sendTelegramMessage(token, chatId, 'ℹ️ Cria imóvel primeiro com texto/link. /menu');
    return NextResponse.json({ ok: true });
  }
  const biggest = photos[photos.length - 1];
  return await downloadAndAttach(biggest.file_id, undefined, 'image/jpeg', token, chatId, supabase, org);
}

async function handleTelegramDocument(
  doc: TelegramDocument,
  token: string,
  chatId: string,
  supabase: ReturnType<typeof createStaticAdminClient>,
  org: OrgRow,
) {
  if (!org.telegram_active_imovel_id) {
    await sendTelegramMessage(token, chatId, 'ℹ️ Cria imóvel primeiro. /menu');
    return NextResponse.json({ ok: true });
  }
  return await downloadAndAttach(doc.file_id, doc.file_name, doc.mime_type ?? 'image/jpeg', token, chatId, supabase, org);
}

async function downloadAndAttach(
  fileId: string,
  filename: string | undefined,
  mimeType: string,
  token: string,
  chatId: string,
  supabase: ReturnType<typeof createStaticAdminClient>,
  org: OrgRow,
) {
  const imovelId = org.telegram_active_imovel_id!;
  try {
    const infoRes = await fetch(`${TELEGRAM_API}/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`);
    const infoJson = await infoRes.json();
    if (!infoJson.ok) return NextResponse.json({ ok: false }, { status: 500 });
    const filePath = infoJson.result.file_path as string;
    const fileRes = await fetch(`${TELEGRAM_API}/file/bot${token}/${filePath}`);
    if (!fileRes.ok) return NextResponse.json({ ok: false }, { status: 500 });
    const buf = await fileRes.arrayBuffer();
    const safeName = (filename ?? `tg_${Date.now()}.jpg`).replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${org.organization_id}/${imovelId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;
    const { error: upErr } = await supabase.storage.from('imovel-fotos')
      .upload(storagePath, buf, { contentType: mimeType, upsert: false });
    if (upErr) return NextResponse.json({ ok: false }, { status: 500 });
    const { data: pub } = supabase.storage.from('imovel-fotos').getPublicUrl(storagePath);
    const { data: existing } = await supabase.from('imovel_fotos').select('ordem, is_principal').eq('imovel_id', imovelId);
    const maxOrdem = existing?.reduce((m, f) => Math.max(m, Number(f.ordem ?? 0)), -1) ?? -1;
    const hasPrincipal = existing?.some((f) => f.is_principal) ?? false;
    await supabase.from('imovel_fotos').insert({
      organization_id: org.organization_id, imovel_id: imovelId,
      storage_path: storagePath, url_publica: pub?.publicUrl ?? null,
      ordem: maxOrdem + 1, is_principal: !hasPrincipal, bytes: buf.byteLength, origem: 'telegram',
    });
    const { data: count } = await supabase.from('imovel_fotos').select('id').eq('imovel_id', imovelId);
    await sendTelegramMessage(token, chatId,
      `📸 Foto guardada (${count?.length ?? 1} total).\n<a href="${APP_URL}/imoveis/${imovelId}">Ver ↗</a>`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

function parseForcePrefix(text: string): { kind: Mode; text: string } | null {
  if (/^\/(meu|angariar|imovel)\b/i.test(text)) return { kind: 'single', text: text.replace(/^\/\S+\s*/, '').trim() };
  if (/^\/(off|match)\b/i.test(text)) return { kind: 'list', text: text.replace(/^\/\S+\s*/, '').trim() };
  if (/^\/procura\b/i.test(text)) return { kind: 'procura', text: text.replace(/^\/\S+\s*/, '').trim() };
  return null;
}

function formatPreco(v: number): string {
  return new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 }).format(v);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
