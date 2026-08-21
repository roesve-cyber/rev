// ===== ESTADOS FINANCIEROS (Estado de Resultados + Balance General) =====
// Nuevo módulo. Reglas de origen de datos, para que quede documentado por qué
// cada cifra sale de donde sale:
//
// - Ingresos por ventas: ventasRegistradas (fechaVenta/fecha), menos
//   historialDevoluciones dentro del mismo rango.
// - Costo de ventas: movimientosInventario (kardex), tipo 'salida' con
//   folioVenta (venta real, no ajustes/mermas) menos tipo 'entrada' con
//   folioVenta (reingresos por cancelación/devolución) dentro del rango.
// - Gastos operativos: gastosOperativos, por fecha.
// - Préstamos incobrables: prestamosOtorgados con estado 'Incobrable',
//   por fecha de marcado.
// - Capital (aportaciones/retiros del dueño): NUEVO — capitalMovimientos,
//   ligado a caja real vía _ingresarCuenta/_egresarCuenta (referencia
//   CAPITAL-{id}), igual que el resto del sistema.
// - Balance General: el efectivo/bancos SÍ se reconstruye histórico a la
//   fecha de corte elegida (recorriendo movimientosCaja hacia atrás desde el
//   saldo actual). CxC, CxP, préstamos por cobrar e inventario se muestran
//   con su saldo/pendiente ACTUAL (hoy) — reconstruir esos históricos exigiría
//   rehacer todo su historial de abonos/kardex, que no está indexado por
//   fecha de forma barata. Si el corte es distinto de hoy, se avisa en el
//   propio reporte.

function _efDinero(v) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(v) || 0);
}

function _efEsc(v) {
    return String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
}

// % de una cifra sobre las ventas netas (análisis vertical / common-size).
// Estándar en el Estado de Resultados: cada renglón se lee como "% de ventas".
function _efPct(valor, base) {
    if (!base) return '—';
    return (Number(valor) / base * 100).toFixed(1) + '%';
}

// Convierte cualquier formato de fecha usado en el sistema (epoch ms, ISO,
// 'YYYY-MM-DD') a un objeto Date válido, o null si no se puede.
function _efParseFecha(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') {
        const d = new Date(v);
        return isNaN(d.getTime()) ? null : d;
    }
    const s = String(v).trim();
    if (/^\d+$/.test(s)) {
        const d = new Date(Number(s));
        return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(s.includes('T') ? s : s + 'T12:00:00');
    return isNaN(d.getTime()) ? null : d;
}

function _efEnRango(fechaValor, desdeDate, hastaDate) {
    const d = _efParseFecha(fechaValor);
    if (!d) return false;
    return d >= desdeDate && d <= hastaDate;
}

