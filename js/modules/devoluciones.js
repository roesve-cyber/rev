// ===== DEVOLUCIONES Y GARANTÍAS =====

function abrirModalDevolucion() {
    const html = `
    <div data-modal="devolucion" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:20px;">
      <div style="background:white;border-radius:12px;width:100%;max-width:640px;padding:28px;margin:auto;">
        <h2 style="margin:0 0 20px;color:#d97706;">↩️ Registrar Devolución</h2>
        <div style="display:grid;grid-template-columns:1fr auto;gap:12px;margin-bottom:16px;">
          <input type="text" id="devFolio" placeholder="Folio de venta (Ej: VTA-001)" style="padding:10px;border:1px solid #d1d5db;border-radius:6px;font-size:15px;">
          <button onclick="buscarVentaDevolucion()" style="padding:10px 18px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">🔍 Buscar</button>
        </div>
        <div id="devResultado"></div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

function buscarVentaDevolucion() {
    const folio = document.getElementById('devFolio')?.value.trim().toUpperCase();
    const cont = document.getElementById('devResultado');
    if (!folio || !cont) return;
    const ventas = StorageService.get('ventasRegistradas', []);
    const venta = ventas.find(v => (v.folio || '').toUpperCase() === folio);
    if (!venta) {
        cont.textContent = '';
        const p = document.createElement('p');
        p.style.cssText = 'color:#dc2626;text-align:center;padding:16px;';
        p.textContent = `❌ No se encontró la venta ${folio}`;
        cont.appendChild(p);
        return;
    }
    const arts = (venta.articulos || venta.carrito || []);
    const opcionesArts = arts.map((a, i) =>
        `<option value="${i}">${a.nombre.replace(/</g,'&lt;').replace(/>/g,'&gt;')} (x${a.cantidad || 1})</option>`).join('');
    const clienteNombre = (venta.clienteNombre || venta.nombre || 'Cliente').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const folioSafe = (venta.folio || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const fechaStr = new Date(venta.fecha || venta.fechaVenta).toLocaleDateString('es-MX');
    cont.innerHTML = `
      <div style="background:#f9fafb;padding:16px;border-radius:8px;margin-bottom:16px;">
        <strong>${folioSafe}</strong> — ${clienteNombre}<br>
        <small style="color:#6b7280;">${fechaStr} — ${dinero(venta.total || venta.totalVenta || 0)}</small>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div>
          <label style="font-size:12px;font-weight:bold;color:#374151;">ARTÍCULO A DEVOLVER</label>
          <select id="devArticulo" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">${opcionesArts}</select>
        </div>
        <div>
          <label style="font-size:12px;font-weight:bold;color:#374151;">CANTIDAD A DEVOLVER</label>
          <input type="number" id="devCantidad" value="1" min="1" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
        </div>
        <div>
          <label style="font-size:12px;font-weight:bold;color:#374151;">MOTIVO</label>
          <select id="devMotivo" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
            <option value="Defecto de fábrica">Defecto de fábrica</option>
            <option value="Producto dañado en entrega">Producto dañado en entrega</option>
            <option value="Cambio de opinión">Cambio de opinión</option>
            <option value="Talla/medida incorrecta">Talla/medida incorrecta</option>
            <option value="Garantía">Garantía</option>
            <option value="Otro">Otro</option>
          </select>
        </div>
        <div>
          <label style="font-size:12px;font-weight:bold;color:#374151;">NOTAS ADICIONALES</label>
          <textarea id="devNotas" rows="2" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;"></textarea>
        </div>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
          <input type="checkbox" id="devReingresarStock" checked style="width:18px;height:18px;">
          <span style="font-size:14px;font-weight:bold;">¿Reingresar al inventario?</span>
        </label>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px;">
        <button id="btnProcesarDev" style="flex:1;padding:12px;background:#d97706;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">✅ Procesar Devolución</button>
        <button onclick="document.querySelector('[data-modal=devolucion]')?.remove()" style="padding:12px 20px;background:#6b7280;color:white;border:none;border-radius:6px;cursor:pointer;">✕ Cancelar</button>
      </div>`;
    // Use addEventListener to avoid folio injection via onclick attribute
    const btn = document.getElementById('btnProcesarDev');
    if (btn) btn.addEventListener('click', function() { procesarDevolucion(folio); });
}

function procesarDevolucion(folio) {
    const idxArt = parseInt(document.getElementById('devArticulo')?.value) || 0;
    const cantidad = parseInt(document.getElementById('devCantidad')?.value) || 1;
    const motivo = document.getElementById('devMotivo')?.value || 'Otro';
    const notas = document.getElementById('devNotas')?.value.trim();
    const reingresarStock = document.getElementById('devReingresarStock')?.checked ?? true;
    const ventas = StorageService.get('ventasRegistradas', []);
    const venta = ventas.find(v => (v.folio || '').toUpperCase() === folio.toUpperCase());
    if (!venta) return;
    const arts = venta.articulos || venta.carrito || [];
    const art = arts[idxArt];
    if (!art) return;
    const devolucion = {
        id: Date.now(),
        folio: 'DEV-' + Date.now(),
        folioVenta: folio,
        clienteNombre: venta.clienteNombre || venta.nombre || 'Cliente',
        clienteId: venta.clienteId || null,
        productoId: art.id || art.productoId,
        productoNombre: art.nombre,
        cantidad,
        motivo,
        notas,
        reingresarStock,
        fecha: new Date().toISOString(),
        monto: (art.precioContado || art.precio || 0) * cantidad
    };
    const devoluciones = StorageService.get('historialDevoluciones', []);
    devoluciones.push(devolucion);
    StorageService.set('historialDevoluciones', devoluciones);

    if (reingresarStock) {
        const prods = StorageService.get('productos', []);
        const pidx = prods.findIndex(p => String(p.id) === String(art.id || art.productoId));
        if (pidx !== -1) {
            prods[pidx].stock = (prods[pidx].stock || 0) + cantidad;
            StorageService.set('productos', prods);
        }
    }

    document.querySelector('[data-modal="devolucion"]')?.remove();
    alert(`✅ Devolución registrada. Folio: ${devolucion.folio}`);
    if (document.getElementById('contenidoDevoluciones')) renderHistorialDevoluciones();
}

function renderHistorialDevoluciones() {
    const cont = document.getElementById('contenidoDevoluciones');
    if (!cont) return;
    const devoluciones = StorageService.get('historialDevoluciones', []);
    const rows = devoluciones.slice().reverse().map(d => `<tr>
      <td style="padding:10px;">${d.folio}</td>
      <td style="padding:10px;">${d.folioVenta}</td>
      <td style="padding:10px;">${d.clienteNombre}</td>
      <td style="padding:10px;">${d.productoNombre}</td>
      <td style="padding:10px;text-align:center;">${d.cantidad}</td>
      <td style="padding:10px;">${d.motivo}</td>
      <td style="padding:10px;text-align:right;">${dinero(d.monto)}</td>
      <td style="padding:10px;text-align:center;">${d.reingresarStock ? '✅' : '❌'}</td>
      <td style="padding:10px;text-align:center;">${new Date(d.fecha).toLocaleDateString('es-MX')}</td>
    </tr>`).join('');
    cont.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="margin:0;color:#d97706;">↩️ Historial de Devoluciones</h3>
        <button onclick="abrirModalDevolucion()" style="padding:10px 18px;background:#d97706;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">➕ Nueva Devolución</button>
      </div>
      <div style="background:white;padding:20px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        ${devoluciones.length === 0 ? '<p style="color:#9ca3af;text-align:center;padding:20px;">Sin devoluciones registradas.</p>' : `
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="background:#f3f4f6;">
              <th style="padding:10px;">Folio Dev.</th>
              <th style="padding:10px;">Folio Venta</th>
              <th style="padding:10px;">Cliente</th>
              <th style="padding:10px;">Producto</th>
              <th style="padding:10px;text-align:center;">Cant.</th>
              <th style="padding:10px;">Motivo</th>
              <th style="padding:10px;text-align:right;">Monto</th>
              <th style="padding:10px;text-align:center;">Stock</th>
              <th style="padding:10px;text-align:center;">Fecha</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`}
      </div>`;
}

