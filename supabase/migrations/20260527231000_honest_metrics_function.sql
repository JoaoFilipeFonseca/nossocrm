-- Sprint 10 c2: compute_honest_metrics RPC
-- Retorna JSON com as 7 métricas em uma única ida à BD.
-- SECURITY DEFINER + filtro explícito por organization_id resolvido via auth.uid().
-- Lisbon TZ para boundaries hoje/semana/mês.

create or replace function public.compute_honest_metrics(
  p_owner uuid default null,
  p_year int default null
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
  v_contacts_today int := 0;
  v_meetings_visits_week int := 0;
  v_open_proposals_count int := 0;
  v_open_proposals_value numeric := 0;
  v_weighted_pipeline numeric := 0;

  v_annual_target numeric := 0;
  v_monthly_targets numeric[];
  v_ytd_target numeric := 0;
  v_ytd_realized numeric := 0;
  v_gap numeric;
  v_pct numeric;
  v_sem text;
  v_current_month int := extract(month from (v_now at time zone 'Europe/Lisbon'))::int;

  v_stage_conv jsonb := '[]'::jsonb;
  v_avg_time jsonb := '[]'::jsonb;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select organization_id into v_org from profiles where id = v_user;
  if v_org is null then
    raise exception 'no organization' using errcode = '42501';
  end if;

  -- CHQ: deal_activities tipos humanos
  select count(*)::int into v_chq_today
    from deal_activities da
    left join deals d on d.id = da.deal_id
    where da.organization_id = v_org
      and da.type = any(v_chq_types)
      and da.created_at >= v_today_start
      and (p_owner is null or d.owner_id = p_owner);

  select count(*)::int into v_chq_week
    from deal_activities da
    left join deals d on d.id = da.deal_id
    where da.organization_id = v_org
      and da.type = any(v_chq_types)
      and da.created_at >= v_week_start
      and (p_owner is null or d.owner_id = p_owner);

  select count(*)::int into v_chq_month
    from deal_activities da
    left join deals d on d.id = da.deal_id
    where da.organization_id = v_org
      and da.type = any(v_chq_types)
      and da.created_at >= v_month_start
      and (p_owner is null or d.owner_id = p_owner);

  -- novos contactos hoje/semana/mês com telefone OU email contam como CHQ
  select count(*)::int into v_contacts_today
    from contacts c
    where c.organization_id = v_org
      and c.deleted_at is null
      and c.created_at >= v_today_start
      and (coalesce(c.phone,'') <> '' or coalesce(c.email,'') <> '')
      and (p_owner is null or c.owner_id = p_owner);

  v_chq_today := v_chq_today + v_contacts_today;
  v_chq_week := v_chq_week + (
    select count(*)::int from contacts c
    where c.organization_id = v_org and c.deleted_at is null
      and c.created_at >= v_week_start
      and (coalesce(c.phone,'') <> '' or coalesce(c.email,'') <> '')
      and (p_owner is null or c.owner_id = p_owner)
  );
  v_chq_month := v_chq_month + (
    select count(*)::int from contacts c
    where c.organization_id = v_org and c.deleted_at is null
      and c.created_at >= v_month_start
      and (coalesce(c.phone,'') <> '' or coalesce(c.email,'') <> '')
      and (p_owner is null or c.owner_id = p_owner)
  );

  -- Reuniões + visitas (semana)
  select count(*)::int into v_meetings_visits_week
    from deal_activities da
    left join deals d on d.id = da.deal_id
    where da.organization_id = v_org
      and da.type in ('meeting','visit')
      and da.created_at >= v_week_start
      and (p_owner is null or d.owner_id = p_owner);

  -- Propostas em aberto (stage label/name ilike 'propost%' ou status 'propost%')
  select count(*)::int, coalesce(sum(d.value), 0)
    into v_open_proposals_count, v_open_proposals_value
    from deals d
    left join board_stages bs on bs.id = d.stage_id
    where d.organization_id = v_org
      and d.deleted_at is null
      and coalesce(d.is_won, false) = false
      and coalesce(d.is_lost, false) = false
      and (
        coalesce(bs.label,'') ilike 'propost%'
        or coalesce(bs.name,'') ilike 'propost%'
        or coalesce(d.status,'') ilike 'propost%'
      )
      and (p_owner is null or d.owner_id = p_owner);

  -- Receita ponderada pendente (open deals, value * probability/100)
  select coalesce(sum(coalesce(d.value,0) * coalesce(d.probability,0) / 100.0), 0)
    into v_weighted_pipeline
    from deals d
    where d.organization_id = v_org
      and d.deleted_at is null
      and coalesce(d.is_won, false) = false
      and coalesce(d.is_lost, false) = false
      and (p_owner is null or d.owner_id = p_owner);

  -- Meta YTD vs realizado
  select annual_target_eur, monthly_target_eur
    into v_annual_target, v_monthly_targets
    from org_revenue_goals
    where organization_id = v_org and year = v_year;

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
    where d.organization_id = v_org
      and d.deleted_at is null
      and coalesce(d.is_won, false) = true
      and d.closed_at >= v_year_start
      and d.closed_at < v_year_end
      and (p_owner is null or d.owner_id = p_owner);

  v_gap := v_ytd_realized - v_ytd_target;
  v_pct := case when v_ytd_target > 0 then (v_ytd_realized / v_ytd_target) * 100 else null end;
  v_sem := case
    when v_pct is null then 'unknown'
    when v_pct >= 90 then 'green'
    when v_pct >= 60 then 'amber'
    else 'red'
  end;

  -- Conversão por fase (por board)
  with deals_per_board as (
    select board_id, count(*)::int as total
    from deals
    where organization_id = v_org and deleted_at is null
    group by board_id
  ),
  stages_ord as (
    select bs.id, bs.board_id, coalesce(bs.label, bs.name) as stage_label, bs."order" as ord
    from board_stages bs
    where bs.organization_id = v_org
  ),
  past_counts as (
    select s.id as stage_id, s.board_id, s.stage_label, s.ord,
      (
        select count(*)::int
        from deals d
        join board_stages bs2 on bs2.id = d.stage_id
        where d.organization_id = v_org
          and d.deleted_at is null
          and d.board_id = s.board_id
          and bs2."order" >= s.ord
      ) as deals_past
    from stages_ord s
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'board_id', pc.board_id,
      'stage_id', pc.stage_id,
      'stage_label', pc.stage_label,
      'order', pc.ord,
      'deals_in_or_past', pc.deals_past,
      'deals_total_board', coalesce(dpb.total, 0),
      'pct', case when coalesce(dpb.total,0) > 0 then round(pc.deals_past::numeric / dpb.total * 100, 1) else 0 end
    )
    order by pc.board_id, pc.ord
  ), '[]'::jsonb) into v_stage_conv
  from past_counts pc
  left join deals_per_board dpb on dpb.board_id = pc.board_id;

  -- Tempo médio por fase via stage_moved activities
  with stage_moves as (
    select da.deal_id,
      (da.metadata->>'de') as stage_label,
      da.created_at,
      lead(da.created_at) over (partition by da.deal_id order by da.created_at) as next_at
    from deal_activities da
    where da.organization_id = v_org and da.type = 'stage_moved'
  ),
  durations as (
    select stage_label, extract(epoch from (next_at - created_at)) / 86400.0 as days
    from stage_moves
    where next_at is not null and stage_label is not null
  ),
  per_stage as (
    select stage_label,
      round(avg(days)::numeric, 1) as avg_days,
      count(*)::int as samples
    from durations
    group by stage_label
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'stage_label', stage_label,
      'avg_days', avg_days,
      'samples', samples
    )
    order by avg_days desc
  ), '[]'::jsonb) into v_avg_time
  from per_stage;

  return jsonb_build_object(
    'generated_at', v_now,
    'organization_id', v_org,
    'owner_id', p_owner,
    'year', v_year,
    'windows', jsonb_build_object(
      'today_start', v_today_start,
      'week_start', v_week_start,
      'month_start', v_month_start,
      'year_start', v_year_start
    ),
    'chq', jsonb_build_object(
      'today', v_chq_today,
      'week', v_chq_week,
      'month', v_chq_month,
      'types_counted', to_jsonb(v_chq_types)
    ),
    'meetings_visits_week', v_meetings_visits_week,
    'open_proposals', jsonb_build_object(
      'count', v_open_proposals_count,
      'total_value_eur', v_open_proposals_value
    ),
    'weighted_pipeline_eur', v_weighted_pipeline,
    'goal', jsonb_build_object(
      'year', v_year,
      'annual_target_eur', coalesce(v_annual_target, 0),
      'ytd_target_eur', v_ytd_target,
      'ytd_realized_eur', v_ytd_realized,
      'gap_eur', v_gap,
      'pct', v_pct,
      'semaphore', v_sem,
      'has_goal', v_monthly_targets is not null or coalesce(v_annual_target,0) > 0
    ),
    'stage_conversion', v_stage_conv,
    'avg_time_per_stage_days', v_avg_time
  );
end;
$$;

revoke all on function public.compute_honest_metrics(uuid, int) from public;
grant execute on function public.compute_honest_metrics(uuid, int) to authenticated;

comment on function public.compute_honest_metrics(uuid, int) is
'Sprint 10 c2: calcula as 7 métricas honestas (CHQ, reuniões/visitas, propostas, receita ponderada, meta, conv por fase, tempo médio por fase) em Lisbon TZ. SECURITY DEFINER + filtro explícito por org resolvido via auth.uid().';
