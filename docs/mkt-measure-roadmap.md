# MKT-MEASURE — Roteiro de Medição & Inteligência (mapa do plano)

> Mapa pedido pelo João (08/06/2026). Objectivo dele: **ter os dados todos do que faz
> (anúncios, calculadoras, posts orgânicos, funil de vendas) num só sítio, e perceber
> onde se perde gente e porque não fecha.** Não é um Pixel mágico — são **4 fontes**
> que se montam por peças e se unem no fim (MKT-BRAIN). A CAPI (o desfecho) já está feita.

## As 4 fontes (de onde vêm os dados)

| Fonte | O que mede | Onde vive | Estado |
|---|---|---|---|
| **Anúncios pagos** | impressões, cliques, custo, CPL, leads por anúncio | Meta + CRM `/anuncios` | ✅ já existe (Fase B + analista IA) |
| **Desfecho (CRM → Meta)** | negócio ganho + valor (comissão líquida) | CAPI `meta-capi-forward` | ✅ FEITO (08/06) |
| **Páginas tuas (site/calculadoras)** | visitas, passos, tempo, scroll, abandono | Pixel + beacon próprio | ⏳ por fazer |
| **Orgânico (posts FB/IG, Página)** | alcance, interações, melhores posts | API de Insights da Página | ⏳ por fazer |

**Distinção crítica:** o **Pixel** só vê o que acontece **nas tuas páginas web**; o que se
passa *dentro* do Facebook/Instagram (um post orgânico) só se tira pela **API da Página**.

## As peças (com o que respondem e esforço)

### 1. MKT-FUNNEL-CRM — funil de vendas DENTRO do CRM  ·  esforço **S/M**  ·  *começar por aqui*
- **Responde a:** "quanto tempo cada negócio fica em cada etapa, onde encalham, porque não fecho."
- **Como:** painel novo no CRM que **lê dados que já existem** (`board_stages`, `last_stage_change_date`, `deal_activities`, `is_won/is_lost/loss_reason`). Calcula: tempo médio por etapa, taxa de passagem etapa→etapa, gargalo, motivos de perda agregados.
- **Instrumentação nova:** nenhuma. Só leitura + agregação (RPC + página). Entrega rápida.
- **Já existe parte:** o dashboard já detecta "estagnados +10 dias".

### 2. MA-PIXEL-EVENTS — Pixel + eventos nas páginas  ·  esforço **M**
- **Responde a:** dá à Meta os sinais para optimizar/remarketing + base de medição web.
- **Como:** Pixel `226877513589288` + eventos padrão/à medida (ViewContent, Lead, passos da calculadora) via **GTM** (`GTM-KK65ZDBS`, já existe). Mexe nas **landing pages/calculadoras (projecto portal-app)**, não no CRM.
- **Liga-se à CAPI** (já feita) para a Meta cruzar clique → página → desfecho.

### 3. MKT-FUNNEL-LP — funil das PÁGINAS (abandono)  ·  esforço **M/L**
- **Responde a:** "quantos entram, quantos NÃO preenchem, em que passo desistem, tempo na página, scroll."
- **Como:** "sensor" próprio (beacon) nas LP/calculadoras → manda um sinal por passo → tabela no Supabase do CRM (`funnel_events`) → painel no CRM (entraram 100 → começaram 60 → passo 3 35 → submeteram 20, com o gargalo a vermelho).
- **Nota arquitectura:** as páginas vivem no **portal-app**; a tabela e o painel no **CRM** (cross-project). Pode aproveitar o mesmo momento de instrumentação da peça 2.

### 4. MKT-ORGANIC-INSIGHTS — orgânico/Página  ·  esforço **M**
- **Responde a:** "os meus posts (não pagos) — alcance, interações, quais funcionam melhor."
- **Como:** API de Insights da Página (Graph API) → tabela no CRM → a par dos anúncios.

### 5. MKT-BRAIN — cérebro: juntar tudo + padrões  ·  esforço **L**  ·  *última*
- **Responde a:** o teu "ter os dados todos juntos" — anúncios + orgânico + páginas + funil + desfecho num só sítio, e a **IA estuda padrões** (que anúncio/post/página trazem os que fecham) para alimentar entrega/retargeting.
- **Depende de:** as peças 1-4 estarem a alimentar dados.

## Sequência recomendada (e porquê)

1. **MKT-FUNNEL-CRM** — valor imediato, sem instrumentação; responde já ao "porque não fecho".
2. **MA-PIXEL-EVENTS** — base de medição web + remarketing; instrumenta as páginas (uma vez).
3. **MKT-FUNNEL-LP** — aproveita a instrumentação para o "onde abandonam" detalhado.
4. **MKT-ORGANIC-INSIGHTS** — acrescenta o orgânico.
5. **MKT-BRAIN** — só faz sentido com as outras a alimentar; une tudo + IA.

> Regra do João: maqueta-primeiro nas peças visuais; cada peça é um ticket próprio;
> verificar em produção; PT-PT pré-AO; multi-tenant + RLS; automações em /automacoes.
