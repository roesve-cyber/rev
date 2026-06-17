// ================================================================
// 🧠 MÓDULO MAESTRO: CUENTAS POR COBRAR (CXC) Y AUDITORÍA
// Consolidado: Motor de saldos, abonos avanzados, promesas y WhatsApp.
// ================================================================

// Helper local de formato de moneda
function _cxcDinero(v) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(v) || 0);
}

function _cxcEscHTML(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _cxcNormalizarTexto(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function _cxcFechaClave(fecha) {
    if (window.fechaClaveMX) return window.fechaClaveMX(fecha, '');
    if (!fecha) return '';
    if (fecha instanceof Date && !isNaN(fecha.getTime())) {
        const y = fecha.getFullYear();
        const m = String(fecha.getMonth() + 1).padStart(2, '0');
        const d = String(fecha.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    const raw = String(fecha).trim();
    if (!raw) return '';
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

    const mx = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (mx) return `${mx[3]}-${String(mx[2]).padStart(2, '0')}-${String(mx[1]).padStart(2, '0')}`;

    const d = new Date(raw);
    if (isNaN(d.getTime())) return '';
    return _cxcFechaClave(d);
}

function _cxcFechaCorta(fecha) {
    if (!fecha) return '-';
    const d = window.parseFechaMX ? window.parseFechaMX(fecha) : (fecha instanceof Date ? fecha : new Date(fecha));
    if (!d || isNaN(d.getTime())) return String(fecha);
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const anio = d.getFullYear();
    return `${dia}-${mes}-${anio}`;
}

function _cxcFechaVista(fecha) {
    if (window.formatearFechaVistaMX) return window.formatearFechaVistaMX(fecha, { fallback: _cxcFechaCorta(fecha) });
    return _cxcFechaCorta(fecha);
}

function _cxcFechaAbonoBase(abono) {
    return abono?.fechaAbonoIso || abono?.fechaIso || abono?.fechaAbonoRaw || abono?.fechaAbono || abono?.fecha;
}

function _cxcCuentaCancelada(cuenta) {
    return String(cuenta?.estado || cuenta?.estatus || '').toLowerCase().includes('cancel');
}

// Devuelve true si la cuenta esta marcada como incobrable.
// Las cuentas incobrables se excluyen de proyecciones y cobranza automatica
// pero conservan su saldo e historial completo.
function _cxcEsIncobrable(cuenta) {
    return cuenta?.incobrable === true;
}

function _cxcTotalCreditoCuenta(cuenta, estadoCta = null) {
    const estado = estadoCta || (cuenta?.folio ? window._calcularEstadoCuenta?.(cuenta.folio) : null);
    const pagares = estado?.pagares || [];
    const totalPagares = pagares
        .filter(p => String(p.estado || '').toLowerCase() !== 'cancelado')
        .reduce((s, p) => s + Number(p.monto || 0), 0);
    const saldoMasAbonos = Number(estado?.saldoTotal || 0) + Number(estado?.totalAbonado || 0);
    return Math.max(
        totalPagares,
        saldoMasAbonos,
        Number(cuenta?.totalCredito || cuenta?.totalFinanciado || cuenta?.saldoOriginal || cuenta?.saldoActual || 0)
    );
}

function _cxcFechaVentaDate(cuenta) {
    const raw = cuenta?.fechaVenta || cuenta?.fecha || cuenta?.fechaIso || cuenta?.fechaVentaIso || '';
    let d = null;
    if (raw && window.parseFechaMXOrNull) d = window.parseFechaMXOrNull(raw);
    if (!d && raw && window.parseFechaMX) d = window.parseFechaMX(raw);
    if (!d || isNaN(d.getTime())) {
        const s = String(raw || '').trim();
        if (s.includes('T')) d = new Date(s);
        else if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) {
            const p = s.split('/');
            d = new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]), 12, 0, 0);
        } else if (s) d = new Date(s);
    }
    return d && !isNaN(d.getTime()) ? d : new Date();
}

function _cxcFechaFinalCredito(cuenta, estadoCta = null) {
    const raw = cuenta?.fechaFinalPago || cuenta?.fechaFinalCredito || cuenta?.fechaFinCredito || cuenta?.fechaLiquidacionLimite || '';
    let d = null;
    if (raw && window.parseFechaMXOrNull) d = window.parseFechaMXOrNull(raw);
    if (!d && raw && window.parseFechaMX) d = window.parseFechaMX(raw);
    if ((!d || isNaN(d.getTime())) && raw) d = new Date(raw);
    if (d && !isNaN(d.getTime())) return d;

    const mesesPlan = Number(cuenta?.plan?.meses || cuenta?.plazoMeses || cuenta?.meses || 0);
    if (mesesPlan > 0) {
        const base = _cxcFechaVentaDate(cuenta);
        const fin = new Date(base.getFullYear(), base.getMonth() + mesesPlan, base.getDate(), 23, 59, 59);
        if (!isNaN(fin.getTime())) return fin;
    }

    const pagares = estadoCta?.pagares || StorageService.get("pagaresSistema", []).filter(p => p.folio === cuenta?.folio);
    const fechas = pagares
        .map(p => new Date(p.fechaVencimiento))
        .filter(f => !isNaN(f.getTime()))
        .sort((a, b) => b - a);
    return fechas[0] || null;
}

function _cxcRedondearMoratorio(monto) {
    const n = Number(monto || 0);
    if (n <= 0) return 0;
    return Math.ceil(n / 10) * 10;
}

function _cxcMoratoriosVigentes(cuenta) {
    return (cuenta?.cargosMoratorios || []).filter(m => !m.cancelado && !m.anulado);
}

function _cxcMoratoriosPendientes(cuenta) {
    return _cxcMoratoriosVigentes(cuenta)
        .filter(m => String(m.tipo || 'cargo') !== 'exencion')
        .map(m => {
            const monto = Number(m.monto || 0);
            const abonado = Number(m.montoAbonado || 0);
            return { ...m, pendiente: Math.max(0, monto - abonado) };
        })
        .filter(m => m.pendiente > 0.01);
}

function _cxcTotalMoratoriosPendientes(cuenta) {
    return _cxcMoratoriosPendientes(cuenta).reduce((s, m) => s + Number(m.pendiente || 0), 0);
}

function _cxcMesesMoratorioRegistrados(cuenta) {
    return _cxcMoratoriosVigentes(cuenta).reduce((s, m) => s + Math.max(1, Number(m.mesesCubiertos || 1)), 0);
}

function _cxcEvaluarMoratorio(cuenta, estadoCta = null) {
    if (!cuenta || _cxcCuentaCancelada(cuenta) || _cxcEsIncobrable(cuenta)) return null;
    const estado = estadoCta || (cuenta.folio ? window._calcularEstadoCuenta?.(cuenta.folio) : null);
    const saldo = Number(estado?.saldoTotal ?? cuenta.saldoActual ?? 0);
    const fechaFinal = _cxcFechaFinalCredito(cuenta, estado);
    if (!fechaFinal || isNaN(fechaFinal.getTime()) || saldo <= 0.01) {
        return { aplica: false, saldo, fechaFinal, diasVencidos: 0, mesesVencidos: 0, mesesPendientes: 0, montoSugerido: 0 };
    }

    const hoy = new Date();
    const diasVencidos = Math.floor((hoy - fechaFinal) / 86400000);
    if (diasVencidos <= 0) {
        return { aplica: false, saldo, fechaFinal, diasVencidos: 0, mesesVencidos: 0, mesesPendientes: 0, montoSugerido: 0 };
    }

    const mesesVencidos = Math.max(1, Math.ceil(diasVencidos / 30.44));
    const mesesRegistrados = _cxcMesesMoratorioRegistrados(cuenta);
    const mesesPendientes = Math.max(0, mesesVencidos - mesesRegistrados);
    const montoSugerido = _cxcRedondearMoratorio(saldo * 0.02 * mesesPendientes);
    return {
        aplica: mesesPendientes > 0 && montoSugerido > 0,
        saldo,
        fechaFinal,
        diasVencidos,
        mesesVencidos,
        mesesRegistrados,
        mesesPendientes,
        montoSugerido,
        tasaMensual: 2
    };
}

function _cxcAplicarPagoAMoratorios(cuenta, montoDisponible) {
    let restante = Number(montoDisponible || 0);
    if (!cuenta || restante <= 0.01) return restante;
    cuenta.cargosMoratorios = cuenta.cargosMoratorios || [];
    cuenta.cargosMoratorios = cuenta.cargosMoratorios.map(m => {
        if (restante <= 0.01 || m.cancelado || m.anulado || String(m.tipo || 'cargo') === 'exencion') return m;
        const pendiente = Math.max(0, Number(m.monto || 0) - Number(m.montoAbonado || 0));
        if (pendiente <= 0.01) return m;
        const aplicado = Math.min(restante, pendiente);
        restante -= aplicado;
        const nuevoAbonado = Number(m.montoAbonado || 0) + aplicado;
        return {
            ...m,
            montoAbonado: nuevoAbonado,
            estado: nuevoAbonado >= Number(m.monto || 0) - 0.01 ? "Pagado" : "Parcial"
        };
    });
    return restante;
}

function _cxcImporteContadoCuenta(cuenta) {
    const articulos = Array.isArray(cuenta?.articulos) ? cuenta.articulos : [];
    const desdeArticulos = articulos.reduce((s, a) => {
        const precio = Number(a.precioContado || a.precio || 0);
        const cantidad = Number(a.cantidad || 1);
        return s + (precio * cantidad);
    }, 0);
    if (desdeArticulos > 0) return desdeArticulos;
    if (Number(cuenta?.totalContadoOriginal || 0) > 0) return Number(cuenta.totalContadoOriginal);
    if (Number(cuenta?.totalMercancia || 0) > 0) return Number(cuenta.totalMercancia);
    return 0;
}

function _cxcTotalPagadoPolitica(folio, cuenta = null) {
    const pagares = StorageService.get("pagaresSistema", []).filter(p => p.folio === folio);
    const desdePagares = pagares.reduce((s, p) => {
        const estado = String(p.estado || '').toLowerCase();
        if (estado === 'cancelado') return s;
        if (estado === 'pagado') return s + Number(p.montoAbonado || p.monto || 0);
        if (estado === 'parcial') return s + Number(p.montoAbonado || 0);
        return s;
    }, 0);
    const desdeAbonos = (cuenta?.abonos || [])
        .filter(a => !a.cancelado && !a.canceladoPorVenta && !a.canceladoPorApartado)
        .reduce((s, a) => s + Number(a.monto || a.montoAbonado || 0), 0);
    return Math.max(desdePagares, desdeAbonos);
}

function _cxcEvaluarPoliticaPagoAnticipado(folio, montoAbono = 0) {
    const cuenta = StorageService.get("cuentasPorCobrar", []).find(c => c.folio === folio);
    if (!cuenta) return null;

    const estado = typeof window._calcularEstadoCuenta === 'function' ? window._calcularEstadoCuenta(folio) : null;
    const saldoActual = Number(estado?.saldoTotal ?? cuenta.saldoActual ?? 0);
    const enganche = Number(cuenta.engancheRecibido || cuenta.enganche || 0);
    const totalContado = _cxcImporteContadoCuenta(cuenta);
    const capitalContado = Math.max(0, totalContado - enganche);
    const totalPagado = _cxcTotalPagadoPolitica(folio, cuenta);
    const fechaVentaDate = _cxcFechaVentaDate(cuenta);
    const diasDesdeVenta = Math.max(0, Math.floor((new Date() - fechaVentaDate) / 86400000));
    const mesActualVenta = Math.max(1, Math.floor(diasDesdeVenta / 30.44) + 1);
    const periodicidad = cuenta.periodicidad || "semanal";

    const base = {
        cuenta,
        saldoActual,
        enganche,
        totalContado,
        capitalContado,
        totalPagado,
        diasDesdeVenta,
        mesActualVenta,
        periodicidad,
        montoAbono: Number(montoAbono || 0),
        aplica: false,
        liquidaria: false,
        beneficio: 0,
        montoLiquidacion: Math.max(0, saldoActual),
        faltante: Math.max(0, saldoActual - Number(montoAbono || 0)),
        tipo: 'saldo',
        mensaje: 'Debe liquidar el saldo total vigente.'
    };

    if (saldoActual <= 0.01) return { ...base, liquidaria: true, faltante: 0, mensaje: 'La cuenta ya esta liquidada.' };

    if (diasDesdeVenta <= 30) {
        const montoLiquidacion = Math.max(0, capitalContado - totalPagado);
        const beneficio = Math.max(0, saldoActual - montoLiquidacion);
        const liquidaria = base.montoAbono >= montoLiquidacion - 0.01;
        return {
            ...base,
            aplica: montoLiquidacion > 0,
            liquidaria,
            beneficio,
            montoLiquidacion,
            faltante: Math.max(0, montoLiquidacion - base.montoAbono),
            tipo: 'contado_30',
            mensaje: 'Periodo de gracia: puede liquidar al precio de contado sin intereses.'
        };
    }

    const planes = (typeof CalculatorService !== 'undefined' && CalculatorService.calcularCreditoConPeriodicidad)
        ? CalculatorService.calcularCreditoConPeriodicidad(capitalContado, periodicidad)
        : [];
    const planAplicable = [...planes]
        .filter(p => Number(p.meses || 0) >= mesActualVenta)
        .filter(p => Number(p.total || 0) > totalPagado)
        .sort((a, b) => Number(a.meses || 0) - Number(b.meses || 0))[0] || null;

    if (!planAplicable) {
        const liquidaria = base.montoAbono >= saldoActual - 0.01;
        return {
            ...base,
            liquidaria,
            faltante: Math.max(0, saldoActual - base.montoAbono),
            mensaje: 'Sin plan anticipado disponible para la antiguedad actual; se liquida con saldo vigente.'
        };
    }

    const montoLiquidacion = Math.max(0, Number(planAplicable.total || 0) - totalPagado);
    const beneficio = Math.max(0, saldoActual - montoLiquidacion);
    const liquidaria = base.montoAbono >= montoLiquidacion - 0.01;
    return {
        ...base,
        aplica: montoLiquidacion > 0,
        liquidaria,
        beneficio,
        montoLiquidacion,
        faltante: Math.max(0, montoLiquidacion - base.montoAbono),
        tipo: 'plan_anticipado',
        plan: planAplicable,
        mensaje: `Periodo de contado vencido. Plan anticipado aplicable: ${planAplicable.meses} meses.`
    };
}

function _cxcResumenPoliticaPagoAnticipado(politica, esDirecto = false) {
    if (!politica) {
        return {
            titulo: "Politica de pago anticipado",
            detalle: "No se pudo evaluar la politica para esta cuenta.",
            nota: ""
        };
    }

    const modoTxt = esDirecto
        ? "Aplica tambien en Abono Directo: si el monto captura una liquidacion por politica, se ingresara a caja el monto correcto de politica."
        : "Aplica tambien al enviar a Boveda: Auditoria autorizara el monto correcto de politica, no solo el saldo visible.";
    const beneficioTxt = politica.beneficio > 0.01
        ? ` Beneficio para el cliente: ${_cxcDinero(politica.beneficio)}.`
        : "";

    if (politica.tipo === "contado_30") {
        return {
            titulo: "Politica de pago anticipado: precio de contado",
            detalle: `Esta cuenta esta dentro de los primeros 30 dias. Puede liquidarse descontando intereses y cobrando solo el pendiente a precio de contado: ${_cxcDinero(politica.montoLiquidacion)}.${beneficioTxt}`,
            nota: modoTxt
        };
    }

    if (politica.tipo === "plan_anticipado") {
        const meses = politica.plan?.meses || politica.mesActualVenta || "-";
        return {
            titulo: `Politica de pago anticipado: plan ${meses} meses`,
            detalle: `Ya vencio el periodo de contado. Si el cliente liquida anticipadamente, el sistema cobra el plan aplicable a la antiguedad de la venta: ${_cxcDinero(politica.montoLiquidacion)}.${beneficioTxt}`,
            nota: modoTxt
        };
    }

    return {
        titulo: "Politica de pago anticipado: saldo vigente",
        detalle: `No hay descuento anticipado disponible para esta cuenta. Para liquidar debe cubrir el saldo vigente: ${_cxcDinero(politica.saldoActual)}.`,
        nota: modoTxt
    };
}

// ==========================================
// 1. MOTOR CENTRAL DE SALDOS
// ==========================================
window._calcularEstadoCuenta = function(folio) {
    const cuentas = StorageService.get("cuentasPorCobrar", []);
    const pagares = StorageService.get("pagaresSistema", []);
    const cuenta = cuentas.find(c => c.folio === folio);
    
    if (!cuenta) return null;
    if (_cxcCuentaCancelada(cuenta)) {
        const totalAbonadoCancelado = (cuenta.abonos || []).reduce((sum, a) => sum + (a.monto || 0), 0);
        return {
            cuenta,
            pagares: [],
            pagaresPendientes: [],
            pagaresVencidos: [],
            saldoTotal: 0,
            montoVencido: 0,
            diasMaxAtraso: 0,
            estadoGeneral: "Cancelado",
            promesaVigente: false,
            totalAbonado: totalAbonadoCancelado
        };
    }

    const hoy = new Date();
    const pagaresDelFolio = pagares.filter(p => p.folio === folio).sort((a, b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento));
    
    let saldoTotal = 0;
    let pagaresPendientes = [];
    let pagaresVencidos = [];
    let montoVencido = 0;
    let diasMaxAtraso = 0;

    pagaresDelFolio.forEach(p => {
        if (p.estado === "Pendiente" || p.estado === "Parcial") {
            pagaresPendientes.push(p);
            const restante = (p.estado === "Parcial") ? Math.max(0, (p.monto || 0) - (p.montoAbonado || 0)) : (p.monto || 0);
            saldoTotal += restante;

            const fechaVenc = new Date(p.fechaVencimiento);
            if (fechaVenc < hoy) {
                pagaresVencidos.push(p);
                montoVencido += restante;
                const atraso = Math.floor((hoy - fechaVenc) / (1000 * 60 * 60 * 24));
                if (atraso > diasMaxAtraso) diasMaxAtraso = atraso;
            }
        }
    });

    const abonos = (cuenta.abonos || []).filter(a => !a.cancelado && !a.canceladoPorVenta && !a.canceladoPorApartado);
    const totalAbonado = abonos.reduce((sum, a) => sum + (a.monto || 0), 0);
    const moratoriosPendientes = _cxcMoratoriosPendientes(cuenta);
    const saldoMoratorios = moratoriosPendientes.reduce((sum, m) => sum + Number(m.pendiente || 0), 0);
    if (saldoMoratorios > 0.01) saldoTotal += saldoMoratorios;

    let estadoGeneral = "Activo";
    let promesaVigente = false;

    if (cuenta.estado === "Saldado" || saldoTotal <= 0.01) {
        estadoGeneral = "Saldado";
        saldoTotal = 0;
    } else {
        if (cuenta.promesaPago && cuenta.promesaPago.fecha) {
            const fechaPromObj = new Date(cuenta.promesaPago.fecha + "T23:59:59");
            if (fechaPromObj >= hoy) promesaVigente = true;
        }

        if (promesaVigente) estadoGeneral = "Promesa";
        else if (pagaresVencidos.length === 0) estadoGeneral = "Al corriente";
        else if (pagaresVencidos.length <= 2) estadoGeneral = "Atrasado";
        else estadoGeneral = "Crítico";
    }

    return { cuenta, pagares: pagaresDelFolio, pagaresPendientes, pagaresVencidos, saldoTotal, montoVencido, diasMaxAtraso, estadoGeneral, promesaVigente, totalAbonado, moratoriosPendientes, saldoMoratorios };
};

// ==========================================
// 2. RENDERIZADO DE TABLA (CON PESTAÑAS)
// ==========================================
window._pestanaCobranzaActiva = 'todas';

function renderCuentasXCobrar(filtroCliente = "") {
    const contenedor = document.getElementById("tablaCuentasXCobrar");
    if (!contenedor) return;
    if (!['todas', 'al_corriente', 'morosos', 'promesas'].includes(window._pestanaCobranzaActiva)) {
        window._pestanaCobranzaActiva = 'todas';
    }

    filtroCliente = (filtroCliente || document.getElementById("filtroClienteCobranza")?.value || "").trim().toLowerCase();
    
    const cuentas = StorageService.get("cuentasPorCobrar", []).filter(c => !_cxcCuentaCancelada(c) && !_cxcEsIncobrable(c));

    if (cuentas.length === 0) {
        contenedor.innerHTML = `<div style="background:#f0fdf4; padding:40px; text-align:center; border-radius:10px;"><p style="font-size:18px; color:#27ae60; font-weight:bold;">✅ ¡No hay cuentas registradas!</p></div>`;
        return;
    }
    let htmlTabs = `
    <div style="display: flex; gap: 10px; margin-bottom: 20px; overflow-x: auto; padding-bottom: 5px;">
        ${['todas', 'al_corriente', 'morosos', 'promesas'].map(p => {
            const labels = {todas:'🏠 Todas', al_corriente:'✅ Al Corriente', morosos:'🔴 Morosos', promesas:'📝 Promesas'};
            const bg = window._pestanaCobranzaActiva === p ? '#1e40af' : '#f3f4f6';
            const col = window._pestanaCobranzaActiva === p ? 'white' : '#4b5563';
            return `<button onclick="cambiarPestanaCobranza('${p}')" style="flex:1; min-width:120px; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer; border:none; background:${bg}; color:${col};">${labels[p]}</button>`;
        }).join('')}
    </div>`;

    let htmlTabla = `<div style="overflow-x:auto;"><table class="tabla-admin">
        <thead><tr><th>Cliente / Folio</th><th>Fecha Venta</th><th>Total Venta</th><th>Saldo Actual</th><th>Pagarés</th><th>Estatus</th><th>Acciones</th></tr></thead>
        <tbody>`;

    let cuentasMostradas = 0;

    cuentas.forEach(c => {
        const estadoCta = window._calcularEstadoCuenta(c.folio);
        if(!estadoCta) return;
        if (estadoCta.estadoGeneral === "Saldado") return;

        let mostrar = false;
        switch (window._pestanaCobranzaActiva) {
            case 'todas': mostrar = estadoCta.estadoGeneral !== "Saldado"; break;
            case 'al_corriente': mostrar = estadoCta.estadoGeneral === "Al corriente"; break;
            case 'morosos': mostrar = (estadoCta.estadoGeneral === "Atrasado" || estadoCta.estadoGeneral === "Crítico"); break;
            case 'promesas': mostrar = estadoCta.estadoGeneral === "Promesa"; break;
        }

        if (!mostrar) return;
        const filtroEstado = document.getElementById("filtroEstadoCobranza")?.value || "";
        if (filtroEstado && estadoCta.estadoGeneral !== filtroEstado) return;
        const nombreCliente = c.nombre || c.clienteNombre || 'Cliente';
        const stringBusqueda = `${nombreCliente} ${c.folio || ''}`.toLowerCase();
        if (filtroCliente && !stringBusqueda.includes(filtroCliente)) return;

        cuentasMostradas++;
        const textoPromesa = estadoCta.promesaVigente ? `<br><span style="color:#d97706; font-size:11px; font-weight:bold;">📝 Promesa: ${_cxcFechaVista(c.promesaPago.fecha)}</span>` : '';
        const moratorio = _cxcEvaluarMoratorio(c, estadoCta);
        const textoMoratorio = estadoCta.saldoMoratorios > 0.01
            ? `<br><small style="color:#7f1d1d; font-weight:800;">Moratorios pendientes: ${_cxcDinero(estadoCta.saldoMoratorios)}</small>`
            : (moratorio?.aplica ? `<br><small style="color:#b45309; font-weight:800;">Moratorio sugerido: ${_cxcDinero(moratorio.montoSugerido)}</small>` : '');
        const accionesMoratorio = moratorio?.aplica ? `
                    <button onclick="abrirModalMoratorio('${_cxcEscHTML(c.folio)}')" style="padding:6px 9px; background:#7f1d1d; color:white; border:none; border-radius:4px; cursor:pointer; font-size:12px; font-weight:700;" title="Aplicar moratorio manual">Moratorio</button>
                    <button onclick="exentarMoratorio('${_cxcEscHTML(c.folio)}')" style="padding:6px 9px; background:#64748b; color:white; border:none; border-radius:4px; cursor:pointer; font-size:12px; font-weight:700;" title="Exentar moratorio sugerido">Exentar</button>` : '';

        htmlTabla += `<tr>
            <td><strong>${nombreCliente}</strong><br><small style="color:#718096;">${c.folio}</small></td>
            <td>${c.fechaVenta ? _cxcFechaVista(c.fechaVenta) : '-'}</td>
            <td>${_cxcDinero(c.totalContadoOriginal ?? 0)}</td>
            <td style="font-weight:bold; color:${estadoCta.saldoTotal > 0 ? '#dc2626' : '#9ca3af'};">${_cxcDinero(estadoCta.saldoTotal)}${textoMoratorio}</td>
            <td>${estadoCta.pagaresPendientes.length} pendiente(s)${textoPromesa}</td>
            <td>${c.metodo === "apartado" ? "📦 Apartado" : "💳 Crédito"}</td>
            <td>
                <div style="display:flex; gap:5px; flex-wrap:wrap;">
                    <button onclick="abrirModalAbonoAvanzado('${c.folio}')" style="padding:6px 9px; background:#27ae60; color:white; border:none; border-radius:4px; cursor:pointer; font-size:12px; font-weight:700;" title="Registrar abono">💰 Abonar</button>
                    ${accionesMoratorio}
                    <button onclick="abrirModalPromesaPago('${c.folio}')" style="padding:6px 9px; background:#f59e0b; color:white; border:none; border-radius:4px; cursor:pointer; font-size:12px; font-weight:700;" title="Registrar promesa de pago">📝 Promesa</button>
                    <button onclick="enviarRecordatorioWhatsApp('${c.folio}')" style="padding:6px 9px; background:#25D366; color:white; border:none; border-radius:4px; cursor:pointer; font-size:12px; font-weight:700;" title="Enviar recordatorio por WhatsApp">💬 WhatsApp</button>
                </div>
            </td>
        </tr>`;
    });

    contenedor.innerHTML = htmlTabs + (cuentasMostradas === 0 ? `<p style="text-align:center; padding:20px;">Sin resultados.</p>` : htmlTabla + `</tbody></table></div>`);
}

