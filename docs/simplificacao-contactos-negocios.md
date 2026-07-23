# SIMPLIFICAÇÃO CONTACTOS + NEGÓCIOS — Spec de implementação (desenhada 23/07/2026, Fable)

> **Estado: AGUARDA VALIDAÇÃO DO JOÃO.** Depois de validado, construir numa sessão Opus seguindo
> esta spec fatia a fatia (1 commit por fatia, typecheck 0 / lint 0, verificação real em produção).
> Referência visual: CRM Pinheirinho (3 fotos do João, 23/07) — lista de tarefas com badges
> "2 man · 1 auto · 4 tar", e modal "Actividade" com abas Nota | Contacto, Canal + Resultado + histórico.

## Objectivo (palavras do João)

1. **Retirar Empresas** — "não faz qualquer sentido ter empresas".
2. **Ver rapidamente o que a lead tem**: dias no pipeline (já existe), canal de aquisição,
   nº de contactos **manuais** (chamadas/mensagens que ele regista), nº de contactos **automáticos**
   (feitos por automações) e tarefas — em badges à frente do nome, como na imagem 1.
3. **Modal simples de registo de contacto manual**: abas Nota | Contacto; em Contacto escolhe
   **Canal** + **Resultado**, nota opcional (texto ou microfone), grava e o histórico fica todo
   visível no próprio modal (imagens 2 e 3).

## Factos apurados (23/07, BD de produção + mapa do código)

- `crm_companies`: **3 linhas, 0 contactos / 0 negócios / 0 tarefas ligados** → remover é seguro.
- `deal_activities` já tem `actor` ('human'|'automation'|'system') — base pronta para os contadores.
- O modal de registo **já existe para contactos** (`features/contacts/components/ContactTimeline.tsx`
  + `app/api/contacts/[id]/activities/route.ts`) — falta o Resultado, e falta tudo isto no NEGÓCIO.
- `POST /api/deals/[id]/activities` já existe (log silencioso CHQ); **não há GET** nem UI de histórico
  no negócio (a timeline do DealDetailModal mostra a tabela legada `activities`, não `deal_activities`).
- RPC `deal_state_signals` já conta `human_touches`/`automation_touches` (só negócios abertos).
- Power List: "Não atendeu" grava `type:'system'` (não conta como toque) — vai ser alinhado (F5).
- Tarefas = tabela `activities` (`completed` boolean, `deal_id`, `date`).

---

## F1 — Remover Empresas (UI + APIs; BD fica intacta)

**Princípio:** zero migrations destrutivas. A tabela `crm_companies` e as colunas `client_company_id`
ficam na BD (órfãs, inofensivas); remove-se todo o produto à volta. As 3 empresas levam soft-delete
por SQL (`update crm_companies set deleted_at = now() where deleted_at is null`).

**Distinção crítica (não confundir):**
- `crm_companies` + `client_company_id` = a entidade Empresas → **remover do produto**.
- `contacts.company_name` / `leads.company_name` = texto livre → **fica na BD**, some dos formulários.
- `Organization` (`types/types.ts`) = tenant SaaS → **NÃO tocar** (atenção ao alias `Company = Organization`).

**Ficheiros a alterar/remover:**

