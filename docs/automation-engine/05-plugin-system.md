# 05 — Sistema de Plugins

> **Pré-requisito**: Lê `04-integrations-catalog.md` primeiro.

A máquina de automações é **infinitamente extensível** através de plugins. Cada átomo é um plugin. Esta secção explica como funciona o sistema e como adicionar capacidades novas.

---

## Princípio fundador

**Um plugin é um ficheiro TypeScript que exporta um objecto que respeita a interface `AtomDefinition`.**

Quando o ficheiro é guardado em `/lib/automation-engine/plugins/`, é automaticamente:
1. Carregado no Registry
2. Sincronizado com a tabela `automation_atoms_registry`
3. Disponibilizado no palette do builder visual
4. Utilizável em qualquer automação imediatamente

Nada de rebuild da app, nada de configuração extra.

---

## Anatomia de um plugin

Estrutura mínima:

```typescript
import { AtomDefinition } from '@/lib/automation-engine/types';

const plugin: AtomDefinition = {
  // IDENTIFICAÇÃO
  id: 'action.exemplo_personalizado',
  category: 'action',
  name: 'Exemplo Personalizado',
  icon: '⚡',
  description: 'Faz algo personalizado.',
  
  // SCHEMA DE CONFIGURAÇÃO (gera UI automaticamente)
  configSchema: {
    type: 'object',
    required: ['campo_obrigatorio'],
    properties: {
      campo_obrigatorio: {
        type: 'string',
        title: 'Campo obrigatório',
        description: 'Descrição que aparece no formulário'
      }
    }
  },
  
  // SCHEMA DO OUTPUT (para nós seguintes referenciarem variáveis)
  outputSchema: {
    type: 'object',
    properties: {
      resultado: { type: 'string' }
    }
  },
  
  // EXECUÇÃO
  async execute(context) {
    const { campo_obrigatorio } = context.config;
    
    // ... lógica ...
    
    return {
      resultado: 'feito'
    };
  }
};

export default plugin;
```

---

## Tipos de plugins

### Plugin de Trigger

Adicionar `triggerSchema`:

```typescript
const plugin: AtomDefinition = {
  id: 'trigger.exemplo',
  category: 'trigger',
  name: 'Exemplo Trigger',
  icon: '⚡',
  description: '...',
  
  configSchema: { /* ... */ },
  outputSchema: { /* ... */ },
  
  triggerSchema: {
    type: 'event',  // ou 'schedule', 'webhook', 'polling', 'manual'
    events: ['contact.created']
  },
  
  async execute(context) {
    return context.triggerEvent.payload;
  }
};
```

### Plugin de Acção com integração externa

```typescript
const plugin: AtomDefinition = {
  id: 'action.example_send',
  category: 'action',
  name: 'Example: Send Thing',
  icon: '📤',
  description: 'Envia uma coisa via Example Service.',
  
  requiresIntegration: 'example_service',
  
  configSchema: {
    type: 'object',
    required: ['integration_id', 'recipient', 'content'],
    properties: {
      integration_id: {
        type: 'string',
        title: 'Conta',
        ui: 'integration-picker',
        provider: 'example_service'
      },
      recipient: {
        type: 'string',
        title: 'Destinatário',
        ui: 'variable-input',
        placeholder: '{{contact.email}}'
      },
      content: {
        type: 'string',
        title: 'Conteúdo',
        ui: 'textarea-with-variables'
      }
    }
  },
  
  outputSchema: {
    type: 'object',
    properties: {
      external_id: { type: 'string' },
      success: { type: 'boolean' }
    }
  },
  
  async execute(context) {
    const { integration_id, recipient, content } = context.config;
    
    // Carrega credenciais (desencriptadas pelo helper)
    const integration = await context.getIntegration(integration_id);
    
    // Chama API externa
    const response = await fetch('https://api.example.com/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${integration.credentials.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ recipient, content })
    });
    
    if (!response.ok) {
      throw new Error(`Example API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Regista activity (opcional)
    await context.recordActivity('example_sent', {
      contact_id: context.contactId,
      recipient,
      external_id: data.id
    });
    
    return {
      external_id: data.id,
      success: true
    };
  }
};
```

### Plugin de IA (reusa `lib/ai/router.ts`)

```typescript
import { runWithFallback } from '@/lib/ai/router';
import { sanitize } from '@/lib/ai/sanitize';

