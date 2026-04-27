// ============================================================
// MUEBLERÍA MI PUEBLITO — script.js (VERSIÓN 2.0 REFACTORIZADA)
// ============================================================

// ===== STORAGESERVICE COMPLETO Y FUNCIONAL =====

// Claves del sistema reconocidas para sincronización y respaldo
const CLAVES_SISTEMA = [
    'productos', 'clientes', 'proveedores', 'ventasRegistradas', 'cuentasPorCobrar',
    'pagaresSistema', 'compras', 'cuentasPorPagar', 'movimientosCaja', 'tarjetasConfig',
    'gastosOperativos', 'cotizaciones', 'vendedores', 'comisionesRegistradas',
    'puntosPorCliente', 'programaPuntos', 'descuentosActivos', 'usuariosConfig',
    'categoriasGasto', 'registroTickets', 'deudasMSI', 'recepciones',
    'categoriasData'
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

    /**
     * Guarda un valor en localStorage y en Firestore si está disponible (write-through).
     * @param {string} clave - Clave a guardar
     * @param {*} valor - Valor a guardar (se convierte a JSON)
     * @returns {boolean} - True si se guardó en localStorage exitosamente
     */
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

        // Escritura en Firestore en background
        if (ok && window._firebaseActivo && window._db) {
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
    }
};
