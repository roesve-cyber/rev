// ============================================================
// 🖼️ TIENDA / CATÁLOGO: 5 COLUMNAS FIJAS Y MODAL BLINDADO
// ============================================================

function _tiendaProductosActivos() {
    const base = StorageService.get("productos", []) || window.productos || [];
    return typeof window.filtrarProductosActivos === 'function' ? window.filtrarProductosActivos(base) : base;
}

window.mostrarProductos = function() {
    const vistaTienda = document.getElementById("tienda");
    if (!vistaTienda) return;

    let contenedorGrid = document.getElementById("gridProductos");
    if (!contenedorGrid) {
        contenedorGrid = document.createElement("div");
        contenedorGrid.id = "gridProductos";
        vistaTienda.appendChild(contenedorGrid);
    }

    // 1. GARANTIZAR ESTRICTAMENTE 5 ARTÍCULOS POR LÍNEA
    contenedorGrid.style.display = "grid";
    contenedorGrid.style.gridTemplateColumns = "repeat(5, 1fr)";
    contenedorGrid.style.gap = "15px";
    contenedorGrid.style.padding = "10px";

    const prods = _tiendaProductosActivos();
    const searchSelect = window._filtroTiendaBuscador || '';
    const filtroCat = window._filtroTiendaCategoria || '';
    const filtroSub = window._filtroTiendaSubcategoria || '';

    let htmlFiltros = `
        <div style="width: 100%; background: linear-gradient(135deg, #1a3a70 0%, #2c5282 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); box-sizing: border-box;">
            <div style="display: grid; grid-template-columns: 1.5fr 1fr 1fr auto; gap: 15px; align-items: flex-end;">
                <div>
                    <label style="display: block; font-weight: bold; color: rgba(255,255,255,0.9); margin-bottom: 8px; font-size: 13px;">🔍 Buscar Mueble</label>
                    <input type="text" id="buscadorTienda" value="${searchSelect}" placeholder="Nombre, marca o modelo..." 
                        oninput="window.filtrarTiendaTexto(this.value);"
                        style="width: 100%; padding: 10px; border: none; border-radius: 6px; font-size: 13px; color: #333; box-sizing: border-box;">
                </div>
                <div>
                    <label style="display: block; font-weight: bold; color: rgba(255,255,255,0.9); margin-bottom: 8px; font-size: 13px;">🗂️ Categoría</label>
                    <select id="filtroCatalogoCategoria" onchange="window.filtrarTiendaCategoria(this.value)" style="width: 100%; padding: 10px; border: none; border-radius: 6px; font-size: 13px; color: #333; box-sizing: border-box; background: white;">
                        <option value="todas">-- Todas --</option>
                        ${window._obtenerCategoriasOrdenadas().map(c => `<option value="${c}" ${filtroCat === c ? 'selected' : ''}>${c}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="display: block; font-weight: bold; color: rgba(255,255,255,0.9); margin-bottom: 8px; font-size: 13px;">🏷️ Subcategoría</label>
                    <select id="filtroCatalogoSubcategoria" onchange="window.filtrarTiendaSubcategoria(this.value)" ${!filtroCat ? 'disabled' : ''} style="width: 100%; padding: 10px; border: none; border-radius: 6px; font-size: 13px; color: #333; box-sizing: border-box; background: white;">
                        <option value="todas">-- Todas --</option>
                        ${filtroCat ? window._obtenerSubcategoriasOrdenadas(filtroCat).map(s => `<option value="${s}" ${filtroSub === s ? 'selected' : ''}>${s}</option>`).join('') : ''}
                    </select>
                </div>
                <button onclick="window.limpiarFiltrosCatalogo()" style="padding: 10px 15px; background: rgba(255,255,255,0.2); color: white; border: 2px solid white; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 13px; height: 38px;">🔄</button>
            </div>
        </div>
    `;

    const barraExistente = vistaTienda.querySelector('div[style*="gradient"]');
    if (barraExistente) barraExistente.remove(); 
    vistaTienda.insertBefore(document.createRange().createContextualFragment(htmlFiltros), contenedorGrid);

    if (searchSelect) {
        const inputBusq = document.getElementById("buscadorTienda");
        if (inputBusq) {
            inputBusq.focus();
            inputBusq.setSelectionRange(searchSelect.length, searchSelect.length);
        }
    }

    window.filtrarCatalogo();
};

window.filtrarCatalogo = function() {
    const category = window._filtroTiendaCategoria || '';
    const subcategory = window._filtroTiendaSubcategoria || '';
    const busqueda = (window._filtroTiendaBuscador || '').toLowerCase().trim();
    const prods = _tiendaProductosActivos();

    const filtrados = prods.filter(p => {
        const matchCat = !category || p.categoria === category;
        const matchSub = !subcategory || p.subcategoria === subcategory;
        const textoComp = `${p.nombre} ${p.marca || ''} ${p.modelo || ''} ${p.color || ''}`.toLowerCase();
        const matchBusqueda = !busqueda || textoComp.includes(busqueda);
        return matchCat && matchSub && matchBusqueda;
    });

    window.renderProductosCatalogo(filtrados);
};

window.renderProductosCatalogo = function(listaProductos) {
    const contenedor = document.getElementById("gridProductos");
    if (!contenedor) return;

    contenedor.innerHTML = '';
    const productosAgrupados = agruparParaCatalogo(listaProductos);

    if (productosAgrupados.length === 0) {
        contenedor.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 60px; color: #94a3b8;"><h3>No se encontraron productos</h3></div>`;
        return;
    }

    let tarjetasHTML = '';
    productosAgrupados.forEach(grupo => {
        let planes = [];
        try { planes = CalculatorService.calcularCredito(grupo.precioMin); } catch(e) {}
        if (!planes || planes.length === 0) planes = [{meses: 1, total: grupo.precioMin, abono: grupo.precioMin}];
        const plan6 = planes[5] || planes[planes.length - 1] || planes[0];

        const colorStock = grupo.stockTotal > 0 ? '#10b981' : '#0011fd';
        const badgeStock = grupo.stockTotal > 0 ? `STOCK: ${grupo.stockTotal}` : `Sobre pedido`;

        tarjetasHTML += `
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; flex-direction: column; height: 100%; box-shadow: 0 2px 4px rgba(0,0,0,0.05); overflow: hidden; box-sizing: border-box;">
                <div style="position: relative; height: 140px; background: #f8fafc; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid #f1f5f9;">
                    <div style="position: absolute; top: 10px; right: 10px; background: ${colorStock}; color: white; padding: 3px 8px; border-radius: 4px; font-size: 9px; font-weight: 800; z-index: 5;">
                        ${badgeStock}
                    </div>
                    <img src="${grupo.imagen || ''}" style="max-width: 85%; max-height: 85%; object-fit: contain;" onerror="this.parentElement.innerHTML='<span style=\\'font-size:35px; color:#cbd5e1;\\'>📦</span>'">
                </div>
                <div style="padding: 12px; display: flex; flex-direction: column; flex-grow: 1; box-sizing: border-box;">
                    <h3 style="margin: 0 0 8px 0; font-size: 12px; color: #0f172a; font-weight: 700; line-height: 1.3; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;" title="${grupo.nombreOriginal}">
                        ${grupo.nombreOriginal}
                    </h3>
                    <div style="margin-top: auto; padding-top: 8px; border-top: 1px solid #f1f5f9;">
                        <div style="font-size: 9px; color: #64748b; font-weight: 600; text-transform: uppercase;">Precio Contado</div>
                        <div style="font-size: 16px; font-weight: 900; color: #16a34a;">${dinero(grupo.precioMin)}</div>
                        <div style="font-size: 10px; color: #2563eb; font-weight: 700; margin-top: 2px;">
                            💳 Semanal: ${dinero(plan6.abono)}
                        </div>
                    </div>
                    <button onclick="window.verProductoAgrupado('${grupo.idPrincipal}')" 
                            style="width: 100%; padding: 8px; margin-top: 10px; background: #0f172a; color: white; border: none; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; text-transform: uppercase;">
                        Ver Detalles
                    </button>
                </div>
            </div>`;
    });

    contenedor.innerHTML = tarjetasHTML;
};

