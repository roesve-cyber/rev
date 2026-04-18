// ===== CUENTAS POR PAGAR =====
function renderCuentasPorPagar() {
    const contenedor = document.getElementById("listaCuentasPorPagar");
    if (!contenedor) return;

    let cuentas = StorageService.get("cuentasPorPagar", []);
    let deudas = cuentas.filter(c => c.saldoPendiente > 0);

    if (deudas.length === 0) {
        contenedor.innerHTML = "<p style='text-align:center; padding:20px;'>✅ ¡No tienes deudas pendientes!</p>";
        return;
    }

    let html = `
        <table class="tabla-admin">
            <thead><tr>
                <th>Fecha / Proveedor</th>
                <th>Método</th>
                <th>Total</th>
                <th>Saldo Pendiente</th>
                <th>Acción</th>
            </tr></thead>
            <tbody>`;

    deudas.forEach(c => {
        html += `
            <tr>
                <td>${c.fecha}<br><strong>${c.proveedor}</strong></td>
                <td><small>${c.metodo || c.formaPagoTexto || '-'}</small></td>
                <td>${dinero(c.total)}</td>
                <td style="color:red; font-weight:bold;">${dinero(c.saldoPendiente)}</td>
                <td>
                    <button onclick="registrarAbonoProveedor(${c.id})" style="background:#2c3e50; color:white; border:none; padding:8px; border-radius:5px; cursor:pointer;">
                        💵 Abonar
                    </button>
                </td>
            </tr>`;
    });

    contenedor.innerHTML = html + "</tbody></table>";
}

function registrarAbonoProveedor(idCuenta) {
    let cuentas = StorageService.get("cuentasPorPagar", []);
    const index = cuentas.findIndex(c => c.id === idCuenta);
    if (index === -1) return;

    const cuenta = cuentas[index];
    const montoAbono = parseFloat(prompt(`¿Cuánto vas a abonar a ${cuenta.proveedor}?\nSaldo actual: ${dinero(cuenta.saldoPendiente)}`));

    const validacion = ValidatorService.validarMonto(montoAbono, cuenta.saldoPendiente);
    if (!validacion.valid) {
        alert("⚠️ " + validacion.error);
        return;
    }

    cuenta.saldoPendiente -= montoAbono;
    cuentas[index] = cuenta;
    if (!StorageService.set("cuentasPorPagar", cuentas)) {
        console.error("❌ Error guardando abono");
        return;
    }
    alert("Abono registrado correctamente.");
    renderCuentasPorPagar();
}

window.renderCuentasPorPagar = renderCuentasPorPagar;
window.registrarAbonoProveedor = registrarAbonoProveedor;
