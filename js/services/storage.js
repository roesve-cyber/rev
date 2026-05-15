// ===== STORAGE SERVICE (BLINDADO IDB + FIREBASE SYNC) =====
const StorageService = {
    _cache: {}, 
    _isReady: false,
    _usandoLocalForage: true, 

    async init() {
        try {
            localforage.config({ name: 'MiPueblitoERP', storeName: 'datos_muebleria' });
            
            await localforage.setItem('_prueba', '1');
            await localforage.removeItem('_prueba');

            const migrado = localStorage.getItem('_migradoIDB');
            if (!migrado) {
                console.log("📦 Migrando datos a base segura...");
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key !== '_migradoIDB') {
                        try { await localforage.setItem(key, JSON.parse(localStorage.getItem(key))); } catch(e) {}
                    }
                }
                localStorage.setItem('_migradoIDB', 'true');
            }

            const keys = await localforage.keys();
            for (let key of keys) {
                this._cache[key] = await localforage.getItem(key);
            }
            console.log("🚀 Sistema blindado: Base de datos local cargada.");

            // ==========================================
            // BLINDAJE CONTRA CARRERAS DE VELOCIDAD
            // ==========================================
            
            // 1. Unificamos la tabla de clientes de la migración
            if (this._cache["clientesSistema"] && (!this._cache["clientes"] || this._cache["clientes"].length === 0)) {
                this._cache["clientes"] = this._cache["clientesSistema"];
                localforage.setItem("clientes", this._cache["clientes"]);
            }

            // 2. Inyectamos los datos a la memoria global DESPUÉS de abrir el baúl
            window.clientes = this._cache["clientes"] || [];
            window.cuentasPorCobrar = this._cache["cuentasPorCobrar"] || [];
            window.pagaresSistema = this._cache["pagaresSistema"] || [];
            window.productos = this._cache["productos"] || [];
            window.categoriasData = this._cache["categoriasData"] || [];
            window.tarjetasConfig = this._cache["tarjetasConfig"] || [];
            window.movimientosCaja = this._cache["movimientosCaja"] || [];
            window.cuentasMSI = this._cache["cuentasMSI"] || [];
            window.apartados = this._cache["apartados"] || [];

            // 3. Forzamos un redibujado automático para que las tablas no queden vacías
            setTimeout(() => {
                if (typeof renderCuentasXCobrar === 'function') renderCuentasXCobrar();
                if (typeof renderClientes === 'function') renderClientes();
            }, 300);
            // ==========================================

        } catch (error) {
            console.warn("⚠️ Navegador bloqueó IndexedDB. Usando localStorage clásico.");
            this._usandoLocalForage = false; 
            
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                try {
                    this._cache[key] = JSON.parse(localStorage.getItem(key));
                } catch(e) {}
            }
        }

        // Asignar variables globales
        window.productos = this.get("productos", []);
        window.categoriasData = this.get("categoriasData", []);
        window.carrito = this.get("carrito", []);
        window.movimientosInventario = this.get("movimientosInventario", []);
        
        this._isReady = true;
        return true;
    },

    get(key, defaultValue = null) {
        if (this._cache[key] !== undefined && this._cache[key] !== null) {
            return this._cache[key];
        }
        return defaultValue;
    },

    set(key, value) {
        // 1. Guardar en RAM al instante
        this._cache[key] = value;
        
        // 2. Actualizar variables globales
        if (key === 'productos') window.productos = value;
        if (key === 'carrito') window.carrito = value;
        if (key === 'categoriasData') window.categoriasData = value;
        
        // 3. Guardado físico local (AHORA RETORNA LA PROMESA)
        let dbPromise = Promise.resolve();
        if (this._usandoLocalForage) {
            dbPromise = localforage.setItem(key, value).catch(err => console.error("Error guardando local:", err));
        } else {
            localStorage.setItem(key, JSON.stringify(value));
        }

        // ☁️ 4. AUTO-GUARDADO EN FIREBASE
        if (window._firebaseActivo && window._db) {
            window._db.collection('posData').doc(key).set({ data: value })
                .catch(e => console.warn("Firebase offline: El dato se sincronizará cuando vuelva la red."));
        }

        return dbPromise; // <-- Clave para poder usar await
    },

    remove(key) {
        delete this._cache[key];
        if (this._usandoLocalForage) {
            // El .catch evita que un rechazo de IndexedDB detenga la importación
            return localforage.removeItem(key).catch(e => console.warn("Aviso al borrar:", e)); 
        } else {
            localStorage.removeItem(key);
            return Promise.resolve();
        }
    },

    // ☁️ FUNCIONES DE NUBE (Ahora sí conectadas a Firestore)
    async syncAll() {
        if (!window._firebaseActivo || !window._db) {
            return Promise.reject(new Error("Firebase no está configurado o activo en este entorno."));
        }
        
        // Usa la lista completa declarada en onedrive-backup.js (fuente única de verdad).
        // Si aún no está disponible (carga muy temprana), usa la lista de respaldo mínima.
        const tablas = window.TABLAS_SISTEMA || [
            "productos", "clientes", "categoriasData", "tarjetasConfig",
            "cuentasPorCobrar", "pagaresSistema", "proveedores",
            "movimientosInventario", "recepciones", "compras",
            "cuentasPorPagar", "deudasMSI", "movimientosCaja", "ubicacionesConfig"
        ];

        try {
            console.log("⬇️ Descargando datos de la nube...");
            for (let tabla of tablas) {
                const doc = await window._db.collection('posData').doc(tabla).get();
                if (doc.exists) {
                    const datosNube = doc.data().data || [];
                    
                    // Actualizar memoria RAM y Locales usando nuestra propia función set (evitando enviar de regreso a Firebase innecesariamente)
                    this._cache[tabla] = datosNube;
                    if (tabla === 'productos') window.productos = datosNube;
                    if (tabla === 'categoriasData') window.categoriasData = datosNube;
                    if (tabla === 'clientes') window.clientes = datosNube;
                    
                    if (this._usandoLocalForage) await localforage.setItem(tabla, datosNube);
                    else localStorage.setItem(tabla, JSON.stringify(datosNube));
                }
            }
            return true;
        } catch (error) {
            console.error("❌ Error al descargar de Firebase:", error);
            throw error;
        }
    },

    async uploadAll() {
        if (!window._firebaseActivo || !window._db) {
            return Promise.reject(new Error("Firebase no está configurado o activo."));
        }
        
        const tablas = window.TABLAS_SISTEMA || [
            "productos", "clientes", "categoriasData", "tarjetasConfig",
            "cuentasPorCobrar", "pagaresSistema", "proveedores",
            "movimientosInventario", "recepciones", "compras",
            "cuentasPorPagar", "deudasMSI", "movimientosCaja", "ubicacionesConfig"
        ];

        try {
            console.log("⬆️ Subiendo datos a la nube...");
            for (let tabla of tablas) {
                const datosLocales = this.get(tabla, []);
                await window._db.collection('posData').doc(tabla).set({ data: datosLocales });
            }
            return true;
        } catch (error) {
            console.error("❌ Error al subir a Firebase:", error);
            throw error;
        }
    },

    startRealtimeSync() {
        if (window._firebaseActivo && window._db) {
            console.log("📡 Módulo de Firebase enlazado correctamente.");
        }
    }
};

window.StorageService = StorageService;
