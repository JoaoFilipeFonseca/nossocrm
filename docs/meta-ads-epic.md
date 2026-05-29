# Épico — Integração Meta Ads (Foco Imo CRM)

> Visão completa aprovada pelo João (29/05/2026). "Quero tudo." Construir por fases, cada uma plan-first + verificada. Tudo assenta na FUNDAÇÃO (Fase A): ligar conta + atribuição por lead. Nada do resto liga sem isso.
> Estado base verificado: andaimes existem mas vazios e sem código (`automation_integrations`, `automation_credentials` com encrypted_data+nonce, `integration_inbound_sources`, `lead_routing_rules`, `leads`; `tags` com 64 linhas). OAuth Facebook, webhook de leads e métricas de ads NÃO codados. Reaproveitar `metaCapiEvent` do portal.

## Como liga em 2-3 cliques
Facebook Login for Business (OAuth). O peso é do lado do dev (criar Meta App + permissões). O João clica "Ligar Facebook", autoriza, escolhe Página + conta de anúncios. Token encriptado em `automation_credentials`. Subscrição do webhook leadgen automática.
- Uso pessoal do João: modo de desenvolvimento (admin/tester), funciona já, sem App Review.
- Vender a outros consultores (SaaS): exige App Review (`leads_retrieval`, `ads_read`, `ads_management`, `pages_*`, `business_management`). Não bloqueia o uso pessoal.

## NÚCLEO (não negociável): atribuição por lead
Cada lead/contacto/negócio guarda a linhagem do anúncio: campanha (id+nome), adset, anúncio (id+nome), criativo, formulário, plataforma (FB/IG), posicionamento. Propaga lead -> contacto -> negócio -> ganho/perdido + valor. Permite medir por anúncio: nº leads, dinheiro efectivo (soma de ganhos), conversão (lead->negócio, negócio->ganho), CPL, CPA, ROAS, qual não converteu, qual trouxe leads fracas.

## Fases
- **Fase A (fundação):** OAuth connect; auto-subscrição leadgen; webhook ingere lead -> cria lead/contacto com respostas do formulário no card + tag automática (linhagem do anúncio) -> entra no board/etapa (`integration_inbound_sources`/`lead_routing_rules`) -> publica evento `lead.meta_ads`.
- **Fase B (medição):** sync Marketing API (Insights) -> tabela `ad_insights` -> dashboard por anúncio/campanha com custo, leads, CPL, CPA, ROAS, dinheiro efectivo. Dashboard de unit economics (CAC vs LTV).
- **Fase C (conversas):** Messenger/IG/WhatsApp no inbox existente (`messaging_*`, `messaging-webhook-meta`). Responder a partir do card.
- **Fase D (assistente IA):** `run_ai` usa as respostas do formulário como contexto -> resposta personalizada instantânea (speed-to-lead).

## Optimização de volta para a Meta (o maior ganho, confirmado pelo João)
- **CAPI:** negócio ganho -> envia à Meta "lead = €X". Algoritmo passa a optimizar por receita real, não por preenchimentos. Reusar `metaCapiEvent` do portal.
- **Audiências automáticas:** clientes ganhos -> semente Lookalike; leads não convertidas -> retargeting; clientes actuais -> excluir dos anúncios.

## Backlog de crescimento (médio/longo prazo)
**Inteligência:**
- Lead scoring preditivo (won/lost + fonte + respostas do formulário).
- Motor de cadência: melhor altura e canal de follow-up por padrão histórico.
- Atribuição multi-touch (não só último clique).
- Recomendação de orçamento: "anúncio X tem CPA 3x melhor, reforça; Y desliga" (ou auto-pausar fracos via API).
- Geração IA de criativos a partir dos imóveis + Brand Kit.
- Previsão de receita do pipeline a partir do gasto.

**Omnicanal (mesma pipeline de atribuição):**
- Google Ads + lead forms; TikTok/LinkedIn Ads.
- Landing pages/calculadoras próprias com UTM (unificar leads web + ads).
- Click-to-WhatsApp ads.
- Motor de indicações/referências (imobiliário vive disto).
- Pedido automático de review Google após negócio ganho (prova social -> ads mais baratos).

**Imobiliário-específico:**
- Anúncios dinâmicos de catálogo a partir de `imoveis`.
- Geração de leads de angariação (donos: "quanto vale a minha casa") -> calculadora /avaliar -> pipeline de vendedor.
- Nurture por perfil de comprador com novos matches.
- Relatórios CMA/mercado como íman de leads (incentivo do formulário).

**Medição/operacional:**
- Funil por anúncio (impressões->clique->lead->contactado->qualificado->visita->ganho).
- Desempenho por criativo; saturação/frequência.
- Alertas de anomalia (CPA disparou, volume caiu, formulário partido).
- Alerta Telegram por lead nova.
- Multi-formulário/página/conta; consentimento RGPD; routing por consultor (equipa).

**Assistente IA end-to-end (SDR):**
- Qualifica por conversa, marca visita (calendário), actualiza etapa do negócio, sinaliza leads quentes no Telegram.

## Regra
Construir a Fase A primeiro. Tudo o resto depende da conexão + atribuição estarem vivas.
