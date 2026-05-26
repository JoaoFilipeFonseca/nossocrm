# 01 — Arquitetura Técnica

> **Pré-requisito**: Lê `00-overview.md` primeiro.

---

## Visão geral

```
┌──────────────────────────────────────────────────────────────────────┐
│                            FOCO IMO (Next.js 16)                     │
│                                                                      │
│   /app/(dashboard)/automacoes/      ← UI: lista, builder, histórico  │
│   /lib/automation-engine/           ← Lógica TS partilhada           │
│   /components/automations/          ← Componentes React (builder)    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                │ Supabase JS Client (SSR + Browser)
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                          SUPABASE                                    │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Postgres                                                     │   │
│  │   • automations, automation_executions, automation_*         │   │
│  │   • pg_cron (schedules)                                      │   │
│  │   • pg_notify (event bus)                                    │   │
│  │   • pgsodium (encriptação de credenciais)                    │   │
│  │   • pgvector (já existe para raw_intel)                      │   │
│  │   • RLS em TODAS as tabelas                                  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Realtime                                                     │   │
│  │   • Builder ouve mudanças em automation_executions           │   │
│  │   • Dashboard de execuções actualiza ao vivo                 │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Edge Functions (Deno)                                        │   │
│  │   • automation-execute  ← Workflow engine principal          │   │
│  │   • automation-webhook  ← Recebe webhooks externos           │   │
│  │   • automation-cron     ← Disparado por pg_cron              │   │
│  │   • automation-poller   ← Polling de fontes externas         │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Storage                                                      │   │
│  │   • automation-attachments (RLS por organization_id)         │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                │ HTTPS + tokens encriptados
                                ▼
        ┌────────────┬─────────────┬─────────────┬──────────────┐
        │  Meta Ads  │  Gmail/IMAP │  WhatsApp   │  + dezenas   │
        │  Google Cal│  Google Drv │  Cloud API  │  via HTTP    │
        └────────────┴─────────────┴─────────────┴──────────────┘
```

## Os 5 órgãos da máquina

### Órgão 1: Event Bus

**Responsabilidade**: Receber todos os eventos do sistema e distribuir aos subscritores.

**Implementação Foco Imo**:

| Camada | Tecnologia |
|---|---|
| Persistência | Tabela `automation_events` (ledger de tudo o que aconteceu) |
| Distribuição em tempo real | `pg_notify` no INSERT + Supabase Realtime |
| Subscrição | Edge Function `automation-execute` ou triggers Postgres |

**Eventos canónicos** (publicados pelo sistema):

```typescript
type SystemEvent =
  // Contactos
  | 'contact.created'
  | 'contact.updated'
  | 'contact.deleted'
  | 'contact.tag.added'
  | 'contact.tag.removed'
  | 'contact.stage.changed'
  
  // Negócios (Deals)
  | 'deal.created'
  | 'deal.updated'
  | 'deal.stage.changed'
  | 'deal.won'
  | 'deal.lost'
  
  // Imóveis
  | 'imovel.created'
  | 'imovel.captado'
  | 'imovel.sold'
  
  // Mensagens
  | 'message.received'        // WA, email, SMS, qualquer canal
  | 'message.sent'
  | 'message.delivered'
  | 'message.read'
  | 'message.replied'
  
  // Magic Inbox / Match
  | 'raw_intel.created'
  | 'match.created'
  | 'match.score_high'        // score >= 60
  
  // Sistema
  | 'webhook.received'
  | 'schedule.fired'
  | 'manual.triggered'
  | 'automation.completed'
  | 'automation.failed';
```

**Como funciona**:

```sql
-- Função genérica para publicar evento
CREATE OR REPLACE FUNCTION publish_event(
  p_event_type TEXT,
  p_payload JSONB,
  p_organization_id UUID,
  p_source TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO automation_events (event_type, payload, organization_id, source)
  VALUES (p_event_type, p_payload, p_organization_id, p_source)
  RETURNING id INTO v_event_id;
  
  -- Notifica subscritores em tempo real
  PERFORM pg_notify('automation_events', json_build_object(
    'event_id', v_event_id,
    'event_type', p_event_type,
    'organization_id', p_organization_id
  )::text);
  
  RETURN v_event_id;
END;
$$;
```

