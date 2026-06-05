// Y obtenerFechaCDMX vive en js/services/validator.js a cargado antes que este modulo

// ===== CONSULTA DINAMICA DE INVENTARIO PROFESIONAL =====
// Devuelve la antiguedad del producto en dias, meses o anos segun la fecha de alta o ultima entrada
function calcularAntiguedadProducto(p) {
 // Buscar la fecha mas reciente de entrada en el kardex para este producto
 let kardex = window.movimientosInventario || [];
 let entradas = kardex.filter(m => !_kardexEstaAnulado(m) && m.productoId == p.id && _kardexTipoBase(m) === 'entrada');
 let fechaStr = null;
 if (entradas.length > 0) {
 // Tomar la ultima entrada
 let ultima = entradas.reduce((a, b) => new Date(a.fecha) > new Date(b.fecha) ? a : b);
 fechaStr = ultima.fecha;
 } else if (p.fechaAlta) {
 fechaStr = p.fechaAlta;
 }
 if (!fechaStr) return '-';
 let fecha = new Date(fechaStr);
 if (isNaN(fecha.getTime())) return '-';
 let ahora = new Date();
 let diffMs = ahora - fecha;
 let diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
 if (diffDias < 31) return diffDias + ' dias';
 let diffMeses = Math.floor(diffDias / 30.44);
 if (diffMeses < 12) return diffMeses + ' meses';
 let diffAnios = Math.floor(diffMeses / 12);
 return diffAnios + ' anos';
}
function _invSesionActiva() {
 try { return JSON.parse(sessionStorage.getItem('sesionActiva') || 'null'); } catch { return null; }
}

function _invEsAdmin() {
 if (typeof window.esAdmin === 'function') return window.esAdmin();
 const s = _invSesionActiva();
 return !!(s && s.rol === 'admin');
}

function _invRequireAdmin(accion) {
 if (_invEsAdmin()) return true;
 if (window.AuditService?.log) {
 window.AuditService.log({
 accion: 'ACCESO_DENEGADO',
 modulo: 'Inventario',
 entidad: accion,
 detalle: `Intento sin permisos: ${accion}`,
 severidad: 'alerta'
 });
 }
 alert('Operacion restringida. Solo administrador puede continuar.');
 return false;
}

function _kardexEsc(value) {
 return String(value ?? '').replace(/[&<>"']/g, ch => ({
 '&': '&amp;',
 '<': '&lt;',
 '>': '&gt;',
 '"': '&quot;',
 "'": '&#039;'
 }[ch]));
}

function _kardexFecha(m) {
 return m.fechaISO || m.fecha || m.createdAt || m.fechaRegistro || '';
}

function _kardexDateValue(fecha) {
 if (!fecha) return 0;
 if (typeof fecha === 'number') return fecha;
 const txt = String(fecha).trim();
 const mx = txt.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
 if (mx) return new Date(Number(mx[3]), Number(mx[2]) - 1, Number(mx[1]), 12).getTime();
 const parsed = new Date(txt).getTime();
 return Number.isFinite(parsed) ? parsed : 0;
}

function _kardexFechaClave(fecha) {
 const t = _kardexDateValue(fecha);
 if (!t) return '';
 return new Date(t).toISOString().slice(0, 10);
}

function _kardexTipoBase(m = {}) {
 const txt = `${m.tipo || ''} ${m.concepto || ''} ${m.motivo || ''} ${m.origen || ''}`.toLowerCase();
 if (txt.includes('transfer') || txt.includes('asignacion')) return 'transferencia';
 if (txt.includes('cancel') || txt.includes('reingreso')) return 'cancelacion';
 if (txt.includes('ajuste') || txt.includes('regularizacion') || txt.includes('regularizacion') || txt.includes('merma') || txt.includes('sobrante') || txt.includes('correccion')) return 'ajuste';
 if (txt.includes('salida') || txt.includes('egreso') || txt.includes('venta') || txt.includes('entrega')) return 'salida';
 if (txt.includes('entrada') || txt.includes('ingreso') || txt.includes('recepcion') || txt.includes('compra')) return 'entrada';
 return 'otro';
}

function _kardexEstaAnulado(m = {}) {
 const estado = `${m.estado || ''} ${m.estatus || ''}`.toLowerCase();
 return !!(m.anuladoKardex || m.anulado || m.canceladoAdministrativo || estado.includes('anulad'));
}

function _kardexCantidadFirmada(m = {}, tipoBase = _kardexTipoBase(m)) {
 const cant = Math.abs(Number(m.cantidad || m.cantidadRecibida || m.cantidadTotal || 0));
 const txt = `${m.tipo || ''} ${m.concepto || ''} ${m.motivo || ''}`.toLowerCase();
 if (tipoBase === 'transferencia') return 0;
 if (tipoBase === 'salida') return -cant;
 if (tipoBase === 'ajuste' && (txt.includes('egreso') || txt.includes('merma') || txt.includes('salida'))) return -cant;
 return cant;
}

function _kardexCostoUnitario(m = {}, p = {}) {
 const candidatos = [
 m.costoUnitario,
 m.costo,
 m.precioCompra,
 m.costoPromedio,
 p.costo,
 p.precioCompra,
 p.costoPromedio
 ];
 for (const valor of candidatos) {
 const n = Number(valor);
 if (Number.isFinite(n) && n > 0) return n;
 }
 return _invCostoHistoricoProducto(m.productoId || p.id) || 0;
}

function _normalizarMovimientoKardex(m = {}, productosMap = new Map()) {
 const p = productosMap.get(String(m.productoId)) || {};
 const tipoBase = _kardexTipoBase(m);
 const cantidadFirmada = _kardexCantidadFirmada(m, tipoBase);
 const cantidadAbs = Math.abs(Number(m.cantidad || m.cantidadRecibida || m.cantidadTotal || cantidadFirmada || 0));
 const costoUnitario = _kardexCostoUnitario(m, p);
 const ubicacion = m.ubicacion || m.destino || m.origen || '';
 return {
 id: m.id || `${m.productoId || 'mov'}-${_kardexFecha(m)}-${Math.random()}`,
 fecha: _kardexFecha(m),
 productoId: m.productoId || '',
 productoNombre: m.productoNombre || m.nombre || p.nombre || 'Producto sin nombre',
 categoria: p.categoria || '',
 subcategoria: p.subcategoria || '',
 tipoBase,
 tipoTexto: m.tipo || tipoBase,
 cantidad: cantidadAbs,
 cantidadFirmada,
 costoUnitario,
 valor: cantidadAbs * costoUnitario,
 ubicacion,
 origen: m.origen || '',
 destino: m.destino || '',
 color: m.color || m.colorElegido || '',
 referencia: m.referencia || m.compraId || m.ventaId || m.folio || '',
 proveedor: m.proveedor || '',
 usuario: m.usuario || m.vendedor || '',
 motivo: m.motivo || m.concepto || '',
 anulado: _kardexEstaAnulado(m),
 motivoAnulacion: m.motivoAnulacionKardex || m.motivoAnulacion || '',
 raw: m
 };
}

function _kardexFiltrosUI() {
 return {
 q: String(document.getElementById('karQ')?.value || '').trim().toLowerCase(),
 tipo: document.getElementById('karTipo')?.value || '',
 ubicacion: document.getElementById('karUbicacion')?.value || '',
 desde: document.getElementById('karDesde')?.value || '',
 hasta: document.getElementById('karHasta')?.value || ''
 };
}

window.obtenerKardexNormalizado = function(filtros = {}) {
 const productosMap = new Map((window.productos || []).map(p => [String(p.id), p]));
 let rows = (window.movimientosInventario || []).map(m => _normalizarMovimientoKardex(m, productosMap));
 const f = { q: '', tipo: '', ubicacion: '', desde: '', hasta: '', incluirAnulados: false, ...filtros };
 rows = rows.filter(r => {
 if (!f.incluirAnulados && r.anulado) return false;
 const text = `${r.productoNombre} ${r.categoria} ${r.subcategoria} ${r.tipoTexto} ${r.motivo} ${r.referencia} ${r.proveedor} ${r.usuario}`.toLowerCase();
 if (f.q && !text.includes(f.q)) return false;
 if (f.tipo && r.tipoBase !== f.tipo) return false;
 if (f.ubicacion && ![r.ubicacion, r.origen, r.destino].includes(f.ubicacion)) return false;
 const d = _kardexFechaClave(r.fecha);
 if (f.desde && d < f.desde) return false;
 if (f.hasta && d > f.hasta) return false;
 return true;
 });
 return rows.sort((a, b) => _kardexDateValue(b.fecha) - _kardexDateValue(a.fecha));
};

function _invDinero(valor) {
 const n = Number(valor || 0);
 if (typeof dinero === 'function') return dinero(n);
 return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function _invArray(value) {
 return Array.isArray(value) ? value : [];
}

function _invStorageArray(key) {
 try {
 if (typeof StorageService === 'undefined') return [];
 return _invArray(StorageService.get(key, []));
 } catch {
 return [];
 }
}

function _invCostoHistoricoProducto(productoId) {
 if (!productoId) return 0;
 const historicos = _invStorageArray('historialCostos')
 .filter(h => String(h.productoId || h.idProducto || '') === String(productoId))
 .map(h => ({
 costo: Number(h.precioCompra || h.costoNuevo || h.costo || h.nuevo || 0),
 fecha: h.fecha || h.fechaISO || h.createdAt || ''
 }))
 .filter(h => Number.isFinite(h.costo) && h.costo > 0)
 .sort((a, b) => _kardexDateValue(b.fecha) - _kardexDateValue(a.fecha));
 return historicos[0]?.costo || 0;
}

function _invTextoNormalizado(value) {
 return String(value || '').trim().toLowerCase();
}

function _invItemProductoId(item = {}) {
 return item.productoId || item.idProducto || item.product_id || item.id || item.sku || '';
}

function _invItemNombre(item = {}) {
 return item.productoNombre || item.nombreProducto || item.nombre || item.descripcion || item.titulo || '';
}

function _invItemCantidad(item = {}) {
 const raw = item.cantidad ?? item.cant ?? item.qty ?? item.piezas ?? item.unidades ?? item.cantidadRec ?? item.cantidadRecibida ?? item.cantidadTotal ?? 1;
 const n = Number(raw);
 return Number.isFinite(n) ? n : 1;
}

function _invItemMonto(item = {}) {
 const raw = item.subtotal ?? item.total ?? item.importe ?? item.monto ?? item.precioTotal ?? item.precioVenta ?? item.precio;
 const n = Number(raw);
 if (Number.isFinite(n) && n > 0) return n;
 const costoUnitario = Number(item.costoUnitario ?? item.costo ?? item.precioCompra ?? 0);
 const cantidad = _invItemCantidad(item);
 return Number.isFinite(costoUnitario) && costoUnitario > 0 ? costoUnitario * cantidad : 0;
}

function _invItemCoincideProducto(item = {}, producto = {}) {
 const itemId = _invItemProductoId(item);
 if (itemId && String(itemId) === String(producto.id)) return true;
 const itemNombre = _invTextoNormalizado(_invItemNombre(item));
 const prodNombre = _invTextoNormalizado(producto.nombre);
 return !!(!itemId && itemNombre && prodNombre && itemNombre === prodNombre);
}

function _invItemsDocumento(doc = {}) {
 const candidatos = [
 doc.articulos,
 doc.carrito,
 doc.items,
 doc.productos,
 doc.detalle,
 doc.detalles,
 doc.conceptos,
 doc.venta?.articulos,
 doc.venta?.carrito,
 doc.datosVenta?.articulos,
 doc.datosVenta?.carrito,
 doc.datosVenta?.items,
 doc.documento?.articulos,
 doc.compra?.articulos,
 doc.oc?.articulos
 ];
 return candidatos.find(Array.isArray) || [];
}

function _invFechaDocumento(doc = {}) {
 return doc.fechaISO || doc.fecha || doc.fechaVenta || doc.fechaRegistro || doc.createdAt || doc.fechaApartado || doc.fechaDocumento || doc.fechaCompra || doc.fechaRecepcion || '';
}

function _invReferenciaDocumento(doc = {}) {
 return doc.folio || doc.folioVenta || doc.folioDocumento || doc.referencia || doc.id || doc.compraId || doc.ordenCompraId || '';
}

function _invActorDocumento(doc = {}) {
 return doc.clienteNombre || doc.nombreCliente || doc.cliente?.nombre || doc.proveedorNombre || doc.proveedor?.nombre || doc.vendedorNombre || doc.vendedor || doc.usuario || '';
}

function _invEstadoDocumento(doc = {}) {
 return doc.estado || doc.estatus || doc.status || doc.tipoVenta || doc.metodo || doc.metodoPago || '';
}

function _invAddEventoDocumento(eventos, producto, doc, item, cfg = {}) {
 const cantidad = item ? _invItemCantidad(item) : Number(doc.cantidad || doc.cantidadRecibida || doc.cantidadTotal || 1);
 const monto = item ? _invItemMonto(item) : Number(doc.total || doc.monto || doc.importe || doc.costo || 0);
 const referencia = _invReferenciaDocumento(doc);
 eventos.push({
 source: cfg.source || 'documento',
 clase: cfg.clase || 'otro',
 tipo: cfg.tipo || 'Documento',
 fecha: _invFechaDocumento(doc),
 referencia,
 descripcion: cfg.descripcion || doc.concepto || doc.motivo || _invItemNombre(item) || producto.nombre || '-',
 cantidad,
 monto,
 actor: _invActorDocumento(doc),
 estado: _invEstadoDocumento(doc),
 detalle: cfg.detalle || '',
 sort: _kardexDateValue(_invFechaDocumento(doc)),
 dedupe: `${cfg.source || 'doc'}|${referencia}|${cfg.tipo || ''}|${producto.id}|${cantidad}|${_invFechaDocumento(doc)}`
 });
}

function _invAgregarEventosPorItems(eventos, producto, key, cfg) {
 _invStorageArray(key).forEach(doc => {
 const items = _invItemsDocumento(doc);
 if (!items.length) {
 if (String(doc.productoId || doc.idProducto || '') === String(producto.id)) {
 _invAddEventoDocumento(eventos, producto, doc, null, { ...cfg, source: key });
 }
 return;
 }
 items.filter(item => _invItemCoincideProducto(item, producto)).forEach(item => {
 _invAddEventoDocumento(eventos, producto, doc, item, { ...cfg, source: key });
 });
 });
}

function _invHistorialProducto(producto) {
 const eventos = [];
 window.obtenerKardexNormalizado({}).filter(r => String(r.productoId) === String(producto.id)).forEach(r => {
 const signo = r.cantidadFirmada > 0 ? '+' : r.cantidadFirmada < 0 ? '-' : '';
 eventos.push({
 source: 'movimientosInventario',
 clase: r.tipoBase,
 tipo: `Kardex: ${r.tipoTexto}`,
 fecha: r.fecha,
 referencia: r.referencia || '',
 descripcion: r.motivo || r.tipoTexto || '-',
 cantidad: `${signo}${r.cantidad}`,
 monto: r.valor,
 actor: r.usuario || r.proveedor || '',
 estado: r.ubicacion || r.destino || r.origen || '',
 detalle: r.tipoBase === 'transferencia' ? `${r.origen || '-'} -> ${r.destino || '-'}` : (r.color ? `Color: ${r.color}` : ''),
 sort: _kardexDateValue(r.fecha),
 dedupe: `kardex|${r.id}`
 });
 });

 [
 ['ventasRegistradas', { tipo: 'Venta registrada', clase: 'venta' }],
 ['registroTickets', { tipo: 'Ticket emitido', clase: 'venta' }],
 ['ventasPendientes', { tipo: 'Venta en boveda', clase: 'pendiente' }],
 ['cuentasPorCobrar', { tipo: 'Credito / CxC', clase: 'credito' }],
 ['apartados', { tipo: 'Apartado', clase: 'apartado' }],
 ['documentosEntrega', { tipo: 'Documento de entrega', clase: 'entrega' }],
 ['salidasPendientesVenta', { tipo: 'Salida pendiente', clase: 'entrega' }],
 ['documentosCancelacion', { tipo: 'Documento de cancelacion', clase: 'cancelacion' }],
 ['historialDevoluciones', { tipo: 'Devolucion', clase: 'devolucion' }],
 ['ordenesCompra', { tipo: 'Orden de compra', clase: 'compra' }],
 ['compras', { tipo: 'Compra', clase: 'compra' }],
 ['recepciones', { tipo: 'Recepcion', clase: 'entrada' }],
 ['requisicionesCompra', { tipo: 'Requisicion de compra', clase: 'requisicion' }],
 ['consignacionesActivas', { tipo: 'Consignacion', clase: 'consignacion' }]
 ].forEach(([key, cfg]) => _invAgregarEventosPorItems(eventos, producto, key, cfg));

 _invStorageArray('historialCostos')
 .filter(h => String(h.productoId || h.idProducto || '') === String(producto.id))
 .forEach(h => _invAddEventoDocumento(eventos, producto, h, null, {
 source: 'historialCostos',
 tipo: 'Cambio de costo',
 clase: 'costo',
 descripcion: `Costo: ${_invDinero(h.costoAnterior || h.anterior || 0)} -> ${_invDinero(h.costoNuevo || h.nuevo || h.costo || 0)}`
 }));

 const unicos = new Map();
 eventos.forEach(ev => {
 const key = ev.dedupe || `${ev.source}|${ev.referencia}|${ev.tipo}|${ev.fecha}|${ev.cantidad}`;
 if (!unicos.has(key)) unicos.set(key, ev);
 });
 return [...unicos.values()].sort((a, b) => (b.sort || 0) - (a.sort || 0));
}

function _invResumenHistorial(eventos) {
 const cuenta = clase => eventos.filter(e => e.clase === clase || e.tipo?.toLowerCase().includes(clase)).length;
 return {
 total: eventos.length,
 entradas: eventos.filter(e => ['entrada', 'compra', 'consignacion'].includes(e.clase)).length,
 salidas: eventos.filter(e => ['salida', 'venta', 'entrega'].includes(e.clase)).length,
 ajustes: eventos.filter(e => e.clase === 'ajuste').length,
 docs: eventos.filter(e => !String(e.source || '').includes('movimientosInventario')).length,
 cancelaciones: cuenta('cancelacion') + cuenta('devolucion')
 };
}

function _invRenderHistorialProducto(producto) {
 const eventos = _invHistorialProducto(producto);
 const res = _invResumenHistorial(eventos);
 const colorClase = {
 entrada: '#047857',
 compra: '#047857',
 venta: '#b91c1c',
 salida: '#b91c1c',
 entrega: '#b91c1c',
 ajuste: '#b45309',
 transferencia: '#1d4ed8',
 cancelacion: '#7c3aed',
 devolucion: '#7c3aed',
 credito: '#0f766e',
 apartado: '#9333ea',
 pendiente: '#475569',
 requisicion: '#0369a1',
 consignacion: '#854d0e',
 costo: '#334155',
 otro: '#475569'
 };
 const filas = eventos.map(ev => {
 const color = colorClase[ev.clase] || '#475569';
 const fechaTxt = ev.fecha ? (window.formatearFechaCortaMX ? window.formatearFechaCortaMX(ev.fecha) : ev.fecha) : '-';
 const cantTxt = typeof ev.cantidad === 'number' ? ev.cantidad : (ev.cantidad || '-');
 const monto = Number(ev.monto || 0);
 return `<tr style="border-bottom:1px solid #e2e8f0;">
 <td style="padding:10px;white-space:nowrap;">${_kardexEsc(fechaTxt)}</td>
 <td style="padding:10px;"><span style="display:inline-block;background:${color};color:white;border-radius:999px;padding:3px 9px;font-size:11px;font-weight:900;">${_kardexEsc(ev.tipo)}</span><br><small style="color:#64748b;">${_kardexEsc(ev.source || '')}</small></td>
 <td style="padding:10px;"><b>${_kardexEsc(ev.referencia || '-')}</b><br><small style="color:#64748b;">${_kardexEsc(ev.actor || '')}</small></td>
 <td style="padding:10px;">${_kardexEsc(ev.descripcion || '-')} ${ev.detalle ? `<br><small style="color:#64748b;">${_kardexEsc(ev.detalle)}</small>` : ''}</td>
 <td style="padding:10px;text-align:right;font-weight:900;">${_kardexEsc(cantTxt)}</td>
 <td style="padding:10px;text-align:right;">${monto ? _invDinero(monto) : '-'}</td>
 <td style="padding:10px;">${_kardexEsc(ev.estado || '-')}</td>
 </tr>`;
 }).join('');

 return `
 <div style="margin-top:18px;background:white;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
 <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;padding:18px;border-bottom:1px solid #e2e8f0;background:#f8fafc;">
 <div>
 <h3 style="margin:0;color:#0f172a;">Historial completo del producto</h3>
 <p style="margin:4px 0 0;color:#64748b;font-size:13px;">Incluye Kardex y documentos relacionados encontrados en ventas, compras, apartados, entregas, devoluciones, requisiciones y consignaciones.</p>
 </div>
 <button onclick="exportarHistorialProductoCSV('${String(producto.id).replace(/'/g, "\\'")}')" style="padding:9px 13px;background:#047857;color:white;border:0;border-radius:7px;font-weight:bold;cursor:pointer;">Exportar CSV</button>
 </div>
 <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;padding:14px;background:white;">
 <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;"><small style="font-weight:900;color:#64748b;">TOTAL</small><br><b style="font-size:22px;color:#0f172a;">${res.total}</b></div>
 <div style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:8px;padding:10px;"><small style="font-weight:900;color:#64748b;">ENTRADAS</small><br><b style="font-size:22px;color:#047857;">${res.entradas}</b></div>
 <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px;"><small style="font-weight:900;color:#64748b;">SALIDAS</small><br><b style="font-size:22px;color:#b91c1c;">${res.salidas}</b></div>
 <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px;"><small style="font-weight:900;color:#64748b;">AJUSTES</small><br><b style="font-size:22px;color:#b45309;">${res.ajustes}</b></div>
 <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px;"><small style="font-weight:900;color:#64748b;">DOCUMENTOS</small><br><b style="font-size:22px;color:#1d4ed8;">${res.docs}</b></div>
 <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:10px;"><small style="font-weight:900;color:#64748b;">REVERSAS</small><br><b style="font-size:22px;color:#7c3aed;">${res.cancelaciones}</b></div>
 </div>
 <div style="max-height:520px;overflow:auto;border-top:1px solid #e2e8f0;">
 <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:1050px;">
 <thead style="position:sticky;top:0;background:#f8fafc;color:#475569;z-index:1;">
 <tr><th style="padding:10px;text-align:left;">Fecha</th><th style="padding:10px;text-align:left;">Evento</th><th style="padding:10px;text-align:left;">Referencia</th><th style="padding:10px;text-align:left;">Detalle</th><th style="padding:10px;text-align:right;">Cant.</th><th style="padding:10px;text-align:right;">Importe</th><th style="padding:10px;text-align:left;">Estado/Ubic.</th></tr>
 </thead>
 <tbody>${filas || '<tr><td colspan="7" style="padding:30px;text-align:center;color:#64748b;">Sin historial encontrado para este producto.</td></tr>'}</tbody>
 </table>
 </div>
 </div>`;
}

window.exportarHistorialProductoCSV = function(productoId) {
 const producto = (window.productos || []).find(p => String(p.id) === String(productoId));
 if (!producto) return alert('Producto no encontrado.');
 const rows = _invHistorialProducto(producto);
 const headers = ['fecha','tipo','source','referencia','descripcion','cantidad','monto','actor','estado','detalle'];
 const csv = [headers.join(',')].concat(rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))).join('\n');
 const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 const nombreArchivo = String(producto.nombre || producto.id || 'producto')
 .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
 .replace(/[^a-zA-Z0-9_-]+/g, '_')
 .replace(/^_+|_+$/g, '')
 .slice(0, 70) || 'producto';
 a.download = `historial_producto_${nombreArchivo}_${new Date().toISOString().slice(0,10)}.csv`;
 a.click();
 URL.revokeObjectURL(url);
};

