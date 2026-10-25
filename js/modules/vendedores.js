// ===== VENDEDORES Y COMISIONES =====

function _vendEsc(v) {
    return String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
}

// 🗂️ Estado de UI de la sección de Comisiones (qué pestaña está activa y
// qué filtros tiene el historial). Vive en `window`, NO en el DOM, para que
// sobreviva a los renderGestionVendedores() completos que se disparan tras
// cada acción (registrar/editar/liquidar anticipo, liquidar comisiones,
// alta/edición/baja de vendedor). Antes, cada una de esas acciones llamaba
// renderGestionVendedores() y esto SÍ reconstruía todo el HTML del panel de
// comisiones, pero el resumen por vendedor ("reporteComisionesArea") nunca
// se volvía a llenar automáticamente — solo se llenaba al apretar el botón
// "Calcular" a mano. Por eso, al editar el monto de un anticipo, la tabla
// resumen por vendedor se quedaba en blanco/desactualizada aunque el dato
// en `anticiposComisionVendedor` sí se había corregido correctamente.
window._comisionesVendedoresState = window._comisionesVendedoresState || {
    tabActiva: 'pendientes',
    historialFiltros: {}
};

function renderGestionVendedores() {
    const cont = document.getElementById('contenidoVendedores');
    if (!cont) return;
    const vendedores = StorageService.get('vendedores', []);
    const comisiones = StorageService.get('comisionesRegistradas', []);
    const pendTotal = comisiones.filter(c => c.estado === 'Pendiente').reduce((s, c) => s + c.montoComision, 0);

    const rows = vendedores.map(v => {
        const comisVend = comisiones.filter(c => c.vendedorId === v.id);
        const pendVend = comisVend.filter(c => c.estado === 'Pendiente').reduce((s, c) => s + c.montoComision, 0);
        const baseLabels = { venta_total: 'Venta total', precio_base: 'Precio base', utilidad: 'Utilidad' };
        const baseLabel = baseLabels[v.baseComision] || 'Precio base';
        return `<tr>
          <td style="padding:10px;">${v.nombre}</td>
          <td style="padding:10px;text-align:center;">${v.telefono || '-'}</td>
          <td style="padding:10px;text-align:center;">${v.porcentajeComision || 0}%${Number(v.porcentajeComisionAbono) > 0 ? `<br><small style="color:#7c3aed;font-weight:bold;">+ ${Number(v.porcentajeComisionAbono)}% por abono</small>` : ''}</td>
          <td style="padding:10px;text-align:center;font-size:12px;color:#7c3aed;">${baseLabel}</td>
          <td style="padding:10px;text-align:right;">${dinero(pendVend)}</td>
          <td style="padding:10px;text-align:center;"><span style="color:${v.activo ? '#16a34a' : '#9ca3af'};font-weight:bold;">${v.activo ? '✅ Activo' : '⛔ Inactivo'}</span></td>
          <td style="padding:10px;text-align:center;display:flex;gap:6px;justify-content:center;">
            <button onclick="abrirModalAnticipoComision(${v.id})" style="background:none;border:none;cursor:pointer;font-size:17px;" title="Registrar anticipo">💵</button>
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
        <button onclick="abrirFormVendedor()" style="padding:10px 18px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">➕ Nuevo Vendedor</button>
      </div>
      <div style="background:white;padding:20px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);margin-bottom:20px;">
        ${vendedores.length === 0 ? '<p style="color:#9ca3af;text-align:center;padding:20px;">No hay vendedores registrados.</p>' : `
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead><tr style="background:#f3f4f6;">
              <th style="padding:10px;text-align:left;">Nombre</th>
              <th style="padding:10px;text-align:center;">Teléfono</th>
              <th style="padding:10px;text-align:center;">% Comisión</th>
              <th style="padding:10px;text-align:center;">Base de comisión</th>
              <th style="padding:10px;text-align:right;">Comisión Pendiente</th>
              <th style="padding:10px;text-align:center;">Estado</th>
              <th style="padding:10px;text-align:center;">Acciones</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`}
      </div>
      <div style="background:white;padding:20px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
          <h3 style="margin:0;color:#0f172a;">💰 Comisiones</h3>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button id="tabComision_pendientes" onclick="_cambiarTabComisiones('pendientes')" style="padding:8px 14px;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:13px;">📌 Ventas no pagadas</button>
            <button id="tabComision_anticipos" onclick="_cambiarTabComisiones('anticipos')" style="padding:8px 14px;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:13px;">💵 Anticipos</button>
            <button id="tabComision_abonos" onclick="_cambiarTabComisiones('abonos')" style="padding:8px 14px;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:13px;">📥 Por abono</button>
            <button id="tabComision_bono" onclick="_cambiarTabComisiones('bono')" style="padding:8px 14px;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:13px;">🏁 Bono saldadas</button>
            <button id="tabComision_historial" onclick="_cambiarTabComisiones('historial')" style="padding:8px 14px;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:13px;">🕓 Historial</button>
            ${(typeof _esAdmin === 'function' && _esAdmin()) ? `<button onclick="_ejecutarCorreccionPisoUtilidadUI()" title="Sube al piso del 10% de utilidad las comisiones PENDIENTES que quedaron por debajo (registradas antes de esta regla). Lo Pagado no se toca." style="padding:8px 14px;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:13px;background:#fef3c7;color:#92400e;">🛠️ Corregir piso 10%</button>` : ''}
          </div>
        </div>

        <div id="panelComision_pendientes">
          <p style="margin:0 0 12px;font-size:12px;color:#6b7280;">Comisiones de ventas ya cerradas que aún no se han pagado, menos anticipos de comisión sin liquidar (saldo vigente del vendedor, sin importar su fecha). Esto es "lo actual": no depende de un período fijo.</p>
          <div id="comisionesPendientesArea"></div>
        </div>

        <div id="panelComision_anticipos" style="display:none;">
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-bottom:14px;flex-wrap:wrap;">
            <select id="anticipoNuevoVendedor" style="padding:8px;border:1px solid #d1d5db;border-radius:6px;">
              ${vendedores.filter(v => v.activo).map(v => `<option value="${v.id}">${_vendEsc(v.nombre)}</option>`).join('') || '<option value="">Sin vendedores activos</option>'}
            </select>
            <button onclick="_abrirAnticipoDesdeSelector()" style="padding:8px 14px;background:#dc2626;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:13px;">➕ Nuevo Anticipo</button>
          </div>
          <div id="anticiposComisionArea"></div>
        </div>

        <div id="panelComision_abonos" style="display:none;">
          <div id="comisionesAbonoArea"></div>
        </div>

        <div id="panelComision_bono" style="display:none;">
          <div id="bonoSaldadaArea"></div>
        </div>

        <div id="panelComision_historial" style="display:none;">
          <div id="historialComisionesFiltros" style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;margin-bottom:16px;"></div>
          <div id="historialComisionesArea"></div>
        </div>
      </div>`;
    _pintarFiltrosHistorialComisiones();
    _renderTabComisionActiva();
}

// ===== PESTAÑAS DE LA SECCIÓN DE COMISIONES =====
// "Ventas no pagadas" y "Anticipos" son las dos vistas de "lo actual"; el
// "Historial" es una bitácora aparte con sus propios filtros de estado y
// fecha. Antes todo vivía mezclado en un solo panel ("Reporte de Comisiones
// por Período"): un resumen que dependía de un rango de fechas Y una lista
// completa de todas las comisiones, lo cual confundía "cuánto debo pagar
// hoy" con "qué ha pasado históricamente".
function _cambiarTabComisiones(tab) {
    window._comisionesVendedoresState.tabActiva = tab;
    _renderTabComisionActiva();
}

function _renderTabComisionActiva() {
    const tab = window._comisionesVendedoresState.tabActiva || 'pendientes';
    ['pendientes', 'anticipos', 'abonos', 'bono', 'historial'].forEach(t => {
        const btn = document.getElementById('tabComision_' + t);
        const panel = document.getElementById('panelComision_' + t);
        const activo = t === tab;
        if (btn) { btn.style.background = activo ? '#7c3aed' : '#e5e7eb'; btn.style.color = activo ? 'white' : '#374151'; }
        if (panel) panel.style.display = activo ? 'block' : 'none';
    });
    if (tab === 'pendientes') renderComisionesPendientes();
    else if (tab === 'anticipos') renderAnticiposComision();
    else if (tab === 'abonos') renderComisionesAbono();
    else if (tab === 'bono') renderBonoCuentaSaldada();
    else renderHistorialComisiones();
}

function _abrirAnticipoDesdeSelector() {
    const sel = document.getElementById('anticipoNuevoVendedor');
    const vendedorId = sel?.value;
    if (!vendedorId) return alert('No hay vendedores activos para registrar un anticipo.');
    abrirModalAnticipoComision(Number(vendedorId));
}

// 📌 "LO ACTUAL": ventas ya cerradas cuya comisión no se ha pagado, netas de
// cualquier anticipo de comisión sin liquidar. A propósito NO se restringe
// por un rango de fechas por defecto — el reporte viejo solo mostraba el mes
// en curso de entrada, así que una comisión pendiente de un mes anterior
// podía quedar fuera de la vista sin que nadie se diera cuenta. Aquí se ve
// TODO lo pendiente hasta hoy; el "corte" es opcional, solo para acotar qué
// se marca como pagado al liquidar.
function renderComisionesPendientes() {
    const cont = document.getElementById('comisionesPendientesArea');
    if (!cont) return;
    const vendedores = StorageService.get('vendedores', []);
    const filtroHasta = document.getElementById('pendHastaFecha')?.value || '';

    const filas = vendedores.map(v => {
        const liq = calcularLiquidacionVendedor(v.id, null, filtroHasta || null);
        if (liq.pendiente <= 0 && liq.anticipoPendiente <= 0) return '';
        const numPendientes = liq.comisiones.filter(c => c.estado === 'Pendiente').length;
        const fHastaEsc = _vendEsc(filtroHasta);
        return `<tr>
          <td style="padding:10px;">${_vendEsc(v.nombre)}</td>
          <td style="padding:10px;text-align:center;">${numPendientes}</td>
          <td style="padding:10px;text-align:right;color:#d97706;">${dinero(liq.pendiente)}</td>
          <td style="padding:10px;text-align:right;color:#dc2626;">${liq.anticipoPendiente > 0 ? '- ' + dinero(liq.anticipoPendiente) : dinero(0)}</td>
          <td style="padding:10px;text-align:right;font-weight:bold;color:${liq.porPagar > 0 ? '#7c3aed' : '#16a34a'};">${dinero(liq.porPagar)}</td>
          <td style="padding:10px;text-align:center;">
            <button onclick="abrirModalLiquidacionComisiones(${v.id}, '', '${fHastaEsc}')" style="padding:6px 12px;background:#7c3aed;color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px;">🧮 Liquidar</button>
          </td>
        </tr>`;
    }).filter(r => r !== '').join('');

    cont.innerHTML = `
      <div style="display:flex;gap:10px;align-items:flex-end;margin-bottom:14px;flex-wrap:wrap;">
        <div>
          <label style="font-size:12px;font-weight:bold;color:#374151;">CORTE HASTA (opcional)</label><br>
          <input type="date" id="pendHastaFecha" value="${_vendEsc(filtroHasta)}" onchange="renderComisionesPendientes()" style="padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
        </div>
        ${filtroHasta ? `<button onclick="document.getElementById('pendHastaFecha').value='';renderComisionesPendientes()" style="padding:8px 14px;background:#e5e7eb;color:#374151;border:none;border-radius:6px;cursor:pointer;font-size:13px;">✕ Quitar corte</button>` : ''}
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead><tr style="background:#f3f4f6;">
            <th style="padding:10px;text-align:left;">Vendedor</th>
            <th style="padding:10px;text-align:center;">Ventas sin pagar</th>
            <th style="padding:10px;text-align:right;">Comisión pendiente</th>
            <th style="padding:10px;text-align:right;">Anticipo pendiente</th>
            <th style="padding:10px;text-align:right;">Por pagar (neto)</th>
            <th style="padding:10px;text-align:center;">Acción</th>
          </tr></thead>
          <tbody>${filas || '<tr><td colspan="6" style="padding:16px;text-align:center;color:#9ca3af;">Todos los vendedores están al día.</td></tr>'}</tbody>
        </table>
      </div>`;
}

// ===== HISTORIAL DE COMISIONES (bitácora, con filtros de estado/vendedor/fecha) =====
function _pintarFiltrosHistorialComisiones() {
    const cont = document.getElementById('historialComisionesFiltros');
    if (!cont) return;
    const vendedores = StorageService.get('vendedores', []);
    const f = window._comisionesVendedoresState.historialFiltros || {};
    cont.innerHTML = `
      <div>
        <label style="font-size:12px;font-weight:bold;color:#374151;">VENDEDOR</label><br>
        <select id="histComVendedor" onchange="_actualizarFiltroHistorialComisiones()" style="padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
          <option value="">Todos</option>
          ${vendedores.map(v => `<option value="${v.id}" ${String(f.vendedorId || '') === String(v.id) ? 'selected' : ''}>${_vendEsc(v.nombre)}</option>`).join('')}
        </select>
      </div>
      <div>
        <label style="font-size:12px;font-weight:bold;color:#374151;">ESTADO</label><br>
        <select id="histComEstado" onchange="_actualizarFiltroHistorialComisiones()" style="padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
          <option value="" ${!f.estado ? 'selected' : ''}>Todas</option>
          <option value="Pendiente" ${f.estado === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
          <option value="Pagada" ${f.estado === 'Pagada' ? 'selected' : ''}>Pagada</option>
        </select>
      </div>
      <div>
        <label style="font-size:12px;font-weight:bold;color:#374151;">DESDE</label><br>
        <input type="date" id="histComDesde" value="${_vendEsc(f.desde || '')}" onchange="_actualizarFiltroHistorialComisiones()" style="padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
      </div>
      <div>
        <label style="font-size:12px;font-weight:bold;color:#374151;">HASTA</label><br>
        <input type="date" id="histComHasta" value="${_vendEsc(f.hasta || '')}" onchange="_actualizarFiltroHistorialComisiones()" style="padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
      </div>
      ${(f.vendedorId || f.estado || f.desde || f.hasta) ? `<button onclick="_limpiarFiltroHistorialComisiones()" style="padding:8px 14px;background:#e5e7eb;color:#374151;border:none;border-radius:6px;cursor:pointer;font-size:13px;">✕ Limpiar filtros</button>` : ''}`;
}

function _actualizarFiltroHistorialComisiones() {
    window._comisionesVendedoresState.historialFiltros = {
        vendedorId: document.getElementById('histComVendedor')?.value || '',
        estado: document.getElementById('histComEstado')?.value || '',
        desde: document.getElementById('histComDesde')?.value || '',
        hasta: document.getElementById('histComHasta')?.value || ''
    };
    renderHistorialComisiones();
}

function _limpiarFiltroHistorialComisiones() {
    window._comisionesVendedoresState.historialFiltros = {};
    _pintarFiltrosHistorialComisiones();
    renderHistorialComisiones();
}

// Compatibilidad con registros de comisión anteriores a que se guardara
// clienteNombre/productos directo en el registro: si faltan, se busca la
// venta original por folio en ventasRegistradas (cubre contado, crédito y
// apartado, ya que todas pasan por ahí).
function _comisionClienteYProductos(c) {
    if (c.clienteNombre || (Array.isArray(c.productos) && c.productos.length)) {
        return { cliente: c.clienteNombre || '-', productos: c.productos || [] };
    }
    const ventas = StorageService.get('ventasRegistradas', []);
    const venta = ventas.find(v => String(v.folio) === String(c.folio));
    if (venta) {
        return {
            cliente: venta.clienteNombre || venta.cliente?.nombre || '-',
            productos: (venta.articulos || []).map(a => a.nombre).filter(Boolean)
        };
    }
    return { cliente: '-', productos: [] };
}

// Compatibilidad con registros de comisión de antes de que se guardara la
// utilidad directo en el registro: si falta, se recalcula con el costo
// ACTUAL de los productos (no histórico, mismo criterio que ya usa el
// cálculo en vivo al registrar la comisión) contra la venta original.
function _comisionUtilidad(c) {
    if (typeof c.utilidad === 'number') return c.utilidad;
    const ventas = StorageService.get('ventasRegistradas', []);
    const venta = ventas.find(v => String(v.folio) === String(c.folio));
    if (!venta) return null;
    const costo = calcularCostoMercanciaVenta(venta.articulos, null);
    return Math.max(0, Number(venta.total || venta.totalMercancia || 0) - costo);
}

function renderHistorialComisiones() {
    const cont = document.getElementById('historialComisionesArea');
    if (!cont) return;
    const comisiones = StorageService.get('comisionesRegistradas', []);
    if (comisiones.length === 0) {
        cont.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:20px;">No hay comisiones registradas.</p>';
        return;
    }

    const f = window._comisionesVendedoresState.historialFiltros || {};
    const desde = f.desde ? new Date(f.desde + 'T00:00:00') : null;
    const hasta = f.hasta ? new Date(f.hasta + 'T23:59:59') : null;

    const filtradas = comisiones.filter(c => {
        if (f.vendedorId && String(c.vendedorId) !== String(f.vendedorId)) return false;
        if (f.estado && c.estado !== f.estado) return false;
        const fc = window.parseFechaMX ? window.parseFechaMX(c.fecha) : new Date(c.fecha);
        if (desde && fc < desde) return false;
        if (hasta && fc > hasta) return false;
        return true;
    }).slice().reverse();

    const rows = filtradas.map(c => {
        const { cliente, productos } = _comisionClienteYProductos(c);
        const productosTexto = productos.length ? productos.join(', ') : '-';
        const utilidad = _comisionUtilidad(c);
        const pctUtilidad = (utilidad && utilidad > 0) ? (c.montoComision / utilidad * 100) : null;
        const pctVenta = (c.totalVenta && c.totalVenta > 0) ? (c.montoComision / c.totalVenta * 100) : null;
        return `<tr>
      <td style="padding:8px;">${_vendEsc(c.vendedorNombre)}</td>
      <td style="padding:8px;" title="Folio ${_vendEsc(c.folio)}">${_vendEsc(cliente)}</td>
      <td style="padding:8px;max-width:220px;" title="${_vendEsc(productosTexto)}">${_vendEsc(productos.length > 2 ? productos.slice(0, 2).join(', ') + ` +${productos.length - 2}` : productosTexto)}</td>
      <td style="padding:8px;text-align:right;">${dinero(c.totalVenta)}</td>
      <td style="padding:8px;text-align:right;">${utilidad === null ? '-' : dinero(utilidad)}</td>
      <td style="padding:8px;text-align:right;font-weight:bold;">${dinero(c.montoComision)}</td>
      <td style="padding:8px;text-align:right;font-size:12px;color:#6b7280;">${pctUtilidad === null ? '-' : pctUtilidad.toFixed(1) + '%'}</td>
      <td style="padding:8px;text-align:right;font-size:12px;color:#6b7280;">${pctVenta === null ? '-' : pctVenta.toFixed(1) + '%'}</td>
      <td style="padding:8px;">${(window.parseFechaMX ? window.parseFechaMX(c.fecha) : new Date(c.fecha)).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Mexico_City'})}</td>
      <td style="padding:8px;text-align:center;font-size:12px;color:#6b7280;">${c.tipo === 'recuperacion_cartera' ? '💡 Recuperación' : (c.tipo === 'por_abono' ? 'Por abono' : 'Al cierre')}</td>
      <td style="padding:8px;text-align:center;"><span style="color:${c.estado === 'Pendiente' ? '#d97706' : '#16a34a'};font-weight:bold;">${c.estado === 'Pendiente' ? 'Pendiente' : 'Pagada'}</span></td>
    </tr>`;
    }).join('');

    cont.innerHTML = `
      <p style="margin:0 0 10px;font-size:12px;color:#6b7280;">${filtradas.length} registro(s)</p>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="background:#f3f4f6;">
            <th style="padding:8px;text-align:left;">Vendedor</th>
            <th style="padding:8px;text-align:left;">Cliente</th>
            <th style="padding:8px;text-align:left;">Productos</th>
            <th style="padding:8px;text-align:right;">Venta/Abono</th>
            <th style="padding:8px;text-align:right;">Utilidad</th>
            <th style="padding:8px;text-align:right;">Comisión</th>
            <th style="padding:8px;text-align:right;">% Utilidad</th>
            <th style="padding:8px;text-align:right;">% Venta</th>
            <th style="padding:8px;text-align:left;">Fecha</th>
            <th style="padding:8px;text-align:center;">Tipo</th>
            <th style="padding:8px;text-align:center;">Estado</th>
          </tr></thead>
          <tbody>${rows || '<tr><td colspan="11" style="padding:16px;text-align:center;color:#9ca3af;">Sin registros con estos filtros.</td></tr>'}</tbody>
        </table>
      </div>`;
}
function abrirFormVendedor(id) {
    const vendedores = StorageService.get('vendedores', []);
    const v = id ? vendedores.find(x => x.id === id) : null;
    const comisionApartado = v ? (v.porcentajeComisionApartado ?? v.porcentajeComisionCredito ?? v.porcentajeComision ?? 0) : 0;
    const baseActual = v ? (v.baseComision || 'precio_base') : 'precio_base';
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
            <label style="font-size:12px;font-weight:bold;color:#374151;">% Comisión contado</label>
            <input type="number" id="vndComisionContado" value="${v ? (v.porcentajeComisionContado ?? v.porcentajeComision ?? 0) : 0}" min="0" max="100" step="0.1" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">% Comisión crédito</label>
            <input type="number" id="vndComisionCredito" value="${v ? (v.porcentajeComisionCredito ?? v.porcentajeComision ?? 0) : 0}" min="0" max="100" step="0.1" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">% Comisión apartado</label>
            <input type="number" id="vndComisionApartado" value="${comisionApartado}" min="0" max="100" step="0.1" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
          </div>
          <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:10px;">
            <label style="font-size:12px;font-weight:bold;color:#5b21b6;">% Comisión por ABONO (aparte de la de venta)</label>
            <input type="number" id="vndComisionAbono" value="${v ? (v.porcentajeComisionAbono ?? 0) : 0}" min="0" max="100" step="0.1" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
            <small style="color:#6b7280;">Se paga sobre cada abono de crédito que cobre este vendedor en sus cuentas. 0 = sin comisión por abono.</small>
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">BASE DE CÁLCULO DE COMISIÓN</label>
            <select id="vndBaseComision" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
              <option value="venta_total" ${baseActual === 'venta_total' ? 'selected' : ''}>% de la venta total (incluye intereses de crédito)</option>
              <option value="precio_base" ${baseActual === 'precio_base' ? 'selected' : ''}>% del precio base (contado)</option>
              <option value="utilidad" ${baseActual === 'utilidad' ? 'selected' : ''}>% de la utilidad (venta - costo)</option>
            </select>
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
    const porcentajeComisionContado = parseFloat(document.getElementById('vndComisionContado')?.value) || 0;
    const porcentajeComisionCredito = parseFloat(document.getElementById('vndComisionCredito')?.value) || 0;
    const porcentajeComisionApartado = parseFloat(document.getElementById('vndComisionApartado')?.value) || 0;
    const porcentajeComisionAbono = Math.min(100, Math.max(0, parseFloat(document.getElementById('vndComisionAbono')?.value) || 0));
    const baseComision = document.getElementById('vndBaseComision')?.value || 'precio_base';
    const activo = document.getElementById('vndActivo')?.checked ?? true;
    if (!nombre) return alert('⚠️ El nombre es obligatorio.');
    const vendedores = StorageService.get('vendedores', []);
    if (id) {
      const idx = vendedores.findIndex(v => String(v.id) === String(id));
      if (idx !== -1) {
        vendedores[idx] = {
          ...vendedores[idx],
          nombre,
          telefono,
          porcentajeComisionContado,
          porcentajeComisionCredito,
          porcentajeComisionApartado,
          porcentajeComisionAbono,
          baseComision,
          activo
        };
      }
    } else {
      vendedores.push({
        id: Date.now(),
        nombre,
        telefono,
        porcentajeComisionContado,
        porcentajeComisionCredito,
        porcentajeComisionApartado,
        porcentajeComisionAbono,
        baseComision,
        activo
      });
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

// Redondea el monto de comisión SIEMPRE hacia arriba al siguiente múltiplo de 10.
// Ej: 123.40 -> 130, 120.00 -> 120, 0.5 -> 10
function _redondearComisionSiguienteDiez(monto) {
    const n = Number(monto) || 0;
    if (n <= 0) return 0;
    return Math.ceil(n / 10) * 10;
}

// Redondeo hacia abajo al múltiplo de 10 anterior — usado solo para no
// rebasar el tope del 12% de utilidad cuando el redondeo normal (hacia
// arriba) sí lo rebasaría.
function _redondearComisionAnteriorDiez(monto) {
    const n = Number(monto) || 0;
    if (n <= 0) return 0;
    return Math.floor(n / 10) * 10;
}

// Suma el costo de mercancía de una lista de artículos vendidos, buscando el
// costo unitario en el catálogo de productos. Prioridad: producto.costo —
// este campo solo sube nunca baja (ver compras.js: "if (costoNuevo <=
// costoAnteriorNum) return"), así que en teoría siempre es el costo MÁS ALTO
// con el que se ha comprado ese producto, no un promedio ni el costo de la
// última compra. Se usa || en vez de ?? a propósito: si costo llegara a estar
// en 0 (producto nunca comprado con costo capturado) se cae a los respaldos
// en vez de tomar ese 0 como bueno.
function calcularCostoMercanciaVenta(articulos, listaProductos) {
    if (!Array.isArray(articulos) || articulos.length === 0) return 0;
    const productos = Array.isArray(listaProductos) ? listaProductos : (window.productos || []);
    return articulos.reduce((sum, art) => {
        const prodId = art.productoId ?? art.id;
        const prod = productos.find(p => String(p.id) === String(prodId));
        const costoUnit = Number(prod?.costo) || Number(prod?.costoPromedio) || Number(prod?.precioCompra) || 0;
        return sum + costoUnit * Number(art.cantidad || 1);
    }, 0);
}

// Determina el monto base sobre el cual se calcula el % de comisión, según la
// configuración del vendedor (baseComision): venta_total, precio_base o utilidad.
function _montoBaseComision(v, { totalVenta = 0, totalContado = 0, costoMercancia = 0 } = {}) {
    const base = v.baseComision || 'precio_base';
    if (base === 'venta_total') return Number(totalVenta) || Number(totalContado) || 0;
    if (base === 'utilidad') return Math.max(0, (Number(totalContado) || Number(totalVenta) || 0) - (Number(costoMercancia) || 0));
    // precio_base (default)
    return Number(totalContado) || Number(totalVenta) || 0;
}

// datos puede ser un número (compatibilidad: totalContado plano) o un objeto:
// { totalContado, totalVenta, articulos, listaProductos }
function registrarComisionVenta(folio, datos, vendedorId) {
    const vendedores = StorageService.get('vendedores', []);
    const v = vendedores.find(x => String(x.id) === String(vendedorId));
    if (!v) return;

    const esObjeto = datos && typeof datos === 'object';
    const totalContado = esObjeto ? Number(datos.totalContado || 0) : Number(datos || 0);
    const totalVenta = esObjeto ? Number(datos.totalVenta || datos.totalContado || 0) : Number(datos || 0);
    const costoMercancia = esObjeto ? calcularCostoMercanciaVenta(datos.articulos, datos.listaProductos) : 0;
    const utilidad = esObjeto ? Math.max(0, totalContado - costoMercancia) : 0;

    // Detectar tipo de venta: contado, transferencia, credito, apartado
    let tipoVenta = 'contado';
    if (window._ultimaVentaMetodo) tipoVenta = window._ultimaVentaMetodo;
    // Si no está definido, buscar en la venta por folio
    if (!tipoVenta && typeof buscarMetodoPorFolio === 'function') {
      tipoVenta = buscarMetodoPorFolio(folio);
    }
    let porcentaje = 0;
    if (tipoVenta === 'credito') {
      porcentaje = v.porcentajeComisionCredito ?? v.porcentajeComision ?? 0;
    } else if (tipoVenta === 'apartado') {
      porcentaje = v.porcentajeComisionApartado ?? v.porcentajeComisionCredito ?? v.porcentajeComision ?? 0;
    } else {
      porcentaje = v.porcentajeComisionContado ?? v.porcentajeComision ?? 0;
    }

    const montoBase = _montoBaseComision(v, { totalVenta, totalContado, costoMercancia });
    const montoComisionCalculado = montoBase * (porcentaje / 100);
    let montoComision = _redondearComisionSiguienteDiez(montoComisionCalculado);

    // Piso/tope ligados a la utilidad REAL de la venta, sin importar qué base
    // de comisión tenga configurada el vendedor: si lo que le tocaría por su
    // % normal cae por debajo del 10% de la utilidad, se sube forzosamente a
    // ese piso (mismo redondeo al siguiente 10 de siempre); pero ese ajuste
    // nunca debe rebasar el 12% de la utilidad — si redondear hacia arriba se
    // pasa del tope, se redondea hacia abajo en su lugar para no excederlo.
    let pisoUtilidadAplicado = false;
    if (utilidad > 0) {
        const pisoUtilidad = utilidad * 0.10;
        const topeUtilidad = utilidad * 0.12;
        if (montoComision < pisoUtilidad) {
            const pisoRedondeado = _redondearComisionSiguienteDiez(pisoUtilidad);
            montoComision = pisoRedondeado <= topeUtilidad ? pisoRedondeado : _redondearComisionAnteriorDiez(topeUtilidad);
            pisoUtilidadAplicado = true;
        }
    }

    if (montoComision <= 0) return;
    // clienteNombre y productos se guardan directo en el registro para que el
    // historial de comisiones muestre algo útil (a quién y qué se le vendió)
    // sin depender de que el folio siga existiendo/legible en ventasRegistradas.
    const clienteNombre = esObjeto ? (datos.clienteNombre || '') : '';
    const productos = esObjeto ? (datos.articulos || []).map(a => a.nombre).filter(Boolean) : [];
    const comisiones = StorageService.get('comisionesRegistradas', []);
    comisiones.push({
        id: Date.now(),
        vendedorId: v.id,
        vendedorNombre: v.nombre,
        folio,
        clienteNombre,
        productos,
        totalVenta: totalContado,
        costoMercancia,
        utilidad,
        baseComision: v.baseComision || 'precio_base',
        montoBaseComision: montoBase,
        montoComisionSinRedondeo: montoComisionCalculado,
        montoComision,
        pisoUtilidadAplicado,
        // 🛡️ CORREGIDO: antes siempre Date.now() -- si ventas.js manda
        // datos.fechaVenta (la fecha real, posiblemente personalizada, de la
        // venta que generó esta comisión), se usa esa; solo cae a "ahora"
        // cuando no viene (otros llamadores, como recuperación de cartera,
        // donde "ahora" SÍ es la fecha correcta del hecho económico).
        fecha: (esObjeto && datos.fechaVenta) ? datos.fechaVenta : Date.now(),
        tipo: 'al_cierre',
        estado: 'Pendiente'
    });
    StorageService.set('comisionesRegistradas', comisiones);
}

// 🛠️ Corrección puntual, de un solo uso: sube al piso del 10% de utilidad
// las comisiones PENDIENTES que quedaron por debajo de ese piso porque se
// registraron antes de que existiera esta regla en registrarComisionVenta().
// Las comisiones ya Pagadas NO se tocan (son historia). Se corre a mano desde
// la consola del navegador: corregirComisionesPendientesPisoUtilidad()
// Deja rastro en cada registro ajustado: montoComisionAnteriorPisoUtilidad
// (el monto que tenía antes), pisoUtilidadAplicado=true y
// pisoUtilidadCorreccionManual con la fecha del ajuste.
function corregirComisionesPendientesPisoUtilidad() {
    const comisiones = StorageService.get('comisionesRegistradas', []);
    const ajustados = [];
    comisiones.forEach(c => {
        if (c.estado !== 'Pendiente') return;
        const utilidad = typeof c.utilidad === 'number' ? c.utilidad : _comisionUtilidad(c);
        if (!utilidad || utilidad <= 0) return;
        const pisoUtilidad = utilidad * 0.10;
        if (Number(c.montoComision) >= pisoUtilidad) return; // ya cumple, no se toca
        const topeUtilidad = utilidad * 0.12;
        const pisoRedondeado = _redondearComisionSiguienteDiez(pisoUtilidad);
        const montoNuevo = pisoRedondeado <= topeUtilidad ? pisoRedondeado : _redondearComisionAnteriorDiez(topeUtilidad);
        if (montoNuevo <= Number(c.montoComision)) return; // por seguridad, nunca bajar
        ajustados.push({ folio: c.folio, cliente: c.clienteNombre || '', vendedor: c.vendedorNombre, montoAnterior: c.montoComision, montoNuevo, utilidad });
        c.utilidad = utilidad; // por si se obtuvo del fallback, ya queda guardado
        c.montoComisionAnteriorPisoUtilidad = c.montoComision;
        c.montoComision = montoNuevo;
        c.pisoUtilidadAplicado = true;
        c.pisoUtilidadCorreccionManual = new Date().toISOString();
    });

    if (ajustados.length === 0) {
        console.log('No hay comisiones Pendientes por debajo del piso del 10% de utilidad.');
        return ajustados;
    }
    StorageService.set('comisionesRegistradas', comisiones);
    console.table(ajustados);
    console.log(`${ajustados.length} comisión(es) Pendiente(s) ajustada(s) al piso del 10% de utilidad.`);
    if (typeof renderGestionVendedores === 'function' && document.getElementById('contenidoVendedores')) {
        renderGestionVendedores();
    }
    return ajustados;
}

// Wrapper con confirm()/alert() (en vez de consola) para poder correr la
// corrección desde el botón "🛠️ Corregir piso 10%" — pensado para usarse
// desde el celular, donde no hay consola de desarrollador a mano.
function _ejecutarCorreccionPisoUtilidadUI() {
    if (!confirm('Esto revisa las comisiones PENDIENTES (no toca las Pagadas) y sube al piso del 10% de utilidad las que quedaron por debajo. ¿Continuar?')) return;
    const ajustados = corregirComisionesPendientesPisoUtilidad();
    if (ajustados.length === 0) {
        alert('✅ No había comisiones pendientes por debajo del piso del 10% de utilidad. Nada que corregir.');
        return;
    }
    const detalle = ajustados.map(a => `• ${a.vendedor} — ${a.cliente || a.folio}: ${dinero(a.montoAnterior)} → ${dinero(a.montoNuevo)}`).join('\n');
    alert(`✅ Se ajustaron ${ajustados.length} comisión(es):\n\n${detalle}`);
}

function calcularComisionesVendedor(vendedorId, fechaDesde, fechaHasta) {
    const vendedores = StorageService.get('vendedores', []);
    const v = vendedores.find(x => String(x.id) === String(vendedorId));
    if (!v) return { totalVendido: 0, totalComision: 0, numVentas: 0, comisiones: [] };

    const desde = fechaDesde ? new Date(fechaDesde + 'T00:00:00') : null;
    const hasta = fechaHasta ? new Date(fechaHasta + 'T23:59:59') : null;

    const comisiones = StorageService.get('comisionesRegistradas', []);
    const filtradas = comisiones.filter(c => {
        if (String(c.vendedorId) !== String(vendedorId)) return false;
        const fechaC = window.parseFechaMX ? window.parseFechaMX(c.fecha) : new Date(c.fecha);
        if (desde && fechaC < desde) return false;
        if (hasta && fechaC > hasta) return false;
        return true;
    });

    const totalVendido = filtradas.reduce((s, c) => s + (c.totalVenta || 0), 0);
    const totalComision = filtradas.reduce((s, c) => s + (c.montoComision || 0), 0);
    const pendiente = filtradas.filter(c => c.estado === 'Pendiente').reduce((s, c) => s + c.montoComision, 0);
    const pagada = filtradas.filter(c => c.estado === 'Pagada').reduce((s, c) => s + c.montoComision, 0);

    return { totalVendido, totalComision, numVentas: filtradas.length, pendiente, pagada, comisiones: filtradas };
}

// Herramienta de liquidación: comisiones no pagadas (del período) menos
// anticipos de comisión sin liquidar (saldo vigente, sin importar su fecha)
// es igual a lo que realmente hay que desembolsar en efectivo/transferencia.
// El anticipo pendiente NUNCA se limita al período del reporte: es un saldo
// vivo del vendedor hasta que se liquida.
function calcularLiquidacionVendedor(vendedorId, fechaDesde, fechaHasta) {
    const res = calcularComisionesVendedor(vendedorId, fechaDesde, fechaHasta);
    const anticipos = StorageService.get('anticiposComisionVendedor', [])
        .filter(a => String(a.vendedorId) === String(vendedorId));
    const anticipoPendiente = anticipos.reduce((s, a) => s + _anticipoSaldoPendiente(a), 0);
    const anticipoAplicado = Math.min(res.pendiente, anticipoPendiente);
    const porPagar = Math.max(0, res.pendiente - anticipoPendiente);
    const anticipoSobrante = Math.max(0, anticipoPendiente - res.pendiente);
    return { ...res, anticipoPendiente, anticipoAplicado, anticipoSobrante, porPagar };
}

// ===== LIQUIDACIÓN DE COMISIONES (comisiones no pagadas - anticipos = por pagar) =====
// Sustituye al viejo "pagar comisión" registro por registro: aquí se liquida
// TODO el pendiente del vendedor en el período de una sola vez, aplicando
// primero cualquier anticipo de comisión que tenga sin liquidar. Solo el
// remanente neto (si lo hay) mueve caja de verdad.
function abrirModalLiquidacionComisiones(vendedorId, fechaDesde, fechaHasta) {
    const v = StorageService.get('vendedores', []).find(x => String(x.id) === String(vendedorId));
    if (!v) return alert('Vendedor no encontrado.');
    const liq = calcularLiquidacionVendedor(vendedorId, fechaDesde, fechaHasta);
    if (liq.pendiente <= 0 && liq.anticipoPendiente <= 0) return alert('⚠️ No hay nada que liquidar para este vendedor.');

    const fDesdeAttr = _vendEsc(fechaDesde || '');
    const fHastaAttr = _vendEsc(fechaHasta || '');

    const modalHTML = `
    <div data-modal="liquidacion-comisiones" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:8000;display:flex;justify-content:center;align-items:center;padding:16px;">
        <div style="background:white;padding:30px;border-radius:12px;width:100%;max-width:440px;box-shadow:0 10px 25px rgba(0,0,0,0.1);">
            <h2 style="margin-top:0;color:#7c3aed;">🧮 Liquidar comisiones</h2>
            <p style="color:#4b5563;margin-bottom:16px;">Vendedor: <strong>${_vendEsc(v.nombre)}</strong>${fechaDesde || fechaHasta ? `<br><span style="font-size:12px;color:#9ca3af;">Período: ${_vendEsc(fechaDesde || '...')} a ${_vendEsc(fechaHasta || '...')}</span>` : ''}</p>
            <div style="background:#f9fafb;border-radius:8px;padding:14px;margin-bottom:16px;font-size:14px;">
                <div style="display:flex;justify-content:space-between;padding:4px 0;">
                    <span style="color:#374151;">Comisiones no pagadas</span>
                    <strong style="color:#d97706;">${dinero(liq.pendiente)}</strong>
                </div>
                <div style="display:flex;justify-content:space-between;padding:4px 0;">
                    <span style="color:#374151;">Anticipos aplicados</span>
                    <strong style="color:#dc2626;">- ${dinero(liq.anticipoAplicado)}</strong>
                </div>
                <div style="display:flex;justify-content:space-between;padding:8px 0 0;border-top:1px solid #e5e7eb;margin-top:6px;">
                    <span style="color:#0f172a;font-weight:bold;">Por pagar (neto)</span>
                    <strong style="color:#7c3aed;font-size:17px;">${dinero(liq.porPagar)}</strong>
                </div>
                ${liq.anticipoSobrante > 0 ? `<p style="margin:10px 0 0;font-size:12px;color:#6b7280;">El anticipo cubre todo lo pendiente y le sobran ${dinero(liq.anticipoSobrante)}, que quedan como saldo de anticipo para el vendedor.</p>` : ''}
            </div>
            <div style="margin-bottom:14px;">
                <label style="font-weight:bold;font-size:13px;color:#374151;display:block;margin-bottom:5px;">MONTO NETO A DESEMBOLSAR</label>
                <input type="number" id="liqComisionMonto" min="0" step="0.01" value="${liq.porPagar.toFixed(2)}" style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:6px;box-sizing:border-box;">
                <p style="margin:4px 0 0;font-size:11px;color:#9ca3af;">Puedes ajustarlo si acordaste pagar un monto distinto.</p>
            </div>
            ${liq.porPagar > 0 ? `<div style="margin-bottom:20px;">
                <label style="font-weight:bold;font-size:13px;color:#374151;display:block;margin-bottom:5px;">¿DE QUÉ CAJA/CUENTA SALE?</label>
                ${window._buildSelectorCuentas('liqComisionCuenta', false)}
            </div>` : '<p style="margin:0 0 20px;font-size:12px;color:#16a34a;">No hay salida de caja: el anticipo cubre todo lo pendiente.</p>'}
            <div style="display:flex;gap:10px;">
                <button onclick="ejecutarLiquidacionComisiones(${v.id}, '${fDesdeAttr}', '${fHastaAttr}')" style="flex:1;padding:12px;background:#7c3aed;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">✅ Confirmar Liquidación</button>
                <button onclick="document.querySelector('[data-modal=&quot;liquidacion-comisiones&quot;]').remove()" style="flex:1;padding:12px;background:#e5e7eb;color:#4b5563;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">✕ Cancelar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function ejecutarLiquidacionComisiones(vendedorId, fechaDesde, fechaHasta) {
    const v = StorageService.get('vendedores', []).find(x => String(x.id) === String(vendedorId));
    if (!v) return alert('Vendedor no encontrado.');
    const desde = fechaDesde && fechaDesde !== 'null' && fechaDesde !== '' ? fechaDesde : null;
    const hasta = fechaHasta && fechaHasta !== 'null' && fechaHasta !== '' ? fechaHasta : null;
    const liq = calcularLiquidacionVendedor(vendedorId, desde, hasta);
    if (liq.pendiente <= 0 && liq.anticipoPendiente <= 0) return alert('⚠️ No hay nada que liquidar.');

    const montoInput = document.getElementById('liqComisionMonto');
    const montoNeto = Math.max(0, Number(montoInput?.value) || 0);

    // 1. Si hay monto neto a desembolsar, el egreso de caja se confirma
    //    ANTES de tocar comisiones o anticipos: si falla, nada se aplica.
    let cuentaId = '', etiqueta = '';
    if (montoNeto > 0) {
        const sel = document.getElementById('liqComisionCuenta');
        if (!sel) { alert('No se pudo leer la cuenta seleccionada.'); return; }
        cuentaId = sel.value;
        etiqueta = sel.options[sel.selectedIndex]?.text || cuentaId;
        if (typeof window._egresarCuenta !== 'function') {
            alert('No se pudo registrar el pago: el módulo de caja no está disponible. Nada se aplicó.');
            return;
        }
        const egresoOk = window._egresarCuenta({
            monto: montoNeto, cuentaId, etiqueta,
            concepto: `Liquidación de comisiones - ${v.nombre}`,
            referencia: `LIQ-COMISION-${v.id}-${Date.now()}`
        });
        if (!egresoOk) {
            alert(`No se pudo registrar el egreso de caja para "${etiqueta || cuentaId}". La liquidación NO se aplicó.`);
            return;
        }
    }

    // 2. Marcar como pagadas todas las comisiones pendientes del período.
    const comisiones = StorageService.get('comisionesRegistradas', []);
    const desdeD = desde ? new Date(desde + 'T00:00:00') : null;
    const hastaD = hasta ? new Date(hasta + 'T23:59:59') : null;
    comisiones.forEach((c, idx) => {
        if (String(c.vendedorId) === String(vendedorId) && c.estado === 'Pendiente') {
            const f = window.parseFechaMX ? window.parseFechaMX(c.fecha) : new Date(c.fecha);
            let entra = true;
            if (desdeD && f < desdeD) entra = false;
            if (hastaD && f > hastaD) entra = false;
            if (entra) comisiones[idx] = { ...c, estado: 'Pagada', fechaPago: window.localISO(new Date()) };
        }
    });
    StorageService.set('comisionesRegistradas', comisiones);

    // 3. Consumir anticipos pendientes (FIFO por fecha) hasta cubrir
    //    liq.anticipoAplicado — esto es una compensación interna, no mueve caja.
    if (liq.anticipoAplicado > 0) {
        const anticipos = StorageService.get('anticiposComisionVendedor', []);
        let restante = liq.anticipoAplicado;
        const ordenados = anticipos
            .map((a, idx) => ({ a, idx }))
            .filter(x => String(x.a.vendedorId) === String(vendedorId) && _anticipoSaldoPendiente(x.a) > 0)
            .sort((x, y) => (window.parseFechaMX ? window.parseFechaMX(x.a.fecha) : new Date(x.a.fecha)) - (window.parseFechaMX ? window.parseFechaMX(y.a.fecha) : new Date(y.a.fecha)));
        for (const { a, idx } of ordenados) {
            if (restante <= 0.005) break;
            const saldo = _anticipoSaldoPendiente(a);
            const aplicar = Math.min(saldo, restante);
            const nuevoSaldo = Math.max(0, saldo - aplicar);
            const liquidaciones = Array.isArray(a.liquidaciones) ? a.liquidaciones.slice() : [];
            liquidaciones.push({
                monto: aplicar, metodo: 'aplicado_a_comision',
                fecha: window.localISO ? window.localISO(new Date()) : new Date().toISOString()
            });
            anticipos[idx] = { ...a, saldoPendiente: nuevoSaldo, liquidaciones, estado: nuevoSaldo <= 0.01 ? 'Liquidado' : 'Pendiente' };
            restante -= aplicar;
        }
        StorageService.set('anticiposComisionVendedor', anticipos);
    }

    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'COMISIONES_LIQUIDADAS',
            modulo: 'Vendedores',
            entidad: 'comisionesRegistradas',
            entidadId: vendedorId,
            detalle: `Liquidación de comisiones - ${v.nombre}`,
            monto: montoNeto,
            severidad: 'info',
            datos: { comisionesNoPagadas: liq.pendiente, anticipoAplicado: liq.anticipoAplicado, montoNeto, periodo: { desde, hasta } }
        });
    }

    document.querySelector('[data-modal="liquidacion-comisiones"]')?.remove();
    alert(`✅ Liquidación completada para ${v.nombre}.\n\nComisiones no pagadas: ${dinero(liq.pendiente)}\nAnticipos aplicados: ${dinero(liq.anticipoAplicado)}\nNeto desembolsado: ${dinero(montoNeto)}`);

    renderGestionVendedores();
}

// ===== ANTICIPOS DE COMISIÓN PARA VENDEDORES =====
// Saldo llevado APARTE de comisionesRegistradas — no se descuenta automáticamente
// de comisiones futuras, se liquida a mano cuando el admin decide. El dinero
// que sale/entra siempre pasa por los movimientos de caja canónicos
// (_egresarCuenta / _ingresarCuenta), nunca por escritura directa.

function _anticipoSaldoPendiente(a) {
    return Math.max(0, Number(a.saldoPendiente ?? a.monto) || 0);
}

function abrirModalAnticipoComision(vendedorId) {
    const v = StorageService.get('vendedores', []).find(x => String(x.id) === String(vendedorId));
    if (!v) return alert('Vendedor no encontrado.');
    const modalHTML = `
    <div data-modal="anticipo-comision" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:8000;display:flex;justify-content:center;align-items:center;">
        <div style="background:white;padding:30px;border-radius:12px;width:90%;max-width:420px;box-shadow:0 10px 25px rgba(0,0,0,0.1);">
            <h2 style="margin-top:0;color:#0f172a;">💵 Anticipo de comisión</h2>
            <p style="color:#4b5563;margin-bottom:16px;">Vendedor: <strong>${_vendEsc(v.nombre)}</strong></p>
            <div style="margin-bottom:14px;">
                <label style="font-weight:bold;font-size:13px;color:#374151;display:block;margin-bottom:5px;">MONTO</label>
                <input type="number" id="anticipoMonto" min="1" step="0.01" placeholder="Ej. 1000" style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:6px;box-sizing:border-box;">
            </div>
            <div style="margin-bottom:14px;">
                <label style="font-weight:bold;font-size:13px;color:#374151;display:block;margin-bottom:5px;">¿DE QUÉ CAJA/CUENTA SALE?</label>
                ${window._buildSelectorCuentas('anticipoCuenta', false)}
            </div>
            <div style="margin-bottom:20px;">
                <label style="font-weight:bold;font-size:13px;color:#374151;display:block;margin-bottom:5px;">NOTA (opcional)</label>
                <input type="text" id="anticipoNota" placeholder="Motivo del anticipo" style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:6px;box-sizing:border-box;">
            </div>
            <div style="display:flex;gap:10px;">
                <button onclick="registrarAnticipoComision(${v.id})" style="flex:1;padding:12px;background:#dc2626;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">✅ Registrar Anticipo</button>
                <button onclick="document.querySelector('[data-modal=&quot;anticipo-comision&quot;]').remove()" style="flex:1;padding:12px;background:#e5e7eb;color:#4b5563;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">✕ Cancelar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function registrarAnticipoComision(vendedorId) {
    const v = StorageService.get('vendedores', []).find(x => String(x.id) === String(vendedorId));
    if (!v) return alert('Vendedor no encontrado.');
    const montoInput = document.getElementById('anticipoMonto');
    const monto = Number(montoInput?.value);
    if (!Number.isFinite(monto) || monto <= 0) {
        alert('Ingresa un monto válido.');
        return;
    }
    const sel = document.getElementById('anticipoCuenta');
    if (!sel) { alert('No se pudo leer la cuenta seleccionada.'); return; }
    const cuentaId = sel.value;
    const etiqueta = sel.options[sel.selectedIndex]?.text || cuentaId;
    const nota = document.getElementById('anticipoNota')?.value || '';
    const id = Date.now();

    if (typeof window._egresarCuenta !== 'function') {
        alert('No se pudo registrar el anticipo: el módulo de caja no está disponible. Nada se aplicó.');
        return;
    }
    const egresoOk = window._egresarCuenta({
        monto, cuentaId, etiqueta,
        concepto: `Anticipo de comisión - ${v.nombre}${nota ? ' (' + nota + ')' : ''}`,
        referencia: `ANTICIPO-COM-${id}`,
        idOperacion: `anticipo-comision-${id}`
    });
    if (!egresoOk) {
        alert(`No se pudo registrar el egreso de caja para "${etiqueta || cuentaId}". El anticipo NO se guardó.`);
        return;
    }

    const anticipos = StorageService.get('anticiposComisionVendedor', []);
    anticipos.push({
        id,
        vendedorId: v.id,
        vendedorNombre: v.nombre,
        monto,
        saldoPendiente: monto,
        fecha: window.localISO ? window.localISO(new Date()) : new Date().toISOString(),
        cuentaId, cuentaEtiqueta: etiqueta,
        nota,
        estado: 'Pendiente',
        liquidaciones: []
    });
    StorageService.set('anticiposComisionVendedor', anticipos);

    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'ANTICIPO_COMISION_REGISTRADO',
            modulo: 'Vendedores',
            entidad: 'anticiposComisionVendedor',
            entidadId: id,
            detalle: `Anticipo de comisión a ${v.nombre}`,
            monto,
            severidad: 'riesgo',
            datos: { vendedorId: v.id, cuentaId, etiqueta, nota }
        });
    }

    document.querySelector('[data-modal="anticipo-comision"]')?.remove();
    alert(`✅ Anticipo de ${dinero(monto)} registrado para ${v.nombre}, pagado desde ${etiqueta}.\n\nEste saldo NO se descuenta automáticamente de sus comisiones — lo liquidas tú manualmente cuando corresponda.`);
    renderGestionVendedores();
}

function abrirModalLiquidarAnticipo(anticipoId) {
    const anticipos = StorageService.get('anticiposComisionVendedor', []);
    const a = anticipos.find(x => x.id === anticipoId);
    if (!a) return alert('Anticipo no encontrado.');
    const saldo = _anticipoSaldoPendiente(a);
    if (saldo <= 0) return alert('Este anticipo ya está liquidado.');

    const modalHTML = `
    <div data-modal="liquidar-anticipo" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:8000;display:flex;justify-content:center;align-items:center;">
        <div style="background:white;padding:30px;border-radius:12px;width:90%;max-width:420px;box-shadow:0 10px 25px rgba(0,0,0,0.1);">
            <h2 style="margin-top:0;color:#0f172a;">💵 Liquidar anticipo</h2>
            <p style="color:#4b5563;margin-bottom:16px;">Vendedor: <strong>${_vendEsc(a.vendedorNombre)}</strong><br>Saldo pendiente: <strong style="color:#dc2626;">${dinero(saldo)}</strong></p>
            <div style="margin-bottom:14px;">
                <label style="font-weight:bold;font-size:13px;color:#374151;display:block;margin-bottom:5px;">MONTO A LIQUIDAR</label>
                <input type="number" id="liquidarMonto" min="0.01" max="${saldo}" step="0.01" value="${saldo}" style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:6px;box-sizing:border-box;">
            </div>
            <div style="margin-bottom:14px;">
                <label style="font-weight:bold;font-size:13px;color:#374151;display:block;margin-bottom:5px;">¿CÓMO SE LIQUIDA?</label>
                <select id="liquidarMetodo" onchange="document.getElementById('liquidarCuentaWrap').style.display=this.value==='efectivo'?'block':'none'" style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:6px;">
                    <option value="efectivo">El vendedor devuelve efectivo (entra a caja)</option>
                    <option value="manual">Se aplica de otra forma (sin movimiento de caja aquí)</option>
                </select>
            </div>
            <div id="liquidarCuentaWrap" style="margin-bottom:14px;">
                <label style="font-weight:bold;font-size:13px;color:#374151;display:block;margin-bottom:5px;">¿A QUÉ CAJA/CUENTA ENTRA?</label>
                ${window._buildSelectorCuentas('liquidarCuenta', false)}
            </div>
            <div style="display:flex;gap:10px;">
                <button onclick="liquidarAnticipoComision(${a.id})" style="flex:1;padding:12px;background:#16a34a;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">✅ Confirmar</button>
                <button onclick="document.querySelector('[data-modal=&quot;liquidar-anticipo&quot;]').remove()" style="flex:1;padding:12px;background:#e5e7eb;color:#4b5563;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">✕ Cancelar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function liquidarAnticipoComision(anticipoId) {
    const anticipos = StorageService.get('anticiposComisionVendedor', []);
    const idx = anticipos.findIndex(x => x.id === anticipoId);
    if (idx === -1) return alert('Anticipo no encontrado.');
    const a = anticipos[idx];
    const saldo = _anticipoSaldoPendiente(a);

    const montoInput = document.getElementById('liquidarMonto');
    const monto = Number(montoInput?.value);
    if (!Number.isFinite(monto) || monto <= 0 || monto > saldo + 0.01) {
        alert(`Ingresa un monto válido (máximo ${dinero(saldo)}).`);
        return;
    }
    const metodo = document.getElementById('liquidarMetodo')?.value || 'manual';

    if (metodo === 'efectivo') {
        const sel = document.getElementById('liquidarCuenta');
        if (!sel) { alert('No se pudo leer la cuenta seleccionada.'); return; }
        const cuentaId = sel.value;
        const etiqueta = sel.options[sel.selectedIndex]?.text || cuentaId;
        if (typeof window._ingresarCuenta !== 'function') {
            alert('No se pudo registrar el ingreso: el módulo de caja no está disponible. Nada se aplicó.');
            return;
        }
        const ingresoOk = window._ingresarCuenta({
            monto, cuentaId, etiqueta,
            concepto: `Liquidación anticipo de comisión - ${a.vendedorNombre}`,
            referencia: `LIQ-ANTICIPO-COM-${a.id}`,
            idOperacion: `liquidacion-anticipo-comision-${a.id}-${Date.now()}`
        });
        if (!ingresoOk) {
            alert(`No se pudo registrar el ingreso de caja para "${etiqueta || cuentaId}". La liquidación NO se aplicó.`);
            return;
        }
    }

    const nuevoSaldo = Math.max(0, saldo - monto);
    const liquidaciones = Array.isArray(a.liquidaciones) ? a.liquidaciones.slice() : [];
    liquidaciones.push({
        monto, metodo,
        fecha: window.localISO ? window.localISO(new Date()) : new Date().toISOString()
    });
    anticipos[idx] = {
        ...a,
        saldoPendiente: nuevoSaldo,
        liquidaciones,
        estado: nuevoSaldo <= 0.01 ? 'Liquidado' : 'Pendiente'
    };
    StorageService.set('anticiposComisionVendedor', anticipos);

    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'ANTICIPO_COMISION_LIQUIDADO',
            modulo: 'Vendedores',
            entidad: 'anticiposComisionVendedor',
            entidadId: a.id,
            detalle: `Liquidación de anticipo - ${a.vendedorNombre}`,
            monto,
            severidad: 'info',
            datos: { metodo, saldoRestante: nuevoSaldo }
        });
    }

    document.querySelector('[data-modal="liquidar-anticipo"]')?.remove();
    renderGestionVendedores();
}

// Corrige el monto original de un anticipo ya registrado (p. ej. el banco
// depositó un monto distinto al capturado). Solo ajusta el registro del
// anticipo y su saldo pendiente — NO modifica el movimiento de caja que ya
// se generó al registrarlo; si ese egreso también está mal, se corrige aparte
// en Bancos/Corte de Caja.
function abrirModalEditarMontoAnticipo(anticipoId) {
    const anticipos = StorageService.get('anticiposComisionVendedor', []);
    const a = anticipos.find(x => x.id === anticipoId);
    if (!a) return alert('Anticipo no encontrado.');
    const totalLiquidado = (Array.isArray(a.liquidaciones) ? a.liquidaciones : []).reduce((s, l) => s + (Number(l.monto) || 0), 0);

    const modalHTML = `
    <div data-modal="editar-anticipo" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:8000;display:flex;justify-content:center;align-items:center;padding:16px;">
        <div style="background:white;padding:30px;border-radius:12px;width:100%;max-width:400px;box-shadow:0 10px 25px rgba(0,0,0,0.1);">
            <h2 style="margin-top:0;color:#0f172a;">✏️ Corregir monto de anticipo</h2>
            <p style="color:#4b5563;margin-bottom:16px;">Vendedor: <strong>${_vendEsc(a.vendedorNombre)}</strong><br>Monto actual: <strong>${dinero(a.monto)}</strong>${totalLiquidado > 0 ? `<br><span style="font-size:12px;color:#6b7280;">Ya liquidado/aplicado: ${dinero(totalLiquidado)}</span>` : ''}</p>
            <div style="margin-bottom:16px;">
                <label style="font-weight:bold;font-size:13px;color:#374151;display:block;margin-bottom:5px;">MONTO CORRECTO</label>
                <input type="number" id="editarAnticipoMonto" min="0.01" step="0.01" value="${a.monto}" style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:6px;box-sizing:border-box;">
                <p style="margin:4px 0 0;font-size:11px;color:#9ca3af;">Esto solo corrige el registro del anticipo, no el movimiento de caja ya generado.</p>
            </div>
            <div style="display:flex;gap:10px;">
                <button onclick="guardarEdicionMontoAnticipo(${a.id})" style="flex:1;padding:12px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">💾 Guardar</button>
                <button onclick="document.querySelector('[data-modal=&quot;editar-anticipo&quot;]').remove()" style="flex:1;padding:12px;background:#e5e7eb;color:#4b5563;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">✕ Cancelar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function guardarEdicionMontoAnticipo(anticipoId) {
    const anticipos = StorageService.get('anticiposComisionVendedor', []);
    const idx = anticipos.findIndex(x => x.id === anticipoId);
    if (idx === -1) return alert('Anticipo no encontrado.');
    const a = anticipos[idx];

    const montoInput = document.getElementById('editarAnticipoMonto');
    const nuevoMonto = Number(montoInput?.value);
    if (!Number.isFinite(nuevoMonto) || nuevoMonto <= 0) {
        alert('Ingresa un monto válido.');
        return;
    }

    const totalLiquidado = (Array.isArray(a.liquidaciones) ? a.liquidaciones : []).reduce((s, l) => s + (Number(l.monto) || 0), 0);
    if (nuevoMonto < totalLiquidado) {
        if (!confirm(`Ya se liquidaron/aplicaron ${dinero(totalLiquidado)} de este anticipo, más que el nuevo monto (${dinero(nuevoMonto)}). El saldo pendiente quedará en $0. ¿Continuar?`)) return;
    }
    const nuevoSaldo = Math.max(0, nuevoMonto - totalLiquidado);
    const montoAnterior = a.monto;

    anticipos[idx] = {
        ...a,
        monto: nuevoMonto,
        saldoPendiente: nuevoSaldo,
        estado: nuevoSaldo <= 0.01 ? 'Liquidado' : 'Pendiente',
        montoOriginalHistorico: a.montoOriginalHistorico ?? montoAnterior
    };
    StorageService.set('anticiposComisionVendedor', anticipos);

    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'ANTICIPO_COMISION_MONTO_CORREGIDO',
            modulo: 'Vendedores',
            entidad: 'anticiposComisionVendedor',
            entidadId: a.id,
            detalle: `Corrección de monto de anticipo - ${a.vendedorNombre}: ${dinero(montoAnterior)} -> ${dinero(nuevoMonto)}`,
            monto: nuevoMonto,
            severidad: 'riesgo',
            datos: { montoAnterior, montoNuevo: nuevoMonto, saldoPendiente: nuevoSaldo }
        });
    }

    document.querySelector('[data-modal="editar-anticipo"]')?.remove();
    renderGestionVendedores();
}

