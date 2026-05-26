# Smoke API — Máquina de Automações (Sprint 1.3)

Valida que as 5 endpoints HTTP da máquina funcionam end-to-end em produção.

## Endpoints

| Método | Rota | O que faz |
|---|---|---|
| `POST` | `/api/automations` | Cria automação (status default `draft`) |
| `GET` | `/api/automations` | Lista automações da org |
| `POST` | `/api/automations/[id]/activate` | Marca activa + popula `automation_triggers` |
| `POST` | `/api/automations/[id]/deactivate` | Marca paused + desactiva triggers |
| `POST` | `/api/automations/[id]/execute` | Disparo manual via Edge Function |

Auth: sessão Supabase (cookies SSR). Sem session → 401.

## Smoke rápido (sem auth)

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://crm-joao.vercel.app/api/automations
# esperado: 401
```

Valida que o endpoint está deployed e o guard de auth está activo. **Já validado** a 26 Mai 2026 logo após push do c1.

## Smoke completo (com sessão, via browser)

Mais rápido e fiável: João abre o CRM, faz login, abre devtools (F12 →
Console) na app e cola:

```js
// 1. Cria automação minimal
const create = await fetch('/api/automations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'API smoke ' + new Date().toISOString(),
    icon: '🧪',
    definition: {
      nodes: [
        { id: 'n1', atom: 'trigger.event', position: { x:0, y:0 }, config: { events: ['contact.created'] } },
        { id: 'n2', atom: 'action.log', position: { x:200, y:0 }, config: { message: 'API smoke OK', level: 'info' } },
      ],
      edges: [ { id: 'e1', source: 'n1', target: 'n2' } ],
    },
  }),
}).then(r => r.json());
console.log('CREATED', create);

// 2. Activa
const act = await fetch(`/api/automations/${create.id}/activate`, { method: 'POST' }).then(r => r.json());
console.log('ACTIVATED', act);

// 3. Dispara manualmente
const exec = await fetch(`/api/automations/${create.id}/execute`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ trigger_event: { type: 'manual.triggered', payload: { source: 'browser_console' } }, is_test: true }),
}).then(r => r.json());
console.log('EXECUTED', exec);

// 4. Lista
const list = await fetch('/api/automations').then(r => r.json());
console.log('LIST', list.automations.find(a => a.id === create.id));

// 5. Desactiva
const deact = await fetch(`/api/automations/${create.id}/deactivate`, { method: 'POST' }).then(r => r.json());
console.log('DEACTIVATED', deact);
```

Esperado:
- `CREATED` devolve `{ id, name, status: 'draft', definition: {...}, created_at }`
- `ACTIVATED` devolve `{ status: 'active', triggers: 1 }`
- `EXECUTED` devolve `{ execution_id, status: 'completed', duration_ms, nodes_executed: 2 }`
- `LIST` mostra a automação criada
- `DEACTIVATED` devolve `{ status: 'paused' }`

Para cleanup: ir à BD e correr
```sql
DELETE FROM automation_node_executions WHERE execution_id IN (SELECT id FROM automation_executions WHERE automation_id = '<id-criado>');
DELETE FROM automation_executions WHERE automation_id = '<id-criado>';
DELETE FROM automation_triggers WHERE automation_id = '<id-criado>';
DELETE FROM automations WHERE id = '<id-criado>';
```

## Notas

- O `is_test: true` em `/execute` reserva-se para Sprint 2 (modo teste do builder). Por enquanto não muda nada além de marcar `automation_executions.is_test=true`.
- `manual.triggered` é o `trigger_type` por defeito de execuções via API (vs `contact.created` etc. para disparos por eventos da BD).
- A RLS filtra tudo pela org do user; impossível ler/executar automações de outra org via esta API.
