// ============================================================
// MUEBLERÍA MI PUEBLITO — script.js (VERSIÓN 2.0 REFACTORIZADA)
// ============================================================

// ===== STORAGESERVICE COMPLETO Y FUNCIONAL =====

// Claves del sistema reconocidas para sincronización y respaldo
const CLAVES_SISTEMA = [
    // Catálogo y configuración
    'productos', 'clientes', 'proveedores', 'categoriasData', 'tarjetasConfig',
    'usuariosConfig', 'categoriasGasto', 'descuentosActivos', 'programaPuntos',
    // Ventas y cobros
    'ventasRegistradas', 'registroTickets', 'carrito', 'cuentasPorCobrar',
    'pagaresSistema', 'cotizaciones', 'apartados',
    // Compras y proveedores
    'compras', 'cuentasPorPagar', 'ordenesCompra', 'recepciones',
    // Inventario y logística
    'movimientosInventario', 'salidasPendientesVenta', 'requisicionesCompra',
    'historialDevoluciones', 'garantiasProductos',
    // Caja y bancos
    'movimientosCaja', 'cuentasEfectivo', 'cuentas-bancarias', 'cuentasMSI', 'deudasMSI',
    // Otros
    'gastosOperativos', 'vendedores', 'comisionesRegistradas',
    'puntosPorCliente', 'historialCostos'
];

