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
                    <th>ID</th>
                    <th>Producto</th>
                    <th style="text-align:center;">Stock</th>
                    <th style="text-align:right;">Precio</th>
                    <th style="text-align:center;">Acciones</th>
                </tr>
            </thead>
            <tbody>`;

    if (listaAMostrar.length === 0) {
        html += `<tr><td colspan="5" style="text-align:center; color:gray; padding:20px;">No se encontraron productos.</td></tr>`;
    } else {
        listaAMostrar.forEach(p => {
            const stock = p.stock || 0;
            const colorStock = stock > 0 ? "#27ae60" : "#e74c3c";
            const editandoId = window._editandoIdProducto === p.id;
            html += `
                <tr>
                    <td style="max-width:120px;overflow-x:auto;">
                        ${editandoId
                            ? `<input type=\"text\" id=\"inputEditarId${p.id}\" value=\"${p.id}\" style=\"width:80px;text-align:center;\">`
                            : `<span style=\"display:inline-block;min-width:60px;max-width:110px;overflow-x:auto;\">${p.id}</span>`
                        }
                    </td>
                    <td>
                        <b>${p.nombre}</b><br>
                        <small style=\"color:#666;\">${p.categoria || ''} > ${p.subcategoria || ''}</small>
                        ${p.caracteristicas ? `<div style=\\\"font-size:12px;color:#444;\\\">${p.caracteristicas}</div>` : ""}
                    </td>
                    <td style=\"text-align:center; font-weight:bold; color:${colorStock};\">${stock}</td>
                    <td style=\"text-align:right;\">${dinero(p.precio)}</td>
                    <td style=\"text-align:center; display:flex; gap:5px; justify-content:center;\">
                        <button onclick=\"abrirProductoForm(${p.id})\" 
                                style=\"padding:6px 10px; cursor:pointer; background:#3498db; color:white; border:none; border-radius:4px; font-weight:bold;\">
                            ✏️ Editar
                        </button>
                        <button onclick=\"abrirVisorMaestro(${p.id})\" 
                                style=\"padding:6px 10px; cursor:pointer; background:#2c3e50; color:white; border:none; border-radius:4px; font-weight:bold;\">
                            🔍 Visor
                        </button>
                        <button onclick=\"confirmarEliminarProducto(${p.id})\" 
                                style=\"padding:6px 10px; cursor:pointer; background:#e74c3c; color:white; border:none; border-radius:4px; font-weight:bold;\">
                            🗑️ Eliminar
                        </button>
                        ${editandoId
                            ? `<button onclick=\"guardarNuevoId(${p.id})\" style=\"padding:6px 10px;background:#16a34a;color:white;border:none;border-radius:4px;font-weight:bold;\">Guardar</button>`
                              + `<button onclick=\"cancelarEditarId()\" style=\"padding:6px 10px;background:#aaa;color:white;border:none;border-radius:4px;font-weight:bold;\">Cancelar</button>`
                            : `<button onclick=\"editarIdProducto(${p.id})\" style=\"padding:6px 10px;background:#f59e42;color:white;border:none;border-radius:4px;font-weight:bold;\">Editar ID</button>`
                        }
                    </td>
                </tr>`;
        });
    }

// Estado para saber qué producto está en edición de ID
window._editandoIdProducto = null;

window.editarIdProducto = function(id) {
    window._editandoIdProducto = id;
    renderInventario();
    setTimeout(() => {
        const input = document.getElementById('inputEditarId' + id);
        if (input) input.focus();
    }, 100);
}

window.cancelarEditarId = function() {
    window._editandoIdProducto = null;
    renderInventario();
}

window.guardarNuevoId = async function(idActual) {
    const input = document.getElementById('inputEditarId' + idActual);
    if (!input) return;
    const nuevoId = String(input.value).trim();
    if (!nuevoId) {
        alert('El ID no puede estar vacío.');
        return;
    }
    if (productos.some(p => String(p.id) === nuevoId && String(p.id) !== String(idActual))) {
        alert('Ya existe un producto con ese ID.');
        return;
    }
    const idx = productos.findIndex(p => String(p.id) === String(idActual));
    if (idx !== -1) {
        productos[idx].id = nuevoId;
        if (typeof StorageService?.set === 'function') StorageService.set('productos', productos);
        if (window._firebaseActivo && window._db) {
            try {
                const docRef = window._db.collection('productos').doc(String(idActual));
                const docSnap = await docRef.get();
                if (docSnap.exists) {
                    const data = docSnap.data();
                    await window._db.collection('productos').doc(String(nuevoId)).set(data);
                    await docRef.delete();
                }
            } catch (e) {
                alert('Error actualizando ID en Firestore: ' + (e.message || e));
            }
        }
        window._editandoIdProducto = null;
        renderInventario();
    }
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

function eliminarProducto(id) {
    productos = productos.filter(p => p.id !== id);
    if (!StorageService.set("productos", productos)) {
        console.error("❌ Error eliminando producto");
        return;
    }
    renderInventario();
}

// ===== FORMULARIO DE PRODUCTOS =====
function actualizarSelectorCategorias() {
    const select = document.getElementById("pSubcategoria");
    if (!select) return;
    let options = "";
    categoriasData.forEach(cat => {
        cat.subcategorias.forEach(sub => {
            options += `<option value="${sub.nombre}">${cat.nombre} - ${sub.nombre} (${sub.margen}%)</option>`;
        });
    });
    select.innerHTML = options || "<option>Crea una categoría primero</option>";
}

function abrirProductoForm(id = null) {
    actualizarSelectorCategorias();
    const modal = document.getElementById("modalProductoForm");
    if (!modal) return;

    const inputNombre = document.getElementById("pNombre");
    const inputCosto  = document.getElementById("pCosto");
    const inputPrecio = document.getElementById("pPrecio");
    const inputColor  = document.getElementById("pColor");
    const inputMarca  = document.getElementById("pMarca");
    const inputModelo = document.getElementById("pModelo");
    const inputImagen = document.getElementById("pImagen");
    const inputSub    = document.getElementById("pSubcategoria");

    if (id) {
        productoEditando = id;
        const p = productos.find(prod => prod.id === id);
        if (!p) return;
        document.getElementById("tituloModalProducto").innerText = "✏️ Editar Producto";
        inputNombre.value = p.nombre;
        inputCosto.value  = p.costo || 0;
        if (inputPrecio) inputPrecio.value = p.precio != null ? p.precio : "";
        inputColor.value = p.color || '';
        inputMarca.value = p.marca || '';
        inputModelo.value = p.modelo || '';
        inputImagen.value = p.imagen || '';
        inputSub.value    = p.subcategoria || '';
    } else {
        productoEditando = null;
        document.getElementById("tituloModalProducto").innerText = "📦 Nuevo Producto";
        inputNombre.value = "";
        inputCosto.value  = "";
        if (inputPrecio) inputPrecio.value = "";
        inputColor.value = "";
        inputMarca.value = "";
        inputModelo.value = "";
        inputImagen.value = "";
    }
    modal.classList.remove("oculto");
    modal.style.display = 'flex';
}

function guardarProductoDB() {
    const nombre      = document.getElementById("pNombre").value.trim();
    const costo       = parseFloat(document.getElementById("pCosto").value);
    const precioManual = parseFloat(document.getElementById("pPrecio").value);
    const color       = document.getElementById("pColor").value.trim();
    const marca       = document.getElementById("pMarca").value.trim();
    const modelo      = document.getElementById("pModelo").value.trim();
    const imagen      = document.getElementById("pImagen").value.trim();
    const subcatNombre = document.getElementById("pSubcategoria").value;
    const caracteristicas = document.getElementById("pCaracteristicas")?.value.trim() || "";  // <-- Agregado

    const validacion = ValidatorService.validarProducto({
        nombre, costo, precio: precioManual
    });

    if (!validacion.valid) {
        alert("⚠️ " + validacion.errores.join("\n"));
        return;
    }

    let margenFinal = 30;
    categoriasData.forEach(cat => {
        const sub = cat.subcategorias.find(s => s.nombre === subcatNombre);
        if (sub) margenFinal = sub.margen;
    });

    const precioVenta = precioManual;

    let categoriaPadre = '';
    categoriasData.forEach(cat => {
        if (cat.subcategorias.find(s => s.nombre === subcatNombre)) {
            categoriaPadre = cat.nombre;
        }
    });

    if (productoEditando) {
        const index = productos.findIndex(p => p.id === productoEditando);
        const margenCalculado = CalculatorService.calcularMargen(precioVenta, costo);
        if (index !== -1) {
            productos[index] = {
                ...productos[index],
                nombre, costo,
                margen: margenCalculado,
                precio: precioVenta,
                color, marca, modelo,
                imagen,
                categoria: categoriaPadre,
                subcategoria: subcatNombre,
                caracteristicas // <-- AGREGADO
            };
        }
    } else {
        const margenCalculado = CalculatorService.calcularMargen(precioVenta, costo);
        productos.push({
            id: Date.now(),
            nombre,
            costo,
            margen: margenCalculado,
            precio: precioVenta,
            color, marca, modelo,
            imagen,
            categoria: categoriaPadre,
            subcategoria: subcatNombre,
            caracteristicas, // <-- AGREGADO
            stock: 0
        });
    }

    if (!StorageService.set("productos", productos)) {
        alert("❌ Error guardando producto");
        return;
    }

    cerrarProductoForm();
    renderInventario();
    mostrarProductos();
}
function cerrarProductoForm() {
    const modal = document.getElementById("modalProductoForm");
    if (modal) {
        modal.classList.add("oculto");
        modal.style.display = 'none';
    }
    productoEditando = null;
}

// ===== CÁLCULO AUTOMÁTICO EN FORMULARIO DE PRODUCTOS =====
document.addEventListener('input', (e) => {
    const modal = document.getElementById("modalProductoForm");
    if (!modal || modal.style.display === 'none') {
        return;
    }

    const idElemento = e.target.id;
    
    if (!['pCosto', 'pPrecio', 'pMargenManual', 'pSubcategoria'].includes(idElemento)) {
        return;
    }

    const costo = parseFloat(document.getElementById("pCosto")?.value) || 0;
    const precioActual = parseFloat(document.getElementById("pPrecio")?.value) || 0;
    const margenActual = parseFloat(document.getElementById("pMargenManual")?.value) || 0;
    const subcatNombre = document.getElementById("pSubcategoria")?.value || '';

    let margenCategoria = 30;
    categoriasData.forEach(cat => {
        const sub = cat.subcategorias.find(s => s.nombre === subcatNombre);
        if (sub) margenCategoria = sub.margen;
    });

    if (idElemento === "pCosto") {
        if (costo === 0) return;
        
        const margenAUsar = margenActual > 0 ? margenActual : margenCategoria;
        const precioCalculado = CalculatorService.calcularPrecioDesdeMargen(costo, margenAUsar);
        
        document.getElementById("pPrecio").value = precioCalculado;
        document.getElementById("pMargenManual").value = margenAUsar;
        
        actualizarDisplayProducto(costo, precioCalculado, margenAUsar);
        return;
    }

    if (idElemento === "pPrecio") {
        if (costo === 0 || precioActual === 0) return;
        
        const margenCalculado = CalculatorService.calcularMargen(precioActual, costo);
        
        document.getElementById("pMargenManual").value = margenCalculado.toFixed(1);
        
        actualizarDisplayProducto(costo, precioActual, margenCalculado);
        return;
    }

    if (idElemento === "pMargenManual") {
        if (costo === 0 || margenActual === 0) return;
        
        const precioRecalculado = CalculatorService.calcularPrecioDesdeMargen(costo, margenActual);
        
        document.getElementById("pPrecio").value = precioRecalculado;
        
        actualizarDisplayProducto(costo, precioRecalculado, margenActual);
        return;
    }

    if (idElemento === "pSubcategoria") {
        if (costo === 0) return;
        
        if (margenActual === 0 || margenActual === "") {
            let nuevoMargen = 30;
            categoriasData.forEach(cat => {
                const sub = cat.subcategorias.find(s => s.nombre === subcatNombre);
                if (sub) nuevoMargen = sub.margen;
            });
            
            const precioNuevo = CalculatorService.calcularPrecioDesdeMargen(costo, nuevoMargen);
            
            document.getElementById("pPrecio").value = precioNuevo;
            document.getElementById("pMargenManual").value = nuevoMargen;
            
            actualizarDisplayProducto(costo, precioNuevo, nuevoMargen);
        }
        return;
    }
});

function actualizarDisplayProducto(costo, precio, margen) {
    const ganancia = precio - costo;
    const margenPct = precio > 0 ? parseFloat(margen).toFixed(1) : 0;
    
    const lblMargen = document.getElementById("lblMargenAplicado");
    const lblPrecio = document.getElementById("lblPrecioSugerido");
    const lblGanancia = document.getElementById("lblGananciaPesos");
    
    if (lblMargen) {
        lblMargen.innerText = margenPct;
        if (margenPct < 20) {
            lblMargen.style.color = "#e74c3c";
        } else if (margenPct <= 35) {
            lblMargen.style.color = "#f39c12";
        } else {
            lblMargen.style.color = "#27ae60";
        }
    }
    
    if (lblPrecio) {
        lblPrecio.innerText = dinero(precio);
    }
    
    if (lblGanancia) {
        lblGanancia.innerText = dinero(ganancia > 0 ? ganancia : 0);
        lblGanancia.style.color = ganancia > 0 ? "#27ae60" : "#e74c3c";
    }
}


// ===== CATEGORÍAS =====
function renderCategorias() {
    const contenedor = document.getElementById("listaCategoriasCards");
    if (!contenedor) return;
    contenedor.innerHTML = "";

    categoriasData.forEach((cat, indexCat) => {
        let card = document.createElement("div");
        card.style = "background: white; border-radius: 10px; padding: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border-top: 5px solid #3498db;";

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h3 style="margin:0; color:#2c3e50;">${cat.nombre}</h3>
                <button onclick="eliminarCategoria(${indexCat})" style="background:none; border:none; color:#e74c3c; cursor:pointer; font-size:18px;">🗑️</button>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                    <tr style="border-bottom: 1px solid #eee; text-align: left; color: #7f8c8d;">
                        <th style="padding: 5px;">Subcategoría</th>
                        <th style="padding: 5px; text-align: center;">Margen %</th>
                        <th style="padding: 5px;"></th>
                    </tr>
                </thead>
                <tbody>`;

        cat.subcategorias.forEach((sub, indexSub) => {
            html += `
                <tr style="border-bottom: 1px solid #fafafa;">
                    <td style="padding: 8px 5px;">${sub.nombre}</td>
                    <td style="padding: 8px 5px; text-align: center;">
                        <input type="number" value="${sub.margen}"
                            onchange="actualizarMargen(${indexCat}, ${indexSub}, this.value)"
                            style="width: 55px; text-align: center; border: 1px solid #ddd; border-radius: 4px; padding: 2px;">
                    </td>
                    <td style="text-align: right;">
                        <button onclick="eliminarSubcategoria(${indexCat}, ${indexSub})" style="background:none; border:none; cursor:pointer; color:#e74c3c;">✕</button>
                    </td>
                </tr>`;
        });

        html += `
                </tbody>
            </table>
            <button onclick="agregarSubcategoria(${indexCat})" style="margin-top: 15px; width: 100%; padding: 8px; background: #f8f9fa; border: 1px dashed #cbd5e0; border-radius: 5px; cursor: pointer; font-size: 12px; color: #3498db;">+ Añadir Subcategoría</button>
        `;

        card.innerHTML = html;
        contenedor.appendChild(card);
    });
}

