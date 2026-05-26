# CLAUDE.md — Máquina de Automações Foco Imo

> **Para Claude Code**: Este é o ficheiro mestre. Lê-o por inteiro antes de qualquer execução. Depois lê os ficheiros referenciados na ordem indicada. Só então propõe um plano.

---

## 1. Identidade do projecto

| Campo | Valor |
|---|---|
| Produto | **Foco Imo** (CRM imobiliário pt-PT) |
| Repo | `github.com/JoaoFilipeFonseca/nossocrm` |
| Produção | `https://crm-joao.vercel.app` |
| Stack | Next.js 16 (App Router) + React 19 + TypeScript estrito + Supabase + Tailwind |
| BD | Supabase Postgres `zcqbbqrdbszzkpydrlmz` (us-west-2), RLS em todas as tabelas |
| Auth | Supabase Auth (cookie SSR via `@supabase/ssr`) |
| Hosting | Vercel (Next functions cap 60s) |
| Background | Supabase Edge Functions (Deno) com `EdgeRuntime.waitUntil` |
| Realtime | Supabase Realtime |
| IA | Gemini 2.5 Flash (primário) + Anthropic Haiku 4.5 (fallback) via `lib/ai/router.ts` |
| Multi-tenant | `organization_id` em todas as tabelas + RLS por org |
| i18n | pt-PT formal pré-AO 1990 (regra dura) |

---

## 2. Princípios não-negociáveis (gravados no design da máquina)

| Princípio | Como deve ser respeitado |
|---|---|
| **PT-PT formal pré-AO 1990** | UI: "contacto", "acção", "projecto", "objectivo", "negócio". Código: variáveis em inglês (`contact_id`), labels e textos em pt-PT. **Nunca pt-BR**. |
| **Zero em-dash e en-dash** | Aplicar `lib/ai/sanitize.ts` a TODO output IA. Em código e documentos: substituir por vírgula, parêntesis, dois-pontos. |
| **Nunca propor Domingos** em copy de comunicação | Validador comum nos átomos de scheduling. Sábado só de manhã. |
| **Multi-tenant SaaS-ready** | Cada tabela tem `organization_id NOT NULL` + RLS. Nada de hardcode de orgs. |
| **Plan-First workflow** | Antes de executar qualquer task não-trivial, propõe plano e espera aprovação. |
| **Webhooks nunca devolvem 500 em erro lógico** | Sempre 200 + registo em `client_errors_log`. |
| **Tema CRM azul-slate intocado** | `ai_brand_kits` é identidade pessoal do utilizador para outputs, nunca para chrome do CRM. |
| **Mobile-first em 5 breakpoints** | 320, 375, 414, 768, desktop. Builder visual adapta-se. |
| **"Quando lhe for oportuno"** | Nunca "Quando lhe der jeito". Já está nos prompts. |
| **1 commit = 1 mudança = 1 teste** | Verify-after-push obrigatório a cada commit. |
| **TypeScript strict EXIT=0** | Build não passa com `any` solto. |
| **Workflow Vercel + Playwright em produção** | Não testar só em preview local. |

---

## 3. O que estamos a construir, em uma frase

Uma **máquina de automações visual integrada no CRM Foco Imo**, onde o utilizador carrega em "Nova Automação", escolhe um trigger, compõe acções e lógica com drag and drop, e ativa. Substitui n8n, Make, Zapier internamente, com domínio do código e zero custo recorrente em ferramentas externas.

---

## 4. Stack da máquina de automações (alinhada com Foco Imo)

| Componente | Tecnologia | Notas |
|---|---|---|
| Workflow Engine | **Supabase Edge Functions (Deno)** | Sem limite de 60s. `EdgeRuntime.waitUntil` para espera longa. |
| Job Queue | **pg-boss** (Postgres-native) **ou** Edge Functions + `pg_cron` | Padrão Postgres, sem Redis novo. |
| Event Bus | **`pg_notify` + Supabase Realtime + tabela `automation_events`** | Já tens Realtime na stack. |
| Cron / Scheduler | **`pg_cron`** | Nativo Supabase. |
| Encriptação de credenciais | **`pgsodium`** ou Supabase Vault | Nativo Supabase. |
| Builder visual | **React Flow (XYFlow)** + **shadcn/ui** + **Zustand** | Zustand já está na stack. |
| Forms dinâmicos | **react-hook-form + zod** + JSON Schema | Padrão Foco Imo. |
| Templating de variáveis | **LiquidJS** (sintaxe `{{...}}`) | Standard. |
| IA | `lib/ai/router.ts` existente (`runWithFallback`) | NÃO duplicar. |
| Sanitização | `lib/ai/sanitize.ts` existente | Aplicado em TODO output IA. |
| Brand Kit | Ler de `ai_brand_kits` | Aplicado automaticamente em cada átomo IA. |
| Prompts | `ai_prompt_templates` (já existe) | Átomos IA podem referenciar templates por nome. |

