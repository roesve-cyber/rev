// ===== PROGRAMA DE PUNTOS / FIDELIDAD =====

function _cfgPuntos() {
    return StorageService.get('programaPuntos', { puntosXCien: 1, pesosPorPunto: 0.10, activo: true });
}

function _puntosCliente(clienteId) {
    const todos = StorageService.get('puntosPorCliente', []);
    return todos.find(p => String(p.clienteId) === String(clienteId)) || { clienteId, puntos: 0, historial: [] };
}

function acumularPuntosCliente(clienteId, nombre, total, folio) {
    const cfg = _cfgPuntos();
    if (!cfg.activo) return;
    const puntos = Math.floor((total / 100) * cfg.puntosXCien);
    if (puntos <= 0) return;
    const todos = StorageService.get('puntosPorCliente', []);
    const idx = todos.findIndex(p => String(p.clienteId) === String(clienteId));
    const entrada = {
        fecha: new Date().toISOString(),
        tipo: 'acumulado',
        puntos,
        folio,
        descripcion: `Compra ${folio} — ${dinero(total)}`
    };
    if (idx !== -1) {
        todos[idx].puntos += puntos;
        todos[idx].historial = todos[idx].historial || [];
        todos[idx].historial.push(entrada);
    } else {
        todos.push({ clienteId, nombre, puntos, historial: [entrada] });
    }
    StorageService.set('puntosPorCliente', todos);
}

function canjearPuntosDescuento(clienteId, puntosACanjear) {
    const cfg = _cfgPuntos();
    const todos = StorageService.get('puntosPorCliente', []);
    const idx = todos.findIndex(p => String(p.clienteId) === String(clienteId));
    if (idx === -1) return 0;
    const disponibles = todos[idx].puntos || 0;
    const canjear = Math.min(puntosACanjear, disponibles);
    const montoDescuento = canjear * cfg.pesosPorPunto;
    todos[idx].puntos -= canjear;
    todos[idx].historial = todos[idx].historial || [];
    todos[idx].historial.push({
        fecha: new Date().toISOString(),
        tipo: 'canje',
        puntos: -canjear,
        descripcion: `Canje de ${canjear} puntos = ${dinero(montoDescuento)} de descuento`
    });
    StorageService.set('puntosPorCliente', todos);
    return montoDescuento;
}