function renderConsultaKardexProfesional() {
 const old = _kardexFiltrosUI();
 const rows = window.obtenerKardexNormalizado(old);
 const todas = window.obtenerKardexNormalizado();
 const ubicaciones = [...new Set([
 ...((StorageService.get('ubicacionesConfig', []) || []).map(u => u.nombre)),
 ...todas.flatMap(r => [r.ubicacion, r.origen, r.destino])
 ].filter(Boolean))].sort();
 const sum = (arr, fn) => arr.reduce((s, r) => s + fn(r), 0);
 const entradasOperativas = rows.filter(r => r.tipoBase === 'entrada');
 const salidasOperativas = rows.filter(r => r.tipoBase === 'salida');
 const ajustes = rows.filter(r => r.tipoBase === 'ajuste');
 const transferencias = rows.filter(r => r.tipoBase === 'transferencia');
 const neto = sum(rows, r => r.cantidadFirmada);
 const ajusteNeto = sum(ajustes, r => r.cantidadFirmada);
 const valorEntrada = sum(entradasOperativas, r => r.valor);
 const valorSalida = sum(salidasOperativas, r => r.valor);
 const tipoOpts = [
 ['', 'Todos'],
 ['entrada', 'Entradas'],
 ['salida', 'Salidas'],
 ['ajuste', 'Ajustes'],
 ['transferencia', 'Transferencias'],
 ['cancelacion', 'Cancelaciones'],
 ['otro', 'Otros']
 ].map(([v, l]) => `<option value="${v}" ${old.tipo === v ? 'selected' : ''}>${l}</option>`).join('');
 const ubiOpts = '<option value="">Todas</option>' + ubicaciones.map(u => `<option value="${_kardexEsc(u)}" ${old.ubicacion === u ? 'selected' : ''}>${_kardexEsc(u)}</option>`).join('');
 const filas = rows.slice(0, 500).map(r => {
 const color = r.cantidadFirmada < 0 ? '#b91c1c' : r.cantidadFirmada > 0 ? '#047857' : '#475569';
 const signo = r.cantidadFirmada > 0 ? '+' : r.cantidadFirmada < 0 ? '-' : '';
 const ubicacionTxt = r.tipoBase === 'transferencia' ? `${r.origen || '-'} -> ${r.destino || '-'}` : (r.ubicacion || '-');
 return `<tr style="border-bottom:1px solid #e2e8f0;">
 <td style="padding:9px;white-space:nowrap;">${_kardexEsc(window.formatearFechaCortaMX ? window.formatearFechaCortaMX(r.fecha) : r.fecha || '-')}</td>
 <td style="padding:9px;"><b>${_kardexEsc(r.productoNombre)}</b><br><small style="color:#64748b;">${_kardexEsc([r.categoria, r.subcategoria].filter(Boolean).join(' / ') || '-')}</small></td>
 <td style="padding:9px;"><span style="font-weight:900;color:${color};text-transform:uppercase;">${_kardexEsc(r.tipoBase)}</span><br><small style="color:#64748b;">${_kardexEsc(r.tipoTexto)}</small></td>
 <td style="padding:9px;">${_kardexEsc(ubicacionTxt)}${r.color ? `<br><small style="color:#64748b;">Color: ${_kardexEsc(r.color)}</small>` : ''}</td>
 <td style="padding:9px;text-align:right;font-weight:900;color:${color};">${signo}${r.cantidad}</td>
 <td style="padding:9px;text-align:right;">${typeof dinero === 'function' ? dinero(r.costoUnitario) : r.costoUnitario.toFixed(2)}</td>
 <td style="padding:9px;text-align:right;font-weight:bold;">${typeof dinero === 'function' ? dinero(r.valor) : r.valor.toFixed(2)}</td>
 <td style="padding:9px;">${_kardexEsc(r.referencia || '-')}<br><small style="color:#64748b;">${_kardexEsc(r.usuario || r.proveedor || '')}</small></td>
 <td style="padding:9px;">${_kardexEsc(r.motivo || '-')}</td>
 </tr>`;
 }).join('');

 return `
 <div id="consultaKardexProfesional" style="margin-top:24px;">
 <div style="display:flex;justify-content:space-between;gap:14px;align-items:flex-end;flex-wrap:wrap;margin-bottom:12px;">
 <div>
 <h3 style="margin:0;color:#0f172a;">Kardex profesional</h3>
 <p style="margin:4px 0 0;color:#64748b;">Consulta normalizada de entradas, salidas, ajustes, transferencias y cancelaciones.</p>
 </div>
 <button onclick="exportarKardexCSV()" style="padding:10px 14px;background:#047857;color:white;border:0;border-radius:7px;font-weight:bold;cursor:pointer;">Exportar CSV</button>
 </div>
 <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:12px;">
 <div style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:8px;padding:12px;"><small style="color:#475569;font-weight:900;">ENTRADAS OP.</small><br><b style="font-size:22px;color:#047857;">${sum(entradasOperativas, r => r.cantidad)}</b></div>
 <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;"><small style="color:#475569;font-weight:900;">SALIDAS OP.</small><br><b style="font-size:22px;color:#b91c1c;">${sum(salidasOperativas, r => r.cantidad)}</b></div>
 <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;"><small style="color:#475569;font-weight:900;">NETO</small><br><b style="font-size:22px;color:#1d4ed8;">${neto}</b></div>
 <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px;"><small style="color:#475569;font-weight:900;">AJUSTES</small><br><b style="font-size:20px;color:#b45309;">${ajustes.length} / ${ajusteNeto > 0 ? '+' : ''}${ajusteNeto}</b></div>
 <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;"><small style="color:#475569;font-weight:900;">TRANSFERENCIAS</small><br><b style="font-size:22px;color:#334155;">${transferencias.length}</b></div>
 <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:12px;"><small style="color:#475569;font-weight:900;">VALOR ENT/SAL</small><br><b style="font-size:15px;color:#0369a1;">${typeof dinero === 'function' ? `${dinero(valorEntrada)} / ${dinero(valorSalida)}` : `${valorEntrada.toFixed(2)} / ${valorSalida.toFixed(2)}`}</b></div>
 </div>
 <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:12px;display:grid;grid-template-columns:2fr repeat(4,minmax(125px,1fr));gap:10px;align-items:end;">
 <div><label style="font-size:11px;font-weight:900;color:#475569;">BUSCAR</label><input id="karQ" value="${_kardexEsc(old.q)}" oninput="refrescarKardexInventario()" placeholder="Producto, folio, proveedor, motivo..." style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px;"></div>
 <div><label style="font-size:11px;font-weight:900;color:#475569;">TIPO</label><select id="karTipo" onchange="refrescarKardexInventario()" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px;">${tipoOpts}</select></div>
 <div><label style="font-size:11px;font-weight:900;color:#475569;">UBICACION</label><select id="karUbicacion" onchange="refrescarKardexInventario()" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px;">${ubiOpts}</select></div>
 <div><label style="font-size:11px;font-weight:900;color:#475569;">DESDE</label><input type="date" id="karDesde" value="${_kardexEsc(old.desde)}" onchange="refrescarKardexInventario()" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px;"></div>
 <div><label style="font-size:11px;font-weight:900;color:#475569;">HASTA</label><input type="date" id="karHasta" value="${_kardexEsc(old.hasta)}" onchange="refrescarKardexInventario()" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px;"></div>
 </div>
 <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;overflow:auto;max-height:560px;">
 <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:1120px;">
 <thead style="position:sticky;top:0;background:#f8fafc;color:#475569;z-index:1;"><tr>
 <th style="padding:10px;text-align:left;">Fecha</th><th style="padding:10px;text-align:left;">Producto</th><th style="padding:10px;text-align:left;">Tipo</th><th style="padding:10px;text-align:left;">Ubicacion</th><th style="padding:10px;text-align:right;">Cant.</th><th style="padding:10px;text-align:right;">Costo</th><th style="padding:10px;text-align:right;">Valor</th><th style="padding:10px;text-align:left;">Referencia</th><th style="padding:10px;text-align:left;">Motivo</th>
 </tr></thead>
 <tbody>${filas || '<tr><td colspan="9" style="padding:28px;text-align:center;color:#64748b;">Sin movimientos para los filtros actuales.</td></tr>'}</tbody>
 </table>
 </div>
 <div style="margin-top:8px;color:#64748b;font-size:12px;">Mostrando ${Math.min(rows.length, 500)} de ${rows.length} movimiento(s). El Kardex completo queda disponible en CSV.</div>
 </div>`;
}

window.renderKardexInventario = function(modo = window._kardexVistaActiva || 'control') {
 const cont = document.getElementById('contenidoKardexInventario');
 if (!cont) return;
 window._kardexVistaActiva = modo === 'profesional' ? 'profesional' : 'control';
 const btn = (id, label) => {
 const active = window._kardexVistaActiva === id;
 return `<button onclick="renderKardexInventario('${id}')" style="padding:10px 14px;border:1px solid ${active ? '#1d4ed8' : '#cbd5e1'};background:${active ? '#1d4ed8' : 'white'};color:${active ? 'white' : '#334155'};border-radius:7px;font-weight:900;cursor:pointer;">${label}</button>`;
 };
 cont.innerHTML = `
 <div style="padding:24px;max-width:1280px;margin:0 auto;">
 <div style="display:flex;justify-content:space-between;gap:14px;align-items:flex-end;flex-wrap:wrap;margin-bottom:16px;">
 <div>
 <h2 style="margin:0;color:#0f172a;">Kardex de Inventario</h2>
 <p style="margin:5px 0 0;color:#64748b;">Control operativo y consulta profesional de movimientos.</p>
 </div>
 <div style="display:flex;gap:8px;flex-wrap:wrap;">
 ${btn('control', 'Control Kardex vs Inventario')}
 ${btn('profesional', 'Kardex profesional')}
 </div>
 </div>
 ${window._kardexVistaActiva === 'control' ? _kardexRenderControl() : renderConsultaKardexProfesional()}
 </div>`;
};

window.refrescarKardexInventario = function() {
 const activo = document.activeElement;
 const activoId = activo?.id || '';
 const inicio = typeof activo?.selectionStart === 'number' ? activo.selectionStart : null;
 const fin = typeof activo?.selectionEnd === 'number' ? activo.selectionEnd : null;
 renderKardexInventario(window._kardexVistaActiva || 'profesional');
 if (!activoId) return;
 setTimeout(() => {
 const nuevo = document.getElementById(activoId);
 if (!nuevo) return;
 nuevo.focus();
 if (inicio !== null && typeof nuevo.setSelectionRange === 'function') {
 nuevo.setSelectionRange(inicio, fin ?? inicio);
 }
 }, 0);
};

window.exportarKardexCSV = function() {
 const rows = window.obtenerKardexNormalizado(_kardexFiltrosUI());
 const headers = ['fecha','productoNombre','categoria','subcategoria','tipoBase','tipoTexto','cantidad','cantidadFirmada','costoUnitario','valor','ubicacion','origen','destino','color','referencia','proveedor','usuario','motivo'];
 const csv = [headers.join(',')].concat(rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))).join('\n');
 const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `kardex_${new Date().toISOString().slice(0,10)}.csv`;
 a.click();
 URL.revokeObjectURL(url);
};

function _kardexStockAsignadoProducto(p = {}) {
 return (p.variantes || []).reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
}

function _kardexControlProductos() {
 const rows = window.obtenerKardexNormalizado({});
 const netoPorProducto = new Map();
 rows.forEach(r => {
 const key = String(r.productoId || '');
 netoPorProducto.set(key, (netoPorProducto.get(key) || 0) + Number(r.cantidadFirmada || 0));
 });
 return (window.productos || []).map(p => {
 const stockSistema = Number(p.stock || 0);
 const stockAsignado = _kardexStockAsignadoProducto(p);
 const netoKardex = netoPorProducto.get(String(p.id)) || 0;
 return {
 producto: p,
 stockSistema,
 stockAsignado,
 netoKardex,
 diferenciaKardex: stockSistema - netoKardex,
 diferenciaUbicacion: stockSistema - stockAsignado
 };
 });
}

