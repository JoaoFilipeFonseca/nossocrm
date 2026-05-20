import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const ESTADOS = ['disponivel', 'reservado', 'vendido', 'retirado', 'em_avaliacao'];
const NEGOCIOS = ['venda', 'arrendamento', 'ambos', 'trespasse', 'permuta'];
const TIPOS = ['apartamento', 'moradia', 'terreno', 'predio', 'loja', 'armazem', 'escritorio', 'garagem', 'quinta'];

const TEXT_FIELDS = [
  'referencia', 'tipo', 'subtipo', 'estado', 'estado_conservacao', 'tipo_negocio',
  'morada', 'numero_policia', 'codigo_postal', 'freguesia', 'concelho', 'distrito',
  'tipologia', 'cozinha_tipo', 'certificado_energetico', 'ce_numero',
  'aquecimento', 'agua', 'paineis_solares', 'caixilharia', 'orientacao', 'vista',
  'condominio_inclui', 'titulo_anuncio', 'descricao_longa', 'link_externo', 'notas_privadas',
  'ref_idealista', 'ref_imovirtual', 'ref_casasapo', 'ref_kw',
];
const NUM_FIELDS = [
  'latitude', 'longitude', 'area_util', 'area_bruta', 'area_terreno', 'area_dependente',
  'quartos', 'quartos_suite', 'wcs', 'piso', 'pisos_imovel', 'sala_m2',
  'ano_construcao', 'ano_remodelacao',
  'condominio_mensal', 'imi_anual', 'renda_mensal',
  'preco_actual', 'preco_inicial', 'preco_minimo_aceitavel',
];
const DATE_FIELDS = ['ce_validade'];
const BOOL_FIELDS = ['ocultar_morada', 'tem_ac', 'vidros_duplos', 'tem_condominio'];
const ARRAY_FIELDS = ['destaques', 'publico_alvo', 'publicado_em'];
const JSON_FIELDS = ['caracteristicas'];

function emptyToNull(v: unknown): string | null {
  if (typeof v !== 'string') return v == null ? null : String(v);
  const t = v.trim();
  return t === '' ? null : t;
}
function toNumberOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function toDateOrNull(v: unknown): string | null {
  if (typeof v !== 'string' || v.trim() === '') return null;
  return v;
}
function toBool(v: unknown): boolean {
  return v === true || v === 'true' || v === 1 || v === '1';
}

export function normalizeImovelPayload(body: Record<string, unknown>, organizationId?: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (organizationId) out.organization_id = organizationId;

  for (const k of TEXT_FIELDS) if (k in body) out[k] = emptyToNull(body[k]);
  for (const k of NUM_FIELDS) if (k in body) out[k] = toNumberOrNull(body[k]);
  for (const k of DATE_FIELDS) if (k in body) out[k] = toDateOrNull(body[k]);
  for (const k of BOOL_FIELDS) if (k in body) out[k] = toBool(body[k]);
  for (const k of ARRAY_FIELDS) {
    if (k in body) {
      const v = body[k];
      out[k] = Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim() !== '') : [];
    }
  }
  for (const k of JSON_FIELDS) {
    if (k in body) {
      const v = body[k];
      out[k] = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    }
  }

  // defaults
  if (!out.estado) out.estado = 'disponivel';
  if (!out.tipo) out.tipo = 'apartamento';
  if (!out.tipo_negocio) out.tipo_negocio = 'venda';

  // validate enums
  if (!ESTADOS.includes(out.estado as string)) throw new Error(`estado inválido: ${out.estado}`);
  if (!NEGOCIOS.includes(out.tipo_negocio as string)) throw new Error(`tipo_negocio inválido: ${out.tipo_negocio}`);
  if (!TIPOS.includes(out.tipo as string)) throw new Error(`tipo inválido: ${out.tipo}`);

  return out;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile?.organization_id) return NextResponse.json({ message: 'Profile sem organização' }, { status: 404 });

    const body = await request.json();
    const payload = normalizeImovelPayload(body, profile.organization_id);

    const { data, error } = await supabase
      .from('imoveis')
      .insert(payload)
      .select('id')
      .single();

    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    revalidatePath('/imoveis');
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
