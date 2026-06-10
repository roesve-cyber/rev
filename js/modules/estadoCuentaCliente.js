// ================================================================
// 📊 MÓDULO: ESTADO DE CUENTA CONSOLIDADO POR CLIENTE
// Consolida TODAS las ventas de un cliente en UN reporte
// Muestra: Saldos, frecuencia, antigüedad, estatus, historial de abonos
// ================================================================

function _escCuenta(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _dinéroCuenta(v) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(v) || 0);
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
            const d = window.parseFechaMX ? window.parseFechaMX(a.fechaAbonoIso || a.fecha) : new Date(a.fechaAbonoIso || a.fecha);
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
    const ventasReg = StorageService.get('ventasRegistradas', []);
    
    // Filtrar cuentas del cliente
    const cuentasCliente = cuentasCxC.filter(c => {
        return String(c.clienteId || c.cliente?.id || '') === String(clienteId) ||
               String(c.clienteNombre || c.cliente?.nombre || '').toLowerCase() === String(clienteNombre || '').toLowerCase();
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
        const saldo = Number(cuenta.saldoActual || 0);
        const totalCredito = Number(cuenta.totalCredito || cuenta.montoTotal || 0);
        const abonos = cuenta.abonos || [];
        
        totalSaldoConsolidado += saldo;
        totalVendido += totalCredito;
        
        // Acumular abonos para análisis consolidado
        abonos.forEach(a => {
            abonosConsolidados.push({
                ...a,
                folioReferencia: folio
            });
            totalAbonado += Number(a.monto || 0);
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
            ultimoAbono: abonos.length > 0 ? _fechaCortaCuenta(abonos[abonos.length - 1].fechaAbonoIso || abonos[abonos.length - 1].fecha) : '-',
            estado: estadoEstatus.estado
        };
    });
    
    const diasAntiguoConsolidado = _diasTranscurridos(fechaMasAntigua);
    const estadoConsolidado = _calcularEstadoCliente(totalSaldoConsolidado, diasAntiguoConsolidado);
    const frecuenciaPago = _analizarFrecuencia(abonosConsolidados);
    
    return {
        existe: true,
        clienteId,
        clienteNombre: cuentasCliente[0].clienteNombre || cuentasCliente[0].cliente?.nombre || clienteNombre,
        clienteTelefono: cuentasCliente[0].clienteTelefono || cuentasCliente[0].cliente?.telefono || '-',
        clienteDireccion: cuentasCliente[0].clienteDireccion || cuentasCliente[0].cliente?.direccion || '-',
        
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
            const d = window.parseFechaMX ? window.parseFechaMX(a.fechaAbonoIso || a.fecha) : new Date(a.fechaAbonoIso || a.fecha);
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
        const id = c.clienteId || c.cliente?.id;
        const nombre = c.clienteNombre || c.cliente?.nombre;
        
        if (id && !clientesMap.has(String(id))) {
            clientesMap.set(String(id), { id, nombre });
            clientesUnicos.push({ id, nombre });
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
                ${clientesUnicos.map(c => `<option value="${c.id}">${_escCuenta(c.nombre)}</option>`).join('')}
            </select>
        </div>
        <div style="display:flex; align-items:flex-end; gap:10px;">
            <button onclick="generarEstadoCuentaClienteConsolidado()" 
                    style="padding:12px 24px; background:#1e40af; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:14px;">
                📄 Generar Reporte
            </button>
            <button onclick="imprimirEstadoCuentaClienteConsolidado()" 
                    style="padding:12px 24px; background:#059669; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:14px; display:none;" id="btnImprimirECC">
                🖨️ Imprimir
            </button>
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
    const clienteId = selectCliente?.value;
    
    if (!clienteId) {
        alert('⚠️ Selecciona un cliente primero.');
        return;
    }
    
    const estado = window.obtenerEstadoClienteConsolidado(clienteId);
    
    if (!estado.existe) {
        alert('❌ No se encontraron cuentas para este cliente.');
        return;
    }
    
    const contenidoReporte = document.getElementById('contenidoReporteECC');
    if (!contenidoReporte) return;
    
    // Guardar estado global para impresión
    window._estadoClienteActual = estado;
    
    // Mostrar botón de impresión
    const btnImprimir = document.getElementById('btnImprimirECC');
    if (btnImprimir) btnImprimir.style.display = 'inline-block';
    
    const colorEstado = estado.colorEstatus;
    
    const abonosPorFolio = {};
    estado.cuentas.forEach(c => {
        abonosPorFolio[c.folio] = c;
    });
    
    const html = `
    <div style="background:white; border-radius:12px; padding:30px; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
        
        <!-- ENCABEZADO -->
        <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:30px; border-bottom:3px solid #1e40af; padding-bottom:20px;">
            <div>
                <h2 style="margin:0 0 5px 0; color:#1e293b; font-size:24px;">📊 ESTADO DE CUENTA CONSOLIDADO</h2>
                <p style="margin:5px 0 0 0; color:#64748b; font-size:13px;">Fecha de Generación: ${_fechaCortaCuenta(new Date())}</p>
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
    // Aquí puedes abrir la vista de detalle de venta si necesitas
    alert(`📄 Detalle de folio: ${folio}\n\nPróximamente: Vista detallada de esta venta.`);
};

window.imprimirEstadoCuentaClienteConsolidado = function() {
    if (!window._estadoClienteActual) {
        alert('⚠️ Genera un reporte primero.');
        return;
    }
    
    const estado = window._estadoClienteActual;
    const contenido = document.getElementById('contenidoReporteECC');
    if (!contenido) return;
    
    const ventana = window.open('', '_blank');
    if (!ventana) {
        alert('⚠️ Habilita las ventanas emergentes para imprimir.');
        return;
    }
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Estado de Cuenta - ${estado.clienteNombre}</title>
        <style>
            * { margin:0; padding:0; box-sizing:border-box; }
            body { font-family:Arial, sans-serif; color:#1e293b; background:white; }
            .contenedor { max-width:800px; margin:0 auto; padding:20px; }
            h1 { font-size:20px; text-align:center; margin-bottom:5px; border-bottom:3px solid #1e40af; padding-bottom:15px; }
            .fecha { text-align:center; color:#64748b; font-size:12px; margin-bottom:20px; }
            .cliente-info { background:#f1f5f9; padding:15px; border-radius:8px; margin-bottom:20px; }
            .cliente-info p { margin:5px 0; }
            .metricas { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:20px; }
            .metrica { border:2px solid #cbd5e1; padding:10px; border-radius:6px; }
            .metrica-label { font-size:10px; color:#64748b; font-weight:bold; }
            .metrica-valor { font-size:16px; font-weight:bold; color:#1e293b; margin-top:5px; }
            table { width:100%; border-collapse:collapse; margin:20px 0; font-size:12px; }
            th { background:#1e40af; color:white; padding:8px; text-align:left; font-weight:bold; }
            td { padding:8px; border-bottom:1px solid #e2e8f0; }
            tr:nth-child(even) { background:#f8fafc; }
            @media print {
                body { margin:0; padding:0; }
                .contenedor { margin:0; padding:0; }
                * { box-shadow:none !important; }
            }
        </style>
    </head>
    <body>
        <div class="contenedor">
            <h1>📊 ESTADO DE CUENTA CONSOLIDADO</h1>
            <div class="fecha">Fecha: ${_fechaCortaCuenta(new Date())}</div>
            
            <div class="cliente-info">
                <p><strong>Cliente:</strong> ${_escCuenta(estado.clienteNombre)}</p>
                <p><strong>Teléfono:</strong> ${_escCuenta(estado.clienteTelefono)}</p>
                <p><strong>Dirección:</strong> ${_escCuenta(estado.clienteDireccion)}</p>
            </div>
            
            <div class="metricas">
                <div class="metrica">
                    <div class="metrica-label">Total Vendido</div>
                    <div class="metrica-valor">${_dinéroCuenta(estado.totalVendido)}</div>
                </div>
                <div class="metrica">
                    <div class="metrica-label">Total Abonado</div>
                    <div class="metrica-valor">${_dinéroCuenta(estado.totalAbonado)}</div>
                </div>
                <div class="metrica">
                    <div class="metrica-label">Saldo Pendiente</div>
                    <div class="metrica-valor">${_dinéroCuenta(estado.totalSaldo)}</div>
                </div>
                <div class="metrica">
                    <div class="metrica-label">Estatus</div>
                    <div class="metrica-valor">${estado.estadoEstatus}</div>
                </div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>Folio</th>
                        <th>Fecha</th>
                        <th>Total</th>
                        <th>Saldo</th>
                        <th>Días</th>
                        <th>Estatus</th>
                    </tr>
                </thead>
                <tbody>
                    ${estado.cuentas.map(c => `
                        <tr>
                            <td>${_escCuenta(c.folio)}</td>
                            <td>${c.fechaVentaCorta}</td>
                            <td>${_dinéroCuenta(c.totalVenta)}</td>
                            <td>${_dinéroCuenta(c.saldo)}</td>
                            <td>${c.diasAntiguo}</td>
                            <td>${c.estado}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <p style="text-align:center; margin-top:40px; font-size:11px; color:#64748b;">
                Mueblaría Mi Pueblito | Estado de Cuenta Generado Automáticamente
            </p>
        </div>
        <script>
            window.print();
            setTimeout(() => window.close(), 500);
        </script>
    </body>
    </html>
    `;
    
    ventana.document.write(html);
    ventana.document.close();
};

// 🎯 FUNCIÓN DE INICIALIZACIÓN PARA VISTA
window.renderEstadoCuentaClienteConsolidado = function() {
    const cont = document.getElementById('contenidoEstadoCuentaCliente');
    if (!cont) return;
    
    window.renderEstadoCuentaClienteSelector();
};

console.log('✅ Módulo Estado de Cuenta Consolidado cargado.');
