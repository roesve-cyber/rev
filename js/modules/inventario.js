// 🌍 obtenerFechaCDMX vive en js/services/validator.js — cargado antes que este módulo

// ===== CONSULTA DINÁMICA DE INVENTARIO PROFESIONAL =====
// Devuelve la antigüedad del producto en días, meses o años según la fecha de alta o última entrada
function calcularAntiguedadProducto(p) {
    // Buscar la fecha más reciente de entrada en el kardex para este producto
    let kardex = window.movimientosInventario || [];
    let entradas = kardex.filter(m => m.productoId == p.id && m.tipo === 'entrada');
    let fechaStr = null;
    if (entradas.length > 0) {
        // Tomar la última entrada
        let ultima = entradas.reduce((a, b) => new Date(a.fecha) > new Date(b.fecha) ? a : b);
        fechaStr = ultima.fecha;
    } else if (p.fechaAlta) {
        fechaStr = p.fechaAlta;
    }
    if (!fechaStr) return '-';
    let fecha = new Date(fechaStr);
    if (isNaN(fecha.getTime())) return '-';
    let ahora = new Date();
    let diffMs = ahora - fecha;
    let diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDias < 31) return diffDias + ' días';
    let diffMeses = Math.floor(diffDias / 30.44);
    if (diffMeses < 12) return diffMeses + ' meses';
    let diffAnios = Math.floor(diffMeses / 12);
    return diffAnios + ' años';
}
// ===== REPORTE UNIFICADO: CONSULTA DE INVENTARIO MAESTRA (PRO + VARIANTES) =====
window.renderConsultaInventario = function() {
    const cont = document.getElementById('tablaConsultaInventario');
    if (!cont) return;

    // 1. Obtención de Filtros (Incluyendo el nuevo filtro de Ubicación)
    const cat = document.getElementById('filtroCatInv')?.value || 'todos';
    const sub = document.getElementById('filtroSubInv')?.value || 'todos';
    const stockFiltro = document.getElementById('filtroStockInv')?.value || 'todos';
    const pedidoFiltro = document.getElementById('filtroPedidoInv')?.value || 'todos';
    const ubiFiltro = document.getElementById('filtroUbiInv')?.value || 'todos';

    // 2. Preparación de Datos (Kardex y Órdenes de Compra)
    const kardex = window.movimientosInventario || [];
    const ocs = window.ordenesCompra || [];
    const estadoPedidoPorProd = {};
    
    ocs.forEach(oc => {
        if (!oc.articulos) return;
        oc.articulos.forEach(a => {
            if (!a.productoId) return;
            if (['Borrador', 'Pendiente', 'Pendiente de recibir'].includes(oc.estado)) {
                estadoPedidoPorProd[a.productoId] = 'pendiente';
            } else if (oc.estado === 'Pendiente de baja') {
                estadoPedidoPorProd[a.productoId] = 'baja';
            }
        });
    });

    // 3. Filtrado de Productos
    let productosFiltrados = (window.productos || []).filter(p => {
        const coincideCat = (cat === 'todos' || cat === 'todas' || p.categoria === cat);
        const coincideSub = (sub === 'todos' || sub === 'todas' || p.subcategoria === sub);
        const coincideStock = stockFiltro === 'todos' ? true : (stockFiltro === 'con' ? (p.stock > 0) : (p.stock <= 0));
        const estado = estadoPedidoPorProd[p.id] || 'ninguno';
        const coincidePedido = pedidoFiltro === 'todos' ? true : (pedidoFiltro === estado);
        
        // Nuevo Filtro de Ubicación
        let coincideUbi = true;
        if (ubiFiltro === 'sin_asignar') {
            const stockVar = (p.variantes || []).reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
            coincideUbi = (p.stock > 0 && stockVar < p.stock); // Mostrar si tiene stock general pero no está asignado
        } else if (ubiFiltro !== 'todos') {
            coincideUbi = p.variantes && p.variantes.some(v => v.ubicacion === ubiFiltro && v.stock > 0);
        }
        
        return coincideCat && coincideSub && coincideStock && coincidePedido && coincideUbi;
    });

    // 🚀 ORDENAR ANTES DE DIBUJAR LA TABLA PRO
    productosFiltrados = window.aplicarOrdenamientoInteligente(productosFiltrados, sub);

    // 4. Renderizado de Estructura de Tabla
    let html = `
    <div style="overflow-x:auto; box-shadow:0 4px 12px rgba(0,0,0,0.1); border-radius:12px;">
        <table class="tabla-admin" style="width:100%; border-collapse:collapse; background:white; font-size:14px;">
            <thead>
                <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0;">
                    <th style="padding:15px;">Producto / Categoría</th>
                    <th style="padding:15px; text-align:center;">Stock Total</th>
                    <th style="padding:15px; width: 45%;">Desglose por Ubicación y Color</th>
                    <th style="padding:15px; text-align:right;">Valorización</th>
                    <th style="padding:15px; text-align:center;">Estado</th>
                </tr>
            </thead>
            <tbody>`;

    let totalGlobalUnidades = 0;
    let totalGlobalPesos = 0;

    productosFiltrados.forEach(p => {
        // Lógica de Costo Promedio
        const entradas = kardex.filter(m => String(m.productoId) === String(p.id) && m.tipo === 'entrada');
        let totalCosto = 0, totalCantidadEntrada = 0;
        entradas.forEach(mov => {
            totalCosto += (mov.costoUnitario || 0) * (mov.cantidad || 0);
            totalCantidadEntrada += mov.cantidad || 0;
        });
        const costoPromedio = totalCantidadEntrada > 0 ? (totalCosto / totalCantidadEntrada) : (p.costo || 0);
        const valorTotal = (p.stock || 0) * costoPromedio;

        totalGlobalUnidades += (p.stock || 0);
        totalGlobalPesos += valorTotal;

        // --- LÓGICA DINÁMICA DE VARIANTES Y ASIGNACIÓN ---
        let desgloseHtml = '';
        let totalStockVariantes = 0;

        if (p.variantes && p.variantes.length > 0) {
            p.variantes.forEach(v => totalStockVariantes += (Number(v.stock) || 0));

            desgloseHtml = p.variantes.filter(v => v.stock > 0).map(v => `
                <div style="display:inline-block; background:#f0f9ff; border:1px solid #bae6fd; color:#0369a1; padding:6px 10px; border-radius:8px; margin:3px; font-size:12px;">
                    <span style="color:#0ea5e9;">📍 ${v.ubicacion}</span> | <b>${v.color}</b> 
                    <span style="background:#0284c7;color:white;padding:2px 6px;border-radius:12px;margin-left:5px;font-weight:bold;">${v.stock} pzs</span>
                </div>
            `).join('');
        }

        // Detectar stock huérfano (stock general mayor a la suma de las variantes)
        const stockGeneral = Number(p.stock) || 0;
        const stockSinAsignar = stockGeneral - totalStockVariantes;

        // Panel de Asignación Rápida
        if (stockSinAsignar > 0) {
            const ubicaciones = typeof StorageService !== 'undefined' ? StorageService.get("ubicacionesConfig", []) : [{nombre: 'General'}];
            const selectUbis = ubicaciones.map(u => `<option value="${u.nombre}">${u.nombre}</option>`).join('');

            desgloseHtml += `
                <div style="background:#fffbeb; border:1px dashed #f59e0b; padding:10px; border-radius:8px; margin-top:8px;">
                    <span style="color:#d97706; font-size:12px; font-weight:bold; display:block; margin-bottom:8px;">⚠️ Tienes ${stockSinAsignar} pieza(s) sin ubicación física. Asígnalas ahora:</span>
                    <div style="display:flex; gap:6px; align-items:center;">
                        <select id="qUbi_${p.id}" style="padding:6px; font-size:12px; border:1px solid #fcd34d; border-radius:6px; flex:1;">
                            ${selectUbis}
                        </select>
                        <input id="qCol_${p.id}" type="text" placeholder="Color (Ej: Rojo)" value="General" style="padding:6px; font-size:12px; border:1px solid #fcd34d; border-radius:6px; width:100px;">
                        <button onclick="asignarUbicacionRapida('${p.id}', ${stockSinAsignar})" style="background:#f59e0b; color:white; border:none; padding:6px 12px; border-radius:6px; font-size:12px; cursor:pointer; font-weight:bold; box-shadow:0 2px 4px rgba(245,158,11,0.3);">💾 Guardar</button>
                    </div>
                </div>
            `;
        } else if (!desgloseHtml && stockGeneral <= 0) {
             desgloseHtml = '<span style="color:#94a3b8; font-style:italic;">Sin stock en sistema</span>';
        }

        // Etiquetas de Estado (Pedido y Antigüedad)
        const estadoPedido = estadoPedidoPorProd[p.id] || 'ninguno';
        const labelPedido = estadoPedido === 'pendiente' ? '<span style="color:#f59e42;">● Pedido Pendiente</span>' : 
                            estadoPedido === 'baja' ? '<span style="color:#e11d48;">● Pendiente Baja</span>' : '';
        const antiguedad = typeof calcularAntiguedadProducto === 'function' ? calcularAntiguedadProducto(p) : '-';

        html += `
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:12px;">
                    <div style="font-weight:bold; color:#1e40af;">${p.nombre}</div>
                    <div style="font-size:11px; color:#64748b;">${p.categoria || ''} > ${p.subcategoria || ''}</div>
                </td>
                <td style="padding:12px; text-align:center;">
                    <span style="font-size:18px; font-weight:bold; color:${stockGeneral>0?'#16a34a':'#dc2626'}">${stockGeneral}</span>
                </td>
                <td style="padding:12px;">${desgloseHtml}</td>
                <td style="padding:12px; text-align:right;">
                    <div style="font-weight:bold;">${typeof dinero === 'function' ? dinero(valorTotal) : valorTotal}</div>
                    <div style="font-size:11px; color:#94a3b8;">Costo: ${typeof dinero === 'function' ? dinero(costoPromedio) : costoPromedio}</div>
                </td>
                <td style="padding:12px; text-align:center; line-height:1.2;">
                    <div style="font-size:11px; font-weight:bold;">${labelPedido}</div>
                    <div style="font-size:10px; color:#64748b; margin-top:4px;">Antigüedad: ${antiguedad}</div>
                </td>
            </tr>`;
    });

    // 5. Pie de Tabla con Totales
    html += `
            </tbody>
            <tfoot style="background:#f8fafc; font-weight:bold; border-top:2px solid #cbd5e1;">
                <tr>
                    <td style="padding:15px; text-align:right;">TOTALES:</td>
                    <td style="padding:15px; text-align:center; font-size:18px; color:#16a34a;">${totalGlobalUnidades}</td>
                    <td></td>
                    <td style="padding:15px; text-align:right; font-size:18px; color:#1e40af;">${typeof dinero === 'function' ? dinero(totalGlobalPesos) : totalGlobalPesos}</td>
                    <td></td>
                </tr>
            </tfoot>
        </table>
    </div>`;

    cont.innerHTML = html;
}

