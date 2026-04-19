// ===== LOGÍSTICA =====
function renderLogistica() {
    const pSal = document.getElementById("panel-salidas-pendientes");
    const pReq = document.getElementById("panel-requisiciones-venta");
    if (!pSal || !pReq) return;

    salidasPendientesVenta = StorageService.get("salidasPendientesVenta", []);
    requisicionesCompra = StorageService.get("requisicionesCompra", []);

    const pendSalidas = salidasPendientesVenta.filter((s) => s.estatus === "Pendiente");

    if (pendSalidas.length === 0) {
        pSal.innerHTML =
            "<h3 style=\"color:#2c3e50;\">📤 Salidas pendientes de almacén</h3><p style=\"color:#718096;\">No hay ventas con salida diferida.</p>";
    } else {
        let tb = `
            <h3 style="color:#2c3e50;">📤 Salidas pendientes de almacén</h3>
            <table class="tabla-admin">
                <thead><tr>
                    <th>Folio venta</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Detalle</th>
                    <th style="text-align:center;">Acción</th>
                </tr></thead><tbody>`;
        pendSalidas.forEach((s) => {
            const det = (s.items || []).map((i) => `${i.nombre} ×${i.cantidad || 1}`).join("<br>");
            tb += `<tr>
                <td><strong>${s.folioVenta}</strong></td>
                <td>${s.fecha || "—"}</td>
                <td>${s.clienteNombre || "—"}</td>
                <td style="font-size:13px;">${det || "—"}</td>
                <td style="text-align:center;">
                    <button type="button" onclick="aplicarSalidaPendienteVentas(${s.id})" class="btn-primario" style="padding:8px 12px;">Aplicar</button>
                </td>
            </tr>`;
        });
        pSal.innerHTML = tb + "</tbody></table>";
    }

    const pendReq = requisicionesCompra.filter((r) => (r.estatus || "Pendiente") === "Pendiente");
    if (pendReq.length === 0) {
        pReq.innerHTML =
            "<h3 style=\"color:#2c3e50;\">🛒 Requisiciones de compra</h3><p style=\"color:#718096;\">No hay requisiciones pendientes.</p>";
    } else {
        let tr = `
            <h3 style="color:#2c3e50;">🛒 Requisiciones de compra (pendientes)</h3>
            <table class="tabla-admin">
                <thead><tr><th>Fecha</th><th>Producto</th><th>Motivo / Folio</th><th style="text-align:center;">Acción</th></tr></thead><tbody>`;
        pendReq.forEach((r) => {
            const extra = [r.motivo, r.folioVenta].filter(Boolean).join(" · ");
            tr += `<tr>
                <td>${r.fecha || "—"}</td>
                <td><strong>${r.producto || "—"}</strong></td>
                <td><small>${extra || "—"}</small></td>
                <td style="text-align:center;">
                    <button type="button" onclick="marcarRequisicionAtendida(${r.id})" style="padding:6px 12px; background:#718096; color:white; border:none; border-radius:5px; cursor:pointer;">Atendida</button>
                </td>
            </tr>`;
        });
        pReq.innerHTML = tr + "</tbody></table>";
    }
}

function aplicarSalidaPendienteVentas(idSalida) {
    if (!confirm("¿Aplicar ahora la salida de almacén?")) return;

    salidasPendientesVenta = StorageService.get("salidasPendientesVenta", []);
    const idxS = salidasPendientesVenta.findIndex((s) => s.id === idSalida);
    if (idxS === -1) return;

    const salida = salidasPendientesVenta[idxS];
    if (salida.estatus !== "Pendiente") return;

    const fechaHoy = new Date().toLocaleDateString("es-MX");
    requisicionesCompra = StorageService.get("requisicionesCompra", []);

    (salida.items || []).forEach((it) => {
        const cant = it.cantidad || 1;
        const pIdx = productos.findIndex((p) => p.id === it.productoId);
        if (pIdx === -1) return;
        const stockActual = productos[pIdx].stock || 0;
        const cantADescontar = Math.min(cant, stockActual);
        const cantFaltante = cant - cantADescontar;
        productos[pIdx].stock = stockActual - cantADescontar;
        if (cantADescontar > 0) {
            registrarMovimiento(it.productoId, `Salida venta (diferida) ${salida.folioVenta}`, cantADescontar, "salida");
        }
        if (cantFaltante > 0) {
            requisicionesCompra.push({
                id: Date.now(),
                fecha: fechaHoy,
                producto: it.nombre || productos[pIdx].nombre,
                folioVenta: salida.folioVenta,
                cantidad: cantFaltante,
                motivo: `Stock insuficiente al aplicar salida diferida (faltan ${cantFaltante})`,
                estatus: "Pendiente"
            });
        }
    });

    salida.estatus = "Aplicada";
    salida.fechaAplicacion = fechaHoy;
    salidasPendientesVenta[idxS] = salida;

    if (!StorageService.set("productos", productos)) {
        console.error("❌ Error guardando productos");
    }
    if (!StorageService.set("movimientosInventario", movimientosInventario)) {
        console.error("❌ Error guardando movimientos");
    }
    if (!StorageService.set("salidasPendientesVenta", salidasPendientesVenta)) {
        console.error("❌ Error guardando salidas");
    }
    if (!StorageService.set("requisicionesCompra", requisicionesCompra)) {
        console.error("❌ Error guardando requisiciones");
    }

    alert("Salida aplicada correctamente.");
    renderLogistica();
}

function marcarRequisicionAtendida(idReq) {
    requisicionesCompra = StorageService.get("requisicionesCompra", []);
    const r = requisicionesCompra.find((x) => x.id === idReq);
    if (!r) return;
    r.estatus = "Atendida";
    if (!StorageService.set("requisicionesCompra", requisicionesCompra)) {
        console.error("❌ Error guardando requisiciones");
    }
    renderLogistica();
}
