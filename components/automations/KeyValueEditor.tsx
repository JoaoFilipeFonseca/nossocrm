'use client';

/**
 * KeyValueEditor — editor de pares chave/valor (ex: cabeçalhos HTTP).
 *
 * Sprint 37 Fase 2. Substitui o JSON cru. Grava um objecto { [chave]: valor }
 * (formato inalterado; action.http_request já consome `headers`).
 */

import { useEffect, useRef, useState } from 'react';

type Pair = { k: string; v: string };

export interface KeyValueEditorProps {
  value: Record<string, unknown> | undefined;
  onChange: (next: Record<string, string> | undefined) => void;
}

function toPairs(value: Record<string, unknown> | undefined): Pair[] {
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length > 0) return entries.map(([k, v]) => ({ k, v: String(v ?? '') }));
  }
  return [{ k: '', v: '' }];
}

function buildObject(pairs: Pair[]): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const { k, v } of pairs) {
    if (k.trim()) obj[k.trim()] = v;
  }
  return obj;
}

export function KeyValueEditor({ value, onChange }: KeyValueEditorProps) {
  const [pairs, setPairs] = useState<Pair[]>(() => toPairs(value));
  const lastEmitted = useRef<string>(JSON.stringify(value ?? {}));

  // Reseed quando o valor muda por fora (ex: seleccionar outro nó).
  useEffect(() => {
    const incoming = JSON.stringify(value ?? {});
    if (incoming !== lastEmitted.current) {
      setPairs(toPairs(value));
      lastEmitted.current = incoming;
    }
  }, [value]);

  const emit = (next: Pair[]) => {
    setPairs(next);
    const obj = buildObject(next);
    lastEmitted.current = JSON.stringify(obj);
    onChange(Object.keys(obj).length > 0 ? obj : undefined);
  };

  return (
    <div className="mt-0.5 space-y-1">
      {pairs.map((p, i) => (
        <div key={i} className="flex gap-1">
          <input
            type="text"
            aria-label={`chave ${i + 1}`}
            value={p.k}
            placeholder="chave"
            onChange={(e) => emit(pairs.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))}
            className="w-1/3 rounded border border-slate-300 px-2 py-1 text-xs font-mono"
          />
          <input
            type="text"
            aria-label={`valor ${i + 1}`}
            value={p.v}
            placeholder="valor"
            onChange={(e) => emit(pairs.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))}
            className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs font-mono"
          />
          <button
            type="button"
            aria-label={`remover linha ${i + 1}`}
            onClick={() => emit(pairs.length > 1 ? pairs.filter((_, j) => j !== i) : [{ k: '', v: '' }])}
            className="px-2 text-slate-400 hover:text-red-600"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setPairs([...pairs, { k: '', v: '' }])}
        className="text-[11px] font-medium text-violet-700 hover:text-violet-900"
      >
        ＋ adicionar linha
      </button>
    </div>
  );
}
