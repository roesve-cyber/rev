// ===== STORAGESERVICE COMPLETO Y FUNCIONAL =====

const StorageService = {
    /**
     * Obtiene un valor del localStorage
     * @param {string} clave - Clave a obtener
     * @param {*} defaultValue - Valor por defecto si no existe
     * @returns {*} - Valor guardado o default
     */
    get(clave, defaultValue = []) {
        try {
            const valor = localStorage.getItem(clave);
            if (!valor) return defaultValue;
            return JSON.parse(valor) || defaultValue;
        } catch (e) {
            console.error(`❌ Error leyendo '${clave}':`, e.message);
            return defaultValue;
        }
    },

    /**
     * Guarda un valor en localStorage
     * @param {string} clave - Clave a guardar
     * @param {*} valor - Valor a guardar (se convierte a JSON)
     * @returns {boolean} - True si se guardó exitosamente
     */
    set(clave, valor) {
        try {
            localStorage.setItem(clave, JSON.stringify(valor));
            return true;
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                console.error(`❌ Error: localStorage lleno para '${clave}'`);
            } else {
                console.error(`❌ Error guardando '${clave}':`, e.message);
            }
            return false;
        }
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
    }
};

window.StorageService = StorageService;