function renderPanelPuntos() {
    const cont = document.getElementById('contenidoPuntos');
    if (!cont) return;
    const cfg = _cfgPuntos();
    const todos = StorageService.get('puntosPorCliente', []);
    const clientesLista = StorageService.get('clientes', []);

    const rows = todos.map(p => {
        const cli = clientesLista.find(c => String(c.id) === String(p.clienteId));
        const nombre = cli ? cli.nombre : (p.nombre || 'Desconocido');
        return `<tr>
          <td style="padding:10px;">${nombre}</td>
          <td style="padding:10px;text-align:center;"><strong style="color:#1e40af;font-size:16px;">${p.puntos || 0}</strong></td>
          <td style="padding:10px;text-align:right;">${dinero((p.puntos || 0) * cfg.pesosPorPunto)}</td>
          <td style="padding:10px;text-align:center;">
            <button onclick="abrirHistorialPuntosCliente('${p.clienteId}')" style="background:none;border:none;cursor:pointer;font-size:17px;" title="Ver historial">📋</button>
          </td>
        </tr>`;
    }).join('');

    cont.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:20px;">
        <div style="background:#eff6ff;padding:20px;border-radius:10px;text-align:center;">
          <small style="color:#1e40af;">PUNTOS POR CADA $100</small><br>
          <strong style="font-size:28px;color:#1e40af;">${cfg.puntosXCien}</strong>
        </div>
        <div style="background:#f0fdf4;padding:20px;border-radius:10px;text-align:center;">
          <small style="color:#16a34a;">VALOR POR PUNTO</small><br>
          <strong style="font-size:28px;color:#16a34a;">${dinero(cfg.pesosPorPunto)}</strong>
        </div>
        <div style="background:${cfg.activo ? '#f0fdf4' : '#fef2f2'};padding:20px;border-radius:10px;text-align:center;">
          <small style="color:${cfg.activo ? '#16a34a' : '#dc2626'};">ESTADO DEL PROGRAMA</small><br>
          <strong style="font-size:22px;color:${cfg.activo ? '#16a34a' : '#dc2626'};">${cfg.activo ? '✅ Activo' : '❌ Inactivo'}</strong>
        </div>
      </div>
      <div style="background:white;padding:20px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);margin-bottom:20px;">
        <h3 style="margin:0 0 16px;color:#1e40af;">⚙️ Configurar Programa</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr auto auto;gap:12px;align-items:end;">
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">Puntos por $100</label>
            <input type="number" id="cfgPuntosXCien" value="${cfg.puntosXCien}" min="0" step="0.1"
                   style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">Pesos por punto</label>
            <input type="number" id="cfgPesosPorPunto" value="${cfg.pesosPorPunto}" min="0" step="0.01"
                   style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">Activo</label>
            <input type="checkbox" id="cfgPuntosActivo" ${cfg.activo ? 'checked' : ''}
                   style="width:20px;height:20px;margin-top:8px;display:block;">
          </div>
          <button onclick="guardarConfigPuntos()" style="padding:9px 18px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">💾 Guardar</button>
        </div>
      </div>
      <div style="background:white;padding:20px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <h3 style="margin:0 0 16px;color:#1e40af;">👥 Clientes con Puntos (${todos.length})</h3>
        ${todos.length === 0 ? '<p style="color:#9ca3af;text-align:center;padding:20px;">Ningún cliente tiene puntos todavía.</p>' : `
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead><tr style="background:#f3f4f6;">
              <th style="padding:10px;text-align:left;">Cliente</th>
              <th style="padding:10px;text-align:center;">Puntos</th>
              <th style="padding:10px;text-align:right;">Valor Canjeable</th>
              <th style="padding:10px;text-align:center;">Historial</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`}
      </div>`;
}

function guardarConfigPuntos() {
    const puntosXCien = parseFloat(document.getElementById('cfgPuntosXCien')?.value) || 1;
    const pesosPorPunto = parseFloat(document.getElementById('cfgPesosPorPunto')?.value) || 0.10;
    const activo = document.getElementById('cfgPuntosActivo')?.checked ?? true;
    StorageService.set('programaPuntos', { puntosXCien, pesosPorPunto, activo });
    alert('✅ Configuración guardada.');
    renderPanelPuntos();
}

function abrirHistorialPuntosCliente(clienteId) {
    const p = _puntosCliente(clienteId);
    const cfg = _cfgPuntos();
    const clientesLista = StorageService.get('clientes', []);
    const cli = clientesLista.find(c => String(c.id) === String(clienteId));
    const nombre = cli ? cli.nombre : (p.nombre || 'Cliente');
    const historial = (p.historial || []).slice().reverse();
    const rows = historial.map(h => {
        const color = h.tipo === 'acumulado' ? '#16a34a' : '#dc2626';
        const signo = h.tipo === 'acumulado' ? '+' : '';
        return `<tr>
          <td style="padding:8px;">${new Date(h.fecha).toLocaleDateString('es-MX')}</td>
          <td style="padding:8px;">${h.descripcion || ''}</td>
          <td style="padding:8px;text-align:center;color:${color};font-weight:bold;">${signo}${h.puntos}</td>
        </tr>`;
    }).join('');

    const html = `
    <div data-modal="historial-puntos" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;">
      <div style="background:white;border-radius:12px;width:100%;max-width:600px;padding:28px;max-height:80vh;overflow-y:auto;margin:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h2 style="margin:0;color:#1e40af;">⭐ Puntos de ${nombre}</h2>
          <button onclick="document.querySelector('[data-modal=historial-puntos]')?.remove()" style="background:none;border:none;font-size:22px;cursor:pointer;">✕</button>
        </div>
        <div style="background:#eff6ff;padding:16px;border-radius:8px;margin-bottom:20px;text-align:center;">
          <strong style="font-size:32px;color:#1e40af;">${p.puntos || 0} pts</strong><br>
          <span style="color:#3b82f6;">= ${dinero((p.puntos || 0) * cfg.pesosPorPunto)} en descuentos</span>
        </div>
        ${historial.length === 0 ? '<p style="color:#9ca3af;text-align:center;padding:20px;">Sin movimientos.</p>' : `
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="background:#f3f4f6;">
            <th style="padding:8px;text-align:left;">Fecha</th>
            <th style="padding:8px;text-align:left;">Descripción</th>
            <th style="padding:8px;text-align:center;">Puntos</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>`}
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

window.renderPanelPuntos = renderPanelPuntos;
window.acumularPuntosCliente = acumularPuntosCliente;
window.canjearPuntosDescuento = canjearPuntosDescuento;
window.abrirHistorialPuntosCliente = abrirHistorialPuntosCliente;
window.guardarConfigPuntos = guardarConfigPuntos;
