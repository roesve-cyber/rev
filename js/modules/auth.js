// ===== AUTENTICACIÓN Y ROLES =====

const _USUARIOS_DEFAULT = [
    { id: 1, usuario: 'admin', pin: '1234', rol: 'admin', activo: true },
    { id: 2, usuario: 'vendedor', pin: '0000', rol: 'vendedor', activo: true }
];

function _getUsuarios() {
    return StorageService.get('usuariosConfig', _USUARIOS_DEFAULT);
}

function getSesion() {
    try { return JSON.parse(sessionStorage.getItem('sesionActiva')); } catch { return null; }
}

const AUTH_INACTIVITY_LIMIT_MS = 20 * 60 * 1000;
const AUTH_ACTIVITY_EVENTS = ['click', 'keydown', 'touchstart', 'mousemove', 'scroll'];
let _authInactivityTimer = null;
let _authActivityListenersReady = false;
let _authLastActivityMs = 0;
let _authLastPersistMs = 0;
let _authLoginManualEnCurso = false;

function _guardarSesionActiva(sesion) {
    if (!sesion) return;
    const ahora = Date.now();
    const sesionConActividad = { ...sesion, _lastActivity: ahora };
    sessionStorage.setItem('sesionActiva', JSON.stringify(sesionConActividad));
    _authLastActivityMs = ahora;
    _authLastPersistMs = ahora;
    _activarControlInactividad();
}

function _programarCierrePorInactividad() {
    clearTimeout(_authInactivityTimer);
    const restante = Math.max(1000, AUTH_INACTIVITY_LIMIT_MS - (Date.now() - _authLastActivityMs));
    _authInactivityTimer = setTimeout(() => _cerrarSesionPorInactividad(), restante);
}

function _registrarActividadSesion() {
    if (!getSesion()) return;
    const ahora = Date.now();
    if (ahora - _authLastActivityMs < 1000) return;
    _authLastActivityMs = ahora;
    if (ahora - _authLastPersistMs > 60000) {
        const sesion = getSesion();
        if (sesion) {
            sesion._lastActivity = ahora;
            sessionStorage.setItem('sesionActiva', JSON.stringify(sesion));
            _authLastPersistMs = ahora;
        }
    }
    _programarCierrePorInactividad();
}

function _activarControlInactividad() {
    const sesion = getSesion();
    if (!sesion) return;
    _authLastActivityMs = Number(sesion._lastActivity || Date.now());
    _authLastPersistMs = _authLastActivityMs;

    if (Date.now() - _authLastActivityMs >= AUTH_INACTIVITY_LIMIT_MS) {
        _cerrarSesionPorInactividad();
        return;
    }

    if (!_authActivityListenersReady) {
        AUTH_ACTIVITY_EVENTS.forEach(evt => {
            window.addEventListener(evt, _registrarActividadSesion, { passive: true });
        });
        window.addEventListener('focus', _registrarActividadSesion);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) return;
            const sesionActual = getSesion();
            const ultima = Number(sesionActual?._lastActivity || _authLastActivityMs || 0);
            if (ultima && Date.now() - ultima >= AUTH_INACTIVITY_LIMIT_MS) {
                _cerrarSesionPorInactividad();
            } else {
                _registrarActividadSesion();
            }
        });
        _authActivityListenersReady = true;
    }

    _programarCierrePorInactividad();
}

async function _cerrarSesionInterno({ confirmar = false, motivo = '' } = {}) {
    if (confirmar && !confirm('¿Cerrar sesión?')) return;
    clearTimeout(_authInactivityTimer);
    sessionStorage.removeItem('sesionActiva');
    if (window._firebaseActivo && window._auth) {
        try { await window._auth.signOut(); } catch (e) { console.warn('No se pudo cerrar Firebase Auth:', e); }
    }
    if (motivo) {
        try { sessionStorage.setItem('_loginMensaje', motivo); } catch(e) {}
    }
    location.reload();
}

async function _cerrarSesionPorInactividad() {
    if (!getSesion() && !(window._firebaseActivo && window._auth?.currentUser)) return;
    await _cerrarSesionInterno({ confirmar: false, motivo: 'Sesion cerrada por inactividad.' });
}

function esAdmin() {
    return getSesion()?.rol === 'admin';
}

