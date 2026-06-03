// PREFS-1: gravar preferências do utilizador (página de arranque + tema) na conta.
// Sincroniza desktop+mobile (a conta é a fonte de verdade; o tema também fica em
// localStorage como cache rápida por dispositivo).
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Páginas de arranque permitidas (rotas reais existentes).
export const LANDING_PAGES = ['/dashboard', '/contacts', '/imoveis', '/anuncios', '/financeiro', '/automacoes'] as const;
const ALLOWED = new Set<string>(LANDING_PAGES);

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const patch: Record<string, unknown> = {};

    if ('landing_page' in body) {
      const lp = body.landing_page;
      if (lp === null || lp === '') patch.landing_page = null;
      else if (typeof lp === 'string' && ALLOWED.has(lp)) patch.landing_page = lp;
      else return NextResponse.json({ message: 'Página de arranque inválida' }, { status: 400 });
    }
    if ('dark_mode' in body) {
      patch.dark_mode = body.dark_mode === null ? null : !!body.dark_mode;
    }

    if (Object.keys(patch).length === 0) return NextResponse.json({ message: 'Nada a actualizar' }, { status: 400 });

    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ message: err instanceof Error ? err.message : 'Erro' }, { status: 500 });
  }
}
