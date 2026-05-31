# CAPTURE.md — Foco Imo

> Coisas detectadas mid-sessão que NÃO são o objectivo activo.
> NÃO atacar agora. Cada item é candidato a sessão dedicada (com Plan-First próprio).
> Pacto: "1 objectivo por sessão" → tudo o resto vem para aqui.

---

## 🎯 Meta Ads Fase B — evolução do dashboard /anuncios (ideias do João 29/05, pós-b2)

### MA-B2.1 · Métricas em falta no /anuncios (polish pequeno)
- Hoje mostra: gasto, impressões, cliques, leads, CPL, ganhos, CPA, dinheiro efectivo, ROAS.
- **Falta CTR** (taxa de cliques = cliques/impressões) — o João pediu "eficácia dos ads (CTR)". Acrescentar coluna CTR%. Dados já existem (clicks/impressions), 1 commit.
- Sugestões adicionais a medir (resposta ao "devo medir algo mais?"): CPC (custo por clique), **taxa de conversão clique→lead** (leads/cliques), **CPM**, **frequência/saturação** (precisa do campo frequency da Marketing API), conversão **lead→negócio** e **negócio→ganho** por anúncio (qualidade da lead, não só volume), e tendência de gasto/CPL ao longo do tempo (sparkline).

### MA-B2.2 · Preview do criativo (imagem/vídeo do anúncio) no /anuncios
- **Pedido João:** "então e se aparecesse também imagem ou vídeo do anúncio para saber do que se trata?"
- **Viável:** a Marketing API expõe o criativo do anúncio: `GET /{ad_id}?fields=creative{thumbnail_url,image_url,object_story_spec,video_id}`. Guardar `creative_thumbnail_url` + `creative_type` (image/video) numa tabela `ad_creatives` (key ad_id) ou colunas em ad_insights; sync na edge automation-meta-insights (1 fetch por anúncio novo, cachear). UI: thumbnail na 1ª coluna da tabela + lightbox ao clicar.
- **Esforço:** médio (extra fetch + storage do URL + UI). **Impacto:** alto (reconhecimento imediato do anúncio). Ticket próprio.

### MA-B2.3 · Analista IA dos anúncios — DIÁRIO, persistido, com alertas (não só a pedido)
- **Pedido João (29/05, refinado):** "quero o meu analista a correr todos os dias 1x para não adiar decisões. Tem de ver 3 dias para ter dados mínimos para alguma decisão, depois ao 5.º dia mais uma decisão e ao 8.º outra; nos dias que não são de decisão, se houver algo alarmante deve avisar." + "não só quando carrego."
- **Núcleo = cron diário** (system_automation `meta-ads-analyst`, visível em /automacoes), NÃO só botão. Guarda análises numa tabela `ad_analyses` (histórico por dia/anúncio) para consulta sem reanalisar. Botão "Analisar agora" no /anuncios = extra que lê a última análise (ou força nova).
- **Cadência de decisão (interpretação a confirmar):** por anúncio, contar dias com dados desde o 1.º registo (`ad_insights`). Checkpoints de decisão aos **3, 5 e 8 dias** (e depois periodicamente) — só aí emite veredicto firme (PARAR/AUMENTAR/TESTAR/MANTER) com confiança crescente. Nos outros dias, corre na mesma mas só **alerta** se detectar anomalia.
- **Anomalias (alerta Telegram, dias sem decisão):** CPL dispara (>X× média), gasto acumulado sem 1 lead, CTR colapsa, frequência alta (saturação), orçamento a esgotar. Reusa `telegram_crm_bot_token`/`chat_id` (regra Telegram só essencial, sem inundar).
- **IA:** `getOrgAIConfig` → Gemini 2.5 Flash + fallback Claude, `generateText+Output.object` (schema Zod). Compara cada anúncio com médias da conta + tendência.
- **Pré-requisito de qualidade:** funciona com gasto/CPL/CTR; muito melhor com leads novas no CRM (Fase A + origem-obrigatória) para medir leads QUALIFICADAS.
- **Esforço:** médio-alto (tabela + cron em /automacoes + edge IA + anomalia + Telegram + UI). **Impacto:** muito alto. **Constrói ANTES da edição** (decisões primeiro, agir depois).

### MA-EDIT · Editar o anúncio a partir do CRM (write-back Marketing API)
- **Pedido João (29/05):** "porque não já agora eu conseguir fazer as alterações ao anúncio aqui no CRM na aba anúncios? para além das dicas, editar fotos, copy, valor e mais parâmetros."
- **Honestidade de esforço (tiers — nem tudo é igual via API; precisa `ads_management`):**
  - **Fácil/seguro:** pausar/reactivar anúncio, adset, campanha (status); alterar **orçamento** (adset daily/lifetime budget). Acção directa via API.
  - **Médio:** alterar **copy/headline/CTA** → na Meta um criativo é praticamente imutável; "editar" = criar **novo ad creative** e trocar no anúncio (ou novo anúncio). Implica upload e versão nova.
  - **Difícil:** trocar **imagem/vídeo** → upload do media (`/act_x/adimages` ou `advideos`) + novo criativo + swap. Mais passos + validações.
- **Segurança:** acções que gastam dinheiro/alteram campanhas LIVE → confirmação explícita + audit log; nunca silencioso. Idealmente o analista (B2.3) sugere e a edição (MA-EDIT) executa com 1 clique + confirmação.
- **Esforço:** alto (epic próprio, por tiers). **Sequência sugerida:** depois do analista. Começar pelos tier Fácil (pausar/reactivar + orçamento) que já dão 80% do valor accionável.

