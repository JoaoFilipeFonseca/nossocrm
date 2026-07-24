# PLANO — Arrumação do CRM (análise Fable 23/07/2026 · execução em sessão Opus)

> Decisões do João + análise de 8 ângulos. Este documento é o guião completo para a sessão
> de execução. Regras da casa aplicam-se todas (PT-PT pré-AO, nunca "avaliação", mobile
> 375/768, deploy = push→Vercel + teste real, bump versão sidebar).

---

## ⭐ PARTE 0 — DECISÕES FINAIS DO JOÃO (23/07 à noite) + SOLUÇÕES TÉCNICAS. EXECUTAR ISTO.

> O João decidiu tudo. Esta parte manda; a ordem antiga da Parte 5 fica substituída pela
> ordem no fim desta secção. Cada passo: `npm run precheck` verde → push → verificar no
> live → só então o passo seguinte. NUNCA gerar tudo de uma vez sem testar entre passos.

### W1 · Verdade única das chamadas + matar botões flutuantes ✅ FEITO (deploy 1)
**Decisão do João:** "o que montei agora prevalece e eliminamos os botões flutuantes — pouco,
simples e bem feito." O registo canónico (`deal_activities`) já era o caminho bom; os botões
flutuantes desapareceram para não haver caminhos paralelos.
1. ✅ Removido `<CHQFloatingButton />` de `ProtectedShell.tsx` + apagado `components/CHQFloatingButton.tsx`.
2. ✅ Removido `<VoiceCaptureFAB />` de `Layout.tsx` (ficheiro fica, desmontado).
- **Análise:** o quick-add do Kanban (`useBoardsController.ts:633`) NÃO é bug — agenda uma
  TAREFA futura (completed:false), logo pertence a `activities`. Correcto pela regra
  "feito→deal_activities, a fazer→activities".
- **Movido para W5:** o `CallModal` do cockpit (`handleCallLogSave`) grava em `activities`
  porque a PRÓPRIA timeline do cockpit-v2 lê de `activities`. Reencaminhar só a gravação
  partia a timeline. Unifica-se em W5, quando o cockpit passa a ler `deal_activities` — aí a
  chamada conta E aparece. Cockpit-v2 não é a rota por defeito hoje, logo sem impacto no uso diário.
- **Teste do João:** confirmar que os dois botões flutuantes (azul telefone + rosa microfone)
  desapareceram de todas as páginas, PC e mobile. Registo de chamada no /hoje e no modal
  Actividade do negócio continua a contar no Painel (caminho canónico intacto).

### W2 · Metas — UMA fonte única ✅ FEITO (deploy 4)
**Decisão:** "ou falam todos entre si ou apenas um local" → fonte única: `org_revenue_goals`.
- ✅ Migração: `org_revenue_goals` + weekly_conversas/cmi_mes/escrituras_mes/carteira_min.
- ✅ `/settings/metas` (API + UI): secção "Metas do dia a dia" com os 4 alvos.
- ✅ Power List (`/api/power-list`) lê `weekly_conversas` da fonte única (fallback params antigos).
- ✅ Painel: cartão "Metas · onde ando" (Facturação ano, Conversas semana, Escrituras mês, Carteira)
  via `/api/painel`. João já tinha meta anual 100.000€ (preservada); alvos do dia a dia seeded.
- **Capturado (follow-up, NÃO agora):** (a) Reports lê ainda `board.goal` — migrar para
  `org_revenue_goals` numa próxima; (b) actual de CMI/mês precisa de evento de entrada na etapa
  "CMI Assinado" (won proprietarios ≠ CMI) — por isso o Painel mostra Escrituras (won compradores,
  honesto) e não CMI; o alvo CMI fica guardado na fonte única.

**Detalhe original abaixo (referência):**
1. Migração idempotente: alargar `org_revenue_goals` com `weekly_conversas int` (default 25),
   `cmi_mes int` (default 2), `escrituras_mes int` (default 1), `carteira_min int` (default 5).
