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
    "tomasInventario",
    "ubicacionesConfig",
    "requisicionesCompra"       // Añadido para el flujo de compras pendientes
];

window.TABLAS_SISTEMA = TABLAS_SISTEMA;

const BACKUP_VERSION = 2;

// ── Construye el objeto de backup leyendo tablas dinámicas desde StorageService ──
async function _construirBackup() {
    const datos = {};
    let tablasCon = 0;

    const tablas = await StorageService.getTablasDinamicas();

    for (const tabla of tablas) {
        const valor = StorageService.get(tabla, null);

        if (StorageService._esTablaValida(tabla, valor)) {
            datos[tabla] = valor;
            tablasCon++;
        }
    }

    return {
        _version: BACKUP_VERSION,
        _fecha: window.localISO ? window.localISO(new Date()) : new Date().toISOString(),
        _sistema: "REV POS — Mueblería Mi Pueblito",
        _modo: "dinamico",
        _tablas: tablasCon,
        datos,
    };
}

// --- EXPORTAR TODO dinámicamente desde StorageService ---
window.exportarBackupJSON = async function() {
    try {
        const backup = await _construirBackup();

        const blob = new Blob([JSON.stringify(backup, null, 2)], {
            type: 'application/json'
        });

        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);

        const fecha = window.getFechaLocalMX
            ? window.getFechaLocalMX()
            : new Date().toISOString().slice(0, 10);

        a.download = `REV-POS-BACKUP-${fecha}.json`;
        a.click();

        console.log(`💾 Respaldo dinámico generado: ${backup._tablas} tabla(s).`);

    } catch (err) {
        console.error("❌ Error generando respaldo dinámico:", err);
        alert(`❌ Error generando respaldo: ${err.message}`);
    }
};

// --- IMPORTAR TODO dinámicamente ---
window.importarBackupJSON = function(event) {
    const archivo = event.target.files[0];

    if (!archivo || !confirm('⚠️ Se reemplazarán los datos actuales con el respaldo seleccionado. ¿Continuar?')) {
        return;
    }
    
    const lector = new FileReader();

    lector.onload = async (e) => { 
        try {
            const json = JSON.parse(e.target.result);
            const datos = json.datos || json;

            if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
                throw new Error("El archivo no contiene una estructura válida de respaldo.");
            }

            let importadas = 0;
            let ignoradas = 0;

            for (const [key, value] of Object.entries(datos)) {
                let valorCorregido = value;

                if (typeof value === 'string') {
                    try {
                        valorCorregido = JSON.parse(value);
                    } catch(e) {
                        valorCorregido = value;
                    }
                }

                if (!StorageService._esTablaValida(key, valorCorregido)) {
                    console.warn(`⏭️ Clave ignorada al importar: ${key}`);
                    ignoradas++;
                    continue;
                }

                await StorageService.set(key, valorCorregido);
                importadas++;
            }

            console.log(`✅ Importación dinámica completada. Importadas: ${importadas}, ignoradas: ${ignoradas}`);

            // Renderizados seguros si existen
            if (typeof renderCategorias === 'function') renderCategorias();
            if (typeof actualizarCombosFiltros === 'function') actualizarCombosFiltros();
            if (typeof renderInventario === 'function') renderInventario();
            if (typeof renderClientes === 'function') renderClientes();
            if (typeof renderProveedores === 'function') renderProveedores();
            if (typeof renderCuentasXCobrar === 'function') renderCuentasXCobrar();

            alert(`✅ Respaldo restaurado con éxito.\n\nTablas importadas: ${importadas}\nClaves ignoradas: ${ignoradas}`);

            location.reload();

        } catch (err) { 
            console.error("Error detallado:", err);
            alert(`❌ Error al importar: ${err.message}`); 
        }
    };

    lector.readAsText(archivo);
};

// ── Firebase Storage (respaldos automáticos en la nube) ────────────────────
// Reemplaza al antiguo backup por OneDrive (nunca llegó a funcionar: client ID
// sin configurar y el flag de conexión nunca se guardaba). Como el proyecto ya
// usa Firebase, esto no requiere cuentas ni OAuth adicionales.
const _BACKUP_FOLDER        = "backups";
const _BACKUP_RETENCION_DIAS = 7; // se borran automáticamente los más viejos

function _storageDisponible() {
    return !!(window._firebaseActivo && typeof firebase !== 'undefined' && firebase.storage);
}

