// ================================================================
// 💹 MÓDULO: RENTABILIDAD DE CARTERA (Reportes / Cobranza)
// Para cada cuenta por cobrar (crédito), calcula:
//   - Costo real de la mercancía vendida (cruzando historialCostos
//     por producto + fecha de compra más cercana ANTERIOR a la venta;
//     si no hay historial aprovechable, cae en costo actual del
//     catálogo — SIEMPRE hay un costo, nunca queda en $0 si el
//     producto sigue existiendo).
//   - Comisión pagada sobre esa venta (cruzada por folio contra
//     comisionesRegistradas).
//   - Cronología de cobranza (enganche + abonos en orden) para saber
//     en qué fecha el cobrado acumulado cruzó el costo, y en qué
//     fecha cruzó costo+comisión (inicio de ganancia real).
// Reutiliza helpers globales ya definidos en validator.js
// (parseFechaMX, formatearDineroMX, formatearFechaCortaMX, _esc) y
// en estadoCuentaCliente.js (_abonosCuenta, _montoAbonoCuenta,
// _fechaAbonoCuenta, _clienteNombreCuenta) — ambos scripts se cargan
// antes que este en index.html.
// ================================================================

// ---------------------------------------------------------------
// 🔧 Helpers propios (con fallback si algún global no existiera)
// ---------------------------------------------------------------

function _rrcEsc(v) {
    return typeof window._esc === 'function' ? window._esc(v) : String(v ?? '');
}

function _rrcDinero(v) {
    return typeof window.formatearDineroMX === 'function'
        ? window.formatearDineroMX(v)
        : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(v) || 0);
}

function _rrcFecha(v) {
    return typeof window.formatearFechaCortaMX === 'function' ? window.formatearFechaCortaMX(v) : String(v || '-');
}

function _rrcParseFecha(v) {
    if (!v) return null;
    if (typeof window.parseFechaMX === 'function') {
        const d = window.parseFechaMX(v);
        return (d instanceof Date && !isNaN(d.getTime())) ? d : null;
    }
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
}

function _rrcArr(key) {
    const val = (typeof StorageService !== 'undefined') ? StorageService.get(key, []) : [];
    return Array.isArray(val) ? val : [];
}

// ---------------------------------------------------------------
// 💰 MOTOR DE COSTEO HISTÓRICO
// ---------------------------------------------------------------

// Resuelve el id de producto a partir del artículo vendido.
// Los artículos migrados (id === 'MIG') nunca tienen historial real.
function _rrcIdProductoArticulo(articulo) {
    if (!articulo) return null;
    if (articulo.id === 'MIG') return null;
    const id = articulo.productoId ?? articulo.id;
    return (id !== undefined && id !== null && id !== '') ? String(id) : null;
}

// Busca en historialCostos la compra del producto más cercana,
// ANTERIOR O IGUAL a la fecha de venta. Si solo hay compras
// posteriores a la venta, no las usa (regla acordada con Roberto).
function _rrcBuscarCostoHistorico(idProducto, fechaVenta, historialCostos) {
    if (!idProducto || !(fechaVenta instanceof Date)) return { registro: null, confianza: 'sin_historial' };

    let candidatos = historialCostos.filter(r => String(r.productoId) === idProducto);

    // Fallback: productoId con sufijo de variante, ej "123456-1568"
    if (candidatos.length === 0) {
        candidatos = historialCostos.filter(r => String(r.productoId).split('-')[0] === idProducto);
    }

    if (candidatos.length === 0) return { registro: null, confianza: 'sin_historial' };

    const conFecha = candidatos
        .map(r => ({ r, fechaParsed: _rrcParseFecha(r.fecha) }))
        .filter(x => x.fechaParsed instanceof Date)
        .sort((a, b) => a.fechaParsed - b.fechaParsed);

    let mejor = null;
    for (const x of conFecha) {
        if (x.fechaParsed <= fechaVenta) mejor = x;
        else break;
    }

    if (mejor) return { registro: mejor.r, confianza: 'real' };
    return { registro: null, confianza: 'sin_historial' };
}

/**
 * Resuelve el costo de UN artículo vendido.
 * Cascada (siempre entrega un costo si el producto existe):
 *   1) historialCostos: compra real más cercana antes de la venta
 *   2) costo actual del producto en catálogo (marcado "estimado")
 *   3) si el producto ni siquiera tiene costo capturado: estima a
 *      partir de su margen configurado sobre el precio de venta
 *   4) solo si el producto ya no existe en el catálogo (borrado) o
 *      es un artículo migrado sin producto real: "sin_dato" ($0)
 */
