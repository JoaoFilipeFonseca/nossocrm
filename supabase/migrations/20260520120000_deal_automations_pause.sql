-- =====================================================
-- #124 Pause-on-touch — Bloco 1 Sub-task 3
-- Adiciona campos para pausar automações quando humano intervém.
-- Aplicado: 20 Mai 2026
-- =====================================================
--
-- REGRA: Quando humano move card / completa tarefa / retira tag,
-- as automações associadas ao deal pausam até o humano clicar "Retomar".
-- Inspirado em Pinheirinho A1-A4.
--
-- Esta migration é ADDITIVE (não toca em dados existentes).

alter table public.deals
  add column if not exists automations_paused_at timestamptz,
  add column if not exists automations_paused_reason text;

-- Index parcial para queries do tipo "deals com automações pausadas"
-- (poupa espaço — só indexa rows não-NULL).
create index if not exists idx_deals_automations_paused
  on public.deals(automations_paused_at)
  where automations_paused_at is not null;

-- Comentários para documentação no schema
comment on column public.deals.automations_paused_at is
  'Timestamp em que as automações deste deal foram pausadas por intervenção humana. NULL = automações activas.';

comment on column public.deals.automations_paused_reason is
  'Motivo da pausa: moved_stage | tag_removed | manual_override | task_completed.';