function _kardexClaveDuplicado(m = {}) {
 const fecha = _kardexDateValue(_kardexFecha(m));
 const fechaMin = fecha ? new Date(fecha).toISOString().slice(0, 16) : '';
 const tipo = _kardexTipoBase(m);
 const cant = Math.abs(Number(m.cantidad || m.cantidadRecibida || m.cantidadTotal || 0));
 const ref = String(m.referencia || m.compraId || m.ventaId || m.folio || '').trim().toLowerCase();
 const motivo = String(m.motivo || m.concepto || '').trim().toLowerCase();
 const ubi = String(m.ubicacion || m.origen || m.destino || '').trim().toLowerCase();
 const color = String(m.color || m.colorElegido || '').trim().toLowerCase();
 return [m.productoId || '', fechaMin, tipo, cant, ref, motivo, ubi, color].join('|');
}

function _kardexDuplicados() {
 const productosMap = new Map((window.productos || []).map(p => [String(p.id), p]));
 const grupos = new Map();
 (window.movimientosInventario || []).forEach((m, index) => {
 if (_kardexEstaAnulado(m)) return;
 const key = _kardexClaveDuplicado(m);
 const normalizado = _normalizarMovimientoKardex(m, productosMap);
 if (!grupos.has(key)) grupos.set(key, []);
 grupos.get(key).push({ index, movimiento: m, normalizado });
 });
 return [...grupos.values()].filter(g => g.length > 1);
}

function _kardexRenderControl() {
 const control = _kardexControlProductos();
 const diferenciasKardex = control.filter(x => Math.abs(x.diferenciaKardex) > 0.0001);
 const diferenciasUbicacion = control.filter(x => Math.abs(x.diferenciaUbicacion) > 0.0001);
 const duplicados = _kardexDuplicados();
 const anulados = (window.movimientosInventario || []).filter(_kardexEstaAnulado);
 const fmt = n => Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 });

 const filasDiferencias = diferenciasKardex
 .sort((a, b) => Math.abs(b.diferenciaKardex) - Math.abs(a.diferenciaKardex))
 .slice(0, 80)
 .map(x => `<tr style="border-bottom:1px solid #e2e8f0;">
 <td style="padding:9px;"><b>${_kardexEsc(x.producto.nombre || 'Producto')}</b><br><small style="color:#64748b;">${_kardexEsc([x.producto.categoria, x.producto.subcategoria].filter(Boolean).join(' / '))}</small></td>
 <td style="padding:9px;text-align:right;font-weight:900;">${fmt(x.stockSistema)}</td>
 <td style="padding:9px;text-align:right;">${fmt(x.netoKardex)}</td>
 <td style="padding:9px;text-align:right;color:${x.diferenciaKardex > 0 ? '#047857' : '#b91c1c'};font-weight:900;">${fmt(x.diferenciaKardex)}</td>
 <td style="padding:9px;text-align:right;">${fmt(x.stockAsignado)}</td>
 <td style="padding:9px;text-align:right;color:${x.diferenciaUbicacion ? '#b45309' : '#64748b'};font-weight:900;">${fmt(x.diferenciaUbicacion)}</td>
 <td style="padding:9px;text-align:right;white-space:nowrap;">
 <button onclick="regularizarKardexAlStock('${String(x.producto.id).replace(/'/g, "\\'")}')" style="padding:7px 10px;background:#1d4ed8;color:white;border:0;border-radius:6px;font-weight:bold;cursor:pointer;">Regularizar Kardex</button>
 <button onclick="abrirVisorMaestro('${String(x.producto.id).replace(/'/g, "\\'")}', 'kardex-inventario')" style="padding:7px 10px;background:#334155;color:white;border:0;border-radius:6px;font-weight:bold;cursor:pointer;">Ver</button>
 </td>
 </tr>`).join('');

 const filasDuplicados = duplicados.slice(0, 40).map((grupo, gidx) => {
 const primero = grupo[0].normalizado;
 const detalles = grupo.map((x, idx) => {
 const r = x.normalizado;
 const fecha = r.fecha ? (window.formatearFechaCortaMX ? window.formatearFechaCortaMX(r.fecha) : r.fecha) : '-';
 return `<div style="display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;border-top:1px solid #e2e8f0;padding:7px 0;">
 <div><b>${_kardexEsc(fecha)}</b> ${_kardexEsc(r.tipoTexto)} | ${_kardexEsc(r.motivo || '-')}<br><small style="color:#64748b;">Ref: ${_kardexEsc(r.referencia || '-')} | Cant: ${_kardexEsc(r.cantidad)} | Ubic: ${_kardexEsc(r.ubicacion || r.destino || r.origen || '-')}</small></div>
 <button onclick="anularMovimientoKardex(${x.index}, false)" style="padding:6px 9px;background:#64748b;color:white;border:0;border-radius:6px;font-size:12px;font-weight:bold;cursor:pointer;">Anular solo Kardex</button>
 <button onclick="anularMovimientoKardex(${x.index}, true)" style="padding:6px 9px;background:#b91c1c;color:white;border:0;border-radius:6px;font-size:12px;font-weight:bold;cursor:pointer;">Anular y compensar stock</button>
 </div>`;
 }).join('');
 return `<tr style="border-bottom:1px solid #e2e8f0;">
 <td style="padding:10px;vertical-align:top;"><b>${gidx + 1}</b></td>
 <td style="padding:10px;vertical-align:top;"><b>${_kardexEsc(primero.productoNombre)}</b><br><small style="color:#64748b;">${grupo.length} movimientos parecidos</small></td>
 <td style="padding:10px;">${detalles}</td>
 </tr>`;
 }).join('');

 return `
 <div id="controlKardexInventario" style="margin-top:24px;">
 <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-end;flex-wrap:wrap;margin-bottom:12px;">
 <div>
 <h3 style="margin:0;color:#0f172a;">Control Kardex vs Inventario</h3>
 <p style="margin:4px 0 0;color:#64748b;">Practica tipo ERP: no se borra el libro; se anula, compensa o regulariza con motivo y auditoria.</p>
 </div>
 <button onclick="renderKardexInventario('control')" style="padding:9px 13px;background:#334155;color:white;border:0;border-radius:7px;font-weight:bold;cursor:pointer;">Recalcular</button>
 </div>
 <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:12px;">
 <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;"><small style="font-weight:900;color:#64748b;">PRODUCTOS</small><br><b style="font-size:24px;color:#0f172a;">${control.length}</b></div>
 <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;"><small style="font-weight:900;color:#64748b;">DIF. KARDEX</small><br><b style="font-size:24px;color:#b91c1c;">${diferenciasKardex.length}</b></div>
 <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px;"><small style="font-weight:900;color:#64748b;">DIF. UBICACION</small><br><b style="font-size:24px;color:#b45309;">${diferenciasUbicacion.length}</b></div>
 <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;"><small style="font-weight:900;color:#64748b;">POSIBLES DUP.</small><br><b style="font-size:24px;color:#1d4ed8;">${duplicados.length}</b></div>
 <div style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:8px;padding:12px;"><small style="font-weight:900;color:#64748b;">ANULADOS</small><br><b style="font-size:24px;color:#334155;">${anulados.length}</b></div>
 </div>
 <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;overflow:auto;margin-bottom:14px;max-height:390px;">
 <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:1050px;">
 <thead style="position:sticky;top:0;background:#f8fafc;color:#475569;z-index:1;"><tr>
 <th style="padding:10px;text-align:left;">Producto</th><th style="padding:10px;text-align:right;">Stock sistema</th><th style="padding:10px;text-align:right;">Neto Kardex</th><th style="padding:10px;text-align:right;">Diferencia</th><th style="padding:10px;text-align:right;">Asignado</th><th style="padding:10px;text-align:right;">Dif. ubic.</th><th style="padding:10px;text-align:right;">Accion</th>
 </tr></thead>
 <tbody>${filasDiferencias || '<tr><td colspan="7" style="padding:24px;text-align:center;color:#64748b;">Sin diferencias entre stock general y Kardex activo.</td></tr>'}</tbody>
 </table>
 </div>
 <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;overflow:auto;max-height:430px;">
 <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:980px;">
 <thead style="position:sticky;top:0;background:#f8fafc;color:#475569;z-index:1;"><tr><th style="padding:10px;text-align:left;width:50px;">#</th><th style="padding:10px;text-align:left;width:260px;">Grupo</th><th style="padding:10px;text-align:left;">Movimientos sospechosos</th></tr></thead>
 <tbody>${filasDuplicados || '<tr><td colspan="3" style="padding:24px;text-align:center;color:#64748b;">No se detectaron duplicados exactos activos.</td></tr>'}</tbody>
 </table>
 </div>
 </div>`;
}

window.regularizarKardexAlStock = function(productoId) {
 if (!_invRequireAdmin('Regularizar Kardex contra stock')) return;
 const p = (window.productos || []).find(prod => String(prod.id) === String(productoId));
 if (!p) return alert('Producto no encontrado.');
 const control = _kardexControlProductos().find(x => String(x.producto.id) === String(productoId));
 if (!control || Math.abs(control.diferenciaKardex) <= 0.0001) return alert('Este producto ya cuadra contra Kardex.');
 const motivo = prompt(`Motivo de regularizacion para "${p.nombre}"\n\nStock sistema: ${control.stockSistema}\nNeto Kardex: ${control.netoKardex}\nDiferencia a registrar en Kardex: ${control.diferenciaKardex}`);
 if (!motivo) return;
 const sesion = _invSesionActiva() || {};
 const movs = StorageService.get("movimientosInventario", []);
 const diff = Number(control.diferenciaKardex || 0);
 const referencia = `REG-KARDEX-${Date.now()}`;
 movs.push({
 id: Date.now() + Math.random(),
 fecha: window.localISO ? window.localISO(new Date()) : new Date().toISOString(),
 tipo: diff > 0 ? 'Regularizacion Kardex - Entrada' : 'Regularizacion Kardex - Salida',
 productoId: p.id,
 productoNombre: p.nombre,
 cantidad: Math.abs(diff),
 ubicacion: 'Control Kardex',
 motivo,
 origen: 'controlKardex',
 referencia,
 usuario: sesion.nombre || sesion.usuario || 'Admin',
 rol: sesion.rol || '',
 noAfectaStock: true
 });
 StorageService.set("movimientosInventario", movs);
 window.movimientosInventario = movs;
 window.AuditService?.log?.({
 accion: 'KARDEX_REGULARIZACION',
 modulo: 'Inventario',
 entidad: p.nombre,
 entidadId: p.id,
 detalle: `Regularizacion Kardex por ${diff}. Motivo: ${motivo}`,
 datos: { productoId: p.id, diferencia: diff, referencia, noAfectaStock: true }
 });
 alert('Regularizacion creada. No se modifico el stock fisico; solo se ajusto el Kardex para cuadrar contra el inventario actual.');
 renderKardexInventario();
};

window.anularMovimientoKardex = function(index, compensarStock = false) {
 if (!_invRequireAdmin('Anular movimiento Kardex')) return;
 const movs = StorageService.get("movimientosInventario", []);
 const mov = movs[index];
 if (!mov) return alert('Movimiento no encontrado.');
 if (_kardexEstaAnulado(mov)) return alert('Este movimiento ya esta anulado.');
 const productosMap = new Map((window.productos || []).map(p => [String(p.id), p]));
 const normalizado = _normalizarMovimientoKardex(mov, productosMap);
 const motivo = prompt(`Motivo para anular movimiento de Kardex:\n\n${normalizado.productoNombre}\n${normalizado.tipoTexto} | Cantidad ${normalizado.cantidad}`);
 if (!motivo) return;
 if (!confirm(compensarStock ? 'Se anulara el Kardex y ademas se aplicara el movimiento inverso al stock del producto. Continuar?' : 'Se anulara solo para Kardex, sin tocar el stock actual. Continuar?')) return;

 const sesion = _invSesionActiva() || {};
 mov.anuladoKardex = true;
 mov.estadoKardex = 'Anulado';
 mov.fechaAnulacionKardex = window.localISO ? window.localISO(new Date()) : new Date().toISOString();
 mov.motivoAnulacionKardex = motivo;
 mov.usuarioAnulacionKardex = sesion.nombre || sesion.usuario || 'Admin';

 if (compensarStock && normalizado.cantidadFirmada !== 0) {
 const productos = StorageService.get("productos", []);
 const idxProd = productos.findIndex(p => String(p.id) === String(normalizado.productoId));
 if (idxProd === -1) return alert('Producto no encontrado para compensar stock.');
 const p = productos[idxProd];
 const delta = -Number(normalizado.cantidadFirmada || 0);
 const stockNuevo = (Number(p.stock || 0) + delta);
 if (stockNuevo < 0 && !confirm(`La compensacion dejara stock negativo (${stockNuevo}). Continuar?`)) return;
 p.stock = stockNuevo;
 const ubicacion = normalizado.ubicacion || normalizado.destino || normalizado.origen || '';
 if (ubicacion) {
 p.stockPorUbicacion = p.stockPorUbicacion || {};
 p.stockPorUbicacion[ubicacion] = Number(p.stockPorUbicacion[ubicacion] || 0) + delta;
 const variantes = p.variantes || [];
 const varIdx = variantes.findIndex(v => String(v.ubicacion || '').toLowerCase() === String(ubicacion).toLowerCase() && (!normalizado.color || String(v.color || '').toLowerCase() === String(normalizado.color).toLowerCase()));
 if (varIdx >= 0) variantes[varIdx].stock = Number(variantes[varIdx].stock || 0) + delta;
 p.variantes = variantes;
 }
 productos[idxProd] = p;
 StorageService.set("productos", productos);
 window.productos = productos;
 mov.compensacionStock = { aplicada: true, delta, stockNuevo };
 }

 movs[index] = mov;
 StorageService.set("movimientosInventario", movs);
 window.movimientosInventario = movs;
 window.AuditService?.log?.({
 accion: compensarStock ? 'KARDEX_ANULACION_COMPENSADA' : 'KARDEX_ANULACION',
 modulo: 'Inventario',
 entidad: normalizado.productoNombre,
 entidadId: normalizado.productoId,
 detalle: `Movimiento Kardex anulado. Motivo: ${motivo}`,
 datos: { index, movimientoId: mov.id, compensarStock, cantidadFirmada: normalizado.cantidadFirmada }
 });
 alert('Movimiento anulado correctamente.');
 renderKardexInventario();
};

function _depurarTextoInventario(valor) {
 return String(valor ?? '')
 .normalize('NFD')
 .replace(/[\u0300-\u036f]/g, '')
 .toLowerCase();
}

function _depurarResumenMovimientoInventario(m, index) {
 const productosMap = new Map((window.productos || []).map(p => [String(p.id), p]));
 const n = _normalizarMovimientoKardex(m, productosMap);
 return {
 index: m._indexOriginal ?? index,
 id: m.id || '',
 fecha: n.fecha || m.fecha || '',
 productoId: n.productoId || '',
 producto: n.productoNombre || '',
 tipo: n.tipoTexto || m.tipo || '',
 cantidad: n.cantidadFirmada || 0,
 ubicacion: n.ubicacion || m.ubicacion || '',
 origen: m.origen || '',
 referencia: m.referencia || '',
 motivo: m.motivo || m.concepto || m.observaciones || ''
 };
}

window.previsualizarDepuracionInventarioHeredado = function(opciones = {}) {
 const movs = StorageService.get("movimientosInventario", []);
 const patrones = (opciones.patrones || []).map(_depurarTextoInventario);
 const indices = Array.isArray(opciones.indices) ? new Set(opciones.indices.map(Number).filter(n => Number.isFinite(n))) : null;
 const ids = Array.isArray(opciones.ids) ? new Set(opciones.ids.map(String)) : null;
 const productoId = opciones.productoId == null ? null : String(opciones.productoId);

 const rows = movs
 .map((m, index) => ({ raw: m, resumen: _depurarResumenMovimientoInventario(m, index) }))
 .filter(({ raw, resumen }) => {
 if (indices && indices.has(resumen.index)) return true;
 if (ids && ids.has(String(resumen.id))) return true;
 if (productoId && String(resumen.productoId) !== productoId) return false;
 const texto = _depurarTextoInventario([
 raw.tipo, raw.concepto, raw.motivo, raw.origen, raw.referencia,
 raw.productoNombre, raw.descripcion, raw.observaciones
 ].join(' '));
 return patrones.some(p => p && texto.includes(p));
 })
 .map(x => x.resumen);

 if (!opciones.silencioso) {
 console.table(rows);
 console.info(`Previsualizacion: ${rows.length} movimiento(s) heredado(s) encontrados. Para eliminar: depurarInventarioHeredado({ patrones: [...], confirmar: 'DEPURAR_HEREDADO' }) o usa indices exactos.`);
 }
 return rows;
};

window.depurarInventarioHeredado = function(opciones = {}) {
 if (!_invRequireAdmin('Depurar movimientos heredados de inventario')) return { ok: false, error: 'sin_permiso' };
 if (opciones.confirmar !== 'DEPURAR_HEREDADO') {
 console.warn("Depuracion detenida. Ejecuta primero previsualizarDepuracionInventarioHeredado(...) y confirma con: confirmar: 'DEPURAR_HEREDADO'.");
 return { ok: false, error: 'confirmacion_requerida' };
 }

 const movs = StorageService.get("movimientosInventario", []);
 const preview = window.previsualizarDepuracionInventarioHeredado({ ...opciones, silencioso: true });
 const indices = new Set(preview.map(r => Number(r.index)));
 if (!indices.size) {
 console.info('No hubo movimientos heredados para depurar con esos filtros.');
 return { ok: true, cantidad: 0, depurados: [] };
 }

 const sesion = _invSesionActiva() || {};
 const fecha = window.localISO ? window.localISO(new Date()) : new Date().toISOString();
 const depurados = [];
 const restantes = movs.filter((m, index) => {
 if (!indices.has(index)) return true;
 depurados.push({
 ...m,
 _indexOriginal: index,
 _depuradoEn: fecha,
 _depuradoPor: sesion.nombre || sesion.usuario || 'Admin'
 });
 return false;
 });

 StorageService.set("movimientosInventario", restantes);
 window.movimientosInventario = restantes;

 const historial = StorageService.get("depuracionesInventarioHeredado", []);
 const registro = {
 id: `DEP-INV-${Date.now()}`,
 fecha,
 usuario: sesion.nombre || sesion.usuario || 'Admin',
 filtros: {
 patrones: opciones.patrones || null,
 indices: opciones.indices || null,
 ids: opciones.ids || null,
 productoId: opciones.productoId || null
 },
 cantidad: depurados.length,
 movimientos: depurados
 };
 historial.push(registro);
 StorageService.set("depuracionesInventarioHeredado", historial);

 window.AuditService?.log?.({
 accion: 'INVENTARIO_DEPURACION_HEREDADA',
 modulo: 'Inventario',
 entidad: 'movimientosInventario',
 detalle: `Depuracion heredada sin Kardex: ${depurados.length} movimiento(s) eliminado(s).`,
 datos: { registroId: registro.id, cantidad: depurados.length }
 });

 console.table(depurados.map(_depurarResumenMovimientoInventario));
 console.info(`Depuracion lista. Se eliminaron ${depurados.length} movimiento(s) y se guardo respaldo en depuracionesInventarioHeredado.`);
 if (typeof renderKardexInventario === 'function') renderKardexInventario();
 return { ok: true, cantidad: depurados.length, registroId: registro.id, depurados };
};

