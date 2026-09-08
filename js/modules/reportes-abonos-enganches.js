// ========================================================================
// 📊 REPORTE DE ABONOS Y ENGANCHES PARA COBRANZA
// Filtra por: estatus de cuenta, fecha de venta, ubicación de recepción
// Muestra: saldo anterior, saldo pendiente después del abono
// Ordena: más reciente a más antiguo
// ========================================================================

// Resuelve el cliente VIGENTE (unificado) para un registro de cxc/apartado, en vez de
// confiar en el nombre "congelado" que quedó guardado en el momento de la venta.
function _repClienteVigente(clienteId, nombreSnapshot, telefono) {
    if (typeof window.obtenerClienteCanonico !== 'function') {
        return { id: clienteId || null, nombre: nombreSnapshot };
    }
    const canonico = window.obtenerClienteCanonico(clienteId, nombreSnapshot, telefono);
    return canonico ? { id: canonico.id ?? clienteId ?? null, nombre: canonico.nombre || nombreSnapshot } : { id: clienteId || null, nombre: nombreSnapshot };
}

// FUNCIÓN AUXILIAR: Obtiene el listado completo filtrado y ordenado (una sola fuente de verdad)
function _obtenerListadoReporteAbonEnganches(filtroDesde, filtroHasta, filtroEstatus, filtroUbicacion, filtroTipo, ordenFlujo, filtroClienteId) {
    const desdeD = filtroDesde ? new Date(filtroDesde + 'T00:00:00') : null;
    const hastaD = filtroHasta ? new Date(filtroHasta + 'T23:59:59') : null;
    
    const listado = [];

    // 1. ABONOS DE CXC (Créditos)
    const cuentasCxC = StorageService.get('cuentasPorCobrar', []);
    cuentasCxC.forEach(cuenta => {
        const abonos = (cuenta.abonos || []).filter(a => !a.cancelado);
        
        abonos.forEach((abono, indexAbono) => {
            const fechaAbono = _repParseDate(abono.fechaAbonoIso || abono.fechaIso || abono.fecha);
            if (isNaN(fechaAbono.getTime())) return;
            if (desdeD && fechaAbono < desdeD) return;
            if (hastaD && fechaAbono > hastaD) return;

            const fechaVenta = _repParseDate(cuenta.fechaVenta || cuenta.fecha);
            const estado = String(cuenta.estado || cuenta.estatus || 'Pendiente').toLowerCase();

            if (filtroEstatus && !estado.includes(filtroEstatus.toLowerCase())) return;

            // Calcular saldos
            const pagares = StorageService.get('pagaresSistema', []) || [];
            const totalPagares = pagares
                .filter(p => p.folio === cuenta.folio && (p.estado === 'Pendiente' || p.estado === 'Parcial'))
                .reduce((s, p) => s + Math.max(0, (Number(p.monto || 0) - Number(p.montoAbonado || 0))), 0);

            const saldoAnterior = totalPagares + Number(abono.monto || abono.montoAbonado || 0);
            const saldoPosterior = Math.max(0, Number(cuenta.saldoActual || 0));

            const _cliAbonoCred = _repClienteVigente(cuenta.clienteId, cuenta.nombre || cuenta.clienteNombre || '-', cuenta.telefono);
            listado.push({
                tipo: 'abono_credito',
                folio: cuenta.folio,
                articulos: cuenta.articulos || [],
                cliente: _cliAbonoCred.nombre,
                clienteId: _cliAbonoCred.id,
                fechaVenta: _repFechaTexto(fechaVenta, window.formatearFechaCortaMX ? window.formatearFechaCortaMX(fechaVenta) : fechaVenta.toLocaleDateString('es-MX')),
                fechaAbono: _repFechaTexto(fechaAbono, window.formatearFechaCortaMX ? window.formatearFechaCortaMX(fechaAbono) : fechaAbono.toLocaleDateString('es-MX')),
                fechaKey: fechaAbono.getTime(),
                monto: Number(abono.monto || abono.montoAbonado || 0),
                saldoAnterior,
                saldoPosterior,
                cuentaRecepcion: abono.etiquetaCuenta || abono.cuentaId || abono.medioPago || '-',
                tipoMovimiento: 'Abono a Crédito',
                estado,
                vendedor: cuenta.vendedorNombre || cuenta.vendedor || '-'
            });
        });
    });

    // 2. ENGANCHES DE CRÉDITO (registrados como movimiento de caja al momento de la venta)
    const movimientosCaja = StorageService.get('movimientosCaja', []) || [];
    movimientosCaja.forEach(mov => {
        if (mov.tipo !== 'ingreso') return;
        if (!/^Enganche credito/i.test(String(mov.concepto || ''))) return;

        const refMatch = String(mov.referencia || '').match(/^VENTA-(.+)$/);
        if (!refMatch) return;
        const folioVenta = refMatch[1];

        const cuenta = cuentasCxC.find(c => c.folio === folioVenta);
        if (!cuenta) return;

        const fechaEng = _repParseDate(mov.fecha);
        if (isNaN(fechaEng.getTime())) return;
        if (desdeD && fechaEng < desdeD) return;
        if (hastaD && fechaEng > hastaD) return;

        const estado = String(cuenta.estado || cuenta.estatus || 'Pendiente').toLowerCase();
        if (filtroEstatus && !estado.includes(filtroEstatus.toLowerCase())) return;

        const cuentaRecepcion = mov.etiquetaCuenta || mov.cuenta || mov.medioPago || '-';

        const pagares = StorageService.get('pagaresSistema', []) || [];
        const totalPagares = pagares
            .filter(p => p.folio === cuenta.folio && (p.estado === 'Pendiente' || p.estado === 'Parcial'))
            .reduce((s, p) => s + Math.max(0, (Number(p.monto || 0) - Number(p.montoAbonado || 0))), 0);

        const saldoAnterior = totalPagares + Number(mov.monto || 0);
        const saldoPosterior = Math.max(0, Number(cuenta.saldoActual || 0));

        const _cliEngCred = _repClienteVigente(cuenta.clienteId, cuenta.nombre || cuenta.clienteNombre || '-', cuenta.telefono);
        listado.push({
            tipo: 'enganche_credito',
            folio: cuenta.folio,
            articulos: cuenta.articulos || [],
            cliente: _cliEngCred.nombre,
            clienteId: _cliEngCred.id,
            fechaVenta: _repFechaTexto(_repParseDate(cuenta.fechaVenta || cuenta.fecha), window.formatearFechaCortaMX ? window.formatearFechaCortaMX(_repParseDate(cuenta.fechaVenta || cuenta.fecha)) : (_repParseDate(cuenta.fechaVenta || cuenta.fecha)).toLocaleDateString('es-MX')),
            fechaAbono: _repFechaTexto(fechaEng, window.formatearFechaCortaMX ? window.formatearFechaCortaMX(fechaEng) : fechaEng.toLocaleDateString('es-MX')),
            fechaKey: fechaEng.getTime(),
            monto: Number(mov.monto || 0),
            saldoAnterior,
            saldoPosterior,
            cuentaRecepcion,
            tipoMovimiento: 'Enganche Crédito',
            estado,
            vendedor: cuenta.vendedorNombre || cuenta.vendedor || '-'
        });
    });

    // 3. ENGANCHES Y ABONOS DE APARTADOS
    const apartados = StorageService.get('apartados', []);
    apartados.forEach(ap => {
        if (!ap.enganche || ap.enganche <= 0) return;

        const fechaAp = _repParseDate(ap.fechaApartado || ap.fecha);
        if (isNaN(fechaAp.getTime())) return;
        if (desdeD && fechaAp < desdeD) return;
        if (hastaD && fechaAp > hastaD) return;

        const estado = String(ap.estado || 'Pendiente').toLowerCase();
        if (filtroEstatus && !estado.includes(filtroEstatus.toLowerCase())) return;

        const saldoAnterior = Number(ap.importeApartado || ap.enganche || 0);
        const saldoPosterior = Number(ap.saldoPendiente || 0);

        const _cliEngApto = _repClienteVigente(ap.clienteId, ap.clienteNombre || '-', ap.telefono);
        listado.push({
            tipo: 'enganche_apartado',
            folio: ap.folio,
            articulos: ap.articulos || [],
            cliente: _cliEngApto.nombre,
            clienteId: _cliEngApto.id,
            fechaVenta: _repFechaTexto(fechaAp, window.formatearFechaCortaMX ? window.formatearFechaCortaMX(fechaAp) : fechaAp.toLocaleDateString('es-MX')),
            fechaAbono: _repFechaTexto(fechaAp, window.formatearFechaCortaMX ? window.formatearFechaCortaMX(fechaAp) : fechaAp.toLocaleDateString('es-MX')),
            fechaKey: fechaAp.getTime(),
            monto: Number(ap.enganche || 0),
            saldoAnterior,
            saldoPosterior,
            cuentaRecepcion: ap.etiquetaCuentaEnganche || ap.cuentaIdEnganche || '-',
            tipoMovimiento: 'Enganche Apartado',
            estado,
            vendedor: ap.vendedorNombre || ap.vendedor || '-'
        });

        // Abonos posteriores del apartado
        (ap.abonos || []).forEach(ab => {
            const fechaAbono = _repParseDate(ab.fechaAbonoIso || ab.fechaAbono || ab.fecha);
            if (isNaN(fechaAbono.getTime())) return;
            if (desdeD && fechaAbono < desdeD) return;
            if (hastaD && fechaAbono > hastaD) return;

            listado.push({
                tipo: 'abono_apartado',
                folio: ap.folio,
                articulos: ap.articulos || [],
                cliente: _cliEngApto.nombre,
                clienteId: _cliEngApto.id,
                fechaVenta: _repFechaTexto(fechaAp, window.formatearFechaCortaMX ? window.formatearFechaCortaMX(fechaAp) : fechaAp.toLocaleDateString('es-MX')),
                fechaAbono: _repFechaTexto(fechaAbono, window.formatearFechaCortaMX ? window.formatearFechaCortaMX(fechaAbono) : fechaAbono.toLocaleDateString('es-MX')),
                fechaKey: fechaAbono.getTime(),
                monto: Number(ab.monto || 0),
                saldoAnterior: Number(ap.saldoPendiente || 0) + Number(ab.monto || 0),
                saldoPosterior: Math.max(0, Number(ap.saldoPendiente || 0)),
                cuentaRecepcion: ab.etiquetaCuenta || ab.cuentaId || '-',
                tipoMovimiento: 'Abono Apartado',
                estado,
                vendedor: ap.vendedorNombre || ap.vendedor || '-'
            });
        });
    });

    // FILTRAR POR UBICACIÓN
    if (filtroUbicacion) {
        const filtroQ = filtroUbicacion.toLowerCase();
        const listadoFiltrado = listado.filter(m => m.cuentaRecepcion.toLowerCase().includes(filtroQ));
        listado.length = 0;
        listado.push(...listadoFiltrado);
    }

    // FILTRAR POR CLIENTE
    if (filtroClienteId) {
        const idQ = String(filtroClienteId);
        const listadoFiltrado = listado.filter(m => String(m.clienteId ?? '') === idQ);
        listado.length = 0;
        listado.push(...listadoFiltrado);
    }

    // FILTRAR POR TIPO DE MOVIMIENTO
    if (filtroTipo) {
        const tipoQ = filtroTipo.toLowerCase();
        const listadoFiltrado = listado.filter(m => m.tipoMovimiento.toLowerCase().includes(tipoQ));
        listado.length = 0;
        listado.push(...listadoFiltrado);
    }

    // ORDENAR
    if (ordenFlujo === 'asc') {
        listado.sort((a, b) => a.fechaKey - b.fechaKey);
    } else {
        listado.sort((a, b) => b.fechaKey - a.fechaKey);
    }

    return listado;
}

