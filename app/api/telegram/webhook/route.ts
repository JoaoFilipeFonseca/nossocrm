import { NextRequest, NextResponse } from 'next/server';
import { createStaticAdminClient } from '@/lib/supabase/server';
import { sendTelegramMessage } from '@/lib/notifications/telegram';
import { extractImovelFromInput, extractRawIntelList, classifyTelegramMessage } from '@/lib/imoveis/captar';
import { fetchImagesFromUrl, downloadAndUploadPhotos } from '@/lib/imoveis/fotos-from-url';
import type { AIKeys } from '@/lib/ai/router';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://crm-joao.vercel.app';
const PENDING_TTL_MS = 10 * 60 * 1000;

interface TelegramPhotoSize { file_id: string; file_unique_id: string; width: number; height: number; file_size?: number; }
interface TelegramDocument { file_id: string; file_unique_id: string; file_name?: string; mime_type?: string; file_size?: number; }
interface TelegramAudio { file_id: string; file_unique_id: string; mime_type?: string; file_size?: number; duration?: number; }
interface TelegramVoice { file_id: string; file_unique_id: string; mime_type?: string; file_size?: number; duration?: number; }

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
    audio?: TelegramAudio;
    voice?: TelegramVoice;
    date: number;
  };
}

interface PendingAction {
  type: 'classify';
  text: string;
  suggested_kind: 'single' | 'list' | 'procura';
  summary: string;
  created_at: string;
}

interface OrgRow {
  organization_id: string;
  telegram_crm_bot_token: string | null;
  telegram_crm_webhook_secret: string | null;
  telegram_active_imovel_id: string | null;
  telegram_pending_action: PendingAction | null;
  ai_google_key: string | null;
  ai_anthropic_key: string | null;
}

