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

window.renderCategorias = renderCategorias;
window.guardarCategoriasConfig = guardarCategoriasConfig;
window.nuevaCategoria = nuevaCategoria;
window.agregarSubcategoria = agregarSubcategoria;
window.eliminarSubcategoria = eliminarSubcategoria;
window.eliminarCategoria = eliminarCategoria;
window.actualizarMargen = actualizarMargen;
