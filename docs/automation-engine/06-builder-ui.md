# 06 — Builder Visual (Especificação UX)

> **Pré-requisito**: Lê `05-plugin-system.md` primeiro.

Esta secção especifica a interface do utilizador da máquina. Mobile-first em 5 breakpoints (320, 375, 414, 768, desktop), tema azul-slate intocado.

---

## Mapa de páginas

```
/automacoes/                       ← Lista de automações
/automacoes/nova                   ← Wizard de criação (3 passos)
/automacoes/[id]                   ← Builder visual (edição)
/automacoes/[id]/execucoes         ← Histórico de execuções
/automacoes/[id]/execucoes/[exec_id]  ← Detalhe de uma execução
/automacoes/integracoes            ← Gestão de integrações conectadas
/automacoes/integracoes/[provider] ← Configuração de uma integração específica
```

---

## Página 1: `/automacoes/` — Lista

### Desktop (≥768px)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Foco Imo                                          [João Fonseca ▼]      │
├─────────────────────────────────────────────────────────────────────────┤
│ [Contactos] [Negócios] [Imóveis] [Magic Inbox] [Automações ●] [...]    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Automações                                       [+ Nova Automação]    │
│                                                                         │
│  [Todas ▼] [Activas] [Pausadas] [Rascunhos]  🔍 [Pesquisar...]         │
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────────┐│
│ │ 🟢 Aniversário de Escritura          Captação                       ││
│ │    Trigger: data escritura = HOJE - 365 dias                        ││
│ │    1.2K execuções · 98% sucesso · última há 2h    [Editar] [⋮]      ││
│ └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────────┐│
│ │ 🟢 Lead Meta Ads → WhatsApp          Captação                       ││
│ │    Trigger: webhook Meta Ads Lead Form                              ││
│ │    540 execuções · 95% sucesso · última há 8min    [Editar] [⋮]     ││
│ └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────────┐│
│ │ 🟡 Reactivação 60 dias               Relacionamento                  ││
│ │    Trigger: contacto sem actividade há 60 dias                       ││
│ │    80 execuções · 88% sucesso · pausada                              ││
│ └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

### Mobile (320-767px)

```
┌────────────────────────────────┐
│ ☰  Automações       [+]        │
├────────────────────────────────┤
│ [Activas] [Pausadas] [Rasc.]   │
│ 🔍 [Pesquisar...]              │
├────────────────────────────────┤
│ 🟢 Aniversário Escritura       │
│ 1.2K · 98% · há 2h         [⋮] │
├────────────────────────────────┤
│ 🟢 Lead Meta → WhatsApp        │
│ 540 · 95% · há 8min        [⋮] │
├────────────────────────────────┤
│ 🟡 Reactivação 60 dias         │
│ 80 · 88% · pausada         [⋮] │
└────────────────────────────────┘
[Tab bar inferior]
```

### Estados visuais

| Status | Ícone | Cor |
|---|---|---|
| `active` | 🟢 | Verde |
| `paused` | 🟡 | Amarelo |
| `draft` | ⚫ | Cinzento |
| `archived` | 📁 | Cinzento claro |

### Acções por automação (menu `⋮`)

- Editar
- Duplicar
- Pausar / Activar
- Ver histórico
- Exportar (JSON)
- Arquivar
- Eliminar (com confirmação)

---

## Página 2: `/automacoes/nova` — Wizard 3 passos

### Passo 1: Identificação

```
┌────────────────────────────────────────┐
│  Nova Automação                  1/3   │
├────────────────────────────────────────┤
│                                        │
│  Nome *                                │
│  [_____________________________]       │
│                                        │
│  Descrição (opcional)                  │
│  [_____________________________]       │
│  [_____________________________]       │
│                                        │
│  Categoria                             │
│  [▼ Captação              ]            │
│                                        │
│  Ícone                                 │
│  [⚡] [📥] [🎯] [💬] [📊] [Outro]     │
│                                        │
│           [Cancelar]  [Continuar →]    │
└────────────────────────────────────────┘
```

### Passo 2: Escolher Trigger

```
┌────────────────────────────────────────────────────────────────┐
│  Nova Automação                                          2/3   │
├────────────────────────────────────────────────────────────────┤
│  Quando é que esta automação dispara?                         │
│                                                                │
│  ┌────────────────────┐  ┌────────────────────┐               │
│  │ 📥 Evento interno  │  │ ⏰ Agendamento     │               │
│  │ Lead criado, etapa │  │ Diariamente,       │               │
│  │ muda, tag aplicada │  │ semanalmente, cron │               │
│  └────────────────────┘  └────────────────────┘               │
│                                                                │
│  ┌────────────────────┐  ┌────────────────────┐               │
│  │ 🌐 Webhook         │  │ 🔍 Monitor         │               │
│  │ URL única para     │  │ Polling de fonte   │               │
│  │ receber dados      │  │ externa, scraping  │               │
│  └────────────────────┘  └────────────────────┘               │
│                                                                │
│  ┌────────────────────┐                                        │
│  │ 👆 Manual          │                                        │
│  │ Botão no CRM       │                                        │
│  │ ou app móvel       │                                        │
│  └────────────────────┘                                        │
│                                                                │
│              [← Anterior]                                      │
└────────────────────────────────────────────────────────────────┘
```

