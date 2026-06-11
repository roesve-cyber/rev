// ===== HERRAMIENTA DE RECUPERACIÓN DE EMERGENCIA =====
// Recupera datos de claves con mayúsculas incorrectas y los restaura

// 🔍 Función de verificación rápida
window.verificarDatos = function() {
    console.log("=== 🔍 VERIFICACIÓN DE DATOS ===");
    
    const tablasImportantes = [
        'productos', 'clientes', 'proveedores', 'cuentasPorCobrar', 
        'cuentasPorPagar', 'pagaresSistema', 'movimientosCaja',
        'movimientosInventario', 'compras', 'categoriasData'
    ];
    
    let resultado = {
        ok: true,
        problemas: [],
        encontrados: {}
    };
    
    tablasImportantes.forEach(tabla => {
        const datos = StorageService.get(tabla, null);
        const variable = window[tabla];
        
        if (!datos || (Array.isArray(datos) && datos.length === 0)) {
            resultado.ok = false;
            resultado.problemas.push(`❌ ${tabla}: VACÍO o NO EXISTE`);
        } else {
            const count = Array.isArray(datos) ? datos.length : 'N/A';
            resultado.encontrados[tabla] = count;
            console.log(`✅ ${tabla}: ${count} registro(s)`);
        }
        
        // Verificar que la variable global coincida
        if (variable !== datos) {
            console.warn(`⚠️ ${tabla}: Variable global no coincide con StorageService`);
        }
    });
    
    if (resultado.problemas.length > 0) {
        console.log("\n⚠️ PROBLEMAS DETECTADOS:");
        resultado.problemas.forEach(p => console.log(p));
        console.log("\n💡 Intenta ejecutar: recuperarDatosEmergencia()");
    } else {
        console.log("\n✅ TODOS LOS DATOS ESTÁN CORRECTOS");
    }
    
    return resultado;
};

window.recuperarDatosEmergencia = async function() {
    console.log("🚨 INICIANDO RECUPERACIÓN DE EMERGENCIA...");
    
    const keyMigrations = {
        'CuentasPorPagar': 'cuentasPorPagar',
        'Proveedores': 'proveedores',
        'CuentasPorCobrar': 'cuentasPorCobrar',
        'Clientes': 'clientes',
        'Productos': 'productos',
        'MovimientosCaja': 'movimientosCaja',
        'MovimientosInventario': 'movimientosInventario',
        'Compras': 'compras',
        'Recepciones': 'recepciones',
        'CategoriasData': 'categoriasData'
    };
    
    let recuperados = 0;
    let errores = 0;
    
    try {
        // Intentar recuperar de IndexedDB (localforage)
        const keys = await localforage.keys();
        console.log("🔍 Claves encontradas en IndexedDB:", keys);
        
        for (let [keyIncorrecta, keyCorrecta] of Object.entries(keyMigrations)) {
            try {
                // Buscar en IndexedDB
                const datosIncorrectos = await localforage.getItem(keyIncorrecta);
                const datosCorrectos = await localforage.getItem(keyCorrecta);
                
                if (datosIncorrectos && (!datosCorrectos || (Array.isArray(datosCorrectos) && datosCorrectos.length === 0))) {
                    console.log(`✅ Recuperando ${keyIncorrecta} → ${keyCorrecta}:`, datosIncorrectos.length || datosIncorrectos);
                    await localforage.setItem(keyCorrecta, datosIncorrectos);
                    StorageService._cache[keyCorrecta] = datosIncorrectos;
                    
                    // Actualizar variable global
                    if (keyCorrecta === 'productos') window.productos = datosIncorrectos;
                    if (keyCorrecta === 'proveedores') window.proveedores = datosIncorrectos;
                    if (keyCorrecta === 'cuentasPorPagar') window.cuentasPorPagar = datosIncorrectos;
                    if (keyCorrecta === 'clientes') window.clientes = datosIncorrectos;
                    
                    recuperados++;
                }
            } catch (e) {
                console.error(`❌ Error recuperando ${keyIncorrecta}:`, e);
                errores++;
            }
        }
        
        // Intentar también en localStorage
        for (let [keyIncorrecta, keyCorrecta] of Object.entries(keyMigrations)) {
            try {
                const datosIncorrectos = localStorage.getItem(keyIncorrecta);
                if (datosIncorrectos && !StorageService._cache[keyCorrecta]) {
                    const parsed = JSON.parse(datosIncorrectos);
                    console.log(`✅ Recuperando de localStorage ${keyIncorrecta} → ${keyCorrecta}`);
                    await localforage.setItem(keyCorrecta, parsed);
                    StorageService._cache[keyCorrecta] = parsed;
                    
                    // Actualizar variable global
                    if (keyCorrecta === 'productos') window.productos = parsed;
                    if (keyCorrecta === 'proveedores') window.proveedores = parsed;
                    if (keyCorrecta === 'cuentasPorPagar') window.cuentasPorPagar = parsed;
                    if (keyCorrecta === 'clientes') window.clientes = parsed;
                    
                    recuperados++;
                }
            } catch (e) {
                console.error(`❌ Error recuperando de localStorage ${keyIncorrecta}:`, e);
            }
        }
        
        if (recuperados > 0) {
            console.log(`✅ RECUPERACIÓN COMPLETADA: ${recuperados} tabla(s) recuperada(s)`);
            alert(`✅ Se recuperaron ${recuperados} tabla(s) de datos.\n\n⚠️ Se recomienda recargar la página (F5).`);
            return { exito: true, recuperados, errores };
        } else {
            console.log("ℹ️ No se encontraron datos para recuperar.");
            alert("ℹ️ No se encontraron datos con claves incorrectas para recuperar.");
            return { exito: false, recuperados: 0, errores };
        }
        
    } catch (error) {
        console.error("❌ ERROR CRÍTICO EN RECUPERACIÓN:", error);
        alert("❌ Error en la recuperación: " + error.message);
        return { exito: false, error: error.message };
    }
};

