// ===== VENDEDORES Y COMISIONES =====

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

    // Summary per vendor
    const resumenRows = vendedores.map(v => {
        const res = calcularComisionesVendedor(v.id, fechaDesde, fechaHasta);
        if (res.numVentas === 0) return '';
        const fDesdeEsc = _escHtml(fechaDesde || '');
        const fHastaEsc = _escHtml(fechaHasta || '');
        return `<tr>
          <td style="padding:10px;">${_escHtml(v.nombre)}</td>
          <td style="padding:10px;text-align:center;">${res.numVentas}</td>
          <td style="padding:10px;text-align:right;">${dinero(res.totalVendido)}</td>
          <td style="padding:10px;text-align:right;font-weight:bold;color:#7c3aed;">${dinero(res.totalComision)}</td>
          <td style="padding:10px;text-align:right;color:#d97706;">${dinero(res.pendiente)}</td>
          <td style="padding:10px;text-align:right;color:#16a34a;">${dinero(res.pagada)}</td>
          <td style="padding:10px;text-align:center;">
            ${res.pendiente > 0 ? `<button onclick="pagarComisionVendedor(${v.id}, '${fDesdeEsc}', '${fHastaEsc}')" style="padding:6px 12px;background:#16a34a;color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px;">✅ Marcar Pagada</button>` : '<span style="color:#16a34a;">✅ Al día</span>'}
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
      <td style="padding:8px;text-align:center;">${c.estado === 'Pendiente' ? `<button onclick="pagarComision(${c.id})" style="padding:4px 10px;background:#16a34a;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">💰 Pagar</button>` : '✅'}</td>
    </tr>`).join('');

    cont.innerHTML = `
      <div style="overflow-x:auto;margin-bottom:20px;">
        <h4 style="color:#7c3aed;margin:0 0 10px;">Resumen por Vendedor</h4>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead><tr style="background:#f3f4f6;">
            <th style="padding:10px;text-align:left;">Vendedor</th>
            <th style="padding:10px;text-align:center;">Registros</th>
            <th style="padding:10px;text-align:right;">Total Vendido</th>
            <th style="padding:10px;text-align:right;">Comisión Total</th>
            <th style="padding:10px;text-align:right;">Pendiente</th>
            <th style="padding:10px;text-align:right;">Pagada</th>
            <th style="padding:10px;text-align:center;">Acción</th>
          </tr></thead>
          <tbody>${resumenRows || '<tr><td colspan="7" style="padding:16px;text-align:center;color:#9ca3af;">Sin registros en este período</td></tr>'}</tbody>
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
            <th style="padding:8px;text-align:center;">Acción</th>
          </tr></thead>
          <tbody>${detalleRows || '<tr><td colspan="8" style="padding:16px;text-align:center;color:#9ca3af;">Sin registros en este período</td></tr>'}</tbody>
        </table>
      </div>`;
}

function pagarComision(id) {
    const comisiones = StorageService.get('comisionesRegistradas', []);
    const idx = comisiones.findIndex(c => c.id === id);
    if (idx === -1) return;
    const c = comisiones[idx];
    comisiones[idx] = { ...c, estado: 'Pagada', fechaPago: window.localISO(new Date()) };
    StorageService.set('comisionesRegistradas', comisiones);
    // Register as egreso in movimientosCaja
    const movimientos = StorageService.get('movimientosCaja', []);
    movimientos.push({
        id: Date.now(),
        folio: c.folio,
        fecha: window.formatearFechaCortaMX(new Date()),
        tipo: 'egreso',
        monto: c.montoComision,
        concepto: `Pago comisión - ${c.vendedorNombre} (${c.folio})`,
        referencia: 'Comisión vendedor',
        cuenta: 'efectivo'
    });
    StorageService.set('movimientosCaja', movimientos);
    const fechaDesde = document.getElementById('fechaDesdeComision')?.value;
    const fechaHasta = document.getElementById('fechaHastaComision')?.value;
    renderGestionVendedores();
    renderReporteComisiones(fechaDesde, fechaHasta);
}