**Triggers em tabelas existentes** publicam eventos automaticamente:

```sql
-- Exemplo: trigger em contacts
CREATE OR REPLACE FUNCTION trg_contacts_after_insert()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM publish_event(
    'contact.created',
    row_to_json(NEW)::jsonb,
    NEW.organization_id,
    'contacts_table'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contacts_after_insert
AFTER INSERT ON contacts
FOR EACH ROW EXECUTE FUNCTION trg_contacts_after_insert();
```

---

### Órgão 2: Registry

**Responsabilidade**: Catálogo dinâmico de todos os átomos disponíveis (gatilhos, acções, lógica).

**Implementação Foco Imo**:

| Camada | Tecnologia |
|---|---|
| Source of truth | Ficheiros TS em `/lib/automation-engine/plugins/` |
| Indexação rápida | Tabela `automation_atoms_registry` (cache) |
| Carregamento | Auto-discovery via `import.meta.glob` no build |

```typescript
// /lib/automation-engine/registry.ts

import { AtomDefinition } from './types';

const atoms = new Map<string, AtomDefinition>();

// Carregamento automático de todos os plugins
const modules = import.meta.glob<{ default: AtomDefinition }>(
  './plugins/**/*.ts',
  { eager: true }
);

for (const path in modules) {
  const atom = modules[path].default;
  if (atom?.id) atoms.set(atom.id, atom);
}

export const registry = {
  get: (id: string) => atoms.get(id),
  
  list: (category?: AtomCategory) =>
    category
      ? Array.from(atoms.values()).filter(a => a.category === category)
      : Array.from(atoms.values()),
  
  has: (id: string) => atoms.has(id),
};
```

**Sincronização com BD** (corre no boot da Edge Function):

```typescript
// Mantém tabela automation_atoms_registry alinhada com os ficheiros
await supabase.from('automation_atoms_registry').upsert(
  Array.from(atoms.values()).map(atom => ({
    id: atom.id,
    category: atom.category,
    name: atom.name,
    icon: atom.icon,
    description: atom.description,
    config_schema: atom.configSchema,
    output_schema: atom.outputSchema,
    updated_at: new Date().toISOString(),
  }))
);
```

---

### Órgão 3: Workflow Engine

**Responsabilidade**: Executar automações, persistir estado, gerir retries, esperas, paralelismo.

**Implementação Foco Imo**:

| Aspecto | Decisão |
|---|---|
| Onde corre | Supabase Edge Function `automation-execute` (Deno) |
| Porquê | Sem cap de 60s. `EdgeRuntime.waitUntil` para esperas longas. |
| Estado persistido em | `automation_executions` + `automation_node_executions` |
| Retries | Coluna `retry_count` + política configurável por átomo |
| Esperas longas (horas/dias) | Agendamento via `pg_cron` em vez de `setTimeout` |
| Paralelismo | Edge Functions são stateless. Múltiplas execuções em paralelo automaticamente. |
| Idempotência | Cada execução tem ID único. Eventos têm `event_id` para deduplicação. |

**Fluxo de execução**:

```
1. Trigger dispara (event, webhook, cron, manual)
2. Edge Function automation-execute é invocada com:
   {
     automation_id,
     trigger_payload,
     organization_id,
     contact_id (opcional)
   }
3. Cria automation_executions com status='running'
4. Carrega definition da automation
5. Executa nó a nó:
   - Resolve variáveis ({{...}})
   - Chama atom.execute(context)
   - Guarda input/output em automation_node_executions
   - Avança para próximo nó (segue edges)
6. Para nós Wait Fixed/Until:
   - Marca status='waiting'
   - Agenda continuação via pg_cron OU webhook callback
   - Edge Function termina (não espera no processo)
7. Quando wait expira:
   - pg_cron invoca automation-execute novamente com execution_id e resume_node
   - Continua de onde parou
8. No fim: status='completed' ou 'failed'
9. Publica evento 'automation.completed' ou 'automation.failed'
```