function renderAbonosDirectos(filtroCliente = "") {
    const contenedor = document.getElementById("tablaAbonosDirectos");
    if (!contenedor) return;

    filtroCliente = (filtroCliente || document.getElementById("filtroClienteAbonoDirecto")?.value || "").trim().toLowerCase();
    const cuentas = StorageService.get("cuentasPorCobrar", []).filter(c => !_cxcCuentaCancelada(c) && !_cxcEsIncobrable(c));
    const filas = cuentas
        .map(cuenta => ({ cuenta, estado: window._calcularEstadoCuenta(cuenta.folio) }))
        .filter(x => x.estado && x.estado.saldoTotal > 0.01)
        .filter(x => {
            const texto = `${x.cuenta.nombre || x.cuenta.clienteNombre || ''} ${x.cuenta.folio || ''}`.toLowerCase();
            return !filtroCliente || texto.includes(filtroCliente);
        })
        .sort((a, b) => String(a.cuenta.nombre || a.cuenta.clienteNombre || '').localeCompare(String(b.cuenta.nombre || b.cuenta.clienteNombre || ''), 'es'));

    contenedor.innerHTML = `
        ${filas.length === 0 ? `<div style="background:#f8fafc; border:1px solid #e2e8f0; padding:28px; border-radius:10px; text-align:center; color:#64748b; margin-bottom:16px;">Sin cuentas con saldo para abono directo.</div>` : `
        <div style="overflow-x:auto; background:white; border:1px solid #e5e7eb; border-radius:10px; margin-bottom:18px;">
            <table class="tabla-admin" style="margin:0;">
                <thead>
                    <tr>
                        <th>Cliente / Folio</th>
                        <th>Saldo</th>
                        <th>Pagares</th>
                        <th>Estado</th>
                        <th style="text-align:right;">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${filas.map(({ cuenta, estado }) => {
                        const moratorio = _cxcEvaluarMoratorio(cuenta, estado);
                        const avisoMoratorio = estado.saldoMoratorios > 0.01
                            ? `<br><small style="display:inline-block; margin-top:4px; color:#7f1d1d; font-weight:800;">Moratorios pendientes: ${_cxcDinero(estado.saldoMoratorios)}</small>`
                            : (moratorio?.aplica ? `<br><small style="display:inline-block; margin-top:4px; color:#b45309; font-weight:800;">Moratorio sugerido: ${_cxcDinero(moratorio.montoSugerido)}</small>` : '');
                        const accionesMoratorio = moratorio?.aplica ? `
                                    <button onclick="abrirModalMoratorio('${_cxcEscHTML(cuenta.folio)}')" style="padding:9px 13px; border:none; border-radius:7px; background:#7f1d1d; color:white; font-weight:bold; cursor:pointer;">Moratorio</button>
                                    <button onclick="exentarMoratorio('${_cxcEscHTML(cuenta.folio)}')" style="padding:9px 13px; border:none; border-radius:7px; background:#64748b; color:white; font-weight:bold; cursor:pointer;">Exentar</button>` : '';
                        return `
                        <tr>
                            <td><strong>${_cxcEscHTML(cuenta.nombre || cuenta.clienteNombre || 'Cliente')}</strong><br><small style="color:#64748b;">${_cxcEscHTML(cuenta.folio)}</small></td>
                            <td style="font-weight:800; color:#dc2626;">${_cxcDinero(estado.saldoTotal)}${avisoMoratorio}</td>
                            <td>${estado.pagaresPendientes.length} pendiente(s)</td>
                            <td><span style="display:inline-block; padding:4px 9px; border-radius:999px; background:${estado.estadoGeneral === 'Al corriente' ? '#dcfce7' : '#fee2e2'}; color:${estado.estadoGeneral === 'Al corriente' ? '#166534' : '#991b1b'}; font-weight:bold; font-size:12px;">${_cxcEscHTML(estado.estadoGeneral)}</span></td>
                            <td style="text-align:right;">
                                <div style="display:flex; justify-content:flex-end; gap:6px; flex-wrap:wrap;">
                                    ${accionesMoratorio}
                                    <button onclick="abrirModalAbonoAvanzado('${_cxcEscHTML(cuenta.folio)}', { modo: 'directo' })" style="padding:9px 13px; border:none; border-radius:7px; background:#0f766e; color:white; font-weight:bold; cursor:pointer;">Aplicar</button>
                                    <button onclick="marcarIncobrable('${_cxcEscHTML(cuenta.folio)}')" style="padding:9px 13px; border:none; border-radius:7px; background:#475569; color:white; font-weight:bold; cursor:pointer;">Incobrable</button>
                                </div>
                            </td>
                        </tr>
                    `;
                    }).join('')}
                </tbody>
            </table>
        </div>`}
        <div style="margin-top:18px;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:10px;">
                <h3 style="margin:0; color:#991b1b; font-size:18px;">Cuentas incobrables</h3>
                <button onclick="renderAbonosDirectos()" style="padding:8px 12px; border:none; border-radius:7px; background:#e2e8f0; color:#334155; font-weight:bold; cursor:pointer;">Actualizar lista</button>
            </div>
            <div id="tablaIncobrables"></div>
        </div>`;
    renderCuentasIncobrables();
}

function abrirModalMoratorio(folio) {
    const cuentas = StorageService.get("cuentasPorCobrar", []);
    const cuenta = cuentas.find(c => c.folio === folio);
    if (!cuenta) return alert("Cuenta no encontrada.");
    const estado = window._calcularEstadoCuenta(folio);
    const moratorio = _cxcEvaluarMoratorio(cuenta, estado);
    if (!moratorio?.aplica) return alert("Esta cuenta no tiene moratorio pendiente de aplicar.");

    document.querySelector('[data-modal="moratorio-manual"]')?.remove();
    const html = `
        <div data-modal="moratorio-manual" style="position:fixed; inset:0; background:rgba(15,23,42,0.72); z-index:7000; display:flex; align-items:center; justify-content:center; padding:18px;">
            <div style="background:white; width:100%; max-width:460px; border-radius:12px; overflow:hidden; box-shadow:0 24px 60px rgba(15,23,42,0.35);">
                <div style="padding:18px 22px; border-bottom:1px solid #e5e7eb; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; color:#7f1d1d;">Aplicar moratorio</h3>
                    <button onclick="document.querySelector('[data-modal=&quot;moratorio-manual&quot;]')?.remove()" style="border:none; background:white; color:#64748b; font-size:22px; cursor:pointer;">x</button>
                </div>
                <div style="padding:22px;">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px;">
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px;">
                            <small style="color:#64748b; font-weight:800;">Saldo base</small>
                            <div style="font-size:20px; font-weight:900; color:#0f172a;">${_cxcDinero(moratorio.saldo)}</div>
                        </div>
                        <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:10px;">
                            <small style="color:#991b1b; font-weight:800;">Sugerido</small>
                            <div style="font-size:20px; font-weight:900; color:#7f1d1d;">${_cxcDinero(moratorio.montoSugerido)}</div>
                        </div>
                    </div>
                    <div style="font-size:13px; color:#334155; line-height:1.45; margin-bottom:16px;">
                        Fecha final: <b>${_cxcFechaVista(moratorio.fechaFinal)}</b><br>
                        Vencimiento: <b>${moratorio.diasVencidos}</b> dia(s), <b>${moratorio.mesesPendientes}</b> mes(es) pendiente(s).<br>
                        Regla: <b>2% mensual sobre saldo</b>, redondeado a multiplos de 10.
                    </div>
                    <label style="display:block; font-size:12px; color:#475569; font-weight:800; margin-bottom:5px;">Monto a cargar</label>
                    <input id="moratorioMontoInput" type="number" min="0" step="10" value="${moratorio.montoSugerido}" style="width:100%; box-sizing:border-box; padding:12px; border:2px solid #dc2626; border-radius:8px; font-size:18px; font-weight:800; margin-bottom:12px;">
                    <label style="display:block; font-size:12px; color:#475569; font-weight:800; margin-bottom:5px;">Nota obligatoria</label>
                    <textarea id="moratorioNotaInput" rows="3" placeholder="Ej. Se aplica moratorio por vencimiento final del credito." style="width:100%; box-sizing:border-box; padding:10px; border:1px solid #cbd5e1; border-radius:8px; resize:vertical; margin-bottom:18px;"></textarea>
                    <div style="display:flex; gap:10px;">
                        <button onclick="aplicarMoratorioManual('${_cxcEscHTML(folio)}')" style="flex:2; padding:12px; border:none; border-radius:8px; background:#7f1d1d; color:white; font-weight:900; cursor:pointer;">Aplicar cargo</button>
                        <button onclick="document.querySelector('[data-modal=&quot;moratorio-manual&quot;]')?.remove()" style="flex:1; padding:12px; border:none; border-radius:8px; background:#e2e8f0; color:#334155; font-weight:800; cursor:pointer;">Cancelar</button>
                    </div>
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

function aplicarMoratorioManual(folio) {
    const monto = Number(document.getElementById("moratorioMontoInput")?.value || 0);
    const nota = String(document.getElementById("moratorioNotaInput")?.value || '').trim();
    if (monto <= 0) return alert("Ingresa un monto de moratorio mayor a cero.");
    if (!nota) return alert("La nota es obligatoria para aplicar un moratorio.");

    const cuentas = StorageService.get("cuentasPorCobrar", []);
    const idx = cuentas.findIndex(c => c.folio === folio);
    if (idx === -1) return alert("Cuenta no encontrada.");
    const estado = window._calcularEstadoCuenta(folio);
    const moratorio = _cxcEvaluarMoratorio(cuentas[idx], estado);
    if (!moratorio?.aplica) return alert("Esta cuenta ya no tiene moratorio pendiente de aplicar.");

    cuentas[idx].cargosMoratorios = cuentas[idx].cargosMoratorios || [];
    cuentas[idx].cargosMoratorios.push({
        id: `MOR-${Date.now()}`,
        tipo: "cargo",
        estado: "Pendiente",
        fecha: window.localISO ? window.localISO(new Date()) : new Date().toISOString(),
        monto,
        montoAbonado: 0,
        tasaMensual: 2,
        saldoBase: moratorio.saldo,
        fechaFinalCredito: window.localISO ? window.localISO(moratorio.fechaFinal) : moratorio.fechaFinal.toISOString(),
        diasVencidos: moratorio.diasVencidos,
        mesesCubiertos: moratorio.mesesPendientes,
        nota
    });
    StorageService.set("cuentasPorCobrar", cuentas);

    const actualizadas = StorageService.get("cuentasPorCobrar", []);
    const idxAct = actualizadas.findIndex(c => c.folio === folio);
    if (idxAct !== -1) {
        const estadoAct = window._calcularEstadoCuenta(folio);
        actualizadas[idxAct].saldoActual = Number(estadoAct?.saldoTotal || actualizadas[idxAct].saldoActual || 0);
        StorageService.set("cuentasPorCobrar", actualizadas);
    }

    document.querySelector('[data-modal="moratorio-manual"]')?.remove();
    if (typeof renderCuentasXCobrar === 'function') renderCuentasXCobrar();
    if (typeof renderAbonosDirectos === 'function') renderAbonosDirectos();
    alert("Moratorio aplicado al saldo de la cuenta.");
}

function exentarMoratorio(folio) {
    const nota = prompt("Motivo de exencion del moratorio:");
    if (nota === null) return;
    if (!String(nota).trim()) return alert("La nota es obligatoria para exentar un moratorio.");

    const cuentas = StorageService.get("cuentasPorCobrar", []);
    const idx = cuentas.findIndex(c => c.folio === folio);
    if (idx === -1) return alert("Cuenta no encontrada.");
    const estado = window._calcularEstadoCuenta(folio);
    const moratorio = _cxcEvaluarMoratorio(cuentas[idx], estado);
    if (!moratorio?.aplica) return alert("Esta cuenta no tiene moratorio pendiente de exentar.");

    cuentas[idx].cargosMoratorios = cuentas[idx].cargosMoratorios || [];
    cuentas[idx].cargosMoratorios.push({
        id: `MOR-EX-${Date.now()}`,
        tipo: "exencion",
        estado: "Exentado",
        fecha: window.localISO ? window.localISO(new Date()) : new Date().toISOString(),
        monto: 0,
        montoAbonado: 0,
        tasaMensual: 2,
        saldoBase: moratorio.saldo,
        fechaFinalCredito: window.localISO ? window.localISO(moratorio.fechaFinal) : moratorio.fechaFinal.toISOString(),
        diasVencidos: moratorio.diasVencidos,
        mesesCubiertos: moratorio.mesesPendientes,
        nota: String(nota).trim()
    });
    StorageService.set("cuentasPorCobrar", cuentas);

    if (typeof renderCuentasXCobrar === 'function') renderCuentasXCobrar();
    if (typeof renderAbonosDirectos === 'function') renderAbonosDirectos();
    alert("Moratorio exentado para el periodo pendiente.");
}

function renderVisorCreditosCobranza() {
    const contenedor = document.getElementById("tablaVisorCreditos");
    if (!contenedor) return;

    const filtroTexto = (document.getElementById("filtroVisorCreditos")?.value || "").trim().toLowerCase();
    const filtroEstado = document.getElementById("filtroEstadoVisorCreditos")?.value || "";
    const cuentas = StorageService.get("cuentasPorCobrar", [])
        .filter(c => !_cxcCuentaCancelada(c))
        .map(cuenta => ({ cuenta, estado: window._calcularEstadoCuenta(cuenta.folio) }))
        .filter(x => x.estado)
        .filter(x => {
            const texto = `${x.cuenta.nombre || x.cuenta.clienteNombre || ''} ${x.cuenta.folio || ''}`.toLowerCase();
            return !filtroTexto || texto.includes(filtroTexto);
        })
        .filter(x => !filtroEstado || x.estado.estadoGeneral === filtroEstado)
        .sort((a, b) => {
            const saldoDiff = Number(b.estado.saldoTotal || 0) - Number(a.estado.saldoTotal || 0);
            if (Math.abs(saldoDiff) > 0.01) return saldoDiff;
            return String(a.cuenta.nombre || a.cuenta.clienteNombre || '').localeCompare(String(b.cuenta.nombre || b.cuenta.clienteNombre || ''), 'es');
        });

    const totalSaldo = cuentas.reduce((s, x) => s + Number(x.estado.saldoTotal || 0), 0);
    const totalVencido = cuentas.reduce((s, x) => s + Number(x.estado.montoVencido || 0), 0);
    const saldadas = cuentas.filter(x => x.estado.estadoGeneral === 'Saldado').length;
    const activas = cuentas.length - saldadas;

    const badge = (estado) => {
        const map = {
            'Saldado': ['#dcfce7', '#166534'],
            'Al corriente': ['#dbeafe', '#1e40af'],
            'Promesa': ['#fef3c7', '#92400e'],
            'Atrasado': ['#ffedd5', '#c2410c'],
            'Crítico': ['#fee2e2', '#991b1b']
        };
        const [bg, color] = map[estado] || ['#f1f5f9', '#475569'];
        return `<span style="display:inline-block;padding:4px 9px;border-radius:999px;background:${bg};color:${color};font-weight:800;font-size:12px;">${_cxcEscHTML(estado)}</span>`;
    };

    contenedor.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:16px;">
            <div style="background:#eff6ff;border-left:5px solid #1e40af;padding:15px;border-radius:10px;"><small style="font-weight:800;color:#1e3a8a;">CUENTAS ACTIVAS</small><br><strong style="font-size:22px;color:#1e40af;">${activas}</strong></div>
            <div style="background:#f0fdf4;border-left:5px solid #16a34a;padding:15px;border-radius:10px;"><small style="font-weight:800;color:#166534;">SALDADAS</small><br><strong style="font-size:22px;color:#15803d;">${saldadas}</strong></div>
            <div style="background:#fff1f2;border-left:5px solid #e11d48;padding:15px;border-radius:10px;"><small style="font-weight:800;color:#9f1239;">SALDO ACTUAL</small><br><strong style="font-size:22px;color:#be123c;">${_cxcDinero(totalSaldo)}</strong></div>
            <div style="background:#fffbeb;border-left:5px solid #f59e0b;padding:15px;border-radius:10px;"><small style="font-weight:800;color:#92400e;">VENCIDO</small><br><strong style="font-size:22px;color:#b45309;">${_cxcDinero(totalVencido)}</strong></div>
        </div>
        <div style="overflow:auto;max-height:68vh;background:white;border:1px solid #e5e7eb;border-radius:10px;">
            <table class="tabla-admin" style="margin:0;width:100%;">
                <thead style="position:sticky;top:0;background:#f8fafc;z-index:1;">
                    <tr>
                        <th>Cliente / Folio</th>
                        <th>Fecha venta</th>
                        <th>Total credito</th>
                        <th>Abonado</th>
                        <th>Saldo</th>
                        <th>Vencido</th>
                        <th>Pagares</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody>
                    ${cuentas.map(({ cuenta, estado }) => {
                        const totalCredito = _cxcTotalCreditoCuenta(cuenta, estado);
                        return `
                            <tr>
                                <td><strong>${_cxcEscHTML(cuenta.nombre || cuenta.clienteNombre || 'Cliente')}</strong><br><small style="color:#64748b;">${_cxcEscHTML(cuenta.folio || '-')}</small></td>
                                <td>${cuenta.fechaVenta ? _cxcFechaVista(cuenta.fechaVenta) : '-'}</td>
                                <td style="font-weight:800;">${_cxcDinero(totalCredito)}</td>
                                <td style="font-weight:800;color:#15803d;">${_cxcDinero(estado.totalAbonado)}</td>
                                <td style="font-weight:900;color:${estado.saldoTotal > 0 ? '#be123c' : '#64748b'};">${_cxcDinero(estado.saldoTotal)}</td>
                                <td style="font-weight:800;color:${estado.montoVencido > 0 ? '#c2410c' : '#64748b'};">${_cxcDinero(estado.montoVencido)}</td>
                                <td>${estado.pagaresPendientes.length} pend. / ${estado.pagares.length} total</td>
                                <td>${badge(estado.estadoGeneral)}</td>
                            </tr>`;
                    }).join('') || '<tr><td colspan="8" style="padding:24px;text-align:center;color:#94a3b8;">Sin créditos con estos filtros.</td></tr>'}
                </tbody>
            </table>
        </div>`;
}

window.cambiarPestanaCobranza = function(pestana) {
    window._pestanaCobranzaActiva = pestana;
    renderCuentasXCobrar();
};

// ==========================================
// 3. LOGICA DE ABONOS Y POLÍTICAS
// ==========================================
function _buildCuentaOrigen(idSufijo) {
    return `
        <div class="campo" style="margin-bottom:10px;">
            <label style="font-weight:bold; color:#374151;">💳 Medio de pago:</label>
            <select id="medioPago_${idSufijo}" onchange="_actualizarCuentaEspecifica('${idSufijo}')"
                    style="padding:10px; font-size:15px; border:2px solid #27ae60; border-radius:6px; width:100%; margin-top:4px;">
                <option value="efectivo">💵 Efectivo</option>
                <option value="transferencia">🏦 Transferencia bancaria</option>
                <option value="tarjeta_credito">💳 Tarjeta de crédito</option>
            </select>
        </div>
        <div id="divCuentaEspecifica_${idSufijo}" style="display:none; margin-bottom:10px;">
            <label style="font-weight:bold; color:#374151; display:block; margin-bottom:4px;">Cuenta específica:</label>
            <select id="cuentaEspecifica_${idSufijo}"
                    style="padding:10px; font-size:15px; border:2px solid #3498db; border-radius:6px; width:100%;">
            </select>
        </div>`;
}

window._actualizarCuentaEspecifica = function(idSufijo) {
    const medio = document.getElementById('medioPago_' + idSufijo)?.value;
    const divCuenta = document.getElementById('divCuentaEspecifica_' + idSufijo);
    const selCuenta = document.getElementById('cuentaEspecifica_' + idSufijo);
    if (!divCuenta || !selCuenta) return;
    
    const tarjetas = StorageService.get('tarjetasConfig', []);
    const cajas = StorageService.get("cuentasEfectivo", [{ id: "efectivo", nombre: "💵 Efectivo Principal", saldo: 0 }]);
    
    if (medio === 'efectivo') {
        divCuenta.style.display = 'block'; 
        selCuenta.innerHTML = cajas.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    } else if (medio === 'transferencia') {
        const cuentasDebito = tarjetas.filter(t => t.tipo === 'debito');
        if (cuentasDebito.length === 0) {
            divCuenta.style.display = 'none';
            selCuenta.innerHTML = '<option value="">Sin cuentas débito registradas</option>';
        } else {
            divCuenta.style.display = 'block';
            selCuenta.innerHTML = cuentasDebito.map(b => `<option value="${b.banco}">🏦 ${b.banco} Débito</option>`).join('');
        }
    } else if (medio === 'tarjeta_credito') {
        const tarjetasCredito = tarjetas.filter(t => !t.tipo || t.tipo === 'credito');
        if (tarjetasCredito.length === 0) {
            divCuenta.style.display = 'none';
            selCuenta.innerHTML = '<option value="">Sin tarjetas crédito registradas</option>';
        } else {
            divCuenta.style.display = 'block';
            selCuenta.innerHTML = tarjetasCredito.map(b => `<option value="${b.banco}">💳 ${b.banco} Crédito</option>`).join('');
        }
    }
};

