-- Brief 4: Telegram distinto para pedidos de mini-análise (source=calculadora-avaliar).
-- A automação "Coração" (lead.captured) continua a ser o notificador único (Brief 3).
-- O nó `push` (action.send_telegram) passa a ramificar por proveniência:
--   - calculadora-avaliar  -> "📊 Pedido de mini-análise (24h)" com zona/tipologia/área
--   - restantes            -> "🔥 LIGA AGORA" (comportamento original preservado)
-- Email de acolhimento e restantes nós ficam intactos. Sem duplicação de Telegram.
--
-- Idempotente: só actualiza se o nó de índice 3 for mesmo o `push` (guarda de segurança).

UPDATE public.automations
SET definition = jsonb_set(
      definition,
      '{nodes,3,config,text}',
      to_jsonb($tg${% if deal.attribution.source == 'calculadora-avaliar' %}📊 <b>Pedido de mini-análise (24h)</b>

👤 <b>{{ contact.name }}</b>
📞 {{ contact.phone }}
📍 {{ deal.attribution.imovel.localizacao }}
🏠 {{ deal.attribution.imovel.tipologia }} · {{ deal.attribution.imovel.area }} m²

Abrir: https://crm.joaofilipefonseca.pt/deals/{{ deal.id }}/cockpit{% else %}🔥 <b>LIGA AGORA</b>

👤 <b>{{ contact.name }}</b>
📞 {{ contact.phone }}
📣 Origem: {{ deal.attribution.source }}
🏠 {{ deal.title }}

Abrir: https://crm.joaofilipefonseca.pt/deals/{{ deal.id }}/cockpit{% endif %}$tg$::text),
      false
    ),
    version = version + 1,
    updated_at = now()
WHERE id = '0c0ac0de-c0de-4c0d-8c0d-c0de0c0dec01'
  AND definition #>> '{nodes,3,id}' = 'push';