// Sube el respaldo del día a Firebase Storage y limpia los que ya rebasaron
// la retención (7 días) para no acumular archivos indefinidamente.
window.subirBackupStorage = async function () {
    if (!_storageDisponible()) { console.warn("Firebase Storage no disponible; se omite el respaldo a la nube."); return false; }
    try {
        const backup = await _construirBackup();   // ← usa StorageService dinámico, no localStorage
        const json   = JSON.stringify(backup, null, 2);
        const fecha  = window.getFechaLocalMX ? window.getFechaLocalMX() : new Date().toISOString().slice(0, 10);
        const nombre = `REV-BACKUP-v${BACKUP_VERSION}-${fecha}.json`;
        const ref    = firebase.storage().ref(`${_BACKUP_FOLDER}/${nombre}`);
        await ref.putString(json, 'raw', { contentType: 'application/json' });
        console.log(`☁️ Backup subido a Storage: ${nombre}`);
        _limpiarBackupsAntiguosStorage().catch(() => {});
        return true;
    } catch (err) {
        console.error("Error subiendo backup a Storage:", err);
        alert(`❌ No se pudo subir el respaldo a la nube: ${err.message}`);
        return false;
    }
};

// Borra respaldos con más de _BACKUP_RETENCION_DIAS días, según la fecha
// codificada en el nombre del archivo (REV-BACKUP-v2-YYYY-MM-DD.json).
async function _limpiarBackupsAntiguosStorage() {
    const carpeta = firebase.storage().ref(_BACKUP_FOLDER);
    const lista   = await carpeta.listAll();
    const limiteMs = Date.now() - _BACKUP_RETENCION_DIAS * 24 * 60 * 60 * 1000;
    for (const item of lista.items) {
        const m = item.name.match(/(\d{4}-\d{2}-\d{2})\.json$/);
        if (!m) continue;
        const fechaArchivo = new Date(`${m[1]}T00:00:00`).getTime();
        if (!isNaN(fechaArchivo) && fechaArchivo < limiteMs) {
            await item.delete().catch(e => console.warn(`No se pudo borrar respaldo antiguo ${item.name}:`, e));
        }
    }
}

window.mostrarListaBackups = async function () {
    if (!_storageDisponible()) { alert("❌ Firebase Storage no está disponible."); return; }
    const cont = document.getElementById("listaBackupsStorage");
    if (cont) cont.innerHTML = "<p style='color:#6b7280;font-size:13px;'>Cargando...</p>";
    try {
        const carpeta = firebase.storage().ref(_BACKUP_FOLDER);
        const lista   = await carpeta.listAll();
        const items = await Promise.all(lista.items.map(async item => {
            const meta = await item.getMetadata();
            return { name: item.name, size: meta.size || 0 };
        }));
        items.sort((a, b) => b.name.localeCompare(a.name));
        if (!cont) return;
        if (items.length === 0) { cont.innerHTML = "<p style='color:#9ca3af;font-size:13px;'>No hay respaldos.</p>"; return; }
        cont.innerHTML = items.map(f => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f3f4f6;">
                <span style="font-size:13px;flex:1;color:#374151;">📄 ${f.name}</span>
                <span style="font-size:11px;color:#9ca3af;">${(f.size/1024).toFixed(1)} KB</span>
                <button onclick="restaurarDesdeStorage('${f.name}')"
                    style="padding:4px 10px;background:#8b5cf6;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">
                    ♻️ Restaurar
                </button>
            </div>`).join("");
    } catch (err) {
        if (cont) cont.innerHTML = `<p style='color:#dc2626;font-size:13px;'>❌ ${err.message}</p>`;
    }
};

window.restaurarDesdeStorage = async function (nombre) {
    if (!_storageDisponible()) { alert("❌ Firebase Storage no está disponible."); return; }
    if (!confirm(`¿Restaurar "${nombre}"? Los datos actuales serán reemplazados.`)) return;
    try {
        const ref  = firebase.storage().ref(`${_BACKUP_FOLDER}/${nombre}`);
        const url  = await ref.getDownloadURL();
        const res  = await fetch(url);
        const text = await res.text();
        const fakeEvent = { target: { files: [new File([text], nombre, { type: "application/json" })], value: "" } };
        window.importarBackupJSON(fakeEvent);
    } catch (err) {
        alert(`❌ No se pudo restaurar: ${err.message}`);
    }
};
