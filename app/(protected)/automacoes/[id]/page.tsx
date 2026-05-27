import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAutomation, statusLabel, statusChipClass } from '@/lib/automations/server';
import { createClient } from '@/lib/supabase/server';
import BuilderActions from './actions';
import { Canvas } from '@/components/automations/Canvas';
import { Palette } from '@/components/automations/Palette';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Builder de Automação | Foco Imo' };

interface ExecutionRow {
  id: string;
  status: string;
  trigger_type: string | null;
  duration_ms: number | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  is_test: boolean;
}

async function fetchRecentExecutions(automationId: string): Promise<ExecutionRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('automation_executions')
    .select('id, status, trigger_type, duration_ms, error_message, started_at, completed_at, is_test')
    .eq('automation_id', automationId)
    .order('started_at', { ascending: false })
    .limit(10);
  return (data ?? []) as ExecutionRow[];
}

function statusBadge(status: string): string {
  switch (status) {
    case 'completed': return 'bg-emerald-100 text-emerald-700';
    case 'running': return 'bg-blue-100 text-blue-700';
    case 'waiting': return 'bg-amber-100 text-amber-700';
    case 'failed': return 'bg-red-100 text-red-700';
    case 'cancelled': return 'bg-slate-100 text-slate-600';
    default: return 'bg-slate-100 text-slate-600';
  }
}

export default async function AutomacaoBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const automation = await getAutomation(id);
  if (!automation) notFound();

  const executions = await fetchRecentExecutions(id);
  const nodes = automation.definition.nodes ?? [];
  const edges = automation.definition.edges ?? [];

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="mb-4">
        <Link href="/automacoes" className="text-sm text-slate-500 hover:text-slate-900">← Automações</Link>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-3">
          <div className="text-3xl">{automation.icon}</div>
          <div>
            <h1 className="text-2xl font-semibold">{automation.name}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusChipClass(automation.status)}`}>
                {statusLabel(automation.status)}
              </span>
              <span>versão {automation.version}</span>
              <span>{nodes.length} nós, {edges.length} ligações</span>
            </div>
          </div>
        </div>
        <BuilderActions
          automationId={automation.id}
          status={automation.status}
          initialName={automation.name}
          initialIcon={automation.icon ?? '⚡'}
          initialDescription={automation.description ?? null}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Coluna principal — canvas ocupa 3/4 em XL */}
        <div className="xl:col-span-3 space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between px-2 py-1 mb-2">
              <h2 className="text-sm font-semibold text-slate-700">Fluxo visual</h2>
              <p className="text-[11px] text-slate-500">
                Arrasta átomos da palette · puxa do ponto direito de um nó para o esquerdo do seguinte para ligar
              </p>
            </div>
            <div className="flex border border-slate-200 rounded-md overflow-hidden bg-slate-50 h-[720px]">
              <Palette />
              <div className="flex-1 min-w-0">
                <Canvas
                  automationId={automation.id}
                  definition={automation.definition as { nodes: never[]; edges: never[] }}
                  className="h-full bg-slate-50"
                />
              </div>
            </div>
            <details className="mt-3">
              <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">Ver JSON cru</summary>
              <pre className="mt-2 text-xs bg-slate-50 border border-slate-200 rounded p-3 overflow-auto max-h-96">{JSON.stringify(automation.definition, null, 2)}</pre>
            </details>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-700">Execuções recentes</h2>
              <span className="text-xs text-slate-500">
                {automation.total_executions} totais · {automation.success_count} OK
                {automation.failure_count > 0 ? ` · ${automation.failure_count} falhas` : ''}
              </span>
            </div>
            {executions.length === 0 ? (
              <p className="text-sm text-slate-500 italic">Sem execuções ainda. Activa a automação ou usa &quot;Executar agora&quot;.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {executions.map((e) => (
                  <li key={e.id} className="py-2 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusBadge(e.status)}`}>{e.status}</span>
                      <span className="text-slate-500 text-xs truncate">{e.trigger_type ?? '—'}</span>
                      {e.is_test ? <span className="text-xs text-amber-600">teste</span> : null}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 shrink-0">
                      <span>{e.duration_ms ? `${e.duration_ms}ms` : '...'}</span>
                      <span>{new Date(e.started_at).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Sidebar info */}
        <aside className="xl:col-span-1 space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-5 text-sm">
            <h2 className="font-semibold text-slate-700 mb-2">Detalhes</h2>
            <dl className="space-y-1.5 text-slate-600">
              <div className="flex justify-between"><dt>ID</dt><dd className="font-mono text-xs">{automation.id.slice(0, 8)}...</dd></div>
              <div className="flex justify-between"><dt>Criada</dt><dd>{new Date(automation.created_at).toLocaleDateString('pt-PT')}</dd></div>
              <div className="flex justify-between"><dt>Actualizada</dt><dd>{new Date(automation.updated_at).toLocaleDateString('pt-PT')}</dd></div>
              {automation.activated_at ? (
                <div className="flex justify-between"><dt>Activada</dt><dd>{new Date(automation.activated_at).toLocaleDateString('pt-PT')}</dd></div>
              ) : null}
              {automation.last_execution_at ? (
                <div className="flex justify-between"><dt>Última execução</dt><dd>{new Date(automation.last_execution_at).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}</dd></div>
              ) : null}
            </dl>
          </section>

          <section className="rounded-lg border border-violet-200 bg-violet-50 p-4 text-xs text-violet-900">
            <strong className="block mb-1">Sprint 2.2 (palette)</strong>
            Arrasta um átomo da palette esquerda para o canvas. Liga nós com clique-arrastar entre os pontos. Tudo guardado automaticamente.
          </section>
        </aside>
      </div>
    </div>
  );
}
