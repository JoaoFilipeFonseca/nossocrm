'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Upload, Loader2, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  dealId?: string | null;
  contactId?: string | null;
  onProcessed?: (callId: string) => void;
};

export const CallUploadModal: React.FC<Props> = ({ isOpen, onClose, dealId, contactId, onProcessed }) => {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [stage, setStage] = useState<'idle' | 'uploading' | 'transcribing' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!file) return;
    setError(null);
    setUploading(true);
    setStage('uploading');

    const form = new FormData();
    form.append('audio', file);
    if (dealId) form.append('deal_id', dealId);
    if (contactId) form.append('contact_id', contactId);
    form.append('recorded_at', new Date().toISOString());

    try {
      setStage('transcribing');
      const res = await fetch('/api/calls/upload', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || `Erro ${res.status}`);
        setStage('error');
        return;
      }
      setStage('done');
      onProcessed?.(data.id);
      router.push(`/calls/${data.id}`);
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Falhou o envio');
      setStage('error');
    } finally {
      setUploading(false);
    }
  };

  const sizeMB = file ? (file.size / 1024 / 1024).toFixed(1) : '0';

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-6"
      onClick={() => !uploading && onClose()}
    >
      <div
        className="bg-white dark:bg-slate-900 w-full md:max-w-lg md:rounded-2xl rounded-t-2xl border border-slate-200 dark:border-white/10 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/10 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-primary-600" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Adicionar chamada</h2>
          </div>
          <button onClick={onClose} disabled={uploading} className="text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="p-4 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Carregue a gravação (voice memo do telemóvel) e a IA vai transcrever, resumir e extrair próximas acções automaticamente.
          </p>

          <div className="border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl p-6 text-center hover:border-primary-400 transition-colors">
            <input
              ref={fileRef}
              type="file"
              accept="audio/mpeg,audio/mp4,audio/m4a,audio/x-m4a,audio/wav,audio/x-wav,audio/webm,audio/ogg,audio/aac,audio/flac,audio/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
              disabled={uploading}
            />
            {!file ? (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full flex flex-col items-center gap-2 text-slate-600 dark:text-slate-300"
              >
                <Upload className="h-8 w-8 text-slate-400" />
                <span className="text-sm">Carregar ficheiro áudio</span>
                <span className="text-xs text-slate-400">m4a, mp3, wav, ogg, webm (até 100 MB)</span>
              </button>
            ) : (
              <div className="space-y-2">
                <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{file.name}</div>
                <div className="text-xs text-slate-500">{sizeMB} MB · {file.type || 'audio'}</div>
                <button
                  onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }}
                  disabled={uploading}
                  className="text-xs text-slate-500 hover:text-rose-500 underline-offset-2 hover:underline"
                >
                  remover
                </button>
              </div>
            )}
          </div>

          {stage === 'uploading' && (
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin" /> A enviar áudio…
            </div>
          )}
          {stage === 'transcribing' && (
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin" /> A transcrever e analisar com IA, isto demora 20 a 60 segundos…
            </div>
          )}
          {error && (
            <div className="text-sm rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-200 p-3">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/10">
            <Button variant="outline" onClick={onClose} disabled={uploading}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!file || uploading}>
              {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              {uploading ? 'A processar…' : 'Processar com IA'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
