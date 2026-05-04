// ===== MÓDULO DE INVENTARIO AVANZADO =====
// Consultas y análisis de inventario por sucursal y color.
// NO modifica ni reemplaza inventario.js — es una extensión pura.

// ── Actualizar stock por sucursal ─────────────────────────────────────────────
/**
 * Registra o actualiza el stock de un producto en una sucursal/color específico.
 * @param {string|number} productoId
 * @param {string} sucursalId
 * @param {string} color
 * @param {number} cantidad  (positivo = entrada, negativo = salida)
 * @param {string} tipo      'entrada' | 'salida'
 */
function actualizarStockSucursal(productoId, sucursalId, color, cantidad, tipo) {
    const prods = StorageService.get('productos', []);
    const idx = prods.findIndex(p => String(p.id) === String(productoId));
    if (idx === -1) return;

    const p = prods[idx];
    if (!p.stockPorSucursal) p.stockPorSucursal = {};
    if (!p.stockPorSucursal[sucursalId]) p.stockPorSucursal[sucursalId] = [];

    const colorKey = (color || 'Sin color').trim();
    const varIdx = p.stockPorSucursal[sucursalId].findIndex(
        v => v.color.toLowerCase() === colorKey.toLowerCase()
    );

    if (varIdx !== -1) {
        if (tipo === 'entrada') {
            p.stockPorSucursal[sucursalId][varIdx].stock =
                (p.stockPorSucursal[sucursalId][varIdx].stock || 0) + cantidad;
        } else {
            p.stockPorSucursal[sucursalId][varIdx].stock =
                Math.max(0, (p.stockPorSucursal[sucursalId][varIdx].stock || 0) - cantidad);
        }
    } else {
        p.stockPorSucursal[sucursalId].push({
            color: colorKey,
            stock: tipo === 'entrada' ? cantidad : 0
        });
    }

    prods[idx] = p;
    StorageService.set('productos', prods);
    if (typeof window !== 'undefined') window.productos = prods;
}

// ── Consultas ─────────────────────────────────────────────────────────────────
/**
 * Devuelve el stock de un producto agrupado por sucursal y color.
 */
function consultarStockProducto(productoId) {
    const prods = StorageService.get('productos', []);
    const p = prods.find(x => String(x.id) === String(productoId));
    if (!p) return null;
    return {
        productoId: p.id,
        nombre: p.nombre,
        stockGlobal: p.stock || 0,
        stockPorSucursal: p.stockPorSucursal || {}
    };
}

/**
 * Devuelve todos los productos con su stock en una sucursal determinada.
 */
function consultarStockPorSucursal(sucursalId) {
    const prods = StorageService.get('productos', []);
    return prods.map(p => {
        const variantes = (p.stockPorSucursal || {})[sucursalId] || [];
        const totalSucursal = variantes.reduce((s, v) => s + (v.stock || 0), 0);
        return {
            productoId: p.id,
            nombre: p.nombre,
            categoria: p.categoria,
            subcategoria: p.subcategoria,
            stockGlobal: p.stock || 0,
            stockSucursal: totalSucursal,
            variantes
        };
    });
}

/**
 * Devuelve el stock total de cada color (en todas las sucursales o en una específica).
 */
function consultarStockPorColor(sucursalId = null) {
    const prods = StorageService.get('productos', []);
    const mapa = {};

    prods.forEach(p => {
        const sucursales = sucursalId
            ? { [sucursalId]: (p.stockPorSucursal || {})[sucursalId] || [] }
            : (p.stockPorSucursal || {});

        Object.values(sucursales).forEach(variantes => {
            (variantes || []).forEach(v => {
                const c = (v.color || 'Sin color').trim();
                if (!mapa[c]) mapa[c] = 0;
                mapa[c] += v.stock || 0;
            });
        });
    });

    return Object.entries(mapa).map(([color, total]) => ({ color, total }))
        .sort((a, b) => b.total - a.total);
}

/**
 * Devuelve los movimientos de inventario filtrados por sucursal.
 */
function consultarMovimientosPorSucursal(sucursalId) {
    const movs = StorageService.get('movimientosInventario', []);
    return movs.filter(m => m.sucursalId === sucursalId || m.sucursalDestino === sucursalId);
}

// ── Vista de análisis ─────────────────────────────────────────────────────────
function initInventarioAvanzado() {
    // Poblar selector de sucursales en la vista
    _poblarSelectorSucursalAnalisis();
    renderAnalisisInventario();
}

