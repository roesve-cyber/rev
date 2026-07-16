// ========================================================================
// 📊 REPORTE DE ABONOS Y ENGANCHES PARA COBRANZA
// Filtra por: estatus de cuenta, fecha de venta, ubicación de recepción
// Muestra: saldo anterior, saldo pendiente después del abono
// Ordena: más reciente a más antiguo
// ========================================================================

// FUNCIÓN AUXILIAR: Obtiene el listado completo filtrado y ordenado (una sola fuente de verdad)
function _obtenerListadoReporteAbonEnganches(filtroDesde, filtroHasta, filtroEstatus, filtroUbicacion, filtroTipo, ordenFlujo) {
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

            listado.push({
                tipo: 'abono_credito',
                folio: cuenta.folio,
                cliente: cuenta.nombre || cuenta.clienteNombre || '-',
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

        listado.push({
            tipo: 'enganche_credito',
            folio: cuenta.folio,
            cliente: cuenta.nombre || cuenta.clienteNombre || '-',
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

        listado.push({
            tipo: 'enganche_apartado',
            folio: ap.folio,
            cliente: ap.clienteNombre || '-',
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
                cliente: ap.clienteNombre || '-',
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

    // FILTROS
    const filtroDesde = document.getElementById('abonDesde')?.value || '';
    const filtroHasta = document.getElementById('abonHasta')?.value || '';
    const filtroEstatus = document.getElementById('abonEstatus')?.value || '';
    const filtroTipo = document.getElementById('abonTipo')?.value || '';
    const filtroUbicacion = document.getElementById('abonUbicacion')?.value || '';
    const ordenFlujo = document.getElementById('abonOrden')?.value || 'desc';

    // OBTENER LISTADO FILTRADO Y ORDENADO (función auxiliar)
    const listado = _obtenerListadoReporteAbonEnganches(filtroDesde, filtroHasta, filtroEstatus, filtroUbicacion, filtroTipo, ordenFlujo);

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
            </div>
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
            <button onclick="exportarReporteAbonEnganches()" style="padding:12px 20px; background:#3b82f6; color:white; border:none; border-radius:7px; cursor:pointer; font-weight:bold; font-size:13px;">📥 Descargar CSV</button>
            <button onclick="generarDocumentoReporteAbonEnganches()" style="padding:12px 20px; background:#8b5cf6; color:white; border:none; border-radius:7px; cursor:pointer; font-weight:bold; font-size:13px;">📄 Generar PDF/Imagen</button>
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
                        <td style="padding:8px 6px; vertical-align:top; width:18%; max-width:120px; font-size:12px; word-break:break-word;\"><strong>${esc(m.folio)}</strong><br><span style="background:${badgeColor}; color:${badgeTextColor}; padding:1px 4px; border-radius:3px; font-size:9px; font-weight:bold; display:inline-block; margin-top:2px;\">${esc(m.tipoMovimiento)}</span></td>
                        <td style="padding:12px; vertical-align:top;\"><strong>${esc(m.cliente)}</strong><br><small style="color:#64748b;">${esc(m.vendedor)}</small></td>
                        <td class="col-fecha-venta" style="padding:8px 6px; vertical-align:top; font-size:11px; display:table-cell;">${m.fechaVenta}</td>
                        <td style="padding:8px 6px; vertical-align:top; font-size:11px;"><strong>${m.fechaAbono}</strong></td>
                        <td class="col-saldo-anterior" style="padding:8px 6px; vertical-align:top; text-align:right; font-weight:bold; color:#2563eb; display:table-cell; font-size:11px;">${fmt(m.saldoAnterior)}</td>
                        <td style="padding:8px 6px; vertical-align:top; text-align:right; font-weight:bold; color:#16a34a; font-size:11px;">${fmt(m.monto)}</td>
                        <td class="col-saldo-pendiente" style="padding:8px 6px; vertical-align:top; text-align:right; font-weight:bold; color:#7c3aed; display:table-cell; font-size:11px;">${fmt(m.saldoPosterior)}</td>
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
                                    <th style="padding:8px 6px; text-align:left; width:18%; max-width:120px; font-size:12px;">Folio / Tipo</th>
                                    <th style="padding:8px 6px; text-align:left;">Cliente / Vendedor</th>
                                    <th class="header-fecha-venta" style="padding:8px 6px; text-align:center; display:table-cell; font-size:12px;">Fecha Venta</th>
                                    <th style="padding:8px 6px; text-align:center; font-size:12px;">Fecha</th>
                                    <th class="header-saldo-anterior" style="padding:8px 6px; text-align:right; display:table-cell; font-size:12px;">Saldo Anterior</th>
                                    <th style="padding:8px 6px; text-align:right; font-size:12px;">Monto Cobrado</th>
                                    <th class="header-saldo-pendiente" style="padding:8px 6px; text-align:right; display:table-cell; font-size:12px;">Saldo Pendiente</th>
                                    <th style="padding:8px 6px; text-align:center; font-size:12px;">Estado</th>
                                </tr>
                            </thead>
                            <tbody style="font-size:12px;">${tablaFilas}</tbody>
                            <tfoot>
                                <tr style="background:#f0fdf4; border-top:2px solid #cbd5e1; font-weight:bold;">
                                    <td colspan="5" style="padding:12px; text-align:right;">SUBTOTAL ${esc(ubicacion)}:</td>
                                    <td style="padding:12px; text-align:right; color:#16a34a;">${fmt(subtotalAbonos)}</td>
                                    <td style="padding:12px; text-align:right; color:#7c3aed;">${fmt(subtotalSaldoPosterior)}</td>
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

window.exportarReporteAbonEnganches = function() {
    const filtroDesde = document.getElementById('abonDesde')?.value || '';
    const filtroHasta = document.getElementById('abonHasta')?.value || '';

    // Recopilar datos igual que renderReporteAbonEnganches
    const listado = [];
    const desdeD = filtroDesde ? new Date(filtroDesde + 'T00:00:00') : null;
    const hastaD = filtroHasta ? new Date(filtroHasta + 'T23:59:59') : null;

    const cuentasCxC = StorageService.get('cuentasPorCobrar', []);
    cuentasCxC.forEach(cuenta => {
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
                Cliente: cuenta.nombre || cuenta.clienteNombre,
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
        if (ap.enganche > 0) {
            const fechaAp = ap.fechaApartado || ap.fecha;
            if (desdeD && _repParseDate(fechaAp) < desdeD) return;
            if (hastaD && _repParseDate(fechaAp) > hastaD) return;

            listado.push({
                Folio: ap.folio,
                Cliente: ap.clienteNombre,
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

    // OBTENER LISTADO FILTRADO Y ORDENADO (función auxiliar con propiedades lowercase)
    let listado = _obtenerListadoReporteAbonEnganches(filtroDesde, filtroHasta, filtroEstatus, filtroUbicacion, filtroTipo, ordenFlujo);

    // TRANSFORMAR AL FORMATO DE VISUALIZACIÓN PARA DOCUMENTOS
    listado = listado.map(m => ({
        Folio: m.folio,
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
    }));

    // VALIDAR QUE HAYA DATOS CON LOS FILTROS APLICADOS
    if (listado.length === 0) {
        alert('No hay datos para generar el documento con los filtros aplicados.');
        return;
    }

    // AGRUPAR POR UBICACIÓN
    const porUbicacion = {};
    let totalMovimientos = 0;
    let totalCobrado = 0;
    let totalPendiente = 0;

    listado.forEach(m => {
        const ub = m['Ubicación Recepción'];
        if (!porUbicacion[ub]) porUbicacion[ub] = { items: [], subtotalCobrado: 0, subtotalPendiente: 0 };
        porUbicacion[ub].items.push(m);
        porUbicacion[ub].subtotalCobrado += Number(m['Monto Cobrado'] || 0);
        porUbicacion[ub].subtotalPendiente += Number(m['Saldo Posterior'] || 0);
        
        totalMovimientos++;
        totalCobrado += Number(m['Monto Cobrado'] || 0);
        totalPendiente += Number(m['Saldo Posterior'] || 0);
    });

    // GENERAR HTML PARA DOCUMENTO
    let html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; padding: 0;">
        <div style="background: linear-gradient(135deg, #059669, #047857); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; display: flex; align-items: center; gap: 20px;">
            <img src="img/Logo.png" style="height: 60px; width: auto; object-fit: contain;" alt="Logo">
            <div>
                <h1 style="margin: 0; font-size: 22px; font-weight: 900;">📊 Reporte de Abonos y Enganches</h1>
                <p style="margin: 5px 0 0; color: #d1fae5; font-size: 12px;">Análisis de cobros en cobranza con saldos antes y después del movimiento.</p>
            </div>
        </div>

        <p style="text-align: center; margin: 0 0 20px; font-size: 11px; color: #64748b;">
            Reporte generado: ${new Date().toLocaleDateString('es-MX')} ${new Date().toLocaleTimeString('es-MX')}
        </p>

        <div style="background: #f1f5f9; padding: 12px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #1e40af;">
            <h3 style="margin: 0 0 10px; font-size: 13px; color: #334155;">Filtros Aplicados</h3>
            <table style="font-size: 12px; width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 4px 8px;"><strong>Fecha desde:</strong> ${filtroDesde || 'Sin límite'}</td>
                    <td style="padding: 4px 8px;"><strong>Fecha hasta:</strong> ${filtroHasta || 'Sin límite'}</td>
                </tr>
                <tr>
                    <td style="padding: 4px 8px;"><strong>Estatus:</strong> ${filtroEstatus || 'Todos'}</td>
                    <td style="padding: 4px 8px;"><strong>Ubicación:</strong> ${filtroUbicacion || 'Todas'}</td>
                </tr>
            </table>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;">
            <div style="background: #dbeafe; padding: 12px; border-radius: 6px; border-left: 4px solid #1e40af;">
                <div style="font-size: 11px; color: #0c4a6e; font-weight: bold;">Total Movimientos</div>
                <div style="font-size: 20px; color: #1e40af; font-weight: bold; margin-top: 4px;">${totalMovimientos}</div>
            </div>
            <div style="background: #d1fae5; padding: 12px; border-radius: 6px; border-left: 4px solid #047857;">
                <div style="font-size: 11px; color: #065f46; font-weight: bold;">Total Cobrado</div>
                <div style="font-size: 16px; color: #047857; font-weight: bold; margin-top: 4px;">${fmt(totalCobrado)}</div>
            </div>
        </div>
        <style>
            @media print { .doc-saldo-pendiente { display: none !important; } }
        </style>

        <div style="border-top: 2px solid #e2e8f0; padding-top: 15px;">
    `;

    // TABLAS POR UBICACIÓN
    Object.keys(porUbicacion).forEach(ubicacion => {
        const grupo = porUbicacion[ubicacion];
        html += `
            <div style="margin-bottom: 20px; page-break-inside: avoid;">
                <h3 style="background: #f0f9ff; padding: 10px 12px; margin: 0 0 10px; font-size: 14px; color: #0c4a6e; border-left: 4px solid #0284c7;">
                    📍 ${esc(ubicacion)}
                </h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 10px;">
                    <thead>
                        <tr style="background: #e0e7ff; border-bottom: 2px solid #1e40af;">
                            <th style="padding: 8px; text-align: left; color: #1e40af; font-weight: bold;">Folio</th>
                            <th style="padding: 8px; text-align: left; color: #1e40af; font-weight: bold;">Cliente</th>
                            <th style="padding: 8px; text-align: center; color: #1e40af; font-weight: bold;">Tipo</th>
                            <th class="doc-col-fecha-venta" style="padding: 8px; text-align: center; color: #1e40af; font-weight: bold; display: none;">F. Venta</th>
                            <th style="padding: 8px; text-align: center; color: #1e40af; font-weight: bold;">Fecha</th>
                            <th class="doc-col-saldo-anterior" style="padding: 8px; text-align: right; color: #1e40af; font-weight: bold; display: none;">Saldo Anterior</th>
                            <th style="padding: 8px; text-align: right; color: #1e40af; font-weight: bold;">Cobrado</th>
                            <th class="doc-col-saldo-posterior" style="padding: 8px; text-align: right; color: #1e40af; font-weight: bold; display: none;">Saldo Posterior</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        grupo.items.forEach((item, idx) => {
            const bgColor = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
            html += `
                        <tr style="background: ${bgColor}; border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 6px 8px; color: #1e40af; font-weight: bold;">${esc(item.Folio)}</td>
                            <td style="padding: 6px 8px;">${esc(item.Cliente)}</td>
                            <td style="padding: 6px 8px; text-align: center; font-size: 10px; color: #64748b;">
                                <span style="background: ${item.Tipo === 'Enganche Apartado' ? '#fce7f3' : '#e0e7ff'}; padding: 2px 6px; border-radius: 3px; color: ${item.Tipo === 'Enganche Apartado' ? '#831843' : '#1e3a8a'};">
                                    ${esc(item.Tipo.substring(0, 3))}
                                </span>
                            </td>
                            <td class="doc-col-fecha-venta" style="padding: 6px 8px; text-align: center; font-size: 10px; display: none;">${esc(item['Fecha Venta'])}</td>
                            <td style="padding: 6px 8px; text-align: center; font-size: 10px;">${esc(item['Fecha Abono'])}</td>
                            <td class="doc-col-saldo-anterior" style="padding: 6px 8px; text-align: right; font-weight: bold; color: #0f172a; display: none;">${fmt(item['Saldo Anterior'])}</td>
                            <td style="padding: 6px 8px; text-align: right; font-weight: bold; color: #047857;">${fmt(item['Monto Cobrado'])}</td>
                            <td class="doc-col-saldo-posterior" style="padding: 6px 8px; text-align: right; font-weight: bold; color: #dc2626; display: none;">${fmt(item['Saldo Posterior'])}</td>
                        </tr>
            `;
        });

        html += `
                    </tbody>
                    <tfoot>
                        <tr style="background: #f0f9ff; border-top: 2px solid #0284c7; border-bottom: 2px solid #0284c7; font-weight: bold;">
                            <td colspan="4" style="padding: 8px; text-align: right; color: #0c4a6e;">Subtotal ${esc(ubicacion)}:</td>
                            <td style="padding: 8px; text-align: right; color: #047857; background: #d1fae5;">${fmt(grupo.subtotalCobrado)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    });

    html += `
        </div>
        <div style="border-top: 2px solid #0f172a; padding-top: 12px; margin-top: 20px; font-size: 11px; color: #64748b; text-align: center;">
            <p style="margin: 0;">Sistema MMP | ${new Date().getFullYear()}</p>
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
