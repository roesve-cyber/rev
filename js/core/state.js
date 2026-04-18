// Variables globales
var categoriasData = StorageService.get("categoriasData", [
    { nombre: "Recámaras", subcategorias: [{ nombre: "Roperos", margen: 35 }, { nombre: "Bases", margen: 30 }] },
    { nombre: "Salas", subcategorias: [{ nombre: "Sofás", margen: 40 }] }
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
var movimientosCaja = StorageService.get("movimientosCaja", []);
var requisicionesCompra = StorageService.get("requisicionesCompra", []);
var salidasPendientesVenta = StorageService.get("salidasPendientesVenta", []);
var pagaresSistema = StorageService.get("pagaresSistema", []);

var plazoSeleccionado = null;
var productoEditando = null;
var productoActualId = null;
var clienteEditandoId = null;
var clienteSeleccionado = null;
var decisionesInventario = {};