---

## 5. Ordem de leitura dos documentos

Lê pela ordem. Cada documento referencia tabelas e ficheiros concretos.

| # | Ficheiro | O que contém | Tempo de leitura |
|---|---|---|---|
| 1 | `docs/automation-engine/00-overview.md` | Visão, objectivo, integração com Foco Imo, glossário | 5 min |
| 2 | `docs/automation-engine/01-architecture.md` | Os 5 órgãos, fluxo de execução, diagramas | 10 min |
| 3 | `docs/automation-engine/02-data-model.sql` | Schema SQL completo, RLS, índices, pronto a correr | 10 min |
| 4 | `docs/automation-engine/03-atoms-catalog.md` | Os 30 átomos com `configSchema` e `outputSchema` | 15 min |
| 5 | `docs/automation-engine/04-integrations-catalog.md` | Integrações: reutilização do existente + novas | 10 min |
| 6 | `docs/automation-engine/05-plugin-system.md` | Como criar átomos novos (extensibilidade) | 10 min |
| 7 | `docs/automation-engine/06-builder-ui.md` | Especificação UX do builder visual mobile-first | 15 min |
| 8 | `docs/automation-engine/07-sprint-plan.md` | Ordem de execução em sprints, tickets, definições de pronto | 10 min |
| 9 | `docs/automation-engine/code-templates/*` | Tipos TS, exemplos, schemas, prontos a copiar | Consulta |

**Tempo total de onboarding: ~85 minutos de leitura para ter contexto completo.**

---

## 6. Convenções de naming

| Tipo | Convenção | Exemplos |
|---|---|---|
| Tabelas BD | `automation_*` para tudo o que pertence à máquina | `automations`, `automation_executions`, `automation_triggers`, `automation_integrations`, `automation_credentials`, `automation_events` |
| Pastas | kebab-case | `automation-engine/`, `automacoes/` |
| Ficheiros TS | kebab-case | `event-bus.ts`, `workflow-engine.ts` |
| Plugins / átomos | kebab-case | `send-whatsapp.ts`, `ai-claude.ts` |
| IDs de átomos | dot.snake_case | `action.send_whatsapp`, `trigger.event`, `logic.wait_humanized` |
| Eventos do sistema | dot.snake_case | `contact.created`, `deal.stage.changed`, `message.received` |
| Tipos TypeScript | PascalCase | `AtomDefinition`, `ExecutionContext` |
| Constantes | UPPER_SNAKE_CASE | `MAX_RETRIES`, `DEFAULT_TIMEOUT_MS` |
| Variáveis em templates | snake_case dentro de `{{...}}` | `{{contact.first_name}}`, `{{trigger.payload.email}}` |

---

## 7. Localização do código

| Tipo | Localização |
|---|---|
| Páginas UI (Next.js App Router) | `/app/(dashboard)/automacoes/` |
| Lógica central da engine | `/lib/automation-engine/` |
| Plugins (átomos) | `/lib/automation-engine/plugins/` |
| Edge Functions | `/supabase/functions/automation-execute/` |
| Edge Functions (trigger handlers) | `/supabase/functions/automation-webhook/` |
| Migrations | `/supabase/migrations/` |
| Componentes UI do builder | `/components/automations/` |
| Hooks | `/hooks/use-automation-*.ts` |
| Tipos partilhados | `/lib/automation-engine/types.ts` |

---

## 8. Regras de execução para Claude Code

| Regra | Detalhe |
|---|---|
| Lê tudo antes de propor | Não começar a codar sem ter lido a ordem do ponto 5 |
| Plan-First | Antes de cada sprint, propõe plano de execução, espera "ok" |
| 1 commit = 1 mudança lógica | Não commits monstro |
| Verify-after-push | Após cada push, validar deploy Vercel + smoke test |
| Sanitização IA obrigatória | Todo prompt IA tem `sanitize()` no output |
| Multi-tenant em TUDO | Toda query nova filtra por `organization_id` |
| PT-PT formal pré-AO | Toda UI nova em "contacto/acção/objectivo/negócio" |
| Zero em-dash | Substituir por vírgula/parênteses/dois-pontos sempre |
| TypeScript strict | `any` proibido, ZodSchema para validação |
| RLS em todas as tabelas novas | Política mínima: utilizadores só vêem o que pertence à sua org |
| Mobile-first | Validar em 320px e 375px antes de desktop |
| Reutiliza, não duplica | Antes de criar, pesquisa se já existe em `lib/` |

---

## 9. Integração com infraestrutura existente

