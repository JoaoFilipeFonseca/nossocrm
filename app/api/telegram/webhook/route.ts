import { NextRequest, NextResponse } from 'next/server';
import { createStaticAdminClient } from '@/lib/supabase/server';
import { sendTelegramMessage } from '@/lib/notifications/telegram';
import { extractImovelFromInput, extractRawIntelList } from '@/lib/imoveis/captar';
import { fetchImagesFromUrl, downloadAndUploadPhotos } from '@/lib/imoveis/fotos-from-url';
import type { AIKeys } from '@/lib/ai/router';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://crm-joao.vercel.app';

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; type: string };
    from?: { id: number; first_name?: string };
    text?: string;
    caption?: string;
    date: number;
  };
}

/**
 * Heurística simples: a mensagem parece partilha de vários imóveis?
 * - 2+ blocos numerados (1️⃣ 2️⃣ 3️⃣) ou enumeração 1., 2., 3.
 * - 2+ ocorrências de "€" ou preços
 * - 2+ tipologias (T1, T2, T3...)
 * - Palavras-chave de partilha entre colegas (off-market, partilho, oportunidades)
 */
function looksLikeList(text: string): boolean {
  const numberedEmojis = (text.match(/[1-9]️⃣/g) ?? []).length;
  if (numberedEmojis >= 2) return true;

  const numberedDots = (text.match(/(?:^|\n)\s*[1-9]\s*[.\)\-]/g) ?? []).length;
  if (numberedDots >= 2) return true;

  const priceMatches = (text.match(/\d{2,3}\.?\d{3}\s*€/g) ?? []).length
    + (text.match(/\d{2,3}\s*\.?\s*000\s*€?/g) ?? []).length;
  const tipMatches = (text.match(/\bT[0-5]\+?\b/g) ?? []).length;

  if (priceMatches >= 2 && tipMatches >= 2) return true;

  const lower = text.toLowerCase();
  if (/(off.?market|partilho|partilha|oportunidades|tem clientes|colegas)/.test(lower) && (priceMatches >= 2 || tipMatches >= 2)) {
    return true;
  }

  return false;
}

export async function POST(request: NextRequest) {
  const secretHeader = request.headers.get('x-telegram-bot-api-secret-token');
  if (!secretHeader) {
    return NextResponse.json({ ok: false, error: 'Missing secret header' }, { status: 401 });
  }

  let body: TelegramUpdate;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const message = body.message;
  if (!message || !message.chat?.id) {
    return NextResponse.json({ ok: true, ignored: 'no message' });
  }

  const chatId = String(message.chat.id);
  const supabase = createStaticAdminClient();

  const { data: org } = await supabase
    .from('organization_settings')
    .select('organization_id, telegram_crm_bot_token, telegram_crm_webhook_secret, ai_google_key, ai_anthropic_key')
    .eq('telegram_crm_chat_id', chatId)
    .maybeSingle();

  if (!org) {
    return NextResponse.json({ ok: true, ignored: 'unknown chat_id' });
  }

  if (org.telegram_crm_webhook_secret && org.telegram_crm_webhook_secret !== secretHeader) {
    return NextResponse.json({ ok: false, error: 'Invalid secret' }, { status: 401 });
  }

  const token = org.telegram_crm_bot_token as string | null;
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Bot token missing' }, { status: 500 });
  }

  const text = (message.text ?? message.caption ?? '').trim();

  if (!text) {
    await sendTelegramMessage(token, chatId,
      '🤖 Recebi a tua mensagem mas ainda só consigo processar <b>texto</b>. Foto/áudio/PDF chegam em breve.');
    return NextResponse.json({ ok: true, processed: 'no text' });
  }

  if (text.startsWith('/start') || text === '/help' || text === '/ajuda') {
    await sendTelegramMessage(
      token,
      chatId,
      '👋 <b>Foco Imo — Captura por Telegram</b>\n\n' +
      '• Manda detalhes de <b>1 imóvel</b> → crio rascunho em <i>/imoveis</i> (em avaliação).\n' +
      '• Manda <b>lista de imóveis off-market / partilhas de colegas</b> → vai para <i>/matches</i> (raw_intel) para cruzar com clientes.\n\n' +
      'Eu detecto automaticamente.',
    );
    return NextResponse.json({ ok: true, processed: 'help' });
  }

  const keys: AIKeys = {
    google: org.ai_google_key ?? undefined,
    anthropic: org.ai_anthropic_key ?? undefined,
  };

  if (!keys.google && !keys.anthropic) {
    await sendTelegramMessage(token, chatId,
      '❌ Sem chave de IA configurada na organização. Vai a /settings/ai e configura primeiro.');
    return NextResponse.json({ ok: false, error: 'No AI keys' }, { status: 400 });
  }

  // Detect list vs single
  const isList = looksLikeList(text);

  await sendTelegramMessage(token, chatId, isList ? '⏳ A processar lista…' : '⏳ A processar…');

  if (isList) {
    return await handleList(text, supabase, org, token, chatId, keys);
  }
  return await handleSingle(text, supabase, org, token, chatId, keys);
}

