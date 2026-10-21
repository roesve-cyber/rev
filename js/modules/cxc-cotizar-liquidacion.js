// =====================================================================
// 🧮 COTIZAR LIQUIDACIÓN ANTICIPADA
// ---------------------------------------------------------------------
// Responde en el mostrador "¿cuánto me queda si liquido en N meses?".
// Se elige al cliente, luego su cuenta (si tiene varias) y un plazo.
//
// Dos regímenes, según la fecha de la VENTA (no la de hoy) contra la
// "fecha de inicio de cupones" (se configura una vez):
//
//  · Venta ANTERIOR a cupones → rige la escalera mes-a-mes con las
//    tarifas que tenía la tienda en ESA venta: la tabla `saldosPorMes`
//    congelada en la cuenta (NUNCA las tasas de hoy). Importe restante =
//    total del plazo elegido − lo ya cubierto. Sin cupón.
//  · Venta POSTERIOR a cupones → rige la regla vigente (la misma función
//    que usa Cobranza al cobrar): paga el saldo nominal completo y recibe
//    un cupón. Liquidar antes NO descuenta; por eso el plazo es el pactado.
//
// Segundo modo, "Ampliar plazo": si el cliente quiere MÁS plazo, muestra cuánto
// queda (nuevo total, restante, pagos y monto por pago) y permite confirmar el
// cambio ahí mismo (solo admin). El cambio lo ejecuta _reestructuraEjecutar,
// la misma transacción atómica de "Reestructurar Plazo" (cancela los pagarés
// pendientes, genera los nuevos, deja historial y bitácora). Tarifa: venta
// ANTERIOR a cupones → escalera guardada en la cuenta; POSTERIOR → tarifa vigente
// (igual que Reestructurar Plazo).
//
// Ambos modos muestran lo que el cliente necesita para decidir (producto, fecha de venta,
// fecha límite del monto cotizado / nueva fecha límite de pago, comparativo contra su plan
// actual) y se pueden emitir en los formatos de la tienda (PDF / Ticket / Imagen) siempre con
// el logo del negocio. La emisión no escribe nada; solo lee.
//
// El modo "Liquidar antes" es solo lectura. Lo único que se guarda desde aquí,
// además del cambio de plazo confirmado, es la fecha de inicio de cupones (admin).
// =====================================================================
(function () {
    'use strict';

    const CFG_KEY = 'configCupones';
    const DIAS_MES = 30.44;

    // ── Utilidades ────────────────────────────────────────────────────
    const g = (nombre) => (typeof window[nombre] === 'function' ? window[nombre] : null);
    const leer = (t, d) => { try { const v = StorageService.get(t, d); return v === undefined || v === null ? d : v; } catch (e) { return d; } };
    const esc = (s) => String(s === undefined || s === null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const dinero = (n) => {
        const f = g('_cxcDinero');
        if (f) return f(n);
        return Number(n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
    };
    const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
    const noCancelada = (a) => !a.cancelado && !a.canceladoPorVenta && !a.canceladoPorApartado;

    function fechaVenta(cuenta) {
        const f = g('_cxcFechaVentaDate');
        if (f) { const d = f(cuenta); if (d && !isNaN(d.getTime())) return d; }
        const d = new Date(cuenta.fechaVenta || cuenta.fecha || 0);
        return isNaN(d.getTime()) ? new Date(0) : d;
    }
    function parseFecha(v) {
        if (!v) return null;
        const f = g('parseFechaMXOrNull') || g('parseFechaMX');
        let d = f ? f(v) : null;
        if (!d || isNaN(d.getTime())) d = new Date(v);
        return isNaN(d.getTime()) ? null : d;
    }
    const fmtFecha = (d) => (d && !isNaN(d.getTime())) ? d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
    const isoDia = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const PERIODOS = { semanal: 'semanales', quincenal: 'quincenales', mensual: 'mensuales' };

    // Producto(s) de la venta: es lo que identifica la compra ante el cliente (el folio queda como referencia).
    const productosCuenta = (cuenta) => (Array.isArray(cuenta.articulos) ? cuenta.articulos : [])
        .map((x) => ({ nombre: String(x.nombre || x.productoNombre || '').trim(), cantidad: Number(x.cantidad || 1) || 1 }))
        .filter((x) => x.nombre);
    const textoProductos = (lista, max) => {
        if (!lista.length) return 'Venta general';
        const t = lista.map((x) => x.nombre + (x.cantidad > 1 ? ' x' + x.cantidad : '')).join(', ');
        return max && t.length > max ? t.slice(0, max - 1) + '…' : t;
    };

    // ── Datos del negocio y logo ──────────────────────────────────────
    function datosEmpresa() {
        const cfg = leer('configEmpresa', {}) || {};
        return { nombre: cfg.nombre || 'Mueblería Mi Pueblito', direccion: cfg.direccion || '', telefono: cfg.telefono || '' };
    }
    // El logo se incrusta como data URI para que salga SIEMPRE igual en la ventana de impresión,
    // en el PDF y en la imagen (el service worker no guarda img/ para uso sin conexión).
    let LOGO_DATA = null, LOGO_PROMESA = null;
    function urlADataUri(url) {
        return fetch(url, { cache: 'force-cache' })
            .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); })
            .then((b) => new Promise((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = no; fr.readAsDataURL(b); }));
    }
    function cargarLogo() {
        if (LOGO_DATA) return Promise.resolve(LOGO_DATA);
        if (!LOGO_PROMESA) {
            const url = (f) => new URL(f, document.baseURI).href;
            LOGO_PROMESA = urlADataUri(url('img/Logo.png'))
                .catch(() => urlADataUri(url('img/Logo.svg')))
                .then((d) => { LOGO_DATA = d; return d; })
                .catch(() => { LOGO_PROMESA = null; return null; });
        }
        return LOGO_PROMESA;
    }

    // ── Fecha de inicio de cupones ────────────────────────────────────
    function fechaInicioCupones() {
        const cfg = leer(CFG_KEY, {});
        const f = cfg && cfg.fechaInicio ? new Date(cfg.fechaInicio + 'T00:00:00') : null;
        return f && !isNaN(f.getTime()) ? f : null;
    }
    // Sugerencia: primer abono que ya trae la marca `cuponEmitidoId` (se agregó con los cupones).
    function sugerirFechaInicio() {
        let min = null;
        leer('cuentasPorCobrar', []).forEach((c) => (c.abonos || []).forEach((a) => {
            if (!('cuponEmitidoId' in a)) return;
            const d = parseFecha(a.fecha);
            if (d && (!min || d < min)) min = d;
        }));
        return min;
    }

    // ── Escalera de la cuenta ─────────────────────────────────────────
    // Devuelve { planes:[{meses,total}], origen:'cuenta'|'actual'|null, sana, avisos:[] }
    function escalera(cuenta, capitalContado, periodicidad) {
        const avisos = [];
        const congelada = Array.isArray(cuenta.saldosPorMes) ? cuenta.saldosPorMes.map((p) => ({ meses: Number(p.meses), total: Number(p.total) })).filter((p) => p.meses > 0 && p.total > 0) : [];
        congelada.sort((a, b) => a.meses - b.meses);
        const sana = congelada.length > 0 && congelada.every((p, i, arr) => i === 0 || p.total >= arr[i - 1].total - 0.01);
        if (sana) return { planes: congelada, origen: 'cuenta', avisos };
        if (typeof CalculatorService !== 'undefined' && CalculatorService.calcularCreditoConPeriodicidad && capitalContado > 0) {
            avisos.push(congelada.length
                ? 'La escalera guardada en esta cuenta no es consistente; se estimó con las tarifas ACTUALES. Verifícalo antes de prometer el monto.'
                : 'Esta cuenta no tiene escalera propia guardada; se estimó con las tarifas ACTUALES. Verifícalo antes de prometer el monto.');
            const planes = CalculatorService.calcularCreditoConPeriodicidad(capitalContado, periodicidad || 'semanal')
                .map((p) => ({ meses: Number(p.meses), total: Number(p.total) })).sort((a, b) => a.meses - b.meses);
            return { planes, origen: 'actual', avisos };
        }
        return { planes: [], origen: null, avisos: ['No se pudo obtener la escalera de plazos de esta cuenta.'] };
    }

    // ── Análisis de una cuenta (todo en vivo, sin guardar nada) ───────
    function analizar(folio) {
        const cuenta = leer('cuentasPorCobrar', []).find((c) => c.folio === folio);
        if (!cuenta) return null;
        const estado = g('_calcularEstadoCuenta') ? g('_calcularEstadoCuenta')(folio) : null;
        const moratorios = Number(estado && estado.saldoMoratorios || 0);
        const saldoNominal = Math.max(0, Number((estado && estado.saldoTotal !== undefined) ? estado.saldoTotal : cuenta.saldoActual || 0) - moratorios);
        const enganche = Number(cuenta.engancheRecibido || cuenta.enganche || 0);
        const fImporte = g('_cxcImporteContadoCuenta');
        const contado = fImporte ? fImporte(cuenta) : Number(cuenta.totalContadoOriginal || cuenta.totalMercancia || 0);
        const capitalContado = Math.max(0, contado - enganche);
        const mesesPlan = Number((cuenta.plan && cuenta.plan.meses) || cuenta.plazoMeses || cuenta.meses || 0);
        const totalPlan = Number((cuenta.plan && cuenta.plan.total) || cuenta.saldoOriginal || 0);
        const periodicidad = cuenta.periodicidad || 'semanal';
        const fVenta = fechaVenta(cuenta);
        const dias = Math.max(0, Math.floor((new Date() - fVenta) / 86400000));
        const mesPostContado = Math.max(1, Math.floor(Math.max(0, dias - 30) / DIAS_MES) + 1); // mismo criterio que la escalera mes-a-mes
        const venceDias = mesesPlan * DIAS_MES;
        const enPlazo = mesesPlan > 0 ? dias < venceDias : false;
        const fVence = new Date(fVenta.getTime() + venceDias * 86400000);
        const fTotalPagado = g('_cxcTotalPagadoPolitica');
        const abonos = fTotalPagado ? fTotalPagado(folio, cuenta) : (cuenta.abonos || []).filter(noCancelada).reduce((s, a) => s + Number(a.monto || a.montoAbonado || 0), 0);
        // Lo "cubierto" según el saldo del sistema (incluye condonaciones/ajustes), para que la cotización cuadre con Cobranza
        const cubierto = totalPlan > 0 ? Math.max(0, totalPlan - saldoNominal) : abonos;
        const ajustes = r2(cubierto - abonos);
        const inicio = fechaInicioCupones();
        const posterior = !!inicio && fVenta >= inicio;
        const esc_ = escalera(cuenta, capitalContado, periodicidad);
        const pagaresPend = leer('pagaresSistema', []).filter((p) => p.folio === folio && (p.estado === 'Pendiente' || p.estado === 'Parcial'));
        const montoVencido = Number(estado && estado.montoVencido || 0);
        return { cuenta, folio, estado, moratorios, saldoNominal, enganche, contado, capitalContado, mesesPlan, totalPlan, periodicidad,
            fVenta, dias, mesPostContado, enPlazo, fVence, abonos, cubierto, ajustes, inicio, posterior, escalera: esc_,
            productos: productosCuenta(cuenta), pagaresPend, montoVencido };
    }

    // Plazos a los que puede aspirar HOY
    function plazosPosibles(a) {
        if (a.posterior) return a.mesesPlan > 0 ? [a.mesesPlan] : [];
        if (!a.enPlazo) return a.mesesPlan > 0 ? [a.mesesPlan] : [];
        return a.escalera.planes.filter((p) => p.meses >= a.mesPostContado && p.meses <= a.mesesPlan).map((p) => p.meses);
    }

    // Cotización para un plazo elegido
    function cotizar(a, meses) {
        const out = { meses, avisos: [].concat(a.escalera.avisos), cupon: null, mensaje: '' };
        if (a.saldoNominal <= 0.01) { out.liquidada = true; out.mensaje = 'La cuenta ya está liquidada.'; return out; }
        if (a.posterior) {
            // Regla vigente: misma función que usa Cobranza al cobrar
            const pol = g('_cxcEvaluarPoliticaPagoAnticipado') ? g('_cxcEvaluarPoliticaPagoAnticipado')(a.folio, a.saldoNominal) : null;
            const restante = pol ? Number(pol.montoLiquidacion) : a.saldoNominal;
            out.totalPlazo = a.totalPlan; out.restante = Math.min(restante, a.saldoNominal);
            out.totalFinal = a.enganche + a.totalPlan;
            if (pol && pol.tipo === 'contado_1_mes') out.mensaje = 'Plan de 1 mes: se cobra el precio de contado real; no genera cupón.';
            else if (!a.enPlazo) out.mensaje = 'Ya pasó su plazo pactado: se liquida con el saldo vigente y sin cupón.';
            if (pol && pol.aplica && Number(pol.beneficio) > 0.01) out.cupon = { monto: Number(pol.beneficio), pct: pol.porcentajeCupon };
            if (pol && pol.tipo !== 'contado_1_mes' && a.enPlazo) {
                out.mensaje = out.cupon
                    ? 'Con la regla de cupones, liquidar antes no baja el monto: paga el saldo completo y recibe un cupón.'
                    : 'Con la regla de cupones, liquidar antes no baja el monto: paga el saldo completo. Este plan no genera cupón.';
            }
            return out;
        }
        // Venta anterior a cupones: escalera congelada de la cuenta
        const plan = a.escalera.planes.find((p) => p.meses === Number(meses));
        if (!plan) { out.sinPlan = true; out.mensaje = 'No hay tarifa para ese plazo en esta cuenta.'; return out; }
        out.totalPlazo = plan.total;
        out.restante = Math.min(a.saldoNominal, Math.max(0, plan.total - a.cubierto)); // nunca más caro que el saldo vigente
        out.totalFinal = a.enganche + plan.total;
        if (!a.enPlazo) out.mensaje = 'Ya pasó su plazo pactado: se liquida con el saldo vigente (ver salto de plazo si aplica).';
        else if (meses === a.mesesPlan) out.mensaje = 'Es su plazo pactado: paga el saldo vigente completo.';
        else out.mensaje = `Liquidando a ${meses} mes(es) paga el total de ese plazo en la escalera con que se vendió.`;
        return out;
    }

    // ── Fechas útiles para decidir ────────────────────────────────────
    function fechaPagare(p) {
        const v = p && p.fechaVencimiento;
        if (v === undefined || v === null || v === '') return null;
        const d = typeof v === 'number' ? new Date(v) : parseFecha(v);
        return d && !isNaN(d.getTime()) ? d : null;
    }

    // Hasta cuándo aplica el monto cotizado al liquidar.
    //  · Venta anterior a cupones: el precio de cada peldaño de la escalera rige mientras el cliente siga
    //    dentro de ese mes (mismo criterio de `mesPostContado` en analizar: 30 días + N meses). Pasada esa
    //    fecha cae al siguiente peldaño. El plazo pactado rige hasta que vence.
    //  · Venta posterior a cupones: paga el saldo completo; la referencia es el vencimiento del plazo pactado.
    //  · Plazo ya vencido: no hay fecha límite; la cotización es solo de hoy.
    function fechaLimiteLiquidar(a, meses) {
        if (!a.enPlazo) return null;
        if (a.posterior || Number(meses) >= a.mesesPlan) return { fecha: a.fVence, tipo: 'vence' };
        const ultimoDia = Math.ceil(30 + Number(meses) * DIAS_MES) - 1;
        return { fecha: new Date(a.fVenta.getTime() + ultimoDia * 86400000), tipo: 'escalon' };
    }

    // Cómo va si NO hace nada: pagarés pendientes reales (o estimación si la cuenta no los tiene)
    function planActual(a) {
        const pend = a.pagaresPend || [];
        const abonoPlan = Number((a.cuenta.plan && a.cuenta.plan.abono) || 0);
        let pagos = null, ultima = null;
        if (pend.length) {
            pagos = pend.length;
            const fs = pend.map(fechaPagare).filter(Boolean).sort((x, y) => x - y);
            if (fs.length) ultima = fs[fs.length - 1];
        } else {
            pagos = abonoPlan > 0 ? Math.ceil(a.saldoNominal / abonoPlan - 0.001) : null;
            ultima = a.enPlazo ? a.fVence : null;
        }
        const monto = abonoPlan || (pend[0] ? Number(pend[0].monto || 0) : 0);
        return { pagos, monto, ultima, saldo: a.saldoNominal };
    }

    // ── Ampliar plazo ─────────────────────────────────────────────────
    // Plan { meses, semanas, pagos, abono, total } a partir de un total de la escalera guardada.
    // Mismo molde que CalculatorService: semanas = meses×4, total = abonoSemanal×semanas.
    function planDesdeEscalera(meses, total, periodicidad) {
        const semanas = meses * 4;
        const mult = periodicidad === 'quincenal' ? 2 : periodicidad === 'mensual' ? 4 : 1;
        const abonoSemanal = total / semanas;
        return { meses, semanas, pagos: Math.round(semanas / mult), abono: Number((abonoSemanal * mult).toFixed(2)), total };
    }

    function elegibleParaPlazo(cuenta) {
        const est = String(cuenta.estado || '').toLowerCase();
        if (g('_cxcCuentaCancelada') && g('_cxcCuentaCancelada')(cuenta)) return false;
        return est !== 'saldado' && cuenta.metodo !== 'apartado' && !cuenta.incobrable;
    }

    // Planes MAYORES al pactado, con la tarifa que corresponde a la venta
    function planesAmpliacion(a) {
        const fCap = g('_reestructuraCapitalCuenta');
        const capital = fCap ? fCap(a.cuenta) : a.capitalContado;
        const avisos = [];
        let planes = [], origen = null;
        if (!a.posterior && a.escalera.origen === 'cuenta') {
            planes = a.escalera.planes.map((p) => planDesdeEscalera(p.meses, p.total, a.periodicidad));
            origen = 'cuenta';
        } else if (typeof CalculatorService !== 'undefined' && CalculatorService.calcularCreditoConPeriodicidad && capital > 0) {
            const cfg = leer('configCreditoGlobal', null);
            planes = CalculatorService.calcularCreditoConPeriodicidad(capital, a.periodicidad, cfg);
            origen = 'actual';
            if (!a.posterior) avisos.push('Esta cuenta no tiene escalera propia confiable; el plazo mayor se calculó con las tarifas ACTUALES. Verifícalo antes de prometer el monto.');
        }
        return { planes: planes.filter((p) => p.meses > a.mesesPlan), origen, capital, avisos };
    }

    function simularAmpliacion(a, plan) {
        const sim = g('_reestructuraSimular');
        const pagares = leer('pagaresSistema', []).filter((p) => p.folio === a.folio);
        const totalPagado = g('_reestructuraTotalPagado') ? g('_reestructuraTotalPagado')(pagares, a.cuenta) : a.abonos;
        if (!sim) return null;
        const r = sim(plan, totalPagado);
        return Object.assign({ totalPagado }, r, { totalFinal: a.enganche + plan.total, incremento: plan.total - a.totalPlan });
    }

    // Fechas del calendario nuevo: _reestructuraEjecutar fecha el primer pagaré a (hoy + intervalo) y
    // cada uno siguiente a +intervalo; el último pagaré es la nueva fecha límite de pago.
    function fechasAmpliacion(a, r, hoy) {
        const paso = a.periodicidad === 'quincenal' ? 14 : a.periodicidad === 'mensual' ? 30 : 7;
        const f = new Date(hoy);
        let primera = null, ultima = null;
        for (let i = 0; i < r.pagosRestantes; i++) {
            f.setDate(f.getDate() + paso);
            if (i === 0) primera = new Date(f);
            ultima = new Date(f);
        }
        return { primera, ultima };
    }

    function panelAmpliar(a) {
        if (!elegibleParaPlazo(a.cuenta)) return '<p style="margin-top:12px;color:#b45309;">Esta cuenta no admite cambio de plazo (cancelada, saldada, apartado o incobrable).</p>';
        if (!g('_reestructuraSimular') || !g('_reestructuraEjecutar')) return '<p style="margin-top:12px;color:#b91c1c;">Falta el módulo de reestructura de plazo; no se puede ampliar desde aquí.</p>';
        const amp = planesAmpliacion(a);
        let h = '';
        amp.avisos.forEach((m) => { h += `<div style="margin-top:8px;font-size:12px;color:#b45309;background:#fffbeb;border-radius:8px;padding:8px 10px;">⚠️ ${esc(m)}</div>`; });
        if (!amp.planes.length) return h + '<p style="margin-top:12px;color:#b45309;">No hay un plazo mayor disponible para esta cuenta.</p>';
        if (!amp.planes.some((p) => p.meses === Number(S.mesesAmp))) S.mesesAmp = amp.planes[0].meses;
        const plan = amp.planes.find((p) => p.meses === Number(S.mesesAmp));
        const r = simularAmpliacion(a, plan);
        h += `<div style="margin-top:8px;font-size:12px;color:#475569;background:#f1f5f9;border-radius:8px;padding:8px 10px;">${amp.origen === 'cuenta' ? '📜 Tarifa de su venta (anterior a cupones, guardada en la cuenta).' : '💱 Tarifa vigente.'} El calendario de pagos se reinicia desde hoy sobre el capital original.</div>`;
        h += `<label style="display:block;margin-top:12px;font-size:12px;color:#475569;">Ampliar a</label>
            <select onchange="_cqlElegirPlazoAmp(this.value)" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:8px;font-size:15px;">` +
            amp.planes.map((p) => `<option value="${p.meses}" ${p.meses === Number(S.mesesAmp) ? 'selected' : ''}>${p.meses} meses · ${p.pagos} pagos de ${esc(dinero(p.abono))} · total ${esc(dinero(p.total))}</option>`).join('') + '</select>';
        const fila = (k, v, extra) => `<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px dashed #e2e8f0;"><span style="color:#475569;">${k}</span><span style="${extra || 'font-weight:bold;'}">${v}</span></div>`;
        const fe = fechasAmpliacion(a, r, new Date());
        const proximo = r.pagosRestantes ? (r.proximaEsParcial ? `parcial: faltan ${esc(dinero(r.proximoFaltante))} de ${esc(dinero(r.proximoMonto))}` : esc(dinero(r.proximoMonto))) : '-';
        h += `<div style="margin-top:12px;border:2px solid #7c3aed;border-radius:12px;padding:14px;">
            ${fila('Total del plan a ' + plan.meses + ' meses', esc(dinero(plan.total)))}
            ${fila('Total actual (' + a.mesesPlan + ' meses)', esc(dinero(a.totalPlan)), 'font-weight:normal;')}
            ${fila('Costo adicional por ampliar', esc(dinero(r.incremento)), 'font-weight:bold;color:#b45309;')}
            ${fila('Enganche recibido', esc(dinero(a.enganche)), 'font-weight:normal;')}
            ${fila('Abonos recibidos', esc(dinero(r.totalPagado)), 'font-weight:normal;')}
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0 4px;"><span style="font-size:15px;color:#0f172a;">Importe restante a cubrir</span><span style="font-size:24px;font-weight:800;color:#7c3aed;">${esc(dinero(r.saldoRestante))}</span></div>
            ${a.moratorios > 0.01 ? fila('+ Moratorios pendientes (no cambian)', esc(dinero(a.moratorios)), 'font-weight:normal;color:#b45309;') : ''}
            ${fila('Total final de la compra (enganche + plan)', esc(dinero(r.totalFinal)))}
            ${fila(r.pagosRestantes + ' pago(s) ' + (PERIODOS[a.periodicidad] || ''), 'próximo ' + proximo, 'font-weight:bold;')}
            ${fe.primera ? fila('Primer pago', esc(fmtFecha(fe.primera)), 'font-weight:normal;') : ''}
            ${fe.ultima ? fila('Nueva fecha límite de pago (último pago)', esc(fmtFecha(fe.ultima)), 'font-weight:800;color:#7c3aed;') : ''}
            <div style="margin-top:6px;font-size:11px;color:#94a3b8;">Las fechas del calendario nuevo suponen que el cambio se confirma hoy.</div>
            <div style="margin-top:8px;font-size:12px;color:#64748b;">Se cancelan los pagarés pendientes y se generan los nuevos; lo pagado y el historial se conservan. La política de pago anticipado sigue anclada a la venta original.</div>
            <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
                <button onclick="_cqlEmitir()" style="flex:1;min-width:150px;padding:10px 14px;border:1px solid #7c3aed;background:white;color:#7c3aed;border-radius:8px;cursor:pointer;font-weight:bold;">🖨️ Imprimir / enviar al cliente</button>
                <button onclick="_cqlCopiar()" style="padding:10px 14px;border:1px solid #cbd5e1;background:white;border-radius:8px;cursor:pointer;font-weight:bold;">📋 Copiar resumen</button>
            </div>
            <button onclick="_cqlConfirmarAmpliacion()" id="cqlBtnAmpliar" style="margin-top:12px;width:100%;padding:13px;background:#7c3aed;color:white;border:none;border-radius:8px;font-weight:bold;font-size:14px;cursor:pointer;">✅ Confirmar ampliación a ${plan.meses} meses</button>
            <div style="margin-top:6px;font-size:11px;color:#94a3b8;text-align:center;">Cambiar el plazo es acción de administrador: si no lo eres, te pedirá las credenciales de uno.</div>
        </div>`;
        return h;
    }

    // ── Interfaz ──────────────────────────────────────────────────────
    const S = { cliente: null, folio: null, meses: null, modo: 'liquidar', mesesAmp: null, aviso: '' };

    function abrir(folioInicial) {
        document.querySelector('[data-modal="cotizar-liquidacion"]')?.remove();
        document.body.insertAdjacentHTML('beforeend', `
        <div data-modal="cotizar-liquidacion" style="position:fixed;inset:0;background:rgba(15,23,42,0.75);z-index:9000;display:flex;justify-content:center;align-items:flex-start;overflow:auto;padding:20px;">
            <div style="background:white;border-radius:14px;width:100%;max-width:640px;padding:22px;box-shadow:0 20px 25px rgba(0,0,0,0.25);">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <h2 style="margin:0;color:#0f766e;">🧮 Cotizar liquidación</h2>
                    <button onclick="document.querySelector('[data-modal=&quot;cotizar-liquidacion&quot;]').remove()" style="border:none;background:#f1f5f9;border-radius:8px;padding:8px 14px;cursor:pointer;font-weight:bold;">✕</button>
                </div>
                <div id="cqlCuerpo" style="margin-top:14px;"></div>
            </div>
        </div>`);
        S.cliente = null; S.folio = null; S.meses = null; S.modo = 'liquidar'; S.mesesAmp = null; S.aviso = '';
        cargarLogo(); // precarga el logo para que la emisión sea inmediata
        if (folioInicial) {
            const c = leer('cuentasPorCobrar', []).find((x) => x.folio === folioInicial);
            if (c) { S.folio = folioInicial; S.cliente = { id: c.clienteId, nombre: nombreCliente(c) }; }
        }
        render();
    }

    function nombreCliente(c) {
        const f = g('_cxcNombreClienteVigente');
        return f ? f(c) : (c.nombre || c.clienteNombre || 'Cliente');
    }
    function cuentasDelCliente(clienteId) {
        const est = (c) => String(c.estado || '').toLowerCase();
        return leer('cuentasPorCobrar', []).filter((c) => String(c.clienteId) === String(clienteId) && est(c) !== 'cancelado' && est(c) !== 'saldado' && !c.incobrable && Number(c.saldoActual || 0) > 0.01);
    }

    function render() {
        const cont = document.getElementById('cqlCuerpo');
        if (!cont) return;
        const btnCliente = `<button onclick="_cqlElegirCliente()" style="width:100%;padding:12px;background:#0f766e;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">👤 ${S.cliente ? 'Cambiar cliente' : 'Seleccionar cliente'}</button>`;
        if (!S.cliente) { cont.innerHTML = btnCliente + '<p style="color:#64748b;font-size:13px;margin-top:10px;">Elige al cliente para ver sus cuentas a crédito y cotizar su liquidación.</p>'; return; }

        // Fecha de inicio de cupones: se pide una sola vez
        if (!fechaInicioCupones()) { cont.innerHTML = btnCliente + tarjetaConfigFecha(); return; }

        const cuentas = cuentasDelCliente(S.cliente.id);
        if (S.folio && !cuentas.some((c) => c.folio === S.folio)) S.folio = null;
        if (!S.folio && cuentas.length === 1) S.folio = cuentas[0].folio;
        const opcionesCuenta = cuentas.map((c) => `<option value="${esc(c.folio)}" ${c.folio === S.folio ? 'selected' : ''}>${esc(textoProductos(productosCuenta(c), 34))} · ${esc(fmtFecha(fechaVenta(c)))} · ${esc((c.plan && c.plan.meses) || '?')} m · saldo ${esc(dinero(c.saldoActual))} · ref. ${esc(c.folio.length > 14 ? c.folio.slice(0, 14) + '…' : c.folio)}</option>`).join('');
        let html = btnCliente + `<div style="margin-top:12px;font-size:15px;"><strong>${esc(S.cliente.nombre)}</strong></div>`;
        if (!cuentas.length) { cont.innerHTML = html + '<p style="color:#b45309;background:#fffbeb;border-radius:8px;padding:10px;margin-top:8px;">Este cliente no tiene cuentas a crédito con saldo pendiente.</p>'; return; }
        html += `<label style="display:block;margin-top:10px;font-size:12px;color:#475569;">Cuenta</label>
            <select onchange="_cqlElegirCuenta(this.value)" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:8px;"><option value="">— elegir cuenta —</option>${opcionesCuenta}</select>`;
        if (!S.folio) { cont.innerHTML = html; return; }

        const a = analizar(S.folio);
        if (!a) { cont.innerHTML = html; return; }
        const plazos = plazosPosibles(a);
        if (!plazos.includes(Number(S.meses))) S.meses = plazos.length ? plazos[0] : null;
        const q = S.meses ? cotizar(a, Number(S.meses)) : null;

        html += resumenCuenta(a);
        if (S.aviso) html += `<div style="margin-top:8px;font-size:13px;color:#166534;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:10px 12px;">${esc(S.aviso)}</div>`;
        const tab = (m, txt) => `<button onclick="_cqlModo('${m}')" style="flex:1;padding:10px;border:none;border-radius:8px;font-weight:bold;cursor:pointer;background:${S.modo === m ? '#0f766e' : '#e2e8f0'};color:${S.modo === m ? 'white' : '#475569'};">${txt}</button>`;
        html += `<div style="display:flex;gap:8px;margin-top:12px;">${tab('liquidar', '⏩ Liquidar antes')}${tab('ampliar', '⏪ Ampliar plazo')}</div>`;
        if (S.modo === 'ampliar') { cont.innerHTML = html + panelAmpliar(a); return; }
        if (a.posterior) html += `<div style="margin-top:8px;font-size:12px;color:#7e22ce;background:#faf5ff;border-radius:8px;padding:8px 10px;">🎟️ Venta posterior al inicio de cupones (${esc(fmtFecha(a.inicio))}): aplica la regla vigente con cupón.</div>`;
        else html += `<div style="margin-top:8px;font-size:12px;color:#475569;background:#f1f5f9;border-radius:8px;padding:8px 10px;">📜 Venta anterior a cupones (${esc(fmtFecha(a.inicio))}): se cotiza con la escalera de tarifas que tenía esta venta${a.escalera.origen === 'cuenta' ? ' (guardada en la cuenta)' : ''}. No genera cupón.</div>`;
        (q ? q.avisos : a.escalera.avisos).forEach((m) => { html += `<div style="margin-top:8px;font-size:12px;color:#b45309;background:#fffbeb;border-radius:8px;padding:8px 10px;">⚠️ ${esc(m)}</div>`; });

        if (a.saldoNominal <= 0.01) { cont.innerHTML = html + '<p style="margin-top:10px;font-weight:bold;color:#15803d;">La cuenta ya está liquidada.</p>'; return; }
        if (!plazos.length) { cont.innerHTML = html + '<p style="margin-top:10px;color:#b45309;">No hay plazos disponibles para cotizar en esta cuenta.</p>'; return; }

        html += `<label style="display:block;margin-top:12px;font-size:12px;color:#475569;">${a.posterior || !a.enPlazo ? 'Plazo' : 'Liquidar a'}</label>
            <select onchange="_cqlElegirPlazo(this.value)" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:8px;font-size:15px;">` +
            plazos.map((m) => {
                const p = a.escalera.planes.find((x) => x.meses === m);
                const total = a.posterior ? a.totalPlan : (p ? p.total : null);
                return `<option value="${m}" ${Number(S.meses) === m ? 'selected' : ''}>${m} mes${m === 1 ? '' : 'es'}${m === a.mesesPlan ? ' (pactado)' : ''}${total ? ' · total ' + esc(dinero(total)) : ''}</option>`;
            }).join('') + '</select>';
        if (q) html += resultado(a, q);
        cont.innerHTML = html;
    }

    function resumenCuenta(a) {
        const fila = (k, v) => `<div style="display:flex;justify-content:space-between;gap:10px;padding:3px 0;"><span style="color:#64748b;">${k}</span><strong>${v}</strong></div>`;
        return `<div style="margin-top:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;font-size:13px;">
            ${fila('Producto', esc(textoProductos(a.productos)))}
            ${fila('Venta', esc(fmtFecha(a.fVenta)) + ' · plan ' + esc(a.mesesPlan) + ' meses ' + esc(a.periodicidad))}
            ${fila('Va en', 'día ' + a.dias + (a.mesesPlan ? (a.enPlazo ? ' · plazo vence ' + esc(fmtFecha(a.fVence)) : ' · plazo vencido el ' + esc(fmtFecha(a.fVence))) : ''))}
            ${fila('Saldo vigente (sin moratorios)', esc(dinero(a.saldoNominal)))}
            <div style="font-size:11px;color:#94a3b8;margin-top:2px;">Ref. ${esc(a.folio)}</div>
        </div>`;
    }

    function resultado(a, q) {
        if (q.liquidada || q.sinPlan) return `<p style="margin-top:12px;color:#b45309;">${esc(q.mensaje)}</p>`;
        const fila = (k, v, extra) => `<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px dashed #e2e8f0;"><span style="color:#475569;">${k}</span><span style="${extra || 'font-weight:bold;'}">${v}</span></div>`;
        let h = `<div style="margin-top:12px;border:2px solid #0f766e;border-radius:12px;padding:14px;">
            ${fila('Total del plan a ' + q.meses + ' mes' + (q.meses === 1 ? '' : 'es'), esc(dinero(q.totalPlazo)))}
            ${fila('Enganche recibido', esc(dinero(a.enganche)), 'font-weight:normal;')}
            ${fila('Abonos recibidos', esc(dinero(a.abonos)), 'font-weight:normal;')}
            ${Math.abs(a.ajustes) > 0.01 ? fila('Otros ajustes aplicados (condonaciones, etc.)', esc(dinero(a.ajustes)), 'font-weight:normal;') : ''}
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0 4px;"><span style="font-size:15px;color:#0f172a;">Importe restante a cubrir</span><span style="font-size:24px;font-weight:800;color:#0f766e;">${esc(dinero(q.restante))}</span></div>
            ${a.moratorios > 0.01 ? fila('+ Moratorios pendientes (se cobran aparte)', esc(dinero(a.moratorios)), 'font-weight:normal;color:#b45309;') + fila('A pagar hoy con moratorios', esc(dinero(q.restante + a.moratorios))) : ''}
            ${fila('Total final de la compra (enganche + plan)', esc(dinero(q.totalFinal)))}
            ${(() => { const l = fechaLimiteLiquidar(a, q.meses); return l ? fila('Fecha límite para este monto', esc(fmtFecha(l.fecha)), 'font-weight:800;color:#0f766e;') : fila('Vigencia de esta cotización', 'solo hoy · ' + esc(fmtFecha(new Date())), 'font-weight:normal;'); })()}
            ${(!a.posterior && a.saldoNominal - q.restante > 0.01) ? fila('Ahorro contra su saldo vigente', esc(dinero(a.saldoNominal - q.restante)), 'font-weight:bold;color:#15803d;') : ''}`;
        if (a.posterior) {
            h += q.cupon
                ? `<div style="margin-top:10px;background:#faf5ff;border:1px solid #e9d5ff;border-radius:10px;padding:10px 12px;"><div style="font-size:12px;color:#7e22ce;">🎟️ Cupón que recibiría al liquidar</div><div style="font-size:22px;font-weight:800;color:#7e22ce;">${esc(dinero(q.cupon.monto))}</div><div style="font-size:12px;color:#6b21a8;">${esc(q.cupon.pct)}% del total financiado</div></div>`
                : `<div style="margin-top:10px;font-size:13px;color:#64748b;">🎟️ Sin cupón en este caso.</div>`;
        }
        h += `<div style="margin-top:10px;font-size:12px;color:#64748b;">${esc(q.mensaje)}</div></div>
            <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
                <button onclick="_cqlEmitir()" style="flex:1;min-width:150px;padding:10px 14px;border:1px solid #0f766e;background:white;color:#0f766e;border-radius:8px;cursor:pointer;font-weight:bold;">🖨️ Imprimir / enviar al cliente</button>
                <button onclick="_cqlCopiar()" style="padding:10px 14px;border:1px solid #cbd5e1;background:white;border-radius:8px;cursor:pointer;font-weight:bold;">📋 Copiar resumen</button>
            </div>`;
        return h;
    }

    function tarjetaConfigFecha() {
        const sug = sugerirFechaInicio();
        return `<div style="margin-top:12px;border:1px solid #fde68a;background:#fffbeb;border-radius:10px;padding:12px;">
            <div style="font-weight:bold;color:#92400e;">Una sola vez: ¿desde qué fecha rigen los cupones?</div>
            <p style="font-size:13px;color:#78350f;margin:6px 0;">Las ventas anteriores a esa fecha se cotizan con su escalera original y sin cupón; las posteriores, con la regla vigente.${sug ? ` Detecté que los abonos ya llevan marca de cupón desde el <strong>${esc(fmtFecha(sug))}</strong>; confirma o corrige.` : ''}</p>
            <div style="display:flex;gap:8px;"><input type="date" id="cqlFechaInicio" value="${sug ? isoDia(sug) : ''}" style="flex:1;padding:8px;border:1px solid #cbd5e1;border-radius:8px;">
            <button onclick="_cqlGuardarFecha()" style="padding:8px 14px;background:#92400e;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">Guardar</button></div></div>`;
    }

    // ── Acciones ──────────────────────────────────────────────────────
    window._cqlElegirCliente = function () {
        if (typeof window.abrirSelectorCliente !== 'function') { alert('El selector de clientes no está disponible.'); return; }
        window.abrirSelectorCliente({
            titulo: 'Cliente a cotizar',
            onSeleccion: (c) => { S.cliente = { id: c.id, nombre: c.nombre }; S.folio = null; S.meses = null; document.querySelector('[data-modal="universal-client-picker"]')?.remove(); render(); }
        });
    };
    window._cqlElegirCuenta = function (folio) { S.folio = folio || null; S.meses = null; render(); };
    window._cqlElegirPlazo = function (m) { S.meses = Number(m) || null; render(); };
    window._cqlModo = function (m) { S.modo = m === 'ampliar' ? 'ampliar' : 'liquidar'; S.aviso = ''; render(); };
    window._cqlElegirPlazoAmp = function (m) { S.mesesAmp = Number(m) || null; render(); };
    window._cqlConfirmarAmpliacion = function () {
        // Cambiar el plazo es una acción de administrador: si la sesión no lo es, se piden credenciales de uno.
        if (typeof esAdmin === 'function' && esAdmin()) { ejecutarAmpliacion(); return; }
        if (typeof window.requireAdmin === 'function') { window.requireAdmin(ejecutarAmpliacion); return; }
        alert('Solo un administrador puede modificar el plazo pactado de una cuenta.');
    };
    async function ejecutarAmpliacion() {
        if (!S.folio) return;
        const a = analizar(S.folio); if (!a) return;
        const amp = planesAmpliacion(a);
        const plan = amp.planes.find((p) => p.meses === Number(S.mesesAmp));
        if (!plan) { alert('Selecciona un plazo válido.'); return; }
        const r = simularAmpliacion(a, plan);
        const feConf = fechasAmpliacion(a, r, new Date());
        if (!confirm(`⚠️ AMPLIAR PLAZO PACTADO\n\nCliente: ${S.cliente.nombre}\nProducto: ${textoProductos(a.productos, 60)}\nRef.: ${a.folio}\nPlazo: ${a.mesesPlan} → ${plan.meses} meses\nNuevo total del plan: ${dinero(plan.total)} (antes ${dinero(a.totalPlan)})\nImporte restante a cubrir: ${dinero(r.saldoRestante)}\nPagos nuevos: ${r.pagosRestantes}${feConf.ultima ? `\nNueva fecha límite de pago: ${fmtFecha(feConf.ultima)}` : ''}\n\nSe cancelan los pagarés pendientes y se generan los nuevos. Queda en auditoría.\n\n¿Confirmas?`)) return;
        const btn = document.getElementById('cqlBtnAmpliar');
        if (btn) { btn.disabled = true; btn.textContent = 'Procesando…'; btn.style.opacity = '0.6'; }
        const res = await window._reestructuraEjecutar(a.folio, plan, a.cuenta.periodicidad || 'semanal', amp.capital);
        if (!res.ok) {
            alert(res.motivo === 'error' ? 'No se pudo modificar el plazo: error al escribir los cambios. Nada quedó a medias; intenta de nuevo.' : 'No se pudo modificar el plazo: la cuenta fue cancelada o cambió justo antes de confirmar. Vuelve a abrir la cotización.');
            render(); return;
        }
        S.aviso = res.saldado
            ? `✅ Plazo ampliado a ${plan.meses} meses. Con lo ya pagado la cuenta quedó SALDADA.`
            : `✅ Plazo ampliado a ${plan.meses} meses. Saldo pendiente ${dinero(res.saldoRestante)}; se generaron ${res.pagosGenerados} pagaré(s) nuevo(s).`;
        S.modo = 'liquidar'; S.meses = null; S.mesesAmp = null;
        // Refrescar las pantallas de fondo; si alguna falla, el cambio ya quedó guardado y no debe romper este flujo.
        ['renderCuentasXCobrar', 'renderAbonosDirectos', 'renderReestructuraPlazo'].forEach((fn) => {
            try { if (typeof window[fn] === 'function') window[fn](); } catch (e) { console.warn('[cotizar-liquidacion] no se pudo refrescar ' + fn, e); }
        });
        render();
    }
    window._cqlGuardarFecha = function () {
        const v = (document.getElementById('cqlFechaInicio') || {}).value;
        if (!v) { alert('Elige la fecha.'); return; }
        const guardar = () => { StorageService.set(CFG_KEY, { fechaInicio: v }); render(); };
        if (typeof window.requireAdmin === 'function') window.requireAdmin(guardar); else guardar();
    };
    // ── Cotización lista para el cliente ──────────────────────────────
    // Una sola fuente de datos (`bloques`) alimenta el documento (PDF/Imagen), el ticket y el texto copiado,
    // para que los tres digan exactamente lo mismo que la pantalla.
    function contexto() {
        if (!S.folio || !S.cliente) return null;
        const a = analizar(S.folio);
        if (!a) return null;
        const hoy = new Date();
        const base = { a, hoy, modo: S.modo === 'ampliar' ? 'ampliar' : 'liquidar', cliente: S.cliente.nombre };
        if (base.modo === 'ampliar') {
            if (!elegibleParaPlazo(a.cuenta) || !g('_reestructuraSimular')) return null;
            const amp = planesAmpliacion(a);
            const plan = amp.planes.find((p) => p.meses === Number(S.mesesAmp)) || amp.planes[0];
            if (!plan) return null;
            const r = simularAmpliacion(a, plan);
            if (!r) return null;
            return Object.assign(base, { amp, plan, r, fechas: fechasAmpliacion(a, r, hoy), avisos: amp.avisos });
        }
        const plazos = plazosPosibles(a);
        const meses = plazos.includes(Number(S.meses)) ? Number(S.meses) : plazos[0];
        if (!meses) return null;
        const q = cotizar(a, meses);
        if (!q || q.restante === undefined) return null;
        return Object.assign(base, { q, limite: fechaLimiteLiquidar(a, q.meses), avisos: q.avisos });
    }

    // Filas [etiqueta, valor, 'fuerte'?] por sección, ya formateadas como texto.
    function bloques(ctx) {
        const a = ctx.a;
        const per = PERIODOS[a.periodicidad] || a.periodicidad;
        const act = planActual(a);
        const compra = [
            ['Fecha de venta', fmtFecha(a.fVenta)],
            ['Plazo contratado', `${a.mesesPlan || '-'} meses · pagos ${per}`],
            [a.enPlazo ? 'Su plazo vence' : 'Su plazo venció', a.mesesPlan ? fmtFecha(a.fVence) : '-']
        ];
        const cuenta = [
            ['Total del plan actual', dinero(a.totalPlan)],
            ['Enganche recibido', dinero(a.enganche)],
            ['Abonos recibidos', dinero(a.abonos)]
        ];
        if (Math.abs(a.ajustes) > 0.01) cuenta.push(['Otros ajustes aplicados (condonaciones, etc.)', dinero(a.ajustes)]);
        cuenta.push(['Saldo vigente (sin moratorios)', dinero(a.saldoNominal), 'fuerte']);
        if (a.moratorios > 0.01) cuenta.push(['Moratorios pendientes', dinero(a.moratorios)]);
        if (a.montoVencido > 0.01) cuenta.push(['Pagos vencidos a la fecha', dinero(a.montoVencido)]);

        const actualCol = {
            pagos: act.pagos ? `${act.pagos} pago(s) ${per}` : '-',
            monto: act.monto ? dinero(act.monto) : '-',
            termina: act.ultima ? fmtFecha(act.ultima) : '-',
            total: dinero(act.saldo)
        };

        if (ctx.modo === 'ampliar') {
            const { plan, r, fechas } = ctx;
            const opcion = [
                ['Plazo actual → nuevo plazo', `${a.mesesPlan} → ${plan.meses} meses`],
                [`Total del plan a ${plan.meses} meses`, dinero(plan.total)],
                [`Total actual (${a.mesesPlan} meses)`, dinero(a.totalPlan)],
                ['Costo adicional por ampliar', dinero(r.incremento), 'fuerte'],
                ['Pagos nuevos', r.pagosRestantes ? `${r.pagosRestantes} pago(s) ${per} de ${dinero(plan.abono)}` : 'Sin pagos pendientes']
            ];
            if (fechas.primera) opcion.push(['Primer pago', fmtFecha(fechas.primera) + (r.proximaEsParcial ? ` (parcial: faltan ${dinero(r.proximoFaltante)})` : '')]);
            if (fechas.ultima) opcion.push(['Nueva fecha límite de pago (último pago)', fmtFecha(fechas.ultima), 'fuerte']);
            if (a.moratorios > 0.01) opcion.push(['Moratorios pendientes (no cambian)', dinero(a.moratorios)]);
            opcion.push(['Total final de la compra (enganche + plan)', dinero(r.totalFinal)]);
            return {
                titulo: 'Cotización de ampliación de plazo', subtitulo: 'Ampliación de plazo', color: '#7c3aed', fondo: '#f5f3ff',
                tituloOpcion: `Si amplía su plazo a ${plan.meses} meses`,
                hero: { etiqueta: 'Importe restante a cubrir', valor: dinero(r.saldoRestante) },
                compra, cuenta, opcion, colOpcion: `Ampliar a ${plan.meses} meses`,
                comparativo: [
                    ['Pagos que le faltan', actualCol.pagos, r.pagosRestantes ? `${r.pagosRestantes} pago(s) ${per}` : '-'],
                    ['Monto por pago', actualCol.monto, r.pagosRestantes ? dinero(plan.abono) : '-'],
                    ['Termina de pagar', actualCol.termina, fechas.ultima ? fmtFecha(fechas.ultima) : (r.saldoRestante <= 0.01 ? 'Cuenta saldada' : '-')],
                    ['Total que pagará de aquí en adelante', actualCol.total, dinero(r.saldoRestante)]
                ],
                notas: [
                    'Si acepta, se cancelan sus pagarés pendientes y se genera un calendario nuevo a partir de la fecha en que se confirma el cambio; lo ya pagado se conserva.',
                    'Las fechas de pago de esta cotización suponen que el cambio se confirma el día en que se emite.',
                    'Los moratorios pendientes no cambian con la ampliación y se cobran aparte.'
                ].concat(ctx.avisos.length ? ['Tarifa estimada con precios vigentes; sujeta a validación en tienda.'] : [])
            };
        }

        const { q, limite } = ctx;
        const opcion = [
            ['Liquidando a', `${q.meses} mes(es)${q.meses === a.mesesPlan ? ' (plazo pactado)' : ''}`],
            [`Total del plan a ${q.meses} mes(es)`, dinero(q.totalPlazo)],
            ['Total final de la compra (enganche + plan)', dinero(q.totalFinal)]
        ];
        if (!a.posterior && a.saldoNominal - q.restante > 0.01) opcion.push(['Ahorro contra su saldo vigente', dinero(a.saldoNominal - q.restante), 'fuerte']);
        if (a.moratorios > 0.01) {
            opcion.push(['Moratorios pendientes (se cobran aparte)', dinero(a.moratorios)]);
            opcion.push(['A pagar hoy con moratorios', dinero(q.restante + a.moratorios), 'fuerte']);
        }
        if (a.posterior) opcion.push(['Cupón al liquidar', q.cupon ? `${dinero(q.cupon.monto)} (${q.cupon.pct}% del total financiado)` : 'Sin cupón en este caso']);
        opcion.push(limite
            ? ['Fecha límite para este monto', fmtFecha(limite.fecha), 'fuerte']
            : ['Vigencia de esta cotización', 'Solo hoy · ' + fmtFecha(ctx.hoy)]);
        const notas = [q.mensaje].filter(Boolean);
        if (limite && limite.tipo === 'escalon') notas.push('Pasada esa fecha, aplica el siguiente plazo de la escalera con la que se vendió.');
        notas.push('Cotización informativa; los moratorios y el saldo pueden cambiar con los pagos que se registren.');
        return {
            titulo: 'Cotización de liquidación', subtitulo: 'Liquidación anticipada', color: '#0f766e', fondo: '#ecfdf5',
            tituloOpcion: `Si liquida a ${q.meses} mes(es)`,
            hero: { etiqueta: 'Importe restante a cubrir', valor: dinero(q.restante) },
            compra, cuenta, opcion, colOpcion: 'Liquidar',
            comparativo: [
                ['Pagos que le faltan', actualCol.pagos, '1 solo pago'],
                ['Monto por pago', actualCol.monto, dinero(q.restante)],
                ['Termina de pagar', actualCol.termina, limite ? `Al liquidar (hasta ${fmtFecha(limite.fecha)})` : 'Al liquidar'],
                ['Total que pagará de aquí en adelante', actualCol.total, dinero(q.restante)]
            ],
            notas: notas.concat(ctx.avisos.length ? ['Tarifa estimada con precios vigentes; sujeta a validación en caja.'] : [])
        };
    }

    // ── Texto plano (copiar) ──────────────────────────────────────────
    function lineasResumen(ctx) {
        const b = bloques(ctx);
        const l = [`${b.titulo} — ${ctx.cliente}`, `Producto: ${textoProductos(ctx.a.productos)}`];
        b.compra.forEach(([k, v]) => l.push(`${k}: ${v}`));
        l.push(`${b.hero.etiqueta}: ${b.hero.valor}`);
        b.opcion.forEach(([k, v]) => l.push(`${k}: ${v}`));
        l.push(`(Cotización al ${fmtFecha(ctx.hoy)}; sujeta a validación en caja)`);
        return l;
    }

    // ── Documento (PDF / Imagen) ──────────────────────────────────────
    function docCss(color, fondo) {
        return `<style>
        .cql-wrap{font-family:Arial,Helvetica,sans-serif;color:#172033;background:#fff;max-width:720px;margin:0 auto;line-height:1.35;font-size:13px;}
        .cql-head{background:#0f172a;color:#fff;padding:20px 24px;border-radius:14px 14px 0 0;display:flex;justify-content:space-between;gap:16px;align-items:flex-start;}
        .cql-brand{display:flex;align-items:center;gap:13px;}
        .cql-logo{width:62px;height:62px;object-fit:contain;background:#fff;border-radius:8px;padding:5px;flex:0 0 62px;}
        .cql-name{font-size:20px;font-weight:900;letter-spacing:.03em;text-transform:uppercase;}
        .cql-sub{font-size:12px;color:#cbd5e1;margin-top:3px;}
        .cql-contact{font-size:11px;color:#94a3b8;margin-top:3px;}
        .cql-fecha{text-align:right;font-size:11px;color:#cbd5e1;white-space:nowrap;}
        .cql-fecha b{display:block;color:#fff;font-size:15px;margin-top:3px;}
        .cql-body{border:1px solid #dbe2ea;border-top:0;border-radius:0 0 14px 14px;padding:20px 24px;}
        .cql-box{border:1px solid #dbe2ea;background:#f8fafc;border-radius:10px;padding:12px 14px;}
        .cql-label{font-size:10px;text-transform:uppercase;color:#64748b;font-weight:900;letter-spacing:.04em;margin-bottom:4px;}
        .cql-cliente{font-size:17px;font-weight:900;color:#0f172a;}
        .cql-h{font-size:13px;font-weight:900;color:#0f172a;text-transform:uppercase;letter-spacing:.03em;border-bottom:2px solid #0f172a;padding-bottom:6px;margin:20px 0 6px;}
        .cql-tbl{width:100%;border-collapse:collapse;font-size:13px;}
        .cql-tbl th{background:#f1f5f9;color:#475569;text-align:left;padding:7px 8px;border-bottom:1px solid #cbd5e1;text-transform:uppercase;font-size:10px;}
        .cql-tbl td{padding:7px 8px;border-bottom:1px solid #e2e8f0;vertical-align:top;}
        .cql-tbl td.v{text-align:right;font-weight:700;}
        .cql-tbl tr.fuerte td{font-weight:900;color:${color};}
        .cql-tbl td.c{text-align:center;}
        .cql-prod{font-size:15px;font-weight:900;color:#0f172a;}
        .cql-hero{margin-top:10px;border-radius:12px;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;gap:12px;background:${fondo};border:2px solid ${color};}
        .cql-hero .e{font-size:14px;font-weight:700;color:#0f172a;}
        .cql-hero .n{font-size:28px;font-weight:900;color:${color};white-space:nowrap;}
        .cql-comp th.o{background:${fondo};color:${color};}
        .cql-comp td.o{background:${fondo};font-weight:900;}
        .cql-notas{margin-top:18px;background:#f8fafc;border:1px solid #dbe2ea;border-radius:10px;padding:12px 16px;font-size:11px;color:#334155;}
        .cql-notas ul{margin:0;padding-left:16px;}.cql-notas li{margin:4px 0;}
        .cql-foot{margin-top:16px;text-align:center;font-size:11px;color:#64748b;}
        .cql-ref{margin-top:8px;font-size:10px;color:#94a3b8;}
        .cql-sec{break-inside:avoid;page-break-inside:avoid;}
        </style>`;
    }

    function docHtml(ctx, logo) {
        const b = bloques(ctx);
        const a = ctx.a;
        const emp = datosEmpresa();
        const filas = (rows) => `<table class="cql-tbl">${rows.map((r) => `<tr class="${r[2] === 'fuerte' ? 'fuerte' : ''}"><td>${esc(r[0])}</td><td class="v">${esc(r[1])}</td></tr>`).join('')}</table>`;
        const prods = a.productos.length ? a.productos : [{ nombre: 'Venta general', cantidad: 1 }];
        const contacto = [emp.direccion, emp.telefono ? 'Tel: ' + emp.telefono : ''].filter(Boolean).join(' · ');
        return `${docCss(b.color, b.fondo)}
        <div class="cql-wrap">
            <header class="cql-head">
                <div class="cql-brand">
                    <img class="cql-logo" src="${logo}" alt="${esc(emp.nombre)}">
                    <div>
                        <div class="cql-name">${esc(emp.nombre)}</div>
                        <div class="cql-sub">${esc(b.titulo)}</div>
                        ${contacto ? `<div class="cql-contact">${esc(contacto)}</div>` : ''}
                    </div>
                </div>
                <div class="cql-fecha">Cotización del<b>${esc(fmtFecha(ctx.hoy))}</b></div>
            </header>
            <section class="cql-body">
                <div class="cql-box"><div class="cql-label">Cliente</div><div class="cql-cliente">${esc(ctx.cliente)}</div></div>

                <div class="cql-sec"><div class="cql-h">Su compra</div>
                    <table class="cql-tbl"><thead><tr><th>Producto</th><th style="text-align:center;">Cant.</th></tr></thead><tbody>
                        ${prods.map((x) => `<tr><td class="cql-prod">${esc(x.nombre)}</td><td class="c">${esc(x.cantidad)}</td></tr>`).join('')}
                    </tbody></table>
                    ${filas(b.compra)}
                </div>

                <div class="cql-sec"><div class="cql-h">Estado de su cuenta al ${esc(fmtFecha(ctx.hoy))}</div>${filas(b.cuenta)}</div>

                <div class="cql-sec"><div class="cql-h">${esc(b.tituloOpcion)}</div>
                    <div class="cql-hero"><span class="e">${esc(b.hero.etiqueta)}</span><span class="n">${esc(b.hero.valor)}</span></div>
                    ${filas(b.opcion)}
                </div>

                <div class="cql-sec"><div class="cql-h">Para decidir: su plan actual contra esta opción</div>
                    <table class="cql-tbl cql-comp"><thead><tr><th></th><th>Seguir con su plan actual</th><th class="o">${esc(b.colOpcion)}</th></tr></thead><tbody>
                        ${b.comparativo.map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td class="o">${esc(r[2])}</td></tr>`).join('')}
                    </tbody></table>
                </div>

                <div class="cql-notas cql-sec"><ul>${b.notas.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>
                <div class="cql-foot">Gracias por su preferencia · ${esc(emp.nombre)}</div>
                <div class="cql-ref" style="text-align:center;">Ref. ${esc(a.folio)}</div>
            </section>
        </div>`;
    }

    // ── Ticket (80 mm) ────────────────────────────────────────────────
    function ticketHtml(ctx, logo) {
        const b = bloques(ctx);
        const a = ctx.a;
        const emp = datosEmpresa();
        const linea = '<div>--------------------------------</div>';
        // Etiqueta y valor en una línea; si no caben en 80 mm, el valor baja a su propia línea.
        const fila = (r) => {
            const negr = r[2] === 'fuerte' ? 'font-weight:bold;' : '';
            if (String(r[0]).length + String(r[1]).length > 30) return `<div style="${negr}margin-top:2px;">${esc(r[0])}</div><div style="${negr}text-align:right;">${esc(r[1])}</div>`;
            return `<div style="display:flex;justify-content:space-between;gap:6px;${negr}"><span>${esc(r[0])}</span><span style="text-align:right;">${esc(r[1])}</span></div>`;
        };
        const prods = (a.productos.length ? a.productos : [{ nombre: 'Venta general', cantidad: 1 }])
            .map((x) => `<div style="font-weight:bold;">${esc(x.nombre)}${x.cantidad > 1 ? ' x' + esc(x.cantidad) : ''}</div>`).join('');
        return `<div style="font-family:'Courier New',monospace;font-size:11px;line-height:1.3;color:#000;">
            <div style="text-align:center;"><img src="${logo}" alt="${esc(emp.nombre)}" style="width:56px;height:56px;object-fit:contain;"></div>
            <div style="text-align:center;font-weight:bold;">${esc(emp.nombre.toUpperCase())}</div>
            ${emp.telefono ? `<div style="text-align:center;">Tel: ${esc(emp.telefono)}</div>` : ''}
            <div style="text-align:center;font-weight:bold;margin-top:2px;">${esc(b.titulo.toUpperCase())}</div>
            ${linea}
            <div>Fecha: ${esc(fmtFecha(ctx.hoy))}</div>
            <div>Cliente: ${esc(ctx.cliente)}</div>
            ${linea}
            <div><b>PRODUCTO</b></div>
            ${prods}
            ${b.compra.map(fila).join('')}
            ${linea}
            <div><b>SU CUENTA</b></div>
            ${b.cuenta.map(fila).join('')}
            ${linea}
            <div><b>${esc(b.tituloOpcion.toUpperCase())}</b></div>
            <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:13px;margin:3px 0;"><span>${esc(b.hero.etiqueta)}</span><span>${esc(b.hero.valor)}</span></div>
            ${b.opcion.map(fila).join('')}
            ${linea}
            <div><b>PLAN ACTUAL VS ${esc(b.colOpcion.toUpperCase())}</b></div>
            ${b.comparativo.map((r) => `<div style="margin-top:2px;">${esc(r[0])}</div><div style="display:flex;justify-content:space-between;gap:6px;"><span>Actual: ${esc(r[1])}</span><span style="font-weight:bold;">${esc(r[2])}</span></div>`).join('')}
            ${linea}
            ${b.notas.map((n) => `<div style="font-size:10px;margin-top:2px;">* ${esc(n)}</div>`).join('')}
            <div style="text-align:center;margin-top:6px;">Gracias por su preferencia</div>
            <div style="text-align:center;font-size:9px;color:#555;">Ref. ${esc(a.folio)}</div>
        </div>`;
    }

    // ── Emisión: PDF / Ticket / Imagen (los mismos que el Estado de Cuenta) ──
    async function emitir(formato) {
        const ctx = contexto();
        if (!ctx) { alert('Primero elige una cuenta y una opción para cotizar.'); return; }
        const logo = await cargarLogo();
        if (!logo) { alert('No se pudo cargar el logo del negocio (img/Logo.png), y la cotización no se emite sin él. Revisa tu conexión e inténtalo de nuevo.'); return; }
        const TS = window.TicketService;
        const tipo = ctx.modo === 'ampliar' ? 'ampliacion' : 'liquidacion';
        const titulo = ctx.modo === 'ampliar' ? 'Cotización de ampliación de plazo' : 'Cotización de liquidación';
        const archivo = `cotizacion_${tipo}_${TS && TS.safeName ? TS.safeName(ctx.cliente) : 'cliente'}_${isoDia(ctx.hoy)}`;
        if (formato === 'ticket') {
            const body = ticketHtml(ctx, logo);
            if (TS && TS.openThermal) { TS.openThermal({ title: titulo, filename: archivo, body }); return; }
            const w = window.open('', '_blank');
            if (!w) { alert('Habilita las ventanas emergentes para imprimir el ticket.'); return; }
            w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(titulo)}</title></head><body>${body}</body></html>`);
            w.document.close(); w.focus();
            return;
        }
        const html = docHtml(ctx, logo);
        const opts = { title: titulo, filename: archivo, pageSize: 'letter' };
        if (TS && TS.openDocument) {
            TS.openDocument(html, formato === 'imagen' ? Object.assign({ autoImage: true }, opts) : Object.assign({ autoPrint: true }, opts));
            return;
        }
        if (formato === 'imagen') { alert('El servicio de documentos no está disponible. Usa PDF o recarga la página.'); return; }
        const w = window.open('', '_blank');
        if (!w) { alert('Habilita las ventanas emergentes para generar el PDF.'); return; }
        w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${esc(titulo)}</title><style>@page{size:letter portrait;margin:12mm}body{margin:0;padding:18px;background:#fff}</style></head><body>${html}<script>window.addEventListener('load',function(){setTimeout(function(){window.focus();window.print();},450);});<\/script></body></html>`);
        w.document.close(); w.focus();
    }

    window._cqlEmitir = function () {
        if (!contexto()) { alert('Primero elige una cuenta y una opción para cotizar.'); return; }
        cargarLogo(); // por si aún no terminó de precargarse
        document.querySelector('[data-modal="cql-emitir"]')?.remove();
        const btn = (f, txt, bg) => `<button onclick="_cqlFormato('${f}')" style="padding:16px 8px;border:0;border-radius:7px;background:${bg};color:white;font-weight:900;cursor:pointer;">${txt}</button>`;
        document.body.insertAdjacentHTML('beforeend', `
            <div data-modal="cql-emitir" style="position:fixed;inset:0;background:rgba(15,23,42,.72);z-index:9500;display:flex;align-items:center;justify-content:center;padding:18px;">
                <div style="width:100%;max-width:520px;background:white;border-radius:8px;padding:24px;box-shadow:0 24px 55px rgba(15,23,42,.3);">
                    <h3 style="margin:0;color:#0f172a;">Emitir cotización</h3>
                    <p style="margin:6px 0 20px;color:#64748b;font-size:13px;">${esc(S.cliente.nombre)} · ${S.modo === 'ampliar' ? 'Ampliación de plazo' : 'Liquidación'}</p>
                    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;">${btn('pdf', 'PDF', '#1e40af')}${btn('ticket', 'Ticket', '#7c3aed')}${btn('imagen', 'Imagen', '#047857')}</div>
                    <button onclick="document.querySelector('[data-modal=&quot;cql-emitir&quot;]')?.remove()" style="width:100%;margin-top:12px;padding:10px;border:0;border-radius:7px;background:#e2e8f0;color:#334155;font-weight:bold;cursor:pointer;">Cancelar</button>
                </div>
            </div>`);
    };
    window._cqlFormato = function (formato) {
        document.querySelector('[data-modal="cql-emitir"]')?.remove();
        return emitir(formato);
    };
    window._cqlCopiar = function () {
        const ctx = contexto();
        if (!ctx) return;
        const texto = lineasResumen(ctx).join('\n');
        (navigator.clipboard ? navigator.clipboard.writeText(texto) : Promise.reject()).then(() => alert('Resumen copiado.')).catch(() => prompt('Copia el resumen:', texto));
    };

    window.abrirCotizarLiquidacion = function (folio) { abrir(folio); };
    window._cqlAnalizar = analizar; window._cqlPlazos = plazosPosibles; window._cqlCotizar = cotizar; window._cqlPlanesAmp = planesAmpliacion; window._cqlSimAmp = simularAmpliacion; // pruebas / consola
    window._cqlDocs = { S, contexto, bloques, docHtml, ticketHtml, lineasResumen, fechaLimiteLiquidar, planActual, fechasAmpliacion, cargarLogo }; // pruebas / consola
})();
