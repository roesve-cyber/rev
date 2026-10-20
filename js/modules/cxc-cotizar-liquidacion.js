// =====================================================================
// 🧮 COTIZAR LIQUIDACIÓN ANTICIPADA
// ---------------------------------------------------------------------
// Responde en el mostrador "¿cuánto me queda si liquido en N meses?".
// Se elige al cliente, luego su cuenta (si tiene varias) y un plazo.
//
// Dos regímenes, según la fecha de la VENTA (no la de hoy) contra la
// "fecha de inicio de cupones" (se configura una vez):
//
//  · Venta ANTERIOR a cupones → rige la escalera mes-a-mes con las
//    tarifas que tenía la tienda en ESA venta: la tabla `saldosPorMes`
//    congelada en la cuenta (NUNCA las tasas de hoy). Importe restante =
//    total del plazo elegido − lo ya cubierto. Sin cupón.
//  · Venta POSTERIOR a cupones → rige la regla vigente (la misma función
//    que usa Cobranza al cobrar): paga el saldo nominal completo y recibe
//    un cupón. Liquidar antes NO descuenta; por eso el plazo es el pactado.
//
// Solo lectura: no registra ni modifica cuentas. Lo único que guarda es
// la fecha de inicio de cupones (requiere admin).
// =====================================================================
(function () {
    'use strict';

    const CFG_KEY = 'configCupones';
    const DIAS_MES = 30.44;

    // ── Utilidades ────────────────────────────────────────────────────
    const g = (nombre) => (typeof window[nombre] === 'function' ? window[nombre] : null);
    const leer = (t, d) => { try { const v = StorageService.get(t, d); return v === undefined || v === null ? d : v; } catch (e) { return d; } };
    const esc = (s) => String(s === undefined || s === null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const dinero = (n) => {
        const f = g('_cxcDinero');
        if (f) return f(n);
        return Number(n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
    };
    const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
    const noCancelada = (a) => !a.cancelado && !a.canceladoPorVenta && !a.canceladoPorApartado;

    function fechaVenta(cuenta) {
        const f = g('_cxcFechaVentaDate');
        if (f) { const d = f(cuenta); if (d && !isNaN(d.getTime())) return d; }
        const d = new Date(cuenta.fechaVenta || cuenta.fecha || 0);
        return isNaN(d.getTime()) ? new Date(0) : d;
    }
    function parseFecha(v) {
        if (!v) return null;
        const f = g('parseFechaMXOrNull') || g('parseFechaMX');
        let d = f ? f(v) : null;
        if (!d || isNaN(d.getTime())) d = new Date(v);
        return isNaN(d.getTime()) ? null : d;
    }
    const fmtFecha = (d) => (d && !isNaN(d.getTime())) ? d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
    const isoDia = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    // ── Fecha de inicio de cupones ────────────────────────────────────
    function fechaInicioCupones() {
        const cfg = leer(CFG_KEY, {});
        const f = cfg && cfg.fechaInicio ? new Date(cfg.fechaInicio + 'T00:00:00') : null;
        return f && !isNaN(f.getTime()) ? f : null;
    }
    // Sugerencia: primer abono que ya trae la marca `cuponEmitidoId` (se agregó con los cupones).
    function sugerirFechaInicio() {
        let min = null;
        leer('cuentasPorCobrar', []).forEach((c) => (c.abonos || []).forEach((a) => {
            if (!('cuponEmitidoId' in a)) return;
            const d = parseFecha(a.fecha);
            if (d && (!min || d < min)) min = d;
        }));
        return min;
    }

    // ── Escalera de la cuenta ─────────────────────────────────────────
    // Devuelve { planes:[{meses,total}], origen:'cuenta'|'actual'|null, sana, avisos:[] }
    function escalera(cuenta, capitalContado, periodicidad) {
        const avisos = [];
        const congelada = Array.isArray(cuenta.saldosPorMes) ? cuenta.saldosPorMes.map((p) => ({ meses: Number(p.meses), total: Number(p.total) })).filter((p) => p.meses > 0 && p.total > 0) : [];
        congelada.sort((a, b) => a.meses - b.meses);
        const sana = congelada.length > 0 && congelada.every((p, i, arr) => i === 0 || p.total >= arr[i - 1].total - 0.01);
        if (sana) return { planes: congelada, origen: 'cuenta', avisos };
        if (typeof CalculatorService !== 'undefined' && CalculatorService.calcularCreditoConPeriodicidad && capitalContado > 0) {
            avisos.push(congelada.length
                ? 'La escalera guardada en esta cuenta no es consistente; se estimó con las tarifas ACTUALES. Verifícalo antes de prometer el monto.'
                : 'Esta cuenta no tiene escalera propia guardada; se estimó con las tarifas ACTUALES. Verifícalo antes de prometer el monto.');
            const planes = CalculatorService.calcularCreditoConPeriodicidad(capitalContado, periodicidad || 'semanal')
                .map((p) => ({ meses: Number(p.meses), total: Number(p.total) })).sort((a, b) => a.meses - b.meses);
            return { planes, origen: 'actual', avisos };
        }
        return { planes: [], origen: null, avisos: ['No se pudo obtener la escalera de plazos de esta cuenta.'] };
    }

    // ── Análisis de una cuenta (todo en vivo, sin guardar nada) ───────
    function analizar(folio) {
        const cuenta = leer('cuentasPorCobrar', []).find((c) => c.folio === folio);
        if (!cuenta) return null;
        const estado = g('_calcularEstadoCuenta') ? g('_calcularEstadoCuenta')(folio) : null;
        const moratorios = Number(estado && estado.saldoMoratorios || 0);
        const saldoNominal = Math.max(0, Number((estado && estado.saldoTotal !== undefined) ? estado.saldoTotal : cuenta.saldoActual || 0) - moratorios);
        const enganche = Number(cuenta.engancheRecibido || cuenta.enganche || 0);
        const fImporte = g('_cxcImporteContadoCuenta');
        const contado = fImporte ? fImporte(cuenta) : Number(cuenta.totalContadoOriginal || cuenta.totalMercancia || 0);
        const capitalContado = Math.max(0, contado - enganche);
        const mesesPlan = Number((cuenta.plan && cuenta.plan.meses) || cuenta.plazoMeses || cuenta.meses || 0);
        const totalPlan = Number((cuenta.plan && cuenta.plan.total) || cuenta.saldoOriginal || 0);
        const periodicidad = cuenta.periodicidad || 'semanal';
        const fVenta = fechaVenta(cuenta);
        const dias = Math.max(0, Math.floor((new Date() - fVenta) / 86400000));
        const mesPostContado = Math.max(1, Math.floor(Math.max(0, dias - 30) / DIAS_MES) + 1); // mismo criterio que la escalera mes-a-mes
        const venceDias = mesesPlan * DIAS_MES;
        const enPlazo = mesesPlan > 0 ? dias < venceDias : false;
        const fVence = new Date(fVenta.getTime() + venceDias * 86400000);
        const fTotalPagado = g('_cxcTotalPagadoPolitica');
        const abonos = fTotalPagado ? fTotalPagado(folio, cuenta) : (cuenta.abonos || []).filter(noCancelada).reduce((s, a) => s + Number(a.monto || a.montoAbonado || 0), 0);
        // Lo "cubierto" según el saldo del sistema (incluye condonaciones/ajustes), para que la cotización cuadre con Cobranza
        const cubierto = totalPlan > 0 ? Math.max(0, totalPlan - saldoNominal) : abonos;
        const ajustes = r2(cubierto - abonos);
        const inicio = fechaInicioCupones();
        const posterior = !!inicio && fVenta >= inicio;
        const esc_ = escalera(cuenta, capitalContado, periodicidad);
        return { cuenta, folio, estado, moratorios, saldoNominal, enganche, contado, capitalContado, mesesPlan, totalPlan, periodicidad,
            fVenta, dias, mesPostContado, enPlazo, fVence, abonos, cubierto, ajustes, inicio, posterior, escalera: esc_ };
    }

    // Plazos a los que puede aspirar HOY
    function plazosPosibles(a) {
        if (a.posterior) return a.mesesPlan > 0 ? [a.mesesPlan] : [];
        if (!a.enPlazo) return a.mesesPlan > 0 ? [a.mesesPlan] : [];
        return a.escalera.planes.filter((p) => p.meses >= a.mesPostContado && p.meses <= a.mesesPlan).map((p) => p.meses);
    }

    // Cotización para un plazo elegido
    function cotizar(a, meses) {
        const out = { meses, avisos: [].concat(a.escalera.avisos), cupon: null, mensaje: '' };
        if (a.saldoNominal <= 0.01) { out.liquidada = true; out.mensaje = 'La cuenta ya está liquidada.'; return out; }
        if (a.posterior) {
            // Regla vigente: misma función que usa Cobranza al cobrar
            const pol = g('_cxcEvaluarPoliticaPagoAnticipado') ? g('_cxcEvaluarPoliticaPagoAnticipado')(a.folio, a.saldoNominal) : null;
            const restante = pol ? Number(pol.montoLiquidacion) : a.saldoNominal;
            out.totalPlazo = a.totalPlan; out.restante = Math.min(restante, a.saldoNominal);
            out.totalFinal = a.enganche + a.totalPlan;
            if (pol && pol.tipo === 'contado_1_mes') out.mensaje = 'Plan de 1 mes: se cobra el precio de contado real; no genera cupón.';
            else if (!a.enPlazo) out.mensaje = 'Ya pasó su plazo pactado: se liquida con el saldo vigente y sin cupón.';
            if (pol && pol.aplica && Number(pol.beneficio) > 0.01) out.cupon = { monto: Number(pol.beneficio), pct: pol.porcentajeCupon };
            if (pol && pol.tipo !== 'contado_1_mes' && a.enPlazo) {
                out.mensaje = out.cupon
                    ? 'Con la regla de cupones, liquidar antes no baja el monto: paga el saldo completo y recibe un cupón.'
                    : 'Con la regla de cupones, liquidar antes no baja el monto: paga el saldo completo. Este plan no genera cupón.';
            }
            return out;
        }
        // Venta anterior a cupones: escalera congelada de la cuenta
        const plan = a.escalera.planes.find((p) => p.meses === Number(meses));
        if (!plan) { out.sinPlan = true; out.mensaje = 'No hay tarifa para ese plazo en esta cuenta.'; return out; }
        out.totalPlazo = plan.total;
        out.restante = Math.min(a.saldoNominal, Math.max(0, plan.total - a.cubierto)); // nunca más caro que el saldo vigente
        out.totalFinal = a.enganche + plan.total;
        if (!a.enPlazo) out.mensaje = 'Ya pasó su plazo pactado: se liquida con el saldo vigente (ver salto de plazo si aplica).';
        else if (meses === a.mesesPlan) out.mensaje = 'Es su plazo pactado: paga el saldo vigente completo.';
        else out.mensaje = `Liquidando a ${meses} mes(es) paga el total de ese plazo en la escalera con que se vendió.`;
        return out;
    }

    // ── Interfaz ──────────────────────────────────────────────────────
    const S = { cliente: null, folio: null, meses: null };

    function abrir(folioInicial) {
        document.querySelector('[data-modal="cotizar-liquidacion"]')?.remove();
        document.body.insertAdjacentHTML('beforeend', `
        <div data-modal="cotizar-liquidacion" style="position:fixed;inset:0;background:rgba(15,23,42,0.75);z-index:9000;display:flex;justify-content:center;align-items:flex-start;overflow:auto;padding:20px;">
            <div style="background:white;border-radius:14px;width:100%;max-width:640px;padding:22px;box-shadow:0 20px 25px rgba(0,0,0,0.25);">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <h2 style="margin:0;color:#0f766e;">🧮 Cotizar liquidación</h2>
                    <button onclick="document.querySelector('[data-modal=&quot;cotizar-liquidacion&quot;]').remove()" style="border:none;background:#f1f5f9;border-radius:8px;padding:8px 14px;cursor:pointer;font-weight:bold;">✕</button>
                </div>
                <div id="cqlCuerpo" style="margin-top:14px;"></div>
            </div>
        </div>`);
        S.cliente = null; S.folio = null; S.meses = null;
        if (folioInicial) {
            const c = leer('cuentasPorCobrar', []).find((x) => x.folio === folioInicial);
            if (c) { S.folio = folioInicial; S.cliente = { id: c.clienteId, nombre: nombreCliente(c) }; }
        }
        render();
    }

    function nombreCliente(c) {
        const f = g('_cxcNombreClienteVigente');
        return f ? f(c) : (c.nombre || c.clienteNombre || 'Cliente');
    }
    function cuentasDelCliente(clienteId) {
        const est = (c) => String(c.estado || '').toLowerCase();
        return leer('cuentasPorCobrar', []).filter((c) => String(c.clienteId) === String(clienteId) && est(c) !== 'cancelado' && est(c) !== 'saldado' && !c.incobrable && Number(c.saldoActual || 0) > 0.01);
    }

    function render() {
        const cont = document.getElementById('cqlCuerpo');
        if (!cont) return;
        const btnCliente = `<button onclick="_cqlElegirCliente()" style="width:100%;padding:12px;background:#0f766e;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">👤 ${S.cliente ? 'Cambiar cliente' : 'Seleccionar cliente'}</button>`;
        if (!S.cliente) { cont.innerHTML = btnCliente + '<p style="color:#64748b;font-size:13px;margin-top:10px;">Elige al cliente para ver sus cuentas a crédito y cotizar su liquidación.</p>'; return; }

        // Fecha de inicio de cupones: se pide una sola vez
        if (!fechaInicioCupones()) { cont.innerHTML = btnCliente + tarjetaConfigFecha(); return; }

        const cuentas = cuentasDelCliente(S.cliente.id);
        if (S.folio && !cuentas.some((c) => c.folio === S.folio)) S.folio = null;
        if (!S.folio && cuentas.length === 1) S.folio = cuentas[0].folio;
        const opcionesCuenta = cuentas.map((c) => `<option value="${esc(c.folio)}" ${c.folio === S.folio ? 'selected' : ''}>${esc(c.folio.length > 26 ? c.folio.slice(0, 26) + '…' : c.folio)} · ${esc(fmtFecha(fechaVenta(c)))} · ${esc((c.plan && c.plan.meses) || '?')} m · saldo ${esc(dinero(c.saldoActual))}</option>`).join('');
        let html = btnCliente + `<div style="margin-top:12px;font-size:15px;"><strong>${esc(S.cliente.nombre)}</strong></div>`;
        if (!cuentas.length) { cont.innerHTML = html + '<p style="color:#b45309;background:#fffbeb;border-radius:8px;padding:10px;margin-top:8px;">Este cliente no tiene cuentas a crédito con saldo pendiente.</p>'; return; }
        html += `<label style="display:block;margin-top:10px;font-size:12px;color:#475569;">Cuenta</label>
            <select onchange="_cqlElegirCuenta(this.value)" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:8px;"><option value="">— elegir cuenta —</option>${opcionesCuenta}</select>`;
        if (!S.folio) { cont.innerHTML = html; return; }

        const a = analizar(S.folio);
        if (!a) { cont.innerHTML = html; return; }
        const plazos = plazosPosibles(a);
        if (!plazos.includes(Number(S.meses))) S.meses = plazos.length ? plazos[0] : null;
        const q = S.meses ? cotizar(a, Number(S.meses)) : null;

        html += resumenCuenta(a);
        if (a.posterior) html += `<div style="margin-top:8px;font-size:12px;color:#7e22ce;background:#faf5ff;border-radius:8px;padding:8px 10px;">🎟️ Venta posterior al inicio de cupones (${esc(fmtFecha(a.inicio))}): aplica la regla vigente con cupón.</div>`;
        else html += `<div style="margin-top:8px;font-size:12px;color:#475569;background:#f1f5f9;border-radius:8px;padding:8px 10px;">📜 Venta anterior a cupones (${esc(fmtFecha(a.inicio))}): se cotiza con la escalera de tarifas que tenía esta venta${a.escalera.origen === 'cuenta' ? ' (guardada en la cuenta)' : ''}. No genera cupón.</div>`;
        (q ? q.avisos : a.escalera.avisos).forEach((m) => { html += `<div style="margin-top:8px;font-size:12px;color:#b45309;background:#fffbeb;border-radius:8px;padding:8px 10px;">⚠️ ${esc(m)}</div>`; });

        if (a.saldoNominal <= 0.01) { cont.innerHTML = html + '<p style="margin-top:10px;font-weight:bold;color:#15803d;">La cuenta ya está liquidada.</p>'; return; }
        if (!plazos.length) { cont.innerHTML = html + '<p style="margin-top:10px;color:#b45309;">No hay plazos disponibles para cotizar en esta cuenta.</p>'; return; }

        html += `<label style="display:block;margin-top:12px;font-size:12px;color:#475569;">${a.posterior || !a.enPlazo ? 'Plazo' : 'Liquidar a'}</label>
            <select onchange="_cqlElegirPlazo(this.value)" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:8px;font-size:15px;">` +
            plazos.map((m) => {
                const p = a.escalera.planes.find((x) => x.meses === m);
                const total = a.posterior ? a.totalPlan : (p ? p.total : null);
                return `<option value="${m}" ${Number(S.meses) === m ? 'selected' : ''}>${m} mes${m === 1 ? '' : 'es'}${m === a.mesesPlan ? ' (pactado)' : ''}${total ? ' · total ' + esc(dinero(total)) : ''}</option>`;
            }).join('') + '</select>';
        if (q) html += resultado(a, q);
        cont.innerHTML = html;
    }

    function resumenCuenta(a) {
        const fila = (k, v) => `<div style="display:flex;justify-content:space-between;gap:10px;padding:3px 0;"><span style="color:#64748b;">${k}</span><strong>${v}</strong></div>`;
        return `<div style="margin-top:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;font-size:13px;">
            ${fila('Venta', esc(fmtFecha(a.fVenta)) + ' · plan ' + esc(a.mesesPlan) + ' meses ' + esc(a.periodicidad))}
            ${fila('Va en', 'día ' + a.dias + (a.mesesPlan ? (a.enPlazo ? ' · plazo vence ' + esc(fmtFecha(a.fVence)) : ' · plazo vencido el ' + esc(fmtFecha(a.fVence))) : ''))}
            ${fila('Saldo vigente (sin moratorios)', esc(dinero(a.saldoNominal)))}
        </div>`;
    }

    function resultado(a, q) {
        if (q.liquidada || q.sinPlan) return `<p style="margin-top:12px;color:#b45309;">${esc(q.mensaje)}</p>`;
        const fila = (k, v, extra) => `<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px dashed #e2e8f0;"><span style="color:#475569;">${k}</span><span style="${extra || 'font-weight:bold;'}">${v}</span></div>`;
        let h = `<div style="margin-top:12px;border:2px solid #0f766e;border-radius:12px;padding:14px;">
            ${fila('Total del plan a ' + q.meses + ' mes' + (q.meses === 1 ? '' : 'es'), esc(dinero(q.totalPlazo)))}
            ${fila('Enganche recibido', esc(dinero(a.enganche)), 'font-weight:normal;')}
            ${fila('Abonos recibidos', esc(dinero(a.abonos)), 'font-weight:normal;')}
            ${Math.abs(a.ajustes) > 0.01 ? fila('Otros ajustes aplicados (condonaciones, etc.)', esc(dinero(a.ajustes)), 'font-weight:normal;') : ''}
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0 4px;"><span style="font-size:15px;color:#0f172a;">Importe restante a cubrir</span><span style="font-size:24px;font-weight:800;color:#0f766e;">${esc(dinero(q.restante))}</span></div>
            ${a.moratorios > 0.01 ? fila('+ Moratorios pendientes (se cobran aparte)', esc(dinero(a.moratorios)), 'font-weight:normal;color:#b45309;') + fila('A pagar hoy con moratorios', esc(dinero(q.restante + a.moratorios))) : ''}
            ${fila('Total final de la compra (enganche + plan)', esc(dinero(q.totalFinal)))}
            ${(!a.posterior && a.saldoNominal - q.restante > 0.01) ? fila('Ahorro contra su saldo vigente', esc(dinero(a.saldoNominal - q.restante)), 'font-weight:bold;color:#15803d;') : ''}`;
        if (a.posterior) {
            h += q.cupon
                ? `<div style="margin-top:10px;background:#faf5ff;border:1px solid #e9d5ff;border-radius:10px;padding:10px 12px;"><div style="font-size:12px;color:#7e22ce;">🎟️ Cupón que recibiría al liquidar</div><div style="font-size:22px;font-weight:800;color:#7e22ce;">${esc(dinero(q.cupon.monto))}</div><div style="font-size:12px;color:#6b21a8;">${esc(q.cupon.pct)}% del total financiado</div></div>`
                : `<div style="margin-top:10px;font-size:13px;color:#64748b;">🎟️ Sin cupón en este caso.</div>`;
        }
        h += `<div style="margin-top:10px;font-size:12px;color:#64748b;">${esc(q.mensaje)}</div></div>
            <button onclick="_cqlCopiar()" style="margin-top:10px;padding:9px 14px;border:1px solid #cbd5e1;background:white;border-radius:8px;cursor:pointer;font-weight:bold;">📋 Copiar resumen para el cliente</button>`;
        return h;
    }

    function tarjetaConfigFecha() {
        const sug = sugerirFechaInicio();
        return `<div style="margin-top:12px;border:1px solid #fde68a;background:#fffbeb;border-radius:10px;padding:12px;">
            <div style="font-weight:bold;color:#92400e;">Una sola vez: ¿desde qué fecha rigen los cupones?</div>
            <p style="font-size:13px;color:#78350f;margin:6px 0;">Las ventas anteriores a esa fecha se cotizan con su escalera original y sin cupón; las posteriores, con la regla vigente.${sug ? ` Detecté que los abonos ya llevan marca de cupón desde el <strong>${esc(fmtFecha(sug))}</strong>; confirma o corrige.` : ''}</p>
            <div style="display:flex;gap:8px;"><input type="date" id="cqlFechaInicio" value="${sug ? isoDia(sug) : ''}" style="flex:1;padding:8px;border:1px solid #cbd5e1;border-radius:8px;">
            <button onclick="_cqlGuardarFecha()" style="padding:8px 14px;background:#92400e;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">Guardar</button></div></div>`;
    }

    // ── Acciones ──────────────────────────────────────────────────────
    window._cqlElegirCliente = function () {
        if (typeof window.abrirSelectorCliente !== 'function') { alert('El selector de clientes no está disponible.'); return; }
        window.abrirSelectorCliente({
            titulo: 'Cliente a cotizar',
            onSeleccion: (c) => { S.cliente = { id: c.id, nombre: c.nombre }; S.folio = null; S.meses = null; document.querySelector('[data-modal="universal-client-picker"]')?.remove(); render(); }
        });
    };
    window._cqlElegirCuenta = function (folio) { S.folio = folio || null; S.meses = null; render(); };
    window._cqlElegirPlazo = function (m) { S.meses = Number(m) || null; render(); };
    window._cqlGuardarFecha = function () {
        const v = (document.getElementById('cqlFechaInicio') || {}).value;
        if (!v) { alert('Elige la fecha.'); return; }
        const guardar = () => { StorageService.set(CFG_KEY, { fechaInicio: v }); render(); };
        if (typeof window.requireAdmin === 'function') window.requireAdmin(guardar); else guardar();
    };
    window._cqlCopiar = function () {
        if (!S.folio) return;
        const a = analizar(S.folio); if (!a) return;
        const q = cotizar(a, Number(S.meses)); if (!q || q.restante === undefined) return;
        const lineas = [`Cotización de liquidación — ${S.cliente.nombre}`, `Plazo: ${q.meses} mes(es)`, `Importe restante a cubrir: ${dinero(q.restante)}`];
        if (a.moratorios > 0.01) lineas.push(`Moratorios pendientes: ${dinero(a.moratorios)}`);
        lineas.push(`Total final de la compra: ${dinero(q.totalFinal)}`);
        if (a.posterior && q.cupon) lineas.push(`Cupón al liquidar: ${dinero(q.cupon.monto)}`);
        lineas.push(`(Cotización al ${fmtFecha(new Date())}; sujeta a validación en caja)`);
        const texto = lineas.join('\n');
        (navigator.clipboard ? navigator.clipboard.writeText(texto) : Promise.reject()).then(() => alert('Resumen copiado.')).catch(() => prompt('Copia el resumen:', texto));
    };

    window.abrirCotizarLiquidacion = function (folio) { abrir(folio); };
    window._cqlAnalizar = analizar; window._cqlPlazos = plazosPosibles; window._cqlCotizar = cotizar; // pruebas / consola
})();
