// ================================================================
// 📈 MÓDULO: KPIs DE CARTERA (Cobranza)
// Panel de control de la cartera de crédito. SOLO LECTURA: no escribe
// nada en StorageService ni toca caja, inventario o cuentas.
//
// Usa las MISMAS definiciones de mora que ya tiene el sistema:
//  - Antigüedad = días desde el último abono (o desde la venta si aún no
//    hay abonos), vía CobranzaRiskService.analizarCartera
//    (bajo <=30, riesgo 31-60, alto 61-120, alerta 121+).
//  - Cuentas vivas = no canceladas, no incobrables, no saldadas, y no
//    apartados.
// Lee: cuentasPorCobrar, pagaresSistema (y, si existe, el resumen de
// rentabilidad de cartera para "recuperación de costo").
//
// Las metas semáforo (RCK_META) y las tasas de provisión (RCK_PROVISION)
// son PUNTOS DE PARTIDA de trabajo, no cifras oficiales: calíbralas con
// tu propio historial de 6-12 meses.
// ================================================================

// Metas semáforo. Para "menor es mejor": verde si valor <= verde;
// ámbar si <= ambar; rojo si es mayor. Para "mayor es mejor": al revés.
// Calibración (ver "Referencias externas" en la guía del panel, cifras de jun 2026):
//  - PAR90 (~IMOR): bancos/tiendas con crédito minorista reportan 4.7%-6.7%.
//  - PAR30: el estándar de microfinanzas es ~5%; para venta a crédito sin buró
//    se tolera más, por eso 8%/15% (estimación propia, no cifra publicada).
//  - FPD e incobrable: sin referencia pública sólida; son puntos de partida.
const RCK_META = {
    par30:   { verde: 8,  ambar: 15, mejor: 'menor' },
    par60:   { verde: 6,  ambar: 10, mejor: 'menor' },
    par90:   { verde: 5,  ambar: 8,  mejor: 'menor' },
    imora:   { verde: 8,  ambar: 12, mejor: 'menor' },
    eficiencia: { verde: 90, ambar: 80, mejor: 'mayor' },
    fpd:     { verde: 8,  ambar: 15, mejor: 'menor' },
    incobrable: { verde: 3, ambar: 6, mejor: 'menor' }
};

// Provisión sugerida por antigüedad (días sin pago). Supuestos de trabajo.
const RCK_PROVISION = [
    { hasta: 30,  tasa: 0.02, etiqueta: '0-30 días' },
    { hasta: 60,  tasa: 0.10, etiqueta: '31-60 días' },
    { hasta: 90,  tasa: 0.30, etiqueta: '61-90 días' },
    { hasta: 120, tasa: 0.60, etiqueta: '91-120 días' },
    { hasta: Infinity, tasa: 0.90, etiqueta: '121+ días' }
];

const RCK_MS_DIA = 24 * 60 * 60 * 1000;

// Definición de mora:
//  'dpd'     = días de atraso del pago vencido más antiguo (estándar de bancos y
//              microfinanzas; es la que sirve para comparar contra otras empresas).
//  'sinpago' = días desde el último abono (la misma que usa ARC / Mi Cartera del Día).
function _rckModoMora() {
    try { return localStorage.getItem('rckModoMora') === 'sinpago' ? 'sinpago' : 'dpd'; } catch (e) { return 'dpd'; }
}
window.rckSetModoMora = function (modo) {
    try { localStorage.setItem('rckModoMora', modo === 'sinpago' ? 'sinpago' : 'dpd'); } catch (e) { /* sin almacenamiento */ }
    if (typeof window.renderKpisCartera === 'function') window.renderKpisCartera();
};