const StorageService = {
    /**
     * Obtiene un valor del localStorage
     * Inicia sincronización en background desde Firestore si está disponible.
     * @param {string} clave - Clave a obtener
     * @param {*} defaultValue - Valor por defecto si no existe
     * @returns {*} - Valor guardado o default
     */
    get(clave, defaultValue = []) {
        let valorLocal;
        try {
            const raw = localStorage.getItem(clave);
            if (!raw) {
                valorLocal = defaultValue;
            } else {
                valorLocal = JSON.parse(raw) || defaultValue;
            }
        } catch (e) {
            console.error(`❌ Error leyendo '${clave}':`, e.message);
            valorLocal = defaultValue;
        }
        // MODO OFFLINE: NO sincronizar con Firestore
        return valorLocal;
    },

    set(clave, valor) {
        let ok = false;
        try {
            localStorage.setItem(clave, JSON.stringify(valor));
            ok = true;
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                console.error(`❌ Error: localStorage lleno para '${clave}'`);
            } else {
                console.error(`❌ Error guardando '${clave}':`, e.message);
            }
            return false;
        }

        // 🟢 VALIDACIÓN DE SEGURIDAD: ¿Estamos en la web real o en pruebas locales?
        const esRutaLocal = window.location.hostname === "localhost" || 
                           window.location.hostname === "127.0.0.1" || 
                           window.location.protocol === "file:";

        // Escritura en Firestore en background (Solo si NO es local 🟢)
        if (ok && window._firebaseActivo && window._db && !esRutaLocal) {
            const ts = Date.now();
            let docData;
            if (Array.isArray(valor)) {
                docData = { data: valor, _updatedAt: ts };
            } else if (valor && typeof valor === 'object') {
                docData = { ...valor, _updatedAt: ts };
            } else {
                docData = { data: valor, _updatedAt: ts };
            }
            window._db.collection('posData').doc(clave).set(docData)
                .then(() => console.log(`☁️ Sincronizado en vivo: ${clave}`)) // 🟢 Para que sepas que funcionó
                .catch(e => console.warn(`⚠️ Error sincronizando '${clave}' con Firebase:`, e.message));
        }

        return ok;
    },

    /**
     * Elimina un valor del localStorage
     * @param {string} clave - Clave a eliminar
     * @returns {boolean} - True si se eliminó exitosamente
     */
    remove(clave) {
        try {
            localStorage.removeItem(clave);
            return true;
        } catch (e) {
            console.error(`❌ Error eliminando '${clave}':`, e.message);
            return false;
        }
    },

    /**
     * Calcula el uso total de localStorage en bytes
     * @returns {number} - Uso en bytes
     */
    getUsageBytes() {
        let total = 0;
        try {
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    const value = localStorage.getItem(key);
                    // Usar Blob para cálculo preciso de UTF-8
                    total += new Blob([key + value]).size;
                }
            }
        } catch (e) {
            console.warn("⚠️ Error calculando uso de localStorage:", e.message);
        }
        return total;
    },

    /**
     * Calcula el uso total de localStorage en KB
     * @returns {string} - Uso en KB con 2 decimales
     */
    getUsageKB() {
        const bytes = this.getUsageBytes();
        return (bytes / 1024).toFixed(2);
    },

    /**
     * Calcula el uso total de localStorage en MB
     * @returns {string} - Uso en MB con 4 decimales
     */
    getUsageMB() {
        const bytes = this.getUsageBytes();
        return (bytes / (1024 * 1024)).toFixed(4);
    },

    /**
     * Obtiene información completa del uso de localStorage
     * @returns {Object} - Objeto con información de uso
     */
    getUsageInfo() {
        const bytes = this.getUsageBytes();
        const kb = bytes / 1024;
        const mb = kb / 1024;
        const limiteAproximado = 5 * 1024; // 5MB típico en navegadores
        const porcentaje = ((bytes / (limiteAproximado * 1024)) * 100).toFixed(1);

        return {
            bytes: bytes,
            kb: kb.toFixed(2),
            mb: mb.toFixed(4),
            porcentaje: porcentaje,
            limite: "5 MB (aproximado)",
            mensaje: `${kb.toFixed(2)} KB de aproximadamente ${limiteAproximado} MB (${porcentaje}%)`
        };
    },

    /**
     * Obtiene el número de items guardados
     * @returns {number} - Cantidad de items
     */
    getItemCount() {
        return Object.keys(localStorage).length;
    },

    /**
     * Lista todas las claves guardadas
     * @returns {Array} - Array de claves
     */
    getAllKeys() {
        return Object.keys(localStorage);
    },

    /**
     * Limpia todo localStorage
     * @returns {boolean} - True si se limpió exitosamente
     */
    clearAll() {
        try {
            localStorage.clear();
            console.log("✅ localStorage limpiado completamente");
            return true;
        } catch (e) {
            console.error("❌ Error limpiando localStorage:", e.message);
            return false;
        }
    },

    /**
     * Obtiene un resumen de todos los datos guardados
     * @returns {Object} - Resumen con tamaños de cada clave
     */
    getSummary() {
        const summary = {};
        let totalBytes = 0;

        try {
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    const value = localStorage.getItem(key);
                    const size = new Blob([key + value]).size;
                    summary[key] = {
                        bytes: size,
                        kb: (size / 1024).toFixed(2)
                    };
                    totalBytes += size;
                }
            }
        } catch (e) {
            console.warn("⚠️ Error obteniendo resumen:", e.message);
        }

        return {
            items: summary,
            totalBytes: totalBytes,
            totalKB: (totalBytes / 1024).toFixed(2),
            count: Object.keys(summary).length
        };
    },

    /**
     * Descarga todos los documentos de posData en Firestore y actualiza localStorage
     * con los valores más recientes (por _updatedAt).
     * @returns {Promise<void>}
     */
    syncAll() {
        if (!window._firebaseActivo || !window._db) {
            return Promise.resolve();
        }
        return window._db.collection('posData').get().then(snapshot => {
            snapshot.forEach(doc => {
                const clave = doc.id;
                const remoto = doc.data();
                if (!remoto) return;
                const tsRemoto = remoto._updatedAt || 0;
                try {
                    const rawLocal = localStorage.getItem(clave);
                    let tsLocal = 0;
                    if (rawLocal) {
                        const parsed = JSON.parse(rawLocal);
                        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed._updatedAt) {
                            tsLocal = parsed._updatedAt;
                        }
                    }
                    if (tsRemoto >= tsLocal) {
                        const { _updatedAt, ...datos } = remoto;
                        const valorFinal = datos.data !== undefined ? datos.data : datos;
                        localStorage.setItem(clave, JSON.stringify(valorFinal));
                    }
                } catch (_) { /* ignorar errores de claves individuales */ }
            });
            console.log('✅ syncAll: datos sincronizados desde Firebase');
        });
    },

    /**
     * Sube todas las claves conocidas del sistema desde localStorage a Firestore.
     * Útil para la primera migración de datos.
     * @returns {Promise<void>}
     */
    uploadAll() {
        if (!window._firebaseActivo || !window._db) {
            return Promise.resolve();
        }
        const batch = window._db.batch();
        const ts = Date.now();
        CLAVES_SISTEMA.forEach(clave => {
            const raw = localStorage.getItem(clave);
            if (!raw) return;
            try {
                const valor = JSON.parse(raw);
                let docData;
                if (Array.isArray(valor)) {
                    docData = { data: valor, _updatedAt: ts };
                } else if (valor && typeof valor === 'object') {
                    docData = { ...valor, _updatedAt: ts };
                } else {
                    docData = { data: valor, _updatedAt: ts };
                }
                const ref = window._db.collection('posData').doc(clave);
                batch.set(ref, docData);
            } catch (_) { /* ignorar claves con JSON inválido */ }
        });
        return batch.commit().then(() => {
            console.log('✅ uploadAll: todos los datos subidos a Firebase');
        });
    },
    // =========================================================
    // NUEVA FUNCIÓN: ESCUCHA EN TIEMPO REAL (AL MOMENTO)
    // =========================================================
    startRealtimeSync() {
        // Si estamos en local (Live Server), no hacemos nada para no gastar lecturas
        const esRutaLocal = window.location.hostname === "localhost" || 
                            window.location.hostname === "127.0.0.1" || 
                            window.location.protocol === "file:";

        if (!window._firebaseActivo || !window._db || esRutaLocal) {
            console.log("⏸️ Escucha en tiempo real desactivada (entorno local de pruebas)");
            return;
        }

        console.log("📡 Iniciando escucha en tiempo real con Firebase...");

        // onSnapshot mantiene una conexión viva con la nube
        window._db.collection('posData').onSnapshot((snapshot) => {
            let huboCambios = false;

            snapshot.docChanges().forEach((change) => {
                // Solo nos importan los datos que se modificaron desde otra computadora
                if (change.type === "added" || change.type === "modified") {
                    const clave = change.doc.id;
                    const remoto = change.doc.data();
                    
                    if (!remoto) return;
                    
                    const tsRemoto = remoto._updatedAt || 0;
                    
                    try {
                        const rawLocal = localStorage.getItem(clave);
                        let tsLocal = 0;
                        
                        if (rawLocal) {
                            const parsed = JSON.parse(rawLocal);
                            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed._updatedAt) {
                                tsLocal = parsed._updatedAt;
                            }
                        }

                        // Comparamos el reloj: Si la nube tiene datos más nuevos, actualizamos la PC
                        if (tsRemoto > tsLocal) {
                            const { _updatedAt, ...datos } = remoto;
                            const valorFinal = datos.data !== undefined ? datos.data : datos;
                            
                            // Guardamos directo en localStorage para no disparar un bucle infinito
                            localStorage.setItem(clave, JSON.stringify(valorFinal));
                            
                            // Actualizamos las variables globales (como window.productos)
                            if (clave === 'productos') window.productos = valorFinal;
                            
                            huboCambios = true;
                            console.log(`🔄 Dato actualizado al momento: ${clave}`);
                        }
                    } catch (e) {
                        console.warn(`⚠️ Error procesando cambio en tiempo real para ${clave}`);
                    }
                }
            });

            // Si la base de datos cambió, le decimos a la interfaz que se dibuje de nuevo
            if (huboCambios) {
                // Disparamos un evento para que cualquier parte del código sepa que hubo cambios
                window.dispatchEvent(new Event('datosSincronizados'));
                
                // Si tienes la función de pintar inventario abierta, se recarga sola
                if (typeof renderInventario === 'function') {
                    renderInventario();
                }
            }
        }, (error) => {
            console.error("❌ Error en la escucha en tiempo real:", error);
        });
    }
};