function abrirModalAbonoAvanzado(folio, opciones = {}) {
    const cuentas = StorageService.get("cuentasPorCobrar", []);
    const pagares = StorageService.get("pagaresSistema", []);
    const cuenta = cuentas.find(c => c.folio === folio);
    
    if (!cuenta) return alert("Cuenta no encontrada.");
    const modoAplicacion = opciones.modo === 'directo' ? 'directo' : 'pendiente';
    const esDirecto = modoAplicacion === 'directo';

    const hoy = new Date();
    const todosPagares = pagares
        .filter(p => p.folio === folio)
        .sort((a, b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento));
    
    const pagaresCliente = todosPagares.filter(p => p.estado === 'Pendiente' || p.estado === 'Parcial');
    const saldo = pagaresCliente.reduce((s, p) => {
        if (p.estado === "Parcial") return s + Math.max(0, (p.monto || 0) - (p.montoAbonado || 0));
        return s + (p.monto || 0);
    }, 0);
    
    let precioContadoReal = 0;
    if (cuenta.articulos && cuenta.articulos.length > 0) {
        precioContadoReal = cuenta.articulos.reduce((sum, art) => sum + (Number(art.precioContado || art.precio || 0) * Number(art.cantidad || 1)), 0);
    }
    let original = precioContadoReal > 0 ? precioContadoReal : (Number(cuenta.totalContadoOriginal || cuenta.totalMercancia || 0));
    const enganche = Number(cuenta.engancheRecibido || cuenta.enganche || 0);
    const montoAFinanciarContado = Math.max(0, original - enganche);

    const totalAbonosRegistrados = todosPagares.reduce((s, p) => {
        if (p.estado === 'Parcial') return s + (p.montoAbonado || 0);
        if (p.estado === 'Pagado') return s + (p.montoAbonado || p.monto || 0);
        return s;
    }, 0);

    const restanteContado = Math.max(0, montoAFinanciarContado - totalAbonosRegistrados);
    const periodicidadCuenta = cuenta.periodicidad || "semanal";
    
    // --- NUEVO: LECTURA SEGURA DE FECHAS PARA EL MENSAJE AMARILLO ---
   // --- LECTURA SEGURA DE FECHAS ---
    const fStr = cuenta.fechaVenta || cuenta.fecha; // SE AGREGÓ ESTA LÍNEA
    let fechaVentaDate = window.parseFechaMX(fStr);

    if (fStr) {
        if (fStr.includes('T')) fechaVentaDate = new Date(fStr);
        else if (fStr.includes('/')) {
            const p = fStr.split('/');
            if (p.length === 3) fechaVentaDate = new Date(p[2], p[1]-1, p[0], 12, 0, 0);
        } else {
            fechaVentaDate = new Date(fStr);
        }
    }
    if (isNaN(fechaVentaDate.getTime())) fechaVentaDate = new Date();

    const diasDesdeVenta = Math.floor((hoy - fechaVentaDate) / (1000 * 60 * 60 * 24));
    const aplicaPoliticaContado = diasDesdeVenta <= 30; 
    const mesActualVenta = Math.floor(diasDesdeVenta / 30.44) + 1;

    let montoProximoMes = null;
    let mesesPlanMasCercano = null;
    
    if (!aplicaPoliticaContado) {
        // IGNORAR cuenta.saldosPorMes (porque tiene los datos corruptos de la venta original)
        // Recalcular los planes con el saldo base limpio y buscar respetando el mes actual
        const planes = (typeof CalculatorService !== 'undefined' && CalculatorService.calcularCreditoConPeriodicidad)
            ? CalculatorService.calcularCreditoConPeriodicidad(montoAFinanciarContado, periodicidadCuenta)
            : [];

        const planesOrdenados = [...planes]
    .filter(p => Number(p.meses || 0) >= mesActualVenta)
    .filter(p => (Number(p.total || 0) - totalAbonosRegistrados) > 0)
    .sort((a, b) => Number(a.meses || 0) - Number(b.meses || 0));

let mejorPlan = planesOrdenados.length > 0
    ? planesOrdenados[0]
    : null;

        if (mejorPlan) {
            montoProximoMes = Math.max(0, mejorPlan.total - totalAbonosRegistrados);
            mesesPlanMasCercano = mejorPlan.meses;
        }
    }

    const articulosHTML = (cuenta.articulos || []).length > 0 ? `
        <div style="margin-bottom:20px;">
            <strong style="color:#374151;">🛒 Artículos:</strong>
            <table style="width:100%; border-collapse:collapse; margin-top:8px; font-size:13px;">
                ${cuenta.articulos.map(a => `<tr><td style="padding:4px; border-bottom:1px solid #eee;">${a.nombre}</td><td style="text-align:right; padding:4px; border-bottom:1px solid #eee;">x${a.cantidad}</td></tr>`).join('')}
            </table>
        </div>` : '';

    const pagaresHTML = todosPagares.length > 0 ? `
        <div style="margin-bottom:20px;">
            <strong style="color:#374151;">📋 Pagarés:</strong>
            <table style="width:100%; border-collapse:collapse; margin-top:8px; font-size:12px;">
                <thead><tr style="background:#f8fafc;"><th style="padding:5px; text-align:left;">#</th><th>Vencimiento</th><th style="text-align:right;">Saldo</th><th style="text-align:center;">Estado</th></tr></thead>
                <tbody>
                    ${todosPagares.map((p, i) => {
                        const esPagado = p.estado === 'Pagado' || p.estado === 'Cancelado';
                        const fechaVenc = new Date(p.fechaVencimiento);
                        const diasAtraso = !esPagado && fechaVenc < hoy ? Math.floor((hoy - fechaVenc) / (1000 * 60 * 60 * 24)) : 0;
                        const esVencido = !esPagado && diasAtraso > 0;
                        
                        let montoDisp = esPagado ? 0 : (p.estado === 'Parcial' ? (p.monto - p.montoAbonado) : p.monto);
                        
                        const rowStyle = esPagado ? 'color:#9ca3af; background:#f9fafb;' : (esVencido ? 'background:#fff1f2;' : '');
                        let badge = `<span style="padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; ${
                            esPagado ? 'background:#e5e7eb; color:#4b5563;' : 
                            (esVencido ? 'background:#fee2e2; color:#b91c1c;' : 'background:#fef3c7; color:#92400e;')
                        }">${esVencido ? 'VENCIDO' : p.estado.toUpperCase()}</span>`;

                        return `<tr style="${rowStyle}">
                            <td style="padding:7px 5px; border-bottom:1px solid #f1f5f9;">${i + 1}</td>
                            <td style="padding:7px 5px; border-bottom:1px solid #f1f5f9;">${_cxcFechaVista(p.fechaVencimiento)} ${esVencido ? `<br><small style="color:#dc2626;">(${diasAtraso} días)</small>` : ''}</td>
                            <td style="padding:7px 5px; border-bottom:1px solid #f1f5f9; text-align:right;">${_cxcDinero(montoDisp)}</td>
                            <td style="padding:7px 5px; border-bottom:1px solid #f1f5f9; text-align:center;">${badge}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>` : '';

    const abonosRegistrados = Array.isArray(cuenta.abonos) ? cuenta.abonos : [];
    const totalAbonosLista = abonosRegistrados.reduce((s, a) => s + Number(a.monto || a.montoAbonado || 0), 0);
    const abonosPendientesFolio = StorageService.get("abonosPendientes", [])
        .filter(a => (a.folioCXC || a.folioApartado) === folio);
    const totalPendienteAutorizar = abonosPendientesFolio.reduce((s, a) => s + Number(a.montoAbonado || a.monto || 0), 0);
    const pagaresCubiertos = todosPagares.filter(p => p.estado === 'Pagado' || p.estado === 'Cancelado').length;
    const pagaresPendientes = todosPagares.filter(p => p.estado === 'Pendiente' || p.estado === 'Parcial').length;

    const resumenCobranzaHTML = `
        <div style="display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:10px; margin-bottom:16px;">
            <div style="background:#ecfdf5; border:1px solid #bbf7d0; border-radius:10px; padding:12px;">
                <small style="color:#047857; font-weight:800;">Saldo pendiente</small>
                <div style="font-size:22px; font-weight:900; color:#065f46; margin-top:4px;">${_cxcDinero(saldo)}</div>
            </div>
            <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:12px;">
                <small style="color:#1d4ed8; font-weight:800;">Abonos registrados</small>
                <div style="font-size:22px; font-weight:900; color:#1e3a8a; margin-top:4px;">${_cxcDinero(totalAbonosLista)}</div>
                <div style="font-size:12px; color:#475569;">${abonosRegistrados.length} movimiento(s)</div>
            </div>
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px;">
                <small style="color:#475569; font-weight:800;">Pagares cubiertos</small>
                <div style="font-size:20px; font-weight:900; color:#0f172a; margin-top:4px;">${pagaresCubiertos}</div>
            </div>
            <div style="background:#fff7ed; border:1px solid #fed7aa; border-radius:10px; padding:12px;">
                <small style="color:#c2410c; font-weight:800;">Pagares pendientes</small>
                <div style="font-size:20px; font-weight:900; color:#9a3412; margin-top:4px;">${pagaresPendientes}</div>
            </div>
        </div>
        ${abonosPendientesFolio.length ? `
            <div style="background:#fffbeb; border:1px solid #fde68a; color:#92400e; padding:10px 12px; border-radius:9px; margin-bottom:16px; font-size:13px;">
                Hay ${abonosPendientesFolio.length} abono(s) en autorizacion por ${_cxcDinero(totalPendienteAutorizar)}.
            </div>` : ''}`;

    const abonosRegistradosHTML = `
        <div style="margin-bottom:18px;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:8px;">
                <div style="font-size:12px; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:.04em;">Historial de abonos</div>
                <span style="font-size:12px; color:#64748b;">Ultimos registros</span>
            </div>
            <div style="border:1px solid #e5e7eb; border-radius:10px; overflow:hidden; max-height:190px; overflow-y:auto;">
                ${abonosRegistrados.length ? abonosRegistrados.slice().reverse().map(ab => `
                    <div style="display:grid; grid-template-columns:90px 1fr auto; gap:10px; align-items:center; padding:10px 12px; border-bottom:1px solid #f1f5f9; font-size:13px;">
                        <span style="color:#64748b;">${_cxcFechaVista(ab.fecha || ab.fechaAbono || ab.fechaAbonoIso)}</span>
                        <span style="color:#334155; overflow:hidden; text-overflow:ellipsis;">${_cxcEscHTML(ab.etiquetaCuenta || ab.cuentaId || ab.medioPago || 'Caja')}</span>
                        <strong style="color:#15803d; white-space:nowrap;">${_cxcDinero(ab.monto || ab.montoAbonado || 0)}</strong>
                    </div>`).join('') : `
                    <div style="padding:16px; text-align:center; color:#64748b; font-size:13px;">Sin abonos registrados todavia.</div>`}
            </div>
        </div>`;

    let selectorCuentasHTML = '';
    if (typeof window._buildSelectorCuentas === 'function') {
        selectorCuentasHTML = window._buildSelectorCuentas('cuentaOrigen_abono', false);
    } else {
        selectorCuentasHTML = `<select id="cuentaOrigen_abono" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;"><option value="efectivo">💵 Efectivo Principal</option></select>`;
    }
    const politicaInicial = _cxcEvaluarPoliticaPagoAnticipado(folio, 0);
    const resumenPoliticaInicial = _cxcResumenPoliticaPagoAnticipado(politicaInicial, esDirecto);

    const modalHTML = `
        <div data-modal="abono-avanzado" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:6000; display:flex; justify-content:center; align-items:flex-start; overflow-y:auto; padding:20px;">
            <div style="background:white; border-radius:15px; width:100%; max-width:600px; overflow:hidden;">
                <div style="display:flex; justify-content:space-between; align-items:center; padding:18px 24px; border-bottom:1px solid #e5e7eb; position:sticky; top:0; background:white; z-index:2;">
                    <h2 style="margin:0;">${esDirecto ? 'Abono Directo' : 'Registrar Abono'} - ${cuenta.nombre}</h2>
                    <button onclick="document.querySelector('[data-modal=abono-avanzado]')?.remove()" style="background:none; border:none; font-size:24px; cursor:pointer; color:#9ca3af;">✕</button>
                </div>
                <div style="padding:24px;">
                
                <div style="background:#f0fdf4; padding:15px; border-radius:8px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center;">
                    <div><small style="color:#4b5563;">Saldo Crédito</small><br><strong style="font-size:20px; color:#16a34a;">${_cxcDinero(saldo)}</strong></div>
                    <div style="text-align:right;"><small style="color:#4b5563;">Días Venta</small><br><strong style="font-size:20px; color:#2563eb;">${diasDesdeVenta}</strong></div>
                </div>

                ${resumenCobranzaHTML}
                ${articulosHTML}
                ${abonosRegistradosHTML}

                <div style="background:${esDirecto ? '#ecfdf5' : '#fffbeb'}; padding:14px 15px; border-radius:8px; border-left:5px solid ${esDirecto ? '#10b981' : '#f59e0b'}; margin-bottom:18px;">
                    <strong style="color:${esDirecto ? '#065f46' : '#92400e'};">${esDirecto ? 'Aplicacion directa' : 'Pendiente de autorizacion'}</strong>
                    <p style="margin:6px 0 0 0; font-size:13px; color:${esDirecto ? '#047857' : '#78350f'};">
                        ${esDirecto
                            ? 'El abono se ingresara a caja y cartera al confirmar. Se emitira ticket al momento.'
                            : 'El abono quedara en auditoria para aprobacion de un administrador. Se emitira ticket provisional.'}
                    </p>
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1.5fr; gap:10px; margin-bottom:15px;">
                    <div>
                        <label style="display:block; margin-bottom:5px; font-weight:bold; color:#374151;">📅 Fecha de pago:</label>
                        <input type="date" id="fechaAbonoInput" value="${window.obtenerHoyInputMX ? window.obtenerHoyInputMX() : (window.getFechaLocalMX ? window.getFechaLocalMX(new Date()) : new Date().toISOString().split('T')[0])}" 
                            style="padding:12px; font-size:16px; border:2px solid #e2e8f0; border-radius:8px; width:100%; box-sizing:border-box;">
                    </div>
                    <div>
                        <label style="display:block; margin-bottom:5px; font-weight:bold; color:#374151;">Monto a abonar:</label>
                        <input type="number" id="montoAbono" placeholder="0.00" 
                            oninput="actualizarAvisoPoliticaAbono('${folio}')"
                            style="padding:12px; font-size:18px; border:2px solid #3b82f6; border-radius:8px; width:100%; box-sizing:border-box;">
                    </div>
                </div>

                <div id="avisoPoliticaAbono"></div>

                <div style="background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:20px;">
                    <label style="display:block; margin-bottom:5px; font-weight:bold; color:#374151;">💳 ¿A qué caja/cuenta ingresa el dinero?</label>
                    ${selectorCuentasHTML}
                </div>

                ${esDirecto ? `
                <div style="background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:20px;">
                    <label style="display:block; margin-bottom:5px; font-weight:bold; color:#374151;">Referencia de transferencia / lote</label>
                    <input type="text" id="referenciaTransferenciaAbono" placeholder="Ej. SPEI 123456, deposito 29-may, transferencia cliente X"
                        value="${_cxcEscHTML(window._ultimaReferenciaTransferenciaAbono || '')}"
                        style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; box-sizing:border-box;">
                    <small style="display:block; color:#64748b; margin-top:6px; line-height:1.35;">
                        Si una sola transferencia cubre varios folios, usa exactamente la misma referencia en cada abono. En Flujo Real se vera agrupada como un solo deposito.
                    </small>
                </div>
                ` : ''}

                <div style="background:#fffbeb; padding:15px; border-radius:8px; border-left:5px solid #f59e0b; margin-bottom:20px;">
                    <strong style="color:#92400e;">${resumenPoliticaInicial.titulo}</strong>
                    <p style="margin:8px 0 0 0; font-size:14px; color:#78350f; line-height:1.45;">
                        ${resumenPoliticaInicial.detalle}
                    </p>
                    <p style="margin:8px 0 0 0; font-size:12px; color:#92400e; line-height:1.45; font-weight:700;">
                        ${resumenPoliticaInicial.nota}
                    </p>
                </div>

                <div style="display:flex; gap:10px;">
                    <button onclick="procesarAbonoAvanzado('${folio}', ${original}, ${saldo}, ${aplicaPoliticaContado}, '${modoAplicacion}')" 
                            style="flex:2; padding:15px; background:${esDirecto ? '#0f766e' : '#22c55e'}; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold; font-size:16px;">
                        ${esDirecto ? 'Aplicar Abono Directo' : 'Enviar a Autorizacion'}
                    </button>
                    <button onclick="document.querySelector('[data-modal=&quot;abono-avanzado&quot;]')?.remove();" 
                            style="flex:1; padding:15px; background:#ef4444; color:white; border:none; border-radius:8px; cursor:pointer;">
                        Cancelar
                    </button>
                </div>
                </div>
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function actualizarAvisoPoliticaAbono(folio) {
    const avisoDiv = document.getElementById("avisoPoliticaAbono");
    if (!avisoDiv) return;

    const montoAbono = parseFloat(document.getElementById("montoAbono")?.value) || 0;
    if (montoAbono <= 0) {
        avisoDiv.innerHTML = "";
        return;
    }

    const politica = _cxcEvaluarPoliticaPagoAnticipado(folio, montoAbono);
    if (!politica) {
        avisoDiv.innerHTML = "";
        return;
    }

    const beneficioHTML = politica.beneficio > 0.01
        ? `<br>Beneficio para el cliente: <b>${_cxcDinero(politica.beneficio)}</b>.`
        : "";
    const montoPoliticaHTML = `Monto correcto por politica: <b>${_cxcDinero(politica.montoLiquidacion)}</b>.`;
    const reglaHTML = `<br><span style="font-weight:700;">Esta regla se aplicara igual si el abono es directo o si se envia a Boveda.</span>`;

    if (politica.aplica && politica.liquidaria) {
        const titulo = politica.tipo === "contado_30"
            ? "LIQUIDACION A PRECIO DE CONTADO"
            : `LIQUIDACION ANTICIPADA${politica.plan?.meses ? ` - PLAN ${politica.plan.meses} MESES` : ""}`;
        const excesoHTML = montoAbono > politica.montoLiquidacion + 0.01
            ? `<br>Capturaste <b>${_cxcDinero(montoAbono)}</b>; se aplicara el monto de politica.`
            : "";
        avisoDiv.innerHTML = `<div style="background:#dcfce7; color:#166534; padding:10px; border-radius:6px; margin-bottom:15px; font-size:13px; border-left:4px solid #15803d;"><b>${titulo}</b><br>${montoPoliticaHTML}${beneficioHTML}${excesoHTML}${reglaHTML}</div>`;
        return;
    }

    if (politica.aplica && politica.faltante > 0.01) {
        const titulo = politica.tipo === "contado_30"
            ? "Politica 30 dias"
            : `Liquidacion anticipada${politica.plan?.meses ? ` al plan de ${politica.plan.meses} meses` : ""}`;
        avisoDiv.innerHTML = `<div style="background:#fef3c7; color:#92400e; padding:10px; border-radius:6px; margin-bottom:15px; font-size:13px; border-left:4px solid #d97706;"><b>${titulo}:</b> agrega <b>${_cxcDinero(politica.faltante)}</b> para liquidar con esta politica.<br>${montoPoliticaHTML}${beneficioHTML}${reglaHTML}</div>`;
        return;
    }

    if (politica.liquidaria) {
        avisoDiv.innerHTML = `<div style="background:#dcfce7; color:#166534; padding:10px; border-radius:6px; margin-bottom:15px; font-size:13px; border-left:4px solid #15803d;"><b>LIQUIDACION DE SALDO</b><br>Este abono liquida el saldo vigente de la cuenta.</div>`;
        return;
    }

    avisoDiv.innerHTML = "";
}

function evaluarPoliticaLiquidacion(folio, montoAbono) {
    const politica = _cxcEvaluarPoliticaPagoAnticipado(folio, montoAbono);
    if (!politica || !politica.aplica || !politica.liquidaria) return null;
    return {
        aplica: true,
        montoCorrecto: politica.montoLiquidacion,
        ahorro: politica.beneficio,
        plan: politica.plan || null,
        tipo: politica.tipo
    };
}

// 🛡️ INTERCEPTOR MAKER-CHECKER ABONOS: Pone el Abono en cuarentena y emite ticket
function procesarAbonoAvanzado(folio, montoOriginal, saldoActual, aplicaPoliticaContado, modoAplicacion = 'pendiente') {
    const esDirecto = modoAplicacion === 'directo';
    const montoAbonoInput = parseFloat(document.getElementById("montoAbono").value);
    const fechaAbonoRaw = document.getElementById("fechaAbonoInput")?.value;
    const fechaObj = fechaAbonoRaw ? new Date(fechaAbonoRaw + "T12:00:00") : new Date();
    const fechaAbonoStr = window.formatearFechaCortaMX ? window.formatearFechaCortaMX(fechaObj) : fechaObj.toLocaleDateString();
    const fechaAbonoIso = window.localISO ? window.localISO(fechaObj) : fechaObj.toISOString();
    
    const selCaja = document.getElementById("cuentaOrigen_abono");
    const cuentaId = selCaja ? selCaja.value : 'efectivo';
    const etiqueta = selCaja ? selCaja.options[selCaja.selectedIndex].text : 'Efectivo';
    const isCaja = String(cuentaId).startsWith('caja_') || cuentaId === 'efectivo';
    const medioPago = isCaja ? 'efectivo' : 'transferencia';
    const referenciaTransferencia = esDirecto
        ? String(document.getElementById("referenciaTransferenciaAbono")?.value || '').trim()
        : '';
    const grupoConciliacion = referenciaTransferencia
        ? `TRANSF-${referenciaTransferencia.toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9_-]/g, '')}`
        : '';
    if (esDirecto) window._ultimaReferenciaTransferenciaAbono = referenciaTransferencia;

    if (isNaN(montoAbonoInput) || montoAbonoInput <= 0) return alert("Ingresa un monto válido.");
    const politicaValidacion = _cxcEvaluarPoliticaPagoAnticipado(folio, montoAbonoInput);
    const maximoPermitido = Math.max(
        Number(saldoActual || 0),
        Number(politicaValidacion?.montoLiquidacion || 0)
    );
    if (montoAbonoInput > (maximoPermitido + 0.01)) {
        return alert(`El abono no puede ser mayor al saldo o al monto correcto por politica.\n\nSaldo visible: ${_cxcDinero(saldoActual)}\nMonto por politica: ${_cxcDinero(politicaValidacion?.montoLiquidacion || saldoActual)}`);
    }

    const cuentas = StorageService.get("cuentasPorCobrar", []);
    const cuenta = cuentas.find(c => c.folio === folio) || {};
    let montoFinal = montoAbonoInput;
    let liquidacionPorPolitica = false;

    const fechaClaveAbono = _cxcFechaClave(fechaAbonoRaw || fechaObj);
    const abonosRegistradosDia = (cuenta.abonos || []).filter(ab =>
        _cxcFechaClave(ab.fecha || ab.fechaAbono || ab.fechaAbonoIso) === fechaClaveAbono
    );
    const abonosPendientesDia = StorageService.get("abonosPendientes", []).filter(ab =>
        (ab.folioCXC || ab.folioApartado) === folio &&
        _cxcFechaClave(ab.fechaAbonoRaw || ab.fechaAbonoIso || ab.fechaAbonoStr || ab.fecha) === fechaClaveAbono
    );

    if (abonosRegistradosDia.length || abonosPendientesDia.length) {
        const totalMismoDia = [...abonosRegistradosDia, ...abonosPendientesDia]
            .reduce((s, ab) => s + Number(ab.monto || ab.montoAbonado || 0), 0);
        const msg = `CANDADO DE ABONOS\n\nYa existe ${abonosRegistradosDia.length + abonosPendientesDia.length} abono(s) registrado(s) para esta cuenta en la fecha seleccionada (${_cxcFechaCorta(fechaObj)}), por un total de ${_cxcDinero(totalMismoDia)}.\n\nSi continuas se registrara otro abono el mismo dia.\n\nEstas seguro de aplicar este abono?`;
        if (!confirm(msg)) return;
    }

    const pagares = StorageService.get("pagaresSistema", []);
    const precioContadoReal = _cxcImporteContadoCuenta(cuenta) || Number(montoOriginal);
    const politicaAbono = politicaValidacion || _cxcEvaluarPoliticaPagoAnticipado(folio, montoAbonoInput);

    if (politicaAbono?.aplica && politicaAbono.liquidaria) {
        const tipoPolitica = politicaAbono.tipo === "contado_30"
            ? "PRECIO DE CONTADO (30 DIAS)"
            : `PLAN ANTICIPADO${politicaAbono.plan?.meses ? ` ${politicaAbono.plan.meses} MESES` : ""}`;
        const beneficioTxt = politicaAbono.beneficio > 0.01
            ? `\nBeneficio para el cliente: ${_cxcDinero(politicaAbono.beneficio)}`
            : "";
        const excesoTxt = montoAbonoInput > politicaAbono.montoLiquidacion + 0.01
            ? `\n\nCapturaste ${_cxcDinero(montoAbonoInput)}, pero se aplicara el monto correcto por politica.`
            : "";
        if (confirm(`POLITICA DE PAGO ANTICIPADO\n\nAplica: ${tipoPolitica}\nMonto a aplicar: ${_cxcDinero(politicaAbono.montoLiquidacion)}${beneficioTxt}${excesoTxt}\n\nConfirmas liquidar la cuenta con esta politica?`)) {
            montoFinal = politicaAbono.montoLiquidacion;
            liquidacionPorPolitica = true;
        }
    }

    if (!liquidacionPorPolitica && politicaAbono?.liquidaria && montoAbonoInput >= Number(politicaAbono.saldoActual || saldoActual) - 0.01) {
        if (!confirm(`LIQUIDACION DE SALDO\n\nEste abono liquida el saldo vigente de la cuenta.\nCliente: ${cuenta.nombre || cuenta.clienteNombre || 'Cliente'}\nFolio: ${folio}\nMonto: ${_cxcDinero(montoFinal)}\nDestino: ${etiqueta}\n\nConfirmas el abono?`)) return;
    } else if (!liquidacionPorPolitica) {
        if (!confirm(`RESUMEN DE ABONO\n\nCliente: ${cuenta.nombre || cuenta.clienteNombre || 'Cliente'}\nFolio: ${folio}\nMonto: ${_cxcDinero(montoFinal)}\nDestino: ${etiqueta}\n\nConfirmas el abono?`)) return;
    }
    // 🚀 BÓVEDA DE CUARENTENA PARA ABONO
    const cuarentena = {
        id: Date.now() + Math.random(),
        folioCXC: folio,
        fechaCaptura: window.formatearFechaCortaMX ? window.formatearFechaCortaMX(new Date()) : new Date().toLocaleDateString('es-MX'),
        fechaCapturaIso: window.localISO ? window.localISO(new Date()) : new Date().toISOString(),
        clienteNombre: cuenta.nombre || cuenta.clienteNombre || 'Cliente',
        montoAbonado: montoFinal,
        montoAbonoInput: montoAbonoInput,
        fechaAbonoRaw: fechaAbonoRaw,
        cuentaId: cuentaId,
        etiquetaCuenta: etiqueta,
        medioPago: medioPago,
        referenciaBancaria: referenciaTransferencia,
        grupoConciliacion,
        liquidacionPorPolitica: liquidacionPorPolitica,
        fechaAbonoIso: fechaAbonoIso,
        fechaAbonoStr: fechaAbonoStr,
        vendedorId: cuenta.vendedorId || null
    };

    if (!esDirecto) {
        StorageService.pushAtomo("abonosPendientes", cuarentena);
        if (typeof window.notificarBovedaAutorizacion === 'function') {
            window.notificarBovedaAutorizacion({
                tipo: 'abono',
                id: `abono-${cuarentena.id}`,
                titulo: 'Abono pendiente en Boveda',
                cuerpo: `${cuenta.nombre || cuenta.clienteNombre || 'Cliente'} - ${_cxcDinero(montoFinal)}`,
                folio,
                cliente: cuenta.nombre || cuenta.clienteNombre || 'Cliente',
                monto: montoFinal
            });
        }
    }

    // SIMULAMOS EN MEMORIA PARA EL TICKET PROVISIONAL
    let _pagaresDelFolio = pagares.filter(p => p.folio === folio && (p.estado === "Pendiente" || p.estado === "Parcial")).sort((a, b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento));
    let _montoRestante = montoFinal;
    const _pagaresCubiertos = [];
    let _pagareParcial = null;

    for (const pag of _pagaresDelFolio) {
        const _n = (pag.estado === 'Parcial') ? Math.max(0, pag.monto - (pag.montoAbonado || 0)) : pag.monto;
        if (_montoRestante >= _n - 0.01) { _pagaresCubiertos.push({ ...pag }); _montoRestante -= _n; } 
        else { if (_montoRestante > 0.01) { _pagareParcial = { ...pag, montoAplicado: _montoRestante }; } break; }
    }
    const saldoPagaresAntes = pagares.filter(p => p.folio === folio && (p.estado === 'Pendiente' || p.estado === 'Parcial')).reduce((s, p) => s + (p.estado === 'Parcial' ? Math.max(0, p.monto - (p.montoAbonado||0)) : p.monto), 0);
    const saldoMoratoriosAntes = _cxcTotalMoratoriosPendientes(cuenta);
    const excedenteParaMoratorios = Math.max(0, montoFinal - saldoPagaresAntes);
    let nuevoSaldoReal = Math.max(0, saldoPagaresAntes - montoFinal) + Math.max(0, saldoMoratoriosAntes - excedenteParaMoratorios);
    if (liquidacionPorPolitica) nuevoSaldoReal = 0;

    const _pagaresRestantes = pagares.filter(p => p.folio === folio && (p.estado === "Pendiente" || p.estado === "Parcial")).map(p => {
        if (_pagaresCubiertos.find(pc => pc.id === p.id) || liquidacionPorPolitica) return { ...p, estado: "Pagado" };
        if (_pagareParcial && p.id === _pagareParcial.id) return { ...p, estado: "Parcial" };
        return p;
    }).filter(p => p.estado !== "Pagado");

    const _pagaresCubiertosTicket = [..._pagaresCubiertos];
    if (_pagareParcial) _pagaresCubiertosTicket.push({ ..._pagareParcial, parcial: true });

    let procesoOk = true;
    let ticketEmitido = false;
    try {
        if (esDirecto) {
            const aplicado = window.ejecutarAbonoAutorizadoReal(cuarentena);
            if (aplicado === false) throw new Error("El abono directo no fue aplicado por el ejecutor.");
        }

        ticketEmitido = generarTicketAbonoTermico({
        folio,
        cliente: { nombre: cuenta.nombre || cuenta.clienteNombre || folio, telefono: cuenta.telefono || '', direccion: cuenta.direccion || '' },
        montoAbono: montoFinal,
        nuevoSaldo: Math.max(0, nuevoSaldoReal),
        fecha: fechaAbonoStr, 
        metodoCobro: medioPago,
        cuentaDestino: esDirecto ? etiqueta : etiqueta + " (Pendiente Aut.)",
        pagaresCubiertos: _pagaresCubiertosTicket,
        pagaresRestantes: _pagaresRestantes,
        articulos: cuenta.articulos || [],
        totalVenta: precioContadoReal,
        enganche: Number(cuenta.engancheRecibido || cuenta.enganche || 0)
        });
    } catch (err) {
        procesoOk = false;
        console.error("Error procesando/ticket de abono:", err);
        alert("Hubo un problema durante el proceso del abono o al emitir el ticket. Revisa el estado de cuenta antes de repetirlo.");
    }

    document.querySelector('[data-modal="abono-avanzado"]')?.remove();
    if (typeof renderCuentasXCobrar === 'function') renderCuentasXCobrar();
    if (typeof renderAbonosDirectos === 'function') renderAbonosDirectos();
    if (typeof renderPanelAutorizaciones === 'function') renderPanelAutorizaciones();
    if (!procesoOk) return;
    if (!ticketEmitido) {
        alert(esDirecto
            ? "Abono directo aplicado correctamente, pero el navegador bloqueo el ticket. Habilita ventanas emergentes y reimprimelo desde el estado de cuenta."
            : "Abono enviado a autorizacion, pero el navegador bloqueo el ticket provisional. Habilita ventanas emergentes y reimprimelo desde el estado de cuenta.");
        return;
    }
    if (esDirecto) {
        if (procesoOk) alert("Abono directo aplicado correctamente. El ticket fue emitido.");
        return;
    }
    alert(`⏳ ABONO EN CUARENTENA\\n\\nEl ticket provisional se emitió, pero el ingreso a caja requiere Autorización de un Administrador.`);
}

// 🚀 EJECUTOR REAL: Llamado desde el Panel de Autorizaciones
window.ejecutarAbonoAutorizadoReal = function(a) {
    if (!a || String(a.estado || '').toLowerCase().includes('cancel')) {
        alert("Este abono pendiente fue cancelado o ya no es valido.");
        return false;
    }

    // ── CAPA 0: Lista local de IDs ya aprobados ────────────────────────────
    // Esta lista empieza con "_" → StorageService NUNCA la sube ni la baja de
    // Firebase. Sobrevive a cualquier syncAll() con datos viejos de la nube.
    // Es la barrera definitiva contra dobles autorizaciones por conflicto de sync.
    const _idsAprobados = StorageService.get('_idsAprobadosLocal', []);
    const _idOp = String(a.idCuarentena || a.id || a.idOperacion || '');
    if (_idOp && _idsAprobados.includes(_idOp)) {
        alert("⚠️ Este abono ya fue autorizado anteriormente en este dispositivo.\n\nNo se duplicará.");
        return false;
    }
    // ──────────────────────────────────────────────────────────────────────
    const _folioGuard = a.folioApartado || a.folioCXC || '';
    const _montoGuard = Number(a.montoAbonado || a.monto || 0);
    const _fechaGuard = String(a.fechaAbonoIso || a.fecha || '').slice(0, 10);
    if (a && (a.tipo === 'apartado' || a.origen === 'apartados' || a.folioApartado)) {
        const folioApartado = a.folioApartado || a.folioCXC;
        const apartadoGuard = StorageService.get("apartados", []).find(ap => ap.folio === folioApartado);
        if (!apartadoGuard || String(apartadoGuard.estado || '').toLowerCase().includes('cancel')) {
            alert("No se puede aplicar el abono porque el apartado no existe o esta cancelado.");
            return false;
        }
        const _idGuard = String(a.idCuarentena || a.id || a.idOperacion || '');
        const yaExisteApartado = _idGuard && (apartadoGuard.abonos || []).some(ab =>
            String(ab.idOperacion || ab.idCuarentena || ab.id || '') === _idGuard
        );
        if (yaExisteApartado) {
            alert("Este abono ya aparece aplicado en el apartado. No se duplicara.");
            return false;
        }
        if (typeof window.registrarAbonoApartado === 'function') {
            const aplicado = window.registrarAbonoApartado(
                folioApartado,
                a.montoAbonado,
                a.fechaAbonoIso,
                a.cuentaId,
                a.etiquetaCuenta,
                { imprimir: false, silencioso: true, idOperacion: a.idCuarentena || a.id || a.idOperacion }
            );
            if (!aplicado) {
                alert("No se pudo aplicar el abono del apartado. Revisa que el apartado exista y que el monto no exceda el saldo pendiente.");
                return false;
            }
            return true;
        }

        alert("No está disponible el módulo de Apartados para aplicar este abono.");
        return false;
    }

    const cuentaGuard = StorageService.get("cuentasPorCobrar", []).find(c => c.folio === _folioGuard);
    if (!cuentaGuard || String(cuentaGuard.estado || '').toLowerCase().includes('cancel')) {
        alert("No se puede aplicar el abono porque la cuenta por cobrar no existe o esta cancelada.");
        return false;
    }
    const estadoCuentaGuard = typeof window._calcularEstadoCuenta === 'function' ? window._calcularEstadoCuenta(_folioGuard) : null;
    const saldoVigenteGuard = Number(estadoCuentaGuard?.saldoTotal ?? cuentaGuard.saldoActual ?? 0);
    const politicaGuard = a.liquidacionPorPolitica && typeof _cxcEvaluarPoliticaPagoAnticipado === 'function'
        ? _cxcEvaluarPoliticaPagoAnticipado(_folioGuard, _montoGuard)
        : null;
    const maximoPermitidoGuard = Math.max(
        saldoVigenteGuard,
        Number(politicaGuard?.montoLiquidacion || 0)
    );
    if (_montoGuard > maximoPermitidoGuard + 0.01) {
        alert(`No se puede aplicar el abono porque excede el saldo vigente o el monto correcto por politica.\n\nAbono: ${_cxcDinero(_montoGuard)}\nSaldo vigente: ${_cxcDinero(saldoVigenteGuard)}\nPolitica: ${_cxcDinero(politicaGuard?.montoLiquidacion || saldoVigenteGuard)}`);
        return false;
    }
    const _idGuardCredito = String(a.idCuarentena || a.id || a.idOperacion || '');
    const yaExisteCredito = _idGuardCredito && (cuentaGuard.abonos || []).some(ab =>
        String(ab.idOperacion || ab.idCuarentena || ab.id || '') === _idGuardCredito
    );
    if (yaExisteCredito) {
        alert("Este abono ya aparece aplicado en el credito. No se duplicara.");
        return false;
    }

    const _todosLosPagares = StorageService.get("pagaresSistema", []);
    let _pagaresDelFolio = _todosLosPagares.filter(p => p.folio === a.folioCXC && (p.estado === "Pendiente" || p.estado === "Parcial")).sort((x, y) => new Date(x.fechaVencimiento) - new Date(y.fechaVencimiento));

    let _montoRestante = a.montoAbonado;
    const _pagaresCubiertos = [];
    let _pagareParcial = null;

    for (const pag of _pagaresDelFolio) {
        const _montoNecesario = (pag.estado === 'Parcial') ? Math.max(0, pag.monto - (pag.montoAbonado || 0)) : pag.monto;
        if (_montoRestante >= _montoNecesario - 0.01) { _pagaresCubiertos.push({ ...pag }); _montoRestante -= _montoNecesario; } 
        else { if (_montoRestante > 0.01) { _pagareParcial = { ...pag, montoAplicado: _montoRestante }; _montoRestante = 0; } break; }
    }

    let _todosActualizados = _todosLosPagares.map(p => {
        if (_pagaresCubiertos.find(pc => pc.id === p.id)) return { ...p, estado: "Pagado", fechaAbono: a.fechaAbonoStr, montoAbonado: p.monto };
        if (_pagareParcial && p.id === _pagareParcial.id) return { ...p, estado: "Parcial", fechaAbono: a.fechaAbonoStr, montoAbonado: (p.montoAbonado || 0) + _pagareParcial.montoAplicado };
        return p;
    });

    if (a.liquidacionPorPolitica) {
        _todosActualizados = _todosActualizados.map(p => {
            if (p.folio === a.folioCXC && (p.estado === "Pendiente" || p.estado === "Parcial")) return { ...p, estado: "Cancelado", nota: "Liquidado por política" };
            return p;
        });
    }

    StorageService.set("pagaresSistema", _todosActualizados);

    const cuentasXCobrar = StorageService.get("cuentasPorCobrar", []);
    const idxCuenta = cuentasXCobrar.findIndex(c => c.folio === a.folioCXC);
    if (idxCuenta !== -1) {
        const cuentaAct = cuentasXCobrar[idxCuenta];
        cuentaAct.abonos = cuentaAct.abonos || [];
        cuentaAct.abonos.push({ idOperacion: a.idCuarentena || a.id || a.idOperacion || null, fecha: a.fechaAbonoStr, fechaAbonoIso: a.fechaAbonoIso, monto: a.montoAbonado, cuentaId: a.cuentaId, medioPago: a.medioPago, etiquetaCuenta: a.etiquetaCuenta, referenciaBancaria: a.referenciaBancaria || '', grupoConciliacion: a.grupoConciliacion || '', vendedorId: a.vendedorId || null });
        _cxcAplicarPagoAMoratorios(cuentaAct, _montoRestante);

        const _pagaresAct = StorageService.get("pagaresSistema", []);
        let nuevoSaldoReal = _pagaresAct.filter(p => p.folio === a.folioCXC && (p.estado === 'Pendiente' || p.estado === 'Parcial')).reduce((s, p) => s + (p.estado === 'Parcial' ? Math.max(0, (p.monto || 0) - (p.montoAbonado || 0)) : (p.monto || 0)), 0);
        nuevoSaldoReal += _cxcTotalMoratoriosPendientes(cuentaAct);

        cuentaAct.saldoActual = nuevoSaldoReal;
        if (nuevoSaldoReal <= 0.01) { cuentaAct.estado = "Saldado"; cuentaAct.saldoActual = 0; }
        cuentasXCobrar[idxCuenta] = cuentaAct;
        StorageService.set("cuentasPorCobrar", cuentasXCobrar);

        if (typeof window._ingresarCuenta === 'function') {
            window._ingresarCuenta({ monto: a.montoAbonado, cuentaId: a.cuentaId, etiqueta: a.etiquetaCuenta, concepto: `Abono a ${cuentaAct.nombre} - ${a.folioCXC}`, referencia: `ABONO-${a.folioCXC}`, fecha: a.fechaAbonoIso, idOperacion: a.idCuarentena || a.id || a.idOperacion || null, grupoConciliacion: a.grupoConciliacion || '', referenciaBancaria: a.referenciaBancaria || '', foliosGrupo: a.grupoConciliacion ? [a.folioCXC] : [] });
        }
    } else {
        alert("No se encontro la cuenta por cobrar para aplicar el abono.");
        return false;
    }

    if (typeof window.registrarComisionAbono === 'function' && a.vendedorId) {
        window.registrarComisionAbono(a.folioCXC, a.montoAbonado, a.vendedorId);
    }

    // ── Marcar como aprobado en la lista local persistente ────────────────
    if (_idOp) {
        const lista = StorageService.get('_idsAprobadosLocal', []);
        if (!lista.includes(_idOp)) {
            lista.push(_idOp);
            // Mantener solo los últimos 2000 IDs para no crecer indefinidamente
            StorageService.set('_idsAprobadosLocal', lista.slice(-2000));
        }
    }
    // ──────────────────────────────────────────────────────────────────────

    return true;
};

function generarTicketAbonoTermico(datosAbono) {
    const { folio, folioAbono, fecha, cliente, montoAbono, saldoAnterior, nuevoSaldo,
        pagaresRestantes, etiquetaCuenta, cuentaDestino, empresa, articulos, totalVenta, enganche, metodoCobro } = datosAbono;

    const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const dineroFmt = v => '$' + Number(v).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const restantes = pagaresRestantes || [];
    const hoy = new Date();
    const vencidos = restantes.filter(p => new Date(p.fechaVencimiento) < hoy);
    
    let mensajeEstado = '';
    let mensajeClase = 'mensaje-ok';
    if (nuevoSaldo <= 0.01) {
        mensajeEstado = `🎉 ¡Cuenta liquidada! Gracias por su compromiso, ${esc(cliente.nombre)}. ¡Hasta pronto!`;
        mensajeClase = 'mensaje-ok';
    } else if (vencidos.length > 0) {
        const montoVencido = vencidos.reduce((s, p) => s + p.monto, 0);
        mensajeEstado = `Le recordamos amablemente que tiene ${vencidos.length} pago(s) con fecha vencida por un total de ${dineroFmt(montoVencido)}. Le agradecemos su pronta atención. 🙏`;
        mensajeClase = 'mensaje-atraso';
    } else {
        mensajeEstado = `¡Gracias por su pago puntual! Está al corriente con sus pagos. ✅`;
        mensajeClase = 'mensaje-ok';
    }

    const articulosHTML = (articulos || []).length > 0 ? `
        <div class="seccion-titulo">ARTÍCULOS DE LA VENTA</div>
        <table>
            <thead><tr><th>Producto</th><th style="text-align:right;">Cant.</th><th style="text-align:right;">Precio</th></tr></thead>
            <tbody>
                ${articulos.map(a => `
                <tr>
                    <td>${esc(a.nombre || '-')}</td>
                    <td style="text-align:right;">${esc(String(a.cantidad || 1))}</td>
                    <td style="text-align:right;">${dineroFmt((a.precioContado || 0) * (a.cantidad || 1))}</td>
                </tr>`).join('')}
            </tbody>
        </table>` : '';

    // 🛡️ CORRECCIÓN 1: Extraer la URL base actual para que las imágenes relativas (el Logo) funcionen en la ventana emergente.
    const baseUrl = window.location.href.split('?')[0].split('#')[0];

    const ticketHTML = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Recibo de Abono ${esc(folioAbono || folio)}</title>
    <base href="${baseUrl}">
    
    <style>
        @page { size: 80mm auto; margin: 0; }
        body { font-family: 'Courier New', monospace; font-size: 11px; width: 72mm; margin: 4mm auto; color: #000; background: #f3f4f6; }
        .centro { text-align: center; }
        .negrita { font-weight: bold; }
        hr { border: none; border-top: 1px dashed #333; margin: 6px 0; }
        .monto-grande { font-size: 20px; font-weight: bold; text-align: center; margin: 8px 0; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        th { background: #e8e8e8; padding: 3px 5px; text-align: left; }
        .seccion-titulo { background: #000; color: #fff; padding: 3px 6px; font-weight: bold; font-size: 10px; margin: 5px 0 3px 0; }
        .mensaje-ok { border: 1px dashed #000; padding: 6px; font-size: 10px; text-align: center; margin: 6px 0; }
        .mensaje-atraso { background: #000; color: #fff; padding: 6px; font-size: 10px; text-align: center; margin: 6px 0; }
        #ticket-contenido { background: #ffffff; padding: 10px; padding-bottom: 20px; box-sizing: border-box; }
        @media print { .no-print { display: none !important; } body { background: white; margin: 0; } #ticket-contenido { padding: 0; } }
    </style>
    <script>
        function cargarHtml2Canvas(callback) {
            if (typeof html2canvas !== 'undefined') {
                callback();
                return;
            }

            var existente = document.getElementById('html2canvas-loader');
            if (existente) {
                existente.addEventListener('load', callback, { once: true });
                return;
            }

            var script = document.createElement('script');
            script.id = 'html2canvas-loader';
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            script.onload = callback;
            script.onerror = function() {
                alert('No se pudo cargar el motor de imagen. Revisa tu conexión e intenta de nuevo, o usa Imprimir > Guardar como PDF.');
                var btn = document.getElementById('btn-imagen');
                if (btn) {
                    btn.innerHTML = '📷 Guardar Imagen';
                    btn.disabled = false;
                }
            };
            document.head.appendChild(script);
        }

        function descargarImagen() {
            cargarHtml2Canvas(function() {
                generarImagenTicket();
            });
        }

        function generarImagenTicket() {
            const ticket = document.getElementById('ticket-contenido');
            if (!ticket) {
                alert('No se encontró el contenido del ticket para generar la imagen.');
                return;
            }

            const btn = document.getElementById('btn-imagen');
            const textoOriginal = btn.innerHTML;
            btn.innerHTML = '⏳ Procesando...';
            btn.disabled = true;
            
            // 🛡️ CORRECCIÓN 3: useCORS permite cargar imágenes externas (como SVG locales procesados) sin fallar
            html2canvas(ticket, {
                scale: 3,
                useCORS: true,
                allowTaint: false,
                backgroundColor: '#ffffff',
                logging: false
            }).then(canvas => {
                const link = document.createElement('a');
                link.download = 'Abono_${esc(folio)}.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
                btn.innerHTML = textoOriginal;
                btn.disabled = false;
            }).catch(err => {
                alert('❌ Hubo un error al generar la imagen. Intenta imprimirlo a PDF.');
                btn.innerHTML = textoOriginal;
                btn.disabled = false;
            });
        }
    </script>
</head>
<body>
<div id="ticket-contenido">
    <div class="centro">
        <img src="img/Logo.svg" style="width:60px; height:60px; object-fit:contain;" onerror="this.outerHTML='<span style=\\'font-size:32px;\\'>🏛️</span>'">
        <div class="negrita" style="font-size:14px; margin-top:4px;">MUEBLERÍA MI PUEBLITO</div>
        <div>Santiago Cuaula, Tlaxcala</div>
    </div>
    <hr>
    <div class="centro negrita" style="font-size:13px;">── RECIBO DE PAGO ──</div>
    <div>Folio Venta: <span class="negrita">${esc(folio)}</span></div>
    <div>Fecha: <span class="negrita">${esc(fecha)}</span></div>
    <hr>
    <div class="negrita">CLIENTE</div>
    <div>${esc(cliente.nombre)}</div>
    ${cliente.telefono ? `<div>Tel: ${esc(cliente.telefono)}</div>` : ''}
    <hr>
    ${articulosHTML}
    <hr>
    <div class="negrita">ABONO RECIBIDO:</div>
    <div class="monto-grande">${dineroFmt(montoAbono)}</div>
    <div style="display:flex; justify-content:space-between;">
        <span>Nuevo saldo:</span><span class="negrita">${dineroFmt(nuevoSaldo)}</span>
    </div>
    <div style="display:flex; justify-content:space-between;">
        <span>Forma de pago:</span><span>${esc(cuentaDestino || etiquetaCuenta)}</span>
    </div>
    <hr>
    <div class="${mensajeClase}">${mensajeEstado}</div>
    <hr>
    <div style="text-align:center; margin-top:10px;">
        <div style="border-top:1px solid #333; width:70%; margin:0 auto 4px auto;"></div>
        <div class="negrita">FIRMA DEL CLIENTE</div>
    </div>
    <div class="centro" style="margin-top:12px;">Gracias por su preferencia</div>
</div>
<div class="no-print" style="text-align:center; padding:15px; margin-top:10px; display:flex; justify-content:center; gap:10px;">
    <button onclick="window.print()" style="padding:10px 15px; background:#2563eb; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">🖨️ Imprimir</button>
    <button id="btn-imagen" onclick="descargarImagen()" style="padding:10px 15px; background:#059669; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">📷 Guardar Imagen</button>
</div>
</body>
</html>`;

    if (window.TicketService?.openHtml) {
        return window.TicketService.openHtml(ticketHTML, { title: `Recibo de Abono ${folioAbono || folio}`, filename: `abono_${folioAbono || folio}` });
    }
    const ventana = window.open('', '_blank');
    if (!ventana) {
        alert("Habilita las ventanas emergentes en tu navegador para ver el ticket.");
        return false;
    }
    ventana.document.write(ticketHTML);
    ventana.document.close();
    ventana.focus();
    return true;
}

