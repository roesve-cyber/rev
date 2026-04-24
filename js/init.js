// ===== INICIALIZACIÓN =====

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes("catalogo.html")) {
        console.log("🛍️ Modo catálogo público");
        return;
    }
    if (typeof verificarSesionInicial === 'function') verificarSesionInicial();
    console.log("🚀 Iniciando sistema POS Mueblería Mi Pueblito...");
    try {
        // ✅ Inicializar todos los datos con valores por defecto si están vacíos
        
        // Categorías
        if (!categoriasData || categoriasData.length === 0) {
            categoriasData = [
                { nombre: "Recámaras", subcategorias: [{ nombre: "Roperos", margen: 35 }, { nombre: "Bases", margen: 30 }] },
                { nombre: "Salas", subcategorias: [{ nombre: "Sofás", margen: 40 }] }
            ];
            StorageService.set("categoriasData", categoriasData);
        }
        
        // Tarjetas/Bancos
        if (!tarjetasConfig || tarjetasConfig.length === 0) {
            tarjetasConfig = [
                { banco: "BBVA", diaCorte: 15, diaLimite: 5 },
                { banco: "BANAMEX", diaCorte: 1, diaLimite: 20 }
            ];
            StorageService.set("tarjetasConfig", tarjetasConfig);
        }
        

        // Productos (global)
        window.productos = StorageService.get("productos", []);
        
        // Clientes
        clientes = StorageService.get("clientes", []);
        
        // Carrito
        carrito = StorageService.get("carrito", []);
        
        // Cuentas por cobrar
        cuentasPorCobrar = StorageService.get("cuentasPorCobrar", []);
        
        // Pagarés
        pagaresSistema = StorageService.get("pagaresSistema", []);
        
        // Otros
        proveedores = StorageService.get("proveedores", []);
        movimientosInventario = StorageService.get("movimientosInventario", []);
        recepciones = StorageService.get("recepciones", []);
        compras = StorageService.get("compras", []);
        cuentasPorPagar = StorageService.get("cuentasPorPagar", []);
        deudasMSI = StorageService.get("deudasMSI", []);
        movimientosCaja = StorageService.get("movimientosCaja", []);
        requisicionesCompra = StorageService.get("requisicionesCompra", []);
        salidasPendientesVenta = StorageService.get("salidasPendientesVenta", []);
        
        // Migración de datos antiguos
        migrarStorageCuentasPorCobrar();
        
        // Inicializar notificaciones
        if (typeof inicializarNotificaciones === 'function') inicializarNotificaciones();
        
        // Verificar gastos recurrentes
        if (typeof verificarGastosRecurrentes === 'function') verificarGastosRecurrentes();
        
        // Navegar a dashboard y verificar alertas
        if (!window.location.pathname.includes("catalogo.html")) {
    navA('dashboard');
    actualizarContadorCarrito();
    verificarAlertasPagares();
}
        actualizarContadorCarrito();
        verificarAlertasPagares();
        
        console.log("✅ Sistema cargado correctamente.");
        console.log("📊 Estado actual:");
        console.log(`   • Categorías: ${categoriasData.length}`);
        console.log(`   • Bancos: ${tarjetasConfig.length}`);
        console.log(`   • Productos: ${productos.length}`);
        console.log(`   • Clientes: ${clientes.length}`);
        
    } catch (e) {
        console.warn("⚠️ Aviso en carga inicial:", e);
    }
});
