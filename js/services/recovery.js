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

// 🔄 Función para forzar recarga de variables globales
window.recargarVariablesGlobales = async function() {
    console.log("🔄 Recargando variables globales desde StorageService...");
    
    const tablas = [
        'productos', 'clientes', 'proveedores', 'categoriasData',
        'cuentasPorCobrar', 'cuentasPorPagar', 'pagaresSistema',
        'movimientosCaja', 'movimientosInventario', 'compras',
        'carrito', 'tarjetasConfig', 'recepciones', 'cuentasMSI', // <--- ¡CORREGIDO!
        'requisicionesCompra', 'salidasPendientesVenta'
    ];
    
    let recargadas = 0;
    for (let tabla of tablas) {
        const datos = StorageService.get(tabla, []);
        if (datos) {
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
    
    return { recargadas };
};

console.log("🔧 Herramientas de recuperación cargadas.");
console.log("📋 Comandos disponibles:");
console.log("  - verificarDatos(): Verificar estado actual de los datos");
console.log("  - diagnosticarAlmacenamiento(): Ver todas las claves en storage");
console.log("  - recuperarDatosEmergencia(): Intentar recuperar datos perdidos");
console.log("  - recargarVariablesGlobales(): Forzar recarga de variables desde storage");
