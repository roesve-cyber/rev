// ===== RECEPCIONES =====
function renderRecepciones() {
    const contenedor = document.getElementById("listaRecepcionesPendientes");
    if (!contenedor) return;

    let recs = StorageService.get("recepciones", []);
    let pendientes = recs.filter(r => r.estatus === "Pendiente");

    if (pendientes.length === 0) {
        contenedor.innerHTML = "<p style='text-align:center; padding:20px;'>✅ No hay mercancía pendiente de recibir.</p>";
        return;
    }

    let html = `
        <table class="tabla-admin">
            <thead><tr>
                <th>Fecha / Proveedor</th>
                <th>Producto</th>
                <th>Pedido</th>
                <th>Pendiente</th>
                <th>Acción</th>
            </tr></thead>
            <tbody>`;

    pendientes.forEach(r => {
        html += `
            <tr>
                <td>${r.fechaPedido}<br><strong>${r.proveedor}</strong></td>
                <td>${r.productoNombre}<br><small>Pago: ${r.metodoPago}</small></td>
                <td>${r.cantidadTotal}</td>
                <td style="color:red; font-weight:bold;">${r.cantidadPendiente}</td>
                <td>
                    <button onclick="procesarRecepcionFisica(${r.id})" style="background:#27ae60; color:white; border:none; padding:8px; border-radius:5px; cursor:pointer;">
                        📥 Recibir
                    </button>
                </td>
            </tr>`;
    });

    contenedor.innerHTML = html + "</tbody></table>";
}

function procesarRecepcionFisica(idRecepcion) {
    let recs = StorageService.get("recepciones", []);
    const index = recs.findIndex(r => r.id == idRecepcion);
    if (index === -1) return;

    const rec = recs[index];
    const cantInput = prompt(`¿Cuánto llegó de ${rec.productoNombre}?\nFaltan: ${rec.cantidadPendiente}`);
    const cantidad = parseInt(cantInput);

    if (isNaN(cantidad) || cantidad <= 0 || cantidad > rec.cantidadPendiente) {
        alert("Cantidad no válida.");
        return;
    }

    const prod = productos.find(p => Number(p.id) === Number(rec.productoId));
    
    if (prod) {
        prod.stock = (parseInt(prod.stock) || 0) + cantidad;
        
        movimientosInventario.push({
            id: Date.now(),
            productoId: prod.id,
            tipo: 'entrada',
            cantidad,
            concepto: `Recepción - Prov: ${rec.proveedor}`,
            fecha: new Date().toLocaleString()
        });
    } else {
        alert("Error: El producto ya no existe en la base de datos.");
        return; 
    }

    rec.cantidadRecibida += cantidad;
    rec.cantidadPendiente -= cantidad;
    if (rec.cantidadPendiente === 0) rec.estatus = "Completado";

    recs[index] = rec;
    
    if (!StorageService.set("recepciones", recs)) {
        console.error("❌ Error guardando recepciones");
        return;
    }
    if (!StorageService.set("productos", productos)) {
        console.error("❌ Error guardando productos");
        return;
    }
    if (!StorageService.set("movimientosInventario", movimientosInventario)) {
        console.error("❌ Error guardando movimientos");
        return;
    }

    alert("Stock actualizado con éxito.");
    renderRecepciones();
}

window.renderRecepciones = renderRecepciones;
window.procesarRecepcionFisica = procesarRecepcionFisica;
