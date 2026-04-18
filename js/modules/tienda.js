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
// ===== MODAL DE PRODUCTO DETALLADO (CON SIMULADOR DE ENGANCHE) =====
function verProducto(id) {
    const p = productos.find(x => x.id == id);
    if (!p) return;
    productoActualId = id;

    const modal = document.getElementById("modalProducto");
    const contenido = document.getElementById("contenidoProducto");
    if (!modal || !contenido) return;

    const planes = CalculatorService.calcularCredito(p.precio);
    let tablaHtml = "";
    planes.forEach(plan => {
        tablaHtml += `
            <tr style="border-bottom: 1px solid #f0f0f0;">
                <td style="padding: 12px; text-align: center; font-weight: 600;">${plan.meses}</td>
                <td style="padding: 12px; text-align: center; color: #27ae60; font-weight: bold;">${dinero(plan.total)}</td>
                <td style="padding: 12px; text-align: center; color: #3498db; font-weight: 600;">${dinero(plan.abono)}</td>
            </tr>`;
    });

    contenido.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0; height: 90vh; max-height: 90vh;">
            
            <!-- IMAGEN CON ZOOM -->
            <div class="modal-header-zoom" style="position: relative; overflow: hidden; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); display: flex; justify-content: center; align-items: center; height: 100%;">
                <div style="position: relative; width: 100%; height: 100%; cursor: zoom-in; overflow: auto;" id="zoomContainer">
                    <img id="imgModal" src="${p.imagen || ''}" alt="${p.nombre}" 
                         style="width: 100%; height: 100%; object-fit: contain; padding: 20px; transition: transform 0.1s ease-out; transform: scale(1);"
                         onerror="this.parentElement.innerHTML='<div style=&quot;display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; color:#bdc3c7;&quot;><span style=&quot;font-size:80px;&quot;>📦</span><p>Sin imagen</p></div>'">
                </div>
                <div style="position: absolute; top: 15px; right: 15px; background: rgba(0,0,0,0.6); color: white; padding: 8px 12px; border-radius: 6px; font-size: 12px; font-weight: bold;">
                    🔍 Zoom interactivo
                </div>
            </div>

            <!-- INFORMACIÓN (SCROLLEABLE) -->
            <div style="display: flex; flex-direction: column; padding: 30px; background: white; overflow-y: auto; max-height: 90vh;">
                
                <h2 style="margin: 0 0 15px 0; color: #2c3e50; font-size: 28px;">${p.nombre}</h2>
                
                ${p.color || p.marca || p.modelo ? `
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #f0f0f0;">
                        ${p.color ? `<div><small style="color: #718096; text-transform: uppercase; font-weight: 600;">Color</small><br><strong style="color: #2c3e50;">${p.color}</strong></div>` : ''}
                        ${p.marca ? `<div><small style="color: #718096; text-transform: uppercase; font-weight: 600;">Marca</small><br><strong style="color: #2c3e50;">${p.marca}</strong></div>` : ''}
                        ${p.modelo ? `<div><small style="color: #718096; text-transform: uppercase; font-weight: 600;">Modelo</small><br><strong style="color: #2c3e50;">${p.modelo}</strong></div>` : ''}
                    </div>
                ` : ''}

                <!-- PRECIO DESTACADO -->
                <div style="background: linear-gradient(135deg, #27ae60 0%, #229954 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; text-align: center;">
                    <small style="opacity: 0.9; text-transform: uppercase; letter-spacing: 1px;">Precio al Contado</small>
                    <h3 style="margin: 10px 0; font-size: 32px;">${dinero(p.precio)}</h3>
                </div>

                <!-- SIMULADOR DE ENGANCHE -->
                <div style="background: #fffbeb; border: 2px solid #f59e0b; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 12px 0; color: #92400e; font-size: 14px;">💡 Simula tu Enganche</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
                        <div>
                            <label style="font-size: 12px; color: #92400e; font-weight: bold;">Enganche ($):</label>
                            <input type="number" id="engancheSimulado" 
                                   min="0" 
                                   max="${p.precio}" 
                                   value="0" 
                                   placeholder="0"
                                   onchange="actualizarSimuladorEnganche(${p.precio})"
                                   oninput="actualizarSimuladorEnganche(${p.precio})"
                                   style="width: 100%; padding: 10px; border: 2px solid #f59e0b; border-radius: 6px; font-size: 14px; font-weight: bold; color: #92400e;">
                        </div>
                        <div>
                            <label style="font-size: 12px; color: #92400e; font-weight: bold;">Porcentaje:</label>
                            <input type="number" id="porcentajeEnganche" 
                                   min="0" 
                                   max="100" 
                                   value="0" 
                                   placeholder="0%"
                                   onchange="actualizarSimuladorPorcentaje(${p.precio})"
                                   oninput="actualizarSimuladorPorcentaje(${p.precio})"
                                   style="width: 100%; padding: 10px; border: 2px solid #f59e0b; border-radius: 6px; font-size: 14px; font-weight: bold; color: #92400e;">
                        </div>
                    </div>
                    <div id="resumenEnganche" style="background: white; padding: 12px; border-radius: 6px; text-align: center; font-size: 13px;">
                        <small style="color: #78350f;">Saldo a financiar: <strong style="color: #f59e0b; font-size: 16px;">${dinero(p.precio)}</strong></small>
                    </div>
                </div>

                <!-- PLANES DE CRÉDITO CON SIMULACIÓN -->
                <div style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 15px 0; color: #2c3e50; font-size: 16px;">💳 Planes de Financiamiento</h4>
                    <table style="width: 100%; border-collapse: collapse;" id="tablaPlanesSimulada">
                        <thead>
                            <tr style="background: #f8f9fa; border-bottom: 2px solid #e2e8f0;">
                                <th style="padding: 12px; text-align: center; font-weight: 600; color: #4a5568;">Meses</th>
                                <th style="padding: 12px; text-align: center; font-weight: 600; color: #4a5568;">Total</th>
                                <th style="padding: 12px; text-align: center; font-weight: 600; color: #4a5568;">Abono Semanal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tablaHtml}
                        </tbody>
                    </table>
                </div>

                <!-- BOTONES (PEGADOS AL FONDO) -->
                <div style="display: flex; gap: 10px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #f0f0f0; position: sticky; bottom: 0; background: white;">
                    <button onclick="agregarAlCarritoDesdeModal()" 
                            style="flex: 1; padding: 14px; background: linear-gradient(135deg, #27ae60 0%, #229954 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 16px; transition: all 0.2s; box-shadow: 0 4px 12px rgba(39, 174, 96, 0.2);">
                        🛒 Agregar al Carrito
                    </button>
                    <button onclick="cerrarProducto()" 
                            style="flex: 1; padding: 14px; background: #e2e8f0; color: #2c3e50; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 16px; transition: all 0.2s;">
                        ✕ Cerrar
                    </button>
                </div>

            </div>
        </div>
    `;

    modal.classList.remove("oculto");
    modal.style.display = 'flex';

    // Zoom interactivo mejorado
    setTimeout(() => {
        const img = document.getElementById('imgModal');
        const container = document.getElementById('zoomContainer');
        
        if (img && container) {
            let isZoomed = false;

            container.addEventListener('mousemove', (e) => {
                if (!isZoomed) return;

                const rect = container.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;

                img.style.transformOrigin = `${x}% ${y}%`;
                img.style.transform = "scale(2.5)";
            });

            container.addEventListener('mouseleave', () => {
                img.style.transform = "scale(1)";
                img.style.transformOrigin = "center";
            });

            container.addEventListener('click', () => {
                isZoomed = !isZoomed;
                if (isZoomed) {
                    img.style.transform = "scale(2.5)";
                    container.style.cursor = "zoom-out";
                } else {
                    img.style.transform = "scale(1)";
                    container.style.cursor = "zoom-in";
                }
            });

            // Scroll para zoom
            container.addEventListener('wheel', (e) => {
                e.preventDefault();
                const currentScale = img.style.transform.match(/scale\(([\d.]+)\)/)?.[1] || 1;
                let newScale = parseFloat(currentScale) + (e.deltaY > 0 ? -0.1 : 0.1);
                newScale = Math.max(1, Math.min(3, newScale));
                img.style.transform = `scale(${newScale})`;
            });
        }
    }, 100);
}

// ===== SIMULADOR DE ENGANCHE =====
/**
 * Actualiza la simulación de enganche cuando el usuario ingresa un monto
 * @param {number} precioTotal - Precio original del producto
 */
function actualizarSimuladorEnganche(precioTotal) {
    const engancheInput = document.getElementById("engancheSimulado");
    const porcentajeInput = document.getElementById("porcentajeEnganche");
    const resumenDiv = document.getElementById("resumenEnganche");
    const tablaPlanesDiv = document.getElementById("tablaPlanesSimulada");
    
    if (!engancheInput) return;
    
    const enganche = parseFloat(engancheInput.value) || 0;
    const saldoFinanciar = Math.max(0, precioTotal - enganche);
    
    // Validar que no supere el precio total
    if (enganche > precioTotal) {
        engancheInput.value = precioTotal;
        return;
    }
    
    // Actualizar porcentaje
    const porcentaje = precioTotal > 0 ? ((enganche / precioTotal) * 100).toFixed(1) : 0;
    if (porcentajeInput) {
        porcentajeInput.value = porcentaje;
    }
    
    // Actualizar resumen
    if (resumenDiv) {
        resumenDiv.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                <div>
                    <small style="color: #78350f;">Enganche:</small><br>
                    <strong style="color: #f59e0b; font-size: 16px;">${dinero(enganche)}</strong>
                </div>
                <div>
                    <small style="color: #78350f;">Porcentaje:</small><br>
                    <strong style="color: #f59e0b; font-size: 16px;">${porcentaje}%</strong>
                </div>
                <div>
                    <small style="color: #78350f;">A Financiar:</small><br>
                    <strong style="color: #27ae60; font-size: 16px;">${dinero(saldoFinanciar)}</strong>
                </div>
            </div>
        `;
    }
    
    // Actualizar tabla de planes
    actualizarTablaPlanesSimulada(saldoFinanciar, tablaPlanesDiv);
}

