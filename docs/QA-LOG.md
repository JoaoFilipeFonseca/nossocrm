# 🧪 QA LOG — CRM Foco Imo (nossocrm)

> **Histórico único e vivo de TODAS as acções de teste.** Serve para saber sempre o que já foi
> testado, o resultado, e o que falta — sem repetir trabalho. **Actualizar ao fim de cada sessão de QA.**
> Detalhe narrativo de cada sessão fica nos handovers em `memory/` (índice em `memory/MEMORY.md`);
> aqui fica a MATRIZ de cobertura + bugs + pendências.
>
> Legenda: ✅ testado e verde · 🐞 bug encontrado (ver tabela de bugs) · ⚠️ achado de endurecimento
> (capturado, decisão pós‑22) · 🟡 parcial (carregado/smoke, falta exercitar a clicar) · ⬜ por fazer.

---

## 📍 Posição actual
- **Data:** 17/06/2026 · **HEAD origin/main:** `a37f3d7` · **build em produção:** `260616_1639`+. **Núcleo: QA de
  Definições escritas (Produtos/Metas/Unidades/Checklists/Equipa) + Visão de Gestor — TODAS FEITAS a clicar, escrita
  na BD confirmada, dados QA limpos, 0 erros de consola.** **Automações — activar REAL + disparar + CONTAR FEITO**
  (automação QA segura trigger→criar tarefa interna, sem envio): activar→executar→**bug real #17 (contadores nunca
  subiam)** corrigido por trigger de BD `20260617110000` e reconfirmado (0→1 totais). Dados QA limpos. **Falta do
  ponto 2: Mensagens enviar de verdade + marcar tratada** — é envio outward irreversível, precisa do destino de teste
  do próprio João (a confirmar antes de disparar). Depois: datas 18→22.
- **Data (anterior):** 16/06/2026 · **HEAD:** `196d5f7` · **build:** `260616_1225`+.
- **URL produção:** crm.joaofilipefonseca.pt · **Supabase:** `zcqbbqrdbszzkpydrlmz` · **org:** `29455d22-…`.
- **Verificação:** Playwright autenticado + Supabase MCP. `tsc 0 / lint 0 / vitest 550/5`.
- **Onde estamos no plano** ([[plano-rumo-22junho]]): QA TOTAL 1.ª passagem + testes funcionais a clicar
  + stress do processo central — FEITOS. Re‑passagem de profundidade em curso: **Mensagens/Caixa Social ✅**
  e **Imóveis COMPLETO ✅** (form 50+ campos, mandatos/proprietários/documentos, upload real de fotos,
  IMO‑7, NS‑3, delete‑cascade) feitos 15/06 — **1 bug real corrigido+deployado+reconfirmado (#12, órfãos
  no storage).** **As 4 áreas accionáveis de "O que FALTA" estão FEITAS** (Imóveis, Import CSV, Marketing
  [Biblioteca gerar+guardar / /anuncios / /organico], Exportações [reports PDF + contacts CSV]). Restam só
  tarefas com data: 18/06 lead nova ao vivo + remover Muhammad do BM; 19‑20 re‑passagens estados/segurança;
  22 fecho (copy pré‑AO, vitest, stress, relatório).

---

## ✅ Matriz de cobertura (o que JÁ foi testado)

