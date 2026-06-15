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
- **Data:** 15/06/2026 · **HEAD origin/main:** `6c9366b` · **build em produção:** `260615_1454`.
- **URL produção:** crm.joaofilipefonseca.pt · **Supabase:** `zcqbbqrdbszzkpydrlmz` · **org:** `29455d22-…`.
- **Verificação:** Playwright autenticado + Supabase MCP. `tsc 0 / lint 0 / vitest 550/5`.
- **Onde estamos no plano** ([[plano-rumo-22junho]]): QA TOTAL 1.ª passagem + testes funcionais a clicar
  + stress do processo central — FEITOS. Re‑passagem de profundidade em curso: **Mensagens/Caixa Social ✅**
  e **Imóveis COMPLETO ✅** (form 50+ campos, mandatos/proprietários/documentos, upload real de fotos,
  IMO‑7, NS‑3, delete‑cascade) feitos 15/06 — **1 bug real corrigido+deployado+reconfirmado (#12, órfãos
  no storage).** Seguem as restantes áreas 🟡/⬜ abaixo (import CSV/XLSX, marketing, exportações) ao longo
  de 15‑22; 18/06 percurso da lead com dados reais + remover Muhammad do BM; 22 fecho.

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
| **Negócios — filtros board** (estado Em Aberto/Ganhos/Perdidos/Todos; dono) | Funcional a clicar | ✅ filtram | 15 Jun |
| **Negócios — mover etapa** (dispara IA‑analyze) | Funcional + stress (valores extremos, injecção) | ✅ 200 (após fix `31857a3`) | 13/15 Jun |
| **Negócios — render adversarial** (XSS, título 5k, valor ~1 bilião, prob 250%/‑10%) | Board + cockpit | ✅ não parte; chip DASH‑2 clampa | 15 Jun |
| **Negócios — abrir cockpit / aba Produtos (deal_items)** | Funcional | ✅ (após fix `24f8b32`) | 13 Jun |
| **Inbox/tarefas — concluir/adiar/reverter** | Funcional a clicar (tarefa QA) | ✅ BD + toasts | 15 Jun |
| **Definições — gravar campo na BD (Política de privacidade)** | Gravar + reverter | ✅ BD muda e restaura | 15 Jun |
| **Definições — Etiquetas/Campos/Página Inicial** | Funcional | 🐞/⚠️ só localStorage (não BD) | 15 Jun |
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
| **Análise — Cérebro** | Render + filtros 30/90/12 meses | ✅ dados reais, 0 overflow, 0 erros | 15 Jun |
| **Análise — Funil** | Render | ✅ funil, 0 overflow | 15 Jun |
| **Análise — Financeiro** | Render + períodos (mês/ano/sempre) + aba Despesas | ✅ números honestos, 0 overflow, 0 erros | 15 Jun |
| **Análise — Relatórios** | Render + filtros board + intervalo de datas + Recharts | ✅ 0 overflow, 0 erros (warning Recharts conhecido) | 15 Jun |
| **Análise — Visão Geral (dashboard)** | Render + filtros board/datas | ✅ 0 overflow, 0 erros (warning Recharts conhecido) | 15 Jun |
| **Marketing — Biblioteca (/criativos)** | Render + abas 📚/✨ + 4 formatos da aba Criar | ✅ 0 overflow, 0 erros (não gerei/publiquei) | 15 Jun |
| **Marketing — Orgânico** | Render + toggles FB/IG + períodos | ✅ 0 overflow, 0 erros | 15 Jun |
| **Actividades (página)** | Render + filtros de tipo | ✅ 0 overflow; 🐞 copy PT‑BR corrigido (`da4e371`) | 15 Jun |
| **Matches (Inbox Bruto)** | Render (é tool de colar texto→IA) | ✅ 0 overflow (não criei matches p/ não poluir) | 15 Jun |
| **Cruzamentos — estado de match** | Mudar estado (novo→visto) + reverter | ✅ BD muda; "Novos" engloba novo+visto | 15 Jun |
| **Automações — criar + builder + activar** | Criar rascunho (201) + builder carrega + activar vazio | ✅ 201; activação sem gatilho → 400 gracioso | 15 Jun |
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
| IA runtime escreveu "diretamente" (AO‑1990) em vez de "directamente" | 🟢 Baixa | Reforçar pré‑AO no system prompt do crm‑agent |