window._rrcResolverCostoArticulo = function(articulo, fechaVentaISO, historialCostos, productos) {
    const cantidad = Number(articulo?.cantidad) || 1;
    const fechaVenta = _rrcParseFecha(fechaVentaISO) || new Date();
    const idProducto = _rrcIdProductoArticulo(articulo);

    const { registro, confianza } = _rrcBuscarCostoHistorico(idProducto, fechaVenta, historialCostos);

    if (confianza === 'real' && registro) {
        const costoUnitario = Number(registro.precioCompra) || 0;
        return {
            costoUnitario,
            costoTotal: costoUnitario * cantidad,
            confianza: 'real',
            origenCosto: `Compra ${registro.origen || ''} del ${registro.fecha} (${registro.proveedorNombre || 'proveedor s/n'})`.trim(),
            fechaCompraUsada: registro.fecha
        };
    }

    const producto = idProducto ? productos.find(p => String(p.id) === idProducto) : null;

    if (producto) {
        const costoCatalogo = Number(producto.costo) || 0;
        if (costoCatalogo > 0) {
            return {
                costoUnitario: costoCatalogo,
                costoTotal: costoCatalogo * cantidad,
                confianza: 'estimado_sin_historial',
                origenCosto: 'Costo actual del catálogo (sin historial de compra disponible)',
                fechaCompraUsada: null
            };
        }
        // Producto existe pero sin costo capturado: último recurso vía margen.
        const precioVenta = Number(articulo?.precioContado || articulo?.precio || producto.precio || 0) || 0;
        const margen = Number(producto.margen) || 0;
        if (precioVenta > 0 && margen > 0 && margen < 100) {
            const costoEstimadoPorMargen = precioVenta * (1 - margen / 100);
            return {
                costoUnitario: costoEstimadoPorMargen,
                costoTotal: costoEstimadoPorMargen * cantidad,
                confianza: 'estimado_por_margen',
                origenCosto: `Estimado a partir del margen configurado (${margen}%), producto sin costo capturado`,
                fechaCompraUsada: null
            };
        }
    }

    return {
        costoUnitario: 0,
        costoTotal: 0,
        confianza: 'sin_dato',
        origenCosto: articulo?.id === 'MIG'
            ? 'Venta migrada sin costo capturado'
            : 'Producto no encontrado en catálogo (posiblemente eliminado)',
        fechaCompraUsada: null
    };
};

/**
 * Costea todos los artículos de una cuenta por cobrar.
 */
window._rrcResolverCostoCuenta = function(cuenta, historialCostos, productos) {
    const articulos = Array.isArray(cuenta?.articulos) ? cuenta.articulos : [];
    const detalle = articulos.map(a => ({
        nombre: a.nombre || 'Artículo',
        cantidad: Number(a.cantidad) || 1,
        ...window._rrcResolverCostoArticulo(a, cuenta.fechaVenta, historialCostos, productos)
    }));

    const costoTotalCuenta = detalle.reduce((s, d) => s + d.costoTotal, 0);
    const niveles = new Set(detalle.map(d => d.confianza));

    let confianzaGeneral;
    if (niveles.size === 0) confianzaGeneral = 'sin_dato';
    else if (niveles.size === 1) {
        const unica = [...niveles][0];
        confianzaGeneral = unica === 'real' ? 'real' : (unica === 'sin_dato' ? 'sin_dato' : 'estimado');
    } else {
        confianzaGeneral = 'mixto';
    }

    return { costoTotalCuenta, confianzaGeneral, detalleArticulos: detalle };
};

// ---------------------------------------------------------------
// 💵 COMISIÓN LIGADA A LA CUENTA (cruce por folio)
// ---------------------------------------------------------------

window._rrcComisionCuenta = function(cuenta, comisiones) {
    const folio = String(cuenta?.folio || '').trim();
    if (!folio) return { montoComision: 0, encontrada: false, vendedorNombre: '', estado: '' };

    // Puede haber más de una comisión ligada al mismo folio (raro, pero
    // sumamos por seguridad en vez de quedarnos solo con la primera).
    const registros = comisiones.filter(c => String(c.folio || '').trim() === folio);
    if (!registros.length) return { montoComision: 0, encontrada: false, vendedorNombre: '', estado: '' };

    const montoComision = registros.reduce((s, c) => s + (Number(c.montoComision) || 0), 0);
    return {
        montoComision,
        encontrada: true,
        vendedorNombre: registros[0].vendedorNombre || '',
        estado: registros[0].estado || ''
    };
};