// ===== REPORTE UNIFICADO: CONSULTA DE INVENTARIO MAESTRA (PRO + VARIANTES) =====
window.renderConsultaInventario = function() {
 const cont = document.getElementById('tablaConsultaInventario');
 if (!cont) return;

 // 1. Obtencion de Filtros (Incluyendo el nuevo filtro de Ubicacion)
 const cat = document.getElementById('filtroCatInv')?.value || 'todos';
 const sub = document.getElementById('filtroSubInv')?.value || 'todos';
 const stockFiltro = document.getElementById('filtroStockInv')?.value || 'todos';
 const pedidoFiltro = document.getElementById('filtroPedidoInv')?.value || 'todos';
 const ubiFiltro = document.getElementById('filtroUbiInv')?.value || 'todos';

 // 2. Preparacion de Datos (Kardex y Ordenes de Compra)
 const productosConsulta = window.productos || [];
 const productosMapConsulta = new Map(productosConsulta.map(p => [String(p.id), p]));
 const kardex = (window.movimientosInventario || [])
 .map(m => _normalizarMovimientoKardex(m, productosMapConsulta))
 .filter(m => !m.anulado);
 const ocs = window.ordenesCompra || [];
 const estadoPedidoPorProd = {};
 
 ocs.forEach(oc => {
 if (!oc.articulos) return;
 oc.articulos.forEach(a => {
 if (!a.productoId) return;
 if (['Borrador', 'Pendiente', 'Pendiente de recibir'].includes(oc.estado)) {
 estadoPedidoPorProd[a.productoId] = 'pendiente';
 } else if (oc.estado === 'Pendiente de baja') {
 estadoPedidoPorProd[a.productoId] = 'baja';
 }
 });
 });

 // 3. Filtrado de Productos
 let productosFiltrados = productosConsulta.filter(p => {
 const coincideCat = (cat === 'todos' || cat === 'todas' || p.categoria === cat);
 const coincideSub = (sub === 'todos' || sub === 'todas' || p.subcategoria === sub);
 const coincideStock = stockFiltro === 'todos' ? true : (stockFiltro === 'con' ? (p.stock > 0) : (p.stock <= 0));
 const estado = estadoPedidoPorProd[p.id] || 'ninguno';
 const coincidePedido = pedidoFiltro === 'todos' ? true : (pedidoFiltro === estado);
 
 // Nuevo Filtro de Ubicacion
 let coincideUbi = true;
 if (ubiFiltro === 'sin_asignar') {
 const stockVar = (p.variantes || []).reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
 coincideUbi = (p.stock > 0 && stockVar < p.stock); // Mostrar si tiene stock general pero no esta asignado
 } else if (ubiFiltro !== 'todos') {
 coincideUbi = p.variantes && p.variantes.some(v => v.ubicacion === ubiFiltro && v.stock > 0);
 }
 
 return coincideCat && coincideSub && coincideStock && coincidePedido && coincideUbi;
 });

 // ORDENAR ANTES DE DIBUJAR LA TABLA PRO
 productosFiltrados = window.aplicarOrdenamientoInteligente(productosFiltrados, sub);

 // 4. Renderizado de Estructura de Tabla
 let html = `
 <div style="overflow-x:auto; box-shadow:0 4px 12px rgba(0,0,0,0.1); border-radius:12px;">
 <table class="tabla-admin" style="width:100%; border-collapse:collapse; background:white; font-size:14px;">
 <thead>
 <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0;">
 <th style="padding:15px;">Producto / Categoria</th>
 <th style="padding:15px; text-align:center;">Stock Total</th>
 <th style="padding:15px; width: 45%;">Desglose por Ubicacion y Color</th>
 <th style="padding:15px; text-align:right;">Valorizacion</th>
 <th style="padding:15px; text-align:center;">Estado</th>
 </tr>
 </thead>
 <tbody>`;

 let totalGlobalUnidades = 0;
 let totalGlobalPesos = 0;

 productosFiltrados.forEach(p => {
 // Logica de Costo Promedio
 const entradas = kardex.filter(m => String(m.productoId) === String(p.id) && m.tipoBase === 'entrada');
 let totalCosto = 0, totalCantidadEntrada = 0;
 entradas.forEach(mov => {
 const cantidadEntrada = Number(mov.cantidad || 0);
 totalCosto += Number(mov.costoUnitario || 0) * cantidadEntrada;
 totalCantidadEntrada += cantidadEntrada;
 });
 const costoBase = Number(p.costo || p.precioCompra || _invCostoHistoricoProducto(p.id) || 0);
 const costoPromedio = totalCantidadEntrada > 0 && totalCosto > 0 ? (totalCosto / totalCantidadEntrada) : costoBase;
 const valorTotal = (p.stock || 0) * costoPromedio;

 totalGlobalUnidades += (p.stock || 0);
 totalGlobalPesos += valorTotal;

 // --- LAGICA DINAMICA DE VARIANTES Y ASIGNACIAN ---
 let desgloseHtml = '';
 let totalStockVariantes = 0;

 if (p.variantes && p.variantes.length > 0) {
 p.variantes.forEach(v => totalStockVariantes += (Number(v.stock) || 0));

 desgloseHtml = p.variantes.filter(v => v.stock > 0).map(v => `
 <div style="display:inline-block; background:#f0f9ff; border:1px solid #bae6fd; color:#0369a1; padding:6px 10px; border-radius:8px; margin:3px; font-size:12px;">
 <span style="color:#0ea5e9;">${v.ubicacion}</span> | <b>${v.color}</b> 
 <span style="background:#0284c7;color:white;padding:2px 6px;border-radius:12px;margin-left:5px;font-weight:bold;">${v.stock} pzs</span>
 </div>
 `).join('');
 }

 // Detectar stock huerfano (stock general mayor a la suma de las variantes)
 const stockGeneral = Number(p.stock) || 0;
 const stockSinAsignar = stockGeneral - totalStockVariantes;

 // Panel de Asignacion Rapida
 if (stockSinAsignar > 0) {
 const ubicaciones = typeof StorageService !== 'undefined' ? StorageService.get("ubicacionesConfig", []) : [{nombre: 'General'}];
 const selectUbis = ubicaciones.map(u => `<option value="${u.nombre}">${u.nombre}</option>`).join('');

 desgloseHtml += `
 <div style="background:#fffbeb; border:1px dashed #f59e0b; padding:10px; border-radius:8px; margin-top:8px;">
 <span style="color:#d97706; font-size:12px; font-weight:bold; display:block; margin-bottom:8px;">Tienes ${stockSinAsignar} pieza(s) sin ubicacion fisica. Asignalas ahora:</span>
 <div style="display:flex; gap:6px; align-items:center;">
 <select id="qUbi_${p.id}" style="padding:6px; font-size:12px; border:1px solid #fcd34d; border-radius:6px; flex:1;">
 ${selectUbis}
 </select>
 <input id="qCol_${p.id}" type="text" placeholder="Color (Ej: Rojo)" value="General" style="padding:6px; font-size:12px; border:1px solid #fcd34d; border-radius:6px; width:100px;">
 <button onclick="asignarUbicacionRapida('${p.id}', ${stockSinAsignar})" style="background:#f59e0b; color:white; border:none; padding:6px 12px; border-radius:6px; font-size:12px; cursor:pointer; font-weight:bold; box-shadow:0 2px 4px rgba(245,158,11,0.3);">Guardar</button>
 </div>
 </div>
 `;
 } else if (!desgloseHtml && stockGeneral <= 0) {
 desgloseHtml = '<span style="color:#94a3b8; font-style:italic;">Sin stock en sistema</span>';
 }

 // Etiquetas de Estado (Pedido y Antiguedad)
 const estadoPedido = estadoPedidoPorProd[p.id] || 'ninguno';
 const labelPedido = estadoPedido === 'pendiente' ? '<span style="color:#f59e42;">Pedido Pendiente</span>' : 
 estadoPedido === 'baja' ? '<span style="color:#e11d48;">Pendiente Baja</span>' : '';
 const antiguedad = typeof calcularAntiguedadProducto === 'function' ? calcularAntiguedadProducto(p) : '-';

 html += `
 <tr style="border-bottom:1px solid #f1f5f9;">
 <td style="padding:12px;">
 <div style="font-weight:bold; color:#1e40af;">${p.nombre}</div>
 <div style="font-size:11px; color:#64748b;">${p.categoria || ''} > ${p.subcategoria || ''}</div>
 </td>
 <td style="padding:12px; text-align:center;">
 <span style="font-size:18px; font-weight:bold; color:${stockGeneral>0?'#16a34a':'#dc2626'}">${stockGeneral}</span>
 </td>
 <td style="padding:12px;">${desgloseHtml}</td>
 <td style="padding:12px; text-align:right;">
 <div style="font-weight:bold;">${typeof dinero === 'function' ? dinero(valorTotal) : valorTotal}</div>
 <div style="font-size:11px; color:#94a3b8;">Costo: ${typeof dinero === 'function' ? dinero(costoPromedio) : costoPromedio}</div>
 </td>
 <td style="padding:12px; text-align:center; line-height:1.2;">
 <div style="font-size:11px; font-weight:bold;">${labelPedido}</div>
 <div style="font-size:10px; color:#64748b; margin-top:4px;">Antiguedad: ${antiguedad}</div>
 </td>
 </tr>`;
 });

 // 5. Pie de Tabla con Totales
 html += `
 </tbody>
 <tfoot style="background:#f8fafc; font-weight:bold; border-top:2px solid #cbd5e1;">
 <tr>
 <td style="padding:15px; text-align:right;">TOTALES:</td>
 <td style="padding:15px; text-align:center; font-size:18px; color:#16a34a;">${totalGlobalUnidades}</td>
 <td></td>
 <td style="padding:15px; text-align:right; font-size:18px; color:#1e40af;">${typeof dinero === 'function' ? dinero(totalGlobalPesos) : totalGlobalPesos}</td>
 <td></td>
 </tr>
 </tfoot>
 </table>
 </div>`;

 cont.innerHTML = html;
}

// LAGICA DE ASIGNACIAN RAPIDA DE STOCK HUARFANO
window.asignarUbicacionRapida = function(id, cantidadAAsignar) {
 if (!_invRequireAdmin('Asignar ubicacion rapida de inventario')) return;
 const ubi = document.getElementById(`qUbi_${id}`).value;
 const col = document.getElementById(`qCol_${id}`).value.trim() || 'General';

 const p = window.productos.find(x => String(x.id) === String(id));
 if (!p) return alert("Producto no encontrado.");

 if (!confirm(`Confirmas enviar ${cantidadAAsignar} pieza(s) de "${p.nombre}" a [${ubi}] con el color [${col}]?`)) return;

 p.variantes = p.variantes || [];

 // Ver si ya hay una "caja" con esa misma ubicacion y color para sumarlo ahi
 const existente = p.variantes.find(v => v.ubicacion === ubi && v.color.toUpperCase() === col.toUpperCase());
 if (existente) {
 existente.stock = (Number(existente.stock) || 0) + cantidadAAsignar;
 } else {
 p.variantes.push({ ubicacion: ubi, color: col, stock: cantidadAAsignar });
 }

 if (typeof StorageService !== 'undefined') {
 const sesion = _invSesionActiva() || {};
 const movs = StorageService.get("movimientosInventario", []);
 movs.push({
 id: Date.now() + Math.random(),
 fecha: window.localISO ? window.localISO(new Date()) : new Date().toISOString(),
 tipo: 'Asignacion de ubicacion',
 productoId: p.id,
 productoNombre: p.nombre,
 cantidad: Number(cantidadAAsignar) || 0,
 origen: 'Stock sin ubicacion',
 destino: ubi,
 ubicacion: ubi,
 color: col,
 motivo: 'Asignacion rapida de stock huerfano',
 usuario: sesion.nombre || sesion.usuario || 'Admin',
 rol: sesion.rol || ''
 });
 StorageService.set("movimientosInventario", movs);
 window.movimientosInventario = movs;
 StorageService.set("productos", window.productos);
 window.AuditService?.log?.({
 accion: 'INVENTARIO_UBICACION_ASIGNADA',
 modulo: 'Inventario',
 entidad: p.nombre,
 entidadId: p.id,
 detalle: `${cantidadAAsignar} pieza(s) asignadas a ${ubi} / ${col}`,
 datos: { productoId: p.id, cantidad: cantidadAAsignar, ubicacion: ubi, color: col }
 });
 }

 if (typeof renderConsultaInventario === 'function') renderConsultaInventario();
};

window.initConsultaInventario = function() {
 const catSel = document.getElementById('filtroCatInv');
 const subSel = document.getElementById('filtroSubInv');
 const stockSel = document.getElementById('filtroStockInv');
 const pedidoSel = document.getElementById('filtroPedidoInv');
 
 // Inyectar el filtro de Ubicacion de forma dinamica si no existe en tu HTML
 let ubiSel = document.getElementById('filtroUbiInv');
 if (!ubiSel && stockSel && stockSel.parentNode) {
 ubiSel = document.createElement('select');
 ubiSel.id = 'filtroUbiInv';
 ubiSel.style = 'padding:8px; border-radius:6px; border:1px solid #d1d5db; margin-left:10px; font-size:14px;';
 stockSel.parentNode.insertBefore(ubiSel, stockSel.nextSibling);
 }

 if (!catSel || !subSel || !stockSel || !pedidoSel) return;

 // Llenar filtro de Ubicaciones
 if (ubiSel) {
 const ubicaciones = typeof StorageService !== 'undefined' ? StorageService.get("ubicacionesConfig", []) : [];
 let ubiOpts = '<option value="todos">Todas las ubicaciones</option><option value="sin_asignar">Sin asignar</option>';
 ubicaciones.forEach(u => ubiOpts += `<option value="${u.nombre}">${u.nombre}</option>`);
 ubiSel.innerHTML = ubiOpts;
 ubiSel.onchange = renderConsultaInventario;
 }

 let cats = [...new Set((window.productos||[]).map(p=>p.categoria).filter(Boolean))];
 // Ordenar categorias por posicion
 const categoriasOrdenadas = (window.categoriasData || [])
 .filter(c => cats.includes(c.nombre))
 .sort((a, b) => (a.posicion || 999) - (b.posicion || 999))
 .map(c => c.nombre);
 const catsOrdenadas = [...categoriasOrdenadas, ...cats.filter(c => !categoriasOrdenadas.includes(c)).sort()];
 
 catSel.innerHTML = '<option value="todos">Todas las categorias</option>' + catsOrdenadas.map(c=>`<option value="${c}">${c}</option>`).join('');
 
 catSel.onchange = function() {
 const cat = catSel.value;
 let subs = (window.productos||[]).filter(p=>cat==='todos'||p.categoria===cat).map(p=>p.subcategoria).filter(Boolean);
 subs = [...new Set(subs)];
 
 // Ordenar subcategorias por posicion
 const catData = (window.categoriasData || []).find(c => c.nombre === cat);
 const subsOrdenadas = catData && catData.subcategorias 
 ? catData.subcategorias
 .filter(s => subs.includes(s.nombre))
 .sort((a, b) => (a.posicion || 999) - (b.posicion || 999))
 .map(s => s.nombre)
 : [];
 const subsFinales = [...subsOrdenadas, ...subs.filter(s => !subsOrdenadas.includes(s)).sort()];
 
 subSel.innerHTML = '<option value="todos">Todas las subcategorias</option>' + subsFinales.map(s=>`<option value="${s}">${s}</option>`).join('');
 subSel.value = 'todos';
 renderConsultaInventario();
 };
 
 subSel.onchange = renderConsultaInventario;
 stockSel.onchange = renderConsultaInventario;
 pedidoSel.onchange = renderConsultaInventario;
 catSel.onchange();
 renderConsultaInventario();
}
// Solo cuenta cuantos productos tienen IDs duplicados (sin corregir)
window.contarIdsDuplicados = function() {
 const ids = {};
 const duplicados = {};
 window.productos.forEach(p => {
 if (!p.id) return;
 const idStr = String(p.id);
 if (ids[idStr]) {
 duplicados[idStr] = (duplicados[idStr] || 1) + 1;
 } else {
 ids[idStr] = true;
 }
 });
 const totalDuplicados = Object.values(duplicados).reduce((a, b) => a + b, 0);
 if (totalDuplicados > 0) {
 let detalle = Object.entries(duplicados).map(([id, count]) => `ID: ${id} (repetido ${count} veces)`).join('\n');
 alert(`Se encontraron ${Object.keys(duplicados).length} IDs duplicados, total de productos duplicados: ${totalDuplicados}.\n\nDetalle:\n` + detalle);
 } else {
 alert('No se encontraron IDs duplicados.');
 }
}
// Detecta y corrige IDs de productos duplicados
window.detectarYCorregirIdsDuplicados = function() {
 const idsExistentes = new Set();
 let correcciones = 0;

 window.productos.forEach(p => {
 // Si el ID ya existe o no tiene, generamos uno numerico nuevo
 if (!p.id || idsExistentes.has(Number(p.id))) {
 const antiguoId = p.id;
 // Generamos un ID numerico basado en el tiempo + aleatorio
 p.id = Math.round(Date.now() + Math.random() * 1000000);
 correcciones++;
 console.log(`Corregido: Antiguo ID ${antiguoId} -> Nuevo ID ${p.id}`);
 }
 idsExistentes.add(Number(p.id));
 });

 if (correcciones > 0) {
 // Guardar cambios en el almacenamiento local
 if (StorageService.set("productos", window.productos)) {
 alert(`Se repararon ${correcciones} productos con IDs duplicados.\nAhora puedes ver sus detalles normalmente.`);
 // Recargar la tabla para aplicar cambios
 if (typeof renderizarTablaInventario === 'function') renderizarTablaInventario();
 } else {
 alert("Error al guardar los cambios en Storage.");
 }
 } else {
 alert('No se encontraron duplicados para corregir.');
 }
}
// FILTROS DE INVENTARIO
function aplicarFiltros() {
 const catFiltro = document.getElementById("filtroCategoria").value;
 const subFiltro = document.getElementById("filtroSubcategoria").value;
 const busqueda = document.getElementById("busquedaProducto").value.toLowerCase();

 let filtrados = window.productos.filter(p => {
 const coincideCat = (catFiltro === "todos" || p.categoria === catFiltro);
 const coincideSub = (subFiltro === "todos" || p.subcategoria === subFiltro);
 const coincideNombre = p.nombre.toLowerCase().includes(busqueda);
 return coincideCat && coincideSub && coincideNombre;
 });

 // PASAR POR EL MOTOR ANTES DE RENDERIZAR
 filtrados = window.aplicarOrdenamientoInteligente(filtrados, subFiltro);

 renderInventario(filtrados);
}

