'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { ChecklistsEditor } from '@/app/(protected)/settings/checklists/ChecklistsEditor';

interface Stage { id: string; label: string; color: string | null; order: number; }
interface Board { id: string; name: string; stages: Stage[]; }
interface ChecklistItem { label: string; required?: boolean; }

interface BoardRow {
  id: string;
  name: string;
  board_stages: { id: string; label: string; color: string | null; order: number }[];
}
interface ChecklistRow {
  board_id: string;
  stage_id: string;
  items: ChecklistItem[];
}

export function ChecklistsTab() {
  const { organizationId } = useAuth();
  const [boards, setBoards] = useState<Board[]>([]);
  const [existing, setExisting] = useState<Record<string, ChecklistItem[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    void (async () => {
      const { data: boardsData } = await supabase
        .from('boards')
        .select('id, name, board_stages!board_stages_board_id_fkey(id, label, color, "order")')
        .order('name')
        .returns<BoardRow[]>();
      const { data: existingData } = await supabase
        .from('stage_checklists')
        .select('board_id, stage_id, items')
        .returns<ChecklistRow[]>();
      if (!active) return;
      const mapped: Board[] = (boardsData ?? []).map((b) => ({
        id: b.id,
        name: b.name,
        stages: (b.board_stages ?? []).slice().sort((a, c) => a.order - c.order),
      }));
      const exMap: Record<string, ChecklistItem[]> = {};
      for (const r of existingData ?? []) {
        exMap[`${r.board_id}:${r.stage_id}`] = r.items;
      }
      setBoards(mapped);
      setExisting(exMap);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [organizationId]);

  return (
    <div className="pb-10">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Checklists por fase</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Define o que tem de estar tratado antes de mover um negócio para cada fase. Ao mover,
          aparece um lembrete com estes pontos. Se alguém avançar sem cumprir, fica registado no histórico.
        </p>
      </div>
      {loading ? (
        <div className="text-sm text-slate-500">A carregar checklists…</div>
      ) : (
        <ChecklistsEditor boards={boards} existing={existing} />
      )}
    </div>
  );
}