### MA-DRILLDOWN · Atribuição e controlo ao nível do criativo (pedido João 31/05)
- **Pedido João:** "dentro de um anúncio posso ter 100 conjuntos, cada um com o seu criativo e valor diferente; tenho de poder alterar/desligar só o que quero (não o anúncio todo) e ter dados de cada um — qual lead respondeu a qual criativo e de qual veio o negócio, com a copy e criativo específicos. Assim tenho dados reais e autonomia real."
- **Alinhamento de hierarquia (importante):** Campanha → Conjunto (adset) → Anúncio (=1 criativo). Orçamento vive no conjunto (ABO) ou campanha (CBO), NUNCA no anúncio. Valor por criativo = 1 criativo por conjunto. Conta real: 10 campanhas / 24 conjuntos / 45 anúncios.
- **Já existe (não rebuildar):** métricas por ad_id (ad_insights); pausar/reactivar por anúncio (MA-EDIT); orçamento por conjunto e campanha (MA-EDIT); `attribution.ad_id` em contacts/deals (canalização lead→criativo→negócio). Atribuição a 0 só porque nada entregou desde a integração.
- **Gaps a construir:**
  1. **Drill-down por anúncio:** clicar num criativo → painel com a LISTA de leads (nomes/contactos) e negócios atribuídos + € efectivo, não só contagens. Reusa `attribution.ad_id`; query leads/deals por ad_id da org no período + vida.
  2. **Guardar + mostrar copy/headline/CTA do criativo:** `ad_creatives` hoje só tem thumbnail/image/permalink/creative_type. Acrescentar `title`, `body`, `cta_type` (fetch `creative{title,body,object_story_spec{...}}` na edge `automation-meta-insights`). Mostrar no /anuncios + drill-down.
  3. **Vista em árvore Campanha → Conjunto → Anúncio:** agrupar a tabela por nível, com toggle on/off e orçamento em cada nó. Corresponde ao modelo mental do João.
- **Esforço:** alto (epic próprio, por sub-tiers: copy primeiro → drill-down → árvore). **Impacto:** muito alto (núcleo do épico: medir qual criativo dá dinheiro). Plan-First dedicado. **Pré-requisito de dados:** leads novas via Fase A (CRM pronto a receber) para encher a atribuição.

### MKT-STUDIO · "Estúdio de marketing" completo no CRM (visão grande, João 31/05)
- **Pedido João:** "então e se eu tiver um Meta Ads com todas as funções no meu CRM, em que faço tudo aqui em vez de abrir o Meta que é mais complicado? e se na aba Marketing conseguir fazer LP de imóveis, LP de captação de leads, criativos de anúncios e carrosséis, posts, cartas, apresentações de serviço, ACM e muito mais."
- **Visão:** transformar a aba Marketing num estúdio que cria E publica, sem sair do CRM. Sub-módulos:
  1. **Gestão Meta end-to-end (MA-CREATE):** criar campanha/conjunto/anúncio/criativo via Marketing API (já temos `ads_management`). Estende o MA-EDIT (que já pausa/orçamenta) para criar de raiz. Esforço alto.
  2. **Criativos de anúncio + carrosséis:** gerar imagem/copy/CTA com IA + Brand Kit; exportar/!publicar como criativo Meta. JÁ EXISTE base: `creative_archive` + `/criativos` + Brand Kit (`/settings/marca`) + skill `joao-fonseca-brand`. Falta o gerador visual + push para a Meta.
  3. **Landing pages (imóveis + captação):** gerar LP por imóvel e LP de captação com form que carimba `attribution` (fonte própria). Liga ao portal/calculadoras existentes. Hosting Cloudflare Pages.
  4. **Posts sociais:** gerar + (opcional) agendar via Graph API da Página.
  5. **Documentos:** cartas, apresentações de serviço, **ACM/CMA** (análise comparativa de mercado) — usa skills docx/pptx/pdf + Brand Kit + comparáveis da zona + calculadora `/avaliar`.
- **Reaproveitar (não rebuildar):** Brand Kit, `creative_archive`/`/criativos`, `/avaliar`, portal/LPs, atribuição omnicanal.
- **Esforço:** muito alto (épico de vários sub-épicos, cada um com Plan-First). **Impacto:** muito alto (diferenciador). **Sequência:** depois da recepção de leads estar pronta (mede o retorno de tudo o que se cria). Confirmar prioridades sub-módulo a sub-módulo com o João.

### ⭐ NAV-MOBILE-DRAWER · Menu hambúrguer + gaveta esquerda deslizável (PEDIDO DIRECTO João 31/05 — PRIORIDADE no arranque da próxima sessão)
- **Dor:** "no mobile tenho a barra fixa em baixo, não vejo tudo e não consigo verificar se estás a fazer bem. Quero um menu onde carrego e abre do lado esquerdo, e consigo deslizar para cima e para baixo."
- **O que quer:** botão (hambúrguer) no topo em mobile → abre **gaveta (drawer) da ESQUERDA** com a navegação COMPLETA, **scroll vertical** (`overflow-y-auto`), fecha ao tocar fora/num link. Substitui/complementa a BottomNav fixa que corta itens.
- **Ficheiros REAIS (confirmados 31/05):** `components/Layout.tsx` (layout global — NÃO existe AppChrome.tsx), `components/navigation/{BottomNav,MoreMenuSheet,NavigationRail}.tsx`, `components/navigation/index.ts`, `components/layout/navConfig.ts` (itens), e **`components/ui/Sheet.tsx`** (já é uma gaveta reutilizável — usar como base, abrir do lado `left`) + `components/ui/ActionSheet.tsx`. Provável: hambúrguer no header mobile do `Layout.tsx` → `<Sheet side="left">` com a lista do `navConfig` e `overflow-y-auto`.
- **Cuidados:** mobile 375px + 540 + tablet 768; fechar ao navegar (regra menu_mobile_fecha); `overflow-y-auto` + safe-area; não tocar no desktop. **TRIPLA verificação mobile obrigatória** (dev local faz hang → verificar em produção/preview real, não só código).
- **Porque não foi feito em 31/05:** contexto esgotado + ambiente a falhar leitura dos ficheiros de nav; mexer no layout global sem poder testar mobile arriscava partir a navegação toda. Fazer no início da próxima sessão.

