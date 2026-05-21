// =====================================================================
// 📊 MÓDULO CENTRAL DE REPORTES CONTABLES Y FLUJO DE CAJA
// Estructura Unificada, Auditada y Saneada (Sin Duplicidades)
// =====================================================================

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

// ─── 1. REPORTE DE VENTAS ────────────────────────────────────────────
window.renderReporteVentas = function() {
    const contenedor = document.getElementById("reportes") || document.getElementById("reportes-contenido") || document.getElementById("dashboardContenido");
    if (!contenedor) return;

    const ventas = StorageService.get("ventasRegistradas", []);
    const fmt = v => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v || 0);

    let totalVendido = 0;
    let totalEnganches = 0;
    let filas = [];

    ventas.forEach(v => {
        if(v.estado === 'Cancelada' || v.estatus === 'Cancelada') return;
        const total = parseFloat(v.total) || 0;
        const eng = parseFloat(v.enganche) || 0;
        totalVendido += total;
        totalEnganches += eng;

        filas.push([
            v.folio || '-',
            v.fecha || '-',
            v.clienteNombre || 'Público General',
            `<span style="text-transform:uppercase; font-weight:bold; color:#4a5568;">${v.metodoPago || 'contado'}</span>`,
            `<b style="color:#1e3a8a;">${fmt(total)}</b>`,
            `<span style="color:#16a34a;">${fmt(eng)}</span>`
        ]);
    });

    let html = `
    <div style="background:white; padding:20px; border-radius:12px; box-shadow:0 4px 6px rgba(0,0,0,0.02); margin-top:15px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <h3 style="margin:0; color:#1e293b;">📋 Reporte Histórico de Ventas</h3>
            <button onclick="exportarReporteVentas()" style="padding:8px 16px; background:#1e3a8a; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:12px;">📊 Exportar CSV</button>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:25px;">
            ${_kpiCard("Volumen Total Comercializado", fmt(totalVendido), "#1e3a8a", "🛒")}
            ${_kpiCard("Liquidaciones e Inicios (Caja)", fmt(totalEnganches), "#16a34a", "💵")}
        </div>
        <div style="overflow-x:auto;">
            ${_tablaHTML(["Folio", "Fecha", "Cliente", "Método", "Valor Total", "Enganche/Cobrado"], filas)}
        </div>
    </div>`;
    contenedor.innerHTML = html;
};

