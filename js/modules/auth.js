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

function esAdmin() {
    return getSesion()?.rol === 'admin';
}

function requireAdmin(callback) {
    if (esAdmin()) { callback(); return; }
    const html = `
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
    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('adminPinInput')?.focus();
    window._adminCallback = callback;
}

function _verificarPinAdmin(pin) {
    const usuarios = _getUsuarios();
    const adminMatch = usuarios.find(u => u.rol === 'admin' && u.activo && u.pin === pin);
    if (adminMatch) {
        document.querySelector('[data-modal="req-admin"]')?.remove();
        if (typeof window._adminCallback === 'function') {
            const cb = window._adminCallback;
            window._adminCallback = null;
            cb();
        }
    } else {
        const errEl = document.getElementById('adminPinError');
        if (errEl) errEl.textContent = '❌ PIN incorrecto.';
        const input = document.getElementById('adminPinInput');
        if (input) { input.value = ''; input.focus(); }
    }
}

function aplicarRolUI() {
    const sesion = getSesion();
    if (!sesion) return;
    const spanNombre = document.getElementById('nombreUsuarioActivo');
    if (spanNombre) spanNombre.textContent = sesion.usuario;

    if (sesion.rol === 'vendedor') {
        // Ocultar todas las secciones del sidebar excepto VENTAS
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

function _crearPantallaLogin() {
    const html = `
    <div id="loginOverlay" style="position:fixed;inset:0;z-index:99999;background:linear-gradient(135deg,#1e3a5f 0%,#0f172a 60%,#1e40af 100%);display:flex;align-items:center;justify-content:center;">
      <div style="background:white;border-radius:16px;padding:40px 36px;width:100%;max-width:380px;box-shadow:0 20px 60px rgba(0,0,0,0.4);text-align:center;">
        <img src="img/logo.png" style="height:80px;margin-bottom:16px;object-fit:contain;" onerror="this.style.display='none'">
        <h2 style="margin:0 0 4px;color:#1e3a5f;font-size:22px;">MUEBLERÍA MI PUEBLITO</h2>
        <p style="color:#6b7280;font-size:13px;margin:0 0 28px;">Sistema de Punto de Venta</p>
        <div style="text-align:left;margin-bottom:14px;">
          <label style="font-size:12px;font-weight:bold;color:#374151;display:block;margin-bottom:5px;">USUARIO</label>
          <input type="text" id="loginUsuario" placeholder="Nombre de usuario" autocomplete="username"
            style="width:100%;padding:11px 14px;border:2px solid #e5e7eb;border-radius:8px;font-size:15px;box-sizing:border-box;outline:none;transition:border 0.2s;"
            onfocus="this.style.borderColor='#1e40af'" onblur="this.style.borderColor='#e5e7eb'">
        </div>
        <div style="text-align:left;margin-bottom:20px;">
          <label style="font-size:12px;font-weight:bold;color:#374151;display:block;margin-bottom:5px;">PIN</label>
          <input type="password" id="loginPin" placeholder="••••" maxlength="8" autocomplete="current-password"
            style="width:100%;padding:11px 14px;border:2px solid #e5e7eb;border-radius:8px;font-size:22px;text-align:center;letter-spacing:6px;box-sizing:border-box;outline:none;transition:border 0.2s;"
            onfocus="this.style.borderColor='#1e40af'" onblur="this.style.borderColor='#e5e7eb'"
            onkeydown="if(event.key==='Enter') iniciarSesion()">
        </div>
        <div id="loginError" style="color:#dc2626;font-size:13px;min-height:18px;margin-bottom:12px;"></div>
        <button onclick="iniciarSesion()"
          style="width:100%;padding:13px;background:linear-gradient(135deg,#1e40af,#3b82f6);color:white;border:none;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer;letter-spacing:1px;">
          Entrar →
        </button>
        <p style="color:#9ca3af;font-size:11px;margin:20px 0 0;">v1.0 — Acceso restringido</p>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('loginUsuario')?.focus();
}