// ---------------------------------------------------------------
// 📈 CRONOLOGÍA DE COBRANZA (enganche + abonos ordenados)
// ---------------------------------------------------------------

function _rrcCronologiaCuenta(cuenta) {
    const puntos = [];
    const fechaVenta = _rrcParseFecha(cuenta.fechaVenta) || new Date(0);
    const enganche = Number(cuenta.engancheRecibido) || 0;

    if (enganche > 0) {
        puntos.push({ fecha: fechaVenta, monto: enganche, tipo: 'Enganche' });
    }

    const abonos = typeof window._abonosCuenta === 'function'
        ? window._abonosCuenta(cuenta)
        : (Array.isArray(cuenta.abonos) ? cuenta.abonos : []);

    abonos.forEach(a => {
        const monto = typeof window._montoAbonoCuenta === 'function'
            ? window._montoAbonoCuenta(a)
            : (Number(a.monto ?? a.montoAbono ?? a.importe) || 0);
        const fechaRaw = typeof window._fechaAbonoCuenta === 'function'
            ? window._fechaAbonoCuenta(a)
            : (a.fechaAbonoIso || a.fecha || null);
        const fecha = _rrcParseFecha(fechaRaw) || fechaVenta;
        if (monto > 0) puntos.push({ fecha, monto, tipo: 'Abono' });
    });

    puntos.sort((a, b) => a.fecha - b.fecha);

    let acumulado = 0;
    return puntos.map(p => {
        acumulado += p.monto;
        return { fecha: p.fecha, monto: p.monto, tipo: p.tipo, acumulado };
    });
}

// ---------------------------------------------------------------
// 🎯 FUNCIÓN PRINCIPAL: rentabilidad completa de UNA cuenta
// ---------------------------------------------------------------

window.obtenerRentabilidadCuenta = function(cuenta, contexto = null) {
    const ctx = contexto || {
        historialCostos: _rrcArr('historialCostos'),
        productos: _rrcArr('productos'),
        comisiones: _rrcArr('comisionesRegistradas')
    };

    const costo = window._rrcResolverCostoCuenta(cuenta, ctx.historialCostos, ctx.productos);
    const comision = window._rrcComisionCuenta(cuenta, ctx.comisiones);
    const cronologia = _rrcCronologiaCuenta(cuenta);

    const umbralCosto = costo.costoTotalCuenta;
    const umbralGanancia = costo.costoTotalCuenta + comision.montoComision;

    const totalCobradoActual = cronologia.length
        ? cronologia[cronologia.length - 1].acumulado
        : (Number(cuenta.engancheRecibido) || 0);

    // Si NO hay ningún dato de costo aprovechable (umbralCosto === 0 de
    // verdad, no porque la mercancía no cueste nada), no podemos calcular
    // ningún % de recuperación: mostrar "sin datos" en vez de un falso 100%.
    const sinDatosDeCosto = umbralCosto <= 0;

    const pctRecuperacionCosto = sinDatosDeCosto ? null : Math.min(100, (totalCobradoActual / umbralCosto) * 100);
    const pctRecuperacionCostoComision = sinDatosDeCosto ? null : Math.min(100, (totalCobradoActual / umbralGanancia) * 100);

    const puntoCosto = !sinDatosDeCosto ? cronologia.find(p => p.acumulado >= umbralCosto) : null;
    const puntoGanancia = !sinDatosDeCosto ? cronologia.find(p => p.acumulado >= umbralGanancia) : null;

    const gananciaRealizada = sinDatosDeCosto ? 0 : Math.max(0, totalCobradoActual - umbralGanancia);

    return {
        folio: cuenta.folio || cuenta.id,
        clienteNombre: typeof window._clienteNombreCuenta === 'function'
            ? window._clienteNombreCuenta(cuenta)
            : (cuenta.nombre || cuenta.clienteNombre || 'Cliente'),
        estado: cuenta.estado || 'Pendiente',
        fechaVenta: cuenta.fechaVenta,
        costoTotal: umbralCosto,
        costoConfianza: costo.confianzaGeneral,
        detalleArticulos: costo.detalleArticulos,
        comision,
        umbralCosto,
        umbralGanancia,
        totalVenta: (typeof window._totalCuenta === 'function' ? window._totalCuenta(cuenta) : (Number(cuenta.totalContadoOriginal) || 0)),
        totalCobradoActual,
        pctRecuperacionCosto,
        pctRecuperacionCostoComision,
        fechaRecuperoCosto: puntoCosto ? puntoCosto.fecha : null,
        fechaInicioGanancia: puntoGanancia ? puntoGanancia.fecha : null,
        cronologia,
        gananciaRealizada,
        sinDatosDeCosto,
        zona: sinDatosDeCosto ? 'sin_dato' : (puntoGanancia ? 'ganancia' : (puntoCosto ? 'comision' : 'costo'))
    };
};

