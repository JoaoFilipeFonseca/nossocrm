'use client';

/**
 * TextField — input/textarea de texto com botão de inserir variável.
 *
 * Sprint 37 Fase 2. Insere o token {{ … }} na posição do cursor (ou no fim se
 * não houver cursor) e reposiciona o cursor a seguir ao token.
 */

import { useRef } from 'react';
import { VariablePicker } from './VariablePicker';

export interface TextFieldProps {
  value: string;
  onChange: (next: string) => void;
  multiline?: boolean;
  placeholder?: string;
  id?: string;
}

export function TextField({ value, onChange, multiline, placeholder, id }: TextFieldProps) {
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const insert = (token: string) => {
    const el = ref.current;
    const cur = value ?? '';
    const pos = el && typeof el.selectionStart === 'number' ? el.selectionStart : cur.length;
    const next = cur.slice(0, pos) + token + cur.slice(pos);
    onChange(next);
    requestAnimationFrame(() => {
      if (!el) return;
      const p = pos + token.length;
      el.focus();
      try { el.setSelectionRange(p, p); } catch { /* alguns inputs não suportam */ }
    });
  };

  const cls = 'w-full rounded border border-slate-300 px-2 py-1 text-sm font-mono';

  return (
    <div className="mt-0.5">
      <div className="mb-0.5 flex justify-end">
        <VariablePicker onInsert={insert} />
      </div>
      {multiline ? (
        <textarea
          ref={ref as React.RefObject<HTMLTextAreaElement>}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={placeholder ?? 'Suporta {{ variavel }}'}
          className={cls}
        />
      ) : (
        <input
          ref={ref as React.RefObject<HTMLInputElement>}
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? 'Suporta {{ variavel }}'}
          className={cls}
        />
      )}
    </div>
  );
}
