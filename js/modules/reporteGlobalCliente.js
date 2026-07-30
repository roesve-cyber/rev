// ================================================================
// 🌐 MÓDULO: REPORTE GLOBAL DE CLIENTE (Reportes)
// A diferencia de "Estado de Cuenta Cliente" (Operación, que SOLO
// muestra cuentas por cobrar / crédito), este reporte junta las
// TRES formas en que un cliente interactúa con la tienda:
//   🧾 Crédito     (cuentasPorCobrar)
//   📦 Apartados   (apartados)
//   💵 Contado     (ventasRegistradas con metodoPago = 'contado')
// Incluye vigentes, saldadas/liquidadas, migradas y canceladas —
// es la foto completa del cliente, no solo lo que debe.
//
// Reutiliza los helpers globales ya definidos en estadoCuentaCliente.js
// (_clienteIdCuenta, _clienteNombreCuenta, _normalizarCuentaTexto,
// _fechaCortaCuenta, _diasTranscurridos, _dineroCuenta, _saldoCuenta,
// _totalCuenta, _abonosCuenta, _fechaAbonoCuenta) — ese script se carga
// antes que este en index.html.
// ================================================================

// 📦 Clasificación de estado de un apartado -> etiqueta + llave de filtro
function _rgcApartadoInfo(ap) {
    const raw = String(ap?.estado || '').toLowerCase();
    if (raw.includes('migrado') || raw.includes('conversion')) return { label: 'Migrado', key: 'migrado' };
    if (raw.includes('cancel')) return { label: 'Cancelado', key: 'cancelado' };
    if (raw.includes('liquidado')) return { label: 'Saldado', key: 'saldado' };
    return { label: 'Vigente', key: 'vigente' };
}

function _rgcApartadoAbonado(ap) {
    if (typeof _apartadoTotalPagado === 'function') return _apartadoTotalPagado(ap);
    const vigentes = (typeof _apartadoAbonosVigentes === 'function') ? _apartadoAbonosVigentes(ap) : (ap?.abonos || []);
    return (Number(ap?.enganche || 0) || 0) + vigentes.reduce((s, a) => s + (Number(a.monto) || 0), 0);
}

function _rgcApartadoSaldo(ap, key) {
    if (key === 'migrado' || key === 'cancelado') return 0;
    if (typeof _apartadoSaldoReal === 'function') return Math.max(0, _apartadoSaldoReal(ap));
    return Math.max(0, (Number(ap?.importeApartado || ap?.total || 0) || 0) - _rgcApartadoAbonado(ap));
}

// 🧾 Clasificación de estado de una cuenta por cobrar (crédito) -> etiqueta + llave de filtro
function _rgcCreditoInfo(cuenta, saldo) {
    const raw = String(cuenta?.estado || '').toLowerCase();
    if (raw.includes('cancel')) return { label: 'Cancelado', key: 'cancelado' };
    if (saldo <= 0.01) return { label: 'Saldado', key: 'saldado' };
    return { label: 'Vigente', key: 'vigente' };
}

// 💵 Clasificación de una venta de contado -> etiqueta + llave de filtro
// Una venta de contado se paga completa en el momento: no tiene estado
// "vigente con saldo pendiente", solo Saldada (normal) o Cancelada.
function _rgcContadoInfo(venta) {
    const raw = String(venta?.estado || venta?.estatus || '').toLowerCase();
    if (raw.includes('cancel')) return { label: 'Cancelada', key: 'cancelado' };
    return { label: 'Saldada', key: 'saldado' };
}

