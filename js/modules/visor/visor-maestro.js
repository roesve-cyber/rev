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
                    <img src="${p.imagen || ''}" style="width: 100%; height: 200px; object-fit: contain; margin-bottom: 15px;" onerror="this.style.display='none'">
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
                    <div class="campo" style="grid-column: span 2;"><label>Descripción</label><textarea id="editDescripcion" rows="2">${p.descripcion || ''}</textarea></div>
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
    p.costo        = parseFloat(document.getElementById("editCosto")?.value) || p.costo;
    p.precio       = parseFloat(document.getElementById("editPrecio")?.value) || p.precio;
    p.descripcion  = document.getElementById("editDescripcion")?.value || '';

    if (!StorageService.set("productos", productos)) {
        alert("❌ Error guardando cambios");
        return;
    }
    renderInventario();
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

window.abrirVisorMaestro = abrirVisorMaestro;
window.mostrarDetalleProductoMaestro = mostrarDetalleProductoMaestro;
window.renderFilasKardex = renderFilasKardex;
window.actualizarSubcategoriasVisor = actualizarSubcategoriasVisor;
window.guardarCambiosVisor = guardarCambiosVisor;
window.recalcularRentabilidad = recalcularRentabilidad;
