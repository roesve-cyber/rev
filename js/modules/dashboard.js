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

    // KPI: Saldo CxC pendiente y análisis de cartera por TENDENCIA DE PAGO
    // (mismo criterio que Reportes de Cobranza y la alerta de cartera: días
    // transcurridos desde el último abono registrado, no fecha de pagaré).
    const cartera = window.CobranzaRiskService
        ? window.CobranzaRiskService.analizarCartera(cuentasPorCobrar, pagaresSistema, { hoy })
        : null;

    let saldoCxC;
    if (cartera) {
        saldoCxC = cartera.resumen.total.saldo;
    } else {
        // Fallback si el servicio de riesgo no está cargado
        const cxcPendientesFallback = cuentasPorCobrar.filter(c => c.estado !== "Saldado");
        saldoCxC = cxcPendientesFallback.reduce((s, c) => {
            if (typeof window._calcularEstadoCuenta === 'function') {
                const estado = window._calcularEstadoCuenta(c.folio);
                if (estado) return s + Number(estado.saldoTotal || 0);
            }
            const pagaresF = pagaresSistema.filter(p => p.folio === c.folio && (p.estado === "Pendiente" || p.estado === "Parcial" || p.estado === "Vencido"));
            return s + pagaresF.reduce((a, p) => a + Math.max(0, Number(p.monto || 0) - Number(p.montoAbonado || 0)), 0);
        }, 0);
    }
    const cxcPendientes = cuentasPorCobrar.filter(c => c.estado !== "Saldado");

    // KPI: Cartera en riesgo (alto riesgo + alerta total, según tendencia de pago)
    const cuentasEnRiesgo = cartera ? [...cartera.grupos.alto, ...cartera.grupos.alerta] : [];
    const saldoEnRiesgo = cartera ? (cartera.resumen.alto.saldo + cartera.resumen.alerta.saldo) : 0;

    // KPI: Saldo en caja/bancos — usa el mismo cálculo POR CUENTA que el módulo
    // "Cuentas Bancarias" (bancos.js), que es el que se concilia contra la
    // realidad y se cuida que cuadre. Antes se sumaban TODOS los movimientos
    // de movimientosCaja sin distinguir a qué cuenta pertenecían (incluyendo
    // movimientos de tarjetas de crédito y otros que no son efectivo/débito),
    // lo que producía un número inflado o simplemente incorrecto.
    let saldoCaja;
    if (typeof window._bancosCalcularSaldosDesdeMovimientos === 'function') {
        const { saldosCajas, saldosDebito } = window._bancosCalcularSaldosDesdeMovimientos();
        const totalCajas = Object.values(saldosCajas).reduce((s, v) => s + v, 0);
        const totalDebito = Object.values(saldosDebito).reduce((s, v) => s + v, 0);
        saldoCaja = totalCajas + totalDebito;
    } else {
        // Fallback si el módulo de bancos no está cargado
        const ingresos = movimientosCaja.reduce((s, m) => s + ((m.tipo === 'ingreso' || m.tipo === 'Ingreso') ? (m.monto || 0) : 0), 0);
        const egresos = movimientosCaja.reduce((s, m) => s + ((m.tipo === 'egreso' || m.tipo === 'Egreso') ? (m.monto || 0) : 0), 0);
        saldoCaja = ingresos - egresos;
    }

    // Ventas recientes: últimas 5
    const ventasRecientes = [...ventasRegistradas]
        .sort((a, b) => parseSeguro(b.fechaVenta || b.fechaIso || b.fecha) - parseSeguro(a.fechaVenta || a.fechaIso || a.fecha))
        .slice(0, 5);

    // ── Render ──────────────────────────────────────────────
    const kpiStyle = (bg, border) =>
        `background:${bg}; border-left:5px solid ${border}; padding:20px; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.06);`;

    const cobranzaFilas = cuentasEnRiesgo.length === 0
        ? `<tr><td colspan="6" style="padding:16px; text-align:center; color:#6b7280;">Sin cuentas en riesgo alto o alerta total</td></tr>`
        : cuentasEnRiesgo.slice(0, 10).map(r => {
            const cuenta = r.cuenta || {};
            const cliente = cuenta.nombre || cuenta.clienteNombre || '—';
            const folio = cuenta.folio || cuenta.folioVenta || '—';
            const fechaTxt = window.CobranzaRiskService.formatearFecha(r.fechaUltimoPago);
            return `<tr style="border-bottom:1px solid #f3f4f6;">
                <td style="padding:8px 10px;">${cliente}</td>
                <td style="padding:8px 10px; color:#1d4ed8; font-weight:bold;">${folio}</td>
                <td style="padding:8px 10px;">${fechaTxt}</td>
                <td style="padding:8px 10px; text-align:right; font-weight:bold;">${dinero(r.saldo || 0)}</td>
                <td style="padding:8px 10px; text-align:center;">
                    <span style="background:${r.bg}; color:${r.color}; border:1px solid ${r.borde}; border-radius:9999px; padding:3px 10px; font-size:11px; font-weight:bold;">${r.nivelRiesgo}</span>
                </td>
                <td style="padding:8px 10px; text-align:center; font-weight:bold; color:#c2410c;">${r.diasSinPago} día(s)</td>
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

            <div style="${kpiStyle(cuentasEnRiesgo.length > 0 ? '#fef2f2' : '#f0fdf4', cuentasEnRiesgo.length > 0 ? '#ef4444' : '#22c55e')}">
                <div style="font-size:12px; color:${cuentasEnRiesgo.length > 0 ? '#b91c1c' : '#15803d'}; font-weight:bold; text-transform:uppercase;">⚠️ Cartera en Riesgo</div>
                <div style="font-size:26px; font-weight:bold; color:${cuentasEnRiesgo.length > 0 ? '#991b1b' : '#166534'}; margin-top:6px;">${cuentasEnRiesgo.length}</div>
                <div style="font-size:12px; color:#6b7280; margin-top:4px;">${cuentasEnRiesgo.length > 0 ? dinero(saldoEnRiesgo) : 'Sin cuentas en alto riesgo'}</div>
            </div>

        </div>

        <!-- Cartera en riesgo (tendencia de pago) -->
        <div style="background:white; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.06); padding:20px; margin-bottom:24px;">
            <h3 style="margin:0 0 4px 0; color:#1e3a5f;">📋 Cartera con Seguimiento Prioritario</h3>
            <p style="margin:0 0 14px 0; font-size:12px; color:#6b7280;">Cuentas en alto riesgo o alerta total, según días transcurridos desde el último abono (mismo criterio que Reportes de Cobranza), no fechas de pagaré individuales.</p>
            <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; font-size:14px;">
                    <thead>
                        <tr style="background:#f3f4f6;">
                            <th style="padding:10px; text-align:left;">Cliente</th>
                            <th style="padding:10px; text-align:left;">Folio</th>
                            <th style="padding:10px; text-align:left;">Último pago</th>
                            <th style="padding:10px; text-align:right;">Saldo</th>
                            <th style="padding:10px; text-align:center;">Nivel</th>
                            <th style="padding:10px; text-align:center;">Días sin pago</th>
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

// ===== AVISO UNICO DE CARTERA CXC =====
// Antes existian dos modales de aviso al abrir el sistema (pagares vencidos por
// fecha documental + cuentas sin pago por antiguedad de abonos), con criterios
// distintos entre si y distintos del resto del sistema. Se consolida en un solo
// aviso que usa exactamente la misma valuacion de atraso que ya usan los reportes,
// notificaciones y el detalle de cuenta: CobranzaRiskService.analizarCartera
// (dias transcurridos desde el ultimo abono registrado, o desde la venta si no
// hay abonos; ver js/services/cobranza-risk-service.js).
function verificarAlertasPagares() {
    const badge = document.getElementById("badgeCobranzaVencidos");
    const badgeDocumental = document.getElementById("badgeCobranzaDocumental");
    if (badgeDocumental) badgeDocumental.style.display = 'none';

    if (!window.CobranzaRiskService || typeof window.CobranzaRiskService.analizarCartera !== 'function') {
        if (badge) badge.style.display = 'none';
        return 0;
    }

    const cuentasPorCobrar = StorageService.get("cuentasPorCobrar", []);
    const pagaresSistema = StorageService.get("pagaresSistema", []);
    const hoy = new Date();

    const cartera = window.CobranzaRiskService.analizarCartera(cuentasPorCobrar, pagaresSistema, { hoy });
    const alertas = cartera.alertas || [];

    if (badge) {
        if (alertas.length > 0) {
            badge.textContent = alertas.length > 99 ? '99+' : alertas.length;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }

    if (alertas.length === 0 || sessionStorage.getItem("alertaCarteraCxCVistaSesion")) return alertas.length;
    sessionStorage.setItem("alertaCarteraCxCVistaSesion", "1");

    const totalSaldo = alertas.reduce((s, r) => s + Number(r.saldo || 0), 0);

    const filas = alertas.map(r => {
        const cuenta = r.cuenta || {};
        const cliente = cuenta.nombre || cuenta.clienteNombre || '-';
        const folio = cuenta.folio || cuenta.folioVenta || '-';
        const fechaTxt = window.CobranzaRiskService.formatearFecha(r.fechaUltimoPago);
        return `<tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:8px 10px;">${cliente}</td>
            <td style="padding:8px 10px; color:#1d4ed8; font-weight:bold;">${folio}</td>
            <td style="padding:8px 10px;">${fechaTxt}</td>
            <td style="padding:8px 10px; text-align:right; font-weight:bold;">${dinero(r.saldo || 0)}</td>
            <td style="padding:8px 10px; text-align:center;">
                <span style="background:${r.bg}; color:${r.color}; border:1px solid ${r.borde}; border-radius:9999px; padding:3px 10px; font-size:11px; font-weight:bold;">${r.nivelRiesgo}</span>
            </td>
            <td style="padding:8px 10px; text-align:center; font-weight:bold; color:#c2410c;">${r.diasSinPago} dia(s)</td>
        </tr>`;
    }).join('');

    const modalHTML = `
        <div data-modal="alerta-cartera-cxc" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:9000; display:flex; justify-content:center; align-items:center; padding:20px;">
            <div style="background:white; border-radius:15px; width:95%; max-width:820px; max-height:90vh; overflow-y:auto; box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                <div style="background:#c2410c; padding:20px 24px; border-radius:15px 15px 0 0; display:flex; justify-content:space-between; align-items:center;">
                    <h2 style="margin:0; color:white; font-size:20px;">Cuentas por cobrar con atraso</h2>
                    <button onclick="document.querySelector('[data-modal=&quot;alerta-cartera-cxc&quot;]')?.remove();"
                            style="background:rgba(255,255,255,0.2); border:none; color:white; font-size:22px; cursor:pointer; border-radius:6px; padding:4px 10px; line-height:1;">✕</button>
                </div>
                <div style="padding:24px;">
                    <p style="margin:0 0 14px; color:#78350f; font-size:13px; background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:10px 14px;">
                        El atraso se calcula por dias transcurridos desde el ultimo abono registrado (o desde la venta si aun no hay abonos). Es el mismo criterio que usan los reportes de cobranza y el estado de cuenta.
                    </p>
                    <div style="background:#fff7ed; border:1px solid #fed7aa; border-radius:8px; padding:14px; margin-bottom:16px; display:flex; justify-content:space-between; gap:12px; align-items:center; flex-wrap:wrap;">
                        <span style="color:#9a3412; font-weight:bold;">Saldo en riesgo: ${dinero(totalSaldo)}</span>
                        <span style="background:#c2410c; color:white; padding:4px 12px; border-radius:9999px; font-size:14px; font-weight:bold;">${alertas.length} cuenta(s)</span>
                    </div>
                    <div style="overflow-x:auto; margin-bottom:20px;">
                        <table style="width:100%; border-collapse:collapse; font-size:14px;">
                            <thead>
                                <tr style="background:#fff7ed;">
                                    <th style="padding:10px; text-align:left; color:#9a3412;">Cliente</th>
                                    <th style="padding:10px; text-align:left; color:#9a3412;">Folio</th>
                                    <th style="padding:10px; text-align:left; color:#9a3412;">Ultimo pago</th>
                                    <th style="padding:10px; text-align:right; color:#9a3412;">Saldo</th>
                                    <th style="padding:10px; text-align:center; color:#9a3412;">Nivel</th>
                                    <th style="padding:10px; text-align:center; color:#9a3412;">Dias sin pago</th>
                                </tr>
                            </thead>
                            <tbody>${filas}</tbody>
                        </table>
                    </div>
                    <div style="display:flex; gap:12px; justify-content:flex-end;">
                        <button onclick="navA('cuentasxcobrar'); document.querySelector('[data-modal=&quot;alerta-cartera-cxc&quot;]')?.remove();"
                                style="padding:10px 20px; background:#c2410c; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:14px;">
                            Ver cuentas
                        </button>
                        <button onclick="document.querySelector('[data-modal=&quot;alerta-cartera-cxc&quot;]')?.remove();"
                                style="padding:10px 20px; background:#6b7280; color:white; border:none; border-radius:6px; cursor:pointer; font-size:14px;">
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    return alertas.length;
}

window.renderDashboard = renderDashboard;
window.verificarAlertasPagares = verificarAlertasPagares;
