// ===== INICIALIZACIÓN (VERSIÓN OFFLINE-FIRST ULTRA RÁPIDA Y AUDITADA V2) =====

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

        // 2. Cargar TODO a la memoria global de forma SEGURA usando datos locales preexistentes
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

        // Leer variables globales desde el almacenamiento local inmediatamente
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
        
        // ✨ CORRECCIÓN CRÍTICA: Despertar Cotizaciones, Gastos y Apartados omitidos
        window.cotizaciones = StorageService.get("cotizaciones", []) || [];
        window.apartados = StorageService.get("apartados", []) || [];
        window.gastosOperativos = StorageService.get("gastosOperativos", []) || [];
        window.ventasRegistradas = StorageService.get("ventasRegistradas", []) || [];
        
        // 3. Ejecutar utilidades y migraciones locales internas
        if (typeof migrarStorageCuentasPorCobrar === 'function') migrarStorageCuentasPorCobrar();
        if (typeof inicializarNotificaciones === 'function') inicializarNotificaciones();
        if (typeof verificarGastosRecurrentes === 'function') verificarGastosRecurrentes();
        
        // 4. ARRANCAR LA INTERFAZ GRÁFICA AL INSTANTE (Sin retrasos de red)
        if (!window.location.pathname.includes("catalogo.html")) {
            if (typeof navA === 'function') navA('inicio');
            if (typeof actualizarContadorCarrito === 'function') actualizarContadorCarrito();
            if (typeof verificarAlertasPagares === 'function') verificarAlertasPagares();
        }
        
        if (typeof StorageService.startRealtimeSync === 'function') {
            StorageService.startRealtimeSync();
        }
        
        console.log("✅ Sistema cargado en local al instante con Cotizaciones fijadas.");

        // ☁️ 5. SINCRONIZACIÓN CON FIREBASE EN SEGUNDO PLANO (Asíncrono y silencioso)
        if (window._firebaseActivo && window._db) {
            console.log("☁️ Sincronizando con la nube en segundo plano...");
            
            StorageService.syncAll().then(() => {
                console.log("🔄 Nube sincronizada con éxito sin interrumpir al usuario.");
                
                // Volvemos a sincronizar la RAM con los datos frescos descargados de la nube
                window.productos = StorageService.get("productos", []) || [];
                window.clientes = StorageService.get("clientes", []) || [];
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
                
                // ✨ RAM Sincronizada para Cotizaciones y demás módulos
                window.cotizaciones = StorageService.get("cotizaciones", []) || [];
                window.apartados = StorageService.get("apartados", []) || [];
                window.gastosOperativos = StorageService.get("gastosOperativos", []) || [];
                window.ventasRegistradas = StorageService.get("ventasRegistradas", []) || [];
                
                // DETECTOR INTELIGENTE DE RENDERIZADO VISUAL EN TIEM realtime
                const vistaActiva = document.querySelector('.vista:not(.oculto)');
                if (vistaActiva) {
                    const idVista = vistaActiva.id;
                    if (idVista === 'dashboard' && typeof renderDashboard === 'function') renderDashboard();
                    else if (idVista === 'tienda' && typeof mostrarProductos === 'function') window.mostrarProductos();
                    else if (idVista === 'inventario' && typeof renderInventario === 'function') renderInventario();
                    else if (idVista === 'cuentasxcobrar' && typeof renderCuentasXCobrar === 'function') window.renderCuentasXCobrar();
                    else if (idVista === 'clientes' && typeof renderClientes === 'function') renderClientes();
                    else if (idVista === 'apartados' && typeof renderApartados === 'function') renderApartados();
                    // ✨ Redibujado en caliente por si el usuario está parado en el cotizador al sincronizar
                    else if ((idVista === 'cotizaciones' || idVista === 'cotizador') && typeof renderCotizaciones === 'function') renderCotizaciones();
                }
                
                if (typeof actualizarContadorCarrito === 'function') actualizarContadorCarrito();

            }).catch(e => {
                console.warn("⚠️ Sincronización en segundo plano con detalles.", e);
            });
        }
        
    } catch (e) {
        console.error("⚠️ Error crítico en carga inicial:", e);
    }
});