// 2. MODAL DE DETALLES: ESTRUCTURA BLINDADA CONTRA DESBORDES (OVERFLOW REPARADO)
window.verProductoAgrupado = function(idPrincipal) {
    const modal = document.getElementById("modalProducto");
    const contenido = document.getElementById("contenidoProducto");
    if (!modal || !contenido) return;

    contenido.innerHTML = ''; // Limpia cualquier vista fantasma anterior

    const prods = _tiendaProductosActivos();
    const base = prods.find(p => String(p.id) === String(idPrincipal));
    if (!base) return;

    const nombre = (base.nombre || "").trim();
    const variantes = prods.filter(p => (p.nombre || "").trim().toUpperCase() === nombre.toUpperCase() && p.categoria === base.categoria);
    if (variantes.length === 0) return;

    window.variantesActuales = variantes; 
    let pSel = variantes.find(v => Number(v.stock) > 0) || variantes[0];
    window.productoActualId = pSel.id;

    let htmlVars = `
        <div style="background:#f8fafc; padding:10px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:15px; flex-shrink: 0;">
            <h4 style="margin:0 0 8px; color:#1e40af; font-size:11px; text-transform:uppercase; font-weight:bold;">📦 Variantes Disponibles:</h4>
            <div style="display:flex; flex-direction:column; gap:6px; max-height:120px; overflow-y:auto;">
    `;
    
    variantes.forEach(v => {
        const isSel = v.id === pSel.id;
        const colorStk = Number(v.stock) > 0 ? '#16a34a' : '#ef4444';
        htmlVars += `
            <label id="lbl_var_${v.id}" style="display:flex; align-items:center; padding:8px; border:2px solid ${isSel ? '#3b82f6' : '#e2e8f0'}; border-radius:6px; cursor:pointer; background:${isSel ? '#eff6ff' : 'white'};">
                <input type="radio" name="variante" value="${v.id}" onchange="window.cambiarVarianteModal(${v.id})" ${isSel?'checked':''} style="margin-right:8px;">
                <div style="flex:1; font-size:11px; color:#1e293b;">
                    <strong>${v.color || 'Único'}</strong> <span style="color:#64748b; margin-left:4px;">📍 ${v.ubicacion}</span>
                </div>
                <div style="text-align:right; font-weight:bold; color:${colorStk}; font-size:10px;">
                    ${Number(v.stock)>0 ? v.stock+' disp.' : '❌ Agotado'}
                </div>
            </label>
        `;
    });
    htmlVars += `</div></div>`;

    // DISEÑO AUDITADO: La columna izquierda tiene "display: flex; flex-direction: column;" y adentro un área con "overflow-y: auto"
    // Los botones están por FUERA del overflow, para que NUNCA sean empujados hacia abajo.
    contenido.innerHTML = `
        <div style="display: flex; flex-direction: row; width: 100%; height: 85vh; max-height: 800px; background: white; border-radius: 12px; overflow: hidden; margin: auto; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
            
            <div style="flex: 1; display: flex; flex-direction: column; border-right: 1px solid #e2e8f0; background: white; overflow: hidden;">
                
                <div style="flex: 1; overflow-y: auto; padding: 25px; min-height: 0;">
                    <h2 style="margin:0 0 5px; font-size:18px; color:#0f172a; font-weight:bold;">${nombre}</h2>
                    <div style="font-size:11px; color:#64748b; margin-bottom: 15px;">
                        Marca: <strong>${pSel.marca || '-'}</strong> | Modelo: <strong>${pSel.modelo || '-'}</strong>
                    </div>
                    
                    ${htmlVars}
                    
                    <input type="hidden" id="simuladorPrecioBase" value="${pSel.precio}">
                    <div style="background:#16a34a; color:white; padding:15px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; flex-shrink: 0;">
                        <span style="font-size:12px; font-weight:bold; text-transform:uppercase;">Precio Contado</span>
                        <span id="modalPrecioDestacado" style="font-size:22px; font-weight:bold;">${dinero(pSel.precio)}</span>
                    </div>

                    <div style="background:#fffbeb; border:1px solid #fef3c7; padding:15px; border-radius:8px; margin-bottom:15px; flex-shrink: 0;">
                        <h4 style="margin:0 0 10px; font-size:11px; color:#92400e; font-weight:bold;">SIMULADOR DE ENGANCHE</h4>
                        <div style="display:flex; gap:10px;">
                            <div style="flex: 1;">
                                <label style="font-size:10px; font-weight:bold; color:#92400e; display:block; margin-bottom:4px;">EFECTIVO ($)</label>
                                <input type="number" id="engancheSimulado" value="0" oninput="window.actualizarSimuladorEnganche()" style="width:100%; padding:8px; border:1px solid #fcd34d; border-radius:6px; font-weight:bold; font-size:13px; color:#92400e; box-sizing: border-box;">
                            </div>
                            <div style="flex: 1;">
                                <label style="font-size:10px; font-weight:bold; color:#92400e; display:block; margin-bottom:4px;">PORCENTAJE (%)</label>
                                <input type="number" id="percentageEnganche" value="0" oninput="window.actualizarSimuladorPorcentaje()" style="width:100%; padding:8px; border:1px solid #fcd34d; border-radius:6px; font-weight:bold; font-size:13px; color:#92400e; box-sizing: border-box;">
                            </div>
                        </div>
                    </div>
                    
                    <div id="tablaPlanesSimulada"></div>
                </div>

                <div style="padding: 15px 25px; display: flex; gap: 10px; border-top: 1px solid #e2e8f0; background: #f8fafc; flex-shrink: 0;">
                    ${!window.CATALOGO_STANDALONE ? `<button onclick="window.agregarAlCarritoDesdeModal && window.agregarAlCarritoDesdeModal()" style="flex:2; padding:12px; background:#2563eb; color:white; border:none; border-radius:6px; font-weight:bold; font-size: 13px; cursor:pointer;">🛒 AÑADIR A VENTA</button>` : ''}
                    <button onclick="window.cerrarProducto()" style="flex:1; padding:12px; background:#e2e8f0; color:#475569; border:none; border-radius:6px; font-weight:bold; font-size: 13px; cursor:pointer;">CERRAR</button>
                </div>

            </div>
            
            <div id="zoomContainer" style="flex: 1; background:#f8fafc; display:flex; align-items:center; justify-content:center; position:relative; overflow:hidden;">
                <img id="imgModal" src="${pSel.imagen || ''}" style="width:100%; height:100%; object-fit:contain; padding: 20px; transition: transform 0.1s ease-out;" onerror="this.parentElement.innerHTML='<span style=\\'font-size:60px; color:#cbd5e1;\\'>📦</span>'">
            </div>
        </div>
    `;

    // Capa de bloqueo para que no se mezcle
    modal.style.position = "fixed";
    modal.style.top = "0";
    modal.style.left = "0";
    modal.style.width = "100vw";
    modal.style.height = "100vh";
    modal.style.zIndex = "99999";
    modal.style.backgroundColor = "rgba(0,0,0,0.7)";
    modal.style.display = 'flex';
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modal.classList.remove("oculto");

    window.actualizarSimuladorEnganche();
    window._activarEfectoZoom();
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

    const baseInput = document.getElementById('simuladorPrecioBase');
    if (baseInput) baseInput.value = p.precio;

    document.getElementById('modalPrecioDestacado').innerText = dinero(p.precio);
    if (p.imagen) document.getElementById('imgModal').src = p.imagen;
    
    document.getElementById('engancheSimulado').value = 0;
    document.getElementById('percentageEnganche').value = 0;
    window.actualizarSimuladorEnganche();
};