### Passo 2.1: Configurar trigger (depende da escolha)

**Se escolheu "Evento interno":**

```
┌────────────────────────────────────────┐
│  Configurar Trigger                    │
├────────────────────────────────────────┤
│                                        │
│  Tipo de evento *                      │
│  [▼ Etapa do negócio mudou       ]    │
│                                        │
│  Filtros (opcional)                    │
│                                        │
│  Quando muda PARA:                     │
│  [▼ Proposta                      ]    │
│                                        │
│  Quando muda DE:                       │
│  [▼ Qualquer etapa                ]    │
│                                        │
│  Apenas para board:                    │
│  [▼ Compradores (default)         ]    │
│                                        │
│  [Cancelar]              [Continuar]   │
└────────────────────────────────────────┘
```

### Passo 3: Builder Visual

Após configurar o trigger, abre o canvas com o trigger já posicionado:

```
┌───────────────────────────────────────────────────────────────────────────┐
│ [← Voltar]  Aniversário de Escritura       [💾 Guardar] [▶ Testar] [✓ Activar] │
├──────────────┬────────────────────────────────────────────────────────────┤
│              │                                                            │
│  📚 Palette  │                                                            │
│              │              ┌─────────────────────┐                       │
│  ⚡ Gatilhos │              │ 📅 Schedule         │                       │
│  ➕ Acções   │              │ Cron: 0 8 * * *     │                       │
│  🔀 Lógica   │              │ Verifica escritura  │                       │
│  📊 Dados    │              │ = HOJE - 365 dias   │                       │
│  📈 Observ.  │              └──────────┬──────────┘                       │
│              │                         │                                  │
│  ───────     │              ┌──────────▼──────────┐                       │
│  📋 Comuns:  │              │ 🤖 IA: Gerar email  │                       │
│   • WhatsApp │              │ "A Jornada"         │                       │
│   • Email    │              └──────────┬──────────┘                       │
│   • IA       │                         │                                  │
│   • Wait     │              ┌──────────▼──────────┐                       │
│   • If/Else  │              │ ✉️ Enviar Email     │                       │
│              │              │ assunto: {{...}}    │                       │
│  🔍 [_____]  │              └──────────┬──────────┘                       │
│              │                         │                                  │
│              │              ┌──────────▼──────────┐                       │
│              │              │ ⏰ Esperar 2h       │                       │
│              │              └──────────┬──────────┘                       │
│              │                         │                                  │
│              │              ┌──────────▼──────────┐                       │
│              │              │ 💬 Enviar WhatsApp  │                       │
│              │              │ (vídeo)             │                       │
│              │              └──────────┬──────────┘                       │
│              │                         │                                  │
│              │                       [ + ]                                │
└──────────────┴────────────────────────────────────────────────────────────┘
```

### Painel direito de configuração (ao clicar num nó)

```
┌────────────────────────────────────┐
│  ✉️ Enviar Email           [✕]    │
│  ───────────────────────────────── │
│                                    │
│  Conta de email *                  │
│  [▼ João F. (joao@fonseca.pt) ]   │
│                                    │
│  Para *                            │
│  [{{contact.email}}            ]   │
│                                    │
│  Assunto *                         │
│  [Um ano em {{deal.imovel...    ]  │
│                                    │
│  Corpo (HTML) *                    │
│  ┌──────────────────────────────┐ │
│  │ {{previous_node.output.text}}│ │
│  │                              │ │
│  │ [Inserir variável ▼]         │ │
│  └──────────────────────────────┘ │
│                                    │
│  Anexos                            │
│  [+ Adicionar anexo]               │
│                                    │
│  ▶ Opções avançadas                │
│                                    │
│  ─────────────────────             │
│  [🧪 Testar este nó]               │
└────────────────────────────────────┘
```

---

## Comportamentos do canvas

