// ================================================================
// 📊 MÓDULO DE REPORTES AVANZADOS PARA CARTERA DE CRÉDITO
// Versión: 2.0 — Lógica de Saldo Neto Esperado (SNE)
//
// Reportes incluidos:
//  1. renderARC_SNE()        → ARC mejorado con lógica SNE
//  2. renderComportamiento() → Scorecard de comportamiento de pago
//  3. renderCobranzaMensual()→ Capital colocado vs. recuperado
//  4. renderConcentracion()  → Mapa de concentración de cartera
// ================================================================

// ─── Helpers compartidos ────────────────────────────────────────
const _rc = {
    fmt: v => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(v) || 0),
    pct: v => Number(v).toFixed(1) + '%',

    parseFecha(val) {
        if (!val) return null;
        if (typeof val === 'number') return new Date(val);
        const s = String(val).trim();
        if (s.includes('/')) {
            const [d, m, y] = s.split('/');
            return new Date(parseInt(y), parseInt(m) - 1, parseInt(d), 12);
        }
        const base = s.length > 10 ? s.split('T')[0] : s;
        const [y, m, d] = base.split('-');
        return new Date(parseInt(y), parseInt(m) - 1, parseInt(d), 12);
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
        const [y, m] = key.split('-');
        return new Intl.DateTimeFormat('es-MX', { month: 'short', year: 'numeric' })
            .format(new Date(+y, +m - 1, 1)).toUpperCase();
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
        const abonos = cuenta.abonos || [];
        const totalPagado = abonos.reduce((s, a) => s + parseFloat(a.monto || 0), 0);

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
        if (cuenta.esIncobrable) {
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

        return {
            excedente, deficitPct, montoEsperado, totalPagado,
            pagaresVencidos, pagaresProximos, totalPlazo,
            fechaUltimoVenc, ultimaFechaAbono, diasSinPagar,
            promedioAbono90, numAbonos: abonos.length,
            nivelRiesgo, colorRiesgo, emojiRiesgo,
            saldoActual: cuenta.saldoActual || 0,
            totalVenta: cuenta.totalContadoOriginal || cuenta.totalMercancia || totalPlazo
        };
    }
};

