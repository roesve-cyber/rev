// ================================================================
// 📊 MÓDULO DE REPORTES AVANZADOS PARA CARTERA DE CRÉDITO
// Versión: 3.0 — Lógica de Saldo Neto Esperado (SNE) y Matriz Excel
//
// Reportes incluidos:
//  1. renderARC_v3()         → ARC mejorado con lógica SNE
//  2. renderARCTablaExcel()  → Matriz visual tipo Excel
//  3. renderComportamiento() → Scorecard de comportamiento de pago
//  4. renderCobranzaMensual()→ Capital colocado vs. recuperado
//  5. renderConcentracion()  → Mapa de concentración de cartera
// ================================================================

// ─── Helpers compartidos ────────────────────────────────────────
const _rc = {
    fmt: v => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(v) || 0),
    pct: v => Number(v).toFixed(1) + '%',

    parseFecha(val) {
        if (!val || val === 'null' || val === 'undefined') return null;
        if (window.parseFechaMXOrNull) {
            try {
                const parsed = window.parseFechaMXOrNull(val);
                if (parsed && parsed.getFullYear() > 1990) return parsed;
            } catch (e) {}
        }
        if (typeof val === 'number') {
            const d = new Date(val);
            return isNaN(d.getTime()) ? null : d;
        }

        const s = String(val).trim();
        if (/^\d+$/.test(s)) {
            const d = new Date(Number(s));
            return isNaN(d.getTime()) ? null : d;
        }

        let d;
        if (s.includes('/')) {
            const parts = s.split('/');
            if (parts[0].length === 4) {
                d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12);
            } else {
                d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]), 12);
            }
        } else {
            const base = s.length > 10 ? s.split('T')[0] : s;
            const parts = base.split('-');
            if (parts.length >= 3) {
                if (parts[0].length === 4) {
                    d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12);
                } else {
                    d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]), 12);
                }
            } else {
                d = new Date(val);
            }
        }
        return (d && !isNaN(d.getTime()) && d.getFullYear() > 1990) ? d : null;
    },

    diasDesde(fecha) {
        if (!fecha) return 9999;
        const d = _rc.parseFecha(fecha);
        if (!d) return 9999;
        return Math.floor((Date.now() - d.getTime()) / 86400000);
    },

    mesKey(fecha) {
        const d = _rc.parseFecha(fecha);
        if (!d) return null;
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    },

    mesLabel(key) {
        if (!key || key.includes('NaN')) return 'S/F';
        const [y, m] = key.split('-');
        const d = new Date(+y, +m - 1, 1);
        if (isNaN(d.getTime())) return 'S/F';
        
        return new Intl.DateTimeFormat('es-MX', { month: 'short', year: 'numeric' })
            .format(d).toUpperCase();
    },

    badge(texto, bg, col) {
        return `<span style="display:inline-block;padding:3px 9px;border-radius:20px;font-size:10px;font-weight:900;background:${bg};color:${col};letter-spacing:.5px;">${texto}</span>`;
    },

    miniBar(pct, color) {
        const w = Math.min(100, Math.max(0, pct));
        return `<div style="width:100%;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden;">
            <div style="width:${w}%;height:100%;background:${color};border-radius:3px;transition:width .4s;"></div>
        </div>`;
    },

    // ──────────────────────────────────────────────────────────────
    // MOTOR CENTRAL SNE (Saldo Neto Esperado)
    // Calcula la diferencia entre lo que el cliente HA PAGADO y
    // lo que DEBERÍA haber pagado según sus pagarés vencidos a HOY.
    // Un excedente ≥ 0 significa "al corriente real" aunque el
    // sistema muestre pagarés vencidos individuales sin cerrar.
    // ──────────────────────────────────────────────────────────────
    calcularSNE(cuenta, pagaresCuenta, hoy) {
        hoy = hoy || new Date();

        // 1. ¿Cuánto debería haber pagado hasta HOY?
        let montoEsperado = 0;
        let pagaresVencidos = [];
        let pagaresProximos = [];
        let totalPlazo = 0;
        let fechaUltimoVenc = null;

        pagaresCuenta.forEach(p => {
            const fv = _rc.parseFecha(p.fechaVencimiento);
            if (!fv) return;
            totalPlazo += parseFloat(p.monto || 0);
            if (fv <= hoy && p.estado !== 'Cancelado') {
                montoEsperado += parseFloat(p.monto || 0);
                if (p.estado !== 'Pagado') pagaresVencidos.push(p);
            } else if (fv > hoy && p.estado !== 'Cancelado' && p.estado !== 'Pagado') {
                pagaresProximos.push(p);
            }
            if (!fechaUltimoVenc || fv > fechaUltimoVenc) fechaUltimoVenc = fv;
        });

        // 2. ¿Cuánto HA PAGADO realmente?
        const abonos = (cuenta.abonos || []).filter(a => !a.cancelado && !a.canceladoPorVenta && !a.canceladoPorApartado);
        const totalPagado = abonos.reduce((s, a) => s + parseFloat(a.monto || 0), 0);
        const saldoVivo = pagaresCuenta
            .filter(p => p.estado !== 'Pagado' && p.estado !== 'Cancelado')
            .reduce((s, p) => s + Math.max(0, parseFloat(p.monto || 0) - parseFloat(p.montoAbonado || 0)), 0);

        // 3. Saldo Neto Esperado
        const excedente = totalPagado - montoEsperado;
        const deficitPct = totalPlazo > 0 ? Math.abs(Math.min(0, excedente)) / totalPlazo * 100 : 0;

        // 4. Días desde el último abono
        let ultimaFechaAbono = null;
        let diasSinPagar = 9999;
        if (abonos.length > 0) {
            const fechas = abonos.map(a => _rc.parseFecha(a.fecha || a.fechaAbono)).filter(Boolean);
            ultimaFechaAbono = new Date(Math.max(...fechas.map(f => f.getTime())));
            diasSinPagar = Math.floor((hoy - ultimaFechaAbono) / 86400000);
        }

        // 5. Promedio de abono (últimos 90 días)
        const hace90 = new Date(hoy); hace90.setDate(hace90.getDate() - 90);
        const abonosRecientes = abonos.filter(a => {
            const f = _rc.parseFecha(a.fecha || a.fechaAbono);
            return f && f >= hace90;
        });
        const promedioAbono90 = abonosRecientes.length > 0
            ? abonosRecientes.reduce((s, a) => s + parseFloat(a.monto || 0), 0) / abonosRecientes.length
            : 0;

        // 6. Nivel de riesgo REAL (basado en SNE, no en conteo de pagarés)
        let nivelRiesgo, colorRiesgo, emojiRiesgo;
        if (cuenta.incobrable) {
            nivelRiesgo = 'INCOBRABLE'; colorRiesgo = '#475569'; emojiRiesgo = '⚫';
        } else if (excedente >= 0) {
            nivelRiesgo = 'AL CORRIENTE'; colorRiesgo = '#16a34a'; emojiRiesgo = '🟢';
        } else if (deficitPct < 8) {
            nivelRiesgo = 'LEVE'; colorRiesgo = '#65a30d'; emojiRiesgo = '🟡';
        } else if (deficitPct < 18) {
            nivelRiesgo = 'MODERADO'; colorRiesgo = '#d97706'; emojiRiesgo = '🟠';
        } else if (deficitPct < 35) {
            nivelRiesgo = 'EN MORA'; colorRiesgo = '#dc2626'; emojiRiesgo = '🔴';
        } else {
            nivelRiesgo = 'CRÍTICO'; colorRiesgo = '#7f1d1d'; emojiRiesgo = '🚨';
        }

        const riesgoUltimoPago = window.CobranzaRiskService
            ? window.CobranzaRiskService.analizarCuenta(cuenta, {
                hoy,
                pagaresSistema: pagaresCuenta,
                saldoPreferente: saldoVivo || cuenta.saldoActual || 0
            })
            : null;
        if (riesgoUltimoPago && riesgoUltimoPago.key !== 'saldado') {
            nivelRiesgo = riesgoUltimoPago.nivelRiesgo;
            colorRiesgo = riesgoUltimoPago.color;
            emojiRiesgo = riesgoUltimoPago.key === 'alerta' ? '!' : riesgoUltimoPago.key === 'alto' ? '!!' : riesgoUltimoPago.key === 'riesgo' ? '!' : 'OK';
            ultimaFechaAbono = riesgoUltimoPago.fechaUltimoPago;
            diasSinPagar = riesgoUltimoPago.diasSinPago;
        }

        return {
            excedente, deficitPct, montoEsperado, totalPagado,
            pagaresVencidos, pagaresProximos, totalPlazo,
            fechaUltimoVenc, ultimaFechaAbono, diasSinPagar,
            promedioAbono90, numAbonos: abonos.length,
            nivelRiesgo, colorRiesgo, emojiRiesgo, riesgoUltimoPago,
            saldoActual: saldoVivo || cuenta.saldoActual || 0,
            // 🛡️ REPARACIÓN: antes usaba el precio de CONTADO (totalContadoOriginal/
            // totalMercancia) como base para medir % cubierto/pendiente. En una venta
            // a crédito el cliente no debe el precio de contado, debe el monto
            // financiado (contado - enganche + tasa según plazo) — eso es lo que
            // saldoOriginal guarda desde que se registró la venta (ventas.js:2346) y
            // nunca se modifica con los abonos. totalPlazo (suma de pagarés) es el
            // mismo número calculado desde la fuente viva, por si saldoOriginal
            // faltara en una cuenta antigua. Sin ninguno de los dos, se cae al precio
            // de contado como último recurso (cuentas muy viejas sin ese dato).
            totalVenta: Number(cuenta.saldoOriginal || totalPlazo || cuenta.totalContadoOriginal || cuenta.totalMercancia || 0)
        };
    }
};

function _rcCuentaCancelada(cuenta) {
    return String(cuenta?.estado || cuenta?.estatus || '').toLowerCase().includes('cancel');
}

// ================================================================
// 1. ARC v3 — ANÁLISIS DE RIESGO CON LÓGICA SNE
// ================================================================
window.renderARC_v3 = function() {
    const cont = document.getElementById('arc-v3-contenido') ||
                 document.getElementById('reportes') ||
                 document.getElementById('dashboardContenido');
    if (!cont) return;

    const cxc = StorageService.get('cuentasPorCobrar', []);
    const pagaresSistema = StorageService.get('pagaresSistema', []);
    const hoy = new Date(); hoy.setHours(12, 0, 0, 0);

    const cuentasActivas = cxc.filter(c => !_rcCuentaCancelada(c) && !c.incobrable && (c.saldoActual || 0) > 0 && c.estado !== 'Saldado');
    if (!cuentasActivas.length) {
        cont.innerHTML = `<div style="padding:50px;text-align:center;background:white;border-radius:16px;margin:20px 0;">
            <div style="font-size:48px;">✅</div>
            <h3 style="color:#16a34a;">¡Cartera limpia! No hay saldos pendientes.</h3>
        </div>`;
        return;
    }

    // ── Calcular SNE para cada cuenta ─────────────────────────────
    const cuentasSNE = cuentasActivas.map(c => {
        const pagaresCuenta = pagaresSistema.filter(p => p.folio === c.folio);
        const sne = _rc.calcularSNE(c, pagaresCuenta, hoy);
        return { ...c, sne };
    });

    // ── Estadísticas globales ──────────────────────────────────────
    const totalCartera = cuentasSNE.reduce((s, c) => s + c.sne.saldoActual, 0);
    const totalVencidoReal = cuentasSNE
        .filter(c => c.sne.excedente < 0)
        .reduce((s, c) => s + Math.abs(c.sne.excedente), 0);
    const cuentasAlCorriente = cuentasSNE.filter(c => c.sne.excedente >= 0).length;
    const cuentasEnMora = cuentasSNE.filter(c => c.sne.deficitPct >= 18).length;
    window._filasParaCobranza = []; // Para el listado de cobranza

    // ── Agrupar por nivel ──────────────────────────────────────────
    const grupos = {
        'INCOBRABLE': cuentasSNE.filter(c => c.sne.nivelRiesgo === 'INCOBRABLE'),
        'Alerta total': cuentasSNE.filter(c => c.sne.nivelRiesgo === 'Alerta total'),
        'Alto riesgo': cuentasSNE.filter(c => c.sne.nivelRiesgo === 'Alto riesgo'),
        'Riesgo': cuentasSNE.filter(c => c.sne.nivelRiesgo === 'Riesgo'),
        'Bajo riesgo': cuentasSNE.filter(c => c.sne.nivelRiesgo === 'Bajo riesgo'),
        'CRÍTICO':    cuentasSNE.filter(c => c.sne.nivelRiesgo === 'CRÍTICO'),
        'EN MORA':    cuentasSNE.filter(c => c.sne.nivelRiesgo === 'EN MORA'),
        'MODERADO':   cuentasSNE.filter(c => c.sne.nivelRiesgo === 'MODERADO'),
        'LEVE':       cuentasSNE.filter(c => c.sne.nivelRiesgo === 'LEVE'),
        'AL CORRIENTE': cuentasSNE.filter(c => c.sne.nivelRiesgo === 'AL CORRIENTE'),
    };

    const cfgGrupos = [
        { id: 'Alerta total', label: 'ALERTA TOTAL', bg: '#f3e8ff', col: '#581c87', borde: '#7e22ce' },
        { id: 'Alto riesgo', label: 'ALTO RIESGO', bg: '#fef2f2', col: '#991b1b', borde: '#ef4444' },
        { id: 'Riesgo', label: 'RIESGO', bg: '#fffbeb', col: '#92400e', borde: '#f59e0b' },
        { id: 'Bajo riesgo', label: 'BAJO RIESGO', bg: '#f0fdf4', col: '#14532d', borde: '#22c55e' },
        { id: 'INCOBRABLE', label: '⚫ INCOBRABLE', bg: '#1e293b', col: 'white',  borde: '#475569' },
        { id: 'CRÍTICO',    label: '🚨 CRÍTICO',    bg: '#fef2f2', col: '#7f1d1d', borde: '#dc2626' },
        { id: 'EN MORA',    label: '🔴 EN MORA',    bg: '#fff7f7', col: '#991b1b', borde: '#f87171' },
        { id: 'MODERADO',   label: '🟠 MODERADO',   bg: '#fffbeb', col: '#92400e', borde: '#f59e0b' },
        { id: 'LEVE',       label: '🟡 LEVE',       bg: '#fefce8', col: '#713f12', borde: '#eab308' },
        { id: 'AL CORRIENTE', label: '🟢 AL CORRIENTE', bg: '#f0fdf4', col: '#14532d', borde: '#22c55e' },
    ];

    let tarjetasHTML = '';
    cfgGrupos.forEach(cfg => {
        const lista = grupos[cfg.id];
        if (!lista.length) return;
        lista.sort((a, b) => a.sne.excedente - b.sne.excedente);

        tarjetasHTML += `
        <div style="margin-bottom:28px;">
            <div style="background:${cfg.borde};color:white;padding:10px 18px;border-radius:10px 10px 0 0;font-weight:900;font-size:13px;display:flex;justify-content:space-between;">
                <span>${cfg.label}</span>
                <span>${lista.length} cuenta(s) · ${_rc.fmt(lista.reduce((s,c)=>s+c.sne.saldoActual,0))}</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:12px;padding:14px;background:${cfg.bg};border:1px solid ${cfg.borde};border-top:none;border-radius:0 0 10px 10px;">
        `;

        lista.forEach(c => {
            const indexFila = window._filasParaCobranza.length;
            window._filasParaCobranza.push(c);
            const s = c.sne;
            const pctPagado = s.totalVenta > 0 ? (s.totalPagado / s.totalVenta * 100) : 0;
            const exStr = s.excedente >= 0
                ? `<span style="color:#16a34a;font-weight:900;">+${_rc.fmt(s.excedente)} adelantado</span>`
                : `<span style="color:#dc2626;font-weight:900;">${_rc.fmt(s.excedente)} de déficit (${_rc.pct(s.deficitPct)} del total)</span>`;

            const diasAbono = s.diasSinPagar === 9999 ? 'Sin abonos' : `hace ${s.diasSinPagar}d`;
            const colorDiasAbono = s.diasSinPagar > 60 ? '#dc2626' : s.diasSinPagar > 30 ? '#d97706' : '#16a34a';

            tarjetasHTML += `
            <div style="background:white;border-radius:10px;padding:15px;border-left:4px solid ${s.colorRiesgo};box-shadow:0 2px 8px rgba(0,0,0,0.06);">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
                    <div style="display:flex; gap:8px; align-items:flex-start;">
                        <input type="checkbox" class="chk-cobrador" value="${indexFila}" style="width:16px; height:16px; cursor:pointer; margin-top:2px;">
                        <div>
                            <div style="font-weight:900;color:#0f172a;font-size:14px;">${c.nombre || 'Sin nombre'}${window.CxcNotas ? window.CxcNotas.badgeHtml(c.folio) : ''}</div>
                            <div style="font-size:11px;color:#64748b;">${c.folio}</div>
                        </div>
                    </div>
                    ${_rc.badge(s.emojiRiesgo + ' ' + s.nivelRiesgo, s.colorRiesgo + '20', s.colorRiesgo)}
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
                    <div style="background:#f8fafc;padding:8px;border-radius:7px;">
                        <div style="font-size:10px;color:#64748b;font-weight:bold;">SALDO ACTUAL</div>
                        <div style="font-size:16px;font-weight:900;color:#dc2626;">${_rc.fmt(s.saldoActual)}</div>
                    </div>
                    <div style="background:#f8fafc;padding:8px;border-radius:7px;">
                        <div style="font-size:10px;color:#64748b;font-weight:bold;">TOTAL PAGADO</div>
                        <div style="font-size:16px;font-weight:900;color:#16a34a;">${_rc.fmt(s.totalPagado)}</div>
                    </div>
                </div>

                <div style="background:#f1f5f9;padding:10px;border-radius:8px;margin-bottom:10px;">
                    <div style="font-size:10px;color:#475569;font-weight:bold;margin-bottom:4px;">SNE — BALANCE REAL vs. PLAN</div>
                    <div style="font-size:12px;margin-bottom:6px;">
                        Esperado a hoy: <b>${_rc.fmt(s.montoEsperado)}</b> · Pagado: <b>${_rc.fmt(s.totalPagado)}</b>
                    </div>
                    <div style="font-size:12px;">${exStr}</div>
                    ${_rc.miniBar(pctPagado, s.colorRiesgo)}
                    <div style="font-size:10px;color:#64748b;margin-top:3px;">${_rc.pct(pctPagado)} del total cubierto (${s.numAbonos} abonos)</div>
                </div>

                <div style="display:flex;justify-content:space-between;font-size:11px;color:#475569;">
                    <span>⏱ Último abono: <b style="color:${colorDiasAbono};">${diasAbono}</b></span>
                    <span>📄 ${s.pagaresVencidos.length} pagarés sin aplicar</span>
                </div>
                ${s.pagaresVencidos.length > 0 && s.excedente >= 0 ? `
                <div style="margin-top:8px;background:#eff6ff;padding:7px 10px;border-radius:6px;font-size:11px;color:#1e40af;border-left:3px solid #3b82f6;">
                    💡 Tiene ${s.pagaresVencidos.length} pagaré(s) sin aplicar pero <b>su saldo real está cubierto</b>. Solo requiere regularización documental.
                </div>` : ''}
                <div style="margin-top:8px;display:flex;gap:6px;">
                    <button onclick="abrirEstadoCuentaFolio('${c.folio}')" style="flex:1;padding:7px;background:#3b82f6;color:white;border:none;border-radius:6px;font-size:11px;font-weight:bold;cursor:pointer;">📋 Estado</button>
                    <button onclick="enviarRecordatorioWhatsApp('${c.folio}')" style="flex:1;padding:7px;background:#25D366;color:white;border:none;border-radius:6px;font-size:11px;font-weight:bold;cursor:pointer;">💬 WA</button>
                    <button onclick="marcarIncobrable('${c.folio}')" style="flex:1;padding:7px;background:#475569;color:white;border:none;border-radius:6px;font-size:11px;font-weight:bold;cursor:pointer;">⚫ Incobrable</button>
                </div>
            </div>`;
        });

        tarjetasHTML += `</div></div>`;
    });

    cont.innerHTML = `
    <div style="font-family:system-ui,sans-serif;max-width:1400px;margin:0 auto;padding:0 4px;">

        <!-- Header -->
        <div style="background:linear-gradient(135deg,#0f172a,#1e3a8a);color:white;padding:24px;border-radius:14px;margin-bottom:20px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:15px;">
                <div>
                    <h2 style="margin:0;font-size:22px;font-weight:900;">📈 ARC v3 — Análisis de Riesgo con Lógica SNE</h2>
                    <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;">
                        Clasificación por <b>Saldo Neto Esperado</b>: si el cliente ha pagado más de lo esperado hasta hoy,
                        se clasifica como <b style="color:#4ade80;">Al Corriente</b> aunque tenga pagarés individuales pendientes.
                    </p>
                </div>
                <div style="display:flex;gap:10px;flex-wrap:wrap;">
                    <button onclick="generarListadoCobranza()" style="padding:10px 16px;background:#f59e0b;color:#713f12;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-size:12px;">📋 Generar Cobranza</button>
                    <button onclick="renderRutasCobranzaGuardadas()" style="padding:10px 16px;background:#e2e8f0;color:#0f172a;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-size:12px;">📂 Rutas Guardadas</button>
                    <button onclick="renderARCTablaExcel()" style="padding:10px 16px;background:#059669;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-size:12px;">📊 Vista Matriz Excel</button>
                    <button onclick="renderComportamiento()" style="padding:10px 16px;background:#7c3aed;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-size:12px;">🧬 Comportamiento de Pago</button>
                    <button onclick="renderCobranzaMensual()" style="padding:10px 16px;background:#0369a1;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-size:12px;">📅 Cobranza Mensual</button>
                    <button onclick="renderConcentracion()" style="padding:10px 16px;background:#0f766e;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-size:12px;">🎯 Concentración</button>
                    <button onclick="renderVencimientoPlazo()" style="padding:10px 16px;background:#dc2626;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-size:12px;">⏰ Vencimiento de Plazo</button>
                    <button onclick="navA('reportes'); renderSaltosPlazoPendientes();" style="padding:10px 16px;background:#9333ea;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-size:12px;">📆 Saltos de Plazo</button>
                </div>
            </div>
        </div>

        <!-- KPIs globales -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:20px;">
            <div style="background:white;padding:18px;border-radius:10px;border-left:5px solid #0f172a;box-shadow:0 2px 6px rgba(0,0,0,0.05);">
                <div style="font-size:11px;color:#64748b;font-weight:bold;text-transform:uppercase;">Cartera Total</div>
                <div style="font-size:24px;font-weight:900;color:#0f172a;">${_rc.fmt(totalCartera)}</div>
                <div style="font-size:11px;color:#64748b;">${cuentasActivas.length} cuentas activas</div>
            </div>
            <div style="background:white;padding:18px;border-radius:10px;border-left:5px solid #16a34a;box-shadow:0 2px 6px rgba(0,0,0,0.05);">
                <div style="font-size:11px;color:#64748b;font-weight:bold;text-transform:uppercase;">Al Corriente (SNE)</div>
                <div style="font-size:24px;font-weight:900;color:#16a34a;">${cuentasAlCorriente}</div>
                <div style="font-size:11px;color:#64748b;">${_rc.pct(cuentasAlCorriente / cuentasActivas.length * 100)} de la cartera</div>
            </div>
            <div style="background:white;padding:18px;border-radius:10px;border-left:5px solid #dc2626;box-shadow:0 2px 6px rgba(0,0,0,0.05);">
                <div style="font-size:11px;color:#64748b;font-weight:bold;text-transform:uppercase;">En Mora Real</div>
                <div style="font-size:24px;font-weight:900;color:#dc2626;">${cuentasEnMora}</div>
                <div style="font-size:11px;color:#64748b;">Déficit &gt;18% del plan</div>
            </div>
            <div style="background:white;padding:18px;border-radius:10px;border-left:5px solid #f59e0b;box-shadow:0 2px 6px rgba(0,0,0,0.05);">
                <div style="font-size:11px;color:#64748b;font-weight:bold;text-transform:uppercase;">Déficit Acumulado</div>
                <div style="font-size:24px;font-weight:900;color:#f59e0b;">${_rc.fmt(totalVencidoReal)}</div>
                <div style="font-size:11px;color:#64748b;">Brecha real vs. plan</div>
            </div>
        </div>

        <!-- Tarjetas por grupo -->
        ${tarjetasHTML}
    </div>`;
};

