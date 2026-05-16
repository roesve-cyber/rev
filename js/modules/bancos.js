// ===== BANCOS Y TARJETAS (REESTRUCTURADO) =====
// ===== BANCOS, TARJETAS Y CAJAS =====
function renderBancosConfig() {
    const contenedor = document.getElementById("tablaBancosConfig");
    if (!contenedor) return;

    const tarjetas = StorageService.get("tarjetasConfig", []);
    const debito = tarjetas.filter(t => t.tipo === "debito");
    const credito = tarjetas.filter(t => !t.tipo || t.tipo === "credito");
    const cajas = StorageService.get("cuentasEfectivo", [{ id: "efectivo", nombre: "💵 Efectivo Principal", saldo: 0 }]);

    let html = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px;">
        
        <!-- COLUMNA LIQUIDEZ (Cajas y Débito) -->
        <div style="display: flex; flex-direction: column; gap: 20px;">
            
            <!-- CAJAS DE EFECTIVO -->
            <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border-top: 5px solid #10b981;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3 style="margin:0; color:#065f46; display:flex; align-items:center; gap:8px;">💵 Cajas de Efectivo</h3>
                    <button onclick="abrirModalEdicionCaja()" style="padding: 8px 14px; background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 13px;">+ Nueva Caja</button>
                </div>
                
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead><tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0; color:#475569;">
                        <th style="padding:10px; text-align:left;">Nombre</th><th style="padding:10px; text-align:center;">Acciones</th>
                    </tr></thead>
                    <tbody>
                        ${cajas.map((c, idx) => `
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding:12px 10px;"><strong>${c.nombre}</strong></td>
                            <td style="padding:12px 10px; text-align:center;">
                                <button onclick="abrirModalEdicionCaja(${idx})" style="background:none; border:none; cursor:pointer; font-size:16px;" title="Editar">✏️</button>
                                ${c.id !== 'efectivo' ? `<button onclick="eliminarCaja(${idx})" style="background:none; border:none; cursor:pointer; font-size:16px;" title="Eliminar">🗑️</button>` : ''}
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>

            <!-- CUENTAS DE DÉBITO -->
            <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border-top: 5px solid #3b82f6;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3 style="margin:0; color:#1e40af; display:flex; align-items:center; gap:8px;">🏦 Cuentas de Débito</h3>
                    <button onclick="abrirModalEdicionBanco('debito')" style="padding: 8px 14px; background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 13px;">+ Nueva Cuenta</button>
                </div>
                
                ${debito.length === 0 ? '<p style="color:#9ca3af; text-align:center;">No hay cuentas registradas.</p>' : `
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead><tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0; color:#475569;">
                        <th style="padding:10px; text-align:left;">Banco</th><th style="padding:10px; text-align:center;">Acciones</th>
                    </tr></thead>
                    <tbody>
                        ${debito.map((t, idx) => {
                            const realIdx = tarjetas.findIndex(orig => orig.banco === t.banco && orig.tipo === t.tipo);
                            return `<tr style="border-bottom: 1px solid #f1f5f9;">
                                <td style="padding:12px 10px;"><strong>${t.banco}</strong> ${t.ultimos4 ? '••••'+t.ultimos4 : ''}</td>
                                <td style="padding:12px 10px; text-align:center;">
                                    <button onclick="abrirModalEdicionBanco('debito', ${realIdx})" style="background:none; border:none; cursor:pointer; font-size:16px;">✏️</button>
                                    <button onclick="eliminarBanco(${realIdx})" style="background:none; border:none; cursor:pointer; font-size:16px;">🗑️</button>
                                </td>
                            </tr>`
                        }).join('')}
                    </tbody>
                </table>`}
            </div>
        </div>

        <!-- COLUMNA CRÉDITO -->
        <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border-top: 5px solid #8b5cf6;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3 style="margin:0; color:#6b21a8; display:flex; align-items:center; gap:8px;">💳 Tarjetas Crédito (MSI)</h3>
                <button onclick="abrirModalEdicionBanco('credito')" style="padding: 8px 14px; background: #faf5ff; color: #6b21a8; border: 1px solid #e9d5ff; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 13px;">+ Nueva Tarjeta</button>
            </div>
            
            ${credito.length === 0 ? '<p style="color:#9ca3af; text-align:center;">No hay tarjetas registradas.</p>' : `
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead><tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0; color:#475569;">
                    <th style="padding:10px; text-align:left;">Banco</th><th style="padding:10px; text-align:center;">Corte</th><th style="padding:10px; text-align:center;">Acciones</th>
                </tr></thead>
                <tbody>
                    ${credito.map((t, idx) => {
                        const realIdx = tarjetas.findIndex(orig => orig.banco === t.banco && (orig.tipo === 'credito' || !orig.tipo));
                        return `<tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding:12px 10px;"><strong>${t.banco}</strong></td>
                            <td style="padding:12px 10px; text-align:center; color:#64748b;">Día ${t.diaCorte}</td>
                            <td style="padding:12px 10px; text-align:center;">
                                <button onclick="abrirModalEdicionBanco('credito', ${realIdx})" style="background:none; border:none; cursor:pointer; font-size:16px;">✏️</button>
                                <button onclick="eliminarBanco(${realIdx})" style="background:none; border:none; cursor:pointer; font-size:16px;">🗑️</button>
                            </td>
                        </tr>`
                    }).join('')}
                </tbody>
            </table>`}
        </div>
    </div>`;

    contenedor.innerHTML = html;
}

// Lógica para crear Cajas de Efectivo
function abrirModalEdicionCaja(index = null) {
    document.querySelector('[data-modal="edicion-caja"]')?.remove();
    const cajas = StorageService.get("cuentasEfectivo", [{ id: "efectivo", nombre: "💵 Efectivo Principal", saldo: 0 }]);
    let nombreCaja = "";
    if (index !== null) nombreCaja = cajas[index].nombre.replace("💵 ", "");

    const modalHTML = `
        <div data-modal="edicion-caja" style="position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:7000; display:flex; justify-content:center; align-items:center;">
            <div style="background:white; padding:30px; border-radius:12px; width:90%; max-width:400px;">
                <h2 style="margin-top:0; color:#065f46;">${index !== null ? '✏️ Editar Caja' : '💵 Nueva Caja'}</h2>
                <input type="hidden" id="modalCajaIndex" value="${index !== null ? index : ''}">
                <div style="margin-bottom:20px;">
                    <label style="font-weight:bold; font-size:13px; color:#374151; display:block; margin-bottom:5px;">Nombre de la Caja (Ej: Caja Chica)</label>
                    <input type="text" id="modalCajaNombre" value="${nombreCaja}" placeholder="Ej: Caja Fuerte" style="width:100%; padding:10px; border:1px solid #d1d5db; border-radius:6px; box-sizing:border-box;">
                </div>
                <div style="display:flex; gap:10px;">
                    <button onclick="guardarCajaModal()" style="flex:1; padding:12px; background:#10b981; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">✅ Guardar</button>
                    <button onclick="document.querySelector('[data-modal=&quot;edicion-caja&quot;]')?.remove()" style="flex:1; padding:12px; background:#e5e7eb; color:#4b5563; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">✕ Cancelar</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function guardarCajaModal() {
    const cajas = StorageService.get("cuentasEfectivo", [{ id: "efectivo", nombre: "💵 Efectivo Principal", saldo: 0 }]);
    const indexStr = document.getElementById("modalCajaIndex").value;
    const nombre = document.getElementById("modalCajaNombre").value.trim();
    if (!nombre) return alert("El nombre es obligatorio.");

    const nombreFormateado = nombre.startsWith("💵") ? nombre : `💵 ${nombre}`;

    if (indexStr === "") {
        cajas.push({ id: "caja_" + Date.now(), nombre: nombreFormateado, saldo: 0 });
    } else {
        cajas[parseInt(indexStr)].nombre = nombreFormateado;
    }
    StorageService.set("cuentasEfectivo", cajas);
    document.querySelector('[data-modal="edicion-caja"]').remove();
    renderBancosConfig();
}

function eliminarCaja(index) {
    if (confirm("⚠️ ¿Eliminar esta caja?")) {
        const cajas = StorageService.get("cuentasEfectivo", []);
        cajas.splice(index, 1);
        StorageService.set("cuentasEfectivo", cajas);
        renderBancosConfig();
    }
}

function guardarEdicionBancoModal() {
    const tipo = document.getElementById("modalBancoTipo").value;
    const indexStr = document.getElementById("modalBancoIndex").value;
    const nombre = document.getElementById("modalBancoNombre").value.trim().toUpperCase();
    
    if (!nombre) return alert("⚠️ El nombre del banco es obligatorio.");

    let nuevaCuenta = { banco: nombre, tipo: tipo };

    if (tipo === 'debito') {
        nuevaCuenta.ultimos4 = document.getElementById("modalBancoDigitos").value.trim();
        nuevaCuenta.saldoInicial = parseFloat(document.getElementById("modalBancoSaldo").value) || 0;
        nuevaCuenta.diaCorte = 0;
        nuevaCuenta.diaLimite = 0;
    } else {
        const corte = parseInt(document.getElementById("modalBancoCorte").value);
        const limite = parseInt(document.getElementById("modalBancoLimite").value);
        if (isNaN(corte) || isNaN(limite) || corte < 1 || corte > 31 || limite < 1 || limite > 31) {
            return alert("⚠️ Los días de corte y límite deben ser números entre 1 y 31.");
        }
        nuevaCuenta.diaCorte = corte;
        nuevaCuenta.diaLimite = limite;
    }

    if (indexStr === "") {
        tarjetasConfig.push(nuevaCuenta); // Nueva cuenta
    } else {
        tarjetasConfig[parseInt(indexStr)] = nuevaCuenta; // Editando existente
    }

    actualizarYRefrescarBancos();
    document.querySelector('[data-modal="edicion-banco"]').remove();
}

function eliminarBanco(index) {
    if (confirm("⚠️ ¿Estás completamente seguro de eliminar esta cuenta? Esta acción no se puede deshacer.")) {
        tarjetasConfig.splice(index, 1);
        actualizarYRefrescarBancos();
    }
}

function actualizarYRefrescarBancos() {
    if (!StorageService.set("tarjetasConfig", tarjetasConfig)) {
        console.error("❌ Error guardando bancos");
        return;
    }
    // Sincroniza cuentas de débito a cuentas-bancarias para el resto del sistema
    const cuentasBancarias = tarjetasConfig
        .filter(t => t.tipo === "debito")
        .map((t, idx) => ({
            id: `debito_${idx}_${t.banco}`,
            nombre: `🏦 ${t.banco}${t.ultimos4 ? ' ••••' + t.ultimos4 : ''}`,
            tipo: t.tipo,
            banco: t.banco,
            ultimos4: t.ultimos4,
            saldoInicial: t.saldoInicial
        }));
    StorageService.set("cuentas-bancarias", cuentasBancarias);
    
    renderBancosConfig();
    
    // Si la función existe, actualiza combos de pago en otras pantallas
    if (typeof actualizarSelectBancos === "function") actualizarSelectBancos();
}

function calcularFechaPago(fechaCompraStr, bancoNombre) {
    const infoBanco = tarjetasConfig.find(t => t.banco === bancoNombre);
    if (!infoBanco) return fechaCompraStr;

    // Aseguramos que el 13 de mayo se procese como 13 de mayo
    const fechaLimpia = window.getFechaLocalMX(fechaCompraStr);
    const [anio, mes, dia] = fechaLimpia.split('-').map(Number);
    
    const diaCorte = parseInt(infoBanco.diaCorte);
    const diaLimite = parseInt(infoBanco.diaLimite);

    // Si hoy (13) > corte (12), saltamos 2 meses (Julio)
    let mesesASumar = (dia > diaCorte) ? 2 : 1;
    let fechaPago = new Date(anio, (mes - 1) + mesesASumar, diaLimite);
    
    return window.formatearFechaCortaMX(fechaPago);
}

function calcularCalendarioMSI(fechaRef, meses, nombreBanco) {
    const config = tarjetasConfig.find(t => t.banco === nombreBanco);
    if (!config) return [];

    let cronograma = [];
    // 🛡️ REPARACIÓN: Mismo blindaje local para la tabla de MSI
    let d = new Date();
    if (fechaRef) {
        if (typeof fechaRef === 'string') {
             if (fechaRef.includes('/')) {
                let p = fechaRef.split('/');
                d = new Date(p[2], p[1] - 1, p[0]);
            } else if (fechaRef.includes('-')) {
                let p = fechaRef.split('T')[0].split('-');
                if(p[0].length === 4) d = new Date(p[0], p[1] - 1, p[2]);
                else d = new Date(p[2], p[1] - 1, p[0]);
            }
        } else {
            d = new Date(fechaRef);
        }
    }
    if (isNaN(d.getTime())) d = new Date();

    const diaCompra = d.getDate();
    const diaCorte  = parseInt(config.diaCorte);
    const diaLimite = parseInt(config.diaLimite);

    let mesBase = d.getMonth();
    let anioBase = d.getFullYear();

    // REGLAS DE CORTE BANCARIO (Sincronizadas)
    if (diaCompra > diaCorte) mesBase += 1;
    if (diaLimite < diaCorte) mesBase += 1;

    for (let i = 0; i < meses; i++) {
        let fPago = new Date(anioBase, mesBase + i, diaLimite);
        let yyyy = fPago.getFullYear();
        let mm = String(fPago.getMonth() + 1).padStart(2, '0');
        let dd = String(fPago.getDate()).padStart(2, '0');
        
        cronograma.push({ 
            n: i + 1, 
            fecha: `${yyyy}-${mm}-${dd}` 
        });
    }
    return cronograma;
}
// =====================================================================
// 💳 MSI DASHBOARD - VERSIÓN LIMPIA (LEE LOS DATOS TRANSVERSALES EXACTOS)
// =====================================================================
window.renderDashboardMSI = function(bancoSelect = null, mesSelect = null) {
    if (bancoSelect !== null) window._msiFiltroBanco = bancoSelect;
    else if (!window._msiFiltroBanco) window._msiFiltroBanco = 'Todos';

    if (mesSelect !== null) window._msiFiltroMes = mesSelect;
    else if (!window._msiFiltroMes) window._msiFiltroMes = 'Todos';

    const deudas = StorageService.get("cuentasMSI", []);
    const tarjetasConfig = StorageService.get("tarjetasConfig", []);
    const hoy = new Date();
    hoy.setHours(0,0,0,0);

    // 1. CÁLCULOS GLOBALES DE DEUDA
    let totalesPorBanco = {};
    let deudaTotalGlobal = 0;
    
    tarjetasConfig.filter(t => !t.tipo || t.tipo === "credito").forEach(t => totalesPorBanco[t.banco] = 0);
    
    deudas.forEach(deuda => {
        if (totalesPorBanco[deuda.banco] === undefined) totalesPorBanco[deuda.banco] = 0;
        const totalVal  = parseFloat(String(deuda.total || 0).replace(/[$,]/g, ''));
        const yaPagado = parseFloat(deuda.montoPagado || 0);
        const restante  = Math.max(0, totalVal - yaPagado);
        
        totalesPorBanco[deuda.banco] += restante;
        deudaTotalGlobal += restante;
    });

    // 2. NIVEL 1: FILTROS Y BOTÓN
    let btnPagarTarjeta = '';
    if (window._msiFiltroBanco !== 'Todos' && totalesPorBanco[window._msiFiltroBanco] > 0) {
        btnPagarTarjeta = `<button onclick="abrirModalPagoTarjeta('${window._msiFiltroBanco}')" style="padding:8px 16px; background:#8b5cf6; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer; font-size:13px; box-shadow:0 2px 4px rgba(139, 92, 246, 0.3); transition:0.2s;">💳 Abonar a ${window._msiFiltroBanco}</button>`;
    }

    let htmlNivel1 = `
        <div style="margin-bottom:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h4 style="margin:0; color:#475569; font-size:12px; text-transform:uppercase;">1️⃣ Deuda Global</h4>
                ${btnPagarTarjeta}
            </div>
            <div style="display:flex; gap:10px; overflow-x:auto; padding-bottom:5px;">
                <div onclick="renderDashboardMSI('Todos')" style="cursor:pointer; min-width:140px; padding:12px; border-radius:8px; border:2px solid ${window._msiFiltroBanco === 'Todos' ? '#8b5cf6' : '#e2e8f0'}; background:${window._msiFiltroBanco === 'Todos' ? '#faf5ff' : 'white'}; text-align:center;">
                    <div style="font-size:11px; color:#6b7280; text-transform:uppercase; font-weight:bold;">Total Acumulado</div>
                    <div style="font-weight:900; font-size:16px; color:#7c3aed;">${dinero(deudaTotalGlobal)}</div>
                </div>`;
                
    Object.keys(totalesPorBanco).forEach(banco => {
        const isActivo = window._msiFiltroBanco === banco;
        htmlNivel1 += `
                <div onclick="renderDashboardMSI('${banco}')" style="cursor:pointer; min-width:140px; padding:12px; border-radius:8px; border:2px solid ${isActivo ? '#3b82f6' : '#e2e8f0'}; background:${isActivo ? '#eff6ff' : 'white'}; text-align:center;">
                    <div style="font-size:11px; color:#6b7280; font-weight:bold;">🏦 ${banco}</div>
                    <div style="font-weight:900; font-size:16px; color:#1d4ed8;">${dinero(totalesPorBanco[banco])}</div>
                </div>`;
    });
    htmlNivel1 += `</div></div>`;

    // 3. RECOPILAR CUOTAS (Leyendo directamente el estado real)
    let cronogramaGlobal = {};
    const mesesNombre = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    let deudasNivel2 = window._msiFiltroBanco === 'Todos' ? deudas : deudas.filter(d => d.banco === window._msiFiltroBanco);

    deudasNivel2.forEach(deuda => {
        const configBanco = tarjetasConfig.find(t => t.banco === deuda.banco) || { diaLimite: 1 };
        const diaLimite = parseInt(configBanco.diaLimite) || 1;
        const cuotaOriginal = parseFloat(String(deuda.cuotaMensual || 0).replace(/[$,]/g, ''));

        (deuda.calendario || []).forEach((pago) => {
            if (pago.estado !== 'Pagado') {
                // Descontamos lo parcial si existe
                let abonado = parseFloat(pago.montoAbonado || 0);
                let saldoPendienteDeEstaCuota = cuotaOriginal - abonado;

                if (saldoPendienteDeEstaCuota > 0) {
                    const partes = pago.fecha.split('-');
                    let anioPago = parseInt(partes[0]);
                    let mesPago = parseInt(partes[1]) - 1;
                    
                    const fechaPagoReal = new Date(anioPago, mesPago, diaLimite, 0, 0, 0);
                    const mesClave = `${anioPago}-${String(mesPago + 1).padStart(2, '0')}`;

                    if (!cronogramaGlobal[mesClave]) cronogramaGlobal[mesClave] = { total: 0, detalles: [] };
                    cronogramaGlobal[mesClave].total += saldoPendienteDeEstaCuota;
                    cronogramaGlobal[mesClave].detalles.push({ 
                        deuda, 
                        pago, 
                        cuotaOriginal: cuotaOriginal,
                        cuotaPendienteReal: saldoPendienteDeEstaCuota,
                        fechaExigible: fechaPagoReal,
                        esParcial: pago.estado === 'Parcial'
                    });
                }
            }
        });
    });

    // 4. NIVEL 2: FILTROS DE MESES
    let htmlNivel2 = `<div style="margin-bottom:20px; padding-top:15px; border-top:1px dashed #cbd5e1;"><div style="display:flex; gap:10px; overflow-x:auto; padding-bottom:5px;">
        <div onclick="renderDashboardMSI(null, 'Todos')" style="cursor:pointer; min-width:120px; padding:10px; border-radius:8px; border:2px solid ${window._msiFiltroMes === 'Todos' ? '#f59e0b' : '#e2e8f0'}; background:${window._msiFiltroMes === 'Todos' ? '#fffbeb' : 'white'}; text-align:center;">
            <div style="font-size:10px; color:#6b7280; font-weight:bold; text-transform:uppercase;">📂 Ver Todo</div>
            <div style="font-weight:bold; font-size:13px; color:#d97706;">Pendientes</div>
        </div>`;

    Object.keys(cronogramaGlobal).sort().forEach(clave => {
        const [anio, mes] = clave.split('-');
        const isActivo = window._msiFiltroMes === clave;
        htmlNivel2 += `<div onclick="renderDashboardMSI(null, '${clave}')" style="cursor:pointer; min-width:110px; padding:10px; border-radius:8px; border:2px solid ${isActivo ? '#10b981' : '#e2e8f0'}; background:${isActivo ? '#ecfdf5' : 'white'}; text-align:center;">
            <div style="font-size:11px; color:#6b7280; font-weight:bold; text-transform:uppercase;">📅 ${mesesNombre[parseInt(mes)-1]} ${anio.substring(2)}</div>
            <div style="font-weight:900; font-size:14px; color:#059669;">${dinero(cronogramaGlobal[clave].total)}</div>
        </div>`;
    });
    htmlNivel2 += `</div></div>`;

    // 5. NIVEL 3: LISTA EXIGIBLE
    let htmlNivel3 = `<div style="background:white; border-radius:8px; border:1px solid #e2e8f0; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.05);">`;
    let hayPagosNivel3 = false;
    
    Object.keys(cronogramaGlobal).sort().forEach(clave => {
        if (window._msiFiltroMes !== 'Todos' && window._msiFiltroMes !== clave) return;
        hayPagosNivel3 = true;
        const [anio, mes] = clave.split('-');
        htmlNivel3 += `<div style="background:#f1f5f9; padding:8px 15px; font-size:11px; font-weight:bold; color:#475569; border-bottom:1px solid #e2e8f0; text-transform:uppercase; letter-spacing:1px;">Cobros del mes: ${mesesNombre[parseInt(mes)-1]} ${anio}</div>`;
        
        cronogramaGlobal[clave].detalles.sort((a,b) => a.fechaExigible - b.fechaExigible).forEach((det) => {
            const estaVencida = det.fechaExigible < hoy;
            const numCuota = det.pago.n || det.pago.numero;
            const totalCuotas = det.deuda.meses || det.deuda.plazo;
            const nombreProd = det.deuda.producto || det.deuda.concepto || 'Compra MSI';

            htmlNivel3 += `
                <div onclick="abrirHistorialMSI(${det.deuda.id})" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; padding:12px 15px; border-bottom:1px solid #f1f5f9; background:${estaVencida ? '#fef2f2' : 'white'}; transition:0.2s;" onmouseover="this.style.filter='brightness(0.95)'" onmouseout="this.style.filter='none'">
                    <div>
                        <span style="font-weight:bold; color:#1e293b; font-size:13px;">📅 Límite: ${window.formatearFechaCortaMX(det.fechaExigible)}</span>
                        ${det.esParcial ? `<span style="background:#fef3c7; color:#92400e; font-size:10px; padding:2px 6px; border-radius:9999px; margin-left:6px;">Abono Parcial</span>` : ''}
                        <br><small style="color:#64748b;">${nombreProd} (Cuota ${numCuota}/${totalCuotas}) | 🏦 ${det.deuda.banco}</small>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-weight:900; color:${estaVencida ? '#dc2626' : '#059669'}; font-size:16px;">
                            ${estaVencida ? '⚠️ ' : ''}${dinero(det.cuotaPendienteReal)}
                        </div>
                        ${estaVencida ? `<div style="color:white; background:#dc2626; border-radius:4px; font-weight:bold; font-size:9px; padding:2px 4px; display:inline-block; margin-top:2px;">VENCIDA</div>` : ''}
                    </div>
                </div>`;
        });
    });
    
    if (!hayPagosNivel3) htmlNivel3 += `<div style="padding:40px 20px; text-align:center; color:#9ca3af;">No tienes pagos pendientes. 🎉</div>`;
    htmlNivel3 += `</div>`;

    const mainContainer = document.getElementById('flujo-msi');
    if (!mainContainer) return;
    let cascadaWrapper = document.getElementById("wrapper-cascada-msi");
    if (!cascadaWrapper) {
        const headerH2 = mainContainer.querySelector('h2');
        mainContainer.innerHTML = '';
        if (headerH2) mainContainer.appendChild(headerH2);
        cascadaWrapper = document.createElement("div");
        cascadaWrapper.id = "wrapper-cascada-msi";
        mainContainer.appendChild(cascadaWrapper);
    }
    cascadaWrapper.innerHTML = htmlNivel1 + htmlNivel2 + htmlNivel3;
};

// =====================================================================
// MODAL DE HISTORIAL (AHORA MUESTRA CUÁNTO RESTA EXACTAMENTE)
// =====================================================================
window.abrirHistorialMSI = function(id) {
    const deudas = StorageService.get("cuentasMSI", []);
    const tarjetasConfig = StorageService.get("tarjetasConfig", []);
    const movimientos = StorageService.get("movimientosCaja", []); 
    const deuda = deudas.find(d => String(d.id) === String(id));
    if(!deuda) return;

    document.querySelector('[data-modal="historial-msi"]')?.remove();

    const configBanco = tarjetasConfig.find(t => t.banco === deuda.banco) || { diaLimite: 1 };
    const diaLimite = parseInt(configBanco.diaLimite) || 1;
    const hoy = new Date(); hoy.setHours(0,0,0,0);

    const cuotaOriginal = parseFloat(String(deuda.cuotaMensual || 0).replace(/[$,]/g, ''));
    const totalDeuda = parseFloat(String(deuda.total || 0).replace(/[$,]/g, ''));
    const yaPagado = parseFloat(deuda.montoPagado || 0);
    const pct = Math.min(100, (yaPagado / totalDeuda) * 100).toFixed(0);

    // 1. DIBUJAR CALENDARIO CON ESTADOS REALES
    let filasCalendario = (deuda.calendario || []).map((p) => {
        const partes = p.fecha.split('-');
        const fechaPagoReal = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, diaLimite, 0, 0, 0);
        
        const estaPagada = p.estado === 'Pagado';
        const esParcial = p.estado === 'Parcial';
        const vencida = !estaPagada && fechaPagoReal < hoy;
        
        let colorEstado = '#3b82f6';
        let txtEstado = '⏳ Pendiente';
        
        if (estaPagada) { colorEstado = '#10b981'; txtEstado = '✅ Pagado'; }
        else if (esParcial && vencida) { colorEstado = '#ea580c'; txtEstado = '⚠️ Parcial Vencido'; }
        else if (esParcial) { colorEstado = '#ea580c'; txtEstado = '⏳ Pago Parcial'; }
        else if (vencida) { colorEstado = '#ef4444'; txtEstado = '⚠️ Vencido'; }

        // 👉 FORMATO VISUAL DEL SALDO (Tachar lo viejo, mostrar lo que falta)
        let textoMonto = dinero(cuotaOriginal);
        if (esParcial) {
            let abonado = parseFloat(p.montoAbonado || 0);
            let faltante = cuotaOriginal - abonado;
            textoMonto = `<span style="text-decoration:line-through; color:#94a3b8; font-size:11px; display:block; margin-bottom:2px;">${dinero(cuotaOriginal)}</span>
                          <span style="color:#b45309; font-weight:bold;">Restan ${dinero(faltante)}</span>`;
        } else if (estaPagada) {
            textoMonto = `<span style="color:#10b981;">${dinero(cuotaOriginal)}</span>`;
        }

        return `
        <tr style="border-bottom:1px solid #f1f5f9; background:${estaPagada ? '#f0fdf4' : (vencida && !esParcial ? '#fef2f2' : (esParcial ? '#fff7ed' : 'transparent'))}">
            <td style="padding:12px; text-align:center; color:#64748b; font-weight:bold;">${p.n || p.numero}</td>
            <td style="padding:12px; font-weight:bold;">${window.formatearFechaCortaMX(fechaPagoReal)}</td>
            <td style="padding:12px; text-align:right;">${textoMonto}</td>
            <td style="padding:12px; text-align:center; font-weight:bold; color:${colorEstado}; font-size:12px;">${txtEstado}</td>
        </tr>`;
    }).join('');

    // 2. ABONOS (Historial de Caja)
    const abonosDeEsteBanco = movimientos.filter(m => 
        m.referencia === `PAGO-TC-${deuda.banco}` || 
        (m.concepto && m.concepto.includes('Tarjeta de Crédito') && m.concepto.includes(deuda.banco))
    ).sort((a,b) => new Date(b.fecha) - new Date(a.fecha));

    let htmlAbonos = '';
    if(abonosDeEsteBanco.length > 0) {
        htmlAbonos = abonosDeEsteBanco.map(m => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #e2e8f0; font-size:12px;">
                <div><span style="font-weight:bold; color:#334155;">${window.formatearFechaCortaMX(m.fecha)}</span> <span style="color:#64748b; margin-left:8px;">Desde: ${m.etiquetaCuenta || m.cuenta}</span></div>
                <div style="font-weight:bold; color:#10b981;">+ ${dinero(m.monto)}</div>
            </div>
        `).join('');
    } else {
        htmlAbonos = `<div style="padding:15px; text-align:center; color:#94a3b8; font-size:12px;">Aún no hay abonos globales registrados en caja para esta tarjeta.</div>`;
    }

    // 3. CONSTRUIR MODAL
    const modalHTML = `
    <div data-modal="historial-msi" style="position:fixed; inset:0; background:rgba(15,23,42,0.85); z-index:99999; display:flex; justify-content:center; align-items:center; padding:20px; backdrop-filter:blur(5px);">
        <div style="background:white; border-radius:16px; width:100%; max-width:650px; padding:30px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); max-height: 90vh; overflow-y:auto;">
            <div style="display:flex; justify-content:space-between; margin-bottom:25px; border-bottom:1px solid #e2e8f0; padding-bottom:15px;">
                <div>
                    <h3 style="margin:0; color:#1e40af; font-size:24px;">🏦 ${deuda.banco}</h3>
                    <p style="margin:5px 0 0 0; color:#0f172a; font-weight:bold; font-size:16px;">${deuda.producto || deuda.concepto}</p>
                </div>
                <button onclick="this.closest('[data-modal]').remove()" style="background:#f1f5f9; border:none; padding:10px 15px; border-radius:8px; cursor:pointer; font-weight:bold; color:#475569; transition: 0.2s;">✕ Cerrar</button>
            </div>

            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:20px; margin-bottom:25px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
                    <div><small style="color:#64748b; font-weight:bold; text-transform:uppercase;">Deuda Original</small><div style="font-weight:900; font-size:18px; color:#0f172a;">${dinero(totalDeuda)}</div></div>
                    <div style="text-align:right;"><small style="color:#64748b; font-weight:bold; text-transform:uppercase;">Avance (${pct}%)</small><div style="font-weight:900; font-size:18px; color:#10b981;">${dinero(yaPagado)}</div></div>
                </div>
                <div style="background:#e2e8f0; height:10px; border-radius:5px; width:100%; overflow:hidden;">
                    <div style="background:#10b981; height:100%; width:${pct}%;"></div>
                </div>
            </div>

            <h4 style="margin:0 0 10px 0; color:#334155; font-size:14px; text-transform:uppercase;">📋 Calendario de Mensualidades</h4>
            <div style="border:1px solid #e2e8f0; border-radius:10px; overflow:hidden; margin-bottom: 25px;">
                <table style="width:100%; border-collapse:collapse; font-size:13px;">
                    <thead style="background:#f1f5f9;">
                        <tr><th style="padding:12px; color:#475569;"># Cuota</th><th style="padding:12px; text-align:left; color:#475569;">Día Límite Pago</th><th style="padding:12px; text-align:right; color:#475569;">Monto</th><th style="padding:12px; color:#475569;">Estatus</th></tr>
                    </thead>
                    <tbody>${filasCalendario}</tbody>
                </table>
            </div>

            <h4 style="margin:0 0 10px 0; color:#334155; font-size:14px; text-transform:uppercase; display:flex; align-items:center; gap:8px;">
                💸 Abonos Globales a esta Tarjeta <small style="font-weight:normal; color:#64748b; text-transform:none;">(Historial de Caja)</small>
            </h4>
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:5px 15px;">
                ${htmlAbonos}
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

function renderCuentasMSI() {
    const contenedor = document.getElementById("listaCuentasMSI");
    if (!contenedor) return;

    const cuentasMSI = StorageService.get("cuentasMSI", []);
    if (cuentasMSI.length === 0) {
        contenedor.innerHTML = "<p style='text-align:center; color:#999; padding:20px;'>No hay compras a meses activas.</p>";
        return;
    }

    const hoy = new Date();
    let html = '';

    cuentasMSI.forEach((c) => {
        // 👉 BUG DE MIGRACIÓN CORREGIDO AQUÍ (plazo vs meses)
        const plazoTotal = c.plazo || c.meses || 1;
        const totalDeuda = parseFloat(String(c.total || 0).replace(/[$,]/g, ''));
        const cuota = parseFloat(String(c.cuotaMensual || 0).replace(/[$,]/g, ''));
        
        // Calcular el progreso real usando el dinero
        let yaPagado = c.montoPagado !== undefined ? c.montoPagado : ((c.pagosRealizados || 0) * cuota);
        const porcentaje = totalDeuda > 0 ? Math.min(100, (yaPagado / totalDeuda) * 100).toFixed(0) : 0;
        const estaTerminado = yaPagado >= totalDeuda - 0.5;
        const pagosHechos = cuota > 0 ? Math.floor(yaPagado / cuota) : 0;

        const calendario = c.calendario || [];

        html += `
        <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; margin-bottom:20px; overflow:hidden; box-shadow:0 2px 6px rgba(0,0,0,0.05);">
            <div style="background:${estaTerminado ? '#f0fdf4' : '#eff6ff'}; padding:16px 20px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <div>
                    <span style="font-size:18px; font-weight:bold; color:#1e40af;">🏦 ${c.banco}</span>
                    <span style="margin-left:10px; font-size:14px; color:#4b5563;">${c.producto || 'Compra'}</span>
                    ${estaTerminado ? '<span style="margin-left:8px; background:#d1fae5; color:#065f46; font-size:11px; padding:2px 8px; border-radius:9999px;">✅ Liquidado</span>' : ''}
                </div>
                <div style="text-align:right;">
                    <div style="font-size:13px; color:#6b7280;">Total: <strong>${dinero(c.total)}</strong></div>
                    <div style="font-size:13px; color:#27ae60;">Mensualidad: <strong>${dinero(c.cuotaMensual)}</strong></div>
                    <div style="font-size:12px; color:#9ca3af;">Compra: ${c.fechaCompra ? window.formatearFechaCortaMX(c.fechaCompra) : '—'}</div>
                </div>
            </div>

            <div style="padding:12px 20px; border-bottom:1px solid #f3f4f6;">
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <small style="color:#6b7280;">Progreso de pagos</small>
                    <small style="font-weight:bold; color:#1e40af;">${dinero(yaPagado)} de ${dinero(totalDeuda)} (${porcentaje}%)</small>
                </div>
                <div style="background:#e2e8f0; border-radius:4px; height:8px; width:100%;">
                    <div style="background:${estaTerminado ? '#16a34a' : '#3498db'}; height:100%; border-radius:4px; width:${porcentaje}%; transition:width 0.3s;"></div>
                </div>
            </div>

            <div style="padding:16px 20px;">
                <strong style="font-size:13px; color:#374151; display:block; margin-bottom:10px;">📋 Calendario de Cuotas</strong>
                <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; font-size:13px;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="padding:8px 10px; text-align:center; border-bottom:2px solid #e2e8f0;">#</th>
                        <th style="padding:8px 10px; text-align:left; border-bottom:2px solid #e2e8f0;">Fecha de Pago</th>
                        <th style="padding:8px 10px; text-align:right; border-bottom:2px solid #e2e8f0;">Importe</th>
                        <th style="padding:8px 10px; text-align:center; border-bottom:2px solid #e2e8f0;">Estado</th>
                        <th style="padding:8px 10px; text-align:center; border-bottom:2px solid #e2e8f0;">Acción</th>
                    </tr></thead>
                    <tbody>`;

        if (calendario.length > 0) {
            calendario.forEach((pago, pIdx) => {
                // Ahora lee el estado real que seteamos en el abono global
                const estaPagada = pago.estado === 'Pagado';
                const esParcial = pago.estado === 'Parcial';
                const fechaPago  = new Date(pago.fecha + 'T00:00:00');
                const vencida    = !estaPagada && fechaPago < hoy;
                const esHoyPago  = !estaPagada && fechaPago.toDateString() === hoy.toDateString();
                const esSiguiente = !estaPagada && !vencida && pIdx === pagosHechos;

                let rowBg = estaPagada ? '#f0fdf4' : (vencida ? '#fef2f2' : (esParcial ? '#fff7ed' : ''));
                let estadoBadge = '';
                
                if (estaPagada) estadoBadge = '<span style="background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:9999px;font-size:11px;">✅ Pagado</span>';
                else if (esParcial) estadoBadge = `<span style="background:#ffedd5;color:#9a3412;padding:2px 8px;border-radius:9999px;font-size:11px;">⏳ Parcial (${dinero(pago.montoAbonado)})</span>`;
                else if (vencida) estadoBadge = `<span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:9999px;font-size:11px;">⚠️ Vencido</span>`;
                else if (esHoyPago) estadoBadge = '<span style="background:#fef3c7;color:#d97706;padding:2px 8px;border-radius:9999px;font-size:11px;">🔔 Hoy</span>';
                else estadoBadge = '<span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:9999px;font-size:11px;">⏳ Pendiente</span>';

                let accionBtn = '';
                if (!estaPagada && !esParcial && (vencida || esSiguiente || esHoyPago)) {
                    accionBtn = `<button onclick="marcarPagoMSI(${c.id}, ${pIdx + 1})"
                        style="padding:4px 10px; background:#16a34a; color:white; border:none; border-radius:5px; cursor:pointer; font-size:12px; font-weight:bold;">
                        💰 Pago Individual
                    </button>`;
                }

                html += `<tr style="background:${rowBg}; border-bottom:1px solid #f3f4f6;">
                    <td style="padding:8px 10px; text-align:center; font-weight:bold; color:${vencida ? '#dc2626' : '#374151'};">${pago.n || pago.numero}</td>
                    <td style="padding:8px 10px; color:${vencida ? '#dc2626' : '#374151'}; font-weight:${vencida ? 'bold' : 'normal'};">${window.formatearFechaCortaMX(fechaPago)}</td>
                    <td style="padding:8px 10px; text-align:right; font-weight:bold;">${dinero(pago.monto || c.cuotaMensual)}</td>
                    <td style="padding:8px 10px; text-align:center;">${estadoBadge}</td>
                    <td style="padding:8px 10px; text-align:center;">${accionBtn}</td>
                </tr>`;
            });
        }
        html += `</tbody></table></div></div></div>`;
    });

    contenedor.innerHTML = html;
}

