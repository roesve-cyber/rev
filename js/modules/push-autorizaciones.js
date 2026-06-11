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

function _pushAuthUsuarioFirebaseActual() {
    return window._auth?.currentUser || null;
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
                <button onclick="probarPushAutorizacionesNube()" ${window._firebaseActivo ? '' : 'disabled'} style="padding:10px 16px; background:${window._firebaseActivo ? '#0f766e' : '#cbd5e1'}; color:white; border:none; border-radius:7px; font-weight:bold; cursor:${window._firebaseActivo ? 'pointer' : 'not-allowed'};">Probar push real</button>
                <button onclick="diagnosticarPushAutorizaciones()" style="padding:10px 16px; background:#334155; color:white; border:none; border-radius:7px; font-weight:bold; cursor:pointer;">Diagnosticar</button>
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
    const firebaseUser = _pushAuthUsuarioFirebaseActual();
    if (!firebaseUser) return alert('Para registrar este celular necesitas iniciar sesion con un usuario de Firebase Auth, no con usuario/PIN local.');
    if (!window._messaging && window.firebase && firebase.messaging) {
        window._messaging = firebase.messaging();
    }

    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') return alert('El celular/navegador no concedio permiso para notificaciones.');

    const registration = await navigator.serviceWorker.register('/sw.js');
    try { await registration.update(); } catch {}
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

    try {
        if (window._db) {
            await window._db.collection('pushTokens').doc(_pushAuthTokenId(token)).set(payload, { merge: true });
        }
        localStorage.setItem(PUSH_AUTH_TOKEN_KEY, token);
        _pushAuthGuardarConfig({ activo: true, vapidKey, ultimoToken: token, ultimoRegistro: new Date().toISOString() });
    } catch (err) {
        localStorage.removeItem(PUSH_AUTH_TOKEN_KEY);
        _pushAuthGuardarConfig({ activo: false, ultimoToken: '', ultimoRegistro: '' });
        renderPushAutorizacionesConfig();
        return alert('Firebase rechazo el registro del celular: ' + err.message + '\n\nInicia sesion con un usuario Firebase activo y con perfil en Usuarios.');
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

async function diagnosticarPushAutorizaciones() {
    const config = _pushAuthConfig();
    const sesion = _pushAuthSesion() || {};
    const firebaseUser = _pushAuthUsuarioFirebaseActual();
    const token = localStorage.getItem(PUSH_AUTH_TOKEN_KEY) || '';
    const lineas = [];

    lineas.push(`Firebase: ${window._firebaseActivo && window._db ? 'activo' : 'inactivo/no conectado'}`);
    lineas.push(`Sesion: ${sesion?.rol || 'sin rol'} (${sesion?.email || sesion?.usuario || sesion?.nombre || '-'})`);
    lineas.push(`Firebase Auth: ${firebaseUser ? firebaseUser.email || firebaseUser.uid : 'sin usuario autenticado'}`);
    lineas.push(`Service Worker: ${'serviceWorker' in navigator ? 'soportado' : 'no soportado'}`);
    lineas.push(`Notificaciones navegador: ${window.Notification ? Notification.permission : 'no soportadas'}`);
    lineas.push(`Firebase Messaging: ${window._messaging ? 'disponible' : 'no disponible aun'}`);
    lineas.push(`VAPID key: ${config.vapidKey ? 'guardada' : 'faltante'}`);
    lineas.push(`Token local: ${token ? 'guardado' : 'faltante'}`);

    try {
        if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.getRegistration('/sw.js');
            lineas.push(`SW /sw.js: ${reg ? 'registrado' : 'sin registro'}`);
            if (reg) {
                try { await reg.update(); } catch {}
            }
        }
    } catch (err) {
        lineas.push(`SW error: ${err.message}`);
    }

    if (window._firebaseActivo && window._db) {
        try {
            if (token) {
                const tokenDoc = await window._db.collection('pushTokens').doc(_pushAuthTokenId(token)).get();
                lineas.push(`Token en Firestore: ${tokenDoc.exists ? 'si' : 'no'}`);
                if (tokenDoc.exists) {
                    const d = tokenDoc.data() || {};
                    lineas.push(`Token activo/rol: ${d.activo !== false ? 'activo' : 'inactivo'} / ${d.rol || '-'}`);
                }
            }
            if (sesion.rol === 'admin') {
                const snap = await window._db.collection('pushTokens').where('activo', '==', true).where('rol', '==', 'admin').get();
                lineas.push(`Tokens admin activos: ${snap.size}`);
            }
            const outbox = await window._db.collection('pushOutbox').orderBy('createdAt', 'desc').limit(1).get();
            if (!outbox.empty) {
                const d = outbox.docs[0].data() || {};
                lineas.push(`Ultimo pushOutbox: ${d.status || 'sin status'} (${outbox.docs[0].id})`);
            } else {
                lineas.push('Ultimo pushOutbox: ninguno');
            }
        } catch (err) {
            lineas.push(`Firestore diagnostico: ${err.message}`);
        }
    }

    alert(lineas.join('\n'));
    console.log('Diagnostico push autorizaciones:', lineas);
}

async function probarPushAutorizacionesNube() {
    if (!window._firebaseActivo || !window._db) return alert('La prueba real requiere Firebase activo en produccion.');
    const sesion = _pushAuthSesion() || {};
    if (!sesion.rol) return alert('No hay sesion activa para crear la prueba.');
    const firebaseUser = _pushAuthUsuarioFirebaseActual();
    if (!firebaseUser) {
        return alert('No se puede crear pushOutbox porque no hay usuario autenticado en Firebase Auth.\n\nCierra sesion e inicia con email/contrasena de Firebase, no con usuario/PIN local.');
    }

    let ref;
    try {
        ref = await window._db.collection('pushOutbox').add({
            type: 'autorizacion_boveda',
            title: 'Prueba real de notificacion',
            body: `Prueba enviada desde ${sesion.nombre || sesion.email || sesion.usuario || 'el sistema'}.`,
            url: _pushAuthUrlBoveda(),
            targetRoles: ['admin'],
            status: 'pending',
            createdAt: Date.now(),
            payload: { prueba: true, creadoPor: sesion.uid || sesion.id || sesion.usuario || '' }
        });
    } catch (err) {
        return alert('No se pudo crear pushOutbox: ' + err.message + '\n\nSi el error es permission-denied, revisa que tu usuario exista en Firebase Auth y en la coleccion usuarios con rol activo.');
    }

    const inicio = Date.now();
    let ultimo = null;
    while (Date.now() - inicio < 12000) {
        await new Promise(r => setTimeout(r, 1500));
        const snap = await ref.get();
        ultimo = snap.data() || {};
        if (ultimo.status && ultimo.status !== 'pending') break;
    }

    if (!ultimo || !ultimo.status || ultimo.status === 'pending') {
        return alert(`Se creo la prueba (${ref.id}), pero sigue pendiente.\n\nEso normalmente significa que la Cloud Function enviarPushBoveda no esta desplegada o no esta ejecutandose.`);
    }
    if (ultimo.status === 'no_admin_tokens') {
        return alert(`La Function si corrio, pero no encontro celulares admin registrados.\n\nActiva las notificaciones desde el celular/admin que debe recibirlas.`);
    }
    if (ultimo.status === 'sent') {
        return alert(`Push procesado.\nEnviados: ${ultimo.successCount || 0}\nFallidos: ${ultimo.failureCount || 0}\n\nSi enviados es 0 o no aparecio en el celular, revisa permisos del navegador o token.`);
    }
    alert(`Resultado de pushOutbox: ${ultimo.status}`);
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
window.diagnosticarPushAutorizaciones = diagnosticarPushAutorizaciones;
window.probarPushAutorizacionesNube = probarPushAutorizacionesNube;
window.notificarBovedaAutorizacion = notificarBovedaAutorizacion;
