/**
 * Brief 6 — Radar Maia. Ingestão de anúncios normalizados em market_listings.
 *
 * Dedup por (organization_id, listing_hash). Novos → insert (first_seen=agora).
 * Já vistos → update last_seen; se o preço mudou, regista a redução (sinal) e
 * empurra o histórico. Idempotente: re-correr com os mesmos dados não duplica.
 */
import { createStaticAdminClient } from '@/lib/supabase/staticAdminClient';
import type { CanonListing, IngestSummary, PriceDropSignal, StoredListing } from './types';
import { listingHash } from './normalize';

type Admin = ReturnType<typeof createStaticAdminClient>;

interface ExistingRow {
  id: string;
  listing_hash: string;
  price: number | null;
  price_history: Array<{ price: number; at: string }> | null;
  first_seen: string;
  advertiser_type: string;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function daysBetween(fromIso: string | null, to: Date): number | null {
  if (!fromIso) return null;
  const from = new Date(fromIso);
  if (Number.isNaN(from.getTime())) return null;
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000));
}

export async function ingestListings(
  admin: Admin,
  orgId: string,
  listings: CanonListing[],
): Promise<IngestSummary> {
  const now = new Date();
  const nowIso = now.toISOString();

  // Dedup dentro do lote (mantém o último visto de cada hash).
  const byHash = new Map<string, CanonListing>();
  for (const l of listings) byHash.set(listingHash(l), l);
  const hashes = Array.from(byHash.keys());

  const summary: IngestSummary = { seen: hashes.length, inserted: 0, updated: 0, priceDrops: [], newListings: [] };
  if (hashes.length === 0) return summary;

  // Carrega existentes (em blocos, por causa do limite do .in()).
  const existing = new Map<string, ExistingRow>();
  for (const part of chunk(hashes, 200)) {
    const { data } = await admin
      .from('market_listings')
      .select('id, listing_hash, price, price_history, first_seen, advertiser_type')
      .eq('organization_id', orgId)
      .in('listing_hash', part);
    for (const r of (data ?? []) as ExistingRow[]) existing.set(r.listing_hash, r);
  }

  const toInsert: Record<string, unknown>[] = [];
  const touchOnly: string[] = [];

  for (const [hash, l] of byHash) {
    const prev = existing.get(hash);
    const publishedAt = l.publishedAt;
    const daysOnMarket = daysBetween(publishedAt, now);

    if (!prev) {
      toInsert.push({
        organization_id: orgId,
        portal: l.portal,
        external_id: l.externalId,
        url: l.url,
        listing_hash: hash,
        title: l.title,
        price: l.price,
        price_currency: l.priceCurrency,
        tipologia: l.tipologia,
        property_type: l.propertyType,
        operation: l.operation,
        area: l.area,
        rooms: l.rooms,
        bathrooms: l.bathrooms,
        freguesia: l.freguesia,
        concelho: l.concelho,
        advertiser_type: l.advertiserType,
        advertiser_name: l.advertiserName,
        advertiser_phone: l.advertiserPhone,
        latitude: l.latitude,
        longitude: l.longitude,
        published_at: publishedAt,
        first_seen: nowIso,
        last_seen: nowIso,
        days_on_market: daysOnMarket,
        status: 'active',
        last_price: null,
        price_drop_pct: l.portalPriceDropPct,
        price_history: l.price != null ? [{ price: l.price, at: nowIso }] : [],
        raw: l.raw,
      });
      continue;
    }

    // Já existe: detectar mudança de preço.
    const priceChanged = l.price != null && prev.price != null && l.price !== prev.price;
    if (priceChanged) {
      const dropPct = Math.round(((prev.price! - l.price!) / prev.price!) * 1000) / 10;
      const history = Array.isArray(prev.price_history) ? prev.price_history.slice(-19) : [];
      history.push({ price: l.price!, at: nowIso });
      await admin
        .from('market_listings')
        .update({
          price: l.price,
          last_price: prev.price,
          price_drop_pct: dropPct,
          price_history: history,
          last_seen: nowIso,
          days_on_market: daysOnMarket,
          status: 'active',
          advertiser_type: l.advertiserType !== 'desconhecido' ? l.advertiserType : prev.advertiser_type,
          advertiser_phone: l.advertiserPhone,
        })
        .eq('id', prev.id);
      if (dropPct > 0) {
        summary.priceDrops.push({
          id: prev.id,
          portal: l.portal,
          url: l.url,
          freguesia: l.freguesia,
          tipologia: l.tipologia,
          advertiserType: (l.advertiserType !== 'desconhecido' ? l.advertiserType : prev.advertiser_type) as PriceDropSignal['advertiserType'],
          oldPrice: prev.price!,
          newPrice: l.price!,
          dropPct,
        });
      }
      summary.updated += 1;
    } else {
      touchOnly.push(hash);
    }
  }

  // Insere novos (em blocos) e recolhe as linhas criadas para FSBO/digest.
  for (const part of chunk(toInsert, 100)) {
    const { data, error } = await admin
      .from('market_listings')
      .insert(part)
      .select('id, portal, external_id, url, title, price, tipologia, property_type, area, freguesia, concelho, advertiser_type, advertiser_name, advertiser_phone, published_at, first_seen, days_on_market');
    if (error) {
      // best-effort: não rebenta a corrida por um bloco
      continue;
    }
    for (const r of (data ?? []) as StoredListing[]) summary.newListings.push(r);
    summary.inserted += (data ?? []).length;
  }

  // Toca last_seen dos que continuam activos sem mudança (em blocos).
  for (const part of chunk(touchOnly, 200)) {
    await admin
      .from('market_listings')
      .update({ last_seen: nowIso, status: 'active' })
      .eq('organization_id', orgId)
      .in('listing_hash', part);
  }

  return summary;
}