function _normalizarTextoUsuarioVendedor(valor) {
    return String(valor || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function obtenerVendedorDeUsuario(usuario = getSesion()) {
    if (!usuario || usuario.rol !== 'vendedor') return null;
    const vendedores = StorageService.get('vendedores', []).filter(v => v.activo !== false);
    if (!vendedores.length) return null;

    if (usuario.vendedorId !== undefined && usuario.vendedorId !== null && usuario.vendedorId !== '') {
        const directo = vendedores.find(v => String(v.id) === String(usuario.vendedorId));
        if (directo) return directo;
    }

    const clavesUsuario = [
        usuario.nombre,
        usuario.usuario,
        usuario.email
    ].map(_normalizarTextoUsuarioVendedor).filter(Boolean);

    const porNombre = vendedores.find(v => {
        const nombreVend = _normalizarTextoUsuarioVendedor(v.nombre);
        return clavesUsuario.some(clave => clave === nombreVend || clave.includes(nombreVend) || nombreVend.includes(clave));
    });
    if (porNombre) return porNombre;

    return vendedores.length === 1 ? vendedores[0] : null;
}

function _sesionDesdePerfil({ uid, email, perfil = {}, fallbackNombre = '' }) {
    const base = {
        uid,
        email,
        nombre: perfil.nombre || fallbackNombre || email,
        rol: perfil.rol || 'vendedor',
        vendedorId: perfil.vendedorId || null,
        vendedorNombre: perfil.vendedorNombre || null
    };
    const vendedor = obtenerVendedorDeUsuario(base);
    if (vendedor) {
        base.vendedorId = vendedor.id;
        base.vendedorNombre = vendedor.nombre;
    }
    return base;
}

async function _obtenerPerfilFirebaseActivo(user) {
    if (!window._firebaseActivo || !window._db || !user?.uid) return null;
    const snap = await window._db.collection('usuarios').doc(user.uid).get();
    if (!snap.exists) {
        const err = new Error('Tu usuario existe en Firebase Auth, pero no tiene perfil autorizado en /usuarios. Pide a un administrador que lo active.');
        err.code = 'mmp/profile-missing';
        throw err;
    }
    const perfil = snap.data() || {};
    if (perfil.activo === false) {
        const err = new Error('Este usuario esta desactivado. Pide a un administrador que lo reactive.');
        err.code = 'mmp/profile-disabled';
        throw err;
    }
    return perfil;
}

// Escapa caracteres HTML para prevenir XSS al insertar datos de usuario en HTML
function _esc(str) {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Recarga todas las variables globales del sistema desde localStorage.
 * Se llama después de syncAll() para que las vistas reflejen los datos
 * recién traídos desde Firestore (especialmente en ventana privada/nueva).
 */
function _recargarVariablesGlobales() {
    try {
        window.productos       = StorageService.get('productos', []);
        window.clientes        = StorageService.get('clientes', []);
        window.proveedores     = StorageService.get('proveedores', []);
        window.carrito         = StorageService.get('carrito', []);
        window.cuentasPorCobrar    = StorageService.get('cuentasPorCobrar', []);
        window.pagaresSistema      = StorageService.get('pagaresSistema', []);
        window.compras             = StorageService.get('compras', []);
        window.cuentasPorPagar     = StorageService.get('cuentasPorPagar', []);
        window.movimientosCaja     = StorageService.get('movimientosCaja', []);
        window.tarjetasConfig      = StorageService.get('tarjetasConfig', []);
        window.gastosOperativos    = StorageService.get('gastosOperativos', []);
        window.cotizaciones        = StorageService.get('cotizaciones', []);
        window.vendedores          = StorageService.get('vendedores', []);
        window.comisionesRegistradas = StorageService.get('comisionesRegistradas', []);
        window.puntosPorCliente    = StorageService.get('puntosPorCliente', []);
        window.programaPuntos      = StorageService.get('programaPuntos', {});
        window.descuentosActivos   = StorageService.get('descuentosActivos', []);
        window.usuariosConfig      = StorageService.get('usuariosConfig', []);
        window.categoriasGasto     = StorageService.get('categoriasGasto', []);
        window.registroTickets     = StorageService.get('registroTickets', []);
        window.deudasMSI           = StorageService.get('deudasMSI', []);
        window.recepciones         = StorageService.get('recepciones', []);
        window.categoriasData      = StorageService.get('categoriasData', []);
        window.movimientosInventario   = StorageService.get('movimientosInventario', []);
        window.cuentasEfectivo         = StorageService.get('cuentasEfectivo', []);
        window.ordenesCompra           = StorageService.get('ordenesCompra', []);
        window.apartados               = StorageService.get('apartados', []);
        window.historialDevoluciones   = StorageService.get('historialDevoluciones', []);
        window.garantiasProductos      = StorageService.get('garantiasProductos', []);
        window.salidasPendientesVenta  = StorageService.get('salidasPendientesVenta', []);
        window.requisicionesCompra     = StorageService.get('requisicionesCompra', []);
        // Asignar también en scope local (módulos que usan variables sin window.)
        if (typeof clientes !== 'undefined')           clientes           = window.clientes;
        if (typeof carrito !== 'undefined')            carrito            = window.carrito;
        if (typeof cuentasPorCobrar !== 'undefined')   cuentasPorCobrar   = window.cuentasPorCobrar;
        if (typeof pagaresSistema !== 'undefined')     pagaresSistema     = window.pagaresSistema;
        if (typeof compras !== 'undefined')            compras            = window.compras;
        if (typeof cuentasPorPagar !== 'undefined')    cuentasPorPagar    = window.cuentasPorPagar;
        if (typeof movimientosCaja !== 'undefined')    movimientosCaja    = window.movimientosCaja;
        if (typeof tarjetasConfig !== 'undefined')     tarjetasConfig     = window.tarjetasConfig;
        if (typeof proveedores !== 'undefined')        proveedores        = window.proveedores;
        if (typeof recepciones !== 'undefined')        recepciones        = window.recepciones;
        if (typeof deudasMSI !== 'undefined')          deudasMSI          = window.deudasMSI;
        if (typeof movimientosInventario !== 'undefined') movimientosInventario = window.movimientosInventario;
        if (typeof salidasPendientesVenta !== 'undefined') salidasPendientesVenta = window.salidasPendientesVenta;
        if (typeof requisicionesCompra !== 'undefined')    requisicionesCompra    = window.requisicionesCompra;
        if (typeof categoriasData !== 'undefined')     categoriasData     = window.categoriasData;
        console.log('✅ Variables globales recargadas desde localStorage (post-sync)');
    } catch(e) {
        console.warn('⚠️ Error recargando variables globales:', e.message);
    }
}

function _hayDatosOperativosAuth() {
    return ['productos', 'clientes', 'cuentasPorCobrar', 'pagaresSistema', 'ventasRegistradas', 'movimientosCaja'].some(tabla => {
        const datos = StorageService.get(tabla, []);
        return Array.isArray(datos) && datos.length > 0;
    });
}

let _syncFirebasePostLoginPromise = null;

async function _sincronizarFirebaseDespuesDeLogin() {
    if (!window._firebaseActivo || !window._db || !window._auth?.currentUser || !window.StorageService?.syncAll) {
        return false;
    }
    if (_syncFirebasePostLoginPromise) return _syncFirebasePostLoginPromise;

    _syncFirebasePostLoginPromise = (async () => {
        if (!_hayDatosOperativosAuth()) {
            console.warn('Almacen local vacio; descargando datos iniciales desde Firebase despues de login.');
            await StorageService.syncAll({ forzarDescarga: true, source: 'server' });
        } else {
            console.warn('Verificando cambios remotos de Firebase despues de login.');
            await StorageService.syncAll({ source: 'server', forzarDescarga: true });
        }

        if (typeof StorageService.normalizarListasLocales === 'function') {
            await StorageService.normalizarListasLocales();
        }

        _recargarVariablesGlobales();
        if (typeof StorageService._refrescarVistaActualPostSync === 'function') {
            StorageService._refrescarVistaActualPostSync();
        }
        if (typeof StorageService.startRealtimeSync === 'function') {
            StorageService.startRealtimeSync();
        }
        return true;
    })();

    try {
        return await _syncFirebasePostLoginPromise;
    } catch (err) {
        console.warn('No se pudo sincronizar Firebase despues de login:', err);
        return false;
    } finally {
        _syncFirebasePostLoginPromise = null;
    }
}

// ── helpers de pantalla de login ──────────────────────────────────────────────
function mostrarErrorLogin(msg) {
    const errEl = document.getElementById('loginError');
    if (errEl) errEl.textContent = msg;
    const card = document.querySelector('#loginOverlay > div');
    if (card) {
        card.classList.add('shake');
        setTimeout(() => card.classList.remove('shake'), 500);
    }
}

function ocultarLoginScreen() {
    document.getElementById('loginOverlay')?.remove();
}

function mostrarLoginScreen() {
    if (!document.getElementById('loginOverlay')) {
        _crearPantallaLogin();
    }
}

let _pinIntentosAdmin = 0;
let _pinBloqueadoHasta = 0;

function _pinAdminRestanteBloqueo() {
    return Math.max(0, Math.ceil((_pinBloqueadoHasta - Date.now()) / 1000));
}

// ── requireAdmin ──────────────────────────────────────────────────────────────
function requireAdmin(callback) {
    if (esAdmin()) { callback(); return; }
    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'ACCESO_ADMIN_REQUERIDO',
            modulo: 'Seguridad',
            entidad: 'admin',
            detalle: 'Se solicito autorizacion de administrador para continuar',
            severidad: 'riesgo'
        });
    }
    let html;
    if (window._firebaseActivo && window._auth) {
        html = `
    <div data-modal="req-admin" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:100000;display:flex;align-items:center;justify-content:center;">
      <div style="background:white;border-radius:12px;padding:28px;width:100%;max-width:360px;text-align:center;">
        <div style="font-size:40px;margin-bottom:12px;">🔐</div>
        <h3 style="margin:0 0 8px;color:#1e40af;">Acción restringida</h3>
        <p style="color:#6b7280;font-size:14px;margin:0 0 20px;">Ingresa las credenciales de un administrador para continuar.</p>
        <input type="email" id="adminEmailInput" placeholder="Email administrador" autocomplete="email"
          style="width:100%;padding:10px;border:2px solid #d1d5db;border-radius:8px;font-size:14px;box-sizing:border-box;margin-bottom:8px;">
        <input type="password" id="adminPassInput" placeholder="Contraseña" autocomplete="current-password"
          style="width:100%;padding:10px;border:2px solid #d1d5db;border-radius:8px;font-size:14px;box-sizing:border-box;"
          onkeydown="if(event.key==='Enter') _verificarCredencialesAdmin(document.getElementById('adminEmailInput').value, this.value)">
        <div id="adminPinError" style="color:#dc2626;font-size:13px;min-height:20px;margin-top:8px;"></div>
        <div style="display:flex;gap:10px;margin-top:16px;">
          <button onclick="_verificarCredencialesAdmin(document.getElementById('adminEmailInput').value, document.getElementById('adminPassInput').value)"
            style="flex:1;padding:10px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">✅ Verificar</button>
          <button onclick="document.querySelector('[data-modal=req-admin]')?.remove()"
            style="padding:10px 18px;background:#6b7280;color:white;border:none;border-radius:6px;cursor:pointer;">✕</button>
        </div>
      </div>
    </div>`;
    } else {
        html = `
    <div data-modal="req-admin" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:100000;display:flex;align-items:center;justify-content:center;">
      <div style="background:white;border-radius:12px;padding:28px;width:100%;max-width:360px;text-align:center;">
        <div style="font-size:40px;margin-bottom:12px;">🔐</div>
        <h3 style="margin:0 0 8px;color:#1e40af;">Acción restringida</h3>
        <p style="color:#6b7280;font-size:14px;margin:0 0 20px;">Ingresa el PIN de un administrador para continuar.</p>
        <input type="password" id="adminPinInput" placeholder="PIN de administrador" maxlength="8"
          style="width:100%;padding:10px;border:2px solid #d1d5db;border-radius:8px;font-size:20px;text-align:center;letter-spacing:4px;box-sizing:border-box;"
          onkeydown="if(event.key==='Enter') _verificarPinAdmin(this.value, arguments[0])">
        <div id="adminPinError" style="color:#dc2626;font-size:13px;min-height:20px;margin-top:8px;"></div>
        <div style="display:flex;gap:10px;margin-top:16px;">
          <button onclick="_verificarPinAdmin(document.getElementById('adminPinInput').value)"
            style="flex:1;padding:10px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">✅ Verificar</button>
          <button onclick="document.querySelector('[data-modal=req-admin]')?.remove()"
            style="padding:10px 18px;background:#6b7280;color:white;border:none;border-radius:6px;cursor:pointer;">✕</button>
        </div>
      </div>
    </div>`;
    }
    document.body.insertAdjacentHTML('beforeend', html);
    if (window._firebaseActivo && window._auth) {
        document.getElementById('adminEmailInput')?.focus();
    } else {
        document.getElementById('adminPinInput')?.focus();
    }
    window._adminCallback = callback;
}