window.actualizarSimuladorEnganche = function() {
    const precio = parseFloat(document.getElementById('simuladorPrecioBase')?.value) || 0;
    const engInput = document.getElementById("engancheSimulado");
    const porcInput = document.getElementById("percentageEnganche");
    let eng = parseFloat(engInput.value) || 0;
    if (eng > precio) { eng = precio; engInput.value = precio; }
    if (porcInput) porcInput.value = precio > 0 ? ((eng / precio) * 100).toFixed(1) : 0;
    window.actualizarTablaPlanesSimulada(precio - eng);
};

window.actualizarSimuladorPorcentaje = function() {
    const precio = parseFloat(document.getElementById('simuladorPrecioBase')?.value) || 0;
    const engInput = document.getElementById("engancheSimulado");
    const porcInput = document.getElementById("percentageEnganche");
    let porc = parseFloat(porcInput.value) || 0;
    if (porc > 100) { porc = 100; porcInput.value = 100; }
    const eng = (porc / 100) * precio;
    if (engInput) engInput.value = eng.toFixed(2);
    window.actualizarTablaPlanesSimulada(precio - eng);
};

window.actualizarTablaPlanesSimulada = function(saldo) {
    const cont = document.getElementById("tablaPlanesSimulada");
    if (!cont) return;
    if (saldo <= 0) { 
        cont.innerHTML = `<div style="text-align:center; padding:10px; background:#dcfce7; color:#166534; font-weight:bold; border-radius:6px; font-size:12px;">✅ LIQUIDA DE CONTADO</div>`; 
        return; 
    }
    
    let planes = [];
    try { planes = CalculatorService.calcularCredito(saldo); } catch(e) {}
    if (!planes.length) planes = [{meses:1, total:saldo, abono:saldo}];

    let html = `
        <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead style="background: #f8fafc;"><tr style="border-bottom:1px solid #cbd5e1;">
            <th style="padding:8px; text-align:left; color:#475569;">PLAZO</th>
            <th style="padding:8px; text-align:center; color:#475569;">SEMANAL</th>
            <th style="padding:8px; text-align:right; color:#475569;">TOTAL</th>
        </tr></thead><tbody>`;
    
    planes.forEach((pl, idx) => {
        const bg = idx % 2 === 0 ? 'white' : '#f8fafc';
        html += `<tr style="border-bottom:1px solid #e2e8f0; background:${bg};">
            <td style="padding:8px; color:#0f172a;"><strong>${pl.meses} Meses</strong></td>
            <td style="padding:8px; text-align:center; color:#1d4ed8; font-weight:bold;">${dinero(pl.abono)}</td>
            <td style="padding:8px; text-align:right; font-weight:bold; color:#334155;">${dinero(pl.total)}</td>
        </tr>`;
    });
    html += '</tbody></table>';
    cont.innerHTML = html;
};

