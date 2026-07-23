# PAINEL DIÁRIO — Brief de construção (maqueta validada pelo João a 23/07/2026)

> **Prompt pronto a entregar a um agente construtor (Opus/Claude Code) numa sessão dedicada.**
> A maqueta visual foi validada pelo João. Este documento é a fonte de verdade do que construir.

---

## 1. Objectivo (palavras do João)

"Todos os dias olhar para isto é o mais importante do negócio — sem isto não tenho negócio."

Construir o **Painel Diário** do CRM Foco Imo: a visão única que o João vê **sempre que abre o CRM**,
com números **actuais ao minuto, sem falhas**. É o cockpit do negócio imobiliário dele
(vendedores + compradores), inspirado no painel do formador (screenshot na conversa de 23/07),
adaptado ao imobiliário.

## 2. Onde vive

- **Reconstruir a página `/dashboard`** (`features/dashboard` + `app/(protected)/dashboard/page.tsx`)
  como o Painel Diário. NÃO criar rota nova nem entrada nova na sidebar (regra: não inchar a barra lateral).
- A página de arranque já é configurável: `app/(protected)/page.tsx` lê `user_settings.default_route`
  (Configurações → Página Inicial) com fallback `/dashboard`. **Garantir que o default do João é `/dashboard`**
  — de raiz vê sempre o painel, e mantém a opção de mudar nas definições (já existe, não reinventar).

## 3. Layout validado (de cima para baixo)

Tema escuro, grelha de cartões como a maqueta. 8 blocos:

### 3.1 Cabeçalho
- "João Fonseca · Painel Diário" + subtítulo curto.
- Chips de janela temporal: **30d · 90d · 365d** (persistir a escolha; default 90d).
  A janela aplica-se aos KPIs, receita e top canais. Funis e tarefas são estado actual.

### 3.2 Dois funis lado a lado: **Vendedores** e **Compradores**
- Barras por etapa com contagem de negócios abertos (etapas reais dos boards: `boards` + `board_stages`,
  coluna `"order"`; board "Proprietários" = Vendedores).
- Última barra a verde = ganhos na janela.
- Nota no canto: "etapa que mais trava" (a etapa com maior perda relativa face à anterior).

### 3.3 Linha de 4 KPIs
1. **Facturação (janela)** — comissões efectivamente recebidas. Fonte: área `/financeiro`
   (inspeccionar `features/financeiro` para a tabela real de receitas; se a receita viver nos
   negócios ganhos, usar isso e dizê-lo no relatório final).
2. **Pipeline previsto** — soma do valor previsto de TODOS os negócios abertos
   (`deals.value`, status open). ⚠️ memória da casa: `deals.status='open'` ≠ `stage_id` — verificar
   a semântica real antes de somar.
3. **Negócios abertos** — total + split "X vendedores · Y compradores".
4. **Fechados (janela)** — negócios ganhos, com split (vendas · escrituras comprador).

### 3.4 Receita por linha (janela)
Quatro linhas com barra horizontal + valor: **Vendedores · Compradores · Arrendamento · Créditos**.
- Verificar se existe taxonomia de linha de receita no financeiro (há `settings/products`).
- Se não existir, criar mapeamento simples (ex.: por board/tipo de negócio + categoria manual
  para arrendamento e créditos) — migration idempotente, e documentar a decisão.

### 3.5 Pipeline aberto por etapa · valor previsto
Tabela/barras: etapa → nº de negócios → **soma do valor previsto nessa etapa**.
Etapas agregadas dos dois funis (Contactos, Qualificação, Reunião/Visita, Estudo entregue,
Angariação activa, Proposta/CPCV — usar as etapas reais dos boards, não inventar).

### 3.6 ♥ O DIA — Tarefas e Follow ups (o coração; cartão com destaque laranja)
- 4 números grandes: **pendentes** (todas as tarefas abertas agendadas), **para hoje**,
  **atrasadas** (vencidas e não feitas — a vermelho), **feitas hoje** (a verde).
