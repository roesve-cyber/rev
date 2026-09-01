// ===== DEVOLUCIONES Y GARANTÍAS =====

// 🔒 Gate de autorización — mismo patrón que _comprasRequireAdmin (compras.js)
// e _invRequireAdmin (inventario.js). Sin esto, cualquier usuario podía
// procesar una devolución que mueve stock, caja y saldo de CxC/pagarés.
function _devolucionesRequireAdmin(accion) {
    if (typeof window.esAdmin === 'function' && window.esAdmin()) return true;
    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'ACCESO_DENEGADO',
            modulo: 'Devoluciones',
            entidad: accion,
            detalle: `Intento sin permisos: ${accion}`,
            severidad: 'alerta'
        });
    }
    alert('Operación restringida. Solo administrador puede continuar.');
    return false;
}

// 🔎 Fuente de la venta a devolver.
// `ventasRegistradas` es la fuente activa de ventas autorizadas (ver
// ventas.js). `registroTickets` se dejó de escribir (su único punto de
// guardado, guardarTicketEnRegistro, está comentado en ventas.js), pero se
// conserva como respaldo por si hay folios históricos guardados ahí antes
// de esa migración. Sin este cambio, buscarVentaDevolucion() buscaba
// exclusivamente en una colección que ya no se llena.
function _devolucionesBuscarVenta(folioUpper) {
    // 🚀 Índice de folio→venta cacheado (ver _devolucionesIndiceVentas) en
    // vez de recorrer ambos arreglos completos en cada búsqueda exacta.
    return _devolucionesIndiceVentas().get(folioUpper) || null;
}

// 🚀 REPARACIÓN DE LENTITUD: antes, cada tecleo del buscador (una vez que se
// agregó búsqueda incremental) recorría `ventasRegistradas` + `registroTickets`
// desde cero con .find()/.filter() y además regeneraba `new Date(...)` y
// `.toLocaleDateString()` por cada fila, aunque el usuario no hubiera
// terminado de escribir el folio. Con miles de ventas acumuladas (el negocio
// lleva meses de operación diaria) eso se sentía "muy lento" al escribir.
//
// Ahora se construye UNA sola vez un índice (Map folioUpper -> venta) y una
// lista plana ya normalizada (folio, cliente, fecha, total en minúsculas
// para comparar), cacheados en memoria. El índice se invalida solo si
// cambió la referencia o el largo de los arreglos fuente (se regeneran con
// StorageService.set en cada venta/edición), así que en el caso normal
// (abrir el modal varias veces sin recargar la página) NO se reconstruye.
window._devolucionesCacheIndice = null; // { nuevasRef, legacyRef, nuevasLen, legacyLen, mapa, lista }

function _devolucionesConstruirLista() {
    const nuevas = StorageService.get('ventasRegistradas', []);
    const legacy = StorageService.get('registroTickets', []);
    const c = window._devolucionesCacheIndice;
    if (c && c.nuevasRef === nuevas && c.legacyRef === legacy &&
        c.nuevasLen === nuevas.length && c.legacyLen === legacy.length) {
        return c;
    }
    const mapa = new Map();
    const lista = [];
    const agregar = (v) => {
        const folio = (v.folio || '').toUpperCase();
        if (!folio || mapa.has(folio)) return; // nuevas tiene prioridad sobre legacy
        mapa.set(folio, v);
        const arts = (v.venta?.articulos || v.articulos || v.carrito || []);
        lista.push({
            venta: v,
            folio,
            _buscable: [
                folio,
                String(v.clienteNombre || v.nombre || ''),
                ...arts.map(a => String(a.nombre || ''))
            ].join(' | ').toLowerCase(),
            _fechaOrden: new Date(v.fecha || v.fechaVenta || 0).getTime() || 0
        });
    };
    nuevas.forEach(agregar);
    legacy.forEach(agregar);
    lista.sort((a, b) => b._fechaOrden - a._fechaOrden); // más recientes primero

    const nuevoCache = { nuevasRef: nuevas, legacyRef: legacy, nuevasLen: nuevas.length, legacyLen: legacy.length, mapa, lista };
    window._devolucionesCacheIndice = nuevoCache;
    return nuevoCache;
}

function _devolucionesIndiceVentas() {
    return _devolucionesConstruirLista().mapa;
}