| Acção | Resultado |
|---|---|
| Arrastar átomo do palette para canvas | Cria novo nó na posição |
| Clicar num nó | Abre painel de configuração à direita |
| Arrastar de output de um nó para input de outro | Cria edge (ligação) |
| Clicar com botão direito num nó | Menu: duplicar, eliminar, copiar, ver docs |
| Selecionar múltiplos (Shift+click ou rectangle select) | Bulk: mover, copiar, eliminar |
| `Ctrl+Z` / `Ctrl+Y` | Undo / Redo |
| `Ctrl+S` | Save (cria nova versão em `automation_versions`) |
| Roda do rato com Ctrl | Zoom in/out |
| Espaço + arrastar | Pan no canvas |
| Duplo clique em zona vazia | Mini palette para adicionar nó na posição |
| Auto-layout (botão na toolbar) | Re-organiza nós automaticamente |

---

## Mobile: alternativa ao canvas

Em 320-767px, o canvas drag and drop não funciona bem. Solução: **vista de lista vertical editável**.

```
┌──────────────────────────────┐
│ ← Aniv. Escritura  💾  ▶  ✓ │
├──────────────────────────────┤
│                              │
│  ┌────────────────────────┐  │
│  │ 1. ⏰ Schedule diário  │  │
│  │ 0 8 * * *           ⋮ │  │
│  └─────────┬──────────────┘  │
│            ▼                 │
│  ┌────────────────────────┐  │
│  │ 2. 🤖 IA: Gerar email  │  │
│  │ "A Jornada"         ⋮ │  │
│  └─────────┬──────────────┘  │
│            ▼                 │
│  ┌────────────────────────┐  │
│  │ 3. ✉️ Enviar Email     │  │
│  │ Para: {{contact...} ⋮ │  │
│  └─────────┬──────────────┘  │
│            ▼                 │
│  ┌────────────────────────┐  │
│  │ + Adicionar nó         │  │
│  └────────────────────────┘  │
│                              │
└──────────────────────────────┘
```

Cada nó:
- Toque abre full-screen modal com formulário de configuração
- Arrastar (handle) re-ordena
- Swipe para esquerda mostra acções (duplicar, eliminar)

Lógica de branching (if/else, switch) mostra-se como nó indentado com "Sim →" / "Não →" em cada ramo.

---

## Formulário de configuração dinâmico

A UI é gerada automaticamente a partir do `configSchema` (JSON Schema) de cada átomo.

| JSON Schema | UI renderizada |
|---|---|
| `{ type: 'string' }` | Input text com autocomplete `{{...}}` |
| `{ type: 'string', ui: 'textarea-with-variables' }` | Textarea multilinha + chips de variáveis |
| `{ type: 'string', enum: [...] }` | Select dropdown |
| `{ type: 'string', ui: 'integration-picker', provider: 'gmail' }` | Lista de integrações conectadas desse provider, com opção "Conectar nova" |
| `{ type: 'string', format: 'date-time' }` | Date picker |
| `{ type: 'number' }` | Input numérico |
| `{ type: 'boolean' }` | Switch toggle (shadcn) |
| `{ type: 'array' }` | Lista editável com `+ Adicionar` |
| `{ type: 'object' }` | Card aninhado |
| `{ ui: 'cron-builder' }` | Visual cron builder (sem ter de saber sintaxe) |
| `{ ui: 'expression' }` | Editor de expressão LiquidJS com syntax highlight |

---

## Sistema de variáveis com autocomplete

Em qualquer campo de texto, ao digitar `{{`, abre dropdown com variáveis disponíveis:

```
{{
├── contact
│   ├── id
│   ├── first_name
│   ├── last_name
│   ├── email
│   ├── phone
│   └── ...
├── trigger
│   └── payload
│       └── ...
├── deal (se houver)
│   ├── value
│   ├── stage
│   └── ...
└── outputs dos nós anteriores
    ├── ai_1
    │   └── output
    │       └── text
    └── ...
```

Filtros disponíveis (LiquidJS):
- `{{ contact.first_name | upcase }}`
- `{{ deal.value | money: 'EUR' }}`
- `{{ contact.created_at | date: 'DD/MM/YYYY' }}`
- `{{ ai_1.output.text | truncate: 200 }}`
- `{{ contact.first_name | default: 'Olá' }}`

---

## Modo Teste

```
┌────────────────────────────────────────────────┐
│  Testar Automação                          [✕] │
├────────────────────────────────────────────────┤
│                                                │
│  Como queres testar?                           │
│                                                │
│  ● Com contacto real                           │
│    [▼ Pesquisar contacto... António Silva ]    │
│                                                │
│  ○ Com contacto fictício                       │
│                                                │
│  ○ Trigger payload personalizado               │
│    ┌──────────────────────────────────────┐   │
│    │ {                                    │   │
│    │   "event_type": "...",               │   │
│    │   ...                                │   │
│    │ }                                    │   │
│    └──────────────────────────────────────┘   │
│                                                │
│  Opções:                                       │
│  [✓] Modo simulação (não envia comunicação)   │
│  [ ] Saltar esperas (skip waits)              │
│  [✓] Verbose logging                          │
│                                                │
│        [Cancelar]      [▶ Executar Teste]     │
└────────────────────────────────────────────────┘
```