function renderAnticiposComision() {
    const cont = document.getElementById('anticiposComisionArea');
    if (!cont) return;
    const anticipos = StorageService.get('anticiposComisionVendedor', []);
    if (anticipos.length === 0) {
        cont.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:16px;">No hay anticipos registrados.</p>';
        return;
    }
    const totalPendiente = anticipos.reduce((s, a) => s + _anticipoSaldoPendiente(a), 0);
    const rows = anticipos.slice().sort((x, y) => (window.parseFechaMX ? window.parseFechaMX(y.fecha) : new Date(y.fecha)) - (window.parseFechaMX ? window.parseFechaMX(x.fecha) : new Date(x.fecha))).map(a => {
        const saldo = _anticipoSaldoPendiente(a);
        return `<tr>
          <td style="padding:8px;">${_vendEsc(a.vendedorNombre)}</td>
          <td style="padding:8px;text-align:right;">${dinero(a.monto)}</td>
          <td style="padding:8px;text-align:right;font-weight:bold;color:${saldo > 0 ? '#dc2626' : '#16a34a'};">${dinero(saldo)}</td>
          <td style="padding:8px;">${a.fecha ? (window.parseFechaMX ? window.parseFechaMX(a.fecha) : new Date(a.fecha)).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Mexico_City' }) : '-'}</td>
          <td style="padding:8px;color:#6b7280;">${_vendEsc(a.cuentaEtiqueta || '-')}</td>
          <td style="padding:8px;color:#374151;max-width:220px;white-space:normal;word-break:break-word;">${a.nota ? _vendEsc(a.nota) : '<span style="color:#9ca3af;">—</span>'}</td>
          <td style="padding:8px;text-align:center;"><span style="color:${saldo > 0 ? '#d97706' : '#16a34a'};font-weight:bold;">${saldo > 0 ? 'Pendiente' : 'Liquidado'}</span></td>
          <td style="padding:8px;text-align:center;">
            <div style="display:flex;gap:6px;justify-content:center;">
              ${saldo > 0 ? `<button onclick="abrirModalLiquidarAnticipo(${a.id})" style="padding:4px 10px;background:#16a34a;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">Liquidar</button>` : ''}
              <button onclick="abrirModalEditarMontoAnticipo(${a.id})" style="padding:4px 8px;background:none;border:1px solid #d1d5db;border-radius:4px;cursor:pointer;font-size:12px;" title="Corregir monto">✏️</button>
            </div>
          </td>
        </tr>`;
    }).join('');

    cont.innerHTML = `
      <div style="background:#fef2f2;padding:14px 18px;border-radius:8px;margin-bottom:14px;display:inline-block;">
        <small style="color:#991b1b;">SALDO TOTAL DE ANTICIPOS SIN LIQUIDAR</small><br>
        <strong style="font-size:22px;color:#991b1b;">${dinero(totalPendiente)}</strong>
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="background:#f3f4f6;">
            <th style="padding:8px;text-align:left;">Vendedor</th>
            <th style="padding:8px;text-align:right;">Anticipo</th>
            <th style="padding:8px;text-align:right;">Saldo</th>
            <th style="padding:8px;text-align:left;">Fecha</th>
            <th style="padding:8px;text-align:left;">Cuenta</th>
            <th style="padding:8px;text-align:left;">Nota</th>
            <th style="padding:8px;text-align:center;">Estado</th>
            <th style="padding:8px;text-align:center;">Acción</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
}

window.renderGestionVendedores = renderGestionVendedores;
window.abrirFormVendedor = abrirFormVendedor;
window.guardarVendedor = guardarVendedor;
window.editarVendedor = editarVendedor;
window.eliminarVendedor = eliminarVendedor;
window.calcularCostoMercanciaVenta = calcularCostoMercanciaVenta;
window.registrarComisionVenta = registrarComisionVenta;
window.corregirComisionesPendientesPisoUtilidad = corregirComisionesPendientesPisoUtilidad;
window._ejecutarCorreccionPisoUtilidadUI = _ejecutarCorreccionPisoUtilidadUI;
window.calcularComisionesVendedor = calcularComisionesVendedor;
window.calcularLiquidacionVendedor = calcularLiquidacionVendedor;
window._cambiarTabComisiones = _cambiarTabComisiones;
window._abrirAnticipoDesdeSelector = _abrirAnticipoDesdeSelector;

// ============================================================================
// 📥 COMISIÓN POR ABONO — separada de la comisión de venta
//
// Una comisión por cada ABONO de crédito cobrado, para el vendedor que hizo la
// venta (cuenta.vendedorId). Vive en su PROPIA tabla (comisionesAbono) y se
// liquida por separado: no se mezcla con comisionesRegistradas, no se netea con
// anticipos de comisión y tiene su propia pestaña en Comisiones.
//
// - El % es por vendedor (porcentajeComisionAbono, se edita en el formulario del
//   vendedor). 0 = no genera comisión.
// - Base: el monto del abono cobrado (el enganche no cuenta: no es abono).
// - Se registra desde cxc.js justo después de aplicar el abono (idempotente:
//   un mismo abono nunca genera dos comisiones) y se anula/ajusta si el abono
//   se elimina o se corrige en Auditoría.
// ============================================================================
function _comAbonoPct(v) {
    const n = Number(v && v.porcentajeComisionAbono);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

function _comAbonoLista() {
    const l = StorageService.get('comisionesAbono', []);
    return Array.isArray(l) ? l : [];
}

function _comAbonoFechaISO(valor) {
    const t = valor ? String(valor) : '';
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
    return (window.localISO ? window.localISO(new Date()) : new Date().toISOString()).slice(0, 10);
}

function _comAbonoFechaCorta(iso) {
    const t = String(iso || '').slice(0, 10).split('-');
    return t.length === 3 ? `${t[2]}/${t[1]}/${t[0]}` : '-';
}

window.registrarComisionAbono = function (folioCXC, montoAbonado, vendedorId, extra) {
    try {
        const datos = extra || {};
        const monto = Number(montoAbonado) || 0;
        if (monto <= 0 || !folioCXC || vendedorId == null || vendedorId === '') return null;
        const v = StorageService.get('vendedores', []).find(x => String(x.id) === String(vendedorId));
        if (!v) return null;
        const pct = _comAbonoPct(v);
        if (pct <= 0) return null;
        const montoComision = Math.round(monto * pct) / 100;   // a centavos
        if (montoComision <= 0) return null;

        const idOperacion = String(datos.idOperacion || '');
        const claveUnica = `${folioCXC}|${idOperacion || ('sinid-' + monto + '-' + _comAbonoFechaISO(datos.fechaIso))}`;
        const lista = _comAbonoLista();
        if (lista.some(c => c.claveUnica === claveUnica)) return null;   // ya se registró este abono

        const registro = {
            id: `CA-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            claveUnica,
            tipo: 'abono',
            folioCXC,
            idOperacion,
            vendedorId: v.id,
            vendedorNombre: v.nombre,
            clienteNombre: datos.clienteNombre || '',
            fecha: _comAbonoFechaISO(datos.fechaIso),
            montoAbono: monto,
            porcentaje: pct,
            montoComision,
            estado: 'Pendiente'
        };
        lista.push(registro);
        StorageService.set('comisionesAbono', lista);
        return registro;
    } catch (e) {
        // Nunca debe estorbar el cobro del abono: el dinero ya entró a caja.
        console.error('No se pudo registrar la comisión por abono:', e);
        return null;
    }
};

