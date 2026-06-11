// ===== CONFIGURACIÓN FIREBASE =====
// Reemplaza los valores con las credenciales de tu proyecto en Firebase Console.
// https://console.firebase.google.com/

const firebaseConfig = {
    apiKey: "AIzaSyALvu7jMIiwJy2zY96fmeQR9M_tLR6mDUI",
    authDomain: "mmpueblito-8fb29.firebaseapp.com",
    projectId: "mmpueblito-8fb29",
    storageBucket: "mmpueblito-8fb29.firebasestorage.app",
    messagingSenderId: "32950655624",
    appId: "1:32950655624:web:42a8657431319f9a25dd3d"
};

window.firebaseConfig = firebaseConfig;

// Inicializar Firebase solo en producción (Vercel), desactivado en local (Live Server)
if (
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    location.hostname.startsWith('192.168.') ||
    location.hostname === '' // Live Server usa hostname vacío
) {
    // ==== ENTORNO LOCAL (PRUEBAS) ====
    window._firebaseActivo = false;
    console.warn('⚠️ Firebase desactivado — solo localStorage (entorno local)');
} else {
    // ==== ENTORNO PRODUCCIÓN (WEB/VERCEL) ====
    window._firebaseActivo = true;
    console.log('✅ Firebase activo — entorno producción/nube');

    // Promesa que resuelve cuando Firebase (persistencia + messaging) está listo.
    // Úsala con: await window._firebaseReady  antes de cualquier operación Firestore/Messaging.
    window._firebaseReady = (async () => {
        if (typeof firebase === 'undefined') {
            console.error('❌ Firebase SDK no cargado');
            return;
        }

        firebase.initializeApp(firebaseConfig);
        window._auth = firebase.auth();
        window._db   = firebase.firestore();
        window.db    = window._db;

        // Persistencia offline — esperamos el resultado antes de continuar
        try {
            await window._db.enablePersistence({ synchronizeTabs: true });
            console.log('✅ Persistencia offline activada.');
        } catch (err) {
            if (err.code === 'failed-precondition') {
                // Varias pestañas abiertas: la persistencia solo funciona en una,
                // pero Firestore sigue operativo sin caché local.
                console.warn('⚠️ Persistencia desactivada: múltiples pestañas. Firestore sigue activo.');
            } else if (err.code === 'unimplemented') {
                console.warn('⚠️ El navegador no soporta persistencia offline.');
            }
            // No relanzar — Firestore es funcional aunque no haya caché.
        }

        // Messaging — también esperado para que _messaging esté listo antes de getToken()
        if (firebase.messaging) {
            try {
                const soportado = firebase.messaging.isSupported
                    ? await Promise.resolve(firebase.messaging.isSupported())
                    : true;
                if (soportado) {
                    window._messaging = firebase.messaging();
                    console.log('✅ Firebase Messaging inicializado.');
                }
            } catch (err) {
                console.warn('Firebase Messaging no soportado en este navegador:', err);
            }
        }
    })();
}

// Actualiza el indicador de estado de Firebase en el panel de nube
function _actualizarEstadoFirebaseUI() {
    const el = document.getElementById('estadoFirebase');
    if (!el) return;
    if (window._firebaseActivo) {
        el.innerHTML = '<span style="color:#16a34a;font-weight:bold;">✅ Firebase activo y conectado</span>';
    } else if (typeof firebase === 'undefined') {
        el.innerHTML = '<span style="color:#dc2626;">❌ SDK de Firebase no cargado</span>';
    } else {
        el.innerHTML = '<span style="color:#d97706;">⚠️ Firebase no configurado — edita <code>js/services/firebase-config.js</code> con tus credenciales</span>';
    }
}
