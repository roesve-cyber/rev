// =====================================================================
// 📊 MÓDULO CENTRAL DE REPORTES CONTABLES Y FLUJO DE CAJA
// Estructura Unificada, Auditada y Saneada
// =====================================================================

const fmt = (v) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v || 0);

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
    const contenedor = document.getElementById("reportes") || document.getElementById("dashboardContenido");
    if (!contenedor) return;

    const ventas = StorageService.get("ventasRegistradas", []);
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
    const contenedor = document.getElementById("reportes") || document.getElementById("dashboardContenido");
    if (!contenedor) return;

    const ocs = StorageService.get("ordenesCompra", []);
    const cds = StorageService.get("compras", []);
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

// ─── 3. PROYECCIÓN DE COMPROMISOS (CASH FLOW REAL) ────────
window.renderReporteCompromisos = function() {
    const contenedor = document.getElementById("reportes") || document.getElementById("dashboardContenido");
    if (!contenedor) return;

    const hoy = new Date();
    const mesesProyeccion = [];
    
    for(let i = 0; i < 6; i++) {
        let d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
        mesesProyeccion.push({
            key: `${d.getFullYear()}-${d.getMonth()}`,
            label: new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(d).toUpperCase(),
            ingresos: { sano: 0, regular: 0, moroso: 0, total: 0 },
            egresos: { tdc: 0, proveedores: 0 },
            desglose: { tdc: {}, proveedores: {} }
        });
    }

    // 📥 INGRESOS: Pagarés Activos (Módulo nativo parseFechaMX)
    StorageService.get("pagaresSistema", []).forEach(p => {
        if (p.estado === "Pagado" || p.estado === "Cancelado") return;
        const restante = Math.max(0, (parseFloat(p.monto)||0) - (parseFloat(p.montoAbonado)||0));
        if (restante <= 0) return;

        const fVenc = window.parseFechaMX(p.fechaVencimiento);
        const keyMesVencimiento = `${fVenc.getFullYear()}-${fVenc.getMonth()}`;
        
        let dest = mesesProyeccion.find(m => m.key === keyMesVencimiento);
        
        if (!dest) {
            dest = fVenc < hoy ? mesesProyeccion[0] : mesesProyeccion[5];
        }

        dest.ingresos.sano += restante; // (Simplificado en sano por ahora)
        dest.ingresos.total += restante;
    });

    // 📤 EGRESOS TDC (MSI: usar directamente el mes de pago.fecha sin recalcular)
    StorageService.get("cuentasMSI", []).forEach(msi => {
        (msi.calendario || []).forEach(pago => {
            if (pago.estado !== 'Pagado' && pago.estado !== 'Cancelado') {
                // pago.fecha YA es vencimiento calculado (ej: "2025-02-15"), NO es fecha de compra
                const partes = pago.fecha.split('-');
                const keyMes = `${partes[0]}-${parseInt(partes[1]) - 1}`;
                let dest = mesesProyeccion.find(m => m.key === keyMes);
                if (!dest) {
                    const fPago = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, 1);
                    dest = fPago < hoy ? mesesProyeccion[0] : mesesProyeccion[5];
                }
                
                let saldoReal = Math.max(0, (parseFloat(pago.monto)||0) - (parseFloat(pago.montoAbonado)||0));
                if (saldoReal > 0) {
                    dest.egresos.tdc += saldoReal;
                    dest.desglose.tdc[msi.banco] = (dest.desglose.tdc[msi.banco] || 0) + saldoReal;
                }
            }
        });
    });

    // 📤 EGRESOS CXP (Excluye consignaciones activas - solo CXP reales)
    // PROTECCIÓN: Consignaciones activas NUNCA aparecen como egresos hasta transferirse a CXP
    const consignacionesIdSet = new Set();
    StorageService.get("consignacionesActivas", []).forEach(c => {
        if (c.compraId) consignacionesIdSet.add(c.compraId);
    });
    
    StorageService.get("cuentasPorPagar", []).forEach(cp => {
        const saldo = parseFloat(cp.saldoPendiente || 0);
        // REGLA: Solo incluir si:
        // - Tiene saldo pendiente AND
        // - NO es una consignación activa sin transferencia (esConsignacion: false) AND
        // - Si tiene compraId, verificar que no esté en consignacionesActivas
        if (saldo > 0 && !cp.esConsignacion && !consignacionesIdSet.has(cp.compraId)) {
            const fVenc = window.parseFechaMX(cp.vencimientoIso || cp.vencimiento || cp.fecha);
            const keyMesCXP = `${fVenc.getFullYear()}-${fVenc.getMonth()}`;
            
            let dest = mesesProyeccion.find(m => m.key === keyMesCXP);
            
            if (!dest) {
                dest = fVenc < hoy ? mesesProyeccion[0] : mesesProyeccion[5];
            }
            
            dest.egresos.proveedores += saldo;
            dest.desglose.proveedores[cp.proveedor] = (dest.desglose.proveedores[cp.proveedor] || 0) + saldo;
        }
    });

    const formatTltp = (obj) => Object.entries(obj).map(([k, v]) => `${k}: ${fmt(v)}`).join('\n') || 'Sin desglose';

    let html = `
    <div style="background:white; padding:20px; border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.05); margin-top:15px; margin-bottom:30px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #e2e8f0; padding-bottom:15px; margin-bottom:20px;">
            <div>
                <h2 style="margin:0; color:#4c1d95; font-size:24px;">🔮 Proyección de Compromisos (Cash Flow)</h2>
                <p style="margin:0; color:#64748b; font-size:14px;">Egresos reales (Fechas MX + Regla Bancaria) contra ingresos esperados.</p>
            </div>
            <div style="display:flex; gap:10px;">
                <button onclick="renderReporteLiquidezCortoPlazo()" style="padding:10px 15px; background:#059669; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">💧 Evaluar Liquidez (Runway)</button>
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
                    <tr><td colspan="7" style="background:#f0fdf4; color:#16a34a; font-weight:bold; padding:8px 15px;">(+) Ingresos Esperados por Cobranza</td></tr>
                    <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:10px 15px; padding-left:25px; color:#475569;">Cobranza Total Activa</td>
                        ${mesesProyeccion.map(m => `<td style="padding:10px; text-align:center; color:#16a34a; font-weight:bold;">${fmt(m.ingresos.total)}</td>`).join('')}
                    </tr>

                    <tr><td colspan="7" style="background:#fff1f2; color:#be123c; font-weight:bold; padding:8px 15px;">(-) Egresos Ineludibles Comprometidos</td></tr>
                    <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:10px 15px; padding-left:25px; color:#475569;">Tarjetas de Crédito (MSI Real)</td>
                        ${mesesProyeccion.map(m => `<td title="${formatTltp(m.desglose.tdc)}" style="padding:10px; text-align:center; color:#dc2626; cursor:help;">${fmt(m.egresos.tdc)}</td>`).join('')}
                    </tr>
                    <tr style="border-bottom:2px solid #cbd5e1;">
                        <td style="padding:10px 15px; padding-left:25px; color:#475569;">Cuentas por Pagar Comerciales</td>
                        ${mesesProyeccion.map(m => `<td title="${formatTltp(m.desglose.proveedores)}" style="padding:10px; text-align:center; color:#dc2626; cursor:help;">${fmt(m.egresos.proveedores)}</td>`).join('')}
                    </tr>

                    <tr style="background:#f8fafc; border-bottom:2px solid #cbd5e1; font-weight:bold;">
                        <td style="padding:15px; font-size:14px; color:#0f172a;">📊 BALANCE NETO DEL MES (Flujo)</td>
                        ${mesesProyeccion.map(m => {
                            let dif = m.ingresos.total - (m.egresos.tdc + m.egresos.proveedores);
                            return `<td style="padding:15px; text-align:center; font-weight:900; color:${dif >= 0 ? '#16a34a' : '#dc2626'}; font-size:14px;">${fmt(dif)}</td>`;
                        }).join('')}
                    </tr>
                </tbody>
            </table>
        </div>
    </div>`;
    contenedor.innerHTML = html;
};

