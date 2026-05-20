import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ESTADOS_VALIDOS = ['disponivel', 'reservado', 'vendido', 'retirado', 'em_avaliacao'];
const TIPOS_NEGOCIO_VALIDOS = ['venda', 'arrendamento', 'ambos'];

export async function POST(request: NextRequest) {
  try {
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

    const estado = body.estado ?? 'disponivel';
    const tipoNegocio = body.tipo_negocio ?? 'venda';
    if (!ESTADOS_VALIDOS.includes(estado)) {
      return NextResponse.json({ message: `estado inválido: ${estado}` }, { status: 400 });
    }
    if (!TIPOS_NEGOCIO_VALIDOS.includes(tipoNegocio)) {
      return NextResponse.json({ message: `tipo_negocio inválido: ${tipoNegocio}` }, { status: 400 });
    }

    const payload = {
      organization_id: profile.organization_id,
      referencia: emptyToNull(body.referencia),
      morada: emptyToNull(body.morada),
      freguesia: emptyToNull(body.freguesia),
      concelho: emptyToNull(body.concelho),
      distrito: emptyToNull(body.distrito),
      tipologia: emptyToNull(body.tipologia),
      area_util: toNumberOrNull(body.area_util),
      area_bruta: toNumberOrNull(body.area_bruta),
      ano_construcao: toNumberOrNull(body.ano_construcao),
      certificado_energetico: emptyToNull(body.certificado_energetico),
      preco_actual: toNumberOrNull(body.preco_actual),
      preco_inicial: toNumberOrNull(body.preco_inicial),
      preco_minimo_aceitavel: toNumberOrNull(body.preco_minimo_aceitavel),
      estado,
      tipo_negocio: tipoNegocio,
      link_externo: emptyToNull(body.link_externo),
      notas_privadas: emptyToNull(body.notas_privadas),
    };

    const { data, error } = await supabase
      .from('imoveis')
      .insert(payload)
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}

function emptyToNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
}

function toNumberOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
