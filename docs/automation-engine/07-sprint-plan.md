# 07 — Plano de Execução em Sprints

> **Pré-requisito**: Lê `06-builder-ui.md` primeiro.

Este documento divide a construção da máquina em sprints executáveis. Cada sprint tem objectivo, tickets, definição de pronto, e validação.

**Princípios**:
- Plan-First: cada sprint começa com plano detalhado proposto a João
- 1 commit = 1 mudança = 1 teste, verify-after-push
- TypeScript strict EXIT=0 obrigatório
- Mobile-first em features de UI
- RLS em todas as tabelas novas

---

## Sprint 0 — Fundações (1 semana)

### Objectivo
Preparar a infraestrutura: migration SQL, tipos TypeScript base, estrutura de pastas.

### Tickets

| # | Ticket | Definição de pronto |
|---|---|---|
| 0.1 | Criar migration `automation_engine_initial.sql` em `/supabase/migrations/` | `supabase db push` corre sem erros, tabelas visíveis no dashboard Supabase |
| 0.2 | Criar tipos TS base em `/lib/automation-engine/types.ts` | Compila com `tsc --noEmit`, sem `any` solto |
| 0.3 | Criar estrutura de pastas (`/lib/automation-engine/`, `/components/automations/`, `/app/(dashboard)/automacoes/`) | Pastas existem com `index.ts` placeholder |
| 0.4 | Configurar Supabase Realtime nas 3 tabelas críticas | `automation_executions`, `automation_node_executions`, `automation_events` aparecem em "Realtime > Tables" |
| 0.5 | Validar RLS em todas as tabelas novas | Query como utilizador autenticado só vê linhas da sua org |
| 0.6 | Adicionar triggers de publicação de eventos em `contacts` e `deals` | Insert/update em contacts/deals cria linha em `automation_events` |
| 0.7 | Documentar setup local em `/docs/automation-engine/SETUP.md` | Outro developer (ou Claude futuro) consegue replicar |

### Validação Sprint 0
- [ ] Todas as tabelas existem na BD de produção
- [ ] RLS valida por organização
- [ ] Eventos `contact.created` e `deal.stage.changed` aparecem em `automation_events` ao testar
- [ ] Build Vercel passa com TypeScript strict EXIT=0

---

## Sprint 1 — Núcleo do Motor (3 semanas)

### Objectivo
Engine de execução básica que corre uma automação simples (trigger → 2 acções) end-to-end.

### Tickets

| # | Ticket | Definição de pronto |
|---|---|---|
| 1.1 | Implementar Registry em `/lib/automation-engine/registry.ts` com auto-discovery | `registry.list()` devolve plugins descobertos automaticamente |
| 1.2 | Implementar Event Bus wrapper sobre Supabase Realtime | Subscrição a eventos funciona em desenvolvimento |
| 1.3 | Implementar `LiquidJS` template resolver em `/lib/automation-engine/template.ts` | `resolveVariables('{{contact.first_name}}', {contact: {first_name: 'João'}})` devolve `'João'` |
| 1.4 | Criar Edge Function `automation-execute` em `/supabase/functions/automation-execute/` | Deploy via `supabase functions deploy automation-execute` |
| 1.5 | Implementar 5 átomos mínimos: `trigger.event`, `trigger.schedule`, `action.http_request`, `action.send_email` (Resend), `logic.wait_fixed` | Cada um tem `execute()` testada |
| 1.6 | API route POST `/api/automations` (criar automação via JSON) | Insere em `automations` table |
| 1.7 | API route POST `/api/automations/[id]/execute` (disparar manualmente) | Cria execução, invoca Edge Function |
| 1.8 | Integrar Resend para envio de email | Email teste chega à caixa de João |
| 1.9 | Implementar listener de eventos: subscreve `automation_events`, encontra automações com trigger correspondente, invoca executor | Inserir contact → automação dispara |
| 1.10 | Cron `pg_cron` minutário para `automation-cron` Edge Function (processa schedules) | Schedule de teste dispara à hora marcada |

### Validação Sprint 1
- [ ] Cria via API uma automação simples: trigger event `contact.created` → send_email "Olá novo contacto"
- [ ] Inserir novo contacto na BD → email chega
- [ ] Execução fica registada em `automation_executions` com status `completed`
- [ ] Cada nó executado fica registado em `automation_node_executions`

---

## Sprint 2 — Builder Visual (4 semanas)

### Objectivo
UI completo onde João cria automações via drag and drop.

