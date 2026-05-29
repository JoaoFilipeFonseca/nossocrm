'use client';

/**
 * EventMultiSelect — escolha de eventos do gatilho por checkboxes em PT.
 *
 * Sprint 37 Fase 2.
 *
 * Substitui o textarea CSV cru no campo `events` do trigger.event. Oferece só
 * os eventos que o sistema dispara mesmo (EMITTED_EVENTS), agrupados. Grava um
 * array de ids técnicos (formato inalterado → o emparelhamento no
 * automation-event-listener não muda).
 */

import { EMITTED_EVENTS } from '@/lib/automation-engine/builder-catalog';

export interface EventMultiSelectProps {
  value: string[];
  onChange: (next: string[]) => void;
}

export function EventMultiSelect({ value, onChange }: EventMultiSelectProps) {
  const selected = new Set(Array.isArray(value) ? value : []);
  const groups = Array.from(new Set(EMITTED_EVENTS.map((e) => e.group)));

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };

  // Valores guardados que não estão na lista conhecida (não os perde de vista).
  const known = new Set(EMITTED_EVENTS.map((e) => e.id));
  const extras = Array.from(selected).filter((id) => !known.has(id));

  return (
    <div className="mt-0.5 space-y-2">
      {groups.map((group) => (
        <div key={group}>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">{group}</div>
          <div className="space-y-0.5">
            {EMITTED_EVENTS.filter((e) => e.group === group).map((e) => (
              <label key={e.id} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.has(e.id)}
                  onChange={() => toggle(e.id)}
                />
                {e.label}
              </label>
            ))}
          </div>
        </div>
      ))}
      {extras.length > 0 ? (
        <div className="text-[10px] text-slate-400">
          Outros eventos guardados: {extras.join(', ')}
        </div>
      ) : null}
    </div>
  );
}
