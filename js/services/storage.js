// ===== STORAGE SERVICE (BLINDADO IDB + FIREBASE SYNC) =====
window.productoEstaActivo = function(producto) {
    if (!producto) return false;
    return producto.activo !== false && producto.Activo !== 0 && producto.Activo !== false;
};

window.filtrarProductosActivos = function(lista) {
    return (Array.isArray(lista) ? lista : []).filter(window.productoEstaActivo);
};

const StorageService = {
        _cache: {}, 
    _isReady: false,
    _usandoLocalForage: true,
    _syncStatusUnsubscribe: null,
    _syncRemotoEnCurso: null,
    _syncRemotoTimer: null,
    _syncTimers: {}, // <-- AGREGAR ESTO PARA CONTROLAR EL TRÁFICO A FIREBASE

    // Claves que NO deben considerarse tablas de base de datos
    _clavesIgnoradas: new Set([
        '_migradoIDB',
        '_prueba',
        'carrito'
    ]),

    _tablasTipoLista: new Set([
        'abonosPendientes',
        'anticiposConsignacion',
        'apartados',
        'bitacoraAuditoria',
        'categoriasData',
        'categoriasGasto',
        'clientes',
        'clientesSistema',
        'comisionesRegistradas',
        'compras',
        'configuracionPos',
        'consignacionesActivas',
        'cortesCaja',
        'cotizaciones',
        'cuentas-bancarias',
        'cuentasEfectivo',
        'cuentasMSI',
        'cuentasPorCobrar',
        'cuentasPorPagar',
        'deudasMSI',
        'documentosEntrega',
        'gastos',
        'gastosOperativos',
        'historialCancelaciones',
        'historialCostos',
        'historialSolicitudesClientes',
        'movimientosCaja',
        'movimientosInventario',
        'notificacionesAutorizacion',
        'ordenesCompra',
        'pagaresSistema',
        'productos',
        'proveedores',
        'puntosPorCliente',
        'recepciones',
        'registroTickets',
        'requisicionesCompra',
        'salidasPendientesVenta',
        'solicitudesClientesPendientes',
        'tarjetasConfig',
        'tomasInventario',
        'ubicacionesConfig',
        'usuariosConfig',
        'vendedores',
        'ventasPendientes',
        'ventasRegistradas'
    ]),

    _tablasCriticasConDatos: new Set([
        'productos',
        'clientes',
        'cuentasPorCobrar',
        'pagaresSistema',
        'ventasRegistradas',
        'movimientosCaja'
    ]),

    // Tablas que, por su tamaño y crecimiento continuo, se sincronizan como UN DOCUMENTO POR
    // REGISTRO en Firestore (posData/{tabla}/registros/{clave}) en vez de un solo documento
    // gigante con todo el arreglo. Esto elimina el límite de 1 MiB por documento como problema,
    // porque cada registro individual (un pagaré, un corte) pesa un puñado de KB como mucho.
    _tablasRegistroIndividual: {
        pagaresSistema: 'id',
        cortesCaja: 'folio',
        movimientosCaja: 'id',
        ventasRegistradas: 'folio',
        cuentasPorCobrar: 'folio',
        bitacoraAuditoria: 'id',
        compras: 'id',
        movimientosInventario: 'id'
    },

    _claveRegistro(tabla, item) {
        const campo = this._tablasRegistroIndividual[tabla];
        if (!campo || !item || typeof item !== 'object') return null;
        const valor = item[campo];
        return (valor === undefined || valor === null || valor === '') ? null : String(valor);
    },

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

    _objetoConIndicesNumericos(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

        const keys = Object.keys(value).filter(key => !key.startsWith('_'));
        if (!keys.length || !keys.every(key => /^\d+$/.test(key))) return null;

        return keys
            .sort((a, b) => Number(a) - Number(b))
            .map(key => this._restaurarDesdeFirestore(value[key]));
    },

    _objetoMapaALista(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

        const keys = Object.keys(value).filter(key => !key.startsWith('_'));
        if (!keys.length) return null;

        const values = keys.map(key => value[key]);
        if (!values.some(item => item && typeof item === 'object')) return null;

        return values.map(item => this._restaurarDesdeFirestore(item));
    },

    _forzarListaFirestore(value, profundidad = 0) {
        if (value === null || value === undefined || profundidad > 6) return null;

        if (Array.isArray(value)) {
            return value.map(item => this._restaurarDesdeFirestore(item));
        }

        if (!value || typeof value !== 'object') return null;

        if (Array.isArray(value.__mmpArray)) {
            return value.__mmpArray.map(item => this._restaurarDesdeFirestore(item));
        }

        let listaVacia = null;
        const camposContenedor = ['data', 'datos', 'items', 'registros', 'records', 'rows', 'lista', 'value', 'valores', 'values'];
        for (const campo of camposContenedor) {
            if (Object.prototype.hasOwnProperty.call(value, campo)) {
                const lista = this._forzarListaFirestore(value[campo], profundidad + 1);
                if (Array.isArray(lista) && lista.length > 0) return lista;
                if (Array.isArray(lista) && !listaVacia) listaVacia = lista;
            }
        }

        const listaNumerica = this._objetoConIndicesNumericos(value);
        if (Array.isArray(listaNumerica) && listaNumerica.length > 0) return listaNumerica;
        if (Array.isArray(listaNumerica) && !listaVacia) listaVacia = listaNumerica;

        const listaMapa = this._objetoMapaALista(value);
        if (Array.isArray(listaMapa) && listaMapa.length > 0) return listaMapa;
        if (Array.isArray(listaMapa) && !listaVacia) listaVacia = listaMapa;

        return listaVacia;
    },

    _extraerListaFirestore(value, profundidad = 0) {
        if (value === null || value === undefined || profundidad > 5) return null;

        if (Array.isArray(value)) {
            return value.map(item => this._restaurarDesdeFirestore(item));
        }

        if (!value || typeof value !== 'object') return null;

        if (Array.isArray(value.__mmpArray)) {
            return value.__mmpArray.map(item => this._restaurarDesdeFirestore(item));
        }

        const listaPorIndice = this._objetoConIndicesNumericos(value);
        if (listaPorIndice) return listaPorIndice;

        let listaVacia = null;
        const camposContenedor = ['data', 'datos', 'items', 'registros', 'records', 'rows', 'lista', 'value', 'valores', 'values'];
        for (const campo of camposContenedor) {
            if (Object.prototype.hasOwnProperty.call(value, campo)) {
                const lista = this._extraerListaFirestore(value[campo], profundidad + 1);
                if (Array.isArray(lista) && lista.length > 0) return lista;
                if (Array.isArray(lista) && !listaVacia) listaVacia = lista;
            }
        }

        return listaVacia;
    },

    _normalizarTablaDesdeFirestore(tabla, payload) {
        const datosNube = payload && Object.prototype.hasOwnProperty.call(payload, 'data')
            ? payload.data
            : payload;

        if (this._tablasTipoLista.has(tabla)) {
            const listaForzada = this._forzarListaFirestore(payload);
            if (Array.isArray(listaForzada) && listaForzada.length > 0) return listaForzada;

            const listaDesdeDatos = this._forzarListaFirestore(datosNube);
            if (Array.isArray(listaDesdeDatos) && listaDesdeDatos.length > 0) return listaDesdeDatos;
            if (Array.isArray(listaForzada)) return listaForzada;
            if (Array.isArray(listaDesdeDatos)) return listaDesdeDatos;
        }

        const lista = this._extraerListaFirestore(payload);
        if (Array.isArray(lista)) return lista;

        return this._restaurarDesdeFirestore(datosNube);
    },

    _asegurarTablaLista(tabla, datos) {
        if (!this._tablasTipoLista.has(tabla)) return datos;
        if (Array.isArray(datos)) return datos;
        if (datos === null || datos === undefined) return [];

        const listaForzada = this._forzarListaFirestore(datos);
        if (Array.isArray(listaForzada)) return listaForzada;

        if (typeof datos === 'object') {
            const entradas = Object.entries(datos).filter(([key]) => !key.startsWith('_'));
            if (!entradas.length) return [];

            const valores = entradas.map(([, value]) => this._restaurarDesdeFirestore(value));
            if (valores.some(value => value && typeof value === 'object')) {
                return valores;
            }

            return [this._restaurarDesdeFirestore(datos)];
        }

        return [];
    },

    async normalizarListasLocales() {
        const tablas = Array.from(this._tablasTipoLista);
        let normalizadas = 0;

        for (const tabla of tablas) {
            const actual = this.get(tabla, null);
            if (Array.isArray(actual)) continue;
            if (actual === null || actual === undefined) continue;

            const lista = this._asegurarTablaLista(tabla, actual);
            if (!Array.isArray(lista)) continue;

            await this._guardarLocalDirecto(tabla, lista);
            normalizadas++;

            if (['productos', 'clientes', 'cuentasPorCobrar', 'pagaresSistema', 'ventasRegistradas', 'movimientosCaja'].includes(tabla)) {
                console.warn(`Tabla ${tabla} normalizada localmente: ${lista.length} registros.`);
            }
        }

        return normalizadas;
    },

    _logTablaFirebase(tabla, datos) {
        const tablasClave = new Set([
            'productos',
            'clientes',
            'cuentasPorCobrar',
            'pagaresSistema',
            'ventasRegistradas',
            'movimientosCaja'
        ]);
        if (!tablasClave.has(tabla)) return;

        const resumen = Array.isArray(datos)
            ? `${datos.length} registros`
            : (datos && typeof datos === 'object' ? `${Object.keys(datos).length} campos` : typeof datos);

        console.log(`Firebase -> ${tabla}: ${resumen}`);
    },

    _logPayloadVacio(tabla, payload) {
        if (!this._tablasTipoLista.has(tabla)) return;
        const camposDoc = payload && typeof payload === 'object' ? Object.keys(payload).slice(0, 12) : [];
        const data = payload && typeof payload === 'object' ? payload.data : null;
        const camposData = data && typeof data === 'object' ? Object.keys(data).slice(0, 12) : [];
        const tiposData = data && typeof data === 'object'
            ? Object.entries(data).slice(0, 6).map(([key, value]) => `${key}:${Array.isArray(value) ? 'array' : typeof value}`)
            : [];
        console.warn(`Firebase -> ${tabla} llego sin registros. camposDoc=${camposDoc.join('|')} camposData=${camposData.join('|')} tiposData=${tiposData.join('|')}`);
    },

    _esTablaCriticaVacia(tabla, datos) {
        return this._tablasCriticasConDatos.has(tabla) && Array.isArray(datos) && datos.length === 0;
    },

    _hayBaseOperativaLocal() {
        return Array.from(this._tablasCriticasConDatos).some(tabla => {
            const datos = this.get(tabla, []);
            return Array.isArray(datos) && datos.length > 0;
        });
    },

    _fechaOrdenValor(item) {
        if (!item || typeof item !== 'object') return null;

        const camposFecha = [
            'fecha',
            'fechaIso',
            'fechaVenta',
            'fechaEmision',
            'fechaRegistro',
            'fechaCreacion',
            'fechaCapturaIso',
            'fechaCaptura',
            'fechaSolicitud',
            'fechaResolucion',
            'fechaVencimiento',
            'fechaApartado',
            'fechaCompromiso',
            'fechaAbonoIso',
            'fechaAbono',
            'fechaPago',
            'fechaCompra',
            'fechaRecepcion',
            'fechaEntrega',
            'fechaCancelacion',
            'createdAt',
            'actualizadoEn',
            'ultimaActualizacion'
        ];

        for (const campo of camposFecha) {
            const valor = item[campo];
            if (valor === null || valor === undefined || valor === '') continue;

            if (typeof valor === 'number' && Number.isFinite(valor)) return valor;

            const fecha = window.parseFechaMXOrNull
                ? window.parseFechaMXOrNull(valor)
                : (valor instanceof Date ? valor : new Date(valor));
            if (fecha && !isNaN(fecha.getTime())) return fecha.getTime();
        }

        return null;
    },

    _ordenarCronologicoSiTieneFechas(key, value) {
        if (!Array.isArray(value) || value.length < 2) return value;
        if (key === 'carrito') return value;

        const conIndice = value.map((item, index) => ({
            item,
            index,
            fecha: this._fechaOrdenValor(item)
        }));

        if (conIndice.filter(row => row.fecha !== null).length < 2) return value;

        return conIndice
            .sort((a, b) => {
                if (a.fecha === null && b.fecha === null) return a.index - b.index;
                if (a.fecha === null) return 1;
                if (b.fecha === null) return -1;
                return a.fecha - b.fecha || a.index - b.index;
            })
            .map(row => row.item);
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

    _idDispositivoSync() {
        let id = this._cache._syncDeviceId;
        try { id = id || localStorage.getItem('_syncDeviceId'); } catch(e) {}
        if (!id) {
            id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
            this._cache._syncDeviceId = id;
            try { localStorage.setItem('_syncDeviceId', id); } catch(e) {}
        }
        return id;
    },

    async _marcarCambioRemoto(tabla, ts = Date.now()) {
        if (!window._firebaseActivo || !window._db) return;
        try {
            await window._db.collection('posData').doc('_syncStatus').set({
                _updatedAt: ts,
                tabla: tabla || '',
                deviceId: this._idDispositivoSync()
            }, { merge: true });
        } catch (e) {
            console.warn('No se pudo marcar estado global de sincronizacion:', e);
        }
    },

    _registrarInteraccionUsuarioSync() {
        if (this._syncInteraccionesRegistradas) return;
        this._syncInteraccionesRegistradas = true;
        this._ultimaInteraccionUsuario = Date.now();

        const marcar = () => { this._ultimaInteraccionUsuario = Date.now(); };
        ['pointerdown', 'keydown', 'wheel', 'touchstart', 'input', 'change', 'scroll'].forEach(evt => {
            window.addEventListener(evt, marcar, { passive: true, capture: true });
        });
    },

    _hayInteraccionActiva() {
        const activo = document.activeElement;
        const tag = String(activo?.tagName || '').toLowerCase();
        const editando = !!activo && (
            ['input', 'textarea', 'select', 'button'].includes(tag) ||
            activo.isContentEditable
        );
        const modalAbierto = !!document.querySelector('[data-modal], .modal, #modalCorreccionAbono, #modalAbonoApartado, #modalHistorialAbonos');
        const interaccionReciente = (Date.now() - Number(this._ultimaInteraccionUsuario || 0)) < 4000;
        return editando || modalAbierto || interaccionReciente;
    },

    _renderVistaActualSuave(actual) {
        const renderers = {
            dashboard: () => typeof renderDashboard === 'function' && renderDashboard(),
            tienda: () => typeof mostrarProductos === 'function' && mostrarProductos(),
            cuentasxcobrar: () => typeof renderCuentasXCobrar === 'function' && renderCuentasXCobrar(),
            clientes: () => typeof renderClientes === 'function' && renderClientes(),
            compras: () => typeof renderCompras === 'function' && renderCompras(),
            abonosdirectos: () => typeof renderAbonosDirectos === 'function' && renderAbonosDirectos(),
            corte: () => typeof renderCorteCaja === 'function' && renderCorteCaja(),
            'corte-caja': () => typeof renderCorteCaja === 'function' && renderCorteCaja()
        };
        const fn = renderers[actual];
        if (!fn) return false;

        const x = window.scrollX || 0;
        const y = window.scrollY || 0;
        fn();
        requestAnimationFrame(() => window.scrollTo(x, y));
        return true;
    },

    _refrescarVistaActualPostSync(opciones = {}) {
        try {
            if (typeof window._recargarVariablesGlobales === 'function') window._recargarVariablesGlobales();
            const actual = window._vistaActualSistema || (window.location.hash ? window.location.hash.replace('#', '') : '');
            if (typeof renderBadgeNotificaciones === 'function') renderBadgeNotificaciones();

            const forzar = opciones?.forzar === true;
            if (!forzar && this._hayInteraccionActiva()) {
                this._refrescoSuavePendiente = { actual, ts: Date.now() };
                if (!this._refrescoSuaveTimer) {
                    this._refrescoSuaveTimer = setTimeout(() => {
                        this._refrescoSuaveTimer = null;
                        const pendiente = this._refrescoSuavePendiente;
                        if (!pendiente) return;
                        if (this._hayInteraccionActiva()) return;
                        this._renderVistaActualSuave(pendiente.actual);
                        this._refrescoSuavePendiente = null;
                    }, 12000);
                }
                return;
            }

            this._renderVistaActualSuave(actual);
        } catch (e) {
            console.warn('No se pudo refrescar vista post-sync:', e);
        }
    },

    async sincronizarCambiosRemotos(motivo = 'manual') {
        if (!window._firebaseActivo || !window._db || !window._auth?.currentUser) return false;
        if (this._syncRemotoEnCurso) return this._syncRemotoEnCurso;

        this._syncRemotoEnCurso = (async () => {
            console.log(`Sincronizando cambios remotos (${motivo})...`);
            const ok = await this.syncAll({ source: 'server', forzarDescarga: true });
            this._refrescarVistaActualPostSync();
            return ok;
        })();

        try {
            return await this._syncRemotoEnCurso;
        } finally {
            this._syncRemotoEnCurso = null;
        }
    },

    solicitarSyncRemoto(motivo = 'remoto', delay = 1200) {
        if (this._syncRemotoTimer) clearTimeout(this._syncRemotoTimer);
        this._syncRemotoTimer = setTimeout(() => {
            this.sincronizarCambiosRemotos(motivo).catch(e => console.warn('Sync remoto fallido:', e));
        }, delay);
    },

    // Guarda localmente sin volver a disparar sincronización Firebase
    async _guardarLocalDirecto(key, value) {
        value = this._ordenarCronologicoSiTieneFechas(key, value);
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
                this._cache[key] = this._ordenarCronologicoSiTieneFechas(key, this._cache[key]);
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
                    this._cache[key] = this._ordenarCronologicoSiTieneFechas(key, this._cache[key]);
                } catch(e) {}
            }
        }

        // Asignar variables globales
        window.productos = this.get("productos", []);
        window.categoriasData = this.get("categoriasData", []);
        window.carrito = this.get("carrito", []);
        window.movimientosInventario = this.get("movimientosInventario", []);

        // 🔐 Integridad de clientes: ahora que los datos reales ya están en
        // memoria (no antes), aseguramos IDs en clientes migrados y
        // enlazamos cuentas/apartados históricos sin clienteId.
        try {
            if (typeof window._clientesAsegurarIds === 'function') window._clientesAsegurarIds();
            if (typeof window._clientesVincularRegistrosHistoricos === 'function') window._clientesVincularRegistrosHistoricos();
        } catch (e) {
            console.warn('No se pudo ejecutar la integridad de clientes:', e);
        }

        this._isReady = true;
        return true;
    },

    _avisosSyncMostrados: new Set(),

    // Antes, un fallo al sincronizar con Firebase solo se registraba en la consola (console.warn/
    // console.error) y el usuario nunca se enteraba: la tabla dejaba de respaldarse en la nube en
    // silencio. Esta función centraliza el aviso: muestra una alerta clara (una sola vez por tabla
    // por sesión, para no ser repetitiva) y distingue si el problema parece ser que el documento
    // superó el límite de 1 MiB por documento de Firestore.
    _notificarFalloSync(key, error) {
        const msg = String((error && error.message) || error || '');
        console.warn(`☁️ Fallo al sincronizar "${key}" con Firebase:`, error);
        if (this._avisosSyncMostrados.has(key)) return;
        this._avisosSyncMostrados.add(key);
        const pareceLimiteTamano = /longer than|exceeds|maximum|1048576|too large|invalid-argument/i.test(msg);
        if (pareceLimiteTamano) {
            alert(
                `⚠️ La tabla "${key}" no se pudo sincronizar con la nube: parece haber superado el límite de tamaño de Firestore (1 MB por documento).\n\n` +
                `Tus datos siguen guardados en este dispositivo con seguridad, pero esta tabla dejó de respaldarse en la nube hasta resolver esto. Avisa a soporte/al desarrollador.`
            );
        } else {
            alert(
                `⚠️ No se pudo sincronizar "${key}" con la nube en este momento (sin conexión o error del servidor).\n\n` +
                `Tus datos están guardados en este dispositivo y se reintentará la próxima vez que se guarde algo en esta tabla.`
            );
        }
    },

    get(key, defaultValue = null) {
        if (this._cache[key] !== undefined && this._cache[key] !== null) {
            return this._cache[key];
        }
        return defaultValue;
    },

    set(key, value) {
        value = this._ordenarCronologicoSiTieneFechas(key, value);
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
                const ts = this._cache[`_ts_${key}`] || Date.now();

                if (this._esTablaCriticaVacia(key, value)) {
                    console.warn(`Firebase protegido: no se sube ${key} vacia.`);
                    return;
                }

                // Tablas configuradas como "registro individual" (pagaresSistema, cortesCaja):
                // en vez de reescribir un documento gigante con todo el arreglo, se sube SOLO
                // lo que cambió, un documento por registro, en lotes.
                if (this._tablasRegistroIndividual[key]) {
                    this._sincronizarTablaPorRegistro(key, value, ts)
                        .then(() => this._marcarCambioRemoto(key, ts))
                        .catch(e => this._notificarFalloSync(key, e));
                    return;
                }

                const valorFirestore = this._limpiarParaFirestore(value);

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
                        }, { merge: true })
                            .then(() => this._marcarCambioRemoto(key, ts))
                            .catch(e => this._notificarFalloSync(key, e));
                        
                    } else {
                        // Comportamiento normal para configuraciones o tablas de un solo autor
                        docRef.set({
                            data: valorFirestore,
                            _updatedAt: ts
                        })
                            .then(() => this._marcarCambioRemoto(key, ts))
                            .catch(e => {
                            this._notificarFalloSync(key, e);
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
                await this._marcarCambioRemoto(key, tsAhora);
                console.log(`✅ pushAtomo: ${key} sincronizado INMEDIATAMENTE a Firebase`);
            } catch (e) { 
                console.warn(`⚠️ pushAtomo fallo para ${key}, pero datos guardados localmente:`, e); 
                this._notificarFalloSync(key, e);
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
                await this._marcarCambioRemoto(key, tsAhora);
                console.log(`✅ removeAtomo: ${key} item ${idValue} eliminado INMEDIATAMENTE en Firebase`);
            } catch (e) { 
                console.warn(`⚠️ removeAtomo fallo para ${key}, pero datos limpiados localmente:`, e); 
                this._notificarFalloSync(key, e);
            }
        }
    },
    // -----------------------------------------------------------

    // ☁️ FUNCIONES DE NUBE (Ahora sí conectadas a Firestore)

    // Devuelve el timestamp local de la última vez que guardamos una tabla
    _tsLocal(key) {
        return Number(this._cache[`_ts_${key}`] || 0);
    },

    // Sube una tabla configurada como "registro individual" comparando contra el último estado
    // sincronizado (en memoria) para escribir SOLO lo que cambió, en lotes de Firestore, en vez
    // de reescribir un documento gigante con todo el arreglo en cada guardado.
    async _sincronizarTablaPorRegistro(tabla, arreglo, ts = Date.now()) {
        if (!Array.isArray(arreglo)) return;
        const cacheKey = `_ultimoSyncPorRegistro_${tabla}`;
        const anterior = this._cache[cacheKey] || {};
        const actualPorClave = {};
        const cambios = [];

        arreglo.forEach(item => {
            const clave = this._claveRegistro(tabla, item);
            if (!clave) return; // sin clave utilizable: no se puede sincronizar individualmente
            const limpio = this._limpiarParaFirestore(item);
            const json = JSON.stringify(limpio);
            actualPorClave[clave] = { json, data: limpio };
            if (anterior[clave] !== json) cambios.push({ clave, data: limpio });
        });

        const eliminaciones = Object.keys(anterior).filter(clave => !(clave in actualPorClave));

        const docTabla = window._db.collection('posData').doc(tabla);

        if (!cambios.length && !eliminaciones.length) {
            await docTabla.set({ _updatedAt: ts, _registroIndividual: true });
            return;
        }

        const coleccion = docTabla.collection('registros');
        const operaciones = [
            ...cambios.map(c => ({ tipo: 'set', ref: coleccion.doc(c.clave), data: c.data })),
            ...eliminaciones.map(clave => ({ tipo: 'delete', ref: coleccion.doc(clave) }))
        ];

        const TAMANO_LOTE = 400; // margen bajo el limite de 500 operaciones por batch de Firestore
        for (let i = 0; i < operaciones.length; i += TAMANO_LOTE) {
            const lote = window._db.batch();
            operaciones.slice(i, i + TAMANO_LOTE).forEach(op => {
                if (op.tipo === 'set') lote.set(op.ref, op.data);
                else lote.delete(op.ref);
            });
            await lote.commit();
        }

        // Documento marcador SIN el campo "data": así un cliente viejo que aun espere el formato
        // anterior no encuentra un arreglo gigante, y syncAll() sabe leer la subcoleccion.
        await docTabla.set({ _updatedAt: ts, _registroIndividual: true });

        const nuevoMapa = {};
        Object.entries(actualPorClave).forEach(([clave, v]) => { nuevoMapa[clave] = v.json; });
        this._cache[cacheKey] = nuevoMapa;

        console.log(`☁️ ${tabla}: ${cambios.length} registro(s) actualizados, ${eliminaciones.length} eliminado(s) (documento individual).`);
    },

    // Descarga una tabla configurada como "registro individual" desde su subcolección.
    async _descargarTablaPorRegistro(tabla, payload, forzarDescarga) {
        const tsFirebase = Number(payload?._updatedAt || 0);
        const tsLocal = this._tsLocal(tabla);
        const datosLocalesAntes = this.get(tabla, null);
        const localTieneDatos = Array.isArray(datosLocalesAntes) && datosLocalesAntes.length > 0;

        if (!forzarDescarga && localTieneDatos && tsLocal > 0 && tsFirebase <= tsLocal) {
            console.log(`⏭️ ${tabla}: local más reciente (documento individual), se conserva.`);
            return false;
        }

        const snap = await window._db.collection('posData').doc(tabla).collection('registros').get();
        const registros = snap.docs.map(d => this._restaurarDesdeFirestore(d.data()));

        if (!registros.length && this._tablasCriticasConDatos.has(tabla)) {
            console.warn(`${tabla}: Firebase (documento individual) está vacío; no se sobreescribe local.`);
            return false;
        }

        await this._guardarLocalDirecto(tabla, registros);
        if (tsFirebase > 0) {
            this._cache[`_ts_${tabla}`] = tsFirebase;
            await localforage.setItem(`_ts_${tabla}`, tsFirebase).catch(() => {});
        }

        // Refrescamos el cache de diffing para que el próximo guardado local no vuelva a
        // resubir todos los registros como si todos hubieran cambiado.
        const mapa = {};
        registros.forEach(r => {
            const clave = this._claveRegistro(tabla, r);
            if (clave) mapa[clave] = JSON.stringify(this._limpiarParaFirestore(r));
        });
        this._cache[`_ultimoSyncPorRegistro_${tabla}`] = mapa;

        this._logTablaFirebase(tabla, registros);
        return true;
    },

    // Migración manual, de una sola vez: convierte una tabla que hoy vive como documento
    // gigante en Firestore al formato de un documento por registro. Llamar desde la consola:
    // StorageService.migrarTablaARegistroIndividual('pagaresSistema')
    async migrarTablaARegistroIndividual(tabla) {
        if (!this._tablasRegistroIndividual[tabla]) {
            alert(`"${tabla}" no está configurada para el modo de documento individual.`);
            return;
        }
        if (!window._firebaseActivo || !window._db) {
            alert('Firebase no está activo en este momento; no se puede migrar.');
            return;
        }
        const datos = this.get(tabla, []);
        if (!Array.isArray(datos) || !datos.length) {
            alert(`No hay datos locales de "${tabla}" para migrar.`);
            return;
        }
        if (!confirm(`Vas a migrar "${tabla}" (${datos.length} registros) al formato de un documento por registro en Firestore.\n\nEsto puede tardar unos segundos y no afecta tus datos locales. ¿Continuar?`)) {
            return;
        }
        try {
            await this._sincronizarTablaPorRegistro(tabla, datos, Date.now());
            alert(`✅ "${tabla}" migrada con éxito: ${datos.length} registro(s) ahora viven en documentos individuales en Firestore. El límite de 1 MB por documento ya no aplica a esta tabla.`);
        } catch (e) {
            console.error(e);
            alert(`❌ No se pudo migrar "${tabla}": ${e.message || e}`);
        }
    },

    async syncAll(opciones = {}) {
        if (!window._firebaseActivo || !window._db) {
            return Promise.reject(new Error("Firebase no está configurado o activo en este entorno."));
        }

        try {
            console.log("⬇️ Descargando datos dinámicos de Firebase...");

            const forzarDescarga = !!(opciones && opciones.forzarDescarga);
            const source = opciones && opciones.source ? { source: opciones.source } : undefined;
            const snapshot = source
                ? await window._db.collection('posData').get(source)
                : await window._db.collection('posData').get();
            let descargadas = 0;
            let omitidas = 0;

            for (const doc of snapshot.docs) {
                const tabla = doc.id;
                // Ignorar claves de timestamps internos
                if (tabla.startsWith('_ts_') || tabla === '_syncStatus') continue;

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

                // Tablas configuradas como "registro individual": el documento padre no trae
                // el arreglo (solo _updatedAt y _registroIndividual), así que se descargan
                // aparte desde su subcolección en vez de pasar por la normalización genérica.
                if (this._tablasRegistroIndividual[tabla] || payload?._registroIndividual) {
                    try {
                        const huboDescarga = await this._descargarTablaPorRegistro(tabla, payload, forzarDescarga);
                        if (huboDescarga) descargadas++; else omitidas++;
                    } catch (e) {
                        console.warn(`⚠️ Fallo al descargar "${tabla}" (registro individual):`, e);
                        omitidas++;
                    }
                    continue;
                }

                const datosRestaurados = this._asegurarTablaLista(
                    tabla,
                    this._normalizarTablaDesdeFirestore(tabla, payload)
                );
                this._logTablaFirebase(tabla, datosRestaurados);
                if (Array.isArray(datosRestaurados) && datosRestaurados.length === 0) {
                    this._logPayloadVacio(tabla, payload);
                    if (this._tablasCriticasConDatos.has(tabla)) {
                        console.warn(`${tabla}: Firebase esta vacio; no se guarda local ni se marca como descargado.`);
                        omitidas++;
                        continue;
                    }
                }

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

    async uploadAll(opciones = {}) {
        if (!window._firebaseActivo || !window._db) {
            return Promise.reject(new Error("Firebase no está configurado o activo."));
        }

        try {
            console.log("⬆️ Subiendo datos dinámicos a Firebase...");

            const permitirVacio = !!(opciones && opciones.permitirVacio);
            if (!permitirVacio && !this._hayBaseOperativaLocal()) {
                throw new Error("Cancelado: este dispositivo no tiene datos operativos locales. No se suben vacios a Firebase.");
            }

            const tablas = await this.getTablasDinamicas();
            let subidas = 0;
            let omitidasVacias = 0;

            for (let tabla of tablas) {
                const datosLocales = this.get(tabla, null);

                if (!this._esTablaValida(tabla, datosLocales)) {
                    if (!this._clavesIgnoradas.has(tabla)) {
                        console.warn(`⏭️ Tabla ignorada al subir: ${tabla}`);
                    }
                    continue;
                }

                if (!permitirVacio && this._esTablaCriticaVacia(tabla, datosLocales)) {
                    console.warn(`Firebase protegido: no se sube ${tabla} vacia.`);
                    omitidasVacias++;
                    continue;
                }

                const datosFirestore = this._limpiarParaFirestore(datosLocales);

                const tsSubida = Date.now();
                await window._db.collection('posData').doc(tabla).set({
                    data: datosFirestore,
                    _updatedAt: tsSubida
                });
                await this._marcarCambioRemoto(tabla, tsSubida);

                subidas++;
            }

            console.log(`✅ Subida dinámica completada. Tablas subidas: ${subidas}`);
            return true;

        } catch (error) {
            console.error("❌ Error al subir a Firebase:", error);
            throw error;
        }
    },

    _logFirebaseLink() {
        if (window._firebaseActivo && window._db) {
            console.log("📡 Módulo de Firebase enlazado correctamente.");
        }
    },
    startRealtimeSync() {
        if (!window._firebaseActivo || !window._db) return;
        if (this._syncStatusUnsubscribe) return;
        this._registrarInteraccionUsuarioSync();

        console.log("Modulo de Firebase enlazado correctamente. Escuchando cambios remotos.");
        const vistoInicial = Number(this._cache._syncStatusVisto || localStorage.getItem('_syncStatusVisto') || 0);
        this._cache._syncStatusVisto = vistoInicial;

        this._syncStatusUnsubscribe = window._db.collection('posData').doc('_syncStatus').onSnapshot((doc) => {
            if (!doc.exists) return;
            const data = doc.data() || {};
            const ts = Number(data._updatedAt || 0);
            const visto = Number(this._cache._syncStatusVisto || 0);
            if (!ts || ts <= visto) return;

            this._cache._syncStatusVisto = ts;
            try { localStorage.setItem('_syncStatusVisto', String(ts)); } catch(e) {}

            // Tambien verificamos en el mismo dispositivo: puede haber Chrome y PWA abiertos a la vez.
            this.solicitarSyncRemoto(`cambio remoto ${data.tabla || ''}`.trim(), 800);
        }, (err) => {
            console.warn('No se pudo escuchar cambios remotos de Firebase:', err);
        });

        window.addEventListener('focus', () => this.solicitarSyncRemoto('focus', 3000));
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) this.solicitarSyncRemoto('visibility', 1500);
        });
        window.addEventListener('online', () => this.solicitarSyncRemoto('online', 1000));
        setInterval(() => this.solicitarSyncRemoto('intervalo', 1000), 60000);
    }
};

window.StorageService = StorageService;
