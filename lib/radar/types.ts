/**
 * Brief 6 — Radar Maia. Tipos canónicos partilhados.
 *
 * Um `CanonListing` é a forma normalizada de um anúncio, independente do portal
 * de origem. É o que a ingestão grava em `market_listings`.
 */

export type AdvertiserType = 'particular' | 'agencia' | 'desconhecido';

export interface CanonListing {
  portal: string; // idealista | imovirtual | olx
  externalId: string | null; // id do anúncio no portal
  url: string;
  title: string | null;
  price: number | null;
  priceCurrency: string; // EUR
  tipologia: string | null; // T0..T6
  propertyType: string | null; // apartamento|moradia|terreno|loja|armazem|predio|garagem|escritorio|quinta|outro
  operation: string; // venda|arrendamento
  area: number | null; // m2
  rooms: number | null;
  bathrooms: number | null;
  freguesia: string | null;
  concelho: string; // Maia
  advertiserType: AdvertiserType;
  advertiserName: string | null;
  advertiserPhone: string | null; // E.164 quando disponível
  latitude: number | null;
  longitude: number | null;
  publishedAt: string | null; // ISO date (yyyy-mm-dd)
  portalPriceDropPct: number | null; // redução comunicada pelo portal (informativa)
  raw: unknown;
}

/** Resultado da ingestão de um lote em market_listings. */
export interface IngestSummary {
  seen: number; // total de anúncios normalizados
  inserted: number; // novos (first_seen = agora)
  updated: number; // já existiam (last_seen actualizado)
  priceDrops: PriceDropSignal[]; // reduções detectadas por nós (preço mudou entre corridas)
  newListings: StoredListing[]; // os inserted (para FSBO + digest)
}

export interface PriceDropSignal {
  id: string;
  portal: string;
  url: string;
  freguesia: string | null;
  tipologia: string | null;
  advertiserType: AdvertiserType;
  oldPrice: number;
  newPrice: number;
  dropPct: number; // positivo = desceu
}

/** Linha de market_listings tal como fica na BD (subconjunto usado a jusante). */
export interface StoredListing {
  id: string;
  portal: string;
  external_id: string | null;
  url: string;
  title: string | null;
  price: number | null;
  tipologia: string | null;
  property_type: string | null;
  area: number | null;
  freguesia: string | null;
  concelho: string;
  advertiser_type: AdvertiserType;
  advertiser_name: string | null;
  advertiser_phone: string | null;
  published_at: string | null;
  first_seen: string;
  days_on_market: number | null;
}
