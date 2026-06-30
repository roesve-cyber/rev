// ============================================================================
// MODAL UNIVERSAL: SELECTOR DE PRODUCTOS (CON BUSCADOR Y NAVEGACIÓN CORREGIDA)
// ============================================================================

window.abrirSelectorProducto = function(opciones) {
    const {
        titulo = "🔍 Seleccionar Producto",
        onSeleccion = () => {},
        incluirInactivos = false,
        // 'precio' = precio cobrado al cliente (ventas/cotizaciones).
        // 'costo'  = costo de compra al proveedor (ordenes de compra).
        // No es lo mismo: cada modulo debe pedir el campo que le corresponde.
        campoPrecio = 'precio'
    } = opciones || {};

    // Obtener catálogo fresco
    const productosBase = StorageService.get("productos", []);
    const prods = incluirInactivos || typeof window.filtrarProductosActivos !== 'function'
        ? productosBase
        : window.filtrarProductosActivos(productosBase);
    const cats = StorageService.get("categoriasData", []);

    // Guardar estado global para navegación interna
    window._pickerState = { cats, prods, onSeleccion };

    // Agrupar productos en un árbol para búsqueda rápida
    const arbol = {};
    prods.forEach(p => {
        const c = p.categoria || 'Sin Categoría';
        const s = typeof p.subcategoria === 'object' && p.subcategoria !== null ? p.subcategoria.nombre : (p.subcategoria || 'General');
        if (!arbol[c]) arbol[c] = {};
        if (!arbol[c][s]) arbol[c][s] = [];
        arbol[c][s].push(p);
    });

    const modalId = 'modal-picker-' + Date.now();
    
    // Eliminar si ya existe uno abierto
    document.querySelector('[data-modal="universal-picker"]')?.remove();
    
    // 1. Construir la Interfaz HTML
    const html = `
    <div data-modal="universal-picker" id="${modalId}" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10002;display:flex;justify-content:center;align-items:flex-start;padding:20px;overflow-y:auto;backdrop-filter:blur(3px);">
        <div style="background:white;width:100%;max-width:850px;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.2);overflow:hidden;margin-top:20px;display:flex;flex-direction:column;max-height:85vh;">
            
            <div style="display:flex;justify-content:space-between;align-items:center;padding:15px 20px;background:#1e40af;color:white;">
                <h2 style="margin:0;font-size:18px;">${titulo}</h2>
                <button onclick="document.getElementById('${modalId}').remove()" style="background:none;border:none;color:white;font-size:24px;cursor:pointer;line-height:1;">&times;</button>
            </div>

            <div style="padding:15px 20px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
                <input type="text" id="${modalId}-buscador" placeholder="🔍 Buscar producto por nombre, código o características..." 
                       style="width:100%;padding:12px;border:2px solid #3b82f6;border-radius:8px;font-size:16px;box-sizing:border-box; outline:none;">
            </div>

            <div id="${modalId}-breadcrumb" style="padding:12px 20px;background:#eff6ff;border-bottom:1px solid #bfdbfe;font-size:14px;color:#1e40af;font-weight:bold;display:flex;align-items:center;gap:8px;">
                </div>

            <div id="${modalId}-contenido" style="padding:20px;flex:1;overflow-y:auto;display:grid;grid-template-columns:repeat(auto-fill, minmax(180px, 1fr));gap:15px; background:#f4f6f8;">
            </div>
        </div>
    </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', html);

    const contenido = document.getElementById(`${modalId}-contenido`);
    const breadcrumb = document.getElementById(`${modalId}-breadcrumb`);
    const buscador = document.getElementById(`${modalId}-buscador`);

    // 2. Funciones de Renderizado (Navegación Corregida)
    
    const renderCategorias = () => {
        breadcrumb.innerHTML = `<span>🏠 Categorías</span>`;
        contenido.innerHTML = '';
        contenido.style.gridTemplateColumns = 'repeat(auto-fill, minmax(180px, 1fr))';
        
        Object.keys(arbol).forEach(cat => {
            const btn = document.createElement('button');
            btn.style.cssText = "padding:20px 15px;background:white;border:1px solid #cbd5e1;border-radius:8px;cursor:pointer;font-weight:bold;font-size:15px;color:#0f172a;transition:0.2s;text-align:center;box-shadow:0 2px 4px rgba(0,0,0,0.05);";
            btn.onmouseover = () => btn.style.borderColor = '#3b82f6';
            btn.onmouseout = () => btn.style.borderColor = '#cbd5e1';
            btn.innerHTML = `📁<br><span style="display:block;margin-top:8px;">${cat}</span>`;
            btn.onclick = () => renderSubcategorias(cat);
            contenido.appendChild(btn);
        });
    };

    const renderSubcategorias = (cat) => {
        breadcrumb.innerHTML = `
            <span style="cursor:pointer;text-decoration:underline;" id="${modalId}-btnCat">🏠 Categorías</span> 
            <span style="color:#64748b;">></span> 
            <span>📁 ${cat}</span>
        `;
        document.getElementById(`${modalId}-btnCat`).onclick = renderCategorias;

        contenido.innerHTML = '';
        contenido.style.gridTemplateColumns = 'repeat(auto-fill, minmax(180px, 1fr))';
        
        Object.keys(arbol[cat]).forEach(sub => {
            const btn = document.createElement('button');
            btn.style.cssText = "padding:20px 15px;background:#e0f2fe;border:1px solid #bae6fd;border-radius:8px;cursor:pointer;font-weight:bold;font-size:14px;color:#0369a1;transition:0.2s;text-align:center;box-shadow:0 2px 4px rgba(0,0,0,0.05);";
            btn.onmouseover = () => btn.style.borderColor = '#0284c7';
            btn.onmouseout = () => btn.style.borderColor = '#bae6fd';
            btn.innerHTML = `📂<br><span style="display:block;margin-top:8px;">${sub}</span>`;
            btn.onclick = () => renderProductos(cat, sub);
            contenido.appendChild(btn);
        });
    };

    const renderProductos = (cat, sub, listaBuscador = null) => {
        if (!listaBuscador) {
            breadcrumb.innerHTML = `
                <span style="cursor:pointer;text-decoration:underline;" id="${modalId}-btnCat2">🏠 Categorías</span> 
                <span style="color:#64748b;">></span> 
                <span style="cursor:pointer;text-decoration:underline;" id="${modalId}-btnSub">📁 ${cat}</span>
                <span style="color:#64748b;">></span> 
                <span>📦 ${sub}</span>
            `;
            document.getElementById(`${modalId}-btnCat2`).onclick = renderCategorias;
            document.getElementById(`${modalId}-btnSub`).onclick = () => renderSubcategorias(cat); 
        } else {
            breadcrumb.innerHTML = `
                <span style="cursor:pointer;text-decoration:underline;color:#dc2626;" id="${modalId}-btnLimpiar">✖ Borrar Búsqueda</span> 
                <span style="color:#64748b;">></span> 
                <span>🔍 Mostrando resultados...</span>
            `;
            document.getElementById(`${modalId}-btnLimpiar`).onclick = () => {
                buscador.value = '';
                renderCategorias();
            };
        }

        contenido.innerHTML = '';
        const lista = listaBuscador || arbol[cat][sub];
        
        if (lista.length === 0) {
            contenido.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:30px;color:#64748b;font-size:16px;">No se encontraron productos.</div>`;
            return;
        }

        contenido.style.gridTemplateColumns = 'repeat(auto-fill, minmax(240px, 1fr))'; // Grid más ancho para productos

        const placeholderImg = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 50 50">
                <rect width="50" height="50" rx="4" fill="#f1f5f9"/>
                <path d="M14 34h22l-7-9-5 6-3-4-7 7Z" fill="#cbd5e1"/>
                <circle cx="18" cy="17" r="4" fill="#cbd5e1"/>
            </svg>
        `);

        lista.forEach(prod => {
            const formatDinero = (val) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);
            
            const btn = document.createElement('div');
            btn.style.cssText = "padding:15px;background:white;border:2px solid #e2e8f0;border-radius:8px;cursor:pointer;transition:0.2s;display:flex;align-items:center;gap:12px;box-shadow:0 2px 4px rgba(0,0,0,0.05);";
            btn.onmouseover = () => btn.style.borderColor = '#1e40af';
            btn.onmouseout = () => btn.style.borderColor = '#e2e8f0';
            
            btn.innerHTML = `
                <img src="${prod.imagen || placeholderImg}" style="width:50px;height:50px;object-fit:cover;border-radius:4px;flex-shrink:0;">
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:bold;color:#0f172a;font-size:14px;line-height:1.2;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${prod.nombre}</div>
                    <div style="font-size:11px;color:#64748b;margin-bottom:4px;">${prod.codigo ? `Cód: ${prod.codigo}` : 'Sin código'}</div>
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span style="font-size:11px;color:#64748b;">Stock: <strong style="color:${prod.stock > 0 ? '#16a34a' : '#dc2626'}">${prod.stock || 0}</strong></span>
                        <span style="text-align:right;">
                            ${campoPrecio === 'costo' ? '<small style="display:block;font-size:9px;color:#92400e;font-weight:bold;">COSTO</small>' : ''}
                            <strong style="color:#1e40af;font-size:14px;">${formatDinero(Number(prod[campoPrecio] || 0))}</strong>
                        </span>
                    </div>
                </div>
            `;
            
            btn.onclick = () => {
                document.getElementById(modalId).remove();
                if (onSeleccion) onSeleccion(prod);
            };
            
            contenido.appendChild(btn);
        });
    };

    // 3. Lógica del Buscador
    buscador.addEventListener('input', (e) => {
        const texto = e.target.value.toLowerCase().trim();
        
        if (texto.length === 0) {
            renderCategorias(); 
            return;
        }

        const resultados = prods.filter(p => 
            (p.nombre && p.nombre.toLowerCase().includes(texto)) || 
            (p.codigo && p.codigo.toLowerCase().includes(texto)) ||
            (p.caracteristicas && p.caracteristicas.toLowerCase().includes(texto)) ||
            (p.categoria && p.categoria.toLowerCase().includes(texto))
        );
        
        renderProductos(null, null, resultados);
    });

    // 4. Iniciar mostrando categorías
    renderCategorias();
    
    // Enfocar automáticamente el buscador al abrir
    setTimeout(() => buscador.focus(), 100);
};

// Aliases para asegurar compatibilidad con código anterior si existe
window.renderCategoriasPicker = function() {};
window.renderSubcategoriasPicker = function() {};
window.renderProductosFinalesPicker = function() {};