// ─── 4. REPORTE DE LIQUIDEZ A CORTO PLAZO (RUNWAY FINANCIERO) ────────
window.renderReporteLiquidezCortoPlazo = function() {
    const contenedor = document.getElementById("reportes") || document.getElementById("dashboardContenido");
    if (!contenedor) return;

    const hoy = new Date();
    
    // 1. DINERO REAL (Cajas y Débito)
    const saldos = {};
    StorageService.get("cuentasEfectivo", [{ id: "efectivo", nombre: "💵 Efectivo Principal", saldo: 0 }]).forEach(c => saldos[c.nombre||c.id] = parseFloat(c.saldo||0));
    StorageService.get("tarjetasConfig", []).filter(t => t.tipo === "debito").forEach(t => saldos[t.banco] = parseFloat(t.saldoInicial||0));
    
    StorageService.get("movimientosCaja", []).forEach(m => {
        const esIng = m.tipo.toLowerCase() === "ingreso";
        const amt = parseFloat(m.monto) || 0;
        const cta = (m.cuenta === "efectivo" || m.cuenta === "caja") ? "💵 Efectivo Principal" : m.cuenta;
        if(saldos[cta] !== undefined) saldos[cta] += (esIng ? amt : -amt);
    });
    const liquidezTotalInicial = Object.values(saldos).reduce((a, b) => a + b, 0);

    // 2. CONSTRUCCIÓN DE MESES
    const mesesProyeccion = [];
    for(let i = 0; i < 6; i++) {
        let d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
        mesesProyeccion.push({
            key: `${d.getFullYear()}-${d.getMonth()}`,
            label: new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(d).toUpperCase(),
            egresos: { tdc: 0, proveedores: 0 },
            desglose: { tdc: {}, proveedores: {} },
            liquidezInicial: 0, totalEgresos: 0, liquidezFinal: 0
        });
    }

    // 3. MAPEAR EGRESOS (MSI: usar directamente el mes de pago.fecha sin recalcular)
    StorageService.get("cuentasMSI", []).forEach(msi => {
        (msi.calendario || []).forEach(pago => {
            if (pago.estado !== 'Pagado' && pago.estado !== 'Cancelado') {
                // pago.fecha YA es vencimiento calculado (ej: "2025-02-15"), NO es fecha de compra
                const partes = pago.fecha.split('-');
                const keyMes = `${partes[0]}-${parseInt(partes[1]) - 1}`;
                let dest = mesesProyeccion.find(m => m.key === keyMes);
                if (!dest) {
                    const fPago = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, 1);
                    dest = fPago < hoy ? mesesProyeccion[0] : mesesProyeccion[mesesProyeccion.length - 1];
                }
                
                let saldoReal = Math.max(0, (parseFloat(pago.monto)||0) - (parseFloat(pago.montoAbonado)||0));
                if (saldoReal > 0) {
                    dest.egresos.tdc += saldoReal;
                    dest.desglose.tdc[msi.banco] = (dest.desglose.tdc[msi.banco] || 0) + saldoReal;
                }
            }
        });
    });

    StorageService.get("cuentasPorPagar", []).forEach(cp => {
        const saldo = parseFloat(cp.saldoPendiente || 0);
        if (saldo > 0 && !cp.esConsignacion) {
            const fVenc = window.parseFechaMX(cp.vencimientoIso || cp.vencimiento || cp.fecha);
            let dest = mesesProyeccion.find(m => m.key === `${fVenc.getFullYear()}-${fVenc.getMonth()}`);
            if (!dest) dest = fVenc < hoy ? mesesProyeccion[0] : mesesProyeccion[mesesProyeccion.length - 1];
            
            dest.egresos.proveedores += saldo;
            dest.desglose.proveedores[cp.proveedor] = (dest.desglose.proveedores[cp.proveedor] || 0) + saldo;
        }
    });

    // 4. CASCADA DE LIQUIDEZ
    let liquidezArrastrada = liquidezTotalInicial;
    let mesesCubiertos = 0;

    mesesProyeccion.forEach(m => {
        m.liquidezInicial = liquidezArrastrada;
        m.totalEgresos = m.egresos.tdc + m.egresos.proveedores;
        m.liquidezFinal = m.liquidezInicial - m.totalEgresos;

        if (m.liquidezFinal >= 0) {
            mesesCubiertos++;
        } else if (m.liquidezInicial > 0 && m.totalEgresos > 0) {
            mesesCubiertos += (m.liquidezInicial / m.totalEgresos);
        }
        liquidezArrastrada = m.liquidezFinal;
    });

    const tooltipStr = (obj) => Object.entries(obj).map(([k, v]) => `${k}: ${fmt(v)}`).join('\n') || 'Sin desglose';

    let html = `
    <div style="background:white; padding:20px; border-radius:12px; box-shadow:0 10px 25px rgba(0,0,0,0.05); margin-top:15px; margin-bottom:30px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #e2e8f0; padding-bottom:15px; margin-bottom:20px;">
            <div>
                <h2 style="margin:0; color:#065f46; font-size:24px;">💧 Valuación de Liquidez (Runway Financiero)</h2>
                <p style="margin:0; color:#64748b; font-size:14px;">Supervivencia contable basada en capital líquido en cuentas.</p>
            </div>
            <button onclick="renderReporteCompromisos()" style="padding:10px 15px; background:#e2e8f0; color:#475569; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">⬅️ Volver a Cash Flow</button>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:15px; margin-bottom:20px;">
            <div style="padding:20px; background:linear-gradient(135deg, #10b981, #059669); color:white; border-radius:12px;">
                <div style="font-size:11px; font-weight:bold; opacity:0.9;">EFECTIVO + DÉBITO DISPONIBLE</div>
                <div style="font-size:30px; font-weight:900; margin-top:5px;">${fmt(liquidezTotalInicial)}</div>
            </div>
            <div style="padding:20px; background:linear-gradient(135deg, #3b82f6, #2563eb); color:white; border-radius:12px;">
                <div style="font-size:11px; font-weight:bold; opacity:0.9;">PISTA DE SUPERVIVENCIA</div>
                <div style="font-size:30px; font-weight:900; margin-top:5px;">${mesesCubiertos.toFixed(1)} Meses</div>
            </div>
            <div style="padding:20px; background:#fff1f2; border:1px solid #fda4af; border-radius:12px;">
                <div style="font-size:11px; font-weight:bold; color:#be123c;">COMPROMISOS MES 1</div>
                <div style="font-size:30px; font-weight:900; color:#be123c; margin-top:5px;">${fmt(mesesProyeccion[0].totalEgresos)}</div>
            </div>
        </div>

        <div style="overflow-x:auto;">
            <table style="width:100%; min-width:850px; border-collapse:collapse; font-size:13px;">
                <thead>
                    <tr>
                        <th style=\"padding:15px; background:#f1f5f9; text-align:left; border-bottom:2px solid #cbd5e1; width:260px;\">Cascada de Amortización</th>
                        ${mesesProyeccion.map(m => `<th style="padding:15px; background:#f8fafc; text-align:center; border-bottom:2px solid #cbd5e1; font-weight:bold;">${m.label}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    <tr style="background:#f0fdf4;">
                        <td style="padding:12px 15px; font-weight:bold; color:#16a34a;">💰 LIQUIDEZ INICIAL DISPONIBLE</td>
                        ${mesesProyeccion.map((m, i) => {
                            const tltp = i === 0 ? tooltipStr(Object.fromEntries(Object.entries(saldos).filter(([k,v])=>Math.abs(v)>0))) : `Remanente de ${mesesProyeccion[i-1].label}`;
                            return `<td title="${tltp}" style="padding:12px; text-align:center; color:#16a34a; font-weight:bold; cursor:help; border-bottom:1px dotted #86efac;">${fmt(m.liquidezInicial)}</td>`;
                        }).join('')}
                    </tr>
                    
                    <tr><td colspan="7" style="background:#fff1f2; color:#be123c; font-weight:bold; padding:8px 15px; font-size:12px; border-top:1px solid #fda4af;">(-) Egresos Ineludibles</td></tr>
                    
                    <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:10px 15px; color:#475569;">Tarjetas Bancarias (MSI Real)</td>
                        ${mesesProyeccion.map(m => `<td title="${tooltipStr(m.desglose.tdc)}" style="padding:10px; text-align:center; color:#dc2626; cursor:help;">${fmt(m.egresos.tdc)}</td>`).join('')}
                    </tr>
                    <tr style="border-bottom:2px solid #cbd5e1;">
                        <td style="padding:10px 15px; color:#475569;">Proveedores CXP</td>
                        ${mesesProyeccion.map(m => `<td title="${tooltipStr(m.desglose.proveedores)}" style="padding:10px; text-align:center; color:#dc2626; cursor:help;">${fmt(m.egresos.proveedores)}</td>`).join('')}
                    </tr>

                    <tr style="background:#eff6ff; border-bottom:2px solid #cbd5e1;">
                        <td style="padding:14px 15px; font-weight:900; color:#1e40af;">(=) LIQUIDEZ FINAL AL CIERRE</td>
                        ${mesesProyeccion.map(m => {
                            const neg = m.liquidezFinal < 0;
                            return `<td style="padding:14px; text-align:center; font-weight:900; color:${neg ? '#dc2626' : '#1e40af'}; background:${neg ? '#fef2f2' : 'transparent'};">${fmt(m.liquidezFinal)}</td>`;
                        }).join('')}
                    </tr>
                </tbody>
            </table>
        </div>
    </div>`;
    contenedor.innerHTML = html;
};
// ─── REPORTE DE FLUJO DE EFECTIVO HORIZONTAL ─────────────────────────
window.renderReporteFlujo = function() {
    const cont = document.getElementById('reporte-flujo') 
              || document.getElementById('reportes') 
              || document.getElementById('dashboardContenido');

    if (!cont) {
        console.warn("⚠️ No se encontró contenedor para renderReporteFlujo. Se esperaba #reporte-flujo, #reportes o #dashboardContenido.");
        return;
    }

    cont.innerHTML = "";

    const fDesde = window._filtroFlujoFInicio || '';
    const fHasta = window._filtroFlujoFFin || '';
    const cuentaFiltro = window._filtroFlujoCuenta || 'todas';
    const periodoAgrupar = window._filtroFlujoPeriodo || 'diario';
    const ordenBloques = window._filtroFlujoOrden || 'desc';

    const dineroFlujo = (v) => new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    }).format(v || 0);

    const asegurarArray = (valor) => {
        if (Array.isArray(valor)) return valor;

        if (valor && Array.isArray(valor.data)) return valor.data;

        if (valor && typeof valor === 'object') {
            return Object.values(valor).filter(v => v && typeof v === 'object');
        }

        return [];
    };

    const normalizarCuentaId = (valor) => {
        let c = String(valor || '').trim();

        if (!c) return 'efectivo';

        const lower = c.toLowerCase();

        if (
            lower === 'efectivo' ||
            lower === 'caja' ||
            lower === 'cash' ||
            lower.includes('efectivo principal') ||
            lower.includes('caja principal')
        ) {
            return 'efectivo';
        }

        if (
            lower === 'transferencia' ||
            lower === 'banco' ||
            lower.includes('transfer')
        ) {
            return 'transferencia';
        }

        if (
            lower === 'tarjeta' ||
            lower === 'terminal' ||
            lower.includes('tarjeta') ||
            lower.includes('terminal')
        ) {
            return 'tarjeta';
        }

        return c;
    };

    const nombreCuenta = (id) => {
        const key = normalizarCuentaId(id);

        if (key === 'efectivo') return '💵 Efectivo Principal';
        if (key === 'transferencia') return '🏦 Transferencia / Banco';
        if (key === 'tarjeta') return '💳 Tarjeta / Terminal';

        return String(id || key);
    };

    const normalizarTipo = (tipo) => {
        const t = String(tipo || '').toLowerCase();

        if (
            t === 'egreso' ||
            t === 'salida' ||
            t === 'gasto' ||
            t === 'pago'
        ) {
            return 'egreso';
        }

        return 'ingreso';
    };

    const normalizarFecha = (fecha) => {
        if (!fecha) return Date.now();

        if (typeof fecha === 'number') return fecha;

        const d = new Date(fecha);
        if (!isNaN(d.getTime())) return fecha;

        if (window.parseFechaMX) {
            const mx = window.parseFechaMX(fecha);
            if (mx && !isNaN(mx.getTime())) return mx.toISOString();
        }

        return Date.now();
    };

    const crearMovimiento = ({
        id,
        fecha,
        concepto,
        tipo,
        cuenta,
        monto,
        origen,
        referencia
    }) => {
        const montoNum = parseFloat(monto || 0);

        if (!montoNum || montoNum <= 0) return null;

        const cuentaId = normalizarCuentaId(cuenta);

        return {
            id: id || `${origen || 'mov'}-${referencia || concepto || ''}-${fecha || ''}-${montoNum}`,
            fecha: normalizarFecha(fecha),
            concepto: concepto || 'Movimiento',
            tipo: normalizarTipo(tipo),
            cuenta: cuentaId,
            cuentaNombre: nombreCuenta(cuentaId),
            monto: montoNum,
            origen: origen || 'sin_origen',
            referencia: referencia || ''
        };
    };

    // ======================================================
    // FUENTES DE DATOS
    // ======================================================
    const movimientosCaja = asegurarArray(StorageService.get("movimientosCaja", []));
    const manuales = asegurarArray(StorageService.get("movimientosManuales", []));

    const tickets = asegurarArray(StorageService.get("registroTickets", []));
    const cuentasCxC = asegurarArray(StorageService.get("cuentasPorCobrar", []));
    const ordenesCompra = asegurarArray(StorageService.get("ordenesCompra", []));
    const comprasDirectas = asegurarArray(StorageService.get("compras", []));

    let movimientos = [];

    // ======================================================
    // 1. FUENTE PRINCIPAL: movimientosCaja
    // Evita duplicar ventas/abonos/compras que ya están registradas aquí.
    // ======================================================
    movimientosCaja.forEach(m => {
        const mov = crearMovimiento({
            id: m.id || m.folio || m.referencia,
            fecha: m.fecha || m.fechaISO || m.createdAt,
            concepto: m.concepto || m.descripcion || m.referencia || m.folio || 'Movimiento de caja',
            tipo: m.tipo,
            cuenta: m.cuenta || m.cuentaId || m.metodoPago || m.medioPago || m.origen || 'efectivo',
            monto: m.monto,
            origen: 'movimientosCaja',
            referencia: m.folio || m.referencia || m.id
        });

        if (mov) movimientos.push(mov);
    });

    // ======================================================
    // 2. MOVIMIENTOS MANUALES
    // Estos sí se agregan aparte.
    // ======================================================
    manuales.forEach(m => {
        const mov = crearMovimiento({
            id: m.id,
            fecha: m.fecha,
            concepto: m.concepto || 'Movimiento manual',
            tipo: m.tipo,
            cuenta: m.cuenta || 'efectivo',
            monto: m.monto,
            origen: 'manual',
            referencia: m.id
        });

        if (mov) movimientos.push(mov);
    });

    // ======================================================
    // 3. RESPALDO: si NO hay movimientosCaja, reconstruir desde módulos
    // Esto evita duplicados cuando movimientosCaja ya existe.
    // ======================================================
    if (movimientosCaja.length === 0) {
        console.warn("⚠️ No hay movimientosCaja. Reconstruyendo flujo desde tickets, CxC y compras como respaldo.");

        tickets.forEach(t => {
            const venta = t.venta || {};
            const metodo = venta.cuentaReceptora || venta.modoEnganche || venta.metodoPago || 'efectivo';

            const monto = (
                venta.metodoPago === 'contado' ||
                venta.metodoPago === 'transferencia'
            )
                ? parseFloat(venta.total || 0)
                : parseFloat(venta.enganche || 0);

            const mov = crearMovimiento({
                id: t.id || t.folio || venta.folio,
                fecha: t.fechaEmision || t.fecha || venta.fecha || venta.fechaVenta,
                concepto: `Venta: ${t.folio || venta.folio || '-'}`,
                tipo: 'ingreso',
                cuenta: metodo,
                monto,
                origen: 'ticket',
                referencia: t.folio || venta.folio
            });

            if (mov) movimientos.push(mov);
        });

        cuentasCxC.forEach(c => {
            (c.abonos || []).forEach(ab => {
                const mov = crearMovimiento({
                    id: ab.id || `${c.folio || c.id}-${ab.fecha}-${ab.monto}`,
                    fecha: ab.fecha,
                    concepto: `Abo: ${c.nombre || c.clienteNombre || c.folio || '-'}`,
                    tipo: 'ingreso',
                    cuenta: ab.cuentaId || ab.medioPago || ab.metodoPago || 'efectivo',
                    monto: ab.monto,
                    origen: 'abonoCxC',
                    referencia: c.folio || c.id
                });

                if (mov) movimientos.push(mov);
            });
        });

        ordenesCompra.forEach(com => {
            const pagado = parseFloat(com.pagado || com.montoPagado || 0);

            const mov = crearMovimiento({
                id: com.id || com.folio,
                fecha: com.fecha || com.fechaEmision,
                concepto: `Prov: ${com.proveedor || com.proveedorNombre || '-'}`,
                tipo: 'egreso',
                cuenta: com.metodoPago || com.cuentaPago || 'efectivo',
                monto: pagado,
                origen: 'ordenCompra',
                referencia: com.folio || com.id
            });

            if (mov) movimientos.push(mov);
        });

                comprasDirectas.forEach(com => {
            // IMPORTANTE:
            // El flujo de efectivo SOLO debe mostrar dinero realmente pagado.
            // Si una compra/recepción se fue a cuentas por pagar, NO debe salir aquí.
            const pagado = parseFloat(
                com.pagado ||
                com.montoPagado ||
                com.totalPagado ||
                com.anticipo ||
                0
            );

            const metodo = String(
                com.metodoPago ||
                com.formaPago ||
                com.tipoPago ||
                ''
            ).toLowerCase();

            const esCreditoProveedor =
                metodo.includes('credito') ||
                metodo.includes('crédito') ||
                metodo.includes('cuenta por pagar') ||
                metodo.includes('cxp') ||
                metodo.includes('proveedor') ||
                com.esCredito === true ||
                com.esCuentaPorPagar === true ||
                com.generaCXP === true ||
                com.cuentaPorPagar === true ||
                com.estadoPago === 'pendiente' ||
                com.estadoPago === 'Pendiente';

            // Si no hubo pago real, no entra al flujo.
            if (pagado <= 0) return;

            // Si es crédito/CXP, solo entra si realmente trae un pago parcial/anticipo.
            // Nunca usar com.total como si fuera efectivo.
            const mov = crearMovimiento({
                id: com.id || com.folio,
                fecha: com.fechaPago || com.fechaISO || com.fecha,
                concepto: `Pago compra: ${com.proveedor || com.proveedorNombre || com.id || '-'}`,
                tipo: 'egreso',
                cuenta: com.cuentaPago || com.cuenta || com.metodoPago || 'efectivo',
                monto: pagado,
                origen: esCreditoProveedor ? 'anticipoCompraCXP' : 'compraDirectaPagada',
                referencia: com.folio || com.id
            });

            if (mov) movimientos.push(mov);
        });
    }

    // ======================================================
    // 4. DEDUPLICACIÓN DE SEGURIDAD
    // Si por alguna razón llega repetido el mismo movimiento, se queda uno.
    // ======================================================
    const vistos = new Set();

    movimientos = movimientos.filter(m => {
        const fechaKey = new Date(m.fecha).toISOString().slice(0, 10);
        const key = [
            m.tipo,
            fechaKey,
            m.cuenta,
            Number(m.monto || 0).toFixed(2),
            String(m.referencia || m.concepto || '').toLowerCase().trim()
        ].join('|');

        if (vistos.has(key)) {
            console.warn("⏭️ Movimiento duplicado ignorado:", m);
            return false;
        }

        vistos.add(key);
        return true;
    });

    // ======================================================
    // 5. ARMAR COMBO CUENTA
    // Cuentas configuradas + cuentas detectadas en movimientos
    // ======================================================
    const cajas = asegurarArray(StorageService.get("cuentasEfectivo", [
        { id: "efectivo", nombre: "💵 Efectivo Principal" }
    ]));

    const tarjetas = asegurarArray(StorageService.get("tarjetasConfig", []));

    const mapaCuentas = new Map();

    mapaCuentas.set('efectivo', '💵 Efectivo Principal');
    mapaCuentas.set('transferencia', '🏦 Transferencia / Banco');
    mapaCuentas.set('tarjeta', '💳 Tarjeta / Terminal');

    cajas.forEach(c => {
        const id = normalizarCuentaId(c.id || c.nombre || 'efectivo');
        mapaCuentas.set(id, c.nombre || nombreCuenta(id));
    });

    tarjetas.forEach(t => {
        const id = normalizarCuentaId(t.id || t.banco || t.nombre);

        if (t.tipo === 'debito') {
            mapaCuentas.set(id, `🏦 ${t.banco || t.nombre || id}`);
        } else if (t.tipo === 'credito') {
            mapaCuentas.set(id, `💳 ${t.banco || t.nombre || id}`);
        }
    });

    movimientos.forEach(m => {
        const id = normalizarCuentaId(m.cuenta);
        if (!mapaCuentas.has(id)) {
            mapaCuentas.set(id, nombreCuenta(id));
        }
    });

    const cuentasParaSelector = Array.from(mapaCuentas.entries()).map(([id, nombre]) => ({
        id,
        nombre
    }));

    // Si el filtro actual ya no existe, regresar a todas
    const cuentasIds = cuentasParaSelector.map(c => String(c.id));
    if (cuentaFiltro !== 'todas' && !cuentasIds.includes(String(cuentaFiltro))) {
        window._filtroFlujoCuenta = 'todas';
    }

    const cuentaFiltroFinal = window._filtroFlujoCuenta || 'todas';

    // ======================================================
    // 6. FILTRADO
    // ======================================================
    let movsFiltrados = movimientos.filter(m => {
        const coincideCuenta =
            cuentaFiltroFinal === 'todas' ||
            String(normalizarCuentaId(m.cuenta)) === String(cuentaFiltroFinal);

        const fMov = new Date(m.fecha);

        if (isNaN(fMov.getTime())) return false;

        let coincideRango = true;

        if (fDesde) {
            coincideRango = coincideRango && fMov >= new Date(fDesde + "T00:00:00");
        }

        if (fHasta) {
            coincideRango = coincideRango && fMov <= new Date(fHasta + "T23:59:59");
        }

        return coincideCuenta && coincideRango;
    });

    // ======================================================
    // 7. AGRUPACIÓN
    // ======================================================
    const grupos = {};

    movsFiltrados.forEach(m => {
        const d = new Date(m.fecha);
        let clave = "";
        let sortKey = d.getTime();

        const fmtFecha = window.formatearFechaCortaMX
            ? window.formatearFechaCortaMX(m.fecha)
            : d.toLocaleDateString('es-MX');

        if (periodoAgrupar === 'diario') {
            clave = fmtFecha;
        } else if (periodoAgrupar === 'semanal') {
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            const lunes = new Date(new Date(d).setDate(diff));
            const domingo = new Date(new Date(lunes).setDate(lunes.getDate() + 6));

            clave = `${lunes.getDate()}/${lunes.getMonth() + 1} al ${domingo.getDate()}/${domingo.getMonth() + 1}`;
            sortKey = lunes.getTime();
        } else {
            clave = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
            sortKey = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
        }

        if (!grupos[clave]) {
            grupos[clave] = {
                ing: 0,
                egr: 0,
                items: [],
                sortKey
            };
        }

        if (m.tipo === 'ingreso') {
            grupos[clave].ing += Number(m.monto || 0);
        } else {
            grupos[clave].egr += Number(m.monto || 0);
        }

        grupos[clave].items.push(m);
    });

    const clavesOrd = Object.keys(grupos).sort((a, b) => {
        return ordenBloques === 'desc'
            ? grupos[b].sortKey - grupos[a].sortKey
            : grupos[a].sortKey - grupos[b].sortKey;
    });

    let totalIng = 0;
    let totalEgr = 0;

    const bloquesHTML = clavesOrd.map(clave => {
        const g = grupos[clave];
        totalIng += g.ing;
        totalEgr += g.egr;

        const balance = g.ing - g.egr;

        return `
            <div style="min-width:320px; background:white; border-radius:12px; border:1px solid #e2e8f0; display:flex; flex-direction:column; max-height:450px; box-shadow:0 4px 10px rgba(0,0,0,0.05);">
                <div style="padding:15px; background:#1e3a8a; color:white; border-radius:12px 12px 0 0;">
                    <div style="font-weight:bold; font-size:14px;">${clave.toUpperCase()}</div>
                    <div style="display:flex; justify-content:space-between; margin-top:10px; font-size:12px;">
                        <span style="color:#4ade80;">+ ${dineroFlujo(g.ing)}</span>
                        <span style="color:#f87171;">- ${dineroFlujo(g.egr)}</span>
                    </div>
                    <div style="margin-top:8px; padding-top:8px; border-top:1px dashed rgba(255,255,255,0.3); text-align:right; font-weight:bold;">
                        Neto: ${dineroFlujo(balance)}
                    </div>
                </div>

                <div style="flex:1; overflow-y:auto; padding:10px; background:#fcfcfc; border-radius:0 0 12px 12px;">
                    ${g.items.map(i => `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #f1f5f9; font-size:11px;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <input type="checkbox" style="width:16px; height:16px; cursor:pointer; accent-color:#1e40af;">
                                <div style="max-width:180px; line-height:1.2;">
                                    <b>${i.concepto}</b><br>
                                    <small style="color:#64748b;">${i.cuentaNombre}</small><br>
                                    <small style="color:#94a3b8;">Origen: ${i.origen}</small>
                                </div>
                            </div>
                            <span style="font-weight:bold; color:${i.tipo === 'ingreso' ? '#16a34a' : '#dc2626'};">
                                ${i.tipo === 'ingreso' ? '+' : '-'}${dineroFlujo(i.monto)}
                            </span>
                        </div>
                    `).join('')}
                </div>
            </div>`;
    }).join('');

    cont.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <div>
                <h2 style="margin:0; color:#1e40af;">💵 Flujo de Efectivo Horizontal</h2>
                <p style="color:#718096; margin:0;">Movimientos reales filtrados por cajas, bancos y origen normalizado.</p>
            </div>

            <div style="display:flex; gap:10px;">
                <button onclick="window.exportarReporteFlujo()" style="padding:10px 18px; background:#1e3a8a; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">
                    📊 Exportar CSV
                </button>
                <button onclick="window.abrirModalGastoExtra()" style="padding:10px 18px; background:#10b981; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">
                    💸 Nuevo Gasto / Ingreso
                </button>
            </div>
        </div>

        <div style="display:flex; flex-wrap:wrap; gap:15px; background:white; padding:15px; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.05); margin-bottom:25px; align-items:end;">
            <div>
                <label style="font-size:10px; font-weight:bold; color:#64748b;">CUENTA:</label>
                <select onchange="window._filtroFlujoCuenta=this.value; window.renderReporteFlujo();" style="display:block; padding:8px; border-radius:6px; border:1px solid #cbd5e1; margin-top:4px; min-width:220px;">
                    <option value="todas" ${cuentaFiltroFinal === 'todas' ? 'selected' : ''}>🌍 Ver Todas</option>
                    ${cuentasParaSelector.map(c => `
                        <option value="${c.id}" ${cuentaFiltroFinal === String(c.id) ? 'selected' : ''}>${c.nombre}</option>
                    `).join('')}
                </select>
            </div>

            <div>
                <label style="font-size:10px; font-weight:bold; color:#64748b;">AGRUPAR:</label>
                <select onchange="window._filtroFlujoPeriodo=this.value; window.renderReporteFlujo();" style="display:block; padding:8px; border-radius:6px; border:1px solid #cbd5e1; margin-top:4px;">
                    <option value="diario" ${periodoAgrupar === 'diario' ? 'selected' : ''}>Diario</option>
                    <option value="semanal" ${periodoAgrupar === 'semanal' ? 'selected' : ''}>Semanal (Lun-Dom)</option>
                    <option value="mensual" ${periodoAgrupar === 'mensual' ? 'selected' : ''}>Mensual</option>
                </select>
            </div>

            <div>
                <label style="font-size:10px; font-weight:bold; color:#64748b;">DESDE:</label>
                <input type="date" value="${fDesde}" onchange="window._filtroFlujoFInicio=this.value; window.renderReporteFlujo();" style="display:block; padding:7px; border-radius:6px; border:1px solid #cbd5e1; margin-top:4px;">
            </div>

            <div>
                <label style="font-size:10px; font-weight:bold; color:#64748b;">HASTA:</label>
                <input type="date" value="${fHasta}" onchange="window._filtroFlujoFFin=this.value; window.renderReporteFlujo();" style="display:block; padding:7px; border-radius:6px; border:1px solid #cbd5e1; margin-top:4px;">
            </div>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:15px; margin-bottom:25px;">
            <div style="background:#f0fdf4; border-left:5px solid #16a34a; padding:15px; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                <small style="color:#166534; font-weight:bold;">INGRESOS DEL FILTRO</small><br>
                <strong style="font-size:22px; color:#15803d;">${dineroFlujo(totalIng)}</strong>
            </div>

            <div style="background:#fff1f2; border-left:5px solid #dc2626; padding:15px; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                <small style="color:#991b1b; font-weight:bold;">EGRESOS DEL FILTRO</small><br>
                <strong style="font-size:22px; color:#b91c1c;">${dineroFlujo(totalEgr)}</strong>
            </div>

            <div style="background:#eff6ff; border-left:5px solid #1e40af; padding:15px; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                <small style="color:#1e3a8a; font-weight:bold;">BALANCE NETO</small><br>
                <strong style="font-size:22px; color:#1e40af;">${dineroFlujo(totalIng - totalEgr)}</strong>
            </div>

            <div style="background:#f8fafc; border-left:5px solid #64748b; padding:15px; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                <small style="color:#475569; font-weight:bold;">MOVIMIENTOS MOSTRADOS</small><br>
                <strong style="font-size:22px; color:#334155;">${movsFiltrados.length}</strong>
            </div>
        </div>

        <div style="display:flex; overflow-x:auto; gap:20px; padding:10px 0 25px 0; align-items:flex-start;">
            ${bloquesHTML || '<div style="width:100%; text-align:center; padding:50px; color:#94a3b8; background:white; border-radius:12px;">No hay movimientos con estos filtros.</div>'}
        </div>
    `;
};

