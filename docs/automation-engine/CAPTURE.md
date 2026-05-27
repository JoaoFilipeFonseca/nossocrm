# CAPTURE — Máquina de Automações Foco Imo

Ideias e funcionalidades fora do scope da sessão actual, capturadas para sessões futuras. Ordenadas por valor estratégico.

> **Norte estratégico (validado pelo João, 27 Mai 2026):**
> Foco Imo CRM deve permitir a um consultor PT *sem* conhecimento técnico construir automações tão ou mais poderosas que n8n/Zapier, mas com fricção zero. Resolve as barreiras de tecnologia que impedem consultores com visão de negócio de criarem os seus próprios fluxos. Cada feature da Máquina deve passar o teste: "um consultor que não percebe nada de informática conseguia montar isto sozinho?"

---

## Sprint 4.0 — Modo linha-a-linha (estrela)

**Pedido literal do João:**
> "Uma linha onde tem uma caixa que escolho o que quero de tudo o que existe, depois acrescentar linha, abre outra em baixo em que escolho email, chamada, WhatsApp ou o que seja e o que faz... espera x tempo... corre IA... prompt... envia direto, ou fica em rascunho e avisa-me no telegram para eu ir aprovar..."

**Conceito:** vista alternativa ao canvas visual, estilo "receita". Cada passo é uma linha vertical com:
- Dropdown "Quando..." (1ª linha = trigger) / "Depois..." (linhas seguintes = action/logic)
- Formulário inline gerado do `configSchema` do átomo escolhido
- Botão "+ Adicionar linha" no fim
- Drag-handle à esquerda para reordenar
- Apaga linha com ✕

**Partilha BD com o canvas:** mesma `automations.definition` — linha = node com edge para o seguinte. Para condições/branches usa o canvas; para fluxos lineares (90% dos casos) usa as linhas. Toggle "Visual / Linha" no topo do builder.

**Por que importa:** o canvas é poderoso mas intimida. O modo linha é o que faz a Máquina ser usável por "qualquer consultor PT".

**Estimativa:** 3-4 commits, ~2-3h. Cada linha precisa de:
1. `LinearStepRow.tsx` com dropdown + form gerado
2. `LinearBuilder.tsx` que orquestra a lista
3. Gerador de form a partir de JSON Schema (input/select/textarea/array)
4. Convergência com canvas (mesmo PATCH endpoint)

---

## Sprint 4.1 — Átomo `logic.human_approval`

**Pedido literal do João:**
> "Envia direto OU fica em rascunho e avisa-me no telegram para eu ir aprovar"

**Conceito:** átomo que suspende a automação tal como `logic.wait_fixed`, mas o resume não é por tempo — é por humano. Mensagem Telegram com **botões inline** ("✅ Aprovar" / "❌ Rejeitar" / "✎ Editar antes"). Edge Function webhook recebe o callback e chama `automation-resume`.

**Bifurca:** sourceHandle `approved` / `rejected` / `edited`.

**Necessário:**
- Atom novo na lib + inline no executor (suspend pattern já existe)
- Edge Function `telegram-callback` (webhook do Telegram bot inline keyboard) → resolve approval e chama `automation-resume`
- Variáveis disponíveis no resume: `{{ approval.decision }}`, `{{ approval.edited_text }}`, `{{ approval.decided_at }}`

**Por que importa:** human-in-the-loop sem sair do Telegram. O João valida campanhas, emails, posts em segundos no telemóvel.

---

## Sprint 4.2 — Átomos de comunicação real

Sem estes, a Máquina não fala com o cliente:

- **`action.send_email`** — Resend ou Mailgun. Config: to, subject, html_body (suporta Liquid), reply_to. Anexos via storage URL.
- **`action.send_whatsapp`** — via `messaging-webhook-meta` ou template approved. Config: to (telefone), template, vars.
- **`action.run_ai`** — corre prompt via `lib/ai/router.ts` (já existe, usa Gemini+fallback Anthropic). Config: prompt (Liquid), system_prompt, max_tokens. Output: `ai_text`. Para gerar copy, resumos, próxima resposta sugerida.

