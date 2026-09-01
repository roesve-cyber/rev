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
    const pagosHechos = deuda.pagosRealizados || 0;

    // 1. DIBUJAR CALENDARIO CON ESTADOS REALES + ACCIÓN POR CUOTA
    let filasCalendario = (deuda.calendario || []).map((p, pIdx) => {
        const partes = p.fecha.split('-');
        const fechaPagoReal = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, diaLimite, 0, 0, 0);
        
        const estaPagada = p.estado === 'Pagado';
        const esParcial = p.estado === 'Parcial';
        const vencida = !estaPagada && fechaPagoReal < hoy;
        const esHoyPago = !estaPagada && fechaPagoReal.toDateString() === hoy.toDateString();
        const esSiguiente = !estaPagada && !vencida && pIdx === pagosHechos;
        
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

        let accionBtn = '';
        if (!estaPagada && !esParcial && (vencida || esSiguiente || esHoyPago)) {
            accionBtn = `<button onclick="marcarPagoMSI(${deuda.id}, ${pIdx + 1})" style="padding:4px 10px; background:#16a34a; color:white; border:none; border-radius:5px; cursor:pointer; font-size:12px; font-weight:bold;">💰 Pagar</button>`;
        } else if (estaPagada && pIdx === pagosHechos - 1) {
            accionBtn = `<button onclick="deshacerPagoMSI(${deuda.id})" style="padding:4px 10px; background:#f1f5f9; color:#b91c1c; border:1px solid #fecaca; border-radius:5px; cursor:pointer; font-size:12px; font-weight:bold;">↩ Deshacer</button>`;
        }

        return `
        <tr style="border-bottom:1px solid #f1f5f9; background:${estaPagada ? '#f0fdf4' : (vencida && !esParcial ? '#fef2f2' : (esParcial ? '#fff7ed' : 'transparent'))}">
            <td style="padding:12px; text-align:center; color:#64748b; font-weight:bold;">${p.n || p.numero}</td>
            <td style="padding:12px; font-weight:bold;">${window.formatearFechaCortaMX(fechaPagoReal)}</td>
            <td style="padding:12px; text-align:right;">${textoMonto}</td>
            <td style="padding:12px; text-align:center; font-weight:bold; color:${colorEstado}; font-size:12px;">${txtEstado}</td>
            <td style="padding:12px; text-align:center;">${accionBtn}</td>
        </tr>`;
    }).join('');

    // 2. ABONOS (Historial de Caja)
    const abonosDeEsteBanco = movimientos.filter(m => 
        m.referencia === `PAGO-TC-${deuda.banco}` || 
        (m.concepto && m.concepto.includes('Tarjeta de Crédito') && m.concepto.includes(deuda.banco))
    ).sort((a,b) => (window.parseFechaMXOrNull ? window.parseFechaMXOrNull(a.fecha) : new Date(a.fecha)) - (window.parseFechaMXOrNull ? window.parseFechaMXOrNull(b.fecha) : new Date(b.fecha)));

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
                    ${deuda.reembolsoProveedor?.activo ? `<p style="margin:8px 0 0 0; font-size:12px; color:#6b21a8; background:#ede9fe; padding:6px 10px; border-radius:6px; display:inline-block;">🔄 Reembolsada por proveedor: ${dinero(deuda.reembolsoProveedor.monto)} el ${window.formatearFechaCortaMX(deuda.reembolsoProveedor.fecha)} a ${deuda.reembolsoProveedor.cuentaEtiqueta} — el banco sigue cobrando las cuotas pendientes.${deuda.reembolsoProveedor.recepcionesCanceladas?.length ? ' El producto pendiente de recibir fue cancelado (no llegará stock).' : ''}</p>` : ''}
                    <div style="margin-top:8px;">
                        ${deuda.reembolsoProveedor?.activo
                            ? `<button onclick="deshacerReembolsoProveedorMSI(${deuda.id})" style="padding:4px 10px; background:none; border:1px solid #fecaca; color:#b91c1c; border-radius:5px; cursor:pointer; font-size:12px;">↩ Deshacer marca de reembolso</button>`
                            : `<button onclick="abrirModalReembolsoProveedorMSI(${deuda.id})" style="padding:4px 10px; background:none; border:1px solid #c4b5fd; color:#6b21a8; border-radius:5px; cursor:pointer; font-size:12px;">🔄 Marcar reembolso de proveedor</button>`}
                    </div>
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
                        <tr><th style="padding:12px; color:#475569;"># Cuota</th><th style="padding:12px; text-align:left; color:#475569;">Día Límite Pago</th><th style="padding:12px; text-align:right; color:#475569;">Monto</th><th style="padding:12px; color:#475569;">Estatus</th><th style="padding:12px; color:#475569;">Acción</th></tr>
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