### MSG-WHATSAPP-PROPRIO · SMS + WhatsApp (número próprio, sem Meta) no Inbox, com guarda selectiva e registo no card (pedido João 31/05)
- **Pedido João:** "na parte das mensagens poder ter SMS e WhatsApp dentro da mesma; inserir já o meu número de WhatsApp **sem ser por Meta**, só eu a enviar/receber; **escolher** quais mensagens recebidas ficam no CRM (não todas, algumas não fazem sentido); e as que envio a leads ficam registadas nas mensagens **e dentro do card, no local correto**."
- **Viável + base já existe:** `lib/messaging/` tem providers **Evolution API** e **Z-API** (WhatsApp NÃO-oficial via número próprio + QR — exactamente "sem Meta"). `messaging_channels` (mesmo padrão do email Resend) guarda credenciais por org. Inbox já existe. Átomo `action.send_whatsapp` já deployado (executor v12) mas hoje aponta a `meta_cloud`; aqui seria provider `evolution`/`zapi`.
- **SMS:** precisa de provider (ex.: Twilio/serviço PT) — canal novo em `messaging_channels`.
- **Peças:** (1) ligar canal WhatsApp não-oficial (Evolution/Z-API) com o número do João (QR), inserir em `messaging_channels`; (2) Inbox unifica SMS+WhatsApp; (3) **guarda selectiva** — incoming não persiste tudo; botão "guardar no CRM" por conversa/mensagem (ou regra), senão fica efémero/ignorado; (4) **registo no card**: mensagem enviada/recebida de um contacto/lead aparece na timeline do negócio no sítio certo (reusar `lead_eventos`/timeline + `deal_activities`).
- **Decisões a tomar com o João:** Evolution vs Z-API (qual serviço/host); critério de "guardar selectivo" (manual por botão vs regra por contacto conhecido); SMS provider. **Esforço:** médio-alto (épico por fases: ligar canal → inbox → guarda selectiva → registo no card). NÃO implementar sem Plan-First dedicado.

### CONTACT-CARD-NOTION · Card de contacto com os campos que o João tinha no Notion (pedido + screenshot João 31/05)
- **Pedido:** replicar no card de Contacto do CRM os campos do Notion dele (workspace Imobiliário/CRM, vista "All Contacts").
- **Campos do Notion (do screenshot):** Address (Investment), **Family Members** (ex.: "2 Filhos"), Pets, **Triggers**, **Last Activity Date** (data), **Follow Up?** (checkbox/boolean), **Referred By** (relação a contacto), **Referred** (relação), **Notes** (nota rica / página ligada, ex.: "Notas Diogo"), **DISC (Colour)** (perfil DISC por cor), **Quarter**, **Aniversário** (data), **Documentos** (anexos), **Comentários**.
- **Notas de implementação:** o CRM já tem em contacts: name/email/phone/source/notes/attribution. NOVOS campos → provavelmente `custom_fields` (jsonb) no contacto (deals já têm custom_fields) ou colunas dedicadas para os mais usados (aniversário, follow_up, last_activity_date, disc, family, pets, triggers). Referred By/Referred = relação contacto↔contacto. Documentos = bucket privado (padrão imovel-documentos). Aniversário pode alimentar alertas. DISC pode ligar a copy/abordagem IA.
- **Decisões com o João:** quais campos viram coluna vs custom_field; superfície (precisa de página/painel de contacto — hoje só há ContactFormModal, ver c4.2). **Esforço:** médio. **Plan-First dedicado.** (Imagem descrita aqui porque o screenshot não fica no repo.)

### ⭐ CONTACT-360-AI · Perfil 360° da pessoa + IA que relaciona tudo → falar exactamente para aquela pessoa (visão-núcleo João 31/05)
- **Visão João:** "se tiver todos os itens no card, conheço a pessoa de verdade. Base = nome/email/contacto + se proprietário ou comprador; à medida que junto mais dados, fico com tudo sobre a pessoa, e com a IA a ver e relacionar tudo consigo falar exactamente para aquela pessoa. Quero isto." + **meta: "preciso que penses mais à frente, diferente de tudo e todos no imobiliário."**
- **Base:** estende CONTACT-CARD-NOTION (card rico) + atribuição Meta Ads + histórico (mensagens/chamadas/timeline). Enriquecimento PROGRESSIVO: começa mínimo (nome/contacto/tipo) e cresce.
- **Pensar à frente (extensões diferenciadoras):**
  1. **Auto-enriquecimento:** a IA extrai dados do card a partir de cada interacção (WhatsApp/SMS/chamada transcrita/email) — "tem 2 filhos", "tem cão", "quer mudar de casa em 2026" → preenche Family/Pets/Triggers sozinho. O João nunca digita; só confirma.
  2. **Camada de relação (graph):** Referred By/Referred = rede de indicações; ver quem trouxe quem, clusters de família/amigos, e o valor de cada "embaixador".
  3. **Próxima melhor acção por pessoa:** IA cruza DISC (cor) + family + triggers + última actividade + aniversário → sugere "o que dizer agora e como" (tom DISC), e o **momento certo** (aniversário, fim de contrato, evento de vida) → outreach proactivo no canal certo.
  4. **Copy hiper-pessoal:** toda a geração de mensagem (já existe pipeline) passa a usar o perfil 360° → não é "olá, tudo bem", é falar à medida daquela pessoa concreta.
  5. **Diferenciador:** a maioria dos consultores tem uma lista de contactos morta. Aqui o contacto é um perfil vivo que a IA mantém e activa. É o fosso competitivo.
- **Esforço:** épico transversal (assenta em CONTACT-CARD-NOTION + MSG-WHATSAPP-PROPRIO + IA já existente). Por fases. Plan-First dedicado. **NÃO implementar sem ordem.**

### TODO-CONSOLIDATE · Salvar o backlog antigo do todo.md (pedido João 31/05)
- **Pedido João:** "grava tudo na memória para não perdermos nada... existe um todo.md com muita coisa já."
- **Situação:** `nossocrm/.claude/TODO.md` NÃO existe. O todo.md grande é **`crm/.claude/TODO.md` = 1744 linhas** (pasta IRMÃ `crm`, projecto antigo) + `portal-app/TODO.md`. Está em disco (não perdido), mas é stale e pode ter ideias ainda válidas.
- **Tarefa (sessão dedicada, contexto cheio):** ler `crm/.claude/TODO.md` + `portal-app/TODO.md` por secções → extrair só o que ainda é relevante para o nossocrm → integrar em CAPTURE.md/memória (sem duplicar com MA-*, M-*, B-* já cá) → marcar o original como arquivado. NÃO cabe num contexto já gasto (1744 linhas).
- **Regra reforçada:** ideias novas = capturar aqui, nunca implementar logo.

