-- Sprint 16 c1: breakdown diário de CHQ dos últimos N dias.
-- Devolve array com {date, day_of_week, is_today, count, activities, new_contacts}
-- para a UI desenhar bar chart no /dashboard Honesto.

create or replace function public.compute_chq_breakdown(
  p_days int default 7,
  p_owner uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid;
  v_now timestamptz := now();
  v_days int := greatest(1, least(coalesce(p_days, 7), 90));
  v_chq_types text[] := array['call','meeting','visit','whatsapp','email'];
  v_result jsonb;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select organization_id into v_org from profiles where id = v_user;
  if v_org is null then
    raise exception 'no organization' using errcode = '42501';
  end if;

  with day_series as (
    select generate_series(
      date_trunc('day', (v_now at time zone 'Europe/Lisbon') - make_interval(days => v_days - 1)),
      date_trunc('day', v_now at time zone 'Europe/Lisbon'),
      interval '1 day'
    )::date as d
  ),
  per_day_activities as (
    select
      date_trunc('day', da.created_at at time zone 'Europe/Lisbon')::date as d,
      count(*)::int as cnt
    from deal_activities da
    left join deals dd on dd.id = da.deal_id
    where da.organization_id = v_org
      and da.type = any(v_chq_types)
      and da.created_at >= (v_now - make_interval(days => v_days + 1))
      and (p_owner is null or coalesce(da.owner_id, dd.owner_id) = p_owner)
    group by 1
  ),
  per_day_contacts as (
    select
      date_trunc('day', c.created_at at time zone 'Europe/Lisbon')::date as d,
      count(*)::int as cnt
    from contacts c
    where c.organization_id = v_org
      and c.deleted_at is null
      and c.created_at >= (v_now - make_interval(days => v_days + 1))
      and (coalesce(c.phone,'') <> '' or coalesce(c.email,'') <> '')
      and (p_owner is null or c.owner_id = p_owner)
    group by 1
  )
  select jsonb_agg(
    jsonb_build_object(
      'date', ds.d,
      'day_of_week', extract(isodow from ds.d)::int,
      'is_today', ds.d = (date_trunc('day', v_now at time zone 'Europe/Lisbon'))::date,
      'count', coalesce(pda.cnt, 0) + coalesce(pdc.cnt, 0),
      'activities', coalesce(pda.cnt, 0),
      'new_contacts', coalesce(pdc.cnt, 0)
    )
    order by ds.d
  ) into v_result
  from day_series ds
  left join per_day_activities pda on pda.d = ds.d
  left join per_day_contacts pdc on pdc.d = ds.d;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;

revoke all on function public.compute_chq_breakdown(int, uuid) from public;
grant execute on function public.compute_chq_breakdown(int, uuid) to authenticated;

comment on function public.compute_chq_breakdown(int, uuid) is
'Sprint 16 c1: breakdown diário CHQ para UI mostrar curva da semana/mês. p_days entre 1-90, default 7. Lisbon TZ.';
