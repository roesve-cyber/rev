const admin = require('firebase-admin');
const functions = require('firebase-functions');

admin.initializeApp();

exports.enviarPushBoveda = functions.firestore
  .document('pushOutbox/{pushId}')
  .onCreate(async (snap) => {
    const db = admin.firestore();
    const data = snap.data() || {};

    if (data.type !== 'autorizacion_boveda') {
      await snap.ref.set({ status: 'ignored', ignoredAt: Date.now() }, { merge: true });
      return null;
    }

    const tokensSnap = await db.collection('pushTokens')
      .where('activo', '==', true)
      .where('rol', '==', 'admin')
      .get();

    const docs = tokensSnap.docs;
    const tokens = docs.map(doc => doc.data().token).filter(Boolean);

    if (!tokens.length) {
      await snap.ref.set({ status: 'no_admin_tokens', processedAt: Date.now() }, { merge: true });
      return null;
    }

    const message = {
      tokens,
      data: {
        title: String(data.title || 'Boveda de autorizaciones'),
        body: String(data.body || 'Tienes un pendiente por revisar.'),
        url: data.url || '/?view=autorizaciones',
        type: 'autorizacion_boveda',
        pushId: snap.id
      },
      webpush: {
        fcmOptions: {
          link: data.url || '/?view=autorizaciones'
        }
      }
    };

    const result = await admin.messaging().sendEachForMulticast(message);
    const desactivar = [];

    result.responses.forEach((response, index) => {
      if (response.success) return;
      const code = response.error && response.error.code;
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
        desactivar.push(docs[index].ref.set({ activo: false, error: code, actualizadoEn: Date.now() }, { merge: true }));
      }
    });

    if (desactivar.length) await Promise.all(desactivar);

    await snap.ref.set({
      status: 'sent',
      successCount: result.successCount,
      failureCount: result.failureCount,
      processedAt: Date.now()
    }, { merge: true });

    return null;
  });
