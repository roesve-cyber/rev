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

// Inicializar Firebase (solo si el SDK está disponible y las credenciales fueron configuradas)
if (typeof firebase !== 'undefined' && firebaseConfig.apiKey !== "TU_API_KEY") {
    try {
        if (!firebase.apps || !firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        window._db = firebase.firestore();
        window._firebaseActivo = true;
        console.log('✅ Firebase inicializado correctamente');
    } catch (e) {
        window._firebaseActivo = false;
        console.warn('⚠️ Error iniciando Firebase:', e.message);
    }
} else {
    window._firebaseActivo = false;
    if (typeof firebase === 'undefined') {
        console.warn('⚠️ Firebase SDK no disponible — usando localStorage');
    } else {
        console.warn('⚠️ Credenciales Firebase no configuradas — usando localStorage');
    }
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