function _verificarPinAdmin(pin) {
    const errEl = document.getElementById('adminPinError');
    if (Date.now() < _pinBloqueadoHasta) {
        if (errEl) errEl.textContent = `Demasiados intentos. Espera ${_pinAdminRestanteBloqueo()}s.`;
        return;
    }
    const usuarios = _getUsuarios();
    const adminMatch = usuarios.find(u => u.rol === 'admin' && u.activo && u.pin === pin);
    if (adminMatch) {
        _pinIntentosAdmin = 0;
        _pinBloqueadoHasta = 0;
        document.querySelector('[data-modal="req-admin"]')?.remove();
        if (typeof window._adminCallback === 'function') {
            const cb = window._adminCallback;
            window._adminCallback = null;
            cb();
        }
    } else {
        _pinIntentosAdmin++;
        if (_pinIntentosAdmin >= 5) {
            _pinBloqueadoHasta = Date.now() + 60000;
            _pinIntentosAdmin = 0;
            window.AuditService?.log?.({
                accion: 'PIN_ADMIN_BLOQUEADO',
                modulo: 'Seguridad',
                entidad: 'requireAdmin',
                detalle: 'Se bloqueo temporalmente la verificacion de PIN admin por intentos fallidos.',
                severidad: 'alerta'
            });
            if (errEl) errEl.textContent = 'Demasiados intentos. Espera 60s.';
        } else if (errEl) {
            errEl.textContent = `PIN incorrecto. Intento ${_pinIntentosAdmin}/5.`;
        }
        const inputNuevo = document.getElementById('adminPinInput');
        if (inputNuevo) { inputNuevo.value = ''; inputNuevo.focus(); }
        return;
        if (errEl) errEl.textContent = '❌ PIN incorrecto.';
    }
}

