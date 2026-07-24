// /api/search?q=... — Pesquisa global (Ctrl+K).
// Contactos, negócios e imóveis num só lookup, via RPC global_search (unaccent,
// org-scoped por RLS). Devolve no máximo 8 por grupo.
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';

export interface SearchContact {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
}
export interface SearchDeal {
  id: string;
  title: string | null;
  value: number | null;
  contact_name: string | null;
}
export interface SearchImovel {
  id: string;
  referencia: string | null;
  morada: string | null;
  tipologia: string | null;
  concelho: string | null;
}
export interface SearchResults {
  contacts: SearchContact[];
  deals: SearchDeal[];
  imoveis: SearchImovel[];
}

const EMPTY: SearchResults = { contacts: [], deals: [], imoveis: [] };

export async function GET(request: NextRequest) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const q = (request.nextUrl.searchParams.get('q') ?? '').trim();
  if (q.length < 2) return NextResponse.json(EMPTY);

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase.rpc('global_search', { p_q: q });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = (data ?? EMPTY) as SearchResults;
  return NextResponse.json({
    contacts: results.contacts ?? [],
    deals: results.deals ?? [],
    imoveis: results.imoveis ?? [],
  });
}
