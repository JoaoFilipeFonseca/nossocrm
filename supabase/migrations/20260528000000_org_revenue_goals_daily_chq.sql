-- Sprint 23 c1: meta CHQ diária para semáforo de actividade.
alter table public.org_revenue_goals
  add column if not exists daily_chq_target int not null default 0
  check (daily_chq_target >= 0 and daily_chq_target <= 100);

comment on column public.org_revenue_goals.daily_chq_target is
'Sprint 23 c1: meta CHQ diária. Usada para semáforo do card CHQ hoje no /dashboard Honesto e no briefing matinal.';
