// ===== DASHBOARD PRINCIPAL =====

function _dashboardCuentaCancelada(cuenta) {
    return String(cuenta?.estado || cuenta?.estatus || '').toLowerCase().includes('cancel');
}

function renderDashboard() {
    const contenedor = document.getElementById("dashboardContenido");
    if (!contenedor) return;

    const ventasRegistradas = StorageService.get("ventasRegistradas", [])
        .filter(v => !String(v.estado || v.estatus || '').toLowerCase().includes('cancel'));
    const cuentasPorCobrar = StorageService.get("cuentasPorCobrar", [])
        .filter(c => !_dashboardCuentaCancelada(c) && !c.incobrable);
    const pagaresSistema = StorageService.get("pagaresSistema", []);
    const movimientosCaja = StorageService.get("movimientosCaja", []);

    const hoy = new Date();
    const hoyStr = window.obtenerHoyInputMX();
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - 6);
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    // KPI: Ventas del día
    const ventasHoy = ventasRegistradas.filter(v => {
        let val = v.fechaVenta || v.fechaIso;
        let f = val ? (typeof val === 'string' ? val.slice(0, 10) : new Date(val).toISOString().slice(0, 10)) : '';
        return f === hoyStr;
    });
    const totalHoy = ventasHoy.reduce((s, v) => s + (v.total || v.totalVenta || 0), 0);

    // 🛡️ Helper local para parseo seguro
    const parseSeguro = (val) => {
        if (!val) return new Date(0);
        if (typeof val === 'string' && val.includes('/')) {
            const p = val.split('/');
            if (p.length === 3) return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]), 12, 0, 0);
        }
        return new Date(val);
    };

    // KPI: Ventas de la semana
    const ventasSemana = ventasRegistradas.filter(v => {
        const f = parseSeguro(v.fechaVenta || v.fechaIso || v.fecha);
        return f >= inicioSemana && f <= hoy;
    });
    const totalSemana = ventasSemana.reduce((s, v) => s + (v.total || v.totalVenta || 0), 0);

    // KPI: Ventas del mes
    const ventasMes = ventasRegistradas.filter(v => {
        const f = parseSeguro(v.fechaVenta || v.fechaIso || v.fecha);
        return f >= inicioMes && f <= hoy;
    });
    const totalMes = ventasMes.reduce((s, v) => s + (v.total || v.totalVenta || 0), 0);

    // KPI: Saldo CxC pendiente
    const cxcPendientes = cuentasPorCobrar.filter(c => c.estado !== "Saldado");
    const saldoCxC = cxcPendientes.reduce((s, c) => {
        if (typeof window._calcularEstadoCuenta === 'function') {
            const estado = window._calcularEstadoCuenta(c.folio);
            if (estado) return s + Number(estado.saldoTotal || 0);
        }
        const pagaresF = pagaresSistema.filter(p => p.folio === c.folio && (p.estado === "Pendiente" || p.estado === "Parcial" || p.estado === "Vencido"));
        return s + pagaresF.reduce((a, p) => a + Math.max(0, Number(p.monto || 0) - Number(p.montoAbonado || 0)), 0);
    }, 0);

    // KPI: Saldo en caja/bancos
    const ingresos = movimientosCaja.reduce((s, m) => s + ((m.tipo === 'ingreso' || m.tipo === 'Ingreso') ? (m.monto || 0) : 0), 0);
    const egresos = movimientosCaja.reduce((s, m) => s + ((m.tipo === 'egreso' || m.tipo === 'Egreso') ? (m.monto || 0) : 0), 0);
    const saldoCaja = ingresos - egresos;

    // KPI: Pagarés vencidos hoy
    const pagaresVencidosHoy = pagaresSistema.filter(p => {
        if (p.estado === "Pagado" || p.estado === "Cancelado") return false;
        let val = p.fechaVencimiento;
        let fv = val ? (typeof val === 'string' ? val.slice(0, 10) : new Date(val).toISOString().slice(0, 10)) : '';
        return fv === hoyStr;
    });
    const cantVencHoy = pagaresVencidosHoy.length;
    const montoVencHoy = pagaresVencidosHoy.reduce((s, p) => s + Math.max(0, Number(p.monto || 0) - Number(p.montoAbonado || 0)), 0);

    // Cobranza próxima: pagarés en los próximos 7 días
    const en7dias = new Date(hoy);
    en7dias.setDate(hoy.getDate() + 7);
    const pagaresProximos = pagaresSistema.filter(p => {
        if (p.estado === "Pagado" || p.estado === "Cancelado") return false;
        const fv = new Date(p.fechaVencimiento);
        return fv >= hoy && fv <= en7dias;
    }).sort((a, b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento));

    // Ventas recientes: últimas 5
    const ventasRecientes = [...ventasRegistradas]
        .sort((a, b) => parseSeguro(b.fechaVenta || b.fechaIso || b.fecha) - parseSeguro(a.fechaVenta || a.fechaIso || a.fecha))
        .slice(0, 5);

    // ── Render ──────────────────────────────────────────────
    const kpiStyle = (bg, border) =>
        `background:${bg}; border-left:5px solid ${border}; padding:20px; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.06);`;

    const cobranzaFilas = pagaresProximos.length === 0
        ? `<tr><td colspan="5" style="padding:16px; text-align:center; color:#6b7280;">Sin pagarés próximos a vencer</td></tr>`
        : pagaresProximos.map(p => {
            const cuenta = cxcPendientes.find(c => c.folio === p.folio);
            const cliente = cuenta ? cuenta.nombre : (p.clienteNombre || p.folio || '—');
            const fv = new Date(p.fechaVencimiento);
            const diasRestantes = Math.ceil((fv - hoy) / (1000 * 60 * 60 * 24));
            const colorDias = diasRestantes <= 2 ? '#dc2626' : diasRestantes <= 4 ? '#f59e0b' : '#27ae60';
            return `<tr style="border-bottom:1px solid #f3f4f6;">
                <td style="padding:8px 10px;">${cliente}</td>
                <td style="padding:8px 10px; color:#1d4ed8; font-weight:bold;">${p.folio || '—'}</td>
                <td style="padding:8px 10px;">${p.fechaVencimiento ? window.formatearFechaCortaMX(p.fechaVencimiento) : '—'}</td>
                <td style="padding:8px 10px; text-align:right; font-weight:bold;">${dinero(Math.max(0, Number(p.monto || 0) - Number(p.montoAbonado || 0)))}</td>
                <td style="padding:8px 10px; text-align:center; font-weight:bold; color:${colorDias};">${diasRestantes} día(s)</td>
            </tr>`;
        }).join('');

    const ventasFilas = ventasRecientes.length === 0
        ? `<tr><td colspan="4" style="padding:16px; text-align:center; color:#6b7280;">Sin ventas registradas</td></tr>`
        : ventasRecientes.map(v => {
            const fecha = v.fechaVenta || v.fechaIso
                ? window.formatearFechaCortaMX(v.fechaVenta || v.fechaIso)
                : '—';
            const cliente = v.clienteNombre || v.cliente?.nombre || '—';
            const total = v.total || v.totalVenta || 0;
            const metodo = v.metodo || v.metodoPago || '—';
            return `<tr style="border-bottom:1px solid #f3f4f6;">
                <td style="padding:8px 10px;">${fecha}</td>
                <td style="padding:8px 10px;">${cliente}</td>
                <td style="padding:8px 10px; text-align:right; font-weight:bold;">${dinero(total)}</td>
                <td style="padding:8px 10px;">${metodo}</td>
            </tr>`;
        }).join('');

    contenedor.innerHTML = `
        <!-- KPIs -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:16px; margin-bottom:24px;">

            <div style="${kpiStyle('#f0fdf4','#22c55e')}">
                <div style="font-size:12px; color:#15803d; font-weight:bold; text-transform:uppercase;">💰 Ventas del Día</div>
                <div style="font-size:26px; font-weight:bold; color:#166534; margin-top:6px;">${dinero(totalHoy)}</div>
                <div style="font-size:12px; color:#6b7280; margin-top:4px;">${ventasHoy.length} venta(s)</div>
            </div>

            <div style="${kpiStyle('#eff6ff','#3b82f6')}">
                <div style="font-size:12px; color:#1d4ed8; font-weight:bold; text-transform:uppercase;">📅 Ventas Semana</div>
                <div style="font-size:26px; font-weight:bold; color:#1e40af; margin-top:6px;">${dinero(totalSemana)}</div>
                <div style="font-size:12px; color:#6b7280; margin-top:4px;">${ventasSemana.length} venta(s)</div>
            </div>

            <div style="${kpiStyle('#faf5ff','#a855f7')}">
                <div style="font-size:12px; color:#7e22ce; font-weight:bold; text-transform:uppercase;">📆 Ventas del Mes</div>
                <div style="font-size:26px; font-weight:bold; color:#6b21a8; margin-top:6px;">${dinero(totalMes)}</div>
                <div style="font-size:12px; color:#6b7280; margin-top:4px;">${ventasMes.length} venta(s)</div>
            </div>

            <div style="${kpiStyle('#fff7ed','#f59e0b')}">
                <div style="font-size:12px; color:#b45309; font-weight:bold; text-transform:uppercase;">💳 Saldo CxC Pendiente</div>
                <div style="font-size:26px; font-weight:bold; color:#92400e; margin-top:6px;">${dinero(saldoCxC)}</div>
                <div style="font-size:12px; color:#6b7280; margin-top:4px;">${cxcPendientes.length} cuenta(s) activa(s)</div>
            </div>

            <div style="${kpiStyle(saldoCaja >= 0 ? '#f0fdf4' : '#fef2f2', saldoCaja >= 0 ? '#22c55e' : '#ef4444')}">
                <div style="font-size:12px; color:${saldoCaja >= 0 ? '#15803d' : '#b91c1c'}; font-weight:bold; text-transform:uppercase;">🏦 Saldo Caja/Bancos</div>
                <div style="font-size:26px; font-weight:bold; color:${saldoCaja >= 0 ? '#166534' : '#991b1b'}; margin-top:6px;">${dinero(saldoCaja)}</div>
                <div style="font-size:12px; color:#6b7280; margin-top:4px;">${movimientosCaja.length} movimiento(s)</div>
            </div>

            <div style="${kpiStyle(cantVencHoy > 0 ? '#fef2f2' : '#f0fdf4', cantVencHoy > 0 ? '#ef4444' : '#22c55e')}">
                <div style="font-size:12px; color:${cantVencHoy > 0 ? '#b91c1c' : '#15803d'}; font-weight:bold; text-transform:uppercase;">⚠️ Pagarés Vencen Hoy</div>
                <div style="font-size:26px; font-weight:bold; color:${cantVencHoy > 0 ? '#991b1b' : '#166534'}; margin-top:6px;">${cantVencHoy}</div>
                <div style="font-size:12px; color:#6b7280; margin-top:4px;">${cantVencHoy > 0 ? dinero(montoVencHoy) : 'Sin vencimientos hoy'}</div>
            </div>

        </div>

        <!-- Cobranza próxima -->
        <div style="background:white; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.06); padding:20px; margin-bottom:24px;">
            <h3 style="margin:0 0 14px 0; color:#1e3a5f;">📋 Cobranza Próxima (7 días)</h3>
            <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; font-size:14px;">
                    <thead>
                        <tr style="background:#f3f4f6;">
                            <th style="padding:10px; text-align:left;">Cliente</th>
                            <th style="padding:10px; text-align:left;">Folio</th>
                            <th style="padding:10px; text-align:left;">Vencimiento</th>
                            <th style="padding:10px; text-align:right;">Monto</th>
                            <th style="padding:10px; text-align:center;">Días Rest.</th>
                        </tr>
                    </thead>
                    <tbody>${cobranzaFilas}</tbody>
                </table>
            </div>
        </div>

        <!-- Ventas recientes -->
        <div style="background:white; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.06); padding:20px;">
            <h3 style="margin:0 0 14px 0; color:#1e3a5f;">🛍️ Últimas Ventas</h3>
            <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; font-size:14px;">
                    <thead>
                        <tr style="background:#f3f4f6;">
                            <th style="padding:10px; text-align:left;">Fecha</th>
                            <th style="padding:10px; text-align:left;">Cliente</th>
                            <th style="padding:10px; text-align:right;">Total</th>
                            <th style="padding:10px; text-align:left;">Método</th>
                        </tr>
                    </thead>
                    <tbody>${ventasFilas}</tbody>
                </table>
            </div>
        </div>
    `;
}