// ── Marcar la siguiente cuota como pagada ─────────────────────────────────────
function marcarPagoMSI(id, numeroCuota) {
    const cuentasMSI = StorageService.get("cuentasMSI", []);
    const idx = cuentasMSI.findIndex(c => c.id === id);
    if (idx === -1) return;

    const deuda = cuentasMSI[idx];
    const pagosActuales = deuda.pagosRealizados || 0;

    if (numeroCuota !== pagosActuales + 1) {
        alert(`⚠️ Solo puedes marcar la cuota ${pagosActuales + 1} como pagada. Las anteriores deben marcarse primero.`);
        return;
    }

    // --- NUEVO: RESUMEN Y CONFIRMACIÓN ---
    const formatoDinero = (val) => '$' + Number(val).toLocaleString('en-US', {minimumFractionDigits: 2});
    const msjConf = `⚠️ RESUMEN DE OPERACIÓN - ¿PAGAR CUOTA MSI?\n\nBanco: ${deuda.banco}\nCompra: ${deuda.producto || 'Compra'}\nCuota: ${numeroCuota} de ${deuda.meses}\nMonto a descontar: ${formatoDinero(deuda.cuotaMensual)}\n\n¿Deseas continuar con el registro?`;
    if (!confirm(msjConf)) return;
    // --- FIN DE CONFIRMACIÓN ---

    // Registrar el movimiento de egreso en caja

    // Registrar el movimiento de egreso en caja
    const movs = StorageService.get("movimientosCaja", []);
    movs.push({
        id: Date.now(),
        tipo: "egreso",
        concepto: `Pago MSI — ${deuda.banco}: ${deuda.producto || 'Compra'} (cuota ${numeroCuota}/${deuda.meses})`,
        monto: deuda.cuotaMensual,
        fecha: window.localISO(new Date()),
        cuenta: deuda.banco,
        etiquetaCuenta: `💳 ${deuda.banco} Crédito`,
        medioPago: "tarjeta_msi",
        referencia: `MSI-${deuda.compraId || id}-C${numeroCuota}`
    });
    StorageService.set("movimientosCaja", movs);

    deuda.pagosRealizados = pagosActuales + 1;
    cuentasMSI[idx] = deuda;
    StorageService.set("cuentasMSI", cuentasMSI);

    alert(`✅ Cuota ${numeroCuota} de ${deuda.meses} marcada como pagada.\nRestantes: ${deuda.meses - deuda.pagosRealizados}`);
    renderCuentasMSI();
    renderDashboardMSI();
}