// ================================================================
// 2. MATRIZ DE COBRANZA TIPO EXCEL (Historial con Totales y Ordenamiento)
// ================================================================

// Motor de Ordenamiento Clickable
window.sortARCExcel = function(col) {
    if (window._arcExSort === col) {
        // Alternar dirección si es la misma columna
        window._arcExSortDir = window._arcExSortDir === 'asc' ? 'desc' : 'asc';
    } else {
        window._arcExSort = col;
        // Por defecto, importes y saldos bajan de Mayor a Menor. Textos van A-Z.
        window._arcExSortDir = (['importe', 'restante', 'pendiente', 'cubierto', 'riesgo'].includes(col)) ? 'desc' : 'asc';
    }
    window.renderARCTablaExcel();
};

window.renderARCTablaExcel = function() {
    const cont = document.getElementById('arc-v3-contenido') ||
                 document.getElementById('reportes') ||
                 document.getElementById('dashboardContenido');
    if (!cont) return;

    const cxc = StorageService.get('cuentasPorCobrar', []);
    const pagaresSistema = StorageService.get('pagaresSistema', []);
    const hoy = new Date(); hoy.setHours(12, 0, 0, 0);

    // Estado de filtros guardados
    // Por defecto: agrupado por cliente, orden de tiempo inverso (nuevo a
    // antiguo) y escalera de cobros con el abono más reciente arriba.
    window._arcExSort = window._arcExSort || 'ultimoPago';
    window._arcExSortDir = window._arcExSortDir || 'desc';
    window._arcExDateSort = window._arcExDateSort || 'desc';
    window._arcExGroup = window._arcExGroup || 'semana'; 
    window._arcExClienteFilter = window._arcExClienteFilter || '';
    window._arcExAgruparCliente = (window._arcExAgruparCliente === undefined) ? true : window._arcExAgruparCliente === true;

    // --- Helpers para Agrupación de Tiempo ---
    const getMonday = (fecha) => {
        const d = new Date(fecha);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    };

    const formatGroupKey = (fecha) => {
        if (!fecha) return null;
        const d = new Date(fecha);
        if (window._arcExGroup === 'dia') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (window._arcExGroup === 'semana') {
            const monday = getMonday(d);
            return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
        }
        if (window._arcExGroup === 'mes') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (window._arcExGroup === 'año') return `${d.getFullYear()}`;
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const formatGroupLabel = (key) => {
        if (window._arcExGroup === 'dia') {
            const [y, m, d] = key.split('-');
            return `${parseInt(d)} ${_rc.mesLabel(key).split(' ')[0].toLowerCase()}<br>${y}`;
        }
        if (window._arcExGroup === 'semana') {
            const [y, m, d] = key.split('-');
            const monday = new Date(parseInt(y), parseInt(m)-1, parseInt(d), 12);
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            
            const d1 = monday.getDate();
            const m1 = _rc.mesLabel(`${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,'0')}`).split(' ')[0].toLowerCase();
            const d2 = sunday.getDate();
            const m2 = _rc.mesLabel(`${sunday.getFullYear()}-${String(sunday.getMonth()+1).padStart(2,'0')}`).split(' ')[0].toLowerCase();
            const yr = sunday.getFullYear();
            
            if (m1 === m2) {
                return `del ${d1} al ${d2} ${m1}<br>${yr}`;
            } else {
                return `del ${d1} ${m1} al ${d2} ${m2}<br>${yr}`;
            }
        }
        if (window._arcExGroup === 'mes') {
            const [y, m] = key.split('-');
            return `${_rc.mesLabel(key).split(' ')[0]}<br>${y}`;
        }
        if (window._arcExGroup === 'año') return key;
        return key;
    };

    // 1. Procesar cuentas activas y aplicar filtro de cliente
    let cuentasActivas = cxc.filter(c => !_rcCuentaCancelada(c) && !c.incobrable && (c.saldoActual || 0) > 0 && c.estado !== 'Saldado');
    
    if (window._arcExClienteFilter) {
        const q = window._arcExClienteFilter.toLowerCase();
        cuentasActivas = cuentasActivas.filter(c => String(c.nombre || '').toLowerCase().includes(q));
    }

    cuentasActivas = cuentasActivas.map(c => {
        const pCta = pagaresSistema.filter(p => p.folio === c.folio);
        const sne = _rc.calcularSNE(c, pCta, hoy);
        return { ...c, sne, pagares: pCta };
    });

    // 1.5 Agrupar por cliente (opcional) — combina todas las cuentas de un mismo
    // cliente en una sola fila, sumando importes/saldos y fusionando sus abonos
    // para que las columnas de fechas sigan mostrando el total cobrado por periodo.
    if (window._arcExAgruparCliente) {
        const normalizar = value => String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const severidadRiesgo = {
            'INCOBRABLE': 7, 'Alerta total': 7, 'CRÍTICO': 6, 'Alto riesgo': 6,
            'EN MORA': 5, 'Riesgo': 5, 'MODERADO': 4, 'LEVE': 3, 'AL CORRIENTE': 1
        };
        const grupos = {};
        cuentasActivas.forEach(c => {
            const clave = c.clienteId
                ? `id:${c.clienteId}`
                : `nombre:${normalizar(c.nombre || c.clienteNombre)}|tel:${normalizar(c.telefono)}`;
            if (!grupos[clave]) grupos[clave] = { clave, nombre: c.nombre || c.clienteNombre || 'Cliente', cuentas: [] };
            grupos[clave].cuentas.push(c);
        });

        cuentasActivas = Object.values(grupos).map(g => {
            // Base = la cuenta con la venta mas reciente (conserva su fecha cruda intacta
            // para que el parseo/ordenamiento por fecha siga funcionando igual que hoy).
            const masReciente = g.cuentas.slice().sort((a, b) => {
                const fa = _rc.parseFecha(a.fechaVenta || a.fechaIso || a.fecha)?.getTime() || 0;
                const fb = _rc.parseFecha(b.fechaVenta || b.fechaIso || b.fecha)?.getTime() || 0;
                return fb - fa;
            })[0];
            const peor = g.cuentas.slice().sort((a, b) => (severidadRiesgo[b.sne.nivelRiesgo] || 0) - (severidadRiesgo[a.sne.nivelRiesgo] || 0))[0];

            const abonosCombinados = g.cuentas.flatMap(c => c.abonos || []);
            const articulosCombinados = g.cuentas.flatMap(c => c.articulos || []);
            const fechasUltimoPago = g.cuentas.map(c => c.sne.ultimaFechaAbono).filter(Boolean);
            const montoOriginalGrupo = g.cuentas.reduce((s, c) => s + Number(c.sne.totalVenta || 0), 0);

            return {
                ...masReciente,
                nombre: g.nombre,
                folio: g.cuentas.length > 1 ? `${g.cuentas.length} cuentas` : g.cuentas[0].folio,
                folios: g.cuentas.map(c => c.folio),
                abonos: abonosCombinados,
                articulos: articulosCombinados,
                sne: {
                    ...peor.sne,
                    saldoActual: g.cuentas.reduce((s, c) => s + Number(c.sne.saldoActual || 0), 0),
                    totalVenta: montoOriginalGrupo,
                    ultimaFechaAbono: fechasUltimoPago.length ? new Date(Math.max(...fechasUltimoPago.map(f => f.getTime()))) : null
                },
                agrupadoPorCliente: true,
                cuentasGrupo: g.cuentas
            };
        });
    }

    // 2. Ordenamiento Vertical Dinámico
    const sortDir = window._arcExSortDir === 'desc' ? -1 : 1;
    cuentasActivas.sort((a, b) => {
        let valA, valB;
        if (window._arcExSort === 'riesgo') {
            const riskOrder = { 'Alerta total': 1, 'CRÍTICO': 1, 'INCOBRABLE': 1, 'Alto riesgo': 2, 'EN MORA': 2, 'Riesgo': 3, 'MODERADO': 3, 'Bajo riesgo': 4, 'LEVE': 4, 'AL CORRIENTE': 5 };
            valA = riskOrder[a.sne.nivelRiesgo] || 99;
            valB = riskOrder[b.sne.nivelRiesgo] || 99;
            if (valA === valB) return sortDir * (b.sne.saldoActual - a.sne.saldoActual); // Desempate por saldo
            return sortDir * (valA - valB);
        }
        if (window._arcExSort === 'fecha') {
            valA = _rc.parseFecha(a.fechaVenta || a.fechaIso || a.fecha)?.getTime() || 0;
            valB = _rc.parseFecha(b.fechaVenta || b.fechaIso || b.fecha)?.getTime() || 0;
            return sortDir * (valA - valB);
        }
        if (window._arcExSort === 'desc') {
            valA = (a.articulos || []).map(x => x.nombre).join(', ').toLowerCase();
            valB = (b.articulos || []).map(x => x.nombre).join(', ').toLowerCase();
            return sortDir * valA.localeCompare(valB);
        }
        if (window._arcExSort === 'cliente') {
            valA = String(a.nombre || '').toLowerCase();
            valB = String(b.nombre || '').toLowerCase();
            return sortDir * valA.localeCompare(valB);
        }
        if (window._arcExSort === 'ultimoPago') {
            valA = a.sne.ultimaFechaAbono ? a.sne.ultimaFechaAbono.getTime() : null;
            valB = b.sne.ultimaFechaAbono ? b.sne.ultimaFechaAbono.getTime() : null;
            if (valA === null && valB === null) return String(a.nombre || '').localeCompare(String(b.nombre || ''));
            if (valA === null) return window._arcExSortDir === 'asc' ? -1 : 1;
            if (valB === null) return window._arcExSortDir === 'asc' ? 1 : -1;
            if (valA === valB) return String(a.nombre || '').localeCompare(String(b.nombre || ''));
            return sortDir * (valA - valB);
        }
        if (window._arcExSort === 'importe') {
            valA = Number(a.sne.totalVenta || 0);
            valB = Number(b.sne.totalVenta || 0);
            return sortDir * (valA - valB);
        }
        if (window._arcExSort === 'cubierto') {
            const impA = Number(a.sne.totalVenta || 0);
            const impB = Number(b.sne.totalVenta || 0);
            valA = impA > 0 ? ((impA - a.sne.saldoActual) / impA) : 0;
            valB = impB > 0 ? ((impB - b.sne.saldoActual) / impB) : 0;
            return sortDir * (valA - valB);
        }
        if (window._arcExSort === 'pendiente') {
            const impA = Number(a.sne.totalVenta || 0);
            const impB = Number(b.sne.totalVenta || 0);
            valA = impA > 0 ? (a.sne.saldoActual / impA) : 0;
            valB = impB > 0 ? (b.sne.saldoActual / impB) : 0;
            return sortDir * (valA - valB);
        }
        if (window._arcExSort === 'restante') {
            return sortDir * (a.sne.saldoActual - b.sne.saldoActual);
        }
        return 0;
    });

    // 3. Extraer columnas únicas de Abonos Reales
    const groupSet = new Set();
    cuentasActivas.forEach(c => {
        (c.abonos || []).forEach(a => {
            if (a.cancelado || a.canceladoPorVenta || a.canceladoPorApartado) return;
            const f = _rc.parseFecha(a.fecha || a.fechaAbono);
            if (f) groupSet.add(formatGroupKey(f));
        });
    });
    
    let uniqueGroups = Array.from(groupSet).sort();
    if (window._arcExDateSort === 'desc') uniqueGroups.reverse();

    // 4. Variables para TOTALES GENERALES
    let sumImporte = 0;
    let sumRestante = 0;
    let sumAbonosFechas = {};
    uniqueGroups.forEach(key => sumAbonosFechas[key] = 0);

    // 5. Construir Filas
    window._filasParaCobranza = cuentasActivas;
    const filasHtml = cuentasActivas.map((c, i) => {
        const s = c.sne;
        
        let bgStatus, colorText;
        if (s.nivelRiesgo === 'AL CORRIENTE') {
            bgStatus = '#22c55e'; colorText = '#000000'; 
        } else if (s.nivelRiesgo === 'LEVE' || s.nivelRiesgo === 'MODERADO') {
            bgStatus = '#facc15'; colorText = '#000000'; 
        } else {
            bgStatus = '#b91c1c'; colorText = '#ffffff'; 
        }

        const desc = c.agrupadoPorCliente
            ? `📦 ${c.cuentasGrupo.length} cuenta${c.cuentasGrupo.length > 1 ? 's' : ''}`
            : ((c.articulos || []).map(a => a.nombre).join(', ') || 'Venta General');
        const descTooltip = c.agrupadoPorCliente
            ? (c.articulos || []).map(a => a.nombre).join(', ') || 'Sin artículos registrados'
            : desc;
        const nombreCliente = c.agrupadoPorCliente ? `${c.nombre} (${c.cuentasGrupo.length})` : c.nombre;
        const fVenta = _rc.parseFecha(c.fechaVenta || c.fechaIso || c.fecha);
        const fechaVentaStr = fVenta ? `${String(fVenta.getDate()).padStart(2,'0')}/${String(fVenta.getMonth()+1).padStart(2,'0')}/${String(fVenta.getFullYear()).slice(-2)}` : '-';
        const fechaUltPagoStr = s.ultimaFechaAbono
            ? `${String(s.ultimaFechaAbono.getDate()).padStart(2,'0')}/${String(s.ultimaFechaAbono.getMonth()+1).padStart(2,'0')}/${String(s.ultimaFechaAbono.getFullYear()).slice(-2)}`
            : 'S/A';

        const importeReal = Number(s.totalVenta || 0);
        const saldoRestante = Number(s.saldoActual);
        const pagadoReal = Math.max(0, importeReal - saldoRestante);
        const pctCubierto = importeReal > 0 ? Math.round((pagadoReal / importeReal) * 100) : 0;
        const pctPendiente = importeReal > 0 ? Math.round((saldoRestante / importeReal) * 100) : 0;

        sumImporte += importeReal;
        sumRestante += saldoRestante;

        let row = `<tr style="font-size:11px; background:#ffffff; border-bottom:1px solid #e2e8f0;">
            <td class="ex-stky ex-col-1" style="background:${bgStatus}; color:${colorText};" title="${s.nivelRiesgo}">
                <div style="display:flex; flex-direction:column; align-items:center; gap:2px;">
                    <input type="checkbox" class="chk-cobrador" value="${i}" style="width:13px; height:13px; margin:0; cursor:pointer;">
                    ${s.emojiRiesgo}
                    ${!c.agrupadoPorCliente ? `<span onclick="marcarIncobrable('${c.folio}')" title="Marcar incobrable" style="cursor:pointer; font-size:10px; line-height:1;">⚫</span>` : ''}
                </div>
            </td>
            <td class="ex-stky ex-col-2" style="background:${bgStatus}; color:${colorText}; font-weight:bold; border-right:1px solid rgba(0,0,0,0.1);">${fechaVentaStr}</td>
            <td class="ex-stky ex-col-3" style="background:${bgStatus}; color:${colorText}; border-right:1px solid rgba(0,0,0,0.1);" title="${descTooltip}">${desc}</td>
            <td class="ex-stky ex-col-4" style="background:${bgStatus}; color:${colorText}; border-right:1px solid rgba(0,0,0,0.1); cursor:pointer;" title="${window.CxcNotas ? window.CxcNotas.escapar(window.CxcNotas.tooltipTexto(c.folios || c.folio) || c.nombre) : c.nombre}" data-folios='${window.CxcNotas ? window.CxcNotas.escapar(JSON.stringify(c.folios || [c.folio])) : ''}' data-cliente="${window.CxcNotas ? window.CxcNotas.escapar(c.nombre || '') : ''}" onclick="CxcNotas.abrirDesdeElemento(this)">${nombreCliente} <span style="opacity:.85;">🗒️</span></td>
            <td class="ex-stky ex-col-5" style="background:#fef3c7; color:#92400e; text-align:center; font-weight:bold;">${fechaUltPagoStr}</td>
            <td class="ex-stky ex-col-6" style="background:#f8fafc; color:#0f172a; text-align:right;">$${importeReal.toLocaleString('en-US')}</td>
            <td class="ex-stky ex-col-7" style="background:#dcfce7; color:#166534; text-align:center; font-weight:bold;">${pctCubierto}%</td>
            <td class="ex-stky ex-col-8" style="background:#fee2e2; color:#991b1b; text-align:center; font-weight:bold;">${pctPendiente}%</td>
            <td class="ex-stky ex-col-9" style="background:#0ea5e9; color:#ffffff; font-weight:bold; text-align:right;">$${saldoRestante.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
        `;

        uniqueGroups.forEach(key => {
            const abonosGrupo = (c.abonos || []).filter(a => {
                if (a.cancelado || a.canceladoPorVenta || a.canceladoPorApartado) return false;
                const f = _rc.parseFecha(a.fecha || a.fechaAbono);
                return f && formatGroupKey(f) === key;
            });

            let cellHtml = '';
            let cellBg = '#ffffff';
            let cellColor = '#0f172a';

            if (abonosGrupo.length > 0) {
                const totalAbonado = abonosGrupo.reduce((sum, a) => sum + parseFloat(a.monto || 0), 0);
                if (totalAbonado > 0) {
                    sumAbonosFechas[key] += totalAbonado; // Sumar al total general
                    cellBg = '#dcfce7'; 
                    cellColor = '#166534';
                    cellHtml = '$' + totalAbonado.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 2}); 
                }
            }

            row += `<td style="padding:6px 8px; border-right:1px solid #cbd5e1; text-align:right; background:${cellBg}; color:${cellColor}; font-weight:bold;">${cellHtml}</td>`;
        });

        row += '</tr>';
        return row;
    }).join('');

    // Totales Calculados
    const pctTotalCubierto = sumImporte > 0 ? Math.round(((sumImporte - sumRestante)/sumImporte)*100) : 0;
    const pctTotalPendiente = sumImporte > 0 ? Math.round((sumRestante/sumImporte)*100) : 0;

    // Helper para cabeceras ordenables
    const thSort = (col, label, cls) => {
        const icon = window._arcExSort === col ? (window._arcExSortDir === 'asc' ? ' <span style="color:#22c55e;">▲</span>' : ' <span style="color:#ef4444;">▼</span>') : ' <span style="opacity:0.3">↕</span>';
        return `<th class="ex-stky ${cls}" style="cursor:pointer; user-select:none; transition:0.2s;" onclick="window.sortARCExcel('${col}')" onmouseover="this.style.background='#334155'" onmouseout="this.style.background='#000000'">${label}${icon}</th>`;
    };

    const dateHeadersHtml = uniqueGroups.map(key => {
        return `<th style="padding:6px; border-right:1px solid #475569; border-bottom:1px solid #000; background:#1e293b; color:white; min-width:85px; font-size:10px; text-align:center; vertical-align:middle;">${formatGroupLabel(key)}</th>`;
    }).join('');

    // CSS Dinámico Calculado al Milímetro
    const cssBlocks = `
        <style>
            .ex-table { border-collapse: separate; border-spacing: 0; min-width: max-content; font-family: Arial, sans-serif; }
            .ex-table th, .ex-table td { padding: 4px 8px; white-space: nowrap; }
            
            /* Cabecera superior congelada */
            .ex-thead th { position: sticky; top: 0; z-index: 20; border-bottom: 2px solid #000; }
            
            /* Fila de Totales inferior congelada */
            .ex-tfoot td { position: sticky; bottom: 0; z-index: 20; border-top: 2px solid #000; background: #e2e8f0; font-weight: bold; }
            
            /* Celdas fijas a la izquierda (Sticky Left) */
            .ex-stky { position: sticky; z-index: 10; border-right: 1px solid #000; text-align: center; }
            
            /* Cruce de congelamiento: Arriba+Izquierda y Abajo+Izquierda */
            .ex-thead th.ex-stky { z-index: 30; background: #000000; color: #ffffff; text-transform: uppercase; border-right: 1px solid #475569; font-size:10px; }
            .ex-tfoot td.ex-stky { z-index: 30; background: #cbd5e1; }
            
            /* Anchos Compactados Exactos */
            .ex-col-1 { left: 0;      width: 35px;  min-width: 35px; }
            .ex-col-2 { left: 35px;   width: 65px;  min-width: 65px;  text-align: center; }
            .ex-col-3 { left: 100px;  width: 140px; min-width: 140px; max-width: 140px; overflow: hidden; text-overflow: ellipsis; text-align: left; }
            .ex-col-4 { left: 240px;  width: 130px; min-width: 130px; max-width: 130px; overflow: hidden; text-overflow: ellipsis; text-align: left; }
            .ex-col-5 { left: 370px;  width: 75px;  min-width: 75px;  text-align: center; }
            .ex-col-6 { left: 445px;  width: 70px;  min-width: 70px;  text-align: right; }
            .ex-col-7 { left: 515px;  width: 50px;  min-width: 50px;  text-align: center; }
            .ex-col-8 { left: 565px;  width: 50px;  min-width: 50px;  text-align: center; }
            .ex-col-9 { left: 615px;  width: 80px;  min-width: 80px;  text-align: right; border-right: 4px solid #0f172a !important; }
            
            /* Contenedor que permite Scroll Vertical y Horizontal */
            .ex-wrapper {
                width: 100%;
                max-width: 100%;
                overflow: auto;
                max-height: 70vh; 
                background: white;
                border-radius: 8px;
                border: 2px solid #0f172a;
                box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            }
            
            /* Scrollbar personalizada */
            .ex-wrapper::-webkit-scrollbar { height: 16px; width: 16px; }
            .ex-wrapper::-webkit-scrollbar-track { background: #e2e8f0; border-radius: 8px; }
            .ex-wrapper::-webkit-scrollbar-thumb { background: #64748b; border-radius: 8px; border: 3px solid #e2e8f0; }
            .ex-wrapper::-webkit-scrollbar-thumb:hover { background: #334155; }
        </style>
    `;

    cont.innerHTML = `
    ${cssBlocks}
    <div style="font-family:system-ui,sans-serif;max-width:100%;margin:0 auto;padding:0 4px;">

        <!-- Header -->
        <div style="background:linear-gradient(135deg,#065f46,#047857);color:white;padding:22px;border-radius:14px;margin-bottom:18px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
                <div>
                    <h2 style="margin:0;font-size:21px;font-weight:900;">📊 Matriz de Cobranza (Abonos Recibidos)</h2>
                    <p style="margin:5px 0 0;color:#a7f3d0;font-size:12px;">Desplázate hacia la derecha y hacia abajo libremente. Clic en las cabeceras para ordenar.</p>
                </div>
                <div style="display:flex;gap:10px;">
                    <button onclick="generarListadoCobranza()" style="padding:10px 16px;background:#f59e0b;color:#713f12;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-size:12px;">📋 Generar Cobranza</button>
                    <button onclick="renderRutasCobranzaGuardadas()" style="padding:10px 16px;background:#e2e8f0;color:#0f172a;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-size:12px;">📂 Rutas Guardadas</button>
                    <button onclick="renderARC_v3()" style="padding:10px 16px;background:rgba(255,255,255,0.15);color:white;border:1px solid rgba(255,255,255,0.3);border-radius:8px;font-weight:bold;cursor:pointer;font-size:12px;">⬅️ Volver a Tarjetas</button>
                </div>
            </div>
        </div>

        <!-- Controles Horizontales -->
        <div style="background:white;padding:14px;border-radius:10px;margin-bottom:16px;display:flex;flex-wrap:wrap;gap:15px;align-items:center;box-shadow:0 2px 6px rgba(0,0,0,0.05);">
            <div>
                <label style="font-size:11px;font-weight:bold;color:#64748b;">🔍 CLIENTE:</label>
                <input type="text" id="arcExClienteFilter" value="${window._arcExClienteFilter || ''}" onkeyup="window._arcExClienteFilter=this.value; renderARCTablaExcel()" placeholder="Buscar cliente..." style="margin-left:8px;padding:7px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;background:#f8fafc;width:150px;">
            </div>
            <div style="width:1px;height:24px;background:#e2e8f0;"></div>
            <div>
                <label style="font-size:11px;font-weight:bold;color:#64748b;">⏳ AGRUPAR POR:</label>
                <select onchange="window._arcExGroup=this.value;renderARCTablaExcel();" style="margin-left:8px;padding:7px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;background:#f8fafc;">
                    <option value="dia" ${window._arcExGroup==='dia'?'selected':''}>Día</option>
                    <option value="semana" ${window._arcExGroup==='semana'?'selected':''}>Semana (Lun-Dom)</option>
                    <option value="mes" ${window._arcExGroup==='mes'?'selected':''}>Mes</option>
                    <option value="año" ${window._arcExGroup==='año'?'selected':''}>Año</option>
                </select>
            </div>
            <div style="width:1px;height:24px;background:#e2e8f0;"></div>
            <div>
                <label style="font-size:11px;font-weight:bold;color:#64748b;">➡️ ORDEN TIEMPO:</label>
                <select onchange="window._arcExDateSort=this.value;renderARCTablaExcel();" style="margin-left:8px;padding:7px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;">
                    <option value="asc" ${window._arcExDateSort==='asc'?'selected':''}>Cronológico (Antiguo a Nuevo)</option>
                    <option value="desc" ${window._arcExDateSort==='desc'?'selected':''}>Inverso (Nuevo a Antiguo)</option>
                </select>
            </div>
            <div style="width:1px;height:24px;background:#e2e8f0;"></div>
            <div>
                <label style="font-size:11px;font-weight:bold;color:#64748b;">ESCALERA COBROS:</label>
                <select onchange="if(this.value){window._arcExSort='ultimoPago';window._arcExSortDir=this.value;}else{window._arcExSort='riesgo';window._arcExSortDir='desc';}renderARCTablaExcel();" style="margin-left:8px;padding:7px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;">
                    <option value="" ${window._arcExSort!=='ultimoPago'?'selected':''}>Orden actual del reporte</option>
                    <option value="asc" ${window._arcExSort==='ultimoPago'&&window._arcExSortDir==='asc'?'selected':''}>Sin abono / mas antiguo arriba</option>
                    <option value="desc" ${window._arcExSort==='ultimoPago'&&window._arcExSortDir==='desc'?'selected':''}>Mas reciente arriba</option>
                </select>
            </div>
            <div style="width:1px;height:24px;background:#e2e8f0;"></div>
            <div>
                <label style="font-size:11px;font-weight:bold;color:#64748b;display:flex;align-items:center;gap:6px;cursor:pointer;">
                    <input type="checkbox" id="arcExAgruparCliente" ${window._arcExAgruparCliente ? 'checked' : ''} onchange="window._arcExAgruparCliente=this.checked;renderARCTablaExcel();" style="width:15px;height:15px;cursor:pointer;">
                    👥 AGRUPAR POR CLIENTE
                </label>
            </div>
        </div>

        <!-- Contenedor con Scrollbars (Horizontal y Vertical) -->
        <div class="ex-wrapper">
            <table class="ex-table">
                <thead class="ex-thead">
                    <tr>
                        ${thSort('riesgo', 'Est', 'ex-col-1')}
                        ${thSort('fecha', 'Fecha', 'ex-col-2')}
                        ${thSort('desc', 'Descripción', 'ex-col-3')}
                        ${thSort('cliente', 'Cliente', 'ex-col-4')}
                        ${thSort('ultimoPago', 'Ult Pago', 'ex-col-5')}
                        ${thSort('importe', 'Deuda Original', 'ex-col-6')}
                        ${thSort('cubierto', '% Cub', 'ex-col-7')}
                        ${thSort('pendiente', '% Pen', 'ex-col-8')}
                        ${thSort('restante', 'Restante', 'ex-col-9')}
                        ${dateHeadersHtml}
                    </tr>
                </thead>
                <tbody>
                    ${filasHtml || `<tr><td colspan="${9 + uniqueGroups.length}" style="padding:40px; text-align:center; color:#64748b;">No hay cuentas con abonos para mostrar con estos filtros.</td></tr>`}
                </tbody>
                <tfoot class="ex-tfoot">
                    <tr style="font-size:12px; color:#0f172a; box-shadow: 0 -2px 10px rgba(0,0,0,0.15);">
                        <td class="ex-stky ex-col-1" style="border-bottom:none;"></td>
                        <td class="ex-stky ex-col-2" style="border-bottom:none;"></td>
                        <td class="ex-stky ex-col-3" style="border-bottom:none; text-align:right;">TOTALES:</td>
                        <td class="ex-stky ex-col-4" style="border-bottom:none;"></td>
                        <td class="ex-stky ex-col-5" style="border-bottom:none;"></td>
                        <td class="ex-stky ex-col-6" style="border-bottom:none; text-align:right;">$${sumImporte.toLocaleString('en-US')}</td>
                        <td class="ex-stky ex-col-7" style="border-bottom:none; text-align:center; color:#166534;">${pctTotalCubierto}%</td>
                        <td class="ex-stky ex-col-8" style="border-bottom:none; text-align:center; color:#991b1b;">${pctTotalPendiente}%</td>
                        <td class="ex-stky ex-col-9" style="border-bottom:none; text-align:right; color:#b91c1c;">$${sumRestante.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                        ${uniqueGroups.map(key => {
                            const t = sumAbonosFechas[key];
                            return `<td style="padding:6px 8px; border-right:1px solid #cbd5e1; border-bottom:none; text-align:right; color:#166534; background:#dcfce7;">${t > 0 ? '$'+t.toLocaleString('en-US', {minimumFractionDigits:0, maximumFractionDigits:2}) : ''}</td>`;
                        }).join('')}
                    </tr>
                </tfoot>
            </table>
        </div>

    </div>`;

    // Restaurar foco al input de búsqueda para que no se pierda mientras escribes
    setTimeout(() => {
        const input = document.getElementById('arcExClienteFilter');
        if (input && document.activeElement !== input) {
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
        }
    }, 0);
};