2. `/settings/metas` (`features/settings/metas/MetasSettings.tsx`) ganha estes campos — é a
   ÚNICA UI de metas do CRM.
3. Power List deixa de ler `automation.params.weekly_goal`: `app/api/power-list/route.ts:45`
   e `run/route.ts:210` lêem `org_revenue_goals.weekly_conversas` (fallback ao params antigo
   só para compat).
4. Reports: onde lê `selectedBoard.goal` (`features/reports/ReportsPage.tsx:63-67`), passa a
   ler de `org_revenue_goals` (Proprietários→cmi_mes, Compradores→escrituras_mes). O
   `BoardGoal` da Estratégia do Board fica como texto de contexto, sem número autoritativo.
5. `/api/painel` devolve metas + progresso; Painel mostra (facturação vs meta anual, conversas
   da semana vs weekly_conversas, carteira vs carteira_min).

### W3 · "Negócio parado" — uma só verdade + simplificar alertas
**Decisão:** todos dizem o mesmo; sim, simplificar.
1. `lib/deals/dealState.isAtRisk` = definição única. Corrigir para a usarem:
   `features/decisions/analyzers/stagnantDealsAnalyzer.ts` (hoje `daysSinceActivity>14`) e o
   fallback `isDealRotting` em `features/boards/hooks/useBoardsController.ts:178`.
2. Simplificação final: alertas de "parado/atrasado" ficam em DOIS sítios só —
   **banner do Painel** (verdade diária) e **indicadores no Kanban** (contexto ao trabalhar).
   `/decisions` sai da navegação (página fica por URL). O PipelineAlertsModal do dashboard
   legado (vista "Detalhado") mantém-se mas com `isAtRisk`.
3. **⚠️ O que morre com o Inbox — inventário pensado (ordem importa):**
   - `CallModal` → movido em W1 para `components/activity/` (não se perde).
   - `FocusContextPanel` → só o cockpit v1 o usa fora do inbox; morre quando v2 for promovido (W5).
   - `InboxBriefing` → morre; o briefing matinal já existe (Telegram + sino `system_notifications`).
   - Criação de negócio/contacto do inbox (`useInboxController`) → morre; existe em /contacts e no Kanban.
   - Sugestões IA do inbox (UPSELL/RESCUE/STALLED) → morrem com o inbox; sinal "parado" fica coberto
     pelo banner do Painel + Kanban. NÃO recriar noutro sítio sem ordem do João.
   - Rota `/inbox` → redirect `/hoje`. Código da feature inbox só se apaga DEPOIS do W5.

### W4 · Funis coerentes (3 APIs, mesma regra)
**Decisão:** têm de bater certo.
Regra única de contagem, escrita e aplicada nas três APIs (`/api/funnel`,
`/api/financeiro/funnel`, `/api/painel`): só `deleted_at is null`; aberto = `not is_won and
not is_lost`; fechado na janela = por `closed_at`. Auditar as duas primeiras (o painel já
cumpre) e corrigir onde divergirem. Sem unificar visuais — só os números.

### W5 · Cockpit único (v2 promove, v1 morre, inbox limpa-se) + verdade das chamadas
1. **Unificar a timeline + gravação do cockpit em `deal_activities`** (vindo do W1):
   - `DealCockpitClient` `dealActivities` (~:598) deixa de derivar de `useActivities`
     (tabela `activities`) e passa a ler a timeline canónica (`deal_activities`, ex.
     `useActivitiesByDeal`/`getDealTimeline`).
   - `handleCallLogSave` (~:1136) passa a `POST /api/deals/[id]/activities` com
     `{type:'call', result, description}`, mapeando o outcome do `CallModal`
     (connected→answered, no_answer→no_answer, voicemail→voicemail, busy→no_answer).
   - Mover `features/inbox/components/CallModal.tsx` → `components/activity/CallModal.tsx`.
   - Resultado: chamada no cockpit conta no Painel/power-list E aparece na timeline do cockpit.
