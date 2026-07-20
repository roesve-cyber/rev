// ===== APARTADOS: Seguimiento y gestión =====

function _apartadoAbonosVigentes(ap) {
    return (ap?.abonos || []).filter(a => !a.cancelado && !a.canceladoPorVenta && !a.canceladoPorApartado);
}

function _apartadoTotalPagado(ap) {
    return (Number(ap?.enganche || 0) || 0) + _apartadoAbonosVigentes(ap).reduce((s, ab) => s + (Number(ab.monto) || 0), 0);
}

function _apartadoSaldoReal(ap) {
    const estado = String(ap?.estado || '').toLowerCase();
    if (estado.includes('migrado') || estado.includes('conversion') || estado.includes('cancel')) return Number(ap?.saldoPendiente || 0) || 0;
    return Math.max(0, (Number(ap?.importeApartado || ap?.total || 0) || 0) - _apartadoTotalPagado(ap));
}

function _apartadoCuentaDefault() {
    const cajas = StorageService.get("cuentasEfectivo", []);
    const primera = Array.isArray(cajas) && cajas.length ? cajas[0] : null;
    return {
        cuentaId: primera?.id || "efectivo",
        etiqueta: primera?.nombre || "Efectivo"
    };
}

function _apartadoNombreCliente(ap) {
    if (typeof window.obtenerClienteCanonico === 'function') {
        const canonico = window.obtenerClienteCanonico(ap?.clienteId, ap?.clienteNombre);
        if (canonico?.nombre) return canonico.nombre;
    }
    return ap?.clienteNombre || 'Cliente';
}

function registrarApartado({folio, clienteId, clienteNombre, fechaApartado, importeApartado, fechaCompromiso, saldoPendiente, articulos, condiciones}) {
    const apartados = StorageService.get('apartados', []);
    apartados.push({
        id: Date.now(),
        folio,
        clienteId,
        clienteNombre,
        fechaApartado,
        importeApartado,
        fechaCompromiso,
        condiciones: condiciones || '',
        saldoPendiente,
        articulos,
        enganche: importeApartado - saldoPendiente,
        cuentaIdEnganche: window._estadoPago?.cuentaReceptora || null,
        etiquetaCuentaEnganche: window._estadoPago?.etiquetaCuenta || null,
        abonos: [],
        estado: 'Pendiente'
    });
    StorageService.set('apartados', apartados);
}

function registrarAbonoApartado(folio, monto, fechaAbono, cuentaId = 'efectivo', etiquetaCuenta = 'Efectivo', opciones = {}) {
    const apartados = StorageService.get('apartados', []);
    const ap = apartados.find(a => a.folio === folio);
    if (!ap) return false;
    if (String(ap.estado || '').toLowerCase().includes('cancel')) return false;

    const cuentaDefault = _apartadoCuentaDefault();
    if (!cuentaId || cuentaId === 'efectivo') cuentaId = cuentaDefault.cuentaId;
    if (!etiquetaCuenta || etiquetaCuenta === 'Efectivo') etiquetaCuenta = cuentaDefault.etiqueta;

    const montoAplicado = parseFloat(monto) || 0;
    const saldoActual = _apartadoSaldoReal(ap);
    if (montoAplicado <= 0) return false;
    if (montoAplicado > saldoActual + 0.01) {
        if (!opciones.silencioso) alert(`El abono (${dinero(montoAplicado)}) excede el saldo pendiente del apartado (${dinero(saldoActual)}).`);
        return false;
    }
    
    ap.abonos = ap.abonos || [];
    const idOperacion = String(opciones.idOperacion || opciones.idCuarentena || '');
    if (idOperacion && ap.abonos.some(ab => String(ab.idOperacion || ab.idCuarentena || ab.id || '') === idOperacion)) {
        if (!opciones.silencioso) alert("Este abono ya fue aplicado al apartado. No se duplicara.");
        return false;
    }
    ap.abonos.push({
        idOperacion: idOperacion || null,
        monto: montoAplicado,
        fechaAbono: fechaAbono || window.localISO(new Date()),
        cuentaId,
        etiquetaCuenta,
        autorizado: opciones.autorizado !== false
    });
    ap.saldoPendiente = Math.max(0, _apartadoSaldoReal(ap));
    ap.estado = ap.saldoPendiente <= 0.01 ? 'Liquidado' : 'Pendiente';
    
    StorageService.set('apartados', apartados);
    
    // Inyectar el dinero en Finanzas (Flujo de Caja)
    if (typeof window._ingresarCuenta === 'function') {
        window._ingresarCuenta({
            monto: montoAplicado,
            cuentaId: cuentaId,
            etiqueta: etiquetaCuenta,
            concepto: `Abono a Apartado - ${ap.clienteNombre} (Folio: ${folio})`,
            referencia: `ABN-APT-${folio}`,
            fecha: fechaAbono,
            idOperacion: opciones.idOperacion || opciones.idCuarentena || null
        });
    } else {
        let movimientos = StorageService.get("movimientosCaja", []);
        movimientos.push({
            id: Date.now(),
            folio: folio,
            fecha: fechaAbono,
            tipo: "ingreso",
            monto: montoAplicado,
            concepto: `Abono a Apartado - ${ap.clienteNombre}`,
            referencia: `ABN-APT-${folio}`,
            cuenta: cuentaId,
            etiquetaCuenta: etiquetaCuenta
        });
        StorageService.set("movimientosCaja", movimientos);
    }
    
    // Disparar la impresión del ticket térmico
    if (opciones.imprimir !== false) imprimirTicketAbonoApartado(ap, montoAplicado, etiquetaCuenta, fechaAbono);
    return true;
}

function obtenerApartados() {
    return StorageService.get('apartados', []);
}