// ================================================================
// 3. SCORECARD DE COMPORTAMIENTO DE PAGO
// ================================================================
window.ordenarComportamientoPor = function(columna) {
    const misma = window._cbOrden === columna;
    const direccionInicial = columna === 'nombre' ? 'asc' : 'desc';
    window._cbDireccion = misma
        ? (window._cbDireccion === 'asc' ? 'desc' : 'asc')
        : direccionInicial;
    window._cbOrden = columna;
    renderComportamiento();
};

window.abrirDetalleScorecardCliente = function(claveCodificada) {
    const clave = decodeURIComponent(String(claveCodificada || ''));
    const grupo = window._cbGruposCliente?.[clave];
    if (!grupo) return alert('No se encontro el detalle del cliente.');
    document.querySelector('[data-modal="scorecard-cliente"]')?.remove();
    const filas = grupo.cuentas.map(c => `
        <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:10px;"><b>${c.folio || '-'}</b></td>
            <td style="padding:10px;text-align:right;font-weight:900;color:#dc2626;">${_rc.fmt(c.sne.saldoActual)}</td>
            <td style="padding:10px;text-align:right;">${_rc.fmt(c.sne.excedente)}</td>
            <td style="padding:10px;">${_rc.badge(c.sne.emojiRiesgo + ' ' + c.sne.nivelRiesgo, c.sne.colorRiesgo + '18', c.sne.colorRiesgo)}</td>
            <td style="padding:10px;text-align:right;white-space:nowrap;">
                <button onclick="enviarRecordatorioWhatsApp('${String(c.folio || '').replace(/'/g, "\\'")}')" style="padding:6px 9px;background:#25D366;color:white;border:0;border-radius:5px;font-weight:bold;cursor:pointer;">WhatsApp</button>
            </td>
        </tr>`).join('');
    document.body.insertAdjacentHTML('beforeend', `
        <div data-modal="scorecard-cliente" style="position:fixed;inset:0;background:rgba(15,23,42,.78);z-index:10000;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:24px;">
            <div style="width:100%;max-width:900px;background:white;border-radius:10px;padding:22px;">
                <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:14px;">
                    <div><h3 style="margin:0;color:#0f172a;">${grupo.nombre}</h3><p style="margin:5px 0 0;color:#64748b;">${grupo.cuentas.length} cuentas activas</p></div>
                    <button onclick="document.querySelector('[data-modal=&quot;scorecard-cliente&quot;]')?.remove()" style="padding:8px 12px;border:0;border-radius:6px;background:#e2e8f0;color:#334155;font-weight:bold;cursor:pointer;">Cerrar</button>
                </div>
                <div style="overflow:auto;border:1px solid #e2e8f0;border-radius:8px;">
                    <table style="width:100%;border-collapse:collapse;min-width:680px;font-size:12px;">
                        <thead style="background:#f8fafc;color:#475569;"><tr><th style="padding:10px;text-align:left;">Folio</th><th style="padding:10px;text-align:right;">Saldo</th><th style="padding:10px;text-align:right;">SNE</th><th style="padding:10px;text-align:left;">Riesgo</th><th style="padding:10px;"></th></tr></thead>
                        <tbody>${filas}</tbody>
                    </table>
                </div>
            </div>
        </div>`);
};