async function _verificarCredencialesAdmin(email, pass) {
    const errEl = document.getElementById('adminPinError');
    if (!email || !pass) {
        if (errEl) errEl.textContent = '❌ Completa todos los campos.';
        return;
    }
    try {
        _authLoginManualEnCurso = true;
        const cred = await window._auth.signInWithEmailAndPassword(email, pass);
        const uid = cred.user.uid;
        const perfil = await _obtenerPerfilFirebaseActivo(cred.user);
        if (!perfil || perfil.rol !== 'admin') {
            if (errEl) errEl.textContent = '❌ Este usuario no tiene permisos de administrador.';
            return;
        }
        const sesion = _sesionDesdePerfil({ uid, email: cred.user.email, perfil: { ...perfil, rol: 'admin' }, fallbackNombre: cred.user.email });
        _guardarSesionActiva(sesion);
        _authLoginManualEnCurso = false;
        aplicarRolUI();
        document.querySelector('[data-modal="req-admin"]')?.remove();
        if (typeof window._adminCallback === 'function') {
            const cb = window._adminCallback;
            window._adminCallback = null;
            cb();
        }
    } catch (err) {
        _authLoginManualEnCurso = false;
        if (errEl) errEl.textContent = '❌ Credenciales incorrectas.';
    }
}

// ── roles / UI ────────────────────────────────────────────────────────────────
function aplicarRolUI() {
    const sesion = getSesion();
    if (!sesion) return;
    const spanNombre = document.getElementById('nombreUsuarioActivo');
    if (spanNombre) spanNombre.textContent = sesion.nombre || sesion.email || sesion.usuario || '-';

    if (sesion.rol === 'vendedor') {
        // Ocultar todas las secciones del sidebar excepto OPERACION
        document.querySelectorAll('#sidebar .menu-item').forEach(item => {
            if (!item.querySelector('#sub-ventas')) item.style.display = 'none';
        });
        // Ocultar la línea separadora y sección SISTEMA
        const hrEl = document.querySelector('#sidebar hr');
        if (hrEl) {
            hrEl.style.display = 'none';
            let next = hrEl.nextElementSibling;
            while (next) { next.style.display = 'none'; next = next.nextElementSibling; }
        }
        if (typeof navA === 'function') navA('tienda');
    } else {
        // Admin: mostrar todo
        document.querySelectorAll('#sidebar .menu-item').forEach(item => item.style.display = '');
        const hrEl = document.querySelector('#sidebar hr');
        if (hrEl) {
            hrEl.style.display = '';
            let next = hrEl.nextElementSibling;
            while (next) { next.style.display = ''; next = next.nextElementSibling; }
        }
        const menuUsuarios = document.getElementById('menuItemUsuarios');
        if (menuUsuarios) menuUsuarios.style.display = '';
    }
}

