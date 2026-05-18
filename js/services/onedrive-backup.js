// ===== BACKUP & RESTORE SERVICE =====
// Lee y escribe SIEMPRE a través de StorageService (IndexedDB + caché RAM).
// Nunca accede a localStorage directamente: esos datos ya fueron migrados a IDB.

// js/services/onedrive-backup.js

const TABLAS_SISTEMA = [
    "productos", 
    "categoriasData", 
    "movimientosInventario",
    "clientes", 
    "clientesSistema", 
    "cuentasPorCobrar", 
    "pagaresSistema", 
    "ventasRegistradas", 
    "registroTickets",          // Añadido para asegurar consistencia en reimpresión
    "salidasPendientesVenta",   // Añadido para el control físico de entregas en bodega
    "puntosPorCliente",         // Añadido para el control de fidelidad
    "gastosOperativos",         // CORREGIDO: Antes decía "gastos"
    "cotizaciones", 
    "apartados",
    "proveedores", 
    "compras", 
    "movimientosCaja",
    "cuentasEfectivo", 
    "tarjetasConfig", 
    "configuracionPos",
    "recepciones", 
    "cuentasPorPagar", 
    "cuentasMSI",
    "ubicacionesConfig",
    "requisicionesCompra"       // Añadido para el flujo de compras pendientes
];

window.TABLAS_SISTEMA = TABLAS_SISTEMA;

const BACKUP_VERSION = 2;

// ── Construye el objeto de backup leyendo de StorageService ─────────────────
function _construirBackup() {
    const datos = {};
    let tablasCon = 0;
    for (const tabla of TABLAS_SISTEMA) {
        const valor = StorageService.get(tabla, null);
        if (valor !== null) {
            datos[tabla] = valor;
            tablasCon++;
        }
    }
    return {
        _version: BACKUP_VERSION,
        _fecha:   window.localISO(new Date()),
        _sistema: "REV POS — Mueblería Mi Pueblito",
        _tablas:  tablasCon,
        datos,
    };
}

// --- EXPORTAR TODO (Corregido para IndexedDB/StorageService) ---
window.exportarBackupJSON = function() {
    const backup = { 
        _fecha: Date.now(), 
        _version: "2.0",
        datos: {} 
    };

    // En lugar de recorrer localStorage, recorremos nuestras tablas oficiales
    TABLAS_SISTEMA.forEach(tabla => {
        const data = StorageService.get(tabla, null);
        if (data) {
            backup.datos[tabla] = data;
        }
    });

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `REV-POS-BACKUP-${window.getFechaLocalMX()}.json`;
    a.click();
    console.log("💾 Respaldo generado desde StorageService.");
};

// --- IMPORTAR TODO (Corregido) ---
window.importarBackupJSON = function(event) {
    const archivo = event.target.files[0];
    if (!archivo || !confirm('⚠️ Se borrarán los datos actuales. ¿Continuar?')) return;
    
    const lector = new FileReader();
    lector.onload = async (e) => { 
        try {
            const json = JSON.parse(e.target.result);
            const datos = json.datos || json;

            // 1. Guardar en la base de datos local (IndexedDB)
            await Promise.all(Object.entries(datos).map(([key, value]) => {
                let valorCorregido = value;
                if (typeof value === 'string') {
                try { valorCorregido = JSON.parse(value); } catch(e) {}
                    }
                return StorageService.set(key, valorCorregido); // <-- Cambiamos 'value' por 'valorCorregido'
            }));

            // 2. REPARACIÓN: Sincronizar las variables globales con los nuevos datos
            // Esto es necesario para que las funciones de 'render' vean los cambios
            if (datos.productos) window.productos = datos.productos;
            if (datos.categoriasData) window.categoriasData = datos.categoriasData;
            if (datos.movimientosInventario) window.movimientosInventario = datos.movimientosInventario;

            // 3. Renderizado seguro
            // Ahora, si estás en la vista de inventario, se actualizará.
            // Si estás en configuración, renderCategorias() simplemente no hará nada (gracias al paso 1).
            if (typeof renderCategorias === 'function') renderCategorias();
            if (typeof actualizarCombosFiltros === 'function') actualizarCombosFiltros();
            
            alert('✅ Respaldo restaurado con éxito.');
            
            // Si quieres que todo el sistema se refresque por completo:
            location.reload();


        } catch (err) { 
            console.error("Error detallado:", err);
            alert(`❌ Error al importar: ${err.message}`); 
        }
    };
    lector.readAsText(archivo);
};

