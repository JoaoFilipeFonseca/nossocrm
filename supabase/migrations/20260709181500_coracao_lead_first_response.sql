-- ============================================================================
-- Brief 3 (épico Coração, fatia 1) — Resposta imediata a lead nova
-- ============================================================================
-- Cria:
--  1. RPC claim_automation_events — claim atómico (FOR UPDATE SKIP LOCKED) para
--     o listener; garante que o nudge imediato da captura e o tick do cron não
--     processam o mesmo evento duas vezes (1 execução por evento).
--  2. Índice único de idempotência em deal_activities — 1 resposta por negócio.
--  3. A automação "Coração: resposta imediata a lead nova" (ACTIVA) + o seu
--     trigger de evento lead.captured. Idempotente (ON CONFLICT DO NOTHING) para
--     não sobrepor edições futuras do João no builder.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Claim atómico de eventos pendentes
-- ---------------------------------------------------------------------------
create or replace function claim_automation_events(p_limit int default 50)
returns setof automation_events
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update automation_events e
  set processed = true, processed_at = now()
  where e.id in (
    select id from automation_events
    where processed = false
    order by occurred_at
    limit p_limit
    for update skip locked
  )
  returning e.*;
end;
$$;

grant execute on function claim_automation_events(int) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Idempotência: no máximo uma resposta imediata por negócio
-- ---------------------------------------------------------------------------
create unique index if not exists uniq_deal_activities_first_response
  on deal_activities (deal_id)
  where type = 'lead_first_response' and deal_id is not null;

-- ---------------------------------------------------------------------------
-- 3. A automação (activa) + trigger de evento
-- ---------------------------------------------------------------------------
insert into automations (
  id, organization_id, name, description, category, icon, status, definition, version, activated_at, created_by
) values (
  '0c0ac0de-c0de-4c0d-8c0d-c0de0c0dec01',
  '29455d22-ebbf-4996-ac46-a071cb4363bf',
  'Coração: resposta imediata a lead nova',
  'Quando entra uma lead de captação (formulários do João ou Meta Ads), envia email de acolhimento ao contacto e um aviso LIGA AGORA no Telegram, em menos de um minuto. Não responde a testes nem repete o mesmo negócio.',
  'comunicacao',
  '🔥',
  'active',
  jsonb_build_object(
    'nodes', jsonb_build_array(
      jsonb_build_object(
        'id', 'trigger', 'atom', 'trigger.event',
        'position', jsonb_build_object('x', 0, 'y', 0),
        'label', 'Lead nova de captação',
        'config', jsonb_build_object('events', jsonb_build_array('lead.captured'))
      ),
      jsonb_build_object(
        'id', 'guard_test', 'atom', 'logic.filter',
        'position', jsonb_build_object('x', 0, 'y', 120),
        'label', 'Excluir testes',
        'config', jsonb_build_object('left', '{{ deal.attribution.is_test }}', 'operator', 'neq', 'right', 'true')
      ),
      jsonb_build_object(
        'id', 'claim', 'atom', 'action.record_activity',
        'position', jsonb_build_object('x', 0, 'y', 240),
        'label', 'Registar toque (idempotente)',
        'config', jsonb_build_object(
          'deal_id', '{{ deal.id }}',
          'contact_id', '{{ contact.id }}',
          'type', 'lead_first_response',
          'actor', 'automation',
          'idempotency', true,
          'description', E'\U0001F916 Resposta imediata ao lead novo: email de acolhimento e aviso LIGA AGORA.'
        )
      ),
      jsonb_build_object(
        'id', 'push', 'atom', 'action.send_telegram',
        'position', jsonb_build_object('x', 0, 'y', 360),
        'label', 'Push LIGA AGORA',
        'config', jsonb_build_object(
          'text', E'\U0001F525 <b>LIGA AGORA</b>\n\n\U0001F464 <b>{{ contact.name }}</b>\n\U0001F4DE {{ contact.phone }}\n\U0001F4E3 Origem: {{ deal.attribution.source }}\n\U0001F3E0 {{ deal.title }}\n\nAbrir: https://crm.joaofilipefonseca.pt/deals/{{ deal.id }}/cockpit'
        )
      ),
      jsonb_build_object(
        'id', 'has_email', 'atom', 'logic.condition',
        'position', jsonb_build_object('x', 0, 'y', 480),
        'label', 'Tem email?',
        'config', jsonb_build_object('left', '{{ contact.email }}', 'operator', 'is_not_empty')
      ),
      jsonb_build_object(
        'id', 'email', 'atom', 'action.send_email',
        'position', jsonb_build_object('x', 0, 'y', 600),
        'label', 'Email de acolhimento',
        'config', jsonb_build_object(
          'to', '{{ contact.email }}',
          'from_name', 'João Fonseca',
          'subject', 'Recebi o seu pedido',
          'text', E'Olá {{ contact.name }},\n\nRecebi o seu pedido e estou a preparar a sua Análise de Mercado. Ligo-lhe {{ now.call_phrase }}.\n\nFico ao seu dispor para qualquer questão.\n\nCom os melhores cumprimentos,\nJoão Fonseca\nConsultor Imobiliário\nMaia'
        )
      )
    ),
    'edges', jsonb_build_array(
      jsonb_build_object('id', 'e1', 'source', 'trigger', 'target', 'guard_test'),
      jsonb_build_object('id', 'e2', 'source', 'guard_test', 'target', 'claim', 'sourceHandle', 'pass'),
      jsonb_build_object('id', 'e3', 'source', 'claim', 'target', 'push'),
      jsonb_build_object('id', 'e4', 'source', 'push', 'target', 'has_email'),
      jsonb_build_object('id', 'e5', 'source', 'has_email', 'target', 'email', 'sourceHandle', 'true')
    )
  ),
  1,
  now(),
  (select id from profiles where organization_id = '29455d22-ebbf-4996-ac46-a071cb4363bf' order by created_at limit 1)
)
on conflict (id) do nothing;

insert into automation_triggers (
  id, automation_id, organization_id, trigger_type, config, is_active
) values (
  '0c0ac0de-c0de-4c0d-8c0d-c0de0c0dec02',
  '0c0ac0de-c0de-4c0d-8c0d-c0de0c0dec01',
  '29455d22-ebbf-4996-ac46-a071cb4363bf',
  'event',
  jsonb_build_object('events', jsonb_build_array('lead.captured')),
  true
)
on conflict (id) do nothing;
