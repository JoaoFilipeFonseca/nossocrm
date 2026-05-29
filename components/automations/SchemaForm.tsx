'use client';

/**
 * SchemaForm — gera formulário a partir de um JSON Schema simplificado.
 *
 * Sprint 4.0, commit 1.
 *
 * Suporta o subset que os configSchema dos átomos usam:
 *   - string         → <input type="text">  (ou textarea se hint multiline)
 *   - string + enum  → <select>
 *   - integer/number → <input type="number">
 *   - boolean        → <input type="checkbox">
 *   - array (items string) → textarea CSV ("a, b, c")
 *   - object         → textarea JSON cru (fallback genérico)
 *
 * Campos required ficam marcados com *. O onChange recebe o objecto config
 * completo cada vez que algo muda.
 *
 * Variáveis disponíveis no contexto da automação (mostra hint):
 *   {{ contact.id }}, {{ contact.name }}, {{ deal.id }}, {{ deal.value }},
 *   {{ trigger.payload.* }}, {{ nodeId.output.* }}
 */

import { useCallback } from 'react';
import { DurationInput, type BaseUnit } from './DurationInput';

interface FieldSpec {
  type?: string;
  enum?: unknown[];
  enumLabels?: string[];
  items?: { type?: string };
  description?: string;
  default?: unknown;
  minimum?: number;
  /** 'duration' → render número + unidade (DurationInput). */
  format?: string;
  /** Unidade base que o átomo consome quando format === 'duration'. */
  unit?: BaseUnit;
}

interface JSONSchema {
  type?: string;
  properties?: Record<string, FieldSpec>;
  required?: string[];
}

export interface SchemaFormProps {
  schema: Record<string, unknown>;
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  /** Mostra texto "Variáveis disponíveis" no fim para guiar o utilizador. */
  showVarsHint?: boolean;
}

function fieldLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
}

function looksMultiline(key: string, spec: FieldSpec): boolean {
  const k = key.toLowerCase();
  if (k.includes('message') || k.includes('text') || k.includes('body') || k.includes('notes') || k.includes('description') || k.includes('prompt') || k.includes('html')) return true;
  if (spec.description && spec.description.length > 60) return true;
  return false;
}

export function SchemaForm({ schema, values, onChange, showVarsHint }: SchemaFormProps) {
  const s = schema as JSONSchema;
  const props = s.properties ?? {};
  const required = new Set(s.required ?? []);

  const update = useCallback((key: string, value: unknown) => {
    const next = { ...values };
    if (value === '' || value === null || value === undefined) {
      delete next[key];
    } else {
      next[key] = value;
    }
    onChange(next);
  }, [values, onChange]);

  if (Object.keys(props).length === 0) {
    return <p className="text-xs text-slate-400 italic">Este átomo não tem campos para configurar.</p>;
  }

  return (
    <div className="space-y-2.5">
      {Object.entries(props).map(([key, spec]) => {
        const isReq = required.has(key);
        const v = values[key];
        const label = (
          <span className="text-[11px] font-medium text-slate-700">
            {fieldLabel(key)}{isReq ? <span className="text-red-500"> *</span> : null}
            {spec.description ? <span className="ml-1 text-[10px] text-slate-400 font-normal">— {spec.description}</span> : null}
          </span>
        );

        // duração (número + unidade) — grava na unidade base do átomo
        if (spec.format === 'duration') {
          return (
            <label key={key} className="block">
              {label}
              <DurationInput
                value={typeof v === 'number' ? v : undefined}
                base={spec.unit ?? 'seconds'}
                onChange={(next) => update(key, next)}
              />
            </label>
          );
        }

        // string + enum
        if (spec.type === 'string' && Array.isArray(spec.enum)) {
          return (
            <label key={key} className="block">
              {label}
              <select
                value={typeof v === 'string' ? v : ''}
                onChange={(e) => update(key, e.target.value)}
                className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm bg-white"
              >
                <option value="">— escolhe —</option>
                {spec.enum.map((opt) => (
                  <option key={String(opt)} value={String(opt)}>{String(opt)}</option>
                ))}
              </select>
            </label>
          );
        }

        // boolean
        if (spec.type === 'boolean') {
          return (
            <label key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(v)}
                onChange={(e) => update(key, e.target.checked)}
              />
              {label}
            </label>
          );
        }

        // integer / number
        if (spec.type === 'integer' || spec.type === 'number') {
          return (
            <label key={key} className="block">
              {label}
              <input
                type="number"
                value={typeof v === 'number' ? v : typeof v === 'string' ? v : ''}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '') update(key, undefined);
                  else update(key, spec.type === 'integer' ? parseInt(raw, 10) : parseFloat(raw));
                }}
                className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              />
            </label>
          );
        }

        // array of strings
        if (spec.type === 'array') {
          const arrVal = Array.isArray(v) ? (v as unknown[]).map(String).join(', ') : '';
          return (
            <label key={key} className="block">
              {label}
              <input
                type="text"
                value={arrVal}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw.trim() === '') update(key, undefined);
                  else update(key, raw.split(',').map((s) => s.trim()).filter(Boolean));
                }}
                placeholder="separa por vírgulas"
                className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm font-mono"
              />
            </label>
          );
        }

        // object — JSON cru
        if (spec.type === 'object') {
          const jsonVal = v && typeof v === 'object' ? JSON.stringify(v, null, 2) : '';
          return (
            <label key={key} className="block">
              {label}
              <textarea
                value={jsonVal}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw.trim() === '') { update(key, undefined); return; }
                  try { update(key, JSON.parse(raw)); }
                  catch { /* ignora até ser válido */ }
                }}
                rows={3}
                placeholder='{ "chave": "valor" }'
                className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs font-mono"
              />
            </label>
          );
        }

        // string (default)
        const multiline = looksMultiline(key, spec);
        return (
          <label key={key} className="block">
            {label}
            {multiline ? (
              <textarea
                value={typeof v === 'string' ? v : ''}
                onChange={(e) => update(key, e.target.value)}
                rows={3}
                className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm font-mono"
                placeholder='Suporta {{ variavel }}'
              />
            ) : (
              <input
                type="text"
                value={typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v)}
                onChange={(e) => update(key, e.target.value)}
                className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm font-mono"
                placeholder='Suporta {{ variavel }}'
              />
            )}
          </label>
        );
      })}

      {showVarsHint ? (
        <details className="text-[10px] text-slate-500 mt-2">
          <summary className="cursor-pointer hover:text-slate-700">Variáveis disponíveis</summary>
          <div className="mt-1 pl-2 border-l border-slate-200 space-y-0.5">
            <div><code className="bg-slate-100 px-1 rounded">{'{{ contact.id }}'}</code> · id do contacto do trigger</div>
            <div><code className="bg-slate-100 px-1 rounded">{'{{ contact.name }}'}</code> · nome do contacto</div>
            <div><code className="bg-slate-100 px-1 rounded">{'{{ deal.id }}'}</code> · id do deal do trigger</div>
            <div><code className="bg-slate-100 px-1 rounded">{'{{ deal.value | money }}'}</code> · valor do deal formatado</div>
            <div><code className="bg-slate-100 px-1 rounded">{'{{ trigger.payload.* }}'}</code> · dados do evento</div>
            <div><code className="bg-slate-100 px-1 rounded">{'{{ nodeId.output.* }}'}</code> · output de um passo anterior</div>
          </div>
        </details>
      ) : null}
    </div>
  );
}
