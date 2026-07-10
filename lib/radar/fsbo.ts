/**
 * Brief 6 — Radar Maia. Pipeline FSBO.
 *
 * Cada anúncio NOVO de particular vira contacto + negócio no funil Proprietários,
 * etapa "Contactos" (holding, entra na cadência da Power List — reactivação D0),
 * com tags fsbo/radar-fsbo, proveniência radar-fsbo e a ficha do imóvel na nota.
 *
 * Dedup: contacto por telefone E.164; um único negócio FSBO aberto por contacto.
 * Só recebe os NOVOS (inserted) da ingestão, logo re-correr não duplica.
 */
import { createStaticAdminClient } from '@/lib/supabase/staticAdminClient';
import type { StoredListing } from './types';

type Admin = ReturnType<typeof createStaticAdminClient>;

const BOARD_PROPRIETARIOS = 'd08c7329-9e3e-43d1-ba42-6437a8363ae8';
const STAGE_CONTACTOS = '7887c70d-751c-49e1-bfcc-845515cfbbc1';

export interface CreatedFsbo {
  dealId: string;
  contactId: string;
  name: string;
  phone: string | null;
  freguesia: string | null;
  tipologia: string | null;
  price: number | null;
  url: string;
  reused: boolean; // contacto já existia
}

function tipoLabel(l: StoredListing): string {
  const t = l.tipologia || (l.property_type ? l.property_type : 'Imóvel');
  return l.property_type && l.tipologia ? `${l.property_type} ${l.tipologia}` : t;
}

function buildNota(l: StoredListing): string {
  const linhas = [
    `FSBO detectado no radar (${l.portal}).`,
    `Imóvel: ${tipoLabel(l)}${l.area ? `, ${l.area} m²` : ''}${l.freguesia ? `, ${l.freguesia}` : ''}.`,
    l.price != null ? `Pedido: ${l.price.toLocaleString('pt-PT')} €.` : null,
    l.days_on_market != null ? `Dias no mercado: ${l.days_on_market}.` : null,
    `Anúncio: ${l.url}`,
  ].filter(Boolean);
  return linhas.join('\n');
}

export async function createFsboFromListings(
  admin: Admin,
  orgId: string,
  listings: StoredListing[],
): Promise<CreatedFsbo[]> {
  // Regra do João (INEGOCIÁVEL): FSBO = proprietário com nome E TELEFONE. Sem telefone
  // não é lead (ver o anúncio não gera negócio) — fica só como dado de mercado em
  // market_listings, não vira contacto/negócio. Agências nunca (advertiser_type != particular).
  const particulars = listings.filter(
    (l) => l.advertiser_type === 'particular' && !!l.advertiser_phone && l.advertiser_phone.replace(/\D/g, '').length >= 9,
  );
  const created: CreatedFsbo[] = [];
  const nowIso = new Date().toISOString();

  for (const l of particulars) {
    const phone = l.advertiser_phone || null;
    const name = (l.advertiser_name && l.advertiser_name.trim()) || `Particular ${l.freguesia || 'Maia'}`;

    // 1) Dedup contacto por telefone.
    let contactId: string | null = null;
    let reused = false;
    if (phone) {
      const { data: existing } = await admin
        .from('contacts')
        .select('id')
        .eq('organization_id', orgId)
        .eq('phone', phone)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      contactId = (existing as { id?: string } | null)?.id ?? null;
      reused = !!contactId;
    }

    const attribution = {
      source: 'radar-fsbo',
      channel: 'radar',
      portal: l.portal,
      imovel: { url: l.url, preco: l.price, freguesia: l.freguesia, tipologia: l.tipologia, area: l.area },
      captured_at: nowIso,
      is_test: false,
    };

    if (!contactId) {
      const { data: ins, error: insErr } = await admin
        .from('contacts')
        .insert({
          organization_id: orgId,
          name,
          phone,
          source: 'radar-fsbo',
          notes: buildNota(l),
          attribution,
        })
        .select('id')
        .single();
      if (insErr || !ins) continue;
      contactId = (ins as { id: string }).id;
    }

    // 2) Um só negócio FSBO aberto por contacto.
    const { data: openDeal } = await admin
      .from('deals')
      .select('id, tags')
      .eq('organization_id', orgId)
      .eq('contact_id', contactId)
      .eq('status', 'open')
      .is('deleted_at', null)
      .contains('tags', ['fsbo'])
      .limit(1)
      .maybeSingle();

    if (openDeal) {
      // Já tem FSBO aberto — liga o anúncio ao negócio existente e segue.
      await admin
        .from('market_listings')
        .update({ fsbo_deal_id: (openDeal as { id: string }).id, fsbo_contact_id: contactId })
        .eq('id', l.id);
      continue;
    }

    const title = `${name} — ${tipoLabel(l)}${l.freguesia ? ` (${l.freguesia})` : ''} · FSBO`;
    const { data: dealIns, error: dealErr } = await admin
      .from('deals')
      .insert({
        organization_id: orgId,
        board_id: BOARD_PROPRIETARIOS,
        stage_id: STAGE_CONTACTOS,
        contact_id: contactId,
        title,
        status: 'open',
        value: l.price ?? 0,
        tags: ['fsbo', 'radar-fsbo'],
        attribution,
        custom_fields: {
          source_lead: 'radar-fsbo',
          portal: l.portal,
          imovel_url: l.url,
          imovel_preco: l.price,
          imovel_freguesia: l.freguesia,
          imovel_tipologia: l.tipologia,
          imovel_area: l.area,
          dias_no_mercado: l.days_on_market,
        },
      })
      .select('id')
      .single();
    if (dealErr || !dealIns) continue;
    const dealId = (dealIns as { id: string }).id;

    // 3) Liga o anúncio ao negócio + timeline (actor=automation).
    await admin
      .from('market_listings')
      .update({ fsbo_deal_id: dealId, fsbo_contact_id: contactId })
      .eq('id', l.id);

    await admin.from('deal_activities').insert({
      deal_id: dealId,
      organization_id: orgId,
      contact_id: contactId,
      actor: 'automation',
      type: 'note',
      description: buildNota(l),
      metadata: { source: 'radar-fsbo', portal: l.portal, listing_id: l.id, url: l.url },
    });

    created.push({
      dealId,
      contactId,
      name,
      phone,
      freguesia: l.freguesia,
      tipologia: l.tipologia,
      price: l.price,
      url: l.url,
      reused,
    });
  }

  return created;
}
