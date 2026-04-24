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

// Inicializar Firebase solo en producción (Vercel), desactivado en local (Live Server)
if (
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    location.hostname.startsWith('192.168.') ||
    location.hostname === '' // Live Server usa hostname vacío
) {
    window._firebaseActivo = false;
    console.warn('⚠️ Firebase desactivado — solo localStorage (entorno local)');
} else {
    window._firebaseActivo = true;
    console.log('✅ Firebase activo — entorno producción/nube');
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