function renderCobranzaEsperada() {
    const contenedor = document.getElementById("escaleraCobranza");
    if (!contenedor) return;

    const pagares = StorageService.get("pagaresSistema", []);
    const cuentas = StorageService.get("cuentasPorCobrar", []);
    const hoy = new Date();

    let posMeses = {};
    for (let i = 0; i < 12; i++) {
        const fecha = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
        const clave = window.formatearFechaCortaMX ? window.formatearFechaCortaMX(fecha).substring(3) : fecha.toLocaleDateString().substring(3);
        posMeses[clave] = { total: 0, esperado: 0, recaudado: 0, vencidos: 0, pagaresDetalle: [], label: fecha.toLocaleDateString('es-MX', { month: 'long', year: 'numeric'}) };
    }

    pagares.forEach(p => {
        if (p.estado === "Pendiente" || p.estado === "Parcial") {
            const fechaPago = new Date(p.fechaVencimiento);
            const clave = window.formatearFechaCortaMX ? window.formatearFechaCortaMX(fechaPago).substring(3) : fechaPago.toLocaleDateString().substring(3);
            
            if (!posMeses[clave]) {
                posMeses[clave] = { total: 0, esperado: 0, recaudado: 0, vencidos: 0, pagaresDetalle: [], label: fechaPago.toLocaleDateString('es-MX', { month: 'long', year: 'numeric'}) };
            }

            const montoRestante = (p.monto || 0) - (p.montoAbonado || 0);

            if (montoRestante > 0) {
                posMeses[clave].esperado += montoRestante;
                posMeses[clave].total += montoRestante;
                posMeses[clave].pagaresDetalle.push(p);
                
                if (fechaPago < hoy) posMeses[clave].vencidos += montoRestante;
            }
        }
    });

    cuentas.forEach(cuenta => {
        if (cuenta.abonos && Array.isArray(cuenta.abonos)) {
            cuenta.abonos.forEach(abono => {
                // 🛡️ REPARACIÓN: Parseo seguro para esquivar el bug de DD/MM/YYYY
                let fAbono;
                if (typeof abono.fecha === 'string' && abono.fecha.includes('/')) {
                    const p = abono.fecha.split('/');
                    fAbono = new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]), 12, 0, 0);
                } else {
                    fAbono = new Date(abono.fecha);
                }

                if (isNaN(fAbono.getTime())) return; // Protege contra strings vacíos o corruptos

                const clave = window.formatearFechaCortaMX ? window.formatearFechaCortaMX(fAbono).substring(3) : fAbono.toLocaleDateString('es-MX').substring(3);

                if (!posMeses[clave]) {
                    posMeses[clave] = { total: 0, esperado: 0, recaudado: 0, vencidos: 0, pagaresDetalle: [], label: fAbono.toLocaleDateString('es-MX', { month: 'long', year: 'numeric'}) };
                }

                posMeses[clave].recaudado += abono.monto;
                posMeses[clave].total += abono.monto;
            });
        }
    });

    let html = `<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap:20px;">`;

    Object.entries(posMeses).forEach(([mesClave, datos]) => {
        if (datos.total === 0) return; 

        const baseCalculo = datos.esperado + datos.recaudado;
        const porcentajeRecaudo = baseCalculo > 0 ? (datos.recaudado / baseCalculo * 100).toFixed(1) : 0;
        
        const colorMes = datos.vencidos > 0 ? "#fee2e2" : "#f0fdf4";
        const iconoMes = datos.vencidos > 0 ? "🔴" : "✅";
        const mesEncoded = encodeURIComponent(mesClave);

        html += `<div style="background:${colorMes}; padding:20px; border-radius:10px; border-left:5px solid ${datos.vencidos > 0 ? '#dc2626' : '#27ae60'}; cursor:pointer;" onclick="abrirDetalleCobranza('${mesEncoded}')">
            <h4 style="margin:0 0 15px 0; color:#2c3e50;">${iconoMes} ${datos.label.toUpperCase()}</h4>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:15px;">
                <div><small style="color:#718096;">Falta por Cobrar</small><br><strong style="font-size:18px; color:#2c3e50;">${_cxcDinero(datos.esperado)}</strong></div>
                <div><small style="color:#718096;">Real Recaudado</small><br><strong style="font-size:18px; color:#27ae60;">${_cxcDinero(datos.recaudado)}</strong></div>
            </div>
            <div style="background:white; border-radius:8px; overflow:hidden; height:8px; margin-bottom:10px;">
                <div style="background:#27ae60; height:100%; width:${porcentajeRecaudo > 100 ? 100 : porcentajeRecaudo}%;"></div>
            </div>
            <small style="color:#718096;">${porcentajeRecaudo}% del flujo captado</small>
            ${datos.vencidos > 0 ? `<p style="color:#dc2626; font-weight:bold; margin:10px 0 0 0;">⚠️ ${_cxcDinero(datos.vencidos)} VENCIDO</p>` : ''}
            <p style="color:#718096; font-size:12px; margin:8px 0 0 0;">👆 Clic para ver detalle</p>
        </div>`;
    });

    html += `</div>`;
    contenedor.innerHTML = html;
}

function abrirDetalleCobranza(mesKeyEncoded) {
    const mesClave = decodeURIComponent(mesKeyEncoded);
    const pagares = StorageService.get("pagaresSistema", []);
    const cuentas = StorageService.get("cuentasPorCobrar", []);
    const hoy = new Date();

    const pagaresMes = pagares.filter(p => {
        const fechaPago = new Date(p.fechaVencimiento);
        const clave = window.formatearFechaCortaMX ? window.formatearFechaCortaMX(fechaPago).substring(3) : fechaPago.toLocaleDateString().substring(3);
        return clave === mesClave;
    });

    if (pagaresMes.length === 0) {
        alert("No hay pagarés para este mes.");
        return;
    }

    let filasHtml = pagaresMes.map(p => {
        const venc = new Date(p.fechaVencimiento);
        const diasAtraso = p.estado !== "Pagado" && venc < hoy ? Math.floor((hoy - venc) / (1000 * 60 * 60 * 24)) : 0;
        
        let atrasoHtml = '';
        if (p.estado === "Pagado") atrasoHtml = `<span style="color:#27ae60; font-weight:bold; font-size:12px;">✅ Pagado</span>`;
        else if (diasAtraso > 0) atrasoHtml = `<span style="color:#dc2626; font-weight:bold; font-size:12px;">⚠️ Vencido (${diasAtraso}d)</span>`;
        else atrasoHtml = `<span style="color:#92400e; font-weight:bold; font-size:12px;">⏳ Pendiente</span>`;

        const cuenta = cuentas.find(c => c.folio === p.folio);
        const clienteNombre = cuenta ? (cuenta.nombre || cuenta.clienteNombre) : (p.clienteNombre || p.folio || '-');
        const articulos = cuenta ? (cuenta.articulos || []) : [];
        const articulosHtml = articulos.length > 0
            ? articulos.map(a => `<small>${a.nombre || a.productoNombre || '-'} ×${a.cantidad || 1}</small>`).join(', ')
            : '<small style="color:#999;">Sin detalle</small>';

        const fmtFechaVenc = window.formatearFechaCortaMX ? window.formatearFechaCortaMX(p.fechaVencimiento) : new Date(p.fechaVencimiento).toLocaleDateString();

        return `<tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:8px;">${p.folio || '-'}</td>
            <td style="padding:8px;"><strong>${clienteNombre}</strong></td>
            <td style="padding:8px;">${fmtFechaVenc}</td>
            <td style="padding:8px; text-align:right; font-weight:bold;">${_cxcDinero(p.monto || 0)}</td>
            <td style="padding:8px; text-align:center;">${atrasoHtml}</td>
            <td style="padding:8px; font-size:12px; color:#4a5568;">${articulosHtml}</td>
        </tr>`;
    }).join('');

    const modalHTML = `
        <div data-modal="detalle-cobranza" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:6000; display:flex; justify-content:center; align-items:flex-start; overflow-y:auto; padding:20px;">
            <div style="background:white; border-radius:15px; width:100%; max-width:800px; overflow:hidden;">
                <div style="display:flex; justify-content:space-between; align-items:center; padding:20px 30px; border-bottom:1px solid #e5e7eb; position:sticky; top:0; background:white; z-index:2;">
                    <h2 style="margin:0;">📅 Detalle Cobranza — ${mesClave}</h2>
                    <button onclick="document.querySelector('[data-modal=&quot;detalle-cobranza&quot;]')?.remove();" style="background:none; border:none; font-size:22px; cursor:pointer; color:#6b7280;">✕</button>
                </div>
                <div style="padding:20px 30px;">
                <div style="overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse; font-size:14px;">
                        <thead><tr style="background:#f3f4f6;">
                            <th style="padding:8px; text-align:left;">Folio</th>
                            <th style="padding:8px; text-align:left;">Cliente</th>
                            <th style="padding:8px; text-align:left;">Vencimiento</th>
                            <th style="padding:8px; text-align:right;">Monto</th>
                            <th style="padding:8px; text-align:center;">Estado</th>
                            <th style="padding:8px; text-align:left;">Productos</th>
                        </tr></thead>
                        <tbody>${filasHtml}</tbody>
                    </table>
                </div>
                <div style="margin-top:20px; text-align:right;">
                    <button onclick="document.querySelector('[data-modal=&quot;detalle-cobranza&quot;]')?.remove();" style="padding:10px 20px; background:#6b7280; color:white; border:none; border-radius:6px; cursor:pointer;">✕ Cerrar</button>
                </div>
                </div>
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function exportarCobranzaEsperada() {
    const pagares = StorageService.get("pagaresSistema", []);
    const hoy = new Date();
    let csv = "Folio,Fecha Vencimiento,Monto,Estado,Dias Atraso\n";
    
    pagares.forEach(p => {
        let venc = new Date(p.fechaVencimiento);
        const esPendiente = p.estado !== "Pagado" && p.estado !== "Cancelado";
        const diasAtraso = esPendiente && venc < hoy ? Math.floor((hoy - venc) / (1000 * 60 * 60 * 24)) : 0;
            
        const fechaFormat = window.formatearFechaCortaMX ? window.formatearFechaCortaMX(venc) : venc.toLocaleDateString();
        csv += `${p.folio},${fechaFormat},${p.monto},${p.estado},${diasAtraso}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `cobranza_${window.obtenerHoyInputMX ? window.obtenerHoyInputMX() : (window.getFechaLocalMX ? window.getFechaLocalMX(new Date()) : new Date().toISOString().split('T')[0])}.csv`);
    link.click();
}