// ===== GARANTÍAS =====
function registrarGarantia({ folio, productoId, clienteId, mesesGarantia }) {
    const ventas = StorageService.get('ventasRegistradas', []);
    const venta = ventas.find(v => (v.folio || '') === folio);
    const fecha = venta ? (venta.fecha || venta.fechaVenta || new Date().toISOString()) : new Date().toISOString();
    const fechaVenc = new Date(fecha);
    fechaVenc.setMonth(fechaVenc.getMonth() + (mesesGarantia || 12));
    const prods = StorageService.get('productos', []);
    const prod = prods.find(p => String(p.id) === String(productoId));
    const garantias = StorageService.get('garantiasProductos', []);
    garantias.push({
        id: Date.now(),
        folio,
        productoId,
        productoNombre: prod ? prod.nombre : 'Desconocido',
        clienteId,
        mesesGarantia: mesesGarantia || 12,
        fechaCompra: fecha,
        fechaVencimiento: fechaVenc.toISOString(),
        estado: 'Vigente',
        notas: ''
    });
    StorageService.set('garantiasProductos', garantias);
}

function renderControlGarantias() {
    const cont = document.getElementById('contenidoGarantias');
    if (!cont) return;
    const garantias = StorageService.get('garantiasProductos', []);
    const clientes = StorageService.get('clientes', []);
    const hoy = new Date();
    const en7dias = new Date(hoy.getTime() + 7 * 24 * 3600 * 1000);

    const rows = garantias.slice().reverse().map(g => {
        const cli = clientes.find(c => String(c.id) === String(g.clienteId));
        const nombre = cli ? cli.nombre : 'Cliente';
        const fv = new Date(g.fechaVencimiento);
        let estado = g.estado;
        if (estado !== 'En reclamación') {
            if (fv < hoy) estado = 'Vencida';
            else if (fv <= en7dias) estado = 'Próxima';
            else estado = 'Vigente';
        }
        const colors = { Vigente: '#16a34a', Próxima: '#d97706', Vencida: '#9ca3af', 'En reclamación': '#dc2626' };
        return `<tr>
          <td style="padding:10px;">${g.folio}</td>
          <td style="padding:10px;">${g.productoNombre}</td>
          <td style="padding:10px;">${nombre}</td>
          <td style="padding:10px;text-align:center;">${g.mesesGarantia} meses</td>
          <td style="padding:10px;text-align:center;">${new Date(g.fechaCompra).toLocaleDateString('es-MX')}</td>
          <td style="padding:10px;text-align:center;">${fv.toLocaleDateString('es-MX')}</td>
          <td style="padding:10px;text-align:center;"><span style="color:${colors[estado]};font-weight:bold;">${estado}</span></td>
          <td style="padding:10px;text-align:center;">${estado !== 'En reclamación' ? `<button onclick="marcarGarantiaReclamacion(${g.id})" style="padding:3px 8px;background:#dc2626;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">🔴 Reclamar</button>` : ''}</td>
        </tr>`;
    }).join('');

    cont.innerHTML = `
      <h3 style="color:#1e40af;margin-bottom:16px;">🛡️ Control de Garantías</h3>
      <div style="background:white;padding:20px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        ${garantias.length === 0 ? '<p style="color:#9ca3af;text-align:center;padding:20px;">Sin garantías registradas.</p>' : `
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="background:#f3f4f6;">
              <th style="padding:10px;">Folio Venta</th>
              <th style="padding:10px;">Producto</th>
              <th style="padding:10px;">Cliente</th>
              <th style="padding:10px;text-align:center;">Garantía</th>
              <th style="padding:10px;text-align:center;">F. Compra</th>
              <th style="padding:10px;text-align:center;">Vencimiento</th>
              <th style="padding:10px;text-align:center;">Estado</th>
              <th style="padding:10px;text-align:center;">Acción</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`}
      </div>`;
}

function marcarGarantiaReclamacion(id) {
    const garantias = StorageService.get('garantiasProductos', []);
    const idx = garantias.findIndex(g => g.id === id);
    if (idx === -1) return;
    garantias[idx].estado = 'En reclamación';
    StorageService.set('garantiasProductos', garantias);
    renderControlGarantias();
}

window.abrirModalDevolucion = abrirModalDevolucion;
window.buscarVentaDevolucion = buscarVentaDevolucion;
window.procesarDevolucion = procesarDevolucion;
window.renderHistorialDevoluciones = renderHistorialDevoluciones;
window.registrarGarantia = registrarGarantia;
window.renderControlGarantias = renderControlGarantias;
window.marcarGarantiaReclamacion = marcarGarantiaReclamacion;
