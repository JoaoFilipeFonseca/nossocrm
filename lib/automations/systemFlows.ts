/**
 * systemFlows — o fluxo passo a passo de cada automação de SISTEMA (SYS-FLOW).
 *
 * As automações de sistema correm como código (edge functions / rotas Vercel),
 * não como grafos do motor. Este registry é o MAPA FIEL do que cada uma faz,
 * para o /automacoes as mostrar como as outras automações: vê-se o fluxo,
 * percebe-se a montagem, e fica claro o que é ajustável (horário, parâmetros,
 * ON/OFF) sem código.
 *
 * ⚠️ Manter em sincronia com o código real de cada função. Se mudares um passo
 * numa edge function, actualiza aqui o passo correspondente.
 */

export interface SystemFlowStep {
  icon: string;
  title: string;
  detail: string;
  /** Chaves de system_automations.params (ou organization_settings) que este passo usa. */
  params?: string[];
}

export interface SystemFlow {
  steps: SystemFlowStep[];
  /** Nota específica desta automação (opcional). */
  note?: string;
}

export const SYSTEM_FLOWS: Record<string, SystemFlow> = {
  'email-inbound': {
    steps: [
      { icon: '📥', title: 'Recebe a resposta do lead', detail: 'Quando um lead responde a um email do João, o Resend (ou um Cloudflare Email Worker) entrega essa resposta ao webhook messaging-webhook-resend, autenticada (Svix ou segredo partilhado).' },
      { icon: '🎯', title: 'Liga à conversa certa', detail: 'Casa pelo In-Reply-To/References com o email original (nurture ou mensagem enviada) e, em falha, pelo email do remetente. Nunca cria lead — só associa a contactos e negócios que já existem (contacto≠lead).' },
      { icon: '💬', title: 'Grava a mensagem na conversa', detail: 'Regista a resposta como mensagem inbound na aba Mensagens (assunto + corpo) e actualiza a conversa. Idempotente: a mesma resposta nunca entra duas vezes.' },
      { icon: '🧾', title: 'Escreve na timeline do negócio', detail: 'Acrescenta "Resposta do cliente por email" à timeline do negócio aberto do contacto, para a IA e o João verem a conversa dos dois lados. Se era resposta a um nurture, marca replied_at.' },
    ],
    note: 'É um webhook: dispara-se sozinho a cada email recebido (não tem horário nem botão de disparo). Precisa da configuração de inbound na Cloudflare/Resend (mão do João).',
  },
  'client-errors-alert': {
    steps: [
      { icon: '🔍', title: 'Lê os erros recentes do CRM', detail: 'Procura em client_errors os erros dos últimos minutos ainda sem alerta, agrupados por organização.', params: ['window_minutes'] },
      { icon: '⚖️', title: 'Compara com o limiar', detail: 'Só avança se houver pelo menos N erros na janela (rajada). Erros isolados não incomodam.', params: ['threshold'] },
      { icon: '📨', title: 'Avisa no Telegram', detail: 'Manda uma amostra de até 3 erros (origem + mensagem) para o teu chat do CRM.' },
      { icon: '✅', title: 'Marca como alertado', detail: 'Grava alerted_at nos erros avisados para nunca repetir o mesmo alerta.' },
    ],
  },
  'meta-ads-analyst': {
    steps: [
      { icon: '📊', title: 'Lê a performance dos anúncios', detail: 'Vai buscar os últimos 30 dias (gasto, impressões, cliques, leads Meta + leads no CRM, negócios ganhos) via meta_ads_performance.' },
      { icon: '🔢', title: 'Detecta anomalias por regra', detail: 'Sinaliza anúncios com gasto sem leads, CPL muito acima da média da conta, e CTR muito abaixo.' },
      { icon: '🧠', title: 'Pede o veredicto à IA', detail: 'Envia os dados ao motor de IA (Gemini com recurso a Claude) e recebe por anúncio: parar / aumentar / testar / manter + razão + impacto estimado em euros.' },
      { icon: '💾', title: 'Guarda a análise do dia', detail: 'Grava em ad_analyses (com confiança que cresce com mais dias de dados) para o painel de recomendações do /anuncios e o histórico.' },
      { icon: '📨', title: 'Avisa se houver anomalias', detail: 'Digest no Telegram com as 5 anomalias principais.' },
    ],
  },
  'backup-weekly': {
    steps: [
      { icon: '📦', title: 'Faz o dump de cada organização', detail: 'Exporta 17 tabelas críticas (contactos, negócios, actividades, imóveis, boards, etc.) para um JSON único por org.' },
      { icon: '🔒', title: 'Guarda no bucket privado', detail: 'Grava em backups/{org}/{ano-semana}.json no Storage (nunca público).' },
      { icon: '🧹', title: 'Aplica a retenção', detail: 'Mantém só os backups mais recentes; apaga os antigos além do limite.', params: ['retention'] },
    ],
  },
  'telegram-morning-brief': {
    steps: [
      { icon: '📅', title: 'Confirma o dia', detail: 'Salta fins de semana se assim estiver configurado (hora de Lisboa).', params: ['skip_weekends'] },
      { icon: '📈', title: 'Calcula os teus números', detail: 'Usa as métricas honestas (CHQ de hoje e da semana, reuniões + visitas, propostas abertas, receita ponderada, % da meta do ano).' },
      { icon: '🥶', title: 'Conta os negócios frios', detail: 'Negócios abertos parados há demasiados dias sem mexer.', params: ['cold_deals_days'] },
      { icon: '🗓️', title: 'Conta as tarefas do dia', detail: 'Tarefas por fazer: quantas são para hoje e quantas estão atrasadas (data de Lisboa).' },
      { icon: '📨', title: 'Manda o briefing', detail: 'Mensagem no Telegram com semáforo da meta, tarefas do dia, negócios frios e atalhos (/numeros, /chq, /menu).' },
      { icon: '🔔', title: 'Toca o sino no CRM', detail: 'Deixa o alerta das tarefas nas notificações do CRM (uma por dia, com link para o Painel), para veres ao abrir mesmo sem ler o Telegram.' },
    ],
  },
  'google-calendar-sync': {
    steps: [
      { icon: '🔌', title: 'Confirma a ligação', detail: 'Vê se a conta Google está ligada nesta organização (Definições → Integrações → Google Calendar). Se não estiver, não faz nada.' },
      { icon: '🔑', title: 'Renova o acesso', detail: 'Usa a credencial de renovação guardada no Vault para pedir ao Google um acesso fresco. O CRM nunca guarda a tua palavra-passe.' },
      { icon: '📅', title: 'Garante o calendário', detail: 'Confirma que o calendário dedicado "Foco Imo — Tarefas" existe; se o tiveres apagado, cria-o outra vez.' },
      { icon: '🗑️', title: 'Remove o que apagaste', detail: 'Tarefas apagadas no CRM saem do calendário (a fila guarda o evento até ser mesmo removido lá).' },
      { icon: '📤', title: 'Empurra as tarefas', detail: 'Cria ou actualiza o evento de cada tarefa por sincronizar: título, negócio, contacto, hora e link para o CRM. Concluídas ficam com ✓ à frente.' },
    ],
    note: 'Tempo real: a base de dados chama esta sincronização assim que uma tarefa muda. O cron de 10 em 10 minutos é só a rede de segurança. Um sentido só — o CRM manda, o Google reflecte, e o CRM não lê o resto da tua agenda.',
  },
  'social-inbox-sync': {
    steps: [
      { icon: '🔗', title: 'Puxa as conversas do Messenger', detail: 'Com o token da Página (Vault), lê as DMs recentes da Graph API (participante, última mensagem, quando).' },
      { icon: '🎯', title: 'Liga ao contacto do CRM', detail: 'Tenta fazer match do nome do participante com os teus contactos e o negócio aberto associado.' },
      { icon: '💾', title: 'Actualiza a Caixa Social', detail: 'Upsert em social_conversations e social_messages; marca quem precisa de resposta e filtra ruído de sistema.' },
      { icon: '📨', title: 'Avisa das novas por responder', detail: 'Digest no Telegram com link directo para Mensagens, aba Caixa Social (com dedup para não repetir).' },
    ],
    note: 'A IA prepara rascunhos na Caixa Social mas NUNCA envia: o envio é sempre teu.',
  },
  'meta-capi-forward': {
    steps: [
      { icon: '🏆', title: 'Procura negócios ganhos recentes', detail: 'Negócios marcados ganhos nos últimos 7 dias (salvaguarda da Meta) e ainda não reencaminhados.' },
      { icon: '💶', title: 'Calcula a comissão líquida', detail: 'Valor do negócio × comissão da org × parte do consultor (organization_settings).' },
      { icon: '📤', title: 'Envia a conversão à Meta', detail: 'Evento Purchase para o teu pixel (CAPI), com email/telefone do contacto em hash, para a Meta aprender quem fecha mesmo.' },
      { icon: '🧾', title: 'Marca e audita', detail: 'Grava capi_forwarded_at no negócio (idempotente) e regista em audit_logs.' },
    ],
  },
  'automation-schedule-tick': {
    steps: [
      { icon: '⏰', title: 'Verifica os horários programados', detail: 'A cada minuto, procura automações TUAS com gatilho de horário cuja hora chegou.' },
      { icon: '▶️', title: 'Dispara as devidas', detail: 'Invoca o executor (automation-execute) para cada automação cujo horário bateu.' },
    ],
    note: 'É o relógio das automações do utilizador. Sem isto, gatilhos por horário não disparam.',
  },
  'lead-followups': {
    steps: [
      { icon: '📅', title: 'Confirma o dia', detail: 'Nunca corre ao Domingo (configurável).', params: ['skip_sundays'] },
      { icon: '🎯', title: 'Calcula a leva do dia', detail: 'RPC deal_followups_due: negócios abertos, não adiados, fora do período de descanso e parados há demasiado tempo; leva rotativa para todos terem a vez.', params: ['followup_batch_size (definições da org)', 'followup_cooldown_days (definições da org)'] },
      { icon: '📝', title: 'Cria as tarefas', detail: 'Uma tarefa "Retomar contacto" por negócio, que aparece na tua mesa de trabalho (Inbox).' },
      { icon: '🔒', title: 'Marca o descanso', detail: 'Cada negócio da leva fica em cooldown para não ser repetido já no dia seguinte.' },
      { icon: '📨', title: 'Manda o digest', detail: 'Mensagem no Telegram com links clicáveis para cada contacto da leva.' },
    ],
  },
  'meta-insights-sync': {
    steps: [
      { icon: '🔑', title: 'Lê o token da Meta', detail: 'Token OAuth guardado no Vault (nunca exposto).' },
      { icon: '📊', title: 'Puxa as métricas dos anúncios', detail: 'Marketing API ao nível do anúncio, dia a dia (gasto, impressões, cliques, alcance, CTR, CPC, leads), com paginação.', params: ['lookback_days'] },
      { icon: '💾', title: 'Grava o histórico', detail: 'Upsert em ad_insights — é isto que alimenta /anuncios, o funil e o Cérebro (medição vitalícia, nunca se apaga).' },
      { icon: '🖼️', title: 'Sincroniza os criativos', detail: 'Para anúncios novos, guarda a imagem/tipo do criativo em ad_creatives (best-effort).' },
    ],
  },
  'cmi-watch': {
    steps: [
      { icon: '📅', title: 'Confirma o dia', detail: 'Nunca corre ao Domingo (configurável).', params: ['skip_sundays'] },
      { icon: '🏠', title: 'Percorre os CMI activos', detail: 'Para cada imóvel com CMI activo: dias até ao fim do contrato, negócios ligados, visitas e propostas.' },
      { icon: '⚖️', title: 'Avalia o risco', detail: 'Fim próximo ou imóvel parado sem visitas → gravidade alta/média/baixa + sugestão do que fazer.', params: ['alerta_fim_dias', 'sem_visita_dias'] },
      { icon: '📨', title: 'Manda o digest dos em risco', detail: 'Telegram com gravidade, morada, motivos e link para a ficha (1 alerta por dia no máximo, dedup).' },
    ],
  },
};

/** Nota comum a todas (mostrada no rodapé do fluxo). */
export const SYSTEM_FLOW_COMMON_NOTE =
  'Todas validam um segredo de cron à entrada e registam a corrida no fim (é isso que alimenta a "Última corrida"). ' +
  'O horário, os parâmetros e o ON/OFF mudam-se aqui sem código. A lógica dos passos vive em código de sistema: para a mudar, pede que eu mudo e o mapa actualiza.';