/**
 * Actualiza la simulación de enganche cuando el usuario ingresa un porcentaje
 * @param {number} precioTotal - Precio original del producto
 */
function actualizarSimuladorPorcentaje(precioTotal) {
    const engancheInput = document.getElementById("engancheSimulado");
    const porcentajeInput = document.getElementById("porcentajeEnganche");
    const resumenDiv = document.getElementById("resumenEnganche");
    const tablaPlanesDiv = document.getElementById("tablaPlanesSimulada");
    
    if (!porcentajeInput) return;
    
    const porcentaje = parseFloat(porcentajeInput.value) || 0;
    let enganche = (porcentaje / 100) * precioTotal;
    enganche = Math.min(enganche, precioTotal);
    enganche = Math.max(0, enganche);
    
    // Validar porcentaje
    if (porcentaje > 100) {
        porcentajeInput.value = 100;
        enganche = precioTotal;
    }
    
    if (porcentaje < 0) {
        porcentajeInput.value = 0;
        enganche = 0;
    }
    
    const saldoFinanciar = Math.max(0, precioTotal - enganche);
    
    // Actualizar enganche
    if (engancheInput) {
        engancheInput.value = enganche.toFixed(2);
    }
    
    // Actualizar resumen
    if (resumenDiv) {
        resumenDiv.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                <div>
                    <small style="color: #78350f;">Enganche:</small><br>
                    <strong style="color: #f59e0b; font-size: 16px;">${dinero(enganche)}</strong>
                </div>
                <div>
                    <small style="color: #78350f;">Porcentaje:</small><br>
                    <strong style="color: #f59e0b; font-size: 16px;">${porcentaje}%</strong>
                </div>
                <div>
                    <small style="color: #78350f;">A Financiar:</small><br>
                    <strong style="color: #27ae60; font-size: 16px;">${dinero(saldoFinanciar)}</strong>
                </div>
            </div>
        `;
    }
    
    // Actualizar tabla de planes
    actualizarTablaPlanesSimulada(saldoFinanciar, tablaPlanesDiv);
}

/**
 * Actualiza la tabla de planes según el saldo a financiar
 * @param {number} saldoFinanciar - Monto a financiar después del enganche
 * @param {HTMLElement} tablaPlanesDiv - Contenedor de la tabla
 */
function actualizarTablaPlanesSimulada(saldoFinanciar, tablaPlanesDiv) {
    if (!tablaPlanesDiv || saldoFinanciar <= 0) return;
    
    // Si no hay saldo a financiar, mostrar solo enganche
    if (saldoFinanciar === 0) {
        tablaPlanesDiv.innerHTML = `
            <thead>
                <tr style="background: #f8f9fa; border-bottom: 2px solid #e2e8f0;">
                    <th style="padding: 12px; text-align: center; font-weight: 600; color: #4a5568;">Meses</th>
                    <th style="padding: 12px; text-align: center; font-weight: 600; color: #4a5568;">Total</th>
                    <th style="padding: 12px; text-align: center; font-weight: 600; color: #4a5568;">Abono Semanal</th>
                </tr>
            </thead>
            <tbody>
                <tr style="background: #f0fdf4; border-bottom: 1px solid #f0f0f0;">
                    <td colspan="3" style="padding: 20px; text-align: center; color: #27ae60; font-weight: bold;">
                        ✅ Pagado al contado (sin financiamiento)
                    </td>
                </tr>
            </tbody>
        `;
        return;
    }
    
    // Calcular planes con el nuevo saldo
    const planesSimulados = CalculatorService.calcularCredito(saldoFinanciar);
    
    let tablaHtml = `
        <thead>
            <tr style="background: #f8f9fa; border-bottom: 2px solid #e2e8f0;">
                <th style="padding: 12px; text-align: center; font-weight: 600; color: #4a5568;">Meses</th>
                <th style="padding: 12px; text-align: center; font-weight: 600; color: #4a5568;">Total</th>
                <th style="padding: 12px; text-align: center; font-weight: 600; color: #4a5568;">Abono Semanal</th>
            </tr>
        </thead>
        <tbody>
    `;
    
    planesSimulados.forEach(plan => {
        tablaHtml += `
            <tr style="border-bottom: 1px solid #f0f0f0;">
                <td style="padding: 12px; text-align: center; font-weight: 600;">${plan.meses}</td>
                <td style="padding: 12px; text-align: center; color: #27ae60; font-weight: bold;">${dinero(plan.total)}</td>
                <td style="padding: 12px; text-align: center; color: #3498db; font-weight: 600;">${dinero(plan.abono)}</td>
            </tr>
        `;
    });
    
    tablaHtml += `</tbody>`;
    
    tablaPlanesDiv.innerHTML = tablaHtml;
}

/**
 * Cierra el modal de producto
 */
function cerrarProducto() {
    const modal = document.getElementById("modalProducto");
    if (modal) {
        modal.classList.add("oculto");
        modal.style.display = 'none';
    }
}
/**
 * Renderiza la lista de precios completa por categoría
 */
function renderListaPrecios() {
    const contenedor = document.getElementById("listaPrecios");
    if (!contenedor) return;

    if (productos.length === 0) {
        contenedor.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #718096;">
                <h3>📊 No hay productos para mostrar</h3>
            </div>`;
        return;
    }

    // Agrupar productos por categoría y subcategoría
    const productosAgrupados = agruparProductosPorCategoria();

    let html = `
        <div style="padding: 20px;">
            <div style="margin-bottom: 30px;">
                <h1 style="color: #1a3a70; text-align: center; font-size: 28px; margin: 0 0 10px 0;">
                    📊 LISTA DE PRECIOS
                </h1>
                <p style="text-align: center; color: #718096; margin: 0;">
                    Mueblería Mi Pueblito - ${new Date().toLocaleDateString('es-MX')}
                </p>
            </div>
    `;

    // Iterar por cada categoría
    Object.keys(productosAgrupados).sort().forEach(categoria => {
        const subcategorias = productosAgrupados[categoria];

        html += `
            <div style="margin-bottom: 40px; page-break-inside: avoid;">
                <div style="background: linear-gradient(135deg, #1a3a70 0%, #2c5282 100%); color: white; padding: 15px 20px; border-radius: 8px 8px 0 0; margin-bottom: 0;">
                    <h2 style="margin: 0; font-size: 20px;">📦 ${categoria}</h2>
                </div>
        `;

        // Iterar por cada subcategoría
        Object.keys(subcategorias).sort().forEach(subcategoria => {
            const productosSubcat = subcategorias[subcategoria];

            html += `
                <div style="margin-bottom: 20px;">
                    <h3 style="background: #e8f0fe; padding: 12px 20px; margin: 0; color: #1a3a70; font-size: 16px; border-left: 5px solid #3498db;">
                        ${subcategoria}
                    </h3>

                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 13px;">
                            <thead>
                                <tr style="background: #f8f9fa; border-bottom: 2px solid #cbd5e0;">
                                    <th style="padding: 10px 12px; text-align: left; font-weight: 600; color: #2c3e50; border-right: 1px solid #cbd5e0; width: 17%;">
                                        Producto
                                    </th>
                                    <th style="padding: 10px 12px; text-align: right; font-weight: 600; color: #2c3e50; border-right: 1px solid #cbd5e0; width: 10%;">
                                        Contado
                                    </th>
            `;

            // Agregar columnas de planes
            const planesEjemplo = CalculatorService.calcularCredito(1000);
            planesEjemplo.forEach(plan => {
                html += `
                    <th colspan="2" style="padding: 10px 12px; text-align: center; font-weight: 600; color: #2c3e50; border-right: 1px solid #cbd5e0; background: #dbeafe;">
                        ${plan.meses} Mes${plan.meses > 1 ? 'es' : ''}
                    </th>
                `;
            });

            html += `
                                </tr>
                                <tr style="background: #f0f4f8; border-bottom: 1px solid #cbd5e0;">
                                    <th style="padding: 8px 12px; text-align: left; font-weight: 500; color: #4a5568; border-right: 1px solid #cbd5e0;"></th>
                                    <th style="padding: 8px 12px; text-align: right; font-weight: 500; color: #4a5568; border-right: 1px solid #cbd5e0; font-size: 11px;"></th>
            `;

            planesEjemplo.forEach(plan => {
                html += `
                    <th style="padding: 8px 6px; text-align: center; font-weight: 500; color: #4a5568; border-right: 1px solid #cbd5e0; font-size: 11px; background: #e0f2fe;">
                        Semanal
                    </th>
                    <th style="padding: 8px 6px; text-align: center; font-weight: 500; color: #4a5568; border-right: 1px solid #cbd5e0; font-size: 11px; background: #e0f2fe;">
                        Total
                    </th>
                `;
            });

            html += `
                                </tr>
                            </thead>
                            <tbody>
            `;

            // Ordenar productos alfabéticamente por nombre
            productosSubcat.sort((a, b) => a.nombre.localeCompare(b.nombre)).forEach((prod, idx) => {
                const planes = CalculatorService.calcularCredito(prod.precio);
                const colorFila = idx % 2 === 0 ? "#ffffff" : "#f9fafb";

                html += `
                    <tr style="background: ${colorFila}; border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 10px 12px; text-align: left; border-right: 1px solid #e2e8f0;">
                            <strong style="color: #2c3e50; font-size: 13px;">${prod.nombre}</strong>
                            ${prod.color ? `<br><small style="color: #718096; font-size: 11px;">🎨 ${prod.color}</small>` : ''}
                            ${prod.marca ? `<br><small style="color: #718096; font-size: 11px;">🏷️ ${prod.marca}</small>` : ''}
                        </td>
                        <td style="padding: 10px 12px; text-align: right; border-right: 1px solid #e2e8f0; font-weight: bold; color: #27ae60; font-size: 12px;">
                            ${dinero(prod.precio)}
                        </td>
                `;

                // Agregar totales y semanales por plan
                planes.forEach(plan => {
                    html += `
                        <td style="padding: 10px 6px; text-align: right; border-right: 1px solid #e2e8f0; color: #3498db; font-weight: 600; font-size: 12px;">
                            ${dinero(plan.abono)}
                        </td>
                        <td style="padding: 10px 6px; text-align: right; border-right: 1px solid #e2e8f0; color: #2c3e50; font-weight: 600; font-size: 12px;">
                            ${dinero(plan.total)}
                        </td>
                    `;
                });

                html += `
                    </tr>
                `;
            });

            html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        });

        html += `
            </div>
        `;
    });

    // Pie
    html += `
            <div style="margin-top: 40px; padding: 20px; background: #f8f9fa; border-radius: 8px; border-left: 5px solid #3498db;">
                <p style="margin: 10px 0; font-size: 12px; color: #718096;">
                    <strong>📝 Notas:</strong>
                </p>
                <ul style="margin: 10px 0; padding-left: 20px; font-size: 12px; color: #718096;">
                    <li>Los precios mostrados son vigentes a partir de ${new Date().toLocaleDateString('es-MX')}</li>
                    <li>Se manejan plazos semanales para el pago</li>
                    <li>Sujeto a disponibilidad de inventario</li>
                    <li>Para más información contacte con nuestro equipo de ventas</li>
                </ul>
                <p style="margin: 10px 0; font-size: 12px; color: #718096;">
                    <strong>🏢 Mueblería Mi Pueblito</strong> - Santiago Cuaula, Tlaxcala
                </p>
            </div>

            <div style="margin-top: 30px; display: flex; gap: 10px; justify-content: center; padding-bottom: 40px; flex-wrap: wrap;">
                <button onclick="imprimirListaPrecios()" 
                        style="padding: 12px 24px; background: #3498db; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;">
                    🖨️ Imprimir
                </button>
                <button onclick="exportarListaPreciosCSV()" 
                        style="padding: 12px 24px; background: #27ae60; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;">
                    📥 Descargar Excel
                </button>
                <button onclick="navA('tienda')" 
                        style="padding: 12px 24px; background: #95a5a6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;">
                    ← Volver
                </button>
            </div>
        </div>
    `;

    contenedor.innerHTML = html;
}

