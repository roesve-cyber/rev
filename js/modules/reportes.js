// ===== REPORTES =====

// --- Helpers compartidos ---

function _kpiCard(titulo, valor, color, icono) {
    return `<div style="background:white; padding:18px; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.05); border-left:4px solid ${color};">
        <div style="font-size:11px; font-weight:bold; color:#718096; text-transform:uppercase;">${icono} ${titulo}</div>
        <div style="font-size:22px; font-weight:bold; color:${color}; margin-top:6px;">${valor}</div>
    </div>`;
}

function _tablaHTML(headers, filas) {
    const ths = headers.map(h => `<th style="background:#f1f5f9; padding:10px 12px; text-align:left; font-size:12px; color:#2c3e50; border-bottom:2px solid #e2e8f0;">${h}</th>`).join('');
    const trs = filas.map(cols => {
        const tds = cols.map(c => `<td style="padding:9px 12px; font-size:12px; border-bottom:1px solid #f0f0f0;">${c}</td>`).join('');
        return `<tr>${tds}</tr>`;
    }).join('');
    return `<table style="width:100%; border-collapse:collapse;"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}

function _csvDescargar(nombre, headers, filas) {
    const bom = '\uFEFF';
    const lineas = [headers.join(','), ...filas.map(f => f.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))];
    const blob = new Blob([bom + lineas.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = nombre; a.click();
    URL.revokeObjectURL(url);
}

// --- Reporte Ventas ---

function renderReporteVentas() {
    const desde = document.getElementById('rvFechaDesde')?.value;
    const hasta = document.getElementById('rvFechaHasta')?.value;
    const metodo = document.getElementById('rvMetodo')?.value || '';

    const ventasRegistradas = StorageService.get("ventasRegistradas", []);
    const cxc = StorageService.get("cuentasPorCobrar", []);

    // Normalizar todas las ventas a un formato común
    let todas = ventasRegistradas.map(v => {
        // fechaVenta puede ser número (Date.now()) o string ISO
        const fv = v.fechaVenta;
        const fechaNorm = fv
            ? (typeof fv === 'number' ? window.localISO(new Date(fv)).substring(0, 10) : String(fv).substring(0, 10))
            : (v.fecha || '');
        // Buscar saldo actual en cuentasPorCobrar
        const cxcEntry = cxc.find(c => c.folio === v.folio);
        const saldoActual = cxcEntry ? (cxcEntry.saldoActual || 0) : 0;
        const estado = cxcEntry ? (cxcEntry.estado || 'Pendiente') : (v.metodoPago === 'contado' ? 'Pagado' : 'Pendiente');
        return {
            folio: v.folio || '-',
            nombre: v.clienteNombre || '-',
            fechaVenta: fechaNorm,
            totalContadoOriginal: v.total || 0,
            metodo: v.metodoPago || 'contado',
            estado,
            saldoActual
        };
    });

    if (metodo) todas = todas.filter(v => v.metodo === metodo);
    if (desde) todas = todas.filter(v => v.fechaVenta >= desde);
    if (hasta) todas = todas.filter(v => v.fechaVenta <= hasta);

    const totalVentas = todas.reduce((s, v) => s + Number(v.totalContadoOriginal || 0), 0);
    const totalCobrado = todas.reduce((s, v) => s + Number((v.totalContadoOriginal || 0) - (v.saldoActual || 0)), 0);
    const totalPendiente = todas.reduce((s, v) => s + Number(v.saldoActual || 0), 0);

    document.getElementById('rvKpis').innerHTML =
        _kpiCard('Total Ventas', dinero(totalVentas), '#3498db', '🛍️') +
        _kpiCard('Cobrado', dinero(totalCobrado), '#27ae60', '✅') +
        _kpiCard('Por Cobrar', dinero(totalPendiente), '#e74c3c', '⏳') +
        _kpiCard('Nº Ventas', todas.length, '#9b59b6', '📋');

    // Gráfica por mes
    const porMes = {};
    todas.forEach(v => {
        const mes = (v.fechaVenta || '').substring(0, 7);
        if (mes) porMes[mes] = (porMes[mes] || 0) + Number(v.totalContadoOriginal || 0);
    });
    const meses = Object.keys(porMes).sort();
    const maxVal = Math.max(...Object.values(porMes), 1);
    document.getElementById('rvGraficaMeses').innerHTML = meses.map(m =>
        `<div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:4px;">
            <div style="font-size:9px; color:#718096;">${dinero(porMes[m])}</div>
            <div style="width:100%; height:${Math.round((porMes[m] / maxVal) * 160)}px; background:#3498db; border-radius:3px 3px 0 0; min-height:4px;"></div>
        </div>`).join('');
    document.getElementById('rvGraficaLabels').innerHTML = meses.map(m =>
        `<div style="flex:1; text-align:center; font-size:9px; color:#718096;">${m}</div>`).join('');

    // Tabla
    const todas_sorted = [...todas].sort((a, b) => b.fechaVenta.localeCompare(a.fechaVenta));
    const filas = todas_sorted.map(v => [
        v.folio || '-',
        v.nombre || '-',
        v.fechaVenta ? window.formatearFechaCortaMX(v.fechaVenta + 'T12:00:00') : '-',
        dinero(v.totalContadoOriginal || 0),
        v.metodo || '-',
        v.estado || '-',
        dinero(v.saldoActual || 0)
    ]);
    document.getElementById('rvTabla').innerHTML = _tablaHTML(
        ['Folio', 'Cliente', 'Fecha', 'Total', 'Método', 'Estado', 'Saldo'],
        filas.length ? filas : [['Sin registros', '', '', '', '', '', '']]
    );
}

function exportarReporteVentas() {
    const ventasRegistradas = StorageService.get("ventasRegistradas", []);
    const cxc = StorageService.get("cuentasPorCobrar", []);
    const todas = ventasRegistradas.map(v => {
        const fv = v.fechaVenta;
        const fechaNorm = fv
            ? (typeof fv === 'number' ? window.localISO(new Date(fv)).substring(0, 10) : String(fv).substring(0, 10))
            : (v.fecha || '');
        const cxcEntry = cxc.find(c => c.folio === v.folio);
        return {
            folio: v.folio || '-',
            nombre: v.clienteNombre || '-',
            fechaVenta: fechaNorm,
            totalContadoOriginal: v.total || 0,
            metodo: v.metodoPago || 'contado',
            estado: cxcEntry ? (cxcEntry.estado || 'Pendiente') : (v.metodoPago === 'contado' ? 'Pagado' : 'Pendiente'),
            saldoActual: cxcEntry ? (cxcEntry.saldoActual || 0) : 0
        };
    });
    _csvDescargar('reporte-ventas.csv',
        ['Folio', 'Cliente', 'Fecha', 'Total', 'Método', 'Estado', 'Saldo'],
        todas.map(v => [v.folio, v.nombre, v.fechaVenta, v.totalContadoOriginal, v.metodo, v.estado, v.saldoActual])
    );
}

// --- Reporte Compras ---

function renderReporteCompras() {
    const desde = document.getElementById('rcFechaDesde')?.value;
    const hasta = document.getElementById('rcFechaHasta')?.value;

    // --- CORRECCIÓN: Leer los datos frescos de la base de datos ---
    const compras = StorageService.get("compras", []);
    let lista = [...compras];

    if (desde) lista = lista.filter(c => (c.fechaISO || c.fecha || '') >= desde);
    if (hasta) lista = lista.filter(c => (c.fechaISO || c.fecha || '') <= hasta + 'T23:59:59');

    const totalCompras = lista.reduce((s, c) => s + Number(c.total || 0), 0);
    const proveedores = [...new Set(lista.map(c => c.proveedor))].length;

    document.getElementById('rcKpis').innerHTML =
        _kpiCard('Total Compras', dinero(totalCompras), '#e67e22', '🛒') +
        _kpiCard('Nº Compras', lista.length, '#3498db', '📦') +
        _kpiCard('Proveedores', proveedores, '#9b59b6', '🏭');

    const filas = lista.map(c => [
        c.id || '-',
        c.proveedor || '-',
        c.fechaISO ? window.formatearFechaCortaMX(c.fechaISO) : (c.fecha || '-'),
        dinero(c.total || 0)
    ]);
    document.getElementById('rcTabla').innerHTML = _tablaHTML(
        ['ID', 'Proveedor', 'Fecha', 'Total'],
        filas.length ? filas : [['Sin registros', '', '', '']]
    );
}

function exportarReporteCompras() {
    // --- CORRECCIÓN: Leer los datos frescos de la base de datos ---
    const compras = StorageService.get("compras", []);

    _csvDescargar('reporte-compras.csv',
        ['ID', 'Proveedor', 'Fecha', 'Total'],
        compras.map(c => [c.id || '-', c.proveedor || '-', c.fechaISO || c.fecha || '-', c.total || 0])
    );
}

// --- Reporte Flujo de Efectivo (LIMPIO Y SIN DUPLICADOS) ---

function renderReporteFlujo() {
    const cont = document.getElementById('reporte-flujo');
    if (!cont) return;

    cont.innerHTML = "";

    const fDesde = window._filtroFlujoFInicio || '';
    const fHasta = window._filtroFlujoFFin || '';
    const cuentaFiltro = window._filtroFlujoCuenta || 'todas';
    const periodoAgrupar = window._filtroFlujoPeriodo || 'diario';
    const ordenBloques = window._filtroFlujoOrden || 'desc';

    // 1. OBTENER CUENTAS REALES
    const cajas = StorageService.get("cuentasEfectivo", [{ id: "efectivo", nombre: "💵 Efectivo Principal" }]);
    const tarjetas = StorageService.get("tarjetasConfig", []);
    
    const cuentasParaSelector = [
        ...cajas.map(c => ({ id: c.id, nombre: c.nombre })),
        ...tarjetas.filter(t => t.tipo === 'debito').map(t => ({ id: t.banco, nombre: `🏦 ${t.banco}` }))
    ];

    // 2. ÚNICA FUENTE DE VERDAD (Se eliminan las consultas a Ventas y CxC para evitar triplicar registros)
    let movimientosCrudos = StorageService.get("movimientosCaja", []);
    const manuales = StorageService.get("movimientosManuales", []);
    
    // Unificamos el libro mayor con los movimientos manuales extra
    let todosLosMovimientos = [...movimientosCrudos];
    manuales.forEach(m => {
        todosLosMovimientos.push({
            id: m.id,
            fecha: m.fecha,
            concepto: m.concepto || 'Movimiento Manual',
            tipo: m.tipo,
            cuenta: m.cuenta,
            monto: m.monto
        });
    });

    // 3. FILTRADO
    const obtenerFechaLocalMediodia = (fechaInput) => {
        if (!fechaInput) return new Date(0);
        if (typeof fechaInput === 'number') {
            const d = new Date(fechaInput);
            return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
        }
        const str = String(fechaInput).trim();
        if (str.includes('/')) {
            const p = str.split('/');
            if (p.length === 3) return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]), 12, 0, 0);
        }
        if (str.includes('-')) {
            const p = str.split('T')[0].split('-');
            if (p.length === 3) return new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]), 12, 0, 0);
        }
        const dGen = new Date(fechaInput);
        if (!isNaN(dGen.getTime())) return new Date(dGen.getFullYear(), dGen.getMonth(), dGen.getDate(), 12, 0, 0);
        return new Date(0);
    };

    let movsFiltrados = todosLosMovimientos.filter(m => {
        if (!m || !m.fecha || !m.monto || parseFloat(m.monto) <= 0) return false;

        const cuentaMov = m.cuenta || m.medioPago || 'efectivo';
        const coincideCuenta = (cuentaFiltro === 'todas' || String(cuentaMov) === String(cuentaFiltro));
        
        const fMov = obtenerFechaLocalMediodia(m.fecha);
        m._fechaObjetoSeguro = fMov; 
        
        let coincideRango = true;
        if (fDesde) coincideRango = coincideRango && fMov >= new Date(fDesde + "T00:00:00");
        if (fHasta) coincideRango = coincideRango && fMov <= new Date(fHasta + "T23:59:59");
        return coincideCuenta && coincideRango;
    });

    // 4. AGRUPACIÓN DINÁMICA
    const grupos = {};
    movsFiltrados.forEach(m => {
        const d = m._fechaObjetoSeguro;
        let clave = "";
        let sortKey = d.getTime();
        
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        const fmtFecha = `${dd}/${mm}/${yyyy}`;

        if (periodoAgrupar === 'diario') clave = fmtFecha;
        else if (periodoAgrupar === 'semanal') {
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            const lunes = new Date(new Date(d).setDate(diff));
            const domingo = new Date(new Date(lunes).setDate(lunes.getDate() + 6));
            clave = `${lunes.getDate()}/${lunes.getMonth()+1} al ${domingo.getDate()}/${domingo.getMonth()+1}`;
            sortKey = lunes.getTime();
        } else {
            clave = fmtFecha.substring(3); 
            sortKey = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
        }

        if (!grupos[clave]) grupos[clave] = { ing: 0, egr: 0, items: [], sortKey };
        
        const tipoMov = (m.tipo || 'ingreso').toLowerCase();
        const montoNum = parseFloat(m.monto);

        if (tipoMov === 'ingreso') grupos[clave].ing += montoNum; 
        else grupos[clave].egr += montoNum;
        
        grupos[clave].items.push(m);
    });

    // 5. RENDERIZADO VISUAL
    const dinero = (v) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v || 0);
    const clavesOrd = Object.keys(grupos).sort((a,b) => ordenBloques === 'desc' ? grupos[b].sortKey - grupos[a].sortKey : grupos[a].sortKey - grupos[b].sortKey);

    let totalIng = 0; let totalEgr = 0;
    const bloquesHTML = clavesOrd.map(clave => {
        const g = grupos[clave];
        totalIng += g.ing; totalEgr += g.egr;
        const balance = g.ing - g.egr;
        
        return `
            <div style="min-width:320px; background:white; border-radius:12px; border:1px solid #e2e8f0; display:flex; flex-direction:column; max-height:450px; box-shadow:0 4px 10px rgba(0,0,0,0.05);">
                <div style="padding:15px; background:#1e3a8a; color:white; border-radius:12px 12px 0 0;">
                    <div style="font-weight:bold; font-size:14px;">${clave.toUpperCase()}</div>
                    <div style="display:flex; justify-content:space-between; margin-top:10px; font-size:12px;">
                        <span style="color:#4ade80;">+ ${dinero(g.ing)}</span>
                        <span style="color:#f87171;">- ${dinero(g.egr)}</span>
                    </div>
                    <div style="margin-top:8px; padding-top:8px; border-top:1px dashed rgba(255,255,255,0.3); text-align:right; font-weight:bold;">
                        Neto: ${dinero(balance)}
                    </div>
                </div>
                <div style="flex:1; overflow-y:auto; padding:10px; background:#fcfcfc; border-radius:0 0 12px 12px;">
                    ${g.items.sort((a,b) => b._fechaObjetoSeguro - a._fechaObjetoSeguro).map(i => {
                        // Aquí mostramos el nombre real de tu Efectivo One o Santander
                        const cuentaStr = i.etiquetaCuenta || (i.cuenta === 'efectivo' ? '💵 Efectivo Principal' : i.cuenta);
                        const tipoClase = (i.tipo || 'ingreso').toLowerCase();
                        return `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #f1f5f9; font-size:11px;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <input type="checkbox" style="width:16px; height:16px; cursor:pointer; accent-color:#1e40af;">
                                <div style="max-width:160px; line-height:1.2;"><b>${i.concepto || i.referencia || 'Movimiento'}</b><br><small style="color:#1e40af; font-weight:bold;">${cuentaStr}</small></div>
                            </div>
                            <span style="font-weight:bold; color:${tipoClase==='ingreso'?'#16a34a':'#dc2626'};">${tipoClase==='ingreso'?'+':'-'}${dinero(i.monto)}</span>
                        </div>`
                    }).join('')}
                </div>
            </div>`;
    }).join('');

    cont.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <div>
                <h2 style="margin:0; color:#1e40af;">💵 Flujo de Efectivo Horizontal</h2>
                <p style="color:#718096; margin:0;">Movimientos consolidados sin duplicidades.</p>
            </div>
            <button onclick="abrirModalGastoExtra()" style="padding:10px 18px; background:#10b981; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">💸 Nuevo Gasto / Ingreso</button>
        </div>

        <div style="display:flex; flex-wrap:wrap; gap:15px; background:white; padding:15px; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.05); margin-bottom:25px; align-items:end;">
            <div><label style="font-size:10px; font-weight:bold; color:#64748b;">CUENTA:</label>
                <select onchange="window._filtroFlujoCuenta=this.value; renderReporteFlujo();" style="display:block; padding:8px; border-radius:6px; border:1px solid #cbd5e1; margin-top:4px;">
                    <option value="todas" ${cuentaFiltro==='todas'?'selected':''}>🌍 Ver Todas</option>
                    ${cuentasParaSelector.map(c => `<option value="${c.id}" ${cuentaFiltro===String(c.id)?'selected':''}>${c.nombre}</option>`).join('')}
                </select>
            </div>
            <div><label style="font-size:10px; font-weight:bold; color:#64748b;">AGRUPAR:</label>
                <select onchange="window._filtroFlujoPeriodo=this.value; renderReporteFlujo();" style="display:block; padding:8px; border-radius:6px; border:1px solid #cbd5e1; margin-top:4px;">
                    <option value="diario" ${periodoAgrupar==='diario'?'selected':''}>Diario</option>
                    <option value="semanal" ${periodoAgrupar==='semanal'?'selected':''}>Semanal (Lun-Dom)</option>
                    <option value="mensual" ${periodoAgrupar==='mensual'?'selected':''}>Mensual</option>
                </select>
            </div>
            <div><label style="font-size:10px; font-weight:bold; color:#64748b;">DESDE:</label>
                <input type="date" value="${fDesde}" onchange="window._filtroFlujoFInicio=this.value; renderReporteFlujo();" style="display:block; padding:7px; border-radius:6px; border:1px solid #cbd5e1; margin-top:4px;">
            </div>
            <div><label style="font-size:10px; font-weight:bold; color:#64748b;">HASTA:</label>
                <input type="date" value="${fHasta}" onchange="window._filtroFlujoFFin=this.value; renderReporteFlujo();" style="display:block; padding:7px; border-radius:6px; border:1px solid #cbd5e1; margin-top:4px;">
            </div>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:15px; margin-bottom:25px;">
            <div style="background:#f0fdf4; border-left:5px solid #16a34a; padding:15px; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.05);"><small style="color:#166534; font-weight:bold;">INGRESOS DEL FILTRO</small><br><strong style="font-size:22px; color:#15803d;">${dinero(totalIng)}</strong></div>
            <div style="background:#fff1f2; border-left:5px solid #dc2626; padding:15px; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.05);"><small style="color:#991b1b; font-weight:bold;">EGRESOS DEL FILTRO</small><br><strong style="font-size:22px; color:#b91c1c;">${dinero(totalEgr)}</strong></div>
            <div style="background:#eff6ff; border-left:5px solid #1e40af; padding:15px; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.05);"><small style="color:#1e3a8a; font-weight:bold;">BALANCE NETO</small><br><strong style="font-size:22px; color:#1e40af;">${dinero(totalIng - totalEgr)}</strong></div>
        </div>

        <div style="display:flex; overflow-x:auto; gap:20px; padding:10px 0 25px 0; align-items:flex-start;">
            ${bloquesHTML || '<div style="width:100%; text-align:center; padding:50px; color:#94a3b8; background:white; border-radius:12px;">No hay movimientos con estos filtros.</div>'}
        </div>
    `;
}
// =====================================================================
// 📈 MOTOR A.R.C. V2 (AGRUPADO POR RIESGO E INCOBRABLES)
// =====================================================================

