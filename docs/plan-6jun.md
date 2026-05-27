# Plano até 6/6/2026 — CRM Foco Imo pronto para usar

> Aprovado pelo João na sessão de 27/5/2026 ~23h.
> **Hoje:** 27/5. **Deadline:** 6/6. **10 dias.** 4-5 sessões úteis.

## Critério de "pronto" (6/6 23:59)

Quando estes 5 pontos forem TODOS verdes:

1. ✅ Métricas Honestas mostram números reais (não só contactos novos) — Sprint 11 já entregou
2. ✅ Registas CHQ em qualquer ponto do CRM com 1 clique — Sprint 13
3. ✅ Mobile + desktop sem scroll horizontal nem info cortada — Sprint 12
4. ✅ Vês deals frios à 1ª vista no /dashboard — Sprint 14
5. ✅ Backup automático configurado — Sprint 15

Se 1 dos 5 falhar → adiar live 2-3 dias. Sem self-engano.

## 4 Sprints

| Sprint | Quando | Objectivo único | Commits |
|---|---|---|---|
| **12** | 28-29/5 | Bugs gritantes que partem o fluxo | ~3 |
| **13** | 30-31/5 | CHQ em todo o lado sem pensar | ~3 |
| **14** | 2-3/6 | Alertas pipeline visíveis no daily | ~2 |
| **15** | 4-5/6 | Backup + checklist pré-live | ~2 |

### Sprint 12 — Bugs gritantes
- C1: B-006 DealDetailModal painel esquerdo compacto (Detalhes inline + Tags colapsáveis + mobile stack)
- C2: B-001 Inbox→Foco painel direito recolhível (drawer)
- C3: B-005 service worker cache busting forçado

### Sprint 13 — CHQ em todo o lado
- C1: LogCHQQuick na FocusContextPanel (Inbox Foco)
- C2: LogCHQQuick em `/contacts/[id]`
- C3: FAB CHQ global (canto inferior direito, picker de deal)

### Sprint 14 — Alertas pipeline úteis
- C1: Badge "Xd nesta fase" em cada DealCard (vermelho se >P95 do avg_time_per_stage)
- C2: Banner topo `/dashboard` se há deals estagnados (reaproveitar PipelineAlertsModal)

### Sprint 15 — Backup + checklist
- C1: Cron Supabase semanal dump JSON tabelas críticas → Storage `backups/`. Retenção 12.
- C2: `docs/checklist-pre-live.md` (passwords default, GTM, GDPR, iPhone E2E)

## Cortes ruthless — NÃO entram até 6/6

- ❌ Sweep PT-PT "deal"→"negócio" (B-007)
- ❌ `/settings/automation-logs` schema novo (B-008) — workaround `/automacoes`
- ❌ Repositório de prompts UI admin
- ❌ Drill-down CHQ por dia (polish do polish)
- ❌ Auto-CHQ na resposta a mensagens do inbox
- ❌ Multi-agent IA novo
- ❌ Imóveis Idealista import / Sites builder / Memberships
- ❌ Refactor visual dashboard
- ❌ Tudo M-xxx em CAPTURE.md

## Pacto

- João não acrescenta ideias novas durante sprints. Tudo o que aparecer → `CAPTURE.md`, não desvia.
- 1 objectivo por sprint. Se acabar antes, parar.
- Cada commit: tsc EXIT=0 + verify HTTP real + filtro "aproxima dos 100k€?".
- Domingo 1/6 = descanso (gravado em memory).

## Bloqueios externos (esperam)

- Resend (DKIM/SPF em joaofilipefonseca.pt) → `action.send_email`
- Meta Business Manager + WhatsApp Cloud API → `action.send_whatsapp`
- Cleanup polling GHL no Portal F&R (spawn task já criado)
