import React, { useEffect, useMemo, useState } from 'react';
import { Upload, ArrowLeft, ArrowRight, CheckCircle2, FileText } from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import {
  CONTACT_FIELDS,
  CONTACT_FIELD_LABELS,
  type ContactField,
} from '@/lib/contacts/import/mapping';

type PreviewResponse = {
  ok: true;
  filename: string;
  format: 'csv' | 'xlsx';
  delimiter: ',' | ';' | '\t' | null;
  encoding: 'utf-8' | 'latin1' | 'binary';
  totalRows: number;
  headers: string[];
  sampleRows: string[][];
  suggestedMapping: Record<ContactField, string | null>;
};

type ImportResultTotals = {
  rows: number;
  parsed: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
};

type ImportResult = {
  ok: true;
  totals: ImportResultTotals;
  errors: Array<{ rowNumber: number; message: string }>;
};

type Step = 'upload' | 'map' | 'confirm' | 'done';

type Mode = 'upsert_by_email' | 'skip_duplicates_by_email' | 'create_only';
type DedupBy = 'email' | 'phone' | 'both';

function todayLabel(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `import_${y}-${m}-${day}`;
}

function formatLabel(p: PreviewResponse): string {
  const fmt = p.format.toUpperCase();
  const enc = p.encoding !== 'binary' ? ` · ${p.encoding}` : '';
  const delim =
    p.delimiter === ',' ? ' · vírgula' : p.delimiter === ';' ? ' · ponto-e-vírgula' : p.delimiter === '\t' ? ' · TAB' : '';
  return `${fmt}${delim}${enc} · ${p.totalRows.toLocaleString('pt-PT')} linhas`;
}

