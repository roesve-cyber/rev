// ===== TIENDA / CATÁLOGO: VERSIÓN RESTAURADA Y FUNCIONAL =====

function mostrarProductos() {
    const contenedor = document.getElementById("gridProductos");
    if (!contenedor) return;

    // Grid de varios productos por fila
    contenedor.style.display = "grid";
    contenedor.style.gridTemplateColumns = "repeat(auto-fill, minmax(280px, 1fr))";
    contenedor.style.gap = "20px";
    contenedor.style.padding = "10px";

    const prods = window.productos || [];
    const searchSelect = window._filtroTiendaBuscador || '';

    // Encabezado con BUSCADOR y FILTROS
    let html = `
        <div style="grid-column: 1/-1; background: linear-gradient(135deg, #1a3a70 0%, #2c5282 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="display: grid; grid-template-columns: 1.5fr 1fr 1fr auto; gap: 15px; align-items: flex-end;">
                <div>
                    <label style="display: block; font-weight: bold; color: rgba(255,255,255,0.9); margin-bottom: 8px; font-size: 13px;">🔍 Buscar Producto</label>
                    <input type="text" id="buscadorTienda" value="${searchSelect}" placeholder="Nombre, marca o modelo..." 
                        oninput="window._filtroTiendaBuscador = this.value; filtrarCatalogo();"
                        style="width: 100%; padding: 10px; border: none; border-radius: 6px; font-size: 13px; color: #333;">
                </div>
                <div>
                    <label style="display: block; font-weight: bold; color: rgba(255,255,255,0.9); margin-bottom: 8px; font-size: 13px;">📦 Categoría</label>
                    <select id="filtroCatalogoCategoria" onchange="filtrarCatalogo()" style="width: 100%; padding: 10px; border: none; border-radius: 6px; font-size: 13px; color: #333;">
                        <option value="">-- Todas --</option>
                    </select>
                </div>
                <div>
                    <label style="display: block; font-weight: bold; color: rgba(255,255,255,0.9); margin-bottom: 8px; font-size: 13px;">🏷️ Subcategoría</label>
                    <select id="filtroCatalogoSubcategoria" onchange="filtrarCatalogo()" style="width: 100%; padding: 10px; border: none; border-radius: 6px; font-size: 13px; color: #333;">
                        <option value="">-- Todas --</option>
                    </select>
                </div>
                <button onclick="limpiarFiltrosCatalogo()" style="padding: 10px 15px; background: rgba(255,255,255,0.2); color: white; border: 2px solid white; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 13px;">🔄</button>
            </div>
        </div>
    `;

    contenedor.innerHTML = html;

    // Llenar selectores
    const categorias = [...new Set(prods.map(p => p.categoria).filter(Boolean))].sort();
    document.getElementById('filtroCatalogoCategoria').innerHTML = '<option value="">-- Todas --</option>' + 
        categorias.map(c => `<option value="${c}">${c}</option>`).join('');

    const subcategorias = [...new Set(prods.map(p => p.subcategoria).filter(Boolean))].sort();
    document.getElementById('filtroCatalogoSubcategoria').innerHTML = '<option value="">-- Todas --</option>' + 
        subcategorias.map(s => `<option value="${s}">${s}</option>`).join('');

    if (searchSelect) document.getElementById("buscadorTienda").focus();

    filtrarCatalogo();
}

function filtrarCatalogo() {
    const categoria = document.getElementById('filtroCatalogoCategoria')?.value || '';
    const subcategoria = document.getElementById('filtroCatalogoSubcategoria')?.value || '';
    const busqueda = (window._filtroTiendaBuscador || '').toLowerCase().trim();

    const filtrados = (window.productos || []).filter(p => {
        const matchCat = !categoria || p.categoria === categoria;
        const matchSub = !subcategoria || p.subcategoria === subcategoria;
        const textoComp = `${p.nombre} ${p.marca || ''} ${p.modelo || ''}`.toLowerCase();
        return matchCat && matchSub && (!busqueda || textoComp.includes(busqueda));
    });

    renderProductosCatalogo(filtrados);
}