---

## ⬜ O que FALTA testar a fundo (próximas passagens, 15‑22)

> Estas áreas foram **carregadas/smoke‑tested** no varrimento das 56 rotas (🟡), mas ainda **não foram
> exercitadas a clicar** (criar/editar/gravar) com profundidade e inputs sujos.

- ✅ **Mensagens / Caixa Social** (15 Jun): conversa abre, rascunho IA gera (200, PT‑PT), sem Enviar. Falta só: marcar tratada (mutação real, não testada p/ não mexer em dados reais) + pesquisa de conversas com lista cheia.
- ✅ **Imóveis COMPLETO** (15 Jun): form de 50+ campos pela UI (4 abas) ✅, proprietários+doc CC ✅, mandato ✅, documentos do imóvel (PDF) ✅, upload real de 2 fotos ✅, **IMO‑7** (gerar copy/analisar fotos‑visão/montar plano) ✅, **NS‑3** custo por visita ✅, CMI add + countdown ✅, **apagar com cascata BD+storage** ✅ (bug #12 corrigido). SSRF do from‑url continua capturado ⚠️ (pós‑22). 🧠 **Gotcha:** estes forms usam `startTransition(router.refresh())` — a snapshot logo a seguir pode ler estado antigo (o POST volta 201/200 na rede); recarregar para confirmar a BD, não confiar na 1.ª render.
- ✅ **Cruzamentos / Matches** (15 Jun): Matches (Inbox Bruto) renderiza; /cruzamentos estado de match (novo→visto→revertido) ✅. Falta: colar texto→IA cruza (cria matches).
- ✅ **Análise** (15 Jun): Cérebro, Funil, Financeiro, Relatórios, Visão Geral — todos exercitados (filtros/períodos/board/datas), 0 overflow, 0 erros (só o warning Recharts conhecido). Falta menor: exportações dos relatórios.
- 🟡 **Meta Ads / Marketing:** Biblioteca (/criativos) render + 4 formatos da aba Criar ✅ (15 Jun, sem gerar/publicar). **Falta:** gerar criativo + guardar na Biblioteca; /anuncios criar/editar anúncio (gated pela Meta, custo → no percurso real); /organico.
- ✅ **Automações — builder** (15 Jun): criar rascunho (201) + builder carrega + activação sem gatilho → 400 gracioso. Falta: montar nós + activar uma real com trigger (cuidado: pode disparar envios).
- ✅ **Importação bulk + merge + UI wizard** (15 Jun): bulk com linhas sujas → 200; merge → soft‑delete do source; **UI import CSV** exercitada ponta‑a‑ponta (preview→auto‑mapping→confirm→import; dedup intra‑ficheiro e entre imports; empresa auto‑criada; export CSV). Falta menor: XLSX (.xlsx) pela UI (só testei CSV; o parser aceita ambos).
- 🟡 **Percurso da lead com dados REAIS:** ✅ feito 15/06 com as 127 leads de anúncio existentes (source=Facebook): entrada c/ proveniência → negócio → board certo → cockpit (HEALTH AI + Próxima Acção). **Falta (18/06):** uma lead de anúncio NOVA a entrar ao vivo (webhook Meta assinado — não forjável) + negócio ganho → CAPI envia → funil/cérebro reflectem.
- ⬜ **Re‑passagem páginas × estados (19/06):** vazio/erro/cheio/modais/forms/thank‑you × 375/768/desktop × escuro, em TODAS.
- ⬜ **Re‑verificação automações + segurança (20/06):** todas em /automacoes contam certo; advisors 0 ERROR; buckets privados; secrets no Vault.
- ⬜ **Fecho (22/06):** copy PT‑PT pré‑AO (varrer brasileirismos/traços/encoding nos emails); vitest verde; stress final dos forms principais; **relatório final**.

---

## 🧭 Como usar este ficheiro
1. Antes de testar, ler a matriz para não repetir o que já está ✅.
2. Ao testar uma área 🟡/⬜, exercitar a CLICAR (criar/editar/gravar), não só carregar a página.
3. Bug encontrado → diagnostica → corrige → push → reconfirma em produção → registar na tabela de bugs.
4. Dados de teste sempre identificáveis (prefixo "QA …") e LIMPOS no fim (SQL).
5. Ao fechar a sessão: actualizar a Posição actual + a matriz + bugs + pendências aqui.
