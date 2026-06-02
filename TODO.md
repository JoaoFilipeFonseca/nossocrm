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

## 🗓️ Registo da sessão 01 Jun 2026 — SESSÃO 2 (o que ficou feito) — HEAD `261d3f1`
A ficha de contacto `/contacts/[id]` foi criada do zero e tornou-se a peça-núcleo:
- **CT-1 + CT-2** ✅ LIVE — página `/contacts/[id]` (maqueta aprovada): campos ricos estilo Notion
  (Morada/Família/Animais/Triggers/DISC/Trimestre/Aniversário/Última actividade/Follow Up) +
  **Indicado por/Indicou** (grafo `contact_referrals`) + Notas + Documentos + **Comentários**
  (`contact_comments`) + atribuição Meta read-only. Migração `20260601120000` (`custom_fields` jsonb).
- **CONTACT-360-AI (NS-2)** ✅ LIVE — 3 fases: (1) Assistente 360 = Retrato + Próxima acção +
  mensagem WhatsApp/Email no tom do João; (2) auto-enriquecimento (sugestões Aceitar/Ignorar →
  grava em `custom_fields`); (3) memória (`contact_ai_analyses` + `contact_ai_suggestion_events`,
  carrega última análise ao abrir). Endpoints `assistant`/`enrich`/`suggestion-feedback`.
- **CT-TIMELINE** ✅ LIVE — 3 fases: ver histórico (contacto + negócios), registo manual com
  data/hora editável (back-dating) + apagar, e liga ao 360-AI. Migração RLS DELETE em `deal_activities`.