function renderProductosCatalogo(lista) {
    const contenedor = document.getElementById("gridProductos");
    const encabezado = contenedor.querySelector('div[style*="grid-column: 1/-1"]');
    contenedor.innerHTML = '';
    if(encabezado) contenedor.appendChild(encabezado);

    lista.forEach(p => {
        const planes = CalculatorService.calcularCredito(p.precio || 0);
        const plan6 = planes[5] || planes[0]; // Plan estándar
        
        contenedor.innerHTML += `
            <div class="card-producto" style="background:white; border-radius:12px; padding:15px; border:1px solid #e2e8f0; display:flex; flex-direction:column; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                <div onclick="verProducto(${p.id})" style="cursor:pointer; height:150px; text-align:center; margin-bottom:10px;">
                    <img src="${p.imagen || ''}" style="max-width:100%; max-height:100%; object-fit:contain;">
                </div>
                <h3 style="margin:0; font-size:14px; color:#1e293b; height:40px; overflow:hidden;">${p.nombre}</h3>
                <p style="font-size:18px; font-weight:800; color:#1e3a8a; margin:10px 0;">${dinero(p.precio)}</p>
                <div style="background:#f0fdf4; padding:8px; border-radius:6px; border:1px solid #bbf7d0; text-align:center;">
                    <small style="color:#166534; font-size:10px; display:block; font-weight:bold;">PAGO SEMANAL:</small>
                    <span style="color:#15803d; font-size:15px; font-weight:800;">${dinero(plan6.abono)}</span>
                </div>
                <button onclick="verProducto(${p.id})" style="width:100%; margin-top:15px; padding:10px; background:#f1f5f9; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:12px;">👁️ Detalles</button>
            </div>`;
    });
}

// 🛡️ REPARACIÓN: EL SIMULADOR DE ENGANCHE REAL
window.actualizarSimuladorEnganche = function(precioOriginal) {
    const input = document.getElementById('engancheSimulado');
    const enganche = parseFloat(input.value) || 0;
    const saldoAFinanciar = Math.max(0, precioOriginal - enganche);

    // Actualizar resumen visual
    const resumen = document.getElementById('resumenEnganche');
    if (resumen) resumen.innerHTML = `Saldo a financiar: <strong>${dinero(saldoAFinanciar)}</strong>`;

    // Recalcular la tabla de planes
    const nuevosPlanes = CalculatorService.calcularCredito(saldoAFinanciar);
    const tbody = document.querySelector("#tablaPlanesSimulada tbody");
    if (tbody) {
        tbody.innerHTML = nuevosPlanes.map(plan => `
            <tr style="border-bottom: 1px solid #f0f0f0;">
                <td style="padding: 12px; text-align: center; font-weight: 600;">${plan.meses}</td>
                <td style="padding: 12px; text-align: center; color: #27ae60; font-weight: bold;">${dinero(plan.total)}</td>
                <td style="padding: 12px; text-align: center; color: #3498db; font-weight: 600;">${dinero(plan.abono)}</td>
            </tr>`).join('');
    }
};