### Tickets

| # | Ticket | Definição de pronto |
|---|---|---|
| 2.1 | Página `/automacoes` (lista) com TanStack Query + Realtime | Lista actualiza ao vivo quando se cria/edita |
| 2.2 | Wizard `/automacoes/nova` (passo 1 + 2 + criar) | Cria automação rascunho e redirecciona para builder |
| 2.3 | Setup React Flow (`@xyflow/react`) em `/components/automations/Canvas.tsx` | Canvas básico renderiza |
| 2.4 | Sidebar Palette com átomos por categoria, drag and drop para canvas | Arrastar átomo cria nó |
| 2.5 | Painel direito de configuração (gerado de JSON Schema via `@rjsf/core` ou custom) | Editar configuração de um nó guarda no estado |
| 2.6 | Sistema de variáveis com autocomplete `{{...}}` em campos de texto | Digitar `{{` mostra dropdown |
| 2.7 | Conectar nós com edges, validar fluxo (não cíclico) | Edges criadas, validação visual de erros |
| 2.8 | Save/Load: serializar canvas para JSON `definition`, criar nova versão em `automation_versions` | Refresh recupera estado |
| 2.9 | Modo Teste: modal de configuração + executar com payload + ver estados ao vivo via Realtime | Cada nó muda de cor durante execução de teste |
| 2.10 | Botão Activar com validação (trigger configurado, sem erros) | Status muda para `active`, cria entrada em `automation_triggers` |
| 2.11 | Versão mobile: vista de lista vertical alternativa (320-767px) | Funcional em iPhone SE (375px) |
| 2.12 | Undo/Redo (Ctrl+Z) | 10+ passos de histórico |

### Validação Sprint 2
- [ ] No browser, criar automação completa do zero em <5 min
- [ ] Salvar, recarregar página, edição preservada
- [ ] Testar com contacto real, ver execução nó a nó
- [ ] Activar, lead criado dispara automação real
- [ ] Em mobile (375px), criar e activar automação simples

---

## Sprint 3 — Comunicação Multi-Canal (2 semanas)

### Objectivo
Integrar WhatsApp, Gmail, SMS e IA como átomos completos.

### Tickets

| # | Ticket | Definição de pronto |
|---|---|---|
| 3.1 | Plugin `action.send_whatsapp` que invoca `messaging-webhook-meta` existente | Envia WA real através da config existente |
| 3.2 | Plugin `action.ai_operation` que usa `lib/ai/router.ts` (`runWithFallback`) + sanitize + brand kit | Output sanitizado, em pt-PT formal, sem em-dash |
| 3.3 | Plugin `action.send_email` com Gmail OAuth | Envia via Gmail conectado |
| 3.4 | Integração Gmail OAuth: `/api/automation/oauth/google/start` + callback + guardar token encriptado | João conecta Gmail e aparece em lista de integrações |
| 3.5 | Plugin `action.send_sms` (Twilio) | Envia SMS real |
| 3.6 | Plugin `action.send_communication` (canal configurável) | UI unificada para escolher canal |
| 3.7 | Plugin `action.modify_contact` (CRUD contactos) | Aplica tags, muda etapa |
| 3.8 | Plugin `action.modify_deal` | Cria/atualiza/move negócios |
| 3.9 | Integração Brand Kit: átomo IA carrega `ai_brand_kits` da org automaticamente | Output respeita tom de voz |
| 3.10 | Auto-arquivar copy gerada em `creative_archive` | Mensagens IA aparecem no arquivo de criativos |

### Validação Sprint 3
- [ ] Automação: lead criado → IA gera mensagem → envia WA
- [ ] Mensagem WA chega ao telefone com tom Foco Imo, sem em-dash
- [ ] Activity registada em `deal_activities`
- [ ] Copy gerada aparece em `creative_archive`

---

## Sprint 4 — Lógica Avançada (2 semanas)

### Objectivo
Esperas inteligentes, ramificações, paralelismo, goals.

### Tickets