function abrirModalPagoComision(tipo, id, fechaDesde, fechaHasta, monto, nombre) {
    if(monto <= 0) return alert("⚠️ No hay monto pendiente a pagar.");
    
    const modalHTML = `
    <div data-modal="pago-comision" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:8000;display:flex;justify-content:center;align-items:center;">
        <div style="background:white;padding:30px;border-radius:12px;width:90%;max-width:400px;box-shadow:0 10px 25px rgba(0,0,0,0.1);">
            <h2 style="margin-top:0;color:#7c3aed;">💰 Pagar Comisión</h2>
            <p style="color:#4b5563;margin-bottom:20px;">Vendedor: <strong>${nombre}</strong><br>Monto a pagar: <strong style="color:#059669;font-size:18px;">${dinero(monto)}</strong></p>
            
            <div style="margin-bottom:20px;">
                <label style="font-weight:bold;font-size:13px;color:#374151;display:block;margin-bottom:5px;">¿De qué caja/cuenta sale el dinero?</label>
                ${window._buildSelectorCuentas('cuentaPagoComision', false)}
            </div>

            <div style="display:flex;gap:10px;">
                <button onclick="ejecutarPagoComision('${tipo}', ${id}, '${fechaDesde}', '${fechaHasta}', ${monto}, '${nombre}')" style="flex:1;padding:12px;background:#10b981;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">✅ Confirmar Pago</button>
                <button onclick="document.querySelector('[data-modal=&quot;pago-comision&quot;]').remove()" style="flex:1;padding:12px;background:#e5e7eb;color:#4b5563;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">✕ Cancelar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function ejecutarPagoComision(tipo, id, fechaDesde, fechaHasta, monto, nombre) {
    const sel = document.getElementById('cuentaPagoComision');
    const cuentaId = sel.value;
    const etiqueta = sel.options[sel.selectedIndex].text;
    
    // 1. Descontar el dinero usando el Enchufe Universal
    window._egresarCuenta({
        monto: monto, cuentaId: cuentaId, etiqueta: etiqueta,
        concepto: `Pago comisiones - ${nombre}`, referencia: `COMISION-${id}`
    });

    // 2. Marcar comisiones como pagadas
    const comisiones = StorageService.get('comisionesRegistradas', []);
    
    if (tipo === 'individual') {
        const idx = comisiones.findIndex(c => c.id === id);
        if(idx !== -1) comisiones[idx] = { ...comisiones[idx], estado: 'Pagada', fechaPago: window.localISO(new Date()) };
    } else {
        const desde = fechaDesde && fechaDesde !== 'null' ? new Date(fechaDesde + 'T00:00:00') : null;
        const hasta = fechaHasta && fechaHasta !== 'null' ? new Date(fechaHasta + 'T23:59:59') : null;
        comisiones.forEach((c, idx) => {
            if (String(c.vendedorId) === String(id) && c.estado === 'Pendiente') {
                const f = new Date(c.fecha);
                let entra = true;
                if (desde && f < desde) entra = false;
                if (hasta && f > hasta) entra = false;
                if (entra) comisiones[idx] = { ...c, estado: 'Pagada', fechaPago: window.localISO(new Date()) };
            }
        });
    }
    
    StorageService.set('comisionesRegistradas', comisiones);
    document.querySelector('[data-modal="pago-comision"]').remove();
    alert(`✅ Comisión de ${dinero(monto)} pagada correctamente desde ${etiqueta}.`);
    
    renderGestionVendedores();
    if(fechaDesde !== 'null') renderReporteComisiones(fechaDesde, fechaHasta);
}

// Renombrar los botones viejos para que llamen al modal
function pagarComision(id) {
    const c = StorageService.get('comisionesRegistradas', []).find(x => x.id === id);
    if(c) abrirModalPagoComision('individual', id, null, null, c.montoComision, c.vendedorNombre);
}
function pagarComisionVendedor(vendedorId, fechaDesde, fechaHasta) {
    const v = StorageService.get('vendedores', []).find(x => String(x.id) === String(vendedorId));
    const res = calcularComisionesVendedor(vendedorId, fechaDesde, fechaHasta);
    if(v) abrirModalPagoComision('multiple', vendedorId, fechaDesde, fechaHasta, res.pendiente, v.nombre);
}

window.renderGestionVendedores = renderGestionVendedores;
window.abrirFormVendedor = abrirFormVendedor;
window.guardarVendedor = guardarVendedor;
window.editarVendedor = editarVendedor;
window.eliminarVendedor = eliminarVendedor;
window.calcularCostoMercanciaVenta = calcularCostoMercanciaVenta;
window.registrarComisionVenta = registrarComisionVenta;
window.calcularComisionesVendedor = calcularComisionesVendedor;
window.calcularComisionesFiltradas = calcularComisionesFiltradas;
window.renderReporteComisiones = renderReporteComisiones;
window.pagarComision = pagarComision;
window.pagarComisionVendedor = pagarComisionVendedor;
window.obtenerSugerenciasRecuperacionCartera = obtenerSugerenciasRecuperacionCartera;
window.renderSugerenciasRecuperacionCartera = renderSugerenciasRecuperacionCartera;
window.otorgarComisionRecuperacion = otorgarComisionRecuperacion;
window.descartarSugerenciaRecuperacion = descartarSugerenciaRecuperacion;
