// js/services/onedrive-backup.js - VERSIÓN DINÁMICA TOTAL

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

function obtenerTodoElLocalStorage() {
    const backup = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('msal.') || key.startsWith('_')) continue;
        const val = localStorage.getItem(key);
        try {
            backup[key] = JSON.parse(val);
        } catch (e) {
            backup[key] = val;
        }
    }
    return backup;
}

window.exportarBackupJSON = function() {
    const backup = { _fecha: new Date().toISOString(), datos: obtenerTodoElLocalStorage() };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `REV-BACKUP-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
};

window.importarBackupJSON = function(event) {
    const file = event.target.files[0];
    if (!file || !confirm('⚠️ SE BORRARÁN TODOS LOS DATOS ACTUALES. ¿Continuar?')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const res = JSON.parse(e.target.result);
            const datos = res.datos || res;
            localStorage.clear(); // Limpieza para evitar basura
            Object.entries(datos).forEach(([k, v]) => {
                if (typeof v === 'object') localStorage.setItem(k, JSON.stringify(v));
                else localStorage.setItem(k, v);
            });
            alert('✅ Restauración completa. Recargando...');
            location.reload();
        } catch (err) { alert('❌ Error: Archivo corrupto.'); }
    };
    reader.readAsText(file);
};

window.subirBackupOneDrive = async function() {
    // ... (Tu lógica de token de OneDrive se mantiene igual)
    const backup = { _fecha: new Date().toISOString(), datos: obtenerTodoElLocalStorage() };
    // Lógica de PUT a Microsoft Graph...
};