// ── Deshacer el último pago marcado ──────────────────────────────────────────
function deshacerPagoMSI(id) {
    if (!confirm('¿Deshacer el último pago marcado? Esto revertirá el contador de cuotas.')) return;
    const cuentasMSI = StorageService.get("cuentasMSI", []);
    const idx = cuentasMSI.findIndex(c => c.id === id);
    if (idx === -1) return;

    const deuda = cuentasMSI[idx];
    if ((deuda.pagosRealizados || 0) === 0) { alert('No hay pagos que deshacer.'); return; }

    deuda.pagosRealizados = deuda.pagosRealizados - 1;
    cuentasMSI[idx] = deuda;
    StorageService.set("cuentasMSI", cuentasMSI);

    alert('↩ Último pago deshecho.');
    renderCuentasMSI();
    renderDashboardMSI();
}

// ===== FLUJO DE CAJA =====
function _etiquetaCuenta(m) {
    if (m.etiquetaCuenta) return m.etiquetaCuenta;
    const c = m.cuenta || "efectivo";
    if (c === "efectivo" || c === "caja") return "💵 Efectivo";
    const t = (tarjetasConfig || []).find(x => x.banco === c);
    if (t) return t.tipo === "debito" ? `🏦 ${t.banco} Débito` : `💳 ${t.banco} Crédito`;
    return "💵 Efectivo";
}

