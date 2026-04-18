// ===== REPORTES DINÁMICOS =====

function actualizarReporte() {
    const tipo = document.getElementById("tipoReporte")?.value || "ventas";
    const fechaIni = document.getElementById("fechaInicio")?.value || "";
    const fechaFin = document.getElementById("fechaFin")?.value || "";
    const contenedor = document.getElementById("contenidoReporte");
    if (!contenedor) return;

    const desde = fechaIni ? new Date(fechaIni + "T00:00:00") : null;
    const hasta = fechaFin ? new Date(fechaFin + "T23:59:59") : null;

    function enRango(fechaStr) {
        if (!fechaStr) return true;
        const f = new Date(fechaStr);
        if (desde && f < desde) return false;
        if (hasta && f > hasta) return false;
        return true;
    }

    let html = '';

    if (tipo === "ventas") {
        const datos = (cuentasPorCobrar || []).filter(c => enRango(c.fechaVenta));
        const totalVentas = datos.reduce((s, c) => s + (c.totalContadoOriginal || 0), 0);
        html = `<h3 style="color:#1a3a70; margin-bottom:15px;">📈 Ventas</h3>
            <p style="margin-bottom:15px;"><strong>Total ventas:</strong> ${dinero(totalVentas)} — <strong>${datos.length} registro(s)</strong></p>
            <div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead><tr style="background:#1a3a70; color:white;">
                <th style="padding:8px;">Folio</th><th style="padding:8px;">Cliente</th>
                <th style="padding:8px;">Fecha</th><th style="padding:8px;">Total</th>
                <th style="padding:8px;">Método</th><th style="padding:8px;">Estado</th>
            </tr></thead><tbody>`;
        datos.forEach((c, i) => {
            html += `<tr style="background:${i%2===0?'white':'#f9fafb'};">
                <td style="padding:7px; border-bottom:1px solid #eee;">${c.folio||''}</td>
                <td style="padding:7px; border-bottom:1px solid #eee;">${c.nombre||''}</td>
                <td style="padding:7px; border-bottom:1px solid #eee;">${c.fechaVenta ? new Date(c.fechaVenta).toLocaleDateString('es-MX') : ''}</td>
                <td style="padding:7px; border-bottom:1px solid #eee; text-align:right;">${dinero(c.totalContadoOriginal||0)}</td>
                <td style="padding:7px; border-bottom:1px solid #eee;">${c.metodo||''}</td>
                <td style="padding:7px; border-bottom:1px solid #eee;">${c.estado||''}</td>
            </tr>`;
        });
        if (datos.length === 0) html += `<tr><td colspan="6" style="padding:20px; text-align:center; color:#718096;">Sin registros</td></tr>`;
        html += '</tbody></table></div>';

    } else if (tipo === "compras") {
        const datos = (compras || []).filter(c => enRango(c.fecha));
        const total = datos.reduce((s, c) => s + (c.total || 0), 0);
        html = `<h3 style="color:#1a3a70; margin-bottom:15px;">🛒 Compras a Proveedores</h3>
            <p style="margin-bottom:15px;"><strong>Total compras:</strong> ${dinero(total)} — <strong>${datos.length} registro(s)</strong></p>
            <div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead><tr style="background:#1a3a70; color:white;">
                <th style="padding:8px;">Folio</th><th style="padding:8px;">Proveedor</th>
                <th style="padding:8px;">Fecha</th><th style="padding:8px;">Total</th>
                <th style="padding:8px;">Método Pago</th>
            </tr></thead><tbody>`;
        datos.forEach((c, i) => {
            html += `<tr style="background:${i%2===0?'white':'#f9fafb'};">
                <td style="padding:7px; border-bottom:1px solid #eee;">${c.folio||c.id||''}</td>
                <td style="padding:7px; border-bottom:1px solid #eee;">${c.proveedor||''}</td>
                <td style="padding:7px; border-bottom:1px solid #eee;">${c.fecha||''}</td>
                <td style="padding:7px; border-bottom:1px solid #eee; text-align:right;">${dinero(c.total||0)}</td>
                <td style="padding:7px; border-bottom:1px solid #eee;">${c.metodoPago||''}</td>
            </tr>`;
        });
        if (datos.length === 0) html += `<tr><td colspan="5" style="padding:20px; text-align:center; color:#718096;">Sin registros</td></tr>`;
        html += '</tbody></table></div>';

    } else if (tipo === "cobrar") {
        const datos = (cuentasPorCobrar || []).filter(c => enRango(c.fechaVenta));
        const total = datos.reduce((s, c) => s + (c.saldoActual || 0), 0);
        html = `<h3 style="color:#1a3a70; margin-bottom:15px;">💳 Cuentas por Cobrar</h3>
            <p style="margin-bottom:15px;"><strong>Saldo total pendiente:</strong> ${dinero(total)} — <strong>${datos.length} registro(s)</strong></p>
            <div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead><tr style="background:#1a3a70; color:white;">
                <th style="padding:8px;">Folio</th><th style="padding:8px;">Cliente</th>
                <th style="padding:8px;">Fecha</th><th style="padding:8px;">Total Original</th>
                <th style="padding:8px;">Saldo</th><th style="padding:8px;">Estado</th>
            </tr></thead><tbody>`;
        datos.forEach((c, i) => {
            html += `<tr style="background:${i%2===0?'white':'#f9fafb'};">
                <td style="padding:7px; border-bottom:1px solid #eee;">${c.folio||''}</td>
                <td style="padding:7px; border-bottom:1px solid #eee;">${c.nombre||''}</td>
                <td style="padding:7px; border-bottom:1px solid #eee;">${c.fechaVenta ? new Date(c.fechaVenta).toLocaleDateString('es-MX') : ''}</td>
                <td style="padding:7px; border-bottom:1px solid #eee; text-align:right;">${dinero(c.totalContadoOriginal||0)}</td>
                <td style="padding:7px; border-bottom:1px solid #eee; text-align:right; font-weight:bold; color:#e74c3c;">${dinero(c.saldoActual||0)}</td>
                <td style="padding:7px; border-bottom:1px solid #eee;">${c.estado||''}</td>
            </tr>`;
        });
        if (datos.length === 0) html += `<tr><td colspan="6" style="padding:20px; text-align:center; color:#718096;">Sin registros</td></tr>`;
        html += '</tbody></table></div>';

    } else if (tipo === "pagar") {
        const datos = (cuentasPorPagar || []).filter(c => enRango(c.fecha));
        const total = datos.reduce((s, c) => s + (c.saldo || c.total || 0), 0);
        html = `<h3 style="color:#1a3a70; margin-bottom:15px;">💰 Cuentas por Pagar</h3>
            <p style="margin-bottom:15px;"><strong>Saldo total:</strong> ${dinero(total)} — <strong>${datos.length} registro(s)</strong></p>
            <div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead><tr style="background:#1a3a70; color:white;">
                <th style="padding:8px;">Proveedor</th><th style="padding:8px;">Fecha</th>
                <th style="padding:8px;">Total</th><th style="padding:8px;">Saldo</th><th style="padding:8px;">Estado</th>
            </tr></thead><tbody>`;
        datos.forEach((c, i) => {
            html += `<tr style="background:${i%2===0?'white':'#f9fafb'};">
                <td style="padding:7px; border-bottom:1px solid #eee;">${c.proveedor||''}</td>
                <td style="padding:7px; border-bottom:1px solid #eee;">${c.fecha||''}</td>
                <td style="padding:7px; border-bottom:1px solid #eee; text-align:right;">${dinero(c.total||0)}</td>
                <td style="padding:7px; border-bottom:1px solid #eee; text-align:right; font-weight:bold; color:#e74c3c;">${dinero(c.saldo||c.total||0)}</td>
                <td style="padding:7px; border-bottom:1px solid #eee;">${c.estado||'Pendiente'}</td>
            </tr>`;
        });
        if (datos.length === 0) html += `<tr><td colspan="5" style="padding:20px; text-align:center; color:#718096;">Sin registros</td></tr>`;
        html += '</tbody></table></div>';

    } else if (tipo === "inventario") {
        html = `<h3 style="color:#1a3a70; margin-bottom:15px;">📦 Inventario</h3>
            <p style="margin-bottom:15px;"><strong>${productos.length} productos</strong> en catálogo</p>
            <div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead><tr style="background:#1a3a70; color:white;">
                <th style="padding:8px;">Producto</th><th style="padding:8px;">Categoría</th>
                <th style="padding:8px;">Subcategoría</th><th style="padding:8px;">Stock</th>
                <th style="padding:8px;">Costo</th><th style="padding:8px;">Precio</th>
            </tr></thead><tbody>`;
        productos.forEach((p, i) => {
            const colorStock = (p.stock || 0) > 0 ? '#27ae60' : '#e74c3c';
            html += `<tr style="background:${i%2===0?'white':'#f9fafb'};">
                <td style="padding:7px; border-bottom:1px solid #eee;">${p.nombre}</td>
                <td style="padding:7px; border-bottom:1px solid #eee;">${p.categoria||''}</td>
                <td style="padding:7px; border-bottom:1px solid #eee;">${p.subcategoria||''}</td>
                <td style="padding:7px; border-bottom:1px solid #eee; text-align:center; font-weight:bold; color:${colorStock};">${p.stock||0}</td>
                <td style="padding:7px; border-bottom:1px solid #eee; text-align:right;">${dinero(p.costo||0)}</td>
                <td style="padding:7px; border-bottom:1px solid #eee; text-align:right; font-weight:bold;">${dinero(p.precio||0)}</td>
            </tr>`;
        });
        if (productos.length === 0) html += `<tr><td colspan="6" style="padding:20px; text-align:center; color:#718096;">Sin productos</td></tr>`;
        html += '</tbody></table></div>';

    } else if (tipo === "clientes") {
        html = `<h3 style="color:#1a3a70; margin-bottom:15px;">👥 Clientes</h3>
            <p style="margin-bottom:15px;"><strong>${clientes.length} clientes</strong> registrados</p>
            <div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead><tr style="background:#1a3a70; color:white;">
                <th style="padding:8px;">Nombre</th><th style="padding:8px;">Teléfono</th>
                <th style="padding:8px;">Dirección</th><th style="padding:8px;">Fecha Registro</th>
            </tr></thead><tbody>`;
        clientes.forEach((c, i) => {
            html += `<tr style="background:${i%2===0?'white':'#f9fafb'};">
                <td style="padding:7px; border-bottom:1px solid #eee;">${c.nombre||''}</td>
                <td style="padding:7px; border-bottom:1px solid #eee;">${c.telefono||''}</td>
                <td style="padding:7px; border-bottom:1px solid #eee;">${c.direccion||''}</td>
                <td style="padding:7px; border-bottom:1px solid #eee;">${c.fechaRegistro||''}</td>
            </tr>`;
        });
        if (clientes.length === 0) html += `<tr><td colspan="4" style="padding:20px; text-align:center; color:#718096;">Sin clientes</td></tr>`;
        html += '</tbody></table></div>';
    }

    contenedor.innerHTML = html;
}