- Linha por baixo — chamadas de hoje: **Tentativas N (não atenderam)** · **Realizadas N (falei mesmo)**.
  Fonte: `deal_activities` com o vocabulário de `lib/activities/vocab.ts`:
  `no_answer` + `voicemail` = tentativa; `answered` + `returned` = conversa real.
- Reutilizar a lógica existente da Power List / página `/hoje`
  (`features/hoje/HojePage.tsx`, `app/api/power-list/*`, RPC `power_list`) — NÃO duplicar regras.

### 3.7 Carteira de imóveis
- Deriva sozinha dos dados — zero registo manual extra. Fonte: área `/imoveis`
  (`app/(protected)/imoveis`) + negócios de angariação ligados.
- Por imóvel activo: nome curto, **dias no mercado** (desde a angariação), **visitas** e
  **propostas** (da timeline `deal_activities` do negócio ligado).
- Rodapé: "Esta semana: N visitas marcadas · próximo passo: …" (da tarefa mais próxima ligada
  a um imóvel).
- Badge com contagem de activos. Quando vende/arquiva, sai sozinho.

### 3.8 Top canais por negócio (janela)
Dois cartões: **Vendedores** e **Compradores**, cada um com ranking de origens e contagens.
Fonte: atribuição real dos negócios/contactos (`deal.attribution.*` / source) — usar as origens
que já existem no CRM (FSBO/Radar Maia, chamadas a frio, círculo de influência, Meta Ads,
portais, WhatsApp, referências, manual). Não inventar canais.

## 4. Actualização — requisito inegociável

- **Sempre actual ao abrir**: dados lidos na hora, nunca relatório em cache.
- **Auto refresh a cada 60 segundos** com o painel aberto (TanStack Query `refetchInterval`)
  + `refetchOnWindowFocus`.
- **Tempo real**: subscrições via o padrão existente `lib/realtime/useRealtimeSync.ts`
  (invalidação targeted — nunca global) para `deals`, `tasks` e `deal_activities`.
- **Performance**: preferir **uma RPC agregadora** (ex.: `dashboard_snapshot(org_id, window)`)
  que devolva tudo num só round trip, em vez de 10 queries do cliente. Migration idempotente,
  `SECURITY INVOKER` se possível; filtrar SEMPRE `organization_id` (defesa em profundidade além do RLS).

## 5. Regras da casa (INEGOCIÁVEIS)

- **PT-PT pré-AO 1990** em todo o copy (facturação, actual, contacto…); zero brasileirismos.
- **NUNCA a palavra "avaliação"** — usar "Estudo de Mercado" / "Análise de Mercado" (João é AMI, não perito).
- Sem travessões no copy; Domingos nunca aparecem em nada agendado.
- Mobile obrigatório: verificar 375 / 768 / desktop + modo escuro (tripla verificação, todos os estados:
  vazio, a carregar, erro, com dados).
- Bump da versão humana na sidebar (`YYMMDD_HHmm`).
- Se tocar em edge functions: `verify_jwt: false` + confirmar com curl → 403.
- Qualquer automação nova aparece em `/automacoes` (não deve ser preciso aqui — o painel é leitura).
- Nunca limpar dados de teste com `deleted_at` por SQL directo.

## 6. Definição de pronto (a regra do João: "pronto" = deploy + teste real)

1. `npm run precheck` verde (lint + typecheck + vitest + build).
2. **git push → deploy Vercel** (o CRM só fica live assim).
3. Teste ponta a ponta em produção com os dados reais do João: números batem certo com
   os boards, o /hoje e o /financeiro; criar 1 follow up real e vê-lo reflectido no painel
   em ≤60s sem refresh manual.
4. Verificação mobile 375/768 + desktop + escuro.
5. Relatório final honesto: o que cada número lê, de que tabela, e o que ficou pendente.

## 7. Fora de âmbito (capturado, NÃO construir agora)

- Bloco "Radar Maia" (FSBO novos do dia) como alternativa/complemento à Carteira — capturado no TODO.md.
- Metas/objectivos por período no painel (existe `settings/metas` — integração fica para fase 2 se o João pedir).