| Ficheiro | Acção |
|---|---|
| `features/contacts/components/ContactsTabs.tsx` | Apagar (tabs Pessoas/Empresas deixam de existir) |
| `features/contacts/components/CompanyFormModal.tsx` | Apagar |
| `features/contacts/ContactsPage.tsx` | Remover CompanyFormModal, delete-flows de empresa, tabs |
| `features/contacts/hooks/useContactsController.ts` | Remover `viewMode`, hooks de company, `filteredCompanies`, `getCompanyName`, lógica find-or-create (linhas ~387-411 e ~469-494), `useRealtimeSync('crm_companies')` |
| `features/contacts/components/ContactsList.tsx` | Remover tabela de empresas + coluna "Cargo/Empresa" |
| `features/contacts/components/ContactFormModal.tsx` (+V2) | Remover input "Empresa" (`companyName`) |
| `components/ui/ContactSearchCombobox.tsx` | Remover secção de empresas (`useCompanies`, `onSelectCompany`) |
| `features/boards/components/Modals/CreateDealModal.tsx` (+V2) | Remover `selectedCompany`/`companyName` |
| `features/boards/components/Modals/DealDetailModal.tsx` (~:860) | Remover linha `deal.companyName` |
| `features/deals/cockpit/DealCockpitClient.tsx` | Remover referências `clientCompanyName`/`companyName` |
| `lib/query/hooks/useContactsQuery.ts` | Remover os 6 hooks de company |
| `lib/query/queryKeys.ts` | Remover key `companies` |
| `lib/supabase/contacts.ts` | Remover `companiesService` + transforms `DbCRMCompany`; limpar barrel `lib/supabase/index.ts` |
| `app/api/public/v1/companies/route.ts` + `[companyId]/route.ts` | Apagar rotas; limpar `lib/public-api/openapi.ts` (tag Companies) + `docs/public-api.md` + testes `test/publicApi.*` de companies |
| `supabase/functions/webhook-in/index.ts` (:257-425) | Remover bloco que auto-cria/vincula `crm_companies` (manter `inbound_company_name` como texto). ⚠️ Exige **redeploy da edge** com `verify_jwt:false` + curl de verificação ([[reference_deploy_edge_verify_jwt]]) |
| `types/types.ts` | Remover `CRMCompany`, `ClientCompanyId`, campos `clientCompanyId`/`clientCompanyName` e mapeamentos em `lib/supabase/deals.ts` / `lib/contacts/detail.ts` |

**Verificação F1:** /contacts sem tab Empresas; criar/editar contacto e negócio sem campo empresa;
lead de teste pelo webhook-in entra limpa; typecheck/lint/test verdes; API pública `/companies` → 404.

---

## F2 — Migração SQL: contadores rápidos por negócio

Nova migration `supabase/migrations/20260723TTTTTT_deal_quick_stats.sql` (idempotente):

```sql
-- Contadores rápidos por negócio: contactos manuais, automáticos e tarefas em aberto.
-- Conta actividades do negócio E do contacto do negócio (automações escrevem em ambos).
create or replace function public.deal_quick_stats(p_deal_ids uuid[])
returns table (
  deal_id uuid,
  manual_touches int,
  auto_touches int,
  open_tasks int
)
language sql
stable
set search_path = public
as $$
  select
    d.id as deal_id,
    coalesce(count(da.id) filter (
      where da.actor = 'human'
        and da.type not in ('stage_moved','stage_change','created','system','TASK')
    ), 0)::int as manual_touches,
    coalesce(count(da.id) filter (where da.actor = 'automation'), 0)::int as auto_touches,
    (
      select count(*)::int from public.activities a
      where a.deal_id = d.id and a.completed = false and a.deleted_at is null
    ) as open_tasks
  from public.deals d
  left join public.deal_activities da
    on da.organization_id = d.organization_id
   and (da.deal_id = d.id or (da.deal_id is null and da.contact_id = d.contact_id))
  where d.id = any(p_deal_ids)
    and d.organization_id = public.get_user_org_id()
  group by d.id;
$$;

grant execute on function public.deal_quick_stats(uuid[]) to authenticated;
revoke execute on function public.deal_quick_stats(uuid[]) from anon;
```

Notas: `security invoker` + filtro por `get_user_org_id()` (defesa em profundidade, padrão da casa);
o índice `idx_deal_activities_deal_actor_created` já cobre a junção.

---

## F3 — Modal "Actividade" (Nota | Contacto) no NEGÓCIO + Resultado

### 3.1 Vocabulário canónico (PT-PT pré-AO 1990, copy sem hífens desnecessários)

**Canal** (reusa os `type` existentes + novo `sms`):

| valor | label |
|---|---|
| `call` | Chamada |
| `whatsapp` | WhatsApp |
| `sms` | SMS |
| `email` | Email |
| `meeting` | Reunião |
| `visit` | Visita |

**Resultado** (novo, guardado em `metadata.result`):

| valor | label |
|---|---|
| `answered` | Atendeu / Respondeu |
| `returned` | Retribuiu |
| `no_answer` | Não atendeu / Sem resposta |
| `voicemail` | Deixou mensagem / Voicemail |
| `rescheduled` | Reagendou / Ligar depois |

