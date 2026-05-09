// ===== BACKUP & RESTORE SERVICE =====
// Lee y escribe SIEMPRE a través de StorageService (IndexedDB + caché RAM).
// Nunca accede a localStorage directamente: esos datos ya fueron migrados a IDB.

// ── Registro completo de tablas del sistema ─────────────────────────────────
// Fuente única de verdad. Usada por: exportar, importar, syncAll, uploadAll.
// Excluye claves de sesión (sesionActiva, usuarioActual) y estado transitorio (carrito).
const TABLAS_SISTEMA = [
    // Catálogo y stock
    "productos",
    "categoriasData",
    "movimientosInventario",
    "historialCostos",
    "ubicaciones",
    "ubicacionesConfig",
    // Clientes y cobranza
    "clientes",
    "cuentasPorCobrar",
    "pagaresSistema",
    "registroTickets",
    "puntosPorCliente",
    "programaPuntos",
    // Ventas
    "ventasRegistradas",
    "cotizaciones",
    "apartados",
    "salidasPendientesVenta",
    "historialDevoluciones",
    "garantiasProductos",
    // Compras y proveedores
    "proveedores",
    "compras",
    "recepciones",
    "ordenesCompra",
    "requisicionesCompra",
    "cuentasPorPagar",
    "deudasMSI",
    // Tesorería y bancos
    "movimientosCaja",
    "cuentasEfectivo",
    "cuentasMSI",
    "cuentas-bancarias",
    "tarjetasConfig",
    // Gastos
    "gastosOperativos",
    "categoriasGasto",
    // Vendedores
    "vendedores",
    "comisionesRegistradas",
    // Descuentos
    "descuentosActivos",
    // Configuración
    "configCreditoGlobal",
    "configEmpresa",
    "usuariosConfig",
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
        _fecha:   new Date().toISOString(),
        _sistema: "REV POS — Mueblería Mi Pueblito",
        _tablas:  tablasCon,
        datos,
    };
}

// ── EXPORTAR ─────────────────────────────────────────────────────────────────
window.exportarBackupJSON = function () {
    try {
        const backup = _construirBackup();
        const json   = JSON.stringify(backup, null, 2);
        const blob   = new Blob([json], { type: "application/json" });
        const url    = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        const fecha  = new Date().toISOString().split("T")[0];
        anchor.href     = url;
        anchor.download = `REV-BACKUP-v${BACKUP_VERSION}-${fecha}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
        console.log(`✅ Backup exportado: ${backup._tablas} tablas, ${(json.length / 1024).toFixed(1)} KB`);
    } catch (err) {
        console.error("❌ Error al exportar backup:", err);
        alert("Error al exportar. Revisa la consola.");
    }
};

// ── IMPORTAR ─────────────────────────────────────────────────────────────────
window.importarBackupJSON = function (event) {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = "";

    const reader = new FileReader();
    reader.onload = function (e) {
        let parsed;
        try {
            parsed = JSON.parse(e.target.result);
        } catch {
            alert("❌ El archivo está corrupto o no es un JSON válido.");
            return;
        }

        // Acepta formato v2 ({ datos: {...} }) y v1 (objeto plano)
        const esV2   = parsed._version && parsed.datos;
        const datos  = esV2 ? parsed.datos : parsed;
        const tablas = Object.keys(datos);
        const fecha  = parsed._fecha
            ? new Date(parsed._fecha).toLocaleString("es-MX")
            : "desconocida";
        const version = parsed._version || 1;

        if (tablas.length === 0) {
            alert("❌ El archivo no contiene datos válidos.");
            return;
        }

        // Resumen antes de confirmar
        const resumen = tablas.map(t => {
            const val = datos[t];
            const n   = Array.isArray(val) ? val.length + " registros"
                      : (typeof val === "object" ? "configuración" : "—");
            return `  • ${t}: ${n}`;
        }).join("\n");

        const ok = confirm(
            `📦 RESUMEN DEL BACKUP\n` +
            `Versión: ${version}  |  Fecha: ${fecha}\n` +
            `Tablas encontradas: ${tablas.length}\n\n` +
            `${resumen}\n\n` +
            `⚠️  Se REEMPLAZARÁN los datos de las tablas listadas.\n` +
            `Datos en otras tablas se conservarán intactos.\n\n` +
            `¿Continuar con la restauración?`
        );
        if (!ok) return;

        let importadas = 0;
        const errores = [];
        for (const [tabla, valor] of Object.entries(datos)) {
            try {
                StorageService.set(tabla, valor);
                importadas++;
            } catch (err) {
                errores.push(tabla);
                console.error(`❌ Error restaurando "${tabla}":`, err);
            }
        }

        if (errores.length > 0) {
            alert(`⚠️ Restauración parcial.\n${importadas} tablas OK.\n${errores.length} con error: ${errores.join(", ")}\n\nRecargando...`);
        } else {
            alert(`✅ Restauración completa.\n${importadas} tablas restauradas.\n\nRecargando...`);
        }
        window.location.reload();
    };
    reader.readAsText(file);
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
        const fecha  = new Date().toISOString().split("T")[0];
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