### MA-BACKFILL-ASYNC · Backfill plurianual de Insights via API async (futuro)
- O sync por janelas de 90d + lookback até ~36,5 meses cobre contas normais. Mas a Meta devolve "(#1) reduce the amount of data" para janelas grandes com `level=ad` + `time_increment=1` quando o volume é alto. Para contas com MUITOS anos/anúncios, o caminho robusto é a **Marketing API async** (`POST /act_x/insights` → `report_run_id` → polling → fetch paginado). Não urgente: a conta do João só tem dados desde 28/02/2026 (já todos ingeridos). Ticket quando houver uma conta com histórico longo.

### MA-OFFLINE · Marketing offline rastreável (flyers/cartas/outdoor) com QR único + analytics
- **Pedido João 29/05:** "então e se fizer flyers, cartas ou outro modelo de marketing offline também posso colocar fotos do que fiz, dizer o valor que investi e depois ter um código QR único que vai medir quem entra e dar dados de análise para eu medir".
- **Conceito:** uma "campanha offline" no CRM = nome + tipo (flyer/carta/outdoor/evento) + **fotos do material** + **valor investido** + zona/data. Gera um **QR code único** que aponta para um URL de captura com `?src=campanha_id` (landing/calculadora/form). Quem entra fica atribuído a essa campanha (mesma pipeline de `attribution`, fonte `offline`). Mede: scans, leads, CPL, negócios ganhos, ROAS — **lado a lado com os anúncios Meta** no mesmo dashboard de medição.
- **Encaixa em:** épico Meta Ads → "atribuição omnicanal" (unificar leads web+ads+offline). Reusa `attribution` (já nas 3 tabelas) + a regra origem-obrigatória.
- **Peças:** tabela `offline_campaigns` (fotos no bucket privado), gerador de QR (URL curto com id), página de captura que carimba a atribuição, e linhas no dashboard de medição. **Esforço:** médio-alto. **Impacto:** alto (poucos consultores medem offline; alinhado com "atribuição omnicanal"). Ticket próprio.

---

## 🧭 NAV-IA · Barra lateral sobrecarregada — agrupar em famílias (pedido directo João 29/05)
- **Dor:** "estou sempre a acrescentar ideias e tu vais colocando mais e mais na barra lateral, o que neste momento não me deixa ver tudo tanto desktop como mobile, e não permite deslizar."
- **Quick fix imediato (feito):** a `<nav>` da sidebar não tinha scroll → tornar deslizável (`overflow-y-auto`). Alivia já. (Mobile usa BottomNav + MoreMenuSheet.)
- **Pedido de fundo:** "havendo pontos sobre o mesmo assunto estivesse apenas numa aba e ao carregar tivesse mais dentro — ex. Marketing com Anúncios e Criativos. Pensa que famílias podemos agrupar."
- **Proposta de famílias (grupos colapsáveis), 16 itens → 6 grupos:**
  1. **Início:** Visão Geral.
  2. **Comunicação:** Inbox, Mensagens.
  3. **CRM:** Boards, Contactos, Actividades.
  4. **Imóveis:** Imóveis, Matches, Cruzamentos, Angariação IA.
  5. **Marketing:** Anúncios, Criativos, Relatórios.
  6. **Sistema:** Automações, Saúde (admin), Configurações.
- **Esforço:** médio (Layout.tsx desktop + NavigationRail tablet + BottomNav/MoreMenuSheet mobile; grupos expansíveis com estado persistido; acessibilidade). **Impacto:** alto (UX, escala à medida que entram features). Ticket próprio — confirmar famílias com o João antes.

## 🐛 Bugs UI activos

### B-011 · ConsentModal copy em PT-BR ("seus dados", "coletados")
- **Resolvido 28/05/2026** Sprint 35 c1. CONSENT_LABELS reescritos PT-PT pre-AO (Termos de Utilização, recolhidos, RGPD em vez de LGPD, "os seus" em vez de "seus"), button "A guardar..." em vez de "Salvando...", header "Para continuar a utilizar". Header doc comment trocado de "coleta LGPD" para "recolha RGPD". Nota: comentários internos em `lib/consent/consentService.ts` mantêm "LGPD" — só copy visível foi mexido (B-007 é sessão dedicada para sweep alargado).

### B-010 · 4 warnings ESLint pre-existentes (max-warnings=0)
- **Quando:** detectado 28/05/2026 Sprint 29 c1, ja existiam antes.
- **Onde:** `features/inbox/components/MessageComposerModal.tsx:279` (eslint-disable nao usado) + `lib/contacts/import/extras.ts:41` (3x prefer-const: `d`, `mo`, `y`).
- **Resolvido 28/05/2026** apos sweep Sprint 29: removida directive nao usada + `let` -> `const` no destructure. `npm run lint` passa zero warnings.

### B-009 · 2 botões flutuantes sobrepostos no canto inferior direito (mobile)
- **Resolvido 28/05/2026.** `CHQFloatingButton` empilhado acima do `VoiceCaptureFAB`. Mobile: voice em safe+96px, CHQ em safe+168px (72px acima). Desktop: voice bottom-6, CHQ bottom-24. Confirmado visualmente em /dashboard live: CHQ azul em cima, voice rosa em baixo, ~75px de separação.
- **Quando:** 28/05/2026 manhã, screenshot do João.
- **Sintoma:** botão de chamada (azul/rosa, capture nativo Sprint 12 C1.5) aparece sobreposto a outro FAB no mesmo canto. Visualmente quase um por cima do outro. Confunde + obstrui toque.
- **Hipótese:** FAB CHQ global (Sprint 13 c3, `features/.../FabChqGlobal.tsx` ou similar) e o botão "Gravar chamada" (Sprint 12 C1.5) ambos com `position: fixed; bottom-X; right-X` próximos. Z-index e/ou offset não diferenciados.
- **Files a inspeccionar:** procurar `fixed bottom-` e `position: fixed` em `app/`, `features/inbox`, `features/deals`, `components/`. Identificar TODOS os FABs renderizados em /boards e /inbox mobile.
- **Fix esperado (1 sessão curta):**
  - Empilhar verticalmente: FAB CHQ em `bottom-4 right-4`, gravar-chamada em `bottom-20 right-4` (ou variantes).
  - OU agrupar num único FAB com menu (CHQ + Chamada + Foto + ...) que abre ao tocar — UX iOS-friendly e desafoga canto.
