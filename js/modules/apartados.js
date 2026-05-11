// ===== APARTADOS: Seguimiento y gestión =====

function registrarApartado({folio, clienteId, clienteNombre, fechaApartado, importeApartado, fechaCompromiso, saldoPendiente, articulos}) {
    const apartados = StorageService.get('apartados', []);
    apartados.push({
        id: Date.now(),
        folio,
        clienteId,
        clienteNombre,
        fechaApartado,
        importeApartado,
        fechaCompromiso,
        saldoPendiente,
        articulos,
        abonos: [],
        estado: 'Pendiente'
    });
    StorageService.set('apartados', apartados);
}

function registrarAbonoApartado(folio, monto, fechaAbono, cuentaId, cuentaEtiqueta) {
    const apartados = StorageService.get('apartados', []);
    const ap = apartados.find(a => a.folio === folio);
    if (!ap) return false;
    
    // Valores por defecto por si fallara el envío de cuenta
    const cId = cuentaId || 'efectivo';
    const cEti = cuentaEtiqueta || '💵 Efectivo Principal';
    
    ap.abonos.push({
        monto,
        fechaAbono: fechaAbono || new Date().toISOString(),
        cuentaId: cId,
        etiquetaCuenta: cEti
    });
    
    ap.saldoPendiente -= monto;
    if (ap.saldoPendiente <= 0) ap.estado = 'Liquidado';
    StorageService.set('apartados', apartados);
    
    // Conectar el dinero con el flujo de caja del sistema
    if (typeof window._ingresarCuenta === 'function') {
        window._ingresarCuenta({
            monto: monto,
            cuentaId: cId,
            etiqueta: cEti,
            concepto: `Abono a apartado ${folio} - ${ap.clienteNombre}`,
            referencia: `ABONO-APART-${folio}`,
            fecha: fechaAbono || new Date().toISOString()
        });
    }
    
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
        html += `<table class="tabla-admin"><thead><tr><th>Folio</th><th>Cliente</th><th>Fecha</th><th>Compromiso</th><th>Abonado</th><th>Pendiente</th><th>Estado</th><th>Abonos</th><th>Historial</th></tr></thead><tbody>`;
        apartados.forEach(a => {
            const abonado = a.abonos.reduce((s, ab) => s + ab.monto, a.importeApartado);
            html += `<tr>
                <td>${a.folio}</td>
                <td>${a.clienteNombre}</td>
                <td>${window.formatearFechaCortaMX(a.fechaApartado)}</td>
                <td>${a.fechaCompromiso ? window.formatearFechaCortaMX(a.fechaCompromiso) : '-'}</td>
                <td>${window.formatearDineroMX(abonado)}</td>
                <td style="color:#dc2626; font-weight:bold;">${dinero(a.saldoPendiente)}</td>
                <td>${a.estado}</td>
                <td><button onclick="abrirModalAbonoApartado('${a.folio}')" style="padding:4px 10px;background:#2563eb;color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px;">➕ Abonar</button></td>
                <td><button onclick="abrirHistorialAbonos('${a.folio}')" style="padding:4px 10px;background:#7c3aed;color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px;">📜 Ver</button></td>
            </tr>`;
        });
        html += `</tbody></table>`;
    }

    const cont = document.getElementById('contenidoApartados');
    if (cont) cont.innerHTML = html;

    // Crear Modal Historial
    if (!document.getElementById('modalHistorialAbonos')) {
        const modalHist = document.createElement('div');
        modalHist.id = 'modalHistorialAbonos';
        modalHist.style = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:9999;';
        modalHist.innerHTML = `<div style="background:white;max-width:450px;margin:80px auto;padding:30px;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.12);"><h3 style="color:#1e3a8a;margin-top:0;">📜 Historial de Abonos</h3><div id="historialAbonosContenido"></div><div style="display:flex;gap:10px;margin-top:20px;"><button onclick="cerrarHistorialAbonos()" style="flex:1;padding:10px;background:#6b7280;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">✕ Cerrar</button></div></div>`;
        document.body.appendChild(modalHist);
    }

    // Crear Modal Abono con el Enchufe Universal
    if (!document.getElementById('modalAbonoApartado')) {
        const modalAbono = document.createElement('div');
        modalAbono.id = 'modalAbonoApartado';
        modalAbono.style = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:9999;backdrop-filter:blur(3px);';
        
        let selectorCuentasHTML = '';
        if (typeof window._buildSelectorCuentas === 'function') {
            selectorCuentasHTML = window._buildSelectorCuentas('abonoCuentaApartado', false);
        } else {
            selectorCuentasHTML = `<select id="abonoCuentaApartado" style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:6px;"><option value="efectivo">💵 Efectivo Principal</option></select>`;
        }

        modalAbono.innerHTML = `
        <div style="background:white;max-width:400px;margin:80px auto;padding:30px;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.2);">
            <h3 style="margin-top:0; color:#1e3a8a;">➕ Registrar Abono</h3>
            
            <div style="margin-bottom:12px;">
                <label style="font-weight:bold; font-size:13px; color:#374151;">Folio:</label>
                <input id="abonoFolioApartado" type="text" readonly style="width:100%;padding:10px;margin-top:4px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;">
            </div>
            
            <div style="margin-bottom:12px;">
                <label style="font-weight:bold; font-size:13px; color:#374151;">Monto a recibir ($):</label>
                <input id="abonoMontoApartado" type="number" min="1" placeholder="0.00" style="width:100%;padding:10px;margin-top:4px;border:2px solid #3b82f6;border-radius:6px;font-size:16px;">
            </div>
            
            <div style="margin-bottom:12px;">
                <label style="font-weight:bold; font-size:13px; color:#374151;">Fecha:</label>
                <input id="abonoFechaApartado" type="date" style="width:100%;padding:10px;margin-top:4px;border:1px solid #d1d5db;border-radius:6px;">
            </div>
            
            <div style="margin-bottom:20px; background:#f0fdf4; padding:12px; border-radius:8px; border:1px solid #bbf7d0;">
                <label style="font-weight:bold; font-size:13px; color:#166534;">💳 ¿A qué caja/cuenta ingresa?</label>
                <div style="margin-top:6px;">${selectorCuentasHTML}</div>
            </div>
            
            <div style="display:flex;gap:10px;">
                <button onclick="registrarAbonoApartadoDesdeModal()" style="flex:1;padding:12px;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:15px;">✅ Guardar Abono</button>
                <button onclick="cerrarModalAbonoApartado()" style="flex:1;padding:12px;background:#e5e7eb;color:#4b5563;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">✕ Cancelar</button>
            </div>
        </div>`;
        document.body.appendChild(modalAbono);
    }
}