/**
 * Agrupa productos por categoría y subcategoría
 * @returns {Object} - Estructura de categorías
 */
function agruparProductosPorCategoria() {
    const agrupados = {};

    productos.forEach(prod => {
        const categoria = prod.categoria || "Sin Categoría";
        const subcategoria = prod.subcategoria || "Sin Subcategoría";

        if (!agrupados[categoria]) {
            agrupados[categoria] = {};
        }

        if (!agrupados[categoria][subcategoria]) {
            agrupados[categoria][subcategoria] = [];
        }

        agrupados[categoria][subcategoria].push(prod);
    });

    return agrupados;
}

/**
 * Imprime la lista de precios sin títulos, optimizado para 2 hojas de ancho
 */
function imprimirListaPrecios() {
    const contenido = document.getElementById("listaPrecios").innerHTML;
    
    if (!contenido) {
        alert("⚠️ No hay contenido para imprimir");
        return;
    }

    const ventanaImpresion = window.open('', '_blank');
    
    const htmlCompleto = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Lista de Precios</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                @page {
                    size: A4 landscape;
                    margin: 8mm;
                }
                
                body {
                    font-family: 'Arial', sans-serif;
                    background: white;
                    padding: 8mm;
                    color: #2c3e50;
                }
                
                .fecha {
                    text-align: right;
                    color: #718096;
                    font-size: 11px;
                    margin-bottom: 10px;
                    padding-right: 10px;
                }
                
                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 12px;
                    margin-bottom: 5px;
                }
                
                th {
                    padding: 8px 8px;
                    text-align: center;
                    font-weight: 600;
                    color: #2c3e50;
                    border-right: 1px solid #cbd5e0;
                    background: #f8f9fa;
                    border-bottom: 2px solid #cbd5e0;
                    white-space: nowrap;
                    font-size: 11px;
                    line-height: 1.2;
                }
                
                td {
                    padding: 7px 8px;
                    border-right: 1px solid #e2e8f0;
                    border-bottom: 1px solid #e2e8f0;
                    text-align: right;
                    font-size: 11px;
                }
                
                td:first-child {
                    text-align: left;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: clip;
                    width: 45%;
                }
                
                strong {
                    font-weight: bold;
                }
                
                small {
                    font-size: 10px;
                    color: #718096;
                }
                
                h2 {
                    margin: 0;
                    font-size: 18px;
                    color: white;
                }
                
                h3 {
                    background: #e8f0fe;
                    padding: 10px 15px;
                    margin: 0;
                    color: #1a3a70;
                    font-size: 14px;
                    border-left: 4px solid #3498db;
                    font-weight: bold;
                }
                
                .categoria-header {
                    background: linear-gradient(135deg, #1a3a70 0%, #2c5282 100%);
                    color: white;
                    padding: 12px 15px;
                    margin: 15px 0 0 0;
                }
                
                .subcategoria-content {
                    margin-bottom: 10px;
                }
                
                div[style*="margin-bottom: 40px"] {
                    margin-bottom: 15px !important;
                    page-break-inside: avoid;
                }
                
                div[style*="margin-bottom: 20px"] {
                    margin-bottom: 8px !important;
                }
                
                div[style*="overflow-x: auto"] {
                    overflow: visible !important;
                }
                
                @media print {
                    body {
                        padding: 5mm;
                    }
                    table {
                        page-break-inside: avoid;
                    }
                    h3 {
                        page-break-inside: avoid;
                    }
                    .categoria-header {
                        page-break-inside: avoid;
                    }
                }
            </style>
        </head>
        <body>
            <div class="fecha">Fecha: ${new Date().toLocaleDateString('es-MX')}</div>
            ${contenido}
        </body>
        </html>
    `;

    ventanaImpresion.document.write(htmlCompleto);
    ventanaImpresion.document.close();
    ventanaImpresion.focus();

    setTimeout(() => {
        ventanaImpresion.print();
    }, 300);
}
/**
 * Exporta la lista de precios a PDF (usando HTML a PDF)
 * Nota: Requiere una librería como html2pdf
 */
function exportarListaPreciosPDF() {
    const contenido = document.getElementById("listaPrecios").innerHTML;
    
    if (!contenido) {
        alert("⚠️ No hay contenido para exportar");
        return;
    }

    // Crear ventana de impresión
    const ventanaImpresion = window.open('', '_blank');
    
    const htmlCompleto = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Lista de Precios - Mueblería Mi Pueblito</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body {
                    font-family: 'Arial', sans-serif;
                    background: white;
                    padding: 20px;
                    line-height: 1.4;
                }
                h1 {
                    color: #1a3a70;
                    text-align: center;
                    font-size: 28px;
                    margin-bottom: 10px;
                }
                h2 {
                    margin: 0;
                    font-size: 20px;
                }
                h3 {
                    padding: 12px 20px;
                    margin: 0;
                    color: #1a3a70;
                    font-size: 16px;
                    border-left: 5px solid #3498db;
                    background: #e8f0fe;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 15px;
                }
                th {
                    padding: 12px 15px;
                    text-align: left;
                    font-weight: 600;
                    color: #2c3e50;
                    border-right: 1px solid #cbd5e0;
                    background: #f8f9fa;
                    border-bottom: 2px solid #cbd5e0;
                    white-space: nowrap;
                }
                td {
                    padding: 12px 15px;
                    border-right: 1px solid #e2e8f0;
                    border-bottom: 1px solid #e2e8f0;
                }
                th[style*="text-right"],
                td[style*="text-right"] {
                    text-align: right;
                }
                .categoria-header {
                    background: linear-gradient(135deg, #1a3a70 0%, #2c5282 100%);
                    color: white;
                    padding: 15px 20px;
                    border-radius: 8px 8px 0 0;
                    margin-bottom: 0;
                    margin-top: 30px;
                }
                .subcategoria-header {
                    background: #e8f0fe;
                    padding: 12px 20px;
                    color: #1a3a70;
                    font-size: 16px;
                    border-left: 5px solid #3498db;
                    font-weight: bold;
                    margin-top: 20px;
                }
                .footer {
                    margin-top: 40px;
                    padding: 20px;
                    background: #f8f9fa;
                    border-radius: 8px;
                    border-left: 5px solid #3498db;
                    font-size: 12px;
                    color: #718096;
                }
                .fecha {
                    text-align: center;
                    color: #718096;
                    margin-bottom: 30px;
                }
                @media print {
                    body { padding: 0; }
                    .no-print { display: none; }
                    table { page-break-inside: avoid; }
                    .categoria-header { page-break-inside: avoid; }
                }
            </style>
        </head>
        <body>
            ${contenido}
        </body>
        </html>
    `;

    ventanaImpresion.document.write(htmlCompleto);
    ventanaImpresion.document.close();
    ventanaImpresion.focus();

    setTimeout(() => {
        ventanaImpresion.print();
    }, 500);
}

