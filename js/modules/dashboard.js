// ===== DASHBOARD PRINCIPAL =====

function renderDashboard() {
    const contenedor = document.getElementById("dashboardContenido");
    if (!contenedor) return;

    const ventasRegistradas = StorageService.get("ventasRegistradas", []);
    const cuentasPorCobrar = StorageService.get("cuentasPorCobrar", []);
    const pagaresSistema = StorageService.get("pagaresSistema", []);
    const movimientosCaja = StorageService.get("movimientosCaja", []);

    const hoy = new Date();
    const hoyStr = hoy.toISOString().slice(0, 10);
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - 6);
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    // KPI: Ventas del día
    const ventasHoy = ventasRegistradas.filter(v => {
        const f = (v.fechaVenta || v.fechaIso || '').slice(0, 10);
        return f === hoyStr;
    });
    const totalHoy = ventasHoy.reduce((s, v) => s + (v.total || v.totalVenta || 0), 0);

    // KPI: Ventas de la semana
    const ventasSemana = ventasRegistradas.filter(v => {
        const f = new Date((v.fechaVenta || v.fechaIso || ''));
        return f >= inicioSemana && f <= hoy;
    });
    const totalSemana = ventasSemana.reduce((s, v) => s + (v.total || v.totalVenta || 0), 0);

    // KPI: Ventas del mes
    const ventasMes = ventasRegistradas.filter(v => {
        const f = new Date((v.fechaVenta || v.fechaIso || ''));
        return f >= inicioMes && f <= hoy;
    });
    const totalMes = ventasMes.reduce((s, v) => s + (v.total || v.totalVenta || 0), 0);

    // KPI: Saldo CxC pendiente
    const cxcPendientes = cuentasPorCobrar.filter(c => c.estado !== "Saldado");
    const saldoCxC = cxcPendientes.reduce((s, c) => {
        const pagaresF = pagaresSistema.filter(p => p.folio === c.folio && (p.estado === "Pendiente" || p.estado === "Parcial" || p.estado === "Vencido"));
        return s + pagaresF.reduce((a, p) => a + (p.monto || 0), 0);
    }, 0);

    // KPI: Saldo en caja/bancos
    const ingresos = movimientosCaja.reduce((s, m) => s + ((m.tipo === 'ingreso' || m.tipo === 'Ingreso') ? (m.monto || 0) : 0), 0);
    const egresos = movimientosCaja.reduce((s, m) => s + ((m.tipo === 'egreso' || m.tipo === 'Egreso') ? (m.monto || 0) : 0), 0);
    const saldoCaja = ingresos - egresos;

    // KPI: Pagarés vencidos hoy
    const pagaresVencidosHoy = pagaresSistema.filter(p => {
        if (p.estado === "Pagado" || p.estado === "Cancelado") return false;
        const fv = (p.fechaVencimiento || '').slice(0, 10);
        return fv === hoyStr;
    });
    const cantVencHoy = pagaresVencidosHoy.length;
    const montoVencHoy = pagaresVencidosHoy.reduce((s, p) => s + (p.monto || 0), 0);

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
        .sort((a, b) => new Date(b.fechaVenta || b.fechaIso || 0) - new Date(a.fechaVenta || a.fechaIso || 0))
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
                <td style="padding:8px 10px;">${p.fechaVencimiento || '—'}</td>
                <td style="padding:8px 10px; text-align:right; font-weight:bold;">${dinero(p.monto || 0)}</td>
                <td style="padding:8px 10px; text-align:center; font-weight:bold; color:${colorDias};">${diasRestantes} día(s)</td>
            </tr>`;
        }).join('');

    const ventasFilas = ventasRecientes.length === 0
        ? `<tr><td colspan="4" style="padding:16px; text-align:center; color:#6b7280;">Sin ventas registradas</td></tr>`
        : ventasRecientes.map(v => {
            const fecha = v.fechaVenta || v.fechaIso
                ? new Date(v.fechaVenta || v.fechaIso).toLocaleDateString('es-MX')
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
function verificarAlertasPagares() {
    // No repetir en la misma sesión
    if (sessionStorage.getItem("alertaPagaresVistaSesion")) return;

    const pagaresSistema = StorageService.get("pagaresSistema", []);
    const cuentasPorCobrar = StorageService.get("cuentasPorCobrar", []);
    const hoy = new Date();
    const hoyStr = hoy.toISOString().slice(0, 10);

    const vencidos = pagaresSistema.filter(p => {
        if (p.estado === "Pagado" || p.estado === "Cancelado") return false;
        return (p.fechaVencimiento || '') < hoyStr;
    });

    // Actualizar badge en menú
    const badge = document.getElementById("badgeCobranzaVencidos");
    if (badge) {
        if (vencidos.length > 0) {
            badge.textContent = vencidos.length;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }

    if (vencidos.length === 0) return;

    sessionStorage.setItem("alertaPagaresVistaSesion", "1");

    const totalVencido = vencidos.reduce((s, p) => s + (p.monto || 0), 0);

    const filas = vencidos.map(p => {
        const cuenta = cuentasPorCobrar.find(c => c.folio === p.folio);
        const cliente = cuenta ? cuenta.nombre : (p.clienteNombre || p.folio || '—');
        const diasAtraso = Math.floor((hoy - new Date(p.fechaVencimiento)) / (1000 * 60 * 60 * 24));
        return `<tr style="border-bottom:1px solid #fecaca;">
            <td style="padding:8px 10px;">${cliente}</td>
            <td style="padding:8px 10px; color:#1d4ed8; font-weight:bold;">${p.folio || '—'}</td>
            <td style="padding:8px 10px;">${p.fechaVencimiento || '—'}</td>
            <td style="padding:8px 10px; text-align:right; font-weight:bold;">${dinero(p.monto || 0)}</td>
            <td style="padding:8px 10px; text-align:center; color:#dc2626; font-weight:bold;">${diasAtraso} día(s)</td>
        </tr>`;
    }).join('');

    const modalHTML = `
        <div data-modal="alerta-pagares-vencidos" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:9000; display:flex; justify-content:center; align-items:center; padding:20px;">
            <div style="background:white; border-radius:15px; width:95%; max-width:750px; max-height:90vh; overflow-y:auto; box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                <div style="background:#dc2626; padding:20px 24px; border-radius:15px 15px 0 0; display:flex; justify-content:space-between; align-items:center;">
                    <h2 style="margin:0; color:white; font-size:20px;">⚠️ Pagarés Vencidos</h2>
                    <button onclick="document.querySelector('[data-modal=&quot;alerta-pagares-vencidos&quot;]')?.remove();"
                            style="background:rgba(255,255,255,0.2); border:none; color:white; font-size:22px; cursor:pointer; border-radius:6px; padding:4px 10px; line-height:1;">✕</button>
                </div>
                <div style="padding:24px;">
                    <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:14px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center;">
                        <span style="color:#991b1b; font-weight:bold;">Total vencido: ${dinero(totalVencido)}</span>
                        <span style="background:#dc2626; color:white; padding:4px 12px; border-radius:9999px; font-size:14px; font-weight:bold;">${vencidos.length} pagaré(s)</span>
                    </div>
                    <div style="overflow-x:auto; margin-bottom:20px;">
                        <table style="width:100%; border-collapse:collapse; font-size:14px;">
                            <thead>
                                <tr style="background:#fef2f2;">
                                    <th style="padding:10px; text-align:left; color:#991b1b;">Cliente</th>
                                    <th style="padding:10px; text-align:left; color:#991b1b;">Folio</th>
                                    <th style="padding:10px; text-align:left; color:#991b1b;">Vencimiento</th>
                                    <th style="padding:10px; text-align:right; color:#991b1b;">Monto</th>
                                    <th style="padding:10px; text-align:center; color:#991b1b;">Días Atraso</th>
                                </tr>
                            </thead>
                            <tbody>${filas}</tbody>
                        </table>
                    </div>
                    <div style="display:flex; gap:12px; justify-content:flex-end;">
                        <button onclick="navA('cobranzaesperada'); document.querySelector('[data-modal=&quot;alerta-pagares-vencidos&quot;]')?.remove();"
                                style="padding:10px 20px; background:#dc2626; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:14px;">
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
}

window.renderDashboard = renderDashboard;
window.verificarAlertasPagares = verificarAlertasPagares;
