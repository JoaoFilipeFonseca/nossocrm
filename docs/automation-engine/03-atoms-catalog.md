# 03 — Catálogo dos 30 Átomos

> **Pré-requisito**: Lê `02-data-model.sql` primeiro.

Cada átomo segue a interface `AtomDefinition` definida em `code-templates/types.ts`. Esta é a especificação de configuração e output de cada um.

---

## A. ÁTOMOS DE GATILHO (5)

### A.1 `trigger.event` — Event Listener

Dispara quando um evento canónico ocorre no sistema.

| Campo | Tipo | Notas |
|---|---|---|
| `event_type` | enum (SystemEvent) | `contact.created`, `deal.stage.changed`, etc. |
| `filter` | object | Filtros adicionais aplicados ao payload |

**Exemplo de config**:
```json
{
  "event_type": "deal.stage.changed",
  "filter": {
    "new_stage_name": "Proposta"
  }
}
```

**Output**: o payload completo do evento.

---

### A.2 `trigger.schedule` — Schedule Listener (Cron)

Dispara segundo expressão cron.

| Campo | Tipo | Notas |
|---|---|---|
| `cron_expression` | string | Padrão cron 5 campos (min hora dia mês weekday) |
| `timezone` | string | Default: `Europe/Lisbon` |
| `data_source` | object (opcional) | Query a executar e passar como payload (ex: lista de contactos com tag X) |

**Exemplo**:
```json
{
  "cron_expression": "0 8 * * *",
  "timezone": "Europe/Lisbon"
}
```

---

### A.3 `trigger.webhook` — Webhook Listener

Recebe HTTP POST/GET externo numa URL única.

| Campo | Tipo | Notas |
|---|---|---|
| `method` | enum | `POST`, `GET`, `PUT` |
| `signature_validation` | object (opcional) | `{ header_name, secret_env }` para validar assinatura |
| `response_transform` | string (opcional) | LiquidJS template para transformar req em payload |

**URL gerada automaticamente**: `https://crm-joao.vercel.app/api/automation/webhook/{path}` onde `path` é único.

**Regra crítica**: webhook NUNCA devolve 500 em erro lógico. Sempre 200 + regista erro.

---

### A.4 `trigger.polling` — Polling Listener

Verifica algo a cada X minutos e dispara se houve mudança.

| Campo | Tipo | Notas |
|---|---|---|
| `interval_seconds` | number | Mínimo 60 (1 min) |
| `check_atom_id` | string | Átomo `data.query` ou `action.http_request` a executar |
| `check_config` | object | Config do átomo de check |
| `change_detector` | enum | `hash`, `count_increase`, `new_items` |

---

### A.5 `trigger.manual` — Manual Trigger

Dispara via botão no CRM ou app móvel.

| Campo | Tipo | Notas |
|---|---|---|
| `button_label` | string | Texto do botão |
| `confirm_required` | boolean | Pedir confirmação antes de executar |
| `input_fields` | array | Campos opcionais para o utilizador preencher antes |

---

## B. ÁTOMOS DE ACÇÃO (10)

### B.1 `action.send_communication` — Send Communication

Envia comunicação por qualquer canal (router unificado).

| Campo | Tipo | Notas |
|---|---|---|
| `channel` | enum | `email`, `sms`, `whatsapp`, `push` |
| `integration_id` | uuid | Qual integração usar |
| `to` | string | Destinatário (com variáveis `{{contact.phone}}`) |
| `subject` | string | Apenas para email |
| `body` | string | Corpo (com variáveis) |
| `template_id` | string (opcional) | Referência a template aprovado |
| `attachments` | array | URLs ou IDs de ficheiros |

**Implementação**:
- WhatsApp → reusa Edge Function `messaging-webhook-meta`
- Email → integração Gmail/Resend
- SMS → Twilio

**Regista activity automaticamente em `deal_activities`.**

---

### B.2 `action.send_whatsapp` — Send WhatsApp (dedicado)

Específico WhatsApp Cloud API, com UI dedicada.

| Campo | Tipo | Notas |
|---|---|---|
| `integration_id` | uuid | Conta WhatsApp |
| `to` | string | Telefone com código país |
| `body` | string | Texto |
| `media_url` | string (opcional) | Imagem, vídeo, áudio, documento |
| `template_name` | string (opcional) | Template aprovado Meta |
| `template_params` | object | Parâmetros do template |
| `interactive_buttons` | array (opcional) | Quick reply buttons |

---

### B.3 `action.send_email` — Send Email

| Campo | Tipo | Notas |
|---|---|---|
| `integration_id` | uuid | Gmail / Resend / SMTP |
| `from_name` | string | Default: nome do utilizador |
| `from_email` | string | Default: email da integração |
| `to` | string | Destinatário |
| `cc`, `bcc` | string (opcional) | |
| `subject` | string | |
| `body_html` | string | HTML rico |
| `body_text` | string | Fallback texto |
| `attachments` | array | |

---

### B.4 `action.modify_contact` — Modify Contact

