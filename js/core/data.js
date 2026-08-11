// ============================================================
// 🛡️ CANDADO ANTI-DOBLE-TOQUE PARA BOTONES DE ACCIÓN ASÍNCRONA
// ============================================================
// Utilidad compartida: deshabilita un botón de inmediato al primer toque
// (antes de que corra cualquier confirm() o await) y lo reactiva solo
// cuando la operación completa — éxito, error o validación cancelada.
// Objetivo: en conexiones lentas (móvil) el usuario ve "Procesando…" en
// vez de pensar que el sistema se pasmó y volver a tocar, generando un
// registro duplicado (venta, abono, autorización, etc.).
//
// Uso típico en la función expuesta a onclick:
//   window.miAccion = function(args) {
//       return window.bloquearBotonDurante('idDelBoton', _miAccionAsync(args));
//   };
//   async function _miAccionAsync(args) { ...lógica real... }
//
// Si el botón ya está deshabilitado (proceso en curso), un toque repetido
// no hace nada — no relanza la operación ni abre un segundo confirm().
// Inyecta una sola vez el keyframe del spinner que usa bloquearBotonDurante.
(function _revInyectarEstiloSpinner() {
    if (document.getElementById('rev-spinner-style')) return;
    const style = document.createElement('style');
    style.id = 'rev-spinner-style';
    style.textContent = `
        @keyframes rev-spin { to { transform: rotate(360deg); } }
        .rev-spinner {
            display: inline-block;
            width: 14px;
            height: 14px;
            border: 2px solid rgba(255,255,255,0.45);
            border-top-color: currentColor;
            border-radius: 50%;
            animation: rev-spin 0.6s linear infinite;
            vertical-align: -2px;
            margin-right: 8px;
        }
    `;
    document.head.appendChild(style);
})();

window.bloquearBotonDurante = function(idBoton, promesa, textoProcesando = 'Procesando…') {
    const btn = idBoton ? document.getElementById(idBoton) : null;
    if (btn && btn.disabled) return Promise.resolve(undefined);
    if (btn) {
        btn.disabled = true;
        if (btn.dataset.htmlOriginal === undefined) btn.dataset.htmlOriginal = btn.innerHTML;
        btn.innerHTML = `<span class="rev-spinner"></span>${textoProcesando}`;
        btn.style.opacity = '0.85';
        btn.style.cursor = 'not-allowed';
    }
    return Promise.resolve(promesa).finally(() => {
        // Si el modal/panel ya se cerró tras completar la operación, el botón
        // ya no existe en el DOM y no hay nada que reactivar.
        const btnFinal = idBoton ? document.getElementById(idBoton) : null;
        if (btnFinal) {
            btnFinal.disabled = false;
            btnFinal.innerHTML = btnFinal.dataset.htmlOriginal ?? btnFinal.innerHTML;
            btnFinal.style.opacity = '';
            btnFinal.style.cursor = 'pointer';
        }
    });
};

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

// 🌍 getFechaLocalMX y localISO viven en js/services/validator.js (cargado antes)