Durante o teste:
- Cada nó muda de cor no canvas:
  - **Cinzento**: ainda não executado
  - **Azul piscante**: a executar
  - **Verde**: completado com sucesso
  - **Vermelho**: erro
- Bottom panel mostra logs em tempo real (via Realtime)
- Botão "Pausar" e "Cancelar" disponíveis

---

## Página 3: `/automacoes/[id]/execucoes` — Histórico

```
┌─────────────────────────────────────────────────────────────────────┐
│  Histórico: Aniversário de Escritura                               │
│                                                                     │
│  [Últimas 24h ▼] [Status: Todas ▼] [Contacto: ___] [Pesquisar...] │
│                                                                     │
│  📅 26/05/2026 14:23 ✅ Marta Costa        2.1s   [Ver detalhes >] │
│  📅 26/05/2026 13:45 ❌ João Pereira       0.8s   [Erro: WA inv.]  │
│  📅 26/05/2026 12:30 ✅ Ana Sousa          1.9s   [Ver detalhes >] │
│  📅 26/05/2026 11:15 ⏳ Pedro Almeida      em curso (wait 24h)     │
│                                                                     │
│  [< Anterior]   Pág 1 de 12   [Próximo >]                          │
└─────────────────────────────────────────────────────────────────────┘
```

### Página 4: Detalhe de execução

```
┌──────────────────────────────────────────────────────────────────────┐
│  Execução #a7f3...                                                  │
│  Iniciada: 26/05/2026 14:23:01     Duração: 2.1s                    │
│  Contacto: Marta Costa (marta@email.com)                            │
│  Status: ✅ Completada                                               │
│                                                                      │
│  [↻ Replay]  [⏸ Cancelar próximos]  [📥 Exportar JSON]              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ✅ trigger.schedule               12ms                              │
│     └─ Disparado às 14:23:01                                         │
│        [Ver input/output ▼]                                          │
│                                                                      │
│  ✅ action.ai_operation         1,422ms                              │
│     └─ Modelo: gemini-2.5-flash, tokens: 850, custo: $0.0012        │
│        [Ver prompt + resposta ▼]                                     │
│                                                                      │
│  ✅ action.send_email             421ms                              │
│     └─ Para: marta@email.com                                         │
│     └─ Subject: "Um ano em Lordelo do Ouro"                         │
│     └─ Message ID: <abc123@gmail.com>                                │
│        [Ver email completo ▼]                                        │
│                                                                      │
│  ⏰ logic.wait_fixed         2h (resume 16:23)                       │
│     └─ Suspendida. Próximo: action.send_whatsapp                     │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Página 5: `/automacoes/integracoes` — Gestão de integrações

```
┌─────────────────────────────────────────────────────────────────────┐
│  Integrações                                  [+ Conectar nova]    │
│                                                                     │
│  🔵 Conectadas                                                     │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ 💬 WhatsApp Cloud API           João Fonseca (F&R)              ││
│ │ Conectado há 3 meses · usado 1.2K vezes      [⚙️ Configurar]   ││
│ └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ ✉️ Gmail                       joao@fonseca.pt                  ││
│ │ Conectado há 1 mês · 540 envios                [⚙️] [↻] [🗑️]    ││
│ └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐│
│ │ 📅 Google Calendar             joao@fonseca.pt                  ││
│ │ ⚠️ Token expirado                 [Re-autenticar] [🗑️]         ││
│ └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  ⚪ Disponíveis                                                    │
│                                                                     │
│  [📊 Meta Ads] [💳 Stripe] [📝 Notion] [📅 Calendly] [Mais...]    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Conectar nova integração

Clicar abre wizard:
1. Lista de providers disponíveis (filtrável)
2. Clicar num provider mostra: descrição, scopes pedidos, link para docs
3. Botão "Autorizar" → abre OAuth flow ou form de API key
4. Após autorizar, mostra "Conectado!" + info da conta
5. Disponível imediatamente em todos os átomos que precisem dele

---

## Realtime: ver execuções ao vivo

Subscrição global a `automation_executions` para a org:

```typescript
const channel = supabase
  .channel('org-executions')
  .on('postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'automation_executions',
      filter: `organization_id=eq.${orgId}`
    },
    (payload) => {
      // Actualiza UI: badge de execuções a correr, notificação se erro, etc.
    }
  )
  .subscribe();
```

UI mostra:
- Badge no nav: "3 a correr"
- Notificação toast quando execução falha
- Builder visual mostra "live" se a automação está a executar agora

---

## Próximo documento

Lê agora `07-sprint-plan.md`.
