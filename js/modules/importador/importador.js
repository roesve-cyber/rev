// ===== IMPORTADOR DE PRODUCTOS =====
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
                    stock
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

    productos = [...productos, ...productosAImportar];
    if (!StorageService.set("productos", productos)) {
        alert("❌ Error importando productos");
        return;
    }

    alert(`✅ ${productosAImportar.length} productos importados exitosamente.`);
    cerrarImportador();
    renderInventario();
    mostrarProductos();
}

// ===== IMPORTADOR CSV (vista importarproductos) =====
function previewProductosCSV() {
    const fileInput = document.getElementById("csvProductos");
    const previewDiv = document.getElementById("previewProductosCSV");
    if (!previewDiv) return;

    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        previewDiv.innerHTML = '<p style="color:#e74c3c;">⚠️ Selecciona un archivo CSV primero.</p>';
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
        const texto = e.target.result.trim();
        const lineas = texto.split('\n').filter(l => l.trim());
        if (lineas.length < 2) {
            previewDiv.innerHTML = '<p style="color:#e74c3c;">⚠️ El CSV debe tener encabezado + al menos 1 fila.</p>';
            return;
        }

        const encabezados = lineas[0].split(',').map(h => h.trim());
        let html = `<p style="color:#27ae60; margin-bottom:10px;">✅ ${lineas.length - 1} productos encontrados.</p>
            <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:12px;">
            <thead><tr style="background:#1a3a70; color:white;">`;
        encabezados.forEach(h => {
            html += `<th style="padding:8px; border:1px solid #ddd;">${h}</th>`;
        });
        html += '</tr></thead><tbody>';

        const maxPreview = Math.min(lineas.length, 6);
        for (let i = 1; i < maxPreview; i++) {
            const valores = lineas[i].split(',');
            html += `<tr style="background:${i % 2 === 0 ? '#f9fafb' : 'white'};">`;
            valores.forEach(v => {
                html += `<td style="padding:6px 8px; border:1px solid #eee;">${v.trim()}</td>`;
            });
            html += '</tr>';
        }
        if (lineas.length > 6) {
            html += `<tr><td colspan="${encabezados.length}" style="padding:8px; text-align:center; color:#718096; font-style:italic;">... y ${lineas.length - 6} más</td></tr>`;
        }
        html += '</tbody></table></div>';
        previewDiv.innerHTML = html;

        // Store text for importarProductosCSV
        previewDiv.dataset.csvTexto = texto;
    };
    reader.readAsText(file);
}

function importarProductosCSV() {
    const previewDiv = document.getElementById("previewProductosCSV");
    const fileInput = document.getElementById("csvProductos");

    let texto = previewDiv && previewDiv.dataset.csvTexto ? previewDiv.dataset.csvTexto : null;

    if (!texto) {
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            alert("⚠️ Primero haz Vista Previa del archivo CSV.");
            return;
        }
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            procesarDatosImportacion(e.target.result.trim());
        };
        reader.readAsText(file);
        return;
    }

    procesarDatosImportacion(texto);
}

window.abrirImportadorProductos = abrirImportadorProductos;
window.cerrarImportador = cerrarImportador;
window.procesarImportacion = procesarImportacion;
window.procesarDatosImportacion = procesarDatosImportacion;
window.previewProductosCSV = previewProductosCSV;
window.importarProductosCSV = importarProductosCSV;
