// ===== COTIZACIONES =====

function _foliosCot() {
    const hoy = new Date();
    const ymd = hoy.getFullYear().toString() +
        String(hoy.getMonth() + 1).padStart(2, '0') +
        String(hoy.getDate()).padStart(2, '0');
    
    const lista = StorageService.get('cotizaciones', []);
    const foliosHoy = lista.filter(c => c.folio.startsWith('COT-' + ymd));
    const ultimoNum = foliosHoy.reduce((max, c) => {
        const num = parseInt(c.folio.split('-')[2]);
        return num > max ? num : max;
    }, 0);
    
    const seq = String(ultimoNum + 1).padStart(4, '0');
    return 'COT-' + ymd + '-' + seq;
}
const fmtMXN = (n) => new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
}).format(n);
function abrirCotizador() {
    document.querySelector('[data-modal="cotizador"]')?.remove();
    const clientesLista = StorageService.get('clientes', []);
    const productosLista = StorageService.get('productos', []);
    const selClientes = clientesLista.map(c =>
        `<option value="${c.id}">${c.nombre}</option>`).join('');
    const selProductos = productosLista.map(p =>
        `<option value="${p.id}" data-precio="${p.precio || 0}">${p.nombre} - ${dinero(p.precio || 0)}</option>`).join('');

    const html = `
    <div data-modal="cotizador" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:20px;">
      <div style="background:white;border-radius:12px;width:100%;max-width:760px;padding:28px;margin:auto;">
        <h2 style="margin:0 0 20px;color:#1e40af;">📄 Nueva Cotización</h2>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px;">
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">CLIENTE</label>
            <select id="cotCliente" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
              <option value="">-- Selecciona cliente --</option>
              ${selClientes}
            </select>
            <input type="text" id="cotClienteLibre" placeholder="O escribe nombre libre..." style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:6px;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">VIGENCIA (días)</label>
            <input type="number" id="cotVigencia" value="15" min="1" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">PERIODICIDAD DE PAGO</label>
            <select id="cotPeriodicidad" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
              <option value="semanal">Semanal</option>
              <option value="quincenal">Quincenal</option>
              <option value="mensual">Mensual</option>
            </select>
          </div>
        </div>

        <div style="border:1px solid #e5e7eb;border-radius:8px;padding:14px;margin-bottom:12px;">
          <div style="display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:end;margin-bottom:10px;">
            <select id="cotProductoSel" onchange="_onCotProductoChange()" style="padding:9px;border:1px solid #d1d5db;border-radius:6px;">
              <option value="">-- Selecciona producto --</option>
              ${selProductos}
              <option value="__libre__">✏️ Producto no registrado</option>
            </select>
            <input type="number" id="cotCantidad" value="1" min="1" style="width:70px;padding:9px;border:1px solid #d1d5db;border-radius:6px;" placeholder="Cant">
            <button onclick="agregarArticuloCotizacion()" style="padding:9px 16px;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer;white-space:nowrap;">➕ Agregar</button>
          </div>
          <div id="cotProductoLibreFields" style="display:none;background:#f9fafb;border-radius:6px;padding:12px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px;">
              <div>
                <label style="font-size:11px;font-weight:bold;color:#374151;">NOMBRE DEL PRODUCTO</label>
                <input type="text" id="cotNombreLibre" placeholder="Ej: Mesa de madera..." style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-top:3px;">
              </div>
              <div>
                <label style="font-size:11px;font-weight:bold;color:#374151;">COSTO DE ADQUISICIÓN ($)</label>
                <input type="number" id="cotCostoLibre" value="0" min="0" oninput="_actualizarPrecioSugerido()" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-top:3px;">
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <div>
                <label style="font-size:11px;font-weight:bold;color:#374151;">MARGEN DESEADO (%)</label>
                <input type="number" id="cotMargenLibre" value="30" min="0" max="99" oninput="_actualizarPrecioSugerido()" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-top:3px;">
              </div>
              <div>
                <label style="font-size:11px;font-weight:bold;color:#374151;">PRECIO FINAL (editable)</label>
                <input type="number" id="cotPrecioManual" value="0" min="0" step="0.01" style="width:100%;padding:8px;border:1px solid #2563eb;border-radius:6px;margin-top:3px;font-weight:bold;">
              </div>
            </div>
          </div>
        </div>

        <div id="tablaArticulosCot" style="margin-bottom:16px;"></div>

        <div style="margin-bottom:12px;">
          <label style="font-size:12px;font-weight:bold;color:#374151;">NOTAS</label>
          <textarea id="cotNotas" rows="2" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;" placeholder="Condiciones, observaciones..."></textarea>
        </div>

        <div style="background:#f8fafc;border-radius:8px;padding:14px;margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <strong style="font-size:16px;">Subtotal: <span id="cotTotal" style="color:#1e40af;font-size:18px;">$0.00</span></strong>
          </div>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:bold;">
              <input type="checkbox" id="cotizEngancheCheck" onchange="_toggleEngancheCot()" style="width:16px;height:16px;">
              ¿Aplica enganche?
            </label>
            <div id="cotEngancheDiv" style="display:none;">
              <input type="number" id="cotizEngancheMonto" value="0" min="0" oninput="_actualizarPlanesCot()" placeholder="Monto enganche" style="padding:8px;border:1px solid #3182ce;border-radius:6px;width:140px;font-weight:bold;">
            </div>
          </div>
          <div id="cotSaldoDiv" style="display:none;font-size:14px;color:#6b7280;margin-bottom:8px;">
            Saldo a financiar: <strong id="cotSaldoFinanciar" style="color:#1e40af;">$0.00</strong>
          </div>
        </div>

        <div id="cotPlanesDiv" style="margin-bottom:14px;display:none;">
          <h4 style="margin:0 0 8px;color:#374151;font-size:14px;">📅 Tabla de Plazos de Crédito</h4>
          <div id="cotTablaPlanesContainer"></div>
        </div>

        <div style="display:flex;gap:10px;">
          <button onclick="generarCotizacion()" style="flex:1;padding:12px;background:#27ae60;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">✅ Generar Cotización</button>
          <button onclick="document.querySelector('[data-modal=cotizador]')?.remove()" style="padding:12px 20px;background:#6b7280;color:white;border:none;border-radius:6px;cursor:pointer;">✕ Cancelar</button>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    window._articulosCot = [];
    _renderTablaArticulosCot();
}

function _onCotProductoChange() {
    const sel = document.getElementById('cotProductoSel');
    const libFields = document.getElementById('cotProductoLibreFields');
    if (!libFields) return;
    if (sel.value === '__libre__') {
        libFields.style.display = 'block';
    } else {
        libFields.style.display = 'none';
    }
}

function _actualizarPrecioSugerido() {
    const costo = parseFloat(document.getElementById('cotCostoLibre')?.value) || 0;
    const margen = parseFloat(document.getElementById('cotMargenLibre')?.value) || 0;
    let precioSugerido = 0;
    if (costo > 0 && margen < 100) {
        precioSugerido = costo / (1 - margen / 100);
    }
    const precioInput = document.getElementById('cotPrecioManual');
    if (precioInput) precioInput.value = precioSugerido.toFixed(2);
}

function _toggleEngancheCot() {
    const checked = document.getElementById('cotizEngancheCheck')?.checked;
    const div = document.getElementById('cotEngancheDiv');
    const saldoDiv = document.getElementById('cotSaldoDiv');
    if (div) div.style.display = checked ? 'block' : 'none';
    if (saldoDiv) saldoDiv.style.display = checked ? 'block' : 'none';
    _actualizarPlanesCot();
}

function _actualizarPlanesCot() {
    const total = (window._articulosCot || []).reduce((s, a) => s + a.subtotal, 0);
    const engancheCheck = document.getElementById('cotizEngancheCheck')?.checked;
    const enganche = engancheCheck ? (parseFloat(document.getElementById('cotizEngancheMonto')?.value) || 0) : 0;
    const saldo = Math.max(0, total - enganche);

    const saldoEl = document.getElementById('cotSaldoFinanciar');
    if (saldoEl) saldoEl.textContent = dinero(saldo);

    const planesDiv = document.getElementById('cotPlanesDiv');
    const container = document.getElementById('cotTablaPlanesContainer');
    if (!planesDiv || !container) return;

    if (total <= 0) {
        planesDiv.style.display = 'none';
        return;
    }

    planesDiv.style.display = 'block';

    // Obtener periodicidad seleccionada
    const periodicidadSel = document.getElementById('cotPeriodicidad')?.value || 'semanal';
    const labelMap = { semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual' };
    const planes = CalculatorService.calcularCreditoConPeriodicidad(saldo, periodicidadSel);
    let tablaHtml = `<table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr style="background:#f3f4f6;">
        <th style="padding:8px;text-align:center;">Plazo</th>
        <th style="padding:8px;text-align:center;">Periodicidad</th>
        <th style="padding:8px;text-align:right;">Pago / Período</th>
        <th style="padding:8px;text-align:right;">Total a Pagar</th>
      </tr></thead>
      <tbody>`;
    planes.forEach(plan => {
        tablaHtml += `<tr>
          <td style="padding:7px;text-align:center;">${plan.meses} meses (${plan.pagos} pagos)</td>
          <td style="padding:7px;text-align:center;">${labelMap[periodicidadSel]}</td>
          <td style="padding:7px;text-align:right;font-weight:bold;color:#1e40af;">${dinero(plan.abono)}</td>
          <td style="padding:7px;text-align:right;">${dinero(plan.total)}</td>
        </tr>`;
    });
    tablaHtml += '</tbody></table>';
    container.innerHTML = tablaHtml;

    // Actualizar tabla cuando cambie la periodicidad
    const periodicidadCombo = document.getElementById('cotPeriodicidad');
    if (periodicidadCombo && !periodicidadCombo._cotListener) {
        periodicidadCombo.addEventListener('change', _actualizarPlanesCot);
        periodicidadCombo._cotListener = true;
    }
}

function agregarArticuloCotizacion() {
    const sel = document.getElementById('cotProductoSel');
    const cantInput = document.getElementById('cotCantidad');
    if (!sel.value) return;

    const cant = parseInt(cantInput.value) || 1;
    if (!window._articulosCot) window._articulosCot = [];

    if (sel.value === '__libre__') {
        // Free/unregistered product
        const nombre = document.getElementById('cotNombreLibre')?.value.trim();
        const precio = parseFloat(document.getElementById('cotPrecioManual')?.value) || 0;
        if (!nombre) return alert('⚠️ Escribe el nombre del producto.');
        if (precio <= 0) return alert('⚠️ El precio debe ser mayor a 0.');
        const costo = parseFloat(document.getElementById('cotCostoLibre')?.value) || 0;
        const margen = parseFloat(document.getElementById('cotMargenLibre')?.value) || 0;
        window._articulosCot.push({
            productoId: null,
            nombre,
            precio,
            costo,
            margen,
            esLibre: true,
            cantidad: cant,
            subtotal: cant * precio
        });
        // Reset libre fields
        document.getElementById('cotNombreLibre').value = '';
        document.getElementById('cotCostoLibre').value = '0';
        document.getElementById('cotMargenLibre').value = '30';
        document.getElementById('cotPrecioManual').value = '0';
    } else {
        const productosLista = StorageService.get('productos', []);
        const prod = productosLista.find(p => String(p.id) === String(sel.value));
        if (!prod) return;
        const precio = parseFloat(prod.precio) || 0;
        const idx = window._articulosCot.findIndex(a => String(a.productoId) === String(prod.id));
        if (idx !== -1) {
            window._articulosCot[idx].cantidad += cant;
            window._articulosCot[idx].subtotal = window._articulosCot[idx].cantidad * precio;
        } else {
            window._articulosCot.push({ productoId: prod.id, nombre: prod.nombre, precio, cantidad: cant, subtotal: cant * precio });
        }
    }

    cantInput.value = 1;
    sel.value = '';
    _onCotProductoChange();
    _renderTablaArticulosCot();
}

function _renderTablaArticulosCot() {
    const cont = document.getElementById('tablaArticulosCot');
    if (!cont) return;
    const arts = window._articulosCot || [];
    if (arts.length === 0) {
        cont.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:12px;">Sin artículos</p>';
        const totEl = document.getElementById('cotTotal');
        if (totEl) totEl.textContent = dinero(0);
        _actualizarPlanesCot();
        return;
    }
    let total = 0;
    let rows = arts.map((a, i) => {
        total += a.subtotal;
        return `<tr>
          <td style="padding:8px;">${a.nombre}${a.esLibre ? ' <span style="font-size:10px;color:#7c3aed;background:#f3e8ff;padding:2px 6px;border-radius:10px;">libre</span>' : ''}</td>
          <td style="padding:8px;text-align:center;">${dinero(a.precio)}</td>
          <td style="padding:8px;text-align:center;">${a.cantidad}</td>
          <td style="padding:8px;text-align:right;">${dinero(a.subtotal)}</td>
          <td style="padding:8px;text-align:center;"><button onclick="window._articulosCot.splice(${i},1);_renderTablaArticulosCot();" style="background:none;border:none;cursor:pointer;font-size:16px;">🗑️</button></td>
        </tr>`;
    }).join('');
    cont.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead><tr style="background:#f3f4f6;">
        <th style="padding:8px;text-align:left;">Artículo</th>
        <th style="padding:8px;text-align:center;">Precio Unit.</th>
        <th style="padding:8px;text-align:center;">Cant.</th>
        <th style="padding:8px;text-align:right;">Subtotal</th>
        <th></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
    const totEl = document.getElementById('cotTotal');
    if (totEl) totEl.textContent = dinero(total);
    _actualizarPlanesCot();
}

function generarCotizacion() {
    const arts = window._articulosCot || [];
    if (arts.length === 0) return alert('⚠️ Agrega al menos un artículo.');
    const selCliente = document.getElementById('cotCliente');
    const libreCliente = document.getElementById('cotClienteLibre');
    const vigDias = parseInt(document.getElementById('cotVigencia')?.value) || 15;
    const notas = document.getElementById('cotNotas')?.value.trim() || '';
    const clienteNombre = (selCliente?.value
        ? (StorageService.get('clientes', []).find(c => String(c.id) === String(selCliente.value))?.nombre || libreCliente?.value.trim())
        : libreCliente?.value.trim()) || 'Cliente general';

    const total = arts.reduce((s, a) => s + a.subtotal, 0);
    const engancheCheck = document.getElementById('cotizEngancheCheck')?.checked;
    const enganche = engancheCheck ? (parseFloat(document.getElementById('cotizEngancheMonto')?.value) || 0) : 0;
    const saldoFinanciar = Math.max(0, total - enganche);

    const hoy = new Date();
    const fechaVenc = new Date(hoy.getTime() + vigDias * 24 * 3600 * 1000);
    const periodicidad = document.getElementById('cotPeriodicidad')?.value || 'semanal';
    const cot = {
      id: Date.now(),
      folio: _foliosCot(),
      fecha: hoy.toISOString(),
      fechaVencimiento: fechaVenc.toISOString(),
      clienteNombre,
      clienteId: selCliente?.value || null,
      articulos: arts,
      total,
      enganche,
      saldoFinanciar,
      periodicidad,
      vigenciaDias: vigDias,
      notas,
      estado: 'Vigente'
    };
    const lista = StorageService.get('cotizaciones', []);
    lista.push(cot);
    StorageService.set('cotizaciones', lista);
    document.querySelector('[data-modal="cotizador"]')?.remove();
    alert(`✅ Cotización ${cot.folio} generada correctamente.`);
    if (document.getElementById('listaCotizaciones')) abrirListaCotizaciones();
    imprimirCotizacion(cot.id);
}

function abrirListaCotizaciones() {
    const cont = document.getElementById('listaCotizaciones');
    if (!cont) return;
    const lista = StorageService.get('cotizaciones', []);
    _actualizarEstadosCotizaciones(lista);
    if (lista.length === 0) {
        cont.innerHTML = `<div style="text-align:center;padding:40px;color:#9ca3af;">
            <p style="font-size:48px;">📄</p>
            <p>No hay cotizaciones registradas.</p>
            <button onclick="abrirCotizador()" style="padding:12px 24px;background:#2563eb;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:bold;margin-top:12px;">📄 Nueva Cotización</button>
        </div>`;
        return;
    }
    const rows = lista.slice().reverse().map(c => {
        const color = c.estado === 'Vigente' ? '#16a34a' : c.estado === 'Convertida' ? '#2563eb' : '#dc2626';
        return `<tr>
          <td style="padding:10px;">${c.folio}</td>
          <td style="padding:10px;">${c.clienteNombre}</td>
          <td style="padding:10px;">${new Date(c.fecha).toLocaleDateString('es-MX')}</td>
          <td style="padding:10px;">${new Date(c.fechaVencimiento).toLocaleDateString('es-MX')}</td>
          <td style="padding:10px;text-align:right;">${dinero(c.total)}</td>
          <td style="padding:10px;text-align:center;"><span style="background:${color}20;color:${color};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:bold;">${c.estado}</span></td>
          <td style="padding:10px;text-align:center;display:flex;gap:6px;justify-content:center;">
            <button onclick="imprimirCotizacion(${c.id})" title="Imprimir" style="background:none;border:none;cursor:pointer;font-size:18px;">🖨️</button>
            ${c.estado === 'Vigente' ? `<button onclick="convertirCotizacionAVenta(${c.id})" title="Convertir a Venta" style="background:none;border:none;cursor:pointer;font-size:18px;">🛒</button>` : ''}
            <button onclick="eliminarCotizacion(${c.id})" title="Eliminar" style="background:none;border:none;cursor:pointer;font-size:18px;">🗑️</button>
          </td>
        </tr>`;
    }).join('');
    cont.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="margin:0;color:#1e40af;">📋 Cotizaciones (${lista.length})</h3>
        <button onclick="abrirCotizador()" style="padding:10px 18px;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">📄 Nueva Cotización</button>
      </div>
      <div style="overflow-x:auto;background:white;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead><tr style="background:#f3f4f6;">
            <th style="padding:10px;text-align:left;">Folio</th>
            <th style="padding:10px;text-align:left;">Cliente</th>
            <th style="padding:10px;text-align:left;">Fecha</th>
            <th style="padding:10px;text-align:left;">Vencimiento</th>
            <th style="padding:10px;text-align:right;">Total</th>
            <th style="padding:10px;text-align:center;">Estado</th>
            <th style="padding:10px;text-align:center;">Acciones</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
}

function _actualizarEstadosCotizaciones(lista) {
    const hoy = new Date();
    let cambios = false;
    lista.forEach(c => {
        if (c.estado === 'Vigente' && new Date(c.fechaVencimiento) < hoy) {
            c.estado = 'Vencida';
            cambios = true;
        }
    });
    if (cambios) StorageService.set('cotizaciones', lista);
}

function imprimirCotizacion(id) {
    const lista = StorageService.get('cotizaciones', []);
    const c = lista.find(x => x.id === id);
    if (!c) return alert('Cotización no encontrada.');
    
    const cfg = StorageService.get('configEmpresa', {});
    const empresa = cfg.nombre || 'Mueblería Mi Pueblito';
    
    // Filas de productos con fuente ajustada
    const rows = c.articulos.map(a => `
        <tr>
            <td style="padding:2px 0; border-bottom:1px dashed #ccc; font-size:10px;">${a.nombre}</td>
            <td style="padding:2px 0; border-bottom:1px dashed #ccc; text-align:center; font-size:10px;">${a.cantidad}</td>
            <td style="padding:2px 0; border-bottom:1px dashed #ccc; text-align:right; font-size:10px;">${fmtMXN(a.precio)}</td>
        </tr>`).join('');

    // Planes según periodicidad seleccionada
    let planeRows = '';
    if (c.saldoFinanciar > 0) {
      const labelMap = { semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual' };
      const planes = CalculatorService.calcularCreditoConPeriodicidad(c.saldoFinanciar, c.periodicidad || 'semanal');
      planeRows = planes.map(plan => `
        <tr>
          <td style="padding:2px 0; font-size:9px;">${plan.meses}m (${plan.pagos} pagos)</td>
          <td style="padding:2px 0; text-align:right; font-size:9px; font-weight:bold;">${fmtMXN(plan.abono)} ${labelMap[c.periodicidad] || ''}</td>
          <td style="padding:2px 0; text-align:right; font-size:9px;">${fmtMXN(plan.total)}</td>
        </tr>`).join('');
    }

    const w = window.open('', '_blank', 'width=400,height=600');
    w.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>COT-${c.folio}</title>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
      <style>
        /* AJUSTE DE HOJA ANGOSTA (80mm) */
        @page { size: 80mm auto; margin: 0; }
        body { 
          font-family: 'Courier New', Courier, monospace; 
          margin: 0; padding: 0; 
          background: #f0f0f0; 
          display: flex; flex-direction: column; align-items: center; 
        }
        #area-impresion { 
          width: 72mm; /* Aprovecha el ancho de 80mm dejando margen mínimo */
          padding: 4mm; 
          background: white; 
          box-sizing: border-box;
        }
        .controles { margin: 10px 0; display: flex; gap: 5px; }
        h2 { margin: 0; font-size: 13px; text-align: center; text-transform: uppercase; }
        .separator { border-top: 1px double #000; margin: 5px 0; }
        .info-box { font-size: 9px; text-align: center; line-height: 1.2; }
        .folio-line { display: flex; justify-content: space-between; font-size: 10px; font-weight: bold; margin: 5px 0; }
        table { width: 100%; border-collapse: collapse; }
        th { font-size: 9px; text-align: left; border-bottom: 1px solid #000; padding: 2px 0; }
        .totales { text-align: right; margin-top: 5px; font-size: 11px; font-weight: bold; }
        .seccion-titulo { font-size: 9px; font-weight: bold; margin-top: 8px; text-align: center; background: #eee; }
        .footer { font-size: 8px; text-align: center; margin-top: 10px; border-top: 1px dashed #999; padding-top: 5px; }
        .notas-box { font-size: 9px; background: #f9fafb; border-radius: 6px; padding: 6px 8px; margin: 8px 0; color: #374151; }
        .enganche-box { font-size: 9px; background: #f3e8ff; border-radius: 6px; padding: 6px 8px; margin: 8px 0; color: #7c3aed; text-align: right; }
        @media print { 
          .controles { display: none !important; } 
          body { background: white; }
          #area-impresion { width: 100%; padding: 2mm; }
        }
      </style>
    </head>
    <body>
      <div class="controles">
        <button onclick="window.print()">Imprimir</button>
        <button onclick="guardarComoImagen('${c.folio}')">Imagen</button>
      </div>

      <div id="area-impresion">
        <h2>${empresa}</h2>
        <div class="info-box">${cfg.direccion || ''}<br>Tel: ${cfg.telefono || ''}</div>
            
        <div class="separator"></div>
        <div class="folio-line">
          <span>FOLIO: ${c.folio}</span>
        </div>
        <div style="font-size: 9px;">
          FECHA: ${new Date(c.fecha).toLocaleDateString('es-MX')}<br>
          CLIENTE: ${c.clienteNombre.toUpperCase()}
        </div>
        <div class="separator"></div>

        <table>
          <thead>
            <tr><th>ART</th><th style="text-align:center;">CT</th><th style="text-align:right;">PREC</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="totales">TOTAL: ${fmtMXN(c.total)}</div>

        ${typeof c.enganche === 'number' && c.enganche > 0 ? `<div class="enganche-box">Enganche: <strong>${fmtMXN(c.enganche)}</strong></div>` : ''}
        ${c.notas && c.notas.length > 0 ? `<div class="notas-box">Observaciones: ${c.notas}</div>` : ''}

        ${planeRows ? `
          <div class="seccion-titulo">PAGOS ${c.periodicidad ? (c.periodicidad === 'semanal' ? 'SEMANAL' : c.periodicidad === 'quincenal' ? 'QUINCENAL' : 'MENSUAL') : 'SEMANAL'}</div>
          <table>
            <thead>
              <tr><th style="font-size:8px;">PLAZO</th><th style="text-align:right; font-size:8px;">ABONO</th><th style="text-align:right; font-size:8px;">TOTAL</th></tr>
            </thead>
            <tbody>${planeRows}</tbody>
          </table>
        ` : ''}

        <div class="footer">
          Válido por ${c.vigenciaDias} días.<br>
          *** GRACIAS POR SU PREFERENCIA ***
        </div>
      </div>

      <script>
        function guardarComoImagen(folio) {
          const node = document.getElementById('area-impresion');
          html2canvas(node, { scale: 3 }).then(canvas => {
            const link = document.createElement('a');
            link.download = 'Cotizacion-' + folio + '.png';
            link.href = canvas.toDataURL();
            link.click();
          });
        }
      </script>
    </body>
    </html>`);
    w.document.close();
}

