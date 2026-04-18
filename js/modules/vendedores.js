// ===== VENDEDORES Y COMISIONES =====

function renderGestionVendedores() {
    const cont = document.getElementById('contenidoVendedores');
    if (!cont) return;
    const vendedores = StorageService.get('vendedores', []);
    const comisiones = StorageService.get('comisionesRegistradas', []);
    const pendTotal = comisiones.filter(c => c.estado === 'Pendiente').reduce((s, c) => s + c.montoComision, 0);

    const rows = vendedores.map(v => {
        const comisVend = comisiones.filter(c => c.vendedorId === v.id);
        const pendVend = comisVend.filter(c => c.estado === 'Pendiente').reduce((s, c) => s + c.montoComision, 0);
        return `<tr>
          <td style="padding:10px;">${v.nombre}</td>
          <td style="padding:10px;text-align:center;">${v.telefono || '-'}</td>
          <td style="padding:10px;text-align:center;">${v.porcentajeComision || 0}%</td>
          <td style="padding:10px;text-align:right;">${dinero(pendVend)}</td>
          <td style="padding:10px;text-align:center;"><span style="color:${v.activo ? '#16a34a' : '#9ca3af'};font-weight:bold;">${v.activo ? '✅ Activo' : '⛔ Inactivo'}</span></td>
          <td style="padding:10px;text-align:center;display:flex;gap:6px;justify-content:center;">
            <button onclick="editarVendedor(${v.id})" style="background:none;border:none;cursor:pointer;font-size:17px;" title="Editar">✏️</button>
            <button onclick="eliminarVendedor(${v.id})" style="background:none;border:none;cursor:pointer;font-size:17px;" title="Eliminar">🗑️</button>
          </td>
        </tr>`;
    }).join('');

    cont.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:20px;">
        <div style="background:#eff6ff;padding:20px;border-radius:10px;text-align:center;">
          <small style="color:#1e40af;">VENDEDORES ACTIVOS</small><br>
          <strong style="font-size:28px;color:#1e40af;">${vendedores.filter(v => v.activo).length}</strong>
        </div>
        <div style="background:#fef3c7;padding:20px;border-radius:10px;text-align:center;">
          <small style="color:#d97706;">COMISIONES PENDIENTES</small><br>
          <strong style="font-size:28px;color:#d97706;">${dinero(pendTotal)}</strong>
        </div>
        <div style="background:#f0fdf4;padding:20px;border-radius:10px;text-align:center;">
          <small style="color:#16a34a;">TOTAL COMISIONES</small><br>
          <strong style="font-size:28px;color:#16a34a;">${comisiones.length}</strong>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="margin:0;color:#1e40af;">👤 Vendedores</h3>
        <div style="display:flex;gap:10px;">
          <button onclick="abrirFormVendedor()" style="padding:10px 18px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">➕ Nuevo Vendedor</button>
          <button onclick="renderReporteComisiones()" style="padding:10px 18px;background:#7c3aed;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">📊 Reporte Comisiones</button>
        </div>
      </div>
      <div style="background:white;padding:20px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);margin-bottom:20px;">
        ${vendedores.length === 0 ? '<p style="color:#9ca3af;text-align:center;padding:20px;">No hay vendedores registrados.</p>' : `
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead><tr style="background:#f3f4f6;">
              <th style="padding:10px;text-align:left;">Nombre</th>
              <th style="padding:10px;text-align:center;">Teléfono</th>
              <th style="padding:10px;text-align:center;">% Comisión</th>
              <th style="padding:10px;text-align:right;">Comisión Pendiente</th>
              <th style="padding:10px;text-align:center;">Estado</th>
              <th style="padding:10px;text-align:center;">Acciones</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`}
      </div>
      <div id="reporteComisionesArea"></div>`;
}

function abrirFormVendedor(id) {
    const vendedores = StorageService.get('vendedores', []);
    const v = id ? vendedores.find(x => x.id === id) : null;
    const html = `
    <div data-modal="form-vendedor" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;">
      <div style="background:white;border-radius:12px;width:100%;max-width:480px;padding:28px;">
        <h2 style="margin:0 0 20px;color:#1e40af;">${v ? '✏️ Editar Vendedor' : '➕ Nuevo Vendedor'}</h2>
        <input type="hidden" id="vndId" value="${v ? v.id : ''}">
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">NOMBRE</label>
            <input type="text" id="vndNombre" value="${v ? v.nombre : ''}" placeholder="Nombre completo" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">TELÉFONO</label>
            <input type="text" id="vndTelefono" value="${v ? (v.telefono || '') : ''}" placeholder="10 dígitos" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">% DE COMISIÓN</label>
            <input type="number" id="vndComision" value="${v ? (v.porcentajeComision || 0) : 0}" min="0" max="100" step="0.1" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
          </div>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
            <input type="checkbox" id="vndActivo" ${v ? (v.activo ? 'checked' : '') : 'checked'} style="width:18px;height:18px;">
            <span style="font-size:14px;font-weight:bold;">Activo</span>
          </label>
        </div>
        <div style="display:flex;gap:10px;margin-top:20px;">
          <button onclick="guardarVendedor()" style="flex:1;padding:12px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">💾 Guardar</button>
          <button onclick="document.querySelector('[data-modal=form-vendedor]')?.remove()" style="padding:12px 20px;background:#6b7280;color:white;border:none;border-radius:6px;cursor:pointer;">✕ Cancelar</button>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

function guardarVendedor() {
    const id = document.getElementById('vndId')?.value;
    const nombre = document.getElementById('vndNombre')?.value.trim();
    const telefono = document.getElementById('vndTelefono')?.value.trim();
    const porcentajeComision = parseFloat(document.getElementById('vndComision')?.value) || 0;
    const activo = document.getElementById('vndActivo')?.checked ?? true;
    if (!nombre) return alert('⚠️ El nombre es obligatorio.');
    const vendedores = StorageService.get('vendedores', []);
    if (id) {
        const idx = vendedores.findIndex(v => String(v.id) === String(id));
        if (idx !== -1) { vendedores[idx] = { ...vendedores[idx], nombre, telefono, porcentajeComision, activo }; }
    } else {
        vendedores.push({ id: Date.now(), nombre, telefono, porcentajeComision, activo });
    }
    StorageService.set('vendedores', vendedores);
    document.querySelector('[data-modal="form-vendedor"]')?.remove();
    renderGestionVendedores();
}

function editarVendedor(id) { abrirFormVendedor(id); }

function eliminarVendedor(id) {
    if (!confirm('¿Eliminar este vendedor?')) return;
    let vendedores = StorageService.get('vendedores', []);
    vendedores = vendedores.filter(v => v.id !== id);
    StorageService.set('vendedores', vendedores);
    renderGestionVendedores();
}

function registrarComisionVenta(folio, total, vendedorId) {
    const vendedores = StorageService.get('vendedores', []);
    const v = vendedores.find(x => String(x.id) === String(vendedorId));
    if (!v) return;
    const montoComision = total * (v.porcentajeComision / 100);
    const comisiones = StorageService.get('comisionesRegistradas', []);
    comisiones.push({
        id: Date.now(),
        vendedorId: v.id,
        vendedorNombre: v.nombre,
        folio,
        totalVenta: total,
        montoComision,
        fecha: new Date().toISOString(),
        estado: 'Pendiente'
    });
    StorageService.set('comisionesRegistradas', comisiones);
}

function renderReporteComisiones() {
    const cont = document.getElementById('reporteComisionesArea');
    if (!cont) return;
    const comisiones = StorageService.get('comisionesRegistradas', []);
    if (comisiones.length === 0) {
        cont.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:20px;">No hay comisiones registradas.</p>';
        return;
    }
    const rows = comisiones.slice().reverse().map(c => `<tr>
      <td style="padding:8px;">${c.vendedorNombre}</td>
      <td style="padding:8px;">${c.folio}</td>
      <td style="padding:8px;text-align:right;">${dinero(c.totalVenta)}</td>
      <td style="padding:8px;text-align:right;font-weight:bold;">${dinero(c.montoComision)}</td>
      <td style="padding:8px;">${new Date(c.fecha).toLocaleDateString('es-MX')}</td>
      <td style="padding:8px;text-align:center;"><span style="color:${c.estado === 'Pendiente' ? '#d97706' : '#16a34a'};font-weight:bold;">${c.estado}</span></td>
      <td style="padding:8px;text-align:center;">${c.estado === 'Pendiente' ? `<button onclick="pagarComision(${c.id})" style="padding:4px 10px;background:#16a34a;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">💰 Pagar</button>` : '✅'}</td>
    </tr>`).join('');
    cont.innerHTML = `
      <h3 style="color:#7c3aed;margin-top:20px;">📊 Reporte de Comisiones</h3>
      <div style="background:white;padding:20px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="background:#f3f4f6;">
              <th style="padding:8px;text-align:left;">Vendedor</th>
              <th style="padding:8px;text-align:left;">Folio</th>
              <th style="padding:8px;text-align:right;">Venta</th>
              <th style="padding:8px;text-align:right;">Comisión</th>
              <th style="padding:8px;text-align:left;">Fecha</th>
              <th style="padding:8px;text-align:center;">Estado</th>
              <th style="padding:8px;text-align:center;">Acción</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
}

function pagarComision(id) {
    const comisiones = StorageService.get('comisionesRegistradas', []);
    const idx = comisiones.findIndex(c => c.id === id);
    if (idx === -1) return;
    comisiones[idx].estado = 'Pagada';
    StorageService.set('comisionesRegistradas', comisiones);
    renderGestionVendedores();
}

window.renderGestionVendedores = renderGestionVendedores;
window.abrirFormVendedor = abrirFormVendedor;
window.guardarVendedor = guardarVendedor;
window.editarVendedor = editarVendedor;
window.eliminarVendedor = eliminarVendedor;
window.registrarComisionVenta = registrarComisionVenta;
window.renderReporteComisiones = renderReporteComisiones;
window.pagarComision = pagarComision;