/**
 * Genera una previsualización en CSV
 */
function exportarListaPreciosCSV() {
    const productosAgrupados = agruparProductosPorCategoria();
    let csv = "Categoría,Subcategoría,Producto,Color,Marca,Precio Contado";

    // Agregar headers de planes
    const planesEjemplo = CalculatorService.calcularCredito(1000);
    planesEjemplo.forEach(plan => {
        csv += `,${plan.meses}M Total`;
    });

    csv += "\n";

    // Agregar datos
    Object.keys(productosAgrupados).sort().forEach(categoria => {
        const subcategorias = productosAgrupados[categoria];

        Object.keys(subcategorias).sort().forEach(subcategoria => {
            const productosSubcat = subcategorias[subcategoria];

            productosSubcat.sort((a, b) => a.nombre.localeCompare(b.nombre)).forEach(prod => {
                const planes = CalculatorService.calcularCredito(prod.precio);
                
                csv += `"${categoria}","${subcategoria}","${prod.nombre}","${prod.color || ''}","${prod.marca || ''}",${prod.precio}`;
                
                planes.forEach(plan => {
                    csv += `,${plan.total}`;
                });
                
                csv += "\n";
            });
        });
    });

    // Descargar
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `lista-precios-${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
}

function verDetalle(id) { verProducto(id); }