window.renderComportamiento = function() {
    const cont = document.getElementById('arc-v3-contenido') ||
                 document.getElementById('reportes') ||
                 document.getElementById('dashboardContenido');
    if (!cont) return;

    const cxc = StorageService.get('cuentasPorCobrar', []);
    const pagaresSistema = StorageService.get('pagaresSistema', []);
    const hoy = new Date(); hoy.setHours(12, 0, 0, 0);

    const ordenar = window._cbOrden || 'excedente';
    const direccion = window._cbDireccion || (ordenar === 'nombre' || ordenar === 'excedente' ? 'asc' : 'desc');
    const filtro  = window._cbFiltro || 'todos';
    const agruparCliente = window._cbAgruparCliente === true;

    const cuentasSNE = cxc
        .filter(c => c.estado !== 'Saldado' && !_rcCuentaCancelada(c) && !c.incobrable)
        .map(c => {
            const pagaresCuenta = pagaresSistema.filter(p => p.folio === c.folio);
            const sne = _rc.calcularSNE(c, pagaresCuenta, hoy);

            const abonos = (c.abonos || []).map(a => ({
                monto: parseFloat(a.monto || 0),
                fecha: _rc.parseFecha(a.fecha || a.fechaAbono)
            })).filter(a => a.fecha);

            const hace60 = new Date(hoy); hace60.setDate(hoy.getDate() - 60);
            const hace120 = new Date(hoy); hace120.setDate(hoy.getDate() - 120);

            const recientes = abonos.filter(a => a.fecha >= hace60).reduce((s, a) => s + a.monto, 0);
            const anteriores = abonos.filter(a => a.fecha >= hace120 && a.fecha < hace60).reduce((s, a) => s + a.monto, 0);

            let tendencia = 'estable';
            if (anteriores > 0) {
                const delta = (recientes - anteriores) / anteriores * 100;
                if (delta > 15) tendencia = 'subiendo';
                else if (delta < -15) tendencia = 'bajando';
            } else if (recientes > 0) {
                tendencia = 'nuevo';
            }

            let diasEntreAbonos = null;
            if (abonos.length >= 2) {
                abonos.sort((a, b) => a.fecha - b.fecha);
                let sumaDias = 0;
                for (let i = 1; i < abonos.length; i++) {
                    sumaDias += Math.floor((abonos[i].fecha - abonos[i - 1].fecha) / 86400000);
                }
                diasEntreAbonos = Math.round(sumaDias / (abonos.length - 1));
            }

            const abonoMax = abonos.length ? Math.max(...abonos.map(a => a.monto)) : 0;
            const abonoMin = abonos.length ? Math.min(...abonos.map(a => a.monto)) : 0;

            return { ...c, sne, tendencia, diasEntreAbonos, abonoMax, abonoMin, recientes, anteriores };
        });

    let lista = cuentasSNE;
    if (agruparCliente) {
        const grupos = {};
        const normalizar = value => String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        cuentasSNE.forEach(c => {
            const clave = c.clienteId
                ? `id:${c.clienteId}`
                : `nombre:${normalizar(c.nombre || c.clienteNombre)}|tel:${normalizar(c.telefono)}`;
            if (!grupos[clave]) grupos[clave] = { clave, nombre: c.nombre || c.clienteNombre || 'Cliente', clienteId: c.clienteId || null, cuentas: [] };
            grupos[clave].cuentas.push(c);
        });

        const severidad = {
            'INCOBRABLE': 7, 'Alerta total': 7,
            'CRITICO': 6, 'CRÍTICO': 6, 'Alto riesgo': 6,
            'EN MORA': 5, 'Riesgo': 5,
            'MODERADO': 4, 'Precaucion': 4, 'Precaución': 4,
            'LEVE': 3, 'Estable': 2, 'AL CORRIENTE': 1, 'Al corriente': 1
        };
        lista = Object.values(grupos).map(g => {
            const abonos = g.cuentas.flatMap(c => (c.abonos || []).map(a => ({
                monto: Number(a.monto || 0),
                fecha: _rc.parseFecha(a.fecha || a.fechaAbono),
                cancelado: a.cancelado || a.canceladoPorVenta || a.canceladoPorApartado
            }))).filter(a => a.fecha && !a.cancelado);
            abonos.sort((a, b) => a.fecha - b.fecha);

            let diasEntreAbonos = null;
            if (abonos.length >= 2) {
                let sumaDias = 0;
                for (let i = 1; i < abonos.length; i++) sumaDias += Math.floor((abonos[i].fecha - abonos[i - 1].fecha) / 86400000);
                diasEntreAbonos = Math.round(sumaDias / (abonos.length - 1));
            }

            const hace60 = new Date(hoy); hace60.setDate(hoy.getDate() - 60);
            const hace90 = new Date(hoy); hace90.setDate(hoy.getDate() - 90);
            const hace120 = new Date(hoy); hace120.setDate(hoy.getDate() - 120);
            const recientes = abonos.filter(a => a.fecha >= hace60).reduce((s, a) => s + a.monto, 0);
            const anteriores = abonos.filter(a => a.fecha >= hace120 && a.fecha < hace60).reduce((s, a) => s + a.monto, 0);
            const abonos90 = abonos.filter(a => a.fecha >= hace90);
            let tendencia = 'estable';
            if (anteriores > 0) {
                const delta = (recientes - anteriores) / anteriores * 100;
                if (delta > 15) tendencia = 'subiendo';
                else if (delta < -15) tendencia = 'bajando';
            } else if (recientes > 0) tendencia = 'nuevo';

            const peor = g.cuentas.slice().sort((a, b) => (severidad[b.sne.nivelRiesgo] || 0) - (severidad[a.sne.nivelRiesgo] || 0))[0];
            const totalPlazo = g.cuentas.reduce((s, c) => s + Number(c.sne.totalPlazo || c.sne.totalVenta || 0), 0);
            const totalPagado = g.cuentas.reduce((s, c) => s + Number(c.sne.totalPagado || 0), 0);
            const montoEsperado = g.cuentas.reduce((s, c) => s + Number(c.sne.montoEsperado || 0), 0);
            const excedente = totalPagado - montoEsperado;
            const sne = {
                saldoActual: g.cuentas.reduce((s, c) => s + Number(c.sne.saldoActual || 0), 0),
                totalPagado,
                montoEsperado,
                excedente,
                totalVenta: g.cuentas.reduce((s, c) => s + Number(c.sne.totalVenta || 0), 0),
                totalPlazo,
                deficitPct: totalPlazo > 0 ? Math.abs(Math.min(0, excedente)) / totalPlazo * 100 : 0,
                numAbonos: abonos.length,
                diasSinPagar: abonos.length ? Math.max(0, Math.floor((hoy - abonos[abonos.length - 1].fecha) / 86400000)) : 9999,
                promedioAbono90: abonos90.length ? abonos90.reduce((s, a) => s + a.monto, 0) / abonos90.length : 0,
                nivelRiesgo: peor?.sne.nivelRiesgo || 'AL CORRIENTE',
                colorRiesgo: peor?.sne.colorRiesgo || '#16a34a',
                emojiRiesgo: peor?.sne.emojiRiesgo || 'OK'
            };
            return {
                ...g.cuentas[0],
                nombre: g.nombre,
                folio: `${g.cuentas.length} cuentas`,
                folios: g.cuentas.map(c => c.folio),
                sne,
                tendencia,
                diasEntreAbonos,
                recientes,
                anteriores,
                agrupado: true,
                grupoClave: g.clave,
                cuentasGrupo: g.cuentas
            };
        });
        window._cbGruposCliente = Object.fromEntries(lista.map(g => [g.grupoClave, { clave: g.grupoClave, nombre: g.nombre, cuentas: g.cuentasGrupo }]));
    } else {
        window._cbGruposCliente = {};
    }
    if (filtro === 'alCorriente') lista = lista.filter(c => c.sne.excedente >= 0);
    if (filtro === 'enMora')      lista = lista.filter(c => ['riesgo', 'alto riesgo', 'alerta total', 'en mora', 'critico', 'crítico'].includes(String(c.sne.nivelRiesgo || '').toLowerCase()));
    if (filtro === 'sinAbono60')  lista = lista.filter(c => c.sne.diasSinPagar > 60);
    if (filtro === 'subiendo')    lista = lista.filter(c => c.tendencia === 'subiendo');

    const riesgoOrden = {
        'Alerta total': 6, 'EN MORA': 6, 'CRITICO': 6, 'CRÍTICO': 6,
        'Alto riesgo': 5, 'Riesgo': 4, 'Precaucion': 3, 'Precaución': 3,
        'Estable': 2, 'Al corriente': 1
    };
    const tendenciaOrden = { bajando: 1, estable: 2, nuevo: 3, subiendo: 4 };
    const valorOrden = (c) => {
        const s = c.sne;
        if (ordenar === 'nombre') return String(c.nombre || '');
        if (ordenar === 'saldo') return Number(s.saldoActual || 0);
        if (ordenar === 'pagado') return Number(s.totalPagado || 0);
        if (ordenar === 'esperado') return Number(s.montoEsperado || 0);
        if (ordenar === 'excedente') return Number(s.excedente || 0);
        if (ordenar === 'cubierto') return s.totalVenta > 0 ? Number(s.totalPagado || 0) / Number(s.totalVenta) : 0;
        if (ordenar === 'riesgo') return riesgoOrden[s.nivelRiesgo] || 0;
        if (ordenar === 'diasSin') return Number(s.diasSinPagar || 0);
        if (ordenar === 'frecuencia') return c.diasEntreAbonos === null ? Number.MAX_SAFE_INTEGER : Number(c.diasEntreAbonos);
        if (ordenar === 'promedio90') return Number(s.promedioAbono90 || 0);
        if (ordenar === 'tendencia') return tendenciaOrden[c.tendencia] || 0;
        return 0;
    };
    lista.sort((a, b) => {
        const va = valorOrden(a);
        const vb = valorOrden(b);
        let comparacion = typeof va === 'string'
            ? va.localeCompare(vb, 'es', { sensitivity: 'base' })
            : va - vb;
        if (comparacion === 0) {
            comparacion = String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', { sensitivity: 'base' });
        }
        return direccion === 'asc' ? comparacion : -comparacion;
    });
    
    window._filasParaCobranza = lista;

    const thOrdenable = (clave, texto, alineacion = 'left') => {
        const activo = ordenar === clave;
        const flecha = activo ? (direccion === 'asc' ? '▲' : '▼') : '↕';
        return `<th onclick="ordenarComportamientoPor('${clave}')" title="Ordenar por ${texto}" style="position:sticky;top:0;z-index:3;padding:11px 12px;font-size:11px;color:${activo ? '#4c1d95' : '#475569'};background:${activo ? '#ede9fe' : '#f8fafc'};text-align:${alineacion};cursor:pointer;white-space:nowrap;border-bottom:2px solid ${activo ? '#7c3aed' : '#e2e8f0'};user-select:none;">${texto} <span style="font-size:10px;">${flecha}</span></th>`;
    };

    const filas = lista.map((c, i) => {
        const s = c.sne;
        const pctPagado = s.totalVenta > 0 ? (s.totalPagado / s.totalVenta * 100) : 0;

        const iconoTendencia = c.tendencia === 'subiendo' ? '📈' :
                               c.tendencia === 'bajando' ? '📉' :
                               c.tendencia === 'nuevo' ? '🆕' : '➡️';

        const diasLabel = s.diasSinPagar === 9999 ? '—'
            : s.diasSinPagar > 60 ? `<b style="color:#dc2626">${s.diasSinPagar}d</b>`
            : s.diasSinPagar > 30 ? `<b style="color:#f59e0b">${s.diasSinPagar}d</b>`
            : `<span style="color:#16a34a">${s.diasSinPagar}d</span>`;

        const freqLabel = c.diasEntreAbonos === null ? '—'
            : c.diasEntreAbonos <= 8 ? `<span style="color:#16a34a">Semanal (~${c.diasEntreAbonos}d)</span>`
            : c.diasEntreAbonos <= 18 ? `<span style="color:#0ea5e9">Quincenal (~${c.diasEntreAbonos}d)</span>`
            : c.diasEntreAbonos <= 40 ? `<span style="color:#a855f7">Mensual (~${c.diasEntreAbonos}d)</span>`
            : `<span style="color:#f59e0b">Irregular (~${c.diasEntreAbonos}d)</span>`;

        const sneLabel = s.excedente >= 0
            ? `<span style="color:#16a34a;font-weight:bold;">+${_rc.fmt(s.excedente)}</span>`
            : `<span style="color:#dc2626;font-weight:bold;">${_rc.fmt(s.excedente)}</span>`;

        return `<tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:10px 12px;min-width:160px; display:flex; gap:8px; align-items:center;">
                <input type="checkbox" class="chk-cobrador" value="${i}" style="width:16px; height:16px; cursor:pointer; accent-color:#7c3aed;">
                <div>
                    <b style="font-size:13px;">${c.nombre || '—'}${window.CxcNotas ? window.CxcNotas.badgeHtml(c.agrupado ? c.folios : c.folio) : ''}</b><br>
                    <small style="color:#64748b;">${c.agrupado ? `${c.cuentasGrupo.length} cuentas: ${c.folios.join(', ')}` : c.folio}</small>
                </div>
            </td>
            <td style="padding:10px 12px;text-align:right;font-weight:bold;color:#dc2626;">${_rc.fmt(s.saldoActual)}</td>
            <td style="padding:10px 12px;text-align:right;">${_rc.fmt(s.totalPagado)}<br><small style="color:#64748b;">${s.numAbonos} abonos</small></td>
            <td style="padding:10px 12px;text-align:right;">${_rc.fmt(s.montoEsperado)}</td>
            <td style="padding:10px 12px;text-align:right;">${sneLabel}</td>
            <td style="padding:10px 12px;">
                ${_rc.miniBar(pctPagado, s.colorRiesgo)}
                <small style="color:#64748b;">${_rc.pct(pctPagado)}</small>
            </td>
            <td style="padding:10px 12px;">${_rc.badge(s.emojiRiesgo + ' ' + s.nivelRiesgo, s.colorRiesgo + '18', s.colorRiesgo)}</td>
            <td style="padding:10px 12px;">${diasLabel}</td>
            <td style="padding:10px 12px;">${freqLabel}</td>
            <td style="padding:10px 12px;text-align:right;">${_rc.fmt(s.promedioAbono90)}</td>
            <td style="padding:10px 12px;font-size:18px;text-align:center;" title="${c.tendencia}">${iconoTendencia}</td>
            <td style="padding:10px 12px;">
                ${c.agrupado
                    ? `<button onclick="abrirDetalleScorecardCliente('${encodeURIComponent(c.grupoClave).replace(/'/g, '%27')}')" style="padding:6px 10px;background:#4c1d95;color:white;border:none;border-radius:5px;cursor:pointer;font-size:11px;font-weight:bold;white-space:nowrap;">Ver cuentas</button>`
                    : `<button onclick="enviarRecordatorioWhatsApp('${c.folio}')" style="padding:5px 9px;background:#25D366;color:white;border:none;border-radius:5px;cursor:pointer;font-size:11px;" title="WhatsApp">💬</button>`}
            </td>
        </tr>`;
    }).join('');

    cont.innerHTML = `
    <div style="font-family:system-ui,sans-serif;max-width:1600px;margin:0 auto;padding:0 4px;">

        <div style="background:linear-gradient(135deg,#4c1d95,#7c3aed);color:white;padding:22px;border-radius:14px;margin-bottom:18px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
                <div>
                    <h2 style="margin:0;font-size:21px;font-weight:900;">🧬 Scorecard de Comportamiento de Pago</h2>
                    <p style="margin:5px 0 0;color:#ddd6fe;font-size:12px;">
                        Tendencia, frecuencia y Saldo Neto Esperado por cliente.
                        Un cliente con pagarés vencidos pero SNE positivo <b>está al corriente de facto</b>.
                    </p>
                </div>
                <div style="display:flex; gap:10px;">
                    <button onclick="generarListadoCobranza()" style="padding:10px 16px;background:#f59e0b;color:#713f12;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-size:12px;">📋 Generar Cobranza</button>
                    <button onclick="renderRutasCobranzaGuardadas()" style="padding:10px 16px;background:#e2e8f0;color:#0f172a;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-size:12px;">📂 Rutas Guardadas</button>
                    <button onclick="renderARC_v3()" style="padding:10px 16px;background:rgba(255,255,255,0.15);color:white;border:1px solid rgba(255,255,255,0.3);border-radius:8px;font-weight:bold;cursor:pointer;font-size:12px;">⬅️ Volver a ARC v3</button>
                </div>
            </div>
        </div>

        <div style="background:white;padding:14px;border-radius:10px;margin-bottom:16px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;box-shadow:0 2px 6px rgba(0,0,0,0.05);">
            <label style="width:100%;display:flex;align-items:center;gap:9px;padding-bottom:12px;border-bottom:1px solid #e2e8f0;color:#4c1d95;font-size:13px;font-weight:900;cursor:pointer;">
                <input type="checkbox" ${agruparCliente ? 'checked' : ''} onchange="window._cbAgruparCliente=this.checked;renderComportamiento();" style="width:18px;height:18px;accent-color:#7c3aed;cursor:pointer;">
                Agrupar cuentas por cliente
            </label>
            <div>
                <label style="font-size:11px;font-weight:bold;color:#64748b;">FILTRAR:</label>
                <select onchange="window._cbFiltro=this.value;renderComportamiento();" style="margin-left:8px;padding:7px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;">
                    <option value="todos" ${filtro==='todos'?'selected':''}>Todos</option>
                    <option value="alCorriente" ${filtro==='alCorriente'?'selected':''}>Al Corriente (SNE ≥ 0)</option>
                    <option value="enMora" ${filtro==='enMora'?'selected':''}>En Mora / Crítico</option>
                    <option value="sinAbono60" ${filtro==='sinAbono60'?'selected':''}>Sin abono 60+ días</option>
                    <option value="subiendo" ${filtro==='subiendo'?'selected':''}>Tendencia Subiendo 📈</option>
                </select>
            </div>
            <div>
                <label style="font-size:11px;font-weight:bold;color:#64748b;">ORDENAR:</label>
                <select onchange="window._cbOrden=this.value;window._cbDireccion=this.value==='nombre'||this.value==='excedente'?'asc':'desc';renderComportamiento();" style="margin-left:8px;padding:7px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;">
                    <option value="excedente" ${ordenar==='excedente'?'selected':''}>SNE (menor a mayor)</option>
                    <option value="saldo" ${ordenar==='saldo'?'selected':''}>Saldo (mayor a menor)</option>
                    <option value="diasSin" ${ordenar==='diasSin'?'selected':''}>Días sin pagar</option>
                    <option value="nombre" ${ordenar==='nombre'?'selected':''}>Nombre A-Z</option>
                </select>
            </div>
            <div style="margin-left:auto;font-size:12px;color:#64748b;">${lista.length} ${agruparCliente ? 'clientes consolidados' : 'cuentas mostradas'}</div>
        </div>

        <div style="background:white;border-radius:10px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,0.05);">
            <div style="overflow:auto;max-height:calc(100vh - 245px);min-height:280px;">
                <table style="width:100%;border-collapse:collapse;min-width:1200px;">
                    <thead>
                        <tr>
                            ${thOrdenable('nombre', 'Cliente')}
                            ${thOrdenable('saldo', 'Saldo', 'right')}
                            ${thOrdenable('pagado', 'Total Pagado', 'right')}
                            ${thOrdenable('esperado', 'Esperado Hoy', 'right')}
                            ${thOrdenable('excedente', 'SNE', 'right')}
                            ${thOrdenable('cubierto', '% Cubierto')}
                            ${thOrdenable('riesgo', 'Riesgo Real')}
                            ${thOrdenable('diasSin', 'Último Abono')}
                            ${thOrdenable('frecuencia', 'Frecuencia')}
                            ${thOrdenable('promedio90', 'Prom. 90d', 'right')}
                            ${thOrdenable('tendencia', 'Tend.', 'center')}
                            <th style="position:sticky;top:0;z-index:3;padding:11px 12px;font-size:11px;color:#475569;background:#f8fafc;text-align:left;border-bottom:2px solid #e2e8f0;">Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filas || '<tr><td colspan="12" style="padding:30px;text-align:center;color:#94a3b8;">Sin resultados para este filtro.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>

        <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:14px;border-radius:8px;margin-top:18px;font-size:12px;color:#1e40af;line-height:1.6;">
            <b>📌 ¿Cómo leer el SNE (Saldo Neto Esperado)?</b><br>
            Compara el <b>total acumulado pagado</b> contra la <b>suma de pagarés cuya fecha ya venció</b> (lo que "debía" haber pagado hasta hoy).
            Si el valor es <b style="color:#16a34a;">positivo → el cliente está adelantado</b>, aunque el sistema muestre pagarés individuales sin cerrar.
            Si es <b style="color:#dc2626;">negativo → hay déficit real</b> proporcional al plan contratado.
        </div>
    </div>`;
};

