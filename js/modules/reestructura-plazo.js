// ================================================================
// 🗓️ MÓDULO: REESTRUCTURA DE PLAZO PACTADO (CxC)
// Permite a un Admin modificar el plazo (meses/periodicidad) de una
// cuenta de crédito ACTIVA, reamortizando desde el CAPITAL ORIGINAL:
//
//   capital = totalContadoOriginal - engancheRecibido
//
// 1. Genera la tabla TEÓRICA completa de pagarés que correspondería
//    a ese capital bajo el plazo/periodicidad NUEVOS (mismo motor
//    CalculatorService.calcularCreditoConPeriodicidad que usa una
//    venta nueva).
// 2. Toma el total ya pagado hasta hoy (pagarés "Pagado"/"Parcial" +
//    abonos históricos, vía la misma regla que _cxcTotalPagadoPolitica)
//    y lo consume secuencialmente contra esa tabla teórica: las cuotas
//    que ya quedan cubiertas por lo pagado NO se generan como pagaré;
//    la primera cuota que no se cubre por completo se crea como
//    "Parcial" (con lo que le falta), y de ahí en adelante se generan
//    los pagarés "Pendiente" restantes como el nuevo calendario activo.
// 3. Todo esto ocurre dentro de una transacción atómica
//    (StorageService.transaccionRegistros, mismo patrón que
//    ejecutarAbonoAutorizadoReal) leyendo pagarés y cuenta FRESCOS,
//    para no pisar un abono aplicado desde otro dispositivo.
//
// Qué NO toca (a propósito):
//  - Pagarés ya "Pagado" (quedan como historial, ya no se recrean).
//  - cuenta.abonos: el historial de cobros queda intacto.
//  - cuenta.cargosMoratorios / _cxcEvaluarMoratorio: mecanismo aparte,
//    ya correcto, no se recalcula ni se cancela aquí.
//  - cuenta.saldosPorMes / cuenta.fechaVenta y por lo tanto
//    _cxcEvaluarPoliticaPagoAnticipado: esa política sigue anclada a la
//    venta original (lógica marcada como "no alterar").
//
// Solo Admin (_esAdmin()) puede abrir y confirmar esta acción.
// ================================================================

// Total pagado hasta hoy hacia el capital financiado (enganche NO
// cuenta aquí porque ya se restó del capital). Misma regla que
// _cxcTotalPagadoPolitica: máximo entre lo que reflejan los pagarés
// (Pagado + Parcial, nunca Cancelado) y lo que reflejan los abonos
// históricos de la cuenta.
function _reestructuraTotalPagado(pagaresDelFolio, cuenta) {
    const desdePagares = (pagaresDelFolio || []).reduce((s, p) => {
        const estado = String(p.estado || '').toLowerCase();
        if (estado === 'cancelado') return s;
        if (estado === 'pagado') return s + Number(p.montoAbonado || p.monto || 0);
        if (estado === 'parcial') return s + Number(p.montoAbonado || 0);
        return s;
    }, 0);
    const desdeAbonos = (cuenta?.abonos || [])
        .filter(a => !a.cancelado && !a.canceladoPorVenta && !a.canceladoPorApartado)
        .reduce((s, a) => s + Number(a.monto || a.montoAbonado || 0), 0);
    return Math.max(desdePagares, desdeAbonos);
}

function _reestructuraCapitalCuenta(cuenta) {
    const base = Number(cuenta?.totalContadoOriginal || cuenta?.totalMercancia || 0);
    const enganche = Number(cuenta?.engancheRecibido || 0);
    return Math.max(0, Number((base - enganche).toFixed(2)));
}

function _reestructuraPlanesDisponibles(capital, periodicidad) {
    const config = StorageService.get('configCreditoGlobal', null);
    if (!window.CalculatorService?.calcularCreditoConPeriodicidad) return [];
    return window.CalculatorService.calcularCreditoConPeriodicidad(capital, periodicidad, config);
}