window._activarEfectoZoom = function() {
    const img = document.getElementById('imgModal');
    const container = document.getElementById('zoomContainer');
    if (!img || !container) return;
    container.onmousemove = (e) => {
        const rect = container.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        img.style.transformOrigin = `${x}% ${y}%`;
        img.style.transform = "scale(2)";
    };
    container.onmouseleave = () => { img.style.transform = "scale(1)"; img.style.transformOrigin = "center"; };
};

window.cerrarProducto = function() { 
    const modal = document.getElementById("modalProducto");
    if(modal) {
        modal.classList.add("oculto"); 
        modal.style.display = 'none';
    }
};

function agruparParaCatalogo(lista) {
    const mapa = {};
    lista.forEach(p => {
        const nombreStr = (p.nombre || "Sin nombre").trim().toUpperCase();
        if (!mapa[nombreStr]) {
            mapa[nombreStr] = { idPrincipal: p.id, nombreOriginal: p.nombre, categoria: p.categoria, imagen: p.imagen, precioMin: parseFloat(p.precio) || 0, stockTotal: 0 };
        }
        mapa[nombreStr].stockTotal += (Number(p.stock) || 0);
        const precioAct = parseFloat(p.precio) || 0;
        if (precioAct < mapa[nombreStr].precioMin) mapa[nombreStr].precioMin = precioAct;
    });
    return Object.values(mapa);
}

