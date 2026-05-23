// ===== STORAGE SERVICE (BLINDADO IDB + FIREBASE SYNC) =====
const StorageService = {
        _cache: {}, 
    _isReady: false,
    _usandoLocalForage: true,

    // Claves que NO deben considerarse tablas de base de datos
    _clavesIgnoradas: new Set([
        '_migradoIDB',
        '_prueba',
        'carrito'
    ]),

    // Decide si una clave puede tratarse como tabla real del sistema
    _esTablaValida(key, value) {
        if (!key || typeof key !== 'string') return false;

        // No respaldar claves internas
        if (key.startsWith('_')) return false;

        // No respaldar temporales
        if (this._clavesIgnoradas.has(key)) return false;

        // No respaldar claves técnicas externas
        if (key.startsWith('firebase:')) return false;
        if (key.startsWith('msal.')) return false;
        if (key.includes('msal')) return false;
        if (key.includes('firebase')) return false;
        if (key.includes('Auth')) return false;
        if (key.toLowerCase().includes('token')) return false;

        // No respaldar valores inválidos
        if (value === undefined) return false;
        if (typeof value === 'function') return false;

        return true;
    },

    _limpiarParaFirestore(value) {
        if (value === undefined) return null;
        if (value === null) return null;
        if (value instanceof Date) return value;
        if (typeof value === 'function') return null;

        if (Array.isArray(value)) {
            return value.map(item => this._limpiarParaFirestore(item));
        }

        if (typeof value === 'object') {
            const limpio = {};
            Object.entries(value).forEach(([k, v]) => {
                if (v === undefined || typeof v === 'function') return;
                limpio[k] = this._limpiarParaFirestore(v);
            });
            return limpio;
        }

        return value;
    },

    // Obtiene dinámicamente todas las tablas reales guardadas
    async getTablasDinamicas() {
        const tablas = new Set();

        // 1. Leer desde caché RAM
        Object.keys(this._cache || {}).forEach(key => {
            const value = this._cache[key];
            if (this._esTablaValida(key, value)) {
                tablas.add(key);
            }
        });

        // 2. Mantener compatibilidad con TABLAS_SISTEMA si todavía existe
        if (Array.isArray(window.TABLAS_SISTEMA)) {
            window.TABLAS_SISTEMA.forEach(key => {
                const value = this.get(key, null);
                if (this._esTablaValida(key, value)) {
                    tablas.add(key);
                }
            });
        }

        // 3. Leer directamente desde IndexedDB/localforage
        if (this._usandoLocalForage && typeof localforage !== 'undefined') {
            try {
                const keys = await localforage.keys();

                for (const key of keys) {
                    const value = this._cache[key] !== undefined
                        ? this._cache[key]
                        : await localforage.getItem(key);

                    if (this._esTablaValida(key, value)) {
                        tablas.add(key);
                    }
                }
            } catch (e) {
                console.warn("⚠️ No se pudieron leer claves dinámicas desde IndexedDB:", e);
            }
        } else {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                let value = null;

                try {
                    value = JSON.parse(localStorage.getItem(key));
                } catch(e) {
                    value = localStorage.getItem(key);
                }

                if (this._esTablaValida(key, value)) {
                    tablas.add(key);
                }
            }
        }

        return Array.from(tablas).sort();
    },

    // Actualiza cualquier variable global que tenga el mismo nombre de la tabla
    _actualizarVariableGlobal(key, value) {
        window[key] = value;
    },

    // Guarda localmente sin volver a disparar sincronización Firebase
    async _guardarLocalDirecto(key, value) {
        this._cache[key] = value;
        this._actualizarVariableGlobal(key, value);

        if (this._usandoLocalForage) {
            await localforage.setItem(key, value);
        } else {
            localStorage.setItem(key, JSON.stringify(value));
        }
    },

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

        // 2. Actualizar variable global dinámica
        this._actualizarVariableGlobal(key, value);
        
        // 3. Guardado físico local
        let dbPromise = Promise.resolve();

        if (this._usandoLocalForage) {
            dbPromise = localforage
                .setItem(key, value)
                .catch(err => console.error("Error guardando local:", err));
        } else {
            localStorage.setItem(key, JSON.stringify(value));
        }

        // 4. Auto-guardado en Firebase solo si es tabla válida
        if (
            window._firebaseActivo &&
            window._db &&
            this._esTablaValida(key, value)
        ) {
            const valorFirestore = this._limpiarParaFirestore(value);
            window._db.collection('posData').doc(key).set({
                data: valorFirestore,
                _updatedAt: Date.now()
            }).catch(e => {
                console.warn("Firebase offline: El dato se sincronizará cuando vuelva la red.");
            });
        }

        return dbPromise;
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

        try {
            console.log("⬇️ Descargando datos dinámicos de Firebase...");

            const snapshot = await window._db.collection('posData').get();
            let descargadas = 0;

            for (const doc of snapshot.docs) {
                const tabla = doc.id;
                const payload = doc.data();

                const datosNube = payload && Object.prototype.hasOwnProperty.call(payload, 'data')
                    ? payload.data
                    : payload;

                if (!this._esTablaValida(tabla, datosNube)) {
                    console.warn(`⏭️ Tabla ignorada al sincronizar: ${tabla}`);
                    continue;
                }

                await this._guardarLocalDirecto(tabla, datosNube);
                descargadas++;
            }

            console.log(`✅ Sincronización dinámica completada. Tablas descargadas: ${descargadas}`);
            return true;

        } catch (error) {
            console.error("❌ Error al descargar de Firebase:", error);
            throw error;
        }
    },

    // Dentro de StorageService en js/services/storage.js

    async uploadAll() {
        if (!window._firebaseActivo || !window._db) {
            return Promise.reject(new Error("Firebase no está configurado o activo."));
        }

        try {
            console.log("⬆️ Subiendo datos dinámicos a Firebase...");

            const tablas = await this.getTablasDinamicas();
            let subidas = 0;

            for (let tabla of tablas) {
                const datosLocales = this.get(tabla, null);

                if (!this._esTablaValida(tabla, datosLocales)) {
                    console.warn(`⏭️ Tabla ignorada al subir: ${tabla}`);
                    continue;
                }

                const datosFirestore = this._limpiarParaFirestore(datosLocales);

                await window._db.collection('posData').doc(tabla).set({
                    data: datosFirestore,
                    _updatedAt: Date.now()
                });

                subidas++;
            }

            console.log(`✅ Subida dinámica completada. Tablas subidas: ${subidas}`);
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