export async function POST(request: NextRequest) {
  const secretHeader = request.headers.get('x-telegram-bot-api-secret-token');
  if (!secretHeader) return NextResponse.json({ ok: false, error: 'Missing secret' }, { status: 401 });

  let body: TelegramUpdate;
  try { body = await request.json(); }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }); }

  const message = body.message;
  if (!message || !message.chat?.id) return NextResponse.json({ ok: true, ignored: 'no message' });

  const chatId = String(message.chat.id);
  const supabase = createStaticAdminClient();

  const { data: orgRaw } = await supabase
    .from('organization_settings')
    .select('organization_id, telegram_crm_bot_token, telegram_crm_webhook_secret, telegram_active_imovel_id, telegram_pending_action, ai_google_key, ai_anthropic_key')
    .eq('telegram_crm_chat_id', chatId)
    .maybeSingle();

  if (!orgRaw) return NextResponse.json({ ok: true, ignored: 'unknown chat_id' });
  const org = orgRaw as OrgRow;

  if (org.telegram_crm_webhook_secret && org.telegram_crm_webhook_secret !== secretHeader) {
    return NextResponse.json({ ok: false, error: 'Invalid secret' }, { status: 401 });
  }
  const token = org.telegram_crm_bot_token;
  if (!token) return NextResponse.json({ ok: false, error: 'Bot token missing' }, { status: 500 });

  const text = (message.text ?? message.caption ?? '').trim();

  // Foto / documento imagem
  if (message.photo && message.photo.length > 0) {
    return await handleTelegramPhoto(message.photo, token, chatId, supabase, org);
  }
  if (message.document && message.document.mime_type?.startsWith('image/')) {
    return await handleTelegramDocument(message.document, token, chatId, supabase, org);
  }

  if (!text) {
    await sendTelegramMessage(token, chatId, '🤖 Manda texto, foto, ou link.');
    return NextResponse.json({ ok: true, processed: 'no content' });
  }

  // Comandos rápidos
  const lower = text.toLowerCase();
  if (text.startsWith('/start') || lower === '/help' || lower === '/ajuda') {
    await sendTelegramMessage(token, chatId, helpMessage());
    return NextResponse.json({ ok: true, processed: 'help' });
  }
  if (lower === '/activo' || lower === '/ativo') {
    if (org.telegram_active_imovel_id) {
      const { data: imv } = await supabase
        .from('imoveis').select('referencia, morada, titulo_anuncio').eq('id', org.telegram_active_imovel_id).maybeSingle();
      const label = imv?.referencia ?? imv?.morada ?? imv?.titulo_anuncio ?? 'sem nome';
      await sendTelegramMessage(token, chatId,
        `📌 Imóvel activo: <b>${escapeHtml(String(label))}</b>\n<a href="${APP_URL}/imoveis/${org.telegram_active_imovel_id}">Abrir ↗</a>`);
    } else {
      await sendTelegramMessage(token, chatId, 'Sem imóvel activo. Manda descrição ou link para criar um.');
    }
    return NextResponse.json({ ok: true });
  }
  if (lower === '/limpar' || lower === '/novo') {
    await supabase.from('organization_settings').update({ telegram_active_imovel_id: null, telegram_pending_action: null })
      .eq('organization_id', org.organization_id);
    await sendTelegramMessage(token, chatId, '🧹 Limpo. Próxima mensagem cria imóvel novo.');
    return NextResponse.json({ ok: true });
  }
  if (lower === '/cancelar') {
    if (org.telegram_pending_action) {
      await supabase.from('organization_settings').update({ telegram_pending_action: null })
        .eq('organization_id', org.organization_id);
      await sendTelegramMessage(token, chatId, '❌ Pendência cancelada.');
    } else {
      await sendTelegramMessage(token, chatId, 'Nada pendente.');
    }
    return NextResponse.json({ ok: true });
  }

  const keys: AIKeys = { google: org.ai_google_key ?? undefined, anthropic: org.ai_anthropic_key ?? undefined };
  if (!keys.google && !keys.anthropic) {
    await sendTelegramMessage(token, chatId, '❌ Sem chave de IA. Configura em /settings/ai.');
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Pendência: o João está a responder a uma pergunta anterior?
  if (org.telegram_pending_action && isPendingValid(org.telegram_pending_action)) {
    return await handlePendingResponse(text, org.telegram_pending_action, token, chatId, supabase, org, keys);
  }

  // Comandos de prefixo forçado
  const forced = parseForcePrefix(text);
  if (forced) {
    return await processWithKind(forced.text, forced.kind, token, chatId, supabase, org, keys);
  }

  // Classificação IA
  await sendTelegramMessage(token, chatId, '⏳ A analisar…');
  const cls = await classifyTelegramMessage(text, keys);

  if (cls.kind === 'irrelevante' || cls.kind === 'command') {
    await sendTelegramMessage(token, chatId,
      `🤔 Não percebi o que queres fazer.\n\n<i>"${escapeHtml(cls.summary)}"</i>\n\n` +
      `Usa um prefixo:\n• <code>/meu</code> + texto → criar como imóvel teu\n• <code>/off</code> + texto → guardar em /matches\n• <code>/procura</code> + texto → registar procura de cliente\n\nOu manda link directo do anúncio.`);
    return NextResponse.json({ ok: true, classified: cls.kind });
  }

  // Confidence alta → processa directamente
  if (cls.confidence >= 75) {
    return await processWithKind(text, cls.kind, token, chatId, supabase, org, keys);
  }

  // Confidence baixa → pergunta antes de fazer
  const suggested = (cls.kind === 'list' || cls.kind === 'procura') ? cls.kind : 'single';
  const pending: PendingAction = {
    type: 'classify',
    text,
    suggested_kind: suggested,
    summary: cls.summary,
    created_at: new Date().toISOString(),
  };
  await supabase.from('organization_settings').update({ telegram_pending_action: pending })
    .eq('organization_id', org.organization_id);

  await sendTelegramMessage(token, chatId,
    `🤔 Não tenho a certeza. Detectei: <b>${labelKind(suggested)}</b> (${cls.confidence}% de confiança)\n` +
    `<i>${escapeHtml(cls.summary)}</i>\n\n` +
    `Confirma com <code>sim</code> · ou diz <code>não, é ${suggested === 'single' ? 'lista' : 'imóvel meu'}</code> · ou <code>/cancelar</code>`);
  return NextResponse.json({ ok: true, pending: true });
}