// MODAL DE DOS COLUMNAS ORIGINAL
window.verProducto = function(id) {
    const p = window.productos.find(x => String(x.id) === String(id));
    if (!p) return;
    window.productoActualId = id;

    const modal = document.getElementById("modalProducto");
    const contenido = document.getElementById("contenidoProducto");
    if (!modal || !contenido) return;

    const planes = CalculatorService.calcularCredito(p.precio);
    
    contenido.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0; height: 90vh;">
            <div style="position: relative; background: #f5f7fa; display: flex; justify-content: center; align-items: center; overflow: hidden;">
                <img id="imgModal" src="${p.imagen || ''}" style="width: 100%; height: 100%; object-fit: contain; padding: 20px;">
            </div>
            <div style="display: flex; flex-direction: column; padding: 30px; background: white; overflow-y: auto;">
                <h2 style="margin: 0 0 15px 0; color: #2c3e50;">${p.nombre}</h2>
                <div style="background: #27ae60; color: white; padding: 15px; border-radius: 10px; margin-bottom: 20px; text-align: center;">
                    <small>Precio al Contado</small><h3>${dinero(p.precio)}</h3>
                </div>
                <div style="background: #fffbeb; border: 2px solid #f59e0b; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                    <h4 style="margin:0 0 10px 0; color: #92400e;">💡 Simula tu Enganche</h4>
                    <input type="number" id="engancheSimulado" oninput="actualizarSimuladorEnganche(${p.precio})" 
                           placeholder="Enganche $" style="width: 100%; padding: 10px; border: 2px solid #f59e0b; border-radius: 6px;">
                    <div id="resumenEnganche" style="margin-top:10px; text-align:center; font-size:13px; color:#78350f;">Saldo a financiar: <strong>${dinero(p.precio)}</strong></div>
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size:13px;" id="tablaPlanesSimulada">
                    <thead><tr style="background: #f8f9fa; border-bottom: 2px solid #e2e8f0;">
                        <th style="padding:10px;">Meses</th><th style="padding:10px;">Total</th><th style="padding:10px;">Abono</th>
                    </tr></thead>
                    <tbody>
                        ${planes.map(plan => `
                            <tr style="border-bottom: 1px solid #f0f0f0;">
                                <td style="padding: 12px; text-align: center; font-weight: 600;">${plan.meses}</td>
                                <td style="padding: 12px; text-align: center; color: #27ae60; font-weight: bold;">${dinero(plan.total)}</td>
                                <td style="padding: 12px; text-align: center; color: #3498db; font-weight: 600;">${dinero(plan.abono)}</td>
                            </tr>`).join('')}
                    </tbody>
                </table>
                <div style="display: flex; gap: 10px; margin-top: auto; padding-top: 20px;">
                    <button onclick="agregarAlCarritoDesdeModal()" style="flex: 2; padding: 14px; background: #27ae60; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">🛒 Agregar al Carrito</button>
                    <button onclick="cerrarProducto()" style="flex: 1; padding: 14px; background: #e2e8f0; border-radius: 8px; cursor: pointer;">✕ Cerrar</button>
                </div>
            </div>
        </div>`;
    modal.classList.remove("oculto");
    modal.style.display = 'flex';
};

window.limpiarFiltrosCatalogo = function() {
    window._filtroTiendaBuscador = '';
    mostrarProductos();
};

window.mostrarProductos = mostrarProductos;

function filtrarCatalogo() {
    const categoria = document.getElementById('filtroCatalogoCategoria')?.value || '';
    const subcategoria = document.getElementById('filtroCatalogoSubcategoria')?.value || '';
    const prods = StorageService.get("productos", []);

    if (categoria) actualizarSubcategoriasCatalogo(categoria);

    let filtrados = prods;
    if (categoria) filtrados = filtrados.filter(p => p.categoria === categoria);
    if (subcategoria) filtrados = filtrados.filter(p => p.subcategoria === subcategoria);

    renderProductosCatalogo(filtrados);
}

function actualizarSubcategoriasCatalogo(catNom) {
    const selectSub = document.getElementById('filtroCatalogoSubcategoria');
    if (!selectSub) return;
    const prods = StorageService.get("productos", []);
    let subs = [...new Set(prods.filter(p => p.categoria === catNom).map(p => p.subcategoria).filter(Boolean))].sort();
    selectSub.innerHTML = '<option value="">-- Todas las Subcategorías --</option>' + subs.map(s => `<option value="${s}">${s}</option>`).join('');
}

function limpiarFiltrosCatalogo() {
    document.getElementById('filtroCatalogoCategoria').value = '';
    document.getElementById('filtroCatalogoSubcategoria').value = '';
    mostrarProductos();
}

function agruparParaCatalogo(lista) {
    const mapa = {};
    lista.forEach(p => {
        const nombreStr = (p.nombre || "Sin nombre").trim().toUpperCase();
        if (!mapa[nombreStr]) {
            mapa[nombreStr] = {
                idPrincipal: p.id, 
                nombreOriginal: p.nombre,
                categoria: p.categoria,
                imagen: p.imagen,
                precioMin: p.precio,
                stockTotal: 0
            };
        }
        mapa[nombreStr].stockTotal += (Number(p.stock) || 0);
        if (p.precio < mapa[nombreStr].precioMin) mapa[nombreStr].precioMin = p.precio;
    });
    return Object.values(mapa);
}

function renderProductosCatalogo(listaProductos) {
    const contenedor = document.getElementById("gridProductos");
    if (!contenedor) return;

    const encabezado = contenedor.querySelector('div[style*="grid-column: 1 / -1"]');
    contenedor.innerHTML = '';
    if(encabezado) contenedor.appendChild(encabezado);

    const productosAgrupados = agruparParaCatalogo(listaProductos);

    if (productosAgrupados.length === 0) {
        contenedor.innerHTML += `<div style="grid-column: 1/-1; text-align: center; padding: 100px; color: #94a3b8;"><h3>No se encontraron productos</h3></div>`;
        return;
    }

    productosAgrupados.forEach(grupo => {
        let planes = [];
        try { planes = CalculatorService.calcularCredito(grupo.precioMin); } catch(e) {}
        if (!planes || planes.length === 0) planes = [{meses: 1, total: grupo.precioMin, abono: grupo.precioMin}];
        const plan6 = planes[5] || planes[planes.length - 1] || planes[0];

        const colorStock = grupo.stockTotal > 0 ? '#10b981' : '#f43f5e';
        const badgeStock = grupo.stockTotal > 0 ? `STOCK: ${grupo.stockTotal}` : `AGOTADO`;

        const cardHTML = `
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; flex-direction: column; height: 100%; box-shadow: 0 2px 4px rgba(0,0,0,0.05); overflow: hidden; box-sizing: border-box;">
                
                <div style="position: relative; height: 160px; background: #f8fafc; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid #f1f5f9;">
                    <div style="position: absolute; top: 10px; right: 10px; background: ${colorStock}; color: white; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 800; z-index: 5;">
                        ${badgeStock}
                    </div>
                    <img src="${grupo.imagen || ''}" style="max-width: 85%; max-height: 85%; object-fit: contain;" onerror="this.parentElement.innerHTML='<span style=\\'font-size:40px; color:#cbd5e1;\\'>📦</span>'">
                </div>

                <div style="padding: 15px; display: flex; flex-direction: column; flex-grow: 1; box-sizing: border-box;">
                    <h3 style="margin: 0 0 10px 0; font-size: 13px; color: #0f172a; font-weight: 700; line-height: 1.3; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;" title="${grupo.nombreOriginal}">
                        ${grupo.nombreOriginal}
                    </h3>
                    
                    <div style="margin-top: auto; padding-top: 10px; border-top: 1px solid #f1f5f9;">
                        <div style="font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase;">Precio Contado</div>
                        <div style="font-size: 18px; font-weight: 900; color: #16a34a;">${dinero(grupo.precioMin)}</div>
                        <div style="font-size: 11px; color: #2563eb; font-weight: 700; margin-top: 2px;">
                            💳 Pago: ${dinero(plan6.abono)}/sem
                        </div>
                    </div>

                    <button onclick="verProductoAgrupado('${grupo.idPrincipal}')" 
                            style="width: 100%; padding: 10px; margin-top: 15px; background: #0f172a; color: white; border: none; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; text-transform: uppercase;">
                        Ver Detalles
                    </button>
                </div>
            </div>
        `;
        contenedor.innerHTML += cardHTML;
    });
}

// 🎯 EL MODAL MAESTRO: DISEÑO FLUIDO Y ANTI-DESBORDES
window.verProductoAgrupado = function(idPrincipal) {
    const prods = StorageService.get("productos", []);
    const base = prods.find(p => String(p.id) === String(idPrincipal));
    if (!base) return;

    const nombre = (base.nombre || "").trim();
    const variantes = prods.filter(p => (p.nombre || "").trim().toUpperCase() === nombre.toUpperCase());
    if (variantes.length === 0) return;

    window.variantesActuales = variantes; 
    let pSel = variantes.find(v => Number(v.stock) > 0) || variantes[0];
    window.productoActualId = pSel.id;

    const modal = document.getElementById("modalProducto");
    const contenido = document.getElementById("contenidoProducto");
    if (!modal || !contenido) return;

    let htmlVars = `
        <div style="background:#f8fafc; padding:10px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:15px; box-sizing: border-box;">
            <h4 style="margin:0 0 8px; color:#1e40af; font-size:11px; text-transform:uppercase;">📦 Variantes Disponibles:</h4>
            <div style="display:flex; flex-direction:column; gap:6px; max-height:120px; overflow-y:auto; padding-right:5px; box-sizing: border-box;">
    `;
    
    variantes.forEach(v => {
        const isSel = v.id === pSel.id;
        const colorStk = Number(v.stock) > 0 ? '#16a34a' : '#ef4444';
        htmlVars += `
            <label id="lbl_var_${v.id}" style="display:flex; align-items:center; padding:8px; border:2px solid ${isSel ? '#3b82f6' : '#e2e8f0'}; border-radius:6px; cursor:pointer; background:${isSel ? '#eff6ff' : 'white'}; box-sizing: border-box;">
                <input type="radio" name="variante" value="${v.id}" onchange="cambiarVarianteModal(${v.id})" ${isSel?'checked':''} style="margin-right:8px;">
                <div style="flex:1; font-size:11px; color:#1e293b;">
                    <strong>${v.color || 'Único'}</strong> <span style="color:#64748b; margin-left:4px;">📍 ${v.ubicacion}</span>
                </div>
                <div style="text-align:right; font-weight:700; color:${colorStk}; font-size:10px;">
                    ${Number(v.stock)>0 ? v.stock+' disp.' : '❌ Agotado'}
                </div>
            </label>
        `;
    });
    htmlVars += `</div></div>`;

    // DISEÑO LÍQUIDO: Se adapta al alto y ancho sin romper
    contenido.innerHTML = `
        <div style="display: flex; flex-direction: row; width: 100%; max-width: 900px; height: 85vh; max-height: 800px; background: white; border-radius: 12px; overflow: hidden; margin: auto; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2); box-sizing: border-box;">
            
            <div style="flex: 1.2; display: flex; flex-direction: column; background: white; border-right: 1px solid #e2e8f0; box-sizing: border-box; overflow: hidden;">
                
                <div style="flex: 1; overflow-y: auto; padding: 20px; box-sizing: border-box;">
                    <h2 style="margin:0 0 6px; font-size:18px; color:#0f172a; line-height:1.2;">${nombre}</h2>
                    <div style="margin-bottom:15px; font-size:11px; color:#64748b;">
                        🏷️ Marca: <strong>${pSel.marca || '-'}</strong> &nbsp;|&nbsp; ⚙️ Mod: <strong>${pSel.modelo || '-'}</strong>
                    </div>

                    ${htmlVars}
                    
                    <input type="hidden" id="simuladorPrecioBase" value="${pSel.precio}">
                    
                    <div style="background:linear-gradient(135deg, #16a34a 0%, #15803d 100%); color:white; padding:15px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; box-sizing: border-box;">
                        <span style="font-size:11px; font-weight:bold; opacity:0.9; text-transform:uppercase;">Precio Contado</span>
                        <span id="modalPrecioDestacado" style="font-size:24px; font-weight:900;">${dinero(pSel.precio)}</span>
                    </div>

                    <div style="background:#fffbeb; border:2px solid #fef3c7; padding:15px; border-radius:8px; margin-bottom:15px; box-sizing: border-box;">
                        <h4 style="margin:0 0 10px; font-size:11px; color:#92400e; font-weight:800;">💡 SIMULADOR DE ENGANCHE</h4>
                        <div style="display:flex; gap:10px;">
                            <div style="flex: 1;">
                                <label style="font-size:10px; font-weight:bold; color:#92400e; display:block; margin-bottom:4px;">EFECTIVO ($)</label>
                                <input type="number" id="engancheSimulado" oninput="actualizarSimuladorEnganche()" style="width:100%; padding:8px; border:2px solid #fcd34d; border-radius:6px; font-weight:bold; font-size:13px; color:#92400e; box-sizing: border-box;">
                            </div>
                            <div style="flex: 1;">
                                <label style="font-size:10px; font-weight:bold; color:#92400e; display:block; margin-bottom:4px;">PORCENTAJE (%)</label>
                                <input type="number" id="porcentajeEnganche" oninput="actualizarSimuladorPorcentaje()" style="width:100%; padding:8px; border:2px solid #fcd34d; border-radius:6px; font-weight:bold; font-size:13px; color:#92400e; box-sizing: border-box;">
                            </div>
                        </div>
                    </div>

                    <div id="tablaPlanesSimulada" style="box-sizing: border-box;"></div>
                </div>

                <div style="padding: 15px 20px; border-top: 1px solid #e2e8f0; display: flex; gap: 10px; background: #f8fafc; box-sizing: border-box;">
                    ${
                        !window.CATALOGO_STANDALONE
                        ? `<button onclick="agregarAlCarritoDesdeModal()" style="flex:2; padding:12px; background:#2563eb; color:white; border:none; border-radius:6px; font-weight:bold; font-size:13px; cursor:pointer;">🛒 AÑADIR A VENTA</button>`
                        : ''
                    }
                    <button onclick="cerrarProducto()" style="flex:1; padding:12px; background:#e2e8f0; color:#475569; border:none; border-radius:6px; font-weight:bold; font-size:13px; cursor:pointer;">CERRAR</button>
                </div>
            </div>

            <div id="zoomContainer" style="flex: 1; background:#f1f5f9; display:flex; align-items:center; justify-content:center; position:relative; overflow:hidden; box-sizing: border-box;">
                <img id="imgModal" src="${pSel.imagen || ''}" style="width:100%; height:100%; object-fit:contain; padding: 20px; box-sizing: border-box; transition: transform 0.15s ease-out;" onerror="this.parentElement.innerHTML='<span style=\\'font-size:60px; color:#cbd5e1;\\'>📦</span>'">
                <div style="position:absolute; bottom:15px; background:rgba(0,0,0,0.6); color:white; padding:4px 10px; border-radius:20px; font-size:9px; font-weight:bold; pointer-events:none;">🔍 LUPA AUTOMÁTICA</div>
            </div>

        </div>
    `;

    modal.classList.remove("oculto");
    modal.style.display = 'flex';
    actualizarSimuladorEnganche();
    _activarEfectoZoom();
};

window.cambiarVarianteModal = function(id) {
    window.productoActualId = id;
    const p = window.variantesActuales.find(v => v.id === id);
    if (!p) return;

    window.variantesActuales.forEach(v => {
        const lbl = document.getElementById('lbl_var_' + v.id);
        if(lbl) {
            lbl.style.background = (v.id === id) ? '#eff6ff' : 'white';
            lbl.style.borderColor = (v.id === id) ? '#3b82f6' : '#e2e8f0';
        }
    });

    document.getElementById('simuladorPrecioBase').value = p.precio;
    document.getElementById('modalPrecioDestacado').innerText = dinero(p.precio);
    if (p.imagen) document.getElementById('imgModal').src = p.imagen;
    
    document.getElementById('engancheSimulado').value = 0;
    document.getElementById('porcentajeEnganche').value = 0;
    actualizarSimuladorEnganche();
};

window.actualizarSimuladorEnganche = function() {
    const precio = parseFloat(document.getElementById('simuladorPrecioBase')?.value) || 0;
    const engInput = document.getElementById("engancheSimulado");
    const porcInput = document.getElementById("porcentajeEnganche");
    let eng = parseFloat(engInput.value) || 0;
    if (eng > precio) { eng = precio; engInput.value = precio; }
    if (porcInput) porcInput.value = precio > 0 ? ((eng / precio) * 100).toFixed(1) : 0;
    actualizarTablaPlanesSimulada(precio - eng);
};

window.actualizarSimuladorPorcentaje = function() {
    const precio = parseFloat(document.getElementById('simuladorPrecioBase')?.value) || 0;
    const engInput = document.getElementById("engancheSimulado");
    const porcInput = document.getElementById("porcentajeEnganche");
    let porc = parseFloat(porcInput.value) || 0;
    if (porc > 100) { porc = 100; porcInput.value = 100; }
    const eng = (porc / 100) * precio;
    if (engInput) engInput.value = eng.toFixed(2);
    actualizarTablaPlanesSimulada(precio - eng);
};

function actualizarTablaPlanesSimulada(saldo) {
    const cont = document.getElementById("tablaPlanesSimulada");
    if (!cont) return;
    if (saldo <= 0) { 
        cont.innerHTML = `<div style="text-align:center; padding:10px; background:#dcfce7; color:#166534; font-weight:bold; border-radius:6px; font-size:11px; margin-top:5px;">✅ LIQUIDA DE CONTADO</div>`; 
        return; 
    }
    
    let planes = [];
    try { planes = CalculatorService.calcularCredito(saldo); } catch(e) {}
    if (!planes.length) planes = [{meses:1, total:saldo, abono:saldo}];

    let html = `<h4 style="margin:0 0 6px; font-size:11px; color:#1e40af; text-transform:uppercase;">💳 Plan de Pagos:</h4>
        <table style="width:100%; border-collapse:collapse; font-size:11px;">
        <thead><tr style="background:#f8fafc; border-bottom:1px solid #e2e8f0;">
            <th style="padding:6px 8px; text-align:left; color:#475569;">PLAZO</th>
            <th style="padding:6px 8px; text-align:center; color:#475569;">SEMANAL</th>
            <th style="padding:6px 8px; text-align:right; color:#475569;">TOTAL</th>
        </tr></thead><tbody>`;
    
    planes.forEach((pl, idx) => {
        const bg = idx % 2 === 0 ? 'white' : '#fcfcfc';
        html += `<tr style="border-bottom:1px solid #f1f5f9; background:${bg};">
            <td style="padding:6px 8px; color:#0f172a;"><strong>${pl.meses} Meses</strong></td>
            <td style="padding:6px 8px; text-align:center; color:#2563eb; font-weight:bold;">${dinero(pl.abono)}</td>
            <td style="padding:6px 8px; text-align:right; font-weight:bold; color:#1e293b;">${dinero(pl.total)}</td>
        </tr>`;
    });
    cont.innerHTML = html + '</tbody></table>';
}

function _activarEfectoZoom() {
    const img = document.getElementById('imgModal');
    const container = document.getElementById('zoomContainer');
    if (!img || !container) return;
    container.onmousemove = (e) => {
        const rect = container.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        img.style.transformOrigin = `${x}% ${y}%`;
        img.style.transform = "scale(2.2)";
    };
    container.onmouseleave = () => { img.style.transform = "scale(1)"; img.style.transformOrigin = "center"; };
}

function cerrarProducto() { 
    const modal = document.getElementById("modalProducto");
    if(modal) {
        modal.style.display = 'none'; 
        modal.classList.add("oculto"); 
    }
}

window.verDetalle = function(id) {
    verProductoAgrupado(id);
}

// ===== FUNCIONES LISTA DE PRECIOS =====
function renderListaPrecios() {
    const contenedor = document.getElementById("listaPrecios");
    if (!contenedor) return;

    const prods = StorageService.get("productos", []);
    if (prods.length === 0) {
        contenedor.innerHTML = `<div style="text-align: center; padding: 40px; color: #718096;"><h3>📊 No hay productos para mostrar</h3></div>`;
        return;
    }

    const productosAgrupados = agruparProductosPorCategoria();

    let html = `
        <div style="padding: 20px;">
            <div style="margin-bottom: 30px;">
                <h1 style="color: #1a3a70; text-align: center; font-size: 28px; margin: 0 0 10px 0;">📊 LISTA DE PRECIOS</h1>
                <p style="text-align: center; color: #718096; margin: 0;">Mueblería Mi Pueblito - ${window.formatearFechaCortaMX(new Date())}</p>
            </div>`;

    Object.keys(productosAgrupados).sort().forEach(categoria => {
        const subcategorias = productosAgrupados[categoria];
        html += `<div style="margin-bottom: 40px; page-break-inside: avoid;">
                    <div style="background: linear-gradient(135deg, #1a3a70 0%, #2c5282 100%); color: white; padding: 15px 20px; border-radius: 8px 8px 0 0;">
                        <h2 style="margin: 0; font-size: 20px;">📦 ${categoria}</h2>
                    </div>`;

        Object.keys(subcategorias).sort().forEach(subcategoria => {
            const productosSubcat = subcategorias[subcategoria];
            html += `<div style="margin-bottom: 20px;">
                        <h3 style="background: #e8f0fe; padding: 12px 20px; margin: 0; color: #1a3a70; font-size: 16px; border-left: 5px solid #3498db;">${subcategoria}</h3>
                        <div style="overflow-x: auto;">
                            <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 13px;">
                                <thead>
                                    <tr style="background: #f8f9fa; border-bottom: 2px solid #cbd5e0;">
                                        <th style="padding: 10px 12px; text-align: left; font-weight: 600; color: #2c3e50; border-right: 1px solid #cbd5e0;">Producto</th>
                                        <th style="padding: 10px 12px; text-align: right; font-weight: 600; color: #2c3e50; border-right: 1px solid #cbd5e0;">Contado</th>`;

            let planesEjemplo = [];
            try { planesEjemplo = CalculatorService.calcularCredito(1000); } catch(e) {}
            if (!planesEjemplo || planesEjemplo.length === 0) planesEjemplo = [{meses: 1}];

            planesEjemplo.forEach(plan => {
                html += `<th colspan="2" style="padding: 10px 12px; text-align: center; font-weight: 600; color: #2c3e50; border-right: 1px solid #cbd5e0; background: #dbeafe;">${plan.meses} Mes${plan.meses > 1 ? 'es' : ''}</th>`;
            });

            html += `</tr><tr style="background: #f0f4f8; border-bottom: 1px solid #cbd5e0;">
                     <th style="padding: 8px 12px; border-right: 1px solid #cbd5e0;"></th><th style="padding: 8px 12px; border-right: 1px solid #cbd5e0;"></th>`;

            planesEjemplo.forEach(plan => {
                html += `<th style="padding: 8px 6px; text-align: center; color: #4a5568; border-right: 1px solid #cbd5e0; font-size: 11px; background: #e0f2fe;">Semanal</th>
                         <th style="padding: 8px 6px; text-align: center; color: #4a5568; border-right: 1px solid #cbd5e0; font-size: 11px; background: #e0f2fe;">Total</th>`;
            });

            html += `</tr></thead><tbody>`;

            productosSubcat.sort((a, b) => (a.nombre||'').localeCompare(b.nombre||'')).forEach((prod, idx) => {
                let planes = [];
                try { planes = CalculatorService.calcularCredito(prod.precio); } catch(e) {}
                if (!planes || planes.length === 0) planes = [{abono: prod.precio, total: prod.precio}];
                
                html += `<tr style="background: ${idx % 2 === 0 ? "#ffffff" : "#f9fafb"}; border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 10px 12px; text-align: left; border-right: 1px solid #e2e8f0; cursor:pointer;" onclick="verDetalle(${prod.id})">
                        <strong style="color: #2c3e50; font-size: 13px;">${prod.nombre}</strong>
                        ${prod.color ? `<br><small style="color: #718096; font-size: 11px;">🎨 ${prod.color}</small>` : ''}
                        ${prod.ubicacion ? `<br><small style="color: #718096; font-size: 11px;">📍 ${prod.ubicacion}</small>` : ''}
                    </td>
                    <td style="padding: 10px 12px; text-align: right; border-right: 1px solid #e2e8f0; font-weight: bold; color: #27ae60; font-size: 12px;">${dinero(prod.precio)}</td>`;

                planes.forEach(plan => {
                    html += `<td style="padding: 10px 6px; text-align: right; border-right: 1px solid #e2e8f0; color: #3498db; font-weight: 600; font-size: 12px;">${dinero(plan.abono)}</td>
                             <td style="padding: 10px 6px; text-align: right; border-right: 1px solid #e2e8f0; color: #2c3e50; font-weight: 600; font-size: 12px;">${dinero(plan.total)}</td>`;
                });
                html += `</tr>`;
            });
            html += `</tbody></table></div></div>`;
        });
        html += `</div>`;
    });

    html += `<div style="margin-top: 30px; display: flex; gap: 10px; justify-content: center; padding-bottom: 40px; flex-wrap: wrap;">
            <button onclick="imprimirListaPrecios()" style="padding: 12px 24px; background: #3498db; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">🖨️ Imprimir</button>
            <button onclick="exportarListaPreciosCSV()" style="padding: 12px 24px; background: #27ae60; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">📥 Descargar Excel</button>
        </div></div>`;

    contenedor.innerHTML = html;
}

function agruparProductosPorCategoria() {
    const agrupados = {};
    const prods = StorageService.get("productos", []);
    prods.forEach(prod => {
        const categoria = prod.categoria || "Sin Categoría";
        const subcategoria = prod.subcategoria || "Sin Subcategoría";
        if (!agrupados[categoria]) agrupados[categoria] = {};
        if (!agrupados[categoria][subcategoria]) agrupados[categoria][subcategoria] = [];
        agrupados[categoria][subcategoria].push(prod);
    });
    return agrupados;
}

function imprimirListaPrecios() {
    const contenido = document.getElementById("listaPrecios").innerHTML;
    if (!contenido) return alert("⚠️ No hay contenido para imprimir");
    const ventanaImpresion = window.open('', '_blank');
    const htmlCompleto = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Lista de Precios</title><style>
        body{font-family:Arial,sans-serif;padding:8mm;font-size:11px;} table{width:100%;border-collapse:collapse;margin-bottom:15px;}
        th,td{padding:5px;border:1px solid #ddd;text-align:right;} td:first-child{text-align:left;}
        th{background:#f4f4f4;text-align:center;} h2,h3{margin:10px 0;} @media print { body{padding:0;} }
    </style></head><body>${contenido}</body></html>`;
    ventanaImpresion.document.write(htmlCompleto);
    ventanaImpresion.document.close();
    ventanaImpresion.focus();
    setTimeout(() => ventanaImpresion.print(), 300);
}