function _efHoyInput() {
    return typeof window.obtenerHoyInputMX === 'function' ? window.obtenerHoyInputMX() : new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------
// CAPITAL (aportaciones y retiros del dueño)
// ---------------------------------------------------------------

function abrirModalCapital(tipo) {
    const esAportacion = tipo === 'aportacion';
    const html = `
    <div data-modal="capital-mov" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9000;display:flex;justify-content:center;align-items:center;padding:16px;">
        <div style="background:white;padding:28px;border-radius:12px;width:100%;max-width:420px;">
            <h2 style="margin-top:0;color:${esAportacion ? '#059669' : '#dc2626'};">${esAportacion ? '➕ Aportación de capital' : '➖ Retiro de capital'}</h2>
            <p style="color:#6b7280;font-size:13px;margin-top:-8px;">${esAportacion ? 'Dinero que el dueño mete al negocio.' : 'Dinero que el dueño saca del negocio (no es un gasto operativo).'}</p>
            <input type="hidden" id="capitalTipo" value="${tipo}">
            <div style="margin-bottom:12px;">
                <label style="font-weight:bold;font-size:13px;color:#374151;display:block;margin-bottom:5px;">MONTO ($)</label>
                <input type="number" id="capitalMonto" min="0.01" step="0.01" placeholder="0.00" style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:6px;box-sizing:border-box;">
            </div>
            <div style="margin-bottom:12px;">
                <label style="font-weight:bold;font-size:13px;color:#374151;display:block;margin-bottom:5px;">FECHA</label>
                <input type="date" id="capitalFecha" value="${_efHoyInput()}" style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:6px;box-sizing:border-box;">
            </div>
            <div style="margin-bottom:12px;">
                <label style="font-weight:bold;font-size:13px;color:#374151;display:block;margin-bottom:5px;">${esAportacion ? '¿A QUÉ CUENTA ENTRA?' : '¿DE QUÉ CUENTA SALE?'}</label>
                ${window._buildSelectorCuentas('capitalCuenta', false)}
            </div>
            <div style="margin-bottom:16px;">
                <label style="font-weight:bold;font-size:13px;color:#374151;display:block;margin-bottom:5px;">NOTA (opcional)</label>
                <input type="text" id="capitalNota" placeholder="Motivo" style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:6px;box-sizing:border-box;">
            </div>
            <div style="display:flex;gap:10px;">
                <button onclick="guardarMovimientoCapital()" style="flex:1;padding:12px;background:${esAportacion ? '#059669' : '#dc2626'};color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">💾 Guardar</button>
                <button onclick="document.querySelector('[data-modal=&quot;capital-mov&quot;]').remove()" style="flex:1;padding:12px;background:#e5e7eb;color:#4b5563;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">✕ Cancelar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

function guardarMovimientoCapital() {
    const tipo = document.getElementById('capitalTipo')?.value;
    const monto = Number(document.getElementById('capitalMonto')?.value);
    const fecha = document.getElementById('capitalFecha')?.value || _efHoyInput();
    const nota = document.getElementById('capitalNota')?.value.trim() || '';
    const sel = document.getElementById('capitalCuenta');

    if (!Number.isFinite(monto) || monto <= 0) return alert('⚠️ Ingresa un monto válido.');
    if (!sel) return alert('No se pudo leer la cuenta seleccionada.');
    const cuentaId = sel.value;
    const etiqueta = sel.options[sel.selectedIndex]?.text || cuentaId;
    const esAportacion = tipo === 'aportacion';

    if (!confirm(`⚠️ ${esAportacion ? 'APORTACIÓN' : 'RETIRO'} DE CAPITAL\n\nMonto: ${_efDinero(monto)}\n${esAportacion ? 'Entra a' : 'Sale de'}: ${etiqueta}\n\n¿Confirmar?`)) return;

    if (typeof window._ingresarCuenta !== 'function' || typeof window._egresarCuenta !== 'function') {
        alert('No se pudo registrar el movimiento: el módulo de caja no está disponible. Nada se guardó.');
        return;
    }

    const id = Date.now();
    const fn = esAportacion ? window._ingresarCuenta : window._egresarCuenta;
    const ok = fn({
        monto, cuentaId, etiqueta,
        concepto: `${esAportacion ? 'Aportación' : 'Retiro'} de capital${nota ? ' — ' + nota : ''}`,
        referencia: `CAPITAL-${id}`,
        idOperacion: `capital-${id}`,
        fecha: fecha ? `${fecha}T12:00:00` : undefined
    });
    if (!ok) {
        alert(`No se pudo registrar el movimiento en "${etiqueta}". Nada se guardó.`);
        return;
    }

    const movs = StorageService.get('capitalMovimientos', []);
    movs.push({
        id, tipo, monto, fecha,
        fechaIso: window.localISO ? window.localISO(new Date(fecha + 'T12:00:00')) : new Date(fecha).toISOString(),
        cuentaId, etiquetaCuenta: etiqueta, nota
    });
    StorageService.set('capitalMovimientos', movs);

    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: esAportacion ? 'CAPITAL_APORTACION' : 'CAPITAL_RETIRO',
            modulo: 'Finanzas', entidad: 'capitalMovimientos', entidadId: id,
            detalle: `${esAportacion ? 'Aportación' : 'Retiro'} de capital - ${_efDinero(monto)} (${etiqueta})`,
            monto, severidad: 'riesgo', datos: { cuentaId, etiqueta, nota }
        });
    }

    document.querySelector('[data-modal="capital-mov"]')?.remove();
    renderEstadosFinancieros();
}

function _efTotalesCapital() {
    const movs = StorageService.get('capitalMovimientos', []);
    const aportado = movs.filter(m => m.tipo === 'aportacion').reduce((s, m) => s + (Number(m.monto) || 0), 0);
    const retirado = movs.filter(m => m.tipo === 'retiro').reduce((s, m) => s + (Number(m.monto) || 0), 0);
    return { aportado, retirado, neto: aportado - retirado, movs };
}

// ---------------------------------------------------------------
// ESTADO DE RESULTADOS
// ---------------------------------------------------------------

// Categorías de gasto que se tratan como GASTO FINANCIERO (RIF) en vez de
// gasto operativo — según NIF B-3, intereses/comisiones bancarias no son
// parte de la operación del negocio. Detecta por palabras clave en la
// categoría del gasto (el usuario no tiene que hacer nada especial, solo
// nombrar la categoría de forma reconocible, p.ej. "Intereses bancarios").
const _EF_PALABRAS_GASTO_FINANCIERO = ['interes', 'interés', 'financiero', 'financiera', 'comision bancaria', 'comisión bancaria'];
function _efEsGastoFinanciero(categoria) {
    const c = String(categoria || '').toLowerCase();
    return _EF_PALABRAS_GASTO_FINANCIERO.some(p => c.includes(p));
}

function _efCalcularEstadoResultados(desdeStr, hastaStr) {
    const desde = _efParseFecha(desdeStr + 'T00:00:00');
    const hasta = _efParseFecha(hastaStr + 'T23:59:59');

    // 🛡️ NIF B-3 / NIF C-19 / NIF C-20: el interés que paga un cliente por
    // financiar su compra a crédito NO es venta de mercancía, es ingreso
    // financiero (RIF) — no debe mezclarse con "Ingresos por ventas" ni con
    // el Costo de Ventas (que se compara contra el precio de mercancía).
    // Reutilizamos el motor de interés ya existente en el sistema
    // (_rrcTotalesVenta/_rrcInteres de reportes-rentabilidad-cartera.js) en
    // vez de recalcular la resta nosotros mismos, para no volver a duplicar
    // esa fórmula por cuarta vez.
    const ventas = StorageService.get('ventasRegistradas', []);
    const ventasEnRango = ventas.filter(v => _efEnRango(v.fechaVenta || v.fecha, desde, hasta));
    let ingresosVentas = 0;
    let ingresosFinancieros = 0;
    ventasEnRango.forEach(v => {
        if (typeof window._rrcTotalesVenta === 'function' && typeof window._rrcInteres === 'function') {
            const { totalMercancia, totalDocumento } = window._rrcTotalesVenta(v);
            ingresosVentas += totalMercancia;
            ingresosFinancieros += window._rrcInteres(totalDocumento, totalMercancia);
        } else {
            // Sin el motor compartido disponible: no hay forma segura de
            // separar interés de mercancía, se cuenta todo como venta.
            ingresosVentas += Number(v.totalMercancia || v.total) || 0;
        }
    });

    const devoluciones = StorageService.get('historialDevoluciones', []);
    const totalDevoluciones = devoluciones
        .filter(d => _efEnRango(d.fecha, desde, hasta))
        .reduce((s, d) => s + (Number(d.monto) || 0), 0);

    const kardex = StorageService.get('movimientosInventario', []);
    const salidasVenta = kardex
        .filter(m => m.tipo === 'salida' && m.folioVenta && _efEnRango(m.fecha, desde, hasta))
        .reduce((s, m) => s + (Number(m.valor) || 0), 0);
    const reingresosVenta = kardex
        .filter(m => m.tipo === 'entrada' && m.folioVenta && _efEnRango(m.fecha, desde, hasta))
        .reduce((s, m) => s + (Number(m.valor) || 0), 0);
    const costoVentas = Math.max(0, salidasVenta - reingresosVenta);

    const gastos = StorageService.get('gastosOperativos', []);
    const gastosPorCategoria = {};
    let totalGastos = 0;
    let gastosFinancieros = 0;
    gastos.filter(g => _efEnRango(g.fecha, desde, hasta)).forEach(g => {
        const monto = Number(g.monto) || 0;
        if (_efEsGastoFinanciero(g.categoria)) {
            gastosFinancieros += monto;
            return; // no entra al desglose de gastos operativos
        }
        const cat = g.categoria || 'Sin categoría';
        gastosPorCategoria[cat] = (gastosPorCategoria[cat] || 0) + monto;
        totalGastos += monto;
    });

    const prestamos = StorageService.get('prestamosOtorgados', []);
    const incobrables = prestamos
        .filter(p => p.estado === 'Incobrable' && _efEnRango(p.fechaIncobrable || p.fecha, desde, hasta))
        .reduce((s, p) => s + (Number(p.saldoPendiente) || 0), 0);

    const ingresosNetos = ingresosVentas - totalDevoluciones;
    const utilidadBruta = ingresosNetos - costoVentas;
    // Cuentas incobrables: NIF las clasifica como gasto de operación (venta/
    // administración), NO como parte del RIF.
    const utilidadOperacion = utilidadBruta - totalGastos - incobrables;
    const rif = ingresosFinancieros - gastosFinancieros;
    const utilidadNeta = utilidadOperacion + rif;

    return {
        desde: desdeStr, hasta: hastaStr,
        ingresosVentas, totalDevoluciones, ingresosNetos,
        costoVentas, utilidadBruta,
        gastosPorCategoria, totalGastos, incobrables, utilidadOperacion,
        ingresosFinancieros, gastosFinancieros, rif,
        utilidadNeta
    };
}

// ---------------------------------------------------------------
// BALANCE GENERAL
// ---------------------------------------------------------------

// Reconstruye el saldo de una lista de cuentas (efectivo o bancarias) a una
// fecha de corte, partiendo del saldo actual y deshaciendo los movimientos de
// movimientosCaja posteriores a esa fecha (ingreso posterior se resta,
// egreso posterior se suma de vuelta).
function _efSaldoCuentasAFecha(cuentas, tipoCuenta, hastaDate, movimientosCaja) {
    return cuentas.map(c => {
        const efectoPosterior = movimientosCaja
            .filter(m => String(m.cuenta) === String(c.id) && _efParseFecha(m.fecha) > hastaDate)
            .reduce((s, m) => s + (m.tipo === 'ingreso' ? Number(m.monto) || 0 : -(Number(m.monto) || 0)), 0);
        return { ...c, saldoAFecha: (Number(c.saldo) || 0) - efectoPosterior };
    });
}

function _efCalcularBalanceGeneral(hastaStr) {
    const hasta = _efParseFecha(hastaStr + 'T23:59:59');
    const hoyStr = _efHoyInput();
    const esHistorico = hastaStr !== hoyStr;

    const movimientosCaja = StorageService.get('movimientosCaja', []);
    const efectivo = _efSaldoCuentasAFecha(StorageService.get('cuentasEfectivo', []), 'efectivo', hasta, movimientosCaja);
    const bancos = _efSaldoCuentasAFecha(StorageService.get('cuentas-bancarias', []), 'banco', hasta, movimientosCaja);
    const totalEfectivoBancos = [...efectivo, ...bancos].reduce((s, c) => s + (Number(c.saldoAFecha) || 0), 0);

    const cxc = StorageService.get('cuentasPorCobrar', []);
    const totalCxC = cxc.reduce((s, c) => s + (Number(c.saldoPendiente ?? c.saldo) || 0), 0);

    const prestamos = StorageService.get('prestamosOtorgados', []).filter(p => p.estado !== 'Incobrable');
    const totalPrestamosPorCobrar = prestamos.reduce((s, p) => s + (Number(p.saldoPendiente) || 0), 0);

    const productos = StorageService.get('productos', []);
    const totalInventario = productos.reduce((s, p) => s + (Number(p.stock) || 0) * (Number(p.costo || p.precioCompra) || 0), 0);

    const cxp = StorageService.get('cuentasPorPagar', []);
    const totalCxP = cxp.reduce((s, c) => s + (Number(c.saldoPendiente ?? c.saldo) || 0), 0);

    const totalActivo = totalEfectivoBancos + totalCxC + totalPrestamosPorCobrar + totalInventario;
    const totalPasivo = totalCxP;

    const { neto: capitalAportadoNeto, aportado, retirado } = _efTotalesCapital();
    const utilidadesAcumuladas = totalActivo - totalPasivo - capitalAportadoNeto;
    const totalCapital = capitalAportadoNeto + utilidadesAcumuladas;

    return {
        hasta: hastaStr, esHistorico,
        efectivo, bancos, totalEfectivoBancos,
        totalCxC, totalPrestamosPorCobrar, totalInventario,
        totalActivo,
        totalCxP, totalPasivo,
        capitalAportado: aportado, capitalRetirado: retirado, capitalAportadoNeto,
        utilidadesAcumuladas, totalCapital
    };
}

// ---------------------------------------------------------------
// RENDER
// ---------------------------------------------------------------

function renderEstadosFinancieros() {
    const cont = document.getElementById('contenidoEstadosFinancieros');
    if (!cont) return;

    const hoy = _efHoyInput();
    const desde = window._efRangoDesde || (hoy.slice(0, 8) + '01');
    const hasta = window._efRangoHasta || hoy;
    window._efRangoDesde = desde;
    window._efRangoHasta = hasta;

    const er = _efCalcularEstadoResultados(desde, hasta);
    const bg = _efCalcularBalanceGeneral(hasta);
    const { movs: capitalMovs } = _efTotalesCapital();

    const filasGastos = Object.entries(er.gastosPorCategoria)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, monto]) => `<tr><td style="padding:4px 8px;color:#4b5563;">${_efEsc(cat)}</td><td style="padding:4px 8px;text-align:right;">${_efDinero(monto)}</td></tr>`)
        .join('') || '<tr><td colspan="2" style="padding:4px 8px;color:#9ca3af;">Sin gastos en el periodo.</td></tr>';

    const filasCapital = capitalMovs
        .slice().sort((a, b) => new Date(b.fechaIso) - new Date(a.fechaIso))
        .slice(0, 20)
        .map(m => `<tr>
            <td style="padding:6px 8px;">${_efEsc(m.fecha)}</td>
            <td style="padding:6px 8px;">${m.tipo === 'aportacion' ? '➕ Aportación' : '➖ Retiro'}</td>
            <td style="padding:6px 8px;text-align:right;font-weight:bold;color:${m.tipo === 'aportacion' ? '#059669' : '#dc2626'};">${_efDinero(m.monto)}</td>
            <td style="padding:6px 8px;">${_efEsc(m.etiquetaCuenta)}</td>
            <td style="padding:6px 8px;color:#6b7280;">${_efEsc(m.nota)}</td>
        </tr>`).join('') || '<tr><td colspan="5" style="padding:8px;color:#9ca3af;">Sin movimientos de capital todavía.</td></tr>';

    cont.innerHTML = `
    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:end;margin-bottom:20px;background:#f9fafb;padding:14px;border-radius:8px;">
        <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;display:block;margin-bottom:4px;">DESDE</label>
            <input type="date" id="efRangoDesde" value="${desde}" style="padding:8px;border:1px solid #d1d5db;border-radius:6px;">
        </div>
        <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;display:block;margin-bottom:4px;">HASTA</label>
            <input type="date" id="efRangoHasta" value="${hasta}" style="padding:8px;border:1px solid #d1d5db;border-radius:6px;">
        </div>
        <button onclick="window._efRangoDesde=document.getElementById('efRangoDesde').value;window._efRangoHasta=document.getElementById('efRangoHasta').value;renderEstadosFinancieros();" style="padding:9px 18px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">🔄 Generar</button>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <h3 style="margin:0;color:#0f172a;">📈 Estado de Resultados <span style="font-weight:normal;color:#6b7280;font-size:13px;">(${_efEsc(desde)} a ${_efEsc(hasta)})</span></h3>
    </div>
    <table style="width:100%;border-collapse:collapse;background:white;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:12px;">
        <thead><tr style="background:#f9fafb;font-size:11px;color:#6b7280;text-align:right;"><th style="text-align:left;padding:6px 8px;">Concepto</th><th style="padding:6px 8px;">Monto</th><th style="padding:6px 8px;width:70px;">% Ventas</th></tr></thead>
        <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;">Ingresos por ventas (mercancía, sin intereses)</td><td style="padding:8px;text-align:right;">${_efDinero(er.ingresosVentas)}</td><td style="padding:8px;text-align:right;color:#6b7280;">${_efPct(er.ingresosVentas, er.ingresosVentas)}</td></tr>
        <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;color:#dc2626;">(–) Devoluciones</td><td style="padding:8px;text-align:right;color:#dc2626;">${_efDinero(er.totalDevoluciones)}</td><td style="padding:8px;text-align:right;color:#dc2626;">${_efPct(er.totalDevoluciones, er.ingresosVentas)}</td></tr>
        <tr style="border-bottom:2px solid #cbd5e1;font-weight:bold;"><td style="padding:8px;">= Ventas netas</td><td style="padding:8px;text-align:right;">${_efDinero(er.ingresosNetos)}</td><td style="padding:8px;text-align:right;">${_efPct(er.ingresosNetos, er.ingresosVentas)}</td></tr>
        <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;color:#dc2626;">(–) Costo de ventas</td><td style="padding:8px;text-align:right;color:#dc2626;">${_efDinero(er.costoVentas)}</td><td style="padding:8px;text-align:right;color:#dc2626;">${_efPct(er.costoVentas, er.ingresosVentas)}</td></tr>
        <tr style="border-bottom:2px solid #cbd5e1;font-weight:bold;background:#f0fdf4;"><td style="padding:8px;">= Utilidad bruta</td><td style="padding:8px;text-align:right;">${_efDinero(er.utilidadBruta)}</td><td style="padding:8px;text-align:right;color:#059669;font-weight:bold;">${_efPct(er.utilidadBruta, er.ingresosVentas)}</td></tr>
    </table>
    <details style="margin-bottom:12px;">
        <summary style="cursor:pointer;color:#1e40af;font-weight:bold;font-size:13px;">Ver desglose de gastos operativos (${_efDinero(er.totalGastos)})</summary>
        <table style="width:100%;border-collapse:collapse;margin-top:6px;">${filasGastos}</table>
    </details>
    <table style="width:100%;border-collapse:collapse;background:white;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:12px;">
        <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;color:#dc2626;">(–) Gastos operativos</td><td style="padding:8px;text-align:right;color:#dc2626;">${_efDinero(er.totalGastos)}</td><td style="padding:8px;text-align:right;color:#dc2626;width:70px;">${_efPct(er.totalGastos, er.ingresosVentas)}</td></tr>
        <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;color:#dc2626;">(–) Préstamos incobrables</td><td style="padding:8px;text-align:right;color:#dc2626;">${_efDinero(er.incobrables)}</td><td style="padding:8px;text-align:right;color:#dc2626;">${_efPct(er.incobrables, er.ingresosVentas)}</td></tr>
        <tr style="border-bottom:2px solid #cbd5e1;font-weight:bold;"><td style="padding:8px;">= Utilidad de operación</td><td style="padding:8px;text-align:right;">${_efDinero(er.utilidadOperacion)}</td><td style="padding:8px;text-align:right;color:#059669;font-weight:bold;">${_efPct(er.utilidadOperacion, er.ingresosVentas)}</td></tr>
    </table>
    <details style="margin-bottom:12px;">
        <summary style="cursor:pointer;color:#1e40af;font-weight:bold;font-size:13px;">Ver Resultado Integral de Financiamiento — RIF (${_efDinero(er.rif)})</summary>
        <p style="font-size:12px;color:#6b7280;margin:6px 0;">Intereses cobrados por vender a crédito, menos intereses/comisiones pagados (si categorizas un gasto con "interés", "financiero" o "comisión bancaria" en Gastos Operativos, se cuenta aquí en vez de en gastos operativos). Así lo separa la NIF B-3: no es parte de la operación del negocio.</p>
        <table style="width:100%;border-collapse:collapse;">
            <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:6px 8px;">+ Ingresos financieros (intereses cobrados)</td><td style="padding:6px 8px;text-align:right;">${_efDinero(er.ingresosFinancieros)}</td></tr>
            <tr><td style="padding:6px 8px;color:#dc2626;">– Gastos financieros (intereses pagados)</td><td style="padding:6px 8px;text-align:right;color:#dc2626;">${_efDinero(er.gastosFinancieros)}</td></tr>
        </table>
    </details>
    <table style="width:100%;border-collapse:collapse;background:white;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:12px;">
        <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;">± Resultado Integral de Financiamiento (RIF)</td><td style="padding:8px;text-align:right;color:${er.rif >= 0 ? '#059669' : '#dc2626'};">${_efDinero(er.rif)}</td><td style="padding:8px;text-align:right;color:#6b7280;width:70px;">${_efPct(er.rif, er.ingresosVentas)}</td></tr>
        <tr style="font-weight:bold;font-size:16px;background:${er.utilidadNeta >= 0 ? '#f0fdf4' : '#fef2f2'};"><td style="padding:10px 8px;">= UTILIDAD NETA</td><td style="padding:10px 8px;text-align:right;color:${er.utilidadNeta >= 0 ? '#059669' : '#dc2626'};">${_efDinero(er.utilidadNeta)}</td><td style="padding:10px 8px;text-align:right;color:${er.utilidadNeta >= 0 ? '#059669' : '#dc2626'};">${_efPct(er.utilidadNeta, er.ingresosVentas)}</td></tr>
    </table>

    <div style="display:flex;justify-content:space-between;align-items:center;margin:24px 0 10px;">
        <h3 style="margin:0;color:#0f172a;">⚖️ Balance General <span style="font-weight:normal;color:#6b7280;font-size:13px;">(al ${_efEsc(hasta)})</span></h3>
    </div>
    ${bg.esHistorico ? `<p style="background:#fffbeb;color:#92400e;padding:8px 12px;border-radius:6px;font-size:12px;margin-bottom:10px;">⚠️ Corte histórico: el efectivo/bancos se reconstruyó a esta fecha. Cuentas por cobrar, cuentas por pagar, préstamos por cobrar e inventario se muestran con su saldo <strong>actual</strong> (de hoy), no reconstruido a esa fecha.</p>` : ''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div>
            <h4 style="color:#1e40af;margin-bottom:6px;">ACTIVO</h4>
            <table style="width:100%;border-collapse:collapse;background:white;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;">Efectivo y bancos</td><td style="padding:8px;text-align:right;">${_efDinero(bg.totalEfectivoBancos)}</td></tr>
                <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;">Cuentas por cobrar (clientes)</td><td style="padding:8px;text-align:right;">${_efDinero(bg.totalCxC)}</td></tr>
                <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;">Préstamos por cobrar</td><td style="padding:8px;text-align:right;">${_efDinero(bg.totalPrestamosPorCobrar)}</td></tr>
                <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;">Inventario</td><td style="padding:8px;text-align:right;">${_efDinero(bg.totalInventario)}</td></tr>
                <tr style="font-weight:bold;background:#eff6ff;"><td style="padding:8px;">TOTAL ACTIVO</td><td style="padding:8px;text-align:right;">${_efDinero(bg.totalActivo)}</td></tr>
            </table>
        </div>
        <div>
            <h4 style="color:#b45309;margin-bottom:6px;">PASIVO + CAPITAL</h4>
            <table style="width:100%;border-collapse:collapse;background:white;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;">Cuentas por pagar (proveedores)</td><td style="padding:8px;text-align:right;">${_efDinero(bg.totalPasivo)}</td></tr>
                <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;">Capital aportado (neto)</td><td style="padding:8px;text-align:right;">${_efDinero(bg.capitalAportadoNeto)}</td></tr>
                <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;">Utilidades acumuladas</td><td style="padding:8px;text-align:right;">${_efDinero(bg.utilidadesAcumuladas)}</td></tr>
                <tr style="font-weight:bold;background:#fffbeb;"><td style="padding:8px;">TOTAL PASIVO + CAPITAL</td><td style="padding:8px;text-align:right;">${_efDinero(bg.totalPasivo + bg.totalCapital)}</td></tr>
            </table>
        </div>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin:24px 0 10px;">
        <h3 style="margin:0;color:#0f172a;">💼 Capital (aportaciones y retiros del dueño)</h3>
        <div style="display:flex;gap:8px;">
            <button onclick="abrirModalCapital('aportacion')" style="padding:8px 14px;background:#059669;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">➕ Aportación</button>
            <button onclick="abrirModalCapital('retiro')" style="padding:8px 14px;background:#dc2626;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">➖ Retiro</button>
        </div>
    </div>
    <p style="color:#6b7280;font-size:13px;">Aportado: <strong style="color:#059669;">${_efDinero(bg.capitalAportado)}</strong> · Retirado: <strong style="color:#dc2626;">${_efDinero(bg.capitalRetirado)}</strong> · Neto: <strong>${_efDinero(bg.capitalAportadoNeto)}</strong></p>
    <table style="width:100%;border-collapse:collapse;background:white;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <thead><tr style="background:#f9fafb;font-size:12px;color:#6b7280;text-align:left;">
            <th style="padding:6px 8px;">Fecha</th><th style="padding:6px 8px;">Tipo</th><th style="padding:6px 8px;text-align:right;">Monto</th><th style="padding:6px 8px;">Cuenta</th><th style="padding:6px 8px;">Nota</th>
        </tr></thead>
        <tbody>${filasCapital}</tbody>
    </table>
    `;
}

window.renderEstadosFinancieros = renderEstadosFinancieros;
window.abrirModalCapital = abrirModalCapital;
window.guardarMovimientoCapital = guardarMovimientoCapital;

console.log('✅ finanzas-estados.js cargado correctamente');
