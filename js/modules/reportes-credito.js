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
            totalVenta: cuenta.totalContadoOriginal || cuenta.totalMercancia || totalPlazo
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
                            <div style="font-weight:900;color:#0f172a;font-size:14px;">${c.nombre || 'Sin nombre'}</div>
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
                    <button onclick="abrirModalAbonoAvanzado('${c.folio}')" style="flex:1;padding:7px;background:#16a34a;color:white;border:none;border-radius:6px;font-size:11px;font-weight:bold;cursor:pointer;">💰 Abonar</button>
                    <button onclick="abrirEstadoCuentaFolio('${c.folio}')" style="flex:1;padding:7px;background:#3b82f6;color:white;border:none;border-radius:6px;font-size:11px;font-weight:bold;cursor:pointer;">📋 Estado</button>
                    <button onclick="enviarRecordatorioWhatsApp('${c.folio}')" style="flex:1;padding:7px;background:#25D366;color:white;border:none;border-radius:6px;font-size:11px;font-weight:bold;cursor:pointer;">💬 WA</button>
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
                    <button onclick="renderARCTablaExcel()" style="padding:10px 16px;background:#059669;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-size:12px;">📊 Vista Matriz Excel</button>
                    <button onclick="renderComportamiento()" style="padding:10px 16px;background:#7c3aed;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-size:12px;">🧬 Comportamiento de Pago</button>
                    <button onclick="renderCobranzaMensual()" style="padding:10px 16px;background:#0369a1;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-size:12px;">📅 Cobranza Mensual</button>
                    <button onclick="renderConcentracion()" style="padding:10px 16px;background:#0f766e;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-size:12px;">🎯 Concentración</button>
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
    window._arcExSort = window._arcExSort || 'riesgo';
    window._arcExSortDir = window._arcExSortDir || 'desc';
    window._arcExDateSort = window._arcExDateSort || 'asc';
    window._arcExGroup = window._arcExGroup || 'semana'; 
    window._arcExClienteFilter = window._arcExClienteFilter || '';
    window._arcExAgruparCliente = window._arcExAgruparCliente === true;

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
            const totalMercanciaGrupo = g.cuentas.reduce((s, c) => s + Number(c.totalMercancia || c.totalContadoOriginal || c.total || 0), 0);

            return {
                ...masReciente,
                nombre: g.nombre,
                folio: g.cuentas.length > 1 ? `${g.cuentas.length} cuentas` : g.cuentas[0].folio,
                folios: g.cuentas.map(c => c.folio),
                abonos: abonosCombinados,
                articulos: articulosCombinados,
                totalMercancia: totalMercanciaGrupo,
                sne: {
                    ...peor.sne,
                    saldoActual: g.cuentas.reduce((s, c) => s + Number(c.sne.saldoActual || 0), 0),
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
            valA = Number(a.totalMercancia || a.totalContadoOriginal || a.total || 0);
            valB = Number(b.totalMercancia || b.totalContadoOriginal || b.total || 0);
            return sortDir * (valA - valB);
        }
        if (window._arcExSort === 'cubierto') {
            const impA = Number(a.totalMercancia || a.totalContadoOriginal || a.total || 0);
            const impB = Number(b.totalMercancia || b.totalContadoOriginal || b.total || 0);
            valA = impA > 0 ? ((impA - a.sne.saldoActual) / impA) : 0;
            valB = impB > 0 ? ((impB - b.sne.saldoActual) / impB) : 0;
            return sortDir * (valA - valB);
        }
        if (window._arcExSort === 'pendiente') {
            const impA = Number(a.totalMercancia || a.totalContadoOriginal || a.total || 0);
            const impB = Number(b.totalMercancia || b.totalContadoOriginal || b.total || 0);
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

        const importeReal = Number(c.totalMercancia || c.totalContadoOriginal || c.total || 0);
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
                </div>
            </td>
            <td class="ex-stky ex-col-2" style="background:${bgStatus}; color:${colorText}; font-weight:bold; border-right:1px solid rgba(0,0,0,0.1);">${fechaVentaStr}</td>
            <td class="ex-stky ex-col-3" style="background:${bgStatus}; color:${colorText}; border-right:1px solid rgba(0,0,0,0.1);" title="${descTooltip}">${desc}</td>
            <td class="ex-stky ex-col-4" style="background:${bgStatus}; color:${colorText}; border-right:1px solid rgba(0,0,0,0.1);" title="${c.nombre}">${nombreCliente}</td>
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
                        ${thSort('importe', 'Importe', 'ex-col-6')}
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
                <button onclick="abrirModalAbonoAvanzado('${String(c.folio || '').replace(/'/g, "\\'")}')" style="padding:6px 9px;background:#16a34a;color:white;border:0;border-radius:5px;font-weight:bold;cursor:pointer;">Abonar</button>
                <button onclick="enviarRecordatorioWhatsApp('${String(c.folio || '').replace(/'/g, "\\'")}')" style="padding:6px 9px;background:#25D366;color:white;border:0;border-radius:5px;font-weight:bold;cursor:pointer;margin-left:4px;">WhatsApp</button>
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
                    <b style="font-size:13px;">${c.nombre || '—'}</b><br>
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
                    : `<button onclick="abrirModalAbonoAvanzado('${c.folio}')" style="padding:5px 9px;background:#16a34a;color:white;border:none;border-radius:5px;cursor:pointer;font-size:11px;font-weight:bold;" title="Abonar">💰</button>
                       <button onclick="enviarRecordatorioWhatsApp('${c.folio}')" style="padding:5px 9px;background:#25D366;color:white;border:none;border-radius:5px;cursor:pointer;font-size:11px;margin-left:3px;" title="WhatsApp">💬</button>`}
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
                <b>${c.nombre || '—'}</b><br><small style="color:#64748b;">${c.folio}</small>
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

