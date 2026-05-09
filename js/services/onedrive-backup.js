// ===== RESPALDO ONEDRIVE + EXPORTAR/IMPORTAR JSON =====
// Requiere MSAL.js (cargado antes de este script en index.html)
// El usuario debe crear una App en Azure AD (tipo SPA) y reemplazar TU_AZURE_CLIENT_ID.
// https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps

// ── Configuración MSAL ──────────────────────────────────────────────────────
const _msalConfig = {
    auth: {
        clientId: "TU_AZURE_CLIENT_ID",
        authority: "https://login.microsoftonline.com/common",
        redirectUri: window.location.origin
    },
    cache: { cacheLocation: "localStorage", storeAuthStateInCookie: false }
};

const _GRAPH_SCOPES = ["Files.ReadWrite", "User.Read"];
const _BACKUP_FOLDER = "REV-POS-Backups";

let _msalInstance = null;

function _getMsal() {
    if (_msalInstance) return _msalInstance;
    if (typeof msal === 'undefined') {
        alert('⚠️ MSAL.js no disponible. Verifica que el script esté cargado en index.html.');
        return null;
    }
    if (_msalConfig.auth.clientId === "TU_AZURE_CLIENT_ID") {
        alert('⚠️ Configura TU_AZURE_CLIENT_ID en js/services/onedrive-backup.js antes de usar OneDrive.');
        return null;
    }
    _msalInstance = new msal.PublicClientApplication(_msalConfig);
    return _msalInstance;
}

// ── Obtener token de acceso a Microsoft Graph ───────────────────────────────
async function _obtenerTokenOneDrive() {
    const instance = _getMsal();
    if (!instance) return null;

    const accounts = instance.getAllAccounts();
    const request = { scopes: _GRAPH_SCOPES, account: accounts[0] || undefined };

    try {
        const resp = await instance.acquireTokenSilent(request);
        return resp.accessToken;
    } catch (_) {
        try {
            const resp = await instance.acquireTokenPopup(request);
            localStorage.setItem('_onedriveConectado', 'true');
            return resp.accessToken;
        } catch (e) {
            console.error('❌ Error obteniendo token OneDrive:', e.message);
            return null;
        }
    }
}

// ── Conectar OneDrive ────────────────────────────────────────────────────────
async function conectarOneDrive() {
    const instance = _getMsal();
    if (!instance) return;
    try {
        await instance.loginPopup({ scopes: _GRAPH_SCOPES });
        localStorage.setItem('_onedriveConectado', 'true');
        alert('✅ Conectado a OneDrive correctamente.');
    } catch (e) {
        console.error('❌ Error conectando OneDrive:', e.message);
        alert('❌ No se pudo conectar a OneDrive. Intenta de nuevo.');
    }
}

// ── Listar respaldos en OneDrive ─────────────────────────────────────────────
async function listarBackupsOneDrive() {
    const token = await _obtenerTokenOneDrive();
    if (!token) return [];

    try {
        const resp = await fetch(
            `https://graph.microsoft.com/v1.0/me/drive/root:/${_BACKUP_FOLDER}:/children?$orderby=lastModifiedDateTime desc`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!resp.ok) {
            if (resp.status === 404) return []; // Carpeta aún no existe
            throw new Error(`HTTP ${resp.status}`);
        }
        const json = await resp.json();
        return json.value || [];
    } catch (e) {
        console.error('❌ Error listando backups OneDrive:', e.message);
        return [];
    }
}


// ── Mostrar lista de respaldos en el panel ───────────────────────────────────
async function mostrarListaBackups() {
    const cont = document.getElementById('listaBackupsOneDrive');
    if (!cont) return;
    cont.innerHTML = '<p style="color:#6b7280;font-size:13px;">Cargando...</p>';

    const archivos = await listarBackupsOneDrive();
    if (!archivos.length) {
        cont.innerHTML = '<p style="color:#6b7280;font-size:13px;">No se encontraron respaldos.</p>';
        return;
    }

    const rows = archivos.map(f => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f3f4f6;">
            <div>
                <div style="font-size:13px;font-weight:600;color:#374151;">${f.name}</div>
                <div style="font-size:11px;color:#9ca3af;">${new Date(f.lastModifiedDateTime).toLocaleString('es-MX')} — ${(f.size/1024).toFixed(1)} KB</div>
            </div>
            <button onclick="restaurarBackupOneDrive('${f.id}')" 
                style="padding:6px 12px;background:#dc2626;color:white;border:none;border-radius:5px;cursor:pointer;font-size:12px;">
                ♻️ Restaurar
            </button>
        </div>`).join('');

    cont.innerHTML = `<div style="margin-top:10px;">${rows}</div>`;
}

// ── Subir respaldo a OneDrive (BARRIDO DINÁMICO) ──────────────────────────────
async function subirBackupOneDrive() {
    const token = await _obtenerTokenOneDrive();
    if (!token) {
        alert('⚠️ Debes conectar OneDrive primero.');
        return;
    }

    const backup = {
        _version: 1,
        _fecha: new Date().toISOString(),
        datos: {}
    };

    // BARRIDO TOTAL: Leemos absolutamente todo el LocalStorage
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        // Ignorar basura del navegador, tokens de MSAL o variables temporales
        if (key.startsWith('msal.') || key.startsWith('_')) continue;

        const val = localStorage.getItem(key);
        if (val) {
            try { 
                backup.datos[key] = JSON.parse(val); 
            } catch (_) {
                // Si tienes alguna configuración en texto plano, la guarda directo
                backup.datos[key] = val; 
            }
        }
    }

    const fecha = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `backup-REV-${fecha}.json`;
    const contenido = JSON.stringify(backup, null, 2);

    try {
        const resp = await fetch(
            `https://graph.microsoft.com/v1.0/me/drive/root:/${_BACKUP_FOLDER}/${filename}:/content`,
            {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: contenido
            }
        );

        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        console.log('✅ Respaldo subido a OneDrive:', filename);
        return true;
    } catch (e) {
        console.error('❌ Error subiendo respaldo a OneDrive:', e.message);
        alert('❌ Error subiendo respaldo a OneDrive: ' + e.message);
        return false;
    }
}