// Genera los MONTOS teóricos (sin fechas ni ids) de las N cuotas de un
// plan, con el mismo redondeo/ajuste de la última cuota que usa
// ventas.js al crear una venta nueva.
function _reestructuraMontosTeoricos(plan) {
    const totalPagos = Math.max(1, Number(plan.pagos) || 1);
    const total = Math.max(0, Number(plan.total || 0));
    const abonoBase = Math.max(0, Number(plan.abono || 0));
    const montos = [];
    let acumulado = 0;
    for (let i = 1; i <= totalPagos; i++) {
        const monto = i === totalPagos
            ? Math.max(0, Number((total - acumulado).toFixed(2)))
            : Number(abonoBase.toFixed(2));
        acumulado = Number((acumulado + monto).toFixed(2));
        montos.push(monto);
    }
    return montos;
}

// Consume totalPagado contra la tabla teórica y regresa desde qué
// cuota (índice 0-based) arranca lo que realmente hay que generar
// como pagaré, y cuánto de esa primera cuota ya quedó cubierto
// (para dejarla como "Parcial" si aplica).
function _reestructuraConsumirPagado(montosTeoricos, totalPagado) {
    let restante = Number(totalPagado) || 0;
    let indiceInicio = 0;
    for (; indiceInicio < montosTeoricos.length; indiceInicio++) {
        const cuota = montosTeoricos[indiceInicio];
        if (restante >= cuota - 0.01) { restante -= cuota; continue; }
        break;
    }
    const montoAbonadoPrimeraPendiente = indiceInicio < montosTeoricos.length ? Math.max(0, Number(restante.toFixed(2))) : 0;
    return { indiceInicio, montoAbonadoPrimeraPendiente };
}

// Resumen para la simulación (modal) y para el resultado real dentro
// de la transacción: recibe el plan elegido y el total pagado, y
// regresa el saldo restante bajo el nuevo plazo + info de la próxima
// cuota.
function _reestructuraSimular(plan, totalPagado) {
    const montosTeoricos = _reestructuraMontosTeoricos(plan);
    const { indiceInicio, montoAbonadoPrimeraPendiente } = _reestructuraConsumirPagado(montosTeoricos, totalPagado);
    const pendientes = montosTeoricos.slice(indiceInicio);
    const saldoRestante = Number((pendientes.reduce((s, m) => s + m, 0) - montoAbonadoPrimeraPendiente).toFixed(2));
    const proximaEsParcial = montoAbonadoPrimeraPendiente > 0.01;
    const proximoMonto = pendientes.length ? pendientes[0] : 0;
    const proximoFaltante = proximaEsParcial ? Number((proximoMonto - montoAbonadoPrimeraPendiente).toFixed(2)) : proximoMonto;
    return {
        montosTeoricos, indiceInicio, montoAbonadoPrimeraPendiente,
        pagosRestantes: pendientes.length, saldoRestante,
        proximaEsParcial, proximoMonto, proximoFaltante
    };
}