async function handleSingle(
  text: string,
  supabase: ReturnType<typeof createStaticAdminClient>,
  org: { organization_id: string },
  token: string,
  chatId: string,
  keys: AIKeys,
) {
  try {
    const { draft, modelUsed } = await extractImovelFromInput({ kind: 'text', payload: text }, keys);

    const payload: Record<string, unknown> = {
      organization_id: org.organization_id,
      estado: 'em_avaliacao',
      tipo: draft.tipo ?? 'apartamento',
      tipo_negocio: draft.tipo_negocio ?? 'venda',
    };
    const keysToCopy: Array<keyof typeof draft> = [
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
    ];
    for (const k of keysToCopy) {
      const v = draft[k];
      if (v != null && v !== '') payload[k] = v;
    }

    const { data, error } = await supabase
      .from('imoveis').insert(payload).select('id').single();
    if (error || !data) {
      await sendTelegramMessage(token, chatId, `❌ Erro a gravar imóvel: ${error?.message ?? 'desconhecido'}`);
      return NextResponse.json({ ok: false, error: error?.message }, { status: 500 });
    }

    // Importar fotos automaticamente do link, se houver
    let fotosImportadas = 0;
    if (draft.link_externo && /^https?:\/\//.test(draft.link_externo)) {
      try {
        const urls = await fetchImagesFromUrl(draft.link_externo);
        if (urls.length > 0) {
          const r = await downloadAndUploadPhotos(
            supabase as never,
            org.organization_id,
            data.id,
            urls,
            { maxBytes: 8 * 1024 * 1024, maxCount: 20 },
          );
          fotosImportadas = r.ok;
        }
      } catch (err) {
        console.warn('[telegram] auto-import fotos falhou:', err);
      }
    }

    const label = draft.referencia ?? draft.morada ?? 'sem referência';
    const url = `${APP_URL}/imoveis/${data.id}`;
    const summary = [
      draft.tipologia && `<b>${draft.tipologia}</b>`,
      draft.concelho || draft.freguesia,
      draft.preco_actual && `${formatPreco(draft.preco_actual)}€`,
    ].filter(Boolean).join(' · ');

    await sendTelegramMessage(
      token, chatId,
      `✅ <b>Rascunho criado:</b> ${escapeHtml(label)}\n` +
      (summary ? `${summary}\n` : '') +
      (fotosImportadas > 0 ? `📸 ${fotosImportadas} fotos importadas do link\n` : '') +
      `\n<a href="${url}">Abrir no CRM ↗</a>\n\n` +
      `<i>Estado: Em avaliação. Confirma os dados e muda para Disponível quando ok.</i>\n` +
      `<i>Modelo: ${modelUsed}</i>`,
    );
    return NextResponse.json({ ok: true, imovel_id: data.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    try {
      await sendTelegramMessage(token, chatId, `❌ Falhou a extracção: ${escapeHtml(msg)}`);
    } catch {}
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

async function handleList(
  text: string,
  supabase: ReturnType<typeof createStaticAdminClient>,
  org: { organization_id: string },
  token: string,
  chatId: string,
  keys: AIKeys,
) {
  try {
    const { items, modelUsed } = await extractRawIntelList(text, keys);

    if (items.length === 0) {
      await sendTelegramMessage(token, chatId,
        '🤷 Não consegui detectar imóveis nesta lista. Tenta reformular ou envia 1 por mensagem.');
      return NextResponse.json({ ok: true, items: 0 });
    }

    const rows = items.map((it) => ({
      organization_id: org.organization_id,
      source_kind: 'telegram',
      raw_text: it.raw_segment || text,
      intent: it.intent,
      ownership: it.ownership,
      confidence_overall: it.confidence_overall,
      property: it.property,
      contact: it.contact,
      status: 'novo',
      tags: it.tags ?? [],
      source_attribution: 'telegram_bot',
    }));

    const { data, error } = await supabase
      .from('raw_intel').insert(rows).select('id, intent, property');
    if (error) {
      await sendTelegramMessage(token, chatId, `❌ Erro a gravar lista: ${error.message}`);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const lines = items.slice(0, 8).map((it, idx) => {
      const tip = it.property.tipologia ?? '?';
      const zona = it.property.zona ?? it.property.freguesia ?? it.property.concelho ?? '';
      const preco = it.property.preco;
      const intent = it.intent === 'procura' ? '🔍' : it.intent === 'angariacao' ? '🏠' : '·';
      return `${idx + 1}. ${intent} <b>${tip}</b>${zona ? ' em ' + escapeHtml(String(zona)) : ''}${preco ? ' · ' + formatPreco(Number(preco)) + '€' : ''}`;
    });

    await sendTelegramMessage(
      token, chatId,
      `✅ <b>${items.length} item(s) registado(s) em /matches</b>\n\n` +
      lines.join('\n') +
      `\n\n<a href="${APP_URL}/matches">Abrir matches no CRM ↗</a>\n\n` +
      `<i>Origem: telegram · Modelo: ${modelUsed}</i>`,
    );
    return NextResponse.json({ ok: true, items: data?.length ?? 0 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro';
    try {
      await sendTelegramMessage(token, chatId, `❌ Falhou a extracção da lista: ${escapeHtml(msg)}`);
    } catch {}
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

function formatPreco(v: number): string {
  return new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 }).format(v);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