// Abono eliminado en Auditoría: si su comisión sigue pendiente se anula; si ya
// se había pagado se conserva y se marca para revisión (no se reescribe historia).
window.anularComisionAbono = function (folioCXC, idOperacion, motivo) {
    try {
        if (!folioCXC || !idOperacion) return 0;
        const lista = _comAbonoLista();
        let n = 0;
        const hoy = _comAbonoFechaISO('');
        const nueva = lista.map(c => {
            if (c.estado === 'Anulada' || c.abonoAnulado) return c;
            if (String(c.folioCXC) !== String(folioCXC) || String(c.idOperacion) !== String(idOperacion)) return c;
            n++;
            if (c.estado === 'Pagada') {
                return { ...c, abonoAnulado: true, notaRevision: `El abono se eliminó después de pagar esta comisión. ${motivo || ''}`.trim() };
            }
            return { ...c, estado: 'Anulada', fechaAnulacion: hoy, motivoAnulacion: motivo || 'Abono eliminado' };
        });
        if (n > 0) {
            StorageService.set('comisionesAbono', nueva);
            if (window.AuditService?.log) {
                window.AuditService.log({
                    accion: 'COMISION_ABONO_ANULADA', modulo: 'Vendedores', entidad: 'comisionesAbono',
                    entidadId: folioCXC, detalle: `Comisión por abono anulada/revisar (folio ${folioCXC}). ${motivo || ''}`.trim(),
                    severidad: 'riesgo', datos: { folioCXC, idOperacion, motivo }
                });
            }
        }
        return n;
    } catch (e) {
        console.error('No se pudo anular la comisión por abono:', e);
        return 0;
    }
};