window.generarListadoCobranza = function() {
    // 1. Obtener los índices seleccionados en pantalla
    const checkboxes = document.querySelectorAll('.chk-cobrador:checked');
    if (checkboxes.length === 0) {
        return alert("⚠️ Selecciona al menos un cliente marcando su casilla para generar el listado.");
    }
    
    // 2. Extraer las filas exactas (agrupadas o individuales) desde la memoria de la vista actual
    const cuentasCobrador = Array.from(checkboxes).map(chk => window._filasParaCobranza[parseInt(chk.value)]);
    const hoy = new Date();

    const formatearFecha = (fecha) => {
        if (!fecha) return 'S/F';
        const d = typeof fecha === 'string' || typeof fecha === 'number' ? new Date(fecha) : fecha;
        return isNaN(d.getTime()) ? 'S/F' : d.toLocaleDateString('es-MX');
    };

    // 3. Construir la vista de impresión respetando agrupaciones
    let htmlFilas = cuentasCobrador.map((c, i) => {
        const s = c.sne || {};

        // Identificar si la fila actual es un grupo de cuentas o una sola
        const esAgrupado = c.agrupado || c.agrupadoPorCliente;
        const folioVisible = esAgrupado && c.folios ? `Múltiples (${c.folios.join(', ')})` : (c.folio || '-');
        
        // Sumarizar artículos
        let articulosText = '';
        if (c.articulos && c.articulos.length > 0) {
            articulosText = c.articulos.map(a => `${a.cantidad || 1}x ${a.nombre || a.productoNombre || '-'}`).join(', ');
        } else {
            articulosText = 'Sin detalle de artículos';
        }

        const diasAtraso = s.diasSinPagar === 9999 ? 'Sin abonos' : `${s.diasSinPagar} días`;
        const riesgo = s.nivelRiesgo || c.estado || 'N/D';
        
        // Fechas
        const fechaVentaStr = formatearFecha(c.fechaVenta || c.fechaIso || c.fecha);
        const fechaUltAbonoStr = s.ultimaFechaAbono ? formatearFecha(s.ultimaFechaAbono) : 'Sin abonos';

        return `
            <tr style="border-bottom: 2px solid #cbd5e1;">
                <td style="padding: 10px; font-weight: bold; font-size: 14px;">${i + 1}</td>
                <td style="padding: 10px;">
                    <div style="font-weight: 900; font-size: 14px;">${c.nombre || c.clienteNombre || 'Sin nombre'}</div>
                    <div style="font-size: 11px; color: #475569;">📞 Tel: ${c.telefono || 'N/D'}</div>
                    <div style="font-size: 11px; color: #475569;">📍 Dir: ${c.direccion || 'N/D'}</div>
                    <div style="font-size: 11px; color: #475569; margin-top: 4px;">🛒 ${articulosText}</div>
                </td>
                <td style="padding: 10px; font-size: 12px;">
                    <div>Folio: <b>${folioVisible}</b></div>
                    <div>F. Venta: <b>${fechaVentaStr}</b></div>
                    <div style="margin-top: 4px;">Saldo: <b style="color: #dc2626; font-size: 14px;">$${(s.saldoActual || c.saldoActual || 0).toLocaleString('en-US')}</b></div>
                    <div>Abonado: <b style="color: #16a34a;">$${(s.totalPagado || 0).toLocaleString('en-US')}</b></div>
                </td>
                <td style="padding: 10px; font-size: 12px;">
                    <div>Riesgo: <b>${riesgo}</b></div>
                    <div style="margin-top: 4px;">Últ. Abono: <b>${fechaUltAbonoStr}</b></div>
                    <div>Días sin pago: <b>${diasAtraso}</b></div>
                </td>
                <td style="padding: 10px; width: 150px;">
                    <div style="border-bottom: 1px solid #94a3b8; height: 25px; margin-bottom: 10px;"></div>
                    <div style="border-bottom: 1px solid #94a3b8; height: 25px;"></div>
                    <div style="font-size: 9px; text-align: center; color: #64748b; margin-top: 4px;">Firma / Notas</div>
                </td>
            </tr>
        `;
    }).join('');

    const baseUrl = window.location.href.split('?')[0].split('#')[0];

    const ventana = window.open('', '_blank');
    ventana.document.write(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>Ruta de Cobranza</title>
            <base href="${baseUrl}">
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; color: #0f172a; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 10px; }
                .logo-container { display: flex; align-items: center; gap: 15px; }
                @media print { button { display: none !important; } body { padding: 0; } }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="logo-container">
                    <img src="img/Logo.svg" style="width: 60px; height: 60px; object-fit: contain;" onerror="this.outerHTML='<span style=\\'font-size:32px;\\'>🏛️</span>'">
                    <div>
                        <h2 style="margin: 0; color: #0f172a;">Ruta de Cobranza en Campo</h2>
                        <div style="font-size: 14px; color: #64748b; font-weight: bold;">Mueblería Mi Pueblito</div>
                    </div>
                </div>
                <button onclick="window.print()" style="padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">🖨️ Imprimir Ruta</button>
            </div>
            
            <p style="margin-top: 0; font-size: 14px;">Fecha de emisión: <b>${hoy.toLocaleDateString('es-MX')}</b> | Clientes asignados: <b>${cuentasCobrador.length}</b></p>
            
            <table>
                <thead>
                    <tr style="background: #f8fafc; text-align: left; border-bottom: 2px solid #cbd5e1;">
                        <th style="padding: 10px;">#</th>
                        <th style="padding: 10px;">Datos del Cliente</th>
                        <th style="padding: 10px;">Estado de Cuenta</th>
                        <th style="padding: 10px;">Métricas de Riesgo</th>
                        <th style="padding: 10px;">Gestión</th>
                    </tr>
                </thead>
                <tbody>${htmlFilas}</tbody>
            </table>
        </body>
        </html>
    `);
    ventana.document.close();
};

// ── Exponer al scope global ────────────────────────────────────
window.renderARCTablaExcel = window.renderARCTablaExcel;
window.renderConcentracion = window.renderConcentracion;
window.renderCobranzaMensual = window.renderCobranzaMensual;
window.renderComportamiento = window.renderComportamiento;
window.renderARC_v3 = window.renderARC_v3;

console.log('✅ Módulo reportes-credito.js cargado — ARC v3, Matriz Excel, Comportamiento, Cobranza Mensual, Concentración.');
