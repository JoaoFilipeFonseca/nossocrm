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

- **MKT-MEASURE · Épico de Medição & Inteligência (Pixel + CAPI + funil das LP + orgânico/páginas → cérebro)** `[POR FAZER]` `P1` (CAPTURE 04/06, visão do João — "tudo o que crio, ads/publicações/páginas, rastrear e estudar padrões para entregar a quem tem mesmo interesse; nas LP/calculadoras medir quem entra, quanto tempo fica, onde para; olhar orgânico + ads + tudo na Meta")
  Distinção-chave (esclarecida ao João 04/06): o **Pixel** (browser) e a **CAPI** (servidor) servem para a **Meta optimizar e fazer remarketing** (e medir conversões), NÃO dão por si um painel de "tempo na página/onde desistiu" — isso é **analítica de funil própria**. Sub-peças:
  - **MA-CAPI · API de Conversões (servidor → Meta)** `[POR FAZER]` `P1` — enviar eventos que só o CRM sabe (lead→cliente, negócio ganho com valor) ao dataset **"João Fonseca Online" `226877513589288`** para a Meta entregar a quem compra e a atribuição sobreviver a bloqueadores/iOS. Reusa `metaCapiEvent` do portal (`portal-app/src/lib/submit/integrations.ts`). **Setup Meta = clique do João** (Gestor de Eventos → dataset → Definições → API de Conversões → **Gerar token**); posso conduzir o browser dele (Claude-in-Chrome, sessão Meta) até ao ecrã e ele dá o clique final + copia o token (NUNCA introduzo password nem submeto). Depois ligo o CRM (código). Liga a MA-CREATE (Fase 4) e ao analista IA.
  - **MA-PIXEL-EVENTS · Pixel + eventos nas LP/calculadoras** `[POR FAZER]` `P2` — colocar o Pixel `226877513589288` + eventos padrão/à medida (ViewContent, Lead, CompleteRegistration, eventos de cada passo da calculadora) via GTM (`GTM-KK65ZDBS` já existe). Dá remarketing + sinais à Meta.
  - **MKT-FUNNEL-ANALYTICS · Analítica de funil PRÓPRIA no CRM** `[POR FAZER]` `P2` — medir nas LP/calculadoras: quem entra, **tempo na página, scroll, passo a passo, onde abandona (o gargalo)**, conversão por passo. Eventos próprios (own beacon → tabela no Supabase) + painel no CRM. É o que responde ao "onde param". Independente do Pixel (o Pixel é para a Meta; isto é para o João decidir).
  - **MKT-ORGANIC-INSIGHTS · Orgânico + Páginas + publicações** `[POR FAZER]` `P3` — puxar insights da Página (Graph API: alcance, interações, melhores posts) para o CRM, a par dos ads.
  - **MKT-BRAIN · Cérebro de medição (juntar tudo + padrões)** `[POR FAZER]` `P3` — num sítio: ads (`/anuncios`) + orgânico + funil das LP, a IA estuda padrões (o que converte, que público, que criativo) e alimenta entrega/retargeting + audiências. Liga a [[reference-meta-ia-2026-best-practices]] e ao analista IA. Liga a MA-LINKS (links rastreáveis por angariação) e MA-ASSET-HUB (píxeis/datasets como activos).
  > Decisão do João: isto começa **depois de o CRM estar pronto**. Capturado, não executar já. Por onde começar decide-se com ele (provável: MA-CAPI primeiro, porque destrava a medição de quem compra).

- **MA-ASSET-HUB · Central de activos do João (fonte única dos selectores)** `[POR FAZER]` `P?` (CAPTURE 03/06, ideia do João — "que grande ideia")
  Um local no CRM com **todos os activos** do João, para ele saber o que tem e para os **selectores do builder (MA-CREATE) irem buscar aqui** o que mostrar a escolher: **píxeis/datasets** (Online `226877513589288`, Offline `1402843233647362`, Outlier `1971121530507385`, Consultor offline `1100522198262161`), **formulários de leads** (lista da Página via API + os criados no CRM), **fotos/criativos** (Brand Kit + `/criativos` + **fotos das angariações** — ver MA-CREATE), **páginas/contas**, **links rastreáveis** (ver MA-LINKS). Cada activo: nome, id, estado, onde se usa. Liga a MA-CREATE (pickers), MA-LEADFORM, MA-CAPI, Brand Kit.