// ── pantalla de login ─────────────────────────────────────────────────────────
function _crearPantallaLogin() {
    const html = `
    <div id="loginOverlay" style="position:fixed;inset:0;z-index:99999;background:linear-gradient(135deg,#1e3a5f 0%,#0f172a 60%,#1e40af 100%);display:flex;align-items:center;justify-content:center;">
      <div style="background:white;border-radius:16px;padding:40px 36px;width:100%;max-width:380px;box-shadow:0 20px 60px rgba(0,0,0,0.4);text-align:center;">
        <img src="img/Logo.svg" style="height:80px;margin-bottom:16px;object-fit:contain;" onerror="this.style.display='none'">
        <h2 style="margin:0 0 4px;color:#1e3a5f;font-size:22px;">MUEBLERÍA MI PUEBLITO</h2>
        <p style="color:#6b7280;font-size:13px;margin:0 0 28px;">Sistema de Punto de Venta</p>
        <form onsubmit="event.preventDefault(); iniciarSesion();">
          <div style="text-align:left;margin-bottom:14px;">
            <label style="font-size:12px;font-weight:bold;color:#374151;display:block;margin-bottom:5px;">USUARIO</label>
            <input type="text" id="loginEmail" placeholder="usuario o email" autocomplete="username"
              style="width:100%;padding:11px 14px;border:2px solid #e5e7eb;border-radius:8px;font-size:15px;box-sizing:border-box;outline:none;transition:border 0.2s;"
              onfocus="this.style.borderColor='#1e40af'" onblur="this.style.borderColor='#e5e7eb'">
          </div>
          <div style="text-align:left;margin-bottom:20px;">
            <label style="font-size:12px;font-weight:bold;color:#374151;display:block;margin-bottom:5px;">CONTRASEÑA</label>
            <input type="password" id="loginPass" placeholder="••••••" autocomplete="current-password"
              style="width:100%;padding:11px 14px;border:2px solid #e5e7eb;border-radius:8px;font-size:15px;box-sizing:border-box;outline:none;transition:border 0.2s;"
              onfocus="this.style.borderColor='#1e40af'" onblur="this.style.borderColor='#e5e7eb'">
          </div>
          <div id="loginError" style="color:#dc2626;font-size:13px;min-height:18px;margin-bottom:12px;"></div>
          <button type="submit" id="btnLogin"
            style="width:100%;padding:13px;background:linear-gradient(135deg,#1e40af,#3b82f6);color:white;border:none;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer;letter-spacing:1px;">
            🔐 Entrar
          </button>
        </form>
        <p style="color:#9ca3af;font-size:11px;margin:20px 0 0;">v1.0 — Acceso restringido</p>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    const mensajeLogin = sessionStorage.getItem('_loginMensaje');
    if (mensajeLogin) {
        sessionStorage.removeItem('_loginMensaje');
        mostrarErrorLogin(mensajeLogin);
    }
    document.getElementById('loginEmail')?.focus();
}

// ── verificar sesión al cargar ────────────────────────────────────────────────
function verificarSesionInicial() {
    if (window._firebaseActivo && window._auth) {
        window._auth.onAuthStateChanged(async (user) => {
            if (user) {
                try {
                let sesion = JSON.parse(sessionStorage.getItem('sesionActiva') || 'null');
                if (!sesion && !_authLoginManualEnCurso) {
                    await window._auth.signOut();
                    mostrarLoginScreen();
                    return;
                }
                if (!sesion && _authLoginManualEnCurso) return;
                if (Date.now() - Number(sesion._lastActivity || 0) >= AUTH_INACTIVITY_LIMIT_MS) {
                    await _cerrarSesionPorInactividad();
                    return;
                }
                if (!sesion || sesion.uid !== user.uid) {
                    const perfil = await _obtenerPerfilFirebaseActivo(user);
                    sesion = _sesionDesdePerfil({ uid: user.uid, email: user.email, perfil, fallbackNombre: user.email });
                    _guardarSesionActiva(sesion);
                } else {
                    _activarControlInactividad();
                }
                ocultarLoginScreen();
                aplicarRolUI();
                await _sincronizarFirebaseDespuesDeLogin();
                } catch (err) {
                    console.warn('Sesion Firebase sin perfil autorizado:', err);
                    sessionStorage.removeItem('sesionActiva');
                    try { await window._auth.signOut(); } catch {}
                    mostrarLoginScreen();
                    mostrarErrorLogin(err.message || 'Tu usuario no esta autorizado en Firebase.');
                }
            } else {
                sessionStorage.removeItem('sesionActiva');
                mostrarLoginScreen();
            }
        });
    } else {
        const sesion = getSesion();
        if (sesion && Date.now() - Number(sesion._lastActivity || 0) < AUTH_INACTIVITY_LIMIT_MS) {
            aplicarRolUI();
            _activarControlInactividad();
        }
        else { mostrarLoginScreen(); }
    }
}

// ── iniciar sesión ────────────────────────────────────────────────────────────
async function iniciarSesion() {
    const email = document.getElementById('loginEmail')?.value.trim();
    const pass = document.getElementById('loginPass')?.value;
    if (!email || !pass) return mostrarErrorLogin('Completa todos los campos');

    const btnLogin = document.getElementById('btnLogin');
    if (btnLogin) { btnLogin.disabled = true; btnLogin.textContent = 'Verificando...'; }

    try {
        if (window._firebaseActivo && window._auth) {
            _authLoginManualEnCurso = true;
            const cred = await window._auth.signInWithEmailAndPassword(email, pass);
            const uid = cred.user.uid;
            const perfil = await _obtenerPerfilFirebaseActivo(cred.user);
            const sesion = _sesionDesdePerfil({ uid, email, perfil, fallbackNombre: email });
            _guardarSesionActiva(sesion);
            _authLoginManualEnCurso = false;
            ocultarLoginScreen();
            aplicarRolUI();
            await _sincronizarFirebaseDespuesDeLogin();
            _recargarVariablesGlobales();
            if (typeof navA === 'function') navA('dashboard');
            // Respaldo automático diario a OneDrive (solo admin)
            if (sesion.rol === 'admin') {
                const hoy = window.obtenerHoyInputMX();
                const ultimoRespaldo = localStorage.getItem('_ultimoRespaldoOneDrive');
                if (ultimoRespaldo !== hoy && localStorage.getItem('_onedriveConectado') === 'true') {
                    if (typeof subirBackupOneDrive === 'function') {
                        subirBackupOneDrive().then(() => {
                            localStorage.setItem('_ultimoRespaldoOneDrive', hoy);
                        }).catch(() => {});
                    }
                }
            }
        } else {
            _iniciarSesionLocalFallback(email, pass);
        }
    } catch(err) {
        _authLoginManualEnCurso = false;
        let msg = 'Error al iniciar sesión';
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') msg = 'Email o contraseña incorrectos';
        if (err.code === 'auth/invalid-email') msg = 'Email inválido';
        if (err.code === 'auth/too-many-requests') msg = 'Demasiados intentos. Intenta más tarde';
        if (err.code === 'mmp/profile-missing' || err.code === 'mmp/profile-disabled') {
            msg = err.message;
            try { await window._auth.signOut(); } catch {}
        }
        mostrarErrorLogin(msg);
        if (btnLogin) { btnLogin.disabled = false; btnLogin.textContent = '🔐 Entrar'; }
    }
}

// Fallback: compatibilidad con usuarios de localStorage (usuario/PIN)
function _iniciarSesionLocalFallback(email, pass) {
    const usuarios = _getUsuarios();
    const match = usuarios.find(u => (u.usuario === email || u.email === email) && u.pin === pass && u.activo);
    if (!match) {
        mostrarErrorLogin('❌ Usuario o contraseña incorrectos.');
        const passInput = document.getElementById('loginPass');
        if (passInput) { passInput.value = ''; passInput.focus(); }
        return;
    }
    const sesion = {
        usuario: match.usuario,
        email: match.email || null,
        nombre: match.nombre || match.usuario,
        rol: match.rol,
        id: match.id,
        vendedorId: match.vendedorId || null,
        vendedorNombre: match.vendedorNombre || null
    };
    const vendedorSesion = obtenerVendedorDeUsuario(sesion);
    if (vendedorSesion) {
        sesion.vendedorId = vendedorSesion.id;
        sesion.vendedorNombre = vendedorSesion.nombre;
    }
    _guardarSesionActiva(sesion);
    ocultarLoginScreen();
    aplicarRolUI();
    _recargarVariablesGlobales();
    if (typeof navA === 'function') navA('dashboard');
    if (match.rol === 'admin') {
        const hoy = window.obtenerHoyInputMX();
        const ultimoRespaldo = localStorage.getItem('_ultimoRespaldoOneDrive');
        if (ultimoRespaldo !== hoy && localStorage.getItem('_onedriveConectado') === 'true') {
            if (typeof subirBackupOneDrive === 'function') {
                subirBackupOneDrive().then(() => {
                    localStorage.setItem('_ultimoRespaldoOneDrive', hoy);
                }).catch(() => {});
            }
        }
    }
}

// ── recuperar contraseña ──────────────────────────────────────────────────────
async function recuperarContrasena() {
    const email = document.getElementById('loginEmail')?.value.trim();
    if (!email) return alert('Escribe tu email primero');
    if (!window._firebaseActivo || !window._auth) return alert('La recuperación de contraseña requiere Firebase Auth activo.');
    try {
        await window._auth.sendPasswordResetEmail(email);
        alert(`✅ Se envió un correo de recuperación a ${email}`);
    } catch(err) {
        alert('Error: ' + err.message);
    }
}

// ── cerrar sesión ─────────────────────────────────────────────────────────────
async function cambiarContrasenaUsuarioActual() {
    const sesion = getSesion();
    const email = window._auth?.currentUser?.email || sesion?.email || '';
    if (!window._firebaseActivo || !window._auth) {
        return alert('Cambiar contrasena requiere Firebase Auth activo. En modo local/PIN no esta disponible.');
    }
    if (!email) {
        return alert('Este usuario no tiene email de Firebase asociado. No se puede enviar cambio de contrasena.');
    }
    if (!confirm(`Se enviara un correo para cambiar la contrasena a:\n${email}\n\nDeseas continuar?`)) return;
    try {
        await window._auth.sendPasswordResetEmail(email);
        alert(`Se envio un correo para cambiar la contrasena a ${email}.`);
    } catch (err) {
        alert('No se pudo enviar el correo: ' + err.message);
    }
}

async function cerrarSesion() {
    await _cerrarSesionInterno({ confirmar: true });
}

// ── menú de usuario en header ─────────────────────────────────────────────────
function abrirMenuUsuarioLegacy() {
    const existing = document.querySelector('[data-modal="menu-usuario"]');
    if (existing) { existing.remove(); return; }
    const sesion = getSesion();
    const displayName = sesion?.nombre || sesion?.email || sesion?.usuario || '-';
    const html = `
    <div data-modal="menu-usuario" style="position:fixed;top:52px;right:16px;z-index:99998;background:white;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,0.2);min-width:200px;padding:8px 0;border:1px solid #e5e7eb;">
      <div style="padding:10px 16px;border-bottom:1px solid #f3f4f6;">
        <div style="font-weight:bold;color:#1e40af;">${_esc(displayName)}</div>
        <div style="font-size:12px;color:#6b7280;text-transform:capitalize;">${_esc(sesion?.rol || '-')}</div>
      </div>
      <button onclick="document.querySelector('[data-modal=menu-usuario]')?.remove(); cambiarContrasenaUsuarioActual();"
        style="width:100%;padding:10px 16px;text-align:left;background:none;border:none;cursor:pointer;font-size:14px;color:#1e40af;display:flex;align-items:center;gap:8px;">
        Cambiar contrasena
      </button>
      <button onclick="document.querySelector('[data-modal=menu-usuario]')?.remove(); cerrarSesion();"
        style="width:100%;padding:10px 16px;text-align:left;background:none;border:none;cursor:pointer;font-size:14px;color:#dc2626;display:flex;align-items:center;gap:8px;">
        🚪 Cerrar sesión
      </button>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    // Cerrar al hacer click fuera
    setTimeout(() => {
        document.addEventListener('click', function _close(e) {
            if (!e.target.closest('[data-modal="menu-usuario"]') && !e.target.closest('#infoUsuarioActivo')) {
                document.querySelector('[data-modal="menu-usuario"]')?.remove();
                document.removeEventListener('click', _close);
            }
        });
    }, 10);
}

