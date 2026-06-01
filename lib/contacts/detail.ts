import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { normalizePhoneE164 } from '@/lib/phone';
import type { Contact, ContactCustomFields, MetaAdAttribution } from '@/types';

/**
 * Loaders server-side para a ficha de contacto (/contacts/[id]).
 * Usam o cliente SSR (cookies) — RLS por organização aplica-se automaticamente.
 */

interface DbContactRow {
  id: string;
  organization_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  client_company_id: string | null;
  avatar: string | null;
  notes: string | null;
  status: string | null;
  stage: string | null;
  source: string | null;
  birth_date: string | null;
  last_interaction: string | null;
  last_purchase_date: string | null;
  total_value: number | null;
  created_at: string;
  updated_at: string | null;
  ai_paused: boolean | null;
  attribution: Record<string, unknown> | null;
  custom_fields: Record<string, unknown> | null;
}

function mapContact(db: DbContactRow): Contact {
  return {
    id: db.id,
    organizationId: db.organization_id || undefined,
    name: db.name,
    email: db.email || '',
    phone: normalizePhoneE164(db.phone),
    role: db.role || '',
    clientCompanyId: db.client_company_id || undefined,
    companyId: db.client_company_id || '',
    avatar: db.avatar || '',
    notes: db.notes || '',
    status: (db.status as Contact['status']) || 'ACTIVE',
    stage: db.stage || '',
    source: (db.source as Contact['source']) || undefined,
    birthDate: db.birth_date || undefined,
    lastInteraction: db.last_interaction || undefined,
    lastPurchaseDate: db.last_purchase_date || undefined,
    totalValue: db.total_value || 0,
    createdAt: db.created_at,
    updatedAt: db.updated_at || undefined,
    aiPaused: db.ai_paused ?? false,
    attribution: (db.attribution as MetaAdAttribution) || null,
    customFields: (db.custom_fields as ContactCustomFields) || null,
  };
}

/** Uma indicação (referral): o "outro" contacto na relação. */
export interface ContactReferralLink {
  /** id da linha em contact_referrals (para apagar). */
  referralId: string;
  /** id do contacto do outro lado. */
  contactId: string;
  /** nome do contacto do outro lado. */
  name: string;
  note: string | null;
}

export interface ContactReferrals {
  /** Quem indicou este contacto. */
  referredBy: ContactReferralLink[];
  /** Contactos que este contacto indicou. */
  referred: ContactReferralLink[];
}

export async function getContactById(id: string): Promise<Contact | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error || !data) return null;
  return mapContact(data as DbContactRow);
}

export async function getContactReferrals(id: string): Promise<ContactReferrals> {
  const empty: ContactReferrals = { referredBy: [], referred: [] };
  const supabase = await createClient();

  // referredBy: linhas onde este contacto é o "referred"; junta o referrer.
  // referred: linhas onde este contacto é o "referrer"; junta o referred.
  const [byRes, refRes] = await Promise.all([
    supabase
      .from('contact_referrals')
      .select('id, note, referrer:referrer_contact_id ( id, name )')
      .eq('referred_contact_id', id),
    supabase
      .from('contact_referrals')
      .select('id, note, referred:referred_contact_id ( id, name )')
      .eq('referrer_contact_id', id),
  ]);

  // A junção pode vir como objecto ou array (consoante a inferência de tipos); normalizamos.
  const pickOne = (rel: unknown): { id: string; name: string } | null => {
    const v = Array.isArray(rel) ? rel[0] : rel;
    if (v && typeof v === 'object' && 'id' in v && 'name' in v) {
      return { id: String((v as { id: unknown }).id), name: String((v as { name: unknown }).name ?? '') };
    }
    return null;
  };

  if (!byRes.error && byRes.data) {
    for (const row of byRes.data as unknown as Array<{ id: string; note: string | null; referrer: unknown }>) {
      const other = pickOne(row.referrer);
      if (other) empty.referredBy.push({ referralId: row.id, contactId: other.id, name: other.name, note: row.note });
    }
  }
  if (!refRes.error && refRes.data) {
    for (const row of refRes.data as unknown as Array<{ id: string; note: string | null; referred: unknown }>) {
      const other = pickOne(row.referred);
      if (other) empty.referred.push({ referralId: row.id, contactId: other.id, name: other.name, note: row.note });
    }
  }
  return empty;
}