// ================================================================
// 1. ARC v3 — ANÁLISIS DE RIESGO CON LÓGICA SNE
//    Diferencia clave: clasifica según "¿ha pagado lo esperado
//    hasta hoy?" y no solo por conteo de pagarés vencidos.
// ================================================================
window.renderARC_v3 = function() {
    const cont = document.getElementById('reportes') ||
                 document.getElementById('reportes-contenido') ||
                 document.getElementById('dashboardContenido');
    if (!cont) return;

    const cxc = StorageService.get('cuentasPorCobrar', []);
    const pagaresSistema = StorageService.get('pagaresSistema', []);
    const hoy = new Date(); hoy.setHours(12, 0, 0, 0);

    const cuentasActivas = cxc.filter(c => (c.saldoActual || 0) > 0 && c.estado !== 'Saldado');
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

    // ── Agrupar por nivel ──────────────────────────────────────────
    const grupos = {
        'INCOBRABLE': cuentasSNE.filter(c => c.sne.nivelRiesgo === 'INCOBRABLE'),
        'CRÍTICO':    cuentasSNE.filter(c => c.sne.nivelRiesgo === 'CRÍTICO'),
        'EN MORA':    cuentasSNE.filter(c => c.sne.nivelRiesgo === 'EN MORA'),
        'MODERADO':   cuentasSNE.filter(c => c.sne.nivelRiesgo === 'MODERADO'),
        'LEVE':       cuentasSNE.filter(c => c.sne.nivelRiesgo === 'LEVE'),
        'AL CORRIENTE': cuentasSNE.filter(c => c.sne.nivelRiesgo === 'AL CORRIENTE'),
    };

    const cfgGrupos = [
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
                    <div>
                        <div style="font-weight:900;color:#0f172a;font-size:14px;">${c.nombre || 'Sin nombre'}</div>
                        <div style="font-size:11px;color:#64748b;">${c.folio}</div>
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
                    <button onclick="renderComportamiento()" style="padding:10px 16px;background:#7c3aed;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-size:12px;">🧬 Comportamiento de Pago</button>
                    <button onclick="renderCobranzaMensual()" style="padding:10px 16px;background:#0369a1;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-size:12px;">📅 Cobranza Mensual</button>
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
// 2. SCORECARD DE COMPORTAMIENTO DE PAGO
//    Tabla exhaustiva que muestra el patrón de pago de cada
//    cliente: frecuencia, montos, tendencia y scoring final.
// ================================================================
window.renderComportamiento = function() {
    const cont = document.getElementById('reportes') ||
                 document.getElementById('reportes-contenido') ||
                 document.getElementById('dashboardContenido');
    if (!cont) return;

    const cxc = StorageService.get('cuentasPorCobrar', []);
    const pagaresSistema = StorageService.get('pagaresSistema', []);
    const hoy = new Date(); hoy.setHours(12, 0, 0, 0);

    const ordenar = window._cbOrden || 'excedente';
    const filtro  = window._cbFiltro || 'todos';

    const cuentasSNE = cxc
        .filter(c => c.estado !== 'Saldado')
        .map(c => {
            const pagaresCuenta = pagaresSistema.filter(p => p.folio === c.folio);
            const sne = _rc.calcularSNE(c, pagaresCuenta, hoy);

            // Calcular tendencia de abono (promedio últimos 60d vs. 60d anteriores)
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

            // Frecuencia media entre abonos
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

    // Filtrar
    let lista = cuentasSNE;
    if (filtro === 'alCorriente') lista = lista.filter(c => c.sne.excedente >= 0);
    if (filtro === 'enMora')      lista = lista.filter(c => c.sne.nivelRiesgo === 'EN MORA' || c.sne.nivelRiesgo === 'CRÍTICO');
    if (filtro === 'sinAbono60')  lista = lista.filter(c => c.sne.diasSinPagar > 60);
    if (filtro === 'subiendo')    lista = lista.filter(c => c.tendencia === 'subiendo');

    // Ordenar
    if (ordenar === 'excedente') lista.sort((a, b) => a.sne.excedente - b.sne.excedente);
    if (ordenar === 'saldo')     lista.sort((a, b) => b.sne.saldoActual - a.sne.saldoActual);
    if (ordenar === 'diasSin')   lista.sort((a, b) => b.sne.diasSinPagar - a.sne.diasSinPagar);
    if (ordenar === 'nombre')    lista.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

    const filas = lista.map(c => {
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
            <td style="padding:10px 12px;min-width:160px;">
                <b style="font-size:13px;">${c.nombre || '—'}</b><br>
                <small style="color:#64748b;">${c.folio}</small>
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
                <button onclick="abrirModalAbonoAvanzado('${c.folio}')" style="padding:5px 9px;background:#16a34a;color:white;border:none;border-radius:5px;cursor:pointer;font-size:11px;font-weight:bold;" title="Abonar">💰</button>
                <button onclick="enviarRecordatorioWhatsApp('${c.folio}')" style="padding:5px 9px;background:#25D366;color:white;border:none;border-radius:5px;cursor:pointer;font-size:11px;margin-left:3px;" title="WhatsApp">💬</button>
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
                <button onclick="renderARC_v3()" style="padding:10px 16px;background:rgba(255,255,255,0.15);color:white;border:1px solid rgba(255,255,255,0.3);border-radius:8px;font-weight:bold;cursor:pointer;font-size:12px;">⬅️ Volver a ARC v3</button>
            </div>
        </div>

        <!-- Filtros + Orden -->
        <div style="background:white;padding:14px;border-radius:10px;margin-bottom:16px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;box-shadow:0 2px 6px rgba(0,0,0,0.05);">
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
                <select onchange="window._cbOrden=this.value;renderComportamiento();" style="margin-left:8px;padding:7px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;">
                    <option value="excedente" ${ordenar==='excedente'?'selected':''}>SNE (menor a mayor)</option>
                    <option value="saldo" ${ordenar==='saldo'?'selected':''}>Saldo (mayor a menor)</option>
                    <option value="diasSin" ${ordenar==='diasSin'?'selected':''}>Días sin pagar</option>
                    <option value="nombre" ${ordenar==='nombre'?'selected':''}>Nombre A-Z</option>
                </select>
            </div>
            <div style="margin-left:auto;font-size:12px;color:#64748b;">${lista.length} clientes mostrados</div>
        </div>

        <!-- Tabla -->
        <div style="background:white;border-radius:10px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,0.05);">
            <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;min-width:1200px;">
                    <thead style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
                        <tr>
                            <th style="padding:11px 12px;font-size:11px;color:#475569;text-align:left;">Cliente</th>
                            <th style="padding:11px 12px;font-size:11px;color:#475569;text-align:right;">Saldo</th>
                            <th style="padding:11px 12px;font-size:11px;color:#475569;text-align:right;">Total Pagado</th>
                            <th style="padding:11px 12px;font-size:11px;color:#475569;text-align:right;">Esperado Hoy</th>
                            <th style="padding:11px 12px;font-size:11px;color:#475569;text-align:right;">SNE ↕</th>
                            <th style="padding:11px 12px;font-size:11px;color:#475569;">% Cubierto</th>
                            <th style="padding:11px 12px;font-size:11px;color:#475569;">Riesgo Real</th>
                            <th style="padding:11px 12px;font-size:11px;color:#475569;">Último Abono</th>
                            <th style="padding:11px 12px;font-size:11px;color:#475569;">Frecuencia</th>
                            <th style="padding:11px 12px;font-size:11px;color:#475569;text-align:right;">Prom. 90d</th>
                            <th style="padding:11px 12px;font-size:11px;color:#475569;text-align:center;">Tend.</th>
                            <th style="padding:11px 12px;font-size:11px;color:#475569;">Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filas || '<tr><td colspan="12" style="padding:30px;text-align:center;color:#94a3b8;">Sin resultados para este filtro.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Nota explicativa -->
        <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:14px;border-radius:8px;margin-top:18px;font-size:12px;color:#1e40af;line-height:1.6;">
            <b>📌 ¿Cómo leer el SNE (Saldo Neto Esperado)?</b><br>
            Compara el <b>total acumulado pagado</b> contra la <b>suma de pagarés cuya fecha ya venció</b> (lo que "debía" haber pagado hasta hoy).
            Si el valor es <b style="color:#16a34a;">positivo → el cliente está adelantado</b>, aunque el sistema muestre pagarés individuales sin cerrar.
            Si es <b style="color:#dc2626;">negativo → hay déficit real</b> proporcional al plan contratado.
        </div>
    </div>`;
};

// ================================================================
// 3. REPORTE DE COBRANZA MENSUAL
//    Capital nuevo colocado en crédito vs. efectivo recuperado
//    por mes. La métrica más importante para un negocio 95% crédito.
// ================================================================
window.renderCobranzaMensual = function() {
    const cont = document.getElementById('reportes') ||
                 document.getElementById('reportes-contenido') ||
                 document.getElementById('dashboardContenido');
    if (!cont) return;

    const ventas  = StorageService.get('ventasRegistradas', []);
    const cxc     = StorageService.get('cuentasPorCobrar', []);

    // ── Recolectar todos los abonos de todas las cuentas ──────────
    const todosAbonos = [];
    cxc.forEach(c => {
        (c.abonos || []).forEach(a => {
            const f = _rc.parseFecha(a.fecha || a.fechaAbono);
            if (f) todosAbonos.push({ monto: parseFloat(a.monto || 0), fecha: f, folio: c.folio });
        });
    });

    // ── Identificar meses con actividad ───────────────────────────
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

    // ── Calcular por mes ──────────────────────────────────────────
    const datos = meses.map(mes => {
        // Capital nuevo colocado en crédito
        const capitalNuevo = ventas
            .filter(v => _rc.mesKey(v.fechaVenta || v.fechaIso) === mes && v.metodoPago !== 'contado')
            .reduce((s, v) => s + parseFloat(v.total || v.totalVenta || 0), 0);

        // Enganches cobrados ese mes (primer abono o dato de enganche en la venta)
        const enganches = ventas
            .filter(v => _rc.mesKey(v.fechaVenta || v.fechaIso) === mes && v.metodoPago !== 'contado')
            .reduce((s, v) => s + parseFloat(v.enganche || 0), 0);

        // Cobranza real (abonos aplicados ese mes)
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

    // ── Gráfica de barras (SVG inline) ────────────────────────────
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

    // ── Filas de tabla ────────────────────────────────────────────
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
                <button onclick="renderARC_v3()" style="padding:10px 16px;background:rgba(255,255,255,0.15);color:white;border:1px solid rgba(255,255,255,0.3);border-radius:8px;font-weight:bold;cursor:pointer;font-size:12px;">⬅️ Volver a ARC v3</button>
            </div>
        </div>

        <!-- KPIs globales -->
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

        <!-- Gráfica -->
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

        <!-- Tabla detalle -->
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
// 4. REPORTE DE CONCENTRACIÓN DE CARTERA
//    ¿Cuánto del riesgo está en pocos clientes?
//    Identifica dependencias críticas y calcula el índice HHI.
// ================================================================
window.renderConcentracion = function() {
    const cont = document.getElementById('reportes') ||
                 document.getElementById('reportes-contenido') ||
                 document.getElementById('dashboardContenido');
    if (!cont) return;

    const cxc = StorageService.get('cuentasPorCobrar', []);
    const pagaresSistema = StorageService.get('pagaresSistema', []);
    const hoy = new Date(); hoy.setHours(12, 0, 0, 0);

    const activas = cxc.filter(c => (c.saldoActual || 0) > 0 && c.estado !== 'Saldado')
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

    // Índice Herfindahl-Hirschman (HHI) — mide concentración
    const hhi = activas.reduce((s, c) => {
        const share = c.saldoActual / totalCartera * 100;
        return s + share * share;
    }, 0);
    const hhiLabel = hhi > 2500 ? '🔴 Alta Concentración' : hhi > 1500 ? '🟠 Concentración Media' : '🟢 Diversificada';
    const hhiColor = hhi > 2500 ? '#dc2626' : hhi > 1500 ? '#d97706' : '#16a34a';

    // Pareto visual (acumulado)
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
                <button onclick="renderARC_v3()" style="padding:10px 16px;background:rgba(255,255,255,0.15);color:white;border:1px solid rgba(255,255,255,0.3);border-radius:8px;font-weight:bold;cursor:pointer;font-size:12px;">⬅️ Volver a ARC v3</button>
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

        <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:14px;border-radius:8px;margin-top:16px;font-size:12px;color:#14532d;line-height:1.6;">
            <b>📌 ¿Qué es el índice HHI?</b> Un HHI &lt; 1500 indica cartera <b>bien diversificada</b>. Entre 1500 y 2500 es <b>concentración media</b>. Sobre 2500 es <b>alta concentración</b> — si tus top 3 clientes no pagan, tu flujo de efectivo lo resiente de inmediato.
        </div>
    </div>`;
};

// ── Exponer al scope global ────────────────────────────────────
window.renderConcentracion = window.renderConcentracion;
window.renderCobranzaMensual = window.renderCobranzaMensual;
window.renderComportamiento = window.renderComportamiento;
window.renderARC_v3 = window.renderARC_v3;

console.log('✅ Módulo reportes-credito.js cargado — ARC v3, Comportamiento, Cobranza Mensual, Concentración.');