// 🎯 Función principal: junta crédito + apartados + contado de un cliente
window.obtenerReporteGlobalCliente = function(clienteId, clienteNombre = '') {
    const cuentasCxC = StorageService.get('cuentasPorCobrar', []);
    const apartadosTodos = StorageService.get('apartados', []);
    const ventasTodas = StorageService.get('ventasRegistradas', []);

    const idBuscado = String(clienteId || '').trim();
    const nombreBuscado = _normalizarCuentaTexto(clienteNombre);

    const coincideCliente = (obj) => {
        const idObj = String(_clienteIdCuenta(obj) || obj?.clienteId || '').trim();
        const nombreObj = _normalizarCuentaTexto(_clienteNombreCuenta(obj) || obj?.clienteNombre);
        return (idBuscado && idObj && idObj === idBuscado) ||
               (nombreBuscado && nombreObj && nombreObj === nombreBuscado);
    };

    const cuentasCliente = cuentasCxC.filter(coincideCliente);
    const apartadosCliente = apartadosTodos.filter(coincideCliente);
    // Solo las ventas de CONTADO cuentan aquí; crédito/apartado ya se ven arriba
    // y de otro modo se listarían por triplicado (ventasRegistradas también
    // guarda un registro de las ventas a crédito y apartados).
    const comprasContadoCliente = ventasTodas.filter(v => v.metodoPago === 'contado' && coincideCliente(v));

    if (cuentasCliente.length === 0 && apartadosCliente.length === 0 && comprasContadoCliente.length === 0) {
        return { clienteId, clienteNombre, existe: false, filas: [], totales: null };
    }

    const filas = [];
    let totalCreditoVendido = 0, totalCreditoSaldo = 0;
    let totalApartadoVendido = 0, totalApartadoSaldo = 0;
    let totalContado = 0;

    cuentasCliente.forEach(cuenta => {
        const saldo = _saldoCuenta(cuenta);
        const total = _totalCuenta(cuenta);
        const abonos = _abonosCuenta(cuenta);
        const { label, key } = _rgcCreditoInfo(cuenta, saldo);
        const fecha = cuenta.fechaVenta || cuenta.fecha;

        if (key !== 'cancelado') {
            totalCreditoVendido += total;
            totalCreditoSaldo += saldo;
        }

        filas.push({
            tipo: 'Crédito',
            icono: '🧾',
            folio: cuenta.folio,
            fecha,
            fechaCorta: _fechaCortaCuenta(fecha),
            total,
            saldo,
            diasAntiguo: _diasTranscurridos(fecha),
            abonos: abonos.length,
            ultimoAbono: abonos.length > 0 ? _fechaCortaCuenta(_fechaAbonoCuenta(abonos[abonos.length - 1])) : '-',
            estado: label,
            filtroKey: key
        });
    });

    apartadosCliente.forEach(ap => {
        const { label, key } = _rgcApartadoInfo(ap);
        const total = Number(ap.importeApartado || ap.total || 0) || 0;
        const saldo = _rgcApartadoSaldo(ap, key);
        const abonosVigentes = (typeof _apartadoAbonosVigentes === 'function') ? _apartadoAbonosVigentes(ap) : (ap.abonos || []);
        const fecha = ap.fechaApartado;

        if (key === 'vigente' || key === 'saldado') {
            totalApartadoVendido += total;
            totalApartadoSaldo += saldo;
        }

        filas.push({
            tipo: 'Apartado',
            icono: '📦',
            folio: ap.folio,
            fecha,
            fechaCorta: _fechaCortaCuenta(fecha),
            total,
            saldo,
            diasAntiguo: _diasTranscurridos(fecha),
            abonos: abonosVigentes.length,
            ultimoAbono: abonosVigentes.length > 0 ? _fechaCortaCuenta(_fechaAbonoCuenta(abonosVigentes[abonosVigentes.length - 1])) : '-',
            estado: label,
            filtroKey: key,
            folioCredito: ap.folioCredito || null
        });
    });

    comprasContadoCliente.forEach(venta => {
        const { label, key } = _rgcContadoInfo(venta);
        const total = Number(venta.total || venta.totalMercancia || 0) || 0;
        const fecha = venta.fechaVenta || venta.fecha;

        if (key !== 'cancelado') totalContado += total;

        filas.push({
            tipo: 'Contado',
            icono: '💵',
            folio: venta.folio,
            fecha,
            fechaCorta: _fechaCortaCuenta(fecha),
            total,
            saldo: 0,
            diasAntiguo: _diasTranscurridos(fecha),
            abonos: 0,
            ultimoAbono: '-',
            estado: label,
            filtroKey: key
        });
    });

    // Ordenar por fecha, más reciente primero
    filas.sort((a, b) => {
        const da = a.fecha ? (window.parseFechaMX ? window.parseFechaMX(a.fecha) : new Date(a.fecha)) : null;
        const db = b.fecha ? (window.parseFechaMX ? window.parseFechaMX(b.fecha) : new Date(b.fecha)) : null;
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return db - da;
    });

    const snapshot = cuentasCliente[0] || apartadosCliente[0] || comprasContadoCliente[0] || {};
    const canonico = (typeof window.obtenerClienteCanonico === 'function')
        ? window.obtenerClienteCanonico(clienteId, clienteNombre, _clienteTelefonoCuenta(snapshot))
        : null;

    return {
        existe: true,
        clienteId: canonico?.id ?? clienteId,
        clienteNombre: canonico?.nombre || _clienteNombreCuenta(snapshot) || snapshot.clienteNombre || clienteNombre,
        clienteTelefono: canonico?.telefono || _clienteTelefonoCuenta(snapshot),
        clienteDireccion: canonico?.direccion || _clienteDireccionCuenta(snapshot),
        filas,
        totales: {
            totalCreditoVendido, totalCreditoSaldo,
            totalApartadoVendido, totalApartadoSaldo,
            totalContado,
            saldoPendienteGlobal: totalCreditoSaldo + totalApartadoSaldo,
            totalOperado: totalCreditoVendido + totalApartadoVendido + totalContado
        }
    };
};