// ---------------------------------------------------------------
// 📊 RESUMEN GENERAL DE CARTERA
// ---------------------------------------------------------------

window.obtenerResumenRentabilidadCartera = function() {
    const ctx = {
        historialCostos: _rrcArr('historialCostos'),
        productos: _rrcArr('productos'),
        comisiones: _rrcArr('comisionesRegistradas')
    };
    const cuentas = _rrcArr('cuentasPorCobrar').filter(c => String(c.estado || '').toLowerCase() !== 'cancelado');

    const filas = cuentas.map(c => window.obtenerRentabilidadCuenta(c, ctx));

    const enZonaCosto = filas.filter(f => f.zona === 'costo').length;
    const enZonaComision = filas.filter(f => f.zona === 'comision').length;
    const enGanancia = filas.filter(f => f.zona === 'ganancia').length;
    const sinDatos = filas.filter(f => f.zona === 'sin_dato').length;

    const costoRealCount = filas.filter(f => f.costoConfianza === 'real').length;
    const costoMixtoCount = filas.filter(f => f.costoConfianza === 'mixto').length;
    const costoSinDatoCount = filas.filter(f => f.costoConfianza === 'sin_dato').length;
    const costoEstimadoCount = filas.filter(f => f.costoConfianza !== 'real' && f.costoConfianza !== 'mixto' && f.costoConfianza !== 'sin_dato').length;

    const costoTotalCartera = filas.reduce((s, f) => s + f.costoTotal, 0);
    const comisionTotalCartera = filas.reduce((s, f) => s + (f.comision.montoComision || 0), 0);
    const cobradoTotalCartera = filas.reduce((s, f) => s + f.totalCobradoActual, 0);
    const gananciaRealizadaTotal = filas.reduce((s, f) => s + f.gananciaRealizada, 0);

    // Ordenar por % de recuperación (peor primero); las cuentas sin dato de
    // costo van al final, agrupadas aparte, porque no hay % que comparar.
    const ordenadas = filas.slice().sort((a, b) => {
        if (a.sinDatosDeCosto && !b.sinDatosDeCosto) return 1;
        if (!a.sinDatosDeCosto && b.sinDatosDeCosto) return -1;
        if (a.sinDatosDeCosto && b.sinDatosDeCosto) return 0;
        return a.pctRecuperacionCostoComision - b.pctRecuperacionCostoComision;
    });

    return {
        totalCuentas: filas.length,
        enZonaCosto, enZonaComision, enGanancia, sinDatos,
        costoRealCount, costoMixtoCount, costoEstimadoCount, costoSinDatoCount,
        costoTotalCartera, comisionTotalCartera, cobradoTotalCartera, gananciaRealizadaTotal,
        filas: ordenadas
    };
};

// ---------------------------------------------------------------
// 🖼️ RENDER: vista principal (lista + resumen)
// ---------------------------------------------------------------

function _rrcBadgeZona(zona) {
    const map = {
        costo: { txt: 'Recuperando costo', bg: '#fee2e2', color: '#991b1b' },
        comision: { txt: 'Recuperando comisión', bg: '#fef3c7', color: '#92400e' },
        ganancia: { txt: 'Ya en ganancia', bg: '#dcfce7', color: '#166534' },
        sin_dato: { txt: 'Sin datos de costo', bg: '#f1f5f9', color: '#475569' }
    };
    const s = map[zona] || map.costo;
    return `<span style="display:inline-flex;padding:3px 9px;border-radius:999px;background:${s.bg};color:${s.color};font-size:11px;font-weight:900;">${s.txt}</span>`;
}

