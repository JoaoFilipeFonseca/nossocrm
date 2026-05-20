import React, { useMemo, useState } from 'react';
import { Download, FileDown } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/context/ToastContext';
import { stringifyCsv, withUtf8Bom, type CsvDelimiter } from '@/lib/utils/csv';
import { ImportWizard } from './ImportWizard';

type Panel = 'export' | 'import';

export type ContactsExportParams = {
  search?: string;
  stage?: string | 'ALL';
  status?: 'ALL' | 'ACTIVE' | 'INACTIVE' | 'CHURNED' | 'RISK';
  dateStart?: string;
  dateEnd?: string;
  sortBy?: 'name' | 'created_at' | 'updated_at' | 'stage';
  sortOrder?: 'asc' | 'desc';
};

function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.target = '_blank';
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);

  try {
    requestAnimationFrame(() => {
      a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    });
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  } finally {
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

function parseFilenameFromDisposition(disposition: string | null): string | null {
  if (!disposition) return null;
  const m = /filename="([^"]+)"/i.exec(disposition);
  return m?.[1] || null;
}

export function ContactsImportExportModal(props: {
  isOpen: boolean;
  onClose: () => void;
  exportParams: ContactsExportParams;
}) {
  const { isOpen, onClose, exportParams } = props;
  const { addToast, showToast } = useToast();
  const toast = addToast || showToast;

  const [panel, setPanel] = useState<Panel>('export');
  const [delimiter, setDelimiter] = useState<'auto' | CsvDelimiter>('auto');

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  const templateCsv = useMemo(() => {
    const d: CsvDelimiter = delimiter === 'auto' ? ';' : delimiter;
    const header = ['name', 'email', 'phone', 'role', 'company', 'status', 'stage', 'notes'];
    const example = [
      'Maria Silva',
      'maria@empresa.pt',
      '+351 912 345 678',
      'Compradora',
      'Empresa Exemplo, Lda.',
      'ACTIVE',
      'LEAD',
      'Conheci num evento',
    ];
    return withUtf8Bom(stringifyCsv([header, example], d));
  }, [delimiter]);

  const handleDownloadTemplate = () => {
    downloadText('template-contactos.csv', templateCsv, 'text/csv;charset=utf-8');
    toast?.('Template CSV descarregado.', 'success');
  };

  const buildExportUrl = () => {
    const sp = new URLSearchParams();
    if (exportParams.search) sp.set('search', exportParams.search);
    if (exportParams.stage && exportParams.stage !== 'ALL') sp.set('stage', exportParams.stage);
    if (exportParams.status && exportParams.status !== 'ALL') sp.set('status', exportParams.status);
    if (exportParams.dateStart) sp.set('dateStart', exportParams.dateStart);
    if (exportParams.dateEnd) sp.set('dateEnd', exportParams.dateEnd);
    if (exportParams.sortBy) sp.set('sortBy', exportParams.sortBy);
    if (exportParams.sortOrder) sp.set('sortOrder', exportParams.sortOrder);
    if (delimiter !== 'auto') sp.set('delimiter', delimiter);
    return `/api/contacts/export?${sp.toString()}`;
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const url = buildExportUrl();
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Falha ao exportar (HTTP ${res.status})`);
      }

      const disposition = res.headers.get('Content-Disposition');
      const filename = parseFilenameFromDisposition(disposition) || 'contactos.csv';
      const text = await res.text();
      downloadText(filename, text, 'text/csv;charset=utf-8');
      toast?.('Export iniciado.', 'success');
    } catch (e) {
      toast?.((e as Error)?.message || 'Erro ao exportar.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Importar / Exportar contactos"
      size="lg"
      bodyClassName="space-y-5 max-h-[75vh] overflow-y-auto"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPanel('export')}
            className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
              panel === 'export'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                : 'bg-white dark:bg-white/5 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10'
            }`}
          >
            Exportar
          </button>
          <button
            type="button"
            onClick={() => setPanel('import')}
            className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
              panel === 'import'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                : 'bg-white dark:bg-white/5 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10'
            }`}
          >
            Importar CSV
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Delimitador
          </label>
          <select
            value={delimiter}
            onChange={e => setDelimiter(e.target.value as any)}
            className="text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-2 py-1"
          >
            <option value="auto">Auto</option>
            <option value=",">, (vírgula)</option>
            <option value=";">; (ponto e vírgula)</option>
            <option value="\t">TAB</option>
          </select>
        </div>
      </div>

      {panel === 'export' && (
        <div className="rounded-xl border border-slate-200 dark:border-white/10 p-4 bg-slate-50/50 dark:bg-white/5 space-y-3">
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              Exportar contactos (CSV)
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Padrão de mercado: exportar a lista respeitando filtros/pesquisa/ordenação actuais.
            </div>
          </div>

          <div className="text-xs text-slate-600 dark:text-slate-300">
            <b>Campos exportados:</b> name, email, phone, role, company, status, stage, notes, created_at, updated_at.
          </div>

          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={isExporting}
            className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${
              isExporting
                ? 'bg-slate-200 dark:bg-white/10 text-slate-400 cursor-not-allowed'
                : 'bg-primary-600 hover:bg-primary-700 text-white'
            }`}
          >
            <FileDown size={16} /> {isExporting ? 'A gerar…' : 'Exportar CSV'}
          </button>
        </div>
      )}

      {panel === 'import' && (
        <div className="space-y-3">
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-2"
            >
              <Download size={14} /> Descarregar template
            </button>
          </div>
          <ImportWizard />
        </div>
      )}
    </Modal>
  );
}