function parseForcePrefix(text: string): { kind: 'single' | 'list' | 'procura'; text: string } | null {
  if (/^\/meu\b/i.test(text)) return { kind: 'single', text: text.replace(/^\/meu\b\s*/i, '').trim() };
  if (/^\/angariar\b/i.test(text)) return { kind: 'single', text: text.replace(/^\/angariar\b\s*/i, '').trim() };
  if (/^\/imovel\b/i.test(text)) return { kind: 'single', text: text.replace(/^\/imovel\b\s*/i, '').trim() };
  if (/^\/off\b/i.test(text)) return { kind: 'list', text: text.replace(/^\/off\b\s*/i, '').trim() };
  if (/^\/match\b/i.test(text)) return { kind: 'list', text: text.replace(/^\/match\b\s*/i, '').trim() };
  if (/^\/procura\b/i.test(text)) return { kind: 'procura', text: text.replace(/^\/procura\b\s*/i, '').trim() };
  return null;
}

function labelKind(k: 'single' | 'list' | 'procura'): string {
  if (k === 'single') return 'imóvel teu (criar em /imoveis)';
  if (k === 'list') return 'partilha de colega/off-market (criar em /matches)';
  return 'procura de cliente (criar em /matches)';
}

function isPendingValid(p: PendingAction): boolean {
  return Date.now() - new Date(p.created_at).getTime() < PENDING_TTL_MS;
}

async function handlePendingResponse(
  text: string,
  pending: PendingAction,
  token: string,
  chatId: string,
  supabase: ReturnType<typeof createStaticAdminClient>,
  org: OrgRow,
  keys: AIKeys,
) {
  const lower = text.toLowerCase().trim();

  // Limpar pendência primeiro
  await supabase.from('organization_settings').update({ telegram_pending_action: null })
    .eq('organization_id', org.organization_id);

  // Confirmação afirmativa
  if (/^(sim|ok|avan[çc]a|confirma|sim, ok|isso|yes)$/i.test(lower)) {
    return await processWithKind(pending.text, pending.suggested_kind, token, chatId, supabase, org, keys);
  }

  // Override explícito
  if (/n[aã]o[,\s]+\s*(é|e)?\s*lista/i.test(lower) || /^(é|e)\s+lista/i.test(lower)) {
    return await processWithKind(pending.text, 'list', token, chatId, supabase, org, keys);
  }
  if (/n[aã]o[,\s]+\s*(é|e)?\s*(im[oó]vel|meu|angaria)/i.test(lower) || /^(é|e)\s+(meu|im[oó]vel)/i.test(lower)) {
    return await processWithKind(pending.text, 'single', token, chatId, supabase, org, keys);
  }
  if (/n[aã]o[,\s]+\s*(é|e)?\s*procura/i.test(lower)) {
    return await processWithKind(pending.text, 'procura', token, chatId, supabase, org, keys);
  }
  if (/^(n[aã]o|cancelar)$/i.test(lower)) {
    await sendTelegramMessage(token, chatId, '❌ Cancelado.');
    return NextResponse.json({ ok: true });
  }

  // Não percebi a resposta — tratar texto novo como mensagem normal (chamada recursiva implícita)
  await sendTelegramMessage(token, chatId, '🔄 Resposta ambígua. Pendência limpa, a tratar nova mensagem…');
  // Re-classify
  const cls = await classifyTelegramMessage(text, keys);
  if (cls.confidence >= 60 && (cls.kind === 'single' || cls.kind === 'list' || cls.kind === 'procura')) {
    return await processWithKind(text, cls.kind, token, chatId, supabase, org, keys);
  }
  await sendTelegramMessage(token, chatId, 'Tenta com prefixo <code>/meu</code>, <code>/off</code> ou <code>/procura</code>.');
  return NextResponse.json({ ok: true });
}