- **Meta IA 2026** ✅ — boas práticas gravadas (memória + `docs/meta-ia-2026-best-practices.md`).
- **/saúde** — erros marcados resolvidos (cosmético; raiz #418 por corrigir, ver M + prompt de arranque).
- **Capturado (POR FAZER):** #418 hydration (próximo), CT-AUTO, CT-TIMELINE-auto, IMO-6, DASH-3,
  NS-3, MA-LTV (Valor vitalício do anúncio), MKT-SOCIAL, MKT-BP-AUTOLEARN.
- **Lição registada:** seguir o plano até ao fim, não saltar para a ideia nova ([[feedback-seguir-plano-nao-saltar]]).

## 🗓️ Registo da sessão 31 Mai → 01 Jun 2026 — SESSÃO 1 (o que ficou feito)
- **NAV-MOBILE-DRAWER** ✅ — hambúrguer + gaveta esquerda no mobile (BottomNav removida).
- **TODO-CONSOLIDATE** ✅ — este catálogo único (CAPTURE + todo.md antigo + memória).
- **Q-1 PT-BR→PT-PT** ✅ — sweep exaustivo da copy visível; + Q-BUG-IA + B-LINT.
- **NS-1 GESTÃO FINANCEIRA** ✅ — hub `/financeiro` (Visão de Gestor + Despesas) + funil de
  conversão + ficha por angariação (comissão % ou € + ganho líquido real).
- **MA-DRILLDOWN Fase 1** ✅ — drill-down por anúncio (criativo+copy+métricas+leads/negócios).
- **Limpeza** ✅ — removidos BottomNav + MoreMenuSheet (mortos).

---

## 🎯 PRIORIZAÇÃO (proposta aprovada pelo João 31/05/2026 — ajustável)

> Lógica: anúncios prestes a religar → leads a entrar. O que mede/converte/protege
> essas leads agora vale mais. 1 utilizador → RBAC não urgente. Diferenciador = CONTACT-360.
> **Arranque imediato: Q-1.**

**🥇 P1 — a seguir (ordem de execução):**
1. ~~**Q-1** Sweep PT-BR→PT-PT~~ ✅ **FEITO (01/06, commit `964ac65`)** — copy visível limpa (features/components/app/lib/prompts/templates/install). Resta **Q-2** (comentários/JSDoc + lib/ai rules + fixtures de teste) — não-visível, P3.
2. ~~**NS-1** Custos + ROI no dashboard~~ ✅ **FEITO (01/06)** — hub `/financeiro` (Visão de Gestor + Despesas) + ficha por angariação no negócio
2b. ~~**MA-DRILLDOWN** dados por criativo~~ ✅ **Fase 1 FEITA (01/06)** — drill-down por anúncio (criativo+copy+métricas+leads/negócios). Falta árvore Campanha→Conjunto→Anúncio (P2).
2c. ~~**CT-1 + CT-2** card de contacto rico + atribuição read-only~~ ✅ **FEITO (01/06, LIVE)** — página `/contacts/[id]` completa (Fases 1-3: campos Notion + Indicado por/Indicou + atribuição + comentários).
2d. ~~**CONTACT-360-AI** (NS-2)~~ ✅ **FEITO (01/06, LIVE)** — Assistente 360 (retrato + próxima acção + mensagem) + auto-enriquecimento + memória/aprendizagem.
2e. ~~**CT-TIMELINE**~~ ✅ **FEITO (01/06, LIVE)** — histórico de interações (ver + registo manual c/ data editável + liga ao 360).
3. ~~**#418 hydration**~~ ✅ **CORRIGIDO E LIVE (02/06, HEAD `482d1e2`, build `260602_1029`).** Duas fontes no shell: tema (ThemeProvider lia localStorage no 1.º render → Sol/Lua divergente em modo claro) e InstallBanner (iOS elegível só no cliente). Fix: tema hydration-safe + script inline anti-flash no `<head>` + guarda `mounted` no useInstallState. **Produção: 0 #418 e 0 `$RS`** em /dashboard+/contacts+/contacts/[id] (desktop + mobile 375). `client_errors` limpos (0 abertos) e 0 erros novos após navegar. **Deploy esteve preso por haver 2 projectos Vercel no mesmo repo (crm-joao + nossocrm) a competir pelo único slot do Hobby** → desbloqueado cancelando o build Queued preso. **Falta decidir: eliminar/pausar o projecto `nossocrm` redundante** (ver INT-DOMAIN + secção F).
   - **Rede de segurança complementar (02/06, HEAD `8ace311`, LIVE+verificado):** sessão paralela adicionou `lib/client-errors/ignore.ts` (+5 testes) ligado ao `ClientErrorReporter` — classifica o `$RS`/`completeSegment` (corrida de streaming benigna do React 19) e o `ResizeObserver loop` como **ruído não-alertável** (à la Sentry), sem esconder erros reais. Decisão do João: **MANTER** como salvaguarda. Verificado em produção (erro normal → reportado; `$RS` → ignorado). Aditivo, não toca nos ficheiros do `c1ab61f`.
4. **MKT-SOCIAL** (sessão própria) · **IMO-6** mandatos · **NS-3** custo por imóvel · **MA-LTV** valor vitalício do anúncio · **MA-DRILLDOWN Fase 2** · **MSG-WHATSAPP-PROPRIO** · **MKT-STUDIO**

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

- **NS-2 · CONTACT-360-AI — perfil 360° + IA que relaciona tudo** `[FEITO]` (01/06, 3 fases LIVE) `P1`
  **Fase 1 FEITA e LIVE (01/06, `fa3aa96`):** painel **"Assistente 360"** no topo da ficha `/contacts/[id]` — botão Analisar/Reanalisar → **Retrato** + sinais-chave + **Próxima melhor acção** (confiança) + **mensagem pronta** WhatsApp/Email no tom do João (editável, Copiar / Enviar por WhatsApp `wa.me` / Outra versão). Endpoint `POST /api/contacts/[id]/assistant` lê `getContact360Context` (contacto+custom_fields+atribuição+indicações+negócios+actividades+comentários) e usa o motor IA (`getModelForFeature`+`runWithAIFallback`+`Output.object`, Gemini→Claude, chaves por service-role). Prompt PT-PT pré-AO, acentos correctos, CTA pede resposta, sem placeholders, nunca Domingos. Verificado live desktop+mobile com dados reais; mensagem é rascunho (revê-se no Editar antes de enviar). **Nota:** o LLM ainda deixa escapar 1-2 acentos ocasionais → mitigado pelo Editar; afinar prompt se incomodar.
  **Fase 2 FEITA e LIVE (01/06):** bloco "Sugestões para a ficha" no Assistente 360 — a IA propõe campos com evidência (DISC/triggers/trimestre/família/animais/morada), Aceitar grava em `custom_fields` (`POST /api/contacts/[id]/enrich`, merge server-side, triggers em união) e reflecte logo em "Sobre a pessoa" (ContactRichPanel re-sincroniza com props), Ignorar descarta. Verificado live (aceitar família → gravou + apareceu). **Fase 3 FEITA e LIVE (01/06):** `contact_ai_analyses` guarda cada análise; a ficha **carrega a última ao abrir** ("análise de <data>", já não começa em branco); `contact_ai_suggestion_events` regista **aceites/ignorados** (base de aprendizagem). Verificado live. **CONTACT-360-AI completo (Fases 1-3).** Futuro: usar os eventos de aprendizagem para afinar sugestões; ciclo resulta→continua mais explícito; propagar a copy IA a outros sítios (IA-1).
  --- visão original ---
  "Conhecer a pessoa de verdade", enriquecimento progressivo, IA cruza DISC+família+triggers+aniversário+última actividade → próxima melhor acção e copy hiper-pessoal. "Pensa mais à frente, diferente de todos no imobiliário". (origem: CAPTURE CONTACT-360-AI)

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

- **CT-TIMELINE · Timeline unificada de interações no contacto (tudo ligado)** `[FEITO]` (01/06, 3 fases LIVE) `P1`
  Secção "Histórico de interações" na ficha `/contacts/[id]`: **Fase 1** (ver) — `getContactTimeline` lê `deal_activities` ligadas ao contacto **E aos negócios** desta pessoa (or contact_id / deal_id in deals), ordena por data efectiva; eventos de sistema (stage_moved) discretos. **Fase 2** (inserir o que quiser) — form "+ Registar" com tipo (nota/chamada/whatsapp/email/reunião/visita), **data/hora editável** (back-dating, ex.: email da conta RE/MAX) e apagar entradas manuais (`occurred_at`+`via=timeline-manual` no metadata; precisou de nova política RLS DELETE em `deal_activities`). **Fase 3** (ligar) — `getContact360Context` passa a usar a timeline unificada → o Assistente 360 fica mais rico. Verificado live (inserir com data passada ordena certo; apagar funciona). Futuro: auto-log de mais canais (liga a MSG-1/MSG-WHATSAPP-PROPRIO) e edição inline. Liga a [[reference-timeline-leads]].

- **CT-PHONE-HYGIENE · Filtros inteligentes de contactos + higiene de números** `[POR FAZER]` `P?` (CAPTURE 02/06, ideias do João)
  Pesquisa/filtros avançados na lista `/contacts` para chegar rápido a segmentos por **forma do número e completude de dados**:
  (a) **PT vs estrangeiro** (com/sem `+351` ou prefixo nacional);
  (b) **só email vs só telefone** (completude — quem não tem número, quem não tem email);
  (c) **por prefixo**: fixos `21`/`22`/... e móveis `91`/`92`/`93`/`96`, e "sem `+351`" → corrigir em massa;
  (d) **`+351351` (duplo prefixo de importação)** — encontrar e **corrigir rapidamente** (provável fix em lote: 1 SQL `replace` + normalização; e prevenir no importador);
  (e) **números claramente falsos** (`911111111`, sequências/repetições) → marcar/limpar.
  Base: campo telefone já existe. **Falta:** normalização E.164 (lib tipo libphonenumber), coluna/derivação de país+prefixo+validade, chips de filtro na lista, acção de correcção em massa, e guarda no importador (CT-2/import). Alto valor de **qualidade de dados antes de campanhas/automação** (números errados = leads perdidas + custo). Liga ao importador de contactos e à regra origem-obrigatória. Quick win possível já: SQL de auditoria que conta `+351351`, só-email, só-telefone, e padrões falsos — para dimensionar.

- **CT-PARCEIROS · Rede de consultores/parceiros + analítica de co-negócio + plano de agradecimento** `[POR FAZER]` `P?` (CAPTURE 02/06, ideia do João)
  Guardar consultores/colegas com quem o João faz negócio (na secção **Parceiros** e no **card**): dados de contacto + negócios feitos juntos. **Analítica:** quem trouxe/fechou mais negócios comigo → ranking de parceiros. **Nurture:** plano de **agradecimento/parceria** (lembretes, mensagens no tom do João, "para que se lembrem de mim"). Reusa o grafo `contact_referrals` (Indicado por/Indicou), o Assistente 360 (copy) e liga a **MA-LTV** (valor vitalício/linhagem) e ao financeiro (co-broke). Decidir: parceiro = tipo de contacto/tag vs entidade própria; métricas (nº negócios, € gerado, último contacto); cadência de agradecimento. Marca pessoal "lendária" como fio condutor ([[joao-fonseca-brand]]).

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

- **MA-LTV-ATTRIBUTION · Valor vitalício do anúncio (1 anúncio → N negócios ao longo do tempo; ex-"conta inglesa")** `[POR FAZER]` `P?` (CAPTURE 01/06, ideia do João)
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

- **INT-DOMAIN · Domínio próprio para o CRM (em vez de crm-joao.vercel.app)** `[POR FAZER]` `P2` (CAPTURE 02/06, ideia do João)
  Apontar o CRM a um subdomínio próprio (ex.: `crm.joaofilipefonseca.pt`) em vez do `*.vercel.app`. **NÃO exige sair da Vercel:** adicionar o domínio nas settings do projecto Vercel + registo DNS (CNAME) na Cloudflare (temos acesso à API, zone `5da30c05...`); a Vercel emite SSL automático. Rápido (~10-15 min + propagação DNS). Actualizar depois `NEXT_PUBLIC` de URL público se houver, callbacks OAuth Meta (redirect URI), webhooks e o link do morning-brief. **Win fácil que resolve o "prefiro o meu domínio" sem migração de host.**

- **INT-CLOUDFLARE-HOST · (Decisão) migrar o CRM para Cloudflare Pages/Workers** `[POR FAZER / A DECIDIR]` `P3` (CAPTURE 02/06)
  O João perguntou se muda "tudo para Cloudflare". A regra [[feedback-hosting]] (SEMPRE Cloudflare Pages) era para **landing pages estáticas**; o CRM é Next.js 16 App Router com SSR + muitas server functions + crons + edge → migrar para Cloudflare (via OpenNext/`next-on-pages` + Workers + Cron Triggers) é **projecto sizeable e com risco** (limites de runtime Workers, reescrever `vercel.json` functions/crons, re-testar tudo). Custo Cloudflare baixo (free tier generoso) mas o esforço/risco não compensa agora. **Recomendação:** NÃO migrar; resolver o que o João quer mesmo (domínio próprio = INT-DOMAIN) e manter Vercel. Reavaliar só se houver dor real de custo/limites na Vercel. Nota: a "verificação de segurança" no login é o **Cloudflare Turnstile** (widget na app, já corre na Vercel — independente do host); migrar host não muda isso.

- **INT-2 · Google Calendar sync** `[POR FAZER]` `P?`
  Sincronizar visitas/atividades. (origem: Integrações pendentes). **Ver AGENDA-1** (engloba isto).

- **AGENDA-1 · Agenda unificada do João (CRM + tarefas próprias + Google Calendar)** `[POR FAZER]` `P?` (CAPTURE 02/06, ideia do João)
  Um **único local** onde o João vê e organiza o dia: (a) **tudo o que o CRM já sabe e deve lembrar/alertar** — follow-ups (CT-AUTO), validade de mandatos (IMO-6), negócios parados (IMO-3), aniversários, leads sem resposta, tarefas auto (AUTO-6), métricas do que falta fazer (DASH-3); (b) **tarefas e lembretes que o João adiciona à mão**, profissionais **e pessoais**; (c) **ligação bidireccional ao Google Calendar** (INT-2) para que o CRM saiba sempre a disponibilidade e **programe os dias da melhor forma** (sugerir horários, nunca Domingos — [[feedback-nunca-domingos]]). Objectivo: "tenho tudo organizado num só sítio e o CRM ajuda-me a planear". **Já existe base:** `deal_activities` (visitas/reuniões/chamadas), tarefas/lembretes do engine `/automacoes`, `imovel_mandatos`, e os analisadores de decisões. **Falta:** modelo de "tarefa/lembrete genérico" (com âmbito pessoal/profissional, sem ligar a deal), vista de **agenda/dia** unificada, motor de alertas (Telegram/push — [[regra-automacoes-no-crm]]), e OAuth + sync Google Calendar (INT-2, dois sentidos). Liga a AUTO-6 (inbox proactivo de IA), CT-AUTO, DASH-3, IMO-6, IMO-3. Teste "serve qualquer consultor": fácil, um só ecrã. (origem: CAPTURE 02/06)

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

- **IMO-6 · CMI (Contrato de Mediação Imobiliária): validade + contagem decrescente + acções** `[EM CURSO]` `P1` (CAPTURE 01/06; corrigido 02/06: é **CMI**, NÃO "mandato" — o João reserva "mandato" para o lado do comprador)
  **✅ Fase 1 FEITA e LIVE (02/06, HEAD `7bb1587`, verificada em produção desktop+mobile 375):** nova entidade **CMI separada do mandato** (decisão do João). Tabela `imovel_cmi` (org-scoped + RLS `get_user_org_id`, migração `20260602150000`), tipos simples/exclusivo, `data_cmi` + `data_fim` (validade) + `comissao_pct` + notas + activo (só 1 activo/imóvel). Loader `listCmisByImovelId`; API `POST /api/imoveis/[id]/cmi` + `PATCH/DELETE /[cmiId]`. Componente `ImovelCmi.tsx` (CRUD + **contagem decrescente "X dias faltam até acabar"** com cores verde>30 / âmbar 8-30 / vermelho≤7 / Expirado / Sem prazo + barra), na nova secção "CMI" da ficha `/imoveis/[id]` (acima do Mandato, que fica intacto). Helper puro `cmiCountdown` determinista por dia (nowISO do servidor → sem risco de hidratação) + 7 testes. Maqueta aprovada antes (`docs/mockups/imo6-cmi-countdown.html`). Verificado live com seed (revertido): "18 dias faltam", 0 erros, contraste dark corrigido.
  **✅ Fase 2a FEITA e LIVE (02/06, HEAD `404c01f`, verificada em produção desktop+mobile):** bloco **Acompanhamento** no CMI activo — KPIs **Negócios / Visitas / Propostas** (read-only, computados no servidor `getImovelAcompanhamento`): leads = `deals.imovel_id` (**decisão do João**: negócios ligados ao imóvel, não matches), visitas/propostas de `imovel_eventos`, + "X dias sem visitas" (≥14d) e aviso quando sem visitas. KPI a 0 destacado a vermelho. Verificado com seed (revertido): 0 Negócios / 1 Visita / 0 Propostas, 0 erros.
  **Fase 2b (P1, em curso):** automação periódica que, perante **falta de negócios/visitas/propostas** e proximidade do fim do CMI, **alerta** com acção/estratégia sugerida (liga a **IMO-3**).
   - **✅ Passo 1 FEITO (02/06, HEAD `b809e93`):** motor puro `lib/imoveis/cmiWatch.ts` `evaluateCmiWatch(input, thresholds)` → `{shouldAlert, severity, reasons[], sugestao}` (alerta se fim ≤15d/expirado OU imóvel parado = sem visitas+sem propostas; gravidade alta/média/baixa; limiares `CMI_WATCH_DEFAULTS` alertaFimDias=15/semVisitaDias=21). +8 testes. Sem efeitos (ainda não ligado ao runtime).
   - **Falta Passo 2:** **edge function `cmi-watch`** (Deno, service-role, mirror de `telegram-morning-brief`) que percorre CMIs activos por org, usa `evaluateCmiWatch` + `getImovelAcompanhamento`, e envia **alerta Telegram por org** (`sendTelegramMessage` com `telegram_crm_bot_token`/`telegram_crm_chat_id`) com dedup (não repetir no mesmo dia). Registar em **`system_automations`** (key `cmi-watch`, cron diário ~08h, aparece em /automacoes — [[regra-automacoes-no-crm]]) + pg_cron. Verificar com 1 disparo real. ⚠️ `deals.imovel_id`=0 hoje → KPI Negócios só enche ao ligar negócios a imóveis.
  **Captura (polish, P3):** harmonizar contraste no tema escuro das outras secções da ficha do imóvel (Mandato/Proprietários/Documentos usam cores claras sem variantes `dark:`).

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

- **WL-1 · White-label SaaS: cada consultor escolhe funcionalidades + cores da marca + nome + logo** `[POR FAZER]` `P?` (CAPTURE 02/06, ideia do João — visão de venda do CRM)
  Quando o CRM for vendido a outros consultores, cada **tenant/org** deve poder: (a) **ligar/desligar funcionalidades** (feature toggles por org — já há base `instanceFlags`/`queryKeys.instanceFlags.byOrg`, falta UI de gestão + gating consistente em toda a app); (b) **personalizar TODAS as cores** do CRM (tema próprio por org, tokens CSS `--color-*` dinâmicos a partir das cores da marca); (c) **nome + logo próprios** no shell (sidebar/header/login/PWA/emails). ⚠️ **Distinto do Brand Kit** (`ai_brand_kits` = marca pessoal para marketing, NÃO o tema do CRM — ver [[feedback-brand-kit-e-marca-pessoal]]); aqui é o **chrome do próprio produto** white-label. Liga a Q-3 (RBAC/multi-tenant), [[serve-qualquer-consultor]] (SaaS-ready) e ao tema (cuidado com hidratação — ver fix #418). Decisões futuras: armazenar tema/branding por org (`organization_settings` ou tabela própria), aplicar sem flash (script inline), limites do que é desligável.

- **Q-4 · Audit logs alargados (multi-utilizador)** `[PARCIAL]` `P?`
  Já há `audit_logs` para Meta; alargar a quem mexeu em quê quando crescer. (origem: GHL Audit Logs)

### L. Bugs UI activos

- **B-012 · Título de página "Contatos" em PT-BR** `[POR FAZER]` `P3` — o `<title>`/metadata da lista `/contacts` é "Contatos" (BR), devia ser "Contactos". Sweep Q-1 falhou metadata de páginas. Capturado 02/06 durante o fix #418. Verificar outros `metadata.title` PT-BR.
- **B-009 · 2 FABs sobrepostos (mobile)** — marcado resolvido no CAPTURE (confirmar visualmente). `[PARCIAL]`
- **B-002 · "manha" sem til em prompt WhatsApp** — mitigado em BD; rever a cada UPDATE. `[PARCIAL]`

### M. Pendentes do smoke test 22/05 (verificar se ainda aplicam)

- 94.9% deals com `value=0` → auto-value batch IA.
- React #418 hydration (transversal ao shell — confirmado igual em `/dashboard`, `/imoveis/[id]` e `/contacts/[id]`) + sintoma derivado `TypeError $RS parentNode` nas páginas de detalhe (streaming). Não-fatal; mesma causa-raiz (hydration mismatch no shell). Tratar de uma vez.
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
