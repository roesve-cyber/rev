// ================================================================
// 🧊 MÓDULO: CUBO DE VENTAS (Reportes)
// Reporte dinámico tipo "cubo OLAP" sobre ventasRegistradas: el usuario
// elige con QUÉ agrupar (producto, color, vendedor, método de pago, bloque
// de tiempo — hasta 2 dimensiones cruzadas) y QUÉ medidas ver (unidades,
// precio base, precio de venta, costo, interés, utilidad, margen %), más
// filtros de fecha/vendedor/método/producto.
//
// El costo unitario se resuelve con el MISMO motor de costeo histórico que
// usa "Rentabilidad de Cartera" (window._rrcResolverCostoArticulo, definido
// en reportes-rentabilidad-cartera.js) — nunca un cálculo distinto, para que
// los dos reportes financieros del sistema siempre cuenten la misma
// historia. Esa función SIEMPRE entrega un costo (real, estimado del
// catálogo, o estimado por margen) salvo que el producto ya no exista.
//
// El interés de una venta a crédito (total - totalMercancia) se distribuye
// entre sus artículos proporcionalmente al peso de cada uno en el precio
// base de la venta — no hay forma de saber el interés "de una sola pieza"
// cuando el financiamiento se cotiza sobre el total, así que se reparte a
// prorrata, igual que se hace en la práctica para costear cualquier cargo a
// nivel venta.
// ================================================================

// ---------------------------------------------------------------
// 🔧 Helpers (reutilizan los globales de validator.js)
// ---------------------------------------------------------------

function _cuboEsc(v) { return typeof window._esc === 'function' ? window._esc(v) : String(v ?? ''); }
function _cuboDinero(v) {
    return typeof window.formatearDineroMX === 'function'
        ? window.formatearDineroMX(v)
        : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(v) || 0);
}
function _cuboParseFecha(v) {
    if (!v) return null;
    if (typeof window.parseFechaMX === 'function') {
        const d = window.parseFechaMX(v);
        return (d instanceof Date && !isNaN(d.getTime())) ? d : null;
    }
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
}
function _cuboArr(key) {
    const val = (typeof StorageService !== 'undefined') ? StorageService.get(key, []) : [];
    return Array.isArray(val) ? val : [];
}

// ---------------------------------------------------------------
// 📅 Bloques de tiempo
// ---------------------------------------------------------------

function _cuboBloqueTiempo(fecha, bloque) {
    if (!(fecha instanceof Date)) return '(sin fecha)';
    const y = fecha.getFullYear();
    const m = fecha.getMonth();
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    switch (bloque) {
        case 'dia': {
            const dd = String(fecha.getDate()).padStart(2, '0');
            const mm = String(m + 1).padStart(2, '0');
            return `${y}-${mm}-${dd}`;
        }
        case 'semana': {
            // Semana ISO aproximada (lunes a domingo), etiquetada por su lunes.
            const d = new Date(fecha);
            const diaSemana = (d.getDay() + 6) % 7; // 0 = lunes
            d.setDate(d.getDate() - diaSemana);
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `Semana del ${dd}/${mm}/${d.getFullYear()}`;
        }
        case 'trimestre': {
            const t = Math.floor(m / 3) + 1;
            return `${y}-T${t}`;
        }
        case 'anio':
            return String(y);
        case 'mes':
        default:
            return `${meses[m]} ${y}`;
    }
}

// Clave ordenable para que los bloques de tiempo salgan cronológicos en la tabla.
function _cuboBloqueTiempoOrden(fecha, bloque) {
    if (!(fecha instanceof Date)) return '9999-99';
    const y = fecha.getFullYear();
    const m = fecha.getMonth();
    switch (bloque) {
        case 'dia': return fecha.toISOString().slice(0, 10);
        case 'semana': {
            const d = new Date(fecha);
            const diaSemana = (d.getDay() + 6) % 7;
            d.setDate(d.getDate() - diaSemana);
            return d.toISOString().slice(0, 10);
        }
        case 'trimestre': return `${y}-${Math.floor(m / 3) + 1}`;
        case 'anio': return String(y);
        case 'mes':
        default: return `${y}-${String(m + 1).padStart(2, '0')}`;
    }
}