**Pseudo-código do executor**:

```typescript
// /supabase/functions/automation-execute/index.ts

import { serve } from 'std/http/server.ts';
import { createClient } from '@supabase/supabase-js';
import { registry } from './registry.ts';
import { resolveVariables } from './template.ts';

serve(async (req) => {
  const { automation_id, trigger_payload, organization_id, contact_id, resume_node_id, execution_id }
    = await req.json();
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  // Cria ou retoma execução
  let exec;
  if (execution_id) {
    exec = await loadExecution(supabase, execution_id);
  } else {
    exec = await createExecution(supabase, {
      automation_id, organization_id, contact_id, trigger_payload
    });
  }
  
  const automation = await loadAutomation(supabase, exec.automation_id);
  let currentNodeId = resume_node_id ?? findFirstNodeAfterTrigger(automation);
  
  EdgeRuntime.waitUntil((async () => {
    try {
      while (currentNodeId) {
        const node = automation.definition.nodes.find(n => n.id === currentNodeId);
        const atom = registry.get(node.atom);
        
        // Resolve variáveis usando outputs anteriores
        const resolvedConfig = resolveVariables(node.config, exec.variables);
        
        // Contexto da execução
        const context = buildExecutionContext({
          supabase, exec, automation, node, config: resolvedConfig
        });
        
        // Executa átomo
        await recordNodeStart(supabase, exec.id, node);
        try {
          const output = await atom.execute(context);
          await recordNodeSuccess(supabase, exec.id, node, output);
          exec.variables[node.id] = { output };
          
          // Para átomos de espera longa, retorna sem avançar
          if (output._suspend) {
            await suspendExecution(supabase, exec.id, currentNodeId, output._resumeAt);
            return;
          }
          
          currentNodeId = findNextNode(automation, currentNodeId, output);
        } catch (err) {
          await recordNodeError(supabase, exec.id, node, err);
          // Política de retry
          if (shouldRetry(atom, node)) {
            await scheduleRetry(supabase, exec.id, currentNodeId);
            return;
          }
          throw err;
        }
      }
      
      await completeExecution(supabase, exec.id);
    } catch (err) {
      await failExecution(supabase, exec.id, err);
    }
  })());
  
  // Resposta imediata (200) para o invocador
  return new Response(JSON.stringify({ execution_id: exec.id, status: 'started' }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

---

### Órgão 4: Builder Visual

**Responsabilidade**: Interface drag and drop onde o utilizador compõe automações sem código.

**Implementação Foco Imo**:

| Componente | Tecnologia |
|---|---|
| Canvas | **React Flow (@xyflow/react)** |
| State management | **Zustand** (já está na stack) |
| Componentes UI | **shadcn/ui + Tailwind** (já está na stack) |
| Formulários dinâmicos | **react-hook-form + zod** + JSON Schema renderer |
| Tema | Azul-slate intocado (regra do projeto) |
| Mobile | Modo lista vertical em <768px |
| Realtime | Supabase Realtime para mostrar execuções a correr |

Detalhes em `06-builder-ui.md`.

---

### Órgão 5: Plugin System

**Responsabilidade**: Mecanismo para adicionar capacidades novas em minutos, sem refazer a app.

**Implementação Foco Imo**:

```
/lib/automation-engine/plugins/
  /triggers/
    event-listener.ts
    schedule-listener.ts
    webhook-listener.ts
    polling-listener.ts
    manual-trigger.ts
  /actions/
    send-email.ts
    send-whatsapp.ts       ← reusa messaging-webhook-meta
    send-sms.ts
    ai-operation.ts        ← reusa lib/ai/router.ts
    modify-contact.ts
    modify-deal.ts
    http-request.ts
    generate-pdf.ts
    web-operation.ts       ← Playwright
    physical-mail.ts
    code-block.ts          ← escape hatch
  /logic/
    if-else.ts
    switch.ts
    wait-fixed.ts
    wait-until.ts
    wait-humanized.ts
    loop.ts
    filter.ts
    parallel.ts
  /data/
    query.ts
    transform.ts
    variable.ts
    goal.ts
  /observability/
    log.ts
    notify-internal.ts
    track-metric.ts
  /integrations/
    /meta-ads/
      index.ts             ← definição da integração
      triggers.ts          ← triggers específicos (lead form)
      actions.ts           ← acções específicas (pausar campanha)
    /google-drive/
    /google-calendar/
    /stripe/
    /notion/
    /...