// Abono corregido (monto/fecha): si la comisión sigue pendiente se recalcula con
// el MISMO % con que se generó; si ya se pagó, se deja y se marca para revisión.
window.ajustarComisionAbono = function (folioCXC, idOperacion, nuevoMonto, nuevaFechaIso) {
    try {
        if (!folioCXC || !idOperacion) return 0;
        const monto = Number(nuevoMonto) || 0;
        if (monto <= 0) return 0;
        const lista = _comAbonoLista();
        let n = 0;
        const nueva = lista.map(c => {
            if (c.estado === 'Anulada' || c.abonoAnulado) return c;
            if (String(c.folioCXC) !== String(folioCXC) || String(c.idOperacion) !== String(idOperacion)) return c;
            const nuevaComision = Math.round(monto * Number(c.porcentaje || 0)) / 100;
            if (Math.abs(monto - c.montoAbono) < 0.005 && Math.abs(nuevaComision - c.montoComision) < 0.005) return c;
            n++;
            if (c.estado === 'Pagada') {
                return { ...c, notaRevision: `El abono se corrigió de ${dinero(c.montoAbono)} a ${dinero(monto)} después de pagar la comisión (diferencia en comisión: ${dinero(nuevaComision - c.montoComision)}).` };
            }
            return { ...c, montoAbono: monto, montoComision: nuevaComision, fecha: nuevaFechaIso ? _comAbonoFechaISO(nuevaFechaIso) : c.fecha };
        });
        if (n > 0) {
            StorageService.set('comisionesAbono', nueva);
            if (window.AuditService?.log) {
                window.AuditService.log({
                    accion: 'COMISION_ABONO_AJUSTADA', modulo: 'Vendedores', entidad: 'comisionesAbono',
                    entidadId: folioCXC, detalle: `Comisión por abono recalculada por corrección del abono (folio ${folioCXC}).`,
                    severidad: 'info', datos: { folioCXC, idOperacion, nuevoMonto: monto }
                });
            }
        }
        return n;
    } catch (e) {
        console.error('No se pudo ajustar la comisión por abono:', e);
        return 0;
    }
};