2. `/deals/[dealId]/cockpit` passa a renderizar o `DealCockpitClient` (v2);
   `/deals/[dealId]/cockpit-v2` → redirect para `/deals/[dealId]/cockpit`.
3. Apagar `DealCockpitFocusClient.tsx` (v1).
4. SÓ AGORA: apagar a feature `features/inbox/` completa (CallModal já foi movido) e deixar
   `/inbox` como redirect `/hoje`.

### W6 · Um só agente IA
**Decisão:** resolver — um cérebro.
`features/ai-hub/hooks/useCRMAgent.ts` passa a falar com `/api/ai/chat` (o agente canónico
`lib/ai/crmAgent`). Antes de apagar `app/api/ai/crm-agent/route.ts`: comparar as tools inline
dele com as de `lib/ai/tools.ts` — as que faltarem no canónico, portar. Depois apagar a rota
e `features/ai-hub/tools/crmTools.ts` (grep zero refs).

### W7 · Código morto — apagar
**Decisão:** "se não está em uso, elimina."
Com grep a confirmar zero referências antes de cada delete:
- `features/boards/components/Modals/CreateDealModalV2.tsx`
- `features/activities/components/ActivityFormModalV2.tsx`
- `BoardAIConfigModal.tsx` duplicado: descobrir qual dos dois (features/boards vs
  features/settings) está montado; manter esse, apagar o outro, corrigir imports.
(Explicação para o João: são ficheiros de versões experimentais que ficaram para trás —
ninguém os abre, só confundem. Apagar não afecta nada.)

### W8 · Pesquisa global Ctrl+K — fazer já
**Decisão:** "bora fazer já isso."
1. `app/api/search/route.ts`: GET `?q=` (mín. 2 caracteres), org-scoped, devolve grupos:
   contactos (name/phone/email, máx. 8), negócios (title + nome do contacto, máx. 8),
   imóveis (referencia/morada/tipologia+concelho, máx. 8). ⚠️ TESTAR COM ACENTOS
   (memória `feedback_lookups_externos_unaccent`): usar `unaccent` se a extensão existir,
   senão ilike simples e documentar o limite.
2. `components/search/GlobalSearchModal.tsx`: abre com Ctrl+K / Cmd+K (listener no Layout)
   e com um botão de lupa na sidebar + na barra mobile. Input com debounce ~200ms, grupos,
   navegação por setas, Enter navega (`/contacts/[id]`, `/pipeline?deal=`, `/imoveis/[id]`),
   Esc fecha. Pode ligar ao `globalSearchQuery` já existente em `lib/stores/index.ts:64`.
3. Mobile: ocupa o ecrã inteiro, teclado abre sozinho.

### ORDEM FINAL DE EXECUÇÃO (substitui a da Parte 5)
1. **W1** chamadas + matar FAB → teste real no cockpit.
2. **Nav** (Parte 1): /inbox→redirect /hoje · Hoje no topo · Visão Geral 1º · "Tarefas" ·
   "Pipeline" (labels) — sem apagar código do inbox ainda.
3. **W8** pesquisa global Ctrl+K.
4. **W2** metas fonte única.
5. **Pipeline honesto** (Parte 2.1): etapa "Contactos" fora do pipeline previsto no
   /api/painel; mostrar "pipeline a trabalhar" vs "base por activar".
6. **W3** parado único + /decisions fora da nav.
7. **Cruzamentos unificado** (Parte 1.4): ingestão + matches numa página; /matches redirect.
8. **W5** cockpit único → limpar feature inbox.
9. **W6** um agente IA.
10. **W7** código morto + **W4** funis coerentes.
11. **Mão do João:** marcar ganhos históricos 2026; colar Estratégia dos boards (Parte 4);
    confirmar valores das metas em /settings/metas.

---

## PARTE 1 — DECISÕES JÁ TOMADAS PELO JOÃO (executar tal e qual)

