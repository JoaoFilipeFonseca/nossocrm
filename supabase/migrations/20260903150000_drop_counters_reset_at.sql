-- REGRA DE OURO (2 Set 2026, tarde) substituiu counters_reset_at como portao
-- da previsao — o portao passou a ser a etapa (excludes_followup), nao mais uma
-- marca de tempo. Ficou sem uso desde essa tarde. Zero referencias no codigo
-- (confirmado por grep antes desta migracao). Ordem do Joao (3 Set): apagar.
alter table public.organization_settings
  drop column if exists counters_reset_at;
