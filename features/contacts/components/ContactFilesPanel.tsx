'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, FileText, Image as ImageIcon, Trash2, Download, Loader2 } from 'lucide-react';
import {
    listContactFiles,
    uploadContactFile,
    deleteContactFile,
    getContactFileSignedUrl,
    CATEGORY_LABELS,
    type ContactFile,
    type ContactFileCategory,
} from '@/lib/supabase/contactFiles';

interface ContactFilesPanelProps {
    contactId: string;
    organizationId: string;
}

const FILE_ICON_MAP: Record<string, typeof FileText> = {
    'application/pdf': FileText,
    'image/jpeg': ImageIcon,
    'image/png': ImageIcon,
    'image/webp': ImageIcon,
    'image/gif': ImageIcon,
};

function formatBytes(bytes: number | null): string {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function ContactFilesPanel({ contactId, organizationId }: ContactFilesPanelProps) {
    const [files, setFiles] = useState<ContactFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<ContactFileCategory>('outro');
    const [filterCategory, setFilterCategory] = useState<'all' | ContactFileCategory>('all');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadFiles = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await listContactFiles(contactId);
            setFiles(data);
        } catch (e: any) {
            setError(e?.message || 'Erro ao carregar ficheiros');
        } finally {
            setLoading(false);
        }
    }, [contactId]);

    useEffect(() => {
        if (contactId) loadFiles();
    }, [contactId, loadFiles]);

    const handleUpload = async (selected: FileList | null) => {
        if (!selected || selected.length === 0) return;
        setError(null);
        setUploading(true);
        try {
            for (const file of Array.from(selected)) {
                await uploadContactFile(contactId, organizationId, file, selectedCategory);
            }
            await loadFiles();
        } catch (e: any) {
            setError(e?.message || 'Erro ao enviar ficheiro');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDownload = async (file: ContactFile) => {
        try {
            const url = await getContactFileSignedUrl(file.file_path);
            window.open(url, '_blank');
        } catch (e: any) {
            setError(e?.message || 'Erro ao gerar link de download');
        }
    };

    const handleDelete = async (file: ContactFile) => {
        if (!confirm(`Apagar ${file.file_name}? Esta acção não pode ser desfeita.`)) return;
        try {
            await deleteContactFile(file.id, file.file_path);
            await loadFiles();
        } catch (e: any) {
            setError(e?.message || 'Erro ao apagar ficheiro');
        }
    };

    const filteredFiles = filterCategory === 'all'
        ? files
        : files.filter(f => f.category === filterCategory);

    return (
        <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                        📂 Documentos do Contacto
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Caderneta, CC, certificados, fotos do imóvel — guardados para sempre.
                    </p>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                    {files.length} ficheiro{files.length !== 1 ? 's' : ''}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5">
                <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Categoria do upload
                    </label>
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value as ContactFileCategory)}
                        className="w-full px-3 py-2 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                    >
                        {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                            <option key={k} value={k} className="bg-white dark:bg-slate-800">{label}</option>
                        ))}
                    </select>
                </div>
                <div className="flex items-end">
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium transition-colors"
                    >
                        {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> A enviar...</> : <><Upload className="w-4 h-4" /> Carregar ficheiro</>}
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="application/pdf,image/*"
                        onChange={(e) => handleUpload(e.target.files)}
                        className="hidden"
                    />
                </div>
            </div>

            <div>
                <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value as any)}
                    className="text-xs px-2 py-1 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                    <option value="all" className="bg-white dark:bg-slate-800">Todas as categorias</option>
                    {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                        <option key={k} value={k} className="bg-white dark:bg-slate-800">{label}</option>
                    ))}
                </select>
            </div>

            {error && (
                <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-8 text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> A carregar...
                </div>
            ) : filteredFiles.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-white/10 rounded-lg">
                    Sem ficheiros {filterCategory !== 'all' ? `nesta categoria` : 'ainda'}. Carrega o primeiro acima ☝️
                </div>
            ) : (
                <ul className="space-y-2">
                    {filteredFiles.map((f) => {
                        const Icon = FILE_ICON_MAP[f.mime_type || ''] || FileText;
                        return (
                            <li
                                key={f.id}
                                className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                            >
                                <Icon className="w-8 h-8 text-slate-400 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-slate-900 dark:text-white truncate">{f.file_name}</span>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                            {CATEGORY_LABELS[f.category] || f.category}
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        {formatBytes(f.file_size)} • {formatDate(f.created_at)}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleDownload(f)}
                                    className="p-2 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                    aria-label="Descarregar"
                                >
                                    <Download className="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDelete(f)}
                                    className="p-2 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    aria-label="Apagar"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