function _poblarSelectorSucursalAnalisis() {
    const selSuc = document.getElementById('filtroSucursalAnalisis');
    if (!selSuc) return;
    const lista = (typeof obtenerSucursales === 'function') ? obtenerSucursales() : [];
    selSuc.innerHTML = `<option value="">🏢 Todas las sucursales</option>` +
        lista.map(s => `<option value="${s.id}">${s.nombre}</option>`).join('');
}

function renderAnalisisInventario() {
    const cont = document.getElementById('contenidoAnalisisInventario');
    if (!cont) return;

    const sucursalId = document.getElementById('filtroSucursalAnalisis')?.value || '';
    const colorFiltro = (document.getElementById('filtroColorAnalisis')?.value || '').trim().toLowerCase();
    const catFiltro  = document.getElementById('filtroCatAnalisis')?.value || '';

    const prods = StorageService.get('productos', []);
    const lista = (typeof obtenerSucursales === 'function') ? obtenerSucursales() : [];

    // Calcular tabla de stock por sucursal / color
    let filas = [];
    prods.forEach(p => {
        if (catFiltro && p.categoria !== catFiltro) return;
        const sucData = sucursalId
            ? { [sucursalId]: (p.stockPorSucursal || {})[sucursalId] || [] }
            : (p.stockPorSucursal || {});

        Object.entries(sucData).forEach(([sid, variantes]) => {
            const sucNombre = lista.find(s => s.id === sid)?.nombre || sid;
            (variantes || []).forEach(v => {
                const c = (v.color || 'Sin color').trim();
                if (colorFiltro && !c.toLowerCase().includes(colorFiltro)) return;
                filas.push({
                    producto: p.nombre,
                    categoria: p.categoria || '—',
                    subcategoria: p.subcategoria || '—',
                    sucursal: sucNombre,
                    color: c,
                    stock: v.stock || 0,
                    precio: p.precio || 0,
                    valorTotal: (v.stock || 0) * (p.precio || 0)
                });
            });
        });

        // Productos sin stockPorSucursal — mostrar con stock global
        if (!p.stockPorSucursal || Object.keys(p.stockPorSucursal).length === 0) {
            if (catFiltro && p.categoria !== catFiltro) return;
            const c = p.color || 'Sin color';
            if (colorFiltro && !c.toLowerCase().includes(colorFiltro)) return;
            const sucDef = lista[0];
            if (sucursalId && sucDef && sucursalId !== sucDef.id) return;
            filas.push({
                producto: p.nombre,
                categoria: p.categoria || '—',
                subcategoria: p.subcategoria || '—',
                sucursal: sucDef?.nombre || 'Casa Matriz',
                color: c,
                stock: p.stock || 0,
                precio: p.precio || 0,
                valorTotal: (p.stock || 0) * (p.precio || 0)
            });
        }
    });

    if (filas.length === 0) {
        cont.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:40px;">Sin datos de inventario para mostrar.</p>';
        return;
    }

    const totalValor = filas.reduce((s, f) => s + f.valorTotal, 0);
    const totalUnidades = filas.reduce((s, f) => s + f.stock, 0);

    const rows = filas.map(f => `<tr style="border-bottom:1px solid #f3f4f6;">
        <td style="padding:9px 10px;">${f.producto}</td>
        <td style="padding:9px 10px;color:#6b7280;font-size:13px;">${f.categoria}</td>
        <td style="padding:9px 10px;color:#6b7280;font-size:13px;">${f.subcategoria}</td>
        <td style="padding:9px 10px;">${f.sucursal}</td>
        <td style="padding:9px 10px;">
            <span style="display:inline-block;padding:2px 10px;border-radius:12px;background:#f1f5f9;font-size:12px;">${f.color}</span>
        </td>
        <td style="padding:9px 10px;text-align:center;font-weight:bold;color:${f.stock > 0 ? '#16a34a' : '#dc2626'};">${f.stock}</td>
        <td style="padding:9px 10px;text-align:right;">${dinero(f.valorTotal)}</td>
    </tr>`).join('');

    cont.innerHTML = `
    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:20px;">
        <div style="background:#eff6ff;border-radius:10px;padding:16px;text-align:center;">
            <div style="font-size:11px;color:#3b82f6;font-weight:bold;text-transform:uppercase;margin-bottom:4px;">Registros</div>
            <div style="font-size:26px;font-weight:bold;color:#1e40af;">${filas.length}</div>
        </div>
        <div style="background:#f0fdf4;border-radius:10px;padding:16px;text-align:center;">
            <div style="font-size:11px;color:#16a34a;font-weight:bold;text-transform:uppercase;margin-bottom:4px;">Total Unidades</div>
            <div style="font-size:26px;font-weight:bold;color:#15803d;">${totalUnidades}</div>
        </div>
        <div style="background:#fef3c7;border-radius:10px;padding:16px;text-align:center;">
            <div style="font-size:11px;color:#d97706;font-weight:bold;text-transform:uppercase;margin-bottom:4px;">Valor de Inventario</div>
            <div style="font-size:22px;font-weight:bold;color:#b45309;">${dinero(totalValor)}</div>
        </div>
    </div>

    <!-- Tabla -->
    <div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
            <tr style="background:#f8fafc;text-align:left;">
                <th style="padding:10px;color:#6b7280;font-weight:600;font-size:12px;text-transform:uppercase;">Producto</th>
                <th style="padding:10px;color:#6b7280;font-weight:600;font-size:12px;text-transform:uppercase;">Categoría</th>
                <th style="padding:10px;color:#6b7280;font-weight:600;font-size:12px;text-transform:uppercase;">Subcategoría</th>
                <th style="padding:10px;color:#6b7280;font-weight:600;font-size:12px;text-transform:uppercase;">Sucursal</th>
                <th style="padding:10px;color:#6b7280;font-weight:600;font-size:12px;text-transform:uppercase;">Color</th>
                <th style="padding:10px;color:#6b7280;font-weight:600;font-size:12px;text-transform:uppercase;text-align:center;">Stock</th>
                <th style="padding:10px;color:#6b7280;font-weight:600;font-size:12px;text-transform:uppercase;text-align:right;">Valor</th>
            </tr>
        </thead>
        <tbody>${rows}</tbody>
    </table>
    </div>`;
}

