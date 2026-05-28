import { createClient } from '@/lib/supabase/server';
import { ChecklistsEditor } from './ChecklistsEditor';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Checklists por estágio | Foco Imo' };

interface BoardWithStages {
  id: string;
  name: string;
  stages: { id: string; label: string; color: string | null; order: number }[];
}

interface ChecklistRow {
  board_id: string;
  stage_id: string;
  items: { label: string; required?: boolean }[];
}

export default async function ChecklistsPage() {
  const supabase = await createClient();

  const { data: boards } = await supabase
    .from('boards')
    .select('id, name, board_stages!board_stages_board_id_fkey(id, label, color, "order")')
    .order('name')
    .returns<{ id: string; name: string; board_stages: { id: string; label: string; color: string | null; order: number }[] }[]>();

  const { data: existing } = await supabase
    .from('stage_checklists')
    .select('board_id, stage_id, items')
    .returns<ChecklistRow[]>();

  const boardsWithStages: BoardWithStages[] = (boards ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    stages: (b.board_stages ?? []).slice().sort((a, b) => a.order - b.order),
  }));

  const existingMap = new Map<string, { label: string; required?: boolean }[]>();
  for (const r of existing ?? []) {
    existingMap.set(`${r.board_id}:${r.stage_id}`, r.items);
  }

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-semibold mb-2">Checklists por estágio</h1>
      <p className="text-sm text-slate-500 mb-6">
        Define o que tem de ser feito antes de mover um negócio para cada estágio.
        Ao arrastar um deal, um modal aparece com estes items para o consultor confirmar.
        Items <strong>obrigatórios</strong> bloqueiam o botão &quot;Já tratei&quot; até estarem marcados,
        mas o utilizador pode sempre escolher &quot;Avançar mesmo assim&quot; (fica registado).
      </p>

      <ChecklistsEditor boards={boardsWithStages} existing={Object.fromEntries(existingMap)} />
    </div>
  );
}
