// Variables globales
var categoriasData = StorageService.get("categoriasData", [
    { nombre: "Recámaras", subcategorias: [{ nombre: "Roperos", margen: 35 }, { nombre: "Bases", margen: 30 }], posicion: 1 },
    { nombre: "Salas", subcategorias: [{ nombre: "Sofás", margen: 40 }], posicion: 2 }
]);

var tarjetasConfig = StorageService.get("tarjetasConfig", [
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

var productos = StorageService.get("productos", []);
var proveedores = StorageService.get("proveedores", []);
var clientes = StorageService.get("clientes", []);
var carrito = StorageService.get("carrito", []);
var movimientosInventario = StorageService.get("movimientosInventario", []);
var recepciones = StorageService.get("recepciones", []);
var compras = StorageService.get("compras", []);
var cuentasPorPagar = StorageService.get("cuentasPorPagar", []);
var deudasMSI = StorageService.get("deudasMSI", []);
var cuentasPorCobrar = StorageService.get("cuentasPorCobrar", []);
if (!Array.isArray(cuentasPorCobrar)) {
    cuentasPorCobrar = [];
    StorageService.set("cuentasPorCobrar", cuentasPorCobrar);
}
var movimientosCaja = StorageService.get("movimientosCaja", []);
var requisicionesCompra = StorageService.get("requisicionesCompra", []);
var salidasPendientesVenta = StorageService.get("salidasPendientesVenta", []);
var pagaresSistema = StorageService.get("pagaresSistema", []);

var cuentasEfectivo = StorageService.get("cuentasEfectivo", [
    { id: "efectivo", nombre: "💵 Efectivo", tipo: "efectivo", saldo: 0 }
]);

var plazoSeleccionado = null;
var productoEditando = null;
var productoActualId = null;
var clienteEditandoId = null;
var clienteSeleccionado = null;
var _planElegidoPendiente = null;
var decisionesInventario = {};
var _vendedorSeleccionado = null;

// Funciones utilidades
function dinero(valor) {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    }).format(valor || 0);
}

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
            // 🛡️ REPARACIÓN: Blindaje de zona horaria sin duplicar variables
            let fechaVentaIso = null;
            if (row.fechaVenta) {
                fechaVentaIso = window.localISO(row.fechaVenta);
            } else if (typeof row.fecha === "string") {
                const partes = row.fecha.split("/");
                if (partes.length === 3) {
                    const d = new Date(parseInt(partes[2], 10), parseInt(partes[1], 10) - 1, parseInt(partes[0], 10));
                    if (!isNaN(d.getTime())) fechaVentaIso = window.localISO(d);
                }
            }
            if (!fechaVentaIso) fechaVentaIso = window.localISO(new Date());
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
        StorageService.set("cuentasPorCobrar", actual).catch(function() {
            console.warn("⚠️ No se pudo guardar migración");
        });
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
            // 🛡️ REPARACIÓN: Timestamp de Firebase sincronizado con México
            ultimaActualizacion: window.localISO(new Date())
        })
        .then(() => console.log(`☁️ Sincronizado en vivo: ${clave}`))
        .catch(e => {
            console.error(`❌ Error al sincronizar ${clave}:`, e);
            if (window.StorageService?._notificarFalloSync) window.StorageService._notificarFalloSync(clave, e);
        });
    }
}

// 🌍 getFechaLocalMX y localISO viven en js/services/validator.js (cargado antes)