import { createClient } from '@/lib/supabase/server';
import MatchCard from '@/components/matches/MatchCard';
import RefreshButton from '@/components/matches/RefreshButton';
import { MatchesClient } from '@/features/matches/MatchesClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Cruzamentos | Foco Imo' };

interface PageProps {
  searchParams?: Promise<{ status?: string; min?: string }>;
}

interface RawIntelMin {
  id: string;
  intent: string;
  ownership: string;
  contact: Record<string, unknown> | null;
  property: unknown;
  source_kind: string;
}

interface ImovelMin {
  id: string;
  referencia: string | null;
  titulo_anuncio: string | null;
  morada: string | null;
  tipologia: string | null;
  concelho: string | null;
  preco_actual: number | null;
}

interface MatchRow {
  id: string;
  raw_intel_id: string;
  imovel_id: string;
  property_index: number;
  score: number;
  reason: Record<string, unknown>;
  status: string;
  created_at: string;
}

function extractFromProperty(raw: unknown, idx: number): { tipologia: string | null; zona: string | null; concelho: string | null; preco: number | null } {
  if (!raw) return { tipologia: null, zona: null, concelho: null, preco: null };
  const arr = Array.isArray(raw) ? raw : [raw];
  const p = arr[idx] ?? arr[0];
  if (!p || typeof p !== 'object') return { tipologia: null, zona: null, concelho: null, preco: null };
  const o = p as Record<string, unknown>;
  return {
    tipologia: (o.tipologia as string) ?? (o.tipo as string) ?? null,
    zona: (o.zona as string) ?? null,
    concelho: (o.concelho as string) ?? null,
    preco: (o.preco as number) ?? (o.preco_eur as number) ?? null,
  };
}

export default async function CruzamentosPage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const statusFilter = sp.status ?? 'novo';
  const minScore = sp.min ? Number(sp.min) : 40;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return <div className="p-6">Sem sessão.</div>;
  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
  if (!profile?.organization_id) return <div className="p-6">Sem organização.</div>;

  let query = supabase
    .from('matches')
    .select('id, raw_intel_id, imovel_id, property_index, score, reason, status, created_at')
    .eq('organization_id', profile.organization_id)
    .gte('score', minScore)
    .order('score', { ascending: false })
    .limit(100);
  if (statusFilter !== 'todos') query = query.eq('status', statusFilter);
  const { data: matches } = await query;

  const matchList = (matches ?? []) as MatchRow[];
  const intelIds = Array.from(new Set(matchList.map((m) => m.raw_intel_id)));
  const imovelIds = Array.from(new Set(matchList.map((m) => m.imovel_id)));

  const [intelRes, imovelRes] = await Promise.all([
    intelIds.length > 0
      ? supabase.from('raw_intel').select('id, intent, ownership, contact, property, source_kind').in('id', intelIds)
      : Promise.resolve({ data: [] }),
    imovelIds.length > 0
      ? supabase.from('imoveis').select('id, referencia, titulo_anuncio, morada, tipologia, concelho, preco_actual').in('id', imovelIds)
      : Promise.resolve({ data: [] }),
  ]);

  const intelById = new Map<string, RawIntelMin>(((intelRes.data ?? []) as RawIntelMin[]).map((r) => [r.id, r]));
  const imovelById = new Map<string, ImovelMin>(((imovelRes.data ?? []) as ImovelMin[]).map((r) => [r.id, r]));

  const [novoRes, contactadoRes, ignoradoRes] = await Promise.all([
    supabase.from('matches').select('id', { count: 'exact', head: true })
      .eq('organization_id', profile.organization_id).eq('status', 'novo').gte('score', minScore),
    supabase.from('matches').select('id', { count: 'exact', head: true })
      .eq('organization_id', profile.organization_id).eq('status', 'contactado').gte('score', minScore),
    supabase.from('matches').select('id', { count: 'exact', head: true })
      .eq('organization_id', profile.organization_id).eq('status', 'ignorado').gte('score', minScore),
  ]);

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Cruzamentos</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          O ouro: com que leads e imóveis teus a informação faz match. Cola coisas novas na secção em baixo.
        </p>
      </div>

      {/* Função 1 (ouro) — matches calculados, no topo */}
      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-semibold">Matches encontrados</h2>
        <RefreshButton />
      </div>

      <div className="flex gap-2 mb-5 flex-wrap text-sm">
        {[
          { v: 'novo', l: 'Novos', n: novoRes.count ?? 0 },
          { v: 'contactado', l: 'Contactados', n: contactadoRes.count ?? 0 },
          { v: 'ignorado', l: 'Ignorados', n: ignoradoRes.count ?? 0 },
          { v: 'todos', l: 'Todos', n: -1 },
        ].map((t) => {
          const active = statusFilter === t.v;
          return (
            <a key={t.v} href={`/cruzamentos?status=${t.v}&min=${minScore}`}
              className={
                'inline-flex items-center rounded-md border px-3 py-1.5 font-medium ' +
                (active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50')
              }
            >
              {t.l}{t.n >= 0 ? ` (${t.n})` : ''}
            </a>
          );
        })}
        <span className="ml-2 inline-flex items-center text-xs text-slate-500">Score mín: {minScore}</span>
      </div>

      {matchList.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
          <p className="text-sm text-slate-600">
            Sem cruzamentos {statusFilter === 'novo' ? 'novos' : statusFilter}.
            <br />
            Carrega <strong>Re-calcular</strong> para correr o engine, ou adiciona procuras (raw intel) e imóveis pelo Telegram.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {matchList.map((m) => {
            const intel = intelById.get(m.raw_intel_id);
            const imv = imovelById.get(m.imovel_id);
            if (!intel || !imv) return null;
            const procExt = extractFromProperty(intel.property, m.property_index);
            const contact = (intel.contact ?? {}) as Record<string, string | null>;
            const imovLabel = imv.referencia ?? imv.titulo_anuncio ?? imv.morada ?? imv.id.slice(0, 8);
            return (
              <MatchCard
                key={m.id}
                id={m.id}
                score={m.score}
                status={m.status}
                reason={m.reason}
                procura={{
                  nome: contact.nome ?? null,
                  telefone: contact.telefone ?? null,
                  tipologia: procExt.tipologia,
                  zona: procExt.zona,
                  concelho: procExt.concelho,
                  preco: procExt.preco,
                  intent_source: `${intel.intent} · ${intel.ownership} · via ${intel.source_kind}`,
                }}
                imovel={{
                  id: imv.id,
                  label: imovLabel,
                  tipologia: imv.tipologia,
                  concelho: imv.concelho,
                  preco: imv.preco_actual,
                }}
              />
            );
          })}
        </div>
      )}

      {/* Função 2 — colar informação (minimizável, extrai para raw intel) */}
      <details className="mt-8 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
          Colar informação
          <span className="text-xs font-normal text-slate-400">— adicionar coisas novas para cruzar</span>
        </summary>
        <div className="px-4 pb-4">
          <MatchesClient embedded />
        </div>
      </details>
    </div>
  );
}
