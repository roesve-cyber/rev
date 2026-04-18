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

function verDetalle(id) { verProducto(id); }

function agregarAlCarritoDesdeModal() {
    if (!productoActualId) return;
    const p = productos.find(prod => prod.id === productoActualId);
    if (!p) {
        alert("❌ Error: Producto no encontrado.");
        return;
    }

    const indiceExistente = carrito.findIndex(item => item.id === productoActualId);
    
    if (indiceExistente !== -1) {
        const mensaje = `⚠️ "${p.nombre}" ya está en el carrito.\n\n¿Aumentar la cantidad en 1?`;
        
        if (confirm(mensaje)) {
            carrito[indiceExistente].cantidad = (carrito[indiceExistente].cantidad || 1) + 1;
            if (!StorageService.set("carrito", carrito)) {
                console.error("❌ Error actualizando carrito");
                return;
            }
            actualizarContadorCarrito();
            alert(`✅ Cantidad aumentada a ${carrito[indiceExistente].cantidad}`);
        }
    } else {
        const planes = CalculatorService.calcularCredito(p.precio);
        const plan = planes[5] || planes[0];

        carrito.push({
            id: p.id,
            nombre: p.nombre,
            precioContado: parseFloat(p.precio) || 0,
            plazo: plan.meses,
            totalCredito: plan.total,
            abonoSemanal: plan.abono,
            imagen: p.imagen,
            cantidad: 1
        });

        if (!StorageService.set("carrito", carrito)) {
            console.error("❌ Error guardando carrito");
            return;
        }
        actualizarContadorCarrito();
        
        alert(`✅ "${p.nombre}" agregado al carrito`);
    }
    
    cerrarProducto();
}

window.verProducto = verProducto;
window.cerrarProducto = cerrarProducto;
window.actualizarSimuladorEnganche = actualizarSimuladorEnganche;
window.actualizarSimuladorPorcentaje = actualizarSimuladorPorcentaje;
window.actualizarTablaPlanesSimulada = actualizarTablaPlanesSimulada;
window.verDetalle = verDetalle;
window.agregarAlCarritoDesdeModal = agregarAlCarritoDesdeModal;