function guardarCategoriasConfig() {
    if (!StorageService.set("categoriasData", categoriasData)) {
        console.error("❌ Error guardando categorías");
        return;
    }
    renderCategorias();
    actualizarCombosFiltros();
}

function nuevaCategoria() {
    const nombre = prompt("Nombre de la nueva categoría (Ej: Comedores, Oficinas):");
    if (nombre && nombre.trim()) {
        categoriasData.push({ nombre: nombre.trim(), subcategorias: [] });
        guardarCategoriasConfig();
    }
}

function agregarSubcategoria(indexCat) {
    const nombre = prompt("Nombre de la subcategoría:");
    const margen = prompt("¿Qué margen de ganancia (%) deseas?", "30");
    if (nombre && margen) {
        categoriasData[indexCat].subcategorias.push({
            nombre: nombre.trim(),
            margen: parseFloat(margen)
        });
        guardarCategoriasConfig();
    }
}

function eliminarSubcategoria(indexCat, indexSub) {
    if (confirm("¿Eliminar subcategoría?")) {
        categoriasData[indexCat].subcategorias.splice(indexSub, 1);
        guardarCategoriasConfig();
    }
}

function eliminarCategoria(index) {
    if (confirm("¿Seguro que quieres eliminar toda la categoría?")) {
        categoriasData.splice(index, 1);
        guardarCategoriasConfig();
    }
}