function convertirCotizacionAVenta(id) {
    if (!confirm('¿Convertir esta cotización a venta? Se agregarán los artículos al carrito.')) return;
    const lista = StorageService.get('cotizaciones', []);
    const idx = lista.findIndex(c => c.id === id);
    if (idx === -1) return;
    
    const cot = lista[idx];
    if (cot.estado !== 'Vigente') return alert('⚠️ Solo se pueden convertir cotizaciones vigentes.');
    
    let carritoActual = StorageService.get('carrito', []);
    const productosLista = StorageService.get('productos', []);

    cot.articulos.forEach(art => {
        if (art.esLibre) {
            // Manejo de producto manual
            const planes = CalculatorService.calcularCredito(art.precio);
            const plan = planes[5] || planes[0];
            carritoActual.push({
                id: 'LIBRE-' + Date.now() + Math.random(), 
                nombre: art.nombre,
                precioContado: art.precio,
                plazo: plan.meses,
                totalCredito: plan.total,
                abonoSemanal: plan.abono,
                cantidad: art.cantidad,
                esLibre: true
            });
        } else {
            const prod = productosLista.find(p => String(p.id) === String(art.productoId));
            if (!prod) return;
            const existe = carritoActual.findIndex(ci => String(ci.id) === String(prod.id));
            if (existe !== -1) {
                carritoActual[existe].cantidad += art.cantidad;
            } else {
                const planes = CalculatorService.calcularCredito(prod.precio);
                const plan = planes[5] || planes[0];
                carritoActual.push({
                    id: prod.id, nombre: prod.nombre, precioContado: parseFloat(prod.precio),
                    plazo: plan.meses, totalCredito: plan.total, abonoSemanal: plan.abono,
                    imagen: prod.imagen, cantidad: art.cantidad
                });
            }
        }
    });

    StorageService.set('carrito', carritoActual);
    lista[idx].estado = 'Convertida';
    StorageService.set('cotizaciones', lista);
    
    if (window.actualizarContadorCarrito) actualizarContadorCarrito();
    alert('✅ Convertido con éxito. Folio: ' + cot.folio);
    navA('carrito');
}

function eliminarCotizacion(id) {
    if (!confirm('¿Eliminar esta cotización?')) return;
    let lista = StorageService.get('cotizaciones', []);
    lista = lista.filter(c => c.id !== id);
    StorageService.set('cotizaciones', lista);
    abrirListaCotizaciones();
}

window.abrirCotizador = abrirCotizador;
window._onCotProductoChange = _onCotProductoChange;
window._actualizarPrecioSugerido = _actualizarPrecioSugerido;
window._toggleEngancheCot = _toggleEngancheCot;
window._actualizarPlanesCot = _actualizarPlanesCot;
window.agregarArticuloCotizacion = agregarArticuloCotizacion;
window._renderTablaArticulosCot = _renderTablaArticulosCot;
window.generarCotizacion = generarCotizacion;
window.abrirListaCotizaciones = abrirListaCotizaciones;
window.imprimirCotizacion = imprimirCotizacion;
window.convertirCotizacionAVenta = convertirCotizacionAVenta;
window.eliminarCotizacion = eliminarCotizacion;
