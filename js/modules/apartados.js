// ===== APARTADOS: Seguimiento y gestión =====

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
        abonos: [],
        estado: 'Pendiente'
    });
    StorageService.set('apartados', apartados);
}

function registrarAbonoApartado(folio, monto, fechaAbono, cuentaId = 'efectivo', etiquetaCuenta = 'Efectivo', opciones = {}) {
    const apartados = StorageService.get('apartados', []);
    const ap = apartados.find(a => a.folio === folio);
    if (!ap) return false;

    const montoAplicado = parseFloat(monto) || 0;
    const saldoActual = parseFloat(ap.saldoPendiente) || 0;
    if (montoAplicado <= 0) return false;
    if (montoAplicado > saldoActual + 0.01) {
        if (!opciones.silencioso) alert(`El abono (${dinero(montoAplicado)}) excede el saldo pendiente del apartado (${dinero(saldoActual)}).`);
        return false;
    }
    
    ap.abonos = ap.abonos || [];
    ap.abonos.push({
        monto: montoAplicado,
        fechaAbono: fechaAbono || window.localISO(new Date()),
        cuentaId,
        etiquetaCuenta,
        autorizado: opciones.autorizado !== false
    });
    ap.saldoPendiente = Math.max(0, saldoActual - montoAplicado);
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
            fecha: fechaAbono
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
            const abonado = (a.enganche || 0) + (a.abonos || []).reduce((s, ab) => s + (Number(ab.monto) || 0), 0);
            html += `<tr>
                <td><strong>${a.folio}</strong></td>
                <td>${a.clienteNombre}</td>
                <td>${window.formatearFechaCortaMX ? window.formatearFechaCortaMX(a.fechaApartado) : a.fechaApartado}</td>
                <td>${a.fechaCompromiso ? (window.formatearFechaCortaMX ? window.formatearFechaCortaMX(a.fechaCompromiso) : a.fechaCompromiso) : '—'}</td>
                <td>${dinero(a.importeApartado)}</td>
                <td>${dinero(abonado)}</td>
                <td style="color:#dc2626; font-weight:bold;">${dinero(a.saldoPendiente)}</td>
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

    const selectorCuentas = window._buildSelectorCuentas ? window._buildSelectorCuentas('abonoCuentaApartado', false) : '<select id="abonoCuentaApartado" style="width:100%;padding:10px;border-radius:6px;border:1px solid #cbd5e1;"><option value="efectivo">💵 Efectivo Principal</option></select>';
    
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
    (ap.abonos || []).forEach(ab => {
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
    document.getElementById('abonoFechaApartado').value = window.obtenerHoyInputMX ? window.obtenerHoyInputMX() : new Date().toISOString().split('T')[0];
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
    
    const selCuenta = document.getElementById('abonoCuentaApartado');
    const cuentaId = selCuenta ? selCuenta.value : 'efectivo';
    const etiquetaCuenta = selCuenta && selCuenta.selectedIndex >= 0 ? selCuenta.options[selCuenta.selectedIndex].text : 'Efectivo';

    if (!folio || !monto || monto <= 0) { alert('Monto inválido'); return; }

    const apartados = obtenerApartados();
    const ap = apartados.find(a => a.folio === folio);
    if (!ap) { alert('No se encontró el apartado.'); return; }

    const saldoActual = Number(ap.saldoPendiente) || 0;
    const abonosPendientes = StorageService.get("abonosPendientes", []);
    const pendientePorAutorizar = abonosPendientes
        .filter(p => (p.tipo === 'apartado' || p.origen === 'apartados' || p.folioApartado) && (p.folioApartado || p.folioCXC) === folio)
        .reduce((s, p) => s + (Number(p.montoAbonado) || 0), 0);
    const saldoDisponible = Math.max(0, saldoActual - pendientePorAutorizar);
    if (monto > saldoDisponible + 0.01) {
        alert(`El abono (${dinero(monto)}) excede el saldo disponible del apartado (${dinero(saldoDisponible)}).`);
        return;
    }

    const msjConf = `⚠️ ABONO PROVISIONAL DE APARTADO\n\nFolio: ${folio}\nMonto recibido: ${dinero(monto)}\nDestino solicitado: ${etiquetaCuenta}\n\nSe emitirá recibo provisional y quedará en la Bóveda de Autorizaciones. Auditoría deberá aprobarlo para mover caja y saldo.\n\n¿Deseas continuar?`;
    if (!confirm(msjConf)) return;

    const fechaIso = window.localISO ? window.localISO(fecha + 'T12:00:00') : new Date(fecha + 'T12:00:00').toISOString();
    const nuevoSaldoEstimado = Math.max(0, saldoDisponible - monto);
    abonosPendientes.push({
        id: Date.now(),
        tipo: 'apartado',
        origen: 'apartados',
        fechaCaptura: window.formatearFechaCortaMX ? window.formatearFechaCortaMX(new Date()) : new Date().toLocaleDateString('es-MX'),
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
    });
    StorageService.set("abonosPendientes", abonosPendientes);

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
