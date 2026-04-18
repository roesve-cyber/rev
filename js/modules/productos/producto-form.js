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
                subcategoria: subcatNombre
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

window.actualizarSelectorCategorias = actualizarSelectorCategorias;
window.abrirProductoForm = abrirProductoForm;
window.guardarProductoDB = guardarProductoDB;
window.cerrarProductoForm = cerrarProductoForm;
window.actualizarDisplayProducto = actualizarDisplayProducto;
