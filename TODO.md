# TODO — Foco Imo (CRM) — CATÁLOGO ÚNICO

> ## ▶️ ORDEM DE EXECUÇÃO DECIDIDA PELO JOÃO (08/06/2026) — seguir sem saltar
> O épico **MKT-MEASURE** está fechado na parte construível (CAPI + Funil + Orgânico + Cérebro).
> O Cérebro expôs o gargalo: **centenas de leads, 0 fecham → o problema está DENTRO do CRM**
> (leads por trabalhar/qualificar). Por isso o João escolheu atacar primeiro o que faz trabalhar
> as leads e só no fim o assistente. **Sequência travada (não reordenar sem ordem dele):**
> 1. **CT-AUTO** — auto-preencher campos (Trimestre/data de entrada) + **automações de follow-up/cadências** no `/automacoes`. ← **A EXECUTAR AGORA**
> 2. **SOCIAL-INBOX** — avisos de DMs/comentários FB+IG; IA prepara, **o João envia** (nunca auto-send).
> 3. **IMO-7** — Agente de Divulgação do Imóvel (sequência de fotos + copy por canal + plano).
> 4. **IA-7** — Bot do CRM = tutor + assistente pessoal 360 (fica para o FIM, por decisão do João).
> (Detalhe de cada peça nas secções B/D/G/J abaixo.)

> ## ▶️▶️ PRÓXIMO DECIDIDO (11/06/2026) — arrancar JÁ por aqui
> A sequência travada (CT-AUTO→SOCIAL-INBOX→IMO-7→IA-7) está TODA feita. Pós-QA (10-11/06), ordem decidida:
> 1. **LIMAR primeiro:** ✅ **UX-1 NAV-IA FEITO** `[11/06, commit ae410b8, verificado em produção
>    desktop 1280 + recolhido + mobile 375/540 + tablet 768, 0 erros consola]` — barra lateral por
>    famílias (Inbox/Mensagens/Actividades sempre à vista + Vendas/Marketing/Análise/Sistema
>    colapsáveis; activa abre sozinha; estado lembrado; gaveta mobile espelha; maqueta aprovada
>    `docs/mockups/ux1-nav-familias.html`).
>    + **copy restante do QA** ✅ `[FEITO 11/06, commit 6e86448, verificado em produção]` (B-012
>    `Contatos`→`Contactos`; `Senha`→`Palavra-passe` no login, /setup, /join e instalador; varrido
>    `metadata.title` — não havia mais PT-BR).
> 2. **CONSTRUIR:** ✅ **MA-PIXEL-OWNERSHIP FEITO** `[11/06 — veredicto: NÃO há terreno alheio; os 4
>    pixéis/datasets são propriedade do Business do João 761569255551287, incluindo o "Outlier Agency";
>    nenhuma agência com acesso de parceiro. Detalhe na secção D.]`
> 3. **Depois (escolha do João):** ✅ escolhido a 11/06 → **MKT-BIBLIOTECA** (ver bloco abaixo). DASH-2 fica na fila.
> Já feitos (reclassificar, não re-propor): INT-DOMAIN, MA-CAPI, MKT-MEASURE(construível), AUTO-1 pause-on-touch.

