/**
 * /api/social-inbox/sync — SOCIAL-INBOX (MVP Messenger).
 *
 * Puxa as conversas de DMs do Facebook Messenger da Página via Graph API e faz upsert em
 * social_conversations / social_messages, marca as que precisam de resposta (a última
 * mensagem veio do contacto), liga ao contacto quando der, e envia um aviso Telegram dos
 * novos (dedup por alerted_at, respeitando a regra do silêncio).
 *
 * Modos: CRON (header X-Cron-Secret == backup_cron_secret) percorre todas as orgs; ou
 * ADMIN autenticado (corre só a própria org). Nunca devolve 5xx em erro lógico.
 *
 * Fatia 1: sem IA (o rascunho da IA entra na fatia 2). Instagram é fast-follow.
 */
import { NextRequest } from 'next/server';
import { createStaticAdminClient } from '@/lib/supabase/staticAdminClient';
import { createClient } from '@/lib/supabase/server';
import { getPageAccessToken } from '@/lib/integrations/meta/leadforms';
import { metaTokenSecretName, META_GRAPH_BASE } from '@/lib/integrations/meta/config';
import { sendTelegramMessage } from '@/lib/notifications/telegram';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const APP_URL = 'https://crm.joaofilipefonseca.pt';
type Admin = ReturnType<typeof createStaticAdminClient>;

interface GraphMessage {
  id?: string;
  message?: string;
  created_time?: string;
  from?: { id?: string; name?: string };
}
interface GraphConversation {
  id: string;
  updated_time?: string;
  message_count?: number;
  snippet?: string;
  participants?: { data?: Array<{ id?: string; name?: string }> };
  messages?: { data?: GraphMessage[] };
}

function isNoiseName(name: string | null): boolean {
  if (!name) return false;
  return /meta\s*man|^meta$/i.test(name.trim());
}