window.renderReporteAbonEnganches = function() {
    const cont = document.getElementById('contenidoReporteAbonEnganches') 
              || document.getElementById('reporte-abonos-enganches') 
              || document.getElementById('reportes') 
              || document.getElementById('dashboardContenido');
    if (!cont) return;

    const fmt = v => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v || 0);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[ch]));

    const esAdminActual = typeof window.esAdmin === 'function' ? window.esAdmin() : false;

    // FILTROS
    const filtroDesde = document.getElementById('abonDesde')?.value || '';
    const filtroHasta = document.getElementById('abonHasta')?.value || '';
    const filtroEstatus = document.getElementById('abonEstatus')?.value || '';
    const filtroTipo = document.getElementById('abonTipo')?.value || '';
    const filtroUbicacion = document.getElementById('abonUbicacion')?.value || '';
    const ordenFlujo = document.getElementById('abonOrden')?.value || 'desc';
    const clienteSel = window._abonClienteSeleccionado || null;
    const filtroClienteId = clienteSel?.id ?? '';

    // OBTENER LISTADO FILTRADO Y ORDENADO (función auxiliar)
    const listado = _obtenerListadoReporteAbonEnganches(filtroDesde, filtroHasta, filtroEstatus, filtroUbicacion, filtroTipo, ordenFlujo, filtroClienteId);

    // AGRUPAR POR UBICACIÓN (si aplica)
    const agrupado = new Map();
    listado.forEach(m => {
        const ub = m.cuentaRecepcion || 'Sin Ubicación';
        if (!agrupado.has(ub)) agrupado.set(ub, []);
        agrupado.get(ub).push(m);
    });

    // TOTALES
    const totalAbonos = listado.reduce((s, m) => s + m.monto, 0);
    const totalSaldoAnterior = listado.reduce((s, m) => s + m.saldoAnterior, 0);
    const totalSaldoPosterior = listado.reduce((s, m) => s + m.saldoPosterior, 0);

    // CONSTRUIR HTML
    let html = `
        <div style="background:linear-gradient(135deg,#059669,#047857); color:white; padding:22px; border-radius:14px; margin-bottom:20px; display:flex; align-items:center; gap:20px;">
            <img src="img/Logo.png" width="150" height="60" style="height:60px; width:150px; object-fit:contain;" alt="Logo">
            <div>
                <h2 style="margin:0; font-size:22px; font-weight:900;">💵 Reporte de Abonos y Enganches</h2>
                <p style="margin:5px 0 0; color:#d1fae5; font-size:13px;">Análisis de cobros en cobranza con saldos antes y después del movimiento.</p>
            </div>
        </div>

        <div style="background:white; border:1px solid #e2e8f0; padding:16px; border-radius:10px; margin-bottom:18px; display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:12px; align-items:end;">
            <div>
                <label style="font-size:11px; font-weight:800; color:#475569; display:block; margin-bottom:5px;">DESDE</label>
                <input type="date" id="abonDesde" value="${esc(filtroDesde)}" style="width:100%; padding:9px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;">
            </div>
            <div>
                <label style="font-size:11px; font-weight:800; color:#475569; display:block; margin-bottom:5px;">HASTA</label>
                <input type="date" id="abonHasta" value="${esc(filtroHasta)}" style="width:100%; padding:9px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;">
            </div>
            <div>
                <label style="font-size:11px; font-weight:800; color:#475569; display:block; margin-bottom:5px;">CLIENTE</label>
                <div style="display:flex; gap:6px;">
                    <input type="text" id="abonClienteNombre" readonly value="${esc(clienteSel?.nombre || '')}" placeholder="Todos" onclick="window._abonAbrirSelectorCliente()" style="flex:1; min-width:0; padding:9px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box; background:#f8fafc; cursor:pointer;">
                    ${clienteSel ? `<button onclick="window._abonLimpiarFiltroCliente()" title="Quitar filtro" style="padding:0 10px; background:#f1f5f9; color:#64748b; border:1px solid #cbd5e1; border-radius:6px; cursor:pointer; font-weight:bold;">✕</button>` : `<button onclick="window._abonAbrirSelectorCliente()" title="Buscar cliente" style="padding:0 10px; background:#0f172a; color:white; border:none; border-radius:6px; cursor:pointer;">🔍</button>`}
                </div>
            </div>
            <div>
                <label style="font-size:11px; font-weight:800; color:#475569; display:block; margin-bottom:5px;">ESTATUS</label>
                <select id="abonEstatus" style="width:100%; padding:9px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;">
                    <option value="">Todos</option>
                    <option value="pendiente" ${filtroEstatus === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                    <option value="saldado" ${filtroEstatus === 'saldado' ? 'selected' : ''}>Saldado</option>
                    <option value="activo" ${filtroEstatus === 'activo' ? 'selected' : ''}>Activo</option>
                </select>
            </div>
            <div>
                <label style="font-size:11px; font-weight:800; color:#475569; display:block; margin-bottom:5px;">TIPO DE MOVIMIENTO</label>
                <select id="abonTipo" style="width:100%; padding:9px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;">
                    <option value="">Todos</option>
                    <option value="Abono">Abonos</option>
                    <option value="Enganche">Enganches</option>
                    <option value="Crédito">Créditos</option>
                    <option value="Apartado">Apartados</option>
                </select>
            </div>
            <div>
                <label style="font-size:11px; font-weight:800; color:#475569; display:block; margin-bottom:5px;">UBICACIÓN RECEPCIÓN</label>
                <select id="abonUbicacion" style="width:100%; padding:9px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;">
                    <option value="">Todas</option>
                    ${[...agrupado.keys()].map(ub => `<option value="${ub}" ${filtroUbicacion === ub ? 'selected' : ''}>${esc(ub)}</option>`).join('')}
                </select>
            </div>
            <div>
                <label style="font-size:11px; font-weight:800; color:#475569; display:block; margin-bottom:5px;">ORDEN</label>
                <select id="abonOrden" style="width:100%; padding:9px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;">
                    <option value="desc" ${ordenFlujo === 'desc' ? 'selected' : ''}>Más reciente</option>
                    <option value="asc" ${ordenFlujo === 'asc' ? 'selected' : ''}>Más antiguo</option>
                </select>
            </div>
            <button onclick="renderReporteAbonEnganches()" style="padding:10px 18px; background:#059669; color:white; border:none; border-radius:7px; cursor:pointer; font-weight:bold;">Filtrar</button>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:15px; margin-bottom:20px;">
            ${esAdminActual ? `
            <div style="background:#ecfdf5; border:1px solid #86efac; padding:18px; border-radius:10px;">
                <div style="font-size:11px; font-weight:bold; color:#047857;">TOTAL MOVIMIENTOS</div>
                <div style="font-size:28px; font-weight:900; color:#047857; margin-top:5px;">${listado.length}</div>
            </div>
            <div style="background:#f0fdf4; border:1px solid #bbf7d0; padding:18px; border-radius:10px;">
                <div style="font-size:11px; font-weight:bold; color:#059669;">TOTAL COBRADO</div>
                <div style="font-size:28px; font-weight:900; color:#059669; margin-top:5px;">${fmt(totalAbonos)}</div>
            </div>
            <div style="background:#f5f3ff; border:1px solid #d8b4fe; padding:18px; border-radius:10px; print-display:none;" class="no-print-kpi">
                <div style="font-size:11px; font-weight:bold; color:#7c3aed;">SALDO TOTAL PENDIENTE</div>
                <div style="font-size:28px; font-weight:900; color:#7c3aed; margin-top:5px;">${fmt(totalSaldoPosterior)}</div>
            </div>` : ''}
        </div>
        <style>
            @media print {
                .no-print-kpi { display: none !important; }
                .col-fecha-venta { display: none !important; }
                .col-saldo-anterior { display: none !important; }
                .col-saldo-pendiente { display: none !important; }
                th.header-fecha-venta { display: none !important; }
                th.header-saldo-anterior { display: none !important; }
                th.header-saldo-pendiente { display: none !important; }
            }
        </style>

        <div style="display:flex; gap:12px; margin-bottom:20px; flex-wrap:wrap; align-items:center;">
            ${esAdminActual ? `<button onclick="exportarReporteAbonEnganches()" style="padding:12px 20px; background:#3b82f6; color:white; border:none; border-radius:7px; cursor:pointer; font-weight:bold; font-size:13px;">📥 Descargar CSV</button>
            <button onclick="generarDocumentoReporteAbonEnganches()" style="padding:12px 20px; background:#8b5cf6; color:white; border:none; border-radius:7px; cursor:pointer; font-weight:bold; font-size:13px;">📄 Generar PDF/Imagen</button>` : ''}
        </div>
    `;

    // TABLAS POR UBICACIÓN
    if (agrupado.size === 0) {
        html += `<div style="padding:40px; text-align:center; color:#94a3b8; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:10px;">Sin movimientos en el rango seleccionado.</div>`;
    } else {
        agrupado.forEach((movimientos, ubicacion) => {
            const tablaFilas = movimientos.map(m => {
                const icon = m.tipoMovimiento.includes('Enganche') ? '💰' : '✅';
                const badgeColor = m.tipoMovimiento.includes('Enganche') ? '#fce7f3' : '#dbeafe';
                const badgeTextColor = m.tipoMovimiento.includes('Enganche') ? '#831843' : '#1e40af';
                return `
                    <tr style="border-bottom:1px solid #e2e8f0;">
                        <td style="padding:8px 6px; vertical-align:top; width:18%; max-width:120px; font-size:12px; word-break:break-word;\">${window.resumenProductosVenta ? window.resumenProductosVenta(m.articulos) : `<strong>${esc(m.folio)}</strong>`}<br><span style="background:${badgeColor}; color:${badgeTextColor}; padding:1px 4px; border-radius:3px; font-size:9px; font-weight:bold; display:inline-block; margin-top:2px;\">${esc(m.tipoMovimiento)}</span></td>
                        <td style="padding:12px; vertical-align:top;\"><strong>${esc(m.cliente)}</strong><br><small style="color:#64748b;">${esc(m.vendedor)}</small></td>
                        <td class="col-fecha-venta" style="padding:8px 6px; vertical-align:top; font-size:11px; display:table-cell;">${m.fechaVenta}</td>
                        <td style="padding:8px 6px; vertical-align:top; font-size:11px;"><strong>${m.fechaAbono}</strong></td>
                        <td class="col-saldo-anterior" style="padding:8px 6px; vertical-align:top; text-align:right; font-weight:bold; color:#2563eb; display:${esAdminActual ? 'table-cell' : 'none'}; font-size:11px;">${fmt(m.saldoAnterior)}</td>
                        ${esAdminActual ? `<td style="padding:8px 6px; vertical-align:top; text-align:right; font-weight:bold; color:#16a34a; font-size:11px;">${fmt(m.monto)}</td>` : ''}
                        <td class="col-saldo-pendiente" style="padding:8px 6px; vertical-align:top; text-align:right; font-weight:bold; color:#7c3aed; display:${esAdminActual ? 'table-cell' : 'none'}; font-size:11px;">${fmt(m.saldoPosterior)}</td>
                        <td style="padding:8px 6px; vertical-align:top; text-align:center;">${icon}</td>
                    </tr>`;
            }).join('');

            const subtotalAbonos = movimientos.reduce((s, m) => s + m.monto, 0);
            const subtotalSaldoPosterior = movimientos.reduce((s, m) => s + m.saldoPosterior, 0);

            html += `
                <div style="background:white; border:1px solid #e2e8f0; border-radius:10px; padding:18px; margin-bottom:20px;">
                    <h3 style="margin:0 0 12px; color:#1e40af; font-size:16px;">📍 ${esc(ubicacion)}</h3>
                    <div style="overflow-x:auto;">
                        <table style="width:100%; border-collapse:collapse; min-width:900px; font-size:13px;">
                            <thead>
                                <tr style="background:#f8fafc; border-bottom:2px solid #cbd5e1;">
                                    <th style="padding:8px 6px; text-align:left; width:18%; max-width:120px; font-size:12px;">Producto / Tipo</th>
                                    <th style="padding:8px 6px; text-align:left;">Cliente / Vendedor</th>
                                    <th class="header-fecha-venta" style="padding:8px 6px; text-align:center; display:table-cell; font-size:12px;">Fecha Venta</th>
                                    <th style="padding:8px 6px; text-align:center; font-size:12px;">Fecha</th>
                                    <th class="header-saldo-anterior" style="padding:8px 6px; text-align:right; display:${esAdminActual ? 'table-cell' : 'none'}; font-size:12px;">Saldo Anterior</th>
                                    ${esAdminActual ? `<th style="padding:8px 6px; text-align:right; font-size:12px;">Monto Cobrado</th>` : ''}
                                    <th class="header-saldo-pendiente" style="padding:8px 6px; text-align:right; display:${esAdminActual ? 'table-cell' : 'none'}; font-size:12px;">Saldo Pendiente</th>
                                    <th style="padding:8px 6px; text-align:center; font-size:12px;">Estado</th>
                                </tr>
                            </thead>
                            <tbody style="font-size:12px;">${tablaFilas}</tbody>
                            <tfoot>
                                <tr style="background:#f0fdf4; border-top:2px solid #cbd5e1; font-weight:bold;">
                                    <td colspan="${esAdminActual ? 5 : 4}" style="padding:12px; text-align:right;">SUBTOTAL ${esc(ubicacion)}:</td>
                                    ${esAdminActual ? `<td style="padding:12px; text-align:right; color:#16a34a;">${fmt(subtotalAbonos)}</td>
                                    <td style="padding:12px; text-align:right; color:#7c3aed;">${fmt(subtotalSaldoPosterior)}</td>` : ''}
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>`;
        });
    }

    cont.innerHTML = html;
    const forzarScrollArriba = () => {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        const appCont = document.getElementById('app-container');
        if (appCont) appCont.scrollTop = 0;
    };
    forzarScrollArriba();
    requestAnimationFrame(forzarScrollArriba);
    setTimeout(forzarScrollArriba, 50);
    setTimeout(forzarScrollArriba, 300);
    const logoImg = cont.querySelector('img[src*="Logo"]');
    if (logoImg && !logoImg.complete) logoImg.addEventListener('load', forzarScrollArriba, { once: true });
};

