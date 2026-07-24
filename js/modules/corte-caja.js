// ===== CORTE DE CAJA =====

(function() {
    const DENOMINACIONES = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5];

    // Cargar saldos iniciales manuales por cuenta desde localStorage
    try {
        const guardados = localStorage.getItem('saldosInicialesManualesCorte');
        if (guardados) {
            window._saldosInicialesManuales = JSON.parse(guardados);
        }
    } catch (e) {
        console.warn('No se pudieron cargar saldos iniciales desde localStorage:', e);
        window._saldosInicialesManuales = {};
    }

    const dinero = (valor) => new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    }).format(Number(valor || 0));

    const esc = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[ch]));

    const escJs = (value) => String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r?\n/g, ' ');

    const hoyInput = () => {
        if (typeof window.obtenerHoyInputMX === 'function') return window.obtenerHoyInputMX();
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const localIso = (fecha) => {
        if (typeof window.localISO === 'function') return window.localISO(fecha || new Date());
        const d = fecha ? new Date(fecha) : new Date();
        return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    };

    const parseFechaLocal = (value, finDia = false) => {
        if (value && typeof window.fechaInicioDiaMX === 'function' && typeof window.fechaFinDiaMX === 'function') {
            const d = finDia ? window.fechaFinDiaMX(value) : window.fechaInicioDiaMX(value);
            if (d && !isNaN(d.getTime())) return d;
        }

        if (!value) {
            const d = new Date();
            d.setHours(finDia ? 23 : 0, finDia ? 59 : 0, finDia ? 59 : 0, finDia ? 999 : 0);
            return d;
        }

        if (value instanceof Date) {
            const d = new Date(value);
            if (!value.toISOString || !String(value).includes(':')) {
                d.setHours(finDia ? 23 : 0, finDia ? 59 : 0, finDia ? 59 : 0, finDia ? 999 : 0);
            }
            return d;
        }

        if (typeof value === 'number') return new Date(value);

        const raw = String(value);
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
            const [y, m, d] = raw.split('-').map(Number);
            return new Date(y, m - 1, d, finDia ? 23 : 0, finDia ? 59 : 0, finDia ? 59 : 0, finDia ? 999 : 0);
        }

        const parsed = new Date(raw);
        if (!isNaN(parsed.getTime())) return parsed;

        const fallback = new Date();
        fallback.setHours(finDia ? 23 : 0, finDia ? 59 : 0, finDia ? 59 : 0, finDia ? 999 : 0);
        return fallback;
    };

    const fechaKey = (value) => {
        if (typeof window.fechaClaveMX === 'function') return window.fechaClaveMX(value, hoyInput());
        if (typeof window.getFechaLocalMX === 'function') return window.getFechaLocalMX(value);
        const d = parseFechaLocal(value);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const normalizarId = (value) => String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');

    // ===== (Pendientes de corte y captura rápida removidos: los movimientos se registran en su modulo correspondiente) =====

    function asegurarCuentasBancarias() {
        let bancarias = StorageService.get('cuentas-bancarias', []);
        const tarjetas = StorageService.get('tarjetasConfig', []);
        const debito = tarjetas.filter(t => String(t.tipo || '').toLowerCase() === 'debito');

        if (!Array.isArray(bancarias)) bancarias = [];
        if (bancarias.length < debito.length) {
            const reconstruidas = debito.map((t, idx) => {
                const previa = bancarias.find(c => String(c.banco || c.nombre || '').toLowerCase() === String(t.banco || '').toLowerCase());
                return {
                    id: previa?.id || `debito_${idx}_${t.banco}`,
                    nombre: previa?.nombre || `Banco ${t.banco}${t.ultimos4 ? ' ****' + t.ultimos4 : ''}`,
                    tipo: 'debito',
                    banco: t.banco,
                    ultimos4: t.ultimos4 || '',
                    saldoInicial: Number(t.saldoInicial || previa?.saldoInicial || 0),
                    saldo: Number(previa?.saldo || 0)
                };
            });
            StorageService.set('cuentas-bancarias', reconstruidas);
            bancarias = reconstruidas;
        }

        return bancarias;
    }

    function obtenerCuentasCorte() {
        const cajasRaw = StorageService.get('cuentasEfectivo', [
            { id: 'efectivo', nombre: 'Efectivo Principal', tipo: 'efectivo', saldo: 0 }
        ]);
        const cajas = (Array.isArray(cajasRaw) && cajasRaw.length ? cajasRaw : [
            { id: 'efectivo', nombre: 'Efectivo Principal', tipo: 'efectivo', saldo: 0 }
        ]).map((c, index) => ({
            id: String(c.id || `caja_${index + 1}`),
            nombre: c.nombre || `Caja ${index + 1}`,
            tipo: 'efectivo',
            saldoActual: Number(c.saldo || 0),
            aliases: [c.id, c.nombre, index === 0 ? 'efectivo' : '', index === 0 ? 'caja' : ''].filter(Boolean)
        }));

        const bancarias = asegurarCuentasBancarias();
        const movimientos = StorageService.get('movimientosCaja', []);
        const bancos = bancarias.map((c, index) => {
            const aliases = [c.id, c.banco, c.nombre].filter(Boolean);
            // El saldo recien calculado a partir de movimientosCaja (con la misma
            // función de identidad de cuenta que usa todo el sistema) es siempre la
            // fuente confiable; el campo "saldo" guardado puede haber quedado
            // desactualizado o contaminado por una version anterior del resolvedor
            // y ya no se usa como preferente.
            const saldoBase = Number(c.saldoInicial || 0);
            const movCuenta = sumarNetoMovimientos(movimientos, aliases);
            return {
                id: String(c.banco || c.id || `banco_${index + 1}`),
                nombre: c.nombre || c.banco || `Banco ${index + 1}`,
                tipo: 'banco',
                saldoActual: saldoBase + movCuenta,
                aliases
            };
        });

        return [...cajas, ...bancos];
    }

    function coincideCuenta(mov, cuenta) {
        if (!cuenta || cuenta.id === 'todas') return true;
        // Única fuente de verdad para "de qué cuenta es este movimiento", compartida
        // con Mis Cuentas (bancos.js) y el Estado de Cuenta Bancario. Nunca vuelvas a
        // comparar mov.cuenta/mov.cuentaId a mano aquí: si hace falta ajustar la
        // prioridad de campos, se ajusta UNA sola vez en window.movimientoPerteneceACuenta.
        return window.movimientoPerteneceACuenta(mov, cuenta.aliases);
    }

    // Movimiento que no calza con NINGUNA cuenta/caja/banco conocida (huérfano):
    // se detecta para poder mostrarlo, nunca para adivinar dónde meterlo.
    function movimientoEsHuerfano(mov, todasLasCuentas) {
        return !todasLasCuentas.some(c => window.movimientoPerteneceACuenta(mov, c.aliases));
    }

    function sumarNetoMovimientos(movimientos, aliases, desdeExclusive = null, hastaInclusive = null) {
        const cuenta = { id: 'tmp', aliases: aliases || [] };
        return (Array.isArray(movimientos) ? movimientos : []).reduce((sum, mov) => {
            if (!coincideCuenta(mov, cuenta)) return sum;
            const fecha = parseFechaLocal(mov.fecha || mov.fechaISO || mov.createdAt);
            if (desdeExclusive && fecha <= desdeExclusive) return sum;
            if (hastaInclusive && fecha > hastaInclusive) return sum;
            const monto = Number(mov.monto || 0);
            const tipo = String(mov.tipo || '').toLowerCase();
            return sum + (tipo === 'ingreso' ? monto : -monto);
        }, 0);
    }

    function tipoNormalizado(mov) {
        return String(mov.tipo || '').toLowerCase() === 'ingreso' ? 'ingreso' : 'egreso';
    }

    function cuentaEsDebito(idONombre) {
        const clave = normalizarId(idONombre);
        if (!clave) return false;
        const debito = (StorageService.get('tarjetasConfig', []) || [])
            .filter(t => String(t.tipo || '').toLowerCase() === 'debito');
        const bancarias = StorageService.get('cuentas-bancarias', []) || [];
        return [...debito, ...bancarias].some(c =>
            [c.id, c.banco, c.nombre, c.etiqueta]
                .filter(Boolean)
                .some(valor => {
                    const candidato = normalizarId(valor);
                    return candidato === clave || clave.includes(candidato) || candidato.includes(clave);
                })
        );
    }

    function esTransferenciaInterna(mov, txt) {
        const referencia = String(mov.referencia || '').trim().toUpperCase();
        const medio = String(mov.medioPago || '').trim().toLowerCase();
        return referencia.startsWith('TR-') ||
            String(mov.tipoMovimiento || '').toLowerCase() === 'transferencia_interna' ||
            !!(mov.cuentaOrigen && mov.cuentaDestino) ||
            txt.includes('transferencia a:') ||
            txt.includes('transferencia de:') ||
            (medio === 'transferencia' && txt.includes('transferencia interna'));
    }

    function destinoMovimiento(mov, txt) {
        const directo = mov.cuentaDestino || mov.destinoCuenta || mov.destino || '';
        if (directo) return directo;
        const match = txt.match(/transferencia\s+a:\s*([^(]+)/i);
        return match ? match[1].trim() : '';
    }

    function categoriaMovimiento(mov) {
        const txt = `${mov.concepto || ''} ${mov.referencia || ''}`.toLowerCase();
        const tipo = tipoNormalizado(mov);
        const destino = destinoMovimiento(mov, txt);
        const destinoDebito = cuentaEsDebito(destino);
        const transferencia = esTransferenciaInterna(mov, txt);

        if (tipo === 'ingreso') {
            if (transferencia || destinoDebito) return 'Transferencias';
            if (txt.includes('abono a apartado') || txt.includes('abn-apt') || txt.includes('apartado')) return 'Apartados';
            if (txt.includes('abono')) return 'Abonos credito';
            if (txt.includes('enganche')) return 'Enganches';
            if (txt.includes('venta')) return 'Ventas';
            if (txt.includes('devolucion') || txt.includes('reembolso')) return 'Reembolsos';
            return 'Otros ingresos';
        }

        if (transferencia || destinoDebito) return 'Transferencias';
        if (txt.includes('gasto')) return 'Gastos operativos';
        if (txt.includes('proveedor') || txt.includes('compra') || txt.includes('oc')) return 'Compras/proveedores';
        if (
            String(mov.medioPago || '').toLowerCase() === 'tarjeta_msi' ||
            String(mov.referencia || '').toUpperCase().startsWith('PAGO-TC-') ||
            String(mov.referencia || '').toUpperCase().startsWith('MSI-') ||
            txt.includes('pago a corte mensual tarjeta') ||
            txt.includes('pago msi')
        ) return 'Pago de tarjeta / MSI';
        if (txt.includes('cancel') || txt.includes('devolucion') || txt.includes('reembolso')) return 'Cancelaciones/devoluciones';
        if (txt.includes('consign')) return 'Consignacion';
        return 'Egresos por identificar';
    }

    const UBICACION_FIJA_CORTE_KEY = 'corteCajaUbicacionFija';

    function obtenerUbicacionFijaCorte() {
        try { return localStorage.getItem(UBICACION_FIJA_CORTE_KEY) || 'todas'; } catch (e) { return 'todas'; }
    }

    function guardarUbicacionFijaCorte(cuentaId) {
        try { localStorage.setItem(UBICACION_FIJA_CORTE_KEY, cuentaId || 'todas'); } catch (e) { /* noop */ }
    }

    function leerFiltros() {
        const cuentaId = document.getElementById('corteCuenta')?.value || obtenerUbicacionFijaCorte();
        guardarUbicacionFijaCorte(cuentaId);
        return {
            fechaInicio: document.getElementById('corteFechaInicio')?.value || hoyInput(),
            fechaFin: document.getElementById('corteFechaFin')?.value || hoyInput(),
            cuentaId
        };
    }

    function idMovimientoCorte(mov, index) {
        return String(mov.id || mov.idOperacion || `${mov.referencia || 'mov'}-${mov.fecha || mov.fechaISO || mov.createdAt || ''}-${mov.monto || 0}-${index}`)
            .replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    function idsMovimientosYaCortados() {
        const cortes = StorageService.get('cortesCaja', []);
        const ids = new Set();
        (Array.isArray(cortes) ? cortes : []).forEach(corte => {
            (Array.isArray(corte.movimientos) ? corte.movimientos : []).forEach(m => {
                const id = m.corteId || m._corteId || m.id;
                if (id !== undefined && id !== null && String(id).trim() !== '') {
                    ids.add(String(id));
                }
            });
        });
        return ids;
    }

    function persistirSaldoInicialManual(cuentaId, valor) {
        if (!cuentaId) return;
        if (!window._saldosInicialesManuales) window._saldosInicialesManuales = {};
        window._saldosInicialesManuales[cuentaId] = valor;
        try {
            localStorage.setItem('saldosInicialesManualesCorte', JSON.stringify(window._saldosInicialesManuales));
        } catch (e) {
            console.warn('No se pudo persistir el saldo inicial fijo en localStorage:', e);
        }
    }

    // Saldo inicial FIJO: se hereda del ultimo corte guardado de esta cuenta y no se recalcula
    // con cada movimiento nuevo. Solo se calcula por respaldo la primera vez que se corta una cuenta
    // (cuando aun no existe ningun corte previo guardado para ella).
    function obtenerUltimoCorteGuardado(cuentaId) {
        if (!cuentaId || cuentaId === 'todas') return null;
        const cortesRaw = StorageService.get('cortesCaja', []);
        const cortes = (Array.isArray(cortesRaw) ? cortesRaw : [])
            .filter(c => String(c.cuentaId) === String(cuentaId) && typeof c.saldoFinalSistema === 'number');
        if (!cortes.length) return null;
        return cortes.sort((a, b) => {
            const fa = parseFechaLocal(a.fechaFin || a.fechaCreacion, true);
            const fb = parseFechaLocal(b.fechaFin || b.fechaCreacion, true);
            if (fb - fa !== 0) return fb - fa;
            return String(b.fechaCreacion || '').localeCompare(String(a.fechaCreacion || ''));
        })[0];
    }

    function saldoInicialFijoCuenta(cuentaObj, movimientosRaw) {
        // Resuelve el saldo inicial FIJO de una cuenta/ubicacion real (no 'todas'), en este orden:
        // 1) valor manual guardado para esa cuenta -> nunca se toca solo, solo el usuario lo cambia.
        // 2) saldo final del ultimo corte guardado de esa cuenta -> solo cambia al guardar un corte.
        // 3) primera vez que se usa esa cuenta (nunca se corto ni se fijo a mano): se calcula UNA
        //    SOLA VEZ a partir de todo el historial de movimientos y se fija de inmediato, para que
        //    ningun movimiento futuro (venta, abono, correccion, etc.) lo vuelva a mover.
        const saldosInicialesManuales = window._saldosInicialesManuales || {};
        if (cuentaObj.id in saldosInicialesManuales) {
            const valorManual = Number(saldosInicialesManuales[cuentaObj.id]);
            if (!Number.isNaN(valorManual)) return { valor: valorManual, origen: 'manual' };
        }

        const ultimoCorte = obtenerUltimoCorteGuardado(cuentaObj.id);
        if (ultimoCorte) {
            return { valor: Number(ultimoCorte.saldoFinalSistema || 0), origen: 'heredado' };
        }

        const saldoActualCuenta = Number(cuentaObj.saldoActual || 0);
        const netoHistoricoTotal = sumarNetoMovimientos(movimientosRaw, cuentaObj.aliases, null, null);
        const valorBootstrap = saldoActualCuenta - netoHistoricoTotal;
        persistirSaldoInicialManual(cuentaObj.id, valorBootstrap);
        return { valor: valorBootstrap, origen: 'calculado' };
    }

    function calcularResumen(filtros = leerFiltros()) {
        const cuentas = obtenerCuentasCorte();
        const cuenta = filtros.cuentaId === 'todas'
            ? { id: 'todas', nombre: 'Todas las cajas y cuentas', aliases: [], tipo: 'todas' }
            : cuentas.find(c => String(c.id) === String(filtros.cuentaId)) || cuentas[0];

        const inicio = parseFechaLocal(filtros.fechaInicio, false);
        const fin = parseFechaLocal(filtros.fechaFin, true);
        const movimientosRaw = StorageService.get('movimientosCaja', []);
        const yaCortados = idsMovimientosYaCortados();
        const movimientos = (Array.isArray(movimientosRaw) ? movimientosRaw : [])
            .map((m, index) => ({
                ...m,
                _idx: index,
                _corteId: idMovimientoCorte(m, index),
                _fechaObj: parseFechaLocal(m.fecha || m.fechaISO || m.createdAt),
                _tipo: tipoNormalizado(m),
                _categoria: categoriaMovimiento(m),
                _monto: Number(m.monto || 0)
            }))
            .filter(m => m._monto > 0)
            .filter(m => !yaCortados.has(String(m._corteId)) && !yaCortados.has(String(m.id || '')))
            .filter(m => coincideCuenta(m, cuenta))
            .filter(m => m._fechaObj >= inicio && m._fechaObj <= fin)
            .sort((a, b) => a._fechaObj - b._fechaObj);

        const ingresos = movimientos.filter(m => m._tipo === 'ingreso').reduce((s, m) => s + m._monto, 0);
        const egresos = movimientos.filter(m => m._tipo !== 'ingreso').reduce((s, m) => s + m._monto, 0);
        const neto = ingresos - egresos;

        // Movimientos del periodo (de cualquier cuenta) que no calzan con NINGUNA
        // caja/banco conocido: se muestran aparte para que Roberto los reasigne a
        // mano, en vez de dejarlos invisibles o que se cuelen por adivinanza.
        const huerfanos = (Array.isArray(movimientosRaw) ? movimientosRaw : [])
            .filter(m => Number(m.monto || 0) > 0)
            .map((m, index) => ({ ...m, _fechaObj: parseFechaLocal(m.fecha || m.fechaISO || m.createdAt), _monto: Number(m.monto || 0), _idx: index }))
            .filter(m => m._fechaObj >= inicio && m._fechaObj <= fin)
            .filter(m => movimientoEsHuerfano(m, cuentas));

        const cuentasIncluidas = cuenta.id === 'todas' ? cuentas : [cuenta];
        const saldoActual = cuentasIncluidas.reduce((s, c) => s + Number(c.saldoActual || 0), 0);
        const aliases = cuentasIncluidas.flatMap(c => c.aliases);
        const movimientosParaSaldos = StorageService.get('movimientosCaja', []);
        const netoPosterior = cuenta.id === 'todas'
            ? sumarNetoMovimientos(movimientosParaSaldos, aliases, fin, null)
            : sumarNetoMovimientos(movimientosParaSaldos, cuenta.aliases, fin, null);
        const saldoFinalSistema = saldoActual - netoPosterior;

        // Saldo inicial FIJO por cuenta/ubicación: cada caja, banco, etc. tiene el suyo propio e
        // independiente. Para 'todas' se suma el fijo de cada cuenta real (no se recalcula aparte).
        let saldoInicial;
        let saldoInicialOrigen;
        if (cuenta.id === 'todas') {
            let totalFijo = 0;
            let huboCalculoNuevo = false;
            cuentas.forEach(c => {
                const r = saldoInicialFijoCuenta(c, movimientosParaSaldos);
                totalFijo += r.valor;
                if (r.origen === 'calculado') huboCalculoNuevo = true;
            });
            saldoInicial = totalFijo;
            saldoInicialOrigen = huboCalculoNuevo ? 'calculado' : 'heredado';
        } else {
            const r = saldoInicialFijoCuenta(cuenta, movimientosParaSaldos);
            saldoInicial = r.valor;
            saldoInicialOrigen = r.origen;
        }

        // Obtener saldo inicial manual específico para esta cuenta (para mostrar "Manual" en la UI)
        const saldosInicialesManuales = window._saldosInicialesManuales || {};
        const saldoInicialManualCuenta = (cuenta.id in saldosInicialesManuales) ? Number(saldosInicialesManuales[cuenta.id]) : null;

        const porCategoria = {};
        movimientos.forEach(m => {
            if (!porCategoria[m._categoria]) {
                porCategoria[m._categoria] = { categoria: m._categoria, ingresos: 0, egresos: 0, movimientos: 0 };
            }
            porCategoria[m._categoria].movimientos += 1;
            if (m._tipo === 'ingreso') porCategoria[m._categoria].ingresos += m._monto;
            else porCategoria[m._categoria].egresos += m._monto;
        });

        return {
            filtros,
            cuenta,
            cuentasIncluidas,
            inicio,
            fin,
            saldoInicial,
            saldoInicialOrigen,
            saldoInicialManualCuenta,
            ingresos,
            egresos,
            neto,
            saldoFinalSistema,
            movimientos,
            huerfanos,
            porCategoria: Object.values(porCategoria).sort((a, b) => (b.ingresos + b.egresos) - (a.ingresos + a.egresos))
        };
    }

    function resetSeleccionCorte(resumen, mantener = false) {
        const key = `${resumen.filtros.fechaInicio}|${resumen.filtros.fechaFin}|${resumen.cuenta.id}`;
        if (mantener && window._corteCajaSeleccion?.key === key) {
            const disponibles = new Set(resumen.movimientos.map(m => m._corteId));
            window._corteCajaSeleccion.ids = new Set(
                Array.from(window._corteCajaSeleccion.ids || []).filter(id => disponibles.has(id))
            );
            return;
        }
        window._corteCajaSeleccion = {
            key,
            ids: new Set(resumen.movimientos.map(m => m._corteId))
        };
    }

    function movimientosSeleccionados(resumen = window._corteCajaResumen) {
        if (!resumen) return [];
        const ids = window._corteCajaSeleccion?.ids || new Set();
        return resumen.movimientos.filter(m => ids.has(m._corteId));
    }

    function resumenSeleccionado(resumen = window._corteCajaResumen) {
        const seleccionados = movimientosSeleccionados(resumen);
        const ingresos = seleccionados.filter(m => m._tipo === 'ingreso').reduce((s, m) => s + m._monto, 0);
        const egresos = seleccionados.filter(m => m._tipo !== 'ingreso').reduce((s, m) => s + m._monto, 0);
        
        const saldoInicialManualInput = document.getElementById('corteSaldoInicialManual');
        const saldoInicialManualInputVal = saldoInicialManualInput && saldoInicialManualInput.value !== '' ? Number(saldoInicialManualInput.value) : null;
        // Usar el valor del input si está presente, si no usar el guardado para esta cuenta específica
        const saldoInicialManual = saldoInicialManualInputVal !== null ? saldoInicialManualInputVal : (resumen?.saldoInicialManualCuenta || null);
        const saldoInicial = saldoInicialManual !== null ? saldoInicialManual : (resumen?.saldoInicial || 0);
        
        const saldoFinalSistema = saldoInicial + ingresos - egresos;
        const porCategoria = {};

        seleccionados.forEach(m => {
            if (!porCategoria[m._categoria]) {
                porCategoria[m._categoria] = { categoria: m._categoria, ingresos: 0, egresos: 0, movimientos: 0 };
            }
            porCategoria[m._categoria].movimientos += 1;
            if (m._tipo === 'ingreso') porCategoria[m._categoria].ingresos += m._monto;
            else porCategoria[m._categoria].egresos += m._monto;
        });

        return {
            ingresos,
            egresos,
            neto: ingresos - egresos,
            saldoInicial,
            saldoInicialManual,
            saldoInicialOrigen: resumen?.saldoInicialOrigen || 'calculado',
            saldoFinalSistema,
            movimientos: seleccionados,
            totalMovimientos: resumen?.movimientos?.length || 0,
            porCategoria: Object.values(porCategoria).sort((a, b) => (b.ingresos + b.egresos) - (a.ingresos + a.egresos))
        };
    }

    function resumenCortesSeleccionados() {
        const ids = window._corteCajaCortesSeleccionados || new Set();
        const cortes = StorageService.get('cortesCaja', []);
        const seleccionados = (Array.isArray(cortes) ? cortes : []).filter(c => ids.has(String(c.folio)));
        const ingresos = seleccionados.reduce((s, c) => s + Number(c.ingresos || 0), 0);
        const egresos = seleccionados.reduce((s, c) => s + Number(c.egresos || 0), 0);

        return {
            ingresos,
            egresos,
            saldoFinalSistema: ingresos - egresos,
            cortes: seleccionados
        };
    }

    // 🗂️ Una pestaña fija por ubicación (caja/banco) + "Todas". Cada pestaña guarda
    // su propia selección/filtros porque cada cuenta tiene su propio saldo inicial
    // fijo e independiente (ver saldoInicialFijoCuenta). El input oculto #corteCuenta
    // se mantiene por compatibilidad: el resto del archivo lee su .value.
    function renderTabsCuentas(cuentaId) {
        const cuentas = obtenerCuentasCorte();
        const tabs = [
            { id: 'todas', nombre: '📊 Todas' },
            ...cuentas.map(c => ({ id: c.id, nombre: `${c.tipo === 'banco' ? '🏦' : '💵'} ${c.nombre}` }))
        ];
        return `
            <input type="hidden" id="corteCuenta" value="${esc(cuentaId)}">
            <div style="display:flex;gap:6px;flex-wrap:wrap;border-bottom:2px solid #e2e8f0;padding-bottom:0;margin-bottom:14px;">
                ${tabs.map(t => {
                    const activa = String(cuentaId) === String(t.id);
                    return `<button onclick="cambiarPestanaCorteCaja('${escJs(t.id)}')" style="padding:10px 16px;border:0;border-radius:8px 8px 0 0;cursor:pointer;font-weight:800;font-size:13px;background:${activa ? '#1e40af' : '#f1f5f9'};color:${activa ? 'white' : '#475569'};border-bottom:3px solid ${activa ? '#1e40af' : 'transparent'};">${esc(t.nombre)}</button>`;
                }).join('')}
            </div>`;
    }

    window.cambiarPestanaCorteCaja = function(cuentaId) {
        guardarUbicacionFijaCorte(cuentaId);
        renderCorteCaja();
    };

    function renderKpi(titulo, valor, color, subtitulo = '', valorId = '', subtituloId = '') {
        return `
            <div style="background:white;border:1px solid #e2e8f0;border-left:5px solid ${color};border-radius:10px;padding:15px;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                <div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;">${esc(titulo)}</div>
                <div ${valorId ? `id="${valorId}"` : ''} style="font-size:23px;font-weight:900;color:${color};margin-top:5px;">${dinero(valor)}</div>
                ${subtitulo || subtituloId ? `<div ${subtituloId ? `id="${subtituloId}"` : ''} style="font-size:11px;color:#64748b;margin-top:4px;">${esc(subtitulo)}</div>` : ''}
            </div>`;
    }

    function renderCategorias(resumen) {
        const rows = resumen.porCategoria.map(c => `
            <tr>
                <td style="padding:9px;border-bottom:1px solid #f1f5f9;">${esc(c.categoria)}</td>
                <td style="padding:9px;text-align:right;border-bottom:1px solid #f1f5f9;color:#15803d;font-weight:800;">${dinero(c.ingresos)}</td>
                <td style="padding:9px;text-align:right;border-bottom:1px solid #f1f5f9;color:#b91c1c;font-weight:800;">${dinero(c.egresos)}</td>
                <td style="padding:9px;text-align:center;border-bottom:1px solid #f1f5f9;">${c.movimientos}</td>
            </tr>`).join('');

        return `
            <div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:18px;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                <h3 style="margin:0 0 12px;color:#0f172a;font-size:16px;">Resumen por origen</h3>
                <div style="overflow-x:auto;">
                    <table style="width:100%;border-collapse:collapse;font-size:13px;">
                        <thead><tr style="background:#f8fafc;color:#475569;">
                            <th style="padding:9px;text-align:left;">Origen</th>
                            <th style="padding:9px;text-align:right;">Ingresos</th>
                            <th style="padding:9px;text-align:right;">Egresos</th>
                            <th style="padding:9px;text-align:center;">Movs.</th>
                        </tr></thead>
                        <tbody>${rows || '<tr><td colspan="4" style="padding:18px;text-align:center;color:#94a3b8;">Sin movimientos en el periodo.</td></tr>'}</tbody>
                    </table>
                </div>
            </div>`;
    }

    function renderObservacionesCorte() {
        return `
            <div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:18px;box-shadow:0 2px 8px rgba(0,0,0,0.05);margin-top:16px;">
                <label style="font-size:11px;font-weight:800;color:#64748b;">OBSERVACIONES DEL CORTE</label>
                <textarea id="corteObservaciones" placeholder="Ej. movimientos revisados, efectivo separado, pendiente por aclarar..." style="width:100%;min-height:72px;padding:10px;border:1px solid #cbd5e1;border-radius:6px;resize:vertical;box-sizing:border-box;margin-top:6px;"></textarea>
            </div>`;
    }

    function renderMovimientos(resumen) {
        const seleccion = window._corteCajaSeleccion?.ids || new Set();
        const rows = resumen.movimientos.map(m => `
            <tr data-corte-row="${esc(m._corteId)}" style="background:${seleccion.has(m._corteId) ? '#f8fafc' : '#ffffff'};">
                <td style="padding:8px;border-bottom:1px solid #f1f5f9;text-align:center;">
                    <input type="checkbox" class="corte-mov-check" data-id="${esc(m._corteId)}" ${seleccion.has(m._corteId) ? 'checked' : ''} onchange="toggleMovimientoCorte(this)" title="Incluir en corte" style="width:18px;height:18px;border-radius:999px;accent-color:#1e40af;cursor:pointer;">
                </td>
                <td style="padding:8px;border-bottom:1px solid #f1f5f9;white-space:nowrap;">${esc(window.formatearFechaMX ? window.formatearFechaMX(m.fecha || m.fechaISO || m.createdAt) : fechaKey(m._fechaObj))}</td>
                <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${esc(m.concepto || '-')}<br><small style="color:#94a3b8;">${esc(m.referencia || '')}</small></td>
                <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${esc(m.etiquetaCuenta || m.cuenta || '-')}</td>
                <td style="padding:8px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:900;color:${m._tipo === 'ingreso' ? '#15803d' : '#b91c1c'};">${m._tipo === 'ingreso' ? '+' : '-'}${dinero(m._monto)}</td>
            </tr>`).join('');

        return `
            <div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:18px;box-shadow:0 2px 8px rgba(0,0,0,0.05);margin-top:16px;">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
                    <div>
                        <h3 style="margin:0;color:#0f172a;font-size:16px;">Movimientos del corte</h3>
                        <p id="corteEstadoSeleccion" style="margin:3px 0 0;color:#64748b;font-size:12px;"></p>
                    </div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                        <button onclick="marcarTodosMovimientosCorte(true)" style="padding:8px 12px;background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;border-radius:6px;cursor:pointer;font-weight:800;">Marcar todos</button>
                        <button onclick="marcarTodosMovimientosCorte(false)" style="padding:8px 12px;background:#f8fafc;color:#475569;border:1px solid #cbd5e1;border-radius:6px;cursor:pointer;font-weight:800;">Desmarcar todos</button>
                        <button onclick="exportarCorteCajaCSV()" style="padding:8px 12px;background:#0f766e;color:white;border:0;border-radius:6px;cursor:pointer;font-weight:800;">Exportar CSV</button>
                    </div>
                </div>
                <div style="overflow-x:auto;max-height:430px;overflow-y:auto;">
                    <table style="width:100%;border-collapse:collapse;font-size:12px;">
                        <thead style="position:sticky;top:0;background:#f8fafc;color:#475569;">
                            <tr>
                                <th style="padding:8px;text-align:center;">OK</th>
                                <th style="padding:8px;text-align:left;">Fecha</th>
                                <th style="padding:8px;text-align:left;">Concepto</th>
                                <th style="padding:8px;text-align:left;">Cuenta</th>
                                <th style="padding:8px;text-align:right;">Monto</th>
                            </tr>
                        </thead>
                        <tbody>${rows || '<tr><td colspan="5" style="padding:24px;text-align:center;color:#94a3b8;">No hay movimientos para estos filtros.</td></tr>'}</tbody>
                    </table>
                </div>
            </div>`;
    }

    function renderHistorial() {
        const cortes = StorageService.get('cortesCaja', []);
        const seleccionados = window._corteCajaCortesSeleccionados || new Set();
        const rows = (Array.isArray(cortes) ? cortes : []).slice().reverse().slice(0, 12).map(c => {
            const dif = Number(c.diferencia || 0);
            return `
                <tr>
                    <td style="padding:8px;border-bottom:1px solid #f1f5f9;text-align:center;">
                        <input type="checkbox" class="corte-reciente-check" data-folio="${esc(c.folio)}" ${seleccionados.has(String(c.folio)) ? 'checked' : ''} onchange="toggleCorteRecienteResumen(this)" title="Sumar este corte" style="width:18px;height:18px;accent-color:#1e40af;cursor:pointer;">
                    </td>
                    <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${esc(c.folio)}</td>
                    <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${esc(c.cuentaNombre)}</td>
                    <td style="padding:8px;border-bottom:1px solid #f1f5f9;">${esc(c.fechaInicio)} a ${esc(c.fechaFin)}</td>
                    <td style="padding:8px;border-bottom:1px solid #f1f5f9;text-align:right;">${dinero(c.saldoFinalSistema ?? c.totalReal)}</td>
                    <td style="padding:8px;border-bottom:1px solid #f1f5f9;text-align:center;font-weight:900;">${Number(c.movimientosMarcados ?? c.movimientos?.length ?? 0)}</td>
                    <td style="padding:8px;border-bottom:1px solid #f1f5f9;text-align:center;">
                        <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;">
                            <button onclick="abrirDetalleCorteCaja('${esc(c.folio)}')" style="padding:6px 10px;background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;border-radius:6px;cursor:pointer;font-weight:800;">Detalle</button>
                            <button onclick="imprimirCorteGuardado('${esc(c.folio)}')" style="padding:6px 10px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;cursor:pointer;">Emitir</button>
                        </div>
                    </td>
                </tr>`;
        }).join('');

        return `
            <div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:18px;box-shadow:0 2px 8px rgba(0,0,0,0.05);margin-top:16px;">
                <h3 style="margin:0 0 12px;color:#0f172a;font-size:16px;">Cortes recientes</h3>
                <div style="overflow-x:auto;">
                    <table style="width:100%;border-collapse:collapse;font-size:12px;">
                        <thead><tr style="background:#f8fafc;color:#475569;">
                            <th style="padding:8px;text-align:center;">OK</th>
                            <th style="padding:8px;text-align:left;">Folio</th>
                            <th style="padding:8px;text-align:left;">Cuenta</th>
                            <th style="padding:8px;text-align:left;">Periodo</th>
                            <th style="padding:8px;text-align:right;">Monto identificado</th>
                            <th style="padding:8px;text-align:center;">Movs.</th>
                            <th style="padding:8px;text-align:center;">Accion</th>
                        </tr></thead>
                        <tbody>${rows || '<tr><td colspan="7" style="padding:18px;text-align:center;color:#94a3b8;">Aun no hay cortes guardados.</td></tr>'}</tbody>
                    </table>
                </div>
            </div>`;
    }

    window.renderCorteCaja = function() {
        reclasificarCortesGuardados();
        const cont = document.getElementById('contenidoCorteCaja');
        if (!cont) return;

        const filtros = {
            fechaInicio: document.getElementById('corteFechaInicio')?.value || hoyInput(),
            fechaFin: document.getElementById('corteFechaFin')?.value || hoyInput(),
            cuentaId: document.getElementById('corteCuenta')?.value || obtenerUbicacionFijaCorte()
        };
        guardarUbicacionFijaCorte(filtros.cuentaId);
        const resumen = calcularResumen(filtros);
        window._corteCajaResumen = resumen;
        resetSeleccionCorte(resumen, true);
        const seleccion = resumenSeleccionado(resumen);

        // Cargar saldo inicial manual guardado para esta cuenta específica
        const saldosInicialesManuales = window._saldosInicialesManuales || {};
        const saldoInicialGuardado = saldosInicialesManuales[filtros.cuentaId] || '';

        const huerfanosHTML = (resumen.huerfanos && resumen.huerfanos.length > 0) ? `
            <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:12px 14px;margin-bottom:16px;color:#7f1d1d;">
                <strong>⚠️ ${resumen.huerfanos.length} movimiento(s) del periodo sin cuenta reconocida</strong>
                <div style="font-size:12px;margin-top:4px;">No calzan con ninguna caja o banco registrado, así que <b>nunca</b> se cuentan por adivinanza en ningún corte. Revísalos y corrige su cuenta desde donde se originaron (venta, gasto, abono, etc.).</div>
                <ul style="margin:8px 0 0 18px;padding:0;font-size:12px;">
                    ${resumen.huerfanos.slice(0, 6).map(m => `<li>${esc(window.formatearFechaMX ? window.formatearFechaMX(m.fecha) : (m.fecha || '-'))} — ${esc(m.concepto || '-')} — ${dinero(m._monto)}</li>`).join('')}
                    ${resumen.huerfanos.length > 6 ? `<li>${resumen.huerfanos.length - 6} más...</li>` : ''}
                </ul>
            </div>` : '';

        cont.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:16px;">
                <div>
                    <h3 style="margin:0;color:#0f172a;">Cierre operativo</h3>
                    <p style="margin:4px 0 0;color:#64748b;font-size:13px;">Base: movimientosCaja. El guardado del corte no altera saldos. Cada caja/cuenta tiene su propio saldo inicial fijo: solo cambia si lo editas a mano o al guardar un nuevo corte de esa misma cuenta.</p>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button onclick="renderCorteCaja()" style="padding:10px 16px;background:#0f766e;color:white;border:0;border-radius:6px;cursor:pointer;font-weight:900;">🔄 Actualizar</button>
                    <button onclick="guardarCorteCaja()" style="padding:10px 16px;background:#1e40af;color:white;border:0;border-radius:6px;cursor:pointer;font-weight:900;">Guardar corte</button>
                    <button onclick="imprimirCorteActual()" style="padding:10px 16px;background:#475569;color:white;border:0;border-radius:6px;cursor:pointer;font-weight:900;">PDF / Ticket / Imagen</button>
                </div>
            </div>

            ${renderTabsCuentas(filtros.cuentaId)}
            ${huerfanosHTML}

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;background:white;border:1px solid #e2e8f0;border-radius:10px;padding:15px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                <div>
                    <label style="font-size:11px;font-weight:800;color:#64748b;">DESDE</label>
                    <input id="corteFechaInicio" type="date" value="${esc(filtros.fechaInicio)}" onchange="renderCorteCaja()" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px;box-sizing:border-box;">
                </div>
                <div>
                    <label style="font-size:11px;font-weight:800;color:#64748b;">HASTA</label>
                    <input id="corteFechaFin" type="date" value="${esc(filtros.fechaFin)}" onchange="renderCorteCaja()" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px;box-sizing:border-box;">
                </div>
                <div>
                    <label style="font-size:11px;font-weight:800;color:#64748b;">SALDO INICIAL MANUAL (opcional)</label>
                    <input id="corteSaldoInicialManual" type="number" step="0.01" value="${esc(saldoInicialGuardado)}" placeholder="Dejar vacío para calcular automático" onchange="guardarSaldoInicialManualCuenta(); recalcularSeleccionCorte()" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px;box-sizing:border-box;">
                    <small style="color:#94a3b8;">Cuenta actual: <b>${esc(resumen.cuenta.nombre)}</b></small>
                </div>
            </div>

            <div id="corteKpiFranja" style="position:sticky;top:72px;z-index:30;display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-bottom:16px;background:rgba(248,250,252,0.94);backdrop-filter:blur(8px);padding:10px 0;">
                ${renderKpi('Saldo inicial', seleccion.saldoInicial, '#64748b', seleccion.saldoInicialManual !== null ? 'Manual' : (seleccion.saldoInicialOrigen === 'heredado' ? 'Heredado del corte anterior' : 'Calculado (primer corte de esta cuenta)'), 'corteKpiSaldoInicial', 'corteSubSaldoInicial')}
                ${renderKpi('Ingresos marcados', seleccion.ingresos, '#15803d', `${seleccion.movimientos.filter(m => m._tipo === 'ingreso').length} movimientos`, 'corteKpiIngresos', 'corteSubIngresos')}
                ${renderKpi('Egresos marcados', seleccion.egresos, '#b91c1c', `${seleccion.movimientos.filter(m => m._tipo !== 'ingreso').length} movimientos`, 'corteKpiEgresos', 'corteSubEgresos')}
                ${renderKpi('Saldo esperado marcado', seleccion.saldoFinalSistema, '#1e40af', `${seleccion.movimientos.length} de ${seleccion.totalMovimientos} movimientos`, 'corteKpiSaldoSistema', 'corteSubSaldoSistema')}
            </div>

            <div style="display:grid;grid-template-columns:1fr;gap:16px;align-items:start;">
                <div id="corteCategoriasSeleccion">${renderCategorias(seleccion)}</div>
            </div>

            ${renderObservacionesCorte()}
            ${renderMovimientos(resumen)}
            ${renderHistorial()}
        `;
        recalcularSeleccionCorte();
        const seleccionCortes = resumenCortesSeleccionados();
        if (seleccionCortes.cortes.length > 0) {
            pintarKpisCorte({
                ingresos: seleccionCortes.ingresos,
                egresos: seleccionCortes.egresos,
                saldoFinalSistema: seleccionCortes.saldoFinalSistema,
                subIngresos: `${seleccionCortes.cortes.length} corte(s) seleccionados`,
                subEgresos: 'Egresos de cortes seleccionados',
                subSaldo: 'Ingresos menos egresos seleccionados'
            });
        }
    };

    window.toggleMovimientoCorte = function(input) {
        const id = input?.dataset?.id;
        if (!id || !window._corteCajaSeleccion) return;
        limpiarSeleccionCortesRecientes();

        if (input.checked) window._corteCajaSeleccion.ids.add(id);
        else window._corteCajaSeleccion.ids.delete(id);

        const row = input.closest('tr');
        if (row) row.style.background = input.checked ? '#f8fafc' : '#ffffff';
        recalcularSeleccionCorte();
    };

    window.marcarTodosMovimientosCorte = function(marcar) {
        const resumen = window._corteCajaResumen || calcularResumen();
        limpiarSeleccionCortesRecientes();
        if (!window._corteCajaSeleccion) resetSeleccionCorte(resumen, false);
        window._corteCajaSeleccion.ids = marcar
            ? new Set(resumen.movimientos.map(m => m._corteId))
            : new Set();

        document.querySelectorAll('.corte-mov-check').forEach(input => {
            input.checked = marcar;
            const row = input.closest('tr');
            if (row) row.style.background = marcar ? '#f8fafc' : '#ffffff';
        });
        recalcularSeleccionCorte();
    };

    function limpiarSeleccionCortesRecientes() {
        if (window._corteCajaCortesSeleccionados?.size) {
            window._corteCajaCortesSeleccionados.clear();
            document.querySelectorAll('.corte-reciente-check').forEach(input => input.checked = false);
        }
    }

    function pintarKpisCorte({ ingresos, egresos, saldoFinalSistema, subIngresos, subEgresos, subSaldo }) {
        const ingresoEl = document.getElementById('corteKpiIngresos');
        const egresoEl = document.getElementById('corteKpiEgresos');
        const saldoEl = document.getElementById('corteKpiSaldoSistema');
        const subIng = document.getElementById('corteSubIngresos');
        const subEgr = document.getElementById('corteSubEgresos');
        const subSaldoEl = document.getElementById('corteSubSaldoSistema');

        if (ingresoEl) ingresoEl.textContent = dinero(ingresos);
        if (egresoEl) egresoEl.textContent = dinero(egresos);
        if (saldoEl) saldoEl.textContent = dinero(saldoFinalSistema);
        if (subIng) subIng.textContent = subIngresos || '';
        if (subEgr) subEgr.textContent = subEgresos || '';
        if (subSaldoEl) subSaldoEl.textContent = subSaldo || '';
    }

    window.toggleCorteRecienteResumen = function(input) {
        const folio = input?.dataset?.folio;
        if (!folio) return;
        if (!window._corteCajaCortesSeleccionados) window._corteCajaCortesSeleccionados = new Set();

        if (input.checked) window._corteCajaCortesSeleccionados.add(String(folio));
        else window._corteCajaCortesSeleccionados.delete(String(folio));

        const seleccionCortes = resumenCortesSeleccionados();
        if (seleccionCortes.cortes.length > 0) {
            pintarKpisCorte({
                ingresos: seleccionCortes.ingresos,
                egresos: seleccionCortes.egresos,
                saldoFinalSistema: seleccionCortes.saldoFinalSistema,
                subIngresos: `${seleccionCortes.cortes.length} corte(s) seleccionados`,
                subEgresos: 'Egresos de cortes seleccionados',
                subSaldo: 'Ingresos menos egresos seleccionados'
            });
            return;
        }

        recalcularSeleccionCorte();
    };

    window.guardarSaldoInicialManualCuenta = function() {
        const input = document.getElementById('corteSaldoInicialManual');
        const cuentaId = document.getElementById('corteCuenta')?.value || obtenerUbicacionFijaCorte();
        if (!input || !cuentaId) return;
        
        const valor = input.value !== '' ? Number(input.value) : null;
        
        if (!window._saldosInicialesManuales) {
            window._saldosInicialesManuales = {};
        }
        
        if (valor !== null) {
            window._saldosInicialesManuales[cuentaId] = valor;
        } else {
            delete window._saldosInicialesManuales[cuentaId];
        }
        
        // Guardar en localStorage para persistencia
        try {
            localStorage.setItem('saldosInicialesManualesCorte', JSON.stringify(window._saldosInicialesManuales));
        } catch (e) {
            console.warn('No se pudo guardar saldos iniciales en localStorage:', e);
        }
    };

    window.recalcularSeleccionCorte = function() {
        const resumen = window._corteCajaResumen || calcularResumen();
        const seleccion = resumenSeleccionado(resumen);

        const estado = document.getElementById('corteEstadoSeleccion');
        const cats = document.getElementById('corteCategoriasSeleccion');
        const inputReal = document.getElementById('corteTotalReal');

        const saldoInicialEl = document.getElementById('corteKpiSaldoInicial');
        const subSaldoInicialEl = document.getElementById('corteSubSaldoInicial');
        if (saldoInicialEl) saldoInicialEl.textContent = dinero(seleccion.saldoInicial);
        if (subSaldoInicialEl) subSaldoInicialEl.textContent = seleccion.saldoInicialManual !== null ? 'Manual' : (seleccion.saldoInicialOrigen === 'heredado' ? 'Heredado del corte anterior' : 'Calculado (primer corte de esta cuenta)');

        pintarKpisCorte({
            ingresos: seleccion.ingresos,
            egresos: seleccion.egresos,
            saldoFinalSistema: seleccion.saldoFinalSistema,
            subIngresos: `${seleccion.movimientos.filter(m => m._tipo === 'ingreso').length} movimientos`,
            subEgresos: `${seleccion.movimientos.filter(m => m._tipo !== 'ingreso').length} movimientos`,
            subSaldo: `${seleccion.movimientos.length} de ${seleccion.totalMovimientos} movimientos`
        });
        if (estado) estado.textContent = `${seleccion.movimientos.length} movimientos marcados. Los no marcados quedan fuera de este corte.`;
        if (cats) cats.innerHTML = renderCategorias(seleccion);
        if (inputReal && inputReal.value === '') inputReal.placeholder = Number(seleccion.saldoFinalSistema || 0).toFixed(2);

        window._corteCajaResumenSeleccionado = seleccion;
        recalcularConteoCorte();
    };

    window.recalcularConteoCorte = function() {
        const resumen = window._corteCajaResumen || calcularResumen();
        const seleccion = window._corteCajaResumenSeleccionado || resumenSeleccionado(resumen);
        const totalDenoms = Array.from(document.querySelectorAll('[data-denom]')).reduce((sum, input) => {
            const denom = Number(input.dataset.denom || 0);
            const cantidad = Math.max(0, Number(input.value || 0));
            return sum + denom * cantidad;
        }, 0);

        const inputReal = document.getElementById('corteTotalReal');
        const totalReal = inputReal && inputReal.value !== '' ? Number(inputReal.value || 0) : Number(seleccion.saldoFinalSistema || 0);
        const diferencia = inputReal ? totalReal - Number(seleccion.saldoFinalSistema || 0) : 0;

        const denomsEl = document.getElementById('corteTotalDenominaciones');
        const difEl = document.getElementById('corteDiferencia');
        const difBox = document.getElementById('corteDiferenciaBox');
        if (denomsEl) denomsEl.value = dinero(totalDenoms);
        if (difEl) difEl.textContent = dinero(diferencia);
        if (difBox) {
            const ok = Math.abs(diferencia) <= 0.01;
            difBox.style.background = ok ? '#f0fdf4' : '#fff7ed';
            difBox.style.borderColor = ok ? '#bbf7d0' : '#fed7aa';
            difEl.style.color = ok ? '#15803d' : '#c2410c';
        }

        window._corteCajaConteo = { totalDenoms, totalReal, diferencia };
    };

    function armarCorteDesdePantalla() {
        recalcularConteoCorte();
        const resumen = window._corteCajaResumen || calcularResumen();
        const seleccion = window._corteCajaResumenSeleccionado || resumenSeleccionado(resumen);
        const conteo = window._corteCajaConteo || { totalDenoms: 0, totalReal: 0, diferencia: 0 };
        const denominaciones = Array.from(document.querySelectorAll('[data-denom]'))
            .map(input => ({ denominacion: Number(input.dataset.denom), cantidad: Number(input.value || 0) }))
            .filter(d => d.cantidad > 0);
        const usuario = document.getElementById('nombreUsuarioActivo')?.textContent?.trim() || 'Usuario';
        const folio = window.generarFolioSistema ? window.generarFolioSistema("CORTE") : `CORTE-${fechaKey(new Date()).replace(/-/g, '')}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

        return {
            folio,
            fechaCreacion: localIso(new Date()),
            usuario,
            cuentaId: resumen.cuenta.id,
            cuentaNombre: resumen.cuenta.nombre,
            fechaInicio: resumen.filtros.fechaInicio,
            fechaFin: resumen.filtros.fechaFin,
            saldoInicial: Number(seleccion.saldoInicial.toFixed(2)),
            saldoInicialManual: seleccion.saldoInicialManual !== null ? Number(seleccion.saldoInicialManual.toFixed(2)) : null,
            ingresos: Number(seleccion.ingresos.toFixed(2)),
            egresos: Number(seleccion.egresos.toFixed(2)),
            saldoFinalSistema: Number(seleccion.saldoFinalSistema.toFixed(2)),
            totalDenominaciones: Number(conteo.totalDenoms.toFixed(2)),
            totalReal: Number(conteo.totalReal.toFixed(2)),
            diferencia: Number(conteo.diferencia.toFixed(2)),
            movimientosMarcados: seleccion.movimientos.length,
            movimientosDisponibles: seleccion.totalMovimientos,
            movimientosExcluidos: Math.max(0, seleccion.totalMovimientos - seleccion.movimientos.length),
            observaciones: document.getElementById('corteObservaciones')?.value.trim() || '',
            denominaciones,
            resumenCategorias: seleccion.porCategoria,
            movimientos: seleccion.movimientos.map(movimientoParaCorte)
        };
    }

    window.guardarCorteCaja = function() {
        if (window.AuditService?.requireAdmin) {
            if (!window.AuditService.requireAdmin('guardar corte de caja')) return;
        } else {
            const sesion = (() => { try { return JSON.parse(sessionStorage.getItem('sesionActiva') || 'null'); } catch { return null; } })();
            if (!sesion || sesion.rol !== 'admin') return alert('Operacion restringida. Solo un administrador puede guardar cortes.');
        }

        const corte = armarCorteDesdePantalla();
        const cortesRaw = StorageService.get('cortesCaja', []);
        const cortes = Array.isArray(cortesRaw) ? cortesRaw : [];
        const duplicado = cortes.some(c =>
            c.cuentaId === corte.cuentaId &&
            c.fechaInicio === corte.fechaInicio &&
            c.fechaFin === corte.fechaFin
        );

        if (duplicado && !confirm('Ya existe un corte para esta cuenta y periodo. Deseas guardar otro?')) return;
        if (Math.abs(corte.diferencia) > 0.01 && !confirm(`La diferencia es ${dinero(corte.diferencia)}. Deseas guardar el corte con diferencia?`)) return;

        cortes.push(corte);
        StorageService.set('cortesCaja', cortes);
        window.AuditService?.log?.({
            accion: 'CORTE_CAJA_GUARDADO',
            modulo: 'Corte Caja',
            entidad: corte.folio,
            entidadId: corte.folio,
            detalle: `Corte guardado para ${corte.cuentaNombre || corte.cuentaId || 'cuenta'} del ${corte.fechaInicio || '-'} al ${corte.fechaFin || '-'}. Diferencia: ${dinero(corte.diferencia || 0)}`,
            monto: corte.totalReal,
            severidad: Math.abs(Number(corte.diferencia || 0)) > 0.01 ? 'alerta' : 'info',
            datos: {
                cuentaId: corte.cuentaId,
                fechaInicio: corte.fechaInicio,
                fechaFin: corte.fechaFin,
                ingresos: corte.ingresos,
                egresos: corte.egresos,
                saldoFinalSistema: corte.saldoFinalSistema,
                totalReal: corte.totalReal,
                diferencia: corte.diferencia,
                movimientosMarcados: corte.movimientosMarcados
            }
        });
        
        // El saldo final de este corte se fija de inmediato como el nuevo saldo inicial de esta
        // cuenta/ubicación (unico disparador junto con la edición manual que puede moverlo).
        persistirSaldoInicialManual(corte.cuentaId, corte.saldoFinalSistema);

        alert(`Corte guardado: ${corte.folio}\n\nEl saldo final de ${dinero(corte.saldoFinalSistema)} se ha fijado como nuevo saldo inicial para ${corte.cuentaNombre || 'esta cuenta'}.`);
        renderCorteCaja();
        imprimirCorteGuardado(corte.folio);
    };

    function recalcularCorteGuardado(corte) {
        const movimientos = Array.isArray(corte.movimientos) ? corte.movimientos : [];
        const ingresos = movimientos
            .filter(m => String(m.tipo || '').toLowerCase() === 'ingreso')
            .reduce((s, m) => s + Number(m.monto || 0), 0);
        const egresos = movimientos
            .filter(m => String(m.tipo || '').toLowerCase() !== 'ingreso')
            .reduce((s, m) => s + Number(m.monto || 0), 0);
        const porCategoria = {};

        movimientos.forEach(m => {
            const categoria = categoriaMovimiento(m);
            if (!porCategoria[categoria]) {
                porCategoria[categoria] = { categoria, ingresos: 0, egresos: 0, movimientos: 0 };
            }
            porCategoria[categoria].movimientos += 1;
            if (String(m.tipo || '').toLowerCase() === 'ingreso') porCategoria[categoria].ingresos += Number(m.monto || 0);
            else porCategoria[categoria].egresos += Number(m.monto || 0);
        });

        corte.ingresos = Number(ingresos.toFixed(2));
        corte.egresos = Number(egresos.toFixed(2));
        corte.saldoFinalSistema = Number((ingresos - egresos).toFixed(2));
        corte.movimientosMarcados = movimientos.length;
        corte.movimientosDisponibles = Math.max(Number(corte.movimientosDisponibles || 0), movimientos.length);
        corte.movimientosExcluidos = Math.max(0, Number(corte.movimientosDisponibles) - movimientos.length);
        corte.resumenCategorias = Object.values(porCategoria)
            .sort((a, b) => (b.ingresos + b.egresos) - (a.ingresos + a.egresos));
        corte.diferencia = Number((Number(corte.totalReal || 0) - Number(corte.saldoFinalSistema || 0)).toFixed(2));
        return corte;
    }

    function reclasificarCortesGuardados() {
        const cortesRaw = StorageService.get('cortesCaja', []);
        const cortes = Array.isArray(cortesRaw) ? cortesRaw : [];
        let cambio = false;
        cortes.forEach(corte => {
            const antes = JSON.stringify(corte.resumenCategorias || []);
            recalcularCorteGuardado(corte);
            if (antes !== JSON.stringify(corte.resumenCategorias || [])) cambio = true;
        });
        if (cambio) StorageService.set('cortesCaja', cortes);
        return cortes;
    }

    function movimientosDisponiblesParaCorte(corte) {
        const cuentas = obtenerCuentasCorte();
        const cuenta = String(corte.cuentaId || '') === 'todas'
            ? { id: 'todas', aliases: [] }
            : cuentas.find(c => String(c.id) === String(corte.cuentaId)) || {
                id: corte.cuentaId || '',
                aliases: [corte.cuentaId, corte.cuentaNombre].filter(Boolean)
            };
        const inicio = parseFechaLocal(corte.fechaInicio, false);
        const fin = parseFechaLocal(corte.fechaFin, true);
        const cortados = idsMovimientosYaCortados();
        const raw = StorageService.get('movimientosCaja', []);

        return (Array.isArray(raw) ? raw : [])
            .map((m, index) => {
                const fecha = parseFechaLocal(m.fecha || m.fechaISO || m.createdAt);
                return {
                    ...m,
                    _idx: index,
                    _corteId: idMovimientoCorte(m, index),
                    _fechaObj: fecha,
                    _tipo: tipoNormalizado(m),
                    _categoria: categoriaMovimiento(m),
                    _monto: Number(m.monto || 0),
                    _dentroPeriodo: fecha >= inicio && fecha <= fin,
                    _mismaCuenta: coincideCuenta(m, cuenta)
                };
            })
            .filter(m => m._monto > 0)
            .filter(m => !cortados.has(String(m._corteId)) && !cortados.has(String(m.id || '')))
            .filter(m => cuenta.id === 'todas' || m._mismaCuenta)
            .sort((a, b) =>
                Number(b._dentroPeriodo) - Number(a._dentroPeriodo) ||
                b._fechaObj - a._fechaObj
            );
    }

    function movimientoParaCorte(m) {
        const base = {
            corteId: m._corteId,
            id: m.id || m._idx,
            fecha: m.fecha || m.fechaISO || m.createdAt,
            tipo: m._tipo,
            concepto: m.concepto || '',
            cuenta: m.cuenta || m.cuentaId || '',
            monto: m._monto
        };
        // Los campos de referencia/medio de pago/transferencia solo se guardan si traen algo:
        // en la mayoría de los movimientos van vacíos, y repetir 4-7 campos vacíos en cada uno
        // de los cientos de movimientos de un corte es puro peso muerto contra el límite de
        // tamaño por documento de Firestore.
        if (m.referencia) base.referencia = m.referencia;
        if (m.medioPago) base.medioPago = m.medioPago;
        if (m.tipoMovimiento) base.tipoMovimiento = m.tipoMovimiento;
        if (m.cuentaOrigen) base.cuentaOrigen = m.cuentaOrigen;
        if (m.cuentaDestino) base.cuentaDestino = m.cuentaDestino;
        if (m.cuentaOrigenNombre) base.cuentaOrigenNombre = m.cuentaOrigenNombre;
        if (m.cuentaDestinoNombre) base.cuentaDestinoNombre = m.cuentaDestinoNombre;
        return base;
    }

    window.abrirAgregarMovimientoACorte = function(folio) {
        const cortes = StorageService.get('cortesCaja', []);
        const corte = (Array.isArray(cortes) ? cortes : []).find(c => String(c.folio) === String(folio));
        if (!corte) return alert('No se encontro el corte solicitado.');

        const disponibles = movimientosDisponiblesParaCorte(corte);
        window._corteMovimientosAgregar = new Set();
        document.querySelector('[data-modal="agregar-movimiento-corte"]')?.remove();

        const filas = disponibles.map(m => {
            const alerta = !m._mismaCuenta
                ? '<span style="color:#b91c1c;font-weight:900;">Otra cuenta</span>'
                : (!m._dentroPeriodo ? '<span style="color:#b45309;font-weight:900;">Fuera del periodo</span>' : '<span style="color:#047857;font-weight:900;">Coincide</span>');
            return `<tr data-agregar-corte-row="${esc(m._corteId)}" data-busqueda="${esc(`${m.concepto || ''} ${m.referencia || ''} ${m.cuenta || m.cuentaId || ''} ${m.monto || ''}`.toLowerCase())}" style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:9px;text-align:center;"><input type="checkbox" data-id="${esc(m._corteId)}" onchange="toggleAgregarMovimientoACorte(this)" style="width:18px;height:18px;accent-color:#1e40af;"></td>
                <td style="padding:9px;white-space:nowrap;">${esc(window.formatearFechaMX ? window.formatearFechaMX(m.fecha || m.fechaISO || m.createdAt) : (m.fecha || '-'))}</td>
                <td style="padding:9px;"><b>${esc(m.concepto || '-')}</b>${m.referencia ? `<br><small style="color:#64748b;">${esc(m.referencia)}</small>` : ''}</td>
                <td style="padding:9px;">${esc(m.etiquetaCuenta || m.cuenta || m.cuentaId || '-')}<br><small>${alerta}</small></td>
                <td style="padding:9px;text-align:center;text-transform:uppercase;font-weight:900;color:${m._tipo === 'ingreso' ? '#15803d' : '#b91c1c'};">${esc(m._tipo)}</td>
                <td style="padding:9px;text-align:right;font-weight:900;">${dinero(m._monto)}</td>
            </tr>`;
        }).join('');

        document.body.insertAdjacentHTML('beforeend', `
            <div data-modal="agregar-movimiento-corte" style="position:fixed;inset:0;background:rgba(15,23,42,.78);z-index:11000;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:24px;">
                <div style="width:100%;max-width:1050px;background:white;border-radius:10px;padding:22px;box-shadow:0 24px 55px rgba(15,23,42,.3);">
                    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-bottom:14px;">
                        <div><h3 style="margin:0;color:#0f172a;">Agregar movimiento a ${esc(corte.folio)}</h3>
                        <p style="margin:5px 0 0;color:#64748b;font-size:13px;">Sólo aparecen movimientos de ${corte.cuentaId === 'todas' ? 'cualquier cuenta' : `<b>${esc(corte.cuentaNombre || corte.cuentaId)}</b>`} que no pertenecen a ningún otro corte.</p></div>
                        <button onclick="document.querySelector('[data-modal=&quot;agregar-movimiento-corte&quot;]')?.remove()" style="padding:9px 13px;border:0;border-radius:6px;background:#e2e8f0;color:#334155;font-weight:bold;cursor:pointer;">Cerrar</button>
                    </div>
                    <input id="buscarMovimientoAgregarCorte" oninput="filtrarMovimientosAgregarCorte()" placeholder="Buscar concepto, referencia, cuenta o importe..." style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:6px;box-sizing:border-box;margin-bottom:12px;">
                    <div style="overflow:auto;max-height:520px;border:1px solid #e2e8f0;border-radius:8px;">
                        <table style="width:100%;border-collapse:collapse;min-width:850px;font-size:12px;">
                            <thead style="position:sticky;top:0;background:#f8fafc;color:#475569;z-index:1;"><tr>
                                <th style="padding:9px;"></th><th style="padding:9px;text-align:left;">Fecha</th><th style="padding:9px;text-align:left;">Movimiento</th>
                                <th style="padding:9px;text-align:left;">Cuenta / compatibilidad</th><th style="padding:9px;text-align:center;">Tipo</th><th style="padding:9px;text-align:right;">Importe</th>
                            </tr></thead>
                            <tbody>${filas || '<tr><td colspan="6" style="padding:30px;text-align:center;color:#64748b;">No hay movimientos libres para agregar.</td></tr>'}</tbody>
                        </table>
                    </div>
                    <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;margin-top:14px;">
                        <div id="estadoAgregarMovimientoCorte" style="color:#64748b;font-size:13px;">0 movimientos seleccionados.</div>
                        <button onclick="confirmarAgregarMovimientosACorte('${escJs(corte.folio)}')" ${disponibles.length ? '' : 'disabled'} style="padding:11px 16px;border:0;border-radius:7px;background:${disponibles.length ? '#1e40af' : '#cbd5e1'};color:white;font-weight:900;cursor:${disponibles.length ? 'pointer' : 'not-allowed'};">Agregar al corte</button>
                    </div>
                </div>
            </div>`);
    };

    window.toggleAgregarMovimientoACorte = function(input) {
        const id = input?.dataset?.id;
        if (!id) return;
        if (!window._corteMovimientosAgregar) window._corteMovimientosAgregar = new Set();
        if (input.checked) window._corteMovimientosAgregar.add(id);
        else window._corteMovimientosAgregar.delete(id);
        const seleccionados = window._corteMovimientosAgregar.size;
        const estado = document.getElementById('estadoAgregarMovimientoCorte');
        if (estado) estado.textContent = `${seleccionados} movimiento(s) seleccionado(s).`;
    };

    window.filtrarMovimientosAgregarCorte = function() {
        const q = String(document.getElementById('buscarMovimientoAgregarCorte')?.value || '').trim().toLowerCase();
        document.querySelectorAll('[data-agregar-corte-row]').forEach(row => {
            row.style.display = !q || String(row.dataset.busqueda || '').includes(q) ? '' : 'none';
        });
    };

    window.confirmarAgregarMovimientosACorte = function(folio) {
        const ejecutar = () => {
            const ids = new Set(window._corteMovimientosAgregar || []);
            if (!ids.size) return alert('Selecciona al menos un movimiento.');
            const cortesRaw = StorageService.get('cortesCaja', []);
            const cortes = Array.isArray(cortesRaw) ? cortesRaw : [];
            const idxCorte = cortes.findIndex(c => String(c.folio) === String(folio));
            if (idxCorte < 0) return alert('No se encontro el corte solicitado.');
            const corte = cortes[idxCorte];
            const disponibles = movimientosDisponiblesParaCorte(corte);
            const elegidos = disponibles.filter(m => ids.has(String(m._corteId)));
            if (elegidos.length !== ids.size) return alert('Uno o más movimientos ya fueron utilizados en otro corte. Actualiza e intenta de nuevo.');

            const incompatibles = elegidos.filter(m => !m._mismaCuenta || !m._dentroPeriodo);
            if (incompatibles.length && !confirm(`${incompatibles.length} movimiento(s) no coincide(n) con la cuenta o periodo original del corte.\n\nSe conservarán su fecha y cuenta reales. ¿Deseas agregarlos de todos modos?`)) return;

            const totalIngresos = elegidos.filter(m => m._tipo === 'ingreso').reduce((s, m) => s + m._monto, 0);
            const totalEgresos = elegidos.filter(m => m._tipo !== 'ingreso').reduce((s, m) => s + m._monto, 0);
            if (!confirm(`Agregar ${elegidos.length} movimiento(s) al corte ${folio}?\n\nIngresos: ${dinero(totalIngresos)}\nEgresos: ${dinero(totalEgresos)}\n\nSe recalculará el saldo esperado y la diferencia del corte.`)) return;

            corte.movimientos = Array.isArray(corte.movimientos) ? corte.movimientos : [];
            corte.movimientos.push(...elegidos.map(movimientoParaCorte));
            corte.movimientosDisponibles = Math.max(Number(corte.movimientosDisponibles || 0), corte.movimientos.length);
            corte.modificaciones = Array.isArray(corte.modificaciones) ? corte.modificaciones : [];
            corte.modificaciones.push({
                fecha: localIso(new Date()),
                accion: 'AGREGAR_MOVIMIENTOS',
                usuario: document.getElementById('nombreUsuarioActivo')?.textContent?.trim() || 'Usuario',
                movimientos: elegidos.map(m => ({ corteId: m._corteId, referencia: m.referencia || '', monto: m._monto, tipo: m._tipo }))
            });
            cortes[idxCorte] = recalcularCorteGuardado(corte);
            StorageService.set('cortesCaja', cortes);
            window.AuditService?.log?.({
                accion: 'MOVIMIENTOS_AGREGADOS_A_CORTE',
                modulo: 'Corte Caja',
                entidad: 'Corte',
                entidadId: folio,
                detalle: `${elegidos.length} movimiento(s) agregados al corte ${folio}`,
                monto: totalIngresos - totalEgresos,
                severidad: 'alerta',
                datos: { movimientos: elegidos.map(movimientoParaCorte), ingresos: totalIngresos, egresos: totalEgresos }
            });
            document.querySelector('[data-modal="agregar-movimiento-corte"]')?.remove();
            alert(`${elegidos.length} movimiento(s) agregados. El corte fue recalculado.`);
            abrirDetalleCorteCaja(folio);
            renderCorteCaja();
        };

        if (window.AuditService?.requireAdmin) {
            if (!window.AuditService.requireAdmin('agregar movimiento a corte de caja')) return;
            ejecutar();
            return;
        }
        const sesion = (() => { try { return JSON.parse(sessionStorage.getItem('sesionActiva') || 'null'); } catch { return null; } })();
        if (!sesion || sesion.rol !== 'admin') return alert('Operacion restringida. Solo un administrador puede modificar cortes guardados.');
        ejecutar();
    };

    window.sacarMovimientoDeCorteCaja = function(folio, indexMovimiento) {
        if (window.AuditService?.requireAdmin) {
            if (!window.AuditService.requireAdmin('sacar movimiento de corte de caja')) return;
        } else {
            const sesion = (() => { try { return JSON.parse(sessionStorage.getItem('sesionActiva') || 'null'); } catch { return null; } })();
            if (!sesion || sesion.rol !== 'admin') return alert('Operacion restringida. Solo un administrador puede modificar cortes guardados.');
        }

        const cortesRaw = StorageService.get('cortesCaja', []);
        const cortes = Array.isArray(cortesRaw) ? cortesRaw : [];
        const idxCorte = cortes.findIndex(c => String(c.folio) === String(folio));
        if (idxCorte === -1) return alert('No se encontro el corte solicitado.');

        const corte = cortes[idxCorte];
        const movimientos = Array.isArray(corte.movimientos) ? corte.movimientos : [];
        const idx = Number(indexMovimiento);
        if (idx < 0 || idx >= movimientos.length) return alert('No se encontro el movimiento dentro del corte.');

        const mov = movimientos[idx];
        const resumen = `${mov.fecha || '-'}\n${mov.concepto || '-'}\n${mov.referencia || ''}\n${dinero(mov.monto)}`;
        if (!confirm(`Sacar este movimiento del corte ${folio}?\n\n${resumen}\n\nEl movimiento real de caja NO se elimina; solo quedara disponible para otro corte.`)) return;

        const retirado = movimientos.splice(idx, 1)[0];
        corte.movimientos = movimientos;
        cortes[idxCorte] = recalcularCorteGuardado(corte);
        StorageService.set('cortesCaja', cortes);

        window.AuditService?.log?.({
            accion: 'MOVIMIENTO_RETIRADO_DE_CORTE',
            modulo: 'Corte Caja',
            entidad: 'Corte',
            entidadId: folio,
            detalle: `Movimiento retirado del corte ${folio}: ${retirado.referencia || retirado.concepto || '-'}`,
            monto: Number(retirado.monto || 0),
            severidad: 'alerta',
            datos: { movimiento: retirado }
        });

        alert('Movimiento retirado del corte. Ya puede entrar en otro corte.');
        abrirDetalleCorteCaja(folio);
        renderCorteCaja();
    };

    window.sacarMovimientosDeCortePorReferencia = function(folio, referencias = []) {
        const refs = Array.isArray(referencias) ? referencias.map(String) : [String(referencias)];
        const cortesRaw = StorageService.get('cortesCaja', []);
        const cortes = Array.isArray(cortesRaw) ? cortesRaw : [];
        const idxCorte = cortes.findIndex(c => String(c.folio) === String(folio));
        if (idxCorte === -1) return alert('No se encontro el corte solicitado.');
        const corte = cortes[idxCorte];
        const antes = Array.isArray(corte.movimientos) ? corte.movimientos : [];
        const retirados = [];
        corte.movimientos = antes.filter(m => {
            const coincide = refs.includes(String(m.referencia || ''));
            if (coincide) retirados.push(m);
            return !coincide;
        });
        if (!retirados.length) return alert('No se encontraron esas referencias en el corte.');
        cortes[idxCorte] = recalcularCorteGuardado(corte);
        StorageService.set('cortesCaja', cortes);
        alert(`Se retiraron ${retirados.length} movimiento(s) del corte ${folio}.`);
        abrirDetalleCorteCaja(folio);
        renderCorteCaja();
    };

    window.abrirDetalleCorteCaja = function(folio) {
        const cortes = reclasificarCortesGuardados();
        const corte = (Array.isArray(cortes) ? cortes : []).find(c => String(c.folio) === String(folio));
        if (!corte) return alert('No se encontro el corte solicitado.');

        document.querySelector('[data-modal="detalle-corte-caja"]')?.remove();

        const movimientos = Array.isArray(corte.movimientos) ? corte.movimientos : [];
        const ingresos = movimientos.filter(m => String(m.tipo || '').toLowerCase() === 'ingreso');
        const egresos = movimientos.filter(m => String(m.tipo || '').toLowerCase() !== 'ingreso');
        const totalIngresos = ingresos.reduce((s, m) => s + Number(m.monto || 0), 0);
        const totalEgresos = egresos.reduce((s, m) => s + Number(m.monto || 0), 0);

        const row = (m, color, index) => `
            <tr>
                <td style="padding:8px;border-bottom:1px solid #e5e7eb;white-space:nowrap;">${esc(window.formatearFechaMX ? window.formatearFechaMX(m.fecha) : (m.fecha || '-'))}</td>
                <td style="padding:8px;border-bottom:1px solid #e5e7eb;">
                    <b>${esc(m.concepto || '-')}</b>
                    ${m.referencia ? `<br><small style="color:#94a3b8;">${esc(m.referencia)}</small>` : ''}
                </td>
                <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${esc(m.cuenta || '-')}</td>
                <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:900;color:${color};">${dinero(m.monto)}</td>
                <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">
                    <button onclick="sacarMovimientoDeCorteCaja('${escJs(corte.folio)}', ${index})" style="padding:6px 9px;background:#b91c1c;color:white;border:0;border-radius:6px;cursor:pointer;font-weight:800;font-size:11px;">Sacar</button>
                </td>
            </tr>`;

        const tabla = (titulo, items, total, color, vacio) => `
            <div style="background:white;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
                    <h4 style="margin:0;color:#0f172a;">${esc(titulo)}</h4>
                    <strong style="color:${color};">${dinero(total)}</strong>
                </div>
                <div style="overflow-x:auto;max-height:330px;overflow-y:auto;">
                    <table style="width:100%;border-collapse:collapse;font-size:12px;">
                        <thead style="position:sticky;top:0;background:#ffffff;color:#475569;">
                            <tr>
                                <th style="padding:8px;text-align:left;">Fecha</th>
                                <th style="padding:8px;text-align:left;">Movimiento</th>
                                <th style="padding:8px;text-align:left;">Cuenta</th>
                                <th style="padding:8px;text-align:right;">Monto</th>
                                <th style="padding:8px;text-align:right;">Accion</th>
                            </tr>
                        </thead>
                        <tbody>${items.map(m => row(m, color, movimientos.indexOf(m))).join('') || `<tr><td colspan="5" style="padding:20px;text-align:center;color:#94a3b8;">${esc(vacio)}</td></tr>`}</tbody>
                    </table>
                </div>
            </div>`;

        const html = `
            <div data-modal="detalle-corte-caja" style="position:fixed;inset:0;background:rgba(15,23,42,0.82);z-index:10000;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:24px;">
                <div style="background:#f8fafc;width:100%;max-width:1100px;border-radius:12px;padding:22px;box-shadow:0 20px 45px rgba(0,0,0,0.25);">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:16px;">
                        <div>
                            <h3 style="margin:0;color:#0f172a;">Detalle del corte ${esc(corte.folio)}</h3>
                            <p style="margin:4px 0 0;color:#64748b;font-size:13px;">${esc(corte.cuentaNombre || '-')} | ${esc(corte.fechaInicio || '-')} a ${esc(corte.fechaFin || '-')}</p>
                        </div>
                        <div style="display:flex;gap:8px;flex-wrap:wrap;">
                            <button onclick="abrirAgregarMovimientoACorte('${escJs(corte.folio)}')" style="padding:9px 14px;background:#1e40af;color:white;border:0;border-radius:6px;cursor:pointer;font-weight:900;">+ Agregar movimiento</button>
                            <button onclick="document.querySelector('[data-modal=&quot;detalle-corte-caja&quot;]')?.remove()" style="padding:9px 14px;background:#e2e8f0;color:#334155;border:0;border-radius:6px;cursor:pointer;font-weight:800;">Cerrar</button>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-bottom:16px;">
                        ${renderKpi('Ingresos', totalIngresos, '#15803d', `${ingresos.length} movimientos`)}
                        ${renderKpi('Egresos', totalEgresos, '#b91c1c', `${egresos.length} movimientos`)}
                        ${renderKpi('Monto identificado', Number(corte.saldoFinalSistema || 0), '#1e40af', `${movimientos.length} movimientos conciliados`)}
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:16px;align-items:start;">
                        ${tabla('Ingresos conciliados', ingresos, totalIngresos, '#15803d', 'Sin ingresos en este corte.')}
                        ${tabla('Egresos conciliados', egresos, totalEgresos, '#b91c1c', 'Sin egresos en este corte.')}
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', html);
    };

    function htmlCorte(corte) {
        const cats = (corte.resumenCategorias || []).map(c => `
            <tr>
                <td style="padding:5px;border-bottom:1px solid #ddd;">${esc(c.categoria)}</td>
                <td style="padding:5px;text-align:right;border-bottom:1px solid #ddd;">${dinero(c.ingresos)}</td>
                <td style="padding:5px;text-align:right;border-bottom:1px solid #ddd;">${dinero(c.egresos)}</td>
            </tr>`).join('');
        return `
            <div id="ticket-contenido" style="font-family:Arial,sans-serif;max-width:780px;margin:0 auto;color:#111827;">
                <h2 style="text-align:center;margin:0 0 4px;">Muebleria Mi Pueblito</h2>
                <h3 style="text-align:center;margin:0 0 16px;">Corte de Caja</h3>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;margin-bottom:14px;">
                    <div><b>Folio:</b> ${esc(corte.folio)}</div>
                    <div><b>Usuario:</b> ${esc(corte.usuario)}</div>
                    <div><b>Cuenta:</b> ${esc(corte.cuentaNombre)}</div>
                    <div><b>Creado:</b> ${esc(window.formatearFechaMX ? window.formatearFechaMX(corte.fechaCreacion) : corte.fechaCreacion)}</div>
                    <div><b>Desde:</b> ${esc(corte.fechaInicio)}</div>
                    <div><b>Hasta:</b> ${esc(corte.fechaFin)}</div>
                    <div><b>Movimientos marcados:</b> ${Number(corte.movimientosMarcados ?? corte.movimientos?.length ?? 0)} de ${Number(corte.movimientosDisponibles ?? corte.movimientos?.length ?? 0)}</div>
                    <div><b>Excluidos:</b> ${Number(corte.movimientosExcluidos || 0)}</div>
                </div>
                <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:14px;">
                    <tbody>
                        <tr><td style="padding:6px;border:1px solid #ddd;">Ingresos</td><td style="padding:6px;border:1px solid #ddd;text-align:right;color:#15803d;">${dinero(corte.ingresos)}</td></tr>
                        <tr><td style="padding:6px;border:1px solid #ddd;">Egresos</td><td style="padding:6px;border:1px solid #ddd;text-align:right;color:#b91c1c;">${dinero(corte.egresos)}</td></tr>
                        <tr><td style="padding:6px;border:1px solid #ddd;"><b>Monto identificado</b></td><td style="padding:6px;border:1px solid #ddd;text-align:right;"><b>${dinero(corte.saldoFinalSistema)}</b></td></tr>
                    </tbody>
                </table>
                <h4 style="margin:10px 0 6px;">Resumen por origen</h4>
                <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px;">
                    <thead><tr><th style="text-align:left;padding:5px;border-bottom:1px solid #ddd;">Origen</th><th style="text-align:right;padding:5px;border-bottom:1px solid #ddd;">Ingresos</th><th style="text-align:right;padding:5px;border-bottom:1px solid #ddd;">Egresos</th></tr></thead>
                    <tbody>${cats || '<tr><td colspan="3" style="padding:8px;text-align:center;">Sin movimientos</td></tr>'}</tbody>
                </table>
                ${corte.observaciones ? `<p style="font-size:12px;"><b>Observaciones:</b> ${esc(corte.observaciones)}</p>` : ''}
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:45px;font-size:12px;text-align:center;">
                    <div style="border-top:1px solid #111;padding-top:8px;">Entrega caja</div>
                    <div style="border-top:1px solid #111;padding-top:8px;">Recibe / autoriza</div>
                </div>
            </div>`;
    }

    function abrirHtmlCorte(corte) {
        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${esc(corte.folio)}</title></head><body>${htmlCorte(corte)}</body></html>`;
        if (window.TicketService?.elegirFormato) {
            window.TicketService.elegirFormato({
                html,
                title: `Corte de Caja ${corte.folio}`,
                filename: `corte_${corte.folio}`,
                source: 'document',
                pageSize: 'letter'
            });
            return;
        }
        if (window.TicketService?.openDocument) {
            window.TicketService.openDocument(html, { title: corte.folio, filename: `corte_${corte.folio}`, pageSize: 'letter' });
            return;
        }
        const w = window.open('', '_blank');
        if (!w) return alert('Habilita ventanas emergentes para imprimir el corte.');
        w.document.write(html);
        w.document.close();
        w.focus();
    }

    window.imprimirCorteActual = function() {
        abrirHtmlCorte(armarCorteDesdePantalla());
    };

    window.imprimirCorteGuardado = function(folio) {
        const cortes = reclasificarCortesGuardados();
        const corte = (Array.isArray(cortes) ? cortes : []).find(c => String(c.folio) === String(folio));
        if (!corte) return alert('No se encontro el corte solicitado.');
        window.AuditService?.log?.({
            accion: 'CORTE_CAJA_REIMPRESO',
            modulo: 'Corte Caja',
            entidad: corte.folio,
            entidadId: corte.folio,
            detalle: `Consulta/impresion de corte guardado ${corte.folio}`,
            severidad: 'info'
        });
        abrirHtmlCorte(corte);
    };

    window.exportarCorteCajaCSV = function() {
        const resumen = window._corteCajaResumen || calcularResumen();
        const ids = window._corteCajaSeleccion?.ids || new Set();
        const rows = [
            ['Marcado', 'Fecha', 'Tipo', 'Cuenta', 'Concepto', 'Referencia', 'Monto'],
            ...resumen.movimientos.map(m => [
                ids.has(m._corteId) ? 'SI' : 'NO',
                window.formatearFechaMX ? window.formatearFechaMX(m.fecha || m.fechaISO || m.createdAt) : fechaKey(m._fechaObj),
                m._tipo,
                m.etiquetaCuenta || m.cuenta || '',
                m.concepto || '',
                m.referencia || '',
                Number(m._monto || 0).toFixed(2)
            ])
        ];
        const csv = rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `corte-caja-${resumen.filtros.fechaInicio}-${resumen.filtros.fechaFin}.csv`;
        a.click();
        window.AuditService?.log?.({
            accion: 'CORTE_CAJA_EXPORTADO_CSV',
            modulo: 'Corte Caja',
            entidad: `${resumen.filtros.fechaInicio}_${resumen.filtros.fechaFin}`,
            detalle: `Exportacion CSV de corte. Movimientos: ${resumen.movimientos.length}`,
            severidad: 'riesgo',
            datos: {
                cuentaId: resumen.cuenta?.id || '',
                fechaInicio: resumen.filtros.fechaInicio,
                fechaFin: resumen.filtros.fechaFin,
                movimientos: resumen.movimientos.length
            }
        });
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
})();