// ---------------------------------------------------------------
// 🔧 Helpers
// ---------------------------------------------------------------
function _rckEsc(v) {
    return typeof window._esc === 'function' ? window._esc(v) : String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
}
function _rckDinero(v) {
    return typeof window.formatearDineroMX === 'function'
        ? window.formatearDineroMX(v)
        : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(v) || 0);
}
function _rckPct(v, dec = 1) {
    const n = Number(v);
    return Number.isFinite(n) ? `${n.toFixed(dec)}%` : '—';
}
function _rckArr(key) {
    const val = (typeof StorageService !== 'undefined') ? StorageService.get(key, []) : [];
    return Array.isArray(val) ? val : [];
}
function _rckParseFecha(v) {
    if (window.CobranzaRiskService?.parseFecha) return window.CobranzaRiskService.parseFecha(v);
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
}
function _rckInicioDia(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
}
function _rckDiasEntre(desde, hasta) {
    return Math.max(0, Math.floor((_rckInicioDia(hasta) - _rckInicioDia(desde)) / RCK_MS_DIA));
}
function _rckClaveMes(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function _rckEtiquetaMes(d) {
    return d.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' }).replace('.', '');
}
function _rckFechaCorta(d) {
    if (!d) return 'Sin pago';
    return typeof window.formatearFechaCortaMX === 'function'
        ? window.formatearFechaCortaMX(d)
        : d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function _rckPorcentaje(n, d) {
    return d > 0 ? (n / d) * 100 : 0;
}

function _rckCancelada(c) {
    return String(c?.estado || c?.estatus || '').toLowerCase().includes('cancel');
}
function _rckEsApartado(c) {
    return String(c?.metodo || '').toLowerCase() === 'apartado';
}
function _rckAbonoValido(a) {
    if (!a) return false;
    const estado = String(a.estado || a.estatus || '').toLowerCase();
    if (estado.includes('cancel') || estado.includes('anulad')) return false;
    if (a.cancelado || a.canceladoPorVenta || a.canceladoPorApartado) return false;
    return Number(a.monto || a.abono || a.importe || a.montoAbonado || 0) > 0;
}
function _rckAbonosCuenta(c) {
    return (Array.isArray(c?.abonos) ? c.abonos : [])
        .filter(_rckAbonoValido)
        .map(a => ({
            monto: Number(a.monto || a.abono || a.importe || a.montoAbonado || 0),
            fecha: _rckParseFecha(a.fechaAbonoIso || a.fechaIso || a.fechaAbonoRaw || a.fechaAbono || a.fechaPago || a.fecha || a.createdAt)
        }))
        .filter(x => x.fecha)
        .sort((x, y) => x.fecha - y.fecha);
}
function _rckFechaVenta(c) {
    return _rckParseFecha(c?.fechaVenta || c?.fechaVentaIso || c?.fechaIso || c?.fecha || c?.fechaRegistro || c?.createdAt);
}
function _rckPagareRestante(p) {
    return Math.max(0, Number(p.monto || 0) - Number(p.montoAbonado || p.abonado || 0));
}
function _rckPagarePendiente(p) {
    return !['pagado', 'cancelado'].includes(String(p.estado || '').toLowerCase());
}
function _rckSaldoCuenta(c, pagaresPorFolio) {
    const directo = Number(c?.saldoActual ?? c?.saldoPendiente ?? c?.saldo ?? 0);
    if (directo > 0) return directo;
    const lista = pagaresPorFolio.get(String(c?.folio || '')) || [];
    return lista.filter(_rckPagarePendiente).reduce((s, p) => s + _rckPagareRestante(p), 0);
}
function _rckPlazoMeses(c) {
    const plan = c?.plan || {};
    const meses = Number(plan.meses || 0);
    if (meses > 0) return meses;
    const pagos = Number(plan.pagos || plan.plazo || 0);
    if (!pagos) return 0;
    const per = String(c?.periodicidad || plan.periodicidad || 'semanal').toLowerCase();
    const dias = per === 'quincenal' ? 14 : per === 'mensual' ? 30 : 7;
    return (pagos * dias) / 30.44;
}

// Semáforo
function _rckSemaforo(valor, meta) {
    if (!meta || !Number.isFinite(valor)) return { color: '#475569', txt: '' };
    const verde = '#16a34a', ambar = '#d97706', rojo = '#dc2626';
    if (meta.mejor === 'mayor') {
        if (valor >= meta.verde) return { color: verde, txt: 'En meta' };
        if (valor >= meta.ambar) return { color: ambar, txt: 'Atención' };
        return { color: rojo, txt: 'Crítico' };
    }
    if (valor <= meta.verde) return { color: verde, txt: 'En meta' };
    if (valor <= meta.ambar) return { color: ambar, txt: 'Atención' };
    return { color: rojo, txt: 'Crítico' };
}
function _rckMetaTxt(meta, unidad = '%') {
    if (!meta) return '';
    return meta.mejor === 'mayor'
        ? `Meta ≥ ${meta.verde}${unidad} · alerta < ${meta.ambar}${unidad}`
        : `Meta ≤ ${meta.verde}${unidad} · alerta > ${meta.ambar}${unidad}`;
}

// ---------------------------------------------------------------
// 🧮 MOTOR DE CÁLCULO
// ---------------------------------------------------------------
function _rckCalcular(hoy = new Date()) {
    const todas = _rckArr('cuentasPorCobrar');
    const pagares = _rckArr('pagaresSistema');

    // Cuentas de crédito reales (sin canceladas ni apartados). Incluye saldadas e incobrables.
    const credito = todas.filter(c => c && !_rckCancelada(c) && !_rckEsApartado(c));
    const folios = new Set(credito.map(c => String(c.folio || '')));

    const pagaresPorFolio = new Map();
    pagares.forEach(p => {
        const f = String(p.folio || p.folioVenta || '');
        if (!f || !folios.has(f)) return;
        if (String(p.estado || '').toLowerCase() === 'cancelado') return;
        if (!pagaresPorFolio.has(f)) pagaresPorFolio.set(f, []);
        pagaresPorFolio.get(f).push(p);
    });

    const servicio = window.CobranzaRiskService;
    if (!servicio?.analizarCartera) return { error: 'No está disponible CobranzaRiskService (js/services/cobranza-risk-service.js).' };

    // ----- Cartera viva (misma lógica que ARC / Mi Cartera del Día) -----
    const analisis = servicio.analizarCartera(credito, pagares, { hoy });
    const items = analisis.items; // ya excluye saldadas, canceladas e incobrables
    const modo = _rckModoMora();
    const hoyIni0 = _rckInicioDia(hoy);
    items.forEach(r => {
        let dias = r.diasSinPago;
        if (modo === 'dpd') {
            const lista = pagaresPorFolio.get(String(r.cuenta.folio || ''));
            if (lista && lista.length) {
                const vencidos = lista.filter(p => _rckPagarePendiente(p) && _rckPagareRestante(p) > 0.01)
                    .map(p => _rckParseFecha(p.fechaVencimiento)).filter(f => f && _rckInicioDia(f) < hoyIni0).sort((a, b) => a - b);
                dias = vencidos.length ? _rckDiasEntre(vencidos[0], hoy) : 0;
            }
        }
        r._rckDias = dias;
    });
    const carteraViva = items.reduce((s, r) => s + Number(r.saldo || 0), 0);
    const carteraPorDias = minDias => items.filter(r => r._rckDias > minDias).reduce((s, r) => s + Number(r.saldo || 0), 0);
    const par = {
        p30: _rckPorcentaje(carteraPorDias(30), carteraViva),
        p60: _rckPorcentaje(carteraPorDias(60), carteraViva),
        p90: _rckPorcentaje(carteraPorDias(90), carteraViva),
        p120: _rckPorcentaje(carteraPorDias(120), carteraViva),
        s30: carteraPorDias(30), s60: carteraPorDias(60), s90: carteraPorDias(90), s120: carteraPorDias(120)
    };

    // ----- Antigüedad (aging) y provisión sugerida -----
    const buckets = [
        { clave: '0-30', min: -1, max: 30, color: '#16a34a' },
        { clave: '31-60', min: 30, max: 60, color: '#d97706' },
        { clave: '61-90', min: 60, max: 90, color: '#ea580c' },
        { clave: '91-120', min: 90, max: 120, color: '#dc2626' },
        { clave: '121+', min: 120, max: Infinity, color: '#7e22ce' }
    ].map(b => {
        const lista = items.filter(r => r._rckDias > b.min && r._rckDias <= b.max);
        return { ...b, cuentas: lista.length, saldo: lista.reduce((s, r) => s + Number(r.saldo || 0), 0) };
    });
    const provisionDetalle = buckets.map((b, i) => ({ etiqueta: RCK_PROVISION[i].etiqueta, tasa: RCK_PROVISION[i].tasa, saldo: b.saldo, monto: b.saldo * RCK_PROVISION[i].tasa }));
    const provision = provisionDetalle.reduce((s, x) => s + x.monto, 0);

    // ----- Pagarés: exigible vencido y flujo esperado -----
    const foliosVivos = new Set(items.map(r => String(r.cuenta.folio || '')));
    const hoyIni = _rckInicioDia(hoy);
    const en7 = new Date(hoyIni.getTime() + 7 * RCK_MS_DIA);
    let exigibleVencido = 0, cuentasConVencido = 0, porCobrar7 = 0;
    const foliosConVencido = new Set();
    pagares.forEach(p => {
        const f = String(p.folio || p.folioVenta || '');
        if (!foliosVivos.has(f) || !_rckPagarePendiente(p)) return;
        const fv = _rckParseFecha(p.fechaVencimiento);
        if (!fv) return;
        const restante = _rckPagareRestante(p);
        if (restante <= 0.01) return;
        if (_rckInicioDia(fv) < hoyIni) { exigibleVencido += restante; foliosConVencido.add(f); }
        else if (_rckInicioDia(fv) <= en7) porCobrar7 += restante;
    });
    cuentasConVencido = foliosConVencido.size;

    // ----- Incobrable (castigada) -----
    const incobrables = credito.filter(c => c.incobrable === true);
    const saldoIncobrable = incobrables.reduce((s, c) => s + _rckSaldoCuenta(c, pagaresPorFolio), 0);
    const pctIncobrable = _rckPorcentaje(saldoIncobrable, carteraViva + saldoIncobrable);
    const imora = _rckPorcentaje(par.s90 + saldoIncobrable, carteraViva + saldoIncobrable);

    // ----- Cobranza mensual vs. exigible (últimos 6 meses) -----
    const meses = [];
    for (let i = 5; i >= 0; i--) {
        const ini = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1, 0, 0, 0);
        const finMes = new Date(hoy.getFullYear(), hoy.getMonth() - i + 1, 0, 23, 59, 59);
        const enCurso = i === 0;
        const fin = enCurso ? new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59) : finMes;
        meses.push({ ini, fin, etiqueta: _rckEtiquetaMes(ini), enCurso, exigible: 0, cobrado: 0 });
    }
    const idxMes = fecha => meses.findIndex(m => fecha >= m.ini && fecha <= m.fin);
    pagaresPorFolio.forEach(lista => lista.forEach(p => {
        const fv = _rckParseFecha(p.fechaVencimiento);
        if (!fv) return;
        const k = idxMes(fv);
        if (k >= 0) meses[k].exigible += Number(p.monto || 0);
    }));
    credito.forEach(c => _rckAbonosCuenta(c).forEach(a => {
        const k = idxMes(a.fecha);
        if (k >= 0) meses[k].cobrado += a.monto;
    }));
    meses.forEach(m => { m.eficiencia = m.exigible > 0 ? (m.cobrado / m.exigible) * 100 : NaN; });
    const cerrados = meses.slice(2, 5); // los 3 meses cerrados más recientes
    const efic3m = _rckPorcentaje(cerrados.reduce((s, m) => s + m.cobrado, 0), cerrados.reduce((s, m) => s + m.exigible, 0));
    const mesActual = meses[5];
    const hace30 = new Date(hoyIni.getTime() - 30 * RCK_MS_DIA);
    let cobrado30 = 0;
    credito.forEach(c => _rckAbonosCuenta(c).forEach(a => { if (a.fecha >= hace30 && a.fecha <= hoy) cobrado30 += a.monto; }));

    // ----- Originación: ventanas de 90 y 180 días -----
    const hace90 = new Date(hoyIni.getTime() - 90 * RCK_MS_DIA);
    const hace180 = new Date(hoyIni.getTime() - 180 * RCK_MS_DIA);
    let fpdElegibles = 0, fpdFallan = 0;
    let nOrig = 0, sumTotal = 0, sumEnganche = 0, sumCapital = 0, sumFinanciado = 0, sumPlazo = 0, nPlazo = 0;
    credito.forEach(c => {
        const fv = _rckFechaVenta(c);
        if (!fv) return;
        if (fv >= hace90) {
            const lista = (pagaresPorFolio.get(String(c.folio || '')) || []).map(p => _rckParseFecha(p.fechaVencimiento)).filter(Boolean).sort((a, b) => a - b);
            if (lista.length) {
                const primerVenc = lista[0];
                if (_rckInicioDia(new Date(primerVenc.getTime() + 7 * RCK_MS_DIA)) < hoyIni) {
                    fpdElegibles++;
                    if (_rckAbonosCuenta(c).length === 0) fpdFallan++;
                }
            }
        }
        if (fv >= hace180) {
            const total = Number(c.totalMercancia || c.totalContadoOriginal || 0);
            const eng = Number(c.engancheRecibido || 0);
            const capital = Math.max(0, total - eng);
            const financiado = Number(c.saldoOriginal || c.plan?.total || 0);
            if (total > 0) {
                nOrig++; sumTotal += total; sumEnganche += eng; sumCapital += capital; sumFinanciado += financiado;
                const pm = _rckPlazoMeses(c);
                if (pm > 0) { sumPlazo += pm; nPlazo++; }
            }
        }
    });
    const originacion = {
        fpd: _rckPorcentaje(fpdFallan, fpdElegibles), fpdElegibles, fpdFallan,
        nOrig,
        ticket: nOrig ? sumTotal / nOrig : 0,
        enganchePct: _rckPorcentaje(sumEnganche, sumTotal),
        recargoPct: _rckPorcentaje(sumFinanciado - sumCapital, sumCapital),
        plazoMeses: nPlazo ? sumPlazo / nPlazo : 0
    };

    // ----- Concentración: top 10 clientes -----
    const porCliente = new Map();
    items.forEach(r => {
        const k = String(r.cuenta.clienteId || r.cuenta.nombre || 'N/D');
        const reg = porCliente.get(k) || { nombre: r.cuenta.nombre || 'N/D', saldo: 0 };
        reg.saldo += Number(r.saldo || 0);
        porCliente.set(k, reg);
    });
    const topClientes = Array.from(porCliente.values()).sort((a, b) => b.saldo - a.saldo).slice(0, 10);
    const concentracionTop10 = _rckPorcentaje(topClientes.reduce((s, c) => s + c.saldo, 0), carteraViva);

    // ----- Por vendedor -----
    const porVend = new Map();
    items.forEach(r => {
        const k = r.cuenta.vendedorNombre || 'Sin vendedor';
        const reg = porVend.get(k) || { vendedor: k, cuentas: 0, saldo: 0, saldo30: 0 };
        reg.cuentas++; reg.saldo += Number(r.saldo || 0);
        if (r._rckDias > 30) reg.saldo30 += Number(r.saldo || 0);
        porVend.set(k, reg);
    });
    const vendedores = Array.from(porVend.values()).map(v => ({ ...v, par30: _rckPorcentaje(v.saldo30, v.saldo) })).sort((a, b) => b.saldo - a.saldo).slice(0, 10);

    // ----- Cosechas por mes de venta (últimos 6 meses) -----
    const itemPorFolio = new Map(items.map(r => [String(r.cuenta.folio || ''), r]));
    const cosechas = [];
    for (let i = 5; i >= 0; i--) {
        const ini = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
        const fin = new Date(hoy.getFullYear(), hoy.getMonth() - i + 1, 0, 23, 59, 59);
        let cuentas = 0, financiado = 0, cobrado = 0, saldoVivo = 0, saldoVivo30 = 0, nInc = 0;
        credito.forEach(c => {
            const fv = _rckFechaVenta(c);
            if (!fv || fv < ini || fv > fin) return;
            cuentas++;
            financiado += Number(c.saldoOriginal || c.plan?.total || 0);
            cobrado += _rckAbonosCuenta(c).reduce((s, a) => s + a.monto, 0);
            if (c.incobrable === true) nInc++;
            const it = itemPorFolio.get(String(c.folio || ''));
            if (it) { saldoVivo += Number(it.saldo || 0); if (it._rckDias > 30) saldoVivo30 += Number(it.saldo || 0); }
        });
        cosechas.push({ etiqueta: _rckEtiquetaMes(ini), cuentas, financiado, cobradoPct: _rckPorcentaje(cobrado, financiado), saldoVivo, par30: _rckPorcentaje(saldoVivo30, saldoVivo), nInc });
    }

    // ----- Tendencia reconstruida desde abonos (cierre de cada mes) -----
    const abonosPorCuenta = credito.map(c => {
        let cum = 0;
        const sched = (pagaresPorFolio.get(String(c.folio || '')) || [])
            .map(p => ({ due: _rckParseFecha(p.fechaVencimiento), monto: Number(p.monto || 0) }))
            .filter(x => x.due && x.monto > 0).sort((a, b) => a.due - b.due)
            .map(x => { cum += x.monto; return { due: x.due, cum }; });
        return { c, fv: _rckFechaVenta(c), orig: Number(c.saldoOriginal || c.plan?.total || 0), abonos: _rckAbonosCuenta(c), sched };
    }).filter(x => x.fv && x.orig > 0);
    const tendencia = [];
    for (let i = 5; i >= 0; i--) {
        const corte = i === 0 ? hoy : new Date(hoy.getFullYear(), hoy.getMonth() - i + 1, 0, 12, 0, 0);
        let cartera = 0, s30 = 0, s60 = 0, s90 = 0, n = 0;
        abonosPorCuenta.forEach(x => {
            if (x.fv > corte) return;
            let cobrado = 0, ultima = x.fv;
            for (const a of x.abonos) { if (a.fecha > corte) break; cobrado += a.monto; ultima = a.fecha; }
            const saldo = x.orig - cobrado;
            if (saldo <= 0.01) return;
            let dias = _rckDiasEntre(ultima, corte);
            if (modo === 'dpd' && x.sched.length) {
                // Días de atraso del primer pago programado que el cobrado acumulado aún no cubre.
                const primero = x.sched.find(q => q.cum > cobrado + 0.5);
                dias = (primero && _rckInicioDia(primero.due) < _rckInicioDia(corte)) ? _rckDiasEntre(primero.due, corte) : 0;
            }
            cartera += saldo; n++;
            if (dias > 30) s30 += saldo;
            if (dias > 60) s60 += saldo;
            if (dias > 90) s90 += saldo;
        });
        tendencia.push({ etiqueta: i === 0 ? 'Hoy' : _rckEtiquetaMes(corte), cartera, cuentas: n, par30: _rckPorcentaje(s30, cartera), par60: _rckPorcentaje(s60, cartera), par90: _rckPorcentaje(s90, cartera) });
    }

    // ----- Cuentas críticas (>60 días sin pago), por saldo -----
    const criticas = items.filter(r => r._rckDias > 60).sort((a, b) => b.saldo - a.saldo).slice(0, 10);

    // ----- Promesas de pago -----
    const promesasVigentes = items.filter(r => r.promesa?.vigente).length;
    const promesasVencidas = items.filter(r => r.promesa?.vencida).length;
    const sinPrimerPago = analisis.resumen.sinPrimerPago;

    // ----- Recuperación de costo (opcional: módulo de rentabilidad) -----
    let costo = null;
    try {
        if (typeof window.obtenerResumenRentabilidadCartera === 'function') {
            const r = window.obtenerResumenRentabilidadCartera();
            costo = { totalCuentas: r.totalCuentas, enGanancia: r.enGanancia, cobrado: r.cobradoTotalCartera, costo: r.costoTotalCartera, pctCobradoVsCosto: _rckPorcentaje(r.cobradoTotalCartera, r.costoTotalCartera) };
        }
    } catch (e) { costo = null; }

    return {
        generado: hoy, modo, imora, cuentasVivas: items.length, carteraViva, par, buckets, provision, provisionDetalle,
        exigibleVencido, cuentasConVencido, porCobrar7, incobrables: incobrables.length, saldoIncobrable, pctIncobrable,
        meses, efic3m, mesActual, cobrado30, originacion, topClientes, concentracionTop10, vendedores, cosechas,
        tendencia, criticas, promesasVigentes, promesasVencidas, sinPrimerPago, costo
    };
}
window._rckCalcular = _rckCalcular; // expuesto para pruebas / consola

