'use client';

import React, { useMemo, useRef, useState } from 'react';
import { X, Upload, Lightbulb, Bookmark, PenLine, Home, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ImovelSearchCombobox, imovelLabel, type ImovelLite } from '@/components/ui/ImovelSearchCombobox';
import {
  CREATIVE_TYPES,
  TYPE_LABELS,
  type CreativeType,
  defaultTypeForMime,
  uploadKindForMime,
  UPLOAD_ALLOWED_TYPES,
  UPLOAD_MAX_BYTES,
} from '@/lib/criativos/shared';

export type AddMode = 'file' | 'idea' | 'reference' | 'text';

export const ADD_MODE_META: Record<AddMode, { title: string; hint: string; icon: React.ComponentType<{ className?: string; size?: number }> }> = {
  file: { title: 'Carregar ficheiro', hint: 'Imagem, PDF ou vídeo que já tem. Fica guardado no cofre privado da biblioteca.', icon: Upload },
  idea: { title: 'Nova ideia ou nota', hint: 'Só texto. Uma ideia é uma peça como as outras: pesquisável, com tags, nunca se perde.', icon: Lightbulb },
  reference: { title: 'Guardar referência', hint: 'Algo de fora que inspira: um anúncio que funcionou, um post, um ângulo. Com ou sem ficheiro.', icon: Bookmark },
  text: { title: 'Texto manual', hint: 'Um texto seu: email, post, descrição, script. Entra na biblioteca como peça criada.', icon: PenLine },
};

/** Tipos oferecidos ao escrever texto manual (os tipos de texto). */
const TEXT_TYPES: CreativeType[] = ['social_post', 'organic_post', 'email', 'whatsapp', 'sms', 'ad_copy', 'imovel_description', 'blog_article', 'sales_script', 'proposal', 'briefing'];

interface Props {
  mode: AddMode;
  onClose: () => void;
  onSaved: () => void;
}

export const AddPieceModal: React.FC<Props> = ({ mode, onClose, onSaved }) => {
  const meta = ADD_MODE_META[mode];
  const Icon = meta.icon;
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<CreativeType>(mode === 'reference' ? 'reference' : mode === 'idea' ? 'idea' : 'social_post');
  const [typeTouched, setTypeTouched] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [imovel, setImovel] = useState<ImovelLite | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsFile = mode === 'file';
  const allowsFile = mode === 'file' || mode === 'reference';
  const needsContent = mode === 'idea' || mode === 'text' || (mode === 'reference' && !file);

  const typeOptions = useMemo<CreativeType[]>(() => {
    if (mode === 'idea') return ['idea'];
    if (mode === 'text') return TEXT_TYPES;
    if (mode === 'reference') return ['reference'];
    return CREATIVE_TYPES.filter((t) => t !== 'idea');
  }, [mode]);

  const pickFile = (f: File | null) => {
    setError(null);
    if (!f) { setFile(null); return; }
    const kind = uploadKindForMime(f.type);
    if (!kind) { setError(`Tipo de ficheiro não suportado: ${f.type || f.name}`); return; }
    if (f.size > UPLOAD_MAX_BYTES[kind]) {
      setError(`O ficheiro excede o limite de ${Math.round(UPLOAD_MAX_BYTES[kind] / (1024 * 1024))}MB`);
      return;
    }
    setFile(f);
    if (mode === 'file' && !typeTouched) setType(defaultTypeForMime(f.type));
  };

  const submit = async () => {
    setError(null);
    if (needsFile && !file) { setError('Escolha um ficheiro.'); return; }
    if (needsContent && !content.trim()) { setError(mode === 'idea' ? 'Escreva a ideia.' : 'Escreva o texto.'); return; }
    if ((mode === 'idea' || mode === 'text') && !title.trim()) { setError('Dê um título à peça.'); return; }

    setSaving(true);
    try {
      let res: Response;
      if (file) {
        const fd = new FormData();
        fd.set('file', file);
        fd.set('type', type);
        fd.set('origin', mode === 'reference' ? 'reference' : 'imported');
        if (title.trim()) fd.set('title', title.trim());
        if (content.trim()) fd.set('content', content.trim());
        if (tags.trim()) fd.set('tags', tags);
        if (imovel) fd.set('imovel_id', imovel.id);
        res = await fetch('/api/criativos/upload', { method: 'POST', body: fd });
      } else {
        res = await fetch('/api/criativos', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            type,
            origin: mode === 'reference' ? 'reference' : 'created',
            title: title.trim() || null,
            content: content.trim(),
            tags: tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 12),
            imovel_id: imovel?.id ?? null,
            status: 'draft',
          }),
        });
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || 'Não foi possível guardar.');
        return;
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Não foi possível guardar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-6" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 w-full md:max-w-lg rounded-t-2xl md:rounded-2xl border border-slate-200 dark:border-white/10 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/10 p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className="h-5 w-5 text-primary-600 shrink-0" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white truncate">{meta.title}</h2>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="p-4 space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">{meta.hint}</p>

          {allowsFile && (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Ficheiro {mode === 'reference' ? '(opcional)' : ''}
              </label>
              <input
                ref={fileRef}
                type="file"
                accept={UPLOAD_ALLOWED_TYPES.join(',')}
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full border border-dashed border-slate-300 dark:border-white/15 rounded-xl p-4 text-sm text-slate-500 dark:text-slate-400 hover:border-primary-400 hover:text-primary-600 transition-colors flex items-center justify-center gap-2"
              >
                {file ? (<><FileText className="h-4 w-4" /> {file.name} · {(file.size / (1024 * 1024)).toFixed(1)}MB</>) : (<><Upload className="h-4 w-4" /> Escolher ficheiro (imagem, PDF ou vídeo)</>)}
              </button>
            </div>
          )}

          {typeOptions.length > 1 && (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Tipo</label>
              <select
                value={type}
                onChange={(e) => { setType(e.target.value as CreativeType); setTypeTouched(true); }}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100"
              >
                {typeOptions.map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Título {mode === 'file' ? '(opcional, por omissão o nome do ficheiro)' : ''}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={mode === 'idea' ? 'Ex.: Série "mitos de quem vende casa"' : 'Título da peça'}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              {mode === 'idea' ? 'A ideia' : mode === 'reference' ? 'O que há a aprender (opcional se carregar ficheiro)' : mode === 'text' ? 'O texto' : 'Nota (opcional)'}
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={mode === 'text' ? 7 : 4}
              placeholder={mode === 'reference' ? 'Ex.: falar do bairro primeiro, casa depois' : ''}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Tags (separadas por vírgula)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="lançamento, paços"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Imóvel ligado (opcional)</label>
            {imovel ? (
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200"><Home className="h-4 w-4 text-slate-400" /> {imovelLabel(imovel)}</span>
                <button type="button" onClick={() => setImovel(null)} className="text-xs text-rose-600 hover:text-rose-700">Desligar</button>
              </div>
            ) : (
              <ImovelSearchCombobox onSelect={setImovel} />
            )}
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-sm text-rose-700 dark:text-rose-200">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/10">
            <Button size="sm" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button size="sm" onClick={submit} disabled={saving}>
              {saving ? 'A guardar…' : 'Guardar na biblioteca'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