function renderClientesMorosos() { renderCuentasXCobrar('', 'Atrasado'); }
function exportarMorososCSV() { exportarCobranzaEsperada(); }
function abrirHistorialAbonos(folio) { abrirEstadoCuentaFolio(folio); }

function reimprimirTicketAbono(folio, indexAbono) {
    const cuentas = StorageService.get("cuentasPorCobrar", []);
    const pagaresSistema = StorageService.get("pagaresSistema", []);
    const cuenta = cuentas.find(c => c.folio === folio);
    if (!cuenta) return alert("Cuenta no encontrada.");

    const abonos = cuenta.abonos || [];
    if (indexAbono < 0 || indexAbono >= abonos.length) return alert("Abono no encontrado.");

    const abono = abonos[indexAbono];
    const pagaresDelFolio = pagaresSistema.filter(p => p.folio === folio);
    const pagaresPendientes = pagaresDelFolio.filter(p => p.estado !== "Pagado" && p.estado !== "Cancelado");
    const estadoCta = typeof window._calcularEstadoCuenta === 'function' ? window._calcularEstadoCuenta(folio) : null;
    const saldoActual = Number(estadoCta?.saldoTotal ?? pagaresPendientes.reduce((s, p) => s + (p.monto - (p.montoAbonado || 0)), 0));

    generarTicketAbonoTermico({
        folio: folio,
        cliente: { nombre: cuenta.nombre, telefono: cuenta.telefono || '', direccion: cuenta.direccion || '' },
        montoAbono: abono.monto || 0,
        nuevoSaldo: saldoActual,
        fecha: window.formatearFechaCortaMX ? window.formatearFechaCortaMX(abono.fecha) : new Date(abono.fecha).toLocaleDateString(),
        metodoCobro: abono.etiquetaCuenta || abono.medioPago || 'Efectivo',
        cuentaDestino: abono.cuentaId || abono.etiquetaCuenta || '',
        pagaresCubiertos: pagaresDelFolio.filter(p => p.estado === "Pagado"),
        pagaresRestantes: pagaresPendientes,
        articulos: cuenta.articulos || [],
        totalVenta: Number(cuenta.totalContadoOriginal || cuenta.saldoOriginal || 0),
        enganche: Number(cuenta.engancheRecibido || 0)
    });
}

// ==========================================
// 5. AUDITORÍA Y CORRECCIÓN DE ABONOS
// ==========================================
window.renderAuditoriaAbonos = function() {
    const cont = document.getElementById('auditoria-abonos');
    if (!cont) return;

    cont.innerHTML = ""; 

    const filtroCliente = (window._filtroAbnCliente || "").toLowerCase();
    const filtroStatus = window._filtroAbnStatus || "todas";
    const segmentar = window._filtroAbnSegmentar === undefined ? true : window._filtroAbnSegmentar;

    const cuentas = StorageService.get("cuentasPorCobrar", []);

    let cuentasFiltradas = cuentas.filter(c => {
        const matchCliente = (c.nombre || "").toLowerCase().includes(filtroCliente);
        const matchStatus = filtroStatus === "todas" || c.estado === filtroStatus;
        return matchCliente && matchStatus && c.abonos && c.abonos.length > 0;
    });

    let htmlControles = `
        <div style="background:white; padding:20px; border-radius:12px; box-shadow:0 2px 10px rgba(0,0,0,0.05); margin-bottom:20px; display:flex; flex-wrap:wrap; gap:20px; align-items:flex-end;">
            <div style="flex:1; min-width:250px;">
                <label style="font-size:11px; font-weight:bold; color:#64748b; display:block; margin-bottom:5px;">🔍 BUSCAR CLIENTE:</label>
                <input type="text" id="searchClienteAbn" value="${window._filtroAbnCliente || ''}" 
                    oninput="window._filtroAbnCliente=this.value; renderAuditoriaAbonos();" 
                    placeholder="Nombre del cliente..." 
                    style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px;">
            </div>
            <div>
                <label style="font-size:11px; font-weight:bold; color:#64748b; display:block; margin-bottom:5px;">📉 STATUS:</label>
                <select onchange="window._filtroAbnStatus=this.value; renderAuditoriaAbonos();" style="padding:10px; border-radius:8px; border:1px solid #cbd5e1; background:white;">
                    <option value="todas" ${filtroStatus==='todas'?'selected':''}>Todas</option>
                    <option value="Saldado" ${filtroStatus==='Saldado'?'selected':''}>Saldadas</option>
                    <option value="Pendiente" ${filtroStatus==='Pendiente'?'selected':''}>Pendientes</option>
                </select>
            </div>
            <div style="display:flex; align-items:center; gap:10px; padding-bottom:10px; border-left:1px solid #e2e8f0; padding-left:20px;">
                <input type="checkbox" ${segmentar ? 'checked' : ''} onchange="window._filtroAbnSegmentar=this.checked; renderAuditoriaAbonos();">
                <span style="font-size:12px; font-weight:bold; color:#475569;">Segmentar por Venta</span>
            </div>
        </div>
    `;

    let htmlCuerpo = "";
    if (segmentar) {
        htmlCuerpo = cuentasFiltradas.map(c => {
            let filas = c.abonos.map((ab, idx) => `
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:10px; font-size:12px;">${window.formatearFechaCortaMX ? window.formatearFechaCortaMX(ab.fecha) : new Date(ab.fecha).toLocaleDateString()}</td>
                    <td style="padding:10px; font-weight:bold; color:#16a34a;">${_cxcDinero(ab.monto)}</td>
                    <td style="padding:10px; font-size:11px; color:#64748b;">${ab.etiquetaCuenta || ab.medioPago || 'Efectivo'}</td>
                    <td style="padding:10px; text-align:right;">
                        <button onclick="abrirEditorAbono('${c.folio}', ${idx})" style="padding:6px 10px; background:#1e3a8a; color:white; border:none; border-radius:6px; cursor:pointer; font-size:11px;">Corregir</button>
                        <button onclick="eliminarAbonoAuditoriaCxC('${c.folio}', ${idx})" style="padding:6px 10px; background:#b91c1c; color:white; border:none; border-radius:6px; cursor:pointer; font-size:11px; margin-left:5px;">Eliminar</button>
                    </td>
                </tr>
            `).join('');

            return `
                <div style="background:white; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.05); margin-bottom:20px; overflow:hidden; border:1px solid #e2e8f0;">
                    <div style="background:#0f172a; color:white; padding:12px 20px; display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:14px; font-weight:bold;">${c.nombre} (Folio: ${c.folio})</span>
                        <span style="font-size:11px;">Fecha Venta: ${c.fecha || '—'} | Status: ${c.estado}</span>
                    </div>
                    <table style="width:100%; border-collapse:collapse;">
                        <thead style="background:#f8fafc; font-size:10px; color:#64748b; text-transform:uppercase;">
                            <tr><th style="padding:10px; text-align:left;">Fecha Pago</th><th style="padding:10px; text-align:left;">Importe</th><th style="padding:10px; text-align:left;">Cuenta</th><th style="padding:10px; text-align:right;">Acción</th></tr>
                        </thead>
                        <tbody>${filas}</tbody>
                    </table>
                </div>`;
        }).join('');
    } else {
        let todos = [];
        cuentasFiltradas.forEach(c => c.abonos.forEach((ab, idx) => {
            todos.push({ folio: c.folio, cliente: c.nombre, abonoIdx: idx, fecha: ab.fecha, monto: ab.monto, cuenta: ab.etiquetaCuenta || ab.medioPago || 'Efectivo' });
        }));
        
        // 🛡️ REPARACIÓN: Ordenamiento seguro para evitar 'Invalid Date' y NaN
        todos.sort((a,b) => {
            const parseD = (f) => {
                if (typeof f === 'string' && f.includes('/')) {
                    const p = f.split('/');
                    return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]), 12, 0, 0).getTime();
                }
                return new Date(f).getTime() || 0;
            };
            return parseD(b.fecha) - parseD(a.fecha);
        });
        
        let filasPlanos = todos.map(a => `
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:12px; font-size:12px;">${window.formatearFechaCortaMX ? window.formatearFechaCortaMX(a.fecha) : new Date(a.fecha).toLocaleDateString()}</td>
                <td style="padding:12px;"><b>${a.cliente}</b> <small>(Folio: ${a.folio})</small></td>
                <td style="padding:12px; font-weight:bold; color:#16a34a;">${_cxcDinero(a.monto)}</td>
                <td style="padding:12px; font-size:11px;">${a.cuenta}</td>
                <td style="padding:12px; text-align:right;">
                    <button onclick="abrirEditorAbono('${a.folio}', ${a.abonoIdx})" style="padding:6px 10px; background:#1e3a8a; color:white; border:none; border-radius:6px; cursor:pointer; font-size:11px;">Corregir</button>
                    <button onclick="eliminarAbonoAuditoriaCxC('${a.folio}', ${a.abonoIdx})" style="padding:6px 10px; background:#b91c1c; color:white; border:none; border-radius:6px; cursor:pointer; font-size:11px; margin-left:5px;">Eliminar</button>
                </td>
            </tr>`).join('');
        htmlCuerpo = `<div style="background:white; border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.05); overflow:hidden;"><table style="width:100%; border-collapse:collapse;"><thead style="background:#0f172a; color:white; font-size:11px;"><tr><th style="padding:15px; text-align:left;">Fecha Abono</th><th style="padding:15px; text-align:left;">Cliente</th><th style="padding:15px; text-align:left;">Importe</th><th style="padding:15px; text-align:left;">Cuenta</th><th style="padding:15px; text-align:right;">Acción</th></tr></thead><tbody>${filasPlanos}</tbody></table></div>`;
    }

    cont.innerHTML = `<div style="max-width:1200px; margin:0 auto;">${htmlControles}${htmlCuerpo}</div>`;
};

window.abrirEditorAbono = function(folio, abonoIndex) {
    const cuentas = StorageService.get("cuentasPorCobrar", []);
    const cuenta = cuentas.find(c => c.folio === folio);
    if (!cuenta) return;
    
    const abono = cuenta.abonos[abonoIndex];
    if (!abono) return;

    const cuentaActualId = abono.cuentaId || abono.medioPago || 'efectivo';
    const opcionesCuentas = _cxcOpcionesCuentasReceptoras(cuentaActualId, abono.etiquetaCuenta || '');

    const fechaBaseEditor = _cxcFechaAbonoBase(abono) || abono.fecha;
    const fechaEditorObj = window.parseFechaMX ? window.parseFechaMX(fechaBaseEditor) : new Date(fechaBaseEditor);
    let valorFechaFormato = window.fechaParaInput
        ? window.fechaParaInput(fechaEditorObj)
        : (isNaN(fechaEditorObj.getTime()) ? new Date() : fechaEditorObj).toISOString().slice(0, 16);

    const html = `
    <div id="modalCorreccionAbono" style="position:fixed; inset:0; background:rgba(15,23,42,0.8); z-index:10000; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
        <div style="background:white; padding:30px; border-radius:16px; width:90%; max-width:450px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
            <h3 style="margin:0 0 5px 0; color:#1e40af;">✏️ Corrección de Abono</h3>
            <p style="font-size:13px; color:#64748b; margin-top:0;">Venta: <b>${folio}</b> | Cliente: <b>${cuenta.nombre}</b></p>
            
            <div style="margin-top:20px;">
                <label style="display:block; font-size:11px; font-weight:bold; color:#475569;">FECHA DEL MOVIMIENTO:</label>
                <input type="datetime-local" id="editFechaAbn" value="${valorFechaFormato}" style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1; margin-top:5px; box-sizing:border-box;">
            </div>

            <div style="margin-top:15px;">
                <label style="display:block; font-size:11px; font-weight:bold; color:#475569;">IMPORTE DEL ABONO ($):</label>
                <input type="number" id="editMontoAbn" value="${abono.monto}" style="width:100%; padding:12px; border-radius:8px; border:2px solid #3b82f6; margin-top:5px; font-size:18px; font-weight:bold; box-sizing:border-box; color:#1e40af;">
            </div>

            <div style="margin-top:15px;">
                <label style="display:block; font-size:11px; font-weight:bold; color:#475569;">CUENTA RECEPTORA:</label>
                <select id="editCuentaAbn" style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1; margin-top:5px; font-size:14px;">
                    ${opcionesCuentas}
                </select>
            </div>

            <div style="background:#fffbeb; padding:12px; border-radius:8px; margin-top:20px; border:1px solid #fcd34d;">
                <p style="margin:0; font-size:12px; color:#92400e;">⚠️ <b>Atención:</b> Los pagarés se resetearán y se volverán a cubrir desde el #1 con el nuevo saldo total. El movimiento en "Flujo de Caja" se corregirá automáticamente.</p>
            </div>

            <div style="display:flex; gap:10px; margin-top:25px;">
                <button onclick="procesarCorreccionAbono('${folio}', ${abonoIndex})" 
                        style="flex:2; padding:14px; background:#2563eb; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:15px;">
                    💾 Guardar Cambios
                </button>
                <button onclick="document.getElementById('modalCorreccionAbono').remove()" 
                        style="flex:1; padding:14px; background:#f1f5f9; color:#475569; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">
                    Cancelar
                </button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

function _cxcAjustarSaldoCuentaPorCorreccion(cuentaId, delta) {
    const monto = Number(delta || 0);
    if (!Number.isFinite(monto) || Math.abs(monto) <= 0.009) return true;

    const cuentaRealId = (cuentaId === 'caja') ? 'efectivo' : (cuentaId || 'efectivo');
    const isCaja = String(cuentaRealId).startsWith('caja_') || cuentaRealId === 'efectivo';

    if (isCaja) {
        const cuentasEfectivo = StorageService.get('cuentasEfectivo', [{ id: 'efectivo', nombre: 'Efectivo Principal', saldo: 0 }]);
        let idx = cuentasEfectivo.findIndex(c => String(c.id) === String(cuentaRealId));
        if (idx === -1 && cuentaRealId === 'efectivo' && cuentasEfectivo.length > 0) idx = 0;
        if (idx === -1) return false;

        cuentasEfectivo[idx].saldo = (Number(cuentasEfectivo[idx].saldo) || 0) + monto;
        StorageService.set('cuentasEfectivo', cuentasEfectivo);
        return true;
    }

    const cuentasBanco = StorageService.get('cuentas-bancarias', []);
    const idx = cuentasBanco.findIndex(c => String(c.id) === String(cuentaRealId) || String(c.banco) === String(cuentaRealId));
    if (idx === -1) return false;

    cuentasBanco[idx].saldo = (Number(cuentasBanco[idx].saldo) || 0) + monto;
    StorageService.set('cuentas-bancarias', cuentasBanco);
    return true;
}

function _cxcOpcionesCuentasReceptoras(seleccionId = '', seleccionEtiqueta = '') {
    const esc = _cxcEscHTML;
    const cajas = StorageService.get('cuentasEfectivo', [
        { id: 'efectivo', nombre: 'Efectivo Principal', saldo: 0 }
    ]);

    const tarjetas = StorageService.get('tarjetasConfig', []);
    const debitoMaestro = tarjetas.filter(t => String(t.tipo || '').toLowerCase() === 'debito');
    let bancarias = StorageService.get('cuentas-bancarias', []);

    if (bancarias.length < debitoMaestro.length) {
        const reconstruidas = debitoMaestro.map((t, idx) => {
            const previa = bancarias.find(c => String(c.banco || c.id) === String(t.banco));
            return {
                id: previa?.id || `debito_${idx}_${t.banco}`,
                nombre: previa?.nombre || `🏦 ${t.banco}${t.ultimos4 ? ' ••••' + t.ultimos4 : ''}`,
                tipo: 'debito',
                banco: t.banco,
                ultimos4: t.ultimos4 || previa?.ultimos4 || '',
                saldo: Number(previa?.saldo || t.saldoInicial || 0),
                saldoInicial: Number(previa?.saldoInicial || t.saldoInicial || 0)
            };
        });
        bancarias = reconstruidas;
        StorageService.set('cuentas-bancarias', bancarias);
    }

    const normal = v => String(v || '').replace(/[^\wÁÉÍÓÚÜÑáéíóúüñ]+/g, '').toLowerCase();
    const seleccionado = normal(seleccionId);
    const etiquetaSel = normal(seleccionEtiqueta);
    const esSel = (value, label, extra = '') => {
        const v = normal(value);
        const l = normal(label);
        const e = normal(extra);
        return !!seleccionado && (seleccionado === v || seleccionado === e || seleccionado === l)
            || !!etiquetaSel && (etiquetaSel === l || etiquetaSel === e || etiquetaSel.includes(l) || l.includes(etiquetaSel));
    };

    const optsCajas = cajas.map(c => {
        const value = c.id || 'efectivo';
        const label = c.nombre || 'Efectivo Principal';
        return `<option value="${esc(value)}" data-nombre="${esc(label)}" ${esSel(value, label) ? 'selected' : ''}>${esc(label)}</option>`;
    });

    const optsDebito = bancarias
        .filter(c => String(c.tipo || '').toLowerCase().includes('debito') || c.banco)
        .map(c => {
            const value = c.banco || c.id;
            const label = c.nombre || `🏦 ${c.banco || c.id}`;
            return `<option value="${esc(value)}" data-nombre="${esc(label)}" ${esSel(value, label, c.id) ? 'selected' : ''}>${esc(label)}</option>`;
        });

    return [...optsCajas, ...optsDebito].join('') || '<option value="efectivo" data-nombre="Efectivo Principal">Efectivo Principal</option>';
}

function _cxcAbonoVigente(a) {
    return a && !a.cancelado && !a.canceladoPorVenta && !a.canceladoPorApartado && !a.eliminadoAuditoria;
}

function _cxcMovimientosAbonoFolio(folio) {
    return StorageService.get("movimientosCaja", []).filter(m => String(m.referencia || '') === `ABONO-${folio}`);
}

function _cxcSnapshotSaldosAbonos(cuenta, movimientosPrevios = null) {
    const movs = Array.isArray(movimientosPrevios) ? movimientosPrevios : _cxcMovimientosAbonoFolio(cuenta.folio);
    if (movs.length) {
        return movs.map(m => ({
            cuentaId: m.cuenta || m.cuentaId || m.medioPago || 'efectivo',
            monto: Number(m.monto || 0)
        }));
    }
    return (cuenta.abonos || [])
        .filter(_cxcAbonoVigente)
        .map(a => ({
            cuentaId: a.cuentaId || a.medioPago || 'efectivo',
            monto: Number(a.monto || 0)
        }));
}

function _cxcRecrearMovimientosAbonos(cuenta) {
    let movimientosCaja = StorageService.get("movimientosCaja", []);
    movimientosCaja = movimientosCaja.filter(m => String(m.referencia || '') !== `ABONO-${cuenta.folio}`);
    (cuenta.abonos || []).filter(_cxcAbonoVigente).forEach((ab) => {
        movimientosCaja.push({
            id: Date.now() + Math.random(),
            folio: cuenta.folio,
            fecha: _cxcFechaAbonoBase(ab) || ab.fecha,
            monto: Number(ab.monto || 0),
            tipo: "ingreso",
            concepto: `Abono a ${cuenta.nombre || cuenta.clienteNombre || 'Cliente'} - ${cuenta.folio}`,
            referencia: `ABONO-${cuenta.folio}`,
            cuenta: ab.cuentaId || ab.medioPago || 'efectivo',
            medioPago: ab.medioPago || 'efectivo',
            etiquetaCuenta: ab.etiquetaCuenta || ab.medioPago || 'Efectivo',
            idOperacion: ab.idOperacion || ab.idCuarentena || ab.id || null,
            grupoConciliacion: ab.grupoConciliacion || '',
            referenciaBancaria: ab.referenciaBancaria || '',
            foliosGrupo: ab.grupoConciliacion ? [cuenta.folio] : []
        });
    });
    StorageService.set("movimientosCaja", movimientosCaja);
}

function _cxcRecalcularCuentaPorAbonos(cuenta, pagares) {
    cuenta.abonos = Array.isArray(cuenta.abonos) ? cuenta.abonos : [];
    const abonosVigentes = cuenta.abonos.filter(_cxcAbonoVigente);
    let bolsa = abonosVigentes.reduce((sum, a) => sum + Number(a.monto || 0), 0);
    const fechaUltimoAbono = _cxcFechaAbonoBase(abonosVigentes[abonosVigentes.length - 1]) || null;

    let pagaresFolio = pagares
        .filter(p => p.folio === cuenta.folio && (String(p.estado || '').toLowerCase() !== 'cancelado' || String(p.nota || '').toLowerCase().includes('liquidado por')))
        .sort((a,b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento));

    pagaresFolio.forEach(p => {
        p.montoAbonado = 0;
        p.fechaAbono = null;
        p.estado = "Pendiente";
        if (String(p.nota || '').toLowerCase().includes('liquidado por')) p.nota = '';

        const montoPagare = Number(p.monto || 0);
        if (bolsa >= montoPagare - 0.01) {
            p.estado = "Pagado";
            p.montoAbonado = montoPagare;
            p.fechaAbono = fechaUltimoAbono;
            bolsa -= montoPagare;
        } else if (bolsa > 0.01) {
            p.estado = "Parcial";
            p.montoAbonado = bolsa;
            p.fechaAbono = fechaUltimoAbono;
            bolsa = 0;
        }
    });

    cuenta.cargosMoratorios = (cuenta.cargosMoratorios || []).map(m => {
        if (m.cancelado || m.anulado || String(m.tipo || 'cargo') === 'exencion') return m;
        return { ...m, montoAbonado: 0, estado: Number(m.monto || 0) > 0.01 ? "Pendiente" : (m.estado || "Pendiente") };
    });
    _cxcAplicarPagoAMoratorios(cuenta, bolsa);

    const pagaresActualizados = pagares.map(p => {
        const mod = pagaresFolio.find(pf => pf.id === p.id);
        return mod ? mod : p;
    });

    const saldoPagares = pagaresActualizados
        .filter(p => p.folio === cuenta.folio && (p.estado === 'Pendiente' || p.estado === 'Parcial'))
        .reduce((s, p) => s + (p.estado === 'Parcial' ? Math.max(0, Number(p.monto || 0) - Number(p.montoAbonado || 0)) : Number(p.monto || 0)), 0);
    const saldoMoratorios = _cxcTotalMoratoriosPendientes(cuenta);
    cuenta.saldoActual = Math.max(0, saldoPagares + saldoMoratorios);
    if (cuenta.saldoActual <= 0.01) {
        cuenta.estado = "Saldado";
        cuenta.saldoActual = 0;
    } else if (cuenta.estado === "Saldado") {
        cuenta.estado = "Pendiente";
    }

    return pagaresActualizados;
}

window.eliminarAbonoAuditoriaCxC = function(folio, abonoIndex) {
    if (window.AuditService?.requireAdmin) {
        if (!window.AuditService.requireAdmin('eliminar abono CxC')) return;
    } else {
        const sesion = (() => { try { return JSON.parse(sessionStorage.getItem('sesionActiva') || 'null'); } catch { return null; } })();
        if (!sesion || (sesion.rol !== 'admin' && sesion.rol !== 'Administrador')) return alert("Acceso denegado: solo administradores.");
    }

    let cuentas = StorageService.get("cuentasPorCobrar", []);
    let pagares = StorageService.get("pagaresSistema", []);
    const idxCuenta = cuentas.findIndex(c => c.folio === folio);
    if (idxCuenta === -1) return alert("Cuenta no encontrada.");

    const cuenta = cuentas[idxCuenta];
    cuenta.abonos = Array.isArray(cuenta.abonos) ? cuenta.abonos : [];
    const abono = cuenta.abonos[abonoIndex];
    if (!abono || !_cxcAbonoVigente(abono)) return alert("El abono no existe o ya fue eliminado.");

    const monto = Number(abono.monto || 0);
    const msg = `ELIMINAR ABONO\n\nFolio: ${folio}\nCliente: ${cuenta.nombre || cuenta.clienteNombre || 'Cliente'}\nMonto: ${_cxcDinero(monto)}\n\nEsto quitara el abono del estado de cuenta, recalculara saldos/pagares y retirara el ingreso de caja/banco.\n\nDeseas continuar?`;
    if (!confirm(msg)) return;

    const motivo = prompt("Motivo de eliminacion del abono:");
    if (motivo === null) return;
    if (!String(motivo).trim()) return alert("El motivo es obligatorio para eliminar un abono.");

    const movimientosPrevios = _cxcMovimientosAbonoFolio(folio);
    const saldosPrevios = _cxcSnapshotSaldosAbonos(cuenta, movimientosPrevios);
    const abonoEliminado = cuenta.abonos.splice(abonoIndex, 1)[0];
    cuenta.abonosEliminados = cuenta.abonosEliminados || [];
    cuenta.abonosEliminados.push({
        ...abonoEliminado,
        eliminadoAuditoria: true,
        fechaEliminacion: window.localISO ? window.localISO(new Date()) : new Date().toISOString(),
        motivoEliminacion: String(motivo).trim()
    });

    pagares = _cxcRecalcularCuentaPorAbonos(cuenta, pagares);
    cuentas[idxCuenta] = cuenta;
    StorageService.set("cuentasPorCobrar", cuentas);
    StorageService.set("pagaresSistema", pagares);

    _cxcRecrearMovimientosAbonos(cuenta);

    let saldosActualizados = true;
    saldosPrevios.forEach(m => {
        if (!_cxcAjustarSaldoCuentaPorCorreccion(m.cuentaId, -Number(m.monto || 0))) saldosActualizados = false;
    });
    cuenta.abonos.filter(_cxcAbonoVigente).forEach(a => {
        if (!_cxcAjustarSaldoCuentaPorCorreccion(a.cuentaId || a.medioPago || 'efectivo', Number(a.monto || 0))) saldosActualizados = false;
    });

    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'ELIMINACION_ABONO_CXC',
            modulo: 'CxC',
            entidad: 'Abono',
            entidadId: `${folio}#${abonoIndex + 1}`,
            detalle: `Eliminacion de abono por ${_cxcDinero(monto)}. Motivo: ${String(motivo).trim()}`,
            monto,
            severidad: 'critica',
            datos: { abono: abonoEliminado, motivo: String(motivo).trim() }
        });
    }

    alert(saldosActualizados
        ? "Abono eliminado. Se reversaron saldo, estado de cuenta, pagares y flujo de caja."
        : "Abono eliminado, pero alguna cuenta de caja/banco no se encontro para ajustar saldo. Revisa Mis Cuentas.");
    if (typeof renderAuditoriaAbonos === 'function') renderAuditoriaAbonos();
    if (typeof renderCuentasXCobrar === 'function') renderCuentasXCobrar();
    if (typeof renderAbonosDirectos === 'function') renderAbonosDirectos();
    if (document.querySelector('[data-modal="auditoria-cxc"]') && window._auditCuentaActual?.folio === folio && typeof buscarVentaAuditoria === 'function') {
        const inputAudit = document.getElementById('auditFolioInput');
        if (inputAudit) inputAudit.value = folio;
        buscarVentaAuditoria();
    }
};