**Decisão de contagem (VALIDADA pelo João 23/07):** uma chamada não atendida **conta** como contacto
manual (é trabalho feito — na foto de referência "2 man" inclui 2 chamadas não atendidas), MAS como
a lead ainda não foi atendida de facto, **o relógio do pipeline continua a contar** — a lead continua
a somar "dias no pipeline" e continua "por contactar" para o follow-up. Ou seja: `human_touches` +1,
mas `last_human_touch` NÃO é actualizado quando `result ∈ (no_answer, voicemail)` (ver F5).

### 3.2 API

**`app/api/deals/[id]/activities/route.ts`** — estender:

- `POST` (já existe): allow-list passa a `call|whatsapp|sms|email|meeting|visit|note`;
  body ganha `result?` (validar contra a lista acima; só faz sentido com canal, não com nota) e
  `occurredAt?` (registo retroactivo, como já faz o endpoint de contactos); grava
  `metadata: { via: 'activity-modal', result }`, `actor` default `'human'`, `owner_id = user.id`.
- `GET` (novo): devolve `{ entries: TimelineEntry[] }` — `deal_activities` do negócio **e** do
  contacto do negócio, ordenadas desc, mesmo shape do timeline de contactos.
- `DELETE /api/deals/[id]/activities/[activityId]` (novo ficheiro): só apaga registos
  `actor='human'` (espelho exacto do DELETE de contactos).

**`app/api/contacts/[id]/activities/route.ts`** — só acrescentar `result` e `sms` ao POST
(mesma validação), para a ficha de contacto falar a mesma língua.

### 3.3 Lib partilhada

Novo `lib/activities/timeline.ts`:
- Mover para aqui o código de `getContactTimeline` (`lib/contacts/detail.ts:202-245`) generalizado:
  `getTimeline({ contactId?, dealId? })` → para deal faz `or(deal_id.eq.X, and(deal_id.is.null,contact_id.eq.Y))`.
- `TimelineEntry` ganha `result?: string`.
- `lib/contacts/detail.ts` passa a delegar aqui (sem mudar o shape que a ficha de contacto consome).

### 3.4 Componentes

Novo `components/activity/` (partilhado, não é feature-specific):

- **`ActivityLogForm.tsx`** — o formulário: abas **Nota | Contacto**.
  - Aba Contacto: select **Canal** + select **Resultado** (obrigatórios), textarea
    "O que se falou? (opcional — texto ou microfone)" com botão 🎙 de ditado
    (Web Speech API `webkitSpeechRecognition`, `lang: 'pt-PT'`; se o browser não suportar,
    o botão não aparece — progressive enhancement, sem dependências).
  - Aba Nota: só textarea (grava `type:'note'`).
  - Botões: "Fechar" + "Registar contacto" (na aba Nota: "Guardar nota").
  - Props: `{ onSubmit(payload), submitting }` — agnóstico de deal/contacto.
- **`ActivityHistory.tsx`** — lista "Histórico (N)": ícone do canal, label do canal, chip do
  Resultado (rosa para `no_answer`/`voicemail`, verde para `answered`/`returned`, neutro resto),
  badge 👤 Você / 🤖 Automação, descrição, autor + data, 🗑 só em registos humanos.
  Props: `{ entries, onDelete? }`.
- **`DealActivityModal.tsx`** — modal (Radix Dialog, padrão da casa; atenção ao gotcha
  focus-trap/ConfirmDialog de 16/07): header "Actividade" + nome do contacto,
  `ActivityLogForm` em cima, `ActivityHistory` em baixo (scroll próprio).
  Props: `{ dealId, contactId, contactName, open, onOpenChange }`.
  Dados: `useQuery(queryKeys.deals.activities(dealId))` → GET novo; mutation POST com
  invalidação dessa key + `queryKeys.deals.quickStats`.

**Refactor do existente:** `features/contacts/components/ContactTimeline.tsx` passa a compor
`ActivityLogForm` + `ActivityHistory` (comportamento igual ao actual + campo Resultado).

### 3.5 Onde abre o modal

1. **`DealDetailModal.tsx`** — botão "Registar contacto" no header (junto aos touchpoints CHQ).
2. **`features/activities/components/ActivityRow.tsx`** (/activities) — botão "Notas & contactos"
   quando a tarefa tem `dealId` (é o fluxo da imagem 1: da lista de follow-ups directo ao registo).