// ---------------------------------------------------------------
// 🏗️ CONSTRUCCIÓN DE HECHOS: una fila por artículo vendido
// ---------------------------------------------------------------

window.construirHechosCuboVentas = function() {
    const ventas = _cuboArr('ventasRegistradas');
    const historialCostos = _cuboArr('historialCostos');
    const productos = _cuboArr('productos');

    const hechos = [];

    ventas.forEach(v => {
        const estado = String(v.estado || v.estatus || '').toLowerCase();
        if (estado.includes('cancel')) return; // ventas canceladas no cuentan como venta real

        const fecha = _cuboParseFecha(v.fechaVenta || v.fecha);
        const articulos = Array.isArray(v.articulos) ? v.articulos : [];
        if (!articulos.length) return;

        const totalVenta = Number(v.total) || 0;
        const totalMercancia = (v.totalMercancia != null) ? Number(v.totalMercancia) : totalVenta;
        const interesTotalVenta = Math.max(0, totalVenta - totalMercancia);

        const sumaPrecioBaseVenta = articulos.reduce((s, a) => {
            const pb = Number(a.precioContado ?? a.precio ?? 0) || 0;
            const cant = Number(a.cantidad) || 1;
            return s + pb * cant;
        }, 0) || 1;

        articulos.forEach(a => {
            const cantidad = Number(a.cantidad) || 1;
            const precioBaseUnit = Number(a.precioContado ?? a.precio ?? 0) || 0;
            const precioVentaUnit = Number(a.precio ?? a.precioContado ?? 0) || 0;

            const costoInfo = (typeof window._rrcResolverCostoArticulo === 'function')
                ? window._rrcResolverCostoArticulo(a, v.fechaVenta || v.fecha, historialCostos, productos)
                : { costoUnitario: 0, costoTotal: 0, confianza: 'sin_dato' };

            const costoTotalLinea = costoInfo.costoTotal != null ? costoInfo.costoTotal : (costoInfo.costoUnitario || 0) * cantidad;
            const pesoLinea = (precioBaseUnit * cantidad) / sumaPrecioBaseVenta;
            const interesLinea = interesTotalVenta * pesoLinea;
            const precioBaseTotalLinea = precioBaseUnit * cantidad;
            const utilidadLinea = precioBaseTotalLinea - costoTotalLinea;

            hechos.push({
                folio: v.folio || '',
                fecha,
                producto: a.nombre || 'Artículo',
                color: (a.colorElegido && String(a.colorElegido).trim()) || '(sin color)',
                vendedor: v.vendedorNombre || v.vendedor || 'Sin vendedor',
                metodoPago: v.metodoPago || 'contado',
                clienteNombre: v.clienteNombre || '',
                cantidad,
                precioBaseUnit,
                precioBaseTotal: precioBaseTotalLinea,
                precioVentaUnit,
                precioVentaTotal: precioVentaUnit * cantidad,
                costoUnitario: costoInfo.costoUnitario || 0,
                costoTotal: costoTotalLinea,
                costoConfianza: costoInfo.confianza || 'sin_dato',
                interes: interesLinea,
                utilidad: utilidadLinea,
                margenPct: precioBaseTotalLinea > 0 ? (utilidadLinea / precioBaseTotalLinea) * 100 : 0
            });
        });
    });

    return hechos;
};

// ---------------------------------------------------------------
// 🎛️ CATÁLOGO DE DIMENSIONES Y MEDIDAS DISPONIBLES
// ---------------------------------------------------------------