// ── Exportar todos los datos a JSON local (BARRIDO DINÁMICO) ──────────────────
function exportarBackupJSON() {
    const backup = {
        _version: 2, // Subimos a versión 2 para identificar el barrido dinámico
        _fecha: new Date().toISOString(),
        datos: {}
    };

    // BARRIDO TOTAL: Leemos absolutamente todo el LocalStorage
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        // Ignorar basura del navegador, tokens de MSAL o variables temporales
        if (key.startsWith('msal.') || key.startsWith('_')) continue;

        const val = localStorage.getItem(key);
        if (val) {
            try { 
                backup.datos[key] = JSON.parse(val); 
            } catch (_) {
                // Si tienes alguna configuración en texto plano, la guarda directo
                backup.datos[key] = val; 
            }
        }
    }

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `REV-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
}

// ── Restaurar respaldo desde OneDrive (DINÁMICO) ─────────────────────────────
async function restaurarBackupOneDrive(fileId) {
    const token = await _obtenerTokenOneDrive();
    if (!token) return;

    if (!confirm('⚠️ Esto borrará TODOS los datos actuales y los reemplazará con el respaldo de OneDrive. ¿Continuar?')) return;

    try {
        const resp = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!resp.ok) throw new Error('No se pudo descargar el archivo.');
        
        const backup = await resp.json();
        const datos = backup.datos || backup;

        // 1. LIMPIEZA TOTAL: Borramos el LocalStorage actual para evitar conflictos
        localStorage.clear();

        // 2. RESTAURACIÓN TOTAL: Insertamos cada llave del respaldo
        Object.entries(datos).forEach(([k, v]) => {
            if (typeof v === 'object' && v !== null) {
                // Si es objeto/array, usamos el servicio que lo stringifica
                StorageService.set(k, v);
            } else {
                // Si es un valor simple (string/number), lo guardamos directo
                localStorage.setItem(k, v);
            }
        });

        alert('✅ Datos restaurados desde OneDrive con éxito. Recargando...');
        location.reload();
    } catch (e) {
        console.error('❌ Error al restaurar:', e.message);
        alert('❌ Error al restaurar el respaldo: ' + e.message);
    }
}

// ── Importar datos desde JSON local (DINÁMICO) ──────────────────────────────
function importarBackupJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        if (!confirm('⚠️ Esto reemplazará TODOS los datos actuales con el archivo seleccionado. ¿Continuar?')) {
            event.target.value = '';
            return;
        }
        try {
            const backup = JSON.parse(e.target.result);
            const datos = backup.datos || backup;

            // 1. LIMPIEZA TOTAL
            localStorage.clear();

            // 2. RESTAURACIÓN TOTAL
            Object.entries(datos).forEach(([k, v]) => {
                if (typeof v === 'object' && v !== null) {
                    StorageService.set(k, v);
                } else {
                    localStorage.setItem(k, v);
                }
            });

            alert('✅ Datos restaurados correctamente desde el archivo. Recargando...');
            location.reload();
        } catch (err) {
            alert('❌ Archivo inválido o corrupto: ' + err.message);
            event.target.value = '';
        }
    };
    reader.readAsText(file);
}

// Exponer funciones globalmente
window.conectarOneDrive = conectarOneDrive;
window.subirBackupOneDrive = subirBackupOneDrive;
window.listarBackupsOneDrive = listarBackupsOneDrive;
window.restaurarBackupOneDrive = restaurarBackupOneDrive;
window.mostrarListaBackups = mostrarListaBackups;
window.exportarBackupJSON = exportarBackupJSON;
window.importarBackupJSON = importarBackupJSON;
