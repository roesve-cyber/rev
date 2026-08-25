// ================================================================
// 💸 MÓDULO: CONDONAR DEUDA (Auditoría)
// Permite a un Admin perdonar el saldo pendiente de una venta a
// crédito (total o parcial). Deja rastro completo en la cuenta y en
// AuditService — es un movimiento contable de baja, no un cobro.
//
// Reglas:
//  - Solo Admin.
//  - Condonación TOTAL (monto = saldo total de pagarés): cancela
//    todos los pagarés Pendiente/Parcial vigentes, cuenta pasa a
//    estado "Saldado" con condonado:true.
//  - Condonación PARCIAL (monto < saldo total): se perdona desde el
//    ÚLTIMO pagaré hacia atrás (la cola del calendario) — se cancelan
//    los pagarés finales que el monto alcance a cubrir, y si sobra un
//    remanente se recorta (reduce) el monto del pagaré límite. Los
//    pagarés más próximos a vencer NO se tocan.
//  - Opcional: incluir moratorios pendientes en la condonación (se
//    marcan como pagados/condonados, no se eliminan del historial).
//  - Los pagarés ya "Pagado" y cuenta.abonos NUNCA se tocan.
//  - Todo ocurre en una transacción atómica (StorageService.
//    transaccionRegistros, mismo patrón que ejecutarAbonoAutorizadoReal
//    y reestructura-plazo.js) leyendo cuenta y pagarés FRESCOS.
// ================================================================

function _condonarCuentasActivas(filtro) {
    filtro = (filtro || '').trim().toLowerCase();
    const cuentas = StorageService.get("cuentasPorCobrar", [])
        .filter(c => !(typeof _cxcCuentaCancelada === 'function' && _cxcCuentaCancelada(c)))
        .filter(c => String(c.estado || '').toLowerCase() !== 'saldado');
    return cuentas
        .map(cuenta => ({ cuenta, estado: typeof window._calcularEstadoCuenta === 'function' ? window._calcularEstadoCuenta(cuenta.folio) : null }))
        .filter(x => (x.estado?.saldoTotal ?? x.cuenta.saldoActual ?? 0) > 0.01)
        .filter(x => {
            if (!filtro) return true;
            const texto = `${_cxcNombreClienteVigente(x.cuenta)} ${x.cuenta.folio || ''}`.toLowerCase();
            return texto.includes(filtro);
        })
        .sort((a, b) => _cxcNombreClienteVigente(a.cuenta).localeCompare(_cxcNombreClienteVigente(b.cuenta), 'es'));
}

// Saldo de pagarés (capital+interés pendiente, SIN moratorios) a partir
// de los pagarés Pendiente/Parcial vigentes.
function _condonarSaldoPagares(folio) {
    const pendientes = StorageService.get("pagaresSistema", [])
        .filter(p => p.folio === folio && (p.estado === "Pendiente" || p.estado === "Parcial"));
    const saldo = pendientes.reduce((s, p) => s + Math.max(0, Number(p.monto || 0) - Number(p.montoAbonado || 0)), 0);
    return { pendientes, saldo: Number(saldo.toFixed(2)) };
}

