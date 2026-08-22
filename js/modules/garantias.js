// ===== GARANTÍAS =====
// (Antes vivía junto con "Devoluciones" en devoluciones.js. Esa parte se
// quitó del sistema — la cancelación completa de venta en ventas.js ya
// cubre la reversa de mercancía/caja/cartera de forma más completa y con
// el flujo de condición nuevo/segunda. Este archivo solo conserva el
// control de garantías, que es independiente de eso.)

// 🔎 Fuente de la venta de origen (usado para tomar la fecha de compra al
// registrar una garantía). `ventasRegistradas` es la fuente activa de
// ventas autorizadas (ver ventas.js). `registroTickets` se dejó de escribir
// (su único punto de guardado, guardarTicketEnRegistro, está comentado en
// ventas.js), pero se conserva como respaldo por si hay folios históricos
// guardados ahí antes de esa migración.
function _garantiasBuscarVenta(folioUpper) {
    const nuevas = StorageService.get('ventasRegistradas', []);
    const legacy = StorageService.get('registroTickets', []);
    return nuevas.find(v => (v.folio || '').toUpperCase() === folioUpper)
        || legacy.find(v => (v.folio || '').toUpperCase() === folioUpper)
        || null;
}

function registrarGarantia({ folio, productoId, clienteId, mesesGarantia }) {
    const venta = _garantiasBuscarVenta((folio || '').toUpperCase());
    const fecha = venta ? (venta.fecha || venta.fechaVenta || window.localISO(new Date())) : window.localISO(new Date());
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
        fechaVencimiento: window.localISO(fechaVenc),
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
          <td style="padding:10px;text-align:center;">${new Date(g.fechaCompra).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Mexico_City'})}</td>
          <td style="padding:10px;text-align:center;">${fv.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Mexico_City'})}</td>
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

window.registrarGarantia = registrarGarantia;
window.renderControlGarantias = renderControlGarantias;
window.marcarGarantiaReclamacion = marcarGarantiaReclamacion;
