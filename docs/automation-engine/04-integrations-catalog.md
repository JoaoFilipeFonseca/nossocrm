# 04 — Catálogo de Integrações

> **Pré-requisito**: Lê `03-atoms-catalog.md` primeiro.

Lista de integrações que a máquina suporta. Cada integração é um plugin que adiciona triggers e/ou actions ao registry. O átomo genérico `action.http_request` permite chamar qualquer API com token, mas integrações dedicadas oferecem UX optimizada.

## Prioridades de implementação

| Tier | Critério | Quando |
|---|---|---|
| **1 — Críticas** | Já existem em Foco Imo (reusar) ou essenciais para casos de uso #1 | Sprint 1-3 |
| **2 — Alta prioridade** | Imobiliário PT, produtividade diária do João | Sprint 4-6 |
| **3 — Útil** | Casos de uso secundários | Sprint 7+ |
| **4 — Futuro** | Quando justificar | Conforme necessidade |

---

## Tier 1 — Críticas (reaproveitamento + essenciais)

### WhatsApp Cloud API
- **Estado**: ✅ Já existe (`messaging-webhook-meta`)
- **Auth**: Meta access token
- **Triggers**: `message.received`, `message.delivered`, `message.read`
- **Actions**: `send_whatsapp` (texto, mídia, template, botões)
- **Reutilização**: Edge Function existente

### Gmail
- **Estado**: Novo
- **Auth**: OAuth 2.0
- **Triggers**: Email recebido (com filtros de label/from)
- **Actions**: Enviar, rascunho, aplicar label, arquivar, pesquisar
- **Scopes**: `gmail.send`, `gmail.modify`, `gmail.readonly`

### Google Drive
- **Estado**: Novo
- **Auth**: OAuth 2.0
- **Triggers**: Ficheiro criado/modificado em pasta X
- **Actions**: Upload, download, criar pasta, partilhar, copiar
- **Scopes**: `drive.file`, `drive.metadata.readonly`

### Google Calendar
- **Estado**: Parcial (já há deep-links, falta sync)
- **Auth**: OAuth 2.0
- **Triggers**: Evento criado, confirmado, cancelado, X min antes
- **Actions**: Criar/atualizar/eliminar evento, sugerir slots, convidar
- **Scopes**: `calendar`, `calendar.events`

### Meta Ads (Facebook + Instagram)
- **Estado**: Novo
- **Auth**: OAuth 2.0 (Business)
- **Triggers**: Novo lead em Lead Form, campanha terminou, orçamento atingido
- **Actions**: Criar/pausar/duplicar campanha, ajustar orçamento, criar audiência custom, sincronizar contactos
- **Webhook**: Configurar app Meta para enviar leads para `automation_webhook`

### Telegram Bot
- **Estado**: ✅ Já existe (bot completo)
- **Auth**: Bot Token (`organization_settings.telegram_bot_token`)
- **Triggers**: Comando recebido, mensagem em chat autorizado
- **Actions**: Enviar mensagem, botões inline, ficheiros
- **Reutilização**: Router IA universal existente

### GoHighLevel (GHL)
- **Estado**: ✅ Já existe (polling cron)
- **Auth**: API Key
- **Triggers**: Lead criado, opportunity moved, contact updated (via polling)
- **Actions**: CRUD completo (para sincronização)
- **Estratégia**: Manter como source enquanto se migra gradualmente

### Anthropic Claude + Gemini
- **Estado**: ✅ Já existe (`lib/ai/router.ts`)
- **Auth**: API Keys em `organization_settings`
- **Reutilização**: 100%. Átomo `action.ai_operation` usa `runWithFallback` directamente

---

## Tier 2 — Alta prioridade (imobiliário + produtividade)

### Idealista
- **Auth**: API B2B (se aprovado) ou Scraping com Playwright
- **Triggers**: Novo anúncio na zona, preço baixou
- **Actions**: Publicar listing, ler comparáveis
- **Notas**: API B2B tem requisitos. Scraping fallback.

### Imovirtual
- **Auth**: API B2B ou Scraping
- **Triggers/Actions**: Iguais a Idealista

### CasaSapo / Supercasa
- **Auth**: API B2B ou Scraping
- **Triggers/Actions**: Ler anúncios, preços

### Custojusto / OLX
- **Auth**: Scraping (Playwright)
- **Triggers**: Novo FSBO na zona
- **Actions**: Ler anúncios, detectar particulares

### Facebook Marketplace
- **Auth**: Scraping com Playwright autenticado
- **Triggers**: Novo anúncio em grupo/zona
- **Notas**: Sem API pública

### Casafari
- **Auth**: API B2B
- **Actions**: CMA automática para qualquer morada, comparáveis

### Notion
- **Auth**: OAuth 2.0 ou Integration Token
- **Triggers**: Página criada/modificada, propriedade alterada
- **Actions**: Criar página, atualizar, consultar BD, mover

### Calendly
- **Auth**: OAuth 2.0 ou API Key
- **Triggers**: Reunião marcada, cancelada, finalizada
- **Actions**: Criar tipo de evento, ler slots disponíveis

### Stripe
- **Auth**: API Key (secret + publishable)
- **Triggers**: Pagamento sucesso/falha, reembolso, subscrição
- **Actions**: Criar cliente, gerar link de pagamento, cobrar

### Slack
- **Auth**: OAuth 2.0
- **Triggers**: Mensagem em canal, reação, comando slash
- **Actions**: Enviar para canal/DM, criar canal

### Resend (email transacional)
- **Auth**: API Key
- **Actions**: Envio em massa, tracking de aberturas/cliques

### Twilio (SMS + Voice)
- **Auth**: Account SID + Auth Token
- **Triggers**: SMS recebido, chamada recebida
- **Actions**: Enviar SMS, fazer chamada, voicemail drop