| Sistema existente | Como a máquina o usa |
|---|---|
| `lib/ai/router.ts` (Gemini + Anthropic fallback) | Backend do átomo `action.ai_operation` |
| `lib/ai/sanitize.ts` | Wrap automático em outputs IA |
| `lib/ai/cache.ts` | Cache de prompts dos átomos IA |
| `ai_brand_kits` | Contexto injectado em cada átomo IA |
| `ai_prompt_templates` | Átomos IA podem referenciar template por nome |
| `deal_activities` | Cada nó de comunicação regista activity automática |
| `creative_archive` | Auto-arquivar copy gerada pelos átomos |
| `messaging_conversations` + `messaging_messages` | Backend do átomo `action.send_whatsapp` |
| `messaging-webhook-meta` (Edge Function) | Reusada para envio WhatsApp |
| `raw_intel` | Trigger natural: "novo raw_intel com intent=X" |
| `matches` | Trigger natural: "novo match com score ≥ N" |
| GHL polling cron | Emite eventos no `automation_events` |
| Telegram router universal | Trigger "comando Telegram" + acção "notificar Telegram" |
| `webhook_deliveries` | Auditoria de webhooks da engine |
| `client_errors_log` | Erros de execução |
| `automation_logs` (já existe) | Estender, não substituir |
| Supabase Realtime | Builder mostra execuções a correr ao vivo |

---

## 10. Critérios de sucesso do MVP

A máquina está pronta quando estes 10 cenários funcionam end-to-end em produção:

| # | Cenário | Critério |
|---|---|---|
| 1 | Criar automação simples (trigger + 2 acções) via builder visual | Tempo < 5 min |
| 2 | Aniversário de escritura → email + WhatsApp vídeo + carta física | Multi-canal orquestrado |
| 3 | Lead Meta Ads → wait humanizado → IA gera msg → WhatsApp | Sintonizado com tom Foco Imo |
| 4 | Webhook externo (Idealista) dispara automação | 200 sempre, mesmo em erro |
| 5 | Schedule diário 08:00 → scraping FSBO → cria contactos | Cron + Playwright |
| 6 | Wait until "lead responde OU 24h" → branch | Esperas condicionais |
| 7 | Loop sobre array de imóveis → acção por cada | Iteração |
| 8 | Modo teste com contacto real → mostra cada output | Debug visual |
| 9 | Histórico mostra execução com inputs e outputs de cada nó | Observabilidade |
| 10 | Mobile (375px): criar e ativar automação simples | Mobile-first cumprido |

---

## 11. O que NÃO fazer

| Anti-padrão | Razão |
|---|---|
| Adicionar Redis como dependência | Já temos Supabase. Não complicar infra. |
| Usar Prisma ORM | Stack é Supabase Client. |
| Criar tabelas sem RLS | Quebra multi-tenant. |
| Pôr prompts hardcoded em código | `ai_prompt_templates` existe para isto. |
| Reescrever `lib/ai/router.ts` | Já está validado. |
| Usar pt-BR em qualquer string visível | Hard rule. |
| Em-dash em outputs | Hard rule. |
| Workflows pesados em API routes Next.js | Cap 60s. Usar Edge Functions. |
| Pôr `organization_id` opcional em tabelas novas | Quebra multi-tenant. |
| Criar UI sem mobile-first | Regra do projeto. |
| Commit grandes com várias mudanças | 1 commit = 1 mudança. |
| Saltar Plan-First | Princípio gravado em memory. |

---

## 12. Suporte e fallbacks

Quando Claude Code estiver bloqueado:

| Situação | Fallback |
|---|---|
| Schema SQL não corre | Verificar conflitos com tabelas existentes via `select * from information_schema.tables` |
| Edge Function falha | Logs em `supabase functions logs <nome>` |
| Plugin não carrega | Verificar export default + interface `AtomDefinition` |
| RLS bloqueia query | Usar `service_role` apenas em Edge Functions, nunca client |
| Realtime não actualiza | Verificar `REPLICA IDENTITY FULL` na tabela |
| Gemini timeout | Router já tem fallback Anthropic. Verificar `runWithFallback` |
| Output com em-dash | Verificar que `sanitize()` foi chamado |

---

## 13. Status

| Bloco | Estado |
|---|---|
| Documentação técnica completa | ✅ (este pacote) |
| Schema SQL | ✅ (ver `02-data-model.sql`) |
| Tipos TypeScript | ✅ (ver `code-templates/types.ts`) |
| Exemplo de átomo completo | ✅ (ver `code-templates/example-atom-send-whatsapp.ts`) |
| Edge Function workflow executor | ⏳ Sprint 1 |
| Builder visual | ⏳ Sprint 2 |
| Catálogo de átomos completo | ⏳ Sprints 3 a 7 |

---

**Fim do CLAUDE.md. Lê agora `00-overview.md`.**
