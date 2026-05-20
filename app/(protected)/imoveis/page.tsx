import Link from 'next/link';
import { listImoveis, formatPrecoEur, estadoChipClass, estadoLabel } from '@/lib/imoveis';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Imóveis | Foco Imo' };

export default async function ImoveisPage() {
  let imoveis: Awaited<ReturnType<typeof listImoveis>> = [];
  let errorMsg: string | null = null;
  try {
    imoveis = await listImoveis();
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
  }

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Imóveis</h1>
          <p className="text-sm text-slate-500 mt-1">
            {imoveis.length === 0
              ? 'Sem imóveis ainda.'
              : imoveis.length === 1
                ? '1 imóvel registado.'
                : `${imoveis.length} imóveis registados.`}
          </p>
        </div>
        <Link
          href="/imoveis/novo"
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Novo imóvel
        </Link>
      </div>

      {errorMsg ? (
        <div className="rounded-md bg-red-50 text-red-700 p-4 text-sm">Erro ao carregar: {errorMsg}</div>
      ) : imoveis.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 p-12 text-center">
          <p className="text-slate-500 mb-4">Nenhum imóvel registado ainda.</p>
          <Link
            href="/imoveis/novo"
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Criar primeiro imóvel
          </Link>
        </div>
      ) : (
        <>
          {/* Desktop: tabela */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4 font-medium text-slate-600">Referência</th>
                  <th className="py-2 pr-4 font-medium text-slate-600">Morada</th>
                  <th className="py-2 pr-4 font-medium text-slate-600">Tipologia</th>
                  <th className="py-2 pr-4 font-medium text-slate-600">Concelho</th>
                  <th className="py-2 pr-4 font-medium text-slate-600">Estado</th>
                  <th className="py-2 pr-4 font-medium text-slate-600 text-right">Preço</th>
                </tr>
              </thead>
              <tbody>
                {imoveis.map((i) => (
                  <tr key={i.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="py-2 pr-4">
                      <Link href={`/imoveis/${i.id}`} className="text-blue-600 hover:underline">
                        {i.referencia ?? i.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-slate-700">{i.morada ?? '—'}</td>
                    <td className="py-2 pr-4 text-slate-600">{i.tipologia ?? '—'}</td>
                    <td className="py-2 pr-4 text-slate-600">{i.concelho ?? '—'}</td>
                    <td className="py-2 pr-4">
                      <span className={estadoChipClass(i.estado)}>{estadoLabel(i.estado)}</span>
                    </td>
                    <td className="py-2 pr-4 text-right font-medium text-slate-800">{formatPrecoEur(i.preco_actual)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards stack */}
          <div className="md:hidden space-y-3">
            {imoveis.map((i) => (
              <Link
                key={i.id}
                href={`/imoveis/${i.id}`}
                className="block rounded-lg border border-slate-200 p-4 hover:border-blue-400"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 truncate">
                      {i.referencia ?? i.id.slice(0, 8)}
                    </div>
                    <div className="text-sm text-slate-600 truncate">{i.morada ?? '—'}</div>
                  </div>
                  <span className={estadoChipClass(i.estado)}>{estadoLabel(i.estado)}</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-slate-500">
                    {i.tipologia ?? '—'} · {i.concelho ?? '—'}
                  </span>
                  <span className="font-medium text-slate-800">{formatPrecoEur(i.preco_actual)}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
