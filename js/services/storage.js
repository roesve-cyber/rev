// ===== STORAGE SERVICE (BLINDADO CON INDEXEDDB + FALLBACK A LOCALSTORAGE) =====
const StorageService = {
    _cache: {}, 
    _isReady: false,
    _usandoLocalForage: true, // Bandera para saber qué base nos dejó usar el navegador

    async init() {
        try {
            // 1. Intentar usar la base de datos gigante
            localforage.config({ name: 'MiPueblitoERP', storeName: 'datos_muebleria' });
            
            // Probar si el navegador nos bloquea (Tracking Prevention)
            await localforage.setItem('_prueba', '1');
            await localforage.removeItem('_prueba');

            // Si llegamos aquí, no hay bloqueos. Procedemos con la migración.
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

            // Cargar de IndexedDB a la RAM
            const keys = await localforage.keys();
            for (let key of keys) {
                this._cache[key] = await localforage.getItem(key);
            }
            console.log("🚀 Sistema blindado: Base de datos cargada (IndexedDB).");

        } catch (error) {
            // 🚨 ¡FALLBACK SALVAVIDAS! 🚨
            // Si el navegador bloqueó localForage, rescatamos los datos del almacenamiento clásico
            console.warn("⚠️ Navegador bloqueó IndexedDB. Usando localStorage clásico por seguridad.");
            this._usandoLocalForage = false; // Cambiamos de estrategia
            
            // Cargar TODO desde localStorage clásico a la RAM
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                try {
                    this._cache[key] = JSON.parse(localStorage.getItem(key));
                } catch(e) {}
            }
        }

        // Asignar variables globales (Vital para que el catálogo no salga vacío)
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
        
        // 3. Guardado físico dependiendo de lo que el navegador nos haya permitido
        if (this._usandoLocalForage) {
            localforage.setItem(key, value).catch(err => console.error("Error guardando:", err));
        } else {
            localStorage.setItem(key, JSON.stringify(value));
        }

        return true;
    },

    remove(key) {
        delete this._cache[key];
        if (this._usandoLocalForage) {
            localforage.removeItem(key);
        } else {
            localStorage.removeItem(key);
        }
    },

    async syncAll() { return Promise.resolve(); },
    async uploadAll() { return Promise.resolve(); }
};

window.StorageService = StorageService;