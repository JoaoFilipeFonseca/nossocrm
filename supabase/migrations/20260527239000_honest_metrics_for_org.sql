-- Sprint 20 c1: wrapper service-role para chamar compute_honest_metrics de
-- contextos sem auth.uid() (Telegram webhook, crons). Recebe org explícita.
-- Concedido APENAS a service_role.

create or replace function public.compute_honest_metrics_for_org(
  p_org uuid,
  p_owner uuid default null,
  p_year int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_year int := coalesce(p_year, extract(year from (v_now at time zone 'Europe/Lisbon'))::int);
  v_today_start timestamptz := (date_trunc('day', v_now at time zone 'Europe/Lisbon')) at time zone 'Europe/Lisbon';
  v_week_start timestamptz := (date_trunc('week', v_now at time zone 'Europe/Lisbon')) at time zone 'Europe/Lisbon';
  v_month_start timestamptz := (date_trunc('month', v_now at time zone 'Europe/Lisbon')) at time zone 'Europe/Lisbon';
  v_year_start timestamptz := make_timestamptz(v_year, 1, 1, 0, 0, 0, 'Europe/Lisbon');
  v_year_end timestamptz := make_timestamptz(v_year + 1, 1, 1, 0, 0, 0, 'Europe/Lisbon');
  v_chq_types text[] := array['call','meeting','visit','whatsapp','email'];
  v_chq_today int := 0;
  v_chq_week int := 0;
  v_chq_month int := 0;
  v_meetings_visits_week int := 0;
  v_open_proposals_count int := 0;
  v_open_proposals_value numeric := 0;
  v_weighted_pipeline numeric := 0;
  v_annual_target numeric := 0;
  v_monthly_targets numeric[];
  v_ytd_target numeric := 0;
  v_ytd_realized numeric := 0;
  v_pct numeric;
  v_sem text;
  v_current_month int := extract(month from (v_now at time zone 'Europe/Lisbon'))::int;
begin
  if p_org is null then
    raise exception 'p_org required' using errcode = '22023';
  end if;

  select count(*)::int into v_chq_today
    from deal_activities da
    left join deals d on d.id = da.deal_id
    where da.organization_id = p_org
      and da.type = any(v_chq_types)
      and da.created_at >= v_today_start
      and (p_owner is null or coalesce(da.owner_id, d.owner_id) = p_owner);

  select count(*)::int into v_chq_week
    from deal_activities da
    left join deals d on d.id = da.deal_id
    where da.organization_id = p_org
      and da.type = any(v_chq_types)
      and da.created_at >= v_week_start
      and (p_owner is null or coalesce(da.owner_id, d.owner_id) = p_owner);

  select count(*)::int into v_chq_month
    from deal_activities da
    left join deals d on d.id = da.deal_id
    where da.organization_id = p_org
      and da.type = any(v_chq_types)
      and da.created_at >= v_month_start
      and (p_owner is null or coalesce(da.owner_id, d.owner_id) = p_owner);

  v_chq_today := v_chq_today + (
    select count(*)::int from contacts c
    where c.organization_id = p_org and c.deleted_at is null
      and c.created_at >= v_today_start
      and (coalesce(c.phone,'') <> '' or coalesce(c.email,'') <> '')
      and (p_owner is null or c.owner_id = p_owner)
  );
  v_chq_week := v_chq_week + (
    select count(*)::int from contacts c
    where c.organization_id = p_org and c.deleted_at is null
      and c.created_at >= v_week_start
      and (coalesce(c.phone,'') <> '' or coalesce(c.email,'') <> '')
      and (p_owner is null or c.owner_id = p_owner)
  );
  v_chq_month := v_chq_month + (
    select count(*)::int from contacts c
    where c.organization_id = p_org and c.deleted_at is null
      and c.created_at >= v_month_start
      and (coalesce(c.phone,'') <> '' or coalesce(c.email,'') <> '')
      and (p_owner is null or c.owner_id = p_owner)
  );

  select count(*)::int into v_meetings_visits_week
    from deal_activities da
    left join deals d on d.id = da.deal_id
    where da.organization_id = p_org
      and da.type in ('meeting','visit')
      and da.created_at >= v_week_start
      and (p_owner is null or coalesce(da.owner_id, d.owner_id) = p_owner);

  select count(*)::int, coalesce(sum(d.value), 0)
    into v_open_proposals_count, v_open_proposals_value
    from deals d
    left join board_stages bs on bs.id = d.stage_id
    where d.organization_id = p_org
      and d.deleted_at is null
      and coalesce(d.is_won, false) = false
      and coalesce(d.is_lost, false) = false
      and (
        coalesce(bs.label,'') ilike 'propost%'
        or coalesce(bs.name,'') ilike 'propost%'
        or coalesce(d.status,'') ilike 'propost%'
      )
      and (p_owner is null or d.owner_id = p_owner);

  select coalesce(sum(coalesce(d.value,0) * coalesce(d.probability,0) / 100.0), 0)
    into v_weighted_pipeline
    from deals d
    where d.organization_id = p_org
      and d.deleted_at is null
      and coalesce(d.is_won, false) = false
      and coalesce(d.is_lost, false) = false
      and (p_owner is null or d.owner_id = p_owner);

  select annual_target_eur, monthly_target_eur
    into v_annual_target, v_monthly_targets
    from org_revenue_goals
    where organization_id = p_org and year = v_year;

  if v_monthly_targets is not null and array_length(v_monthly_targets, 1) = 12 then
    select coalesce(sum(t), 0) into v_ytd_target
      from unnest(v_monthly_targets[1:v_current_month]) as t;
    if v_ytd_target = 0 and coalesce(v_annual_target,0) > 0 then
      v_ytd_target := v_annual_target * v_current_month / 12.0;
    end if;
  elsif coalesce(v_annual_target,0) > 0 then
    v_ytd_target := v_annual_target * v_current_month / 12.0;
  end if;

  select coalesce(sum(d.value), 0) into v_ytd_realized
    from deals d
    where d.organization_id = p_org
      and d.deleted_at is null
      and coalesce(d.is_won, false) = true
      and d.closed_at >= v_year_start
      and d.closed_at < v_year_end
      and (p_owner is null or d.owner_id = p_owner);

  v_pct := case when v_ytd_target > 0 then (v_ytd_realized / v_ytd_target) * 100 else null end;
  v_sem := case
    when v_pct is null then 'unknown'
    when v_pct >= 90 then 'green'
    when v_pct >= 60 then 'amber'
    else 'red'
  end;

  return jsonb_build_object(
    'chq', jsonb_build_object('today', v_chq_today, 'week', v_chq_week, 'month', v_chq_month),
    'meetings_visits_week', v_meetings_visits_week,
    'open_proposals', jsonb_build_object('count', v_open_proposals_count, 'total_value_eur', v_open_proposals_value),
    'weighted_pipeline_eur', v_weighted_pipeline,
    'goal', jsonb_build_object(
      'year', v_year,
      'annual_target_eur', coalesce(v_annual_target, 0),
      'ytd_target_eur', v_ytd_target,
      'ytd_realized_eur', v_ytd_realized,
      'pct', v_pct,
      'semaphore', v_sem
    )
  );
end;
$$;

revoke all on function public.compute_honest_metrics_for_org(uuid, uuid, int) from public, authenticated;
grant execute on function public.compute_honest_metrics_for_org(uuid, uuid, int) to service_role;
