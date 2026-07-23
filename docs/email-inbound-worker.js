/**
 * Cloudflare Email Worker — copia as respostas dos leads para o CRM Foco Imo.
 *
 * O que faz: quando chega um email a joao@joaofilipefonseca.pt, (1) reenvia-o
 * para a caixa do João como sempre e (2) manda uma cópia normalizada ao webhook
 * do CRM, que a associa ao contacto/negócio e a grava na timeline.
 *
 * Nunca deixa de reenviar por causa do CRM (a cópia é best-effort).
 *
 * Setup: ver docs/email-inbound-cloudflare-checklist.md (Opção A).
 * Dependência: postal-mime (o Worker instala automaticamente ao publicar).
 * Secret necessário: CRM_INBOUND_SECRET (valor entregue em separado).
 */
import PostalMime from "postal-mime";

// Endpoint do CRM (com ?source=worker para autenticar por segredo partilhado).
const CRM_ENDPOINT =
  "https://zcqbbqrdbszzkpydrlmz.supabase.co/functions/v1/messaging-webhook-resend/a25fb3e9-e8e9-4449-9e85-c5fb379dcfa0?source=worker";

// Caixa de destino JÁ VERIFICADA no Email Routing (para onde reencaminhas hoje).
const FORWARD_TO = "joaofonseca_13_@hotmail.com";

export default {
  async email(message, env, ctx) {
    // 1) Copiar para o CRM — best-effort, nunca bloqueia o reencaminhamento.
    try {
      const parsed = await PostalMime.parse(message.raw);
      const fromAddr = parsed.from?.address || message.from;
      const fromName = parsed.from?.name || "";
      const payload = {
        type: "email.received",
        created_at: new Date().toISOString(),
        data: {
          email_id: parsed.messageId || crypto.randomUUID(),
          from: fromName ? `${fromName} <${fromAddr}>` : fromAddr,
          to: [message.to],
          subject: parsed.subject || "",
          text: parsed.text || "",
          html: parsed.html || "",
          message_id: parsed.messageId || "",
          in_reply_to: parsed.inReplyTo || "",
          references: parsed.references || "",
        },
      };
      ctx.waitUntil(
        fetch(CRM_ENDPOINT, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-inbound-secret": env.CRM_INBOUND_SECRET,
          },
          body: JSON.stringify(payload),
        }).catch(() => {}),
      );
    } catch (_e) {
      // Se o parse/POST falhar, não impedir a entrega ao João.
    }

    // 2) Continuar a entregar na caixa do João (comportamento actual).
    await message.forward(FORWARD_TO);
  },
};