// ────────────────────────────────────────────────────────────────
// UI
// ────────────────────────────────────────────────────────────────

window._rgcObtenerFiltro = function() {
    return document.getElementById('rgcFiltroEstado')?.value || 'todos';
};

function _rgcFilasFiltradas(filas, filtro) {
    if (filtro === 'todos') return filas;
    return filas.filter(f => f.filtroKey === filtro);
}

function _rgcBadge(filtroKey) {
    const mapa = {
        vigente: { bg: '#e0f2fe', color: '#0c4a6e' },
        saldado: { bg: '#d1fae5', color: '#065f46' },
        migrado: { bg: '#ede9fe', color: '#5b21b6' },
        cancelado: { bg: '#f1f5f9', color: '#475569' }
    };
    return mapa[filtroKey] || mapa.vigente;
}

window.renderReporteGlobalCliente = function() {
    const vista = document.getElementById('reporte-global-cliente');
    if (!vista) return;

    vista.innerHTML = `
        <h2 style="margin:0 0 20px 0; color:#1e293b;">🌐 Reporte Global de Cliente</h2>
        <p style="margin:0 0 20px 0; color:#64748b; font-size:13px;">Vista completa del cliente: crédito, apartados y compras de contado — vigentes, saldadas/liquidadas, migradas y canceladas.</p>
        <div style="background:white; border:1px solid #e2e8f0; border-radius:10px; padding:20px; margin-bottom:20px;">
            <div style="display:flex; gap:15px; align-items:flex-end; flex-wrap:wrap;">
                <div style="flex:1; min-width:250px;">
                    <label style="display:block; font-weight:bold; margin-bottom:8px; color:#1e293b;">👤 Cliente:</label>
                    <div style="display:flex; gap:10px;">
                        <input type="text" id="rgcClienteNombre" readonly placeholder="Selecciona un cliente..."
                               style="flex:1; padding:12px; border:2px solid #cbd5e1; border-radius:8px; font-size:14px; background:#f8fafc;">
                        <button onclick="window._rgcAbrirSelectorCliente()"
                                style="padding:12px 20px; background:#0f172a; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">
                            🔍 Buscar
                        </button>
                    </div>
                </div>
                <div style="min-width:200px;">
                    <label style="display:block; font-weight:bold; margin-bottom:8px; color:#1e293b;">🔎 Filtrar por estado:</label>
                    <select id="rgcFiltroEstado" onchange="window._rgcAplicarFiltro()"
                            style="width:100%; padding:12px; border:2px solid #cbd5e1; border-radius:8px; font-size:14px; background:white; font-weight:bold; color:#1e293b;">
                        <option value="todos">Todos los estados</option>
                        <option value="vigente">Vigentes</option>
                        <option value="saldado">Saldadas / Liquidadas</option>
                        <option value="migrado">Migradas a Crédito</option>
                        <option value="cancelado">Canceladas</option>
                    </select>
                </div>
            </div>
        </div>
        <div id="rgcContenidoReporte"></div>
    `;
};