### 1.1 Inbox deixa de existir
- Remover `/inbox` da navegação (NAV_TOP em `components/navigation/navConfig.ts`).
- `/inbox` passa a redirect → `/hoje` (mesmo padrão de `/caixa-social`, `/pipeline`, `/despesas`).
- A **Power List (/hoje)** assume a posição do Inbox no topo da nav, com o nome **"Hoje"**.
- No `/hoje`: acrescentar a barra vermelha de tarefas atrasadas (o Painel Diário já tem o
  componente `AtrasadasBanner` em `features/painel/PainelPage.tsx` — reutilizar).
- ⚠️ O `/inbox` tem o modo Focus cujo `FocusContextPanel` é reutilizado pelo cockpit v1
  (`features/deals/cockpit/DealCockpitFocusClient.tsx`). Ver 2.4 antes de apagar código —
  primeiro decide-se o cockpit, depois limpa-se a feature inbox.

### 1.2 Visão Geral no topo, sempre a abertura
- Mover a entrada "Visão Geral" (`/dashboard`) da família Análise para a 1ª posição da
  navegação principal (desktop + mobile/PRIMARY_NAV).
- Abertura por defeito já está: `user_settings.default_route = /dashboard` (feito 23/07),
  configurável em Definições → Página Inicial. Não mexer.

### 1.3 Renomes de menu (rotas mantêm-se, labels mudam)
- "Actividades" → **"Tarefas"** (navConfig + título da página /activities).
- "Boards" → **"Pipeline"** (navConfig + títulos; a rota `/boards` mantém-se, o redirect
  `/pipeline`→`/boards` já existe e continua a servir).

### 1.4 Unir Matches + Cruzamentos numa página só
- Página única na rota `/cruzamentos` com nome **"Cruzamentos"** e duas funções em abas
  (ou fluxo único):
  - **"Colar informação"** — o actual `/matches` (`features/matches/MatchesClient.tsx`):
    colar texto de WhatsApp/portais/notas → IA extrai e classifica para `raw_intel`.
  - **"Matches"** — o actual `/cruzamentos`: resultados do engine (`matches` ⨝ `raw_intel`
    ⨝ `imoveis`) com score e estados novo/contactado/ignorado.
- Fluxo ideal: colar → processar → mostrar logo os matches encontrados (a ingestão
  desagua na lista de resultados, sem mudar de página).
- `/matches` passa a redirect → `/cruzamentos`. Eliminar a tripla nomenclatura
  (title "Inbox Bruto" morre).

### 1.5 Funil mantém-se
- `/funil` fica como está (análise profunda de gargalos). Sem trabalho.

### 1.6 Metas nos Relatórios (ver Parte 3)

---

## PARTE 2 — ANÁLISE DE 8 ÂNGULOS (cliente: consultor que factura 2M€, tempo contado)

### 2.1 👔 Analista de dados
- **688 negócios "abertos" são ficção estatística**: a esmagadora maioria está na etapa
  "Contactos" (base de dados, não pipeline). O pipeline previsto de ~1,99M€ de comissão
  soma tudo como se fosse negócio real.
- **Correcção (alto impacto, baixo esforço):** no Painel e nos KPIs, a etapa "Contactos"
  sai do "Pipeline previsto" (ou pesar por probabilidade por etapa). Mostrar dois números:
  "Pipeline a trabalhar" (etapas ≥ Oportunidade) e "Base por activar" (Contactos).
- Registo é o calcanhar: 0 chamadas registadas, 3 tarefas. O CRM só mede o que se regista.

### 2.2 💰 Financeiro
- 0€ de facturação registada em 90 dias — negócios ganhos reais não estão marcados como
  ganhos no CRM. **Acção: sessão de 30 min do João a marcar o histórico de ganhos de 2026**
  (data de fecho + valor), senão Painel/Relatórios/Financeiro ficam cegos para sempre.
