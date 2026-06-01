# TODO — Foco Imo (CRM) — CATÁLOGO ÚNICO

> **FONTE DE VERDADE ÚNICA do backlog.** Consolida (31/05/2026) o antigo `CAPTURE.md`
> + o `crm/.claude/TODO.md` (1744 linhas, planeamento 14-18 Mai) + a memória viva.
> Regra do João: **nada se perde.** Primeiro catalogamos tudo; depois ordenamos do mais
> importante para o menos e seguimos o plano. Cada item tem ID estável para referência.
>
> - **Estado:** `[FEITO]` · `[PARCIAL]` · `[POR FAZER]` · `[STALE]` (arquivar).
> - **Prioridade:** `P?` = ainda por decidir com o João. Definimos juntos numa passagem dedicada.
> - Regra de sessão: 1 objectivo de cada vez; ideias novas entram AQUI, não se implementam logo.
> - Verificar SEMPRE contra código/BD antes de marcar `[FEITO]`.
>
> 🚨 **REGRA OBRIGATÓRIA E INEGOCIÁVEL (João, 01/06): TUDO funciona em MOBILE *e* DESKTOP.**
> Nenhuma feature fica feita sem estar verificada em mobile (375/540) **e** desktop (e tablet 768
> quando aplicável). Tripla verificação mobile + screenshot. Sem excepções.

---

## 🗓️ Registo da sessão 31 Mai → 01 Jun 2026 (o que ficou feito)
- **NAV-MOBILE-DRAWER** ✅ — hambúrguer + gaveta esquerda no mobile (BottomNav removida).
- **TODO-CONSOLIDATE** ✅ — este catálogo único (CAPTURE + todo.md antigo + memória).
- **Q-1 PT-BR→PT-PT** ✅ — sweep exaustivo da copy visível; + Q-BUG-IA + B-LINT.
- **NS-1 GESTÃO FINANCEIRA** ✅ — hub `/financeiro` (Visão de Gestor + Despesas) + funil de
  conversão + ficha por angariação (comissão % ou € + ganho líquido real).
- **MA-DRILLDOWN Fase 1** ✅ — drill-down por anúncio (criativo+copy+métricas+leads/negócios).
- **Limpeza** ✅ — removidos BottomNav + MoreMenuSheet (mortos).
- **Falta a seguir:** **CT-1 + CT-2** (card de contacto rico + atribuição = base do CONTACT-360-AI).

---

## 🎯 PRIORIZAÇÃO (proposta aprovada pelo João 31/05/2026 — ajustável)

> Lógica: anúncios prestes a religar → leads a entrar. O que mede/converte/protege
> essas leads agora vale mais. 1 utilizador → RBAC não urgente. Diferenciador = CONTACT-360.
> **Arranque imediato: Q-1.**

**🥇 P1 — a seguir (ordem de execução):**
1. ~~**Q-1** Sweep PT-BR→PT-PT~~ ✅ **FEITO (01/06, commit `964ac65`)** — copy visível limpa (features/components/app/lib/prompts/templates/install). Resta **Q-2** (comentários/JSDoc + lib/ai rules + fixtures de teste) — não-visível, P3.
2. ~~**NS-1** Custos + ROI no dashboard~~ ✅ **FEITO (01/06)** — hub `/financeiro` (Visão de Gestor + Despesas) + ficha por angariação no negócio
2b. ~~**MA-DRILLDOWN** dados por criativo~~ ✅ **Fase 1 FEITA (01/06)** — drill-down por anúncio (criativo+copy+métricas+leads/negócios). Falta árvore Campanha→Conjunto→Anúncio (P2).
2c. ~~**CT-1 + CT-2** card de contacto rico + atribuição read-only~~ ✅ **FEITO (01/06, HEAD `a24ebc3`, LIVE)** — página `/contacts/[id]` (campos Notion editáveis + Indicado por/Indicou + atribuição read-only). Falta Fase 3 (comentários), `P2`.
3. **CONTACT-360-AI** (NS-2) — assenta agora no CT-1/CT-2 ← próximo grande diferenciador
4. **MA-DRILLDOWN Fase 2** · **MSG-WHATSAPP-PROPRIO** · **MKT-STUDIO**