function agruparProductosPorCategoria() {
    const agrupados = {};
    const prods = _tiendaProductosActivos();
    prods.forEach(prod => {
        const categoria = prod.categoria || "Sin Categoría";
        const subcategoria = prod.subcategoria || "Sin Subcategoría";
        if (!agrupados[categoria]) agrupados[categoria] = {};
        if (!agrupados[categoria][subcategoria]) agrupados[categoria][subcategoria] = [];
        agrupados[categoria][subcategoria].push(prod);
    });
    return agrupados;
}

window.filtrarTiendaTexto = function(valor) { window._filtroTiendaBuscador = String(valor || '').trim(); window.filtrarCatalogo(); };
window.filtrarTiendaCategoria = function(cat) { window._filtroTiendaCategoria = cat === 'todas' ? '' : cat; window._filtroTiendaSubcategoria = ''; window.mostrarProductos(); };
window.filtrarTiendaSubcategoria = function(sub) { window._filtroTiendaSubcategoria = sub === 'todas' ? '' : sub; window.filtrarCatalogo(); };
window.resetFiltrosCatalogo = function() { window._filtroTiendaBuscador = ''; window._filtroTiendaCategoria = ''; window._filtroTiendaSubcategoria = ''; };
window.limpiarFiltrosCatalogo = function() { window.resetFiltrosCatalogo(); window.mostrarProductos(); };
window.verDetalle = function(id) { window.verProductoAgrupado(id); };

// Función para obtener categorías ordenadas por posición
window._obtenerCategoriasOrdenadas = function() {
    const prods = _tiendaProductosActivos();
    const categoriasEnProductos = [...new Set(prods.map(p => p.categoria).filter(Boolean))];
    const categoriasData = window.categoriasData || [];
    
    // Ordena por posición, las que no tengan posición van al final
    const conPosicion = categoriasData.filter(c => categoriasEnProductos.includes(c.nombre)).sort((a, b) => (a.posicion || 999) - (b.posicion || 999));
    const nombres = conPosicion.map(c => c.nombre);
    const sinOrden = categoriasEnProductos.filter(c => !nombres.includes(c));
    
    return [...nombres, ...sinOrden.sort()];
};

