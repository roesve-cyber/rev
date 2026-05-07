// ===== INICIALIZACIÓN =====

document.addEventListener('DOMContentLoaded', async () => {
    if (window.location.pathname.includes("catalogo.html")) {
        console.log("🛍️ Modo catálogo público");
        return;
    }
    if (typeof verificarSesionInicial === 'function') verificarSesionInicial();
    console.log("🚀 Iniciando sistema POS Mueblería Mi Pueblito...");
    
    try {
        // 1. Despertar la base de datos local (Instantáneo)
        await StorageService.init();

        // ☁️ 2. SINCRONIZACIÓN FIREBASE (Descarga la nube antes de arrancar)
        if (window._firebaseActivo && window._db) {
            console.log("☁️ Sincronizando con Firebase al arrancar...");
            try {
                // Esperamos a que descargue todos los productos y clientes de la nube
                await StorageService.syncAll(); 
            } catch (e) {
                console.warn("⚠️ Trabajando Offline. Se usarán los datos locales.", e);
            }
        }

        // 3. Cargar TODO a la memoria global de forma SEGURA (con || [] para evitar crasheos)
        window.categoriasData = StorageService.get("categoriasData", []) || [];
        if (window.categoriasData.length === 0) {
            window.categoriasData = [
                { nombre: "Recámaras", subcategorias: [{ nombre: "Roperos", margen: 35 }, { nombre: "Bases", margen: 30 }] },
                { nombre: "Salas", subcategorias: [{ nombre: "Sofás", margen: 40 }] }
            ];
            StorageService.set("categoriasData", window.categoriasData);
        }
        
        window.tarjetasConfig = StorageService.get("tarjetasConfig", []) || [];
        if (window.tarjetasConfig.length === 0) {
            window.tarjetasConfig = [
                { banco: "BBVA", diaCorte: 15, diaLimite: 5 },
                { banco: "BANAMEX", diaCorte: 1, diaLimite: 20 }
            ];
            StorageService.set("tarjetasConfig", window.tarjetasConfig);
        }

        // Leer variables (ya actualizadas por Firebase o locales)
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
        
        // Ejecutar funciones iniciales
        if (typeof migrarStorageCuentasPorCobrar === 'function') migrarStorageCuentasPorCobrar();
        if (typeof inicializarNotificaciones === 'function') inicializarNotificaciones();
        if (typeof verificarGastosRecurrentes === 'function') verificarGastosRecurrentes();
        
        // 4. Arrancar la interfaz gráfica
        if (!window.location.pathname.includes("catalogo.html")) {
            if (typeof navA === 'function') navA('inicio');
            if (typeof actualizarContadorCarrito === 'function') actualizarContadorCarrito();
            if (typeof verificarAlertasPagares === 'function') verificarAlertasPagares();
        }
        
        if (typeof StorageService.startRealtimeSync === 'function') {
            StorageService.startRealtimeSync();
        }
        
        console.log("✅ Sistema cargado y sincronizado correctamente.");
        console.log("📊 Estado actual:");
        console.log(`   • Categorías: ${window.categoriasData.length}`);
        console.log(`   • Bancos: ${window.tarjetasConfig.length}`);
        console.log(`   • Productos: ${window.productos.length}`);
        console.log(`   • Clientes: ${window.clientes.length}`);
        
    } catch (e) {
        console.error("⚠️ Error crítico en carga inicial:", e);
    }
});
