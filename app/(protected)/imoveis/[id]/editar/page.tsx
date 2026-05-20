import Link from 'next/link';
import { notFound } from 'next/navigation';
import ImovelForm, { type ImovelFormValues } from '@/components/imoveis/ImovelForm';
import { getImovelById } from '@/lib/imoveis';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Editar imóvel | Foco Imo' };

export default async function EditarImovelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const imovel = await getImovelById(id);
  if (!imovel) notFound();

  const initial: Partial<ImovelFormValues> = {
    referencia: imovel.referencia ?? '',
    morada: imovel.morada ?? '',
    freguesia: imovel.freguesia ?? '',
    concelho: imovel.concelho ?? '',
    distrito: imovel.distrito ?? '',
    tipologia: imovel.tipologia ?? '',
    area_util: imovel.area_util != null ? String(imovel.area_util) : '',
    area_bruta: imovel.area_bruta != null ? String(imovel.area_bruta) : '',
    ano_construcao: imovel.ano_construcao != null ? String(imovel.ano_construcao) : '',
    certificado_energetico: imovel.certificado_energetico ?? '',
    preco_actual: imovel.preco_actual != null ? String(imovel.preco_actual) : '',
    preco_inicial: imovel.preco_inicial != null ? String(imovel.preco_inicial) : '',
    preco_minimo_aceitavel: imovel.preco_minimo_aceitavel != null ? String(imovel.preco_minimo_aceitavel) : '',
    estado: imovel.estado,
    tipo_negocio: imovel.tipo_negocio,
    link_externo: imovel.link_externo ?? '',
    notas_privadas: imovel.notas_privadas ?? '',
  };

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-4">
        <Link href={`/imoveis/${id}`} className="text-sm text-blue-600 hover:underline">
          ← {imovel.referencia ?? id.slice(0, 8)}
        </Link>
      </div>
      <h1 className="text-2xl font-semibold mb-6">Editar imóvel</h1>
      <ImovelForm mode="edit" imovelId={id} initial={initial} />
    </div>
  );
}
