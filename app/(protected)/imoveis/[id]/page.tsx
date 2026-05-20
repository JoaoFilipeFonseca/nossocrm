import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getImovelById,
  listEventosByImovelId,
  formatPrecoEur,
  estadoChipClass,
  estadoLabel,
  eventoLabel,
} from '@/lib/imoveis';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Imóvel | Foco Imo' };

export default async function ImovelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const imovel = await getImovelById(id);
  if (!imovel) notFound();

  const eventos = await listEventosByImovelId(id);

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-4">
        <Link href="/imoveis" className="text-sm text-blue-600 hover:underline">
          ← Imóveis
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">
            {imovel.referencia ?? imovel.id.slice(0, 8)}
          </h1>
          {imovel.morada && <p className="text-sm text-slate-600 mt-1">{imovel.morada}</p>}
        </div>
        <span className={estadoChipClass(imovel.estado)}>{estadoLabel(imovel.estado)}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <DataRow label="Tipologia" value={imovel.tipologia} />
        <DataRow label="Tipo de negócio" value={imovel.tipo_negocio} />
        <DataRow label="Concelho" value={imovel.concelho} />
        <DataRow label="Freguesia" value={imovel.freguesia} />
        <DataRow label="Distrito" value={imovel.distrito} />
        <DataRow label="Área útil (m²)" value={imovel.area_util} />
        <DataRow label="Área bruta (m²)" value={imovel.area_bruta} />
        <DataRow label="Ano construção" value={imovel.ano_construcao} />
        <DataRow label="Certificado energético" value={imovel.certificado_energetico} />
        <DataRow label="Preço actual" value={formatPrecoEur(imovel.preco_actual)} highlight />
        <DataRow label="Preço inicial" value={formatPrecoEur(imovel.preco_inicial)} />
        <DataRow label="Preço mínimo aceitável" value={formatPrecoEur(imovel.preco_minimo_aceitavel)} />
      </div>

      {imovel.link_externo && (
        <div className="mb-6">
          <a
            href={imovel.link_externo}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-blue-600 hover:underline"
          >
            Anúncio externo ↗
          </a>
        </div>
      )}

      {imovel.notas_privadas && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Notas privadas</h2>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{imovel.notas_privadas}</p>
        </div>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-3">Histórico</h2>
        {eventos.length === 0 ? (
          <p className="text-sm text-slate-500">Sem eventos registados ainda.</p>
        ) : (
          <ol className="space-y-3">
            {eventos.map((e) => (
              <li key={e.id} className="rounded-md border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800">{eventoLabel(e.kind)}</span>
                  <span className="text-xs text-slate-500">
                    {new Date(e.occurred_at).toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' })}
                  </span>
                </div>
                {e.valor != null && (
                  <div className="text-sm text-slate-700 mt-1">{formatPrecoEur(e.valor)}</div>
                )}
                {e.descricao && (
                  <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{e.descricao}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function DataRow({ label, value, highlight }: { label: string; value: string | number | null; highlight?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`text-sm mt-0.5 ${highlight ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
        {value == null || value === '' ? '—' : value}
      </dd>
    </div>
  );
}
