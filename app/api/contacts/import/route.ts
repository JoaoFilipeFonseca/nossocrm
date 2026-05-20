import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { type CsvDelimiter } from '@/lib/utils/csv';
import { normalizePhoneE164 } from '@/lib/phone';
import { parseImportFile } from '@/lib/contacts/import/parseFile';
import {
  buildHeaderIndex,
  normalizeHeader,
  normalizeStage,
  normalizeStatus,
  type ContactField,
} from '@/lib/contacts/import/mapping';

export const maxDuration = 120;

const ImportModeSchema = z.enum(['create_only', 'upsert_by_email', 'skip_duplicates_by_email']);
type ImportMode = z.infer<typeof ImportModeSchema>;

const DedupBySchema = z.enum(['email', 'phone', 'both']);
type DedupBy = z.infer<typeof DedupBySchema>;

const BooleanStringSchema = z
  .string()
  .optional()
  .transform(v => (v ?? '').toLowerCase())
  .transform(v => v === 'true' || v === '1' || v === 'yes' || v === 'on');

type ParsedRow = {
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  role?: string;
  company?: string;
  status?: string;
  stage?: string;
  notes?: string;
};

function getCell(row: string[], idx: number | undefined): string | undefined {
  if (idx === undefined) return undefined;
  const v = row[idx];
  const t = (v ?? '').trim();
  return t ? t : undefined;
}

/**
 * Constrói um índice {ContactField → posição} a partir de um mapping vindo do
 * wizard (formato `Record<ContactField, headerName | null>`). Usa os headers
 * reais do ficheiro para resolver para posições.
 *
 * Devolve null se o mapping fornecido não bater com nenhum header — nesse caso
 * o caller faz fallback para o auto-detect (buildHeaderIndex).
 */