// ---------------------------------------------------------------
// 🖼️ RENDER
// ---------------------------------------------------------------
function _rckCard(titulo, valor, opciones = {}) {
    const { sem, foot = '', meta = '', ayuda = '' } = opciones;
    const color = sem?.color || '#334155';
    const chip = sem?.txt ? `<span style="flex:0 0 auto;padding:1px 8px;border-radius:999px;background:${color}1a;color:${color};font-size:10px;font-weight:900;">${sem.txt}</span>` : '';
    return `<div title="${_rckEsc(ayuda)}" style="background:white;border:1px solid #e2e8f0;border-left:4px solid ${color};border-radius:8px;padding:14px;min-width:0;">
        <div style="font-size:11px;font-weight:900;color:#64748b;text-transform:uppercase;letter-spacing:.02em;">${titulo}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:4px;">
            <div style="font-size:22px;font-weight:900;color:${color};overflow-wrap:anywhere;">${valor}</div>${chip}
        </div>
        ${foot ? `<div style="font-size:12px;color:#64748b;margin-top:3px;">${foot}</div>` : ''}
        ${meta ? `<div style="font-size:11px;color:#94a3b8;margin-top:3px;">${meta}</div>` : ''}
    </div>`;
}
function _rckSeccion(titulo, subtitulo = '') {
    return `<div style="margin:24px 0 10px;"><h3 style="margin:0;color:#0f172a;font-size:16px;">${titulo}</h3>${subtitulo ? `<div style="color:#64748b;font-size:12px;margin-top:2px;">${subtitulo}</div>` : ''}</div>`;
}
function _rckGrid(html) {
    return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">${html}</div>`;
}
function _rckTabla(cabeceras, filasHtml, vacio = 'Sin datos.') {
    return `<div style="background:white;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;"><div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="background:#f8fafc;text-align:left;">${cabeceras.map((h, i) => `<th style="padding:9px 8px;${h.right ? 'text-align:right;' : ''}white-space:nowrap;">${h.t}</th>`).join('')}</tr></thead>
            <tbody>${filasHtml || `<tr><td colspan="${cabeceras.length}" style="padding:16px;text-align:center;color:#94a3b8;">${vacio}</td></tr>`}</tbody>
        </table></div></div>`;
}
function _rckTd(contenido, opts = {}) {
    return `<td style="padding:9px 8px;border-top:1px solid #f1f5f9;${opts.right ? 'text-align:right;' : ''}${opts.bold ? 'font-weight:800;' : ''}${opts.color ? `color:${opts.color};` : ''}">${contenido}</td>`;
}