// ── gestión de usuarios ───────────────────────────────────────────────────────
function abrirMenuUsuario() {
    const existing = document.querySelector('[data-modal="menu-usuario"]');
    if (existing) { existing.remove(); return; }
    const sesion = getSesion();
    const displayName = sesion?.nombre || sesion?.email || sesion?.usuario || '-';
    const html = `
    <div data-modal="menu-usuario">
      <div class="menu-usuario-card">
        <div class="menu-usuario-header">
          <div class="menu-usuario-avatar">👤</div>
          <div style="min-width:0;flex:1;">
            <div class="menu-usuario-nombre">${_esc(displayName)}</div>
            <div class="menu-usuario-rol">${_esc(sesion?.rol || '-')}</div>
          </div>
        </div>
        <div class="menu-usuario-actions">
          <button class="menu-usuario-btn" onclick="document.querySelector('[data-modal=menu-usuario]')?.remove(); cambiarContrasenaUsuarioActual();">
            🔑 Cambiar contrasena
          </button>
          <button class="menu-usuario-btn menu-usuario-btn--danger" onclick="document.querySelector('[data-modal=menu-usuario]')?.remove(); cerrarSesion();">
            🚪 Cerrar sesion
          </button>
          <button class="menu-usuario-btn menu-usuario-btn--muted" onclick="document.querySelector('[data-modal=menu-usuario]')?.remove();">
            Cancelar
          </button>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    setTimeout(() => {
        document.addEventListener('click', function _close(e) {
            if (!e.target.closest('[data-modal="menu-usuario"]') && !e.target.closest('#infoUsuarioActivo')) {
                document.querySelector('[data-modal="menu-usuario"]')?.remove();
                document.removeEventListener('click', _close);
            }
        });
    }, 10);
}

function _opcionesVendedoresUsuario(vendedorId = '') {
    const vendedores = StorageService.get('vendedores', []).filter(v => v.activo !== false);
    return `<option value="">Sin vendedor vinculado</option>` + vendedores
        .map(v => `<option value="${_esc(v.id)}" ${String(v.id) === String(vendedorId || '') ? 'selected' : ''}>${_esc(v.nombre)}</option>`)
        .join('');
}

function renderGestionUsuarios() {
    requireAdmin(() => {
        const cont = document.getElementById('contenidoUsuarios');
        if (!cont) return;
        const usuarios = _getUsuarios();

        const rows = usuarios.map(u => `
        <tr>
          <td style="padding:10px;">${_esc(u.nombre || u.usuario || u.email || '-')}</td>
          <td style="padding:10px;text-align:center;"><span style="background:${u.rol==='admin'?'#dbeafe':'#d1fae5'};color:${u.rol==='admin'?'#1e40af':'#065f46'};padding:3px 10px;border-radius:999px;font-size:12px;font-weight:bold;">${u.rol}</span></td>
          <td style="padding:10px;text-align:center;">${u.rol === 'vendedor' ? _esc(u.vendedorNombre || StorageService.get('vendedores', []).find(v => String(v.id) === String(u.vendedorId))?.nombre || 'Sin vincular') : '-'}</td>
          <td style="padding:10px;text-align:center;"><span style="color:${u.activo?'#16a34a':'#9ca3af'};font-weight:bold;">${u.activo?'✅ Activo':'⛔ Inactivo'}</span></td>
          <td style="padding:10px;text-align:center;display:flex;gap:6px;justify-content:center;">
            <button onclick="abrirFormUsuario(${JSON.stringify(u.uid || u.id)})" style="background:none;border:none;cursor:pointer;font-size:17px;" title="Editar">✏️</button>
            <button onclick="eliminarUsuario(${JSON.stringify(u.uid || u.id)})" style="background:none;border:none;cursor:pointer;font-size:17px;" title="Eliminar">🗑️</button>
          </td>
        </tr>`).join('');

        const firebaseBtn = (window._firebaseActivo && window._auth)
            ? `<button onclick="abrirFormCrearUsuarioFirebase()" style="padding:10px 18px;background:#16a34a;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">➕ Crear usuario en Firebase</button>`
            : '';

        cont.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:8px;">
          <p style="margin:0;color:#6b7280;">Gestiona los accesos al sistema.</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button onclick="abrirFormUsuario()" style="padding:10px 18px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">➕ Nuevo Usuario</button>
            ${firebaseBtn}
          </div>
        </div>
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead><tr style="background:#f1f5f9;">
              <th style="padding:10px;text-align:left;">Usuario</th>
              <th style="padding:10px;text-align:center;">Rol</th>
              <th style="padding:10px;text-align:center;">Vendedor vinculado</th>
              <th style="padding:10px;text-align:center;">Estado</th>
              <th style="padding:10px;text-align:center;">Acciones</th>
            </tr></thead>
            <tbody>${rows || '<tr><td colspan="5" style="text-align:center;padding:20px;color:#9ca3af;">Sin usuarios</td></tr>'}</tbody>
          </table>
        </div>`;
    });
}