function renderFlujoCaja() {
    const contenedor = document.getElementById("tablasFlujoCaja");
    if (!contenedor) return;

    const movimientos = StorageService.get("movimientosCaja", []);

    let totalIngresos = 0;
    let totalEgresos = 0;

    // Per-account balances
    const saldosPorCuenta = {};
    movimientos.forEach(m => {
        const etq = _etiquetaCuenta(m);
        if (!saldosPorCuenta[etq]) saldosPorCuenta[etq] = 0;
        const monto = parseFloat(m.monto) || 0;
        const esIngreso = m.tipo === "ingreso" || m.tipo === "Ingreso";
        saldosPorCuenta[etq] += esIngreso ? monto : -monto;
        if (esIngreso) totalIngresos += monto;
        else totalEgresos += monto;
    });

    // Mini-tarjetas por cuenta
    let miniCards = '';
    if (Object.keys(saldosPorCuenta).length > 0) {
        miniCards = `<div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:20px;">`;
        Object.entries(saldosPorCuenta).forEach(([etq, saldo]) => {
            const color = saldo >= 0 ? '#059669' : '#dc2626';
            const bg = saldo >= 0 ? '#f0fdf4' : '#fef2f2';
            miniCards += `<div style="background:${bg}; padding:12px 18px; border-radius:8px; border-left:3px solid ${color}; min-width:160px;">
                <div style="font-size:13px; color:#6b7280;">${etq}</div>
                <div style="font-size:18px; font-weight:bold; color:${color};">${dinero(saldo)}</div>
            </div>`;
        });
        miniCards += `</div>`;
    }

    let html = miniCards + `
        <div style="overflow-x:auto;">
        <table class="tabla-admin" style="width:100%;">
            <thead><tr>
                <th>Fecha</th>
                <th>Folio</th>
                <th>Concepto</th>
                <th>Referencia</th>
                <th>Cuenta</th>
                <th>Tipo</th>
                <th style="text-align:right;">Monto</th>
            </tr></thead>
            <tbody>`;

    if (movimientos.length === 0) {
        html += `<tr><td colspan="7" style="text-align:center; padding:20px; color:#999;">Sin movimientos registrados.</td></tr>`;
    } else {
        [...movimientos].reverse().forEach(m => {
            const esIngreso = m.tipo === "ingreso" || m.tipo === "Ingreso";
            const colorTipo = esIngreso ? "#059669" : "#dc2626";
            const labelTipo = esIngreso ? "⬆️ Ingreso" : "⬇️ Egreso";
            const etq = _etiquetaCuenta(m);
            html += `
                <tr>
                    <td>${m.fecha || ""}</td>
                    <td>${m.folio || "—"}</td>
                    <td>${m.concepto || ""}</td>
                    <td>${m.referencia || "—"}</td>
                    <td><strong>${etq}</strong></td>
                    <td style="color:${colorTipo}; font-weight:bold;">${labelTipo}</td>
                    <td style="text-align:right; font-weight:bold; color:${colorTipo};">${dinero(m.monto)}</td>
                </tr>`;
        });
    }

    html += `</tbody></table></div>`;
    contenedor.innerHTML = html;

    const elIngresos = document.getElementById("totalIngresoContado");
    if (elIngresos) elIngresos.textContent = dinero(totalIngresos);
    const elEgresos = document.getElementById("totalEgresosProveedores");
    if (elEgresos) elEgresos.textContent = dinero(totalEgresos);
}
// ===== CUENTAS BANCARIAS DASHBOARD (LIQUIDEZ) =====

// Variable global para recordar la cuenta de débito seleccionada en el filtro
window._filtroCuentaLiquidez = 'Todos';