```

Detalhes em `05-plugin-system.md`.

---

## Fluxo completo de uma execução

```
1. EVENTO: contacto muda de "Visita" para "Proposta"
                          │
                          ▼
2. Trigger Postgres em contacts publica event 'deal.stage.changed'
   → INSERT em automation_events
   → pg_notify('automation_events', ...)
                          │
                          ▼
3. Edge Function automation-event-listener (subscrita ao Realtime) recebe
                          │
                          ▼
4. Procura automations onde trigger.config.event_type = 'deal.stage.changed'
   AND filter.to_stage = 'Proposta' AND organization_id = X
                          │
                          ▼
5. Para cada automation match, invoca Edge Function automation-execute
                          │
                          ▼
6. automation-execute cria execução e processa nós sequencialmente:
   - Wait Humanized 3-7 min: marca execução como 'waiting',
     agenda continuação via pg_cron, termina Edge Function
                          │
                          ▼ (3-7 min depois)
   - pg_cron job dispara, invoca automation-execute com resume_node_id
                          │
                          ▼
   - AI Operation: chama lib/ai/router.ts (Gemini → Anthropic fallback),
     aplica sanitize(), regista em creative_archive
                          │
                          ▼
   - Send WhatsApp: chama Edge Function messaging-webhook-meta existente,
     regista activity em deal_activities
                          │
                          ▼
7. Execução termina. Publica evento 'automation.completed'.
8. Builder visual mostra histórico actualizado (via Realtime).
```

## Decisões críticas e porquê

| Decisão | Porquê |
|---|---|
| Edge Functions em vez de API routes Next | Vercel functions têm cap de 60s. Edge Functions Deno não têm. |
| `pg_notify` + Realtime em vez de Redis Pub/Sub | Já está na stack Supabase. Zero dependência nova. |
| `pg_cron` em vez de node-cron ou Vercel Cron | Vive na BD, sobrevive a deploys, suporta scheduling complexo. |
| `pgsodium` em vez de KMS/Vault | Nativo Supabase, custo zero, encriptação at-rest. |
| Reusar `lib/ai/router.ts` | Não duplicar lógica IA. Mantém prompt caching e fallback Gemini→Anthropic. |
| Reusar `messaging-webhook-meta` | WhatsApp Cloud API já está configurada e testada. |
| pg-boss para job queue (se necessário) | Postgres-native, sem Redis. Alternativa: pg_cron + Edge Functions já chega. |
| RLS em todas as tabelas | Multi-tenant é princípio do projeto. |
| LiquidJS para templating | Standard, seguro, bem documentado. Sintaxe `{{...}}` igual ao resto da app. |
| React Flow para canvas | Industry standard. Componentes customizáveis. |

## Limites e considerações

| Aspecto | Limite | Mitigação |
|---|---|---|
| Edge Function execution time | 150s soft, 400s hard cap | Quebrar em chunks com suspend/resume |
| Supabase Postgres rows lidos por minuto | Plano dependente | Indexar `automation_events` por `processed`, fazer cleanup |
| Realtime concurrent connections | Plano dependente | Subscrição agregada no client, não por automation |
| pg_cron precision | Minuto | Suficiente para 99% dos casos. Esperas precisas usam Edge Functions com setTimeout até 150s. |
| Variáveis em templates | Não inventar dados | Validador estático no save da automação |

---

## Próximo documento

Lê agora `02-data-model.sql` (schema completo pronto a correr).
