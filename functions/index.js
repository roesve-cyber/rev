const admin = require('firebase-admin');
const functions = require('firebase-functions');

admin.initializeApp();

// Dominio donde vive tu sistema, SIN diagonal final (ej. 'https://mipueblito.vercel.app').
// Se usa para que el mensaje de Telegram lleve un enlace directo a la Bóveda.
// Si lo dejas vacío, el mensaje se manda igual, solo sin enlace.
const APP_BASE_URL = '';

const URL_BOVEDA_DEFAULT = '/?view=autorizaciones';

function urlAbsoluta(url) {
  const u = String(url || URL_BOVEDA_DEFAULT);
  if (/^https?:\/\//i.test(u)) return u;
  return APP_BASE_URL ? APP_BASE_URL + (u.startsWith('/') ? u : '/' + u) : '';
}

// ---------------------------------------------------------------------------
// TELEGRAM -- secretos: TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID
// (TELEGRAM_CHAT_ID puede ser uno o varios ids separados por coma).
// Nunca lanza: devuelve { status, ... } para no tumbar el push si Telegram falla.
// ---------------------------------------------------------------------------
async function enviarTelegram(titulo, cuerpo, url) {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chats = (process.env.TELEGRAM_CHAT_ID || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!token || !chats.length) return { status: 'not_configured' };

  const enlace = urlAbsoluta(url);
  const texto = (`🔔 ${titulo}\n\n${cuerpo}` + (enlace ? `\n\n👉 ${enlace}` : '')).slice(0, 4000);

  let ok = 0;
  const errores = [];
  for (const chatId of chats) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: texto,
          disable_web_page_preview: true,
          disable_notification: false
        }),
        signal: ctrl.signal
      });
      clearTimeout(timer);
      const json = await resp.json().catch(() => ({}));
      if (resp.ok && json.ok) ok++;
      else errores.push(`${chatId}: ${json.description || resp.status}`);
    } catch (err) {
      errores.push(`${chatId}: ${err.message || err}`);
    }
  }
  return {
    status: ok > 0 ? 'sent' : 'failed',
    enviados: ok,
    ...(errores.length ? { error: errores.join(' | ').slice(0, 300) } : {})
  };
}

// ---------------------------------------------------------------------------
// PUSH (FCM) -- mismo comportamiento de siempre, con prioridad alta.
// ---------------------------------------------------------------------------
async function enviarPush(db, data, pushId) {
  const tokensSnap = await db.collection('pushTokens')
    .where('activo', '==', true)
    .where('rol', '==', 'admin')
    .get();

  const docs = tokensSnap.docs;
  const tokens = docs.map(doc => doc.data().token).filter(Boolean);
  if (!tokens.length) return { status: 'no_admin_tokens' };

  const link = data.url || URL_BOVEDA_DEFAULT;
  const message = {
    tokens,
    data: {
      title: String(data.title || 'Boveda de autorizaciones'),
      body: String(data.body || 'Tienes un pendiente por revisar.'),
      url: link,
      type: 'autorizacion_boveda',
      pushId
    },
    // Prioridad alta: que el sistema despierte el celular y no lo agrupe/retrase.
    android: { priority: 'high', ttl: 3600 * 1000 },
    webpush: {
      headers: { Urgency: 'high', TTL: '3600' },
      fcmOptions: { link }
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

  return { status: 'sent', successCount: result.successCount, failureCount: result.failureCount };
}

exports.enviarPushBoveda = functions
  .runWith({ secrets: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'], timeoutSeconds: 60 })
  .firestore
  .document('pushOutbox/{pushId}')
  .onCreate(async (snap, context) => {
    const db = admin.firestore();
    const data = snap.data() || {};

    if (data.type !== 'autorizacion_boveda') {
      await snap.ref.set({ status: 'ignored', ignoredAt: Date.now() }, { merge: true });
      return null;
    }

    const titulo = String(data.title || 'Boveda de autorizaciones');
    const cuerpo = String(data.body || 'Tienes un pendiente por revisar.');
    const pushId = (context && context.params && context.params.pushId) || snap.id;

    // Los dos canales corren en paralelo y son independientes: si uno falla,
    // el otro se manda igual.
    const [pushRes, tgRes] = await Promise.allSettled([
      enviarPush(db, data, pushId),
      enviarTelegram(titulo, cuerpo, data.url)
    ]);

    const push = pushRes.status === 'fulfilled'
      ? pushRes.value
      : { status: 'push_error', error: String(pushRes.reason && pushRes.reason.message || pushRes.reason).slice(0, 300) };
    const tg = tgRes.status === 'fulfilled'
      ? tgRes.value
      : { status: 'failed', error: String(tgRes.reason && tgRes.reason.message || tgRes.reason).slice(0, 300) };

    await snap.ref.set({
      status: push.status, // se conserva el significado original (sent / no_admin_tokens)
      ...(push.successCount !== undefined ? { successCount: push.successCount, failureCount: push.failureCount } : {}),
      ...(push.error ? { pushError: push.error } : {}),
      telegramStatus: tg.status,
      ...(tg.enviados !== undefined ? { telegramEnviados: tg.enviados } : {}),
      ...(tg.error ? { telegramError: tg.error } : {}),
      processedAt: Date.now()
    }, { merge: true });

    return null;
  });
