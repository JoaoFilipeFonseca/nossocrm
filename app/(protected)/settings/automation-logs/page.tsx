import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type ExecutionRow = {
  id: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  status: string;
  trigger_type: string | null;
  is_test: boolean;
  error_message: string | null;
  automation_id: string;
  deal_id: string | null;
  contact_id: string | null;
  imovel_id: string | null;
  automation: { id: string; name: string; icon: string | null } | null;
  deal: { id: string; title: string | null } | null;
};

export default async function AutomationLogsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('automation_executions')
    .select(`
      id, started_at, completed_at, duration_ms, status, trigger_type, is_test,
      error_message, automation_id, deal_id, contact_id, imovel_id,
      automation:automations(id, name, icon),
      deal:deals(id, title)
    `)
    .order('started_at', { ascending: false })
    .limit(100);

  const logs = (data ?? []) as unknown as ExecutionRow[];

  return (
    <div className="p-6 max-w-7xl">
      <div className="flex items-start justify-between mb-2">
        <h1 className="text-2xl font-semibold">Logs de Automações</h1>
        <Link href="/automacoes" className="text-sm text-blue-600 hover:underline">
          Ver builder de automações →
        </Link>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Últimas 100 execuções do engine.
      </p>

      {error ? (
        <div className="rounded-md bg-red-50 text-red-700 p-4 text-sm">
          Erro ao carregar: {error.message}
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 p-8 text-center text-slate-500">
          Sem execuções registadas ainda. Quando uma automação for activada e disparar, aparece aqui.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4 font-medium text-slate-600">Quando</th>
                <th className="py-2 pr-4 font-medium text-slate-600">Automação</th>
                <th className="py-2 pr-4 font-medium text-slate-600">Estado</th>
                <th className="py-2 pr-4 font-medium text-slate-600">Trigger</th>
                <th className="py-2 pr-4 font-medium text-slate-600">Duração</th>
                <th className="py-2 pr-4 font-medium text-slate-600">Contexto</th>
                <th className="py-2 pr-4 font-medium text-slate-600">Erro</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="py-2 pr-4 whitespace-nowrap text-slate-700">
                    {new Date(log.started_at).toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon', dateStyle: 'short', timeStyle: 'short' })}
                    {log.is_test ? <span className="ml-2 text-[10px] uppercase font-medium text-amber-600">teste</span> : null}
                  </td>
                  <td className="py-2 pr-4">
                    {log.automation ? (
                      <Link href={`/automacoes/${log.automation.id}`} className="text-slate-700 hover:underline inline-flex items-center gap-1">
                        <span>{log.automation.icon ?? '⚡'}</span>
                        <span className="truncate max-w-[200px]">{log.automation.name}</span>
                      </Link>
                    ) : (
                      <span className="text-slate-400 font-mono text-xs">{log.automation_id.slice(0, 8)}…</span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    <span className={statusChipClass(log.status)}>{statusLabel(log.status)}</span>
                  </td>
                  <td className="py-2 pr-4 text-slate-600 text-xs font-mono">{log.trigger_type ?? '—'}</td>
                  <td className="py-2 pr-4 text-slate-500 text-xs">
                    {log.duration_ms !== null ? `${log.duration_ms}ms` : log.status === 'waiting' ? '…' : '—'}
                  </td>
                  <td className="py-2 pr-4 text-xs">
                    {log.deal ? (
                      <Link href={`/boards?dealId=${log.deal.id}`} className="text-blue-600 hover:underline">
                        {log.deal.title ?? log.deal.id.slice(0, 8)}
                      </Link>
                    ) : log.contact_id ? (
                      <Link href={`/contactos/${log.contact_id}`} className="text-blue-600 hover:underline">
                        contacto
                      </Link>
                    ) : log.imovel_id ? (
                      <Link href={`/imoveis/${log.imovel_id}`} className="text-blue-600 hover:underline">
                        imóvel
                      </Link>
                    ) : '—'}
                  </td>
                  <td className="py-2 pr-4 text-red-600 text-xs max-w-[300px] truncate" title={log.error_message ?? ''}>
                    {log.error_message ?? ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case 'running': return 'A correr';
    case 'completed': return 'Concluída';
    case 'waiting': return 'A aguardar';
    case 'failed': return 'Falhou';
    case 'cancelled': return 'Cancelada';
    default: return status;
  }
}

function statusChipClass(status: string): string {
  const base = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium';
  switch (status) {
    case 'completed': return `${base} bg-emerald-100 text-emerald-700`;
    case 'running': return `${base} bg-blue-100 text-blue-700`;
    case 'waiting': return `${base} bg-amber-100 text-amber-700`;
    case 'failed': return `${base} bg-red-100 text-red-700`;
    case 'cancelled': return `${base} bg-slate-100 text-slate-600`;
    default: return `${base} bg-slate-100 text-slate-600`;
  }
}