export function ImportWizard(props: { onCompleted?: (r: ImportResult) => void }) {
  const { onCompleted } = props;
  const { addToast, showToast } = useToast();
  const toast = addToast || showToast;

  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [delimiter, setDelimiter] = useState<'auto' | ',' | ';' | '\t'>('auto');
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [mapping, setMapping] = useState<Record<ContactField, string | null>>({
    name: null,
    firstName: null,
    lastName: null,
    email: null,
    phone: null,
    role: null,
    company: null,
    status: null,
    stage: null,
    notes: null,
  });

  const [mode, setMode] = useState<Mode>('upsert_by_email');
  const [dedupBy, setDedupBy] = useState<DedupBy>('both');
  const [createCompanies, setCreateCompanies] = useState(true);
  const [sourceLabel, setSourceLabel] = useState<string>(todayLabel());

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    if (preview?.suggestedMapping) setMapping(preview.suggestedMapping);
  }, [preview]);

  const canProceedFromMap = useMemo(() => {
    // É necessário pelo menos uma forma de identificar o contacto: name | email | phone
    return Boolean(mapping.name || mapping.firstName || mapping.lastName || mapping.email || mapping.phone);
  }, [mapping]);

  const handleUpload = async () => {
    if (!file) {
      toast?.('Selecione um ficheiro CSV ou Excel.', 'error');
      return;
    }
    setIsLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (delimiter !== 'auto') fd.append('delimiter', delimiter);

      const res = await fetch('/api/contacts/import/preview', { method: 'POST', body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || `Falha ao processar (HTTP ${res.status})`);
      }
      setPreview(data as PreviewResponse);
      setStep('map');
    } catch (e) {
      toast?.((e as Error)?.message || 'Erro ao processar ficheiro.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!file) return;
    setIsLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('mode', mode);
      fd.append('dedupBy', dedupBy);
      fd.append('createCompanies', String(createCompanies));
      if (delimiter !== 'auto') fd.append('delimiter', delimiter);
      if (sourceLabel.trim()) fd.append('sourceLabel', sourceLabel.trim());
      fd.append('mapping', JSON.stringify(mapping));

      const res = await fetch('/api/contacts/import', { method: 'POST', body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || `Falha ao importar (HTTP ${res.status})`);
      }
      const r = data as ImportResult;
      setResult(r);
      setStep('done');
      const t = r.totals;
      toast?.(
        `Importação concluída: ${t.created} criados, ${t.updated} actualizados, ${t.skipped} ignorados, ${t.errors} erros.`,
        t.errors > 0 ? 'warning' : 'success'
      );
      onCompleted?.(r);
    } catch (e) {
      toast?.((e as Error)?.message || 'Erro ao importar.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/10 p-4 bg-slate-50/50 dark:bg-white/5 space-y-4">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
        <StepBadge active={step === 'upload'} done={step !== 'upload'}>1. Carregar</StepBadge>
        <span className="text-slate-300 dark:text-white/20">›</span>
        <StepBadge active={step === 'map'} done={step === 'confirm' || step === 'done'}>2. Mapear</StepBadge>
        <span className="text-slate-300 dark:text-white/20">›</span>
        <StepBadge active={step === 'confirm'} done={step === 'done'}>3. Confirmar</StepBadge>
      </div>

      {step === 'upload' && (
        <div className="space-y-3">
          <div className="text-sm font-bold text-slate-900 dark:text-white">
            Importar contactos antigos (CSV ou Excel)
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Aceito ficheiros <code>.csv</code>, <code>.xlsx</code> e <code>.xls</code>. Vou pré-visualizar o conteúdo
            e sugerir o mapeamento das colunas antes de gravar.
          </div>

          <input
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-600 dark:text-slate-300"
          />

          {file && (
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <FileText size={14} /> {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleUpload()}
            disabled={!file || isLoading}
            className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${
              !file || isLoading
                ? 'bg-slate-200 dark:bg-white/10 text-slate-400 cursor-not-allowed'
                : 'bg-primary-600 hover:bg-primary-700 text-white'
            }`}
          >
            <ArrowRight size={16} /> {isLoading ? 'A analisar…' : 'Continuar'}
          </button>
        </div>
      )}

      {step === 'map' && preview && (
        <div className="space-y-4">
          <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            Mapear colunas
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
              · {formatLabel(preview)}
            </span>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400">
            Sugeri o mapeamento abaixo. Ajuste se necessário. Pelo menos <b>Nome</b>, <b>Email</b> ou{' '}
            <b>Telemóvel</b> tem que estar mapeado.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {CONTACT_FIELDS.map(field => (
              <label key={field} className="flex items-center gap-2 text-sm">
                <span className="min-w-[130px] text-slate-700 dark:text-slate-200">
                  {CONTACT_FIELD_LABELS[field]}
                </span>
                <select
                  value={mapping[field] ?? ''}
                  onChange={e =>
                    setMapping(m => ({ ...m, [field]: e.target.value || null }))
                  }
                  className="flex-1 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-2 py-1"
                >
                  <option value="">— ignorar —</option>
                  {preview.headers.map(h => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          {/* Preview tabela */}
          <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 overflow-x-auto">
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 px-3 py-2 border-b border-slate-200 dark:border-white/10">
              Pré-visualização (primeiras {preview.sampleRows.length} linhas de{' '}
              {preview.totalRows.toLocaleString('pt-PT')})
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-white/5">
                  {preview.headers.map(h => (
                    <th key={h} className="px-2 py-1.5 text-left font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.sampleRows.map((r, i) => (
                  <tr key={i} className="border-t border-slate-100 dark:border-white/5">
                    {preview.headers.map((_, ci) => (
                      <td key={ci} className="px-2 py-1 text-slate-600 dark:text-slate-300 whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis">
                        {r[ci] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep('upload')}
              className="px-3 py-2 rounded-lg text-sm font-semibold border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-200 flex items-center gap-2"
            >
              <ArrowLeft size={16} /> Voltar
            </button>
            <button
              type="button"
              onClick={() => setStep('confirm')}
              disabled={!canProceedFromMap}
              className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${
                canProceedFromMap
                  ? 'bg-primary-600 hover:bg-primary-700 text-white'
                  : 'bg-slate-200 dark:bg-white/10 text-slate-400 cursor-not-allowed'
              }`}
            >
              Continuar <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {step === 'confirm' && preview && (
        <div className="space-y-4">
          <div className="text-sm font-bold text-slate-900 dark:text-white">
            Confirmar importação
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <label className="space-y-1">
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Etiqueta de origem (preenche o campo <code>source</code> em cada contacto criado)
              </div>
              <input
                type="text"
                value={sourceLabel}
                onChange={e => setSourceLabel(e.target.value)}
                placeholder="import_antigos_2026-05-21"
                className="w-full text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1.5"
              />
            </label>

            <div className="space-y-1">
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Detectar duplicados por
              </div>
              <div className="flex flex-col gap-1 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={dedupBy === 'both'}
                    onChange={() => setDedupBy('both')}
                  />
                  Telemóvel e email (recomendado)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={dedupBy === 'phone'}
                    onChange={() => setDedupBy('phone')}
                  />
                  Só telemóvel
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={dedupBy === 'email'}
                    onChange={() => setDedupBy('email')}
                  />
                  Só email
                </label>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Quando existe duplicado
              </div>
              <div className="flex flex-col gap-1 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={mode === 'upsert_by_email'}
                    onChange={() => setMode('upsert_by_email')}
                  />
                  Actualizar contacto existente (recomendado)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={mode === 'skip_duplicates_by_email'}
                    onChange={() => setMode('skip_duplicates_by_email')}
                  />
                  Ignorar linha
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={mode === 'create_only'}
                    onChange={() => setMode('create_only')}
                  />
                  Criar sempre (pode duplicar)
                </label>
              </div>
            </div>

            <label className="flex items-start gap-2 text-sm self-start mt-1">
              <input
                type="checkbox"
                checked={createCompanies}
                onChange={e => setCreateCompanies(e.target.checked)}
                className="mt-1"
              />
              <span>
                Criar empresas em falta a partir da coluna mapeada como <b>Empresa</b>
              </span>
            </label>
          </div>

          <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
            Vou processar <b>{preview.totalRows.toLocaleString('pt-PT')}</b> linha(s) do ficheiro{' '}
            <b>{preview.filename}</b>. Esta acção grava na base de dados.
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep('map')}
              className="px-3 py-2 rounded-lg text-sm font-semibold border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-200 flex items-center gap-2"
            >
              <ArrowLeft size={16} /> Voltar
            </button>
            <button
              type="button"
              onClick={() => void handleCommit()}
              disabled={isLoading}
              className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${
                isLoading
                  ? 'bg-slate-200 dark:bg-white/10 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              <Upload size={16} /> {isLoading ? 'A importar…' : 'Importar'}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 size={20} />
            <div className="text-sm font-bold">Importação concluída</div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            <Stat label="Criados" value={result.totals.created} tone="positive" />
            <Stat label="Actualizados" value={result.totals.updated} tone="info" />
            <Stat label="Ignorados" value={result.totals.skipped} tone="neutral" />
            <Stat label="Erros" value={result.totals.errors} tone={result.totals.errors > 0 ? 'negative' : 'neutral'} />
          </div>

          {result.errors.length > 0 && (
            <div className="rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50/70 dark:bg-red-500/10 p-3 max-h-48 overflow-y-auto text-xs space-y-1">
              {result.errors.slice(0, 50).map((e, i) => (
                <div key={i} className="text-red-900 dark:text-red-200">
                  Linha {e.rowNumber}: {e.message}
                </div>
              ))}
              {result.errors.length > 50 && (
                <div className="text-red-700 dark:text-red-300 font-semibold">
                  … e mais {result.errors.length - 50} erros
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setStep('upload');
              setFile(null);
              setPreview(null);
              setResult(null);
            }}
            className="px-3 py-2 rounded-lg text-sm font-semibold border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-200"
          >
            Importar outro ficheiro
          </button>
        </div>
      )}
    </div>
  );
}

function StepBadge(props: { active?: boolean; done?: boolean; children: React.ReactNode }) {
  const { active, done, children } = props;
  const cls = active
    ? 'bg-primary-600 text-white'
    : done
    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200'
    : 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400';
  return <span className={`px-2 py-0.5 rounded-full ${cls}`}>{children}</span>;
}

function Stat(props: { label: string; value: number; tone: 'positive' | 'info' | 'neutral' | 'negative' }) {
  const { label, value, tone } = props;
  const color =
    tone === 'positive'
      ? 'text-emerald-700 dark:text-emerald-300'
      : tone === 'info'
      ? 'text-sky-700 dark:text-sky-300'
      : tone === 'negative'
      ? 'text-red-700 dark:text-red-300'
      : 'text-slate-700 dark:text-slate-300';
  return (
    <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 p-2.5">
      <div className={`text-xl font-bold ${color}`}>{value.toLocaleString('pt-PT')}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  );
}