function renderApartados() {
    const apartados = obtenerApartados();
    let html = `<h2>📦 Apartados</h2>`;
    
    if (apartados.length === 0) {
        html += '<p>No hay apartados registrados.</p>';
    } else {
        html += `<table class="tabla-admin"><thead><tr><th>Folio</th><th>Cliente</th><th>Fecha</th><th>Compromiso</th><th>Total</th><th>Abonado</th><th>Pendiente</th><th>Estado</th><th style="text-align:center;">Acciones</th></tr></thead><tbody>`;
        
        apartados.forEach(a => {
            const abonado = _apartadoTotalPagado(a);
            const saldoVisible = _apartadoSaldoReal(a);
            html += `<tr>
                <td><strong>${a.folio}</strong></td>
                <td>${a.clienteNombre}</td>
                <td>${window.formatearFechaCortaMX ? window.formatearFechaCortaMX(a.fechaApartado) : a.fechaApartado}</td>
                <td>${a.fechaCompromiso ? (window.formatearFechaCortaMX ? window.formatearFechaCortaMX(a.fechaCompromiso) : a.fechaCompromiso) : '—'}</td>
                <td>${dinero(a.importeApartado)}</td>
                <td>${dinero(abonado)}</td>
                <td style="color:#dc2626; font-weight:bold;">${dinero(saldoVisible)}</td>
                <td>${a.estado}</td>
                <td style="text-align:center;">
                    <div style="display:flex; gap:5px; justify-content:center; flex-wrap:wrap;">
                        ${a.estado === 'Pendiente' ? `
                            <button onclick="abrirModalAbonoApartado('${a.folio}')" style="padding:6px 10px; background:#10b981; color:white; border:none; border-radius:4px; cursor:pointer; font-size:12px; font-weight:bold;">💵 Abonar</button>
                            <button onclick="abrirModalConvertirApartado('${a.folio}')" style="padding:6px 10px; background:#8b5cf6; color:white; border:none; border-radius:4px; cursor:pointer; font-size:12px; font-weight:bold;">💳 Convertir</button>
                        ` : ''}
                        <button onclick="abrirHistorialAbonos('${a.folio}')" style="padding:6px 10px; background:#64748b; color:white; border:none; border-radius:4px; cursor:pointer; font-size:12px; font-weight:bold;">📜 Historial</button>
                        ${a.condiciones ? `<button onclick="verCondicionesApartado('${a.folio}')" style="padding:6px 10px; background:#f1f5f9; color:#334155; border:1px solid #cbd5e1; border-radius:4px; cursor:pointer; font-size:12px; font-weight:bold;">📄 Cond.</button>` : ''}
                    </div>
                </td>
            </tr>`;
        });
        html += `</tbody></table>`;
    }

    const cont = document.getElementById('contenidoApartados');
    if (cont) cont.innerHTML = html;

    if (!document.getElementById('modalHistorialAbonos')) {
        const modalHist = document.createElement('div');
        modalHist.id = 'modalHistorialAbonos';
        modalHist.style = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:9999;';
        modalHist.innerHTML = `<div style="background:white;max-width:400px;margin:80px auto;padding:30px;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.2);"><h3>📜 Historial de Abonos</h3><div id="historialAbonosContenido"></div><div style="display:flex;gap:10px;margin-top:20px;"><button onclick="cerrarHistorialAbonos()" style="flex:1;padding:12px;background:#6b7280;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:bold;">✕ Cerrar</button></div></div>`;
        document.body.appendChild(modalHist);
    }

    const modalAbonoViejo = document.getElementById('modalAbonoApartado');
    if (modalAbonoViejo) modalAbonoViejo.remove();

    const cuentaDefault = _apartadoCuentaDefault();
    const selectorCuentas = window._buildSelectorCuentas ? window._buildSelectorCuentas('abonoCuentaApartado', false) : `<select id="abonoCuentaApartado" style="width:100%;padding:10px;border-radius:6px;border:1px solid #cbd5e1;"><option value="${cuentaDefault.cuentaId}">${cuentaDefault.etiqueta}</option></select>`;
    
    const modalAbono = document.createElement('div');
    modalAbono.id = 'modalAbonoApartado';
    modalAbono.style = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:9999; align-items:center; justify-content:center;';
    modalAbono.innerHTML = `
    <div style="background:white;width:90%;max-width:420px;padding:30px;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.2);">
        <h3 style="margin-top:0; color:#1e40af;">➕ Ingreso a Apartado</h3>
        
        <div style="margin-bottom:15px;">
            <label style="font-size:12px; font-weight:bold; color:#475569;">Folio:</label>
            <input id="abonoFolioApartado" type="text" readonly style="width:100%;padding:10px;margin-top:4px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;color:#64748b;font-weight:bold;box-sizing:border-box;">
        </div>
        
        <div style="margin-bottom:15px;">
            <label style="font-size:12px; font-weight:bold; color:#475569;">Monto a Pagar:</label>
            <input id="abonoMontoApartado" type="number" min="1" placeholder="0.00" style="width:100%;padding:12px;margin-top:4px;border:2px solid #3b82f6;border-radius:6px;font-size:18px;font-weight:bold;color:#1e40af;box-sizing:border-box;">
        </div>
        
        <div style="margin-bottom:15px; background:#f0fdf4; padding:12px; border-radius:8px; border:1px solid #bbf7d0;">
            <label style="font-size:12px; font-weight:bold; color:#166534; display:block; margin-bottom:5px;">¿A qué cuenta entra el dinero?</label>
            ${selectorCuentas}
        </div>

        <div style="margin-bottom:20px;">
            <label style="font-size:12px; font-weight:bold; color:#475569;">Fecha:</label>
            <input id="abonoFechaApartado" type="date" style="width:100%;padding:10px;margin-top:4px;border:1px solid #cbd5e1;border-radius:6px;box-sizing:border-box;">
        </div>
        
        <div style="display:flex;gap:10px;">
            <button onclick="registrarAbonoApartadoDesdeModal()" style="flex:2;padding:14px;background:#2563eb;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:bold;font-size:15px;">💾 Enviar a Autorización</button>
            <button onclick="cerrarModalAbonoApartado()" style="flex:1;padding:14px;background:#e2e8f0;color:#475569;border:none;border-radius:8px;cursor:pointer;font-weight:bold;">Cancelar</button>
        </div>
    </div>`;
    document.body.appendChild(modalAbono);
}

function abrirHistorialAbonos(folio) {
    const apartados = obtenerApartados();
    const ap = apartados.find(a => a.folio === folio);
    const cont = document.getElementById('historialAbonosContenido');
    if (!ap || !cont) return;

    const movimientosCaja = StorageService.get("movimientosCaja", []);
    const enganche = Number(ap.enganche) || 0;
    const pagos = [];
    if (enganche > 0.01) {
        const movEnganche = movimientosCaja.find(m => (m.referencia === `VENTA-${folio}` || m.folio === folio) && Math.abs((Number(m.monto) || 0) - enganche) <= 0.01);
        pagos.push({
            fecha: ap.fechaApartado,
            concepto: 'Enganche inicial',
            monto: enganche,
            cuenta: (movEnganche && (movEnganche.etiquetaCuenta || movEnganche.cuenta)) || 'Cuenta de captura'
        });
    }
    _apartadoAbonosVigentes(ap).forEach(ab => {
        pagos.push({
            fecha: ab.fechaAbono,
            concepto: 'Abono autorizado',
            monto: Number(ab.monto) || 0,
            cuenta: ab.etiquetaCuenta || 'Efectivo'
        });
    });

    if (pagos.length === 0) {
        cont.innerHTML = '<p>No hay abonos registrados.</p>';
    } else {
        let html = '<table style="width:100%;font-size:13px;border-collapse:collapse;"><thead><tr style="background:#f1f5f9;text-align:left;"><th>Fecha</th><th>Concepto</th><th>Importe</th><th>Cuenta</th></tr></thead><tbody>';
        pagos.forEach(pago => {
            const f = window.formatearFechaCortaMX ? window.formatearFechaCortaMX(pago.fecha) : new Date(pago.fecha).toLocaleDateString();
            html += `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:8px 0;">${f}</td><td>${pago.concepto}</td><td style="color:#16a34a;font-weight:bold;">${dinero(pago.monto)}</td><td>${pago.cuenta}</td></tr>`;
        });
        html += '</tbody></table>';
        cont.innerHTML = html;
    }
    document.getElementById('modalHistorialAbonos').style.display = 'flex';
    document.getElementById('modalHistorialAbonos').style.alignItems = 'center';
    document.getElementById('modalHistorialAbonos').style.justifyContent = 'center';
}