function exportarReporte() {
    const tipo = document.getElementById("tipoReporte")?.value || "reporte";
    const contenedor = document.getElementById("contenidoReporte");
    if (!contenedor || !contenedor.innerHTML.trim()) {
        actualizarReporte();
    }

    let filas = [];
    const nombreArchivo = `reporte_${tipo}_${new Date().toLocaleDateString('es-MX').replace(/\//g,'-')}.csv`;

    if (tipo === "ventas") {
        filas.push(["Folio","Cliente","Fecha","Total","Método","Estado"]);
        (cuentasPorCobrar || []).forEach(c => {
            filas.push([c.folio||'', c.nombre||'', c.fechaVenta ? new Date(c.fechaVenta).toLocaleDateString('es-MX') : '', c.totalContadoOriginal||0, c.metodo||'', c.estado||'']);
        });
    } else if (tipo === "compras") {
        filas.push(["Folio","Proveedor","Fecha","Total","Método Pago"]);
        (compras || []).forEach(c => {
            filas.push([c.folio||c.id||'', c.proveedor||'', c.fecha||'', c.total||0, c.metodoPago||'']);
        });
    } else if (tipo === "cobrar") {
        filas.push(["Folio","Cliente","Fecha","Total Original","Saldo","Estado"]);
        (cuentasPorCobrar || []).forEach(c => {
            filas.push([c.folio||'', c.nombre||'', c.fechaVenta ? new Date(c.fechaVenta).toLocaleDateString('es-MX') : '', c.totalContadoOriginal||0, c.saldoActual||0, c.estado||'']);
        });
    } else if (tipo === "pagar") {
        filas.push(["Proveedor","Fecha","Total","Saldo","Estado"]);
        (cuentasPorPagar || []).forEach(c => {
            filas.push([c.proveedor||'', c.fecha||'', c.total||0, c.saldo||c.total||0, c.estado||'Pendiente']);
        });
    } else if (tipo === "inventario") {
        filas.push(["Producto","Categoría","Subcategoría","Stock","Costo","Precio"]);
        (productos || []).forEach(p => {
            filas.push([p.nombre||'', p.categoria||'', p.subcategoria||'', p.stock||0, p.costo||0, p.precio||0]);
        });
    } else if (tipo === "clientes") {
        filas.push(["Nombre","Teléfono","Dirección","Fecha Registro"]);
        (clientes || []).forEach(c => {
            filas.push([c.nombre||'', c.telefono||'', c.direccion||'', c.fechaRegistro||'']);
        });
    }

    if (filas.length === 0) {
        alert("No hay datos para exportar.");
        return;
    }

    const csvContent = filas.map(row => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

window.actualizarReporte = actualizarReporte;
window.exportarReporte = exportarReporte;