// ── Reembolso de proveedor sobre una compra MSI (producto no entregado) ──────
// Escenario: el proveedor reembolsa el total/parcial de la compra, pero el
// banco NO cancela las mensualidades restantes — las sigue cobrando igual.
// Esto NO se trata como "liquidar" la deuda MSI (las cuotas siguen siendo
// gasto real, se siguen pagando normal en marcarPagoMSI). Solo se registra
// el ingreso del reembolso a la cuenta donde cayó y se deja una marca visual
// para no confundir esta deuda con una compra de mercancía real recibida.
window.abrirModalReembolsoProveedorMSI = function(id) {
    const cuentasMSI = StorageService.get("cuentasMSI", []);
    const deuda = cuentasMSI.find(c => c.id === id);
    if (!deuda) return;

    document.querySelector('[data-modal="reembolso-msi"]')?.remove();
    const totalDeuda = parseFloat(String(deuda.total || 0).replace(/[$,]/g, ''));

    const html = `
    <div data-modal="reembolso-msi" style="position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:9999; display:flex; justify-content:center; align-items:center; padding:20px;">
        <div style="background:white; border-radius:12px; width:100%; max-width:460px; padding:26px;">
            <h3 style="margin:0 0 6px; color:#6b21a8;">🔄 Reembolso de proveedor</h3>
            <p style="margin:0 0 18px; font-size:12px; color:#7c2d12; background:#fffbeb; border:1px solid #fde68a; padding:8px 10px; border-radius:6px;">
                Esto solo registra que ${deuda.banco} — ${deuda.producto || 'esta compra'} fue reembolsada por el proveedor. Las mensualidades pendientes con el banco NO se cancelan aquí; se siguen pagando normal desde el calendario de cuotas.
            </p>
            <div style="display:flex; flex-direction:column; gap:12px;">
                <div>
                    <label style="font-size:12px; font-weight:bold; color:#374151;">MONTO REEMBOLSADO ($)</label>
                    <input type="number" id="reembolsoMSI_monto" min="0" step="0.01" value="${totalDeuda}" style="width:100%; padding:9px; border:1px solid #d1d5db; border-radius:6px; margin-top:4px;">
                </div>
                <div>
                    <label style="font-size:12px; font-weight:bold; color:#374151;">FECHA DEL REEMBOLSO</label>
                    <input type="date" id="reembolsoMSI_fecha" value="${window.obtenerHoyInputMX()}" style="width:100%; padding:9px; border:1px solid #d1d5db; border-radius:6px; margin-top:4px;">
                </div>
                <div>
                    <label style="font-size:12px; font-weight:bold; color:#374151;">¿A QUÉ CUENTA ENTRÓ EL DINERO?</label>
                    ${window._buildSelectorCuentas('reembolsoMSI_cuenta', false)}
                </div>
            </div>
            <div style="display:flex; gap:10px; margin-top:20px;">
                <button onclick="confirmarReembolsoProveedorMSI(${id})" style="flex:1; padding:12px; background:#7c3aed; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">✅ Registrar reembolso</button>
                <button onclick="document.querySelector('[data-modal=reembolso-msi]')?.remove()" style="padding:12px 18px; background:#e2e8f0; color:#475569; border:none; border-radius:6px; cursor:pointer;">✕ Cancelar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window.confirmarReembolsoProveedorMSI = function(id) {
    const cuentasMSI = StorageService.get("cuentasMSI", []);
    const idx = cuentasMSI.findIndex(c => c.id === id);
    if (idx === -1) return;
    const deuda = cuentasMSI[idx];

    const monto = parseFloat(document.getElementById('reembolsoMSI_monto')?.value) || 0;
    const fecha = document.getElementById('reembolsoMSI_fecha')?.value || window.obtenerHoyInputMX();
    const sel = document.getElementById('reembolsoMSI_cuenta');
    const cuentaId = sel?.value;
    const cuentaEtiqueta = sel?.options[sel.selectedIndex]?.text || cuentaId;

    if (monto <= 0) return alert('⚠️ El monto debe ser mayor a 0.');
    if (!cuentaId) return alert('⚠️ Selecciona a qué cuenta entró el dinero.');

    if (!confirm(`Confirmar: ${dinero(monto)} entraron a "${cuentaEtiqueta}" como reembolso de ${deuda.banco} — ${deuda.producto || 'compra'}.\n\nLas mensualidades restantes del banco seguirán cobrándose normal. ¿Continuar?`)) return;

    if (typeof window._ingresarCuenta !== 'function') {
        alert("No se pudo registrar: el módulo de caja no está disponible.");
        return;
    }
    const idOperacion = `MSI-${id}-REEMBOLSO-${Date.now()}`;
    const ok = window._ingresarCuenta({
        monto,
        cuentaId,
        etiqueta: cuentaEtiqueta,
        concepto: `Reembolso de proveedor — compra MSI no entregada: ${deuda.banco}: ${deuda.producto || 'Compra'}`,
        referencia: `MSI-${id}`,
        idOperacion
    });
    if (!ok) {
        alert(`No se pudo registrar el ingreso a "${cuentaEtiqueta}" (¿ya no existe esa cuenta?). Nada se guardó.`);
        return;
    }

    // Cancelar la(s) recepción(es) pendientes ligadas a esta compra, si las
    // hay — si no lo hacemos, el producto que nunca llegó se queda para
    // siempre en el panel "Recepciones Pendientes" esperando algo que ya no
    // va a llegar (y alguien podría terminar "recibiéndolo" por error,
    // metiendo stock fantasma que en realidad no existe).
    // Prioridad: recepcionId (vínculo explícito elegido al registrar la
    // deuda MSI) → compraId (compras hechas directo por compras.js, si algún
    // día se generan cuentasMSI desde ahí). La mayoría de deudas MSI vienen
    // de la migración manual en cxc.js y no tienen ninguno de los dos —
    // en ese caso no hay nada que cancelar automáticamente.
    let recepcionesCanceladas = [];
    const recepciones = StorageService.get("recepciones", []);
    if (deuda.recepcionId) {
        const r = recepciones.find(x => String(x.id) === String(deuda.recepcionId) && x.estatus === "Pendiente");
        if (r) {
            recepcionesCanceladas.push({ id: r.id, cantidadPendienteOriginal: r.cantidadPendiente, estatusOriginal: r.estatus });
            r.estatus = "Cancelada";
            r.motivoCancelacion = "Reembolso de proveedor — producto nunca entregado";
            r.fechaCancelacion = fecha;
            r.cantidadPendiente = 0;
        }
    } else if (deuda.compraId) {
        recepciones.forEach(r => {
            if (String(r.compraId) === String(deuda.compraId) && r.estatus === "Pendiente") {
                recepcionesCanceladas.push({ id: r.id, cantidadPendienteOriginal: r.cantidadPendiente, estatusOriginal: r.estatus });
                r.estatus = "Cancelada";
                r.motivoCancelacion = "Reembolso de proveedor — producto nunca entregado";
                r.fechaCancelacion = fecha;
                r.cantidadPendiente = 0;
            }
        });
    }
    if (recepcionesCanceladas.length > 0) {
        StorageService.set("recepciones", recepciones);
    }

    cuentasMSI[idx] = {
        ...deuda,
        reembolsoProveedor: { activo: true, monto, fecha, cuentaId, cuentaEtiqueta, idOperacion, recepcionesCanceladas }
    };
    StorageService.set("cuentasMSI", cuentasMSI);

    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'MSI_REEMBOLSO_PROVEEDOR',
            modulo: 'Bancos',
            entidad: 'cuentaMSI',
            entidadId: String(id),
            detalle: `Reembolso de proveedor registrado: ${dinero(monto)} a "${cuentaEtiqueta}" por compra MSI no entregada (${deuda.banco} — ${deuda.producto || 'Compra'}). Las mensualidades del banco siguen su curso.${recepcionesCanceladas.length ? ` Se canceló la recepción pendiente ligada a esta compra (${recepcionesCanceladas.length} registro/s), sin agregar stock.` : ''}`,
            monto,
            severidad: 'alerta',
            datos: { cuentaMSI: deuda, reembolso: { monto, fecha, cuentaId, cuentaEtiqueta }, recepcionesCanceladas }
        });
    }

    document.querySelector('[data-modal="reembolso-msi"]')?.remove();
    alert(`✅ Reembolso registrado. Las mensualidades restantes se seguirán pagando normal.${recepcionesCanceladas.length ? '\n\nTambién se canceló la recepción pendiente de este producto — ya no aparecerá en "Recepciones Pendientes".' : ''}`);
    renderCuentasMSI();
    if (typeof window.renderDashboardMSI === 'function') window.renderDashboardMSI();
    if (typeof window.renderRecepciones === 'function') window.renderRecepciones();
    if (document.querySelector('[data-modal="historial-msi"]')) abrirHistorialMSI(id);
};

window.deshacerReembolsoProveedorMSI = function(id) {
    const cuentasMSI = StorageService.get("cuentasMSI", []);
    const idx = cuentasMSI.findIndex(c => c.id === id);
    if (idx === -1) return;
    const deuda = cuentasMSI[idx];
    const r = deuda.reembolsoProveedor;
    if (!r?.activo) return;

    if (!confirm(`¿Deshacer la marca de reembolso de proveedor?\n\nSe sacará de nuevo ${dinero(r.monto)} de "${r.cuentaEtiqueta}" (reversión del ingreso registrado).`)) return;

    if (typeof window._egresarCuenta !== 'function') {
        alert("No se pudo deshacer: el módulo de caja no está disponible.");
        return;
    }
    const ok = window._egresarCuenta({
        monto: r.monto,
        cuentaId: r.cuentaId,
        etiqueta: r.cuentaEtiqueta,
        concepto: `Reversión de reembolso de proveedor — MSI: ${deuda.banco}: ${deuda.producto || 'Compra'}`,
        referencia: `MSI-${id}`,
        idOperacion: `${r.idOperacion}-REV`
    });
    if (!ok) {
        alert(`No se pudo revertir el ingreso en "${r.cuentaEtiqueta}" (¿ya no existe esa cuenta?). La marca de reembolso NO se quitó.`);
        return;
    }

    // Restaurar las recepciones que se habían cancelado al marcar el
    // reembolso, para que la mercancía vuelva a aparecer como pendiente de
    // recibir (por si el deshacer fue porque en realidad sí va a llegar).
    if (Array.isArray(r.recepcionesCanceladas) && r.recepcionesCanceladas.length > 0) {
        const recepciones = StorageService.get("recepciones", []);
        r.recepcionesCanceladas.forEach(rc => {
            const rec = recepciones.find(x => x.id === rc.id);
            if (rec && rec.estatus === "Cancelada") {
                rec.estatus = rc.estatusOriginal || "Pendiente";
                rec.cantidadPendiente = rc.cantidadPendienteOriginal;
                delete rec.motivoCancelacion;
                delete rec.fechaCancelacion;
            }
        });
        StorageService.set("recepciones", recepciones);
    }

    const reembolsoAnterior = { ...r };
    cuentasMSI[idx] = { ...deuda, reembolsoProveedor: { activo: false } };
    StorageService.set("cuentasMSI", cuentasMSI);

    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'MSI_REEMBOLSO_PROVEEDOR_DESHECHO',
            modulo: 'Bancos',
            entidad: 'cuentaMSI',
            entidadId: String(id),
            detalle: `Marca de reembolso de proveedor deshecha para ${deuda.banco} — ${deuda.producto || 'Compra'}. Se revirtió el ingreso de ${dinero(reembolsoAnterior.monto)} en "${reembolsoAnterior.cuentaEtiqueta}".${reembolsoAnterior.recepcionesCanceladas?.length ? ' Se restauró la recepción pendiente ligada a esta compra.' : ''}`,
            monto: reembolsoAnterior.monto,
            severidad: 'alerta',
            datos: { reembolsoDeshecho: reembolsoAnterior }
        });
    }

    renderCuentasMSI();
    if (typeof window.renderDashboardMSI === 'function') window.renderDashboardMSI();
    if (typeof window.renderRecepciones === 'function') window.renderRecepciones();
    if (document.querySelector('[data-modal="historial-msi"]')) abrirHistorialMSI(id);
};

// ===== SEGUIMIENTO DE COMPRAS MSI — lista dinámica con filtros y análisis =====
// El detalle (calendario de cuotas, pagos, reembolso) YA NO va inline aquí;
// vive en abrirHistorialMSI(), que se abre al seleccionar un producto de la
// lista. Esta vista es solo el resumen: qué se debe, a quién, y qué tan
// cubierto está cada uno — para poder escanearlo de un vistazo.
window._msiSeguimientoFiltros = window._msiSeguimientoFiltros || { banco: 'Todos', estado: 'Todos', busqueda: '', orden: 'saldoDesc' };

window._msiSeguimientoSetFiltro = function(campo, valor) {
    window._msiSeguimientoFiltros[campo] = valor;
    renderCuentasMSI();
};

function _msiCalcularResumen(c) {
    const totalDeuda = parseFloat(String(c.total || 0).replace(/[$,]/g, '')) || 0;
    const cuota = parseFloat(String(c.cuotaMensual || 0).replace(/[$,]/g, '')) || 0;
    const yaPagado = c.montoPagado !== undefined ? c.montoPagado : ((c.pagosRealizados || 0) * cuota);
    const saldo = Math.max(0, totalDeuda - yaPagado);
    const porcentaje = totalDeuda > 0 ? Math.min(100, (yaPagado / totalDeuda) * 100) : 0;
    const estaTerminado = yaPagado >= totalDeuda - 0.5;
    const reembolsada = !!c.reembolsoProveedor?.activo;
    const estado = reembolsada ? 'Reembolsada' : (estaTerminado ? 'Liquidada' : 'Activa');
    return { totalDeuda, cuota, yaPagado, saldo, porcentaje, estaTerminado, reembolsada, estado };
}

function renderCuentasMSI() {
    const contenedor = document.getElementById("listaCuentasMSI");
    if (!contenedor) return;

    const cuentasMSI = StorageService.get("cuentasMSI", []);
    if (cuentasMSI.length === 0) {
        contenedor.innerHTML = "<p style='text-align:center; color:#999; padding:20px;'>No hay compras a meses activas.</p>";
        return;
    }

    const F = window._msiSeguimientoFiltros;
    const enriquecidas = cuentasMSI.map(c => ({ c, r: _msiCalcularResumen(c) }));

    // ── Análisis global (sobre TODO, sin filtrar, para tener siempre el
    // panorama completo aunque estés viendo un subconjunto abajo) ──────────
    const totalMSI = enriquecidas.reduce((s, x) => s + x.r.totalDeuda, 0);
    const totalPagado = enriquecidas.reduce((s, x) => s + x.r.yaPagado, 0);
    const totalSaldo = enriquecidas.reduce((s, x) => s + x.r.saldo, 0);
    const coberturaProm = enriquecidas.length ? (enriquecidas.reduce((s, x) => s + x.r.porcentaje, 0) / enriquecidas.length) : 0;
    const nActivas = enriquecidas.filter(x => x.r.estado === 'Activa').length;
    const nLiquidadas = enriquecidas.filter(x => x.r.estado === 'Liquidada').length;
    const nReembolsadas = enriquecidas.filter(x => x.r.estado === 'Reembolsada').length;

    const bancosDisponibles = [...new Set(cuentasMSI.map(c => c.banco).filter(Boolean))].sort();

    // ── Filtrar ──────────────────────────────────────────────────────────
    let filtradas = enriquecidas.filter(({ c, r }) => {
        if (F.banco !== 'Todos' && c.banco !== F.banco) return false;
        if (F.estado !== 'Todos' && r.estado !== F.estado) return false;
        if (F.busqueda && !(String(c.producto || '').toLowerCase().includes(F.busqueda.toLowerCase()))) return false;
        return true;
    });

    // ── Ordenar ──────────────────────────────────────────────────────────
    const ordenadores = {
        saldoDesc: (a, b) => b.r.saldo - a.r.saldo,
        pctAsc: (a, b) => a.r.porcentaje - b.r.porcentaje,
        pctDesc: (a, b) => b.r.porcentaje - a.r.porcentaje,
        reciente: (a, b) => new Date(b.c.fechaCompra || 0) - new Date(a.c.fechaCompra || 0)
    };
    filtradas.sort(ordenadores[F.orden] || ordenadores.saldoDesc);

    // ── Barra de filtros ─────────────────────────────────────────────────
    const opcionesBanco = ['Todos', ...bancosDisponibles].map(b =>
        `<option value="${b}" ${F.banco === b ? 'selected' : ''}>${b}</option>`).join('');
    const opcionesEstado = ['Todos', 'Activa', 'Liquidada', 'Reembolsada'].map(e =>
        `<option value="${e}" ${F.estado === e ? 'selected' : ''}>${e === 'Todos' ? 'Todos los estados' : e}</option>`).join('');
    const opcionesOrden = [
        ['saldoDesc', 'Mayor saldo pendiente'],
        ['pctAsc', 'Menor % cubierto'],
        ['pctDesc', 'Mayor % cubierto'],
        ['reciente', 'Más reciente']
    ].map(([v, t]) => `<option value="${v}" ${F.orden === v ? 'selected' : ''}>${t}</option>`).join('');

    let html = `
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px,1fr)); gap:10px; margin-bottom:18px;">
        <div style="background:white; border:1px solid #e2e8f0; border-radius:10px; padding:12px;">
            <div style="font-size:11px; color:#6b7280; text-transform:uppercase; font-weight:bold;">Total en MSI</div>
            <div style="font-size:17px; font-weight:900; color:#1e40af;">${dinero(totalMSI)}</div>
        </div>
        <div style="background:white; border:1px solid #e2e8f0; border-radius:10px; padding:12px;">
            <div style="font-size:11px; color:#6b7280; text-transform:uppercase; font-weight:bold;">Ya pagado</div>
            <div style="font-size:17px; font-weight:900; color:#16a34a;">${dinero(totalPagado)}</div>
        </div>
        <div style="background:white; border:1px solid #e2e8f0; border-radius:10px; padding:12px;">
            <div style="font-size:11px; color:#6b7280; text-transform:uppercase; font-weight:bold;">Saldo pendiente</div>
            <div style="font-size:17px; font-weight:900; color:#dc2626;">${dinero(totalSaldo)}</div>
        </div>
        <div style="background:white; border:1px solid #e2e8f0; border-radius:10px; padding:12px;">
            <div style="font-size:11px; color:#6b7280; text-transform:uppercase; font-weight:bold;">Cobertura promedio</div>
            <div style="font-size:17px; font-weight:900; color:#7c3aed;">${coberturaProm.toFixed(0)}%</div>
        </div>
        <div style="background:white; border:1px solid #e2e8f0; border-radius:10px; padding:12px;">
            <div style="font-size:11px; color:#6b7280; text-transform:uppercase; font-weight:bold;">Activas / Liquidadas / Reemb.</div>
            <div style="font-size:15px; font-weight:900; color:#334155;">${nActivas} / ${nLiquidadas} / ${nReembolsadas}</div>
        </div>
    </div>

    <div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:16px; background:white; border:1px solid #e2e8f0; border-radius:10px; padding:12px;">
        <div style="flex:1; min-width:160px;">
            <label style="font-size:11px; font-weight:bold; color:#6b7280; display:block; margin-bottom:3px;">BUSCAR PRODUCTO</label>
            <input type="text" value="${F.busqueda}" oninput="window._msiSeguimientoSetFiltro('busqueda', this.value)" placeholder="Nombre del producto..." style="width:100%; padding:8px; border:1px solid #d1d5db; border-radius:6px; font-size:13px;">
        </div>
        <div style="min-width:140px;">
            <label style="font-size:11px; font-weight:bold; color:#6b7280; display:block; margin-bottom:3px;">BANCO</label>
            <select onchange="window._msiSeguimientoSetFiltro('banco', this.value)" style="width:100%; padding:8px; border:1px solid #d1d5db; border-radius:6px; font-size:13px;">${opcionesBanco}</select>
        </div>
        <div style="min-width:150px;">
            <label style="font-size:11px; font-weight:bold; color:#6b7280; display:block; margin-bottom:3px;">ESTADO</label>
            <select onchange="window._msiSeguimientoSetFiltro('estado', this.value)" style="width:100%; padding:8px; border:1px solid #d1d5db; border-radius:6px; font-size:13px;">${opcionesEstado}</select>
        </div>
        <div style="min-width:170px;">
            <label style="font-size:11px; font-weight:bold; color:#6b7280; display:block; margin-bottom:3px;">ORDENAR POR</label>
            <select onchange="window._msiSeguimientoSetFiltro('orden', this.value)" style="width:100%; padding:8px; border:1px solid #d1d5db; border-radius:6px; font-size:13px;">${opcionesOrden}</select>
        </div>
    </div>`;

    if (filtradas.length === 0) {
        html += `<p style="text-align:center; color:#999; padding:30px;">Ningún producto coincide con estos filtros.</p>`;
        contenedor.innerHTML = html;
        return;
    }

    html += `<div style="font-size:12px; color:#6b7280; margin-bottom:8px;">${filtradas.length} de ${cuentasMSI.length} compra${cuentasMSI.length === 1 ? '' : 's'}</div>`;

    html += filtradas.map(({ c, r }) => {
        const colorBarra = r.estado === 'Liquidada' ? '#16a34a' : (r.estado === 'Reembolsada' ? '#7c3aed' : '#3498db');
        const badgeEstado = r.estado === 'Liquidada'
            ? '<span style="background:#d1fae5; color:#065f46; font-size:11px; padding:2px 8px; border-radius:9999px; font-weight:bold;">✅ Liquidada</span>'
            : r.estado === 'Reembolsada'
                ? '<span style="background:#ede9fe; color:#6b21a8; font-size:11px; padding:2px 8px; border-radius:9999px; font-weight:bold;">🔄 Reembolsada</span>'
                : '<span style="background:#dbeafe; color:#1e40af; font-size:11px; padding:2px 8px; border-radius:9999px; font-weight:bold;">⏳ Activa</span>';

        return `
        <div onclick="abrirHistorialMSI(${c.id})" style="cursor:pointer; background:white; border:1px solid #e2e8f0; border-radius:10px; padding:14px 16px; margin-bottom:10px; display:flex; align-items:center; gap:14px; transition:box-shadow 0.15s;" onmouseover="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.08)'" onmouseout="this.style.boxShadow='none'">
            <div style="flex:2; min-width:140px;">
                <div style="font-weight:bold; color:#0f172a; font-size:14px;">${c.producto || 'Compra'}</div>
                <div style="font-size:12px; color:#6b7280;">🏦 ${c.banco} · ${c.fechaCompra ? window.formatearFechaCortaMX(c.fechaCompra) : '—'}</div>
            </div>
            <div style="flex:2; min-width:160px;">
                <div style="display:flex; justify-content:space-between; font-size:11px; color:#6b7280; margin-bottom:3px;">
                    <span>${dinero(r.yaPagado)} de ${dinero(r.totalDeuda)}</span>
                    <span style="font-weight:bold;">${r.porcentaje.toFixed(0)}%</span>
                </div>
                <div style="background:#e2e8f0; border-radius:4px; height:7px; width:100%;">
                    <div style="background:${colorBarra}; height:100%; border-radius:4px; width:${r.porcentaje}%;"></div>
                </div>
            </div>
            <div style="flex:1; min-width:100px; text-align:right;">
                <div style="font-size:11px; color:#6b7280;">Saldo</div>
                <div style="font-weight:bold; color:${r.saldo > 0 ? '#dc2626' : '#16a34a'};">${dinero(r.saldo)}</div>
            </div>
            <div style="min-width:110px; text-align:right;">${badgeEstado}</div>
        </div>`;
    }).join('');

    contenedor.innerHTML = html;
}

// ── Marcar la siguiente cuota como pagada ─────────────────────────────────────
// 🛡️ REPARACIÓN: esta función registraba el egreso contra el NOMBRE de la
// tarjeta de crédito (deuda.banco) como si fuera una cuenta real, sin pedir
// nunca de qué cuenta de efectivo/débito salía el dinero. Ese egreso fantasma
// no descontaba ningún saldo real, pero sí se sumaba en los totales globales
// de dashboard.js (que suma TODOS los movimientosCaja sin distinguir cuenta).
// Ahora se pide la cuenta de origen y se usa _egresarCuenta para que sí se
// descuente de verdad — igual que procesarPagoTarjetaGlobal (pago de corte
// mensual, más abajo), que tenía el defecto opuesto (silencioso: escribía el
// movimiento igual aunque la cuenta no existiera) y ya también está reparado.
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

    document.querySelector('[data-modal="pago-individual-msi"]')?.remove();
    const cajas = StorageService.get("cuentasEfectivo", [{ id: "efectivo", nombre: "💵 Efectivo Principal", saldo: 0 }]);
    const tarjetasConfig = StorageService.get("tarjetasConfig", []);
    let opcionesCuenta = '';
    cajas.forEach(c => opcionesCuenta += `<option value="${c.id}">${c.nombre}</option>`);
    tarjetasConfig.filter(t => t.tipo === "debito").forEach(t => opcionesCuenta += `<option value="${t.banco}">🏦 ${t.banco} Débito</option>`);

    const modalHTML = `
    <div data-modal="pago-individual-msi" style="position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:7000; display:flex; justify-content:center; align-items:center;">
        <div style="background:white; padding:30px; border-radius:12px; width:90%; max-width:420px;">
            <h2 style="margin-top:0; color:#1e40af;">💰 Pago Individual — Cuota ${numeroCuota}</h2>
            <p style="color:#4b5563; font-size:13px; margin-top:-10px;">${deuda.banco} · ${deuda.producto || 'Compra'} · ${dinero(deuda.cuotaMensual)}</p>
            <div style="margin-bottom:18px;">
                <label style="font-weight:bold; font-size:12px; color:#475569;">¿De dónde sale el dinero?</label>
                <select id="cuentaOrigenPagoIndividualMSI" style="width:100%; padding:10px; margin-top:5px; border:1px solid #d1d5db; border-radius:6px;">${opcionesCuenta}</select>
            </div>
            <div style="display:flex; gap:10px;">
                <button onclick="confirmarPagoIndividualMSI(${id}, ${numeroCuota})" style="flex:1; padding:12px; background:#16a34a; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">✅ Confirmar Pago</button>
                <button onclick="document.querySelector('[data-modal=&quot;pago-individual-msi&quot;]').remove()" style="flex:1; padding:12px; background:#e5e7eb; border:none; border-radius:6px; cursor:pointer;">✕ Cancelar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

