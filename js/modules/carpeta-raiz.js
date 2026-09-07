// ============================================================================
// 📁 CarpetaRaizService — guarda los documentos generados (PDF/imagen) en una
// carpeta elegida por el usuario, organizados por categoría en subcarpetas,
// en vez de que cada uno vaya a la carpeta de Descargas genérica.
//
// LIMITACIÓN REAL DEL NAVEGADOR (no es un bug, es la plataforma): esto usa la
// File System Access API (`showDirectoryPicker`), que SOLO existe en Chrome/
// Edge de escritorio (Windows/Mac/Linux). NO existe en Android, iOS, Safari
// ni Firefox — en esos casos este servicio se desactiva solo y todo sigue
// funcionando exactamente como antes (descarga normal a la carpeta de
// Descargas del dispositivo).
//
// La preferencia ("sí quiero carpeta" / "no, descarga normal") se guarda en
// localStorage — es decir, por DISPOSITIVO/navegador, nunca se sincroniza:
// exactamente lo que se pidió (elegir en cada dispositivo por separado).
// El handle de la carpeta elegida (que no cabe en localStorage) se guarda en
// IndexedDB, también local a este navegador.
// ============================================================================
(function () {
    const LS_PREFERENCIA = 'carpetaRaizPreferencia'; // 'activada' | 'rechazada'
    const DB_NOMBRE = 'CarpetaRaizDB';
    const DB_STORE = 'handles';
    const DB_KEY_ROOT = 'carpetaRaiz';

    function soportado() {
        return typeof window.showDirectoryPicker === 'function';
    }

    function _abrirDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NOMBRE, 1);
            req.onupgradeneeded = () => {
                if (!req.result.objectStoreNames.contains(DB_STORE)) {
                    req.result.createObjectStore(DB_STORE);
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function _guardarHandleRaiz(handle) {
        const db = await _abrirDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(DB_STORE, 'readwrite');
            tx.objectStore(DB_STORE).put(handle, DB_KEY_ROOT);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }

    async function _leerHandleRaiz() {
        const db = await _abrirDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(DB_STORE, 'readonly');
            const req = tx.objectStore(DB_STORE).get(DB_KEY_ROOT);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    }

    async function _borrarHandleRaiz() {
        const db = await _abrirDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(DB_STORE, 'readwrite');
            tx.objectStore(DB_STORE).delete(DB_KEY_ROOT);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }

    // Verifica (y si hace falta, vuelve a pedir) permiso de escritura sobre un
    // handle ya guardado de una sesión anterior — Chrome no conserva el
    // permiso "readwrite" indefinidamente entre sesiones por seguridad.
    async function _asegurarPermiso(handle) {
        if (!handle) return false;
        try {
            const actual = await handle.queryPermission({ mode: 'readwrite' });
            if (actual === 'granted') return true;
            const pedido = await handle.requestPermission({ mode: 'readwrite' });
            return pedido === 'granted';
        } catch (err) {
            console.error('CarpetaRaizService: error verificando permiso', err);
            return false;
        }
    }

    // Reglas de categorización por palabras clave en el título/nombre del
    // documento — así no hace falta tocar cada uno de los ~15 módulos que
    // generan documentos para que declaren su propia categoría; se infiere
    // del título que ya traen (son descriptivos: "Cotización...", "Corte de
    // Caja...", "Estado de cuenta proveedor...", etc.)
    const REGLAS_CATEGORIA = [
        [/cotizaci[oó]n/i, 'Cotizaciones'],
        [/corte de caja/i, 'Cortes de Caja'],
        [/estado.*cuenta.*proveedor|estado consignaci[oó]n/i, 'Estados de Cuenta Proveedores'],
        [/estado.*cuenta/i, 'Estados de Cuenta Clientes'],
        [/orden de compra/i, 'Órdenes de Compra'],
        [/recepci[oó]n/i, 'Recepciones de Compra'],
        [/devoluci[oó]n|acta de entrega/i, 'Actas y Devoluciones'],
        [/lista de precios/i, 'Listas de Precios'],
        [/garant[ií]a/i, 'Garantías'],
        [/ticket|comprobante|recibo|venta/i, 'Comprobantes de Venta'],
        [/apartado/i, 'Apartados']
    ];
    function categoriaPorTitulo(titulo) {
        const t = String(titulo || '');
        for (const [patron, nombre] of REGLAS_CATEGORIA) {
            if (patron.test(t)) return nombre;
        }
        return 'Otros Documentos';
    }

    async function _obtenerSubcarpeta(rootHandle, categoria) {
        const nombre = String(categoria || 'Otros Documentos').replace(/[\\/:*?"<>|]/g, '-').trim() || 'Otros Documentos';
        return rootHandle.getDirectoryHandle(nombre, { create: true });
    }

    // Evita sobrescribir un documento previo con el mismo nombre (ej. dos
    // cotizaciones del mismo folio en el mismo día): si ya existe, agrega
    // " (2)", " (3)", etc. antes de la extensión.
    async function _nombreSinColision(dirHandle, nombreBase, extension) {
        let intento = `${nombreBase}.${extension}`;
        let n = 1;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            try {
                await dirHandle.getFileHandle(intento);
                n++;
                intento = `${nombreBase} (${n}).${extension}`;
            } catch {
                return intento; // no existe -> este nombre sirve
            }
        }
    }

    async function _escribirBlob(dirHandle, nombreArchivo, blob) {
        const fileHandle = await dirHandle.getFileHandle(nombreArchivo, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
    }

    // Modal simple sí/no. Debe llamarse SIEMPRE desde dentro del mismo click
    // que dispara la descarga (no antes, no después) — showDirectoryPicker
    // exige un gesto de usuario reciente, y el clic del botón "Sí" de este
    // modal cuenta como uno nuevo, así que es seguro llamarlo desde ahí.
    function _preguntarModal() {
        return new Promise((resolve) => {
            document.querySelector('[data-modal="carpeta-raiz-pregunta"]')?.remove();
            const html = `
            <div data-modal="carpeta-raiz-pregunta" style="position:fixed;inset:0;background:rgba(15,23,42,.72);z-index:130000;display:flex;align-items:center;justify-content:center;padding:18px;">
                <div style="width:100%;max-width:460px;background:white;border-radius:10px;padding:24px;box-shadow:0 24px 55px rgba(15,23,42,.3);">
                    <h3 style="margin:0 0 10px;color:#0f172a;">📁 Carpeta para tus documentos</h3>
                    <p style="margin:0 0 18px;color:#475569;font-size:13px;line-height:1.5;">
                        ¿Quieres elegir una carpeta en esta computadora donde se guarden automáticamente,
                        ya organizados por tipo, todos los documentos que generes (cotizaciones, comprobantes,
                        cortes de caja, etc.)? Si dices que no, se descargarán normal a tu carpeta de Descargas
                        como hasta ahora. Esta elección es solo para este dispositivo/navegador.
                    </p>
                    <div style="display:flex;gap:10px;">
                        <button data-btn="si" style="flex:1;padding:12px;border:0;border-radius:7px;background:#2563eb;color:white;font-weight:bold;cursor:pointer;">Sí, elegir carpeta</button>
                        <button data-btn="no" style="flex:1;padding:12px;border:0;border-radius:7px;background:#e2e8f0;color:#334155;font-weight:bold;cursor:pointer;">No, gracias</button>
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', html);
            const modal = document.querySelector('[data-modal="carpeta-raiz-pregunta"]');
            modal.querySelector('[data-btn="si"]').addEventListener('click', () => { modal.remove(); resolve(true); });
            modal.querySelector('[data-btn="no"]').addEventListener('click', () => { modal.remove(); resolve(false); });
        });
    }

    // Se asegura de que la preferencia ya esté resuelta (preguntando si hace
    // falta) y regresa el handle de la raíz listo para usar, o null si el
    // usuario no quiere / el navegador no soporta esto.
    async function _resolverRaiz() {
        if (!soportado()) return null; // dispositivo sin soporte -> nunca preguntar, comportamiento normal

        let pref = localStorage.getItem(LS_PREFERENCIA);

        if (pref === 'rechazada') return null;

        if (pref === 'activada') {
            const handle = await _leerHandleRaiz();
            if (handle && await _asegurarPermiso(handle)) return handle;
            // El handle ya no sirve (se movió/borró la carpeta, o revocaron el
            // permiso) -- en vez de fallar en silencio para siempre, se
            // vuelve a preguntar como si fuera la primera vez.
            await _borrarHandleRaiz();
            pref = null;
        }

        if (!pref) {
            const quiere = await _preguntarModal();
            if (!quiere) {
                localStorage.setItem(LS_PREFERENCIA, 'rechazada');
                return null;
            }
            try {
                const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
                await _guardarHandleRaiz(handle);
                localStorage.setItem(LS_PREFERENCIA, 'activada');
                return handle;
            } catch (err) {
                // Usuario cerró el selector de carpeta sin elegir nada -- no se
                // guarda ninguna preferencia todavía, se vuelve a preguntar la
                // próxima vez que intente guardar un documento.
                console.warn('CarpetaRaizService: selección de carpeta cancelada', err);
                return null;
            }
        }
        return null;
    }

    // Punto de entrada principal. Devuelve { guardado: true, ruta } si el
    // archivo quedó escrito en la carpeta elegida, o { guardado: false } si
    // hay que seguir con la descarga normal (sin carpeta configurada, sin
    // soporte del navegador, o el usuario acaba de decir que no).
    async function guardarArchivo(blob, nombreSugerido, categoriaOTitulo) {
        try {
            const root = await _resolverRaiz();
            if (!root) return { guardado: false };

            const categoria = categoriaPorTitulo(categoriaOTitulo);
            const carpeta = await _obtenerSubcarpeta(root, categoria);

            const nombreLimpio = String(nombreSugerido || 'documento').replace(/\.[a-zA-Z0-9]+$/, '');
            const extMatch = /\.([a-zA-Z0-9]+)$/.exec(String(nombreSugerido || ''));
            const extension = extMatch ? extMatch[1] : (blob.type.includes('pdf') ? 'pdf' : 'png');

            const nombreFinal = await _nombreSinColision(carpeta, nombreLimpio, extension);
            await _escribirBlob(carpeta, nombreFinal, blob);

            return { guardado: true, ruta: `${categoria}/${nombreFinal}` };
        } catch (err) {
            console.error('CarpetaRaizService: no se pudo guardar en la carpeta elegida, se sigue con descarga normal', err);
            return { guardado: false };
        }
    }

    // Para un botón de Configuración: permite elegir/cambiar la carpeta o
    // desactivar esto manualmente, sin depender de que aparezca la pregunta.
    async function configurarManualmente() {
        if (!soportado()) {
            alert('Tu navegador no soporta elegir una carpeta (esta función solo existe en Chrome/Edge de escritorio). Los documentos se seguirán descargando normal.');
            return;
        }
        try {
            const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
            await _guardarHandleRaiz(handle);
            localStorage.setItem(LS_PREFERENCIA, 'activada');
            alert(`Listo. A partir de ahora tus documentos se guardarán organizados dentro de "${handle.name}".`);
        } catch (err) {
            console.warn('CarpetaRaizService: configuración manual cancelada', err);
        }
    }

    async function desactivar() {
        await _borrarHandleRaiz();
        localStorage.setItem(LS_PREFERENCIA, 'rechazada');
        alert('Listo. Tus documentos volverán a descargarse normal a tu carpeta de Descargas.');
    }

    function estaActiva() {
        return soportado() && localStorage.getItem(LS_PREFERENCIA) === 'activada';
    }

    window.CarpetaRaizService = {
        soportado,
        guardarArchivo,
        categoriaPorTitulo,
        configurarManualmente,
        desactivar,
        estaActiva
    };
})();