| Área | Nível de teste feito | Resultado | Última sessão |
|---|---|---|---|
| **Percurso da lead E2E** (entra→board→tag→follow‑up→caixa social→funil/cérebro→CAPI) | Mapeado + verificado ao vivo | ✅ honesto (0 ganhos = real) | 10/13 Jun |
| **Percurso da lead de ANÚNCIO com dados REAIS** (127 leads source=Facebook) | DB agregado + trace de 1 na UI | ✅ 127/127 com negócio, routing certo (Compradores/Oport.); cockpit com HEALTH AI + Próxima Acção; ⚠️ origem não visível na ficha do contacto; gargalo conhecido (6/127 trabalhadas) | 15 Jun |
| **Varrimento das 56 rotas** (smoke HTTP, consola, overflow, escuro) | Desktop 1280 + mobile 375 + tablet 768 | ✅ 0 erros, 0 overflow | 13 Jun |
| **Contactos — filtros** (Leads/MQL/Prospects/Clientes/Outros; Pessoas/Empresas) | Funcional a clicar | ✅ filtram, estado vazio ok | 15 Jun |
| **Contactos — pesquisa** (nome real, unaccent; inputs patológicos `% _ \ ( ) , * <script> '; --`) | Funcional + stress | ✅ 0 falhas/erros; wildcard %/_ sobre‑corresponde (⚠️) | 15 Jun |
| **Contactos — criação (form)** | Validação client (nome/telefone/origem obrigatórios) | ✅ bloqueia inválido | 13/15 Jun |
| **Contactos — render adversarial** (XSS, 20k chars, RTL/emoji, origem nula) | Lista + ficha, desktop+375 | ✅ XSS não executa, 0 overflow | 15 Jun |
| **Contactos — FICHA a fundo** (editar campos, Registar interação/timeline, Assistente 360/Analisar com IA) | Funcional a clicar (contacto QA criado/exercitado/limpo) | ✅ Editar campos→`contacts.notes`+`custom_fields` (acentos ok); Registar interação Nota→`deal_activities` (contact_id, via=timeline‑manual, sobrevive reload); **Assistente 360** `/api/contacts/[id]/assistant` 200, retrato PT‑PT coerente c/ dados reais (família/objectivo/interação). ⚠️ proveniência (`source`) não visível no cabeçalho (P3); ⚠️ IA runtime omite hífens de clíticos ("encontra se") | 16 Jun |
| **Negócios — filtros board** (estado Em Aberto/Ganhos/Perdidos/Todos; dono) | Funcional a clicar | ✅ filtram | 15 Jun |
| **Negócios — mover etapa** (dispara IA‑analyze) | Funcional + stress (valores extremos, injecção) | ✅ 200 (após fix `31857a3`) | 13/15 Jun |
| **Negócios — render adversarial** (XSS, título 5k, valor ~1 bilião, prob 250%/‑10%) | Board + cockpit | ✅ não parte; chip DASH‑2 clampa | 15 Jun |
| **Negócios — abrir cockpit / aba Produtos (deal_items)** | Funcional | ✅ (após fix `24f8b32`) | 13 Jun |
| **Negócios — CICLO DE VIDA completo** (criar inline c/ proveniência obrigatória → mover etapa → **add produto personalizado** → **GANHO**) | Funcional a clicar (deal QA criado/movido/ganho/limpo) | 🐞→✅ #13: add produto crashava o modal (`Invalid time value`); corrigido (`fd73724`) e reconfirmado. Criar guarda `source`; GANHO grava `is_won=true`+`closed_at`; valor do deal passa a soma dos produtos | 15 Jun |
| **Negócios — RESTO do ciclo** (Nota/Timeline, Adiar, editar título/valor, abas IA Insights/Financeiro, touchpoints, PERDIDO com motivo) | Funcional a clicar (deal QA criado/exercitado/limpo) | ✅ Nota→`activities` NOTE (acentos ok); Adiar 3m→`custom_fields.snoozedUntil`+estado UI (Reagendar/Retomar); editar título e valor (175k) persistem; IA Insights "Analisar Negócio" 200 PT-PT coerente; Financeiro recalcula comissão+add custo→`expenses` (org-scoped); Agendar→`activities` MEETING+CHQ, visita→só CHQ; PERDIDO "Preço"→`is_lost`+`loss_reason`+`closed_at`. 🐞→✅ copy PT-BR "te ajuda"→"ajuda-o" (`9017c92`, reconfirmado em produção). ⚠️ sem editar-dono e sem mover-entre-boards na UI (ver achados) | 16 Jun |
| **Inbox/tarefas — concluir/adiar/reverter** | Funcional a clicar (tarefa QA) | ✅ BD + toasts | 15 Jun |
| **Definições — gravar campo na BD (Política de privacidade)** | Gravar + reverter | ✅ BD muda e restaura | 15 Jun |
| **Definições — Brand Kit / Marca pessoal (`/settings/marca`)** | Gravar + reverter (font_body) | 🐞→✅ #15: gravava sempre 400 (`select('*')` + `.strict()`); corrigido (`af827cc`), PUT 400→200, BD grava+restaura | 16 Jun |
| **Definições — Etiquetas/Campos/Página Inicial** | Funcional | 🐞/⚠️ só localStorage (não BD) | 15 Jun |
| **Definições — Produtos/Serviços** (`products`) | CRUD a fundo a clicar (produto QA criado/exercitado/limpo) | ✅ criar (preço 1500,50/SKU/descrição acentuada)→editar (nome+preço 2750)→desactivar (`active=false`)→eliminar (confirm); BD bate em cada passo, org-scoped, 0 órfãos | 17 Jun |
| **Definições — Metas** (`org_revenue_goals`) | Gravar a fundo (ano QA 2027 p/ não tocar 2026 real) | ✅ anual 60 000 € auto-distribui 5000×12, CHQ/dia 5, notas acentuadas; BD confirma; limpo (só 2026 real fica) | 17 Jun |
| **Definições — Unidades de Negócio** (`business_units`) | CRUD a clicar (unidade QA) | ✅ criar (slug auto sem acento)→editar (toggle auto_create_deal=true)→eliminar (soft-delete `deleted_at`, sai da lista); BD confirma; limpo | 17 Jun |
| **Definições — Checklists por fase** (`stage_checklists`) | Gravar a clicar (item QA) | ✅ + adicionar item + obrigatório→Guardar→upsert grava `[{label,required:true}]` acentos ok; BD confirma; limpo | 17 Jun |
| **Definições — Equipa** (`organization_invites`) | Gerar+revogar convite (link, SEM email) | ✅ Gerar Link (admin, expira +7d, used_at null)→BD confirma→Revogar→linha removida; convite vendedor real intacto; sem envio de email (convite por link) | 17 Jun |
| **Financeiro — Visão de Gestor** | Render + números honestos + toggle período | ✅ Investimento 871,89 € (=gasto vitalício anúncios), Custo/lead 1,06 € (871,89÷819 ✓), Comissões 0 € (BD: 0 `is_won` de 484), Lucro −871,89 €, Margem/Retorno —/0× honestos; toggle "Este ano" re-render 0 erros | 17 Jun |
| **Assistente IA (/ai)** | Pergunta real + prompt injection | ✅ PT‑PT, recusa injecção, sem tool de apagar | 10/15 Jun |
| **Endpoints `/api/ai/tasks/**` (8)** | Payload válido + vazio | ✅ 200 / 400; fragilidade 500‑on‑AI‑fail (⚠️) | 15 Jun |
| **Mensagens — Conversas + Caixa Social** | Abrir conversa, gerar rascunho IA (sem enviar) | ✅ rascunho 200 PT‑PT; sem botão Enviar (João envia no Messenger); 0 overflow | 15 Jun |
| **Imóveis — criar (POST /api/imoveis) + ficha** | Criar (201) + render de todas as secções | ✅ ficha completa, 0 overflow, 0 erros | 15 Jun |
| **Imóveis — fotos `from-url`** | Probe SSRF (metadata/loopback) | ⚠️ SSRF cego (servidor faz fetch; exfil mínima) | 15 Jun |
| **Imóveis — CMI (add + countdown)** | Criar CMI (data_fim +10d) + render | ✅ 201; ficha mostra "10 dias faltam" (banda âmbar) | 15 Jun |
| **Imóveis — form de 50+ campos pela UI** (4 abas: Essencial/Localização/Características/Comercial) | Criar a clicar + render | ✅ persistiu tudo; XSS `<b>` mostrado como texto; acentos ok | 15 Jun |
| **Imóveis — proprietários (criar) + documento do proprietário (upload CC)** | Funcional a clicar | ✅ 201; doc no bucket `proprietario-documentos`, URL assinado | 15 Jun |
| **Imóveis — mandato (comprador) (criar)** | Funcional a clicar | ✅ 201; exclusivo/activo/5%/pago comprador | 15 Jun |
| **Imóveis — documentos do imóvel (upload PDF)** | Funcional a clicar | ✅ 201; bucket `imovel-documentos`, URL assinado | 15 Jun |
| **Imóveis — upload real de fotos (2)** | Funcional a clicar | ✅ renderizam via `/_next/image`; reordenar/★/× | 15 Jun |
| **Imóveis — IMO‑7 Agente de Divulgação** (gerar copy + analisar fotos visão + montar plano) | Funcional a clicar (3 chamadas IA) | ✅ 200; dados reais, PT‑PT, CTA "Quando lhe for oportuno"; visão viu mesmo as fotos (identificou que são de teste) | 15 Jun |
| **Imóveis — NS‑3 Custo & ROI (alterar custo por visita)** | Funcional a clicar | ✅ PATCH `/api/financeiro/visit-cost` 200; persiste 12,50 € | 15 Jun |
| **Imóveis — apagar (cascata BD + storage)** | Funcional + verificação SQL/storage | 🐞→✅ #12: deixava ficheiros órfãos no storage; corrigido (`6c9366b`) e reconfirmado (0 órfãos pós‑delete) | 15 Jun |
| **Perfil** (editar nome/apelido + palavra‑passe) | Funcional (editar `nickname`+revert; validação pw) | ✅ editar→`profiles.nickname` grava+revertido; validação pw mismatch bloqueia ("não coincidem"), **pw do João intacta**. 🐞→✅ copy "Salvar"→"Guardar" + telefone +55→+351 (`7bcdb6b`). ⚠️ "sobrenome"/"apelido"/"alcunha" a relabel (22/06) | 16 Jun |
| **Sino (Notificações)** | Abrir painel | ✅ "Tudo limpo! Não tem notificações", PT‑PT, 0 erros | 16 Jun |
| **Ditar / Voz para o CRM** | Abrir widget de gravação | ✅ render + afordância "começar a gravar"; transcrição real não testável (sem áudio via Playwright). ⚠️ copy "Tap"→"Toque" | 16 Jun |
| **Decisões (Central de Decisões)** | Analisar Agora (IA) + reload | ✅ gerou 13 decisões reais (12 críticas) de tarefas atrasadas reais; guardadas em `localStorage` (não na BD `ai_decisions`). 🐞→✅ #16: reload com decisões guardadas dava React #418 (hydration); corrigido (`1c071dd`), 0 erros reconfirmado. ⚠️ copy "Por que estou sugerindo isso"/"Ação" (22/06) | 16 Jun |
| **Análise — Cérebro** | Render + filtros 30/90/12 meses | ✅ dados reais, 0 overflow, 0 erros | 15 Jun |
| **Análise — Funil** | Render | ✅ funil, 0 overflow | 15 Jun |
| **Análise — Financeiro** | Render + períodos (mês/ano/sempre) + aba Despesas | ✅ números honestos, 0 overflow, 0 erros | 15 Jun |
| **Análise — Relatórios** | Render + filtros board + intervalo de datas + Recharts | ✅ 0 overflow, 0 erros (warning Recharts conhecido) | 15 Jun |
| **Análise — Visão Geral (dashboard)** | Render + filtros board/datas | ✅ 0 overflow, 0 erros (warning Recharts conhecido) | 15 Jun |
| **Marketing — Biblioteca (/criativos)** | Render + abas 📚/✨ + 4 formatos da aba Criar | ✅ 0 overflow, 0 erros | 15 Jun |
| **Marketing — Biblioteca: GERAR + GUARDAR criativo** (Post orgânico FB/IG) | Funcional a clicar (copy IA + render + guardar + apagar) | ✅ copy IA (`/api/criativos/copy` 200, dados reais Seroa, PT-PT, respeitou indicações); **render PNG** (`/render` 201 → `creative-archive/gerados`); peça nova na biblioteca (2→3) c/ imagem; **apagar = soft-delete (archive_at)** — sem órfão de storage (retenção intencional, ≠ imóvel) | 15 Jun |
| **Marketing — /anuncios (a fundo)** | Período 7/30/90/ano/Tudo + Tabela/Árvore + drill-down + analista + encaminhamento | ✅ dados vitalícios reais (Gasto 871,89€/819 leads Meta; árvore campanha›conjunto›anúncio c/ CPL/ROAS); recomendação do analista (2026-06-10); 0 erros. Criar anúncio = gated Meta/custo → no percurso real | 15 Jun |
| **Marketing — Orgânico (a fundo)** | Toggles FB/IG + períodos + mobile 375 | ✅ **posts/interacções FB+IG reais e LIVE** (ORG-IG Fatia 1, `4af1a99`; IG 6 posts/12 interacções, antes era stub), mobile 375 0 overflow, 0 erros. ⚠️ **Alcance TENTADO e PUXADO por honestidade** (`196d5f7`): soma diária sobre-conta + valores IG incoerentes (534 mês recente vs 22 458 mês antigo s/ posts) → KPI "—/em breve". Re-auth do João feito; refazer com `metric_type=total_value` validado contra a app da Meta (TODO) | 16 Jun |
| **Exportações — relatórios (/reports PDF)** | Clicar PDF + inspeccionar blob | ✅ blob `application/pdf` ~29 KB gerado e aberto; 0 erros. /financeiro sem export (por design) | 15 Jun |
| **Actividades (página)** | Render + filtros de tipo | ✅ 0 overflow; 🐞 copy PT‑BR corrigido (`da4e371`) | 15 Jun |
| **Matches (Inbox Bruto) — colar texto → IA** | Funcional a clicar (raw_intel QA criado/processado/limpo) | ✅ `/api/inbox-raw/process` 200; IA extraiu Procura T3/Paços de Ferreira/200k/garagem+varanda/nome+telefone (95%), contagem 10→11, PT‑PT correcto. Limpo (`raw_intel`+`matches`) | 16 Jun |
| **Cruzamentos — estado de match** | Mudar estado (novo→visto) + reverter | ✅ BD muda; "Novos" engloba novo+visto | 15 Jun |
| **Boards — CRUD + Estratégia** (criar board do zero, add/renomear etapa, Definir Estratégia) | Funcional a clicar (board QA criado/exercitado/apagado) | ✅ wizard "Começar do zero"→`boards`+`board_stages` (4 etapas na ordem: Nova/Em Progresso/Concluído/QA Etapa Extra); add etapa + renomear persistem; **Estratégia do Board**→`entry_trigger`/`goal_kpi`/`agent_name` gravam. ⚠️ copy "OBJETIVO"→pré‑AO; reordenar etapas (drag) não testado | 16 Jun |
| **Automações — criar + builder + activar** | Criar rascunho (201) + builder carrega + activar vazio | ✅ 201; activação sem gatilho → 400 gracioso | 15 Jun |
| **Automações — activar REAL + disparar + CONTAR** (automação QA segura: trigger→criar tarefa interna, sem envio) | Activar→Executar (teste)→Executar real→confirmar contagem na BD/UI | 🐞→✅ #17: execução completava e criava a tarefa interna na BD, mas `automations.total_executions`/`success_count`/`last_execution_at` ficavam a 0 (cartão /automacoes e cabeçalho do builder mostravam sempre "0 execuções"). Trigger de BD `tg_automation_exec_counters` (mig. `20260617110000`); execução real passou a contar (1 totais · 1 OK), teste continua a não inflar. Dados QA limpos | 17 Jun |
| **Importação bulk (`/api/import/contacts/bulk`)** | Linhas sujas (sem nome, dup, xss, gigante, email inválido) | ✅ 200; defaults `source='import'`/`name='Sem nome'`; permissivo (sem dedup) | 15 Jun |
| **Importação UI (wizard CSV/XLSX)** — upload→preview→mapear→confirmar→importar | Funcional a clicar (CSV com origem/dup/acento/sem‑email) | ✅ preview detecta "CSV·vírgula·utf‑8·4 linhas"; auto‑mapeia name/email/phone/company + extra origem; 1.ª import 3 criados+1 dedup intra‑ficheiro; **2.ª import 0 criados+3 actualizados** (dedup por email+phone entre imports); empresa auto‑criada+ligada (`crm_companies`); telefone normalizado +351 | 15 Jun |
| **Exportação contactos (CSV)** | Clicar Exportar CSV + inspeccionar blob | ✅ 10 campos (name…updated_at), respeita lista, UTF‑8, download `contactos-YYYY-MM-DD.csv` | 15 Jun |
| **Merge de contactos** | Juntar par duplicado | ✅ 200, move registos, soft-delete do source | 15 Jun |
| **Automações / crons (10)** | /automacoes conta corridas; curl→403 (verify_jwt) | ✅ | 13 Jun |
| **Segurança** (advisors, RLS, buckets, secrets) | Advisors 0 ERROR; 13 buckets privados; RLS | ✅ | 13 Jun |
| **RGPD** (/unsubscribe, rodapé, privacy_policy_url) | Verificado | ✅ | 13 Jun |
| **Copy PT‑PT pré‑AO + UTF‑8** | Varrido código visível; emails sem mojibake | ✅ (IA runtime escreveu "diretamente" ⚠️) | 13/15 Jun |
| **Mobile 375 / tablet 768 / escuro** | Em todas as rotas varridas | ✅ 0 overflow | 13/15 Jun |

