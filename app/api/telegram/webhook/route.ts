import { NextRequest, NextResponse } from 'next/server';
import { createStaticAdminClient } from '@/lib/supabase/server';
import { sendTelegramMessage } from '@/lib/notifications/telegram';
import { extractImovelFromInput } from '@/lib/imoveis/captar';
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
    .select('organization_id, telegram_bot_token, telegram_webhook_secret, ai_google_key, ai_anthropic_key')
    .eq('telegram_chat_id', chatId)
    .maybeSingle();

  if (!org) {
    return NextResponse.json({ ok: true, ignored: 'unknown chat_id' });
  }

  if (org.telegram_webhook_secret && org.telegram_webhook_secret !== secretHeader) {
    return NextResponse.json({ ok: false, error: 'Invalid secret' }, { status: 401 });
  }

  const token = org.telegram_bot_token as string | null;
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
      'Manda-me uma mensagem com detalhes de um imóvel (texto solto serve) e eu crio um rascunho no CRM.\n\n' +
      'Exemplo:\n<i>"T2 Boavista, Rua Sá da Bandeira, 85m², 280k, ano 2010, cert. B"</i>\n\n' +
      'A IA extrai os campos e cria o imóvel em estado <b>"Em avaliação"</b> para tu confirmares.',
    );
    return NextResponse.json({ ok: true, processed: 'help' });
  }

  await sendTelegramMessage(token, chatId, '⏳ A processar...');

  const keys: AIKeys = {
    google: org.ai_google_key ?? undefined,
    anthropic: org.ai_anthropic_key ?? undefined,
  };

  if (!keys.google && !keys.anthropic) {
    await sendTelegramMessage(token, chatId,
      '❌ Sem chave de IA configurada na organização. Vai a /settings/ai e configura primeiro.');
    return NextResponse.json({ ok: false, error: 'No AI keys' }, { status: 400 });
  }

  try {
    const { draft, modelUsed } = await extractImovelFromInput({ kind: 'text', payload: text }, keys);

    const payload = {
      organization_id: org.organization_id,
      referencia: draft.referencia,
      morada: draft.morada,
      freguesia: draft.freguesia,
      concelho: draft.concelho,
      distrito: draft.distrito,
      tipologia: draft.tipologia,
      area_util: draft.area_util,
      area_bruta: draft.area_bruta,
      ano_construcao: draft.ano_construcao,
      certificado_energetico: draft.certificado_energetico,
      preco_actual: draft.preco_actual,
      preco_inicial: draft.preco_inicial,
      estado: 'em_avaliacao',
      tipo_negocio: draft.tipo_negocio ?? 'venda',
      link_externo: draft.link_externo,
      notas_privadas: draft.notas_privadas,
    };

    const { data, error } = await supabase
      .from('imoveis')
      .insert(payload)
      .select('id')
      .single();

    if (error || !data) {
      await sendTelegramMessage(token, chatId, `❌ Erro a gravar imóvel: ${error?.message ?? 'desconhecido'}`);
      return NextResponse.json({ ok: false, error: error?.message }, { status: 500 });
    }

    const label = draft.referencia ?? draft.morada ?? 'sem referência';
    const url = `${APP_URL}/imoveis/${data.id}`;
    const summary = [
      draft.tipologia && `<b>${draft.tipologia}</b>`,
      draft.concelho || draft.freguesia,
      draft.preco_actual && `${formatPreco(draft.preco_actual)}€`,
    ].filter(Boolean).join(' · ');

    await sendTelegramMessage(
      token,
      chatId,
      `✅ <b>Rascunho criado:</b> ${escapeHtml(label)}\n` +
      (summary ? `${summary}\n` : '') +
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

function formatPreco(v: number): string {
  return new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 }).format(v);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
