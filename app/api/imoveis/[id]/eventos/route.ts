import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const KINDS_VALIDOS = [
  'visita', 'oferta', 'proposta', 'contraproposta',
  'cpcv', 'escritura', 'mudanca_preco', 'fotos_atualizadas',
  'retirado', 'reactivado', 'avaliacao', 'nota',
];

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: imovelId } = await ctx.params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile?.organization_id) {
      return NextResponse.json({ message: 'Profile sem organização' }, { status: 404 });
    }

    const body = await request.json();
    if (!KINDS_VALIDOS.includes(body.kind)) {
      return NextResponse.json({ message: `kind inválido: ${body.kind}` }, { status: 400 });
    }

    const payload = {
      organization_id: profile.organization_id,
      imovel_id: imovelId,
      kind: body.kind,
      valor: body.valor != null && body.valor !== '' ? Number(body.valor) : null,
      descricao: typeof body.descricao === 'string' && body.descricao.trim() !== '' ? body.descricao.trim() : null,
      deal_id: body.deal_id ?? null,
      contact_id: body.contact_id ?? null,
      occurred_at: body.occurred_at ?? new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('imovel_eventos')
      .insert(payload)
      .select('id')
      .single();

    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
