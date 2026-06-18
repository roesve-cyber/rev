function _comprasAsegurarArray(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor && Array.isArray(valor.data)) return valor.data;
    if (valor && typeof valor === 'object') {
        return Object.values(valor).filter(x => x && typeof x === 'object' && !Array.isArray(x));
    }
    return [];
}

function _comprasRequireAdmin(accion) {
    if (typeof window.esAdmin === 'function' && window.esAdmin()) return true;
    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'ACCESO_DENEGADO',
            modulo: 'Compras',
            entidad: accion,
            detalle: `Intento sin permisos: ${accion}`,
            severidad: 'alerta'
        });
    }
    alert('Operacion restringida. Solo administrador puede continuar.');
    return false;
}

function _getOrdenesCompra() {
    return _comprasAsegurarArray(StorageService.get('ordenesCompra', []));
}

function _getConsignacionesActivas() {
    return _comprasAsegurarArray(StorageService.get('consignacionesActivas', []));
}

function _consigAbonos(c) {
    return _comprasAsegurarArray(c?.abonos || []);
}

function _consigImporte(c) {
    return Number(c?.total || 0) || (Number(c?.cantidadTotal || 0) * Number(c?.costoUnitario || 0));
}

function _consigPagos(c) {
    return _consigAbonos(c).reduce((s, a) => s + Number(a.monto || 0), 0);
}

function _consigSaldo(c) {
    return Math.max(0, _consigImporte(c) - _consigPagos(c));
}

function _comprasEscHTML(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[ch]));
}

function _comprasEscAttr(valor) {
    return _comprasEscHTML(valor).replace(/`/g, '&#96;');
}

function _comprasHoyInput() {
    return window.obtenerHoyInputMX
        ? window.obtenerHoyInputMX()
        : (window.getFechaLocalMX ? window.getFechaLocalMX(new Date()) : new Date().toISOString().split('T')[0]);
}

function _comprasFechaVista(fecha, fallback = '-') {
    if (window.formatearFechaVistaMX) return window.formatearFechaVistaMX(fecha, { fallback });
    if (window.formatearFechaCortaMX) return window.formatearFechaCortaMX(fecha);
    const d = fecha instanceof Date ? fecha : new Date(fecha);
    return isNaN(d.getTime()) ? fallback : d.toLocaleDateString('es-MX');
}

function _consigProveedorKey(c) {
    const proveedorId = c?.proveedorId;
    if (proveedorId !== undefined && proveedorId !== null && String(proveedorId).trim()) {
        return `id:${encodeURIComponent(String(proveedorId).trim())}`;
    }
    const nombre = String(c?.proveedor || 'SIN PROVEEDOR').trim().toUpperCase();
    return `nom:${encodeURIComponent(nombre || 'SIN PROVEEDOR')}`;
}

function _consigFolioLabel(c) {
    return String(c?.folioOrigen || c?.folio || c?.ordenCompraFolio || c?.compraFolio || c?.compraId || c?.consignacionId || c?.id || 'SIN FOLIO').trim() || 'SIN FOLIO';
}

function _consigFolioKeyFromParts(proveedorKey, folio) {
    return `${proveedorKey}|folio:${encodeURIComponent(String(folio || 'SIN FOLIO').trim() || 'SIN FOLIO')}`;
}

function _consigFolioKey(c) {
    return _consigFolioKeyFromParts(_consigProveedorKey(c), _consigFolioLabel(c));
}

function _getAnticiposConsignacion() {
    return _comprasAsegurarArray(StorageService.get('anticiposConsignacion', []));
}

function _registrarAnticipoConsignacionGlobal({ monto, cuentaId = null, cuenta = '', proveedor = '', proveedorId = null, fecha = '', nota = '', referencia = '', origen = 'ordenCompra', folioKey = null, folioOrigen = null, consignacionId = null }) {
    const valor = Number(monto || 0);
    if (valor <= 0.01) return false;
    const ref = String(referencia || '').trim();
    const anticipos = _getAnticiposConsignacion();
    if (ref && anticipos.some(a => String(a.referencia || a.idOperacion || '') === ref)) return false;
    const fechaFinal = fecha || (window.localISO ? window.localISO(new Date()) : new Date().toISOString());
    anticipos.push({
        id: Date.now() + Math.random(),
        fecha: fechaFinal,
        fechaStr: window.formatearFechaCortaMX ? window.formatearFechaCortaMX(new Date(fechaFinal)) : String(fechaFinal).slice(0, 10),
        monto: valor,
        cuentaId,
        cuenta,
        nota,
        proveedor,
        proveedorId,
        proveedorKey: _consigProveedorKey({ proveedor, proveedorId }),
        folioKey,
        folioOrigen,
        consignacionId,
        aplicado: 0,
        referencia: ref,
        origen
    });
    StorageService.set('anticiposConsignacion', anticipos);
    return true;
}

function _consigAnticiposDesdePagosOC(consignaciones, anticiposBase = []) {
    const folios = new Map();
    consignaciones.forEach(c => {
        const folio = _consigFolioLabel(c);
        if (!folio || folio === 'SIN FOLIO') return;
        if (!folios.has(folio)) folios.set(folio, c);
    });
    if (!folios.size) return [];

    const firma = (folio, fecha, monto, cuenta) => `${folio}|${String(fecha || '').slice(0, 19)}|${Number(monto || 0).toFixed(2)}|${String(cuenta || '').trim().toUpperCase()}`;
    const yaRegistrados = new Set(anticiposBase.map(a => firma(a.folioOrigen || a.folio, a.fecha, a.monto, a.cuenta || a.etiquetaCuenta || a.cuentaId)));
    const firmasOC = new Set();
    const resultado = [];

    _getOrdenesCompra().forEach(oc => {
        const folio = String(oc.folio || '').trim();
        if (!folios.has(folio)) return;
        const pagos = _comprasAsegurarArray(oc.pagos || []);
        const base = folios.get(folio);
        pagos.forEach((p, index) => {
            const monto = Number(p.monto || 0);
            if (monto <= 0.01) return;
            const cuenta = p.cuenta || p.etiquetaCuenta || p.cuentaId || 'Pago OC';
            const sig = firma(folio, p.fecha, monto, cuenta);
            firmasOC.add(sig);
            if (yaRegistrados.has(sig)) return;
            resultado.push({
                id: `OC-PAGO-${oc.id || folio}-${index}`,
                fecha: p.fecha || oc.fechaEmision || '',
                fechaStr: p.fechaStr || (p.fecha && window.formatearFechaCortaMX ? window.formatearFechaCortaMX(new Date(p.fecha)) : ''),
                monto,
                cuenta,
                proveedor: oc.proveedorNombre || base.proveedor,
                proveedorId: oc.proveedorId || base.proveedorId || null,
                proveedorKey: _consigProveedorKey({ proveedor: oc.proveedorNombre || base.proveedor, proveedorId: oc.proveedorId || base.proveedorId || null }),
                folioOrigen: folio,
                folioKey: _consigFolioKey(base),
                consignacionId: base.consignacionId || base.id,
                referencia: `OC-PAGO-${oc.id || folio}-${index}`,
                origen: 'ordenCompraPago',
                legadoOC: true
            });
        });
    });

    _comprasAsegurarArray(StorageService.get('movimientosCaja', [])).forEach((m, index) => {
        const monto = Number(m.monto || 0);
        if (monto <= 0.01 || String(m.tipo || '').toLowerCase() !== 'egreso') return;
        const texto = `${m.concepto || ''} ${m.referencia || ''} ${m.idOperacion || ''}`;
        const folio = Array.from(folios.keys()).find(f => texto.includes(f));
        if (!folio) return;
        const cuenta = m.etiquetaCuenta || m.cuenta || m.medioPago || 'Movimiento caja';
        const sig = firma(folio, m.fecha, monto, cuenta);
        if (firmasOC.has(sig) || yaRegistrados.has(sig)) return;
        const base = folios.get(folio);
        resultado.push({
            id: `MOV-OC-${m.id || index}`,
            fecha: m.fecha || '',
            fechaStr: m.fecha && window.formatearFechaCortaMX ? window.formatearFechaCortaMX(new Date(m.fecha)) : '',
            monto,
            cuenta,
            proveedor: base.proveedor,
            proveedorId: base.proveedorId || null,
            proveedorKey: _consigProveedorKey(base),
            folioOrigen: folio,
            folioKey: _consigFolioKey(base),
            consignacionId: base.consignacionId || base.id,
            referencia: m.referencia || `MOV-OC-${index}`,
            origen: 'movimientoCajaOC',
            legadoMovimiento: true
        });
    });

    return resultado;
}

function _consigAnticiposLegado(c) {
    return _consigAbonos(c).map(a => ({
        ...a,
        proveedor: c?.proveedor || '',
        proveedorId: c?.proveedorId || null,
        proveedorKey: _consigProveedorKey(c),
        folioOrigen: _consigFolioLabel(c),
        folioKey: _consigFolioKey(c),
        consignacionId: c?.consignacionId || c?.id,
        producto: c?.producto || '',
        legado: true
    }));
}

function _consigEsAnticipoAplicado(abono) {
    const txt = `${abono?.cuenta || ''} ${abono?.nota || ''} ${abono?.concepto || ''}`.toUpperCase();
    // Atrapa cualquier variación para evitar descuadres entre Anticipos y Pagos Reales
    return txt.includes('ANTICIPO') || txt.includes('SALDO A FAVOR');
}

function _consigCuentasRelacionadas(consignaciones) {
    const ids = new Set(consignaciones.map(c => String(c.consignacionId || c.id)));
    const proveedores = new Set(consignaciones.map(_consigProveedorKey));
    return _comprasAsegurarArray(StorageService.get('cuentasPorPagar', []))
        .filter(cxp => {
            if (cxp?.origenConsignacion) return true;
            if (cxp?.consignacionId && ids.has(String(cxp.consignacionId))) return true;
            return proveedores.has(_consigProveedorKey(cxp));
        });
}

function _consigResumenGlobal() {
    const consignaciones = _getConsignacionesActivas();
    const anticiposNuevos = _getAnticiposConsignacion();
    const anticiposLegado = consignaciones.flatMap(_consigAnticiposLegado);
    const anticiposDesdeOC = _consigAnticiposDesdePagosOC(consignaciones, [...anticiposLegado, ...anticiposNuevos]);
    const anticipos = [...anticiposLegado, ...anticiposNuevos, ...anticiposDesdeOC];
    const cuentasCxp = _consigCuentasRelacionadas(consignaciones);
    const grupos = new Map();
    const folios = new Map();

    const ensure = (key, base = {}) => {
        if (!grupos.has(key)) {
            grupos.set(key, {
                key,
                proveedor: base.proveedor || 'Proveedor',
                proveedorId: base.proveedorId || null,
                consignaciones: [],
                anticipos: [],
                cuentasCxp: [],
                compraOriginal: 0,
                inventarioPendiente: 0,
                vendidoReportado: 0,
                transferidoCxp: 0,
                saldoCxp: 0,
                pagadoPorVentas: 0,
                anticiposAplicados: 0,
                anticiposAplicadosCxp: 0,
                anticiposTotal: 0,
                saldoNeto: 0,
                folios: []
            });
        }
        return grupos.get(key);
    };

    const ensureFolio = (base = {}) => {
        const proveedorKey = base.proveedorKey || _consigProveedorKey(base);
        const folioOrigen = base.folioOrigen || base.folio || _consigFolioLabel(base);
        const key = base.folioKey || _consigFolioKeyFromParts(proveedorKey, folioOrigen);
        if (!folios.has(key)) {
            folios.set(key, {
                key,
                proveedorKey,
                proveedor: base.proveedor || 'Proveedor',
                proveedorId: base.proveedorId || null,
                folioOrigen,
                consignaciones: [],
                anticipos: [],
                cuentasCxp: [],
                compraOriginal: 0,
                inventarioPendiente: 0,
                vendidoReportado: 0,
                pagadoPorVentas: 0,
                anticiposTotal: 0,
                anticiposAplicados: 0,
                anticiposAplicadosCxp: 0,
                saldoNeto: 0
            });
        }
        return folios.get(key);
    };

    const consignacionPorId = new Map();

    consignaciones.forEach(c => {
        const key = _consigProveedorKey(c);
        const g = ensure(key, c);
        const f = ensureFolio(c);
        consignacionPorId.set(String(c.consignacionId || c.id), c);
        g.consignaciones.push(c);
        g.compraOriginal += _consigImporte(c);
        g.inventarioPendiente += Number(c.cantidadPendiente || 0) * Number(c.costoUnitario || 0);
        g.vendidoReportado += Number(c.montoVendidoReportado || 0);
        g.transferidoCxp += Number(c.montoTransferido || 0);
        g.anticiposAplicados += Number(c.montoAbonosAplicados || 0);

        f.consignaciones.push(c);
        f.compraOriginal += _consigImporte(c);
        f.inventarioPendiente += Number(c.cantidadPendiente || 0) * Number(c.costoUnitario || 0);
        f.vendidoReportado += Number(c.montoVendidoReportado || 0);
        f.anticiposAplicados += Number(c.montoAbonosAplicados || 0);
    });

    anticipos.forEach(a => {
        const key = a.proveedorKey || _consigProveedorKey(a);
        const g = ensure(key, a);
        const monto = Number(a.monto || 0);
        g.anticipos.push(a);
        g.anticiposTotal += monto;

        let folioKey = a.folioKey || '';
        if (!folioKey && a.consignacionId && consignacionPorId.has(String(a.consignacionId))) {
            folioKey = _consigFolioKey(consignacionPorId.get(String(a.consignacionId)));
        }
        if (!folioKey && (a.folioOrigen || a.folio)) {
            folioKey = _consigFolioKeyFromParts(key, a.folioOrigen || a.folio);
        }
        if (folioKey) {
            const f = ensureFolio({ ...a, proveedorKey: key, folioKey, folioOrigen: a.folioOrigen || a.folio || 'SIN FOLIO' });
            f.anticipos.push(a);
            f.anticiposTotal += monto;
        }
    });

    cuentasCxp.forEach(cxp => {
        const key = _consigProveedorKey(cxp);
        const g = ensure(key, cxp);
        const abonos = _comprasAsegurarArray(cxp.abonos || []);
        g.cuentasCxp.push(cxp);
        g.saldoCxp += Number(cxp.saldoPendiente || 0);
        abonos.forEach(a => {
            const monto = Number(a.monto || 0);
            if (_consigEsAnticipoAplicado(a)) g.anticiposAplicadosCxp += monto;
            else g.pagadoPorVentas += monto;
        });

        let folioKey = cxp.folioConsignacionKey || cxp.folioKey || '';
        if (!folioKey && cxp.consignacionId && consignacionPorId.has(String(cxp.consignacionId))) {
            folioKey = _consigFolioKey(consignacionPorId.get(String(cxp.consignacionId)));
        }
        if (!folioKey && (cxp.folioOrigen || cxp.folioReporteConsignacion)) {
            folioKey = _consigFolioKeyFromParts(key, cxp.folioOrigen || cxp.folioReporteConsignacion);
        }
        if (folioKey) {
            const f = ensureFolio({ ...cxp, proveedorKey: key, folioKey, folioOrigen: cxp.folioOrigen || cxp.folioReporteConsignacion || 'SIN FOLIO' });
            f.cuentasCxp.push(cxp);
            abonos.forEach(a => {
                const monto = Number(a.monto || 0);
                if (_consigEsAnticipoAplicado(a)) f.anticiposAplicadosCxp += monto;
                else f.pagadoPorVentas += monto;
            });
        }
    });

    folios.forEach(f => {
        f.anticiposAplicados = Math.max(Number(f.anticiposAplicados || 0), Number(f.anticiposAplicadosCxp || 0));
        f.anticiposDisponibles = Math.max(0, Number(f.anticiposTotal || 0) - Number(f.anticiposAplicados || 0));
        f.creditoAnticipos = Math.max(Number(f.anticiposTotal || 0), Number(f.anticiposAplicados || 0));
        f.saldoNeto = Math.max(0, f.compraOriginal - f.pagadoPorVentas - f.creditoAnticipos);
    });

    grupos.forEach(g => {
        g.anticiposAplicados = Math.max(Number(g.anticiposAplicados || 0), Number(g.anticiposAplicadosCxp || 0));
        g.anticiposDisponibles = Math.max(0, Number(g.anticiposTotal || 0) - Number(g.anticiposAplicados || 0));
        g.creditoAnticipos = Math.max(Number(g.anticiposTotal || 0), Number(g.anticiposAplicados || 0));
        g.saldoNeto = Math.max(0, g.compraOriginal - g.pagadoPorVentas - g.creditoAnticipos);
        g.folios = Array.from(folios.values())
            .filter(f => f.proveedorKey === g.key)
            .sort((a, b) => String(a.folioOrigen).localeCompare(String(b.folioOrigen)));
    });

    return {
        consignaciones,
        anticipos,
        cuentasCxp,
        folios: Array.from(folios.values()).sort((a, b) => String(a.proveedor).localeCompare(String(b.proveedor)) || String(a.folioOrigen).localeCompare(String(b.folioOrigen))),
        grupos: Array.from(grupos.values()).sort((a, b) => String(a.proveedor).localeCompare(String(b.proveedor)))
    };
}

// === AUDITORÍA: VISUALIZAR HISTORIAL DE COSTOS ===
function renderHistorialCostosAuditoria() {
    // Obtener productos
    let productos = [];
    try {
        productos = StorageService.get('productos', []);
    } catch (e) { productos = []; }
    const cont = document.getElementById('contenedorHistorialCostosAuditoria');
    if (!cont) return;
    // Selector de producto (picker dinámico)
    let html = `<div style="margin-bottom:18px;display:flex;align-items:center;gap:10px;">
        <label style='font-weight:bold;white-space:nowrap;'>Producto:</label>
        <input type="hidden" id="selectProductoHistorialCostos" value="">
        <span id="selectProductoHistorialCostos-display"
              style="flex:1;padding:7px 12px;font-size:15px;border:1px solid #d1d5db;border-radius:6px;background:#f9fafb;color:#6b7280;">Sin seleccionar</span>
        <button type="button"
                onclick="abrirSelectorProducto({titulo:'🔍 Seleccionar Producto',incluirInactivos:true,onSeleccion:function(p){
                    document.getElementById('selectProductoHistorialCostos').value=p.id;
                    var d=document.getElementById('selectProductoHistorialCostos-display');
                    d.textContent=p.nombre; d.style.color='#111827';
                    mostrarTablaHistorialCostos(p.id);
                }})"
                style="padding:7px 14px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;white-space:nowrap;font-size:14px;">
            🔍 Buscar
        </button>
    </div>
    <div id='tablaHistorialCostos'></div>`;
    cont.innerHTML = html;
    // El picker llama directamente a mostrarTablaHistorialCostos al seleccionar
}

function mostrarTablaHistorialCostos(productoId) {
    const tablaDiv = document.getElementById('tablaHistorialCostos');
    if (!productoId) { tablaDiv.innerHTML = ''; return; }
    const historial = obtenerHistorialCostosPorProducto(productoId);
    if (!historial.length) {
        tablaDiv.innerHTML = `<div style='color:#64748b;padding:12px;'>No hay historial de costos para este producto.</div>`;
        return;
    }
    let html = `<table style='width:100%;border-collapse:collapse;margin-top:10px;'>
        <thead><tr style='background:#f3f4f6;'>
            <th style='padding:8px;text-align:left;'>Fecha</th>
            <th style='padding:8px;text-align:right;'>Precio</th>
            <th style='padding:8px;text-align:right;'>Cantidad</th>
            <th style='padding:8px;text-align:left;'>Proveedor</th>
            <th style='padding:8px;text-align:left;'>Origen</th>
        </tr></thead><tbody>`;
    historial.slice().reverse().forEach(item => {
        html += `<tr>
            <td style='padding:7px 8px;border-bottom:1px solid #e5e7eb;'>${item.fecha}</td>
            <td style='padding:7px 8px;border-bottom:1px solid #e5e7eb;text-align:right;'>$${item.precioCompra}</td>
            <td style='padding:7px 8px;border-bottom:1px solid #e5e7eb;text-align:right;'>${item.cantidad}</td>
            <td style='padding:7px 8px;border-bottom:1px solid #e5e7eb;'>${item.proveedorNombre}</td>
            <td style='padding:7px 8px;border-bottom:1px solid #e5e7eb;'>${item.origen}</td>
        </tr>`;
    });
    html += '</tbody></table>';
    tablaDiv.innerHTML = html;
}
/**
 * Obtiene el historial de costos de un producto por su ID.
 * @param {number|string} productoId
 * @returns {Array} Historial de costos del producto
 */
function obtenerHistorialCostosPorProducto(productoId) {
    const historial = _comprasAsegurarArray(StorageService.get('historialCostos', []));
    return historial.filter(item => String(item.productoId) === String(productoId));
}

// Ejemplo de uso: mostrar historial en consola
// Llama a esta función pasando el ID del producto que deseas consultar
function mostrarHistorialCostosEnConsola(productoId) {
    const historial = obtenerHistorialCostosPorProducto(productoId);
    if (historial.length === 0) {
        console.log('No hay historial de costos para este producto.');
        return;
    }
    console.log('Historial de costos para producto', productoId);
    historial.forEach(item => {
        console.log(`Fecha: ${item.fecha} | Precio: $${item.precioCompra} | Cantidad: ${item.cantidad} | Proveedor: ${item.proveedorNombre} | Origen: ${item.origen}`);
    });
}
// ===== CONTROL DE COSTOS =====
/** Guarda el historial de costos de productos en localStorage y Firebase. */
function guardarHistorialCosto({ productoId, precioCompra, fecha, cantidad, proveedorId, proveedorNombre, origen }) {
    let historial = _comprasAsegurarArray(StorageService.get('historialCostos', []));
    historial.push({
        productoId,
        precioCompra,
        fecha,
        cantidad,
        proveedorId,
        proveedorNombre,
        origen
    });
    StorageService.set('historialCostos', historial);
}
// ===== PROVEEDORES =====

function guardarProveedor() {
    if (!_comprasRequireAdmin('Guardar proveedor')) return;
    const nombreInput   = document.getElementById("provNombre");
    const contactoInput = document.getElementById("provContacto");
    const nombre   = nombreInput.value.trim();
    const contacto = contactoInput.value.trim();

    if (!nombre) return alert("⚠️ El nombre del proveedor es obligatorio.");

    proveedores.push({ id: Date.now(), nombre, contacto, saldoDeuda: 0 });
    if (!StorageService.set("proveedores", proveedores)) {
        alert("❌ Error guardando proveedor");
        return;
    }

    nombreInput.value   = "";
    contactoInput.value = "";
    renderProveedores();
}

function renderProveedores() {
    const cont = document.getElementById("tablaProveedores");
    if (!cont) return;

    if (proveedores.length === 0) {
        cont.innerHTML = "<p style='color:gray; padding:20px;'>No hay proveedores registrados.</p>";
        return;
    }

    let html = `
        <table class="tabla-admin">
            <thead><tr>
                <th>Proveedor</th>
                <th>Contacto</th>
                <th style="text-align:center;">Acciones</th>
            </tr></thead>
            <tbody>`;

    proveedores.forEach(p => {
        html += `
            <tr>
                <td><b>${p.nombre}</b></td>
                <td>${p.contacto || '-'}</td>
                <td style="text-align:center;">
                    <button onclick="eliminarProveedor(${p.id})" style="background:none; border:none; cursor:pointer; font-size:18px;">🗑️</button>
                </td>
            </tr>`;
    });
    cont.innerHTML = html + "</tbody></table>";
}

function eliminarProveedor(id) {
    if (!_comprasRequireAdmin('Eliminar proveedor')) return;
    if (confirm("¿Estás seguro de eliminar este proveedor?")) {
        proveedores = proveedores.filter(p => p.id !== id);
        if (!StorageService.set("proveedores", proveedores)) {
            console.error("❌ Error eliminando proveedor");
            return;
        }
        renderProveedores();
    }
}

// ===== HELPERS FINANCIEROS (ENCHUFE UNIVERSAL) =====

window._buildSelectorCuentas = function(idSelect, soloDebito = false) {
    const cajas = soloDebito ? [] : StorageService.get('cuentasEfectivo', [{ id: 'efectivo', nombre: '💵 Efectivo Principal', saldo: 0 }]);
    
    // 1. LEER FUENTE MAESTRA (Esta nunca se borra ni se desfasa con los respaldos)
    const tarjetas = StorageService.get('tarjetasConfig', []);
    const debito = tarjetas.filter(t => t.tipo === "debito");

    // 2. AUTO-REPARACIÓN DE CACHÉ
    // Si al restaurar el respaldo se perdió la memoria de "cuentas-bancarias",
    // la reconstruimos silenciosamente para que no te vuelva a lanzar el error "no existe".
    let bancarias = StorageService.get("cuentas-bancarias", []);
    if (bancarias.length < debito.length) {
        const reconstruccion = debito.map((t, idx) => ({
            id: `debito_${idx}_${t.banco}`,
            nombre: `🏦 ${t.banco}${t.ultimos4 ? ' ••••' + t.ultimos4 : ''}`,
            tipo: t.tipo,
            banco: t.banco,
            ultimos4: t.ultimos4,
            saldoInicial: t.saldoInicial || 0,
            saldo: 0
        }));
        
        // Rescatamos los saldos de las que sí hayan sobrevivido
        bancarias.forEach(cb => {
            const match = reconstruccion.find(r => r.banco === cb.banco);
            if (match) match.saldo = cb.saldo || 0;
        });
        
        StorageService.set("cuentas-bancarias", reconstruccion);
        bancarias = reconstruccion; // Usamos la lista ya reparada
    }

    // 3. ARMAR EL SELECTOR
    const todas = [...cajas, ...bancarias];
    
    // IMPORTANTE: Extraemos directamente el nombre puro del banco (c.banco) 
    // para que haga match perfecto con las reglas de egreso.
    const opts = todas.map(c => `<option value="${c.banco || c.id}">${c.nombre}</option>`).join('');
    
    return `<select id="${idSelect}" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;box-sizing:border-box;">${opts}</select>`;
};

function _normalizarFechaMovimientoCuenta(fecha) {
    if (!fecha) return window.localISO ? window.localISO(new Date()) : new Date().toISOString();
    if (window.localISO) return window.localISO(fecha);
    const d = new Date(fecha);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function _resolverCuentaMovimiento(cuentaId) {
    let cuentaRealId = (cuentaId === 'caja') ? 'efectivo' : (cuentaId || 'efectivo');
    let isCaja = String(cuentaRealId).startsWith('caja_') || cuentaRealId === 'efectivo';

    if (isCaja) {
        const cuentas = StorageService.get('cuentasEfectivo', []);
        if (cuentas.length === 0 && cuentaRealId === 'efectivo') cuentas.push({ id: 'efectivo', nombre: 'Efectivo Principal', saldo: 0 });
        let idx = cuentas.findIndex(x => String(x.id) === String(cuentaRealId));
        if (idx === -1 && cuentaRealId === 'efectivo' && cuentas.length > 0) {
            idx = 0;
            cuentaRealId = cuentas[0].id;
        }
        return { ok: idx !== -1, tipo: 'efectivo', cuentaRealId, cuentas, idx, medioPago: 'efectivo' };
    }

    const cuentas = StorageService.get('cuentas-bancarias', []);
    const idx = cuentas.findIndex(x => String(x.id) === String(cuentaRealId) || String(x.banco) === String(cuentaRealId));
    return { ok: idx !== -1, tipo: 'banco', cuentaRealId, cuentas, idx, medioPago: 'transferencia' };
}

function _validarMontoMovimientoCuenta(monto, concepto) {
    const montoNum = Number(monto);
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
        console.warn("Movimiento de cuenta rechazado por monto invalido:", { monto, concepto });
        alert("No se registro el movimiento de cuenta porque el importe no es valido.");
        return null;
    }
    return montoNum;
}

function _normalizarMovimientosEfectivoLegacy() {
    const cajas = StorageService.get('cuentasEfectivo', []);
    if (!Array.isArray(cajas) || cajas.length === 0) return;
    if (cajas.some(c => String(c.id) === 'efectivo')) return;

    const cuentaDefault = cajas[0];
    let movs = StorageService.get('movimientosCaja', []);
    if (!Array.isArray(movs) || movs.length === 0) return;

    let cambios = 0;
    movs = movs.map(m => {
        const cuenta = String(m.cuenta || m.cuentaId || '').trim().toLowerCase();
        const etiqueta = String(m.etiquetaCuenta || '').trim().toLowerCase();
        if (cuenta !== 'efectivo' && etiqueta !== 'efectivo') return m;
        cambios++;
        return {
            ...m,
            cuenta: cuentaDefault.id,
            etiquetaCuenta: cuentaDefault.nombre || cuentaDefault.id,
            normalizadoCuentaLegacy: true,
            fechaNormalizacionCuenta: window.localISO ? window.localISO(new Date()) : new Date().toISOString()
        };
    });

    if (cambios > 0) StorageService.set('movimientosCaja', movs);
}

setTimeout(_normalizarMovimientosEfectivoLegacy, 0);

window._egresarCuenta = function({ monto, cuentaId, etiqueta, concepto, referencia, fecha, idOperacion }) {
    const montoNum = _validarMontoMovimientoCuenta(monto, concepto);
    if (montoNum === null) return false;

    const cuenta = _resolverCuentaMovimiento(cuentaId);
    if (!cuenta.ok) {
        console.warn("Egreso rechazado por cuenta inexistente:", { cuentaId, concepto, referencia });
        alert(`No se registro el egreso porque la cuenta "${cuentaId || 'efectivo'}" no existe.`);
        return false;
    }

    if (cuenta.tipo === 'efectivo') {
        cuenta.cuentas[cuenta.idx].saldo = (Number(cuenta.cuentas[cuenta.idx].saldo) || 0) - montoNum;
        StorageService.set('cuentasEfectivo', cuenta.cuentas);
    } else {
        cuenta.cuentas[cuenta.idx].saldo = (Number(cuenta.cuentas[cuenta.idx].saldo) || 0) - montoNum;
        StorageService.set('cuentas-bancarias', cuenta.cuentas);
    }

    const movs = StorageService.get('movimientosCaja', []);
    movs.push({
        id: Date.now() + Math.random(),
        tipo: 'egreso',
        concepto,
        monto: montoNum,
        fecha: _normalizarFechaMovimientoCuenta(fecha),
        cuenta: cuenta.cuentaRealId,
        etiquetaCuenta: etiqueta || cuenta.cuentaRealId,
        medioPago: cuenta.medioPago,
        referencia,
        idOperacion: idOperacion || null
    });
    StorageService.set('movimientosCaja', movs);
    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'EGRESO_CUENTA',
            modulo: 'Finanzas',
            entidad: cuenta.tipo,
            entidadId: cuenta.cuentaRealId,
            detalle: concepto,
            monto: montoNum,
            severidad: 'riesgo',
            datos: { cuentaId, etiqueta: etiqueta || cuenta.cuentaRealId, referencia, idOperacion: idOperacion || null, medioPago: cuenta.medioPago }
        });
    }
    return true;
};
window._ingresarCuenta = function({ monto, cuentaId, etiqueta, concepto, referencia, fecha, idOperacion, grupoConciliacion, referenciaBancaria, foliosGrupo }) {
    const montoNum = _validarMontoMovimientoCuenta(monto, concepto);
    if (montoNum === null) return false;

    const cuenta = _resolverCuentaMovimiento(cuentaId);
    if (!cuenta.ok) {
        console.warn("Ingreso rechazado por cuenta inexistente:", { cuentaId, concepto, referencia });
        alert(`No se registro el ingreso porque la cuenta "${cuentaId || 'efectivo'}" no existe.`);
        return false;
    }

    if (cuenta.tipo === 'efectivo') {
        cuenta.cuentas[cuenta.idx].saldo = (Number(cuenta.cuentas[cuenta.idx].saldo) || 0) + montoNum;
        StorageService.set('cuentasEfectivo', cuenta.cuentas);
    } else {
        cuenta.cuentas[cuenta.idx].saldo = (Number(cuenta.cuentas[cuenta.idx].saldo) || 0) + montoNum;
        StorageService.set('cuentas-bancarias', cuenta.cuentas);
    }

    const movs = StorageService.get('movimientosCaja', []);
    movs.push({
        id: Date.now() + Math.random(),
        tipo: 'ingreso',
        concepto,
        monto: montoNum,
        fecha: _normalizarFechaMovimientoCuenta(fecha),
        cuenta: cuenta.cuentaRealId,
        etiquetaCuenta: etiqueta || cuenta.cuentaRealId,
        medioPago: cuenta.medioPago,
        referencia,
        idOperacion: idOperacion || null,
        grupoConciliacion: grupoConciliacion || '',
        referenciaBancaria: referenciaBancaria || '',
        foliosGrupo: Array.isArray(foliosGrupo) ? foliosGrupo : []
    });
    StorageService.set('movimientosCaja', movs);
    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'INGRESO_CUENTA',
            modulo: 'Finanzas',
            entidad: cuenta.tipo,
            entidadId: cuenta.cuentaRealId,
            detalle: concepto,
            monto: montoNum,
            severidad: 'info',
            datos: { cuentaId, etiqueta: etiqueta || cuenta.cuentaRealId, referencia, idOperacion: idOperacion || null, medioPago: cuenta.medioPago }
        });
    }
    return true;
};

function _getCuentaSeleccionada(sufijo) {
    let sel = document.getElementById(`cuentaOrigen_${sufijo}`) || document.getElementById('compraCuentaOrigen');
    if (!sel) return { medioPago: 'efectivo', cuentaId: 'efectivo', etiqueta: '💵 Efectivo Principal' };
    
    const cuentaId = sel.value;
    const etiqueta = sel.options[sel.selectedIndex]?.text || cuentaId;
    const isCaja = String(cuentaId).startsWith('caja_') || cuentaId === 'efectivo';
    
    return { medioPago: isCaja ? 'efectivo' : 'debito', cuentaId, etiqueta };
}

// ===== COMPRAS =====
function prepararVistaCompras() {
    // compraProducto es ahora un hidden input + picker dinámico (ver index.html)
    const hidProd     = document.getElementById("compraProducto");
    const displayProd = document.getElementById("compraProducto-display");
    if (hidProd && displayProd && !hidProd.value) {
        displayProd.textContent = 'Sin seleccionar';
        displayProd.style.color = '#6b7280';
    }

    const selProv = document.getElementById("compraProveedor");
    if (selProv) {
        selProv.innerHTML = proveedores.length === 0
            ? '<option value="">-- NO HAY PROVEEDORES --</option>'
            : '<option value="">-- Selecciona Proveedor --</option>' +
              proveedores.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
    }
    actualizarSelectBancos();
    _poblarCuentasOrigen();
    gestionarCamposPago();
}

function _poblarCuentasOrigen(targetId = "compraCuentaOrigen") {
    const sel = document.getElementById(targetId);
    if (!sel) return;
    
    // 1. Obtenemos el efectivo
    const efectivo = StorageService.get("cuentasEfectivo", [{ id: "efectivo", nombre: "💵 Efectivo", saldo: 0 }]);
    
    // 2. Obtenemos las tarjetas bancarias
    const bancarias = StorageService.get("cuentas-bancarias", []);
    
    // 3. Filtramos para que solo aparezcan las de "debito"
    const debito = bancarias.filter(c => 
        c.tipo && c.tipo.toLowerCase().includes("debito")
    );
    
    // 4. Unimos ambos y llenamos el selector
    const todas = [...efectivo, ...debito];
    sel.innerHTML = todas.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
}

function actualizarSelectBancos() {
    const select = document.getElementById("compraBancoSeleccionado");
    if (!select) return;
    const bancosMSI = tarjetasConfig.filter(t => !t.tipo || t.tipo === "credito");
    select.innerHTML = bancosMSI.map(t => `<option value="${t.banco}">${t.banco}</option>`).join('');
}

function gestionarCamposPago() {
    const metodo   = document.getElementById("compraMetodoPago")?.value;
    const divBanco  = document.getElementById("divSeleccionBanco");
    const divMeses  = document.getElementById("divMeses");
    const divCuenta = document.getElementById("divCuentaOrigen");
    if (!metodo) return;

    // Cuenta origen solo aplica para pago de contado (sale dinero inmediatamente)
    if (divCuenta) divCuenta.style.display = (metodo === 'contado') ? 'block' : 'none';
    if (divBanco)  divBanco.style.display  = (metodo === 'tarjeta_msi') ? 'block' : 'none';
    if (divMeses)  divMeses.style.display  = (metodo === 'tarjeta_msi') ? 'block' : 'none';

    actualizarSelectBancos();
}

// Función para cargar las ubicaciones en el select cuando el usuario le da clic
function cargarUbicacionesCompra() {
    const select = document.getElementById("compraUbicacion");
    // Si ya tiene más de 1 opción, significa que ya cargó, no lo volvemos a cargar
    if (!select || select.options.length > 1) return; 
    
    const ubicaciones = StorageService.get("ubicacionesConfig", []);
    let html = '<option value="General">-- General --</option>';
    ubicaciones.forEach(u => {
        html += `<option value="${u.nombre}">${u.nombre}</option>`;
    });
    select.innerHTML = html;
}

// Función principal de registro de compras actualizada
function registrarCompra() {
    const productoId  = parseInt(document.getElementById("compraProducto").value);
    const proveedorId = parseInt(document.getElementById("compraProveedor").value);
    const cantidad    = parseInt(document.getElementById("compraCantidad").value);
    const costoNuevo  = parseFloat(document.getElementById("compraCosto").value);
    const comboPago   = document.getElementById("compraMetodoPago");
    const metodo      = comboPago.value;
    const formaPagoTexto = comboPago.options[comboPago.selectedIndex].text;
    const ingresoInmediato = document.getElementById("compraIngresoInmediato")?.checked ?? true;

    // 👇 1. LEEMOS EL COLOR Y LA UBICACIÓN 👇
    const colorNuevo = document.getElementById("compraColor")?.value.trim() || 'General';
    const ubicacionNueva = document.getElementById("compraUbicacion")?.value || 'General';

    if (!proveedorId || !productoId || isNaN(cantidad) || isNaN(costoNuevo) || cantidad <= 0) {
        alert("⚠️ Por favor completa todos los campos correctamente.");
        return;
    }

    const prov    = proveedores.find(p => p.id == proveedorId);
    const producto = productos.find(p => String(p.id) === String(productoId));
    if (!prov || !producto) return alert("⚠️ Proveedor o producto no encontrado.");

    const bancoSel = document.getElementById("compraBancoSeleccionado")?.value || "";
    const cuentaOrigenId = document.getElementById("compraCuentaOrigen")?.value || "efectivo";
    const cuentaOrigenNombre = document.getElementById("compraCuentaOrigen")?.options[document.getElementById("compraCuentaOrigen")?.selectedIndex]?.text || "Efectivo";
    const fechaHoyISO  = window.getFechaLocalMX();
    const fechaHoyStr  = fechaHoyISO.split('-').reverse().join('/');
    const fechaPagoMensaje = (metodo === "contado") ? "Hoy (Contado)" : calcularFechaPago(fechaHoyStr, bancoSel);

    const mensajeConfirmar =
        `¿Deseas registrar esta compra?\n\n` +
        `Proveedor: ${prov.nombre}\n` +
        `Producto: ${producto.nombre} (${colorNuevo})\n` +
        `Ubicación destino: ${ubicacionNueva}\n` +
        `Total: ${dinero(cantidad * costoNuevo)}\n` +
        `Pago Estimado: ${fechaPagoMensaje}`;

    if (!confirm(mensajeConfirmar)) return;

    let avisoActualizacion = "";
    if (costoNuevo > producto.costo) {
        const costoAnterior = producto.costo;
        const precioAnterior = producto.precio;
        let margenAplicar = 30;
        categoriasData.forEach(cat => {
            const sub = cat.subcategorias.find(s => s.nombre === producto.subcategoria);
            if (sub) margenAplicar = sub.margen;
        });
        const nuevoPrecio = CalculatorService.calcularPrecioDesdeMargen(costoNuevo, margenAplicar);
        producto.costo  = costoNuevo;
        producto.precio = nuevoPrecio;
        avisoActualizacion = `\n\n📢 ¡ACTUALIZACIÓN DE PRECIOS!\n` +
            `Costo: ${dinero(costoAnterior)} ➡️ ${dinero(costoNuevo)}\n` +
            `Precio: ${dinero(precioAnterior)} ➡️ ${dinero(nuevoPrecio)}\n` +
            `Margen aplicado: ${margenAplicar}%`;
    }

    const totalCompra = cantidad * costoNuevo;
    const caracteristicas = document.getElementById("compraCaracteristicas")?.value || "";

    const nuevaCompra = {
        id: Date.now(),
        productoId,
        productoNombre: producto.nombre,   
        proveedor: prov.nombre,
        proveedorId,
        total: totalCompra,
        fecha: fechaHoyStr,
        fechaISO: fechaHoyISO,
        pagado: metodo === "contado" ? totalCompra : 0,
        totalPagado: metodo === "contado" ? totalCompra : 0,
        pago: metodo === "contado" ? { monto: totalCompra, metodo, cuenta: cuentaOrigenId, etiqueta: cuentaOrigenNombre } : null,
        caracteristicas,
        color: colorNuevo,           // <-- Guardamos el color en el historial
        ubicacion: ubicacionNueva    // <-- Guardamos la ubicación en el historial
    };
    compras.push(nuevaCompra);

    const caracteristicasInput = document.getElementById("compraCaracteristicas");
    if (caracteristicasInput) caracteristicasInput.value = "";
    const colorInput = document.getElementById("compraColor");
    if (colorInput) colorInput.value = "";
    const ubicacionInput = document.getElementById("compraUbicacion");
    if (ubicacionInput) ubicacionInput.value = "General";

    guardarHistorialCosto({
        productoId,
        precioCompra: costoNuevo,
        fecha: fechaHoyStr,
        cantidad,
        proveedorId,
        proveedorNombre: prov.nombre,
        origen: 'compra directa'
    });

    const nuevaRecepcion = {
        id: Date.now() + 1,
        compraId: nuevaCompra.id,
        productoId,
        productoNombre: producto.nombre,
        cantidadTotal: cantidad,
        cantidadRecibida: ingresoInmediato ? cantidad : 0,
        cantidadPendiente: ingresoInmediato ? 0 : cantidad,
        proveedor: prov.nombre,
        fechaPedido: nuevaCompra.fecha,
        metodoPago: formaPagoTexto,
        estatus: ingresoInmediato ? "Completado" : "Pendiente",
        costoUnitario: Number(costoNuevo || 0),
        costo: Number(costoNuevo || 0),
        color: colorNuevo,           // <-- Sabe de qué color viene
        ubicacion: ubicacionNueva    // <-- Sabe a qué bodega va
    };
    recepciones.push(nuevaRecepcion);

    // 👇 2. DISTRIBUIR EL STOCK EN LAS VARIANTES SI ENTRA INMEDIATAMENTE 👇
    if (ingresoInmediato) {
        // Actualiza el stock general (tu función original)
        actualizarStock(productoId, cantidad, `Compra a ${prov.nombre} (${colorNuevo})`);

        // Actualizamos la "cajita" específica (Color + Ubicación)
        if (!producto.variantes) producto.variantes = [];
        
        const varianteExistente = producto.variantes.find(v => 
            (v.color || "General").toUpperCase() === colorNuevo.toUpperCase() && 
            (v.ubicacion || "General").toUpperCase() === ubicacionNueva.toUpperCase()
        );

        if (varianteExistente) {
            varianteExistente.stock = (Number(varianteExistente.stock) || 0) + cantidad;
        } else {
            producto.variantes.push({
                color: colorNuevo,
                ubicacion: ubicacionNueva,
                stock: cantidad
            });
        }
    }

    if (metodo !== "contado") {
        const detalleDeuda = {
            id: Date.now() + 2,
            compraId: nuevaCompra.id,
            proveedor: prov.nombre,
            producto: producto.nombre,
            cantidad,
            total: totalCompra,
            saldoPendiente: totalCompra,
            metodo,
            formaPagoTexto,
            banco: bancoSel,
            meses: parseInt(document.getElementById("compraMeses")?.value) || 1,
            fecha: nuevaCompra.fecha,
            vencimiento: fechaPagoMensaje
        };

        if (metodo === "credito_proveedor") {
            let cuentasProv = StorageService.get("cuentasPorPagar", []);
            cuentasProv.push(detalleDeuda);
            if (!StorageService.set("cuentasPorPagar", cuentasProv)) {
                console.error("❌ Error guardando cuentas por pagar");
            }
        }

        if (metodo === "tarjeta_msi") {
            let cuentasBancos = StorageService.get("cuentasMSI", []);
            const numMeses = parseInt(document.getElementById("compraMeses").value) || 12;
            cuentasBancos.push({
                id: Date.now() + 3,
                compraId: nuevaCompra.id,
                banco: bancoSel,
                concepto: `Compra: ${producto.nombre} (Prov: ${prov.nombre})`, // 🔥 INYECCIÓN DE AUDITORÍA
                producto: producto.nombre,
                total: totalCompra,
                meses: numMeses,
                cuotaMensual: totalCompra / numMeses,
                fechaCompra: nuevaCompra.fecha,
                calendario: calcularCalendarioMSI(new Date(), numMeses, bancoSel),
                pagosRealizados: 0
            });
            if (!StorageService.set("cuentasMSI", cuentasBancos)) {
                console.error("❌ Error guardando cuentas MSI");
            }
        }
    }

    if (!StorageService.set("productos", productos)) {
        console.error("❌ Error guardando productos");
    }
    if (!StorageService.set("compras", compras)) {
        console.error("❌ Error guardando compras");
    }
    if (!StorageService.set("recepciones", recepciones)) {
        console.error("❌ Error guardando recepciones");
    }

    if (metodo === "contado") {
        window._egresarCuenta({
            monto: totalCompra, cuentaId: cuentaOrigenId, etiqueta: cuentaOrigenNombre,
            concepto: `Compra de contado — ${producto.nombre} a ${prov.nombre}`, referencia: `COMPRA-${nuevaCompra.id}`
        });
    }

    alert(`✅ Registro Exitoso\nProveedor: ${prov.nombre}${avisoActualizacion}`);
    
    // Si la función limpiarFormularioCompra existe, la ejecuta
    if(typeof limpiarFormularioCompra === 'function') limpiarFormularioCompra();
    
    navA('compras');
}

function limpiarFormularioCompra() {
    const ids = ["compraCantidad", "compraCosto"];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
    // compraProducto es hidden input + display span (picker dinámico)
    const hidProd     = document.getElementById("compraProducto");
    const displayProd = document.getElementById("compraProducto-display");
    if (hidProd)     { hidProd.value = ""; }
    if (displayProd) { displayProd.textContent = 'Sin seleccionar'; displayProd.style.color = '#6b7280'; }
    const selProv    = document.getElementById("compraProveedor");
    const selPago    = document.getElementById("compraMetodoPago");
    const chkIngreso = document.getElementById("compraIngresoInmediato");
    if (selProv) selProv.selectedIndex = 0;
    if (selPago) selPago.selectedIndex = 0;
    if (chkIngreso) chkIngreso.checked = true;
}

// ===== RECEPCIONES =====
function renderRecepciones() {
    const contenedor = document.getElementById("listaRecepcionesPendientes");
    if (!contenedor) return;

    let recs = StorageService.get("recepciones", []);
    let pendientes = recs.filter(r => r.estatus === "Pendiente");

    if (pendientes.length === 0) {
        contenedor.innerHTML = "<p style='text-align:center; padding:20px;'>✅ No hay mercancía pendiente de recibir.</p>";
        return;
    }

    let html = `
        <table class="tabla-admin">
            <thead><tr>
                <th>Fecha / Proveedor</th>
                <th>Producto</th>
                <th>Pedido</th>
                <th>Pendiente</th>
                <th>Acción</th>
            </tr></thead>
            <tbody>`;

    pendientes.forEach(r => {
        html += `
            <tr>
                <td>${r.fechaPedido}<br><strong>${r.proveedor}</strong></td>
                <td>${r.productoNombre}<br><small>Pago: ${r.metodoPago}</small></td>
                <td>${r.cantidadTotal}</td>
                <td style="color:red; font-weight:bold;">${r.cantidadPendiente}</td>
                <td>
                    <button onclick="procesarRecepcionFisica(${r.id})" style="background:#27ae60; color:white; border:none; padding:8px; border-radius:5px; cursor:pointer;">
                        📥 Recibir
                    </button>
                </td>
            </tr>`;
    });

    contenedor.innerHTML = html + "</tbody></table>";
}

// --- MOTOR DE RECEPCIÓN FÍSICA MULTI-BODEGA ---
function procesarRecepcionFisica(idRecepcion) {
    let recs = StorageService.get("recepciones", []);
    const index = recs.findIndex(r => r.id == idRecepcion);
    if (index === -1) return alert("❌ Error: Recepción no encontrada.");
    const rec = recs[index];

    // Extraer catálogo real de ubicaciones
    const ubicacionesConfig = StorageService.get("ubicacionesConfig", [{nombre: "Piso de Ventas"}, {nombre: "Bodega Principal"}]);
    let opcionesUbi = '<option value="General">-- Elige la Bodega / Ubicación --</option>';
    ubicacionesConfig.forEach(u => {
        const isSelected = (rec.ubicacion === u.nombre) ? 'selected' : '';
        opcionesUbi += `<option value="${u.nombre}" ${isSelected}>${u.nombre}</option>`;
    });

    // Remover modal previo si existe
    document.querySelector('[data-modal="recepcion-fisica"]')?.remove();

    const html = `
    <div data-modal="recepcion-fisica" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;">
        <div style="background:white;border-radius:12px;width:380px;padding:24px;box-shadow:0 20px 40px rgba(0,0,0,0.3);">
            <h3 style="margin-top:0;color:#1e40af;margin-bottom:15px;">📥 Ingreso al Inventario</h3>
            
            <div style="background:#f8fafc;padding:12px;border-radius:8px;margin-bottom:15px;border:1px solid #e2e8f0;">
                <p style="margin:0;font-size:13px;color:#475569;">Producto: <b>${rec.productoNombre}</b></p>
                <p style="margin:5px 0 0;font-size:13px;color:#dc2626;font-weight:bold;">Pendiente por recibir: ${rec.cantidadPendiente}</p>
            </div>
            
            <div style="margin-bottom:12px;">
                <label style="display:block;font-size:12px;font-weight:bold;margin-bottom:4px;color:#374151;">Cantidad a ingresar:</label>
                <input type="number" id="rfCantidad" value="${rec.cantidadPendiente}" min="1" max="${rec.cantidadPendiente}" style="width:100%;padding:10px;border:2px solid #3b82f6;border-radius:6px;font-size:16px;font-weight:bold;text-align:center;">
            </div>

            <div style="margin-bottom:12px;">
                <label style="display:block;font-size:12px;font-weight:bold;margin-bottom:4px;color:#374151;">Color / Variante:</label>
                <input type="text" id="rfColor" value="${rec.color || 'General'}" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:6px;font-size:14px;">
            </div>

            <div style="margin-bottom:20px;">
                <label style="display:block;font-size:12px;font-weight:bold;margin-bottom:4px;color:#374151;">Bodega / Ubicación de destino:</label>
                <select id="rfUbicacion" style="width:100%;padding:10px;border:2px solid #10b981;border-radius:6px;font-size:14px;background:#f0fdf4;">
                    ${opcionesUbi}
                </select>
            </div>

            <div style="display:flex;gap:10px;">
                <button onclick="ejecutarRecepcionFisica(${idRecepcion})" style="flex:1;padding:12px;background:#16a34a;color:white;border:none;border-radius:6px;font-weight:bold;cursor:pointer;">✅ Recibir Mercancía</button>
                <button onclick="document.querySelector('[data-modal=\\'recepcion-fisica\\']').remove()" style="padding:12px 16px;background:#94a3b8;color:white;border:none;border-radius:6px;cursor:pointer;">Cancelar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

// Lógica de ejecución atada al botón del modal
window.ejecutarRecepcionFisica = function(idRecepcion) {
    // ── CAPA 0: Lista local de recepciones ya procesadas ──────────────────
    const _recAprobadas = StorageService.get('_idsAprobadosLocal', []);
    const _claveRec = `recepcion-${idRecepcion}`;
    if (_recAprobadas.includes(_claveRec)) {
        alert(`⚠️ Esta recepción ya fue procesada en este dispositivo.\n\nNo se duplicará el inventario.`);
        return;
    }
    // ──────────────────────────────────────────────────────────────────────

    const cantidad = parseInt(document.getElementById('rfCantidad').value);
    const colorRecepcion = document.getElementById('rfColor').value.trim() || 'General';
    const ubicacionRecepcion = document.getElementById('rfUbicacion').value;

    if (!ubicacionRecepcion || ubicacionRecepcion === "General") {
        alert("❌ BLOQUEO DE AUDITORÍA: Está estrictamente prohibido ingresar mercancía sin declarar la bodega física de destino. Selecciona una ubicación válida.");
        return; // El return aquí "mata" la función, no guarda nada y no deja avanzar.
    }

    let recs = StorageService.get("recepciones", []);
    const index = recs.findIndex(r => r.id == idRecepcion);
    if (index === -1) return;
    const rec = recs[index];

    if (isNaN(cantidad) || cantidad <= 0 || cantidad > rec.cantidadPendiente) {
        return alert("⚠️ Cantidad no válida o mayor a lo pendiente.");
    }

    let productos = StorageService.get("productos", []);
    let movimientosInventario = StorageService.get("movimientosInventario", []);
    const prod = productos.find(p => String(p.id) === String(rec.productoId));
    
    if (prod) {
        // 1. Afectar Stock General
        prod.stock = (parseInt(prod.stock) || 0) + cantidad;

        // 2. Afectar Variantes (Color/Ubicación)
        if (!prod.variantes) prod.variantes = [];
        
        const varExistente = prod.variantes.find(v => 
            (v.color || "General").toUpperCase() === colorRecepcion.toUpperCase() && 
            (v.ubicacion || "General").toUpperCase() === ubicacionRecepcion.toUpperCase()
        );

        if (varExistente) {
            varExistente.stock = (Number(varExistente.stock) || 0) + cantidad;
        } else {
            prod.variantes.push({ color: colorRecepcion, ubicacion: ubicacionRecepcion, stock: cantidad });
        }
        
        // 3. Afectar KARDEX detallado
        movimientosInventario.push({
            id: Date.now(),
            productoId: String(prod.id),
            productoNombre: prod.nombre,
            tipo: 'entrada',
            cantidad,
            costoUnitario: Number(rec.costoUnitario || rec.costo || prod.costo || 0),
            costo: Number(rec.costoUnitario || rec.costo || prod.costo || 0),
            precioCompra: Number(rec.costoUnitario || rec.costo || prod.costo || 0),
            valor: cantidad * Number(rec.costoUnitario || rec.costo || prod.costo || 0),
            proveedor: rec.proveedor || '',
            referencia: rec.folio || rec.compraId || `REC-${rec.id}`,
            compraId: rec.compraId || null,
            ubicacion: ubicacionRecepcion,
            color: colorRecepcion,
            concepto: `Recepción Pendiente - Prov: ${rec.proveedor} (${colorRecepcion}) -> Ingresado a [${ubicacionRecepcion}]`,
            fecha: window.localISO ? window.localISO(new Date()) : new Date().toISOString()
        });
    } else {
        return alert("❌ Error: El producto ya no existe en la base de datos.");
    }

    // 4. Actualizar la tarjeta de Recepción
    rec.cantidadRecibida += cantidad;
    rec.cantidadPendiente -= cantidad;
    if (rec.cantidadPendiente === 0) rec.estatus = "Completado";
    rec.ubicacion = ubicacionRecepcion;
    rec.color = colorRecepcion;

    if (rec.esConsignacion) {
        _agregarConsignacionesActivasDesdeArticulos({
            compraId: rec.compraId,
            proveedor: rec.proveedor,
            proveedorId: rec.proveedorId || null,
            folioOrigen: rec.folio || `REC-${rec.id}`,
            fecha: window.formatearFechaCortaMX ? window.formatearFechaCortaMX(new Date()) : new Date().toLocaleDateString(),
            articulos: [{
                productoId: rec.productoId,
                nombre: rec.productoNombre,
                costo: Number(rec.costoUnitario || rec.costo || 0),
                cantidad,
                color: colorRecepcion,
                ubicacion: ubicacionRecepcion
            }],
            cantidadCampo: 'cantidad',
            factorCosto: 1,
            origen: 'recepcionPendiente'
        });
    }

    recs[index] = rec;
    
    StorageService.set("recepciones", recs);
    StorageService.set("productos", productos);
    StorageService.set("movimientosInventario", movimientosInventario);

    // ── Marcar recepción como procesada en lista local persistente ────────
    const listaRec = StorageService.get('_idsAprobadosLocal', []);
    if (!listaRec.includes(_claveRec)) {
        listaRec.push(_claveRec);
        StorageService.set('_idsAprobadosLocal', listaRec.slice(-2000));
    }
    // ──────────────────────────────────────────────────────────────────────

    document.querySelector('[data-modal="recepcion-fisica"]').remove();
    alert(`✅ Recepción procesada exitosamente.\nInventario sumado a la bodega: [${ubicacionRecepcion}].`);
    renderRecepciones();
};

window.verDetalleCompra = function(idCuenta) {
    const cuentas = StorageService.get("cuentasPorPagar", []);
    const c = cuentas.find(x => String(x.id) === String(idCuenta));
    if (!c) return;

    // 1. Buscar el origen del pedido
    const compras = StorageService.get("compras", []);
    const ordenes = _getOrdenesCompra();
    let compraOriginal = compras.find(comp => String(comp.id) === String(c.id) || String(comp.id) === String(c.compraId)) ||
                         ordenes.find(oc => String(oc.id) === String(c.id) || String(oc.id) === String(c.compraId));

    // 2. Extraer artículos
    let listaArticulos = [];
    if (Array.isArray(c.articulos) && c.articulos.length > 0) {
        listaArticulos = c.articulos;
    } else if (compraOriginal && compraOriginal.articulos && Array.isArray(compraOriginal.articulos)) {
        listaArticulos = compraOriginal.articulos;
    } else {
        const kardex = StorageService.get("movimientosInventario", []);
        const movs = kardex.filter(m => String(m.compraId) === String(c.compraId) || String(m.compraId) === String(c.id));
        if (movs.length > 0) {
            listaArticulos = movs.map(m => ({ producto: m.productoNombre, cantidad: parseFloat(m.cantidad) || 1, costo: parseFloat(m.costoUnitario) || 0 }));
        } else {
            const cant = parseFloat(c.cantidad || 1);
            const totalC = parseFloat(c.total || 0);
            listaArticulos.push({ producto: c.producto || 'Mercancía General', cantidad: cant, costo: cant > 0 ? (totalC / cant) : totalC });
        }
    }

    // 3. Tabla de artículos
    let filasHTML = '';
    let subtotalReal = 0;
    listaArticulos.forEach(art => {
        const cant = parseFloat(art.cantidadRec ?? art.cantidad ?? art.cant ?? 1) || 1;
        const costoNeto = parseFloat(art.costo ?? art.costoUnitario ?? art.precioOriginal ?? 0) || 0;
        const importe = cant * costoNeto;
        subtotalReal += importe;
        filasHTML += `
            <tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:10px;">${art.nombre || art.producto || art.productoNombre || 'Artículo'}
                    ${art.caracteristicas ? `<br><small style="color:#64748b;">${art.caracteristicas}</small>` : ''}</td>
                <td style="padding:10px;text-align:center;">${cant}</td>
                <td style="padding:10px;text-align:right;">${dinero(costoNeto)}</td>
                <td style="padding:10px;text-align:right;font-weight:bold;">${dinero(importe)}</td>
            </tr>`;
    });
    if (subtotalReal < (parseFloat(c.total) || 0)) subtotalReal = parseFloat(c.total);

    // 4. MOTOR DE FUSIÓN Y AUDITORÍA (Cura la Billetera Rota)
    let abonos = Array.isArray(c.abonos) ? [...c.abonos] : [];
    
    // Rescatar abonos perdidos que se hicieron desde la pantalla de Órdenes de Compra
    if (compraOriginal && Array.isArray(compraOriginal.pagos) && !c.noRescatarPagosOC) {
        compraOriginal.pagos.forEach(pagoOC => {
            const yaExiste = abonos.find(a => a.fecha === pagoOC.fecha && a.monto === pagoOC.monto);
            if (!yaExiste) abonos.push(pagoOC);
        });
    }

    const totalAbonado = abonos.reduce((s, a) => s + (parseFloat(a.monto) || 0), 0);

    // Determinar si hay un anticipo REAL que NO esté ya representado en c.abonos.
    // Cuando los pagos de la Orden de Compra se fusionan en abonos (líneas ~781-786),
    // el campo anticipo_pagado queda igual a la suma de esos abonos → si se mostrara
    // la fila de anticipo Y los abonos individuales se estaría duplicando el monto.
    let anticipoInicial = 0;
    let mostrarFilaAnticipo = false;

    if (compraOriginal && parseFloat(compraOriginal.anticipo_pagado) > 0.01 && !c.noRescatarPagosOC) {
        const ap = parseFloat(compraOriginal.anticipo_pagado);
        // Verificar si los pagos de la OC ya fueron absorbidos por c.abonos
        const pagosOC = Array.isArray(compraOriginal.pagos) ? compraOriginal.pagos : [];
        const pagosYaEnAbonos = pagosOC.length > 0 && pagosOC.every(p =>
            abonos.some(a =>
                a.fecha === p.fecha &&
                Math.abs((parseFloat(a.monto) || 0) - (parseFloat(p.monto) || 0)) < 0.01
            )
        );
        if (!pagosYaEnAbonos) {
            // Anticipo genuino que no está en los abonos individuales → mostrarlo
            anticipoInicial = ap;
            mostrarFilaAnticipo = true;
        }
        // Si pagosYaEnAbonos === true: los abonos individuales YA muestran esos pagos,
        // no agregar fila de anticipo ni sumarlo al total.
    }

    // Saldo verdadero: siempre recalcular desde cero para corregir cualquier
    // valor mal guardado por el bug del doble conteo anterior.
    // Solo se suma anticipoInicial si es un pago genuino no representado en abonos.
    const saldoPendienteVerdadero = Math.max(
        0,
        subtotalReal - totalAbonado - (mostrarFilaAnticipo ? anticipoInicial : 0)
    );

    // Auto-Reparación silenciosa en la base de datos (Si estaban desincronizados, los arregla)
    if (Math.abs((parseFloat(c.saldoPendiente) || 0) - saldoPendienteVerdadero) > 0.01 || c.abonos?.length !== abonos.length) {
        c.saldoPendiente = saldoPendienteVerdadero;
        c.abonos = abonos;
        StorageService.set("cuentasPorPagar", cuentas);
    }

    const saldoPendiente = saldoPendienteVerdadero;
    const cfgEmpresa = StorageService.get('configEmpresa', {}) || {};
    const empresaNombre = cfgEmpresa.nombre || 'Muebleria Mi Pueblito';
    const empresaTel = cfgEmpresa.telefono || cfgEmpresa.celular || '';
    const empresaDir = cfgEmpresa.direccion || '';
    const detalleDomId = `estado-cuenta-proveedor-${String(c.id).replace(/[^a-zA-Z0-9_-]/g, '-')}`;

    let movimientosHTML = '';

    // Fila de compra inicial
    movimientosHTML += `
        <tr style="border-bottom:1px solid #e2e8f0; background:#fefce8;">
            <td style="padding:10px;">${c.fecha || '-'}</td>
            <td style="padding:10px;">Compra registrada</td>
            <td style="padding:10px;text-align:right;color:#dc2626;font-weight:bold;">${dinero(subtotalReal)}</td>
            <td style="padding:10px;text-align:right;">—</td>
            <td style="padding:10px;text-align:right;font-weight:bold;color:#dc2626;">${dinero(subtotalReal)}</td>
        </tr>`;

    // Anticipo al registrar (solo si es un pago genuino no representado en los abonos)
    let saldoCorriente = subtotalReal;
    if (mostrarFilaAnticipo) {
        saldoCorriente -= anticipoInicial;
        movimientosHTML += `
            <tr style="border-bottom:1px solid #e2e8f0; background:#f0fdf4;">
                <td style="padding:10px;">${c.fecha || '-'}</td>
                <td style="padding:10px;">Anticipo al registrar compra</td>
                <td style="padding:10px;text-align:right;">—</td>
                <td style="padding:10px;text-align:right;color:#16a34a;font-weight:bold;">${dinero(anticipoInicial)}</td>
                <td style="padding:10px;text-align:right;font-weight:bold;color:#dc2626;">${dinero(saldoCorriente)}</td>
            </tr>`;
    }

    // Abonos posteriores
    abonos.forEach(ab => {
        saldoCorriente -= (parseFloat(ab.monto) || 0);
        const fechaAb = ab.fecha ? window.formatearFechaMX(ab.fecha) : '-';
        movimientosHTML += `
            <tr style="border-bottom:1px solid #e2e8f0; background:#f0fdf4;">
                <td style="padding:10px;">${fechaAb}</td>
                <td style="padding:10px;">Abono — ${ab.cuenta || 'No especificado'}</td>
                <td style="padding:10px;text-align:right;">—</td>
                <td style="padding:10px;text-align:right;color:#16a34a;font-weight:bold;">${dinero(ab.monto)}</td>
                <td style="padding:10px;text-align:right;font-weight:bold;color:${saldoCorriente > 0.01 ? '#dc2626' : '#16a34a'};">${dinero(Math.max(0, saldoCorriente))}</td>
            </tr>`;
    });

    // 5. Modal HTML
    const modalHTML = `
        <div data-modal="detalle-compra" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(3px);z-index:6000;display:flex;justify-content:center;align-items:flex-start;overflow-y:auto;padding:20px;">
            <div style="background:white;padding:0;border-radius:10px;width:95%;max-width:900px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);margin:auto;overflow:hidden;">

                <div id="${detalleDomId}" style="background:white;padding:32px;color:#0f172a;">
                <div style="border-bottom:3px solid #1e3a8a;padding-bottom:12px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-start;gap:18px;">
                    <div>
                        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
                            <img src="img/Logo.svg" style="height:46px;max-width:130px;object-fit:contain;" onerror="this.style.display='none'">
                            <div>
                                <div style="font-size:17px;font-weight:900;color:#1e3a8a;">${empresaNombre}</div>
                                ${empresaDir ? `<div style="font-size:11px;color:#64748b;">${empresaDir}</div>` : ''}
                                ${empresaTel ? `<div style="font-size:11px;color:#64748b;">Tel. ${empresaTel}</div>` : ''}
                            </div>
                        </div>
                        <h2 style="margin:0;color:#1e3a8a;font-size:22px;font-weight:800;">ESTADO DE CUENTA — PROVEEDOR</h2>
                        <p style="margin:4px 0 0;color:#64748b;font-size:13px;">Folio interno: <strong>#${c.compraId || c.id}</strong></p>
                    </div>
                    <div style="text-align:right;">
                        <button onclick="document.querySelector('[data-modal=&quot;detalle-compra&quot;]')?.remove();" style="background:none;border:none;font-size:24px;cursor:pointer;color:#94a3b8;">✕</button>
                        <p style="margin:8px 0 0;color:#64748b;font-size:13px;">Fecha: <strong>${c.fecha || '-'}</strong></p>
                        <p style="margin:4px 0 0;color:#64748b;font-size:12px;">Emitido: <strong>${window.formatearFechaMX ? window.formatearFechaMX(new Date()) : new Date().toLocaleString('es-MX')}</strong></p>
                    </div>
                </div>

                <div style="background:#f8fafc;padding:12px 16px;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:20px;">
                    <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;font-weight:bold;">Proveedor / Acreedor</p>
                    <p style="margin:4px 0 0;font-weight:bold;font-size:18px;color:#0f172a;">${c.proveedor || 'No especificado'}</p>
                    <p style="margin:4px 0 0;color:#64748b;font-size:13px;">Método: ${c.formaPagoTexto || c.metodo || '-'}</p>
                </div>

                <h3 style="color:#374151;font-size:14px;font-weight:700;text-transform:uppercase;margin:0 0 8px;">Detalle de lo comprado</h3>
                <div style="overflow-x:auto;margin-bottom:24px;">
                    <table style="width:100%;border-collapse:collapse;font-size:13px;">
                        <thead style="background:#f1f5f9;color:#475569;">
                            <tr>
                                <th style="padding:10px;text-align:left;">Producto</th>
                                <th style="padding:10px;text-align:center;">Cant.</th>
                                <th style="padding:10px;text-align:right;">Costo</th>
                                <th style="padding:10px;text-align:right;">Importe</th>
                            </tr>
                        </thead>
                        <tbody>${filasHTML}</tbody>
                        <tfoot>
                            <tr style="background:#f8fafc;font-weight:bold;">
                                <td colspan="3" style="padding:10px;text-align:right;color:#374151;">Total de compra:</td>
                                <td style="padding:10px;text-align:right;color:#1e3a8a;font-size:15px;">${dinero(subtotalReal)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <h3 style="color:#374151;font-size:14px;font-weight:700;text-transform:uppercase;margin:0 0 8px;">Historial de movimientos</h3>
                <div style="overflow-x:auto;margin-bottom:24px;">
                    <table style="width:100%;border-collapse:collapse;font-size:13px;">
                        <thead style="background:#f1f5f9;color:#475569;">
                            <tr>
                                <th style="padding:10px;text-align:left;">Fecha</th>
                                <th style="padding:10px;text-align:left;">Concepto</th>
                                <th style="padding:10px;text-align:right;">Cargo (+)</th>
                                <th style="padding:10px;text-align:right;">Abono (−)</th>
                                <th style="padding:10px;text-align:right;">Saldo</th>
                            </tr>
                        </thead>
                        <tbody>${movimientosHTML}</tbody>
                    </table>
                </div>

                <div style="display:flex;justify-content:flex-end;">
                    <div style="width:300px;background:#f8fafc;padding:18px;border-radius:8px;border:1px solid #e2e8f0;">
                        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                            <span style="color:#64748b;font-size:13px;">Total compra:</span>
                            <strong style="color:#0f172a;">${dinero(subtotalReal)}</strong>
                        </div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:8px;color:#16a34a;">
                            <span style="font-size:13px;">Total abonado:</span>
                            <strong>− ${dinero(totalAbonado + (mostrarFilaAnticipo ? anticipoInicial : 0))}</strong>
                        </div>
                        <div style="display:flex;justify-content:space-between;border-top:2px solid #cbd5e1;padding-top:10px;font-size:16px;color:#dc2626;">
                            <strong>SALDO A PAGAR:</strong>
                            <strong>${dinero(saldoPendiente)}</strong>
                        </div>
                    </div>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:42px;margin-top:42px;color:#334155;font-size:12px;">
                    <div style="border-top:1px solid #94a3b8;padding-top:8px;text-align:center;">Elaboro / Administracion</div>
                    <div style="border-top:1px solid #94a3b8;padding-top:8px;text-align:center;">Recibio / Proveedor</div>
                </div>
                <p style="margin:22px 0 0;color:#64748b;font-size:11px;line-height:1.4;">Documento informativo generado con base en compras, recepciones y abonos registrados en el sistema. Cualquier aclaracion debe realizarse contra comprobantes de pago y documentos de recepcion.</p>
                </div>

                <div style="padding:16px 32px;background:#f8fafc;text-align:right;border-top:1px solid #e2e8f0;display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;">
                    <button onclick="document.querySelector('[data-modal=&quot;detalle-compra&quot;]')?.remove();" style="padding:10px 22px;background:#64748b;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">Cerrar</button>
                    <button onclick="imprimirEstadoCuentaProveedor('${c.id}')" style="padding:10px 22px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">PDF / Ticket / Imagen</button>
                    ${saldoPendiente > 0 ? (
                        c.origenConsignacion || String(c.folioOrigen).startsWith('RCON-')
                        ? `<button onclick="document.querySelector('[data-modal=&quot;detalle-compra&quot;]')?.remove(); abrirModalPagoConsignacion('${c.id}');" style="padding:10px 22px;background:#be123c;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">💸 Pagar Venta Consignación</button>`
                        : `<button onclick="document.querySelector('[data-modal=&quot;detalle-compra&quot;]')?.remove(); registrarAbonoProveedor('${c.id}');" style="padding:10px 22px;background:#1e3a8a;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">💵 Registrar Abono</button>`
                    ) : ''}
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

function _estadoCuentaProveedorDomId(idCuenta) {
    return `estado-cuenta-proveedor-${String(idCuenta).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

function _clonarEstadoCuentaProveedor(idCuenta) {
    const original = document.getElementById(_estadoCuentaProveedorDomId(idCuenta));
    if (!original) return null;
    const clone = original.cloneNode(true);
    clone.querySelectorAll('button').forEach(btn => btn.remove());
    clone.style.width = '820px';
    clone.style.maxWidth = '820px';
    clone.style.margin = '0 auto';
    clone.style.boxSizing = 'border-box';
    return clone;
}

window.imprimirEstadoCuentaProveedor = function(idCuenta) {
    const clone = _clonarEstadoCuentaProveedor(idCuenta);
    if (!clone) return alert('Abre primero el estado de cuenta para imprimirlo.');
    if (window.TicketService?.elegirFormato) {
        window.TicketService.elegirFormato({
            html: clone.outerHTML,
            title: 'Estado de cuenta proveedor',
            filename: `estado_proveedor_${idCuenta}`,
            pageSize: 'letter'
        });
        return;
    }
    if (window.TicketService?.openDocument) {
        window.TicketService.openDocument(clone.outerHTML, { title: 'Estado de cuenta proveedor', filename: `estado_proveedor_${idCuenta}`, pageSize: 'letter', autoPrint: true });
        return;
    }
    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) return alert('Habilita las ventanas emergentes para imprimir el estado de cuenta.');
    w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
        <title>Estado de cuenta proveedor</title>
        <style>
            *{box-sizing:border-box}
            body{font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:22px;color:#0f172a}
            .toolbar{display:flex;justify-content:center;gap:10px;margin-bottom:16px}
            .toolbar button{padding:10px 18px;border:0;border-radius:7px;background:#1e40af;color:white;font-weight:bold;cursor:pointer}
            @media print{body{background:white;padding:0}.toolbar{display:none!important}@page{margin:12mm}}
        </style></head><body>
        <div class="toolbar"><button onclick="window.print()">Imprimir / Guardar PDF</button></div>
        ${clone.outerHTML}
        <script>setTimeout(function(){ window.focus(); }, 200);<\/script>
    </body></html>`);
    w.document.close();
};

function _cargarHtml2CanvasEstadoProveedor(cb) {
    if (typeof html2canvas !== 'undefined') return cb();
    const existente = document.getElementById('html2canvas-estado-proveedor');
    if (existente) {
        existente.addEventListener('load', cb, { once: true });
        return;
    }
    const script = document.createElement('script');
    script.id = 'html2canvas-estado-proveedor';
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload = cb;
    script.onerror = () => alert('No se pudo cargar el motor de imagen. Usa Imprimir / PDF o revisa tu conexion.');
    document.head.appendChild(script);
}

window.descargarImagenEstadoCuentaProveedor = function(idCuenta) {
    const clone = _clonarEstadoCuentaProveedor(idCuenta);
    if (!clone) return alert('Abre primero el estado de cuenta para guardarlo como imagen.');
    const safeId = String(idCuenta).replace(/[^a-zA-Z0-9_-]/g, '-');
    const btn = document.getElementById(`btn-img-estado-proveedor-${safeId}`);
    const textoOriginal = btn ? btn.textContent : '';
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Generando...';
    }

    _cargarHtml2CanvasEstadoProveedor(() => {
        const wrap = document.createElement('div');
        wrap.style.position = 'fixed';
        wrap.style.left = '-10000px';
        wrap.style.top = '0';
        wrap.style.background = '#ffffff';
        wrap.style.padding = '20px';
        wrap.appendChild(clone);
        document.body.appendChild(wrap);

        html2canvas(clone, { scale: 2.5, backgroundColor: '#ffffff', useCORS: true })
            .then(canvas => {
                const link = document.createElement('a');
                link.download = `estado_cuenta_proveedor_${safeId}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            })
            .catch(err => {
                console.error('Error generando imagen de estado de cuenta:', err);
                alert('No se pudo generar la imagen. Intenta con Imprimir / PDF.');
            })
            .finally(() => {
                wrap.remove();
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = textoOriginal || 'Guardar imagen';
                }
            });
    });
};

window.registrarAbonoProveedor = function(idCuenta) {
    const cuentas = StorageService.get("cuentasPorPagar", []);
    const index = cuentas.findIndex(c => String(c.id) === String(idCuenta));
    if (index === -1) { console.error("No se encontró la cuenta para abonar"); return; }
    const cuenta = cuentas[index];
    document.querySelector('[data-modal="abono-proveedor"]')?.remove();
    
    // Generar fecha hoy
    const fechaHoy = _comprasHoyInput();

    const modalHTML = `
    <div data-modal="abono-proveedor" style="position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:6000;display:flex;justify-content:center;align-items:center;">
        <div style="background:white;padding:30px;border-radius:15px;width:90%;max-width:550px;max-height:90vh;overflow-y:auto;">
            <h2 style="margin-top:0;">💵 Pagar a ${cuenta.proveedor}</h2>
            <div style="background:#f8f9fa;padding:15px;border-radius:8px;margin-bottom:20px;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                    <div><small style="color:#718096;">Producto</small><br><strong>${cuenta.producto || '-'}</strong></div>
                    <div><small style="color:#718096;">Saldo Pendiente</small><br><strong style="color:#e74c3c;font-size:20px;">${dinero(cuenta.saldoPendiente)}</strong></div>
                </div>
            </div>
            
            <div style="margin-bottom:20px;">
                <label style="font-weight:bold;display:block;margin-bottom:8px;">Fecha del Pago:</label>
                <input type="date" id="fechaAbonoProv" value="${fechaHoy}" style="width:100%;padding:12px;border:1px solid #cbd5e1;border-radius:6px;">
            </div>

            <div style="margin-bottom:20px;">
                <label style="font-weight:bold;display:block;margin-bottom:8px;">Monto del pago ($):</label>
                <input type="number" id="montoAbonoProveedor" placeholder="0.00" min="0" max="${cuenta.saldoPendiente}"
                       style="width:100%;padding:12px;font-size:16px;border:2px solid #3498db;border-radius:6px;">
            </div>
            <div style="margin-bottom:20px;">
                <label style="font-weight:bold;display:block;margin-bottom:8px;">💳 ¿De dónde sale el dinero?</label>
                ${_buildSelectorCuentas('cuentaOrigen_proveedor', false)}
            </div>
            <div style="display:flex;gap:10px;">
                <button onclick="confirmarAbonoProveedor('${idCuenta}')"
                        style="flex:1;padding:12px;background:#27ae60;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">
                    ✅ Registrar Pago
                </button>
                <button onclick="document.querySelector('[data-modal=&quot;abono-proveedor&quot;]')?.remove();"
                        style="flex:1;padding:12px;background:#e74c3c;color:white;border:none;border-radius:6px;cursor:pointer;">
                    ✕ Cancelar
                </button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

window.confirmarAbonoProveedor = function(idCuenta) {
    if (!_comprasRequireAdmin('Registrar pago a proveedor')) return;
    const fechaInput = document.getElementById("fechaAbonoProv").value;
    if (!fechaInput) return alert("❌ Error: Debes especificar la fecha del pago.");
    const fechaPagoFinal = `${fechaInput}T12:00:00.000`;
    
    const montoAbono = parseFloat(document.getElementById("montoAbonoProveedor")?.value);
    let cuentas = StorageService.get("cuentasPorPagar", []);
    const index = cuentas.findIndex(c => String(c.id) === String(idCuenta));
    if (index === -1) return;
    const cuenta = cuentas[index];

    // Sustituimos ValidatorService por una validación nativa a prueba de balas
    if (isNaN(montoAbono) || montoAbono <= 0) return alert("⚠️ Ingresa un monto válido mayor a $0.");
    if (montoAbono > cuenta.saldoPendiente + 0.01) return alert(`⚠️ El monto excede el saldo pendiente (${dinero(cuenta.saldoPendiente)}).`);

    const { medioPago, cuentaId, etiqueta } = _getCuentaSeleccionada('proveedor');
    
    const msjConf = `¿CONFIRMAR PAGO A PROVEEDOR?\n\nProveedor: ${cuenta.proveedor}\nMonto a abonar: ${dinero(montoAbono)}\nOrigen del dinero: ${etiqueta}\n\n¿Deseas continuar?`;
    if (!confirm(msjConf)) return;

    // 1. Descontar el dinero del banco o caja
    window._egresarCuenta({
        monto: montoAbono,
        cuentaId,
        etiqueta,
        concepto: `Pago a proveedor ${cuenta.proveedor}${cuenta.producto ? ' - ' + cuenta.producto : ''}`,
        referencia: `ABONO-PROV-${idCuenta}`,
        fecha: fechaPagoFinal 
    });

    // 2. Registrar abono en Cuenta Por Pagar
    cuenta.saldoPendiente -= montoAbono;
    if (!Array.isArray(cuenta.abonos)) cuenta.abonos = [];
    cuenta.abonos.push({
        fecha: fechaPagoFinal,
        monto: montoAbono,
        cuenta: etiqueta || 'No especificada'
    });
    StorageService.set("cuentasPorPagar", cuentas);
    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'PAGO_PROVEEDOR',
            modulo: 'Compras',
            entidad: 'cuentasPorPagar',
            entidadId: idCuenta,
            detalle: `Pago a proveedor ${cuenta.proveedor || ''}`.trim(),
            monto: montoAbono,
            severidad: 'riesgo',
            datos: { proveedor: cuenta.proveedor, producto: cuenta.producto, cuentaId, etiqueta, saldoRestante: cuenta.saldoPendiente }
        });
    }

    // 3. SINCRONIZACIÓN BARRERA: Si esta deuda viene de una Orden de Compra, actualizar la OC también
    if (cuenta.compraId) {
        let ordenes = _getOrdenesCompra();
        let idxOC = ordenes.findIndex(o => String(o.id) === String(cuenta.compraId));
        if (idxOC !== -1) {
            ordenes[idxOC].saldoPendiente = Math.max(0, (ordenes[idxOC].saldoPendiente || 0) - montoAbono);
            if (!Array.isArray(ordenes[idxOC].pagos)) ordenes[idxOC].pagos = [];
            ordenes[idxOC].pagos.push({ fecha: fechaPagoFinal, monto: montoAbono, cuenta: etiqueta });
            StorageService.set("ordenesCompra", ordenes);
        }
    }

    alert("✅ Pago registrado y sincronizado correctamente en todos los módulos.");
    document.querySelector('[data-modal="abono-proveedor"]')?.remove();
    if (typeof renderCuentasPorPagar === 'function') renderCuentasPorPagar();
};
window.confirmarAbonoProveedor = confirmarAbonoProveedor;

function _agregarConsignacionesActivasDesdeArticulos({ compraId, proveedor, proveedorId = null, folioOrigen = '', fecha, articulos = [], cantidadCampo = 'cantidad', factorCosto = 1, origen = 'compra' }) {
    const factor = Number.isFinite(Number(factorCosto)) ? Math.max(0, Number(factorCosto)) : 1;
    if (factor <= 0) return 0;

    const actuales = StorageService.get("consignacionesActivas", []);
    let creadas = 0;

    articulos.forEach((art, index) => {
        const cantidad = Number(art[cantidadCampo] ?? art.cantidad ?? art.cantidadRec ?? 0);
        const costoBase = Number(art.costo || art.costoUnitario || 0);
        if (cantidad <= 0 || costoBase < 0) return;

        const costoUnitario = costoBase * factor;
        const total = cantidad * costoUnitario;
        if (total <= 0.01) return;

        const id = Date.now() + Math.random() + index;
        actuales.push({
            id,
            consignacionId: id,
            compraId,
            proveedor,
            proveedorId: proveedorId || null,
            producto: art.nombre || art.productoNombre || 'Producto',
            productoId: art.productoId || null,
            total,
            cantidadTotal: cantidad,
            cantidadPendiente: cantidad,
            costoUnitario,
            fecha,
            folioOrigen: folioOrigen || '',
            origen,
            color: art.colorRec || art.color || 'General',
            ubicacion: art.ubicacionRec || art.ubicacion || 'General',
            montoTransferido: 0,
            cantidadVendida: 0
        });
        creadas++;
    });

    if (creadas > 0) StorageService.set("consignacionesActivas", actuales);
    return creadas;
}

// ===== ÓRDENES DE COMPRA =====
function _foliosOC() {
    const hoyIso = window.obtenerHoyInputMX();
    const ymd = hoyIso.replace(/-/g, '');
    const lista = _getOrdenesCompra();
    const seq = String(lista.length + 1).padStart(4, '0');
    return 'OC-' + ymd + '-' + seq;
}

function _comprasProductoActivo(p) {
    if (typeof window.productoEstaActivo === 'function') return window.productoEstaActivo(p);
    return !!p && p.activo !== false && p.Activo !== 0 && p.Activo !== false;
}

function abrirNuevaOrdenCompra() {
    const provs = StorageService.get('proveedores', []);
    const prods = StorageService.get('productos', []);
    const selProvs = provs.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
    const selProds = prods.map(p => `<option value="${p.id}" data-costo="${p.costo || 0}">${p.nombre} (Costo: ${dinero(p.costo || 0)})</option>`).join('');
    const html = `
    <div data-modal="nueva-oc" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:20px;">
      <div style="background:white;border-radius:12px;width:100%;max-width:950px;padding:30px;margin:auto;">
        <h2 style="margin:0 0 20px;color:#1e40af;">📋 Nueva Orden de Compra</h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">PROVEEDOR</label>
            <select id="ocProveedor" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
    <option value="">-- Selecciona proveedor --</option>
    ${selProvs}
</select>

<div style="margin-top:15px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
    <div>
        <label style="font-size:13px; font-weight:bold;">Método de Pago:</label>
        <select id="ocMetodoPago" onchange="document.getElementById('divMsiOC').style.display=(this.value==='msi'?'block':'none'); document.getElementById('divCuentaOC').style.display=(this.value==='contado'?'block':'none'); document.getElementById('alertaConsignacionOC').style.display=(this.value==='consignacion'?'block':'none');" 
                style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
            <option value="contado">Contado</option>
            <option value="credito">Crédito Proveedor</option>
            <option value="msi">Meses sin Intereses (MSI)</option>
            <option value="consignacion" style="color:#10b981; font-weight:bold;">A Consignación</option>
        </select>
        <div id="alertaConsignacionOC" style="display:none; background:#ecfdf5; border:1px solid #10b981; padding:8px; border-radius:6px; margin-top:8px; font-size:11px; color:#065f46;">
            ✅ <b>Modo Consignación:</b> Esta OC no generará una deuda inmediata exigible en el flujo. Solo se pagará lo que se vaya vendiendo.
        </div>
    </div>

    <div id="divCuentaOC">
        <label style="font-size:13px; font-weight:bold;">Cuenta para anticipo:</label>
        <select id="ocCuentaOrigen" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;"></select>
        <div style="margin-top:10px;">
            <label style="font-size:13px; font-weight:bold;">Monto de anticipo:</label>
            <input type="number" id="ocAnticipo" min="0" value="0" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
        </div>
    </div>
</div>

<div id="divMsiOC" style="display:none; margin-top:10px;">
    <label style="font-size:13px; font-weight:bold;">Número de meses:</label>
    <input type="number" id="ocMeses" value="12" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
</div>
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">FECHA ENTREGA ESTIMADA</label>
            <input type="date" id="ocFechaEntrega" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
          </div>
        </div>
                <div style="display:grid;grid-template-columns:1fr 1fr auto auto;gap:10px;align-items:end;margin-bottom:12px;">
                    <div>
                        <input type="hidden" id="ocProductoSel" value="">
                        <div style="display:flex;align-items:center;gap:6px;">
                            <span id="ocProductoSel-display"
                                  style="flex:1;padding:9px;border:1px solid #d1d5db;border-radius:6px;background:#f9fafb;color:#6b7280;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                                Sin seleccionar
                            </span>
                            <button type="button"
        onclick="abrirSelectorProducto({titulo:'🔍 Seleccionar Producto',onSeleccion:function(p){document.getElementById('ocProductoSel').value=p.id;var d=document.getElementById('ocProductoSel-display');d.textContent=p.nombre+'  (Costo: '+dinero(p.costo||0)+')';d.style.color='#111827';alert('💡 Referencia de costo:\\nEl último costo registrado para este producto es de: $' + (p.costo || 0));}})"
        style="padding:9px 12px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;white-space:nowrap;font-size:13px;">
    🔍 Buscar
</button>
                        </div>
                    </div>
                    <input type="text" id="ocCaracteristicas" placeholder="Características (tela, color, etc)" style="padding:9px;border:1px solid #d1d5db;border-radius:6px;">
                    <input type="number" id="ocCantidad" value="1" min="1" style="width:70px;padding:9px;border:1px solid #d1d5db;border-radius:6px;">
                    <button onclick="agregarArticuloOC()" style="padding:9px 16px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;white-space:nowrap;">➕ Agregar</button>
                </div>
        <div id="tablaArticulosOC" style="margin-bottom:16px;"></div>
        <div style="margin-bottom:12px;">
          <label style="font-size:12px;font-weight:bold;color:#374151;">NOTAS</label>
          <textarea id="ocNotas" rows="2" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;"></textarea>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <strong>Total: <span id="ocTotal" style="color:#1e40af;font-size:18px;">$0.00</span></strong>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px;">
            <input type="checkbox" id="ocBorrador" checked style="width:16px;height:16px;"> Guardar como Borrador
          </label>
        </div>
        <div style="display:flex;gap:10px;">
          <button onclick="guardarOrdenCompra()" style="flex:1;padding:12px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">💾 Guardar OC</button>
          <button onclick="document.querySelector('[data-modal=nueva-oc]')?.remove()" style="padding:12px 20px;background:#6b7280;color:white;border:none;border-radius:6px;cursor:pointer;">✕ Cancelar</button>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    // Fecha entrega: default hoy + 15 días
    const fechaEnt = new Date(); fechaEnt.setDate(fechaEnt.getDate() + 15);
    const ocFechaEl = document.getElementById('ocFechaEntrega');
    if (ocFechaEl) ocFechaEl.value = window.fechaParaInput(fechaEnt).substring(0, 10);
    window._articulosOC = [];
    _renderTablaArticulosOC();
    // Llenar combo de cuenta para anticipo
    _poblarCuentasOrigen('ocCuentaOrigen');
    // Mostrar/ocultar combo según método de pago
    const metodoPagoSel = document.getElementById('ocMetodoPago');
    const divCuentaOC = document.getElementById('divCuentaOC');
    if (metodoPagoSel && divCuentaOC) {
        const actualizarMetodoOC = function() {
            const divMsiOC = document.getElementById('divMsiOC');
            const alertaConsignacionOC = document.getElementById('alertaConsignacionOC');
            divCuentaOC.style.display = (this.value === 'contado') ? 'block' : 'none';
            if (divMsiOC) divMsiOC.style.display = (this.value === 'msi') ? 'block' : 'none';
            if (alertaConsignacionOC) alertaConsignacionOC.style.display = (this.value === 'consignacion') ? 'block' : 'none';
        };
        metodoPagoSel.onchange = actualizarMetodoOC;
        actualizarMetodoOC.call(metodoPagoSel);
    }
}

function agregarArticuloOC() {
    const sel = document.getElementById('ocProductoSel');
    const cantInput = document.getElementById('ocCantidad');
    const caracInput = document.getElementById('ocCaracteristicas');
    if (!sel.value) return;
    const prods = StorageService.get('productos', []);
    const prod = prods.find(p => String(p.id) === String(sel.value) && _comprasProductoActivo(p));
    if (!prod) return alert('Este producto esta inactivo y no se puede agregar a la orden.');
    const cant = parseInt(cantInput.value) || 1;
    const costo = parseFloat(prod.costo) || 0;
    const caracteristicas = caracInput ? caracInput.value.trim() : '';
    if (!window._articulosOC) window._articulosOC = [];
    const idx = window._articulosOC.findIndex(a => String(a.productoId) === String(prod.id) && a.caracteristicas === caracteristicas);
    if (idx !== -1) {
        window._articulosOC[idx].cantidad += cant;
        window._articulosOC[idx].subtotal = window._articulosOC[idx].cantidad * costo;
    } else {
        window._articulosOC.push({ productoId: prod.id, nombre: prod.nombre, costo, cantidad: cant, subtotal: cant * costo, caracteristicas });
    }
    cantInput.value = 1;
    // Resetear picker de producto OC
    sel.value = '';
    const displayOC = document.getElementById('ocProductoSel-display');
    if (displayOC) { displayOC.textContent = 'Sin seleccionar'; displayOC.style.color = '#6b7280'; }
    if (caracInput) caracInput.value = '';
    _renderTablaArticulosOC();
}

function _renderTablaArticulosOC() {
    const cont = document.getElementById('tablaArticulosOC');
    if (!cont) return;
    const arts = window._articulosOC || [];
    if (arts.length === 0) {
        cont.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:12px;">Sin artículos</p>';
        const totEl = document.getElementById('ocTotal');
        if (totEl) totEl.textContent = dinero(0);
        return;
    }
    let total = 0;
    const esAdmin = (typeof window.esAdmin === 'function') ? window.esAdmin() : (typeof esAdmin === 'function' ? esAdmin() : false);
        const rows = arts.map((a, i) => {
                total += a.subtotal;
                // Iniciamos la bandera para evitar undefineds
                if (typeof a.yaEnInventario === 'undefined') a.yaEnInventario = false;
                
                return `<tr>
                        <td style="padding:8px;">${a.nombre}</td>
                        <td style="padding:8px;">${a.caracteristicas ? `<span style='color:#64748b;font-size:12px;'>${a.caracteristicas}</span>` : ''}</td>
                        <td style="padding:8px;text-align:center;">
                                <input type="number" min="0" step="0.01" value="${a.costo}" style="width:80px;text-align:right;" ${esAdmin ? '' : 'readonly disabled'} onchange="if(${esAdmin}){window._articulosOC[${i}].costo = parseFloat(event.target.value)||0; window._articulosOC[${i}].subtotal = window._articulosOC[${i}].cantidad * window._articulosOC[${i}].costo; _renderTablaArticulosOC();}" />
                        </td>
                        <td style="padding:8px;text-align:center;">${a.cantidad}</td>
                        <td style="padding:8px;text-align:center;">
                            <input type="checkbox" ${a.yaEnInventario ? 'checked' : ''} onchange="window._articulosOC[${i}].yaEnInventario = this.checked;">
                        </td>
                        <td style="padding:8px;text-align:right;">${dinero(a.subtotal)}</td>
                        <td style="padding:8px;text-align:center;"><button onclick="window._articulosOC.splice(${i},1);_renderTablaArticulosOC();" style="background:none;border:none;cursor:pointer;font-size:16px;">🗑️</button></td>
                </tr>`;
        }).join('');
        cont.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead><tr style="background:#f3f4f6;">
                <th style="padding:8px;text-align:left;">Artículo</th>
                <th style="padding:8px;">Características</th>
                <th style="padding:8px;text-align:center;">Costo Unit.</th>
                <th style="padding:8px;text-align:center;">Cant.</th>
                <th style="padding:8px;text-align:center;" title="Marcar si ya tienes este producto de esta requisición">Ya en Inventario</th>
                <th style="padding:8px;text-align:right;">Subtotal</th>
                <th></th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
    const totEl = document.getElementById('ocTotal');
    if (totEl) totEl.textContent = dinero(total);
}

function guardarOrdenCompra() {
    if (!_comprasRequireAdmin('Guardar orden de compra')) return;
    const arts = window._articulosOC || [];
    if (arts.length === 0) return alert('⚠️ Agrega al menos un artículo.');
    
    // --- CORRECCIÓN: Mover estas 3 líneas HACIA ARRIBA ---
    const provId = document.getElementById('ocProveedor')?.value;
    const provs = StorageService.get('proveedores', []);
    const prov = provs.find(p => String(p.id) === String(provId));
    const provNombre = prov ? prov.nombre : 'Sin proveedor';
    // -------------------------------------------------------

    const fechaEntrega = document.getElementById('ocFechaEntrega')?.value;
    const notas = document.getElementById('ocNotas')?.value.trim() || '';
    const borrador = document.getElementById('ocBorrador')?.checked ?? true;
    const metodoPago = document.getElementById('ocMetodoPago')?.value || '';
    const cuentaOrigen = document.getElementById('ocCuentaOrigen')?.value || '';
    
    // Ahora el anticipo ya sabe quién es provNombre
    const anticipo = parseFloat(document.getElementById('ocAnticipo')?.value || '0');
    const ocId = Date.now();
    const fechaAnticipo = window.localISO ? window.localISO(new Date()) : new Date().toISOString();
    const anticipoRef = `ANTICIPO-OC-${ocId}`;
    if (anticipo > 0 && cuentaOrigen) {
        const etiqueta = document.getElementById('ocCuentaOrigen')?.options[document.getElementById('ocCuentaOrigen')?.selectedIndex]?.text || cuentaOrigen;
        _egresarCuenta({
            monto: anticipo,
            cuentaId: cuentaOrigen,
            etiqueta,
            concepto: `Anticipo OC a ${provNombre}`, 
            referencia: anticipoRef,
            idOperacion: anticipoRef
        });
    }
    if (metodoPago === 'consignacion' && anticipo > 0) {
        const etiqueta = document.getElementById('ocCuentaOrigen')?.options[document.getElementById('ocCuentaOrigen')?.selectedIndex]?.text || cuentaOrigen || 'Sin cuenta';
        _registrarAnticipoConsignacionGlobal({
            monto: anticipo,
            cuentaId: cuentaOrigen || null,
            cuenta: etiqueta,
            proveedor: provNombre,
            proveedorId: provId || null,
            fecha: fechaAnticipo,
            nota: 'Anticipo registrado desde orden de compra a consignacion',
            referencia: anticipoRef,
            origen: 'ordenCompra'
        });
    }
    const meses = document.getElementById('ocMeses')?.value || '';
    const total = arts.reduce((s, a) => s + a.subtotal, 0);
    
    // --- SANITIZACIÓN PARA FIREBASE ---
    // Obligamos a que todos los artículos tengan datos limpios y sin undefined
    const articulosLimpios = arts.map(a => ({
        productoId: a.productoId || null,
        nombre: a.nombre || "Sin nombre",
        costo: parseFloat(a.costo) || 0,
        cantidad: parseInt(a.cantidad) || 0,
        subtotal: parseFloat(a.subtotal) || 0,
        caracteristicas: a.caracteristicas || "",
        yaEnInventario: Boolean(a.yaEnInventario)
    }));

    const oc = {
        id: ocId,
        folio: _foliosOC(),
        proveedorId: provId || null,
        proveedorNombre: provNombre || "General",
        articulos: articulosLimpios,
        total: parseFloat(total) || 0,
        fechaEmision: Date.now(),
        fechaEntregaEstimada: fechaEntrega || null,
        estado: borrador ? 'Borrador' : 'Enviada',
        notas: notas || "",
        condicionesComerciales: {
            metodoPago: metodoPago || "contado",
            cuentaOrigen: cuentaOrigen || null,
            meses: meses || 0
        },
        anticipo_pagado: parseFloat(anticipo) || 0,
        saldoPendiente: Math.max(0, parseFloat(total) - (parseFloat(anticipo) || 0)),
        pagos: (anticipo > 0) ? [{ fecha: fechaAnticipo, monto: parseFloat(anticipo), cuenta: cuentaOrigen, referencia: anticipoRef }] : [],
        esConsignacion: metodoPago === 'consignacion'
    };
    
    // Eliminamos cualquier campo nulo que pueda molestar a Firestore
    Object.keys(oc).forEach(k => (oc[k] == null || oc[k] === undefined) && delete oc[k]);

    const lista = _getOrdenesCompra();
    lista.push(oc);
    // --- MARCAR REQUISICIONES COMO EN ORDEN ---
    if (window._requisicionesVinculadasA_OC && window._requisicionesVinculadasA_OC.length > 0) {
        let reqsTotales = StorageService.get("requisicionesCompra", []);
        window._requisicionesVinculadasA_OC.forEach(idReq => {
            let r = reqsTotales.find(x => String(x.id) === String(idReq));
            if (r) r.estatus = `En OC (${oc.folio})`;
        });
        StorageService.set("requisicionesCompra", reqsTotales);
        window._requisicionesVinculadasA_OC = null;
    }
    // ------------------------------------------
    StorageService.set('ordenesCompra', lista);
    document.querySelector('[data-modal="nueva-oc"]')?.remove();
    alert(`✅ Orden de compra ${oc.folio} guardada.`);
    if (document.getElementById('contenidoOrdenesCompra')) renderListaOrdenesCompra();
    imprimirOrdenCompra(oc.id);
}

function imprimirOrdenCompra(id) {
    const lista = _getOrdenesCompra();
    const oc = lista.find(x => x.id === id);
    if (!oc) return;
    const cfg = StorageService.get('configEmpresa', {});
    const empresa = cfg.nombre || 'Mueblería Mi Pueblito';
    const rows = oc.articulos.map(a =>
        `<tr>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${a.nombre}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${a.caracteristicas ? `<span style='color:#64748b;font-size:12px;'>${a.caracteristicas}</span>` : ''}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;">${a.cantidad}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${dinero(a.costo)}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${dinero(a.subtotal)}</td>
        </tr>`
    ).join('');
    const ocHTML = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>OC ${oc.folio}</title>
    <style>body{font-family:Arial,sans-serif;padding:32px;color:#111;}table{width:100%;border-collapse:collapse;}th{background:#f3f4f6;padding:8px;text-align:left;}@media print{button{display:none!important;}}</style>
    </head><body>
    <div style="text-align:center;margin-bottom:24px;">
      <img src="img/Logo.svg" style="height:70px;" onerror="this.outerHTML='<span style=\\'font-size:32px;\\'>🏛️</span>'">
      <h2 style="margin:8px 0;">${empresa}</h2>
    </div>
    <hr>
    <div style="display:flex;justify-content:space-between;margin-bottom:20px;">
      <div><strong>ORDEN DE COMPRA</strong><br><span style="font-size:20px;color:#1e40af;">${oc.folio}</span><br><span style="color:${oc.estado==='Enviada'?'#16a34a':'#d97706'}">${oc.estado}</span></div>
      <div style="text-align:right;">
        <div>Emisión: ${window.formatearFechaCortaMX(oc.fechaEmision)}</div>
        ${oc.fechaEntregaEstimada ? `<div>Entrega est.: ${window.formatearFechaCortaMX(oc.fechaEntregaEstimada)}</div>` : ''}
      </div>
    </div>
        <div style="margin-bottom:16px;"><strong>Proveedor:</strong> ${oc.proveedorNombre}</div>
        <div style="margin-bottom:16px;"><strong>Condiciones comerciales:</strong><br>
            Forma de pago: <b>${oc.condicionesComerciales?.metodoPago === 'contado' ? 'Contado' : oc.condicionesComerciales?.metodoPago === 'credito' ? 'Crédito Proveedor' : oc.condicionesComerciales?.metodoPago === 'msi' ? 'Meses sin Intereses' : '-'}</b><br>
            ${oc.condicionesComerciales?.metodoPago === 'msi' ? `Meses: <b>${oc.condicionesComerciales?.meses}</b><br>` : ''}
            ${oc.condicionesComerciales?.cuentaOrigen ? `Cuenta origen: <b>${oc.condicionesComerciales?.cuentaOrigen}</b><br>` : ''}
        </div>
        <table>
            <thead><tr><th>Artículo</th><th>Características</th><th style="text-align:center;">Cant.</th><th style="text-align:right;">Costo Unit.</th><th style="text-align:right;">Subtotal</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>
    <div style="text-align:right;margin-top:16px;font-size:20px;font-weight:bold;">TOTAL: ${dinero(oc.total)}</div>
    ${oc.notas ? `<div style="margin-top:16px;padding:12px;background:#f9fafb;border-radius:6px;"><strong>Notas:</strong> ${oc.notas}</div>` : ''}
    <div style="margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:40px;text-align:center;">
      <div><div style="border-top:1px solid #374151;padding-top:8px;margin-top:40px;">Firma del Proveedor</div></div>
      <div><div style="border-top:1px solid #374151;padding-top:8px;margin-top:40px;">Autorizado por</div></div>
    </div>
    <div style="text-align:center;margin-top:12px;">
      <button onclick="window.print()" style="padding:10px 24px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;font-size:15px;">🖨️ Imprimir</button>
    </div>
    </body></html>`;
    if (window.TicketService?.elegirFormato) {
        const pageSize = (oc.articulos || []).length <= 4 && !oc.notas ? 'half-letter' : 'letter';
        window.TicketService.elegirFormato({
            html: ocHTML,
            title: `Orden de Compra ${oc.folio}`,
            filename: `oc_${oc.folio}`,
            pageSize
        });
        return;
    }
    if (window.TicketService?.openDocument) {
        const pageSize = (oc.articulos || []).length <= 4 && !oc.notas ? 'half-letter' : 'letter';
        window.TicketService.openDocument(ocHTML, { title: `Orden de Compra ${oc.folio}`, filename: `oc_${oc.folio}`, pageSize });
        return;
    }
    const w = window.open('', '_blank', 'width=750,height=900');
    w.document.write(ocHTML);
    w.document.close();
}

function recibirOrdenCompra(id) {
    const lista = _getOrdenesCompra();
    const idx   = lista.findIndex(x => x.id === id);
    if (idx === -1) return;
    const oc = lista[idx];
    if (oc.estado === 'Recibida' || oc.estado === 'Recibida Parcial')  return alert('Esta orden ya fue recibida completamente o está en back order. Solo puedes recibir en el back order.');
    if (oc.estado === 'Cancelada') return alert('Esta orden está cancelada.');

    // Saldo pendiente según condición de pago de la OC
    const condPago   = oc.condicionesComerciales?.metodoPago || 'credito';
    const esConsignacionOC = condPago === 'consignacion' || oc.esConsignacion === true;
    const totalOC    = oc.total || 0;
    const anticipo   = oc.anticipo_pagado || 0;
    const saldoOC    = totalOC - anticipo;
    const yaHayPago  = condPago === 'contado'; // si era contado ya estaba acordado pagarlo

    // Obtener ubicaciones para forzar su selección
    const ubicacionesConfig = StorageService.get("ubicacionesConfig", []);
    let opcionesUbi = '<option value="">-- Elige --</option><option value="General">General</option>';
    ubicacionesConfig.forEach(u => {
        if(u.nombre !== 'General') opcionesUbi += `<option value="${u.nombre}">${u.nombre}</option>`;
    });

    // Filas de artículos con input de cantidad
    const esAdmin = (typeof window.esAdmin === 'function') ? window.esAdmin() : (typeof esAdmin === 'function' ? esAdmin() : false);
    const filasArts = oc.articulos.map((a, i) => `
        <tr style="border-bottom:1px solid #e5e7eb;">
            <td style="padding:10px;">${a.nombre}</td>
            <td style="padding:10px;text-align:center;color:#6b7280;">${a.cantidad}</td>
            <td style="padding:10px;text-align:center;">
                <input type="number" id="recQ_${i}" value="${a.cantidad}"
                       min="0"
                       oninput="window._ocActualizarPendiente(${i},${a.cantidad})"
                       style="width:70px;padding:6px;border:2px solid #3b82f6;border-radius:6px;text-align:center;font-size:14px;font-weight:bold;">
            </td>
            <td id="recP_${i}" style="padding:10px;text-align:center;color:#d97706;font-weight:bold;">0</td>
            <td style="padding:10px;text-align:center;">
                <input type="text" id="recColor_${i}" value="${a.color || ''}"
                       placeholder="Ej: Chocolate"
                       style="width:90px;padding:5px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;">
            </td>
            <td style="padding:10px;text-align:center;">
                <select id="recUbicacion_${i}" style="width:110px;padding:6px;border:2px solid #ef4444;border-radius:6px;font-size:13px;background:#fff5f5;" required>
                    ${opcionesUbi}
                </select>
            </td>
            <td style="padding:10px;text-align:right;color:#374151;">
                <input type="number" id="recCosto_${i}" value="${a.costo}" min="0" step="0.01" style="width:80px;text-align:right;" ${esAdmin ? '' : 'readonly disabled'} onchange="if(${esAdmin}){window._actualizarCostoOCArticulo(${i}, this.value, ${id});}" />
            </td>
            <td id="recSub_${i}" style="padding:10px;text-align:right;font-weight:bold;">${dinero(a.cantidad * a.costo)}</td>
        </tr>`).join('');

    // Función global para actualizar el costo en recepción OC
    window._actualizarCostoOCArticulo = function(idx, nuevoCosto, ocId) {
        const lista = _getOrdenesCompra();
        const oc = lista.find(x => x.id === ocId);
        if (!oc) return;
        
        const art = oc.articulos[idx];
        art.costo = parseFloat(nuevoCosto) || 0;
        art.subtotal = art.cantidad * art.costo;
        StorageService.set('ordenesCompra', lista);
        
        // --- CORRECCIÓN: Actualizar solo el subtotal en la vista, NO redibujar todo ---
        const inputCant = parseInt(document.getElementById(`recQ_${idx}`)?.value) || 0;
        const subtotalVisual = document.getElementById(`recSub_${idx}`);
        if (subtotalVisual) {
            subtotalVisual.textContent = dinero(inputCant * art.costo);
        }
        // Llamamos a la función que recalcula el total inferior sin borrar los inputs
        window._ocActualizarPendiente(idx, art.cantidad); 
    };

    const selectorCuentas = _buildSelectorCuentas('recCuentaPago', false);

    document.querySelector('[data-modal="recepcion-oc"]')?.remove();
    const html = `
    <div data-modal="recepcion-oc" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:16px;">
      <div style="background:white;border-radius:14px;width:100%;max-width:760px;padding:28px;margin:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);">

        <!-- Encabezado -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
          <div>
            <h2 style="margin:0 0 4px;color:#1e40af;">📦 Recepción de Mercancía</h2>
            <p style="margin:0;color:#6b7280;font-size:14px;">OC: <strong>${oc.folio}</strong> &nbsp;•&nbsp; Proveedor: <strong>${oc.proveedorNombre}</strong></p>
          </div>
          <button onclick="document.querySelector('[data-modal=recepcion-oc]').remove()"
                  style="background:none;border:none;font-size:22px;cursor:pointer;color:#9ca3af;">✕</button>
        </div>

        <!-- Info OC -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px;">
          <div style="background:#eff6ff;border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:11px;color:#3b82f6;font-weight:bold;">TOTAL OC</div>
            <div style="font-size:18px;font-weight:bold;color:#1e40af;">${dinero(totalOC)}</div>
          </div>
          <div style="background:#fef3c7;border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:11px;color:#d97706;font-weight:bold;">ANTICIPO</div>
            <div style="font-size:18px;font-weight:bold;color:#b45309;">${dinero(anticipo)}</div>
          </div>
          <div style="background:${saldoOC > 0 ? '#fef2f2' : '#f0fdf4'};border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:11px;color:${saldoOC > 0 ? '#dc2626' : '#16a34a'};font-weight:bold;">SALDO PENDIENTE</div>
            <div style="font-size:18px;font-weight:bold;color:${saldoOC > 0 ? '#dc2626' : '#16a34a'};">${dinero(saldoOC)}</div>
          </div>
        </div>

        <!-- Tabla de artículos -->
        <div style="overflow-x:auto;margin-bottom:6px;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead>
              <tr style="background:#f3f4f6;">
                <th style="padding:10px;text-align:left;">Artículo</th>
                <th style="padding:10px;text-align:center;">Pedido</th>
                <th style="padding:10px;text-align:center;">Recibido ✏️</th>
                <th style="padding:10px;text-align:center;">Back Order</th>
                <th style="padding:10px;text-align:center;">Color 🎨</th>
                <th style="padding:10px;text-align:center;">Ubicación 📍</th>
                <th style="padding:10px;text-align:right;">Costo U.</th>
                <th style="padding:10px;text-align:right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>${filasArts}</tbody>
            <tfoot>
              <tr style="background:#f9fafb;font-weight:bold;">
                <td colspan="6" style="padding:10px;text-align:right;">Total recibido:</td>
                <td id="recTotalMonto" style="padding:10px;text-align:right;color:#1e40af;font-size:16px;">${dinero(totalOC)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p style="font-size:12px;color:#9ca3af;margin-bottom:18px;">
          Ajusta las cantidades recibidas. Lo que falte quedará como <strong>Back Order</strong> automáticamente.
        </p>

        <!-- Sección pago (solo si hay saldo) -->
        <div id="seccionPagoRecepcion" style="${saldoOC > 0 ? '' : 'display:none;'}">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:18px;">
            <div style="font-size:14px;font-weight:bold;color:#374151;margin-bottom:12px;">${esConsignacionOC ? 'Recepcion a consignacion' : '💳 ¿Realizar pago ahora?'}</div>
            <div style="display:flex;gap:8px;margin-bottom:12px;" id="botonesMetodoPago">
              <button id="btnPagoNo" onclick="window._ocSelPago('no')"
                      style="flex:1;padding:9px;border:2px solid #1e40af;background:#1e40af;color:white;border-radius:8px;cursor:pointer;font-weight:bold;">
                ${esConsignacionOC ? 'Recibir a consignacion (sin CxP)' : '❌ No, registrar como C×P'}
              </button>
              <button id="btnPagoContado" onclick="window._ocSelPago('contado')"
                      style="flex:1;padding:9px;border:2px solid #d1d5db;background:white;color:#374151;border-radius:8px;cursor:pointer;font-weight:bold;${esConsignacionOC ? 'display:none;' : ''}">
                💵 Sí, Efectivo
              </button>
              <button id="btnPagoDebito" onclick="window._ocSelPago('debito')"
                      style="flex:1;padding:9px;border:2px solid #d1d5db;background:white;color:#374151;border-radius:8px;cursor:pointer;font-weight:bold;${esConsignacionOC ? 'display:none;' : ''}">
                💳 Sí, Débito
              </button>
            </div>
            ${esConsignacionOC ? `
                <div style="background:#ecfdf5;color:#047857;border:1px solid #bbf7d0;padding:10px 12px;border-radius:8px;font-size:12px;font-weight:700;margin-bottom:12px;">
                    Esta OC esta marcada como consignacion: la recepcion no genera CxP ni salida de efectivo. La obligacion nace cuando reportes mercancia vendida.
                </div>` : ''}
            <div id="divCuentaPago" style="display:none;">
              <label style="font-size:13px;font-weight:bold;color:#374151;display:block;margin-bottom:6px;">Cuenta de pago:</label>
              ${selectorCuentas}
            </div>
            <div id="divMontoManual" style="display:none;margin-top:10px;">
              <label style="font-size:13px;font-weight:bold;color:#374151;display:block;margin-bottom:6px;">Monto a pagar ahora (máx <span id="lblSaldoMax">${dinero(saldoOC)}</span>):</label>
              <input type="number" id="recMontoPago" placeholder="${saldoOC.toFixed(2)}" min="0" max="${saldoOC}"
                     style="width:100%;padding:9px;border:2px solid #3b82f6;border-radius:6px;font-size:15px;">
            </div>
          </div>
        </div>

        <!-- Notas recepción -->
        <div style="margin-bottom:18px;">
          <label style="font-size:13px;font-weight:bold;color:#374151;display:block;margin-bottom:6px;">📝 Observaciones de la recepción:</label>
          <textarea id="recNotas" rows="2" placeholder="Condición de la mercancía, faltantes, daños..."
                    style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;"></textarea>
        </div>

        <!-- Botones -->
        <div style="display:flex;gap:10px;">
          <button onclick="confirmarRecepcionOC(${id})"
                  style="flex:1;padding:13px;background:#16a34a;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:bold;font-size:15px;">
            ✅ Confirmar Recepción e Imprimir
          </button>
          <button onclick="document.querySelector('[data-modal=recepcion-oc]').remove()"
                  style="padding:13px 20px;background:#6b7280;color:white;border:none;border-radius:8px;cursor:pointer;">
            ✕ Cancelar
          </button>
        </div>

      </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);

    // Guardar estado de pago seleccionado
    window._ocMetodoPago = 'no';

    // Función para seleccionar método de pago
    window._ocSelPago = function(metodo) {
        window._ocMetodoPago = metodo;
        ['no','contado','debito'].forEach(m => {
            const btn = document.getElementById(`btnPago${m.charAt(0).toUpperCase()+m.slice(1)}`);
            if (btn) {
                btn.style.background = m === metodo ? '#1e40af' : 'white';
                btn.style.color      = m === metodo ? 'white' : '#374151';
                btn.style.borderColor= m === metodo ? '#1e40af' : '#d1d5db';
            }
        });
        const divC = document.getElementById('divCuentaPago');
        const divM = document.getElementById('divMontoManual');
        if (divC) divC.style.display = (metodo !== 'no') ? 'block' : 'none';
        if (divM) divM.style.display = (metodo !== 'no') ? 'block' : 'none';
        // filtrar cuentas según tipo
        if (metodo === 'debito') {
            const sel = document.getElementById('recCuentaPago');
            if (sel) {
                const cban = StorageService.get('cuentas-bancarias', []).filter(c => c.tipo && c.tipo.toLowerCase().includes('debito'));
                sel.innerHTML = cban.map(c => `<option value="${c.id}">${c.nombre}${c.saldo !== undefined ? ' — ' + dinero(c.saldo) : ''}</option>`).join('');
            }
        } else if (metodo === 'contado') {
            const sel = document.getElementById('recCuentaPago');
            if (sel) {
                const cef = StorageService.get('cuentasEfectivo', [{ id: 'efectivo', nombre: '💵 Efectivo', saldo: 0 }]);
                sel.innerHTML = cef.map(c => `<option value="${c.id}">${c.nombre}${c.saldo !== undefined ? ' — ' + dinero(c.saldo) : ''}</option>`).join('');
            }
        }
    };

    // Función para recalcular totales en tiempo real
    window._ocActualizarPendiente = function(i, total) {
        const inp  = document.getElementById(`recQ_${i}`);
        const pEl  = document.getElementById(`recP_${i}`);
        const sEl  = document.getElementById(`recSub_${i}`);
        const costo = oc.articulos[i]?.costo || 0;
        if (!inp) return;
        const val = Math.max(0, parseInt(inp.value) || 0);
        inp.value = val;
        if (pEl)  pEl.textContent  = total - val;
        if (sEl)  sEl.textContent  = dinero(val * costo);
        // recalcular total
        let totalRec = 0;
        oc.articulos.forEach((a, j) => {
            const q = parseInt(document.getElementById(`recQ_${j}`)?.value) || 0;
            totalRec += q * (a.costo || 0);
        });
        const totEl = document.getElementById('recTotalMonto');
        if (totEl) totEl.textContent = dinero(totalRec);
        // actualizar monto sugerido
        const montoInp = document.getElementById('recMontoPago');
        const anticipoAplicable = Math.min(anticipo, totalRec);
        const saldoDisp = Math.max(0, totalRec - anticipoAplicable);
        if (montoInp && !montoInp.dataset.editado) montoInp.value = Math.min(totalRec, saldoDisp > 0 ? saldoDisp : totalRec).toFixed(2);
        // saldo pendiente actualizado
        const lblSaldo = document.getElementById('lblSaldoMax');
        if (lblSaldo) lblSaldo.textContent = dinero(saldoDisp);
    };

    // Marcar monto como editado manualmente
    const montoInputEl = document.getElementById('recMontoPago');
    if (montoInputEl) montoInputEl.addEventListener('input', () => { montoInputEl.dataset.editado = '1'; });
}

function confirmarRecepcionOC(ocId) {
    if (!_comprasRequireAdmin('Confirmar recepcion de orden de compra')) return;
    const lista = _getOrdenesCompra();
    const idx   = lista.findIndex(x => x.id === ocId);
    if (idx === -1) return;
    const oc = lista[idx];
    if (oc.estado === 'Recibida' || oc.estado === 'Recibida Parcial') return alert('Esta orden ya fue procesada. Actualiza la vista antes de intentar otra recepcion.');
    if (oc.estado === 'Cancelada') return alert('Esta orden esta cancelada.');

    const fechaRec   = new Date();
    const fechaStr   = window.formatearFechaCortaMX(fechaRec);
    let notas      = document.getElementById('recNotas')?.value.trim() || '';
    const esConsignacionOC = oc.condicionesComerciales?.metodoPago === 'consignacion' || oc.esConsignacion === true;
    const metodoPago = esConsignacionOC ? 'no' : (window._ocMetodoPago || 'no');

    // Recoger cantidades recibidas (permitir más de lo pedido)
    const itemsRecibidos = [];
    const itemsBackOrder  = [];
    let obsExtra = [];
    let faltanUbicaciones = false;

    oc.articulos.forEach((a, i) => {
        const inputVal = parseInt(document.getElementById(`recQ_${i}`)?.value) || 0;
        const cantRec = Math.max(0, inputVal);
        const backOrd = a.cantidad - Math.min(inputVal, a.cantidad);
        const colorRec = document.getElementById(`recColor_${i}`)?.value.trim() || '';
        const ubicacionRec = document.getElementById(`recUbicacion_${i}`)?.value;
        
        if (cantRec > 0 && !ubicacionRec) faltanUbicaciones = true;

        if (cantRec > 0) {
            itemsRecibidos.push({ ...a, cantidadRec: cantRec, subtotal: cantRec * a.costo, colorRec, ubicacionRec });
        }
        if (backOrd > 0) itemsBackOrder.push({ ...a, cantidad: backOrd, subtotal: backOrd * a.costo });
        if (inputVal > a.cantidad) {
            obsExtra.push(`Se reciben ${inputVal - a.cantidad} piezas de más de ${a.nombre}`);
        }
    });

    if (obsExtra.length > 0) {
        notas += (notas ? '\n' : '') + obsExtra.join('\n');
    }

    if (itemsRecibidos.length === 0) return alert('⚠️ Debes recibir al menos 1 unidad.');
    if (faltanUbicaciones) return alert('⚠️ REQUERIDO: Debes seleccionar la Ubicación (Bodega/Tienda) para todos los artículos que vas a recibir.');

    const totalRecibido = itemsRecibidos.reduce((s, a) => s + a.subtotal, 0);
    const totalOC       = oc.total || 0;
    const anticipo      = oc.anticipo_pagado || 0;
    const anticipoAplicadoRecepcion = Math.min(anticipo, totalRecibido);
    const anticipoDisponibleBackOrder = Math.max(0, anticipo - anticipoAplicadoRecepcion);
    const saldoDisp     = Math.max(0, totalRecibido - anticipoAplicadoRecepcion);

    // Validar pago si eligió pagar
    let montoPagado = 0;
    let cuentaPagoId = '';
    let cuentaPagoEtiqueta = '';
    if (metodoPago !== 'no' && saldoDisp > 0) {
        const montoEl = document.getElementById('recMontoPago');
        const cuentaEl = document.getElementById('recCuentaPago');
        montoPagado = parseFloat(montoEl?.value) || 0;
        // Validación: evitar pagos de $0
        if (montoPagado <= 0) return alert('⚠️ Ingresa un monto mayor a $0 para el pago.');
        // Validación: evitar pagos mayores al saldo pendiente
        if (montoPagado > saldoDisp + 0.01) return alert(`⚠️ El monto excede el saldo pendiente (${dinero(saldoDisp)}).`);
        // Validación: obligar cuenta seleccionada
        if (!cuentaEl || !cuentaEl.value) return alert('⚠️ Selecciona la cuenta de pago.');
        cuentaPagoId = cuentaEl.value;
        cuentaPagoEtiqueta = cuentaEl.options[cuentaEl.selectedIndex]?.text || 'Efectivo';
        // Validación: advertir si pago + anticipo supera el total
        if ((montoPagado + anticipoAplicadoRecepcion) > totalRecibido + 0.01) {
            if (!confirm(`⚠️ El pago (${dinero(montoPagado)}) más el anticipo aplicado a esta recepcion (${dinero(anticipoAplicadoRecepcion)}) supera el total recibido (${dinero(totalRecibido)}). ¿Deseas continuar?`)) return;
        }
    }

    // --- NUEVO: RESUMEN Y CONFIRMACIÓN DE RECEPCIÓN DE ORDEN DE COMPRA ---
    const formatoDinero = (val) => '$' + Number(val).toLocaleString('en-US', {minimumFractionDigits: 2});
    const msjConfRec = `⚠️ RESUMEN DE OPERACIÓN - ¿CONFIRMAR RECEPCIÓN?\n\nOrden de Compra: ${oc.folio}\nProveedor: ${oc.proveedorNombre}\nTotal de unidades a ingresar: ${itemsRecibidos.reduce((s, a) => s + a.cantidadRec, 0)}\nPago a registrar hoy: ${formatoDinero(montoPagado)}\n\n¿Deseas procesar la entrada al inventario y actualizar la OC?`;
    if (!confirm(msjConfRec)) return;
    // --- FIN DE CONFIRMACIÓN ---

    // Historial de costos y ajuste de precios: solo despues de confirmar la recepcion.
    let productosCostos = StorageService.get('productos', []);
    let preciosActualizados = false;
    const avisosPrecio = [];

    itemsRecibidos.forEach(art => {
        guardarHistorialCosto({
            productoId: art.productoId,
            precioCompra: art.costo,
            fecha: fechaStr,
            cantidad: art.cantidadRec,
            proveedorId: oc.proveedorId,
            proveedorNombre: oc.proveedorNombre,
            origen: 'orden de compra'
        });

        const idxProd = productosCostos.findIndex(p => String(p.id) === String(art.productoId));
        if (idxProd === -1) return;

        const producto = productosCostos[idxProd];
        const costoAnteriorNum = Number(producto.costo || 0);
        const costoNuevo = Number(art.costo || 0);
        if (costoNuevo <= costoAnteriorNum) return;

        const costoAnterior = producto.costo;
        const precioAnterior = producto.precio;
        let margenAplicar = 30;
        if (typeof categoriasData !== 'undefined' && Array.isArray(categoriasData)) {
            categoriasData.forEach(cat => {
                const sub = (cat.subcategorias || []).find(s => s.nombre === producto.subcategoria);
                if (sub) margenAplicar = sub.margen;
            });
        }

        const nuevoPrecio = CalculatorService.calcularPrecioDesdeMargen(costoNuevo, margenAplicar);
        producto.costo = costoNuevo;
        producto.precio = nuevoPrecio;
        preciosActualizados = true;
        avisosPrecio.push(`${producto.nombre}\nCosto: ${dinero(costoAnterior)} -> ${dinero(costoNuevo)}\nPrecio: ${dinero(precioAnterior)} -> ${dinero(nuevoPrecio)}\nMargen aplicado: ${margenAplicar}%`);
    });

    if (preciosActualizados) {
        StorageService.set('productos', productosCostos);
        productos = productosCostos;
        window.productos = productosCostos;
        alert(`ACTUALIZACION DE PRECIOS\n\n${avisosPrecio.join('\n\n')}`);
    }

    // ── 1. Actualizar inventario ───────────────────────────────
const prods = StorageService.get('productos', []);
itemsRecibidos.forEach(art => {
    // Si fue marcado como que ya estaba en inventario en la OC, saltamos la suma
    if (art.yaEnInventario === true) {
        console.log(`El artículo ${art.nombre} fue marcado como 'Ya en inventario' en la Requisición. No se sumará al stock general.`);
        return; 
    }

    const pidx = prods.findIndex(p => String(p.id) === String(art.productoId));
    if (pidx !== -1) {
        prods[pidx].stock = (prods[pidx].stock || 0) + art.cantidadRec;
        // Afectar la ubicación específica y color
        prods[pidx].variantes = prods[pidx].variantes || [];
        const ubiFinal = art.ubicacionRec || 'General';
        const colFinal = art.colorRec || 'General';
        
        const existente = prods[pidx].variantes.find(
            v => (v.ubicacion || 'General').toUpperCase() === ubiFinal.toUpperCase() && 
                 (v.color || 'General').toUpperCase() === colFinal.toUpperCase()
        );
        if (existente) {
            existente.stock = (Number(existente.stock) || 0) + art.cantidadRec;
        } else {
            prods[pidx].variantes.push({ ubicacion: ubiFinal, color: colFinal, stock: art.cantidadRec });
        }
    }
});
StorageService.set('productos', prods);
productos = prods;          // ← ESTA línea sincroniza el global
window.productos = prods;   // ← por si se referencia con window. en otro lado

    // Movimientos de inventario
    const kardex = StorageService.get('movimientosInventario', []);  // ← leer fresco
itemsRecibidos.forEach(art => {
    const concepto = art.colorRec
        ? `Recepción OC ${oc.folio} — ${oc.proveedorNombre} (${art.colorRec})`
        : `Recepción OC ${oc.folio} — ${oc.proveedorNombre}`;
    kardex.push({
        id: Date.now() + Math.random(),
        productoId: art.productoId,
        productoNombre: art.nombre,
        tipo: 'entrada',
        cantidad: art.cantidadRec,
        costoUnitario: Number(art.costo || art.costoUnitario || 0),
        costo: Number(art.costo || art.costoUnitario || 0),
        precioCompra: Number(art.costo || art.costoUnitario || 0),
        valor: Number(art.cantidadRec || 0) * Number(art.costo || art.costoUnitario || 0),
        proveedor: oc.proveedorNombre || '',
        referencia: oc.folio || oc.id || '',
        compraId: oc.id || null,
        ubicacion: art.ubicacionRec || 'General',
        color: art.colorRec || 'General',
        concepto,
        fecha: window.formatearFechaMX(fechaRec)
    });
});
StorageService.set('movimientosInventario', kardex);
movimientosInventario = kardex;   // ✅ sincronizar global

    // ── 2. Afectar flujo si hay pago ───────────────────────────
    if (metodoPago !== 'no' && montoPagado > 0) {
        _egresarCuenta({
            monto: montoPagado,
            cuentaId: cuentaPagoId,
            etiqueta: cuentaPagoEtiqueta,
            concepto: `Pago recepción OC ${oc.folio} — ${oc.proveedorNombre}`,
            referencia: `OC-REC-${oc.id}`,
            idOperacion: `OC-REC-${oc.id}`
        });
    }

    // ── 3. Si queda saldo sin pagar → Cuenta por Pagar o Consignación ─────────
    const saldoRestante = Math.max(0, totalRecibido - montoPagado - anticipoAplicadoRecepcion);
    
    if (esConsignacionOC) {
            if (anticipo > 0.01) {
                const refBase = oc.anticipoTransferidoDeOC || oc.id;
                _registrarAnticipoConsignacionGlobal({
                    monto: anticipo,
                    cuentaId: oc.condicionesComerciales?.cuentaOrigen || null,
                    cuenta: 'Anticipo OC',
                    proveedor: oc.proveedorNombre,
                    proveedorId: oc.proveedorId || null,
                    fecha: window.localISO ? window.localISO(fechaRec) : fechaRec.toISOString(),
                    nota: 'Anticipo global recuperado desde recepcion de OC a consignacion',
                    referencia: `ANTICIPO-OC-${refBase}`,
                    origen: 'ordenCompra'
                });
            }
            if (montoPagado > 0.01) {
                _registrarAnticipoConsignacionGlobal({
                    monto: montoPagado,
                    cuentaId: cuentaPagoId || null,
                    cuenta: cuentaPagoEtiqueta || 'Pago recepcion OC',
                    proveedor: oc.proveedorNombre,
                    proveedorId: oc.proveedorId || null,
                    fecha: window.localISO ? window.localISO(fechaRec) : fechaRec.toISOString(),
                    nota: `Pago de recepcion registrado como anticipo global de consignacion (${oc.folio})`,
                    referencia: `OC-REC-${oc.id}`,
                    origen: 'recepcionOC'
                });
            }
            _agregarConsignacionesActivasDesdeArticulos({
                compraId: oc.id,
                proveedor: oc.proveedorNombre,
                proveedorId: oc.proveedorId || null,
                folioOrigen: oc.folio,
                fecha: window.formatearFechaCortaMX(fechaRec),
                articulos: itemsRecibidos,
                cantidadCampo: 'cantidadRec',
                factorCosto: 1,
                origen: 'ordenCompra'
            });
    } else if (saldoRestante > 0.01) {
            const fechaVenc = new Date();
            fechaVenc.setDate(fechaVenc.getDate() + 30);
            const abonosAplicadosCxp = [];
            if (anticipoAplicadoRecepcion > 0.01) {
                abonosAplicadosCxp.push({
                    fecha: window.localISO ? window.localISO(fechaRec) : fechaRec.toISOString(),
                    monto: anticipoAplicadoRecepcion,
                    cuenta: 'Anticipo OC',
                    nota: `Anticipo aplicado desde ${oc.folio}`
                });
            }
            if (montoPagado > 0.01) {
                abonosAplicadosCxp.push({
                    fecha: window.localISO ? window.localISO(fechaRec) : fechaRec.toISOString(),
                    monto: montoPagado,
                    cuenta: cuentaPagoEtiqueta,
                    cuentaId: cuentaPagoId,
                    nota: `Pago registrado al recibir ${oc.folio}`
                });
            }
            let cxp = StorageService.get('cuentasPorPagar', []);
            cxp.push({
                id: Date.now() + 7,
                compraId: oc.id,
                proveedor: oc.proveedorNombre,
                producto: itemsRecibidos.map(a => a.nombre).join(', '),
                articulos: itemsRecibidos,
                total: totalRecibido, 
                saldoPendiente: saldoRestante, 
                abonos: abonosAplicadosCxp,
                noRescatarPagosOC: true,
                metodo: 'credito_proveedor',
                formaPagoTexto: `Saldo OC ${oc.folio}`,
                plazo: 30,
                fecha: fechaStr,
                vencimiento: window.formatearFechaCortaMX(fechaVenc),
                vencimientoIso: window.localISO(fechaVenc)
            });
            StorageService.set('cuentasPorPagar', cxp);
    }

    // ── 4. Back order: nueva OC en Borrador con referencia a OC padre ──
    let boId = null;
    if (itemsBackOrder.length > 0) {
        const totalBackOrder = itemsBackOrder.reduce((s, a) => s + a.subtotal, 0);
        const anticipoBackOrder = Math.min(anticipoDisponibleBackOrder, totalBackOrder);
        const ocBO = {
            id: Date.now() + 1,
            folio: oc.folio + '-BO',
            proveedorId: oc.proveedorId,
            proveedorNombre: oc.proveedorNombre,
            articulos: itemsBackOrder,
            total: totalBackOrder,
            fechaEmision: Date.now(),
            fechaEntregaEstimada: null,
            estado: 'Borrador',
            notas: `Back Order de ${oc.folio}`,
            condicionesComerciales: { ...oc.condicionesComerciales },
            anticipo_pagado: anticipoBackOrder,
            anticipoTransferidoDeOC: oc.id,
            anticipoEsTransferido: anticipoBackOrder > 0,
            saldoPendiente: Math.max(0, totalBackOrder - anticipoBackOrder),
            ocPadre: oc.id
        };
        boId = ocBO.id;
        lista.push(ocBO);
    }

    // ── 5. Actualizar estado OC ────────────────────────────────
    lista[idx].estado          = itemsBackOrder.length > 0 ? 'Recibida Parcial' : 'Recibida';
    lista[idx].anticipo_pagado = anticipoAplicadoRecepcion + montoPagado;
    lista[idx].anticipoTransferidoBackOrder = anticipoDisponibleBackOrder;
    lista[idx].fechaRecepcion  = window.localISO(fechaRec);
    if (boId) lista[idx].backOrderId = boId;
    StorageService.set('ordenesCompra', lista);

    // ── 6. Guardar compra para historial ───────────────────────
    const compraReg = {
        id: Date.now() + 2,
        folio: oc.folio + '-REC',
        proveedor: oc.proveedorNombre,
        proveedorId: oc.proveedorId,
        articulos: itemsRecibidos.map(a => ({ ...a, cantidad: a.cantidadRec })),
        total: totalRecibido,
        fecha: window.localISO(fechaRec),
        metodo: esConsignacionOC ? 'consignacion' : (metodoPago !== 'no' && montoPagado >= totalRecibido ? metodoPago : 'credito'),
        saldoPendiente: Math.max(0, saldoRestante),
        pagado: montoPagado,
        totalPagado: montoPagado + anticipoAplicadoRecepcion,
        montoPagado,
        anticipo_pagado: anticipoAplicadoRecepcion,
        anticipoAplicado: anticipoAplicadoRecepcion,
        anticipoTransferidoBackOrder: anticipoDisponibleBackOrder,
        ordenCompraId: oc.id,
        esConsignacion: esConsignacionOC,
        pago: metodoPago !== 'no' ? { monto: montoPagado, metodo: metodoPago, cuenta: cuentaPagoId, etiqueta: cuentaPagoEtiqueta } : null
    };
    const comprasList = StorageService.get('compras', []);
    comprasList.push(compraReg);
    StorageService.set('compras', comprasList);

    document.querySelector('[data-modal="recepcion-oc"]')?.remove();
    renderListaOrdenesCompra();

    // Imprimir documento de recepción
    imprimirRecepcionCompra(oc, compraReg, itemsBackOrder, {
        montoPagado, metodoPago, cuentaPagoEtiqueta, saldoRestante, notas, fechaStr, anticipoAplicado: anticipoAplicadoRecepcion
    });
}

function imprimirRecepcionCompra(oc, compra, backorder, pagoDatos) {
    const cfg     = StorageService.get('configEmpresa', {});
    const empresa = cfg.nombre || 'Mueblería Mi Pueblito';
    const { montoPagado, metodoPago, cuentaPagoEtiqueta, saldoRestante, notas, fechaStr, anticipoAplicado = 0 } = pagoDatos;
    const rowsRecibidos = (compra.articulos || []).map(a => `
        <tr>
            <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;">${a.nombre || a.nombre}</td>
            <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${a.cantidadRec ?? a.cantidad}</td>
            <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${dinero(a.costo)}</td>
            <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:bold;">${dinero((a.cantidadRec ?? a.cantidad) * a.costo)}</td>
        </tr>`).join('');
    const rowsBO = (backorder || []).map(a => `
        <tr>
            <td style="padding:7px 12px;border-bottom:1px solid #fde68a;">${a.nombre}</td>
            <td style="padding:7px 12px;border-bottom:1px solid #fde68a;text-align:center;color:#d97706;font-weight:bold;">${a.cantidad}</td>
            <td style="padding:7px 12px;border-bottom:1px solid #fde68a;text-align:right;">${dinero(a.costo)}</td>
            <td style="padding:7px 12px;border-bottom:1px solid #fde68a;text-align:right;">${dinero(a.subtotal)}</td>
        </tr>`).join('');
    const metodosLabel = { contado: '💵 Efectivo', debito: '💳 Tarjeta Débito', no: '— Sin pago —' };
    // Calcular totales de la recepción (no de la OC)
    const totalRecibido = compra.total;
    // El saldo pendiente es lo recibido menos lo pagado en esta recepción
    const saldoPendienteRecepcion = Math.max(0, totalRecibido - montoPagado - anticipoAplicado);
    const recepcionHTML = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <title>Recepción ${compra.folio}</title>
    <style>
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:Arial,sans-serif;padding:32px;color:#111;font-size:13px;}
        h1{font-size:22px;color:#1e40af;margin-bottom:4px;}
        table{width:100%;border-collapse:collapse;}
        th{background:#f3f4f6;padding:9px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;}
        .badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:bold;}
        .firma{border-top:1.5px solid #374151;padding-top:8px;margin-top:52px;text-align:center;font-weight:bold;font-size:13px;}
        @media print{button{display:none!important;}@page{margin:14mm;}}
    </style>
    </head><body>
    <!-- ENCABEZADO -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #1e40af;">
        <div>
            <img src="img/Logo.svg" style="height:56px;" onerror="this.outerHTML='<span style=\\'font-size:28px;\\'>🏛️</span>'">
            <div style="font-size:18px;font-weight:bold;color:#1e40af;margin-top:4px;">${empresa}</div>
        </div>
        <div style="text-align:right;">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;font-weight:bold;">Documento de Recepción</div>
            <div style="font-size:22px;font-weight:bold;color:#1e40af;">${compra.folio}</div>
            <div style="margin-top:4px;font-size:13px;">Fecha: <strong>${fechaStr}</strong></div>
        </div>
    </div>

    <!-- DATOS -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
        <div style="background:#f8fafc;border-radius:8px;padding:14px;">
            <div style="font-size:11px;color:#6b7280;font-weight:bold;text-transform:uppercase;margin-bottom:8px;">Proveedor</div>
            <div style="font-size:16px;font-weight:bold;">${oc.proveedorNombre}</div>
        </div>
        <div style="background:#f8fafc;border-radius:8px;padding:14px;">
            <div style="font-size:11px;color:#6b7280;font-weight:bold;text-transform:uppercase;margin-bottom:8px;">Orden de Compra Origen</div>
            <div style="font-size:16px;font-weight:bold;">${oc.folio}</div>
            <div style="margin-top:4px;">
                <span class="badge" style="background:${oc.estado === 'Recibida' ? '#dcfce7' : '#fef3c7'};color:${oc.estado === 'Recibida' ? '#16a34a' : '#92400e'};">
                    ${oc.estado}
                </span>
            </div>
            ${(oc.backOrderId ? `<div style='font-size:11px;color:#d97706;margin-top:4px;'>→ Back Order: <b>${oc.folio}-BO</b></div>` : '')}
            ${(oc.ocPadre ? `<div style='font-size:11px;color:#d97706;margin-top:4px;'>Back Order de: <b>${(_getOrdenesCompra().find(x=>x.id===oc.ocPadre)?.folio)||''}</b></div>` : '')}
        </div>
    </div>

    <!-- ARTÍCULOS RECIBIDOS -->
    <div style="font-size:13px;font-weight:bold;color:#1e40af;margin-bottom:8px;text-transform:uppercase;">✅ Artículos Recibidos</div>
    <table style="margin-bottom:20px;">
        <thead><tr>
            <th>Artículo</th>
            <th style="text-align:center;">Cant. Recibida</th>
            <th style="text-align:right;">Costo Unit.</th>
            <th style="text-align:right;">Subtotal</th>
        </tr></thead>
        <tbody>${rowsRecibidos}</tbody>
        <tfoot>
            <tr style="background:#eff6ff;">
                <td colspan="3" style="padding:10px 12px;font-weight:bold;text-align:right;">TOTAL RECIBIDO:</td>
                <td style="padding:10px 12px;font-weight:bold;font-size:16px;text-align:right;color:#1e40af;">${dinero(totalRecibido)}</td>
            </tr>
        </tfoot>
    </table>

    <!-- BACK ORDER -->
    ${backorder && backorder.length > 0 ? `
    <div style="font-size:13px;font-weight:bold;color:#d97706;margin-bottom:8px;text-transform:uppercase;">⏳ Back Order — Pendiente de Recibir</div>
    <table style="margin-bottom:20px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;">
        <thead><tr style="background:#fef3c7;">
            <th>Artículo</th>
            <th style="text-align:center;">Cant. Pendiente</th>
            <th style="text-align:right;">Costo Unit.</th>
            <th style="text-align:right;">Subtotal Est.</th>
        </tr></thead>
        <tbody>${rowsBO}</tbody>
    </table>
    <p style="font-size:11px;color:#92400e;margin-bottom:20px;">Se generó automáticamente una nueva OC (${oc.folio}-BO) para el back order.</p>` : ''}

    <!-- PAGO -->
    <div style="background:${metodoPago !== 'no' ? '#f0fdf4' : '#f8fafc'};border:1px solid ${metodoPago !== 'no' ? '#86efac' : '#e2e8f0'};border-radius:8px;padding:16px;margin-bottom:24px;">
        <div style="font-size:13px;font-weight:bold;margin-bottom:10px;color:${metodoPago !== 'no' ? '#15803d' : '#374151'};">
            💳 Estado del Pago
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;text-align:center;">
            <div>
                <div style="font-size:11px;color:#6b7280;">Total Recibido</div>
                <div style="font-size:16px;font-weight:bold;">${dinero(totalRecibido)}</div>
            </div>
            <div>
                <div style="font-size:11px;color:#6b7280;">Anticipo aplicado</div>
                <div style="font-size:16px;font-weight:bold;color:${anticipoAplicado > 0 ? '#2563eb' : '#9ca3af'};">${dinero(anticipoAplicado)}</div>
            </div>
            <div>
                <div style="font-size:11px;color:#6b7280;">Pagado Hoy (${metodosLabel[metodoPago] || '-'})</div>
                <div style="font-size:16px;font-weight:bold;color:${montoPagado > 0 ? '#16a34a' : '#9ca3af'};">
                    ${dinero(montoPagado)}
                </div>
            </div>
            <div>
                <div style="font-size:11px;color:#6b7280;">Saldo Pendiente de esta recepción</div>
                <div style="font-size:16px;font-weight:bold;color:${saldoPendienteRecepcion > 0 ? '#dc2626' : '#16a34a'};">${dinero(saldoPendienteRecepcion)}</div>
            </div>
        </div>
    </div>

    ${notas ? `
    <div style="background:#f8fafc;border-radius:8px;padding:14px;margin-bottom:24px;">
        <strong>Observaciones:</strong><br><span style="color:#374151;">${notas}</span>
    </div>` : ''}

    <!-- FIRMAS -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:40px;margin-top:20px;">
        <div><div class="firma">Entregado por<br><span style="font-weight:normal;color:#6b7280;">(Proveedor)</span></div></div>
        <div><div class="firma">Recibido por<br><span style="font-weight:normal;color:#6b7280;">(Almacén)</span></div></div>
        <div><div class="firma">Autorizado por<br><span style="font-weight:normal;color:#6b7280;">(Gerencia)</span></div></div>
    </div>

    <!-- BOTÓN IMPRIMIR -->
    <div style="text-align:center;margin-top:28px;">
        <button onclick="window.print()" style="padding:11px 28px;background:#1e40af;color:white;border:none;border-radius:8px;cursor:pointer;font-size:15px;font-weight:bold;">🖨️ Imprimir</button>
    </div>
    </body></html>`;
    if (window.TicketService?.elegirFormato) {
        const pageSize = ((compra.articulos || []).length + (backorder || []).length) <= 4 && !notas ? 'half-letter' : 'letter';
        window.TicketService.elegirFormato({
            html: recepcionHTML,
            title: `Recepcion ${compra.folio}`,
            filename: `recepcion_${compra.folio}`,
            pageSize
        });
        return;
    }
    if (window.TicketService?.openDocument) {
        const pageSize = ((compra.articulos || []).length + (backorder || []).length) <= 4 && !notas ? 'half-letter' : 'letter';
        window.TicketService.openDocument(recepcionHTML, { title: `Recepcion ${compra.folio}`, filename: `recepcion_${compra.folio}`, pageSize });
        return;
    }
    const w = window.open('', '_blank', 'width=780,height=960');
    w.document.write(recepcionHTML);
    w.document.close();
}

function renderListaOrdenesCompra() {
    const cont = document.getElementById('contenidoOrdenesCompra');
    if (!cont) return;
        const lista = _getOrdenesCompra();
        const estadoColors = {
            Borrador:  '#9ca3af',
            Enviada:   '#2563eb',
            'Recibida Parcial': '#d97706',
            Parcial:   '#d97706',
            Recibida:  '#16a34a',
            Cancelada: '#dc2626'
        };
        // Filtrar: solo mostrar OCs abiertas y back orders pendientes
        const activos = lista.filter(oc =>
            (oc.estado === 'Borrador' || oc.estado === 'Enviada') ||
            (oc.folio.endsWith('-BO') && oc.estado !== 'Recibida')
        );
        const rows = activos.slice().reverse().map(oc => {
                const color    = estadoColors[oc.estado] || '#374151';
                const esActiva = oc.estado !== 'Recibida' && oc.estado !== 'Cancelada' && oc.estado !== 'Recibida Parcial';
                // Mostrar vínculo a OC padre si es back order
                const boVinculo = oc.ocPadre ? `<br><span style="font-size:11px;color:#d97706;">BO de <b>${(lista.find(x=>x.id===oc.ocPadre)?.folio)||''}</b></span>` : '';
                // Mostrar vínculo a back order si existe
                const boHijo = oc.backOrderId ? `<br><span style="font-size:11px;color:#d97706;">→ BO: <b>${(lista.find(x=>x.id===oc.backOrderId)?.folio)||''}</b></span>` : '';
                
                // Calcular saldo pendiente (compatible con OCs viejas y nuevas)
                const anticipoPrevio = oc.anticipo_pagado || 0;
                let saldoPendiente = oc.saldoPendiente !== undefined ? oc.saldoPendiente : Math.max(0, oc.total - anticipoPrevio);

                return `<tr style="border-bottom:1px solid #f3f4f6;">
                    <td style="padding:10px;font-weight:bold;">${oc.folio}${boVinculo}${boHijo}</td>
                    <td style="padding:10px;">${oc.proveedorNombre}</td>
                    <td style="padding:10px;">${window.formatearFechaCortaMX(oc.fechaEmision)}</td>
                    <td style="padding:10px;">${oc.fechaEntregaEstimada ? window.formatearFechaCortaMX(oc.fechaEntregaEstimada) : '—'}</td>
                    <td style="padding:10px;text-align:right;">
                        <strong style="color:#1e40af;">${dinero(oc.total)}</strong><br>
                        <span style="font-size:11px;color:#dc2626;">Saldo: ${dinero(saldoPendiente)}</span>
                    </td>
                    <td style="padding:10px;text-align:center;">
                        <span style="background:${color}20;color:${color};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:bold;">${oc.estado}</span>
                    </td>
                    <td style="padding:10px;text-align:center;">
                        <div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap;">
                            <button onclick="imprimirOrdenCompra(${oc.id})" title="Imprimir OC" style="background:none;border:none;cursor:pointer;font-size:17px;">🖨️</button>
                            <button onclick="abrirModalAbonoOC(${oc.id})" title="Abonar a OC" style="background:none;border:none;cursor:pointer;font-size:17px; opacity:${saldoPendiente <= 0 ? '0.3' : '1'};" ${saldoPendiente <= 0 ? 'disabled' : ''}>💰</button>
                            ${esActiva ? `<button onclick="recibirOrdenCompra(${oc.id})" title="Recibir mercancía" style="background:none;border:none;cursor:pointer;font-size:17px;">📦</button>` : ''}
                            ${(oc.estado === 'Borrador' || oc.estado === 'Enviada') ? `<button onclick="editarOrdenCompra(${oc.id})" title="Editar" style="background:none;border:none;cursor:pointer;font-size:17px;">✏️</button>` : ''}
                            ${(oc.estado === 'Borrador' || oc.estado === 'Enviada') ? `<button onclick="confirmarEliminarOC(${oc.id})" title="Cancelar y Revertir Orden" style="background:none;border:none;cursor:pointer;font-size:17px;">🗑️</button>` : ''}
                    </td>
                </tr>`;
        }).join('');

        cont.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <h3 style="margin:0;color:#1e40af;">📋 Órdenes de Compra</h3>
                <button onclick="abrirNuevaOrdenCompra()" style="padding:10px 18px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">➕ Nueva OC</button>
        </div>
        <div style="background:white;padding:20px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
                ${activos.length === 0 ? '<p style="color:#9ca3af;text-align:center;padding:30px;">Sin órdenes de compra.</p>' : `
                <div style="overflow-x:auto;">
                    <table style="width:100%;border-collapse:collapse;font-size:14px;">
                        <thead><tr style="background:#f3f4f6;">
                            <th style="padding:10px;text-align:left;">Folio</th>
                            <th style="padding:10px;text-align:left;">Proveedor</th>
                            <th style="padding:10px;text-align:left;">Emisión</th>
                            <th style="padding:10px;text-align:left;">Entrega Est.</th>
                            <th style="padding:10px;text-align:right;">Total</th>
                            <th style="padding:10px;text-align:center;">Estado</th>
                            <th style="padding:10px;text-align:center;">Acciones</th>
                        </tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`}
        </div>`;
}

function editarOrdenCompra(id) {
    const lista = _getOrdenesCompra();
    const oc    = lista.find(x => x.id === id);
    if (!oc) return alert('OC no encontrada.');
    if (oc.estado === 'Recibida')  return alert('No se puede editar una OC ya recibida.');
    if (oc.estado === 'Cancelada') return alert('No se puede editar una OC cancelada.');

    const provs    = StorageService.get('proveedores', []);
    const prods    = StorageService.get('productos',   []);
    const selProvs = provs.map(p =>
        `<option value="${p.id}" ${String(oc.proveedorId) === String(p.id) ? 'selected' : ''}>${p.nombre}</option>`
    ).join('');
    const selProds = prods.map(p =>
        `<option value="${p.id}" data-costo="${p.costo || 0}">${p.nombre} (${dinero(p.costo || 0)})</option>`
    ).join('');

    const html = `
    <div data-modal="editar-oc" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:20px;">
      <div style="background:white;border-radius:12px;width:100%;max-width:950px;padding:30px;margin:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <h2 style="margin:0;color:#1e40af;">✏️ Editar OC — ${oc.folio}</h2>
            <button onclick="document.querySelector('[data-modal=editar-oc]')?.remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#9ca3af;">✕</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">PROVEEDOR</label>
            <select id="editOcProveedor" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
              <option value="">-- Selecciona proveedor --</option>${selProvs}
            </select>
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">FECHA ENTREGA ESTIMADA</label>
            <input type="date" id="editOcFechaEntrega" value="${oc.fechaEntregaEstimada?.substring(0,10) || ''}"
                   style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:end;margin-bottom:12px;">
          <div>
            <input type="hidden" id="editOcProductoSel" value="">
            <div style="display:flex;align-items:center;gap:6px;">
                <span id="editOcProductoSel-display"
                      style="flex:1;padding:9px;border:1px solid #d1d5db;border-radius:6px;background:#f9fafb;color:#6b7280;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    Sin seleccionar
                </span>
                <button type="button"
        onclick="abrirSelectorProducto({titulo:'🔍 Seleccionar Producto',onSeleccion:function(p){document.getElementById('editOcProductoSel').value=p.id;var d=document.getElementById('editOcProductoSel-display');d.textContent=p.nombre+' ('+dinero(p.costo||0)+')';d.style.color='#111827';alert('💡 Referencia de costo:\\nEl último costo registrado para este producto es de: $' + (p.costo || 0));}})"
        style="padding:9px 12px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;white-space:nowrap;font-size:13px;">
    🔍 Buscar
</button>
            </div>
          </div>
          <input type="number" id="editOcCantidad" value="1" min="1" style="width:70px;padding:9px;border:1px solid #d1d5db;border-radius:6px;">
          <button onclick="agregarArticuloEditOC()" style="padding:9px 14px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;">➕</button>
        </div>
        <div id="editTablaArticulosOC" style="margin-bottom:14px;"></div>
        <div style="margin-bottom:12px;">
          <label style="font-size:12px;font-weight:bold;color:#374151;">NOTAS</label>
          <textarea id="editOcNotas" rows="2" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">${oc.notas || ''}</textarea>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <strong>Total: <span id="editOcTotal" style="color:#1e40af;font-size:18px;">$0.00</span></strong>
        </div>
        <div style="display:flex;gap:10px;">
          <button onclick="guardarEdicionOC(${id})" style="flex:1;padding:12px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">💾 Guardar Cambios</button>
          <button onclick="document.querySelector('[data-modal=editar-oc]')?.remove()" style="padding:12px 20px;background:#6b7280;color:white;border:none;border-radius:6px;cursor:pointer;">✕</button>
        </div>
      </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    window._editArticulosOC = JSON.parse(JSON.stringify(oc.articulos));
    _renderEditTablaOC();
}

function agregarArticuloEditOC() {
    const sel  = document.getElementById('editOcProductoSel');
    const cant = parseInt(document.getElementById('editOcCantidad').value) || 1;
    if (!sel.value) return;
    const prods = StorageService.get('productos', []);
    const prod  = prods.find(p => String(p.id) === String(sel.value) && _comprasProductoActivo(p));
    if (!prod) return alert('Este producto esta inactivo y no se puede agregar a la orden.');
    if (!window._editArticulosOC) window._editArticulosOC = [];
    const idx = window._editArticulosOC.findIndex(a => String(a.productoId) === String(prod.id));
    if (idx !== -1) {
        window._editArticulosOC[idx].cantidad += cant;
        window._editArticulosOC[idx].subtotal  = window._editArticulosOC[idx].cantidad * prod.costo;
    } else {
        window._editArticulosOC.push({ productoId: prod.id, nombre: prod.nombre, costo: prod.costo || 0, cantidad: cant, subtotal: cant * (prod.costo || 0) });
    }
    // Resetear picker de producto en editar OC
    sel.value = '';
    const displayEditOC = document.getElementById('editOcProductoSel-display');
    if (displayEditOC) { displayEditOC.textContent = 'Sin seleccionar'; displayEditOC.style.color = '#6b7280'; }
    document.getElementById('editOcCantidad').value = 1;
    _renderEditTablaOC();
}

function _renderEditTablaOC() {
    const cont = document.getElementById('editTablaArticulosOC');
    if (!cont) return;
    const arts = window._editArticulosOC || [];
    if (arts.length === 0) { cont.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:10px;">Sin artículos</p>'; document.getElementById('editOcTotal').textContent = dinero(0); return; }
    let total = 0;
    const rows = arts.map((a, i) => { total += a.subtotal; return `<tr>
        <td style="padding:8px;">${a.nombre}</td>
        <td style="padding:8px;text-align:center;">${dinero(a.costo)}</td>
        <td style="padding:8px;text-align:center;">${a.cantidad}</td>
        <td style="padding:8px;text-align:right;">${dinero(a.subtotal)}</td>
        <td style="padding:8px;text-align:center;"><button onclick="window._editArticulosOC.splice(${i},1);_renderEditTablaOC();" style="background:none;border:none;cursor:pointer;font-size:16px;">🗑️</button></td>
    </tr>`; }).join('');
    cont.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:14px;"><thead><tr style="background:#f3f4f6;"><th style="padding:8px;">Artículo</th><th style="padding:8px;text-align:center;">Costo</th><th style="padding:8px;text-align:center;">Cant.</th><th style="padding:8px;text-align:right;">Subtotal</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
    document.getElementById('editOcTotal').textContent = dinero(total);
}

function guardarEdicionOC(id) {
    const arts = window._editArticulosOC || [];
    if (arts.length === 0) return alert('⚠️ Agrega al menos un artículo.');
    
    const provId       = document.getElementById('editOcProveedor')?.value;
    const fechaEntrega = document.getElementById('editOcFechaEntrega')?.value;
    const notas        = document.getElementById('editOcNotas')?.value.trim() || '';
    
    const provs = StorageService.get('proveedores', []);
    const prov  = provs.find(p => String(p.id) === String(provId));
    
    const lista = _getOrdenesCompra();
    const idx   = lista.findIndex(x => x.id === id);
    if (idx === -1) return;

    // 1. SANITIZACIÓN DE ARTÍCULOS (Filtro anti-undefined para Firebase)
    const articulosLimpios = arts.map(a => ({
        productoId: a.productoId || null,
        nombre: a.nombre || "Sin nombre",
        costo: parseFloat(a.costo) || 0,
        cantidad: parseInt(a.cantidad) || 0,
        subtotal: parseFloat(a.subtotal) || 0,
        caracteristicas: a.caracteristicas || "",
        yaEnInventario: Boolean(a.yaEnInventario)
    }));

    // 2. MATEMÁTICAS ESTRICTAS (La cura al Saldo Fantasma)
    const totalVerdadero = articulosLimpios.reduce((s, a) => s + a.subtotal, 0);
    const anticipoPrevio = parseFloat(lista[idx].anticipo_pagado) || 0;
    const saldoVerdadero = Math.max(0, totalVerdadero - anticipoPrevio);

    // 3. ACTUALIZACIÓN DEL OBJETO
    lista[idx] = {
        ...lista[idx],
        proveedorId:           provId || lista[idx].proveedorId || null,
        proveedorNombre:       prov ? prov.nombre : (lista[idx].proveedorNombre || "General"),
        articulos:             articulosLimpios,
        total:                 totalVerdadero,
        saldoPendiente:        saldoVerdadero, // <- Ahora el saldo camina de la mano del total
        fechaEntregaEstimada:  fechaEntrega || null,
        notas:                 notas || "",
        fechaModificacion:     typeof window.localISO === 'function' ? window.localISO(new Date()) : new Date().toISOString()
    };

    // 4. DESTRUCTOR DE UNDEFINED (Última línea de defensa)
    Object.keys(lista[idx]).forEach(k => (lista[idx][k] === undefined) && delete lista[idx][k]);

    StorageService.set('ordenesCompra', lista);
    document.querySelector('[data-modal="editar-oc"]')?.remove();
    alert('✅ Orden de compra actualizada y balanceada matemáticamente.');
    
    if (typeof renderListaOrdenesCompra === 'function') renderListaOrdenesCompra();
}
// Función auxiliar para listar tus cuentas de débito
function _generarOpcionesCuentasDebito() {
    const cuentas = StorageService.get("cuentas-bancarias", []);  // ← corregido: guión igual que el resto del sistema
    let opciones = `<option value="efectivo">💵 Efectivo (Caja Chica)</option>`;
    
    cuentas.forEach(c => {
        // Buscamos las que tengan la palabra "debito" en su tipo
        if (c.tipo && c.tipo.toLowerCase().includes("debito")) {
            opciones += `<option value="${c.nombre}">💳 Débito: ${c.nombre}</option>`;
        }
    });
    return opciones;
}
// ============================================================
// MÓDULO DE REQUISICIONES Y COMPRAS MULTI-ARTÍCULO
// ============================================================

function renderRequisiciones() {
    const contenedor = document.getElementById("contenidoRequisiciones");
    if (!contenedor) return;

    const reqs = StorageService.get("requisicionesCompra", []).filter(r => r.estatus === "Pendiente");

    if (reqs.length === 0) {
        contenedor.innerHTML = `
            <div style="background:white; padding:40px; border-radius:10px; text-align:center; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                <h2 style="color:#16a34a;">✅ Todo al día</h2>
                <p style="color:#6b7280;">No hay requisiciones pendientes. Todo lo vendido tenía stock.</p>
            </div>`;
        return;
    }

    let filas = reqs.map(r => `
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding:10px; text-align:center;">
                <input type="checkbox" class="chk-req" value="${r.id}" style="width:18px; height:18px; cursor:pointer;">
            </td>
            <td style="padding:10px;">${r.fecha}</td>
            <td style="padding:10px; font-weight:bold; color:#1e40af;">${r.folioVenta}</td>
            <td style="padding:10px;">${r.producto}</td>
            <td style="padding:10px; text-align:center; font-weight:bold;">${r.cantidad}</td>
            <td style="padding:10px;"><span style="background:#fef3c7; color:#d97706; padding:4px 8px; border-radius:4px; font-size:12px;">${r.estatus}</span></td>
        </tr>
    `).join('');

    contenedor.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:10px;">
            <h2 style="margin:0; color:#1e40af;">📋 Requisiciones Pendientes</h2>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <button onclick="iniciarOrdenDesdeRequisiciones()" 
                        style="padding:10px 15px; background:#1e40af; color:white; border:none; border-radius:6px; font-weight:bold; font-size:13px; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                    🛒 Nueva OC
                </button>
                <button onclick="abrirModalAgregarA_OC_Existente()" 
                        style="padding:10px 15px; background:#d97706; color:white; border:none; border-radius:6px; font-weight:bold; font-size:13px; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                    📥 Añadir a OC Existente
                </button>
                <button onclick="iniciarCompraDirectaDesdeRequisiciones()" 
                        style="padding:10px 15px; background:#059669; color:white; border:none; border-radius:6px; font-weight:bold; font-size:13px; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                    🚀 Compra directa
                </button>
                <button onclick="window.marcarRequisicionesResueltasMasivo()" 
        style="padding:10px 15px; background:#10b981; color:white; border:none; border-radius:6px; font-weight:bold; font-size:13px; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.1);" title="Quita de la lista los artículos seleccionados">
    ✔️ Ya lo tengo
</button>
            </div>
        </div>

        <div style="background:white; border-radius:10px; padding:20px; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
            <table style="width:100%; border-collapse:collapse; font-size:14px;">
                <thead>
                    <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0; color:#475569;">
                        <th style="padding:12px; text-align:center;"><input type="checkbox" onchange="document.querySelectorAll('.chk-req').forEach(c => c.checked = this.checked)" style="width:18px; height:18px;"></th>
                        <th style="padding:12px; text-align:left;">Fecha</th>
                        <th style="padding:12px; text-align:left;">Folio Venta</th>
                        <th style="padding:12px; text-align:left;">Producto / Variante</th>
                        <th style="padding:12px; text-align:center;">Cantidad</th>
                        <th style="padding:12px; text-align:left;">Estatus</th>
                    </tr>
                </thead>
                <tbody>${filas}</tbody>
            </table>
        </div>
    `;
}

function iniciarOrdenDesdeRequisiciones() {
    const seleccionados = Array.from(document.querySelectorAll('.chk-req:checked')).map(cb => cb.value);
    if (seleccionados.length === 0) return alert("⚠️ Selecciona al menos una requisición.");

    // 1. Abrimos tu modal oficial de Orden de Compra
    abrirNuevaOrdenCompra();

    // 2. Le inyectamos los productos seleccionados directamente
    const reqsTotales = StorageService.get("requisicionesCompra", []);
    const prods = StorageService.get("productos", []);
    
    window._articulosOC = [];
    window._requisicionesVinculadasA_OC = seleccionados;

    seleccionados.forEach(idReq => {
        const req = reqsTotales.find(r => String(r.id) === String(idReq));
        if (req) {
            const prod = prods.find(p => String(p.id) === String(req.productoId) && _comprasProductoActivo(p));
            if (!prod) return;
            window._articulosOC.push({
                productoId: req.productoId,
                nombre: req.producto,
                cantidad: parseInt(req.cantidad) || 1,
                costo: prod ? parseFloat(prod.costo) : 0,
                subtotal: (parseInt(req.cantidad) || 1) * (prod ? parseFloat(prod.costo) : 0),
                caracteristicas: `Req. Venta: ${req.folioVenta}`
            });
        }
    });

    _renderTablaArticulosOC();
}

function iniciarCompraDirectaDesdeRequisiciones() {
    const seleccionados = Array.from(document.querySelectorAll('.chk-req:checked')).map(cb => cb.value);
    if (seleccionados.length === 0) return alert("⚠️ Selecciona al menos una requisición.");

    // 1. Abrimos el nuevo modal de Compra Directa Multi-Artículo
    abrirModalCompraDirectaMulti();

    // 2. Le inyectamos los productos seleccionados
    const reqsTotales = StorageService.get("requisicionesCompra", []);
    const prods = StorageService.get("productos", []);
    
    window._articulosCompraDirecta = [];
    window._requisicionesVinculadasA_CD = seleccionados;

    seleccionados.forEach(idReq => {
        const req = reqsTotales.find(r => String(r.id) === String(idReq));
        if (req) {
            const prod = prods.find(p => String(p.id) === String(req.productoId) && _comprasProductoActivo(p));
            if (!prod) return;
            window._articulosCompraDirecta.push({
                productoId: req.productoId,
                nombre: req.producto,
                cantidad: parseInt(req.cantidad) || 1,
                costo: prod ? parseFloat(prod.costo) : 0,
                subtotal: (parseInt(req.cantidad) || 1) * (prod ? parseFloat(prod.costo) : 0),
                color: 'General',
                ubicacion: 'General'
            });
        }
    });

    _renderTablaArticulosCompraDirecta();
}

// -----------------------------------------------------------
// NUEVO MOTOR: COMPRA DIRECTA MULTI-ARTÍCULO
// -----------------------------------------------------------
function abrirModalCompraDirectaMulti() {
    const provs = StorageService.get('proveedores', []);
    const selProvs = provs.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
    
    const ubicaciones = StorageService.get("ubicacionesConfig", []);
    // Al dejar el value="" vacío, el sistema sabe que no hay respuesta aún
    let selUbi = '<option value="">-- 🛑 OBLIGATORIO: Elige Bodega --</option>';
    ubicaciones.forEach(u => {
        if(u.nombre !== 'General') selUbi += `<option value="${u.nombre}">${u.nombre}</option>`;
    });

    const html = `
    <div data-modal="nueva-compra-directa" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:20px;">
      <div style="background:white;border-radius:12px;width:100%;max-width:1000px;padding:30px;margin:auto;box-shadow:0 20px 40px rgba(0,0,0,0.4);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <h2 style="margin:0;color:#059669;">🚀 Registro de Compra Directa Múltiple</h2>
            <button onclick="document.querySelector('[data-modal=nueva-compra-directa]')?.remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#9ca3af;">✕</button>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:20px; background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">🏢 PROVEEDOR</label>
            <select id="cdProveedor" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
                <option value="">-- Selecciona proveedor --</option>${selProvs}
            </select>
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">📅 FECHA</label>
            <input type="date" id="cdFecha" value="${_comprasHoyInput()}" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
          </div>
          
          <div>
            <label style="font-size:12px; font-weight:bold; color:#374151;">💳 MÉTODO DE PAGO</label>
            <select id="cdMetodoPago" onchange="document.getElementById('divMsiCD').style.display=(this.value==='tarjeta_msi'?'block':'none'); document.getElementById('divCuentaCD').style.display=(this.value==='contado'?'block':'none'); document.getElementById('alertaConsigCD').style.display=(this.value==='consignacion'?'block':'none');" 
                    style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
                <option value="contado">Contado</option>
                <option value="credito_proveedor">Crédito Proveedor</option>
                <option value="tarjeta_msi">Meses sin Intereses (MSI)</option>
                <option value="consignacion" style="color:#10b981; font-weight:bold;">A Consignación</option>
            </select>
            <div id="alertaConsigCD" style="display:none; background:#ecfdf5; border:1px solid #10b981; padding:8px; border-radius:6px; margin-top:8px; font-size:11px; color:#065f46;">
                ✅ <b>Modo Consignación:</b> Esta compra entrará al inventario pero NO generará una deuda inmediata exigible.
            </div>
          </div>

          <div>
              <div id="divCuentaCD">
                  <label style="font-size:12px; font-weight:bold; color:#374151;">🏦 CUENTA DE ORIGEN</label>
                  <select id="cdCuentaOrigen" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;"></select>
              </div>
              <div id="divMsiCD" style="display:none;">
                  <div style="display:flex; gap:10px;">
                      <div style="flex:1;">
                          <label style="font-size:12px; font-weight:bold; color:#374151;">BANCO MSI</label>
                          <select id="cdBancoMSI" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;"></select>
                      </div>
                      <div style="width:80px;">
                          <label style="font-size:12px; font-weight:bold; color:#374151;">MESES</label>
                          <input type="number" id="cdMesesMSI" value="12" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
                      </div>
                  </div>
              </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr auto;gap:10px;align-items:end;margin-bottom:12px;">
          <div>
            <input type="hidden" id="cdProductoSel" value="">
            <div style="display:flex;align-items:center;gap:6px;">
                <span id="cdProductoSel-display" style="flex:1;padding:9px;border:1px solid #d1d5db;border-radius:6px;background:#f9fafb;color:#6b7280;font-size:14px;">Sin seleccionar</span>
                <button type="button" onclick="abrirSelectorProducto({titulo:'🔍 Seleccionar Producto',onSeleccion:function(p){document.getElementById('cdProductoSel').value=p.id;var d=document.getElementById('cdProductoSel-display');d.textContent=p.nombre+' ('+dinero(p.costo||0)+')';d.style.color='#111827';}})" style="padding:9px 12px;background:#059669;color:white;border:none;border-radius:6px;cursor:pointer;">🔍 Buscar</button>
            </div>
          </div>
          <button onclick="agregarArticuloCompraDirecta()" style="padding:9px 16px;background:#059669;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">➕ Añadir Artículo</button>
        </div>

        <div id="tablaArticulosCompraDirecta" style="margin-bottom:16px;"></div>
        
        <div style="margin-bottom:15px; padding:12px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px;">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-weight:bold; color:#1e40af; font-size:13px;">
                <input type="checkbox" id="cdIngresoInmediato" checked style="width:18px; height:18px; accent-color:#059669;">
                📦 Ingresar mercancía al inventario de inmediato
            </label>
            <p style="margin:5px 0 0 26px; font-size:11px; color:#475569; line-height:1.3;">
                Si desmarcas esta opción, se generará la cuenta por pagar/pago, pero la mercancía se irá a <b>Recepciones Pendientes</b> para darle entrada después.
            </p>
        </div>
        
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px; border-top:2px solid #e2e8f0; padding-top:15px;">
          <strong>Total a Pagar: <span id="cdTotal" style="color:#059669;font-size:22px;">$0.00</span></strong>
        </div>

        <div style="display:flex;gap:10px;">
          <button onclick="guardarCompraDirectaFinal()" style="flex:2;padding:14px;background:#059669;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:16px;">✅ Guardar Compra</button>
          <button onclick="document.querySelector('[data-modal=nueva-compra-directa]')?.remove()" style="flex:1;padding:14px;background:#6b7280;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">✕ Cancelar</button>
        </div>
      </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    window._articulosCompraDirecta = window._articulosCompraDirecta || [];
    window._opcionesUbiCD = selUbi;
    
    _poblarCuentasOrigen('cdCuentaOrigen');
    
    const selectBanco = document.getElementById("cdBancoMSI");
    if (selectBanco) {
        const tarjetasConfig = StorageService.get("tarjetasConfig", []);
        const bancosMSI = tarjetasConfig.filter(t => !t.tipo || t.tipo === "credito");
        selectBanco.innerHTML = bancosMSI.map(t => `<option value="${t.banco}">${t.banco}</option>`).join('');
    }

    _renderTablaArticulosCompraDirecta();
}

function agregarArticuloCompraDirecta() {
    const sel = document.getElementById('cdProductoSel');
    if (!sel.value) return;
    const prods = StorageService.get('productos', []);
    const prod = prods.find(p => String(p.id) === String(sel.value) && _comprasProductoActivo(p));
    if (!prod) return alert('Este producto esta inactivo y no se puede agregar a la compra.');
    
    window._articulosCompraDirecta.push({ 
        productoId: prod.id, nombre: prod.nombre, costo: prod.costo || 0, cantidad: 1, 
        subtotal: prod.costo || 0, color: 'General', ubicacion: 'General'
    });
    
    sel.value = '';
    const display = document.getElementById('cdProductoSel-display');
    if (display) { display.textContent = 'Sin seleccionar'; display.style.color = '#6b7280'; }
    _renderTablaArticulosCompraDirecta();
}

function _renderTablaArticulosCompraDirecta() {
    const cont = document.getElementById('tablaArticulosCompraDirecta');
    if (!cont) return;
    const arts = window._articulosCompraDirecta || [];
    if (arts.length === 0) {
        cont.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:12px; border:1px dashed #cbd5e1; border-radius:8px;">No hay productos en esta compra.</p>';
        document.getElementById('cdTotal').textContent = dinero(0);
        return;
    }
    
    let total = 0;
    const esAdmin = (typeof window.esAdmin === 'function') ? window.esAdmin() : (typeof esAdmin === 'function' ? esAdmin() : false);
    
    const rows = arts.map((a, i) => {
        total += a.subtotal;
        return `<tr>
            <td style="padding:8px;">${a.nombre}</td>
            <td style="padding:8px;text-align:center;"><input type="text" value="${a.color}" placeholder="Color" onchange="window._articulosCompraDirecta[${i}].color = this.value;" style="width:80px;padding:5px;border:1px solid #cbd5e1;border-radius:4px;"></td>
            <td style="padding:8px;text-align:center;">
                <select onchange="window._articulosCompraDirecta[${i}].ubicacion = this.value;" style="width:100px;padding:5px;border:1px solid #cbd5e1;border-radius:4px;">
                    ${window._opcionesUbiCD.replace(`value="${a.ubicacion}"`, `value="${a.ubicacion}" selected`)}
                </select>
            </td>
            <td style="padding:8px;text-align:center;">
                <input type="number" min="0" step="0.01" value="${a.costo}" style="width:80px;text-align:right;" ${esAdmin ? '' : 'readonly disabled'} 
                       onchange="if(${esAdmin}){window._articulosCompraDirecta[${i}].costo = parseFloat(event.target.value)||0; window._articulosCompraDirecta[${i}].subtotal = window._articulosCompraDirecta[${i}].cantidad * window._articulosCompraDirecta[${i}].costo; _renderTablaArticulosCompraDirecta();}" />
            </td>
            <td style="padding:8px;text-align:center;">
                <input type="number" min="1" value="${a.cantidad}" style="width:60px;text-align:center;" 
                       onchange="window._articulosCompraDirecta[${i}].cantidad = parseInt(event.target.value)||1; window._articulosCompraDirecta[${i}].subtotal = window._articulosCompraDirecta[${i}].cantidad * window._articulosCompraDirecta[${i}].costo; _renderTablaArticulosCompraDirecta();" />
            </td>
            <td style="padding:8px;text-align:right; font-weight:bold;">${dinero(a.subtotal)}</td>
            <td style="padding:8px;text-align:center;"><button onclick="window._articulosCompraDirecta.splice(${i},1);_renderTablaArticulosCompraDirecta();" style="background:none;border:none;cursor:pointer;font-size:16px;">🗑️</button></td>
        </tr>`;
    }).join('');
    
    cont.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:#f3f4f6;"><th style="padding:8px;text-align:left;">Producto</th><th style="padding:8px;text-align:center;">Color</th><th style="padding:8px;text-align:center;">Bodega</th><th style="padding:8px;text-align:center;">Costo Unit.</th><th style="padding:8px;text-align:center;">Cant.</th><th style="padding:8px;text-align:right;">Subtotal</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
    </table>`;
    document.getElementById('cdTotal').textContent = dinero(total);
}

function guardarCompraDirectaFinal() {
    if (!_comprasRequireAdmin('Guardar compra directa')) return;
    const provId = document.getElementById('cdProveedor')?.value;
    if (!provId) return alert("⚠️ Selecciona el proveedor.");
    
    const arts = window._articulosCompraDirecta || [];
    if (arts.length === 0) return alert("⚠️ La compra está vacía.");

    const provs = StorageService.get('proveedores', []);
    const prov = provs.find(p => String(p.id) === String(provId));
    if(!prov) return alert("Proveedor no encontrado.");

    const fechaStr = document.getElementById('cdFecha').value;
    const fechaFormatMX = fechaStr.split('-').reverse().join('/');

    let selectsBodega = document.querySelectorAll("select[id^='cdUbicacion_']");
    for (let i = 0; i < selectsBodega.length; i++) {
        let valorBodega = selectsBodega[i].value;
        if (!valorBodega || valorBodega === "" || valorBodega === "General") {
            alert(`❌ BLOQUEO DE AUDITORÍA: No has seleccionado la bodega de destino para el artículo en la fila ${i + 1}.\n\nRevisa la tabla y asigna una ubicación antes de guardar.`);
            return; // Aborta todo el proceso de guardado inmediatamente
        }
    }
    
    const metodoPago = document.getElementById('cdMetodoPago').value;
    const comboPago = document.getElementById("cdMetodoPago");
    const formaPagoTexto = comboPago.options[comboPago.selectedIndex].text;

    const cuentaOrigenId = document.getElementById('cdCuentaOrigen')?.value || "efectivo";
    const cuentaOrigenNombre = document.getElementById('cdCuentaOrigen')?.options[document.getElementById('cdCuentaOrigen').selectedIndex]?.text || "Efectivo";
    
    // 👇 Leemos tus campos nativos de MSI 👇
    const bancoSel = document.getElementById('cdBancoMSI')?.value || "";
    const msiMeses = parseInt(document.getElementById('cdMesesMSI')?.value) || 12;
    
    const ingresoInmediato = document.getElementById('cdIngresoInmediato')?.checked ?? true;
    const totalCompra = arts.reduce((s, a) => s + a.subtotal, 0);

    // 🚀 AUDITORÍA: INTERCEPTOR DE SALDO A FAVOR 🚀
    let saldosFavor = StorageService.get("saldosFavorProveedores", []);
    let saldoProv = saldosFavor.find(s => String(s.proveedorId) === String(provId) && s.montoDisponible > 0);
    
    let montoUsadoDelSaldo = 0;
    let totalAPagarReal = totalCompra;

    if (saldoProv) {
        if (confirm(`💰 ¡ATENCIÓN!\nTienes un saldo a favor de ${dinero(saldoProv.montoDisponible)} con ${prov.nombre}.\n\n¿Deseas utilizar este saldo para pagar total o parcialmente esta nueva compra?`)) {
            if (saldoProv.montoDisponible >= totalCompra) {
                montoUsadoDelSaldo = totalCompra;
                totalAPagarReal = 0;
            } else {
                montoUsadoDelSaldo = saldoProv.montoDisponible;
                totalAPagarReal = totalCompra - montoUsadoDelSaldo;
            }
        }
    }

    const msjConfirmar = `¿Deseas registrar esta compra?\n\nProveedor: ${prov.nombre}\nCosto Total: ${dinero(totalCompra)}\n${montoUsadoDelSaldo > 0 ? 'Saldo a favor aplicado: -' + dinero(montoUsadoDelSaldo) + '\n' : ''}Total a pagar: ${dinero(totalAPagarReal)}\nMétodo: ${formaPagoTexto}\nInventario: ${ingresoInmediato ? 'ENTRA AHORA ✅' : 'A RECEPCIONES ⏳'}`;
    if (!confirm(msjConfirmar)) return;

    // Si usó el saldo, lo descontamos de la base de datos
    if (montoUsadoDelSaldo > 0) {
        saldoProv.montoDisponible -= montoUsadoDelSaldo;
        StorageService.set("saldosFavorProveedores", saldosFavor);
    }

    let comprasList = StorageService.get("compras", []);
    let recepciones = StorageService.get("recepciones", []);
    let productos = StorageService.get("productos", []);
    let movimientosInventario = StorageService.get("movimientosInventario", []);

    const idCompraUnico = Date.now();
    const folioCompraDirecta = window.generarFolioSistema ? window.generarFolioSistema("CD") : `CD-${idCompraUnico}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    let avisoActualizacion = "";

    arts.forEach((art, index) => {
        // 1. Historial de Costos
        guardarHistorialCosto({
            productoId: art.productoId, precioCompra: art.costo, fecha: fechaFormatMX,
            cantidad: art.cantidad, proveedorId: prov.id, proveedorNombre: prov.nombre, origen: 'compra directa multi'
        });

        // 2. Inventario inmediato
        if (ingresoInmediato) {
            const pidx = productos.findIndex(p => String(p.id) === String(art.productoId));
            if (pidx !== -1) {
                let p = productos[pidx];
                if (art.costo > p.costo) {
                    let margenAplicar = 30;
                    const nuevoPrecio = CalculatorService.calcularPrecioDesdeMargen(art.costo, margenAplicar);
                    avisoActualizacion += `\n- ${p.nombre}: Costo subió a ${dinero(art.costo)}.`;
                    p.costo = art.costo;
                    p.precio = nuevoPrecio;
                }

                p.stock = (Number(p.stock) || 0) + art.cantidad;
                p.variantes = p.variantes || [];
                const colFinal = art.color || 'General';
                const ubiFinal = art.ubicacion || 'General';
                const existente = p.variantes.find(v => (v.ubicacion || 'General').toUpperCase() === ubiFinal.toUpperCase() && (v.color || 'General').toUpperCase() === colFinal.toUpperCase());
                
                if (existente) {
                    existente.stock = (Number(existente.stock) || 0) + art.cantidad;
                } else {
                    p.variantes.push({ ubicacion: ubiFinal, color: colFinal, stock: art.cantidad });
                }

                movimientosInventario.push({
                    id: Date.now() + Math.random(),
                    productoId: art.productoId,
                    productoNombre: art.nombre || p.nombre,
                    tipo: 'entrada',
                    cantidad: art.cantidad,
                    costoUnitario: Number(art.costo || 0),
                    costo: Number(art.costo || 0),
                    precioCompra: Number(art.costo || 0),
                    valor: Number(art.cantidad || 0) * Number(art.costo || 0),
                    proveedor: prov.nombre || '',
                    referencia: folioCompraDirecta,
                    compraId: idCompraUnico,
                    ubicacion: ubiFinal,
                    color: colFinal,
                    concepto: `Compra Directa Múltiple a ${prov.nombre} (${colFinal})`,
                    fecha: window.formatearFechaCortaMX ? window.formatearFechaCortaMX(new Date()) : new Date().toLocaleDateString(),
                    fechaISO: fechaStr
                });
            }
        }

        // 3. Recepciones (Tarjeta individual)
        recepciones.push({
            id: idCompraUnico + 1 + index,
            compraId: idCompraUnico,
            productoId: art.productoId,
            productoNombre: art.nombre,
            cantidadTotal: art.cantidad,
            cantidadRecibida: ingresoInmediato ? art.cantidad : 0,
            cantidadPendiente: ingresoInmediato ? 0 : art.cantidad,
            proveedor: prov.nombre,
            fechaPedido: fechaFormatMX,
            metodoPago: formaPagoTexto,
            metodoPagoCodigo: metodoPago,
            estatus: ingresoInmediato ? "Completado" : "Pendiente",
            color: art.color,
            ubicacion: art.ubicacion,
            costoUnitario: Number(art.costo || 0), // FIJADO: El costo original jamás se altera
            esConsignacion: metodoPago === "consignacion"
        });
    });

    // 4. Guardar Compra Maestro
    const nuevaCompra = {
        id: idCompraUnico,
        folio: folioCompraDirecta,
        proveedor: prov.nombre,
        proveedorId: prov.id,
        total: totalCompra,
        fecha: fechaFormatMX,
        fechaISO: fechaStr,
        articulos: arts,
        metodo: metodoPago,
        saldoPendiente: metodoPago !== 'contado' ? totalAPagarReal : 0,
        pagado: metodoPago === 'contado' ? totalAPagarReal : 0,
        totalPagado: metodoPago === 'contado' ? totalAPagarReal : 0,
        pago: metodoPago === 'contado' ? { monto: totalAPagarReal, metodo: metodoPago, cuenta: cuentaOrigenId, etiqueta: cuentaOrigenNombre } : null,
        saldoFavorAplicado: montoUsadoDelSaldo || 0
    };
    comprasList.push(nuevaCompra);

    // 👇 5. LÓGICA DE DISTRIBUCIÓN DE DEUDA/PAGO NATIVA 👇
    
    // Extraemos todos los nombres de los productos separados por comas
    const nombresProductos = arts.map(a => a.nombre).join(', ');
    // Creamos la etiqueta perfecta para tu conciliación
    const conceptoCombinado = `Compra: ${nombresProductos} (Prov: ${prov.nombre})`;

    if (metodoPago === "contado") {
        if (totalAPagarReal > 0) {
            window._egresarCuenta({
                monto: totalAPagarReal, cuentaId: cuentaOrigenId, etiqueta: cuentaOrigenNombre,
                concepto: conceptoCombinado, referencia: `COMPRA-${idCompraUnico}`
            });
        }
    } 
    else if (metodoPago === "credito_proveedor" || metodoPago === "consignacion") {
        if (metodoPago === "consignacion") {
            if (ingresoInmediato) { // Se remueve la restricción de totalAPagarReal para que siempre guarde la mercancía
                
                // AUDITORÍA: Si se usó un saldo a favor, lo mandamos al gestor de anticipos 
                // en lugar de abaratar el costo del producto.
                if (montoUsadoDelSaldo > 0) {
                    _registrarAnticipoConsignacionGlobal({
                        monto: montoUsadoDelSaldo,
                        cuenta: 'Saldo a Favor',
                        proveedor: prov.nombre,
                        proveedorId: prov.id,
                        fecha: window.localISO ? window.localISO(new Date()) : new Date().toISOString(),
                        nota: `Saldo a favor aplicado como anticipo inicial en ${folioCompraDirecta}`,
                        referencia: `CONSIG-SALDO-${idCompraUnico}`,
                        origen: 'compraDirecta'
                    });
                }

                _agregarConsignacionesActivasDesdeArticulos({
                    compraId: idCompraUnico,
                    proveedor: prov.nombre,
                    proveedorId: prov.id,
                    folioOrigen: folioCompraDirecta,
                    fecha: fechaFormatMX,
                    articulos: arts,
                    cantidadCampo: 'cantidad',
                    factorCosto: 1, // FIJADO: La base de datos mantendrá siempre el 100% del costo original
                    origen: 'compraDirecta'
                });
            }
        } else {
            let cuentasProv = StorageService.get("cuentasPorPagar", []);
            cuentasProv.push({
                id: idCompraUnico + 2,
                compraId: idCompraUnico,
                proveedor: prov.nombre,
                producto: nombresProductos,
                articulos: arts,
                total: totalCompra,
                saldoPendiente: totalAPagarReal,
                metodo: metodoPago,
                formaPagoTexto: formaPagoTexto,
                fecha: fechaFormatMX,
                vencimiento: "Revisar CXP",
                esConsignacion: false,
                abonos: montoUsadoDelSaldo > 0 ? [{fecha: fechaStr+"T12:00:00.000", monto: montoUsadoDelSaldo, cuenta: "Saldo a Favor"}] : [] 
            });
            StorageService.set("cuentasPorPagar", cuentasProv);
        }
    }
    else if (metodoPago === "tarjeta_msi") {
        let cuentasBancos = StorageService.get("cuentasMSI", []);
        let tarjetasConfig = StorageService.get("tarjetasConfig", []);
        
        let infoTarjeta = tarjetasConfig.find(t => t.banco === bancoSel) || {};
        let diaCorte = parseInt(infoTarjeta.diaCorte) || 15;
        let diaPago = parseInt(infoTarjeta.diaLimite || infoTarjeta.diaPago || 5);

        let calendario = [];
        // Se calculan las mensualidades con el total real descontado
        let cuotaMensual = totalAPagarReal > 0 ? parseFloat((totalAPagarReal / msiMeses).toFixed(2)) : 0;
        
        let fechaPartes = fechaStr.split('-'); 
        let anioCompra = parseInt(fechaPartes[0]);
        let mesCompra = parseInt(fechaPartes[1]) - 1; 
        let diaCompra = parseInt(fechaPartes[2]);

        let brincoCorte = (diaCompra > diaCorte) ? 1 : 0;
        let brincoPago = (diaCorte > diaPago) ? 1 : 0;
        let mesPrimerPago = mesCompra + brincoCorte + brincoPago;

        for (let i = 1; i <= msiMeses; i++) {
            let fCalculada = new Date(anioCompra, mesPrimerPago + (i - 1), diaPago, 12, 0, 0);
            let yyyy = fCalculada.getFullYear();
            let mm = String(fCalculada.getMonth() + 1).padStart(2, '0');
            let dd = String(fCalculada.getDate()).padStart(2, '0');
            
            calendario.push({
                n: i,
                fecha: `${yyyy}-${mm}-${dd}`,
                monto: cuotaMensual,
                estado: "Pendiente",
                montoAbonado: 0,
                conciliado: false
            });
        }

        cuentasBancos.push({
            id: idCompraUnico + 3,
            compraId: idCompraUnico,
            banco: bancoSel,
            concepto: conceptoCombinado, // 🔥 Etiqueta combinada en lugar de "Compra Directa"
            producto: nombresProductos,
            total: totalCompra,
            meses: msiMeses,
            cuotaMensual: cuotaMensual,
            fecha: fechaFormatMX,
            fechaCompra: fechaStr,
            calendario: calendario,
            pagosRealizados: 0
        });
        StorageService.set("cuentasMSI", cuentasBancos);
    }

    if (window._requisicionesVinculadasA_CD && window._requisicionesVinculadasA_CD.length > 0) {
        let reqsTotales = StorageService.get("requisicionesCompra", []);
        window._requisicionesVinculadasA_CD.forEach(idReq => {
            let r = reqsTotales.find(x => String(x.id) === String(idReq));
            if (r) r.estatus = `Comprado`;
        });
        StorageService.set("requisicionesCompra", reqsTotales);
        window._requisicionesVinculadasA_CD = null;
    }

    StorageService.set("productos", productos);
    StorageService.set("compras", comprasList);
    StorageService.set("recepciones", recepciones);
    StorageService.set("movimientosInventario", movimientosInventario);

    document.querySelector('[data-modal="nueva-compra-directa"]')?.remove();
    alert(`✅ Compra Directa Registrada Exitosamente.${ingresoInmediato ? '' : '\\n⏳ La mercancía fue enviada a Recepciones Pendientes.'}${avisoActualizacion}`);

    if (typeof renderRequisiciones === 'function') renderRequisiciones();
}

// 🚀 MOTOR DE REEMBOLSO DE SALDOS A FAVOR 🚀
window.reembolsarSaldoFavor = function(idSaldo) {
    let saldos = StorageService.get("saldosFavorProveedores", []);
    const saldo = saldos.find(s => s.id === idSaldo);
    if (!saldo) return;
    const html = `
    <div data-modal="reembolso-favor" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;">
        <div style="background:white;padding:25px;border-radius:10px;width:350px;">
            <h3 style="margin-top:0;color:#065f46;">💸 Reembolso de Proveedor</h3>
            <p style="font-size:13px;color:#475569;">Proveedor: <b>${saldo.proveedorNombre}</b></p>
            <p style="font-size:13px;color:#475569;">Monto a devolver: <b style="color:#059669;font-size:16px;">${dinero(saldo.montoDisponible)}</b></p>
            <label style="display:block;margin-top:15px;margin-bottom:5px;font-size:12px;font-weight:bold;">¿A qué cuenta ingresará el dinero?</label>
            ${_buildSelectorCuentas('cuentaReembolso', false)}
            <div style="display:flex;gap:10px;margin-top:20px;">
                <button onclick="ejecutarReembolsoFavor(${saldo.id})" style="flex:1;background:#059669;color:white;border:none;padding:10px;border-radius:5px;cursor:pointer;font-weight:bold;">✅ Confirmar</button>
                <button onclick="document.querySelector('[data-modal=reembolso-favor]').remove()" style="flex:1;background:#64748b;color:white;border:none;padding:10px;border-radius:5px;cursor:pointer;">✕ Cancelar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window.ejecutarReembolsoFavor = function(idSaldo) {
    let saldos = StorageService.get("saldosFavorProveedores", []);
    const idx = saldos.findIndex(s => s.id === idSaldo);
    if (idx === -1) return;
    const saldo = saldos[idx];
    const select = document.getElementById('cuentaReembolso');
    
    // El dinero entra a tu caja o banco
    window._ingresarCuenta({
        monto: saldo.montoDisponible,
        cuentaId: select.value,
        etiqueta: select.options[select.selectedIndex].text,
        concepto: `Reembolso de saldo a favor - ${saldo.proveedorNombre}`,
        referencia: `REEMBOLSO-${saldo.id}`,
        fecha: window.localISO ? window.localISO(new Date()) : new Date().toISOString()
    });
    
    const montoRegresado = saldo.montoDisponible;
    saldo.montoDisponible = 0; // Se agota el saldo
    StorageService.set("saldosFavorProveedores", saldos);
    document.querySelector('[data-modal=reembolso-favor]').remove();
    alert(`✅ Reembolso completado. Se ingresaron ${dinero(montoRegresado)} a ${select.options[select.selectedIndex].text}.`);
    if (typeof renderCuentasPorPagar === 'function') renderCuentasPorPagar();
};

function renderCuentasPorPagar() {
    const contenedor = document.getElementById("listaCuentasPorPagar");
    if (!contenedor) return;

    // Bloque para mostrar Saldos a Favor al inicio de CXP
    const saldosFavor = StorageService.get("saldosFavorProveedores", []).filter(s => s.montoDisponible > 0);
    let htmlSaldos = "";
    if (saldosFavor.length > 0) {
        htmlSaldos = `<div style="background:#ecfdf5; border:1px solid #10b981; padding:15px; border-radius:10px; margin-bottom:20px;">
            <h4 style="margin:0 0 10px; color:#065f46;">💰 SALDOS A FAVOR DISPONIBLES</h4>
            <table style="width:100%; font-size:13px;">
                ${saldosFavor.map(s => `<tr>
                    <td style="padding:5px 0;"><b>${s.proveedorNombre}</b></td>
                    <td style="padding:5px 0;">Ref: ${s.referencia}</td>
                    <td style="text-align:right; color:#059669; font-weight:bold; padding:5px 10px;">${dinero(s.montoDisponible)}</td>
                    <td style="text-align:right; width:110px; padding:5px 0;">
                        <button onclick="reembolsarSaldoFavor(${s.id})" style="background:#059669; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:11px; box-shadow:0 2px 4px rgba(0,0,0,0.1);">💸 Reembolsar</button>
                    </td>
                </tr>`).join('')}
            </table>
        </div>`;
    }

    let cuentas = StorageService.get("cuentasPorPagar", []) || [];

    // ── Reparar saldos con bug de doble conteo antes de renderizar ──
    const comprasList = StorageService.get("compras", []);
    const ordenesList = StorageService.get("ordenesCompra", []);
    let huboCambios = false;
    cuentas.forEach(c => {
        const compraOriginal = comprasList.find(x => String(x.id) === String(c.compraId || c.id)) || 
                               ordenesList.find(o => String(o.id) === String(c.compraId || c.id));
        const subtotalReal = parseFloat(c.total) || 0;
        let abonos = Array.isArray(c.abonos) ? [...c.abonos] : [];
        if (compraOriginal && Array.isArray(compraOriginal.pagos) && !c.noRescatarPagosOC) {
            compraOriginal.pagos.forEach(p => {
                if (!abonos.some(a => a.fecha === p.fecha && Math.abs((parseFloat(a.monto)||0)-(parseFloat(p.monto)||0)) < 0.01))
                    abonos.push(p);
            });
        }
        const totalAbonado = abonos.reduce((s, a) => s + (parseFloat(a.monto) || 0), 0);
        let anticipoExtra = 0;
        if (compraOriginal && parseFloat(compraOriginal.anticipo_pagado) > 0.01 && !c.noRescatarPagosOC) {
            const ap = parseFloat(compraOriginal.anticipo_pagado);
            const pagosOC = Array.isArray(compraOriginal.pagos) ? compraOriginal.pagos : [];
            const pagosYaEnAbonos = pagosOC.length > 0 && pagosOC.every(p =>
                abonos.some(a => a.fecha === p.fecha && Math.abs((parseFloat(a.monto)||0)-(parseFloat(p.monto)||0)) < 0.01)
            );
            if (!pagosYaEnAbonos) anticipoExtra = ap;
        }
        const saldoCorrecto = Math.max(0, subtotalReal - totalAbonado - anticipoExtra);
        if (Math.abs((parseFloat(c.saldoPendiente) || 0) - saldoCorrecto) > 0.01) {
            c.saldoPendiente = saldoCorrecto;
            c.saldo = saldoCorrecto;
            c.abonos = abonos;
            huboCambios = true;
        }
        if (saldoCorrecto <= 0.01 && !_consigCxpLiquidada(c)) {
            c.saldoPendiente = 0;
            c.saldo = 0;
            c.estatus = "Liquidado";
            c.estado = "Liquidado";
            c.liquidado = true;
            c.pagado = true;
            huboCambios = true;
        }
    });
    if (huboCambios) StorageService.set("cuentasPorPagar", cuentas);
    // ────────────────────────────────────────────────────────────────

    // Filtro blindado contra valores vacíos
    let deudas = cuentas.filter(c => parseFloat(c.saldoPendiente || 0) > 0);

    if (deudas.length === 0) {
        contenedor.innerHTML = htmlSaldos + "<p style='text-align:center; padding:20px; color:#10b981; font-weight:bold;'>✅ ¡No tienes deudas pendientes con proveedores!</p>";
        return;
    }

    let html = `
        <table class="tabla-admin">
            <thead>
                <tr>
                    <th>Fecha / Proveedor</th>
                    <th>Método</th>
                    <th>Total</th>
                    <th>Saldo Pendiente</th>
                    <th>Acción</th>
                </tr>
            </thead>
            <tbody>`;

    deudas.forEach(c => {
        // Formateo de fecha por si viene cruda
        const fechaVenta = c.fecha ? window.formatearFechaCortaMX(c.fecha) : '-';

        html += `
            <tr>
                <td>
                    ${fechaVenta}<br>
                    <strong style="cursor:pointer; color:#2980b9; text-decoration:underline;" onclick="verDetalleCompra('${c.id}')">${c.proveedor || 'General'}</strong>
                </td>
                <td><small>${c.metodo || c.formaPagoTexto || '-'}</small></td>
                <td>${dinero(c.total)}</td>
                <td style="color:red; font-weight:bold;">${dinero(c.saldoPendiente)}</td>
                <td>
                    ${c.origenConsignacion || String(c.folioOrigen).startsWith('RCON-')
                        ? `<button onclick="abrirModalPagoConsignacion('${c.id}')" style="background:#be123c; color:white; border:none; padding:8px 12px; border-radius:5px; cursor:pointer; font-weight:bold;">💸 Pagar Venta</button>`
                        : `<button onclick="registrarAbonoProveedor('${c.id}')" style="background:#2c3e50; color:white; border:none; padding:8px 12px; border-radius:5px; cursor:pointer; font-weight:bold;">💵 Abonar</button>`
                    }
                </td>
            </tr>`;
    });

    contenedor.innerHTML = htmlSaldos + html + "</tbody></table>";
}

window.abrirModalAbonoOC = function(idOC) {
    const ordenes = StorageService.get("ordenesCompra", []);
    const fechaHoy = _comprasHoyInput();
    const oc = ordenes.find(o => o.id === idOC);
    if (!oc) return;

    const anticipoPrevio = oc.anticipo_pagado || 0;
    const saldoPendiente = oc.saldoPendiente !== undefined ? oc.saldoPendiente : Math.max(0, oc.total - anticipoPrevio);

    const html = `
    <div data-modal="abono-oc" style="position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:10000; display:flex; align-items:center; justify-content:center;">
        <div style="background:white; padding:25px; border-radius:12px; width:400px; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
            <h3 style="margin-top:0; color:#1e40af;">💰 Abonar a OC: ${oc.folio}</h3>
            <p style="color:#6b7280; font-size:14px; margin-bottom: 15px;">Saldo pendiente: <b style="color:#dc2626;">${dinero(saldoPendiente)}</b></p>
            
            <div style="margin-bottom:15px;">
                <label style="display:block;font-size:12px;font-weight:bold;margin-bottom:5px;color:#334155;">Fecha del Pago:</label>
                <input type="date" id="fechaAbonoOC" value="${fechaHoy}" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:6px;font-family:sans-serif;">
             </div>

            <div style="margin-bottom:15px;">
                <label style="display:block; font-size:12px; font-weight:bold; margin-bottom:4px;">MONTO DEL ABONO</label>
                <input type="number" id="montoAbonoOC" max="${saldoPendiente}" placeholder="Ej: 500" style="width:100%; padding:10px; border:1px solid #d1d5db; border-radius:6px; font-size:16px;">
            </div>
            
            <div style="margin-bottom:20px;">
                <label style="display:block; font-size:12px; font-weight:bold; margin-bottom:4px;">PAGAR DESDE (DÉBITO O EFECTIVO)</label>
                ${_buildSelectorCuentas('cuentaAbonoOC', false)}
            </div>

            <div style="display:flex; gap:10px;">
                <button onclick="confirmarAbonoOC(${oc.id})" style="flex:2; padding:12px; background:#059669; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Registrar Pago</button>
                <button onclick="document.querySelector('[data-modal=abono-oc]').remove()" style="flex:1; padding:12px; background:#6b7280; color:white; border:none; border-radius:6px; cursor:pointer;">Cancelar</button>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
};

window.confirmarAbonoOC = function(idOC) {
    const ordenes = StorageService.get("ordenesCompra", []);
    const idx = ordenes.findIndex(o => o.id === idOC);
    if (idx === -1) return;

    // 👇 LEEMOS EL CALENDARIO 👇
    const fechaInput = document.getElementById("fechaAbonoOC").value;
    if (!fechaInput) return alert("❌ Error de Auditoría: Debes especificar la fecha del pago.");
    const fechaPagoFinal = `${fechaInput}T12:00:00.000`;

    const monto = parseFloat(document.getElementById('montoAbonoOC').value) || 0;
    const selectCuenta = document.getElementById('cuentaAbonoOC');
    const cuentaId = selectCuenta.value;
    const cuentaNombre = selectCuenta.options[selectCuenta.selectedIndex].text;

    const anticipoPrevio = ordenes[idx].anticipo_pagado || 0;
    const saldoPendiente = ordenes[idx].saldoPendiente !== undefined ? ordenes[idx].saldoPendiente : Math.max(0, ordenes[idx].total - anticipoPrevio);

    if (monto <= 0 || monto > saldoPendiente) return alert("⚠️ Monto inválido. Verifica el saldo pendiente.");

    // 1. Registrar el egreso en el flujo de caja (mandando la fecha)
    window._egresarCuenta({
        monto: monto,
        cuentaId: cuentaId,
        etiqueta: cuentaNombre,
        concepto: `Abono a Orden de Compra ${ordenes[idx].folio}`,
        referencia: ordenes[idx].folio,
        idOperacion: `ABONO-OC-${ordenes[idx].id}-${Date.now()}`,
        fecha: fechaPagoFinal // <-- SE INYECTA AQUÍ
    });

    if (ordenes[idx].esConsignacion || ordenes[idx].condicionesComerciales?.metodoPago === 'consignacion') {
        const folioOrigen = ordenes[idx].folio;
        const folioKey = _consigFolioKeyFromParts(_consigProveedorKey({
            proveedor: ordenes[idx].proveedorNombre,
            proveedorId: ordenes[idx].proveedorId || null
        }), folioOrigen);
        _registrarAnticipoConsignacionGlobal({
            monto,
            cuentaId,
            cuenta: cuentaNombre,
            proveedor: ordenes[idx].proveedorNombre,
            proveedorId: ordenes[idx].proveedorId || null,
            fecha: fechaPagoFinal,
            nota: `Abono registrado desde orden de compra ${folioOrigen}`,
            referencia: `ABONO-OC-${ordenes[idx].id}-${fechaPagoFinal}-${monto}`,
            origen: 'abonoOC',
            folioKey,
            folioOrigen
        });
    }

    // 2. Actualizar la OC
    ordenes[idx].pagos = ordenes[idx].pagos || [];
    ordenes[idx].pagos.push({ fecha: fechaPagoFinal, monto: monto, cuenta: cuentaNombre });
    ordenes[idx].saldoPendiente = saldoPendiente - monto;
    ordenes[idx].anticipo_pagado = anticipoPrevio + monto; 

    StorageService.set("ordenesCompra", ordenes);
    document.querySelector('[data-modal=abono-oc]').remove();
    alert("✅ Abono registrado exitosamente y retirado de la cuenta " + cuentaNombre);
    if(window.renderListaOrdenesCompra) renderListaOrdenesCompra();
};
window.abrirNuevaCompraDirectaBlanco = function() {
    // 1. Limpiamos la memoria para que sea una compra completamente nueva y vacía
    window._articulosCompraDirecta = [];
    window._requisicionesVinculadasA_CD = [];
    
    // 2. Llamamos al súper modal multi-artículo
    if (typeof abrirModalCompraDirectaMulti === 'function') {
        abrirModalCompraDirectaMulti();
    } else {
        alert("⚠️ El módulo de compra múltiple no está cargado.");
    }
};

window.confirmarEliminarOC = function(id) {
    const lista = _getOrdenesCompra();
    const oc = lista.find(x => x.id === id);
    if (!oc) return;

    // Calculamos cuánto se ha pagado ya
    const pagado = (oc.pagos || []).reduce((s, p) => s + (p.monto || 0), 0);
    
    let mensaje = `¿Estás seguro de eliminar la Orden de Compra ${oc.folio}?\n\n`;
    
    if (pagado > 0) {
        mensaje += `⚠️ AVISO: Esta orden tiene abonos por ${dinero(pagado)}. Al eliminarla, el dinero se guardará como 'SALDO A FAVOR' para el proveedor ${oc.proveedorNombre} y podrás usarlo en futuras compras.\n\n`;
    }
    
    mensaje += "Las requisiciones vinculadas volverán a estar 'Pendientes'.\n\n¿Deseas continuar?";

    if (confirm(mensaje)) {
        ejecutarEliminacionOC(id, pagado);
    }
};

function ejecutarEliminacionOC(id, montoAFavor) {
    let lista = _getOrdenesCompra();
    const idx = lista.findIndex(x => x.id === id);
    if (idx === -1) return;

    const oc = lista[idx];

    // 1. Si hubo pagos, generamos el Saldo a Favor
    if (montoAFavor > 0) {
        let saldos = StorageService.get("saldosFavorProveedores", []);
        saldos.push({
            id: Date.now(),
            proveedorId: oc.proveedorId,
            proveedorNombre: oc.proveedorNombre,
            montoOriginal: montoAFavor,
            montoDisponible: montoAFavor,
            fecha: window.obtenerHoyInputMX(),
            referencia: `Cancelación ${oc.folio}`
        });
        StorageService.set("saldosFavorProveedores", saldos);
    }

    // 2. "Revivir" Requisiciones (Buscamos las que digan "En OC (FOLIO)")
    let reqsTotales = StorageService.get("requisicionesCompra", []);
    reqsTotales.forEach(r => {
        if (r.estatus === `En OC (${oc.folio})`) {
            r.estatus = "Pendiente";
        }
    });
    StorageService.set("requisicionesCompra", reqsTotales);

    // 3. Cambiamos el estado de la OC a "Eliminada" para que desaparezca de la lista activa
    lista[idx].estado = 'Eliminada';
    StorageService.set('ordenesCompra', lista);

    alert(`✅ OC ${oc.folio} eliminada. Las requisiciones han sido reactivadas.`);
    if (typeof renderListaOrdenesCompra === 'function') renderListaOrdenesCompra();
    if (typeof renderRequisiciones === 'function') renderRequisiciones();
}

function cancelarOrdenCompra(id) {
    const lista = _getOrdenesCompra();
    const oc = lista.find(x => x.id === id);
    if (!oc) return;
    if (oc.estado === 'Cancelada') return alert('Esta orden ya está cancelada.');
    if (oc.estado === 'Recibida' || oc.estado === 'Recibida Parcial') return alert('No se puede cancelar una orden ya recibida.');

    const pagado = (oc.pagos || []).reduce((s, p) => s + (p.monto || 0), 0);
    let mensaje = `¿Cancelar la Orden de Compra ${oc.folio}?\n\n`;
    if (pagado > 0) {
        mensaje += `⚠️ Esta orden tiene abonos por ${dinero(pagado)}. El monto se registrará como Saldo a Favor del proveedor ${oc.proveedorNombre}.\n\n`;
    }
    mensaje += "Las requisiciones vinculadas volverán a estar 'Pendientes'.\n\n¿Deseas continuar?";

    if (!confirm(mensaje)) return;

    // Saldo a favor si hubo pagos
    if (pagado > 0) {
        let saldos = StorageService.get('saldosFavorProveedores', []);
        saldos.push({
            id: Date.now(),
            proveedorId: oc.proveedorId,
            proveedorNombre: oc.proveedorNombre,
            montoOriginal: pagado,
            montoDisponible: pagado,
            fecha: window.obtenerHoyInputMX(),
            referencia: `Cancelación ${oc.folio}`
        });
        StorageService.set('saldosFavorProveedores', saldos);
    }

    // Revivir requisiciones vinculadas
    let reqs = StorageService.get('requisicionesCompra', []);
    reqs.forEach(r => {
        if (r.estatus === `En OC (${oc.folio})`) r.estatus = 'Pendiente';
    });
    StorageService.set('requisicionesCompra', reqs);

    // Marcar como Cancelada
    const idx = lista.findIndex(x => x.id === id);
    lista[idx].estado = 'Cancelada';
    StorageService.set('ordenesCompra', lista);

    alert(`✅ OC ${oc.folio} cancelada.`);
    if (typeof renderListaOrdenesCompra === 'function') renderListaOrdenesCompra();
    if (typeof renderRequisiciones === 'function') renderRequisiciones();
}
// ============================================================
// AÑADIR REQUISICIONES A UNA OC EXISTENTE
// ============================================================
window.abrirModalAgregarA_OC_Existente = function() {
    const seleccionados = Array.from(document.querySelectorAll('.chk-req:checked')).map(cb => cb.value);
    if (seleccionados.length === 0) return alert("⚠️ Selecciona al menos una requisición de la lista.");

    // Buscar OC's que aún se puedan editar
    const ocs = _getOrdenesCompra().filter(oc => oc.estado === 'Borrador' || oc.estado === 'Enviada');
    if (ocs.length === 0) return alert("⚠️ No tienes Órdenes de Compra abiertas (Borrador o Enviadas). Crea una nueva primero.");

    let opciones = ocs.slice().reverse().map(oc => 
        `<option value="${oc.id}">${oc.folio} — ${oc.proveedorNombre} (Total actual: ${dinero(oc.total)})</option>`
    ).join('');

    const modalHTML = `
    <div data-modal="agregar-req-oc" style="position:fixed; inset:0; background:rgba(15,23,42,0.7); z-index:10000; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(3px);">
        <div style="background:white; padding:30px; border-radius:12px; width:90%; max-width:450px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2);">
            <h3 style="margin-top:0; color:#b45309; display:flex; align-items:center; gap:8px;">📥 Añadir a OC Existente</h3>
            <p style="font-size:13px; color:#64748b; margin-bottom:20px;">Se insertarán los ${seleccionados.length} artículos seleccionados dentro de la Orden de Compra que elijas, recalculando su total automáticamente.</p>
            
            <label style="font-weight:bold; font-size:12px; color:#374151; display:block; margin-bottom:6px;">SELECCIONA LA ORDEN DE DESTINO</label>
            <select id="selectReqOcDestino" style="width:100%; padding:12px; border:2px solid #fcd34d; border-radius:8px; margin-bottom:25px; font-size:14px; font-weight:bold; color:#92400e; background:#fffbeb;">
                ${opciones}
            </select>

            <div style="display:flex; gap:10px;">
                <button onclick="confirmarAgregarA_OC_Existente()" style="flex:2; padding:14px; background:#d97706; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:15px; box-shadow:0 4px 6px rgba(217, 119, 6, 0.3);">✅ Añadir Artículos</button>
                <button onclick="document.querySelector('[data-modal=\\'agregar-req-oc\\']').remove()" style="flex:1; padding:14px; background:#e2e8f0; color:#475569; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">✕ Cancelar</button>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    window._reqsTempParaOC = seleccionados; // Memoria temporal
};

window.confirmarAgregarA_OC_Existente = function() {
    const ocId = parseInt(document.getElementById('selectReqOcDestino').value);
    const reqIds = window._reqsTempParaOC || [];
    if (!ocId || reqIds.length === 0) return;

    let ocs = _getOrdenesCompra();
    let idxOC = ocs.findIndex(o => o.id === ocId);
    if (idxOC === -1) return alert("❌ Error: OC no encontrada.");
    let oc = ocs[idxOC];

    let reqsTotales = StorageService.get("requisicionesCompra", []);
    let prods = StorageService.get("productos", []);
    let agregados = 0;

    reqIds.forEach(idReq => {
        let req = reqsTotales.find(r => String(r.id) === String(idReq));
        if (req && req.estatus === "Pendiente") {
            const prod = prods.find(p => String(p.id) === String(req.productoId) && _comprasProductoActivo(p));
            if (!prod) return;
            const costoUnitario = prod ? parseFloat(prod.costo) : 0;
            const cant = parseInt(req.cantidad) || 1;
            const caracteristicas = req.folioVenta ? `Req. Venta: ${req.folioVenta}` : "Req. Venta: S/F";

            // 1. Buscamos si ya existe el producto con esas características en la OC para sumar cantidad
            let idxArt = oc.articulos.findIndex(a => String(a.productoId) === String(req.productoId) && a.caracteristicas === caracteristicas);
            
            if (idxArt !== -1) {
                oc.articulos[idxArt].cantidad = (parseInt(oc.articulos[idxArt].cantidad) || 0) + cant;
                oc.articulos[idxArt].costo = parseFloat(oc.articulos[idxArt].costo) || 0;
                oc.articulos[idxArt].subtotal = oc.articulos[idxArt].cantidad * oc.articulos[idxArt].costo;
            } else {
                // Si no, lo agregamos como fila nueva (100% SANITIZADA)
                oc.articulos.push({
                    productoId: req.productoId || null,
                    nombre: req.producto || "Mercancía sin nombre",
                    costo: costoUnitario || 0,
                    cantidad: cant || 1,
                    subtotal: (cant * costoUnitario) || 0,
                    caracteristicas: caracteristicas,
                    yaEnInventario: false // 🔥 Evita el undefined que reventaba Firebase
                });
            }

            // 2. Marcamos la requisición como amarrada a esta OC
            req.estatus = `En OC (${oc.folio})`;
            agregados++;
        }
    });

    // 3. Recalcular la matemática de la Orden de Compra
    oc.total = oc.articulos.reduce((s, a) => s + (parseFloat(a.subtotal) || 0), 0) || 0;
    const anticipoPrevio = parseFloat(oc.anticipo_pagado) || 0;
    oc.saldoPendiente = Math.max(0, oc.total - anticipoPrevio) || 0;

    // 🧹 4. LIMPIEZA EXTREMA PARA FIREBASE: Destruir cualquier undefined residual
    Object.keys(oc).forEach(k => (oc[k] === undefined) && delete oc[k]);
    oc.articulos.forEach(art => {
        Object.keys(art).forEach(k => (art[k] === undefined) && delete art[k]);
    });

    // 5. Guardar cambios en las bases de datos
    StorageService.set('ordenesCompra', ocs);
    StorageService.set('requisicionesCompra', reqsTotales);
    
    document.querySelector('[data-modal="agregar-req-oc"]').remove();
    window._reqsTempParaOC = null;
    
    alert(`✅ ¡Éxito! Se añadieron ${agregados} producto(s) a la OC ${oc.folio}.\nEl nuevo total de la orden es ${dinero(oc.total)}`);
    
    // Refrescar vistas
    renderRequisiciones();
    if(typeof renderListaOrdenesCompra === 'function') renderListaOrdenesCompra();
};
// --- MARCAR REQUISICIONES SELECCIONADAS COMO YA EN INVENTARIO ---
window.marcarRequisicionesResueltasMasivo = function() {
    const seleccionados = Array.from(document.querySelectorAll('.chk-req:checked')).map(cb => cb.value);
    if (seleccionados.length === 0) return alert("⚠️ Selecciona al menos una requisición de la lista.");

    if (!confirm(`¿Confirmas que ya tienes en físico los ${seleccionados.length} producto(s) seleccionado(s)?\n\nEsto los quitará permanentemente de la lista de pendientes por comprar.`)) return;

    let reqs = StorageService.get("requisicionesCompra", []);
    let actualizados = 0;

    seleccionados.forEach(idReq => {
        const idx = reqs.findIndex(r => String(r.id) === String(idReq));
        if (idx !== -1) {
            reqs[idx].estatus = "Ya en Inventario";
            actualizados++;
        }
    });

    if (actualizados > 0) {
        StorageService.set("requisicionesCompra", reqs);
        if (typeof renderRequisiciones === 'function') renderRequisiciones();
        // Opcional: mostrar un mini aviso de éxito
        console.log(`✅ Se limpiaron ${actualizados} requisiciones.`);
    }
};

window.abrirModalAbonoConsignacion = function(idConsig) {
    const consignaciones = _getConsignacionesActivas();
    const c = consignaciones.find(x => String(x.id) === String(idConsig));
    if (!c) return alert("Consignacion no encontrada.");

    const saldo = _consigSaldo(c);
    if (saldo <= 0.01) return alert("Esta consignacion ya no tiene saldo pendiente.");

    const fechaHoy = _comprasHoyInput();
    const selector = typeof _buildSelectorCuentas === 'function'
        ? _buildSelectorCuentas('abonoConsigCuenta', false)
        : '<select id="abonoConsigCuenta" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:6px;"><option value="efectivo">Efectivo</option></select>';

    const html = `
    <div data-modal="abono-consignacion" style="position:fixed; inset:0; background:rgba(15,23,42,0.75); z-index:10000; display:flex; justify-content:center; align-items:center; padding:18px;">
        <div style="background:white; border-radius:12px; width:100%; max-width:430px; padding:24px; box-shadow:0 20px 40px rgba(0,0,0,0.25);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <h3 style="margin:0; color:#1e40af;">Abono a consignacion</h3>
                <button onclick="document.querySelector('[data-modal=abono-consignacion]')?.remove()" style="background:none; border:none; font-size:22px; cursor:pointer;">x</button>
            </div>
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:14px;">
                <strong>${c.proveedor || 'Proveedor'}</strong><br>
                <span style="color:#475569;">${c.producto || 'Producto'}</span><br>
                <small>Importe: ${dinero(_consigImporte(c))} | Pagos: ${dinero(_consigPagos(c))}</small><br>
                <strong style="color:#dc2626;">Saldo: ${dinero(saldo)}</strong>
            </div>
            <label style="display:block; font-size:12px; font-weight:bold; color:#475569; margin-bottom:5px;">Fecha</label>
            <input id="abonoConsigFecha" type="date" value="${fechaHoy}" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box; margin-bottom:12px;">
            <label style="display:block; font-size:12px; font-weight:bold; color:#475569; margin-bottom:5px;">Monto</label>
            <input id="abonoConsigMonto" type="number" min="0.01" max="${saldo}" step="0.01" placeholder="${saldo.toFixed(2)}" style="width:100%; padding:12px; border:2px solid #1e40af; border-radius:6px; box-sizing:border-box; font-size:17px; font-weight:bold; margin-bottom:12px;">
            <label style="display:block; font-size:12px; font-weight:bold; color:#475569; margin-bottom:5px;">Pagar desde</label>
            ${selector}
            <label style="display:block; font-size:12px; font-weight:bold; color:#475569; margin:12px 0 5px;">Nota</label>
            <input id="abonoConsigNota" type="text" placeholder="Opcional" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;">
            <div style="display:flex; gap:10px; margin-top:18px;">
                <button onclick="confirmarAbonoConsignacion('${String(idConsig).replace(/'/g, "\\'")}')" style="flex:2; padding:12px; background:#1e40af; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">Registrar abono</button>
                <button onclick="document.querySelector('[data-modal=abono-consignacion]')?.remove()" style="flex:1; padding:12px; background:#e2e8f0; color:#475569; border:none; border-radius:8px; cursor:pointer;">Cancelar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window.confirmarAbonoConsignacion = function(idConsig) {
    if (!_comprasRequireAdmin('Registrar abono de consignacion')) return;
    let consignaciones = _getConsignacionesActivas();
    const idx = consignaciones.findIndex(x => String(x.id) === String(idConsig));
    if (idx === -1) return alert("Consignacion no encontrada.");

    const c = consignaciones[idx];
    const saldo = _consigSaldo(c);
    const monto = parseFloat(document.getElementById('abonoConsigMonto')?.value) || 0;
    const fechaInput = document.getElementById('abonoConsigFecha')?.value;
    const sel = document.getElementById('abonoConsigCuenta');
    const nota = document.getElementById('abonoConsigNota')?.value.trim() || '';

    if (!fechaInput) return alert("Selecciona la fecha del abono.");
    if (monto <= 0 || monto > saldo + 0.01) return alert(`Monto invalido. Saldo disponible: ${dinero(saldo)}.`);
    if (!sel || !sel.value) return alert("Selecciona la cuenta de pago.");

    const cuentaId = sel.value;
    const etiqueta = sel.options[sel.selectedIndex]?.text || cuentaId;
    const fecha = `${fechaInput}T12:00:00.000`;

    if (!confirm(`Confirmas abonar ${dinero(monto)} a ${c.proveedor || 'proveedor'} por consignacion?`)) return;

    if (typeof _egresarCuenta === 'function') {
        _egresarCuenta({
            monto,
            cuentaId,
            etiqueta,
            concepto: `Abono consignacion ${c.proveedor || ''} - ${c.producto || ''}`.trim(),
            referencia: `CONSIG-${c.consignacionId || c.id}`,
            fecha
        });
    }

    c.abonos = _consigAbonos(c);
    c.abonos.push({
        id: Date.now() + Math.random(),
        fecha,
        fechaStr: window.formatearFechaCortaMX ? window.formatearFechaCortaMX(new Date(fecha)) : fechaInput,
        monto,
        cuentaId,
        cuenta: etiqueta,
        nota
    });
    c.montoAbonado = _consigPagos(c);
    consignaciones[idx] = c;
    StorageService.set("consignacionesActivas", consignaciones);

    document.querySelector('[data-modal="abono-consignacion"]')?.remove();
    document.querySelector('[data-modal="gestor-consignaciones"]')?.remove();
    abrirGestorConsignaciones();
    alert("Abono de consignacion registrado correctamente.");
};

window.abrirModalAbonoConsignacion = function(idConsig) {
    const resumen = _consigResumenGlobal();
    let grupo = resumen.grupos.find(g => String(g.key) === String(idConsig));
    if (!grupo) {
        const cLegacy = resumen.consignaciones.find(x => String(x.id) === String(idConsig));
        if (cLegacy) grupo = resumen.grupos.find(g => g.key === _consigProveedorKey(cLegacy));
    }
    if (!grupo) return alert("Proveedor de consignacion no encontrado.");

    const saldo = grupo.saldoNeto;
    if (saldo <= 0.01) return alert("Este proveedor ya no tiene saldo neto pendiente.");

    const fechaHoy = _comprasHoyInput();
    const selector = typeof _buildSelectorCuentas === 'function'
        ? _buildSelectorCuentas('abonoConsigCuenta', false)
        : '<select id="abonoConsigCuenta" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:6px;"><option value="efectivo">Efectivo</option></select>';

    const html = `
    <div data-modal="abono-consignacion" style="position:fixed; inset:0; background:rgba(15,23,42,0.75); z-index:10000; display:flex; justify-content:center; align-items:center; padding:18px;">
        <div style="background:white; border-radius:12px; width:100%; max-width:430px; padding:24px; box-shadow:0 20px 40px rgba(0,0,0,0.25);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <h3 style="margin:0; color:#1e40af;">Anticipo global a proveedor</h3>
                <button onclick="document.querySelector('[data-modal=abono-consignacion]')?.remove()" style="background:none; border:none; font-size:22px; cursor:pointer;">x</button>
            </div>
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:14px;">
                <strong>${_comprasEscHTML(grupo.proveedor || 'Proveedor')}</strong><br>
                <span style="color:#475569;">${grupo.consignaciones.length} partida(s) en consignacion</span><br>
                <small>Compra original: ${dinero(grupo.compraOriginal)} | Anticipos: ${dinero(grupo.anticiposTotal)}</small><br>
                <strong style="color:#dc2626;">Saldo neto: ${dinero(saldo)}</strong>
            </div>
            <label style="display:block; font-size:12px; font-weight:bold; color:#475569; margin-bottom:5px;">Fecha</label>
            <input id="abonoConsigFecha" type="date" value="${fechaHoy}" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box; margin-bottom:12px;">
            <label style="display:block; font-size:12px; font-weight:bold; color:#475569; margin-bottom:5px;">Monto</label>
            <input id="abonoConsigMonto" type="number" min="0.01" max="${saldo}" step="0.01" placeholder="${saldo.toFixed(2)}" style="width:100%; padding:12px; border:2px solid #1e40af; border-radius:6px; box-sizing:border-box; font-size:17px; font-weight:bold; margin-bottom:12px;">
            <label style="display:block; font-size:12px; font-weight:bold; color:#475569; margin-bottom:5px;">Pagar desde</label>
            ${selector}
            <label style="display:block; font-size:12px; font-weight:bold; color:#475569; margin:12px 0 5px;">Nota</label>
            <input id="abonoConsigNota" type="text" placeholder="Opcional" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;">
            <div style="display:flex; gap:10px; margin-top:18px;">
                <button onclick="confirmarAbonoConsignacion('${_comprasEscAttr(grupo.key)}')" style="flex:2; padding:12px; background:#1e40af; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">Registrar anticipo</button>
                <button onclick="document.querySelector('[data-modal=abono-consignacion]')?.remove()" style="flex:1; padding:12px; background:#e2e8f0; color:#475569; border:none; border-radius:8px; cursor:pointer;">Cancelar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window.confirmarAbonoConsignacion = function(idConsig) {
    if (!_comprasRequireAdmin('Registrar anticipo de consignacion')) return;
    const resumen = _consigResumenGlobal();
    const grupo = resumen.grupos.find(g => String(g.key) === String(idConsig));
    if (!grupo) return alert("Proveedor de consignacion no encontrado.");

    const saldo = grupo.saldoNeto;
    const monto = parseFloat(document.getElementById('abonoConsigMonto')?.value) || 0;
    const fechaInput = document.getElementById('abonoConsigFecha')?.value;
    const sel = document.getElementById('abonoConsigCuenta');
    const nota = document.getElementById('abonoConsigNota')?.value.trim() || '';

    if (!fechaInput) return alert("Selecciona la fecha del anticipo.");
    if (monto <= 0 || monto > saldo + 0.01) return alert(`Monto invalido. Saldo disponible: ${dinero(saldo)}.`);
    if (!sel || !sel.value) return alert("Selecciona la cuenta de pago.");

    const cuentaId = sel.value;
    const etiqueta = sel.options[sel.selectedIndex]?.text || cuentaId;
    const fecha = `${fechaInput}T12:00:00.000`;

    if (!confirm(`Confirmas registrar un anticipo de ${dinero(monto)} a ${grupo.proveedor || 'proveedor'} por consignacion?`)) return;

    if (typeof _egresarCuenta === 'function') {
        const egresoOk = _egresarCuenta({
            monto,
            cuentaId,
            etiqueta,
            concepto: `Anticipo consignacion ${grupo.proveedor || ''}`.trim(),
            referencia: `CONSIG-ANT-${Date.now()}`,
            fecha
        });
        if (egresoOk === false) return;
    }

    const anticipos = _getAnticiposConsignacion();
    anticipos.push({
        id: Date.now() + Math.random(),
        fecha,
        fechaStr: window.formatearFechaCortaMX ? window.formatearFechaCortaMX(new Date(fecha)) : fechaInput,
        monto,
        cuentaId,
        cuenta: etiqueta,
        nota,
        proveedor: grupo.proveedor,
        proveedorId: grupo.proveedorId || null,
        proveedorKey: grupo.key,
        aplicado: 0
    });
    StorageService.set("anticiposConsignacion", anticipos);
    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: folio ? 'ANTICIPO_CONSIGNACION_FOLIO' : 'ANTICIPO_CONSIGNACION_PROVEEDOR',
            modulo: 'Consignaciones',
            entidad: folio ? 'folio' : 'proveedor',
            entidadId: folio ? folio.folioOrigen : grupo.key,
            detalle: `Anticipo a ${grupo.proveedor || 'proveedor'}`,
            monto,
            severidad: 'riesgo',
            datos: { proveedor: grupo.proveedor, proveedorId: grupo.proveedorId || null, folioOrigen: folio ? folio.folioOrigen : null, cuentaId, cuenta: etiqueta, nota }
        });
    }

    document.querySelector('[data-modal="abono-consignacion"]')?.remove();
    document.querySelector('[data-modal="gestor-consignaciones"]')?.remove();
    abrirGestorConsignaciones();
    alert("Anticipo de consignacion registrado correctamente.");
};

window.marcarConsignacionVendida = function(idConsig) {
    if (!_comprasRequireAdmin('Reportar venta de consignacion')) return;
    let consigArr = StorageService.get("consignacionesActivas", []);
    const idx = consigArr.findIndex(c => String(c.id) === String(idConsig));
    if (idx === -1) return;
    const c = consigArr[idx];
    const sugerida = window._consigVentaSugerida && String(window._consigVentaSugerida.consignacionId) === String(idConsig)
        ? window._consigVentaSugerida
        : null;
    window._consigVentaSugerida = null;
    const cantidadSugerida = sugerida
        ? String(Math.min(Number(sugerida.cantidad || 0) || 0, Number(c.cantidadPendiente || 0) || 0) || '')
        : "";

    /*
    const cantidadAVender = parseInt(prompt(`¿Cuántas piezas de "${c.producto}" vendiste?\n\nStock disponible: ${c.cantidadPendiente}`));
    */
    const cantidadAVender = parseInt(prompt(`Cuantas piezas de "${c.producto}" vendiste?\n\nStock disponible: ${c.cantidadPendiente}`, cantidadSugerida));
    if (isNaN(cantidadAVender) || cantidadAVender <= 0 || cantidadAVender > c.cantidadPendiente) {
        return alert("❌ Cantidad inválida.");
    }

    const fechaPagoInput = prompt("📅 ¿En qué fecha tienes que liquidarle esto al proveedor? (Formato: YYYY-MM-DD)", window.obtenerHoyInputMX ? window.obtenerHoyInputMX() : new Date().toISOString().split('T')[0]);
    if (!fechaPagoInput) return alert("❌ Operación cancelada. Debes fijar una fecha de pago.");

    const montoDeuda = cantidadAVender * Number(c.costoUnitario || 0);
    
    const resumenGlobal = typeof _consigResumenGlobal === 'function' ? _consigResumenGlobal() : { grupos: [] };
    const provKey = typeof _consigProveedorKey === 'function' ? _consigProveedorKey(c) : (c.proveedorKey || c.proveedor);
    const resumenProveedor = resumenGlobal.grupos.find(g => g.key === provKey) || { anticiposTotal: 0, anticiposAplicados: 0 };
    const anticiposDisponibles = Math.max(0, Number(resumenProveedor.anticiposTotal || 0) - Number(resumenProveedor.anticiposAplicados || 0));

    let montoCubiertoConAnticipos = 0;

    if (anticiposDisponibles > 0.01) {
        const respuestaAbono = prompt(
            `💰 TIENES UN ANTICIPO GLOBAL DISPONIBLE DE: ${dinero(anticiposDisponibles)}\n\n` +
            `💸 Deuda que generará esta venta: ${dinero(montoDeuda)}\n\n` +
            `¿Cuánto de tu anticipo deseas aplicar para cubrir esta venta?\n` +
            `(Deja en 0 si prefieres guardar el anticipo para después)`, 
            "0"
        );
        
        if (respuestaAbono === null) return; 
        
        montoCubiertoConAnticipos = parseFloat(respuestaAbono) || 0;
        if (montoCubiertoConAnticipos < 0) montoCubiertoConAnticipos = 0;
        
        const maximoPermitido = Math.min(montoDeuda, anticiposDisponibles);
        if (montoCubiertoConAnticipos > maximoPermitido) {
            montoCubiertoConAnticipos = maximoPermitido;
        }
    }

    const montoCxp = Math.max(0, montoDeuda - montoCubiertoConAnticipos);
    const folioVentaOrigen = (prompt("Si corresponde a una venta del POS, captura el folio (opcional):", sugerida?.folioVenta || "") || "").trim();
    if (folioVentaOrigen && _consigReporteVentaExiste({ consignacionId: c.id, folioVenta: folioVentaOrigen })) {
        return alert("Esta venta de consignacion ya fue reportada. No se generara otra cuenta por pagar.");
    }
    const folioReporteConsignacion = window.generarFolioSistema ? window.generarFolioSistema("RCON") : `RCON-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const fechaVencimientoConsignacion = new Date(fechaPagoInput + "T12:00:00");
    const fechaActual = new Date();

    // 🔍 INDEXACIÓN DE AUDITORÍA: Rastrear el ID real del proveedor en el catálogo maestro
    const listaProveedores = StorageService.get("proveedores", []) || [];
    const provEncontrado = listaProveedores.find(p => String(p.nombre).toLowerCase().trim() === String(c.proveedor).toLowerCase().trim());
    const realProveedorId = provEncontrado ? provEncontrado.id : (c.proveedorId || c.proveedor);

    let cxp = StorageService.get("cuentasPorPagar", []) || [];
    
    const nuevaCxp = {
        id: Date.now(),
        compraId: c.compraId || Date.now(),
        consignacionId: c.id,
        folioOrigen: folioReporteConsignacion,
        folioVentaAsociada: folioVentaOrigen,
        origenConsignacion: true,
        proveedor: c.proveedor,
        proveedorId: realProveedorId, // Forzar ID maestro para romper el bloqueo de la vista CXP
        producto: c.producto,
        articulos: [{
            productoId: c.productoId || null,
            nombre: c.producto,
            cantidad: cantidadAVender,
            costo: Number(c.costoUnitario || 0),
            subtotal: montoDeuda,
            color: c.color || 'General',
            ubicacion: c.ubicacion || 'General'
        }],
        total: montoDeuda,
        monto: montoDeuda,
        subtotal: montoDeuda,
        saldo: montoCxp,
        saldoPendiente: montoCxp,
        tipo: "credito",               // Flag obligatorio para el renderizador general
        origen: "compras",             // Flag obligatorio para inyección en Runway
        estatus: "Pendiente",
        estado: "Pendiente",
        liquidado: false,
        pagado: false,
        abonos: montoCubiertoConAnticipos > 0.01 ? [{
            id: Date.now(),
            fecha: fechaActual.toISOString(),
            monto: montoCubiertoConAnticipos,
            cuenta: 'Anticipo consignacion',
            nota: `Aplicado de saldo a favor global (Folio: ${folioReporteConsignacion})`
        }] : [],
        fecha: typeof window.formatearFechaCortaMX === 'function' ? window.formatearFechaCortaMX(fechaActual) : fechaActual.toISOString().split('T')[0],
        fechaIso: fechaActual.toISOString(),
        vencimiento: typeof window.formatearFechaCortaMX === 'function' ? window.formatearFechaCortaMX(fechaVencimientoConsignacion) : fechaPagoInput,
        vencimientoIso: fechaVencimientoConsignacion.toISOString(),
        esConsignacion: false 
    };

    cxp.push(nuevaCxp);
    StorageService.set("cuentasPorPagar", cxp);

    consigArr[idx].cantidadPendiente -= cantidadAVender;
    consigArr[idx].cantidadVendida = Number(consigArr[idx].cantidadVendida || 0) + cantidadAVender;
    consigArr[idx].montoTransferido = Number(consigArr[idx].montoTransferido || 0) + montoCxp;
    consigArr[idx].montoVendidoReportado = Number(consigArr[idx].montoVendidoReportado || 0) + montoDeuda;
    consigArr[idx].montoAbonosAplicados = Number(consigArr[idx].montoAbonosAplicados || 0) + montoCubiertoConAnticipos;
    
    if (!consigArr[idx].ventasReportadas) consigArr[idx].ventasReportadas = [];
    consigArr[idx].ventasReportadas.push({
        fecha: fechaActual.toISOString(),
        cantidad: cantidadAVender,
        folioReporte: folioReporteConsignacion,
        folioVentaPOS: folioVentaOrigen,
        montoTotal: montoDeuda,
        anticipoUsado: montoCubiertoConAnticipos,
        montoEnviadoCxP: montoCxp,
        fechaPagoPrometida: fechaPagoInput
    });

    StorageService.set("consignacionesActivas", consigArr);
    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'REPORTE_VENTA_CONSIGNACION',
            modulo: 'Consignaciones',
            entidad: 'consignacion',
            entidadId: c.id,
            detalle: `${cantidadAVender} pza(s) vendidas de ${c.producto || 'producto'}`,
            monto: montoDeuda,
            severidad: montoCubiertoConAnticipos > 0.01 ? 'riesgo' : 'info',
            datos: {
                proveedor: c.proveedor,
                producto: c.producto,
                cantidad: cantidadAVender,
                folioReporte: folioReporteConsignacion,
                folioVentaPOS: folioVentaOrigen,
                anticipoUsado: montoCubiertoConAnticipos,
                montoEnviadoCxP: montoCxp,
                fechaPagoPrometida: fechaPagoInput
            }
        });
    }
    const modal = document.querySelector('[data-modal="gestor-consignaciones"]');
    if(modal) modal.remove();
    
    alert(`✅ Operación Exitosa.\n\nDeuda registrada por ${dinero(montoCxp)} con vencimiento el ${fechaPagoInput}.`);
    if(typeof abrirGestorConsignaciones === 'function') abrirGestorConsignaciones();
};

function _consigUiState() {
    window._consigUiState = window._consigUiState || { proveedorKey: '', folioKey: '' };
    return window._consigUiState;
}

function _consigAnticipoLectura(alcance = {}) {
    const entregado = Number(alcance.anticiposTotal || 0);
    const aplicado = Number(alcance.anticiposAplicados || 0);
    const aplicadoDesdeGlobal = Math.max(0, aplicado - entregado);
    const disponibleDirecto = Math.max(0, entregado - aplicado);
    const lineaGlobal = aplicadoDesdeGlobal > 0.01
        ? `<br><small style="color:#7c3aed;">Desde anticipo global: ${dinero(aplicadoDesdeGlobal)}</small>`
        : '';
    return { entregado, aplicado, aplicadoDesdeGlobal, disponibleDirecto, lineaGlobal };
}

function _consigResumenKPIs({ compraOriginal = 0, pagadoPorVentas = 0, anticiposTotal = 0, anticiposAplicados = 0, saldoNeto = 0 }) {
    const anticipo = _consigAnticipoLectura({ anticiposTotal, anticiposAplicados });
    return `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:14px;">
            <div style="background:#eff6ff;border:1px solid #bfdbfe;padding:14px;border-radius:8px;"><small style="color:#64748b;font-weight:bold;">Compra original</small><br><strong style="font-size:20px;color:#1d4ed8;">${dinero(compraOriginal)}</strong></div>
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:14px;border-radius:8px;"><small style="color:#64748b;font-weight:bold;">Pagado por ventas</small><br><strong style="font-size:20px;color:#15803d;">${dinero(pagadoPorVentas)}</strong></div>
            <div style="background:#eef2ff;border:1px solid #c7d2fe;padding:14px;border-radius:8px;"><small style="color:#64748b;font-weight:bold;">Anticipo entregado</small><br><strong style="font-size:20px;color:#4338ca;">${dinero(anticipo.entregado)}</strong></div>
            <div style="background:#ecfeff;border:1px solid #a5f3fc;padding:14px;border-radius:8px;"><small style="color:#64748b;font-weight:bold;">Anticipo aplicado</small><br><strong style="font-size:20px;color:#0e7490;">${dinero(anticipo.aplicado)}</strong><br><small style="color:#64748b;">Disp. directo ${dinero(anticipo.disponibleDirecto)}</small>${anticipo.lineaGlobal}</div>
            <div style="background:#fff1f2;border:1px solid #fecdd3;padding:14px;border-radius:8px;"><small style="color:#64748b;font-weight:bold;">Saldo neto</small><br><strong style="font-size:20px;color:#be123c;">${dinero(saldoNeto)}</strong></div>
        </div>`;
}

function _consigNormTexto(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function _consigFechaOrdenDoc(valor) {
    const raw = String(valor || '').trim();
    if (!raw) return 0;
    const directo = new Date(raw).getTime();
    if (!Number.isNaN(directo)) return directo;
    const limpio = _consigNormTexto(raw).replace(/\b(lun|mar|mie|jue|vie|sab|dom)\b/g, '').trim();
    const meses = { ene:0, enero:0, feb:1, febrero:1, mar:2, marzo:2, abr:3, abril:3, may:4, mayo:4, jun:5, junio:5, jul:6, julio:6, ago:7, agosto:7, sep:8, sept:8, septiembre:8, oct:9, octubre:9, nov:10, noviembre:10, dic:11, diciembre:11 };
    const m = limpio.match(/(\d{1,2})\s+de\s+([a-z]+)\s+(\d{4})/);
    if (m && meses[m[2]] !== undefined) return new Date(Number(m[3]), meses[m[2]], Number(m[1])).getTime();
    const normal = _comprasFechaVista(raw, raw);
    const vist = new Date(normal).getTime();
    return Number.isNaN(vist) ? 0 : vist;
}

function _consigValorPublico(valor) {
    const txt = String(valor || '').trim();
    return (!txt || _consigNormTexto(txt) === 'general') ? '' : txt;
}

function _consigVentaFolio(v = {}) {
    return String(v.folio || v.folioVenta || v.datosVenta?.folio || v.ticket || '').trim();
}

function _consigVentaFecha(v = {}) {
    return v.fechaVenta || v.fechaIso || v.fecha || v.datosVenta?.fechaVenta || v.datosVenta?.fecha || '';
}

function _consigVentaItems(v = {}) {
    const items = v.articulos || v.items || v.productos || v.datosVenta?.articulos || [];
    return _comprasAsegurarArray(items);
}

function _consigItemProductoId(item = {}) {
    return String(item.productoId || item.idProducto || item.product_id || item.id || '').trim();
}

function _consigItemNombre(item = {}) {
    return String(item.nombre || item.productoNombre || item.producto || item.descripcion || '').trim();
}

function _consigItemColor(item = {}) {
    return String(item.colorElegido || item.color || item.variante || '').trim();
}

function _consigItemCantidad(item = {}) {
    return Number(item.cantidad || item.qty || item.piezas || 1) || 1;
}

function _consigVentaCancelada(v = {}) {
    const estado = _consigNormTexto(`${v.estado || ''} ${v.estatus || ''} ${v.status || ''}`);
    return estado.includes('cancelad') || estado.includes('anulad');
}

function _consigFoliosYaReportados(consignaciones = []) {
    const set = new Set();
    const agregar = folio => {
        const limpio = String(folio || '').trim().toUpperCase();
        if (limpio) set.add(limpio);
    };
    consignaciones.forEach(c => {
        _comprasAsegurarArray(c.ventasReportadas).forEach(vr => {
            agregar(vr.folioVentaPOS);
            agregar(vr.folioVentaOrigen);
            agregar(vr.folioVentaAsociada);
            agregar(vr.folioVenta);
            agregar(vr.folio);
        });
    });
    _comprasAsegurarArray(StorageService.get("cuentasPorPagar", [])).forEach(cxp => {
        if (!cxp?.origenConsignacion) return;
        agregar(cxp.folioVentaAsociada);
        agregar(cxp.folioVentaOrigen);
        agregar(cxp.folioVenta);
        agregar(cxp.folio);
    });
    return set;
}

function _consigCxpLiquidada(cxp = {}) {
    const saldo = Number(cxp.saldoPendiente ?? cxp.saldo ?? 0) || 0;
    const estado = _consigNormTexto(`${cxp.estado || ''} ${cxp.estatus || ''}`);
    return saldo <= 0.01 || cxp.pagado === true || cxp.liquidado === true || estado.includes('liquidad') || estado.includes('pagad');
}

function _consigCxpsPendientesPorConsignacion(consignacionId) {
    const consId = String(consignacionId || '').trim();
    if (!consId) return [];
    return _comprasAsegurarArray(StorageService.get("cuentasPorPagar", []))
        .filter(cx => cx?.origenConsignacion && String(cx.consignacionId || '') === consId && !_consigCxpLiquidada(cx));
}

function _consigSaldoCxps(cxps = []) {
    return _comprasAsegurarArray(cxps).reduce((s, cxp) => s + (Number(cxp.saldoPendiente ?? cxp.saldo ?? 0) || 0), 0);
}

function _consigPiezasCxp(cxp = {}) {
    const articulos = _comprasAsegurarArray(cxp.articulos || []);
    const piezas = articulos.reduce((s, a) => s + (Number(a.cantidad || a.piezas || a.qty || 0) || 0), 0);
    return piezas || 1;
}

function _consigPiezasCxps(cxps = []) {
    return _comprasAsegurarArray(cxps).reduce((s, cxp) => s + _consigPiezasCxp(cxp), 0);
}

function _consigPagosRealesCxp(cxp = {}) {
    return _comprasAsegurarArray(cxp.abonos || []).filter(a => !_consigEsAnticipoAplicado(a));
}

function _consigTotalPagosRealesCxp(cxp = {}) {
    return _consigPagosRealesCxp(cxp).reduce((s, a) => s + (Number(a.monto || 0) || 0), 0);
}

function _consigTotalAnticiposCxp(cxp = {}) {
    return _comprasAsegurarArray(cxp.abonos || [])
        .filter(a => _consigEsAnticipoAplicado(a))
        .reduce((s, a) => s + (Number(a.monto || 0) || 0), 0);
}

function _consigProductoCxp(cxp = {}) {
    const articulo = _comprasAsegurarArray(cxp.articulos || [])[0] || {};
    return String(articulo.nombre || cxp.producto || '-')
        .replace(/^\s*\[Vendido de Consignacion\]\s*-\s*/i, '')
        .replace(/\s*\(\s*\d+(?:\.\d+)?\s*pzas?\s*\)\s*$/i, '')
        .trim() || '-';
}

function _consigReporteVentaExiste({ consignacionId, folioVenta } = {}) {
    const folioNorm = String(folioVenta || '').trim().toUpperCase();
    const consId = String(consignacionId || '').trim();
    if (!folioNorm && !consId) return false;

    const cxpExiste = _comprasAsegurarArray(StorageService.get("cuentasPorPagar", [])).some(cxp => {
        if (!cxp?.origenConsignacion) return false;
        const mismaConsig = consId && String(cxp.consignacionId || '') === consId;
        const mismoFolio = folioNorm && [
            cxp.folioVentaAsociada,
            cxp.folioVentaOrigen,
            cxp.folioVenta,
            cxp.folio
        ].some(v => String(v || '').trim().toUpperCase() === folioNorm);
        return mismoFolio && (!consId || mismaConsig);
    });
    if (cxpExiste) return true;

    return _getConsignacionesActivas().some(c => {
        if (consId && String(c.id || c.consignacionId || '') !== consId) return false;
        return _comprasAsegurarArray(c.ventasReportadas).some(vr =>
            [
                vr.folioVentaPOS,
                vr.folioVentaOrigen,
                vr.folioVentaAsociada,
                vr.folioVenta,
                vr.folio
            ].some(v => String(v || '').trim().toUpperCase() === folioNorm)
        );
    });
}

function _consigScoreCoincidencia(consignacion = {}, item = {}) {
    const consId = String(consignacion.productoId || consignacion.idProducto || '').trim();
    const itemId = _consigItemProductoId(item);
    const consNombre = _consigNormTexto(consignacion.producto || consignacion.nombre);
    const itemNombre = _consigNormTexto(_consigItemNombre(item));
    const consColor = _consigNormTexto(consignacion.color || '');
    const itemColor = _consigNormTexto(_consigItemColor(item));
    const itemCantidad = _consigItemCantidad(item);
    const pendiente = Number(consignacion.cantidadPendiente || 0);
    let score = 0;
    const motivos = [];

    if (consId && itemId && consId === itemId) {
        score += 90;
        motivos.push('ID de producto');
    }
    if (consNombre && itemNombre && consNombre === itemNombre) {
        score += 55;
        motivos.push('nombre exacto');
    } else if (consNombre && itemNombre && consNombre.length >= 6 && itemNombre.length >= 6 && (consNombre.includes(itemNombre) || itemNombre.includes(consNombre))) {
        score += 28;
        motivos.push('nombre parecido');
    }
    if (consColor && itemColor && consColor === itemColor) {
        score += 10;
        motivos.push('color');
    }
    if (pendiente > 0 && itemCantidad <= pendiente) {
        score += 5;
        motivos.push('cantidad posible');
    }
    return { score, motivos };
}

function _consigVentasProbablesFolio(folio) {
    const consignaciones = _comprasAsegurarArray(folio?.consignaciones).filter(c => Number(c.cantidadPendiente || 0) > 0);
    if (!consignaciones.length) return [];
    const foliosReportados = _consigFoliosYaReportados(consignaciones);
    const ventas = _comprasAsegurarArray(StorageService.get("ventasRegistradas", []));
    const resultados = [];
    const vistos = new Set();

    ventas.forEach(venta => {
        if (_consigVentaCancelada(venta)) return;
        const folioVenta = _consigVentaFolio(venta);
        if (folioVenta && foliosReportados.has(folioVenta.toUpperCase())) return;
        _consigVentaItems(venta).forEach((item, itemIndex) => {
            consignaciones.forEach(c => {
                const evalua = _consigScoreCoincidencia(c, item);
                if (evalua.score < 55) return;
                const key = `${folioVenta || 'SIN-FOLIO'}|${c.id}|${itemIndex}`;
                if (vistos.has(key)) return;
                vistos.add(key);
                resultados.push({
                    consignacionId: c.id,
                    productoConsignado: c.producto || '',
                    pendiente: Number(c.cantidadPendiente || 0),
                    folioVenta,
                    fechaVenta: _consigVentaFecha(venta),
                    cliente: venta.clienteNombre || venta.cliente?.nombre || venta.nombre || '',
                    productoVendido: _consigItemNombre(item),
                    colorVendido: _consigItemColor(item),
                    cantidad: _consigItemCantidad(item),
                    score: evalua.score,
                    motivos: evalua.motivos.join(', ')
                });
            });
        });
    });

    return resultados
        .sort((a, b) => (b.score - a.score) || String(b.fechaVenta || '').localeCompare(String(a.fechaVenta || '')))
        .slice(0, 25);
}

function _consigVentasProbablesPanel(folio) {
    const probables = _consigVentasProbablesFolio(folio);
    const rows = probables.map(p => {
        const payload = encodeURIComponent(JSON.stringify({
            consignacionId: p.consignacionId,
            folioVenta: p.folioVenta,
            cantidad: p.cantidad
        }));
        const confianza = p.score >= 90 ? 'Alta' : 'Media';
        const fecha = p.fechaVenta ? _comprasFechaVista(p.fechaVenta, '-') : '-';
        return `
            <tr style="border-bottom:1px solid #fde68a;">
                <td style="padding:9px;"><strong>${_comprasEscHTML(p.folioVenta || 'Sin folio')}</strong><br><small style="color:#64748b;">${_comprasEscHTML(fecha)}</small></td>
                <td style="padding:9px;">${_comprasEscHTML(p.cliente || '-')}</td>
                <td style="padding:9px;"><strong>${_comprasEscHTML(p.productoVendido || '-')}</strong>${p.colorVendido ? `<br><small style="color:#64748b;">Color: ${_comprasEscHTML(p.colorVendido)}</small>` : ''}<br><small style="color:#64748b;">Cantidad vendida: ${Number(p.cantidad || 0)}</small></td>
                <td style="padding:9px;">${_comprasEscHTML(p.productoConsignado || '-')}<br><small style="color:#64748b;">Pendiente: ${Number(p.pendiente || 0)} | ${_comprasEscHTML(p.motivos || '-')}</small></td>
                <td style="padding:9px;text-align:center;"><span style="display:inline-block;padding:4px 8px;border-radius:999px;background:${p.score >= 90 ? '#dcfce7' : '#fef9c3'};color:${p.score >= 90 ? '#166534' : '#854d0e'};font-weight:bold;font-size:12px;">${confianza}</span></td>
                <td style="padding:9px;text-align:center;"><button onclick="aplicarSugerenciaVentaConsignacion('${payload}')" style="padding:7px 10px;background:#059669;color:white;border:none;border-radius:7px;font-weight:bold;cursor:pointer;">Reportar esta venta</button></td>
            </tr>`;
    }).join('');

    return `
        <div style="border-top:1px solid #fed7aa;background:#fff7ed;padding:14px;">
            <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-bottom:10px;">
                <div>
                    <div style="font-size:12px;font-weight:900;color:#9a3412;text-transform:uppercase;">Ventas posiblemente de consignacion</div>
                    <div style="font-size:12px;color:#64748b;margin-top:2px;">Sugerencias de lectura solamente. Para afectar consignacion y CxP se usa el mismo flujo de Reportar venta.</div>
                </div>
                <span style="background:white;border:1px solid #fed7aa;color:#9a3412;border-radius:999px;padding:5px 10px;font-size:12px;font-weight:bold;">${probables.length} coincidencia(s)</span>
            </div>
            ${probables.length ? `
                <div style="overflow:auto;">
                    <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:840px;background:white;border:1px solid #fde68a;">
                        <thead style="background:#fffbeb;color:#92400e;"><tr><th style="padding:9px;text-align:left;">Venta</th><th style="padding:9px;text-align:left;">Cliente</th><th style="padding:9px;text-align:left;">Producto vendido</th><th style="padding:9px;text-align:left;">Coincide con</th><th style="padding:9px;text-align:center;">Confianza</th><th style="padding:9px;text-align:center;">Accion</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>` : '<div style="background:white;border:1px dashed #fed7aa;border-radius:8px;padding:12px;color:#64748b;font-size:13px;">No encontre ventas POS pendientes que coincidan con los productos de este folio.</div>'}
        </div>`;
}

window.aplicarSugerenciaVentaConsignacion = function(payload) {
    let data = {};
    try { data = JSON.parse(decodeURIComponent(payload || '')); } catch (e) { data = {}; }
    if (!data.consignacionId) return alert("No se pudo identificar la consignacion sugerida.");
    window._consigVentaSugerida = data;
    window.marcarConsignacionVendida(data.consignacionId);
};

function _consigProductoRows(folio) {
    // 🛡️ Leer directo de la fuente maestra para evadir cualquier fallo de agrupacion
    const todasCxp = StorageService.get("cuentasPorPagar", []); 

    return folio.consignaciones.map(c => {
        const cxpsPendientes = _consigCxpsPendientesPorConsignacion(c.id);
        const saldoPendienteVentas = _consigSaldoCxps(cxpsPendientes);
        const piezasPendientesPago = _consigPiezasCxps(cxpsPendientes);
        const piezasVendidas = Number(c.cantidadVendida || 0) || _comprasAsegurarArray(c.ventasReportadas).reduce((s, v) => s + (Number(v.cantidad || 0) || 0), 0);
        
        let btnPago = '';
        if (cxpVinculada) {
            btnPago = `<button onclick="abrirModalPagoConsignacion('${cxpVinculada.id}')" style="margin-top:6px; width:100%; padding:8px 12px;background:#be123c;color:white;border:none;border-radius:7px;font-weight:bold;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,0.1);">💸 Pagar Deuda</button>`;
        }

        return `
        <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:10px;">${_comprasEscHTML(c.fecha || '-')}</td>
            <td style="padding:10px;"><strong>${_comprasEscHTML(c.producto || '-')}</strong><br><small style="color:#64748b;">${_comprasEscHTML(c.color || 'General')} | ${_comprasEscHTML(c.ubicacion || 'General')}</small></td>
            <td style="padding:10px;text-align:center;">${Number(c.cantidadPendiente || 0)} / ${Number(c.cantidadTotal || 0)}</td>
            <td style="padding:10px;text-align:right;">${dinero(c.costoUnitario)}</td>
            <td style="padding:10px;text-align:right;"><strong>${dinero(_consigImporte(c))}</strong><br><small style="color:#64748b;">Pendiente: ${dinero(Number(c.cantidadPendiente || 0) * Number(c.costoUnitario || 0))}</small></td>
            <td style="padding:10px;text-align:center;vertical-align:middle;">
                ${Number(c.cantidadPendiente) > 0 ? `<button onclick="marcarConsignacionVendida('${String(c.id).replace(/'/g, "\\'")}')" style="width:100%; padding:8px 12px;background:#059669;color:white;border:none;border-radius:7px;font-weight:bold;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,0.1);">Reportar venta</button>` : ''}
                ${btnPago}
            </td>
        </tr>
        `;
    }).join('');
}

function _consigProductoRows(folio) {
    return folio.consignaciones.map(c => {
        const cxpsPendientes = _consigCxpsPendientesPorConsignacion(c.id);
        const saldoPendienteVentas = _consigSaldoCxps(cxpsPendientes);
        const piezasPendientesPago = _consigPiezasCxps(cxpsPendientes);
        const piezasVendidas = Number(c.cantidadVendida || 0) || _comprasAsegurarArray(c.ventasReportadas).reduce((s, v) => s + (Number(v.cantidad || 0) || 0), 0);

        const btnPago = cxpsPendientes.length
            ? `<button onclick="abrirModalPagoConsignacionGrupo('${String(c.id).replace(/'/g, "\\'")}')" style="margin-top:6px; width:100%; padding:8px 12px;background:#be123c;color:white;border:none;border-radius:7px;font-weight:bold;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,0.1);">Pagar ${dinero(saldoPendienteVentas)}</button>`
            : '';

        return `
        <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:10px;">${_comprasEscHTML(c.fecha || '-')}</td>
            <td style="padding:10px;"><strong>${_comprasEscHTML(c.producto || '-')}</strong><br><small style="color:#64748b;">${_comprasEscHTML(c.color || 'General')} | ${_comprasEscHTML(c.ubicacion || 'General')}</small></td>
            <td style="padding:10px;text-align:center;">${Number(c.cantidadPendiente || 0)} / ${Number(c.cantidadTotal || 0)}<br><small style="color:#64748b;">Vendidas: ${piezasVendidas}</small>${piezasPendientesPago ? `<br><small style="color:#be123c;font-weight:bold;">Pend. pago: ${piezasPendientesPago}</small>` : ''}</td>
            <td style="padding:10px;text-align:right;">${dinero(c.costoUnitario)}</td>
            <td style="padding:10px;text-align:right;"><strong>${dinero(_consigImporte(c))}</strong><br><small style="color:#64748b;">Pendiente inventario: ${dinero(Number(c.cantidadPendiente || 0) * Number(c.costoUnitario || 0))}</small>${saldoPendienteVentas ? `<br><small style="color:#be123c;font-weight:bold;">Por pagar ventas: ${dinero(saldoPendienteVentas)}</small>` : ''}</td>
            <td style="padding:10px;text-align:center;vertical-align:middle;">
                ${Number(c.cantidadPendiente) > 0 ? `<button onclick="marcarConsignacionVendida('${String(c.id).replace(/'/g, "\\'")}')" style="width:100%; padding:8px 12px;background:#059669;color:white;border:none;border-radius:7px;font-weight:bold;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,0.1);">Reportar venta</button>` : ''}
                ${btnPago}
            </td>
        </tr>`;
    }).join('');
}

window.seleccionarProveedorConsignacion = function(proveedorKey) {
    const s = _consigUiState();
    s.proveedorKey = proveedorKey || '';
    s.folioKey = '';
    abrirGestorConsignaciones();
};

window.seleccionarFolioConsignacion = function(folioKey) {
    const s = _consigUiState();
    s.folioKey = folioKey || '';
    abrirGestorConsignaciones();
};

window.abrirGestorConsignaciones = function() {
    const vistaGestor = document.getElementById('consignaciones');
    const contGestor = document.getElementById('contenidoGestorConsignaciones');
    if (contGestor && vistaGestor && (vistaGestor.classList.contains('oculto') || vistaGestor.style.display === 'none') && typeof window.navA === 'function') {
        window.navA('consignaciones');
        return;
    }

    const resumen = _consigResumenGlobal();
    const state = _consigUiState();
    let proveedor = resumen.grupos.find(g => g.key === state.proveedorKey) || null;
    if (!proveedor) {
        state.proveedorKey = '';
        state.folioKey = '';
    }
    let folio = proveedor ? proveedor.folios.find(f => f.key === state.folioKey) : null;
    if (!folio) state.folioKey = '';

    const totalImporte = resumen.grupos.reduce((s, g) => s + g.compraOriginal, 0);
    const totalPagadoVentas = resumen.grupos.reduce((s, g) => s + g.pagadoPorVentas, 0);
    const totalAnticipos = resumen.grupos.reduce((s, g) => s + g.anticiposTotal, 0);
    const totalAnticiposAplicados = resumen.grupos.reduce((s, g) => s + g.anticiposAplicados, 0);
    const totalSaldo = resumen.grupos.reduce((s, g) => s + g.saldoNeto, 0);

    const proveedoresHtml = resumen.grupos.map(g => {
        const activo = g.key === state.proveedorKey;
        
        // 🚀 NUEVO: Calculamos si hay dinero libre y creamos el badge
        const anticiposDisponibles = Math.max(0, Number(g.anticiposTotal || 0) - Number(g.anticiposAplicados || 0));
        const badgeAnticipo = anticiposDisponibles > 0.01 
            ? `<div style="margin-top:8px; display:inline-block; background:#dcfce7; color:#166534; border:1px solid #22c55e; padding:4px 8px; border-radius:6px; font-size:11px; font-weight:bold;">💰 A favor disponible: ${dinero(anticiposDisponibles)}</div>` 
            : '';

        return `
        <div style="border:1px solid ${activo ? '#2563eb' : '#dbeafe'};background:${activo ? '#eff6ff' : '#ffffff'};border-radius:8px;padding:12px;">
            <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
                <div>
                    <strong style="color:#0f172a;">${_comprasEscHTML(g.proveedor || 'Proveedor')}</strong><br>
                    <small style="color:#64748b;">${g.folios.length} folio(s) | ${g.anticipos.length} anticipo(s)</small>
                    <br>${badgeAnticipo}
                </div>
                <button onclick="seleccionarProveedorConsignacion('${_comprasEscAttr(g.key)}')" style="padding:7px 10px;background:${activo ? '#1d4ed8' : '#475569'};color:white;border:none;border-radius:7px;cursor:pointer;font-weight:bold;">${activo ? 'Activo' : 'Ver'}</button>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px;font-size:12px;">
                <div><span style="color:#64748b;">Original</span><br><b>${dinero(g.compraOriginal)}</b></div>
                <div><span style="color:#64748b;">Saldo neto</span><br><b style="color:#dc2626;">${dinero(g.saldoNeto)}</b></div>
            </div>
        </div>`;
    }).join('');

    const foliosHtml = proveedor ? proveedor.folios.map(f => {
        const activo = f.key === state.folioKey;
        const productosPendientes = f.consignaciones.reduce((s, c) => s + Number(c.cantidadPendiente || 0), 0);
        const anticipo = _consigAnticipoLectura(f);
        return `
        <tr style="border-bottom:1px solid #e2e8f0;background:${activo ? '#eff6ff' : 'white'};">
            <td style="padding:10px;"><strong>${_comprasEscHTML(f.folioOrigen)}</strong><br><small style="color:#64748b;">${f.consignaciones.length} producto(s)</small></td>
            <td style="padding:10px;text-align:center;">${productosPendientes}</td>
            <td style="padding:10px;text-align:right;">${dinero(f.compraOriginal)}</td>
            <td style="padding:10px;text-align:right;color:#2563eb;font-weight:bold;">${dinero(anticipo.entregado)}<br><small style="color:#0e7490;">Aplicado: ${dinero(anticipo.aplicado)}</small><br><small style="color:#64748b;">Disp. directo: ${dinero(anticipo.disponibleDirecto)}</small>${anticipo.lineaGlobal}</td>
            <td style="padding:10px;text-align:right;color:#dc2626;font-weight:bold;">${dinero(f.saldoNeto)}</td>
            <td style="padding:10px;text-align:center;white-space:nowrap;">
                <button onclick="seleccionarFolioConsignacion('${_comprasEscAttr(f.key)}')" style="padding:7px 10px;background:#1e40af;color:white;border:none;border-radius:7px;cursor:pointer;font-weight:bold;">Detalle</button>
                <button onclick="abrirModalAbonoConsignacion('folio:${_comprasEscAttr(f.key)}')" style="padding:7px 10px;background:#4338ca;color:white;border:none;border-radius:7px;cursor:pointer;font-weight:bold;">Abonar</button>
                <button onclick="abrirEstadoCuentaConsignaciones('folio','${_comprasEscAttr(f.key)}')" style="padding:7px 10px;background:#0f766e;color:white;border:none;border-radius:7px;cursor:pointer;font-weight:bold;">Estado</button>
            </td>
        </tr>`;
    }).join('') : '';

    let panelDerecho = `
        <div style="padding:34px;text-align:center;color:#64748b;">
            <strong style="display:block;color:#334155;margin-bottom:6px;">Selecciona un proveedor</strong>
            La mercancia en consignacion se mostrara solo despues de elegir proveedor y folio.
        </div>`;

    if (proveedor && !folio) {
        panelDerecho = `
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px;border-bottom:1px solid #e2e8f0;">
                <div>
                    <div style="font-size:12px;font-weight:900;color:#64748b;text-transform:uppercase;">Folios de ${_comprasEscHTML(proveedor.proveedor)}</div>
                    <div style="font-size:12px;color:#94a3b8;margin-top:2px;">Selecciona un folio para ver sus productos.</div>
                </div>
                <button onclick="abrirEstadoCuentaConsignaciones('proveedor','${_comprasEscAttr(proveedor.key)}')" style="padding:9px 12px;background:#0f766e;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">Estado proveedor</button>
            </div>
            <div style="overflow:auto;">
                <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:760px;">
                    <thead style="background:#f8fafc;color:#475569;"><tr><th style="padding:10px;text-align:left;">Folio</th><th style="padding:10px;text-align:center;">Pzas pend.</th><th style="padding:10px;text-align:right;">Original</th><th style="padding:10px;text-align:right;">Anticipos</th><th style="padding:10px;text-align:right;">Saldo</th><th style="padding:10px;text-align:center;">Accion</th></tr></thead>
                    <tbody>${foliosHtml || '<tr><td colspan="6" style="padding:24px;text-align:center;color:#64748b;">Este proveedor no tiene folios de consignacion.</td></tr>'}</tbody>
                </table>
            </div>`;
    }

    if (proveedor && folio) {
        panelDerecho = `
            <div style="padding:14px;border-bottom:1px solid #e2e8f0;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;">
                    <div>
                        <div style="font-size:12px;font-weight:900;color:#64748b;text-transform:uppercase;">Folio ${_comprasEscHTML(folio.folioOrigen)}</div>
                        <div style="font-size:13px;color:#334155;margin-top:3px;">${_comprasEscHTML(proveedor.proveedor)}</div>
                    </div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                        <button onclick="seleccionarFolioConsignacion('')" style="padding:9px 12px;background:#e2e8f0;color:#475569;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">Cambiar folio</button>
                        <button onclick="abrirModalAbonoConsignacion('folio:${_comprasEscAttr(folio.key)}')" style="padding:9px 12px;background:#4338ca;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">Abonar folio</button>
                        <button onclick="abrirEstadoCuentaConsignaciones('folio','${_comprasEscAttr(folio.key)}')" style="padding:9px 12px;background:#0f766e;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">Estado folio</button>
                    </div>
                </div>
                <div style="margin-top:12px;">${_consigResumenKPIs(folio)}</div>
            </div>
            <div style="overflow:auto;">
                <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:760px;">
                    <thead style="background:#f8fafc;color:#475569;"><tr><th style="padding:10px;text-align:left;">Ingreso</th><th style="padding:10px;text-align:left;">Producto</th><th style="padding:10px;text-align:center;">Pend./Total</th><th style="padding:10px;text-align:right;">Costo</th><th style="padding:10px;text-align:right;">Importe</th><th style="padding:10px;text-align:center;">Accion</th></tr></thead>
                    <tbody>${_consigProductoRows(folio) || '<tr><td colspan="6" style="padding:24px;text-align:center;color:#64748b;">Sin productos en este folio.</td></tr>'}</tbody>
                </table>
            </div>
            ${_consigVentasProbablesPanel(folio)}`;
    }

    const html = `
        <div class="vista-header" style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:18px;">
            <div>
                <h2 style="margin:0;color:#0f172a;">Gestor de Consignaciones</h2>
                <p style="margin:4px 0 0;color:#64748b;">Flujo por proveedor, folio y producto. Los anticipos a folio se reflejan en su propio estado de cuenta.</p>
            </div>
            <button onclick="abrirGestorConsignaciones()" style="padding:10px 14px;background:#475569;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:bold;">Actualizar</button>
        </div>
        ${_consigResumenKPIs({ compraOriginal: totalImporte, pagadoPorVentas: totalPagadoVentas, anticiposTotal: totalAnticipos, anticiposAplicados: totalAnticiposAplicados, saldoNeto: totalSaldo })}
        <div style="display:grid;grid-template-columns:minmax(260px,360px) minmax(0,1fr);gap:14px;align-items:start;">
            <section style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:14px;">
                <div style="font-size:12px;font-weight:900;color:#64748b;text-transform:uppercase;margin-bottom:10px;">Proveedores</div>
                <div style="display:grid;gap:10px;">${proveedoresHtml || '<div style="padding:14px;color:#64748b;background:#f8fafc;border-radius:8px;">Sin proveedores con consignaciones.</div>'}</div>
            </section>
            <section style="background:white;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">${panelDerecho}</section>
        </div>
        <div id="panelEstadoConsignaciones" style="margin-top:14px;"></div>`;

    if (contGestor) contGestor.innerHTML = html;
    else document.body.insertAdjacentHTML('beforeend', `<div data-modal="gestor-consignaciones" style="position:fixed;inset:0;background:rgba(15,23,42,0.75);z-index:9999;overflow:auto;padding:18px;"><div style="background:#f8fafc;border-radius:12px;max-width:1180px;margin:auto;padding:20px;">${html}</div></div>`);
};

window.abrirModalAbonoConsignacion = function(scopeKey) {
    const resumen = _consigResumenGlobal();
    const esFolio = String(scopeKey || '').startsWith('folio:');
    const cleanKey = esFolio ? String(scopeKey).slice(6) : String(scopeKey || '');
    const folio = esFolio ? resumen.folios.find(f => f.key === cleanKey) : null;
    const grupo = folio ? resumen.grupos.find(g => g.key === folio.proveedorKey) : resumen.grupos.find(g => g.key === cleanKey);
    if (!grupo) return alert("Proveedor de consignacion no encontrado.");

    const saldo = folio ? folio.saldoNeto : grupo.saldoNeto;
    if (saldo <= 0.01) return alert("No hay saldo neto pendiente para este alcance.");
    const fechaHoy = _comprasHoyInput();
    const selector = typeof _buildSelectorCuentas === 'function'
        ? _buildSelectorCuentas('abonoConsigCuenta', false)
        : '<select id="abonoConsigCuenta" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:6px;"><option value="efectivo">Efectivo</option></select>';

    const titulo = folio ? `Anticipo a folio ${_comprasEscHTML(folio.folioOrigen)}` : 'Anticipo global a proveedor';
    const lecturaAnticipo = _consigAnticipoLectura(folio || grupo);
    const resumenTexto = folio
        ? `<span style="color:#475569;">${_comprasEscHTML(grupo.proveedor)}<br>Folio: <b>${_comprasEscHTML(folio.folioOrigen)}</b></span><br><small>Compra original: ${dinero(folio.compraOriginal)} | Entregado directo: ${dinero(lecturaAnticipo.entregado)} | Aplicado: ${dinero(lecturaAnticipo.aplicado)} | Disponible directo: ${dinero(lecturaAnticipo.disponibleDirecto)}${lecturaAnticipo.aplicadoDesdeGlobal > 0.01 ? ` | Desde global: ${dinero(lecturaAnticipo.aplicadoDesdeGlobal)}` : ''}</small>`
        : `<span style="color:#475569;">${grupo.folios.length} folio(s) en consignacion</span><br><small>Compra original: ${dinero(grupo.compraOriginal)} | Entregado: ${dinero(lecturaAnticipo.entregado)} | Aplicado: ${dinero(lecturaAnticipo.aplicado)} | Disponible: ${dinero(lecturaAnticipo.disponibleDirecto)}</small>`;

    const html = `
    <div data-modal="abono-consignacion" style="position:fixed;inset:0;background:rgba(15,23,42,0.75);z-index:10000;display:flex;justify-content:center;align-items:center;padding:18px;">
        <div style="background:white;border-radius:12px;width:100%;max-width:450px;padding:24px;box-shadow:0 20px 40px rgba(0,0,0,0.25);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <h3 style="margin:0;color:#1e40af;">${titulo}</h3>
                <button onclick="document.querySelector('[data-modal=abono-consignacion]')?.remove()" style="background:none;border:none;font-size:22px;cursor:pointer;">x</button>
            </div>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:14px;">
                <strong>${_comprasEscHTML(grupo.proveedor || 'Proveedor')}</strong><br>
                ${resumenTexto}<br>
                <strong style="color:#dc2626;">Saldo neto: ${dinero(saldo)}</strong>
            </div>
            <input id="abonoConsigScope" type="hidden" value="${_comprasEscAttr(scopeKey)}">
            <label style="display:block;font-size:12px;font-weight:bold;color:#475569;margin-bottom:5px;">Fecha</label>
            <input id="abonoConsigFecha" type="date" value="${fechaHoy}" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:6px;box-sizing:border-box;margin-bottom:12px;">
            <label style="display:block;font-size:12px;font-weight:bold;color:#475569;margin-bottom:5px;">Monto</label>
            <input id="abonoConsigMonto" type="number" min="0.01" max="${saldo}" step="0.01" placeholder="${saldo.toFixed(2)}" style="width:100%;padding:12px;border:2px solid #1e40af;border-radius:6px;box-sizing:border-box;font-size:17px;font-weight:bold;margin-bottom:12px;">
            <label style="display:block;font-size:12px;font-weight:bold;color:#475569;margin-bottom:5px;">Pagar desde</label>
            ${selector}
            <label style="display:block;font-size:12px;font-weight:bold;color:#475569;margin:12px 0 5px;">Nota</label>
            <input id="abonoConsigNota" type="text" placeholder="Opcional" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:6px;box-sizing:border-box;">
            <div style="display:flex;gap:10px;margin-top:18px;">
                <button onclick="confirmarAbonoConsignacion()" style="flex:2;padding:12px;background:#1e40af;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">Registrar anticipo</button>
                <button onclick="document.querySelector('[data-modal=abono-consignacion]')?.remove()" style="flex:1;padding:12px;background:#e2e8f0;color:#475569;border:none;border-radius:8px;cursor:pointer;">Cancelar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window.confirmarAbonoConsignacion = function(scopeKeyParam) {
    if (!_comprasRequireAdmin('Registrar anticipo de consignacion')) return;
    const resumen = _consigResumenGlobal();
    const scopeKey = scopeKeyParam || document.getElementById('abonoConsigScope')?.value || '';
    const esFolio = String(scopeKey).startsWith('folio:');
    const cleanKey = esFolio ? String(scopeKey).slice(6) : String(scopeKey);
    const folio = esFolio ? resumen.folios.find(f => f.key === cleanKey) : null;
    const grupo = folio ? resumen.grupos.find(g => g.key === folio.proveedorKey) : resumen.grupos.find(g => g.key === cleanKey);
    if (!grupo) return alert("Proveedor de consignacion no encontrado.");

    const saldo = folio ? folio.saldoNeto : grupo.saldoNeto;
    const monto = parseFloat(document.getElementById('abonoConsigMonto')?.value) || 0;
    const fechaInput = document.getElementById('abonoConsigFecha')?.value;
    const sel = document.getElementById('abonoConsigCuenta');
    const nota = document.getElementById('abonoConsigNota')?.value.trim() || '';

    if (!fechaInput) return alert("Selecciona la fecha del anticipo.");
    if (monto <= 0 || monto > saldo + 0.01) return alert(`Monto invalido. Saldo disponible: ${dinero(saldo)}.`);
    if (!sel || !sel.value) return alert("Selecciona la cuenta de pago.");

    const cuentaId = sel.value;
    const etiqueta = sel.options[sel.selectedIndex]?.text || cuentaId;
    const fecha = `${fechaInput}T12:00:00.000`;
    const ref = `${folio ? 'CONSIG-FOLIO-ANT' : 'CONSIG-ANT'}-${Date.now()}`;
    if (!confirm(`Confirmas registrar un anticipo de ${dinero(monto)} a ${grupo.proveedor || 'proveedor'}${folio ? `, folio ${folio.folioOrigen}` : ''}?`)) return;

    if (typeof _egresarCuenta === 'function') {
        const egresoOk = _egresarCuenta({ monto, cuentaId, etiqueta, concepto: `${folio ? 'Anticipo folio consignacion' : 'Anticipo consignacion'} ${grupo.proveedor || ''}`.trim(), referencia: ref, idOperacion: ref, fecha });
        if (egresoOk === false) return;
    }

    const anticipos = _getAnticiposConsignacion();
    anticipos.push({
        id: Date.now() + Math.random(),
        fecha,
        fechaStr: window.formatearFechaCortaMX ? window.formatearFechaCortaMX(new Date(fecha)) : fechaInput,
        monto,
        cuentaId,
        cuenta: etiqueta,
        nota,
        proveedor: grupo.proveedor,
        proveedorId: grupo.proveedorId || null,
        proveedorKey: grupo.key,
        folioKey: folio ? folio.key : null,
        folioOrigen: folio ? folio.folioOrigen : null,
        aplicado: 0,
        referencia: ref
    });
    StorageService.set("anticiposConsignacion", anticipos);

    document.querySelector('[data-modal="abono-consignacion"]')?.remove();
    document.querySelector('[data-modal="gestor-consignaciones"]')?.remove();
    abrirGestorConsignaciones();
    alert("Anticipo de consignacion registrado correctamente.");
};

window.abrirEstadoCuentaConsignaciones = function(scope = 'actual', key = '') {
    const resumen = _consigResumenGlobal();
    const state = _consigUiState();
    if (scope === 'actual') {
        if (state.folioKey) { scope = 'folio'; key = state.folioKey; }
        else if (state.proveedorKey) { scope = 'proveedor'; key = state.proveedorKey; }
        else { scope = 'global'; }
    }
    const folio = scope === 'folio' ? resumen.folios.find(f => f.key === key) : null;
    const grupo = scope === 'proveedor' ? resumen.grupos.find(g => g.key === key) : (folio ? resumen.grupos.find(g => g.key === folio.proveedorKey) : null);

    const base = folio || grupo || {
        compraOriginal: resumen.grupos.reduce((s, g) => s + g.compraOriginal, 0),
        vendidoReportado: resumen.grupos.reduce((s, g) => s + g.vendidoReportado, 0),
        pagadoPorVentas: resumen.grupos.reduce((s, g) => s + g.pagadoPorVentas, 0),
        anticiposTotal: resumen.grupos.reduce((s, g) => s + g.anticiposTotal, 0),
        anticiposAplicados: 0,
        creditoAnticipos: resumen.grupos.reduce((s, g) => s + Number(g.creditoAnticipos ?? Math.max(Number(g.anticiposTotal || 0), Number(g.anticiposAplicados || 0))), 0),
        saldoNeto: resumen.grupos.reduce((s, g) => s + g.saldoNeto, 0),
        folios: resumen.folios,
        proveedor: 'Todos los Proveedores',
        folioOrigen: 'Global'
    };

    const titulo = folio
        ? `ESTADO DE CUENTA — CONSIGNACIÓN FOLIO: ${String(folio.folioOrigen).toUpperCase()}`
        : grupo
            ? `ESTADO DE CUENTA — PROVEEDOR: ${String(grupo.proveedor).toUpperCase()}`
            : 'ESTADO DE CUENTA GLOBAL DE CONSIGNACIONES';

    const cfgEmpresa = StorageService.get('configEmpresa', {}) || {};
    const empresaNombre = cfgEmpresa.nombre || 'Mueblería Mi Pueblito';
    const empresaTel = cfgEmpresa.telefono || cfgEmpresa.celular || '';
    const empresaDir = cfgEmpresa.direccion || '';

    const foliosEstado = folio ? [folio] : (grupo ? grupo.folios : resumen.folios);
    
    // 🚀 LA CURA DEFINITIVA AL DESCUADRE: 
    // Leer los valores oficiales del sistema, sin inventar cálculos paralelos.
    const kpiOriginal = base.compraOriginal || 0;
    const kpiVendido = base.vendidoReportado || 0;
    const kpiPagadoVentas = base.pagadoPorVentas || 0;
    const kpiAnticiposEntregados = Number(base.anticiposTotal || 0);
    const kpiAnticiposAplicados = Number(base.anticiposAplicados || 0);
    const kpiAnticiposDisponibles = Math.max(0, kpiAnticiposEntregados - kpiAnticiposAplicados);
    const kpiAnticiposResumen = Number(base.creditoAnticipos ?? Math.max(kpiAnticiposEntregados, kpiAnticiposAplicados));
    const kpiSaldoActualResumen = Math.max(0, kpiOriginal - kpiAnticiposResumen - kpiPagadoVentas);
    const kpiSaldoNeto = base.saldoNeto || 0;

    const filas = foliosEstado.map(f => {
        const itemsHtml = f.consignaciones.map(c => `
            <tr style="border-bottom:1px dashed #e2e8f0;font-size:11px;background:#ffffff;line-height:1.2;">
                <td style="padding:4px 8px 4px 18px; color:#475569; max-width:280px; word-wrap:break-word;">
                    <span style="color:#0f766e; font-weight:bold;">📦</span> ${_comprasEscHTML(c.producto)}
                    <br><small style="color:#94a3b8; font-weight:500;">🎨 Variedad: ${_comprasEscHTML(c.color || 'General')} | 📍 Bodega: ${_comprasEscHTML(c.ubicacion || 'General')}</small>
                </td>
                <td style="padding:4px 8px; text-align:right; color:#475569; font-weight:500;">${dinero(c.costoUnitario)}</td>
                <td style="padding:4px 8px; text-align:center; color:#334155; font-weight:600;">${Number(c.cantidadPendiente || 0)} / ${Number(c.cantidadTotal || 0)} u</td>
                <td style="padding:4px 8px; text-align:right; color:#0f172a; font-weight:600;">${dinero(_consigImporte(c))}</td>
                <td colspan="2" style="background:#f8fafc; border-bottom: 1px dashed #e2e8f0;"></td>
            </tr>
        `).join('');

        const anticiposHtml = f.anticipos.map(a => `
            <tr style="background:#f0fdf4;border-bottom:1px solid #e2e8f0;font-size:11px;line-height:1.2;">
                <td style="padding:4px 8px 4px 18px; color:#15803d; font-weight:600;">
                    <span style="color:#16a34a;">💰</span> Anticipo registrado (${_comprasEscHTML(_comprasFechaVista(a.fecha || a.fechaStr, '-'))})
                </td>
                <td colspan="3" style="padding:4px 8px; color:#64748b; font-style:italic; max-width:250px; word-wrap:break-word;">
                    Resguardo en Bolsa General
                </td>
                <td style="padding:4px 8px; text-align:right; color:#15803d; font-weight:bold;">${dinero(a.monto || 0)}</td>
                <td style="background:#f0fdf4; border-bottom:1px solid #e2e8f0;"></td>
            </tr>
        `).join('');

        const cxpHtml = f.cuentasCxp.map(cxp => {
            const pagosRealesVenta = _consigPagosRealesCxp(cxp);
            const pagosEfectivosVenta = _consigTotalPagosRealesCxp(cxp);
            const anticiposAplicadosVenta = _consigTotalAnticiposCxp(cxp);
                
            const saldoFijoRenglon = Math.max(0, Number(cxp.saldoPendiente ?? (Number(cxp.total || 0) - pagosEfectivosVenta - anticiposAplicadosVenta)));
            const productoLimpio = _consigProductoCxp(cxp);
            const piezasCxp = _consigPiezasCxp(cxp);
            const pagosDetalleHtml = pagosRealesVenta.map(p => `
            <tr style="background:#f0fdf4;border-bottom:1px solid #dcfce7;font-size:11px;line-height:1.2;">
                <td style="padding:4px 8px 4px 34px; color:#15803d; font-weight:600;">
                    ${_comprasEscHTML(productoLimpio)}
                </td>
                <td style="padding:4px 8px;text-align:center;color:#334155;">${piezasCxp} pza(s)</td>
                <td colspan="2" style="padding:4px 8px;text-align:right;color:#15803d;font-weight:bold;">${dinero(p.monto || 0)}</td>
                <td colspan="2" style="padding:4px 8px;text-align:right;color:#334155;">${_comprasEscHTML(_comprasFechaVista(p.fecha || p.fechaIso || p.fechaAbonoIso, '-'))}</td>
            </tr>`).join('');
            
            return pagosDetalleHtml;
            const controlPagoHtml = saldoFijoRenglon > 0.01 
                ? `<br><span style="color:#b91c1c; font-weight:bold; font-size:11px;">⚠️ Pendiente de Pago</span>`
                : '<br><span style="color:#166534; font-weight:bold; font-size:11px;">✔️ Liquidada al 100%</span>';
            return `
            <tr style="background:#fff5f5;border-bottom:1px solid #fecdd3;font-size:11px;line-height:1.2;">
                <td style="padding:4px 8px 4px 18px; color:#b91c1c;">
                    <span style="color:#ef4444;">📑</span> <b>Reporte de Venta</b> (${_comprasEscHTML(_comprasFechaVista(cxp.fecha || cxp.fechaISO || cxp.fechaIso, '-'))})
                    <br><small style="color:#475569;">${_comprasEscHTML(productoLimpio)}</small>
                </td>
                <td style="padding:4px 8px; text-align:right; color:#475569;">${dinero(cxp.articulos?.[0]?.costo || 0)}</td>
                <td style="padding:4px 8px; text-align:center; color:#334155;">${cxp.articulos?.[0]?.cantidad || 1} u</td>
                <td style="padding:4px 8px; text-align:right; color:#0f172a; font-weight:bold;">${dinero(cxp.total || 0)}</td>
                <td style="padding:4px 8px; text-align:right; color:#16a34a;">${dinero(pagosEfectivosVenta)}<br>${anticiposAplicadosVenta > 0.01 ? `<small style="color:#0e7490;font-size:10px;">Anticipo: ${dinero(anticiposAplicadosVenta)}</small>` : ''}</td>
                <td style="padding:4px 8px; text-align:right; color:#b91c1c; font-weight:bold;">
                    ${dinero(saldoFijoRenglon)}
                    ${controlPagoHtml}
                </td>
            </tr>
            ${pagosDetalleHtml}`;
        }).join('');

        const anticipo = _consigAnticipoLectura(f);
        return `
            <tr style="background:#f1f5f9;font-weight:bold;border-top:2px solid #cbd5e1;border-bottom:1px solid #cbd5e1;font-size:11px;line-height:1.2;">
                <td style="padding:6px 8px; color:#1e293b;">
                    <span style="color:#475569;">📄</span> Folio: ${_comprasEscHTML(f.folioOrigen)}
                    <br><small style="color:#64748b; font-weight:normal;">Proveedor: ${_comprasEscHTML(f.proveedor)}</small>
                </td>
                <td style="padding:6px 8px; text-align:right; color:#0f172a;">${dinero(f.compraOriginal)}</td>
                <td style="padding:6px 8px; text-align:right; color:#d97706;">${dinero(f.vendidoReportado)}</td>
                <td style="padding:6px 8px; text-align:right; color:#16a34a;">${dinero(f.pagadoPorVentas)}</td>
                <td style="padding:6px 8px; text-align:right; color:#2563eb;">${dinero(anticipo.entregado)}<br><small style="color:#0e7490;font-size:10px;">Aplicado: ${dinero(anticipo.aplicado)}</small><br><small style="color:#64748b;font-size:10px;">Disp: ${dinero(anticipo.disponibleDirecto)}</small>${anticipo.lineaGlobal}</td>
                <td style="padding:6px 8px; text-align:right; color:#be123c;">${dinero(f.saldoNeto)}</td>
            </tr>
            ${itemsHtml}
            ${anticiposHtml}
            ${cxpHtml}
        `;
    }).join('');

    const _consigFechaOrdenDoc = (valor) => {
        const raw = String(valor || '').trim();
        if (!raw) return 0;
        const directo = new Date(raw).getTime();
        if (!Number.isNaN(directo)) return directo;
        const limpio = _consigNormTexto(raw).replace(/\b(lun|mar|mie|jue|vie|sab|dom)\b/g, '').trim();
        const meses = { ene:0, enero:0, feb:1, febrero:1, mar:2, marzo:2, abr:3, abril:3, may:4, mayo:4, jun:5, junio:5, jul:6, julio:6, ago:7, agosto:7, sep:8, sept:8, septiembre:8, oct:9, octubre:9, nov:10, noviembre:10, dic:11, diciembre:11 };
        const m = limpio.match(/(\d{1,2})\s+de\s+([a-z]+)\s+(\d{4})/);
        if (m && meses[m[2]] !== undefined) return new Date(Number(m[3]), meses[m[2]], Number(m[1])).getTime();
        const normal = _comprasFechaVista(raw, raw);
        const vist = new Date(normal).getTime();
        return Number.isNaN(vist) ? 0 : vist;
    };
    const _consigValorPublico = (valor) => {
        const txt = String(valor || '').trim();
        return (!txt || _consigNormTexto(txt) === 'general') ? '' : txt;
    };

    const bloquesConsignacion = foliosEstado.map(f => {
        const productos = _comprasAsegurarArray(f.consignaciones).map(c => {
            const cantTotal = Number(c.cantidadTotal || 0);
            const cantPendiente = Number(c.cantidadPendiente || 0);
            const cantVendida = Math.max(0, cantTotal - cantPendiente);
            const variante = _consigValorPublico(c.color);
            return `
                <div style="border:1px solid #dbeafe;border-radius:9px;padding:9px;background:#eff6ff;break-inside:avoid;box-shadow:0 1px 2px rgba(15,23,42,.04);">
                    <div style="font-size:13px;font-weight:900;color:#1d4ed8;line-height:1.2;overflow-wrap:anywhere;">${_comprasEscHTML(c.producto || 'Producto')}</div>
                    <div style="display:grid;grid-template-columns:minmax(0,1fr) auto auto auto auto;gap:10px;align-items:center;margin-top:6px;font-size:12px;">
                    <span style="color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_comprasEscHTML(variante)}</span>
                    <span style="color:#475569;">Costo <b style="color:#0f172a;">${dinero(c.costoUnitario)}</b></span>
                    <span style="color:#475569;">Stock <b style="color:#0f172a;">${cantPendiente}/${cantTotal} u</b></span>
                    <span style="color:#475569;">Vend. <b style="color:#b45309;">${cantVendida} u</b></span>
                    <strong style="text-align:right;color:#1d4ed8;font-size:13px;white-space:nowrap;">${dinero(_consigImporte(c))}</strong>
                    </div>
                </div>`;
        }).join('');

        const anticiposBloque = _comprasAsegurarArray(f.anticipos)
            .slice()
            .sort((a, b) => _consigFechaOrdenDoc(a.fecha || a.fechaStr) - _consigFechaOrdenDoc(b.fecha || b.fechaStr))
            .map(a =>
            `<div style="display:grid;grid-template-columns:1fr auto;gap:10px;font-size:12px;border-top:1px solid #ddd6fe;padding:6px 0;color:#6d28d9;"><span>${_comprasEscHTML(_comprasFechaVista(a.fecha || a.fechaStr, '-'))}</span><strong>${dinero(a.monto || 0)}</strong></div>`
        ).join('');
        const ventasBloque = _comprasAsegurarArray(f.cuentasCxp)
            .slice()
            .sort((a, b) => _consigFechaOrdenDoc(a.fecha || a.fechaISO || a.fechaIso) - _consigFechaOrdenDoc(b.fecha || b.fechaISO || b.fechaIso))
            .map(cxp => {
                const pagos = _consigPagosRealesCxp(cxp);
                const productoLimpio = _consigProductoCxp(cxp);
                const piezasCxp = _consigPiezasCxp(cxp);
                return pagos.map(p => `<div style="display:grid;grid-template-columns:minmax(0,1fr) 56px auto 92px;gap:10px;font-size:12px;border-top:1px dashed #bbf7d0;padding:5px 0;color:#15803d;align-items:center;"><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_comprasEscHTML(productoLimpio)}</span><span style="text-align:center;color:#334155;">${piezasCxp}</span><strong>${dinero(p.monto || 0)}</strong><span style="text-align:right;color:#334155;">${_comprasEscHTML(_comprasFechaVista(p.fecha || p.fechaIso || p.fechaAbonoIso, '-'))}</span></div>`).join('');
            }).join('');
        const subtotalProductos = _comprasAsegurarArray(f.consignaciones).reduce((s, c) => s + Number(_consigImporte(c) || 0), 0);
        const subtotalAnticipos = _comprasAsegurarArray(f.anticipos).reduce((s, a) => s + Number(a.monto || 0), 0);
        const subtotalVentas = _comprasAsegurarArray(f.cuentasCxp).reduce((s, cxp) => s + _consigTotalPagosRealesCxp(cxp), 0);
        const tituloBloque = scope === 'folio'
            ? ''
            : `<div style="background:#f8fafc;border-bottom:1px solid #dbe4ee;padding:8px 10px;"><strong style="font-size:14px;color:#0f172a;">Folio ${_comprasEscHTML(f.folioOrigen || '-')}</strong><span style="font-size:12px;color:#64748b;margin-left:8px;">${_comprasEscHTML(f.proveedor || '')}</span></div>`;

        return `
            <section style="border:1px solid #dbe4ee;border-radius:9px;margin:10px 0;overflow:hidden;background:#fff;">
                ${tituloBloque}
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;padding:10px;">${productos || '<div style="color:#94a3b8;">Sin productos.</div>'}</div>
                <div style="margin:0 10px 10px;padding:8px 10px;border-top:2px solid #1d4ed8;background:#eff6ff;border-radius:7px;text-align:right;font-size:13px;color:#1d4ed8;font-weight:900;">Subtotal productos: ${dinero(subtotalProductos)}</div>
                ${(anticiposBloque || ventasBloque) ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 10px 10px;">
                    <div style="border:1px solid #ddd6fe;border-radius:9px;padding:9px;background:#f5f3ff;"><div style="font-size:14px;font-weight:900;color:#6d28d9;margin-bottom:4px;">Anticipos</div>${anticiposBloque || '<div style="font-size:12px;color:#94a3b8;">Sin anticipos.</div>'}<div style="border-top:2px solid #c4b5fd;margin-top:6px;padding-top:6px;text-align:right;font-weight:900;color:#6d28d9;">Subtotal anticipos: ${dinero(subtotalAnticipos)}</div></div>
                    <div style="border:1px solid #bbf7d0;border-radius:9px;padding:9px;background:#f0fdf4;"><div style="font-size:14px;font-weight:900;color:#15803d;margin-bottom:4px;">Pagado por ventas</div>${ventasBloque || '<div style="font-size:12px;color:#94a3b8;">Sin ventas.</div>'}<div style="border-top:2px solid #86efac;margin-top:6px;padding-top:6px;text-align:right;font-weight:900;color:#15803d;">Subtotal pagado: ${dinero(subtotalVentas)}</div></div>
                </div>` : ''}
            </section>`;
    }).join('');

    const safeDomId = `panel-consignacion-print-${scope}-${String(key).replace(/[^a-zA-Z0-9_-]/g, '-')}`;

    const html = `
        <div id="${safeDomId}" style="background:#ffffff; padding:16px; color:#0f172a; font-family:Arial, sans-serif; box-sizing:border-box;">
            <div style="border-bottom:2px solid #0f766e; padding-bottom:9px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
                <div style="flex:1;">
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:4px;">
                        <img src="img/Logo.svg" alt="Logo" style="width:44px;height:44px;object-fit:contain;flex:0 0 44px;" onerror="this.style.display='none'">
                        <div style="display:flex;flex-direction:column;justify-content:center;min-height:44px;">
                            <div style="font-size:15px; font-weight:900; color:#0f766e; letter-spacing:-0.5px;">${empresaNombre.toUpperCase()}</div>
                            ${empresaDir ? `<div style="font-size:11px; color:#64748b; margin-top:1px;">${empresaDir}</div>` : ''}
                            ${empresaTel ? `<div style="font-size:11px; color:#64748b;">Tel/Cel: ${empresaTel}</div>` : ''}
                        </div>
                    </div>
                    <h2 style="margin:2px 0 0; color:#0f766e; font-size:16px; font-weight:800; letter-spacing:-0.5px;">${titulo}</h2>
                    <p style="margin:2px 0 0; color:#64748b; font-size:12px;">Filtro de Alcance: <strong style="color:#334155;">${scope.toUpperCase()}</strong></p>
                </div>
                <div style="text-align:right; min-width:180px;">
                    <button onclick="window.emitirEstadoCuentaProveedor('${scope}', '${key}', 'pdf')" style="background:#1e40af; border:none; color:white; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:12px; margin-bottom:8px; margin-right:6px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">PDF</button>
                    <button id="btn-img-consig-${safeDomId}" onclick="window.descargarImagenEstadoCuentaConsignacion('${scope}', '${key}')" style="background:#047857; border:none; color:white; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:12px; margin-bottom:8px; margin-right:6px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">Imagen</button>
                    <button onclick="window.emitirEstadoCuentaProveedor('${scope}', '${key}', 'ticket')" style="background:#7c3aed; border:none; color:white; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:12px; margin-bottom:8px; margin-right:8px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">Ticket termico</button>
                    <button onclick="if(document.getElementById('panelEstadoConsignaciones')){document.getElementById('panelEstadoConsignaciones').innerHTML=''}else{document.querySelector('[data-modal=estado-consignaciones]')?.remove()}" style="background:#f1f5f9; border:1px solid #cbd5e1; color:#475569; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:12px; margin-bottom:8px;">✕ Cerrar</button>
                    <p style="margin:0; color:#64748b; font-size:12px;">Fecha Emisión: <strong style="color:#334155;">${_comprasFechaVista(new Date())}</strong></p>
                    <p style="margin:2px 0 0; color:#64748b; font-size:11px;">Hora: <strong>${new Date().toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit'})}</strong></p>
                </div>
            </div>

            <div style="display:none;background:#f8fafc; border:1px solid #e2e8f0; border-radius:7px; padding:7px 10px; margin-bottom:10px; font-size:10.5px; color:#475569; line-height:1.25;">
                📌 <strong>Regla de Auditoría Consolidada:</strong> Balance Pendiente Exigible = Compra Recibida − Pagos Liquidados − Bolsa de Anticipos Libres.
            </div>

            <div style="display:none; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:8px; margin-bottom:12px;">
                <div style="background:#eff6ff; border:1px solid #bfdbfe; padding:8px; border-radius:7px;">
                    <small style="color:#1e40af; font-weight:bold; font-size:11px; text-transform:uppercase;">Compra Original</small><br>
                    <strong style="font-size:15px; color:#1d4ed8;">${dinero(kpiOriginal)}</strong>
                </div>
                <div style="background:#fef3c7; border:1px solid #fde68a; padding:8px; border-radius:7px;">
                    <small style="color:#92400e; font-weight:bold; font-size:11px; text-transform:uppercase;">Vendido / Reportado</small><br>
                    <strong style="font-size:15px; color:#b45309;">${dinero(kpiVendido)}</strong>
                </div>
                <div style="background:#f0fdf4; border:1px solid #bbf7d0; padding:8px; border-radius:7px;">
                    <small style="color:#166534; font-weight:bold; font-size:11px; text-transform:uppercase;">Pagado por Ventas</small><br>
                    <strong style="font-size:15px; color:#15803d;">${dinero(kpiPagadoVentas)}</strong>
                </div>
                <div style="background:#f5f3ff; border:1px solid #ddd6fe; padding:8px; border-radius:7px;">
                    <small style="color:#5b21b6; font-weight:bold; font-size:11px; text-transform:uppercase;">Anticipo Entregado</small><br>
                    <strong style="font-size:15px; color:#6d28d9;">${dinero(kpiAnticiposEntregados)}</strong><br>
                    <small style="color:#0e7490;">Aplicado: ${dinero(kpiAnticiposAplicados)}</small><br>
                    <small style="color:#64748b;">Disponible: ${dinero(kpiAnticiposDisponibles)}</small>
                </div>
                <div style="background:#fff1f2; border:1px solid #fecdd3; padding:8px; border-radius:7px;">
                    <small style="color:#991b1b; font-weight:bold; font-size:11px; text-transform:uppercase;">Saldo Neto Real</small><br>
                    <strong style="font-size:15px; color:#be123c;">${dinero(kpiSaldoNeto)}</strong>
                </div>
            </div>

            ${bloquesConsignacion || '<div style="padding:16px;text-align:center;color:#94a3b8;">No hay registros.</div>'}

            <div style="margin-top:12px;border:1px solid #cbd5e1;border-radius:9px;overflow:hidden;background:#ffffff;break-inside:avoid;">
                <div style="background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:9px 12px;font-size:12px;font-weight:900;color:#334155;text-transform:uppercase;">Resumen</div>
                <div style="display:grid;grid-template-columns:minmax(112px,1fr) 18px minmax(112px,1fr) 18px minmax(112px,1fr) 18px minmax(120px,1fr);gap:8px;align-items:stretch;padding:12px;">
                    <div style="border:1px solid #dbeafe;background:#eff6ff;border-radius:7px;padding:8px 10px;">
                        <small style="display:block;color:#1e40af;font-size:10px;font-weight:900;text-transform:uppercase;">Productos</small>
                        <strong style="display:block;color:#1d4ed8;font-size:15px;text-align:right;">${dinero(kpiOriginal)}</strong>
                    </div>
                    <div style="display:flex;align-items:center;justify-content:center;font-weight:900;color:#64748b;font-size:18px;">-</div>
                    <div style="border:1px solid #ddd6fe;background:#f5f3ff;border-radius:7px;padding:8px 10px;">
                        <small style="display:block;color:#5b21b6;font-size:10px;font-weight:900;text-transform:uppercase;">Anticipos</small>
                        <strong style="display:block;color:#6d28d9;font-size:15px;text-align:right;">${dinero(kpiAnticiposResumen)}</strong>
                    </div>
                    <div style="display:flex;align-items:center;justify-content:center;font-weight:900;color:#64748b;font-size:18px;">-</div>
                    <div style="border:1px solid #bbf7d0;background:#f0fdf4;border-radius:7px;padding:8px 10px;">
                        <small style="display:block;color:#166534;font-size:10px;font-weight:900;text-transform:uppercase;">Pagado</small>
                        <strong style="display:block;color:#15803d;font-size:15px;text-align:right;">${dinero(kpiPagadoVentas)}</strong>
                    </div>
                    <div style="display:flex;align-items:center;justify-content:center;font-weight:900;color:#64748b;font-size:18px;">=</div>
                    <div style="border:1px solid #fecdd3;background:#fff1f2;border-radius:7px;padding:8px 10px;">
                        <small style="display:block;color:#991b1b;font-size:10px;font-weight:900;text-transform:uppercase;">Saldo actual</small>
                        <strong style="display:block;color:#be123c;font-size:16px;text-align:right;">${dinero(kpiSaldoActualResumen)}</strong>
                    </div>
                </div>
            </div>

            <div style="display:none;width:100%; overflow-x:auto; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:14px; box-sizing:border-box;">
                <table style="width:100%; border-collapse:collapse; font-size:11px; min-width:760px; table-layout:fixed;">
                    <colgroup>
                        <col style="width: 35%;">
                        <col style="width: 13%;">
                        <col style="width: 14%;">
                        <col style="width: 13%;">
                        <col style="width: 13%;">
                        <col style="width: 12%;">
                    </colgroup>
                    <thead style="background:#f8fafc; color:#475569; border-bottom:2px solid #e2e8f0;">
                        <tr>
                            <th style="padding:6px 8px; text-align:left; font-weight:700; text-transform:uppercase; font-size:10px;">Origen / Producto / Variante</th>
                            <th style="padding:6px 8px; text-align:right; font-weight:700; text-transform:uppercase; font-size:10px;">Costo base</th>
                            <th style="padding:6px 8px; text-align:center; font-weight:700; text-transform:uppercase; font-size:10px;">Stock</th>
                            <th style="padding:6px 8px; text-align:right; font-weight:700; text-transform:uppercase; font-size:10px;">Importe</th>
                            <th style="padding:6px 8px; text-align:right; font-weight:700; text-transform:uppercase; font-size:10px;">Anticipos</th>
                            <th style="padding:6px 8px; text-align:right; font-weight:700; text-transform:uppercase; font-size:10px;">Saldo</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filas || '<tr><td colspan="6" style="padding:32px; text-align:center; color:#94a3b8; background:#ffffff;">No hay registros.</td></tr>'}
                    </tbody>
                </table>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:60px; margin-top:40px; padding:0 20px;">
                <div style="text-align:center;">
                    <div style="border-top:1px solid #94a3b8; padding-top:8px; font-size:12px; font-weight:700; color:#334155;">Elaboró / Administración Interna</div>
                </div>
                <div style="text-align:center;">
                    <div style="border-top:1px solid #94a3b8; padding-top:8px; font-size:12px; font-weight:700; color:#334155;">Validó / Proveedor Acreedor</div>
                </div>
            </div>
        </div>`;

    const panel = document.getElementById('panelEstadoConsignaciones');
    if (panel) { panel.innerHTML = html; panel.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    else { document.body.insertAdjacentHTML('beforeend', `<div data-modal="estado-consignaciones" style="position:fixed; inset:0; background:rgba(15,23,42,0.6); backdrop-filter:blur(4px); z-index:10001; display:flex; justify-content:center; align-items:flex-start; padding:20px; overflow-y:auto;"><div style="max-width:1120px; width:100%; background:#ffffff; border-radius:12px; overflow:hidden;">${html}</div></div>`); }
};

window.descargarImagenEstadoCuentaConsignacion = function(scope = 'actual', key = '') {
    const state = _consigUiState();
    if (scope === 'actual') {
        if (state.folioKey) { scope = 'folio'; key = state.folioKey; }
        else if (state.proveedorKey) { scope = 'proveedor'; key = state.proveedorKey; }
        else { scope = 'global'; key = ''; }
    }

    const safeDomId = `panel-consignacion-print-${scope}-${String(key).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    const origen = document.getElementById(safeDomId);
    if (!origen) return alert('Abre primero el estado de cuenta de consignacion.');

    const btn = document.getElementById(`btn-img-consig-${safeDomId}`);
    const textoOriginal = btn ? btn.textContent : '';
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Generando...';
    }

    _cargarHtml2CanvasEstadoProveedor(() => {
        const clone = origen.cloneNode(true);
        clone.querySelectorAll('button, script, .no-print, .mmp-document-toolbar, .mmp-print-toolbar').forEach(el => el.remove());
        clone.style.width = `${Math.max(origen.offsetWidth || 960, 960)}px`;
        clone.style.background = '#ffffff';

        const wrap = document.createElement('div');
        wrap.style.position = 'fixed';
        wrap.style.left = '-12000px';
        wrap.style.top = '0';
        wrap.style.background = '#ffffff';
        wrap.style.padding = '0';
        wrap.appendChild(clone);
        document.body.appendChild(wrap);

        html2canvas(clone, { scale: 2, backgroundColor: '#ffffff', useCORS: true, allowTaint: false, logging: false })
            .then(canvas => {
                const link = document.createElement('a');
                const nombre = `estado_consignacion_${scope}_${String(key || 'general').replace(/[^\w-]+/g, '_')}.png`;
                link.download = nombre;
                link.href = canvas.toDataURL('image/png');
                link.click();
            })
            .catch(err => {
                console.error('Error generando imagen de consignacion:', err);
                alert('No se pudo generar la imagen. Intenta con PDF.');
            })
            .finally(() => {
                wrap.remove();
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = textoOriginal || 'Imagen';
                }
            });
    });
};

window.imprimirEstadoCuentaClean = function(divId) {
    const contenedor = document.getElementById(divId);
    if (!contenedor) return alert("No se encontró el documento a imprimir.");

    // 1. Clonamos el contenedor para manipularlo sin destruir la pantalla que estás viendo
    const clon = contenedor.cloneNode(true);
    
    // 2. Eliminamos todos los botones para que no salgan horribles en el papel
    const botones = clon.querySelectorAll('button');
    botones.forEach(b => b.remove());

    // 3. Extraemos el HTML ya limpio
    const htmlLimpio = clon.innerHTML;

    // 4. Creamos una "ventana" invisible (iframe) para no abrir pop-ups molestos
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Estado de Cuenta - Consignaciones</title>
            <style>
                /* Forzar formato de papel Carta, quitando márgenes del navegador */
                @page { 
                    margin: 10mm 15mm; 
                    size: letter portrait; 
                }
                body { 
                    font-family: Arial, sans-serif; 
                    /* Esta línea mágica fuerza a las impresoras a pintar los fondos de color */
                    -webkit-print-color-adjust: exact !important; 
                    print-color-adjust: exact !important; 
                    margin: 0;
                    padding: 0;
                    background: #ffffff;
                }
                * {
                    box-sizing: border-box;
                }
                /* Obligar a la tabla a no salirse del ancho de la hoja */
                table { 
                    width: 100% !important; 
                    table-layout: fixed; 
                    border-collapse: collapse;
                }
                td, th {
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                }
            </style>
        </head>
        <body>
            <div style="width: 100%; max-width: 800px; margin: 0 auto;">
                ${htmlLimpio}
            </div>
            <script>
                // Le damos medio segundo a la impresora para que cargue los colores antes de lanzar el diálogo
                setTimeout(() => {
                    window.print();
                }, 500);
            </script>
        </body>
        </html>
    `);
    doc.close();

    // Limpiamos la basura invisible después de unos segundos
    setTimeout(() => {
        document.body.removeChild(iframe);
    }, 5000);
};

window.emitirEstadoCuentaProveedor = function(scope = 'actual', key = '', modo = 'documento') {
    const resumen = _consigResumenGlobal();
    const state = _consigUiState();
    
    if (scope === 'actual') {
        if (state.folioKey) { scope = 'folio'; key = state.folioKey; }
        else if (state.proveedorKey) { scope = 'proveedor'; key = state.proveedorKey; }
        else { scope = 'global'; }
    }
    
    const folio = scope === 'folio' ? resumen.folios.find(f => f.key === key) : null;
    const grupo = scope === 'proveedor' ? resumen.grupos.find(g => g.key === key) : (folio ? resumen.grupos.find(g => g.key === folio.proveedorKey) : null);

    const base = folio || grupo || {
        compraOriginal: resumen.grupos.reduce((s, g) => s + g.compraOriginal, 0),
        vendidoReportado: resumen.grupos.reduce((s, g) => s + g.vendidoReportado, 0),
        pagadoPorVentas: resumen.grupos.reduce((s, g) => s + g.pagadoPorVentas, 0),
        anticiposTotal: resumen.grupos.reduce((s, g) => s + g.anticiposTotal, 0),
        anticiposAplicados: 0,
        creditoAnticipos: resumen.grupos.reduce((s, g) => s + Number(g.creditoAnticipos ?? Math.max(Number(g.anticiposTotal || 0), Number(g.anticiposAplicados || 0))), 0),
        saldoNeto: resumen.grupos.reduce((s, g) => s + g.saldoNeto, 0),
        folios: resumen.folios,
        anticipos: resumen.anticipos,
        cuentasCxp: resumen.cuentasCxp,
        consignaciones: resumen.consignaciones,
        proveedor: 'Todos los Proveedores'
    };

    const proveedorNombre = folio ? folio.proveedor : (grupo ? grupo.proveedor : 'Estado General');
    const foliosEstado = folio ? [folio] : (grupo ? grupo.folios : resumen.folios);
    const tituloDocumento = folio
        ? `Folio ${folio.folioOrigen || folio.folio || key}`
        : (grupo ? `Proveedor ${proveedorNombre}` : 'Estado general');
    const nombreArchivo = `estado_consignacion_${String(tituloDocumento).replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'general'}`;
    
    const filasHtml = foliosEstado.map(f => {
        const itemsHtml = f.consignaciones.map(c => {
            const cantTotal = Number(c.cantidadTotal || 0);
            const cantPendiente = Number(c.cantidadPendiente || 0);
            const cantVendida = Math.max(0, cantTotal - cantPendiente);

            // Rastrear la fecha prometida desde las ventas reportadas o desde la CxP ligada
            let infoVentaHtml = '';
            if (cantVendida > 0) {
                const ventas = _comprasAsegurarArray(c.ventasReportadas || []);
                if (ventas.length > 0) {
                    infoVentaHtml = ventas.map(v => {
                        let dateStr = v.fechaPagoPrometida || '';
                        if (dateStr && window.formatearFechaCortaMX) {
                            try { dateStr = window.formatearFechaCortaMX(new Date(dateStr + "T12:00:00")); } catch(e) {}
                        }
                        return `<br><span style="color: #b45309; font-size: 11px; font-weight: bold;">🗓️ Liquidación pactada: ${dateStr || v.fechaPagoPrometida}</span>`;
                    }).join('');
                } else {
                    const cxpAsoc = _comprasAsegurarArray(f.cuentasCxp || []).find(cx => cx.consignacionId === c.id || cx.compraId === c.compraId);
                    if (cxpAsoc && cxpAsoc.vencimiento) {
                        infoVentaHtml = `<br><span style="color: #b45309; font-size: 11px; font-weight: bold;">🗓️ Liquidación pactada: ${cxpAsoc.vencimiento}</span>`;
                    }
                }
            }

            let estadoStockHtml = cantVendida > 0 
                ? `<b style="color: #b45309; font-size: 12px;">✔️ ${cantVendida} Vendida(s)</b>${infoVentaHtml}<br><span style="color: #64748b; font-size: 11px;">${cantPendiente} en piso</span>`
                : `<b style="color:#0f766e;font-size:10px;">${cantPendiente} disponible(s)</b>`;
            estadoStockHtml = estadoStockHtml
                .replace(/font-size:\s*12px/g, 'font-size:10px')
                .replace(/font-size:\s*11px/g, 'font-size:9px')
                .replace(/Vendida\(s\)/g, 'vendida(s)')
                .replace(/LiquidaciÃ³n pactada/g, 'Liq. pactada');

            return `
            <tr style="border-bottom:1px solid #e2e8f0;font-size:10px;line-height:1.15;">
                <td style="padding:4px 5px; text-align: left; color: #334155;">
                    <b>${_comprasEscHTML(c.producto)}</b>
                    ${c.color ? `<br><span style="color:#64748b; font-size:9px;">Variante: ${_comprasEscHTML(c.color)}</span>` : ''}
                </td>
                <td style="padding:4px 5px; text-align: right; color: #334155;">${dinero(c.costoUnitario)}</td>
                <td style="padding:4px 5px; text-align: center; line-height: 1.15;">
                    ${estadoStockHtml}
                </td>
                <td style="padding:4px 5px; text-align: right; color: #334155; font-weight: bold;">${dinero(_consigImporte(c))}</td>
                <td style="padding:4px 5px; text-align: right; color: #0f172a; font-weight: bold;">${dinero(_consigImporte(c))}</td>
            </tr>`;
        }).join('');

        const anticiposHtml = f.anticipos.map(a => `
            <tr style="background-color:#f0fdf4;color:#15803d;font-size:10px;font-weight:bold;line-height:1.15;">
                <td colspan="3" style="padding:4px 5px; text-align: right;">
                    Anticipo registrado (${_comprasEscHTML(_comprasFechaVista(a.fecha || a.fechaStr, '-'))})
                </td>
                <td style="padding:4px 5px; text-align: right;">-${dinero(a.monto || 0)}</td>
                <td style="padding:4px 5px; text-align: right; color: #16a34a;">Abonado</td>
            </tr>
        `).join('');

        return `
            <tr style="background:#f8fafc;font-weight:bold;border-top:1px solid #cbd5e1;">
                <td colspan="5" style="padding: 10px; color: #1e293b; font-size: 12px;">📄 Identificador de Relación: ${_comprasEscHTML(f.folioOrigen)}</td>
            </tr>
            ${itemsHtml}
            ${anticiposHtml}
        `;
    }).join('');

    const baseKpi = base;
    const baseAnticipoEntregado = Number(baseKpi.anticiposTotal || 0);
    const baseAnticipoAplicado = Number(baseKpi.anticiposAplicados || 0);
    const baseAnticipoDisponible = Math.max(0, baseAnticipoEntregado - baseAnticipoAplicado);
    const docProductosResumen = Number(baseKpi.compraOriginal || 0);
    const docPagadoResumen = Number(baseKpi.pagadoPorVentas || 0);
    const docAnticiposResumen = Number(baseKpi.creditoAnticipos ?? Math.max(baseAnticipoEntregado, baseAnticipoAplicado));
    const docSaldoActualResumen = Math.max(0, docProductosResumen - docAnticiposResumen - docPagadoResumen);
    const cfgEmpresa = StorageService.get('configEmpresa', {}) || {};
    const empresaNombre = cfgEmpresa.nombre || 'Mueblería Mi Pueblito';

    const productosConsignacionHtml = foliosEstado.map(f => {
        const productoCards = _comprasAsegurarArray(f.consignaciones).map(c => {
            const cantTotal = Number(c.cantidadTotal || 0);
            const cantPendiente = Number(c.cantidadPendiente || 0);
            const cantVendida = Math.max(0, cantTotal - cantPendiente);
            const variante = _consigValorPublico(c.color);
            return `
                <div class="prod-card">
                    <div class="prod-title">${_comprasEscHTML(c.producto || 'Producto')}</div>
                    <div class="prod-meta">${_comprasEscHTML(variante)}</div>
                    <div class="prod-data">Costo <b>${dinero(c.costoUnitario)}</b></div>
                    <div class="prod-data">Stock <b>${cantPendiente}/${cantTotal} u</b></div>
                    <div class="prod-data">Vend. <b>${cantVendida} u</b></div>
                    <div class="prod-total">${dinero(_consigImporte(c))}</div>
                </div>`;
        }).join('');
        const subtotalProductos = _comprasAsegurarArray(f.consignaciones).reduce((s, c) => s + Number(_consigImporte(c) || 0), 0);
        const tituloBloque = scope === 'folio'
            ? ''
            : `<div class="folio-head"><div><strong>Folio ${_comprasEscHTML(f.folioOrigen || '-')}</strong><span>${_comprasEscHTML(f.proveedor || proveedorNombre)}</span></div></div>`;

        return `
            <section class="folio-card">
                ${tituloBloque}
                <div class="prod-grid">${productoCards || '<div class="empty-block">Sin productos en consignacion.</div>'}</div>
                <div class="block-subtotal product-subtotal">Subtotal productos: ${dinero(subtotalProductos)}</div>
            </section>`;
    }).join('');

    const movimientosConsignacionHtml = foliosEstado.map(f => {
        const anticiposMov = _comprasAsegurarArray(f.anticipos)
            .slice()
            .sort((a, b) => _consigFechaOrdenDoc(a.fecha || a.fechaStr) - _consigFechaOrdenDoc(b.fecha || b.fechaStr))
            .map(a => `
            <div class="mov-row mov-anticipo">
                <span>Anticipo</span>
                <b>${_comprasEscHTML(_comprasFechaVista(a.fecha || a.fechaStr, '-'))}</b>
                <em>Bolsa general</em>
                <strong>${dinero(a.monto || 0)}</strong>
            </div>`).join('');

        const ventasMov = _comprasAsegurarArray(f.cuentasCxp)
            .slice()
            .sort((a, b) => _consigFechaOrdenDoc(a.fecha || a.fechaISO || a.fechaIso) - _consigFechaOrdenDoc(b.fecha || b.fechaISO || b.fechaIso))
            .map(cxp => {
            const pagosRealesVenta = _consigPagosRealesCxp(cxp);
            const productoLimpio = _consigProductoCxp(cxp);
            const piezasCxp = _consigPiezasCxp(cxp);
            const pagosHtml = pagosRealesVenta.map(p => `
                <div class="mov-row mov-pago">
                    <span>${_comprasEscHTML(productoLimpio)}</span>
                    <b>${piezasCxp} pza(s)</b>
                    <em>${_comprasEscHTML(_comprasFechaVista(p.fecha || p.fechaIso || p.fechaAbonoIso, '-'))}</em>
                    <strong>${dinero(p.monto || 0)}</strong>
                </div>`).join('');
            return pagosHtml;
        }).join('');
        const subtotalAnticipos = _comprasAsegurarArray(f.anticipos).reduce((s, a) => s + Number(a.monto || 0), 0);
        const subtotalVentas = _comprasAsegurarArray(f.cuentasCxp).reduce((s, cxp) => s + _consigTotalPagosRealesCxp(cxp), 0);

        if (!anticiposMov && !ventasMov) return '';
        const tituloMovimientos = scope === 'folio'
            ? 'Movimientos'
            : `Movimientos de ${_comprasEscHTML(f.folioOrigen || '-')}`;
        return `
            <section class="mov-card">
                <div class="section-title">${tituloMovimientos}</div>
                <div class="mov-columns">
                    <div class="mov-box mov-box-anticipo">
                        <div class="mov-box-title">Anticipos</div>
                        ${anticiposMov || '<div class="empty-line">Sin anticipos.</div>'}
                        <div class="block-subtotal anticipos-subtotal">Subtotal anticipos: ${dinero(subtotalAnticipos)}</div>
                    </div>
                    <div class="mov-box mov-box-venta">
                        <div class="mov-box-title">Pagado por ventas</div>
                        ${ventasMov || '<div class="empty-line">Sin ventas.</div>'}
                        <div class="block-subtotal ventas-subtotal">Subtotal pagado: ${dinero(subtotalVentas)}</div>
                    </div>
                </div>
            </section>`;
    }).filter(Boolean).join('');

    const htmlDocumento = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>Estado de Cuenta Comercial</title>
        <style>
            @page { size: letter portrait; margin: 8mm; }
            body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; font-size: 12px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .tabla-estructura { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
            .tabla-estructura td { vertical-align: top; border: none; }
            .kpi-box { padding: 6px; border-radius: 5px; text-align: center; border: 1px solid #e2e8f0; line-height: 1.15; }
            .tabla-datos { width: 100%; border-collapse: collapse; margin-bottom: 12px; margin-top: 6px; table-layout: fixed; }
            .tabla-datos th { background: #f1f5f9; padding: 5px; border-bottom: 1px solid #cbd5e1; text-transform: uppercase; font-size: 9px; color: #475569; font-weight: bold; }
            .tabla-datos td { padding: 4px 5px; line-height: 1.15; }
            .linea-firma { border-top: 1px solid #94a3b8; margin-top: 22px; padding-top: 4px; font-weight: bold; color: #334155; font-size: 10.5px; }
            .folio-card { border: 1px solid #dbe4ee; border-radius: 6px; margin: 7px 0; page-break-inside: avoid; overflow: hidden; }
            .folio-head { display: grid; grid-template-columns: 1.2fr 2fr; gap: 6px; background: #f8fafc; padding: 6px 8px; border-bottom: 1px solid #dbe4ee; }
            .folio-head strong { display: block; font-size: 12.5px; color: #0f172a; }
            .folio-head span { display: block; color: #64748b; font-size: 11px; }
            .folio-totals { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
            .folio-totals span { background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; text-align: center; font-size: 10.5px; color: #64748b; }
            .folio-totals b { display: block; color: #0f172a; font-size: 12px; }
            .prod-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 7px; }
            .prod-card { border: 1px solid #dbeafe; border-radius: 7px; padding: 8px; background: #eff6ff; break-inside: avoid; display:grid; grid-template-columns:minmax(0,1.6fr) minmax(48px,.45fr) minmax(86px,.7fr) minmax(78px,.65fr) minmax(68px,.55fr) minmax(88px,.75fr); gap:7px; align-items:center; box-shadow:0 1px 2px rgba(15,23,42,.04); }
            .prod-title { font-weight: 900; color: #1d4ed8; font-size: 12.5px; line-height: 1.18; overflow-wrap:anywhere; }
            .prod-meta { color: #64748b; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .prod-data { color: #475569; font-size: 11px; white-space: nowrap; }
            .prod-data b { color:#0f172a; }
            .prod-total { text-align: right; color: #1d4ed8; font-weight: 900; font-size: 12.5px; white-space: nowrap; }
            .mov-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 7px; margin-top: 8px; page-break-inside: avoid; }
            .section-title { font-size: 12.5px; font-weight: 900; color: #334155; margin-bottom: 5px; text-transform: uppercase; }
            .mov-columns { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
            .mov-box { border:1px solid #e2e8f0; border-radius:6px; padding:6px; }
            .mov-box-anticipo { background:#f5f3ff; border-color:#ddd6fe; }
            .mov-box-venta { background:#f0fdf4; border-color:#bbf7d0; }
            .mov-box-title { font-size:13px; font-weight:900; margin-bottom:4px; }
            .mov-box-anticipo .mov-box-title { color:#6d28d9; }
            .mov-box-venta .mov-box-title { color:#15803d; }
            .mov-row { display: grid; grid-template-columns: 66px 92px 1fr 96px; gap: 6px; align-items: center; border-top: 1px solid rgba(148,163,184,.35); padding: 5px 0; font-size: 11.5px; }
            .mov-row:first-of-type { border-top: 0; }
            .mov-row span { font-weight: 800; }
            .mov-row em { color: #475569; font-style: normal; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .mov-row strong { text-align: right; }
            .mov-row small { grid-column: 3 / 5; color: #64748b; margin-top: -2px; }
            .mov-anticipo span, .mov-anticipo strong { color: #6d28d9; }
            .mov-venta span, .mov-venta strong { color: #15803d; }
            .mov-pago span, .mov-pago strong { color: #15803d; }
            .mov-pago-pendiente span, .mov-pago-pendiente strong { color: #b91c1c; }
            .empty-block { grid-column: 1 / -1; color: #94a3b8; text-align: center; padding: 8px; }
            .empty-line { color:#94a3b8; font-size:10.5px; padding:4px 0; }
            .block-subtotal { margin-top: 6px; padding-top: 6px; border-top: 2px solid #cbd5e1; text-align: right; font-weight: 900; font-size: 12px; }
            .product-subtotal { margin: 0 7px 7px; padding: 7px 8px; border-top-color: #1d4ed8; background: #eff6ff; color: #1d4ed8; border-radius: 5px; }
            .anticipos-subtotal { border-top-color: #c4b5fd; color: #6d28d9; }
            .ventas-subtotal { border-top-color: #86efac; color: #15803d; }
            .resumen-final { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; margin-top: 10px; background: #ffffff; page-break-inside: avoid; }
            .resumen-formula { display: grid; grid-template-columns: 1fr 18px 1fr 18px 1fr 18px 1fr; gap: 6px; align-items: stretch; }
            .resumen-formula div { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 5px; padding: 6px; }
            .resumen-formula small { display: block; font-size: 9px; color: #64748b; font-weight: 900; text-transform: uppercase; }
            .resumen-formula strong { display: block; font-size: 12px; text-align: right; color: #0f172a; }
            .resumen-formula span { display: flex; align-items: center; justify-content: center; font-weight: 900; color: #475569; }
            .resumen-formula .productos { background:#eff6ff; border-color:#dbeafe; }
            .resumen-formula .productos small, .resumen-formula .productos strong { color:#1d4ed8; }
            .resumen-formula .anticipos { background:#f5f3ff; border-color:#ddd6fe; }
            .resumen-formula .anticipos small, .resumen-formula .anticipos strong { color:#6d28d9; }
            .resumen-formula .pagado { background:#f0fdf4; border-color:#bbf7d0; }
            .resumen-formula .pagado small, .resumen-formula .pagado strong { color:#15803d; }
            .resumen-formula .saldo strong { color: #be123c; font-size: 12.5px; }
            tr { page-break-inside: avoid; }
        </style>
    </head>
    <body>

        <table class="tabla-estructura">
            <tr>
                <td style="width: 55%;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <img src="img/Logo.svg" alt="Logo" style="width: 58px; height: 58px; object-fit: contain;">
                        <div style="display:flex;flex-direction:column;justify-content:center;min-height:58px;">
                    <div style="font-size: 15px; font-weight: bold; color: #0f766e; letter-spacing: -0.5px;">${empresaNombre.toUpperCase()}</div>
                    <div style="font-size: 9.5px; color: #475569; margin-top: 1px; line-height: 1.15;">
                        Tlaxcala, México<br>
                        Contactos directos: 241 108 1657 | 749 106 0035
                        </div>
                    </div>
                    </div>
                </td>
                <td style="text-align: right; width: 45%;">
                    <div style="font-size: 12px; font-weight: bold; color: #1e293b; text-transform: uppercase; letter-spacing: 0.3px;">Estado de Cuenta Comercial</div>
                    <div style="font-size: 9.5px; color: #475569; margin-top: 2px; line-height: 1.2;">
                        <b>Proveedor:</b> ${_comprasEscHTML(proveedorNombre)}<br>
                        <b>Fecha Emisión:</b> ${_comprasFechaVista(new Date())}<br>
                        <b>Hora:</b> ${new Date().toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit'})}
                    </div>
                </td>
            </tr>
        </table>

        <table class="tabla-estructura" style="display:none;margin-bottom: 8px;">
            <tr>
                <td style="width: 25%; padding-right: 5px;">
                    <div class="kpi-box" style="background: #eff6ff; color: #1d4ed8;">
                        <span style="font-size: 8.5px; font-weight: bold; text-transform: uppercase;">Valor Recibido</span><br>
                        <strong style="font-size: 12px;">${dinero(baseKpi.compraOriginal)}</strong>
                    </div>
                </td>
                <td style="width: 25%; padding-left: 5px; padding-right: 5px;">
                    <div class="kpi-box" style="background: #fef3c7; color: #b45309;">
                        <span style="font-size: 8.5px; font-weight: bold; text-transform: uppercase;">Baja por Venta</span><br>
                        <strong style="font-size: 12px;">${dinero(baseKpi.vendidoReportado || 0)}</strong>
                    </div>
                </td>
                <td style="width: 25%; padding-left: 5px; padding-right: 5px;">
                    <div class="kpi-box" style="background: #f5f3ff; color: #6d28d9;">
                        <span style="font-size: 8.5px; font-weight: bold; text-transform: uppercase;">Anticipos Entregados</span><br>
                        <strong style="font-size: 12px;">${dinero(baseAnticipoEntregado)}</strong><br>
                        <span style="font-size: 9px;">Aplicado: ${dinero(baseAnticipoAplicado)}</span><br>
                        <span style="font-size: 9px;">Disponible: ${dinero(baseAnticipoDisponible)}</span>
                    </div>
                </td>
                <td style="width: 25%; padding-left: 5px;">
                    <div class="kpi-box" style="background: #fff1f2; color: #be123c;">
                        <span style="font-size: 8.5px; font-weight: bold; text-transform: uppercase;">Balance Pendiente</span><br>
                        <strong style="font-size: 12px;">${dinero(baseKpi.saldoNeto)}</strong>
                    </div>
                </td>
            </tr>
        </table>

        <div class="section-title">Productos en consignacion</div>
        ${productosConsignacionHtml || '<div class="empty-block">Sin productos en consignacion.</div>'}

        ${movimientosConsignacionHtml ? `<div class="section-title" style="margin-top:8px;">Movimientos</div>${movimientosConsignacionHtml}` : ''}

        <div class="resumen-final">
            <div class="section-title">Resumen</div>
            <div class="resumen-formula">
                <div class="productos"><small>Productos</small><strong>${dinero(docProductosResumen)}</strong></div>
                <span>-</span>
                <div class="anticipos"><small>Anticipos</small><strong>${dinero(docAnticiposResumen)}</strong></div>
                <span>-</span>
                <div class="pagado"><small>Pagado</small><strong>${dinero(docPagadoResumen)}</strong></div>
                <span>=</span>
                <div class="saldo"><small>Saldo actual</small><strong>${dinero(docSaldoActualResumen)}</strong></div>
            </div>
        </div>

        <table class="tabla-datos" style="display:none;">
            <thead>
                <tr>
                    <th style="text-align: left; width: 40%;">Descripción del Artículo</th>
                    <th style="text-align: right; width: 15%;">Precio Base</th>
                    <th style="text-align: center; width: 15%;">Consumo Stock</th>
                    <th style="text-align: right; width: 15%;">Subtotal</th>
                    <th style="text-align: right; width: 15%;">Monto Neto</th>
                </tr>
            </thead>
            <tbody>
                ${filasHtml}
            </tbody>
        </table>

        <table class="tabla-estructura" style="margin-top: 20px;">
            <tr>
                <td style="width: 45%; text-align: center;">
                    <div class="linea-firma">${empresaNombre}</div>
                    <div style="font-size: 9.5px; color: #64748b; margin-top: 1px;">Representante Comercial</div>
                </td>
                <td style="width: 10%;"></td>
                <td style="width: 45%; text-align: center;">
                    <div class="linea-firma">Firma de Conformidad</div>
                    <div style="font-size: 9.5px; color: #64748b; margin-top: 1px;">Acreedor / Proveedor</div>
                </td>
            </tr>
        </table>

    </body>
    </html>
    `;

    if (modo === 'ticket' && window.TicketService?.openThermal) {
        const bodyMatch = htmlDocumento.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        window.TicketService.openThermal({
            title: `Estado consignacion ${tituloDocumento}`,
            filename: nombreArchivo,
            body: bodyMatch ? bodyMatch[1] : htmlDocumento
        });
        return;
    }

    if (window.TicketService?.openDocument) {
        window.TicketService.openDocument(htmlDocumento, {
            title: `Estado consignacion ${tituloDocumento}`,
            filename: nombreArchivo,
            pageSize: 'letter',
            autoPrint: modo === 'pdf',
            autoImage: modo === 'imagen'
        });
        return;
    }
    const ventanaNueva = window.open('', '_blank');
    ventanaNueva.document.open();
    ventanaNueva.document.write(htmlDocumento);
    ventanaNueva.document.close();
};

window.abrirModalPagoConsignacionGrupo = function(consignacionId) {
    const consignacion = _getConsignacionesActivas().find(c => String(c.id || c.consignacionId || '') === String(consignacionId));
    const cxpsPendientes = _consigCxpsPendientesPorConsignacion(consignacionId);
    const saldo = _consigSaldoCxps(cxpsPendientes);
    if (!cxpsPendientes.length || saldo <= 0.01) return alert("No hay ventas pendientes de pago para este producto.");

    const piezas = _consigPiezasCxps(cxpsPendientes);
    const selectorCuentasHtml = window._buildSelectorCuentas('cuentaPagoConsig', false);
    const filasCxP = cxpsPendientes.map(cxp => `
        <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:8px;">${_comprasEscHTML(cxp.folioVentaAsociada || cxp.folioOrigen || cxp.id || '-')}</td>
            <td style="padding:8px;text-align:center;">${_consigPiezasCxp(cxp)}</td>
            <td style="padding:8px;text-align:right;font-weight:bold;">${dinero(Number(cxp.saldoPendiente ?? cxp.saldo ?? 0) || 0)}</td>
        </tr>`).join('');

    const modalHtml = `
    <div id="modalPagoConsig" style="position:fixed; inset:0; background:rgba(15,23,42,0.8); backdrop-filter:blur(3px); display:flex; justify-content:center; align-items:center; z-index:100000;">
        <div style="background:white; padding:30px; border-radius:15px; width:90%; max-width:620px; max-height:90vh; overflow-y:auto; font-family:Arial,sans-serif; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);">
            <h2 style="margin-top:0; color:#0f766e;">Pagar ventas de consignacion</h2>
            <div style="background:#f8f9fa; padding:15px; border-radius:8px; margin-bottom:16px;">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                    <div><small style="color:#718096;">Producto</small><br><strong>${_comprasEscHTML(consignacion?.producto || _consigProductoCxp(cxpsPendientes[0]) || '-')}</strong><br><small style="color:#64748b;">${cxpsPendientes.length} venta(s), ${piezas} pieza(s)</small></div>
                    <div><small style="color:#718096;">Total a pagar</small><br><strong style="color:#e74c3c; font-size:20px;">${dinero(saldo)}</strong></div>
                </div>
            </div>
            <div style="overflow:auto; margin-bottom:16px; border:1px solid #e2e8f0; border-radius:8px;">
                <table style="width:100%; border-collapse:collapse; font-size:13px;">
                    <thead style="background:#f8fafc;color:#475569;"><tr><th style="padding:8px;text-align:left;">Venta / reporte</th><th style="padding:8px;text-align:center;">Pzas</th><th style="padding:8px;text-align:right;">Saldo</th></tr></thead>
                    <tbody>${filasCxP}</tbody>
                </table>
            </div>
            <div style="margin-bottom:20px;">
                <label style="font-weight:bold; display:block; margin-bottom:8px;">Monto del pago ($):</label>
                <input type="number" id="montoPagoConsig" value="${saldo}" max="${saldo}" step="0.01" style="width:100%; padding:12px; font-size:16px; border:2px solid #3498db; border-radius:6px; box-sizing:border-box;">
            </div>
            <div style="margin-bottom:24px;">
                <label style="font-weight:bold; display:block; margin-bottom:8px;">De donde sale el dinero</label>
                ${selectorCuentasHtml}
            </div>
            <div style="display:flex; gap:10px;">
                <button onclick="this.disabled=true; this.textContent='Registrando...'; window.ejecutarPagoConsigGrupo('${String(consignacionId).replace(/'/g, "\\'")}', this)" style="flex:1; padding:12px; background:#27ae60; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:14px;">Registrar pago total</button>
                <button onclick="document.getElementById('modalPagoConsig').remove()" style="flex:1; padding:12px; background:#e74c3c; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:14px;">Cancelar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.ejecutarPagoConsigGrupo = function(consignacionId, btn = null) {
    const reactivarBoton = () => {
        if (!btn) return;
        btn.disabled = false;
        btn.textContent = 'Registrar pago total';
    };
    const monto = parseFloat(document.getElementById('montoPagoConsig')?.value);
    const selector = document.getElementById('cuentaPagoConsig');
    if (!selector || !selector.value) {
        reactivarBoton();
        return alert("Selecciona la cuenta de pago.");
    }

    let cxps = StorageService.get("cuentasPorPagar", []) || [];
    const pendientes = cxps
        .filter(cx => cx?.origenConsignacion && String(cx.consignacionId || '') === String(consignacionId) && !_consigCxpLiquidada(cx))
        .sort((a, b) => String(a.fechaIso || a.fecha || '').localeCompare(String(b.fechaIso || b.fecha || '')));
    const saldoTotal = _consigSaldoCxps(pendientes);
    if (!pendientes.length || saldoTotal <= 0.01) {
        document.getElementById('modalPagoConsig')?.remove();
        if (typeof abrirGestorConsignaciones === 'function') abrirGestorConsignaciones();
        return alert("Estas ventas ya fueron pagadas. No se duplico el egreso.");
    }
    if (isNaN(monto) || monto <= 0 || monto > saldoTotal + 0.01) {
        reactivarBoton();
        return alert("Monto invalido o excede el total pendiente.");
    }

    const cuentaId = selector.value;
    const cuentaNombreCompleto = selector.options[selector.selectedIndex]?.text || cuentaId;
    const cuentaNombreLimpio = cuentaNombreCompleto.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]\s?/g, '').trim();
    const fechaIso = window.localISO ? window.localISO(new Date()) : new Date().toISOString();
    const referenciaPago = `PCON-GRUPO-${consignacionId}`;
    const idOperacionPago = `PAGO-CONSIG-GRUPO-${consignacionId}-${Date.now()}`;

    const productoNombre = _consigProductoCxp(pendientes[0]) || 'Consignacion';
    const egresoOk = window._egresarCuenta({
        monto,
        cuentaId,
        etiqueta: cuentaNombreLimpio,
        concepto: `[Pago Consig] - ${productoNombre} (${pendientes.length} venta(s))`,
        referencia: referenciaPago,
        idOperacion: idOperacionPago,
        fecha: fechaIso
    });

    if (egresoOk === false) {
        reactivarBoton();
        return;
    }

    let restante = monto;
    let aplicadoTotal = 0;
    cxps = cxps.map(cxp => {
        if (restante <= 0.01 || !cxp?.origenConsignacion || String(cxp.consignacionId || '') !== String(consignacionId) || _consigCxpLiquidada(cxp)) return cxp;
        const saldoCxp = Number(cxp.saldoPendiente ?? cxp.saldo ?? 0) || 0;
        const aplicado = Math.min(restante, saldoCxp);
        if (aplicado <= 0.01) return cxp;
        restante -= aplicado;
        aplicadoTotal += aplicado;
        cxp.abonos = _comprasAsegurarArray(cxp.abonos || []);
        cxp.abonos.push({
            id: Date.now() + Math.random(),
            idOperacion: idOperacionPago,
            referencia: referenciaPago,
            fecha: fechaIso,
            monto: aplicado,
            cuenta: cuentaNombreLimpio,
            cuentaId,
            nota: "Liquidacion agrupada de consignacion"
        });
        cxp.saldoPendiente = Math.max(0, saldoCxp - aplicado);
        cxp.saldo = cxp.saldoPendiente;
        if (cxp.saldoPendiente <= 0.01) {
            cxp.estatus = "Liquidado";
            cxp.estado = "Liquidado";
            cxp.liquidado = true;
            cxp.pagado = true;
        }
        return cxp;
    });
    StorageService.set("cuentasPorPagar", cxps);

    let consigArr = StorageService.get("consignacionesActivas", []) || [];
    const cIdx = consigArr.findIndex(x => String(x.id || x.consignacionId || '') === String(consignacionId));
    if (cIdx !== -1) {
        consigArr[cIdx].montoTransferido = Math.max(0, Number(consigArr[cIdx].montoTransferido || 0) - aplicadoTotal);
        StorageService.set("consignacionesActivas", consigArr);
    }

    document.getElementById('modalPagoConsig')?.remove();
    alert(`Pago aplicado por ${dinero(aplicadoTotal)} desde ${cuentaNombreLimpio}.`);
    if (typeof renderCuentasPorPagar === 'function') renderCuentasPorPagar();
    if (typeof abrirGestorConsignaciones === 'function') abrirGestorConsignaciones();
    if (typeof renderCuentasBancarias === 'function') renderCuentasBancarias();
};

window.abrirModalPagoConsignacion = function(cxpId) {
    let cxps = StorageService.get("cuentasPorPagar", []) || [];
    const cxpItem = cxps.find(c => String(c.id) === String(cxpId));
    if (!cxpItem) return alert("No se localizó la liquidación.");

    const saldo = Number(cxpItem.saldoPendiente ?? cxpItem.saldo ?? 0);
    if (_consigCxpLiquidada(cxpItem)) return alert("Esta liquidación ya fue completada.");

    // Usamos el selector universal ya reparado
    const selectorCuentasHtml = window._buildSelectorCuentas('cuentaPagoConsig', false);

    const modalHtml = `
    <div id="modalPagoConsig" style="position:fixed; inset:0; background:rgba(15,23,42,0.8); backdrop-filter:blur(3px); display:flex; justify-content:center; align-items:center; z-index:100000;">
        <div style="background:white; padding:30px; border-radius:15px; width:90%; max-width:550px; max-height:90vh; overflow-y:auto; font-family:Arial,sans-serif; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);">
            <h2 style="margin-top:0; color:#0f766e;">💵 Pagar Venta de Consignación</h2>
            
            <div style="background:#f8f9fa; padding:15px; border-radius:8px; margin-bottom:20px;">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                    <div><small style="color:#718096;">Producto / Referencia</small><br><strong>${_comprasEscHTML(_consigProductoCxp(cxpItem))}</strong></div>
                    <div><small style="color:#718096;">Saldo Exigible</small><br><strong style="color:#e74c3c; font-size:20px;">${dinero(saldo)}</strong></div>
                </div>
            </div>
            
            <div style="margin-bottom:20px;">
                <label style="font-weight:bold; display:block; margin-bottom:8px;">Monto del pago ($):</label>
                <input type="number" id="montoPagoConsig" value="${saldo}" max="${saldo}" step="0.01" style="width:100%; padding:12px; font-size:16px; border:2px solid #3498db; border-radius:6px; box-sizing:border-box;">
            </div>
            
            <div style="margin-bottom:24px;">
                <label style="font-weight:bold; display:block; margin-bottom:8px;">💳 ¿De dónde sale el dinero?</label>
                ${selectorCuentasHtml}
            </div>
            
            <div style="display:flex; gap:10px;">
                <button onclick="this.disabled=true; this.textContent='Registrando...'; window.ejecutarPagoConsig('${cxpId}', this)" style="flex:1; padding:12px; background:#27ae60; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:14px;">✅ Registrar Pago</button>
                <button onclick="document.getElementById('modalPagoConsig').remove()" style="flex:1; padding:12px; background:#e74c3c; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:14px;">✕ Cancelar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.ejecutarPagoConsig = function(cxpId, btn = null) {
    const reactivarBoton = () => {
        if (!btn) return;
        btn.disabled = false;
        btn.textContent = 'Registrar Pago';
    };
    const monto = parseFloat(document.getElementById('montoPagoConsig')?.value);
    const selector = document.getElementById('cuentaPagoConsig');
    if (!selector || !selector.value) {
        reactivarBoton();
        return alert("Selecciona la cuenta de pago.");
    }
    const cuentaId = selector.value;
    const cuentaNombreCompleto = selector.options[selector.selectedIndex]?.text || cuentaId;
    
    // Limpiar emojis para guardar texto limpio
    const cuentaNombreLimpio = cuentaNombreCompleto.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]\s?/g, '').trim();

    let cxps = StorageService.get("cuentasPorPagar", []) || [];
    const idx = cxps.findIndex(c => String(c.id) === String(cxpId));
    if (idx === -1) {
        document.getElementById('modalPagoConsig')?.remove();
        return alert("Esta liquidacion ya no existe.");
    }
    const cxpItem = cxps[idx];
    const saldoPendiente = Number(cxpItem.saldoPendiente ?? cxpItem.saldo ?? 0);

    if (_consigCxpLiquidada(cxpItem)) {
        document.getElementById('modalPagoConsig')?.remove();
        if (typeof renderCuentasPorPagar === 'function') renderCuentasPorPagar();
        if (typeof abrirGestorConsignaciones === 'function') abrirGestorConsignaciones();
        return alert("Esta liquidacion ya fue pagada. No se duplico el egreso.");
    }

    if (isNaN(monto) || monto <= 0 || monto > saldoPendiente + 0.01) {
        reactivarBoton();
        return alert("Monto invalido o excede la deuda.");
    }

    const fechaIso = window.localISO ? window.localISO(new Date()) : new Date().toISOString();
    const referenciaPago = cxpItem.folioOrigen || `PCON-${cxpId}`;
    const idOperacionPago = `PAGO-CONSIG-${cxpId}-${Date.now()}`;

    if (isNaN(monto) || monto <= 0 || monto > saldoPendiente + 0.01) return alert("❌ Monto inválido o excede la deuda.");

    // INYECCIÓN NATIVA SEGURA
    const egresoOk = window._egresarCuenta({
        monto: monto,
        cuentaId: cuentaId, 
        etiqueta: cuentaNombreLimpio,
        concepto: `[Pago Consig] - ${_consigProductoCxp(cxpItem)}`,
        referencia: referenciaPago,
        idOperacion: idOperacionPago,
        fecha: fechaIso
    });

    if (egresoOk === false) {
        reactivarBoton();
        return;
    }

    // APLICAR ABONO EN LA CUENTA POR PAGAR
    if (!cxpItem.abonos) cxpItem.abonos = [];
    cxpItem.abonos.push({
        id: Date.now(),
        idOperacion: idOperacionPago,
        referencia: referenciaPago,
        fecha: fechaIso,
        monto: monto,
        cuenta: cuentaNombreLimpio,
        cuentaId: cuentaId,
        nota: "Liquidación ejecutada desde CxP"
    });

    cxpItem.saldoPendiente = Math.max(0, saldoPendiente - monto);
    cxpItem.saldo = cxpItem.saldoPendiente;

    if (cxpItem.saldoPendiente <= 0.01) {
        cxpItem.estatus = "Liquidado";
        cxpItem.estado = "Liquidado";
        cxpItem.liquidado = true;
        cxpItem.pagado = true;
    }
    StorageService.set("cuentasPorPagar", cxps);

    // DESCONTAR DEL HISTÓRICO DE CONSIGNACIONES ACTIVAS
    let consigArr = StorageService.get("consignacionesActivas", []) || [];
    const cIdx = consigArr.findIndex(x => String(x.id) === String(cxpItem.consignacionId));
    if (cIdx !== -1) {
        consigArr[cIdx].montoTransferido = Math.max(0, Number(consigArr[cIdx].montoTransferido || 0) - monto);
        StorageService.set("consignacionesActivas", consigArr);
    }

    document.getElementById('modalPagoConsig').remove();
    alert(`✅ Pago aplicado exitosamente por ${dinero(monto)} desde ${cuentaNombreLimpio}.`);

    // ACTUALIZAR PANTALLAS Y BANCOS
    if (typeof renderCuentasPorPagar === 'function') renderCuentasPorPagar();
    if (typeof abrirGestorConsignaciones === 'function') {
        const modalConsig = document.querySelector('[data-modal="gestor-consignaciones"]');
        if(modalConsig) abrirGestorConsignaciones();
    }
    if (typeof renderCuentasBancarias === 'function') renderCuentasBancarias();
};

window.renderRequisiciones = renderRequisiciones;
window.renderProveedores = renderProveedores;
window.guardarProveedor = guardarProveedor;
window.eliminarProveedor = eliminarProveedor;

window.prepararVistaCompras = prepararVistaCompras;
window.gestionarCamposPago = gestionarCamposPago;
window.registrarCompra = registrarCompra;

window.abrirNuevaOrdenCompra = abrirNuevaOrdenCompra;
window.agregarArticuloOC = agregarArticuloOC;
window._renderTablaArticulosOC = _renderTablaArticulosOC;
window.guardarOrdenCompra = guardarOrdenCompra;
window.imprimirOrdenCompra = imprimirOrdenCompra;
window.recibirOrdenCompra = recibirOrdenCompra;
window.confirmarRecepcionOC = confirmarRecepcionOC;
window.imprimirRecepcionCompra = imprimirRecepcionCompra;
window.renderListaOrdenesCompra = renderListaOrdenesCompra;
window.cancelarOrdenCompra = cancelarOrdenCompra;
window.editarOrdenCompra = editarOrdenCompra;
window.agregarArticuloEditOC = agregarArticuloEditOC;
window._renderEditTablaOC = _renderEditTablaOC;
window.guardarEdicionOC = guardarEdicionOC;
window.renderCuentasPorPagar = renderCuentasPorPagar;
window.registrarAbonoProveedor = registrarAbonoProveedor;
window.confirmarAbonoProveedor = confirmarAbonoProveedor;
window.verDetalleCompra = verDetalleCompra;
window.renderRecepciones = renderRecepciones;
window.procesarRecepcionFisica = procesarRecepcionFisica;
window.iniciarOrdenDesdeRequisiciones = iniciarOrdenDesdeRequisiciones;
window.iniciarCompraDirectaDesdeRequisiciones = iniciarCompraDirectaDesdeRequisiciones;
window.abrirModalCompraDirectaMulti = abrirModalCompraDirectaMulti;
window.agregarArticuloCompraDirecta = agregarArticuloCompraDirecta;
window.guardarCompraDirectaFinal = guardarCompraDirectaFinal;
window.abrirModalAbonoOC = abrirModalAbonoOC;
window.confirmarAbonoOC = confirmarAbonoOC;

console.log('✅ compras.js cargado correctamente');