// ================================================================
// 4. REPORTE DE COBRANZA MENSUAL
// ================================================================
window.renderCobranzaMensual = function() {
    const cont = document.getElementById('arc-v3-contenido') ||
                 document.getElementById('reportes') ||
                 document.getElementById('dashboardContenido');
    if (!cont) return;

    const ventas  = StorageService.get('ventasRegistradas', []);
    const cxc     = StorageService.get('cuentasPorCobrar', []);

    const todosAbonos = [];
    cxc.forEach(c => {
        (c.abonos || []).forEach(a => {
            const f = _rc.parseFecha(a.fecha || a.fechaAbono);
            if (f) todosAbonos.push({ monto: parseFloat(a.monto || 0), fecha: f, folio: c.folio });
        });
    });

    const mesesSet = new Set();
    ventas.forEach(v => {
        const k = _rc.mesKey(v.fechaVenta || v.fechaIso);
        if (k) mesesSet.add(k);
    });
    todosAbonos.forEach(a => {
        const k = _rc.mesKey(a.fecha);
        if (k) mesesSet.add(k);
    });

    const meses = [...mesesSet].sort();
    if (!meses.length) {
        cont.innerHTML = `<div style="padding:50px;text-align:center;background:white;border-radius:16px;margin:20px 0;">
            <p style="color:#94a3b8;">No hay datos suficientes para generar este reporte.</p></div>`;
        return;
    }

    const datos = meses.map(mes => {
        const capitalNuevo = ventas
            .filter(v => _rc.mesKey(v.fechaVenta || v.fechaIso) === mes && v.metodoPago !== 'contado')
            .reduce((s, v) => s + parseFloat(v.total || v.totalVenta || 0), 0);

        const enganches = ventas
            .filter(v => _rc.mesKey(v.fechaVenta || v.fechaIso) === mes && v.metodoPago !== 'contado')
            .reduce((s, v) => s + parseFloat(v.enganche || 0), 0);

        const cobranzaReal = todosAbonos
            .filter(a => _rc.mesKey(a.fecha) === mes)
            .reduce((s, a) => s + a.monto, 0);

        const numAbonos = todosAbonos.filter(a => _rc.mesKey(a.fecha) === mes).length;

        const numVentasCredito = ventas.filter(v =>
            _rc.mesKey(v.fechaVenta || v.fechaIso) === mes && v.metodoPago !== 'contado').length;

        return { mes, capitalNuevo, enganches, cobranzaReal, numAbonos, numVentasCredito };
    });

    const maxColocado = Math.max(...datos.map(d => d.capitalNuevo), 1);
    const maxCobranza = Math.max(...datos.map(d => d.cobranzaReal), 1);
    const maxBar = Math.max(maxColocado, maxCobranza);

    const totalColocado = datos.reduce((s, d) => s + d.capitalNuevo, 0);
    const totalCobranza = datos.reduce((s, d) => s + d.cobranzaReal, 0);
    const tasaGlobal = totalColocado > 0 ? totalCobranza / totalColocado * 100 : 0;

    const barW = 30, gap = 10, groupW = barW * 2 + gap + 20;
    const chartW = datos.length * groupW + 60;
    const chartH = 160;

    const barras = datos.map((d, i) => {
        const x = 40 + i * groupW;
        const h1 = d.capitalNuevo / maxBar * chartH;
        const h2 = d.cobranzaReal / maxBar * chartH;
        const tasa = d.capitalNuevo > 0 ? Math.round(d.cobranzaReal / d.capitalNuevo * 100) : 0;
        return `
            <rect x="${x}" y="${chartH - h1}" width="${barW}" height="${h1}" fill="#3b82f6" rx="3" opacity=".85"/>
            <rect x="${x + barW + gap}" y="${chartH - h2}" width="${barW}" height="${h2}" fill="#16a34a" rx="3" opacity=".85"/>
            <text x="${x + barW + gap / 2}" y="${chartH + 14}" text-anchor="middle" font-size="8" fill="#64748b">${_rc.mesLabel(d.mes).split(' ')[0]}</text>
            ${tasa > 0 ? `<text x="${x + barW + gap / 2}" y="${chartH - Math.max(h1, h2) - 4}" text-anchor="middle" font-size="8" fill="${tasa >= 80 ? '#16a34a' : tasa >= 50 ? '#f59e0b' : '#dc2626'}" font-weight="bold">${tasa}%</text>` : ''}
        `;
    }).join('');

    const filas = datos.map(d => {
        const tasa = d.capitalNuevo > 0 ? d.cobranzaReal / d.capitalNuevo * 100 : 0;
        const colorTasa = tasa >= 80 ? '#16a34a' : tasa >= 50 ? '#d97706' : '#dc2626';
        return `<tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:10px 14px;font-weight:bold;color:#0f172a;">${_rc.mesLabel(d.mes)}</td>
            <td style="padding:10px 14px;text-align:right;">${d.numVentasCredito}</td>
            <td style="padding:10px 14px;text-align:right;font-weight:bold;color:#3b82f6;">${_rc.fmt(d.capitalNuevo)}</td>
            <td style="padding:10px 14px;text-align:right;color:#64748b;">${_rc.fmt(d.enganches)}</td>
            <td style="padding:10px 14px;text-align:right;font-weight:bold;color:#16a34a;">${_rc.fmt(d.cobranzaReal)}</td>
            <td style="padding:10px 14px;text-align:right;">${d.numAbonos}</td>
            <td style="padding:10px 14px;text-align:right;">
                <b style="color:${colorTasa};">${_rc.pct(tasa)}</b>
                ${_rc.miniBar(tasa, colorTasa)}
            </td>
            <td style="padding:10px 14px;text-align:right;color:${d.cobranzaReal - d.enganches > d.capitalNuevo * 0.15 ? '#16a34a' : '#dc2626'};font-weight:bold;">
                ${_rc.fmt(d.cobranzaReal - d.enganches)}
            </td>
        </tr>`;
    }).join('');

    cont.innerHTML = `
    <div style="font-family:system-ui,sans-serif;max-width:1400px;margin:0 auto;padding:0 4px;">

        <div style="background:linear-gradient(135deg,#0369a1,#0ea5e9);color:white;padding:22px;border-radius:14px;margin-bottom:18px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
                <div>
                    <h2 style="margin:0;font-size:21px;font-weight:900;">📅 Cobranza Mensual — Capital vs. Recuperación</h2>
                    <p style="margin:5px 0 0;color:#bae6fd;font-size:12px;">
                        Compara cuánto <b>capital nuevo se colocó en crédito</b> contra cuánto <b>efectivo real regresó</b> ese mes vía abonos.
                    </p>
                </div>
                <div style="display:flex; gap:10px;">
                    <button onclick="generarListadoCobranza()" style="padding:10px 16px;background:#f59e0b;color:#713f12;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-size:12px;">📋 Generar Cobranza</button>
                    <button onclick="renderRutasCobranzaGuardadas()" style="padding:10px 16px;background:#e2e8f0;color:#0f172a;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-size:12px;">📂 Rutas Guardadas</button>
                    <button onclick="renderARC_v3()" style="padding:10px 16px;background:rgba(255,255,255,0.15);color:white;border:1px solid rgba(255,255,255,0.3);border-radius:8px;font-weight:bold;cursor:pointer;font-size:12px;">⬅️ Volver a ARC v3</button>
                </div>
            </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-bottom:18px;">
            <div style="background:white;padding:16px;border-radius:10px;border-left:5px solid #3b82f6;box-shadow:0 2px 6px rgba(0,0,0,0.05);">
                <div style="font-size:11px;color:#64748b;font-weight:bold;">CAPITAL COLOCADO (TOTAL)</div>
                <div style="font-size:22px;font-weight:900;color:#3b82f6;">${_rc.fmt(totalColocado)}</div>
            </div>
            <div style="background:white;padding:16px;border-radius:10px;border-left:5px solid #16a34a;box-shadow:0 2px 6px rgba(0,0,0,0.05);">
                <div style="font-size:11px;color:#64748b;font-weight:bold;">COBRANZA TOTAL</div>
                <div style="font-size:22px;font-weight:900;color:#16a34a;">${_rc.fmt(totalCobranza)}</div>
            </div>
            <div style="background:white;padding:16px;border-radius:10px;border-left:5px solid ${tasaGlobal >= 70 ? '#16a34a' : tasaGlobal >= 45 ? '#f59e0b' : '#dc2626'};box-shadow:0 2px 6px rgba(0,0,0,0.05);">
                <div style="font-size:11px;color:#64748b;font-weight:bold;">TASA DE RECUPERACIÓN GLOBAL</div>
                <div style="font-size:22px;font-weight:900;color:${tasaGlobal >= 70 ? '#16a34a' : tasaGlobal >= 45 ? '#d97706' : '#dc2626'};">${_rc.pct(tasaGlobal)}</div>
            </div>
            <div style="background:white;padding:16px;border-radius:10px;border-left:5px solid #7c3aed;box-shadow:0 2px 6px rgba(0,0,0,0.05);">
                <div style="font-size:11px;color:#64748b;font-weight:bold;">BRECHA (AÚN POR COBRAR)</div>
                <div style="font-size:22px;font-weight:900;color:#7c3aed;">${_rc.fmt(totalColocado - totalCobranza)}</div>
            </div>
        </div>

        <div style="background:white;padding:20px;border-radius:12px;margin-bottom:18px;box-shadow:0 2px 6px rgba(0,0,0,0.05);overflow-x:auto;">
            <div style="display:flex;gap:20px;margin-bottom:12px;font-size:12px;">
                <span><span style="display:inline-block;width:12px;height:12px;background:#3b82f6;border-radius:2px;margin-right:5px;"></span>Capital Colocado</span>
                <span><span style="display:inline-block;width:12px;height:12px;background:#16a34a;border-radius:2px;margin-right:5px;"></span>Cobranza Real</span>
                <span style="color:#64748b;">% = tasa de recuperación mensual</span>
            </div>
            <svg width="${Math.max(chartW, 400)}" height="${chartH + 30}" style="overflow:visible;">
                ${barras}
            </svg>
        </div>

        <div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,0.05);">
            <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;min-width:900px;">
                    <thead style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
                        <tr>
                            <th style="padding:11px 14px;font-size:11px;color:#475569;text-align:left;">Mes</th>
                            <th style="padding:11px 14px;font-size:11px;color:#475569;text-align:right;">Ventas Crédito</th>
                            <th style="padding:11px 14px;font-size:11px;color:#3b82f6;text-align:right;">Capital Colocado</th>
                            <th style="padding:11px 14px;font-size:11px;color:#475569;text-align:right;">Enganches</th>
                            <th style="padding:11px 14px;font-size:11px;color:#16a34a;text-align:right;">Cobranza Real</th>
                            <th style="padding:11px 14px;font-size:11px;color:#475569;text-align:right;">Nº Abonos</th>
                            <th style="padding:11px 14px;font-size:11px;color:#475569;text-align:right;">Tasa Recup.</th>
                            <th style="padding:11px 14px;font-size:11px;color:#475569;text-align:right;">Cobr. neta s/enganche</th>
                        </tr>
                    </thead>
                    <tbody>${filas}</tbody>
                    <tfoot style="background:#f1f5f9;font-weight:bold;border-top:2px solid #e2e8f0;">
                        <tr>
                            <td style="padding:11px 14px;">TOTALES</td>
                            <td style="padding:11px 14px;text-align:right;">—</td>
                            <td style="padding:11px 14px;text-align:right;color:#3b82f6;">${_rc.fmt(totalColocado)}</td>
                            <td style="padding:11px 14px;text-align:right;">—</td>
                            <td style="padding:11px 14px;text-align:right;color:#16a34a;">${_rc.fmt(totalCobranza)}</td>
                            <td style="padding:11px 14px;text-align:right;">—</td>
                            <td style="padding:11px 14px;text-align:right;color:${tasaGlobal>=70?'#16a34a':tasaGlobal>=45?'#d97706':'#dc2626'};">${_rc.pct(tasaGlobal)}</td>
                            <td style="padding:11px 14px;text-align:right;">—</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    </div>`;
};

// ================================================================
// 5. REPORTE DE CONCENTRACIÓN DE CARTERA
// ================================================================
window.renderConcentracion = function() {
    const cont = document.getElementById('arc-v3-contenido') ||
                 document.getElementById('reportes') ||
                 document.getElementById('dashboardContenido');
    if (!cont) return;

    const cxc = StorageService.get('cuentasPorCobrar', []);
    const pagaresSistema = StorageService.get('pagaresSistema', []);
    const hoy = new Date(); hoy.setHours(12, 0, 0, 0);

    const activas = cxc.filter(c => !_rcCuentaCancelada(c) && !c.incobrable && (c.saldoActual || 0) > 0 && c.estado !== 'Saldado')
        .map(c => {
            const sne = _rc.calcularSNE(c, pagaresSistema.filter(p => p.folio === c.folio), hoy);
            return { ...c, sne };
        })
        .sort((a, b) => b.saldoActual - a.saldoActual);

    if (!activas.length) {
        cont.innerHTML = `<div style="padding:50px;text-align:center;background:white;border-radius:16px;margin:20px 0;"><p style="color:#94a3b8;">Sin cartera activa.</p></div>`;
        return;
    }

    const totalCartera = activas.reduce((s, c) => s + c.saldoActual, 0);
    const top10 = activas.slice(0, 10);
    const top10Total = top10.reduce((s, c) => s + c.saldoActual, 0);
    const top10Pct = totalCartera > 0 ? top10Total / totalCartera * 100 : 0;
    const top3Pct = activas.slice(0, 3).reduce((s, c) => s + c.saldoActual, 0) / totalCartera * 100;

    const hhi = activas.reduce((s, c) => {
        const share = c.saldoActual / totalCartera * 100;
        return s + share * share;
    }, 0);
    const hhiLabel = hhi > 2500 ? '🔴 Alta Concentración' : hhi > 1500 ? '🟠 Concentración Media' : '🟢 Diversificada';
    const hhiColor = hhi > 2500 ? '#dc2626' : hhi > 1500 ? '#d97706' : '#16a34a';

    let acum = 0;
    const filas = activas.slice(0, 20).map((c, i) => {
        const share = totalCartera > 0 ? c.saldoActual / totalCartera * 100 : 0;
        acum += share;
        const s = c.sne;
        return `<tr style="border-bottom:1px solid #f1f5f9;${i < 3 ? 'background:#fffbeb;' : ''}">
            <td style="padding:10px 12px;font-weight:bold;color:#64748b;text-align:center;">${i + 1}</td>
            <td style="padding:10px 12px;">
                <b>${c.nombre || '—'}${window.CxcNotas ? window.CxcNotas.badgeHtml(c.folio) : ''}</b><br><small style="color:#64748b;">${c.folio}</small>
            </td>
            <td style="padding:10px 12px;text-align:right;font-weight:900;color:#dc2626;">${_rc.fmt(c.saldoActual)}</td>
            <td style="padding:10px 12px;text-align:right;">
                ${_rc.pct(share)}<br>
                ${_rc.miniBar(share, '#3b82f6')}
            </td>
            <td style="padding:10px 12px;text-align:right;font-weight:bold;color:#64748b;">${_rc.pct(acum)}</td>
            <td style="padding:10px 12px;">${_rc.badge(s.emojiRiesgo + ' ' + s.nivelRiesgo, s.colorRiesgo + '18', s.colorRiesgo)}</td>
            <td style="padding:10px 12px;text-align:right;color:${s.excedente >= 0 ? '#16a34a' : '#dc2626'};font-weight:bold;">${_rc.fmt(s.excedente)}</td>
        </tr>`;
    }).join('');

    cont.innerHTML = `
    <div style="font-family:system-ui,sans-serif;max-width:1200px;margin:0 auto;padding:0 4px;">

        <div style="background:linear-gradient(135deg,#0f766e,#0d9488);color:white;padding:22px;border-radius:14px;margin-bottom:18px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
                <div>
                    <h2 style="margin:0;font-size:21px;font-weight:900;">🎯 Concentración de Cartera — Análisis Pareto</h2>
                    <p style="margin:5px 0 0;color:#99f6e4;font-size:12px;">
                        ¿Cuánto de tu riesgo está en pocos clientes? Identifica dependencias críticas con el índice HHI.
                    </p>
                </div>
                <div style="display:flex; gap:10px;">
                    <button onclick="generarListadoCobranza()" style="padding:10px 16px;background:#f59e0b;color:#713f12;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-size:12px;">📋 Generar Cobranza</button>
                    <button onclick="renderRutasCobranzaGuardadas()" style="padding:10px 16px;background:#e2e8f0;color:#0f172a;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-size:12px;">📂 Rutas Guardadas</button>
                    <button onclick="renderARC_v3()" style="padding:10px 16px;background:rgba(255,255,255,0.15);color:white;border:1px solid rgba(255,255,255,0.3);border-radius:8px;font-weight:bold;cursor:pointer;font-size:12px;">⬅️ Volver a ARC v3</button>
                </div>
            </div>
        </div>

        <!-- KPIs -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:12px;margin-bottom:18px;">
            <div style="background:white;padding:16px;border-radius:10px;border-left:5px solid #0f766e;box-shadow:0 2px 6px rgba(0,0,0,0.05);">
                <div style="font-size:11px;color:#64748b;font-weight:bold;">CARTERA TOTAL</div>
                <div style="font-size:20px;font-weight:900;color:#0f766e;">${_rc.fmt(totalCartera)}</div>
                <div style="font-size:11px;color:#64748b;">${activas.length} clientes</div>
            </div>
            <div style="background:white;padding:16px;border-radius:10px;border-left:5px solid #f59e0b;box-shadow:0 2px 6px rgba(0,0,0,0.05);">
                <div style="font-size:11px;color:#64748b;font-weight:bold;">TOP 3 CONCENTRAN</div>
                <div style="font-size:20px;font-weight:900;color:#d97706;">${_rc.pct(top3Pct)}</div>
                <div style="font-size:11px;color:#64748b;">del saldo total</div>
            </div>
            <div style="background:white;padding:16px;border-radius:10px;border-left:5px solid #3b82f6;box-shadow:0 2px 6px rgba(0,0,0,0.05);">
                <div style="font-size:11px;color:#64748b;font-weight:bold;">TOP 10 CONCENTRAN</div>
                <div style="font-size:20px;font-weight:900;color:#3b82f6;">${_rc.pct(top10Pct)}</div>
                <div style="font-size:11px;color:#64748b;">${_rc.fmt(top10Total)}</div>
            </div>
            <div style="background:white;padding:16px;border-radius:10px;border-left:5px solid ${hhiColor};box-shadow:0 2px 6px rgba(0,0,0,0.05);">
                <div style="font-size:11px;color:#64748b;font-weight:bold;">ÍNDICE HHI</div>
                <div style="font-size:20px;font-weight:900;color:${hhiColor};">${Math.round(hhi)}</div>
                <div style="font-size:11px;color:${hhiColor};font-weight:bold;">${hhiLabel}</div>
            </div>
        </div>

        <!-- Tabla top 20 -->
        <div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,0.05);">
            <div style="padding:14px 16px;border-bottom:1px solid #e2e8f0;font-weight:bold;color:#0f172a;">
                Top ${Math.min(20, activas.length)} clientes por saldo
                <span style="font-size:11px;color:#64748b;margin-left:8px;">(Fondo amarillo = Top 3)</span>
            </div>
            <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;">
                    <thead style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
                        <tr>
                            <th style="padding:10px 12px;font-size:11px;color:#475569;text-align:center;">#</th>
                            <th style="padding:10px 12px;font-size:11px;color:#475569;text-align:left;">Cliente</th>
                            <th style="padding:10px 12px;font-size:11px;color:#475569;text-align:right;">Saldo</th>
                            <th style="padding:10px 12px;font-size:11px;color:#475569;text-align:right;">% Cartera</th>
                            <th style="padding:10px 12px;font-size:11px;color:#475569;text-align:right;">% Acumulado</th>
                            <th style="padding:10px 12px;font-size:11px;color:#475569;">Riesgo SNE</th>
                            <th style="padding:10px 12px;font-size:11px;color:#475569;text-align:right;">SNE ↕</th>
                        </tr>
                    </thead>
                    <tbody>${filas}</tbody>
                </table>
            </div>
        </div>
    </div>`;
};