- **Capturado meta:** João observou e disse "tens que ser tu a estar atento não eu" — fica como lição: depois de criar FAB novo, conferir se há outros FABs na mesma página + viewport mobile.

### B-008 · Adaptar `/settings/automation-logs` ao novo schema `automation_executions`
- **Resolvido 28/05/2026** Sprint 35 c2. Query adaptada ao schema novo (started_at, trigger_type, duration_ms, is_test, automation_version), join para automations (icon+name) e deals (title). UI mostra estado em PT (A correr, Concluída, A aguardar, Falhou, Cancelada), badge "teste", link para /automacoes/[id] no nome da automação, link para contacto/imóvel quando aplicável. Mantém-se como antechamber do Sprint 7 cockpit unificado; replay+timeline detalhado fica para sprint dedicado.

### B-007 · Sweep PT-PT alargado — substituir "deal" por "negócio" em todo o UI visível
- **Quando:** 25/05/2026 noite, ao testar chamadas A.1.
- **Sintoma:** O João é português e o produto é Foco Imo (CRM imobiliário PT). Sempre que aparece "deal" em texto visível é dissonante.
- **Já feito hoje:** "Negocio:" → "Negócio:", "Reuniao -" → "Reunião com" no DealDetailModal calendar handler. Componente CallUploadModal/CallDetailPage já criados em PT-PT.
- **Falta:** sweep em todo o repo de strings UI visíveis: DealDetailModal labels, DealCockpit, FocusContextPanel, board headers, toasts, mensagens de erro genéricas, etc. NÃO mexer em identificadores de código (deal_id, DealCard.tsx etc) — só em copy.
- **Estimativa:** 1 sessão dedicada com grep "deal", revisão manual e PT-PT correcto.

### B-006 · DealCard painel esquerdo (Detalhes + Tags) com excesso de espaçamento — força scroll horizontal/vertical
- **Resolvido no Sprint 12 c1** (`features/boards/components/Modals/DealDetailModal.tsx:849` comment "Detalhes compactos em 1 linha (3 chips inline). Antes ocupava 3 rows verticais."). Confirmado em 28/05/2026 durante sweep CAPTURE.

### B-001 · Painel direito (Chat IA / Notas / Scripts / Ficheiros) come o espaço da área central no Inbox→Foco
- **Resolvido no Sprint 12 c2** (`features/inbox/components/FocusContextPanel.tsx:127`): `workspaceCollapsed` default em <1024px viewport + persistência localStorage `foco_workspace_collapsed`. Toggle PanelRightOpen/Close acima das tabs. Confirmado em 28/05/2026 durante sweep CAPTURE.

### B-002 · Bug "manha" sem til em WhatsApp Bruno (22/05 noite, smoke Playwright)
- **Status:** ⚠️ MITIGADO em prompt v3 BD (UPDATE replace 'manha'→'manhã' + Sabado→Sábado + Terca→Terça + historico→histórico).
- **Pode reaparecer:** se editar o prompt v3 e voltar a escrever palavras sem acentos por engano. Garantir review acentos a cada UPDATE.

### B-003 · Race condition no useEffect IA on-open (RESOLVIDO mas memorável)
- **Foi corrigido em commit `5b5108b`** — `isGeneratingInitial` e `isRewriting` removidos das deps do useEffect. Causou spinner infinito.
- **Lição transversal:** **NUNCA pôr state que o próprio effect altera nas deps**. Pattern a evitar em todos os useEffect futuros.

### B-004 · ✅ RESOLVIDO 25/05 — mismatch variáveis prompts BD vs callsites
- Auditados 4 prompts active na BD vs 8 callsites de renderPromptTemplate.
- 2 bugs reais corrigidos (commit `f123f8f`):
  - `task_deals_email_draft` v2: callsite passava `{contactName, companyName, dealTitle}` mas template esperava `{deal, contact, context}` → callsite refactor para mapear.
  - `task_inbox_daily_briefing` v2: callsite passava `{dataJson}` mas template esperava 4 vars separadas → UPDATE BD para usar `{{dataJson}}` + LLM parser.
- 2 prompts OK: `rewrite_message_draft` v3 (sem placeholders, user msg estruturado) e `task_inbox_sales_script` v2 (vars batem certo).

---

## 💡 Ideias capturadas mid-conversa (não atacar agora, candidatas a sessão)

### M-010 · Imóvel angariado parado → alerta IA com nova estratégia
- **Quando:** 25/05/2026 noite.
- **Pedido João:** "ter um imóvel angariado algum tempo que não vendo, receber alerta de nova estratégia".
- **Conceito:** cron diário verifica `imoveis` com `estado=disponivel` há >X dias sem activity de tipo VISITA/CONTACTO. Dispara entrada no Inbox (ou notificação) com sugestões IA accionáveis: baixar preço Y%, mudar copy de portais, fotografar à hora azul, captar lead em outro canal, retirar e relançar com nova story, partilhar em rede de colegas, etc.
- **Inputs IA:** histórico do imóvel (preço inicial, vezes alterado, nº visitas, feedback de visitas), comparáveis recentes da zona, eventos de mercado (raw_intel intent=evento_mercado), Brand Kit do João.
- **Output:** 3-5 estratégias rankeadas por probabilidade de impacto + estimativa de esforço + 1 botão "Adoptar esta" que cria as activities/tarefas necessárias.