- Comissões dependem de `custom_fields` (commission_pct/share) — confirmar os defaults da
  org (5% / 50%) com os números reais do João.
- Linha "Créditos" sem casa: não há board nem produto. Decidir: registar créditos como
  negócios no board Parceiros com produto "Crédito" OU campo dedicado. (Opção no plano.)
- Sem metas configuradas → Relatórios e Painel não dizem "estás à frente ou atrás".

### 2.3 📣 Marketing
- Origens cruas e inconsistentes (`base-proprietarios-maia`, `import_remax_2026-05-21`,
  `ghl_pipeline_Comparadores`…). **Normalizar `contacts.source` para o vocabulário canónico**
  (FSBO/Radar, Meta Ads, Portais, Círculo, Chamada a frio, Referência, Site) — migração de
  dados única + normalização na entrada (edge `submit`/webhooks).
- A máquina de nurture (BRIEF 7) é o activo mais subaproveitado: 688 contactos em base ×
  cadência de 1 ano = o verdadeiro gerador de oportunidades. Já está no TODO (cadência 1 ano).
- Anúncios/Orgânico/Biblioteca/Cérebro: complementares, sem redundância — não mexer.

### 2.4 🤝 Vendas
- **Uma fila única de trabalho**: decisão do João já resolve (Hoje = Power List no topo).
- **Cockpit duplicado trava confiança**: `/deals/[id]/cockpit` (v1, wrapper do Focus) vs
  `cockpit-v2` (reescrita rica). **Recomendação: adoptar v2 como único**, redirect do v1,
  e só então limpar a feature inbox (1.1). Testar antes o fluxo de chamada+registo no v2.
- Registo de chamada a 1 toque em todo o lado onde há telefone (Hoje já tem; garantir no
  cockpit v2 e na página do contacto).

### 2.5 ⚙️ Processos
- O épico "Coração — processo por etapa" (capturado 18/06) continua a ser o maior buraco:
  cada etapa dos 2 funis precisa de processo definido (o que acontece, em quanto tempo,
  automatizado ou manual). A Estratégia do Board (Parte 4) é o primeiro passo formal.
- Definir SLA simples: lead nova → contacto em <5 min (Coração BRIEF 3 já faz email+push);
  Oportunidade → 3 tentativas em 72h; sem resposta → nurture.
- `/decisions` (fila de decisões local) sobrepõe-se ao Painel+Hoje. **Recomendação: retirar
  da navegação** (a página fica acessível por URL até decisão final do João).

### 2.6 🏠 Broker imobiliário
- **Carteira = 1 imóvel activo. Este é O gargalo do negócio** — nenhum CRM compensa
  carteira vazia. Tudo o que acelere angariação vem primeiro: radar FSBO diário (existe),
  campanha angariação Maia (criativos prontos em `ads/`), nurture proprietários.
- Rotina de revisão de preço: imóvel com X dias sem visita → tarefa automática "rever
  preço/estratégia" (o agente analista-propostas já existe para apoiar).
- Disciplina de registo de visitas/propostas por imóvel (alimenta carteira no Painel).

### 2.7 🧑‍💼 Dono do negócio (tempo contado)
- Menu tem ~20 entradas para 1 pessoa. Depois desta arrumação: topo = Painel · Hoje ·
  Mensagens · Tarefas; Vendas = Pipeline · Contactos · Imóveis · Cruzamentos; Marketing e
  Análise colapsadas. **Meta: o dia-a-dia inteiro em 4 cliques.**
- Rotas de laboratório fora da vista de produção: `/ai-test`, `/labs/*`, `/test/ai-modes`,
  `/cockpit-v2` (quando promovido, o `-v2` desaparece do URL).
- Cada ecrã deve responder "e agora o quê?" — páginas que só mostram dados sem acção
  directa (concluir/ligar/adiar) são custo, não ajuda.

