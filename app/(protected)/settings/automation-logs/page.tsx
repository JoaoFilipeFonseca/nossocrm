import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type ExecutionRow = {
  id: string;
  created_at: string;
  status: string;
  trigger_kind: string | null;
  step_type: string | null;
  error_message: string | null;
  deal: { id: string; title: string | null } | null;
};

export default async function AutomationLogsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('automation_executions')
    .select('id, created_at, status, trigger_kind, step_type, error_message, deal:deals(id, title)')
    .order('created_at', { ascending: false })
    .limit(100);

  const logs = (data ?? []) as unknown as ExecutionRow[];

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-2xl font-semibold mb-2">Logs de Automações</h1>
      <p className="text-sm text-slate-500 mb-6">
        Últimas 100 execuções do engine. Vazio enquanto o builder de automações não estiver activo.
      </p>

      {error ? (
        <div className="rounded-md bg-red-50 text-red-700 p-4 text-sm">
          Erro ao carregar: {error.message}
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 p-8 text-center text-slate-500">
          Sem execuções registadas ainda.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4 font-medium text-slate-600">Quando</th>
                <th className="py-2 pr-4 font-medium text-slate-600">Estado</th>
                <th className="py-2 pr-4 font-medium text-slate-600">Trigger</th>
                <th className="py-2 pr-4 font-medium text-slate-600">Passo</th>
                <th className="py-2 pr-4 font-medium text-slate-600">Deal</th>
                <th className="py-2 pr-4 font-medium text-slate-600">Erro</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="py-2 pr-4 whitespace-nowrap text-slate-700">
                    {new Date(log.created_at).toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' })}
                  </td>
                  <td className="py-2 pr-4">
                    <span className={statusChipClass(log.status)}>{log.status}</span>
                  </td>
                  <td className="py-2 pr-4 text-slate-600">{log.trigger_kind ?? '—'}</td>
                  <td className="py-2 pr-4 text-slate-600">{log.step_type ?? '—'}</td>
                  <td className="py-2 pr-4">
                    {log.deal ? (
                      <Link href={`/boards?dealId=${log.deal.id}`} className="text-blue-600 hover:underline">
                        {log.deal.title ?? log.deal.id.slice(0, 8)}
                      </Link>
                    ) : '—'}
                  </td>
                  <td className="py-2 pr-4 text-red-600 text-xs">{log.error_message ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function statusChipClass(status: string): string {
  const base = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium';
  switch (status) {
    case 'processado': return `${base} bg-green-100 text-green-700`;
    case 'ignorado': return `${base} bg-slate-100 text-slate-600`;
    case 'falhou': return `${base} bg-red-100 text-red-700`;
    case 'pausado_humano': return `${base} bg-amber-100 text-amber-700`;
    default: return `${base} bg-slate-100 text-slate-600`;
  }
}