// LÓGICA DE ASIGNACIÓN RÁPIDA DE STOCK HUÉRFANO
window.asignarUbicacionRapida = function(id, cantidadAAsignar) {
    const ubi = document.getElementById(`qUbi_${id}`).value;
    const col = document.getElementById(`qCol_${id}`).value.trim() || 'General';

    const p = window.productos.find(x => String(x.id) === String(id));
    if (!p) return alert("Producto no encontrado.");

    if (!confirm(`¿Confirmas enviar ${cantidadAAsignar} pieza(s) de "${p.nombre}" a [${ubi}] con el color [${col}]?`)) return;

    p.variantes = p.variantes || [];

    // Ver si ya hay una "caja" con esa misma ubicación y color para sumarlo ahí
    const existente = p.variantes.find(v => v.ubicacion === ubi && v.color.toUpperCase() === col.toUpperCase());
    if (existente) {
        existente.stock = (Number(existente.stock) || 0) + cantidadAAsignar;
    } else {
        p.variantes.push({ ubicacion: ubi, color: col, stock: cantidadAAsignar });
    }

    if (typeof StorageService !== 'undefined') StorageService.set("productos", window.productos);

    if (typeof renderConsultaInventario === 'function') renderConsultaInventario();
};

window.initConsultaInventario = function() {
    const catSel = document.getElementById('filtroCatInv');
    const subSel = document.getElementById('filtroSubInv');
    const stockSel = document.getElementById('filtroStockInv');
    const pedidoSel = document.getElementById('filtroPedidoInv');
    
    // Inyectar el filtro de Ubicación de forma dinámica si no existe en tu HTML
    let ubiSel = document.getElementById('filtroUbiInv');
    if (!ubiSel && stockSel && stockSel.parentNode) {
        ubiSel = document.createElement('select');
        ubiSel.id = 'filtroUbiInv';
        ubiSel.style = 'padding:8px; border-radius:6px; border:1px solid #d1d5db; margin-left:10px; font-size:14px;';
        stockSel.parentNode.insertBefore(ubiSel, stockSel.nextSibling);
    }

    if (!catSel || !subSel || !stockSel || !pedidoSel) return;

    // Llenar filtro de Ubicaciones
    if (ubiSel) {
        const ubicaciones = typeof StorageService !== 'undefined' ? StorageService.get("ubicacionesConfig", []) : [];
        let ubiOpts = '<option value="todos">🌍 Todas las ubicaciones</option><option value="sin_asignar">⚠️ Sin asignar</option>';
        ubicaciones.forEach(u => ubiOpts += `<option value="${u.nombre}">📍 ${u.nombre}</option>`);
        ubiSel.innerHTML = ubiOpts;
        ubiSel.onchange = renderConsultaInventario;
    }

    let cats = [...new Set((window.productos||[]).map(p=>p.categoria).filter(Boolean))];
    // Ordenar categorías por posición
    const categoriasOrdenadas = (window.categoriasData || [])
        .filter(c => cats.includes(c.nombre))
        .sort((a, b) => (a.posicion || 999) - (b.posicion || 999))
        .map(c => c.nombre);
    const catsOrdenadas = [...categoriasOrdenadas, ...cats.filter(c => !categoriasOrdenadas.includes(c)).sort()];
    
    catSel.innerHTML = '<option value="todos">Todas las categorías</option>' + catsOrdenadas.map(c=>`<option value="${c}">${c}</option>`).join('');
    
    catSel.onchange = function() {
        const cat = catSel.value;
        let subs = (window.productos||[]).filter(p=>cat==='todos'||p.categoria===cat).map(p=>p.subcategoria).filter(Boolean);
        subs = [...new Set(subs)];
        
        // Ordenar subcategorías por posición
        const catData = (window.categoriasData || []).find(c => c.nombre === cat);
        const subsOrdenadas = catData && catData.subcategorias 
            ? catData.subcategorias
                .filter(s => subs.includes(s.nombre))
                .sort((a, b) => (a.posicion || 999) - (b.posicion || 999))
                .map(s => s.nombre)
            : [];
        const subsFinales = [...subsOrdenadas, ...subs.filter(s => !subsOrdenadas.includes(s)).sort()];
        
        subSel.innerHTML = '<option value="todos">Todas las subcategorías</option>' + subsFinales.map(s=>`<option value="${s}">${s}</option>`).join('');
        subSel.value = 'todos';
        renderConsultaInventario();
    };
    
    subSel.onchange = renderConsultaInventario;
    stockSel.onchange = renderConsultaInventario;
    pedidoSel.onchange = renderConsultaInventario;
    catSel.onchange();
    renderConsultaInventario();
}
// === CARGA INICIAL DE STOCK ===
// ============================================================
// MODIFICACIONES PARA CARGA INICIAL DE STOCK (COLORES Y UBICACIÓN)
// ============================================================

function abrirModalCargaInicialStock() {
    const modal = document.getElementById('modalCargaInicialStock');
    if (!modal) return;
    
    // Limpiar campos
    document.getElementById('cargaStockProducto').value = '';
    const display = document.getElementById('cargaStockProducto-display');
    if (display) { display.textContent = 'Sin seleccionar'; display.style.color = '#6b7280'; }
    document.getElementById('cargaStockCantidad').value = '';
    document.getElementById('cargaStockCosto').value = '';
    document.getElementById('cargaStockColor').value = '';
    
    // Llenar ubicaciones automáticamente desde el catálogo que creamos en el Paso 1
    const selectUbicacion = document.getElementById('cargaStockUbicacion');
    if (selectUbicacion) {
        const ubicaciones = StorageService.get("ubicacionesConfig", []);
        let opciones = '<option value="General">-- Ubicación General --</option>';
        ubicaciones.forEach(u => {
            opciones += `<option value="${u.nombre}">${u.nombre}</option>`;
        });
        selectUbicacion.innerHTML = opciones;
    }

    modal.style.display = 'flex';
}