// Función para obtener subcategorías ordenadas por posición
window._obtenerSubcategoriasOrdenadas = function(categoriaSeleccionada) {
    const prods = _tiendaProductosActivos();
    const subcategoriesEnProductos = [...new Set(prods.filter(p => p.categoria === categoriaSeleccionada).map(p => p.subcategoria).filter(Boolean))];
    const categoriasData = window.categoriasData || [];
    const catData = categoriasData.find(c => c.nombre === categoriaSeleccionada);
    
    if (catData && catData.subcategorias) {
        const conPosicion = catData.subcategorias.filter(s => subcategoriesEnProductos.includes(s.nombre)).sort((a, b) => (a.posicion || 999) - (b.posicion || 999));
        const nombres = conPosicion.map(s => s.nombre);
        const sinOrden = subcategoriesEnProductos.filter(s => !nombres.includes(s));
        return [...nombres, ...sinOrden.sort()];
    }
    return subcategoriesEnProductos.sort();
};

if (window._filtroTiendaBuscador === undefined) window._filtroTiendaBuscador = '';
if (window._filtroTiendaCategoria === undefined) window._filtroTiendaCategoria = '';
if (window._filtroTiendaSubcategoria === undefined) window._filtroTiendaSubcategoria = '';

// ===== FUNCIONES LISTA DE PRECIOS =====
window.renderListaPrecios = function() {
    const contenedor = document.getElementById("listaPrecios");
    if (!contenedor) return;

    const prods = _tiendaProductosActivos();
    if (prods.length === 0) {
        contenedor.innerHTML = `<div style="text-align: center; padding: 40px; color: #718096;"><h3>📊 No hay productos para mostrar</h3></div>`;
        return;
    }

    const productosAgrupados = agruparProductosPorCategoria();

    let html = `
        <div style="padding: 20px;">
            <div style="margin-bottom: 30px;">
                <h1 style="color: #1a3a70; text-align: center; font-size: 28px; margin: 0 0 10px 0;">📊 LISTA DE PRECIOS</h1>
                <p style="text-align: center; color: #718096; margin: 0;">Mueblería Mi Pueblito - ${window.formatearFechaCortaMX ? window.formatearFechaCortaMX(new Date()) : new Date().toLocaleDateString()}</p>
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
                    <td style="padding: 10px 12px; text-align: left; border-right: 1px solid #e2e8f0; cursor:pointer;" onclick="window.verDetalle(${prod.id})">
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
            <button onclick="window.imprimirListaPrecios()" style="padding: 12px 24px; background: #3498db; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">🖨️ Imprimir</button>
            <button onclick="window.exportarListaPreciosCSV()" style="padding: 12px 24px; background: #27ae60; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">📥 Descargar Excel</button>
        </div></div>`;

    contenedor.innerHTML = html;
};

window.imprimirListaPrecios = function() {
    const contenido = document.getElementById("listaPrecios").innerHTML;
    if (!contenido) return alert("⚠️ No hay contenido para imprimir");
    const wrapper = document.createElement('div');
    wrapper.innerHTML = contenido;
    wrapper.querySelectorAll('button').forEach(btn => btn.remove());
    const contenidoLimpio = wrapper.innerHTML;
    const htmlCompleto = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Lista de Precios</title><style>
        body{font-family:Arial,sans-serif;padding:8mm;font-size:11px;} table{width:100%;border-collapse:collapse;margin-bottom:15px;}
        th,td{padding:5px;border:1px solid #ddd;text-align:right;} td:first-child{text-align:left;}
        th{background:#f4f4f4;text-align:center;} h2,h3{margin:10px 0;} @media print { body{padding:0;} }
    </style></head><body>${contenidoLimpio}</body></html>`;
    if (window.TicketService?.openDocument) {
        window.TicketService.openDocument(htmlCompleto, { title: 'Lista de Precios', filename: 'lista_precios', pageSize: 'letter' });
        return;
    }
    const ventanaImpresion = window.open('', '_blank');
    ventanaImpresion.document.write(htmlCompleto);
    ventanaImpresion.document.close();
    ventanaImpresion.focus();
    setTimeout(() => ventanaImpresion.print(), 300);
};

window.exportarListaPreciosCSV = function() {
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
    link.setAttribute("download", `lista-precios-${window.getFechaLocalMX ? window.getFechaLocalMX() : Date.now()}.csv`);
    link.click();
};
