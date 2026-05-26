# SETUP.md — Máquina de Automações, Sprint 0

> Como replicar o trabalho do Sprint 0 noutra base de dados (preview, branch, novo ambiente) ou retomá-lo numa sessão futura.

## 1. Pré-requisitos

| Item | Verificação |
|---|---|
| Supabase project | Acesso via MCP (`mcp__supabase__*`) ou `supabase` CLI ligados ao projecto-alvo. |
| Extensões disponíveis no Postgres | `pgvector`, `pg_cron`, `pgcrypto`, `uuid-ossp`, `unaccent`, `pg_net`, `supabase_vault`. Confirma com `SELECT * FROM pg_available_extensions WHERE name IN (...)`. |
| Tabelas `organizations`, `profiles`, `contacts`, `deals` | Já existem na BD do Foco Imo, são pré-requisito das FK. |
| Node + pnpm + tsc | `pnpm install` corrido pelo menos uma vez; `npx tsc --noEmit -p .` corre em < 30s. |
| GitHub PAT com push em `JoaoFilipeFonseca/nossocrm` | Repo do Foco Imo, branch `main`. |

## 2. Ordem dos 6 commits do Sprint 0

| # | Hash | Tema |
|---|---|---|
| 1 | `916f548` | types TypeScript base + estrutura de pastas + exclude `docs/**` no tsconfig |
| 2 | `52d9266` | migration core: 10 tabelas `automation_*` + RLS + `pg_cron` + `publish_event` |
| 3 | `39d449f` | triggers `publish_event` em `contacts` e `deals` (migration separada para revert isolado) |
| 4 | `190a358` | smoke test RLS + fix policy `automation_schedules_all_service` |
| 5 | `208e56c` | wrapper TypeScript `event-bus.ts` sobre o RPC |
| 6 | (este commit) | SETUP.md + B-008 em `CAPTURE.md` |

## 3. Aplicar do zero numa BD nova

1. Aplicar pela ordem as 3 migrations:
   ```
   supabase/migrations/20260526120000_automation_engine_initial.sql
   supabase/migrations/20260526120100_automation_publish_event_triggers.sql
   supabase/migrations/20260526120150_automation_schedules_rls_fix.sql
   ```
   Idempotentes. Podem correr 2x sem erro.

2. Smoke test:
   ```sql
   \i supabase/tests/automation_rls_smoke.sql
   ```
   Espera 10 linhas, todas com `status='RLS_OK'`. Se a BD-alvo tiver outros utilizadores, troca o UUID na claim `sub` por qualquer `profiles.id` cuja `organization_id` seja DIFERENTE da org temporária `aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`.

3. Validação manual:
   ```sql
   INSERT INTO contacts (organization_id, name, stage) VALUES (<org-id>, 'Smoke', 'lead');
   SELECT event_type FROM automation_events WHERE source='contacts_table' ORDER BY occurred_at DESC LIMIT 5;
   -- Esperado: contact.created
   ```

## 4. Estrutura criada

### BD (10 tabelas + 1 função + triggers em 2 tabelas existentes)

```
automations               (definições do builder)
automation_versions       (histórico para rollback)
automation_triggers       (subscrições activas, webhooks, schedules)
automation_executions     (cada run, Realtime publication)
automation_node_executions(log por nó, Realtime publication)
automation_events         (event bus persistente, Realtime publication)
automation_integrations   (conexões externas)
automation_credentials    (tokens encriptados, pgsodium em Sprint 5)
automation_atoms_registry (catálogo de átomos disponíveis)
automation_schedules      (agendamentos para retomar waits)

publish_event(event_type, payload, org_id, source?, idempotency_key?) -> uuid
contacts.contacts_publish_events  (INSERT/UPDATE/DELETE -> automation_events)
deals.deals_publish_events        (INSERT/UPDATE -> automation_events)
```

### TypeScript (`/lib/automation-engine/`)

```
types.ts        Tipos partilhados (AtomDefinition, ExecutionContext, ...)
event-bus.ts    publishEvent() chama RPC publish_event
index.ts        Re-exporta tudo
plugins/{triggers,actions,logic,data,observability,integrations}/
                (.gitkeep, vão ser populados no Sprint 1+)
```

### Outras pastas

```
components/automations/        (vazia, builder UI no Sprint 2)
app/(protected)/automacoes/    (vazia, páginas no Sprint 2)
docs/automation-engine/        (documentação técnica completa)
supabase/migrations/2026052612*.sql  (3 migrations)
supabase/tests/automation_rls_smoke.sql
```

## 5. Não fazer no Sprint 0

- Adicionar plugins/átomos a `lib/automation-engine/plugins/` (Sprint 1+).
- Mexer em `lib/ai/router.ts`, `lib/ai/sanitize.ts`, `messaging-webhook-meta` (já estáveis, integrados no Sprint 3).
- Criar Edge Functions `automation-execute` ou `automation-cron` (Sprint 1).
- Activar os jobs `pg_cron` (estão comentados em `02-data-model.sql`, activam-se no Sprint 1).
- Tocar em `pgsodium` ou implementar encriptação de credenciais (Sprint 5).
- Substituir página `/settings/automation-logs` (Sprint 7, ver B-008 em `CAPTURE.md`).

## 6. Próximo passo

Sprint 1, ver `docs/automation-engine/07-sprint-plan.md`. Plan-First obrigatório antes de começar.