async function graphGet(path: string, token: string): Promise<Record<string, unknown>> {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${META_GRAPH_BASE}/${path}${sep}access_token=${encodeURIComponent(token)}`, {
    headers: { 'User-Agent': 'FocoImoCRM/1.0' },
  });
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    const err = (json.error as { message?: string } | undefined)?.message ?? `HTTP ${res.status}`;
    throw new Error(err);
  }
  return json;
}

async function syncOrg(
  admin: Admin,
  orgId: string,
  integrationId: string,
  metadata: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const pageId = (metadata.subscribed_page_id as string) ?? null;
  if (!pageId) return { org: orgId, skipped: 'sem página subscrita' };

  const tokenName = (metadata.token_secret_name as string) ?? metaTokenSecretName(integrationId);
  const { data: userToken } = await admin.rpc('meta_oauth_read_token', { p_name: tokenName });
  if (!userToken) return { org: orgId, skipped: 'sem token no Vault' };

  const pageToken = await getPageAccessToken(pageId, userToken as string);

  const data = await graphGet(
    `${pageId}/conversations?platform=messenger&fields=participants,updated_time,message_count,snippet,messages.limit(15){message,from,created_time,id}&limit=25`,
    pageToken,
  );
  const conversations = ((data.data as GraphConversation[]) ?? []).filter((c) => c?.id);

  let synced = 0;
  const newlyNeedsResponse: Array<{ name: string; convId: string; contactId: string | null }> = [];

  for (const conv of conversations) {
    try {
      const participant = (conv.participants?.data ?? []).find((p) => p.id && p.id !== pageId)
        ?? conv.participants?.data?.[0]
        ?? {};
      const participantName = participant.name ?? null;
      const participantId = participant.id ?? null;
      const noise = isNoiseName(participantName);

      const msgs = (conv.messages?.data ?? []).filter((m) => m && (m.message || m.id));
      const last = msgs[0]; // Graph devolve da mais recente para a mais antiga
      const lastFrom = last?.from?.id && last.from.id === pageId ? 'us' : 'them';
      const lastAt = last?.created_time ?? conv.updated_time ?? null;
      const snippet = (last?.message ?? conv.snippet ?? '').slice(0, 280);

      // Ligar ao contacto por nome (best-effort).
      let contactId: string | null = null;
      let dealId: string | null = null;
      if (participantName) {
        const { data: c } = await admin
          .from('contacts')
          .select('id')
          .eq('organization_id', orgId)
          .ilike('name', participantName)
          .limit(1)
          .maybeSingle();
        contactId = c?.id ?? null;
        if (contactId) {
          const { data: d } = await admin
            .from('deals')
            .select('id')
            .eq('organization_id', orgId)
            .eq('contact_id', contactId)
            .eq('is_won', false)
            .eq('is_lost', false)
            .limit(1)
            .maybeSingle();
          dealId = d?.id ?? null;
        }
      }

      // Estado existente (preservar status handled/ignored + alerted_at).
      const { data: existing } = await admin
        .from('social_conversations')
        .select('id, status, alerted_at')
        .eq('organization_id', orgId)
        .eq('platform', 'messenger')
        .eq('thread_id', conv.id)
        .maybeSingle();

      const status = existing?.status ?? 'open';
      const needsResponse = !noise && lastFrom === 'them' && status !== 'ignored' && status !== 'handled';

      const row = {
        organization_id: orgId,
        integration_id: integrationId,
        platform: 'messenger',
        thread_id: conv.id,
        participant_id: participantId,
        participant_name: participantName,
        last_message_at: lastAt,
        last_snippet: snippet,
        last_from: lastFrom,
        message_count: conv.message_count ?? msgs.length,
        needs_response: needsResponse,
        is_noise: noise,
        contact_id: contactId,
        deal_id: dealId,
        updated_at: new Date().toISOString(),
      };

      let convRowId = existing?.id ?? null;
      if (convRowId) {
        await admin.from('social_conversations').update(row).eq('id', convRowId);
      } else {
        const { data: ins } = await admin
          .from('social_conversations')
          .insert({ ...row, status: 'open' })
          .select('id')
          .single();
        convRowId = ins?.id ?? null;
      }
      if (!convRowId) continue;

      // Mensagens (idempotente por message_id).
      const msgRows = msgs
        .filter((m) => m.id)
        .map((m) => ({
          organization_id: orgId,
          conversation_id: convRowId,
          platform: 'messenger',
          message_id: m.id,
          from_side: m.from?.id && m.from.id === pageId ? 'us' : 'them',
          body: m.message ?? null,
          sent_at: m.created_time ?? null,
        }));
      if (msgRows.length > 0) {
        await admin.from('social_messages').upsert(msgRows, { onConflict: 'organization_id,message_id' });
      }

      // Candidato a aviso: precisa de resposta E (nunca avisado OU chegou msg nova depois do aviso).
      const alertedAt = existing?.alerted_at ? Date.parse(existing.alerted_at as string) : 0;
      const lastMs = lastAt ? Date.parse(lastAt) : 0;
      if (needsResponse && lastMs > alertedAt) {
        newlyNeedsResponse.push({ name: participantName ?? 'Contacto', convId: convRowId, contactId });
      }

      synced++;
    } catch {
      // conversa individual falhou — continua as outras
    }
  }

  // Aviso Telegram (1 digest, regra do silêncio).
  let alerted = 0;
  if (newlyNeedsResponse.length > 0) {
    const { data: settings } = await admin
      .from('organization_settings')
      .select('telegram_crm_bot_token, telegram_crm_chat_id')
      .eq('organization_id', orgId)
      .maybeSingle();
    const botToken = settings?.telegram_crm_bot_token as string | undefined;
    const chatId = settings?.telegram_crm_chat_id as string | undefined;
    if (botToken && chatId) {
      const lines = [
        `💬 <b>Caixa Social</b> — ${newlyNeedsResponse.length} ${newlyNeedsResponse.length === 1 ? 'mensagem nova a precisar de resposta' : 'mensagens novas a precisar de resposta'}`,
        '',
        ...newlyNeedsResponse.slice(0, 10).map((n) => `• ${n.name}`),
        '',
        `<a href="${APP_URL}/messaging?tab=social">Abrir a Caixa Social</a>`,
      ];
      try {
        await sendTelegramMessage(botToken, chatId, lines.join('\n'));
        const ids = newlyNeedsResponse.map((n) => n.convId);
        await admin
          .from('social_conversations')
          .update({ alerted_at: new Date().toISOString() })
          .in('id', ids);
        alerted = newlyNeedsResponse.length;
      } catch {
        /* aviso best-effort */
      }
    }
  }

  return { org: orgId, synced, alerted };
}

export async function POST(req: NextRequest) {
  const admin = createStaticAdminClient();
  const cronSecret = req.headers.get('X-Cron-Secret') ?? '';

  // ---- CRON ----
  if (cronSecret) {
    const { data: expected } = await admin.rpc('get_backup_cron_secret');
    if (!expected || cronSecret !== expected) {
      return Response.json({ error: 'forbidden' }, { status: 403 });
    }
    const { data: integ } = await admin
      .from('automation_integrations')
      .select('id, organization_id, metadata')
      .eq('provider', 'meta')
      .eq('status', 'active');
    const summary: unknown[] = [];
    for (const i of (integ ?? []) as Array<{ id: string; organization_id: string; metadata: Record<string, unknown> | null }>) {
      try {
        summary.push(await syncOrg(admin, i.organization_id, i.id, i.metadata ?? {}));
      } catch (e) {
        summary.push({ org: i.organization_id, error: e instanceof Error ? e.message : String(e) });
      }
    }
    return Response.json({ ok: true, summary });
  }

  // ---- ADMIN ----
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.role !== 'admin' || !profile.organization_id) {
    return Response.json({ error: 'Sem permissão.' }, { status: 403 });
  }
  const orgId = profile.organization_id as string;

  const { data: integ } = await admin
    .from('automation_integrations')
    .select('id, metadata')
    .eq('provider', 'meta')
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .maybeSingle();
  if (!integ) return Response.json({ ok: false, error: 'Integração Meta não activa.' }, { status: 200 });

  try {
    const summary = await syncOrg(admin, orgId, integ.id, integ.metadata ?? {});
    return Response.json({ ok: true, ...summary });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 200 });
  }
}
