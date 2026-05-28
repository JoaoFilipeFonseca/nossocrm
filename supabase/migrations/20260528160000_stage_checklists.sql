-- Sprint 36 c6 M-012 — Checklist por mudança de estágio no pipeline
-- ============================================================================
-- Tabela: stage_checklists
--
-- Cada (organization_id, board_id, stage_id) pode ter uma lista de items
-- accionáveis que aparecem ao consultor quando muda um deal para esse stage.
-- items é jsonb[] no formato:
--   [{ "label": "Confirmar CC", "required": true }, ...]
--
-- Modal é NÃO bloqueante: utilizador pode marcar tudo ou clicar "Avançar
-- mesmo assim". Decisão fica registada em audit_log_v2 via app code.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.stage_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES public.board_stages(id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stage_checklists_unique_per_stage UNIQUE (organization_id, board_id, stage_id),
  CONSTRAINT stage_checklists_items_is_array CHECK (jsonb_typeof(items) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_stage_checklists_org ON public.stage_checklists(organization_id);
CREATE INDEX IF NOT EXISTS idx_stage_checklists_stage ON public.stage_checklists(stage_id);

ALTER TABLE public.stage_checklists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stage_checklists_select_own_org" ON public.stage_checklists;
CREATE POLICY "stage_checklists_select_own_org" ON public.stage_checklists
  FOR SELECT TO authenticated
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "stage_checklists_insert_own_org" ON public.stage_checklists;
CREATE POLICY "stage_checklists_insert_own_org" ON public.stage_checklists
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "stage_checklists_update_own_org" ON public.stage_checklists;
CREATE POLICY "stage_checklists_update_own_org" ON public.stage_checklists
  FOR UPDATE TO authenticated
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "stage_checklists_delete_own_org" ON public.stage_checklists;
CREATE POLICY "stage_checklists_delete_own_org" ON public.stage_checklists
  FOR DELETE TO authenticated
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

DROP TRIGGER IF EXISTS trg_stage_checklists_updated_at ON public.stage_checklists;
CREATE TRIGGER trg_stage_checklists_updated_at
  BEFORE UPDATE ON public.stage_checklists
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.stage_checklists IS 'Sprint 36 M-012: items accionáveis mostrados ao consultor quando muda deal para um stage. RLS por org. items=[{label, required}].';