window.procesarCorreccionAbono = function(folio, abonoIndex) {
    if (window.AuditService?.requireAdmin) {
        if (!window.AuditService.requireAdmin('corregir abono CxC')) return;
    } else {
        const sesion = (() => { try { return JSON.parse(sessionStorage.getItem('sesionActiva') || 'null'); } catch { return null; } })();
        if (!sesion || (sesion.rol !== 'admin' && sesion.rol !== 'Administrador')) return alert("Acceso denegado: solo administradores.");
    }

    const nuevaFecha = document.getElementById('editFechaAbn').value;
    const nuevoMonto = parseFloat(document.getElementById('editMontoAbn').value);
    const selCuenta = document.getElementById('editCuentaAbn');
    
    if (isNaN(nuevoMonto) || nuevoMonto <= 0) return alert("Importe inválido.");

    const cuentaId = selCuenta.value;
    const etiqueta = selCuenta.options[selCuenta.selectedIndex].getAttribute('data-nombre') || selCuenta.options[selCuenta.selectedIndex].text || cuentaId;
    const isCajaDestino = String(cuentaId).startsWith('caja_') || cuentaId === 'efectivo';
    const medioPago = isCajaDestino ? 'efectivo' : 'transferencia';

    let cuentas = StorageService.get("cuentasPorCobrar", []);
    let pagares = StorageService.get("pagaresSistema", []);
    let movimientosCaja = StorageService.get("movimientosCaja", []);

    let cuenta = cuentas.find(c => c.folio === folio);
    if (!cuenta) return;
    cuenta.abonos = Array.isArray(cuenta.abonos) ? cuenta.abonos : [];
    if (!cuenta.abonos[abonoIndex]) return alert("No se encontro el abono a corregir.");
    const abonoAnterior = { ...cuenta.abonos[abonoIndex] };

    const fechaObj = nuevaFecha
        ? new Date(nuevaFecha.includes('T') ? nuevaFecha : `${nuevaFecha}T12:00:00`)
        : new Date();
    if (isNaN(fechaObj.getTime())) return alert("Fecha invalida.");
    const nuevaFechaIso = window.localISO ? window.localISO(fechaObj) : fechaObj.toISOString();
    const nuevaFechaVisible = _cxcFechaCorta(fechaObj);

    const movimientosAbonoPrevios = _cxcMovimientosAbonoFolio(folio);
    const saldosPrevios = _cxcSnapshotSaldosAbonos(cuenta, movimientosAbonoPrevios);

    cuenta.abonos[abonoIndex].fecha = nuevaFechaVisible;
    cuenta.abonos[abonoIndex].fechaAbonoIso = nuevaFechaIso;
    cuenta.abonos[abonoIndex].fechaAbonoStr = nuevaFechaVisible;
    cuenta.abonos[abonoIndex].monto = nuevoMonto;
    cuenta.abonos[abonoIndex].cuentaId = cuentaId;
    cuenta.abonos[abonoIndex].medioPago = medioPago;
    cuenta.abonos[abonoIndex].etiquetaCuenta = etiqueta;

    pagares = _cxcRecalcularCuentaPorAbonos(cuenta, pagares);

    StorageService.set("cuentasPorCobrar", cuentas);
    StorageService.set("pagaresSistema", pagares);
    _cxcRecrearMovimientosAbonos(cuenta);

    let saldosActualizados = true;
    saldosPrevios.forEach(m => {
        if (!_cxcAjustarSaldoCuentaPorCorreccion(m.cuentaId, -Number(m.monto || 0))) saldosActualizados = false;
    });
    cuenta.abonos.filter(_cxcAbonoVigente).forEach(ab => {
        if (!_cxcAjustarSaldoCuentaPorCorreccion(ab.cuentaId || ab.medioPago || 'efectivo', Number(ab.monto || 0))) saldosActualizados = false;
    });

    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'CORRECCION_ABONO_CXC',
            modulo: 'CxC',
            entidad: 'Abono',
            entidadId: `${folio}#${abonoIndex + 1}`,
            detalle: `Correccion de abono: monto ${_cxcDinero(abonoAnterior.monto || 0)} -> ${_cxcDinero(nuevoMonto)}; fecha ${abonoAnterior.fechaAbonoStr || abonoAnterior.fecha || '-'} -> ${nuevaFechaVisible}; cuenta ${abonoAnterior.etiquetaCuenta || abonoAnterior.cuentaId || '-'} -> ${etiqueta}`,
            monto: nuevoMonto,
            severidad: 'riesgo',
            datos: { antes: abonoAnterior, despues: cuenta.abonos[abonoIndex] }
        });
    }

    document.getElementById('modalCorreccionAbono').remove();
    alert(saldosActualizados
        ? "Abono modificado con exito. Saldos, pagares, flujo de caja y cuentas fueron recalculados."
        : "Abono modificado, pero alguna cuenta destino no se encontro para ajustar su saldo. Revisa Mis Cuentas.");
    if (typeof renderAuditoriaAbonos === 'function') renderAuditoriaAbonos();
    if (document.querySelector('[data-modal="auditoria-cxc"]') && window._auditCuentaActual?.folio === folio && typeof buscarVentaAuditoria === 'function') {
        const inputAudit = document.getElementById('auditFolioInput');
        if (inputAudit) inputAudit.value = folio;
        buscarVentaAuditoria();
    }
};

// ==========================================
// ESTADO DE CUENTA PROFESIONAL / TICKET
// ==========================================
function _cxcEstadoCuentaFecha(valor) {
    return _cxcFechaVista(valor);
}

function _cxcEstadoCuentaAbonos(cuenta) {
    return (cuenta?.abonos || [])
        .filter(a => !a.cancelado && !a.canceladoPorVenta && !a.canceladoPorApartado)
        .slice()
        .sort((a, b) => {
            const fa = new Date(_cxcFechaClave(_cxcFechaAbonoBase(a)) || _cxcFechaAbonoBase(a) || 0).getTime() || 0;
            const fb = new Date(_cxcFechaClave(_cxcFechaAbonoBase(b)) || _cxcFechaAbonoBase(b) || 0).getTime() || 0;
            return fa - fb;
        });
}

function _cxcEstadoCuentaModelo(folio) {
    const estadoCta = window._calcularEstadoCuenta(folio);
    if (!estadoCta) return null;

    const cuenta = estadoCta.cuenta;
    const abonos = _cxcEstadoCuentaAbonos(cuenta);
    const articulos = Array.isArray(cuenta.articulos) ? cuenta.articulos : [];
    const precioContado = _cxcImporteContadoCuenta(cuenta);
    const enganche = Number(cuenta.engancheRecibido || cuenta.enganche || 0);
    const plan = cuenta.plan || cuenta.planCredito || {};
    const pagaresContrato = (estadoCta.pagares || []).filter(p => String(p.estado || '').toLowerCase() !== 'cancelado');
    const totalPagaresContrato = pagaresContrato.reduce((s, p) => s + Number(p.monto || 0), 0);
    const totalCredito = totalPagaresContrato > 0
        ? totalPagaresContrato
        : Math.max(
            Number(plan.total || 0),
            Number(cuenta.saldoOriginal || 0),
            Number(cuenta.totalCredito || cuenta.totalFinanciado || 0),
            Number(estadoCta.saldoTotal || 0)
        );
    const totalAbonos = abonos.reduce((s, a) => s + Number(a.monto || a.montoAbonado || 0), 0);
    const totalPagadoCliente = enganche + totalAbonos;
    const periodicidad = cuenta.periodicidad || plan.periodicidad || 'semanal';
    const pagosPlan = Number(plan.pagos || plan.plazo || plan.semanas || pagaresContrato.length || 0);
    const abonoPeriodo = Number(plan.abono || (pagosPlan ? totalCredito / pagosPlan : 0));
    const fechaVenta = cuenta.fechaVenta || cuenta.fecha || cuenta.fechaIso || '';
    const saldoActual = Number(estadoCta.saldoTotal || 0);
    const estatus = estadoCta.estadoGeneral || cuenta.estado || 'Activo';

    return {
        folio,
        cuenta,
        estadoCta,
        abonos,
        articulos,
        precioContado,
        totalCredito,
        enganche,
        totalAbonos,
        totalPagadoCliente,
        saldoActual,
        fechaVenta,
        estatus,
        periodicidad,
        pagosPlan,
        abonoPeriodo,
        montoVencido: Number(estadoCta.montoVencido || 0),
        diasMaxAtraso: Number(estadoCta.diasMaxAtraso || 0)
    };
}

function _cxcEstadoCuentaCondiciones(m) {
    const plazo = m.pagosPlan > 0
        ? `${m.pagosPlan} pago(s) con periodicidad ${m.periodicidad}`
        : `Periodicidad ${m.periodicidad}`;
    return [
        `Venta registrada el ${_cxcEstadoCuentaFecha(m.fechaVenta)} bajo folio ${m.folio}.`,
        `Plazo contratado: ${plazo}.`,
        `El saldo se determina con base en el total de credito, menos los abonos autorizados y registrados en sistema.`,
        `Los precios de contado corresponden a la venta original; cambios posteriores del catalogo no modifican este estado de cuenta.`,
        `Conserve este documento como referencia informativa. Cualquier aclaracion debe validarse contra recibos de pago y autorizaciones del sistema.`
    ];
}

function _cxcEstadoCuentaCss() {
    return `<style>
        .mmp-edo-wrap{font-family:Arial,Helvetica,sans-serif;color:#172033;background:#fff;max-width:860px;margin:0 auto;line-height:1.35;}
        .mmp-edo-head{background:#0f172a;color:white;padding:22px 26px;border-radius:14px 14px 0 0;display:flex;justify-content:space-between;gap:18px;align-items:flex-start;}
        .mmp-edo-brandbox{display:flex;align-items:center;gap:13px;}
        .mmp-edo-logo{width:56px;height:56px;object-fit:contain;background:white;border-radius:8px;padding:5px;flex:0 0 auto;}
        .mmp-edo-brand{font-size:22px;font-weight:900;letter-spacing:.03em;text-transform:uppercase;}
        .mmp-edo-sub{font-size:12px;color:#cbd5e1;margin-top:4px;}
        .mmp-edo-folio{text-align:right;font-size:13px;color:#dbeafe;}
        .mmp-edo-folio b{display:block;color:white;font-size:20px;margin-top:3px;}
        .mmp-edo-band{border:1px solid #dbe2ea;border-top:0;border-radius:0 0 14px 14px;padding:22px 26px;}
        .mmp-edo-row{display:grid;grid-template-columns:1.25fr .75fr;gap:18px;margin-bottom:18px;}
        .mmp-edo-box{border:1px solid #dbe2ea;background:#f8fafc;border-radius:10px;padding:14px;}
        .mmp-edo-label{font-size:10px;text-transform:uppercase;color:#64748b;font-weight:900;letter-spacing:.04em;margin-bottom:5px;}
        .mmp-edo-value{font-size:16px;font-weight:900;color:#0f172a;}
        .mmp-edo-status{display:inline-block;border-radius:999px;padding:6px 12px;font-size:11px;font-weight:900;text-transform:uppercase;}
        .mmp-edo-status.ok{background:#dcfce7;color:#166534;}.mmp-edo-status.warn{background:#fef3c7;color:#92400e;}.mmp-edo-status.bad{background:#fee2e2;color:#991b1b;}.mmp-edo-status.info{background:#dbeafe;color:#1e40af;}
        .mmp-edo-metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin:18px 0;}
        .mmp-edo-metric{border:1px solid #dbe2ea;border-radius:10px;padding:12px;background:white;min-height:78px;}
        .mmp-edo-metric strong{display:block;font-size:18px;color:#0f172a;margin-top:5px;}
        .mmp-edo-metric.primary{background:#eff6ff;border-color:#bfdbfe;}.mmp-edo-metric.green{background:#f0fdf4;border-color:#bbf7d0;}.mmp-edo-metric.red{background:#fff1f2;border-color:#fecdd3;}
        .mmp-edo-section{margin-top:20px;}.mmp-edo-title{font-size:14px;font-weight:900;color:#0f172a;text-transform:uppercase;letter-spacing:.03em;border-bottom:2px solid #0f172a;padding-bottom:7px;margin-bottom:10px;}
        .mmp-edo-table{width:100%;border-collapse:collapse;font-size:12px;}.mmp-edo-table th{background:#f1f5f9;color:#475569;text-align:left;padding:8px;border-bottom:1px solid #cbd5e1;text-transform:uppercase;font-size:10px;}.mmp-edo-table td{padding:9px 8px;border-bottom:1px solid #e2e8f0;vertical-align:top;}
        .mmp-edo-right{text-align:right;}.mmp-edo-center{text-align:center;}.mmp-edo-muted{color:#64748b;font-size:11px;}.mmp-edo-total{font-weight:900;color:#15803d;}.mmp-edo-saldo{font-weight:900;color:#be123c;}
        .mmp-edo-conditions{background:#f8fafc;border:1px solid #dbe2ea;border-radius:10px;padding:14px 16px;font-size:11px;color:#334155;}.mmp-edo-conditions ol{margin:0;padding-left:18px;}.mmp-edo-conditions li{margin:5px 0;}
        .mmp-edo-footer{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:28px;font-size:11px;color:#64748b;}.mmp-edo-sign{border-top:1px solid #0f172a;text-align:center;padding-top:8px;color:#0f172a;font-weight:900;}
        .mmp-edo-actions{position:sticky;top:0;z-index:5;background:#e2e8f0;padding:12px;border-radius:12px;margin-bottom:12px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;}.mmp-edo-actions button{border:0;border-radius:8px;padding:10px 15px;font-weight:900;cursor:pointer;}.mmp-edo-blue{background:#1e40af;color:white;}.mmp-edo-green{background:#047857;color:white;}.mmp-edo-gray{background:#f8fafc;color:#475569;}
        @media(max-width:760px){.mmp-edo-head,.mmp-edo-row{grid-template-columns:1fr;display:block}.mmp-edo-folio{text-align:left;margin-top:12px}.mmp-edo-metrics{grid-template-columns:repeat(2,minmax(0,1fr));}.mmp-edo-band{padding:16px}.mmp-edo-table{font-size:11px;}}
        @media print{.no-print,.mmp-edo-actions{display:none!important}.mmp-edo-wrap{max-width:none}.mmp-edo-head{border-radius:0}.mmp-edo-band{border-radius:0}}
    </style>`;
}

function _cxcEstadoCuentaStatusClass(estatus) {
    const e = String(estatus || '').toLowerCase();
    if (e.includes('sald')) return 'ok';
    if (e.includes('corriente')) return 'info';
    if (e.includes('promesa')) return 'warn';
    if (e.includes('atras') || e.includes('crit') || e.includes('venc')) return 'bad';
    return 'warn';
}

function _cxcEstadoCuentaProductosRows(m) {
    if (!m.articulos.length) {
        return `<tr><td colspan="4" class="mmp-edo-center mmp-edo-muted">Sin detalle de productos en esta venta.</td></tr>`;
    }
    return m.articulos.map(a => {
        const cantidad = Number(a.cantidad || 1);
        const precio = Number(a.precioContado || a.precio || 0);
        const contadoLinea = precio * cantidad;
        const totalVentaCredito = Number(m.totalCredito || 0) + Number(m.enganche || 0);
        const importeVenta = m.articulos.length === 1
            ? totalVentaCredito
            : (m.precioContado > 0 ? (contadoLinea / m.precioContado) * totalVentaCredito : contadoLinea);
        const color = a.colorElegido ? `<div class="mmp-edo-muted">Color: ${_cxcEscHTML(a.colorElegido)}</div>` : '';
        return `<tr><td><strong>${_cxcEscHTML(a.nombre || a.productoNombre || 'Producto')}</strong>${color}</td><td class="mmp-edo-center">${cantidad}</td><td class="mmp-edo-right">${_cxcDinero(precio)}</td><td class="mmp-edo-right"><strong>${_cxcDinero(importeVenta)}</strong></td></tr>`;
    }).join('');
}

function _cxcEstadoCuentaAbonosRows(m) {
    if (!m.abonos.length) {
        return `<tr><td colspan="5" class="mmp-edo-center mmp-edo-muted">Sin abonos registrados.</td></tr>`;
    }
    let saldo = Number(m.totalCredito || 0);
    return m.abonos.map((a, idx) => {
        const monto = Number(a.monto || a.montoAbonado || 0);
        saldo = Math.max(0, saldo - monto);
        return `<tr><td>${idx + 1}</td><td>${_cxcEstadoCuentaFecha(_cxcFechaAbonoBase(a))}</td><td>${_cxcEscHTML(a.etiquetaCuenta || a.medioPago || a.cuentaId || 'Efectivo')}</td><td class="mmp-edo-right mmp-edo-total">${_cxcDinero(monto)}</td><td class="mmp-edo-right mmp-edo-saldo">${_cxcDinero(saldo)}</td></tr>`;
    }).join('');
}

function _cxcEstadoCuentaHtml(m, opts = {}) {
    const condiciones = _cxcEstadoCuentaCondiciones(m).map(x => `<li>${_cxcEscHTML(x)}</li>`).join('');
    const statusClass = _cxcEstadoCuentaStatusClass(m.estatus);
    const alerta = m.montoVencido > 0
        ? `<div class="mmp-edo-box" style="background:#fef2f2;border-color:#fecaca;color:#991b1b;margin-top:12px;"><strong>Atencion:</strong> existe monto vencido por ${_cxcDinero(m.montoVencido)}${m.diasMaxAtraso ? `, con atraso maximo de ${m.diasMaxAtraso} dia(s)` : ''}.</div>`
        : '';
    return `${_cxcEstadoCuentaCss()}
    <div class="mmp-edo-wrap">
        <header class="mmp-edo-head">
            <div class="mmp-edo-brandbox">
                <img class="mmp-edo-logo" src="img/Logo.svg" alt="Mi Pueblito" onerror="this.style.display='none'">
                <div><div class="mmp-edo-brand">Muebleria Mi Pueblito</div><div class="mmp-edo-sub">Estado de cuenta de cliente</div></div>
            </div>
            <div class="mmp-edo-folio">Folio de venta<b>${_cxcEscHTML(m.folio)}</b><div>Emision: ${_cxcEstadoCuentaFecha(new Date())}</div></div>
        </header>
        <section class="mmp-edo-band">
            <div class="mmp-edo-row">
                <div class="mmp-edo-box"><div class="mmp-edo-label">Cliente</div><div class="mmp-edo-value">${_cxcEscHTML(m.cuenta.nombre || m.cuenta.clienteNombre || 'Cliente')}</div><div class="mmp-edo-muted">${_cxcEscHTML(m.cuenta.telefono || '')}${m.cuenta.direccion ? ` | ${_cxcEscHTML(m.cuenta.direccion)}` : ''}</div></div>
                <div class="mmp-edo-box"><div class="mmp-edo-label">Estatus de cuenta</div><span class="mmp-edo-status ${statusClass}">${_cxcEscHTML(m.estatus)}</span><div class="mmp-edo-muted" style="margin-top:8px;">Fecha de venta: <strong>${_cxcEstadoCuentaFecha(m.fechaVenta)}</strong></div></div>
            </div>

            <div class="mmp-edo-metrics">
                <div class="mmp-edo-metric"><div class="mmp-edo-label">Precio contado</div><strong>${_cxcDinero(m.precioContado)}</strong></div>
                <div class="mmp-edo-metric primary"><div class="mmp-edo-label">Total credito</div><strong>${_cxcDinero(m.totalCredito)}</strong></div>
                <div class="mmp-edo-metric"><div class="mmp-edo-label">Enganche</div><strong>${_cxcDinero(m.enganche)}</strong></div>
                <div class="mmp-edo-metric green"><div class="mmp-edo-label">Abonos recibidos</div><strong>${_cxcDinero(m.totalAbonos)}</strong></div>
                <div class="mmp-edo-metric ${m.saldoActual > 0 ? 'red' : 'green'}"><div class="mmp-edo-label">Saldo actual</div><strong>${_cxcDinero(m.saldoActual)}</strong></div>
            </div>

            <div class="mmp-edo-row">
                <div class="mmp-edo-box"><div class="mmp-edo-label">Condiciones de credito</div><div class="mmp-edo-value">${m.pagosPlan || '-'} pago(s) ${_cxcEscHTML(m.periodicidad)}</div><div class="mmp-edo-muted">Abono por periodo: ${m.abonoPeriodo ? _cxcDinero(m.abonoPeriodo) : '-'}</div></div>
                <div class="mmp-edo-box"><div class="mmp-edo-label">Total pagado por cliente</div><div class="mmp-edo-value">${_cxcDinero(m.totalPagadoCliente)}</div><div class="mmp-edo-muted">Enganche + abonos autorizados</div></div>
            </div>
            ${alerta}

            <div class="mmp-edo-section"><div class="mmp-edo-title">Productos de la venta</div><table class="mmp-edo-table"><thead><tr><th>Producto</th><th class="mmp-edo-center">Cant.</th><th class="mmp-edo-right">Precio contado</th><th class="mmp-edo-right">Importe venta</th></tr></thead><tbody>${_cxcEstadoCuentaProductosRows(m)}</tbody></table></div>
            <div class="mmp-edo-section"><div class="mmp-edo-title">Historial de abonos</div><table class="mmp-edo-table"><thead><tr><th>#</th><th>Fecha</th><th>Medio / cuenta</th><th class="mmp-edo-right">Importe</th><th class="mmp-edo-right">Saldo despues</th></tr></thead><tbody>${_cxcEstadoCuentaAbonosRows(m)}</tbody></table></div>
            <div class="mmp-edo-section"><div class="mmp-edo-title">Condiciones generales</div><div class="mmp-edo-conditions"><ol>${condiciones}</ol></div></div>
            <div class="mmp-edo-footer"><div>Documento informativo generado desde el sistema. No sustituye recibos individuales de abono.</div><div class="mmp-edo-sign">Cliente / Recibe</div></div>
        </section>
    </div>`;
}

function _cxcEstadoCuentaTicketBody(m) {
    const linea = '--------------------------------';
    const productos = m.articulos.length
        ? m.articulos.map(a => `${a.nombre || a.productoNombre || 'Producto'} x${a.cantidad || 1}\n  ${_cxcDinero(Number(a.precioContado || a.precio || 0))}`).join('\n')
        : 'Sin detalle de productos';
    const abonos = m.abonos.length
        ? m.abonos.map((a, idx) => `${idx + 1}. ${_cxcEstadoCuentaFecha(_cxcFechaAbonoBase(a))}  ${_cxcDinero(a.monto || a.montoAbonado || 0)}`).join('\n')
        : 'Sin abonos registrados';
    return `<div style="font-family:'Courier New',monospace;font-size:11px;line-height:1.25;color:#000;">
        <div style="text-align:center;"><img src="img/Logo.svg" alt="Mi Pueblito" style="width:48px;height:48px;object-fit:contain;" onerror="this.style.display='none'"></div>
        <div style="text-align:center;font-weight:bold;">MUEBLERIA MI PUEBLITO</div>
        <div style="text-align:center;">ESTADO DE CUENTA</div>
        <div>${linea}</div>
        <div>Folio: ${_cxcEscHTML(m.folio)}</div>
        <div>Cliente: ${_cxcEscHTML(m.cuenta.nombre || m.cuenta.clienteNombre || 'Cliente')}</div>
        <div>Fecha venta: ${_cxcEstadoCuentaFecha(m.fechaVenta)}</div>
        <div>Estatus: ${_cxcEscHTML(m.estatus)}</div>
        <div>${linea}</div>
        <div>Precio contado: ${_cxcDinero(m.precioContado)}</div>
        <div>Total credito : ${_cxcDinero(m.totalCredito)}</div>
        <div>Enganche      : ${_cxcDinero(m.enganche)}</div>
        <div>Abonos        : ${_cxcDinero(m.totalAbonos)}</div>
        <div>Saldo actual  : ${_cxcDinero(m.saldoActual)}</div>
        <div>Plazo         : ${m.pagosPlan || '-'} pago(s) ${_cxcEscHTML(m.periodicidad)}</div>
        <div>Abono periodo : ${m.abonoPeriodo ? _cxcDinero(m.abonoPeriodo) : '-'}</div>
        <div>${linea}</div>
        <div><b>PRODUCTOS</b></div>
        <pre style="font-family:'Courier New',monospace;white-space:pre-wrap;margin:3px 0;">${_cxcEscHTML(productos)}</pre>
        <div>${linea}</div>
        <div><b>ABONOS</b></div>
        <pre style="font-family:'Courier New',monospace;white-space:pre-wrap;margin:3px 0;">${_cxcEscHTML(abonos)}</pre>
        <div>${linea}</div>
        <div style="font-size:10px;">Los precios corresponden a la venta original. Documento informativo; conserve sus recibos de abono.</div>
    </div>`;
}

function abrirEstadoCuentaFolio(folio) {
    const modelo = _cxcEstadoCuentaModelo(folio);
    if (!modelo) return alert("No se encontro informacion de este folio.");
    const htmlDoc = _cxcEstadoCuentaHtml(modelo);
    const safeFolioId = String(folio).replace(/[^a-zA-Z0-9_-]/g, '-');
    const modalHTML = `
        <div data-modal="estado-cuenta-folio" style="position:fixed; inset:0; background:rgba(15,23,42,0.86); z-index:7000; display:flex; justify-content:center; align-items:flex-start; overflow-y:auto; padding:18px;">
            <div style="width:100%; max-width:930px; margin:auto;">
                <div class="mmp-edo-actions no-print">
                    <button class="mmp-edo-blue" onclick="emitirEstadoCuentaFolioTicket('${_cxcEscHTML(folio)}')">Imprimir ticket</button>
                    <button class="mmp-edo-blue" onclick="emitirEstadoCuentaFolioPdf('${_cxcEscHTML(folio)}')">PDF / A4</button>
                    <button id="btn-img-estado-folio-${safeFolioId}" class="mmp-edo-green" onclick="descargarImagenEstadoCuentaFolio('${_cxcEscHTML(folio)}')">Guardar imagen</button>
                    <button class="mmp-edo-gray" onclick="document.querySelector('[data-modal=estado-cuenta-folio]')?.remove()">Cerrar</button>
                </div>
                <div id="estadoCuentaFolioDoc">${htmlDoc}</div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function emitirEstadoCuentaFolioTicket(folio) {
    const modelo = _cxcEstadoCuentaModelo(folio);
    if (!modelo) return alert("No se encontro informacion de este folio.");
    const body = _cxcEstadoCuentaTicketBody(modelo);
    if (window.TicketService?.openThermal) {
        return window.TicketService.openThermal({ title: `Estado de Cuenta ${folio}`, filename: `estado_cuenta_${folio}`, body });
    }
    const w = window.open('', '_blank');
    if (!w) return alert('Habilita ventanas emergentes para imprimir el ticket.');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Estado de Cuenta ${_cxcEscHTML(folio)}</title></head><body>${body}</body></html>`);
    w.document.close();
    w.focus();
}

