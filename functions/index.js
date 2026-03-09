const functions = require("firebase-functions");
const axios     = require("axios");

// ─── CONFIGURAÇÕES Z-API ──────────────────────────────────────────────────────
// Substitua pelos seus dados do painel z-api.io
const ZAPI_INSTANCE  = "SUA_INSTANCE_ID";
const ZAPI_TOKEN     = "SEU_TOKEN";
const ZAPI_CLIENT_TOKEN = "SEU_CLIENT_TOKEN"; // header Security-Token

// ─── MENSAGENS POR STATUS ─────────────────────────────────────────────────────
function buildMessage(delivery, newStatus) {
  const name  = delivery.name  || "Cliente";
  const value = delivery.value ? `R$ ${delivery.value}` : "";
  const addr  = delivery.address || "";

  const messages = {
    route: 
`🛵 *J.A Pet Shop — Entrega em Rota!*

Olá, *${name}*! 👋

Seu pedido saiu para entrega e já está a caminho! 🐾

📦 *Pedido:* ${delivery.desc || ""}
📍 *Endereço:* ${addr}
💰 *Total:* ${value}

Fique à vontade para aguardar. Em breve chegamos! 🚀`,

    done:
`✅ *J.A Pet Shop — Entrega Concluída!*

Olá, *${name}*! 

Sua entrega foi *concluída com sucesso*! 🎉🐾

Obrigado por comprar na J.A Pet Shop. 
Qualquer dúvida estamos à disposição! 😊`,

    pending:
`⏳ *J.A Pet Shop — Pedido Recebido!*

Olá, *${name}*! 👋

Seu pedido foi *registrado* e está na fila para entrega.

📦 *Pedido:* ${delivery.desc || ""}
📍 *Endereço:* ${addr}
💰 *Total:* ${value}

Em breve sairá para entrega! 🛵`,
  };

  return messages[newStatus] || null;
}

// ─── FUNÇÃO PRINCIPAL ─────────────────────────────────────────────────────────
exports.notifyDeliveryStatus = functions
  .region("southamerica-east1") // São Paulo — mais próximo do BR
  .firestore
  .document("entregas/{deliveryId}")
  .onUpdate(async (change, context) => {

    const before = change.before.data();
    const after  = change.after.data();

    // Só dispara se o STATUS realmente mudou
    if (before.status === after.status) return null;

    // Precisa ter telefone
    const rawPhone = after.phone || before.phone || "";
    if (!rawPhone) {
      console.log(`[Z-API] Sem telefone para entrega ${context.params.deliveryId}`);
      return null;
    }

    // Formata para padrão internacional (Brasil)
    // "(83) 9 9999-9999" → "5583999999999"
    const digits = rawPhone.replace(/\D/g, "");
    const phone  = digits.startsWith("55") ? digits : `55${digits}`;

    const message = buildMessage(after, after.status);
    if (!message) return null;

    console.log(`[Z-API] Enviando para ${phone} — status: ${after.status}`);

    try {
      const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`;

      await axios.post(
        url,
        { phone, message },
        {
          headers: {
            "Content-Type":  "application/json",
            "Client-Token":  ZAPI_CLIENT_TOKEN,
          },
          timeout: 10000,
        }
      );

      console.log(`[Z-API] ✅ Mensagem enviada para ${phone}`);
    } catch (err) {
      const detail = err.response?.data || err.message;
      console.error("[Z-API] ❌ Erro ao enviar:", JSON.stringify(detail));
    }

    return null;
  });
