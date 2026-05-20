import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ESTADOS_VALIDOS = ['disponivel', 'reservado', 'vendido', 'retirado', 'em_avaliacao'];
const TIPOS_NEGOCIO_VALIDOS = ['venda', 'arrendamento', 'ambos'];
const PATCH_FIELDS = new Set([
  'referencia', 'morada', 'freguesia', 'concelho', 'distrito', 'tipologia',
  'area_util', 'area_bruta', 'ano_construcao', 'certificado_energetico',
  'preco_actual', 'preco_inicial', 'preco_minimo_aceitavel',
  'estado', 'tipo_negocio', 'link_externo', 'notas_privadas',
]);
const NUMERIC_FIELDS = new Set([
  'area_util', 'area_bruta', 'ano_construcao',
  'preco_actual', 'preco_inicial', 'preco_minimo_aceitavel',
]);

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const patch: Record<string, unknown> = {};

    for (const key of Object.keys(body)) {
      if (!PATCH_FIELDS.has(key)) continue;
      const value = body[key];
      if (NUMERIC_FIELDS.has(key)) {
        patch[key] = value == null || value === '' ? null : Number(value);
      } else {
        patch[key] = typeof value === 'string' && value.trim() === '' ? null : value;
      }
    }

    if (patch.estado != null && !ESTADOS_VALIDOS.includes(patch.estado as string)) {
      return NextResponse.json({ message: `estado inválido: ${patch.estado}` }, { status: 400 });
    }
    if (patch.tipo_negocio != null && !TIPOS_NEGOCIO_VALIDOS.includes(patch.tipo_negocio as string)) {
      return NextResponse.json({ message: `tipo_negocio inválido: ${patch.tipo_negocio}` }, { status: 400 });
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ message: 'Nada para actualizar' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('imoveis')
      .update(patch)
      .eq('id', id)
      .select('id')
      .single();

    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ message: 'Imóvel não encontrado' }, { status: 404 });

    return NextResponse.json({ id: data.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase.from('imoveis').delete().eq('id', id);
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