const CUBO_DIMENSIONES = {
    producto: { label: 'Producto', getKey: (h) => h.producto },
    color: { label: 'Color', getKey: (h) => h.color },
    vendedor: { label: 'Vendedor', getKey: (h) => h.vendedor },
    metodoPago: { label: 'Método de pago', getKey: (h) => ({ credito: 'Crédito', contado: 'Contado', apartado: 'Apartado' }[h.metodoPago] || h.metodoPago) },
    cliente: { label: 'Cliente', getKey: (h) => h.clienteNombre || '(sin cliente)' },
    tiempo: { label: 'Tiempo', getKey: null } // se resuelve aparte según el bloque elegido
};

const CUBO_MEDIDAS = {
    cantidad: { label: 'Unidades', tipo: 'suma', formato: 'numero' },
    precioBaseTotal: { label: 'Precio base ($)', tipo: 'suma', formato: 'dinero' },
    precioVentaTotal: { label: 'Precio de venta ($)', tipo: 'suma', formato: 'dinero' },
    costoTotal: { label: 'Costo ($)', tipo: 'suma', formato: 'dinero' },
    interes: { label: 'Interés ($)', tipo: 'suma', formato: 'dinero' },
    utilidad: { label: 'Utilidad ($)', tipo: 'suma', formato: 'dinero' },
    margenPct: { label: 'Margen (%)', tipo: 'promedio_ponderado', formato: 'porcentaje' }
};

// ---------------------------------------------------------------
// 🔀 MOTOR DE AGRUPACIÓN (pivot)
// ---------------------------------------------------------------

/**
 * @param {Array} hechos - filas planas de construirHechosCuboVentas()
 * @param {Object} filtros - { desde, hasta, vendedor, metodoPago, productoTexto }
 * @param {String} dimFila - clave de CUBO_DIMENSIONES para agrupar filas
 * @param {String|null} dimColumna - clave de CUBO_DIMENSIONES para cruzar en columnas (opcional)
 * @param {String} bloqueTiempo - 'dia'|'semana'|'mes'|'trimestre'|'anio' (solo aplica si dimFila o dimColumna === 'tiempo')
 * @param {Array} medidas - claves de CUBO_MEDIDAS a calcular
 */