function renderCuentasBancarias(cuentaSeleccionada = null) {
    if (cuentaSeleccionada !== null) { window._filtroCuentaLiquidez = cuentaSeleccionada; }
    
    const contenedor = document.getElementById("tablaCuentasBancarias");
    if (!contenedor) return;

    const tarjetas = StorageService.get("tarjetasConfig", []);
    const movimientos = StorageService.get("movimientosCaja", []);
    const cajas = StorageService.get("cuentasEfectivo", [{ id: "efectivo", nombre: "💵 Efectivo Principal", saldo: 0 }]);

    // 1. Calcular saldos actuales de Cajas
    const saldosCajas = {};
    cajas.forEach(c => saldosCajas[c.id] = 0);
    
    // 2. Calcular saldos de Débito
    const cuentasDebito = tarjetas.filter(t => t.tipo === "debito");
    const saldosDebito = {};
    cuentasDebito.forEach(t => saldosDebito[t.banco] = parseFloat(t.saldoInicial) || 0);

    // 👉 CORRECCIÓN DE BUG: Reconocimiento inteligente de cajas
    movimientos.forEach(m => {
        const esIngreso = m.tipo === "ingreso" || m.tipo === "Ingreso";
        const monto = parseFloat(m.monto) || 0;
        
        // Sumar/restar a Cajas (Verificamos si el ID existe en nuestras cajas)
        if (saldosCajas[m.cuenta] !== undefined || m.cuenta === "efectivo" || m.cuenta === "caja") {
            const idCajaAfectada = (m.cuenta === "efectivo" || m.cuenta === "caja") ? "efectivo" : m.cuenta;
            if(saldosCajas[idCajaAfectada] !== undefined) {
                saldosCajas[idCajaAfectada] += esIngreso ? monto : -monto;
            }
        } 
        // Sumar/restar a Bancos Débito
        else if (saldosDebito[m.cuenta] !== undefined) {
            saldosDebito[m.cuenta] += esIngreso ? monto : -monto;
        }
    });

    const totalCajas = Object.values(saldosCajas).reduce((sum, s) => sum + s, 0);
    const totalDebito = Object.values(saldosDebito).reduce((sum, s) => sum + s, 0);

    // PANEL IZQUIERDO
    let leftPanelHTML = `
        <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border-top: 5px solid #3b82f6;">
            <h3 style="margin-top:0; color:#1e40af; border-bottom:1px solid #e2e8f0; padding-bottom:10px;">📊 SALDOS ACTUALES</h3>
            
            <div onclick="renderCuentasBancarias('Todos')" style="cursor:pointer; padding:12px; margin-bottom:10px; border-radius:8px; border:2px solid ${window._filtroCuentaLiquidez === 'Todos' ? '#3b82f6' : 'transparent'}; background:${window._filtroCuentaLiquidez === 'Todos' ? '#eff6ff' : '#f8fafc'}; transition:0.2s;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:bold; color:#1e40af;">🌍 Mostrar Todos</span>
                </div>
            </div>`;

    cajas.forEach(c => {
        const saldo = saldosCajas[c.id];
        const isActive = window._filtroCuentaLiquidez === c.id;
        leftPanelHTML += `
            <div onclick="renderCuentasBancarias('${c.id}')" style="cursor:pointer; padding:12px; margin-bottom:10px; border-radius:8px; border:2px solid ${isActive ? '#22c55e' : 'transparent'}; background:${isActive ? '#f0fdf4' : '#f8fafc'}; transition:0.2s;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:bold; color:#166534;">${c.nombre}</span>
                    <span style="font-size:16px; font-weight:bold; color:${saldo >= 0 ? '#15803d' : '#dc2626'};">${dinero(saldo)}</span>
                </div>
            </div>`;
    });

    cuentasDebito.forEach(t => {
        const saldo = saldosDebito[t.banco];
        const isActive = window._filtroCuentaLiquidez === t.banco;
        leftPanelHTML += `
            <div onclick="renderCuentasBancarias('${t.banco}')" style="cursor:pointer; padding:12px; margin-bottom:10px; border-radius:8px; border:2px solid ${isActive ? '#3b82f6' : 'transparent'}; background:${isActive ? '#eff6ff' : '#f8fafc'}; transition:0.2s;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:bold; color:#1e40af;">🏦 ${t.banco} Débito</span>
                    <span style="font-size:16px; font-weight:bold; color:${saldo >= 0 ? '#1d4ed8' : '#dc2626'};">${dinero(saldo)}</span>
                </div>
            </div>`;
    });
    leftPanelHTML += `</div>`;

    // PANEL DERECHO (Filtros de movimientos)
    let movimientosFiltrados = movimientos.slice().reverse();
    if (window._filtroCuentaLiquidez !== 'Todos') {
        movimientosFiltrados = movimientosFiltrados.filter(m => {
            if (m.cuenta === window._filtroCuentaLiquidez) return true;
            if (window._filtroCuentaLiquidez === 'efectivo' && (m.cuenta === 'efectivo' || m.cuenta === 'caja')) return true;
            return false;
        });
    }

    let rightPanelHTML = `
        <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:10px; margin-bottom:15px;">
                <h3 style="margin:0; color:#374151;">📋 MOVIMIENTOS RECIENTES</h3>
            </div>
            <div style="overflow-x:auto; max-height:450px;">
                <table style="width:100%; border-collapse:collapse; font-size:13px;">
                    <thead><tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0; color:#475569;">
                        <th style="padding:10px; text-align:left;">Fecha</th><th style="padding:10px; text-align:left;">Concepto</th><th style="padding:10px; text-align:left;">Cuenta</th><th style="padding:10px; text-align:right;">Monto</th>
                    </tr></thead>
                    <tbody>`;

    if (movimientosFiltrados.length === 0) {
        rightPanelHTML += `<tr><td colspan="4" style="text-align:center; padding:30px; color:#9ca3af;">No hay movimientos registrados.</td></tr>`;
    } else {
        movimientosFiltrados.slice(0, 30).forEach(m => {
            const esIngreso = m.tipo === "ingreso" || m.tipo === "Ingreso";
            const color = esIngreso ? "#16a34a" : "#dc2626";
            const icon = esIngreso ? "⬆️" : "⬇️";
            const cuentaLabel = m.etiquetaCuenta || m.cuenta || "efectivo";
            rightPanelHTML += `
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:10px;">${m.fecha ? window.formatearFechaCortaMX(m.fecha) : ""}</td>
                    <td style="padding:10px;">${m.concepto || ""}</td>
                    <td style="padding:10px; color:#64748b;">${cuentaLabel}</td>
                    <td style="padding:10px; text-align:right; font-weight:bold; color:${color};">${icon} ${dinero(m.monto)}</td>
                </tr>`;
        });
    }
    rightPanelHTML += `</tbody></table></div></div>`;

    contenedor.innerHTML = `
        <div style="display:flex; gap:20px; margin-bottom:20px; justify-content:center;">
            <div style="background:#f0fdf4; border:1px solid #86efac; border-radius:8px; padding:15px; text-align:center; min-width:200px;">
                <div style="font-size:11px; color:#166534; font-weight:bold; text-transform:uppercase;">💵 Total Cajas Efectivo</div>
                <div style="font-size:20px; font-weight:bold; color:#15803d;">${dinero(totalCajas)}</div>
            </div>
            <div style="background:#eff6ff; border:1px solid #93c5fd; border-radius:8px; padding:15px; text-align:center; min-width:200px;">
                <div style="font-size:11px; color:#1e40af; font-weight:bold; text-transform:uppercase;">🏦 Total Bancos Débito</div>
                <div style="font-size:20px; font-weight:bold; color:#1d4ed8;">${dinero(totalDebito)}</div>
            </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 20px;">
            ${leftPanelHTML}
            ${rightPanelHTML}
        </div>`;
}