async function processWithKind(
  text: string,
  kind: 'single' | 'list' | 'procura',
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
  await sendTelegramMessage(token, chatId, '⏳ A criar imóvel…');
  try {
    const { draft, modelUsed } = await extractImovelFromInput({ kind: 'text', payload: text }, keys);

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
      await sendTelegramMessage(token, chatId, `❌ Erro a gravar imóvel: ${error?.message ?? 'desconhecido'}`);
      return NextResponse.json({ ok: false, error: error?.message }, { status: 500 });
    }

    await supabase.from('organization_settings')
      .update({ telegram_active_imovel_id: data.id })
      .eq('organization_id', org.organization_id);

    let fotosImportadas = 0;
    if (draft.link_externo && /^https?:\/\//.test(draft.link_externo)) {
      try {
        const urls = await fetchImagesFromUrl(draft.link_externo);
        if (urls.length > 0) {
          const r = await downloadAndUploadPhotos(
            supabase as never, org.organization_id, data.id, urls,
            { maxBytes: 8 * 1024 * 1024, maxCount: 20 },
          );
          fotosImportadas = r.ok;
        }
      } catch (err) { console.warn('[telegram] auto-import fotos falhou:', err); }
    }

    const label = draft.referencia ?? draft.morada ?? 'sem referência';
    const url = `${APP_URL}/imoveis/${data.id}`;
    const summary = [
      draft.tipologia && `<b>${draft.tipologia}</b>`,
      draft.concelho || draft.freguesia,
      draft.preco_actual && `${formatPreco(draft.preco_actual)}€`,
    ].filter(Boolean).join(' · ');

    await sendTelegramMessage(token, chatId,
      `✅ <b>Imóvel criado:</b> ${escapeHtml(label)}\n` +
      (summary ? `${summary}\n` : '') +
      (fotosImportadas > 0 ? `📸 ${fotosImportadas} fotos importadas do link\n` : '') +
      `\n<a href="${url}">Abrir no CRM ↗</a>\n\n` +
      `<i>Estado: Em avaliação. Próximas fotos que mandares vão para este imóvel (activo).</i>`);
    return NextResponse.json({ ok: true, imovel_id: data.id, modelUsed });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro';
    try { await sendTelegramMessage(token, chatId, `❌ Falhou: ${escapeHtml(msg)}`); } catch {}
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
  await sendTelegramMessage(token, chatId, kind === 'procura' ? '⏳ A registar procura…' : '⏳ A processar lista…');
  try {
    const { items, modelUsed } = await extractRawIntelList(text, keys);
    if (items.length === 0) {
      await sendTelegramMessage(token, chatId, '🤷 Não consegui detectar items.');
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

    const { data, error } = await supabase.from('raw_intel').insert(rows).select('id, intent, property');
    if (error) {
      await sendTelegramMessage(token, chatId, `❌ Erro a gravar: ${error.message}`);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const lines = items.slice(0, 8).map((it, idx) => {
      const tip = it.property.tipologia ?? '?';
      const zona = it.property.zona ?? it.property.freguesia ?? it.property.concelho ?? '';
      const preco = it.property.preco;
      const intent = it.intent === 'procura' ? '🔍' : '🏠';
      return `${idx + 1}. ${intent} <b>${tip}</b>${zona ? ' em ' + escapeHtml(String(zona)) : ''}${preco ? ' · ' + formatPreco(Number(preco)) + '€' : ''}`;
    });

    await sendTelegramMessage(token, chatId,
      `✅ <b>${items.length} item(s) em /matches</b>\n\n` +
      lines.join('\n') +
      `\n\n<a href="${APP_URL}/matches">Abrir matches ↗</a>\n<i>Modelo: ${modelUsed}</i>`);
    return NextResponse.json({ ok: true, items: data?.length ?? 0 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro';
    try { await sendTelegramMessage(token, chatId, `❌ Falhou: ${escapeHtml(msg)}`); } catch {}
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

async function handleTelegramPhoto(
  photos: TelegramPhotoSize[],
  token: string,
  chatId: string,
  supabase: ReturnType<typeof createStaticAdminClient>,
  org: OrgRow,
) {
  if (!org.telegram_active_imovel_id) {
    await sendTelegramMessage(token, chatId,
      'ℹ️ Recebi foto mas não tenho imóvel activo. Cria primeiro com descrição/link.');
    return NextResponse.json({ ok: true, ignored: 'no active' });
  }
  const biggest = photos[photos.length - 1];
  return await downloadAndAttachToImovel(
    biggest.file_id, undefined, 'image/jpeg', token, chatId, supabase, org.organization_id, org.telegram_active_imovel_id,
  );
}

async function handleTelegramDocument(
  doc: TelegramDocument,
  token: string,
  chatId: string,
  supabase: ReturnType<typeof createStaticAdminClient>,
  org: OrgRow,
) {
  if (!org.telegram_active_imovel_id) {
    await sendTelegramMessage(token, chatId,
      'ℹ️ Documento recebido mas não há imóvel activo. Cria primeiro.');
    return NextResponse.json({ ok: true, ignored: 'no active' });
  }
  return await downloadAndAttachToImovel(
    doc.file_id, doc.file_name, doc.mime_type ?? 'image/jpeg', token, chatId, supabase, org.organization_id, org.telegram_active_imovel_id,
  );
}

async function downloadAndAttachToImovel(
  fileId: string,
  filename: string | undefined,
  mimeType: string,
  token: string,
  chatId: string,
  supabase: ReturnType<typeof createStaticAdminClient>,
  organizationId: string,
  imovelId: string,
) {
  try {
    const infoRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`);
    const infoJson = await infoRes.json();
    if (!infoJson.ok) {
      await sendTelegramMessage(token, chatId, `❌ Não consegui obter: ${infoJson.description ?? 'erro'}`);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
    const filePath = infoJson.result.file_path as string;
    const fileSize = (infoJson.result.file_size as number | undefined) ?? 0;
    if (fileSize > 20 * 1024 * 1024) {
      await sendTelegramMessage(token, chatId, '❌ Ficheiro > 20MB.');
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const fileRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
    if (!fileRes.ok) {
      await sendTelegramMessage(token, chatId, `❌ Download falhou (HTTP ${fileRes.status}).`);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
    const buf = await fileRes.arrayBuffer();
    const safeName = (filename ?? `telegram_${Date.now()}.jpg`).replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${organizationId}/${imovelId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;

    const { error: upErr } = await supabase.storage
      .from('imovel-fotos').upload(storagePath, buf, { contentType: mimeType, upsert: false });
    if (upErr) {
      await sendTelegramMessage(token, chatId, `❌ Erro storage: ${upErr.message}`);
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    const { data: pub } = supabase.storage.from('imovel-fotos').getPublicUrl(storagePath);
    const { data: existing } = await supabase
      .from('imovel_fotos').select('ordem, is_principal').eq('imovel_id', imovelId);
    const maxOrdem = existing?.reduce((m, f) => Math.max(m, Number(f.ordem ?? 0)), -1) ?? -1;
    const hasPrincipal = existing?.some((f) => f.is_principal) ?? false;

    const { error: insErr } = await supabase.from('imovel_fotos').insert({
      organization_id: organizationId, imovel_id: imovelId,
      storage_path: storagePath, url_publica: pub?.publicUrl ?? null,
      ordem: maxOrdem + 1, is_principal: !hasPrincipal,
      bytes: buf.byteLength, origem: 'telegram',
    });
    if (insErr) {
      await sendTelegramMessage(token, chatId, `❌ Erro registar: ${insErr.message}`);
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    const { data: count } = await supabase.from('imovel_fotos').select('id').eq('imovel_id', imovelId);
    const total = count?.length ?? 1;
    await sendTelegramMessage(token, chatId,
      `📸 Foto adicionada (${total} no total).\n<a href="${APP_URL}/imoveis/${imovelId}">Ver ↗</a>`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro';
    try { await sendTelegramMessage(token, chatId, `❌ ${escapeHtml(msg)}`); } catch {}
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

function helpMessage(): string {
  return '👋 <b>Foco Imo CRM bot</b>\n\n' +
    'Detecto automaticamente o que mandares:\n' +
    '• <b>1 imóvel descrito / link de anúncio</b> → cria em /imoveis (com fotos do link)\n' +
    '• <b>Lista off-market ou partilhas</b> → vai para /matches\n' +
    '• <b>Procura de cliente</b> → vai para /matches como procura\n' +
    '• <b>Foto</b> → adiciona ao imóvel activo\n\n' +
    'Se a confiança for baixa, pergunto antes de fazer.\n\n' +
    '<b>Comandos:</b>\n' +
    '<code>/meu</code> texto — forçar criar como imóvel teu\n' +
    '<code>/off</code> texto — forçar guardar em /matches\n' +
    '<code>/procura</code> texto — forçar procura cliente\n' +
    '<code>/activo</code> — ver imóvel activo\n' +
    '<code>/novo</code> ou <code>/limpar</code> — esquecer imóvel activo\n' +
    '<code>/cancelar</code> — limpar pendência';
}

function formatPreco(v: number): string {
  return new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 }).format(v);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