function verificarSesionInicial() {
    const sesion = getSesion();
    if (!sesion) {
        _crearPantallaLogin();
    } else {
        aplicarRolUI();
    }
}

function iniciarSesion() {
    const usuario = document.getElementById('loginUsuario')?.value.trim();
    const pin = document.getElementById('loginPin')?.value;
    const errEl = document.getElementById('loginError');
    const usuarios = _getUsuarios();
    const match = usuarios.find(u => u.usuario === usuario && u.pin === pin && u.activo);
    if (!match) {
        if (errEl) errEl.textContent = '❌ Usuario o PIN incorrecto.';
        const card = document.querySelector('#loginOverlay > div');
        if (card) {
            card.classList.add('shake');
            setTimeout(() => card.classList.remove('shake'), 500);
        }
        const pinInput = document.getElementById('loginPin');
        if (pinInput) { pinInput.value = ''; pinInput.focus(); }
        return;
    }
    sessionStorage.setItem('sesionActiva', JSON.stringify({ usuario: match.usuario, rol: match.rol, id: match.id }));
    document.getElementById('loginOverlay')?.remove();
    aplicarRolUI();

    // Sincronizar con Firebase al iniciar sesión
    if (window._firebaseActivo) {
        StorageService.syncAll()
            .then(() => console.log('✅ Sync con Firebase completado'))
            .catch(() => {});
    }

    // Respaldo automático diario a OneDrive (solo admin y si está conectado)
    if (match.rol === 'admin') {
        const hoy = new Date().toISOString().split('T')[0];
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

function cerrarSesion() {
    if (!confirm('¿Cerrar sesión?')) return;
    sessionStorage.removeItem('sesionActiva');
    location.reload();
}

function abrirMenuUsuario() {
    const existing = document.querySelector('[data-modal="menu-usuario"]');
    if (existing) { existing.remove(); return; }
    const sesion = getSesion();
    const html = `
    <div data-modal="menu-usuario" style="position:fixed;top:52px;right:16px;z-index:99998;background:white;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,0.2);min-width:200px;padding:8px 0;border:1px solid #e5e7eb;">
      <div style="padding:10px 16px;border-bottom:1px solid #f3f4f6;">
        <div style="font-weight:bold;color:#1e40af;">${sesion?.usuario || '-'}</div>
        <div style="font-size:12px;color:#6b7280;text-transform:capitalize;">${sesion?.rol || '-'}</div>
      </div>
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

function renderGestionUsuarios() {
    requireAdmin(() => {
        const cont = document.getElementById('contenidoUsuarios');
        if (!cont) return;
        const usuarios = _getUsuarios();

        const rows = usuarios.map(u => `
        <tr>
          <td style="padding:10px;">${u.usuario}</td>
          <td style="padding:10px;text-align:center;"><span style="background:${u.rol==='admin'?'#dbeafe':'#d1fae5'};color:${u.rol==='admin'?'#1e40af':'#065f46'};padding:3px 10px;border-radius:999px;font-size:12px;font-weight:bold;">${u.rol}</span></td>
          <td style="padding:10px;text-align:center;"><span style="color:${u.activo?'#16a34a':'#9ca3af'};font-weight:bold;">${u.activo?'✅ Activo':'⛔ Inactivo'}</span></td>
          <td style="padding:10px;text-align:center;display:flex;gap:6px;justify-content:center;">
            <button onclick="abrirFormUsuario(${u.id})" style="background:none;border:none;cursor:pointer;font-size:17px;" title="Editar">✏️</button>
            <button onclick="eliminarUsuario(${u.id})" style="background:none;border:none;cursor:pointer;font-size:17px;" title="Eliminar">🗑️</button>
          </td>
        </tr>`).join('');

        cont.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <p style="margin:0;color:#6b7280;">Gestiona los accesos al sistema.</p>
          <button onclick="abrirFormUsuario()" style="padding:10px 18px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">➕ Nuevo Usuario</button>
        </div>
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead><tr style="background:#f1f5f9;">
              <th style="padding:10px;text-align:left;">Usuario</th>
              <th style="padding:10px;text-align:center;">Rol</th>
              <th style="padding:10px;text-align:center;">Estado</th>
              <th style="padding:10px;text-align:center;">Acciones</th>
            </tr></thead>
            <tbody>${rows || '<tr><td colspan="4" style="text-align:center;padding:20px;color:#9ca3af;">Sin usuarios</td></tr>'}</tbody>
          </table>
        </div>`;
    });
}

