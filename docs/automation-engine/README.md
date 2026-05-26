# Máquina de Automações Foco Imo

Pacote técnico completo para Claude Code construir a máquina de automações visual integrada no CRM Foco Imo. Substitui n8n, Make e Zapier internamente.

## Como usar este pacote

Este pacote é para colar dentro do repositório `nossocrm`, em `/docs/automation-engine/`. Claude Code vai ler `CLAUDE.md` primeiro e depois os documentos pela ordem indicada.

### Passos para integrar no repo

```bash
# Na raiz do repo nossocrm
mkdir -p docs/automation-engine
cp -r docs-automation-engine-pack/* docs/automation-engine/
git add docs/automation-engine
git commit -m "docs: pacote técnico inicial da máquina de automações"
```

### Iniciar com Claude Code

```bash
claude-code "Lê docs/automation-engine/CLAUDE.md, depois propõe plano detalhado para o Sprint 0."
```

Claude Code lê o pacote completo (cerca de 85 min equivalente humano) e propõe plano de execução. O João aprova, e arranca.

## Estrutura

| Ficheiro | O que é |
|---|---|
| `CLAUDE.md` | Mestre. Princípios, stack, regras. Claude Code lê primeiro. |
| `00-overview.md` | Visão, problema, solução, fit com Foco Imo |
| `01-architecture.md` | Arquitetura Supabase-native, 5 órgãos, fluxo de execução |
| `02-data-model.sql` | Migration SQL completa, 10 tabelas + RLS + triggers |
| `03-atoms-catalog.md` | Especificação dos 30 átomos com schemas |
| `04-integrations-catalog.md` | Integrações por tier, padrão de implementação |
| `05-plugin-system.md` | Como criar átomos novos |
| `06-builder-ui.md` | UX completo do builder visual mobile-first |
| `07-sprint-plan.md` | 8 sprints com tickets, definição de pronto, cronograma |
| `code-templates/types.ts` | Interface AtomDefinition e tipos partilhados |
| `code-templates/registry.ts` | Carregador de plugins |
| `code-templates/event-bus.ts` | Wrapper Supabase Realtime |
| `code-templates/template.ts` | Resolver LiquidJS de variáveis |
| `code-templates/workflow-engine.edge.ts` | Edge Function de execução |
| `code-templates/example-atom-send-whatsapp.ts` | Plugin completo de exemplo |

## Decisões arquiteturais principais

| Componente | Escolha | Porquê |
|---|---|---|
| Workflow Engine | Supabase Edge Functions (Deno) | Sem cap de 60s, alinhado com stack |
| Event Bus | pg_notify + Supabase Realtime | Já está na stack, zero dependência nova |
| Job Queue | pg-boss ou pg_cron + Edge Functions | Postgres-native, sem Redis |
| Cron | pg_cron | Nativo Supabase |
| Encriptação | pgsodium | Nativo Supabase |
| Builder Canvas | React Flow + Zustand + shadcn/ui | Industry standard, Zustand já está na stack |
| Templating | LiquidJS | Sintaxe `{{...}}`, seguro |
| IA | `lib/ai/router.ts` existente | Reutiliza Gemini → Anthropic fallback |
| Sanitização | `lib/ai/sanitize.ts` existente | Zero em-dash garantido |

## Princípios não-negociáveis

- PT-PT formal pré-AO 1990 (contacto/acção/objectivo/negócio)
- Zero em-dash e en-dash em outputs IA
- Nunca propor Domingos em copy de comunicação
- Multi-tenant SaaS-ready (`organization_id` + RLS em tudo)
- Plan-First workflow
- Webhooks nunca devolvem 500 em erro lógico
- Tema azul-slate intocado
- Mobile-first em 5 breakpoints
- 1 commit = 1 mudança = 1 teste, verify-after-push
- TypeScript strict EXIT=0

## Cronograma

| Sprint | Objectivo | Duração | Acumulado |
|---|---|---|---|
| 0 | Fundações (SQL + tipos) | 1 sem | 1 sem |
| 1 | Núcleo do motor | 3 sem | 4 sem |
| 2 | Builder visual | 4 sem | 8 sem |
| 3 | Comunicação multi-canal | 2 sem | 10 sem |
| 4 | Lógica avançada | 2 sem | 12 sem |
| 5 | Integrações core | 3 sem | 15 sem |
| 6 | Documentos + IA + Web | 2 sem | 17 sem |
| 7 | Observabilidade + polish | 2 sem | 19 sem |

**MVP utilizável: ~10 semanas.**
**Máquina completa: ~19 semanas.**

## Suporte

Toda a documentação está dentro do pacote. Para qualquer ajuste ou dúvida, abrir nova conversa com Claude e partilhar o pacote como contexto.
