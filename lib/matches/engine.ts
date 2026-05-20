import 'server-only';
import { createStaticAdminClient } from '@/lib/supabase/server';

/**
 * Match engine v1: cruza raw_intel (intent=procura) com imoveis disponiveis.
 *
 * Score (0-100):
 *  - Tipologia exacta: 30 | adjacente (+/-1): 15
 *  - Zona freguesia match: 25 | concelho match: 12
 *  - Preco dentro +/-10%: 20 | +/-20%: 8
 *  - Caracteristicas/must-haves (varanda/garagem/etc): 5 cada, max 15
 *  - Penalidade idade raw_intel: -1 por dia apos 30d, max -30
 *
 * Threshold: >=40 grava em matches.
 */

const TIPOLOGIA_ORDEM = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T5+', 'V3', 'V4', 'V5', 'V5+'];

interface RawIntelRow {
  id: string;
  organization_id: string;
  intent: string;
  property: unknown;
  contact: Record<string, unknown> | null;
  created_at: string;
  status: string;
}

interface ImovelRow {
  id: string;
  tipologia: string | null;
  concelho: string | null;
  freguesia: string | null;
  zona?: string | null;
  preco_actual: number | null;
  caracteristicas: Record<string, boolean> | null;
  estado: string | null;
}

interface PropertyNorm {
  tipologia: string | null;
  zona: string | null;
  concelho: string | null;
  freguesia: string | null;
  preco: number | null;
  caracteristicas: string[];
}

function normaliza(s: string | null | undefined): string {
  if (!s) return '';
  return s.toString().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim();
}

function normalizeProperty(raw: unknown): PropertyNorm[] {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr.map((p) => {
    const obj = (p && typeof p === 'object') ? p as Record<string, unknown> : {};
    const tipologia = (obj.tipologia ?? obj.tipo) as string | null;
    const preco = (obj.preco ?? obj.preco_eur ?? obj.preco_actual) as number | null;
    const caracs = Array.isArray(obj.caracteristicas) ? obj.caracteristicas as string[] : [];
    const extras: string[] = [];
    if (obj.garagem) extras.push('garagem');
    if (obj.varanda) extras.push('varanda');
    if (obj.terraco) extras.push('terraco');
    if (obj.piscina) extras.push('piscina');
    return {
      tipologia: tipologia ? String(tipologia).toUpperCase().trim() : null,
      zona: (obj.zona as string | null) ?? null,
      concelho: (obj.concelho as string | null) ?? null,
      freguesia: (obj.freguesia as string | null) ?? null,
      preco: typeof preco === 'number' ? preco : null,
      caracteristicas: Array.from(new Set([...caracs, ...extras].map(String))),
    };
  });
}

function tipologiaScore(procura: string | null, imovel: string | null): number {
  if (!procura || !imovel) return 0;
  const p = procura.replace(/\s/g, '').toUpperCase();
  const i = imovel.replace(/\s/g, '').toUpperCase();
  if (p === i) return 30;
  // Adjacencia T2/T3, T0/T1, etc.
  const pIdx = TIPOLOGIA_ORDEM.indexOf(p);
  const iIdx = TIPOLOGIA_ORDEM.indexOf(i);
  if (pIdx >= 0 && iIdx >= 0 && Math.abs(pIdx - iIdx) === 1) return 15;
  // T2+ ou T2+1 contem T2
  if (p.startsWith(i) || i.startsWith(p)) return 20;
  return 0;
}

function zonaScore(procura: PropertyNorm, imovel: ImovelRow): { pts: number; razao: string } {
  const procFreg = normaliza(procura.freguesia);
  const procConc = normaliza(procura.concelho);
  const procZona = normaliza(procura.zona);
  const imvFreg = normaliza(imovel.freguesia);
  const imvConc = normaliza(imovel.concelho);

  if (procFreg && imvFreg && procFreg === imvFreg) return { pts: 25, razao: `freguesia ${imovel.freguesia}` };
  if (procConc && imvConc) {
    // Procura pode listar varios concelhos separados por virgulas
    const concelhos = procConc.split(/[,/]/).map((s) => s.trim()).filter(Boolean);
    if (concelhos.some((c) => c === imvConc || imvConc.includes(c) || c.includes(imvConc))) {
      return { pts: 12, razao: `concelho ${imovel.concelho}` };
    }
  }
  if (procZona && (imvConc || imvFreg)) {
    const z = normaliza(procZona);
    if ((imvConc && z.includes(imvConc)) || (imvFreg && z.includes(imvFreg))) {
      return { pts: 10, razao: `zona ${procura.zona}` };
    }
  }
  return { pts: 0, razao: '' };
}