---

## 🐞 Bugs encontrados (cronológico) e estado

| # | Bug | Sessão | Commit | Estado |
|---|---|---|---|---|
| 1 | `/automacoes` mostrava "nunca" (crons não registavam corrida) | 10 Jun | `c978c18` | ✅ corrigido+verificado |
| 2 | Leads Meta de campanha não mapeada ficavam órfãs (sem board) | 10 Jun | `c978c18` | ✅ corrigido |
| 3 | APP_URL no domínio antigo | 10 Jun | `c978c18` | ✅ corrigido |
| 4 | React #418 hidratação (`usePersistedState` lia localStorage no init) | 13 Jun | `9dafc93` | ✅ corrigido+verificado |
| 5 | Proveniência furada no Novo Negócio inline (origem não obrigatória) | 13 Jun | `6eafede` | ✅ corrigido+verificado |
| 6 | `deal_items` 400 (colunas inexistentes no select) | 13 Jun | `24f8b32` | ✅ corrigido+verificado |
| 7 | Sanitização da pesquisa PostgREST (.or ilike com `\ ( ) * ,`) | 13 Jun | `1df3180` | ✅ corrigido+verificado |
| 8 | `/api/ai/tasks/deals/analyze` 500 ao mudar etapa (schema apertado → retries esgotam) | 13→15 Jun | `31857a3` | ✅ corrigido+reconfirmado |
| 9 | Typo template `{{dealValue} €}` (valor não injectado no prompt) | 15 Jun | `31857a3` | ✅ corrigido |
| 10 | Copy PT‑BR em Actividades/Perfil/Definições (`gerenciar`, `senha`, `Salvar`, `atende`, `Meu Perfil`) | 15 Jun | `da4e371` | ✅ corrigido (gerir/palavra‑passe/Guardar) |
| 11 | Lead nova mostrava 50% de fecho (palpite da IA / default 50) no cockpit | 15 Jun | `39330a9` | ✅ corrigido+verificado: % por sinais (0% nova, 48% c/ sinais). Residual prosa IA → fase 2 |
| 12 | Apagar imóvel deixava ficheiros órfãos no storage (fotos/docs do imóvel/docs do proprietário) — cascata só na BD; **risco de privacidade** (CC do proprietário persistia após "apagar definitivamente") | 15 Jun | `6c9366b` | ✅ corrigido+reconfirmado em produção: DELETE recolhe `storage_path` antes do delete e remove dos 3 buckets (best‑effort); 0 órfãos pós‑delete |
| 13 | **DealDetailModal crashava** (`RangeError: Invalid time value`) ao adicionar produto a um negócio — `format(new Date(deal.createdAt))` sem guarda; no re‑render pós‑mutação `deal.createdAt` fica momentaneamente `undefined` → `Intl.format(Invalid)` lança → modal inteiro fechava | 15 Jun | `fd73724` | ✅ corrigido+reconfirmado: helper `formatDateSafe` (data em falta/inválida → "—"); add produto deixa de crashar, modal mantém‑se aberto |
| 14 | Copy PT‑BR no DealDetailModal → aba IA Insights → Objection Killer: "A IA **te ajuda** a negociar" (próclise brasileira) | 16 Jun | `9017c92` | ✅ corrigido+reconfirmado em produção (build `260616_1026`): "A IA **ajuda‑o** a negociar" |
| 16 | **React #418 (hydration) na `/decisions`** — consistente após existirem decisões guardadas. `useDecisionQueue` inicializava `decisions`/`lastAnalyzedAt` no `useState` a partir do `localStorage` (`decisionQueueService`), divergindo do HTML do servidor (vazio) | 16 Jun | `1c071dd` | ✅ corrigido+reconfirmado em produção (build `260616_1125`): estado inicial SSR‑safe + `useEffect` pós‑mount; 0 erros, decisões renderizam. Mesmo padrão do #4 |
| 15 | **Brand Kit (`/settings/marca`) gravava sempre 400** "Invalid payload" — o GET faz `select('*')` (devolve `id`/`organization_id`/`created_at`/`updated_at`); o cliente fazia `setKit({...emptyKit, ...data.kit})` e depois `PUT JSON.stringify(kit)` com essas colunas só‑BD, que o `KitSchema.strict()` do servidor rejeita. **A marca pessoal — base de todos os criativos/templates — não conseguia gravar pela UI.** | 16 Jun | `af827cc` | ✅ corrigido+reconfirmado em produção (build `260616_1102`): cliente envia só as chaves de `emptyKit`; PUT 400→200, `font_body` gravou e foi restaurado. `.strict()` mantido como defesa |
| 17 | **Contadores de execução das automações do utilizador nunca subiam** — a edge function `automation-execute` finaliza `automation_executions` (completed/failed) mas NUNCA actualizava `automations.total_executions`/`success_count`/`failure_count`/`last_execution_at`, e não havia trigger. O cartão em /automacoes e o cabeçalho do builder ("X totais · Y OK") mostravam sempre "0 execuções" mesmo depois de a automação correr e completar (a lista de execuções aparecia, só o contador é que ficava preso a 0) | 17 Jun | migração `20260617110000_automation_exec_counters` | ✅ corrigido+reconfirmado em produção: trigger `tg_automation_exec_counters` incrementa na transição p/ estado terminal, uma vez por execução, só para `is_test=false`; execução real passou a contar (0→1 totais · 1 OK na UI), teste não infla. Cobre todos os caminhos (manual/cron-tick/resume). Sem código de app alterado (só BD) |

