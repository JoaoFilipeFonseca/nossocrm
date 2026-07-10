/**
 * Brief 6 — Radar Maia. Normalização dos anúncios de cada portal → CanonListing.
 *
 * Idealista: o campo `contactInfo.professional` (boolean) distingue de forma
 * FIÁVEL agência (true) de particular (false). É a fonte de FSBO de alta confiança.
 *
 * OLX: não expõe tipo de anunciante de forma fiável (sellerType vem nulo). Usamos
 * uma heurística conservadora pelo nome do vendedor (blocklist de agências) e, no
 * orquestrador, despromovemos "promotores" (mesmo vendedor com vários anúncios).
 */
import { normalizePhoneE164 } from '@/lib/phone';
import type { AdvertiserType, CanonListing } from './types';

/* ---------- utilitários ---------- */

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'string' ? Number(v.replace(/[^\d.,-]/g, '').replace(',', '.')) : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Extrai a área em m2 de strings como "84 m²" / "123,40 m²" / "100.82". */
function parseArea(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/ /g, ' ');
  const m = s.match(/([\d.]+,\d+|\d[\d.]*)/);
  if (!m) return null;
  const n = Number(m[1].replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Título limpo de acentos/casing para "Cidade Da Maia" → "Cidade da Maia". */
function titleCaseFreguesia(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  const minor = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && minor.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

function tipologiaFromRooms(rooms: number | null): string | null {
  if (rooms === null || rooms < 0) return null;
  return `T${Math.round(rooms)}`;
}

/** T2 / T3+1 / T0 a partir de texto livre (título OLX). */
function tipologiaFromText(v: unknown): string | null {
  if (!v) return null;
  const m = String(v).match(/\bT\s?(\d)(\s?\+\s?\d)?\b/i);
  if (!m) return null;
  return `T${m[1]}${m[2] ? '+' + m[2].replace(/\D/g, '') : ''}`;
}

function toIsoDate(epochMs: unknown): string | null {
  const n = num(epochMs);
  if (!n) return null;
  // Idealista usa epoch em ms; se vier em segundos, ajustar.
  const ms = n > 1e12 ? n : n * 1000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/* ---------- Idealista ---------- */

interface IdealistaRaw {
  adid?: number;
  operation?: string;
  propertyType?: string;
  price?: number;
  basicInfo?: Record<string, unknown> & { propertyCode?: string; url?: string; municipality?: string };
  detailedType?: { typology?: string; subTypology?: string };
  priceInfo?: { amount?: number; currencySuffix?: string };
  moreCharacteristics?: { roomNumber?: number; bathNumber?: number; constructedArea?: number; usableArea?: number; plotOfLand?: number; modificationDate?: number };
  ubication?: { administrativeAreaLevel3?: string; administrativeAreaLevel2?: string; locationName?: string; latitude?: number; longitude?: number };
  contactInfo?: {
    professional?: boolean;
    userType?: string;
    commercialName?: string;
    contactName?: string;
    phone1?: { phoneNumber?: string; phoneNumberForMobileDialing?: string; formattedPhoneWithPrefix?: string; prefix?: string };
  };
  priceDropInfo?: { priceDropPercentage?: number };
  modificationDate?: { value?: number };
  link?: { url?: string };
}

function idealistaPropertyType(raw: IdealistaRaw): string | null {
  const typ = (raw.detailedType?.typology || '').toLowerCase();
  const sub = (raw.detailedType?.subTypology || '').toLowerCase();
  if (typ === 'flat' || typ === 'penthouse' || typ === 'duplex' || typ === 'studio') return 'apartamento';
  if (typ === 'chalet' || typ === 'house' || typ === 'countryhouse') return sub.includes('terraced') || sub.includes('semidetached') || sub.includes('independant') ? 'moradia' : 'moradia';
  if (typ === 'land' || typ === 'plot') return 'terreno';
  if (typ === 'premise' || typ === 'office') return typ === 'office' ? 'escritorio' : 'loja';
  if (typ === 'garage') return 'garagem';
  if (typ === 'storage') return 'armazem';
  if (typ === 'building') return 'predio';
  return null;
}

function idealistaPhone(raw: IdealistaRaw): string | null {
  const p = raw.contactInfo?.phone1;
  if (!p) return null;
  const cand = p.phoneNumberForMobileDialing || (p.prefix && p.phoneNumber ? `${p.prefix}${p.phoneNumber}` : p.phoneNumber) || p.formattedPhoneWithPrefix;
  if (!cand) return null;
  return normalizePhoneE164(cand, { defaultCountry: 'PT' }) || null;
}

export function normalizeIdealista(raw: IdealistaRaw): CanonListing | null {
  const externalId = raw.basicInfo?.propertyCode || (raw.adid != null ? String(raw.adid) : null);
  const url = raw.link?.url || (raw.basicInfo?.url as string | undefined) || (externalId ? `https://www.idealista.pt/imovel/${externalId}/` : null);
  if (!url) return null;

  const rooms = num(raw.moreCharacteristics?.roomNumber) ?? num((raw.basicInfo as { rooms?: number } | undefined)?.rooms);
  const propertyType = idealistaPropertyType(raw);
  const isLand = propertyType === 'terreno';
  const professional = raw.contactInfo?.professional;
  const advertiserType: AdvertiserType = professional === false ? 'particular' : professional === true ? 'agencia' : 'desconhecido';

  return {
    portal: 'idealista',
    externalId,
    url,
    title: (raw.basicInfo as { suggestedTexts?: { title?: string }; address?: string } | undefined)?.suggestedTexts?.title
      || (raw.basicInfo as { address?: string } | undefined)?.address
      || null,
    price: num(raw.priceInfo?.amount) ?? num(raw.price) ?? num((raw.basicInfo as { price?: number } | undefined)?.price),
    priceCurrency: raw.priceInfo?.currencySuffix === '€' || !raw.priceInfo?.currencySuffix ? 'EUR' : String(raw.priceInfo?.currencySuffix),
    tipologia: isLand ? null : tipologiaFromRooms(rooms),
    propertyType,
    operation: (raw.operation || (raw.basicInfo as { operation?: string } | undefined)?.operation) === 'rent' ? 'arrendamento' : 'venda',
    area: num(raw.moreCharacteristics?.constructedArea) ?? num(raw.moreCharacteristics?.usableArea) ?? num(raw.moreCharacteristics?.plotOfLand) ?? num((raw.basicInfo as { size?: number } | undefined)?.size),
    rooms: isLand ? null : rooms,
    bathrooms: num(raw.moreCharacteristics?.bathNumber) ?? num((raw.basicInfo as { bathrooms?: number } | undefined)?.bathrooms),
    freguesia: titleCaseFreguesia(raw.ubication?.administrativeAreaLevel3) || titleCaseFreguesia(raw.basicInfo?.municipality),
    concelho: 'Maia',
    advertiserType,
    advertiserName: raw.contactInfo?.commercialName || raw.contactInfo?.contactName || null,
    advertiserPhone: idealistaPhone(raw),
    latitude: num(raw.ubication?.latitude),
    longitude: num(raw.ubication?.longitude),
    publishedAt: toIsoDate(raw.modificationDate?.value) || toIsoDate(raw.moreCharacteristics?.modificationDate),
    portalPriceDropPct: num(raw.priceDropInfo?.priceDropPercentage),
    raw: {
      propertyCode: externalId,
      professional,
      priceDropPct: num(raw.priceDropInfo?.priceDropPercentage),
      modificationText: (raw.modificationDate as { text?: string } | undefined)?.text ?? null,
      status: (raw.basicInfo as { status?: string } | undefined)?.status ?? null,
    },
  };
}

/* ---------- OLX ---------- */

interface OlxRaw {
  id?: number;
  url?: string;
  title?: string;
  price?: number;
  previousPrice?: number;
  currency?: string;
  city?: string;
  district?: string;
  region?: string;
  lat?: number;
  lon?: number;
  sellerName?: string;
  sellerType?: string | null;
  createdAt?: string;
  params?: { tipologia?: string; area_util?: string; area_util_m2?: string; area_bruta?: string; casas_de_banho?: string; type?: string };
}

const AGENCY_NAME_RE = /\b(imobili|medi[aã]|imo[-\s]?|predial|invicta|remax|re\/max|keller|kw\b|century|era\b|iad\b|zome|domus|leilo|realt|realty|real\s|casas?\b|habita|properties|group|lda\.?|sociedade|invest|consult|home|houses?\b|boutique)/i;

function olxPropertyType(raw: OlxRaw): string | null {
  const t = (raw.params?.type || raw.title || '').toLowerCase();
  if (/morad|vivenda|casa\b/.test(t)) return 'moradia';
  if (/apartam|and[ar]|estúdio|estudio|t\d/.test(t)) return 'apartamento';
  if (/terreno|lote\b/.test(t)) return 'terreno';
  if (/loja\b|comerci/.test(t)) return 'loja';
  if (/armaz/.test(t)) return 'armazem';
  if (/garag/.test(t)) return 'garagem';
  if (/quinta/.test(t)) return 'quinta';
  return 'apartamento';
}

/** Classificação conservadora do OLX: agência se o nome bate na blocklist. */
export function classifyOlxSeller(sellerName: string | null | undefined): AdvertiserType {
  if (!sellerName) return 'desconhecido';
  if (AGENCY_NAME_RE.test(sellerName)) return 'agencia';
  // Nome pessoal simples (2+ palavras, sem dígitos) → provável particular.
  const clean = sellerName.trim();
  if (/\d/.test(clean)) return 'particular'; // ex.: "Paulo 964..." (telefone no nome) — é particular
  const words = clean.split(/\s+/);
  if (words.length >= 1 && words.length <= 4) return 'particular';
  return 'desconhecido';
}

export function normalizeOlx(raw: OlxRaw): CanonListing | null {
  const url = raw.url;
  if (!url) return null;
  const tip = raw.params?.tipologia || tipologiaFromText(raw.title);
  return {
    portal: 'olx',
    externalId: raw.id != null ? String(raw.id) : null,
    url,
    title: raw.title || null,
    price: num(raw.price),
    priceCurrency: raw.currency || 'EUR',
    tipologia: tip || null,
    propertyType: olxPropertyType(raw),
    operation: 'venda',
    area: parseArea(raw.params?.area_util) ?? parseArea(raw.params?.area_util_m2) ?? parseArea(raw.params?.area_bruta),
    rooms: tip ? Number((tip.match(/\d/) || [null])[0]) : null,
    bathrooms: num(raw.params?.casas_de_banho),
    freguesia: titleCaseFreguesia(raw.city) || titleCaseFreguesia(raw.district),
    concelho: 'Maia',
    advertiserType: classifyOlxSeller(raw.sellerName),
    advertiserName: raw.sellerName || null,
    advertiserPhone: null, // OLX não expõe telefone público
    latitude: num(raw.lat),
    longitude: num(raw.lon),
    publishedAt: raw.createdAt ? String(raw.createdAt).slice(0, 10) : null,
    portalPriceDropPct: raw.previousPrice && raw.price && raw.previousPrice > raw.price ? Math.round(((raw.previousPrice - raw.price) / raw.previousPrice) * 1000) / 10 : null,
    raw: {
      id: raw.id ?? null,
      sellerName: raw.sellerName ?? null,
      previousPrice: raw.previousPrice ?? null,
      createdAt: raw.createdAt ?? null,
    },
  };
}

/* ---------- dispatcher + hash ---------- */

export function normalizeByPortal(portal: string, raw: unknown): CanonListing | null {
  if (portal === 'idealista') return normalizeIdealista(raw as IdealistaRaw);
  if (portal === 'olx') return normalizeOlx(raw as OlxRaw);
  return null;
}

/** Chave de dedup determinística: portal + id (senão url). */
export function listingHash(l: CanonListing): string {
  return `${l.portal}:${l.externalId || l.url}`;
}

/** É da Maia? (defesa: alguns portais devolvem resultados vizinhos). */
const MAIA_FREGUESIAS = new Set(
  ['aguas santas', 'castelo da maia', 'cidade da maia', 'folgosa', 'milheiros', 'moreira', 'nogueira e silva escura', 'pedroucos', 'vila nova da telha', 'gemunde', 'gueifaes', 'vermoim', 'gondim', 'barca', 'avioso', 'maia'].map((s) => s),
);
function deaccent(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
export function isMaia(l: CanonListing): boolean {
  const f = l.freguesia ? deaccent(l.freguesia) : '';
  if (!f) return false;
  if (MAIA_FREGUESIAS.has(f)) return true;
  // aceita "x, maia"
  return /(^|[\s,])maia($|[\s,])/.test(f) || Array.from(MAIA_FREGUESIAS).some((m) => f.includes(m) && m !== 'maia');
}
