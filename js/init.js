// ===== INICIALIZACION LOCAL DEL POS =====
// Este archivo solo prepara almacenamiento local, sesion y pantalla inicial.
// No dispara sincronizacion automatica con Firebase.

document.addEventListener('wheel', (event) => {
    const input = event.target;
    if (input && input.matches && input.matches('input[type="number"]')) {
        event.preventDefault();
    }
}, { passive: false, capture: true });

function _recargarRAMInicial() {
    window.categoriasData = StorageService.get("categoriasData", []) || [];
    if (window.categoriasData.length === 0) {
        window.categoriasData = [
            { nombre: "Recamaras", subcategorias: [{ nombre: "Roperos", margen: 35 }, { nombre: "Bases", margen: 30 }] },
            { nombre: "Salas", subcategorias: [{ nombre: "Sofas", margen: 40 }] }
        ];
    }

    window.tarjetasConfig = StorageService.get("tarjetasConfig", []) || [];
    if (window.tarjetasConfig.length === 0) {
        window.tarjetasConfig = [
            { banco: "BBVA", diaCorte: 15, diaLimite: 5 },
            { banco: "BANAMEX", diaCorte: 1, diaLimite: 20 }
        ];
    }

    window.productos = StorageService.get("productos", []) || [];
    window.clientes = StorageService.get("clientes", []) || [];
    window.carrito = StorageService.get("carrito", []) || [];
    window.cuentasPorCobrar = StorageService.get("cuentasPorCobrar", []) || [];
    window.pagaresSistema = StorageService.get("pagaresSistema", []) || [];
    window.proveedores = StorageService.get("proveedores", []) || [];
    window.movimientosInventario = StorageService.get("movimientosInventario", []) || [];
    window.recepciones = StorageService.get("recepciones", []) || [];
    window.compras = StorageService.get("compras", []) || [];
    window.cuentasPorPagar = StorageService.get("cuentasPorPagar", []) || [];
    window.deudasMSI = StorageService.get("deudasMSI", []) || [];
    window.movimientosCaja = StorageService.get("movimientosCaja", []) || [];
    window.requisicionesCompra = StorageService.get("requisicionesCompra", []) || [];
    window.salidasPendientesVenta = StorageService.get("salidasPendientesVenta", []) || [];
    window.cotizaciones = StorageService.get("cotizaciones", []) || [];
    window.apartados = StorageService.get("apartados", []) || [];
    window.gastosOperativos = StorageService.get("gastosOperativos", []) || [];
    window.ventasRegistradas = StorageService.get("ventasRegistradas", []) || [];
    window.registroTickets = StorageService.get("registroTickets", []) || [];
    window.cuentasEfectivo = StorageService.get("cuentasEfectivo", window.cuentasEfectivo || []) || [];
}

function _hayDatosLocalesOperativos() {
    const tablas = [
        "productos",
        "clientes",
        "cuentasPorCobrar",
        "ventasRegistradas",
        "pagaresSistema",
        "movimientosCaja"
    ];
    return tablas.some(tabla => {
        const datos = StorageService.get(tabla, []);
        return Array.isArray(datos) && datos.length > 0;
    });
}

function _listaDesdeObjetoFirebase(valor, profundidad = 0) {
    if (valor === null || valor === undefined || profundidad > 6) return null;
    if (Array.isArray(valor)) return valor;
    if (!valor || typeof valor !== "object") return null;

    if (Array.isArray(valor.__mmpArray)) return valor.__mmpArray;

    const campos = ["data", "datos", "items", "registros", "records", "rows", "lista", "value"];
    for (const campo of campos) {
        if (Object.prototype.hasOwnProperty.call(valor, campo)) {
            const lista = _listaDesdeObjetoFirebase(valor[campo], profundidad + 1);
            if (lista) return lista;
        }
    }

    const entradas = Object.entries(valor).filter(([key]) => !key.startsWith("_"));
    if (!entradas.length) return [];

    const valores = entradas.map(([, item]) => item);
    if (!valores.some(item => item && typeof item === "object")) return null;

    return valores;
}