window.toggleIncobrable = function(folio) {
    let cxc = StorageService.get("cuentasPorCobrar", []);
    let cuenta = cxc.find(c => c.folio === folio);
    if (cuenta) {
        cuenta.esIncobrable = !cuenta.esIncobrable;
        StorageService.set("cuentasPorCobrar", cxc);
        renderAnalisisRiesgoCartera();
    }
};

window.renderAnalisisRiesgoCartera = function() {
    const contenedor = document.getElementById("reportes") || document.getElementById("reportes-contenido") || document.getElementById("dashboardContenido");
    if (!contenedor) return;

    const vistaAgrupacion = window._filtroARCAgrupacion || 'mensual';

    const cxcRaw = StorageService.get("cuentasPorCobrar", []);
    const pagares = StorageService.get("pagaresSistema", []);
    const cuentasActivas = cxcRaw.filter(c => c.saldoActual > 0 && c.estado !== 'Pagado');

    if (cuentasActivas.length === 0) {
        contenedor.innerHTML = `<div style="padding:40px; text-align:center; background:white; border-radius:10px; margin-top:20px;"><h3>✅ ¡Felicidades! No hay cartera vencida ni cuentas pendientes.</h3></div>`;
        return;
    }

    const hoy = new Date();
    hoy.setHours(12,0,0,0);
    let fechaMinAbono = new Date(); 
    let fechaMaxAbono = new Date(); 

    const grupos = { INCOBRABLE: [], ALTO: [], MEDIO: [], BAJO: [] };

    cuentasActivas.forEach(cuenta => {
        const pagaresCuenta = pagares.filter(p => p.folio === cuenta.folio);
        let fechaVenta = cuenta.fechaVenta ? new Date(cuenta.fechaVenta) : new Date();
        let fechaFin = new Date(fechaVenta);
        fechaFin.setMonth(fechaFin.getMonth() + 1); 

        if (pagaresCuenta.length > 0) {
            fechaFin = new Date(Math.max(...pagaresCuenta.map(p => new Date(p.fechaVencimiento).getTime())));
        }

        const totalVenta = cuenta.totalContadoOriginal || cuenta.totalMercancia || 1;
        const totalPagado = totalVenta - cuenta.saldoActual;
        const pctPagado = (totalPagado / totalVenta) * 100;
        const pctPendiente = (cuenta.saldoActual / totalVenta) * 100;

        const msTotalPlazo = fechaFin.getTime() - fechaVenta.getTime();
        const msTranscurridos = hoy.getTime() - fechaVenta.getTime();
        
        let pctTiempo = msTotalPlazo > 0 ? (msTranscurridos / msTotalPlazo) * 100 : 100;
        if (pctTiempo < 0) pctTiempo = 0;
        const tiempoCoronado = pctTiempo > 100 ? 100 : pctTiempo; 

        const diferenciaRiesgo = pctPagado - tiempoCoronado;

        let nivelRiesgo = "BAJO"; let colorRiesgo = "#16a34a";
        if (diferenciaRiesgo < -5 && diferenciaRiesgo >= -20) { nivelRiesgo = "MEDIO"; colorRiesgo = "#d97706"; }
        if (diferenciaRiesgo < -20) { nivelRiesgo = "ALTO"; colorRiesgo = "#dc2626"; }
        
        // Sobreescritura manual del usuario
        if (cuenta.esIncobrable) {
            nivelRiesgo = "INCOBRABLE"; colorRiesgo = "#1e293b";
        }

        const abonosProcesados = (cuenta.abonos || []).map(ab => {
            const fAbono = new Date(ab.fecha || ab.fechaAbono);
            if (fAbono < fechaMinAbono) fechaMinAbono = new Date(fAbono);
            if (fAbono > fechaMaxAbono) fechaMaxAbono = new Date(fAbono);
            return { fecha: fAbono, monto: parseFloat(ab.monto || ab.montoAbonado || 0) };
        });

        const periodosCubiertos = cuenta.plan && cuenta.plan.abono > 0 ? (totalPagado / cuenta.plan.abono).toFixed(1) : 0;
        
        const cProcesada = {
            ...cuenta, fechaFin, pctPagado, pctPendiente, pctTiempo: tiempoCoronado, 
            diferenciaRiesgo, nivelRiesgo, colorRiesgo, totalPagado, totalVenta,
            numPagosRealizados: (cuenta.abonos || []).length, abonosProcesados, 
            textoEquivalente: `${periodosCubiertos} ${cuenta.periodicidad || 'pagos'} cubiertos`
        };

        grupos[nivelRiesgo].push(cProcesada);
    });

    // Generar Eje de Tiempo (Columnas)
    fechaMinAbono.setMonth(fechaMinAbono.getMonth() - 1);
    fechaMaxAbono = hoy;
    const columnasTiempo = [];
    const getLunes = (d) => { const date = new Date(d); const day = date.getDay(); return new Date(date.setDate(date.getDate() - day + (day === 0 ? -6 : 1))); };
    let cursorFecha = new Date(fechaMinAbono);
    
    if (vistaAgrupacion === 'mensual') {
        cursorFecha.setDate(1); 
        while (cursorFecha <= fechaMaxAbono) {
            columnasTiempo.push({ key: `${cursorFecha.getFullYear()}-${cursorFecha.getMonth()}`, label: new Intl.DateTimeFormat('es-MX', { month: 'short', year: 'numeric' }).format(cursorFecha).toUpperCase() });
            cursorFecha.setMonth(cursorFecha.getMonth() + 1);
        }
    } else {
        cursorFecha = getLunes(cursorFecha); 
        while (cursorFecha <= fechaMaxAbono) {
            const d = new Date(cursorFecha); d.setDate(d.getDate() + 6);
            columnasTiempo.push({ key: cursorFecha.toISOString().split('T')[0], label: `${cursorFecha.getDate()}/${cursorFecha.getMonth()+1} al ${d.getDate()}/${d.getMonth()+1}` });
            cursorFecha.setDate(cursorFecha.getDate() + 7);
        }
    }

    const fmt = (v) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v);
    
    let html = `
    <div style="background:white; padding:20px; border-radius:12px; box-shadow:0 10px 25px rgba(0,0,0,0.05); margin-bottom:30px; margin-top:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:2px solid #e2e8f0; padding-bottom:15px;">
            <div>
                <h2 style="margin:0; color:#0f172a; font-size:24px;">📈 ARC: Análisis de Riesgo y Cartera</h2>
                <p style="margin:0; color:#64748b; font-size:14px;">Evaluación jerárquica de saldos y clasificación de cobrabilidad.</p>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <button onclick="renderReporteCompromisos()" style="padding:10px 15px; background:#7c3aed; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">🔮 Ver Proyección de Compromisos</button>
                <select onchange="window._filtroARCAgrupacion=this.value; renderAnalisisRiesgoCartera();" style="padding:10px; border:2px solid #cbd5e1; border-radius:8px; font-weight:bold; background:#f8fafc; cursor:pointer;">
                    <option value="mensual" ${vistaAgrupacion === 'mensual' ? 'selected' : ''}>📅 Por Meses</option>
                    <option value="semanal" ${vistaAgrupacion === 'semanal' ? 'selected' : ''}>📆 Por Semanas</option>
                </select>
            </div>
        </div>

        <div style="overflow-x:auto; overflow-y:visible; max-width:100%; padding-bottom:15px;">
            <table style="border-collapse: separate; border-spacing: 0; width:max-content; min-width:100%;">
                <thead>
                    <tr>
                        <th style="position:sticky; left:0; z-index:10; background:#f8fafc; padding:15px; border-bottom:2px solid #cbd5e1; border-right:2px solid #cbd5e1; text-align:left; min-width:400px; box-shadow: 4px 0 8px rgba(0,0,0,0.05);">
                            <span style="color:#1e40af; font-size:15px;">📑 PERFIL DEL CRÉDITO Y ANÁLISIS DE RIESGO</span>
                        </th>
                        ${columnasTiempo.map(col => `<th style="padding:15px; background:#f1f5f9; border-bottom:2px solid #cbd5e1; border-right:1px solid #e2e8f0; text-align:center; color:#475569; min-width:120px; font-size:12px;">${col.label}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
    `;

    const ordenBloques = [
        { id: 'INCOBRABLE', titulo: '⚫ CARTERA INCOBRABLE (Pérdida Asumida)', bg: '#f8fafc', borde: '#1e293b' },
        { id: 'ALTO', titulo: '🔴 CARTERA DE ALTO RIESGO (Foco Rojo)', bg: '#fff1f2', borde: '#dc2626' },
        { id: 'MEDIO', titulo: '🟠 CARTERA DE RIESGO MEDIO (Atrasos Recuperables)', bg: '#fffbeb', borde: '#d97706' },
        { id: 'BAJO', titulo: '🟢 CARTERA SANA (Riesgo Bajo / Al corriente)', bg: '#f0fdf4', borde: '#16a34a' }
    ];

    ordenBloques.forEach(bloque => {
        if (grupos[bloque.id].length === 0) return;
        
        html += `<tr><td colspan="${columnasTiempo.length + 1}" style="padding:10px 15px; background:${bloque.bg}; border-left:5px solid ${bloque.borde}; font-weight:900; color:${bloque.borde}; font-size:14px;">${bloque.titulo} (${grupos[bloque.id].length} cuentas)</td></tr>`;

        grupos[bloque.id].sort((a,b) => a.diferenciaRiesgo - b.diferenciaRiesgo).forEach(c => {
            const sumasPorColumna = {};
            columnasTiempo.forEach(col => sumasPorColumna[col.key] = 0);

            c.abonosProcesados.forEach(ab => {
                const k = vistaAgrupacion === 'mensual' ? `${ab.fecha.getFullYear()}-${ab.fecha.getMonth()}` : getLunes(ab.fecha).toISOString().split('T')[0];
                if (sumasPorColumna[k] !== undefined) sumasPorColumna[k] += ab.monto;
            });

            const lblBotonInco = c.esIncobrable ? 'Quitar de Incobrable' : 'Marcar Incobrable';
            const colorBotonInco = c.esIncobrable ? '#64748b' : '#0f172a';

            html += `
            <tr style="transition:0.2s;" onmouseover="this.style.backgroundColor='#fcfcfc'" onmouseout="this.style.backgroundColor='transparent'">
                <td style="position:sticky; left:0; z-index:5; background:white; padding:15px; border-bottom:1px solid #e2e8f0; border-right:2px solid #cbd5e1; box-shadow: 4px 0 8px rgba(0,0,0,0.05); vertical-align:top;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                        <div style="font-weight:900; color:#0f172a; font-size:15px;">${c.nombre || c.clienteNombre}</div>
                        <div style="display:flex; gap:5px;">
                            <button onclick="toggleIncobrable('${c.folio}')" style="background:${colorBotonInco}; color:white; border:none; padding:3px 8px; border-radius:4px; font-size:10px; cursor:pointer; font-weight:bold;">${lblBotonInco}</button>
                            <div style="font-size:10px; background:#eff6ff; color:#1e40af; padding:3px 6px; border-radius:4px; font-weight:bold;">${c.folio}</div>
                        </div>
                    </div>
                    
                    <div style="font-size:11px; color:#64748b; margin-bottom:12px; line-height:1.3;">📦 <b>Mercancía:</b> ${(c.articulos || []).map(a => `${a.cantidad}x ${a.nombre}`).join(', ')}</div>

                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; background:#f8fafc; padding:10px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:12px;">
                        <div>
                            <div style="font-size:10px; color:#64748b; font-weight:bold;">Importe Cubierto (${c.pctPagado.toFixed(1)}%):</div>
                            <div style="font-size:14px; color:#16a34a; font-weight:900;">${fmt(c.totalPagado)}</div>
                            <div style="font-size:10px; color:#64748b; font-weight:bold; margin-top:2px;">De un total de: ${fmt(c.totalVenta)}</div>
                        </div>
                        <div>
                            <div style="font-size:10px; color:#64748b; font-weight:bold;">Saldo Pendiente (${c.pctPendiente.toFixed(1)}%):</div>
                            <div style="font-size:15px; color:#dc2626; font-weight:900;">${fmt(c.saldoActual)}</div>
                        </div>
                    </div>

                    <div style="border-left:4px solid ${c.colorRiesgo}; padding-left:10px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                            <span style="font-size:11px; font-weight:bold; color:${c.colorRiesgo};">⚠️ RIESGO: ${c.nivelRiesgo}</span>
                            <span style="font-size:11px; font-weight:bold; color:#475569;">Vence: ${c.fechaFin.toISOString().split('T')[0]}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:11px; color:#64748b; margin-bottom:4px;">
                            <span>Tiempo corrido: <b>${c.pctTiempo.toFixed(0)}%</b></span>
                            <span>Pagos: <b>${c.numPagosRealizados}</b></span>
                        </div>
                        <div style="font-size:11px; color:#1e40af; font-weight:bold; margin-top:6px;">⏱️ Equivalente: ${c.textoEquivalente}</div>
                    </div>
                </td>
                ${columnasTiempo.map(col => {
                    const v = sumasPorColumna[col.key];
                    return `<td style="padding:15px; border-bottom:1px solid #e2e8f0; border-right:1px dashed #e2e8f0; text-align:center; vertical-align:middle; ${v > 0 ? 'background:#f0fdf4;' : ''}">
                        <div style="color:${v > 0 ? '#16a34a; font-weight:900; font-size:14px;' : '#cbd5e1; font-size:12px;'}">${v > 0 ? '+'+fmt(v) : '-'}</div>
                    </td>`;
                }).join('')}
            </tr>`;
        });
    });

    html += `</tbody></table></div></div>`;
    contenedor.innerHTML = html;
};


// =====================================================================
// 🔮 REPORTE DE COMPROMISOS Y PROYECCIÓN DE FLUJO
// =====================================================================

window.toggleConsignacionOC = function(idOC) {
    let ocs = StorageService.get("ordenesCompra", []);
    let oc = ocs.find(o => String(o.id) === String(idOC));
    if (oc) {
        oc.esConsignacion = !oc.esConsignacion;
        StorageService.set("ordenesCompra", ocs);
        renderReporteCompromisos();
    }
};

window.renderReporteCompromisos = function() {
    const contenedor = document.getElementById("reportes") || document.getElementById("reportes-contenido") || document.getElementById("dashboardContenido");
    if (!contenedor) return;

    const fmt = (v) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v);
    const hoy = new Date();
    
    const mesesProyeccion = [];
    for(let i=0; i<6; i++) {
        let d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
        mesesProyeccion.push({
            key: `${d.getFullYear()}-${d.getMonth()}`,
            label: new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(d).toUpperCase(),
            egresos: { tdc: 0, proveedores: 0, fijos: 0 },
            ingresos: { sano: 0, medio: 0, alto: 0 }
        });
    }

    // 1. EGRESOS
    const cuentasMSI = StorageService.get("cuentasMSI", []);
    cuentasMSI.forEach(msi => {
        (msi.calendario || []).forEach(pago => {
            if (pago.estado !== 'Pagado') {
                const fPago = new Date(pago.fecha + 'T12:00:00');
                const key = `${fPago.getFullYear()}-${fPago.getMonth()}`;
                let mesDestino = mesesProyeccion.find(m => m.key === key) || mesesProyeccion[0]; 
                mesDestino.egresos.tdc += parseFloat(pago.monto || 0);
            }
        });
    });

    const ocs = StorageService.get("ordenesCompra", []);
    let trProveedoresHTML = '';
    ocs.forEach(oc => {
        if (oc.estado !== 'Pagada' && oc.estado !== 'Cancelada' && (oc.saldoPendiente || oc.total) > 0) {
            const saldo = oc.saldoPendiente !== undefined ? oc.saldoPendiente : oc.total;
            trProveedoresHTML += `<div style="display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid #eee; font-size:12px;">
                <span>${oc.proveedorNombre} (Folio: ${oc.folio})</span>
                <div style="display:flex; gap:10px; align-items:center;">
                    <span style="font-weight:bold; color:#dc2626;">${fmt(saldo)}</span>
                    <button onclick="toggleConsignacionOC('${oc.id}')" style="background:${oc.esConsignacion ? '#10b981' : '#64748b'}; color:white; border:none; padding:2px 6px; border-radius:4px; font-size:10px; cursor:pointer;">${oc.esConsignacion ? '✅ Consignación' : 'Pagar Normal'}</button>
                </div>
            </div>`;
            if (!oc.esConsignacion) mesesProyeccion[0].egresos.proveedores += parseFloat(saldo);
        }
    });

    // 2. INGRESOS
    const cxc = StorageService.get("cuentasPorCobrar", []);
    const pagares = StorageService.get("pagaresSistema", []);
    
    const mapaRiesgo = {};
    cxc.forEach(cuenta => {
        if(cuenta.esIncobrable) { mapaRiesgo[cuenta.folio] = 'incobrable'; return; }
        const totalVenta = cuenta.totalContadoOriginal || 1;
        const totalPagado = totalVenta - cuenta.saldoActual;
        const pctPagado = (totalPagado / totalVenta) * 100;
        
        const pags = pagares.filter(p => p.folio === cuenta.folio);
        let fFin = new Date(cuenta.fechaVenta || hoy);
        if(pags.length > 0) fFin = new Date(Math.max(...pags.map(p => new Date(p.fechaVencimiento).getTime())));
        
        const msT = hoy.getTime() - new Date(cuenta.fechaVenta || hoy).getTime();
        const msP = fFin.getTime() - new Date(cuenta.fechaVenta || hoy).getTime();
        let pctTiempo = msP > 0 ? (msT / msP) * 100 : 100;
        if(pctTiempo > 100) pctTiempo = 100;

        const dif = pctPagado - pctTiempo;
        if (dif < -20) mapaRiesgo[cuenta.folio] = 'alto';
        else if (dif < -5) mapaRiesgo[cuenta.folio] = 'medio';
        else mapaRiesgo[cuenta.folio] = 'sano';
    });

    pagares.forEach(pago => {
        if (pago.estado !== 'Pagado' && pago.estado !== 'Cancelado') {
            const riesgo = mapaRiesgo[pago.folio] || 'sano';
            if (riesgo === 'incobrable') return; 

            const fVenc = new Date(pago.fechaVencimiento);
            const key = `${fVenc.getFullYear()}-${fVenc.getMonth()}`;
            let mesDestino = mesesProyeccion.find(m => m.key === key) || mesesProyeccion[0];

            mesDestino.ingresos[riesgo] += parseFloat(pago.monto || 0);
        }
    });

    // 3. RENDERIZAR TABLA
    let html = `
    <div style="background:white; padding:20px; border-radius:12px; box-shadow:0 10px 25px rgba(0,0,0,0.05); margin-top:20px; margin-bottom:30px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #e2e8f0; padding-bottom:15px; margin-bottom:20px;">
            <div>
                <h2 style="margin:0; color:#4c1d95; font-size:24px;">🔮 Proyección de Compromisos (Cash Flow)</h2>
                <p style="margin:0; color:#64748b; font-size:14px;">Enfrenta tus egresos obligatorios contra tus cobranzas esperadas en 3 escenarios.</p>
            </div>
            <button onclick="renderAnalisisRiesgoCartera()" style="padding:10px 15px; background:#e2e8f0; color:#475569; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">⬅️ Volver a ARC</button>
        </div>

        <div style="margin-bottom:20px; padding:15px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px;">
            <h4 style="margin:0 0 10px 0; color:#0f172a;">⚙️ Configuración de Deuda a Proveedores (Excluir Consignación)</h4>
            <p style="font-size:11px; color:#64748b; margin-bottom:10px;">Marca en verde las cuentas a consignación para que el sistema NO las exija como pago este mes.</p>
            <div style="max-height:150px; overflow-y:auto; padding-right:10px;">
                ${trProveedoresHTML || '<div style="font-size:12px; color:#94a3b8;">No hay deudas a proveedores abiertas.</div>'}
            </div>
        </div>

        <div style="overflow-x:auto;">
            <table style="width:100%; min-width:800px; border-collapse:collapse;">
                <thead>
                    <tr>
                        <th style="padding:15px; background:#f1f5f9; text-align:left; border-bottom:2px solid #cbd5e1; width:250px;">Concepto</th>
                        ${mesesProyeccion.map(m => `<th style="padding:15px; background:#f8fafc; text-align:center; border-bottom:2px solid #cbd5e1; color:#0f172a; font-weight:900;">${m.label}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    <tr><td colspan="${mesesProyeccion.length + 1}" style="background:#fff1f2; color:#be123c; font-weight:bold; padding:10px 15px; font-size:14px;">🔻 COMPROMISOS (Lo que debes pagar)</td></tr>
                    <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:10px 15px; font-weight:bold; color:#475569; font-size:12px;">Tarjetas de Crédito MSI</td>
                        ${mesesProyeccion.map(m => `<td style="padding:10px; text-align:center; color:#dc2626; font-weight:bold;">${fmt(m.egresos.tdc)}</td>`).join('')}
                    </tr>
                    <tr style="border-bottom:1px solid #e2e8f0;">
                        <td style="padding:10px 15px; font-weight:bold; color:#475569; font-size:12px;">Cuentas por Pagar (Proveedores)</td>
                        ${mesesProyeccion.map(m => `<td style="padding:10px; text-align:center; color:#dc2626; font-weight:bold;">${fmt(m.egresos.proveedores)}</td>`).join('')}
                    </tr>
                    <tr style="border-bottom:2px solid #cbd5e1; background:#f8fafc;">
                        <td style="padding:10px 15px; font-weight:900; color:#0f172a; font-size:13px;">(=) TOTAL COMPROMISOS</td>
                        ${mesesProyeccion.map(m => {
                            const tot = m.egresos.tdc + m.egresos.proveedores;
                            return `<td style="padding:10px; text-align:center; color:#be123c; font-weight:900;">${fmt(tot)}</td>`;
                        }).join('')}
                    </tr>

                    <tr><td colspan="${mesesProyeccion.length + 1}" style="background:#f0fdf4; color:#15803d; font-weight:bold; padding:10px 15px; font-size:14px; margin-top:10px;">🟢 COBRANZA ESPERADA (Según Nivel de Riesgo)</td></tr>
                    <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:10px 15px; font-weight:bold; color:#16a34a; font-size:12px;">Cobranza Segura (Cartera Sana)</td>
                        ${mesesProyeccion.map(m => `<td style="padding:10px; text-align:center; color:#16a34a;">${fmt(m.ingresos.sano)}</td>`).join('')}
                    </tr>
                    <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:10px 15px; font-weight:bold; color:#d97706; font-size:12px;">Cobranza Probable (Riesgo Medio)</td>
                        ${mesesProyeccion.map(m => `<td style="padding:10px; text-align:center; color:#d97706;">${fmt(m.ingresos.medio)}</td>`).join('')}
                    </tr>
                    <tr style="border-bottom:1px solid #e2e8f0;">
                        <td style="padding:10px 15px; font-weight:bold; color:#dc2626; font-size:12px;">Cobranza Difícil (Alto Riesgo)</td>
                        ${mesesProyeccion.map(m => `<td style="padding:10px; text-align:center; color:#dc2626;">${fmt(m.ingresos.alto)}</td>`).join('')}
                    </tr>

                    <tr><td colspan="${mesesProyeccion.length + 1}" style="background:#eff6ff; color:#1d4ed8; font-weight:bold; padding:10px 15px; font-size:14px;">⚖️ ESCENARIOS DE LIQUIDEZ (Con qué dinero contarás)</td></tr>
                    <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:15px; font-size:12px;">
                            <b style="color:#16a34a;">Escenario Optimista</b><br>
                            <small style="color:#64748b;">(Pagan todos: Sanos + Medios + Altos)</small>
                        </td>
                        ${mesesProyeccion.map(m => {
                            const ingTot = m.ingresos.sano + m.ingresos.medio + m.ingresos.alto;
                            const egTot = m.egresos.tdc + m.egresos.proveedores;
                            const dif = ingTot - egTot;
                            return `<td style="padding:15px; text-align:center; font-weight:900; color:${dif >= 0 ? '#16a34a' : '#dc2626'};">${fmt(dif)}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="border-bottom:1px solid #f1f5f9; background:#f8fafc;">
                        <td style="padding:15px; font-size:12px;">
                            <b style="color:#d97706;">Escenario Realista</b><br>
                            <small style="color:#64748b;">(Solo te pagan los Sanos y Medios)</small>
                        </td>
                        ${mesesProyeccion.map(m => {
                            const ingTot = m.ingresos.sano + m.ingresos.medio;
                            const egTot = m.egresos.tdc + m.egresos.proveedores;
                            const dif = ingTot - egTot;
                            return `<td style="padding:15px; text-align:center; font-weight:900; color:${dif >= 0 ? '#d97706' : '#dc2626'};">${fmt(dif)}</td>`;
                        }).join('')}
                    </tr>
                    <tr>
                        <td style="padding:15px; font-size:12px;">
                            <b style="color:#dc2626;">Escenario Conservador (Estrés)</b><br>
                            <small style="color:#64748b;">(Solo te pagan los clientes súper Sanos)</small>
                        </td>
                        ${mesesProyeccion.map(m => {
                            const ingTot = m.ingresos.sano;
                            const egTot = m.egresos.tdc + m.egresos.proveedores;
                            const dif = ingTot - egTot;
                            return `<td style="padding:15px; text-align:center; font-weight:900; color:${dif >= 0 ? '#0f172a' : '#dc2626'}; background:${dif < 0 ? '#fff1f2' : 'transparent'};">${fmt(dif)}</td>`;
                        }).join('')}
                    </tr>
                </tbody>
            </table>
        </div>
    </div>`;

    contenedor.innerHTML = html;
};

// --- FUNCIONES DE SOPORTE ---
window.actualizarFiltrosFlujo = function() {
    window._filtroFlujoPeriodo = document.getElementById('fPer').value;
    window._filtroFlujoCuenta = document.getElementById('fCta').value;
    if (document.getElementById('fIni')) {
        window._filtroFlujoFInicio = document.getElementById('fIni').value;
        window._filtroFlujoFFin = document.getElementById('fFin').value;
    }
    renderReporteFlujo();
};

window.abrirModalGastoExtra = function() {
    const html = `
    <div id="mFin" style="position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:10000; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
        <div style="background:white; padding:30px; border-radius:16px; width:90%; max-width:400px;">
            <h3 style="margin:0; color:#1e40af;">💸 Movimiento Manual</h3>
            <label style="display:block; margin-top:15px; font-size:11px; font-weight:bold;">TIPO:</label>
            <select id="mTipo" style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1;"><option value="egreso">🔴 Gasto / Salida</option><option value="ingreso">🟢 Ingreso Extra</option></select>
            <label style="display:block; margin-top:10px; font-size:11px; font-weight:bold;">CUENTA:</label>
            <select id="mCta" style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1;"><option value="Efectivo">Caja (Efectivo)</option><option value="Transferencia">Banco (Transferencia)</option><option value="Tarjeta">Tarjeta (Terminal)</option></select>
            <label style="display:block; margin-top:10px; font-size:11px; font-weight:bold;">CONCEPTO:</label>
            <input type="text" id="mCon" placeholder="Ej. Pago de luz, Comida..." style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1; box-sizing:border-box;">
            <label style="display:block; margin-top:10px; font-size:11px; font-weight:bold;">MONTO ($):</label>
            <input type="number" id="mMon" placeholder="0.00" style="width:100%; padding:12px; border-radius:8px; border:2px solid #1e40af; font-size:18px; font-weight:bold; box-sizing:border-box;">
            <div style="display:flex; gap:10px; margin-top:25px;">
                <button onclick="guardarMovManual()" style="flex:1; padding:12px; background:#1e40af; color:white; border:none; border-radius:8px; font-weight:bold;">💾 Guardar</button>
                <button onclick="document.getElementById('mFin').remove()" style="flex:1; padding:12px; background:#f1f5f9; color:#475569; border:none; border-radius:8px;">Cancelar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window.guardarMovManual = function() {
    const t = document.getElementById('mTipo').value, c = document.getElementById('mCta').value, con = document.getElementById('mCon').value.trim(), mon = parseFloat(document.getElementById('mMon').value);
    if (!con || isNaN(mon) || mon <= 0) return alert("❌ Datos inválidos");
    const m = StorageService.get("movimientosManuales", []);
    m.push({ id: Date.now(), fecha: Date.now(), tipo: t, cuenta: c, concepto: `[Manual] ${con}`, monto: mon });
    StorageService.set("movimientosManuales", m);
    document.getElementById('mFin').remove();
    renderReporteFlujo();
};

function exportarReporteFlujo() {
    // --- CORRECCIÓN: Leer los datos frescos de la base de datos ---
    const movimientosCaja = StorageService.get("movimientosCaja", []);

    _csvDescargar('reporte-flujo.csv',
        ['Folio', 'Fecha', 'Tipo', 'Monto', 'Concepto', 'Referencia'],
        movimientosCaja.map(m => [m.folio || '-', m.fecha || '-', m.tipo || '-', m.monto || 0, m.concepto || '-', m.referencia || '-'])
    );
}

// ===== REPORTE DE RENTABILIDAD PURA =====
window.renderReporteRentabilidad = function() {
    const cont = document.getElementById('contenidoRentabilidad'); // <--- AHORA APUNTA AQUÍ
    if (!cont) return;

    const ventas = StorageService.get("ventasRegistradas", []);
    const gastos = StorageService.get("gastosOperativos", []);
    const productos = StorageService.get("productos", []);
    
    // 1. CÁLCULO DE INGRESOS Y COSTO DE MERCANCÍA (COGS)
    let totalVentas = 0;
    let costoMercanciaTotal = 0;

    ventas.forEach(v => {
        totalVentas += (v.total || 0);
        
        // Sumar el costo individual de cada artículo en la venta
        (v.articulos || []).forEach(art => {
            const pData = productos.find(p => String(p.id) === String(art.id || art.productoId));
            const costoUnitario = pData ? (pData.costo || 0) : (art.costo || 0);
            costoMercanciaTotal += costoUnitario * (art.cantidad || 1);
        });
    });

    // 2. CÁLCULO DE GASTOS OPERATIVOS
    const totalGastos = gastos.reduce((s, g) => s + (g.monto || 0), 0);

    const utilidadBruta = totalVentas - costoMercanciaTotal;
    const utilidadNeta = utilidadBruta - totalGastos;
    const margenNeto = totalVentas > 0 ? (utilidadNeta / totalVentas * 100).toFixed(1) : 0;

    cont.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:25px;">
        <div style="background:white;padding:25px;border-radius:15px;box-shadow:var(--shadow-sm);border:1px solid var(--border-color);">
            <div style="margin-bottom:15px;display:flex;justify-content:space-between;">
                <span style="color:#64748b;">(+) Ingresos por Ventas</span>
                <strong style="color:#16a34a;">${dinero(totalVentas)}</strong>
            </div>
            <div style="margin-bottom:15px;display:flex;justify-content:space-between;border-bottom:1px solid #f1f5f9;padding-bottom:10px;">
                <span style="color:#64748b;">(-) Costo de Mercancía</span>
                <strong style="color:#dc2626;">${dinero(costoMercanciaTotal)}</strong>
            </div>
            <div style="margin-bottom:15px;display:flex;justify-content:space-between;">
                <span style="font-weight:bold;">(=) UTILIDAD BRUTA</span>
                <strong style="font-size:18px;">${dinero(utilidadBruta)}</strong>
            </div>
            <div style="margin-bottom:15px;display:flex;justify-content:space-between;border-bottom:1px solid #f1f5f9;padding-bottom:10px;">
                <span style="color:#64748b;">(-) Gastos Operativos (Fijos/Var)</span>
                <strong style="color:#dc2626;">${dinero(totalGastos)}</strong>
            </div>
            <div style="margin-top:20px;display:flex;justify-content:space-between;background:#eff6ff;padding:15px;border-radius:10px;">
                <span style="font-weight:bold;color:#1e40af;">(=) UTILIDAD NETA LIBRE</span>
                <strong style="font-size:22px;color:#1e40af;">${dinero(utilidadNeta)}</strong>
            </div>
        </div>

        <div style="background:#f8fafc;padding:25px;border-radius:15px;border:1px dashed #cbd5e1;text-align:center;display:flex;flex-direction:column;justify-content:center;">
            <small style="color:#64748b;font-weight:bold;text-transform:uppercase;">Margen Neto de Ganancia</small>
            <div style="font-size:48px;font-weight:900;color:${utilidadNeta > 0 ? '#10b981' : '#dc2626'};">${margenNeto}%</div>
            <p style="font-size:12px;color:#94a3b8;margin-top:10px;">Por cada $100 que entran, te quedan <b>${dinero(utilidadNeta / (totalVentas/100 || 1))}</b> libres después de pagar mercancía y gastos.</p>
        </div>
      </div>
    `;
};
// =====================================================================
// 🔮 REPORTE DE COMPROMISOS Y PROYECCIÓN DE FLUJO (FIFO UNIFICADO)
// =====================================================================

window.toggleConsignacionOC = function(idOC) {
    let ocs = StorageService.get("ordenesCompra", []);
    let oc = ocs.find(o => String(o.id) === String(idOC));
    if (oc) {
        oc.esConsignacion = !oc.esConsignacion;
        StorageService.set("ordenesCompra", ocs);
        renderReporteCompromisos();
    }
};

window.renderReporteCompromisos = function() {
    const contenedor = document.getElementById("reportes") || document.getElementById("reportes-contenido") || document.getElementById("dashboardContenido");
    if (!contenedor) return;

    const fmt = (v) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v);
    const hoy = new Date();
    
    const mesesProyeccion = [];
    for(let i=0; i<6; i++) {
        let d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
        mesesProyeccion.push({
            key: `${d.getFullYear()}-${d.getMonth()}`,
            label: new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(d).toUpperCase(),
            egresos: { tdc: 0, proveedores: 0, consignacionVendida: 0 },
            ingresos: { sano: 0, medio: 0, alto: 0 }
        });
    }

    // 1. EGRESOS TDC (Tarjetas MSI)
    const cuentasMSI = StorageService.get("cuentasMSI", []);
    cuentasMSI.forEach(msi => {
        (msi.calendario || []).forEach(pago => {
            if (pago.estado !== 'Pagado') {
                const fPago = new Date(pago.fecha + 'T12:00:00');
                const key = `${fPago.getFullYear()}-${fPago.getMonth()}`;
                let mesDestino = mesesProyeccion.find(m => m.key === key) || mesesProyeccion[0]; 
                mesDestino.egresos.tdc += parseFloat(pago.monto || 0);
            }
        });
    });

    // 2. EGRESOS PROVEEDORES (FIFO UNIFICADO: Compras Directas + Órdenes de Compra)
    const ocs = StorageService.get("ordenesCompra", []);
    const comprasDirectas = StorageService.get("compras", []);
    const ventas = StorageService.get("ventasRegistradas", []);
    
    // A) Crear Línea de Tiempo Unificada de Entradas (Todo el inventario que ha llegado)
    let inventarioEntrante = [];

    ocs.forEach(oc => {
        if (oc.estado !== 'Cancelada') {
            inventarioEntrante.push({
                origen: 'OC',
                idOriginal: oc.id,
                folio: oc.folio,
                proveedor: oc.proveedorNombre,
                fechaMs: new Date(oc.fechaEmision || oc.fecha).getTime(),
                esConsignacion: !!oc.esConsignacion,
                articulos: oc.articulos || [],
                total: oc.total || 0,
                saldoPendiente: oc.saldoPendiente !== undefined ? oc.saldoPendiente : oc.total,
                estado: oc.estado
            });
        }
    });

    comprasDirectas.forEach(cd => {
        const esConsig = cd.metodoPago === 'consignacion';
        inventarioEntrante.push({
            origen: 'CD',
            idOriginal: cd.id,
            folio: cd.folio || cd.id,
            proveedor: cd.proveedor,
            fechaMs: new Date(cd.fechaISO || cd.fecha).getTime(),
            esConsignacion: esConsig,
            articulos: cd.articulos || [],
            total: cd.total || 0,
            saldoPendiente: (cd.total || 0) - (cd.pagado || 0),
            estado: 'Pagada/Directa'
        });
    });

    // Ordenar estrictamente de lo más viejo a lo más nuevo
    inventarioEntrante.sort((a, b) => a.fechaMs - b.fechaMs);

    // B) Crear Pool de Ventas Históricas
    let ventasPorProducto = {};
    ventas.forEach(v => {
        if(v.estado === 'Cancelada' || v.estatus === 'Cancelada') return;
        (v.articulos || []).forEach(art => {
            let pid = String(art.id || art.productoId);
            ventasPorProducto[pid] = (ventasPorProducto[pid] || 0) + (parseFloat(art.cantidad) || 1);
        });
    });

    let trProveedoresHTML = '';
    let trConsignacionHTML = '';

    // C) Rellenar las ventas consumiendo el inventario desde el más viejo
    inventarioEntrante.forEach(entrada => {
        let valorVendidoDeEstaEntrada = 0;
        
        // Consumir el stock de esta entrada
        entrada.articulos.forEach(art => {
            let pid = String(art.productoId || art.id);
            let cantComprada = parseFloat(art.cantidad) || 1;

            if (ventasPorProducto[pid] && ventasPorProducto[pid] > 0) {
                let cantTomada = Math.min(cantComprada, ventasPorProducto[pid]);
                ventasPorProducto[pid] -= cantTomada; // Restar del pool global
                valorVendidoDeEstaEntrada += cantTomada * (parseFloat(art.costo) || 0);
            }
        });

        // D) Reglas Financieras según el tipo de entrada
        const totalPagadoAEntrada = entrada.total - entrada.saldoPendiente;

        if (entrada.esConsignacion) {
            // Es consignación: ¿Ya se vendió algo que no le he pagado al proveedor?
            let deudaRealConsignacion = valorVendidoDeEstaEntrada - totalPagadoAEntrada;

            if (deudaRealConsignacion > 0 && entrada.saldoPendiente > 0) {
                // Topear la exigencia al saldo real pendiente
                deudaRealConsignacion = Math.min(deudaRealConsignacion, entrada.saldoPendiente);
                
                mesesProyeccion[0].egresos.consignacionVendida += deudaRealConsignacion;
                trConsignacionHTML += `<div style="display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid #eee; font-size:12px;">
                    <span style="color:#be123c;">📦 [${entrada.origen}] ${entrada.folio} (${entrada.proveedor}) - Vendida</span>
                    <span style="font-weight:bold; color:#be123c;">${fmt(deudaRealConsignacion)}</span>
                </div>`;
            }

            // Etiqueta UI en la configuración (Solo para las que son Órdenes de Compra y deben)
            if (entrada.origen === 'OC' && entrada.estado !== 'Pagada') {
                const stockEnBodega = entrada.saldoPendiente - (deudaRealConsignacion > 0 ? deudaRealConsignacion : 0);
                trProveedoresHTML += `<div style="display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid #eee; font-size:12px; background:#ecfdf5;">
                    <span style="color:#065f46;">${entrada.proveedor} (Folio: ${entrada.folio})</span>
                    <div style="display:flex; gap:10px; align-items:center;">
                        <span style="font-weight:bold; color:#10b981;">En bodega: ${fmt(Math.max(0, stockEnBodega))}</span>
                        <button onclick="toggleConsignacionOC('${entrada.idOriginal}')" style="background:#10b981; color:white; border:none; padding:2px 6px; border-radius:4px; font-size:10px; cursor:pointer;">✅ Consignación</button>
                    </div>
                </div>`;
            }

        } else {
            // PROVEEDORES NORMALES O CRÉDITO DIRECTO
            if (entrada.origen === 'OC' && entrada.estado !== 'Pagada' && entrada.saldoPendiente > 0) {
                mesesProyeccion[0].egresos.proveedores += parseFloat(entrada.saldoPendiente);
                trProveedoresHTML += `<div style="display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid #eee; font-size:12px;">
                    <span>${entrada.proveedor} (Folio: ${entrada.folio})</span>
                    <div style="display:flex; gap:10px; align-items:center;">
                        <span style="font-weight:bold; color:#dc2626;">${fmt(entrada.saldoPendiente)}</span>
                        <button onclick="toggleConsignacionOC('${entrada.idOriginal}')" style="background:#64748b; color:white; border:none; padding:2px 6px; border-radius:4px; font-size:10px; cursor:pointer;">Pagar Normal</button>
                    </div>
                </div>`;
            }
        }
    });

    // 3. INGRESOS
    const cxc = StorageService.get("cuentasPorCobrar", []);
    const pagares = StorageService.get("pagaresSistema", []);
    
    const mapaRiesgo = {};
    cxc.forEach(cuenta => {
        if(cuenta.esIncobrable) { mapaRiesgo[cuenta.folio] = 'incobrable'; return; }
        const totalVenta = cuenta.totalContadoOriginal || 1;
        const totalPagado = totalVenta - cuenta.saldoActual;
        const pctPagado = (totalPagado / totalVenta) * 100;
        
        const pags = pagares.filter(p => p.folio === cuenta.folio);
        let fFin = new Date(cuenta.fechaVenta || hoy);
        if(pags.length > 0) fFin = new Date(Math.max(...pags.map(p => new Date(p.fechaVencimiento).getTime())));
        
        const msT = hoy.getTime() - new Date(cuenta.fechaVenta || hoy).getTime();
        const msP = fFin.getTime() - new Date(cuenta.fechaVenta || hoy).getTime();
        let pctTiempo = msP > 0 ? (msT / msP) * 100 : 100;
        if(pctTiempo > 100) pctTiempo = 100;

        const dif = pctPagado - pctTiempo;
        if (dif < -20) mapaRiesgo[cuenta.folio] = 'alto';
        else if (dif < -5) mapaRiesgo[cuenta.folio] = 'medio';
        else mapaRiesgo[cuenta.folio] = 'sano';
    });

    pagares.forEach(pago => {
        if (pago.estado !== 'Pagado' && pago.estado !== 'Cancelado') {
            const riesgo = mapaRiesgo[pago.folio] || 'sano';
            if (riesgo === 'incobrable') return; 

            const fVenc = new Date(pago.fechaVencimiento);
            const key = `${fVenc.getFullYear()}-${fVenc.getMonth()}`;
            let mesDestino = mesesProyeccion.find(m => m.key === key) || mesesProyeccion[0];

            mesDestino.ingresos[riesgo] += parseFloat(pago.monto || 0);
        }
    });

    // 4. RENDERIZAR TABLA
    let html = `
    <div style="background:white; padding:20px; border-radius:12px; box-shadow:0 10px 25px rgba(0,0,0,0.05); margin-top:20px; margin-bottom:30px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #e2e8f0; padding-bottom:15px; margin-bottom:20px;">
            <div>
                <h2 style="margin:0; color:#4c1d95; font-size:24px;">🔮 Proyección de Compromisos (Cash Flow)</h2>
                <p style="margin:0; color:#64748b; font-size:14px;">Egresos (incluye mercancía de consignación ya vendida) contra ingresos esperados.</p>
            </div>
            <button onclick="renderAnalisisRiesgoCartera()" style="padding:10px 15px; background:#e2e8f0; color:#475569; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">⬅️ Volver a ARC</button>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:20px;">
            <div style="padding:15px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px;">
                <h4 style="margin:0 0 10px 0; color:#0f172a;">⚙️ Configuración de Deudas</h4>
                <div style="max-height:120px; overflow-y:auto; padding-right:10px;">
                    ${trProveedoresHTML || '<div style="font-size:12px; color:#94a3b8;">No hay deudas a proveedores abiertas.</div>'}
                </div>
            </div>
            <div style="padding:15px; background:#fff1f2; border:1px solid #fda4af; border-radius:8px;">
                <h4 style="margin:0 0 10px 0; color:#be123c;">🚨 Alerta: Consignación Ya Vendida (Por Pagar)</h4>
                <p style="font-size:11px; color:#9f1239; margin-bottom:10px;">Esta mercancía ya salió de tu inventario. El sistema te la exige en los compromisos de este mes porque no se la has pagado al proveedor.</p>
                <div style="max-height:80px; overflow-y:auto; padding-right:10px;">
                    ${trConsignacionHTML || '<div style="font-size:12px; color:#10b981;">✅ Toda la mercancía vendida de consignación ya está pagada.</div>'}
                </div>
            </div>
        </div>

        <div style="overflow-x:auto;">
            <table style="width:100%; min-width:800px; border-collapse:collapse;">
                <thead>
                    <tr>
                        <th style="padding:15px; background:#f1f5f9; text-align:left; border-bottom:2px solid #cbd5e1; width:250px;">Concepto</th>
                        ${mesesProyeccion.map(m => `<th style="padding:15px; background:#f8fafc; text-align:center; border-bottom:2px solid #cbd5e1; color:#0f172a; font-weight:900;">${m.label}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    <tr><td colspan="${mesesProyeccion.length + 1}" style="background:#fff1f2; color:#be123c; font-weight:bold; padding:10px 15px; font-size:14px;">🔻 COMPROMISOS (Lo que debes pagar)</td></tr>
                    <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:10px 15px; font-weight:bold; color:#475569; font-size:12px;">Tarjetas de Crédito MSI</td>
                        ${mesesProyeccion.map(m => `<td style="padding:10px; text-align:center; color:#dc2626; font-weight:bold;">${fmt(m.egresos.tdc)}</td>`).join('')}
                    </tr>
                    <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:10px 15px; font-weight:bold; color:#475569; font-size:12px;">Cuentas Proveedores (Normales)</td>
                        ${mesesProyeccion.map(m => `<td style="padding:10px; text-align:center; color:#dc2626; font-weight:bold;">${fmt(m.egresos.proveedores)}</td>`).join('')}
                    </tr>
                    <tr style="border-bottom:1px solid #e2e8f0; background:#fff5f5;">
                        <td style="padding:10px 15px; font-weight:bold; color:#be123c; font-size:12px;">Consignación ya Vendida (Exigible)</td>
                        ${mesesProyeccion.map(m => `<td style="padding:10px; text-align:center; color:#be123c; font-weight:bold;">${fmt(m.egresos.consignacionVendida)}</td>`).join('')}
                    </tr>
                    <tr style="border-bottom:2px solid #cbd5e1; background:#f8fafc;">
                        <td style="padding:10px 15px; font-weight:900; color:#0f172a; font-size:13px;">(=) TOTAL COMPROMISOS</td>
                        ${mesesProyeccion.map(m => {
                            const tot = m.egresos.tdc + m.egresos.proveedores + m.egresos.consignacionVendida;
                            return `<td style="padding:10px; text-align:center; color:#be123c; font-weight:900;">${fmt(tot)}</td>`;
                        }).join('')}
                    </tr>

                    <tr><td colspan="${mesesProyeccion.length + 1}" style="background:#f0fdf4; color:#15803d; font-weight:bold; padding:10px 15px; font-size:14px; margin-top:10px;">🟢 COBRANZA ESPERADA (Según Nivel de Riesgo)</td></tr>
                    <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:10px 15px; font-weight:bold; color:#16a34a; font-size:12px;">Cobranza Segura (Cartera Sana)</td>
                        ${mesesProyeccion.map(m => `<td style="padding:10px; text-align:center; color:#16a34a;">${fmt(m.ingresos.sano)}</td>`).join('')}
                    </tr>
                    <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:10px 15px; font-weight:bold; color:#d97706; font-size:12px;">Cobranza Probable (Riesgo Medio)</td>
                        ${mesesProyeccion.map(m => `<td style="padding:10px; text-align:center; color:#d97706;">${fmt(m.ingresos.medio)}</td>`).join('')}
                    </tr>
                    <tr style="border-bottom:1px solid #e2e8f0;">
                        <td style="padding:10px 15px; font-weight:bold; color:#dc2626; font-size:12px;">Cobranza Difícil (Alto Riesgo)</td>
                        ${mesesProyeccion.map(m => `<td style="padding:10px; text-align:center; color:#dc2626;">${fmt(m.ingresos.alto)}</td>`).join('')}
                    </tr>

                    <tr><td colspan="${mesesProyeccion.length + 1}" style="background:#eff6ff; color:#1d4ed8; font-weight:bold; padding:10px 15px; font-size:14px;">⚖️ ESCENARIOS DE LIQUIDEZ (Con qué dinero contarás)</td></tr>
                    <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:15px; font-size:12px;"><b style="color:#16a34a;">Escenario Optimista</b><br><small style="color:#64748b;">(Pagan todos: Sanos + Medios + Altos)</small></td>
                        ${mesesProyeccion.map(m => {
                            const dif = (m.ingresos.sano + m.ingresos.medio + m.ingresos.alto) - (m.egresos.tdc + m.egresos.proveedores + m.egresos.consignacionVendida);
                            return `<td style="padding:15px; text-align:center; font-weight:900; color:${dif >= 0 ? '#16a34a' : '#dc2626'};">${fmt(dif)}</td>`;
                        }).join('')}
                    </tr>
                    <tr style="border-bottom:1px solid #f1f5f9; background:#f8fafc;">
                        <td style="padding:15px; font-size:12px;"><b style="color:#d97706;">Escenario Realista</b><br><small style="color:#64748b;">(Solo te pagan los Sanos y Medios)</small></td>
                        ${mesesProyeccion.map(m => {
                            const dif = (m.ingresos.sano + m.ingresos.medio) - (m.egresos.tdc + m.egresos.proveedores + m.egresos.consignacionVendida);
                            return `<td style="padding:15px; text-align:center; font-weight:900; color:${dif >= 0 ? '#d97706' : '#dc2626'};">${fmt(dif)}</td>`;
                        }).join('')}
                    </tr>
                    <tr>
                        <td style="padding:15px; font-size:12px;"><b style="color:#dc2626;">Escenario Conservador (Estrés)</b><br><small style="color:#64748b;">(Solo te pagan los clientes súper Sanos)</small></td>
                        ${mesesProyeccion.map(m => {
                            const dif = m.ingresos.sano - (m.egresos.tdc + m.egresos.proveedores + m.egresos.consignacionVendida);
                            return `<td style="padding:15px; text-align:center; font-weight:900; color:${dif >= 0 ? '#0f172a' : '#dc2626'}; background:${dif < 0 ? '#fff1f2' : 'transparent'};">${fmt(dif)}</td>`;
                        }).join('')}
                    </tr>
                </tbody>
            </table>
        </div>
    </div>`;

    contenedor.innerHTML = html;
};

// Expose to global scope
window.renderReporteVentas = renderReporteVentas;
window.exportarReporteVentas = exportarReporteVentas;
window.renderReporteCompras = renderReporteCompras;
window.exportarReporteCompras = exportarReporteCompras;
window.renderReporteFlujo = renderReporteFlujo;
window.exportarReporteFlujo = exportarReporteFlujo;
window._kpiCard = _kpiCard;
window._tablaHTML = _tablaHTML;
window._csvDescargar = _csvDescargar;
