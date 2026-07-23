-- deal_quick_stats: contadores rápidos por negócio para os badges da lead.
-- Devolve, por deal_id: contactos manuais (humanos), contactos automáticos e
-- tarefas em aberto. Conta as actividades do negócio E do contacto do negócio
-- (as automações escrevem em deal_activities com deal_id OU contact_id).
--
-- Regra de contagem (validada pelo João 23/07/2026):
--   * manual_touches = actor 'human', excluindo bookkeeping de sistema. Uma
--     chamada "não atendida" CONTA aqui (é trabalho feito). O relógio de
--     follow-up (deal_state_signals.last_human_touch) é que exclui no_answer/
--     voicemail — ver migração deal_state_signals.
--   * auto_touches   = actor 'automation'.
--   * open_tasks     = tarefas (public.activities) do negócio ainda por concluir.

create or replace function public.deal_quick_stats(p_deal_ids uuid[])
returns table (
  deal_id uuid,
  manual_touches int,
  auto_touches int,
  open_tasks int
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    d.id as deal_id,
    coalesce(count(da.id) filter (
      where da.actor = 'human'
        and da.type not in ('stage_moved','stage_change','created','system','TASK')
    ), 0)::int as manual_touches,
    coalesce(count(da.id) filter (where da.actor = 'automation'), 0)::int as auto_touches,
    (
      select count(*)::int
      from public.activities a
      where a.deal_id = d.id
        and a.completed = false
        and a.deleted_at is null
    ) as open_tasks
  from public.deals d
  left join public.deal_activities da
    on da.organization_id = d.organization_id
   and (da.deal_id = d.id or (da.deal_id is null and da.contact_id = d.contact_id))
  where d.id = any(p_deal_ids)
    and d.organization_id = public.get_user_org_id()
  group by d.id;
$$;

grant execute on function public.deal_quick_stats(uuid[]) to authenticated;
revoke execute on function public.deal_quick_stats(uuid[]) from anon;