function guardarCargaInicialStock() {
    const idProd = document.getElementById('cargaStockProducto').value;
    const cant = parseInt(document.getElementById('cargaStockCantidad').value);
    const costo = parseFloat(document.getElementById('cargaStockCosto').value) || 0;
    
    // Leemos el color y la ubicación. Si los dejan vacíos, les ponemos "General"
    const color = document.getElementById('cargaStockColor').value.trim() || 'General';
    const ubicacion = document.getElementById('cargaStockUbicacion').value || 'General';

    if (!idProd) return alert('⚠️ Selecciona un producto.');
    if (isNaN(cant) || cant <= 0) return alert('⚠️ Ingresa una cantidad válida mayor a 0.');

    const productos = StorageService.get('productos', []);
    const p = window.productos.find(x => String(x.id) === String(idProd));
    if (!p) return alert('⚠️ Producto no encontrado.');

    // 1. Actualizar el stock general (La suma de todo)
    p.stock = (p.stock || 0) + cant;
    if (costo > 0) p.costo = costo;

    // 2. Actualizar las variantes (Las "cajitas" de Color + Ubicación)
    if (!p.variantes) p.variantes = [];
    
    // Buscar si ya habíamos metido este mismo color en esta misma bodega antes
    const varianteExistente = p.variantes.find(v => 
        (v.color || "General").toUpperCase() === color.toUpperCase() && 
        (v.ubicacion || "General").toUpperCase() === ubicacion.toUpperCase()
    );

    if (varianteExistente) {
        // Si ya existía, solo le sumamos más
        varianteExistente.stock = (Number(varianteExistente.stock) || 0) + cant;
    } else {
        // Si no existía, creamos la nueva "cajita"
        p.variantes.push({
            color: color,
            ubicacion: ubicacion,
            stock: cant
        });
    }

    // Guardar cambios en el catálogo de productos
    StorageService.set('productos', productos);

    // 3. Registrar el movimiento en el historial detallado
    const movimientos = StorageService.get('movimientosInventario', []);
    movimientos.push({
        id: Date.now(),
        productoId: p.id,
        productoNombre: p.nombre,
        tipo: 'entrada',
        cantidad: cant,
        fecha: window.localISO(new Date()),
        concepto: `Carga inicial - Color: ${color} | Ubic: ${ubicacion}`,
        costoUnitario: costo
    });
    StorageService.set('movimientosInventario', movimientos);

    // Actualizar la tabla de inventario si estamos en esa vista
    if (typeof renderInventario === 'function') renderInventario();

    cerrarModalCargaInicialStock();
    alert(`✅ Se agregaron ${cant} piezas a ${ubicacion} (Color: ${color}).\nEl sistema ya lo recuerda para futuras ventas.`);
}

function cerrarModalCargaInicialStock() {
    const modal = document.getElementById('modalCargaInicialStock');
    if (modal) modal.style.display = 'none';
}

// Exponer funciones
window.abrirModalCargaInicialStock = abrirModalCargaInicialStock;
window.guardarCargaInicialStock = guardarCargaInicialStock;
window.cerrarModalCargaInicialStock = cerrarModalCargaInicialStock;
// Solo cuenta cuántos productos tienen IDs duplicados (sin corregir)
window.contarIdsDuplicados = function() {
    const ids = {};
    const duplicados = {};
    window.productos.forEach(p => {
        if (!p.id) return;
        const idStr = String(p.id);
        if (ids[idStr]) {
            duplicados[idStr] = (duplicados[idStr] || 1) + 1;
        } else {
            ids[idStr] = true;
        }
    });
    const totalDuplicados = Object.values(duplicados).reduce((a, b) => a + b, 0);
    if (totalDuplicados > 0) {
        let detalle = Object.entries(duplicados).map(([id, count]) => `ID: ${id} (repetido ${count} veces)`).join('\n');
        alert(`Se encontraron ${Object.keys(duplicados).length} IDs duplicados, total de productos duplicados: ${totalDuplicados}.\n\nDetalle:\n` + detalle);
    } else {
        alert('No se encontraron IDs duplicados.');
    }
}
// Detecta y corrige IDs de productos duplicados
window.detectarYCorregirIdsDuplicados = function() {
    const idsExistentes = new Set();
    let correcciones = 0;

    window.productos.forEach(p => {
        // Si el ID ya existe o no tiene, generamos uno numérico nuevo
        if (!p.id || idsExistentes.has(Number(p.id))) {
            const antiguoId = p.id;
            // Generamos un ID numérico basado en el tiempo + aleatorio
            p.id = Math.round(Date.now() + Math.random() * 1000000);
            correcciones++;
            console.log(`Corregido: Antiguo ID ${antiguoId} -> Nuevo ID ${p.id}`);
        }
        idsExistentes.add(Number(p.id));
    });

    if (correcciones > 0) {
        // Guardar cambios en el almacenamiento local
        if (StorageService.set("productos", window.productos)) {
            alert(`✅ Se repararon ${correcciones} productos con IDs duplicados.\nAhora puedes ver sus detalles normalmente.`);
            // Recargar la tabla para aplicar cambios
            if (typeof renderizarTablaInventario === 'function') renderizarTablaInventario();
        } else {
            alert("❌ Error al guardar los cambios en Storage.");
        }
    } else {
        alert('No se encontraron duplicados para corregir.');
    }
}
// FILTROS DE INVENTARIO
function aplicarFiltros() {
    const catFiltro = document.getElementById("filtroCategoria").value;
    const subFiltro = document.getElementById("filtroSubcategoria").value;
    const busqueda = document.getElementById("busquedaProducto").value.toLowerCase();

    let filtrados = window.productos.filter(p => {
        const coincideCat = (catFiltro === "todos" || p.categoria === catFiltro);
        const coincideSub = (subFiltro === "todos" || p.subcategoria === subFiltro);
        const coincideNombre = p.nombre.toLowerCase().includes(busqueda);
        return coincideCat && coincideSub && coincideNombre;
    });

    // 🚀 PASAR POR EL MOTOR ANTES DE RENDERIZAR
    filtrados = window.aplicarOrdenamientoInteligente(filtrados, subFiltro);

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
    renderInventario(window.productos);
}

function actualizarCombosFiltros() {
    const filtroCat = document.getElementById("filtroCategoria");
    const filtroSub = document.getElementById("filtroSubcategoria");
    if (!filtroCat) return;

    const catPrevia = filtroCat.value;
    const subPrevia = filtroSub ? filtroSub.value : "todos";

    let htmlCat = '<option value="todos">-- Todas las Categorías --</option>';
    // Ordenar categorías por posición
    const categoriasOrdenadas = [...categoriasData].sort((a, b) => (a.posicion || 999) - (b.posicion || 999));
    categoriasOrdenadas.forEach(cat => {
        htmlCat += `<option value="${cat.nombre}">${cat.nombre}</option>`;
    });
    filtroCat.innerHTML = htmlCat;
    filtroCat.value = catPrevia || "todos";

    if (filtroSub) {
        let htmlSub = '<option value="todos">-- Todas las Subcategorías --</option>';
        if (filtroCat.value !== "todos") {
            const catInfo = categoriasData.find(c => c.nombre === filtroCat.value);
            if (catInfo && catInfo.subcategorias) {
                // Ordenar subcategorías por posición
                const subcatOrdenadas = [...catInfo.subcategorias].sort((a, b) => (a.posicion || 999) - (b.posicion || 999));
                subcatOrdenadas.forEach(sub => {
                    htmlSub += `<option value="${sub.nombre}">${sub.nombre}</option>`;
                });
            }
        }
        filtroSub.innerHTML = htmlSub;
        filtroSub.value = subPrevia || "todos";
    }
}

// ===== INVENTARIO =====
function renderInventario(listaAMostrar = window.productos) {
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
            html += `
                <tr>
                    <td>
                        <b>${p.nombre}</b><br>
                        <small style="color:#666;">${p.categoria || ''} > ${p.subcategoria || ''}</small>
                    </td>
                    <td style="text-align:center; font-weight:bold; color:${colorStock};">${stock}</td>
                    <td style="text-align:right;">${dinero(p.precio)}</td>
                    <td style="text-align:center; display:flex; gap:5px; justify-content:center;">
                        <button onclick="abrirProductoForm('${String(p.id)}')" 
                                style="padding:6px 10px; cursor:pointer; background:#3498db; color:white; border:none; border-radius:4px; font-weight:bold;">
                            ✏️ Editar
                        </button>
                        <button onclick="abrirVisorMaestro('${String(p.id)}')" 
                                style="padding:6px 10px; cursor:pointer; background:#2c3e50; color:white; border:none; border-radius:4px; font-weight:bold;">
                            🔍 Visor
                        </button>
                        <button onclick="confirmarEliminarProducto('${String(p.id)}')" 
                                style="padding:6px 10px; cursor:pointer; background:#e74c3c; color:white; border:none; border-radius:4px; font-weight:bold;">
                            🗑️ Eliminar
                        </button>
                        <!-- Editar ID eliminado por requerimiento -->
                    </td>
                </tr>`;
        });
    }

    html += `</tbody></table>`;
    cont.innerHTML = html;
}