function _rrcBadgeConfianza(confianza) {
    const map = {
        real: { txt: 'Costo real', bg: '#dbeafe', color: '#1e40af' },
        mixto: { txt: 'Costo mixto', bg: '#e0e7ff', color: '#3730a3' },
        estimado: { txt: 'Costo estimado', bg: '#f1f5f9', color: '#475569' },
        sin_dato: { txt: 'Sin costo', bg: '#fee2e2', color: '#991b1b' }
    };
    const s = map[confianza] || map.estimado;
    return `<span title="Nivel de confianza del costo usado" style="display:inline-flex;padding:3px 9px;border-radius:999px;background:${s.bg};color:${s.color};font-size:11px;font-weight:900;">${s.txt}</span>`;
}

function _rrcKpi(title, value, color, foot = '') {
    return `<div style="background:white;border:1px solid #e2e8f0;border-left:4px solid ${color};border-radius:8px;padding:15px;min-width:0;">
        <div style="font-size:11px;font-weight:900;color:#64748b;text-transform:uppercase;">${title}</div>
        <div style="font-size:22px;font-weight:900;color:${color};margin-top:5px;overflow-wrap:anywhere;">${value}</div>
        ${foot ? `<div style="font-size:12px;color:#64748b;margin-top:4px;">${foot}</div>` : ''}
    </div>`;
}

window.renderReporteRentabilidadCartera = function() {
    const cont = document.getElementById('reporte-rentabilidad-cartera');
    if (!cont) return;

    const resumen = window.obtenerResumenRentabilidadCartera();
    window._rrcResumenCache = resumen; // usado por el drill-down

    const pctReal = resumen.totalCuentas ? Math.round((resumen.costoRealCount / resumen.totalCuentas) * 100) : 0;

    const filasHtml = resumen.filas.map(f => `
        <tr style="border-bottom:1px solid #f1f5f9; cursor:pointer;" onclick="window.renderDetalleRentabilidadCuenta('${_rrcEsc(f.folio)}')">
            <td style="padding:10px 8px;font-weight:800;color:#0f172a;">${_rrcEsc(f.folio)}</td>
            <td style="padding:10px 8px;">${_rrcEsc(f.clienteNombre)}</td>
            <td style="padding:10px 8px;text-align:right;">${_rrcDinero(f.costoTotal)}</td>
            <td style="padding:10px 8px;text-align:right;">${_rrcDinero(f.comision.montoComision)}</td>
            <td style="padding:10px 8px;text-align:right;font-weight:800;">${_rrcDinero(f.totalCobradoActual)}</td>
            <td style="padding:10px 8px;text-align:right;">${f.sinDatosDeCosto ? 'N/D' : f.pctRecuperacionCosto.toFixed(0) + '%'}</td>
            <td style="padding:10px 8px;text-align:right;">${f.sinDatosDeCosto ? 'N/D' : f.pctRecuperacionCostoComision.toFixed(0) + '%'}</td>
            <td style="padding:10px 8px;">${f.fechaInicioGanancia ? _rrcFecha(f.fechaInicioGanancia) : 'Aún no'}</td>
            <td style="padding:10px 8px;">${_rrcBadgeZona(f.zona)}</td>
            <td style="padding:10px 8px;">${_rrcBadgeConfianza(f.costoConfianza)}</td>
        </tr>
    `).join('');

    cont.innerHTML = `
        <div style="max-width:1200px;margin:0 auto;">
            <h2 style="margin:0 0 4px;color:#0f172a;">💹 Rentabilidad de Cartera</h2>
            <p style="color:#64748b;margin:0 0 18px;">Costo real vs. cobrado por cuenta, y en qué punto cada crédito empieza a dejar ganancia.</p>

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:18px;">
                ${_rrcKpi('Cuentas activas', resumen.totalCuentas, '#0f172a')}
                ${_rrcKpi('Recuperando costo', resumen.enZonaCosto, '#991b1b')}
                ${_rrcKpi('Recuperando comisión', resumen.enZonaComision, '#92400e')}
                ${_rrcKpi('Ya en ganancia', resumen.enGanancia, '#166534')}
                ${_rrcKpi('Sin datos de costo', resumen.sinDatos, '#475569', 'Casi siempre ventas migradas')}
                ${_rrcKpi('Costo total cartera', _rrcDinero(resumen.costoTotalCartera), '#334155')}
                ${_rrcKpi('Ganancia ya realizada', _rrcDinero(resumen.gananciaRealizadaTotal), '#059669')}
                ${_rrcKpi('% cartera con costo real', pctReal + '%', '#2563eb', `${resumen.costoMixtoCount} mixtas, ${resumen.costoEstimadoCount} estimadas, ${resumen.costoSinDatoCount} sin dato`)}
            </div>

            <div style="background:white;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
                <div style="overflow-x:auto;">
                    <table style="width:100%;border-collapse:collapse;font-size:13px;">
                        <thead>
                            <tr style="background:#f8fafc;text-align:left;">
                                <th style="padding:10px 8px;">Folio</th>
                                <th style="padding:10px 8px;">Cliente</th>
                                <th style="padding:10px 8px;text-align:right;">Costo</th>
                                <th style="padding:10px 8px;text-align:right;">Comisión</th>
                                <th style="padding:10px 8px;text-align:right;">Cobrado</th>
                                <th style="padding:10px 8px;text-align:right;">% Costo</th>
                                <th style="padding:10px 8px;text-align:right;">% Costo+Com.</th>
                                <th style="padding:10px 8px;">Inicio ganancia</th>
                                <th style="padding:10px 8px;">Zona</th>
                                <th style="padding:10px 8px;">Confianza</th>
                            </tr>
                        </thead>
                        <tbody>${filasHtml || `<tr><td colspan="10" style="padding:20px;text-align:center;color:#94a3b8;">Sin cuentas por cobrar activas.</td></tr>`}</tbody>
                    </table>
                </div>
            </div>
            <div id="rrcDetalleCuenta" style="margin-top:18px;"></div>
        </div>
    `;
};