window.abrirModalCondonarDeuda = function () {
    if (!(typeof _esAdmin === 'function' && _esAdmin())) {
        if (window.AuditService?.log) {
            window.AuditService.log({ accion: 'ACCESO_DENEGADO', modulo: 'Seguridad', entidad: 'Condonar deuda', detalle: 'Intento de abrir condonación de deuda sin rol admin', severidad: 'alerta' });
        }
        return alert("⛔ ACCESO DENEGADO: Solo Administradores pueden condonar deuda.");
    }
    document.querySelector('[data-modal="condonar-deuda"]')?.remove();
    const modalHTML = `
    <div data-modal="condonar-deuda" style="position:fixed; inset:0; background:rgba(15,23,42,0.9); z-index:99999; display:flex; justify-content:center; align-items:flex-start; overflow-y:auto; padding:20px; backdrop-filter: blur(5px);">
        <div style="background:white; padding:30px; border-radius:12px; width:100%; max-width:520px; margin-top:40px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); max-height:92vh; overflow-y:auto;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #b91c1c; padding-bottom:15px; margin-bottom:20px;">
                <div>
                    <h2 style="margin:0; color:#991b1b; font-size:22px;">💸 Condonar Deuda</h2>
                    <p style="margin:0; color:#64748b; font-size:13px;">Perdona el saldo pendiente de una cuenta a crédito. Solo Admin.</p>
                </div>
                <button onclick="document.querySelector('[data-modal=&quot;condonar-deuda&quot;]')?.remove()" style="background:#f1f5f9; border:none; padding:8px 15px; border-radius:6px; cursor:pointer; font-weight:bold; color:#475569;">✕ Cerrar</button>
            </div>
            <div id="condonarCuerpo"></div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    _condonarMostrarBusqueda();
};

function _condonarMostrarBusqueda() {
    const cuerpo = document.getElementById("condonarCuerpo");
    if (!cuerpo) return;
    cuerpo.innerHTML = `
        <div style="margin-bottom:14px;">
            <input type="text" id="condonarBuscador" placeholder="Buscar cliente o folio..." onkeyup="_condonarActualizarLista()" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px; box-sizing:border-box;">
        </div>
        <div id="condonarListaResultados"></div>`;
    _condonarActualizarLista();
}

window._condonarActualizarLista = function () {
    const lista = document.getElementById("condonarListaResultados");
    if (!lista) return;
    const filtro = document.getElementById("condonarBuscador")?.value || '';
    const resultados = _condonarCuentasActivas(filtro).slice(0, 30);
    if (!resultados.length) {
        lista.innerHTML = `<div style="background:#f8fafc; border:1px solid #e2e8f0; padding:18px; border-radius:8px; text-align:center; color:#64748b; font-size:13px;">Sin cuentas con saldo pendiente que coincidan.</div>`;
        return;
    }
    lista.innerHTML = resultados.map(({ cuenta, estado }) => {
        const saldo = estado?.saldoTotal ?? cuenta.saldoActual ?? 0;
        return `
        <div onclick="_condonarAbrirFormulario('${_cxcEscHTML(cuenta.folio)}')" style="cursor:pointer; padding:12px; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;" onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='white'">
            <div>
                <strong>${_cxcEscHTML(_cxcNombreClienteVigente(cuenta))}</strong><br>
                <small style="color:#64748b;">${_cxcEscHTML(cuenta.folio)}</small>
            </div>
            <strong style="color:#dc2626;">${_cxcDinero(saldo)}</strong>
        </div>`;
    }).join('');
};

window._condonarAbrirFormulario = function (folio) {
    const cuerpo = document.getElementById("condonarCuerpo");
    if (!cuerpo) return;
    const cuentas = StorageService.get("cuentasPorCobrar", []);
    const cuenta = cuentas.find(c => c.folio === folio);
    if (!cuenta) return alert("No se encontró la cuenta.");

    const { saldo: saldoPagares } = _condonarSaldoPagares(folio);
    const saldoMoratorios = typeof _cxcTotalMoratoriosPendientes === 'function' ? _cxcTotalMoratoriosPendientes(cuenta) : 0;
    const nombreCliente = typeof _cxcNombreClienteVigente === 'function' ? _cxcNombreClienteVigente(cuenta) : (cuenta.nombre || '');

    cuerpo.innerHTML = `
        <button onclick="_condonarMostrarBusqueda()" style="background:none; border:none; color:#2563eb; font-weight:bold; cursor:pointer; padding:0; margin-bottom:14px; font-size:13px;">← Buscar otra cuenta</button>

        <div style="font-size:13px; color:#475569; margin-bottom:14px; line-height:1.6;">
            Cliente: <strong>${_cxcEscHTML(nombreCliente)}</strong><br>
            Folio: <strong>${_cxcEscHTML(folio)}</strong>
        </div>

        <div style="background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:14px; font-size:13px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span style="color:#64748b;">Saldo de pagarés (capital + interés):</span><strong>${_cxcDinero(saldoPagares)}</strong></div>
            <div style="display:flex; justify-content:space-between;"><span style="color:#64748b;">Moratorios pendientes:</span><strong>${_cxcDinero(saldoMoratorios)}</strong></div>
        </div>

        <div style="margin-bottom:15px;">
            <label style="font-weight:bold; font-size:12px; color:#475569; display:block; margin-bottom:6px;">💰 Monto a condonar ($):</label>
            <input type="number" id="condonarMonto" min="0.01" max="${saldoPagares}" step="0.01" value="${saldoPagares}" style="width:100%; padding:10px; border-radius:6px; border:2px solid #b91c1c; font-weight:bold; text-align:center; box-sizing:border-box; font-size:16px;">
            <small style="color:#64748b; font-size:11px;">Si dejas el monto igual al saldo, se condona TODO y la cuenta queda saldada. Si pones menos, se perdonan los últimos pagos (la cola del calendario); los próximos a vencer no se tocan.</small>
        </div>

        ${saldoMoratorios > 0.01 ? `
        <div style="margin-bottom:15px; background:#fff7ed; border:1px solid #fed7aa; padding:10px; border-radius:8px;">
            <label style="font-size:13px; font-weight:bold; color:#9a3412; display:flex; align-items:center; gap:8px; cursor:pointer;">
                <input type="checkbox" id="condonarIncluirMoratorios" style="width:16px; height:16px;">
                También condonar los ${_cxcDinero(saldoMoratorios)} de moratorios pendientes
            </label>
        </div>` : ''}

        <div style="margin-bottom:20px;">
            <label style="font-weight:bold; font-size:12px; color:#475569; display:block; margin-bottom:6px;">📝 Motivo (obligatorio):</label>
            <textarea id="condonarMotivo" placeholder="Ej: Acuerdo con el cliente por situación económica, aprobado por..." style="width:100%; padding:10px; border-radius:6px; border:1px solid #cbd5e1; box-sizing:border-box; resize:vertical; min-height:80px;"></textarea>
        </div>

        <div style="background:#fef2f2; border:1px solid #fca5a5; padding:12px; border-radius:8px; margin-bottom:20px; font-size:12px; color:#991b1b; line-height:1.5;">
            ⚠️ Esta acción reduce el saldo por cobrar de forma permanente (no es un pago real). Cancela los pagarés que se condonen y queda registrada en auditoría con tu usuario, fecha y motivo.
        </div>

        <button onclick="confirmarCondonarDeuda('${_cxcEscHTML(folio)}')" style="width:100%; background:#b91c1c; color:white; border:none; padding:14px; border-radius:8px; font-size:16px; font-weight:bold; cursor:pointer;">
            💾 Confirmar Condonación
        </button>`;
};

window.confirmarCondonarDeuda = async function (folio) {
    if (!(typeof _esAdmin === 'function' && _esAdmin())) {
        return alert("Solo un administrador puede condonar deuda.");
    }
    const montoInput = parseFloat(document.getElementById("condonarMonto")?.value);
    const incluirMoratorios = document.getElementById("condonarIncluirMoratorios")?.checked || false;
    const motivo = (document.getElementById("condonarMotivo")?.value || '').trim();

    if (isNaN(montoInput) || montoInput <= 0) return alert("Ingresa un monto de condonación válido.");
    if (!motivo) return alert("El motivo es obligatorio para condonar deuda.");

    const { saldo: saldoPagaresVista } = _condonarSaldoPagares(folio);
    if (montoInput > saldoPagaresVista + 0.01) return alert(`El monto no puede ser mayor al saldo de pagarés (${_cxcDinero(saldoPagaresVista)}).`);

    const esTotal = montoInput >= saldoPagaresVista - 0.01;
    if (!confirm(`⚠️ CONDONAR DEUDA\n\nFolio: ${folio}\nMonto a condonar: ${_cxcDinero(montoInput)}${incluirMoratorios ? ' + moratorios' : ''}\n${esTotal ? 'La cuenta quedará SALDADA.' : 'Se perdonan los últimos pagos del calendario.'}\nMotivo: ${motivo}\n\nEsta acción NO se puede deshacer sola (quedaría que reestructurar o ajustar de nuevo). ¿Confirmas?`)) {
        return;
    }

    const btn = document.querySelector('#condonarCuerpo button[onclick^="confirmarCondonarDeuda"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Procesando…'; btn.style.opacity = '0.6'; btn.style.cursor = 'not-allowed'; }

    const idsPagaresCandidatos = StorageService.get("pagaresSistema", [])
        .filter(p => p.folio === folio)
        .map(p => p.id);

    const fechaObj = new Date();
    const fechaIso = window.localISO ? window.localISO(fechaObj) : fechaObj.toISOString();
    const fechaStr = window.formatearFechaCortaMX ? window.formatearFechaCortaMX(fechaObj) : fechaObj.toLocaleDateString('es-MX');
    const usuarioActual = window.usuarioActivo?.nombre || window._usuarioActual?.nombre || 'Admin';

    const lecturas = [
        { tabla: 'cuentasPorCobrar', clave: folio },
        ...idsPagaresCandidatos.map(id => ({ tabla: 'pagaresSistema', clave: id }))
    ];

    const reactivarBoton = () => {
        if (btn) { btn.disabled = false; btn.textContent = '💾 Confirmar Condonación'; btn.style.opacity = ''; btn.style.cursor = 'pointer'; }
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

            const pendientesFrescos = pagaresFrescos.filter(p => p.estado === "Pendiente" || p.estado === "Parcial");
            const saldoFresco = Number(pendientesFrescos.reduce((s, p) => s + Math.max(0, Number(p.monto || 0) - Number(p.montoAbonado || 0)), 0).toFixed(2));
            if (saldoFresco <= 0.01) return null;

            const montoCondonar = Math.min(montoInput, saldoFresco);

            // Ordena de más reciente vencimiento a más próximo (perdona la cola primero)
            const ordenDesc = [...pendientesFrescos].sort((a, b) => Number(b.fechaVencimiento || 0) - Number(a.fechaVencimiento || 0));
            let restante = montoCondonar;
            const pagaresEscritura = [];
            for (const p of ordenDesc) {
                if (restante <= 0.01) break;
                const pendienteP = Math.max(0, Number(p.monto || 0) - Number(p.montoAbonado || 0));
                if (pendienteP <= restante + 0.01) {
                    // Se condona completo
                    restante = Number((restante - pendienteP).toFixed(2));
                    pagaresEscritura.push({
                        tabla: 'pagaresSistema', clave: p.id,
                        data: { ...p, estado: "Cancelado", nota: `Condonado ${_cxcDinero(pendienteP)} (${fechaStr}). Motivo: ${motivo}` }
                    });
                } else {
                    // Se recorta el monto de este pagaré (queda con lo no condonado)
                    const nuevoMonto = Number((Number(p.monto || 0) - restante).toFixed(2));
                    restante = 0;
                    pagaresEscritura.push({
                        tabla: 'pagaresSistema', clave: p.id,
                        data: { ...p, monto: nuevoMonto, nota: `${p.nota ? p.nota + ' | ' : ''}Recortado por condonación parcial de ${_cxcDinero(montoCondonar)} (${fechaStr})` }
                    });
                }
            }

            let totalMoratorios = typeof _cxcTotalMoratoriosPendientes === 'function' ? _cxcTotalMoratoriosPendientes(cuentaFresca) : 0;
            let cargosMoratoriosAct = cuentaFresca.cargosMoratorios || [];
            let moratoriosCondonados = 0;
            if (incluirMoratorios && totalMoratorios > 0.01) {
                cargosMoratoriosAct = cargosMoratoriosAct.map(m => {
                    if (m.cancelado || m.anulado || String(m.tipo || 'cargo') === 'exencion') return m;
                    const pendiente = Math.max(0, Number(m.monto || 0) - Number(m.montoAbonado || 0));
                    if (pendiente <= 0.01) return m;
                    moratoriosCondonados = Number((moratoriosCondonados + pendiente).toFixed(2));
                    return { ...m, montoAbonado: Number(m.monto || 0), estado: "Pagado", nota: `${m.nota ? m.nota + ' | ' : ''}Condonado (${fechaStr})` };
                });
                totalMoratorios = 0;
            }

            const saldoPagaresRestante = Number((saldoFresco - montoCondonar).toFixed(2));
            const saldoTotalNuevo = Number((saldoPagaresRestante + totalMoratorios).toFixed(2));

            const cuentaAct = { ...cuentaFresca };
            cuentaAct.cargosMoratorios = cargosMoratoriosAct;
            cuentaAct.saldoActual = saldoTotalNuevo;
            if (saldoTotalNuevo <= 0.01) {
                cuentaAct.estado = "Saldado";
                cuentaAct.condonado = true;
                cuentaAct.condonadoFecha = fechaIso;
                cuentaAct.condonadoMotivo = motivo;
                cuentaAct.condonadoPor = usuarioActual;
            }
            cuentaAct.historialCondonaciones = [...(cuentaFresca.historialCondonaciones || []), {
                fecha: fechaIso,
                usuario: usuarioActual,
                montoCondonadoPagares: montoCondonar,
                moratoriosCondonados,
                motivo,
                saldoAntes: saldoFresco + (typeof _cxcTotalMoratoriosPendientes === 'function' ? _cxcTotalMoratoriosPendientes(cuentaFresca) : 0),
                saldoDespues: saldoTotalNuevo
            }];

            return {
                escrituras: [{ tabla: 'cuentasPorCobrar', clave: folio, data: cuentaAct }, ...pagaresEscritura],
                resultado: { ok: true, montoCondonar, moratoriosCondonados, saldoTotalNuevo, saldado: saldoTotalNuevo <= 0.01 }
            };
        });
    } catch (e) {
        console.error('[condonar-deuda] transacción falló:', e);
        alert("No se pudo condonar: error al escribir los cambios. Nada quedó a medias; intenta de nuevo.");
        reactivarBoton();
        return;
    }

    if (!resultadoTx || !resultadoTx.ok) {
        alert("No se pudo condonar: la cuenta fue cancelada, ya no tiene saldo pendiente, o cambió justo antes de confirmar. Refresca e intenta de nuevo.");
        reactivarBoton();
        return;
    }

    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'CONDONACION_DEUDA',
            modulo: 'CxC',
            entidad: 'cuentaPorCobrar',
            entidadId: folio,
            detalle: `Condonación de ${_cxcDinero(resultadoTx.montoCondonar)}${resultadoTx.moratoriosCondonados > 0.01 ? ` + ${_cxcDinero(resultadoTx.moratoriosCondonados)} de moratorios` : ''}. Motivo: ${motivo}`,
            monto: resultadoTx.montoCondonar,
            severidad: 'riesgo',
            datos: {
                usuario: usuarioActual,
                motivo,
                saldoResultante: resultadoTx.saldoTotalNuevo,
                saldado: resultadoTx.saldado
            }
        });
    }

    document.querySelector('[data-modal="condonar-deuda"]')?.remove();
    alert(resultadoTx.saldado
        ? `✅ Deuda condonada.\n\nLa cuenta quedó SALDADA.`
        : `✅ Deuda condonada.\n\nSaldo restante: ${_cxcDinero(resultadoTx.saldoTotalNuevo)}`);

    if (typeof renderCuentasXCobrar === 'function') renderCuentasXCobrar();
    if (typeof renderAbonosDirectos === 'function') renderAbonosDirectos();
    if (typeof renderReestructuraPlazo === 'function') renderReestructuraPlazo();
};

console.log('✅ Módulo condonar-deuda.js cargado — condonación de saldo en CxC (Auditoría).');