function cerrarHistorialAbonos() {
    const modal = document.getElementById('modalHistorialAbonos');
    if (modal) modal.style.display = 'none';
}

function verCondicionesApartado(folio) {
    const ap = obtenerApartados().find(a => a.folio === folio);
    if (!ap) return;
    const anterior = document.getElementById('modalCondicionesApartado');
    if (anterior) anterior.remove();
    const condiciones = String(ap.condiciones || 'Sin condiciones registradas.')
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;');
    document.body.insertAdjacentHTML('beforeend', `
        <div id="modalCondicionesApartado" style="position:fixed; inset:0; background:rgba(15,23,42,0.65); z-index:9999; display:flex; align-items:center; justify-content:center;">
            <div style="background:white; width:90%; max-width:520px; padding:24px; border-radius:12px; box-shadow:0 20px 40px rgba(15,23,42,0.25);">
                <h3 style="margin:0 0 12px; color:#0f172a;">Condiciones del apartado ${folio}</h3>
                <div style="white-space:pre-line; color:#334155; line-height:1.45; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px;">${condiciones}</div>
                <button onclick="document.getElementById('modalCondicionesApartado').remove()" style="margin-top:16px; width:100%; padding:12px; background:#334155; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">Cerrar</button>
            </div>
        </div>`);
}

function abrirModalAbonoApartado(folio) {
    const modal = document.getElementById('modalAbonoApartado');
    if (!modal) return;
    document.getElementById('abonoFolioApartado').value = folio;
    document.getElementById('abonoMontoApartado').value = '';
    document.getElementById('abonoFechaApartado').value = window.obtenerHoyInputMX ? window.obtenerHoyInputMX() : (window.getFechaLocalMX ? window.getFechaLocalMX(new Date()) : new Date().toISOString().split('T')[0]);
    modal.style.display = 'flex';
}

function cerrarModalAbonoApartado() {
    const modal = document.getElementById('modalAbonoApartado');
    if (modal) modal.style.display = 'none';
}

function registrarAbonoApartadoDesdeModal() {
    const folio = document.getElementById('abonoFolioApartado').value;
    const monto = parseFloat(document.getElementById('abonoMontoApartado').value);
    const fecha = document.getElementById('abonoFechaApartado').value;
    
    const cuentaDefault = _apartadoCuentaDefault();
    const selCuenta = document.getElementById('abonoCuentaApartado');
    const cuentaId = selCuenta ? selCuenta.value : cuentaDefault.cuentaId;
    const etiquetaCuenta = selCuenta && selCuenta.selectedIndex >= 0 ? selCuenta.options[selCuenta.selectedIndex].text : cuentaDefault.etiqueta;

    if (!folio || !monto || monto <= 0) { alert('Monto inválido'); return; }

    const apartados = obtenerApartados();
    const ap = apartados.find(a => a.folio === folio);
    if (!ap) { alert('No se encontró el apartado.'); return; }

    if (String(ap.estado || '').toLowerCase() !== 'pendiente') {
        alert('Este apartado no esta pendiente. No se pueden registrar nuevos abonos.');
        return;
    }

    const saldoActual = _apartadoSaldoReal(ap);
    const abonosPendientes = StorageService.get("abonosPendientes", []);
    const pendientePorAutorizar = abonosPendientes
        .filter(p => !String(p.estado || '').toLowerCase().includes('cancel') && (p.tipo === 'apartado' || p.origen === 'apartados' || p.folioApartado) && (p.folioApartado || p.folioCXC) === folio)
        .reduce((s, p) => s + (Number(p.montoAbonado) || 0), 0);
    const saldoDisponible = Math.max(0, saldoActual - pendientePorAutorizar);
    if (monto > saldoDisponible + 0.01) {
        alert(`El abono (${dinero(monto)}) excede el saldo disponible del apartado (${dinero(saldoDisponible)}).`);
        return;
    }

    const fechaKey = String(fecha || '').slice(0, 10);
    const abonosDia = _apartadoAbonosVigentes(ap).filter(ab => String(ab.fechaAbono || ab.fecha || '').slice(0, 10) === fechaKey);
    const pendientesDia = abonosPendientes.filter(p =>
        !String(p.estado || '').toLowerCase().includes('cancel') &&
        (p.tipo === 'apartado' || p.origen === 'apartados' || p.folioApartado) &&
        (p.folioApartado || p.folioCXC) === folio &&
        String(p.fechaAbonoIso || p.fecha || '').slice(0, 10) === fechaKey
    );
    if (abonosDia.length || pendientesDia.length) {
        const totalDia = [...abonosDia, ...pendientesDia].reduce((s, ab) => s + Number(ab.monto || ab.montoAbonado || 0), 0);
        if (!confirm(`Ya existe ${abonosDia.length + pendientesDia.length} abono(s) para este apartado en la fecha seleccionada por ${dinero(totalDia)}.\n\nSi continuas se registrara otro abono el mismo dia.\n\nDeseas continuar?`)) return;
    }

    const msjConf = `⚠️ ABONO PROVISIONAL DE APARTADO\n\nFolio: ${folio}\nMonto recibido: ${dinero(monto)}\nDestino solicitado: ${etiquetaCuenta}\n\nSe emitirá recibo provisional y quedará en la Bóveda de Autorizaciones. Auditoría deberá aprobarlo para mover caja y saldo.\n\n¿Deseas continuar?`;
    if (!confirm(msjConf)) return;

    const fechaIso = window.localISO ? window.localISO(fecha + 'T12:00:00') : new Date(fecha + 'T12:00:00').toISOString();
    const nuevoSaldoEstimado = Math.max(0, saldoDisponible - monto);
    const cuarentenaAbono = {
        id: Date.now(),
        tipo: 'apartado',
        origen: 'apartados',
        fechaCaptura: window.formatearFechaCortaMX ? window.formatearFechaCortaMX(new Date()) : new Date().toLocaleDateString('es-MX'),
        fechaCapturaIso: window.localISO ? window.localISO(new Date()) : new Date().toISOString(),
        folioApartado: folio,
        folioCXC: folio,
        clienteNombre: ap.clienteNombre || 'Cliente',
        montoAbonado: monto,
        fechaAbonoIso: fechaIso,
        fechaAbonoStr: window.formatearFechaCortaMX ? window.formatearFechaCortaMX(fechaIso) : fecha,
        cuentaId,
        etiquetaCuenta,
        medioPago: String(cuentaId).toLowerCase().includes('tarjeta') ? 'tarjeta' : 'efectivo',
        saldoAnterior: saldoActual,
        pendientePrevioPorAutorizar: pendientePorAutorizar,
        nuevoSaldoEstimado,
        estado: 'Pendiente'
    };
    StorageService.pushAtomo("abonosPendientes", cuarentenaAbono);

    imprimirTicketAbonoApartado({ ...ap, saldoPendiente: nuevoSaldoEstimado }, monto, etiquetaCuenta, fechaIso, { provisional: true });
    alert('⏳ Abono enviado a la Bóveda de Autorizaciones. El saldo y caja se moverán cuando Auditoría lo apruebe.');
    cerrarModalAbonoApartado();
    renderApartados();
}