function actualizarSubcategoriasFiltro(catId, subId) {
 const catNombre = document.getElementById(catId).value;
 const comboSub = document.getElementById(subId);
 comboSub.innerHTML = '<option value="todos">-- Todas --</option>';

 if (catNombre !== "todos") {
 const categoriaDoc = categoriasData.find(c => c.nombre === catNombre);
 if (categoriaDoc && categoriaDoc.subcategorias) {
 categoriaDoc.subcategorias.forEach(sub => {
 const nombreSub = typeof sub === 'string' ? sub : sub.nombre;
 comboSub.innerHTML += `<option value="${nombreSub}">${nombreSub}</option>`;
 });
 }
 }
 aplicarFiltros();
}

function limpiarFiltros() {
 document.getElementById("filtroCategoria").value = "todos";
 document.getElementById("filtroSubcategoria").innerHTML = '<option value="todos">-- Todas --</option>';
 document.getElementById("busquedaProducto").value = "";
 renderInventario(window.productos);
}

function actualizarCombosFiltros() {
 const filtroCat = document.getElementById("filtroCategoria");
 const filtroSub = document.getElementById("filtroSubcategoria");
 if (!filtroCat) return;

 const catPrevia = filtroCat.value;
 const subPrevia = filtroSub ? filtroSub.value : "todos";

 let htmlCat = '<option value="todos">-- Todas las Categorias --</option>';
 // Ordenar categorias por posicion
 const categoriasOrdenadas = [...categoriasData].sort((a, b) => (a.posicion || 999) - (b.posicion || 999));
 categoriasOrdenadas.forEach(cat => {
 htmlCat += `<option value="${cat.nombre}">${cat.nombre}</option>`;
 });
 filtroCat.innerHTML = htmlCat;
 filtroCat.value = catPrevia || "todos";

 if (filtroSub) {
 let htmlSub = '<option value="todos">-- Todas las Subcategorias --</option>';
 if (filtroCat.value !== "todos") {
 const catInfo = categoriasData.find(c => c.nombre === filtroCat.value);
 if (catInfo && catInfo.subcategorias) {
 // Ordenar subcategorias por posicion
 const subcatOrdenadas = [...catInfo.subcategorias].sort((a, b) => (a.posicion || 999) - (b.posicion || 999));
 subcatOrdenadas.forEach(sub => {
 htmlSub += `<option value="${sub.nombre}">${sub.nombre}</option>`;
 });
 }
 }
 filtroSub.innerHTML = htmlSub;
 filtroSub.value = subPrevia || "todos";
 }
}

// ===== INVENTARIO =====
function renderInventario(listaAMostrar = window.productos) {
 const cont = document.getElementById("listaInventario");
 if (!cont) return;

 actualizarCombosFiltros();

 let html = `
 <table class="tabla-admin">
 <thead>
 <tr>
 <th>Producto</th>
 <th style="text-align:center;">Stock</th>
 <th style="text-align:right;">Precio</th>
 <th style="text-align:center;">Acciones</th>
 </tr>
 </thead>
 <tbody>`;

 if (listaAMostrar.length === 0) {
 html += `<tr><td colspan="4" style="text-align:center; color:gray; padding:20px;">No se encontraron productos.</td></tr>`;
 } else {
 listaAMostrar.forEach(p => {
 const stock = p.stock || 0;
 const colorStock = stock > 0 ? "#27ae60" : "#e74c3c";
 html += `
 <tr>
 <td>
 <b>${p.nombre}</b><br>
 <small style="color:#666;">${p.categoria || ''} > ${p.subcategoria || ''}</small>
 </td>
 <td style="text-align:center; font-weight:bold; color:${colorStock};">${stock}</td>
 <td style="text-align:right;">${dinero(p.precio)}</td>
 <td style="text-align:center;">
 <div style="display:flex; gap:5px; justify-content:center; flex-wrap:wrap;">
 <button onclick="abrirProductoForm('${String(p.id)}')" 
 style="padding:6px 10px; cursor:pointer; background:#3498db; color:white; border:none; border-radius:4px; font-weight:bold;">
 &#9998; Editar
 </button>
 <button onclick="abrirVisorMaestro('${String(p.id)}')" 
 style="padding:6px 10px; cursor:pointer; background:#2c3e50; color:white; border:none; border-radius:4px; font-weight:bold;">
 &#128269; Visor
 </button>
 <button onclick="confirmarEliminarProducto('${String(p.id)}')" 
 style="padding:6px 10px; cursor:pointer; background:#e74c3c; color:white; border:none; border-radius:4px; font-weight:bold;">
 &#128465; Eliminar
 </button>
 </div>
 </td>
 </tr>`;
 });
 }

 html += `</tbody></table>`;
 cont.innerHTML = html;
}

function confirmarEliminarProducto(id) {
 if (!_invRequireAdmin('Eliminar producto')) return;
 const producto = window.productos.find(p => String(p.id) === String(id));
 if (!producto) {
 alert("Producto no encontrado.");
 return;
 }

 const mensaje = `Eliminar producto: "${producto.nombre}"?\n\nEsta accion no se puede deshacer.`;
 
 if (confirm(mensaje)) {
 eliminarProducto(id);
 }
}

function actualizarStock(id, cant, concepto) {
 const idx = window.productos.findIndex(p => String(p.id) === String(id));
 if (idx !== -1) {
 window.productos[idx].stock = (window.productos[idx].stock || 0) + cant;
 registrarMovimiento(id, concepto, cant, "entrada");
 if (!StorageService.set("productos", window.productos)) {
 console.error("Error guardando productos");
 }
 }
}

function registrarMovimiento(productoId, concepto, cantidad, tipo) {
 const kardexActual = StorageService.get("movimientosInventario", []);
 const producto = (window.productos || []).find(p => String(p.id) === String(productoId)) || {};
 const costoUnitario = Number(producto.costo || producto.precioCompra || 0);
 const movimiento = {
 id: Date.now() + Math.random(),
 productoId: productoId,
 productoNombre: producto.nombre || '',
 fecha: window.localISO(new Date()),
 concepto: concepto,
 cantidad: Math.abs(cantidad),
 tipo: tipo,
 costoUnitario,
 costo: costoUnitario,
 precioCompra: costoUnitario,
 valor: Math.abs(Number(cantidad || 0)) * costoUnitario
 };
 kardexActual.push(movimiento);
 movimientosInventario = kardexActual;
 window.movimientosInventario = kardexActual;
 if (!StorageService.set("movimientosInventario", kardexActual)) {
 console.error("Error guardando movimientos");
 }
}

function eliminarProducto(id) {
 if (!_invRequireAdmin('Eliminar producto')) return;
 window.productos = window.productos.filter(p => String(p.id) !== String(id));
 if (!StorageService.set("productos", window.productos)) {
 console.error("Error eliminando producto");
 return;
 }
 renderInventario();
}

// ===== FORMULARIO DE PRODUCTOS =====
function actualizarSelectorCategorias() {
 const select = document.getElementById("pSubcategoria");
 if (!select) return;
 let options = "";
 categoriasData.forEach(cat => {
 cat.subcategorias.forEach(sub => {
 options += `<option value="${sub.nombre}">${cat.nombre} - ${sub.nombre} (${sub.margen}%)</option>`;
 });
 });
 select.innerHTML = options || "<option>Crea una categoria primero</option>";
}

function abrirProductoForm(id = null) {
 actualizarSelectorCategorias();
 const modal = document.getElementById("modalProductoForm");
 if (!modal) return;

 const inputNombre = document.getElementById("pNombre");
 const inputCosto = document.getElementById("pCosto");
 const inputPrecio = document.getElementById("pPrecio");
 const inputColor = document.getElementById("pColor");
 const inputMarca = document.getElementById("pMarca");
 const inputModelo = document.getElementById("pModelo");
 const inputImagen = document.getElementById("pImagen");
 const inputSub = document.getElementById("pSubcategoria");
 const inputCaracteristicas = document.getElementById("pCaracteristicas");
 const inputDestacadoCatalogo = document.getElementById("pDestacadoCatalogo");
 const inputOrdenDestacadoCatalogo = document.getElementById("pOrdenDestacadoCatalogo");

 let p = null; // <--- CORRECCIAN: Declaramos 'p' aqui para que exista en toda la funcion

 if (id) {
 productoEditando = id;
 p = window.productos.find(prod => String(prod.id) === String(id));
 if (!p) return;
 document.getElementById("tituloModalProducto").innerText = "Editar Producto";
 inputNombre.value = p.nombre;
 inputCosto.value = p.costo || 0;
 if (inputPrecio) inputPrecio.value = p.precio != null ? p.precio : "";
 inputColor.value = p.color || '';
 inputMarca.value = p.marca || '';
 inputModelo.value = p.modelo || '';
 inputImagen.value = p.imagen || '';
 inputSub.value = p.subcategoria || '';
 if (inputCaracteristicas) inputCaracteristicas.value = p.caracteristicas || '';
 if (inputDestacadoCatalogo) inputDestacadoCatalogo.checked = !!p.destacadoCatalogo;
 if (inputOrdenDestacadoCatalogo) inputOrdenDestacadoCatalogo.value = p.ordenDestacadoCatalogo || '';
 } else {
 productoEditando = null;
 document.getElementById("tituloModalProducto").innerText = "Nuevo Producto";
 inputNombre.value = "";
 inputCosto.value = "";
 if (inputPrecio) inputPrecio.value = "";
 inputColor.value = "";
 inputMarca.value = "";
 inputModelo.value = "";
 inputImagen.value = "";
 if (inputCaracteristicas) inputCaracteristicas.value = "";
 if (inputDestacadoCatalogo) inputDestacadoCatalogo.checked = false;
 if (inputOrdenDestacadoCatalogo) inputOrdenDestacadoCatalogo.value = "";
 }
 
 // --- LAGICA FINANCIERA DEL PRODUCTO ---
 window._plazosProductoTemp = [];
 if (id && p && p.configCredito && p.configCredito.usaReglaGlobal === false) {
 document.getElementById("pUsaReglaGlobal").checked = false;
 document.getElementById("pPermitirCredito").checked = p.configCredito.permitirCredito;
 window._plazosProductoTemp = p.configCredito.plazos || [];
 } else {
 document.getElementById("pUsaReglaGlobal").checked = true;
 document.getElementById("pPermitirCredito").checked = true;
 }
 if (typeof toggleConfigCreditoProd === "function") {
 toggleConfigCreditoProd();
 _dibujarPlazosProd();
 }
 
 modal.classList.remove("oculto");
 modal.style.display = 'flex';
}

// ===== NUEVA LAGICA DE VARIANTES (COLOR Y UBICACIAN) =====

function guardarProductoDB() {
 const nombre = document.getElementById("pNombre").value.trim();
 const costo = parseFloat(document.getElementById("pCosto").value);
 const precioManual = parseFloat(document.getElementById("pPrecio").value);
 const marca = document.getElementById("pMarca").value.trim();
 const modelo = document.getElementById("pModelo").value.trim();
 const imagen = document.getElementById("pImagen").value.trim();
 const subcatNombre = document.getElementById("pSubcategoria").value;
 const caracteristicas = document.getElementById("pCaracteristicas")?.value.trim() || "";
 const destacadoCatalogo = document.getElementById("pDestacadoCatalogo")?.checked || false;
 const ordenDestacadoCatalogoRaw = parseInt(document.getElementById("pOrdenDestacadoCatalogo")?.value, 10);
 const ordenDestacadoCatalogo = Number.isFinite(ordenDestacadoCatalogoRaw) && ordenDestacadoCatalogoRaw > 0
 ? ordenDestacadoCatalogoRaw
 : 999;

 const validacion = ValidatorService.validarProducto({ nombre, costo, precio: precioManual });
 if (!validacion.valid) return alert("" + validacion.errores.join("\n"));

 let categoriaPadre = '';
 categoriasData.forEach(cat => {
 if (cat.subcategorias.find(s => s.nombre === subcatNombre)) categoriaPadre = cat.nombre;
 });

 // Capturar reglas de financiamiento
 const usaGlobal = document.getElementById("pUsaReglaGlobal")?.checked ?? true;
 const permitirCredito = document.getElementById("pPermitirCredito")?.checked ?? true;
 
 const configCredito = usaGlobal ? null : {
 usaReglaGlobal: false,
 permitirCredito: permitirCredito,
 plazos: window._plazosProductoTemp || []
 };

 // Estructura de producto actualizada
 const datosProducto = {
 nombre, costo, precio: precioManual,
 marca, modelo, imagen,
 categoria: categoriaPadre,
 subcategoria: subcatNombre,
 caracteristicas,
 destacadoCatalogo,
 ordenDestacadoCatalogo,
 configCredito, // <----- ESTA ES LA LINEA MAGICA
 variantes: productoEditando ? (window.productos.find(p => String(p.id) === String(productoEditando))?.variantes || []) : []
 };

 if (productoEditando) {
 const index = window.productos.findIndex(p => String(p.id) === String(productoEditando));
 if (index !== -1) {
 // Calculamos el stock total sumando todas las variantes para mantener compatibilidad
 const totalStock = datosProducto.variantes.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
 window.productos[index] = { ...window.productos[index], ...datosProducto, stock: totalStock };
 }
 } else {
 window.productos.push({ id: Date.now(), ...datosProducto, stock: 0 });
 }

 if (!StorageService.set("productos", window.productos)) return alert("Error guardando producto");

 cerrarProductoForm();
 renderInventario();
}