| # | Ticket | Definição de pronto |
|---|---|---|
| 4.1 | Plugin `logic.wait_until` (esperar até evento OU timeout) | Automação retoma quando evento esperado chega |
| 4.2 | Plugin `logic.wait_humanized` (random dentro de janela) | Tempos aleatórios respeitados |
| 4.3 | Plugin `logic.condition` (if/else) com expressões LiquidJS | Ramificação correcta consoante condição |
| 4.4 | Plugin `logic.switch` (múltiplos caminhos) | N saídas no canvas |
| 4.5 | Plugin `logic.loop` (sobre arrays) | Itera correctamente, com max_iterations |
| 4.6 | Plugin `logic.parallel` (ramos em paralelo) | Executa em simultâneo, junta no fim |
| 4.7 | Plugin `logic.filter` (continua se condição) | Skips funcionam |
| 4.8 | Plugin `data.goal` (sai do fluxo se goal atingido) | Automação termina cedo |
| 4.9 | Validar "nunca Domingos" em todas as esperas que envolvem comunicação | Regra activa em wait_fixed, wait_humanized, schedule |
| 4.10 | Implementar suspend/resume robusto para waits longos via `automation_schedules` | Wait de 24h funciona mesmo com Edge Function a reiniciar |

### Validação Sprint 4
- [ ] Cenário aniversário escritura: T-7 email teaser, T-0 email + WA, funciona end-to-end
- [ ] Wait until "lead responde OU 24h" branchwa correctamente
- [ ] Loop sobre 50 imóveis processa todos sem timeout

---

## Sprint 5 — Integrações Core (3 semanas)

### Objectivo
Integrações com Meta Ads, Google Drive, Calendar, Calendly, Stripe.

### Tickets

| # | Ticket | Definição de pronto |
|---|---|---|
| 5.1 | Sistema OAuth genérico em `/lib/automation-engine/oauth/` | Helper reutilizável por qualquer integração OAuth |
| 5.2 | Integração Meta Ads: OAuth + plugin de trigger "novo lead form" + plugin de acção "criar audiência" | Lead Form testado chega ao CRM |
| 5.3 | Integração Google Drive: OAuth + plugins (upload, download, criar pasta, partilhar) | Upload de PDF funciona |
| 5.4 | Integração Google Calendar: triggers (evento criado/X min antes) + actions (criar/atualizar evento) | Sync bidireccional básico |
| 5.5 | Integração Calendly: webhook trigger "reunião marcada" | Reunião marcada cria deal |
| 5.6 | Integração Stripe: triggers de pagamento + acção criar link | Link de pagamento gerado |
| 5.7 | Integração Notion: actions CRUD pages | Cria página em workspace |
| 5.8 | Página `/automacoes/integracoes` (gestão) | Lista, conectar, desconectar, status |
| 5.9 | Encriptação de credenciais com `pgsodium` em `automation_credentials` | Token nunca aparece em texto plano em queries |
| 5.10 | Refresh token automático antes de expirar (cron de manutenção) | Tokens OAuth renovam-se sem intervenção |

### Validação Sprint 5
- [ ] Conectar Meta Ads, configurar Lead Form, lead chega ao CRM via webhook
- [ ] Automação "lead Meta → WhatsApp humanizado → criar deal" funciona end-to-end
- [ ] Conectar Gmail, Google Drive, Calendar via UI sem código

---

## Sprint 6 — Documentos, IA Avançada e Web (2 semanas)

### Objectivo
Geração de documentos, scraping, IA com structured output.

### Tickets

| # | Ticket | Definição de pronto |
|---|---|---|
| 6.1 | Plugin `action.generate_document` (PDF via Puppeteer ou similar Edge-compatible) | Gera CMA report em PDF |
| 6.2 | Plugin `action.web_operation` (Playwright em Edge Function dedicada) | Scraping de uma página simples funciona |
| 6.3 | Templates de documento guardados em BD (`automation_document_templates`) | Reutilizáveis em várias automações |
| 6.4 | Plugin IA com `output_format: 'structured'` (JSON Schema) | Output respeitando schema, validado |
| 6.5 | Storage bucket `automation-attachments` com RLS por org | Ficheiros gerados ficam acessíveis |
| 6.6 | Integração Apify (executar actor, obter resultados) | Scraping de remax.pt via Apify funciona |
| 6.7 | Plugin `action.physical_mail` (Lob ou Pingen) | Carta de teste enviada e entregue |

### Validação Sprint 6
- [ ] Automação: deal won → gera CMA PDF → envia por email com anexo
- [ ] Cron diário: scraping Custojusto → IA classifica → cria contactos FSBO

---

## Sprint 7 — Observabilidade e Polish (2 semanas)

### Objectivo
Histórico, replay, dashboards, alertas, versionamento.

### Tickets