### M-011 · "Como abordar FSBOs" quando IA detecta intent=fsbo_tip
- **Quando:** 25/05/2026 noite.
- **Pedido João:** "como abordar FSBOs quando eu digo que são".
- **Conceito:** quando um `raw_intel` ou voice capture é classificado com `intent=fsbo_tip` (FSBO = proprietário sem mediadora), IA propõe imediatamente sequência de abordagem optimizada:
  - Script de 1º contacto WhatsApp (3 variantes, tons diferentes)
  - Email de follow-up se não responde em 48h
  - Visita-pretexto ao imóvel sem pressão de mandato
  - Argumentos para converter FSBO em angariação (estatísticas: tempo médio venda FSBO vs mediadora, preço final realizado, etc.)
  - Material a entregar (pasta diferenciadora, estudo CMA da zona, etc.)
- **Filosofia:** alinhado com "entrego primeiro, sou recompensado depois" — primeiro contacto é genuinamente útil mesmo que ele nunca contrate.

### M-012 · Checklist por mudança de estágio no pipeline (não esquecer nada)
- **Quando:** 25/05/2026 noite.
- **Pedido João:** "sempre que mudo de estado no pipeline ter caixas check box de o que deve conter, se documentos, ou ações para passar ao próximos passo".
- **Conceito:** cada transição de stage (ex: `Oportunidade → Angariação`, `Em avaliação → CPCV`, `CPCV → Escritura`) abre modal com checklist customizável por board+stage:
  - Documentos obrigatórios (caderneta predial, CC, NIF, comprovativo financiamento, etc.)
  - Acções a confirmar (visita feita, proposta enviada, CPCV redigido, fundos confirmados, etc.)
  - Validações automáticas (ficheiros existem em `imovel-documentos` bucket, `deal.value` preenchido, etc.)
- **Configuração:** tabela `stage_checklists` (organization_id, board_id, stage_id, items jsonb[]). Tab no `/settings` para editar checklists por pipeline.
- **Comportamento:** se o utilizador tentar mudar de stage sem completar items, modal bloqueador com botão "Avançar mesmo assim" (audit log) ou "Completar primeiro".
- **Valor:** evitar erros operacionais (CPCV sem caderneta, escritura sem certificado energético, etc.). Reduz fricção mental "o que tinha de fazer aqui mesmo?".

### M-013 · Assinaturas de email (opcional por automação, várias assinaturas)
- **Quando:** 29/05/2026, durante a sessão de integração email/WhatsApp (canal Resend ficou live).
- **Pedido João:** assinatura no email "opcional por automação (uma caixa 'incluir assinatura')" e "depois até posso criar mais do que uma assinatura".
- **Conceito:** tabela `email_signatures` (organization_id, name, html, image_base64/content_type, is_default, deleted_at) — suporta VÁRIAS assinaturas por org. O átomo `action.send_email` ganha `incluir_assinatura` (bool) + `signature_id` (opcional; default = a is_default). Quando ligado, anexa o banner inline via CID + HTML da assinatura. Catálogo da paleta com a caixa + selector de assinatura. Semente inicial = banner RE/MAX Majestic do João (`assinaturaremax.png`, já validado inline num teste, 199 KB).
- **Nota técnica:** envio inline via CID já provado a funcionar (não precisa de hosting; não é bloqueado pelos clientes). Resend suporta `attachments[].content_id`.
- **Estimativa:** 1 sessão dedicada (migração + seed + átomo edge + redeploy + catálogo, tsc/vitest).
- **NÃO atacar agora** — capturado a pedido do João para não desviar do programa projectado.

---

## 🎯 Melhorias prioritárias diferidas

### M-001 · Propagar pipeline copy IA a TODO o lado (memory plano_copy_ia_em_todo_o_lado)
- **Pedido directo do João 22/05 noite:** "o que eu faço no inbox foco devia fazer no board em todos os cards"
- **Sessão dedicada:** propagar `cockpitSnapshot rico → rewriteMessageDraft v3 → modal` a:
  - DealCard hover (botão "Preparar mensagem" rápido)
  - Modal Deal Detail no kanban (já tem mas pode polir)
  - Página `/contacts/[id]` quando existir
  - Cards de match em `/imoveis/[id]` e `/cruzamentos`
  - Templates `/scripts` (botão "Reescrever IA" por template)
  - Briefing diário 06:00
  - Telegram bot comandos `/preparar email [nome]`
- **Estimativa:** 5-6 sessões.

### M-002 · UX latência IA — 3 caminhos discutidos 22/05 noite (NÃO ATACAR isolado, escolher 1 em Plan-First)

**Diagnóstico final 22/05:** copy profissional + Output.object schema + snapshot rico = 8-12s
reais é fisiologicamente difícil baixar abaixo de 5s. Output a ~50 tok/s para 250 tok já são 5s.

**3 opções para Plan-First dedicado (escolher 1 ou combinar):**

**Opção A — Streaming**
- `streamText` em vez de `generateText`. Primeiro chunk em ~1s, completa em ~8s.
- Sensação de instantâneo (mesmo com latência real igual).
- Trade-off: perde `Output.object({schema})` directa. Soluções:
  1. Voltar a texto livre + parser regex/JSON manual para extrair subject + body
  2. Stream + parse JSON incremental (lib `partial-json`)
  3. 2 calls separadas: 1ª subject (rápida), 2ª body (streaming)
- Estimativa: 1 sessão.

**Opção B — Pre-generation em background**
- Ao abrir um deal no Foco (ou hover de DealCard), dispara pre-fetch silencioso.
- Cache em memória browser (ou Supabase realtime) com TTL 5min.
- Quando utilizador clica "Preparar email", draft está pronto → instantâneo.
- Trade-off: custo IA por cada deal aberto mesmo sem usar (~$0.001/abertura). Solução: limitar a "deals priorizados no Inbox" + invalidar ao mudar.
- Estimativa: 2 sessões.

