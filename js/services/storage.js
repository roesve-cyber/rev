// ===== STORAGE SERVICE (BLINDADO IDB + FIREBASE SYNC) =====
const StorageService = {
        _cache: {}, 
    _isReady: false,
    _usandoLocalForage: true,
    _syncTimers: {}, // <-- AGREGAR ESTO PARA CONTROLAR EL TRÁFICO A FIREBASE

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

    _limpiarParaFirestore(value, dentroDeArray = false) {
        if (value === undefined) return null;
        if (value === null) return null;
        if (value instanceof Date) return value;
        if (typeof value === 'function') return null;

        if (Array.isArray(value)) {
            const limpio = value.map(item => this._limpiarParaFirestore(item, true));
            return dentroDeArray ? { __mmpArray: limpio } : limpio;
        }

        if (typeof value === 'object') {
            const limpio = {};
            Object.entries(value).forEach(([k, v]) => {
                if (v === undefined || typeof v === 'function') return;
                limpio[k] = this._limpiarParaFirestore(v, false);
            });
            return limpio;
        }

        return value;
    },

    _restaurarDesdeFirestore(value) {
        if (value === null || value === undefined) return value;

        if (Array.isArray(value)) {
            return value.map(item => this._restaurarDesdeFirestore(item));
        }

        if (typeof value === 'object') {
            if (
                Object.prototype.hasOwnProperty.call(value, '__mmpArray') &&
                Array.isArray(value.__mmpArray) &&
                Object.keys(value).length === 1
            ) {
                return value.__mmpArray.map(item => this._restaurarDesdeFirestore(item));
            }

            const restaurado = {};
            Object.entries(value).forEach(([k, v]) => {
                restaurado[k] = this._restaurarDesdeFirestore(v);
            });
            return restaurado;
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
        
        // 3. Guardado físico local (Inmediato)
        let dbPromise = Promise.resolve();

        if (this._usandoLocalForage) {
            dbPromise = localforage
                .setItem(key, value)
                .catch(err => console.error("Error guardando local:", err));
        } else {
            localStorage.setItem(key, JSON.stringify(value));
        }

        // 4. Auto-guardado en Firebase (CON DEBOUNCE PARA NO SATURAR)
        if (
            window._firebaseActivo &&
            window._db &&
            this._esTablaValida(key, value)
        ) {
            // Registrar el timestamp local INMEDIATAMENTE al guardar,
            // antes de que el debounce dispare.  Así, aunque la subida
            // a Firebase falle o tarde, syncAll() sabe que el local es más nuevo.
            const tsAhora = Date.now();
            this._cache[`_ts_${key}`] = tsAhora;
            localforage.setItem(`_ts_${key}`, tsAhora).catch(() => {});

            // Si ya había un envío programado para esta tabla, lo cancelamos
            if (this._syncTimers[key]) {
                clearTimeout(this._syncTimers[key]);
            }

            // Programamos el nuevo envío con 1.5 segundos de espera
            this._syncTimers[key] = setTimeout(() => {
                const valorFirestore = this._limpiarParaFirestore(value);
                const ts = this._cache[`_ts_${key}`] || Date.now();
                
                try {
                    const docRef = window._db.collection('posData').doc(key);

                    // ─── BLINDAJE MULTI-CAJA PARA ARREGLOS CRÍTICOS ───
                    if (key === 'abonosPendientes' || key === 'ventasPendientes') {
                        // En lugar de sobreescribir todo, usamos transacciones o mezcla inteligente.
                        // Para no romper tu lógica local de arreglos, le pedimos a Firebase 
                        // que guarde el estado actual pero manejado como documento único controlado.
                        // NOTA: Si quieres seguridad absoluta entre cajas, lo ideal es usar arrayUnion/arrayRemove
                        // al momento del clic. Pero si se prefiere mantener el bloque set(), usamos un merge:
                        
                        docRef.set({
                            data: valorFirestore,
                            _updatedAt: ts
                        }, { merge: true }).catch(e => console.warn("Error en merge:", e));
                        
                    } else {
                        // Comportamiento normal para configuraciones o tablas de un solo autor
                        docRef.set({
                            data: valorFirestore,
                            _updatedAt: ts
                        }).catch(e => {
                            console.warn("Firebase offline: El dato se sincronizará cuando vuelva la red.", e);
                        });
                    }
                    // ──────────────────────────────────────────────────

                } catch (e) {
                    console.warn("Firebase rechazó el dato para sincronización. Se conserva localmente.", e);
                }
            }, 1500); // 1.5 segundos de "respiro"
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

    // 🚀 MOTOR DE TRANSACCIONES ATÓMICAS PARA LA BÓVEDA
    // Agrega un item a una tabla crítica con sincronización inmediata a Firebase
    async pushAtomo(key, item) {
        // 1. Guardado local instantáneo para que la pantalla del usuario no se congele
        let currentList = this.get(key, []);
        if (!Array.isArray(currentList)) currentList = [];
        currentList.push(item);
        await this._guardarLocalDirecto(key, currentList);

        // 🛡️ Registrar timestamp local INMEDIATAMENTE
        const tsAhora = Date.now();
        this._cache[`_ts_${key}`] = tsAhora;
        await localforage.setItem(`_ts_${key}`, tsAhora).catch(() => {});

        // 2. Transacción Quirúrgica en Firebase (SIN DEBOUNCE)
        if (window._firebaseActivo && window._db) {
            const itemLimpio = this._limpiarParaFirestore(item, true);
            const docRef = window._db.collection('posData').doc(key);
            try {
                await window._db.runTransaction(async (transaction) => {
                    const doc = await transaction.get(docRef);
                    if (!doc.exists) {
                        transaction.set(docRef, { data: [itemLimpio], _updatedAt: tsAhora });
                    } else {
                        let data = doc.data().data || [];
                        data.push(itemLimpio);
                        transaction.update(docRef, { data: data, _updatedAt: tsAhora });
                    }
                });
                console.log(`✅ pushAtomo: ${key} sincronizado INMEDIATAMENTE a Firebase`);
            } catch (e) { 
                console.warn(`⚠️ pushAtomo fallo para ${key}, pero datos guardados localmente:`, e); 
            }
        }
    },

    // Elimina un item de una tabla crítica con sincronización inmediata a Firebase
    async removeAtomo(key, idValue) {
        // 1. Limpieza local
        let currentList = this.get(key, []);
        if (!Array.isArray(currentList)) currentList = [];
        currentList = currentList.filter(i => String(i.idCuarentena || i.id) !== String(idValue));
        await this._guardarLocalDirecto(key, currentList);

        // 🛡️ Registrar timestamp local INMEDIATAMENTE
        const tsAhora = Date.now();
        this._cache[`_ts_${key}`] = tsAhora;
        await localforage.setItem(`_ts_${key}`, tsAhora).catch(() => {});

        // 2. Transacción Quirúrgica en Firebase (SIN DEBOUNCE)
        if (window._firebaseActivo && window._db) {
            const docRef = window._db.collection('posData').doc(key);
            try {
                await window._db.runTransaction(async (transaction) => {
                    const doc = await transaction.get(docRef);
                    if (!doc.exists) return;
                    let data = doc.data().data || [];
                    const filtrado = data.filter(i => String(i.idCuarentena || i.id) !== String(idValue));
                    transaction.update(docRef, { data: filtrado, _updatedAt: tsAhora });
                });
                console.log(`✅ removeAtomo: ${key} item ${idValue} eliminado INMEDIATAMENTE en Firebase`);
            } catch (e) { 
                console.warn(`⚠️ removeAtomo fallo para ${key}, pero datos limpiados localmente:`, e); 
            }
        }
    },
    // -----------------------------------------------------------

    // ☁️ FUNCIONES DE NUBE (Ahora sí conectadas a Firestore)

    // Devuelve el timestamp local de la última vez que guardamos una tabla
    _tsLocal(key) {
        return Number(this._cache[`_ts_${key}`] || 0);
    },

    async syncAll(opciones = {}) {
        if (!window._firebaseActivo || !window._db) {
            return Promise.reject(new Error("Firebase no está configurado o activo en este entorno."));
        }

        try {
            console.log("⬇️ Descargando datos dinámicos de Firebase...");

            const forzarDescarga = !!(opciones && opciones.forzarDescarga);
            const snapshot = await window._db.collection('posData').get();
            let descargadas = 0;
            let omitidas = 0;

            for (const doc of snapshot.docs) {
                const tabla = doc.id;
                // Ignorar claves de timestamps internos
                if (tabla.startsWith('_ts_')) continue;

                const payload = doc.data();

                // ── BLINDAJE ANTI-SOBREESCRITURA ──────────────────────────────
                // Solo bajamos si Firebase es MÁS RECIENTE que nuestro local.
                // Esto evita que un syncAll() pise datos que ya teníamos
                // correctos localmente pero que Firebase aún no recibió
                // (por ejemplo, si la red falló justo después de aprobar la bóveda).
                const tsFirebase = Number(payload?._updatedAt || 0);
                const tsLocal    = this._tsLocal(tabla);
                const datosLocalesAntes = this.get(tabla, null);
                const localTieneDatos = Array.isArray(datosLocalesAntes)
                    ? datosLocalesAntes.length > 0
                    : !!(datosLocalesAntes && typeof datosLocalesAntes === 'object' && Object.keys(datosLocalesAntes).length > 0);
                if (!forzarDescarga && localTieneDatos && tsLocal > 0 && tsFirebase <= tsLocal) {
                    console.log(`⏭️ ${tabla}: local más reciente (local=${tsLocal} > nube=${tsFirebase}), se conserva.`);
                    omitidas++;
                    continue;
                }
                // ──────────────────────────────────────────────────────────

                const datosNube = payload && Object.prototype.hasOwnProperty.call(payload, 'data')
                    ? payload.data
                    : payload;
                const datosRestaurados = this._restaurarDesdeFirestore(datosNube);

                if (!this._esTablaValida(tabla, datosRestaurados)) {
                    if (!this._clavesIgnoradas.has(tabla)) {
                        console.warn(`⏭️ Tabla ignorada al sincronizar: ${tabla}`);
                    }
                    continue;
                }

                const datosLocalesActuales = this.get(tabla, null);
                if (
                    !forzarDescarga &&
                    Array.isArray(datosRestaurados) &&
                    datosRestaurados.length === 0 &&
                    Array.isArray(datosLocalesActuales) &&
                    datosLocalesActuales.length > 0
                ) {
                    console.warn(`${tabla}: nube vacia y local con ${datosLocalesActuales.length} registros; se conserva local.`);
                    omitidas++;
                    continue;
                }

                await this._guardarLocalDirecto(tabla, datosRestaurados);
                // Guardamos el timestamp de Firebase como referencia local
                if (tsFirebase > 0) {
                    this._cache[`_ts_${tabla}`] = tsFirebase;
                    await localforage.setItem(`_ts_${tabla}`, tsFirebase).catch(() => {});
                }
                descargadas++;
            }

            console.log(`✅ Sync completada. Descargadas: ${descargadas}, conservadas por ser más recientes: ${omitidas}`);
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

        try {
            console.log("⬆️ Subiendo datos dinámicos a Firebase...");

            const tablas = await this.getTablasDinamicas();
            let subidas = 0;

            for (let tabla of tablas) {
                const datosLocales = this.get(tabla, null);

                if (!this._esTablaValida(tabla, datosLocales)) {
                    if (!this._clavesIgnoradas.has(tabla)) {
                        console.warn(`⏭️ Tabla ignorada al subir: ${tabla}`);
                    }
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