function abrirModalDevolucion() {
    const html = `
    <div data-modal="devolucion" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:20px;">
      <div style="background:white;border-radius:12px;width:100%;max-width:640px;padding:28px;margin:auto;">
        <h2 style="margin:0 0 20px;color:#d97706;">↩️ Registrar Devolución</h2>
        <div style="display:grid;grid-template-columns:1fr auto;gap:12px;margin-bottom:16px;">
          <input type="text" id="devFolio" placeholder="Folio, cliente o producto..." autocomplete="off" style="padding:10px;border:1px solid #d1d5db;border-radius:6px;font-size:15px;">
          <button onclick="buscarVentaDevolucion()" style="padding:10px 18px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">🔍 Buscar</button>
        </div>
        <div id="devResultado"></div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    // 🔎 Búsqueda incremental con debounce: no hace falta ya escribir el
    // folio exacto ni presionar "Buscar" — con 2+ caracteres ya sugiere
    // coincidencias por folio, cliente o producto.
    const input = document.getElementById('devFolio');
    if (input) {
        let temporizador = null;
        input.addEventListener('input', function() {
            clearTimeout(temporizador);
            temporizador = setTimeout(buscarVentaDevolucion, 180);
        });
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') { clearTimeout(temporizador); buscarVentaDevolucion(); }
        });
    }
}

function _devolucionesEsc(s) {
    return String(s ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buscarVentaDevolucion() {
    const termino = (document.getElementById('devFolio')?.value || '').trim();
    const cont = document.getElementById('devResultado');
    if (!cont) return;
    if (!termino) { cont.innerHTML = ''; return; }

    const terminoUpper = termino.toUpperCase();
    const terminoLower = termino.toLowerCase();

    // 1. Coincidencia exacta de folio → ir directo al detalle (comportamiento
    // previo, preservado para no romper flujos ya conocidos por Roberto).
    const ventaExacta = _devolucionesBuscarVenta(terminoUpper);
    if (ventaExacta) {
        _devolucionesMostrarDetalle(ventaExacta, ventaExacta.folio || termino);
        return;
    }

    // 2. Si no hay match exacto, buscar por coincidencia parcial en folio,
    // nombre de cliente o nombre de artículo (esto es lo que antes obligaba
    // a Roberto a ir a otro módulo a buscar el folio exacto primero).
    const { lista } = _devolucionesConstruirLista();
    const MAX_RESULTADOS = 25;
    const coincidencias = [];
    for (let i = 0; i < lista.length && coincidencias.length < MAX_RESULTADOS; i++) {
        if (lista[i]._buscable.includes(terminoLower)) coincidencias.push(lista[i]);
    }

    if (coincidencias.length === 0) {
        cont.innerHTML = `<p style="color:#dc2626;text-align:center;padding:16px;">❌ No se encontró ninguna venta que coincida con "${_devolucionesEsc(termino)}"</p>`;
        return;
    }

    if (coincidencias.length === 1) {
        _devolucionesMostrarDetalle(coincidencias[0].venta, coincidencias[0].folio);
        return;
    }

    const filas = coincidencias.map(({ venta: v, folio }) => {
        const cliente = _devolucionesEsc(v.clienteNombre || v.nombre || 'Cliente');
        const fechaObj = new Date(v.fecha || v.fechaVenta || 0);
        const fechaStr = isNaN(fechaObj.getTime()) ? '' : fechaObj.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Mexico_City' });
        return `<button class="devResultadoItem" data-folio="${_devolucionesEsc(folio)}" style="display:flex;justify-content:space-between;align-items:center;width:100%;text-align:left;padding:10px 12px;background:white;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:6px;cursor:pointer;">
            <span><strong>${_devolucionesEsc(folio)}</strong> — ${cliente}</span>
            <small style="color:#6b7280;">${fechaStr} · ${dinero(v.total || v.totalVenta || 0)}</small>
        </button>`;
    }).join('');

    cont.innerHTML = `
      <div style="max-height:340px;overflow-y:auto;margin-bottom:8px;">
        <p style="color:#6b7280;font-size:12px;margin:0 0 8px;">${coincidencias.length} coincidencia(s) — selecciona una venta:</p>
        ${filas}
      </div>`;
    cont.querySelectorAll('.devResultadoItem').forEach(btn => {
        btn.addEventListener('click', function() {
            const folio = this.getAttribute('data-folio');
            const venta = _devolucionesBuscarVenta((folio || '').toUpperCase());
            if (venta) {
                const inputFolio = document.getElementById('devFolio');
                if (inputFolio) inputFolio.value = folio;
                _devolucionesMostrarDetalle(venta, folio);
            }
        });
    });
}

function _devolucionesMostrarDetalle(venta, folio) {
    const cont = document.getElementById('devResultado');
    if (!cont) return;
    const arts = (venta.venta?.articulos || venta.articulos || venta.carrito || []);
    const opcionesArts = arts.map((a, i) =>
        `<option value="${i}">${_devolucionesEsc(a.nombre)} (x${a.cantidad || 1})</option>`).join('');
    const clienteNombre = _devolucionesEsc(venta.clienteNombre || venta.nombre || 'Cliente');
    const folioSafe = _devolucionesEsc(venta.folio || folio || '');
    const fechaObj = new Date(venta.fecha || venta.fechaVenta);
    const fechaStr = isNaN(fechaObj.getTime()) ? '' : fechaObj.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Mexico_City'});
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
    <div style="margin-top:10px; margin-bottom:10px;">
      <label style="font-size:12px;font-weight:bold;color:#374151;">CUENTA DE REEMBOLSO (De dónde sale el dinero)</label>
      ${window._buildSelectorCuentas ? window._buildSelectorCuentas('devCuentaReembolso', false) : '<select id="devCuentaReembolso" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;"><option value="efectivo">💵 Efectivo Principal</option></select>'}
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
    const folioReal = venta.folio || folio;
    const btn = document.getElementById('btnProcesarDev');
    if (btn) btn.addEventListener('click', function() { procesarDevolucion(folioReal); });
}

// 🛡️ Punto 12: para una venta a crédito, el precio contado de una pieza NO
// es lo que el cliente realmente debía por ella — el plan de crédito
// (saldosPorMes/plan) carga capital + interés sobre el total financiado, y
// esa es la fuente que ya se usa para todo lo demás relacionado a crédito
// (pagarés, saldosPorMes, etc.). Usar precioContado para descontar
// cuentasPorCobrar.saldoActual subvalúa el ajuste en cualquier venta con
// interés, dejando un saldo distinto al que el cliente realmente debía por
// esa pieza. Aquí se escala el precio contado de la pieza a su proporción
// equivalente dentro del monto realmente financiado.
function _devolucionMontoAjusteCredito(venta, montoContadoPieza) {
    const totalMercanciaVenta = Number(venta?.totalMercancia) || 0;
    const montoFinanciadoVenta = Number(venta?.plan?.total) || Number(venta?.saldoAFinanciar) || 0;

    if (totalMercanciaVenta <= 0 || montoFinanciadoVenta <= 0) {
        // Sin datos suficientes para prorratear (venta antigua sin estos
        // campos, por ejemplo): se cae al precio contado como antes, en vez
        // de dividir entre 0 o descontar 0.
        return montoContadoPieza;
    }

    const proporcion = montoContadoPieza / totalMercanciaVenta;
    return Number((proporcion * montoFinanciadoVenta).toFixed(2));
}

function procesarDevolucion(folio) {
    // 🔒 Punto 5: gate de autorización — antes cualquier usuario podía mover
    // stock, caja y saldo de CxC/pagarés desde aquí sin checkpoint de rol.
    if (!_devolucionesRequireAdmin('Procesar devolución')) return;

    const idxArt = parseInt(document.getElementById('devArticulo')?.value) || 0;
    const cantidad = parseInt(document.getElementById('devCantidad')?.value) || 1;
    const motivo = document.getElementById('devMotivo')?.value || 'Otro';
    const notas = document.getElementById('devNotas')?.value.trim();
    const reingresarStock = document.getElementById('devReingresarStock')?.checked ?? true;
    
    // 🛡️ REPARACIÓN: Leer la cuenta seleccionada en el modal
    const cuentaReembolsoId = document.getElementById('devCuentaReembolso')?.value || 'efectivo';
    const folioUpper = folio.toUpperCase();
    const venta = _devolucionesBuscarVenta(folioUpper);
    if (!venta) return;

    // Detectar si la venta fue a crédito
    const fueCredito = venta.metodo === "credito" || venta.metodoDePago === "credito" || (venta.plan && venta.plan.tipo === "credito");

    const arts = venta.venta?.articulos || venta.articulos || venta.carrito || [];
    const art = arts[idxArt];
    if (!art) return;

    if (cantidad <= 0) {
        alert('La cantidad a devolver debe ser mayor a 0.');
        return;
    }

    // 🔢 Punto 4: no dejar devolver más de lo vendido, ni acumular
    // devoluciones repetidas del mismo folio+producto sin tope.
    const productoIdArt = art.id || art.productoId;
    const yaDevuelta = StorageService.get('historialDevoluciones', [])
        .filter(d => String(d.folioVenta || '').toUpperCase() === folioUpper && String(d.productoId) === String(productoIdArt))
        .reduce((sum, d) => sum + (Number(d.cantidad) || 0), 0);
    const vendida = Number(art.cantidad || 0);
    const disponibleParaDevolver = Math.max(0, vendida - yaDevuelta);
    if (cantidad > disponibleParaDevolver) {
        alert(`No se puede devolver ${cantidad} pieza(s) de "${art.nombre}".\n\nVendidas en este folio: ${vendida}\nYa devueltas anteriormente: ${yaDevuelta}\nDisponibles para devolver: ${disponibleParaDevolver}`);
        return;
    }

    // --- NUEVO: RESUMEN Y CONFIRMACIÓN ---
    const selectCta = document.getElementById('devCuentaReembolso');
    const cuentaNombre = selectCta ? selectCta.options[selectCta.selectedIndex].text : 'Efectivo';
    const montoDev = (art.precioContado || art.precio || 0) * cantidad;
    const formatoDinero = (val) => '$' + Number(val).toLocaleString('en-US', {minimumFractionDigits: 2});
    
    const msjConf = `⚠️ RESUMEN DE OPERACIÓN - ¿PROCESAR DEVOLUCIÓN?\n\nFolio afectado: ${folio}\nProducto: ${art.nombre}\nPiezas a devolver: ${cantidad}\n\nMonto a reembolsar al cliente: ${formatoDinero(montoDev)}\nEl dinero saldrá de: ${cuentaNombre}\n\n¿Deseas continuar?`;
    if (!confirm(msjConf)) return;
    // --- FIN DE CONFIRMACIÓN ---

    const devolucion = {
        id: Date.now(),
        folio: window.generarFolioSistema ? window.generarFolioSistema('DEV') : 'DEV-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7).toUpperCase(),
        folioVenta: folio,
        clienteNombre: venta.clienteNombre || venta.nombre || 'Cliente',
        clienteId: venta.clienteId || null,
        productoId: productoIdArt,
        productoNombre: art.nombre,
        colorElegido: art.colorElegido || 'General',
        ubicacionElegida: art.ubicacionElegida || 'General',
        cantidad,
        motivo,
        notas,
        reingresarStock,
        fecha: Date.now(),
        monto: (art.precioContado || art.precio || 0) * cantidad
    };
    const devoluciones = StorageService.get('historialDevoluciones', []);
    devoluciones.push(devolucion);
    StorageService.set('historialDevoluciones', devoluciones);

    if (reingresarStock) {
        const prods = StorageService.get('productos', []);
        const colorOriginal = art.colorElegido || 'General';
        // 🏷️ Punto 6: usar la ubicación real de donde salió la pieza, no una
        // 'General' fija — si no se registró ubicación específica en la
        // venta, 'General' sigue siendo el valor correcto por default.
        const ubicacionOriginal = art.ubicacionElegida || 'General';
        // Fuente única: suma stock general + variante (color/ubicación).
        const resultado = window.ajustarStockVariante
            ? window.ajustarStockVariante(prods, productoIdArt, cantidad, {
                  color: colorOriginal,
                  ubicacion: ubicacionOriginal,
                  modo: 'entrada',
                  concepto: `Devolución — ${motivo}`
              })
            : { ok: false, motivo: 'ajustarStockVariante_no_disponible' };

        if (resultado.ok) {
            StorageService.set('productos', prods);
            window.productos = prods;

            // Mismo kardex que usa el resto del sistema (registrarMovimiento):
            // así el movimiento trae costoUnitario/costo/precioCompra/valor,
            // en vez de quedar con huecos como antes.
            registrarMovimiento(productoIdArt, `Devolución ${devolucion.folio} — ${motivo}`, cantidad, "entrada", {
                folioVenta: folio
            });
        }
    }

// ===== Ajuste de saldo y registro de reembolso en caja =====
    if (devolucion.monto > 0) {
        // 🛡️ REPARACIÓN: usar el mismo camino canónico que la cancelación de
        // venta (_egresarCuenta) en vez de escribir el movimiento a mano. El
        // push directo dejaba el egreso en movimientosCaja pero nunca tocaba
        // cuentasEfectivo/cuentas-bancarias, descuadrando el saldo cacheado de
        // la cuenta de reembolso hasta un recálculo manual.
        let _egresoOkDevolucion = true;
        if (typeof window._egresarCuenta === 'function') {
            _egresoOkDevolucion = window._egresarCuenta({
                monto: devolucion.monto,
                cuentaId: cuentaReembolsoId,
                etiqueta: cuentaNombre,
                concepto: `Reembolso devolución (${devolucion.folio}) — ${devolucion.productoNombre}`,
                referencia: devolucion.folioVenta,
                fecha: window.localISO(new Date()),
                idOperacion: devolucion.folio
            }) !== false;
        } else {
            const movs = StorageService.get('movimientosCaja', []);
            movs.push({
                id: Date.now() + 1,
                folio: devolucion.folio,
                tipo: "egreso",
                concepto: `Reembolso devolución (${devolucion.folio}) — ${devolucion.productoNombre}`,
                monto: devolucion.monto,
                fecha: window.localISO(new Date()),
                cuenta: cuentaReembolsoId,
                referencia: devolucion.folioVenta
            });
            StorageService.set('movimientosCaja', movs);
        }
        if (!_egresoOkDevolucion) {
            alert('⚠️ La devolución se registró, pero el reembolso NO se pudo aplicar a la cuenta seleccionada (revisa que la cuenta exista). Verifica manualmente en Mis Cuentas.');
        }

        // Si fue crédito, también reducir el saldo pendiente en CxC y cancelar Pagarés
        if (fueCredito) {
            const cuentas = StorageService.get('cuentasPorCobrar', []);
            const idxCuenta = cuentas.findIndex(c => (c.folioVenta || c.folio) === folio);
            if (idxCuenta !== -1) {
                // 🛡️ Punto 12: el ajuste de saldo/pagarés de una venta a
                // crédito debe usar el monto proporcional dentro del plan
                // financiado (capital + interés), no el precio contado plano
                // de la pieza — ver _devolucionMontoAjusteCredito arriba.
                const montoAjusteCxC = _devolucionMontoAjusteCredito(venta, devolucion.monto);

                cuentas[idxCuenta].saldoActual = Math.max(0, (cuentas[idxCuenta].saldoActual || 0) - montoAjusteCxC);
                StorageService.set('cuentasPorCobrar', cuentas);
                
                // --- CORRECCIÓN: Cancelar Pagarés (de los últimos a los primeros) ---
                let pagares = StorageService.get('pagaresSistema', []);
                let pagaresFolio = pagares.filter(p => p.folio === folio && (p.estado === 'Pendiente' || p.estado === 'Parcial'))
                                          .sort((a,b) => new Date(b.fechaVencimiento) - new Date(a.fechaVencimiento)); 
                
                let montoADescontar = montoAjusteCxC;
                pagaresFolio.forEach(p => {
                    if (montoADescontar <= 0) return;
                    const saldoPagare = (p.estado === 'Parcial') ? (p.monto - (p.montoAbonado || 0)) : p.monto;
                    
                    if (montoADescontar >= (saldoPagare - 0.01)) {
                        p.estado = 'Cancelado';
                        p.nota = 'Cancelado por devolución';
                        montoADescontar -= saldoPagare;
                    } else {
                        p.estado = 'Parcial';
                        p.montoAbonado = (p.montoAbonado || 0) + montoADescontar;
                        p.nota = 'Rebajado por devolución';
                        montoADescontar = 0;
                    }
                    
                    const pIdx = pagares.findIndex(x => x.id === p.id);
                    if (pIdx !== -1) pagares[pIdx] = p;
                });
                StorageService.set('pagaresSistema', pagares);
            }
        }
    }
    // ===== FIN ajuste =====

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
      <td style="padding:10px;text-align:center;">${(window.parseFechaMX ? window.parseFechaMX(d.fecha) : new Date(d.fecha)).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Mexico_City'})}</td>
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
    const venta = _devolucionesBuscarVenta((folio || '').toUpperCase());
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

window.abrirModalDevolucion = abrirModalDevolucion;
window.buscarVentaDevolucion = buscarVentaDevolucion;
window.procesarDevolucion = procesarDevolucion;
window.renderHistorialDevoluciones = renderHistorialDevoluciones;
window.registrarGarantia = registrarGarantia;
window.renderControlGarantias = renderControlGarantias;
window.marcarGarantiaReclamacion = marcarGarantiaReclamacion;