function imprimirTicketAbonoApartado(ap, montoAbono, cuentaDestino, fecha, opciones = {}) {
    const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const dineroFmt = v => '$' + Number(v).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fechaFmt = window.formatearFechaCortaMX ? window.formatearFechaCortaMX(fecha) : new Date(fecha).toLocaleDateString();
    const esProvisional = opciones.provisional === true;
    
    const articulosHTML = (ap.articulos || []).map(a => `
        <tr>
            <td>${esc(a.nombre || '-')}</td>
            <td style="text-align:right;">${esc(String(a.cantidad || 1))}</td>
        </tr>`).join('');

    const ticketHTML = `<!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>Recibo Abono Apartado ${esc(ap.folio)}</title>
        <style>
            @page { size: 80mm auto; margin: 0; }
            body { font-family: 'Courier New', monospace; font-size: 11px; width: 72mm; margin: 4mm auto; color: #000; }
            .centro { text-align: center; }
            .negrita { font-weight: bold; }
            hr { border: none; border-top: 1px dashed #333; margin: 6px 0; }
            .monto-grande { font-size: 20px; font-weight: bold; text-align: center; margin: 8px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th { background: #e8e8e8; padding: 3px 5px; text-align: left; }
            .seccion-titulo { background: #000; color: #fff; padding: 3px 6px; font-weight: bold; font-size: 10px; margin: 5px 0 3px 0; }
            @media print { .no-print { display: none; } }
        </style>
    </head>
    <body>
    <div id="ticket-contenido">
        <div class="no-print" style="text-align:center; padding-bottom:10px; background:#f1f5f9; padding:15px; margin-bottom:10px;"><button onclick="window.print()" style="padding:10px 20px; background:#2563eb; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">🖨️ Imprimir Ticket</button></div>
        
        <div class="centro">
            <img src="img/Logo.svg" style="width:50px; height:50px; object-fit:contain;" onerror="this.outerHTML='<span style=\\'font-size:32px;\\'>🏛️</span>'">
            <div class="negrita" style="font-size:14px; margin-top:5px;">MUEBLERÍA MI PUEBLITO</div>
            <div>Santiago Cuaula, Tlaxcala</div>
        </div>
        <hr>
        <div class="centro negrita" style="font-size:13px;">── ${esProvisional ? 'RECIBO PROVISIONAL DE APARTADO' : 'RECIBO DE APARTADO'} ──</div>
        <div>Folio: <span class="negrita">${esc(ap.folio)}</span></div>
        <div>Fecha: <span class="negrita">${esc(fechaFmt)}</span></div>
        <hr>
        <div class="negrita">CLIENTE:</div>
        <div>${esc(ap.clienteNombre)}</div>
        <hr>
        <div class="seccion-titulo">MERCANCÍA APARTADA</div>
        <table>
            <thead><tr><th>Producto</th><th style="text-align:right;">Cant.</th></tr></thead>
            <tbody>${articulosHTML}</tbody>
        </table>
        <hr>
        <div class="negrita">ABONO RECIBIDO HOY:</div>
        <div class="monto-grande">${dineroFmt(montoAbono)}</div>
        
        <div style="display:flex; justify-content:space-between; margin-top:5px;">
            <span>Total Apartado:</span><span class="negrita">${dineroFmt(ap.importeApartado)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:13px; margin-top:5px; border-top:1px solid #000; padding-top:4px;">
            <span>Saldo Pendiente:</span><span class="negrita" style="color:red;">${dineroFmt(ap.saldoPendiente)}</span>
        </div>
        
        <div style="display:flex; justify-content:space-between; margin-top:10px;">
            <span>Ingresó a:</span><span>${esc(cuentaDestino)}</span>
        </div>
        <hr>
        <div style="border: 1px dashed #000; padding: 6px; font-size: 10px; text-align: justify; margin: 6px 0; white-space:pre-line;">
            <b>CONDICIONES:</b><br>${esc(ap.condiciones || 'La mercancía permanecerá bajo resguardo de la empresa hasta su liquidación total. En caso de cancelación por parte del cliente, se aplicarán penalizaciones administrativas y por almacenaje de acuerdo a la política de la tienda.')}
        </div>
        ${esProvisional ? '<div style="border:1px solid #000; padding:6px; font-size:10px; text-align:center; margin:6px 0;"><b>ABONO PENDIENTE DE AUTORIZACIÓN.</b><br>Este comprobante no mueve saldo ni caja hasta ser aprobado por Auditoría.</div>' : ''}
        <div style="text-align:center; margin-top:30px;">
            <div style="border-top:1px solid #333; width:70%; margin:0 auto 4px auto;"></div>
            <div class="negrita">FIRMA DEL CLIENTE</div>
        </div>
        <div class="centro" style="margin-top:12px;">*** Gracias por su pago ***</div>
    </div>
    </body>
    </html>`;
    if (window.TicketService?.openHtml) {
        window.TicketService.openHtml(ticketHTML, { title: `Recibo Apartado ${ap.folio}`, filename: `apartado_${ap.folio}` });
        return;
    }
    const ventana = window.open('', '_blank');
    if(ventana){
        ventana.document.write(ticketHTML);
        ventana.document.close();
        ventana.focus();
    } else {
        alert("⚠️ El ticket se generó pero tu navegador bloqueó la ventana emergente (Pop-up). Habilítalas para poder imprimir.");
    }
}

// Exportar
window.abrirHistorialAbonos = abrirHistorialAbonos;
window.cerrarHistorialAbonos = cerrarHistorialAbonos;
window.verCondicionesApartado = verCondicionesApartado;
window.abrirModalAbonoApartado = abrirModalAbonoApartado;
window.cerrarModalAbonoApartado = cerrarModalAbonoApartado;
window.registrarAbonoApartadoDesdeModal = registrarAbonoApartadoDesdeModal;
window.registrarApartado = registrarApartado;
window.registrarAbonoApartado = registrarAbonoApartado;
window.obtenerApartados = obtenerApartados;
window.renderApartados = renderApartados;
window.imprimirTicketAbonoApartado = imprimirTicketAbonoApartado;

