import Link from 'next/link';
import { notFound } from 'next/navigation';
import ImovelForm, { type ImovelFormValues } from '@/components/imoveis/ImovelForm';
import { getImovelById, type Imovel } from '@/lib/imoveis';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Editar imóvel | Foco Imo' };

function imovelToFormValues(i: Imovel): Partial<ImovelFormValues> {
  const v = (x: unknown) => (x == null ? '' : String(x));
  return {
    referencia: v(i.referencia), tipo: i.tipo ?? 'apartamento', subtipo: v(i.subtipo),
    estado: i.estado, estado_conservacao: v(i.estado_conservacao), tipo_negocio: i.tipo_negocio,
    morada: v(i.morada), numero_policia: v(i.numero_policia), codigo_postal: v(i.codigo_postal),
    freguesia: v(i.freguesia), concelho: v(i.concelho), distrito: v(i.distrito),
    latitude: v(i.latitude), longitude: v(i.longitude), ocultar_morada: !!i.ocultar_morada,
    tipologia: v(i.tipologia),
    area_util: v(i.area_util), area_bruta: v(i.area_bruta),
    area_terreno: v(i.area_terreno), area_dependente: v(i.area_dependente),
    quartos: v(i.quartos), quartos_suite: v(i.quartos_suite), wcs: v(i.wcs),
    piso: v(i.piso), pisos_imovel: v(i.pisos_imovel),
    cozinha_tipo: v(i.cozinha_tipo), sala_m2: v(i.sala_m2),
    ano_construcao: v(i.ano_construcao), ano_remodelacao: v(i.ano_remodelacao),
    certificado_energetico: v(i.certificado_energetico), ce_numero: v(i.ce_numero),
    ce_validade: v(i.ce_validade),
    aquecimento: v(i.aquecimento), tem_ac: !!i.tem_ac,
    agua: v(i.agua), paineis_solares: v(i.paineis_solares),
    caixilharia: v(i.caixilharia), vidros_duplos: !!i.vidros_duplos,
    orientacao: v(i.orientacao), vista: v(i.vista),
    tem_condominio: !!i.tem_condominio,
    condominio_mensal: v(i.condominio_mensal), condominio_inclui: v(i.condominio_inclui),
    imi_anual: v(i.imi_anual),
    preco_actual: v(i.preco_actual), preco_inicial: v(i.preco_inicial),
    preco_minimo_aceitavel: v(i.preco_minimo_aceitavel), renda_mensal: v(i.renda_mensal),
    titulo_anuncio: v(i.titulo_anuncio), descricao_longa: v(i.descricao_longa),
    destaques: i.destaques ?? [], publico_alvo: i.publico_alvo ?? [],
    publicado_em: i.publicado_em ?? [],
    ref_idealista: v(i.ref_idealista), ref_imovirtual: v(i.ref_imovirtual),
    ref_casasapo: v(i.ref_casasapo), ref_kw: v(i.ref_kw),
    link_externo: v(i.link_externo), notas_privadas: v(i.notas_privadas),
    caracteristicas: i.caracteristicas ?? {},
  };
}

export default async function EditarImovelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const imovel = await getImovelById(id);
  if (!imovel) notFound();

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-4">
        <Link href={`/imoveis/${id}`} className="text-sm text-blue-600 hover:underline">
          ← {imovel.referencia ?? id.slice(0, 8)}
        </Link>
      </div>
      <h1 className="text-2xl font-semibold mb-6">Editar imóvel</h1>
      <ImovelForm mode="edit" imovelId={id} initial={imovelToFormValues(imovel)} />
    </div>
  );
}