function calcularLiquidacionComisionAbono(vendedorId, hastaISO) {
    const pendientes = _comAbonoLista().filter(c =>
        String(c.vendedorId) === String(vendedorId) &&
        c.estado === 'Pendiente' && !c.abonoAnulado &&
        (!hastaISO || String(c.fecha).slice(0, 10) <= hastaISO));
    const total = pendientes.reduce((s, c) => s + (Number(c.montoComision) || 0), 0);
    return { pendientes, total: Math.round(total * 100) / 100, n: pendientes.length };
}

function _comAbonoSetFiltro(campo, valor) {
    const st = window._comisionesVendedoresState;
    st.abonoFiltros = { ...(st.abonoFiltros || {}), [campo]: valor };
    renderComisionesAbono();
}

function renderComisionesAbono() {
    const cont = document.getElementById('comisionesAbonoArea');
    if (!cont) return;
    const st = window._comisionesVendedoresState;
    const f = st.abonoFiltros || {};
    const fEstado = f.estado || 'Pendiente';
    const fVend = f.vendedor || '';
    const corte = f.corte || '';
    const vendedores = StorageService.get('vendedores', []);
    const lista = _comAbonoLista();

    const pendTotal = lista.filter(c => c.estado === 'Pendiente' && !c.abonoAnulado).reduce((s, c) => s + (Number(c.montoComision) || 0), 0);
    const pagadoTotal = lista.filter(c => c.estado === 'Pagada').reduce((s, c) => s + (Number(c.montoComision) || 0), 0);
    const porRevisar = lista.filter(c => c.notaRevision).length;

    const filas = vendedores.map(v => {
        const liq = calcularLiquidacionComisionAbono(v.id, corte || null);
        const pct = _comAbonoPct(v);
        if (pct <= 0 && liq.n === 0) return '';
        return `<tr>
          <td style="padding:10px;">${_vendEsc(v.nombre)}</td>
          <td style="padding:10px;text-align:center;">${pct > 0 ? pct + '%' : '<span style="color:#9ca3af;">sin %</span>'}</td>
          <td style="padding:10px;text-align:center;">${liq.n}</td>
          <td style="padding:10px;text-align:right;font-weight:bold;color:${liq.total > 0 ? '#7c3aed' : '#16a34a'};">${dinero(liq.total)}</td>
          <td style="padding:10px;text-align:center;">
            ${liq.total > 0 ? `<button onclick="abrirModalLiquidacionComisionAbono(${v.id}, '${_vendEsc(corte)}')" style="padding:6px 12px;background:#7c3aed;color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px;">🧮 Liquidar</button>` : '<span style="color:#9ca3af;font-size:12px;">al día</span>'}
          </td>
        </tr>`;
    }).filter(Boolean).join('');

    const hay = vendedores.some(v => _comAbonoPct(v) > 0);

    const historial = lista
        .filter(c => (fEstado === 'todas' || (fEstado === 'Revisar' ? !!c.notaRevision : c.estado === fEstado)) &&
                     (!fVend || String(c.vendedorId) === String(fVend)))
        .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
        .slice(0, 200);
    const colorEstado = { Pendiente: '#d97706', Pagada: '#16a34a', Anulada: '#9ca3af' };
    const filasHist = historial.map(c => `<tr style="border-bottom:1px solid #f3f4f6;">
        <td style="padding:8px;">${_comAbonoFechaCorta(c.fecha)}</td>
        <td style="padding:8px;">${_vendEsc(c.vendedorNombre)}</td>
        <td style="padding:8px;">${_vendEsc(c.folioCXC)}<br><small style="color:#6b7280;">${_vendEsc(c.clienteNombre)}</small></td>
        <td style="padding:8px;text-align:right;">${dinero(c.montoAbono)}</td>
        <td style="padding:8px;text-align:center;">${Number(c.porcentaje)}%</td>
        <td style="padding:8px;text-align:right;font-weight:bold;">${dinero(c.montoComision)}</td>
        <td style="padding:8px;text-align:center;color:${colorEstado[c.estado] || '#374151'};font-weight:bold;">${_vendEsc(c.estado)}${c.fechaPago ? `<br><small style="font-weight:normal;">${_comAbonoFechaCorta(c.fechaPago)}</small>` : ''}${c.notaRevision ? `<br><small title="${_vendEsc(c.notaRevision)}" style="color:#dc2626;cursor:help;">⚠ revisar</small>` : ''}</td>
      </tr>`).join('');

    cont.innerHTML = `
      <p style="margin:0 0 12px;font-size:12px;color:#6b7280;">Comisión que se genera por cada <strong>abono de crédito</strong> cobrado en las cuentas de cada vendedor. Se maneja <strong>aparte</strong> de la comisión de venta: tiene su propio saldo, su propia liquidación y no se compensa con anticipos. El % se define por vendedor (✏️ Editar vendedor).</p>
      ${hay ? '' : '<div style="background:#fffbeb;border:1px solid #fde68a;color:#92400e;padding:10px 14px;border-radius:8px;margin-bottom:14px;font-size:13px;">Ningún vendedor tiene % por abono. Entra a <strong>✏️ Editar</strong> en la tabla de vendedores y captura el <strong>% Comisión por ABONO</strong>: desde ese momento cada abono nuevo genera su comisión.</div>'}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:16px;">
        <div style="background:#f5f3ff;padding:14px;border-radius:10px;text-align:center;"><small style="color:#5b21b6;">POR PAGAR (ABONOS)</small><br><strong style="font-size:22px;color:#5b21b6;">${dinero(pendTotal)}</strong></div>
        <div style="background:#f0fdf4;padding:14px;border-radius:10px;text-align:center;"><small style="color:#16a34a;">PAGADO (ABONOS)</small><br><strong style="font-size:22px;color:#16a34a;">${dinero(pagadoTotal)}</strong></div>
        ${porRevisar ? `<div style="background:#fef2f2;padding:14px;border-radius:10px;text-align:center;"><small style="color:#dc2626;">POR REVISAR</small><br><strong style="font-size:22px;color:#dc2626;">${porRevisar}</strong></div>` : ''}
      </div>
      <div style="display:flex;gap:10px;align-items:flex-end;margin-bottom:12px;flex-wrap:wrap;">
        <div>
          <label style="font-size:12px;font-weight:bold;color:#374151;">CORTE HASTA (opcional)</label><br>
          <input type="date" value="${_vendEsc(corte)}" onchange="_comAbonoSetFiltro('corte', this.value)" style="padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
        </div>
      </div>
      <div style="overflow-x:auto;margin-bottom:22px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead><tr style="background:#f3f4f6;">
            <th style="padding:10px;text-align:left;">Vendedor</th>
            <th style="padding:10px;text-align:center;">% por abono</th>
            <th style="padding:10px;text-align:center;">Abonos sin pagar</th>
            <th style="padding:10px;text-align:right;">Comisión por pagar</th>
            <th style="padding:10px;text-align:center;">Acción</th>
          </tr></thead>
          <tbody>${filas || '<tr><td colspan="5" style="padding:16px;text-align:center;color:#9ca3af;">Sin comisiones por abono pendientes.</td></tr>'}</tbody>
        </table>
      </div>
      <h4 style="margin:0 0 10px;color:#0f172a;">Detalle por abono</h4>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
        <select onchange="_comAbonoSetFiltro('estado', this.value)" style="padding:8px;border:1px solid #d1d5db;border-radius:6px;">
          ${[['Pendiente', 'Pendientes'], ['Pagada', 'Pagadas'], ['Anulada', 'Anuladas'], ['Revisar', 'Por revisar'], ['todas', 'Todas']].map(([val, et]) => `<option value="${val}" ${fEstado === val ? 'selected' : ''}>${et}</option>`).join('')}
        </select>
        <select onchange="_comAbonoSetFiltro('vendedor', this.value)" style="padding:8px;border:1px solid #d1d5db;border-radius:6px;">
          <option value="">Todos los vendedores</option>
          ${vendedores.map(v => `<option value="${v.id}" ${String(fVend) === String(v.id) ? 'selected' : ''}>${_vendEsc(v.nombre)}</option>`).join('')}
        </select>
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="background:#f3f4f6;">
            <th style="padding:8px;text-align:left;">Fecha</th>
            <th style="padding:8px;text-align:left;">Vendedor</th>
            <th style="padding:8px;text-align:left;">Cuenta / Cliente</th>
            <th style="padding:8px;text-align:right;">Abono</th>
            <th style="padding:8px;text-align:center;">%</th>
            <th style="padding:8px;text-align:right;">Comisión</th>
            <th style="padding:8px;text-align:center;">Estado</th>
          </tr></thead>
          <tbody>${filasHist || '<tr><td colspan="7" style="padding:16px;text-align:center;color:#9ca3af;">No hay registros con este filtro.</td></tr>'}</tbody>
        </table>
      </div>
      ${historial.length === 200 ? '<p style="font-size:12px;color:#9ca3af;margin:8px 0 0;">Se muestran los 200 más recientes.</p>' : ''}`;
}

