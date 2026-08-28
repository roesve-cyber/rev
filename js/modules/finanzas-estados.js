// ===== ESTADOS FINANCIEROS (Estado de Resultados + Balance General) =====
// Nuevo módulo. Reglas de origen de datos, para que quede documentado por qué
// cada cifra sale de donde sale:
//
// - Ingresos por ventas: ventasRegistradas (fechaVenta/fecha), menos
//   historialDevoluciones dentro del mismo rango.
// - Costo de ventas: movimientosInventario (kardex), tipo 'salida' con
//   folioVenta (venta real, no ajustes/mermas) menos tipo 'entrada' con
//   folioVenta (reingresos por cancelación/devolución) dentro del rango.
//   Si un folio no tiene salida real en el kardex, se estima con el costo
//   actual del producto; si el producto tampoco tiene costo capturado, se
//   asume un margen del 25% sobre el precio de venta como último recurso
//   (ver productosSinCostoDetectados, siempre marcado explícito, nunca
//   mezclado en silencio).
// - Comisiones a vendedores: comisionesRegistradas (vendedores.js), por la
//   fecha en que se generó la comisión (misma venta que genera el ingreso),
//   excluyendo comisiones de ventas canceladas. Antes NO se leía en ningún
//   lado de este archivo — el pago (_egresarCuenta) solo mueve caja, nunca
//   gastosOperativos, así que las comisiones eran invisibles en este reporte
//   aunque sí bajaban el efectivo real.
// - Mermas y ajustes de inventario: movimientosInventario con
//   origen:'ajusteInventario' (botón "⚖️ Ajuste" en inventario.js), por
//   fecha. Valuadas al costo actual del producto (el movimiento no guarda
//   costo histórico). Antes bajaban el stock/Inventario del Balance en
//   silencio sin aparecer nunca como gasto aquí.
// - Gastos operativos: gastosOperativos, por fecha.
// - Préstamos incobrables: prestamosOtorgados con estado 'Incobrable',
//   por fecha de marcado.
// - Capital (aportaciones/retiros del dueño): NUEVO — capitalMovimientos,
//   ligado a caja real vía _ingresarCuenta/_egresarCuenta (referencia
//   CAPITAL-{id}), igual que el resto del sistema.
// - Balance General: el efectivo/bancos SÍ se reconstruye histórico a la
//   fecha de corte elegida (recorriendo movimientosCaja hacia atrás desde el
//   saldo actual). CxC, CxP, préstamos por cobrar e inventario se muestran
//   con su saldo/pendiente ACTUAL (hoy) — reconstruir esos históricos exigiría
//   rehacer todo su historial de abonos/kardex, que no está indexado por
//   fecha de forma barata. Si el corte es distinto de hoy, se avisa en el
//   propio reporte.

function _efDinero(v) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(v) || 0);
}

function _efEsc(v) {
    return String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
}

// % de una cifra sobre las ventas netas (análisis vertical / common-size).
// Estándar en el Estado de Resultados: cada renglón se lee como "% de ventas".
function _efPct(valor, base) {
    if (!base) return '—';
    return (Number(valor) / base * 100).toFixed(1) + '%';
}

// Convierte cualquier formato de fecha usado en el sistema (epoch ms, ISO,
// 'YYYY-MM-DD') a un objeto Date válido, o null si no se puede.
function _efParseFecha(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') {
        const d = new Date(v);
        return isNaN(d.getTime()) ? null : d;
    }
    const s = String(v).trim();
    if (/^\d+$/.test(s)) {
        const d = new Date(Number(s));
        return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(s.includes('T') ? s : s + 'T12:00:00');
    return isNaN(d.getTime()) ? null : d;
}

function _efEnRango(fechaValor, desdeDate, hastaDate) {
    const d = _efParseFecha(fechaValor);
    if (!d) return false;
    return d >= desdeDate && d <= hastaDate;
}