### 2.8 📈 Empresário (micro-empresa que tem de dar lucro)
- O CRM está na fase de **consolidar, não acrescentar** ("grande e confuso" — palavras do
  dono). Congelar features novas até esta arrumação estar live e usada 2 semanas.
- Medir o negócio, não a ferramenta: facturação registada, CMI/mês, escrituras/mês,
  conversas/semana. As metas (Parte 3) tornam isto visível sem esforço.
- Custo do stack (Vercel+Supabase+Apify+Resend+Meta) deve entrar nas Despesas mensais
  fixas para o lucro do /financeiro ser verdadeiro.

---

## PARTE 3 — METAS (Relatórios + Painel deixarem de ser cegos)

Configurar em `/settings/metas` (já existe a página) e ligar a Relatórios + Painel:

| Meta | Valor proposto (João confirma/ajusta) | Onde aparece |
|---|---|---|
| Conversas reais / semana | **25** (estratégia Hora de Ouro) | Hoje (já existe) + Painel |
| CMI assinados / mês | **2** | Painel + Relatórios + board Proprietários |
| Escrituras (vendas) / mês | **1** | Painel + Relatórios + board Compradores |
| Facturação comissões / ano | **60.000 €** (a confirmar pelo João) | Painel (barra progresso) + Relatórios |
| Angariações activas em carteira | **≥ 5** | Carteira no Painel |

Implementação: ler metas em `/api/painel` e mostrar progresso (real vs meta, % e ritmo
necessário). Nos Relatórios, cada KPI ganha a linha "meta · desvio".

---

## PARTE 4 — ESTRATÉGIA DO BOARD (conteúdo pronto a colar pelo João)

### Board Proprietários (Vendedores)

**Regras de Entrada (o filtro):**
"Entram aqui proprietários com imóvel identificado para venda na Maia e concelhos vizinhos
(Porto, Matosinhos, Valongo, Trofa, Vila Nova de Famalicão), sempre com nome, telefone e
origem. Sinais de qualidade: pediu Estudo de Mercado, tem anúncio FSBO activo, respondeu a
campanha ou veio por referência. Não entram: contactos sem telefone válido, curiosos sem
imóvel concreto, imóveis fora da zona de trabalho."

**Objectivo (o alvo):**
- Nome do KPI: `CMI assinados`
- Tipo: # (QTD) · Meta: `24` por ano (2 por mês)
- Contexto: "Angariar é o motor de todo o negócio. Cada CMI em exclusivo na Maia vale em
média 5.000 a 7.000 € de comissão e cria procura de compradores em cadeia. Duas angariações
por mês sustentam a facturação anual e a presença de marca na zona."

**Agente (o executor):**
- Nome: `João` · Cargo: `Consultor Imobiliário — Maia`
- Comportamento: "Fala português de Portugal, tom profissional, directo e próximo, sem
pressão. Especialista local da Maia que fala com dados reais de mercado. Oferece sempre o
Estudo de Mercado gratuito, entregue em mãos em casa do proprietário — nunca usa a palavra
avaliação. Objectivo de cada conversa: marcar a reunião presencial. Nunca propõe Domingos;
sábados só de manhã. Respostas rápidas e frases curtas."

### Board Compradores

**Regras de Entrada (o filtro):**
"Entram aqui compradores com telefone válido e interesse concreto: responderam a um anúncio
de imóvel, pediram informação numa página de imóvel ou vieram por referência. Qualificar
cedo: orçamento, zonas pretendidas, tipologia e situação do financiamento (aprovado, em
análise ou por iniciar). Não entram: contactos sem telefone ou sem zona e tipologia
minimamente definidas."

**Objectivo (o alvo):**
- Nome do KPI: `Escrituras fechadas`
- Tipo: # (QTD) · Meta: `12` por ano (1 por mês)
- Contexto: "Um comprador qualificado com financiamento encaminhado fecha em 60 a 90 dias e
vale 3.000 a 5.000 € de comissão. Uma escritura por mês, somada às angariações, cria uma
facturação previsível. Um comprador bem servido torna-se vendedor e fonte de referências."