Cada um é ~50 linhas inline no executor + plugin + entry no catalog.

---

## Sprint 4.3 — Triggers além de evento

- **`trigger.cron`** — corre em horário (ex: "todos os dias às 9h", "todas as segundas"). Já temos `automation_triggers.cron_expression`, falta wire-up no event-listener para inserir eventos sintéticos.
- **`trigger.webhook`** — URL único por automação, recebe payload externo. Já temos `webhook_path` na tabela, falta Edge Function.
- **`trigger.schedule_relative`** — disparar X tempo depois de outro evento (ex: 24h depois de criar contacto).

---

## Sprint 5 — Painel de config inline por nó

Click num nó do canvas abre painel direito com formulário do `configSchema`. Reutiliza o gerador de form do Sprint 4.0. Sem isto, condition/HTTP/etc. exigem editar JSON cru.

Autocomplete `{{ ... }}` baseado nas variáveis do contexto (contact.*, deal.*, imovel.*, trigger.*, outputs anteriores).

---

## Sprint 6 — Templates de fluxos completos

Para um consultor começar sem partir do zero. Cada template = automação pré-construída pronta a clonar:

1. **Lead novo da LP** → criar contacto → enviar boas-vindas WhatsApp → criar tarefa "ligar em 24h" → 48h depois sem resposta → notificar Telegram João
2. **Avaliação pedida** → guardar lead → enviar relatório PDF → 7 dias depois sem contacto → IA gera follow-up → aprovação Telegram → envia
3. **Negócio parado >30 dias** → IA analisa histórico → sugere próxima acção → aprovação Telegram
4. **Imóvel novo no portfólio** → match contra raw_intel → notifica contactos compatíveis → cria tarefa "ligar para confirmar interesse"
5. **Cliente fez visita** → 24h depois → SMS/email "que tal a visita?" → IA classifica resposta → avança stage

Wizard `/automacoes/nova` já tem 4 templates básicos, precisa ser expandido com estes.

---

## Sprint 7 — Tarefas do consultor não óbvias

Brainstorm pessoal: tarefas repetitivas que o consultor não pensa em automatizar mas vai amar quando vir:

- **Birthday de cliente** → IA gera mensagem personalizada → fica em rascunho no Telegram para aprovar
- **Aniversário de assinatura de CPCV / escritura** → mensagem de parabéns → re-engagement
- **Cliente comprou há >2 anos** → check market data → se imóvel valorizou X% → mensagem "sabia que valorizou? Quer avaliar?"
- **3 visitas sem oferta** → IA analisa motivos prováveis → sugere mudança de estratégia
- **Imóvel com 60 dias sem visitas** → IA propõe mudança de fotos, preço, descrição → aprovação
- **Lead que perguntou e desapareceu há 14 dias** → re-engagement automático com novidade do mercado
- **Cliente que indicou amigo** → recompensa automática (mensagem de obrigado + voucher fictício)
- **Aniversário do consultor com cliente** (1 ano desde primeira visita/contacto) → mensagem
- **Cliente trocou de zona de interesse?** Detecta via histórico → ajusta matches automaticamente

A maior parte destes precisa de `trigger.cron` (Sprint 4.3) + `action.run_ai` (4.2) + `logic.human_approval` (4.1). Por isso 4.x é a fundação.

---

## Vislumbres long-term

- **Modo "ensina-me"** — botão "Como faço para...?" gera automação a partir de descrição em linguagem natural (Claude/Gemini parsing)
- **Marketplace de fluxos** entre consultores PT (depois de validar SaaS multi-tenant)
- **Stats por automação:** "esta automação poupou-te X horas este mês, gerou Y leads convertidos"
- **A/B testing** de fluxos (50% recebem variante A, 50% variante B, medir conversão)
- **Versioning visual** — voltar atrás no histórico de edições de uma automação