---

## ⚠️ Achados de endurecimento (capturados — DECISÃO do João pós‑22, âmbito congelado)

| Achado | Severidade | Nota |
|---|---|---|
| **Proveniência só na UI:** `contacts.source` e `contacts.phone` são nullable na BD (só `name` é NOT NULL) | 🔴 Alta (regra crítica) | Falta NOT NULL / RLS check / validação server. Ver [[regra-lead-tag-proveniencia-obrigatoria]] |
| **Definições Etiquetas/Campos/Página Inicial só localStorage** (não sincroniza BD nem entre dispositivos; etiquetas ≠ tabela `tags` real) | 🟠 Média | `// TODO: Migrate to Supabase` em useSettingsController. João quer mover Política de privacidade p/ sub‑aba "Activos digitais" na Biblioteca |
| **Fragilidade IA tasks:** os 8 `/api/ai/tasks/**` têm "IA falha → 500" (só o analyze foi endurecido) | 🟠 Média | Aplicar degradação graciosa aos outros 7 (clique do utilizador, toast visível) |
| **SSRF cego em `imoveis/[id]/fotos/from-url`:** servidor faz `fetch` de qualquer URL sem validar host (loopback/IP privado/metadata) | 🟠 Média‑alta | Exfil mínima hoje (só extrai `<img>`, corpo não volta ao cliente, operador‑only). Relevante p/ multi‑tenant. Fix: validar host/IP resolvido (bloquear privados/loopback/link‑local), revalidar em redirect. Nota: usa `r.jina.ai` como fallback (a URL alvo vai p/ 3.º) |
| **Rascunho IA da Caixa Social ignora o conteúdo da mensagem** (gerou boas‑vindas de venda para uma DM de golpe) | 🟢 Baixa | Humano revê sempre antes de enviar; melhorar prompt p/ ter em conta a mensagem recebida / detectar spam |
| **`contact_merge_log.target_contact_id` NOT NULL + FK ON DELETE SET NULL** (contradição → hard‑delete de um contacto que foi alvo de merge falha) | 🟢 Baixa | Dormente (app faz soft‑delete). Corrigir: tornar a coluna nullable OU mudar a FK p/ ON DELETE CASCADE |
| **Importação bulk permissiva:** sem dedup de email, aceita email/telefone inválidos | 🟢 Baixa | É endpoint cru; a UI usa `/api/contacts/import` com modos de dedup. Defaults de nome/origem ok |
| **Proveniência (origem) não visível na ficha do contacto** | 🟠 Média | A origem (ex.: Facebook) aparece na lista e no cockpit do negócio, mas NÃO na ficha individual do contacto. Regra crítica = saber de onde veio a lead. Mostrar a origem no cabeçalho/Resumo da ficha |
| **Grafias AO‑1990 em copy visível** ("Próxima Ação", "interações") em vez de pré‑AO ("Acção", "interacções") | 🟢 Baixa | Para o varrimento de copy de 22/06 (regra PT‑PT pré‑AO total) |
| `messaging-webhook-meta` com `verify_jwt=true` (curl→401) | 🟠 Média | Dormente hoje; se activarem Meta Cloud messaging, POSTs morrem no gateway → `verify_jwt=false` + X‑Hub‑Signature |
| Pesquisa: wildcards `%`/`_` não escapados → sobre‑correspondência | 🟢 Baixa | Melhorar `sanitizePostgrestValue` |
| Pesquisa multi‑token não adjacente ("mario sarmento") não casa (substring ilike) | 🟢 Baixa | — |
| Sem `maxLength`/limite de coluna em campos de texto (contactos, imóveis, labels de etapas) | 🟢 Baixa | UI aguenta 20k chars sem overflow |
| Probabilidade fora de [0,100] mostra‑se crua no cockpit ("250%") | 🟢 Baixa | Cosmético; chip DASH‑2 clampa |
| Warning Recharts `width/height(-1)` em /dashboard e /reports (gráfico vazio 0×0) | 🟢 Baixa | minHeight/condicionar render |
| `/settings/automation-logs` e `/unsubscribe` sem `<title>` próprio; `/admin/saude` h1 vazio; título de `/deals/[id]/cockpit` mostra UUID | 🟢 Baixa (a11y/nit) | — |
| IA runtime escreveu "diretamente" (AO‑1990) em vez de "directamente"; e **omite hífens de clíticos** ("encontra se"/"mostrou se" em vez de "encontra‑se") no Assistente 360 | 🟢 Baixa | Reforçar pré‑AO + hífens de clíticos no system prompt (crm‑agent + contact assistant). Output de runtime |
| Placeholder PT‑BR no form Novo Contacto: "Ex: Ana **Souza**" (apelido grafado à brasileira; PT‑PT = "Sousa") | 🟢 Baixa | Trocar para "Ex.: Ana Sousa" no varrimento de copy de 22/06 |
| **Lote copy 22/06 (varridos 16/06, ainda por corrigir):** Perfil campo "sobrenome"→"apelido"/"alcunha" (relabel, precisa decisão); Voz para o CRM "Tap para começar"→"Toque"; Decisões "Por que estou sugerindo isso?"→"Porque é que sugiro isto?" + "Ação sugerida"→"Acção"; Estratégia do Board "OBJETIVO"→"OBJECTIVO" | 🟢 Baixa | Juntar ao varrimento PT‑PT pré‑AO de 22/06 (com "Ação"/"interações" já listados) |
| **Reatribuir dono/responsável não existe na UI** do DealDetailModal (nem do board) | 🟢 Baixa (single‑op) | Org de 1 utilizador (João) → moot hoje; relevante p/ multi‑tenant ("serve qualquer consultor"). Capturado pós‑22 |
| **Mover negócio entre boards/funis não existe** (cada deal pertence a 1 funil; `handleSelectBoard` só troca a vista) | 🟢 Baixa | Provável por desenho (Proprietários vs Compradores são pipelines distintos). Confirmar com o João se quer "reatribuir funil"; senão fechar como intencional |
| **"Registar visita" só faz `logCHQ` (deal_activities), sem `recordTouchpoint`** → visita não aparece na Timeline do deal (chamada/email/reunião aparecem) | 🟢 Baixa | Inconsistência cosmética; a visita conta para métricas CHQ honestas. Considerar acrescentar `recordTouchpoint('VISIT'…)` p/ a timeline |
| **`custom_fields.snoozedUntil` permanece após PERDIDO/GANHO** (deal fechado mantém data de adiamento) | 🟢 Baixa | Inócuo (fechados saem do follow‑up); limpar o snooze ao fechar seria mais limpo |
| **DealDetailModal cockpit (HEALTH/PROB) e aba IA Insights usam `deals.probability` (default 10% à criação), não o score por sinais DASH‑2** | 🟠 Média | 3.ª superfície de % a alinhar na **fase 2 do épico %** (FocusContextPanel/cockpit‑v2 já corrigidos no #11). Lead nova mostra 10% fixo aqui. Pós‑22, âmbito congelado |

---

## ⬜ O que FALTA testar a fundo (próximas passagens, 15‑22)

> Estas áreas foram **carregadas/smoke‑tested** no varrimento das 56 rotas (🟡), mas ainda **não foram
> exercitadas a clicar** (criar/editar/gravar) com profundidade e inputs sujos.

- ✅ **Mensagens / Caixa Social** (15 Jun): conversa abre, rascunho IA gera (200, PT‑PT), sem Enviar. Falta só: marcar tratada (mutação real, não testada p/ não mexer em dados reais) + pesquisa de conversas com lista cheia.
- ✅ **Imóveis COMPLETO** (15 Jun): form de 50+ campos pela UI (4 abas) ✅, proprietários+doc CC ✅, mandato ✅, documentos do imóvel (PDF) ✅, upload real de 2 fotos ✅, **IMO‑7** (gerar copy/analisar fotos‑visão/montar plano) ✅, **NS‑3** custo por visita ✅, CMI add + countdown ✅, **apagar com cascata BD+storage** ✅ (bug #12 corrigido). SSRF do from‑url continua capturado ⚠️ (pós‑22). 🧠 **Gotcha:** estes forms usam `startTransition(router.refresh())` — a snapshot logo a seguir pode ler estado antigo (o POST volta 201/200 na rede); recarregar para confirmar a BD, não confiar na 1.ª render.
- ✅ **Cruzamentos / Matches** (15 Jun): Matches (Inbox Bruto) renderiza; /cruzamentos estado de match (novo→visto→revertido) ✅. Falta: colar texto→IA cruza (cria matches).
- ✅ **Análise** (15 Jun): Cérebro, Funil, Financeiro, Relatórios, Visão Geral — todos exercitados (filtros/períodos/board/datas), 0 overflow, 0 erros (só o warning Recharts conhecido). **Exportações** ✅: /reports PDF (blob application/pdf ~29 KB) + /contacts CSV; /financeiro sem export (por design).
- ✅ **Meta Ads / Marketing** (15 Jun): Biblioteca **gerar criativo + guardar** (Post orgânico FB/IG: copy IA + render PNG + biblioteca 2→3 + apagar=archive) ✅; **/anuncios a fundo** (período/Tabela/Árvore/drill-down/analista/encaminhamento, dados vitalícios reais) ✅; **/organico a fundo** (FB posts reais, IG estado vazio gracioso, períodos) ✅. Falta menor: criar/editar anúncio pago e publicar criativo (gated Meta + **custo real** → só no percurso real, fora do QA).
- ✅ **Automações — builder** (15 Jun): criar rascunho (201) + builder carrega + activação sem gatilho → 400 gracioso. Falta: montar nós + activar uma real com trigger (cuidado: pode disparar envios).
- ✅ **Importação bulk + merge + UI wizard** (15 Jun): bulk com linhas sujas → 200; merge → soft‑delete do source; **UI import CSV** exercitada ponta‑a‑ponta (preview→auto‑mapping→confirm→import; dedup intra‑ficheiro e entre imports; empresa auto‑criada; export CSV). Falta menor: XLSX (.xlsx) pela UI (só testei CSV; o parser aceita ambos).
- 🟡 **Percurso da lead com dados REAIS:** ✅ feito 15/06 com as 127 leads de anúncio existentes (source=Facebook): entrada c/ proveniência → negócio → board certo → cockpit (HEALTH AI + Próxima Acção). **Falta (18/06):** uma lead de anúncio NOVA a entrar ao vivo (webhook Meta assinado — não forjável) + negócio ganho → CAPI envia → funil/cérebro reflectem.
- ⬜ **Re‑passagem páginas × estados (19/06):** vazio/erro/cheio/modais/forms/thank‑you × 375/768/desktop × escuro, em TODAS.
- ⬜ **Re‑verificação automações + segurança (20/06):** todas em /automacoes contam certo; advisors 0 ERROR; buckets privados; secrets no Vault.
- ⬜ **Fecho (22/06):** copy PT‑PT pré‑AO (varrer brasileirismos/traços/encoding nos emails); vitest verde; stress final dos forms principais; **relatório final**.

### 🔎 Fluxos funcionais do NÚCLEO ainda por exercitar a fundo (destapado 15/06 — só smoke até agora)
> As 4 áreas da lista original ("Imóveis, Import, Marketing, Exportações") estão feitas, mas o CRM tem mais
> fluxos centrais que só foram **carregados** (smoke) ou testados em fatia. A clicar com profundidade falta:
- ✅ **Negócios — ciclo de vida** (criar→etapa→produto→GANHO) FEITO 15/06 (+ bug #13). **RESTO FEITO 16/06:**
  PERDIDO com motivo ✅, Adiar ✅, editar título/valor ✅, Nota/Timeline ✅, touchpoints (Agendar/visita) ✅,
  abas IA Insights ✅ (Analisar 200) e Financeiro ✅ (comissão + add custo→`expenses`). 1 copy PT‑BR corrigida
  (#14). **Não existe na UI:** editar dono e mover‑entre‑boards (ver achados — single‑op / por desenho).
- ✅ **Ficha do contacto a fundo** (16/06): editar campos (notes+custom_fields, acentos ok) ✅; Registar
  interação/timeline → `deal_activities` (sobrevive reload) ✅; **Assistente 360** (Analisar com IA) 200 PT‑PT
  coerente ✅. Timeline = `deal_activities` (NÃO `lead_eventos` — essa é do Portal F&R, não existe neste CRM).
  ⚠️ proveniência (`source`) não aparece no cabeçalho (P3, pós‑22). Falta menor: "Comentar" (`contact_comments`)
  e "ligar a imóvel/deal" (não exercitados).
- ✅ **Boards (CRUD)** (16/06): criar board do zero (wizard)→`boards`+4 `board_stages` na ordem ✅; add etapa +
  renomear ✅; **Definir Estratégia do Board** (regras de entrada/objetivo/agente)→grava `entry_trigger`/`goal_kpi`/
  `agent_name` ✅. Falta menor: reordenar etapas por drag; criar via IA/playbook/template; apagar board pela UI
  (DeleteBoardModal — apaguei o QA por SQL). ⚠️ copy pré‑AO "OBJETIVO" no painel de estratégia.
- ⬜ **Automações — activar uma REAL com gatilho** (montar nós + disparar). ⚠️ cuidado: pode enviar de verdade.
- ⬜ **Mensagens — enviar de verdade + marcar tratada** (só rascunho IA até agora). ⚠️ envio real.
- ✅ **Cruzamentos — colar texto → IA cria matches** (16/06): `/api/inbox-raw/process` 200; IA classificou e
  extraiu a procura (tipo/T3/zona/budget/features/contacto), 95%, contagem subiu. Dados QA limpos.
- ✅ **Definições a fundo (FEITO 17/06):** abas reais = Geral · Produtos/Serviços · Unidades · Integrações · Central de I.A ·
  Marca · Metas · Checklists · Dados · Equipa. **Gravar testado a fundo:** Geral/privacidade (15/06) ✅ +
  **Marca/Brand Kit** (16/06, 🐞→✅ #15 400→200) ✅ + **Produtos/Serviços (CRUD), Metas (2027), Unidades (CRUD),
  Checklists, Equipa (convite link+revogar)** (17/06) ✅ — escrita confirmada na BD em cada uma, dados QA limpos. **`/settings/prompts` = 404** (o `plano_repositorio_prompts_ui`
  não foi construído como página; prompts vivem na BD — não re‑propor, é só nota). Falta gravar a fundo:
  Produtos/Serviços, Unidades, Metas, Checklists, Equipa; integrações Meta (gated); Central de I.A (não mexer em chaves).
- ✅ **Perifericos FEITOS 16/06:** **Perfil** (editar `nickname`+revert ✅; validação pw mismatch ✅, pw intacta;
  copy "Salvar"→"Guardar" + telefone +351 corrigidos `7bcdb6b`); **Sino** (painel vazio gracioso ✅); **Ditar/Voz**
  (widget de gravação renderiza ✅; transcrição real não testável via Playwright — sem áudio); **Decisões**
  (Analisar Agora → 13 decisões reais, efémeras ✅). **Visão de Gestor do Financeiro FEITA 17/06** ✅ (números
  honestos cruzados com a BD). Falta: transcrição de voz com áudio real; copy de Decisões/Ditar p/ varrimento 22/06.

---

## 🧭 Como usar este ficheiro
1. Antes de testar, ler a matriz para não repetir o que já está ✅.
2. Ao testar uma área 🟡/⬜, exercitar a CLICAR (criar/editar/gravar), não só carregar a página.
3. Bug encontrado → diagnostica → corrige → push → reconfirma em produção → registar na tabela de bugs.
4. Dados de teste sempre identificáveis (prefixo "QA …") e LIMPOS no fim (SQL).
5. Ao fechar a sessão: actualizar a Posição actual + a matriz + bugs + pendências aqui.