// ==== Vista dedicada: Cobranza > Reestructurar Plazo ====
function renderReestructuraPlazo(filtroCliente = "") {
    const contenedor = document.getElementById("tablaReestructuraPlazo");
    if (!contenedor) return;

    if (!(typeof _esAdmin === 'function' && _esAdmin())) {
        contenedor.innerHTML = `<div style="background:#fee2e2; color:#991b1b; padding:20px; border-radius:10px; text-align:center; font-weight:bold;">Solo un administrador puede modificar el plazo pactado de una cuenta.</div>`;
        return;
    }

    filtroCliente = (filtroCliente || document.getElementById("filtroClienteReestructura")?.value || "").trim().toLowerCase();
    const cuentas = StorageService.get("cuentasPorCobrar", [])
        .filter(c => !(typeof _cxcCuentaCancelada === 'function' && _cxcCuentaCancelada(c)))
        .filter(c => String(c.estado || '').toLowerCase() !== 'saldado')
        .filter(c => c.metodo !== 'apartado');

    const filas = cuentas
        .filter(c => {
            const texto = `${_cxcNombreClienteVigente(c)} ${c.folio || ''}`.toLowerCase();
            return !filtroCliente || texto.includes(filtroCliente);
        })
        .sort((a, b) => _cxcNombreClienteVigente(a).localeCompare(_cxcNombreClienteVigente(b), 'es'));

    if (!filas.length) {
        contenedor.innerHTML = `<div style="background:#f8fafc; border:1px solid #e2e8f0; padding:28px; border-radius:10px; text-align:center; color:#64748b;">Sin cuentas de crédito activas para reestructurar.</div>`;
        return;
    }

    contenedor.innerHTML = `
        <div style="overflow-x:auto; background:white; border:1px solid #e5e7eb; border-radius:10px;">
            <table class="tabla-admin" style="margin:0;">
                <thead>
                    <tr>
                        <th>Cliente / Folio</th>
                        <th>Plazo actual</th>
                        <th>Saldo</th>
                        <th style="text-align:right;">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${filas.map(cuenta => {
                        const estado = typeof window._calcularEstadoCuenta === 'function' ? window._calcularEstadoCuenta(cuenta.folio) : null;
                        const saldo = estado?.saldoTotal ?? cuenta.saldoActual ?? 0;
                        return `
                        <tr>
                            <td><strong>${_cxcEscHTML(_cxcNombreClienteVigente(cuenta))}</strong><br><small style="color:#64748b;">${_cxcEscHTML(cuenta.folio)}</small></td>
                            <td>${Number(cuenta.plan?.meses || 0) || '—'} meses (${_cxcEscHTML(cuenta.periodicidad || 'semanal')})</td>
                            <td style="font-weight:800; color:#dc2626;">${_cxcDinero(saldo)}</td>
                            <td style="text-align:right;">
                                <button onclick="abrirModalReestructurarPlazo('${_cxcEscHTML(cuenta.folio)}')" style="padding:9px 13px; border:none; border-radius:7px; background:#7c3aed; color:white; font-weight:bold; cursor:pointer;">🗓️ Modificar plazo</button>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>`;
}
window.renderReestructuraPlazo = renderReestructuraPlazo;

window.abrirModalReestructurarPlazo = function (folio) {
    if (!(typeof _esAdmin === 'function' && _esAdmin())) {
        return alert("Solo un administrador puede modificar el plazo pactado de una cuenta.");
    }
    const cuentas = StorageService.get("cuentasPorCobrar", []);
    const cuenta = cuentas.find(c => c.folio === folio);
    if (!cuenta) return alert("No se encontró la cuenta.");
    if (typeof _cxcCuentaCancelada === 'function' && _cxcCuentaCancelada(cuenta)) {
        return alert("Esta cuenta está cancelada.");
    }
    if (String(cuenta.estado || '').toLowerCase() === 'saldado') {
        return alert("Esta cuenta ya está saldada, no tiene plazo que modificar.");
    }

    const abonosPend = StorageService.get("abonosPendientes", []).filter(a =>
        !String(a.estado || '').toLowerCase().includes('cancel') && a.folioCXC === folio
    );
    if (abonosPend.length) {
        return alert(`Esta cuenta tiene ${abonosPend.length} abono(s) pendiente(s) de autorización en la Bóveda. Resuélvelos antes de modificar el plazo.`);
    }

    const capital = _reestructuraCapitalCuenta(cuenta);
    if (capital <= 0.01) return alert("No se pudo determinar el capital original de esta cuenta (totalContadoOriginal - enganche).");

    const pagaresFolio = StorageService.get("pagaresSistema", []).filter(p => p.folio === folio);
    const totalPagado = _reestructuraTotalPagado(pagaresFolio, cuenta);
    const pendientesActuales = pagaresFolio.filter(p => p.estado === "Pendiente" || p.estado === "Parcial");

    const periodicidadActual = cuenta.periodicidad || "semanal";
    const planes = _reestructuraPlanesDisponibles(capital, periodicidadActual);
    if (!planes.length) return alert("No hay planes de crédito configurados. Revisa Configuración > Plazos de crédito.");

    const mesesActuales = Number(cuenta.plan?.meses || 0);
    const opciones = planes.map((p, i) =>
        `<option value="${i}" ${p.meses === mesesActuales ? 'selected' : ''}>${p.meses} meses - ${p.pagos} pagos de ${_cxcDinero(p.abono)}</option>`
    ).join('');

    const nombreCliente = typeof _cxcNombreClienteVigente === 'function' ? _cxcNombreClienteVigente(cuenta) : (cuenta.nombre || '');

    const modalHTML = `
    <div id="modalReestructurarPlazo" style="position:fixed; inset:0; background:rgba(15,23,42,0.85); z-index:99999; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
        <div style="background:white; padding:30px; border-radius:12px; width:90%; max-width:470px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); max-height:92vh; overflow-y:auto;">
            <h2 style="color:#1e40af; margin-top:0; border-bottom:2px solid #f1f5f9; padding-bottom:10px;">🗓️ Modificar Plazo Pactado</h2>

            <div style="font-size:13px; color:#475569; margin-bottom:14px; line-height:1.6;">
                Cliente: <strong>${_cxcEscHTML(nombreCliente)}</strong><br>
                Folio: <strong>${_cxcEscHTML(folio)}</strong><br>
                Plazo actual: <strong>${mesesActuales || '—'} meses</strong> (${pendientesActuales.length} pagaré(s) activo(s) hoy)
            </div>

            <div style="background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:14px; font-size:13px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span style="color:#64748b;">Capital original (contado − enganche):</span><strong>${_cxcDinero(capital)}</strong></div>
                <div style="display:flex; justify-content:space-between;"><span style="color:#64748b;">Total pagado a la fecha:</span><strong style="color:#10b981;">${_cxcDinero(totalPagado)}</strong></div>
            </div>

            <div style="margin-bottom:15px; background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">
                <label style="font-weight:bold; font-size:12px; color:#475569; display:block; margin-bottom:8px;">Periodicidad:</label>
                <select id="reestrPeriodicidadSelect" onchange="_reestructuraActualizarPlanes(${capital}, ${totalPagado})" style="width:100%; padding:12px; border-radius:6px; border:1px solid #cbd5e1; font-weight:bold; color:#1e40af; cursor:pointer; margin-bottom:10px;">
                    <option value="semanal" ${periodicidadActual === 'semanal' ? 'selected' : ''}>Semanal</option>
                    <option value="quincenal" ${periodicidadActual === 'quincenal' ? 'selected' : ''}>Quincenal</option>
                    <option value="mensual" ${periodicidadActual === 'mensual' ? 'selected' : ''}>Mensual</option>
                </select>
                <label style="font-weight:bold; font-size:12px; color:#475569; display:block; margin-bottom:8px;">Nuevo plazo:</label>
                <select id="reestrPlazoSelect" onchange="_reestructuraCalcularSimulacion(${totalPagado})" style="width:100%; padding:12px; border-radius:6px; border:1px solid #cbd5e1; font-weight:bold; color:#1e40af; cursor:pointer;">
                    ${opciones}
                </select>
            </div>

            <div id="reestrResumen" style="margin-bottom:20px;"></div>

            <div style="background:#fee2e2; color:#991b1b; padding:10px; border-radius:6px; font-size:12px; margin-bottom:20px; line-height:1.5;">
                Se recalcula la tabla completa de pagarés del nuevo plazo sobre el capital original, se le aplica lo ya pagado, y se generan solo los pagarés que quedan por cobrar (el que resulte a medias queda como "Parcial"). Los pagarés "Pagado" no se tocan; los "Pendiente"/"Parcial" actuales se cancelan y se reemplazan. Queda registrado en auditoría.
            </div>

            <div style="display:flex; gap:10px;">
                <button onclick="confirmarReestructurarPlazo('${_cxcEscHTML(folio)}')" style="flex:2; padding:14px; background:#2563eb; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer; font-size:14px;">✅ Confirmar Nuevo Plazo</button>
                <button onclick="document.getElementById('modalReestructurarPlazo').remove()" style="flex:1; padding:14px; background:#e2e8f0; color:#475569; border:none; border-radius:6px; font-weight:bold; cursor:pointer; font-size:14px;">Cancelar</button>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    window._reestrPlanesDisponibles = planes;
    window._reestrPeriodicidad = periodicidadActual;
    window._reestrCapital = capital;
    _reestructuraCalcularSimulacion(totalPagado);
};

