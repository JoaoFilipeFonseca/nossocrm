-- NS-3: custo fixo por visita (combustível) configurável por org,
-- usado no cálculo "Custo & ROI por imóvel" (nº visitas × custo/visita).
alter table public.organization_settings
  add column if not exists default_visit_cost_cents integer not null default 0;