// ---------------------------------------------------------------
// 🖼️ RENDER: gráfica SVG de cronología por cuenta (drill-down)
// ---------------------------------------------------------------

function _rrcGraficaCronologia(rentabilidad) {
    const { cronologia, umbralCosto, umbralGanancia, totalCobradoActual } = rentabilidad;
    const W = 760, H = 260, padL = 60, padR = 20, padT = 20, padB = 40;
    const innerW = W - padL - padR, innerH = H - padT - padB;

    if (!cronologia.length) {
        return `<div style="padding:24px;text-align:center;color:#94a3b8;">Sin abonos registrados todavía para graficar.</div>`;
    }
    if (rentabilidad.sinDatosDeCosto) {
        return `<div style="padding:24px;text-align:center;color:#475569;background:#f8fafc;border-radius:8px;">Esta cuenta no tiene ningún dato de costo aprovechable (ni compra histórica, ni costo en catálogo) — casi siempre por tratarse de una venta migrada. No se puede graficar el cruce a ganancia.</div>`;
    }

    const fechaMin = cronologia[0].fecha.getTime();
    const fechaMax = cronologia[cronologia.length - 1].fecha.getTime();
    const rangoFechas = Math.max(1, fechaMax - fechaMin);
    const maxY = Math.max(umbralGanancia, totalCobradoActual) * 1.12 || 1;

    const x = (t) => padL + ((t - fechaMin) / rangoFechas) * innerW;
    const y = (v) => padT + innerH - (Math.min(v, maxY) / maxY) * innerH;

    const puntos = cronologia.map(p => `${x(p.fecha.getTime())},${y(p.acumulado)}`);
    // Punto inicial en $0 a la fecha del primer evento, para que la línea arranque desde abajo
    const lineaPath = `M ${x(fechaMin)},${y(0)} L ${puntos.join(' L ')}`;

    const yCosto = y(umbralCosto);
    const yGanancia = y(umbralGanancia);

    const circulos = cronologia.map(p =>
        `<circle cx="${x(p.fecha.getTime())}" cy="${y(p.acumulado)}" r="3.5" fill="#2563eb" />`
    ).join('');

    return `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;max-width:100%;font-family:inherit;">
        <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H - padB}" stroke="#cbd5e1" stroke-width="1" />
        <line x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}" stroke="#cbd5e1" stroke-width="1" />

        <line x1="${padL}" y1="${yCosto}" x2="${W - padR}" y2="${yCosto}" stroke="#991b1b" stroke-width="1.5" stroke-dasharray="5,4" />
        <text x="${W - padR}" y="${yCosto - 5}" text-anchor="end" font-size="11" font-weight="700" fill="#991b1b">Costo: ${_rrcDinero(umbralCosto)}</text>

        <line x1="${padL}" y1="${yGanancia}" x2="${W - padR}" y2="${yGanancia}" stroke="#166534" stroke-width="1.5" stroke-dasharray="5,4" />
        <text x="${W - padR}" y="${yGanancia - 5}" text-anchor="end" font-size="11" font-weight="700" fill="#166534">Costo+Comisión: ${_rrcDinero(umbralGanancia)}</text>

        <path d="${lineaPath}" fill="none" stroke="#2563eb" stroke-width="2.5" />
        ${circulos}

        <text x="${padL}" y="${H - padB + 18}" font-size="10" fill="#64748b">${_rrcFecha(cronologia[0].fecha)}</text>
        <text x="${W - padR}" y="${H - padB + 18}" text-anchor="end" font-size="10" fill="#64748b">${_rrcFecha(cronologia[cronologia.length - 1].fecha)}</text>
    </svg>`;
}