**Agente (o executor):**
- Nome: `João` · Cargo: `Consultor de Compradores`
- Comportamento: "Fala português de Portugal, rápido a responder (objectivo: menos de 5
minutos), tom prestável e concreto. Qualifica com naturalidade orçamento, zona, tipologia e
financiamento na primeira conversa. Objectivo de cada conversa: marcar visita, propondo
sempre dois horários concretos. Se o imóvel não servir, propõe alternativas da carteira.
Nunca propõe Domingos; sábados só de manhã."

---

## PARTE 6 — AUDITORIA FUNCIONAL PROFUNDA (23/07, varrimento de 8 eixos)

> Duplicação de FUNCIONALIDADES dentro/entre páginas (não de rotas). Top 5 por gravidade,
> com localizações exactas. Integrada na ordem de execução (Parte 5 revista abaixo).

### 6.1 🥇 DUAS TABELAS para "actividade" — chamadas que NÃO contam (o mais grave)
- Vocabulário canónico (`deal_activities`, `metadata.result`, vocab `lib/activities/vocab.ts`)
  é usado por: modal Actividade do negócio (`components/activity/ActivityLogForm.tsx:46`),
  CHQ FAB global (`components/CHQFloatingButton.tsx:82`), Power List
  (`app/api/power-list/action/route.ts:100,165`), ContactTimeline
  (`features/contacts/components/ContactTimeline.tsx:72`), FocusContextPanel (`:288`),
  CallUploadModal (Notta → `/api/calls/upload`).
- MAS: o **CallModal do cockpit v2** (`features/inbox/components/CallModal.tsx:14`) tem vocab
  próprio (`connected/busy/...`) e grava na tabela legada **`activities`** via
  `DealCockpitClient.tsx:1136→476` — e o **quick-add do Kanban**
  (`features/boards/hooks/useBoardsController.ts:633`) idem.
- **Consequência real: chamadas registadas no cockpit ou no Kanban NUNCA contam nas
  Tentativas/Realizadas do Painel, do /hoje nem do relógio de follow-up.** Mata a confiança.
- **Correcção:** CallModal e Kanban passam a escrever em `deal_activities` com o vocab
  canónico (mapear connected→answered, busy→no_answer). `activities` fica só para TAREFAS.

### 6.2 🥈 DOIS agentes IA de CRM
- `/api/ai/chat` → `lib/ai/crmAgent` (UIChat global, cockpit, ai-test) VS
  `/api/ai/crm-agent` → reimplementação inline ~666 linhas com tools próprias
  (`app/api/ai/crm-agent/route.ts`, usado só pelo AI Hub `/ai`).
- **Correcção:** um só agente (`lib/ai/crmAgent`); o AI Hub passa a usá-lo; a rota duplicada morre.

### 6.3 🥉 TRÊS fontes de metas que nunca se falam
- `/settings/metas` → `org_revenue_goals` (annual_target_eur, monthly[], daily_chq_target);
- meta semanal da Power List → `automation.params.weekly_goal` (`app/api/power-list/route.ts:45`, default 25);
- `BoardGoal` no board (`types/types.ts:365`) lido pelos Reports.
- **Correcção:** `org_revenue_goals` vira fonte única (com weekly_conversas e metas CMI/escrituras
  da Parte 3); power list e reports lêem de lá; BoardGoal ou lê de lá ou fica só narrativo.

### 6.4 QUATRO funis desenhados, TRÊS APIs de funil
- `components/charts/FunnelChart.tsx` (dashboard legado) · `GestorPanel.FunnelSection`
  (/api/financeiro/funnel) · `painel FunnelCard` (/api/painel) · `FunnelPage` (/api/funnel).
- Números podem discordar entre páginas. **Correcção (mínima):** garantir que as 3 APIs usam a
  MESMA regra (deals não apagados, mesma semântica de aberto/ganho); consolidar visual fica opcional.

