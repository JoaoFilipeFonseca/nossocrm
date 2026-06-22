# Landing "Análise de Mercado" — preparação (NÃO construir ainda)

> Guardado a 22/06/2026. A landing foi criada pelo João num chat de IA e **só existia
> nessa conversa** — estes ficheiros são a cópia de segurança. **Decisão do João (22/06):
> opção A — fazer bem numa sessão dedicada.** Este é, na prática, o **primeiro "Ativo Digital"**
> (ver épico Ativos Digitais no `TODO.md`).

## Ficheiros aqui
- `analise-mercado.html` — frontend (multi-passo, on-brand, capta UTMs). **Reutilizável** com 3 retoques (abaixo).
- `route.reference.ts` — backend ORIGINAL do João. **REFERÊNCIA, não usar tal como está** (grava em tabela isolada).
- `leads_captura.reference.sql` — tabela isolada ORIGINAL. **Provavelmente NÃO usada** (ver decisão).

## 🚨 Decisão de arquitetura (porque NÃO usar `leads_captura`)
A versão original grava numa tabela `leads_captura` **desligada do CRM** → as leads não
viravam contacto nem negócio, sem proveniência, invisíveis no Inbox/funil/score. Contradiz
o modelo (contacto≠lead, proveniência obrigatória, funil único).

**Como fazer (na sessão dedicada):** a rota `POST /api/leads/captura-amc` (no CRM, `nossocrm`)
deve **criar/actualizar um contacto + criar um negócio** com proveniência, à imagem da
recepção de leads do Meta Ads. Concretamente:
- **Contacto:** dedup por telefone (normalizado); se existe, reutiliza; senão cria com
  `source` da proveniência. Guardar email, e os dados do imóvel/intenção em campos/notas.
- **Negócio:** funil **Proprietários** (board `d08c7329-9e3e-43d1-ba42-6437a8363ae8`), etapa
  **"Contactos"** (order 0) — é um lead de venda/avaliação. Atribuição/proveniência via
  `deal_activities` (actor) e/ou coluna `deals.attribution` (jsonb) — confirmar o padrão
  exacto usado pela recepção Meta Ads e reutilizá-lo (não inventar).
- **Proveniência obrigatória:** `source = 'landing-analise-mercado'` + UTMs guardados.
- **Anti-spam/validação:** manter o `isTelefoneValido` (lógica boa), validar email e consentimento.
- **Webhook nunca 5xx em erro lógico** (devolver 200/400 limpos; CORS para o domínio final).
- Reutilizar o cliente Supabase do CRM (`@/lib/supabase` staticAdminClient, filtrar org_id).

## Retoques no HTML (frontend)
1. **Link da Política de Privacidade** — hoje é `href="#"`. Apontar para a política real
   ( liga ao épico Ativos Digitais, onde a política vai viver).
2. **Endpoint** — `CRM_ENDPOINT` aponta para `/api/leads/captura-amc`. Em produção, com a
   landing noutro domínio, tem de ser o URL absoluto do CRM (`https://crm.joaofilipefonseca.pt/...`)
   e o CORS da rota tem de permitir o domínio da landing.
3. **Foto/coerência de marca** — o João quer a foto dele (frente de marca). Hoje a coluna
   direita é um degradé placeholder (`.hero-form::before`) — trocar por foto do João.

## ❓ Por resolver com o João (antes de construir)
- **Onde vive `joaofilipefonseca.pt`?** Que repo/alojamento (Vercel? outro?) — o HTML tem de
  ir para lá; **não está neste workspace** (aqui só temos o CRM `nossocrm`).
- **Rastreio** — confirmar se além de UTMs há píxel/ID próprio a manter (coerência com os
  outros ativos: `/diagnostico`, `/avaliar`, `/bolso`, `/estrategia`, `/moradiapacosferreira`).

## Como encaixa
Parte do épico **Ativos Digitais** (catálogo+CRUD na Biblioteca + rebranding com a marca do
João). Ordem do plano: 1) coexistência do número WhatsApp · 2) Caixa Social completa ·
3) Ativos Digitais (onde isto entra).