function abrirModalLiquidacionComisionAbono(vendedorId, hastaISO) {
    const v = StorageService.get('vendedores', []).find(x => String(x.id) === String(vendedorId));
    if (!v) return alert('Vendedor no encontrado.');
    const liq = calcularLiquidacionComisionAbono(vendedorId, hastaISO || null);
    if (liq.total <= 0) return alert('⚠️ No hay comisiones por abono pendientes para este vendedor.');
    const html = `
    <div data-modal="liquidacion-comision-abono" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:8000;display:flex;justify-content:center;align-items:center;padding:20px;">
      <div style="background:white;padding:30px;border-radius:12px;width:100%;max-width:440px;">
        <h2 style="margin-top:0;color:#7c3aed;">🧮 Liquidar comisión por abono</h2>
        <p style="color:#4b5563;margin-bottom:16px;">Vendedor: <strong>${_vendEsc(v.nombre)}</strong>${hastaISO ? `<br><span style="font-size:12px;color:#9ca3af;">Abonos hasta ${_comAbonoFechaCorta(hastaISO)}</span>` : ''}</p>
        <div style="background:#f9fafb;border-radius:8px;padding:14px;margin-bottom:16px;font-size:14px;">
          <div style="display:flex;justify-content:space-between;padding:4px 0;"><span>Abonos sin pagar</span><strong>${liq.n}</strong></div>
          <div style="display:flex;justify-content:space-between;padding:8px 0 0;border-top:1px solid #e5e7eb;margin-top:6px;"><span style="font-weight:bold;">Comisión por pagar</span><strong style="color:#7c3aed;font-size:17px;">${dinero(liq.total)}</strong></div>
        </div>
        <div style="margin-bottom:14px;">
          <label style="font-weight:bold;font-size:13px;color:#374151;display:block;margin-bottom:5px;">MONTO A DESEMBOLSAR</label>
          <input type="number" id="liqComAbonoMonto" min="0" step="0.01" value="${liq.total.toFixed(2)}" style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:6px;">
          <p style="margin:4px 0 0;font-size:11px;color:#9ca3af;">Se marcan como pagados todos los abonos de la lista. Puedes ajustar el monto si acordaste pagar otra cantidad.</p>
        </div>
        <div style="margin-bottom:20px;">
          <label style="font-weight:bold;font-size:13px;color:#374151;display:block;margin-bottom:5px;">¿DE QUÉ CAJA/CUENTA SALE?</label>
          ${window._buildSelectorCuentas('liqComAbonoCuenta', false)}
        </div>
        <div style="display:flex;gap:10px;">
          <button onclick="ejecutarLiquidacionComisionAbono(${v.id}, '${_vendEsc(hastaISO || '')}')" style="flex:1;padding:12px;background:#7c3aed;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">✅ Confirmar pago</button>
          <button onclick="document.querySelector('[data-modal=&quot;liquidacion-comision-abono&quot;]').remove()" style="flex:1;padding:12px;background:#e5e7eb;color:#4b5563;border:none;border-radius:6px;cursor:pointer;">Cancelar</button>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

function ejecutarLiquidacionComisionAbono(vendedorId, hastaISO) {
    const v = StorageService.get('vendedores', []).find(x => String(x.id) === String(vendedorId));
    if (!v) return alert('Vendedor no encontrado.');
    const hasta = hastaISO && hastaISO !== 'null' ? hastaISO : null;
    const liq = calcularLiquidacionComisionAbono(vendedorId, hasta);
    if (liq.total <= 0) return alert('⚠️ No hay nada que liquidar.');

    const monto = Math.max(0, Number(document.getElementById('liqComAbonoMonto')?.value) || 0);
    const sel = document.getElementById('liqComAbonoCuenta');
    if (monto > 0) {
        if (!sel) return alert('No se pudo leer la cuenta seleccionada.');
        if (typeof window._egresarCuenta !== 'function') return alert('No se pudo registrar el pago: el módulo de caja no está disponible. Nada se aplicó.');
        const cuentaId = sel.value;
        const etiqueta = sel.options[sel.selectedIndex]?.text || cuentaId;
        // El egreso de caja se confirma ANTES de marcar nada como pagado.
        const ok = window._egresarCuenta({
            monto, cuentaId, etiqueta,
            concepto: `Comisión por abonos - ${v.nombre}`,
            referencia: `LIQ-COMISION-ABONO-${v.id}-${Date.now()}`
        });
        if (!ok) return alert(`No se pudo registrar el egreso de caja para "${etiqueta || cuentaId}". La liquidación NO se aplicó.`);
    }

    const ids = new Set(liq.pendientes.map(c => c.id));
    const hoy = _comAbonoFechaISO('');
    const nueva = _comAbonoLista().map(c => ids.has(c.id) ? { ...c, estado: 'Pagada', fechaPago: hoy } : c);
    StorageService.set('comisionesAbono', nueva);

    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'COMISIONES_ABONO_LIQUIDADAS', modulo: 'Vendedores', entidad: 'comisionesAbono',
            entidadId: vendedorId, detalle: `Liquidación de comisión por abonos - ${v.nombre}`,
            monto, severidad: 'info',
            datos: { abonos: liq.n, comisionPorPagar: liq.total, montoPagado: monto, hasta }
        });
    }
    document.querySelector('[data-modal="liquidacion-comision-abono"]')?.remove();
    alert(`✅ Comisión por abonos liquidada para ${v.nombre}.\n\nAbonos: ${liq.n}\nComisión: ${dinero(liq.total)}\nDesembolsado: ${dinero(monto)}`);
    renderGestionVendedores();
    window._comisionesVendedoresState.tabActiva = 'abonos';
    _renderTabComisionActiva();
}

// ============================================================================
// 🏁 BONO POR CUENTA SALDADA (pestaña "Por abono") — mismo ciclo que la comisión
// por venta, pero sobre los INTERESES y pagadero hasta que la cuenta se salda.
//
// Ciclo de cada bono (tabla propia bonosCuentaSaldada, un registro por cuenta,
// id fijo BONO-<folio>, así una cuenta jamás se bonifica dos veces):
//   Reservada → al hacer una venta a crédito con vendedor se crea la RESERVA:
//               % × interés pactado (plan.total − capital). Es un pasivo y se
//               devenga con la fecha de la venta, como la comisión de venta.
//               Se mantiene al día si el plan cambia (salto de plazo).
//   Pendiente → la cuenta se saldó: el monto se fija con el interés realmente
//               cobrado (abonos sin moratorios − capital, tope = interés
//               pactado). Una liquidación con descuento/cupón baja el bono.
//   Pagada    → se liquidó por vendedor: egreso de caja confirmado ANTES de
//               marcar nada, descuento de anticipos (FIFO) y AuditService.
//   Anulada   → la venta se canceló, la cuenta es incobrable o se saldó sin
//               cobrar intereses.
// - El % se configura aquí (10 de entrada) y queda fijo en cada reserva.
// - Cuentas saldadas ANTES de existir la reserva se pueden bonificar desde el
//   rango de fechas ("sin reserva"), con el % vigente.
// - Un bono pagado cuya cuenta cambia después (abono eliminado/corregido) no se
//   reescribe: se marca "⚠ revisar".
// ============================================================================
const BONO_SALDADA_PCT_DEFECTO = 10;

function _bonoConfig() {
    const c = StorageService.get('configBonoCuentaSaldada', null);
    const n = (c && c.porcentaje != null) ? Number(c.porcentaje) : NaN;
    return { porcentaje: Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : BONO_SALDADA_PCT_DEFECTO };
}

function _bonoGuardarPct(valor) {
    const n = parseFloat(valor);
    const pct = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : BONO_SALDADA_PCT_DEFECTO;
    StorageService.set('configBonoCuentaSaldada', { porcentaje: pct });
    renderBonoCuentaSaldada();
}

function _bonoLista() {
    const l = StorageService.get('bonosCuentaSaldada', []);
    return Array.isArray(l) ? l : [];
}

function _bonoFiltros() {
    const st = window._comisionesVendedoresState;
    if (!st.bonoFiltros) {
        const hoy = _comAbonoFechaISO('');
        st.bonoFiltros = { desde: hoy.slice(0, 8) + '01', hasta: hoy, vendedor: '' };
    }
    return st.bonoFiltros;
}

function _bonoSetFiltro(campo, valor) {
    _bonoFiltros()[campo] = valor;
    renderBonoCuentaSaldada();
}

function _bonoRound2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

function _bonoFechaDe(valor) {
    if (valor == null || valor === '') return '';
    const t = String(valor);
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
    let d = null;
    if (typeof valor === 'number') d = new Date(valor);
    else if (typeof window.parseFechaMXOrNull === 'function') d = window.parseFechaMXOrNull(valor);
    if (d && !isNaN(d.getTime())) return (window.localISO ? window.localISO(d) : d.toISOString()).slice(0, 10);
    return '';
}

function _bonoAbonoVigente(a) {
    return a && !a.cancelado && !a.canceladoPorVenta && !a.canceladoPorApartado && !a.eliminadoAuditoria;
}

// Fecha en que se saldó la cuenta = fecha de su último abono vigente.
function _bonoFechaSaldada(cuenta) {
    let mejor = '';
    (cuenta.abonos || []).filter(_bonoAbonoVigente).forEach(a => {
        const iso = _bonoFechaDe(a.fechaAbonoIso || a.fecha);
        if (iso && iso > mejor) mejor = iso;
    });
    return mejor;
}

function _bonoCuentaCancelada(c) {
    return String(c?.estado || c?.estatus || '').toLowerCase().includes('cancel') || c?.incobrable === true;
}

function _bonoInteresPactado(cuenta) {
    const enganche = Number(cuenta.engancheRecibido || cuenta.enganche || 0);
    const contado = Number(cuenta.totalContadoOriginal || cuenta.totalMercancia || 0);
    const capital = Math.max(0, contado - enganche);
    const financiado = Number(cuenta.plan?.total || cuenta.saldoOriginal || 0);
    return { capital, interesPactado: _bonoRound2(Math.max(0, financiado - capital)) };
}

// Dinero aplicado a los pagarés de cada cuenta (capital + interés, sin moratorios).
// Misma lectura que _cxcTotalPagadoPolitica (cxc.js): los pagarés pagan aunque
// cuenta.abonos quede incompleto.
function _bonoPagadoPagaresMap() {
    const m = {};
    StorageService.get('pagaresSistema', []).forEach(p => {
        const estado = String(p.estado || '').toLowerCase();
        let v = 0;
        if (estado === 'pagado') v = Number(p.montoAbonado || p.monto || 0);
        else if (estado === 'parcial') v = Number(p.montoAbonado || 0);
        if (v > 0) m[String(p.folio)] = (m[String(p.folio)] || 0) + v;
    });
    return m;
}

// INTERÉS TOTAL pagado por el cliente en toda la cuenta (no solo el último pago):
//   pagado total (el mayor entre pagarés y abonos, sin moratorios realmente cobrados)
//   − capital financiado (contado − enganche), con tope en el interés pactado.
// Los moratorios CONDONADOS no son dinero cobrado y no se restan.
function _bonoInteresCobrado(cuenta, pagMap) {
    const { capital, interesPactado } = _bonoInteresPactado(cuenta);
    const abonado = (cuenta.abonos || []).filter(_bonoAbonoVigente)
        .reduce((s, a) => s + (Number(a.monto || a.montoAbonado || 0)), 0);
    const moratoriosCobrados = (cuenta.cargosMoratorios || [])
        .filter(m => !m.cancelado && !m.anulado && String(m.tipo || 'cargo') !== 'exencion' && !/condonad/i.test(String(m.nota || '')))
        .reduce((s, m) => s + Number(m.montoAbonado || 0), 0);
    const desdeAbonos = Math.max(0, abonado - moratoriosCobrados);
    const desdePagares = (pagMap || _bonoPagadoPagaresMap())[String(cuenta.folio)] || 0;
    const cobrado = Math.max(desdePagares, desdeAbonos);
    return {
        capital, interesPactado,
        cobrado: _bonoRound2(cobrado),
        interesCobrado: _bonoRound2(Math.min(interesPactado, Math.max(0, cobrado - capital)))
    };
}

function _bonoCuentasMapa() {
    const m = {};
    StorageService.get('cuentasPorCobrar', []).forEach(c => { if (c && c.folio != null) m[String(c.folio)] = c; });
    return m;
}

// Estado "vivo" de un bono según la cuenta de hoy (no escribe nada).
function _bonoVista(b, mapa, pag) {
    const pct = Number(b.porcentaje) || 0;
    const c = mapa[String(b.folioCXC)];
    if (b.estado === 'Anulada') return { ...b, estadoVivo: 'Anulada', montoVivo: 0 };
    if (b.estado === 'Pagada') {
        const monto = Number(b.montoBono) || 0;
        let nota = b.notaRevision || '';
        if (c && !nota) {
            if (_bonoCuentaCancelada(c)) nota = 'La cuenta se canceló o quedó incobrable después de pagar este bono.';
            else if (c.estado !== 'Saldado') nota = 'La cuenta ya no está saldada (se eliminó o corrigió un abono) después de pagar este bono.';
            else {
                const esperado = Math.round(_bonoInteresCobrado(c, pag).interesCobrado * pct) / 100;
                if (Math.abs(esperado - monto) > 0.01) nota = `El interés cobrado cambió después de pagar: el bono ahora sería ${dinero(esperado)} (se pagó ${dinero(monto)}).`;
            }
        }
        return { ...b, estadoVivo: 'Pagada', montoVivo: monto, notaVivo: nota };
    }
    if (!c) return { ...b, estadoVivo: b.estado, montoVivo: Number(b.montoBono ?? b.montoReserva) || 0 };
    if (_bonoCuentaCancelada(c)) return { ...b, estadoVivo: 'Anulada', montoVivo: 0, motivoVivo: 'La venta se canceló o la cuenta quedó incobrable.' };
    if (c.estado === 'Saldado') {
        const d = _bonoInteresCobrado(c, pag);
        const fecha = _bonoFechaSaldada(c);
        const monto = Math.round(d.interesCobrado * pct) / 100;
        if (monto <= 0.005 || !fecha) return { ...b, estadoVivo: 'Anulada', montoVivo: 0, motivoVivo: 'Cuenta saldada sin intereses cobrados.' };
        return { ...b, estadoVivo: 'Pendiente', montoVivo: monto, interesVivo: d.interesCobrado, capitalVivo: d.capital, cobradoVivo: d.cobrado, fechaSaldadaVivo: fecha };
    }
    const p = _bonoInteresPactado(c);
    return { ...b, estadoVivo: 'Reservada', montoVivo: Math.round(p.interesPactado * pct) / 100, interesVivo: p.interesPactado, capitalVivo: p.capital };
}

function _bonoVistaLista() {
    const mapa = _bonoCuentasMapa();
    const pag = _bonoPagadoPagaresMap();
    return _bonoLista().map(b => _bonoVista(b, mapa, pag));
}

// Lleva la tabla al estado vivo: Reservada → Pendiente al saldarse, montos de
// reserva al día, y Anulada cuando corresponde. Solo escribe si algo cambió.
function sincronizarBonosCuentaSaldada() {
    try {
        const lista = _bonoLista();
        if (!lista.length) return 0;
        const mapa = _bonoCuentasMapa();
        const pag = _bonoPagadoPagaresMap();
        const hoy = _comAbonoFechaISO('');
        let n = 0, anuladas = 0;
        const nueva = lista.map(b => {
            if (b.estado === 'Pagada' || b.estado === 'Anulada') return b;
            const x = _bonoVista(b, mapa, pag);
            if (x.estadoVivo === 'Reservada') {
                if (b.estado === 'Reservada' && Math.abs((Number(b.montoReserva) || 0) - x.montoVivo) < 0.005) return b;
                n++;
                return { ...b, estado: 'Reservada', interesPactado: x.interesVivo, montoReserva: x.montoVivo, montoBono: x.montoVivo, fechaSaldada: '' };
            }
            if (x.estadoVivo === 'Pendiente') {
                if (b.estado === 'Pendiente' && Math.abs((Number(b.montoBono) || 0) - x.montoVivo) < 0.005 && b.fechaSaldada === x.fechaSaldadaVivo) return b;
                n++;
                return { ...b, estado: 'Pendiente', fechaSaldada: x.fechaSaldadaVivo, capital: x.capitalVivo, cobrado: x.cobradoVivo, interesBase: x.interesVivo, montoBono: x.montoVivo };
            }
            if (x.estadoVivo === 'Anulada') {
                n++; anuladas++;
                return { ...b, estado: 'Anulada', fechaAnulacion: hoy, motivoAnulacion: x.motivoVivo || 'Cuenta no vigente' };
            }
            return b;
        });
        if (n > 0) {
            StorageService.set('bonosCuentaSaldada', nueva);
            if (anuladas > 0 && window.AuditService?.log) {
                window.AuditService.log({
                    accion: 'BONOS_CUENTA_SALDADA_ANULADOS', modulo: 'Vendedores', entidad: 'bonosCuentaSaldada',
                    entidadId: 'sync', detalle: `${anuladas} reserva(s)/bono(s) de cuenta saldada anulados por cancelación, incobrable o sin intereses.`,
                    severidad: 'info', datos: { anuladas }
                });
            }
        }
        return n;
    } catch (e) {
        console.error('No se pudieron sincronizar los bonos por cuenta saldada:', e);
        return 0;
    }
}

// 🧾 Reserva al hacer una venta a crédito (la llama ventas.js). Idempotente y
// nunca debe estorbar la venta.
window.registrarReservaBonoSaldada = function (cuenta, extra) {
    try {
        if (!cuenta || cuenta.folio == null || cuenta.vendedorId == null || cuenta.vendedorId === '') return null;
        const v = StorageService.get('vendedores', []).find(x => String(x.id) === String(cuenta.vendedorId));
        if (!v) return null;
        const pct = _bonoConfig().porcentaje;
        if (pct <= 0) return null;
        const id = `BONO-${cuenta.folio}`;
        const lista = _bonoLista();
        if (lista.some(b => b.id === id)) return null;
        const p = _bonoInteresPactado(cuenta);
        if (p.interesPactado <= 0.005) return null;
        const monto = Math.round(p.interesPactado * pct) / 100;
        if (monto <= 0.005) return null;
        const o = extra || {};
        const registro = {
            id, tipo: 'cuentaSaldada', folioCXC: cuenta.folio,
            vendedorId: v.id, vendedorNombre: v.nombre,
            clienteNombre: cuenta.nombre || cuenta.clienteNombre || '',
            articulos: (cuenta.articulos || []).map(a => ({ nombre: a.nombre, cantidad: a.cantidad })),
            fecha: o.fecha || _bonoFechaDe(cuenta.fechaVenta) || _comAbonoFechaISO(''),
            origen: o.origen || 'venta',
            porcentaje: pct, capital: p.capital, interesPactado: p.interesPactado,
            montoReserva: monto, montoBono: monto, estado: 'Reservada'
        };
        lista.push(registro);
        StorageService.set('bonosCuentaSaldada', lista);
        return registro;
    } catch (e) {
        console.error('No se pudo registrar la reserva del bono por cuenta saldada:', e);
        return null;
    }
};

// 🧾 Reservas para la cartera a crédito que ya estaba vigente antes de existir
// esta función. Se devengan con la fecha de HOY (no reescribe periodos pasados).
function generarReservasCarteraVigente() {
    const pct = _bonoConfig().porcentaje;
    if (pct <= 0) return alert('El % del bono está en 0: no hay nada que reservar.');
    const existentes = new Set(_bonoLista().map(b => String(b.folioCXC)));
    const candidatas = StorageService.get('cuentasPorCobrar', []).filter(c =>
        c && c.estado !== 'Saldado' && !_bonoCuentaCancelada(c) && c.vendedorId != null && c.vendedorId !== '' &&
        !existentes.has(String(c.folio)) && _bonoInteresPactado(c).interesPactado > 0.005);
    if (!candidatas.length) return alert('No hay cuentas vigentes sin reserva.');
    const total = candidatas.reduce((s, c) => s + Math.round(_bonoInteresPactado(c).interesPactado * pct) / 100, 0);
    if (!confirm(`Se crearán ${candidatas.length} reserva(s) por ${dinero(total)} (${pct}% del interés pactado) para cuentas a crédito vigentes. Se devengan con la fecha de hoy. ¿Continuar?`)) return;
    const hoy = _comAbonoFechaISO('');
    let creadas = 0;
    candidatas.forEach(c => { if (window.registrarReservaBonoSaldada(c, { fecha: hoy, origen: 'cartera_vigente' })) creadas++; });
    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'BONOS_CUENTA_SALDADA_RESERVAS_CARTERA', modulo: 'Vendedores', entidad: 'bonosCuentaSaldada',
            entidadId: 'cartera', detalle: `Reservas creadas para cartera vigente: ${creadas}`, monto: total, severidad: 'info',
            datos: { creadas, porcentaje: pct }
        });
    }
    alert(`✅ ${creadas} reserva(s) creada(s).`);
    renderBonoCuentaSaldada();
}

function calcularBonosCuentaSaldada(filtros) {
    const f = filtros || _bonoFiltros();
    const pct = _bonoConfig().porcentaje;
    const mapa = _bonoCuentasMapa();
    const pag = _bonoPagadoPagaresMap();
    const lista = _bonoLista();
    const conRegistro = new Set(lista.map(b => String(b.folioCXC)));
    const vendedores = StorageService.get('vendedores', []);
    const enVend = (vid) => !f.vendedor || String(vid) === String(f.vendedor);
    const enRango = (fs) => !!fs && !(f.desde && fs < f.desde) && !(f.hasta && fs > f.hasta);
    const pendientes = [], reservadas = [];
    let sinInteres = 0;

    lista.map(b => _bonoVista(b, mapa, pag)).forEach(x => {
        if (!enVend(x.vendedorId)) return;
        if (x.estadoVivo === 'Reservada') reservadas.push(x);
        else if (x.estadoVivo === 'Pendiente' && enRango(x.fechaSaldadaVivo)) {
            pendientes.push({
                id: x.id, folioCXC: x.folioCXC, vendedorId: x.vendedorId, vendedorNombre: x.vendedorNombre,
                clienteNombre: x.clienteNombre, articulos: x.articulos || [], fechaSaldada: x.fechaSaldadaVivo,
                capital: x.capitalVivo, cobrado: x.cobradoVivo, interesBase: x.interesVivo,
                porcentaje: Number(x.porcentaje) || 0, monto: x.montoVivo, sinReserva: false
            });
        }
    });

    // Cuentas saldadas antes de que existiera la reserva: se bonifican desde el rango.
    if (pct > 0) Object.values(mapa).forEach(c => {
        if (c.estado !== 'Saldado' || _bonoCuentaCancelada(c) || conRegistro.has(String(c.folio))) return;
        if (c.vendedorId == null || c.vendedorId === '' || !enVend(c.vendedorId)) return;
        const fs = _bonoFechaSaldada(c);
        if (!enRango(fs)) return;
        const d = _bonoInteresCobrado(c, pag);
        if (d.interesCobrado <= 0.005) { sinInteres++; return; }
        const v = vendedores.find(x => String(x.id) === String(c.vendedorId));
        pendientes.push({
            id: `BONO-${c.folio}`, folioCXC: c.folio, vendedorId: c.vendedorId, vendedorNombre: v ? v.nombre : (c.vendedorNombre || 'Vendedor'),
            clienteNombre: (typeof window._cxcNombreClienteVigente === 'function' ? window._cxcNombreClienteVigente(c) : '') || c.nombre || c.clienteNombre || '',
            articulos: c.articulos || [], fechaSaldada: fs, capital: d.capital, cobrado: d.cobrado, interesBase: d.interesCobrado,
            porcentaje: pct, monto: Math.round(d.interesCobrado * pct) / 100, sinReserva: true
        });
    });

    pendientes.sort((a, b) => String(b.fechaSaldada).localeCompare(String(a.fechaSaldada)));
    return { pendientes, reservadas, sinInteres, pct };
}

function _bonoProductosHTML(articulos) {
    if (typeof window.resumenProductosVenta === 'function') return window.resumenProductosVenta(articulos);
    const nombres = (Array.isArray(articulos) ? articulos : []).filter(a => a && a.nombre).map(a => a.nombre);
    return nombres.length ? _vendEsc(nombres.join(', ')) : '<span style="color:#9ca3af;">Sin detalle</span>';
}

function _bonoSel() {
    const st = window._comisionesVendedoresState;
    return st.bonoSel || (st.bonoSel = {});
}

function _bonoToggleSel(id, on) {
    const sel = _bonoSel();
    if (on) sel[id] = true; else delete sel[id];
    renderBonoCuentaSaldada();
}

function _bonoSelTodasVendedor(vendedorId, on) {
    const sel = _bonoSel();
    calcularBonosCuentaSaldada(_bonoFiltros()).pendientes
        .filter(x => String(x.vendedorId) === String(vendedorId))
        .forEach(x => { if (on) sel[x.id] = true; else delete sel[x.id]; });
    renderBonoCuentaSaldada();
}

function _bonoSetHistEstado(valor) {
    window._comisionesVendedoresState.bonoHistEstado = valor;
    renderBonoCuentaSaldada();
}

// Cuentas saldadas que hoy se pueden bonificar para ese vendedor, de entre las ids elegidas.
// Se resuelve sin rango: lo que importa es lo que el usuario seleccionó.
function _bonoResolverSeleccion(vendedorId, ids) {
    const set = new Set(ids);
    return calcularBonosCuentaSaldada({ desde: '', hasta: '', vendedor: String(vendedorId) })
        .pendientes.filter(x => set.has(x.id));
}

function renderBonoCuentaSaldada() {
    const cont = document.getElementById('bonoSaldadaArea');
    if (!cont) return;
    sincronizarBonosCuentaSaldada();
    const st = window._comisionesVendedoresState;
    const f = _bonoFiltros();
    const cfg = _bonoConfig();
    const vendedores = StorageService.get('vendedores', []);
    const r = calcularBonosCuentaSaldada(f);
    const vista = _bonoVistaLista();
    const enVend = (vid) => !f.vendedor || String(vid) === String(f.vendedor);
    const esAdmin = typeof _esAdmin === 'function' && _esAdmin();

    // La selección solo conserva cuentas que siguen por pagar en la lista visible.
    const sel = _bonoSel();
    const visibles = new Set(r.pendientes.map(x => x.id));
    Object.keys(sel).forEach(id => { if (!visibles.has(id)) delete sel[id]; });

    const totalReservado = _bonoRound2(r.reservadas.reduce((s, x) => s + x.montoVivo, 0));
    const totalPorPagar = _bonoRound2(r.pendientes.reduce((s, x) => s + x.monto, 0));
    const totalPagado = _bonoRound2(vista.filter(x => x.estadoVivo === 'Pagada' && enVend(x.vendedorId)).reduce((s, x) => s + x.montoVivo, 0));
    const porRevisar = vista.filter(x => x.notaVivo && enVend(x.vendedorId)).length;

    const celdaCuenta = (x) => `${_bonoProductosHTML(x.articulos)}<br><small style="color:#6b7280;">${_vendEsc(x.clienteNombre)} · <span style="font-size:10px;">${_vendEsc(x.folioCXC)}</span></small>`;
    const grupos = {};
    r.pendientes.forEach(x => { (grupos[String(x.vendedorId)] = grupos[String(x.vendedorId)] || []).push(x); });
    const bloques = Object.keys(grupos).map(vid => {
        const items = grupos[vid];
        const v = vendedores.find(x => String(x.id) === vid);
        const elegidas = items.filter(x => sel[x.id]);
        const totalElegido = _bonoRound2(elegidas.reduce((s, x) => s + x.monto, 0));
        const todas = elegidas.length === items.length;
        const filas = items.map(x => `<tr style="border-bottom:1px solid #f3f4f6;${sel[x.id] ? 'background:#f5f3ff;' : ''}">
            <td style="padding:8px;text-align:center;"><input type="checkbox" ${sel[x.id] ? 'checked' : ''} onchange="_bonoToggleSel('${_vendEsc(x.id)}', this.checked)" style="width:18px;height:18px;"></td>
            <td style="padding:8px;">${celdaCuenta(x)}${x.sinReserva ? '<br><small style="color:#92400e;">sin reserva previa</small>' : ''}</td>
            <td style="padding:8px;text-align:center;">${_comAbonoFechaCorta(x.fechaSaldada)}</td>
            <td style="padding:8px;text-align:right;color:#6b7280;">${dinero(x.capital)}</td>
            <td style="padding:8px;text-align:right;color:#6b7280;">${dinero(x.cobrado)}</td>
            <td style="padding:8px;text-align:right;">${dinero(x.interesBase)}</td>
            <td style="padding:8px;text-align:center;">${Number(x.porcentaje)}%</td>
            <td style="padding:8px;text-align:right;font-weight:bold;">${dinero(x.monto)}</td>
          </tr>`).join('');
        return `<div style="background:white;border-radius:10px;padding:14px;margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
            <strong style="color:#0f172a;">${_vendEsc(v ? v.nombre : (items[0].vendedorNombre || 'Vendedor'))} <small style="color:#6b7280;font-weight:normal;">· ${items.length} cuenta(s) saldada(s)</small></strong>
            <button onclick="_bonoSelTodasVendedor(${Number(vid)}, ${todas ? 'false' : 'true'})" style="padding:5px 10px;background:#ede9fe;color:#5b21b6;border:none;border-radius:6px;cursor:pointer;font-size:12px;">${todas ? 'Quitar selección' : 'Seleccionar todas'}</button>
          </div>
          <div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="background:#f3f4f6;"><th style="padding:8px;"></th><th style="padding:8px;text-align:left;">Producto / Cliente</th><th style="padding:8px;text-align:center;">Saldada</th><th style="padding:8px;text-align:right;">Capital</th><th style="padding:8px;text-align:right;">Pagado total</th><th style="padding:8px;text-align:right;">Interés pagado</th><th style="padding:8px;text-align:center;">%</th><th style="padding:8px;text-align:right;">Bono</th></tr></thead>
            <tbody>${filas}</tbody></table></div>
          <div style="display:flex;justify-content:flex-end;margin-top:10px;">
            <button ${elegidas.length ? '' : 'disabled'} onclick="abrirModalLiquidacionBonoSaldada(${Number(vid)})" style="padding:10px 16px;background:${elegidas.length ? '#7c3aed' : '#d1d5db'};color:white;border:none;border-radius:6px;cursor:${elegidas.length ? 'pointer' : 'not-allowed'};font-weight:bold;font-size:13px;">🏁 Dar bono a ${elegidas.length} seleccionada(s) · ${dinero(totalElegido)}</button>
          </div>
        </div>`;
    }).join('');

    const estHist = st.bonoHistEstado || '';
    const color = { Reservada: '#6b7280', Pendiente: '#d97706', Pagada: '#16a34a', Anulada: '#9ca3af' };
    const hist = vista.filter(x => enVend(x.vendedorId) && (!estHist || x.estadoVivo === estHist))
        .sort((a, b) => String(_bonoFechaDe(b.fechaPago || b.fecha)).localeCompare(String(_bonoFechaDe(a.fechaPago || a.fecha)))).slice(0, 200);
    const filasHist = hist.map(x => `<tr style="border-bottom:1px solid #f3f4f6;">
        <td style="padding:8px;">${_vendEsc(x.vendedorNombre)}</td>
        <td style="padding:8px;">${celdaCuenta(x)}</td>
        <td style="padding:8px;text-align:right;">${dinero(x.interesVivo ?? x.interesBase ?? x.interesPactado ?? 0)}</td>
        <td style="padding:8px;text-align:center;">${Number(x.porcentaje)}%</td>
        <td style="padding:8px;text-align:right;font-weight:bold;">${dinero(x.montoVivo)}</td>
        <td style="padding:8px;text-align:center;">${x.fechaSaldada || x.fechaSaldadaVivo ? _comAbonoFechaCorta(x.fechaSaldada || x.fechaSaldadaVivo) : '-'}</td>
        <td style="padding:8px;text-align:center;color:${color[x.estadoVivo] || '#374151'};font-weight:bold;">${_vendEsc(x.estadoVivo)}${x.fechaPago ? `<br><small style="font-weight:normal;">${_comAbonoFechaCorta(x.fechaPago)}</small>` : ''}${x.notaVivo ? `<br><small title="${_vendEsc(x.notaVivo)}" style="color:#dc2626;cursor:help;font-weight:normal;">⚠ revisar</small>` : ''}${x.estadoVivo === 'Anulada' && (x.motivoAnulacion || x.motivoVivo) ? `<br><small title="${_vendEsc(x.motivoAnulacion || x.motivoVivo)}" style="color:#9ca3af;cursor:help;font-weight:normal;">motivo</small>` : ''}</td>
      </tr>`).join('');

    const inp = 'padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;';
    const lbl = 'font-size:12px;font-weight:bold;color:#374151;';
    cont.innerHTML = `
      <p style="margin:0 0 12px;font-size:12px;color:#6b7280;">Bono aparte de la comisión por venta y de la comisión por abono. Al vender a crédito se crea una <strong>reserva</strong> (% del interés pactado); cuando la cuenta se <strong>salda</strong> queda disponible aquí con los <strong>intereses realmente cobrados</strong> (el precio del producto no cuenta: ya se pagó como comisión de venta). Tú eliges qué cuentas saldadas bonificar.</p>
      <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-bottom:14px;">
        <div><label style="${lbl}">% DE LOS INTERESES</label><br><input type="number" min="0" max="100" step="0.5" value="${cfg.porcentaje}" onchange="_bonoGuardarPct(this.value)" style="width:90px;${inp}"><br><small style="color:#9ca3af;font-size:10px;">las reservas ya hechas conservan su %</small></div>
        <div><label style="${lbl}">SALDADAS DESDE</label><br><input type="date" value="${_vendEsc(f.desde)}" onchange="_bonoSetFiltro('desde', this.value)" style="${inp}"></div>
        <div><label style="${lbl}">HASTA</label><br><input type="date" value="${_vendEsc(f.hasta)}" onchange="_bonoSetFiltro('hasta', this.value)" style="${inp}"></div>
        <div><label style="${lbl}">VENDEDOR</label><br>
          <select onchange="_bonoSetFiltro('vendedor', this.value)" style="${inp}">
            <option value="">Todos</option>
            ${vendedores.map(v => `<option value="${v.id}" ${String(f.vendedor) === String(v.id) ? 'selected' : ''}>${_vendEsc(v.nombre)}</option>`).join('')}
          </select></div>
        ${esAdmin ? `<button onclick="generarReservasCarteraVigente()" title="Crea la reserva de las cuentas a crédito vigentes que no la tienen (se devenga con la fecha de hoy)." style="padding:8px 12px;background:#ede9fe;color:#5b21b6;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:bold;">🧾 Reservar cartera vigente</button>` : ''}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:16px;">
        <div style="background:#f9fafb;padding:12px;border-radius:10px;text-align:center;"><small style="color:#6b7280;">RESERVADO (CUENTAS VIGENTES)</small><br><strong style="font-size:20px;color:#6b7280;">${dinero(totalReservado)}</strong></div>
        <div style="background:#faf5ff;padding:12px;border-radius:10px;text-align:center;"><small style="color:#5b21b6;">SALDADAS POR BONIFICAR</small><br><strong style="font-size:20px;color:#5b21b6;">${dinero(totalPorPagar)}</strong></div>
        <div style="background:#f0fdf4;padding:12px;border-radius:10px;text-align:center;"><small style="color:#16a34a;">BONOS PAGADOS</small><br><strong style="font-size:20px;color:#16a34a;">${dinero(totalPagado)}</strong></div>
        ${porRevisar ? `<div style="background:#fef2f2;padding:12px;border-radius:10px;text-align:center;"><small style="color:#dc2626;">POR REVISAR</small><br><strong style="font-size:20px;color:#dc2626;">${porRevisar}</strong></div>` : ''}
      </div>
      ${r.sinInteres > 0 ? `<p style="margin:0 0 12px;font-size:12px;color:#92400e;">${r.sinInteres} cuenta(s) saldada(s) en el rango no generan bono porque no se cobraron intereses.</p>` : ''}
      <h4 style="margin:0 0 10px;color:#5b21b6;">Ventas saldadas en el rango</h4>
      ${bloques || '<p style="color:#9ca3af;text-align:center;padding:16px;">No hay ventas saldadas pendientes de bono en este rango.</p>'}
      <h4 style="margin:24px 0 8px;color:#374151;">Historial de bonos</h4>
      <div style="margin-bottom:10px;"><select onchange="_bonoSetHistEstado(this.value)" style="${inp}">
        ${['', 'Reservada', 'Pendiente', 'Pagada', 'Anulada'].map(e => `<option value="${e}" ${estHist === e ? 'selected' : ''}>${e || 'Todos los estados'}</option>`).join('')}
      </select></div>
      <div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:#f3f4f6;"><th style="padding:8px;text-align:left;">Vendedor</th><th style="padding:8px;text-align:left;">Producto / Cliente</th><th style="padding:8px;text-align:right;">Interés</th><th style="padding:8px;text-align:center;">%</th><th style="padding:8px;text-align:right;">Bono</th><th style="padding:8px;text-align:center;">Saldada</th><th style="padding:8px;text-align:center;">Estado</th></tr></thead>
        <tbody>${filasHist || '<tr><td colspan="7" style="padding:16px;text-align:center;color:#9ca3af;">Sin bonos con este filtro.</td></tr>'}</tbody>
      </table></div>`;
}

function abrirModalLiquidacionBonoSaldada(vendedorId) {
    const v = StorageService.get('vendedores', []).find(x => String(x.id) === String(vendedorId));
    if (!v) return alert('Vendedor no encontrado.');
    sincronizarBonosCuentaSaldada();
    const sel = _bonoSel();
    const ids = Object.keys(sel);
    const items = _bonoResolverSeleccion(vendedorId, ids);
    const total = _bonoRound2(items.reduce((s, x) => s + x.monto, 0));
    if (!items.length || total <= 0) return alert('⚠️ Selecciona al menos una cuenta saldada de este vendedor.');
    const interes = items.reduce((s, x) => s + x.interesBase, 0);
    window._bonoLiqSnapshot = { vendedorId: String(vendedorId), ids: items.map(x => x.id), n: items.length, total };
    const html = `
    <div data-modal="liquidacion-bono-saldada" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:8000;display:flex;justify-content:center;align-items:center;padding:16px;">
      <div style="background:white;padding:30px;border-radius:12px;width:100%;max-width:440px;max-height:92vh;overflow-y:auto;">
        <h2 style="margin-top:0;color:#7c3aed;">🏁 Dar bono por cuentas saldadas</h2>
        <p style="color:#4b5563;margin-bottom:16px;">Vendedor: <strong>${_vendEsc(v.nombre)}</strong></p>
        <div style="background:#f9fafb;border-radius:8px;padding:14px;margin-bottom:16px;font-size:14px;">
          <div style="display:flex;justify-content:space-between;padding:4px 0;"><span>Cuentas seleccionadas</span><strong>${items.length}</strong></div>
          <div style="display:flex;justify-content:space-between;padding:4px 0;"><span>Intereses cobrados</span><strong>${dinero(interes)}</strong></div>
          <div style="display:flex;justify-content:space-between;padding:8px 0 0;border-top:1px solid #e5e7eb;margin-top:6px;"><span style="font-weight:bold;">Bono total</span><strong style="color:#7c3aed;font-size:17px;">${dinero(total)}</strong></div>
        </div>
        <div style="margin-bottom:14px;">
          <label style="font-weight:bold;font-size:13px;color:#374151;display:block;margin-bottom:5px;">MONTO A DESEMBOLSAR</label>
          <input type="number" id="liqBonoSaldadaMonto" min="0" step="0.01" value="${total.toFixed(2)}" style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:6px;box-sizing:border-box;">
          <p style="margin:4px 0 0;font-size:11px;color:#9ca3af;">Puedes ajustarlo si acordaste pagar un monto distinto.</p>
        </div>
        <div style="margin-bottom:20px;">
          <label style="font-weight:bold;font-size:13px;color:#374151;display:block;margin-bottom:5px;">¿DE QUÉ CAJA/CUENTA SALE?</label>
          ${window._buildSelectorCuentas('liqBonoSaldadaCuenta', false)}
        </div>
        <div style="display:flex;gap:10px;">
          <button onclick="ejecutarLiquidacionBonoSaldada()" style="flex:1;padding:12px;background:#7c3aed;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">✅ Confirmar</button>
          <button onclick="document.querySelector('[data-modal=&quot;liquidacion-bono-saldada&quot;]').remove()" style="flex:1;padding:12px;background:#e5e7eb;color:#4b5563;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">✕ Cancelar</button>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

function ejecutarLiquidacionBonoSaldada() {
    const snap = window._bonoLiqSnapshot;
    if (!snap) return alert('No se pudo leer el pago. Cierra y vuelve a abrirlo.');
    const v = StorageService.get('vendedores', []).find(x => String(x.id) === snap.vendedorId);
    if (!v) return alert('Vendedor no encontrado.');
    sincronizarBonosCuentaSaldada();

    // Se recalcula con lo seleccionado: si algo cambió desde que se abrió el modal, no se paga.
    const items = _bonoResolverSeleccion(snap.vendedorId, snap.ids);
    const total = _bonoRound2(items.reduce((s, x) => s + x.monto, 0));
    if (!items.length || total <= 0) return alert('⚠️ No hay nada que pagar.');
    if (items.length !== snap.n || Math.abs(total - snap.total) > 0.005) {
        document.querySelector('[data-modal="liquidacion-bono-saldada"]')?.remove();
        renderBonoCuentaSaldada();
        return alert('Los datos cambiaron desde que abriste el pago. Nada se aplicó: revisa los nuevos montos y vuelve a intentar.');
    }

    const montoNeto = _bonoRound2(Number(document.getElementById('liqBonoSaldadaMonto')?.value) || 0);
    if (montoNeto <= 0) return alert('⚠️ Ingresa un monto a desembolsar mayor a cero.');
    const sel = document.getElementById('liqBonoSaldadaCuenta');
    if (!sel) return alert('No se pudo leer la cuenta seleccionada.');
    if (typeof window._egresarCuenta !== 'function') return alert('No se pudo registrar el pago: el módulo de caja no está disponible. Nada se aplicó.');
    const cuentaId = sel.value;
    const etiqueta = sel.options[sel.selectedIndex]?.text || cuentaId;
    const hoy = _comAbonoFechaISO('');
    const lote = `LIQ-BONO-SALDADA-${v.id}-${Date.now()}`;

    // 1. El egreso de caja se confirma ANTES de marcar nada: si falla, nada se aplica.
    const ok = window._egresarCuenta({
        monto: montoNeto, cuentaId, etiqueta,
        concepto: `Bono por cuentas saldadas - ${v.nombre}`,
        referencia: lote
    });
    if (!ok) return alert(`No se pudo registrar el egreso de caja para "${etiqueta || cuentaId}". El bono NO se aplicó.`);

    // 2. Marcar como pagados (los "sin reserva" se crean ya pagados).
    try {
        const lista = _bonoLista();
        const idx = new Map(lista.map((b, i) => [b.id, i]));
        items.forEach(x => {
            const base = idx.has(x.id) ? lista[idx.get(x.id)] : null;
            const pagado = {
                ...(base || {
                    id: x.id, tipo: 'cuentaSaldada', folioCXC: x.folioCXC, vendedorId: v.id, vendedorNombre: v.nombre,
                    clienteNombre: x.clienteNombre, articulos: (x.articulos || []).map(a => ({ nombre: a.nombre, cantidad: a.cantidad })),
                    fecha: hoy, origen: 'sin_reserva', montoReserva: 0
                }),
                estado: 'Pagada', fechaSaldada: x.fechaSaldada, fechaPago: hoy,
                capital: x.capital, cobrado: x.cobrado, interesBase: x.interesBase, porcentaje: x.porcentaje, montoBono: x.monto,
                lote, montoDesembolsadoLote: montoNeto, cuentaPago: cuentaId, etiquetaCuentaPago: etiqueta
            };
            if (base) lista[idx.get(x.id)] = pagado; else lista.push(pagado);
        });
        StorageService.set('bonosCuentaSaldada', lista);
    } catch (e) {
        console.error('Bono por cuenta saldada: el egreso se hizo pero no se pudieron registrar los bonos', e);
        return alert(`⚠️ El egreso de caja SÍ se registró (${dinero(montoNeto)}, ref. ${lote}) pero no se pudieron guardar los bonos. NO repitas el pago: revisa Finanzas.`);
    }

    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'BONOS_CUENTA_SALDADA_PAGADOS', modulo: 'Vendedores', entidad: 'bonosCuentaSaldada',
            entidadId: v.id, detalle: `Bono por cuentas saldadas - ${v.nombre}`,
            monto: montoNeto, severidad: 'info',
            datos: { cuentas: items.map(x => x.folioCXC), bonoCalculado: total, montoDesembolsado: montoNeto, lote }
        });
    }
    const sel2 = _bonoSel();
    items.forEach(x => { delete sel2[x.id]; });
    document.querySelector('[data-modal="liquidacion-bono-saldada"]')?.remove();
    alert(`✅ Bono pagado a ${v.nombre}.\n\nCuentas: ${items.length}\nBono calculado: ${dinero(total)}\nDesembolsado: ${dinero(montoNeto)}`);
    renderBonoCuentaSaldada();
}

