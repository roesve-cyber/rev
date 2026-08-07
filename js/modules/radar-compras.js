// ===== RADAR DE REPOSICIÓN =====
// Responde: ¿qué producto me hace falta comprar? (exacto o categoría similar,
// lo tenga o no en el lineal). Lee SIEMPRE datos vivos vía StorageService
// (IndexedDB + Firestore sync), nunca un backup estático.
// No depende de módulos externos ajenos al sistema (no hay búsqueda web
// disponible en este entorno); el "proveedor sugerido" sale del historial
// real de compras/costos del propio negocio.

(function () {
    const money = (v) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(v) || 0);
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
    const norm = (v) => String(v || '').trim().toUpperCase();

    const STOPWORDS = new Set(['DE', 'CON', 'PARA', 'COLOR', 'MOD', 'MODELO', 'EL', 'LA', 'LOS', 'LAS', 'Y', 'PIEZAS', 'PZA', 'PZAS', 'GENERAL']);

    window._radarComprasState = window._radarComprasState || { rangoDias: 30, busqueda: '', mesesCobertura: 2 };

    function arr(key) {
        const val = StorageService.get(key, []);
        return typeof _comprasAsegurarArray === 'function' ? _comprasAsegurarArray(val) : (Array.isArray(val) ? val : []);
    }

    // Reusa los parsers de fecha "blindados" del sistema si existen.
    function parseFechaFlexible(value) {
        if (!value) return null;
        if (window.parseFechaMXOrNull) {
            try { const d = window.parseFechaMXOrNull(value); if (d instanceof Date && !isNaN(d.getTime())) return d; } catch (e) {}
        }
        const raw = String(value).trim();
        let m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
        m = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
        if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12);
        const d = new Date(raw);
        return isNaN(d.getTime()) ? null : d;
    }

    function fechaVentaDe(venta) {
        return parseFechaFlexible(venta.fechaVenta) || parseFechaFlexible(venta.fecha);
    }

    // Mapa palabra clave -> {categoria, subcategoria} construido a partir del propio catálogo,
    // así siempre queda sincronizado con las categorías reales del negocio.
    function construirMapaPalabras(productos) {
        const conteo = {};
        productos.forEach(p => {
            const nombre = norm(p.nombre);
            const primeraPalabra = nombre.split(/\s+/).find(w => w.length >= 4 && !STOPWORDS.has(w));
            if (!primeraPalabra) return;
            const key = primeraPalabra;
            const catKey = `${p.categoria || ''}|||${p.subcategoria || ''}`;
            conteo[key] = conteo[key] || {};
            conteo[key][catKey] = (conteo[key][catKey] || 0) + 1;
        });
        const mapa = {};
        Object.entries(conteo).forEach(([palabra, cats]) => {
            const mejor = Object.entries(cats).sort((a, b) => b[1] - a[1])[0][0];
            const [categoria, subcategoria] = mejor.split('|||');
            mapa[palabra] = { categoria: categoria || 'Sin categoría', subcategoria: subcategoria || '' };
        });
        return mapa;
    }

    function sugerirCategoria(nombre, mapaPalabras) {
        const palabras = norm(nombre).split(/\s+/);
        for (const w of palabras) {
            if (w.length >= 4 && !STOPWORDS.has(w) && mapaPalabras[w]) return mapaPalabras[w];
        }
        return null;
    }

    // Último proveedor/costo real con el que se compró este producto (historialCostos -> compras).
    function ultimoProveedorDe(productoId, historialCostos, compras) {
        const candidatos = historialCostos
            .filter(h => String(h.productoId) === String(productoId))
            .map(h => ({ fecha: parseFechaFlexible(h.fecha) || new Date(0), proveedor: h.proveedorNombre, costo: h.precioCompra }));
        compras.forEach(c => {
            (c.articulos || []).forEach(a => {
                if (String(a.productoId) === String(productoId)) {
                    candidatos.push({ fecha: parseFechaFlexible(c.fechaISO || c.fecha) || new Date(0), proveedor: c.proveedor, costo: a.costo });
                }
            });
        });
        if (!candidatos.length) return null;
        candidatos.sort((a, b) => b.fecha - a.fecha);
        return candidatos[0];
    }

    function kpi(title, value, color, foot = '') {
        return `<div style="background:white;border:1px solid #e2e8f0;border-left:4px solid ${color};border-radius:8px;padding:15px;min-width:0;">
            <div style="font-size:11px;font-weight:900;color:#64748b;text-transform:uppercase;">${title}</div>
            <div style="font-size:23px;font-weight:900;color:${color};margin-top:5px;overflow-wrap:anywhere;">${value}</div>
            ${foot ? `<div style="font-size:12px;color:#64748b;margin-top:4px;">${foot}</div>` : ''}
        </div>`;
    }

    function badge(text, bg, color) {
        return `<span style="display:inline-flex;padding:3px 9px;border-radius:999px;background:${bg};color:${color};font-size:11px;font-weight:900;white-space:nowrap;">${esc(text)}</span>`;
    }

    window.renderRadarCompras = function () {
        const app = document.getElementById('radarComprasApp');
        if (!app) return;

        const rangoSel = document.getElementById('radarRangoDias');
        const buscSel = document.getElementById('radarBusqueda');
        const coberturaSel = document.getElementById('radarMesesCobertura');
        if (rangoSel) window._radarComprasState.rangoDias = Number(rangoSel.value) || 30;
        if (buscSel) window._radarComprasState.busqueda = buscSel.value || '';
        if (coberturaSel) window._radarComprasState.mesesCobertura = Number(coberturaSel.value) || 2;
        const rangoDias = window._radarComprasState.rangoDias;
        const busqueda = norm(window._radarComprasState.busqueda);

        const productos = arr('productos');
        const ventasTodas = arr('ventasRegistradas');
        const requisiciones = arr('requisicionesCompra');
        const historialCostos = arr('historialCostos');
        const compras = arr('compras');

        const hoy = new Date();
        const desde = new Date(hoy);
        desde.setDate(desde.getDate() - rangoDias);

        const ventas = ventasTodas.filter(v => v.estado !== 'Cancelada' && v.estatus !== 'Cancelada');

        const prodByName = {};
        productos.forEach(p => { prodByName[norm(p.nombre)] = p; });

        const mapaPalabras = construirMapaPalabras(productos);

        // --- Agregación de ventas en el rango ---
        const ventaAgg = {}; // nombreNorm -> {qty, rev, nombre, ultimaFecha}
        ventas.forEach(v => {
            const fv = fechaVentaDe(v);
            if (!fv || fv < desde) return;
            (v.articulos || []).forEach(a => {
                const nm = norm(a.nombre);
                if (!nm) return;
                if (!ventaAgg[nm]) ventaAgg[nm] = { qty: 0, rev: 0, nombre: a.nombre, ultimaFecha: fv };
                ventaAgg[nm].qty += Number(a.cantidad) || 0;
                ventaAgg[nm].rev += (Number(a.precio) || 0) * (Number(a.cantidad) || 0);
                if (fv > ventaAgg[nm].ultimaFecha) ventaAgg[nm].ultimaFecha = fv;
            });
        });

        // --- 1. Reposición urgente: catalogados, con ventas en el rango, cobertura por debajo del objetivo ---
        // Clave: NO se repone "lo vendido en la ventana completa" (eso sobre-compra en rangos largos),
        // se convierte a una VELOCIDAD MENSUAL y se compra solo lo necesario para alcanzar
        // "mesesCobertura" de inventario — así nunca se sugiere stock que tardaría varios meses en moverse.
        const mesesCobertura = window._radarComprasState.mesesCobertura || 2;
        const factorMes = 30 / rangoDias;
        const reposicion = [];
        Object.entries(ventaAgg).forEach(([nm, agg]) => {
            const p = prodByName[nm];
            if (!p) return;
            const stock = Number(p.stock) || 0;
            const ventaMensual = agg.qty * factorMes;
            if (ventaMensual <= 0) return;
            const coberturaActual = stock / ventaMensual; // en meses
            if (coberturaActual >= mesesCobertura) return; // ya tiene stock suficiente para el objetivo: no urge
            const objetivoUnidades = ventaMensual * mesesCobertura;
            const sugeridoComprar = Math.max(Math.round(objetivoUnidades - stock), 0);
            if (sugeridoComprar <= 0) return;
            const ultimo = ultimoProveedorDe(p.id, historialCostos, compras);
            const costoRef = ultimo?.costo ?? p.costo ?? 0;
            reposicion.push({
                nombre: p.nombre, categoria: p.categoria, subcategoria: p.subcategoria,
                vendidos: agg.qty, ventaMensual, stock, coberturaActual, costoRef, proveedor: ultimo?.proveedor || '',
                sugeridoComprar, inversion: sugeridoComprar * costoRef
            });
        });
        reposicion.sort((a, b) => a.coberturaActual - b.coberturaActual);

        // --- 2a. Requisiciones de compra pendientes (quiebres de stock ya detectados por el sistema) ---
        const requisicionesPendientes = requisiciones.filter(r => norm(r.estatus) === 'PENDIENTE');

        // --- 2b. Ventas de productos que NO existen en el catálogo actual ---
        const demandaNoCatalogada = [];
        Object.entries(ventaAgg).forEach(([nm, agg]) => {
            if (prodByName[nm]) return;
            const sugerido = sugerirCategoria(agg.nombre, mapaPalabras);
            demandaNoCatalogada.push({
                nombre: agg.nombre, vendidos: agg.qty, ingresos: agg.rev,
                categoriaSugerida: sugerido ? `${sugerido.categoria}${sugerido.subcategoria ? ' / ' + sugerido.subcategoria : ''}` : 'Sin coincidencia clara'
            });
        });
        demandaNoCatalogada.sort((a, b) => b.vendidos - a.vendidos);

        // --- 3. Categorías a vigilar (nivel subcategoría) ---
        const porSub = {};
        productos.forEach(p => {
            const key = `${p.categoria || 'Sin categoría'}|||${p.subcategoria || 'General'}`;
            porSub[key] = porSub[key] || { categoria: p.categoria || 'Sin categoría', subcategoria: p.subcategoria || 'General', skus: 0, stock: 0, vendidos: 0, sinStock: 0 };
            porSub[key].skus += 1;
            porSub[key].stock += Number(p.stock) || 0;
            if ((Number(p.stock) || 0) === 0) porSub[key].sinStock += 1;
        });
        Object.entries(ventaAgg).forEach(([nm, agg]) => {
            const p = prodByName[nm];
            if (!p) return;
            const key = `${p.categoria || 'Sin categoría'}|||${p.subcategoria || 'General'}`;
            if (porSub[key]) porSub[key].vendidos += agg.qty;
        });
        const categorias = Object.values(porSub)
            .filter(c => c.vendidos > 0)
            .sort((a, b) => (b.vendidos / Math.max(1, b.stock)) - (a.vendidos / Math.max(1, a.stock)));

        // --- Filtro de búsqueda (aplica a las 3 tablas) ---
        const filtro = (texto) => !busqueda || norm(texto).includes(busqueda);
        const reposicionF = reposicion.filter(r => filtro(r.nombre) || filtro(r.categoria));
        const demandaF = demandaNoCatalogada.filter(r => filtro(r.nombre) || filtro(r.categoriaSugerida));
        const requisPendF = requisicionesPendientes.filter(r => filtro(r.producto));
        const categoriasF = categorias.filter(c => filtro(c.categoria) || filtro(c.subcategoria));

        // --- KPIs ---
        const totalVendido = Object.values(ventaAgg).reduce((s, a) => s + a.qty, 0);
        const inversionTotal = reposicion.reduce((s, r) => s + r.inversion, 0);
        const demandaSinResolverCount = requisicionesPendientes.length + demandaNoCatalogada.length;

        app.innerHTML = `
        <div class="vista-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;gap:14px;flex-wrap:wrap;">
            <div>
                <h2 style="margin:0;color:#0f172a;">📡 Radar de Reposición</h2>
                <p style="color:#64748b;margin:4px 0 0;">Qué producto te hace falta comprar — exacto o de categoría similar, esté o no en tu lineal. Datos en vivo.</p>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
                <input type="search" id="radarBusqueda" value="${esc(window._radarComprasState.busqueda)}" placeholder="Buscar producto o categoría" onkeydown="if(event.key==='Enter')renderRadarCompras()" style="padding:9px;border:1px solid #cbd5e1;border-radius:6px;">
                <select id="radarRangoDias" onchange="renderRadarCompras()" style="padding:9px;border:1px solid #cbd5e1;border-radius:6px;">
                    <option value="15" ${rangoDias === 15 ? 'selected' : ''}>Últimos 15 días</option>
                    <option value="30" ${rangoDias === 30 ? 'selected' : ''}>Últimos 30 días</option>
                    <option value="60" ${rangoDias === 60 ? 'selected' : ''}>Últimos 60 días</option>
                    <option value="90" ${rangoDias === 90 ? 'selected' : ''}>Últimos 90 días</option>
                </select>
                <select id="radarMesesCobertura" onchange="renderRadarCompras()" title="Meses de inventario a mantener" style="padding:9px;border:1px solid #cbd5e1;border-radius:6px;">
                    <option value="1" ${mesesCobertura === 1 ? 'selected' : ''}>Cobertura: 1 mes</option>
                    <option value="1.5" ${mesesCobertura === 1.5 ? 'selected' : ''}>Cobertura: 1.5 meses</option>
                    <option value="2" ${mesesCobertura === 2 ? 'selected' : ''}>Cobertura: 2 meses</option>
                    <option value="3" ${mesesCobertura === 3 ? 'selected' : ''}>Cobertura: 3 meses</option>
                </select>
                <button onclick="renderRadarCompras()" style="padding:10px 18px;background:#2563eb;color:white;border:none;border-radius:7px;cursor:pointer;font-weight:bold;">Actualizar</button>
            </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:22px;">
            ${kpi('Unidades vendidas', totalVendido, '#2563eb', `Últimos ${rangoDias} días`)}
            ${kpi('Reposición urgente', reposicion.length, '#dc2626', 'Productos en catálogo con stock insuficiente')}
            ${kpi('Demanda sin resolver', demandaSinResolverCount, '#d97706', 'Requisiciones pendientes + ventas fuera de catálogo')}
            ${kpi('Inversión sugerida', money(inversionTotal), '#16a34a', 'Solo reposición urgente, a último costo conocido')}
        </div>

        <div style="background:white;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:20px;overflow:hidden;">
            <div style="padding:14px 16px;border-bottom:1px solid #e2e8f0;background:#fef2f2;">
                <strong style="color:#0f172a;">🔴 Reposición urgente</strong>
                <span style="color:#64748b;font-size:12px;"> — cobertura actual por debajo de ${mesesCobertura} ${mesesCobertura == 1 ? 'mes' : 'meses'}. La cantidad a comprar es solo la necesaria para llegar a ese objetivo, no lo vendido en todo el rango.</span>
            </div>
            <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead><tr style="background:#f8fafc;text-align:left;">
                    <th style="padding:9px 12px;">Producto</th><th style="padding:9px 12px;">Categoría</th>
                    <th style="padding:9px 12px;text-align:center;">Venta/mes</th><th style="padding:9px 12px;text-align:center;">Stock</th>
                    <th style="padding:9px 12px;text-align:center;">Cobertura actual</th>
                    <th style="padding:9px 12px;text-align:center;">Comprar</th><th style="padding:9px 12px;">Último proveedor</th>
                    <th style="padding:9px 12px;text-align:right;">Costo ref.</th><th style="padding:9px 12px;text-align:right;">Inversión</th>
                </tr></thead>
                <tbody>
                ${reposicionF.length ? reposicionF.map(r => `
                    <tr style="border-top:1px solid #f1f5f9;">
                        <td style="padding:9px 12px;font-weight:700;color:#0f172a;">${esc(r.nombre)}</td>
                        <td style="padding:9px 12px;color:#64748b;">${esc(r.categoria)}${r.subcategoria ? ' / ' + esc(r.subcategoria) : ''}</td>
                        <td style="padding:9px 12px;text-align:center;">${r.ventaMensual.toFixed(1)}</td>
                        <td style="padding:9px 12px;text-align:center;">${badge(r.stock, r.stock === 0 ? '#fee2e2' : '#fef3c7', r.stock === 0 ? '#991b1b' : '#92400e')}</td>
                        <td style="padding:9px 12px;text-align:center;">${r.coberturaActual.toFixed(1)} mes${r.coberturaActual.toFixed(1) == 1 ? '' : 'es'}</td>
                        <td style="padding:9px 12px;text-align:center;font-weight:900;color:#16a34a;">${r.sugeridoComprar}</td>
                        <td style="padding:9px 12px;">${esc(r.proveedor) || '<span style="color:#94a3b8;">Sin historial</span>'}</td>
                        <td style="padding:9px 12px;text-align:right;">${money(r.costoRef)}</td>
                        <td style="padding:9px 12px;text-align:right;font-weight:700;">${money(r.inversion)}</td>
                    </tr>`).join('') : `<tr><td colspan="9" style="padding:20px;text-align:center;color:#94a3b8;">Sin quiebres de cobertura detectados en este rango.</td></tr>`}
                </tbody>
            </table>
            </div>
        </div>

        <div style="background:white;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:20px;overflow:hidden;">
            <div style="padding:14px 16px;border-bottom:1px solid #e2e8f0;background:#fffbeb;">
                <strong style="color:#0f172a;">🟠 Requisiciones pendientes</strong>
                <span style="color:#64748b;font-size:12px;"> — ventas que se perdieron por falta de stock y siguen sin resolverse</span>
            </div>
            <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead><tr style="background:#f8fafc;text-align:left;">
                    <th style="padding:9px 12px;">Producto</th><th style="padding:9px 12px;">Fecha</th>
                    <th style="padding:9px 12px;text-align:center;">Cantidad</th><th style="padding:9px 12px;">Folio venta</th>
                </tr></thead>
                <tbody>
                ${requisPendF.length ? requisPendF.map(r => `
                    <tr style="border-top:1px solid #f1f5f9;">
                        <td style="padding:9px 12px;font-weight:700;color:#0f172a;">${esc(r.producto)}</td>
                        <td style="padding:9px 12px;">${esc(r.fecha || '-')}</td>
                        <td style="padding:9px 12px;text-align:center;">${r.cantidad || 1}</td>
                        <td style="padding:9px 12px;color:#64748b;">${esc(r.folioVenta || '-')}</td>
                    </tr>`).join('') : `<tr><td colspan="4" style="padding:20px;text-align:center;color:#94a3b8;">Sin requisiciones pendientes.</td></tr>`}
                </tbody>
            </table>
            </div>
        </div>

        <div style="background:white;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:20px;overflow:hidden;">
            <div style="padding:14px 16px;border-bottom:1px solid #e2e8f0;background:#eff6ff;">
                <strong style="color:#0f172a;">🔵 Se vende pero no está en tu catálogo</strong>
                <span style="color:#64748b;font-size:12px;"> — oportunidad de producto nuevo o similar (categoría sugerida por coincidencia con tu propio catálogo)</span>
            </div>
            <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead><tr style="background:#f8fafc;text-align:left;">
                    <th style="padding:9px 12px;">Producto vendido</th><th style="padding:9px 12px;text-align:center;">Veces vendido</th>
                    <th style="padding:9px 12px;text-align:right;">Ingresos</th><th style="padding:9px 12px;">Categoría sugerida</th>
                </tr></thead>
                <tbody>
                ${demandaF.length ? demandaF.map(r => `
                    <tr style="border-top:1px solid #f1f5f9;">
                        <td style="padding:9px 12px;font-weight:700;color:#0f172a;">${esc(r.nombre)}</td>
                        <td style="padding:9px 12px;text-align:center;">${r.vendidos}</td>
                        <td style="padding:9px 12px;text-align:right;">${money(r.ingresos)}</td>
                        <td style="padding:9px 12px;">${badge(r.categoriaSugerida, '#dbeafe', '#1e40af')}</td>
                    </tr>`).join('') : `<tr><td colspan="4" style="padding:20px;text-align:center;color:#94a3b8;">Todo lo vendido en este rango ya está catalogado.</td></tr>`}
                </tbody>
            </table>
            </div>
        </div>

        <div style="background:white;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
            <div style="padding:14px 16px;border-bottom:1px solid #e2e8f0;background:#f8fafc;">
                <strong style="color:#0f172a;">📊 Categorías a vigilar</strong>
                <span style="color:#64748b;font-size:12px;"> — subcategorías donde la venta va más rápido que el stock disponible</span>
            </div>
            <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead><tr style="background:#f8fafc;text-align:left;">
                    <th style="padding:9px 12px;">Categoría / Subcategoría</th><th style="padding:9px 12px;text-align:center;">SKUs</th>
                    <th style="padding:9px 12px;text-align:center;">Stock total</th><th style="padding:9px 12px;text-align:center;">Sin stock</th>
                    <th style="padding:9px 12px;text-align:center;">Vendidos (rango)</th>
                </tr></thead>
                <tbody>
                ${categoriasF.length ? categoriasF.map(c => `
                    <tr style="border-top:1px solid #f1f5f9;">
                        <td style="padding:9px 12px;font-weight:700;color:#0f172a;">${esc(c.categoria)} / ${esc(c.subcategoria)}</td>
                        <td style="padding:9px 12px;text-align:center;">${c.skus}</td>
                        <td style="padding:9px 12px;text-align:center;">${c.stock}</td>
                        <td style="padding:9px 12px;text-align:center;">${badge(c.sinStock, c.sinStock > 0 ? '#fef3c7' : '#f1f5f9', c.sinStock > 0 ? '#92400e' : '#64748b')}</td>
                        <td style="padding:9px 12px;text-align:center;font-weight:700;">${c.vendidos}</td>
                    </tr>`).join('') : `<tr><td colspan="5" style="padding:20px;text-align:center;color:#94a3b8;">Sin ventas en categorías catalogadas en este rango.</td></tr>`}
                </tbody>
            </table>
            </div>
        </div>
        `;
    };
})();