3. **`features/hoje/HojePage.tsx`** — NÃO mexer agora (os botões Liguei/Atendeu ficam; só F5 alinha o que gravam).

---

## F4 — Badges rápidos da lead (a "linha" da imagem 1)

Novo `components/activity/DealQuickBadges.tsx` — linha compacta de chips:

`📞 2 man · ⚡ 1 auto · ☑ 4 tar   ·   [canal: Meta Ads]   ·   ⏱ 14d no pipeline`

- **man/auto/tar**: RPC `deal_quick_stats` via novo hook `lib/query/hooks/useDealQuickStats.ts`
  — `useQuery(queryKeys.deals.quickStats(dealIds), () => supabase.rpc('deal_quick_stats', { p_deal_ids }))`,
  `staleTime: 60_000`, aceita array (uma chamada por lista visível, nunca N+1).
- **Canal de aquisição**: client-side — `deal.attribution?.source` → senão `contact.source` → senão
  omitir chip. Labels: `meta_ads`→"Meta Ads", `whatsapp`→"WhatsApp", `calculadora-avaliar`→"Estudo de Mercado", etc. (mapa `lib/activities/sourceLabels.ts`).
- **Dias no pipeline**: `deal.createdAt` → `Nd no pipeline` (é idade do negócio; distinto do badge
  "Xd na fase" que já existe e fica como está). Cor: âmbar >14d, rosa >30d.

**Superfícies (nesta ordem):**
1. `DealDetailModal.tsx` — header, por baixo do título (fonte de verdade visível ao abrir).
2. `ActivityRow.tsx` (/activities) — à frente do título quando há `dealId` (réplica da imagem 1).
3. `features/boards/components/Kanban/DealCard.tsx` — versão mínima (`2m·1a·4t`) só com os 3
   contadores (o cartão já mostra dias na fase; não duplicar).

---

## F5 — Verdade única: alinhar Power List + relógio de conversa

1. `app/api/power-list/action/route.ts` (:145-153): "Não atendeu" passa a gravar
   `type:'call'`, `actor:'human'`, `metadata: { result: 'no_answer', via: 'power-list' }`
   (deixa de ser `type:'system'`) — assim conta como contacto manual, igual ao modal.
2. Migration (na mesma F2 ou separada): `create or replace` de `deal_state_signals` — no cálculo de
   `last_human_touch` acrescentar
   `and coalesce(da.metadata->>'result','') not in ('no_answer','voicemail')`
   (o relógio de conversa/follow-up só conta conversas reais; `human_touches` continua a contar tudo).
   Replicar no wrapper `my_deal_state_signals` se necessário (é só proxy).
3. Verificar que o bucket `followup` da power_list continua correcto com a mudança (testar com um
   negócio de teste em staging de dados: registar não atendida → days_since_human_touch não zera).

---

## F6 — Testes + deploy + verificação real (definição de "pronto")

- Vitest: unit para validação do POST (canal×resultado), para `getTimeline` (merge deal+contacto)
  e para o mapa de labels; story para o modal (abrir → registar → aparece no histórico).
- `npm run precheck` verde; push → Vercel ([[feedback_crm_deploy_vercel_e_definicao_de_pronto]]).
- Redeploy edge `webhook-in` (F1) com `verify_jwt:false` + curl 403/404 de confirmação.
- Teste ponta a ponta em produção (mobile 375 + desktop + modo escuro):
  1. /contacts sem Empresas; formulários sem campo empresa; lead de teste entra pelo webhook.
  2. Abrir negócio → badges no header com números certos (conferir contra SQL directo).
  3. Registar contacto (Chamada + Não atendeu + nota ditada) → histórico actualiza, badge man +1.
  4. Registar nota; apagar um registo humano; confirmar que automação não é apagável.
  5. /activities: badges na linha + botão abre o modal do negócio certo.
  6. /hoje: "Não atendeu" → aparece no histórico como Chamada · Não atendeu.

## Fora de âmbito (NÃO fazer nesta obra)

- Dropar `crm_companies`/colunas na BD (fica órfã de propósito; migrations históricas intocáveis).
- Mexer no motor de follow-up para além do filtro de resultado (F5.2).
- Sincronização de tarefas com calendário externo; bulk-snooze do /activities (placeholder conhecido).
- Qualquer coisa de WhatsApp coexistência / Caixa Social (épicos próprios no TODO).