// ==========================================
// CORRECCION / ELIMINACION DE ANTICIPO (Auditoria Apartados)
// ==========================================
function _apartadoEsAdminSesion() {
    const sesion = (() => { try { return JSON.parse(sessionStorage.getItem('sesionActiva') || 'null'); } catch { return null; } })();
    return !!sesion && (sesion.rol === 'admin' || sesion.rol === 'Administrador');
}

function _apartadoMovimientosAbonoFolio(folio) {
    return StorageService.get("movimientosCaja", []).filter(m => String(m.referencia || '') === `ABN-APT-${folio}`);
}

function _apartadoSnapshotSaldosAbonos(ap, movimientosPrevios = null) {
    const movs = Array.isArray(movimientosPrevios) ? movimientosPrevios : _apartadoMovimientosAbonoFolio(ap.folio);
    if (movs.length) {
        return movs.map(m => ({
            cuentaId: m.cuenta || m.cuentaId || m.medioPago || 'efectivo',
            monto: Number(m.monto || 0)
        }));
    }
    return _apartadoAbonosVigentes(ap).map(a => ({
        cuentaId: a.cuentaId || a.medioPago || 'efectivo',
        monto: Number(a.monto || 0)
    }));
}

function _apartadoRecrearMovimientosAbonos(ap) {
    let movimientosCaja = StorageService.get("movimientosCaja", []);
    movimientosCaja = movimientosCaja.filter(m => String(m.referencia || '') !== `ABN-APT-${ap.folio}`);
    _apartadoAbonosVigentes(ap).forEach((ab) => {
        movimientosCaja.push({
            id: Date.now() + Math.random(),
            folio: ap.folio,
            fecha: ab.fechaAbono || ab.fecha,
            monto: Number(ab.monto || 0),
            tipo: "ingreso",
            concepto: `Abono a Apartado - ${_apartadoNombreCliente(ap)} (Folio: ${ap.folio})`,
            referencia: `ABN-APT-${ap.folio}`,
            cuenta: ab.cuentaId || ab.medioPago || 'efectivo',
            medioPago: ab.medioPago || 'efectivo',
            etiquetaCuenta: ab.etiquetaCuenta || ab.medioPago || 'Efectivo',
            idOperacion: ab.idOperacion || ab.idCuarentena || ab.id || null
        });
    });
    StorageService.set("movimientosCaja", movimientosCaja);
}