function abrirFormUsuario(id) {
    const usuarios = _getUsuarios();
    const u = (id !== undefined && id !== null && id !== '') ? usuarios.find(x => x.uid === id || x.id === id) : null;
    const html = `
    <div data-modal="form-usuario" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px;">
      <div style="background:white;border-radius:12px;width:100%;max-width:440px;padding:28px;">
        <h2 style="margin:0 0 20px;color:#1e40af;">${u ? '✏️ Editar Usuario' : '➕ Nuevo Usuario'}</h2>
        <input type="hidden" id="usrId" value="${u ? (u.uid || u.id || '') : ''}">
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">USUARIO</label>
            <input type="text" id="usrNombre" value="${u ? (u.nombre || u.usuario || '') : ''}" placeholder="Nombre de usuario"
              style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">PIN${u ? ' (dejar vacío para no cambiar)' : ''}</label>
            <input type="password" id="usrPin" placeholder="${u ? '••••' : 'PIN numérico'}" maxlength="8"
              style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;font-size:18px;text-align:center;letter-spacing:4px;box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">ROL</label>
            <select id="usrRol" onchange="document.getElementById('usrVendedorWrap').style.display=this.value==='vendedor'?'block':'none';" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
              <option value="vendedor" ${u && u.rol === 'vendedor' ? 'selected' : ''}>Vendedor</option>
              <option value="admin" ${u && u.rol === 'admin' ? 'selected' : ''}>Administrador</option>
            </select>
          </div>
          <div id="usrVendedorWrap" style="display:${(!u || u.rol === 'vendedor') ? 'block' : 'none'};">
            <label style="font-size:12px;font-weight:bold;color:#374151;">VENDEDOR VINCULADO</label>
            <select id="usrVendedorId" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
              ${_opcionesVendedoresUsuario(u?.vendedorId)}
            </select>
            <div style="font-size:11px;color:#64748b;margin-top:4px;">Cuando este usuario venda, el sistema asignara este vendedor automaticamente.</div>
          </div>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
            <input type="checkbox" id="usrActivo" ${u ? (u.activo ? 'checked' : '') : 'checked'} style="width:18px;height:18px;">
            <span style="font-size:14px;font-weight:bold;">Activo</span>
          </label>
        </div>
        <div style="display:flex;gap:10px;margin-top:20px;">
          <button onclick="guardarUsuario()" style="flex:1;padding:12px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">💾 Guardar</button>
          <button onclick="document.querySelector('[data-modal=form-usuario]')?.remove()" style="padding:12px 20px;background:#6b7280;color:white;border:none;border-radius:6px;cursor:pointer;">✕ Cancelar</button>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

function guardarUsuario() {
    const id = document.getElementById('usrId')?.value;
    const nombre = document.getElementById('usrNombre')?.value.trim();
    const pin = document.getElementById('usrPin')?.value;
    const rol = document.getElementById('usrRol')?.value;
    const vendedorId = rol === 'vendedor' ? (document.getElementById('usrVendedorId')?.value || '') : '';
    const vendedor = vendedorId ? StorageService.get('vendedores', []).find(v => String(v.id) === String(vendedorId)) : null;
    const activo = document.getElementById('usrActivo')?.checked;
    if (!nombre) return alert('⚠️ El nombre de usuario es obligatorio.');
    let usuarios = _getUsuarios();
    if (id) {
        // Editar
        const idx = usuarios.findIndex(u => String(u.uid || u.id) === String(id));
        if (idx === -1) return;
        usuarios[idx].usuario = nombre;
        usuarios[idx].nombre = nombre;
        if (pin) usuarios[idx].pin = pin;
        usuarios[idx].rol = rol;
        usuarios[idx].vendedorId = vendedor ? vendedor.id : null;
        usuarios[idx].vendedorNombre = vendedor ? vendedor.nombre : null;
        usuarios[idx].activo = activo;
    } else {
        // Nuevo
        if (!pin) return alert('⚠️ El PIN es obligatorio para nuevos usuarios.');
        const existe = usuarios.find(u => u.usuario === nombre);
        if (existe) return alert('⚠️ Ya existe un usuario con ese nombre.');
        usuarios.push({ id: Date.now(), usuario: nombre, nombre, pin, rol, vendedorId: vendedor ? vendedor.id : null, vendedorNombre: vendedor ? vendedor.nombre : null, activo });
    }
    StorageService.set('usuariosConfig', usuarios);
    const usuarioActualizado = id ? usuarios.find(u => String(u.uid || u.id) === String(id)) : null;
    if (window._db && usuarioActualizado?.uid) {
        window._db.collection('usuarios').doc(usuarioActualizado.uid).set({
            nombre,
            rol,
            vendedorId: vendedor ? vendedor.id : null,
            vendedorNombre: vendedor ? vendedor.nombre : null,
            activo
        }, { merge: true }).catch(err => console.warn('No se pudo sincronizar el vendedor vinculado en Firebase:', err));
    }
    document.querySelector('[data-modal="form-usuario"]')?.remove();
    renderGestionUsuarios();
}

function eliminarUsuario(id) {
    const usuarios = _getUsuarios();
    const u = usuarios.find(x => x.uid === id || x.id === id);
    if (!u) return;
    // No eliminar el último admin activo
    const adminsActivos = usuarios.filter(x => x.rol === 'admin' && x.activo);
    if (u.rol === 'admin' && adminsActivos.length <= 1) {
        return alert('⚠️ No puedes eliminar el último administrador activo.');
    }
    if (!confirm(`¿Eliminar el usuario "${u.nombre || u.usuario}"?`)) return;
    StorageService.set('usuariosConfig', usuarios.filter(x => x.uid !== id && x.id !== id));
    renderGestionUsuarios();
}

// ── Firebase: crear y listar usuarios ────────────────────────────────────────
function abrirFormCrearUsuarioFirebase() {
    const html = `
    <div data-modal="form-firebase-usuario" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px;">
      <div style="background:white;border-radius:12px;width:100%;max-width:440px;padding:28px;">
        <h2 style="margin:0 0 20px;color:#16a34a;">🔥 Crear Usuario en Firebase</h2>
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">EMAIL</label>
            <input type="email" id="fbUsrEmail" placeholder="correo@ejemplo.com" autocomplete="off"
              style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">CONTRASEÑA TEMPORAL (mín. 6 caracteres)</label>
            <input type="password" id="fbUsrPass" placeholder="••••••" autocomplete="new-password"
              style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">NOMBRE COMPLETO</label>
            <input type="text" id="fbUsrNombre" placeholder="Nombre del usuario"
              style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">ROL</label>
            <select id="fbUsrRol" onchange="document.getElementById('fbUsrVendedorWrap').style.display=this.value==='vendedor'?'block':'none';" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
              <option value="vendedor">Vendedor</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <div id="fbUsrVendedorWrap">
            <label style="font-size:12px;font-weight:bold;color:#374151;">VENDEDOR VINCULADO</label>
            <select id="fbUsrVendedorId" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
              ${_opcionesVendedoresUsuario()}
            </select>
          </div>
          <div id="fbUsrError" style="color:#dc2626;font-size:13px;min-height:16px;"></div>
        </div>
        <div style="display:flex;gap:10px;margin-top:20px;">
          <button onclick="guardarUsuarioFirebase()" id="btnGuardarFbUsr" style="flex:1;padding:12px;background:#16a34a;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">🔥 Crear en Firebase</button>
          <button onclick="document.querySelector('[data-modal=form-firebase-usuario]')?.remove()" style="padding:12px 20px;background:#6b7280;color:white;border:none;border-radius:6px;cursor:pointer;">✕ Cancelar</button>
        </div>
        <p style="color:#d97706;font-size:12px;margin-top:12px;">⚠️ Al crear un nuevo usuario, Firebase pueden cambiar la sesión activa. Es posible que necesites iniciar sesión nuevamente.</p>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('fbUsrEmail')?.focus();
}

