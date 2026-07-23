-- FASE 1C — Alertas de tarefas.
-- O briefing matinal (2ª-6ª, 07:00 UTC) passa a contar as tarefas por fazer
-- (hoje + atrasadas), a incluí-las na mensagem do Telegram e a deixar o alerta
-- no sino do CRM (system_notifications, type='TASKS_DUE', link /dashboard).
-- Aqui só se actualiza a descrição em /automacoes — a lógica vive na edge
-- function telegram-morning-brief. Idempotente.

update public.system_automations
set description =
  'De 2ª a 6ª às 07h00: briefing do dia no Telegram com os números honestos '
  || '(CHQ hoje/semana, reuniões + visitas, propostas abertas, receita ponderada, '
  || '% da meta do ano), as TAREFAS por fazer (quantas para hoje e quantas '
  || 'atrasadas) e os negócios frios. Deixa também o alerta das tarefas no sino '
  || 'do CRM, com link para o Painel Diário.'
where key = 'telegram-morning-brief';