| # | Ticket | Definição de pronto |
|---|---|---|
| 7.1 | Página `/automacoes/[id]/execucoes` com filtros + paginação | Lista carrega <500ms |
| 7.2 | Página detalhe de execução com inputs/outputs por nó | Útil para debug |
| 7.3 | Botão Replay (re-executa desde nó X com mesmos inputs) | Funcional |
| 7.4 | Dashboard `/automacoes/dashboard` com KPIs (total exec, taxa sucesso, custos IA, top automações) | Métricas em tempo real |
| 7.5 | Sentry integration para erros das Edge Functions | Erros aparecem no Sentry |
| 7.6 | Notificações Telegram para falhas críticas (>5% taxa de erro em 1h) | João recebe alerta |
| 7.7 | Versionamento de automações: comparar versões, rollback | Botão "Rollback v2" funciona |
| 7.8 | Documentação inline (help contextual em cada átomo) | Hover/tap mostra docs |
| 7.9 | Sweep PT-PT: garantir UI nova usa "negócio" não "deal" (B-007) | Audit visual completo |
| 7.10 | Plug-in `obs.log`, `obs.notify_internal`, `obs.track_metric` | Disponíveis no palette |

### Validação Sprint 7
- [ ] Replay de execução completa funciona
- [ ] Dashboard mostra: execuções hoje, taxa sucesso semana, top 5 automações, custos IA mês
- [ ] Telegram avisa quando falha taxa cruza threshold

---

## Sprint 8 e seguintes — Catálogo de Integrações (contínuo)

A partir do Sprint 7, cada sprint adiciona 3-5 integrações novas conforme prioridade:

| Prioridade alta | Prioridade média |
|---|---|
| Idealista/Imovirtual (scraping) | Slack, Discord |
| Casafari (CMA API) | HubSpot, Pipedrive |
| HighLevel (migração) | Asana, ClickUp, Linear |
| ElevenLabs (voz) | DocuSign |
| Twilio Voice (chamadas) | Mailchimp |
| Outlook + Microsoft 365 | TikTok / LinkedIn Ads |
| Vapi.ai (voice agents) | Geocoding (Google Maps) |

---

## Cronograma estimado

| Sprint | Duração | Acumulado |
|---|---|---|
| Sprint 0 | 1 sem | 1 sem |
| Sprint 1 | 3 sem | 4 sem |
| Sprint 2 | 4 sem | 8 sem |
| Sprint 3 | 2 sem | 10 sem |
| Sprint 4 | 2 sem | 12 sem |
| Sprint 5 | 3 sem | 15 sem |
| Sprint 6 | 2 sem | 17 sem |
| Sprint 7 | 2 sem | 19 sem |
| Sprint 8+ | contínuo | - |

**MVP utilizável em produção: fim do Sprint 3 (~10 semanas).**
**Máquina completa profissional: fim do Sprint 7 (~19 semanas).**

---

## Critérios de sucesso global

A máquina está pronta para produção quando os 10 cenários do `CLAUDE.md` ponto 10 funcionam end-to-end:

1. ✅ Criar automação simples via builder visual em <5 min
2. ✅ Aniversário de escritura (multi-canal orquestrado)
3. ✅ Lead Meta Ads → WhatsApp humanizado
4. ✅ Webhook externo (Idealista) com 200 sempre
5. ✅ Schedule diário → scraping FSBO → cria contactos
6. ✅ Wait until "lead responde OU 24h"
7. ✅ Loop sobre array de imóveis
8. ✅ Modo teste com contacto real
9. ✅ Histórico com inputs/outputs por nó
10. ✅ Mobile (375px): criar e activar automação

---

## Como executar este plano (workflow Plan-First)

Para cada sprint, Claude Code deve:

1. **Ler** este documento + `CLAUDE.md` + docs relevantes
2. **Propor plano** detalhado de execução do sprint:
   - Lista de commits previstos
   - Ficheiros a criar/modificar
   - Validações a fazer
   - Riscos identificados
3. **Aguardar aprovação** do João
4. **Executar** ticket a ticket:
   - 1 commit por ticket
   - Verify após cada push (deploy Vercel + smoke)
   - Atualizar este documento se mudanças necessárias
5. **No fim do sprint**:
   - Validar critérios de pronto
   - Demo a João
   - Plano do sprint seguinte

---

## Pronto a começar

Tudo o que está neste pacote é suficiente para Claude Code iniciar Sprint 0 com plano detalhado. Próximo passo: João lê o pacote, valida, dá luz verde, e começa.
