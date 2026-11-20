// ===== MÓDULO EXCLUSIVO DE CONCILIACIÓN MSI POR FECHA DE CORTE =====

function renderConciliacionMSI() {
    const cont = document.getElementById('contenedorConciliacion');
    if (!cont) return;

    // --- Helpers Locales Blindados ---
    const fmtDinero = v => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(v) || 0);
    const fmtFecha = d => {
        // 'YYYY-MM-DD' se toma como fecha local (a mediodía): new Date('2026-12-01') es UTC y en México salía 30 NOV
        const dt = (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) ? new Date(d + 'T12:00:00') : new Date(d);
        if (isNaN(dt.getTime())) return String(d);
        return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(dt).toUpperCase();
    };

    const cuentasMSI = StorageService.get("cuentasMSI", []);
    const tarjetasConfig = StorageService.get("tarjetasConfig", []);
    
    // Filtros
    const bancoSeleccionado = window._filtroMSIBanco || (cuentasMSI.length > 0 ? cuentasMSI[0].banco : '');
    const mesReferencia = window._filtroMSIMes !== undefined ? window._filtroMSIMes : new Date().getMonth(); // 0-11
    const anioReferencia = window._filtroMSIAnio || new Date().getFullYear();

    // 2. Cálculo Inteligente del Periodo Bancario
    const infoTarjeta = (window.buscarTarjetaCreditoPorBanco ? window.buscarTarjetaCreditoPorBanco(bancoSeleccionado) : tarjetasConfig.find(t => t.banco === bancoSeleccionado))
        || (window.buscarBancoPorValor ? window.buscarBancoPorValor(bancoSeleccionado, 'credito') : null);

    // El día de corte sale SIEMPRE del banco configurado: no se inventa uno.
    const diaCorte = (infoTarjeta && parseInt(infoTarjeta.diaCorte) > 0) ? parseInt(infoTarjeta.diaCorte) : 0;
    if (!diaCorte) {
        cont.innerHTML = `<div style="padding:16px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;color:#78350f;">⚠️ ${bancoSeleccionado ? `El banco "${bancoSeleccionado}" no tiene día de corte configurado.` : 'No hay banco seleccionado.'} Captúralo en la configuración de Bancos y vuelve a abrir esta pantalla.</div>`;
        return;
    }
    
    // Matemáticas de fecha exactas (Si el corte es el 12: del 11 del mes pasado al 12 actual)
    // Tarjetas que CORTAN Y PAGAN EN EL MISMO MES (el día de pago es posterior al de corte,
    // p. ej. corte 7 y pago 18): la mensualidad de un estado de cuenta se paga ese mismo mes.
    // Antes la ventana (del corte anterior al corte del mes) dejaba el pago del 18 de noviembre
    // dentro del estado de DICIEMBRE, y todos los números de pago salían un estado de cuenta
    // tarde frente al banco. El resto de las tarjetas (pago en el mes siguiente al corte) no cambia.
    const diaLimite = (infoTarjeta && parseInt(infoTarjeta.diaLimite) > 0) ? parseInt(infoTarjeta.diaLimite) : 0;
    const pagaMismoMes = diaLimite > diaCorte;

    // Ventana de FECHAS DE PAGO que se concilian en el mes seleccionado.
    // Tarjetas que pagan el mismo mes: el MES calendario completo. No se usan días de corte porque
    // las fechas guardadas de las compras no siempre traen el día de pago (hay compras con día 1, 4, 5
    // y 18) y el historial de la compra ya interpreta cada cuota por su mes.
    const fechaInicio = pagaMismoMes
        ? new Date(anioReferencia, mesReferencia, 1, 0, 0, 0)
        : new Date(anioReferencia, mesReferencia - 1, diaCorte - 1, 0, 0, 0);
    const fechaFin = pagaMismoMes
        ? new Date(anioReferencia, mesReferencia + 1, 0, 23, 59, 59)
        : new Date(anioReferencia, mesReferencia, diaCorte, 23, 59, 59);

    // Periodo que se muestra: para las que pagan el mismo mes, el periodo facturado real del
    // estado de cuenta (día siguiente al corte anterior hasta el corte de este mes).
    const periodoStr = pagaMismoMes
        ? `${fmtFecha(new Date(anioReferencia, mesReferencia - 1, diaCorte + 1))} al ${fmtFecha(new Date(anioReferencia, mesReferencia, diaCorte))}`
        : `${fmtFecha(fechaInicio)} al ${fmtFecha(fechaFin)}`;
    const analisisFechas = pagaMismoMes ? _concAnalizarCalendariosMSI(bancoSeleccionado, diaCorte, diaLimite) : { lista: [], hayRespaldo: false };
    const detalleCorteStr = pagaMismoMes
        ? `Corte: Día ${diaCorte} · Pago: ${fmtFecha(new Date(anioReferencia, mesReferencia, diaLimite))}`
        : `Corte: Día ${diaCorte}`;

    // 3. Filtrar mensualidades en el periodo
    let mensualidadesEnPeriodo = [];
    let totalEsperado = 0;
    let totalConciliado = 0;
    let totalComisionesPeriodo = 0;

    cuentasMSI.forEach(cta => {
        if (cta.banco !== bancoSeleccionado) return;
        
        if (cta.calendario && Array.isArray(cta.calendario)) {
            cta.calendario.forEach((p, index_cal) => {
                const fechaPago = new Date(p.fecha + "T12:00:00");
                
                if (fechaPago >= fechaInicio && fechaPago <= fechaFin) {
                    // 🏷️ Comisiones bancarias (agregadas desde "+ Comisión Bancaria" en
                    // esta misma pantalla, ver guardarComisionBancaria) se guardan como
                    // una cuentaMSI de 1 sola mensualidad (esComisionBancaria:true) para
                    // reusar TODO el motor de deuda/pago/conciliación que ya existe para
                    // tarjetas de crédito -- se distinguen aquí solo para mostrarlas
                    // distinto (badge propio) y sumarlas aparte en el KPI.
                    const esComision = cta.esComisionBancaria === true;
                    const item = {
                        id_ref: `${cta.id}_${p.n || p.numero}`,
                        parent_id: cta.id,
                        index_cal: index_cal,
                        numero_ms: p.n || p.numero,
                        total_ms: cta.plazo || cta.meses,
                        fecha: p.fecha,
                        concepto: cta.concepto || cta.producto,
                        monto: parseFloat(p.monto) || 0,
                        conciliado: p.conciliado || false,
                        esComision
                    };
                    mensualidadesEnPeriodo.push(item);
                    totalEsperado += item.monto;
                    if (item.conciliado) totalConciliado += item.monto;
                    if (esComision) totalComisionesPeriodo += item.monto;
                }
            });
        }
    });

    // 4. Construir Selectores
    const bancosUnicos = [...new Set(cuentasMSI.map(c => c.banco))];
    const opcionesBancos = bancosUnicos.map(b => `<option value="${b}" ${b === bancoSeleccionado ? 'selected' : ''}>💳 ${b}</option>`).join('');
    
    const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    const opcionesMeses = meses.map((m, i) => `<option value="${i}" ${i == mesReferencia ? 'selected' : ''}>${m}</option>`).join('');

    // Años disponibles: todos los que aparecen en los calendarios de pago, el actual y el siguiente
    const aniosSet = new Set([new Date().getFullYear(), new Date().getFullYear() + 1, anioReferencia]);
    cuentasMSI.forEach(c => (c.calendario || []).forEach(p => {
        const y = parseInt(String(p.fecha || '').slice(0, 4), 10);
        if (y >= 2000 && y <= 2100) aniosSet.add(y);
    }));
    const opcionesAnios = [...aniosSet].sort((a, b) => a - b)
        .map(y => `<option value="${y}" ${y === anioReferencia ? 'selected' : ''}>${y}</option>`).join('');

    // 5. Renderizar Interfaz
    cont.innerHTML = `
        <div style="background:white; padding:25px; border-radius:12px; box-shadow:0 4px 6px rgba(0,0,0,0.05); position: relative;">
            
            <div style="border-bottom: 2px solid #f1f5f9; padding-bottom:15px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <div>
                    <h2 style="margin:0; color:#1e293b;">🏦 Conciliación MSI: ${bancoSeleccionado}</h2>
                    <div style="background:#e0f2fe; color:#0369a1; padding:8px 15px; border-radius:6px; display:inline-block; margin-top:10px; font-weight:bold; font-size:14px;">
                        📅 Periodo facturado: ${periodoStr} <span style="color:#0284c7; font-size:12px; margin-left:8px;">(${detalleCorteStr})</span>
                    </div>
                    <!-- La corrección automática por regla (abrirModalCorregirFechasMSI) queda disponible solo por consola; el flujo se corrige con el estado de cuenta (scripts/mercadopago_fechas.js) -->
                    ${analisisFechas.hayRespaldo ? `<div style="margin-top:8px;"><button onclick="deshacerCorreccionFechasMSI('${bancoSeleccionado}')" style="padding:6px 12px; background:none; color:#64748b; border:1px solid #cbd5e1; border-radius:8px; cursor:pointer; font-size:12px;">↩ Deshacer corrección de fechas</button></div>` : ''}
                </div>
                <button onclick="window.abrirModalComisionBancaria('${bancoSeleccionado}')" style="padding:10px 16px; background:#fffbeb; color:#92400e; border:1px solid #fde68a; border-radius:8px; cursor:pointer; font-weight:bold; font-size:13px; white-space:nowrap;">🏷️ + Comisión Bancaria</button>
            </div>

            <div style="display:flex; gap:15px; margin-bottom:15px; flex-wrap:wrap;">
                <div style="flex:1; min-width:200px;">
                    <label style="display:block; font-size:11px; font-weight:bold; color:#64748b; margin-bottom:5px;">SELECCIONAR BANCO:</label>
                    <select id="selMSIBanco" style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1; font-weight:bold;">${opcionesBancos}</select>
                </div>
                <div style="flex:1; min-width:200px;">
                    <label style="display:block; font-size:11px; font-weight:bold; color:#64748b; margin-bottom:5px;">MES DE ESTADO DE CUENTA:</label>
                    <div style="display:flex; gap:8px;">
                        <select id="selMSIMes" style="flex:1; min-width:0; padding:10px; border-radius:8px; border:1px solid #cbd5e1; font-weight:bold;">${opcionesMeses}</select>
                        <select id="selMSIAnio" style="width:88px; padding:10px; border-radius:8px; border:1px solid #cbd5e1; font-weight:bold;">${opcionesAnios}</select>
                    </div>
                </div>
            </div>

            <div style="position: sticky; top: 0; z-index: 10; background: white; padding: 10px 0 15px 0; margin-bottom:15px; border-bottom:1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(250px, 1fr)); gap:20px;">
                    <div style="background:#f8fafc; padding:20px; border-radius:12px; border-top:4px solid #6366f1; box-shadow:0 2px 4px rgba(0,0,0,0.02);">
                        <div style="font-size:12px; color:#64748b; font-weight:bold; text-transform:uppercase;">Cargos en Periodo</div>
                        <div style="font-size:26px; font-weight:900; color:#1e293b;">${fmtDinero(totalEsperado)}</div>
                    </div>
                    <div style="background:#f0fdf4; padding:20px; border-radius:12px; border-top:4px solid #10b981; box-shadow:0 2px 4px rgba(0,0,0,0.02);">
                        <div style="font-size:12px; color:#166534; font-weight:bold; text-transform:uppercase;">Total Conciliado</div>
                        <div style="font-size:26px; font-weight:900; color:#15803d;">${fmtDinero(totalConciliado)}</div>
                    </div>
                    <div style="background:#fffbeb; padding:20px; border-radius:12px; border-top:4px solid #d97706; box-shadow:0 2px 4px rgba(0,0,0,0.02);">
                        <div style="font-size:12px; color:#92400e; font-weight:bold; text-transform:uppercase;">Comisiones Bancarias en Periodo</div>
                        <div style="font-size:26px; font-weight:900; color:#b45309;">${fmtDinero(totalComisionesPeriodo)}</div>
                        <div style="font-size:11px; color:#92400e; margin-top:2px;">Ya se refleja como gasto financiero (RIF) en el Estado de Resultados</div>
                    </div>
                </div>
            </div>

            <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr style="background:#f1f5f9; text-align:left;">
                            <th style="padding:12px; font-size:12px; color:#64748b;">FECHA CARGO</th>
                            <th style="padding:12px; font-size:12px; color:#64748b;">CONCEPTO</th>
                            <th style="padding:12px; font-size:12px; color:#64748b;">MENSUALIDAD</th>
                            <th style="padding:12px; text-align:right; font-size:12px; color:#64748b;">MONTO</th>
                            <th style="padding:12px; text-align:center; font-size:12px; color:#64748b;">CONCILIADO</th>
                            <th style="padding:12px; text-align:center; font-size:12px; color:#64748b;">ACCIÓN</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${mensualidadesEnPeriodo.map(m => `
                            <tr style="border-bottom: 1px solid #e2e8f0; background: ${m.conciliado ? '#f0fdf4' : (m.esComision ? '#fffbeb' : 'white')}; transition: 0.2s;">
                                <td style="padding:12px; font-size:13px;">${fmtFecha(m.fecha)}</td>
                                <td style="padding:12px; font-weight:bold; color:#1e293b;">${m.concepto}</td>
                                <td style="padding:12px;">
                                    ${m.esComision
                                        ? `<span style="background:#fef3c7; color:#92400e; padding:4px 8px; border-radius:20px; font-size:11px; font-weight:bold;">🏷️ Comisión bancaria</span>`
                                        : `<span style="background:#e0e7ff; color:#4338ca; padding:4px 8px; border-radius:20px; font-size:11px; font-weight:bold;">Mes ${m.numero_ms} de ${m.total_ms}</span>`}
                                </td>
                                <td style="padding:12px; text-align:right; font-weight:bold; color:#ef4444;">
                                    -${fmtDinero(m.monto)}
                                </td>
                                <td style="padding:12px; text-align:center;">
                                    <input type="checkbox" ${m.conciliado ? 'checked' : ''} 
                                           onchange="window.toggleConciliacionMSI('${m.parent_id}', '${m.numero_ms}', this.checked)"
                                           style="width:20px; height:20px; cursor:pointer; accent-color:#10b981;">
                                </td>
                                <td style="padding:12px; text-align:center;">
                                    <div style="display:flex; gap:6px; justify-content:center; flex-wrap:wrap;">
    <button onclick="abrirModalReprogramarConciliacion('${m.parent_id}', ${m.index_cal}, '${m.fecha}')" 
            style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; padding:6px 10px; cursor:pointer; font-size:11px; font-weight:bold; color:#475569;">
        ✏️ Reprogramar
    </button>
    <button onclick="window.abrirModalReasignarBanco('${m.parent_id}')" 
            style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:6px; padding:6px 10px; cursor:pointer; font-size:11px; font-weight:bold; color:#1d4ed8;">
        🏦 Reasignar
    </button>
    <button onclick="window.eliminarMensualidadesEnCascada('${m.parent_id}', ${m.index_cal}, '${m.numero_ms}')" 
            style="background:#fff1f2; border:1px solid #fecdd3; border-radius:6px; padding:6px 10px; cursor:pointer; font-size:11px; font-weight:bold; color:#e11d48;">
        ❌ Eliminar
    </button>
