// ===== INICIALIZACIÓN (VERSIÓN OFFLINE-FIRST ULTRA RÁPIDA Y BLINDADA) =====

document.addEventListener('DOMContentLoaded', async () => {
    if (window.location.pathname.includes("catalogo.html")) {
        console.log("🛍️ Modo catálogo público");
        return;
    }
    if (typeof verificarSesionInicial === 'function') verificarSesionInicial();
    console.log("🚀 Iniciando sistema POS Mueblería Mi Pueblito...");
    
    try {
        // 1. Despertar la base de datos local (Instantáneo - 50ms)
        await StorageService.init();

        // 2. FUNCIÓN MAESTRA: Carga todo a la memoria global desde el disco duro
        const recargarRAM = () => {
            window.categoriasData = StorageService.get("categoriasData", []) || [];
            if (window.categoriasData.length === 0) {
                window.categoriasData = [
                    { nombre: "Recámaras", subcategorias: [{ nombre: "Roperos", margen: 35 }, { nombre: "Bases", margen: 30 }] },
                    { nombre: "Salas", subcategorias: [{ nombre: "Sofás", margen: 40 }] }
                ];
            }
            
            window.tarjetasConfig = StorageService.get("tarjetasConfig", []) || [];
            if (window.tarjetasConfig.length === 0) {
                window.tarjetasConfig = [
                    { banco: "BBVA", diaCorte: 15, diaLimite: 5 },
                    { banco: "BANAMEX", diaCorte: 1, diaLimite: 20 }
                ];
            }

            // Variables de operación
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
            
            // Módulos adicionales
            window.cotizaciones = StorageService.get("cotizaciones", []) || [];
            window.apartados = StorageService.get("apartados", []) || [];
            window.gastosOperativos = StorageService.get("gastosOperativos", []) || [];
            window.ventasRegistradas = StorageService.get("ventasRegistradas", []) || [];
        };

        // 3. Ejecutamos la recarga inicial para prender la pantalla en 0.1s
        recargarRAM();
        
        // Ejecutar funciones iniciales locales
        if (typeof migrarStorageCuentasPorCobrar === 'function') migrarStorageCuentasPorCobrar();
        if (typeof inicializarNotificaciones === 'function') inicializarNotificaciones();
        if (typeof verificarGastosRecurrentes === 'function') verificarGastosRecurrentes();
        
        // 4. ARRANCAR LA INTERFAZ GRÁFICA INMEDIATAMENTE
        if (!window.location.pathname.includes("catalogo.html")) {
            if (typeof navA === 'function') navA('inicio');
            if (typeof actualizarContadorCarrito === 'function') actualizarContadorCarrito();
            if (typeof verificarAlertasPagares === 'function') verificarAlertasPagares();
        }
        
        if (typeof StorageService.startRealtimeSync === 'function') {
            StorageService.startRealtimeSync();
        }
        
        console.log("✅ Sistema cargado en local al instante.");

        // ☁️ 5. SINCRONIZACIÓN FIREBASE EN SEGUNDO PLANO
        if (window._firebaseActivo && window._db) {
            console.log("☁️ Sincronizando con la nube en segundo plano...");
            
            StorageService.syncAll().then(() => {
                console.log("🔄 Nube sincronizada con éxito.");
                
                // ✨ MAGIA: Volvemos a leer TODO (incluyendo las categorías) desde los datos frescos
                recargarRAM();
                
                // REDIBUJADO INTELIGENTE (Sin errores de contexto)
                const vistaActiva = document.querySelector('.vista:not(.oculto)');
                if (vistaActiva) {
                    const idVista = vistaActiva.id;
                    if (idVista === 'dashboard' && typeof renderDashboard === 'function') renderDashboard();
                    else if (idVista === 'tienda' && typeof mostrarProductos === 'function') mostrarProductos();
                    else if (idVista === 'inventario' && typeof renderInventario === 'function') renderInventario();
                    else if (idVista === 'cuentasxcobrar' && typeof renderCuentasXCobrar === 'function') renderCuentasXCobrar();
                    else if (idVista === 'clientes' && typeof renderClientes === 'function') renderClientes();
                    else if (idVista === 'apartados' && typeof renderApartados === 'function') renderApartados();
                    else if ((idVista === 'cotizaciones' || idVista === 'cotizador') && typeof renderCotizaciones === 'function') renderCotizaciones();
                }
                
                if (typeof actualizarContadorCarrito === 'function') actualizarContadorCarrito();

            }).catch(e => {
                console.warn("⚠️ Trabajando Offline. La nube no respondió, pero el sistema sigue funcionando.", e);
            });
        }
        
    } catch (e) {
        console.error("⚠️ Error crítico en carga inicial:", e);
    }
});