function _cxcClonarDocEstadoCuentaFolio(folio) {
    const docEl = document.getElementById('estadoCuentaFolioDoc');
    if (docEl?.querySelector('.mmp-edo-wrap')) {
        const clone = docEl.cloneNode(true);
        clone.removeAttribute('id');
        clone.style.width = '860px';
        clone.style.maxWidth = '860px';
        clone.style.background = '#ffffff';
        clone.style.boxSizing = 'border-box';
        return clone;
    }
    const modelo = _cxcEstadoCuentaModelo(folio);
    if (!modelo) return null;
    const wrap = document.createElement('div');
    wrap.innerHTML = _cxcEstadoCuentaHtml(modelo);
    wrap.style.width = '860px';
    wrap.style.maxWidth = '860px';
    wrap.style.background = '#ffffff';
    wrap.style.boxSizing = 'border-box';
    return wrap;
}

function _cxcCargarHtml2CanvasEstadoFolio(cb) {
    if (typeof html2canvas !== 'undefined') return cb();
    const existente = document.getElementById('html2canvas-estado-folio-cxc');
    if (existente) {
        existente.addEventListener('load', cb, { once: true });
        return;
    }
    const script = document.createElement('script');
    script.id = 'html2canvas-estado-folio-cxc';
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload = cb;
    script.onerror = () => alert('No se pudo cargar el motor de imagen. Revisa tu conexion o usa PDF / A4.');
    document.head.appendChild(script);
}

function emitirEstadoCuentaFolioPdf(folio) {
    const modelo = _cxcEstadoCuentaModelo(folio);
    if (!modelo) return alert("No se encontro informacion de este folio.");
    const htmlDoc = _cxcEstadoCuentaHtml(modelo);
    const opts = {
        title: `Estado de Cuenta ${folio}`,
        filename: `estado_cuenta_${folio}`,
        pageSize: 'letter',
        autoPrint: true
    };
    if (window.TicketService?.openDocument) {
        return window.TicketService.openDocument(htmlDoc, opts);
    }
    const w = window.open('', '_blank');
    if (!w) return alert('Habilita ventanas emergentes para generar el PDF.');
    w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Estado de Cuenta ${_cxcEscHTML(folio)}</title>
        <style>@page{size:letter portrait;margin:12mm}body{font-family:Arial,sans-serif;margin:0;padding:18px;color:#0f172a;background:#fff}</style>
        </head><body>${htmlDoc}<script>window.addEventListener('load',function(){setTimeout(function(){window.focus();window.print();},450);});<\/script></body></html>`);
    w.document.close();
    w.focus();
}

function descargarImagenEstadoCuentaFolio(folio) {
    const clone = _cxcClonarDocEstadoCuentaFolio(folio);
    if (!clone) return alert("No se encontro informacion de este folio.");
    const safeFolio = String(folio).replace(/[^a-zA-Z0-9_-]/g, '-');
    const btn = document.getElementById(`btn-img-estado-folio-${safeFolio}`);
    const textoOriginal = btn ? btn.textContent : '';
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Generando...';
    }

    _cxcCargarHtml2CanvasEstadoFolio(() => {
        const host = document.createElement('div');
        host.style.position = 'fixed';
        host.style.left = '-10000px';
        host.style.top = '0';
        host.style.background = '#ffffff';
        host.style.padding = '0';
        host.appendChild(clone);
        document.body.appendChild(host);

        html2canvas(clone, {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#ffffff',
            logging: false
        }).then(canvas => {
            const link = document.createElement('a');
            link.download = `estado_cuenta_${safeFolio}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        }).catch(err => {
            console.error('Error generando imagen estado de cuenta folio:', err);
            alert('No se pudo generar la imagen. Intenta con PDF / A4.');
        }).finally(() => {
            host.remove();
            if (btn) {
                btn.disabled = false;
                btn.textContent = textoOriginal || 'Guardar imagen';
            }
        });
    });
}

function emitirEstadoCuentaFolioProfesional(folio) {
    emitirEstadoCuentaFolioPdf(folio);
}

function guardarImagenEstadoCuenta() {
    const folio = document.querySelector('[data-modal="estado-cuenta-folio"]')?.querySelector('.mmp-edo-folio b')?.textContent?.trim();
    if (folio) return descargarImagenEstadoCuentaFolio(folio);
    alert('Abre primero un estado de cuenta.');
}

function imprimirEstadoCuentaFolio() {
    window.print();
}

function abrirEstadoCuentaCliente(clienteId) {
    const cuentas = StorageService.get("cuentasPorCobrar", []);
    const cuenta = cuentas.find(c => (String(c.clienteId) === String(clienteId) || String(c.id) === String(clienteId)) && c.estado !== 'Saldado' && !_cxcCuentaCancelada(c)) ||
                   cuentas.find(c => (String(c.clienteId) === String(clienteId) || String(c.id) === String(clienteId)) && !_cxcCuentaCancelada(c));

    if (cuenta) abrirEstadoCuentaFolio(cuenta.folio);
    else alert("Este cliente no tiene cuentas activas.");
}
window.enviarRecordatorioWhatsApp = function(folio) {
    const est = window._calcularEstadoCuenta(folio);
    if (!est || !est.cuenta) return alert("No se encontro informacion de este folio.");

    const clientes = StorageService.get("clientes", []);
    const cli = clientes.find(x => String(x.id) === String(est.cuenta.clienteId)) ||
        clientes.find(x => _cxcNormalizarTexto(x.nombre) === _cxcNormalizarTexto(est.cuenta.nombre || est.cuenta.clienteNombre));
    const nombre = cli?.nombre || est.cuenta.nombre || est.cuenta.clienteNombre || 'cliente';
    const telefonoRaw = cli?.telefono || est.cuenta.telefono || '';
    const telefono = String(telefonoRaw).replace(/\D/g, '');
    if (!telefono) return alert("El cliente no tiene telefono registrado.");

    const phoneParam = telefono.startsWith('52') ? telefono : `52${telefono}`;
    const saldo = _cxcDinero(est.saldoTotal);
    const vencido = _cxcDinero(est.montoVencido || 0);
    const pagosVencidos = est.pagaresVencidos?.length || 0;
    const atrasoTxt = est.diasMaxAtraso > 0 ? `, con atraso de hasta ${est.diasMaxAtraso} dia(s)` : '';

    let msj = `Hola ${nombre}, le saludamos de Muebleria Mi Pueblito.\n\n`;
    msj += `Le compartimos el estado de su cuenta del folio ${folio}: saldo pendiente ${saldo}.`;
    if (est.montoVencido > 0) {
        msj += `\nActualmente registra ${pagosVencidos} pago(s) vencido(s) por ${vencido}${atrasoTxt}.`;
        msj += `\nLe agradecemos que pueda apoyarnos regularizando el pago o confirmandonos una fecha de abono.`;
    } else {
        msj += `\nAgradecemos nos apoye manteniendo sus pagos al corriente o confirmandonos su proxima fecha de abono.`;
    }
    msj += `\n\nGracias por su atencion.`;

    window.open(`https://api.whatsapp.com/send?phone=${phoneParam}&text=${encodeURIComponent(msj)}`, '_blank');
};

window.abrirModalPromesaPago = function(folio) {
    const fechaHoy = window.obtenerHoyInputMX ? window.obtenerHoyInputMX() : (window.getFechaLocalMX ? window.getFechaLocalMX(new Date()) : new Date().toISOString().split('T')[0]);
    const html = `
    <div data-modal="promesa" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:7000; display:flex; justify-content:center; align-items:center;">
        <div style="background:white; padding:30px; border-radius:12px; width:350px;">
            <h3 style="margin:0 0 15px 0;">📝 Registrar Promesa</h3>
            <label style="font-weight:bold; font-size:12px;">Fecha de promesa de pago:</label>
            <input type="date" id="fechaPromesa" value="${fechaHoy}" style="width:100%; padding:10px; margin:10px 0; border:1px solid #ccc; border-radius:6px; box-sizing:border-box;">
            <button onclick="guardarPromesaPago('${folio}')" style="width:100%; padding:12px; background:#d97706; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">Guardar Promesa</button>
            <button onclick="this.parentElement.parentElement.remove()" style="width:100%; margin-top:10px; background:#f1f5f9; border:none; padding:10px; border-radius:8px; cursor:pointer; color:#475569; font-weight:bold;">Cancelar</button>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window.guardarPromesaPago = function(folio) {
    const fecha = document.getElementById('fechaPromesa').value;
    let cuentas = StorageService.get("cuentasPorCobrar", []);
    const idx = cuentas.findIndex(c => c.folio === folio);
    if (idx === -1) return;

    cuentas[idx].promesaPago = { fecha, fechaRegistro: window.localISO ? window.localISO(new Date()) : new Date().toISOString() };
    StorageService.set("cuentasPorCobrar", cuentas);
    document.querySelector('[data-modal=promesa]').remove();
    if (typeof renderCuentasXCobrar === 'function') renderCuentasXCobrar();
};

window.filtrarCuentasCobranza = function() {
    const texto = document.getElementById("filtroClienteCobranza")?.value || "";
    if (typeof renderCuentasXCobrar === 'function') renderCuentasXCobrar(texto);
};
// =====================================================================
// 🔄 CONVERSIÓN DE APARTADOS A CRÉDITO (CXC)
// =====================================================================
function _planesConversionApartado(saldoRestante, periodicidad = "semanal") {
    if (typeof CalculatorService === 'undefined' || !CalculatorService.calcularCreditoConPeriodicidad) return [];
    return CalculatorService.calcularCreditoConPeriodicidad(Number(saldoRestante) || 0, periodicidad)
        .filter(p => Number(p.total || 0) > 0 && Number(p.abono || 0) > 0);
}

function _pagaresPreviewConversion(folio, cliente, fechaBaseIso, plan, periodicidad) {
    const diasIntervalo = periodicidad === "quincenal" ? 14 : periodicidad === "mensual" ? 30 : 7;
    const totalPagos = Number(plan.pagos || Math.round((plan.semanas || (plan.meses * 4)) / (diasIntervalo / 7)) || 0);
    const totalPlan = Number(plan.total || 0);
    const abonoBase = Number(plan.abono || (totalPlan / totalPagos) || 0);
    const fechaPago = new Date(fechaBaseIso);
    const pagares = [];
    let acumulado = 0;
    for (let i = 1; i <= totalPagos; i++) {
        fechaPago.setDate(fechaPago.getDate() + diasIntervalo);
        const montoPagare = i === totalPagos && totalPlan > 0
            ? Math.max(0, Number((totalPlan - acumulado).toFixed(2)))
            : Number(abonoBase.toFixed(2));
        acumulado = Number((acumulado + montoPagare).toFixed(2));
        pagares.push({
            id: Date.now() + i,
            folio,
            numeroPagere: `${folio}-${i}/${totalPagos}`,
            clienteNombre: cliente.nombre,
            clienteId: cliente.id || null,
            fechaEmision: fechaBaseIso,
            fechaVencimiento: fechaPago.getTime(),
            monto: montoPagare,
            estado: "Pendiente",
            diasAtrasoActual: 0
        });
    }
    return pagares;
}

function actualizarPlanesConvertir(saldoRestante) {
    const periodicidad = document.getElementById("convPeriodicidadSelect")?.value || "semanal";
    const planes = _planesConversionApartado(saldoRestante, periodicidad);
    const selPlan = document.getElementById("convPlazoSelect");
    if (!selPlan) return;

    window._planesDisponiblesConversion = planes;
    window._periodicidadConversion = periodicidad;

    selPlan.innerHTML = planes.length === 0
        ? '<option value="">Sin planes disponibles</option>'
        : planes.map((p, index) => `<option value="${index}">${p.meses} meses - ${p.pagos} pagos de ${_cxcDinero(p.abono)}</option>`).join('');

    calcularSimulacionConvertir(saldoRestante);
}

window.abrirModalConvertirApartado = function(folioApartado) {
    // 1. Buscar el apartado en las bases de datos
    const apartados = StorageService.get("apartados", []);
    const ventas = StorageService.get("ventasRegistradas", []);
    
    let apartado = apartados.find(a => a.folio === folioApartado) || ventas.find(v => v.folio === folioApartado);
    if (!apartado) return alert("❌ No se encontró el folio del apartado.");
    const estadoApartado = String(apartado.estado || apartado.estatus || '').toLowerCase();
    if (estadoApartado.includes('cancel')) return alert("Este apartado esta cancelado. No puede convertirse a credito.");
    if (estadoApartado.includes('conversion') || estadoApartado.includes('migrado')) return alert("Este apartado ya esta en proceso de conversion o ya fue migrado a credito.");

    const abonosPendientesApartado = StorageService.get("abonosPendientes", []).filter(a =>
        !String(a.estado || '').toLowerCase().includes('cancel') &&
        (a.tipo === 'apartado' || a.origen === 'apartados' || a.folioApartado) &&
        String(a.folioApartado || a.folioCXC || '') === String(folioApartado)
    );
    if (abonosPendientesApartado.length) {
        const totalPendiente = abonosPendientesApartado.reduce((s, a) => s + Number(a.montoAbonado || a.monto || 0), 0);
        return alert(`Este apartado tiene ${abonosPendientesApartado.length} abono(s) pendiente(s) de autorizacion por ${_cxcDinero(totalPendiente)}. Resuelve esos abonos antes de convertirlo a credito.`);
    }

    // 2. Calcular los saldos reales
    const totalVenta = parseFloat(apartado.importeApartado || apartado.total || apartado.totalContadoOriginal || 0);
    const engancheInicial = parseFloat(apartado.enganche) || 0;
    
    let totalAbonado = engancheInicial;
    if (apartado.abonos && Array.isArray(apartado.abonos)) {
        totalAbonado += apartado.abonos
            .filter(abono => !abono.cancelado && !abono.canceladoPorVenta && !abono.canceladoPorApartado)
            .reduce((suma, abono) => suma + (parseFloat(abono.monto) || 0), 0);
    }

    const saldoRestante = totalVenta - totalAbonado;
    if (saldoRestante <= 0) return alert("✅ Este apartado ya está liquidado en su totalidad.");

    const periodicidadInicial = "semanal";
    const planes = _planesConversionApartado(saldoRestante, periodicidadInicial);
    if (planes.length === 0) return alert("⚠️ No tienes planes de crédito disponibles para este saldo. Revisa la configuración global de crédito.");

    let opcionesPlazosHTML = planes.map((p, index) => `<option value="${index}">${p.meses} meses - ${p.pagos} pagos de ${_cxcDinero(p.abono)}</option>`).join('');

    const modalHTML = `
    <div id="modalConvertirCredito" style="position:fixed; inset:0; background:rgba(15,23,42,0.85); z-index:99999; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
        <div style="background:white; padding:30px; border-radius:12px; width:90%; max-width:450px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
            <h2 style="color:#1e40af; margin-top:0; border-bottom:2px solid #f1f5f9; padding-bottom:10px;">💳 Convertir a Crédito</h2>
            
            <div style="display:flex; justify-content:space-between; margin-bottom:10px; font-size:13px; color:#475569;">
                <span>Total pagado hasta hoy:</span>
                <strong style="color:#10b981;">${_cxcDinero(totalAbonado)}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:20px; font-size:15px;">
                <span style="font-weight:bold; color:#0f172a;">Saldo por financiar:</span>
                <strong style="color:#dc2626;">${_cxcDinero(saldoRestante)}</strong>
            </div>

            <div style="margin-bottom:15px; background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">
                <label style="font-weight:bold; font-size:12px; color:#475569; display:block; margin-bottom:8px;">Periodicidad:</label>
                <select id="convPeriodicidadSelect" onchange="actualizarPlanesConvertir(${saldoRestante})" style="width:100%; padding:12px; border-radius:6px; border:1px solid #cbd5e1; font-weight:bold; color:#1e40af; cursor:pointer; margin-bottom:10px;">
                    <option value="semanal">Semanal</option>
                    <option value="quincenal">Quincenal</option>
                    <option value="mensual">Mensual</option>
                </select>
                <label style="font-weight:bold; font-size:12px; color:#475569; display:block; margin-bottom:8px;">Plazo de financiamiento:</label>
                <select id="convPlazoSelect" onchange="calcularSimulacionConvertir(${saldoRestante})" style="width:100%; padding:12px; border-radius:6px; border:1px solid #cbd5e1; font-weight:bold; color:#1e40af; cursor:pointer;">
                    ${opcionesPlazosHTML}
                </select>
            </div>

            <div id="convResumenMatematico" style="margin-bottom:25px;"></div>

            <div style="display:flex; gap:10px;">
                <button onclick="ejecutarConversionCredito('${folioApartado}', ${saldoRestante}, ${totalAbonado})" style="flex:2; padding:14px; background:#2563eb; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer; font-size:14px;">✅ Confirmar y Generar Pagarés</button>
                <button onclick="document.getElementById('modalConvertirCredito').remove()" style="flex:1; padding:14px; background:#e2e8f0; color:#475569; border:none; border-radius:6px; font-weight:bold; cursor:pointer; font-size:14px;">Cancelar</button>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    window._planesDisponiblesConversion = planes;
    window._periodicidadConversion = periodicidadInicial;
    calcularSimulacionConvertir(saldoRestante);
};

