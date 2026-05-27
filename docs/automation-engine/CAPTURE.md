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

## Item B-008 (já existente)

`/settings/automation-logs` desalinhado do novo schema. Listar execuções e nodes a partir de `automation_executions` + `automation_node_executions`. Sprint operacional, sem urgência.