// ── Resumen por color ─────────────────────────────────────────────────────────
function renderResumenPorColor() {
    const cont = document.getElementById('contenidoResumenColor');
    if (!cont) return;

    const sucursalId = document.getElementById('filtroSucursalAnalisis')?.value || null;
    const datos = consultarStockPorColor(sucursalId || null);

    if (datos.length === 0) {
        cont.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:20px;">Sin datos.</p>';
        return;
    }

    const maxVal = datos[0].total;
    const filas = datos.map(d => {
        const pct = maxVal > 0 ? Math.round((d.total / maxVal) * 100) : 0;
        return `<tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:9px 10px;font-weight:500;">${d.color}</td>
            <td style="padding:9px 10px;">
                <div style="background:#e2e8f0;border-radius:4px;height:16px;overflow:hidden;">
                    <div style="background:#3b82f6;height:100%;width:${pct}%;border-radius:4px;"></div>
                </div>
            </td>
            <td style="padding:9px 10px;text-align:right;font-weight:bold;color:#1e40af;">${d.total}</td>
        </tr>`;
    }).join('');

    cont.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead><tr style="background:#f8fafc;">
            <th style="padding:10px;text-align:left;color:#6b7280;font-size:12px;text-transform:uppercase;">Color</th>
            <th style="padding:10px;color:#6b7280;font-size:12px;text-transform:uppercase;">Distribución</th>
            <th style="padding:10px;text-align:right;color:#6b7280;font-size:12px;text-transform:uppercase;">Unidades</th>
        </tr></thead>
        <tbody>${filas}</tbody>
    </table>`;
}

// ── Poblar filtro de categorías ───────────────────────────────────────────────
function poblarFiltroCategoriasAnalisis() {
    const sel = document.getElementById('filtroCatAnalisis');
    if (!sel) return;
    const cats = (typeof categoriasData !== 'undefined' ? categoriasData : StorageService.get('categoriasData', []));
    sel.innerHTML = `<option value="">Todas las categorías</option>` +
        cats.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('');
}

// ── Exposición global ─────────────────────────────────────────────────────────
window.actualizarStockSucursal      = actualizarStockSucursal;
window.consultarStockProducto       = consultarStockProducto;
window.consultarStockPorSucursal    = consultarStockPorSucursal;
window.consultarStockPorColor       = consultarStockPorColor;
window.consultarMovimientosPorSucursal = consultarMovimientosPorSucursal;
window.initInventarioAvanzado       = initInventarioAvanzado;
window.renderAnalisisInventario     = renderAnalisisInventario;
window.renderResumenPorColor        = renderResumenPorColor;
window.poblarFiltroCategoriasAnalisis = poblarFiltroCategoriasAnalisis;