const plugin: AtomDefinition = {
  id: 'action.ai_custom_task',
  category: 'action',
  name: 'IA: Tarefa Personalizada',
  icon: '🤖',
  description: 'Tarefa IA específica com prompt fixo.',
  
  configSchema: {
    type: 'object',
    properties: {
      input_text: { type: 'string', ui: 'textarea-with-variables' }
    }
  },
  
  outputSchema: {
    type: 'object',
    properties: {
      result: { type: 'string' },
      model_used: { type: 'string' }
    }
  },
  
  async execute(context) {
    const { input_text } = context.config;
    
    // Carrega Brand Kit da org
    const brandKit = await context.getBrandKit();
    
    const systemPrompt = `És o assistente IA do João Fonseca.
Tom: ${brandKit.tone_of_voice}.
Filosofia: ${brandKit.philosophy}.
Vocabulário banido: ${brandKit.banned_vocabulary.join(', ')}.
NUNCA uses em-dash ou en-dash. Usa vírgulas ou parêntesis.
Língua: pt-PT formal pré-AO 1990.`;
    
    const result = await runWithFallback({
      systemPrompt,
      userPrompt: input_text,
      maxTokens: 800,
      temperature: 0.7
    });
    
    // Sanitização obrigatória
    const sanitized = sanitize(result.text);
    
    return {
      result: sanitized,
      model_used: result.model
    };
  }
};
```

---

## Como o Registry carrega plugins

```typescript
// /lib/automation-engine/registry.ts

import { AtomDefinition } from './types';

const atoms = new Map<string, AtomDefinition>();

// Auto-discovery: importa todos os ficheiros TS em plugins/
const modules = import.meta.glob<{ default: AtomDefinition }>(
  './plugins/**/*.ts',
  { eager: true }
);

for (const path in modules) {
  const atom = modules[path].default;
  if (!atom?.id) {
    console.warn(`Plugin sem id: ${path}`);
    continue;
  }
  if (atoms.has(atom.id)) {
    throw new Error(`Plugin duplicado: ${atom.id}`);
  }
  atoms.set(atom.id, atom);
}

export const registry = {
  get: (id: string) => atoms.get(id),
  list: (category?: string) =>
    category
      ? Array.from(atoms.values()).filter(a => a.category === category)
      : Array.from(atoms.values()),
  has: (id: string) => atoms.has(id),
};
```

---

## Validação de plugins (no boot)

```typescript
// /lib/automation-engine/validate-plugins.ts

import { z } from 'zod';

const AtomDefinitionSchema = z.object({
  id: z.string().regex(/^(trigger|action|logic|data|obs)\.[a-z_]+$/),
  category: z.enum(['trigger', 'action', 'logic', 'data', 'observability']),
  name: z.string().min(1),
  icon: z.string(),
  description: z.string().min(1),
  configSchema: z.record(z.any()),
  outputSchema: z.record(z.any()),
  execute: z.function()
});

