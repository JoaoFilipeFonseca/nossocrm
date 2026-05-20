import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseImportFile } from '@/lib/contacts/import/parseFile';
import { suggestMapping } from '@/lib/contacts/import/mapping';
import type { CsvDelimiter } from '@/lib/utils/csv';

export const maxDuration = 60;

/**
 * POST /api/contacts/import/preview
 *
 * Recebe um ficheiro (CSV ou XLSX) via multipart/form-data e devolve um preview
 * estruturado para o wizard de import:
 *  - headers detectados
 *  - até 20 linhas de exemplo
 *  - mapeamento sugerido (header CSV → campo interno do contacto)
 *  - meta: total de linhas, formato, delimitador (se CSV), encoding
 *
 * Não toca na BD. Apenas valida que o utilizador está autenticado para evitar
 * abuso da endpoint.
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get('file');
    const delimiterRaw = form.get('delimiter');

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Ficheiro não enviado (campo "file" em multipart/form-data).' },
        { status: 400 }
      );
    }

    const forcedDelimiter: CsvDelimiter | undefined =
      delimiterRaw === ',' || delimiterRaw === ';' || delimiterRaw === '\t'
        ? (delimiterRaw as CsvDelimiter)
        : undefined;

    const buffer = await file.arrayBuffer();
    const parsed = parseImportFile(buffer, file.name, forcedDelimiter);

    if (!parsed.headers.length) {
      return NextResponse.json(
        { error: 'Ficheiro sem cabeçalho detectado. Verifique se a primeira linha tem nomes de colunas.' },
        { status: 400 }
      );
    }

    const sampleRows = parsed.rows.slice(0, 20);
    const suggested = suggestMapping(parsed.headers);

    return NextResponse.json({
      ok: true,
      filename: parsed.filename,
      format: parsed.format,
      delimiter: parsed.delimiter,
      encoding: parsed.encoding,
      totalRows: parsed.totalRows,
      headers: parsed.headers,
      sampleRows,
      suggestedMapping: suggested,
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error)?.message || 'Erro ao processar ficheiro.' },
      { status: 500 }
    );
  }
}
