// ===== COTIZACIONES =====

function _foliosCot() {
    const hoy = new Date();
    const ymd = hoy.getFullYear().toString() +
        String(hoy.getMonth() + 1).padStart(2, '0') +
        String(hoy.getDate()).padStart(2, '0');
    const lista = StorageService.get('cotizaciones', []);
    const seq = String(lista.length + 1).padStart(4, '0');
    return 'COT-' + ymd + '-' + seq;
}

function abrirCotizador() {
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
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
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

    const periodicidades = [
        { key: 'semanal', label: 'Semanal' },
        { key: 'quincenal', label: 'Quincenal' },
        { key: 'mensual', label: 'Mensual' }
    ];

    let tablaHtml = `<table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead><tr style="background:#f3f4f6;">
        <th style="padding:8px;text-align:center;">Plazo</th>
        <th style="padding:8px;text-align:center;">Periodicidad</th>
        <th style="padding:8px;text-align:right;">Pago / Período</th>
        <th style="padding:8px;text-align:right;">Total a Pagar</th>
      </tr></thead>
      <tbody>`;

    periodicidades.forEach(per => {
        const planes = CalculatorService.calcularCreditoConPeriodicidad(saldo, per.key);
        planes.forEach(plan => {
            tablaHtml += `<tr>
              <td style="padding:7px;text-align:center;">${plan.meses} meses (${plan.pagos} ${per.key === 'semanal' ? 'sem' : per.key === 'quincenal' ? 'quin' : 'meses'})</td>
              <td style="padding:7px;text-align:center;">${per.label}</td>
              <td style="padding:7px;text-align:right;font-weight:bold;color:#1e40af;">${dinero(plan.abono)}</td>
              <td style="padding:7px;text-align:right;">${dinero(plan.total)}</td>
            </tr>`;
        });
    });

    tablaHtml += '</tbody></table>';
    container.innerHTML = tablaHtml;
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
    const dir = cfg.direccion || '';
    const tel = cfg.telefono || '';
    const rows = c.articulos.map(a =>
        `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;">${a.nombre}${a.esLibre ? ' <em style="color:#7c3aed;font-size:11px;">(libre)</em>' : ''}</td>
         <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;">${a.cantidad}</td>
         <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">$${Number(a.precio).toFixed(2)}</td>
         <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">$${Number(a.subtotal).toFixed(2)}</td></tr>`
    ).join('');

    const enganche = c.enganche || 0;
    const saldoFinanciar = c.saldoFinanciar != null ? c.saldoFinanciar : c.total;

    // Build credit plans table
    let planesHtml = '';
    if (saldoFinanciar > 0) {
        const periodicidades = [
            { key: 'semanal', label: 'Semanal' },
            { key: 'quincenal', label: 'Quincenal' },
            { key: 'mensual', label: 'Mensual' }
        ];
        let planeRows = '';
        periodicidades.forEach(per => {
            const planes = CalculatorService.calcularCreditoConPeriodicidad(saldoFinanciar, per.key);
            planes.forEach(plan => {
                planeRows += `<tr>
                  <td style="padding:6px;border-bottom:1px solid #e5e7eb;">${plan.meses} meses (${plan.pagos} ${per.key === 'semanal' ? 'sem' : per.key === 'quincenal' ? 'quin' : 'meses'})</td>
                  <td style="padding:6px;border-bottom:1px solid #e5e7eb;text-align:center;">${per.label}</td>
                  <td style="padding:6px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:bold;">$${Number(plan.abono).toFixed(2)}</td>
                  <td style="padding:6px;border-bottom:1px solid #e5e7eb;text-align:right;">$${Number(plan.total).toFixed(2)}</td>
                </tr>`;
            });
        });
        planesHtml = `
        <div style="margin-top:20px;">
          <h4 style="margin:0 0 8px;color:#374151;">📅 Opciones de Crédito</h4>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="background:#f3f4f6;">
              <th style="padding:6px;text-align:left;">Plazo</th>
              <th style="padding:6px;text-align:center;">Periodicidad</th>
              <th style="padding:6px;text-align:right;">Pago / Período</th>
              <th style="padding:6px;text-align:right;">Total</th>
            </tr></thead>
            <tbody>${planeRows}</tbody>
          </table>
        </div>`;
    }

    const w = window.open('', '_blank', 'width=750,height=900');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Cotización ${c.folio}</title>
    <style>body{font-family:Arial,sans-serif;padding:32px;color:#111;}table{width:100%;border-collapse:collapse;}th{background:#f3f4f6;padding:8px;text-align:left;}@media print{button{display:none!important;}}</style>
    </head><body>
    <div style="text-align:center;margin-bottom:24px;">
      <img src="img/logo.png" style="height:70px;" onerror="this.outerHTML='<span style=\\'font-size:32px;\\'>🏛️</span>'">
      <h2 style="margin:8px 0;">${empresa}</h2>
      ${dir ? `<p style="margin:2px;font-size:13px;">${dir}</p>` : ''}
      ${tel ? `<p style="margin:2px;font-size:13px;">Tel: ${tel}</p>` : ''}
    </div>
    <hr>
    <div style="display:flex;justify-content:space-between;margin-bottom:20px;">
      <div><strong>COTIZACIÓN</strong><br><span style="font-size:20px;color:#1e40af;">${c.folio}</span></div>
      <div style="text-align:right;">
        <div>Fecha: ${new Date(c.fecha).toLocaleDateString('es-MX')}</div>
        <div>Vence: ${new Date(c.fechaVencimiento).toLocaleDateString('es-MX')}</div>
        <div>Vigencia: ${c.vigenciaDias} días</div>
      </div>
    </div>
    <div style="margin-bottom:16px;"><strong>Cliente:</strong> ${c.clienteNombre}</div>
    <table>
      <thead><tr><th>Artículo</th><th style="text-align:center;">Cant.</th><th style="text-align:right;">Precio Unit.</th><th style="text-align:right;">Subtotal</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="text-align:right;margin-top:12px;font-size:18px;font-weight:bold;">SUBTOTAL: $${Number(c.total).toFixed(2)}</div>
    ${enganche > 0 ? `
    <div style="text-align:right;margin-top:4px;color:#374151;">
      <span>Enganche: <strong>$${Number(enganche).toFixed(2)}</strong></span><br>
      <span>Saldo a financiar: <strong style="color:#1e40af;">$${Number(saldoFinanciar).toFixed(2)}</strong></span>
    </div>` : ''}
    ${planesHtml}
    ${c.notas ? `<div style="margin-top:16px;padding:12px;background:#f9fafb;border-radius:6px;"><strong>Notas:</strong> ${c.notas}</div>` : ''}
    <div style="margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:40px;text-align:center;">
      <div><div style="border-top:1px solid #374151;padding-top:8px;margin-top:40px;">Firma del Cliente</div></div>
      <div><div style="border-top:1px solid #374151;padding-top:8px;margin-top:40px;">Autorizado por</div></div>
    </div>
    <div style="text-align:center;margin-top:24px;color:#9ca3af;font-size:12px;">Esta cotización tiene una vigencia de ${c.vigenciaDias} días a partir de la fecha de emisión.</div>
    <div style="text-align:center;margin-top:12px;">
      <button onclick="window.print()" style="padding:10px 24px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;font-size:15px;">🖨️ Imprimir</button>
    </div>
    </body></html>`);
    w.document.close();
}

function convertirCotizacionAVenta(id) {
    if (!confirm('¿Convertir esta cotización a venta? Se agregarán los artículos al carrito.')) return;
    const lista = StorageService.get('cotizaciones', []);
    const idx = lista.findIndex(c => c.id === id);
    if (idx === -1) return;
    const cot = lista[idx];
    if (cot.estado !== 'Vigente') return alert('⚠️ Solo se pueden convertir cotizaciones vigentes.');
    const productosLista = StorageService.get('productos', []);
    let carritoActual = StorageService.get('carrito', []);
    cot.articulos.forEach(art => {
        const prod = productosLista.find(p => String(p.id) === String(art.productoId));
        if (!prod) return;
        const existe = carritoActual.findIndex(ci => String(ci.id) === String(prod.id));
        if (existe !== -1) {
            carritoActual[existe].cantidad = (carritoActual[existe].cantidad || 1) + art.cantidad;
        } else {
            const planes = CalculatorService.calcularCredito(prod.precio);
            const plan = planes[5] || planes[0];
            carritoActual.push({
                id: prod.id, nombre: prod.nombre, precioContado: parseFloat(prod.precio) || 0,
                plazo: plan.meses, totalCredito: plan.total, abonoSemanal: plan.abono,
                imagen: prod.imagen, cantidad: art.cantidad
            });
        }
    });
    StorageService.set('carrito', carritoActual);
    lista[idx].estado = 'Convertida';
    StorageService.set('cotizaciones', lista);
    actualizarContadorCarrito();
    alert('✅ Artículos agregados al carrito. Folio referencia: ' + cot.folio);
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
