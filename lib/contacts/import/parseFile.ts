/**
 * Parser unificado de ficheiros de import de contactos.
 *
 * Suporta:
 *  - CSV (vírgula, ponto-e-vírgula, TAB — auto-detect via lib/utils/csv)
 *  - XLSX / XLS (primeira folha)
 *
 * Auto-detect de encoding:
 *  - UTF-8 com BOM → detectado e strip
 *  - UTF-8 sem BOM → tentativa default
 *  - Latin1/Windows-1252 (exports antigos Excel PT) → fallback se UTF-8
 *    produzir replacement characters (�)
 *
 * Devolve sempre `{ headers, rows, format, ...meta }` para consumo uniforme
 * pelas rotas de preview/commit.
 */

import * as XLSX from 'xlsx';
import { detectCsvDelimiter, parseCsv, type CsvDelimiter } from '@/lib/utils/csv';

export type ParsedFile = {
  headers: string[];
  rows: string[][];
  format: 'csv' | 'xlsx';
  delimiter: CsvDelimiter | null;
  encoding: 'utf-8' | 'latin1' | 'binary';
  totalRows: number;
  filename: string;
};

const REPLACEMENT_RE = /�/;

function decodeBuffer(buf: ArrayBuffer): { text: string; encoding: 'utf-8' | 'latin1' } {
  const bytes = new Uint8Array(buf);
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  if (!REPLACEMENT_RE.test(utf8)) {
    return { text: utf8, encoding: 'utf-8' };
  }
  // Fallback Latin1 (alias Windows-1252 nos browsers/Node modernos)
  try {
    const latin1 = new TextDecoder('windows-1252', { fatal: false }).decode(bytes);
    return { text: latin1, encoding: 'latin1' };
  } catch {
    return { text: utf8, encoding: 'utf-8' };
  }
}

function detectFormat(filename: string): 'csv' | 'xlsx' {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.xlsm')) {
    return 'xlsx';
  }
  return 'csv';
}

function parseXlsx(buf: ArrayBuffer): { headers: string[]; rows: string[][] } {
  const wb = XLSX.read(buf, { type: 'array', cellDates: false });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return { headers: [], rows: [] };
  const sheet = wb.Sheets[firstSheetName];
  // header: 1 → array de arrays; defval: '' → preenche células vazias
  const arr = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false,
  });
  if (!arr.length) return { headers: [], rows: [] };
  const headers = (arr[0] || []).map(v => String(v ?? '').trim());
  const rows = arr
    .slice(1)
    .map(r => r.map(v => String(v ?? '')))
    .filter(r => r.some(cell => cell.trim() !== ''));
  return { headers, rows };
}

/**
 * Parser principal — recebe ArrayBuffer + filename e devolve estrutura uniforme.
 *
 * @param buffer Conteúdo binário do ficheiro
 * @param filename Nome original (usado só para detectar formato pela extensão)
 * @param forcedDelimiter Opcional — força delimitador CSV em vez de auto-detect
 */
export function parseImportFile(
  buffer: ArrayBuffer,
  filename: string,
  forcedDelimiter?: CsvDelimiter
): ParsedFile {
  const format = detectFormat(filename);

  if (format === 'xlsx') {
    const { headers, rows } = parseXlsx(buffer);
    return {
      headers,
      rows,
      format: 'xlsx',
      delimiter: null,
      encoding: 'binary',
      totalRows: rows.length,
      filename,
    };
  }

  // CSV
  const { text, encoding } = decodeBuffer(buffer);
  const delimiter = forcedDelimiter ?? detectCsvDelimiter(text);
  const { headers, rows } = parseCsv(text, delimiter);
  return {
    headers,
    rows,
    format: 'csv',
    delimiter,
    encoding,
    totalRows: rows.length,
    filename,
  };
}
