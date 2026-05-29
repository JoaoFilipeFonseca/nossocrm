'use client';

/**
 * DurationInput — campo de duração humano (número + unidade) para o builder.
 *
 * Sprint 37 Fase 1.
 *
 * O átomo continua a consumir a MESMA unidade base que já consumia (segundos ou
 * horas), por isso o motor não muda e as automações antigas continuam válidas.
 * Este widget só traduz: mostra "1 dia" mas grava 86400 (se base = segundos).
 *
 * Semântica:
 *  - ao carregar um valor existente, escolhe a maior unidade que o representa
 *    sem resto (3600 s base segundos → "1 hora");
 *  - ao mudar a unidade, mantém o número ("1 hora" → escolher "dias" = "1 dia"),
 *    que é o que faz sentido a criar uma automação.
 */

import { useEffect, useRef, useState } from 'react';

export type BaseUnit = 'seconds' | 'hours';

export interface DurationUnit {
  id: string;
  label: string;
  seconds: number;
}

// Unidades por ordem crescente. meses/anos são aproximados (30 / 365 dias).
export const DURATION_UNITS: readonly DurationUnit[] = [
  { id: 'seconds', label: 'segundos', seconds: 1 },
  { id: 'minutes', label: 'minutos', seconds: 60 },
  { id: 'hours', label: 'horas', seconds: 3600 },
  { id: 'days', label: 'dias', seconds: 86400 },
  { id: 'weeks', label: 'semanas', seconds: 604800 },
  { id: 'months', label: 'meses', seconds: 2592000 },
  { id: 'years', label: 'anos', seconds: 31536000 },
];

function baseSecondsOf(base: BaseUnit): number {
  return base === 'hours' ? 3600 : 1;
}

/** Unidades oferecidas conforme a base, para evitar arredondamentos perdidos. */
export function allowedUnits(base: BaseUnit): DurationUnit[] {
  const min = baseSecondsOf(base);
  return DURATION_UNITS.filter((u) => u.seconds % min === 0);
}

/** Converte (valor, unidade) para a unidade base do átomo (segundos ou horas). */
export function toBase(value: number, unitId: string, base: BaseUnit): number {
  const unit = DURATION_UNITS.find((u) => u.id === unitId) ?? DURATION_UNITS[0];
  return Math.round((value * unit.seconds) / baseSecondsOf(base));
}

/** Converte um valor na unidade base para (valor, unidade) amigável. */
export function fromBase(baseValue: number, base: BaseUnit): { value: number; unitId: string } {
  const allowed = allowedUnits(base);
  const fallback = allowed[0];
  if (!baseValue || baseValue <= 0) return { value: baseValue || 0, unitId: fallback.id };
  const totalSeconds = baseValue * baseSecondsOf(base);
  for (let i = allowed.length - 1; i >= 0; i -= 1) {
    const u = allowed[i];
    if (totalSeconds % u.seconds === 0) return { value: totalSeconds / u.seconds, unitId: u.id };
  }
  return { value: baseValue, unitId: fallback.id };
}

function formatNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 10000) / 10000);
}

export interface DurationInputProps {
  /** Valor actual na unidade base do átomo (ou undefined se vazio). */
  value: number | undefined;
  base: BaseUnit;
  onChange: (next: number | undefined) => void;
  id?: string;
}

export function DurationInput({ value, base, onChange, id }: DurationInputProps) {
  const allowed = allowedUnits(base);
  const initial = fromBase(typeof value === 'number' ? value : 0, base);
  const [num, setNum] = useState<string>(typeof value === 'number' ? formatNum(initial.value) : '');
  const [unitId, setUnitId] = useState<string>(initial.unitId);
  const lastEmitted = useRef<number | undefined>(value);

  // Reseed quando o valor muda por fora (ex: seleccionar outro nó).
  useEffect(() => {
    if (value !== lastEmitted.current) {
      if (typeof value === 'number') {
        const f = fromBase(value, base);
        setNum(formatNum(f.value));
        setUnitId(f.unitId);
      } else {
        setNum('');
      }
      lastEmitted.current = value;
    }
  }, [value, base]);

  const emit = (rawNum: string, uId: string) => {
    if (rawNum.trim() === '') {
      lastEmitted.current = undefined;
      onChange(undefined);
      return;
    }
    const parsed = Number(rawNum);
    if (!Number.isFinite(parsed)) return;
    const next = toBase(parsed, uId, base);
    lastEmitted.current = next;
    onChange(next);
  };

  return (
    <div className="mt-0.5 flex gap-1.5">
      <input
        id={id}
        type="number"
        min={0}
        value={num}
        onChange={(e) => {
          setNum(e.target.value);
          emit(e.target.value, unitId);
        }}
        className="w-20 rounded border border-slate-300 px-2 py-1 text-sm"
      />
      <select
        aria-label="Unidade de tempo"
        value={unitId}
        onChange={(e) => {
          setUnitId(e.target.value);
          emit(num, e.target.value);
        }}
        className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm bg-white"
      >
        {allowed.map((u) => (
          <option key={u.id} value={u.id}>{u.label}</option>
        ))}
      </select>
    </div>
  );
}