window.generarCuboVentas = function(hechos, filtros, dimFila, dimColumna, bloqueTiempo, medidas) {
    const desde = filtros.desde ? _cuboParseFecha(filtros.desde) : null;
    const hasta = filtros.hasta ? _cuboParseFecha(filtros.hasta) : null;
    if (hasta) hasta.setHours(23, 59, 59, 999);

    const filtrados = hechos.filter(h => {
        if (desde && (!h.fecha || h.fecha < desde)) return false;
        if (hasta && (!h.fecha || h.fecha > hasta)) return false;
        if (filtros.vendedor && h.vendedor !== filtros.vendedor) return false;
        if (filtros.metodoPago && h.metodoPago !== filtros.metodoPago) return false;
        if (filtros.productoTexto) {
            const t = filtros.productoTexto.toLowerCase();
            if (!h.producto.toLowerCase().includes(t)) return false;
        }
        return true;
    });

    const keyFila = (h) => dimFila === 'tiempo'
        ? _cuboBloqueTiempo(h.fecha, bloqueTiempo)
        : CUBO_DIMENSIONES[dimFila].getKey(h);
    const ordenFila = (h) => dimFila === 'tiempo' ? _cuboBloqueTiempoOrden(h.fecha, bloqueTiempo) : keyFila(h);

    const keyColumna = dimColumna
        ? (h) => dimColumna === 'tiempo' ? _cuboBloqueTiempo(h.fecha, bloqueTiempo) : CUBO_DIMENSIONES[dimColumna].getKey(h)
        : null;

    // Estructura: filas[claveFila] = { etiqueta, orden, columnas: { claveCol: {medida: acumulado} }, total: {medida: acumulado} }
    const filas = {};
    const columnasVistas = new Set();

    filtrados.forEach(h => {
        const kf = keyFila(h);
        const of = ordenFila(h);
        if (!filas[kf]) filas[kf] = { etiqueta: kf, orden: of, columnas: {}, total: {}, _pesoTotal: 0 };

        const kc = keyColumna ? keyColumna(h) : '_total';
        columnasVistas.add(kc);
        if (!filas[kf].columnas[kc]) filas[kf].columnas[kc] = { _peso: 0 };

        medidas.forEach(m => {
            const val = Number(h[m]) || 0;
            if (CUBO_MEDIDAS[m].tipo === 'promedio_ponderado') {
                // margen % se pondera por precioBaseTotal de la línea
                const peso = Number(h.precioBaseTotal) || 0;
                filas[kf].columnas[kc][m] = (filas[kf].columnas[kc][m] || 0) + val * peso;
                filas[kf].columnas[kc]._peso += peso;
                filas[kf].total[m] = (filas[kf].total[m] || 0) + val * peso;
                filas[kf]._pesoTotal += peso;
            } else {
                filas[kf].columnas[kc][m] = (filas[kf].columnas[kc][m] || 0) + val;
                filas[kf].total[m] = (filas[kf].total[m] || 0) + val;
            }
        });
    });

    // Resolver promedios ponderados a su valor final
    Object.values(filas).forEach(fila => {
        medidas.forEach(m => {
            if (CUBO_MEDIDAS[m].tipo === 'promedio_ponderado') {
                fila.total[m] = fila._pesoTotal > 0 ? fila.total[m] / fila._pesoTotal : 0;
                Object.values(fila.columnas).forEach(col => {
                    col[m] = col._peso > 0 ? col[m] / col._peso : 0;
                });
            }
        });
    });

    const filasOrdenadas = Object.values(filas).sort((a, b) => String(a.orden).localeCompare(String(b.orden)));
    const columnasOrdenadas = [...columnasVistas].sort();

    // Totales generales (suma de todas las filas, con el mismo cuidado para promedios ponderados)
    const totalGeneral = {};
    let pesoGeneral = 0;
    medidas.forEach(m => { totalGeneral[m] = 0; });
    filtrados.forEach(h => {
        medidas.forEach(m => {
            const val = Number(h[m]) || 0;
            if (CUBO_MEDIDAS[m].tipo === 'promedio_ponderado') {
                const peso = Number(h.precioBaseTotal) || 0;
                totalGeneral[m] += val * peso;
            } else {
                totalGeneral[m] += val;
            }
        });
    });
    filtrados.forEach(h => { pesoGeneral += Number(h.precioBaseTotal) || 0; });
    medidas.forEach(m => {
        if (CUBO_MEDIDAS[m].tipo === 'promedio_ponderado') {
            totalGeneral[m] = pesoGeneral > 0 ? totalGeneral[m] / pesoGeneral : 0;
        }
    });

    return { filas: filasOrdenadas, columnas: columnasOrdenadas, totalGeneral, filasCount: filtrados.length };
};

// ---------------------------------------------------------------
// 🖼️ RENDER: formulario de control (dimensiones, medidas, filtros)
// ---------------------------------------------------------------

function _cuboFormatoValor(valor, formato) {
    if (formato === 'dinero') return _cuboDinero(valor);
    if (formato === 'porcentaje') return (Number(valor) || 0).toFixed(1) + '%';
    return new Intl.NumberFormat('es-MX').format(Math.round((Number(valor) || 0) * 100) / 100);
}

