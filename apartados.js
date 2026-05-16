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

function registrarAbonoApartado(folio, monto, fechaAbono) {
    const apartados = StorageService.get('apartados', []);
    const ap = apartados.find(a => a.folio === folio);
    if (!ap) return false;
    ap.abonos.push({
        monto,
        fechaAbono: fechaAbono || window.localISO(new Date())
    });
    ap.saldoPendiente -= monto;
    if (ap.saldoPendiente <= 0) ap.estado = 'Liquidado';
    StorageService.set('apartados', apartados);
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
        // Juntamos los botones en una sola columna llamada "Acciones"
        html += `<table class="tabla-admin"><thead><tr><th>Folio</th><th>Cliente</th><th>Fecha</th><th>Compromiso</th><th>Abonado</th><th>Pendiente</th><th>Estado</th><th style="text-align:center;">Acciones</th></tr></thead><tbody>`;
        
        apartados.forEach(a => {
            const abonado = a.abonos.reduce((s, ab) => s + ab.monto, a.importeApartado || 0);
            html += `<tr>
                <td><strong>${a.folio}</strong></td>
                <td>${a.clienteNombre}</td>
                <td>${window.formatearFechaCortaMX(a.fechaApartado)}</td>
                <td>${a.fechaCompromiso ? window.formatearFechaCortaMX(a.fechaCompromiso) : '-'}</td>
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
                    </div>
                </td>
            </tr>`;
        });
        html += `</tbody></table>`;
    }

    const cont = document.getElementById('contenidoApartados');
    if (cont) cont.innerHTML = html;

    // Crear Modales si no existen (Se mantiene intacto tu código original)
    if (!document.getElementById('modalHistorialAbonos')) {
        const modalHist = document.createElement('div');
        modalHist.id = 'modalHistorialAbonos';
        modalHist.style = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:9999;';
        modalHist.innerHTML = `<div style="background:white;max-width:400px;margin:80px auto;padding:30px;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.12);"><h3>📜 Historial de Abonos</h3><div id="historialAbonosContenido"></div><div style="display:flex;gap:10px;margin-top:20px;"><button onclick="cerrarHistorialAbonos()" style="flex:1;padding:10px;background:#6b7280;color:white;border:none;border-radius:6px;cursor:pointer;">✕ Cerrar</button></div></div>`;
        document.body.appendChild(modalHist);
    }

    if (!document.getElementById('modalAbonoApartado')) {
        const modalAbono = document.createElement('div');
        modalAbono.id = 'modalAbonoApartado';
        modalAbono.style = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:9999;';
        modalAbono.innerHTML = `<div style="background:white;max-width:400px;margin:80px auto;padding:30px;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.12);"><h3>➕ Registrar Abono</h3><div style="margin-bottom:12px;"><label>Folio:</label><input id="abonoFolioApartado" type="text" readonly style="width:100%;padding:8px;margin-top:4px;"></div><div style="margin-bottom:12px;"><label>Monto:</label><input id="abonoMontoApartado" type="number" min="1" style="width:100%;padding:8px;margin-top:4px;"></div><div style="margin-bottom:12px;"><label>Fecha:</label><input id="abonoFechaApartado" type="date" style="width:100%;padding:8px;margin-top:4px;"></div><div style="display:flex;gap:10px;"><button onclick="registrarAbonoApartadoDesdeModal()" style="flex:1;padding:10px;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">💾 Guardar</button><button onclick="cerrarModalAbonoApartado()" style="flex:1;padding:10px;background:#6b7280;color:white;border:none;border-radius:6px;cursor:pointer;">✕ Cancelar</button></div></div>`;
        document.body.appendChild(modalAbono);
    }
}

function cerrarHistorialAbonos() {
    const modal = document.getElementById('modalHistorialAbonos');
    if (modal) modal.style.display = 'none';
}

function abrirModalAbonoApartado(folio) {
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
    if (!folio || !monto || monto <= 0) { alert('Monto inválido'); return; }

    // --- NUEVO: RESUMEN Y CONFIRMACIÓN ---
    const formatoDinero = (val) => '$' + Number(val).toLocaleString('en-US', {minimumFractionDigits: 2});
    const msjConf = `⚠️ RESUMEN DE OPERACIÓN - ¿ABONAR A APARTADO?\n\nFolio: ${folio}\nMonto ingresado: ${formatoDinero(monto)}\n\n¿Deseas registrar este ingreso en el apartado?`;
    if (!confirm(msjConf)) return;
    // --- FIN DE CONFIRMACIÓN ---

    if (!registrarAbonoApartado(folio, monto, window.localISO(fecha + 'T12:00:00'))) {
        alert('No se pudo registrar el abono');
        return;
    }
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