window.confirmarPagoIndividualMSI = function(id, numeroCuota) {
    const sel = document.getElementById("cuentaOrigenPagoIndividualMSI");
    const cuentaId = sel?.value;
    const cuentaEtiqueta = sel?.options[sel.selectedIndex]?.text || cuentaId;
    if (!cuentaId) return alert("❌ Selecciona una cuenta de origen.");

    const cuentasMSI = StorageService.get("cuentasMSI", []);
    const idx = cuentasMSI.findIndex(c => c.id === id);
    if (idx === -1) return;
    const deuda = cuentasMSI[idx];
    const pagosActuales = deuda.pagosRealizados || 0;
    if (numeroCuota !== pagosActuales + 1) {
        document.querySelector('[data-modal="pago-individual-msi"]')?.remove();
        return alert(`⚠️ Solo puedes marcar la cuota ${pagosActuales + 1} como pagada.`);
    }

    const formatoDinero = (val) => '$' + Number(val).toLocaleString('en-US', {minimumFractionDigits: 2});
    const msjConf = `⚠️ RESUMEN DE OPERACIÓN - ¿PAGAR CUOTA MSI?\n\nBanco: ${deuda.banco}\nCompra: ${deuda.producto || 'Compra'}\nCuota: ${numeroCuota} de ${deuda.meses}\nMonto a descontar: ${formatoDinero(deuda.cuotaMensual)}\nOrigen del dinero: ${cuentaEtiqueta}\n\n¿Deseas continuar con el registro?`;
    if (!confirm(msjConf)) return;

    if (typeof window._egresarCuenta !== 'function') return alert("❌ No se pudo registrar el pago: funciones de cuenta no disponibles.");

    const refPago = `MSI-${deuda.compraId || id}-C${numeroCuota}`;
    const egresoOk = window._egresarCuenta({
        monto: deuda.cuotaMensual,
        cuentaId,
        etiqueta: cuentaEtiqueta,
        concepto: `Pago MSI — ${deuda.banco}: ${deuda.producto || 'Compra'} (cuota ${numeroCuota}/${deuda.meses})`,
        referencia: refPago,
        idOperacion: refPago
    }) !== false;
    if (!egresoOk) return alert(`❌ No se pudo descontar de [${cuentaEtiqueta}]. Verifica que la cuenta exista.`);

    // Restaurar la etiqueta medioPago='tarjeta_msi' (distinta de 'efectivo'/
    // 'transferencia' que asigna _egresarCuenta según el tipo de cuenta) para
    // que este pago siga siendo identificable como cuota MSI en reportes.
    const movimientos = StorageService.get("movimientosCaja", []);
    movimientos.forEach(m => { if (m.idOperacion === refPago) m.medioPago = "tarjeta_msi"; });
    StorageService.set("movimientosCaja", movimientos);

    deuda.pagosRealizados = pagosActuales + 1;
    // 🛡️ Guardamos el idOperacion del movimiento en el propio calendario para
    // que deshacerPagoMSI pueda revertirlo con precisión (antes no quedaba
    // ningún rastro y el egreso fantasma se quedaba para siempre).
    if (Array.isArray(deuda.calendario) && deuda.calendario[numeroCuota - 1]) {
        deuda.calendario[numeroCuota - 1].estado = 'Pagado';
        deuda.calendario[numeroCuota - 1].montoAbonado = deuda.cuotaMensual;
        deuda.calendario[numeroCuota - 1].movRef = refPago;
    }
    cuentasMSI[idx] = deuda;
    StorageService.set("cuentasMSI", cuentasMSI);

    document.querySelector('[data-modal="pago-individual-msi"]')?.remove();
    alert(`✅ Cuota ${numeroCuota} de ${deuda.meses} marcada como pagada.\nRestantes: ${deuda.meses - deuda.pagosRealizados}`);
    renderCuentasMSI();
    renderDashboardMSI();
    if (typeof renderCuentasBancarias === 'function') renderCuentasBancarias();
    if (document.querySelector('[data-modal="historial-msi"]')) abrirHistorialMSI(id);
};

// ── Deshacer el último pago marcado ──────────────────────────────────────────
// 🛡️ REPARACIÓN: antes esto solo restaba el contador de cuotas y dejaba el
// egreso original (si lo hubo) como movimiento fantasma permanente en
// movimientosCaja — deshacer nunca revertía el dinero. Ahora, si el pago que
// se deshace tiene un movRef (pagos hechos con la versión corregida de
// marcarPagoMSI), se reingresa el dinero a la cuenta de origen real.
function deshacerPagoMSI(id) {
    const cuentasMSI = StorageService.get("cuentasMSI", []);
    const idx = cuentasMSI.findIndex(c => c.id === id);
    if (idx === -1) return;

    const deuda = cuentasMSI[idx];
    if ((deuda.pagosRealizados || 0) === 0) { alert('No hay pagos que deshacer.'); return; }

    const numeroCuota = deuda.pagosRealizados;
    const pagoRef = Array.isArray(deuda.calendario) ? deuda.calendario[numeroCuota - 1] : null;

    if (!confirm('¿Deshacer el último pago marcado? Esto revertirá el contador de cuotas y, si el pago tiene una cuenta de origen registrada, regresará el dinero a esa cuenta.')) return;

    if (pagoRef?.movRef && typeof window._ingresarCuenta === 'function') {
        const movimientos = StorageService.get("movimientosCaja", []);
        const movOriginal = movimientos.find(m => m.idOperacion === pagoRef.movRef);
        if (movOriginal) {
            window._ingresarCuenta({
                monto: movOriginal.monto,
                cuentaId: movOriginal.cuenta,
                etiqueta: movOriginal.etiquetaCuenta,
                concepto: `Reversión pago MSI — ${deuda.banco}: ${deuda.producto || 'Compra'} (cuota ${numeroCuota}/${deuda.meses})`,
                referencia: pagoRef.movRef,
                idOperacion: `${pagoRef.movRef}-REV`
            });
        }
        pagoRef.movRef = null;
    } else if (pagoRef?.estado === 'Pagado') {
        alert('⚠️ Este pago se había registrado con una versión anterior de la función y no tiene cuenta de origen asociada: el contador se revierte, pero no hay un movimiento de caja que deshacer automáticamente. Revisa manualmente en Mis Cuentas si hace falta un ajuste.');
    }

    if (pagoRef) {
        pagoRef.estado = 'Pendiente';
        delete pagoRef.montoAbonado;
    }

    const cuota = parseFloat(String(deuda.cuotaMensual || 0).replace(/[$,]/g, ''));
    if (deuda.montoPagado !== undefined) deuda.montoPagado = Math.max(0, deuda.montoPagado - cuota);
    deuda.pagosRealizados = deuda.pagosRealizados - 1;
    cuentasMSI[idx] = deuda;
    StorageService.set("cuentasMSI", cuentasMSI);

    alert('↩ Último pago deshecho.');
    renderCuentasMSI();
    renderDashboardMSI();
    if (typeof renderCuentasBancarias === 'function') renderCuentasBancarias();
    if (document.querySelector('[data-modal="historial-msi"]')) abrirHistorialMSI(id);
}

// ===== CUENTAS BANCARIAS DASHBOARD (LIQUIDEZ) =====

// Variables globales para los filtros de liquidez
window._filtroCuentaLiquidez = window._filtroCuentaLiquidez || 'Todos';
window._filtroLiquidezDesde = window._filtroLiquidezDesde || '';
window._filtroLiquidezHasta = window._filtroLiquidezHasta || '';
window._filtroPeriodoLiquidez = window._filtroPeriodoLiquidez || 'total'; // Guarda el combo seleccionado

window.aplicarFiltroPeriodoLiquidez = function(periodo) {
    window._filtroPeriodoLiquidez = periodo;
    if (periodo === 'manual') return;

    const d = new Date();
    const fmt = (dateObj) => {
        return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    };

    if (periodo === 'dia') {
        const hoyStr = fmt(d);
        window._filtroLiquidezDesde = hoyStr;
        window._filtroLiquidezHasta = hoyStr;
    } else if (periodo === 'semana') {
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // El Lunes es 1, si es domingo (0) retrocede 6 días
        const lunes = new Date(d.getFullYear(), d.getMonth(), diff);
        const domingo = new Date(d.getFullYear(), d.getMonth(), diff + 6);
        window._filtroLiquidezDesde = fmt(lunes);
        window._filtroLiquidezHasta = fmt(domingo);
    } else if (periodo === 'mes') {
        const primerDia = new Date(d.getFullYear(), d.getMonth(), 1); // Día 1
        const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0); // Último día del mes
        window._filtroLiquidezDesde = fmt(primerDia);
        window._filtroLiquidezHasta = fmt(ultimoDia);
    } else if (periodo === 'ano') {
        const primerDia = new Date(d.getFullYear(), 0, 1);
        const ultimoDia = new Date(d.getFullYear(), 11, 31);
        window._filtroLiquidezDesde = fmt(primerDia);
        window._filtroLiquidezHasta = fmt(ultimoDia);
    } else { // 'total'
        window._filtroLiquidezDesde = '';
        window._filtroLiquidezHasta = '';
    }
    renderCuentasBancarias();
};

// 🔒 REGLA DE ORO: un movimiento SOLO puede pertenecer a UNA caja/cuenta, y esa
// pertenencia se decide EXCLUSIVAMENTE con window.movimientoPerteneceACuenta
// (misma función que usa Corte de Caja y Estado de Cuenta Bancario). Antes esta
// función tenía su propia lógica de prioridad de campos, distinta a la de
// corte-caja.js, y eso hacía que el mismo movimiento se contara aquí bajo una
// caja y en Corte de Caja bajo otra (o en ninguna). Nunca vuelvas a comparar
// mov.cuenta/mov.cuentaId a mano: usa la función compartida.
function _bancosAliasesCaja(c, index) {
    return [c.id, c.nombre, index === 0 ? 'efectivo' : '', index === 0 ? 'caja' : ''].filter(Boolean);
}

function _bancosAliasesDebito(t) {
    return [t.banco, t.id, t.nombre].filter(Boolean);
}