window._reestructuraActualizarPlanes = function (capital, totalPagado) {
    const periodicidad = document.getElementById("reestrPeriodicidadSelect")?.value || "semanal";
    const planes = _reestructuraPlanesDisponibles(capital, periodicidad);
    const sel = document.getElementById("reestrPlazoSelect");
    if (!sel) return;
    window._reestrPlanesDisponibles = planes;
    window._reestrPeriodicidad = periodicidad;
    window._reestrCapital = capital;
    sel.innerHTML = planes.length === 0
        ? '<option value="">Sin planes disponibles</option>'
        : planes.map((p, i) => `<option value="${i}">${p.meses} meses - ${p.pagos} pagos de ${_cxcDinero(p.abono)}</option>`).join('');
    _reestructuraCalcularSimulacion(totalPagado);
};

window._reestructuraCalcularSimulacion = function (totalPagado) {
    const resumen = document.getElementById("reestrResumen");
    if (!resumen) return;
    const idx = document.getElementById("reestrPlazoSelect")?.value;
    const plan = (window._reestrPlanesDisponibles || [])[idx];
    if (!plan) {
        resumen.innerHTML = `<div style="color:#991b1b; background:#fee2e2; padding:12px; border-radius:8px;">No hay plan seleccionado.</div>`;
        return;
    }
    const sim = _reestructuraSimular(plan, totalPagado);
    const periodicidadTxt = { semanal: "semanales", quincenal: "quincenales", mensual: "mensuales" }[window._reestrPeriodicidad || "semanal"] || "semanales";

    if (sim.saldoRestante <= 0.01) {
        resumen.innerHTML = `<div style="background:#dcfce7; color:#166534; padding:12px; border-radius:8px; font-size:13px;"><b>Con este plazo, lo ya pagado cubre el total.</b> La cuenta quedaría saldada, sin generar pagarés nuevos.</div>`;
        return;
    }

    const proximaLinea = sim.proximaEsParcial
        ? `Próximo pagaré: <strong>PARCIAL</strong>, faltan ${_cxcDinero(sim.proximoFaltante)} de ${_cxcDinero(sim.proximoMonto)}`
        : `Próximo pagaré: <strong>${_cxcDinero(sim.proximoMonto)}</strong>`;

    resumen.innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:13px;">
            <span style="color:#64748b;">Total del nuevo plazo (capital + interés):</span>
            <strong>${_cxcDinero(plan.total)}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:15px; font-size:15px; border-bottom:1px dashed #cbd5e1; padding-bottom:12px;">
            <span style="font-weight:bold; color:#0f172a;">Saldo pendiente resultante:</span>
            <strong style="color:#1e40af; font-size:18px;">${_cxcDinero(sim.saldoRestante)}</strong>
        </div>
        <div style="text-align:center; background:#eff6ff; padding:15px; border-radius:8px; border:2px solid #bfdbfe;">
            <div style="font-size:11px; font-weight:bold; text-transform:uppercase; color:#1d4ed8; margin-bottom:4px;">${sim.pagosRestantes} pago(s) ${periodicidadTxt} por generar</div>
            <div style="font-size:15px; font-weight:900; color:#1e40af;">${proximaLinea}</div>
        </div>`;
};

window.confirmarReestructurarPlazo = async function (folio) {
    if (!(typeof _esAdmin === 'function' && _esAdmin())) {
        return alert("Solo un administrador puede modificar el plazo pactado de una cuenta.");
    }
    const idx = document.getElementById("reestrPlazoSelect")?.value;
    const periodicidad = document.getElementById("reestrPeriodicidadSelect")?.value || window._reestrPeriodicidad || "semanal";
    const planElegido = (window._reestrPlanesDisponibles || [])[idx];
    if (!planElegido) return alert("Selecciona un plazo válido.");

    const capitalVista = window._reestrCapital || 0;

    if (!confirm(`⚠️ MODIFICAR PLAZO PACTADO\n\nFolio: ${folio}\nCapital original: ${_cxcDinero(capitalVista)}\nNuevo plazo: ${planElegido.meses} meses\nNuevo total (capital + interés): ${_cxcDinero(planElegido.total)}\n\nSe recalculará la tabla completa del nuevo plazo, se le aplicará lo ya pagado, y se reemplazarán los pagarés pendientes/parciales actuales por los que resulten. Esta acción queda registrada en auditoría.\n\n¿Confirmas?`)) {
        return;
    }

    const btn = document.querySelector('#modalReestructurarPlazo button[onclick^="confirmarReestructurarPlazo"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Procesando…'; btn.style.opacity = '0.6'; btn.style.cursor = 'not-allowed'; }

    const idsPagaresCandidatos = StorageService.get("pagaresSistema", [])
        .filter(p => p.folio === folio)
        .map(p => p.id);

    const fechaObj = new Date();
    const fechaIso = window.localISO ? window.localISO(fechaObj) : fechaObj.toISOString();
    const fechaStr = window.formatearFechaCortaMX ? window.formatearFechaCortaMX(fechaObj) : fechaObj.toLocaleDateString('es-MX');
    const usuarioActual = window.usuarioActivo?.nombre || window._usuarioActual?.nombre || 'Admin';
    const diasIntervalo = periodicidad === "quincenal" ? 14 : periodicidad === "mensual" ? 30 : 7;

    const lecturas = [
        { tabla: 'cuentasPorCobrar', clave: folio },
        ...idsPagaresCandidatos.map(id => ({ tabla: 'pagaresSistema', clave: id }))
    ];

    const reactivarBoton = () => {
        if (btn) { btn.disabled = false; btn.textContent = '✅ Confirmar Nuevo Plazo'; btn.style.opacity = ''; btn.style.cursor = 'pointer'; }
    };

    let resultadoTx;
    try {
        resultadoTx = await StorageService.transaccionRegistros(lecturas, (frescos) => {
            const cuentaFresca = frescos[`cuentasPorCobrar:${folio}`];
            if (!cuentaFresca) return null;
            if (typeof _cxcCuentaCancelada === 'function' && _cxcCuentaCancelada(cuentaFresca)) return null;

            const pagaresFrescos = idsPagaresCandidatos
                .map(id => frescos[`pagaresSistema:${id}`])
                .filter(p => p && p.folio === folio);

            const capitalFresco = _reestructuraCapitalCuenta(cuentaFresca);
            if (capitalFresco <= 0.01) return null;

            const totalPagadoFresco = _reestructuraTotalPagado(pagaresFrescos, cuentaFresca);
            const sim = _reestructuraSimular(planElegido, totalPagadoFresco);

            // Cancela los pagarés Pendiente/Parcial vigentes (los Pagado no se tocan)
            const pendientesFrescos = pagaresFrescos.filter(p => p.estado === "Pendiente" || p.estado === "Parcial");
            const pagaresEscritura = pendientesFrescos.map(p => ({
                tabla: 'pagaresSistema', clave: p.id,
                data: { ...p, estado: "Cancelado", nota: `Reestructurado - plazo modificado a ${planElegido.meses} meses (${fechaStr})` }
            }));

            const nombreCliente = typeof _cxcNombreClienteVigente === 'function' ? _cxcNombreClienteVigente(cuentaFresca) : cuentaFresca.nombre;

            // Genera solo los pagarés que quedan por cobrar bajo la tabla nueva
            const pendientesTeoricos = sim.montosTeoricos.slice(sim.indiceInicio);
            const fechaPago = new Date(fechaObj);
            const pagaresNuevos = pendientesTeoricos.map((monto, i) => {
                fechaPago.setDate(fechaPago.getDate() + diasIntervalo);
                const esPrimeraYParcial = i === 0 && sim.proximaEsParcial;
                const idNuevo = Date.now() + i + 1 + Math.floor(Math.random() * 1000);
                return {
                    id: idNuevo, folio,
                    numeroPagere: `${folio}-R${sim.indiceInicio + i + 1}/${sim.montosTeoricos.length}`,
                    clienteNombre: nombreCliente, clienteId: cuentaFresca.clienteId,
                    fechaEmision: fechaIso, fechaVencimiento: fechaPago.getTime(),
                    monto: monto,
                    estado: esPrimeraYParcial ? "Parcial" : "Pendiente",
                    montoAbonado: esPrimeraYParcial ? sim.montoAbonadoPrimeraPendiente : 0,
                    diasAtrasoActual: 0
                };
            });
            pagaresNuevos.forEach(p => pagaresEscritura.push({ tabla: 'pagaresSistema', clave: p.id, data: p }));

            const planNuevoFinal = { ...planElegido };
            const totalMoratorios = typeof _cxcTotalMoratoriosPendientes === 'function' ? _cxcTotalMoratoriosPendientes(cuentaFresca) : 0;

            const cuentaAct = { ...cuentaFresca };
            cuentaAct.plan = planNuevoFinal;
            cuentaAct.periodicidad = periodicidad;
            cuentaAct.saldoActual = Number((sim.saldoRestante + totalMoratorios).toFixed(2));
            if (sim.saldoRestante <= 0.01) cuentaAct.estado = "Saldado";
            cuentaAct.historialReestructuras = [...(cuentaFresca.historialReestructuras || []), {
                fecha: fechaIso,
                usuario: usuarioActual,
                planAnterior: cuentaFresca.plan || null,
                periodicidadAnterior: cuentaFresca.periodicidad || null,
                capitalOriginal: capitalFresco,
                totalPagadoAlMomento: totalPagadoFresco,
                planNuevo: planNuevoFinal,
                periodicidadNueva: periodicidad,
                pagosCubiertosPorPagoPrevio: sim.indiceInicio,
                saldoResultante: sim.saldoRestante
            }];

            return {
                escrituras: [{ tabla: 'cuentasPorCobrar', clave: folio, data: cuentaAct }, ...pagaresEscritura],
                resultado: { ok: true, saldoRestante: sim.saldoRestante, pagosGenerados: pagaresNuevos.length, saldado: sim.saldoRestante <= 0.01 }
            };
        });
    } catch (e) {
        console.error('[reestructura-plazo] transacción falló:', e);
        alert("No se pudo modificar el plazo: error al escribir los cambios. Nada quedó a medias; intenta de nuevo.");
        reactivarBoton();
        return;
    }

    if (!resultadoTx || !resultadoTx.ok) {
        alert("No se pudo modificar el plazo: la cuenta fue cancelada o cambió justo antes de confirmar. Refresca la pantalla e intenta de nuevo.");
        reactivarBoton();
        return;
    }

    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'REESTRUCTURA_PLAZO_CXC',
            modulo: 'CxC',
            entidad: 'cuentaPorCobrar',
            entidadId: folio,
            detalle: `Plazo modificado a ${planElegido.meses} meses (${periodicidad})`,
            monto: resultadoTx.saldoRestante,
            severidad: 'riesgo',
            datos: {
                usuario: usuarioActual,
                capitalOriginal: capitalVista,
                nuevoPlazoMeses: planElegido.meses,
                nuevaPeriodicidad: periodicidad,
                saldoRestante: resultadoTx.saldoRestante,
                pagosGenerados: resultadoTx.pagosGenerados
            }
        });
    }

    document.getElementById('modalReestructurarPlazo')?.remove();
    alert(resultadoTx.saldado
        ? `✅ Plazo modificado.\n\nCon lo ya pagado, la cuenta quedó SALDADA bajo el nuevo plazo. No se generaron pagarés nuevos.`
        : `✅ Plazo modificado.\n\nNuevo plazo: ${planElegido.meses} meses\nSaldo pendiente: ${_cxcDinero(resultadoTx.saldoRestante)}\nSe generaron ${resultadoTx.pagosGenerados} pagaré(s) nuevo(s).`);

    if (typeof renderCuentasXCobrar === 'function') renderCuentasXCobrar();
    if (typeof renderAbonosDirectos === 'function') renderAbonosDirectos();
    if (typeof renderReestructuraPlazo === 'function') renderReestructuraPlazo();
};

console.log('✅ Módulo reestructura-plazo.js cargado — modificación de plazo pactado en CxC (reamortización desde capital original).');
