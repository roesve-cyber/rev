(function () {
    // ══════════════════════════════════════════════════════════════════
    // FOLIO CONSECUTIVO POR TIPO DE DOCUMENTO
    // ══════════════════════════════════════════════════════════════════
    // Formato: PREFIJO-NNNNN (ej. VTA-00001, DEV-00001, COR-00001).
    // Cada prefijo tiene su propio contador independiente en Firestore
    // (colección `contadoresFolio`, un documento por prefijo, campo
    // `siguiente`). El contador avanza mediante runTransaction, así que
    // nunca dos ventas (ni en dos dispositivos distintos) pueden recibir
    // el mismo número.
    //
    // 🛡️ DISEÑO OFFLINE: generarFolioSistema() es SÍNCRONA a propósito --
    // así ningún llamador existente (8 puntos en ventas.js, compras.js,
    // corte-caja.js, devoluciones.js, cotizaciones.js) necesitó volverse
    // async. Para lograrlo, cada dispositivo mantiene DOS bloques de
    // números guardados en localStorage por prefijo:
    //   - "actual": el bloque que se está consumiendo ahora mismo.
    //   - "siguiente": un bloque YA reservado en Firestore, en espera,
    //     listo para tomar el relevo en cuanto el actual se agote.
    // Cuando el bloque actual llega al 80% de uso, se dispara en segundo
    // plano (sin bloquear nada) la reserva del próximo bloque, para que
    // ya esté disponible localmente cuando haga falta.
    //
    // Si un dispositivo se queda sin bloque actual, sin bloque siguiente
    // Y sin internet para reservar uno nuevo (caso raro: agotó su reserva
    // completa estando desconectado), NUNCA se bloquea la venta: se
    // genera un folio de emergencia con marca "-TMP-" que NO es
    // consecutivo pero garantiza continuidad operativa. Estos folios no
    // hacen match con /^PREFIJO-\d{5}$/, así que quedan automáticamente
    // fuera de cualquier lógica que dependa del formato nuevo (ver
    // ventaEsNueva en cxc.js) -- caso aceptado y documentado, no oculto.
    // ══════════════════════════════════════════════════════════════════

    const DEVICE_KEY = 'mmpFolioDeviceId';
    const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const TAMANO_BLOQUE = 15;
    const UMBRAL_REFILL = 0.8; // al 80% de uso del bloque actual, pedir el siguiente
    const DIGITOS_FOLIO = 5;
    const COLECCION_CONTADORES = 'contadoresFolio';

    // Prefijos conocidos del sistema (para referencia; no se valida contra
    // esta lista, cualquier prefijo nuevo simplemente arranca en 00001).
    // VTA=venta, DEV=devolución, COR=corte de caja, COM=compra directa,
    // CON=reporte de consignación, ENT=vale de entrega, COT=cotización.

    let memoryDeviceId = '';
    const refillEnCurso = {}; // evita disparar 2 reservas en paralelo para el mismo prefijo

    function randomText(length) {
        const bytes = new Uint8Array(length);
        const cryptoApi = window.crypto || window.msCrypto;
        if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
            cryptoApi.getRandomValues(bytes);
            return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('');
        }
        return Array.from({ length }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
    }

    function getDeviceId() {
        try {
            let id = localStorage.getItem(DEVICE_KEY);
            if (!id) {
                id = randomText(4);
                localStorage.setItem(DEVICE_KEY, id);
            }
            return id;
        } catch (err) {
            if (!memoryDeviceId) memoryDeviceId = randomText(4);
            return memoryDeviceId;
        }
    }

    function normalizePrefix(prefix) {
        return String(prefix || 'DOC')
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
            .slice(0, 12) || 'DOC';
    }

    function pad(numero) {
        return String(numero).padStart(DIGITOS_FOLIO, '0');
    }

    // ── Persistencia local de bloques (con respaldo en memoria si no hay
    // localStorage disponible, igual que el resto del sistema) ──
    const bloquesActualesMemoria = {};
    const bloquesSiguientesMemoria = {};

    function _claveActual(prefix) { return `mmpFolioActual_${prefix}`; }
    function _claveSiguiente(prefix) { return `mmpFolioSiguiente_${prefix}`; }

    function _leer(clave, memoriaObj, prefix) {
        try {
            const raw = localStorage.getItem(clave);
            return raw ? JSON.parse(raw) : (memoriaObj[prefix] || null);
        } catch (err) {
            return memoriaObj[prefix] || null;
        }
    }

    function _guardar(clave, memoriaObj, prefix, valor) {
        memoriaObj[prefix] = valor;
        try {
            if (valor === null) localStorage.removeItem(clave);
            else localStorage.setItem(clave, JSON.stringify(valor));
        } catch (err) { /* seguimos con la copia en memoria */ }
    }

    function _leerBloqueActual(prefix) { return _leer(_claveActual(prefix), bloquesActualesMemoria, prefix); }
    function _guardarBloqueActual(prefix, bloque) { _guardar(_claveActual(prefix), bloquesActualesMemoria, prefix, bloque); }
    function _leerBloqueSiguiente(prefix) { return _leer(_claveSiguiente(prefix), bloquesSiguientesMemoria, prefix); }
    function _guardarBloqueSiguiente(prefix, bloque) { _guardar(_claveSiguiente(prefix), bloquesSiguientesMemoria, prefix, bloque); }

    function _hayConexion() {
        return !!(window._firebaseActivo && window._db);
    }

    // Reserva atómica de un bloque de N folios consecutivos en Firestore.
    // Devuelve {inicio, fin}. Nunca dos llamadas concurrentes (de cualquier
    // dispositivo) pueden recibir el mismo rango, gracias a runTransaction.
    async function _reservarBloqueFirestore(prefix, tamano) {
        if (!_hayConexion()) throw new Error('Sin conexión a Firestore para reservar folios de ' + prefix);
        const ref = window._db.collection(COLECCION_CONTADORES).doc(prefix);
        return window._db.runTransaction(async (transaction) => {
            const doc = await transaction.get(ref);
            const siguiente = (doc.exists && Number(doc.data().siguiente) > 0) ? Number(doc.data().siguiente) : 1;
            const inicio = siguiente;
            const fin = siguiente + tamano - 1;
            transaction.set(ref, { siguiente: fin + 1, _actualizadoEn: Date.now() }, { merge: true });
            return { inicio, fin };
        });
    }

    // Dispara (si no hay ya una en curso) la reserva de un bloque nuevo y lo
    // guarda como "siguiente" para este prefijo. Es fire-and-forget: nunca
    // hace esperar a quien generó el folio actual.
    function _asegurarBloqueSiguiente(prefix) {
        if (refillEnCurso[prefix]) return refillEnCurso[prefix];
        if (!_hayConexion()) return Promise.resolve();
        if (_leerBloqueSiguiente(prefix)) return Promise.resolve(); // ya hay uno reservado esperando turno
        refillEnCurso[prefix] = _reservarBloqueFirestore(prefix, TAMANO_BLOQUE)
            .then(({ inicio, fin }) => {
                _guardarBloqueSiguiente(prefix, { inicio, fin });
            })
            .catch((err) => {
                console.warn(`⚠️ No se pudo reservar bloque de folios para ${prefix}:`, err);
            })
            .finally(() => {
                delete refillEnCurso[prefix];
            });
        return refillEnCurso[prefix];
    }

    function _folioEmergencia(prefix) {
        console.warn(`⚠️ Folio consecutivo agotado para "${prefix}" (sin bloque local y sin conexión para renovar). Se emite folio de emergencia no-consecutivo.`);
        return `${prefix}-TMP-${Date.now().toString(36).toUpperCase()}${randomText(3)}`;
    }

    // API pública (síncrona): entrega el siguiente folio consecutivo
    // disponible para ese prefijo, o un folio de emergencia si no hay
    // ninguno reservado ni forma de reservarlo en este instante.
    function generate(prefix) {
        const p = normalizePrefix(prefix);
        let actual = _leerBloqueActual(p);

        if (!actual || Number(actual.cursor) > Number(actual.fin)) {
            // El bloque actual no existe o ya se agotó: promovemos el
            // "siguiente" (si ya fue reservado de antemano) a "actual".
            const siguiente = _leerBloqueSiguiente(p);
            if (siguiente) {
                actual = { inicio: siguiente.inicio, fin: siguiente.fin, cursor: siguiente.inicio };
                _guardarBloqueActual(p, actual);
                _guardarBloqueSiguiente(p, null);
                // Ya que promovimos el de reserva, de una vez intentamos
                // dejar listo el próximo (en segundo plano).
                _asegurarBloqueSiguiente(p);
            } else {
                // No hay nada disponible localmente ahora mismo.
                _asegurarBloqueSiguiente(p); // por si hay conexión, para la próxima vez
                return _folioEmergencia(p);
            }
        }

        const numero = actual.cursor;
        actual.cursor = numero + 1;
        _guardarBloqueActual(p, actual);

        const tamanoBloque = (actual.fin - actual.inicio + 1);
        const usados = (numero - actual.inicio + 1);
        if (tamanoBloque > 0 && (usados / tamanoBloque) >= UMBRAL_REFILL) {
            _asegurarBloqueSiguiente(p); // no bloquea, es fire-and-forget
        }

        return `${p}-${pad(numero)}`;
    }

    // Se puede llamar al cargar el sistema (con sesión ya iniciada y
    // conexión disponible) para dejar bloques listos ANTES de que se
    // necesite el primer folio real del día, evitando el folio de
    // emergencia incluso en el primer uso.
    function precalentar(prefijos = []) {
        if (!_hayConexion()) return;
        prefijos.forEach(p => {
            const prefix = normalizePrefix(p);
            if (!_leerBloqueActual(prefix) && !_leerBloqueSiguiente(prefix)) {
                _asegurarBloqueSiguiente(prefix);
            }
        });
    }

    window.FolioService = Object.freeze({
        generate,
        getDeviceId,
        precalentar
    });
    window.generarFolioSistema = generate;

    // Precalentamiento automático de los prefijos conocidos al cargar,
    // para que el primer folio del día también salga consecutivo.
    if (typeof window.addEventListener === 'function') {
        window.addEventListener('load', () => {
            setTimeout(() => precalentar(['VTA', 'DEV', 'COR', 'COM', 'CON', 'ENT', 'COT']), 1500);
        });
    }
})();
