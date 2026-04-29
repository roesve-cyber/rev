// ===== SELECTOR UNIVERSAL DE PRODUCTOS =====
window.abrirSelectorProducto = function(opciones) {
    const {
        titulo = "🔍 Seleccionar Producto",
        onSeleccion = () => {} // Lo que pasa cuando eliges el producto
    } = opciones || {};

    // Eliminar si ya existe uno abierto
    document.querySelector('[data-modal="universal-picker"]')?.remove();

    const prods = StorageService.get("productos", []);
    const cats = StorageService.get("categoriasData", []);

    // Guardar estado global para navegación interna (back buttons)
    window._pickerState = { cats, prods, onSeleccion };

    const html = `
    <div data-modal="universal-picker" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:10002;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px);">
        <div style="background:white;border-radius:15px;width:100%;max-width:500px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 25px -5px rgba(0,0,0,0.2);">
            
            <div style="padding:20px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
                <h3 style="margin:0;color:#1e40af;">${titulo}</h3>
                <button onclick="this.closest('[data-modal]').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;">✕</button>
            </div>

            <div id="picker-contenido" style="padding:20px;overflow-y:auto;flex:1;">
                </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    renderCategorias(cats, prods, onSeleccion);
};

function renderCategorias(cats, prods, callback) {
    const cont = document.getElementById('picker-contenido');
    cont.innerHTML = '<p style="color:#6b7280;margin-bottom:15px;">Selecciona una categoría:</p>';
    
    cats.forEach(cat => {
        const btn = document.createElement('button');
        btn.innerHTML = `📁 ${cat.nombre}`;
        btn.style = "width:100%;text-align:left;padding:12px;margin-bottom:8px;border:1px solid #e5e7eb;border-radius:8px;background:white;cursor:pointer;font-weight:bold;";
        btn.onclick = () => renderSubcategorias(cat, prods, callback);
        cont.appendChild(btn);
    });
}

function renderSubcategorias(cat, prods, callback) {
    const cont = document.getElementById('picker-contenido');
    cont.innerHTML = `<button onclick="renderCategorias(window._pickerState.cats, window._pickerState.prods, window._pickerState.onSeleccion)" style="background:none;border:none;color:#2563eb;cursor:pointer;margin-bottom:10px;">⬅ Volver a categorías</button>
                      <p style="font-weight:bold;margin-bottom:10px;">${cat.nombre} > Selecciona subcategoría:</p>`;
    
    cat.subcategorias.forEach(sub => {
        const btn = document.createElement('button');
        btn.innerHTML = `🏷️ ${sub.nombre}`;
        btn.style = "width:100%;text-align:left;padding:10px;margin-bottom:5px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;cursor:pointer;";
        btn.onclick = () => renderProductosFinales(cat.nombre, sub.nombre, prods, callback);
        cont.appendChild(btn);
    });
}

function renderProductosFinales(catNom, subNom, prods, callback) {
    const cont = document.getElementById('picker-contenido');
    // Permitir que la subcategoría sea string u objeto, y comparar como lo hace el producto
    const filtrados = prods.filter(p => {
        const catOk = p.categoria === catNom;
        let subProd = p.subcategoria;
        if (typeof subProd === 'object' && subProd !== null) subProd = subProd.nombre;
        return catOk && subProd === subNom;
    });

    const catObj = (window._pickerState?.cats || []).find(c => c.nombre === catNom);
    cont.innerHTML = `<button onclick="catObj ? renderSubcategorias(window._pickerState.cats.find(c=>c.nombre==='${catNom}'), window._pickerState.prods, window._pickerState.onSeleccion) : renderCategorias(window._pickerState.cats, window._pickerState.prods, window._pickerState.onSeleccion)" style="background:none;border:none;color:#2563eb;cursor:pointer;margin-bottom:10px;">⬅ Volver a subcategorías</button>
                      <p style="font-weight:bold;">${catNom} > ${subNom}</p>
                      <p style="color:#6b7280;font-size:12px;margin-bottom:10px;">Elige el producto:</p>`;

    if(filtrados.length === 0) {
        cont.innerHTML += '<p style="color:red;">No hay productos en esta sección.</p>';
    }

    filtrados.forEach(p => {
        const div = document.createElement('div');
        div.style = "display:flex;align-items:center;gap:10px;padding:10px;border:1px solid #eee;border-radius:8px;margin-bottom:8px;cursor:pointer;transition:background:0.2s;";
        div.onmouseover = () => div.style.background = "#f0fdf4";
        div.onmouseout = () => div.style.background = "white";
        div.onclick = () => {
            callback(p); // Ejecuta la acción (comprar, cotizar, etc.)
            document.querySelector('[data-modal="universal-picker"]').remove();
        };

        div.innerHTML = `
            <img src="${p.imagen || 'https://via.placeholder.com/50'}" style="width:50px;height:50px;object-fit:cover;border-radius:4px;">
            <div style="flex:1;">
                <div style="font-weight:bold;font-size:14px;">${p.nombre}</div>
                <div style="font-size:12px;color:#059669;">Stock: ${p.stock || 0} | $${p.precio}</div>
            </div>
        `;
        cont.appendChild(div);
    });
}
