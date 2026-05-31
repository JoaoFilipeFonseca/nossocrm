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

---

## 🎯 PRIORIZAÇÃO (proposta aprovada pelo João 31/05/2026 — ajustável)

> Lógica: anúncios prestes a religar → leads a entrar. O que mede/converte/protege
> essas leads agora vale mais. 1 utilizador → RBAC não urgente. Diferenciador = CONTACT-360.
> **Arranque imediato: Q-1.**

**🥇 P1 — a seguir (ordem de execução):**
1. **Q-1** Sweep PT-BR→PT-PT (protege cada mensagem a leads novas) ← ARRANQUE
2. **NS-1** Custos + ROI no dashboard (núcleo "os números")
3. **MA-DRILLDOWN** dados por criativo (qual criativo dá dinheiro)
4. **CT-1 + CT-2** card de contacto rico + atribuição read-only (fundação CONTACT-360)

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

- **NS-1 · Custos operacionais + ROI no dashboard** `[POR FAZER]` `P?`
  A "obsessão pelos números" do João: medir gasto Gemini/Claude/Vercel/Supabase/ads e mostrar **ROI = receita/custos**. NÃO existe (`ai_usage`/`cost_events` ausentes na BD). Núcleo da visão. (origem: North Star + Dashboard #3 + Fase 5.3 + #87/#98)

- **NS-2 · CONTACT-360-AI — perfil 360° + IA que relaciona tudo** `[POR FAZER]` `P?`
  Visão-núcleo do João: "conhecer a pessoa de verdade", enriquecimento progressivo, IA cruza DISC+família+triggers+aniversário+última actividade → próxima melhor acção e copy hiper-pessoal. Meta: "pensa mais à frente, diferente de todos no imobiliário". Assenta em CONTACT-CARD-NOTION + MSG-WHATSAPP-PROPRIO + IA existente. Extensões: auto-enriquecimento por interacção, camada de relação (graph Referred By/Referred), próxima melhor acção, copy hiper-pessoal. (origem: CAPTURE CONTACT-360-AI)

### B. Contactos / dados ricos

- **CT-1 · CONTACT-CARD-NOTION — campos do card de contacto do Notion** `[POR FAZER]` `P?`
  Replicar campos do Notion: Address(Investment), Family Members, Pets, Triggers, Last Activity Date, Follow Up?, Referred By/Referred (relação contacto↔contacto), Notes ricas, DISC (cor), Quarter, Aniversário, Documentos, Comentários. Decidir coluna vs `custom_fields` jsonb; superfície (página /contacts/[id] ou bloco no ContactFormModal). Base do CONTACT-360-AI.

- **CT-2 · Painel de atribuição read-only no contacto (c4.2)** `[POR FAZER]` `P?`
  Bloqueado por não existir detalhe/página de contacto read-only. Acrescentar `attribution` ao tipo `Contact` + mapeamento de leitura em `lib/supabase/contacts.ts`. Componente `MetaAttribution.tsx` já existe.

- **CT-3 · Tag automática da linhagem (c4.3)** `[POR FAZER]` `P?`
  `contacts` não tem coluna `tags`. Mexe no modelo de tags + edge `automation-meta-leads` (aplicar "Meta Ads: <campanha>"). Ligado à regra origem-obrigatória.

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

- **MA-DRILLDOWN · Atribuição/controlo ao nível do criativo** `[POR FAZER]` `P?`
  Drill-down por anúncio (lista de leads/negócios + € efectivo), guardar+mostrar copy/headline/CTA do criativo (`ad_creatives` ganha title/body/cta), vista em árvore Campanha→Conjunto→Anúncio. Núcleo: medir qual criativo dá dinheiro. (origem: CAPTURE MA-DRILLDOWN)

- **MKT-STUDIO · Estúdio de marketing completo no CRM** `[POR FAZER]` `P?`
  Sub-épicos: MA-CREATE (criar campanha/anúncio via API), criativos+carrosséis IA c/ Brand Kit, LPs imóveis+captação, posts sociais, documentos (cartas/apresentações/ACM-CMA). Reusa Brand Kit, `/criativos`, `/avaliar`. (origem: CAPTURE MKT-STUDIO)

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

- **Q-1 · Défice sistémico PT-BR→PT-PT** `[POR FAZER]` `P?` 🔴
  Muito além de "atividade": registrar/registro, Buscar, você/seu, Salvar, selecionada, "Tem certeza que deseja excluir", R$/BRL/Oi/Abs. Sessão dedicada com glossário + sub-agente. Confirmar no nossocrm com grep. (origem: défice B-007)

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
