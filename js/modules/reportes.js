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

    // --- CORRECCIÓN: Leer los datos frescos de la base de datos ---
    const cuentasPorCobrar = StorageService.get("cuentasPorCobrar", []);
    const movimientosCaja = StorageService.get("movimientosCaja", []);

    let ventas = [...cuentasPorCobrar];

    const contado = movimientosCaja.filter(m => m.tipo === 'ingreso' && m.referencia === 'Contado');
    const ventasContado = contado.map(m => ({
        folio: m.folio || '-',
        nombre: m.concepto || '-',
        fechaVenta: m.fecha,
        totalContadoOriginal: m.monto,
        metodo: 'contado',
        estado: 'Pagado',
        saldoActual: 0
    }));

    let todas = [...ventas, ...ventasContado];

    if (metodo) todas = todas.filter(v => v.metodo === metodo);
    if (desde) todas = todas.filter(v => v.fechaVenta >= desde);
    if (hasta) todas = todas.filter(v => v.fechaVenta <= hasta + 'T23:59:59');

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
    const filas = todas.map(v => {
        const fecha = v.fechaVenta ? new Date(v.fechaVenta) : null;
        const fechaStr = fecha && !isNaN(fecha) ? fecha.toLocaleDateString('es-MX') : (v.fechaVenta || '-');
        return [
            v.folio || '-',
            v.nombre || '-',
            fechaStr,
            dinero(v.totalContadoOriginal || 0),
            v.metodo || '-',
            v.estado || '-',
            dinero(v.saldoActual || 0)
        ];
    });
    document.getElementById('rvTabla').innerHTML = _tablaHTML(
        ['Folio', 'Cliente', 'Fecha', 'Total', 'Método', 'Estado', 'Saldo'],
        filas.length ? filas : [['Sin registros', '', '', '', '', '', '']]
    );
}

function exportarReporteVentas() {
    // --- CORRECCIÓN: Leer los datos frescos de la base de datos ---
    const cuentasPorCobrar = StorageService.get("cuentasPorCobrar", []);
    const movimientosCaja = StorageService.get("movimientosCaja", []);

    const ventas = [...cuentasPorCobrar];
    const contado = movimientosCaja.filter(m => m.tipo === 'ingreso' && m.referencia === 'Contado')
        .map(m => ({ folio: m.folio || '-', nombre: m.concepto || '-', fechaVenta: m.fecha, totalContadoOriginal: m.monto, metodo: 'contado', estado: 'Pagado', saldoActual: 0 }));
    const todas = [...ventas, ...contado];
    _csvDescargar('reporte-ventas.csv',
        ['Folio', 'Cliente', 'Fecha', 'Total', 'Método', 'Estado', 'Saldo'],
        todas.map(v => [v.folio || '-', v.nombre || '-', v.fechaVenta || '', v.totalContadoOriginal || 0, v.metodo || '-', v.estado || '-', v.saldoActual || 0])
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
        c.fechaISO || c.fecha || '-',
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

// --- Reporte Flujo de Efectivo ---

function renderReporteFlujo() {
    const desde = document.getElementById('rfFechaDesde')?.value;
    const hasta = document.getElementById('rfFechaHasta')?.value;

    // --- CORRECCIÓN: Leer los datos frescos de la base de datos ---
    const movimientosCaja = StorageService.get("movimientosCaja", []);
    let lista = [...movimientosCaja];

    if (desde) lista = lista.filter(m => (m.fecha || '') >= desde);
    if (hasta) lista = lista.filter(m => (m.fecha || '') <= hasta + 'T23:59:59');

    const ingresos = lista.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + Number(m.monto || 0), 0);
    const egresos = lista.filter(m => m.tipo === 'egreso').reduce((s, m) => s + Number(m.monto || 0), 0);
    const saldo = ingresos - egresos;

    document.getElementById('rfKpis').innerHTML =
        _kpiCard('Ingresos', dinero(ingresos), '#27ae60', '⬆️') +
        _kpiCard('Egresos', dinero(egresos), '#e74c3c', '⬇️') +
        _kpiCard('Saldo', dinero(saldo), saldo >= 0 ? '#27ae60' : '#e74c3c', '💵');

    const filas = lista.map(m => {
        const fecha = m.fecha ? new Date(m.fecha) : null;
        const fechaStr = fecha && !isNaN(fecha) ? fecha.toLocaleDateString('es-MX') : '-';
        return [
            m.folio || '-',
            fechaStr,
            m.tipo === 'ingreso' ? '⬆️ Ingreso' : '⬇️ Egreso',
            dinero(m.monto || 0),
            m.concepto || '-',
            m.referencia || '-'
        ];
    });
    document.getElementById('rfTabla').innerHTML = _tablaHTML(
        ['Folio', 'Fecha', 'Tipo', 'Monto', 'Concepto', 'Referencia'],
        filas.length ? filas : [['Sin registros', '', '', '', '', '']]
    );
}

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