window.renderDetalleRentabilidadCuenta = function(folio) {
    const destino = document.getElementById('rrcDetalleCuenta');
    if (!destino) return;

    const cuentas = _rrcArr('cuentasPorCobrar');
    const cuenta = cuentas.find(c => String(c.folio || c.id) === String(folio));
    if (!cuenta) {
        destino.innerHTML = `<div style="padding:16px;color:#991b1b;">No se encontró la cuenta ${_rrcEsc(folio)}.</div>`;
        return;
    }

    const r = window.obtenerRentabilidadCuenta(cuenta);

    const articulosHtml = r.detalleArticulos.map(a => `
        <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:6px 8px;">${_rrcEsc(a.nombre)}</td>
            <td style="padding:6px 8px;text-align:right;">${a.cantidad}</td>
            <td style="padding:6px 8px;text-align:right;">${_rrcDinero(a.costoUnitario)}</td>
            <td style="padding:6px 8px;text-align:right;">${_rrcDinero(a.costoTotal)}</td>
            <td style="padding:6px 8px;">${_rrcBadgeConfianza(a.confianza === 'real' ? 'real' : (a.confianza === 'sin_dato' ? 'sin_dato' : 'estimado'))}</td>
            <td style="padding:6px 8px;font-size:11px;color:#64748b;">${_rrcEsc(a.origenCosto)}</td>
        </tr>
    `).join('');

    destino.innerHTML = `
        <div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
                <h3 style="margin:0;color:#0f172a;">Folio ${_rrcEsc(r.folio)} — ${_rrcEsc(r.clienteNombre)}</h3>
                ${_rrcBadgeZona(r.zona)}
            </div>

            ${_rrcGraficaCronologia(r)}

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin:16px 0;">
                ${_rrcKpi('Costo mercancía', _rrcDinero(r.costoTotal), '#991b1b')}
                ${_rrcKpi('Comisión', _rrcDinero(r.comision.montoComision), '#92400e', r.comision.encontrada ? _rrcEsc(r.comision.vendedorNombre) : 'Sin comisión ligada')}
                ${_rrcKpi('Cobrado a la fecha', _rrcDinero(r.totalCobradoActual), '#2563eb')}
                ${_rrcKpi('Ganancia ya cobrada', _rrcDinero(r.gananciaRealizada), '#059669')}
                ${_rrcKpi('% recuperación costo', r.sinDatosDeCosto ? 'N/D' : r.pctRecuperacionCosto.toFixed(0) + '%', '#991b1b')}
                ${_rrcKpi('% recup. costo+comisión', r.sinDatosDeCosto ? 'N/D' : r.pctRecuperacionCostoComision.toFixed(0) + '%', '#166534')}
            </div>

            <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
                <thead>
                    <tr style="background:#f8fafc;text-align:left;">
                        <th style="padding:6px 8px;">Artículo</th>
                        <th style="padding:6px 8px;text-align:right;">Cant.</th>
                        <th style="padding:6px 8px;text-align:right;">Costo unit.</th>
                        <th style="padding:6px 8px;text-align:right;">Costo total</th>
                        <th style="padding:6px 8px;">Confianza</th>
                        <th style="padding:6px 8px;">Origen del costo</th>
                    </tr>
                </thead>
                <tbody>${articulosHtml}</tbody>
            </table>
        </div>
    `;
    destino.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
