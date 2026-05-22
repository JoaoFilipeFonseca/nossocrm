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

### B-004 · Bug template→callsite mismatch nos prompts BD
- O `task_deals_email_draft` (v2 inserido 17/5) tem variáveis `{{deal}}/{{contact}}/{{context}}` mas callsite passa `contactName/companyName/dealTitle` → variáveis ficam vazias no render.
- **Outros endpoints podem ter o mesmo bug**. Auditar todos os `getResolvedPrompt(...) + renderPromptTemplate(...)` para confirmar match de chaves.
- Esta sessão NÃO corrigiu — só refactor `rewriteMessageDraft` para não depender de placeholders.

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

### M-002 · Streaming UX (melhoria de percepção)
- Hoje: utilizador vê spinner 3-5s, depois texto inteiro aparece.
- Melhor UX: stream chunk-by-chunk com `streamText` em vez de `generateText` → primeiro char aparece em 500ms, completa em 3-5s. Sensação de instantâneo.
- **Trade-off:** stream não suporta `output: Output.object({schema})` directamente — precisa parse-as-you-go ou voltar a `text` puro + parse JSON manual.
- Sessão dedicada.

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

## ✅ Resolvidos esta sessão (22/05 noite)

- ~~Prompt caching infra cross-provider (`006dd8a`)~~
- ~~Prompt `rewrite_message_draft` v3 BD (pt-PT formal, exemplos do João, nunca Domingos, "oportuno")~~
- ~~Draft inicial passa a ser gerado por IA on-open (substituir templates pt-BR `Oi/Você/Abs/rapidinha`)~~
- ~~Race condition useEffect spinner infinito~~
- ~~UX 3-5s: truncar payload + race Gemini/Claude Haiku com cache real~~
- ~~309 linhas de código pt-BR removidas~~

---

> **Como usar:** quando o utilizador propuser feature/fix novo mid-sessão e estiver fora do objectivo da sessão activa, perguntar "CAPTURA ou agora?". Se CAPTURA, adicionar aqui com data e contexto suficiente para retomar sem perder informação.
