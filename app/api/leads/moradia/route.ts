import { NextResponse } from 'next/server';
import { createStaticAdminClient } from '@/lib/supabase/server';
import { normalizePhoneE164 } from '@/lib/phone';

export const runtime = 'nodejs';

/**
 * Recepção de leads da landing "Moradia Paços de Ferreira" (site estático no
 * domínio joaofilipefonseca.pt). Segue o mesmo padrão da recepção de leads do
 * Meta Ads (edge automation-meta-leads): dedup de contacto por telefone/email,
 * cria contacto se novo e abre um negócio no funil Proprietários, etapa Contactos.
 *
 * Regras respeitadas:
 * - contacto != lead: o negócio nasce aqui porque o formulário É um pedido
 *   explícito (dossier + visita), com proveniência obrigatória.
 * - nunca devolve 5xx em erro lógico (a landing usa keepalive fire-and-forget).
 * - multi-tenant: org configurável por env, com fallback para a org do João.
 */

const ORG_ID =
  process.env.MORADIA_LEAD_ORG_ID || '29455d22-ebbf-4996-ac46-a071cb4363bf';
// Funil Proprietários (a etapa "Contactos" = order 0 é resolvida em runtime).
const BOARD_PROPRIETARIOS = 'd08c7329-9e3e-43d1-ba42-6437a8363ae8';
const SOURCE = 'landing-moradia-pacos-ferreira';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: corsHeaders });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return json({ ok: false, error: 'corpo invalido' }, 400);
    }

    const nome = String((body as Record<string, unknown>).nome ?? '').trim();
    const email =
      String((body as Record<string, unknown>).email ?? '')
        .trim()
        .toLowerCase() || null;
    const phone = normalizePhoneE164(
      String((body as Record<string, unknown>).telefone ?? ''),
      { defaultCountry: 'PT' }
    ) || null;
    const horizonte = String(
      (body as Record<string, unknown>).horizonte ?? ''
    ).trim();
    const mensagem = String(
      (body as Record<string, unknown>).mensagem ?? ''
    ).trim();
    const url = String((body as Record<string, unknown>).url ?? '').trim();

    // Validacao minima: nome + pelo menos um contacto.
    if (!nome || (!email && !phone)) {
      return json(
        { ok: false, error: 'nome e telefone (ou email) sao obrigatorios' },
        400
      );
    }

    const sb = createStaticAdminClient();

    const attribution = {
      source: SOURCE,
      imovel: 'Moradia T6 Pacos de Ferreira',
      horizonte: horizonte || null,
      landing_url: url || null,
      captured_at: new Date().toISOString(),
    };

    const notasLinhas = [
      'Lead da landing Moradia Paços de Ferreira.',
      horizonte ? `Horizonte: ${horizonte}` : null,
      mensagem ? `Mensagem: ${mensagem}` : null,
    ].filter(Boolean);
    const notes = notasLinhas.join('\n');

    // 1) Dedup de contacto por email OU telefone (E.164), dentro da org.
    let contactId: string | null = null;
    if (email || phone) {
      const orFilters: string[] = [];
      if (email) orFilters.push(`email.eq.${email}`);
      if (phone) orFilters.push(`phone.eq.${phone}`);
      const { data: existing } = await sb
        .from('contacts')
        .select('id')
        .eq('organization_id', ORG_ID)
        .or(orFilters.join(','))
        .is('deleted_at', null)
        .order('created_at')
        .limit(1)
        .maybeSingle();
      contactId = existing?.id ?? null;
    }

    // 2) Criar contacto se nao existe; senao backfill de atribuicao.
    if (!contactId) {
      const { data: novo, error: contactErr } = await sb
        .from('contacts')
        .insert({
          organization_id: ORG_ID,
          name: nome,
          email,
          phone,
          source: SOURCE,
          notes,
          attribution,
        })
        .select('id')
        .single();
      if (contactErr || !novo) {
        // Nunca 5xx: comunica o erro com 200 para a landing nao entrar em retry.
        return json({ ok: false, error: 'falha ao gravar contacto' }, 200);
      }
      contactId = novo.id;
    } else {
      await sb
        .from('contacts')
        .update({ attribution })
        .eq('id', contactId)
        .is('attribution', null);
    }

    // 3) Resolver a etapa "Contactos" (order 0) do funil Proprietários.
    const { data: stage } = await sb
      .from('board_stages')
      .select('id')
      .eq('board_id', BOARD_PROPRIETARIOS)
      .order('order', { ascending: true })
      .limit(1)
      .maybeSingle();
    const stageId = stage?.id ?? null;

    // 4) Criar o negocio (nao duplica se ja existir um aberto para o contacto).
    let dealCreated = false;
    if (stageId) {
      const { data: abertos } = await sb
        .from('deals')
        .select('id')
        .eq('organization_id', ORG_ID)
        .eq('contact_id', contactId)
        .eq('status', 'open')
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle();

      if (!abertos) {
        const { error: dealErr } = await sb.from('deals').insert({
          organization_id: ORG_ID,
          board_id: BOARD_PROPRIETARIOS,
          stage_id: stageId,
          contact_id: contactId,
          title: `${nome} - Moradia Paços de Ferreira`,
          status: 'open',
          value: 0,
          attribution,
        });
        dealCreated = !dealErr;
      }
    }

    return json({ ok: true, contact_id: contactId, deal_created: dealCreated }, 201);
  } catch {
    // Salvaguarda final: nunca 5xx.
    return json({ ok: false, error: 'erro inesperado' }, 200);
  }
}