function _bancosCalcularSaldosDesdeMovimientos() {
    const tarjetas = StorageService.get("tarjetasConfig", []);
    const movimientos = StorageService.get("movimientosCaja", []);
    const cajas = StorageService.get("cuentasEfectivo", [{ id: "efectivo", nombre: "Efectivo Principal", saldo: 0 }]);
    const cuentasDebito = tarjetas.filter(t => t.tipo === "debito");

    const cajasConAliases = cajas.map((c, index) => ({ id: c.id, aliases: _bancosAliasesCaja(c, index) }));
    const debitoConAliases = cuentasDebito.map(t => ({ id: t.banco, aliases: _bancosAliasesDebito(t) }));

    const saldosCajas = {};
    cajas.forEach(c => saldosCajas[c.id] = 0);

    const saldosDebito = {};
    cuentasDebito.forEach(t => saldosDebito[t.banco] = parseFloat(t.saldoInicial) || 0);

    movimientos.forEach(m => {
        const esIngreso = String(m.tipo || '').toLowerCase() === "ingreso";
        const monto = parseFloat(m.monto) || 0;
        const signo = esIngreso ? monto : -monto;

        // Se prueba primero contra las cajas de efectivo y luego contra los bancos
        // débito, usando TODOS los candidatos de identidad del movimiento (no solo
        // el primero que traiga valor), para que nunca quede huérfano ni se cuele
        // en la cuenta equivocada por una etiqueta decorada que no calza textual.
        const cajaMatch = cajasConAliases.find(c => window.movimientoPerteneceACuenta(m, c.aliases));
        if (cajaMatch) {
            saldosCajas[cajaMatch.id] += signo;
            return;
        }
        const bancoMatch = debitoConAliases.find(t => window.movimientoPerteneceACuenta(m, t.aliases));
        if (bancoMatch) {
            saldosDebito[bancoMatch.id] += signo;
        }
        // Si no matchea ninguna, el movimiento no trae identidad de cuenta reconocible:
        // se deja fuera de ambos totales en vez de forzarlo a la caja principal por
        // adivinanza. Se puede detectar y reasignar desde Corte de Caja > pestaña "Todas".
    });

    return { saldosCajas, saldosDebito, cajas, cuentasDebito };
}

function recalcularSaldosGuardadosDesdeMovimientos() {
    const { saldosCajas, saldosDebito } = _bancosCalcularSaldosDesdeMovimientos();
    const cajas = StorageService.get("cuentasEfectivo", [{ id: "efectivo", nombre: "Efectivo Principal", saldo: 0 }]);
    const bancos = StorageService.get("cuentas-bancarias", []);

    cajas.forEach(c => {
        if (saldosCajas[c.id] !== undefined) c.saldo = saldosCajas[c.id];
    });
    bancos.forEach(c => {
        const key = c.banco || c.id;
        if (saldosDebito[key] !== undefined) c.saldo = saldosDebito[key];
    });

    StorageService.set("cuentasEfectivo", cajas);
    StorageService.set("cuentas-bancarias", bancos);
    alert("Saldos guardados recalculados desde movimientosCaja.");
    renderCuentasBancarias();
}