</div>
                                </td>
                            </tr>
                        `).join('') || '<tr><td colspan=\"6\" style=\"text-align:center; padding:50px; color:#94a3b8; font-style:italic;\">No hay mensualidades registradas para este banco en el periodo seleccionado.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    document.getElementById('selMSIBanco').onchange = (e) => { window._filtroMSIBanco = e.target.value; renderConciliacionMSI(); };
    document.getElementById('selMSIMes').onchange = (e) => { window._filtroMSIMes = parseInt(e.target.value); renderConciliacionMSI(); };
    document.getElementById('selMSIAnio').onchange = (e) => { window._filtroMSIAnio = parseInt(e.target.value); renderConciliacionMSI(); };
}

// ===================================================================
// 🛠️ CORRECCIÓN DE FECHAS DE CALENDARIOS (tarjetas que pagan el mismo mes)
// ===================================================================
// Con la ventana anterior de la conciliación, los pagos de estas tarjetas salían un estado de cuenta
// tarde; para compensarlo se movieron fechas a mano con "Reprogramar" (cascada): quedaron compras con
// dos pagos en el mismo mes o con todo el calendario un mes antes. Ahora la conciliación usa el MES de
// pago, así que esas fechas movidas salen en el mes equivocado. Esta herramienta recalcula el mes de
// cada pago con la MISMA regla con la que el sistema genera el calendario al registrar la compra
// (corte/pago de la tarjeta + fecha de compra). Solo cambia fechas: montos, estatus y conciliados
// quedan igual. Es reversible.
function _concMesesLargo() { return ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]; }
function _concEtiquetaMes(idx) { return `${_concMesesLargo()[((idx % 12) + 12) % 12]} ${Math.floor(idx / 12)}`; }

function _concAnalizarCalendariosMSI(banco, diaCorte, diaLimite) {
    const cuentas = StorageService.get("cuentasMSI", []);
    const brincoPago = diaCorte > diaLimite ? 1 : 0;
    const lista = [];
    let hayRespaldo = false;
    cuentas.forEach(c => {
        if (c.banco !== banco) return;
        if (Array.isArray(c.calendarioAntesCorreccionFechas)) hayRespaldo = true;
        const cal = c.calendario || [];
        if (!cal.length || c.migracionAutomatica || c.esComisionBancaria) return;
        const fc = String(c.fechaCompra || '');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fc)) return;
        const [y, m, d] = fc.split('-').map(Number);
        const primero = y * 12 + (m - 1) + (d > diaCorte ? 1 : 0) + brincoPago;
        const cambios = [];
        cal.forEach((p, i) => {
            const mm = String(p.fecha || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (!mm) return;
            const guardado = Number(mm[1]) * 12 + (Number(mm[2]) - 1);
            const esperado = primero + i;
            if (guardado !== esperado) cambios.push({ i, n: p.n || p.numero || (i + 1), guardado, esperado, dia: Number(mm[3]) });
        });
        if (cambios.length) lista.push({ id: c.id, concepto: c.concepto || c.producto || 'Compra MSI', fechaCompra: fc, total: cal.length, cambios, primero });
    });
    return { lista, hayRespaldo };
}

window.abrirModalCorregirFechasMSI = function(banco) {
    const tarjeta = (window.buscarTarjetaCreditoPorBanco ? window.buscarTarjetaCreditoPorBanco(banco) : null) || {};
    const { lista } = _concAnalizarCalendariosMSI(banco, parseInt(tarjeta.diaCorte) || 0, parseInt(tarjeta.diaLimite) || 0);
    document.querySelector('[data-modal="corregir-fechas-msi"]')?.remove();
    if (!lista.length) return alert("✅ Los calendarios de esta tarjeta ya están en orden.");
    const filas = lista.map(a => {
        const resumen = a.cambios.slice(0, 4).map(c => `#${c.n}: ${_concEtiquetaMes(c.guardado)} → <b>${_concEtiquetaMes(c.esperado)}</b>`).join(' · ') + (a.cambios.length > 4 ? ` · … (${a.cambios.length - 4} más)` : '');
        return `<label style="display:flex; gap:10px; align-items:flex-start; padding:10px; border-bottom:1px solid #f1f5f9; cursor:pointer;">
            <input type="checkbox" class="chkCorregirFechaMSI" value="${a.id}" checked style="margin-top:3px;">
            <div style="font-size:12.5px; line-height:1.5;">
                <b>${String(a.concepto).replace(/</g, '&lt;')}</b> <span style="color:#64748b;">· compra ${a.fechaCompra} · ${a.total} pagos</span><br>
                <span style="color:#475569;">${a.cambios.length} pago(s) cambian de mes: ${resumen}</span>
            </div></label>`;
    }).join('');
    document.body.insertAdjacentHTML('beforeend', `
    <div data-modal="corregir-fechas-msi" style="position:fixed; inset:0; background:rgba(15,23,42,0.85); z-index:99999; display:flex; justify-content:center; align-items:flex-start; padding:20px; overflow-y:auto;">
        <div style="background:white; border-radius:14px; width:100%; max-width:680px; padding:22px;">
            <h3 style="margin:0 0 6px 0; color:#92400e;">🛠️ Corregir fechas de calendarios · ${banco}</h3>
            <p style="font-size:12.5px; color:#475569; margin:0 0 12px 0;">Estas compras tienen pagos fuera del mes que les corresponde según el corte (${tarjeta.diaCorte}) y el pago (${tarjeta.diaLimite}) de la tarjeta, normalmente por haber movido fechas con “Reprogramar”. Solo se cambia el <b>mes</b> de cada pago; montos, estatus y conciliados no se tocan. Se puede deshacer.</p>
            <div style="border:1px solid #e2e8f0; border-radius:10px; max-height:50vh; overflow-y:auto;">${filas}</div>
            <div style="display:flex; gap:10px; margin-top:14px;">
                <button onclick="aplicarCorreccionFechasMSI('${banco}')" style="flex:1; padding:12px; background:#d97706; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">✅ Corregir las seleccionadas</button>
                <button onclick="this.closest('[data-modal]').remove()" style="padding:12px 18px; background:#e2e8f0; color:#475569; border:none; border-radius:8px; cursor:pointer;">Cancelar</button>
            </div>
        </div>
    </div>`);
};