window.exportarReporteVentas = function() {
    const ventas = StorageService.get("ventasRegistradas", []);
    let csv = "Folio,Fecha,Cliente,Metodo,Total,Enganche\n";
    ventas.forEach(v => {
        if(v.estado === 'Cancelada' || v.estatus === 'Cancelada') return;
        csv += `"${v.folio || ''}","${v.fecha || ''}","${v.clienteNombre || 'Publico General'}","${v.metodoPago || 'contado'}",${v.total || 0},${v.enganche || 0}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `reporte_ventas_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// ─── 2. REPORTE DE COMPRAS Y RECEPCIONES ─────────────────────────────
window.renderReporteCompras = function() {
    const contenedor = document.getElementById("reportes") || document.getElementById("reportes-contenido") || document.getElementById("dashboardContenido");
    if (!contenedor) return;

    const ocs = StorageService.get("ordenesCompra", []);
    const cds = StorageService.get("compras", []);
    const fmt = v => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v || 0);

    let totalInvertido = 0;
    let filas = [];

    ocs.forEach(o => {
        if (o.estado === 'Cancelada') return;
        const t = parseFloat(o.total) || 0;
        totalInvertido += t;
        filas.push([o.folio || '-', o.fechaEmision || o.fecha || '-', o.proveedorNombre || '-', 'Orden de Compra', fmt(t), o.estado || 'Pendiente']);
    });

    cds.forEach(c => {
        const t = parseFloat(c.total) || 0;
        totalInvertido += t;
        filas.push([c.folio || c.id || '-', c.fecha || '-', c.proveedor || '-', 'Compra Directa', fmt(t), 'Recibido']);
    });

    let html = `
    <div style="background:white; padding:20px; border-radius:12px; box-shadow:0 4px 6px rgba(0,0,0,0.02); margin-top:15px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <h3 style="margin:0; color:#1e293b;">📦 Historial de Abastecimiento (Compras)</h3>
            <button onclick="exportarReporteCompras()" style="padding:8px 16px; background:#0f766e; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:12px;">📊 Exportar CSV</button>
        </div>
        <div style="margin-bottom:25px;">
            ${_kpiCard("Total de Inversión Registrada", fmt(totalInvertido), "#0f766e", "🏭")}
        </div>
        <div style="overflow-x:auto;">
            ${_tablaHTML(["Folio", "Fecha", "Proveedor", "Tipo", "Monto Total", "Estatus"], filas)}
        </div>
    </div>`;
    contenedor.innerHTML = html;
};

window.exportarReporteCompras = function() {
    const ocs = StorageService.get("ordenesCompra", []);
    const cds = StorageService.get("compras", []);
    let csv = "Folio,Fecha,Proveedor,Tipo,Total,Estatus\n";
    
    ocs.forEach(o => {
        if (o.estado === 'Cancelada') return;
        csv += `"${o.folio || ''}","${o.fechaEmision || o.fecha || ''}","${o.proveedorNombre || ''}","Orden de Compra",${o.total || 0},"${o.estado || ''}"\n`;
    });
    cds.forEach(c => {
        csv += `"${c.folio || c.id || ''}","${c.fecha || ''}","${c.proveedor || ''}","Compra Directa",${c.total || 0},"Recibido"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `reporte_compras_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// ─── 3. PROYECCIÓN DE COMPROMISOS (CASH FLOW ORIGINAL) ───────────────
window.renderReporteCompromisos = function() {
    const contenedor = document.getElementById("reportes") || document.getElementById("reportes-contenido") || document.getElementById("dashboardContenido");
    if (!contenedor) return;

    const fmt = (v) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v || 0);
    const hoy = new Date();
    
    const mesesProyeccion = [];
    for(let i = 0; i < 6; i++) {
        let d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
        mesesProyeccion.push({
            key: `${d.getFullYear()}-${d.getMonth()}`,
            label: new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(d).toUpperCase(),
            ingresos: { sano: 0, regular: 0, moroso: 0, total: 0 },
            egresos: { tdc: 0, proveedores: 0, consignacionVendida: 0 }
        });
    }

    // 📥 INGRESOS: Distribución de Pagarés Activos (Lógica SNE)
    const pagares = StorageService.get("pagaresSistema", []);
    const clientes = StorageService.get("clientes", []);
    
    pagares.forEach(p => {
        if (p.estado === "Pagado" || p.estado === "Cancelado") return;
        
        const montoRestante = p.estado === "Parcial" ? Math.max(0, (p.monto || 0) - (p.montoAbonado || 0)) : (p.monto || 0);
        if (montoRestante <= 0) return;

        const cliente = clientes.find(c => c.id === p.clienteId || c.nombre === p.clienteNombre) || {};
        const score = cliente.comportamientoPago || "SANO";

        const fVenc = new Date(p.fechaVencimiento);
        let mesDestino = mesesProyeccion.find(m => m.key === `${fVenc.getFullYear()}-${fVenc.getMonth()}`);
        
        if (!mesDestino) {
            mesDestino = fVenc < hoy ? mesesProyeccion[0] : mesesProyeccion[5];
        }

        if (score === "SANO") mesDestino.ingresos.sano += montoRestante;
        else if (score === "REGULAR") mesDestino.ingresos.regular += montoRestante;
        else mesDestino.ingresos.moroso += montoRestante;
        
        mesDestino.ingresos.total += montoRestante;
    });

    // 📤 EGRESOS: Tarjetas de Crédito (MSI)
    const cuentasMSI = StorageService.get("cuentasMSI", []);
    cuentasMSI.forEach(msi => {
        (msi.calendario || []).forEach(pago => {
            if (pago.estado !== 'Pagado') {
                const fPago = new Date(pago.fecha + 'T12:00:00');
                const key = `${fPago.getFullYear()}-${fPago.getMonth()}`;
                let mesDestino = mesesProyeccion.find(m => m.key === key);
                if (!mesDestino) {
                    mesDestino = fPago < hoy ? mesesProyeccion[0] : mesesProyeccion[5];
                }
                mesDestino.egresos.tdc += parseFloat(pago.monto || 0);
            }
        });
    });

    // 📤 EGRESOS: Cuentas por Pagar e Inventario de Consignación Vendido (FIFO)
    const ocs = StorageService.get("ordenesCompra", []);
    const comprasDirectas = StorageService.get("compras", []);
    const ventas = StorageService.get("ventasRegistradas", []);
    
    let inventarioEntrante = [];
    ocs.forEach(oc => { if (oc.estado !== 'Cancelada') inventarioEntrante.push({ origen: 'OC', idOriginal: oc.id, folio: oc.folio, proveedor: oc.proveedorNombre, fechaMs: new Date(oc.fechaEmision || oc.fecha).getTime(), esConsignacion: !!oc.esConsignacion, articulos: oc.articulos || [], total: oc.total || 0, saldoPendiente: oc.saldoPendiente !== undefined ? oc.saldoPendiente : oc.total, estado: oc.estado }); });
    comprasDirectas.forEach(cd => { inventarioEntrante.push({ origen: 'CD', idOriginal: cd.id, folio: cd.folio || cd.id, proveedor: cd.proveedor, fechaMs: new Date(cd.fechaISO || cd.fecha).getTime(), esConsignacion: cd.metodoPago === 'consignacion', articulos: cd.articulos || [], total: cd.total || 0, saldoPendiente: (cd.total || 0) - (cd.pagado || 0), estado: 'Pagada' }); });
    inventarioEntrante.sort((a, b) => a.fechaMs - b.fechaMs);

    let ventasPorProducto = {};
    ventas.forEach(v => {
        if(v.estado === 'Cancelada' || v.estatus === 'Cancelada') return;
        (v.articulos || []).forEach(art => {
            let pid = String(art.id || art.productoId);
            ventasPorProducto[pid] = (ventasPorProducto[pid] || 0) + (parseFloat(art.cantidad) || 1);
        });
    });

    inventarioEntrante.forEach(entrada => {
        let valorVendidoDeEstaEntrada = 0;
        entrada.articulos.forEach(art => {
            let pid = String(art.productoId || art.id);
            let cantComprada = parseFloat(art.cantidad) || 1;
            if (ventasPorProducto[pid] && ventasPorProducto[pid] > 0) {
                let cantTomada = Math.min(cantComprada, ventasPorProducto[pid]);
                ventasPorProducto[pid] -= cantTomada; 
                valorVendidoDeEstaEntrada += cantTomada * (parseFloat(art.costo) || 0);
            }
        });

        const totalPagadoAEntrada = entrada.total - entrada.saldoPendiente;

        if (entrada.esConsignacion) {
            let deudaRealConsignacion = valorVendidoDeEstaEntrada - totalPagadoAEntrada;
            if (deudaRealConsignacion > 0 && entrada.saldoPendiente > 0) {
                deudaRealConsignacion = Math.min(deudaRealConsignacion, entrada.saldoPendiente);
                mesesProyeccion[0].egresos.consignacionVendida += deudaRealConsignacion;
            }
        } else {
            if (entrada.origen === 'OC' && entrada.estado !== 'Pagada' && entrada.saldoPendiente > 0) {
                mesesProyeccion[0].egresos.proveedores += parseFloat(entrada.saldoPendiente);
            }
        }
    });

    let html = `
    <div style="background:white; padding:20px; border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.05); margin-top:15px; margin-bottom:30px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #e2e8f0; padding-bottom:15px; margin-bottom:20px;">
            <div>
                <h2 style="margin:0; color:#4c1d95; font-size:24px;">🔮 Proyección de Compromisos (Cash Flow)</h2>
                <p style="margin:0; color:#64748b; font-size:14px;">Egresos (incluye mercancía de consignación ya vendida) contra ingresos esperados.</p>
            </div>
            <div style="display:flex; gap:10px;">
                <button onclick="renderReporteLiquidezCortoPlazo()" style="padding:10px 15px; background:#059669; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; box-shadow:0 4px 6px rgba(5,150,105,0.2);">💧 Evaluar Liquidez (Runway)</button>
                <button onclick="renderAnalisisRiesgoCartera()" style="padding:10px 15px; background:#e2e8f0; color:#475569; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">⬅️ Volver a ARC</button>
            </div>
        </div>

        <div style="overflow-x:auto;">
            <table style="width:100%; min-width:850px; border-collapse:collapse; font-size:13px;">
                <thead>
                    <tr style="background:#f8fafc; border-bottom:2px solid #cbd5e1;">
                        <th style="padding:15px; text-align:left; font-size:14px; width:220px;">Concepto Flujo de Caja</th>
                        ${mesesProyeccion.map(m => `<th style="padding:15px; text-align:center; font-size:13px; color:#1e1b4b;">${m.label}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    <tr><td colspan="${mesesProyeccion.length + 1}" style="background:#f0fdf4; color:#16a34a; font-weight:bold; padding:8px 15px;">(+) Ingresos Esperados por Cobranza (SNE)</td></tr>
                    <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:10px 15px; padding-left:25px; color:#475569;">Clientes Cumplidos (Sanos)</td>
                        ${mesesProyeccion.map(m => `<td style="padding:10px; text-align:center; color:#16a34a; font-weight:bold;">${fmt(m.ingresos.sano)}</td>`).join('')}
                    </tr>
                    <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:10px 15px; padding-left:25px; color:#475569;">Clientes Promesa (Regulares)</td>
                        ${mesesProyeccion.map(m => `<td style="padding:10px; text-align:center; color:#eab308;">${fmt(m.ingresos.regular)}</td>`).join('')}
                    </tr>
                    <tr style="border-bottom:1px solid #cbd5e1;">
                        <td style="padding:10px 15px; padding-left:25px; color:#475569;">Cartera Vencida (Morosos)</td>
                        ${mesesProyeccion.map(m => `<td style="padding:10px; text-align:center; color:#dc2626;">${fmt(m.ingresos.moroso)}</td>`).join('')}
                    </tr>
                    <tr style="background:#f0fdf4; border-bottom:2px solid #cbd5e1; font-weight:bold;">
                        <td style="padding:12px 15px;">TOTAL COBRANZA PROYECTADA</td>
                        ${mesesProyeccion.map(m => `<td style="padding:12px; text-align:center; color:#15803d; font-size:14px;">${fmt(m.ingresos.total)}</td>`).join('')}
                    </tr>

                    <tr><td colspan="${mesesProyeccion.length + 1}" style="background:#fff1f2; color:#be123c; font-weight:bold; padding:8px 15px;">(-) Egresos Ineludibles Comprometidos</td></tr>
                    <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:10px 15px; padding-left:25px; color:#475569;">Financiamientos Bancarios (MSI)</td>
                        ${mesesProyeccion.map(m => `<td style="padding:10px; text-align:center; color:#dc2626;">${fmt(m.egresos.tdc)}</td>`).join('')}
                    </tr>
                    <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:10px 15px; padding-left:25px; color:#475569;">Cuentas por Pagar (Proveedores)</td>
                        ${mesesProyeccion.map(m => `<td style="padding:10px; text-align:center; color:#dc2626;">${fmt(m.egresos.proveedores)}</td>`).join('')}
                    </tr>
                    <tr style="border-bottom:2px solid #cbd5e1;">
                        <td style="padding:10px 15px; padding-left:25px; color:#be123c; font-weight:bold;">Consignación Vendida (Por Liquidar)</td>
                        ${mesesProyeccion.map(m => `<td style="padding:10px; text-align:center; color:#be123c; font-weight:bold;">${fmt(m.egresos.consignacionVendida)}</td>`).join('')}
                    </tr>

                    <tr style="background:#f8fafc; border-bottom:2px solid #cbd5e1; font-weight:bold;">
                        <td style="padding:15px; font-size:14px; color:#0f172a;">📊 BALANCE NETO DEL MES (Flujo)</td>
                        ${mesesProyeccion.map(m => {
                            const dif = m.ingresos.total - (m.egresos.tdc + m.egresos.proveedores + m.egresos.consignacionVendida);
                            return `<td style="padding:15px; text-align:center; font-weight:900; color:${dif >= 0 ? '#16a34a' : '#dc2626'}; font-size:14px;">${fmt(dif)}</td>`;
                        }).join('')}
                    </tr>
                </tbody>
            </table>
        </div>
    </div>`;

    contenedor.innerHTML = html;
};

// ─── 4. REPORTE DE LIQUIDEZ A CORTO PLAZO (RUNWAY CON TOOLTIPS) ──────
window.renderReporteLiquidezCortoPlazo = function() {
    const contenedor = document.getElementById("reportes") || document.getElementById("reportes-contenido") || document.getElementById("dashboardContenido");
    if (!contenedor) return;

    const fmt = (v) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v || 0);
    const hoy = new Date();
    
    // 1. OBTENER LIQUIDEZ REAL (EFECTIVO + BANCARIA)
    const tarjetas = StorageService.get("tarjetasConfig", []);
    const movimientos = StorageService.get("movimientosCaja", []);
    const cajas = StorageService.get("cuentasEfectivo", [{ id: "efectivo", nombre: "💵 Efectivo Principal", saldo: 0 }]);

    const saldos = {};
    cajas.forEach(c => saldos[c.id] = 0);
    tarjetas.filter(t => t.tipo === "debito").forEach(t => saldos[t.banco] = parseFloat(t.saldoInicial) || 0);

    movimientos.forEach(m => {
        const esIngreso = m.tipo === "ingreso" || m.tipo === "Ingreso";
        const monto = parseFloat(m.monto) || 0;
        const idCajaAfectada = (m.cuenta === "efectivo" || m.cuenta === "caja") ? "efectivo" : m.cuenta;
        if(saldos[idCajaAfectada] !== undefined) {
            saldos[idCajaAfectada] += esIngreso ? monto : -monto;
        } else if (saldos[m.cuenta] !== undefined) {
            saldos[m.cuenta] += esIngreso ? monto : -monto;
        }
    });

    const liquidezTotalInicial = Object.values(saldos).reduce((sum, s) => sum + s, 0);

    // 2. CONSTRUCCIÓN DE MESES DE ANÁLISIS
    const mesesProyeccion = [];
    for(let i = 0; i < 6; i++) {
        let d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
        mesesProyeccion.push({
            key: `${d.getFullYear()}-${d.getMonth()}`,
            label: new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(d).toUpperCase(),
            egresos: { tdc: 0, proveedores: 0, consignacionVendida: 0 },
            desglose: { tdc: {}, proveedores: {}, consignacionVendida: {} },
            liquidezInicial: 0,
            totalEgresos: 0,
            liquidezFinal: 0
        });
    }

    // 3. MAPEO DE CARGOS MSI BANCARIOS
    const cuentasMSI = StorageService.get("cuentasMSI", []);
    cuentasMSI.forEach(msi => {
        (msi.calendario || []).forEach(pago => {
            if (pago.estado !== 'Pagado') {
                const fPago = new Date(pago.fecha + 'T12:00:00');
                const key = `${fPago.getFullYear()}-${fPago.getMonth()}`;
                let mesDestino = mesesProyeccion.find(m => m.key === key) || mesesProyeccion[0]; 
                mesDestino.egresos.tdc += parseFloat(pago.monto || 0);
                mesDestino.desglose.tdc[msi.banco] = (mesDestino.desglose.tdc[msi.banco] || 0) + parseFloat(pago.monto || 0);
            }
        });
    });

    // 4. MAPEO DE COMPROMISOS CON PROVEEDORES (LÓGICA FIFO ORIGINAL)
    const ocs = StorageService.get("ordenesCompra", []);
    const comprasDirectas = StorageService.get("compras", []);
    const ventas = StorageService.get("ventasRegistradas", []);
    
    let inventarioEntrante = [];
    ocs.forEach(oc => { if (oc.estado !== 'Cancelada') inventarioEntrante.push({ origen: 'OC', idOriginal: oc.id, folio: oc.folio, proveedor: oc.proveedorNombre, fechaMs: new Date(oc.fechaEmision || oc.fecha).getTime(), esConsignacion: !!oc.esConsignacion, articulos: oc.articulos || [], total: oc.total || 0, saldoPendiente: oc.saldoPendiente !== undefined ? oc.saldoPendiente : oc.total, estado: oc.estado }); });
    comprasDirectas.forEach(cd => { inventarioEntrante.push({ origen: 'CD', idOriginal: cd.id, folio: cd.folio || cd.id, proveedor: cd.proveedor, fechaMs: new Date(cd.fechaISO || cd.fecha).getTime(), esConsignacion: cd.metodoPago === 'consignacion', articulos: cd.articulos || [], total: cd.total || 0, saldoPendiente: (cd.total || 0) - (cd.pagado || 0), estado: 'Pagada' }); });
    inventarioEntrante.sort((a, b) => a.fechaMs - b.fechaMs);

    let ventasPorProducto = {};
    ventas.forEach(v => {
        if(v.estado === 'Cancelada' || v.estatus === 'Cancelada') return;
        (v.articulos || []).forEach(art => {
            let pid = String(art.id || art.productoId);
            ventasPorProducto[pid] = (ventasPorProducto[pid] || 0) + (parseFloat(art.cantidad) || 1);
        });
    });

    inventarioEntrante.forEach(entrada => {
        let valorVendidoDeEstaEntrada = 0;
        entrada.articulos.forEach(art => {
            let pid = String(art.productoId || art.id);
            let cantComprada = parseFloat(art.cantidad) || 1;
            if (ventasPorProducto[pid] && ventasPorProducto[pid] > 0) {
                let cantTomada = Math.min(cantComprada, ventasPorProducto[pid]);
                ventasPorProducto[pid] -= cantTomada; 
                valorVendidoDeEstaEntrada += cantTomada * (parseFloat(art.costo) || 0);
            }
        });

        const totalPagadoAEntrada = entrada.total - entrada.saldoPendiente;

        if (entrada.esConsignacion) {
            let deudaRealConsignacion = valorVendidoDeEstaEntrada - totalPagadoAEntrada;
            if (deudaRealConsignacion > 0 && entrada.saldoPendiente > 0) {
                deudaRealConsignacion = Math.min(deudaRealConsignacion, entrada.saldoPendiente);
                mesesProyeccion[0].egresos.consignacionVendida += deudaRealConsignacion;
                mesesProyeccion[0].desglose.consignacionVendida[entrada.proveedor] = (mesesProyeccion[0].desglose.consignacionVendida[entrada.proveedor] || 0) + deudaRealConsignacion;
            }
        } else {
            if (entrada.origen === 'OC' && entrada.estado !== 'Pagada' && entrada.saldoPendiente > 0) {
                mesesProyeccion[0].egresos.proveedores += parseFloat(entrada.saldoPendiente);
                mesesProyeccion[0].desglose.proveedores[entrada.proveedor] = (mesesProyeccion[0].desglose.proveedores[entrada.proveedor] || 0) + parseFloat(entrada.saldoPendiente);
            }
        }
    });

    // 5. CÁLCULO EN CASCADA DE MESES DE COBERTURA
    let liquidezArrastrada = liquidezTotalInicial;
    let mesesCubiertos = 0;

    mesesProyeccion.forEach(m => {
        m.liquidezInicial = liquidezArrastrada;
        m.totalEgresos = m.egresos.tdc + m.egresos.proveedores + m.egresos.consignacionVendida;
        m.liquidezFinal = m.liquidezInicial - m.totalEgresos;

        if (m.liquidezFinal >= 0) {
            mesesCubiertos++;
        } else if (m.liquidezInicial > 0 && m.totalEgresos > 0) {
            mesesCubiertos += (m.liquidezInicial / m.totalEgresos);
        }
        liquidezArrastrada = m.liquidezFinal;
    });

    const formatTooltip = (obj) => {
        const str = Object.entries(obj).map(([k, v]) => `${k}: ${fmt(v)}`).join('\n');
        return str || 'Sin cargos asignados';
    };

    // 6. RENDER INTERFAZ GRÁFICA DE LIQUIDEZ
    let html = `
    <div style="background:white; padding:20px; border-radius:12px; box-shadow:0 10px 25px rgba(0,0,0,0.05); margin-top:15px; margin-bottom:30px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #e2e8f0; padding-bottom:15px; margin-bottom:20px;">
            <div>
                <h2 style="margin:0; color:#065f46; font-size:24px;">💧 Valuación de Liquidez (Runway Financiero)</h2>
                <p style="margin:0; color:#64748b; font-size:14px;">Diagnóstico de supervivencia contable usando únicamente tu capital en cuentas.</p>
            </div>
            <button onclick="window.renderReporteCompromisos()" style="padding:10px 15px; background:#e2e8f0; color:#475569; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">⬅️ Volver a Cash Flow</button>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:15px; margin-bottom:20px;">
            <div style="padding:20px; background:linear-gradient(135deg, #10b981, #059669); color:white; border-radius:12px; box-shadow:0 4px 6px rgba(16,185,129,0.3);">
                <div style="font-size:11px; font-weight:bold; opacity:0.9;">EFECTIVO + DÉBITO DISPONIBLE</div>
                <div style="font-size:30px; font-weight:900; margin-top:5px;">${fmt(liquidezTotalInicial)}</div>
                <div style="font-size:11px; margin-top:5px;">Fondos líquidos consolidados en caja y bancos.</div>
            </div>
            <div style="padding:20px; background:linear-gradient(135deg, #3b82f6, #2563eb); color:white; border-radius:12px; box-shadow:0 4px 6px rgba(59,130,246,0.3);">
                <div style="font-size:11px; font-weight:bold; opacity:0.9;">PISTA DE SURVIVAL (RUNWAY)</div>
                <div style="font-size:30px; font-weight:900; margin-top:5px;">${mesesCubiertos.toFixed(1)} Meses</div>
                <div style="font-size:11px; margin-top:5px;">Meses de cobertura sin depender de nuevas cobranzas.</div>
            </div>
            <div style="padding:20px; background:#fff1f2; border:1px solid #fda4af; border-radius:12px;">
                <div style="font-size:11px; font-weight:bold; color:#be123c;">COMPROMISOS CORRIENTES (MES 1)</div>
                <div style="font-size:30px; font-weight:900; color:#be123c; margin-top:5px;">${fmt(mesesProyeccion[0].totalEgresos)}</div>
                <div style="font-size:11px; color:#9f1239; margin-top:5px;">Suma de pasivos inmediatos por liquidar.</div>
            </div>
        </div>

        <div style="overflow-x:auto;">
            <table style="width:100%; min-width:850px; border-collapse:collapse; font-size:13px;">
                <thead>
                    <tr>
                        <th style="padding:15px; background:#f1f5f9; text-align:left; border-bottom:2px solid #cbd5e1; width:260px;">Cascada de Amortización</th>
                        ${mesesProyeccion.map(m => `<th style="padding:15px; background:#f8fafc; text-align:center; border-bottom:2px solid #cbd5e1; color:#0f172a; font-weight:bold;">${m.label}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    <tr style="background:#f0fdf4;">
                        <td style="padding:12px 15px; font-weight:bold; color:#16a34a; padding-left:15px;">💰 LIQUIDEZ INICIAL DISPONIBLE</td>
                        ${mesesProyeccion.map((m, idx) => {
                            // Para el primer mes mostramos los saldos reales de cuentas, filtrando las que están en ceros
                            const tooltip = idx === 0 
                                ? formatTooltip(Object.fromEntries(Object.entries(saldos).filter(([k,v]) => Math.abs(v) > 0.01))) 
                                : `Remanente arrastrado de ${mesesProyeccion[idx-1].label}`;
                            return `<td title="${tooltip}" style="padding:12px; text-align:center; color:#16a34a; font-weight:bold; font-size:14px; cursor:help; border-bottom:1px dotted #86efac;">${fmt(m.liquidezInicial)}</td>`;
                        }).join('')}
                    </tr>
                    
                    <tr><td colspan="${mesesProyeccion.length + 1}" style="background:#fff1f2; color:#be123c; font-weight:bold; padding:8px 15px; font-size:12px; border-top:1px solid #fda4af;">(-) Egresos Ineludibles (Pasa el cursor para ver origen)</td></tr>
                    
                    <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:10px 15px; color:#475569; padding-left:25px;">Egresos Tarjetas Bancarias (MSI)</td>
                        ${mesesProyeccion.map(m => `<td title="${formatTooltip(m.desglose.tdc)}" style="padding:10px; text-align:center; color:#dc2626; cursor:help; border-bottom:1px dotted #cbd5e1;">${fmt(m.egresos.tdc)}</td>`).join('')}
                    </tr>
                    <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:10px 15px; color:#475569; padding-left:25px;">Proveedores Comerciales</td>
                        ${mesesProyeccion.map(m => `<td title="${formatTooltip(m.desglose.proveedores)}" style="padding:10px; text-align:center; color:#dc2626; cursor:help; border-bottom:1px dotted #cbd5e1;">${fmt(m.egresos.proveedores)}</td>`).join('')}
                    </tr>
                    <tr style="border-bottom:2px solid #cbd5e1;">
                        <td style="padding:10px 15px; color:#be123c; font-weight:bold; padding-left:25px;">Consignación de Producto Vendido</td>
                        ${mesesProyeccion.map(m => `<td title="${formatTooltip(m.desglose.consignacionVendida)}" style="padding:10px; text-align:center; color:#be123c; cursor:help; border-bottom:1px dotted #cbd5e1; font-weight:bold;">${fmt(m.egresos.consignacionVendida)}</td>`).join('')}
                    </tr>

                    <tr style="background:#eff6ff; border-bottom:2px solid #cbd5e1;">
                        <td style="padding:14px 15px; font-weight:900; color:#1e40af; font-size:13px;">(=) LIQUIDEZ DISPONIBLE AL CIERRE</td>
                        ${mesesProyeccion.map(m => {
                            const esNegativo = m.liquidezFinal < 0;
                            return `<td style="padding:14px; text-align:center; font-weight:900; font-size:14px; color:${esNegativo ? '#dc2626' : '#1e40af'}; background:${esNegativo ? '#fef2f2' : 'transparent'};">${fmt(m.liquidezFinal)}</td>`;
                        }).join('')}
                    </tr>
                </tbody>
            </table>
        </div>
    </div>`;

    contenedor.innerHTML = html;
};

// --- Registro Global de Funciones ---
window.renderReporteVentas = renderReporteVentas;
window.exportarReporteVentas = exportarReporteVentas;
window.renderReporteCompras = renderReporteCompras;
window.exportarReporteCompras = exportarReporteCompras;
window.renderReporteCompromisos = renderReporteCompromisos;
window.renderReporteLiquidezCortoPlazo = renderReporteLiquidezCortoPlazo;