function precoScore(procuraPreco: number | null, imovelPreco: number | null): { pts: number; razao: string } {
  if (!procuraPreco || !imovelPreco) return { pts: 0, razao: '' };
  const ratio = imovelPreco / procuraPreco;
  const pct = Math.round(Math.abs(1 - ratio) * 100);
  if (pct <= 10) return { pts: 20, razao: `preco a ${pct}% do orcamento` };
  if (pct <= 20) return { pts: 8, razao: `preco a ${pct}% do orcamento` };
  return { pts: 0, razao: '' };
}

function caractScore(procuraChars: string[], imovel: ImovelRow): { pts: number; razao: string[] } {
  const caracs = imovel.caracteristicas ?? {};
  const matched: string[] = [];
  for (const c of procuraChars) {
    const key = normaliza(c).replace(/\s+/g, '_');
    if (caracs[key] === true) matched.push(c);
  }
  return { pts: Math.min(15, matched.length * 5), razao: matched };
}

function idadePenalidade(createdAt: string): number {
  const dias = Math.floor((Date.now() - new Date(createdAt).getTime()) / (24 * 3600 * 1000));
  if (dias <= 30) return 0;
  return -Math.min(30, dias - 30);
}

export interface MatchCandidate {
  raw_intel_id: string;
  imovel_id: string;
  property_index: number;
  score: number;
  reason: Record<string, unknown>;
}

export function scorePair(procura: PropertyNorm, imovel: ImovelRow, ageDays: string): { score: number; reason: Record<string, unknown> } | null {
  const tip = tipologiaScore(procura.tipologia, imovel.tipologia);
  const zona = zonaScore(procura, imovel);
  const preco = precoScore(procura.preco, imovel.preco_actual);
  const car = caractScore(procura.caracteristicas, imovel);
  const idade = idadePenalidade(ageDays);
  const total = Math.max(0, tip + zona.pts + preco.pts + car.pts + idade);
  if (total < 40) return null;
  return {
    score: total,
    reason: {
      tipologia: tip,
      zona: zona.pts > 0 ? { pts: zona.pts, label: zona.razao } : undefined,
      preco: preco.pts > 0 ? { pts: preco.pts, label: preco.razao } : undefined,
      caracteristicas: car.pts > 0 ? { pts: car.pts, matched: car.razao } : undefined,
      idade_penalty: idade < 0 ? idade : undefined,
    },
  };
}

/**
 * Fire-and-forget seguro: dispara computeMatches sem bloquear o caller nem
 * propagar erros. Loga falhas em console.error (visivel nos logs Vercel).
 * Usar apos INSERT raw_intel (Telegram) ou INSERT/UPDATE imovel.
 */
export function triggerMatchesAsync(organizationId: string): void {
  void computeMatches(organizationId).catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[matches] auto-trigger falhou para org ${organizationId}:`, msg);
  });
}

export async function computeMatches(organizationId: string): Promise<{
  computed: number;
  inserted: number;
  candidates: MatchCandidate[];
}> {
  const supabase = createStaticAdminClient();

  const [intelRes, imoveisRes] = await Promise.all([
    supabase.from('raw_intel')
      .select('id, organization_id, intent, property, contact, created_at, status')
      .eq('organization_id', organizationId)
      .eq('intent', 'procura')
      .neq('status', 'arquivado'),
    supabase.from('imoveis')
      .select('id, tipologia, concelho, freguesia, preco_actual, caracteristicas, estado')
      .eq('organization_id', organizationId)
      .in('estado', ['disponivel', 'em_avaliacao']),
  ]);

  const intel = (intelRes.data ?? []) as RawIntelRow[];
  const imoveis = (imoveisRes.data ?? []) as ImovelRow[];

  const candidates: MatchCandidate[] = [];

  for (const ri of intel) {
    const props = normalizeProperty(ri.property);
    props.forEach((proc, idx) => {
      for (const imv of imoveis) {
        const result = scorePair(proc, imv, ri.created_at);
        if (result) {
          candidates.push({
            raw_intel_id: ri.id,
            imovel_id: imv.id,
            property_index: idx,
            score: result.score,
            reason: result.reason,
          });
        }
      }
    });
  }

  if (candidates.length === 0) {
    return { computed: intel.length * imoveis.length, inserted: 0, candidates: [] };
  }

  // Upsert: nao destruir status existente (visto/contactado/ignorado)
  const rows = candidates.map((c) => ({
    organization_id: organizationId,
    raw_intel_id: c.raw_intel_id,
    imovel_id: c.imovel_id,
    property_index: c.property_index,
    score: c.score,
    reason: c.reason,
  }));

  const { error } = await supabase.from('matches').upsert(rows, {
    onConflict: 'raw_intel_id,imovel_id,property_index',
    ignoreDuplicates: false,
  });

  if (error) throw new Error(`Erro a gravar matches: ${error.message}`);

  return { computed: intel.length * imoveis.length, inserted: candidates.length, candidates };
}
