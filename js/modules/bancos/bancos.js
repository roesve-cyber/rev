// ===== BANCOS Y TARJETAS =====
function renderBancosConfig() {
    const contenedor = document.getElementById("tablaBancosConfig");
    if (!contenedor) return;

    let html = `
        <table class="tabla-admin">
            <thead><tr>
                <th>Banco</th>
                <th>Día de Corte</th>
                <th>Día Límite de Pago</th>
                <th>Acciones</th>
            </tr></thead>
            <tbody>`;

    tarjetasConfig.forEach((t, index) => {
        const notaMes = (parseInt(t.diaCorte) > parseInt(t.diaLimite))
            ? '<br><small style="color:orange;">(Mes siguiente)</small>' : '';
        html += `
            <tr>
                <td><strong>${t.banco}</strong></td>
                <td>Día ${t.diaCorte}</td>
                <td>Día ${t.diaLimite} ${notaMes}</td>
                <td>
                    <button onclick="prepararEdicionBanco(${index})" style="background:#3182ce; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; margin-right:5px;">Modificar</button>
                    <button onclick="eliminarBanco(${index})" style="background:#e74c3c; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">Eliminar</button>
                </td>
            </tr>`;
    });

    contenedor.innerHTML = html + "</tbody></table>";
}

function abrirModalBanco() {
    const nombre = prompt("Nombre del Banco:");
    if (!nombre) return;
    const corte  = parseInt(prompt("Día de corte (1-31):"));
    const limite = parseInt(prompt("Día límite de pago (1-31):"));
    if (!isNaN(corte) && !isNaN(limite)) {
        tarjetasConfig.push({ banco: nombre.toUpperCase(), diaCorte: corte, diaLimite: limite });
        actualizarYRefrescarBancos();
    } else {
        alert("Por favor ingresa números válidos.");
    }
}

function prepararEdicionBanco(index) {
    const banco = tarjetasConfig[index];
    const nuevoNombre = prompt("Nombre del Banco:", banco.banco);
    if (nuevoNombre === null) return;
    const nuevoCorte  = parseInt(prompt("Día de Corte (1-31):", banco.diaCorte));
    const nuevoLimite = parseInt(prompt("Día Límite de Pago (1-31):", banco.diaLimite));
    if (!nuevoNombre || isNaN(nuevoCorte) || isNaN(nuevoLimite)) {
        alert("Datos inválidos.");
        return;
    }
    tarjetasConfig[index] = { banco: nuevoNombre.toUpperCase(), diaCorte: nuevoCorte, diaLimite: nuevoLimite };
    actualizarYRefrescarBancos();
    alert("¡Cuenta modificada con éxito!");
}

function eliminarBanco(index) {
    if (confirm("¿Seguro que deseas eliminar este banco?")) {
        tarjetasConfig.splice(index, 1);
        actualizarYRefrescarBancos();
    }
}

function actualizarYRefrescarBancos() {
    if (!StorageService.set("tarjetasConfig", tarjetasConfig)) {
        console.error("❌ Error guardando bancos");
        return;
    }
    renderBancosConfig();
    actualizarSelectBancos();
}

function calcularFechaPago(fechaCompraStr, bancoNombre) {
    const infoBanco = tarjetasConfig.find(t => t.banco === bancoNombre);
    if (!infoBanco) return fechaCompraStr;

    let partes = fechaCompraStr.split('/');
    let fecha = new Date(partes[2], partes[1] - 1, partes[0]);
    if (isNaN(fecha.getTime())) fecha = new Date();

    const diaCompra = fecha.getDate();
    const diaCorte  = parseInt(infoBanco.diaCorte);
    const diaLimite = parseInt(infoBanco.diaLimite);

    let mes  = fecha.getMonth();
    let anio = fecha.getFullYear();

    if (diaCompra > diaCorte) mes += 1;
    if (diaLimite < diaCorte)  mes += 1;

    return new Date(anio, mes, diaLimite).toLocaleDateString();
}

function calcularCalendarioMSI(fechaRef, meses, nombreBanco) {
    const config = tarjetasConfig.find(t => t.banco === nombreBanco) || { diaCorte: 15, diaLimite: 5 };
    let cronograma = [];
    let d = new Date(fechaRef);
    let saltoMes = (d.getDate() > config.diaCorte) ? 2 : 1;
    for (let i = 0; i < meses; i++) {
        let fPago = new Date(d.getFullYear(), d.getMonth() + i + saltoMes, config.diaLimite);
        cronograma.push({ n: i + 1, fecha: fPago.toISOString().split('T')[0] });
    }
    return cronograma;
}

window.renderBancosConfig = renderBancosConfig;
window.abrirModalBanco = abrirModalBanco;
window.prepararEdicionBanco = prepararEdicionBanco;
window.eliminarBanco = eliminarBanco;
window.actualizarYRefrescarBancos = actualizarYRefrescarBancos;
window.calcularFechaPago = calcularFechaPago;
window.calcularCalendarioMSI = calcularCalendarioMSI;