// ===== VISOR MAESTRO CON GESTIAN DE UBICACIONES Y COLORES =====
function mostrarDetalleProductoMaestro(id) {
 let p = (window.productos || []).find(prod => String(prod.id) === String(id));
 if (!p && typeof StorageService !== 'undefined') {
 const productosStorage = StorageService.get('productos', []);
 p = productosStorage.find(prod => String(prod.id) === String(id));
 if (p) window.productos = productosStorage;
 }
 if (!p) {
 const contNoProducto = document.getElementById("detalle-producto-maestro");
 if (contNoProducto) contNoProducto.innerHTML = `<p style="color:#b91c1c;text-align:center;padding:40px;">No se encontro el producto seleccionado. Regresa y actualiza la vista.</p>`;
 return;
 }

 const cont = document.getElementById("detalle-producto-maestro");
 if (!cont) return;

 p.variantes = p.variantes || [];
 const stockAsignado = p.variantes.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
 const stockSistema = Number(p.stock || 0);
 const stockSinAsignar = stockSistema - stockAsignado;
 const margen = Number(p.precio || 0) > 0 ? (((Number(p.precio || 0) - Number(p.costo || 0)) / Number(p.precio || 0)) * 100) : 0;
 const imagen = p.imagen || '';
 const estadoStock = stockSistema > 0 ? 'Con inventario' : 'Sin inventario';
 const configCreditoTxt = p.configCredito?.usaReglaGlobal === false ? 'Regla especial de credito' : 'Regla global de credito';

 cont.innerHTML = `
 <div style="max-width:1400px;margin:0 auto;padding:10px;">
 <div style="background:white;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 4px 15px rgba(15,23,42,0.06);overflow:hidden;">
 <div style="display:grid;grid-template-columns:280px 1fr 330px;gap:0;">
 <div style="padding:22px;border-right:1px solid #e2e8f0;background:#f8fafc;">
 <div style="height:210px;background:white;border:1px solid #e2e8f0;border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;margin-bottom:14px;">
 ${imagen ? `<img id="imgVisorPrevia" src="${_kardexEsc(imagen)}" style="width:100%;height:100%;object-fit:contain;">` : '<span style="color:#94a3b8;font-weight:bold;">Sin imagen</span>'}
 </div>
 <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
 <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center;">
 <small style="font-size:10px;color:#64748b;font-weight:900;">STOCK SISTEMA</small>
 <div style="font-size:30px;font-weight:900;color:${stockSistema > 0 ? '#047857' : '#b91c1c'};">${stockSistema}</div>
 </div>
 <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center;">
 <small style="font-size:10px;color:#64748b;font-weight:900;">ASIGNADO</small>
 <div style="font-size:30px;font-weight:900;color:${stockAsignado > 0 ? '#1d4ed8' : '#64748b'};">${stockAsignado}</div>
 </div>
 </div>
 ${stockSinAsignar !== 0 ? `<div style="margin-top:10px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px;color:#92400e;font-size:12px;font-weight:bold;">Diferencia por asignar: ${stockSinAsignar} pieza(s)</div>` : ''}
 </div>
 <div style="padding:22px;">
 <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:16px;">
 <div>
 <h2 style="margin:0;color:#0f172a;">${_kardexEsc(p.nombre || 'Producto sin nombre')}</h2>
 <div style="margin-top:5px;color:#64748b;font-size:13px;">${_kardexEsc([p.categoria, p.subcategoria].filter(Boolean).join(' / ') || 'Sin categoria')}</div>
 </div>
 <span style="background:${stockSistema > 0 ? '#ecfdf5' : '#fef2f2'};color:${stockSistema > 0 ? '#047857' : '#b91c1c'};border:1px solid ${stockSistema > 0 ? '#bbf7d0' : '#fecaca'};border-radius:999px;padding:6px 10px;font-size:12px;font-weight:900;white-space:nowrap;">${estadoStock}</span>
 </div>
 <div style="display:grid;grid-template-columns:repeat(2,minmax(160px,1fr));gap:10px;margin-bottom:14px;">
 <div style="border:1px solid #e2e8f0;border-radius:8px;padding:11px;"><small style="font-weight:900;color:#64748b;">MARCA</small><br><b>${_kardexEsc(p.marca || '-')}</b></div>
 <div style="border:1px solid #e2e8f0;border-radius:8px;padding:11px;"><small style="font-weight:900;color:#64748b;">MODELO</small><br><b>${_kardexEsc(p.modelo || '-')}</b></div>
 <div style="border:1px solid #e2e8f0;border-radius:8px;padding:11px;"><small style="font-weight:900;color:#64748b;">COLOR BASE</small><br><b>${_kardexEsc(p.color || '-')}</b></div>
 <div style="border:1px solid #e2e8f0;border-radius:8px;padding:11px;"><small style="font-weight:900;color:#64748b;">CREDITO</small><br><b>${_kardexEsc(configCreditoTxt)}</b></div>
 </div>
 <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px;">
 <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;"><small style="font-weight:900;color:#64748b;">COSTO</small><br><b style="font-size:18px;color:#334155;">${_invDinero(p.costo || 0)}</b></div>
 <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;"><small style="font-weight:900;color:#64748b;">PRECIO</small><br><b style="font-size:18px;color:#047857;">${_invDinero(p.precio || 0)}</b></div>
 <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;"><small style="font-weight:900;color:#64748b;">MARGEN</small><br><b style="font-size:18px;color:#1d4ed8;">${Number.isFinite(margen) ? margen.toFixed(1) : '0.0'}%</b></div>
 </div>
 <div style="border:1px solid #e2e8f0;border-radius:8px;padding:13px;background:white;">
 <small style="font-weight:900;color:#64748b;">CARACTERISTICAS</small>
 <div style="margin-top:6px;color:#334155;line-height:1.45;white-space:pre-wrap;">${_kardexEsc(p.caracteristicas || 'Sin caracteristicas capturadas.')}</div>
 </div>
 </div>
 <div style="padding:22px;background:#f8fafc;border-left:1px solid #e2e8f0;">
 <h3 style="margin:0 0 12px;color:#0f172a;font-size:16px;">Control de existencias</h3>
 <div id="listaVariantes" style="max-height:240px;overflow:auto;background:white;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:12px;">
 ${renderTablaVariantes(p.variantes, p.id)}
 </div>
 <div style="display:grid;gap:8px;">
 <button onclick="abrirAjusteProductoDesdeVisor('${p.id}')" style="padding:11px;background:#b45309;color:white;border:0;border-radius:7px;font-weight:bold;cursor:pointer;">Ajustar existencia</button>
 <button onclick="abrirTransferenciaProductoDesdeVisor('${p.id}')" style="padding:11px;background:#1d4ed8;color:white;border:0;border-radius:7px;font-weight:bold;cursor:pointer;">Transferir ubicacion</button>
 ${stockSinAsignar > 0 ? `<button onclick="navA('consulta-inventario'); setTimeout(()=>{window.renderConsultaInventario && window.renderConsultaInventario();}, 80)" style="padding:10px;background:#f59e0b;color:white;border:0;border-radius:7px;font-weight:bold;cursor:pointer;">Asignar stock sin ubicacion</button>` : ''}
 </div>
 <div style="margin-top:12px;color:#64748b;font-size:12px;line-height:1.4;">Recomendacion: no editar existencias a mano desde la ficha. Usa ajuste o transferencia para conservar auditoria y Kardex.</div>
 </div>
 </div>
 </div>
 ${_invRenderHistorialProducto(p)}
 </div>`;
 return;

 // Asegurar que existan las variantes
 p.variantes = p.variantes || [];
 const totalStock = p.variantes.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);

 // HTML mejorado para el Visor Maestro
 let html = `
 <div style="max-width: 1400px; margin: 0 auto; padding: 10px;">
 <div style="display: grid; grid-template-columns: 300px 1fr 350px; gap: 20px; background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); margin-bottom: 20px;">
 
 <div style="text-align: center; border-right: 1px solid #eee; padding-right: 20px;">
 <img id="imgVisorPrevia" src="${p.imagen || ''}" style="width: 100%; height: 200px; object-fit: contain; margin-bottom: 15px;">
 <div style="padding: 15px; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;">
 <span style="font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase;">Inventario Total</span>
 <h2 style="margin: 5px 0; color: ${totalStock > 0 ? '#10b981' : '#ef4444'}; font-size: 32px;">${totalStock} <small style="font-size: 14px;">pzs</small></h2>
 </div>
 </div>

 <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
 <div class="campo"><label>Nombre</label><input type="text" id="editNombre" value="${p.nombre}"></div>
 <div class="campo"><label>Marca</label><input type="text" id="editMarca" value="${p.marca || ''}"></div>
 <div class="campo"><label>Costo</label><input type="number" id="editCosto" value="${p.costo || 0}"></div>
 <div class="campo"><label>Precio</label><input type="number" id="editPrecio" value="${p.precio || 0}"></div>
 <div class="campo" style="grid-column: span 2;">
 <label>Caracteristicas</label>
 <textarea id="editCaracteristicas" rows="3" style="width:100%; border-radius:6px; border:1px solid #d1d5db;">${p.caracteristicas || ''}</textarea>
 </div>
 </div>

 <!-- GESTIAN DE STOCK POR UBICACIAN Y COLOR -->
 <div style="background: #f1f5f9; padding: 20px; border-radius: 12px; border: 1px solid #cbd5e1;">
 <h4 style="margin: 0 0 15px 0; color: #1e293b; font-size: 14px; display: flex; align-items: center; gap: 8px;">Control de Existencias</h4>
 
 <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 15px;">
 <select id="newVarUbicacion" style="padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1;">
 <option value="Tienda">Tienda Principal</option>
 <option value="Bodega">Bodega / Almacen</option>
 </select>
 <input type="text" id="newVarColor" placeholder="Color (Ej: Chocolate, Rojo...)" style="padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1;">
 <div style="display: flex; gap: 5px;">
 <input type="number" id="newVarCant" placeholder="Cant." style="width: 70px; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1;">
 <button onclick="agregarVarianteStock('${p.id}')" style="flex: 1; background: #2563eb; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">+ Anadir</button>
 </div>
 </div>

 <div id="listaVariantes" style="max-height: 180px; overflow-y: auto; background: white; border-radius: 8px; border: 1px solid #cbd5e1;">
 ${renderTablaVariantes(p.variantes, p.id)}
 </div>
 
 <button onclick="guardarCambiosVisor(${p.id})" style="width: 100%; margin-top: 15px; padding: 12px; background: #10b981; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">GUARDAR CAMBIOS</button>
 </div>
 </div>
 
 <!-- Kardex Historico (Igual que antes) -->
 <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
 <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
 <h3 style="color: #10b981; border-bottom: 2px solid #10b981; padding-bottom: 10px;">Entradas</h3>
 <table><tbody>${renderFilasKardex(id, 'entrada')}</tbody></table>
 </div>
 <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
 <h3 style="color: #f59e0b; border-bottom: 2px solid #f59e0b; padding-bottom: 10px;">Salidas</h3>
 <table><tbody>${renderFilasKardex(id, 'salida')}</tbody></table>
 </div>
 </div>
 </div>
 `;

 cont.innerHTML = html;
}
function cerrarProductoForm() {
 const modal = document.getElementById("modalProductoForm");
 if (modal) {
 modal.classList.add("oculto");
 modal.style.display = 'none';
 }
 productoEditando = null;
}

// ===== CALCULO AUTOMATICO EN FORMULARIO DE PRODUCTOS =====
document.addEventListener('input', (e) => {
 const modal = document.getElementById("modalProductoForm");
 if (!modal || modal.style.display === 'none') {
 return;
 }

 const idElemento = e.target.id;
 
 if (!['pCosto', 'pPrecio', 'pMargenManual', 'pSubcategoria'].includes(idElemento)) {
 return;
 }

 const costo = parseFloat(document.getElementById("pCosto")?.value) || 0;
 const precioActual = parseFloat(document.getElementById("pPrecio")?.value) || 0;
 const margenActual = parseFloat(document.getElementById("pMargenManual")?.value) || 0;
 const subcatNombre = document.getElementById("pSubcategoria")?.value || '';

 let margenCategoria = 30;
 categoriasData.forEach(cat => {
 const sub = cat.subcategorias.find(s => s.nombre === subcatNombre);
 if (sub) margenCategoria = sub.margen;
 });

 if (idElemento === "pCosto") {
 if (costo === 0) return;
 
 const margenAUsar = margenActual > 0 ? margenActual : margenCategoria;
 const precioCalculado = CalculatorService.calcularPrecioDesdeMargen(costo, margenAUsar);
 
 document.getElementById("pPrecio").value = precioCalculado;
 document.getElementById("pMargenManual").value = margenAUsar;
 
 actualizarDisplayProducto(costo, precioCalculado, margenAUsar);
 return;
 }

 if (idElemento === "pPrecio") {
 if (costo === 0 || precioActual === 0) return;
 
 const margenCalculado = CalculatorService.calcularMargen(precioActual, costo);
 
 document.getElementById("pMargenManual").value = margenCalculado.toFixed(1);
 
 actualizarDisplayProducto(costo, precioActual, margenCalculado);
 return;
 }

 if (idElemento === "pMargenManual") {
 if (costo === 0 || margenActual === 0) return;
 
 const precioRecalculado = CalculatorService.calcularPrecioDesdeMargen(costo, margenActual);
 
 document.getElementById("pPrecio").value = precioRecalculado;
 
 actualizarDisplayProducto(costo, precioRecalculado, margenActual);
 return;
 }

 if (idElemento === "pSubcategoria") {
 if (costo === 0) return;
 
 if (margenActual === 0 || margenActual === "") {
 let nuevoMargen = 30;
 categoriasData.forEach(cat => {
 const sub = cat.subcategorias.find(s => s.nombre === subcatNombre);
 if (sub) nuevoMargen = sub.margen;
 });
 
 const precioNuevo = CalculatorService.calcularPrecioDesdeMargen(costo, nuevoMargen);
 
 document.getElementById("pPrecio").value = precioNuevo;
 document.getElementById("pMargenManual").value = nuevoMargen;
 
 actualizarDisplayProducto(costo, precioNuevo, nuevoMargen);
 }
 return;
 }
});

function actualizarDisplayProducto(costo, precio, margen) {
 const ganancia = precio - costo;
 const margenPct = precio > 0 ? parseFloat(margen).toFixed(1) : 0;
 
 const lblMargen = document.getElementById("lblMargenAplicado");
 const lblPrecio = document.getElementById("lblPrecioSugerido");
 const lblGanancia = document.getElementById("lblGananciaPesos");
 
 if (lblMargen) {
 lblMargen.innerText = margenPct;
 if (margenPct < 20) {
 lblMargen.style.color = "#e74c3c";
 } else if (margenPct <= 35) {
 lblMargen.style.color = "#f39c12";
 } else {
 lblMargen.style.color = "#27ae60";
 }
 }
 
 if (lblPrecio) {
 lblPrecio.innerText = dinero(precio);
 }
 
 if (lblGanancia) {
 lblGanancia.innerText = dinero(ganancia > 0 ? ganancia : 0);
 lblGanancia.style.color = ganancia > 0 ? "#27ae60" : "#e74c3c";
 }
}

// ===== CATEGORIAS =====
function renderCategorias() {
 const contenedor = document.getElementById("listaCategoriasCards");
 if (!contenedor) return;
 contenedor.innerHTML = "";

 if (typeof categoriasData === 'undefined' || !categoriasData) return;
 
 let necesitaGuardar = false;

 // Migracion automatica: Agregamos las propiedades 'orden' y 'posicion'
 categoriasData.forEach((cat, idxCat) => {
 // Asegurar posicion de categoria
 if (!cat.posicion) {
 cat.posicion = idxCat + 1;
 necesitaGuardar = true;
 }
 
 if (!cat.subcategorias || !Array.isArray(cat.subcategorias)) {
 cat.subcategorias = [];
 necesitaGuardar = true;
 } else {
 cat.subcategorias = cat.subcategorias.map((sub, idxSub) => {
 let s = typeof sub === 'string' ? { nombre: sub, margen: 30 } : sub;
 if (!s.orden) {
 s.orden = 'nombre_asc'; // Orden por defecto: Nombre A-Z
 necesitaGuardar = true;
 }
 if (!s.posicion) {
 s.posicion = idxSub + 1;
 necesitaGuardar = true;
 }
 return s;
 });
 }
 });

 if (necesitaGuardar && typeof StorageService !== 'undefined') {
 StorageService.set("categoriasData", categoriasData);
 }

 categoriasData.forEach((cat, indexCat) => {
 let card = document.createElement("div");
 card.style = "background: white; border-radius: 10px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border-left: 5px solid #3498db; margin-bottom: 20px;";

 let html = `
 <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #f0f0f0;">
 <div style="flex: 1;">
 <h3 style="margin:0 0 5px 0; color:#2c3e50; font-size:16px; font-weight:600;">
 ${cat.nombre || 'Sin nombre'}
 </h3>
 <div style="display: flex; gap: 6px; margin-top: 8px;">
 <button onclick="editarNombreCategoria(${indexCat})" style="background:#3498db; border:none; color:white; cursor:pointer; padding:6px 12px; border-radius:5px; font-size:12px; font-weight:bold;" title="Editar nombre">Editar</button>
 <button onclick="moverCategoriaArriba(${indexCat})" ${indexCat === 0 ? 'disabled' : ''} style="background:#e3f2fd; border:1px solid #bbdefb; border-radius:5px; padding:6px 12px; cursor:${indexCat === 0 ? 'default' : 'pointer'}; color:#1976d2; font-size:12px; font-weight:bold; ${indexCat === 0 ? 'opacity:0.4;' : ''}" title="Mover arriba">Arriba</button>
 <button onclick="moverCategoriaAbajo(${indexCat})" ${indexCat === categoriasData.length - 1 ? 'disabled' : ''} style="background:#e3f2fd; border:1px solid #bbdefb; border-radius:5px; padding:6px 12px; cursor:${indexCat === categoriasData.length - 1 ? 'default' : 'pointer'}; color:#1976d2; font-size:12px; font-weight:bold; ${indexCat === categoriasData.length - 1 ? 'opacity:0.4;' : ''}" title="Mover abajo">Abajo</button>
 </div>
 </div>
 <button onclick="eliminarCategoria(${indexCat})" style="background:#fee; border:none; color:#e74c3c; cursor:pointer; padding:8px 14px; border-radius:5px; font-size:13px; font-weight:bold;" title="Eliminar">Eliminar</button>
 </div>
 <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
 <thead>
 <tr style="background:#f8f9fa; border-bottom: 2px solid #e0e0e0; text-align: left; color: #555; font-weight:600;">
 <th style="padding: 10px 8px;">Subcategoria</th>
 <th style="padding: 10px 8px; text-align: center;">Margen %</th>
 <th style="padding: 10px 8px; text-align: center;">Orden</th>
 <th style="padding: 10px 8px; text-align: center;">Posicion</th>
 <th style="padding: 10px 8px; text-align: right;">Acciones</th>
 </tr>
 </thead>
 <tbody>`;

 if (cat.subcategorias.length === 0) {
 html += `<tr><td colspan="5" style="text-align:center; padding:20px; color:#999; font-style:italic;">Sin subcategorias</td></tr>`;
 } else {
 cat.subcategorias.forEach((sub, indexSub) => {
 let ord = sub.orden || 'nombre_asc';
 html += `
 <tr style="border-bottom: 1px solid #f0f0f0; padding: 8px 0;">
 <td style="padding: 12px 8px; font-weight:600; color:#2c3e50;">${sub.nombre || '---'}</td>
 <td style="padding: 12px 8px; text-align: center;">
 <input type="number" value="${sub.margen || 30}"
 onchange="actualizarMargen(${indexCat}, ${indexSub}, this.value)"
 style="width: 80px; min-width:70px; text-align: center; border: 1px solid #ddd; border-radius: 4px; padding: 6px 8px; font-size:13px; box-sizing:border-box;">
 </td>
 <td style="padding: 12px 8px; text-align: center;">
 <select onchange="actualizarOrdenSub(${indexCat}, ${indexSub}, this.value)" style="padding:6px; border:1px solid #cbd5e1; border-radius:4px; font-size:11px; min-width:140px;">
 <option value="nombre_asc" ${ord==='nombre_asc'?'selected':''}>A-Z</option>
 <option value="nombre_desc" ${ord==='nombre_desc'?'selected':''}>Z-A</option>
 <option value="precio_desc" ${ord==='precio_desc'?'selected':''}>Mayor precio</option>
 <option value="precio_asc" ${ord==='precio_asc'?'selected':''}>Menor precio</option>
 <option value="stock_desc" ${ord==='stock_desc'?'selected':''}>Mas stock</option>
 </select>
 </td>
 <td style="padding: 12px 8px; text-align: center;">
 <button onclick="moverSubcategoriaArriba(${indexCat}, ${indexSub})" ${indexSub === 0 ? 'disabled' : ''} style="background:#e3f2fd; border:1px solid #bbdefb; border-radius:4px; padding:5px 8px; cursor:${indexSub === 0 ? 'default' : 'pointer'}; color:#1976d2; font-size:11px; font-weight:bold; ${indexSub === 0 ? 'opacity:0.3;' : ''}" title="Mover arriba">x</button>
 <button onclick="moverSubcategoriaAbajo(${indexCat}, ${indexSub})" ${indexSub === cat.subcategorias.length - 1 ? 'disabled' : ''} style="background:#e3f2fd; border:1px solid #bbdefb; border-radius:4px; padding:5px 8px; cursor:${indexSub === cat.subcategorias.length - 1 ? 'default' : 'pointer'}; color:#1976d2; font-size:11px; font-weight:bold; ${indexSub === cat.subcategorias.length - 1 ? 'opacity:0.3;' : ''}" title="Mover abajo">x</button>
 </td>
 <td style="text-align: right; padding: 12px 8px; white-space: nowrap;">
 <button onclick="typeof iniciarMigracion === 'function' ? iniciarMigracion(${indexCat}, ${indexSub}) : null" style="background:#f0f4ff; border:1px solid #c7d9f7; border-radius:4px; padding:5px 10px; cursor:pointer; color:#1d4ed8; font-size:11px; font-weight:bold; margin-right:6px;">Mover</button>
 <button onclick="eliminarSubcategoria(${indexCat}, ${indexSub})" style="background:#ffebee; border:1px solid #ffcdd2; color:#e74c3c; cursor:pointer; padding:5px 10px; border-radius:4px; font-size:11px; font-weight:bold;">x</button>
 </td>
 </tr>`;
 });
 }

 html += `
 </tbody>
 </table>
 <button onclick="agregarSubcategoria(${indexCat})" style="margin-top: 15px; width: 100%; padding: 12px; background: #f0f7ff; border: 2px dashed #3498db; border-radius: 5px; cursor: pointer; font-size: 13px; color: #3498db; font-weight:bold;">+ Agregar Subcategoria</button>
 `;

 card.innerHTML = html;
 contenedor.appendChild(card);
 });
}