window.aplicarCorreccionFechasMSI = function(banco) {
    const ids = [...document.querySelectorAll('.chkCorregirFechaMSI')].filter(x => x.checked).map(x => String(x.value));
    if (!ids.length) return alert("Selecciona al menos una compra.");
    const tarjeta = (window.buscarTarjetaCreditoPorBanco ? window.buscarTarjetaCreditoPorBanco(banco) : null) || {};
    const { lista } = _concAnalizarCalendariosMSI(banco, parseInt(tarjeta.diaCorte) || 0, parseInt(tarjeta.diaLimite) || 0);
    const cuentas = StorageService.get("cuentasMSI", []);
    let pagosCambiados = 0, compras = 0;
    lista.filter(a => ids.includes(String(a.id))).forEach(a => {
        const c = cuentas.find(x => String(x.id) === String(a.id));
        if (!c) return;
        c.calendarioAntesCorreccionFechas = (c.calendario || []).map(p => p.fecha);   // respaldo para deshacer
        a.cambios.forEach(ch => {
            const idx = ch.esperado, y = Math.floor(idx / 12), mes = ((idx % 12) + 12) % 12;
            const ult = new Date(y, mes + 1, 0).getDate();
            const dia = Math.min(ch.dia, ult);
            c.calendario[ch.i].fecha = `${y}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
            pagosCambiados++;
        });
        compras++;
    });
    StorageService.set("cuentasMSI", cuentas);
    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'MSI_FECHAS_CALENDARIO_CORREGIDAS', modulo: 'Conciliación', entidad: 'cuentaMSI', entidadId: banco,
            detalle: `Corrección de fechas de calendarios MSI de ${banco}: ${pagosCambiados} pago(s) en ${compras} compra(s) movidos al mes que les corresponde. Solo fechas; reversible.`,
            severidad: 'alerta'
        });
    }
    document.querySelector('[data-modal="corregir-fechas-msi"]')?.remove();
    alert(`✅ Listo: ${pagosCambiados} pago(s) de ${compras} compra(s) quedaron en el mes que les corresponde.`);
    renderConciliacionMSI();
};

window.deshacerCorreccionFechasMSI = function(banco) {
    const cuentas = StorageService.get("cuentasMSI", []);
    const conRespaldo = cuentas.filter(c => c.banco === banco && Array.isArray(c.calendarioAntesCorreccionFechas));
    if (!conRespaldo.length) return;
    if (!confirm(`¿Deshacer la corrección de fechas de ${banco}?\n\nSe restauran las fechas anteriores de ${conRespaldo.length} compra(s).`)) return;
    conRespaldo.forEach(c => {
        c.calendarioAntesCorreccionFechas.forEach((f, i) => { if (c.calendario[i]) c.calendario[i].fecha = f; });
        delete c.calendarioAntesCorreccionFechas;
    });
    StorageService.set("cuentasMSI", cuentas);
    if (window.AuditService?.log) {
        window.AuditService.log({ accion: 'MSI_FECHAS_CALENDARIO_RESTAURADAS', modulo: 'Conciliación', entidad: 'cuentaMSI', entidadId: banco, detalle: `Se restauraron las fechas originales de ${conRespaldo.length} compra(s) de ${banco}.`, severidad: 'alerta' });
    }
    renderConciliacionMSI();
};

window.toggleConciliacionMSI = function(ctaId, numeroMes, valor) {
    const cuentasMSI = StorageService.get("cuentasMSI", []);
    const ctaIdx = cuentasMSI.findIndex(c => String(c.id) === String(ctaId));
    
    if (ctaIdx !== -1) {
        const calIdx = cuentasMSI[ctaIdx].calendario.findIndex(p => String(p.n || p.numero) === String(numeroMes));
        if (calIdx !== -1) {
            cuentasMSI[ctaIdx].calendario[calIdx].conciliado = valor;
            StorageService.set("cuentasMSI", cuentasMSI);
        }
    }
    renderConciliacionMSI();
};

window.abrirModalReprogramarConciliacion = function(cuentaId, indexMensualidad, fechaActual) {
    document.querySelector('[data-modal="repro-concilia"]')?.remove();
    const html = `
    <div data-modal="repro-concilia" style="position:fixed; inset:0; background:rgba(15,23,42,0.8); z-index:10000; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
        <div style="background:white; padding:30px; border-radius:16px; width:90%; max-width:380px; box-shadow:0 20px 25px rgba(0,0,0,0.2);">
            <h3 style="margin-top:0; color:#d97706;">📅 Ajustar Fecha de Mensualidad</h3>
            <p style="font-size:12px; color:#64748b; margin-bottom:20px;">Al cambiar esta fecha, todas las mensualidades siguientes se recorrerán automáticamente sumando un mes.</p>
            
            <label style="font-size:12px; font-weight:bold; color:#475569; display:block; margin-bottom:5px;">Nueva fecha de cobro:</label>
            <input type="date" id="nuevaFechaConcilia" value="${fechaActual}" style="width:100%; padding:12px; border:2px solid #cbd5e1; border-radius:8px; margin-bottom:25px; font-size:16px; box-sizing:border-box;">
            
            <div style="display:flex; gap:10px;">
                <button onclick="ejecutarReprogramacionConciliacion('${cuentaId}', ${indexMensualidad})" style="flex:2; padding:12px; background:#d97706; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:14px;">💾 Guardar y Recorrer</button>
                <button onclick="this.closest('[data-modal]').remove()" style="flex:1; padding:12px; background:#f1f5f9; border:none; border-radius:8px; cursor:pointer; color:#475569; font-weight:bold;">Cancelar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window.ejecutarReprogramacionConciliacion = function(cuentaId, indexMensualidad) {
    const nuevaFechaStr = document.getElementById("nuevaFechaConcilia").value;
    if (!nuevaFechaStr) return;

    let cuentasMSI = StorageService.get("cuentasMSI", []);
    let cuenta = cuentasMSI.find(c => String(c.id) === String(cuentaId));
    if (!cuenta) return;

    let calendario = cuenta.calendario;
    let fechaBase = new Date(nuevaFechaStr + "T12:00:00");
    let mesActual = fechaBase.getMonth();
    let anioActual = fechaBase.getFullYear();
    let diaActual = fechaBase.getDate();

    for (let i = indexMensualidad; i < calendario.length; i++) {
        let fCalculada = new Date(anioActual, mesActual, diaActual, 12, 0, 0);
        let yyyy = fCalculada.getFullYear();
        let mm = String(fCalculada.getMonth() + 1).padStart(2, '0');
        let dd = String(fCalculada.getDate()).padStart(2, '0');

        calendario[i].fecha = `${yyyy}-${mm}-${dd}`;
        mesActual++; 
    }

    StorageService.set("cuentasMSI", cuentasMSI);
    document.querySelector('[data-modal="repro-concilia"]').remove();
    alert("✅ Calendario MSI actualizado en cascada correctamente.");
    renderConciliacionMSI(); 
};
// --- MOTOR DE ELIMINACIÓN EN CASCADA DESDE CONCILIACIÓN ---
window.eliminarMensualidadesEnCascada = function(cuentaId, indexMensualidad, numeroMes) {
    let cuentasMSI = StorageService.get("cuentasMSI", []);
    let cuenta = cuentasMSI.find(c => String(c.id) === String(cuentaId));
    
    if (!cuenta) {
        alert("❌ Error: No se encontró el registro raíz de esta cuenta MSI.");
        return;
    }

    // Extraemos el concepto seguro desde la base de datos
    let conceptoSeguro = cuenta.concepto || cuenta.producto || "Compra MSI";

    let calendario = cuenta.calendario || [];
    let totalCuotasOriginales = calendario.length;
    let cuotasAEliminar = totalCuotasOriginales - indexMensualidad;

    let resumen = `⚠️ RESUMEN DE OPERACIÓN - ELIMINACIÓN EN CASCADA\n\n` +
                  `📦 Concepto: ${conceptoSeguro}\n` +
                  `💳 Banco/Tarjeta: ${cuenta.banco}\n` +
                  `📍 Punto de Inflexión: Mensualidad No. ${numeroMes} de ${cuenta.meses || cuenta.plazo}\n\n` +
                  `--------------------------------------------------\n` +
                  `✅ Se CONSERVARÁN: ${indexMensualidad} mensualidades previas.\n` +
                  `🔥 Se ELIMINARÁN: ${cuotasAEliminar} mensualidades (esta y todas las siguientes).\n` +
                  `--------------------------------------------------\n\n` +
                  `¿Estás seguro de que deseas eliminar este fragmento del calendario?`;

    if (!confirm(resumen)) return;

    if (indexMensualidad === 0) {
        cuentasMSI = cuentasMSI.filter(c => String(c.id) !== String(cuentaId));
        StorageService.set("cuentasMSI", cuentasMSI);
        alert("🗑️ Cuenta MSI eliminada por completo del sistema ya que se purgó desde la primera cuota.");
    } else {
        let cuotasConservadas = calendario.slice(0, indexMensualidad);
        let nuevoTotalMonto = cuotasConservadas.reduce((sum, item) => sum + (parseFloat(item.monto) || 0), 0);
        
        cuenta.calendario = cuotasConservadas;
        cuenta.meses = cuotasConservadas.length;
        if (cuenta.plazo) cuenta.plazo = cuotasConservadas.length;
        cuenta.total = nuevoTotalMonto;

        StorageService.set("cuentasMSI", cuentasMSI);
        alert(`✅ Cascada ejecutada. Se purgaron las últimas ${cuotasAEliminar} cuotas con éxito.`);
    }

    if (typeof renderConciliacionMSI === 'function') renderConciliacionMSI();
};
// --- MOTOR DE REASIGNACIÓN BANCARIA (CONCILIACIÓN) ---
window.abrirModalReasignarBanco = function(cuentaId) {
    let cuentasMSI = StorageService.get("cuentasMSI", []);
    let cuenta = cuentasMSI.find(c => String(c.id) === String(cuentaId));
    if (!cuenta) {
        alert("❌ Error: No se encontró la cuenta maestra.");
        return;
    }

    // Extraemos dinámicamente tu catálogo real de bancos configurados
    let tarjetasConfig = StorageService.get("tarjetasConfig", []);
    let opcionesBancos = tarjetasConfig.map(t => `<option value="${t.banco}">${t.banco}</option>`).join('');
    
    // Sin bancos configurados no se inventan opciones
    if (!opcionesBancos) {
        opcionesBancos = `<option value="" disabled selected>— Sin bancos configurados —</option>`;
    }

    let concepto = cuenta.concepto || cuenta.producto || "Compra MSI";

    let html = `
    <div id="modalReasignarBanco" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:flex; justify-content:center; align-items:center; z-index:9999;">
        <div style="background:#fff; padding:20px; border-radius:8px; width:320px; box-shadow:0 4px 6px rgba(0,0,0,0.1); font-family:sans-serif;">
            <h3 style="margin-top:0; color:#1e293b; font-size:16px;">🏦 Reasignar Banco</h3>
            <p style="font-size:13px; color:#475569; margin-bottom:4px;">Compra: <b>${concepto}</b></p>
            <p style="font-size:13px; color:#475569; margin-top:0;">Banco Actual: <b style="color:#e11d48;">${cuenta.banco}</b></p>
            
            <div style="margin-top:15px; margin-bottom:20px;">
                <label style="display:block; font-size:12px; font-weight:bold; margin-bottom:5px; color:#334155;">Seleccionar Nuevo Banco:</label>
                <select id="nuevoBancoMSISelect" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px;">
                    <option value="">-- Elige un banco --</option>
                    ${opcionesBancos}
                </select>
            </div>
            
            <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button onclick="document.getElementById('modalReasignarBanco').remove()" 
                        style="padding:8px 12px; background:#f1f5f9; border:none; border-radius:6px; cursor:pointer; color:#475569; font-weight:bold; font-size:12px;">
                    Cancelar
                </button>
                <button onclick="window.ejecutarReasignacionBanco('${cuentaId}')" 
                        style="padding:8px 12px; background:#2563eb; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:12px;">
                    💾 Guardar Cambio
                </button>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', html);
};

// --- COMISIONES BANCARIAS (tarjetas de crédito) ---
// 🏷️ Se guardan como una cuentaMSI de UNA sola mensualidad (esComisionBancaria:
// true) en vez de crear una tabla/mecánica aparte -- así heredan gratis todo
// lo que ya existe para tarjetas de crédito: aparecen en "Deuda TDC a MSI"
// del Balance General (_msiCalcularResumen las suma igual que cualquier
// compra), se pagan solas cuando se cubre el corte mensual de esa tarjeta
// (procesarPagoTarjetaGlobal ya barre TODO calendario pendiente del banco,
// sin importar su origen) y se pueden reprogramar/reasignar/eliminar con los
// mismos botones de esta pantalla. Lo único nuevo es que
// finanzas-estados.js las reconoce por separado (esComisionBancaria:true)
// para sumarlas como GASTO FINANCIERO (RIF) en el Estado de Resultados, en
// vez de dejarlas invisibles como el resto de la deuda MSI (que solo pega al
// Balance, no al Estado de Resultados, porque es financiamiento de mercancía
// que ya se costea aparte vía kardex).
window.abrirModalComisionBancaria = function(bancoPreseleccionado) {
    document.querySelector('[data-modal="comision-bancaria"]')?.remove();
    const tarjetasConfig = StorageService.get("tarjetasConfig", []);
    const bancos = [...new Set([
        ...tarjetasConfig.filter(t => !t.tipo || t.tipo === 'credito').map(t => t.banco),
        ...StorageService.get("cuentasMSI", []).map(c => c.banco)
    ].filter(Boolean))];
    const opcionesBancos = bancos.map(b => `<option value="${b}" ${b === bancoPreseleccionado ? 'selected' : ''}>💳 ${b}</option>`).join('');
    const hoyStr = typeof window.obtenerHoyInputMX === 'function' ? window.obtenerHoyInputMX() : new Date().toISOString().slice(0, 10);

    const html = `
    <div data-modal="comision-bancaria" style="position:fixed; inset:0; background:rgba(15,23,42,0.8); z-index:10000; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
        <div style="background:white; padding:28px; border-radius:16px; width:90%; max-width:380px; box-shadow:0 20px 25px rgba(0,0,0,0.2);">
            <h3 style="margin-top:0; color:#92400e;">🏷️ Agregar Comisión Bancaria</h3>
            <p style="font-size:12px; color:#64748b; margin-bottom:20px;">Anualidad, comisión por manejo de cuenta, IVA de comisión u otro cargo del banco que NO sea una mensualidad MSI. Se suma a la deuda de la tarjeta y se refleja como gasto financiero en el Estado de Resultados.</p>

            <label style="font-size:12px; font-weight:bold; color:#475569; display:block; margin-bottom:5px;">Tarjeta / Banco:</label>
            <select id="comisionBanco" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; margin-bottom:14px; font-weight:bold; box-sizing:border-box;">
                <option value="">-- Elige un banco --</option>
                ${opcionesBancos}
            </select>

            <label style="font-size:12px; font-weight:bold; color:#475569; display:block; margin-bottom:5px;">Monto:</label>
            <input type="number" id="comisionMonto" min="0.01" step="0.01" placeholder="0.00" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; margin-bottom:14px; box-sizing:border-box;">

            <label style="font-size:12px; font-weight:bold; color:#475569; display:block; margin-bottom:5px;">Fecha en que se causó:</label>
            <input type="date" id="comisionFecha" value="${hoyStr}" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; margin-bottom:14px; box-sizing:border-box;">

            <label style="font-size:12px; font-weight:bold; color:#475569; display:block; margin-bottom:5px;">Motivo (opcional):</label>
            <input type="text" id="comisionMotivo" placeholder="Ej. Anualidad, manejo de cuenta..." style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; margin-bottom:20px; box-sizing:border-box;">

            <div style="display:flex; gap:10px;">
                <button onclick="window.guardarComisionBancaria()" style="flex:2; padding:12px; background:#d97706; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:14px;">💾 Guardar</button>
                <button onclick="this.closest('[data-modal]').remove()" style="flex:1; padding:12px; background:#f1f5f9; border:none; border-radius:8px; cursor:pointer; color:#475569; font-weight:bold;">Cancelar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window.guardarComisionBancaria = function() {
    const banco = document.getElementById('comisionBanco')?.value;
    const monto = parseFloat(document.getElementById('comisionMonto')?.value);
    const fechaStr = document.getElementById('comisionFecha')?.value;
    const motivo = document.getElementById('comisionMotivo')?.value.trim() || '';

    if (!banco) return alert('⚠️ Selecciona a qué tarjeta/banco pertenece la comisión.');
    if (!Number.isFinite(monto) || monto <= 0) return alert('⚠️ Ingresa un monto válido.');
    if (!fechaStr) return alert('⚠️ Selecciona la fecha en que se causó la comisión.');

    const concepto = `Comisión bancaria${motivo ? ' - ' + motivo : ''}`;
    if (!confirm(`⚠️ COMISIÓN BANCARIA\n\nBanco: ${banco}\nMonto: ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(monto)}\nConcepto: ${concepto}\n\nSe sumará a la deuda de esta tarjeta y aparecerá como gasto financiero en el Estado de Resultados. ¿Confirmar?`)) return;

    const id = Date.now();
    const cuentasMSI = StorageService.get('cuentasMSI', []);
    cuentasMSI.push({
        id,
        compraId: id,
        banco,
        concepto,
        producto: concepto,
        total: monto,
        meses: 1,
        cuotaMensual: monto,
        fecha: fechaStr,
        fechaCompra: fechaStr,
        pagosRealizados: 0,
        esComisionBancaria: true,
        calendario: [{ n: 1, fecha: fechaStr, monto, estado: 'Pendiente', montoAbonado: 0, conciliado: false }]
    });
    StorageService.set('cuentasMSI', cuentasMSI);

    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'COMISION_BANCARIA_AGREGADA',
            modulo: 'Bancos', entidad: 'cuentaMSI', entidadId: id,
            detalle: `${concepto} — ${banco}`,
            monto, severidad: 'riesgo', datos: { banco, fecha: fechaStr, motivo }
        });
    }

    document.querySelector('[data-modal="comision-bancaria"]')?.remove();
    window._filtroMSIBanco = banco;
    alert('✅ Comisión bancaria registrada.');
    if (typeof renderConciliacionMSI === 'function') renderConciliacionMSI();
    if (typeof renderCuentasMSI === 'function') renderCuentasMSI();
    if (typeof window.renderDashboardMSI === 'function') window.renderDashboardMSI();
};

window.ejecutarReasignacionBanco = function(cuentaId) {
    let nuevoBanco = document.getElementById("nuevoBancoMSISelect").value;
    if (!nuevoBanco) {
        alert("❌ Por favor, selecciona un banco de la lista.");
        return;
    }

    let cuentasMSI = StorageService.get("cuentasMSI", []);
    let cuenta = cuentasMSI.find(c => String(c.id) === String(cuentaId));
    
    if (cuenta) {
        let bancoAnterior = cuenta.banco;
        
        if (bancoAnterior === nuevoBanco) {
            alert("⚠️ Seleccionaste el mismo banco que ya tiene asignado.");
            return;
        }

        // Aplicamos el cambio al registro raíz
        cuenta.banco = nuevoBanco;
        StorageService.set("cuentasMSI", cuentasMSI);
        
        document.getElementById('modalReasignarBanco').remove();
        
        alert(`✅ REASIGNACIÓN EXITOSA:\n\nLa compra pasó de "${bancoAnterior}" a "${nuevoBanco}".\n\nTodos los pagarés de esta compra ya reflejan el nuevo banco en el sistema.`);
        
        // Refrescamos la interfaz automáticamente
        if (typeof renderConciliacionMSI === 'function') renderConciliacionMSI();
        if (typeof renderCuentasMSI === 'function') renderCuentasMSI();
    }
};
window.renderConciliacion = renderConciliacionMSI;