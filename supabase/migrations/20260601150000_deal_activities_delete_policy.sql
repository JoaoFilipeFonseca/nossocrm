-- CT-TIMELINE Fase 2: faltava política DELETE em deal_activities (só havia
-- SELECT/INSERT), por isso apagar uma entrada manual era negado pela RLS.
-- Idempotente. O endpoint restringe a apagar só entradas manuais (via=timeline-manual).

DROP POLICY IF EXISTS deal_activities_org_delete ON public.deal_activities;
CREATE POLICY deal_activities_org_delete ON public.deal_activities
  FOR DELETE
  USING (
    organization_id = (
      SELECT p.organization_id FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
    )
  );
