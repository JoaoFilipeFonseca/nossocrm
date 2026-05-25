# CAPTURE.md — Foco Imo

> Coisas detectadas mid-sessão que NÃO são o objectivo activo.
> NÃO atacar agora. Cada item é candidato a sessão dedicada (com Plan-First próprio).
> Pacto: "1 objectivo por sessão" → tudo o resto vem para aqui.

---

## 🐛 Bugs UI activos

### B-001 · Painel direito (Chat IA / Notas / Scripts / Ficheiros) come o espaço da área central no Inbox→Foco
- **Quando:** durante sessões de Claude Code (provavelmente sempre, mas é nessa altura que o João nota).
- **Sintoma:** painel direito ocupa ~30% da largura; área de actividades + composer fica espremida; texto "Nenhuma atividade" cai por baixo do botão WhatsApp/Email/Ag.Ligação.
- **Screenshot:** apresentado pelo João em 22/05/2026 noite.
- **Hipótese:** o painel direito deveria ser collapsível (drawer) ou ter `max-width` fixo. Provavelmente CSS grid/flex sem `minmax` nas colunas, e o conteúdo do Chat IA força expansão.
- **Files a inspeccionar:** `features/inbox/components/FocusContextPanel.tsx` (layout 3-col), eventual `AppShell` ou wrapper.
- **Fix esperado:** drawer recolhível para Chat IA OR ajustar grid template para `[main 1fr][side 320px]` fixo.

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

Após deploy, primeira visita continua a servir versão antiga via Service Worker cache. Sintoma: sidebar continua a mostrar build tag anterior. Workaround: hard refresh (Ctrl+Shift+R) OR Application → SW → Unregister.

**Fix futuro:** SW auto-update agressivo — implementar listener `controllerchange` no client + force `skipWaiting()` no SW para activar nova versão imediato após install. Sessão dedicada ~30min.

## ✅ Resolvidos esta sessão (22/05 noite)

- ~~Prompt caching infra cross-provider (`006dd8a`)~~
- ~~Prompt `rewrite_message_draft` v3 BD (pt-PT formal, exemplos do João, nunca Domingos, "oportuno")~~
- ~~Draft inicial passa a ser gerado por IA on-open (substituir templates pt-BR `Oi/Você/Abs/rapidinha`)~~
- ~~Race condition useEffect spinner infinito~~
- ~~UX 3-5s: truncar payload + race Gemini/Claude Haiku com cache real~~
- ~~309 linhas de código pt-BR removidas~~

---

> **Como usar:** quando o utilizador propuser feature/fix novo mid-sessão e estiver fora do objectivo da sessão activa, perguntar "CAPTURA ou agora?". Se CAPTURA, adicionar aqui com data e contexto suficiente para retomar sem perder informação.