window.renderKpisCartera = function () {
    const cont = document.getElementById('reporte-kpis-cartera');
    if (!cont) return;
    let d;
    try { d = _rckCalcular(new Date()); }
    catch (e) { console.error('KPIs cartera:', e); cont.innerHTML = `<div style="padding:20px;color:#991b1b;">No se pudieron calcular los KPIs: ${_rckEsc(e.message)}</div>`; return; }
    if (d.error) { cont.innerHTML = `<div style="padding:20px;color:#991b1b;">${_rckEsc(d.error)}</div>`; return; }

    const sPar30 = _rckSemaforo(d.par.p30, RCK_META.par30);
    const sPar60 = _rckSemaforo(d.par.p60, RCK_META.par60);
    const sPar90 = _rckSemaforo(d.par.p90, RCK_META.par90);
    const sEfAct = _rckSemaforo(d.mesActual.eficiencia, RCK_META.eficiencia);
    const sEf3 = _rckSemaforo(d.efic3m, RCK_META.eficiencia);
    const sFpd = _rckSemaforo(d.originacion.fpd, RCK_META.fpd);
    const sInc = _rckSemaforo(d.pctIncobrable, RCK_META.incobrable);
    const pctVencido = _rckPorcentaje(d.exigibleVencido, d.carteraViva);
    const esDpd = d.modo === 'dpd';
    const sImora = _rckSemaforo(d.imora, RCK_META.imora);
    const quePar = n => esDpd
        ? `Saldo de las cuentas con un pago vencido hace más de ${n} días ÷ cartera viva. Es la definición estándar (PAR${n}) de bancos y microfinancieras.`
        : `Saldo de las cuentas con más de ${n} días sin ningún abono ÷ cartera viva (misma regla que ARC).`;

    // --- Tarjetas: salud de la cartera ---
    const tarjetasSalud =
        _rckCard('Cartera viva', _rckDinero(d.carteraViva), { foot: `${d.cuentasVivas} cuenta(s) con saldo`, ayuda: 'Saldo por cobrar de cuentas activas (sin saldadas, canceladas, incobrables ni apartados).' }) +
        _rckCard('Mora > 30 días', _rckPct(d.par.p30), { sem: sPar30, foot: `${_rckDinero(d.par.s30)} de saldo`, meta: _rckMetaTxt(RCK_META.par30), ayuda: quePar(30) }) +
        _rckCard('Mora > 60 días', _rckPct(d.par.p60), { sem: sPar60, foot: `${_rckDinero(d.par.s60)} de saldo`, meta: _rckMetaTxt(RCK_META.par60), ayuda: quePar(60) }) +
        _rckCard('Cartera vencida > 90 días', _rckPct(d.par.p90), { sem: sPar90, foot: `${_rckDinero(d.par.s90)} de saldo`, meta: _rckMetaTxt(RCK_META.par90), ayuda: quePar(90) + ' Equivale al índice de morosidad (IMOR) que publican los bancos.' }) +
        _rckCard('Pagos vencidos (exigible)', _rckDinero(d.exigibleVencido), { foot: `${d.cuentasConVencido} cuenta(s) · ${_rckPct(pctVencido)} de la cartera`, ayuda: 'Suma de pagarés ya vencidos y no pagados (solo la parte atrasada, no el saldo completo).' }) +
        _rckCard('Por cobrar próximos 7 días', _rckDinero(d.porCobrar7), { foot: 'Pagarés que vencen esta semana', ayuda: 'Flujo esperado de cobranza si todos pagan a tiempo.' }) +
        _rckCard('Provisión sugerida', _rckDinero(d.provision), { foot: `${_rckPct(_rckPorcentaje(d.provision, d.carteraViva))} de la cartera viva`, ayuda: 'Pérdida esperada estimada con tasas de trabajo por antigüedad (ajustables en RCK_PROVISION).' }) +
        _rckCard('Incobrable (castigada)', _rckPct(d.pctIncobrable), { sem: sInc, foot: `${d.incobrables} cuenta(s) · ${_rckDinero(d.saldoIncobrable)}`, meta: _rckMetaTxt(RCK_META.incobrable), ayuda: 'Saldo marcado como incobrable ÷ (cartera viva + incobrable).' }) +
        _rckCard('Morosidad ajustada (aprox.)', _rckPct(d.imora), { sem: sImora, foot: 'Vencida > 90 días + incobrable', meta: _rckMetaTxt(RCK_META.imora), ayuda: 'Parecida al IMORA bancario: suma la cartera vencida y lo castigado. Aquí cuenta TODO lo marcado incobrable a la fecha, no solo los últimos 12 meses, por eso es una aproximación.' });

    // --- Tarjetas: cobranza ---
    const tarjetasCobranza =
        _rckCard('Eficiencia del mes (a la fecha)', _rckPct(d.mesActual.eficiencia), { sem: sEfAct, foot: `${_rckDinero(d.mesActual.cobrado)} cobrado de ${_rckDinero(d.mesActual.exigible)} exigible`, meta: _rckMetaTxt(RCK_META.eficiencia), ayuda: 'Cobrado en el mes ÷ pagarés que vencen en el mes hasta hoy. Puede pasar de 100% si se recuperan atrasos.' }) +
        _rckCard('Eficiencia últimos 3 meses', _rckPct(d.efic3m), { sem: sEf3, foot: 'Meses cerrados', meta: _rckMetaTxt(RCK_META.eficiencia), ayuda: 'Cobrado ÷ exigible de los 3 meses cerrados más recientes.' }) +
        _rckCard('Cobrado últimos 30 días', _rckDinero(d.cobrado30), { foot: 'Abonos aplicados (sin enganches)' }) +
        _rckCard('Promesas de pago', `${d.promesasVigentes} vigentes`, { foot: `${d.promesasVencidas} vencida(s) sin cumplir`, color: '#334155', ayuda: 'Cuentas con promesa de pago registrada.' });

    // --- Tarjetas: originación ---
    const o = d.originacion;
    const tarjetasOrig =
        _rckCard('Sin primer pago (FPD)', _rckPct(o.fpd), { sem: sFpd, foot: `${o.fpdFallan} de ${o.fpdElegibles} ventas de los últimos 90 días`, meta: _rckMetaTxt(RCK_META.fpd), ayuda: 'Ventas a crédito de los últimos 90 días cuyo primer pagaré venció hace más de 7 días y no tienen ningún abono. Mide la calidad de la venta (a quién se le vende).' }) +
        _rckCard('Enganche promedio', _rckPct(o.enganchePct), { foot: `${o.nOrig} ventas a crédito en 180 días`, ayuda: 'Enganche ÷ valor de la mercancía, ponderado. Más enganche = menos riesgo.' }) +
        _rckCard('Ticket de crédito promedio', _rckDinero(o.ticket), { foot: 'Valor de mercancía por venta' }) +
        _rckCard('Plazo promedio', o.plazoMeses ? `${o.plazoMeses.toFixed(1)} meses` : '—', { foot: 'Ventas de los últimos 180 días' }) +
        _rckCard('Recargo financiero promedio', _rckPct(o.recargoPct), { foot: 'Lo financiado sobre el capital', ayuda: '(Total de pagarés − capital financiado) ÷ capital financiado.' }) +
        _rckCard('Top 10 clientes', _rckPct(d.concentracionTop10), { foot: 'Del saldo de la cartera viva', ayuda: 'Concentración: qué parte de la cartera está en 10 clientes.' });

    // Complemento de rentabilidad (usa el módulo Rentabilidad de Cartera, si está cargado).
    let tarjetaCosto = '';
    if (d.costo) {
        tarjetaCosto = _rckCard('Cuentas ya en ganancia', `${d.costo.enGanancia} de ${d.costo.totalCuentas}`, { foot: `Cobrado ${_rckPct(d.costo.pctCobradoVsCosto, 0)} del costo de la mercancía`, ayuda: 'Del módulo Rentabilidad de Cartera.' });
    }

    // --- Antigüedad (barras) ---
    const maxSaldo = Math.max(1, ...d.buckets.map(b => b.saldo));
    const aging = d.buckets.map(b => `
        <div style="display:grid;grid-template-columns:90px 1fr 190px;gap:10px;align-items:center;padding:6px 0;">
            <div style="font-weight:800;font-size:13px;color:#334155;">${b.clave} días</div>
            <div style="background:#f1f5f9;border-radius:6px;height:16px;overflow:hidden;"><div style="width:${(b.saldo / maxSaldo) * 100}%;background:${b.color};height:100%;"></div></div>
            <div style="font-size:12px;color:#475569;text-align:right;"><b>${_rckDinero(b.saldo)}</b> · ${_rckPct(_rckPorcentaje(b.saldo, d.carteraViva), 0)} · ${b.cuentas} cta.</div>
        </div>`).join('');

    // --- Eficiencia por mes ---
    const filasMeses = d.meses.map(m => {
        const s = _rckSemaforo(m.eficiencia, RCK_META.eficiencia);
        return `<tr>${_rckTd(`${_rckEsc(m.etiqueta)}${m.enCurso ? ' <small style="color:#94a3b8;">(a la fecha)</small>' : ''}`, { bold: true })}${_rckTd(_rckDinero(m.exigible), { right: true })}${_rckTd(_rckDinero(m.cobrado), { right: true })}${_rckTd(_rckPct(m.eficiencia), { right: true, bold: true, color: s.color })}</tr>`;
    }).join('');

    // --- Tendencia reconstruida ---
    const filasTend = d.tendencia.map(t => `<tr>${_rckTd(_rckEsc(t.etiqueta), { bold: true })}${_rckTd(_rckDinero(t.cartera), { right: true })}${_rckTd(String(t.cuentas), { right: true })}${_rckTd(_rckPct(t.par30), { right: true, color: _rckSemaforo(t.par30, RCK_META.par30).color, bold: true })}${_rckTd(_rckPct(t.par60), { right: true, color: _rckSemaforo(t.par60, RCK_META.par60).color, bold: true })}${_rckTd(_rckPct(t.par90), { right: true, color: _rckSemaforo(t.par90, RCK_META.par90).color, bold: true })}</tr>`).join('');

    // --- Cosechas ---
    const filasCos = d.cosechas.map(c => `<tr>${_rckTd(_rckEsc(c.etiqueta), { bold: true })}${_rckTd(String(c.cuentas), { right: true })}${_rckTd(_rckDinero(c.financiado), { right: true })}${_rckTd(_rckPct(c.cobradoPct, 0), { right: true })}${_rckTd(_rckDinero(c.saldoVivo), { right: true })}${_rckTd(c.saldoVivo > 0 ? _rckPct(c.par30) : '—', { right: true, bold: true, color: c.saldoVivo > 0 ? _rckSemaforo(c.par30, RCK_META.par30).color : '#94a3b8' })}${_rckTd(String(c.nInc), { right: true })}</tr>`).join('');

    // --- Vendedores ---
    const filasVend = d.vendedores.map(v => `<tr>${_rckTd(_rckEsc(v.vendedor), { bold: true })}${_rckTd(String(v.cuentas), { right: true })}${_rckTd(_rckDinero(v.saldo), { right: true })}${_rckTd(_rckPct(v.par30), { right: true, bold: true, color: _rckSemaforo(v.par30, RCK_META.par30).color })}</tr>`).join('');

    // --- Cuentas críticas: productos como identificador principal, folio chico y secundario ---
    const resumenProd = a => (typeof window.resumenProductosVenta === 'function') ? window.resumenProductosVenta(a) : _rckEsc((a || []).map(x => x.nombre).join(', '));
    const filasCrit = d.criticas.map(r => `<tr>
        ${_rckTd(`${resumenProd(r.cuenta.articulos)}<br><small style="color:#64748b;">${_rckEsc(r.cuenta.nombre || '')}</small> <small style="color:#94a3b8;">· ${_rckEsc(r.cuenta.folio || '')}</small>`)}
        ${_rckTd(String(r.diasSinPago), { right: true, bold: true, color: '#991b1b' })}
        ${_rckTd(_rckFechaCorta(r.fechaUltimoPago))}
        ${_rckTd(_rckDinero(r.saldo), { right: true, bold: true })}
        ${_rckTd(r.promesa?.vigente ? 'Promesa vigente' : (r.promesa?.vencida ? 'Promesa vencida' : '—'))}
    </tr>`).join('');

    const guia = `
        <details style="margin-top:24px;background:white;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;">
            <summary style="cursor:pointer;font-weight:900;color:#0f172a;">📖 Cómo leer estos indicadores y qué hacer con cada uno</summary>
            <div style="font-size:13px;color:#334155;line-height:1.5;margin-top:10px;">
                <p><b>Dos formas de contar la mora.</b> "Pagos vencidos (estándar)" cuenta los días de atraso del pago vencido más antiguo; es la definición que usan bancos y microfinancieras, así que es la que sirve para compararte. "Días sin pago (como ARC)" cuenta desde el último abono, igual que Mi Cartera del Día. El selector de arriba cambia todo el panel.</p>
                <p><b>Mora (PAR 30/60/90).</b> Porcentaje de la cartera en cuentas con más de N días de atraso. Es el indicador principal de salud: mide cuánto dinero está en riesgo, no solo cuántas cuentas. El de 90 días es el que usan los bancos para declarar cartera vencida (índice de morosidad). Si sube PAR30 antes que PAR90, todavía estás a tiempo de actuar.</p>
                <p><b>Pagos vencidos (exigible).</b> Solo lo que ya debió pagarse y no se pagó. Es el número de trabajo diario para el equipo de cobranza.</p>
                <p><b>Eficiencia de cobranza.</b> Cobrado ÷ lo que tocaba cobrar en el mes. Cerca de 100% significa cobranza sana; abajo de 80% la cartera se está deteriorando aunque las ventas vayan bien.</p>
                <p><b>Sin primer pago (FPD).</b> Si el cliente ni siquiera hace el primer pago, el problema es a quién se le vende (o cómo se verificó), no la cobranza. Revísalo por vendedor y por mes de venta.</p>
                <p><b>Calidad por mes de venta.</b> Compara generaciones de ventas: si las de un mes tienen más mora que las anteriores, algo cambió en la originación (promoción, enganche menor, plazo más largo, vendedor nuevo).</p>
                <p><b>Provisión sugerida.</b> Cuánto conviene tener presente como pérdida probable según la antigüedad. Es un estimado con tasas de trabajo; ajústalas a tu propio historial.</p>
                <p><b>Tendencia reconstruida.</b> Se calcula con los abonos registrados, sin considerar condonaciones ni reestructuras; por eso "Hoy" puede diferir un poco de las tarjetas de arriba. Sirve para ver la dirección, no el decimal.</p>
                <p><b>Morosidad ajustada.</b> Los bancos publican también el IMORA, que suma lo castigado a la cartera vencida, porque el IMOR solo se ve "bien" si se castiga mucho. Aquí es una aproximación con lo marcado como incobrable.</p>
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin:10px 0;">
                    <b>Referencias externas (publicadas a junio de 2026; revisa las fechas antes de usarlas)</b>
                    <ul style="margin:6px 0 0 18px;padding:0;">
                        <li>Banca múltiple, crédito al consumo: IMOR 3.3% (CNBV, jun 2026). Préstamos personales 5.2% y microcréditos 4.7%.</li>
                        <li>Crédito en tiendas: Banco Azteca 5.35% (jun 2026; 3.9% un año antes), BanCoppel 6.7% (4.4% al cierre de 2025) y Liverpool, índice de cartera vencida de 4.7% (2T 2026).</li>
                        <li>Otros: Sofipos 11.2% y cooperativas de ahorro (SOCAPS) 4.35%.</li>
                        <li>Con castigos incluidos (IMORA, jun 2026): consumo 11.3% y tarjetas 13.7%.</li>
                        <li>Microfinanzas: el estándar citado para PAR30 es cerca de 5%; en la industria microfinanciera de India (2022) la eficiencia de cobranza reportada fue de 95% a 99%.</li>
                    </ul>
                    <div style="color:#64748b;margin-top:6px;">Los bancos miden vencida a 90 días y castigan grandes montos que no aparecen en el IMOR. Para primer pago (FPD) y porcentaje incobrable no encontré una referencia pública sólida: son puntos de partida.</div>
                </div>
                <p style="color:#64748b;"><b>Sobre las metas (semáforo).</b> Están calibradas con las referencias de arriba (mora a 90 días entre 5% y 8%, PAR30 estimado entre el estándar de microfinanzas y el crédito minorista); no son cifras oficiales ni de tu giro en particular. Después de 2-3 meses de uso, ajústalas en <code>RCK_META</code> con lo que realmente es "normal" en tu tienda.</p>
            </div>
        </details>`;

    cont.innerHTML = `
        <div style="max-width:1200px;margin:0 auto;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;">
                <div>
                    <h2 style="margin:0 0 4px;color:#0f172a;">📈 KPIs de Cartera</h2>
                    <p style="color:#64748b;margin:0;">Los indicadores que conviene vigilar del crédito: salud, cobranza y calidad de la venta.</p>
                </div>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                    <div title="Cómo se cuenta la mora en todo el panel" style="display:inline-flex;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;background:white;">
                        <button onclick="rckSetModoMora('dpd')" style="padding:8px 12px;border:0;cursor:pointer;font-weight:700;${esDpd ? 'background:#0f172a;color:white;' : 'background:white;color:#334155;'}">Pagos vencidos (estándar)</button>
                        <button onclick="rckSetModoMora('sinpago')" style="padding:8px 12px;border:0;border-left:1px solid #cbd5e1;cursor:pointer;font-weight:700;${esDpd ? 'background:white;color:#334155;' : 'background:#0f172a;color:white;'}">Días sin pago (como ARC)</button>
                    </div>
                    <button onclick="renderKpisCartera()" style="padding:8px 14px;border:1px solid #cbd5e1;background:white;border-radius:8px;cursor:pointer;font-weight:700;">↻ Actualizar</button>
                </div>
            </div>
            <div style="font-size:11px;color:#94a3b8;margin-top:4px;">Calculado ${_rckEsc(_rckFechaCorta(d.generado))} ${d.generado.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} · solo lectura</div>

            ${_rckSeccion('Salud de la cartera', 'Cuánto dinero está en la calle y qué tan en riesgo está.')}
            ${_rckGrid(tarjetasSalud)}

            ${_rckSeccion('Antigüedad de la cartera', esDpd ? 'Días de atraso del pago vencido más antiguo de cada cuenta.' : 'Días sin pago por cuenta (mismos rangos que ARC).')}
            <div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px;">${aging}</div>

            ${_rckSeccion('Cobranza', 'Cuánto se está cobrando contra lo que tocaba cobrar.')}
            ${_rckGrid(tarjetasCobranza)}
            <div style="margin-top:12px;">${_rckTabla([{ t: 'Mes' }, { t: 'Exigible (vencimientos)', right: true }, { t: 'Cobrado', right: true }, { t: 'Eficiencia', right: true }], filasMeses)}</div>

            ${_rckSeccion('Calidad de la venta a crédito', 'Lo que se decide al vender: a quién, con cuánto enganche y a qué plazo.')}
            ${_rckGrid(tarjetasOrig + tarjetaCosto)}

            ${_rckSeccion('Tendencia de la mora (reconstruida)', 'Cierre de cada mes, calculado con los abonos registrados.')}
            ${_rckTabla([{ t: 'Corte' }, { t: 'Cartera', right: true }, { t: 'Cuentas', right: true }, { t: '> 30 días', right: true }, { t: '> 60 días', right: true }, { t: '> 90 días', right: true }], filasTend)}

            ${_rckSeccion('Calidad por mes de venta', 'Cada mes de ventas como una generación. Las más recientes llevan menos cobrado de forma natural: compara la columna de mora.')}
            ${_rckTabla([{ t: 'Mes de venta' }, { t: 'Ventas', right: true }, { t: 'Financiado', right: true }, { t: 'Cobrado a hoy', right: true }, { t: 'Saldo vivo', right: true }, { t: 'Mora > 30 d', right: true }, { t: 'Incobrables', right: true }], filasCos)}

            ${_rckSeccion('Por vendedor', 'Cartera viva y mora de lo que vendió cada uno (top 10 por saldo).')}
            ${_rckTabla([{ t: 'Vendedor' }, { t: 'Cuentas', right: true }, { t: 'Saldo', right: true }, { t: 'Mora > 30 d', right: true }], filasVend, 'Sin cartera viva.')}

            ${_rckSeccion('Cuentas críticas', `Más de 60 días ${esDpd ? 'de atraso' : 'sin pago'}, ordenadas por saldo (top 10).`)}
            ${_rckTabla([{ t: 'Producto / Cliente' }, { t: esDpd ? 'Días de atraso' : 'Días sin pago', right: true }, { t: 'Último pago' }, { t: 'Saldo', right: true }, { t: 'Promesa' }], filasCrit, 'No hay cuentas críticas. 👏')}

            ${guia}
        </div>`;
};
