# 00 — Overview da Máquina de Automações

> **Pré-requisito**: Lê `CLAUDE.md` primeiro.

---

## O problema que estamos a resolver

O Foco Imo tem hoje uma base sólida: CRM completo, IA integrada, Brand Kit, Creative Archive, Voz, Chamadas, Match Engine, multi-tenant SaaS-ready. Mas **as automações ainda não existem como sistema visual configurável**. Hoje, qualquer fluxo automático tem que ser codado manualmente ou depende de GHL (que é externo e limitado).

Ferramentas externas como n8n, Make ou Zapier custam 200 a 500 euros por mês, vivem fora do CRM, e o conhecimento não pertence ao utilizador. Cada automação criada num serviço externo é uma dependência adicional.

## A solução

Construir, dentro do próprio Foco Imo, uma **máquina de automações visual**, integrada como aba do CRM, onde o utilizador:

1. Clica em "+ Nova Automação"
2. Escolhe um trigger (quando acontece X)
3. Arrasta acções e lógica para o canvas
4. Configura cada nó com formulário
5. Testa com contacto real
6. Ativa

Tudo isto sem sair do CRM, sem código, com o tom de voz Fonseca & Rodrigues aplicado automaticamente, e com extensibilidade infinita através de plugins.

## Filosofia

| Princípio | Significado |
|---|---|
| **Composabilidade** | 30 átomos universais combinam-se em infinitas automações |
| **Extensibilidade** | Novos átomos como plugins, sem refazer a app |
| **Integração nativa** | Tudo dentro do Foco Imo, tokens guardados seguros |
| **Reutilização** | Aproveita ao máximo `lib/ai/router.ts`, `ai_brand_kits`, `ai_prompt_templates`, `messaging-webhook-meta`, etc. |
| **Mobile-first** | Construir e ativar automação no telemóvel |
| **Observabilidade total** | Cada execução com inputs, outputs, duração, replay |
| **Multi-tenant** | `organization_id` + RLS em tudo. Pronto para SaaS |

## Fit com Foco Imo

| Sistema actual | Como a máquina se encaixa |
|---|---|
| GHL polling cada 15 min | Continua. Eventos GHL emitem em `automation_events` |
| Telegram router universal | Trigger "comando Telegram" + acção "notificar" reusam código |
| Match engine | Trigger natural: "novo match score >= 60" |
| Magic Inbox (raw_intel + pgvector) | Trigger natural: "novo raw_intel com intent=X" |
| WhatsApp Cloud API | Acção `send_whatsapp` reusa `messaging-webhook-meta` |
| Brand Kit | Aplicado automaticamente em todos os átomos IA |
| Creative Archive | Outputs IA das automações arquivados automaticamente |
| Deal activities timeline | Cada acção de comunicação regista activity |
| Edge Functions pattern (process-call, voice/process) | Workflow engine segue o mesmo padrão |

## O que muda para o utilizador

| Antes | Depois |
|---|---|
| Automações via GHL externo | Aba "Automações" no Foco Imo |
| Limitado ao que GHL pensou | Composição livre de qualquer fluxo imaginável |
| Sem visibilidade do que correu | Histórico de execuções com replay |
| Sem extensibilidade | Pode adicionar novas integrações sem mudar de plataforma |
| Pagamento externo recorrente | Zero custo recorrente em ferramentas |

## Cenários reais alvo

### Cenário 1: Aniversário de Escritura (1 ano)

```
Trigger: data de escritura = HOJE - 365 dias
  ↓
Wait Fixed: 7 dias antes (T-7)
  ↓
Send Email: teaser "está a aproximar-se um dia importante"
  ↓
Wait until T-0 às 09:00
  ↓
AI Operation: gerar email "A Jornada" com base no histórico do negócio
  ↓
Send Email
  ↓
Wait 2 horas
  ↓
Send WhatsApp: vídeo personalizado (script gerado por IA)
  ↓
Schedule Physical Mail: relatório CMA + postal
```

### Cenário 2: Lead Meta Ads → Resposta Humanizada

```
Trigger: webhook Meta Ads Lead Form recebido
  ↓
Modify Contact: criar com origem "Meta Ads"
  ↓
Wait Humanized: 2 a 5 minutos
  ↓
AI Operation: gerar mensagem personalizada baseada no formulário
  ↓
Send WhatsApp (via messaging-webhook-meta existente)
  ↓
Wait Until: lead responde OU 24h
  ├── Respondeu → AI classifica intent → branch
  └── Não → Send WhatsApp follow-up + criar tarefa
```

### Cenário 3: FSBO Scraper Diário

```
Trigger: schedule cron "0 8 * * *" (todos os dias 08:00)
  ↓
Web Operation: scraping Custojusto + OLX + Marketplace
  ↓
Loop: para cada anúncio
  ↓
  Filter: já existe contacto com este telefone?
  ↓ (não)
  AI Operation: classificar qualidade do FSBO
  ↓
  If score > 70:
    ↓
    Modify Contact: criar com tag "FSBO-Quente"
    ↓
    Notify Internal: avisar João no Telegram
```

## Glossário

| Termo | Significado |
|---|---|
| **Átomo** | Bloco fundamental da máquina. 30 no total. |
| **Plugin** | Implementação concreta de um átomo num ficheiro TS. |
| **Automação / Workflow** | Definição de um fluxo. Existe na tabela `automations`. |
| **Execução / Execution** | Instância em curso de uma automação para um contacto específico. |
| **Nó / Node** | Átomo posicionado dentro de uma automação. |
| **Edge** | Ligação entre nós, define a ordem. |
| **Trigger** | Átomo que inicia a automação. |
| **Event Bus** | Sistema que distribui eventos a quem está subscrito. |
| **Integração** | Conexão autenticada a serviço externo (Meta Ads, Gmail, etc.). |
| **Credencial** | Token/key/OAuth encriptado associado a uma integração. |
| **Variable template** | Sintaxe `{{...}}` para passar dados entre nós. |
| **FSBO** | For Sale By Owner. Anúncios de particulares. |
| **CMA** | Comparative Market Analysis. Avaliação por comparáveis. |

## Próximo documento

Lê agora `01-architecture.md`.