**Opção C — Race verdadeira Gemini ‖ Claude**
- `Promise.race([gemini, anthropic])` ambas iniciadas simultaneamente. Devolve primeira.
- Latência = min(Gemini, Anthropic) ≈ 4-6s típico.
- Custo: 2x sempre (~$0.0009/call vs $0.0001 actual). 100 mensagens/dia = ~$0.08/dia.
- Estimativa: 1 commit ~15min.

**Recomendação:** B (pre-generation) é a melhor UX — instantâneo. A (streaming) é melhor compromisso esforço/benefício. C é o mais simples e barato em desenvolvimento.

### M-003 · Reduzir snapshot na origem (não só no consumer)
- Hoje, o snapshot tem 25 activities + 50 notes + 50 files + 50 scripts (`features/inbox/components/FocusContextPanel.tsx:538-580`).
- Mesmo com truncate no consumer, o JSON sobe pela rede e é processado. Melhor reduzir na origem.
- Refactor: introduzir `cockpitSnapshot.compact()` para chamadas IA, e `cockpitSnapshot.full()` para outros usos.

### M-004 · UI `/settings/prompts` para editar prompts BD sem SQL
- Memory `plano_repositorio_prompts_ui.md` já tem o plano.
- Bloqueador: já temos 3 prompts em produção (`rewrite_message_draft` v3, `task_deals_email_draft` v2, `task_inbox_sales_script` v2). Sem UI, qualquer edição precisa de SQL via mcp.
- Quando atingirmos 5-6 prompts, UI passa a ser obrigatória.

### M-005 · Auditar TODOS os outros `cases` em `/api/ai/actions` para o mesmo padrão
- Hoje só `rewriteMessageDraft` tem cache + race + timeout + payload reduzido.
- Outros (`analyzeLead`, `generateEmailDraft`, `generateObjectionResponse`, `generateRescueMessage`, `generateBoardStructure`, `generateBoardStrategy`, `refineBoardWithAI`, `generateDailyBriefing`, `generateSalesScript`) ainda usam Gemini puro sem timeout.
- Risco: mesmos sintomas (10s+ em snapshots grandes).
- Refactor: extrair `runRaceWithFallback(systemBlocks, userMessage, schema, anthropicKey)` helper e aplicar a todos.

---

## 📋 Pendentes do smoke test 22/05 tarde (relatório `tmp/smoke-22mai.md`)

- **94.9% deals com `value=0`** → alavanca #5 (auto-value 545 deals em batch IA)
- **React #418 hydration mismatch em `/imoveis/[id]`** → debug DOM mismatch SSR vs client
- **Mobile 375px sem hamburger button visível** → adicionar drawer trigger
- **Tabela `tasks` e `lead_eventos` não existem na BD** (memória menciona) → procurar equivalentes `deal_activities`, `imovel_eventos`
- **Imóvel `ID-1234567` sem morada** → seed/test, apagar ou completar
- **Modelos "Antigravity Agent Preview" + "Nano Banana Pro"** no selector → filtrar em `GOOGLE_EXCLUDED_PATTERNS`

---

## M-006 · Reduzir tempo até 1ª chunk no streaming (Fase A.1 follow-up)

**Estado após fix anti-buffer (commit `f7c6d98`, validado live `260525_1049`):**
Streaming REAL funciona — textarea cresce em chunks visíveis: `88c → 277c → 497c → 948c → 1093c (completo)`. Total ~8s desde click.

**Pendente:** 1ª chunk demora **6.6s** a aparecer (Gemini "pensa" antes de enviar tokens). Objectivo da Fase A.1 era 1s.

**Caminhos para encurtar (Plan-First futuro):**
1. **Pre-warm**: ao abrir card no Foco, fire-and-forget warm-up call ao endpoint (sem usar resultado). Próxima call efectiva fica em ~1-2s (cache TCP + Vercel function warm).
2. **2 calls separadas**: 1ª gera só SUBJECT (rápida, ~1s) e renderiza. 2ª stream body em paralelo. Utilizador vê primeiro o assunto, depois corpo.
3. **Modelo mais simples para draft**: Gemini Flash Lite (~50% mais rápido) só para gerar subject, Flash 2.5 para corpo via stream.
4. **Pre-generation background** (M-002 opção B do CAPTURE original): ao entrar no Foco, draft já está pronto quando utilizador abre modal.

Combinar 1+4 dá UX "instantâneo real" (200ms). Custo: ~$0.001/abertura mesmo sem usar.

---

## ✅ PUSHS RESOLVIDOS 25/05/2026

Todos os commits pushed e em produção. GCM autorizado via browser. Próximos pushes são automáticos. PAT antigo da memory **fica obsoleto** — não usar.

## B-005 · SW cache atrapalha ver nova versão
- **Resolvido no Sprint 12 c3** (`app/sw.js/route.ts` doc comment "B-005 resolve" + `components/pwa/ServiceWorkerRegister.tsx` com controllerchange + skipWaiting + check periódico 60s + check on visibility). CACHE_NAME usa NEXT_PUBLIC_BUILD_TAG dinâmico. Confirmado em 28/05/2026 durante sweep CAPTURE.

## ✅ Resolvidos esta sessão (22/05 noite)

- ~~Prompt caching infra cross-provider (`006dd8a`)~~
- ~~Prompt `rewrite_message_draft` v3 BD (pt-PT formal, exemplos do João, nunca Domingos, "oportuno")~~
- ~~Draft inicial passa a ser gerado por IA on-open (substituir templates pt-BR `Oi/Você/Abs/rapidinha`)~~
- ~~Race condition useEffect spinner infinito~~
- ~~UX 3-5s: truncar payload + race Gemini/Claude Haiku com cache real~~
- ~~309 linhas de código pt-BR removidas~~

---

## ✅ T-001 (RESOLVIDO 29/05/2026, commit 7e9a991) · 3 testes só-de-teste destapados ao instalar @testing-library/dom (28/05/2026, Sprint 37)
- **Resolução:** CallModal — fixture passou a número PT `912 345 678`, espera `tel:+351912345678` (alinhado ao `normalizePhoneE164`, default PT). DealDetailModal + US-001 — render envolto em `QueryClientProvider` real. Suite 350→353 a passar. Zero alterações em produção.