function guardarCategoriasConfig() {
 if (!StorageService.set("categoriasData", categoriasData)) return console.error("Error guardando");
 renderCategorias();
 if (typeof actualizarCombosFiltros === 'function') actualizarCombosFiltros();
}

function nuevaCategoria() {
 const nombre = prompt("Nombre de la nueva categoria:");
 if (nombre && nombre.trim()) {
 categoriasData.push({ nombre: nombre.trim(), subcategorias: [] });
 guardarCategoriasConfig();
 }
}

function agregarSubcategoria(indexCat) {
 const nombre = prompt("Nombre de la subcategoria:");
 const margen = prompt("Que margen de ganancia (%) deseas?", "30");
 if (nombre && margen) {
 categoriasData[indexCat].subcategorias.push({
 nombre: nombre.trim(),
 margen: parseFloat(margen),
 orden: 'nombre_asc' // Asignamos regla por defecto al crear
 });
 guardarCategoriasConfig();
 }
}

function eliminarSubcategoria(indexCat, indexSub) {
 if (confirm("Eliminar subcategoria?")) {
 categoriasData[indexCat].subcategorias.splice(indexSub, 1);
 guardarCategoriasConfig();
 }
}

function eliminarCategoria(index) {
 if (confirm("Seguro que quieres eliminar toda la categoria?")) {
 categoriasData.splice(index, 1);
 guardarCategoriasConfig();
 }
}

function actualizarMargen(indexCat, indexSub, nuevoValor) {
 categoriasData[indexCat].subcategorias[indexSub].margen = parseFloat(nuevoValor);
 StorageService.set("categoriasData", categoriasData);
}

// NUEVA FUNCION: Guarda el orden seleccionado
window.actualizarOrdenSub = function(indexCat, indexSub, nuevoOrden) {
 categoriasData[indexCat].subcategorias[indexSub].orden = nuevoOrden;
 StorageService.set("categoriasData", categoriasData);
}
// --- MOTOR UNIVERSAL DE ORDENAMIENTO ---
window.aplicarOrdenamientoInteligente = function(productosArray, subcatSeleccionada) {
 let regla = 'nombre_asc'; // Regla por defecto

 // Si selecciono una subcategoria especifica, buscamos su regla
 if (subcatSeleccionada && subcatSeleccionada !== 'todos') {
 const catData = window.categoriasData || (typeof StorageService !== 'undefined' ? StorageService.get("categoriasData", []) : []);
 for (let cat of catData) {
 let sub = (cat.subcategorias || []).find(s => s.nombre === subcatSeleccionada);
 if (sub && sub.orden) {
 regla = sub.orden;
 break;
 }
 }
 }

 // Clonamos el array para no mutar el original en memoria y ordenamos
 return [...productosArray].sort((a, b) => {
 if (regla === 'nombre_asc') return (a.nombre || '').localeCompare(b.nombre || '');
 if (regla === 'nombre_desc') return (b.nombre || '').localeCompare(a.nombre || '');
 if (regla === 'precio_asc') return (parseFloat(a.precio) || 0) - (parseFloat(b.precio) || 0);
 if (regla === 'precio_desc') return (parseFloat(b.precio) || 0) - (parseFloat(a.precio) || 0);
 if (regla === 'stock_desc') return (parseFloat(b.stock) || 0) - (parseFloat(a.stock) || 0);
 return 0; // Fallback
 });
};

// ===== FUNCIONES DE REORDENAMIENTO DE CATEGORIAS Y SUBCATEGORIAS =====
window.moverCategoriaArriba = function(index) {
 if (index <= 0) return;
 const temp = categoriasData[index];
 categoriasData[index] = categoriasData[index - 1];
 categoriasData[index - 1] = temp;
 
 // Actualizar posiciones
 categoriasData[index].posicion = index + 1;
 categoriasData[index - 1].posicion = index;
 
 guardarCategoriasConfig();
};

window.moverCategoriaAbajo = function(index) {
 if (index >= categoriasData.length - 1) return;
 const temp = categoriasData[index];
 categoriasData[index] = categoriasData[index + 1];
 categoriasData[index + 1] = temp;
 
 // Actualizar posiciones
 categoriasData[index].posicion = index + 1;
 categoriasData[index + 1].posicion = index + 2;
 
 guardarCategoriasConfig();
};

window.moverSubcategoriaArriba = function(indexCat, indexSub) {
 if (indexSub <= 0) return;
 const temp = categoriasData[indexCat].subcategorias[indexSub];
 categoriasData[indexCat].subcategorias[indexSub] = categoriasData[indexCat].subcategorias[indexSub - 1];
 categoriasData[indexCat].subcategorias[indexSub - 1] = temp;
 
 // Actualizar posiciones
 categoriasData[indexCat].subcategorias[indexSub].posicion = indexSub + 1;
 categoriasData[indexCat].subcategorias[indexSub - 1].posicion = indexSub;
 
 guardarCategoriasConfig();
};

window.moverSubcategoriaAbajo = function(indexCat, indexSub) {
 if (indexSub >= categoriasData[indexCat].subcategorias.length - 1) return;
 const temp = categoriasData[indexCat].subcategorias[indexSub];
 categoriasData[indexCat].subcategorias[indexSub] = categoriasData[indexCat].subcategorias[indexSub + 1];
 categoriasData[indexCat].subcategorias[indexSub + 1] = temp;
 
 // Actualizar posiciones
 categoriasData[indexCat].subcategorias[indexSub].posicion = indexSub + 1;
 categoriasData[indexCat].subcategorias[indexSub + 1].posicion = indexSub + 2;
 
 guardarCategoriasConfig();
};

window.editarNombreCategoria = function(index) {
 const cat = categoriasData[index];
 const nuevoNombre = prompt(`Editar nombre de la categoria "${cat.nombre}":`, cat.nombre);
 
 if (nuevoNombre && nuevoNombre.trim() !== "" && nuevoNombre !== cat.nombre) {
 const nombreAnterior = cat.nombre;
 cat.nombre = nuevoNombre.trim();
 
 // MIGRACION SILENCIOSA: Actualizar todos los productos existentes
 let productos = StorageService.get("productos", []);
 let actualizados = 0;
 productos.forEach(p => {
 if (p.categoria === nombreAnterior) {
 p.categoria = cat.nombre;
 actualizados++;
 }
 });
 
 StorageService.set("productos", productos);
 guardarCategoriasConfig();
 alert(`Categoria renombrada. Se actualizaron ${actualizados} productos en el inventario.`);
 }
}

// NUEVA FUNCION: EL MOTOR DE MIGRACION NATIVA
function iniciarMigracion(indexCat, indexSub) {
 const catOrigen = categoriasData[indexCat].nombre;
 const subObj = categoriasData[indexCat].subcategorias[indexSub];
 const subOrigen = subObj.nombre;

 // Construir modal de seleccion
 const overlay = document.createElement('div');
 overlay.id = 'modalMigracionCat';
 overlay.style = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:100000;';

 const catOptions = categoriasData.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('');

 overlay.innerHTML = `
 <div style="width:420px; max-width:92%; background:white; border-radius:8px; padding:18px; box-shadow:0 10px 30px rgba(0,0,0,0.2);">
 <h3 style="margin:0 0 8px 0; font-size:16px;">Migrar subcategoria</h3>
 <div style="color:#555; margin-bottom:12px; font-size:13px;">Subcategoria: <strong>${subOrigen}</strong><br>Categoria origen: <strong>${catOrigen}</strong></div>
 <label style="display:block; font-size:13px; margin-bottom:6px;">Selecciona la categoria destino</label>
 <select id="migSelectCat" style="width:100%; padding:8px 10px; border:1px solid #d1d5db; border-radius:6px; font-size:13px; margin-bottom:8px;">
 <option value="">-- Selecciona --</option>
 ${catOptions}
 <option value="__new__">+ Crear nueva categoria...</option>
 </select>
 <div id="migNewWrap" style="display:none; margin-bottom:8px;">
 <input id="migNewName" placeholder="Nombre de la nueva categoria" style="width:100%; padding:8px 10px; border:1px solid #d1d5db; border-radius:6px; font-size:13px;" />
 </div>
 <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:12px;">
 <button id="migCancel" style="background:#f3f4f6;border:none;padding:8px 12px;border-radius:6px;cursor:pointer;">Cancelar</button>
 <button id="migConfirm" style="background:#2563eb;color:white;border:none;padding:8px 12px;border-radius:6px;cursor:pointer;font-weight:600;">Mover</button>
 </div>
 </div>
 `;

 document.body.appendChild(overlay);

 const sel = document.getElementById('migSelectCat');
 const newWrap = document.getElementById('migNewWrap');
 const newName = document.getElementById('migNewName');
 const btnCancel = document.getElementById('migCancel');
 const btnConfirm = document.getElementById('migConfirm');

 sel.onchange = function() {
 if (this.value === '__new__') newWrap.style.display = 'block'; else newWrap.style.display = 'none';
 };

 btnCancel.onclick = function() { overlay.remove(); };

 btnConfirm.onclick = function() {
 let catDestino = sel.value === '__new__' ? (newName.value || '').trim() : sel.value;
 if (!catDestino) return alert('Ingresa o selecciona la categoria destino.');
 if (catDestino.toUpperCase() === catOrigen.toUpperCase()) return alert('La categoria destino es la misma que la actual. No hay nada que mover.');
 if (!confirm(`Estas seguro de mover la subcategoria "${subOrigen}" (y TODOS sus productos) hacia "${catDestino}"?`)) return;

 // 1. AFECTACIAN EN BASE DE DATOS (PRODUCTOS)
 let productos = StorageService.get('productos', []);
 let modificados = 0;
 productos.forEach(p => {
 if ((p.categoria || '') === catOrigen && (p.subcategoria || '') === subOrigen) {
 p.categoria = catDestino;
 modificados++;
 }
 });

 // 2. REESTRUCTURACIAN DE CATEGORIAS
 let indexDestino = categoriasData.findIndex(c => c.nombre.toUpperCase() === catDestino.toUpperCase());
 if (indexDestino === -1) {
 // crear nueva categoria y asignar posicion al final
 const nueva = { nombre: catDestino, subcategorias: [], posicion: (categoriasData.length || 0) + 1 };
 // asegurar que subObj sea clonado para no perder referencias
 const subClone = (typeof subObj === 'object') ? JSON.parse(JSON.stringify(subObj)) : { nombre: subObj };
 subClone.posicion = 1;
 nueva.subcategorias.push(subClone);
 categoriasData.push(nueva);
 } else {
 const catDestObj = categoriasData[indexDestino];
 const existeSub = catDestObj.subcategorias.find(s => s.nombre.toUpperCase() === subOrigen.toUpperCase());
 if (!existeSub) {
 const subClone = (typeof subObj === 'object') ? JSON.parse(JSON.stringify(subObj)) : { nombre: subObj };
 subClone.posicion = (catDestObj.subcategorias.length || 0) + 1;
 catDestObj.subcategorias.push(subClone);
 } else {
 alert(`Nota: La categoria "${catDestino}" ya tenia una subcategoria llamada "${subOrigen}". Los productos se fusionaron ahi.`);
 }
 }

 // 3. ELIMINAMOS DEL ORIGEN
 categoriasData[indexCat].subcategorias.splice(indexSub, 1);

 // 4. LIMPIEZA INTELIGENTE
 if (categoriasData[indexCat].subcategorias.length === 0) {
 if (confirm(`La categoria "${catOrigen}" se ha quedado vacia. Deseas eliminarla del sistema para mantener el orden?`)) {
 categoriasData.splice(indexCat, 1);
 }
 }

 // 5. GUARDADO MASIVO
 StorageService.set('productos', productos);
 guardarCategoriasConfig(); // save + render

 alert(`MIGRACION EXITOSA.\n\nSe actualizaron ${modificados} producto(s) en tu inventario.\nSe movio hacia: [${catDestino}] -> [${subOrigen}]`);
 overlay.remove();
 };
}

// ===== VISOR MAESTRO =====
function abrirVisorMaestro(id, origen = 'inventario') {
 window._visorProductoVolverA = origen || 'inventario';
 window._visorProductoIdActual = String(id);
 navA('productos-visor');
 mostrarDetalleProductoMaestro(String(id));
 setTimeout(() => mostrarDetalleProductoMaestro(String(id)), 80);
}

window.abrirVisorMaestro = abrirVisorMaestro;

window.volverDesdeVisorProducto = function() {
 const destino = window._visorProductoVolverA || 'inventario';
 navA(destino);
 if (destino === 'kardex-inventario' && typeof renderKardexInventario === 'function') renderKardexInventario();
 if (destino === 'inventario' && typeof renderInventario === 'function') renderInventario();
};

function renderFilasKardex(id, tipoFiltro) {
 const movimientos = movimientosInventario.filter(m => String(m.productoId) === String(id) && m.tipo === tipoFiltro);
 if (movimientos.length === 0) {
 return `<tr><td colspan="3" style="text-align: center; padding: 20px; color: #ccc;">Sin registros de ${tipoFiltro}</td></tr>`;
 }
 return [...movimientos].reverse().map(m => `
 <tr style="border-bottom: 1px solid #f1f1f1; font-size: 13px;">
 <td style="padding: 8px 0;">${window.formatearFechaCortaMX(m.fecha)}</td>
 <td style="padding: 8px 0;">${m.concepto}</td>
 <td style="padding: 8px 0; text-align: right; font-weight: bold;">${m.cantidad}</td>
 </tr>
 `).join('');
}

function actualizarSubcategoriasVisor(valorSeleccionado = "") {
 const cat = document.getElementById("editCategoria")?.value;
 const subSelect = document.getElementById("editSubcategoria");
 if (!subSelect) return;

 let html = '<option value="">-- Seleccionar --</option>';
 if (cat) {
 const catInfo = categoriasData.find(c => c.nombre === cat);
 if (catInfo && catInfo.subcategorias) {
 catInfo.subcategorias.forEach(s => {
 html += `<option value="${s.nombre}" ${valorSeleccionado === s.nombre ? 'selected' : ''}>${s.nombre}</option>`;
 });
 }
 }
 subSelect.innerHTML = html;
}


function guardarCambiosVisor(id) {
 if (!_invRequireAdmin('Editar producto maestro')) return;
 const p = window.productos.find(prod => String(prod.id) === String(id));
 if (!p) return;
 if (!confirm(`Guardar cambios para "${p.nombre}"?`)) return;

 p.nombre = document.getElementById("editNombre")?.value || p.nombre;
 p.marca = document.getElementById("editMarca")?.value || '';
 p.costo = parseFloat(document.getElementById("editCosto")?.value) || p.costo;
 p.precio = parseFloat(document.getElementById("editPrecio")?.value) || p.precio;
 p.caracteristicas = document.getElementById("editCaracteristicas")?.value || '';

 // Borramos p.color, p.modelo, p.descripcion y p.imagen porque ya no estan en tu Visor Maestro

 if (!StorageService.set("productos", window.productos)) {
 alert("Error guardando cambios");
 return;
 }
 renderInventario(); 
 alert("Cambios guardados correctamente.");
}

function recalcularRentabilidad() {
 const costo = parseFloat(document.getElementById("editCosto")?.value) || 0;
 const precio = parseFloat(document.getElementById("editPrecio")?.value) || 0;
 const ganancia = precio - costo;
 const margenPct = CalculatorService.calcularMargen(precio, costo);

 const dispGanancia = document.getElementById("displayGanancia");
 const dispMargen = document.getElementById("displayMargen");
 if (dispGanancia) dispGanancia.innerText = dinero(ganancia);
 if (dispMargen) {
 dispMargen.innerText = margenPct.toFixed(1) + "%";
 dispMargen.style.color = margenPct < 20 ? "#e74c3c" : margenPct <= 35 ? "#f39c12" : "#27ae60";
 }
}