export interface ContactComment {
  id: string;
  body: string;
  createdAt: string;
  authorId: string | null;
  authorName: string;
}

export async function getContactComments(id: string): Promise<ContactComment[]> {
  const supabase = await createClient();
  // Nota: author_id é FK para auth.users (não profiles), por isso não dá para
  // fazer embed PostgREST; buscamos os nomes dos autores numa 2.ª query.
  const { data, error } = await supabase
    .from('contact_comments')
    .select('id, body, created_at, author_id')
    .eq('contact_id', id)
    .order('created_at', { ascending: false });
  if (error || !data) return [];

  const rows = data as Array<{ id: string; body: string; created_at: string; author_id: string | null }>;
  const authorIds = [...new Set(rows.map((r) => r.author_id).filter((x): x is string => !!x))];
  const names = new Map<string, string>();
  if (authorIds.length > 0) {
    const { data: profs } = await supabase.from('profiles').select('id, name').in('id', authorIds);
    for (const p of (profs ?? []) as Array<{ id: string; name: string | null }>) {
      if (p.name && p.name.trim()) names.set(p.id, p.name);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    createdAt: r.created_at,
    authorId: r.author_id,
    authorName: (r.author_id && names.get(r.author_id)) || 'Utilizador',
  }));
}

/** Conta negócios do contacto (para o resumo lateral). */
export async function getContactDealsSummary(id: string): Promise<{ count: number; openCount: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('deals')
    .select('id, is_won, is_lost')
    .eq('contact_id', id);
  if (error || !data) return { count: 0, openCount: 0 };
  const rows = data as Array<{ is_won: boolean | null; is_lost: boolean | null }>;
  const openCount = rows.filter((d) => !d.is_won && !d.is_lost).length;
  return { count: rows.length, openCount };
}

/** Última análise do Assistente 360 guardada (Fase 3). */
export interface LastContactAnalysis {
  result: unknown;
  createdAt: string;
}

export async function getLastContactAnalysis(id: string): Promise<LastContactAnalysis | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('contact_ai_analyses')
    .select('result, created_at')
    .eq('contact_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return { result: (data as { result: unknown }).result, createdAt: (data as { created_at: string }).created_at };
}

/**
 * Contexto 360 do contacto para o Assistente IA (CONTACT-360-AI Fase 1).
 * Junta tudo o que já temos numa só leitura: campos ricos, atribuição,
 * indicações, negócios, últimas actividades e comentários.
 */
export interface Contact360Context {
  contact: Contact;
  referrals: ContactReferrals;
  deals: { open: number; won: number; lost: number; recent: { title: string; value: number; state: string }[] };
  activities: { type: string; description: string | null; at: string }[];
  comments: { author: string; body: string; at: string }[];
}

export async function getContact360Context(id: string): Promise<Contact360Context | null> {
  const contact = await getContactById(id);
  if (!contact) return null;
  const supabase = await createClient();

  const [referrals, comments, dealsRes, actsRes] = await Promise.all([
    getContactReferrals(id),
    getContactComments(id),
    supabase
      .from('deals')
      .select('title, value, is_won, is_lost, created_at')
      .eq('contact_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('deal_activities')
      .select('type, description, created_at')
      .eq('contact_id', id)
      .order('created_at', { ascending: false })
      .limit(15),
  ]);

  const dealRows = (dealsRes.data ?? []) as Array<{ title: string | null; value: number | null; is_won: boolean | null; is_lost: boolean | null }>;
  const deals = {
    open: dealRows.filter((d) => !d.is_won && !d.is_lost).length,
    won: dealRows.filter((d) => d.is_won).length,
    lost: dealRows.filter((d) => d.is_lost).length,
    recent: dealRows.slice(0, 5).map((d) => ({
      title: d.title || 'Negócio',
      value: d.value || 0,
      state: d.is_won ? 'ganho' : d.is_lost ? 'perdido' : 'aberto',
    })),
  };

  const activities = ((actsRes.data ?? []) as Array<{ type: string; description: string | null; created_at: string }>)
    .map((a) => ({ type: a.type, description: a.description, at: a.created_at }));

  return {
    contact,
    referrals,
    deals,
    activities,
    comments: comments.map((c) => ({ author: c.authorName, body: c.body, at: c.createdAt })),
  };
}