window.calcularSimulacionConvertir = function(saldoRestante) {
    const resumen = document.getElementById("convResumenMatematico");
    const index = document.getElementById("convPlazoSelect")?.value;
    const plan = (window._planesDisponiblesConversion || [])[index];
    if (!resumen || !plan) {
        if (resumen) resumen.innerHTML = `<div style="color:#991b1b; background:#fee2e2; padding:12px; border-radius:8px;">No hay plan seleccionado.</div>`;
        return;
    }

    const totalFinanciado = Number(plan.total) || 0;
    const interes = Math.max(0, totalFinanciado - (Number(saldoRestante) || 0));
    const totalPagos = Number(plan.pagos || 0);
    const pagoPeriodo = Number(plan.abono || 0);
    const periodicidadTxt = { semanal: "semanales", quincenal: "quincenales", mensual: "mensuales" }[window._periodicidadConversion || "semanal"] || "semanales";

    resumen.innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:13px;">
            <span style="color:#64748b;">Interés total según reglas vigentes:</span>
            <strong style="color:#ea580c;">+ ${_cxcDinero(interes)}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:15px; font-size:15px; border-bottom:1px dashed #cbd5e1; padding-bottom:12px;">
            <span style="font-weight:bold; color:#0f172a;">Total Nueva Deuda:</span>
            <strong style="color:#1e40af; font-size:18px;">${_cxcDinero(totalFinanciado)}</strong>
        </div>
        <div style="text-align:center; background:#eff6ff; padding:15px; border-radius:8px; border:2px solid #bfdbfe;">
            <div style="font-size:11px; font-weight:bold; text-transform:uppercase; color:#1d4ed8; margin-bottom:4px;">Plan de Pagos Oficial</div>
            <div style="font-size:20px; font-weight:900; color:#1e40af;">${totalPagos} pagos ${periodicidadTxt} de ${_cxcDinero(pagoPeriodo)}</div>
            <div style="font-size:10px; color:#60a5fa; margin-top:4px;">Misma regla de crédito tradicional</div>
        </div>
    `;
};

window.ejecutarConversionCredito = function(folio, saldoRestante, totalAbonado) {
    const index = document.getElementById("convPlazoSelect")?.value;
    const periodicidad = document.getElementById("convPeriodicidadSelect")?.value || window._periodicidadConversion || "semanal";
    const planElegido = (window._planesDisponiblesConversion || [])[index];
    if (!planElegido) return alert("Selecciona un plan de crédito válido.");

    const totalFinanciado = Number(planElegido.total) || 0;
    const totalPagos = Number(planElegido.pagos || 0);
    const pagoPeriodo = Number(planElegido.abono || 0);

    // Ventana de confirmación estricta de seguridad
    if (!confirm(`⚠️ RESUMEN DE CONVERSIÓN A CRÉDITO\n\nFolio: ${folio}\nAnticipos que quedan como enganche: ${_cxcDinero(totalAbonado)}\nCapital a financiar: ${_cxcDinero(saldoRestante)}\nNuevo total financiado: ${_cxcDinero(totalFinanciado)}\nSe generarán ${totalPagos} pagarés de ${_cxcDinero(pagoPeriodo)}.\n\nLa conversión quedará en Bóveda de Autorizaciones y se emitirá ticket provisional de crédito.\n\n¿Deseas continuar?`)) {
        return;
    }

    const apartados = StorageService.get("apartados", []);
    const ventas = StorageService.get("ventasRegistradas", []);

    let ap = apartados.find(a => a.folio === folio);
    let vnt = ventas.find(v => v.folio === folio);
    const origen = ap || vnt;
    if (!origen) return alert("❌ No se encontró el folio origen para convertir.");

    const clientes = StorageService.get("clientes", []);
    const clienteId = origen.clienteId || origen.cliente?.id || null;
    const clienteBase = (clienteId ? clientes.find(c => String(c.id) === String(clienteId)) : null) || origen.cliente || {};
    const cliente = {
        id: clienteId,
        nombre: origen.clienteNombre || clienteBase.nombre || "Cliente Genérico",
        telefono: clienteBase.telefono || origen.telefono || "",
        direccion: clienteBase.direccion || origen.direccion || "",
        referencia: clienteBase.referencia || ""
    };

    const fechaObj = new Date();
    const fechaVentaIso = window.localISO ? window.localISO(fechaObj) : fechaObj.toISOString();
    const fechaHoy = window.formatearFechaCortaMX ? window.formatearFechaCortaMX(fechaObj) : fechaObj.toLocaleDateString("es-MX");
    const totalContado = Number(origen.importeApartado || origen.total || origen.totalContadoOriginal || (Number(saldoRestante) + Number(totalAbonado))) || 0;
    const articulos = (origen.articulos || []).map(a => {
        const cantidad = Number(a.cantidad || 1) || 1;
        const precioUnitario = Number(a.precioContado || a.precio || 0) || (Number(a.subtotal || 0) / cantidad) || 0;
        return { ...a, precioContado: precioUnitario, cantidad };
    });
    const pagaresPreview = _pagaresPreviewConversion(folio, cliente, fechaVentaIso, planElegido, periodicidad);

    const datosVenta = {
        folio,
        fecha: fechaHoy,
        fechaIso: fechaVentaIso,
        cliente,
        metodo: "credito",
        total: totalContado,
        enganche: Number(totalAbonado) || 0,
        saldoPendiente: totalFinanciado,
        plan: planElegido,
        planCredito: planElegido,
        articulos,
        tipoComprobante: "CRÉDITO PROVISIONAL POR APARTADO",
        periodicidad,
        pagaresPreview,
        origenApartadoFolio: folio,
        engancheYaRegistrado: true,
        acreedor: "Roberto Escobedo Vega",
        lugar: "Santiago Cuaula, Tlaxcala",
        tasaMorosidad: 2
    };

    const cuarentena = {
        idCuarentena: Date.now(),
        tipo: "conversion_apartado_credito",
        origenApartadoFolio: folio,
        fechaCaptura: window.formatearFechaCortaMX ? window.formatearFechaCortaMX(new Date()) : new Date().toLocaleDateString('es-MX'),
        fechaCapturaIso: fechaVentaIso,
        clienteNombre: cliente.nombre,
        totalVenta: totalContado,
        args: ["credito", totalContado, Number(totalAbonado) || 0, Number(saldoRestante) || 0, planElegido, folio, fechaHoy, fechaVentaIso, { items: [] }, { items: [] }],
        datosVenta,
        vendedorSeleccionado: origen.vendedorId ? { id: origen.vendedorId, nombre: origen.vendedorNombre || "" } : null
    };

    const pendientesRaw = StorageService.get("ventasPendientes", []);
    const pendientes = typeof window._normalizarVentaPendienteFirestore === "function"
        ? pendientesRaw.map(window._normalizarVentaPendienteFirestore)
        : pendientesRaw;
    if (pendientes.some(p => p.origenApartadoFolio === folio || p.args?.[5] === folio)) {
        return alert("⚠️ Ya existe una conversión/venta pendiente para este folio en la Bóveda de Autorizaciones.");
    }
    pendientes.push(cuarentena);
    StorageService.set("ventasPendientes", pendientes);

    if (ap) ap.estado = "Conversión a Crédito Pendiente";
    if (vnt) vnt.estado = "Conversión a Crédito Pendiente";
    StorageService.set("apartados", apartados);
    StorageService.set("ventasRegistradas", ventas);

    if (typeof generarTicketMediaHoja === 'function') generarTicketMediaHoja(datosVenta);

    document.getElementById('modalConvertirCredito').remove();
    alert("⏳ Conversión enviada a Bóveda de Autorizaciones.\n\nSe emitió el ticket provisional de venta a crédito con los anticipos como enganche. CxC y pagarés se crearán cuando Auditoría autorice la operación.");

    // Actualizar pantalla activa
    if (typeof renderApartados === 'function') renderApartados();
    if (typeof renderCuentasXCobrar === 'function') renderCuentasXCobrar();
    if (typeof renderPanelAutorizaciones === 'function') renderPanelAutorizaciones();
};

// =====================================================================
// 🕰️ AUDITORÍA DE FECHAS RELACIONALES (VERSIÓN MULTI-CAJA Y DÉBITO V2)
// =====================================================================
window.abrirAuditoriaFechas = function() {
    if (window.AuditService?.requireAdmin) {
        if (!window.AuditService.requireAdmin('auditoria de fechas de ingreso')) return;
    } else {
        const usuarioActual = (() => { try { return JSON.parse(sessionStorage.getItem('sesionActiva') || 'null'); } catch { return null; } })();
        if (!usuarioActual || (usuarioActual.rol !== "admin" && usuarioActual.rol !== "Administrador")) {
            return alert("⛔ ACCESO DENEGADO: Solo Administradores.");
        }
    }

    const modalHTML = `
    <div data-modal="auditoria-fechas" style="position:fixed; inset:0; background:rgba(15,23,42,0.9); z-index:9999; display:flex; justify-content:center; align-items:flex-start; overflow-y:auto; padding:20px; backdrop-filter: blur(5px);">
        <div style="background:white; padding:30px; border-radius:12px; width:100%; max-width:700px; margin-top:20px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #f59e0b; padding-bottom:15px; margin-bottom:20px;">
                <div>
                    <h2 style="margin:0; color:#b45309; font-size:24px;">🕰️ Corrección de Fechas de Ingreso</h2>
                    <p style="margin:0; color:#64748b; font-size:14px;">Ajusta la fecha real en que recibiste el dinero (Sincroniza todas las Cajas y Débito)</p>
                </div>
                <button onclick="document.querySelector('[data-modal=\\'auditoria-fechas\\']').remove()" style="background:#f1f5f9; border:none; padding:8px 15px; border-radius:6px; cursor:pointer; font-weight:bold; color:#475569;">✕ Cerrar</button>
            </div>

            <div style="display:flex; gap:10px; margin-bottom:25px; background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">
                <input type="text" id="auditFechaFolio" placeholder="Ingresa el Folio (Ej. V-123456)" style="flex:1; padding:10px; border:1px solid #cbd5e1; border-radius:6px; font-size:16px; text-transform:uppercase;">
                <button onclick="buscarPagosAuditoria()" style="background:#2563eb; color:white; border:none; padding:10px 20px; border-radius:6px; cursor:pointer; font-weight:bold;">🔍 Buscar Pagos</button>
            </div>

            <div id="auditContenedorFechas">
                <div style="text-align:center; padding:40px; color:#94a3b8;">Ingresa un folio de Crédito o Apartado para auditar sus movimientos financieros.</div>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

window.buscarPagosAuditoria = function() {
    const folio = document.getElementById("auditFechaFolio").value.trim().toUpperCase();
    if (!folio) return alert("Por favor ingresa un folio válido.");

    const cxc = StorageService.get("cuentasPorCobrar", []);
    const apartados = StorageService.get("apartados", []);

    let cuenta = cxc.find(c => String(c.folio).toUpperCase() === folio) || apartados.find(a => String(a.folio).toUpperCase() === folio);

    if (!cuenta) {
        document.getElementById("auditContenedorFechas").innerHTML = `<div style="padding:20px; background:#fef2f2; color:#b91c1c; border-radius:8px; border:1px solid #fecaca;">❌ No se encontró el folio ${folio} en Créditos ni en Apartados.</div>`;
        return;
    }

    const esApartado = !!cuenta.importeApartado; 
    let registrosHtml = '';
    window._auditRegistrosFechas = []; 

    // 1. Analizar Enganche / Anticipo Inicial
    let enganche = esApartado ? cuenta.enganche : cuenta.engancheRecibido;
    if (enganche > 0) {
        let fechaEnganche = cuenta.fechaVenta || cuenta.fechaApartado;
        let fechaCorta = "";
        try { fechaCorta = fechaEnganche.split('T')[0]; } catch(e) { fechaCorta = fechaEnganche; }
        
        window._auditRegistrosFechas.push({ tipo: 'enganche', montoOriginal: enganche, fechaOriginal: fechaCorta, nuevaFecha: fechaCorta });

        registrosHtml += `
        <div style="display:flex; justify-content:space-between; align-items:center; background:#fff; padding:15px; margin-bottom:10px; border:1px solid #cbd5e1; border-radius:8px;">
            <div>
                <strong style="color:#1e40af; font-size:15px;">Enganche / Anticipo Inicial</strong><br>
                <span style="color:#16a34a; font-weight:900; font-size:18px;">${_cxcDinero(enganche)}</span>
            </div>
            <div>
                <label style="font-size:11px; color:#64748b; display:block; margin-bottom:4px;">📅 Fecha Real de Cobro:</label>
                <input type="date" value="${fechaCorta}" onchange="window._auditRegistrosFechas[0].nuevaFecha = this.value" style="padding:10px; border:2px solid #94a3b8; border-radius:6px; font-weight:bold; cursor:pointer;">
            </div>
        </div>`;
    }

    // 2. Analizar Historial de Abonos
    if (cuenta.abonos && cuenta.abonos.length > 0) {
        cuenta.abonos.forEach((ab, i) => {
            let fechaAb = ab.fechaAbono || ab.fecha;
            let fechaCorta = "";
            try { fechaCorta = fechaAb.split('T')[0]; } catch(e) { fechaCorta = fechaAb; }

            let indexMemoria = window._auditRegistrosFechas.length;
            window._auditRegistrosFechas.push({ tipo: 'abono', indexAbono: i, montoOriginal: ab.monto, fechaOriginal: fechaCorta, nuevaFecha: fechaCorta });

            registrosHtml += `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#fff; padding:15px; margin-bottom:10px; border:1px solid #cbd5e1; border-radius:8px;">
                <div>
                    <strong style="color:#0f766e; font-size:15px;">Abono #${i + 1}</strong><br>
                    <span style="color:#16a34a; font-weight:900; font-size:18px;">${_cxcDinero(ab.monto)}</span>
                </div>
                <div>
                    <label style="font-size:11px; color:#64748b; display:block; margin-bottom:4px;">📅 Fecha Real de Cobro:</label>
                    <input type="date" value="${fechaCorta}" onchange="window._auditRegistrosFechas[${indexMemoria}].nuevaFecha = this.value" style="padding:10px; border:2px solid #94a3b8; border-radius:6px; font-weight:bold; cursor:pointer;">
                </div>
            </div>`;
        });
    }

    if (window._auditRegistrosFechas.length === 0) {
        registrosHtml = `<div style="padding:20px; color:#64748b; text-align:center;">Esta cuenta no tiene ingresos de dinero registrados para modificar.</div>`;
    } else {
        registrosHtml += `
        <div style="margin-top:20px; padding:15px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; font-size:12px; color:#166534;">
            ✨ <b>Rastreador Inteligente Multi-Caja Activo:</b> Al guardar, el sistema buscará de forma cruzada este folio en tus cuentas de efectivo, cajas secundarias o registros de terminales de débito para corregir el Flujo.
        </div>
        <div style="text-align:right; margin-top:20px;">
            <button onclick="guardarCorreccionFechasDinero('${folio}', ${esApartado})" style="background:#059669; color:white; border:none; padding:14px 25px; border-radius:8px; font-size:16px; font-weight:bold; cursor:pointer; box-shadow:0 4px 6px rgba(5, 150, 105, 0.2);">
                💾 Guardar Cambios en Flujo y Cuenta
            </button>
        </div>`;
    }

    document.getElementById("auditContenedorFechas").innerHTML = `
        <h3 style="margin-top:0; color:#334155; border-bottom:1px solid #e2e8f0; padding-bottom:10px;">Cliente: <span style="color:#2563eb;">${cuenta.nombre || cuenta.clienteNombre}</span></h3>
        ${registrosHtml}
    `;
};

window.guardarCorreccionFechasDinero = function(folio, esApartado) {
    if (!confirm("¿Confirmas la corrección relacional? Los días financieros afectados se recalcularán en tu Flujo de Caja.")) return;

    let cxc = StorageService.get("cuentasPorCobrar", []);
    let apartados = StorageService.get("apartados", []);
    let caja = StorageService.get("movimientosCaja", []);

    let cuenta = esApartado ? apartados.find(a => String(a.folio).toUpperCase() === folio) : cxc.find(c => String(c.folio).toUpperCase() === folio);
    let cambiosRealizados = 0;
    let movimientosCajaCorregidos = 0;

    window._auditRegistrosFechas.forEach(reg => {
        if (reg.fechaOriginal !== reg.nuevaFecha) {
            // Generar fecha ISO limpia al mediodía para evitar desfases horarios
            const nuevaFechaIso = window.localISO ? window.localISO(reg.nuevaFecha + 'T12:00:00') : new Date(reg.nuevaFecha + 'T12:00:00').toISOString();

            // 1. Modificar la libreta del cliente
            if (reg.tipo === 'enganche') {
                if (esApartado) cuenta.fechaApartado = nuevaFechaIso;
                else cuenta.fechaVenta = nuevaFechaIso;
            } else if (reg.tipo === 'abono') {
                cuenta.abonos[reg.indexAbono].fechaAbono = nuevaFechaIso;
                if (cuenta.abonos[reg.indexAbono].fecha) cuenta.abonos[reg.indexAbono].fecha = nuevaFechaIso;
            }

            // 2. Modificar la Caja (Búsqueda Multi-Caja de Espectro Completo)
            let movCaja = caja.find(m => {
                // Coincidencia por Folio directo, Referencia (Cajas/Débito) o Concepto descritos en la transacción
                const coincideIdentificador = 
                    (m.folio && String(m.folio).toUpperCase() === folio) ||
                    (m.referencia && String(m.referencia).toUpperCase().includes(folio)) ||
                    (m.concepto && String(m.concepto).toUpperCase().includes(folio));
                
                const mismoMonto = Number(m.monto || m.importe || 0) === Number(reg.montoOriginal);
                
                let fechaM = m.fecha || m.fechaMovimiento || "";
                let fechaM_corta = typeof fechaM === 'string' ? fechaM.split('T')[0] : "";
                const mismaFechaOriginal = fechaM_corta === reg.fechaOriginal;

                return coincideIdentificador && mismoMonto && mismaFechaOriginal;
            });

            // Si por alguna extraña razón no coincide la fecha exacta debido a diferencias horarias de guardado, hacemos un fallback de rescate por Folio + Monto
            if (!movCaja) {
                movCaja = caja.find(m => {
                    const coincideIdentificador = 
                        (m.folio && String(m.folio).toUpperCase() === folio) ||
                        (m.referencia && String(m.referencia).toUpperCase().includes(folio)) ||
                        (m.concepto && String(m.concepto).toUpperCase().includes(folio));
                    const mismoMonto = Number(m.monto || m.importe || 0) === Number(reg.montoOriginal);
                    return coincideIdentificador && mismoMonto;
                });
            }

            if (movCaja) {
                movCaja.fecha = nuevaFechaIso;
                movimientosCajaCorregidos++;
            }

            cambiosRealizados++;
        }
    });

    if (cambiosRealizados > 0) {
        // Guardar de forma persistente y disparar sincronización en tiempo real a Firebase
        StorageService.set("movimientosCaja", caja);
        if (esApartado) {
            StorageService.set("apartados", apartados);
            if(typeof renderApartados === 'function') renderApartados();
        } else {
            StorageService.set("cuentasPorCobrar", cxc);
            if(typeof renderCuentasXCobrar === 'function') renderCuentasXCobrar();
        }
        
        alert(`✅ ¡Sincronización Exitosa!\n\nSe cambiaron las fechas en el perfil del cliente.\nEn el Flujo de Caja (Multi-cuentas/Débito) se localizaron y corrigieron exitosamente: ${movimientosCajaCorregidos} movimiento(s).`);
        location.reload(); // Recargar para forzar el redibujado de la gráfica del flujo
    } else {
        alert("ℹ️ No se detectó ningún cambio en las fechas.");
    }

    if(document.querySelector('[data-modal="auditoria-fechas"]')) {
        document.querySelector('[data-modal="auditoria-fechas"]').remove();
    }
};
// =====================================================================
// 💳 MODAL DE MIGRACIÓN/REGISTRO DE COMPRAS A MESES SIN INTERESES
// =====================================================================
window.abrirMigracionMSITarjeta = function() {
    const tarjetasConfig = StorageService.get("tarjetasConfig", []);
    const tarjetasCredito = tarjetasConfig.filter(t => !t.tipo || t.tipo === "credito");

    if (tarjetasCredito.length === 0) {
        return alert("⚠️ Primero debes registrar al menos una Tarjeta de Crédito en Configuración > Bancos.");
    }

    // Dibujar las opciones leyendo directamente tu base de datos de tarjetas
    let opcionesTarjetas = tarjetasCredito.map(t => 
        `<option value="${t.banco}" data-corte="${t.diaCorte || 1}" data-pago="${t.diaLimite || 1}">💳 ${t.banco}</option>`
    ).join('');

    const fechaHoy = window.localISO ? window.localISO(new Date()).split('T')[0] : new Date().toISOString().split('T')[0];

    // Limpiar si existía uno anterior
    document.querySelector('[data-modal="migracion-msi-tarjeta"]')?.remove();

    const modalHTML = `
    <div data-modal="migracion-msi-tarjeta" style="position:fixed; inset:0; background:rgba(15,23,42,0.8); z-index:99999; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
        <div style="background:white; padding:30px; border-radius:12px; width:90%; max-width:450px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
            <h2 style="color:#1e40af; margin-top:0; border-bottom:2px solid #f1f5f9; padding-bottom:10px;">💳 Registrar Deuda MSI</h2>
            <p style="font-size:13px; color:#64748b; margin-bottom:20px;">Registra una compra a Meses Sin Intereses nueva o antigua.</p>

            <div style="margin-bottom:15px;">
                <label style="font-weight:bold; font-size:12px; color:#475569; display:block; margin-bottom:5px;">1. Selecciona la Tarjeta:</label>
                <select id="migTdcSeleccion" style="width:100%; padding:10px; border-radius:6px; border:1px solid #cbd5e1; font-weight:bold; color:#1e40af;">
                    ${opcionesTarjetas}
                </select>
            </div>

            <div style="margin-bottom:15px;">
                <label style="font-weight:bold; font-size:12px; color:#475569; display:block; margin-bottom:5px;">2. Fecha de Compra Original:</label>
                <input type="date" id="migTdcFecha" value="${fechaHoy}" style="width:100%; padding:10px; border-radius:6px; border:1px solid #cbd5e1; box-sizing:border-box;">
            </div>

            <div style="margin-bottom:15px;">
                <label style="font-weight:bold; font-size:12px; color:#475569; display:block; margin-bottom:5px;">3. Concepto / Producto:</label>
                <input type="text" id="migTdcConcepto" placeholder="Ej. Refrigerador LG Mabe" style="width:100%; padding:10px; border-radius:6px; border:1px solid #cbd5e1; box-sizing:border-box;">
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:15px;">
                <div>
                    <label style="font-weight:bold; font-size:12px; color:#475569; display:block; margin-bottom:5px;">Monto Total ($):</label>
                    <input type="number" id="migTdcMonto" placeholder="0.00" min="0.01" step="0.01" style="width:100%; padding:10px; border-radius:6px; border:2px solid #3b82f6; font-weight:bold; box-sizing:border-box;">
                </div>
                <div>
                    <label style="font-weight:bold; font-size:12px; color:#475569; display:block; margin-bottom:5px;">Plazo (Meses):</label>
                    <input type="number" id="migTdcPlazo" placeholder="Ej. 12" min="1" step="1" style="width:100%; padding:10px; border-radius:6px; border:1px solid #cbd5e1; box-sizing:border-box;">
                </div>
            </div>

            <div style="margin-bottom:25px; background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">
                <label style="font-weight:bold; font-size:12px; color:#d97706; display:block; margin-bottom:5px;">Mensualidades YA PAGADAS (Migración):</label>
                <input type="number" id="migTdcPagadas" value="0" min="0" step="1" style="width:100%; padding:10px; border-radius:6px; border:1px solid #cbd5e1; box-sizing:border-box; font-weight:bold;">
                <small style="color:#64748b; font-size:11px; display:block; margin-top:4px;">Deja en 0 si es una compra que acabas de hacer.</small>
            </div>

            <div style="display:flex; gap:10px;">
                <button onclick="ejecutarMigracionTdcMSI()" style="flex:2; padding:12px; background:#2563eb; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer; font-size:14px;">💾 Procesar Deuda</button>
                <button onclick="document.querySelector('[data-modal=\\'migracion-msi-tarjeta\\']').remove()" style="flex:1; padding:12px; background:#e2e8f0; color:#475569; border:none; border-radius:6px; font-weight:bold; cursor:pointer; font-size:14px;">Cancelar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};
window.ejecutarMigracionTdcMSI = function() {
    const selector = document.getElementById("migTdcSeleccion");
    const tarjetaNombre = selector.value;
    const diaCorte = parseInt(selector.options[selector.selectedIndex].getAttribute("data-corte"));
    const diaPago = parseInt(selector.options[selector.selectedIndex].getAttribute("data-pago"));
    
    const fechaCompra = document.getElementById("migTdcFecha").value;
    const concepto = document.getElementById("migTdcConcepto").value.trim();
    const montoTotal = parseFloat(document.getElementById("migTdcMonto").value);
    const plazo = parseInt(document.getElementById("migTdcPlazo").value);
    const yaPagadas = parseInt(document.getElementById("migTdcPagadas").value) || 0;

    if (!fechaCompra || !concepto || isNaN(montoTotal) || montoTotal <= 0) {
        return alert("❌ Llena todos los campos obligatorios correctamente.");
    }
    if (yaPagadas >= plazo) {
        return alert("❌ Si ya pagaste todas las mensualidades, la deuda ya está liquidada.");
    }

    if (!confirm(`¿Confirmas registrar la compra de ${_cxcDinero(montoTotal)} a ${plazo} MSI en la tarjeta ${tarjetaNombre}?`)) return;

    // 🚀 ECUACIÓN MAESTRA UNIVERSAL Y BLINDADA 🚀
    let fechaPartes = fechaCompra.split('-');
    let anioCompra = parseInt(fechaPartes[0]);
    let mesCompra = parseInt(fechaPartes[1]) - 1; // Enero es 0 en JavaScript
    let diaCompra = parseInt(fechaPartes[2]);

    // Evaluación de los "Brincos"
    let brincoCorte = (diaCompra > diaCorte) ? 1 : 0;
    let brincoPago = (diaCorte > diaPago) ? 1 : 0;
    let mesPrimerPago = mesCompra + brincoCorte + brincoPago;

    const abonoMensual = parseFloat((montoTotal / plazo).toFixed(2));
    const montoYaPagado = yaPagadas * abonoMensual;
    let calendarioPagos = [];

    for (let i = 1; i <= plazo; i++) {
        // Generamos la fecha forzando la matemática independiente de los meses, evitando bugs del día 31
        let fechaPagoLimite = new Date(anioCompra, mesPrimerPago + (i - 1), diaPago, 12, 0, 0);
        
        let yyyy = fechaPagoLimite.getFullYear();
        let mm = String(fechaPagoLimite.getMonth() + 1).padStart(2, '0');
        let dd = String(fechaPagoLimite.getDate()).padStart(2, '0');

        calendarioPagos.push({
            n: i,
            numero: i,
            fecha: `${yyyy}-${mm}-${dd}`,
            monto: abonoMensual,
            estado: i <= yaPagadas ? "Pagado" : "Pendiente",
            montoAbonado: i <= yaPagadas ? abonoMensual : 0,
            conciliado: i <= yaPagadas
        });
    }

    // 🛡️ ESTRUCTURA HOMOLOGADA
    let fechaBaseStr = new Date(anioCompra, mesCompra, diaCompra, 12, 0, 0);
    const nuevaDeudaMSI = {
        id: Date.now(),
        banco: tarjetaNombre,
        producto: concepto,
        total: montoTotal,
        meses: plazo,
        cuotaMensual: abonoMensual,
        fechaCompra: window.localISO ? window.localISO(fechaBaseStr).split('T')[0] : fechaBaseStr.toISOString().split('T')[0],
        calendario: calendarioPagos,
        pagosRealizados: yaPagadas,
        montoPagado: montoYaPagado
    };

    let cuentasMSI = StorageService.get("cuentasMSI", []);
    cuentasMSI.push(nuevaDeudaMSI);
    StorageService.set("cuentasMSI", cuentasMSI);

    alert(`✅ Compra MSI registrada en ${tarjetaNombre}.\n\nSe estructuraron ${plazo} mensualidades. El sistema marcó como "Pagadas" las primeras ${yaPagadas}.`);
    document.querySelector('[data-modal="migracion-msi-tarjeta"]').remove();

    if (typeof renderCuentasMSI === 'function') renderCuentasMSI();
    if (typeof renderDashboardMSI === 'function') renderDashboardMSI();
};

// ==========================================
// EXPORTACIONES GLOBALES (CONEXIÓN CON EL HTML)
// ==========================================
window.renderCuentasXCobrar = renderCuentasXCobrar;
window.renderVisorCreditosCobranza = renderVisorCreditosCobranza;
window.renderAbonosDirectos = renderAbonosDirectos;
window.actualizarPlanesConvertir = actualizarPlanesConvertir;
window.abrirModalAbonoAvanzado = abrirModalAbonoAvanzado;
window.abrirModalMoratorio = abrirModalMoratorio;
window.aplicarMoratorioManual = aplicarMoratorioManual;
window.exentarMoratorio = exentarMoratorio;
window.actualizarAvisoPoliticaAbono = actualizarAvisoPoliticaAbono;
window.evaluarPoliticaLiquidacion = evaluarPoliticaLiquidacion;
window._cxcEvaluarPoliticaPagoAnticipado = _cxcEvaluarPoliticaPagoAnticipado;
window.procesarAbonoAvanzado = procesarAbonoAvanzado;
window.generarTicketAbonoTermico = generarTicketAbonoTermico;
window.renderCobranzaEsperada = renderCobranzaEsperada;
window.abrirDetalleCobranza = abrirDetalleCobranza;
window.exportarCobranzaEsperada = exportarCobranzaEsperada;
window.exportarMorososCSV = exportarMorososCSV;
window.renderClientesMorosos = renderClientesMorosos;
window.abrirHistorialAbonos = abrirHistorialAbonos;
window.reimprimirTicketAbono = reimprimirTicketAbono;
window.abrirEstadoCuentaFolio = abrirEstadoCuentaFolio;
window.emitirEstadoCuentaFolioTicket = emitirEstadoCuentaFolioTicket;
window.emitirEstadoCuentaFolioProfesional = emitirEstadoCuentaFolioProfesional;
window.emitirEstadoCuentaFolioPdf = emitirEstadoCuentaFolioPdf;
window.descargarImagenEstadoCuentaFolio = descargarImagenEstadoCuentaFolio;
window.guardarImagenEstadoCuenta = guardarImagenEstadoCuenta;
window.abrirEstadoCuentaCliente = abrirEstadoCuentaCliente;
window.imprimirEstadoCuentaFolio = imprimirEstadoCuentaFolio;


// ═══════════════════════════════════════════════════════════════════
// GESTIÓN DE CUENTAS INCOBRABLES
// ═══════════════════════════════════════════════════════════════════

function _cxcSesionActual() {
    if (typeof getSesion === 'function') return getSesion();
    try { return JSON.parse(sessionStorage.getItem('sesionActiva') || 'null'); } catch { return null; }
}

function _cxcPuedeGestionarIncobrables() {
    if (typeof esAdmin === 'function') return esAdmin();
    return _cxcSesionActual()?.rol === 'admin';
}

window.marcarIncobrable = function(folio) {
    if (!folio) return;
    if (!_cxcPuedeGestionarIncobrables()) {
        if (typeof requireAdmin === 'function') {
            return requireAdmin(() => window.marcarIncobrable(folio));
        }
        return alert('Acceso restringido. Solo administrador puede gestionar cuentas incobrables.');
    }

    const cuentas = StorageService.get('cuentasPorCobrar', []);
    const idx = cuentas.findIndex(c => c.folio === folio);
    if (idx === -1) return alert('No se encontró la cuenta.');

    const cuenta = cuentas[idx];
    const sesion = _cxcSesionActual() || {};

    if (cuenta.incobrable) {
        // Revertir
        if (!confirm(`¿Reactivar la cuenta ${folio} de ${cuenta.nombre || cuenta.clienteNombre}?\nVolverá a aparecer en proyecciones y cobranza.`)) return;
        delete cuentas[idx].incobrable;
        delete cuentas[idx].incobrableFecha;
        delete cuentas[idx].incobrableMotivo;
        delete cuentas[idx].incobrablePor;
        StorageService.set('cuentasPorCobrar', cuentas);
        if (window.AuditService?.log) window.AuditService.log({
            accion: 'INCOBRABLE_REVERTIDO', modulo: 'CxC', entidad: 'cuenta', entidadId: folio,
            detalle: `Cuenta ${folio} reactivada`, severidad: 'info'
        });
        alert('Cuenta reactivada. Ya aparecerá en proyecciones.');
        if (typeof renderAbonosDirectos === 'function') renderAbonosDirectos();
        renderCuentasIncobrables();
        return;
    }

    const motivo = prompt(`Motivo para marcar ${folio} como incobrable:\n(Ej: "Sin contacto 3 meses", "Domicilio cambiado", "Acuerdo verbal")`, '');
    if (motivo === null) return;
    if (!motivo.trim()) return alert('El motivo es obligatorio.');

    cuentas[idx].incobrable = true;
    cuentas[idx].incobrableFecha = new Date().toISOString();
    cuentas[idx].incobrableMotivo = motivo.trim();
    cuentas[idx].incobrablePor = sesion.nombre || sesion.usuario || 'admin';
    StorageService.set('cuentasPorCobrar', cuentas);

    if (window.AuditService?.log) window.AuditService.log({
        accion: 'CUENTA_INCOBRABLE', modulo: 'CxC', entidad: 'cuenta', entidadId: folio,
        detalle: `Cuenta ${folio} marcada como incobrable. Motivo: ${motivo}`,
        severidad: 'riesgo', datos: { motivo, marcadoPor: cuentas[idx].incobrablePor }
    });

    alert(`Cuenta marcada como incobrable.\nYa no aparecerá en proyecciones de efectivo.`);
    // Refrescar vistas
    if (typeof renderCuentasXCobrar === 'function') renderCuentasXCobrar();
    if (typeof renderAbonosDirectos === 'function') renderAbonosDirectos();
    renderCuentasIncobrables();
};

window.renderCuentasIncobrables = function() {
    const contenedor = document.getElementById('tablaIncobrables');
    if (!contenedor) return;

    const cuentas = StorageService.get('cuentasPorCobrar', [])
        .filter(c => c.incobrable === true && !_cxcCuentaCancelada(c));

    if (cuentas.length === 0) {
        contenedor.innerHTML = `<div style="background:#f8fafc; border:1px solid #e2e8f0; padding:40px; border-radius:10px; text-align:center; color:#64748b; font-size:15px;">
            Sin cuentas marcadas como incobrables.</div>`;
        return;
    }

    const totalSaldo = cuentas.reduce((s, c) => {
        const est = window._calcularEstadoCuenta?.(c.folio);
        return s + Number(est?.saldoTotal || c.saldoActual || 0);
    }, 0);

    let html = `
    <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:14px 18px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center;">
        <span style="font-weight:bold; color:#991b1b;">📋 ${cuentas.length} cuenta(s) incobrable(s)</span>
        <span style="font-weight:800; color:#dc2626; font-size:16px;">Saldo total: ${_cxcDinero(totalSaldo)}</span>
    </div>
    <div style="overflow-x:auto; background:white; border:1px solid #e5e7eb; border-radius:10px;">
    <table class="tabla-admin" style="margin:0;">
        <thead><tr>
            <th>Cliente / Folio</th>
            <th>Saldo</th>
            <th>Motivo</th>
            <th>Marcado</th>
            <th>Por</th>
            <th style="text-align:right;">Acción</th>
        </tr></thead>
        <tbody>`;

    cuentas.forEach(c => {
        const est = window._calcularEstadoCuenta?.(c.folio);
        const saldo = _cxcDinero(est?.saldoTotal || c.saldoActual || 0);
        const fecha = c.incobrableFecha ? new Date(c.incobrableFecha).toLocaleDateString('es-MX') : '-';
        html += `<tr>
            <td><strong>${_cxcEscHTML(c.nombre || c.clienteNombre || 'Cliente')}</strong><br>
                <small style="color:#64748b;">${_cxcEscHTML(c.folio)}</small></td>
            <td style="font-weight:800; color:#dc2626;">${saldo}</td>
            <td style="max-width:200px; font-size:12px; color:#6b7280;">${_cxcEscHTML(c.incobrableMotivo || '-')}</td>
            <td style="font-size:12px;">${fecha}</td>
            <td style="font-size:12px;">${_cxcEscHTML(c.incobrablePor || '-')}</td>
            <td style="text-align:right;">
                <button onclick="abrirEstadoCuenta('${_cxcEscHTML(c.folio)}')"
                    style="padding:6px 9px; background:#1e40af; color:white; border:none; border-radius:4px; cursor:pointer; font-size:12px; font-weight:700; margin-right:4px;">
                    👁 Ver</button>
                <button onclick="marcarIncobrable('${_cxcEscHTML(c.folio)}')"
                    style="padding:6px 9px; background:#059669; color:white; border:none; border-radius:4px; cursor:pointer; font-size:12px; font-weight:700;">
                    ↩ Reactivar</button>
            </td>
        </tr>`;
    });

    html += '</tbody></table></div>';
    contenedor.innerHTML = html;
};