function _efHoyInput() {
    return typeof window.obtenerHoyInputMX === 'function' ? window.obtenerHoyInputMX() : new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------
// CAPITAL (aportaciones y retiros del dueño)
// ---------------------------------------------------------------

function abrirModalCapital(tipo) {
    const esAportacion = tipo === 'aportacion';
    const html = `
    <div data-modal="capital-mov" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9000;display:flex;justify-content:center;align-items:center;padding:16px;">
        <div style="background:white;padding:28px;border-radius:12px;width:100%;max-width:420px;">
            <h2 style="margin-top:0;color:${esAportacion ? '#059669' : '#dc2626'};">${esAportacion ? '➕ Aportación de capital' : '➖ Retiro de capital'}</h2>
            <p style="color:#6b7280;font-size:13px;margin-top:-8px;">${esAportacion ? 'Dinero que el dueño mete al negocio.' : 'Dinero que el dueño saca del negocio (no es un gasto operativo).'}</p>
            <input type="hidden" id="capitalTipo" value="${tipo}">
            <div style="margin-bottom:12px;">
                <label style="font-weight:bold;font-size:13px;color:#374151;display:block;margin-bottom:5px;">MONTO ($)</label>
                <input type="number" id="capitalMonto" min="0.01" step="0.01" placeholder="0.00" style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:6px;box-sizing:border-box;">
            </div>
            <div style="margin-bottom:12px;">
                <label style="font-weight:bold;font-size:13px;color:#374151;display:block;margin-bottom:5px;">FECHA</label>
                <input type="date" id="capitalFecha" value="${_efHoyInput()}" style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:6px;box-sizing:border-box;">
            </div>
            <div style="margin-bottom:12px;">
                <label style="font-weight:bold;font-size:13px;color:#374151;display:block;margin-bottom:5px;">${esAportacion ? '¿A QUÉ CUENTA ENTRA?' : '¿DE QUÉ CUENTA SALE?'}</label>
                ${window._buildSelectorCuentas('capitalCuenta', false)}
            </div>
            <div style="margin-bottom:16px;">
                <label style="font-weight:bold;font-size:13px;color:#374151;display:block;margin-bottom:5px;">NOTA (opcional)</label>
                <input type="text" id="capitalNota" placeholder="Motivo" style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:6px;box-sizing:border-box;">
            </div>
            <div style="display:flex;gap:10px;">
                <button onclick="guardarMovimientoCapital()" style="flex:1;padding:12px;background:${esAportacion ? '#059669' : '#dc2626'};color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">💾 Guardar</button>
                <button onclick="document.querySelector('[data-modal=&quot;capital-mov&quot;]').remove()" style="flex:1;padding:12px;background:#e5e7eb;color:#4b5563;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">✕ Cancelar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

function guardarMovimientoCapital() {
    const tipo = document.getElementById('capitalTipo')?.value;
    const monto = Number(document.getElementById('capitalMonto')?.value);
    const fecha = document.getElementById('capitalFecha')?.value || _efHoyInput();
    const nota = document.getElementById('capitalNota')?.value.trim() || '';
    const sel = document.getElementById('capitalCuenta');

    if (!Number.isFinite(monto) || monto <= 0) return alert('⚠️ Ingresa un monto válido.');
    if (!sel) return alert('No se pudo leer la cuenta seleccionada.');
    const cuentaId = sel.value;
    const etiqueta = sel.options[sel.selectedIndex]?.text || cuentaId;
    const esAportacion = tipo === 'aportacion';

    if (!confirm(`⚠️ ${esAportacion ? 'APORTACIÓN' : 'RETIRO'} DE CAPITAL\n\nMonto: ${_efDinero(monto)}\n${esAportacion ? 'Entra a' : 'Sale de'}: ${etiqueta}\n\n¿Confirmar?`)) return;

    if (typeof window._ingresarCuenta !== 'function' || typeof window._egresarCuenta !== 'function') {
        alert('No se pudo registrar el movimiento: el módulo de caja no está disponible. Nada se guardó.');
        return;
    }

    const id = Date.now();
    const fn = esAportacion ? window._ingresarCuenta : window._egresarCuenta;
    const ok = fn({
        monto, cuentaId, etiqueta,
        concepto: `${esAportacion ? 'Aportación' : 'Retiro'} de capital${nota ? ' — ' + nota : ''}`,
        referencia: `CAPITAL-${id}`,
        idOperacion: `capital-${id}`,
        fecha: fecha ? `${fecha}T12:00:00` : undefined
    });
    if (!ok) {
        alert(`No se pudo registrar el movimiento en "${etiqueta}". Nada se guardó.`);
        return;
    }

    const movs = StorageService.get('capitalMovimientos', []);
    movs.push({
        id, tipo, monto, fecha,
        fechaIso: window.localISO ? window.localISO(new Date(fecha + 'T12:00:00')) : new Date(fecha).toISOString(),
        cuentaId, etiquetaCuenta: etiqueta, nota
    });
    StorageService.set('capitalMovimientos', movs);

    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: esAportacion ? 'CAPITAL_APORTACION' : 'CAPITAL_RETIRO',
            modulo: 'Finanzas', entidad: 'capitalMovimientos', entidadId: id,
            detalle: `${esAportacion ? 'Aportación' : 'Retiro'} de capital - ${_efDinero(monto)} (${etiqueta})`,
            monto, severidad: 'riesgo', datos: { cuentaId, etiqueta, nota }
        });
    }

    document.querySelector('[data-modal="capital-mov"]')?.remove();
    renderEstadosFinancieros();
}

function _efTotalesCapital() {
    const movs = StorageService.get('capitalMovimientos', []);
    const aportado = movs.filter(m => m.tipo === 'aportacion').reduce((s, m) => s + (Number(m.monto) || 0), 0);
    const retirado = movs.filter(m => m.tipo === 'retiro').reduce((s, m) => s + (Number(m.monto) || 0), 0);
    return { aportado, retirado, neto: aportado - retirado, movs };
}

// ---------------------------------------------------------------
// ESTADO DE RESULTADOS
// ---------------------------------------------------------------

// Categorías de gasto que se tratan como GASTO FINANCIERO (RIF) en vez de
// gasto operativo — según NIF B-3, intereses/comisiones bancarias no son
// parte de la operación del negocio. Detecta por palabras clave en la
// categoría del gasto (el usuario no tiene que hacer nada especial, solo
// nombrar la categoría de forma reconocible, p.ej. "Intereses bancarios").
const _EF_PALABRAS_GASTO_FINANCIERO = ['interes', 'interés', 'financiero', 'financiera', 'comision bancaria', 'comisión bancaria'];
function _efEsGastoFinanciero(categoria) {
    const c = String(categoria || '').toLowerCase();
    return _EF_PALABRAS_GASTO_FINANCIERO.some(p => c.includes(p));
}

function _efCalcularEstadoResultados(desdeStr, hastaStr) {
    const desde = _efParseFecha(desdeStr + 'T00:00:00');
    const hasta = _efParseFecha(hastaStr + 'T23:59:59');

    // 🛡️ NIF B-3 / NIF C-19 / NIF C-20: el interés que paga un cliente por
    // financiar su compra a crédito NO es venta de mercancía, es ingreso
    // financiero (RIF) — no debe mezclarse con "Ingresos por ventas" ni con
    // el Costo de Ventas (que se compara contra el precio de mercancía).
    // Reutilizamos el motor de interés ya existente en el sistema
    // (_rrcTotalesVenta/_rrcInteres de reportes-rentabilidad-cartera.js) en
    // vez de recalcular la resta nosotros mismos, para no volver a duplicar
    // esa fórmula por cuarta vez.
    // 🛡️ Ventas canceladas (Centro de Cancelaciones en ventas.js) se marcan
    // con estado/estatus 'Cancelada' pero NO generan un registro en
    // historialDevoluciones (van a historialCancelaciones, un array aparte).
    // Si no se excluyen aquí, su ingreso completo se queda contado como
    // venta real sin nada que lo reste — el costo de ventas sí se reversa
    // bien vía kardex (ver reingresosVenta abajo), pero el ingreso no.
    const ventas = StorageService.get('ventasRegistradas', []);
    const ventasEnRango = ventas.filter(v =>
        _efEnRango(v.fechaVenta || v.fecha, desde, hasta) &&
        v.estado !== 'Cancelada' && v.estatus !== 'Cancelada'
    );
    let ingresosVentas = 0;
    let ingresosFinancieros = 0;
    ventasEnRango.forEach(v => {
        if (typeof window._rrcTotalesVenta === 'function' && typeof window._rrcInteres === 'function') {
            const { totalMercancia, totalDocumento } = window._rrcTotalesVenta(v);
            ingresosVentas += totalMercancia;
            ingresosFinancieros += window._rrcInteres(totalDocumento, totalMercancia);
        } else {
            // Sin el motor compartido disponible: no hay forma segura de
            // separar interés de mercancía, se cuenta todo como venta.
            ingresosVentas += Number(v.totalMercancia || v.total) || 0;
        }
    });

    const devoluciones = StorageService.get('historialDevoluciones', []);
    const totalDevoluciones = devoluciones
        .filter(d => _efEnRango(d.fecha, desde, hasta))
        .reduce((s, d) => s + (Number(d.monto) || 0), 0);

    const kardex = StorageService.get('movimientosInventario', []);
    const salidasVentaMovs = kardex.filter(m => m.tipo === 'salida' && m.folioVenta && _efEnRango(m.fecha, desde, hasta));
    const reingresosVentaMovs = kardex.filter(m => m.tipo === 'entrada' && m.folioVenta && _efEnRango(m.fecha, desde, hasta));
    const salidasVenta = salidasVentaMovs.reduce((s, m) => s + (Number(m.valor) || 0), 0);
    const reingresosVenta = reingresosVentaMovs.reduce((s, m) => s + (Number(m.valor) || 0), 0);
    const costoVentasReal = Math.max(0, salidasVenta - reingresosVenta);

    // 🛡️ REPARACIÓN: si el kardex no tiene NINGUNA salida para el folio de una
    // venta del periodo (p.ej. porque se perdió historial, como pasó con el
    // vaciado accidental de movimientosInventario), el costo de esa venta se
    // estimaba en $0 — inflando la Utilidad Bruta sin ningún aviso. Para esos
    // folios (solo esos: si el kardex ya trae AL MENOS una salida real para el
    // folio, se confía en el kardex y no se toca nada, para no duplicar costo)
    // se estima el costo con el costo ACTUAL del producto × cantidad vendida.
    // Es una aproximación (el costo pudo cambiar desde la venta), así que se
    // reporta aparte y el reporte lo marca explícitamente en vez de mezclarlo
    // en silencio con el costo real del kardex.
    const foliosConKardexSalida = new Set(salidasVentaMovs.map(m => String(m.folioVenta)));
    const productosMap = new Map(StorageService.get('productos', []).map(p => [String(p.id), p]));

    // 🛡️ NUEVO: mermas/ajustes de inventario (botón "⚖️ Ajuste" en
    // inventario.js:2992-3057, ejecutarAjusteInv) escriben en
    // movimientosInventario con origen:'ajusteInventario' y
    // tipo:'Egreso (Merma/Ajuste)' o 'Ingreso (Sobrante/Ajuste)' — SIN
    // folioVenta, así que ya quedaban correctamente fuera de "Costo de
    // ventas" (no son una venta). Pero el registro tampoco guarda ningún
    // valor monetario (solo cantidad), y hasta ahora NINGÚN gasto operativo
    // los leía: la merma bajaba el stock (y por lo tanto el Inventario del
    // Balance, en silencio) pero nunca aparecía como pérdida en el Estado de
    // Resultados — mismo patrón que las comisiones. Se valúan aquí al costo
    // ACTUAL del producto (el movimiento no guarda el costo histórico de esa
    // fecha) y, si el producto no tiene costo capturado, NO se usa el
    // fallback de margen 25% (no hay precio de venta del que partir en una
    // merma) — simplemente se marca en productosMermaSinCosto para que se
    // vea, en vez de inventar un número.
    // 🛡️ REPARACIÓN: además del "⚖️ Ajuste" (ejecutarAjusteInv,
    // origen:'ajusteInventario'), la Toma de Inventario física
    // (toma-inventario.js) también da de baja/alta stock por diferencias de
    // conteo, y ese movimiento NO trae origen:'ajusteInventario' (usa
    // motivo:"Ajuste por toma fisica..." y tomaInventarioId) — con el filtro
    // anterior por origen, esas mermas por conteo físico quedaban fuera del
    // aviso sin que nadie se diera cuenta. En vez de listar cada origen a
    // mano (y volver a quedarme corto si aparece un cuarto mecanismo), se usa
    // el clasificador canónico que ya existe en inventario.js —
    // _kardexTipoBase/_kardexCantidadFirmada, el mismo que usa el propio
    // Kardex para saber qué es entrada/salida/ajuste/transferencia/
    // cancelación por patrón de texto — así cualquier movimiento nuevo que
    // clasifique como "ajuste" aquí también.
    const ajustesMovs = kardex.filter(m =>
        typeof window._kardexTipoBase === 'function' && window._kardexTipoBase(m) === 'ajuste' &&
        _efEnRango(m.fecha, desde, hasta)
    );
    const productosMermaSinCosto = new Map(); // productoId -> {productoId, nombre, ocurrencias}
    function _efEsAjusteEgreso(m) {
        if (typeof window._kardexCantidadFirmada === 'function') {
            return window._kardexCantidadFirmada(m, 'ajuste') < 0;
        }
        return /egreso|merma|salida/i.test(`${m.tipo || ''} ${m.concepto || ''} ${m.motivo || ''}`);
    }
    function _efValorAjuste(m) {
        const prod = productosMap.get(String(m.productoId ?? ''));
        const costo = Number(prod?.costo || prod?.precioCompra) || 0;
        const cant = Number(m.cantidad) || 0;
        if (costo <= 0 && cant > 0) {
            const pid = String(m.productoId ?? '');
            const nombre = m.productoNombre || prod?.nombre || '(sin nombre)';
            const entry = productosMermaSinCosto.get(pid) || { productoId: pid, nombre, ocurrencias: 0 };
            entry.ocurrencias += 1;
            productosMermaSinCosto.set(pid, entry);
        }
        return costo * cant;
    }
    const totalMermasBruto = ajustesMovs
        .filter(m => _efEsAjusteEgreso(m))
        .reduce((s, m) => s + _efValorAjuste(m), 0);
    const totalSobrantesAjuste = ajustesMovs
        .filter(m => !_efEsAjusteEgreso(m))
        .reduce((s, m) => s + _efValorAjuste(m), 0);
    const totalMermasNetas = Math.max(0, totalMermasBruto - totalSobrantesAjuste);

    // 🛡️ REPARACIÓN: cuando ni el kardex NI el producto traen un costo
    // utilizable (costo=0 o vacío, precioCompra=0 o vacío — típicamente un
    // hueco de captura, no una compra gratis), la estimación de arriba
    // aportaba $0 SIN avisar, inflando el margen en silencio. Como último
    // recurso — y SOLO cuando de verdad no hay ningún dato de costo del que
    // partir — se asume un margen bruto del 25% sobre el precio de venta
    // registrado en la propia venta (costo = precio × 0.75). Es una
    // suposición, no un dato real, así que cada producto que cae en este
    // caso se registra en productosSinCostoDetectados para que Roberto lo
    // corrija de forma permanente en el catálogo (ver script de consola).
    const MARGEN_ASUMIDO_SIN_COSTO = 0.25;
    const productosSinCostoDetectados = new Map(); // productoId -> {productoId, nombre, ocurrencias, montoConMargenAsumido}
    function _efCostoUnitConFallback(a, prod) {
        const costoReal = Number(prod?.costo || prod?.precioCompra) || 0;
        if (costoReal > 0) return { costoUnit: costoReal, fueFallback: false };
        const precioUnit = Number(a.precio || a.precioContado) || 0;
        const costoUnit = precioUnit * (1 - MARGEN_ASUMIDO_SIN_COSTO);
        if (costoUnit > 0) {
            const pid = String(a.productoId ?? a.id ?? '');
            const nombre = a.nombre || prod?.nombre || '(sin nombre)';
            const cant = Number(a.cantidad) || 1;
            const entry = productosSinCostoDetectados.get(pid) || { productoId: pid, nombre, ocurrencias: 0, montoConMargenAsumido: 0 };
            entry.ocurrencias += 1;
            entry.montoConMargenAsumido += costoUnit * cant;
            productosSinCostoDetectados.set(pid, entry);
        }
        return { costoUnit, fueFallback: true };
    }

    let costoVentasEstimado = 0;
    let costoVentasPorMargenAsumido = 0;
    const foliosCostoEstimado = [];
    ventasEnRango.forEach(v => {
        const folio = String(v.folio || '');
        if (!folio || foliosConKardexSalida.has(folio)) return;
        const arts = Array.isArray(v.articulos) ? v.articulos : [];
        let costoEstimVenta = 0;
        arts.forEach(a => {
            const prod = productosMap.get(String(a.productoId ?? a.id ?? ''));
            const { costoUnit, fueFallback } = _efCostoUnitConFallback(a, prod);
            const cant = Number(a.cantidad) || 1;
            costoEstimVenta += costoUnit * cant;
            if (fueFallback) costoVentasPorMargenAsumido += costoUnit * cant;
        });
        if (costoEstimVenta > 0) {
            costoVentasEstimado += costoEstimVenta;
            foliosCostoEstimado.push(folio);
        }
    });
    const costoVentas = costoVentasReal + costoVentasEstimado;

    // 🛡️ REPARACIÓN (misma causa, lado inverso): una venta CANCELADA debe
    // regresar su costo vía kardex 'entrada' con folioVenta — eso es justo lo
    // que resta reingresosVenta arriba. Pero si esa 'entrada' tampoco quedó
    // en el kardex (mismo vaciado), el crédito se pierde. Se estima igual que
    // arriba: costo actual del producto × cantidad de
    // historialCancelaciones.articulosReingresados — pero SOLO cuando de
    // verdad se contó algún costo para esa venta en este periodo (ver guard
    // abajo: si la venta es de este mismo periodo y ni siquiera tiene salida
    // real en kardex, ventasEnRango ya la excluyó por completo y no hay nada
    // que reversar; estimarlo ahí duplicaría el crédito).
    const historialCancelaciones = StorageService.get('historialCancelaciones', []);
    const cancelacionesEnRango = historialCancelaciones.filter(c => _efEnRango(c.fecha, desde, hasta));
    const foliosConKardexEntrada = new Set(reingresosVentaMovs.map(m => String(m.folioVenta)));
    let reingresosEstimado = 0;
    const foliosReingresoEstimado = [];
    cancelacionesEnRango.forEach(c => {
        const folio = String(c.folio || '');
        if (!folio || foliosConKardexEntrada.has(folio)) return;
        const ventaOriginal = ventas.find(v => String(v.folio) === folio);
        const ventaEnEstePeriodo = !!ventaOriginal && _efEnRango(ventaOriginal.fechaVenta || ventaOriginal.fecha, desde, hasta);
        // Si la venta es de este mismo periodo Y tampoco tiene salida real en
        // kardex, de verdad no se contó ningún costo para ella en este
        // periodo (quedó fuera de ventasEnRango por estar cancelada, así que
        // ni siquiera entró a la estimación de arriba) — ahí sí no hay nada
        // que reversar. Pero si SÍ tiene una salida real en kardex (el bug
        // solo se comió la 'entrada' de reversa, no la 'salida' original),
        // ese costo real ya está adentro de salidasVenta pese a que la venta
        // esté cancelada — kardex no filtra por estado de venta — y si no se
        // credita aquí, se queda inflando el Costo de Ventas de una venta que
        // no debería aportar nada. Por eso el guard es sobre si el folio
        // tiene salida real, no sobre si la venta cayó en este periodo.
        if (ventaEnEstePeriodo && !foliosConKardexSalida.has(folio)) return;
        // articulosReingresados no siempre trae "precio" (algunos vienen del
        // modal de condiciones, solo con productoId/cantidad/color/destino),
        // así que para el fallback de margen se busca el precio en los
        // artículos de la venta original por productoId.
        const preciosVentaOriginal = new Map(
            (Array.isArray(ventaOriginal?.articulos) ? ventaOriginal.articulos : [])
                .map(a => [String(a.productoId ?? a.id ?? ''), Number(a.precio || a.precioContado) || 0])
        );
        const arts = Array.isArray(c.articulosReingresados) ? c.articulosReingresados : [];
        let creditoCancelacion = 0;
        arts.forEach(a => {
            const pid = String(a.productoId ?? a.id ?? '');
            const prod = productosMap.get(pid);
            const aConPrecio = { ...a, precio: a.precio ?? preciosVentaOriginal.get(pid) ?? 0 };
            const { costoUnit, fueFallback } = _efCostoUnitConFallback(aConPrecio, prod);
            const cant = Number(a.cantidad) || 1;
            creditoCancelacion += costoUnit * cant;
            if (fueFallback) costoVentasPorMargenAsumido -= costoUnit * cant; // es crédito: reduce lo ya marcado, no duplica el aviso
        });
        if (creditoCancelacion > 0) {
            reingresosEstimado += creditoCancelacion;
            foliosReingresoEstimado.push(folio);
        }
    });
    const costoVentasFinal = Math.max(0, costoVentas - reingresosEstimado);

    const gastos = StorageService.get('gastosOperativos', []);
    const gastosPorCategoria = {};
    let totalGastos = 0;
    let gastosFinancieros = 0;
    gastos.filter(g => _efEnRango(g.fecha, desde, hasta)).forEach(g => {
        const monto = Number(g.monto) || 0;
        if (_efEsGastoFinanciero(g.categoria)) {
            gastosFinancieros += monto;
            return; // no entra al desglose de gastos operativos
        }
        const cat = g.categoria || 'Sin categoría';
        gastosPorCategoria[cat] = (gastosPorCategoria[cat] || 0) + monto;
        totalGastos += monto;
    });

    const prestamos = StorageService.get('prestamosOtorgados', []);
    const incobrables = prestamos
        .filter(p => p.estado === 'Incobrable' && _efEnRango(p.fechaIncobrable || p.fecha, desde, hasta))
        .reduce((s, p) => s + (Number(p.saldoPendiente) || 0), 0);

    // 🛡️ REPARACIÓN: las comisiones de vendedores se acumulan en
    // comisionesRegistradas (vendedores.js) al cerrar la venta, y su pago se
    // hace vía _egresarCuenta (mueve caja, ver bancos/vendedores) — pero
    // NINGUNO de los dos toca gastosOperativos, así que nunca aparecían como
    // gasto en el Estado de Resultados aunque sí bajan el efectivo real.
    // Se reconocen aquí en base acumulada (fecha de la venta que las generó,
    // no fecha de pago) para que casen con el ingreso de esa misma venta —
    // igual que ya se hace para el resto del Estado de Resultados. Se
    // excluyen las comisiones de ventas que terminaron canceladas (mismo
    // criterio que ventasEnRango arriba) porque esa venta ya no aporta
    // ingreso en este reporte y no debería aportar su comisión tampoco.
    const foliosCancelados = new Set(
        ventas.filter(v => v.estado === 'Cancelada' || v.estatus === 'Cancelada').map(v => String(v.folio))
    );
    const comisionesRegistradas = StorageService.get('comisionesRegistradas', []);
    const totalComisiones = comisionesRegistradas
        .filter(c => _efEnRango(c.fecha, desde, hasta) && !foliosCancelados.has(String(c.folio)))
        .reduce((s, c) => s + (Number(c.montoComision) || 0), 0);

    const ingresosNetos = ingresosVentas - totalDevoluciones;
    const utilidadBruta = ingresosNetos - costoVentasFinal;
    // Cuentas incobrables: NIF las clasifica como gasto de operación (venta/
    // administración), NO como parte del RIF.
    const utilidadOperacion = utilidadBruta - totalComisiones - totalMermasNetas - totalGastos - incobrables;
    const rif = ingresosFinancieros - gastosFinancieros;
    const utilidadNeta = utilidadOperacion + rif;

    return {
        desde: desdeStr, hasta: hastaStr,
        ingresosVentas, totalDevoluciones, ingresosNetos,
        costoVentas: costoVentasFinal, costoVentasReal,
        costoVentasEstimado, foliosCostoEstimado,
        costoVentasPorMargenAsumido: Math.max(0, costoVentasPorMargenAsumido),
        margenAsumidoSinCostoPct: MARGEN_ASUMIDO_SIN_COSTO * 100,
        productosSinCostoDetectados: Array.from(productosSinCostoDetectados.values())
            .sort((a, b) => b.montoConMargenAsumido - a.montoConMargenAsumido),
        reingresosEstimado, foliosReingresoEstimado,
        utilidadBruta,
        totalComisiones,
        totalMermasNetas, totalMermasBruto, totalSobrantesAjuste,
        productosMermaSinCosto: Array.from(productosMermaSinCosto.values())
            .sort((a, b) => b.ocurrencias - a.ocurrencias),
        gastosPorCategoria, totalGastos, incobrables, utilidadOperacion,
        ingresosFinancieros, gastosFinancieros, rif,
        utilidadNeta
    };
}

// ---------------------------------------------------------------
// BALANCE GENERAL
// ---------------------------------------------------------------

// Reconstruye el saldo de una lista de cuentas (efectivo o bancarias) a una
// fecha de corte, partiendo del saldo actual y deshaciendo los movimientos de
// movimientosCaja posteriores a esa fecha (ingreso posterior se resta,
// egreso posterior se suma de vuelta).
function _efSaldoCuentasAFecha(cuentas, tipoCuenta, hastaDate, movimientosCaja) {
    return cuentas.map(c => {
        const efectoPosterior = movimientosCaja
            .filter(m => String(m.cuenta) === String(c.id) && _efParseFecha(m.fecha) > hastaDate)
            .reduce((s, m) => s + (m.tipo === 'ingreso' ? Number(m.monto) || 0 : -(Number(m.monto) || 0)), 0);
        return { ...c, saldoAFecha: (Number(c.saldo) || 0) - efectoPosterior };
    });
}

function _efCalcularBalanceGeneral(hastaStr) {
    const hasta = _efParseFecha(hastaStr + 'T23:59:59');
    const hoyStr = _efHoyInput();
    const esHistorico = hastaStr !== hoyStr;

    const movimientosCaja = StorageService.get('movimientosCaja', []);
    const efectivo = _efSaldoCuentasAFecha(StorageService.get('cuentasEfectivo', []), 'efectivo', hasta, movimientosCaja);
    const bancos = _efSaldoCuentasAFecha(StorageService.get('cuentas-bancarias', []), 'banco', hasta, movimientosCaja);
    const totalEfectivoBancos = [...efectivo, ...bancos].reduce((s, c) => s + (Number(c.saldoAFecha) || 0), 0);

    // 🛡️ REPARACIÓN: leía c.saldoPendiente ?? c.saldo, campos que NO existen
    // en cuentasPorCobrar (ese registro solo se crea en ventas.js con
    // saldoActual/saldoOriginal, y cxc.js mantiene el saldo vivo únicamente
    // en saldoActual — ver abonos/liquidaciones). Leer el campo equivocado
    // subestimaba (o volvía $0) este activo. Se excluyen cuentas Canceladas
    // por si acaso (ya deberían traer saldoActual=0, ver ventas.js) y se
    // separa la porción marcada incobrable como reserva explícita en vez de
    // dejarla mezclada silenciosamente en el activo (ver reservaIncobrables
    // más abajo) — antes ni se filtraba ni se mostraba aparte.
    const cxc = StorageService.get('cuentasPorCobrar', []).filter(c => c.estado !== 'Cancelado');
    const totalCxCCreditoBruto = cxc.reduce((s, c) => s + (Number(c.saldoActual) || 0), 0);
    const reservaCxCIncobrable = cxc.filter(c => c.incobrable === true).reduce((s, c) => s + (Number(c.saldoActual) || 0), 0);
    const totalCxCCredito = Math.max(0, totalCxCCreditoBruto - reservaCxCIncobrable);

    // 🛡️ Apartados (layaway) son una cuenta por cobrar aparte de
    // cuentasPorCobrar: el cliente debe el saldoPendiente pero la mercancía
    // sigue en tienda (no se entrega hasta liquidar, ver ventas.js). Sin
    // esto, ese saldo por cobrar no existía en ningún lado del Balance.
    // Solo 'Pendiente' tiene saldo real: 'Liquidado'/'Entregado' ya están en
    // 0, 'Cancelado' se revierte aparte, 'Migrado a Crédito' ya vive en
    // cuentasPorCobrar.
    const apartados = StorageService.get('apartados', []).filter(a => a.estado === 'Pendiente');
    const totalApartadosPorCobrar = apartados.reduce((s, a) => s + (Number(a.saldoPendiente) || 0), 0);
    const totalCxC = totalCxCCredito + totalApartadosPorCobrar;

    // 🛡️ REPARACIÓN: antes se excluían los préstamos incobrables en silencio
    // (filter previo a sumar) — el activo bajaba pero no había ningún
    // renglón que mostrara esa reserva, igual que pedías. Ahora se calcula
    // bruto y la reserva aparte, para juntarla con la de CxC en un solo
    // renglón explícito "Reserva para cuentas incobrables".
    const prestamosTodos = StorageService.get('prestamosOtorgados', []);
    const totalPrestamosBruto = prestamosTodos.reduce((s, p) => s + (Number(p.saldoPendiente) || 0), 0);
    const reservaPrestamosIncobrable = prestamosTodos.filter(p => p.estado === 'Incobrable').reduce((s, p) => s + (Number(p.saldoPendiente) || 0), 0);
    const totalPrestamosPorCobrar = Math.max(0, totalPrestamosBruto - reservaPrestamosIncobrable);

    const totalReservaIncobrables = reservaCxCIncobrable + reservaPrestamosIncobrable;

    // 🛡️ Inventario: stock nuevo + stockSegunda (mercancía devuelta/dañada,
    // vive en un campo aparte — ver inventario.js línea ~1908 — y antes no
    // se sumaba, así que ese valor desaparecía del Balance). Se resta la
    // mercancía en consignación activa (consignacionesActivas.cantidadPendiente):
    // esa mercancía SÍ está físicamente en tienda y cuenta en p.stock, pero
    // todavía es propiedad del proveedor (se recibió "sin CxP" a propósito,
    // ver compras.js), así que no debe contarse como activo propio hasta que
    // se venda o se marque "Ya es mía" (liquidarConsignacionComoPropia).
    const productos = StorageService.get('productos', []);
    const totalInventarioBruto = productos.reduce((s, p) => {
        const costo = Number(p.costo || p.precioCompra) || 0;
        const stockNuevo = Number(p.stock) || 0;
        const stockSegunda = Number(p.stockSegunda) || 0;
        return s + (stockNuevo + stockSegunda) * costo;
    }, 0);
    const consignaciones = StorageService.get('consignacionesActivas', []);
    const totalConsignacionNoPropia = consignaciones.reduce((s, c) => s + (Number(c.cantidadPendiente) || 0) * (Number(c.costoUnitario) || 0), 0);
    const totalInventario = Math.max(0, totalInventarioBruto - totalConsignacionNoPropia);

    const cxp = StorageService.get('cuentasPorPagar', []);
    const totalCxP = cxp.reduce((s, c) => s + (Number(c.saldoPendiente ?? c.saldo) || 0), 0);

    // Deuda con el banco por compras a Tarjeta de Crédito a Meses Sin
    // Intereses (bancos.js / cuentasMSI). Mismo cálculo que usa
    // renderDashboardMSI: total de la compra menos lo ya pagado, por cada
    // cuenta MSI. Sin esto el pasivo queda incompleto y las "Utilidades
    // acumuladas" (que se calculan como residual) se inflan de más.
    const cuentasMSI = StorageService.get('cuentasMSI', []);
    const totalDeudaMSI = cuentasMSI.reduce((s, d) => {
        const total = parseFloat(String(d.total || 0).replace(/[$,]/g, '')) || 0;
        const pagado = Number(d.montoPagado || 0);
        return s + Math.max(0, total - pagado);
    }, 0);

    // 🛡️ Saldo a favor de proveedores (compras.js / saldosFavorProveedores):
    // crédito real que un proveedor nos debe (p. ej. por "Devolución sin
    // compra"), aplicable a compras futuras. Es un activo — antes no se
    // mostraba en ningún lado del Balance.
    const saldosFavorProveedores = StorageService.get('saldosFavorProveedores', []);
    const totalSaldoFavorProveedores = saldosFavorProveedores.reduce((s, x) => s + Math.max(0, Number(x.montoDisponible) || 0), 0);

    const totalActivo = totalEfectivoBancos + totalCxC + totalPrestamosPorCobrar + totalInventario + totalSaldoFavorProveedores;
    const totalPasivo = totalCxP + totalDeudaMSI;

    const { neto: capitalAportadoNeto, aportado, retirado } = _efTotalesCapital();
    const utilidadesAcumuladas = totalActivo - totalPasivo - capitalAportadoNeto;
    const totalCapital = capitalAportadoNeto + utilidadesAcumuladas;

    return {
        hasta: hastaStr, esHistorico,
        efectivo, bancos, totalEfectivoBancos,
        totalCxC, totalCxCCreditoBruto, totalCxCCredito, totalApartadosPorCobrar,
        totalPrestamosBruto, totalPrestamosPorCobrar,
        reservaCxCIncobrable, reservaPrestamosIncobrable, totalReservaIncobrables,
        totalInventario,
        totalSaldoFavorProveedores,
        totalActivo,
        totalCxP, totalDeudaMSI, totalPasivo,
        capitalAportado: aportado, capitalRetirado: retirado, capitalAportadoNeto,
        utilidadesAcumuladas, totalCapital
    };
}

// ---------------------------------------------------------------
// RENDER
// ---------------------------------------------------------------

function renderEstadosFinancieros() {
    const cont = document.getElementById('contenidoEstadosFinancieros');
    if (!cont) return;

    const hoy = _efHoyInput();
    const desde = window._efRangoDesde || (hoy.slice(0, 8) + '01');
    const hasta = window._efRangoHasta || hoy;
    window._efRangoDesde = desde;
    window._efRangoHasta = hasta;

    const er = _efCalcularEstadoResultados(desde, hasta);
    const bg = _efCalcularBalanceGeneral(hasta);
    const { movs: capitalMovs } = _efTotalesCapital();

    const filasGastos = Object.entries(er.gastosPorCategoria)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, monto]) => `<tr><td style="padding:4px 8px;color:#4b5563;">${_efEsc(cat)}</td><td style="padding:4px 8px;text-align:right;">${_efDinero(monto)}</td></tr>`)
        .join('') || '<tr><td colspan="2" style="padding:4px 8px;color:#9ca3af;">Sin gastos en el periodo.</td></tr>';

    const filasCapital = capitalMovs
        .slice().sort((a, b) => new Date(b.fechaIso) - new Date(a.fechaIso))
        .slice(0, 20)
        .map(m => `<tr>
            <td style="padding:6px 8px;">${_efEsc(m.fecha)}</td>
            <td style="padding:6px 8px;">${m.tipo === 'aportacion' ? '➕ Aportación' : '➖ Retiro'}</td>
            <td style="padding:6px 8px;text-align:right;font-weight:bold;color:${m.tipo === 'aportacion' ? '#059669' : '#dc2626'};">${_efDinero(m.monto)}</td>
            <td style="padding:6px 8px;">${_efEsc(m.etiquetaCuenta)}</td>
            <td style="padding:6px 8px;color:#6b7280;">${_efEsc(m.nota)}</td>
        </tr>`).join('') || '<tr><td colspan="5" style="padding:8px;color:#9ca3af;">Sin movimientos de capital todavía.</td></tr>';

    cont.innerHTML = `
    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:end;margin-bottom:20px;background:#f9fafb;padding:14px;border-radius:8px;">
        <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;display:block;margin-bottom:4px;">DESDE</label>
            <input type="date" id="efRangoDesde" value="${desde}" style="padding:8px;border:1px solid #d1d5db;border-radius:6px;">
        </div>
        <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;display:block;margin-bottom:4px;">HASTA</label>
            <input type="date" id="efRangoHasta" value="${hasta}" style="padding:8px;border:1px solid #d1d5db;border-radius:6px;">
        </div>
        <button onclick="window._efRangoDesde=document.getElementById('efRangoDesde').value;window._efRangoHasta=document.getElementById('efRangoHasta').value;renderEstadosFinancieros();" style="padding:9px 18px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">🔄 Generar</button>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <h3 style="margin:0;color:#0f172a;">📈 Estado de Resultados <span style="font-weight:normal;color:#6b7280;font-size:13px;">(${_efEsc(desde)} a ${_efEsc(hasta)})</span></h3>
    </div>
    <table style="width:100%;border-collapse:collapse;background:white;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:12px;">
        <thead><tr style="background:#f9fafb;font-size:11px;color:#6b7280;text-align:right;"><th style="text-align:left;padding:6px 8px;">Concepto</th><th style="padding:6px 8px;">Monto</th><th style="padding:6px 8px;width:70px;">% Ventas</th></tr></thead>
        <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;">Ingresos por ventas (mercancía, sin intereses)</td><td style="padding:8px;text-align:right;">${_efDinero(er.ingresosVentas)}</td><td style="padding:8px;text-align:right;color:#6b7280;">${_efPct(er.ingresosVentas, er.ingresosVentas)}</td></tr>
        <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;color:#dc2626;">(–) Devoluciones</td><td style="padding:8px;text-align:right;color:#dc2626;">${_efDinero(er.totalDevoluciones)}</td><td style="padding:8px;text-align:right;color:#dc2626;">${_efPct(er.totalDevoluciones, er.ingresosVentas)}</td></tr>
        <tr style="border-bottom:2px solid #cbd5e1;font-weight:bold;"><td style="padding:8px;">= Ventas netas</td><td style="padding:8px;text-align:right;">${_efDinero(er.ingresosNetos)}</td><td style="padding:8px;text-align:right;">${_efPct(er.ingresosNetos, er.ingresosVentas)}</td></tr>
        <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;color:#dc2626;">(–) Costo de ventas${(er.costoVentasEstimado > 0 || er.reingresosEstimado > 0) ? ' <span title="Incluye ajustes estimados — ver aviso abajo" style="cursor:help;">⚠️</span>' : ''}</td><td style="padding:8px;text-align:right;color:#dc2626;">${_efDinero(er.costoVentas)}</td><td style="padding:8px;text-align:right;color:#dc2626;">${_efPct(er.costoVentas, er.ingresosVentas)}</td></tr>
        <tr style="border-bottom:2px solid #cbd5e1;font-weight:bold;background:#f0fdf4;"><td style="padding:8px;">= Utilidad bruta</td><td style="padding:8px;text-align:right;">${_efDinero(er.utilidadBruta)}</td><td style="padding:8px;text-align:right;color:#059669;font-weight:bold;">${_efPct(er.utilidadBruta, er.ingresosVentas)}</td></tr>
    </table>
    ${(er.costoVentasEstimado > 0 || er.reingresosEstimado > 0 || er.productosSinCostoDetectados.length > 0) ? `<details style="margin-bottom:12px;">
        <summary style="cursor:pointer;color:#92400e;font-weight:bold;font-size:12px;">⚠️ Ver ${er.productosSinCostoDetectados.length > 0 ? er.productosSinCostoDetectados.length + ' incidencia(s) en' : ''} el costo de ventas de este periodo</summary>
        <p style="background:#fffbeb;color:#92400e;padding:8px 12px;border-radius:6px;font-size:12px;margin:8px 0 0;">El costo de ventas de este periodo incluye ajustes <strong>estimados</strong> (costo actual del producto × cantidad), no tomados del kardex:${er.costoVentasEstimado > 0 ? ` +${_efDinero(er.costoVentasEstimado)} por ${er.foliosCostoEstimado.length === 1 ? 'la venta' : 'las ventas'} sin salida en movimientosInventario (${_efEsc(er.foliosCostoEstimado.join(', '))})` : ''}${er.reingresosEstimado > 0 ? `${er.costoVentasEstimado > 0 ? ';' : ''} −${_efDinero(er.reingresosEstimado)} por ${er.foliosReingresoEstimado.length === 1 ? 'la cancelación' : 'las cancelaciones'} sin reingreso en movimientosInventario (${_efEsc(er.foliosReingresoEstimado.join(', '))})` : ''}. Costo real de kardex neto: ${_efDinero(er.costoVentasReal)}.</p>
        ${er.productosSinCostoDetectados.length > 0 ? `<div style="background:#fef2f2;color:#991b1b;padding:10px 12px;border-radius:6px;font-size:12px;margin-top:8px;">
            <strong>🚨 ${er.productosSinCostoDetectados.length} producto(s) SIN costo capturado</strong> (ni "costo" ni "precioCompra") — de los ${_efDinero(er.costoVentasEstimado)} estimados arriba, ${_efDinero(er.costoVentasPorMargenAsumido)} NO vienen del costo real del producto sino de asumir un margen del ${er.margenAsumidoSinCostoPct}% sobre su precio de venta. Corrige el campo "Costo" de estos productos en el catálogo para que deje de ser una suposición:
            <table style="width:100%;border-collapse:collapse;margin-top:6px;background:white;border-radius:4px;overflow:hidden;">
                <thead><tr style="background:#fee2e2;text-align:left;"><th style="padding:4px 8px;">Producto (ID)</th><th style="padding:4px 8px;text-align:right;">Veces vendido en el periodo</th><th style="padding:4px 8px;text-align:right;">Monto estimado con margen asumido</th></tr></thead>
                <tbody>${er.productosSinCostoDetectados.map(p => `<tr><td style="padding:4px 8px;">${_efEsc(p.nombre)} <span style="color:#9ca3af;">(${_efEsc(p.productoId)})</span></td><td style="padding:4px 8px;text-align:right;">${p.ocurrencias}</td><td style="padding:4px 8px;text-align:right;">${_efDinero(p.montoConMargenAsumido)}</td></tr>`).join('')}</tbody>
            </table>
        </div>` : ''}
    </details>` : ''}
    <details style="margin-bottom:12px;">
        <summary style="cursor:pointer;color:#1e40af;font-weight:bold;font-size:13px;">Ver desglose de gastos operativos (${_efDinero(er.totalGastos)})</summary>
        <table style="width:100%;border-collapse:collapse;margin-top:6px;">${filasGastos}</table>
    </details>
    <table style="width:100%;border-collapse:collapse;background:white;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:12px;">
        <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;color:#dc2626;">(–) Comisiones a vendedores</td><td style="padding:8px;text-align:right;color:#dc2626;">${_efDinero(er.totalComisiones)}</td><td style="padding:8px;text-align:right;color:#dc2626;width:70px;">${_efPct(er.totalComisiones, er.ingresosVentas)}</td></tr>
        <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;color:#dc2626;">(–) Mermas y ajustes de inventario${er.productosMermaSinCosto.length > 0 ? ` <span title="${er.productosMermaSinCosto.length} producto(s) con merma en el periodo sin costo capturado — no incluidos en este monto: ${_efEsc(er.productosMermaSinCosto.map(p => p.nombre + ' (' + p.ocurrencias + ')').join(', '))}" style="cursor:help;">⚠️</span>` : ''}</td><td style="padding:8px;text-align:right;color:#dc2626;">${_efDinero(er.totalMermasNetas)}</td><td style="padding:8px;text-align:right;color:#dc2626;width:70px;">${_efPct(er.totalMermasNetas, er.ingresosVentas)}</td></tr>
        <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;color:#dc2626;">(–) Gastos operativos</td><td style="padding:8px;text-align:right;color:#dc2626;">${_efDinero(er.totalGastos)}</td><td style="padding:8px;text-align:right;color:#dc2626;width:70px;">${_efPct(er.totalGastos, er.ingresosVentas)}</td></tr>
        <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;color:#dc2626;">(–) Préstamos incobrables</td><td style="padding:8px;text-align:right;color:#dc2626;">${_efDinero(er.incobrables)}</td><td style="padding:8px;text-align:right;color:#dc2626;">${_efPct(er.incobrables, er.ingresosVentas)}</td></tr>
        <tr style="border-bottom:2px solid #cbd5e1;font-weight:bold;"><td style="padding:8px;">= Utilidad de operación</td><td style="padding:8px;text-align:right;">${_efDinero(er.utilidadOperacion)}</td><td style="padding:8px;text-align:right;color:#059669;font-weight:bold;">${_efPct(er.utilidadOperacion, er.ingresosVentas)}</td></tr>
    </table>
    <details style="margin-bottom:12px;">
        <summary style="cursor:pointer;color:#1e40af;font-weight:bold;font-size:13px;">Ver Resultado Integral de Financiamiento — RIF (${_efDinero(er.rif)})</summary>
        <p style="font-size:12px;color:#6b7280;margin:6px 0;">Intereses cobrados por vender a crédito, menos intereses/comisiones pagados (si categorizas un gasto con "interés", "financiero" o "comisión bancaria" en Gastos Operativos, se cuenta aquí en vez de en gastos operativos). Así lo separa la NIF B-3: no es parte de la operación del negocio.</p>
        <table style="width:100%;border-collapse:collapse;">
            <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:6px 8px;">+ Ingresos financieros (intereses cobrados)</td><td style="padding:6px 8px;text-align:right;">${_efDinero(er.ingresosFinancieros)}</td></tr>
            <tr><td style="padding:6px 8px;color:#dc2626;">– Gastos financieros (intereses pagados)</td><td style="padding:6px 8px;text-align:right;color:#dc2626;">${_efDinero(er.gastosFinancieros)}</td></tr>
        </table>
    </details>
    <table style="width:100%;border-collapse:collapse;background:white;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:12px;">
        <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;">± Resultado Integral de Financiamiento (RIF)</td><td style="padding:8px;text-align:right;color:${er.rif >= 0 ? '#059669' : '#dc2626'};">${_efDinero(er.rif)}</td><td style="padding:8px;text-align:right;color:#6b7280;width:70px;">${_efPct(er.rif, er.ingresosVentas)}</td></tr>
        <tr style="font-weight:bold;font-size:16px;background:${er.utilidadNeta >= 0 ? '#f0fdf4' : '#fef2f2'};"><td style="padding:10px 8px;">= UTILIDAD NETA</td><td style="padding:10px 8px;text-align:right;color:${er.utilidadNeta >= 0 ? '#059669' : '#dc2626'};">${_efDinero(er.utilidadNeta)}</td><td style="padding:10px 8px;text-align:right;color:${er.utilidadNeta >= 0 ? '#059669' : '#dc2626'};">${_efPct(er.utilidadNeta, er.ingresosVentas)}</td></tr>
    </table>

    <div style="display:flex;justify-content:space-between;align-items:center;margin:24px 0 10px;">
        <h3 style="margin:0;color:#0f172a;">⚖️ Balance General <span style="font-weight:normal;color:#6b7280;font-size:13px;">(al ${_efEsc(hasta)})</span></h3>
    </div>
    ${bg.esHistorico ? `<p style="background:#fffbeb;color:#92400e;padding:8px 12px;border-radius:6px;font-size:12px;margin-bottom:10px;">⚠️ Corte histórico: el efectivo/bancos se reconstruyó a esta fecha. Cuentas por cobrar, cuentas por pagar, préstamos por cobrar e inventario se muestran con su saldo <strong>actual</strong> (de hoy), no reconstruido a esa fecha.</p>` : ''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div>
            <h4 style="color:#1e40af;margin-bottom:6px;">ACTIVO</h4>
            <table style="width:100%;border-collapse:collapse;background:white;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;">Efectivo y bancos</td><td style="padding:8px;text-align:right;">${_efDinero(bg.totalEfectivoBancos)}</td></tr>
                <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;">Cuentas por cobrar (crédito, bruto)</td><td style="padding:8px;text-align:right;">${_efDinero(bg.totalCxCCreditoBruto)}</td></tr>
                <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;">Cuentas por cobrar (apartados)</td><td style="padding:8px;text-align:right;">${_efDinero(bg.totalApartadosPorCobrar)}</td></tr>
                <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;">Préstamos por cobrar (bruto)</td><td style="padding:8px;text-align:right;">${_efDinero(bg.totalPrestamosBruto)}</td></tr>
                <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;color:#dc2626;">(–) Reserva para cuentas incobrables<span title="Cuentas marcadas 'incobrable' en CxC y Préstamos otorgados — antes se excluían en silencio (Préstamos) o ni siquiera se filtraban (CxC); ahora se restan aquí de forma explícita." style="cursor:help;"> ℹ️</span></td><td style="padding:8px;text-align:right;color:#dc2626;">${_efDinero(bg.totalReservaIncobrables)}</td></tr>
                <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;">Inventario (incl. segunda, sin consignación)</td><td style="padding:8px;text-align:right;">${_efDinero(bg.totalInventario)}</td></tr>
                <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;">Saldo a favor de proveedores</td><td style="padding:8px;text-align:right;">${_efDinero(bg.totalSaldoFavorProveedores)}</td></tr>
                <tr style="font-weight:bold;background:#eff6ff;"><td style="padding:8px;">TOTAL ACTIVO</td><td style="padding:8px;text-align:right;">${_efDinero(bg.totalActivo)}</td></tr>
            </table>
        </div>
        <div>
            <h4 style="color:#b45309;margin-bottom:6px;">PASIVO + CAPITAL</h4>
            <table style="width:100%;border-collapse:collapse;background:white;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;">Cuentas por pagar (proveedores)</td><td style="padding:8px;text-align:right;">${_efDinero(bg.totalCxP)}</td></tr>
                <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;">Deuda TDC a MSI</td><td style="padding:8px;text-align:right;">${_efDinero(bg.totalDeudaMSI)}</td></tr>
                <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;">Capital aportado (neto)</td><td style="padding:8px;text-align:right;">${_efDinero(bg.capitalAportadoNeto)}</td></tr>
                <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;">Utilidades acumuladas</td><td style="padding:8px;text-align:right;">${_efDinero(bg.utilidadesAcumuladas)}</td></tr>
                <tr style="font-weight:bold;background:#fffbeb;"><td style="padding:8px;">TOTAL PASIVO + CAPITAL</td><td style="padding:8px;text-align:right;">${_efDinero(bg.totalPasivo + bg.totalCapital)}</td></tr>
            </table>
        </div>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;margin:24px 0 10px;">
        <h3 style="margin:0;color:#0f172a;">💼 Capital (aportaciones y retiros del dueño)</h3>
        <div style="display:flex;gap:8px;">
            <button onclick="abrirModalCapital('aportacion')" style="padding:8px 14px;background:#059669;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">➕ Aportación</button>
            <button onclick="abrirModalCapital('retiro')" style="padding:8px 14px;background:#dc2626;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">➖ Retiro</button>
        </div>
    </div>
    <p style="color:#6b7280;font-size:13px;">Aportado: <strong style="color:#059669;">${_efDinero(bg.capitalAportado)}</strong> · Retirado: <strong style="color:#dc2626;">${_efDinero(bg.capitalRetirado)}</strong> · Neto: <strong>${_efDinero(bg.capitalAportadoNeto)}</strong></p>
    <table style="width:100%;border-collapse:collapse;background:white;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <thead><tr style="background:#f9fafb;font-size:12px;color:#6b7280;text-align:left;">
            <th style="padding:6px 8px;">Fecha</th><th style="padding:6px 8px;">Tipo</th><th style="padding:6px 8px;text-align:right;">Monto</th><th style="padding:6px 8px;">Cuenta</th><th style="padding:6px 8px;">Nota</th>
        </tr></thead>
        <tbody>${filasCapital}</tbody>
    </table>
    `;
}

window.renderEstadosFinancieros = renderEstadosFinancieros;
window.abrirModalCapital = abrirModalCapital;
window.guardarMovimientoCapital = guardarMovimientoCapital;

console.log('✅ finanzas-estados.js cargado correctamente');
