// ================================================================
// 📊 MÓDULO: ESTADO DE CUENTA CONSOLIDADO POR CLIENTE
// Consolida TODAS las ventas de un cliente en UN reporte
// Muestra: Saldos, frecuencia, antigüedad, estatus, historial de abonos
// ================================================================

function _escCuenta(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _dinéroCuenta(v) {
    return _dineroCuenta(v);
}

function _dineroCuenta(v) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(v) || 0);
}

function _normalizarCuentaTexto(valor) {
    return String(valor || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function _clienteIdCuenta(cuenta = {}) {
    return cuenta.clienteId ?? cuenta.cliente?.id ?? cuenta.idCliente ?? cuenta.cliente?.clienteId ?? '';
}

function _clienteNombreCuenta(cuenta = {}) {
    return cuenta.clienteNombre || cuenta.nombre || cuenta.cliente?.nombre || cuenta.datosVenta?.cliente?.nombre || '';
}

function _clienteTelefonoCuenta(cuenta = {}) {
    return cuenta.clienteTelefono || cuenta.telefono || cuenta.cliente?.telefono || cuenta.datosVenta?.cliente?.telefono || '-';
}

function _clienteDireccionCuenta(cuenta = {}) {
    return cuenta.clienteDireccion || cuenta.direccion || cuenta.cliente?.direccion || cuenta.datosVenta?.cliente?.direccion || '-';
}

function _montoAbonoCuenta(abono = {}) {
    return Number(abono.monto ?? abono.montoAbono ?? abono.montoAbonado ?? abono.importe ?? 0) || 0;
}

function _fechaAbonoCuenta(abono = {}) {
    return abono.fechaAbonoIso || abono.fechaIso || abono.fechaAbonoRaw || abono.fechaAbono || abono.fecha || abono.fechaCapturaIso || abono.fechaCaptura || null;
}

function _abonosCuenta(cuenta = {}) {
    return Array.isArray(cuenta.abonos) ? cuenta.abonos : [];
}

function _saldoCuenta(cuenta = {}) {
    const tieneSaldoDirecto = cuenta.saldoActual !== undefined || cuenta.saldoPendiente !== undefined || cuenta.saldo !== undefined;
    const directo = Number(cuenta.saldoActual ?? cuenta.saldoPendiente ?? cuenta.saldo ?? 0);
    if (tieneSaldoDirecto && Number.isFinite(directo)) return Math.max(0, directo);

    const total = _totalCuenta(cuenta);
    const enganche = Number(cuenta.engancheRecibido ?? cuenta.enganche ?? 0) || 0;
    const abonado = _abonosCuenta(cuenta).reduce((s, a) => s + _montoAbonoCuenta(a), 0);
    return Math.max(0, total - enganche - abonado);
}

function _totalCuenta(cuenta = {}) {
    const candidatos = [
        cuenta.plan?.total,
        cuenta.totalCredito,
        cuenta.montoTotal,
        cuenta.saldoOriginal,
        cuenta.totalContadoOriginal,
        cuenta.totalMercancia,
        cuenta.totalVenta,
        cuenta.total,
        cuenta.importeApartado
    ];
    const mayorCandidato = candidatos
        .map(Number)
        .filter(v => Number.isFinite(v) && v > 0)
        .reduce((max, v) => Math.max(max, v), 0);

    const saldo = Number(cuenta.saldoActual ?? cuenta.saldoPendiente ?? cuenta.saldo ?? 0) || 0;
    const enganche = Number(cuenta.engancheRecibido ?? cuenta.enganche ?? 0) || 0;
    const abonado = _abonosCuenta(cuenta).reduce((s, a) => s + _montoAbonoCuenta(a), 0);
    return Math.max(mayorCandidato, saldo + enganche + abonado);
}

function _fechaCortaCuenta(fecha) {
    if (!fecha) return '-';
    const d = window.parseFechaMX ? window.parseFechaMX(fecha) : new Date(fecha);
    if (!d || isNaN(d.getTime())) return String(fecha);
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const anio = d.getFullYear();
    return `${dia}-${mes}-${anio}`;
}

function _diasTranscurridos(fechaBase) {
    if (!fechaBase) return 0;
    const d = window.parseFechaMX ? window.parseFechaMX(fechaBase) : new Date(fechaBase);
    if (!d || isNaN(d.getTime())) return 0;
    const hoy = new Date();
    const diffTiempo = hoy - d;
    const diffDias = Math.floor(diffTiempo / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDias);
}

function _calcularEstadoCliente(saldo, diasAntiguo) {
    if (saldo <= 0.01) return { estado: 'Saldado', color: '#10b981' };
    if (diasAntiguo > 60) return { estado: 'Vencido', color: '#dc2626' };
    if (diasAntiguo > 30) return { estado: 'Próx. Vencer', color: '#f59e0b' };
    return { estado: 'Al Corriente', color: '#0ea5e9' };
}

function _analizarFrecuencia(abonos) {
    if (!abonos || abonos.length < 2) return 'Variable';
    
    const fechas = abonos
        .map(a => {
            const fecha = _fechaAbonoCuenta(a);
            const d = window.parseFechaMX ? window.parseFechaMX(fecha) : new Date(fecha);
            return d instanceof Date && !isNaN(d.getTime()) ? d : null;
        })
        .filter(Boolean)
        .sort((a, b) => a - b);
    
    if (fechas.length < 2) return 'Variable';
    
    const diferencias = [];
    for (let i = 1; i < fechas.length; i++) {
        const diff = Math.floor((fechas[i] - fechas[i-1]) / (1000 * 60 * 60 * 24));
        diferencias.push(diff);
    }
    
    const promedio = diferencias.reduce((a, b) => a + b, 0) / diferencias.length;
    
    if (promedio <= 7) return 'Semanal';
    if (promedio <= 15) return 'Quincenal';
    if (promedio <= 35) return 'Mensual';
    return 'Variable';
}

// 🎯 FUNCIÓN PRINCIPAL: Obtener estado consolidado de cliente
window.obtenerEstadoClienteConsolidado = function(clienteId, clienteNombre = '') {
    const cuentasCxC = StorageService.get('cuentasPorCobrar', []);
    const idBuscado = String(clienteId || '').trim();
    const nombreBuscado = _normalizarCuentaTexto(clienteNombre);
    
    // Filtrar cuentas del cliente
    const cuentasCliente = cuentasCxC.filter(c => {
        const idCuenta = String(_clienteIdCuenta(c) || '').trim();
        const nombreCuenta = _normalizarCuentaTexto(_clienteNombreCuenta(c));
        return (idBuscado && idCuenta && idCuenta === idBuscado) ||
               (nombreBuscado && nombreCuenta && nombreCuenta === nombreBuscado);
    });
    
    if (cuentasCliente.length === 0) {
        return {
            clienteId,
            clienteNombre,
            existe: false,
            totalSaldo: 0,
            cuentas: []
        };
    }
    
    let totalSaldoConsolidado = 0;
    let totalAbonado = 0;
    let totalVendido = 0;
    const abonosConsolidados = [];
    let fechaMasAntigua = null;
    
    const detallesCuentas = cuentasCliente.map(cuenta => {
        const folio = cuenta.folio;
        const saldo = _saldoCuenta(cuenta);
        const totalCredito = _totalCuenta(cuenta);
        const abonos = _abonosCuenta(cuenta);
        const enganche = Number(cuenta.engancheRecibido ?? cuenta.enganche ?? 0) || 0;
        
        totalSaldoConsolidado += saldo;
        totalVendido += totalCredito;
        totalAbonado += enganche;
        
        // Acumular abonos para análisis consolidado
        abonos.forEach(a => {
            abonosConsolidados.push({
                ...a,
                folioReferencia: folio
            });
            totalAbonado += _montoAbonoCuenta(a);
        });
        
        // Encontrar fecha más antigua
        const fechaVenta = cuenta.fechaVenta || cuenta.fecha;
        if (fechaVenta) {
            const d = window.parseFechaMX ? window.parseFechaMX(fechaVenta) : new Date(fechaVenta);
            if (d && !isNaN(d.getTime())) {
                if (!fechaMasAntigua || d < fechaMasAntigua) {
                    fechaMasAntigua = d;
                }
            }
        }
        
        const diasAntiguo = _diasTranscurridos(fechaVenta);
        const estadoEstatus = _calcularEstadoCliente(saldo, diasAntiguo);
        
        return {
            folio,
            fechaVenta,
            fechaVentaCorta: _fechaCortaCuenta(fechaVenta),
            totalVenta: totalCredito,
            saldo,
            diasAntiguo,
            abonos: abonos.length,
            ultimoAbono: abonos.length > 0 ? _fechaCortaCuenta(_fechaAbonoCuenta(abonos[abonos.length - 1])) : '-',
            estado: estadoEstatus.estado
        };
    });
    
    const diasAntiguoConsolidado = _diasTranscurridos(fechaMasAntigua);
    const estadoConsolidado = _calcularEstadoCliente(totalSaldoConsolidado, diasAntiguoConsolidado);
    const frecuenciaPago = _analizarFrecuencia(abonosConsolidados);
    
    return {
        existe: true,
        clienteId,
        clienteNombre: _clienteNombreCuenta(cuentasCliente[0]) || clienteNombre,
        clienteTelefono: _clienteTelefonoCuenta(cuentasCliente[0]),
        clienteDireccion: _clienteDireccionCuenta(cuentasCliente[0]),
        
        // CONSOLIDADOS
        totalVendido,
        totalAbonado,
        totalSaldo: totalSaldoConsolidado,
        porcentajePago: totalVendido > 0 ? Math.round((totalAbonado / totalVendido) * 100) : 0,
        
        // ANÁLISIS
        diasAntiguo: diasAntiguoConsolidado,
        estadoEstatus: estadoConsolidado.estado,
        colorEstatus: estadoConsolidado.color,
        frecuenciaPago,
        
        // DETALLE
        cuentas: detallesCuentas,
        abonosTotal: abonosConsolidados.length,
        
        // PRÓXIMA FECHA (estimada)
        proximaFecha: _estimarProximaCobro(abonosConsolidados)
    };
};

function _estimarProximaCobro(abonos) {
    if (abonos.length < 2) return '-';
    
    const fechas = abonos
        .map(a => {
            const fecha = _fechaAbonoCuenta(a);
            const d = window.parseFechaMX ? window.parseFechaMX(fecha) : new Date(fecha);
            return d instanceof Date && !isNaN(d.getTime()) ? d : null;
        })
        .filter(Boolean)
        .sort((a, b) => b - a);
    
    if (fechas.length === 0) return '-';
    
    const ultimoAbono = fechas[0];
    const diferencias = [];
    
    for (let i = 1; i < Math.min(5, fechas.length); i++) {
        const diff = Math.floor((fechas[i-1] - fechas[i]) / (1000 * 60 * 60 * 24));
        if (diff > 0) diferencias.push(diff);
    }
    
    if (diferencias.length === 0) return '-';
    
    const promedio = Math.round(diferencias.reduce((a, b) => a + b, 0) / diferencias.length);
    const proxima = new Date(ultimoAbono);
    proxima.setDate(proxima.getDate() + promedio);
    
    return _fechaCortaCuenta(proxima);
}

// 🎯 RENDERIZAR LISTA DE CLIENTES PARA SELECCIONAR
window.renderEstadoCuentaClienteSelector = function() {
    const contenedor = document.getElementById('contenidoEstadoCuentaCliente');
    if (!contenedor) return;
    
    const cuentasCxC = StorageService.get('cuentasPorCobrar', []);
    const clientesUnicos = [];
    const clientesMap = new Map();
    
    cuentasCxC.forEach(c => {
        const id = _clienteIdCuenta(c);
        const nombre = _clienteNombreCuenta(c);
        const key = id ? `id:${String(id)}` : `nombre:${_normalizarCuentaTexto(nombre)}`;
        
        if (nombre && !clientesMap.has(key)) {
            clientesMap.set(key, { id, nombre, key });
            clientesUnicos.push({ id, nombre, key });
        }
    });
    
    clientesUnicos.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
    
    const html = `
    <div style="display:flex; gap:20px; margin-bottom:20px; flex-wrap:wrap;">
        <div style="flex:1; min-width:250px;">
            <label style="display:block; font-weight:bold; margin-bottom:8px; color:#1e293b;">🔍 Buscar Cliente:</label>
            <input type="text" id="filtroClienteECC" placeholder="Nombre del cliente..." 
                   style="width:100%; padding:12px; border:2px solid #cbd5e1; border-radius:8px; font-size:14px;"
                   oninput="filtrarClientesECC()">
        </div>
        <div style="flex:1; min-width:250px;">
            <label style="display:block; font-weight:bold; margin-bottom:8px; color:#1e293b;">👥 Seleccionar:</label>
            <select id="selectClienteECC" style="width:100%; padding:12px; border:2px solid #cbd5e1; border-radius:8px; font-size:14px;">
                <option value="">-- Elige un cliente --</option>
                ${clientesUnicos.map(c => `<option value="${_escCuenta(c.key)}" data-id="${_escCuenta(c.id || '')}" data-nombre="${_escCuenta(c.nombre || '')}">${_escCuenta(c.nombre)}</option>`).join('')}
            </select>
        </div>
        <div style="display:flex; align-items:flex-end; gap:10px; flex-wrap:wrap;">
            <button onclick="generarEstadoCuentaClienteConsolidado()" 
                    style="padding:12px 24px; background:#1e40af; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:14px;">
                📄 Generar Reporte
            </button>
            <div id="btnGroupImpresionECC" style="display:none; gap:10px; flex-wrap:wrap;">
                <button onclick="imprimirTicketEstadoCuentaCliente()" style="padding:12px 18px; background:#3b82f6; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:14px;">🖨️ Ticket Térmico</button>
                <button onclick="imprimirPdfEstadoCuentaCliente()" style="padding:12px 18px; background:#059669; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:14px;">📄 PDF / A4</button>
                <button id="btnImgECC" onclick="descargarImagenEstadoCuentaCliente()" style="padding:12px 18px; background:#d97706; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:14px;">📷 Guardar Imagen</button>
            </div>
        </div>
    </div>
    
    <div id="contenidoReporteECC" style="margin-top:20px;"></div>
    `;
    
    contenedor.innerHTML = html;
};

window.filtrarClientesECC = function() {
    const filtro = document.getElementById('filtroClienteECC')?.value.toLowerCase() || '';
    const select = document.getElementById('selectClienteECC');
    
    if (!select) return;
    
    Array.from(select.options).forEach((option, idx) => {
        if (idx === 0) return;
        const text = option.text.toLowerCase();
        option.style.display = text.includes(filtro) ? 'block' : 'none';
    });
};

window.generarEstadoCuentaClienteConsolidado = function() {
    const selectCliente = document.getElementById('selectClienteECC');
    const selectedOption = selectCliente?.selectedOptions?.[0];
    const clienteId = selectedOption?.dataset?.id || '';
    const clienteNombre = selectedOption?.dataset?.nombre || '';
    
    if (!selectCliente?.value) {
        alert('⚠️ Selecciona un cliente primero.');
        return;
    }
    
    const estado = window.obtenerEstadoClienteConsolidado(clienteId, clienteNombre);
    
    if (!estado.existe) {
        alert('❌ No se encontraron cuentas para este cliente.');
        return;
    }
    
    const contenidoReporte = document.getElementById('contenidoReporteECC');
    if (!contenidoReporte) return;
    
    // Guardar estado global para impresión
    window._estadoClienteActual = estado;
    
    // Mostrar botones de impresión
    const btnGroup = document.getElementById('btnGroupImpresionECC');
    if (btnGroup) btnGroup.style.display = 'flex';
    
    const colorEstado = estado.colorEstatus;
    
    const abonosPorFolio = {};
    estado.cuentas.forEach(c => {
        abonosPorFolio[c.folio] = c;
    });
    
    const html = `
    <div style="background:white; border-radius:12px; padding:30px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
        
        <!-- ENCABEZADO -->
        <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:30px; border-bottom:3px solid #1e40af; padding-bottom:20px;">
            <div style="display:flex; align-items:center; gap:14px;">
                <img src="img/Logo.svg" alt="Mi Pueblito" style="width:62px; height:62px; object-fit:contain;" onerror="this.style.display='none'">
                <div>
                    <h2 style="margin:0 0 5px 0; color:#1e293b; font-size:24px;">📊 ESTADO DE CUENTA CONSOLIDADO</h2>
                    <p style="margin:5px 0 0 0; color:#64748b; font-size:13px;">Fecha de Generación: ${_fechaCortaCuenta(new Date())}</p>
                </div>
            </div>
            <div style="text-align:right;">
                <div style="background:${colorEstado}; color:white; padding:12px 20px; border-radius:8px; font-weight:bold; font-size:16px; margin-bottom:10px;">
                    ${estado.estadoEstatus}
                </div>
            </div>
        </div>
        
        <!-- DATOS DEL CLIENTE -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:30px; padding:20px; background:#f1f5f9; border-radius:8px;">
            <div>
                <p style="margin:0 0 8px 0; font-size:12px; color:#64748b; font-weight:bold; text-transform:uppercase;">Cliente</p>
                <p style="margin:0; font-size:16px; color:#1e293b; font-weight:bold;">${_escCuenta(estado.clienteNombre)}</p>
            </div>
            <div>
                <p style="margin:0 0 8px 0; font-size:12px; color:#64748b; font-weight:bold; text-transform:uppercase;">Teléfono</p>
                <p style="margin:0; font-size:16px; color:#1e293b;">${_escCuenta(estado.clienteTelefono)}</p>
            </div>
            <div style="grid-column:1/-1;">
                <p style="margin:0 0 8px 0; font-size:12px; color:#64748b; font-weight:bold; text-transform:uppercase;">Dirección</p>
                <p style="margin:0; font-size:14px; color:#1e293b;">${_escCuenta(estado.clienteDireccion)}</p>
            </div>
        </div>
        
        <!-- MÉTRICAS CONSOLIDADAS -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:15px; margin-bottom:30px;">
            <div style="background:#eff6ff; border:2px solid #0ea5e9; border-radius:8px; padding:15px;">
                <p style="margin:0 0 5px 0; font-size:11px; color:#0284c7; font-weight:bold; text-transform:uppercase;">Total Vendido</p>
                <p style="margin:0; font-size:22px; color:#0c4a6e; font-weight:bold;">${_dinéroCuenta(estado.totalVendido)}</p>
            </div>
            
            <div style="background:#f0fdf4; border:2px solid #10b981; border-radius:8px; padding:15px;">
                <p style="margin:0 0 5px 0; font-size:11px; color:#059669; font-weight:bold; text-transform:uppercase;">Total Abonado</p>
                <p style="margin:0; font-size:22px; color:#065f46; font-weight:bold;">${_dinéroCuenta(estado.totalAbonado)}</p>
            </div>
            
            <div style="background:#fef2f2; border:2px solid #dc2626; border-radius:8px; padding:15px;">
                <p style="margin:0 0 5px 0; font-size:11px; color:#dc2626; font-weight:bold; text-transform:uppercase;">Saldo Pendiente</p>
                <p style="margin:0; font-size:22px; color:#7f1d1d; font-weight:bold;">${_dinéroCuenta(estado.totalSaldo)}</p>
            </div>
            
            <div style="background:#fef3c7; border:2px solid #f59e0b; border-radius:8px; padding:15px;">
                <p style="margin:0 0 5px 0; font-size:11px; color:#b45309; font-weight:bold; text-transform:uppercase;">% Pagado</p>
                <p style="margin:0; font-size:22px; color:#78350f; font-weight:bold;">${estado.porcentajePago}%</p>
            </div>
        </div>
        
        <!-- ANÁLISIS DE PAGO -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:15px; margin-bottom:30px; padding:20px; background:#f8fafc; border-radius:8px; border:1px solid #cbd5e1;">
            <div>
                <p style="margin:0 0 8px 0; font-size:12px; color:#475569; font-weight:bold; text-transform:uppercase;">Antigüedad de Deuda</p>
                <p style="margin:0; font-size:18px; color:#1e293b; font-weight:bold;">${estado.diasAntiguo} días</p>
            </div>
            <div>
                <p style="margin:0 0 8px 0; font-size:12px; color:#475569; font-weight:bold; text-transform:uppercase;">Frecuencia de Pago</p>
                <p style="margin:0; font-size:18px; color:#1e293b; font-weight:bold;">${estado.frecuenciaPago}</p>
            </div>
            <div>
                <p style="margin:0 0 8px 0; font-size:12px; color:#475569; font-weight:bold; text-transform:uppercase;">Próximo Cobro (Estimado)</p>
                <p style="margin:0; font-size:18px; color:#1e293b; font-weight:bold;">${estado.proximaFecha}</p>
            </div>
            <div>
                <p style="margin:0 0 8px 0; font-size:12px; color:#475569; font-weight:bold; text-transform:uppercase;">Total de Operaciones</p>
                <p style="margin:0; font-size:18px; color:#1e293b; font-weight:bold;">${estado.cuentas.length} folios</p>
            </div>
        </div>
        
        <!-- TABLA DE FOLIOS -->
        <div style="margin-bottom:30px;">
            <h3 style="margin:0 0 15px 0; color:#1e293b; font-size:16px; font-weight:bold;">📋 Detalle por Folio de Venta</h3>
            <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; font-size:13px;">
                    <thead>
                        <tr style="background:#1e40af; color:white; font-weight:bold;">
                            <th style="padding:12px; text-align:left; border:1px solid #cbd5e1;">Folio</th>
                            <th style="padding:12px; text-align:center; border:1px solid #cbd5e1;">Fecha Venta</th>
                            <th style="padding:12px; text-align:right; border:1px solid #cbd5e1;">Total Venta</th>
                            <th style="padding:12px; text-align:right; border:1px solid #cbd5e1;">Saldo</th>
                            <th style="padding:12px; text-align:center; border:1px solid #cbd5e1;">Días</th>
                            <th style="padding:12px; text-align:center; border:1px solid #cbd5e1;">Abonos</th>
                            <th style="padding:12px; text-align:center; border:1px solid #cbd5e1;">Último Abono</th>
                            <th style="padding:12px; text-align:center; border:1px solid #cbd5e1;">Estatus</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${estado.cuentas.map(c => `
                            <tr style="border-bottom:1px solid #e2e8f0; background:${c.saldo <= 0.01 ? '#f0fdf4' : 'white'};">
                                <td style="padding:12px; border:1px solid #cbd5e1; font-weight:bold; color:#0c4a6e;"><a href="#" onclick="abrirDetalleVentaECC('${c.folio}'); return false;" style="color:#0c4a6e; text-decoration:underline; cursor:pointer;">${_escCuenta(c.folio)}</a></td>
                                <td style="padding:12px; text-align:center; border:1px solid #cbd5e1;">${c.fechaVentaCorta}</td>
                                <td style="padding:12px; text-align:right; border:1px solid #cbd5e1; font-weight:bold; color:#065f46;">${_dinéroCuenta(c.totalVenta)}</td>
                                <td style="padding:12px; text-align:right; border:1px solid #cbd5e1; font-weight:bold; color:${c.saldo > 0 ? '#7f1d1d' : '#065f46'};"><span style="background:${c.saldo <= 0.01 ? '#d1fae5' : '#fee2e2'}; padding:4px 8px; border-radius:4px; display:inline-block;">${_dinéroCuenta(c.saldo)}</span></td>
                                <td style="padding:12px; text-align:center; border:1px solid #cbd5e1;">${c.diasAntiguo}</td>
                                <td style="padding:12px; text-align:center; border:1px solid #cbd5e1;"><strong>${c.abonos}</strong></td>
                                <td style="padding:12px; text-align:center; border:1px solid #cbd5e1; font-size:12px;">${c.ultimoAbono}</td>
                                <td style="padding:12px; text-align:center; border:1px solid #cbd5e1;"><span style="background:${c.estado === 'Saldado' ? '#d1fae5' : c.estado === 'Vencido' ? '#fee2e2' : c.estado === 'Próx. Vencer' ? '#fef3c7' : '#e0f2fe'}; color:${c.estado === 'Saldado' ? '#065f46' : c.estado === 'Vencido' ? '#7f1d1d' : c.estado === 'Próx. Vencer' ? '#92400e' : '#0c4a6e'}; padding:6px 12px; border-radius:6px; display:inline-block; font-weight:bold; font-size:11px;">${c.estado}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        
        <div style="text-align:center; padding:20px; border-top:2px solid #e2e8f0; margin-top:30px; color:#64748b; font-size:12px;">
            Reporte generado automáticamente por el sistema | Mueblaría Mi Pueblito
        </div>
    </div>
    `;
    
    contenidoReporte.innerHTML = html;
};

window.abrirDetalleVentaECC = function(folio) {
    if (typeof window.abrirEstadoCuentaFolio === 'function') {
        return window.abrirEstadoCuentaFolio(folio);
    }
    alert(`📄 Detalle de folio: ${folio}\n\nEl modulo de estado por folio no esta disponible.`);
};

window.imprimirPdfEstadoCuentaCliente = function() {
    if (!window._estadoClienteActual) return alert('⚠️ Genera un reporte primero.');
    const estado = window._estadoClienteActual;
    const contenido = document.getElementById('contenidoReporteECC');
    if (!contenido) return;
    
    const htmlDoc = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Estado de Cuenta - ${estado.clienteNombre}</title>
        <style>
            * { margin:0; padding:0; box-sizing:border-box; }
            body { font-family:Arial, sans-serif; color:#1e293b; background:white; padding:20px; }
            .contenedor { max-width:800px; margin:0 auto; }
            h1 { font-size:20px; text-align:center; margin-bottom:5px; border-bottom:3px solid #1e40af; padding-bottom:15px; }
            .fecha { text-align:center; color:#64748b; font-size:12px; margin-bottom:20px; }
            .cliente-info { background:#f1f5f9; padding:15px; border-radius:8px; margin-bottom:20px; }
            .cliente-info p { margin:5px 0; }
            .metricas { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:20px; }
            .metrica { border:2px solid #cbd5e1; padding:10px; border-radius:6px; }
            .metrica-label { font-size:10px; color:#64748b; font-weight:bold; text-transform:uppercase; }
            .metrica-valor { font-size:16px; font-weight:bold; color:#1e293b; margin-top:5px; }
            table { width:100%; border-collapse:collapse; margin:20px 0; font-size:12px; }
            th { background:#1e40af; color:white; padding:8px; text-align:left; font-weight:bold; border:1px solid #cbd5e1; }
            td { padding:8px; border-bottom:1px solid #e2e8f0; border-left:1px solid #cbd5e1; border-right:1px solid #cbd5e1; }
            tr:nth-child(even) { background:#f8fafc; }
            @media print {
                body { margin:0; padding:0; }
                .contenedor { margin:0; padding:0; }
                * { box-shadow:none !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
        </style>
    </head>
    <body>
        <div class="contenedor">
            <div style="text-align:center; margin-bottom:10px;">
                <img src="img/Logo.svg" alt="Mi Pueblito" style="width:62px; height:62px; object-fit:contain;" onerror="this.style.display='none'">
            </div>
            <h1>📊 ESTADO DE CUENTA CONSOLIDADO</h1>
            <div class="fecha">Fecha de Emisión: ${_fechaCortaCuenta(new Date())}</div>
            
            <div class="cliente-info">
                <p><strong>Cliente:</strong> ${_escCuenta(estado.clienteNombre)}</p>
                <p><strong>Teléfono:</strong> ${_escCuenta(estado.clienteTelefono)}</p>
                <p><strong>Dirección:</strong> ${_escCuenta(estado.clienteDireccion)}</p>
            </div>
            
            <div class="metricas">
                <div class="metrica"><div class="metrica-label">Total Vendido</div><div class="metrica-valor">${_dinéroCuenta(estado.totalVendido)}</div></div>
                <div class="metrica"><div class="metrica-label">Total Abonado</div><div class="metrica-valor" style="color:#059669;">${_dinéroCuenta(estado.totalAbonado)}</div></div>
                <div class="metrica"><div class="metrica-label">Saldo Pendiente</div><div class="metrica-valor" style="color:#dc2626;">${_dinéroCuenta(estado.totalSaldo)}</div></div>
                <div class="metrica"><div class="metrica-label">Estatus Global</div><div class="metrica-valor">${estado.estadoEstatus}</div></div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>Folio</th>
                        <th style="text-align:center;">Fecha</th>
                        <th style="text-align:right;">Total</th>
                        <th style="text-align:right;">Saldo</th>
                        <th style="text-align:center;">Días</th>
                        <th style="text-align:center;">Estatus</th>
                    </tr>
                </thead>
                <tbody>
                    ${estado.cuentas.map(c => `
                        <tr>
                            <td><strong>${_escCuenta(c.folio)}</strong></td>
                            <td style="text-align:center;">${c.fechaVentaCorta}</td>
                            <td style="text-align:right;">${_dinéroCuenta(c.totalVenta)}</td>
                            <td style="text-align:right; font-weight:bold; color:${c.saldo > 0 ? '#dc2626' : '#059669'};">${_dinéroCuenta(c.saldo)}</td>
                            <td style="text-align:center;">${c.diasAntiguo}</td>
                            <td style="text-align:center;">${c.estado}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <p style="text-align:center; margin-top:40px; font-size:11px; color:#64748b;">
                Mueblería Mi Pueblito | Documento Informativo de Saldo
            </p>
        </div>
    </body>
    </html>`;

    if (window.TicketService?.openDocument) {
        window.TicketService.openDocument(htmlDoc, { title: `Estado Cuenta ${estado.clienteNombre}`, filename: `estado_cuenta_consolidado_${estado.clienteNombre}`, pageSize: 'letter', autoPrint: true });
    } else {
        const win = window.open('', '_blank');
        win.document.write(htmlDoc);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 500);
    }
};

window.imprimirTicketEstadoCuentaCliente = function() {
    if (!window._estadoClienteActual) return alert('⚠️ Genera un reporte primero.');
    const estado = window._estadoClienteActual;
    
    const lineasCuentas = estado.cuentas.map(c => `
        <div><b>FOLIO: ${c.folio}</b></div>
        <div style="display:flex; justify-content:space-between;"><span>Total:</span><span>${_dinéroCuenta(c.totalVenta)}</span></div>
        <div style="display:flex; justify-content:space-between;"><span>Saldo:</span><span style="font-weight:bold;">${_dinéroCuenta(c.saldo)}</span></div>
        <div style="display:flex; justify-content:space-between;"><span>Estatus:</span><span>${c.estado}</span></div>
        <hr style="border-top:1px dashed #ccc; margin:4px 0;">
    `).join('');

    const ticketHTML = `<!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <style>
            @page { size: 80mm auto; margin: 0; }
            body { font-family: 'Courier New', monospace; font-size: 11px; width: 72mm; margin: 4mm auto; color: #000; background: #fff; line-height:1.2; }
            .centro { text-align: center; }
            .negrita { font-weight: bold; }
            hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
            .no-print { background: #eee; padding: 10px; text-align: center; margin-bottom: 10px; }
            @media print { .no-print { display: none !important; } }
        </style>
    </head>
    <body>
        <div class="no-print"><button onclick="window.print()" style="padding:10px; font-weight:bold;">IMPRIMIR TICKET</button></div>
        <div class="centro">
            <img src="img/Logo.svg" alt="Mi Pueblito" style="width:50px; height:50px; object-fit:contain;" onerror="this.style.display='none'">
            <div class="negrita" style="font-size:14px;">MUEBLERÍA MI PUEBLITO</div>
            <div class="negrita" style="font-size:12px; margin-top:4px;">ESTADO DE CUENTA<br>CONSOLIDADO</div>
            <div style="font-size:10px; margin-top:3px;">Emisión: ${_fechaCortaCuenta(new Date())}</div>
        </div>
        <hr>
        <div><b>CLIENTE:</b> ${_escCuenta(estado.clienteNombre)}</div>
        ${estado.clienteTelefono !== '-' ? `<div><b>TEL:</b> ${_escCuenta(estado.clienteTelefono)}</div>` : ''}
        <hr>
        <div class="centro negrita" style="margin-bottom:4px;">RESUMEN GLOBAL</div>
        <div style="display:flex; justify-content:space-between;"><span>Total Vendido:</span><span>${_dinéroCuenta(estado.totalVendido)}</span></div>
        <div style="display:flex; justify-content:space-between;"><span>Total Abonado:</span><span>${_dinéroCuenta(estado.totalAbonado)}</span></div>
        <div style="display:flex; justify-content:space-between;" class="negrita"><span>SALDO ACTUAL:</span><span>${_dinéroCuenta(estado.totalSaldo)}</span></div>
        <div style="display:flex; justify-content:space-between; margin-top:4px;"><span>Estatus:</span><span>${estado.estadoEstatus}</span></div>
        <hr>
        <div class="centro negrita" style="margin-bottom:6px;">DETALLE POR FOLIO</div>
        ${lineasCuentas}
        <div class="centro" style="margin-top:12px; font-size:9px;">Documento informativo de saldos.</div>
    </body>
    </html>`;

    if (window.TicketService?.openHtml) {
        window.TicketService.openHtml(ticketHTML, { title: `Estado Cuenta ${estado.clienteNombre}`, filename: `ticket_ecc_${estado.clienteNombre}` });
    } else {
        const win = window.open('', '_blank');
        win.document.write(ticketHTML);
        win.document.close();
        win.focus();
    }
};

window.descargarImagenEstadoCuentaCliente = function() {
    if (!window._estadoClienteActual) return alert('⚠️ Genera un reporte primero.');
    const contenedor = document.getElementById('contenidoReporteECC');
    if (!contenedor) return;

    const btn = document.getElementById('btnImgECC');
    const txtOriginal = btn.innerHTML;
    btn.innerHTML = '⏳ Generando...';
    btn.disabled = true;

    // Cargar html2canvas dinámicamente si no existe
    const loadScript = (cb) => {
        if (typeof html2canvas !== 'undefined') return cb();
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        s.onload = cb;
        s.onerror = () => { alert("Error al cargar motor de imágenes."); btn.innerHTML = txtOriginal; btn.disabled = false; };
        document.head.appendChild(s);
    };

    loadScript(() => {
        const clon = contenedor.cloneNode(true);
        // Ajustamos el clon para la foto
        clon.style.width = '850px';
        clon.style.padding = '20px';
        clon.style.background = 'white';
        clon.style.position = 'absolute';
        clon.style.left = '-9999px';
        document.body.appendChild(clon);

        html2canvas(clon, { scale: 2, backgroundColor: '#ffffff', useCORS: true }).then(canvas => {
            const link = document.createElement('a');
            link.download = `Estado_Cuenta_${window._estadoClienteActual.clienteNombre.replace(/\s+/g, '_')}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        }).catch(e => {
            console.error("Error html2canvas:", e);
            alert('Hubo un error al generar la imagen.');
        }).finally(() => {
            clon.remove();
            btn.innerHTML = txtOriginal;
            btn.disabled = false;
        });
    });
};

// 🎯 FUNCIÓN DE INICIALIZACIÓN PARA VISTA
window.renderEstadoCuentaClienteConsolidado = function() {
    const cont = document.getElementById('contenidoEstadoCuentaCliente');
    if (!cont) return;
    
    window.renderEstadoCuentaClienteSelector();
};

console.log('✅ Módulo Estado de Cuenta Consolidado cargado.');