for (const atom of registry.list()) {
  const result = AtomDefinitionSchema.safeParse(atom);
  if (!result.success) {
    throw new Error(`Plugin inválido (${atom.id}): ${result.error.message}`);
  }
}
```

---

## Hot Reload em desenvolvimento

Next.js HMR detecta automaticamente novos ficheiros em `/lib/automation-engine/plugins/`. Quando guardas um plugin novo:

1. Next.js recompila o módulo
2. Registry recarrega
3. Browser refresh → palette mostra o átomo novo

Em produção (Vercel), cada deploy carrega novos plugins.

---

## Sincronização com `automation_atoms_registry` (BD)

Cada deploy ou boot da Edge Function executa:

```typescript
async function syncAtomsRegistry() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  
  const atomsData = registry.list().map(atom => ({
    id: atom.id,
    category: atom.category,
    name: atom.name,
    icon: atom.icon,
    description: atom.description,
    config_schema: atom.configSchema,
    output_schema: atom.outputSchema,
    requires_integration: atom.requiresIntegration ?? null,
    version: atom.version ?? '1.0',
    is_deprecated: false,
    updated_at: new Date().toISOString()
  }));
  
  await supabase
    .from('automation_atoms_registry')
    .upsert(atomsData, { onConflict: 'id' });
}
```

Isto mantém a tabela alinhada com os ficheiros TS, e permite ao builder visual carregar o catálogo via query rápida em vez de import dinâmico.

---

## Boas práticas para criar plugins

| Prática | Porquê |
|---|---|
| **Idempotência** | Toda execução deve ser segura de repetir (importante para retries). Usa `idempotency_key` em chamadas externas. |
| **Timeout explícito** | Toda chamada externa tem timeout (default 30s). Nunca esperar infinitamente. |
| **Erros descritivos** | `throw new Error('Mensagem que ajude a debugar')`. Aparece no histórico. |
| **Validação de input** | Usa `zod` ou validação manual antes de chamar APIs. |
| **Sem efeitos colaterais inesperados** | Só faz o que está documentado no `description`. |
| **Logs estruturados** | `context.log('info', 'mensagem', { dados })` em vez de `console.log`. |
| **Sanitização IA obrigatória** | Sempre chamar `sanitize()` em outputs IA. |
| **Aplicar Brand Kit em IA** | Carregar `ai_brand_kits` e injectar no system prompt. |
| **Multi-tenant** | Nunca queries sem filtrar por `organization_id`. |
| **Reutilizar helpers** | Antes de implementar OAuth/HTTP/encriptação, ver se já existe em `/lib/`. |

---

## Versionamento de plugins

Quando um plugin precisa de mudar significativamente:

1. Cria versão nova: `id` muda para `action.send_thing.v2`
2. Versão antiga marca-se como `is_deprecated: true` com mensagem
3. UI sugere migração
4. Após N meses, remove versão antiga

```typescript
const pluginV2: AtomDefinition = {
  id: 'action.send_thing.v2',
  // ...
};

const pluginV1: AtomDefinition = {
  id: 'action.send_thing',
  isDeprecated: true,
  deprecationMessage: 'Migrar para action.send_thing.v2 — interface mais simples',
  // ...
};
```

---

## Testar um plugin

Cada plugin deve ter um ficheiro de teste:

```
/lib/automation-engine/plugins/actions/send-whatsapp.ts
/lib/automation-engine/plugins/actions/send-whatsapp.test.ts
```

```typescript
import { describe, it, expect } from 'vitest';
import plugin from './send-whatsapp';
import { mockExecutionContext } from '@/lib/automation-engine/test-utils';

describe('action.send_whatsapp', () => {
  it('envia mensagem com texto', async () => {
    const ctx = mockExecutionContext({
      config: {
        integration_id: 'fake-uuid',
        to: '+351912345678',
        body: 'Olá, teste'
      }
    });
    
    const output = await plugin.execute(ctx);
    
    expect(output.message_id).toBeDefined();
    expect(output.delivered).toBe(true);
  });
  
  it('rejeita configuração inválida', async () => {
    // ...
  });
});
```

---

## Templates prontos a copiar

Ver `code-templates/`:
- `example-atom-send-whatsapp.ts` — plugin de acção completo, com integração
- `example-trigger-event.ts` — plugin de trigger por evento
- `example-logic-wait.ts` — plugin de lógica
- `example-integration-oauth.ts` — definição de integração OAuth

---

## Próximo documento

Lê agora `06-builder-ui.md`.