function actualizarMargen(indexCat, indexSub, nuevoValor) {
    categoriasData[indexCat].subcategorias[indexSub].margen = parseFloat(nuevoValor);
    if (!StorageService.set("categoriasData", categoriasData)) {
        console.error("❌ Error guardando categorías");
    }
}

// ===== VISOR MAESTRO =====
function abrirVisorMaestro(id) {
    navA('productos-visor');
    mostrarDetalleProductoMaestro(id);
}

function mostrarDetalleProductoMaestro(id) {
    const p = productos.find(prod => prod.id == id);
    if (!p) return;

    const cont = document.getElementById("detalle-producto-maestro");
    if (!cont) return;

    const ganancia = (p.precio || 0) - (p.costo || 0);
    const margen = p.precio > 0 ? ((ganancia / p.precio) * 100).toFixed(1) : 0;

    let html = `
        <div style="width: 100%; max-width: 1400px; margin: 0 auto; padding: 10px;">
            <div style="display: grid; grid-template-columns: 300px 1fr 300px; gap: 20px; background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); margin-bottom: 20px;">

                <div style="text-align: center; border-right: 1px solid #eee; padding-right: 20px;">
                    <img id="imgVisorPrevia" src="${p.imagen || ''}" style="width: 100%; height: 200px; object-fit: contain; margin-bottom: 15px;" onerror="this.style.display='none'">
                    <div style="padding: 10px; background: #f8f9fa; border-radius: 8px;">
                        <span style="font-size: 12px; color: #7f8c8d;">STOCK TOTAL</span>
                        <h2 style="margin: 5px 0; color: ${(p.stock || 0) > 0 ? '#27ae60' : '#e74c3c'};">${p.stock || 0} pzs</h2>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; align-content: start;">
                    <div class="campo"><label>Nombre del Producto</label><input type="text" id="editNombre" value="${p.nombre}"></div>
                    <div class="campo"><label>Color</label><input type="text" id="editColor" value="${p.color || ''}"></div>
                    <div class="campo"><label>Marca</label><input type="text" id="editMarca" value="${p.marca || ''}"></div>
                    <div class="campo"><label>Modelo</label><input type="text" id="editModelo" value="${p.modelo || ''}"></div>
                    <div class="campo">
                        <label>Categoría</label>
                        <select id="editCategoria" onchange="actualizarSubcategoriasVisor()">
                            ${categoriasData.map(c => `<option value="${c.nombre}" ${p.categoria === c.nombre ? 'selected' : ''}>${c.nombre}</option>`).join('')}
                        </select>
                    </div>
                    <div class="campo">
                        <label>Subcategoría</label>
                        <select id="editSubcategoria"></select>
                    </div>
                    <div class="campo"><label style="color:#e74c3c;">Costo de Compra ($)</label><input type="number" id="editCosto" value="${p.costo || 0}" oninput="recalcularRentabilidad()"></div>
                    <div class="campo"><label style="color:#27ae60;">Precio de Venta ($)</label><input type="number" id="editPrecio" value="${p.precio || 0}" oninput="recalcularRentabilidad()"></div>
                    
                    <div class="campo" style="grid-column: span 2;">
                        <label>URL de la Imagen</label>
                        <div style="display: flex; gap: 8px;">
                            <input type="text" id="editImagen" value="${p.imagen || ''}" placeholder="https://ejemplo.com/imagen.jpg" style="flex: 1;">
                            <button onclick="document.getElementById('imgVisorPrevia').src = document.getElementById('editImagen').value; document.getElementById('imgVisorPrevia').style.display='block';" 
                                    style="padding: 0 12px; background: #34495e; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                🔄 Probar
                            </button>
                        </div>
                    </div>

                    <div class="campo" style="grid-column: span 2;"><label>Descripción</label><textarea id="editDescripcion" rows="2">${p.descripcion || ''}</textarea></div>
                    <div class="campo" style="grid-column: span 2;">
                        <label>Características (Usa Enter para saltar de línea)</label>
                        <textarea id="editCaracteristicas" rows="4" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px; font-family:inherit;">${p.caracteristicas || ''}</textarea>
                    </div>
                </div>

                <div style="background: #2c3e50; color: white; padding: 20px; border-radius: 10px; display: flex; flex-direction: column; justify-content: center; text-align: center;">
                    <p style="margin:0; font-size: 12px; opacity: 0.8;">RENTABILIDAD BRUTA</p>
                    <h2 id="displayGanancia" style="margin: 10px 0; color: #2ecc71;">${dinero(ganancia)}</h2>
                    <p id="displayMargen" style="margin:0; font-size: 18px; font-weight: bold;">${margen}%</p>
                    <button onclick="guardarCambiosVisor(${p.id})" style="margin-top: 20px; padding: 12px; background: #27ae60; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">💾 GUARDAR TODO</button>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                    <h3 style="color: #27ae60; border-bottom: 2px solid #27ae60; padding-bottom: 10px;">📥 Entradas</h3>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                        <thead><tr style="text-align: left; font-size: 12px; color: #7f8c8d;"><th>Fecha</th><th>Concepto</th><th style="text-align:right;">Cant.</th></tr></thead>
                        <tbody>${renderFilasKardex(id, 'entrada')}</tbody>
                    </table>
                </div>
                <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                    <h3 style="color: #e67e22; border-bottom: 2px solid #e67e22; padding-bottom: 10px;">📤 Salidas</h3>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                        <thead><tr style="text-align: left; font-size: 12px; color: #7f8c8d;"><th>Fecha</th><th>Concepto</th><th style="text-align:right;">Cant.</th></tr></thead>
                        <tbody>${renderFilasKardex(id, 'salida')}</tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    cont.innerHTML = html;
    actualizarSubcategoriasVisor(p.subcategoria);
}

function renderFilasKardex(id, tipoFiltro) {
    const movimientos = movimientosInventario.filter(m => m.productoId == id && m.tipo === tipoFiltro);
    if (movimientos.length === 0) {
        return `<tr><td colspan="3" style="text-align: center; padding: 20px; color: #ccc;">Sin registros de ${tipoFiltro}</td></tr>`;
    }
    return [...movimientos].reverse().map(m => `
        <tr style="border-bottom: 1px solid #f1f1f1; font-size: 13px;">
            <td style="padding: 8px 0;">${m.fecha}</td>
            <td style="padding: 8px 0;">${m.concepto}</td>
            <td style="padding: 8px 0; text-align: right; font-weight: bold;">${m.cantidad}</td>
        </tr>
    `).join('');
}

function actualizarSubcategoriasVisor(valorSeleccionado = "") {
    const cat = document.getElementById("editCategoria")?.value;
    const subSelect = document.getElementById("editSubcategoria");
    if (!subSelect) return;

    let html = '<option value="">-- Seleccionar --</option>';
    if (cat) {
        const catInfo = categoriasData.find(c => c.nombre === cat);
        if (catInfo && catInfo.subcategorias) {
            catInfo.subcategorias.forEach(s => {
                html += `<option value="${s.nombre}" ${valorSeleccionado === s.nombre ? 'selected' : ''}>${s.nombre}</option>`;
            });
        }
    }
    subSelect.innerHTML = html;
}

function guardarCambiosVisor(id) {
    const p = productos.find(prod => prod.id == id);
    if (!p) return;
    if (!confirm(`¿Guardar cambios para "${p.nombre}"?`)) return;

    p.nombre       = document.getElementById("editNombre")?.value || p.nombre;
    p.color        = document.getElementById("editColor")?.value  || '';
    p.marca        = document.getElementById("editMarca")?.value  || '';
    p.modelo       = document.getElementById("editModelo")?.value || '';
    p.categoria    = document.getElementById("editCategoria")?.value || p.categoria;
    p.subcategoria = document.getElementById("editSubcategoria")?.value || p.subcategoria;
    
    // === LÍNEA AGREGADA PARA LA IMAGEN ===
    p.imagen       = document.getElementById("editImagen")?.value || ''; 
    // =====================================

    p.costo        = parseFloat(document.getElementById("editCosto")?.value) || p.costo;
    p.precio       = parseFloat(document.getElementById("editPrecio")?.value) || p.precio;
    p.descripcion  = document.getElementById("editDescripcion")?.value || '';
    p.caracteristicas = document.getElementById("editCaracteristicas")?.value || '';

    if (!StorageService.set("productos", productos)) {
        alert("❌ Error guardando cambios");
        return;
    }
    
    renderInventario(); // Refresca la tabla de productos para mostrar la nueva imagen
    alert("✅ Cambios guardados correctamente.");
}

function recalcularRentabilidad() {
    const costo  = parseFloat(document.getElementById("editCosto")?.value)  || 0;
    const precio = parseFloat(document.getElementById("editPrecio")?.value) || 0;
    const ganancia  = precio - costo;
    const margenPct = CalculatorService.calcularMargen(precio, costo);

    const dispGanancia = document.getElementById("displayGanancia");
    const dispMargen   = document.getElementById("displayMargen");
    if (dispGanancia) dispGanancia.innerText = dinero(ganancia);
    if (dispMargen) {
        dispMargen.innerText = margenPct.toFixed(1) + "%";
        dispMargen.style.color = margenPct < 20 ? "#e74c3c" : margenPct <= 35 ? "#f39c12" : "#27ae60";
    }
}

// ===== IMPORTADOR DE PRODUCTOS (BATCH) =====
function abrirImportadorProductos() {
    const modal = document.getElementById("modalImportador");
    if (modal) {
        modal.classList.remove("oculto");
        modal.style.display = 'flex';
        document.getElementById("textAreaImportador").value = "";
    }
}

function cerrarImportador() {
    const modal = document.getElementById("modalImportador");
    if (modal) {
        modal.classList.add("oculto");
        modal.style.display = 'none';
    }
}

function procesarImportacion() {
    let texto = document.getElementById("textAreaImportador").value.trim();
    
    if (!texto) {
        const fileInput = document.getElementById("fileInputProductos");
        if (!fileInput.files || fileInput.files.length === 0) {
            alert("Por favor selecciona un archivo o pega datos para importar.");
            return;
        }

        const file = fileInput.files[0];
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const contenido = e.target.result;
            procesarDatosImportacion(contenido);
        };
        
        reader.readAsText(file);
        return;
    }

    procesarDatosImportacion(texto);
}
function insertarProductoSistema(p) {
    const validacion = ValidatorService.validarProducto({
        nombre: p.nombre,
        costo: p.costo,
        precio: p.precio
    });

    if (!validacion.valid) {
        return { ok: false, error: validacion.errores.join(", ") };
    }

    // Buscar categoría real
    let categoriaPadre = "";
    let subValida = false;

    categoriasData.forEach(cat => {
        const sub = cat.subcategorias.find(s => s.nombre === p.subcategoria);
        if (sub) {
            categoriaPadre = cat.nombre;
            subValida = true;
        }
    });

    if (!subValida) {
        return { ok: false, error: "Subcategoría no existe" };
    }

    // Evitar duplicados reales
    const duplicado = productos.some(prod =>
        prod.nombre.toUpperCase() === p.nombre.toUpperCase() &&
        prod.modelo === p.modelo &&
        prod.color === p.color
    );

    if (duplicado) {
        return { ok: false, error: "Producto duplicado" };
    }

    const margenCalculado = CalculatorService.calcularMargen(p.precio, p.costo);

    productos.push({
        id: Math.round(Date.now() * 1000 + Math.random() * 1000),
        nombre: p.nombre,
        costo: p.costo,
        precio: p.precio,
        margen: margenCalculado,
        imagen: p.imagen || "",
        color: p.color || "",
        marca: p.marca || "",
        modelo: p.modelo || "",
        categoria: categoriaPadre,
        subcategoria: p.subcategoria,
        stock: p.stock || 0,
        // === LA LÍNEA QUE FALTABA ES ESTA ===
        caracteristicas: p.caracteristicas || "" 
        // ===================================
    });

    return { ok: true };
}
function procesarDatosImportacion(texto) {
    let productosAImportar = [];

    try {
        const json = JSON.parse(texto);
        if (Array.isArray(json)) {
            productosAImportar = json.map((item, idx) => ({
                id: Date.now() + idx,
                nombre: item.nombre || `Producto ${idx}`,
                costo: parseFloat(item.costo) || 0,
                precio: parseFloat(item.precio) || 0,
                margen: item.margen || ((parseFloat(item.precio) - parseFloat(item.costo)) / parseFloat(item.precio) * 100),
                imagen: item.imagen || "",
                color: item.color || "",
                marca: item.marca || "",
                modelo: item.modelo || "",
                categoria: item.categoria || "Sin categoría",
                subcategoria: item.subcategoria || "Sin subcategoría",
                stock: parseInt(item.stock) || 0
            }));
        } else {
            throw new Error("No es un array JSON");
        }
    } catch (e) {
        const lineas = texto.split('\n').filter(l => l.trim());
        if (lineas.length < 2) {
            alert("El CSV debe tener encabezado + al menos 1 fila de datos.");
            return;
        }

        const encabezado = lineas[0].split(',').map(h => h.trim().toLowerCase());
        const idxNombre = encabezado.indexOf('nombre');
        const idxCategoria = encabezado.indexOf('categoría') !== -1 ? encabezado.indexOf('categoría') : encabezado.indexOf('categoria');
        const idxSubcategoria = encabezado.indexOf('subcategoría') !== -1 ? encabezado.indexOf('subcategoría') : encabezado.indexOf('subcategoria');
        const idxCosto = encabezado.indexOf('costo');
        const idxPrecio = encabezado.indexOf('precio');
        const idxImagen = encabezado.indexOf('imagen');
        const idxColor = encabezado.indexOf('color');
        const idxMarca = encabezado.indexOf('marca');
        const idxModelo = encabezado.indexOf('modelo');
        const idxStock = encabezado.indexOf('stock');
        const idxCaracteristicas = encabezado.indexOf('caracteristicas');

        if (idxNombre === -1 || idxCosto === -1 || idxPrecio === -1) {
            alert("CSV debe contener al menos: Nombre, Costo, Precio");
            return;
        }

        for (let i = 1; i < lineas.length; i++) {
            const valores = lineas[i].split(',').map(v => v.trim());
            if (valores.length < 3) continue;

            const nombre = valores[idxNombre] || `Producto ${i}`;
            const categoria = valores[idxCategoria] || "Sin categoría";
            const subcategoria = valores[idxSubcategoria] || "Sin subcategoría";
            const costo = parseFloat(valores[idxCosto]) || 0;
            const precio = parseFloat(valores[idxPrecio]) || 0;
            const imagen = valores[idxImagen] || "";
            const color = valores[idxColor] || "";
            const marca = valores[idxMarca] || "";
            const modelo = valores[idxModelo] || "";
            const stock = parseInt(valores[idxStock]) || 0;
            const caracteristicasStr = idxCaracteristicas !== -1 && valores[idxCaracteristicas] ? valores[idxCaracteristicas].replace(/\|/g, '\n') : "";

            if (nombre && costo > 0 && precio > 0) {
                const margenCalculado = ((precio - costo) / precio * 100);
                productosAImportar.push({
                    id: Date.now() + Math.random() * 100000,
                    nombre,
                    costo,
                    precio,
                    margen: margenCalculado,
                    imagen,
                    color,
                    marca,
                    modelo,
                    categoria,
                    subcategoria,
                    stock,
                    caracteristicas: caracteristicasStr
                });
            }
        }
    }

    if (productosAImportar.length === 0) {
        alert("No se encontraron productos válidos para importar.");
        return;
    }

    const mensaje = `Se van a importar ${productosAImportar.length} productos.\n\n¿Continuar?`;
    if (!confirm(mensaje)) return;

    productosAImportar = productosAImportar.map((p, idx) => ({
        ...p,
        id: Math.round((Date.now() + idx) * 1000 + Math.random() * 1000)
    }));

    let insertados = 0;
let errores = [];

productosAImportar.forEach((p, i) => {
    const resultado = insertarProductoSistema(p);

    if (resultado.ok) {
        insertados++;
    } else {
        errores.push(`Fila ${i + 1}: ${resultado.error}`);
    }
});

    if (!StorageService.set("productos", productos)) {
        alert("❌ Error importando productos");
        return;
    }

    alert(`✅ ${insertados} productos importados\n❌ ${errores.length} errores`);
console.log("Errores importación:", errores);

    cerrarImportador();
    renderInventario();
    mostrarProductos();
}