// ===== ALERTAS DE PAGARÉS VENCIDOS =====
function verificarAlertasPagaresVencidos() {
    const pagaresSistema = StorageService.get("pagaresSistema", []);
    const cuentasPorCobrar = StorageService.get("cuentasPorCobrar", []);
    const hoy = new Date();
    const hoyStr = window.obtenerHoyInputMX();

    const vencidos = pagaresSistema.filter(p => {
        if (p.estado === "Pagado" || p.estado === "Cancelado") return false;
        const cuenta = cuentasPorCobrar.find(c => c.folio === p.folio);
        if (cuenta && (_dashboardCuentaCancelada(cuenta) || cuenta.incobrable)) return false;
        return new Date(p.fechaVencimiento) < hoy;
    });

    // El conteo para el badge se devuelve siempre (lo combina verificarAlertasPagares).
    // El modal de aviso si respeta "una vez por sesion" para no ser repetitivo.
    if (vencidos.length === 0 || sessionStorage.getItem("alertaPagaresVistaSesion")) return vencidos.length;

    sessionStorage.setItem("alertaPagaresVistaSesion", "1");

    const totalVencido = vencidos.reduce((s, p) => s + (p.monto || 0), 0);

    const filas = vencidos.map(p => {
        const cuenta = cuentasPorCobrar.find(c => c.folio === p.folio);
        const cliente = cuenta ? cuenta.nombre : (p.clienteNombre || p.folio || '—');
        const diasAtraso = Math.floor((hoy - new Date(p.fechaVencimiento)) / (1000 * 60 * 60 * 24));
        return `<tr style="border-bottom:1px solid #fecaca;">
            <td style="padding:8px 10px;">${cliente}</td>
            <td style="padding:8px 10px; color:#1d4ed8; font-weight:bold;">${p.folio || '—'}</td>
            <td style="padding:8px 10px;">${p.fechaVencimiento ? window.formatearFechaCortaMX(p.fechaVencimiento) : '—'}</td>
            <td style="padding:8px 10px; text-align:right; font-weight:bold;">${dinero(p.monto || 0)}</td>
            <td style="padding:8px 10px; text-align:center; color:#dc2626; font-weight:bold;">${diasAtraso} día(s)</td>
        </tr>`;
    }).join('');

    const modalHTML = `
        <div data-modal="alerta-pagares-vencidos" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:9000; display:flex; justify-content:center; align-items:center; padding:20px;">
            <div style="background:white; border-radius:15px; width:95%; max-width:750px; max-height:90vh; overflow-y:auto; box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                <div style="background:#b45309; padding:20px 24px; border-radius:15px 15px 0 0; display:flex; justify-content:space-between; align-items:center;">
                    <h2 style="margin:0; color:white; font-size:20px;">🗂️ Pagarés sin aplicar (documental)</h2>
                    <button onclick="document.querySelector('[data-modal=&quot;alerta-pagares-vencidos&quot;]')?.remove();"
                            style="background:rgba(255,255,255,0.2); border:none; color:white; font-size:22px; cursor:pointer; border-radius:6px; padding:4px 10px; line-height:1;">✕</button>
                </div>
                <div style="padding:24px;">
                    <p style="margin:0 0 14px; color:#78350f; font-size:13px; background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:10px 14px;">
                        💡 Esto es un pendiente <b>documental</b>: el pagaré pasó su fecha sin marcarse como pagado, pero el cliente puede ya estar al corriente por antigüedad de abonos. Para saber si realmente debes cobrarle, revisa la alerta de "Cuentas sin pago reciente".
                    </p>
                    <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:14px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center;">
                        <span style="color:#92400e; font-weight:bold;">Monto en pagarés sin aplicar: ${dinero(totalVencido)}</span>
                        <span style="background:#b45309; color:white; padding:4px 12px; border-radius:9999px; font-size:14px; font-weight:bold;">${vencidos.length} pagaré(s)</span>
                    </div>
                    <div style="overflow-x:auto; margin-bottom:20px;">
                        <table style="width:100%; border-collapse:collapse; font-size:14px;">
                            <thead>
                                <tr style="background:#fffbeb;">
                                    <th style="padding:10px; text-align:left; color:#92400e;">Cliente</th>
                                    <th style="padding:10px; text-align:left; color:#92400e;">Folio</th>
                                    <th style="padding:10px; text-align:left; color:#92400e;">Vencimiento</th>
                                    <th style="padding:10px; text-align:right; color:#92400e;">Monto</th>
                                    <th style="padding:10px; text-align:center; color:#92400e;">Días sin marcar</th>
                                </tr>
                            </thead>
                            <tbody>${filas}</tbody>
                        </table>
                    </div>
                    <div style="display:flex; gap:12px; justify-content:flex-end;">
                        <button onclick="navA('cobranzaesperada'); document.querySelector('[data-modal=&quot;alerta-pagares-vencidos&quot;]')?.remove();"
                                style="padding:10px 20px; background:#b45309; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:14px;">
                            📊 Ver Cobranza
                        </button>
                        <button onclick="document.querySelector('[data-modal=&quot;alerta-pagares-vencidos&quot;]')?.remove();"
                                style="padding:10px 20px; background:#6b7280; color:white; border:none; border-radius:6px; cursor:pointer; font-size:14px;">
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    return vencidos.length;
}

// Version vigente: alerta de cuentas activas sin pago reciente.
function _dashboardParseFecha(valor) {
    if (!valor) return null;
    if (typeof window.parseFechaMX === 'function') {
        const f = window.parseFechaMX(valor);
        if (f && !isNaN(f.getTime())) return f;
    }
    if (typeof valor === 'number') {
        const f = new Date(valor);
        return isNaN(f.getTime()) ? null : f;
    }
    const txt = String(valor).trim();
    const iso = txt.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12, 0, 0);
    const mx = txt.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (mx) return new Date(Number(mx[3]), Number(mx[2]) - 1, Number(mx[1]), 12, 0, 0);
    const f = new Date(valor);
    return isNaN(f.getTime()) ? null : f;
}

function _dashboardInicioDia(fecha) {
    return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 12, 0, 0);
}

function _dashboardUltimoPagoCuenta(cuenta) {
    const fechas = [];
    (Array.isArray(cuenta.abonos) ? cuenta.abonos : []).forEach(abono => {
        const estado = String(abono.estado || abono.estatus || '').toLowerCase();
        if (estado.includes('cancel') || estado.includes('anulad')) return;
        const monto = Number(abono.monto || abono.abono || abono.importe || 0);
        if (monto <= 0) return;
        const fecha = _dashboardParseFecha(abono.fechaAbonoIso || abono.fechaAbono || abono.fechaPago || abono.fecha || abono.createdAt);
        if (fecha) fechas.push(fecha);
    });
    if (fechas.length > 0) return fechas.sort((a, b) => b - a)[0];
    return _dashboardParseFecha(cuenta.fechaVenta || cuenta.fecha || cuenta.fechaRegistro || cuenta.createdAt);
}

function _dashboardSaldoCuenta(cuenta, pagaresSistema) {
    if (typeof window._calcularEstadoCuenta === 'function') {
        const estado = window._calcularEstadoCuenta(cuenta.folio);
        if (estado) return Number(estado.saldoTotal || estado.saldoActual || 0);
    }
    const saldoCuenta = Number(cuenta.saldoActual ?? cuenta.saldoPendiente ?? cuenta.saldo ?? 0);
    if (saldoCuenta > 0) return saldoCuenta;
    return pagaresSistema
        .filter(p => p.folio === cuenta.folio && !["Pagado", "Cancelado"].includes(p.estado))
        .reduce((s, p) => s + Math.max(0, Number(p.monto || 0) - Number(p.montoAbonado || 0)), 0);
}

function verificarAlertasCuentasSinPago() {
    const pagaresSistema = StorageService.get("pagaresSistema", []);
    const cuentasPorCobrar = StorageService.get("cuentasPorCobrar", []);
    const hoy = _dashboardInicioDia(new Date());

    const cuentasSinPago = cuentasPorCobrar
        .filter(c => c && !_dashboardCuentaCancelada(c) && !c.incobrable && String(c.estado || c.estatus || '').toLowerCase() !== 'saldado')
        .map(cuenta => {
            const saldo = _dashboardSaldoCuenta(cuenta, pagaresSistema);
            const ultimoPago = _dashboardUltimoPagoCuenta(cuenta);
            if (saldo <= 0 || !ultimoPago) return null;
            const diasAtraso = Math.floor((hoy - _dashboardInicioDia(ultimoPago)) / (1000 * 60 * 60 * 24));
            return {
                cliente: cuenta.nombre || cuenta.clienteNombre || cuenta.cliente?.nombre || '-',
                folio: cuenta.folio || cuenta.folioVenta || '-',
                saldo,
                ultimoPago,
                diasAtraso
            };
        })
        .filter(r => r && r.diasAtraso > 30)
        .sort((a, b) => b.diasAtraso - a.diasAtraso);

    // El conteo para el badge se devuelve siempre (lo combina verificarAlertasPagares).
    // El modal de aviso si respeta "una vez por sesion" para no ser repetitivo.
    if (cuentasSinPago.length === 0 || sessionStorage.getItem("alertaCuentasSinPagoVistaSesion")) return cuentasSinPago.length;

    sessionStorage.setItem("alertaCuentasSinPagoVistaSesion", "1");

    const totalSaldo = cuentasSinPago.reduce((s, r) => s + r.saldo, 0);
    const filas = cuentasSinPago.map(r => `
        <tr style="border-bottom:1px solid #fed7aa;">
            <td style="padding:8px 10px;">${r.cliente}</td>
            <td style="padding:8px 10px; color:#1d4ed8; font-weight:bold;">${r.folio}</td>
            <td style="padding:8px 10px;">${window.formatearFechaCortaMX ? window.formatearFechaCortaMX(r.ultimoPago) : r.ultimoPago.toLocaleDateString('es-MX')}</td>
            <td style="padding:8px 10px; text-align:right; font-weight:bold;">${dinero(r.saldo)}</td>
            <td style="padding:8px 10px; text-align:center; color:#c2410c; font-weight:bold;">${r.diasAtraso} dia(s)</td>
        </tr>`).join('');

    const modalHTML = `
        <div data-modal="alerta-cuentas-sin-pago" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:9000; display:flex; justify-content:center; align-items:center; padding:20px;">
            <div style="background:white; border-radius:15px; width:95%; max-width:780px; max-height:90vh; overflow-y:auto; box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                <div style="background:#c2410c; padding:20px 24px; border-radius:15px 15px 0 0; display:flex; justify-content:space-between; align-items:center;">
                    <h2 style="margin:0; color:white; font-size:20px;">Cuentas sin pago reciente</h2>
                    <button onclick="document.querySelector('[data-modal=&quot;alerta-cuentas-sin-pago&quot;]')?.remove();"
                            style="background:rgba(255,255,255,0.2); border:none; color:white; font-size:22px; cursor:pointer; border-radius:6px; padding:4px 10px; line-height:1;">x</button>
                </div>
                <div style="padding:24px;">
                    <div style="background:#fff7ed; border:1px solid #fed7aa; border-radius:8px; padding:14px; margin-bottom:16px; display:flex; justify-content:space-between; gap:12px; align-items:center; flex-wrap:wrap;">
                        <span style="color:#9a3412; font-weight:bold;">Saldo en seguimiento: ${dinero(totalSaldo)}</span>
                        <span style="background:#c2410c; color:white; padding:4px 12px; border-radius:9999px; font-size:14px; font-weight:bold;">${cuentasSinPago.length} cuenta(s)</span>
                    </div>
                    <div style="overflow-x:auto; margin-bottom:20px;">
                        <table style="width:100%; border-collapse:collapse; font-size:14px;">
                            <thead>
                                <tr style="background:#fff7ed;">
                                    <th style="padding:10px; text-align:left; color:#9a3412;">Cliente</th>
                                    <th style="padding:10px; text-align:left; color:#9a3412;">Folio</th>
                                    <th style="padding:10px; text-align:left; color:#9a3412;">Ultima fecha de pago</th>
                                    <th style="padding:10px; text-align:right; color:#9a3412;">Saldo</th>
                                    <th style="padding:10px; text-align:center; color:#9a3412;">Dias desde ultimo pago</th>
                                </tr>
                            </thead>
                            <tbody>${filas}</tbody>
                        </table>
                    </div>
                    <div style="display:flex; gap:12px; justify-content:flex-end;">
                        <button onclick="navA('cuentasxcobrar'); document.querySelector('[data-modal=&quot;alerta-cuentas-sin-pago&quot;]')?.remove();"
                                style="padding:10px 20px; background:#c2410c; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:14px;">
                            Ver cuentas
                        </button>
                        <button onclick="document.querySelector('[data-modal=&quot;alerta-cuentas-sin-pago&quot;]')?.remove();"
                                style="padding:10px 20px; background:#6b7280; color:white; border:none; border-radius:6px; cursor:pointer; font-size:14px;">
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    return cuentasSinPago.length;
}