// --- SOPORTE PARA REPORTE DE FLUJO ---
window.actualizarFiltrosFlujo = function() {
    const fPer = document.getElementById('fPer');
    const fCta = document.getElementById('fCta');
    const fIni = document.getElementById('fIni');
    const fFin = document.getElementById('fFin');

    if (fPer) window._filtroFlujoPeriodo = fPer.value;
    if (fCta) window._filtroFlujoCuenta = fCta.value;
    if (fIni) window._filtroFlujoFInicio = fIni.value;
    if (fFin) window._filtroFlujoFFin = fFin.value;

    window.renderReporteFlujo();
};

window.abrirModalGastoExtra = function() {
    const html = `
    <div id="mFin" style="position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:10000; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
        <div style="background:white; padding:30px; border-radius:16px; width:90%; max-width:400px;">
            <h3 style="margin:0; color:#1e40af;">💸 Movimiento Manual</h3>

            <label style="display:block; margin-top:15px; font-size:11px; font-weight:bold;">TIPO:</label>
            <select id="mTipo" style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1;">
                <option value="egreso">🔴 Gasto / Salida</option>
                <option value="ingreso">🟢 Ingreso Extra</option>
            </select>

            <label style="display:block; margin-top:10px; font-size:11px; font-weight:bold;">CUENTA:</label>
            <select id="mCta" style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1;">
                <option value="efectivo">Caja / Efectivo</option>
                <option value="transferencia">Banco / Transferencia</option>
                <option value="tarjeta">Tarjeta / Terminal</option>
            </select>

            <label style="display:block; margin-top:10px; font-size:11px; font-weight:bold;">CONCEPTO:</label>
            <input type="text" id="mCon" placeholder="Ej. Pago de luz, comida, ajuste..." style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1; box-sizing:border-box;">

            <label style="display:block; margin-top:10px; font-size:11px; font-weight:bold;">MONTO ($):</label>
            <input type="number" id="mMon" placeholder="0.00" style="width:100%; padding:12px; border-radius:8px; border:2px solid #1e40af; font-size:18px; font-weight:bold; box-sizing:border-box;">

            <div style="display:flex; gap:10px; margin-top:25px;">
                <button onclick="window.guardarMovManual()" style="flex:1; padding:12px; background:#1e40af; color:white; border:none; border-radius:8px; font-weight:bold;">💾 Guardar</button>
                <button onclick="document.getElementById('mFin').remove()" style="flex:1; padding:12px; background:#f1f5f9; color:#475569; border:none; border-radius:8px;">Cancelar</button>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
};

window.guardarMovManual = function() {
    const tipo = document.getElementById('mTipo')?.value;
    const cuentaRaw = document.getElementById('mCta')?.value;
    const concepto = document.getElementById('mCon')?.value.trim();
    const monto = parseFloat(document.getElementById('mMon')?.value);

    if (!concepto || isNaN(monto) || monto <= 0) {
        return alert("❌ Datos inválidos");
    }

    const normalizarCuentaManual = (valor) => {
        const c = String(valor || '').toLowerCase().trim();

        if (c === 'caja' || c === 'efectivo') return 'efectivo';
        if (c === 'banco' || c === 'transferencia') return 'transferencia';
        if (c === 'terminal' || c === 'tarjeta') return 'tarjeta';

        return valor || 'efectivo';
    };

    const movimientosRaw = StorageService.get("movimientosManuales", []);
    const movimientos = Array.isArray(movimientosRaw)
        ? movimientosRaw
        : [];

    movimientos.push({
        id: Date.now(),
        fecha: Date.now(),
        tipo,
        cuenta: normalizarCuentaManual(cuentaRaw),
        concepto: `[Manual] ${concepto}`,
        monto
    });

    StorageService.set("movimientosManuales", movimientos);

    const modal = document.getElementById('mFin');
    if (modal) modal.remove();

    window.renderReporteFlujo();
};

window.exportarReporteFlujo = function() {
    const movimientosCaja = StorageService.get("movimientosCaja", []);

    if (typeof _csvDescargar !== 'function') {
        alert("❌ No está disponible la función de exportación CSV.");
        return;
    }

    _csvDescargar(
        'reporte-flujo.csv',
        ['Folio', 'Fecha', 'Tipo', 'Monto', 'Concepto', 'Referencia'],
        movimientosCaja.map(m => [
            m.folio || '-',
            m.fecha || '-',
            m.tipo || '-',
            m.monto || 0,
            m.concepto || '-',
            m.referencia || '-'
        ])
    );
};

// --- Registro Global de Funciones ---
window.renderReporteVentas = window.renderReporteVentas;
window.exportarReporteVentas = window.exportarReporteVentas;
window.renderReporteCompras = window.renderReporteCompras;
window.exportarReporteCompras = window.exportarReporteCompras;
window.renderReporteCompromisos = window.renderReporteCompromisos;
window.renderReporteLiquidezCortoPlazo = window.renderReporteLiquidezCortoPlazo;
window.renderReporteFlujo = window.renderReporteFlujo;
window.exportarReporteFlujo = window.exportarReporteFlujo;