- **MA-CREATE (fonte de media) · Usar as FOTOS DA ANGARIAÇÃO como criativo do anúncio** `[POR FAZER]` `P?` (CAPTURE 03/06, ideia do João — "seria brutal")
  No builder/editor, ao escolher a imagem, poder **escolher directamente as fotos que já existem na angariação** (`imovel-fotos`, `listFotosByImovelId`) — enviar os bytes da foto à Meta (`adimages`) e usar como criativo, sem re-upload manual. Extensão do MA-EDIT Tier 2 (fonte de media) + MA-CREATE (passo do anúncio). Liga a [[MA-ASSET-HUB]] (as fotos da angariação são um activo).

- **MA-LINKS · Links rastreáveis por angariação (RE/MAX + domínio próprio com píxeis à escolha)** `[POR FAZER]` `P?` (CAPTURE 03/06, ideia do João)
  Em cada angariação, ter **dois links**: (a) o **link RE/MAX** com os dados do João; (b) um **link no domínio próprio** (`joaofilipefonseca.pt`) com **o(s) píxel(es) lá dentro**. Poder **escolher que píxeis/activos** carrega cada link (multi-pixel, GTM, CAPI). Objectivo: medir e atribuir o tráfego de cada angariação aos anúncios. Os píxeis/activos vêm da [[MA-ASSET-HUB]]. Liga a MA-CREATE (destino Site com URL rastreável), MA-CAPI, e ao GTM existente.

- **MKT-STUDIO · Estúdio de marketing completo no CRM** `[POR FAZER]` `P?`
  Sub-épicos: MA-CREATE (criar campanha/anúncio via API), criativos+carrosséis IA c/ Brand Kit, LPs imóveis+captação, posts sociais, documentos (cartas/apresentações/ACM-CMA). Reusa Brand Kit, `/criativos`, `/avaliar`. (origem: CAPTURE MKT-STUDIO)

- **MKT-SOCIAL · Publicação social no CRM (Meta + LinkedIn) com ciclo de aprendizagem** `[POR FAZER]` `P?` (CAPTURE 01/06, ideia do João)
  Compor publicações no CRM e publicar nas redes a partir daqui, **conteúdo pensado por plataforma**: **Meta** (Instagram + Facebook) num só clique com o mesmo conteúdo; **LinkedIn** como peça própria (rede diferente, linguagem/formato próprios — a IA adapta). Fotos carregadas OU geradas por IA (reusa `/criativos` + Brand Kit). Fluxo: rascunho → **pendente de validação do João** → 1 clique publica no(s) sítio(s) certo(s). **Histórico guardado no CRM**: o quê, onde, quando + **métricas** (visualizações, comentários, toda a interação) — "o que se faz no Meta e no LinkedIn, mas tudo aqui sem abrir 2 plataformas". A **IA analisa conteúdo+estratégia+resultados** e aprende (medir→aprender→melhorar): diz o que repetir/evitar/reenquadrar no mês seguinte. Alinhar copy/CTA com [[reference-meta-ia-2026-best-practices]] (criativo é o novo targeting; CTA a pedir DM). Teste "serve qualquer consultor": fácil, intuitivo, sem falhas. APIs prováveis: Meta Graph (IG/FB publishing) + LinkedIn API (revisão de permissões/escopos), tabelas `social_posts` + `social_post_metrics`, cron de recolha de métricas (em /automacoes). Liga a MKT-STUDIO (é o sub-épico "posts sociais" expandido) e ao analista IA existente (mesmo cérebro p/ orgânico).
  **Nuance do João (01/06):** além de publicar, **importar/detectar o que já está postado** (orgânico histórico) e analisá-lo **ao mesmo nível dos anúncios Meta** — o CRM é o assistente de conteúdos: diz **quando faz sentido renovar/trocar** um conteúdo (com base nas métricas e no histórico do que resultou, por canal). Marca pessoal do João ("marca lendária") como fio condutor. Reusa [[joao-fonseca-brand]] (skill) + Brand Kit.

- **MKT-BP-AUTOLEARN · Boas práticas Meta/IA sempre actualizadas (auto-aprendizagem)** `[POR FAZER]` `P?` (CAPTURE 01/06)
  A IA não fica presa ao doc `docs/meta-ia-2026-best-practices.md`: passo periódico (IA + web) que procura alterações/recomendações mais recentes e actualiza as práticas que alimentam o analista IA e a geração de copy. Fechar ciclo: resulta→continua, não resulta→repensa. Base: [[reference-meta-ia-2026-best-practices]].

- **SOCIAL-INBOX · Avisos de comentários/DMs do Facebook e Instagram que precisam de acção (IA prepara, João envia)** `[POR FAZER]` `P1?` (CAPTURE 03/06, ideia do João — "muito importante")
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