window._rgcAbrirSelectorCliente = function() {
    if (typeof window.abrirSelectorCliente !== 'function') {
        return alert('⚠️ El selector de clientes no está disponible.');
    }
    window.abrirSelectorCliente({
        titulo: '👤 Seleccionar Cliente',
        onSeleccion: function(cliente) {
            window._rgcClienteSeleccionado = cliente;
            const input = document.getElementById('rgcClienteNombre');
            if (input) input.value = cliente.nombre || '';
            window._rgcGenerarReporte();
        }
    });
};

window._rgcGenerarReporte = function() {
    const cliente = window._rgcClienteSeleccionado;
    const cont = document.getElementById('rgcContenidoReporte');
    if (!cliente || !cont) return;

    const datos = window.obtenerReporteGlobalCliente(cliente.id, cliente.nombre);
    window._rgcDatosActuales = datos;

    if (!datos.existe) {
        cont.innerHTML = `<div style="background:#fef3c7; border:1px solid #fbbf24; border-radius:10px; padding:20px; text-align:center; color:#92400e; font-weight:bold;">
            ⚠️ No se encontraron cuentas de crédito, apartados ni compras de contado para este cliente.
        </div>`;
        return;
    }

    const t = datos.totales;
    cont.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:15px; margin-bottom:20px;">
            <div style="background:white; border:1px solid #e2e8f0; border-radius:10px; padding:16px;">
                <div style="font-size:12px; color:#64748b; font-weight:bold;">🧾 CRÉDITO — SALDO</div>
                <div style="font-size:20px; font-weight:bold; color:#1e293b;">${_dineroCuenta(t.totalCreditoSaldo)}</div>
                <div style="font-size:11px; color:#94a3b8;">de ${_dineroCuenta(t.totalCreditoVendido)} vendido</div>
            </div>
            <div style="background:white; border:1px solid #e2e8f0; border-radius:10px; padding:16px;">
                <div style="font-size:12px; color:#64748b; font-weight:bold;">📦 APARTADOS — SALDO</div>
                <div style="font-size:20px; font-weight:bold; color:#1e293b;">${_dineroCuenta(t.totalApartadoSaldo)}</div>
                <div style="font-size:11px; color:#94a3b8;">de ${_dineroCuenta(t.totalApartadoVendido)} vendido</div>
            </div>
            <div style="background:white; border:1px solid #e2e8f0; border-radius:10px; padding:16px;">
                <div style="font-size:12px; color:#64748b; font-weight:bold;">💵 COMPRAS DE CONTADO</div>
                <div style="font-size:20px; font-weight:bold; color:#1e293b;">${_dineroCuenta(t.totalContado)}</div>
                <div style="font-size:11px; color:#94a3b8;">pagado en el momento</div>
            </div>
            <div style="background:#eff6ff; border:2px solid #1e40af; border-radius:10px; padding:16px;">
                <div style="font-size:12px; color:#1e40af; font-weight:bold;">💰 SALDO PENDIENTE GLOBAL</div>
                <div style="font-size:22px; font-weight:bold; color:#1e40af;">${_dineroCuenta(t.saldoPendienteGlobal)}</div>
                <div style="font-size:11px; color:#3b82f6;">crédito + apartados vigentes</div>
            </div>
        </div>
        <div id="rgcTablaWrap"></div>
    `;
    window._rgcRenderTabla();
};

window._rgcRenderTabla = function() {
    const wrap = document.getElementById('rgcTablaWrap');
    const datos = window._rgcDatosActuales;
    if (!wrap || !datos || !datos.existe) return;

    const filtro = window._rgcObtenerFiltro();
    const filasFiltradas = _rgcFilasFiltradas(datos.filas, filtro);
    const etiquetaFiltro = { todos: 'totales', vigente: 'vigentes', saldado: 'saldadas/liquidadas', migrado: 'migradas', cancelado: 'canceladas' }[filtro];

    const filasHtml = filasFiltradas.length > 0
        ? filasFiltradas.map(f => {
            const badge = _rgcBadge(f.filtroKey);
            const notaMigrado = f.filtroKey === 'migrado' && f.folioCredito
                ? `<div style="font-size:10px; color:#94a3b8;">→ crédito ${f.folioCredito}</div>` : '';
            return `
            <tr style="border-bottom:1px solid #e2e8f0; background:${f.saldo <= 0.01 ? '#f8fafc' : 'white'};">
                <td style="padding:12px; border:1px solid #cbd5e1; font-weight:bold; color:#0c4a6e;">${f.folio}${notaMigrado}</td>
                <td style="padding:12px; text-align:center; border:1px solid #cbd5e1; font-size:12px;">${f.icono} ${f.tipo}</td>
                <td style="padding:12px; text-align:center; border:1px solid #cbd5e1;">${f.fechaCorta}</td>
                <td style="padding:12px; text-align:right; border:1px solid #cbd5e1; font-weight:bold; color:#065f46;">${_dineroCuenta(f.total)}</td>
                <td style="padding:12px; text-align:right; border:1px solid #cbd5e1; font-weight:bold; color:${f.saldo > 0 ? '#7f1d1d' : '#065f46'};">${_dineroCuenta(f.saldo)}</td>
                <td style="padding:12px; text-align:center; border:1px solid #cbd5e1;">${f.diasAntiguo}</td>
                <td style="padding:12px; text-align:center; border:1px solid #cbd5e1;"><span style="background:${badge.bg}; color:${badge.color}; padding:6px 12px; border-radius:6px; display:inline-block; font-weight:bold; font-size:11px;">${f.estado}</span></td>
            </tr>`;
        }).join('')
        : `<tr><td colspan="7" style="padding:20px; text-align:center; color:#64748b; border:1px solid #cbd5e1;">No hay registros ${etiquetaFiltro} para este cliente.</td></tr>`;

    wrap.innerHTML = `
        <div style="background:white; border:1px solid #e2e8f0; border-radius:10px; padding:20px;">
            <h3 style="margin:0 0 6px 0; color:#1e293b; font-size:16px; font-weight:bold;">📋 Detalle Consolidado</h3>
            <p style="margin:0 0 12px 0; color:#64748b; font-size:12px;">Mostrando ${filasFiltradas.length} de ${datos.filas.length} folios (${etiquetaFiltro})</p>
            <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; font-size:13px;">
                    <thead>
                        <tr style="background:#1e40af; color:white; font-weight:bold;">
                            <th style="padding:12px; text-align:left; border:1px solid #cbd5e1;">Folio</th>
                            <th style="padding:12px; text-align:center; border:1px solid #cbd5e1;">Tipo</th>
                            <th style="padding:12px; text-align:center; border:1px solid #cbd5e1;">Fecha</th>
                            <th style="padding:12px; text-align:right; border:1px solid #cbd5e1;">Total</th>
                            <th style="padding:12px; text-align:right; border:1px solid #cbd5e1;">Saldo</th>
                            <th style="padding:12px; text-align:center; border:1px solid #cbd5e1;">Días</th>
                            <th style="padding:12px; text-align:center; border:1px solid #cbd5e1;">Estatus</th>
                        </tr>
                    </thead>
                    <tbody>${filasHtml}</tbody>
                </table>
            </div>
        </div>
    `;
};

window._rgcAplicarFiltro = function() {
    window._rgcRenderTabla();
};