- **Contexto:** instalar `@testing-library/dom` (commit cc69c36) fez os 12 ficheiros DOM voltarem a carregar (209→350 testes a passar). Isso destapou 3 falhas reais que antes estavam escondidas (os ficheiros nem carregavam). NENHUMA parte a app em produção, são todas de setup/expectativa de teste.
- **1) `features/inbox/components/CallModal.test.tsx`** — espera `tel:+5511999990000` mas o código formata `tel:(11) 99999-0000`. Expectativa desactualizada; além disso o `+55` é brasileiro (resíduo de template, CRM é PT). Decidir: alinhar teste ao formato real OU corrigir formatação do tel para E.164.
- **2) `features/boards/components/Modals/DealDetailModal.test.tsx`** ("hook order regression") — renderiza sem `QueryClientProvider`, logo `useQueryClient` (DealDetailModal.tsx:200) rebenta. Falta o wrapper no render do teste. Não é bug de produção (a app tem provider).
- **3) `test/stories/US-001-abrir-deal-no-boards.test.tsx`** — mesma raiz do #2 (falta provider à volta do boards/deal modal).
- **Recomendação:** sessão curta "higiene de testes" — wrap dos renders num helper com QueryClientProvider + decidir formato tel. Não bundlar com features.

---

> **Como usar:** quando o utilizador propuser feature/fix novo mid-sessão e estiver fora do objectivo da sessão activa, perguntar "CAPTURA ou agora?". Se CAPTURA, adicionar aqui com data e contexto suficiente para retomar sem perder informação.

---

## ✅ B-007 (RESOLVIDO 29/05/2026, commit 31a2150) · Sweep PT-PT "Atividade(s)" → "Actividade(s)" (Sprint 37)
- **Resolução:** 45 trocas em 24 ficheiros de copy visível (`features/`, `components/`, `app/`) — labels, placeholders, toasts, aria-labels, metadata, nav, reasoning de decisões. tsc EXIT=0, vitest 353/0/5. Routes `/activities`, ids, enums e valores persistidos intactos.
- **Deixado de fora de propósito (decisão do João pendente):**
  1. **`lib/ai/**`** (tools.ts, global-rules.ts, crmAgent.ts, agent/*) e **`features/ai-hub/tools/crmTools.ts`** + **UIChat.tsx:393** (prompt) — texto enviado AO MODELO, não é UI pura. Trocar pode afectar comportamento da IA. Decidir caso a caso.
  2. **`lib/public-api/openapi.ts`** — strings de doc da API pública.
  3. **`decisions/analyzers/*` campos `config.name`/`config.description`** — propagam para `analyzerName` em objectos de decisão; possível comparação/persistência. Não tocado por precaução.
  4. **`stagnantDealsAnalyzer.ts:127` `activityDescription`** — vira descrição de actividade PERSISTIDA na BD ao aplicar a sugestão. Não tocar (é dado).
  5. Comentários/JSDoc e migrations/seed/docs/testes — fora de scope.

## ⚠️ NOVO défice descoberto durante B-007 (29/05/2026) · Código cheio de PT-BR, não só "atividade"
- Ao varrer o B-007 apareceram MUITAS palavras PT-BR no copy visível, muito além de "atividade": **"registrar"/"registro"/"registrada"**, **"Buscar"** (→Procurar), **"você"/"seu"/"sua"**, **"Salvar"** (→Guardar), **"selecionada"/"atualizada"/"concluídas"**, **"Tem certeza que deseja excluir"** (→Tem a certeza que pretende eliminar), **"chance"**.
- **Impacto:** o produto inteiro tem dissonância PT-BR vs o PT-PT pré-AO que o João exige. É um défice sistémico, não pontual.
- **Recomendação:** sessão dedicada "sweep PT-BR→PT-PT" com glossário fixo (registar, procurar, guardar, eliminar, seleccionado, actualizado, etc.) via sub-agente + revisão. NÃO bundlar com features. Maior esforço que B-007.

## 📌 Meta Ads Fase A — pontos em aberto (29/05/2026, c3 eec52db)
- **/automacoes vs webhook automation-meta-leads:** a regra "toda automação em /automacoes" aplica-se a cron/background. Este é webhook inbound (precedente: messaging-webhook-* não estão em /automacoes); o toggle é o Ligar/Desligar em /settings/integracoes → Meta Ads. Avaliar se justifica entrada em /automacoes/sistema (so leitura: ver últimas leads recebidas).
- **Página subscrita:** RESOLVIDO em c4 (`1061b57`/`73fa506`) — selector de Página/conta + remover. Multi-Página simultânea fica para refinamento futuro.
- **✅ c4.1 RESOLVIDO (29/05, commit `98c6aaf`):** negócio herda `attribution` do contacto de origem ao ser criado sem atribuição própria. Trigger `BEFORE INSERT` em `deals` (`deals_inherit_attribution`, migração `20260529180000`), cobre todos os caminhos de criação, multi-tenant, não sobrepõe a atribuição do webhook. Verificado na BD (herança + no-override). Faz o card "Origem do anúncio" acender em uso real.
- **c4.2 painel de atribuição no contacto (POR FAZER, ticket próprio):** BLOQUEADO por não existir detalhe/página de contacto read-only — só `features/contacts/components/ContactFormModal` (form de edição). Decidir superfície (bloco read-only no topo do ContactFormModal? criar /contacts/[id]?). Requer ainda: acrescentar `attribution` ao tipo `Contact` (`types/types.ts:152`) + ao mapeamento de leitura em `lib/supabase/contacts.ts` (hoje não lê a coluna). Componente `components/MetaAttribution.tsx` já existe e é reutilizável.
- **c4.3 tag automática da linhagem (POR FAZER, ticket próprio):** `contacts` NÃO tem coluna `tags` (só `deals.tags string[]`). Mexe no modelo de tags (tabela `tags`, 64 linhas; confirmar junção contacto↔tag) + na edge `automation-meta-leads` (aplicar tag ex. "Meta Ads: <campanha>" ao criar lead/contacto). Maior esforço.