**🥈 P2 — logo a seguir:**
5. NS-2 CONTACT-360-AI · 6. MSG-1 WhatsApp/SMS próprio · 7. DASH-2 lead scoring ·
8. MSG-3 email tracking · 9. INT-1 portais imobiliários · 10. IMO-3/4/5 · 11. MKT-STUDIO

**🥉 P3 — depois / diferido:**
12. INT-2 Google Calendar · AUTO-1..6 · DASH-1 polish · UX-1 NAV-IA · IA-1..6 · MSG-4 · MA-OFFLINE · MA-BACKFILL-ASYNC · MA-CAPI ·
13. Diferidos por dependência/escala: IMO-1 portal cliente · IMO-2 CPCV digital (~6 meses) · Q-3 RBAC (só com 2.º utilizador) · Q-4 audit alargado

---

## ✅ JÁ FEITO (não re-propor — verificado em código/BD a 31/05/2026)

- **Magic Inbox** (`raw_intel`) + **KB do Pilot** (`ai_kb_facts`).
- **Match Engine** comprador↔imóvel (`matches`, rotas `/matches` + `/cruzamentos`).
- **Imóvel como entidade + histórico** (#120 🔥): `imoveis`, `imovel_eventos`, `deals.imovel_id`.
- **Construtor visual de automações** (#123) + **logs** (#127): `system_automations`, `automation_executions`, `/automacoes`, engine loop/parallel/suspend-resume.
- **Telegram operacional** (#128), **transcrição de chamadas** (#130, edge `process-call`), **captura foto/áudio** (#121, VoiceCaptureFAB + CHQ).
- **Email directo Resend — LIVE** (átomo `action.send_email`, domínio próprio autenticado).
- **Backup semanal automático** (cron `backup-weekly`).
- **Pilot IA + 9 ferramentas** + prompts v2/v3 PT-PT formal "entrego primeiro".
- **Meta Ads épico** Fases A+B: webhook leads c/ atribuição, `/anuncios` (CPL/CPA/ROAS + criativo), analista IA diário, **MA-EDIT tier fácil** (pausar/orçamento adset+CBO), **recepção de leads** (encaminhamento por campanha + Telegram).
- **NAV-MOBILE-DRAWER** (31/05): hambúrguer + gaveta esquerda no mobile, BottomNav removida.
- Bugs resolvidos: B-001..B-006, B-008..B-011, T-001 (ver histórico no fim).

---

## 🔴 BACKLOG POR FAZER — agrupado por tema (prioridade a definir)

### A. Visão-núcleo / North Star ("CRM + IA = mais negócio com menos esforço")

- **NS-1 · Gestão Financeira (custos + ROI + ganho líquido por angariação)** `[FEITO]` (01/06, HEAD `6f6c002`) — Fases 1-4 completas + **funil de conversão por pipeline** (real, com %). Falta só polish futuro: retorno **por canal** (Facebook vs Idealista...); comissão fixa pode querer significar "líquida directa" (hoje é bruta+split). `P3` para esses extras.
  Maqueta aprovada pelo João (visão de gestor + ficha por angariação). **Fase 1+2 FEITAS (01/06):** migração `expenses` (RLS CRUD, liga a deal/imóvel) + comissão por defeito na org (5%/50%); API `/api/expenses`; página `/despesas` (form+lista+total), nav desktop/tablet/mobile. Verificado em produção local. **Fase 3 FEITA (01/06):** hub `/financeiro` com separadores Visão de Gestor (API `/api/financeiro/summary`: comissões líquidas vs investimento→lucro/margem/retorno + leads/custo-lead + repartição) e Despesas. Verificado real (anúncios 871,89€, 819 leads, 1,06€/lead). **Falta Fase 4** (ficha por angariação no detalhe do negócio: comissão em **% OU € fixo** + parte do consultor + custos atribuídos àquele imóvel = **ganho líquido real**; ligar despesa a um negócio). Defaults já na org; override por deal em `deals.custom_fields` (commission_mode/commission_pct/commission_amount/consultant_share_pct) — a API summary já lê isto. Futuro: por canal + funil no gestor. Nota: hoje 0 negócios ganhos → comissões a 0; anúncios já reais.
  --- contexto original ---
  A "obsessão pelos números" do João: medir gasto Gemini/Claude/Vercel/Supabase/ads e mostrar **ROI = receita/custos**. NÃO existe (`ai_usage`/`cost_events` ausentes na BD). Núcleo da visão. (origem: North Star + Dashboard #3 + Fase 5.3 + #87/#98)

- **NS-2 · CONTACT-360-AI — perfil 360° + IA que relaciona tudo** `[POR FAZER]` `P?`
  Visão-núcleo do João: "conhecer a pessoa de verdade", enriquecimento progressivo, IA cruza DISC+família+triggers+aniversário+última actividade → próxima melhor acção e copy hiper-pessoal. Meta: "pensa mais à frente, diferente de todos no imobiliário". Assenta em CONTACT-CARD-NOTION + MSG-WHATSAPP-PROPRIO + IA existente. Extensões: auto-enriquecimento por interacção, camada de relação (graph Referred By/Referred), próxima melhor acção, copy hiper-pessoal. (origem: CAPTURE CONTACT-360-AI)

- **NS-3 · Custo total por imóvel (publicidade + visitas + combustível) e ROI por imóvel** `[POR FAZER]` `P?` (CAPTURE 01/06, ideia do João)
  "Quanto gastei com determinado imóvel a nível de publicidade, visitas, combustível." **Dados já existem** — `expenses` liga a `imovel_id` + `category` + `amount_cents`. **Falta:** vista de **rollup de custos por imóvel** (na ficha `/imoveis/[id]` e no /financeiro) + categorias específicas (combustível/deslocações/publicidade) + **juntar o gasto de anúncios atribuível** ao imóvel (via atribuição Meta) → custo total e, com a venda, ROI por imóvel. Liga a NS-1 (Gestão Financeira) e a MA-LTV-ATTRIBUTION.

### B. Contactos / dados ricos

- **CT-1 · CONTACT-CARD-NOTION — campos do card de contacto do Notion** `[FEITO]` (01/06, HEAD `a24ebc3`, LIVE)
  Decisão: página dedicada **`/contacts/[id]`** + **`custom_fields jsonb`** (maqueta aprovada em `docs/mockups/ct1-ct2-contact-card.html`). Migração `20260601120000_contact_rich_fields` (`contacts.custom_fields` + `contact_referrals`). Campos editáveis: Morada/Investimento, Família, Animais, Triggers, DISC, Trimestre, Aniversário, Última actividade, Follow Up + **Indicado por/Indicou** (picker). Notas + Documentos (reusa `ContactFilesPanel`). APIs `PATCH /api/contacts/[id]` + `POST/DELETE /api/contacts/[id]/referrals`. Editor `features/contacts/components/ContactRichPanel.tsx`. **Fase 3 FEITA (`f89fcf0`):** Comentários (`contact_comments` + `ContactComments` + API POST/DELETE, autor resolvido via `profiles`). CT-1 completo fim-a-fim.

- **CT-2 · Painel de atribuição read-only no contacto (c4.2)** `[FEITO]` (01/06, HEAD `a24ebc3`, LIVE)
  Bloco `MetaAttribution` read-only no topo da ficha `/contacts/[id]`. `Contact.attribution` + mapeamento já existiam; loaders server-side em `lib/contacts/detail.ts`.

- **CT-3 · Tag automática da linhagem (c4.3)** `[POR FAZER]` `P?`
  `contacts` não tem coluna `tags`. Mexe no modelo de tags + edge `automation-meta-leads` (aplicar "Meta Ads: <campanha>"). Ligado à regra origem-obrigatória.

- **CT-AUTO · Auto-preenchimento de campos CT-1 + automações de follow-up** `[POR FAZER]` `P?` (CAPTURE 01/06, ideia do João)
  Quando uma lead/contacto entra (manual OU via anúncio), o CRM sabe o dia → **preencher automaticamente** `custom_fields.quarter` (Trimestre, ex. Q3 2026) e `lastActivityDate` (data de entrada), sem o João tocar. Depois **criar automações** (no engine `/automacoes`): definir `followUpDate` por regra, lembretes "follow up hoje", e cadências (ex.: se sem actividade há X dias → criar tarefa). Campos já existem (`custom_fields`, migração `20260601120000`). Pontos a decidir: trigger BD vs preencher no webhook `automation-meta-leads` + no `contactsService.create`; regras de cálculo do Trimestre; defaults de follow up. Liga ao engine de automações e a [[regra-automacoes-no-crm]].

### C. Mensagens / canais

- **MSG-1 · MSG-WHATSAPP-PROPRIO — SMS+WhatsApp número próprio (sem Meta)** `[POR FAZER]` `P?`
  WhatsApp não-oficial via número próprio (Evolution/Z-API, providers já em `lib/messaging/`) + SMS (Twilio/PT). Inbox unifica; **guarda selectiva** (botão "guardar no CRM", não tudo); **registo no card** (timeline do deal). Decisões: Evolution vs Z-API, critério guarda, SMS provider. (origem: CAPTURE MSG-WHATSAPP-PROPRIO)

- **MSG-2 · WhatsApp Cloud API (Meta) — standby externo** `[PARCIAL]` `P?`
  Átomo `action.send_whatsapp` deployado; falta o João montar WABA/número + token permanente e dar `phoneNumberId`/`accessToken` → inserir canal `meta_cloud`.

- **MSG-3 · Email — evolução do Resend** `[POR FAZER]` `P?`
  Tracking open/click, inbound emails → timeline do deal (In-Reply-To matching), bounce/complaint webhooks, logar como `activity`. (origem: estudo Resend 18 Mai)

- **MSG-4 · M-013 Assinaturas de email (opcional por automação, várias)** `[POR FAZER]` `P?`
  Tabela `email_signatures`, átomo ganha `incluir_assinatura`+`signature_id`, banner RE/MAX inline via CID. (origem: CAPTURE M-013)

### D. Meta Ads / Marketing (evolução do épico)

- **MA-DRILLDOWN · Atribuição/controlo ao nível do criativo** `[EM CURSO]` `P1`
  **Fase 1 FEITA (01/06, verificada em produção):** botão "Ver dados" por anúncio no /anuncios → drawer `AdDrilldownDrawer` (`/api/meta-ads/ad/[id]/drilldown`) com criativo+copy (busca à Meta via `getAdCreativeCopy`, cacheia em `ad_creatives.title/body/cta_type`), métricas vitalícias, e listas de **leads (contacts) e negócios (deals) atribuídos** por `attribution.ad_id`. Verificado live: métricas reais (25,11€/59 leads), listas vazias (campanhas em pausa). **Falta Fase 2 (P2):** vista em **árvore Campanha→Conjunto→Anúncio**; e melhorar extracção de copy para criativos dinâmicos (asset_feed_spec.titles/bodies — hoje só lê creative.title/body/object_story_spec). Detalhe original abaixo.
  Drill-down por anúncio (lista de leads/negócios + € efectivo), guardar+mostrar copy/headline/CTA do criativo (`ad_creatives` ganha title/body/cta), vista em árvore Campanha→Conjunto→Anúncio. Núcleo: medir qual criativo dá dinheiro. (origem: CAPTURE MA-DRILLDOWN)

- **MKT-STUDIO · Estúdio de marketing completo no CRM** `[POR FAZER]` `P?`
  Sub-épicos: MA-CREATE (criar campanha/anúncio via API), criativos+carrosséis IA c/ Brand Kit, LPs imóveis+captação, posts sociais, documentos (cartas/apresentações/ACM-CMA). Reusa Brand Kit, `/criativos`, `/avaliar`. (origem: CAPTURE MKT-STUDIO)

- **MKT-SOCIAL · Publicação social no CRM (Meta + LinkedIn) com ciclo de aprendizagem** `[POR FAZER]` `P?` (CAPTURE 01/06, ideia do João)
  Compor publicações no CRM e publicar nas redes a partir daqui, **conteúdo pensado por plataforma**: **Meta** (Instagram + Facebook) num só clique com o mesmo conteúdo; **LinkedIn** como peça própria (rede diferente, linguagem/formato próprios — a IA adapta). Fotos carregadas OU geradas por IA (reusa `/criativos` + Brand Kit). Fluxo: rascunho → **pendente de validação do João** → 1 clique publica no(s) sítio(s) certo(s). **Histórico guardado no CRM**: o quê, onde, quando + **métricas** (visualizações, comentários, toda a interação) — "o que se faz no Meta e no LinkedIn, mas tudo aqui sem abrir 2 plataformas". A **IA analisa conteúdo+estratégia+resultados** e aprende (medir→aprender→melhorar): diz o que repetir/evitar/reenquadrar no mês seguinte. Alinhar copy/CTA com [[reference-meta-ia-2026-best-practices]] (criativo é o novo targeting; CTA a pedir DM). Teste "serve qualquer consultor": fácil, intuitivo, sem falhas. APIs prováveis: Meta Graph (IG/FB publishing) + LinkedIn API (revisão de permissões/escopos), tabelas `social_posts` + `social_post_metrics`, cron de recolha de métricas (em /automacoes). Liga a MKT-STUDIO (é o sub-épico "posts sociais" expandido) e ao analista IA existente (mesmo cérebro p/ orgânico).
  **Nuance do João (01/06):** além de publicar, **importar/detectar o que já está postado** (orgânico histórico) e analisá-lo **ao mesmo nível dos anúncios Meta** — o CRM é o assistente de conteúdos: diz **quando faz sentido renovar/trocar** um conteúdo (com base nas métricas e no histórico do que resultou, por canal). Marca pessoal do João ("marca lendária") como fio condutor. Reusa [[joao-fonseca-brand]] (skill) + Brand Kit.

- **MKT-BP-AUTOLEARN · Boas práticas Meta/IA sempre actualizadas (auto-aprendizagem)** `[POR FAZER]` `P?` (CAPTURE 01/06)
  A IA não fica presa ao doc `docs/meta-ia-2026-best-practices.md`: passo periódico (IA + web) que procura alterações/recomendações mais recentes e actualiza as práticas que alimentam o analista IA e a geração de copy. Fechar ciclo: resulta→continua, não resulta→repensa. Base: [[reference-meta-ia-2026-best-practices]].

- **MA-LTV-ATTRIBUTION · Atribuição vitalícia "conta inglesa" (1 anúncio → N negócios ao longo do tempo)** `[POR FAZER]` `P?` (CAPTURE 01/06, ideia do João)
  Um anúncio que trouxe um comprador deve ser creditado pelo valor da venda dessa casa — **e** pelos negócios que daí derivam ao longo do tempo: (a) quem essa pessoa **referenciou** (já temos o grafo `contact_referrals` Indicado por/Indicou, construído no CT-1), (b) a **recompra/revenda futura** da própria pessoa (ex.: vende a casa dele 3 anos depois e volta a ele). Objectivo: "valor vitalício do anúncio" = soma de todos os negócios da linhagem (ex.: 1 anúncio → 3 negócios). **Fundação já existe:** `attribution` por anúncio (contacts/deals) + `contact_referrals` + princípio de [[feedback-medicao-vitalicia-e-ciclo]] + MA-DRILLDOWN Fase 1. **Falta o motor:** ao fechar um negócio, subir a cadeia (quem trouxe esta pessoa / que anúncio originou a linhagem) e creditar para cima; vista no drill-down do anúncio com o total vitalício + ramificações. Liga a MA-DRILLDOWN e ao financeiro (ROI vitalício por anúncio).

- **MA-OFFLINE · Marketing offline rastreável (QR)** `[POR FAZER]` `P?`
  `offline_campaigns` (fotos+investimento), QR único → captura `?src=`, atribuição fonte `offline` lado a lado com Meta no dashboard. (origem: CAPTURE MA-OFFLINE)

- **MA-B2.1 · Métricas em falta no /anuncios** `[PARCIAL]` `P?`
  CTR já pode estar; rever CPM, frequência/saturação, conversão lead→negócio por anúncio, sparkline tendência. (origem: CAPTURE)

- **MA-BACKFILL-ASYNC · Backfill plurianual via API async** `[POR FAZER]` `P?`
  Só necessário para contas com histórico longo (Marketing API async report_run_id). Não urgente. (origem: CAPTURE)

- **MA-CAPI (b3) · Conversões de volta à Meta** `[POR FAZER]` `P?`
  Negócio ganho → `metaCapiEvent`. Considerar com regra origem-obrigatória. (origem: estado)

### E. Dashboard / números

- **DASH-1 · Fase 5 polish** `[PARCIAL]` `P?`
  Multi-select de pipelines em todos os widgets (5.1), funil cumulativo + conversão por etapa (5.4), tabela de fonte de leads com KPIs cruzados (5.7), tarefas inline com 3 filtros (5.5), acções manuais (5.6). Confirmar widget a widget o que já existe. (origem: Fase 5)

- **DASH-2 · Lead scoring engine** `[POR FAZER]` `P?`
  GHL "Manage Scoring": pontos por evento (+visita/+abriu email/−sem resposta 7d), score visível na DealCard. Não existe na BD. (origem: GHL Manage Scoring + #scoring)

- **DASH-3 · Painel de actividade do consultor (métricas do que fiz)** `[POR FAZER]` `P?` (CAPTURE 01/06, ideia do João)
  "Quero saber quantas visitas fiz no ano, quantas reuniões com proprietários, quantas avaliações." **Dados já existem** em `deal_activities` (tipos call/meeting/visit/whatsapp/email). **Falta:** painel agregado por período (ano/mês) com contagens por tipo + **subtipos** que hoje não há (ex.: "reunião com proprietário", "reunião de avaliação") — decidir se via subtipo/tag no `metadata` ou novos tipos. Sai automático, sem trabalho extra do João. Liga a DASH-1 (Fase 5) e a /relatorios.

### F. Integrações

- **INT-1 · Portais imobiliários (Idealista / Imovirtual / Casa Sapo)** `[POR FAZER]` `P?`
  Webhooks para receber leads desses portais (hoje só Meta Ads). Alto valor de captação. (origem: Integrações pendentes)

- **INT-2 · Google Calendar sync** `[POR FAZER]` `P?`
  Sincronizar visitas/atividades. (origem: Integrações pendentes)

- **INT-3 · Notta AI / transcrição externa via webhook** `[PARCIAL]` `P?`
  Já há `process-call`; avaliar integração Notta via Zapier vs sistema próprio (#130 já parcialmente coberto). (origem: memória reference_notta_ai)

### G. Imobiliário-específico

- **IMO-1 · Portal/Área VIP do cliente (#122 / 4.6)** `[POR FAZER]` `P?`
  Cliente vê estado do processo, documentos, visitas, CMA via link único temporário (`/client/[token]`). NÃO existe no nossocrm (≠ Portal F&R). (origem: #122 + 4.6)

- **IMO-2 · CPCV digital + sinais (Payments)** `[POR FAZER]` `P?`
  Assinatura digital de CPCV (link único por SMS) + Payment Links para sinais + facturas IVA/SAF-T. Dor real do imobiliário; estava "adiar 6 meses". (origem: GHL Payments)

- **IMO-3 · M-010 Imóvel parado → alerta IA com nova estratégia** `[POR FAZER]` `P?`
  Cron detecta imóvel disponível há >X dias sem visita → 3-5 estratégias rankeadas + botão "Adoptar". (origem: CAPTURE M-010)

- **IMO-4 · M-011 Abordagem a FSBOs (intent=fsbo_tip)** `[POR FAZER]` `P?`
  IA propõe sequência: script 1.º contacto, follow-up, visita-pretexto, argumentos FSBO→angariação, material. (origem: CAPTURE M-011)

- **IMO-5 · M-012 Checklist por mudança de estágio** `[POR FAZER]` `P?`
  `stage_checklists` por board+stage (documentos/acções obrigatórias), modal bloqueador com "Avançar mesmo assim" (audit). (origem: CAPTURE M-012)

- **IMO-6 · Gestão de mandatos: validade do contrato + alertas + acções automáticas** `[POR FAZER]` `P?` (CAPTURE 01/06, ideia do João)
  Proprietários com contrato/mandato assinado: contar o **tempo de contrato** e **alertar "faltam X dias"** para a validade. **Dados já existem** — `imovel_mandatos` tem `data_inicio`, `data_fim`, `comissao_pct`, `activo`. **Falta:** contagem decrescente na ficha do imóvel + cron de alertas (Telegram/tarefa) a X dias do fim + **escalada automática** (ex.: a cada X tempo, se o imóvel **não tem propostas/visitas**, disparar acções/estratégia — liga a IMO-3 "imóvel parado → alerta IA"). Toda automação em [[regra-automacoes-no-crm]].

### H. Automação / engine (roadmap Pinheirinho)

- **AUTO-1 · #124 Pause-on-touch** `[POR FAZER]` `P?`
  Automação pausa quando humano move card (`paused_by_human`), só re-arranca com Reset explícito. Confirmar se já no engine. (origem: #124)

- **AUTO-2 · #125 Tags como gatilhos de transição** `[POR FAZER]` `P?`
  `automation_triggers` com kind tag_added/removed/task_completed/payment_confirmed (cross-stage). (origem: #125)

- **AUTO-3 · #126 Nunca marcar "perdido" automaticamente** `[POR FAZER]` `P?`
  Inactivo > N dias → cria TAREFA humana "decidir perdido ou follow-up", nunca muda status sozinho. (origem: #126)

- **AUTO-4 · #129 Pipeline "Recuperação de Leads"** `[POR FAZER]` `P?`
  Nurturing 6 meses (D+0/30/90/180) para leads frios, com market intel + valor. Confirmar se existe. (origem: #129)

- **AUTO-5 · #131 Estado "A aguardar" + Snooze no Inbox/Matches** `[POR FAZER]` `P?`
  Separar "Aberta" de "À espera resposta cliente"; snooze N dias → reaparece. (origem: #131)

- **AUTO-6 · 4.4 Notificações proactivas (Inbox de IA)** `[POR FAZER]` `P?`
  Cards diários: "4 deals há +10d em Proposta", "X faz anos amanhã", "lead Ana sem resposta há 5d". (origem: 4.4)

### I. UX / Navegação / Mobile

- **UX-1 · NAV-IA — agrupar sidebar em 6 famílias** `[POR FAZER]` `P?`
  16 itens → 6 grupos colapsáveis (Início/Comunicação/CRM/Imóveis/Marketing/Sistema). Confirmar famílias com o João. Nota: aplicar também à nova gaveta mobile (FULL_NAV). (origem: CAPTURE NAV-IA)

- **UX-2 · Custom fields em folders + prefixos consistentes** `[POR FAZER]` `P?`
  Organizar os 43 campos em folders (LP_/CP_/CV_ à la GHL). (origem: GHL Custom Fields)

- **UX-3 · DealCard mostrar custom fields (tipologia/zona/crédito)** `[POR FAZER]` `P?`
  Hoje workaround via tags. (origem: bugs/melhorias antigas)

### J. IA — performance e propagação

- **IA-1 · M-001 Propagar pipeline copy IA a todo o lado** `[POR FAZER]` `P?`
  DealCard hover, Modal Deal, /contacts/[id], matches, /scripts, briefing, Telegram. (~5-6 sessões) (origem: CAPTURE M-001)

- **IA-2 · M-002/M-006 UX latência IA (streaming/pre-gen/race)** `[POR FAZER]` `P?`
  Escolher 1: A streaming, B pre-generation background, C race Gemini‖Claude. 1ª chunk 6.6s→objectivo 1s. (origem: CAPTURE M-002/M-006)

- **IA-3 · M-004 UI /settings/prompts (editar prompts BD sem SQL)** `[POR FAZER]` `P?`
  Obrigatória ao 5.º-6.º prompt. (origem: CAPTURE M-004)

- **IA-4 · M-005 runRaceWithFallback em todos os cases /api/ai/actions** `[POR FAZER]` `P?`
  Só rewriteMessageDraft tem cache+race+timeout; aplicar aos restantes 9. (origem: CAPTURE M-005)

- **IA-5 · M-003 Reduzir snapshot na origem (compact vs full)** `[POR FAZER]` `P?`
  (origem: CAPTURE M-003)

- **IA-6 · 4.8 Sistema de créditos/limites de uso IA** `[POR FAZER]` `P?`
  Tracking por utilizador + alertas + cap mensal. Liga ao NS-1. (origem: 4.8)

### K. Qualidade / dívida

- **Q-1 · Sweep PT-BR→PT-PT (copy visível)** `[FEITO]` (01/06, commit `964ac65`)
  ~130 ficheiros, ~970 substituições em texto visível ao utilizador/lead (features/components/app/lib/prompts/templates/install) + consent LGPD→RGPD. 4 sub-agentes em paralelo, glossário fixo, regras de segurança (nunca identificadores/enums/rotas). tsc 0, vitest 407/5.

- **Q-2 · Resto do sweep PT-BR/AO90 (não-visível)** `[POR FAZER]` `P3`
  Comentários/JSDoc, `lib/ai/global-rules.ts` + `lib/ai/knowledge/imobiliario-pt.ts` (definem os termos a banir — rever com cuidado), fixtures de prompt em `app/api/test/**` e `app/(app)/test/`. Não vaza para cliente; baixa urgência.

- **Q-BUG-IA · Erros de sentido em `lib/ai/crmAgent.ts`** `[FEITO]` (01/06, commit `4d1b1d5`)
  "NUNCA europeu"→"NUNCA brasileiro (pt-BR)" e "Mistures pt-PT com pt-PT"→"Mistures pt-PT com pt-BR".

- **B-LINT · 2 erros eslint pré-existentes (MA-EDIT 31 Mai)** `[FEITO]` (01/06, commit `4d1b1d5`)
  MetaAdsSection `<a>` OAuth com eslint-disable justificado; AnunciosPage 2 directivas não usadas removidas. `npm run lint` volta a 0.

- **Q-2 · B-007 resto do sweep "deal"→"negócio" no UI** `[POR FAZER]` `P?`
  Labels DealDetailModal, Cockpit, board headers, toasts. Não tocar identificadores. (origem: CAPTURE B-007)

- **Q-3 · Multi-utilizador: RBAC granular (#85)** `[POR FAZER]` `P?`
  Owner/Admin/Member/Viewer + permissões scoped + RLS por role. **Portão antes de dar acesso a 2.º consultor (Helena).** Hoje só 1 user (João) → não urgente, mas obrigatório antes de crescer. (origem: #85)

- **Q-4 · Audit logs alargados (multi-utilizador)** `[PARCIAL]` `P?`
  Já há `audit_logs` para Meta; alargar a quem mexeu em quê quando crescer. (origem: GHL Audit Logs)

### L. Bugs UI activos

- **B-009 · 2 FABs sobrepostos (mobile)** — marcado resolvido no CAPTURE (confirmar visualmente). `[PARCIAL]`
- **B-002 · "manha" sem til em prompt WhatsApp** — mitigado em BD; rever a cada UPDATE. `[PARCIAL]`

### M. Pendentes do smoke test 22/05 (verificar se ainda aplicam)

- 94.9% deals com `value=0` → auto-value batch IA.
- React #418 hydration em `/imoveis/[id]`.
- Imóvel `ID-1234567` sem morada (seed/teste).
- Modelos "Antigravity"/"Nano Banana" no selector → filtrar em `GOOGLE_EXCLUDED_PATTERNS`.

---

## 🗑️ STALE — arquivar (já não fazem sentido)

- **GHL / GoHighLevel** — terminado. A "Biblioteca de padrões GHL" (crm TODO 402-815) fica só como INSPIRAÇÃO de UX/lógica, nunca tarefa nem estética.
- **Mailgun** — terminado (substituído por Resend LIVE).
- **Make** — não criar cenários sem necessidade; caminho vivo é /automacoes do CRM.
- **Airtable** — banido (dashboard próprio).
- **Webhook GHL bidirecional / polling GHL / tag `portal_conta_criada`** (do Portal) — mortos.
- **Limpeza de tokens "cowork-fase3"** + **estado BD "Deals:2 Contactos:1"** (crm TODO) — obsoletos.
- **Squash/limpeza labs** (crm TODO 1224-1228) — housekeeping antigo; reavaliar.

---

## 🔐 Alertas de segurança/privacidade a verificar

- **Backup:** confirmado cron `backup-weekly` activo. ✓
- **RBAC:** sem papéis granulares (Q-3) — fechar antes do 2.º utilizador.
- **Passwords triviais:** issue do **Portal F&R** (BD separada), não do nossocrm (1 user). Tratar no Portal.
- **Off-market confidencial (#100):** se importar imóveis off-market, flag anti-publicação + audit de quem viu.
- **Cartão/pagamentos:** se IMO-2/Payments, nunca guardar cartão no Supabase — usar provider PCI (Stripe).

---

## 📚 Referência (não-tarefa)

- Catálogo GHL completo (18 áreas) — em `crm/.claude/TODO.md` linhas 402-815 e `memory/references/ghl-feature-catalog.md`. Consultar para inspiração quando desenhar features.
- Análise do CRM "Inês" (Daniel Baptista) — `crm/.claude/TODO.md` Fase 4.

---

## Histórico de bugs resolvidos (arquivo)

B-001, B-003, B-004, B-005, B-006, B-008, B-010, B-011, T-001 — todos resolvidos (detalhe no git e no antigo CAPTURE.md/memória). B-007 parcial (ver Q-2).

---

> **Próximo passo combinado com o João (31/05):** catálogo completo ✅. A seguir,
> passagem de priorização (mais importante → menos), atribuir P1/P2/P3 a cada ID,
> e seguir o plano 1 objectivo de cada vez.
