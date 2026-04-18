// ===== DESCUENTOS Y PROMOCIONES =====

function crearDescuento() {
    const html = `
    <div data-modal="nuevo-descuento" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;">
      <div style="background:white;border-radius:12px;width:100%;max-width:560px;padding:28px;max-height:90vh;overflow-y:auto;">
        <h2 style="margin:0 0 20px;color:#7c3aed;">🎯 Nuevo Descuento</h2>
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">NOMBRE</label>
            <input type="text" id="dscNombre" placeholder="Ej: Descuento de Temporada" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">TIPO</label>
            <select id="dscTipo" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
              <option value="porcentaje">% Porcentaje</option>
              <option value="monto_fijo">$ Monto Fijo</option>
              <option value="por_categoria">Por Categoría</option>
            </select>
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">VALOR (% o $)</label>
            <input type="number" id="dscValor" min="0" step="0.01" placeholder="Ej: 10" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">CATEGORÍAS (separadas por coma, solo para tipo categoría)</label>
            <input type="text" id="dscCategorias" placeholder="Ej: Salas, Recámaras" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label style="font-size:12px;font-weight:bold;color:#374151;">FECHA INICIO</label>
              <input type="date" id="dscFechaInicio" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
            </div>
            <div>
              <label style="font-size:12px;font-weight:bold;color:#374151;">FECHA FIN</label>
              <input type="date" id="dscFechaFin" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
            </div>
          </div>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
            <input type="checkbox" id="dscActivo" checked style="width:18px;height:18px;">
            <span style="font-size:14px;font-weight:bold;">Activo</span>
          </label>
        </div>
        <div style="display:flex;gap:10px;margin-top:20px;">
          <button onclick="guardarDescuento()" style="flex:1;padding:12px;background:#7c3aed;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">💾 Guardar</button>
          <button onclick="document.querySelector('[data-modal=nuevo-descuento]')?.remove()" style="padding:12px 20px;background:#6b7280;color:white;border:none;border-radius:6px;cursor:pointer;">✕ Cancelar</button>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

function guardarDescuento() {
    const nombre = document.getElementById('dscNombre')?.value.trim();
    const tipo = document.getElementById('dscTipo')?.value;
    const valor = parseFloat(document.getElementById('dscValor')?.value) || 0;
    const categoriasStr = document.getElementById('dscCategorias')?.value.trim();
    const fechaInicio = document.getElementById('dscFechaInicio')?.value;
    const fechaFin = document.getElementById('dscFechaFin')?.value;
    const activo = document.getElementById('dscActivo')?.checked ?? true;
    if (!nombre) return alert('⚠️ El nombre es obligatorio.');
    if (valor <= 0) return alert('⚠️ El valor debe ser mayor a 0.');
    const categorias = categoriasStr ? categoriasStr.split(',').map(s => s.trim()).filter(Boolean) : [];
    const desc = { id: Date.now(), nombre, tipo, valor, categorias, fechaInicio, fechaFin, activo };
    const lista = StorageService.get('descuentosActivos', []);
    lista.push(desc);
    StorageService.set('descuentosActivos', lista);
    document.querySelector('[data-modal="nuevo-descuento"]')?.remove();
    renderGestionDescuentos();
}

function renderGestionDescuentos() {
    const cont = document.getElementById('contenidoDescuentos');
    if (!cont) return;
    const lista = StorageService.get('descuentosActivos', []);

    const rows = lista.map(d => {
        const tipoLabel = d.tipo === 'porcentaje' ? '%' : d.tipo === 'monto_fijo' ? '$' : 'Cat.';
        const valorLabel = d.tipo === 'porcentaje' ? `${d.valor}%` : d.tipo === 'monto_fijo' ? dinero(d.valor) : `${d.valor}% en: ${d.categorias.join(', ')}`;
        const estadoColor = d.activo ? '#16a34a' : '#9ca3af';
        return `<tr>
          <td style="padding:10px;">${d.nombre}</td>
          <td style="padding:10px;text-align:center;">${tipoLabel}</td>
          <td style="padding:10px;text-align:center;">${valorLabel}</td>
          <td style="padding:10px;text-align:center;">${d.fechaInicio || '-'}</td>
          <td style="padding:10px;text-align:center;">${d.fechaFin || '-'}</td>
          <td style="padding:10px;text-align:center;"><span style="color:${estadoColor};font-weight:bold;">${d.activo ? '✅ Activo' : '⛔ Inactivo'}</span></td>
          <td style="padding:10px;text-align:center;display:flex;gap:6px;justify-content:center;">
            <button onclick="toggleDescuento(${d.id})" style="background:none;border:none;cursor:pointer;font-size:17px;" title="${d.activo ? 'Desactivar' : 'Activar'}">${d.activo ? '⛔' : '✅'}</button>
            <button onclick="eliminarDescuento(${d.id})" style="background:none;border:none;cursor:pointer;font-size:17px;" title="Eliminar">🗑️</button>
          </td>
        </tr>`;
    }).join('');

    cont.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="margin:0;color:#7c3aed;">🎯 Descuentos y Promociones</h3>
        <button onclick="crearDescuento()" style="padding:10px 18px;background:#7c3aed;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">➕ Nuevo Descuento</button>
      </div>
      <div style="background:white;padding:20px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        ${lista.length === 0 ? '<p style="color:#9ca3af;text-align:center;padding:20px;">No hay descuentos configurados.</p>' : `
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead><tr style="background:#f3f4f6;">
              <th style="padding:10px;text-align:left;">Nombre</th>
              <th style="padding:10px;text-align:center;">Tipo</th>
              <th style="padding:10px;text-align:center;">Valor</th>
              <th style="padding:10px;text-align:center;">Inicio</th>
              <th style="padding:10px;text-align:center;">Fin</th>
              <th style="padding:10px;text-align:center;">Estado</th>
              <th style="padding:10px;text-align:center;">Acciones</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`}
      </div>`;
}