function confirmarEliminarProducto(id) {
    const producto = window.productos.find(p => String(p.id) === String(id));
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
    const idx = window.productos.findIndex(p => String(p.id) === String(id));
    if (idx !== -1) {
        window.productos[idx].stock = (window.productos[idx].stock || 0) + cant;
        registrarMovimiento(id, concepto, cant, "entrada");
        if (!StorageService.set("productos", window.productos)) {
            console.error("❌ Error guardando productos");
        }
    }
}

function registrarMovimiento(productoId, concepto, cantidad, tipo) {
    const movimiento = {
        id: Date.now(),
        productoId: productoId,
        fecha: window.localISO(new Date()),
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
    window.productos = window.productos.filter(p => String(p.id) !== String(id));
    if (!StorageService.set("productos", window.productos)) {
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

    let p = null; // <--- CORRECCIÓN: Declaramos 'p' aquí para que exista en toda la función

    if (id) {
        productoEditando = id;
        p = window.productos.find(prod => String(prod.id) === String(id));
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
    
    // --- LÓGICA FINANCIERA DEL PRODUCTO ---
    window._plazosProductoTemp = [];
    if (id && p && p.configCredito && p.configCredito.usaReglaGlobal === false) {
        document.getElementById("pUsaReglaGlobal").checked = false;
        document.getElementById("pPermitirCredito").checked = p.configCredito.permitirCredito;
        window._plazosProductoTemp = p.configCredito.plazos || [];
    } else {
        document.getElementById("pUsaReglaGlobal").checked = true;
        document.getElementById("pPermitirCredito").checked = true;
    }
    if (typeof toggleConfigCreditoProd === "function") {
        toggleConfigCreditoProd();
        _dibujarPlazosProd();
    }
    
    modal.classList.remove("oculto");
    modal.style.display = 'flex';
}

// ===== NUEVA LÓGICA DE VARIANTES (COLOR Y UBICACIÓN) =====

function guardarProductoDB() {
    const nombre = document.getElementById("pNombre").value.trim();
    const costo = parseFloat(document.getElementById("pCosto").value);
    const precioManual = parseFloat(document.getElementById("pPrecio").value);
    const marca = document.getElementById("pMarca").value.trim();
    const modelo = document.getElementById("pModelo").value.trim();
    const imagen = document.getElementById("pImagen").value.trim();
    const subcatNombre = document.getElementById("pSubcategoria").value;
    const caracteristicas = document.getElementById("pCaracteristicas")?.value.trim() || "";

    const validacion = ValidatorService.validarProducto({ nombre, costo, precio: precioManual });
    if (!validacion.valid) return alert("⚠️ " + validacion.errores.join("\n"));

    let categoriaPadre = '';
    categoriasData.forEach(cat => {
        if (cat.subcategorias.find(s => s.nombre === subcatNombre)) categoriaPadre = cat.nombre;
    });

    // Capturar reglas de financiamiento
    const usaGlobal = document.getElementById("pUsaReglaGlobal")?.checked ?? true;
    const permitirCredito = document.getElementById("pPermitirCredito")?.checked ?? true;
    
    const configCredito = usaGlobal ? null : {
        usaReglaGlobal: false,
        permitirCredito: permitirCredito,
        plazos: window._plazosProductoTemp || []
    };

    // Estructura de producto actualizada
    const datosProducto = {
        nombre, costo, precio: precioManual,
        marca, modelo, imagen,
        categoria: categoriaPadre,
        subcategoria: subcatNombre,
        caracteristicas,
        configCredito, // <----- ESTA ES LA LÍNEA MÁGICA
        variantes: productoEditando ? (window.productos.find(p => String(p.id) === String(productoEditando))?.variantes || []) : []
    };

    if (productoEditando) {
        const index = window.productos.findIndex(p => String(p.id) === String(productoEditando));
        if (index !== -1) {
            // Calculamos el stock total sumando todas las variantes para mantener compatibilidad
            const totalStock = datosProducto.variantes.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
            window.productos[index] = { ...window.productos[index], ...datosProducto, stock: totalStock };
        }
    } else {
        window.productos.push({ id: Date.now(), ...datosProducto, stock: 0 });
    }

    if (!StorageService.set("productos", window.productos)) return alert("❌ Error guardando producto");

    cerrarProductoForm();
    renderInventario();
}

// ===== VISOR MAESTRO CON GESTIÓN DE UBICACIONES Y COLORES =====
function mostrarDetalleProductoMaestro(id) {
    const p = window.productos.find(prod => String(prod.id) === String(id));
    if (!p) return;

    const cont = document.getElementById("detalle-producto-maestro");
    if (!cont) return;

    // Asegurar que existan las variantes
    p.variantes = p.variantes || [];
    const totalStock = p.variantes.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);

    // HTML mejorado para el Visor Maestro
    let html = `
        <div style="max-width: 1400px; margin: 0 auto; padding: 10px;">
            <div style="display: grid; grid-template-columns: 300px 1fr 350px; gap: 20px; background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); margin-bottom: 20px;">
                
                <div style="text-align: center; border-right: 1px solid #eee; padding-right: 20px;">
                    <img id="imgVisorPrevia" src="${p.imagen || ''}" style="width: 100%; height: 200px; object-fit: contain; margin-bottom: 15px;">
                    <div style="padding: 15px; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;">
                        <span style="font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase;">Inventario Total</span>
                        <h2 style="margin: 5px 0; color: ${totalStock > 0 ? '#10b981' : '#ef4444'}; font-size: 32px;">${totalStock} <small style="font-size: 14px;">pzs</small></h2>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div class="campo"><label>Nombre</label><input type="text" id="editNombre" value="${p.nombre}"></div>
                    <div class="campo"><label>Marca</label><input type="text" id="editMarca" value="${p.marca || ''}"></div>
                    <div class="campo"><label>Costo</label><input type="number" id="editCosto" value="${p.costo || 0}"></div>
                    <div class="campo"><label>Precio</label><input type="number" id="editPrecio" value="${p.precio || 0}"></div>
                    <div class="campo" style="grid-column: span 2;">
                        <label>Características</label>
                        <textarea id="editCaracteristicas" rows="3" style="width:100%; border-radius:6px; border:1px solid #d1d5db;">${p.caracteristicas || ''}</textarea>
                    </div>
                </div>

                <!-- GESTIÓN DE STOCK POR UBICACIÓN Y COLOR -->
                <div style="background: #f1f5f9; padding: 20px; border-radius: 12px; border: 1px solid #cbd5e1;">
                    <h4 style="margin: 0 0 15px 0; color: #1e293b; font-size: 14px; display: flex; align-items: center; gap: 8px;">📍 Control de Existencias</h4>
                    
                    <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 15px;">
                        <select id="newVarUbicacion" style="padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1;">
                            <option value="Tienda">🏪 Tienda Principal</option>
                            <option value="Bodega">📦 Bodega / Almacén</option>
                        </select>
                        <input type="text" id="newVarColor" placeholder="Color (Ej: Chocolate, Rojo...)" style="padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1;">
                        <div style="display: flex; gap: 5px;">
                            <input type="number" id="newVarCant" placeholder="Cant." style="width: 70px; padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1;">
                            <button onclick="agregarVarianteStock('${p.id}')" style="flex: 1; background: #2563eb; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">+ Añadir</button>
                        </div>
                    </div>

                    <div id="listaVariantes" style="max-height: 180px; overflow-y: auto; background: white; border-radius: 8px; border: 1px solid #cbd5e1;">
                        ${renderTablaVariantes(p.variantes, p.id)}
                    </div>
                    
                    <button onclick="guardarCambiosVisor(${p.id})" style="width: 100%; margin-top: 15px; padding: 12px; background: #10b981; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">💾 GUARDAR CAMBIOS</button>
                </div>
            </div>
            
            <!-- Kardex Histórico (Igual que antes) -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                    <h3 style="color: #10b981; border-bottom: 2px solid #10b981; padding-bottom: 10px;">📥 Entradas</h3>
                    <table><tbody>${renderFilasKardex(id, 'entrada')}</tbody></table>
                </div>
                <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                    <h3 style="color: #f59e0b; border-bottom: 2px solid #f59e0b; padding-bottom: 10px;">📤 Salidas</h3>
                    <table><tbody>${renderFilasKardex(id, 'salida')}</tbody></table>
                </div>
            </div>
        </div>
    `;

    cont.innerHTML = html;
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

    if (typeof categoriasData === 'undefined' || !categoriasData) return;
    
    let necesitaGuardar = false;

    // Migración automática: Agregamos las propiedades 'orden' y 'posicion'
    categoriasData.forEach((cat, idxCat) => {
        // Asegurar posición de categoría
        if (!cat.posicion) {
            cat.posicion = idxCat + 1;
            necesitaGuardar = true;
        }
        
        if (!cat.subcategorias || !Array.isArray(cat.subcategorias)) {
            cat.subcategorias = [];
            necesitaGuardar = true;
        } else {
            cat.subcategorias = cat.subcategorias.map((sub, idxSub) => {
                let s = typeof sub === 'string' ? { nombre: sub, margen: 30 } : sub;
                if (!s.orden) {
                    s.orden = 'nombre_asc'; // Orden por defecto: Nombre A-Z
                    necesitaGuardar = true;
                }
                if (!s.posicion) {
                    s.posicion = idxSub + 1;
                    necesitaGuardar = true;
                }
                return s;
            });
        }
    });

    if (necesitaGuardar && typeof StorageService !== 'undefined') {
        StorageService.set("categoriasData", categoriasData);
    }

    categoriasData.forEach((cat, indexCat) => {
        let card = document.createElement("div");
        card.style = "background: white; border-radius: 10px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border-left: 5px solid #3498db; margin-bottom: 20px;";

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #f0f0f0;">
                <div style="flex: 1;">
                    <h3 style="margin:0 0 5px 0; color:#2c3e50; font-size:16px; font-weight:600;">
                        ${cat.nombre || 'Sin nombre'}
                    </h3>
                    <div style="display: flex; gap: 6px; margin-top: 8px;">
                        <button onclick="editarNombreCategoria(${indexCat})" style="background:#3498db; border:none; color:white; cursor:pointer; padding:6px 12px; border-radius:5px; font-size:12px; font-weight:bold;" title="Editar nombre">✏️ Editar</button>
                        <button onclick="moverCategoriaArriba(${indexCat})" ${indexCat === 0 ? 'disabled' : ''} style="background:#e3f2fd; border:1px solid #bbdefb; border-radius:5px; padding:6px 12px; cursor:${indexCat === 0 ? 'default' : 'pointer'}; color:#1976d2; font-size:12px; font-weight:bold; ${indexCat === 0 ? 'opacity:0.4;' : ''}" title="Mover arriba">↑ Arriba</button>
                        <button onclick="moverCategoriaAbajo(${indexCat})" ${indexCat === categoriasData.length - 1 ? 'disabled' : ''} style="background:#e3f2fd; border:1px solid #bbdefb; border-radius:5px; padding:6px 12px; cursor:${indexCat === categoriasData.length - 1 ? 'default' : 'pointer'}; color:#1976d2; font-size:12px; font-weight:bold; ${indexCat === categoriasData.length - 1 ? 'opacity:0.4;' : ''}" title="Mover abajo">↓ Abajo</button>
                    </div>
                </div>
                <button onclick="eliminarCategoria(${indexCat})" style="background:#fee; border:none; color:#e74c3c; cursor:pointer; padding:8px 14px; border-radius:5px; font-size:13px; font-weight:bold;" title="Eliminar">🗑️ Eliminar</button>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                    <tr style="background:#f8f9fa; border-bottom: 2px solid #e0e0e0; text-align: left; color: #555; font-weight:600;">
                        <th style="padding: 10px 8px;">Subcategoría</th>
                        <th style="padding: 10px 8px; text-align: center;">Margen %</th>
                        <th style="padding: 10px 8px; text-align: center;">Orden</th>
                        <th style="padding: 10px 8px; text-align: center;">Posición</th>
                        <th style="padding: 10px 8px; text-align: right;">Acciones</th>
                    </tr>
                </thead>
                <tbody>`;

        if (cat.subcategorias.length === 0) {
            html += `<tr><td colspan="5" style="text-align:center; padding:20px; color:#999; font-style:italic;">Sin subcategorías</td></tr>`;
        } else {
            cat.subcategorias.forEach((sub, indexSub) => {
                let ord = sub.orden || 'nombre_asc';
                html += `
                    <tr style="border-bottom: 1px solid #f0f0f0; padding: 8px 0;">
                        <td style="padding: 12px 8px; font-weight:600; color:#2c3e50;">${sub.nombre || '---'}</td>
                        <td style="padding: 12px 8px; text-align: center;">
                            <input type="number" value="${sub.margen || 30}"
                                onchange="actualizarMargen(${indexCat}, ${indexSub}, this.value)"
                                style="width: 80px; min-width:70px; text-align: center; border: 1px solid #ddd; border-radius: 4px; padding: 6px 8px; font-size:13px; box-sizing:border-box;">
                        </td>
                        <td style="padding: 12px 8px; text-align: center;">
                            <select onchange="actualizarOrdenSub(${indexCat}, ${indexSub}, this.value)" style="padding:6px; border:1px solid #cbd5e1; border-radius:4px; font-size:11px; min-width:140px;">
                                <option value="nombre_asc" ${ord==='nombre_asc'?'selected':''}>A-Z</option>
                                <option value="nombre_desc" ${ord==='nombre_desc'?'selected':''}>Z-A</option>
                                <option value="precio_desc" ${ord==='precio_desc'?'selected':''}>Mayor precio</option>
                                <option value="precio_asc" ${ord==='precio_asc'?'selected':''}>Menor precio</option>
                                <option value="stock_desc" ${ord==='stock_desc'?'selected':''}>Más stock</option>
                            </select>
                        </td>
                        <td style="padding: 12px 8px; text-align: center;">
                            <button onclick="moverSubcategoriaArriba(${indexCat}, ${indexSub})" ${indexSub === 0 ? 'disabled' : ''} style="background:#e3f2fd; border:1px solid #bbdefb; border-radius:4px; padding:5px 8px; cursor:${indexSub === 0 ? 'default' : 'pointer'}; color:#1976d2; font-size:11px; font-weight:bold; ${indexSub === 0 ? 'opacity:0.3;' : ''}" title="Mover arriba">↑</button>
                            <button onclick="moverSubcategoriaAbajo(${indexCat}, ${indexSub})" ${indexSub === cat.subcategorias.length - 1 ? 'disabled' : ''} style="background:#e3f2fd; border:1px solid #bbdefb; border-radius:4px; padding:5px 8px; cursor:${indexSub === cat.subcategorias.length - 1 ? 'default' : 'pointer'}; color:#1976d2; font-size:11px; font-weight:bold; ${indexSub === cat.subcategorias.length - 1 ? 'opacity:0.3;' : ''}" title="Mover abajo">↓</button>
                        </td>
                        <td style="text-align: right; padding: 12px 8px; white-space: nowrap;">
                            <button onclick="typeof iniciarMigracion === 'function' ? iniciarMigracion(${indexCat}, ${indexSub}) : null" style="background:#f0f4ff; border:1px solid #c7d9f7; border-radius:4px; padding:5px 10px; cursor:pointer; color:#1d4ed8; font-size:11px; font-weight:bold; margin-right:6px;">🚚</button>
                            <button onclick="eliminarSubcategoria(${indexCat}, ${indexSub})" style="background:#ffebee; border:1px solid #ffcdd2; color:#e74c3c; cursor:pointer; padding:5px 10px; border-radius:4px; font-size:11px; font-weight:bold;">✕</button>
                        </td>
                    </tr>`;
            });
        }

        html += `
                </tbody>
            </table>
            <button onclick="agregarSubcategoria(${indexCat})" style="margin-top: 15px; width: 100%; padding: 12px; background: #f0f7ff; border: 2px dashed #3498db; border-radius: 5px; cursor: pointer; font-size: 13px; color: #3498db; font-weight:bold;">+ Agregar Subcategoría</button>
        `;

        card.innerHTML = html;
        contenedor.appendChild(card);
    });
}

function guardarCategoriasConfig() {
    if (!StorageService.set("categoriasData", categoriasData)) return console.error("❌ Error guardando");
    renderCategorias();
    if (typeof actualizarCombosFiltros === 'function') actualizarCombosFiltros();
}

function nuevaCategoria() {
    const nombre = prompt("Nombre de la nueva categoría:");
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
            margen: parseFloat(margen),
            orden: 'nombre_asc' // Asignamos regla por defecto al crear
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
    StorageService.set("categoriasData", categoriasData);
}

// NUEVA FUNCIÓN: Guarda el orden seleccionado
window.actualizarOrdenSub = function(indexCat, indexSub, nuevoOrden) {
    categoriasData[indexCat].subcategorias[indexSub].orden = nuevoOrden;
    StorageService.set("categoriasData", categoriasData);
}
// --- MOTOR UNIVERSAL DE ORDENAMIENTO ---
window.aplicarOrdenamientoInteligente = function(productosArray, subcatSeleccionada) {
    let regla = 'nombre_asc'; // Regla por defecto

    // Si seleccionó una subcategoría específica, buscamos su regla
    if (subcatSeleccionada && subcatSeleccionada !== 'todos') {
        const catData = window.categoriasData || (typeof StorageService !== 'undefined' ? StorageService.get("categoriasData", []) : []);
        for (let cat of catData) {
            let sub = (cat.subcategorias || []).find(s => s.nombre === subcatSeleccionada);
            if (sub && sub.orden) {
                regla = sub.orden;
                break;
            }
        }
    }

    // Clonamos el array para no mutar el original en memoria y ordenamos
    return [...productosArray].sort((a, b) => {
        if (regla === 'nombre_asc') return (a.nombre || '').localeCompare(b.nombre || '');
        if (regla === 'nombre_desc') return (b.nombre || '').localeCompare(a.nombre || '');
        if (regla === 'precio_asc') return (parseFloat(a.precio) || 0) - (parseFloat(b.precio) || 0);
        if (regla === 'precio_desc') return (parseFloat(b.precio) || 0) - (parseFloat(a.precio) || 0);
        if (regla === 'stock_desc') return (parseFloat(b.stock) || 0) - (parseFloat(a.stock) || 0);
        return 0; // Fallback
    });
};

// ===== FUNCIONES DE REORDENAMIENTO DE CATEGORÍAS Y SUBCATEGORÍAS =====
window.moverCategoriaArriba = function(index) {
    if (index <= 0) return;
    const temp = categoriasData[index];
    categoriasData[index] = categoriasData[index - 1];
    categoriasData[index - 1] = temp;
    
    // Actualizar posiciones
    categoriasData[index].posicion = index + 1;
    categoriasData[index - 1].posicion = index;
    
    guardarCategoriasConfig();
};

window.moverCategoriaAbajo = function(index) {
    if (index >= categoriasData.length - 1) return;
    const temp = categoriasData[index];
    categoriasData[index] = categoriasData[index + 1];
    categoriasData[index + 1] = temp;
    
    // Actualizar posiciones
    categoriasData[index].posicion = index + 1;
    categoriasData[index + 1].posicion = index + 2;
    
    guardarCategoriasConfig();
};

window.moverSubcategoriaArriba = function(indexCat, indexSub) {
    if (indexSub <= 0) return;
    const temp = categoriasData[indexCat].subcategorias[indexSub];
    categoriasData[indexCat].subcategorias[indexSub] = categoriasData[indexCat].subcategorias[indexSub - 1];
    categoriasData[indexCat].subcategorias[indexSub - 1] = temp;
    
    // Actualizar posiciones
    categoriasData[indexCat].subcategorias[indexSub].posicion = indexSub + 1;
    categoriasData[indexCat].subcategorias[indexSub - 1].posicion = indexSub;
    
    guardarCategoriasConfig();
};

window.moverSubcategoriaAbajo = function(indexCat, indexSub) {
    if (indexSub >= categoriasData[indexCat].subcategorias.length - 1) return;
    const temp = categoriasData[indexCat].subcategorias[indexSub];
    categoriasData[indexCat].subcategorias[indexSub] = categoriasData[indexCat].subcategorias[indexSub + 1];
    categoriasData[indexCat].subcategorias[indexSub + 1] = temp;
    
    // Actualizar posiciones
    categoriasData[indexCat].subcategorias[indexSub].posicion = indexSub + 1;
    categoriasData[indexCat].subcategorias[indexSub + 1].posicion = indexSub + 2;
    
    guardarCategoriasConfig();
};

window.editarNombreCategoria = function(index) {
    const cat = categoriasData[index];
    const nuevoNombre = prompt(`Editar nombre de la categoría "${cat.nombre}":`, cat.nombre);
    
    if (nuevoNombre && nuevoNombre.trim() !== "" && nuevoNombre !== cat.nombre) {
        const nombreAnterior = cat.nombre;
        cat.nombre = nuevoNombre.trim();
        
        // 🚀 MIGRACIÓN SILENCIOSA: Actualizar todos los productos existentes
        let productos = StorageService.get("productos", []);
        let actualizados = 0;
        productos.forEach(p => {
            if (p.categoria === nombreAnterior) {
                p.categoria = cat.nombre;
                actualizados++;
            }
        });
        
        StorageService.set("productos", productos);
        guardarCategoriasConfig();
        alert(`✅ Categoría renombrada. Se actualizaron ${actualizados} productos en el inventario.`);
    }
}

// 🚀 NUEVA FUNCIÓN: EL MOTOR DE MIGRACIÓN NATIVA
function iniciarMigracion(indexCat, indexSub) {
    const catOrigen = categoriasData[indexCat].nombre;
    const subObj = categoriasData[indexCat].subcategorias[indexSub];
    const subOrigen = subObj.nombre;

    // Construir modal de selección
    const overlay = document.createElement('div');
    overlay.id = 'modalMigracionCat';
    overlay.style = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:100000;';

    const catOptions = categoriasData.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('');

    overlay.innerHTML = `
        <div style="width:420px; max-width:92%; background:white; border-radius:8px; padding:18px; box-shadow:0 10px 30px rgba(0,0,0,0.2);">
            <h3 style="margin:0 0 8px 0; font-size:16px;">🚚 Migrar subcategoría</h3>
            <div style="color:#555; margin-bottom:12px; font-size:13px;">Subcategoría: <strong>${subOrigen}</strong><br>Categoría origen: <strong>${catOrigen}</strong></div>
            <label style="display:block; font-size:13px; margin-bottom:6px;">Selecciona la categoría destino</label>
            <select id="migSelectCat" style="width:100%; padding:8px 10px; border:1px solid #d1d5db; border-radius:6px; font-size:13px; margin-bottom:8px;">
                <option value="">-- Selecciona --</option>
                ${catOptions}
                <option value="__new__">+ Crear nueva categoría...</option>
            </select>
            <div id="migNewWrap" style="display:none; margin-bottom:8px;">
                <input id="migNewName" placeholder="Nombre de la nueva categoría" style="width:100%; padding:8px 10px; border:1px solid #d1d5db; border-radius:6px; font-size:13px;" />
            </div>
            <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:12px;">
                <button id="migCancel" style="background:#f3f4f6;border:none;padding:8px 12px;border-radius:6px;cursor:pointer;">Cancelar</button>
                <button id="migConfirm" style="background:#2563eb;color:white;border:none;padding:8px 12px;border-radius:6px;cursor:pointer;font-weight:600;">Mover</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const sel = document.getElementById('migSelectCat');
    const newWrap = document.getElementById('migNewWrap');
    const newName = document.getElementById('migNewName');
    const btnCancel = document.getElementById('migCancel');
    const btnConfirm = document.getElementById('migConfirm');

    sel.onchange = function() {
        if (this.value === '__new__') newWrap.style.display = 'block'; else newWrap.style.display = 'none';
    };

    btnCancel.onclick = function() { overlay.remove(); };

    btnConfirm.onclick = function() {
        let catDestino = sel.value === '__new__' ? (newName.value || '').trim() : sel.value;
        if (!catDestino) return alert('Ingresa o selecciona la categoría destino.');
        if (catDestino.toUpperCase() === catOrigen.toUpperCase()) return alert('⚠️ La categoría destino es la misma que la actual. No hay nada que mover.');
        if (!confirm(`¿Estás seguro de mover la subcategoría "${subOrigen}" (y TODOS sus productos) hacia "${catDestino}"?`)) return;

        // 1. AFECTACIÓN EN BASE DE DATOS (PRODUCTOS)
        let productos = StorageService.get('productos', []);
        let modificados = 0;
        productos.forEach(p => {
            if ((p.categoria || '') === catOrigen && (p.subcategoria || '') === subOrigen) {
                p.categoria = catDestino;
                modificados++;
            }
        });

        // 2. REESTRUCTURACIÓN DE CATEGORÍAS
        let indexDestino = categoriasData.findIndex(c => c.nombre.toUpperCase() === catDestino.toUpperCase());
        if (indexDestino === -1) {
            // crear nueva categoría y asignar posición al final
            const nueva = { nombre: catDestino, subcategorias: [], posicion: (categoriasData.length || 0) + 1 };
            // asegurar que subObj sea clonado para no perder referencias
            const subClone = (typeof subObj === 'object') ? JSON.parse(JSON.stringify(subObj)) : { nombre: subObj };
            subClone.posicion = 1;
            nueva.subcategorias.push(subClone);
            categoriasData.push(nueva);
        } else {
            const catDestObj = categoriasData[indexDestino];
            const existeSub = catDestObj.subcategorias.find(s => s.nombre.toUpperCase() === subOrigen.toUpperCase());
            if (!existeSub) {
                const subClone = (typeof subObj === 'object') ? JSON.parse(JSON.stringify(subObj)) : { nombre: subObj };
                subClone.posicion = (catDestObj.subcategorias.length || 0) + 1;
                catDestObj.subcategorias.push(subClone);
            } else {
                alert(`Nota: La categoría "${catDestino}" ya tenía una subcategoría llamada "${subOrigen}". Los productos se fusionaron ahí.`);
            }
        }

        // 3. ELIMINAMOS DEL ORIGEN
        categoriasData[indexCat].subcategorias.splice(indexSub, 1);

        // 4. LIMPIEZA INTELIGENTE
        if (categoriasData[indexCat].subcategorias.length === 0) {
            if (confirm(`La categoría "${catOrigen}" se ha quedado vacía. ¿Deseas eliminarla del sistema para mantener el orden?`)) {
                categoriasData.splice(indexCat, 1);
            }
        }

        // 5. GUARDADO MASIVO
        StorageService.set('productos', productos);
        guardarCategoriasConfig(); // save + render

        alert(`✅ MIGRACIÓN EXITOSA.\n\nSe actualizaron ${modificados} producto(s) en tu inventario.\nSe movió hacia: [${catDestino}] -> [${subOrigen}]`);
        overlay.remove();
    };
}

// ===== VISOR MAESTRO =====
function abrirVisorMaestro(id) {
    navA('productos-visor');
    mostrarDetalleProductoMaestro(String(id));
}

function renderFilasKardex(id, tipoFiltro) {
    const movimientos = movimientosInventario.filter(m => String(m.productoId) === String(id) && m.tipo === tipoFiltro);
    if (movimientos.length === 0) {
        return `<tr><td colspan="3" style="text-align: center; padding: 20px; color: #ccc;">Sin registros de ${tipoFiltro}</td></tr>`;
    }
    return [...movimientos].reverse().map(m => `
        <tr style="border-bottom: 1px solid #f1f1f1; font-size: 13px;">
            <td style="padding: 8px 0;">${window.formatearFechaCortaMX(m.fecha)}</td>
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
    const p = window.productos.find(prod => String(prod.id) === String(id));
    if (!p) return;
    if (!confirm(`¿Guardar cambios para "${p.nombre}"?`)) return;

    p.nombre       = document.getElementById("editNombre")?.value || p.nombre;
    p.marca        = document.getElementById("editMarca")?.value  || '';
    p.costo        = parseFloat(document.getElementById("editCosto")?.value) || p.costo;
    p.precio       = parseFloat(document.getElementById("editPrecio")?.value) || p.precio;
    p.caracteristicas = document.getElementById("editCaracteristicas")?.value || '';

    // Borramos p.color, p.modelo, p.descripcion y p.imagen porque ya no están en tu Visor Maestro

    if (!StorageService.set("productos", window.productos)) {
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
    const duplicado = window.productos.some(prod =>
           prod.nombre.toUpperCase() === p.nombre.toUpperCase() &&
           prod.modelo === p.modelo &&
           prod.color === p.color
    );

    if (duplicado) {
        return { ok: false, error: "Producto duplicado" };
    }

    const margenCalculado = CalculatorService.calcularMargen(p.precio, p.costo);

    window.productos.push({
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

// ============================================================
// CATÁLOGO DE UBICACIONES (Bodegas, Sucursales, etc.)
// ============================================================

function renderUbicaciones() {
    const contenedor = document.getElementById("tablaUbicaciones");
    if (!contenedor) return;

    // Le damos dos ubicaciones por defecto si el sistema está vacío
    let ubicaciones = StorageService.get("ubicacionesConfig", [
        { id: 1, nombre: "Piso de Ventas" },
        { id: 2, nombre: "Bodega Principal" }
    ]);

    // Las guardamos en memoria si es la primera vez
    if(StorageService.get("ubicacionesConfig", []).length === 0) {
        StorageService.set("ubicacionesConfig", ubicaciones);
    }

    let filas = ubicaciones.map(u => `
        <tr style="border-bottom:1px solid #eee;">
            <td style="padding:12px; font-weight:bold; color:#1e40af;">📍 ${u.nombre}</td>
            <td style="padding:12px; text-align:center;">
                <button onclick="eliminarUbicacion(${u.id})" style="background:#fee2e2; color:#ef4444; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;">🗑️ Eliminar</button>
            </td>
        </tr>
    `).join('');

    contenedor.innerHTML = `
        <div style="background:white; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.05); overflow:hidden;">
            <table style="width:100%; border-collapse:collapse; font-size:14px;">
                <thead style="background:#f8fafc; border-bottom:2px solid #e2e8f0; color:#475569;">
                    <tr>
                        <th style="padding:12px; text-align:left;">Nombre de la Ubicación</th>
                        <th style="padding:12px; text-align:center; width:100px;">Acción</th>
                    </tr>
                </thead>
                <tbody>${filas || '<tr><td colspan="2" style="text-align:center; padding:20px; color:#94a3b8;">No hay ubicaciones registradas</td></tr>'}</tbody>
            </table>
        </div>
    `;
}

function guardarUbicacion() {
    const input = document.getElementById("nuevaUbicacionNombre");
    const nombre = input.value.trim();
    if (!nombre) return alert("⚠️ Escribe un nombre para la ubicación.");

    let ubicaciones = StorageService.get("ubicacionesConfig", []);
    
    // Evitar duplicados
    if (ubicaciones.some(u => u.nombre.toLowerCase() === nombre.toLowerCase())) {
        return alert("⚠️ Esta ubicación ya existe.");
    }

    ubicaciones.push({ id: Date.now(), nombre: nombre });
    StorageService.set("ubicacionesConfig", ubicaciones);
    input.value = "";
    renderUbicaciones();
}

function eliminarUbicacion(id) {
    if (!confirm("⚠️ ¿Seguro que deseas eliminar esta ubicación? (Asegúrate de no tener inventario guardado aquí)")) return;
    let ubicaciones = StorageService.get("ubicacionesConfig", []);
    ubicaciones = ubicaciones.filter(u => u.id !== id);
    StorageService.set("ubicacionesConfig", ubicaciones);
    renderUbicaciones();
}

// Exponemos la función al HTML
window.renderUbicaciones = renderUbicaciones;
function renderTablaVariantes(variantes, prodId) {
    if (!variantes || variantes.length === 0) return '<p style="padding: 15px; color: #94a3b8; text-align: center; font-size: 12px;">No hay existencias registradas.</p>';
    
    return `
    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead><tr style="background: #f8fafc; text-align: left; color: #64748b;"><th style="padding: 8px;">Ubicación</th><th>Color</th><th style="text-align: center;">Stock</th><th></th></tr></thead>
        <tbody>
            ${variantes.map((v, idx) => `
                <tr style="border-top: 1px solid #f1f5f9;">
                    <td style="padding: 8px;"><b>${v.ubicacion}</b></td>
                    <td>${v.color}</td>
                    <td style="text-align: center; font-weight: bold; color: #1e40af;">${v.stock}</td>
                    <td style="text-align: right; padding-right: 8px;">
                        <button onclick="eliminarVariante('${prodId}', ${idx})" style="background: none; border: none; color: #ef4444; cursor: pointer;">✕</button>
                    </td>
                </tr>
            `).join('')}
        </tbody>
    </table>`;
}

// CORRECCIÓN PARA AÑADIR VARIANTE
window.agregarVarianteStock = function(prodId) {
    const ubicacion = document.getElementById('newVarUbicacion').value;
    const color = document.getElementById('newVarColor').value.trim();
    const stock = parseInt(document.getElementById('newVarCant').value);

    if (!color || isNaN(stock)) return alert("Indica color y cantidad");

    const p = window.productos.find(prod => String(prod.id) === String(prodId));
    p.variantes = p.variantes || [];

    const existente = p.variantes.find(v => v.ubicacion === ubicacion && v.color.toUpperCase() === color.toUpperCase());
    if (existente) {
        existente.stock += stock;
    } else {
        p.variantes.push({ ubicacion, color, stock });
    }

    // --- LÍNEA NUEVA: ACTUALIZAR STOCK GENERAL ---
    p.stock = (p.stock || 0) + stock; 

    registrarMovimiento(prodId, `Entrada - ${ubicacion} (${color})`, stock, "entrada");
    mostrarDetalleProductoMaestro(prodId);
};

// CORRECCIÓN PARA ELIMINAR VARIANTE
window.eliminarVariante = function(prodId, index) {
    if (!confirm("¿Eliminar esta existencia del inventario?")) return;
    const p = window.productos.find(prod => String(prod.id) === String(prodId));
    
    const v = p.variantes[index];
    registrarMovimiento(prodId, `Corrección/Baja - ${v.ubicacion} (${v.color})`, v.stock, "salida");
    
    // --- LÍNEA NUEVA: RESTAR AL STOCK GENERAL ---
    p.stock = (p.stock || 0) - v.stock; 

    p.variantes.splice(index, 1);
    mostrarDetalleProductoMaestro(prodId);
};

// =========================================================
// MÓDULO: AJUSTES Y TRANSFERENCIAS DE INVENTARIO
// =========================================================

// --- AJUSTES (MERMAS / SOBRANTES) ---
window.abrirModalAjusteInv = function() {
    const ubs = StorageService.get('ubicacionesConfig', [{id:'General', nombre:'Piso de Ventas (General)'}]);
    let opts = '';
    ubs.forEach(u => opts += `<option value="${u.nombre}">${u.nombre}</option>`);
    
    document.getElementById('ajusteUbicacion').innerHTML = opts;
    document.getElementById('ajusteProductoId').value = '';
    document.getElementById('ajusteProductoDisplay').innerText = 'Sin seleccionar';
    document.getElementById('ajusteProductoDisplay').style.color = '#64748b';
    document.getElementById('ajusteCantidad').value = '';
    document.getElementById('ajusteMotivo').value = '';
    
    // 👇 ESTA ES LA MAGIA QUE FALTABA: Quitar el candado CSS
    const modal = document.getElementById('modalAjusteInv');
    modal.classList.remove('oculto');
    modal.style.display = 'flex';
};

window.ejecutarAjusteInv = function() {
    const idProd = document.getElementById('ajusteProductoId').value;
    const tipo = document.getElementById('ajusteTipo').value;
    const cant = parseFloat(document.getElementById('ajusteCantidad').value);
    const ubi = document.getElementById('ajusteUbicacion').value;
    const motivo = document.getElementById('ajusteMotivo').value;

    if(!idProd) return alert("Selecciona un producto.");
    if(isNaN(cant) || cant <= 0) return alert("Ingresa una cantidad válida.");
    if(!motivo) return alert("Debes ingresar un motivo para el ajuste (Auditoría).");

    const productos = StorageService.get("productos", []);
    const idx = productos.findIndex(p => String(p.id) === String(idProd));
    
    if(idx === -1) return alert("Producto no encontrado.");
    
    let p = productos[idx];

    // --- NUEVO: RESUMEN Y CONFIRMACIÓN ---
    const tipoAjusteStr = tipo === 'salida' ? '📉 SALIDA (Resta stock)' : '📈 ENTRADA (Suma stock)';
    const msjConfAjuste = `⚠️ RESUMEN DE OPERACIÓN - ¿AJUSTAR INVENTARIO?\n\nProducto: ${p.nombre}\nTipo de Ajuste: ${tipoAjusteStr}\nCantidad: ${cant} pieza(s)\nUbicación: ${ubi}\nMotivo: ${motivo}\n\nEsta acción modificará tu inventario directamente sin una venta o compra. ¿Estás seguro de continuar?`;
    if (!confirm(msjConfAjuste)) return;
    // --- FIN DE CONFIRMACIÓN ---

    p.stockPorUbicacion = p.stockPorUbicacion || {};
    p.stock = parseFloat(p.stock) || 0;

    if(tipo === 'salida') {
        p.stock -= cant;
        p.stockPorUbicacion[ubi] = (parseFloat(p.stockPorUbicacion[ubi]) || 0) - cant;
    } else {
        p.stock += cant;
        p.stockPorUbicacion[ubi] = (parseFloat(p.stockPorUbicacion[ubi]) || 0) + cant;
    }

    const movs = StorageService.get("movimientosInventario", []);
    movs.push({
        id: Date.now(),
        fecha: window.localISO(new Date()),
        tipo: tipo === 'salida' ? 'Egreso (Merma/Ajuste)' : 'Ingreso (Sobrante/Ajuste)',
        productoId: p.id,
        productoNombre: p.nombre,
        cantidad: cant,
        ubicacion: ubi,
        motivo: motivo,
        usuario: "Admin" 
    });

    productos[idx] = p;
    StorageService.set("productos", productos);
    StorageService.set("movimientosInventario", movs);

    alert(`✅ Ajuste aplicado con éxito.`);
    
    // Cerrar y volver a poner candado
    const modal = document.getElementById('modalAjusteInv');
    modal.classList.add('oculto');
    modal.style.display = 'none';
    
    if(typeof renderInventario === 'function') renderInventario();
};

// --- TRANSFERENCIAS ENTRE BODEGAS ---
window.abrirModalTransferenciaInv = function() {
    const ubs = StorageService.get('ubicacionesConfig', [{id:'General', nombre:'Piso de Ventas (General)'}]);
    let opts = '';
    ubs.forEach(u => opts += `<option value="${u.nombre}">${u.nombre}</option>`);
    
    document.getElementById('transfOrigen').innerHTML = opts;
    document.getElementById('transfDestino').innerHTML = opts;
    
    document.getElementById('transfProductoId').value = '';
    document.getElementById('transfProductoDisplay').innerText = 'Sin seleccionar';
    document.getElementById('transfProductoDisplay').style.color = '#64748b';
    document.getElementById('transfCantidad').value = '';
    
    // 👇 MAGIA DEL CSS AQUÍ TAMBIÉN
    const modal = document.getElementById('modalTransferenciaInv');
    modal.classList.remove('oculto');
    modal.style.display = 'flex';
};

window.ejecutarTransferenciaInv = function() {
    const idProd = document.getElementById('transfProductoId').value;
    const cant = parseFloat(document.getElementById('transfCantidad').value);
    const origen = document.getElementById('transfOrigen').value;
    const destino = document.getElementById('transfDestino').value;

    if(!idProd) return alert("Selecciona un producto.");
    if(isNaN(cant) || cant <= 0) return alert("Ingresa una cantidad válida.");
    if(origen === destino) return alert("El origen y el destino no pueden ser el mismo.");

    const productos = StorageService.get("productos", []);
    const idx = productos.findIndex(p => String(p.id) === String(idProd));
    
    if(idx === -1) return alert("Producto no encontrado.");
    
    let p = productos[idx];

    // --- NUEVO: RESUMEN Y CONFIRMACIÓN ---
    const msjConf = `⚠️ RESUMEN DE OPERACIÓN - ¿TRANSFERIR INVENTARIO?\n\nProducto: ${p.nombre}\nCantidad a mover: ${cant} pieza(s)\nOrigen: ${origen}\nDestino: ${destino}\n\n¿Deseas ejecutar esta transferencia de mercancía?`;
    if (!confirm(msjConf)) return;
    // --- FIN DE CONFIRMACIÓN ---

    p.stockPorUbicacion = p.stockPorUbicacion || {};
    
    const stockOrigen = parseFloat(p.stockPorUbicacion[origen]) || 0;
    if(stockOrigen < cant) {
        if(!confirm(`⚠️ ATENCIÓN: Solo hay ${stockOrigen} piezas en [${origen}]. ¿Deseas forzar el movimiento de todos modos y dejar la bodega en negativo?`)) {
            return;
        }
    }

    p.stockPorUbicacion[origen] = stockOrigen - cant;
    p.stockPorUbicacion[destino] = (parseFloat(p.stockPorUbicacion[destino]) || 0) + cant;

    const movs = StorageService.get("movimientosInventario", []);
    movs.push({
        id: Date.now(),
        fecha: window.localISO(new Date()),
        tipo: 'Transferencia Interna',
        productoId: p.id,
        productoNombre: p.nombre,
        cantidad: cant,
        origen: origen,
        destino: destino,
        motivo: `Mover mercancía de ${origen} a ${destino}`,
        usuario: "Admin"
    });

    productos[idx] = p;
    StorageService.set("productos", productos);
    StorageService.set("movimientosInventario", movs);

    alert(`🚚 Transferencia completada: ${cant} pieza(s) enviadas a ${destino}.`);
    
    // Cerrar y volver a poner candado
    const modal = document.getElementById('modalTransferenciaInv');
    modal.classList.add('oculto');
    modal.style.display = 'none';
    
    if(typeof renderInventario === 'function') renderInventario();
};