window.renderCuboVentas = function() {
    const cont = document.getElementById('reporte-cubo-ventas');
    if (!cont) return;

    const hechos = window.construirHechosCuboVentas();
    window._cuboHechosCache = hechos;

    const vendedoresDisponibles = [...new Set(hechos.map(h => h.vendedor))].sort();

    cont.innerHTML = `
        <div style="max-width:1300px;margin:0 auto;">
            <h2 style="margin:0 0 4px;color:#0f172a;">🧊 Cubo de Ventas</h2>
            <p style="color:#64748b;margin:0 0 18px;">Elige con qué agrupar, qué medidas ver, y filtra por fecha, vendedor o producto.</p>

            <div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:18px;margin-bottom:16px;">
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:14px;">
                    <div>
                        <label style="font-size:11px;font-weight:900;color:#64748b;text-transform:uppercase;display:block;margin-bottom:4px;">Agrupar filas por</label>
                        <select id="cuboDimFila" onchange="window._cuboToggleBloqueTiempo(); window.renderizarResultadoCubo();" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;">
                            ${Object.entries(CUBO_DIMENSIONES).map(([k, d]) => `<option value="${k}" ${k === 'producto' ? 'selected' : ''}>${d.label}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label style="font-size:11px;font-weight:900;color:#64748b;text-transform:uppercase;display:block;margin-bottom:4px;">Cruzar columnas por (opcional)</label>
                        <select id="cuboDimColumna" onchange="window._cuboToggleBloqueTiempo(); window.renderizarResultadoCubo();" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;">
                            <option value="">— Ninguna —</option>
                            ${Object.entries(CUBO_DIMENSIONES).map(([k, d]) => `<option value="${k}">${d.label}</option>`).join('')}
                        </select>
                    </div>
                    <div id="cuboBloqueTiempoWrap" style="display:none;">
                        <label style="font-size:11px;font-weight:900;color:#64748b;text-transform:uppercase;display:block;margin-bottom:4px;">Bloque de tiempo</label>
                        <select id="cuboBloqueTiempo" onchange="window.renderizarResultadoCubo();" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;">
                            <option value="dia">Día</option>
                            <option value="semana">Semana</option>
                            <option value="mes" selected>Mes</option>
                            <option value="trimestre">Trimestre</option>
                            <option value="anio">Año</option>
                        </select>
                    </div>
                </div>

                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:14px;padding-top:12px;border-top:1px solid #f1f5f9;">
                    <div>
                        <label style="font-size:11px;font-weight:900;color:#64748b;text-transform:uppercase;display:block;margin-bottom:4px;">Desde</label>
                        <input type="date" id="cuboFiltroDesde" onchange="window.renderizarResultadoCubo();" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;">
                    </div>
                    <div>
                        <label style="font-size:11px;font-weight:900;color:#64748b;text-transform:uppercase;display:block;margin-bottom:4px;">Hasta</label>
                        <input type="date" id="cuboFiltroHasta" onchange="window.renderizarResultadoCubo();" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;">
                    </div>
                    <div>
                        <label style="font-size:11px;font-weight:900;color:#64748b;text-transform:uppercase;display:block;margin-bottom:4px;">Vendedor</label>
                        <select id="cuboFiltroVendedor" onchange="window.renderizarResultadoCubo();" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;">
                            <option value="">Todos</option>
                            ${vendedoresDisponibles.map(v => `<option value="${_cuboEsc(v)}">${_cuboEsc(v)}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label style="font-size:11px;font-weight:900;color:#64748b;text-transform:uppercase;display:block;margin-bottom:4px;">Método de pago</label>
                        <select id="cuboFiltroMetodo" onchange="window.renderizarResultadoCubo();" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;">
                            <option value="">Todos</option>
                            <option value="contado">Contado</option>
                            <option value="credito">Crédito</option>
                            <option value="apartado">Apartado</option>
                        </select>
                    </div>
                    <div>
                        <label style="font-size:11px;font-weight:900;color:#64748b;text-transform:uppercase;display:block;margin-bottom:4px;">Buscar producto</label>
                        <input type="text" id="cuboFiltroProducto" oninput="window.renderizarResultadoCubo();" placeholder="ej. sala, refrigerador..." style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;">
                    </div>
                </div>

                <div style="padding-top:12px;border-top:1px solid #f1f5f9;">
                    <label style="font-size:11px;font-weight:900;color:#64748b;text-transform:uppercase;display:block;margin-bottom:8px;">Medidas a mostrar</label>
                    <div style="display:flex;gap:14px;flex-wrap:wrap;">
                        ${Object.entries(CUBO_MEDIDAS).map(([k, m]) => `
                            <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">
                                <input type="checkbox" class="cuboMedidaCheck" value="${k}" ${['cantidad', 'precioBaseTotal', 'costoTotal', 'utilidad'].includes(k) ? 'checked' : ''} onchange="window.renderizarResultadoCubo();">
                                ${m.label}
                            </label>
                        `).join('')}
                    </div>
                </div>
            </div>

            <div id="cuboResultado"></div>
        </div>
    `;

    window.renderizarResultadoCubo();
};

window._cuboToggleBloqueTiempo = function() {
    const dimFila = document.getElementById('cuboDimFila')?.value;
    const dimColumna = document.getElementById('cuboDimColumna')?.value;
    const wrap = document.getElementById('cuboBloqueTiempoWrap');
    if (wrap) wrap.style.display = (dimFila === 'tiempo' || dimColumna === 'tiempo') ? 'block' : 'none';
};

// ---------------------------------------------------------------
// 🖼️ RENDER: tabla resultado (se re-dibuja en cada cambio de control)
// ---------------------------------------------------------------

window.renderizarResultadoCubo = function() {
    const destino = document.getElementById('cuboResultado');
    if (!destino) return;

    const hechos = window._cuboHechosCache || window.construirHechosCuboVentas();
    const dimFila = document.getElementById('cuboDimFila')?.value || 'producto';
    const dimColumnaRaw = document.getElementById('cuboDimColumna')?.value || '';
    const dimColumna = dimColumnaRaw || null;
    const bloqueTiempo = document.getElementById('cuboBloqueTiempo')?.value || 'mes';
    const medidas = [...document.querySelectorAll('.cuboMedidaCheck:checked')].map(el => el.value);

    if (dimColumna && dimColumna === dimFila) {
        destino.innerHTML = `<div style="padding:20px;text-align:center;color:#991b1b;background:#fee2e2;border-radius:8px;">No puedes cruzar una dimensión contra sí misma. Elige una distinta para columnas, o déjalo en "Ninguna".</div>`;
        return;
    }
    if (!medidas.length) {
        destino.innerHTML = `<div style="padding:20px;text-align:center;color:#94a3b8;">Marca al menos una medida para ver resultados.</div>`;
        return;
    }

    const filtros = {
        desde: document.getElementById('cuboFiltroDesde')?.value || '',
        hasta: document.getElementById('cuboFiltroHasta')?.value || '',
        vendedor: document.getElementById('cuboFiltroVendedor')?.value || '',
        metodoPago: document.getElementById('cuboFiltroMetodo')?.value || '',
        productoTexto: document.getElementById('cuboFiltroProducto')?.value || ''
    };

    const resultado = window.generarCuboVentas(hechos, filtros, dimFila, dimColumna, bloqueTiempo, medidas);
    window._cuboUltimoResultado = { resultado, medidas, dimFila, dimColumna };

    if (!resultado.filas.length) {
        destino.innerHTML = `<div style="padding:24px;text-align:center;color:#94a3b8;background:white;border:1px solid #e2e8f0;border-radius:10px;">Sin ventas que coincidan con estos filtros.</div>`;
        return;
    }

    const nombreDimFila = CUBO_DIMENSIONES[dimFila].label;

    let tablaHtml;
    if (!dimColumna) {
        // Tabla simple: filas x medidas
        tablaHtml = `
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead>
                    <tr style="background:#f8fafc;text-align:left;">
                        <th style="padding:10px 8px;">${_cuboEsc(nombreDimFila)}</th>
                        ${medidas.map(m => `<th style="padding:10px 8px;text-align:right;">${CUBO_MEDIDAS[m].label}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${resultado.filas.map(f => `
                        <tr style="border-bottom:1px solid #f1f5f9;">
                            <td style="padding:8px;font-weight:700;color:#0f172a;">${_cuboEsc(f.etiqueta)}</td>
                            ${medidas.map(m => `<td style="padding:8px;text-align:right;">${_cuboFormatoValor(f.total[m], CUBO_MEDIDAS[m].formato)}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr style="background:#f1f5f9;font-weight:900;">
                        <td style="padding:8px;">Total</td>
                        ${medidas.map(m => `<td style="padding:8px;text-align:right;">${_cuboFormatoValor(resultado.totalGeneral[m], CUBO_MEDIDAS[m].formato)}</td>`).join('')}
                    </tr>
                </tfoot>
            </table>`;
    } else {
        // Tabla cruzada: filas x columnas, una medida a la vez (si hay varias medidas marcadas, se apilan en bloques).
        const nombreDimColumna = CUBO_DIMENSIONES[dimColumna].label;
        tablaHtml = medidas.map(m => `
            <div style="margin-bottom:22px;">
                <div style="font-weight:900;color:#0f172a;margin-bottom:8px;">${CUBO_MEDIDAS[m].label} — ${_cuboEsc(nombreDimFila)} × ${_cuboEsc(nombreDimColumna)}</div>
                <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
                    <thead>
                        <tr style="background:#f8fafc;text-align:left;">
                            <th style="padding:8px;position:sticky;left:0;background:#f8fafc;">${_cuboEsc(nombreDimFila)}</th>
                            ${resultado.columnas.map(c => `<th style="padding:8px;text-align:right;white-space:nowrap;">${_cuboEsc(c)}</th>`).join('')}
                            <th style="padding:8px;text-align:right;font-weight:900;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${resultado.filas.map(f => `
                            <tr style="border-bottom:1px solid #f1f5f9;">
                                <td style="padding:8px;font-weight:700;position:sticky;left:0;background:white;">${_cuboEsc(f.etiqueta)}</td>
                                ${resultado.columnas.map(c => `<td style="padding:8px;text-align:right;">${f.columnas[c] ? _cuboFormatoValor(f.columnas[c][m] || 0, CUBO_MEDIDAS[m].formato) : '—'}</td>`).join('')}
                                <td style="padding:8px;text-align:right;font-weight:900;">${_cuboFormatoValor(f.total[m], CUBO_MEDIDAS[m].formato)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                </div>
            </div>
        `).join('');
    }

    destino.innerHTML = `
        <div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:18px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
                <div style="font-size:12px;color:#64748b;">${resultado.filasCount} línea(s) de venta consideradas.</div>
                <button onclick="window.exportarCuboVentasCSV()" style="padding:8px 14px;background:#0f766e;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:12px;">⬇️ Exportar CSV</button>
            </div>
            <div style="overflow-x:auto;">${tablaHtml}</div>
        </div>
    `;
};

// ---------------------------------------------------------------
// ⬇️ EXPORTAR CSV del resultado actual
// ---------------------------------------------------------------

window.exportarCuboVentasCSV = function() {
    const cache = window._cuboUltimoResultado;
    if (!cache) return;
    const { resultado, medidas, dimFila, dimColumna } = cache;

    let filas = [];
    if (!dimColumna) {
        filas.push([CUBO_DIMENSIONES[dimFila].label, ...medidas.map(m => CUBO_MEDIDAS[m].label)]);
        resultado.filas.forEach(f => {
            filas.push([f.etiqueta, ...medidas.map(m => (f.total[m] ?? 0).toFixed(2))]);
        });
        filas.push(['Total', ...medidas.map(m => (resultado.totalGeneral[m] ?? 0).toFixed(2))]);
    } else {
        filas.push([CUBO_DIMENSIONES[dimFila].label, 'Medida', ...resultado.columnas, 'Total']);
        resultado.filas.forEach(f => {
            medidas.forEach(m => {
                filas.push([
                    f.etiqueta,
                    CUBO_MEDIDAS[m].label,
                    ...resultado.columnas.map(c => (f.columnas[c]?.[m] ?? 0).toFixed(2)),
                    (f.total[m] ?? 0).toFixed(2)
                ]);
            });
        });
    }

    const csv = filas.map(fila => fila.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cubo-ventas-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