---

## Sprint 8 — ACM (Análise Comparativa de Mercado) integrada no CRM

**Pedido literal do João (27 Mai 2026):**
> "Fazer ACM, deve estar no CRM e o cliente para quem o fiz registado... depois o modo como deve ser feito, dou link se for Fotocasa, coloco informação Idealista e Confidencial Imobiliário, estou a dizer depois temos que montar o plano sério e fiável, ter campo para 5 a 10 links de comparáveis para leres tudo fazeres a tua análise"

**Conceito:** ferramenta no CRM (não só ferramenta autónoma como /avaliar) que produz uma ACM séria, fiável, ligada a um contacto/imóvel/deal.

**Fluxo proposto:**
1. Botão "Nova ACM" em ficha de imóvel, contacto ou deal (FK ao registo)
2. Inputs do consultor:
   - Imóvel-alvo: morada, tipologia, área, andar, características (ou puxa de `imoveis` se já existe)
   - 5-10 URLs de comparáveis (Idealista, Fotocasa, Imovirtual, Casa Sapo)
   - Dados Confidencial Imobiliário (preço médio/m² da zona, opcional CSV upload)
   - Notas livres do consultor (contexto local, motivações, especificidades)
3. Backend:
   - Para cada URL, scrape via Apify (RAG-web-browser) ou fetch + parser HTML simples
   - Extrai: preço, área, €/m², características, fotos URL, dias no mercado
   - Normaliza unidades, detecta outliers, agrupa por similitude
4. IA (Gemini/Claude via lib/ai/router.ts):
   - Lê todos os comparáveis + dados confidencial + notas
   - Devolve análise estruturada: range de preço sugerido (low/mid/high com justificação), comparáveis ordenados por similitude, factores de ajuste, recomendação de estratégia (puxar preço, baixar, esperar)
5. Output:
   - PDF profissional com Brand Kit do João (logo, cores, AMI, contactos)
   - Versão online partilhável com cliente (URL único)
   - Guarda em `crm_acms` (tabela nova) ligado a `contact_id` / `imovel_id` / `deal_id`
   - Adiciona timeline event "ACM produzida" no lead_eventos
6. Histórico:
   - Página `/clientes/[id]/acms` lista ACMs feitas para esse cliente
   - Re-correr análise (snapshot + diff)

**Esquema BD novo:**
```sql
crm_acms (
  id uuid primary key,
  organization_id uuid references organizations,
  created_by uuid references profiles,
  contact_id uuid references contacts,
  imovel_id uuid references imoveis,
  deal_id uuid references deals,
  target_address text,
  target_specs jsonb,
  comparable_urls text[],
  comparable_data jsonb, -- raspagem normalizada
  confidencial_data jsonb,
  consultant_notes text,
  ai_analysis jsonb, -- estrutura completa do output IA
  price_range_low numeric,
  price_range_mid numeric,
  price_range_high numeric,
  shareable_token text unique,
  pdf_url text,
  created_at timestamptz default now()
)
```

**Multi-tenant:** RLS por organization_id desde o dia 1 (regra do projecto).

**Por que importa:** uma ACM séria diferencia o consultor da concorrência. Hoje o João faz isto manualmente ou no Excel. Automatizado + ligado ao CRM = poupa horas e melhora qualidade da angariação.

**Estimativa:** 5-7 commits, ~3 sessões. Maior peso é o scraper robusto + o prompt IA fiável.

**Dependência:** `action.run_ai` (Sprint 4.2) é pré-requisito do passo IA. Sprint 8 só faz sentido depois de 4.2.

---

## Item B-008 (já existente)

`/settings/automation-logs` desalinhado do novo schema. Listar execuções e nodes a partir de `automation_executions` + `automation_node_executions`. Sprint operacional, sem urgência.