window.renderComisionesPendientes = renderComisionesPendientes;
window._actualizarFiltroHistorialComisiones = _actualizarFiltroHistorialComisiones;
window._limpiarFiltroHistorialComisiones = _limpiarFiltroHistorialComisiones;
window.renderHistorialComisiones = renderHistorialComisiones;
window.abrirModalLiquidacionComisiones = abrirModalLiquidacionComisiones;
window.ejecutarLiquidacionComisiones = ejecutarLiquidacionComisiones;
window.abrirModalAnticipoComision = abrirModalAnticipoComision;
window.registrarAnticipoComision = registrarAnticipoComision;
window.abrirModalLiquidarAnticipo = abrirModalLiquidarAnticipo;
window.liquidarAnticipoComision = liquidarAnticipoComision;
window.abrirModalEditarMontoAnticipo = abrirModalEditarMontoAnticipo;
window.guardarEdicionMontoAnticipo = guardarEdicionMontoAnticipo;
window.renderAnticiposComision = renderAnticiposComision;
window.calcularLiquidacionComisionAbono = calcularLiquidacionComisionAbono;
window.renderComisionesAbono = renderComisionesAbono;
window.abrirModalLiquidacionComisionAbono = abrirModalLiquidacionComisionAbono;
window.ejecutarLiquidacionComisionAbono = ejecutarLiquidacionComisionAbono;
window._comAbonoSetFiltro = _comAbonoSetFiltro;
window.calcularBonosCuentaSaldada = calcularBonosCuentaSaldada;
window.sincronizarBonosCuentaSaldada = sincronizarBonosCuentaSaldada;
window.bonosCuentaSaldadaVista = _bonoVistaLista;
window.generarReservasCarteraVigente = generarReservasCarteraVigente;
window.renderBonoCuentaSaldada = renderBonoCuentaSaldada;
window.abrirModalLiquidacionBonoSaldada = abrirModalLiquidacionBonoSaldada;
window.ejecutarLiquidacionBonoSaldada = ejecutarLiquidacionBonoSaldada;
window._bonoSetFiltro = _bonoSetFiltro;
window._bonoGuardarPct = _bonoGuardarPct;
window._bonoToggleSel = _bonoToggleSel;
window._bonoSelTodasVendedor = _bonoSelTodasVendedor;
window._bonoSetHistEstado = _bonoSetHistEstado;