> ## ✅✅ MKT-BIBLIOTECA — FECHADA E VERIFICADA EM PRODUÇÃO (12/06/2026)
> **Verificação visual final FEITA a 12/06 (2.ª sessão):** post com imóvel real (T6 Seroa, Ref. 124321316-18)
> → copy IA fiel (1 650 000 €, PT-PT, sem traços) → **preview na UI COM A FOTO DO IMÓVEL** nos dois rácios
> (◻1080×1080 e ▯1080×1350, naturalWidth confere) → guardado pela UI → peça na Biblioteca com miniatura
> assinada do bucket ✅. Gaveta: **Duplicar** de peça gerada abre o Criar pré-preenchido (headline/copy/imóvel)
> ✅; **Marcar onde usei** (Facebook+data+nota → "📌 Usei em: Facebook (12/06/2026)" no cartão e na gaveta) ✅;
> **Duplicar peça de texto** cria "(cópia)" em rascunho e a secção **Versões** liga ao original ✅. **Política
> de privacidade** em Definições→Geral guardada (https://joaofilipefonseca.pt/privacidade, confirmada na BD) ✅.
> Mobile 375/540 + tablet 768 da aba Criar sem overflow ✅ (**fix `8646d68`**: as filas de botões "Gerar copy
> com IA" e "Pré-visualizar/Gerar e guardar" não tinham flex-wrap e ficavam cortadas a 375px). Consola 0 erros
> em /criativos (ambas as abas) e /settings ✅. Dados de teste 100% limpos (2 linhas + PNG do bucket); restam
> as 3 seed de Maio. tsc0/lint0/vitest533/5.
> **Estado real e honesto (histórico da construção):**
> - **Fatia 1 (Repositório) ✅ FEITA E VERIFICADA em produção** (commits `61589c8`+`340f30f`): /criativos é a
>   Biblioteca (abas 📚 Biblioteca/✨ Criar, nav "Biblioteca"); origem/estado/usages/parent_id/render_spec na
>   creative_archive (migração `20260611190000`); + Adicionar (ficheiro/ideia/referência/texto); upload real
>   verde; filtros origem/estado/imóvel; gaveta com estado editável + descarregar; URLs assinados em lote.
>   Verificado desktop 1280 + mobile 375/540 + tablet 768, 0 erros. **🚨 BUG GRAVE corrigido de caminho
>   (`fef2395`): o service worker fazia SWR a TODOS os GETs incl. /api/* e Supabase → leituras pós-escrita
>   vinham obsoletas em TODO o app.** Agora só cacheia assets estáticos da mesma origem. **O bucket
>   creative-archive NÃO existia** (memória errada) → criado + políticas org-scoped na migração.
> - **Fatia 2 (Criar) ✅ CONSTRUÍDA, backend VERIFICADO em produção** (commits `b8536b7`+`1c97a0a`+`ec14c30`):
>   4 formatos (anúncio 1080×1080 · post ◻1:1/▯4:5 ideal IG, botão por rácio · story 1080×1920 · flyer A4 PDF),
>   2 variantes (clássico/imersivo), Brand Kit + foto do imóvel + copy IA (Gemini→Claude, copy real verificada
>   fiel ao imóvel). VERIFICADO via API em produção: render com foto = PNG 1,5MB ✅; flyer guardado = PDF A4 no
>   bucket + peça na biblioteca com URL assinado ✅; preview na UI ✅ (à data do teste a foto ainda falhava — o
>   fix `ec14c30` entrou depois e foi verificado via API). 🧠 Gotchas: satori embute a foto no SVG → originais
>   de MB rebentam o resvg → resize servidor (sharp → fallback /_next/image → original <3MB); fontes woff
>   fontsource em assets/fonts + outputFileTracingIncludes.
> - **Fatia 3 (Reuso+polish) ✅ CONSTRUÍDA, backend verificado, ⚠️ UI POR VERIFICAR no browser** (commit
>   `6ddd490`): Duplicar (gerada→Criar pré-preenchido via render_spec+parent_id; texto/ficheiro→cópia directa),
>   Marcar onde usei (add_usage ✅ verificado via API na F1), secção Versões, campo Política de privacidade em
>   Definições→Geral (admin) + GET/PUT /api/settings/privacidade.
> ✅ (feito 12/06, 2.ª sessão) verificação visual em produção: aba Criar com foto, Duplicar/Marcar usei/Versões,
> campo privacidade, mobile 375/540 — tudo verde, ver bloco no topo.
> Polish capturado (não executar sem ordem): editar tags na gaveta; alias upload de vídeo no Criar; logo do
> Brand Kit no template (hoje é o nome em texto); mais variantes de layout.
>
> ## (feito) PRÓXIMO DECIDIDO (11/06/2026 fim do dia) — MKT-BIBLIOTECA, decisões do João JÁ TOMADAS (não re-perguntar)
> **Visão (palavras dele):** "além de criar quero poder GUARDAR posts, ideias, tudo relacionado com o negócio:
> a minha brand, conteúdo de referência, o que já criei, o que já postei — ter TUDO, todos os activos digitais."
> 1. **Coração do MVP = REPOSITÓRIO** de todos os activos (guardar/organizar/reencontrar/reutilizar/duplicar),
>    com a CRIAÇÃO em cima. **Assenta no `/criativos`** (estender `creative_archive` + bucket `creative-archive`,
>    NÃO duplicar; não inchar a barra).
> 2. **Criação MVP — os 4 formatos:** criativos para anúncios Meta · posts orgânicos FB/IG · stories/reels
>    (capas+textos) · flyers/one-pagers PDF.
> 3. **Imagens: TEMPLATES da marca primeiro** (peças compostas com cores/fontes/logo/fotos dos imóveis,
>    renderizadas pelo CRM). **SEM IA de imagem no MVP** (iteração futura).
> 4. **Privacidade: só o link nas definições** (`organization_settings.privacy_policy_url` já existe; falta
>    expor o campo na UI de definições — peça pequena dentro da biblioteca).
> Recursos prontos a reusar: Brand Kit `/settings/marca`, creative_archive (15 tipos+métricas+UI), fotos dos
> imóveis (URLs assinados), copy por canal do Agente de Divulgação (IMO-7), motor IA texto Gemini→Claude.
> Hábito: maqueta primeiro. Maqueta: `docs/mockups/mkt-biblioteca.html` (commit `20eb4de`).
> **Decisões adicionais do João (11/06, feedback à maqueta):**
> 5. **Posts orgânicos com DOIS rácios de raiz:** 1080×1080 (1:1) e **1080×1350 (4:5, o ideal do feed do
>    Instagram)** — o mesmo template montado de raiz para os dois, com margens de segurança cuidadas em
>    ambos; na criação há um botão por rácio (carrega num e vê 1080×1080, carrega noutro e vê 1080×1350).
> 6. **Retenção:** TUDO o que entra na biblioteca fica guardado **até o João apagar** — nada expira nem se
>    auto-apaga; apagar é sempre acção dele (soft-archive reversível, como a API do creative_archive já faz).

> ## 🔔 LEMBRETE COM DATA — 18/06/2026: remover a agência do Business Manager (João pediu 11/06)
> **Acção do João (eu não posso mexer em permissões):** remover **Muhammad Seedat** (muhammad.contacto@gmail.com),
> ADMIN do Business `761569255551287` + acesso total à Página "João Fonseca" (o acesso à Página vem pelo
> Business → **1 remoção corta tudo**): business.facebook.com → ⚙️ Definições → **Pessoas** → Muhammad → Remover.
> **Pré-requisito (é por isso que é dia 18, não antes):** primeiro fixar a palavra-passe (Centro de Contas →
> Palavra-passe e segurança) + guardar códigos 2FA — o dispositivo já deve estar "envelhecido". No muro de
> reautenticação: método por CÓDIGO (WhatsApp), **NUNCA "Esqueceste-te da palavra-passe?"**, não insistir se falhar.
> **Depois:** Claude re-verifica via API (`/761569255551287/business_users` deve ficar só o João; idem
> `/104774959239895/assigned_users`). Varrimento de 11/06: conta de anúncios, pixels e convites pendentes já limpos.

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

## 🗓️ Registo da sessão 10 Jun 2026 — QA A FUNDO (percurso da lead) — HEAD `c978c18`
Sessão de QA guiada (não construir features). Foco do João: **o caminho da lead** — entra,
onde para, que sequência, follow-up, automações. Recon na BD + verificação ao vivo em produção.

**Mapa real do percurso (BD + browser):** entram (Meta webhook cria lead+contacto+negócio; 485
contactos, 20 origens) → **481 de 484 negócios presos na 1.ª etapa "Oportunidade"** (186 parados
+30d; mais antigo 2023) → sequência das etapas existe mas ~0 progrediram → follow-up CT-AUTO VIVO
(275 elegíveis; cron criou 10 tarefas "Retomar contacto" a 09/06 09:00) → automações: 10 ON.

**Corrigido (commit `c978c18`, A+D+E aprovados pelo João, verificado em produção):**
- **A — Contabilidade de /automacoes** ✅ `[FEITO]` As 5 edge functions de cron (lead-followups,
  cmi-watch, telegram-morning-brief, client-errors-alert, backup-export) + rota social-inbox/sync
  **não registavam** a corrida → /automacoes mostrava "nunca" em automações que correm (a "Leva de
  follow-up" inclusive). Novo helper `supabase/functions/_shared/record-run.ts` (espelha o bloco da
  `automation-meta-insights`); cada função grava `last_run_at/ok/error/run_count/fail_count`.
  `verify_jwt=false` fixado no `config.toml` p/ os 5 crons. **Verificado:** disparei client-errors-alert
  por pg_net → 200 + `last_run_at` actualizou; /automacoes passou a "há 1m · 2 execuções" (era "nunca").
  ⚠️ **Aprendizado caro:** o MCP `deploy_edge_function` mete `verify_jwt=true` por omissão → o 1.º
  deploy partiu a lead-followups (cron manda X-Cron-Secret, não JWT → 401 do gateway). **Passar SEMPRE
  `verify_jwt: false`** nestes crons. O bundling de `_shared` funciona (passar os ficheiros `../_shared/*`).
- **D — Leads Meta nunca órfãs** ✅ `[FEITO]` Campanha sem `meta_lead_routing` (só 1 mapeada) criava
  contacto SEM negócio → invisível ao funil e ao follow-up. Agora cai no board **por omissão** da org
  (`organization_settings.default_lead_board_id/stage_id`, migração `20260610120000`, seed
  Compradores/Oportunidade). Telegram distingue "Destino" vs "Destino (por omissão)". (E2E só na próxima
  lead Meta real de campanha não mapeada — não dá para forjar webhook assinado.)
- **E — APP_URL** ✅ `[FEITO]` edge de leads passa a `crm.joaofilipefonseca.pt` (era `crm-joao.vercel.app`).
- ~~F~~ negócio "Sonia Rodrigo" com `status`=stage_id → **NÃO é bug** (leitura usa `stage_id || status`).

**Aberto (decisão do João, NÃO executar sem ordem):**
- **C — 481 leads em "Oportunidade"** `[NÃO É BUG — decisão do João 10/06]` — **NÃO contar com isto como
  gargalo.** O João vai **colocar os contadores a zero** mais tarde (reset deliberado da 1.ª etapa). Não
  testar/medir como problema. Eventual desenho de patamares por temperatura + email automático às frias
  continua capturado, mas só quando ele abrir o tema.
- **B — Token Meta** `[RESOLVIDO 11/06]` ✅ — **causa-raiz era o Facebook do João**, não o CRM. Ele andava
  preso num loop diário: não entrava → "esqueceu palavra-passe" → o reset dava "algo correu mal" e a Meta
  invalidava o token do CRM todos os dias. **Causa real (mensagem do próprio Facebook):** o PC era sempre
  tratado como "dispositivo novo" → o Facebook **bloqueia a mudança de palavra-passe** até o dispositivo ser
  usado "durante algum tempo" → ele nunca conseguia fixar uma palavra-passe → loop. **Resolução (Claude-in-
  Chrome no browser dele):** entrou via **facebook.com/login/identify → código por email → 2FA por WhatsApp**
  (não por palavra-passe), marcou **"Confiar neste dispositivo"** + **"Memorizar palavra-passe"**, e
  **reautorizou a Meta no CRM** (/settings/integracoes#meta-ads → "Reautorizar" → OAuth Continuar). **Token
  novo verificado VIVO:** `meta-insights-sync` 200 ok e `social-inbox-sync` last_run_ok=true (eram falhas de
  token). **Pendente do João (comportamento):** NÃO voltar a fazer reset à palavra-passe; NÃO limpar
  cookies/histórico nem fazer logout neste Chrome; deixar o dispositivo "envelhecer" uns dias → depois
  consegue **definir uma palavra-passe fixa** (Centro de Contas → Palavra-passe e segurança → Alterar
  palavra-passe) e gravar códigos de recuperação da 2FA. Ver [[reference-facebook-login-loop-joao]].

**QA verificado VERDE em produção (2.ª parte da sessão, browser autenticado):**
- ✅ **Ciclo de follow-up fecha:** cron cria tarefa "Retomar contacto" → aparece na mesa de trabalho
  (Inbox, Lista: "Retomar contacto: Bruno Soares"); botão **"Adiar"** no negócio → modal 3/6/12 meses
  + data + motivo, "Adiar até 10/12/2026" (data certa), "fica de fora do follow-up e volta na data"
  (não marca perdido). Tudo PT-PT.
- ✅ **IA-7 bot (`/ai`, via `POST /api/ai/crm-agent` 200):** Assistente 360 ("fala-me do Bruno Soares"
  → retrato + origem Facebook + link da ficha + candidatos semelhantes por `search_clients_fuzzy`);
  Tutor ("como faço para adiar um negócio?" → passos numerados + /boards + opção Adiar). PT-PT limpo.
- ✅ **Dashboards 0 erros de consola:** `/funil` (mostra honestamente a fuga em Oportunidade),
  `/cerebro`, `/organico` (degrada bem sem token Meta), `/anuncios`, `/financeiro`.
- ✅ **`/admin/saude`:** Erros front-end 24h = **0** ("nada partiu"), backup 07/06 visível, IA OK.
- ✅ **0 #418 / 0 erros** em Inbox, Boards, dashboards.

**Corrigido (copy PT-BR, commit `35a33ef`):** "Sua mesa de trabalho"→"A sua…"; chips do /ai "pra
fazer"→"para", "meu pipeline"→"o meu pipeline"; placeholder "sobre seu CRM"→"sobre o seu CRM";
valor "1650 €k"→"1650 k€".

**Nits menores capturados (não corrigidos — P3):**
- `/saude` dá **404** (não é rota; a nav usa `/admin/saude` correctamente). Eventual alias/redirect.
- Assistente 360: o link `/contacts/...` na resposta é **texto, não clicável** (UX menor).
- Falta testar (não chegámos): variante "descrição vaga" do Assistente 360; ficha `/contacts/[id]`
  (Assistente 360 + timeline) a fundo; mobile 375/540 das áreas acima.

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

## 🔎 AUDITORIA 02/06 — gaps e erros do que já está construído (lista única, evidência real)

> Motivada pela preocupação do João após o gap do CMI nos Documentos. **Conclusão tranquilizadora:**
> não há buraco crítico — 0 erros de consola abertos, **0 advisors ERROR** (107 são WARN), imóveis sem
> morada = 0. O que existe são **gaps de costura de domínio**, **dados históricos sem origem** e um
> **smell estrutural** (enums duplicados) que foi a causa-raiz do gap do CMI. Atacar por prioridade.

**AUD-D1 · CAUSA-RAIZ do gap CMI — enums duplicados em 3 sítios** `P1` `[FEITO]` (02/06, HEAD `9e28e50`, LIVE+verificado)
  ✅ Tipos de documento centralizados em **`shared.DOCUMENTO_KINDS`** (array canónico): `DocumentoKind` + `DOCUMENTO_KIND_VALUES` derivam dele; `documentoLabel` faz lookup; `ImovelDocumentos` usa-o no dropdown; a rota deriva `ALLOWED_KINDS` dele. Adicionar um tipo = 1 linha, impossível ficar a faltar num sítio. Verificado em produção (dropdown completo, sem regressão). **Resta varrer outros enums duplicados** (tipos de mandato/`comissao_paga_por` na rota+componente; kinds de evento; tipos de canal) com o mesmo padrão — `P2`.

**AUD-A1 · Negócios NÃO ligados a imóveis (0 de 484)** `P1` `[FEITO o forward-fix — 02/06, HEAD `3fc9dc4`, LIVE]`
  ✅ **Forward-fix LIVE:** `Deal.imovelId` + `DbDeal.imovel_id` mapeado (`transformDeal`/`transformDealToDb`, null desliga); **`ImovelSearchCombobox`** (busca ref/morada/concelho via cliente supabase, lite) + **`DealImovelField`**; secção **"Imóvel"** na ficha do negócio (DealDetailModal) liga/vê/desliga via `updateDeal({imovelId})`. **Verificado end-to-end:** liguei um negócio ao imóvel → o KPI "Negócios" do Acompanhamento do CMI passou de 0→1 (revertido). UI de escrita build/tsc/lint-verificada (mesmo padrão `updateDeal` do título/valor); abertura do modal não testada no browser por o board alcançado estar vazio. **Falta o BACKFILL** dos 484 históricos (separado, cuidado — maioria são leads/compradores sem imóvel específico; só por pista forte e reversível; provavelmente manual/assistido).
  --- plano original (executado no forward-fix) ---
  `deals.imovel_id` está a **0 em todos os 484 negócios**. Quebra: CMI Acompanhamento (KPI "Negócios" sempre 0), ROI por imóvel (NS-3), valor vitalício (MA-LTV). **Fundamentado (02/06):** `deals.imovel_id` existe na BD mas **NENHUM caminho da UI o escreve**; **não há picker de imóvel** nem **hook `useImoveis` client**; o `Deal`/mapeamento não expõe `imovelId`.
  **Plano de execução (≈5-6 ficheiros, feature a sério — NÃO é slice pequeno):**
  1. `types`: `Deal.imovelId?: string | null`; mapear em `lib/supabase/deals.ts` (leitura + no payload de `useUpdateDeal`).
  2. `useImoveis` (client query hook) a partir de `GET /api/imoveis` (existe) + `queryKeys.imoveis`.
  3. `ImovelSearchCombobox` (espelhar `components/ui/ContactSearchCombobox.tsx`): procura por referência/morada/tipologia.
  4. `DealDetailModal`: secção/linha **"Imóvel"** — mostra o ligado (link p/ `/imoveis/[id]`) ou o combobox p/ ligar/trocar/desligar; grava via `updateDeal(id,{imovelId})`. (E opcional: campo no `CreateDealModalV2`.)
  5. Verificar live: ligar um negócio a um imóvel → KPI "Negócios" do CMI desse imóvel passa a 1.
  **Backfill (separado, cuidado):** os 484 são em grande parte leads/compradores do GHL sem imóvel específico → NÃO forçar; backfill só por pista forte (título/morada ↔ imóvel) e reversível. Provavelmente manual/assistido, não automático.

**AUD-B1 · Origem dos contactos** `P1` `[FEITO o essencial — 02/06, HEAD `a6e3786`, LIVE+verificado]`
  ⚠️ **Correcção de auditoria:** o achado "485 sem origem" era **FALSO POSITIVO** — verifiquei `attribution->>'source'` em vez da coluna **`contacts.source`**, que está preenchida em **484/485** (Facebook 127, Idealista 102, Form Calculadora 44, import_remax 41…). Só **1** contacto tem `source` NULL. A origem JÁ estava rastreada.
  ✅ **Gap real corrigido (enforcement na criação manual):** `ContactFormModal` ganhou **Origem (select obrigatório**, 10 opções + Outro); **Telefone passou a obrigatório**, **Email a opcional** — alinhado à regra [[regra-lead-tag-proveniencia-obrigatoria]] (Nome+Telefone+Origem). Controlador propaga `source` em criar/editar. Verificado live (Origem required, Telefone required, Email opcional).
  **Resta (P2/P3):** (1) o 1 contacto com source NULL (trivial); (2) **outros caminhos de criação** que ainda não exigem origem — `ContactFormModalV2`, criar contacto a partir do negócio (CreateDealModal), import — aplicar a mesma regra; (3) considerar mover origem para enum tipado (`Contact['source']` hoje é casted de texto livre).

**AUD-C1 · RLS `using(true)` em 11 políticas** `P2` `[FEITO]` (02/06, migração `20260602170000`, LIVE)
  ✅ As 11 fechadas e advisor `rls_policy_always_true` a **0** nessas tabelas. **Grupo A (9 `automation_*`, role `public`, write `using/with_check(true)`):** DROPadas — os escritores (edge functions + webhook Telegram) usam **service_role** que ignora RLS; as leituras da UI mantêm-se pelas políticas `*_select_own_org`. **Grupo B (`organizations` `FOR ALL` a authenticated lia/alterava TODAS as orgs):** rescoped a `id = get_user_org_id()` (signup intacto — org criada via trigger `handle_new_user` SECURITY DEFINER). **`client_errors` INSERT:** apertado a `organization_id = get_user_org_id()` (o reporter já gravava a org do perfil). Verificado: c1_remaining=0.

**AUD-C2 · 3 buckets públicos → privados** `P2` `[FEITO]` (02/06, migração `20260602170000`, LIVE)
  ✅ Decisão do João: **tudo privado** (sem exportação para portais). `avatars`, `imovel-fotos`, `messaging-media` passaram a `public=false`; políticas de listagem ampla substituídas por **leitura autenticada org-scoped** (1.º segmento do path = org). Código passou a servir por **URL assinado**: `listFotosByImovelId` assina 1h na leitura (galeria intacta); writers de fotos (complete/from-url/telegram) gravam `url_publica=null`; avatar e messaging-media assinam 1 ano no upload. Verificado: public_buckets=0, 0 listagens públicas, tsc/lint/vitest OK.

**AUD-C3 · Hardening de funções SQL** `P3` `[FEITO o essencial]` (03/06, migração `20260602200000`, LIVE)
  ✅ **`function_search_path_mutable` 12→0:** pinado `set search_path = public` nas 12 funções nossas (exclui as de extensões). ✅ **2 funções sensíveis fechadas a `anon`:** `get_backup_cron_secret` (devolvia um segredo!) e `_api_key_make_token` (criava token de API) — grants explícitos, `service_role`/`postgres`/`authenticated` mantêm (cron/edge intactos). Verificado: advisor das 2 classes a 0/locked.
  **Deixado de propósito (risco/escopo, P3):** (a) restantes `security_definer_function_executable` a anon/authenticated (36+39) — **RPCs benignos** (anon não obtém nada sem sessão; os perigosos já estão fechados); revogar todos exige classificar função-a-função (risco de partir a app). (b) `extension_in_public` ×3 (`unaccent`/`pg_net`/`vector`) — mover parte lookups/crons/embeddings; risco>benefício. (c) `auth_leaked_password_protection` — **botão no painel Auth** (Authentication → Policies), não dá por SQL; 1 clique do João quando quiser.

**AUD-B2 · 455 de 484 negócios com valor 0 (94%)** `[DECIDIDO NÃO FAZER — João 02/06]`
  ❌ **Decisão do João:** são negócios **antigos para reactivar/trabalhar**, vivem em "oportunidades" e **podem não dar em nada** → **não vale a pena a IA estimar valor** (seria inventar números sobre leads frias). Os valores enchem-se naturalmente quando um negócio avança. Não re-propor.

**AUD-A1 backfill · ligar 484 negócios antigos a imóveis** `[DECIDIDO NÃO FAZER — João 02/06]`
  ❌ **Decisão do João:** daqui para a frente a ligação acontece **naturalmente** — o **proprietário** tem logo um imóvel para ligar; o **comprador** pode ter um imóvel meu ou um que eu anuncie, mas depois **acompanho-o para encontrar outro**. Forçar backfill nos 484 históricos não traz valor. O forward-fix (ligar na ficha do negócio) já está LIVE. Não re-propor.

**AUD-A2 · "mandato" vs "CMI" no resto da app** `P2` `[FEITO]` (02/06, migração `20260602190000`, LIVE)
  ✅ **Sweep:** base de conhecimento da IA (`lib/ai/knowledge/imobiliario-pt.ts`) corrigida — "Angariação: mandato" → **"Angariação: CMI (Contrato de Mediação Imobiliária)"** (angariação = lado do vendedor). Ficha do imóvel desambiguada: secções **"CMI · …(vendedor)"** e **"Mandato (comprador)"** (modelo do João). Telegram (`handlers/imovel.ts` DOC_KINDS + prompt do `router.ts`) passou a aceitar o tipo **`cmi`** (faltava). ✅ **Ligação documento↔registo:** `imovel_cmi.documento_id` (FK→`imovel_documentos`, `on delete set null`, paridade com `imovel_mandato`); tipo `ImovelCmi.documento_id`; rotas POST/PATCH do CMI aceitam-no; `ImovelCmi.tsx` ganhou **selector "Documento do CMI"** (lista os documentos do imóvel do tipo `cmi`) + **"📄 Ver contrato"** (URL assinado) no registo. **Resta (AUD-D1 P2):** unificar o vocabulário de doc-kinds do Telegram (valores antigos `certidao/ftecnica/ce…`) à fonte única `DOCUMENTO_KINDS`.

**Saudável (sem acção):** 0 erros de consola abertos · imóveis sem morada = 0 · só 19 TODO/FIXME no código · 0 advisors de nível ERROR. **Próxima passagem da auditoria:** percorrer cada fluxo no browser (Playwright) como consultor para apanhar gaps de UX/ligação que não aparecem em SQL.

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

- **NS-3 · Custo total por imóvel (visitas + despesas) e ROI por imóvel** `[FEITO]` (03/06, migração `20260603110000`, LIVE)
  ✅ Nova secção **"Custo & ROI deste imóvel"** na ficha `/imoveis/[id]`: 3 KPIs (Rendeu líquido · Custou total · Lucro) + chip **ROI**, detalhe de **custos** (despesas ligadas por categoria + **visitas × custo/visita**) e nota "investido sem retorno" se ainda não vendeu. **Receita** = comissão líquida dos negócios ganhos ligados (`deals.imovel_id`, mesmo cálculo do `/financeiro`: `commission_mode`/`pct`/`share` de `custom_fields` + defaults da org). **Custo de visitas:** decisão João = **custo fixo por visita** configurável (`organization_settings.default_visit_cost_cents`, editável inline no cartão via `PATCH /api/financeiro/visit-cost`) × nº de visitas (`imovel_eventos kind='visita'`). Loader `getImovelFinanceiro`; componente `ImovelFinanceiro.tsx` (dark-aware); maqueta `docs/mockups/ns3-custo-roi-imovel.html`. **Decisão de honestidade:** o gasto de anúncios **não** é auto-imputado por imóvel (o gasto de 1 anúncio é partilhado por muitas leads → atribuir o total a 1 imóvel seria errado); quem quiser imputa publicidade como **despesa** ligada ao imóvel. **Resta (futuro):** imputação rateada de anúncios por imóvel (precisa de custo por lead), e vista agregada no /financeiro. Liga a NS-1 e a MA-LTV-ATTRIBUTION.

### B. Contactos / dados ricos

- **CT-1 · CONTACT-CARD-NOTION — campos do card de contacto do Notion** `[FEITO]` (01/06, HEAD `a24ebc3`, LIVE)
  Decisão: página dedicada **`/contacts/[id]`** + **`custom_fields jsonb`** (maqueta aprovada em `docs/mockups/ct1-ct2-contact-card.html`). Migração `20260601120000_contact_rich_fields` (`contacts.custom_fields` + `contact_referrals`). Campos editáveis: Morada/Investimento, Família, Animais, Triggers, DISC, Trimestre, Aniversário, Última actividade, Follow Up + **Indicado por/Indicou** (picker). Notas + Documentos (reusa `ContactFilesPanel`). APIs `PATCH /api/contacts/[id]` + `POST/DELETE /api/contacts/[id]/referrals`. Editor `features/contacts/components/ContactRichPanel.tsx`. **Fase 3 FEITA (`f89fcf0`):** Comentários (`contact_comments` + `ContactComments` + API POST/DELETE, autor resolvido via `profiles`). CT-1 completo fim-a-fim.

- **CT-2 · Painel de atribuição read-only no contacto (c4.2)** `[FEITO]` (01/06, HEAD `a24ebc3`, LIVE)
  Bloco `MetaAttribution` read-only no topo da ficha `/contacts/[id]`. `Contact.attribution` + mapeamento já existiam; loaders server-side em `lib/contacts/detail.ts`.

- **CT-3 · Tag automática da linhagem (c4.3)** `[POR FAZER]` `P?`
  `contacts` não tem coluna `tags`. Mexe no modelo de tags + edge `automation-meta-leads` (aplicar "Meta Ads: <campanha>"). Ligado à regra origem-obrigatória.

- **CT-AUTO · Auto-preenchimento de campos + motor de follow-up "nunca perder uma lead"** `[EM CURSO]` `P1` (CAPTURE 01/06; modelo afinado com o João 08/06)
  ✅ **Fase 1 FEITA e VERDE em produção (08/06, `de1867f`, migração `20260608150000`):** trigger BD `BEFORE INSERT` em `contacts` preenche `custom_fields.quarter` (ex. "Q2 2026") + `custom_fields.lastActivityDate` (data de entrada, hora de Lisboa) em TODOS os caminhos de criação (manual/webhook Meta/import/criar-do-negócio). Só preenche chaves em falta (valor explícito ganha). **Decisão de arquitectura: 1 trigger BD > repetir lógica em 4 sítios.** Verificado (insert auto-preencheu + respeitou valor explícito; testes apagados).
  **▶️ Fase 2 — MOTOR DE FOLLOW-UP (centrado no NEGÓCIO, não no contacto). Modelo do João (08/06, verbatim afinado):**
   - As "leads paradas" são **negócios abertos na 1ª etapa** (dado real 08/06: **482 abertos, só 3 com toque, 479 sem nenhum**; tudo encalha em "Oportunidade"). `deals.status='open'` literal em quase todos (etapa por defeito); 1 só em etapa real.
   - **Dois grupos:** **Oportunidades** (ainda por trabalhar) vs **Leads** (já contactadas). O **relógio só conta ao 1.º toque real** ("colocar a zero" as 482 — não alertar todas de uma vez).
   - **Prioridade + JUSTIÇA "nunca perder nenhuma":** a leva diária mostra primeiro as de **maior probabilidade** (v1 = sinal simples: etapa do funil + recência; o scoring a sério é o DASH-2), MAS com rede de segurança — cada lead tem de ter **pelo menos 1 contacto por período**; as que se aproximam do limite são forçadas para a leva mesmo frias. Mecanismo = **leva rotativa com cap + cooldown** (volta ao fim do período → garante o "≥1 contacto/período").
   - **Adiar em vez de perder:** quando "perde" um negócio, **não** marca perdido — **adia** (default **6 meses**; escolhe 6m/1ano/data à mão na altura) → ressurge sozinho no fim para reavaliar.
   - **Cada lead da leva → tarefa "Retomar contacto" (chamada) + digest no Telegram.**
  **Spec v1 (João aprovou 08/06 "vamos assim, depois ajustamos") — ✅ CONSTRUÍDA:**
   - ✅ **Fase 2a (`a1229f1`, migração `20260608160000`):** config `organization_settings` (`followup_batch_size`=10, `followup_cooldown_days`=30, `followup_enabled`=true); RPC `deal_followups_due(p_org,p_batch,p_cooldown)` (SECURITY DEFINER — abertos não won/lost + não adiados [`snoozedUntil`] + fora do cooldown [`followupQueuedOn`] + parados ≥ cooldown; ordena etapa(desc)+recência(desc); "último toque"=max(deal_activity real, last_stage_change_date, created_at)) + wrapper `my_deal_followups_due()` (`get_user_org_id()`) + índice. **Verificado:** 285 negócios elegíveis hoje.
   - ✅ **Fase 2b (`9b452b2`, migração `20260608170000`):** edge `lead-followups` (espelha `cmi-watch`: X-Cron-Secret, skip-domingos, por-org, **nunca 500**) → chama a RPC, cria tarefa "Retomar contacto" (`activities`, type follow_up, deal+contact) por negócio, marca `followupQueuedOn=hoje` (cooldown, antes do Telegram p/ não duplicar), envia digest Telegram clicável; `mark_deals_followup_queued`; **pg_cron `lead-followups` `0 9 * * 1-6`** (jobid 13) + `system_automations` key `lead-followups` (em **/automacoes**, ON). **Verificado VERDE em produção** (leva=2 teste: 200 ok queued:2, 2 tarefas, Telegram entregue; revertido, produção limpa).
   - ✅ **Fase 2c (`6a996e7`) — VERIFICADA VERDE EM PRODUÇÃO (build `260608_1542`, desktop + mobile 375):** botão **"Adiar"** no `DealDetailModal` ao lado de Ganho/Perdido → `SnoozeDealModal` (clone do `LossReasonModal`, âmbar): 3m/6m/1ano (default 6m) ou data à mão + motivo → grava `custom_fields.snoozedUntil`+`snoozeReason`; badge "Adiado até DD/MM/AAAA" + "Reagendar"/"Retomar"; negócio NÃO é perdido. **Verificação real (Playwright, browser autenticado):** Adiar (6m)→`snoozedUntil=2026-12-08` na BD + badge + **o negócio saiu da leva** (`deal_followups_due` devolveu 0 para ele = prova de integração); Retomar→BD limpa (null/null); mobile 375 sem overflow, 0 erros consola; negócio de teste deixado intacto. tsc0 lint0 vitest510/5. **CT-AUTO Fase 2 = COMPLETA de ponta a ponta.**
  **▶️ CT-AUTO FECHADO (Fases 1+2a+2b+2c). Próximo na sequência do João: SOCIAL-INBOX.**
  **Capturado para iteração seguinte (NÃO agora — João: "depois ajustamos"):** patamares por TEMPERATURA com **email automático a cada 30 dias para as muito frias** (a tal automação a desenhar com o João) + cadências/tipos de toque diferentes por patamar; separação visual explícita Oportunidades-pool vs Leads-pool; página `/seguimentos` com a leva do dia; lead-scoring a sério (DASH-2). Liga ao engine, a [[regra-automacoes-no-crm]] e a AGENDA-1.

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
  **Fase 1 FEITA (01/06, verificada em produção):** botão "Ver dados" por anúncio no /anuncios → drawer `AdDrilldownDrawer` (`/api/meta-ads/ad/[id]/drilldown`) com criativo+copy (busca à Meta via `getAdCreativeCopy`, cacheia em `ad_creatives.title/body/cta_type`), métricas vitalícias, e listas de **leads (contacts) e negócios (deals) atribuídos** por `attribution.ad_id`. Verificado live: métricas reais (25,11€/59 leads), listas vazias (campanhas em pausa).
  **✅ Fase 2 FEITA (03/06, migração `20260603100000`, LIVE):** vista em **árvore Campanha→Conjunto→Anúncio** no /anuncios (botão Tabela/Árvore). RPC `meta_ads_performance` passou a devolver `adset_id/adset_name`; componente `AdTree` agrupa e soma **totais por nível** (Gasto/Leads/CPL/ROAS), colapsável (campanhas abertas, conjuntos fechados); o anúncio-folha mantém miniatura+veredicto+drill-down+editar. Maqueta aprovada (`docs/mockups/ma-drilldown-tree.html`). **Resta (menor):** (a) copy de criativos dinâmicos (asset_feed_spec.titles/bodies — hoje só lê creative.title/body/object_story_spec) no drill-down. (b) **MA-LIGHTBOX-FULL (João 03/06):** ao clicar na miniatura o lightbox abre a **mesma resolução pequena** (`thumbnail_url`) — devia abrir a **imagem cheia** para se ler o criativo. Usar `ad_creatives.image_url` (já existe) no lightbox quando disponível, com fallback ao thumbnail; aplica-se à tabela E à árvore (mesmo `setLightbox`). Trivial.
  Drill-down por anúncio (lista de leads/negócios + € efectivo), guardar+mostrar copy/headline/CTA do criativo (`ad_creatives` ganha title/body/cta), vista em árvore Campanha→Conjunto→Anúncio. Núcleo: medir qual criativo dá dinheiro. (origem: CAPTURE MA-DRILLDOWN)

- **MA-EDIT-FULL · Gestão completa de anúncios no CRM (criar/editar/duplicar como na Meta)** `[EM CURSO — Tiers 1+2+3 feitos]` `P?` (CAPTURE 03/06, ideia do João)
  Visão do João: fazer no CRM **tudo o que a Meta permite** para montar e gerir anúncios, sem abrir o Ads Manager. **Sequência decidida (programador, 03/06):** Tier 1 copy → Tier 2 imagem/vídeo → Tier 3 duplicar A/B → Tier 4 builder (constrói os 2 pipelines fundacionais: A=escrever criativo, B=escrever estrutura).
  **✅ Tier 1 — Editar copy FEITO (03/06, commits `7d22042`+`8e7f835`+`48b108a`, LIVE):** no drill-down do `/anuncios` botão **"Editar texto"** (Título/Texto/CTA) → cria criativo novo (clona `object_story_spec`, poda campos eco read-only via `sanitizeStorySpecForCreate`) + aponta o anúncio ao criativo novo. Acção `update_copy` em `/api/meta-ads/edit` (admin+org-scoped+`assertAdBelongsToOrg`+`audit_logs` `META_AD_COPY_UPDATE`, nunca 5xx). UI: `EditCopyPanel` (aviso âmbar "volta a revisão + reinicia aprendizagem" + passo de confirmação). Helpers puros testáveis (`extractCopyFromCreative`/`analyzeCreativeForEdit`/`applyCopyToStorySpec`/`sanitizeStorySpecForCreate`/`metaErrorMessage`) +20 testes. Maqueta `docs/mockups/ma-edit-copy.html`.
    **Verificação real (produção, Playwright):** UI+aviso+confirmação OK; **guard de criativo dinâmico** OK (mensagem PT graciosa, sem crash, sem audit); **pipeline de escrita VALIDADO pela Meta** num anúncio editável real ("Valor da casa") — parou só no **gate de conta** "a Página não aceitou os **Termos da Geração de Leads**" (subcódigo 1892181), prova de request bem-formado. `metaErrorMessage` passou a surfar o detalhe da Meta + **dica accionável** para esse subcódigo. Falha sempre em segurança.
    **⚠️ AcçãoJoão p/ happy-path verde:** (1) **aceitar os Termos da Geração de Leads** no Gestor de Anúncios (Definições da conta > Termos e políticas), OU (2) testar num anúncio **não-leads e não-dinâmico**. **Descoberta:** quase todos os anúncios actuais são **criativos dinâmicos** (`asset_feed_spec`, vários textos) — esses **não** são editáveis pelo Tier 1 (mostram "chega num próximo tier"); só os de `object_story_spec` (link_data/video_data) são. **Capturado: MA-EDIT-DYNAMIC** (editar os textos de `asset_feed_spec` — titles[]/bodies[]) como extensão do Tier 1/2.
  **✅ MA-EDIT-DYNAMIC FEITO (03/06, commit `57f43fa`, LIVE+verificado VERDE):** editar os textos dos criativos **dinâmicos** (`asset_feed_spec`) — que são os que o João usa nos anúncios actuais (página verde, ToS aceite). `analyzeCreativeForEdit` ganha `kind` story/dynamic/none + lê as variações (`extractTextsFromAssetFeedSpec`); helpers puros `applyTextsToAssetFeedSpec` (substitui titles/bodies/descriptions, preserva imagem/vídeo/público/CTA, exige ≥1 título+texto) e `sanitizeAssetFeedSpecForCreate`; `updateAdDynamicTexts` cria criativo novo (`asset_feed_spec`+`object_story_spec` saneado) e faz swap. Rota `update_copy` ganha ramo dinâmico (arrays) + audit `creative_kind:dynamic`. Novo `GET /api/meta-ads/ad/[id]/edit-info`. UI: `EditCopyPanel` busca o edit-info e mostra editor de **listas** (`TextList`, add/editar/remover) nos dinâmicos. +12 testes. Maqueta `docs/mockups/ma-edit-dynamic.html`. **Verificação real (produção):** swap **VERDE** no "Imagens 1 form" (página verde) — `ok:true`+criativo novo+audit; revertido ao original. Desktop+mobile 375 OK. ⚠️ **As leituras da Meta são eventually-consistent** (~1 operação de atraso no read-after-write do criativo do anúncio).
  **✅ Tier 3 MA-DUPLICATE FEITO (03/06, commits `75d0c5a`+`3f1c09f`, LIVE+verificado VERDE):** no drill-down, **"Duplicar para testar"** cria uma cópia **em pausa** para testar uma variante A/B sem tocar no original (não reinicia a aprendizagem do vencedor). **Descoberta:** a Meta **não deixa 2 anúncios no mesmo conjunto de criativo dinâmico** (subcódigo 1885553) — por isso duplica-se ao nível do **conjunto** (`POST /{adset_id}/copies`, traz o anúncio dentro), que é a unidade A/B recomendada. `duplicateAd` (lê adset via `getAdLiveState`), `deleteAd`+`getAdAccountId` (desfazer com validação por conta), `graphDelete`. Rota: `duplicate_ad` (audit `META_AD_DUPLICATE`) + `delete_ad` (audit `META_AD_DELETE`, valida posse por `account_id` porque a cópia ainda não está em `ad_insights`). UI: `DuplicateButton` (confirmar → sucesso → **"Apagar cópia (desfazer)"**). **Verificação real (produção):** duplicar "Imagens 1 form" → conjunto novo em pausa (`ok`+audit); desfazer → apagado (audit); fluxo UI completo + mobile 375; **conta deixada limpa** (ambas as cópias de teste apagadas).
  **✅ Tier 2 — Imagem/vídeo FEITO (03/06, commits `17f5423`+`f45ced0`, LIVE+verificado VERDE):** no drill-down, botão **"Editar imagem/vídeo"** ao lado de "Editar texto". Dois passos: **(1)** rota nova `POST /api/meta-ads/ad/[id]/upload-media` (multipart, admin+org) envia o ficheiro à Meta (`adimages`→hash; `advideos`→id) **sem tocar no anúncio** (permite pré-visualizar; sem audit porque nada mudou no anúncio); **(2)** acção `update_media` em `/api/meta-ads/edit` troca a media no `asset_feed_spec.images[{hash}]` (dinâmico) ou `object_story_spec.link_data.image_hash`/`video_data.video_id` (simples), cria criativo novo + swap + `audit_logs META_AD_MEDIA_UPDATE`. Helpers puros testáveis `applyImageToStorySpec`/`applyVideoToStorySpec`/`applyImageToAssetFeedSpec`/`applyVideoToAssetFeedSpec` + `mediaFromCreative` + uploads `uploadAdImage`/`uploadAdVideo` (FormData) em `write.ts` (+13 testes → 42 no total). UI: `EditMediaPanel` (media actual→dropzone com pré-visualização, "Enviada à Meta ✓", aviso âmbar "reinicia aprendizagem; textos/público/CTA mantêm-se", confirmação, audit). `edit-info` estendido com `media`. Maqueta `docs/mockups/ma-edit-media.html`. **Verificação real (produção, Playwright, builds `260603_1524`→`260603_1556`):**
    · **IMAGEM = VERDE fim-a-fim** (é o que o João usa, anúncios "Imagens 1 form"): upload à Meta pela UI (dropzone→"Enviada à Meta ✓") → swap no "Imagens 1 form" (página verde, dinâmico) com audit `META_AD_MEDIA_UPDATE` (`d0d6f64…`↔`868f68bc…`, criativos novos) → **revertido ao original** (edit-info confirma hash `d0d6f64…`; conta limpa). Repetido por API no build final, 4 swaps no audit, 0 só de imagem. Mobile 375 + desktop, **0 erros de consola**.
    · **VÍDEO = portão da Meta (não é bug do CRM) — investigado a fundo (03/06):** o **upload de vídeo FUNCIONA** (`advideos` devolve id; testado, "Enviado à Meta ✓"), mas **criar o criativo com vídeo** dá **"(#3) Application does not have the capability"**. Testado o **fluxo real** (vídeo NOVO carregado pela própria app, 640×640 h264) → **mesmo `(#3)`** → logo NÃO é a questão de "vídeo emprestado/não-próprio": é uma **capacidade da Marketing API para criar criativos de vídeo** que a app ainda não tem (a criação de criativo de **imagem** passa na mesma conta/token). O CRM trata com **mensagem PT graciosa**, **sem crash, sem audit, sem alterar o anúncio** (verificado: anúncio de vídeo intocado; `audit_logs` só tem entradas de imagem). **Caminho legítimo confirmado no painel Meta (03/06, visto no browser do João):** o `ads_management` **já está em Standard access** (por isso a imagem passa); o gate do vídeo é o **"Marketing API Access Tier" = "Limited access"**. Subir para **"Full access"** exige (App Review → Permissions and Features → Marketing API Access Tier → **Upgrade**): **(1) Business verification** do negócio "João Fonseca" `761569255551287` (por fazer), **(2) App Review** (por fazer), **(3) ≥500 chamadas Marketing API com erro <15%** (parte do erro já verde; volume ~262). É processo do João (verificação de negócio + submissão), demora dias. **Por confirmar a 100% que "Full access" destrava o vídeo** (alta probabilidade — `(#3) capability` é o erro clássico de tier baixo); plano B barato antes de avançar com a verificação: diagnóstico que mostra o erro cru completo (subcódigo+fbtrace) do create de vídeo. Até lá, vídeo edita-se no Gestor de Anúncios; **imagem + copy editam-se no CRM**. (Nota: os ficheiros de teste ficaram como assets não usados na biblioteca da conta — inócuos, não bloqueiam nada.)
  **Falta (próximo tier):** (d) **Tier 4 MA-CREATE/builder** (campanha→conjunto→anúncio de raiz; sobrepõe-se a MA-CREATE do [[MKT-STUDIO]]). Reusa `lib/integrations/meta/{write,server}.ts`, `audit_logs`, Brand Kit + `/criativos`. Sempre confirmação + registo. **Fast-follows do Tier 2 (capturados):** (i) usar o **arquivo de criativos `/criativos` + Brand Kit** como fonte de media (em vez de só upload do dispositivo); (ii) **activar a capacidade de vídeo da app Meta** (App Review da Marketing API) para o swap de vídeo passar — quando o João quiser anúncios de vídeo editáveis aqui.
  **Nota Meta (conta do João):** os anúncios de **leads** só gravam copy se a **Página** tiver aceite os **Termos da Geração de Leads** (subcódigo 1892181). A página verde "João Fonseca" está aceite (por isso o swap dinâmico passou). Anúncios antigos de outras páginas/portfólios falham até essas aceitarem.

- **MA-LEADFORM · Criar o formulário de leads (instant form) da Meta a partir do CRM** `[EM CURSO — backend verde]` `P?` (CAPTURE 03/06, ideia do João)
  ✅ **DE-RISCO VERDE (03/06):** backend `createLeadForm` (`lib/integrations/meta/leadforms.ts`) + rota `POST /api/meta-ads/leadform` (admin+org+audit `META_LEADFORM_CREATE`). Probe inicial deu `(#200) pages_manage_ads` → acrescentei o scope (config.ts) → **João reautorizou** → re-probe **`ok:true`, form_id `1514221766877616`** (DRAFT). **Criar formulário a partir do CRM FUNCIONA.** Telefone garantido (proveniência). **Falta:** UI (editor de perguntas+privacidade+agradecimento+pré-visualização), listar/eliminar formulários, e ligar o form ao anúncio (MA-CREATE/Tier 2). Apagar o DRAFT de teste "TESTE CRM (rascunho)".
  Hoje o CRM só **recebe** leads de formulários criados na Meta; o João quer **criar o próprio formulário aqui** (como faz no Gestor). **Buildável:** Meta Leadgen Forms API `POST /{page_id}/leadgen_forms` (nome, `questions`, `privacy_policy`, `context_card`, `thank_you_page`/`follow_up_action_url`, `locale`) → devolve `leadgen_form_id` → ligar ao criativo do anúncio (`object_story_spec.link_data.call_to_action {type:'SIGN_UP', value:{lead_gen_form_id}}` e/ou `promoted_object`) reusando o pipeline de criativo do Tier 2 (`write.ts`). Provável portão de acesso da Meta (mesmo tier/permissões `leads_retrigeval`/`pages_*`/Marketing API Full) — confirmar ao construir. Respeitar [[regra-lead-tag-proveniencia-obrigatoria]] (pedir telefone obrigatório no form). UI: editor de perguntas + privacidade + agradecimento, com pré-visualização. Encaixa no **Tier 4/MKT-STUDIO** (builder de raiz: campanha→conjunto→anúncio→**formulário**). Sempre confirmação + `audit_logs`.
- **MA-CREATE · Construtor de anúncios de raiz no CRM ("Novo anúncio", à medida do João)** `[EM CURSO — Fases 1+2+3 feitas + Fase 4 parte construível (criar Formulário) feita; falta CAPI (bloqueado no João)]` `P?` (CAPTURE 03/06, spec detalhada do João — é o Tier 4 do MA-EDIT-FULL)
  ✅ **Fase 4 — parte construível (criar Formulário no CRM, MA-LEADFORM UI) COMPLETA e verificada VERDE (04/06, `5b69958`+`16a0982`+`1af7231`):** no passo 3 (destino Formulário) o selector ganhou **"+ Criar formulário novo"** → editor compacto (nome; o que pedir [telefone sempre + Nome/Email/Cidade/Código postal/Morada]; introdução; agradecimento; política de privacidade; site de seguimento — URLs pré-preenchidos do link externo). Reusa `POST /api/meta-ads/leadform` (DRAFT, telefone garantido) e **insere o form novo na lista (optimista, Meta é eventually-consistent) + selecciona-o** para o ligar ao anúncio. Maqueta `docs/mockups/ma-leadform-novo.html`. **Aprendizado Meta:** `context_card` exige título → usa o nome do formulário quando não há headline (subcódigo `(#100)`); **os leadgen forms NÃO se apagam via API** (`Unsupported delete request`) → ficam como rascunho. **Verificação real (produção, build `260604_1046`):** criar formulário novo pela UI → fica logo escolhido → **criar o anúncio de formulário com esse form novo** (`120247579758900323`) VERDE + audit; 0 erros consola; campanha/criativo de teste apagados (forms DRAFT de teste ficam para o João apagar à mão). **CAPI = bloqueado no João** (setup dataset/token; ticket MA-CAPI). **Capturado (próximas iterações):** editor de formulários autónomo (listar/eliminar/pré-visualizar perguntas avançadas), derivar URLs do Brand Kit.
  ✅ **Fase 3 (Anúncio) COMPLETA e verificada VERDE (04/06, `bfc6ae6`+`b7c2c0c`):** passo 3 do `CreateAdWizard` — formato Imagem (upload à Meta reusa Tier 2), título/texto/descrição, **destino derivado da conversão** (Formulário: selector dos formulários reais da Página via `GET /api/meta-ads/leadforms`; Site: URL), **link externo "Ver mais"** (a Meta exige sempre), CTA (Saber mais/Inscrever-se/...), "Otimizar texto por pessoa ON" (chip). Rota `POST /api/meta-ads/ad` (cria criativo+anúncio em pausa, audit `META_AD_CREATE`) + `POST /api/meta-ads/upload-image` (genérica) + `GET /api/meta-ads/leadforms`. Helpers `buildAdCreativeStorySpec`/`createAdCreative`/`createAd` em `write.ts` + `listLeadForms` em `leadforms.ts` (+testes, 488/5). **Verificação real (produção, build `260604_1014`):** **anúncio de FORMULÁRIO criado VERDE pela UI** (`120247576184150323`: imagem 600×600 enviada à Meta, form "TESTE CRM (rascunho)", URL externo, SIGN_UP) + audit `META_AD_CREATE`; desktop 1280 + **mobile 375 sem overflow**; 0 erros consola; **conta deixada limpa** (todas as campanhas/criativos de teste apagados; lista confirma só campanhas reais do João). **Aprendizados Meta (de-risco pg_net):** anúncio de formulário exige **`destination_type=ON_AD`** no conjunto (subcódigo 1892040) **e** **link EXTERNO** no criativo, não a Página FB (subcódigo 1815316); criar criativo/anúncio de imagem NÃO tem o portão `(#3)` do vídeo. **Capturado (próximas iterações, NÃO executar já):** (a) destino **WhatsApp** no anúncio (CTA de mensagem — hoje o WhatsApp salta o passo 3); (b) formato **Carrossel** e **vídeo** (vídeo gated pela Meta); (c) ligar "Otimizar texto por pessoa" a standard enhancements/asset_feed_spec; (d) **derivar o link externo do Brand Kit/site da org** (hoje o utilizador escreve-o).
  ✅ **Fase 1 (Campanha) FEITA e verificada VERDE (03-04/06, `19ad9f4`):** botão **"Novo anúncio"** no `/anuncios` → `CreateAdWizard` (passo 1: objectivo Leads/Tráfego/Interação + nome + defaults travados [Imobiliário/Portugal/orçamento no conjunto/sem partilha 20%/Leilão] + aviso "em pausa"). Rota `POST /api/meta-ads/campaign` (objectivo→OUTCOME_*, status PAUSED, `is_adset_budget_sharing_enabled=false`, audit `META_CAMPAIGN_CREATE`, nunca 5xx). **Verificação real (produção):** criar campanha pela UI → `ok` + audit `OUTCOME_LEADS` → **apagada** (conta limpa); desktop + mobile 375, 0 erros de consola. **✅ Fase 2 (Conjunto) COMPLETA e verificada VERDE (04/06, `62c8abe`):** UI do passo 2 no `CreateAdWizard` (passo 1 "Continuar" cria a campanha→passo 2): **onde converter** (Formulário/Site/WhatsApp → `conversionToAdSetParams` mapeia optimization_goal/destination_type/promoted_object; Formulário mantém o caminho verde SEM destination_type), **orçamento diário** com mínimo da conta (2,59€, valida cliente+servidor), **localização** por pesquisa real (`GET /api/meta-ads/geo-search` → adgeolocation), **raio** (10/17/25/40 km), **público estimado** (`GET /api/meta-ads/reach-estimate` → delivery_estimate) e **Advantage+** (default). Rota `POST /api/meta-ads/adset` encadeada ao campaign_id (audit `META_ADSET_CREATE`, nunca 5xx, valida orçamento mín). Helpers puros `createAdSet`(estendido)/`conversionToAdSetParams`/`buildAdSetTargeting`/`parseEurosToCents`/`parseGeoSearch`/`parseReachEstimate`/`searchAdGeoLocations`/`estimateReach`/`MIN_DAILY_BUDGET_CENTS` em `write.ts` (+17 testes → 486/5). **Verificação real (produção, build `260604_0929`):** criar campanha→conjunto pela UI (Formulário, 5€/dia, Paços de Ferreira raio 17) → conjunto real `120247...` em pausa + audit; geo-search real (5 resultados) + estimativa real (~844 mil a 993 mil pessoas); desktop 1280 + **mobile 375 (sem overflow, 3 botões cabem)**; 0 erros de consola; **conta deixada limpa** (3 campanhas de teste apagadas via Graph DELETE/pg_net). **Aprendizados Meta (parâmetros, nenhum é #3):** conjunto sem CBO exige `is_adset_budget_sharing_enabled` (campanha) + `bid_strategy` (conjunto); **orçamento mínimo ~2,59€/dia** (subcódigo 1885272). **Falta:** **Fase 3 (Anúncio: criativo+destino+CTA via `createAd`, reusa Tier 2), Fase 4 (Formulário no anúncio [MA-LEADFORM] + CAPI).** Nota: Site/WhatsApp como conversão estão ligados mas só Formulário foi verificado verde (os outros podem precisar de píxel/número WhatsApp; surgem com erro Meta gracioso se a conta não estiver pronta).
  Botão **"Novo anúncio"** que monta campanha→conjunto→anúncio dentro do CRM, **simplificado** com os defaults do João (e que sirva qualquer consultor no futuro). **Spec do João (verbatim, a confirmar campo-a-campo na conta real):**
  - **Objectivo da campanha:** só **Leads, Tráfego ou Interação** (esconder Reconhecimento/Promoção app/Vendas). Tipo de compra: Leilão (default).
  - **Começar:** campanha nova; se for para duplicar/alterar → já existe (Tier 1/3).
  - **Campanha:** dar **nome**; **Orçamento no CONJUNTO de anúncios sempre** (não CBO); "Partilha até 20% do orçamento" = **nunca**; **Categorias = Imobiliário sempre**; **Países = Portugal sempre** (outros só se ele for à Meta).
  - **Conjunto:** nome; **Conversão**: localização da conversão (Vários: Site+formulários instantâneos / Site+chamadas / Form+Messenger; Única: Site / Formulários instantâneos / Messenger / Instagram / WhatsApp / Chamadas / App). **Conjunto de dados/Píxel** (ver CAPI abaixo). **Orçamento e horário**: orçamento diário (ex. 1,00€/dia; mostra limites diário/semanal). **Localizações**: cidade/localidade/morada (validar com a Meta) + **raio** + **estimativa de público atingido**. **Público Advantage+** (default).
  - **Anúncio:** nome; **Configuração**: Apenas uma imagem/vídeo OU Carrossel (Vários anunciantes = nunca). **Destino**: Site (URL) ou **Formulário** (gerar novo / usar existente — ligar ao MA-LEADFORM: ter formulários prontos no CRM que a Meta aceita). **Criativo**: conteúdos multimédia (imagem/vídeo — reusa Tier 2), Texto principal (+opções), Título (+opções), Descrição, "Otimizar texto por pessoa" (default ON), Apelo à ação (CTA).
  - **Monitorização/CAPI:** eventos do site (Pixel "João Fonseca Online" `226877513589288`), eventos da app (Foco Imo CRM `1245241880824863`), eventos offline ("João Fonseca Consultor" `1100522198262161`). **API de Conversões a registar (com a minha ajuda) — ticket próprio MA-CAPI.** Datasets vistos: Offline `1402843233647362`, Outlier Agency `1971121530507385`, Online `226877513589288`.
  - **Pós-criação:** perceber **onde ver e analisar estes dados** no CRM (liga ao `/anuncios` + analista IA).
  - **Pedido do João:** ao construir, **printar cada campo** da conta real para ele validar as opções; objectivo = montar o anúncio à medida dele com as mesmas possibilidades da Meta, mas simples e rápido.
  - ✅ **DE-RISCO FEITO (03/06, probe em produção): criar campanha NÃO é o portão do vídeo.** Probe `createCampaign` (PAUSED, OUTCOME_LEADS) → **`ok:true` + apagada** (conta limpa); o `(#3)` não apareceu, só faltava `is_adset_budget_sharing_enabled` (partilha de 20% que o João quer = `false`). **O builder é construível no tier actual, sem App Review.** Helpers `createCampaign`/`deleteCampaign` em `write.ts` (ficam); probe temporário removido. **CAPI** e **criar formulário** têm gates próprios (CAPI=setup dataset/token; form=`pages_manage_ads`, já tratado no MA-LEADFORM). **Sequência inteligente:** (1) de-riscar o gate de criação; (2) se gated → upgrade do tier primeiro; (3) construir o builder por fases com maqueta. Reusa `lib/integrations/meta/{write,server,leadforms}.ts` + `audit_logs`.
- **MA-CREATE-PUBLICAR · Passo de publicação no fim do construtor (Pausa vs Publicar, com confirmação forte)** `[FEITO]` `P1` (04/06, `47daec8`, LIVE+verificado VERDE — decisões do João: selector no fim + activar formulário ao publicar)
  ✅ Passo 3 ganhou selector **Deixar em pausa** (default) / **Publicar já**. Publicar abre **confirmação forte** que mostra o que vai ligar (campanha+conjunto+anúncio, formulário fica activo) + o **gasto/dia** + "tens a certeza?" + aviso de revisão da Meta. Ao confirmar, `setEntityStatus` põe campanha+conjunto+anúncio **ACTIVE**. Rota `/ad` aceita `publish`+`campaignId`; nunca 5xx (se a activação falhar, fica em pausa + aviso). **Aprendizado Meta decisivo:** os **leadgen forms saem ACTIVE** (a API ignora `DRAFT`) → publicar NÃO precisa de activar o form (já está); corrigida a cópia enganosa "rascunho" no editor. **Verificação real (produção, build `260604_1513`):** publiquei pela UI um anúncio de formulário (2,59€/dia) → confirmação correcta → `published:true`; o anúncio ficou **`IN_PROCESS`** (revisão da Meta, **não entregou → 0€ gastos**); **apagado de imediato**; nenhuma campanha real foi tocada (todas continuam PAUSED). 0 erros consola. **Capturado:** ligar o "Otimizar texto por pessoa", controlo de estado do formulário (a Meta cria-o ACTIVE; se um dia se quiser DRAFT real, é outro caminho).

- **MA-CREATE-CARROSSEL · Anúncio em carrossel (várias imagens) como na Meta** `[POR FAZER]` `P?` (CAPTURE 04/06, ideia do João — "só posso colocar uma imagem; se quiser fazer um carrossel como a própria Meta tem, cria essa opção")
  Hoje o passo 3 do builder só aceita **uma imagem** (formato fixo "Imagem", `object_story_spec.link_data` com 1 `image_hash`). O João quer poder escolher **Carrossel**: 2 a 10 cartões, cada um com imagem própria + título + (opcional) descrição + link/destino, e a ordem editável. **Buildável:** usar `object_story_spec.link_data.child_attachments[]` (cada cartão: `image_hash`, `name`, `description`, `link`, `call_to_action`) — para Formulário o CTA de cada cartão leva o `lead_gen_form_id` (mesmo padrão verde da Fase 3); para Site leva o link. Reusa o upload por cartão (`POST /api/meta-ads/upload-image`, já existe) e o `createAdCreative`/`createAd` (estender `buildAdCreativeStorySpec` para aceitar `childAttachments`). UI: no passo 3, segmento **Imagem | Carrossel** (a maqueta `ma-create-builder.html` já o mostra), e quando Carrossel, uma lista de cartões (adicionar/remover/reordenar, dropzone + título por cartão). De-riscar com `pg_net` (criar criativo `child_attachments` + anúncio em pausa) antes da UI. Liga a [[MA-ASSET-HUB]] e às fotos da angariação como fonte de imagens. **Vídeo no carrossel/anúncio fica gated** (capacidade da Marketing API, acção do João). Sempre em pausa + audit.

- **MA-PIXEL-OWNERSHIP · Confirmar PROPRIEDADE dos pixéis/datasets (não só acesso) — terreno alheio?** ✅ `[FEITO 11/06 — VEREDICTO: NÃO HÁ TERRENO ALHEIO]` (CAPTURE 08/06, preocupação do João — "tenho estes pixéis, o Outlier Agency foi uma agência com quem trabalhei; tens isto controlado ou pomos as bases em terreno alheio?")
  ✅ **Verificado 11/06 via Graph API** (`/{dataset}?fields=name,owner_business`, token do Vault por pg_net): os **4 pixéis/datasets** têm `owner_business` = **`761569255551287` "João Fonseca"** — Online `226877513589288`, Offline `1402843233647362`, **Outlier Agency `1971121530507385` (também é do João — a agência só trabalhou nele)**, Consultor offline `1100522198262161`. Bónus: `/{pixel}/agencies` = **vazio** nos 2 principais → nenhuma agência tem hoje acesso de parceiro aos pixéis. A base é toda do João; se a relação com agências acabar, pixel + histórico ficam dele. Nota técnica: pedir `owner_ad_account` nestes nós dá `(#200)` (portão do tier da app); `name,owner_business` lê bem.
  ⚠️ **Risco de ASSET OWNERSHIP.** A MA-CAPI envia (verificado, `config.ts:40`) **só** para `226877513589288` "**Pixel João Fonseca Online**" (o do João), usando o **token do João** + conta `act_522191299990135`. **NÃO** toca no `1971121530507385` "João Fonseca Outlier Agency" (dataset da agência). Mas **"ter acesso" ≠ "ser dono"**: um pixel criado por uma agência pode continuar **propriedade do Business Manager dela**, só **partilhado** com o João → se a relação acabar, perde pixel + histórico. **A FAZER (depois da sequência CT-AUTO→SOCIAL-INBOX→IMO-7→IA-7):** (1) confirmar no Business Manager → Definições do Negócio → Origens de dados → Conjuntos de dados que `226877513589288` é **PROPRIEDADE** do Business do João (`761569255551287`), não só "partilhado por Outlier Agency"; eu consigo confirmar via Graph API (leitura: `/{dataset}?fields=owner_business,name`). (2) Se estiver só partilhado → **pedir transferência de propriedade** OU criar dataset 100% do João e migrar a CAPI (1 linha em `config.ts`). (3) Mesmo exercício para Pixel/Página/conta de anúncios (garantir que a base toda é dele). Datasets vistos na conta: Online `226877513589288` (em uso), Offline `1402843233647362`, **Outlier Agency `1971121530507385` (nome enganador: 11/06 confirmou-se que TAMBÉM é propriedade do João)**, Consultor offline `1100522198262161`, app Foco Imo CRM `1245241880824863`. Liga a MA-CAPI, MA-ASSET-HUB.

- **MKT-MEASURE · Épico de Medição & Inteligência (Pixel + CAPI + funil das LP + orgânico/páginas → cérebro)** `[POR FAZER]` `P1` (CAPTURE 04/06, visão do João — "tudo o que crio, ads/publicações/páginas, rastrear e estudar padrões para entregar a quem tem mesmo interesse; nas LP/calculadoras medir quem entra, quanto tempo fica, onde para; olhar orgânico + ads + tudo na Meta")
  Distinção-chave (esclarecida ao João 04/06): o **Pixel** (browser) e a **CAPI** (servidor) servem para a **Meta optimizar e fazer remarketing** (e medir conversões), NÃO dão por si um painel de "tempo na página/onde desistiu" — isso é **analítica de funil própria**. Sub-peças:
  - **MA-CAPI · API de Conversões (servidor → Meta)** `[EM CURSO — fatia 1 feita]` `P1` — enviar eventos que só o CRM sabe (lead→cliente, negócio ganho com valor) ao dataset **"João Fonseca Online" `226877513589288`** para a Meta entregar a quem compra e a atribuição sobreviver a bloqueadores/iOS.
    **DECISÃO 08/06 (João): NÃO precisa de token novo** — reutiliza-se a ligação Meta já existente (token de longa duração no Vault, scope `ads_management`; o botão "Gerar token" foi escondido na versão nova do Gestor de Eventos, mas não é preciso). **Valor da conversão = comissão líquida** do negócio (mesmo cálculo do `/financeiro`). `action_source=system_generated`.
    ✅ **Fatia 1 (08/06, `71834b0`) — VERIFICADA VERDE EM PRODUÇÃO:** `lib/integrations/meta/capi.ts` (`buildCapiEvent` puro: hash SHA-256 email/telefone, valor+EUR, event_id dedup; `sendCapiEvents` nunca atira) + `lib/financeiro/commission.ts` (comissão líquida pura, espelha o `/financeiro`) + rota admin `POST /api/meta-ads/capi-test` (dispara 1 evento de teste com `test_event_code` reutilizando o token do Vault; audit `META_CAPI_TEST`) + `META_CAPI_DATASET_ID` no config. +19 testes (505/5), tsc0 lint0 build OK. **Código de teste do dataset: `TEST51462`.** **Verificação (08/06, browser autenticado do João, mesma origem):** `POST /api/meta-ads/capi-test {testEventCode:'TEST51462'}` → `200 {ok:true, events_received:1, error:null, value_euros:6250}`. **PROVA: o token de longa duração do Vault (scope ads_management) serve a API de Conversões — não é preciso token novo.** test_event_code → zero impacto em dados reais, conta intacta, 0€.
    ✅ **Fatia 2 — WORKER feito e VERIFICADO VERDE (08/06, `e12be6e`):** rota `POST /api/meta-ads/capi-forward` (espelha o padrão da `/analyze`: modo cron por `X-Cron-Secret`==`backup_cron_secret` OU admin autenticado; cliente service-role). Reencaminha negócios GANHOS recentes (`is_won`) ao dataset, reutilizando o token do Vault + o `capi.ts` provado; valor=comissão líquida; `action_source=system_generated`; idempotente (`deals.custom_fields.capi_forwarded_at`+`capi_event_id`); audit `META_CAPI_FORWARD`. **SALVAGUARDA: só ganhos há ≤7 dias** (a Meta rejeita mais antigos) → nunca dispara o histórico; limite 50/varredura. Modo verificação: admin `{dealId,testEventCode}` → reencaminha 1 negócio como teste (não marca). **Verificação (08/06, browser autenticado, mesma origem):** 9 negócios reais → todos `200 {ok:true, events_received:1}` (valor 0€ porque esses negócios têm valor 0; o caminho do valor provado na fatia 1 = 6250€ aceite + testes unitários). tsc0 build OK. test_event_code → 0€, conta intacta.
    ✅ **Fatia 2 — TAIL (agendamento) FEITO e VERIFICADO VERDE (08/06, `64e38d1` + migração `20260608120000`):** pg_cron `meta-capi-forward` (jobid 12, `*/30`) chama a rota `capi-forward` com `X-Cron-Secret`=`backup_cron_secret` + linha em `system_automations` (aparece em **/automacoes**, ON). Migração aplicada via Management API do Supabase (o MCP nunca apareceu na sessão; João deu um Personal Access Token `sbp_…` por CLI/API, **a revogar a seguir**). **Verificação real:** disparo manual do cron → rota devolveu `200 {ok:true, forwarded:0}` (0 porque não há ganhos ≤7 dias — salvaguarda OK); `system_automations.last_run_ok=true`, `run_count` a subir; **cartão "Conversões para a Meta (negócio ganho)" visível em /automacoes (ON, */30, última corrida há 0m ✓)**. **MA-CAPI = COMPLETA de ponta a ponta (fatia 1 + motor + agendamento).** Liga a MA-CREATE (Fase 4) e ao analista IA.
    🔒 **Acção do João:** revogar o Personal Access Token do Supabase `claude-cli-capi` (supabase.com → Account → Access Tokens) — já não é preciso.
    📌 Captura: **unificar o cálculo da comissão** — `/api/deals/[id]/financeiro` ainda tem a fórmula inline; passar a usar `lib/financeiro/commission.ts` (fonte única) numa próxima passagem (não tocado agora para não mexer no caminho verde sem verificação em produção).
  - **MA-PIXEL-EVENTS · Pixel + eventos nas LP/calculadoras** `[ADIADO — gatilho do João]` `P2` — colocar o Pixel `226877513589288` + eventos padrão/à medida (ViewContent, Lead, CompleteRegistration, eventos de cada passo da calculadora) via GTM (`GTM-KK65ZDBS` já existe). Dá remarketing + sinais à Meta.
    ⏸️ **DECISÃO João 08/06 — NÃO fazer agora.** Só quando o João **integrar/melhorar as calculadoras e páginas DENTRO do CRM** (hoje vivem no portal-app). 🔔 **LEMBRAR/ALERTAR o João desta peça (e da MKT-FUNNEL-LP) quando ele mexer em calculadoras/landing pages/portal.** Até lá, não perder tempo aqui.
  - **MKT-FUNNEL-ANALYTICS · Analítica de funil PRÓPRIA no CRM** `[PARTE B FEITA]` `P2` — medir nas LP/calculadoras: quem entra, **tempo na página, scroll, passo a passo, onde abandona (o gargalo)**, conversão por passo. Eventos próprios (own beacon → tabela no Supabase) + painel no CRM. É o que responde ao "onde param". Independente do Pixel (o Pixel é para a Meta; isto é para o João decidir).
    ✅ **MKT-FUNNEL-CRM (parte B, funil DENTRO do CRM) FEITO e VERIFICADO VERDE (08/06, `7fec91b` + migrações `20260608130000`/`140000`):** página nova **/funil** ("Funil de Vendas") com dados que o CRM já tem. RPC `sales_funnel(board_id, from, to)` (SECURITY DEFINER, org via get_user_org_id, reaproveita a lógica de etapas/tempo do honest_metrics) → funil por etapa (conversão + fugas, maior buraco a vermelho), tempo médio por etapa (gargalo), motivos de perda, KPIs (negócios no funil, valor em aberto, taxa de fecho, ciclo médio). Filtro por funil (boards reais: Proprietários/Compradores/Arrendamento/Parceiros) + período 30d/12m/Tudo/**Personalizado (datas à escolha)**. `GET /api/funnel` + `features/funnel/FunnelPage.tsx` + nav "Funil" (desktop/tablet/mobile). Maqueta `docs/mockups/mkt-funnel-crm.html` (aprovada com ajustes do João: Mandatos→Compradores; período Personalizado). **Verificado em produção (browser autenticado):** troca de funil OK; Compradores 12m mostra a verdade — 105 em Oportunidade, só 2 passam (perdem-se 103), 0 em Visitas/Proposta/Escritura; KPI 240 abertos / 19,71 M€; casos vazios graciosos. **Bug corrigido:** "aggregate function calls cannot be nested" no tempo-por-etapa (faltava subquery per_stage) → migração `140000`. tsc0 lint0 vitest505/5 build OK. **PARTE A (funil das páginas/LP: beacon de passos/abandono) = ADIADA por decisão do João (08/06)** — só quando ele integrar/melhorar as calculadoras e páginas DENTRO do CRM. 🔔 **LEMBRAR/ALERTAR quando ele mexer em calculadoras/LP/portal.**
    🆕 **Detalhe pedido pelo João (08/06) — dois funis distintos:**
    (A) **Funil ANTES do CRM (anúncio→LP→formulário):** quantas leads novas entram e **de que anúncio** (já existe: atribuição por `ad_id` + /anuncios); **quantos NÃO preenchem / abandonam a meio do formulário / em que passo desistem / tempo na página / scroll**. Precisa de instrumentação nova (beacon próprio nas LP/calculadoras → tabela Supabase → painel). É a parte que ainda NÃO temos.
    (B) **Funil DENTRO do CRM (lead já existe):** **quanto tempo em cada etapa**, onde os negócios **encalham**, conversão etapa→etapa, **porque não fecham** (motivos de perda `loss_reason`). MUITO disto já é calculável com dados que o CRM já tem (`board_stages`, `last_stage_change_date`, `deal_activities`, `is_won/is_lost/loss_reason`; o dashboard já detecta "estagnados +10 dias"). Falta um **painel de funil de vendas** que junte: tempo médio por etapa, taxa de passagem, gargalo, motivos de perda agregados. Construível **sem instrumentação nova** (só leitura + agregação) — bom candidato a começar por aqui.
  - **MKT-ORGANIC-INSIGHTS · Orgânico + Páginas + publicações** `[FEITO v1]` `P3` — puxar insights da Página (Graph API: alcance, interações, melhores posts) para o CRM, a par dos ads.
    ✅ **v1 FEITO (08/06, `0812b9f`):** página **/organico** ("Orgânico — Página") com leitura **ao vivo** da Graph (sem tabela/cron — reusa a ligação Meta → token da Página). Melhores publicações (por interacção), interacção ao longo do tempo (por semana), por tipo de conteúdo, KPIs (posts, interações, média). `lib/integrations/meta/organic.ts` (`summarizeOrganic` puro +5 testes) + `GET /api/organico` (admin, `getPageAccessToken`) + `features/organico/OrganicoPage.tsx` + nav "Orgânico" (3 sítios). Maqueta `docs/mockups/mkt-organic-insights.html`. tsc0 lint0 vitest510/5 build OK. **VERIFICADO VERDE em produção (08/06):** 6 posts reais da Página em 90d, melhores publicacoes + interacao real + por tipo (photo/album); alcance a aguardar re-autorizacao; sem erros.
    📌 **Follow-ups capturados:** (a) **Alcance/impressões** — marcado "requer re-autorização" na UI; precisa do scope **`read_insights`** (o João re-autoriza a Meta em /settings → integrações → Reautorizar); depois acrescentar `/{page}/insights`. (b) **Instagram** — v1 é só Facebook Page; o IG precisa de ligar a conta IG Business à Página + usar `/{ig-id}/media`. (c) **Classificação por TEMA** (casos de venda / antes-depois / dicas / testemunhos) por IA — v1 agrupa por *tipo de media*; o tema é uma camada IA futura. (d) histórico próprio (tabela) se quiser tendência além dos posts do período. Liga ao analista IA e ao MKT-BRAIN.
  - **MKT-BRAIN · Cérebro de medição (juntar tudo + padrões)** `[FEITO v1]` `P3` — num sítio: ads (`/anuncios`) + orgânico + funil das LP, a IA estuda padrões. Liga a [[reference-meta-ia-2026-best-practices]] e ao analista IA. Liga a MA-LINKS e MA-ASSET-HUB.
    ✅ **v1 FEITO (08/06, `69f5265`):** página **/cerebro** ("Cérebro de Marketing") que junta as 4 fontes **ao vivo** (sem tabelas novas): **percurso completo** (investido→interações→leads/funil→ganhos/valor→ROAS), **"o que traz quem fecha"** (cruza `meta_ads_performance_admin`/`attribution.ad_id` com negócios ganhos; comissão líquida via `computeDealCommission`), e **padrões + acções pela IA** (motor Gemini→Claude existente, `Output.object`). `GET /api/cerebro` + `features/cerebro/CerebroPage.tsx` + nav "Cérebro". Maqueta `docs/mockups/mkt-brain.html`. tsc0 lint0 vitest510/5 build OK. **VERIFICADO VERDE em produção (08/06):** dados reais (759€ investido, 137→482 funil, 0 ganhos/0× ROAS no período) + IA diagnosticou correctamente "muitas leads, 0 conversões → gargalo no CRM", nomeando os anúncios reais a parar + acções (parar/corrigir/repetir/reforçar). 📌 menor: a IA larga alguns acentos (accao/conversao) — reforçar acentos no prompt/pós-processo (como noutras features).
    📌 **Follow-ups:** atribuição **orgânico→negócio** (links rastreáveis [[MA-LINKS]]); alcance (depende do `read_insights`); guardar histórico das análises. **MKT-MEASURE: CAPI + Funil(CRM) + Orgânico + BRAIN feitos; Páginas/Pixel adiado (gatilho do João).**
  > Decisão do João: isto começa **depois de o CRM estar pronto**. Capturado, não executar já. Por onde começar decide-se com ele (provável: MA-CAPI primeiro, porque destrava a medição de quem compra).

- **MA-ASSET-HUB · Central de activos do João (fonte única dos selectores)** `[POR FAZER]` `P?` (CAPTURE 03/06, ideia do João — "que grande ideia")
  Um local no CRM com **todos os activos** do João, para ele saber o que tem e para os **selectores do builder (MA-CREATE) irem buscar aqui** o que mostrar a escolher: **píxeis/datasets** (Online `226877513589288`, Offline `1402843233647362`, Outlier `1971121530507385`, Consultor offline `1100522198262161`), **formulários de leads** (lista da Página via API + os criados no CRM), **fotos/criativos** (Brand Kit + `/criativos` + **fotos das angariações** — ver MA-CREATE), **páginas/contas**, **links rastreáveis** (ver MA-LINKS). Cada activo: nome, id, estado, onde se usa. Liga a MA-CREATE (pickers), MA-LEADFORM, MA-CAPI, Brand Kit.

- **MA-CREATE (fonte de media) · Usar as FOTOS DA ANGARIAÇÃO como criativo do anúncio** `[POR FAZER]` `P?` (CAPTURE 03/06, ideia do João — "seria brutal")
  No builder/editor, ao escolher a imagem, poder **escolher directamente as fotos que já existem na angariação** (`imovel-fotos`, `listFotosByImovelId`) — enviar os bytes da foto à Meta (`adimages`) e usar como criativo, sem re-upload manual. Extensão do MA-EDIT Tier 2 (fonte de media) + MA-CREATE (passo do anúncio). Liga a [[MA-ASSET-HUB]] (as fotos da angariação são um activo).

- **MA-LINKS · Links rastreáveis por angariação (RE/MAX + domínio próprio com píxeis à escolha)** `[POR FAZER]` `P?` (CAPTURE 03/06, ideia do João)
  Em cada angariação, ter **dois links**: (a) o **link RE/MAX** com os dados do João; (b) um **link no domínio próprio** (`joaofilipefonseca.pt`) com **o(s) píxel(es) lá dentro**. Poder **escolher que píxeis/activos** carrega cada link (multi-pixel, GTM, CAPI). Objectivo: medir e atribuir o tráfego de cada angariação aos anúncios. Os píxeis/activos vêm da [[MA-ASSET-HUB]]. Liga a MA-CREATE (destino Site com URL rastreável), MA-CAPI, e ao GTM existente.

- **MKT-STUDIO · Estúdio de marketing completo no CRM** `[POR FAZER]` `P?`
  Sub-épicos: MA-CREATE (criar campanha/anúncio via API), criativos+carrosséis IA c/ Brand Kit, LPs imóveis+captação, posts sociais, documentos (cartas/apresentações/ACM-CMA). Reusa Brand Kit, `/criativos`, `/avaliar`. (origem: CAPTURE MKT-STUDIO)

- **MKT-SEQUENCES · Sequências de email (drip) nas automações** ✅ `[MVP FEITO 11/06 — Fatias 1+2 LIVE, verificado E2E em produção]` (CAPTURE 11/06, ideia do João — "boas-vindas, passado 3 horas sai outro, passado 1 dia sai outro…")
  **Fatia 1 (RGPD, commit `1951a35`):** `contacts.email_opt_out` + página pública `/unsubscribe` (confirma por botão; token HMAC do Vault `email_unsubscribe_secret`; POST `/api/email/unsubscribe` com comparação tempo-constante) + **TODOS os emails de automação levam rodapé** (anular subscrição + política de privacidade `organization_settings.privacy_policy_url` com fallback + header List-Unsubscribe); opt-out faz o envio devolver `skipped` sem partir a automação. Helper `lib/messaging/emailCompliance.ts` (+8 testes; escape ilike para emails com `_`); cópia inline no átomo da edge `automation-execute` **v13 verify_jwt=false**. Migração `20260611150000`.
  **Fatia 2 (template, commits `ffcc54f`+fix):** template **"Sequência de boas-vindas (3 emails)"** em /automacoes/nova — lead nova com email → boas-vindas → espera ~3h → pergunta → espera ~1 dia → convite final; esperas `wait_humanized` (horário comercial PT, **nunca Domingos**); filtro só-com-email; **nasce em rascunho** (o João edita os textos e activa). Maqueta `docs/mockups/mkt-sequences.html`. 🧠 Gotcha do motor: edge a seguir a `logic.filter` TEM de ter `sourceHandle:'pass'` (senão o ramo morre).
  **Verificado E2E em produção 11/06:** automação criada pela UI + activada → contacto teste → **email 1 enviado a sério** (Resend id `de9d376c…`, na caixa do João) → execução waiting (retoma respeitou horário) → `/unsubscribe` real anulou (BD `email_opt_out=true`) → **email 2 ficou `skipped: opt_out`** → token inválido recusado com mensagem graciosa. Teste limpo (automação+contacto apagados, schedules cancelados, 0 opt-outs).
  **Iterações capturadas (não fazer sem ordem):** UI dedicada de sequências (mais simples que o builder), parar a sequência quando a lead responde (precisa de tracking de inbound), métricas de abertura/cliques por email, sequências por origem/segmento, gatilho `lead.meta_ads` específico.

- **SYS-FLOW · Automações de sistema com fluxo visível (como as outras)** ✅ `[FEITO 11/06, commit 5a478ac, verificado em produção desktop+mobile 375, 0 erros]` (ordem directa do João 11/06 — "devem continuar em sistema mas serem como as outras: vejo o fluxo, consigo mexer, e perceber como estão montadas ajuda-me a criar mais")
  Cada cartão de sistema em /automacoes ganhou **"Ver fluxo"**: passos numerados fiéis ao código de cada edge function/rota, com chips nos passos que usam **parâmetros ajustáveis** (editáveis no cartão, como o horário e o ON/OFF já eram). Registry `lib/automations/systemFlows.ts` (⚠️ manter em sincronia ao mexer nas edge functions). 10/10 automações mapeadas. Nota honesta no rodapé de cada fluxo: a lógica vive em código; mudar é pedir e o mapa actualiza.
  **+11/06 (mesma sessão):** secção Sistema ficou **colapsável** (carregar no cabeçalho minimiza, estado lembrado) para chegar rápido às automações do utilizador.

- **SYS-EDIT · ÉPICO — automações de sistema editáveis A SÉRIO no builder (juntar peça, apagar, mexer)** `[PLANO APRESENTADO 11/06 — aguarda "avança" do João]` `P1` (ordem do João 11/06: "já vejo mas não consigo mexer como nos meus, que junto mais uma peça ao fluxo ou apago ou faço o que me apetece")
  **Porque não é 1 commit:** as automações de sistema são CÓDIGO (edge functions), não grafos de nós — para o João lhes juntar/apagar peças no builder têm de ser **reconstruídas como grafos do motor**. O motor ainda não tem átomos de LEITURA de dados (só acções) — é o bloqueio nº 1.
  **Fase 1 — átomos de dados seguros:** `data.rpc` (chamar RPCs de leitura de uma whitelist, org sempre forçada server-side) e eventualmente `data.query` (select com whitelist de tabelas + filtro org obrigatório). Nos DOIS executores (lib + edge) + builder a conhecê-los + testes.
  **Fase 2 — converter uma a uma, por ordem de exprimibilidade** (cada uma: construir grafo fiel → correr em paralelo com a edge 1-2 dias → trocar o cron → apagar a edge): 1º `telegram-morning-brief` (RPC métricas + query frios + format + telegram), 2º `client-errors-alert`, 3º `lead-followups` (RPC leva + loop + create_task + telegram), 4º `cmi-watch` (motor de avaliação → talvez RPC própria). Ficam com badge "sistema" mas vivem no motor = **fluxo 100% editável no builder, juntar/apagar peças à vontade**.
  **Fase 3 — as não convertíveis ficam como estão** (fluxo visível + horário/parâmetros): `backup-weekly` (dump de 17 tabelas), `meta-insights-sync` (paginação Marketing API), `social-inbox-sync`, `meta-capi-forward` (hashing/Graph), ticks do motor (infra). Forçá-las a grafo seria pior e frágil.
  **Risco real:** são os crons de produção (briefing das 7h, leva das 9h) — daí o paralelo antes de trocar. Estimativa: Fase 1 = 1 sessão; Fase 2 = ~1 peça por sessão.

- **MKT-BIBLIOTECA · Biblioteca de Criação com a marca do João (o "Canva Pro turbinado por IA")** `[POR FAZER]` `P?` (CAPTURE 09/06, ideia do João; **+11/06: a biblioteca deve ter/usar a política de privacidade** — peças e páginas geradas saem com o link da política `https://joaofilipefonseca.pt/privacidade`; esclarecer com o João se também quer a política como peça-base editável na biblioteca)
  Um repositório vivo de **tudo o que se cria para vender**: imagens, prompts, ideias e conteúdos para **redes sociais (orgânico e pago)**, **comunicação de imóveis** e qualquer peça que aumente vendas. Referência mental = **Canva Pro, mas com IA é muito mais rápido e poderoso** — NÃO replicar todas as funções do Canva (a IA gera), mas ter uma **base já com a marca do João**: anúncios (ads), **carrosséis** com a brand, **landing pages** com a brand, **flyers** com a brand, e toda a comunicação que qualquer consultor faz, do mais básico ao mais "fora da caixa".
  **Núcleo = histórico + reuso:** cada peça fica guardada com **o que é, quando fiz, se postei, onde usei** → posso **duplicar, reutilizar e mudar só um detalhe**, e ver sempre tudo o que já fiz. Exemplo do João: "crio 10 imagens para ads, uso só 2 ou 3; as outras ficam lá guardadas para mais tarde poder usar ou não". Nada se perde, tudo é reaproveitável.
  Liga a: [[reference-brand-kit-schema]] (marca), [[reference-creative-archive-schema]] (`/criativos`, já tem 15 tipos + métricas + drawer — provável **fundação** desta biblioteca), [[joao-fonseca-brand]] (skill), MA-CREATE (usar a peça num anúncio), IMO-7 (copy/criativos por imóvel), MKT-STUDIO e MKT-SOCIAL (publicar + medir). Teste "serve qualquer consultor". **Decidir MVP com o João** (começar pelo arquivo reutilizável de imagens/ads de anúncios? ou incluir já carrosséis/flyers/LPs?). Alinhar copy/criativo a [[reference-meta-ia-2026-best-practices]].

- **MKT-SOCIAL · Publicação social no CRM (Meta + LinkedIn) com ciclo de aprendizagem** `[POR FAZER]` `P?` (CAPTURE 01/06, ideia do João)
  Compor publicações no CRM e publicar nas redes a partir daqui, **conteúdo pensado por plataforma**: **Meta** (Instagram + Facebook) num só clique com o mesmo conteúdo; **LinkedIn** como peça própria (rede diferente, linguagem/formato próprios — a IA adapta). Fotos carregadas OU geradas por IA (reusa `/criativos` + Brand Kit). Fluxo: rascunho → **pendente de validação do João** → 1 clique publica no(s) sítio(s) certo(s). **Histórico guardado no CRM**: o quê, onde, quando + **métricas** (visualizações, comentários, toda a interação) — "o que se faz no Meta e no LinkedIn, mas tudo aqui sem abrir 2 plataformas". A **IA analisa conteúdo+estratégia+resultados** e aprende (medir→aprender→melhorar): diz o que repetir/evitar/reenquadrar no mês seguinte. Alinhar copy/CTA com [[reference-meta-ia-2026-best-practices]] (criativo é o novo targeting; CTA a pedir DM). Teste "serve qualquer consultor": fácil, intuitivo, sem falhas. APIs prováveis: Meta Graph (IG/FB publishing) + LinkedIn API (revisão de permissões/escopos), tabelas `social_posts` + `social_post_metrics`, cron de recolha de métricas (em /automacoes). Liga a MKT-STUDIO (é o sub-épico "posts sociais" expandido) e ao analista IA existente (mesmo cérebro p/ orgânico).
  **Nuance do João (01/06):** além de publicar, **importar/detectar o que já está postado** (orgânico histórico) e analisá-lo **ao mesmo nível dos anúncios Meta** — o CRM é o assistente de conteúdos: diz **quando faz sentido renovar/trocar** um conteúdo (com base nas métricas e no histórico do que resultou, por canal). Marca pessoal do João ("marca lendária") como fio condutor. Reusa [[joao-fonseca-brand]] (skill) + Brand Kit.

- **MKT-BP-AUTOLEARN · Boas práticas Meta/IA sempre actualizadas (auto-aprendizagem)** `[POR FAZER]` `P?` (CAPTURE 01/06)
  A IA não fica presa ao doc `docs/meta-ia-2026-best-practices.md`: passo periódico (IA + web) que procura alterações/recomendações mais recentes e actualiza as práticas que alimentam o analista IA e a geração de copy. Fechar ciclo: resulta→continua, não resulta→repensa. Base: [[reference-meta-ia-2026-best-practices]].

- **SOCIAL-INBOX · Avisos de comentários/DMs do Facebook e Instagram que precisam de acção (IA prepara, João envia)** `[MVP MESSENGER LIVE COM DADOS REAIS]` `P1` (CAPTURE 03/06, ideia do João — "muito importante"; nº 2 da sequência travada)
  **✅ LIVE (09/06):** João re-autorizou a Meta → sync disparado → **25 conversas reais do Messenger** na Caixa Social (5 a responder, 1 ruído filtrado, 19 já respondidas, 5 avisadas no Telegram). Cron `social-inbox-sync` `*/15` a manter vivo. **POLISH CAPTURADO (não bloqueia):** (a) match DM↔contacto deu 0 — os nomes do Messenger não batem com os contactos do CRM por nome → melhorar com correspondência por **telefone/fuzzy/unaccent**; (b) **Instagram fast-follow** — os DMs do IG já aparecem no Business Suite; adaptar o sync para `?platform=instagram` (a permissão `instagram_manage_messages` está concedida; o endpoint pendurava por timeout no de-risco via pg_net, mas no edge/fetch deve ir); (c) comentários (FB/IG) ficam para v2; (d) App Review só para uso live 100% fora do círculo admin.
  **▶️ DECISÃO DO JOÃO (08/06): MVP = só DMs primeiro (Facebook Messenger + Instagram DM), as duas plataformas.** Comentários ficam para depois.
  **🔎 DE-RISCO COMPLETO E VERDE (08/06, Graph API, token re-autorizado pelo João):** ✅ scopes `config.ts` (`71ac9e2`) + **João re-autorizou** → token do Vault tem agora **`pages_messaging` + `instagram_basic` + `instagram_manage_messages` (todos `granted`, SEM App Review — modo dev, admin).** ✅ **Messenger LER funciona ao vivo** (`GET /{page}/conversations?platform=messenger` com page token → 5 conversas reais: Marco Marilinda, Cátia Cardoso, Catarina Vieira + ruído "Meta Maneger"; nome+snippet+data+message_count). ✅ **Messenger ENVIAR: permissão passa** (teste de envio a id inválido → `(#100) cannot send to this id` = erro de destinatário, NÃO de permissão → conseguimos responder na janela 24h). ✅ conta IG `@jfonseca.pt` (`17841458753844552`) lê-se (200). ⚠️ **IG conversas (`?platform=instagram`) PENDURA (timeout >20s)** — NÃO é permissão (granted) nem conta (lê-se): provável **setting do próprio Instagram** ("Permitir acesso a mensagens"/ferramentas ligadas) por activar. **CONCLUSÃO: construir MVP para MESSENGER já (sem App Review, ler+responder provados); INSTAGRAM = fast-follow** assim que o João destravar o acesso a mensagens no app do Instagram. **Página `104774959239895`; integração Meta `79df5ad9-5a6c-441c-b27c-111197a42bab`; token Vault `meta_oauth_token_79df5ad9-...`; page token via `getPageAccessToken`.** Webhook: campo `messages` (Page→Messenger) + `messages` do IG; janela 24h. **App Review só para ir 100% live (fora do círculo de admins/testers).**
  **✅ FATIA 1 CONSTRUÍDA (08/06, `1641d21`, migrações `20260608180000`+`190000`):** tabelas `social_conversations`/`social_messages` (RLS por org); rota Next `POST /api/social-inbox/sync` (modo cron `X-Cron-Secret` OU admin; nunca 5xx) que puxa as conversas do Messenger da Página (reusa `getPageAccessToken`+token do Vault+Graph), upsert idempotente, marca `needs_response` (última msg do contacto), liga ao contacto por nome + negócio aberto (best-effort), preserva status handled/ignored, e avisa no Telegram as novas (dedup `alerted_at`, regra do silêncio); separa ruído ("Meta Maneger"). **pg_cron `social-inbox-sync` `*/15` + `system_automations` (em /automacoes).** **A rota corre e chama a Graph correctamente (verificado: 200, tratou erro sem 5xx)**, mas o **token do Vault foi invalidado pela Meta (subcódigo 460, "sessão mudada por segurança")** entre o de-risco e o teste — provável causa: o João mexeu no app Instagram/Facebook (ao alterar o acesso a mensagens). **⚠️ ACÇÃO JOÃO: re-autorizar a Meta OUTRA VEZ (/settings → integrações → Reautorizar) — fazer a alteração do Instagram PRIMEIRO e a re-autorização POR ÚLTIMO, senão volta a invalidar.** Depois disso eu disparo o sync e confirmo as DMs reais (Marco/Cátia/Catarina) a entrar nas tabelas. **FALTA: Fatia 2 (rascunho da IA: gerar no tom do João reusando o motor + Contact360) + Fatia 3 (UI `/caixa-social` conforme a maqueta aprovada).**
  **🧭 UX (feedback João 08/06, `cccb63f`): a Caixa Social NÃO é item na barra lateral** — vive DENTRO de **Mensagens** como aba ("Conversas | Caixa Social", `MessagingTabs`, `?tab=social`); `/caixa-social` redirecciona para `/messaging?tab=social`. (João: "a barra está a virar uma lista de compras" — ver [[feedback-nao-inchar-barra-lateral]] + NAV-IA.) **Verificado VERDE** (abas, sidebar limpa, 3 painéis intactos, redirect, mobile 375, 0 erros).
  **✅ FATIA 2 (rascunho IA) + FATIA 3 (UI) CONSTRUÍDAS E VERIFICADAS VERDE (08/06, `ab399ca`):** **Fatia 2:** `POST /api/social-inbox/[id]/draft` gera a resposta no tom do João a partir da conversa guardada + contexto Contact360 (reusa getModelForFeature/runWithAIFallback/Output.object; a IA nunca envia; não precisa do token Meta). **Fatia 3:** página **`/caixa-social`** (`SocialInboxPage`) conforme a maqueta — lista de DMs a precisar de resposta (separa ruído) + conversa + painel de rascunho editável (Gerar/Outra versão, Copiar, Abrir no Messenger, Marcar tratada) + nav em 3 sítios (Layout/SECONDARY_NAV/FULL_NAV). Rotas `GET /api/social-inbox`, `GET /api/social-inbox/[id]`, `POST .../status`. **Verificação real (Playwright, conversa semeada e revertida):** UI lista+abre, contador "1 a precisar de resposta"; **rascunho da IA verde** ("Boa tarde! ...acerca do T2 em Paços de Ferreira... Quando lhe for oportuno..." — acentos certos, não inventa o preço, CTA, sem traços/placeholders); mobile 375 sem overflow, 0 erros consola. tsc0 lint0 vitest510/5. **SOCIAL-INBOX MVP Messenger = COMPLETO (Fatias 1+2+3). FALTA SÓ:** o João re-autorizar a Meta (preso pelo bloqueio de segurança de ~87 min do Facebook) para o sync puxar as DMs reais → depois disparar o sync e confirmar. **Instagram = fast-follow** (toggle "permitir acesso a mensagens" no app IG + re-testar). **App Review só para 100% live fora do círculo admin.**
  Detectar **comentários e mensagens (DMs) no Facebook e Instagram** que precisam de resposta/acção do João e **avisá-lo** (centro de avisos no CRM + Telegram para os urgentes — respeitar [[feedback-telegram-silencioso]]). A IA **prepara a resposta sugerida** (no tom do João, com contexto do anúncio/post/lead e do histórico do contacto, alinhada a [[reference-meta-ia-2026-best-practices]] — "DMs valem ouro"; CTA a puxar conversa). 🚨 **REGRA INEGOCIÁVEL DO JOÃO: a IA NUNCA envia — o João é que envia sempre.** Rascunho → o João revê/edita → 1 clique abre/responde (ou copia) — sem auto-send em nenhum caso (HITL total, ver `lib/ai/HITL`). **Liga** o comentário/DM ao contacto/negócio quando der (atribuição), e guarda no histórico/timeline. **APIs:** Meta Graph — webhooks de **feed/comments** da Página + **Instagram comments** + **messaging** (FB Messenger + Instagram DM); permissões `pages_manage_engagement`, `pages_messaging`, `instagram_manage_messages`, `instagram_manage_comments` (App Review provável). Reusa a infra de mensagens (`lib/messaging/`, edge `messaging-webhook-meta`) + o motor IA. Liga a MKT-SOCIAL e ao WhatsApp Inbox. Teste "serve qualquer consultor". **Decidir MVP com o João** (começar só por avisos+rascunho de DMs? ou incluir comentários já?).

- **MA-ANALYST-UX · Painel do analista colapsável + histórico das recomendações** `[FEITO 03/06]` (ver secção 🔎/estado; painel colapsável + gaveta de histórico de `ad_analyses`)`P?`
  No `/anuncios`, o painel **"Recomendações do analista"** deve: (a) **minimizar/expandir** (colapsável, com o estado guardado); (b) deixar claro que as recomendações **não se apagam** — vivem em `ad_analyses` (upsert 1 row/dia por anúncio). (c) **Histórico** consultável: ver as recomendações ao longo do tempo por anúncio (a série já existe em `ad_analyses`; falta a **vista de histórico**) **mesmo depois de mudarem ou de o João as dispensar** — guardar/mostrar dispensadas em vez de só esconder. Liga ao analista IA existente (MA-B2.3).

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
  **✅ Documento CMI (02/06, `8aadaef`, LIVE):** "Contrato de Mediação (CMI)" adicionado ao dropdown de Documentos do imóvel (`KIND_OPTIONS` + `ALLOWED_KINDS` + `DocumentoKind`/`DOC_LABEL`) — o contrato carrega-se e vê-se na própria ficha do imóvel. Futuro possível: ligar o documento ao registo `imovel_cmi` (campo `documento_id`, como o mandato).
  **Fase 2b (P1) ✅ COMPLETA (02/06):** automação periódica que, perante **falta de negócios/visitas/propostas** e proximidade do fim do CMI, **alerta** com acção/estratégia sugerida.
   - **✅ Passo 1 FEITO (02/06, HEAD `b809e93`):** motor puro `lib/imoveis/cmiWatch.ts` `evaluateCmiWatch(input, thresholds)` → `{shouldAlert, severity, reasons[], sugestao}` (alerta se fim ≤15d/expirado OU imóvel parado = sem visitas+sem propostas; gravidade alta/média/baixa; limiares `CMI_WATCH_DEFAULTS` alertaFimDias=15/semVisitaDias=21). +8 testes.
   - **✅ Passo 2 FEITO (02/06, migração `20260602180000`, LIVE+testado):** **edge function `cmi-watch`** (Deno, service-role, espelho de `telegram-morning-brief`, verify_jwt=false, auth `X-Cron-Secret`=`backup_cron_secret`) percorre CMIs `activo=true` por org, calcula sinais (deals/visitas/propostas/dias-sem-visita, réplica de `getImovelAcompanhamento`), corre o motor (cópia inline — runtimes Deno≠Next impedem import partilhado; manter em sync com a fonte testada) e envia **digest Telegram por org** dos imóveis em risco (gravidade🔴🟡⚪ + motivos + sugestão + link), com **dedup diário** via coluna `imovel_cmi.last_watch_alert_on`. Registada em **`system_automations`** key `cmi-watch` (`/automacoes`) + **pg_cron `0 9 * * 1-6`** (seg-sáb 09h, **nunca domingo** [[nunca-domingos]]); `skip_sundays` no código também. **Verificado em produção:** disparo real → `alerted:1` + Telegram entregue; 2.º disparo → `alerted:0` (dedup); sem secret → 403. Seed de teste revertido. ⚠️ `deals.imovel_id`=0 hoje → o sinal "sem negócios" reflecte isso até ligar negócios a imóveis.
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

- **PREFS-1 · Preferências do utilizador persistidas na conta (arranque + tema)** `[FEITO]` (03/06, migração `20260603130000`, LIVE)
  ✅ **Guardado na conta** (`profiles.landing_page` + `profiles.dark_mode`), sincroniza desktop+mobile. **Página de arranque:** cartão "Preferências" no perfil (select Dashboard/Contactos/Imóveis/Anúncios/Financeiro/Automações); o login redirecciona para ela (fallback `/dashboard`). **Tema:** o cartão escolhe claro/escuro (aplica já + grava); o **toggle do header também grava na conta**; ao carregar o perfil o tema da conta aplica-se **1× pós-montagem** (`themeSyncedRef` no `Layout`) → **sem mismatch #418** (mantém default determinista + localStorage como cache). `ThemeContext` ganhou `setDarkMode`. Rota `PATCH /api/profile/preferences` (valida landing_page contra allowlist). Componente `features/profile/PreferencesCard.tsx`.

- **UX-1 · NAV-IA — agrupar sidebar em 6 famílias** `[POR FAZER]` `P?`
  16 itens → 6 grupos colapsáveis (Início/Comunicação/CRM/Imóveis/Marketing/Sistema). Confirmar famílias com o João. Nota: aplicar também à nova gaveta mobile (FULL_NAV). (origem: CAPTURE NAV-IA)

- **UX-2 · Custom fields em folders + prefixos consistentes** `[POR FAZER]` `P?`
  Organizar os 43 campos em folders (LP_/CP_/CV_ à la GHL). (origem: GHL Custom Fields)

- **UX-3 · DealCard mostrar custom fields (tipologia/zona/crédito)** `[POR FAZER]` `P?`
  Hoje workaround via tags. (origem: bugs/melhorias antigas)

### J. IA — performance e propagação

- **IMO-7 · Agente de Divulgação do Imóvel (orquestra a venda toda)** `[FEITO — Fases 1+2+3 verificadas VERDE em produção]` `P1` (CAPTURE 08/06; nº 3 da sequência travada — CONCLUÍDO 09/06)
  **✅ FASE 3 FEITA E VERIFICADA VERDE EM PRODUÇÃO (09/06, `5ed3e27`): plano de divulgação passo a passo.** Rota `POST /api/imoveis/[id]/divulgacao/plano` (texto, `workflow_desc`, `Output.object`, maxDuration 60) monta 5-7 passos accionáveis à medida do imóvel+comprador-alvo, cada um com `accao` (fotos/portais/anuncio/cruzamentos/acompanhar/nenhuma) que liga a zonas do CRM (anuncio→/anuncios, cruzamentos→/cruzamentos). Versão nova (coluna `plano`); GET devolve `planoVersions`. Componente: subsecção "Plano de divulgação" (lista numerada + CTA por passo + selector de versões). **Verificado (Playwright, T6 Seroa real):** plano à medida (1081 m², multigeracional, segmentação Porto/Guimarães/Santo Tirso), CTAs "Criar anúncio"+"Ver cruzamentos" presentes, PT-PT sem traços, v4+v5 persistidas (6 passos), mobile 375 ok.
  **🏁 IMO-7 COMPLETO: as 3 peças (comprador-ideal+copy / fotos por visão / plano) estão LIVE e verificadas.** Migração `20260609120000` (`imovel_divulgacao` versionada). Rotas `/api/imoveis/[id]/divulgacao{,/fotos,/plano}`. Componente `ImovelDivulgacao.tsx`. **Próximo na sequência do João: IA-7 (bot tutor + assistente 360).** Polish do SOCIAL-INBOX (match telefone/fuzzy + Instagram) continua capturado.
  **✅ FASE 1 FEITA E VERIFICADA VERDE EM PRODUÇÃO (09/06, `905d32d`, migração `20260609120000`):** secção "🚀 Agente de Divulgação" na ficha do imóvel. Rota `POST/GET /api/imoveis/[id]/divulgacao` gera comprador-ideal (perfis+ângulo) + copy dos 3 canais (RE/MAX completo, Idealista curto, Meta Ads com gancho + **CTA a pedir DM**), reusa motor IA (`workflow_desc`)+Brand Kit+dados do imóvel; **histórico versionado** (`imovel_divulgacao`, cada Gerar = versão nova, nunca sobrescreve — comparar + a IA aprende). Componente `ImovelDivulgacao.tsx` (comprador-ideal + tabs por canal + Copiar + selector de versões; dark+mobile). **Verificado em produção (Playwright, dados reais T6 Seroa):** v1+v2 geradas e persistidas, copy PT-PT pré-AO sem traços, não inventa, CTA DM no Meta, mobile 375 sem overflow, 0 erros novos. Modelo `claude-sonnet-4-5`. tsc0/lint0/vitest510/5.
  **✅ FASE 2 FEITA E VERIFICADA VERDE EM PRODUÇÃO (09/06, `17cbb66`+fixes `33724aa`/`c06558b`):** subsecção "Sequência de fotos" — rota `POST /api/imoveis/[id]/divulgacao/fotos` passa as fotos reais (URLs assinados) ao modelo `workflow_desc` (claude-sonnet-4-5, **visão**) + `Output.object`; devolve capa+ordem(motivo)+cortar(motivo), mapeia índices→ids, grava versão nova (`fotos_ordem`). GET devolve `fotosVersions` à parte. Componente: grelha ordenada (capa + nº + motivo) + bloco cortar + selector. **Verificado (Playwright, T6 Seroa real):** IA viu mesmo as imagens (motivos com churrasqueira/bilhar/lareira/deck), status 200 ~19s, v3 persistida, 11 miniaturas+capa, mobile 375 ok. **Aprendizados serverless:** rota fora de `app/api/ai/**` herda timeout curto → `export const maxDuration=60`; **NÃO descarregar bytes das fotos** (OOM com fotos grandes) → passar `{type:'image', image:new URL(signedUrl)}` (o provider descarrega). Nota: render fica vazio durante ~lag de leitura logo após o insert; em reload está correcto (via UI o gerarFotos popula logo o estado).
  **▶️ A SEGUIR: Fase 3 (plano de divulgação passo a passo).**
  Na ficha do imóvel, um agente que pensa **todo o processo de divulgação ao detalhe**: (1) **sequência de fotos** — diz qual a ordem/selecção que melhor resulta para vender; (2) **copy à medida do cliente-ideal** desse imóvel (cruza perfil do comprador-alvo) e gera **textos prontos por canal**: RE/MAX, Idealista, **Meta Ads** (alinhado a [[reference-meta-ia-2026-best-practices]]); (3) plano de divulgação passo a passo. Liga a: fotos da angariação (`imovel-fotos`), Brand Kit, MA-CREATE (anúncio), CONTACT-360 (cliente-ideal), MA-ASSET-HUB. Filtro: aproxima a venda mais rápida + mais leads qualificadas.
  **✅ Maqueta aprovada (09/06):** `docs/mockups/imo7-divulgacao.html` (dados reais do imóvel T6 Seroa). Vive como **secção/aba "Divulgação" dentro da ficha do imóvel** (não incha a barra — [[feedback-nao-inchar-barra-lateral]]).
  **▶️ DECISÕES DO JOÃO (09/06, não voltar a perguntar):**
   - **Faseamento:** Fase 1 = **Comprador-ideal + Copy dos 3 canais juntos** (mesma chamada de IA, reusa `getModelForFeature`/`runWithAIFallback`/`Output.object` + Brand Kit + público-alvo/zona/preço). Fase 2 = sequência de fotos. Fase 3 = plano passo a passo.
   - **Fotos (Fase 2):** a **IA analisa as imagens reais (modelo com visão)** — olha para cada foto e decide capa/ordem/cortes pelo conteúdo visual (servir fotos por URL assinado ao modelo). NÃO é só heurística textual.
   - **Persistência = histórico versionado:** cada "Gerar" cria uma **versão nova** (nunca sobrescreve); o João vê as anteriores e **compara diferenças**, e fica base de dados para a **IA aprender o que resulta** (medição vitalícia — [[feedback-medicao-vitalicia-e-ciclo]]). Tabela nova `imovel_divulgacao` (org-scoped, RLS, versão incremental por imóvel, jsonb p/ comprador-ideal + copy_canais + (futuro) fotos_ordem + plano).
  **Plano de execução:** Fase 1 = migração `imovel_divulgacao` + rota `POST/GET /api/imoveis/[id]/divulgacao` + componente na ficha (aba Divulgação: comprador-ideal + 3 canais com Copiar/Outra versão/Editar + selector de versões). Verificar em produção (rota service-role/IA não corre no npm local).
- **IA-7 · Bot do CRM = tutor + assistente pessoal 360** `[FEITO — Fases 1+2 verificadas VERDE em produção]` `P1` (CAPTURE 08/06; nº 4 da sequência travada — CONCLUÍDO 09/06)
  **✅ FASE 2 (Tutor) FEITA E VERIFICADA VERDE (09/06, `cf8a81f`):** o bot ensina a usar o CRM. "como faço para divulgar um imóvel?" → passos numerados + indica `/imoveis` → secção "Agente de Divulgação" (copy por canal, fotos, plano) + oferece levar lá. PT-PT. Implementado como **MODO TUTOR no system prompt de `app/api/ai/crm-agent/route.ts`** (a rota REAL do bot) com um mapa das áreas/rotas do CRM — a IA infere "como se faz" sem base curada a manter (decisão do João). **🏁 IA-7 COMPLETO (Fase 1 Assistente 360 + Fase 2 Tutor).**
  **🎉 SEQUÊNCIA TRAVADA DO JOÃO TODA CONCLUÍDA: CT-AUTO ✅ → SOCIAL-INBOX ✅ → IMO-7 ✅ → IA-7 ✅.** Próximo: João decide (priorizar o backlog; recomendado a passagem de QA a fundo + depois INT-1/DASH-2/UX-1, ou os épicos de marketing). Polish SOCIAL-INBOX (telefone/fuzzy + Instagram) continua capturado.
  **✅ FASE 1 (Assistente 360) FEITA E VERIFICADA VERDE EM PRODUÇÃO (09/06):** no bot `/ai`, escrever um nome OU descrição vaga → o bot identifica o cliente e dá o retrato (origem, negócios, link da ficha). **Verificado:** "fala-me da Marcia que veio do Idealista" → "Márcia Gumacante veio do Portal Idealista. Tem 1 negócio em aberto... ficha: /contacts/...". Tolerante a acentos.
  **🧠 APRENDIZADO CRÍTICO (perdi tempo nisto — registar):** o bot do `/ai` usa a rota **`/api/ai/crm-agent`** (ferramentas `tool()` INLINE próprias: searchDeals/getContact/getPipelineStats/...), **NÃO** a `/api/ai/chat` (que usa `lib/ai/crmAgent.ts` + `createCRMTools` de `lib/ai/tools.ts`). Editar `lib/ai/tools.ts` NÃO afecta o bot visível. A ferramenta certa é o **`getContact` em `app/api/ai/crm-agent/route.ts`**. (Diagnóstico via Claude-in-Chrome: `read_network_requests` mostrou o POST a `/api/ai/crm-agent`.)
  **Implementação:** migração `20260609160000` RPC `search_clients_fuzzy(org,query,limit)` (ranking por palavras + **unaccent**, sobre nome/origem/telefone/empresa/email/custom_fields; SECURITY DEFINER + search_path; grant authenticated+service_role). `getContact` reescrito p/ usar a RPC (fallback ilike) + devolver `retrato360` (DISC/gatilhos/negócios/última análise/link) + outros candidatos. Commits: `9583967` (fix real). (Antes, por engano, pus a mesma lógica em `lib/ai/tools.ts` searchContacts+findClientProfile — fica como melhoria dessa rota, inofensivo.) **Deploys Vercel com fila/atraso hoje (vários pushes seguidos); build no rodapé é a verdade; commit vazio fura a fila.**
  **▶️ A SEGUIR: Fase 2 (Tutor — a IA infere "como se faz" das rotas/ferramentas do CRM, sem base curada).**
  O bot que já existe no CRM passa a ter duas funções novas: (1) **tutor** — ensina a usar o CRM quando o João tem dúvidas ("como faço X?", "onde está Y?"), guia passo a passo; (2) **assistente pessoal** — a partir de um **contacto, nome ou só uma ideia/descrição**, diz **quem é o cliente e todo o histórico** (timeline, negócios, atribuição, DISC, próxima acção). Reusa CONTACT-360-AI (`getContact360Context`, `contact_ai_analyses`) + a timeline unificada + o agente do CRM (`lib/ai/crmAgent.ts`). Liga a IA-1 (copy IA em todo o lado).
  **✅ Maqueta aprovada (09/06):** `docs/mockups/ia7-bot-tutor-assistente.html`. Vive no **bot que já existe** (launcher global `AIAssistant.tsx` + página `/ai`), NÃO é item novo na barra.
  **▶️ DECISÕES DO JOÃO (09/06, não voltar a perguntar):**
   - **Faseamento:** Fase 1 = **Assistente 360** primeiro; Fase 2 = Tutor.
   - **Assistente 360 alcance:** além de nome/contacto exacto, **também por ideia/descrição vaga** ("o senhor de Paços que queria T3 para investimento") → procura difusa por zona/tipologia/trigger/etc. e propõe o cliente mais provável, depois mostra o retrato 360 completo.
   - **Tutor (Fase 2):** a **IA infere "como se faz" das próprias rotas/ferramentas do CRM** (sem base de conhecimento curada a manter).
  **Plano de execução Fase 1:** nova ferramenta no `crmAgent` (`lib/ai/tools.ts`) tipo `findClientProfile(query)` — procura difusa de contactos (nome OU zona/tipologia/trigger via `custom_fields`/`source`/deals) → escolhe o(s) mais provável(eis) → devolve o 360 (reusa `getContact360Context` + timeline + última análise `contact_ai_analyses`); o agente apresenta o retrato no chat (quem é, DISC, triggers, negócios, timeline, próxima acção, com link à ficha). Verificar em produção (Playwright; rota IA não corre local).
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
