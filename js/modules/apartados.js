// ===== APARTADOS: Seguimiento y gestión =====

// Registrar un nuevo apartado
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

// Registrar un abono a un apartado
function registrarAbonoApartado(folio, monto, fechaAbono) {
    const apartados = StorageService.get('apartados', []);
    const ap = apartados.find(a => a.folio === folio);
    if (!ap) return false;
    ap.abonos.push({
        monto,
        fechaAbono: fechaAbono || new Date().toISOString()
    });
    ap.saldoPendiente -= monto;
    if (ap.saldoPendiente <= 0) ap.estado = 'Liquidado';
    StorageService.set('apartados', apartados);
    return true;
}

// Consultar todos los apartados
function obtenerApartados() {
    return StorageService.get('apartados', []);
}

// Mostrar reporte de apartados
function renderApartados() {
    const apartados = obtenerApartados();
    let html = `<h2>📦 Apartados</h2>`;
    if (apartados.length === 0) {
        html += '<p>No hay apartados registrados.</p>';
    } else {
        html += `<table class=\"tabla-admin\"><thead><tr><th>Folio</th><th>Cliente</th><th>Fecha</th><th>Compromiso</th><th>Abonado</th><th>Pendiente</th><th>Estado</th><th>Abonos</th><th>Historial</th></tr></thead><tbody>`;
        apartados.forEach(a => {
            const abonado = a.abonos.reduce((s, ab) => s + ab.monto, a.importeApartado);
            html += `<tr><td>${a.folio}</td><td>${a.clienteNombre}</td><td>${new Date(a.fechaApartado).toLocaleDateString('es-MX')}</td><td>${a.fechaCompromiso ? new Date(a.fechaCompromiso).toLocaleDateString('es-MX') : '-'}</td><td>${dinero(abonado)}</td><td>${dinero(a.saldoPendiente)}</td><td>${a.estado}</td><td><button onclick=\"abrirModalAbonoApartado('${a.folio}')\" style=\"padding:4px 10px;background:#2563eb;color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px;\">➕ Abonar</button></td><td><button onclick=\"abrirHistorialAbonos('${a.folio}')\" style=\"padding:4px 10px;background:#7c3aed;color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px;\">📜 Ver</button></td></tr>`;
        });
        html += `</tbody></table>`;
    }
    // Modal para historial de abonos
    if (!document.getElementById('modalHistorialAbonos')) {
        const modal = document.createElement('div');
        modal.id = 'modalHistorialAbonos';
        modal.style.display = 'none';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.background = 'rgba(0,0,0,0.4)';
        modal.style.zIndex = '9999';
        modal.innerHTML = `<div style=\"background:white;max-width:400px;margin:80px auto;padding:30px;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.12);\"><h3>📜 Historial de Abonos</h3><div id=\"historialAbonosContenido\"></div><div style=\"display:flex;gap:10px;margin-top:20px;\"><button onclick=\"cerrarHistorialAbonos()\" style=\"flex:1;padding:10px;background:#6b7280;color:white;border:none;border-radius:6px;cursor:pointer;\">✕ Cerrar</button></div></div>`;
        document.body.appendChild(modal);
    }
}

function abrirHistorialAbonos(folio) {
    const apartados = obtenerApartados();
    const ap = apartados.find(a => a.folio === folio);
    const cont = document.getElementById('historialAbonosContenido');
    if (!ap || !cont) return;
    if (!ap.abonos.length) {
        cont.innerHTML = '<p>No hay abonos registrados.</p>';
    } else {
        let html = '<table style="width:100%;font-size:14px;"><thead><tr><th>Monto</th><th>Fecha</th></tr></thead><tbody>';
        ap.abonos.forEach(ab => {
            html += `<tr><td>${dinero(ab.monto)}</td><td>${new Date(ab.fechaAbono).toLocaleDateString('es-MX')}</td></tr>`;
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

window.abrirHistorialAbonos = abrirHistorialAbonos;
window.cerrarHistorialAbonos = cerrarHistorialAbonos;
    }
    // Modal para abonos
    if (!document.getElementById('modalAbonoApartado')) {
        const modal = document.createElement('div');
        modal.id = 'modalAbonoApartado';
        modal.style.display = 'none';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.background = 'rgba(0,0,0,0.4)';
        modal.style.zIndex = '9999';
        modal.innerHTML = `<div style=\"background:white;max-width:400px;margin:80px auto;padding:30px;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.12);\"><h3>➕ Registrar Abono</h3><div style=\"margin-bottom:12px;\"><label>Folio:</label><input id=\"abonoFolioApartado\" type=\"text\" readonly style=\"width:100%;padding:8px;margin-top:4px;\"></div><div style=\"margin-bottom:12px;\"><label>Monto:</label><input id=\"abonoMontoApartado\" type=\"number\" min=\"1\" style=\"width:100%;padding:8px;margin-top:4px;\"></div><div style=\"margin-bottom:12px;\"><label>Fecha:</label><input id=\"abonoFechaApartado\" type=\"date\" style=\"width:100%;padding:8px;margin-top:4px;\"></div><div style=\"display:flex;gap:10px;\"><button onclick=\"registrarAbonoApartadoDesdeModal()\" style=\"flex:1;padding:10px;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;\">💾 Guardar</button><button onclick=\"cerrarModalAbonoApartado()\" style=\"flex:1;padding:10px;background:#6b7280;color:white;border:none;border-radius:6px;cursor:pointer;\">✕ Cancelar</button></div></div>`;
        document.body.appendChild(modal);
    }
}

// Abrir modal de abono
function abrirModalAbonoApartado(folio) {
    const modal = document.getElementById('modalAbonoApartado');
    if (!modal) return;
    document.getElementById('abonoFolioApartado').value = folio;
    document.getElementById('abonoMontoApartado').value = '';
    document.getElementById('abonoFechaApartado').value = new Date().toISOString().substring(0,10);
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
    if (!registrarAbonoApartado(folio, monto, fecha)) {
        alert('No se pudo registrar el abono');
        return;
    }
    cerrarModalAbonoApartado();
    renderApartados();
}

window.abrirModalAbonoApartado = abrirModalAbonoApartado;
window.cerrarModalAbonoApartado = cerrarModalAbonoApartado;
window.registrarAbonoApartadoDesdeModal = registrarAbonoApartadoDesdeModal;
    const cont = document.getElementById('contenidoApartados');
    if (cont) cont.innerHTML = html;
}

window.registrarApartado = registrarApartado;
window.registrarAbonoApartado = registrarAbonoApartado;
window.obtenerApartados = obtenerApartados;
window.renderApartados = renderApartados;