// Reemplazo para Pago MSI
function abrirModalPagoTarjeta(banco) {
    if (!banco || banco === 'Todos') return;

    document.querySelector('[data-modal="pago-tarjeta"]')?.remove();
    const deudas = StorageService.get("cuentasMSI", []);
    let totalAdeudado = 0, vencidoYMesActual = 0;
    const hoy = new Date();
    const mesActualClave = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`;

    deudas.filter(d => d.banco === banco).forEach(deuda => {
        const cuotaVal = parseFloat(String(deuda.cuotaMensual || 0).replace(/[$,]/g, ''));
        const totalDeuda = parseFloat(String(deuda.total || 0).replace(/[$,]/g, ''));
        let yaPagado = deuda.montoPagado !== undefined ? deuda.montoPagado : ((deuda.pagosRealizados || 0) * cuotaVal);
        totalAdeudado += Math.max(0, totalDeuda - yaPagado);
        (deuda.calendario || []).forEach((pago, idx) => {
            const montoInicio = idx * cuotaVal, montoFin = (idx + 1) * cuotaVal;
            let pendiente = 0;
            if (yaPagado < montoFin) {
                pendiente = (yaPagado <= montoInicio) ? cuotaVal : montoFin - yaPagado;
            }
            if (pendiente > 0) {
                const clavePago = pago.fecha.substring(0, 7);
                const fechaObj = new Date(pago.fecha + 'T00:00:00');
                if (fechaObj < hoy || clavePago === mesActualClave) vencidoYMesActual += pendiente;
            }
        });
    });

    if (totalAdeudado <= 0) return alert("✅ No tienes deuda pendiente en esta tarjeta.");

    const tarjetasConfig = StorageService.get("tarjetasConfig", []);
    const cajas = StorageService.get("cuentasEfectivo", [{ id: "efectivo", nombre: "💵 Efectivo Principal", saldo: 0 }]);
    
    let opcionesCuenta = '';
    cajas.forEach(c => opcionesCuenta += `<option value="${c.id}">${c.nombre}</option>`);
    tarjetasConfig.filter(t => t.tipo === "debito").forEach(t => opcionesCuenta += `<option value="${t.banco}">🏦 ${t.banco} Débito</option>`);

    const modalHTML = `
        <div data-modal="pago-tarjeta" style="position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:7000; display:flex; justify-content:center; align-items:center;">
            <div style="background:white; padding:30px; border-radius:12px; width:90%; max-width:450px;">
                <h2 style="margin-top:0; color:#1e40af;">💳 Pago a Tarjeta: ${banco}</h2>
                <div style="margin-bottom:15px;">
                    <label>Monto a abonar:</label>
                    <input type="number" id="montoPagoTarjeta" value="${vencidoYMesActual.toFixed(2)}" max="${totalAdeudado.toFixed(2)}" style="width:100%; padding:12px; font-size:18px; border:2px solid #10b981; border-radius:6px;">
                </div>
                <div style="margin-bottom:25px;">
                    <label>¿De dónde sale el dinero?</label>
                    <select id="cuentaOrigenPagoTC" style="width:100%; padding:10px; border:1px solid #d1d5db; border-radius:6px;">${opcionesCuenta}</select>
                </div>
                <div style="display:flex; gap:10px;">
                    <button onclick="procesarPagoTarjetaGlobal('${banco}')" style="flex:1; padding:14px; background:#8b5cf6; color:white; border:none; border-radius:6px; font-weight:bold;">✅ Pagar</button>
                    <button onclick="document.querySelector('[data-modal=&quot;pago-tarjeta&quot;]').remove()" style="flex:1; padding:14px; background:#e5e7eb; border:none; border-radius:6px;">✕ Cancelar</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// ===== MSI DASHBOARD (FILTROS EN CASCADA Y PAGO GLOBAL) =====

// Variables globales para la cascada
window._msiFiltroBanco = 'Todos';
window._msiFiltroMes = 'Todos';

function renderDashboardMSI(bancoSelect = null, mesSelect = null) {
    if (bancoSelect !== null) {
        window._msiFiltroBanco = bancoSelect;
        window._msiFiltroMes = 'Todos'; // Resetear mes al cambiar de banco
    }
    if (mesSelect !== null) {
        window._msiFiltroMes = mesSelect;
    }

    const deudas = StorageService.get("cuentasMSI", []);
    const tarjetasConfig = StorageService.get("tarjetasConfig", []);
    const hoy = new Date();

    // ==========================================
    // NIVEL 1: DEUDA GLOBAL POR BANCO
    // ==========================================
    let totalesPorBanco = {};
    let deudaTotalGlobal = 0;
    
    tarjetasConfig.filter(t => !t.tipo || t.tipo === "credito").forEach(t => totalesPorBanco[t.banco] = 0);
    
    deudas.forEach(deuda => {
        if (totalesPorBanco[deuda.banco] === undefined) totalesPorBanco[deuda.banco] = 0;
        const totalVal  = parseFloat(String(deuda.total || 0).replace(/[$,]/g, ''));
        const cuotaVal  = parseFloat(String(deuda.cuotaMensual || 0).replace(/[$,]/g, ''));
        
        // CÁLCULO MEJORADO: Usamos montoPagado si existe, sino lo deducimos de las cuotas
        let yaPagado = deuda.montoPagado;
        if (yaPagado === undefined) yaPagado = (parseInt(deuda.pagosRealizados || 0) * cuotaVal);
        
        const restante  = Math.max(0, totalVal - yaPagado);
        
        totalesPorBanco[deuda.banco] += restante;
        deudaTotalGlobal += restante;
    });

    let btnPagarTarjeta = '';
    if (window._msiFiltroBanco !== 'Todos' && totalesPorBanco[window._msiFiltroBanco] > 0) {
        btnPagarTarjeta = `
            <button onclick="abrirModalPagoTarjeta('${window._msiFiltroBanco}')" 
                    style="padding:8px 16px; background:#8b5cf6; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer; font-size:13px; box-shadow:0 2px 4px rgba(139, 92, 246, 0.3);">
                💳 Abonar a Tarjeta ${window._msiFiltroBanco}
            </button>`;
    }

    let htmlNivel1 = `
        <div style="margin-bottom:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h4 style="margin:0; color:#475569; font-size:12px; text-transform:uppercase; letter-spacing:1px;">1️⃣ Deuda Global por Banco</h4>
                ${btnPagarTarjeta}
            </div>
            <div style="display:flex; gap:10px; overflow-x:auto; padding-bottom:5px;">
                <div onclick="renderDashboardMSI('Todos')" style="cursor:pointer; min-width:140px; padding:12px; border-radius:8px; border:2px solid ${window._msiFiltroBanco === 'Todos' ? '#8b5cf6' : '#e2e8f0'}; background:${window._msiFiltroBanco === 'Todos' ? '#faf5ff' : 'white'}; text-align:center; transition:0.2s;">
                    <div style="font-size:12px; color:#6b7280; margin-bottom:4px;">🌍 Todos los Bancos</div>
                    <div style="font-weight:bold; font-size:16px; color:#7c3aed;">${dinero(deudaTotalGlobal)}</div>
                </div>`;
                
    Object.keys(totalesPorBanco).forEach(banco => {
        const isActivo = window._msiFiltroBanco === banco;
        htmlNivel1 += `
                <div onclick="renderDashboardMSI('${banco}')" style="cursor:pointer; min-width:140px; padding:12px; border-radius:8px; border:2px solid ${isActivo ? '#3b82f6' : '#e2e8f0'}; background:${isActivo ? '#eff6ff' : 'white'}; text-align:center; transition:0.2s;">
                    <div style="font-size:12px; color:#6b7280; margin-bottom:4px;">🏦 ${banco}</div>
                    <div style="font-weight:bold; font-size:16px; color:#1d4ed8;">${dinero(totalesPorBanco[banco])}</div>
                </div>`;
    });
    htmlNivel1 += `</div></div>`;

    // ==========================================
    // NIVEL 2: PROYECCIÓN MENSUAL ESCALONADA
    // ==========================================
    let cronogramaGlobal = {};
    const mesesNombre = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

    let deudasNivel2 = deudas;
    if (window._msiFiltroBanco !== 'Todos') {
        deudasNivel2 = deudas.filter(d => d.banco === window._msiFiltroBanco);
    }

    // DISTRIBUCIÓN MATEMÁTICA EN CASCADA (Calcula pagos parciales reales)
    deudasNivel2.forEach(deuda => {
        const cuotaVal = parseFloat(String(deuda.cuotaMensual || 0).replace(/[$,]/g, ''));
        const totalDeuda = parseFloat(String(deuda.total || 0).replace(/[$,]/g, ''));
        
        let yaPagado = deuda.montoPagado;
        if (yaPagado === undefined) yaPagado = (parseInt(deuda.pagosRealizados || 0) * cuotaVal);

        (deuda.calendario || []).forEach((pago, idx) => {
            const montoInicioDeEstaCuota = idx * cuotaVal;
            const montoFinDeEstaCuota = (idx + 1) * cuotaVal;
            let pendienteEnEstaCuota = 0;

            if (yaPagado >= montoFinDeEstaCuota) {
                pendienteEnEstaCuota = 0; // Cuota liquidada
            } else if (yaPagado <= montoInicioDeEstaCuota) {
                pendienteEnEstaCuota = cuotaVal; // Cuota intocada
            } else {
                pendienteEnEstaCuota = montoFinDeEstaCuota - yaPagado; // Pago parcial
            }

            // Ajuste de centavos en la última cuota
            if (idx === deuda.meses - 1 && pendienteEnEstaCuota > 0) {
                const restanteReal = totalDeuda - yaPagado;
                pendienteEnEstaCuota = Math.min(pendienteEnEstaCuota, restanteReal);
            }

            if (pendienteEnEstaCuota > 0) {
                const clave = pago.fecha.substring(0, 7); // "YYYY-MM"
                if (!cronogramaGlobal[clave]) cronogramaGlobal[clave] = { total: 0, detalles: [] };
                cronogramaGlobal[clave].total += pendienteEnEstaCuota;
                cronogramaGlobal[clave].detalles.push({ deuda, pago, cuotaVal: pendienteEnEstaCuota });
            }
        });
    });

    let htmlNivel2 = `
        <div style="margin-bottom:20px; padding-top:15px; border-top:1px dashed #cbd5e1;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h4 style="margin:0; color:#475569; font-size:12px; text-transform:uppercase; letter-spacing:1px;">2️⃣ Proyección Mensual Escalonada</h4>
                <span style="font-size:11px; color:#64748b;">(Banco: ${window._msiFiltroBanco})</span>
            </div>
            <div style="display:flex; gap:10px; overflow-x:auto; padding-bottom:5px;">
                <div onclick="renderDashboardMSI(null, 'Todos')" style="cursor:pointer; min-width:120px; padding:10px; border-radius:8px; border:2px solid ${window._msiFiltroMes === 'Todos' ? '#f59e0b' : '#e2e8f0'}; background:${window._msiFiltroMes === 'Todos' ? '#fffbeb' : 'white'}; text-align:center; transition:0.2s;">
                    <div style="font-size:11px; color:#6b7280; margin-bottom:2px;">🌍 Mostrar</div>
                    <div style="font-weight:bold; font-size:14px; color:#d97706;">Todo el futuro</div>
                </div>`;

    Object.keys(cronogramaGlobal).sort().forEach(clave => {
        if (cronogramaGlobal[clave].total <= 0) return;
        const [anio, mes] = clave.split('-');
        const labelMes = `${mesesNombre[parseInt(mes)-1]} ${anio.substring(2)}`;
        const isActivo = window._msiFiltroMes === clave;
        
        htmlNivel2 += `
                <div onclick="renderDashboardMSI(null, '${clave}')" style="cursor:pointer; min-width:110px; padding:10px; border-radius:8px; border:2px solid ${isActivo ? '#10b981' : '#e2e8f0'}; background:${isActivo ? '#ecfdf5' : 'white'}; text-align:center; transition:0.2s;">
                    <div style="font-size:11px; color:#6b7280; margin-bottom:2px;">📅 ${labelMes}</div>
                    <div style="font-weight:bold; font-size:14px; color:#059669;">${dinero(cronogramaGlobal[clave].total)}</div>
                </div>`;
    });
    htmlNivel2 += `</div></div>`;

    // ==========================================
    // NIVEL 3: CALENDARIO DE PAGOS
    // ==========================================
    let htmlNivel3 = `
        <div style="margin-bottom:20px; padding-top:15px; border-top:1px dashed #cbd5e1;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h4 style="margin:0; color:#475569; font-size:12px; text-transform:uppercase; letter-spacing:1px;">3️⃣ Calendario de Pagos Pendientes</h4>
                <span style="font-size:11px; color:#64748b;">(Filtro: ${window._msiFiltroBanco} + ${window._msiFiltroMes === 'Todos' ? 'Todos los meses' : window._msiFiltroMes})</span>
            </div>
            <div style="background:white; border-radius:8px; border:1px solid #e2e8f0; overflow:hidden;">
    `;

    let hayPagosNivel3 = false;
    Object.keys(cronogramaGlobal).sort().forEach(clave => {
        if (window._msiFiltroMes !== 'Todos' && window._msiFiltroMes !== clave) return;
        if (cronogramaGlobal[clave].total <= 0) return;
        
        hayPagosNivel3 = true;
        const [anio, mes] = clave.split('-');
        
        htmlNivel3 += `<div style="background:#f8fafc; padding:8px 15px; font-size:12px; font-weight:bold; color:#475569; border-bottom:1px solid #e2e8f0;">📅 ${mesesNombre[parseInt(mes)-1]} ${anio}</div>`;
        
        cronogramaGlobal[clave].detalles.sort((a,b) => new Date(a.pago.fecha) - new Date(b.pago.fecha)).forEach((det) => {
            const fechaPago = new Date(det.pago.fecha + 'T00:00:00');
            const fechaStr = window.formatearFechaCortaMX(fechaPago);
            const estaVencida = fechaPago < hoy;
            
            // Para mostrar si es un saldo parcial de la cuota
            const esParcial = Math.abs(det.cuotaVal - (parseFloat(String(det.deuda.cuotaMensual).replace(/[$,]/g, '')))) > 0.1;
            const badgeParcial = esParcial ? `<span style="background:#fef3c7; color:#92400e; font-size:10px; padding:2px 6px; border-radius:9999px; margin-left:6px;">Parcial</span>` : '';
            const badgeVencida = estaVencida ? `<span style="background:#fee2e2; color:#dc2626; font-size:10px; padding:2px 6px; border-radius:9999px; margin-left:6px;">Vencido</span>` : '';

            htmlNivel3 += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 15px; border-bottom:1px solid #f1f5f9; background:${estaVencida ? '#fef2f2' : 'white'};">
                    <div>
                        <span style="font-weight:bold; color:#1e293b;">${fechaStr} | 🏦 ${det.deuda.banco}</span> ${badgeVencida} ${badgeParcial}
                        <br><small style="color:#64748b;">${det.deuda.producto || 'Compra'} (Cuota ${det.pago.n}/${det.deuda.meses})</small>
                    </div>
                    <div style="font-weight:bold; color:${estaVencida ? '#dc2626' : '#059669'};">
                        ${dinero(det.cuotaVal)}
                    </div>
                </div>`;
        });
    });

    if (!hayPagosNivel3) {
        htmlNivel3 += `<div style="padding:20px; text-align:center; color:#9ca3af;">No hay pagos programados para estos filtros.</div>`;
    }
    htmlNivel3 += `</div></div>`;

    // ==========================================
    // NIVEL 4: DETALLE DE COMPRAS ACTIVAS
    // ==========================================
    let htmlNivel4 = `
        <div style="margin-bottom:20px; padding-top:15px; border-top:1px dashed #cbd5e1;">
            <h4 style="margin:0 0 10px 0; color:#475569; font-size:12px; text-transform:uppercase; letter-spacing:1px;">4️⃣ Archivo Muerto (Compras Activas)</h4>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:15px;">
    `;

    // Solo mostrar deudas que aún tienen saldo
    const deudasNivel4 = deudasNivel2.filter(d => {
        let yp = d.montoPagado;
        if (yp === undefined) yp = (parseInt(d.pagosRealizados || 0) * parseFloat(String(d.cuotaMensual).replace(/[$,]/g, '')));
        const td = parseFloat(String(d.total).replace(/[$,]/g, ''));
        return yp < td;
    });

    if (deudasNivel4.length === 0) {
        htmlNivel4 += `<p style="grid-column:1/-1; text-align:center; color:#9ca3af;">No hay compras activas para el banco seleccionado.</p>`;
    } else {
        deudasNivel4.forEach(c => {
            const total = parseFloat(String(c.total).replace(/[$,]/g, ''));
            const cuota = parseFloat(String(c.cuotaMensual).replace(/[$,]/g, ''));
            let yaPagado = c.montoPagado;
            if (yaPagado === undefined) yaPagado = (parseInt(c.pagosRealizados || 0) * cuota);
            
            const porcentaje = Math.min(100, (yaPagado / total) * 100).toFixed(0);
            
            htmlNivel4 += `
                <div style="background:white; border:1px solid #e2e8f0; border-radius:8px; padding:15px; box-shadow:0 2px 4px rgba(0,0,0,0.02);">
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                        <strong style="color:#1e40af;">🏦 ${c.banco}</strong>
                        <span style="font-size:12px; color:#64748b;">${c.fechaCompra}</span>
                    </div>
                    <div style="font-size:13px; color:#374151; margin-bottom:10px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${c.producto || 'Compra General'}
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:5px;">
                        <span style="color:#64748b;">Total: ${dinero(total)}</span>
                        <span style="font-weight:bold; color:#059669;">Pagado: ${dinero(yaPagado)} (${porcentaje}%)</span>
                    </div>
                    <div style="background:#e2e8f0; height:6px; border-radius:3px; width:100%; overflow:hidden;">
                        <div style="background:#3b82f6; height:100%; width:${porcentaje}%;"></div>
                    </div>
                </div>`;
        });
    }
    htmlNivel4 += `</div></div>`;

    const mainContainer = document.getElementById('flujo-msi');
    if (!mainContainer) return;

    let cascadaWrapper = document.getElementById("wrapper-cascada-msi");
    if (!cascadaWrapper) {
        const headerH2 = mainContainer.querySelector('h2');
        mainContainer.innerHTML = '';
        if (headerH2) mainContainer.appendChild(headerH2);
        cascadaWrapper = document.createElement("div");
        cascadaWrapper.id = "wrapper-cascada-msi";
        mainContainer.appendChild(cascadaWrapper);
    }

    cascadaWrapper.innerHTML = htmlNivel1 + htmlNivel2 + htmlNivel3 + htmlNivel4;
}

function procesarPagoTarjetaGlobal(banco) {
    const montoAbono = parseFloat(document.getElementById("montoPagoTarjeta").value);
    const cuentaOrigen = document.getElementById("cuentaOrigenPagoTC").value;
    const cuentaOrigenEtiqueta = document.getElementById("cuentaOrigenPagoTC").options[document.getElementById("cuentaOrigenPagoTC").selectedIndex].text;

    if (isNaN(montoAbono) || montoAbono <= 0) return alert("⚠️ Ingresa un monto válido mayor a 0.");

    // --- NUEVO: RESUMEN Y CONFIRMACIÓN ---
    const formatoDinero = (val) => '$' + Number(val).toLocaleString('en-US', {minimumFractionDigits: 2});
    const msjConf = `⚠️ RESUMEN DE OPERACIÓN - ¿PAGAR A TARJETA?\n\nDestino: Tarjeta ${banco}\nMonto: ${formatoDinero(montoAbono)}\nOrigen del dinero: ${cuentaOrigenEtiqueta}\n\n¿Deseas descontar este dinero y registrar el pago?`;
    if (!confirm(msjConf)) return;
    // --- FIN DE CONFIRMACIÓN ---

    let cuentasMSI = StorageService.get("cuentasMSI", []);
    const tarjetasConfig = StorageService.get("tarjetasConfig", []);
    
    // Obtenemos el día límite del banco para saber las fechas exactas
    const configBanco = tarjetasConfig.find(t => t.banco === banco) || { diaLimite: 1 };
    const diaLimite = parseInt(configBanco.diaLimite) || 1;

    // =========================================================================
    // 1. EXTRAER TODAS LAS CUOTAS PENDIENTES EN UNA LÍNEA DE TIEMPO (Transversal)
    // =========================================================================
    let todasLasCuotas = [];

    cuentasMSI.filter(d => d.banco === banco).forEach(deuda => {
        const cuotaOriginal = parseFloat(String(deuda.cuotaMensual || 0).replace(/[$,]/g, ''));
        
        (deuda.calendario || []).forEach((pago, index) => {
            if (pago.estado !== 'Pagado') {
                // Calculamos su fecha real de cobro para ordenar cronológicamente
                const partes = pago.fecha.split('-');
                const fechaReal = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, diaLimite, 0, 0, 0);
                
                // Calculamos cuánto se debe exactamente de ESTA cuota específica
                let pendienteCuota = cuotaOriginal;
                if (pago.estado === 'Parcial' && pago.montoAbonado !== undefined) {
                    pendienteCuota = cuotaOriginal - parseFloat(pago.montoAbonado);
                }

                todasLasCuotas.push({
                    deudaId: deuda.id,
                    pagoRef: pago,
                    cuotaOriginal: cuotaOriginal,
                    montoFaltante: pendienteCuota,
                    fechaReal: fechaReal.getTime() // Se convierte a número para ordenar fácil
                });
            }
        });
    });

    // 2. ORDENAR: De la cuota más antigua (ej. Abril) a la más nueva (ej. Mayo)
    todasLasCuotas.sort((a, b) => a.fechaReal - b.fechaReal);

    // =========================================================================
    // 3. APLICAR EL DINERO BARRÍENDO LAS CUOTAS MENSUALES
    // =========================================================================
    let dineroRestante = montoAbono;

    for (let item of todasLasCuotas) {
        if (dineroRestante <= 0.01) break; // Si ya no hay dinero, salimos del ciclo

        if (dineroRestante >= item.montoFaltante - 0.05) { 
            // El dinero alcanza para liquidar esta cuota del mes
            dineroRestante -= item.montoFaltante;
            item.pagoRef.estado = 'Pagado';
            item.pagoRef.montoAbonado = item.cuotaOriginal;
        } else { 
            // El dinero no alcanza, se hace un abono parcial a la cuota
            item.pagoRef.estado = 'Parcial';
            item.pagoRef.montoAbonado = (item.cuotaOriginal - item.montoFaltante) + dineroRestante;
            dineroRestante = 0;
        }
    }

    // =========================================================================
    // 4. RECALCULAR LA ESTADÍSTICA GLOBAL DE CADA PRODUCTO
    // =========================================================================
    cuentasMSI.filter(d => d.banco === banco).forEach(deuda => {
        let totalPagadoAqui = 0;
        let cuotasLiquidadas = 0;
        const cuota = parseFloat(String(deuda.cuotaMensual || 0).replace(/[$,]/g, ''));

        (deuda.calendario || []).forEach(pago => {
            if (pago.estado === 'Pagado') {
                totalPagadoAqui += cuota;
                cuotasLiquidadas++;
            } else if (pago.estado === 'Parcial') {
                totalPagadoAqui += parseFloat(pago.montoAbonado || 0);
            }
        });

        // Actualizamos los totales del producto para que las barras de progreso sean exactas
        deuda.montoPagado = totalPagadoAqui;
        deuda.pagosRealizados = cuotasLiquidadas;
    });

    StorageService.set("cuentasMSI", cuentasMSI);

    // =========================================================================
    // 5. REGISTROS DE CAJA Y FÍSICOS (Intactos)
    // =========================================================================
    const movs = StorageService.get("movimientosCaja", []);
    movs.push({
        id: Date.now(),
        tipo: "egreso",
        concepto: `Pago a Corte Mensual Tarjeta de Crédito — ${banco}`,
        monto: montoAbono,
        fecha: window.localISO(new Date()),
        cuenta: cuentaOrigen,
        etiquetaCuenta: cuentaOrigenEtiqueta,
        medioPago: cuentaOrigen === "efectivo" || cuentaOrigen.startsWith("caja_") ? "efectivo" : "transferencia",
        referencia: `PAGO-TC-${banco}`
    });
    StorageService.set("movimientosCaja", movs);

    if (cuentaOrigen === "efectivo" || cuentaOrigen.startsWith("caja_")) {
        let cef = StorageService.get("cuentasEfectivo", []);
        const c = cef.find(x => x.id === cuentaOrigen);
        if (c) { c.saldo = (Number(c.saldo) || 0) - montoAbono; StorageService.set("cuentasEfectivo", cef); }
    } else {
        let cban = StorageService.get("cuentas-bancarias", []);
        const c = cban.find(x => x.banco === cuentaOrigen || x.id === cuentaOrigen);
        if (c) { c.saldo = (Number(c.saldo) || 0) - montoAbono; StorageService.set("cuentas-bancarias", cban); }
    }

    document.querySelector('[data-modal="pago-tarjeta"]').remove();
    alert(`✅ Pago de $${montoAbono.toFixed(2)} a la tarjeta ${banco} distribuido correctamente en el corte mensual.`);
    
    // Forzamos la recarga de las pantallas
    if (typeof renderCuentasMSI === 'function') renderCuentasMSI();
    if (typeof renderDashboardMSI === 'function') renderDashboardMSI();
    if (typeof renderCuentasBancarias === 'function') renderCuentasBancarias();
}
// =====================================================================
// ⚙️ GESTIÓN DE BANCOS Y CAJAS (REVISADO LÍNEA POR LÍNEA)
// =====================================================================

window.abrirModalEdicionBanco = function(tipo, index = null) {
    const tarjetas = StorageService.get("tarjetasConfig", []);
    const t = (index !== null) ? tarjetas[index] : { 
        banco: "", ultimos4: "", saldoInicial: 0, diaCorte: 1, diaLimite: 1 
    };

    const modalHTML = `
    <div data-modal="edit-banco" style="position:fixed; inset:0; background:rgba(15,23,42,0.8); z-index:9999; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
        <div style="background:white; padding:30px; border-radius:12px; width:90%; max-width:400px; box-shadow:0 20px 25px rgba(0,0,0,0.2);">
            <h3 style="margin-top:0; color:#1e40af;">${index !== null ? '✏️ Editar' : '🏦 Nuevo'} ${tipo.toUpperCase()}</h3>
            
            <div style="margin-top:15px;">
                <label style="display:block; font-weight:bold; font-size:12px; color:#64748b; margin-bottom:5px;">Nombre del Banco</label>
                <input type="text" id="mBancoNombre" value="${t.banco}" placeholder="Ej: BANAMEX" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; text-transform:uppercase;">
            </div>

            ${tipo === 'debito' ? `
                <div style="margin-top:15px;">
                    <label style="display:block; font-weight:bold; font-size:12px; color:#64748b; margin-bottom:5px;">Últimos 4 Dígitos</label>
                    <input type="text" id="mBancoDigitos" value="${t.ultimos4 || ''}" maxlength="4" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px;">
                </div>
                <div style="margin-top:15px;">
                    <label style="display:block; font-weight:bold; font-size:12px; color:#64748b; margin-bottom:5px;">Saldo Inicial (Liquidez)</label>
                    <input type="number" id="mBancoSaldo" value="${t.saldoInicial || 0}" step="0.01" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px;">
                </div>
            ` : `
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-top:15px;">
                    <div>
                        <label style="display:block; font-weight:bold; font-size:12px; color:#ef4444; margin-bottom:5px;">📅 Corte (Día)</label>
                        <input type="number" id="mBancoCorte" value="${t.diaCorte || 1}" min="1" max="31" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px;">
                    </div>
                    <div>
                        <label style="display:block; font-weight:bold; font-size:12px; color:#10b981; margin-bottom:5px;">💰 Pago (Día)</label>
                        <input type="number" id="mBancoLimite" value="${t.diaLimite || 1}" min="1" max="31" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px;">
                    </div>
                </div>
            `}

            <div style="display:flex; gap:10px; margin-top:30px;">
                <button onclick="window.confirmarGuardadoBanco('${tipo}', ${index})" style="flex:2; padding:12px; background:#2563eb; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">💾 Guardar</button>
                <button onclick="document.querySelector('[data-modal=&quot;edit-banco&quot;]').remove()" style="flex:1; padding:12px; background:#f1f5f9; color:#475569; border:none; border-radius:8px; cursor:pointer;">Cancelar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

window.confirmarGuardadoBanco = function(tipo, index) {
    const nombre = document.getElementById("mBancoNombre").value.trim().toUpperCase();
    if (!nombre) return alert("⚠️ El nombre es obligatorio.");

    let tarjetas = StorageService.get("tarjetasConfig", []);
    let datos = { banco: nombre, tipo: tipo };

    if (tipo === 'debito') {
        datos.ultimos4 = document.getElementById("mBancoDigitos").value.trim();
        datos.saldoInicial = parseFloat(document.getElementById("mBancoSaldo").value) || 0;
        datos.diaCorte = 0; datos.diaLimite = 0;
    } else {
        datos.diaCorte = parseInt(document.getElementById("mBancoCorte").value) || 1;
        datos.diaLimite = parseInt(document.getElementById("mBancoLimite").value) || 1;
        datos.ultimos4 = ""; datos.saldoInicial = 0;
    }

    if (index === null) tarjetas.push(datos);
    else tarjetas[index] = datos;

    StorageService.set("tarjetasConfig", tarjetas);
    location.reload();
};

window.abrirModalEdicionCaja = function(index = null) {
    const cajas = StorageService.get("cuentasEfectivo", [{ id: "efectivo", nombre: "💵 Efectivo Principal", saldo: 0 }]);
    let nombre = (index !== null) ? cajas[index].nombre.replace("💵 ", "") : "";

    const html = `
    <div data-modal="edit-caja" style="position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:9999; display:flex; justify-content:center; align-items:center;">
        <div style="background:white; padding:30px; border-radius:12px; width:300px;">
            <h3 style="margin:0 0 20px 0;">${index !== null ? '✏️ Editar Caja' : '💵 Nueva Caja'}</h3>
            <input type="text" id="mCajaNombre" value="${nombre}" placeholder="Nombre de caja" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px;">
            <div style="display:flex; gap:10px; margin-top:20px;">
                <button onclick="window.confirmarGuardadoCaja(${index})" style="flex:1; padding:12px; background:#10b981; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Guardar</button>
                <button onclick="document.querySelector('[data-modal=&quot;edit-caja&quot;]').remove()" style="flex:1; padding:12px; background:#eee; border:none; border-radius:6px; cursor:pointer;">Cancelar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window.confirmarGuardadoCaja = function(index) {
    const n = document.getElementById("mCajaNombre").value.trim();
    if (!n) return alert("Nombre obligatorio.");
    let cajas = StorageService.get("cuentasEfectivo", [{ id: "efectivo", nombre: "💵 Efectivo Principal", saldo: 0 }]);
    if (index === null) cajas.push({ id: "caja_" + Date.now(), nombre: "💵 " + n, saldo: 0 });
    else cajas[index].nombre = "💵 " + n;
    StorageService.set("cuentasEfectivo", cajas);
    location.reload();
};

// =====================================================================
// 📲 TRANSFERENCIAS ENTRE CUENTAS PROPIAS (MOTOR UNIFICADO BLINDADO)
// =====================================================================
window.abrirModalTransferencia = function() {
    // 1. Obtener cajas y cuentas de débito
    const cajas = StorageService.get("cuentasEfectivo", [{ id: "efectivo", nombre: "💵 Efectivo Principal", saldo: 0 }]);
    const tarjetas = StorageService.get("tarjetasConfig", []);
    const debito = tarjetas.filter(t => t.tipo === "debito");

    // 2. Construir opciones asegurando values únicos y válidos
    let opcionesHTML = '';
    cajas.forEach(c => {
        const idValido = c.id || c.nombre.replace(/\s+/g, '_');
        opcionesHTML += `<option value="${idValido}">${c.nombre}</option>`;
    });
    
    debito.forEach(t => {
        const idValido = t.banco || t.nombre;
        const etiquetaVisible = t.banco || t.nombre;
        opcionesHTML += `<option value="${idValido}">🏦 ${etiquetaVisible} Débito</option>`;
    });

    const fechaHoy = window.localISO ? window.localISO(new Date()).split('T')[0] : new Date().toISOString().split('T')[0];

    // 3. Limpiar modales anteriores
    document.getElementById('modalTransferenciaCuentas')?.remove();

    const html = `
    <div id="modalTransferenciaCuentas" style="position:fixed; inset:0; background:rgba(15,23,42,0.8); z-index:99999; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
        <div style="background:white; padding:30px; border-radius:12px; width:90%; max-width:480px; box-shadow:0 20px 25px rgba(0,0,0,0.2);">
            <h3 style="margin-top:0; color:#4f46e5; display:flex; align-items:center; gap:8px;">📲 Transferir entre Cuentas</h3>
            <p style="font-size:13px; color:#64748b; margin-bottom:20px;">Mueve dinero entre tus cajas de efectivo y tus cuentas bancarias.</p>
            
            <div style="margin-bottom:15px;">
                <label style="display:block; font-weight:bold; font-size:12px; color:#475569; margin-bottom:5px;">📅 Fecha de la transferencia:</label>
                <input type="date" id="cajaTransfFecha" value="${fechaHoy}" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;">
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:15px;">
                <div>
                    <label style="display:block; font-weight:bold; font-size:12px; color:#dc2626; margin-bottom:5px;">📤 Origen (Sale de):</label>
                    <select id="cajaTransfOrigen" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; background:#fef2f2; font-weight:bold; color:#b91c1c;">
                        ${opcionesHTML}
                    </select>
                </div>
                <div>
                    <label style="display:block; font-weight:bold; font-size:12px; color:#10b981; margin-bottom:5px;">📥 Destino (Entra a):</label>
                    <select id="cajaTransfDestino" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; background:#f0fdf4; font-weight:bold; color:#047857;">
                        ${opcionesHTML}
                    </select>
                </div>
            </div>

            <div style="margin-bottom:15px;">
                <label style="display:block; font-weight:bold; font-size:12px; color:#475569; margin-bottom:5px;">💰 Monto a transferir ($):</label>
                <input type="number" id="cajaTransfMonto" placeholder="0.00" min="0.01" step="0.01" style="width:100%; padding:12px; border:2px solid #6366f1; border-radius:6px; font-size:18px; font-weight:bold; box-sizing:border-box; color:#4f46e5; text-align:center;">
            </div>
            
            <div style="margin-bottom:20px;">
                <label style="display:block; font-weight:bold; font-size:12px; color:#475569; margin-bottom:5px;">📝 Motivo / Referencia (Opcional):</label>
                <input type="text" id="cajaTransfMotivo" placeholder="Ej: Depósito de ventas del día..." style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;">
            </div>

            <div style="display:flex; gap:10px; margin-top:20px;">
                <button onclick="ejecutarTransferenciaCuentas()" style="flex:2; padding:12px; background:#4f46e5; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:14px;">✅ Confirmar Transferencia</button>
                <button onclick="document.getElementById('modalTransferenciaCuentas').remove()" style="flex:1; padding:12px; background:#f1f5f9; color:#475569; border:none; border-radius:8px; cursor:pointer; font-weight:bold; font-size:14px;">✕ Cancelar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window.ejecutarTransferenciaCuentas = function() {
    const selOrigen = document.getElementById("cajaTransfOrigen");
    const selDestino = document.getElementById("cajaTransfDestino");
    const monto = parseFloat(document.getElementById("cajaTransfMonto").value);
    const fechaRaw = document.getElementById("cajaTransfFecha").value;
    const motivo = document.getElementById("cajaTransfMotivo").value.trim() || "Transferencia interna";

    const origen = selOrigen.value;
    const destino = selDestino.value;

    if (!origen || !destino) return alert("❌ Selecciona las cuentas de origen y destino.");
    if (origen === destino) return alert("❌ La cuenta de origen y destino no pueden ser la misma.");
    if (isNaN(monto) || monto <= 0) return alert("❌ Ingresa un monto válido mayor a cero.");
    if (!fechaRaw) return alert("❌ Selecciona una fecha válida.");

    const nombreOrigenFull = selOrigen.options[selOrigen.selectedIndex].text;
    const nombreDestinoFull = selDestino.options[selDestino.selectedIndex].text;

    if (!confirm(`¿Confirmas la transferencia de ${dinero(monto)} desde [${nombreOrigenFull}] hacia [${nombreDestinoFull}]?`)) return;

    const fechaBase = new Date(fechaRaw + 'T12:00:00');
    const fechaIso = window.localISO ? window.localISO(fechaBase) : fechaBase.toISOString();

    const nombreOrigen = nombreOrigenFull.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]\s?/g, ''); 
    const nombreDestino = nombreDestinoFull.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]\s?/g, '');

    const idTransf = Date.now();
    const movimientos = StorageService.get("movimientosCaja", []);

    // 1. Egreso (Sale de la cuenta origen)
    movimientos.push({
        id: idTransf + 1,
        fecha: fechaIso,
        monto: monto,
        tipo: "egreso",
        concepto: `Transferencia a: ${nombreDestino} (${motivo})`,
        referencia: `TR-${idTransf}`,
        cuenta: origen,
        medioPago: "transferencia",
        etiquetaCuenta: nombreOrigenFull
    });

    // 2. Ingreso (Entra a la cuenta destino)
    movimientos.push({
        id: idTransf + 2,
        fecha: fechaIso,
        monto: monto,
        tipo: "ingreso",
        concepto: `Transferencia de: ${nombreOrigen} (${motivo})`,
        referencia: `TR-${idTransf}`,
        cuenta: destino,
        medioPago: "transferencia",
        etiquetaCuenta: nombreDestinoFull
    });

    StorageService.set("movimientosCaja", movimientos);
    document.getElementById("modalTransferenciaCuentas").remove();
    alert(`✅ Transferencia de $${monto.toFixed(2)} registrada con éxito.`);
    
    // Refrescar vistas
    if (typeof window.renderCuentasBancarias === 'function') window.renderCuentasBancarias();
    if (typeof window.renderConciliacion === 'function') window.renderConciliacion();
};
window.renderCuentasBancarias = renderCuentasBancarias;
window.renderDashboardMSI = renderDashboardMSI;
window.abrirModalPagoTarjeta = abrirModalPagoTarjeta;
window.procesarPagoTarjetaGlobal = procesarPagoTarjetaGlobal;