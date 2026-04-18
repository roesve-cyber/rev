// ===== TIENDA / CATÁLOGO CON FILTROS COMO ENCABEZADOS (SIN TÍTULO EXTRA) =====
function mostrarProductos() {
    const contenedor = document.getElementById("gridProductos");
    if (!contenedor) return;

    // Crear encabezado con filtros (sin título extra)
    let html = `
        <div style="grid-column: 1/-1; background: linear-gradient(135deg, #1a3a70 0%, #2c5282 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
           
           
            <div style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 15px; align-items: flex-end;">
                
                <div>
                    <label style="display: block; font-weight: bold; color: rgba(255,255,255,0.9); margin-bottom: 8px; font-size: 13px;">📦 Categoría</label>
                    <select id="filtroCatalogoCategoria" onchange="filtrarCatalogo()" style="width: 100%; padding: 10px; border: none; border-radius: 6px; font-size: 13px; cursor: pointer;">
                        <option value="">-- Todas las Categorías --</option>
                    </select>
                </div>
                
                <div>
                    <label style="display: block; font-weight: bold; color: rgba(255,255,255,0.9); margin-bottom: 8px; font-size: 13px;">🏷️ Subcategoría</label>
                    <select id="filtroCatalogoSubcategoria" onchange="filtrarCatalogo()" style="width: 100%; padding: 10px; border: none; border-radius: 6px; font-size: 13px; cursor: pointer;">
                        <option value="">-- Todas las Subcategorías --</option>
                    </select>
                </div>
                
                <div>
                    <button onclick="limpiarFiltrosCatalogo()" style="padding: 10px 20px; background: rgba(255,255,255,0.2); color: white; border: 2px solid white; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 13px; transition: all 0.2s;">
                        🔄 Limpiar
                    </button>
                </div>
                
            </div>
        </div>
    `;

    contenedor.innerHTML = html;

    // Llenar categorías
    let categorias = [...new Set(productos.map(p => p.categoria).filter(Boolean))].sort();
    let selectCategorias = '<option value="">-- Todas las Categorías --</option>';
    categorias.forEach(cat => {
        selectCategorias += `<option value="${cat}">${cat}</option>`;
    });

    // Llenar subcategorías (todas inicialmente)
    let subcategorias = [...new Set(productos.map(p => p.subcategoria).filter(Boolean))].sort();
    let selectSubcategorias = '<option value="">-- Todas las Subcategorías --</option>';
    subcategorias.forEach(subcat => {
        selectSubcategorias += `<option value="${subcat}">${subcat}</option>`;
    });

    document.getElementById('filtroCatalogoCategoria').innerHTML = selectCategorias;
    document.getElementById('filtroCatalogoSubcategoria').innerHTML = selectSubcategorias;

    // Mostrar productos
    renderProductosCatalogo(productos);
}

/**
 * Filtra los productos del catálogo según categoría y subcategoría
 */
function filtrarCatalogo() {
    const categoria = document.getElementById('filtroCatalogoCategoria')?.value || '';
    const subcategoria = document.getElementById('filtroCatalogoSubcategoria')?.value || '';

    // Si cambia categoría, actualizar subcategorías disponibles
    if (categoria) {
        actualizarSubcategoriasCatalogo(categoria);
    }

    // Filtrar productos
    let filtrados = productos;

    if (categoria) {
        filtrados = filtrados.filter(p => p.categoria === categoria);
    }

    if (subcategoria) {
        filtrados = filtrados.filter(p => p.subcategoria === subcategoria);
    }

    renderProductosCatalogo(filtrados);
}

/**
 * Actualiza las subcategorías disponibles según la categoría seleccionada
 */
function actualizarSubcategoriasCatalogo(categoriaSeleccionada) {
    const selectSub = document.getElementById('filtroCatalogoSubcategoria');
    if (!selectSub) return;

    // Obtener subcategorías de la categoría seleccionada
    let subcategoriasDisponibles = [...new Set(
        productos
            .filter(p => p.categoria === categoriaSeleccionada)
            .map(p => p.subcategoria)
            .filter(Boolean)
    )].sort();

    // Reconstruir select
    selectSub.innerHTML = '<option value="">-- Todas las Subcategorías --</option>';
    subcategoriasDisponibles.forEach(subcat => {
        selectSub.innerHTML += `<option value="${subcat}">${subcat}</option>`;
    });
}

/**
 * Limpia todos los filtros
 */
function limpiarFiltrosCatalogo() {
    document.getElementById('filtroCatalogoCategoria').value = '';
    document.getElementById('filtroCatalogoSubcategoria').value = '';
    
    // Restaurar todas las subcategorías
    let subcategorias = [...new Set(productos.map(p => p.subcategoria).filter(Boolean))].sort();
    let selectSub = document.getElementById('filtroCatalogoSubcategoria');
    selectSub.innerHTML = '<option value="">-- Todas las Subcategorías --</option>';
    subcategorias.forEach(subcat => {
        selectSub.innerHTML += `<option value="${subcat}">${subcat}</option>`;
    });
    
    renderProductosCatalogo(productos);
}

/**
 * Renderiza los productos en grid automático
 */
function renderProductosCatalogo(listaProductos) {
    const contenedor = document.getElementById("gridProductos");
    if (!contenedor) return;

    if (listaProductos.length === 0) {
        contenedor.innerHTML += `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: #718096;">
                <h3 style="font-size: 24px; margin-bottom: 10px;">📭 Sin productos</h3>
                <p>No hay productos que coincidan con los filtros seleccionados.</p>
            </div>`;
        return;
    }

    listaProductos.forEach(p => {
        const precio = p.precio || 0;
        const planes = CalculatorService.calcularCredito(precio);
        const plan6  = planes[5] || planes[0];
        const abono  = plan6 ? plan6.abono : 0;

        const cardHTML = `
            <div class="card-producto">
                <div class="card-producto-imagen">
                    <img src="${p.imagen || ''}" alt="${p.nombre}" onerror="this.parentElement.innerHTML='<div style=&quot;display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; color:#bdc3c7;&quot;><span style=&quot;font-size:48px;&quot;>📦</span><p>Sin imagen</p></div>'">
                </div>
                <div class="card-producto-contenido">
                    <h3 class="card-producto-nombre">${p.nombre}</h3>
                    <div class="card-producto-precio">
                        <small class="precio-contado">Precio contado</small>
                        <p class="precio-valor">${dinero(precio)}</p>
                        <small class="precio-semanal">Desde ${dinero(abono)}/semana (${plan6.meses} meses)</small>
                    </div>
                    <div class="card-producto-acciones">
                        <button onclick="verProducto(${p.id})">👁️ Detalles</button>
                    </div>
                </div>
            </div>
        `;

        contenedor.innerHTML += cardHTML;
    });
}

window.mostrarProductos = mostrarProductos;
window.filtrarCatalogo = filtrarCatalogo;
window.actualizarSubcategoriasCatalogo = actualizarSubcategoriasCatalogo;
window.limpiarFiltrosCatalogo = limpiarFiltrosCatalogo;
window.renderProductosCatalogo = renderProductosCatalogo;