async function _forzarListasLocalesOperativas() {
    if (typeof StorageService.normalizarListasLocales === "function") {
        await StorageService.normalizarListasLocales();
        return;
    }

    const tablas = [
        "productos",
        "clientes",
        "cuentasPorCobrar",
        "ventasRegistradas",
        "pagaresSistema",
        "movimientosCaja"
    ];

    for (const tabla of tablas) {
        const actual = StorageService.get(tabla, null);
        if (Array.isArray(actual)) continue;

        const lista = _listaDesdeObjetoFirebase(actual);
        if (!lista) continue;

        await StorageService._guardarLocalDirecto(tabla, lista);
        console.warn(`Tabla ${tabla} normalizada localmente: ${lista.length} registros.`);
    }
}

async function _bootstrapFirebaseSiLocalVacio() {
    if (!window._firebaseActivo || !window._db || !window.StorageService?.syncAll) return false;
    if (window._auth && !window._auth.currentUser) return false;
    if (_hayDatosLocalesOperativos()) return false;

    console.warn("Almacen local vacio; descargando datos iniciales desde Firebase.");
    try {
        await StorageService.syncAll({ forzarDescarga: true });
        await _forzarListasLocalesOperativas();
        _recargarRAMInicial();
        return true;
    } catch (err) {
        console.warn("No se pudo descargar datos iniciales desde Firebase:", err);
        return false;
    }
}

function _logConteosArranque() {
    const resumen = {
        productos: StorageService.get("productos", []).length,
        clientes: StorageService.get("clientes", []).length,
        cuentasPorCobrar: StorageService.get("cuentasPorCobrar", []).length,
        pagaresSistema: StorageService.get("pagaresSistema", []).length,
        ventasRegistradas: StorageService.get("ventasRegistradas", []).length,
        movimientosCaja: StorageService.get("movimientosCaja", []).length
    };
    console.log("Conteos storage post-arranque:", resumen);
    return resumen;
}

function _renderVistaActualInicial(vistaId) {
    if (typeof navA === 'function') navA(vistaId || 'inicio');
    setTimeout(() => {
        const actual = window._vistaActualSistema || vistaId || 'inicio';
        if (typeof navA === 'function') navA(actual, true);
        if (actual === 'dashboard' && typeof renderDashboard === 'function') renderDashboard();
        if (actual === 'tienda' && typeof mostrarProductos === 'function') mostrarProductos();
        if (actual === 'cuentasxcobrar' && typeof renderCuentasXCobrar === 'function') renderCuentasXCobrar();
        if (actual === 'clientes' && typeof renderClientes === 'function') renderClientes();
    }, 250);
}

document.addEventListener('DOMContentLoaded', async () => {
    if (window.location.pathname.includes("catalogo.html")) {
        console.log("Modo catalogo publico");
        return;
    }

    try {
        if (window.StorageService?.init) {
            await StorageService.init();
        }

        await _bootstrapFirebaseSiLocalVacio();
        await _forzarListasLocalesOperativas();
        _recargarRAMInicial();
        _logConteosArranque();

        if (typeof migrarStorageCuentasPorCobrar === 'function') migrarStorageCuentasPorCobrar();
        if (typeof inicializarNotificaciones === 'function') inicializarNotificaciones();
        if (typeof verificarGastosRecurrentes === 'function') verificarGastosRecurrentes();
        if (typeof verificarSesionInicial === 'function') verificarSesionInicial();

        const params = new URLSearchParams(window.location.search || '');
        const vistaInicial = params.get('view') || (window.location.hash ? window.location.hash.replace('#', '') : '') || 'inicio';
        _renderVistaActualInicial(vistaInicial);
        if (typeof actualizarContadorCarrito === 'function') actualizarContadorCarrito();
        if (typeof verificarAlertasPagares === 'function') verificarAlertasPagares();

        if (typeof window._actualizarEstadoFirebaseUI === 'function') {
            window._actualizarEstadoFirebaseUI();
        }

        console.log("Sistema inicializado. Firebase solo descarga automaticamente si el dispositivo esta vacio.");
    } catch (e) {
        console.error("Error critico en carga inicial:", e);
    }
});