// Función de diagnóstico para ver todas las claves
window.diagnosticarAlmacenamiento = async function() {
    console.log("=== 🔍 DIAGNÓSTICO DE ALMACENAMIENTO ===");
    
    // Ver en IndexedDB
    try {
        const keys = await localforage.keys();
        console.log("\n📦 IndexedDB - Claves encontradas:");
        for (let key of keys) {
            const data = await localforage.getItem(key);
            const tipo = Array.isArray(data) ? `Array[${data.length}]` : typeof data;
            console.log(`  - ${key}: ${tipo}`);
        }
    } catch (e) {
        console.log("⚠️ No se pudo acceder a IndexedDB");
    }
    
    // Ver en localStorage
    console.log("\n💾 localStorage - Claves encontradas:");
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        try {
            const data = JSON.parse(localStorage.getItem(key));
            const tipo = Array.isArray(data) ? `Array[${data.length}]` : typeof data;
            console.log(`  - ${key}: ${tipo}`);
        } catch (e) {
            console.log(`  - ${key}: (no JSON)`);
        }
    }
    
    // Ver en caché de StorageService
    console.log("\n🧠 StorageService._cache:");
    Object.keys(StorageService._cache).forEach(key => {
        const data = StorageService._cache[key];
        const tipo = Array.isArray(data) ? `Array[${data.length}]` : typeof data;
        console.log(`  - ${key}: ${tipo}`);
    });
    
    return {
        indexedDB: await localforage.keys().catch(() => []),
        localStorage: Object.keys(localStorage),
        cache: Object.keys(StorageService._cache)
    };
};

// 🔄 Función para forzar recarga dinámica de variables globales
window.recargarVariablesGlobales = async function() {
    console.log("🔄 Recargando variables globales dinámicamente desde StorageService...");

    const tablas = await StorageService.getTablasDinamicas();
    
    let recargadas = 0;

    for (let tabla of tablas) {
        const datos = StorageService.get(tabla, null);

        if (StorageService._esTablaValida(tabla, datos)) {
            window[tabla] = datos;
            console.log(`✓ ${tabla}: ${Array.isArray(datos) ? datos.length + ' registros' : typeof datos}`);
            recargadas++;
        }
    }
    
    console.log(`✅ ${recargadas} variable(s) global(es) recargada(s)`);

    // Renderizar vistas si están disponibles
    if (typeof renderInventario === 'function') renderInventario();
    if (typeof renderProveedores === 'function') renderProveedores();
    if (typeof renderClientes === 'function') renderClientes();
    if (typeof mostrarProductos === 'function') mostrarProductos();
    if (typeof renderCuentasXCobrar === 'function') renderCuentasXCobrar();
    if (typeof renderCategorias === 'function') renderCategorias();
    if (typeof actualizarCombosFiltros === 'function') actualizarCombosFiltros();
    
    return { recargadas };
};

console.log("🔧 Herramientas de recuperación cargadas.");
console.log("📋 Comandos disponibles:");
console.log("  - verificarDatos(): Verificar estado actual de los datos");
console.log("  - diagnosticarAlmacenamiento(): Ver todas las claves en storage");
console.log("  - recuperarDatosEmergencia(): Intentar recuperar datos perdidos");
console.log("  - recargarVariablesGlobales(): Forzar recarga de variables desde storage");