window.abrirEditorAbonoApartado = function(folio, abonoIndex) {
    const apartados = StorageService.get("apartados", []);
    const ap = apartados.find(a => a.folio === folio);
    if (!ap) return;

    const abono = (ap.abonos || [])[abonoIndex];
    if (!abono) return;

    const cuentaActualId = abono.cuentaId || abono.medioPago || 'efectivo';
    const opcionesCuentas = (typeof _cxcOpcionesCuentasReceptoras === 'function')
        ? _cxcOpcionesCuentasReceptoras(cuentaActualId, abono.etiquetaCuenta || '')
        : `<option value="efectivo">Efectivo Principal</option>`;

    const fechaBase = abono.fechaAbono || abono.fecha || (window.localISO ? window.localISO(new Date()) : new Date().toISOString());
    const fechaObj = window.parseFechaMX ? window.parseFechaMX(fechaBase) : new Date(fechaBase);
    const valorFecha = window.fechaParaInput
        ? window.fechaParaInput(fechaObj)
        : (isNaN(fechaObj.getTime()) ? new Date() : fechaObj).toISOString().slice(0, 16);

    const html = `
    <div id="modalCorreccionAbonoApartado" style="position:fixed; inset:0; background:rgba(15,23,42,0.8); z-index:10000; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
        <div style="background:white; padding:30px; border-radius:16px; width:90%; max-width:450px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
            <h3 style="margin:0 0 5px 0; color:#1e40af;">✏️ Corrección de Abono (Apartado)</h3>
            <p style="font-size:13px; color:#64748b; margin-top:0;">Folio: <b>${folio}</b> | Cliente: <b>${_apartadoNombreCliente(ap)}</b></p>

            <div style="margin-top:20px;">
                <label style="display:block; font-size:11px; font-weight:bold; color:#475569;">FECHA DEL MOVIMIENTO:</label>
                <input type="datetime-local" id="editFechaAbnApt" value="${valorFecha}" style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1; margin-top:5px; box-sizing:border-box;">
            </div>

            <div style="margin-top:15px;">
                <label style="display:block; font-size:11px; font-weight:bold; color:#475569;">IMPORTE DEL ABONO ($):</label>
                <input type="number" id="editMontoAbnApt" value="${abono.monto}" style="width:100%; padding:12px; border-radius:8px; border:2px solid #3b82f6; margin-top:5px; font-size:18px; font-weight:bold; box-sizing:border-box; color:#1e40af;">
            </div>

            <div style="margin-top:15px;">
                <label style="display:block; font-size:11px; font-weight:bold; color:#475569;">CUENTA RECEPTORA:</label>
                <select id="editCuentaAbnApt" style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1; margin-top:5px; font-size:14px;">
                    ${opcionesCuentas}
                </select>
            </div>

            <div style="background:#fffbeb; padding:12px; border-radius:8px; margin-top:20px; border:1px solid #fcd34d;">
                <p style="margin:0; font-size:12px; color:#92400e;">⚠️ <b>Atención:</b> El saldo pendiente del apartado se recalcula y el movimiento en caja/banco se corrige automáticamente.</p>
            </div>

            <div style="display:flex; gap:10px; margin-top:25px;">
                <button onclick="procesarCorreccionAbonoApartado('${folio}', ${abonoIndex})"
                        style="flex:2; padding:14px; background:#2563eb; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:15px;">
                    💾 Guardar Cambios
                </button>
                <button onclick="document.getElementById('modalCorreccionAbonoApartado').remove()"
                        style="flex:1; padding:14px; background:#f1f5f9; color:#475569; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">
                    Cancelar
                </button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window.procesarCorreccionAbonoApartado = function(folio, abonoIndex) {
    if (!_apartadoEsAdminSesion()) return alert("Acceso denegado: solo administradores.");

    const nuevaFecha = document.getElementById('editFechaAbnApt').value;
    const nuevoMonto = parseFloat(document.getElementById('editMontoAbnApt').value);
    const selCuenta = document.getElementById('editCuentaAbnApt');
    if (isNaN(nuevoMonto) || nuevoMonto <= 0) return alert("Importe inválido.");

    const cuentaId = selCuenta.value;
    const etiqueta = selCuenta.options[selCuenta.selectedIndex].getAttribute('data-nombre') || selCuenta.options[selCuenta.selectedIndex].text || cuentaId;
    const isCajaDestino = String(cuentaId).startsWith('caja_') || cuentaId === 'efectivo';
    const medioPago = isCajaDestino ? 'efectivo' : 'transferencia';

    let apartados = StorageService.get("apartados", []);
    const idx = apartados.findIndex(a => a.folio === folio);
    if (idx === -1) return alert("Apartado no encontrado.");
    const ap = apartados[idx];
    ap.abonos = Array.isArray(ap.abonos) ? ap.abonos : [];
    if (!ap.abonos[abonoIndex]) return alert("No se encontro el abono a corregir.");
    const abonoAnterior = { ...ap.abonos[abonoIndex] };

    const fechaObj = nuevaFecha
        ? new Date(nuevaFecha.includes('T') ? nuevaFecha : `${nuevaFecha}T12:00:00`)
        : new Date();
    if (isNaN(fechaObj.getTime())) return alert("Fecha invalida.");
    const nuevaFechaIso = window.localISO ? window.localISO(fechaObj) : fechaObj.toISOString();

    const movimientosPrevios = _apartadoMovimientosAbonoFolio(folio);
    const saldosPrevios = _apartadoSnapshotSaldosAbonos(ap, movimientosPrevios);

    ap.abonos[abonoIndex].fechaAbono = nuevaFechaIso;
    ap.abonos[abonoIndex].monto = nuevoMonto;
    ap.abonos[abonoIndex].cuentaId = cuentaId;
    ap.abonos[abonoIndex].medioPago = medioPago;
    ap.abonos[abonoIndex].etiquetaCuenta = etiqueta;

    ap.saldoPendiente = Math.max(0, _apartadoSaldoReal(ap));
    const estadoActualAp = String(ap.estado || '').toLowerCase();
    if (!estadoActualAp.includes('cancel') && !estadoActualAp.includes('migrado') && !estadoActualAp.includes('conversion')) {
        ap.estado = ap.saldoPendiente <= 0.01 ? 'Liquidado' : 'Pendiente';
    }

    apartados[idx] = ap;
    StorageService.set("apartados", apartados);
    _apartadoRecrearMovimientosAbonos(ap);

    let saldosActualizados = true;
    if (typeof _cxcAjustarSaldoCuentaPorCorreccion === 'function') {
        saldosPrevios.forEach(m => {
            if (!_cxcAjustarSaldoCuentaPorCorreccion(m.cuentaId, -Number(m.monto || 0))) saldosActualizados = false;
        });
        _apartadoAbonosVigentes(ap).forEach(ab => {
            if (!_cxcAjustarSaldoCuentaPorCorreccion(ab.cuentaId || ab.medioPago || 'efectivo', Number(ab.monto || 0))) saldosActualizados = false;
        });
    }

    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'CORRECCION_ABONO_APARTADO',
            modulo: 'Apartados',
            entidad: 'Abono',
            entidadId: `${folio}#${abonoIndex + 1}`,
            detalle: `Correccion de abono de apartado: monto ${dinero(abonoAnterior.monto || 0)} -> ${dinero(nuevoMonto)}; cuenta ${abonoAnterior.etiquetaCuenta || abonoAnterior.cuentaId || '-'} -> ${etiqueta}`,
            monto: nuevoMonto,
            severidad: 'riesgo',
            datos: { antes: abonoAnterior, despues: ap.abonos[abonoIndex] }
        });
    }

    document.getElementById('modalCorreccionAbonoApartado')?.remove();
    alert(saldosActualizados
        ? "Abono corregido con exito. Saldo del apartado y caja/banco fueron recalculados."
        : "Abono corregido, pero alguna cuenta destino no se encontro para ajustar su saldo. Revisa Mis Cuentas.");

    if (typeof renderApartados === 'function') renderApartados();
    if (document.querySelector('[data-modal="auditoria-cxc"]') && window._auditCuentaActual?.folio === folio && typeof buscarVentaAuditoria === 'function') {
        const inputAudit = document.getElementById('auditFolioInput');
        if (inputAudit) inputAudit.value = folio;
        buscarVentaAuditoria();
    }
};

window.eliminarAbonoApartadoAuditoria = function(folio, abonoIndex) {
    if (!_apartadoEsAdminSesion()) return alert("Acceso denegado: solo administradores.");

    let apartados = StorageService.get("apartados", []);
    const idx = apartados.findIndex(a => a.folio === folio);
    if (idx === -1) return alert("Apartado no encontrado.");
    const ap = apartados[idx];
    ap.abonos = Array.isArray(ap.abonos) ? ap.abonos : [];
    const abono = ap.abonos[abonoIndex];
    if (!abono) return alert("El abono no existe o ya fue eliminado.");

    const monto = Number(abono.monto || 0);
    const msg = `ELIMINAR ABONO\n\nFolio: ${folio}\nCliente: ${_apartadoNombreCliente(ap)}\nMonto: ${dinero(monto)}\n\nEsto quitara el abono del apartado, recalculara el saldo pendiente y retirara el ingreso de caja/banco.\n\nDeseas continuar?`;
    if (!confirm(msg)) return;

    const motivo = prompt("Motivo de eliminacion del abono:");
    if (motivo === null) return;
    if (!String(motivo).trim()) return alert("El motivo es obligatorio para eliminar un abono.");

    const movimientosPrevios = _apartadoMovimientosAbonoFolio(folio);
    const saldosPrevios = _apartadoSnapshotSaldosAbonos(ap, movimientosPrevios);
    const abonoEliminado = ap.abonos.splice(abonoIndex, 1)[0];
    ap.abonosEliminados = ap.abonosEliminados || [];
    ap.abonosEliminados.push({
        ...abonoEliminado,
        eliminadoAuditoria: true,
        fechaEliminacion: window.localISO ? window.localISO(new Date()) : new Date().toISOString(),
        motivoEliminacion: String(motivo).trim()
    });

    ap.saldoPendiente = Math.max(0, _apartadoSaldoReal(ap));
    const estadoActualAp = String(ap.estado || '').toLowerCase();
    if (!estadoActualAp.includes('cancel') && !estadoActualAp.includes('migrado') && !estadoActualAp.includes('conversion')) {
        ap.estado = ap.saldoPendiente <= 0.01 ? 'Liquidado' : 'Pendiente';
    }

    apartados[idx] = ap;
    StorageService.set("apartados", apartados);
    _apartadoRecrearMovimientosAbonos(ap);

    let saldosActualizados = true;
    if (typeof _cxcAjustarSaldoCuentaPorCorreccion === 'function') {
        saldosPrevios.forEach(m => {
            if (!_cxcAjustarSaldoCuentaPorCorreccion(m.cuentaId, -Number(m.monto || 0))) saldosActualizados = false;
        });
        _apartadoAbonosVigentes(ap).forEach(ab => {
            if (!_cxcAjustarSaldoCuentaPorCorreccion(ab.cuentaId || ab.medioPago || 'efectivo', Number(ab.monto || 0))) saldosActualizados = false;
        });
    }

    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'ELIMINACION_ABONO_APARTADO',
            modulo: 'Apartados',
            entidad: 'Abono',
            entidadId: `${folio}#${abonoIndex + 1}`,
            detalle: `Eliminacion de abono de apartado por ${dinero(monto)}. Motivo: ${String(motivo).trim()}`,
            monto,
            severidad: 'critica',
            datos: { motivo: String(motivo).trim(), abono: abonoEliminado }
        });
    }

    document.getElementById('modalCorreccionAbonoApartado')?.remove();
    alert(saldosActualizados
        ? "Abono eliminado. Saldo del apartado y caja/banco fueron recalculados."
        : "Abono eliminado, pero alguna cuenta de caja/banco no se encontro para ajustar saldo. Revisa Mis Cuentas.");

    if (typeof renderApartados === 'function') renderApartados();
    if (document.querySelector('[data-modal="auditoria-cxc"]') && window._auditCuentaActual?.folio === folio && typeof buscarVentaAuditoria === 'function') {
        const inputAudit = document.getElementById('auditFolioInput');
        if (inputAudit) inputAudit.value = folio;
        buscarVentaAuditoria();
    }
};