| Campo | Tipo | Notas |
|---|---|---|
| `operation` | enum | `create`, `update`, `delete`, `add_tag`, `remove_tag`, `change_stage` |
| `contact_id` | uuid (opcional) | Para update/delete; default: `{{contact.id}}` |
| `data` | object | Campos a definir |
| `tag` | string | Para add/remove tag |
| `stage` | string | Para change_stage |

---

### B.5 `action.modify_deal` — Modify Deal/Negócio

| Campo | Tipo | Notas |
|---|---|---|
| `operation` | enum | `create`, `update`, `won`, `lost`, `move_stage` |
| `deal_id` | uuid (opcional) | Default: `{{deal.id}}` |
| `data` | object | |
| `new_stage_id` | uuid | |
| `lost_reason` | string | |

---

### B.6 `action.http_request` — HTTP Request (Universal)

O coringa. Substitui qualquer integração não dedicada.

| Campo | Tipo | Notas |
|---|---|---|
| `method` | enum | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` |
| `url` | string | Com variáveis |
| `headers` | object | Pares chave/valor |
| `body_type` | enum | `json`, `form`, `text`, `none` |
| `body` | string \| object | Corpo da request |
| `auth` | object | `{ type: 'bearer'\|'basic'\|'api_key', integration_id?, ... }` |
| `timeout_ms` | number | Default 30000 |
| `parse_response` | enum | `json`, `text`, `xml`, `binary` |

**Output**: `{ status, headers, body }`.

---

### B.7 `action.ai_operation` — AI Operation

Backend: `lib/ai/router.ts` (`runWithFallback`).

| Campo | Tipo | Notas |
|---|---|---|
| `mode` | enum | `inline_prompt` ou `template` |
| `prompt` | string (se inline) | Pode usar variáveis e referenciar Brand Kit |
| `template_id` | string (se template) | Referência a `ai_prompt_templates` |
| `template_vars` | object | Variáveis a interpolar no template |
| `model_preference` | enum | `auto`, `gemini`, `anthropic` |
| `output_format` | enum | `text`, `json`, `structured` |
| `output_schema` | object (opcional) | JSON Schema para structured output |
| `max_tokens` | number | Default 1000 |
| `temperature` | number | Default 0.7 |
| `apply_brand_kit` | boolean | Default true (injecta brand kit no system prompt) |
| `apply_sanitize` | boolean | Default true (chama `sanitize()` no output) |
| `archive_to_creatives` | boolean | Default false |

**Output**: `{ text, structured?, model_used, tokens_used, cost_usd }`.

---

### B.8 `action.generate_document` — Generate Document

| Campo | Tipo | Notas |
|---|---|---|
| `document_type` | enum | `pdf`, `docx`, `html`, `image` |
| `template` | string | HTML template com variáveis |
| `template_id` | uuid (opcional) | Referência a template guardado |
| `data` | object | Variáveis para o template |
| `output_filename` | string | Nome do ficheiro gerado |
| `save_to_storage` | boolean | Guarda no bucket `automation-attachments` |

**Output**: `{ file_url, file_path, size_bytes }`.

---

### B.9 `action.web_operation` — Web Operation (Scraping)

Backend: Playwright em Edge Function dedicada.

| Campo | Tipo | Notas |
|---|---|---|
| `operation` | enum | `scrape`, `screenshot`, `pdf`, `extract_structured` |
| `url` | string | |
| `wait_for_selector` | string (opcional) | |
| `extraction_rules` | object | Selectores CSS para extrair dados |
| `extract_with_ai` | boolean | Usa IA para extrair dados estruturados da página |
| `proxy` | string (opcional) | |
| `headers` | object (opcional) | User-Agent, cookies |

---

### B.10 `action.code_block` — Code Block (Escape Hatch)

Permite escrever código TS/Deno arbitrário. Executado em sandbox isolado.

| Campo | Tipo | Notas |
|---|---|---|
| `language` | enum | `typescript` (default) |
| `code` | string | Código com função `async function execute(ctx)` |
| `npm_imports` | array | Lista de imports permitidos (whitelist) |
| `timeout_ms` | number | Default 30000 |

---

## C. ÁTOMOS DE LÓGICA (8)

### C.1 `logic.condition` — If/Else

| Campo | Tipo |
|---|---|
| `condition` | string (expressão LiquidJS booleana) |

**Output**: `{ branch: 'true' | 'false' }` — define qual edge seguir.

---

### C.2 `logic.switch` — Switch

| Campo | Tipo |
|---|---|
| `value` | string (expressão) |
| `cases` | array of `{ value, label }` |
| `default_label` | string |

**Output**: `{ branch: <label> }`.

---

### C.3 `logic.wait_fixed` — Wait Fixed

| Campo | Tipo | Notas |
|---|---|---|
| `unit` | enum | `seconds`, `minutes`, `hours`, `days` |
| `amount` | number | |
| `respect_business_hours` | boolean | Default false. Se true, conta só horas úteis. |
| `business_hours_start` | string | Default `09:00` |
| `business_hours_end` | string | Default `19:00` |
| `business_days` | array | Default `[1,2,3,4,5,6]` (Mon-Sat manhã). **Nunca Domingo.** |

**Comportamento**:
- Se duração < 150s, usa `setTimeout` na Edge Function actual
- Se duração >= 150s, agenda continuação via `automation_schedules` + pg_cron, suspende execução

---

### C.4 `logic.wait_until` — Wait Until

Espera até condição ser verdadeira OU timeout.

| Campo | Tipo | Notas |
|---|---|---|
| `condition_type` | enum | `event_received`, `expression_true`, `time_reached` |
| `event_type` | string (se event) | ex: `message.replied` |
| `event_filter` | object | filtros adicionais |
| `expression` | string (se expression) | LiquidJS booleana |
| `timeout_unit` | enum | `minutes`, `hours`, `days` |
| `timeout_amount` | number | |
| `on_timeout` | enum | `continue`, `branch_timeout` (cria edge separada) |

---

### C.5 `logic.wait_humanized` — Wait Humanized

Espera aleatória dentro de janela. Faz a automação parecer humana.

| Campo | Tipo |
|---|---|
| `min_minutes` | number |
| `max_minutes` | number |
| `respect_business_hours` | boolean |
| `respect_quiet_hours` | boolean |
| `quiet_start` | string (HH:MM) |
| `quiet_end` | string (HH:MM) |

---

### C.6 `logic.loop` — Loop

Para cada item de uma array, executa um sub-fluxo.

| Campo | Tipo | Notas |
|---|---|---|
| `items_expression` | string | ex: `{{trigger.payload.contacts}}` |
| `item_variable_name` | string | Default `item`. Disponível como `{{item}}` dentro do loop |
| `max_iterations` | number | Default 1000 (safety cap) |
| `parallel` | boolean | Default false (sequencial). Se true, executa em paralelo. |

---

### C.7 `logic.filter` — Filter

Continua apenas se condição verdadeira. Senão, termina execução com status `skipped`.

| Campo | Tipo |
|---|---|
| `condition` | string (expressão booleana) |
| `skip_message` | string (opcional) |

---

### C.8 `logic.parallel` — Parallel

Executa N ramos em paralelo, junta no fim.

| Campo | Tipo |
|---|---|
| `wait_for` | enum (`all`, `any`, `n_of_m`) |
| `n` | number (se `n_of_m`) |

---

## D. ÁTOMOS DE DADOS (4)

### D.1 `data.query` — Query

Busca registos da BD com filtros.

| Campo | Tipo | Notas |
|---|---|---|
| `table` | enum | `contacts`, `deals`, `imoveis`, `messaging_messages`, etc. |
| `filters` | array | `{ column, operator, value }` |
| `order_by` | object | `{ column, direction }` |
| `limit` | number | Default 100 |
| `select` | array | Colunas a retornar |

**Output**: `{ rows: [...], count }`.

---

### D.2 `data.transform` — Transform

Manipula dados (map, filter, reduce, sort).

| Campo | Tipo |
|---|---|
| `input` | string (expressão de array) |
| `operations` | array of operations |

---

### D.3 `data.variable` — Variable

Define ou lê uma variável local da execução.

| Campo | Tipo |
|---|---|
| `operation` | enum (`set`, `get`, `increment`, `append`) |
| `variable_name` | string |
| `value` | any |

---

### D.4 `data.goal` — Goal

Define objectivo da automação. Quando atingido, execução termina com sucesso.

| Campo | Tipo |
|---|---|
| `goal_name` | string |
| `condition` | string (expressão booleana) |
| `check_on_event` | string (opcional) | Re-verifica quando este evento ocorre |

---

## E. ÁTOMOS DE OBSERVABILIDADE (3)

### E.1 `obs.log` — Log

Regista informação estruturada para debug.

| Campo | Tipo |
|---|---|
| `level` | enum (`debug`, `info`, `warn`, `error`) |
| `message` | string |
| `data` | object (opcional) |

---

### E.2 `obs.notify_internal` — Notify Internal

Avisa o utilizador (João) sobre algo durante a execução.

| Campo | Tipo |
|---|---|
| `channel` | enum (`telegram`, `email`, `push`, `slack`) |
| `priority` | enum (`low`, `normal`, `high`, `urgent`) |
| `subject` | string |
| `body` | string |

---

### E.3 `obs.track_metric` — Track Metric

Incrementa contador no dashboard.

| Campo | Tipo |
|---|---|
| `metric_name` | string |
| `value` | number (default 1) |
| `tags` | object |

---

## Resumo: 30 átomos para uma máquina infinita

| Categoria | # | Átomos |
|---|---|---|
| Gatilho | 5 | event, schedule, webhook, polling, manual |
| Acção | 10 | send_communication, send_whatsapp, send_email, modify_contact, modify_deal, http_request, ai_operation, generate_document, web_operation, code_block |
| Lógica | 8 | condition, switch, wait_fixed, wait_until, wait_humanized, loop, filter, parallel |
| Dados | 4 | query, transform, variable, goal |
| Observabilidade | 3 | log, notify_internal, track_metric |

## Próximo documento

Lê agora `04-integrations-catalog.md`.