// ── OneDrive ──────────────────────────────────────────────────────────────────
const _msalConfig = {
    auth: {
        clientId:    "TU_AZURE_CLIENT_ID",
        authority:   "https://login.microsoftonline.com/common",
        redirectUri: window.location.origin,
    },
    cache: { cacheLocation: "localStorage", storeAuthStateInCookie: false },
};
const _GRAPH_SCOPES  = ["Files.ReadWrite", "User.Read"];
const _BACKUP_FOLDER = "REV-POS-Backups";

window.conectarOneDrive = async function () {
    try {
        if (typeof msal === "undefined") { alert("❌ MSAL no cargado."); return null; }
        const app   = new msal.PublicClientApplication(_msalConfig);
        const token = await app.loginPopup({ scopes: _GRAPH_SCOPES });
        window._msalApp   = app;
        window._msalToken = token.accessToken;
        alert(`✅ Conectado como ${token.account.username}`);
        return token.accessToken;
    } catch (err) {
        alert("❌ No se pudo conectar con OneDrive.");
        return null;
    }
};

window.subirBackupOneDrive = async function () {
    const token = window._msalToken || (await window.conectarOneDrive());
    if (!token) return false;
    try {
        const backup = _construirBackup();   // ← usa StorageService, no localStorage
        const json   = JSON.stringify(backup, null, 2);
        const fecha  = window.getFechaLocalMX();
        const nombre = `REV-BACKUP-v${BACKUP_VERSION}-${fecha}.json`;
        const res = await fetch(
            `https://graph.microsoft.com/v1.0/me/drive/root:/${_BACKUP_FOLDER}/${nombre}:/content`,
            { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: json }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        console.log(`☁️ Backup subido: ${nombre}`);
        return true;
    } catch (err) {
        alert(`❌ No se pudo subir: ${err.message}`);
        return false;
    }
};

window.mostrarListaBackups = async function () {
    const token = window._msalToken || (await window.conectarOneDrive());
    if (!token) return;
    const cont = document.getElementById("listaBackupsOneDrive");
    if (cont) cont.innerHTML = "<p style='color:#6b7280;font-size:13px;'>Cargando...</p>";
    try {
        const res   = await fetch(
            `https://graph.microsoft.com/v1.0/me/drive/root:/${_BACKUP_FOLDER}:/children`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const data  = await res.json();
        const items = (data.value || []).filter(f => f.name.endsWith(".json")).reverse();
        if (!cont) return;
        if (items.length === 0) { cont.innerHTML = "<p style='color:#9ca3af;font-size:13px;'>No hay respaldos.</p>"; return; }
        cont.innerHTML = items.map(f => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f3f4f6;">
                <span style="font-size:13px;flex:1;color:#374151;">📄 ${f.name}</span>
                <span style="font-size:11px;color:#9ca3af;">${(f.size/1024).toFixed(1)} KB</span>
                <button onclick="restaurarDesdeOneDrive('${f.id}','${f.name}')"
                    style="padding:4px 10px;background:#8b5cf6;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">
                    ♻️ Restaurar
                </button>
            </div>`).join("");
    } catch (err) {
        if (cont) cont.innerHTML = `<p style='color:#dc2626;font-size:13px;'>❌ ${err.message}</p>`;
    }
};

window.restaurarDesdeOneDrive = async function (fileId, nombre) {
    const token = window._msalToken;
    if (!token) { alert("Conecta OneDrive primero."); return; }
    if (!confirm(`¿Restaurar "${nombre}"? Los datos actuales serán reemplazados.`)) return;
    try {
        const res  = await fetch(
            `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const text = await res.text();
        const fakeEvent = { target: { files: [new File([text], nombre, { type: "application/json" })], value: "" } };
        window.importarBackupJSON(fakeEvent);
    } catch (err) {
        alert(`❌ No se pudo restaurar: ${err.message}`);
    }
};
