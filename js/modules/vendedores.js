// ===== VENDEDORES Y COMISIONES =====

function _vendEsc(v) {
    return String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
}

function renderGestionVendedores() {
    const cont = document.getElementById('contenidoVendedores');
    if (!cont) return;
    const vendedores = StorageService.get('vendedores', []);
    const comisiones = StorageService.get('comisionesRegistradas', []);
    const pendTotal = comisiones.filter(c => c.estado === 'Pendiente').reduce((s, c) => s + c.montoComision, 0);

    const hoy = new Date();
    const primerDiaMes = window.obtenerHoyInputMX().substring(0, 8) + '01';
    const hoyStr = window.obtenerHoyInputMX();

    const rows = vendedores.map(v => {
        const comisVend = comisiones.filter(c => c.vendedorId === v.id);
        const pendVend = comisVend.filter(c => c.estado === 'Pendiente').reduce((s, c) => s + c.montoComision, 0);
        const baseLabels = { venta_total: 'Venta total', precio_base: 'Precio base', utilidad: 'Utilidad' };
        const baseLabel = baseLabels[v.baseComision] || 'Precio base';
        return `<tr>
          <td style="padding:10px;">${v.nombre}</td>
          <td style="padding:10px;text-align:center;">${v.telefono || '-'}</td>
          <td style="padding:10px;text-align:center;">${v.porcentajeComision || 0}%</td>
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
      <div id="sugerenciasRecuperacionArea" style="margin-bottom:20px;"></div>
      <div style="background:white;padding:20px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h3 style="margin:0;color:#0f172a;">💵 Anticipos de Comisión</h3>
        </div>
        <div id="anticiposComisionArea"></div>
      </div>
      <div style="background:white;padding:20px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);margin-bottom:20px;">
        <h3 style="margin:0 0 16px;color:#7c3aed;">📊 Reporte de Comisiones por Período</h3>
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;margin-bottom:16px;">
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">DESDE</label><br>
            <input type="date" id="fechaDesdeComision" value="${primerDiaMes}" style="padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">HASTA</label><br>
            <input type="date" id="fechaHastaComision" value="${hoyStr}" style="padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
          </div>
          <button onclick="calcularComisionesFiltradas()" style="padding:10px 18px;background:#7c3aed;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">📊 Calcular</button>
        </div>
        <div id="reporteComisionesArea"></div>
      </div>`;
    renderSugerenciasRecuperacionCartera();
    renderAnticiposComision();
}
// ===== SUGERENCIAS: RECUPERACIÓN DE CARTERA EN ATRASO =====
// El vendedor solo cobra comisión por venta (al cierre). Cuando una cuenta que
// estuvo en atraso termina saldándose, el sistema SUGIERE aquí una posible
// comisión extra por la gestión de cobranza, pero no la calcula ni la aplica
// de forma automática: el admin decide si otorgarla y por cuánto.
function obtenerSugerenciasRecuperacionCartera(diasGracia = 3) {
    const cuentas = StorageService.get('cuentasPorCobrar', []);
    const pagares = StorageService.get('pagaresSistema', []);
    const comisiones = StorageService.get('comisionesRegistradas', []);
    const descartadas = StorageService.get('sugerenciasComisionDescartadas', []);
    const vendedores = StorageService.get('vendedores', []);

    const sugerencias = [];
    cuentas.forEach(c => {
        if (String(c.estado || '').toLowerCase() !== 'saldado') return;
        if (!c.vendedorId) return;
        const abonos = c.abonos || [];
        if (abonos.length === 0) return;

        let ultimoAbono = null;
        let ultimoAbonoMs = 0;
        abonos.forEach(ab => {
            const ms = new Date(ab.fechaAbonoIso || ab.fecha || 0).getTime();
            if (ms > ultimoAbonoMs) { ultimoAbonoMs = ms; ultimoAbono = ab; }
        });
        if (!ultimoAbono || !ultimoAbonoMs) return;

        const pagaresCuenta = pagares.filter(p => String(p.folio) === String(c.folio));
        if (pagaresCuenta.length === 0) return;
        const ultimoVencimiento = Math.max(...pagaresCuenta.map(p => Number(p.fechaVencimiento || 0)));
        if (!ultimoVencimiento) return;

        const diasAtraso = Math.floor((ultimoAbonoMs - ultimoVencimiento) / 86400000);
        if (diasAtraso <= diasGracia) return; // se pagó a tiempo o con poca demora

        if (descartadas.includes(c.folio)) return;
        if (comisiones.some(cm => cm.tipo === 'recuperacion_cartera' && cm.folio === c.folio)) return;

        const v = vendedores.find(x => String(x.id) === String(c.vendedorId));
        sugerencias.push({
            folio: c.folio,
            clienteNombre: c.nombre || '',
            vendedorId: c.vendedorId,
            vendedorNombre: v ? v.nombre : (c.vendedorNombre || 'Vendedor'),
            diasAtraso,
            fechaRecuperacion: ultimoAbono.fecha || ultimoAbono.fechaAbonoIso || ''
        });
    });
    return sugerencias.sort((a, b) => b.diasAtraso - a.diasAtraso);
}

function renderSugerenciasRecuperacionCartera() {
    const cont = document.getElementById('sugerenciasRecuperacionArea');
    if (!cont) return;
    const sugerencias = obtenerSugerenciasRecuperacionCartera();
    if (sugerencias.length === 0) { cont.innerHTML = ''; return; }

    const filas = sugerencias.map(s => `
      <tr>
        <td style="padding:8px;">${s.vendedorNombre}</td>
        <td style="padding:8px;">${s.folio}</td>
        <td style="padding:8px;">${s.clienteNombre}</td>
        <td style="padding:8px;text-align:center;color:#b45309;font-weight:bold;">${s.diasAtraso} días</td>
        <td style="padding:8px;">${s.fechaRecuperacion}</td>
        <td style="padding:8px;text-align:center;display:flex;gap:6px;justify-content:center;">
          <button onclick="otorgarComisionRecuperacion('${s.folio}', ${s.vendedorId})" style="padding:6px 10px;background:#16a34a;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">➕ Dar comisión</button>
          <button onclick="descartarSugerenciaRecuperacion('${s.folio}')" style="padding:6px 10px;background:#e5e7eb;color:#4b5563;border:none;border-radius:4px;cursor:pointer;font-size:12px;">🚫 Descartar</button>
        </td>
      </tr>`).join('');

    cont.innerHTML = `
      <div style="background:#fffbeb;border:1px solid #fde68a;padding:20px;border-radius:10px;">
        <h3 style="margin:0 0 6px;color:#b45309;">💡 Sugerencias: recuperación de cartera en atraso</h3>
        <p style="margin:0 0 14px;font-size:13px;color:#92400e;">Estas cuentas se saldaron después de estar en atraso. No se otorga comisión automáticamente: revisa y decide si aplica un extra por la gestión de cobranza.</p>
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="background:#fef3c7;">
              <th style="padding:8px;text-align:left;">Vendedor</th>
              <th style="padding:8px;text-align:left;">Folio</th>
              <th style="padding:8px;text-align:left;">Cliente</th>
              <th style="padding:8px;text-align:center;">Días de atraso</th>
              <th style="padding:8px;text-align:left;">Recuperada el</th>
              <th style="padding:8px;text-align:center;">Acción</th>
            </tr></thead>
            <tbody>${filas}</tbody>
          </table>
        </div>
      </div>`;
}

function otorgarComisionRecuperacion(folio, vendedorId) {
    const vendedores = StorageService.get('vendedores', []);
    const v = vendedores.find(x => String(x.id) === String(vendedorId));
    if (!v) return;
    const entrada = prompt(`Monto de comisión extra por recuperar la cuenta ${folio} (se redondeará al siguiente 10):`, '');
    if (entrada === null) return;
    const monto = _redondearComisionSiguienteDiez(parseFloat(entrada) || 0);
    if (monto <= 0) return alert('⚠️ Ingresa un monto válido.');
    const comisiones = StorageService.get('comisionesRegistradas', []);
    comisiones.push({
        id: Date.now(),
        vendedorId: v.id,
        vendedorNombre: v.nombre,
        folio,
        totalVenta: 0,
        montoComision: monto,
        fecha: Date.now(),
        tipo: 'recuperacion_cartera',
        estado: 'Pendiente'
    });
    StorageService.set('comisionesRegistradas', comisiones);
    renderGestionVendedores();
}

function descartarSugerenciaRecuperacion(folio) {
    const descartadas = StorageService.get('sugerenciasComisionDescartadas', []);
    if (!descartadas.includes(folio)) descartadas.push(folio);
    StorageService.set('sugerenciasComisionDescartadas', descartadas);
    renderSugerenciasRecuperacionCartera();
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

// Suma el costo de mercancía de una lista de artículos vendidos, buscando el
// costo unitario en el catálogo de productos (costo | costoPromedio | precioCompra).
function calcularCostoMercanciaVenta(articulos, listaProductos) {
    if (!Array.isArray(articulos) || articulos.length === 0) return 0;
    const productos = Array.isArray(listaProductos) ? listaProductos : (window.productos || []);
    return articulos.reduce((sum, art) => {
        const prodId = art.productoId ?? art.id;
        const prod = productos.find(p => String(p.id) === String(prodId));
        const costoUnit = Number(prod?.costo ?? prod?.costoPromedio ?? prod?.precioCompra ?? 0);
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
    const montoComision = _redondearComisionSiguienteDiez(montoComisionCalculado);
    if (montoComision <= 0) return;
    const comisiones = StorageService.get('comisionesRegistradas', []);
    comisiones.push({
        id: Date.now(),
        vendedorId: v.id,
        vendedorNombre: v.nombre,
        folio,
        totalVenta: totalContado,
        baseComision: v.baseComision || 'precio_base',
        montoBaseComision: montoBase,
        montoComisionSinRedondeo: montoComisionCalculado,
        montoComision,
        fecha: Date.now(),
        tipo: 'al_cierre',
        estado: 'Pendiente'
    });
    StorageService.set('comisionesRegistradas', comisiones);
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
        const fechaC = new Date(c.fecha);
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

function calcularComisionesFiltradas() {
    const fechaDesde = document.getElementById('fechaDesdeComision')?.value;
    const fechaHasta = document.getElementById('fechaHastaComision')?.value;
    renderReporteComisiones(fechaDesde, fechaHasta);
}

function renderReporteComisiones(fechaDesde, fechaHasta) {
    const cont = document.getElementById('reporteComisionesArea');
    if (!cont) return;
    const vendedores = StorageService.get('vendedores', []);
    const comisiones = StorageService.get('comisionesRegistradas', []);

    if (comisiones.length === 0) {
        cont.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:20px;">No hay comisiones registradas.</p>';
        return;
    }

    const _escHtml = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    // Summary per vendor — incluye el neto por pagar tras restar anticipos
    // sin liquidar (comisiones no pagadas - anticipos pendientes = por pagar).
    const resumenRows = vendedores.map(v => {
        const liq = calcularLiquidacionVendedor(v.id, fechaDesde, fechaHasta);
        if (liq.numVentas === 0 && liq.anticipoPendiente <= 0) return '';
        const fDesdeEsc = _escHtml(fechaDesde || '');
        const fHastaEsc = _escHtml(fechaHasta || '');
        const hayAlgoQueLiquidar = liq.pendiente > 0 || liq.anticipoPendiente > 0;
        return `<tr>
          <td style="padding:10px;">${_escHtml(v.nombre)}</td>
          <td style="padding:10px;text-align:center;">${liq.numVentas}</td>
          <td style="padding:10px;text-align:right;">${dinero(liq.totalVendido)}</td>
          <td style="padding:10px;text-align:right;color:#d97706;">${dinero(liq.pendiente)}</td>
          <td style="padding:10px;text-align:right;color:#dc2626;">${liq.anticipoPendiente > 0 ? '- ' + dinero(liq.anticipoPendiente) : dinero(0)}</td>
          <td style="padding:10px;text-align:right;font-weight:bold;color:${liq.porPagar > 0 ? '#7c3aed' : '#16a34a'};">${dinero(liq.porPagar)}</td>
          <td style="padding:10px;text-align:right;color:#16a34a;">${dinero(liq.pagada)}</td>
          <td style="padding:10px;text-align:center;">
            ${hayAlgoQueLiquidar ? `<button onclick="abrirModalLiquidacionComisiones(${v.id}, '${fDesdeEsc}', '${fHastaEsc}')" style="padding:6px 12px;background:#7c3aed;color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px;">🧮 Liquidar</button>` : '<span style="color:#16a34a;">✅ Al día</span>'}
          </td>
        </tr>`;
    }).filter(r => r !== '').join('');

    // Detail rows (most recent first)
    const desde = fechaDesde ? new Date(fechaDesde + 'T00:00:00') : null;
    const hasta = fechaHasta ? new Date(fechaHasta + 'T23:59:59') : null;
    const filtradas = comisiones.filter(c => {
        const f = new Date(c.fecha);
        if (desde && f < desde) return false;
        if (hasta && f > hasta) return false;
        return true;
    }).slice().reverse();

    const detalleRows = filtradas.map(c => `<tr>
      <td style="padding:8px;">${_escHtml(c.vendedorNombre)}</td>
      <td style="padding:8px;">${_escHtml(c.folio)}</td>
      <td style="padding:8px;text-align:right;">${dinero(c.totalVenta)}</td>
      <td style="padding:8px;text-align:right;font-weight:bold;">${dinero(c.montoComision)}</td>
      <td style="padding:8px;">${new Date(c.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Mexico_City'})}</td>
      <td style="padding:8px;text-align:center;font-size:12px;color:#6b7280;">${c.tipo === 'recuperacion_cartera' ? '💡 Recuperación' : (c.tipo === 'por_abono' ? 'Por abono' : 'Al cierre')}</td>
      <td style="padding:8px;text-align:center;"><span style="color:${c.estado === 'Pendiente' ? '#d97706' : '#16a34a'};font-weight:bold;">${c.estado === 'Pendiente' ? 'Pendiente' : 'Pagada'}</span></td>
    </tr>`).join('');

    cont.innerHTML = `
      <div style="overflow-x:auto;margin-bottom:20px;">
        <h4 style="color:#7c3aed;margin:0 0 10px;">Resumen por Vendedor</h4>
        <p style="margin:0 0 10px;font-size:12px;color:#6b7280;">Por pagar = comisiones no pagadas del período menos anticipos de comisión sin liquidar (saldo vigente del vendedor, sin importar su fecha).</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead><tr style="background:#f3f4f6;">
            <th style="padding:10px;text-align:left;">Vendedor</th>
            <th style="padding:10px;text-align:center;">Registros</th>
            <th style="padding:10px;text-align:right;">Total Vendido</th>
            <th style="padding:10px;text-align:right;">Comisiones no pagadas</th>
            <th style="padding:10px;text-align:right;">Anticipos pendientes</th>
            <th style="padding:10px;text-align:right;">Por pagar</th>
            <th style="padding:10px;text-align:right;">Pagada</th>
            <th style="padding:10px;text-align:center;">Acción</th>
          </tr></thead>
          <tbody>${resumenRows || '<tr><td colspan="8" style="padding:16px;text-align:center;color:#9ca3af;">Sin registros en este período</td></tr>'}</tbody>
        </table>
      </div>
      <div style="overflow-x:auto;">
        <h4 style="color:#7c3aed;margin:0 0 10px;">Detalle de Comisiones</h4>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="background:#f3f4f6;">
            <th style="padding:8px;text-align:left;">Vendedor</th>
            <th style="padding:8px;text-align:left;">Folio</th>
            <th style="padding:8px;text-align:right;">Venta/Abono</th>
            <th style="padding:8px;text-align:right;">Comisión</th>
            <th style="padding:8px;text-align:left;">Fecha</th>
            <th style="padding:8px;text-align:center;">Tipo</th>
            <th style="padding:8px;text-align:center;">Estado</th>
          </tr></thead>
          <tbody>${detalleRows || '<tr><td colspan="7" style="padding:16px;text-align:center;color:#9ca3af;">Sin registros en este período</td></tr>'}</tbody>
        </table>
      </div>`;
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
            const f = new Date(c.fecha);
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
            .sort((x, y) => new Date(x.a.fecha) - new Date(y.a.fecha));
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
    if (desde || hasta) renderReporteComisiones(desde, hasta);
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
    const rows = anticipos.slice().sort((x, y) => new Date(y.fecha) - new Date(x.fecha)).map(a => {
        const saldo = _anticipoSaldoPendiente(a);
        return `<tr>
          <td style="padding:8px;">${_vendEsc(a.vendedorNombre)}</td>
          <td style="padding:8px;text-align:right;">${dinero(a.monto)}</td>
          <td style="padding:8px;text-align:right;font-weight:bold;color:${saldo > 0 ? '#dc2626' : '#16a34a'};">${dinero(saldo)}</td>
          <td style="padding:8px;">${a.fecha ? new Date(a.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Mexico_City' }) : '-'}</td>
          <td style="padding:8px;color:#6b7280;">${_vendEsc(a.cuentaEtiqueta || '-')}</td>
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
window.calcularComisionesVendedor = calcularComisionesVendedor;
window.calcularLiquidacionVendedor = calcularLiquidacionVendedor;
window.calcularComisionesFiltradas = calcularComisionesFiltradas;
window.renderReporteComisiones = renderReporteComisiones;
window.abrirModalLiquidacionComisiones = abrirModalLiquidacionComisiones;
window.ejecutarLiquidacionComisiones = ejecutarLiquidacionComisiones;
window.obtenerSugerenciasRecuperacionCartera = obtenerSugerenciasRecuperacionCartera;
window.renderSugerenciasRecuperacionCartera = renderSugerenciasRecuperacionCartera;
window.otorgarComisionRecuperacion = otorgarComisionRecuperacion;
window.descartarSugerenciaRecuperacion = descartarSugerenciaRecuperacion;
window.abrirModalAnticipoComision = abrirModalAnticipoComision;
window.registrarAnticipoComision = registrarAnticipoComision;
window.abrirModalLiquidarAnticipo = abrirModalLiquidarAnticipo;
window.liquidarAnticipoComision = liquidarAnticipoComision;
window.abrirModalEditarMontoAnticipo = abrirModalEditarMontoAnticipo;
window.guardarEdicionMontoAnticipo = guardarEdicionMontoAnticipo;
window.renderAnticiposComision = renderAnticiposComision;
