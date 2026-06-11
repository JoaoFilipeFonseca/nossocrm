'use client';

import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * MKT-BIBLIOTECA Fatia 3 — link da política de privacidade da organização.
 * Aparece no rodapé RGPD de todos os emails de automação (e nos materiais que o citem).
 */
export const PrivacySection: React.FC = () => {
  const [url, setUrl] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'erro'; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings/privacidade', { cache: 'no-store' });
        const data = await res.json();
        if (res.ok) setUrl(data.url ?? '');
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/settings/privacidade', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMsg({ kind: 'erro', text: data?.error || 'Não foi possível guardar.' });
        return;
      }
      setMsg({ kind: 'ok', text: 'Guardado. O rodapé dos emails passa a usar este link.' });
    } catch (e: any) {
      setMsg({ kind: 'erro', text: e?.message || 'Não foi possível guardar.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div id="privacidade" className="mb-12">
      <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary-600" /> Política de privacidade
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Link público da sua política de privacidade. Aparece no rodapé de todos os emails de automação (RGPD).
        </p>
        <div className="flex flex-col md:flex-row gap-2 md:items-center">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://joaofilipefonseca.pt/privacidade"
            disabled={!loaded}
            className="flex-1 max-w-xl px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100"
          />
          <Button size="sm" onClick={save} disabled={saving || !loaded}>
            {saving ? 'A guardar…' : 'Guardar'}
          </Button>
        </div>
        {msg && (
          <p className={`text-xs mt-2 ${msg.kind === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {msg.text}
          </p>
        )}
      </div>
    </div>
  );
};
