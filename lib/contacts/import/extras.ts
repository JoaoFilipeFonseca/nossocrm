/**
 * Helpers extra para o import de contactos:
 *  - parseDateDDMMYYYY: aceita "DD/MM/YYYY" comum em exports PT
 *  - pickDealRouting: dada uma linha e config de qualificações, devolve
 *    o (boardId, stageId, tag) correctos
 *  - buildDealPayload: monta o objecto pronto a inserir em `deals`
 */

import { normalizeHeader } from './mapping';

export type DealRoutingConfig = {
  qualificationColumns: {
    QV?: string;
    QC?: string;
    QAP?: string;
    QAA?: string;
  };
  routing: {
    QV: { boardId: string; stageId: string };
    QC: { boardId: string; stageId: string };
    QAP: { boardId: string; stageId: string };
    QAA: { boardId: string; stageId: string };
    default: { boardId: string; stageId: string };
  };
  extraCustomFieldColumns: string[];
  baseTags: string[];
};

export type QualifCode = 'QV' | 'QC' | 'QAP' | 'QAA' | 'default';

/**
 * Parsing de datas estilo PT: "23/03/2026" → "2026-03-23T00:00:00.000Z".
 * Tolerante a "23-03-2026", "23.03.2026", "23/03/26" (assume 20YY).
 * Devolve null se não conseguir.
 */
export function parseDateDDMMYYYY(raw: string | undefined | null): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/.exec(s);
  if (!m) return null;
  let [, d, mo, y] = m;
  let year = parseInt(y, 10);
  if (year < 100) year += 2000;
  const day = parseInt(d, 10);
  const month = parseInt(mo, 10);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00.000Z`;
  // Sanity check
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return iso;
}

/**
 * Decide para que (board, stage, tag) este lead vai, baseado em qual coluna
 * de qualificação (QV/QC/QAP/QAA) tem valor não-vazio.
 *
 * Priority: QC > QV > QAP > QAA > default.
 *  - QC primeiro porque compradores são maioria dos leads de portal
 *  - QV depois (vendedores são mais raros mas valiosos)
 *  - QAP/QAA atribuição clara mas menor volume
 *  - default fallback (não qualificados) → board Compradores
 */
export function pickDealRouting(
  row: string[],
  headerIdx: Map<string, number>,
  cfg: DealRoutingConfig
): { boardId: string; stageId: string; qualifTag: string; reference: string | null } {
  const tryGet = (colName: string | undefined): string | null => {
    if (!colName) return null;
    const idx = headerIdx.get(normalizeHeader(colName));
    if (idx === undefined) return null;
    const v = (row[idx] ?? '').toString().trim();
    return v || null;
  };

  const order: QualifCode[] = ['QC', 'QV', 'QAP', 'QAA'];
  for (const code of order) {
    const colName = cfg.qualificationColumns[code];
    const value = tryGet(colName);
    if (value) {
      const r = cfg.routing[code];
      return {
        boardId: r.boardId,
        stageId: r.stageId,
        qualifTag: code,
        reference: value,
      };
    }
  }
  return {
    boardId: cfg.routing.default.boardId,
    stageId: cfg.routing.default.stageId,
    qualifTag: 'nao_qualificada',
    reference: null,
  };
}

/**
 * Extrai os custom_fields a meter no deal a partir das colunas extras
 * configuradas. Mantém formato {colName: value} para inspeção fácil.
 */
export function buildCustomFields(
  row: string[],
  headerIdx: Map<string, number>,
  extraColumns: string[]
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const col of extraColumns) {
    const idx = headerIdx.get(normalizeHeader(col));
    if (idx === undefined) continue;
    const v = (row[idx] ?? '').toString().trim();
    if (v) out[col] = v;
  }
  return out;
}

/**
 * Detecta padrões de referência de imóvel em texto livre (notes/observações).
 *
 * Exports de portais imobiliários PT incorporam o ID interno do anúncio nas
 * mensagens dos leads. Exemplos comuns:
 *  - RE/MAX: "124851227-13 Olá, tenho interesse..." (formato `agenteId-imovelId`)
 *  - ERA / Century21: "REF: ABC-12345"
 *  - Idealista: "Anúncio 24351789"
 *
 * Devolve a primeira referência detectada ou null. Preserva no
 * deal.custom_fields.imovel_referencia_externa para futura sincronização
 * com a tabela `imoveis`.
 */
export function extractImovelReferencia(text: string | null | undefined): string | null {
  const s = String(text ?? '');
  if (!s) return null;
  // Padrão RE/MAX: 8-10 dígitos seguidos de hífen e 1-4 dígitos
  // Match ao início da string ou após espaço/início de linha para evitar capturar IDs aleatórios
  const remax = /(?:^|\s)(\d{8,10}-\d{1,4})/.exec(s);
  if (remax) return remax[1];
  // Padrão ERA/RE/MAX genérico: REF:/Ref:/REF seguido de código
  const ref = /\b(?:REF|Ref|ref)\s*:?\s*([A-Z0-9-]{4,20})/.exec(s);
  if (ref) return ref[1];
  return null;
}