window.repararIdsClientesAntiguos = async function(opciones = {}) {
    const dryRun = opciones.dryRun === true;
    const normalizar = valor => String(valor || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const hashTexto = texto => {
        let hash = 2166136261;
        for (let i = 0; i < texto.length; i++) {
            hash ^= texto.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(36).toUpperCase();
    };
    const getNombre = item => item?.clienteNombre || item?.nombre || item?.cliente?.nombre || item?.datosVenta?.cliente?.nombre || item?.venta?.cliente?.nombre || '';
    const getId = item => item?.clienteId || item?.cliente?.id || item?.datosVenta?.cliente?.id || item?.venta?.cliente?.id || '';
    const setClienteId = (item, id) => {
        if (!item || typeof item !== 'object') return false;
        let cambio = false;
        if (!item.clienteId) { item.clienteId = id; cambio = true; }
        if (item.cliente && typeof item.cliente === 'object' && !item.cliente.id) { item.cliente.id = id; cambio = true; }
        if (item.datosVenta?.cliente && typeof item.datosVenta.cliente === 'object' && !item.datosVenta.cliente.id) { item.datosVenta.cliente.id = id; cambio = true; }
        if (item.venta?.cliente && typeof item.venta.cliente === 'object' && !item.venta.cliente.id) { item.venta.cliente.id = id; cambio = true; }
        return cambio;
    };
    const guardarLocal = async (key, value) => {
        if (StorageService._guardarLocalDirecto) return StorageService._guardarLocalDirecto(key, value);
        StorageService._cache[key] = value;
        window[key] = value;
        if (StorageService._usandoLocalForage && typeof localforage !== 'undefined') return localforage.setItem(key, value);
        localStorage.setItem(key, JSON.stringify(value));
    };

    if (StorageService.init && !StorageService._isReady) await StorageService.init();

    const clientes = StorageService.get('clientes', []);
    if (!Array.isArray(clientes) || clientes.length === 0) {
        console.warn('No hay clientes para reparar.');
        return { ok: false, motivo: 'sin_clientes' };
    }

    const respaldo = { clientes: JSON.parse(JSON.stringify(clientes)) };
    const idsUsados = new Set(clientes.map(c => String(c.id || '')).filter(Boolean));
    const clientesPorNombre = new Map();
    let clientesActualizados = 0;

    clientes.forEach((cliente, index) => {
        const nombreKey = normalizar(cliente.nombre || cliente.clienteNombre || cliente.razonSocial);
        const telefonoKey = normalizar(cliente.telefono || cliente.celular || '');
        if (!cliente.id) {
            let nuevoId = `CLI-${hashTexto(`${nombreKey}|${telefonoKey}|${index}`)}`;
            let contador = 1;
            while (idsUsados.has(nuevoId)) {
                contador++;
                nuevoId = `CLI-${hashTexto(`${nombreKey}|${telefonoKey}|${index}|${contador}`)}`;
            }
            cliente.id = nuevoId;
            idsUsados.add(nuevoId);
            clientesActualizados++;
        }
        if (nombreKey && !clientesPorNombre.has(nombreKey)) clientesPorNombre.set(nombreKey, cliente.id);
    });

    const tablasRelacionadas = [
        'cuentasPorCobrar',
        'pagaresSistema',
        'pagares',
        'apartados',
        'salidasPendientesVenta',
        'documentosEntrega',
        'cotizaciones',
        'ventasRegistradas',
        'ventasPendientes',
        'abonosPendientes',
        'registroTickets',
        'historialDevoluciones',
        'garantiasProductos',
        'documentosCancelacion',
        'solicitudesClientesPendientes',
        'historialSolicitudesClientes'
    ];
    const cambiosPorTabla = {};

    tablasRelacionadas.forEach(tabla => {
        const lista = StorageService.get(tabla, []);
        if (!Array.isArray(lista)) return;
        respaldo[tabla] = JSON.parse(JSON.stringify(lista));
        let cambios = 0;

        lista.forEach(item => {
            if (!item || typeof item !== 'object') return;
            if (getId(item)) return;
            const idCliente = clientesPorNombre.get(normalizar(getNombre(item)));
            if (idCliente && setClienteId(item, idCliente)) cambios++;
        });

        if (cambios > 0) cambiosPorTabla[tabla] = cambios;
    });

    const totalRelacionados = Object.values(cambiosPorTabla).reduce((s, n) => s + n, 0);
    const resultado = { ok: true, dryRun, clientesActualizados, documentosRelacionadosActualizados: totalRelacionados, cambiosPorTabla };

    if (dryRun) {
        console.table(cambiosPorTabla);
        console.log('Simulacion repararIdsClientesAntiguos:', resultado);
        return resultado;
    }

    const backupKey = `_backup_reparar_ids_clientes_${Date.now()}`;
    await guardarLocal(backupKey, respaldo);
    await guardarLocal('clientes', clientes);
    for (const tabla of Object.keys(cambiosPorTabla)) await guardarLocal(tabla, StorageService.get(tabla, []));

    if (typeof recargarVariablesGlobales === 'function') await recargarVariablesGlobales();
    if (typeof renderClientes === 'function') renderClientes();
    if (typeof renderCuentasXCobrar === 'function') renderCuentasXCobrar();

    console.log(`Respaldo local previo guardado en ${backupKey}`);
    console.table(cambiosPorTabla);
    console.log('Reparacion de IDs completada:', resultado);
    alert(`IDs de clientes reparados.\n\nClientes actualizados: ${clientesActualizados}\nDocumentos relacionados: ${totalRelacionados}\n\nRespaldo local: ${backupKey}`);
    return { ...resultado, backupKey };
};

console.log("  - repararIdsClientesAntiguos(): Asignar IDs a clientes viejos y relacionarlos localmente");