function toggleDescuento(id) {
    const lista = StorageService.get('descuentosActivos', []);
    const idx = lista.findIndex(d => d.id === id);
    if (idx === -1) return;
    lista[idx].activo = !lista[idx].activo;
    StorageService.set('descuentosActivos', lista);
    renderGestionDescuentos();
}

function eliminarDescuento(id) {
    if (!confirm('¿Eliminar este descuento?')) return;
    let lista = StorageService.get('descuentosActivos', []);
    lista = lista.filter(d => d.id !== id);
    StorageService.set('descuentosActivos', lista);
    renderGestionDescuentos();
}

function aplicarDescuentosAlCarrito(carrito, clienteId) {
    const hoy = new Date();
    const descuentos = StorageService.get('descuentosActivos', []).filter(d => {
        if (!d.activo) return false;
        if (d.fechaInicio && new Date(d.fechaInicio) > hoy) return false;
        if (d.fechaFin && new Date(d.fechaFin) < hoy) return false;
        return true;
    });
    const clientes = StorageService.get('clientes', []);
    const cliente = clientes.find(c => String(c.id) === String(clienteId));
    const esVIP = cliente?.esVIP || false;
    let totalOriginal = carrito.reduce((s, item) => s + (item.precioContado || 0) * (item.cantidad || 1), 0);
    let montoDescuento = 0;
    const descuentosAplicados = [];

    descuentos.forEach(d => {
        let monto = 0;
        if (d.tipo === 'porcentaje') {
            monto = totalOriginal * (d.valor / 100);
            descuentosAplicados.push({ nombre: d.nombre, monto });
        } else if (d.tipo === 'monto_fijo') {
            monto = Math.min(d.valor, totalOriginal);
            descuentosAplicados.push({ nombre: d.nombre, monto });
        } else if (d.tipo === 'por_categoria') {
            const categorias = d.categorias.map(c => c.toLowerCase());
            const subtotalCat = carrito.reduce((s, item) => {
                const cat = (item.categoria || '').toLowerCase();
                return categorias.some(c => cat.includes(c)) ? s + (item.precioContado || 0) * (item.cantidad || 1) : s;
            }, 0);
            monto = subtotalCat * (d.valor / 100);
            if (monto > 0) descuentosAplicados.push({ nombre: d.nombre, monto });
        }
        montoDescuento += monto;
    });

    const totalFinal = Math.max(0, totalOriginal - montoDescuento);
    return { totalFinal, montoDescuento, descuentosAplicados };
}

window.crearDescuento = crearDescuento;
window.guardarDescuento = guardarDescuento;
window.renderGestionDescuentos = renderGestionDescuentos;
window.toggleDescuento = toggleDescuento;
window.eliminarDescuento = eliminarDescuento;
window.aplicarDescuentosAlCarrito = aplicarDescuentosAlCarrito;