function exportarListaPreciosCSV() {
    const productosAgrupados = agruparProductosPorCategoria();
    let csv = "Categoría,Subcategoría,Producto,Color,Marca,Ubicación,Precio Contado";
    let planesEjemplo = [];
    try { planesEjemplo = CalculatorService.calcularCredito(1000); } catch(e) {}
    if (!planesEjemplo || planesEjemplo.length === 0) planesEjemplo = [{meses: 1}];

    planesEjemplo.forEach(plan => csv += `,${plan.meses}M Total`);
    csv += "\n";

    Object.keys(productosAgrupados).sort().forEach(categoria => {
        Object.keys(productosAgrupados[categoria]).sort().forEach(subcategoria => {
            productosAgrupados[categoria][subcategoria].sort((a, b) => (a.nombre||'').localeCompare(b.nombre||'')).forEach(prod => {
                let planes = [];
                try { planes = CalculatorService.calcularCredito(prod.precio); } catch(e) {}
                if (!planes || planes.length === 0) planes = [{total: prod.precio}];
                
                csv += `"${categoria}","${subcategoria}","${prod.nombre}","${prod.color || ''}","${prod.marca || ''}","${prod.ubicacion || ''}",${prod.precio}`;
                planes.forEach(plan => csv += `,${plan.total}`);
                csv += "\n";
            });
        });
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `lista-precios-${window.getFechaLocalMX()}.csv`);
    link.click();
}