async function guardarUsuarioFirebase() {
    const email = document.getElementById('fbUsrEmail')?.value.trim();
    const pass = document.getElementById('fbUsrPass')?.value;
    const nombre = document.getElementById('fbUsrNombre')?.value.trim();
    const rol = document.getElementById('fbUsrRol')?.value;
    const vendedorId = rol === 'vendedor' ? (document.getElementById('fbUsrVendedorId')?.value || '') : '';
    const errEl = document.getElementById('fbUsrError');
    const btn = document.getElementById('btnGuardarFbUsr');
    if (!email || !pass || !nombre) { if (errEl) errEl.textContent = '⚠️ Todos los campos son obligatorios.'; return; }
    if (pass.length < 6) { if (errEl) errEl.textContent = '⚠️ La contraseña debe tener al menos 6 caracteres.'; return; }
    if (btn) { btn.disabled = true; btn.textContent = 'Creando...'; }
    if (errEl) errEl.textContent = '';
    try {
        await crearUsuarioFirebase(email, pass, nombre, rol, vendedorId);
        document.querySelector('[data-modal="form-firebase-usuario"]')?.remove();
        alert(`✅ Usuario "${nombre}" creado correctamente en Firebase.\n\n⚠️ Es posible que necesites iniciar sesión nuevamente.`);
        renderGestionUsuarios();
    } catch(err) {
        let msg = 'Error al crear usuario: ' + err.message;
        if (err.code === 'auth/email-already-in-use') msg = 'Ya existe un usuario con ese email.';
        if (err.code === 'auth/invalid-email') msg = 'Email inválido.';
        if (err.code === 'auth/weak-password') msg = 'La contraseña es muy débil (mínimo 6 caracteres).';
        if (errEl) errEl.textContent = msg;
        if (btn) { btn.disabled = false; btn.textContent = '🔥 Crear en Firebase'; }
    }
}

async function crearUsuarioFirebase(email, pass, nombre, rol, vendedorId = '') {
    if (rol === 'admin') {
        throw new Error('Por seguridad, los administradores no se crean directamente desde el cliente. Crea un vendedor y asciendelo con un flujo administrativo seguro.');
    }
    // Guardar sesión actual del admin antes de crear el usuario
    let sesionAdmin = null;
    try { sesionAdmin = JSON.parse(sessionStorage.getItem('sesionActiva')); } catch { sesionAdmin = null; }
    const cred = await window._auth.createUserWithEmailAndPassword(email, pass);
    const uid = cred.user.uid;
    const vendedor = vendedorId ? StorageService.get('vendedores', []).find(v => String(v.id) === String(vendedorId)) : null;
    // Guardar perfil en Firestore
    await window._db.collection('usuarios').doc(uid).set({ nombre, rol, email, vendedorId: vendedor ? vendedor.id : null, vendedorNombre: vendedor ? vendedor.nombre : null, creadoEn: window.localISO(new Date()), activo: true });
    // También guardar en localStorage como respaldo
    const usuarios = _getUsuarios();
    if (!usuarios.find(u => u.email === email)) {
        usuarios.push({ id: uid, uid, usuario: nombre, nombre, email, rol, vendedorId: vendedor ? vendedor.id : null, vendedorNombre: vendedor ? vendedor.nombre : null, activo: true });
        StorageService.set('usuariosConfig', usuarios);
    }
    // Restaurar sesión del admin en sessionStorage
    if (sesionAdmin) {
        _guardarSesionActiva(sesionAdmin);
    }
    return uid;
}

async function listarUsuariosFirebase() {
    if (!window._firebaseActivo) return StorageService.get('usuariosConfig', []);
    const snap = await window._db.collection('usuarios').get();
    return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

// ── exportar al scope global ──────────────────────────────────────────────────
window.getSesion = getSesion;
window.esAdmin = esAdmin;
window.validarUsuarioFirebaseActivo = _obtenerPerfilFirebaseActivo;
window.obtenerVendedorDeUsuario = obtenerVendedorDeUsuario;
window.requireAdmin = requireAdmin;
window._verificarPinAdmin = _verificarPinAdmin;
window._verificarCredencialesAdmin = _verificarCredencialesAdmin;
window.verificarSesionInicial = verificarSesionInicial;
window.iniciarSesion = iniciarSesion;
window.recuperarContrasena = recuperarContrasena;
window.cambiarContrasenaUsuarioActual = cambiarContrasenaUsuarioActual;
window.cerrarSesion = cerrarSesion;
window.aplicarRolUI = aplicarRolUI;
window.abrirMenuUsuario = abrirMenuUsuario;
window.renderGestionUsuarios = renderGestionUsuarios;
window.abrirFormUsuario = abrirFormUsuario;
window.abrirFormCrearUsuarioFirebase = abrirFormCrearUsuarioFirebase;
window.guardarUsuarioFirebase = guardarUsuarioFirebase;
window.guardarUsuario = guardarUsuario;
window.eliminarUsuario = eliminarUsuario;
window.listarUsuariosFirebase = listarUsuariosFirebase;
window.crearUsuarioFirebase = crearUsuarioFirebase;
