'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

export interface CommentDTO {
  id: string;
  body: string;
  createdAt: string;
  authorId: string | null;
  authorName: string;
}

interface ContactCommentsProps {
  contactId: string;
  initialComments: CommentDTO[];
  currentUserId: string | null;
}

function initials(name: string): string {
  return (name || '?').trim().charAt(0).toUpperCase();
}

function formatPtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-PT', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Lisbon',
  });
}

export function ContactComments({ contactId, initialComments, currentUserId }: ContactCommentsProps) {
  const router = useRouter();
  const [body, setBody] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async () => {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/contacts/${contactId}/comments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: text }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error || 'Falha ao comentar.');
      }
      setBody('');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao comentar.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (commentId: string) => {
    setBusy(true);
    try {
      await fetch(`/api/contacts/${contactId}/comments?commentId=${commentId}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm p-5">
      <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3">Comentários</h2>

      {initialComments.length > 0 ? (
        <div className="space-y-3 mb-4">
          {initialComments.map((c) => (
            <div key={c.id} className="flex gap-3 group">
              <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-200 flex items-center justify-center text-xs font-bold shrink-0">
                {initials(c.authorName)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-slate-500 flex items-center gap-2">
                  <b className="text-slate-700 dark:text-slate-200">{c.authorName}</b>
                  <span>· {formatPtDateTime(c.createdAt)}</span>
                  {currentUserId && c.authorId === currentUserId && (
                    <button
                      onClick={() => remove(c.id)}
                      disabled={busy}
                      aria-label="Eliminar comentário"
                      className="ml-auto text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <div className="text-sm text-slate-700 dark:text-slate-300 mt-0.5 whitespace-pre-wrap break-words">{c.body}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400 mb-4">Sem comentários ainda.</p>
      )}

      {error && <p className="text-xs text-rose-600 mb-2">{error}</p>}

      <div className="flex flex-col sm:flex-row gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit();
          }}
          placeholder="Escrever um comentário..."
          rows={2}
          className="flex-1 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 resize-y"
        />
        <button
          onClick={submit}
          disabled={busy || !body.trim()}
          className="px-3 py-2 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-500 disabled:opacity-50 self-end sm:self-stretch"
        >
          {busy ? 'A enviar...' : 'Comentar'}
        </button>
      </div>
    </div>
  );
}
