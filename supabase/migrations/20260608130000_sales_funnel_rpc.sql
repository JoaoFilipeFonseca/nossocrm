-- MKT-FUNNEL-CRM — RPC do Funil de Vendas (peça 1 do MKT-MEASURE).
-- Calcula, para um funil (board) e intervalo de datas à escolha:
--   - KPIs: negócios no funil (abertos), taxa de fecho, ciclo médio, valor aberto;
--   - funil por etapa (quantos chegaram a/passaram cada etapa + %);
--   - tempo médio por etapa (via deal_activities.stage_moved — mesma fonte do
--     honest_metrics já validado);
--   - motivos de perda agregados.
-- p_board_id NULL = todos os funis (KPIs + perdas agregados; etapas ficam vazias,
-- a UI pede para escolher um funil). Datas NULL = sem limite inferior / agora.
-- SECURITY DEFINER, search_path pinado (AUD-C3), org via get_user_org_id().

create or replace function public.sales_funnel(
  p_board_id uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.get_user_org_id();
  v_to timestamptz := coalesce(p_to, now());
  v_from timestamptz := coalesce(p_from, '1970-01-01'::timestamptz);
  v_open int; v_open_value numeric;
  v_won int; v_lost int; v_avg_cycle numeric;
  v_stages jsonb; v_avg_time jsonb; v_losses jsonb; v_base int;
begin
  if v_org is null then
    return jsonb_build_object('error', 'no org');
  end if;

  -- KPIs ---------------------------------------------------------------------
  select count(*)::int, coalesce(sum(coalesce(value,0)),0)
    into v_open, v_open_value
  from deals d
  where d.organization_id = v_org and d.deleted_at is null
    and coalesce(d.is_won,false) = false and coalesce(d.is_lost,false) = false
    and (p_board_id is null or d.board_id = p_board_id);

  select
    count(*) filter (where coalesce(is_won,false))::int,
    count(*) filter (where coalesce(is_lost,false))::int,
    round(avg(extract(epoch from (closed_at - created_at))/86400.0)
          filter (where coalesce(is_won,false)), 1)
    into v_won, v_lost, v_avg_cycle
  from deals d
  where d.organization_id = v_org and d.deleted_at is null
    and d.closed_at is not null and d.closed_at >= v_from and d.closed_at <= v_to
    and (p_board_id is null or d.board_id = p_board_id);

  -- Funil por etapa (só com um funil escolhido) ------------------------------
  if p_board_id is not null then
    with stages_ord as (
      select bs.id, coalesce(bs.label, bs.name) as stage_label, bs."order" as ord
      from board_stages bs
      where bs.organization_id = v_org and bs.board_id = p_board_id
    ),
    past as (
      select s.id as stage_id, s.stage_label, s.ord,
        (
          select count(*)::int from deals d
          join board_stages bs2 on bs2.id = d.stage_id
          where d.organization_id = v_org and d.deleted_at is null
            and d.board_id = p_board_id
            and d.created_at >= v_from and d.created_at <= v_to
            and bs2."order" >= s.ord
        ) as deals_past
      from stages_ord s
    )
    select coalesce(max(deals_past),0), coalesce(jsonb_agg(
      jsonb_build_object('stage_id', stage_id, 'stage_label', stage_label,
        'order', ord, 'deals', deals_past) order by ord), '[]'::jsonb)
      into v_base, v_stages
    from past;

    -- percentagem relativa à 1.ª etapa (entrada = 100%)
    select coalesce(jsonb_agg(
      jsonb_build_object('stage_label', e->>'stage_label', 'order', (e->>'order')::int,
        'deals', (e->>'deals')::int,
        'pct', case when v_base > 0 then round((e->>'deals')::numeric / v_base * 100, 1) else 0 end)
      order by (e->>'order')::int), '[]'::jsonb)
      into v_stages
    from jsonb_array_elements(v_stages) e;

    -- Tempo médio por etapa (mesma lógica do honest_metrics, com filtro)
    with moves as (
      select da.deal_id, (da.metadata->>'de') as stage_label, da.created_at,
        lead(da.created_at) over (partition by da.deal_id order by da.created_at) as next_at
      from deal_activities da
      join deals d on d.id = da.deal_id
      where da.organization_id = v_org and da.type = 'stage_moved'
        and d.board_id = p_board_id and d.deleted_at is null
        and da.created_at >= v_from and da.created_at <= v_to
    ),
    durs as (
      select stage_label, extract(epoch from (next_at - created_at))/86400.0 as days
      from moves where next_at is not null and stage_label is not null
    )
    select coalesce(jsonb_agg(jsonb_build_object('stage_label', stage_label,
      'avg_days', round(avg(days)::numeric,1), 'samples', count(*)::int)
      order by avg(days) desc), '[]'::jsonb)
      into v_avg_time
    from durs group by stage_label;
  else
    v_stages := '[]'::jsonb; v_avg_time := '[]'::jsonb;
  end if;

  -- Motivos de perda ---------------------------------------------------------
  with lost as (
    select coalesce(nullif(trim(loss_reason), ''), '(sem motivo)') as reason
    from deals d
    where d.organization_id = v_org and d.deleted_at is null
      and coalesce(d.is_lost,false) = true
      and d.closed_at is not null and d.closed_at >= v_from and d.closed_at <= v_to
      and (p_board_id is null or d.board_id = p_board_id)
  ),
  agg as (select reason, count(*)::int as n from lost group by reason),
  tot as (select coalesce(sum(n),0)::int as t from agg)
  select coalesce(jsonb_agg(jsonb_build_object('reason', reason, 'count', n,
    'pct', case when (select t from tot) > 0 then round(n::numeric/(select t from tot)*100,1) else 0 end)
    order by n desc), '[]'::jsonb)
    into v_losses
  from agg;

  return jsonb_build_object(
    'kpis', jsonb_build_object(
      'open_deals', v_open,
      'open_value', v_open_value,
      'won', coalesce(v_won,0),
      'lost', coalesce(v_lost,0),
      'win_rate', case when coalesce(v_won,0)+coalesce(v_lost,0) > 0
                       then round(v_won::numeric/(v_won+v_lost)*100,1) else null end,
      'avg_cycle_days', v_avg_cycle
    ),
    'stages', v_stages,
    'avg_time', v_avg_time,
    'loss_reasons', v_losses
  );
end;
$$;

grant execute on function public.sales_funnel(uuid, timestamptz, timestamptz) to authenticated, service_role;
