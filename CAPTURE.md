# CAPTURE.md — Foco Imo

> Coisas detectadas mid-sessão que NÃO são o objectivo activo.
> NÃO atacar agora. Cada item é candidato a sessão dedicada (com Plan-First próprio).
> Pacto: "1 objectivo por sessão" → tudo o resto vem para aqui.

---

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

## T-001 · 3 testes só-de-teste destapados ao instalar @testing-library/dom (28/05/2026, Sprint 37)
- **Contexto:** instalar `@testing-library/dom` (commit cc69c36) fez os 12 ficheiros DOM voltarem a carregar (209→350 testes a passar). Isso destapou 3 falhas reais que antes estavam escondidas (os ficheiros nem carregavam). NENHUMA parte a app em produção, são todas de setup/expectativa de teste.
- **1) `features/inbox/components/CallModal.test.tsx`** — espera `tel:+5511999990000` mas o código formata `tel:(11) 99999-0000`. Expectativa desactualizada; além disso o `+55` é brasileiro (resíduo de template, CRM é PT). Decidir: alinhar teste ao formato real OU corrigir formatação do tel para E.164.
- **2) `features/boards/components/Modals/DealDetailModal.test.tsx`** ("hook order regression") — renderiza sem `QueryClientProvider`, logo `useQueryClient` (DealDetailModal.tsx:200) rebenta. Falta o wrapper no render do teste. Não é bug de produção (a app tem provider).
- **3) `test/stories/US-001-abrir-deal-no-boards.test.tsx`** — mesma raiz do #2 (falta provider à volta do boards/deal modal).
- **Recomendação:** sessão curta "higiene de testes" — wrap dos renders num helper com QueryClientProvider + decidir formato tel. Não bundlar com features.

---

> **Como usar:** quando o utilizador propuser feature/fix novo mid-sessão e estiver fora do objectivo da sessão activa, perguntar "CAPTURA ou agora?". Se CAPTURA, adicionar aqui com data e contexto suficiente para retomar sem perder informação.

---

## B-007 · Sweep PT-PT "Atividade(s)" → "Actividade(s)" (28/05/2026, Sprint 37)
- **Escopo medido:** 51 ocorrências em 28 ficheiros (grep `[A-Za-z'"> ]Atividade`).
- **Cuidado cirúrgico obrigatório:** só strings VISÍVEIS ao utilizador. NÃO mexer em identificadores `activities`, routes `/activities`, nomes de tabela/coluna, tipos/interfaces, chaves de API. Muitos matches estão dentro de prompts de IA (`lib/ai/tools.ts`, `crmAgent.ts`) — rever caso a caso.
- **Ficheiros com mais peso:** features/inbox (useInboxController 6, InboxPage 2), features/activities (vários), Layout.tsx 2, navConfig.ts 1, SettingsPage.tsx 1 (label "Atividades" no SelectField), DashboardPage 1, DealCockpit (real+mock), lib/supabase/activities.ts 4.
- **Recomendação:** commit/sessão próprios com verify isolado (tsc+lint+smoke + olho em routes). Não bundlar com features.
