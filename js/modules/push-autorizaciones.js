// ===== PUSH BOVEDA DE AUTORIZACIONES =====
const PUSH_AUTH_CONFIG_KEY = 'configPushAutorizaciones';
const PUSH_AUTH_TOKEN_KEY = 'pushTokenAutorizaciones';

function _pushAuthSesion() {
    try { return JSON.parse(sessionStorage.getItem('sesionActiva') || 'null'); } catch { return null; }
}

function _pushAuthConfig() {
    return StorageService.get(PUSH_AUTH_CONFIG_KEY, {
        activo: false,
        vapidKey: '',
        ultimoToken: '',
        ultimoRegistro: ''
    });
}

function _pushAuthGuardarConfig(config) {
    StorageService.set(PUSH_AUTH_CONFIG_KEY, { ..._pushAuthConfig(), ...config });
}

function _pushAuthTokenId(token) {
    return btoa(token).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '').slice(0, 180);
}

function _pushAuthUrlBoveda() {
    return `${location.origin}/?view=autorizaciones`;
}

function _pushAuthMessagingDisponible() {
    return !!(window._firebaseActivo && (window._messaging || (window.firebase && firebase.messaging)) && navigator.serviceWorker && window.Notification);
}

function renderPushAutorizacionesConfig() {
    const cont = document.getElementById('configPushAutorizaciones');
    if (!cont) return;

    const config = _pushAuthConfig();
    const sesion = _pushAuthSesion();
    const permiso = window.Notification ? Notification.permission : 'no soportado';
    const tokenLocal = localStorage.getItem(PUSH_AUTH_TOKEN_KEY) || '';
    const firebaseEstado = window._firebaseActivo ? 'Firebase activo' : 'Firebase inactivo en este entorno';
    const puedeActivar = _pushAuthMessagingDisponible();

    cont.innerHTML = `
        <div style="display:grid; gap:14px;">
            <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:10px;">
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px;">
                    <small style="font-weight:800; color:#64748b;">ESTADO</small><br>
                    <strong style="color:${config.activo && tokenLocal ? '#15803d' : '#92400e'};">${config.activo && tokenLocal ? 'Celular registrado' : 'Pendiente de activar'}</strong>
                </div>
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px;">
                    <small style="font-weight:800; color:#64748b;">PERMISO</small><br>
                    <strong>${permiso}</strong>
                </div>
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px;">
                    <small style="font-weight:800; color:#64748b;">NUBE</small><br>
                    <strong>${firebaseEstado}</strong>
                </div>
            </div>
            <div>
                <label style="display:block; font-size:12px; font-weight:bold; color:#475569; margin-bottom:5px;">Firebase Web Push certificate / VAPID key</label>
                <input id="pushAuthVapidKey" value="${config.vapidKey || ''}" placeholder="Pega aqui la llave VAPID publica de Firebase Messaging" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:7px; box-sizing:border-box;">
                <div style="font-size:12px; color:#64748b; margin-top:5px;">Se obtiene en Firebase Console > Project settings > Cloud Messaging > Web Push certificates.</div>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <button onclick="guardarConfigPushAutorizaciones()" style="padding:10px 16px; background:#475569; color:white; border:none; border-radius:7px; font-weight:bold; cursor:pointer;">Guardar llave</button>
                <button onclick="activarPushAutorizaciones()" ${puedeActivar ? '' : 'disabled'} style="padding:10px 16px; background:${puedeActivar ? '#c2410c' : '#cbd5e1'}; color:white; border:none; border-radius:7px; font-weight:bold; cursor:${puedeActivar ? 'pointer' : 'not-allowed'};">Activar en este celular</button>
                <button onclick="probarPushAutorizaciones()" ${tokenLocal ? '' : 'disabled'} style="padding:10px 16px; background:${tokenLocal ? '#2563eb' : '#cbd5e1'}; color:white; border:none; border-radius:7px; font-weight:bold; cursor:${tokenLocal ? 'pointer' : 'not-allowed'};">Probar aviso local</button>
            </div>
            <div style="font-size:12px; color:#64748b; line-height:1.45;">
                Usuario actual: <b>${sesion?.nombre || sesion?.email || sesion?.usuario || '-'}</b> (${sesion?.rol || '-'})
                ${!window._firebaseActivo ? '<br><span style="color:#b45309;">En local no se registran tokens reales; funciona al publicarlo en HTTPS/Vercel.</span>' : ''}
            </div>
        </div>`;
}

function guardarConfigPushAutorizaciones() {
    const vapidKey = document.getElementById('pushAuthVapidKey')?.value.trim() || '';
    _pushAuthGuardarConfig({ vapidKey });
    renderPushAutorizacionesConfig();
    alert('Configuracion de push guardada.');
}

