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

    // Manejo seguro del string de fecha (DD/MM/YYYY o YYYY-MM-DD)
    let fecha;
    if (fechaCompraStr.includes('/')) {
        let partes = fechaCompraStr.split('/');
        fecha = new Date(partes[2], partes[1] - 1, partes[0]);
    } else {
        fecha = new Date(fechaCompraStr);
    }
    if (isNaN(fecha.getTime())) fecha = new Date();

    const diaCompra = fecha.getDate();
    const diaCorte  = parseInt(infoBanco.diaCorte);
    const diaLimite = parseInt(infoBanco.diaLimite);

    let mes  = fecha.getMonth();
    let anio = fecha.getFullYear();

    // REGLAS DE CORTE BANCARIO
    if (diaCompra > diaCorte) mes += 1;
    if (diaLimite < diaCorte) mes += 1;

    // El objeto Date ajusta automáticamente si el mes pasa de 11 (Diciembre) al año siguiente
    return new Date(anio, mes, diaLimite).toLocaleDateString('es-MX');
}

function calcularCalendarioMSI(fechaRef, meses, nombreBanco) {
    const config = tarjetasConfig.find(t => t.banco === nombreBanco);
    if (!config) return [];

    let cronograma = [];
    let d = new Date(fechaRef);
    
    const diaCompra = d.getDate();
    const diaCorte  = parseInt(config.diaCorte);
    const diaLimite = parseInt(config.diaLimite);
    
    let mesBase = d.getMonth();
    let anioBase = d.getFullYear();

    // REGLAS DE CORTE BANCARIO (Sincronizadas con calcularFechaPago)
    if (diaCompra > diaCorte) mesBase += 1;
    if (diaLimite < diaCorte) mesBase += 1;

    for (let i = 0; i < meses; i++) {
        // Sumamos 'i' para generar los meses subsecuentes
        let fPago = new Date(anioBase, mesBase + i, diaLimite);
        
        // Formatear a YYYY-MM-DD conservando la zona horaria local
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

// ===== MSI DASHBOARD =====
function renderDashboardMSI(bancoSeleccionado = 'Todos') {
    const contenedorBancos = document.getElementById('listaBancosMSI');
    const contenedorMeses  = document.getElementById('listaMesesMSI');
    const tituloMeses      = document.getElementById('tituloMesesMSI');
    if (!contenedorBancos || !contenedorMeses) return;

    const deudas = StorageService.get("cuentasMSI", []);

    let totalesPorBanco = {};
    let originalPorBanco = {};
    let deudaTotalGlobal = 0;
    let deudaOriginalTotal = 0;
    tarjetasConfig.forEach(t => { totalesPorBanco[t.banco] = 0; originalPorBanco[t.banco] = 0; });
    deudas.forEach(deuda => {
        if (!totalesPorBanco[deuda.banco]) totalesPorBanco[deuda.banco] = 0;
        if (!originalPorBanco[deuda.banco]) originalPorBanco[deuda.banco] = 0;
        const totalVal  = parseFloat(String(deuda.total || 0).replace(/[$,]/g, ''));
        const cuotaVal  = parseFloat(String(deuda.cuotaMensual || 0).replace(/[$,]/g, ''));
        const pagos     = parseInt(deuda.pagosRealizados || 0);
        const restante  = totalVal - (pagos * cuotaVal);
        totalesPorBanco[deuda.banco] += Math.max(0, restante);
        originalPorBanco[deuda.banco] += totalVal;
        deudaTotalGlobal += Math.max(0, restante);
        deudaOriginalTotal += totalVal;
    });

    // ── KPIs ──────────────────────────────────────────────────────────────
    const hoy = new Date();
    let mesAct  = hoy.getMonth() + 1;
    let anioAct = hoy.getFullYear();

    // ── Cronograma real: usa el calendario guardado en cada deuda ──────────
    // Antes iteraba desde el mes actual (mesAct + i), lo que ignoraba las
    // reglas de corte bancario y siempre mostraba el primer pago en el mes
    // en curso aunque realmente cayera el mes siguiente.
    let cronograma = {};
    deudas.forEach(deuda => {
        if (bancoSeleccionado !== 'Todos' && deuda.banco !== bancoSeleccionado) return;
        const cuotaVal = parseFloat(String(deuda.cuotaMensual || 0).replace(/[$,]/g, ''));
        const pagos    = parseInt(deuda.pagosRealizados || 0);
        const calendario = deuda.calendario || [];

        // Solo iteramos las cuotas aún no pagadas
        const cuotasPendientes = calendario.slice(pagos);
        cuotasPendientes.forEach(pago => {
            // pago.fecha viene como "YYYY-MM-DD" → clave "YYYY-MM"
            const clave = pago.fecha.substring(0, 7);
            if (!cronograma[clave]) cronograma[clave] = { total: 0, detalles: [] };
            cronograma[clave].total += cuotaVal;
            cronograma[clave].detalles.push(
                `<b>${deuda.banco}</b>: ${deuda.producto || 'Compra'} — Cuota ${pago.n} de ${deuda.meses} (${dinero(cuotaVal)}) | 📅 ${pago.fecha}`
            );
        });
    });

    const mesesNombre = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

    const mesesConPagos = Object.values(cronograma).filter(d => d.total > 0);
    const proximoPagoKey = Object.keys(cronograma).sort().find(k => cronograma[k].total > 0);
    const [proximoAnio, proximoMes] = proximoPagoKey ? proximoPagoKey.split('-') : ['-', '-'];
    const proximoPagoLabel = proximoPagoKey
        ? `${mesesNombre[parseInt(proximoMes)-1]} ${proximoAnio}`
        : 'Sin pagos';
    const bancosActivos = Object.keys(totalesPorBanco).filter(b => (totalesPorBanco[b] || 0) > 0).length;
    const promedioMensual = mesesConPagos.length > 0
        ? mesesConPagos.reduce((s, d) => s + d.total, 0) / mesesConPagos.length
        : 0;

    const kpisHTML = `
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px,1fr)); gap:15px; margin-bottom:25px;">
            <div style="background:#fee2e2; padding:18px; border-radius:10px; text-align:center;">
                <div style="font-size:22px; margin-bottom:4px;">💳</div>
                <small style="color:#7f1d1d; font-weight:bold; font-size:11px;">TOTAL DEUDA MSI</small>
                <div style="font-size:20px; font-weight:bold; color:#dc2626; margin-top:4px;">${dinero(deudaTotalGlobal)}</div>
            </div>
            <div style="background:#dbeafe; padding:18px; border-radius:10px; text-align:center;">
                <div style="font-size:22px; margin-bottom:4px;">📅</div>
                <small style="color:#1e3a8a; font-weight:bold; font-size:11px;">PRÓXIMO PAGO</small>
                <div style="font-size:18px; font-weight:bold; color:#1d4ed8; margin-top:4px;">${proximoPagoLabel}</div>
            </div>
            <div style="background:#d1fae5; padding:18px; border-radius:10px; text-align:center;">
                <div style="font-size:22px; margin-bottom:4px;">🏦</div>
                <small style="color:#065f46; font-weight:bold; font-size:11px;">BANCOS ACTIVOS</small>
                <div style="font-size:26px; font-weight:bold; color:#059669; margin-top:4px;">${bancosActivos}</div>
            </div>
            <div style="background:#fef3c7; padding:18px; border-radius:10px; text-align:center;">
                <div style="font-size:22px; margin-bottom:4px;">💰</div>
                <small style="color:#92400e; font-weight:bold; font-size:11px;">PROMEDIO MENSUAL</small>
                <div style="font-size:20px; font-weight:bold; color:#d97706; margin-top:4px;">${dinero(promedioMensual)}</div>
            </div>
        </div>`;

    const kpisContainer = document.getElementById('flujo-msi');
    const existingKpis = document.getElementById('msi-kpis');
    if (existingKpis) existingKpis.remove();
    const kpisEl = document.createElement('div');
    kpisEl.id = 'msi-kpis';
    kpisEl.innerHTML = kpisHTML;
    const gridMsi = kpisContainer?.querySelector('.grid-msi');
    if (gridMsi) gridMsi.before(kpisEl);

    // ── Tarjetas de bancos con barra de progreso ───────────────────────────
    let htmlBancos = `
        <div class="tarjeta-banco-msi ${bancoSeleccionado === 'Todos' ? 'activo' : ''}" onclick="renderDashboardMSI('Todos')" style="box-shadow:0 2px 6px rgba(0,0,0,0.08);">
            <span>🌍 Todos</span>
            <span style="font-weight:bold; color:#e74c3c;">${dinero(deudaTotalGlobal)}</span>
        </div>`;
    Object.keys(totalesPorBanco).forEach(banco => {
        const restante = totalesPorBanco[banco] || 0;
        const original = originalPorBanco[banco] || 0;
        const progreso = original > 0 ? Math.min(100, ((original - restante) / original) * 100).toFixed(0) : 0;
        htmlBancos += `
            <div class="tarjeta-banco-msi ${bancoSeleccionado === banco ? 'activo' : ''}" onclick="renderDashboardMSI('${banco}')" style="box-shadow:0 2px 6px rgba(0,0,0,0.08);">
                <span>🏦 ${banco}</span>
                <span style="font-weight:bold;">${dinero(restante)}</span>
                <div style="background:#e2e8f0; border-radius:4px; height:5px; margin-top:6px; width:100%;">
                    <div style="background:#3498db; height:100%; border-radius:4px; width:${progreso}%;"></div>
                </div>
                <small style="color:#718096; font-size:11px;">${progreso}% pagado</small>
            </div>`;
    });
    contenedorBancos.innerHTML = htmlBancos;

    if (tituloMeses) tituloMeses.innerText = `Proyección de Pagos (${bancoSeleccionado})`;

    const claveActual = `${anioAct}-${mesAct.toString().padStart(2, '0')}`;
    let mesNext = mesAct + 1;
    let anioNext = anioAct;
    if (mesNext > 12) { mesNext = 1; anioNext++; }
    const claveSiguiente = `${anioNext}-${mesNext.toString().padStart(2, '0')}`;

    let htmlMeses = '';
    Object.keys(cronograma).sort().forEach(clave => {
        const [anio, mes] = clave.split('-');
        const data = cronograma[clave];
        if (data.total > 0) {
            let bgColor = 'white';
            let borderColor = '#e2e8f0';
            if (clave === claveActual) { bgColor = '#fee2e2'; borderColor = '#e74c3c'; }
            else if (clave === claveSiguiente) { bgColor = '#fef3c7'; borderColor = '#f59e0b'; }

            const detallesHtml = data.detalles.map((det, idx) => {
                // Extraer la fecha de la cuota del string "... | 📅 YYYY-MM-DD"
                const fechaMatch = det.match(/📅 (\d{4}-\d{2}-\d{2})/);
                const fechaCuota = fechaMatch ? new Date(fechaMatch[1] + 'T00:00:00') : null;
                const estaVencida = fechaCuota && fechaCuota < hoy;
                const estaHoy     = fechaCuota && fechaCuota.toDateString() === hoy.toDateString();
                const claveDetalle = `conciliado_${clave}_${idx}`;
                const yaConciliado = localStorage.getItem(claveDetalle) === '1';

                // Texto limpio sin la parte de fecha (ya se muestra en el badge)
                const detTexto = det.replace(/\s*\|\s*📅 \d{4}-\d{2}-\d{2}/, '');
                const fechaLegible = fechaCuota
                    ? fechaCuota.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
                    : '';

                let bgDet = yaConciliado ? '#f0fdf4' : (estaVencida ? '#fef2f2' : (estaHoy ? '#fff7ed' : 'transparent'));
                let colorDet = yaConciliado ? '#15803d' : (estaVencida ? '#dc2626' : (estaHoy ? '#d97706' : '#374151'));
                let badgeDet = yaConciliado
                    ? `<span style="background:#d1fae5;color:#065f46;font-size:10px;padding:2px 6px;border-radius:9999px;margin-left:6px;">✅ Conciliado</span>`
                    : (estaVencida
                        ? `<span style="background:#fee2e2;color:#dc2626;font-size:10px;padding:2px 6px;border-radius:9999px;margin-left:6px;">⚠️ Vencido</span>`
                        : (estaHoy
                            ? `<span style="background:#fef3c7;color:#d97706;font-size:10px;padding:2px 6px;border-radius:9999px;margin-left:6px;">🔔 Hoy</span>`
                            : `<span style="background:#dbeafe;color:#1e40af;font-size:10px;padding:2px 6px;border-radius:9999px;margin-left:6px;">📅 ${fechaLegible}</span>`));

                return `<div class="fila-conciliacion" style="display:flex;align-items:flex-start;gap:10px;padding:8px;border-radius:6px;background:${bgDet};margin-bottom:4px;border:1px solid ${yaConciliado ? '#86efac' : (estaVencida ? '#fca5a5' : '#e2e8f0')};">
                    <input type="checkbox" ${yaConciliado ? 'checked' : ''}
                        onchange="
                            if(this.checked){ localStorage.setItem('${claveDetalle}','1'); }
                            else { localStorage.removeItem('${claveDetalle}'); }
                            renderDashboardMSI('${bancoSeleccionado}');
                        "
                        style="cursor:pointer;width:16px;height:16px;margin-top:2px;flex-shrink:0;">
                    <div style="flex:1;">
                        <span style="color:${colorDet};font-size:13px;${yaConciliado ? 'text-decoration:line-through;' : ''}">${detTexto}</span>
                        ${badgeDet}
                    </div>
                </div>`;
            }).join('');

            htmlMeses += `
                <div class="mes-msi-card" style="background:${bgColor}; border:1px solid ${borderColor}; box-shadow:0 2px 8px rgba(0,0,0,0.06);">
                    <div style="width: 100%;">
                        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #edf2f7; padding-bottom:8px; margin-bottom:8px;">
                            <strong>📅 ${mesesNombre[parseInt(mes)-1]} ${anio}</strong>
                            <span style="font-weight:bold; color:#27ae60; font-size:1.1em;">${dinero(data.total)}</span>
                        </div>
                        <div class="detalles-mes-interactivo">${detallesHtml}</div>
                    </div>
                </div>`;
        }
    });

    contenedorMeses.innerHTML = htmlMeses || '<p style="text-align:center; color:gray; padding:20px;">Sin pagos pendientes.</p>';
}

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
    cuentasMSI.forEach((c, cIdx) => {
        const porcentaje = Math.min(100, ((c.pagosRealizados || 0) / c.meses) * 100).toFixed(0);
        const pagosHechos = c.pagosRealizados || 0;
        const calendario  = c.calendario || [];
        const estaTerminado = pagosHechos >= c.meses;

        // ── Encabezado de la compra ────────────────────────────────────────────
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
                    <div style="font-size:12px; color:#9ca3af;">Compra: ${c.fechaCompra || '—'}</div>
                </div>
            </div>

            <!-- Barra de progreso -->
            <div style="padding:12px 20px; border-bottom:1px solid #f3f4f6;">
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <small style="color:#6b7280;">Progreso de pagos</small>
                    <small style="font-weight:bold; color:#1e40af;">${pagosHechos} de ${c.meses} meses (${porcentaje}%)</small>
                </div>
                <div style="background:#e2e8f0; border-radius:4px; height:8px; width:100%;">
                    <div style="background:${estaTerminado ? '#16a34a' : '#3498db'}; height:100%; border-radius:4px; width:${porcentaje}%; transition:width 0.3s;"></div>
                </div>
            </div>

            <!-- Calendario de cuotas -->
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

        if (calendario.length === 0) {
            // Si por alguna razón no tiene calendario, mostramos filas básicas
            for (let i = 0; i < c.meses; i++) {
                const pagada = i < pagosHechos;
                html += `<tr style="background:${pagada ? '#f0fdf4' : ''}">
                    <td style="padding:8px 10px; text-align:center; color:#9ca3af;">${i + 1}</td>
                    <td style="padding:8px 10px; color:#9ca3af;">Sin fecha calculada</td>
                    <td style="padding:8px 10px; text-align:right;">${dinero(c.cuotaMensual)}</td>
                    <td style="padding:8px 10px; text-align:center;">${pagada
                        ? '<span style="background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:9999px;">✅ Pagado</span>'
                        : '<span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:9999px;">⏳ Pendiente</span>'}</td>
                    <td style="padding:8px 10px;text-align:center;">—</td>
                </tr>`;
            }
        } else {
            calendario.forEach((pago, pIdx) => {
                const pagada   = pIdx < pagosHechos;
                const esSiguiente = pIdx === pagosHechos && !estaTerminado;
                const fechaPago  = new Date(pago.fecha + 'T00:00:00');
                const vencida    = !pagada && fechaPago < hoy;
                const esHoyPago  = !pagada && fechaPago.toDateString() === hoy.toDateString();
                const fechaLabel = fechaPago.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });

                let rowBg     = pagada ? '#f0fdf4' : (vencida ? '#fef2f2' : (esSiguiente ? '#fefce8' : ''));
                let estadoBadge = '';
                if (pagada) {
                    estadoBadge = '<span style="background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:9999px;font-size:11px;">✅ Pagado</span>';
                } else if (vencida) {
                    const diasAtraso = Math.floor((hoy - fechaPago) / (1000 * 60 * 60 * 24));
                    estadoBadge = `<span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:9999px;font-size:11px;">⚠️ Vencido ${diasAtraso}d</span>`;
                } else if (esHoyPago) {
                    estadoBadge = '<span style="background:#fef3c7;color:#d97706;padding:2px 8px;border-radius:9999px;font-size:11px;">🔔 Hoy</span>';
                } else if (esSiguiente) {
                    estadoBadge = '<span style="background:#fef9c3;color:#92400e;padding:2px 8px;border-radius:9999px;font-size:11px;">→ Próximo</span>';
                } else {
                    estadoBadge = '<span style="background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:9999px;font-size:11px;">⏳ Pendiente</span>';
                }

                let accionBtn = '';
                if (!pagada && (vencida || esSiguiente || esHoyPago)) {
                    accionBtn = `<button onclick="marcarPagoMSI(${c.id}, ${pIdx + 1})"
                        style="padding:4px 10px; background:#16a34a; color:white; border:none; border-radius:5px; cursor:pointer; font-size:12px; font-weight:bold;">
                        💰 Marcar pagado
                    </button>`;
                } else if (pagada && pIdx === pagosHechos - 1) {
                    // Último pago marcado: ofrecer deshacer
                    accionBtn = `<button onclick="deshacerPagoMSI(${c.id})"
                        style="padding:4px 10px; background:#9ca3af; color:white; border:none; border-radius:5px; cursor:pointer; font-size:11px;">
                        ↩ Deshacer
                    </button>`;
                }

                html += `<tr style="background:${rowBg}; border-bottom:1px solid #f3f4f6;">
                    <td style="padding:8px 10px; text-align:center; font-weight:bold; color:${vencida ? '#dc2626' : '#374151'};">${pago.n}</td>
                    <td style="padding:8px 10px; color:${vencida ? '#dc2626' : '#374151'}; font-weight:${(esSiguiente || vencida) ? 'bold' : 'normal'};">${fechaLabel}</td>
                    <td style="padding:8px 10px; text-align:right; font-weight:bold;">${dinero(c.cuotaMensual)}</td>
                    <td style="padding:8px 10px; text-align:center;">${estadoBadge}</td>
                    <td style="padding:8px 10px; text-align:center;">${accionBtn}</td>
                </tr>`;
            });
        }

        html += `       </tbody>
                </table>
                </div>
            </div>
        </div>`;
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

    // Solo permitimos marcar la cuota que sigue (la inmediata pendiente)
    if (numeroCuota !== pagosActuales + 1) {
        alert(`⚠️ Solo puedes marcar la cuota ${pagosActuales + 1} como pagada. Las anteriores deben marcarse primero.`);
        return;
    }

    // Registrar el movimiento de egreso en caja
    const movs = StorageService.get("movimientosCaja", []);
    movs.push({
        id: Date.now(),
        tipo: "egreso",
        concepto: `Pago MSI — ${deuda.banco}: ${deuda.producto || 'Compra'} (cuota ${numeroCuota}/${deuda.meses})`,
        monto: deuda.cuotaMensual,
        fecha: new Date().toISOString(),
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

// Variable global para recordar la cuenta de débito/efectivo seleccionada en el filtro
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

    movimientos.forEach(m => {
        const esIngreso = m.tipo === "ingreso" || m.tipo === "Ingreso";
        const monto = parseFloat(m.monto) || 0;
        
        // Sumar/restar a Cajas
        if (m.medioPago === "efectivo" || m.cuenta === "efectivo" || m.cuenta === "caja") {
            const idCajaAfectada = m.cuenta === "efectivo" || m.cuenta === "caja" ? "efectivo" : m.cuenta;
            if (saldosCajas[idCajaAfectada] !== undefined) {
                saldosCajas[idCajaAfectada] += esIngreso ? monto : -monto;
            } else if (saldosCajas["efectivo"] !== undefined) {
                saldosCajas["efectivo"] += esIngreso ? monto : -monto; // Fallback
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

    // Render Cajas
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

    // Render Débito
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
                    <td style="padding:10px;">${m.fecha ? m.fecha.substring(0,10) : ""}</td>
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
            const fechaStr = fechaPago.toLocaleDateString('es-MX', {day:'2-digit', month:'short'});
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

    let cuentasMSI = StorageService.get("cuentasMSI", []);
    
    // 1. Filtrar las deudas activas de este banco y ordenarlas de más vieja a más nueva
    let deudasActivas = cuentasMSI.filter(d => {
        if (d.banco !== banco) return false;
        const total = parseFloat(String(d.total || 0).replace(/[$,]/g, ''));
        const cuota = parseFloat(String(d.cuotaMensual || 0).replace(/[$,]/g, ''));
        const pagado = d.montoPagado !== undefined ? d.montoPagado : ((d.pagosRealizados || 0) * cuota);
        return pagado < total;
    });

    deudasActivas.sort((a, b) => new Date(a.fechaCompra) - new Date(b.fechaCompra));

    // 2. Aplicar el pago en cascada
    let dineroRestante = montoAbono;
    
    for (let deuda of deudasActivas) {
        if (dineroRestante <= 0) break;

        const totalDeuda = parseFloat(String(deuda.total || 0).replace(/[$,]/g, ''));
        const cuota = parseFloat(String(deuda.cuotaMensual || 0).replace(/[$,]/g, ''));
        let yaPagado = deuda.montoPagado !== undefined ? deuda.montoPagado : ((deuda.pagosRealizados || 0) * cuota);
        let saldoPendiente = totalDeuda - yaPagado;

        if (dineroRestante >= saldoPendiente) {
            // Liquida esta deuda
            deuda.montoPagado = totalDeuda;
            deuda.pagosRealizados = deuda.meses;
            dineroRestante -= saldoPendiente;
        } else {
            // Abono parcial a esta deuda
            deuda.montoPagado = yaPagado + dineroRestante;
            deuda.pagosRealizados = Math.floor(deuda.montoPagado / cuota);
            dineroRestante = 0;
        }

        // Actualizar en el arreglo original
        const idxOriginal = cuentasMSI.findIndex(c => c.id === deuda.id);
        if (idxOriginal !== -1) cuentasMSI[idxOriginal] = deuda;
    }

    StorageService.set("cuentasMSI", cuentasMSI);

    // 3. Registrar el egreso de la cuenta origen
    const movs = StorageService.get("movimientosCaja", []);
    movs.push({
        id: Date.now(),
        tipo: "egreso",
        concepto: `Pago global a Tarjeta de Crédito — ${banco}`,
        monto: montoAbono,
        fecha: new Date().toISOString(),
        cuenta: cuentaOrigen,
        etiquetaCuenta: cuentaOrigenEtiqueta,
        medioPago: cuentaOrigen === "efectivo" ? "efectivo" : "transferencia",
        referencia: `PAGO-TC-${banco}`
    });
    StorageService.set("movimientosCaja", movs);

    // Actualizar saldos físicos de caja o bancos
    if (cuentaOrigen === "efectivo") {
        let cef = StorageService.get("cuentasEfectivo", [{ id: "efectivo", nombre: "💵 Efectivo", saldo: 0 }]);
        const c = cef.find(x => x.id === "efectivo");
        if (c) { c.saldo = (Number(c.saldo) || 0) - montoAbono; StorageService.set("cuentasEfectivo", cef); }
    } else {
        let cban = StorageService.get("cuentas-bancarias", []);
        // En tu sistema, cuentaOrigen es el nombre del banco (ej. "BBVA")
        const c = cban.find(x => x.banco === cuentaOrigen || x.id === cuentaOrigen);
        if (c) { c.saldo = (Number(c.saldo) || 0) - montoAbono; StorageService.set("cuentas-bancarias", cban); }
    }

    document.querySelector('[data-modal="pago-tarjeta"]').remove();
    alert(`✅ Pago de ${dinero(montoAbono)} a la tarjeta ${banco} registrado correctamente.`);
    renderDashboardMSI();
}

window.renderCuentasBancarias = renderCuentasBancarias;
window.renderDashboardMSI = renderDashboardMSI;
window.abrirModalPagoTarjeta = abrirModalPagoTarjeta;
window.procesarPagoTarjetaGlobal = procesarPagoTarjetaGlobal;