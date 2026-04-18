// FILTROS DE INVENTARIO
function aplicarFiltros() {
    const catFiltro = document.getElementById("filtroCategoria").value;
    const subFiltro = document.getElementById("filtroSubcategoria").value;
    const busqueda = document.getElementById("busquedaProducto").value.toLowerCase();

    const filtrados = productos.filter(p => {
        const coincideCat = (catFiltro === "todos" || p.categoria === catFiltro);
        const coincideSub = (subFiltro === "todos" || p.subcategoria === subFiltro);
        const coincideNombre = p.nombre.toLowerCase().includes(busqueda);
        return coincideCat && coincideSub && coincideNombre;
    });

    renderInventario(filtrados);
}

function actualizarSubcategoriasFiltro(catId, subId) {
    const catNombre = document.getElementById(catId).value;
    const comboSub = document.getElementById(subId);
    comboSub.innerHTML = '<option value="todos">-- Todas --</option>';

    if (catNombre !== "todos") {
        const categoriaDoc = categoriasData.find(c => c.nombre === catNombre);
        if (categoriaDoc && categoriaDoc.subcategorias) {
            categoriaDoc.subcategorias.forEach(sub => {
                const nombreSub = typeof sub === 'string' ? sub : sub.nombre;
                comboSub.innerHTML += `<option value="${nombreSub}">${nombreSub}</option>`;
            });
        }
    }
    aplicarFiltros();
}

function limpiarFiltros() {
    document.getElementById("filtroCategoria").value = "todos";
    document.getElementById("filtroSubcategoria").innerHTML = '<option value="todos">-- Todas --</option>';
    document.getElementById("busquedaProducto").value = "";
    renderInventario(productos);
}

function actualizarCombosFiltros() {
    const filtroCat = document.getElementById("filtroCategoria");
    const filtroSub = document.getElementById("filtroSubcategoria");
    if (!filtroCat) return;

    const catPrevia = filtroCat.value;
    const subPrevia = filtroSub ? filtroSub.value : "todos";

    let htmlCat = '<option value="todos">-- Todas las Categorías --</option>';
    categoriasData.forEach(cat => {
        htmlCat += `<option value="${cat.nombre}">${cat.nombre}</option>`;
    });
    filtroCat.innerHTML = htmlCat;
    filtroCat.value = catPrevia || "todos";

    if (filtroSub) {
        let htmlSub = '<option value="todos">-- Todas las Subcategorías --</option>';
        if (filtroCat.value !== "todos") {
            const catInfo = categoriasData.find(c => c.nombre === filtroCat.value);
            if (catInfo && catInfo.subcategorias) {
                catInfo.subcategorias.forEach(sub => {
                    htmlSub += `<option value="${sub.nombre}">${sub.nombre}</option>`;
                });
            }
        }
        filtroSub.innerHTML = htmlSub;
        filtroSub.value = subPrevia || "todos";
    }
}

// ===== INVENTARIO =====
function renderInventario(listaAMostrar = productos) {
    const cont = document.getElementById("listaInventario");
    if (!cont) return;

    actualizarCombosFiltros();

    let html = `
        <table class="tabla-admin">
            <thead>
                <tr>
                    <th>Producto</th>
                    <th style="text-align:center;">Stock</th>
                    <th style="text-align:right;">Precio</th>
                    <th style="text-align:center;">Acciones</th>
                </tr>
            </thead>
            <tbody>`;

    if (listaAMostrar.length === 0) {
        html += `<tr><td colspan="4" style="text-align:center; color:gray; padding:20px;">No se encontraron productos.</td></tr>`;
    } else {
        listaAMostrar.forEach(p => {
            const stock = p.stock || 0;
            const colorStock = stock > 0 ? "#27ae60" : "#e74c3c";
            html += `
                <tr>
                    <td>
                        <b>${p.nombre}</b><br>
                        <small style="color:#666;">${p.categoria || ''} > ${p.subcategoria || ''}</small>
                    </td>
                    <td style="text-align:center; font-weight:bold; color:${colorStock};">${stock}</td>
                    <td style="text-align:right;">${dinero(p.precio)}</td>
                    <td style="text-align:center; display:flex; gap:5px; justify-content:center;">
                        <button onclick="abrirProductoForm(${p.id})" 
                                style="padding:6px 10px; cursor:pointer; background:#3498db; color:white; border:none; border-radius:4px; font-weight:bold;">
                            ✏️ Editar
                        </button>
                        <button onclick="abrirVisorMaestro(${p.id})" 
                                style="padding:6px 10px; cursor:pointer; background:#2c3e50; color:white; border:none; border-radius:4px; font-weight:bold;">
                            🔍 Visor
                        </button>
                        <button onclick="confirmarEliminarProducto(${p.id})" 
                                style="padding:6px 10px; cursor:pointer; background:#e74c3c; color:white; border:none; border-radius:4px; font-weight:bold;">
                            🗑️ Eliminar
                        </button>
                    </td>
                </tr>`;
        });
    }

    html += `</tbody></table>`;
    cont.innerHTML = html;
}

function confirmarEliminarProducto(id) {
    const producto = productos.find(p => p.id === id);
    if (!producto) {
        alert("Producto no encontrado.");
        return;
    }

    const mensaje = `⚠️ ¿Eliminar producto: "${producto.nombre}"?\n\nEsta acción no se puede deshacer.`;
    
    if (confirm(mensaje)) {
        eliminarProducto(id);
    }
}

function actualizarStock(id, cant, concepto) {
    const idx = productos.findIndex(p => p.id === id);
    if (idx !== -1) {
        productos[idx].stock = (productos[idx].stock || 0) + cant;
        registrarMovimiento(id, concepto, cant, "entrada");
        if (!StorageService.set("productos", productos)) {
            console.error("❌ Error guardando productos");
        }
    }
}

function registrarMovimiento(productoId, concepto, cantidad, tipo) {
    const movimiento = {
        id: Date.now(),
        productoId: productoId,
        fecha: new Date().toLocaleString(),
        concepto: concepto,
        cantidad: Math.abs(cantidad),
        tipo: tipo
    };
    movimientosInventario.push(movimiento);
    if (!StorageService.set("movimientosInventario", movimientosInventario)) {
        console.error("❌ Error guardando movimientos");
    }
}

// BUG FIX: No inner confirm — confirmarEliminarProducto already asks.
function eliminarProducto(id) {
    productos = productos.filter(p => p.id !== id);
    if (!StorageService.set("productos", productos)) {
        console.error("❌ Error eliminando producto");
        return;
    }
    renderInventario();
}

window.aplicarFiltros = aplicarFiltros;
window.actualizarSubcategoriasFiltro = actualizarSubcategoriasFiltro;
window.limpiarFiltros = limpiarFiltros;
window.actualizarCombosFiltros = actualizarCombosFiltros;
window.renderInventario = renderInventario;
window.confirmarEliminarProducto = confirmarEliminarProducto;
window.actualizarStock = actualizarStock;
window.registrarMovimiento = registrarMovimiento;
window.eliminarProducto = eliminarProducto;