function applyManualMapping(
  headers: string[],
  manual: Record<string, string | null> | undefined | null
): Record<ContactField, number | undefined> | null {
  if (!manual) return null;
  const headerIdx = new Map<string, number>();
  headers.forEach((h, i) => headerIdx.set(normalizeHeader(h), i));

  const out: Record<ContactField, number | undefined> = {
    name: undefined,
    firstName: undefined,
    lastName: undefined,
    email: undefined,
    phone: undefined,
    role: undefined,
    company: undefined,
    status: undefined,
    stage: undefined,
    notes: undefined,
  };
  let anyMatch = false;
  for (const [field, headerName] of Object.entries(manual) as Array<[ContactField, string | null]>) {
    if (!headerName) continue;
    const pos = headerIdx.get(normalizeHeader(headerName));
    if (pos !== undefined && field in out) {
      out[field] = pos;
      anyMatch = true;
    }
  }
  return anyMatch ? out : null;
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    const modeRaw = form.get('mode');
    const delimiterRaw = form.get('delimiter');
    const sourceLabelRaw = form.get('sourceLabel');
    const dedupByRaw = form.get('dedupBy');
    const mappingRaw = form.get('mapping');
    const createCompanies = BooleanStringSchema.parse(String(form.get('createCompanies') ?? 'true'));

    const modeResult = ImportModeSchema.safeParse(String(modeRaw ?? 'upsert_by_email'));
    if (!modeResult.success) {
      return NextResponse.json({ error: 'Parâmetro mode inválido.' }, { status: 400 });
    }
    const mode: ImportMode = modeResult.data;

    const dedupResult = DedupBySchema.safeParse(String(dedupByRaw ?? 'both'));
    const dedupBy: DedupBy = dedupResult.success ? dedupResult.data : 'both';

    const sourceLabel = sourceLabelRaw ? String(sourceLabelRaw).trim().slice(0, 80) : null;

    let manualMapping: Record<string, string | null> | null = null;
    if (mappingRaw) {
      try {
        manualMapping = JSON.parse(String(mappingRaw));
      } catch {
        return NextResponse.json({ error: 'Parâmetro mapping não é JSON válido.' }, { status: 400 });
      }
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Ficheiro não enviado (campo "file").' }, { status: 400 });
    }

    const forcedDelimiter: CsvDelimiter | undefined =
      delimiterRaw === ',' || delimiterRaw === ';' || delimiterRaw === '\t'
        ? (delimiterRaw as CsvDelimiter)
        : undefined;

    const buffer = await file.arrayBuffer();
    const parsed = parseImportFile(buffer, file.name, forcedDelimiter);
    const { headers, rows } = parsed;

    if (!headers.length) {
      return NextResponse.json({ error: 'Ficheiro sem cabeçalho.' }, { status: 400 });
    }

    // Mapping: usar manual se fornecido e válido, senão fallback auto-detect
    const mapping = applyManualMapping(headers, manualMapping) ?? buildHeaderIndex(headers);

    // Parse rows
    const parsedRows: Array<{ rowNumber: number; data: ParsedRow }> = [];
    const errors: Array<{ rowNumber: number; message: string }> = [];

    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i];
      const rowNumber = i + 2; // +1 header, +1 1-indexed

      const firstName = getCell(r, mapping.firstName);
      const lastName = getCell(r, mapping.lastName);
      const name = getCell(r, mapping.name);
      const email = getCell(r, mapping.email);
      const phone = getCell(r, mapping.phone);

      const computedName =
        firstName || lastName
          ? [firstName, lastName].filter(Boolean).join(' ').trim()
          : name;

      if (!computedName && !email && !phone) {
        errors.push({
          rowNumber,
          message: 'Linha sem nome, email e telemóvel (não consigo criar contacto).',
        });
        continue;
      }

      parsedRows.push({
        rowNumber,
        data: {
          name: computedName,
          email,
          phone,
          role: getCell(r, mapping.role),
          company: getCell(r, mapping.company),
          status: normalizeStatus(getCell(r, mapping.status)),
          stage: normalizeStage(getCell(r, mapping.stage)),
          notes: getCell(r, mapping.notes),
        },
      });
    }

    if (!parsedRows.length) {
      return NextResponse.json(
        { error: 'Nenhuma linha válida para importar.', errors },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.organization_id) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const orgId = profile.organization_id;

    // ── Companies: preload + opcionalmente criar em falta ─────────────────────
    const { data: companies, error: companiesError } = await supabase
      .from('crm_companies')
      .select('id,name')
      .eq('organization_id', orgId)
      .is('deleted_at', null);

    if (companiesError) {
      return NextResponse.json({ error: companiesError.message }, { status: 400 });
    }

    const companyIdByName = new Map<string, string>();
    for (const c of (companies || []) as Array<{ id: string; name: string }>) {
      if (c?.id && c?.name) companyIdByName.set(normalizeHeader(c.name), c.id);
    }

    const missingCompanies = new Set<string>();
    if (createCompanies) {
      for (const p of parsedRows) {
        const companyName = (p.data.company || '').trim();
        if (!companyName) continue;
        const key = normalizeHeader(companyName);
        if (!companyIdByName.has(key)) missingCompanies.add(companyName);
      }
    }

    if (createCompanies && missingCompanies.size) {
      const payload = Array.from(missingCompanies).map(name => ({ name, organization_id: orgId }));
      const { data: createdCompanies, error: createCompaniesError } = await supabase
        .from('crm_companies')
        .insert(payload)
        .select('id,name');

      if (createCompaniesError) {
        return NextResponse.json({ error: createCompaniesError.message }, { status: 400 });
      }
      for (const c of (createdCompanies || []) as Array<{ id: string; name: string }>) {
        if (c?.id && c?.name) companyIdByName.set(normalizeHeader(c.name), c.id);
      }
    }

    // ── Pré-fetch existing por email + telemóvel (E.164) para dedup ────────
    const dedupOnEmail = dedupBy === 'email' || dedupBy === 'both';
    const dedupOnPhone = dedupBy === 'phone' || dedupBy === 'both';

    const emails = Array.from(
      new Set(
        parsedRows
          .map(p => (p.data.email || '').trim().toLowerCase())
          .filter(Boolean)
      )
    );
    const phonesE164 = Array.from(
      new Set(
        parsedRows
          .map(p => (p.data.phone ? normalizePhoneE164(p.data.phone) : ''))
          .filter(Boolean)
      )
    );

    const contactIdsByEmail = new Map<string, string[]>();
    const contactIdsByPhone = new Map<string, string[]>();

    const chunkSize = 500;
    if (dedupOnEmail && emails.length) {
      for (let i = 0; i < emails.length; i += chunkSize) {
        const chunk = emails.slice(i, i + chunkSize);
        const { data: existing, error: existingError } = await supabase
          .from('contacts')
          .select('id,email')
          .eq('organization_id', orgId)
          .in('email', chunk)
          .is('deleted_at', null);
        if (existingError) {
          return NextResponse.json({ error: existingError.message }, { status: 400 });
        }
        for (const c of (existing || []) as Array<{ id: string; email: string | null }>) {
          const em = (c.email || '').toLowerCase().trim();
          if (!em) continue;
          const arr = contactIdsByEmail.get(em) || [];
          arr.push(c.id);
          contactIdsByEmail.set(em, arr);
        }
      }
    }

    if (dedupOnPhone && phonesE164.length) {
      for (let i = 0; i < phonesE164.length; i += chunkSize) {
        const chunk = phonesE164.slice(i, i + chunkSize);
        const { data: existing, error: existingError } = await supabase
          .from('contacts')
          .select('id,phone')
          .eq('organization_id', orgId)
          .in('phone', chunk)
          .is('deleted_at', null);
        if (existingError) {
          return NextResponse.json({ error: existingError.message }, { status: 400 });
        }
        for (const c of (existing || []) as Array<{ id: string; phone: string | null }>) {
          const ph = (c.phone || '').trim();
          if (!ph) continue;
          const arr = contactIdsByPhone.get(ph) || [];
          arr.push(c.id);
          contactIdsByPhone.set(ph, arr);
        }
      }
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    // Dedup intra-CSV: chaves já vistas no batch corrente. Garante que se duas
    // linhas do mesmo ficheiro têm o mesmo telemóvel ou email, só a primeira
    // é importada (as restantes contam como skipped).
    const seenPhonesInBatch = new Set<string>();
    const seenEmailsInBatch = new Set<string>();

    const insertBatch: Array<{ rowNumber: number; payload: Record<string, unknown> }> = [];
    const flushInsert = async () => {
      if (!insertBatch.length) return;
      const payloads = insertBatch.map(i => i.payload);
      const { error: insertError } = await supabase.from('contacts').insert(payloads);
      if (insertError) {
        for (const item of insertBatch) {
          errors.push({ rowNumber: item.rowNumber, message: insertError.message });
        }
      } else {
        created += insertBatch.length;
      }
      insertBatch.length = 0;
    };

    for (const p of parsedRows) {
      const rowNumber = p.rowNumber;
      const email = (p.data.email || '').trim().toLowerCase();
      const phoneE164 = p.data.phone ? normalizePhoneE164(p.data.phone) : '';
      const companyName = (p.data.company || '').trim();
      const companyId = companyName ? companyIdByName.get(normalizeHeader(companyName)) : undefined;

      const base: Record<string, unknown> = {
        name: p.data.name || '',
        email: p.data.email || null,
        phone: phoneE164 || null,
        role: p.data.role || null,
        client_company_id: companyId || null,
        notes: p.data.notes || null,
        status: p.data.status || 'ACTIVE',
        stage: p.data.stage || 'LEAD',
        organization_id: orgId,
        updated_at: new Date().toISOString(),
      };
      if (sourceLabel) base.source = sourceLabel;

      // Match priority: phone (E.164) > email (telefone é identificador mais único)
      const phoneMatches = dedupOnPhone && phoneE164 ? contactIdsByPhone.get(phoneE164) || [] : [];
      const emailMatches = dedupOnEmail && email ? contactIdsByEmail.get(email) || [] : [];
      const existingIds = phoneMatches.length ? phoneMatches : emailMatches;

      // Dedup intra-batch: se outra linha do mesmo CSV já reservou este
      // telemóvel ou email, esta passa a skipped (excepto em create_only).
      if (mode !== 'create_only') {
        const dupInBatch =
          (dedupOnPhone && phoneE164 && seenPhonesInBatch.has(phoneE164)) ||
          (dedupOnEmail && email && seenEmailsInBatch.has(email));
        if (dupInBatch) {
          skipped += 1;
          continue;
        }
      }

      if (mode === 'create_only') {
        if (phoneE164) seenPhonesInBatch.add(phoneE164);
        if (email) seenEmailsInBatch.add(email);
        insertBatch.push({ rowNumber, payload: base });
        if (insertBatch.length >= 200) await flushInsert();
        continue;
      }

      if (mode === 'skip_duplicates_by_email' && existingIds.length > 0) {
        skipped += 1;
        continue;
      }

      if (mode === 'upsert_by_email' && existingIds.length > 0) {
        if (existingIds.length > 1) {
          errors.push({
            rowNumber,
            message: `Telemóvel/email duplicado no CRM (${existingIds.length} registos). Importação ambígua.`,
          });
          continue;
        }
        const id = existingIds[0];
        const { error: updateError } = await supabase.from('contacts').update(base).eq('id', id);
        if (updateError) {
          errors.push({ rowNumber, message: updateError.message });
        } else {
          updated += 1;
          if (phoneE164) seenPhonesInBatch.add(phoneE164);
          if (email) seenEmailsInBatch.add(email);
        }
        continue;
      }

      // No match: create
      if (phoneE164) seenPhonesInBatch.add(phoneE164);
      if (email) seenEmailsInBatch.add(email);
      insertBatch.push({ rowNumber, payload: base });
      if (insertBatch.length >= 200) await flushInsert();
    }

    await flushInsert();

    return NextResponse.json({
      ok: true,
      format: parsed.format,
      delimiter: parsed.delimiter,
      encoding: parsed.encoding,
      mode,
      dedupBy,
      sourceLabel,
      totals: {
        rows: rows.length,
        parsed: parsedRows.length,
        created,
        updated,
        skipped,
        errors: errors.length,
      },
      errors,
      detectedHeaders: headers,
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error)?.message || 'Erro inesperado' },
      { status: 500 }
    );
  }
}
