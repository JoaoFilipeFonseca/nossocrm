'use client';

import { useState } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
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

// Item com identificador local — só vive no editor, para chave estável durante
// o drag. É removido antes de gravar (a BD guarda apenas { label, required }).
interface EditorItem extends ChecklistItem {
  _uid: string;
}

type ChecklistMap = Record<string, EditorItem[]>;

interface ChecklistsEditorProps {
  boards: Board[];
  existing: Record<string, ChecklistItem[]>;
}

function newUid(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function withUids(map: Record<string, ChecklistItem[]>): ChecklistMap {
  const out: ChecklistMap = {};
  for (const [key, list] of Object.entries(map)) {
    out[key] = list.map((it) => ({ ...it, _uid: newUid() }));
  }
  return out;
}

interface ChecklistRowProps {
  item: EditorItem;
  onLabel: (uid: string, label: string) => void;
  onRequired: (uid: string, required: boolean) => void;
  onRemove: (uid: string) => void;
}

function ChecklistRow({ item, onLabel, onRequired, onRemove }: ChecklistRowProps) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      className="flex items-center gap-2 rounded bg-white"
    >
      <button
        type="button"
        onPointerDown={(e) => controls.start(e)}
        className="cursor-grab touch-none select-none text-slate-400 hover:text-slate-600 px-1 text-base leading-none"
        title="Arrastar para reordenar"
        aria-label="Arrastar para reordenar"
      >
        ⠿
      </button>
      <input
        type="text"
        value={item.label}
        onChange={(e) => onLabel(item._uid, e.target.value)}
        placeholder="Ex: Confirmar caderneta predial"
        className="flex-1 text-sm border border-slate-300 rounded px-2 py-1"
      />
      <label className="flex items-center gap-1 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={item.required ?? false}
          onChange={(e) => onRequired(item._uid, e.target.checked)}
        />
        obrigatório
      </label>
      <button
        type="button"
        onClick={() => onRemove(item._uid)}
        className="text-red-500 hover:text-red-700 text-xs px-1.5"
        title="Remover item"
      >
        ✕
      </button>
    </Reorder.Item>
  );
}

export function ChecklistsEditor({ boards, existing }: ChecklistsEditorProps) {
  const { organizationId } = useAuth();
  const [items, setItems] = useState<ChecklistMap>(() => withUids(existing));
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function setList(key: string, next: EditorItem[]) {
    setItems((prev) => ({ ...prev, [key]: next }));
  }

  function updateLabel(key: string, uid: string, label: string) {
    setItems((prev) => ({
      ...prev,
      [key]: (prev[key] ?? []).map((it) => (it._uid === uid ? { ...it, label } : it)),
    }));
  }

  function updateRequired(key: string, uid: string, required: boolean) {
    setItems((prev) => ({
      ...prev,
      [key]: (prev[key] ?? []).map((it) => (it._uid === uid ? { ...it, required } : it)),
    }));
  }

  function removeItem(key: string, uid: string) {
    setItems((prev) => ({
      ...prev,
      [key]: (prev[key] ?? []).filter((it) => it._uid !== uid),
    }));
  }

  function addItem(key: string) {
    setItems((prev) => ({
      ...prev,
      [key]: [...(prev[key] ?? []), { _uid: newUid(), label: '', required: false }],
    }));
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
    // Stripa o _uid local — a BD guarda só { label, required }, na ordem actual.
    const list: ChecklistItem[] = (items[key] ?? []).map(({ label, required }) => ({
      label,
      required,
    }));
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

                  <Reorder.Group
                    axis="y"
                    values={list}
                    onReorder={(next) => setList(key, next as EditorItem[])}
                    className="space-y-1.5"
                  >
                    {list.map((it) => (
                      <ChecklistRow
                        key={it._uid}
                        item={it}
                        onLabel={(uid, label) => updateLabel(key, uid, label)}
                        onRequired={(uid, required) => updateRequired(key, uid, required)}
                        onRemove={(uid) => removeItem(key, uid)}
                      />
                    ))}
                  </Reorder.Group>

                  <button
                    type="button"
                    onClick={() => addItem(key)}
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
