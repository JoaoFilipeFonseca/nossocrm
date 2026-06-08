// ============================================================================
// capi.ts — API de Conversões da Meta (servidor → Meta). MA-CAPI.
// ============================================================================
// Envia eventos que só o CRM sabe (negócio ganho, com valor) ao conjunto de
// dados "João Fonseca Online", para a Meta entregar a quem COMPRA e a atribuição
// sobreviver a bloqueadores/iOS. Portado do metaCapiEvent do portal, com:
//   - action_source "system_generated" (negócio ganho, sem browser),
//   - valor da conversão + moeda (comissão líquida, em EUR),
//   - event_id determinista (dedup com o lado do browser/repetições),
//   - dados pessoais SEMPRE com hash SHA-256 (privacidade — nunca em claro),
//   - token lido do Vault e INJECTADO (nunca exposto nem hardcoded).
// Helpers puros (buildCapiEvent) são testáveis; sendCapiEvents faz a rede.
// ============================================================================
import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { META_GRAPH_BASE, META_CAPI_DATASET_ID } from './config';

/** SHA-256 (hex) do valor normalizado (minúsculas + sem espaços nas pontas). */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

/** Telefone só com dígitos (mantém o indicativo). A Meta pede E.164 sem o "+". */
export function normalizePhone(phone: string): string {
  return phone.replace(/[\s+()\-]/g, '');
}

export type CapiEventName =
  | 'Lead'
  | 'Purchase'
  | 'Contact'
  | 'CompleteRegistration'
  | 'Schedule';

export type CapiActionSource =
  | 'system_generated'
  | 'website'
  | 'phone_call'
  | 'chat'
  | 'email'
  | 'physical_store'
  | 'other';

export interface BuildCapiEventInput {
  eventName: CapiEventName;
  /** epoch em segundos; por defeito "agora". */
  eventTime?: number;
  /** chave de deduplicação; por defeito um UUID. */
  eventId?: string;
  /** por defeito "system_generated" (negócio ganho no CRM). */
  actionSource?: CapiActionSource;
  eventSourceUrl?: string;
  email?: string | null;
  phone?: string | null;
  /** valor da conversão em euros (comissão líquida). */
  value?: number | null;
  /** moeda ISO; por defeito EUR. */
  currency?: string;
  customData?: Record<string, string | number>;
}

/**
 * Constrói um evento da API de Conversões. Puro e determinista quando se passam
 * eventTime/eventId. Omite campos vazios para o payload ficar mínimo.
 */
export function buildCapiEvent(input: BuildCapiEventInput): Record<string, unknown> {
  const userData: Record<string, unknown> = {};
  if (input.email && input.email.trim()) userData.em = [sha256Hex(input.email)];
  if (input.phone && input.phone.trim()) {
    const p = normalizePhone(input.phone);
    if (p) userData.ph = [sha256Hex(p)];
  }

  const event: Record<string, unknown> = {
    event_name: input.eventName,
    event_time: input.eventTime ?? Math.floor(Date.now() / 1000),
    event_id: input.eventId ?? randomUUID(),
    action_source: input.actionSource ?? 'system_generated',
    user_data: userData,
  };
  if (input.eventSourceUrl) event.event_source_url = input.eventSourceUrl;

  const custom: Record<string, string | number> = { ...(input.customData ?? {}) };
  if (input.value != null && Number.isFinite(input.value)) {
    custom.value = input.value;
    custom.currency = input.currency ?? 'EUR';
  }
  if (Object.keys(custom).length > 0) event.custom_data = custom;

  return event;
}

export interface SendCapiInput {
  token: string;
  /** por defeito META_CAPI_DATASET_ID. */
  datasetId?: string;
  events: Record<string, unknown>[];
  /** TEST… do separador "Testar eventos" — mantém os testes fora dos dados reais. */
  testEventCode?: string;
}

export interface SendCapiResult {
  ok: boolean;
  status: number;
  eventsReceived: number | null;
  fbtraceId: string | null;
  error: string | null;
  raw: unknown;
}

/** Envia eventos ao conjunto de dados. Nunca atira — devolve sempre o resultado. */
export async function sendCapiEvents(input: SendCapiInput): Promise<SendCapiResult> {
  const datasetId = input.datasetId ?? META_CAPI_DATASET_ID;
  const payload: Record<string, unknown> = { data: input.events, access_token: input.token };
  if (input.testEventCode) payload.test_event_code = input.testEventCode;

  try {
    const res = await fetch(`${META_GRAPH_BASE}/${datasetId}/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'FocoImoCRM/1.0' },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const evRecv = typeof json.events_received === 'number' ? json.events_received : null;
    const errObj = json.error as { message?: string; fbtrace_id?: string } | undefined;
    const err = errObj?.message ?? null;
    const trace = (json.fbtrace_id as string | undefined) ?? errObj?.fbtrace_id ?? null;
    return {
      ok: res.ok && !err,
      status: res.status,
      eventsReceived: evRecv,
      fbtraceId: trace,
      error: err,
      raw: json,
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      eventsReceived: null,
      fbtraceId: null,
      error: e instanceof Error ? e.message : 'Falha no pedido à API de Conversões.',
      raw: null,
    };
  }
}
