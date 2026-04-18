// ===== INICIALIZACIÓN =====

document.addEventListener('DOMContentLoaded', () => {
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
        
        // Productos
        productos = StorageService.get("productos", []);
        
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
        
        // Navegar a inicio
        navA('inicio');
        actualizarContadorCarrito();
        
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