window.abrirEditorEngancheApartado = function(folio) {
    if (!_apartadoEsAdminSesion()) return alert("Acceso denegado: solo administradores.");

    const apartados = StorageService.get("apartados", []);
    const ap = apartados.find(a => a.folio === folio);
    if (!ap) return alert("Apartado no encontrado.");

    const engancheActual = Number(ap.enganche || 0);
    const movimiento = (typeof _cxcMovimientoEngancheFolio === 'function') ? _cxcMovimientoEngancheFolio(folio) : null;
    const cuentaActualId = movimiento?.cuenta || movimiento?.cuentaId || ap.cuentaIdEnganche || 'efectivo';
    const etiquetaActual = movimiento?.etiquetaCuenta || ap.etiquetaCuentaEnganche || '';
    const opcionesCuentas = (typeof _cxcOpcionesCuentasReceptoras === 'function')
        ? _cxcOpcionesCuentasReceptoras(cuentaActualId, etiquetaActual)
        : `<option value="efectivo">Efectivo Principal</option>`;

    const html = `
    <div id="modalCorreccionEngancheApartado" style="position:fixed; inset:0; background:rgba(15,23,42,0.8); z-index:10000; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
        <div style="background:white; padding:30px; border-radius:16px; width:90%; max-width:450px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
            <h3 style="margin:0 0 5px 0; color:#1e40af;">✏️ Corrección de Anticipo (Apartado)</h3>
            <p style="font-size:13px; color:#64748b; margin-top:0;">Folio: <b>${folio}</b> | Cliente: <b>${_apartadoNombreCliente(ap)}</b></p>

            <div style="margin-top:20px;">
                <label style="display:block; font-size:11px; font-weight:bold; color:#475569;">IMPORTE DEL ANTICIPO ($):</label>
                <input type="number" id="editMontoEngApt" value="${engancheActual}" style="width:100%; padding:12px; border-radius:8px; border:2px solid #3b82f6; margin-top:5px; font-size:18px; font-weight:bold; box-sizing:border-box; color:#1e40af;">
            </div>

            <div style="margin-top:15px;">
                <label style="display:block; font-size:11px; font-weight:bold; color:#475569;">CUENTA RECEPTORA:</label>
                <select id="editCuentaEngApt" style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1; margin-top:5px; font-size:14px;">
                    ${opcionesCuentas}
                </select>
            </div>

            <div style="background:#fffbeb; padding:12px; border-radius:8px; margin-top:20px; border:1px solid #fcd34d;">
                <p style="margin:0; font-size:12px; color:#92400e;">⚠️ <b>Atención:</b> El saldo pendiente del apartado y el saldo de caja/banco se recalculan automáticamente al guardar. Si pones el importe en 0, se elimina el anticipo por completo (pide motivo).</p>
            </div>

            <div style="display:flex; gap:10px; margin-top:25px;">
                <button onclick="procesarCorreccionEngancheApartado('${folio}')"
                        style="flex:2; padding:14px; background:#2563eb; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:15px;">
                    💾 Guardar Cambios
                </button>
                <button onclick="document.getElementById('modalCorreccionEngancheApartado').remove()"
                        style="flex:1; padding:14px; background:#f1f5f9; color:#475569; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">
                    Cancelar
                </button>
            </div>
            <div style="margin-top:12px; text-align:center;">
                <button onclick="eliminarEngancheApartadoAuditoria('${folio}')"
                        style="background:none; border:none; color:#b91c1c; font-size:12px; font-weight:bold; cursor:pointer; text-decoration:underline;">
                    🗑️ Eliminar anticipo por completo
                </button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window.procesarCorreccionEngancheApartado = function(folio) {
    if (!_apartadoEsAdminSesion()) return alert("Acceso denegado: solo administradores.");

    const nuevoMonto = parseFloat(document.getElementById('editMontoEngApt').value);
    const selCuenta = document.getElementById('editCuentaEngApt');
    if (isNaN(nuevoMonto) || nuevoMonto < 0) return alert("Importe inválido.");

    if (nuevoMonto === 0) {
        document.getElementById('modalCorreccionEngancheApartado')?.remove();
        return window.eliminarEngancheApartadoAuditoria(folio);
    }

    const cuentaId = selCuenta.value;
    const etiqueta = selCuenta.options[selCuenta.selectedIndex].getAttribute('data-nombre') || selCuenta.options[selCuenta.selectedIndex].text || cuentaId;
    const isCajaDestino = String(cuentaId).startsWith('caja_') || cuentaId === 'efectivo';
    const medioPago = isCajaDestino ? 'efectivo' : 'transferencia';

    let apartados = StorageService.get("apartados", []);
    const idx = apartados.findIndex(a => a.folio === folio);
    if (idx === -1) return alert("Apartado no encontrado.");
    const ap = apartados[idx];

    const engancheAnterior = Number(ap.enganche || 0);
    const movimientoAnterior = (typeof _cxcMovimientoEngancheFolio === 'function') ? _cxcMovimientoEngancheFolio(folio) : null;
    const cuentaAnteriorId = movimientoAnterior?.cuenta || movimientoAnterior?.cuentaId || ap.cuentaIdEnganche || 'efectivo';

    let saldosActualizados = true;
    if (typeof _cxcAjustarSaldoCuentaPorCorreccion === 'function') {
        if (engancheAnterior > 0) {
            if (!_cxcAjustarSaldoCuentaPorCorreccion(cuentaAnteriorId, -engancheAnterior)) saldosActualizados = false;
        }
        if (!_cxcAjustarSaldoCuentaPorCorreccion(cuentaId, nuevoMonto)) saldosActualizados = false;
    }

    let movimientosCaja = StorageService.get("movimientosCaja", []);
    const idxMov = movimientoAnterior ? movimientosCaja.findIndex(m => m.id === movimientoAnterior.id) : -1;
    if (idxMov !== -1) {
        movimientosCaja[idxMov].monto = nuevoMonto;
        movimientosCaja[idxMov].cuenta = cuentaId;
        movimientosCaja[idxMov].etiquetaCuenta = etiqueta;
        movimientosCaja[idxMov].medioPago = medioPago;
    } else {
        movimientosCaja.push({
            id: Date.now() + Math.random(),
            folio,
            fecha: ap.fechaApartado || (window.localISO ? window.localISO(new Date()) : new Date().toISOString()),
            tipo: "ingreso",
            monto: nuevoMonto,
            concepto: `Enganche apartado - ${_apartadoNombreCliente(ap)} (Folio: ${folio})`,
            referencia: `VENTA-${folio}`,
            cuenta: cuentaId,
            medioPago,
            etiquetaCuenta: etiqueta
        });
    }
    StorageService.set("movimientosCaja", movimientosCaja);

    ap.enganche = nuevoMonto;
    ap.cuentaIdEnganche = cuentaId;
    ap.etiquetaCuentaEnganche = etiqueta;
    ap.saldoPendiente = Math.max(0, _apartadoSaldoReal(ap));
    const estadoActualAp = String(ap.estado || '').toLowerCase();
    if (!estadoActualAp.includes('cancel') && !estadoActualAp.includes('migrado') && !estadoActualAp.includes('conversion')) {
        ap.estado = ap.saldoPendiente <= 0.01 ? 'Liquidado' : 'Pendiente';
    }

    apartados[idx] = ap;
    StorageService.set("apartados", apartados);

    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'CORRECCION_ENGANCHE_APARTADO',
            modulo: 'Apartados',
            entidad: 'Enganche',
            entidadId: folio,
            detalle: `Correccion de anticipo de apartado: monto ${dinero(engancheAnterior)} -> ${dinero(nuevoMonto)}; cuenta ${cuentaAnteriorId} -> ${etiqueta}`,
            monto: nuevoMonto,
            severidad: 'riesgo',
            datos: { antes: { monto: engancheAnterior, cuenta: cuentaAnteriorId }, despues: { monto: nuevoMonto, cuenta: cuentaId } }
        });
    }

    document.getElementById('modalCorreccionEngancheApartado')?.remove();
    alert(saldosActualizados
        ? "Anticipo corregido con exito. Saldo del apartado y caja/banco fueron actualizados."
        : "Anticipo corregido, pero alguna cuenta destino no se encontro para ajustar su saldo. Revisa Mis Cuentas.");

    if (typeof renderApartados === 'function') renderApartados();
};

window.eliminarEngancheApartadoAuditoria = function(folio) {
    if (!_apartadoEsAdminSesion()) return alert("Acceso denegado: solo administradores.");

    let apartados = StorageService.get("apartados", []);
    const idx = apartados.findIndex(a => a.folio === folio);
    if (idx === -1) return alert("Apartado no encontrado.");
    const ap = apartados[idx];

    const engancheAnterior = Number(ap.enganche || 0);
    if (engancheAnterior <= 0) return alert("Este apartado no tiene anticipo registrado para eliminar.");

    const msg = `ELIMINAR ANTICIPO\n\nFolio: ${folio}\nCliente: ${_apartadoNombreCliente(ap)}\nMonto: ${dinero(engancheAnterior)}\n\nEsto quitara el anticipo del apartado, sumara ese monto al saldo pendiente y retirara el ingreso de caja/banco.\n\nDeseas continuar?`;
    if (!confirm(msg)) return;

    const motivo = prompt("Motivo de eliminacion del anticipo:");
    if (motivo === null) return;
    if (!String(motivo).trim()) return alert("El motivo es obligatorio para eliminar el anticipo.");

    const movimiento = (typeof _cxcMovimientoEngancheFolio === 'function') ? _cxcMovimientoEngancheFolio(folio) : null;
    const cuentaAnteriorId = movimiento?.cuenta || movimiento?.cuentaId || ap.cuentaIdEnganche || 'efectivo';

    let saldosActualizados = true;
    if (typeof _cxcAjustarSaldoCuentaPorCorreccion === 'function') {
        if (!_cxcAjustarSaldoCuentaPorCorreccion(cuentaAnteriorId, -engancheAnterior)) saldosActualizados = false;
    }

    let movimientosCaja = StorageService.get("movimientosCaja", []);
    if (movimiento) {
        movimientosCaja = movimientosCaja.filter(m => m.id !== movimiento.id);
        StorageService.set("movimientosCaja", movimientosCaja);
    }

    ap.enganchesEliminados = ap.enganchesEliminados || [];
    ap.enganchesEliminados.push({
        monto: engancheAnterior,
        cuenta: cuentaAnteriorId,
        fechaEliminacion: window.localISO ? window.localISO(new Date()) : new Date().toISOString(),
        motivoEliminacion: String(motivo).trim()
    });

    ap.enganche = 0;
    ap.cuentaIdEnganche = null;
    ap.etiquetaCuentaEnganche = null;
    ap.saldoPendiente = Math.max(0, _apartadoSaldoReal(ap));
    const estadoActualAp = String(ap.estado || '').toLowerCase();
    if (!estadoActualAp.includes('cancel') && !estadoActualAp.includes('migrado') && !estadoActualAp.includes('conversion')) {
        ap.estado = ap.saldoPendiente <= 0.01 ? 'Liquidado' : 'Pendiente';
    }

    apartados[idx] = ap;
    StorageService.set("apartados", apartados);

    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'ELIMINACION_ENGANCHE_APARTADO',
            modulo: 'Apartados',
            entidad: 'Enganche',
            entidadId: folio,
            detalle: `Eliminacion de anticipo de apartado por ${dinero(engancheAnterior)}. Motivo: ${String(motivo).trim()}`,
            monto: engancheAnterior,
            severidad: 'critica',
            datos: { motivo: String(motivo).trim(), cuentaOrigen: cuentaAnteriorId }
        });
    }

    document.getElementById('modalCorreccionEngancheApartado')?.remove();
    alert(saldosActualizados
        ? "Anticipo eliminado. Se reverso el ingreso de caja/banco y se sumo el monto al saldo pendiente del apartado."
        : "Anticipo eliminado, pero alguna cuenta de caja/banco no se encontro para ajustar saldo. Revisa Mis Cuentas.");

    if (typeof renderApartados === 'function') renderApartados();
};
