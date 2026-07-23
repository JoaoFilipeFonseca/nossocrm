# Email inbound (respostas dos leads no CRM) — configuração na mão do João

> **O que já está feito (código, LIVE):** a edge `messaging-webhook-resend` passou a
> aceitar respostas de email (`email.received`), associá-las ao contacto+negócio
> (por `In-Reply-To`/`References` ou pelo remetente), gravar a mensagem na aba
> **Mensagens** e a **timeline do negócio**, marcar `replied_at` nos nurture. É
> idempotente, nunca devolve 5xx e aparece em **/automacoes** como *Email inbound
> (respostas dos leads)* — com botão ON/OFF. Verificado por simulação (curl).
>
> **Falta só isto:** dizer ao correio para entregar uma cópia das respostas ao CRM.
> São passos na Cloudflare/Resend (DNS + segredo) — por isso é a mão do João.

## Dados fixos

- **Canal Resend (id):** `a25fb3e9-e8e9-4449-9e85-c5fb379dcfa0`
- **Endpoint do CRM (inbound):**
  `https://zcqbbqrdbszzkpydrlmz.supabase.co/functions/v1/messaging-webhook-resend/a25fb3e9-e8e9-4449-9e85-c5fb379dcfa0`
- **Segredo do inbound (`inboundSecret`):** já gerado e gravado em
  `messaging_channels.credentials.inboundSecret` deste canal. **Não fica no
  repositório** (é um segredo). O valor é entregue ao João em separado para colar
  como *secret* do Worker (`CRM_INBOUND_SECRET`). Pode ser rodado quando quiser.

---

## Opção A (RECOMENDADA) — Cloudflare Email Worker (aditivo, não muda nada)

Vantagem: **mantém tudo como está** (o `reply-to` continua `joao@joaofilipefonseca.pt`
e as respostas continuam a chegar à caixa do João). O Worker só **acrescenta** uma
cópia ao CRM. Traz o corpo e os headers completos (não precisa da API do Resend).

**Passos na Cloudflare (conta onde já está o Email Routing do domínio):**

1. **Workers & Pages → Create → Worker.** Nome: `crm-email-inbound`. Colar o código
   de `docs/email-inbound-worker.js` (neste repositório).
2. **Settings → Variables and Secrets → Add secret:**
   - Nome: `CRM_INBOUND_SECRET`
   - Valor: *(o `inboundSecret` entregue em separado)*
3. **Email Routing → Email Workers** (ou **Rules**): encaminhar `joao@joaofilipefonseca.pt`
   (ou a regra catch-all que já usas) para o Worker `crm-email-inbound`.
4. No código do Worker, confirmar `FORWARD_TO` = o endereço de destino **já
   verificado** no Email Routing (a caixa para onde hoje reencaminhas — RE/MAX ou
   `joaofonseca_13_@hotmail.com`). O Worker reenvia para lá **e** copia para o CRM.

Não é preciso mexer em MX nem em reply-to. Nada fica bloqueado.

---

## Opção B (alternativa) — Resend Inbound num subdomínio dedicado

Vantagem: integração nativa com o Resend (mesma assinatura Svix). Desvantagem:
muda o `reply-to` para um subdomínio e as respostas passam a ir ao CRM (para
continuarem a chegar à caixa, configurar reencaminhamento no Resend).

1. **Resend → Domains → Add domain:** `reply.joaofilipefonseca.pt` (subdomínio
   dedicado, para **não** tocar no MX do domínio principal).
2. **Ativar Inbound** nesse subdomínio. O Resend mostra um **registo MX** com o
   valor exacto — algo como `inbound-smtp.<região>.amazonaws.com` — com a
   **prioridade mais baixa** (número menor que qualquer MX existente). Copiar o
   valor **tal como o Resend o mostra** para a Cloudflare (DNS do subdomínio).
3. **Mudar o `reply-to` do envio** para uma caixa nesse subdomínio, ex.:
   `respostas@reply.joaofilipefonseca.pt`. (No CRM: canal Resend →
   `credentials.replyTo`.)
4. **Resend → Webhooks → Add:** apontar para o **mesmo endpoint** acima (sem
   `?source=worker`), subscrever o evento **`email.received`** (e também
   `email.opened`/`email.clicked`/`email.bounced` para o resto do tracking).
5. Copiar o **Signing Secret** (Svix) do webhook para
   `messaging_channels.credentials.webhookSecret` deste canal.

> Nota: o `webhookSecret` de Svix **também** é o que falta para o tracking de
> aberturas/cliques do nurture (BRIEF 7) começar a funcionar. Vale a pena
> configurar o webhook do Resend de qualquer forma.

---

## Como testar depois de configurado

Responder a um email teu a partir de uma conta cujo endereço esteja num contacto
do CRM. Em segundos deve aparecer:
- a resposta na aba **Mensagens** (conversa do contacto);
- **"Resposta do cliente por email"** na **timeline do negócio** aberto;
- em **/automacoes → Email inbound**, a "Última corrida" atualizada.
