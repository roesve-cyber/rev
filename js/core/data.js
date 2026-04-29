// Variables globales
let categoriasData = StorageService.get("categoriasData", [
    { nombre: "Recámaras", subcategorias: [{ nombre: "Roperos", margen: 35 }, { nombre: "Bases", margen: 30 }] },
    { nombre: "Salas", subcategorias: [{ nombre: "Sofás", margen: 40 }] }
]);

let tarjetasConfig = StorageService.get("tarjetasConfig", [
    { banco: "BBVA", diaCorte: 15, diaLimite: 5 },
    { banco: "BANAMEX", diaCorte: 1, diaLimite: 20 }
]);

// Si tarjetasConfig está vacío, inicializalo con valores por defecto
if (!tarjetasConfig || tarjetasConfig.length === 0) {
    tarjetasConfig = [
        { banco: "BBVA", diaCorte: 15, diaLimite: 5 },
        { banco: "BANAMEX", diaCorte: 1, diaLimite: 20 }
    ];
    StorageService.set("tarjetasConfig", tarjetasConfig);
    console.log("✅ tarjetasConfig inicializado con valores por defecto");
}

let productos = StorageService.get("productos", []);
let proveedores = StorageService.get("proveedores", []);
let clientes = StorageService.get("clientes", []);
let carrito = StorageService.get("carrito", []);
let movimientosInventario = StorageService.get("movimientosInventario", []);
let recepciones = StorageService.get("recepciones", []);
let compras = StorageService.get("compras", []);
let cuentasPorPagar = StorageService.get("cuentasPorPagar", []);
let deudasMSI = StorageService.get("deudasMSI", []);
let cuentasPorCobrar = StorageService.get("cuentasPorCobrar", []);
if (!Array.isArray(cuentasPorCobrar)) {
    cuentasPorCobrar = [];
    StorageService.set("cuentasPorCobrar", cuentasPorCobrar);
}
let movimientosCaja = StorageService.get("movimientosCaja", []);
let requisicionesCompra = StorageService.get("requisicionesCompra", []);
let salidasPendientesVenta = StorageService.get("salidasPendientesVenta", []);
let pagaresSistema = StorageService.get("pagaresSistema", []);

let cuentasEfectivo = StorageService.get("cuentasEfectivo", [
    { id: "efectivo", nombre: "💵 Efectivo", tipo: "efectivo", saldo: 0 }
]);

let plazoSeleccionado = null;
let productoEditando = null;
let productoActualId = null;
let clienteEditandoId = null;
let clienteSeleccionado = null;
let _planElegidoPendiente = null;
let decisionesInventario = {};
let _vendedorSeleccionado = null;

// Funciones utilidades
function dinero(valor) {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    }).format(valor || 0);
}

function mostrarVista(id) { navA(id); }

function migrarStorageCuentasPorCobrar() {
    try {
        const legacyRaw = localStorage.getItem("cuentasPorCobrarCliente");
        if (!legacyRaw) return;
        const legacy = JSON.parse(legacyRaw);
        if (!Array.isArray(legacy) || legacy.length === 0) {
            localStorage.removeItem("cuentasPorCobrarCliente");
            return;
        }
        const actual = StorageService.get("cuentasPorCobrar", []);
        legacy.forEach((row) => {
            const saldoFin = row.precioContadoOriginal ?? row.totalContadoOriginal ?? row.saldoPendiente ?? 0;
            let fechaVentaIso = row.fechaVenta;
            if (!fechaVentaIso && typeof row.fecha === "string") {
                const partes = row.fecha.split("/");
                if (partes.length === 3) {
                    const d = new Date(parseInt(partes[2], 10), parseInt(partes[1], 10) - 1, parseInt(partes[0], 10));
                    if (!isNaN(d.getTime())) fechaVentaIso = d.toISOString();
                }
            }
            if (!fechaVentaIso) fechaVentaIso = new Date().toISOString();
            actual.push({
                folio: row.folio,
                nombre: row.clienteNombre || row.nombre || "Cliente",
                clienteId: row.clienteId,
                fechaVenta: fechaVentaIso,
                totalContadoOriginal: saldoFin,
                saldoActual: row.saldoPendiente ?? row.saldoActual ?? saldoFin,
                plan: row.plan || null,
                metodo: row.metodo || "credito",
                estado: row.estado || "Pendiente",
                abonos: Array.isArray(row.abonos) ? row.abonos : []
            });
        });
        if (!StorageService.set("cuentasPorCobrar", actual)) {
            console.warn("⚠️ No se pudo guardar migración");
            return;
        }
        localStorage.removeItem("cuentasPorCobrarCliente");
        cuentasPorCobrar = actual;
    } catch (e) {
        console.warn("⚠️ Error en migración:", e.message);
    }
}
// Función puente para sincronizar con Firebase sin romper el modo local
function sincronizarConNube(clave, datos) {
    // Si Firebase está activo y NO estamos en una dirección local (localhost o archivo)
    const esLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.protocol === "file:";
    
    if (window._firebaseActivo && window._db && !esLocal) {
        window._db.collection('posData').doc(clave).set({
            data: datos,
            ultimaActualizacion: new Date().toISOString()
        })
        .then(() => console.log(`☁️ Sincronizado en vivo: ${clave}`))
        .catch(e => console.error(`❌ Error al sincronizar ${clave}:`, e));
    }
}
