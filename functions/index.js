const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp }     = require('firebase-admin/app');
const { getFirestore }      = require('firebase-admin/firestore');
const { getMessaging }      = require('firebase-admin/messaging');

initializeApp();

exports.notificarNovaEntrega = onDocumentCreated(
  'entregas/{deliveryId}',
  async (event) => {
    const delivery   = event.data.data();
    const deliveryId = event.params.deliveryId;

    const db        = getFirestore();
    const messaging = getMessaging();

    const tokensSnap = await db.collection('fcm_tokens')
      .where('role', '==', 'entregador')
      .get();

    if (tokensSnap.empty) {
      console.log('[FCM] Nenhum entregador registrado.');
      return;
    }

    const tokens = tokensSnap.docs.map(doc => doc.data().token);

    const zoneLabel   = delivery.zone === 'geisel' ? 'Geisel' : 'Valentina';
    const paidLabel   = delivery.paid ? '✅ Pago' : '💰 Pagar na entrega';
    const methodMap   = { credito: 'Crédito', debito: 'Débito', dinheiro: 'Dinheiro', pix: 'PIX' };
    const methodLabel = methodMap[delivery.method] || delivery.method || '';

    const message = {
      notification: {
        title: `📦 Nova Entrega — ${zoneLabel}`,
        body:  `${delivery.name} · R$ ${delivery.value} · ${paidLabel}`,
      },
      data: {
        deliveryId,
        name:    delivery.name    || '',
        address: delivery.address || '',
        value:   delivery.value   || '',
        zone:    delivery.zone    || '',
        method:  methodLabel,
        paid:    String(delivery.paid),
        desc:    (delivery.desc || '').slice(0, 100),
      },
      webpush: {
        notification: {
          icon:  'https://i.postimg.cc/bN5NwWZs/Whats-App-Image-2026-03-04-at-16-46-09-removebg-preview.png',
          badge: '/icon-192.png',
          vibrate: [200, 100, 200],
          requireInteraction: true,
          actions: [
            { action: 'abrir',  title: '📋 Ver entrega' },
            { action: 'fechar', title: 'Fechar' }
          ]
        },
        fcmOptions: { link: '/' }
      },
      tokens,
    };

    const response = await messaging.sendEachForMulticast(message);
    console.log(`[FCM] Enviadas: ${response.successCount} | Falhas: ${response.failureCount}`);

    // Remove tokens inválidos automaticamente
    if (response.failureCount > 0) {
      const batch = db.batch();
      const invalidTokens = [];

      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const code = resp.error?.code;
          if (
            code === 'messaging/invalid-registration-token' ||
            code === 'messaging/registration-token-not-registered'
          ) {
            invalidTokens.push(tokens[idx]);
          }
        }
      });

      if (invalidTokens.length > 0) {
        const invalidsSnap = await db.collection('fcm_tokens')
          .where('token', 'in', invalidTokens)
          .get();
        invalidsSnap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }
    }
  }
);