function abrirFormUsuario(id) {
    const usuarios = _getUsuarios();
    const u = id ? usuarios.find(x => x.id === id) : null;
    const html = `
    <div data-modal="form-usuario" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px;">
      <div style="background:white;border-radius:12px;width:100%;max-width:440px;padding:28px;">
        <h2 style="margin:0 0 20px;color:#1e40af;">${u ? '✏️ Editar Usuario' : '➕ Nuevo Usuario'}</h2>
        <input type="hidden" id="usrId" value="${u ? u.id : ''}">
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">USUARIO</label>
            <input type="text" id="usrNombre" value="${u ? u.usuario : ''}" placeholder="Nombre de usuario"
              style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">PIN${u ? ' (dejar vacío para no cambiar)' : ''}</label>
            <input type="password" id="usrPin" placeholder="${u ? '••••' : 'PIN numérico'}" maxlength="8"
              style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;font-size:18px;text-align:center;letter-spacing:4px;box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">ROL</label>
            <select id="usrRol" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
              <option value="vendedor" ${u && u.rol === 'vendedor' ? 'selected' : ''}>Vendedor</option>
              <option value="admin" ${u && u.rol === 'admin' ? 'selected' : ''}>Administrador</option>
            </select>
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
    const activo = document.getElementById('usrActivo')?.checked;
    if (!nombre) return alert('⚠️ El nombre de usuario es obligatorio.');
    let usuarios = _getUsuarios();
    if (id) {
        // Editar
        const idx = usuarios.findIndex(u => u.id === Number(id));
        if (idx === -1) return;
        usuarios[idx].usuario = nombre;
        if (pin) usuarios[idx].pin = pin;
        usuarios[idx].rol = rol;
        usuarios[idx].activo = activo;
    } else {
        // Nuevo
        if (!pin) return alert('⚠️ El PIN es obligatorio para nuevos usuarios.');
        const existe = usuarios.find(u => u.usuario === nombre);
        if (existe) return alert('⚠️ Ya existe un usuario con ese nombre.');
        usuarios.push({ id: Date.now(), usuario: nombre, pin, rol, activo });
    }
    StorageService.set('usuariosConfig', usuarios);
    document.querySelector('[data-modal="form-usuario"]')?.remove();
    renderGestionUsuarios();
}

function eliminarUsuario(id) {
    const usuarios = _getUsuarios();
    const u = usuarios.find(x => x.id === id);
    if (!u) return;
    // No eliminar el último admin activo
    const adminsActivos = usuarios.filter(x => x.rol === 'admin' && x.activo);
    if (u.rol === 'admin' && adminsActivos.length <= 1) {
        return alert('⚠️ No puedes eliminar el último administrador activo.');
    }
    if (!confirm(`¿Eliminar el usuario "${u.usuario}"?`)) return;
    StorageService.set('usuariosConfig', usuarios.filter(x => x.id !== id));
    renderGestionUsuarios();
}

window.getSesion = getSesion;
window.esAdmin = esAdmin;
window.requireAdmin = requireAdmin;
window._verificarPinAdmin = _verificarPinAdmin;
window.verificarSesionInicial = verificarSesionInicial;
window.iniciarSesion = iniciarSesion;
window.cerrarSesion = cerrarSesion;
window.aplicarRolUI = aplicarRolUI;
window.abrirMenuUsuario = abrirMenuUsuario;
window.renderGestionUsuarios = renderGestionUsuarios;
window.abrirFormUsuario = abrirFormUsuario;
window.guardarUsuario = guardarUsuario;
window.eliminarUsuario = eliminarUsuario;
