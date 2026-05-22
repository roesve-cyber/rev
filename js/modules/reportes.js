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

// --- Registro Global de Funciones ---
window.renderReporteVentas = renderReporteVentas;
window.exportarReporteVentas = exportarReporteVentas;
window.renderReporteCompras = renderReporteCompras;
window.exportarReporteCompras = exportarReporteCompras;
window.renderReporteCompromisos = renderReporteCompromisos;
window.renderReporteLiquidezCortoPlazo = renderReporteLiquidezCortoPlazo;