### ElevenLabs
- **Auth**: API Key
- **Actions**: TTS premium, voz clonada (com consentimento)

### Apify
- **Estado**: Planeado em Foco Imo (remax.pt)
- **Auth**: API Token
- **Actions**: Executar actor de scraping, obter resultados

---

## Tier 3 — Útil

### LinkedIn Ads / Google Ads / TikTok Ads
- **Auth**: OAuth 2.0
- **Triggers**: Novo lead, conversão
- **Actions**: Gerir campanhas

### Microsoft 365 (Outlook + Calendar + OneDrive)
- **Auth**: OAuth 2.0 Microsoft Graph
- **Triggers/Actions**: Equivalentes Google

### HubSpot / Salesforce / Pipedrive
- **Auth**: OAuth 2.0 ou API Key
- **Uso**: Sincronização com outros CRMs

### Asana / Trello / ClickUp / Linear / Monday
- **Auth**: API Keys
- **Actions**: Criar tarefas, atualizar

### DocuSign / PandaDoc / HelloSign
- **Auth**: OAuth 2.0
- **Triggers**: Documento assinado/rejeitado
- **Actions**: Enviar para assinatura

### Discord / Microsoft Teams
- **Auth**: Bot Token / OAuth
- **Actions**: Mensagens em canais

### Mailchimp / ActiveCampaign / Brevo
- **Auth**: API Key
- **Actions**: Sincronização de listas

### Instagram / Facebook Pages / LinkedIn / Twitter
- **Auth**: OAuth 2.0
- **Triggers**: DM, comentário, menção
- **Actions**: Publicar post/story

### Google Maps Platform
- **Auth**: API Key
- **Actions**: Geocoding, distância, places, autocomplete de moradas

### Lob.com / Pingen / Click2Mail / Handwrytten
- **Auth**: API Keys
- **Actions**: Impressão e envio postal, cartas manuscritas

### Suno.ai / Runway / Pika / Replicate
- **Auth**: API Keys
- **Actions**: Geração de música, vídeo, imagens

### Voice agents (Vapi.ai, Bland.ai, Synthflow)
- **Auth**: API Keys
- **Actions**: Agente IA por chamada telefónica

---

## Tier 4 — Futuro / Niche

| Categoria | Exemplos |
|---|---|
| Bases de dados externas | PostgreSQL externo, MySQL, MongoDB, Redis |
| Storage alternativo | AWS S3, Cloudflare R2, Dropbox, OneDrive |
| Pagamentos PT | Easypay, IfThenPay, MBWay direto, SIBS |
| Faturação PT | Moloni, InvoiceXpress, Toconline |
| Analytics | Mixpanel, Amplitude, PostHog, Plausible |
| Voz | Whisper, Deepgram, AssemblyAI |
| Customer Support | Intercom, Zendesk, Freshdesk |
| HR / Comunidade | Discord communities, Circle, Slack Connect |
| Imobiliário internacional | Rightmove, Zillow, Idealista ES |
| Específicos PT | Predial Online, Casa Pronta, Diário da República (scraping) |

---

## Padrão de implementação de uma integração

Cada integração nova segue este padrão:

### 1. Definir a integração
```
/lib/automation-engine/plugins/integrations/<nome>/index.ts
```

Exporta `IntegrationDefinition` com:
- `provider`, `name`, `icon`
- `authType` e config de OAuth/API
- `getAccountInfo()` para mostrar nome da conta na UI
- `testConnection()` para validar credenciais

### 2. Criar triggers específicos
```
/lib/automation-engine/plugins/integrations/<nome>/triggers/
```

Cada trigger é um plugin que estende `trigger.webhook` ou `trigger.polling` com config UI dedicada.

### 3. Criar acções específicas
```
/lib/automation-engine/plugins/integrations/<nome>/actions/
```

Cada acção é um plugin com `configSchema` rico (UI optimizada para a integração).

### 4. Adicionar à página de integrações
A UI `/automacoes/integracoes` mostra todas as integrações disponíveis. O utilizador clica → OAuth flow ou form de API key → testa → guarda em `automation_integrations` (com credenciais encriptadas em `automation_credentials`).

### 5. Documentar
README dentro da pasta da integração com:
- Como obter credenciais
- Scopes necessários
- Webhooks a configurar do lado do provider
- Limites e cuidados

---

## OAuth genérico

Para serviços com OAuth 2.0 padrão, existe um helper genérico em `/lib/automation-engine/oauth/`:

```typescript
import { createOAuthHandler } from '@/lib/automation-engine/oauth';

export const googleDriveOAuth = createOAuthHandler({
  provider: 'google_drive',
  authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  scopes: ['https://www.googleapis.com/auth/drive.file'],
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  async getAccountInfo(accessToken) {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await res.json();
    return { accountId: data.sub, accountName: data.email };
  },
  async refreshTokenIfNeeded(refreshToken) {
    // implementação padrão
  }
});
```

O handler trata de:
- Iniciar OAuth flow (`/api/automation/oauth/start?provider=google_drive`)
- Callback (`/api/automation/oauth/callback`)
- Refresh automático antes de expirar
- Encriptação de tokens via `pgsodium`

---

## Estratégia: HTTP Request como fallback universal

Para qualquer serviço sem integração dedicada, o utilizador pode:

1. Adicionar credencial como "Generic API Key" em `automation_integrations`
2. Usar átomo `action.http_request` com `auth.integration_id` referenciando essa credencial
3. Configurar URL, método, headers, body

Isto significa que **qualquer API REST do mundo já é utilizável desde o dia 1**, mesmo sem integração formal.

---

## Próximo documento

Lê agora `05-plugin-system.md`.