### 6.5 ≥4 definições de "negócio parado/frio"
- Painel `atrasada` (server) · PipelineAlertsModal `isAtRisk` · decisions `daysSinceActivity>14`
  · Kanban `isAtRisk`/`isDealRotting`. Limiares diferentes → verdades diferentes por página.
- **Correcção:** uma função única (`lib/deals/dealState.isAtRisk` como verdade) usada por todos.

### 6.6 Código morto e homónimos (limpar sem dó)
- Órfãos nunca referenciados: `features/boards/components/Modals/CreateDealModalV2.tsx`,
  `features/activities/components/ActivityFormModalV2.tsx`.
- Dois componentes com o mesmo nome: `BoardAIConfigModal.tsx` em features/boards e em
  features/settings — unificar num só.
- `globalSearchQuery` existe no store (`lib/stores/index.ts:64`) — agora usado pela pesquisa Ctrl+K (opcional).
- `isDealRotting` (`features/boards/utils.ts` + `features/boards/hooks/useBoardsController.ts`) ficou
  SEM uso depois do W3 (todos passaram a `dealAtRisk`) — apagar as duas definições + `daysInStage` se orfão.

### 6.7 Em falta para um consultor de topo (não referido antes)
- **Pesquisa global (Ctrl+K)**: escrever um nome em qualquer página → contacto/negócio/imóvel.
  Hoje não existe; num CRM com 690 contactos é dos maiores poupa-tempo possíveis. (O estado
  no store já existe — falta a UI e o endpoint.)

## PARTE 5 — ORDEM DE EXECUÇÃO (⚠️ SUBSTITUÍDA pela ordem final da Parte 0 — usar a Parte 0)

1. **Verdade única das chamadas** (6.1): CallModal do cockpit + quick-add Kanban passam a
   `deal_activities` com vocab canónico. É o bug de confiança nº1 — vem primeiro.
2. **Nav + renomes** (1.1 sem apagar código, 1.2, 1.3): redirect /inbox→/hoje, Power List
   no topo, Visão Geral 1º, Tarefas, Pipeline. Rápido e visível.
3. **Unificar Cruzamentos** (1.4): página única com ingestão + matches; /matches redirect.
4. **Pipeline honesto** (2.1): "Contactos" fora do pipeline previsto no /api/painel; dois
   números (a trabalhar vs base por activar).
5. **Metas — fonte única** (Parte 3 + 6.3): `org_revenue_goals` alargada (weekly_conversas,
   cmi_mes, escrituras_mes); power list e reports lêem de lá; progresso no Painel e Relatórios.
6. **"Parado" com uma só definição** (6.5): todos os sítios usam `dealState.isAtRisk`.
7. **Cockpit único** (2.4): promover v2 (JÁ com o fix 6.1), redirect v1 → limpar feature inbox.
8. **Um só agente IA** (6.2): AI Hub passa a `lib/ai/crmAgent`; rota duplicada morre.
9. **Higiene** (2.3, 2.5, 2.7, 6.6): normalizar sources; /decisions fora da nav; labs/ai-test
   fora de produção; apagar órfãos (CreateDealModalV2, ActivityFormModalV2); unificar
   BoardAIConfigModal.
10. **Pesquisa global Ctrl+K** (6.7): contacto/negócio/imóvel de qualquer página.
11. **Funis coerentes** (6.4): alinhar as 3 APIs de funil na mesma regra de contagem.
12. **Mão do João (sem código):** marcar ganhos históricos de 2026 (2.2); colar Estratégia
    dos boards (Parte 4); confirmar valores das metas.

Cada passo: precheck verde → push → teste real no live → mobile 375/768 + escuro.

**Capturado (NÃO executar sem ordem):** board/produto para Créditos (2.2); rotina automática
de revisão de preço por imóvel parado (2.6); pesos de probabilidade por etapa (2.1, versão
avançada); remoção definitiva de /decisions (2.5 — por agora só sai da nav).