function _bancosFechaKeyMovimiento(fecha) {
    if (window.fechaClaveMX) return window.fechaClaveMX(fecha, '');
    if (!fecha) return '';
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return String(fecha).slice(0, 10);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Helpers compartidos para reconocer y aparear las dos patas de una
// transferencia interna, incluyendo las viejas (de antes de que existiera
// tipoMovimiento==='transferencia_interna') identificadas por el texto del
// concepto.
function _esLegTransferencia(m) {
    return m.tipoMovimiento === 'transferencia_interna' ||
        (typeof m.concepto === 'string' && (m.concepto.startsWith('Transferencia a:') || m.concepto.startsWith('Transferencia de:')));
}
function _claveTransferencia(m) {
    return m.idOperacion || m.referencia;
}

function _bancosAgruparTransferenciasConciliacion(lista) {
    const grupos = {};
    const sueltos = [];

    // 🔗 Agrupar las transferencias internas (Transferir entre Cuentas): cada
    // una crea dos movimientos (egreso en origen + ingreso en destino) que
    // comparten idOperacion (o, en transferencias viejas de antes de la
    // reparación de esta función, "referencia"). Sin agrupar se ven como dos
    // filas sueltas sin forma clara de corregirlas juntas; agrupadas se
    // muestran en una sola fila con botón de editar.
    const gruposTransfInterna = {};
    const restoLista = [];
    lista.forEach(m => {
        const clave = _claveTransferencia(m);
        if (_esLegTransferencia(m) && clave) {
            if (!gruposTransfInterna[clave]) gruposTransfInterna[clave] = [];
            gruposTransfInterna[clave].push(m);
        } else {
            restoLista.push(m);
        }
    });
    const transferenciasInternasAgrupadas = Object.entries(gruposTransfInterna).map(([idOp, items]) => {
        const egreso = items.find(x => String(x.tipo || '').toLowerCase() === 'egreso') || items[0];
        const ingreso = items.find(x => String(x.tipo || '').toLowerCase() === 'ingreso') || items[0];
        // Si el registro viejo no trae cuentaOrigenNombre/cuentaDestinoNombre
        // (solo lo escribe la versión reparada), lo sacamos de la etiqueta
        // de cada pata como respaldo.
        const nombreOrigen = ingreso.cuentaOrigenNombre || egreso.etiquetaCuenta || egreso.cuenta;
        const nombreDestino = ingreso.cuentaDestinoNombre || ingreso.etiquetaCuenta || ingreso.cuenta;
        return {
            ...egreso,
            id: `transf-${idOp}`,
            idOperacionTransferencia: idOp,
            esTransferenciaInterna: true,
            concepto: `🔁 Transferencia: ${nombreOrigen} → ${nombreDestino}`,
            tipo: 'transferencia',
            monto: egreso.monto,
            fecha: egreso.fecha
        };
    });
    lista = [...restoLista, ...transferenciasInternasAgrupadas];

    lista.forEach(m => {
        const grupo = String(m.grupoConciliacion || '').trim();
        const tipo = String(m.tipo || '').toLowerCase();
        if (!grupo || tipo !== 'ingreso') {
            sueltos.push(m);
            return;
        }

        const cuenta = String(m.cuenta || m.cuentaId || 'efectivo');
        const fechaKey = _bancosFechaKeyMovimiento(m.fecha || m.fechaISO || m.createdAt);
        const clave = `${cuenta}|${fechaKey}|${grupo}`;
        if (!grupos[clave]) {
            grupos[clave] = {
                ...m,
                id: `grupo-${clave}`,
                concepto: `Transferencia agrupada: ${m.referenciaBancaria || grupo}`,
                referencia: m.referenciaBancaria || grupo,
                monto: 0,
                itemsGrupo: []
            };
        }
        grupos[clave].monto += Number(m.monto || 0);
        grupos[clave].itemsGrupo.push(m);
    });

    const agrupados = Object.values(grupos).flatMap(g => {
        if (g.itemsGrupo.length < 2) return g.itemsGrupo;
        return [{ ...g, monto: Number(g.monto.toFixed(2)) }];
    });

    return [...sueltos, ...agrupados].sort((a, b) => {
        const obtenerTimestamp = (m) => {
            if (!m || !m.fecha) return 0;
            // 🛡️ parseFechaMXOrNull ya distingue ISO de "DD-MM-YYYY"/"DD/MM/YYYY"
            // y los interpreta bien (antes, el texto con guiones caía directo en
            // new Date(texto), que lo invierte a MES-DÍA-AÑO sin avisar).
            if (window.parseFechaMXOrNull) {
                const d = window.parseFechaMXOrNull(m.fecha);
                return d ? d.getTime() : 0;
            }
            if (typeof m.fecha === 'string' && m.fecha.includes('/')) {
                const partes = m.fecha.split(' ')[0].split('/');
                if (partes.length === 3) return new Date(`${partes[2]}-${partes[1].padStart(2,'0')}-${partes[0].padStart(2,'0')}`).getTime();
            }
            const d = new Date(m.fecha);
            return isNaN(d.getTime()) ? 0 : d.getTime();
        };
        // AQUÍ ESTÁ LA MAGIA: dateB menos dateA para que sea del más reciente al más antiguo
        return obtenerTimestamp(b) - obtenerTimestamp(a); 
    });
}

// ================================================================
// 🔍 DETALLE COMPLETO DE UN MOVIMIENTO (clic en cualquier fila de la
// tabla de "Movimientos" en Bancos). Muestra TODOS los campos del
// registro tal como está guardado en movimientosCaja -- no solo los
// 4 que se ven en la tabla -- más una vista JSON cruda por si hace
// falta algo que no quedó etiquetado con nombre bonito.
//
// Contempla los 3 casos que puede traer una fila de la tabla:
//   1) Movimiento suelto normal -> se muestra tal cual, campo por campo.
//   2) Transferencia interna agrupada (2 patas: egreso+ingreso) -> se
//      buscan ambas patas frescas en movimientosCaja por idOperacion
//      y se muestran una junto a la otra.
//   3) Grupo de conciliación (varios abonos con el mismo
//      grupoConciliacion, mostrados como una sola fila) -> se muestra
//      cada abono del grupo por separado, más el total.
// ================================================================
const _BANCOS_ETIQUETAS_CAMPO = {
    id: 'ID interno',
    idOperacion: 'ID de operación',
    idOperacionTransferencia: 'ID de transferencia',
    folio: 'Folio',
    fecha: 'Fecha',
    fechaISO: 'Fecha (ISO)',
    createdAt: 'Creado el',
    tipo: 'Tipo',
    tipoMovimiento: 'Tipo de movimiento',
    monto: 'Monto',
    concepto: 'Concepto',
    referencia: 'Referencia',
    referenciaBancaria: 'Referencia bancaria',
    cuenta: 'Cuenta (id)',
    cuentaId: 'Cuenta (id)',
    etiquetaCuenta: 'Cuenta',
    cuentaOrigenNombre: 'Cuenta origen',
    cuentaDestinoNombre: 'Cuenta destino',
    medioPago: 'Medio de pago',
    grupoConciliacion: 'Grupo de conciliación',
    usuario: 'Usuario',
    notas: 'Notas',
    observaciones: 'Observaciones'
};

function _bancosEtiquetaCampo(key) {
    return _BANCOS_ETIQUETAS_CAMPO[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
}

function _bancosFormatearValorCampo(key, value) {
    if (value === null || value === undefined || value === '') return '<span style="color:#cbd5e1;">—</span>';
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (Array.isArray(value) || typeof value === 'object') {
        return `<pre style="margin:4px 0 0; padding:8px; background:#f8fafc; border-radius:6px; font-size:11px; overflow:auto; max-height:160px;">${JSON.stringify(value, null, 2).replace(/</g, '&lt;')}</pre>`;
    }
    const k = key.toLowerCase();
    if (k === 'monto' || k.includes('total') || k === 'abono' || k === 'enganche' || k === 'saldo') {
        const n = Number(value);
        if (!isNaN(n) && value !== '') return dinero(n);
    }
    if ((k.includes('fecha') || k === 'createdat') && typeof value === 'string' && window.formatearFechaCortaMX) {
        const f = window.formatearFechaCortaMX(value);
        return f && f !== 'Invalid Date' ? `${f} <span style="color:#94a3b8; font-size:11px;">(${String(value).replace(/</g, '&lt;')})</span>` : String(value).replace(/</g, '&lt;');
    }
    return String(value).replace(/</g, '&lt;');
}

function _bancosRenderCamposDetalle(registro) {
    const claves = Object.keys(registro).filter(k => registro[k] !== undefined && k !== 'itemsGrupo');
    // Campos "principales" primero, en un orden fijo legible; cualquier
    // otro campo que traiga ese movimiento (venga de donde venga: venta,
    // apartado, compra, préstamo, etc.) se muestra después -- nunca se
    // queda nada fuera.
    const ordenPreferido = ['fecha', 'tipo', 'monto', 'concepto', 'etiquetaCuenta', 'cuenta', 'medioPago',
        'referencia', 'folio', 'idOperacion', 'grupoConciliacion', 'cuentaOrigenNombre', 'cuentaDestinoNombre'];
    const principales = ordenPreferido.filter(k => claves.includes(k));
    const restantes = claves.filter(k => !ordenPreferido.includes(k)).sort();

    const filas = [...principales, ...restantes].map(k => `
        <tr>
            <td style="padding:6px 10px; color:#64748b; font-weight:700; font-size:12px; white-space:nowrap; vertical-align:top;">${_bancosEtiquetaCampo(k)}</td>
            <td style="padding:6px 10px; font-size:13px; color:#0f172a; word-break:break-word;">${_bancosFormatearValorCampo(k, registro[k])}</td>
        </tr>`).join('');

    return `<table style="width:100%; border-collapse:collapse;">${filas}</table>`;
}

function abrirDetalleMovimiento(idx) {
    const m = (window._bancosMovimientosVistaActual || [])[idx];
    if (!m) return;

    document.querySelector('[data-modal="detalle-movimiento"]')?.remove();

    let cuerpoHTML = '';
    let tituloHTML = '';

    if (m.esTransferenciaInterna) {
        const movimientosCaja = StorageService.get('movimientosCaja', []);
        const patas = movimientosCaja.filter(x => _claveTransferencia(x) === m.idOperacionTransferencia && _esLegTransferencia(x));
        const egreso = patas.find(x => String(x.tipo || '').toLowerCase() === 'egreso');
        const ingreso = patas.find(x => String(x.tipo || '').toLowerCase() === 'ingreso');

        tituloHTML = `🔁 Transferencia entre cuentas`;
        cuerpoHTML = `
            <div style="margin-bottom:14px;">
                <div style="font-size:12px; font-weight:800; color:#dc2626; text-transform:uppercase; margin-bottom:6px;">⬇️ Salida (origen)</div>
                ${egreso ? _bancosRenderCamposDetalle(egreso) : '<div style="color:#94a3b8; font-size:12px;">No se encontró el registro de salida.</div>'}
            </div>
            <div>
                <div style="font-size:12px; font-weight:800; color:#16a34a; text-transform:uppercase; margin-bottom:6px;">⬆️ Entrada (destino)</div>
                ${ingreso ? _bancosRenderCamposDetalle(ingreso) : '<div style="color:#94a3b8; font-size:12px;">No se encontró el registro de entrada.</div>'}
            </div>`;
    } else if (Array.isArray(m.itemsGrupo) && m.itemsGrupo.length > 1) {
        tituloHTML = `📦 Grupo de ${m.itemsGrupo.length} movimiento(s) conciliados`;
        cuerpoHTML = `
            <div style="background:#f0fdfa; border:1px solid #99f6e4; border-radius:8px; padding:10px 12px; margin-bottom:14px; font-size:13px; color:#0f766e;">
                <strong>Total del grupo:</strong> ${dinero(m.monto)} &nbsp;|&nbsp; <strong>Referencia:</strong> ${m.referencia || '—'}
            </div>` +
            m.itemsGrupo.map((item, i) => `
                <div style="margin-bottom:14px; ${i > 0 ? 'border-top:1px dashed #e2e8f0; padding-top:14px;' : ''}">
                    <div style="font-size:12px; font-weight:800; color:#0f766e; text-transform:uppercase; margin-bottom:6px;">Movimiento ${i + 1} de ${m.itemsGrupo.length}</div>
                    ${_bancosRenderCamposDetalle(item)}
                </div>`).join('');
    } else {
        const esIngreso = m.tipo === 'ingreso' || m.tipo === 'Ingreso';
        tituloHTML = `${esIngreso ? '⬆️' : '⬇️'} Detalle del movimiento`;
        cuerpoHTML = _bancosRenderCamposDetalle(m);
    }

    const modalHTML = `
        <div data-modal="detalle-movimiento" style="position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:7000; display:flex; justify-content:center; align-items:center; padding:20px;">
            <div style="background:white; border-radius:12px; width:100%; max-width:560px; max-height:85vh; display:flex; flex-direction:column; overflow:hidden;">
                <div style="padding:18px 20px; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; color:#0f172a; font-size:16px;">${tituloHTML}</h3>
                    <button onclick="document.querySelector('[data-modal=&quot;detalle-movimiento&quot;]')?.remove()" style="background:none; border:none; font-size:20px; cursor:pointer; color:#94a3b8; line-height:1;">✕</button>
                </div>
                <div style="padding:18px 20px; overflow:auto;">
                    ${cuerpoHTML}
                    <details style="margin-top:16px;">
                        <summary style="cursor:pointer; font-size:12px; font-weight:700; color:#7c3aed;">Ver JSON crudo completo</summary>
                        <pre style="margin:8px 0 0; padding:10px; background:#0f172a; color:#e2e8f0; border-radius:8px; font-size:11px; overflow:auto; max-height:220px;">${JSON.stringify(m, null, 2).replace(/</g, '&lt;')}</pre>
                    </details>
                </div>
                <div style="padding:14px 20px; border-top:1px solid #e2e8f0; text-align:right;">
                    <button onclick="document.querySelector('[data-modal=&quot;detalle-movimiento&quot;]')?.remove()" style="padding:10px 18px; background:#f1f5f9; color:#475569; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">Cerrar</button>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function renderCuentasBancarias(cuentaSeleccionada = null) {
    if (cuentaSeleccionada !== null) { window._filtroCuentaLiquidez = cuentaSeleccionada; }
    
    const contenedor = document.getElementById("tablaCuentasBancarias");
    if (!contenedor) return;

    const tarjetas = StorageService.get("tarjetasConfig", []);
    const movimientos = StorageService.get("movimientosCaja", []);
    const cajas = StorageService.get("cuentasEfectivo", [{ id: "efectivo", nombre: "💵 Efectivo Principal", saldo: 0 }]);
    const cuentasBancariasGuardadas = StorageService.get("cuentas-bancarias", []);
    const cuentasDebito = tarjetas.filter(t => t.tipo === "debito");
    const { saldosCajas, saldosDebito } = _bancosCalcularSaldosDesdeMovimientos();

    const diferenciasSaldo = [];
    cajas.forEach(c => {
        const guardado = Number(c.saldo || 0);
        const calculado = Number(saldosCajas[c.id] || 0);
        if (Math.abs(guardado - calculado) > 0.01) {
            diferenciasSaldo.push(`${c.nombre || c.id}: guardado ${dinero(guardado)} vs movimientos ${dinero(calculado)}`);
        }
    });
    cuentasDebito.forEach(t => {
        const cuentaGuardada = cuentasBancariasGuardadas.find(c => String(c.banco || c.id) === String(t.banco));
        if (!cuentaGuardada || cuentaGuardada.saldo === undefined) return;
        const guardado = Number(cuentaGuardada.saldo || 0);
        const calculado = Number(saldosDebito[t.banco] || 0);
        if (Math.abs(guardado - calculado) > 0.01) {
            diferenciasSaldo.push(`${t.banco}: guardado ${dinero(guardado)} vs movimientos ${dinero(calculado)}`);
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

    // 🚀 ORDENAMIENTO ESTRICTO POR FECHA (MÁS RECIENTE A MÁS ANTIGUO - SEGURO)
    let movimientosFiltrados = movimientos.slice().sort((a, b) => {
        const obtenerTimestamp = (m) => {
            if (!m) return 0;
            // Intentar obtener la fecha de cualquier propiedad disponible
            const f = m.fechaISO || m.createdAt || m.fecha;
            if (!f) return 0;
            if (typeof f === 'number') return f;

            // Si el formato viene con diagonales estilo DD/MM/YYYY
            if (typeof f === 'string' && f.includes('/')) {
                const partesEspacio = f.trim().split(' ');
                const partesFecha = partesEspacio[0].split('/');
                if (partesFecha.length === 3) {
                    const [dia, mes, anio] = partesFecha;
                    // Reestructurar a formato ISO estándar (YYYY-MM-DD)
                    let isoSeguro = `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
                    if (partesEspacio[1]) isoSeguro += `T${partesEspacio[1]}`;
                    const dObj = new Date(isoSeguro);
                    if (!isNaN(dObj.getTime())) return dObj.getTime();
                }
            }

            const dObj = new Date(f);
            return isNaN(dObj.getTime()) ? 0 : dObj.getTime();
        };

        return obtenerTimestamp(b) - obtenerTimestamp(a);
    });
    
    // 1. Filtro por Cuenta
    if (window._filtroCuentaLiquidez !== 'Todos') {
        const cajaDefaultId = cajas[0]?.id || "efectivo";
        movimientosFiltrados = movimientosFiltrados.filter(m => {
            if (m.cuenta === window._filtroCuentaLiquidez) return true;
            if (window._filtroCuentaLiquidez === cajaDefaultId && (m.cuenta === 'efectivo' || m.cuenta === 'caja')) return true;
            return false;
        });
    }

    // 2. Filtro por Fechas
    if (window._filtroLiquidezDesde) {
        movimientosFiltrados = movimientosFiltrados.filter(m => m.fecha >= window._filtroLiquidezDesde + "T00:00:00");
    }
    if (window._filtroLiquidezHasta) {
        movimientosFiltrados = movimientosFiltrados.filter(m => m.fecha <= window._filtroLiquidezHasta + "T23:59:59");
    }

    const movimientosParaVista = _bancosAgruparTransferenciasConciliacion(movimientosFiltrados);
    // 🔎 Se guarda la lista tal como se está pintando para que el modal de
    // detalle (abrirDetalleMovimiento) pueda ubicar, por índice, exactamente
    // la fila en la que se dio clic -- sin volver a recalcular filtros/orden.
    window._bancosMovimientosVistaActual = movimientosParaVista;

    let rightPanelHTML = `
        <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:10px; margin-bottom:15px; flex-wrap:wrap; gap:10px;">
                
                <h3 style="margin:0; color:#374151;">📋 MOVIMIENTOS</h3>
                
                <select onchange="aplicarFiltroPeriodoLiquidez(this.value)" style="padding:6px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px; font-weight:bold; color:#475569; background:#f8fafc; cursor:pointer;">
                    <option value="dia" ${window._filtroPeriodoLiquidez === 'dia' ? 'selected' : ''}>Día de hoy</option>
                    <option value="semana" ${window._filtroPeriodoLiquidez === 'semana' ? 'selected' : ''}>Esta Semana</option>
                    <option value="mes" ${window._filtroPeriodoLiquidez === 'mes' ? 'selected' : ''}>Este Mes</option>
                    <option value="ano" ${window._filtroPeriodoLiquidez === 'ano' ? 'selected' : ''}>Este Año</option>
                    <option value="total" ${window._filtroPeriodoLiquidez === 'total' ? 'selected' : ''}>Total (Histórico)</option>
                    <option value="manual" ${window._filtroPeriodoLiquidez === 'manual' ? 'selected' : ''} style="display:none;">Fechas Manuales</option>
                </select>

                <div style="display:flex; gap:10px; align-items:center;">
                    <input type="date" value="${window._filtroLiquidezDesde}" onchange="window._filtroPeriodoLiquidez='manual'; window._filtroLiquidezDesde=this.value; renderCuentasBancarias();" style="padding:6px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px;" title="Fecha Desde">
                    <span style="color:#64748b; font-size:12px; font-weight:bold;">al</span>
                    <input type="date" value="${window._filtroLiquidezHasta}" onchange="window._filtroPeriodoLiquidez='manual'; window._filtroLiquidezHasta=this.value; renderCuentasBancarias();" style="padding:6px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px;" title="Fecha Hasta">
                    <button onclick="aplicarFiltroPeriodoLiquidez('total');" style="padding:6px 10px; background:#e2e8f0; color:#475569; border:none; border-radius:6px; cursor:pointer; font-size:12px;" title="Mostrar Todo">🔄 Reset</button>
                </div>
            </div>
            <div style="overflow:auto; max-height:65vh; border:1px solid #f1f5f9; border-radius:8px;">
                <table style="width:100%; border-collapse:collapse; font-size:13px;">
                    <thead><tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0; color:#475569;">
                        <th style="padding:10px; text-align:left; position:sticky; top:0; background:#f8fafc;">Fecha</th>
                        <th style="padding:10px; text-align:left; position:sticky; top:0; background:#f8fafc;">Concepto</th>
                        <th style="padding:10px; text-align:left; position:sticky; top:0; background:#f8fafc;">Cuenta</th>
                        <th style="padding:10px; text-align:right; position:sticky; top:0; background:#f8fafc;">Monto</th>
                    </tr></thead>
                    <tbody>`;

    if (movimientosParaVista.length === 0) {
        rightPanelHTML += `<tr><td colspan="4" style="text-align:center; padding:30px; color:#9ca3af;">No hay movimientos en este periodo o cuenta.</td></tr>`;
    } else {
        movimientosParaVista.forEach((m, idx) => {
            const esIngreso = m.tipo === "ingreso" || m.tipo === "Ingreso";
            const esTransf = m.tipo === "transferencia";
            const color = esTransf ? "#4f46e5" : (esIngreso ? "#16a34a" : "#dc2626");
            const icon = esTransf ? "🔁" : (esIngreso ? "⬆️" : "⬇️");
            const cuentaLabel = m.etiquetaCuenta || m.cuenta || "efectivo";
            const detalleGrupo = Array.isArray(m.itemsGrupo) && m.itemsGrupo.length > 1
                ? `<br><small style="display:block; color:#0f766e; font-weight:700; margin-top:4px;">${m.itemsGrupo.length} abonos: ${m.itemsGrupo.map(x => `${x.referencia || '-'} ${dinero(x.monto)}`).join(' | ')}</small>`
                : '';
            
            let conceptoLimpio = m.concepto || "";
            if (conceptoLimpio.startsWith("Pago a proveedor")) {
                conceptoLimpio = conceptoLimpio.split(" - ")[0]; 
            } else if (conceptoLimpio.startsWith("Compra: ") && conceptoLimpio.includes("(Prov:")) {
                const provMatch = conceptoLimpio.match(/\(Prov:\s*(.*?)\)/);
                if (provMatch) conceptoLimpio = `Compra a proveedor ${provMatch[1]}`;
            }
            if (conceptoLimpio.length > 65) conceptoLimpio = conceptoLimpio.substring(0, 65) + '...';

            rightPanelHTML += `
                <tr onclick="abrirDetalleMovimiento(${idx})" style="border-bottom:1px solid #f1f5f9; cursor:pointer; transition:background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''" title="Ver todo el detalle de este movimiento">
                    <td style="padding:10px; white-space:nowrap;">${m.fecha ? window.formatearFechaCortaMX(m.fecha) : ""}</td>
                    <td style="padding:10px;" title="${m.concepto}">${conceptoLimpio}${detalleGrupo}</td>
                    <td style="padding:10px; color:#64748b;">${cuentaLabel}</td>
                    <td style="padding:10px; text-align:right; font-weight:bold; color:${color}; white-space:nowrap;">
                        ${icon} ${dinero(m.monto)}
                        ${m.esTransferenciaInterna ? `<br><button onclick="event.stopPropagation(); abrirEditarTransferencia('${m.idOperacionTransferencia}')" style="margin-top:4px; padding:2px 8px; background:none; border:1px solid #c7d2fe; color:#4f46e5; border-radius:5px; cursor:pointer; font-size:11px; font-weight:normal;">✏️ Corregir</button>` : ''}
                    </td>
                </tr>`;
        });
    }
    rightPanelHTML += `</tbody></table></div></div>`;

    const conciliacionHTML = diferenciasSaldo.length > 0
        ? `<div style="background:#fffbeb; border:1px solid #f59e0b; border-radius:8px; padding:12px 14px; margin-bottom:16px; color:#92400e;">
                <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap;">
                    <div>
                        <strong>Conciliacion pendiente</strong><br>
                        <small>Hay saldos guardados que no coinciden con la suma de movimientos.</small>
                        <ul style="margin:8px 0 0 18px; padding:0; font-size:12px;">
                            ${diferenciasSaldo.slice(0, 5).map(d => `<li>${d}</li>`).join('')}
                            ${diferenciasSaldo.length > 5 ? `<li>${diferenciasSaldo.length - 5} diferencia(s) mas.</li>` : ''}
                        </ul>
                    </div>
                    <button onclick="recalcularSaldosGuardadosDesdeMovimientos()" style="padding:8px 12px; background:#f59e0b; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">Recalcular saldos</button>
                </div>
           </div>`
        : '';

    contenedor.innerHTML = `
        ${conciliacionHTML}
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
    const fechaHoyCorta = window.obtenerHoyInputMX ? window.obtenerHoyInputMX() : (window.localISO ? window.localISO(hoy).split('T')[0] : hoy.toISOString().split('T')[0]);
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

    // ¿Hay un pago de corte reciente sin deshacer para este banco? Mostramos
    // el botón de deshacer solo en ese caso, igual que el pago individual
    // solo permite deshacer la última cuota marcada.
    const logsPagoCorte = StorageService.get("pagosCorteTarjeta", []);
    const hayPagoCortePorDeshacer = logsPagoCorte.some(l => l.banco === banco && !l.deshecho);

    const modalHTML = `
        <div data-modal="pago-tarjeta" style="position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:7000; display:flex; justify-content:center; align-items:center;">
            <div style="background:white; padding:30px; border-radius:12px; width:90%; max-width:450px;">
                <h2 style="margin-top:0; color:#1e40af;">💳 Pago a Tarjeta: ${banco}</h2>
                <div style="margin-bottom:15px;">
                    <label>Monto a abonar:</label>
                    <input type="number" id="montoPagoTarjeta" value="${vencidoYMesActual.toFixed(2)}" max="${totalAdeudado.toFixed(2)}" style="width:100%; padding:12px; font-size:18px; border:2px solid #10b981; border-radius:6px;">
                </div>
                <div style="margin-bottom:15px;">
                    <label>¿De dónde sale el dinero?</label>
                    <select id="cuentaOrigenPagoTC" style="width:100%; padding:10px; border:1px solid #d1d5db; border-radius:6px;">${opcionesCuenta}</select>
                </div>
                <div style="margin-bottom:15px; background:#f0fdf4; border:1px solid #bbf7d0; padding:12px; border-radius:6px;">
                    <label style="font-weight:bold; color:#15803d;">📅 Fecha de Aplicación del Abono:</label>
                    <input type="date" id="fechaAbonoTarjeta" value="${fechaHoyCorta}" style="width:100%; padding:10px; border:1px solid #22c55e; border-radius:6px; margin-top:6px; font-weight:bold;">
                </div>
                <div style="display:flex; gap:10px;">
                    <button onclick="procesarPagoTarjetaGlobal('${banco}')" style="flex:1; padding:14px; background:#8b5cf6; color:white; border:none; border-radius:6px; font-weight:bold;">✅ Pagar</button>
                    <button onclick="document.querySelector('[data-modal=&quot;pago-tarjeta&quot;]').remove()" style="flex:1; padding:14px; background:#e5e7eb; border:none; border-radius:6px;">✕ Cancelar</button>
                </div>
                ${hayPagoCortePorDeshacer ? `
                <button onclick="deshacerUltimoPagoCorteTarjeta('${banco}')" style="width:100%; margin-top:10px; padding:10px; background:#f1f5f9; color:#b91c1c; border:1px solid #fecaca; border-radius:6px; font-weight:bold; cursor:pointer;">↩ Deshacer último pago de corte</button>
                ` : ''}
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
        
        cronogramaGlobal[clave].detalles.sort((a,b) => {
            const fa = window.parseFechaMX ? window.parseFechaMX(a.pago.fecha) : new Date(a.pago.fecha);
            const fb = window.parseFechaMX ? window.parseFechaMX(b.pago.fecha) : new Date(b.pago.fecha);
            return fa - fb;
        }).forEach((det) => {
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
    const fechaAbonoStr = document.getElementById("fechaAbonoTarjeta").value;

    if (isNaN(montoAbono) || montoAbono <= 0) return alert("⚠️ Ingresa un monto válido mayor a 0.");

    // --- NUEVO: RESUMEN Y CONFIRMACIÓN ---
    const formatoDinero = (val) => '$' + Number(val).toLocaleString('en-US', {minimumFractionDigits: 2});
    const msjConf = `⚠️ RESUMEN DE OPERACIÓN - ¿PAGAR A TARJETA?\n\nDestino: Tarjeta ${banco}\nMonto: ${formatoDinero(montoAbono)}\nOrigen del dinero: ${cuentaOrigenEtiqueta}\nFecha de Aplicación: ${fechaAbonoStr}\n\n¿Deseas descontar este dinero y registrar el pago?`;
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
                    cuotaIndex: index,
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
    // 🛡️ Cada cuota que se toca en este reparto queda registrada aquí con su
    // estado ANTERIOR (deudaId + cuotaIndex + estado/montoAbonado de antes),
    // para que deshacerUltimoPagoCorteTarjeta pueda restaurar exactamente lo
    // que había — no solo "Pendiente" como en el pago individual, porque aquí
    // una cuota pudo venir de 'Parcial' de un abono anterior y no de cero.
    const cuotasTocadas = [];

    for (let item of todasLasCuotas) {
        if (dineroRestante <= 0.01) break; // Si ya no hay dinero, salimos del ciclo

        cuotasTocadas.push({
            deudaId: item.deudaId,
            cuotaIndex: item.cuotaIndex,
            estadoAnterior: item.pagoRef.estado,
            montoAbonadoAnterior: item.pagoRef.montoAbonado !== undefined ? item.pagoRef.montoAbonado : null
        });

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

    // =========================================================================
    // 5. MOVER EL DINERO PRIMERO — con _egresarCuenta, ANTES de persistir el
    // reparto de cuotas. Así, si la cuenta no existe, no se guarda ningún
    // cambio en cuentasMSI y el usuario puede reintentar sin quedar con
    // cuotas marcadas como pagadas sin dinero movido.
    // =========================================================================
    // 🛡️ REPARACIÓN: antes esto escribía el movimiento a mano en
    // movimientosCaja (siempre, sin validar la cuenta) y solo ajustaba el
    // saldo real si un find() encontraba la cuenta — si no la encontraba, el
    // pago quedaba registrado como si hubiera salido dinero, pero el saldo
    // real nunca se descontaba, y no había ningún alert ni registro de
    // auditoría. Ahora se usa _egresarCuenta (misma función que ya usan
    // transferencia, ajuste de auditoría y MSI individual): valida la cuenta
    // ANTES de escribir nada y aborta con alert si no existe.
    if (typeof window._egresarCuenta !== 'function') {
        return alert("❌ No se pudo registrar el pago: funciones de cuenta no disponibles.");
    }

    const fechaAbonoIso = window.localISO ? window.localISO(fechaAbonoStr + 'T12:00:00') : new Date(fechaAbonoStr + 'T12:00:00').toISOString();
    const refPagoTC = `PAGO-TC-${banco}-${Date.now()}`;
    const egresoOk = window._egresarCuenta({
        monto: montoAbono,
        cuentaId: cuentaOrigen,
        etiqueta: cuentaOrigenEtiqueta,
        concepto: `Pago a Corte Mensual Tarjeta de Crédito — ${banco}`,
        referencia: refPagoTC,
        fecha: fechaAbonoIso,
        idOperacion: refPagoTC
    }) !== false;
    if (!egresoOk) return alert(`❌ No se pudo descontar de [${cuentaOrigenEtiqueta}]. Verifica que la cuenta exista.\n\nEl pago NO se aplicó: ninguna cuota quedó marcada como pagada.`);

    // El dinero ya se movió con éxito — ahora sí persistimos el reparto de
    // cuotas calculado en los pasos 1-4.
    StorageService.set("cuentasMSI", cuentasMSI);

    // Guardamos el log de reversión: qué cuotas se tocaron y cómo estaban
    // antes, para que deshacerUltimoPagoCorteTarjeta pueda restaurarlas
    // exactamente y revertir el dinero con _ingresarCuenta.
    const logsPagosCorte = StorageService.get("pagosCorteTarjeta", []);
    logsPagosCorte.push({
        ref: refPagoTC,
        banco,
        cuentaOrigen,
        cuentaOrigenEtiqueta,
        monto: montoAbono,
        fecha: fechaAbonoIso,
        deshecho: false,
        cuotas: cuotasTocadas
    });
    StorageService.set("pagosCorteTarjeta", logsPagosCorte);

    document.querySelector('[data-modal="pago-tarjeta"]').remove();
    alert(`✅ Pago de $${montoAbono.toFixed(2)} a la tarjeta ${banco} distribuido correctamente en el corte mensual.`);
    
    // Forzamos la recarga de las pantallas
    if (typeof renderCuentasMSI === 'function') renderCuentasMSI();
    if (typeof renderDashboardMSI === 'function') renderDashboardMSI();
    if (typeof renderCuentasBancarias === 'function') renderCuentasBancarias();
}

// ── Deshacer el último pago de corte mensual de una tarjeta ─────────────────
// Revierte SOLO el pago de corte más reciente (no deshecho todavía) de ese
// banco: regresa el dinero a la cuenta de origen con _ingresarCuenta y
// restaura cada cuota tocada a su estado/montoAbonado exacto de antes
// (guardado en pagosCorteTarjeta al momento del pago) — no simplemente las
// deja en 'Pendiente', porque una cuota pudo venir de un abono parcial
// anterior.
function deshacerUltimoPagoCorteTarjeta(banco) {
    const logs = StorageService.get("pagosCorteTarjeta", []);
    // Buscamos de atrás hacia adelante el log no deshecho más reciente de este banco
    let log = null;
    for (let i = logs.length - 1; i >= 0; i--) {
        if (logs[i].banco === banco && !logs[i].deshecho) { log = logs[i]; break; }
    }
    if (!log) return alert("No hay ningún pago de corte reciente que deshacer para esta tarjeta.");

    const formatoDinero = (val) => '$' + Number(val).toLocaleString('en-US', {minimumFractionDigits: 2});
    if (!confirm(`↩ ¿Deshacer el pago de corte de ${formatoDinero(log.monto)} a ${banco} (${log.cuentaOrigenEtiqueta})?\n\nEsto regresará el dinero a la cuenta de origen y revertirá el estado de las ${log.cuotas.length} cuota(s) que tocó este pago.`)) return;

    if (typeof window._ingresarCuenta !== 'function') return alert("❌ No se pudo deshacer: funciones de cuenta no disponibles.");

    const ingresoOk = window._ingresarCuenta({
        monto: log.monto,
        cuentaId: log.cuentaOrigen,
        etiqueta: log.cuentaOrigenEtiqueta,
        concepto: `Reversión pago corte tarjeta — ${banco}`,
        referencia: log.ref,
        idOperacion: `${log.ref}-REV`
    }) !== false;
    if (!ingresoOk) return alert(`❌ No se pudo regresar el dinero a [${log.cuentaOrigenEtiqueta}]. Verifica que la cuenta siga existiendo. No se revirtió ninguna cuota.`);

    // Restauramos cada cuota tocada a su estado exacto de antes del pago.
    const cuentasMSI = StorageService.get("cuentasMSI", []);
    log.cuotas.forEach(c => {
        const deuda = cuentasMSI.find(d => d.id === c.deudaId);
        if (!deuda || !Array.isArray(deuda.calendario) || !deuda.calendario[c.cuotaIndex]) return;
        const pagoRef = deuda.calendario[c.cuotaIndex];
        pagoRef.estado = c.estadoAnterior;
        if (c.montoAbonadoAnterior === null) delete pagoRef.montoAbonado;
        else pagoRef.montoAbonado = c.montoAbonadoAnterior;
    });

    // Recalculamos montoPagado/pagosRealizados de cada deuda afectada, igual
    // que hace el paso 4 de procesarPagoTarjetaGlobal.
    const deudaIdsAfectadas = new Set(log.cuotas.map(c => c.deudaId));
    cuentasMSI.filter(d => deudaIdsAfectadas.has(d.id)).forEach(deuda => {
        let totalPagadoAqui = 0, cuotasLiquidadas = 0;
        const cuota = parseFloat(String(deuda.cuotaMensual || 0).replace(/[$,]/g, ''));
        (deuda.calendario || []).forEach(pago => {
            if (pago.estado === 'Pagado') { totalPagadoAqui += cuota; cuotasLiquidadas++; }
            else if (pago.estado === 'Parcial') { totalPagadoAqui += parseFloat(pago.montoAbonado || 0); }
        });
        deuda.montoPagado = totalPagadoAqui;
        deuda.pagosRealizados = cuotasLiquidadas;
    });
    StorageService.set("cuentasMSI", cuentasMSI);

    log.deshecho = true;
    StorageService.set("pagosCorteTarjeta", logs);

    alert("↩ Pago de corte deshecho. El dinero regresó a la cuenta de origen y las cuotas volvieron a su estado anterior.");
    document.querySelector('[data-modal="pago-tarjeta"]')?.remove();
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
    const refTransf = `TR-${idTransf}`;

    // 🛡️ REPARACIÓN: usar _egresarCuenta/_ingresarCuenta en vez de escribir
    // el par de movimientos a mano. El push directo dejaba el rastro en
    // movimientosCaja pero nunca actualizaba cuentasEfectivo/cuentas-bancarias,
    // descuadrando el saldo cacheado de origen Y destino hasta un recálculo
    // manual. Si falla el egreso de origen, se aborta sin tocar nada; si el
    // egreso sí aplicó pero el ingreso a destino falla (cuenta inexistente),
    // se revierte el egreso para no dejar dinero "perdido".
    if (typeof window._egresarCuenta !== 'function' || typeof window._ingresarCuenta !== 'function') {
        return alert("❌ No se pudo registrar la transferencia: funciones de cuenta no disponibles.");
    }

    const egresoOk = window._egresarCuenta({
        monto, cuentaId: origen, etiqueta: nombreOrigenFull,
        concepto: `Transferencia a: ${nombreDestino} (${motivo})`,
        referencia: refTransf, fecha: fechaIso, idOperacion: refTransf
    }) !== false;
    if (!egresoOk) return alert(`❌ No se pudo egresar de [${nombreOrigenFull}]. Transferencia cancelada.`);

    const ingresoOk = window._ingresarCuenta({
        monto, cuentaId: destino, etiqueta: nombreDestinoFull,
        concepto: `Transferencia de: ${nombreOrigen} (${motivo})`,
        referencia: refTransf, fecha: fechaIso, idOperacion: refTransf
    }) !== false;
    if (!ingresoOk) {
        window._ingresarCuenta({
            monto, cuentaId: origen, etiqueta: nombreOrigenFull,
            concepto: `Reversión transferencia fallida (${refTransf}) — no existía la cuenta destino`,
            referencia: refTransf, fecha: fechaIso, idOperacion: `${refTransf}-REV`
        });
        return alert(`❌ No se pudo ingresar a [${nombreDestinoFull}]. Se revirtió el egreso de origen.`);
    }

    // Enriquecer los dos movimientos recién creados con los metadatos de
    // transferencia interna (cuentaOrigen/cuentaDestino/tipoMovimiento) que usa
    // el resto del sistema (corte de caja, conciliación) para clasificarlos.
    const movimientos = StorageService.get("movimientosCaja", []);
    movimientos.forEach(m => {
        if (m.idOperacion === refTransf) {
            m.cuentaOrigen = origen;
            m.cuentaDestino = destino;
            m.cuentaOrigenNombre = nombreOrigenFull;
            m.cuentaDestinoNombre = nombreDestinoFull;
            m.tipoMovimiento = "transferencia_interna";
        }
    });
    StorageService.set("movimientosCaja", movimientos);

    document.getElementById("modalTransferenciaCuentas").remove();
    alert(`✅ Transferencia de $${monto.toFixed(2)} registrada con éxito.`);
    
    // Refrescar vistas
    if (typeof window.renderCuentasBancarias === 'function') window.renderCuentasBancarias();
    if (typeof window.renderConciliacion === 'function') window.renderConciliacion();
};

// ── Corrección de una transferencia ya registrada ────────────────────────
// Mismo patrón que gastos/MSI: nunca se reescriben los dos movimientos
// originales (egreso en origen + ingreso en destino). Se revierten con sus
// contrarios y se aplica de nuevo con los datos corregidos, dejando el
// rastro completo en movimientosCaja y un evento nuevo en auditoría.
window.abrirEditarTransferencia = function(idOperacion) {
    if (typeof requireAdmin !== 'function') { _renderModalEditarTransferencia(idOperacion); return; }
    requireAdmin(() => _renderModalEditarTransferencia(idOperacion));
};

function _renderModalEditarTransferencia(idOperacion) {
    const movimientos = StorageService.get("movimientosCaja", []);
    const legs = movimientos.filter(m => _claveTransferencia(m) === idOperacion && _esLegTransferencia(m));
    const egreso = legs.find(m => String(m.tipo || '').toLowerCase() === 'egreso');
    const ingreso = legs.find(m => String(m.tipo || '').toLowerCase() === 'ingreso');
    if (!egreso || !ingreso) return alert('⚠️ No se encontraron los dos movimientos de esta transferencia (quizá ya fue corregida antes). Revisa la lista de movimientos.');
    // 🛡️ Transferencias viejas (de antes de la reparación) pueden no traer
    // etiquetaCuenta guardada — usamos el id de cuenta crudo como respaldo
    // para no mostrar "undefined" en el modal.
    egreso.etiquetaCuenta = egreso.etiquetaCuenta || egreso.cuenta;
    ingreso.etiquetaCuenta = ingreso.etiquetaCuenta || ingreso.cuenta;

    const fechaActual = egreso.fecha ? String(egreso.fecha).split('T')[0] : (window.obtenerHoyInputMX ? window.obtenerHoyInputMX() : '');
    const motivoActual = (egreso.concepto || '').replace(/^Transferencia a:.*\(/, '').replace(/\)$/, '') || '';

    document.querySelector('[data-modal="editar-transferencia"]')?.remove();
    const html = `
    <div data-modal="editar-transferencia" style="position:fixed; inset:0; background:rgba(15,23,42,0.8); z-index:99999; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(4px); padding:20px;">
        <div style="background:white; padding:28px; border-radius:12px; width:100%; max-width:480px; box-shadow:0 20px 25px rgba(0,0,0,0.2);">
            <h3 style="margin-top:0; color:#4f46e5;">✏️ Corregir Transferencia</h3>
            <p style="font-size:12px; color:#92400e; background:#fffbeb; border:1px solid #fde68a; padding:8px 10px; border-radius:6px; margin-bottom:18px;">
                Se revertirá la transferencia original (${dinero(egreso.monto)}: ${egreso.etiquetaCuenta} → ${ingreso.etiquetaCuenta}) y se aplicará de nuevo con los datos corregidos. Queda registrado en auditoría.
            </p>
            <div style="margin-bottom:15px;">
                <label style="display:block; font-weight:bold; font-size:12px; color:#475569; margin-bottom:5px;">📅 Fecha:</label>
                <input type="date" id="editTransfFecha" value="${fechaActual}" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;">
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:15px;">
                <div>
                    <label style="display:block; font-weight:bold; font-size:12px; color:#dc2626; margin-bottom:5px;">📤 Origen:</label>
                    ${window._buildSelectorCuentas('editTransfOrigen', false)}
                </div>
                <div>
                    <label style="display:block; font-weight:bold; font-size:12px; color:#10b981; margin-bottom:5px;">📥 Destino:</label>
                    ${window._buildSelectorCuentas('editTransfDestino', false)}
                </div>
            </div>
            <div style="margin-bottom:15px;">
                <label style="display:block; font-weight:bold; font-size:12px; color:#475569; margin-bottom:5px;">💰 Monto ($):</label>
                <input type="number" id="editTransfMonto" min="0.01" step="0.01" value="${egreso.monto}" style="width:100%; padding:12px; border:2px solid #6366f1; border-radius:6px; font-size:18px; font-weight:bold; box-sizing:border-box; color:#4f46e5; text-align:center;">
            </div>
            <div style="margin-bottom:20px;">
                <label style="display:block; font-weight:bold; font-size:12px; color:#475569; margin-bottom:5px;">📝 Motivo / Referencia:</label>
                <input type="text" id="editTransfMotivo" value="${motivoActual.replace(/"/g, '&quot;')}" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;">
            </div>
            <div style="display:flex; gap:10px;">
                <button onclick="guardarEdicionTransferencia('${idOperacion}')" style="flex:2; padding:12px; background:#4f46e5; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">💾 Guardar Corrección</button>
                <button onclick="document.querySelector('[data-modal=editar-transferencia]')?.remove()" style="flex:1; padding:12px; background:#f1f5f9; color:#475569; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">✕ Cancelar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    setTimeout(() => {
        const selO = document.getElementById('editTransfOrigen');
        const selD = document.getElementById('editTransfDestino');
        if (selO && [...selO.options].some(o => o.value === egreso.cuenta)) selO.value = egreso.cuenta;
        if (selD && [...selD.options].some(o => o.value === ingreso.cuenta)) selD.value = ingreso.cuenta;
    }, 0);
}

window.guardarEdicionTransferencia = function(idOperacion) {
    const movimientos = StorageService.get("movimientosCaja", []);
    const legs = movimientos.filter(m => _claveTransferencia(m) === idOperacion && _esLegTransferencia(m));
    const egresoAnterior = legs.find(m => String(m.tipo || '').toLowerCase() === 'egreso');
    const ingresoAnterior = legs.find(m => String(m.tipo || '').toLowerCase() === 'ingreso');
    if (!egresoAnterior || !ingresoAnterior) return alert('⚠️ No se encontraron los movimientos originales.');
    egresoAnterior.etiquetaCuenta = egresoAnterior.etiquetaCuenta || egresoAnterior.cuenta;
    ingresoAnterior.etiquetaCuenta = ingresoAnterior.etiquetaCuenta || ingresoAnterior.cuenta;

    const selO = document.getElementById('editTransfOrigen');
    const selD = document.getElementById('editTransfDestino');
    const nuevoOrigen = selO.value;
    const nuevoDestino = selD.value;
    const nombreOrigenFull = selO.options[selO.selectedIndex].text;
    const nombreDestinoFull = selD.options[selD.selectedIndex].text;
    const nuevoMonto = parseFloat(document.getElementById('editTransfMonto').value);
    const fechaRaw = document.getElementById('editTransfFecha').value;
    const motivo = document.getElementById('editTransfMotivo').value.trim() || "Transferencia interna";

    if (!nuevoOrigen || !nuevoDestino) return alert("❌ Selecciona las cuentas de origen y destino.");
    if (nuevoOrigen === nuevoDestino) return alert("❌ La cuenta de origen y destino no pueden ser la misma.");
    if (isNaN(nuevoMonto) || nuevoMonto <= 0) return alert("❌ Ingresa un monto válido mayor a cero.");
    if (!fechaRaw) return alert("❌ Selecciona una fecha válida.");

    const sinCambios = nuevoOrigen === egresoAnterior.cuenta && nuevoDestino === ingresoAnterior.cuenta &&
        nuevoMonto === Number(egresoAnterior.monto) && fechaRaw === String(egresoAnterior.fecha).split('T')[0];
    if (sinCambios) return alert('No hay cambios que guardar.');

    if (!confirm(`CONFIRMAR CORRECCIÓN\n\nANTES: ${dinero(egresoAnterior.monto)} de ${egresoAnterior.etiquetaCuenta} → ${ingresoAnterior.etiquetaCuenta}\nDESPUÉS: ${dinero(nuevoMonto)} de ${nombreOrigenFull} → ${nombreDestinoFull}\n\nSe revertirá la transferencia original y se aplicará la corregida. ¿Continuar?`)) return;

    if (typeof window._egresarCuenta !== 'function' || typeof window._ingresarCuenta !== 'function') {
        return alert("❌ No se pudo corregir: funciones de cuenta no disponibles.");
    }

    const fechaBase = new Date(fechaRaw + 'T12:00:00');
    const fechaIso = window.localISO ? window.localISO(fechaBase) : fechaBase.toISOString();
    const idBase = `${idOperacion}-CORR-${Date.now()}`;

    // 1) Revertir la transferencia original: regresar el monto viejo al
    // origen viejo, y sacar el monto viejo del destino viejo.
    const rev1 = window._ingresarCuenta({
        monto: egresoAnterior.monto, cuentaId: egresoAnterior.cuenta, etiqueta: egresoAnterior.etiquetaCuenta,
        concepto: `Corrección de transferencia — reversión de origen`,
        referencia: idOperacion, idOperacion: `${idBase}-REV-ORIGEN`
    }) !== false;
    if (!rev1) return alert(`❌ No se pudo revertir el egreso original en "${egresoAnterior.etiquetaCuenta}" (¿ya no existe esa cuenta?). Nada se guardó.`);

    const rev2 = window._egresarCuenta({
        monto: ingresoAnterior.monto, cuentaId: ingresoAnterior.cuenta, etiqueta: ingresoAnterior.etiquetaCuenta,
        concepto: `Corrección de transferencia — reversión de destino`,
        referencia: idOperacion, idOperacion: `${idBase}-REV-DESTINO`
    }) !== false;
    if (!rev2) {
        // Deshacer la reversión de origen para no dejar dinero de más ahí.
        window._egresarCuenta({
            monto: egresoAnterior.monto, cuentaId: egresoAnterior.cuenta, etiqueta: egresoAnterior.etiquetaCuenta,
            concepto: `Corrección de transferencia — no se pudo completar, revertida`,
            referencia: idOperacion, idOperacion: `${idBase}-REV-ORIGEN-DESHECHA`
        });
        return alert(`❌ No se pudo revertir el ingreso original en "${ingresoAnterior.etiquetaCuenta}" (¿ya no existe esa cuenta?). Se deshizo todo, nada quedó a medias.`);
    }

    // 2) Aplicar la transferencia con los datos corregidos.
    const ap1 = window._egresarCuenta({
        monto: nuevoMonto, cuentaId: nuevoOrigen, etiqueta: nombreOrigenFull,
        concepto: `Transferencia a: ${nombreDestinoFull} (${motivo}) [corregida]`,
        referencia: idOperacion, fecha: fechaIso, idOperacion: `${idBase}-APL`
    }) !== false;
    if (!ap1) {
        alert(`⚠️ Se revirtió la transferencia original, pero NO se pudo aplicar la corregida (¿"${nombreOrigenFull}" ya no existe?). El dinero quedó en las cuentas originales sin transferir — revisa manualmente y vuelve a intentar.`);
        return;
    }
    const ap2 = window._ingresarCuenta({
        monto: nuevoMonto, cuentaId: nuevoDestino, etiqueta: nombreDestinoFull,
        concepto: `Transferencia de: ${nombreOrigenFull} (${motivo}) [corregida]`,
        referencia: idOperacion, fecha: fechaIso, idOperacion: `${idBase}-APL`
    }) !== false;
    if (!ap2) {
        window._ingresarCuenta({
            monto: nuevoMonto, cuentaId: nuevoOrigen, etiqueta: nombreOrigenFull,
            concepto: `Reversión — no se pudo completar la corrección (destino "${nombreDestinoFull}" no válido)`,
            referencia: idOperacion, idOperacion: `${idBase}-APL-REV`
        });
        alert(`⚠️ No se pudo ingresar a "${nombreDestinoFull}". Se regresó el dinero a "${nombreOrigenFull}" — nada quedó a medias, pero la corrección no se aplicó. Intenta con otra cuenta destino.`);
        return;
    }

    // Enriquecer los movimientos nuevos con los metadatos que usa el resto
    // del sistema para reconocerlos como transferencia interna.
    const movimientosActualizados = StorageService.get("movimientosCaja", []);
    movimientosActualizados.forEach(m => {
        if (m.idOperacion === `${idBase}-APL`) {
            m.cuentaOrigen = nuevoOrigen;
            m.cuentaDestino = nuevoDestino;
            m.cuentaOrigenNombre = nombreOrigenFull;
            m.cuentaDestinoNombre = nombreDestinoFull;
            m.tipoMovimiento = "transferencia_interna";
        }
    });
    StorageService.set("movimientosCaja", movimientosActualizados);

    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'TRANSFERENCIA_CORREGIDA',
            modulo: 'Bancos',
            entidad: 'transferencia',
            entidadId: idOperacion,
            detalle: `Transferencia corregida: ${dinero(egresoAnterior.monto)} (${egresoAnterior.etiquetaCuenta} → ${ingresoAnterior.etiquetaCuenta}) → ${dinero(nuevoMonto)} (${nombreOrigenFull} → ${nombreDestinoFull})`,
            monto: nuevoMonto,
            severidad: 'riesgo',
            datos: {
                anterior: { monto: egresoAnterior.monto, origen: egresoAnterior.etiquetaCuenta, destino: ingresoAnterior.etiquetaCuenta, fecha: egresoAnterior.fecha },
                nuevo: { monto: nuevoMonto, origen: nombreOrigenFull, destino: nombreDestinoFull, fecha: fechaIso }
            }
        });
    }

    document.querySelector('[data-modal="editar-transferencia"]')?.remove();
    alert('✅ Transferencia corregida.');
    if (typeof window.renderCuentasBancarias === 'function') window.renderCuentasBancarias();
    if (typeof window.renderConciliacion === 'function') window.renderConciliacion();
};
// =====================================================================
// ⚖️ MÓDULO DE AUDITORÍA: AJUSTE DE SALDOS FÍSICOS
// =====================================================================
window.abrirAuditoriaSaldos = function() {
    const usuarioActual = (() => { try { return JSON.parse(sessionStorage.getItem('sesionActiva') || 'null'); } catch { return null; } })();
    if (usuarioActual?.rol !== "admin" && usuarioActual?.rol !== "Administrador") {
        if (window.AuditService?.log) {
            window.AuditService.log({ accion: 'ACCESO_DENEGADO', modulo: 'Seguridad', entidad: 'Ajuste de saldos', detalle: 'Intento de abrir ajuste de saldos sin rol admin', severidad: 'alerta' });
        }
        return alert("⛔ ACCESO DENEGADO: Solo Administradores pueden hacer ajustes de auditoría.");
    }

    // 1. Obtener cajas y cuentas de débito
    const cajas = StorageService.get("cuentasEfectivo", [{ id: "efectivo", nombre: "💵 Efectivo Principal", saldo: 0 }]);
    const tarjetas = StorageService.get("tarjetasConfig", []);
    const debito = tarjetas.filter(t => t.tipo === "debito");

    let opcionesHTML = '';
    cajas.forEach(c => {
        const idValido = c.id || c.nombre.replace(/\s+/g, '_');
        opcionesHTML += `<option value="${idValido}">${c.nombre}</option>`;
    });
    debito.forEach(t => {
        const idValido = t.banco || t.nombre;
        opcionesHTML += `<option value="${idValido}">🏦 ${t.banco || t.nombre} Débito</option>`;
    });

    // 2. Renderizar Ventana
    const modalHTML = `
    <div data-modal="auditoria-saldos" style="position:fixed; inset:0; background:rgba(15,23,42,0.9); z-index:99999; display:flex; justify-content:center; align-items:flex-start; overflow-y:auto; padding:20px; backdrop-filter: blur(5px);">
        <div style="background:white; padding:30px; border-radius:12px; width:100%; max-width:500px; margin-top:50px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #7c3aed; padding-bottom:15px; margin-bottom:20px;">
                <div>
                    <h2 style="margin:0; color:#5b21b6; font-size:24px;">⚖️ Ajuste de Saldos (Auditoría)</h2>
                    <p style="margin:0; color:#64748b; font-size:13px;">Registra faltantes o sobrantes dejando evidencia en el sistema.</p>
                </div>
                <button onclick="document.querySelector('[data-modal=\\'auditoria-saldos\\']').remove()" style="background:#f1f5f9; border:none; padding:8px 15px; border-radius:6px; cursor:pointer; font-weight:bold; color:#475569;">✕ Cerrar</button>
            </div>

            <div style="margin-bottom:15px; background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">
                <label style="font-weight:bold; font-size:12px; color:#475569;">🏦 Cuenta a ajustar:</label>
                <select id="ajusteCta" style="width:100%; padding:10px; margin-top:5px; border-radius:6px; border:1px solid #cbd5e1; font-weight:bold; color:#1e40af;">
                    ${opcionesHTML}
                </select>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:15px;">
                <div>
                    <label style="font-weight:bold; font-size:12px; color:#475569;">🔄 Tipo de Ajuste:</label>
                    <select id="ajusteTipo" style="width:100%; padding:10px; margin-top:5px; border-radius:6px; border:1px solid #cbd5e1; font-weight:bold;">
                        <option value="ingreso" style="color:#16a34a;">⬆️ Sobrante (Sumar dinero)</option>
                        <option value="egreso" style="color:#dc2626;">⬇️ Faltante (Restar dinero)</option>
                    </select>
                </div>
                <div>
                    <label style="font-weight:bold; font-size:12px; color:#475569;">💰 Monto ($):</label>
                    <input type="number" id="ajusteMonto" min="0.01" step="0.01" placeholder="0.00" style="width:100%; padding:10px; margin-top:5px; border-radius:6px; border:2px solid #7c3aed; font-weight:bold; text-align:center; box-sizing:border-box; font-size:16px;">
                </div>
            </div>

            <div style="margin-bottom:15px;">
                <label style="font-weight:bold; font-size:12px; color:#475569;">📅 Fecha de aplicación:</label>
                <input type="date" id="ajusteFecha" style="width:100%; padding:10px; margin-top:5px; border-radius:6px; border:1px solid #cbd5e1; box-sizing:border-box;" value="${window.obtenerHoyInputMX ? window.obtenerHoyInputMX() : (window.localISO ? window.localISO(new Date()).split('T')[0] : new Date().toISOString().split('T')[0])}">
                <small style="color:#64748b; font-size:11px;">Puedes ajustar la fecha del movimiento si el descuadre se detectó después.</small>
            </div>

            <div style="margin-bottom:20px;">
                <label style="font-weight:bold; font-size:12px; color:#475569;">📝 Evidencia / Motivo (Obligatorio):</label>
                <textarea id="ajusteMotivo" placeholder="Ej: Faltante de $20 en caja principal por error en cambio. Se notificó a encargado..." style="width:100%; padding:10px; margin-top:5px; border-radius:6px; border:1px solid #cbd5e1; box-sizing:border-box; resize:vertical; min-height:80px;"></textarea>
            </div>

            <div style="background:#fef2f2; border:1px solid #fca5a5; padding:12px; border-radius:8px; margin-bottom:20px; font-size:11px; color:#991b1b;">
                ⚠️ <b>Atención:</b> Esta acción inyectará un movimiento permanente en el Flujo de Caja bajo el concepto de "AJUSTE AUDITORÍA" para cuadrar el saldo físico.
            </div>

            <button onclick="guardarAjusteAuditoria()" style="width:100%; background:#7c3aed; color:white; border:none; padding:14px; border-radius:8px; font-size:16px; font-weight:bold; cursor:pointer; box-shadow:0 4px 6px rgba(124, 58, 237, 0.2);">
                💾 Confirmar y Aplicar Ajuste
            </button>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

window.guardarAjusteAuditoria = function() {
    const modal = document.querySelector('[data-modal="auditoria-saldos"]');
    const cuentaSel = modal?.querySelector("#ajusteCta") || document.getElementById("ajusteCta");
    if (!cuentaSel) return alert("❌ Error de interfaz: No se encontró el selector de cuenta.");
    
    const cuentaId = cuentaSel.value;
    // Quitamos los emojis del nombre para la etiqueta
    const cuentaNombre = cuentaSel.options[cuentaSel.selectedIndex].text.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]\s?/g, '').replace(' Débito', '');
    
    const tipo = modal?.querySelector("#ajusteTipo")?.value || document.getElementById("ajusteTipo")?.value;
    const monto = parseFloat(modal?.querySelector("#ajusteMonto")?.value || document.getElementById("ajusteMonto")?.value);

    // 🔍 REPARACIÓN QUIRÚRGICA: Localizar el motivo de forma segura dentro del modal activo
    let motivo = "";
    
    if (modal) {
        // Busca cualquier textarea o input de texto que sirva para el motivo dentro del modal
        const campoMotivo = modal.querySelector('textarea, input[id="ajusteMotivo"], input[type="text"]');
        if (campoMotivo) {
            motivo = campoMotivo.value.trim();
        }
    } else {
        // Fallback por si el modal no tiene la propiedad data-modal
        motivo = document.getElementById("ajusteMotivo")?.value.trim() || "";
    }

    if (tipo !== 'ingreso' && tipo !== 'egreso') return alert("Error de interfaz: el tipo de ajuste no corresponde a auditoria de saldos.");
    if (!monto || monto <= 0) return alert("❌ Ingresa un monto válido mayor a 0.");
    if (!motivo || motivo.length < 5) return alert("❌ Debes escribir un motivo claro (mínimo 5 caracteres) para la evidencia.");

    const msj = tipo === 'ingreso' ? 'AGREGAR (Sobrante)' : 'RETIRAR (Faltante)';
    if (!confirm(`AUDITORÍA:\n\n¿Confirmas ${msj} de ${dinero(monto)} a la cuenta [${cuentaNombre}]?\n\nMotivo: ${motivo}`)) return;

    // Fijamos la hora al mediodía para evitar desfases de zona horaria
    const fechaStr = modal?.querySelector("#ajusteFecha")?.value || document.getElementById("ajusteFecha")?.value || (window.obtenerHoyInputMX ? window.obtenerHoyInputMX() : (window.localISO ? window.localISO(new Date()).split('T')[0] : new Date().toISOString().split('T')[0]));
    const fechaBase = new Date(fechaStr + 'T12:00:00');
    const fechaIso = window.localISO ? window.localISO(fechaBase) : fechaBase.toISOString();
    
    const idAjuste = Date.now();
    const refAjuste = `AUD-${idAjuste}`;

    // 🛡️ REPARACIÓN: usar _egresarCuenta/_ingresarCuenta en vez de escribir el
    // movimiento a mano. El push directo dejaba el ajuste en movimientosCaja
    // pero nunca actualizaba cuentasEfectivo/cuentas-bancarias, descuadrando el
    // saldo cacheado de la cuenta ajustada hasta un recálculo manual — algo
    // especialmente delicado tratándose de un ajuste que existe justamente
    // para cuadrar saldos.
    const fnMovimiento = tipo === 'ingreso' ? window._ingresarCuenta : window._egresarCuenta;
    if (typeof fnMovimiento !== 'function') return alert("❌ No se pudo registrar el ajuste: funciones de cuenta no disponibles.");

    const ajusteOk = fnMovimiento({
        monto, cuentaId, etiqueta: cuentaNombre,
        concepto: `⚖️ AJUSTE AUDITORÍA: ${motivo}`,
        referencia: refAjuste, fecha: fechaIso, idOperacion: refAjuste
    }) !== false;
    if (!ajusteOk) return alert(`❌ No se pudo aplicar el ajuste a [${cuentaNombre}]. Verifica que la cuenta exista.`);

    // Restaurar la etiqueta medioPago='ajuste' (distinta de 'efectivo'/'transferencia'
    // que asigna _ingresarCuenta/_egresarCuenta según el tipo de cuenta) para que un
    // ajuste de auditoría siga siendo identificable como tal en reportes futuros.
    const movimientos = StorageService.get("movimientosCaja", []);
    movimientos.forEach(m => { if (m.idOperacion === refAjuste) m.medioPago = "ajuste"; });
    StorageService.set("movimientosCaja", movimientos);

    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'AJUSTE_SALDO_AUDITORIA',
            modulo: 'Finanzas',
            entidad: 'cuenta',
            entidadId: cuentaId,
            detalle: motivo,
            monto,
            severidad: 'alerta',
            datos: { tipo, cuentaNombre, referencia: `AUD-${idAjuste}`, fecha: fechaIso }
        });
    }
    
    if (modal) {
        modal.remove();
    } else {
        document.querySelector('[data-modal="auditoria-saldos"]')?.remove();
    }
    
    alert("✅ Ajuste aplicado con éxito. La evidencia quedó registrada permanentemente en el flujo de caja.");
    
    // Refrescar vistas si están abiertas de fondo
    if (typeof window.renderCuentasBancarias === 'function') window.renderCuentasBancarias();
    if (typeof window.renderReporteFlujo === 'function') window.renderReporteFlujo();
    if (typeof window.renderConciliacion === 'function') window.renderConciliacion();
};
window.renderCuentasBancarias = renderCuentasBancarias;
window._bancosCalcularSaldosDesdeMovimientos = _bancosCalcularSaldosDesdeMovimientos;
window.recalcularSaldosGuardadosDesdeMovimientos = recalcularSaldosGuardadosDesdeMovimientos;
window.renderDashboardMSI = renderDashboardMSI;
window.abrirModalPagoTarjeta = abrirModalPagoTarjeta;
window.procesarPagoTarjetaGlobal = procesarPagoTarjetaGlobal;
window.deshacerUltimoPagoCorteTarjeta = deshacerUltimoPagoCorteTarjeta;