async function activarPushAutorizaciones() {
    const config = _pushAuthConfig();
    const vapidKey = document.getElementById('pushAuthVapidKey')?.value.trim() || config.vapidKey || '';
    if (!vapidKey) return alert('Primero pega y guarda la llave VAPID publica de Firebase Messaging.');
    if (!_pushAuthMessagingDisponible()) return alert('Este entorno no soporta push o Firebase Messaging no esta activo.');
    if (!window._messaging && window.firebase && firebase.messaging) {
        window._messaging = firebase.messaging();
    }

    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') return alert('El celular/navegador no concedio permiso para notificaciones.');

    const registration = await navigator.serviceWorker.register('/sw.js');
    const token = await window._messaging.getToken({ vapidKey, serviceWorkerRegistration: registration });
    if (!token) return alert('Firebase no devolvio token. Revisa la llave VAPID y que la app este en HTTPS.');

    const sesion = _pushAuthSesion() || {};
    const payload = {
        token,
        usuarioId: sesion.uid || sesion.id || sesion.usuario || '',
        usuarioNombre: sesion.nombre || sesion.email || sesion.usuario || 'Usuario',
        rol: sesion.rol || '',
        activo: true,
        userAgent: navigator.userAgent,
        actualizadoEn: Date.now()
    };

    localStorage.setItem(PUSH_AUTH_TOKEN_KEY, token);
    _pushAuthGuardarConfig({ activo: true, vapidKey, ultimoToken: token, ultimoRegistro: new Date().toISOString() });

    if (window._db) {
        await window._db.collection('pushTokens').doc(_pushAuthTokenId(token)).set(payload, { merge: true });
    }

    if (window._messaging.onMessage) {
        window._messaging.onMessage((message) => {
            _pushAuthMostrarNotificacionLocal({
                title: message.notification?.title || message.data?.title || 'Boveda de autorizaciones',
                body: message.notification?.body || message.data?.body || 'Tienes una autorizacion pendiente.',
                url: message.data?.url || _pushAuthUrlBoveda()
            });
        });
    }

    renderPushAutorizacionesConfig();
    alert('Este celular quedo registrado para alertas de Boveda.');
}

async function _pushAuthMostrarNotificacionLocal({ title, body, url }) {
    if (!('serviceWorker' in navigator) || !('Notification' in window) || Notification.permission !== 'granted') return false;
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title || 'Boveda de autorizaciones', {
        body: body || 'Tienes una autorizacion pendiente.',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'boveda-autorizaciones',
        data: { url: url || _pushAuthUrlBoveda() }
    });
    return true;
}

async function probarPushAutorizaciones() {
    const mostrado = await _pushAuthMostrarNotificacionLocal({
        title: 'Prueba Boveda de autorizaciones',
        body: 'Si ves este aviso, el celular puede mostrar notificaciones.',
        url: _pushAuthUrlBoveda()
    });
    if (!mostrado) alert('No se pudo mostrar la prueba. Revisa permisos de notificacion.');
}

async function notificarBovedaAutorizacion(payload = {}) {
    const tipo = payload.tipo || 'autorizacion';
    const titulo = payload.titulo || 'Pendiente en Boveda de autorizaciones';
    const cuerpo = payload.cuerpo || 'Hay un movimiento pendiente por revisar.';
    const url = payload.url || _pushAuthUrlBoveda();
    const evento = {
        id: payload.id || `${tipo}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        tipo,
        titulo,
        cuerpo,
        url,
        targetRoles: payload.targetRoles || ['admin'],
        estado: 'pendiente',
        creadoEn: Date.now(),
        payload
    };

    const historial = StorageService.get('notificacionesAutorizacion', []);
    historial.unshift(evento);
    StorageService.set('notificacionesAutorizacion', historial.slice(0, 200));

    if (window._firebaseActivo && window._db) {
        try {
            await window._db.collection('pushOutbox').add({
                type: 'autorizacion_boveda',
                title: titulo,
                body: cuerpo,
                url,
                targetRoles: evento.targetRoles,
                status: 'pending',
                createdAt: Date.now(),
                payload: evento.payload
            });
        } catch (err) {
            console.warn('No se pudo crear pushOutbox. Se conserva registro local.', err);
        }
    }

    const sesion = _pushAuthSesion();
    if (sesion?.rol === 'admin') {
        _pushAuthMostrarNotificacionLocal({ title: titulo, body: cuerpo, url });
    }
}

window.renderPushAutorizacionesConfig = renderPushAutorizacionesConfig;
window.guardarConfigPushAutorizaciones = guardarConfigPushAutorizaciones;
window.activarPushAutorizaciones = activarPushAutorizaciones;
window.probarPushAutorizaciones = probarPushAutorizaciones;
window.notificarBovedaAutorizacion = notificarBovedaAutorizacion;