// ================================================================
// RUTA DE COBRANZA — construcción central (carta + imagen por
// bloques de mes) y guardado/reapertura de rutas ya generadas
// ================================================================

// Reconstruye una lista de ventas "en vivo" (cuenta + SNE de HOY) a partir
// de una lista de folios guardada — para poder reabrir una ruta días
// después con los números actualizados, no una foto congelada del día
// que se guardó.
function _cobranzaVentasDesdeFolios(folios) {
    const cxc = StorageService.get('cuentasPorCobrar', []);
    const pagaresSistema = StorageService.get('pagaresSistema', []);
    const hoy = new Date();
    const set = new Set(folios || []);
    return cxc
        .filter(c => set.has(c.folio) && !_rcCuentaCancelada(c) && !c.incobrable && (c.saldoActual || 0) > 0 && c.estado !== 'Saldado')
        .map(c => {
            const pCta = pagaresSistema.filter(p => p.folio === c.folio);
            const sne = _rc.calcularSNE(c, pCta, hoy);
            return { ...c, sne, pagares: pCta };
        });
}

// Núcleo compartido: recibe una lista PLANA de ventas (cuenta+sne) y arma
// y abre los dos formatos. Lo usan tanto "Generar Cobranza" (checkboxes en
// pantalla) como "Rutas Guardadas" (al reabrir una ruta ya guardada) — así
// nunca hay dos copias de esta lógica desincronizándose entre sí.
function _cobranzaConstruirYAbrir(ventasFlat) {
    const hoy = new Date();

    const formatearFecha = (fecha) => {
        if (!fecha) return 'S/F';
        const d = typeof fecha === 'string' || typeof fecha === 'number' ? new Date(fecha) : fecha;
        return isNaN(d.getTime()) ? 'S/F' : d.toLocaleDateString('es-MX');
    };

    // 1. Agrupar por cliente real (mismo criterio que _arcExAgruparCliente),
    //    para que "2 ventas del mismo cliente" siempre salgan una por una
    //    con un total de cliente, sin importar de dónde vino la selección.
    const normalizar = v => String(v || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const gruposMap = {};
    ventasFlat.forEach(v => {
        const clave = v.clienteId ? `id:${v.clienteId}` : `nombre:${normalizar(v.nombre || v.clienteNombre)}|tel:${normalizar(v.telefono)}`;
        (gruposMap[clave] = gruposMap[clave] || []).push(v);
    });
    const clientesRaw = Object.values(gruposMap).map(ventas => {
        const base = ventas.slice().sort((a, b) => {
            const fa = _rc.parseFecha(a.fechaVenta || a.fechaIso || a.fecha)?.getTime() || 0;
            const fb = _rc.parseFecha(b.fechaVenta || b.fechaIso || b.fecha)?.getTime() || 0;
            return fb - fa;
        })[0];
        return { base, ventas };
    });

    // 2. Plazo pactado y salto de plazo por antigüedad (NO moratorios — es
    //    otra pieza aparte). _cxcDetectarSaltoPlazo(cuenta) en cxc.js es la
    //    MISMA función que usa Bóveda: si ya pasó su plazo pactado, recotiza
    //    al SIGUIENTE escalón de la escalera sobre el capital original de la
    //    venta. Es de solo lectura aquí — no toca saltosPlazoPendientes ni
    //    Bóveda, solo proyecta. Tope: nunca pasa de 6 meses.
    const evaluarPlazo = (v) => {
        const saldoNominal = Number(v.sne?.saldoActual ?? v.saldoActual ?? 0);
        const fechaFinal = typeof window._cxcFechaFinalCredito === 'function'
            ? window._cxcFechaFinalCredito(v, null) : null;
        const mesesPlan = Number(v.plan?.meses || v.plazoMeses || v.meses || 0);
        const diasVencidos = fechaFinal ? Math.floor((hoy - fechaFinal) / 86400000) : 0;
        const vencido = diasVencidos > 0;
        const salto = vencido && typeof window._cxcDetectarSaltoPlazo === 'function'
            ? window._cxcDetectarSaltoPlazo(v)
            : null;
        const diferenciaSalto = salto ? Number(salto.diferencia || 0) : 0;
        return {
            saldoNominal, fechaFinal, mesesPlan, vencido, diasVencidos,
            mesesNuevo: salto ? salto.mesesNuevo : null,
            diferenciaSalto,
            saldoSiSalta: saldoNominal + diferenciaSalto,
            enTopePlazo: vencido && !salto && mesesPlan >= 6
        };
    };

    // 3. Último abono: fecha (SNE) + monto (nuevo, mismo filtro de abonos
    //    cancelados que usa calcularSNE, para que ambos coincidan).
    const ultimoAbono = (v) => {
        const abonos = (v.abonos || []).filter(a => !a.cancelado && !a.canceladoPorVenta && !a.canceladoPorApartado);
        const conFecha = abonos
            .map(a => ({ monto: Number(a.monto || 0), fecha: _rc.parseFecha(a.fecha || a.fechaAbono) }))
            .filter(a => a.fecha);
        if (!conFecha.length) return null;
        conFecha.sort((a, b) => b.fecha - a.fecha);
        return conFecha[0];
    };

    // 4. Estructura de datos que alimenta AMBOS formatos
    const clientes = clientesRaw.map(({ base, ventas }) => {
        const fechaVentaBase = _rc.parseFecha(base.fechaVenta || base.fechaIso || base.fecha);
        const filas = ventas.map(v => {
            const s = v.sne || {};
            const plazo = evaluarPlazo(v);
            const ult = ultimoAbono(v);
            let articulosText = 'Sin detalle de artículos';
            if (v.articulos && v.articulos.length > 0) {
                articulosText = v.articulos.map(a => `${a.cantidad || 1}x ${a.nombre || a.productoNombre || '-'}`).join(', ');
            }
            return {
                fechaVentaStr: formatearFecha(v.fechaVenta || v.fechaIso || v.fecha),
                articulosText,
                abonado: Number(s.totalPagado || 0),
                saldo: plazo.saldoNominal,
                mesesPlan: plazo.mesesPlan,
                fechaFinalStr: plazo.fechaFinal ? formatearFecha(plazo.fechaFinal) : null,
                vencido: plazo.vencido,
                diasVencidos: plazo.diasVencidos,
                mesesNuevo: plazo.mesesNuevo,
                diferenciaSalto: plazo.diferenciaSalto,
                saldoSiSalta: plazo.saldoSiSalta,
                enTopePlazo: plazo.enTopePlazo,
                ultimaFechaAbono: s.ultimaFechaAbono || null,
                ultAbonoFechaStr: s.ultimaFechaAbono ? formatearFecha(s.ultimaFechaAbono) : 'Sin abonos',
                ultAbonoMontoStr: ult ? _rc.fmt(ult.monto) : '—',
                diasSinPagoStr: s.diasSinPagar === 9999 ? 'Sin abonos' : `${s.diasSinPagar} días`
            };
        });

        const totalAbonado = filas.reduce((s, f) => s + f.abonado, 0);
        const totalSaldo = filas.reduce((s, f) => s + f.saldo, 0);
        const totalSiSalta = filas.reduce((s, f) => s + f.saldoSiSalta, 0);
        const tieneSalto = filas.some(f => f.diferenciaSalto > 0);

        // Último abono del CLIENTE = el más reciente entre TODAS sus ventas
        // (si tiene 2+ cuentas, cada una pudo abonar en fechas distintas).
        // Esto alimenta el bloque de mes (ver punto 5) y va aparte de
        // ultAbonoFechaStr/Monto por venta, que sigue siendo por cuenta.
        const fechasAbonoCliente = filas.map(f => f.ultimaFechaAbono).filter(Boolean);
        const ultimaFechaAbonoCliente = fechasAbonoCliente.length
            ? new Date(Math.max(...fechasAbonoCliente.map(f => f.getTime())))
            : null;

        return {
            nombre: base.nombre || base.clienteNombre || 'Sin nombre',
            telefono: base.telefono || 'N/D',
            direccion: base.direccion || 'N/D',
            fechaVentaBase,
            ultimaFechaAbonoCliente,
            filas,
            multiVenta: filas.length > 1,
            totalAbonado, totalSaldo, totalSiSalta, tieneSalto
        };
    });

    const haySaltosEnRuta = clientes.some(c => c.tieneSalto);

    // 5. Bloques por mes DEL ÚLTIMO ABONO (no de la venta) — así el cobrador
    //    agrupa por "cuándo pagó por última vez", que es lo que de verdad
    //    ayuda a planear la ruta. Sin abonos registrados cae en su propio
    //    bloque "SIN ABONOS" al final, en vez de mezclarse por fecha de venta.
    const bloqueClave = (fecha) => fecha && !isNaN(fecha.getTime())
        ? `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
        : 'sin-abonos';
    const bloquesMap = {};
    clientes.forEach(c => {
        const key = bloqueClave(c.ultimaFechaAbonoCliente);
        (bloquesMap[key] = bloquesMap[key] || []).push(c);
    });
    const clavesOrdenadas = Object.keys(bloquesMap).sort((a, b) => a === 'sin-abonos' ? 1 : b === 'sin-abonos' ? -1 : a.localeCompare(b));
    const bloques = clavesOrdenadas.map(key => ({
        key,
        etiqueta: key === 'sin-abonos' ? 'SIN ABONOS REGISTRADOS' : _rc.mesLabel(key),
        clientes: bloquesMap[key]
    }));

    // ============================================================
    // FORMATO A — Hoja tamaño carta (tabla, para llevar impresa)
    // ============================================================
    let contadorGlobal = 0;
    const seccionesCartaHtml = bloques.map(bloque => {
        const filasBloqueHtml = bloque.clientes.map(c => {
            contadorGlobal++;
            const i = contadorGlobal;
            const filasVenta = c.filas.map((f, idx) => {
                const etiquetaVenta = c.multiVenta ? `<div style="color:#475569;font-size:9.5px;">↳ Venta ${idx + 1} · ${f.articulosText}</div>` : '';
                const plazoHtml = f.fechaFinalStr
                    ? (f.vencido
                        ? `<div style="color:#dc2626;font-weight:bold;">🔴 Venció hace ${f.diasVencidos}d (${f.fechaFinalStr})</div>${f.diferenciaSalto > 0 ? `<div style="color:#dc2626;font-size:9px;">Si sube a ${f.mesesNuevo}m: ${_rc.fmt(f.saldoSiSalta)} (+${_rc.fmt(f.diferenciaSalto)})</div>` : (f.enTopePlazo ? `<div style="color:#94a3b8;font-size:9px;">Ya en tope de plazo (6m)</div>` : '')}`
                        : `<div style="color:#16a34a;">🟢 Vence ${f.fechaFinalStr} (${f.mesesPlan || '?'}m)</div>`)
                    : `<div style="color:#94a3b8;">Plazo N/D</div>`;
                return `
                <tr style="border-bottom:${idx === c.filas.length - 1 && !c.multiVenta ? '2px solid #cbd5e1' : '1px solid #e2e8f0'};">
                    ${idx === 0 ? `<td rowspan="${c.filas.length + (c.multiVenta ? 1 : 0)}" style="padding:8px 4px;font-weight:bold;font-size:13px;vertical-align:top;">${i}</td>` : ''}
                    ${idx === 0 ? `<td rowspan="${c.filas.length + (c.multiVenta ? 1 : 0)}" style="padding:8px 4px;vertical-align:top;">
                        <div style="font-weight:900;font-size:12.5px;">${c.nombre}</div>
                        <div style="font-size:9.5px;color:#475569;">📞 ${c.telefono}</div>
                        <div style="font-size:9.5px;color:#475569;">📍 ${c.direccion}</div>
                        ${!c.multiVenta ? `<div style="font-size:9.5px;color:#475569;margin-top:2px;">🛒 ${c.filas[0].articulosText}</div>` : ''}
                    </td>` : ''}
                    <td style="padding:6px 4px;font-size:10px;vertical-align:top;">
                        <div>F. Venta: <b>${f.fechaVentaStr}</b></div>
                        ${etiquetaVenta}
                        ${plazoHtml}
                    </td>
                    <td style="padding:6px 4px;font-size:10.5px;text-align:right;vertical-align:top;color:#16a34a;font-weight:bold;">${_rc.fmt(f.abonado)}</td>
                    <td style="padding:6px 4px;font-size:11px;text-align:right;vertical-align:top;color:#dc2626;font-weight:bold;">${_rc.fmt(f.saldo)}</td>
                    <td style="padding:6px 4px;font-size:10px;vertical-align:top;">
                        <div>${f.ultAbonoFechaStr}</div>
                        <div style="color:#475569;">${f.ultAbonoMontoStr}</div>
                    </td>
                    <td style="padding:6px 4px;font-size:10px;text-align:center;vertical-align:top;font-weight:bold;color:${f.diasSinPagoStr === 'Sin abonos' ? '#7f1d1d' : (parseInt(f.diasSinPagoStr) > 30 ? '#7f1d1d' : '#c2410c')};">${f.diasSinPagoStr}</td>
                    ${idx === 0 ? `<td rowspan="${c.filas.length + (c.multiVenta ? 1 : 0)}" style="padding:6px 4px;width:90px;vertical-align:top;">
                        <div style="border-bottom:1px solid #94a3b8;height:20px;margin-bottom:8px;"></div>
                        <div style="border-bottom:1px solid #94a3b8;height:20px;"></div>
                    </td>` : ''}
                </tr>`;
            }).join('');

            const filaTotal = c.multiVenta ? `
                <tr style="border-bottom:2px solid #cbd5e1;background:#f1f5f9;">
                    <td style="padding:5px 4px;font-weight:900;font-size:10px;" colspan="2">TOTAL CLIENTE (${c.filas.length} ventas)</td>
                    <td style="padding:5px 4px;text-align:right;font-weight:900;color:#16a34a;font-size:10.5px;">${_rc.fmt(c.totalAbonado)}</td>
                    <td style="padding:5px 4px;text-align:right;font-weight:900;color:#dc2626;font-size:11px;">${_rc.fmt(c.totalSaldo)}${c.tieneSalto ? `<div style="font-size:8.5px;font-weight:normal;">si sube de plazo: ${_rc.fmt(c.totalSiSalta)}</div>` : ''}</td>
                    <td colspan="2"></td>
                </tr>` : '';

            return filasVenta + filaTotal;
        }).join('');

        return `
        <tr><td colspan="8" style="padding:10px 4px 4px;font-weight:900;font-size:11px;color:#1e40af;border-bottom:1px solid #93c5fd;">📅 ${bloque.etiqueta} · ${bloque.clientes.length} cliente${bloque.clientes.length > 1 ? 's' : ''}</td></tr>
        ${filasBloqueHtml}`;
    }).join('');

    const htmlCarta = `
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #e2e8f0;padding-bottom:10px;margin-bottom:8px;">
            <div style="display:flex;align-items:center;gap:12px;">
                <img src="img/Logo.svg" style="width:44px;height:44px;object-fit:contain;" onerror="this.outerHTML='<span style=\\'font-size:26px;\\'>🏛️</span>'">
                <div>
                    <h2 style="margin:0;color:#0f172a;font-size:16px;">Ruta de Cobranza en Campo</h2>
                    <div style="font-size:11px;color:#64748b;font-weight:bold;">Mueblería Mi Pueblito</div>
                </div>
            </div>
            <div style="font-size:10px;color:#64748b;text-align:right;">
                Fecha emisión: <b>${hoy.toLocaleDateString('es-MX')}</b><br>
                Clientes: <b>${clientes.length}</b>
            </div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:10px;">
            <thead>
                <tr style="background:#f8fafc;text-align:left;border-bottom:2px solid #cbd5e1;">
                    <th style="padding:6px 4px;width:16px;">#</th>
                    <th style="padding:6px 4px;">Cliente</th>
                    <th style="padding:6px 4px;">Venta / Plazo</th>
                    <th style="padding:6px 4px;text-align:right;">Abonado</th>
                    <th style="padding:6px 4px;text-align:right;">Saldo</th>
                    <th style="padding:6px 4px;">Último abono</th>
                    <th style="padding:6px 4px;text-align:center;">Días s/pago</th>
                    <th style="padding:6px 4px;">Firma / notas</th>
                </tr>
            </thead>
            <tbody>${seccionesCartaHtml}</tbody>
        </table>
        ${haySaltosEnRuta ? `<p style="font-size:9px;color:#94a3b8;margin-top:8px;">* "Si sube de plazo" muestra a cuánto subiría el saldo si se aplica el salto de plazo al siguiente escalón (mismo cálculo que usa el sistema: recotiza sobre el capital original de la venta). No sube automáticamente — requiere que tú lo confirmes en Bóveda.</p>` : ''}
    `;

    // ============================================================
    // FORMATO B — Imagen vertical optimizada para celular, por
    // bloques de mes (para no perderse en listas largas). Cada bloque se
    // arma como un documento HTML AUTÓNOMO (no vive dentro de una ventana
    // emergente) para poder descargarlo directo con TicketService.
    // ============================================================
    const construirBloqueCelular = (bloque) => {
        let contador = 0;
        const tarjetasHtml = bloque.clientes.map(c => {
            contador++;
            const ventasHtml = c.multiVenta ? c.filas.map((f, idx) => `
                <div style="background:#f8fafc;border-radius:6px;padding:7px 9px;margin-top:${idx === 0 ? 8 : 6}px;font-size:10.5px;">
                    <div style="display:flex;justify-content:space-between;">
                        <span>Venta ${idx + 1} · ${f.articulosText} (${f.fechaVentaStr})</span>
                        <span style="color:#dc2626;font-weight:bold;">${_rc.fmt(f.saldo)}</span>
                    </div>
                    <div style="color:#64748b;font-size:9.5px;">Últ. abono ${f.ultAbonoFechaStr} · ${f.ultAbonoMontoStr} · ${f.diasSinPagoStr}</div>
                    ${f.fechaFinalStr ? `<div style="font-size:9.5px;margin-top:2px;color:${f.vencido ? '#dc2626' : '#16a34a'};font-weight:bold;">
                        ${f.vencido ? `🔴 Venció hace ${f.diasVencidos}d` : `🟢 Vence ${f.fechaFinalStr}`}
                        ${f.diferenciaSalto > 0 ? ` · si sube a ${f.mesesNuevo}m: ${_rc.fmt(f.saldoSiSalta)}` : ''}
                    </div>` : ''}
                </div>`).join('') : '';

            const unaVenta = !c.multiVenta ? c.filas[0] : null;

            return `
            <div style="border:1px solid #e2e8f0;border-radius:8px;padding:11px;margin-bottom:10px;">
                <div style="font-weight:900;font-size:14px;">${contador}. ${c.nombre}</div>
                <div style="font-size:10.5px;color:#475569;margin-top:2px;">📞 ${c.telefono} · 📍 ${c.direccion}</div>
                ${unaVenta ? `
                <div style="font-size:10.5px;color:#475569;">🛒 ${unaVenta.articulosText} · Venta: ${unaVenta.fechaVentaStr}</div>
                <div style="display:flex;justify-content:space-between;margin-top:8px;">
                    <div><div style="font-size:9px;color:#64748b;">SALDO</div><div style="font-size:19px;font-weight:900;color:#dc2626;">${_rc.fmt(unaVenta.saldo)}</div></div>
                    <div style="text-align:right;"><div style="font-size:9px;color:#64748b;">ABONADO</div><div style="font-size:14px;font-weight:900;color:#16a34a;">${_rc.fmt(unaVenta.abonado)}</div></div>
                </div>
                <div style="display:flex;justify-content:space-between;margin-top:6px;padding-top:6px;border-top:1px dashed #e2e8f0;font-size:10px;">
                    <span>Últ. abono: <b>${unaVenta.ultAbonoFechaStr} · ${unaVenta.ultAbonoMontoStr}</b></span>
                    <span style="font-weight:bold;color:${unaVenta.diasSinPagoStr === 'Sin abonos' ? '#7f1d1d' : '#c2410c'};">${unaVenta.diasSinPagoStr}</span>
                </div>
                ${unaVenta.fechaFinalStr ? `<div style="margin-top:6px;font-size:10.5px;font-weight:bold;color:${unaVenta.vencido ? '#dc2626' : '#16a34a'};">
                    ${unaVenta.vencido ? `🔴 Plazo venció hace ${unaVenta.diasVencidos} días` : `🟢 Plazo vence ${unaVenta.fechaFinalStr}`}
                    ${unaVenta.diferenciaSalto > 0 ? `<div style="font-size:10px;">Si sube a ${unaVenta.mesesNuevo} meses: ${_rc.fmt(unaVenta.saldoSiSalta)} (+${_rc.fmt(unaVenta.diferenciaSalto)})</div>` : (unaVenta.enTopePlazo ? `<div style="font-size:10px;color:#94a3b8;">Ya en tope de plazo (6m)</div>` : '')}
                </div>` : ''}
                ` : `
                ${ventasHtml}
                <div style="display:flex;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:1px solid #cbd5e1;">
                    <span style="font-weight:900;font-size:12px;">TOTAL CLIENTE</span>
                    <span style="font-weight:900;font-size:17px;color:#dc2626;">${_rc.fmt(c.totalSaldo)}</span>
                </div>
                ${c.tieneSalto ? `<div style="text-align:right;font-size:10px;color:#dc2626;">si suben de plazo: ${_rc.fmt(c.totalSiSalta)}</div>` : ''}
                `}
            </div>`;
        }).join('');

        return `
        <div style="max-width:380px;margin:0 auto;padding:10px 4px;">
            <div style="text-align:center;border-bottom:2px solid #1e40af;padding-bottom:6px;margin-bottom:10px;">
                <div style="font-weight:900;font-size:15px;">Ruta de Cobranza</div>
                <div style="font-size:10px;color:#64748b;">${hoy.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                <div style="font-weight:900;font-size:14px;color:#1e40af;margin-top:6px;">📅 ${bloque.etiqueta}</div>
                <div style="font-size:10px;color:#64748b;">${bloque.clientes.length} cliente${bloque.clientes.length > 1 ? 's' : ''}</div>
            </div>
            ${tarjetasHtml}
        </div>`;
    };

    const fecha = hoy.toISOString().slice(0, 10);
    const bloquesConHtml = bloques.map(b => ({ ...b, htmlStandalone: construirBloqueCelular(b) }));

    // 6. Selector de formato — SIEMPRE a través de TicketService.descargarPdf/
    // descargarImagen (el MISMO motor que ya usan tickets, cortes de caja y
    // estados de cuenta en toda la app). A propósito NO se abre un popup para
    // guardar: esas descargas corren en la ventana emergente (about:blank),
    // y en varios celulares/navegadores una descarga disparada desde ahí no
    // se guarda de verdad aunque parezca generarse. descargarPdf/descargarImagen
    // corren en ESTA misma ventana (con un iframe oculto por dentro), que es
    // el camino que sí funciona para guardar en el teléfono.
    _cobranzaMostrarSelectorFormato({ htmlCarta, bloques: bloquesConHtml, fecha, totalClientes: clientes.length });
}

// Modal de selección de formato para la Ruta de Cobranza (ver nota arriba de
// por qué esto reemplazó abrir un popup con su propio botón "Guardar imagen").
function _cobranzaMostrarSelectorFormato({ htmlCarta, bloques, fecha, totalClientes }) {
    if (!window.TicketService) {
        alert('No se encontró el motor de documentos (TicketService). Recarga la página e intenta de nuevo.');
        return;
    }
    document.querySelector('[data-modal="cobranza-formato"]')?.remove();

    window._cobBloquesPendientes = bloques;
    window._cobFechaPendiente = fecha;

    const filasBloques = bloques.map((b, i) => `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:8px;">
            <div>
                <div style="font-weight:900;font-size:12.5px;">📅 ${b.etiqueta}</div>
                <div style="font-size:10.5px;color:#64748b;">${b.clientes.length} cliente${b.clientes.length > 1 ? 's' : ''}</div>
            </div>
            <div style="display:flex;gap:6px;">
                <button onclick="_cobDescargarBloque(${i},'pdf')" style="padding:8px 12px;border:0;border-radius:6px;background:#1e40af;color:white;font-weight:bold;cursor:pointer;font-size:11px;">📥 PDF</button>
                <button onclick="_cobDescargarBloque(${i},'imagen')" style="padding:8px 12px;border:0;border-radius:6px;background:#047857;color:white;font-weight:bold;cursor:pointer;font-size:11px;">🖼️ Imagen</button>
            </div>
        </div>`).join('');

    document.body.insertAdjacentHTML('beforeend', `
        <div data-modal="cobranza-formato" style="position:fixed;inset:0;background:rgba(15,23,42,.72);z-index:120000;display:flex;align-items:center;justify-content:center;padding:18px;">
            <div style="width:100%;max-width:460px;max-height:85vh;overflow-y:auto;background:white;border-radius:10px;padding:22px;box-shadow:0 24px 55px rgba(15,23,42,.3);">
                <h3 style="margin:0;color:#0f172a;">Generar Ruta de Cobranza</h3>
                <p style="margin:6px 0 16px;color:#64748b;font-size:12.5px;">${totalClientes} cliente(s) · ${fecha}</p>

                <div style="font-size:11px;font-weight:900;color:#475569;margin-bottom:8px;">📄 HOJA CARTA</div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:18px;">
                    <button onclick="_cobDescargarCarta('pdf')" style="padding:12px 6px;border:0;border-radius:7px;background:#1e40af;color:white;font-weight:900;cursor:pointer;font-size:12px;">📥 PDF</button>
                    <button onclick="_cobDescargarCarta('imagen')" style="padding:12px 6px;border:0;border-radius:7px;background:#047857;color:white;font-weight:900;cursor:pointer;font-size:12px;">🖼️ Imagen</button>
                    <button onclick="_cobDescargarCarta('ver')" style="padding:12px 6px;border:0;border-radius:7px;background:#7c3aed;color:white;font-weight:900;cursor:pointer;font-size:12px;">👁️ Ver / Imprimir</button>
                </div>

                <div style="font-size:11px;font-weight:900;color:#475569;margin-bottom:8px;">📱 IMAGEN PARA CELULAR — por mes</div>
                ${filasBloques}

                <button onclick="document.querySelector('[data-modal=\\'cobranza-formato\\']')?.remove()" style="width:100%;margin-top:8px;padding:10px;border:0;border-radius:7px;background:#e2e8f0;color:#334155;font-weight:bold;cursor:pointer;">Cerrar</button>
                <p style="margin:10px 0 0;font-size:10px;color:#94a3b8;">PDF/Imagen se descargan directo a tu dispositivo. "Ver/Imprimir" abre una vista previa en otra pestaña.</p>
            </div>
        </div>`);

    window._cobDescargarCarta = function(formato) {
        const fname = `ruta-cobranza-${window._cobFechaPendiente}`;
        const titulo = `Ruta de Cobranza ${window._cobFechaPendiente}`;
        if (formato === 'pdf') {
            window.TicketService.descargarPdf(htmlCarta, { title: titulo, filename: fname, pageSize: 'letter' });
        } else if (formato === 'imagen') {
            window.TicketService.descargarImagen(htmlCarta, { title: titulo, filename: fname });
        } else {
            window.TicketService.openDocument(htmlCarta, { title: titulo, filename: fname, pageSize: 'letter', thermal: false });
        }
    };

    window._cobDescargarBloque = function(i, formato) {
        const b = window._cobBloquesPendientes?.[i];
        if (!b) return;
        const fname = `ruta-cobranza-celular-${b.key}-${window._cobFechaPendiente}`;
        const titulo = `Ruta de Cobranza ${b.etiqueta}`;
        if (formato === 'pdf') {
            window.TicketService.descargarPdf(b.htmlStandalone, { title: titulo, filename: fname, pageSize: 'half-letter' });
        } else {
            window.TicketService.descargarImagen(b.htmlStandalone, { title: titulo, filename: fname });
        }
    };
}
// ─── Entrada 1: generar desde los checkboxes marcados en pantalla ───────
window.generarListadoCobranza = function() {
    const checkboxes = document.querySelectorAll('.chk-cobrador:checked');
    if (checkboxes.length === 0) {
        return alert("⚠️ Selecciona al menos un cliente marcando su casilla para generar el listado.");
    }
    const seleccion = Array.from(checkboxes)
        .map(chk => window._filasParaCobranza[parseInt(chk.value)])
        .filter(Boolean);

    // Deshacer cualquier agrupación previa de pantalla — la ruta guardada
    // siempre se guarda por folio individual, nunca por fila agrupada.
    let ventasFlat = [];
    seleccion.forEach(c => {
        if (c.agrupadoPorCliente && Array.isArray(c.cuentasGrupo) && c.cuentasGrupo.length) {
            ventasFlat.push(...c.cuentasGrupo);
        } else {
            ventasFlat.push(c);
        }
    });

    // Ofrecer guardar esta ruta para poder reabrirla/reimprimirla después
    // (con los saldos actualizados a ese día, no una foto congelada de hoy).
    const nombreRuta = prompt('¿Guardar esta ruta para poder volver a generarla después?\nEscribe un nombre (o deja vacío para no guardarla):', `Ruta ${new Date().toLocaleDateString('es-MX')}`);
    if (nombreRuta && nombreRuta.trim()) {
        const folios = ventasFlat.map(v => v.folio).filter(Boolean);
        const rutas = StorageService.get('rutasCobranzaGuardadas', []);
        rutas.unshift({
            id: Date.now(),
            nombre: nombreRuta.trim(),
            fechaGuardada: new Date().toISOString(),
            folios,
            totalClientesAlGuardar: seleccion.length
        });
        StorageService.set('rutasCobranzaGuardadas', rutas.slice(0, 60));
    }

    _cobranzaConstruirYAbrir(ventasFlat);
};

// ─── Entrada 2: reabrir una ruta ya guardada, con datos actualizados ────
window._cobranzaReabrirRuta = function(id) {
    const rutas = StorageService.get('rutasCobranzaGuardadas', []);
    const ruta = rutas.find(r => r.id === id);
    if (!ruta) return alert('No se encontró esa ruta guardada.');
    const ventasFlat = _cobranzaVentasDesdeFolios(ruta.folios);
    if (!ventasFlat.length) {
        return alert('Ninguna de las cuentas de esta ruta sigue activa hoy (todas fueron liquidadas o canceladas).');
    }
    _cobranzaConstruirYAbrir(ventasFlat);
};

window._cobranzaEliminarRutaGuardada = function(id) {
    if (!confirm('¿Eliminar esta ruta guardada?\n\nEsto solo borra la lista guardada — no afecta las cuentas ni sus saldos.')) return;
    const rutas = StorageService.get('rutasCobranzaGuardadas', []).filter(r => r.id !== id);
    StorageService.set('rutasCobranzaGuardadas', rutas);
    if (typeof renderRutasCobranzaGuardadas === 'function') renderRutasCobranzaGuardadas();
};

// ─── Pantalla: listado de rutas guardadas ───────────────────────────────
window.renderRutasCobranzaGuardadas = function() {
    const cont = document.getElementById('arc-v3-contenido') ||
                 document.getElementById('reportes') ||
                 document.getElementById('dashboardContenido');
    if (!cont) return;
    const rutas = StorageService.get('rutasCobranzaGuardadas', []);
    cont.innerHTML = `
        <div style="padding:20px;max-width:800px;margin:0 auto;">
            <button onclick="renderARC_v3()" style="margin-bottom:12px;padding:8px 16px;border-radius:8px;border:1px solid #cbd5e1;background:white;cursor:pointer;font-size:12px;">⬅️ Volver</button>
            <h2 style="margin:0 0 16px;">📂 Rutas de Cobranza Guardadas</h2>
            ${rutas.length === 0 ? '<p style="color:#64748b;">Aún no has guardado ninguna ruta. Se ofrece guardar cada vez que generas una desde "📋 Generar Cobranza".</p>' : rutas.map(r => `
                <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
                    <div>
                        <div style="font-weight:900;">${r.nombre}</div>
                        <div style="font-size:11px;color:#64748b;">Guardada el ${new Date(r.fechaGuardada).toLocaleDateString('es-MX')} · ${r.folios.length} venta(s)</div>
                    </div>
                    <div style="display:flex;gap:8px;">
                        <button onclick="_cobranzaReabrirRuta(${r.id})" style="padding:8px 14px;border-radius:8px;border:none;background:#f59e0b;color:#713f12;font-weight:bold;cursor:pointer;font-size:12px;">🔁 Volver a generar</button>
                        <button onclick="_cobranzaEliminarRutaGuardada(${r.id})" style="padding:8px 10px;border-radius:8px;border:1px solid #cbd5e1;background:white;cursor:pointer;font-size:12px;">🗑️</button>
                    </div>
                </div>
            `).join('')}
        </div>`;
};



// ================================================================
// 6. VENCIMIENTO DE PLAZO TOTAL — Bloques por plazo pactado (4/5/6 meses)
// Muestra únicamente cuentas cuyo PLAZO TOTAL de venta ya venció o está
// a ≤15 días de vencer, agrupadas por el plazo con el que se pactó la
// venta. Usa la fecha límite real del crédito (_cxcFechaFinalCredito en
// cxc.js:113), NO el SNE — aquí importa el plazo contratado completo,
// no el comportamiento de pago parcial.
// ================================================================
window.renderVencimientoPlazo = function() {
    const cont = document.getElementById('arc-v3-contenido') ||
                 document.getElementById('reportes') ||
                 document.getElementById('dashboardContenido');
    if (!cont) return;

    window._vpDiasLimite = (window._vpDiasLimite === undefined) ? 15 : window._vpDiasLimite;
    const DIAS_LIMITE = Number(window._vpDiasLimite) || 0; // umbral "en el límite" antes del vencimiento, configurable en UI

    const cxc = StorageService.get('cuentasPorCobrar', []);
    const pagaresSistema = StorageService.get('pagaresSistema', []);
    const hoy = new Date(); hoy.setHours(12, 0, 0, 0);

    const cuentasActivas = cxc.filter(c => !_rcCuentaCancelada(c) && !c.incobrable && (c.saldoActual || 0) > 0 && c.estado !== 'Saldado');

    // Fecha de vencimiento total = fecha del ÚLTIMO pagaré del contrato (fuente
    // real de lo pactado). Si la cuenta no tiene pagarés cargados (caso raro,
    // cuentas muy viejas), cae a _cxcFechaFinalCredito (venta + meses) como
    // respaldo — mismo criterio que usa el sistema para moratorios.
    const _vpFechaVencimientoTotal = (cuenta, pagaresCuenta, estadoCta) => {
        const fechas = pagaresCuenta.map(p => _rc.parseFecha(p.fechaVencimiento)).filter(Boolean);
        if (fechas.length) return { fecha: new Date(Math.max(...fechas.map(f => f.getTime()))), fuente: 'ultimoPagare' };
        const fb = typeof window._cxcFechaFinalCredito === 'function' ? window._cxcFechaFinalCredito(cuenta, estadoCta) : null;
        return fb && !isNaN(fb.getTime()) ? { fecha: fb, fuente: 'estimadoPorMeses' } : { fecha: null, fuente: null };
    };

    const evaluadas = cuentasActivas.map(c => {
        const estado = typeof window._calcularEstadoCuenta === 'function' ? window._calcularEstadoCuenta(c.folio) : null;
        const saldo = Number(estado?.saldoTotal ?? c.saldoActual ?? 0);
        const mesesPlan = Number(c?.plan?.meses || c?.plazoMeses || c?.meses || 0);
        const pagaresCuenta = pagaresSistema.filter(p => p.folio === c.folio);
        const { fecha: fechaFinal, fuente: fuenteFechaFinal } = _vpFechaVencimientoTotal(c, pagaresCuenta, estado);
        if (!fechaFinal) return null;

        const fechaCompra = _rc.parseFecha(c.fechaVenta || c.fecha || c.fechaIso);
        const sne = _rc.calcularSNE(c, pagaresCuenta, hoy);
        const pctCubierto = sne.totalVenta > 0 ? (sne.totalPagado / sne.totalVenta * 100) : 0;

        const diasVencidos = Math.floor((hoy - fechaFinal) / 86400000);
        const estatusPlazo = diasVencidos > 0 ? 'VENCIDO' : (diasVencidos >= -DIAS_LIMITE ? 'EN LIMITE' : 'VIGENTE');

        return { ...c, saldo, mesesPlan, fechaCompra, fechaFinal, fuenteFechaFinal, diasVencidos, estatusPlazo, sne, pctCubierto, numPagares: pagaresCuenta.length };
    }).filter(Boolean);

    // Solo nos interesan VENCIDO y EN LIMITE
    const relevantes = evaluadas.filter(c => c.estatusPlazo !== 'VIGENTE');
    window._vpFilas = relevantes; // para el modal de detalle

    if (!relevantes.length) {
        cont.innerHTML = `<div style="padding:50px;text-align:center;background:white;border-radius:16px;margin:20px 0;">
            <div style="font-size:48px;">✅</div>
            <h3 style="color:#16a34a;">Ninguna cuenta ha vencido ni está a ≤${DIAS_LIMITE} días de vencer su plazo total.</h3>
            <div style="margin-top:14px;">
                <label style="font-size:12px;color:#475569;font-weight:bold;">Umbral "en límite":
                    <select onchange="window._vpDiasLimite=parseInt(this.value);renderVencimientoPlazo();" style="margin-left:6px;padding:7px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;">
                        <option value="0" ${DIAS_LIMITE===0?'selected':''}>Solo ya vencidas (0d)</option>
                        <option value="7" ${DIAS_LIMITE===7?'selected':''}>7 días antes</option>
                        <option value="15" ${DIAS_LIMITE===15?'selected':''}>15 días antes</option>
                        <option value="30" ${DIAS_LIMITE===30?'selected':''}>30 días antes</option>
                    </select>
                </label>
            </div>
            <button onclick="renderARC_v3()" style="margin-top:14px;padding:10px 16px;background:#0f172a;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">⬅️ Volver a ARC v3</button>
        </div>`;
        return;
    }

    // ── Agrupar por bloques de plazo pactado ────────────────────────
    const bloqueDe = (m) => m === 4 ? '4 meses' : m === 5 ? '5 meses' : m === 6 ? '6 meses' : (m > 0 ? `${m} meses` : 'Sin plazo registrado');
    const ordenBloque = { '4 meses': 1, '5 meses': 2, '6 meses': 3 };

    const gruposMap = {};
    relevantes.forEach(c => {
        const key = bloqueDe(c.mesesPlan);
        (gruposMap[key] = gruposMap[key] || []).push(c);
    });
    const bloques = Object.keys(gruposMap).sort((a, b) => (ordenBloque[a] || 99) - (ordenBloque[b] || 99) || a.localeCompare(b));

    const totalVencido = relevantes.filter(c => c.estatusPlazo === 'VENCIDO').reduce((s, c) => s + c.saldo, 0);
    const totalLimite = relevantes.filter(c => c.estatusPlazo === 'EN LIMITE').reduce((s, c) => s + c.saldo, 0);

    let bloquesHTML = '';
    bloques.forEach(key => {
        const lista = gruposMap[key].sort((a, b) => b.diasVencidos - a.diasVencidos);
        const saldoBloque = lista.reduce((s, c) => s + c.saldo, 0);

        const filas = lista.map((c, idxLocal) => {
            const idxGlobal = window._vpFilas.indexOf(c);
            const vencido = c.estatusPlazo === 'VENCIDO';
            const badge = vencido
                ? _rc.badge(`🔴 VENCIDO +${c.diasVencidos}d`, '#fef2f2', '#dc2626')
                : _rc.badge(`🟠 EN LÍMITE ${Math.abs(c.diasVencidos)}d restantes`, '#fffbeb', '#d97706');
            const colorPct = c.pctCubierto >= 90 ? '#16a34a' : c.pctCubierto >= 60 ? '#d97706' : '#dc2626';
            return `
            <tr style="border-bottom:1px solid #f1f5f9;cursor:pointer;" onclick="abrirDetalleVencimientoPlazo(${idxGlobal})">
                <td style="padding:9px 12px;font-weight:bold;color:#0f172a;">${c.nombre || 'Sin nombre'}<div style="font-size:10px;color:#94a3b8;font-weight:normal;">${c.folio}</div></td>
                <td style="padding:9px 12px;text-align:right;font-weight:bold;color:#dc2626;">${_rc.fmt(c.saldo)}</td>
                <td style="padding:9px 12px;text-align:center;min-width:90px;">
                    <b style="color:${colorPct};">${_rc.pct(c.pctCubierto)}</b>
                    ${_rc.miniBar(c.pctCubierto, colorPct)}
                </td>
                <td style="padding:9px 12px;text-align:center;color:#475569;">${c.fechaFinal.toLocaleDateString('es-MX')}</td>
                <td style="padding:9px 12px;text-align:center;">${badge}</td>
                <td style="padding:9px 12px;text-align:center;" onclick="event.stopPropagation();">
                    <button onclick="abrirDetalleVencimientoPlazo(${idxGlobal})" style="padding:6px 10px;background:#7c3aed;color:white;border:none;border-radius:6px;font-size:11px;font-weight:bold;cursor:pointer;">🔍 Detalles</button>
                    <button onclick="abrirEstadoCuentaFolio('${c.folio}')" style="padding:6px 10px;background:#3b82f6;color:white;border:none;border-radius:6px;font-size:11px;font-weight:bold;cursor:pointer;">📋 Estado</button>
                    <button onclick="enviarRecordatorioWhatsApp('${c.folio}')" style="padding:6px 10px;background:#25D366;color:white;border:none;border-radius:6px;font-size:11px;font-weight:bold;cursor:pointer;">💬 WA</button>
                </td>
            </tr>`;
        }).join('');

        bloquesHTML += `
        <div style="margin-bottom:22px;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,0.05);">
            <div style="background:#0f172a;color:white;padding:12px 16px;font-weight:900;font-size:13px;display:flex;justify-content:space-between;">
                <span>📦 PLAZO: ${key}</span>
                <span>${lista.length} cuenta(s) · ${_rc.fmt(saldoBloque)}</span>
            </div>
            <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;min-width:700px;">
                    <thead style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
                        <tr>
                            <th style="padding:10px 12px;font-size:11px;color:#475569;text-align:left;">Cliente / Folio</th>
                            <th style="padding:10px 12px;font-size:11px;color:#475569;text-align:right;">Saldo</th>
                            <th style="padding:10px 12px;font-size:11px;color:#475569;text-align:center;">% Cubierto</th>
                            <th style="padding:10px 12px;font-size:11px;color:#475569;text-align:center;">Fecha límite plazo</th>
                            <th style="padding:10px 12px;font-size:11px;color:#475569;text-align:center;">Estatus</th>
                            <th style="padding:10px 12px;font-size:11px;color:#475569;text-align:center;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>${filas}</tbody>
                </table>
            </div>
        </div>`;
    });

    cont.innerHTML = `
    <div style="font-family:system-ui,sans-serif;max-width:1400px;margin:0 auto;padding:0 4px;">
        <div style="background:linear-gradient(135deg,#7f1d1d,#dc2626);color:white;padding:24px;border-radius:14px;margin-bottom:20px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:15px;">
                <div>
                    <h2 style="margin:0;font-size:22px;font-weight:900;">⏰ Vencimiento de Plazo Total</h2>
                    <p style="margin:6px 0 0;color:#fecaca;font-size:13px;">
                        Cuentas cuyo <b>plazo total pactado</b> (4, 5 o 6 meses desde la venta) ya se cumplió o está a ≤${DIAS_LIMITE} días de cumplirse.
                        No mide abonos parciales — mide si ya se acabó el tiempo contratado.
                    </p>
                </div>
                <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                    <label style="font-size:12px;color:#fecaca;font-weight:bold;">Umbral "en límite":
                        <select onchange="window._vpDiasLimite=parseInt(this.value);renderVencimientoPlazo();" style="margin-left:6px;padding:7px;border:1px solid rgba(255,255,255,0.4);border-radius:6px;font-size:12px;background:rgba(255,255,255,0.15);color:white;">
                            <option value="0" ${DIAS_LIMITE===0?'selected':''}>Solo ya vencidas (0d)</option>
                            <option value="7" ${DIAS_LIMITE===7?'selected':''}>7 días antes</option>
                            <option value="15" ${DIAS_LIMITE===15?'selected':''}>15 días antes</option>
                            <option value="30" ${DIAS_LIMITE===30?'selected':''}>30 días antes</option>
                        </select>
                    </label>
                    <button onclick="renderARC_v3()" style="padding:10px 16px;background:rgba(255,255,255,0.15);color:white;border:1px solid rgba(255,255,255,0.4);border-radius:8px;font-weight:bold;cursor:pointer;font-size:12px;">⬅️ Volver a ARC v3</button>
                </div>
            </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:20px;">
            <div style="background:white;padding:18px;border-radius:10px;border-left:5px solid #dc2626;box-shadow:0 2px 6px rgba(0,0,0,0.05);">
                <div style="font-size:11px;color:#64748b;font-weight:bold;text-transform:uppercase;">Plazo ya vencido</div>
                <div style="font-size:24px;font-weight:900;color:#dc2626;">${_rc.fmt(totalVencido)}</div>
                <div style="font-size:11px;color:#64748b;">${relevantes.filter(c => c.estatusPlazo === 'VENCIDO').length} cuenta(s)</div>
            </div>
            <div style="background:white;padding:18px;border-radius:10px;border-left:5px solid #f59e0b;box-shadow:0 2px 6px rgba(0,0,0,0.05);">
                <div style="font-size:11px;color:#64748b;font-weight:bold;text-transform:uppercase;">En límite (≤${DIAS_LIMITE}d)</div>
                <div style="font-size:24px;font-weight:900;color:#d97706;">${_rc.fmt(totalLimite)}</div>
                <div style="font-size:11px;color:#64748b;">${relevantes.filter(c => c.estatusPlazo === 'EN LIMITE').length} cuenta(s)</div>
            </div>
        </div>

        ${bloquesHTML}
    </div>`;
};

// ── Modal de detalle: toda la información sin saturar la tabla ──
window.abrirDetalleVencimientoPlazo = function(idx) {
    const c = (window._vpFilas || [])[idx];
    if (!c) return;
    const s = c.sne;

    const fmtFecha = (f) => f ? f.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Sin registrar';
    const vencido = c.estatusPlazo === 'VENCIDO';
    const colorPct = c.pctCubierto >= 90 ? '#16a34a' : c.pctCubierto >= 60 ? '#d97706' : '#dc2626';
    const notaFuente = c.fuenteFechaFinal === 'estimadoPorMeses'
        ? '⚠️ Esta cuenta no tiene pagarés cargados en el sistema — la fecha se estimó como venta + meses pactados.'
        : '✓ Calculada a partir del último pagaré registrado del contrato.';

    const observacion = window.CxcNotas ? window.CxcNotas.obtenerObservacion(c.folio) : '';
    const historial = window.CxcNotas ? window.CxcNotas.obtenerHistorial(c.folio) : [];
    const historialHTML = historial.length
        ? historial.slice(0, 5).map(h => `
            <div style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
                <div style="font-size:11px;color:#94a3b8;">${new Date(h.fecha).toLocaleDateString('es-MX')} · ${h.usuario || 'Sistema'}</div>
                <div style="font-size:12px;color:#0f172a;">${h.texto}</div>
            </div>`).join('')
        : `<div style="font-size:12px;color:#94a3b8;padding:6px 0;">Sin comentarios de cobranza registrados.</div>`;

    const articulos = Array.isArray(c.articulos) ? c.articulos : [];
    const articulosHTML = articulos.length
        ? articulos.map(a => {
            const precioBase = Number(a.precioContado || a.precio || 0);
            const cantidad = Number(a.cantidad || 1);
            return `
            <tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:6px 4px;font-size:12px;color:#0f172a;">${a.nombre || a.productoNombre || 'Producto'}</td>
                <td style="padding:6px 4px;font-size:12px;text-align:center;color:#475569;">x${cantidad}</td>
                <td style="padding:6px 4px;font-size:12px;text-align:right;font-weight:bold;color:#0f172a;">${_rc.fmt(precioBase)}</td>
            </tr>`;
        }).join('')
        : `<tr><td colspan="3" style="padding:8px 4px;font-size:12px;color:#94a3b8;">Sin artículos registrados en esta cuenta.</td></tr>`;

    const existente = document.getElementById('modalDetalleVencimientoPlazo');
    if (existente) existente.remove();

    const modal = document.createElement('div');
    modal.id = 'modalDetalleVencimientoPlazo';
    modal.style = 'position:fixed;inset:0;background:rgba(15,23,42,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
    <div style="background:white;border-radius:14px;max-width:560px;width:100%;max-height:90vh;overflow-y:auto;font-family:system-ui,sans-serif;">
        <div style="background:${vencido ? 'linear-gradient(135deg,#7f1d1d,#dc2626)' : 'linear-gradient(135deg,#78350f,#d97706)'};color:white;padding:18px 22px;border-radius:14px 14px 0 0;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <div>
                    <div style="font-size:16px;font-weight:900;">${c.nombre || 'Sin nombre'}${window.CxcNotas ? window.CxcNotas.badgeHtml(c.folio) : ''}</div>
                    <div style="font-size:12px;opacity:.85;">${c.folio}</div>
                </div>
                <button onclick="document.getElementById('modalDetalleVencimientoPlazo').remove()" style="background:rgba(255,255,255,0.2);border:none;color:white;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:15px;">✕</button>
            </div>
        </div>

        <div style="padding:20px 22px;">
            <div style="background:#f8fafc;padding:10px 12px;border-radius:8px;margin-bottom:16px;">
                <div style="font-size:10px;color:#64748b;font-weight:bold;margin-bottom:4px;">PRODUCTO(S) LLEVADO(S) — PRECIO BASE (CONTADO)</div>
                <table style="width:100%;border-collapse:collapse;">
                    <tbody>${articulosHTML}</tbody>
                </table>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
                <div style="background:#f8fafc;padding:10px;border-radius:8px;">
                    <div style="font-size:10px;color:#64748b;font-weight:bold;">FECHA DE COMPRA</div>
                    <div style="font-size:14px;font-weight:900;color:#0f172a;">${fmtFecha(c.fechaCompra)}</div>
                </div>
                <div style="background:#f8fafc;padding:10px;border-radius:8px;">
                    <div style="font-size:10px;color:#64748b;font-weight:bold;">PLAZO PACTADO</div>
                    <div style="font-size:14px;font-weight:900;color:#0f172a;">${c.mesesPlan > 0 ? c.mesesPlan + ' meses' : 'No registrado'}</div>
                </div>
                <div style="background:#f8fafc;padding:10px;border-radius:8px;grid-column:1 / -1;">
                    <div style="font-size:10px;color:#64748b;font-weight:bold;">FECHA VENCIMIENTO TOTAL (último pagaré)</div>
                    <div style="font-size:15px;font-weight:900;color:${vencido ? '#dc2626' : '#d97706'};">${fmtFecha(c.fechaFinal)}</div>
                    <div style="font-size:10px;color:#94a3b8;margin-top:3px;">${notaFuente}</div>
                </div>
            </div>

            <div style="background:${vencido ? '#fef2f2' : '#fffbeb'};padding:12px 14px;border-radius:8px;margin-bottom:16px;border-left:4px solid ${vencido ? '#dc2626' : '#d97706'};">
                <div style="font-size:13px;font-weight:900;color:${vencido ? '#991b1b' : '#92400e'};">
                    ${vencido ? `🔴 Plazo vencido hace ${c.diasVencidos} día(s)` : `🟠 A ${Math.abs(c.diasVencidos)} día(s) de vencer el plazo`}
                </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
                <div style="background:#f8fafc;padding:10px;border-radius:8px;">
                    <div style="font-size:10px;color:#64748b;font-weight:bold;">TOTAL DE LA VENTA</div>
                    <div style="font-size:15px;font-weight:900;color:#0f172a;">${_rc.fmt(s.totalVenta)}</div>
                </div>
                <div style="background:#f8fafc;padding:10px;border-radius:8px;">
                    <div style="font-size:10px;color:#64748b;font-weight:bold;">SALDO ACTUAL</div>
                    <div style="font-size:15px;font-weight:900;color:#dc2626;">${_rc.fmt(c.saldo)}</div>
                </div>
            </div>

            <div style="background:#f1f5f9;padding:12px 14px;border-radius:8px;margin-bottom:16px;">
                <div style="font-size:10px;color:#475569;font-weight:bold;margin-bottom:6px;">% CUBIERTO DE LA DEUDA</div>
                <div style="font-size:20px;font-weight:900;color:${colorPct};margin-bottom:6px;">${_rc.pct(c.pctCubierto)}</div>
                ${_rc.miniBar(c.pctCubierto, colorPct)}
                <div style="font-size:11px;color:#64748b;margin-top:5px;">Pagado: <b>${_rc.fmt(s.totalPagado)}</b> de ${_rc.fmt(s.totalVenta)} (${s.numAbonos} abono(s))</div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px;font-size:12px;">
                <div><span style="color:#64748b;">Nivel de riesgo (SNE):</span><br><b style="color:${s.colorRiesgo};">${s.emojiRiesgo} ${s.nivelRiesgo}</b></div>
                <div><span style="color:#64748b;">Último abono:</span><br><b>${s.diasSinPagar === 9999 ? 'Sin abonos registrados' : `hace ${s.diasSinPagar} día(s)`}</b></div>
                <div><span style="color:#64748b;">Pagarés en el contrato:</span><br><b>${c.numPagares}</b></div>
                <div><span style="color:#64748b;">Pagarés sin aplicar:</span><br><b>${s.pagaresVencidos.length}</b></div>
            </div>

            <div style="background:#fefce8;padding:12px 14px;border-radius:8px;margin-bottom:18px;border-left:4px solid #eab308;">
                <div style="font-size:10px;color:#713f12;font-weight:bold;margin-bottom:6px;">🗒️ OBSERVACIONES DE COBRANZA</div>
                ${observacion ? `<div style="font-size:12px;color:#0f172a;margin-bottom:8px;font-style:italic;">"${observacion}"</div>` : `<div style="font-size:12px;color:#94a3b8;margin-bottom:8px;">Sin observación general registrada.</div>`}
                <div style="font-size:10px;color:#92400e;font-weight:bold;margin-top:8px;margin-bottom:2px;">HISTORIAL RECIENTE</div>
                ${historialHTML}
            </div>

            <div style="display:flex;gap:8px;">
                <button onclick="abrirEstadoCuentaFolio('${c.folio}')" style="flex:1;padding:10px;background:#3b82f6;color:white;border:none;border-radius:8px;font-size:12px;font-weight:bold;cursor:pointer;">📋 Estado de Cuenta</button>
                <button onclick="CxcNotas.abrirModal('${c.folio}', '${String(c.nombre || '').replace(/'/g, "\\'")}')" style="flex:1;padding:10px;background:#eab308;color:#422006;border:none;border-radius:8px;font-size:12px;font-weight:bold;cursor:pointer;">🗒️ Notas</button>
            </div>
        </div>
    </div>`;
    document.body.appendChild(modal);
};

// ── Exponer al scope global ────────────────────────────────────
window.renderARCTablaExcel = window.renderARCTablaExcel;
window.renderConcentracion = window.renderConcentracion;
window.renderCobranzaMensual = window.renderCobranzaMensual;
window.renderComportamiento = window.renderComportamiento;
window.renderARC_v3 = window.renderARC_v3;
window.renderVencimientoPlazo = window.renderVencimientoPlazo;
window.abrirDetalleVencimientoPlazo = window.abrirDetalleVencimientoPlazo;

console.log('✅ Módulo reportes-credito.js cargado — ARC v3, Matriz Excel, Comportamiento, Cobranza Mensual, Concentración, Vencimiento de Plazo.');