// Selector universal de cliente para el filtro del reporte (usa la tabla "clientes" vigente)
window._abonAbrirSelectorCliente = function() {
    if (typeof window.abrirSelectorCliente !== 'function') {
        alert('El selector de clientes aún no está disponible.');
        return;
    }
    window.abrirSelectorCliente({
        titulo: '👤 Filtrar por Cliente',
        onSeleccion: function(c) {
            window._abonClienteSeleccionado = c;
            if (typeof window.renderReporteAbonEnganches === 'function') window.renderReporteAbonEnganches();
        }
    });
};

window._abonLimpiarFiltroCliente = function() {
    window._abonClienteSeleccionado = null;
    if (typeof window.renderReporteAbonEnganches === 'function') window.renderReporteAbonEnganches();
};

window.exportarReporteAbonEnganches = function() {
    // 🛡️ El botón ya está oculto para no-admin, pero esto es invocable
    // directo desde la consola — el candado real va aquí, no solo en la UI.
    if (typeof window.esAdmin === 'function' && !window.esAdmin()) {
        alert('No autorizado.');
        return;
    }
    const filtroDesde = document.getElementById('abonDesde')?.value || '';
    const filtroHasta = document.getElementById('abonHasta')?.value || '';
    const filtroClienteId = window._abonClienteSeleccionado?.id ?? '';

    // Recopilar datos igual que renderReporteAbonEnganches
    const listado = [];
    const desdeD = filtroDesde ? new Date(filtroDesde + 'T00:00:00') : null;
    const hastaD = filtroHasta ? new Date(filtroHasta + 'T23:59:59') : null;

    const cuentasCxC = StorageService.get('cuentasPorCobrar', []);
    cuentasCxC.forEach(cuenta => {
        const _cliCsv = _repClienteVigente(cuenta.clienteId, cuenta.nombre || cuenta.clienteNombre || '-', cuenta.telefono);
        if (filtroClienteId && String(_cliCsv.id ?? '') !== String(filtroClienteId)) return;
        (cuenta.abonos || []).forEach((abono, indexAbono) => {
            const fechaAbono = _repParseDate(abono.fechaAbonoIso || abono.fecha);
            if (desdeD && fechaAbono < desdeD) return;
            if (hastaD && fechaAbono > hastaD) return;
            
            const pagares = StorageService.get('pagaresSistema', []) || [];
            const totalPagares = pagares
                .filter(p => p.folio === cuenta.folio && (p.estado === 'Pendiente' || p.estado === 'Parcial'))
                .reduce((s, p) => s + Math.max(0, (Number(p.monto || 0) - Number(p.montoAbonado || 0))), 0);

            listado.push({
                Folio: cuenta.folio,
                Cliente: _cliCsv.nombre,
                Tipo: 'Abono Crédito',
                'Fecha Venta': cuenta.fechaVenta || cuenta.fecha,
                'Fecha Abono': abono.fechaAbonoIso || abono.fecha,
                'Saldo Anterior': totalPagares + Number(abono.monto || abono.montoAbonado || 0),
                'Monto Cobrado': abono.monto || abono.montoAbonado,
                'Saldo Posterior': cuenta.saldoActual,
                'Ubicación Recepción': abono.etiquetaCuenta || abono.cuentaId || '-',
                Vendedor: cuenta.vendedorNombre || '-'
            });
        });
    });

    const apartados = StorageService.get('apartados', []);
    apartados.forEach(ap => {
        const _cliCsvApto = _repClienteVigente(ap.clienteId, ap.clienteNombre || '-', ap.telefono);
        if (filtroClienteId && String(_cliCsvApto.id ?? '') !== String(filtroClienteId)) return;
        if (ap.enganche > 0) {
            const fechaAp = ap.fechaApartado || ap.fecha;
            if (desdeD && _repParseDate(fechaAp) < desdeD) return;
            if (hastaD && _repParseDate(fechaAp) > hastaD) return;

            listado.push({
                Folio: ap.folio,
                Cliente: _cliCsvApto.nombre,
                Tipo: 'Enganche Apartado',
                'Fecha Venta': fechaAp,
                'Fecha Abono': fechaAp,
                'Saldo Anterior': ap.importeApartado || ap.enganche,
                'Monto Cobrado': ap.enganche,
                'Saldo Posterior': ap.saldoPendiente,
                'Ubicación Recepción': ap.etiquetaCuentaEnganche || ap.cuentaIdEnganche || '-',
                Vendedor: ap.vendedorNombre || '-'
            });
        }
    });

    let csv = "Folio,Cliente,Tipo,Fecha Venta,Fecha Abono,Saldo Anterior,Monto Cobrado,Saldo Posterior,Ubicación Recepción,Vendedor\n";
    listado.forEach(m => {
        csv += `"${m.Folio}","${m.Cliente}","${m.Tipo}","${m['Fecha Venta']}","${m['Fecha Abono']}",${m['Saldo Anterior']},${m['Monto Cobrado']},${m['Saldo Posterior']},"${m['Ubicación Recepción']}","${m.Vendedor}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `reporte_abonos_enganches_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// ========================================================================
// 📄 GENERAR DOCUMENTO (PDF, IMAGEN, TICKET) DEL REPORTE FILTRADO
// ========================================================================

window.generarDocumentoReporteAbonEnganches = function() {
    // 🛡️ Mismo candado que exportarReporteAbonEnganches: el botón ya está
    // oculto para no-admin, pero esta función es global y se puede llamar
    // directo desde la consola.
    if (typeof window.esAdmin === 'function' && !window.esAdmin()) {
        alert('No autorizado.');
        return;
    }
    const fmt = v => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v || 0);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[ch]));

    // LEER FILTROS
    const filtroDesde = document.getElementById('abonDesde')?.value || '';
    const filtroHasta = document.getElementById('abonHasta')?.value || '';
    const filtroEstatus = document.getElementById('abonEstatus')?.value || '';
    const filtroTipo = document.getElementById('abonTipo')?.value || '';
    const filtroUbicacion = document.getElementById('abonUbicacion')?.value || '';
    const ordenFlujo = document.getElementById('abonOrden')?.value || 'desc';
    const clienteSel = window._abonClienteSeleccionado || null;
    const filtroClienteId = clienteSel?.id ?? '';

    // OBTENER LISTADO FILTRADO Y ORDENADO (función auxiliar con propiedades lowercase)
    let listado = _obtenerListadoReporteAbonEnganches(filtroDesde, filtroHasta, filtroEstatus, filtroUbicacion, filtroTipo, ordenFlujo, filtroClienteId);

    // TRANSFORMAR AL FORMATO DE VISUALIZACIÓN PARA DOCUMENTOS
    listado = listado.map(m => {
        const articulos = Array.isArray(m.articulos) ? m.articulos.filter(a => a && a.nombre) : [];
        const producto = articulos.length
            ? articulos.map(a => Number(a.cantidad || 1) > 1 ? `${a.nombre} x${a.cantidad}` : a.nombre).join(', ')
            : 'Sin detalle';
        return {
            Folio: m.folio,
            Producto: producto,
            Cliente: m.cliente,
            Tipo: m.tipoMovimiento === 'Abono a Crédito' ? 'Abono Crédito' :
                  m.tipoMovimiento === 'Enganche Crédito' ? 'Enganche Crédito' :
                  m.tipoMovimiento === 'Enganche Apartado' ? 'Enganche Apartado' : 'Abono Apartado',
            'Fecha Venta': m.fechaVenta,
            'Fecha Abono': m.fechaAbono,
            'Saldo Anterior': m.saldoAnterior,
            'Monto Cobrado': m.monto,
            'Saldo Posterior': m.saldoPosterior,
            'Ubicación Recepción': m.cuentaRecepcion,
            Vendedor: m.vendedor,
            fechaKey: m.fechaKey
        };
    });

    // VALIDAR QUE HAYA DATOS CON LOS FILTROS APLICADOS
    if (listado.length === 0) {
        alert('No hay datos para generar el documento con los filtros aplicados.');
        return;
    }

    // AGRUPAR POR UBICACIÓN
    const porUbicacion = {};
    let totalMovimientos = 0;
    let totalCobrado = 0;

    listado.forEach(m => {
        const ub = m['Ubicación Recepción'];
        if (!porUbicacion[ub]) porUbicacion[ub] = { items: [], subtotalCobrado: 0 };
        porUbicacion[ub].items.push(m);
        porUbicacion[ub].subtotalCobrado += Number(m['Monto Cobrado'] || 0);

        totalMovimientos++;
        totalCobrado += Number(m['Monto Cobrado'] || 0);
    });

    // 📱 GENERAR HTML PARA DOCUMENTO — diseño de una sola columna (tarjetas), pensado
    // para leerse en tablet/celular. Ya no es una tabla ancha de 8 columnas forzada
    // a hoja carta (eso terminaba viéndose como una captura de pantalla ilegible).
    const badgeColor = tipo => tipo === 'Enganche Apartado' ? { bg: '#fce7f3', fg: '#831843' } : { bg: '#e0e7ff', fg: '#1e3a8a' };

    let html = `
    <div style="max-width: 640px; margin: 0 auto; font-family: Arial, sans-serif; color: #0f172a; background: #f8fafc; padding: 18px;">
        <div style="background: linear-gradient(135deg, #059669, #047857); color: white; padding: 20px; border-radius: 14px; margin-bottom: 18px; display: flex; align-items: center; gap: 16px;">
            <img src="img/Logo.png" style="height: 50px; width: auto; object-fit: contain;" alt="Logo">
            <div>
                <h1 style="margin: 0; font-size: 19px; font-weight: 900;">📊 Reporte de Abonos y Enganches</h1>
                <p style="margin: 4px 0 0; color: #d1fae5; font-size: 12px;">${new Date().toLocaleDateString('es-MX')} ${new Date().toLocaleTimeString('es-MX')}</p>
            </div>
        </div>

        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; margin-bottom: 16px; font-size: 13px; color: #475569;">
            <strong style="color: #334155;">Filtros:</strong>
            ${filtroDesde || filtroHasta ? `${filtroDesde || 'inicio'} → ${filtroHasta || 'hoy'}` : 'Sin rango de fechas'}
            ${filtroEstatus ? ` · Estatus: ${esc(filtroEstatus)}` : ''}
            ${clienteSel ? ` · Cliente: ${esc(clienteSel.nombre)}` : ''}
            ${filtroUbicacion ? ` · Ubicación: ${esc(filtroUbicacion)}` : ''}
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 18px;">
            <div style="background: #dbeafe; padding: 14px; border-radius: 12px; border-left: 5px solid #1e40af;">
                <div style="font-size: 11px; color: #0c4a6e; font-weight: bold; text-transform: uppercase;">Movimientos</div>
                <div style="font-size: 24px; color: #1e40af; font-weight: 900; margin-top: 4px;">${totalMovimientos}</div>
            </div>
            <div style="background: #d1fae5; padding: 14px; border-radius: 12px; border-left: 5px solid #047857;">
                <div style="font-size: 11px; color: #065f46; font-weight: bold; text-transform: uppercase;">Total Cobrado</div>
                <div style="font-size: 19px; color: #047857; font-weight: 900; margin-top: 4px;">${fmt(totalCobrado)}</div>
            </div>
        </div>
    `;

    // TARJETAS POR UBICACIÓN
    Object.keys(porUbicacion).forEach(ubicacion => {
        const grupo = porUbicacion[ubicacion];
        html += `
            <div style="margin-bottom: 18px;">
                <div style="background: #0284c7; color: white; padding: 10px 14px; border-radius: 10px 10px 0 0; font-size: 14px; font-weight: 800;">
                    📍 ${esc(ubicacion)}
                </div>
                <div style="background: white; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px; padding: 10px;">
        `;

        grupo.items.forEach(item => {
            const bc = badgeColor(item.Tipo);
            html += `
                    <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; margin-bottom: 8px; page-break-inside: avoid;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-size: 14px; font-weight: 800; color: #0f172a; line-height: 1.3;">${esc(item.Producto)}</div>
                                <span style="display: inline-block; margin-top: 5px; background: ${bc.bg}; color: ${bc.fg}; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold;">${esc(item.Tipo)}</span>
                            </div>
                            <div style="text-align: right; white-space: nowrap;">
                                <div style="font-size: 11px; color: #64748b;">${esc(item['Fecha Abono'])}</div>
                                <div style="font-size: 16px; font-weight: 900; color: #047857; margin-top: 2px;">${fmt(item['Monto Cobrado'])}</div>
                            </div>
                        </div>
                        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #e2e8f0; font-size: 12px; color: #334155;">
                            👤 <strong>${esc(item.Cliente)}</strong>
                            <span style="color: #94a3b8;"> · Folio ${esc(item.Folio)} · Vendedor: ${esc(item.Vendedor)}</span>
                        </div>
                    </div>
            `;
        });

        html += `
                    <div style="text-align: right; padding: 8px 6px 4px; font-size: 13px; font-weight: 800; color: #0c4a6e;">
                        Subtotal ${esc(ubicacion)}: <span style="color: #047857;">${fmt(grupo.subtotalCobrado)}</span>
                    </div>
                </div>
            </div>
        `;
    });

    html += `
        <div style="text-align: center; padding-top: 8px; font-size: 11px; color: #94a3b8;">
            Sistema MMP · Mueblería Mi Pueblito · ${new Date().getFullYear()}
        </div>
    </div>
    `;

    // USAR TICKETSERVICE PARA GENERAR DOCUMENTO
    if (window.TicketService && window.TicketService.elegirFormato) {
        window.TicketService.elegirFormato({
            html: html,
            title: 'Reporte de Abonos y Enganches',
            filename: `reporte_abonos_enganches_${new Date().toISOString().split('T')[0]}`,
            pageSize: 'letter'
        });
    } else {
        alert('El servicio de documentos no está disponible. Intenta recargar la página.');
    }
};