// Orquestador: corre ambas verificaciones (cuentas sin pago por antigüedad +
// pagares vencidos por fecha) pero ya NO las mezcla en un solo numero.
// La logica de negocio real es antigüedad de abonos, asi que esa es la que
// manda en el badge principal (rojo). "Pagares vencidos" es un tema documental
// (el pagare no se ha marcado aunque el cliente ya haya pagado), asi que se
// re-prioriza a un badge secundario, mas discreto, junto al principal.
function verificarAlertasPagares() {
    const totalVencidos = verificarAlertasPagaresVencidos();
    const totalSinPago = verificarAlertasCuentasSinPago();

    const badgePrincipal = document.getElementById("badgeCobranzaVencidos");
    if (badgePrincipal) {
        if (totalSinPago > 0) {
            badgePrincipal.textContent = totalSinPago > 99 ? '99+' : totalSinPago;
            badgePrincipal.style.display = 'inline-block';
        } else {
            badgePrincipal.style.display = 'none';
        }
    }

    const badgeDocumental = document.getElementById("badgeCobranzaDocumental");
    if (badgeDocumental) {
        if (totalVencidos > 0) {
            badgeDocumental.textContent = totalVencidos > 99 ? '99+' : totalVencidos;
            badgeDocumental.style.display = 'inline-block';
        } else {
            badgeDocumental.style.display = 'none';
        }
    }
}

window.renderDashboard = renderDashboard;
window.verificarAlertasPagares = verificarAlertasPagares;
window.verificarAlertasPagaresVencidos = verificarAlertasPagaresVencidos;
window.verificarAlertasCuentasSinPago = verificarAlertasCuentasSinPago;
