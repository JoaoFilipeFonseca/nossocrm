import Link from 'next/link';
import { listAutomations, statusChipClass, statusLabel } from '@/lib/automations/server';
import { CardActions } from './CardActions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Automações | Foco Imo' };

export default async function AutomacoesPage() {
  let automations: Awaited<ReturnType<typeof listAutomations>> = [];
  let errorMsg: string | null = null;
  try {
    automations = await listAutomations();
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
  }

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Automações</h1>
          <p className="text-sm text-slate-500 mt-1">
            {automations.length === 0
              ? 'Sem automações ainda.'
              : automations.length === 1
                ? '1 automação registada.'
                : `${automations.length} automações registadas.`}
          </p>
        </div>
        <Link
          href="/automacoes/nova"
          className="inline-flex items-center rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
        >
          ⚡ Nova automação
        </Link>
      </div>

      {errorMsg ? (
        <div className="rounded-md bg-red-50 text-red-700 p-4 text-sm">Erro ao carregar: {errorMsg}</div>
      ) : automations.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 p-12 text-center">
          <p className="text-slate-500 mb-4">Ainda não tens nenhuma automação. Cria a primeira para começares a poupar tempo.</p>
          <Link
            href="/automacoes/nova"
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Criar primeira automação
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {automations.map((a) => (
            <Link
              key={a.id}
              href={`/automacoes/${a.id}`}
              className="block rounded-lg border border-slate-200 bg-white p-5 hover:border-violet-300 hover:shadow transition relative"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="text-2xl">{a.icon}</div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusChipClass(a.status)}`}>
                    {statusLabel(a.status)}
                  </span>
                  <CardActions id={a.id} name={a.name} status={a.status} />
                </div>
              </div>
              <h2 className="text-base font-semibold text-slate-900 mb-1 line-clamp-2">{a.name}</h2>
              {a.description ? (
                <p className="text-sm text-slate-500 line-clamp-2 mb-3">{a.description}</p>
              ) : (
                <p className="text-sm text-slate-400 italic mb-3">Sem descrição.</p>
              )}
              <div className="flex items-center gap-4 text-xs text-slate-500 mt-4 pt-3 border-t border-slate-100">
                <span>
                  <strong className="text-slate-700">{a.total_executions}</strong> execuções
                </span>
                {a.total_executions > 0 ? (
                  <span>
                    <strong className="text-emerald-600">{a.success_count}</strong> OK
                    {a.failure_count > 0 ? <span className="ml-1 text-red-600">/ {a.failure_count} falhas</span> : null}
                  </span>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
