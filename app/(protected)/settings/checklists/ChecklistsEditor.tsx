'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';

interface Stage {
  id: string;
  label: string;
  color: string | null;
  order: number;
}

interface Board {
  id: string;
  name: string;
  stages: Stage[];
}

interface ChecklistItem {
  label: string;
  required?: boolean;
}

type ChecklistMap = Record<string, ChecklistItem[]>;

interface ChecklistsEditorProps {
  boards: Board[];
  existing: ChecklistMap;
}

export function ChecklistsEditor({ boards, existing }: ChecklistsEditorProps) {
  const { organizationId } = useAuth();
  const [items, setItems] = useState<ChecklistMap>(existing);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function update(key: string, next: ChecklistItem[]) {
    setItems((prev) => ({ ...prev, [key]: next }));
  }

  async function save(boardId: string, stageId: string) {
    if (!organizationId) {
      setError('Sem organização carregada.');
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      setError('Supabase indisponível.');
      return;
    }
    const key = `${boardId}:${stageId}`;
    const list = items[key] ?? [];
    setSavingKey(key);
    setError(null);
    const { error: upErr } = await supabase
      .from('stage_checklists')
      .upsert(
        {
          organization_id: organizationId,
          board_id: boardId,
          stage_id: stageId,
          items: list,
        },
        { onConflict: 'organization_id,board_id,stage_id' },
      );
    if (upErr) {
      setError(`Erro a guardar: ${upErr.message}`);
    }
    setSavingKey(null);
  }

  if (boards.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 p-8 text-center text-slate-500">
        Não há boards configurados ainda.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error ? (
        <div className="rounded-md bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>
      ) : null}
      {boards.map((board) => (
        <section key={board.id}>
          <h2 className="text-base font-semibold text-slate-800 mb-3">{board.name}</h2>
          <div className="space-y-3">
            {board.stages.map((stage) => {
              const key = `${board.id}:${stage.id}`;
              const list = items[key] ?? [];
              return (
                <div key={stage.id} className="rounded-md border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {stage.color ? (
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                      ) : null}
                      <span className="text-sm font-medium text-slate-800">{stage.label}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => save(board.id, stage.id)}
                      disabled={savingKey === key}
                      className="text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-2.5 py-1 rounded"
                    >
                      {savingKey === key ? 'A guardar…' : 'Guardar'}
                    </button>
                  </div>

                  <ul className="space-y-1.5">
                    {list.map((it, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={it.label}
                          onChange={(e) => {
                            const next = [...list];
                            next[idx] = { ...next[idx], label: e.target.value };
                            update(key, next);
                          }}
                          placeholder="Ex: Confirmar caderneta predial"
                          className="flex-1 text-sm border border-slate-300 rounded px-2 py-1"
                        />
                        <label className="flex items-center gap-1 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={it.required ?? false}
                            onChange={(e) => {
                              const next = [...list];
                              next[idx] = { ...next[idx], required: e.target.checked };
                              update(key, next);
                            }}
                          />
                          obrigatório
                        </label>
                        <button
                          type="button"
                          onClick={() => update(key, list.filter((_, i) => i !== idx))}
                          className="text-red-500 hover:text-red-700 text-xs px-1.5"
                          title="Remover item"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() => update(key, [...list, { label: '', required: false }])}
                    className="mt-2 text-xs text-slate-600 hover:text-slate-900"
                  >
                    + adicionar item
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