function abrirHistorialAbonos(folio) {
    const apartados = obtenerApartados();
    const ap = apartados.find(a => a.folio === folio);
    const cont = document.getElementById('historialAbonosContenido');
    if (!ap || !cont) return;
    if (!ap.abonos.length) {
        cont.innerHTML = '<p style="color:#64748b; text-align:center; padding:15px;">No hay abonos registrados.</p>';
    } else {
        let html = '<table style="width:100%;font-size:14px;border-collapse:collapse;"><thead><tr style="border-bottom:2px solid #e2e8f0;"><th style="padding:8px 4px;text-align:left;">Fecha</th><th style="padding:8px 4px;text-align:right;">Monto</th><th style="padding:8px 4px;text-align:left;padding-left:15px;">Cuenta receptora</th></tr></thead><tbody>';
        ap.abonos.forEach(ab => {
            html += `<tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:8px 4px;">${new Date(ab.fechaAbono).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                <td style="padding:8px 4px;text-align:right;font-weight:bold;color:#15803d;">${dinero(ab.monto)}</td>
                <td style="padding:8px 4px;padding-left:15px;color:#64748b;font-size:12px;">${ab.etiquetaCuenta || '💵 Efectivo'}</td>
            </tr>`;
        });
        html += '</tbody></table>';
        cont.innerHTML = html;
    }
    document.getElementById('modalHistorialAbonos').style.display = 'block';
}

function cerrarHistorialAbonos() {
    const modal = document.getElementById('modalHistorialAbonos');
    if (modal) modal.style.display = 'none';
}

function abrirModalAbonoApartado(folio) {
    // Forzamos a redibujar el modal para que el selector de cuentas traiga información fresca (Cajas nuevas agregadas, etc.)
    const modalExistente = document.getElementById('modalAbonoApartado');
    if (modalExistente) modalExistente.remove();
    
    renderApartados();

    const modal = document.getElementById('modalAbonoApartado');
    if (!modal) return;
    document.getElementById('abonoFolioApartado').value = folio;
    document.getElementById('abonoMontoApartado').value = '';
    document.getElementById('abonoFechaApartado').value = window.obtenerHoyInputMX();
    modal.style.display = 'block';
}

function cerrarModalAbonoApartado() {
    const modal = document.getElementById('modalAbonoApartado');
    if (modal) modal.style.display = 'none';
}

function registrarAbonoApartadoDesdeModal() {
    const folio = document.getElementById('abonoFolioApartado').value;
    const monto = parseFloat(document.getElementById('abonoMontoApartado').value);
    const fecha = document.getElementById('abonoFechaApartado').value;
    
    // Rescatar la cuenta seleccionada del nuevo DOM
    const selCuenta = document.getElementById('abonoCuentaApartado');
    const cuentaId = selCuenta ? selCuenta.value : 'efectivo';
    const cuentaEtiqueta = selCuenta && selCuenta.options.length > 0 ? selCuenta.options[selCuenta.selectedIndex].text : '💵 Efectivo Principal';

    if (!folio || !monto || monto <= 0) { alert('⚠️ Monto inválido'); return; }
    
    if (!registrarAbonoApartado(folio, monto, fecha, cuentaId, cuentaEtiqueta)) {
        alert('❌ No se pudo registrar el abono');
        return;
    }
    
    alert(`✅ Abono registrado exitosamente en: ${cuentaEtiqueta}`);
    cerrarModalAbonoApartado();
    renderApartados();
}

// Exportar
window.abrirHistorialAbonos = abrirHistorialAbonos;
window.cerrarHistorialAbonos = cerrarHistorialAbonos;
window.abrirModalAbonoApartado = abrirModalAbonoApartado;
window.cerrarModalAbonoApartado = cerrarModalAbonoApartado;
window.registrarAbonoApartadoDesdeModal = registrarAbonoApartadoDesdeModal;
window.registrarApartado = registrarApartado;
window.registrarAbonoApartado = registrarAbonoApartado;
window.obtenerApartados = obtenerApartados;
window.renderApartados = renderApartados;