function insertarProductoSistema(p) {
 const validacion = ValidatorService.validarProducto({
 nombre: p.nombre,
 costo: p.costo,
 precio: p.precio
 });

 if (!validacion.valid) {
 return { ok: false, error: validacion.errores.join(", ") };
 }

 // Buscar categoria real
 let categoriaPadre = "";
 let subValida = false;

 categoriasData.forEach(cat => {
 const sub = cat.subcategorias.find(s => s.nombre === p.subcategoria);
 if (sub) {
 categoriaPadre = cat.nombre;
 subValida = true;
 }
 });

 if (!subValida) {
 return { ok: false, error: "Subcategoria no existe" };
 }

 // Evitar duplicados reales
 const duplicado = window.productos.some(prod =>
 prod.nombre.toUpperCase() === p.nombre.toUpperCase() &&
 prod.modelo === p.modelo &&
 prod.color === p.color
 );

 if (duplicado) {
 return { ok: false, error: "Producto duplicado" };
 }

 const margenCalculado = CalculatorService.calcularMargen(p.precio, p.costo);

 window.productos.push({
 id: Math.round(Date.now() * 1000 + Math.random() * 1000),
 nombre: p.nombre,
 costo: p.costo,
 precio: p.precio,
 margen: margenCalculado,
 imagen: p.imagen || "",
 color: p.color || "",
 marca: p.marca || "",
 modelo: p.modelo || "",
 categoria: categoriaPadre,
 subcategoria: p.subcategoria,
 stock: p.stock || 0,
 // === LA LINEA QUE FALTABA ES ESTA ===
 caracteristicas: p.caracteristicas || "" 
 // ===================================
 });

 return { ok: true };
}

// ============================================================
// CATALOGO DE UBICACIONES (Bodegas, Sucursales, etc.)
// ============================================================

function renderUbicaciones() {
 const contenedor = document.getElementById("tablaUbicaciones");
 if (!contenedor) return;

 // Le damos dos ubicaciones por defecto si el sistema esta vacio
 let ubicaciones = StorageService.get("ubicacionesConfig", [
 { id: 1, nombre: "Piso de Ventas" },
 { id: 2, nombre: "Bodega Principal" }
 ]);

 // Las guardamos en memoria si es la primera vez
 if(StorageService.get("ubicacionesConfig", []).length === 0) {
 StorageService.set("ubicacionesConfig", ubicaciones);
 }

 let filas = ubicaciones.map(u => `
 <tr style="border-bottom:1px solid #eee;">
 <td style="padding:12px; font-weight:bold; color:#1e40af;">${u.nombre}</td>
 <td style="padding:12px; text-align:center;">
 <button onclick="eliminarUbicacion(${u.id})" style="background:#fee2e2; color:#ef4444; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;">Eliminar</button>
 </td>
 </tr>
 `).join('');

 contenedor.innerHTML = `
 <div style="background:white; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.05); overflow:hidden;">
 <table style="width:100%; border-collapse:collapse; font-size:14px;">
 <thead style="background:#f8fafc; border-bottom:2px solid #e2e8f0; color:#475569;">
 <tr>
 <th style="padding:12px; text-align:left;">Nombre de la Ubicacion</th>
 <th style="padding:12px; text-align:center; width:100px;">Accion</th>
 </tr>
 </thead>
 <tbody>${filas || '<tr><td colspan="2" style="text-align:center; padding:20px; color:#94a3b8;">No hay ubicaciones registradas</td></tr>'}</tbody>
 </table>
 </div>
 `;
}

function guardarUbicacion() {
 if (!_invRequireAdmin('Guardar ubicacion de inventario')) return;
 const input = document.getElementById("nuevaUbicacionNombre");
 const nombre = input.value.trim();
 if (!nombre) return alert("Escribe un nombre para la ubicacion.");

 let ubicaciones = StorageService.get("ubicacionesConfig", []);
 
 // Evitar duplicados
 if (ubicaciones.some(u => u.nombre.toLowerCase() === nombre.toLowerCase())) {
 return alert("Esta ubicacion ya existe.");
 }

 ubicaciones.push({ id: Date.now(), nombre: nombre });
 StorageService.set("ubicacionesConfig", ubicaciones);
 input.value = "";
 renderUbicaciones();
}

function eliminarUbicacion(id) {
 if (!_invRequireAdmin('Eliminar ubicacion de inventario')) return;
 if (!confirm("Seguro que deseas eliminar esta ubicacion? (Asegurate de no tener inventario guardado aqui)")) return;
 let ubicaciones = StorageService.get("ubicacionesConfig", []);
 ubicaciones = ubicaciones.filter(u => u.id !== id);
 StorageService.set("ubicacionesConfig", ubicaciones);
 renderUbicaciones();
}

// Exponemos la funcion al HTML
window.renderUbicaciones = renderUbicaciones;
function renderTablaVariantes(variantes, prodId) {
 if (!variantes || variantes.length === 0) return '<p style="padding: 15px; color: #94a3b8; text-align: center; font-size: 12px;">No hay existencias registradas.</p>';
 return `
 <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
 <thead><tr style="background: #f8fafc; text-align: left; color: #64748b;"><th style="padding: 8px;">Ubicacion</th><th>Color</th><th style="text-align: center;">Stock</th></tr></thead>
 <tbody>
 ${variantes.map(v => `
 <tr style="border-top: 1px solid #f1f5f9;">
 <td style="padding: 8px;"><b>${_kardexEsc(v.ubicacion || '-')}</b></td>
 <td>${_kardexEsc(v.color || '-')}</td>
 <td style="text-align: center; font-weight: bold; color: #1e40af;">${Number(v.stock) || 0}</td>
 </tr>
 `).join('')}
 </tbody>
 </table>`;

 if (!variantes || variantes.length === 0) return '<p style="padding: 15px; color: #94a3b8; text-align: center; font-size: 12px;">No hay existencias registradas.</p>';
 
 return `
 <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
 <thead><tr style="background: #f8fafc; text-align: left; color: #64748b;"><th style="padding: 8px;">Ubicacion</th><th>Color</th><th style="text-align: center;">Stock</th><th></th></tr></thead>
 <tbody>
 ${variantes.map((v, idx) => `
 <tr style="border-top: 1px solid #f1f5f9;">
 <td style="padding: 8px;"><b>${v.ubicacion}</b></td>
 <td>${v.color}</td>
 <td style="text-align: center; font-weight: bold; color: #1e40af;">${v.stock}</td>
 <td style="text-align: right; padding-right: 8px;">
 <button onclick="eliminarVariante('${prodId}', ${idx})" style="background: none; border: none; color: #ef4444; cursor: pointer;">x</button>
 </td>
 </tr>
 `).join('')}
 </tbody>
 </table>`;
}

// CORRECCIAN PARA AAADIR VARIANTE
window.agregarVarianteStock = function(prodId) {
 const ubicacion = document.getElementById('newVarUbicacion').value;
 const color = document.getElementById('newVarColor').value.trim();
 const stock = parseInt(document.getElementById('newVarCant').value);

 if (!color || isNaN(stock)) return alert("Indica color y cantidad");

 const p = window.productos.find(prod => String(prod.id) === String(prodId));
 p.variantes = p.variantes || [];

 const existente = p.variantes.find(v => v.ubicacion === ubicacion && v.color.toUpperCase() === color.toUpperCase());
 if (existente) {
 existente.stock += stock;
 } else {
 p.variantes.push({ ubicacion, color, stock });
 }

 // --- LINEA NUEVA: ACTUALIZAR STOCK GENERAL ---
 p.stock = (p.stock || 0) + stock; 

 registrarMovimiento(prodId, `Entrada - ${ubicacion} (${color})`, stock, "entrada");
 mostrarDetalleProductoMaestro(prodId);
};

window.abrirAjusteProductoDesdeVisor = function(prodId) {
 const p = (window.productos || []).find(prod => String(prod.id) === String(prodId));
 if (!p) return alert('Producto no encontrado.');
 if (typeof window.abrirModalAjusteInv === 'function') window.abrirModalAjusteInv();
 setTimeout(() => {
 const input = document.getElementById('ajusteProductoId');
 const display = document.getElementById('ajusteProductoDisplay');
 if (input) input.value = p.id;
 if (display) {
 display.innerText = p.nombre || 'Producto seleccionado';
 display.style.color = '#1e40af';
 display.style.fontWeight = 'bold';
 }
 }, 50);
};

window.abrirTransferenciaProductoDesdeVisor = function(prodId) {
 const p = (window.productos || []).find(prod => String(prod.id) === String(prodId));
 if (!p) return alert('Producto no encontrado.');
 if (typeof window.abrirModalTransferenciaInv === 'function') window.abrirModalTransferenciaInv();
 setTimeout(() => {
 const input = document.getElementById('transfProductoId');
 const display = document.getElementById('transfProductoDisplay');
 if (input) input.value = p.id;
 if (display) {
 display.innerText = p.nombre || 'Producto seleccionado';
 display.style.color = '#1e40af';
 display.style.fontWeight = 'bold';
 }
 }, 50);
};

// CORRECCIAN PARA ELIMINAR VARIANTE
window.eliminarVariante = function(prodId, index) {
 if (!confirm("Eliminar esta existencia del inventario?")) return;
 const p = window.productos.find(prod => String(prod.id) === String(prodId));
 
 const v = p.variantes[index];
 registrarMovimiento(prodId, `Correccion/Baja - ${v.ubicacion} (${v.color})`, v.stock, "salida");
 
 // --- LINEA NUEVA: RESTAR AL STOCK GENERAL ---
 p.stock = (p.stock || 0) - v.stock; 

 p.variantes.splice(index, 1);
 mostrarDetalleProductoMaestro(prodId);
};

// =========================================================
// MODULO: AJUSTES Y TRANSFERENCIAS DE INVENTARIO
// =========================================================

// --- AJUSTES (MERMAS / SOBRANTES) ---
window.abrirModalAjusteInv = function() {
 if (!_invRequireAdmin('Abrir ajuste de inventario')) return;
 const ubs = StorageService.get('ubicacionesConfig', [{id:'General', nombre:'Piso de Ventas (General)'}]);
 let opts = '';
 ubs.forEach(u => opts += `<option value="${u.nombre}">${u.nombre}</option>`);
 
 document.getElementById('ajusteUbicacion').innerHTML = opts;
 document.getElementById('ajusteProductoId').value = '';
 document.getElementById('ajusteProductoDisplay').innerText = 'Sin seleccionar';
 document.getElementById('ajusteProductoDisplay').style.color = '#64748b';
 document.getElementById('ajusteCantidad').value = '';
 document.getElementById('ajusteMotivo').value = '';
 
 // Y ESTA ES LA MAGIA QUE FALTABA: Quitar el candado CSS
 const modal = document.getElementById('modalAjusteInv');
 modal.classList.remove('oculto');
 modal.style.display = 'flex';
};

window.ejecutarAjusteInv = function() {
 if (!_invRequireAdmin('Aplicar ajuste de inventario')) return;
 const idProd = document.getElementById('ajusteProductoId').value;
 const tipo = document.getElementById('ajusteTipo').value;
 const cant = parseFloat(document.getElementById('ajusteCantidad').value);
 const ubi = document.getElementById('ajusteUbicacion').value;
 const motivo = document.getElementById('ajusteMotivo').value;

 if(!idProd) return alert("Selecciona un producto.");
 if(isNaN(cant) || cant <= 0) return alert("Ingresa una cantidad valida.");
 if(!motivo) return alert("Debes ingresar un motivo para el ajuste (Auditoria).");

 const productos = StorageService.get("productos", []);
 const idx = productos.findIndex(p => String(p.id) === String(idProd));
 
 if(idx === -1) return alert("Producto no encontrado.");
 
 let p = productos[idx];

 // --- NUEVO: RESUMEN Y CONFIRMACION ---
 const tipoAjusteStr = tipo === 'salida' ? 'SALIDA (Resta stock)' : 'ENTRADA (Suma stock)';
 const msjConfAjuste = `RESUMEN DE OPERACION - AJUSTAR INVENTARIO?\n\nProducto: ${p.nombre}\nTipo de Ajuste: ${tipoAjusteStr}\nCantidad: ${cant} pieza(s)\nUbicacion: ${ubi}\nMotivo: ${motivo}\n\nEsta accion modificara tu inventario directamente sin una venta o compra. Estas seguro de continuar?`;
 if (!confirm(msjConfAjuste)) return;
 // --- FIN DE CONFIRMACION ---

 p.stockPorUbicacion = p.stockPorUbicacion || {};
 p.stock = parseFloat(p.stock) || 0;

 if(tipo === 'salida') {
 p.stock -= cant;
 p.stockPorUbicacion[ubi] = (parseFloat(p.stockPorUbicacion[ubi]) || 0) - cant;
 } else {
 p.stock += cant;
 p.stockPorUbicacion[ubi] = (parseFloat(p.stockPorUbicacion[ubi]) || 0) + cant;
 }

 const sesion = _invSesionActiva() || {};
 const movs = StorageService.get("movimientosInventario", []);
 const referenciaAjuste = `AJUSTE-${Date.now()}`;
 movs.push({
 id: Date.now(),
 fecha: window.localISO(new Date()),
 tipo: tipo === 'salida' ? 'Egreso (Merma/Ajuste)' : 'Ingreso (Sobrante/Ajuste)',
 productoId: p.id,
 productoNombre: p.nombre,
 cantidad: cant,
 ubicacion: ubi,
 motivo: motivo,
 origen: 'ajusteInventario',
 referencia: referenciaAjuste,
 usuario: sesion.nombre || sesion.usuario || 'Admin',
 rol: sesion.rol || ''
 });

 productos[idx] = p;
 StorageService.set("productos", productos);
 StorageService.set("movimientosInventario", movs);
 window.productos = productos;
 window.movimientosInventario = movs;
 window.AuditService?.log?.({
 accion: tipo === 'salida' ? 'INVENTARIO_AJUSTE_SALIDA' : 'INVENTARIO_AJUSTE_ENTRADA',
 modulo: 'Inventario',
 entidad: p.nombre,
 entidadId: p.id,
 detalle: `${cant} pieza(s) en ${ubi}. Motivo: ${motivo}`,
 datos: { productoId: p.id, cantidad: cant, ubicacion: ubi, motivo, referencia: referenciaAjuste }
 });

 alert(`Ajuste aplicado con exito.`);
 
 // Cerrar y volver a poner candado
 const modal = document.getElementById('modalAjusteInv');
 modal.classList.add('oculto');
 modal.style.display = 'none';
 
 if(typeof renderInventario === 'function') renderInventario();
};

// --- TRANSFERENCIAS ENTRE BODEGAS ---
window.abrirModalTransferenciaInv = function() {
 if (!_invRequireAdmin('Abrir transferencia de inventario')) return;
 const ubs = StorageService.get('ubicacionesConfig', [{id:'General', nombre:'Piso de Ventas (General)'}]);
 let opts = '';
 ubs.forEach(u => opts += `<option value="${u.nombre}">${u.nombre}</option>`);
 
 document.getElementById('transfOrigen').innerHTML = opts;
 document.getElementById('transfDestino').innerHTML = opts;
 
 document.getElementById('transfProductoId').value = '';
 document.getElementById('transfProductoDisplay').innerText = 'Sin seleccionar';
 document.getElementById('transfProductoDisplay').style.color = '#64748b';
 document.getElementById('transfCantidad').value = '';
 
 // Y MAGIA DEL CSS AQUI TAMBIAN
 const modal = document.getElementById('modalTransferenciaInv');
 modal.classList.remove('oculto');
 modal.style.display = 'flex';
};

window.ejecutarTransferenciaInv = function() {
 if (!_invRequireAdmin('Ejecutar transferencia de inventario')) return;
 const idProd = document.getElementById('transfProductoId').value;
 const cant = parseFloat(document.getElementById('transfCantidad').value);
 const origen = document.getElementById('transfOrigen').value;
 const destino = document.getElementById('transfDestino').value;

 if(!idProd) return alert("Selecciona un producto.");
 if(isNaN(cant) || cant <= 0) return alert("Ingresa una cantidad valida.");
 if(origen === destino) return alert("El origen y el destino no pueden ser el mismo.");

 const productos = StorageService.get("productos", []);
 const idx = productos.findIndex(p => String(p.id) === String(idProd));
 
 if(idx === -1) return alert("Producto no encontrado.");
 
 let p = productos[idx];

 // --- NUEVO: RESUMEN Y CONFIRMACION ---
 const msjConf = `RESUMEN DE OPERACION - TRANSFERIR INVENTARIO?\n\nProducto: ${p.nombre}\nCantidad a mover: ${cant} pieza(s)\nOrigen: ${origen}\nDestino: ${destino}\n\nDeseas ejecutar esta transferencia de mercancia?`;
 if (!confirm(msjConf)) return;
 // --- FIN DE CONFIRMACION ---

 p.stockPorUbicacion = p.stockPorUbicacion || {};
 
 const stockOrigen = parseFloat(p.stockPorUbicacion[origen]) || 0;
 if(stockOrigen < cant) {
 if(!confirm(`ATENCION: Solo hay ${stockOrigen} piezas en [${origen}]. Deseas forzar el movimiento de todos modos y dejar la bodega en negativo?`)) {
 return;
 }
 }

 p.stockPorUbicacion[origen] = stockOrigen - cant;
 p.stockPorUbicacion[destino] = (parseFloat(p.stockPorUbicacion[destino]) || 0) + cant;

 const sesion = _invSesionActiva() || {};
 const movs = StorageService.get("movimientosInventario", []);
 const referenciaTransf = `TRANSF-${Date.now()}`;
 movs.push({
 id: Date.now(),
 fecha: window.localISO(new Date()),
 tipo: 'Transferencia Interna',
 productoId: p.id,
 productoNombre: p.nombre,
 cantidad: cant,
 origen: origen,
 destino: destino,
 motivo: `Mover mercancia de ${origen} a ${destino}`,
 referencia: referenciaTransf,
 usuario: sesion.nombre || sesion.usuario || 'Admin',
 rol: sesion.rol || ''
 });

 productos[idx] = p;
 StorageService.set("productos", productos);
 StorageService.set("movimientosInventario", movs);
 window.productos = productos;
 window.movimientosInventario = movs;
 window.AuditService?.log?.({
 accion: 'INVENTARIO_TRANSFERENCIA',
 modulo: 'Inventario',
 entidad: p.nombre,
 entidadId: p.id,
 detalle: `${cant} pieza(s) de ${origen} a ${destino}`,
 datos: { productoId: p.id, cantidad: cant, origen, destino, referencia: referenciaTransf }
 });

 alert(`Transferencia completada: ${cant} pieza(s) enviadas a ${destino}.`);
 
 // Cerrar y volver a poner candado
 const modal = document.getElementById('modalTransferenciaInv');
 modal.classList.add('oculto');
 modal.style.display = 'none';
 
 if(typeof renderInventario === 'function') renderInventario();
};

