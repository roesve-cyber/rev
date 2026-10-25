// ============================================================================
// 🧮 CobranzaMotor — cálculos de la app de cobranza móvil (cobranza-movil.html)
//
// Es una COPIA FIEL, sin dependencias de StorageService, de las reglas que hoy
// viven en cxc.js (el sistema principal no se toca):
//   _calcularEstadoCuenta            -> estadoCuenta()
//   _cxcEvaluarPoliticaPagoAnticipado-> evaluarPoliticaPagoAnticipado()
//   _cxcEstadoPlazoCuenta            -> estadoPlazoCuenta()
//   _cxcDetectarSaltoPlazo           -> proyectarSaltoPlazo() / detectarSaltoPlazo()
//   _cxcCalcularCuponPronto + topado -> cuponTopadoParaPlazo()
//
// Todo recibe la configuración (configCreditoGlobal) y la fecha de hoy de forma
// explícita para poder probarse contra el sistema principal con los mismos datos.
// Si una regla cambia en cxc.js, hay que replicarla aquí.
// ============================================================================
(function (root) {
    'use strict';

    const MS_DIA = 86400000;

    // CalculatorService (js/services/calculator.js) está declarado con `const` en el ámbito
    // global: se alcanza por su nombre, NO como window.CalculatorService.
    function calc() {
        if (typeof CalculatorService !== 'undefined') return CalculatorService; // eslint-disable-line no-undef
        return root.CalculatorService || null;
    }

    // ------------------------------------------------------------------
    // Utilidades
    // ------------------------------------------------------------------
    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function dinero(n) {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(n) || 0);
    }

    // Mismo criterio que CobranzaRiskService.parseFecha (ISO, DD/MM/AAAA, DD-MM-AAAA, ms, Date)
    function parseFecha(valor) {
        if (!valor) return null;
        if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor;
        if (typeof valor === 'number') { const d = new Date(valor); return isNaN(d.getTime()) ? null : d; }
        const raw = String(valor).trim();
        if (!raw || raw === 'null' || raw === 'undefined') return null;
        if (/^\d{9,}$/.test(raw)) { const d = new Date(Number(raw)); return isNaN(d.getTime()) ? null : d; }
        const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12, 0, 0);
        const mx = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
        if (mx) return new Date(Number(mx[3]), Number(mx[2]) - 1, Number(mx[1]), 12, 0, 0);
        const d = new Date(raw);
        return isNaN(d.getTime()) ? null : d;
    }

    function p2(n) { return String(n).padStart(2, '0'); }

    // Igual que cxc.js: new Date(texto) respeta la hora guardada (afecta el conteo de días de atraso).
    function fechaExacta(valor) {
        if (typeof valor === 'string' && valor.indexOf('T') > 0) {
            const d = new Date(valor);
            if (!isNaN(d.getTime())) return d;
        }
        return parseFecha(valor);
    }

    // DD-MM-AAAA (mismo formato que formatearFechaCortaMX del sistema principal)
    function fechaCorta(fecha) {
        const d = parseFecha(fecha);
        if (!d) return '-';
        return `${p2(d.getDate())}-${p2(d.getMonth() + 1)}-${d.getFullYear()}`;
    }

    // DD/MM/AAAA para mostrar en pantalla
    function fechaVisible(fecha) {
        const d = parseFecha(fecha);
        if (!d) return '-';
        return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;
    }

    // AAAA-MM-DDTHH:mm:ss.000 en hora LOCAL (igual que localISO del sistema principal)
    function localISO(fecha) {
        const d = fecha instanceof Date ? fecha : new Date(fecha);
        return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}.000`;
    }

    function fechaInputHoy(hoy) {
        const d = hoy || new Date();
        return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
    }

    // ------------------------------------------------------------------
    // Formato de Firestore del sistema (storage2.js): arreglos dentro de arreglos
    // viajan envueltos en { __mmpArray: [...] }.
    // ------------------------------------------------------------------
    function limpiarParaFirestore(value, dentroDeArray) {
        if (value === undefined) return null;
        if (value === null) return null;
        if (value instanceof Date) return value;
        if (typeof value === 'function') return null;
        if (Array.isArray(value)) {
            const limpio = value.map(item => limpiarParaFirestore(item, true));
            return dentroDeArray ? { __mmpArray: limpio } : limpio;
        }
        if (typeof value === 'object') {
            const limpio = {};
            Object.entries(value).forEach(([k, v]) => {
                if (v === undefined || typeof v === 'function') return;
                limpio[k] = limpiarParaFirestore(v, false);
            });
            return limpio;
        }
        return value;
    }

    function restaurarDesdeFirestore(value) {
        if (value === null || value === undefined) return value;
        if (Array.isArray(value)) return value.map(restaurarDesdeFirestore);
        if (typeof value === 'object') {
            if (Object.prototype.hasOwnProperty.call(value, '__mmpArray') &&
                Array.isArray(value.__mmpArray) && Object.keys(value).length === 1) {
                return value.__mmpArray.map(restaurarDesdeFirestore);
            }
            const r = {};
            Object.entries(value).forEach(([k, v]) => { r[k] = restaurarDesdeFirestore(v); });
            return r;
        }
        return value;
    }

    // ------------------------------------------------------------------
    // Cuenta
    // ------------------------------------------------------------------
    function cuentaCancelada(c) {
        return String(c?.estado || c?.estatus || '').toLowerCase().includes('cancel');
    }
    function esIncobrable(c) { return c?.incobrable === true; }
    function cuentaSaldada(c) { return String(c?.estado || '').toLowerCase() === 'saldado'; }
    function esActiva(c) { return !!c && !cuentaCancelada(c) && !esIncobrable(c) && !cuentaSaldada(c); }

    function folioEsConsecutivoNuevo(folio) { return /^VTA-\d{5}$/.test(String(folio || '')); }

    function nombreCliente(c) { return c?.nombre || c?.clienteNombre || 'Cliente'; }

    function productoCuenta(c) {
        const nombres = (Array.isArray(c?.articulos) ? c.articulos : []).map(a => a.nombre).filter(Boolean);
        return nombres.length ? nombres.join(', ') : 'Venta General';
    }

    function fechaVentaDate(c) {
        const raw = c?.fechaVenta || c?.fecha || c?.fechaIso || c?.fechaVentaIso || '';
        const d = parseFecha(raw);
        return d && !isNaN(d.getTime()) ? d : new Date();
    }

    function importeContado(c) {
        const desdeArticulos = (Array.isArray(c?.articulos) ? c.articulos : []).reduce((s, a) =>
            s + (Number(a.precioContado || a.precio || 0) * Number(a.cantidad || 1)), 0);
        if (desdeArticulos > 0) return desdeArticulos;
        if (Number(c?.totalContadoOriginal || 0) > 0) return Number(c.totalContadoOriginal);
        if (Number(c?.totalMercancia || 0) > 0) return Number(c.totalMercancia);
        return 0;
    }

    function mesesPlan(c) { return Number(c?.plan?.meses || c?.plazoMeses || c?.meses || 0); }

    function moratoriosPendientes(c) {
        return (c?.cargosMoratorios || [])
            .filter(m => !m.cancelado && !m.anulado)
            .filter(m => String(m.tipo || 'cargo') !== 'exencion')
            .map(m => ({ ...m, pendiente: Math.max(0, Number(m.monto || 0) - Number(m.montoAbonado || 0)) }))
            .filter(m => m.pendiente > 0.01);
    }

    function abonosValidos(c) {
        return (c?.abonos || []).filter(a => !a.cancelado && !a.canceladoPorVenta && !a.canceladoPorApartado);
    }

    // _cxcTotalPagadoPolitica: máximo entre lo que reflejan los pagarés y los abonos
    function totalPagado(c, pagaresFolio) {
        const desdePagares = (pagaresFolio || []).reduce((s, p) => {
            const e = String(p.estado || '').toLowerCase();
            if (e === 'cancelado') return s;
            if (e === 'pagado') return s + Number(p.montoAbonado || p.monto || 0);
            if (e === 'parcial') return s + Number(p.montoAbonado || 0);
            return s;
        }, 0);
        const desdeAbonos = abonosValidos(c).reduce((s, a) => s + Number(a.monto || a.montoAbonado || 0), 0);
        return Math.max(desdePagares, desdeAbonos);
    }

    // ------------------------------------------------------------------
    // _calcularEstadoCuenta (motor central de saldos)
    // ------------------------------------------------------------------
    function estadoCuenta(c, pagaresFolio, hoy, riesgo) {
        hoy = hoy || new Date();
        const pagares = (pagaresFolio || []).slice().sort((a, b) =>
            (fechaExacta(a.fechaVencimiento) || 0) - (fechaExacta(b.fechaVencimiento) || 0));

        let saldoTotal = 0, montoVencido = 0, diasMaxAtraso = 0;
        const pagaresPendientes = [], pagaresVencidos = [];
        pagares.forEach(p => {
            if (p.estado === 'Pendiente' || p.estado === 'Parcial') {
                pagaresPendientes.push(p);
                const restante = (p.estado === 'Parcial') ? Math.max(0, (p.monto || 0) - (p.montoAbonado || 0)) : (p.monto || 0);
                saldoTotal += restante;
                const fv = fechaExacta(p.fechaVencimiento);
                if (fv && fv < hoy) {
                    pagaresVencidos.push(p);
                    montoVencido += restante;
                    const atraso = Math.floor((hoy - fv) / MS_DIA);
                    if (atraso > diasMaxAtraso) diasMaxAtraso = atraso;
                }
            }
        });

        const totalAbonado = abonosValidos(c).reduce((s, a) => s + (a.monto || 0), 0);
        const saldoPagares = saldoTotal;
        const saldoMoratorios = moratoriosPendientes(c).reduce((s, m) => s + Number(m.pendiente || 0), 0);
        if (saldoMoratorios > 0.01) saldoTotal += saldoMoratorios;

        let estadoGeneral = 'Activo', promesaVigente = false, analisis = null;
        if (c.estado === 'Saldado' || saldoTotal <= 0.01) {
            estadoGeneral = 'Saldado';
            saldoTotal = 0;
        } else if (riesgo && typeof riesgo.analizarCuenta === 'function') {
            analisis = riesgo.analizarCuenta(c, { hoy, pagaresSistema: pagares, saldoPreferente: saldoTotal });
            promesaVigente = !!analisis.promesa?.vigente;
            if (promesaVigente) estadoGeneral = 'Promesa';
            else if (analisis.key === 'bajo') estadoGeneral = 'Al corriente';
            else if (analisis.key === 'riesgo') estadoGeneral = 'Atrasado';
            else estadoGeneral = 'Crítico';
        } else {
            if (c.promesaPago && c.promesaPago.fecha) {
                const fp = new Date(c.promesaPago.fecha + 'T23:59:59');
                if (fp >= hoy) promesaVigente = true;
            }
            if (promesaVigente) estadoGeneral = 'Promesa';
            else if (pagaresVencidos.length === 0) estadoGeneral = 'Al corriente';
            else if (pagaresVencidos.length <= 2) estadoGeneral = 'Atrasado';
            else estadoGeneral = 'Crítico';
        }

        return {
            cuenta: c, pagares, pagaresPendientes, pagaresVencidos,
            saldoTotal, saldoPagares, saldoMoratorios, montoVencido, diasMaxAtraso,
            estadoGeneral, promesaVigente, totalAbonado, analisis
        };
    }

    // ------------------------------------------------------------------
    // Cupones de pronto pago (_cxcCalcularCuponPronto y topado entre plazos)
    // ------------------------------------------------------------------
    function redondearMontoCupon(monto, cfg) {
        const m = Math.max(0, Number(monto) || 0);
        const multiplo = Number(cfg?.redondeoCuponMultiplo || 0);
        if (!(multiplo > 1)) return m;
        const factor = (cfg?.redondeoCuponDireccion || 'abajo') === 'arriba' ? Math.ceil : Math.floor;
        return Math.max(0, factor(m / multiplo) * multiplo);
    }

    function calcularCuponPronto(meses, capitalContado, totalConTasaNormal, cfg) {
        const config = cfg || {};
        const plazoConfig = (config.plazos || []).find(p => Number(p.meses) === Number(meses));
        const tieneTasaBase = plazoConfig && plazoConfig.tasaBaseCupon !== undefined &&
            plazoConfig.tasaBaseCupon !== null && plazoConfig.tasaBaseCupon !== '';
        const CS = calc();
        let monto;
        if (tieneTasaBase && Number(capitalContado) > 0 && CS && CS.calcularCredito) {
            const r = CS.calcularCredito(capitalContado, { plazos: [{ meses: Number(meses), tasa: Number(plazoConfig.tasaBaseCupon) }] });
            const totalBase = Number(r?.[0]?.total || 0);
            monto = totalBase > 0 ? Math.max(0, Number(totalConTasaNormal || 0) - totalBase) : 0;
        } else {
            const pf = Number(config.porcentajeCuponProntoPago ?? 3);
            monto = Math.max(0, Number(totalConTasaNormal || 0)) * Math.max(0, pf) / 100;
        }
        monto = redondearMontoCupon(monto, config);
        const porcentajeEfectivo = Number(totalConTasaNormal) > 0 ? Math.round((monto / Number(totalConTasaNormal)) * 1000) / 10 : 0;
        return { monto, porcentajeEfectivo };
    }

    function planesConCuponTopado(capitalContado, periodicidad, cfg) {
        const CS = calc();
        if (!(Number(capitalContado) > 0) || !CS || typeof CS.calcularCreditoConPeriodicidad !== 'function') return [];
        const planes = CS.calcularCreditoConPeriodicidad(Number(capitalContado), periodicidad || 'semanal', cfg || null)
            .slice().sort((a, b) => a.meses - b.meses);
        const crudos = planes.map(p => calcularCuponPronto(p.meses, capitalContado, p.total, cfg).monto);
        const finales = new Array(crudos.length);
        let techo = Infinity;
        for (let i = crudos.length - 1; i >= 0; i--) { techo = Math.min(crudos[i], techo); finales[i] = techo; }
        return planes.map((p, i) => ({ meses: p.meses, total: p.total, cuponTopado: finales[i] }));
    }

    function cuponTopadoParaPlazo(meses, capitalContado, periodicidad, totalFallback, cfg) {
        const enc = planesConCuponTopado(capitalContado, periodicidad, cfg).find(p => Number(p.meses) === Number(meses));
        if (enc) return enc.cuponTopado;
        return calcularCuponPronto(meses, capitalContado, totalFallback, cfg).monto;
    }

    // ------------------------------------------------------------------
    // _cxcEstadoPlazoCuenta (semáforo del plazo pactado)
    // ------------------------------------------------------------------
    function estadoPlazoCuenta(c, estado, cfg, hoy) {
        hoy = hoy || new Date();
        if (!c) return null;
        const saldoActual = Number(estado?.saldoTotal ?? c.saldoActual ?? 0) - Number(estado?.saldoMoratorios || 0);
        const meses = mesesPlan(c);
        if (saldoActual <= 0.01 || meses <= 0 || cuentaCancelada(c) || esIncobrable(c)) return null;

        const fechaVenta = fechaVentaDate(c);
        const diasDesdeVenta = Math.max(0, Math.floor((hoy - fechaVenta) / MS_DIA));
        const diasPlazo = meses * 30.44;
        const diasRestantes = Math.ceil(diasPlazo - diasDesdeVenta);
        const aunEnPlazo = diasRestantes > 0;

        let semaforo = 'gris';
        if (aunEnPlazo) {
            if (diasRestantes <= 3) semaforo = 'rojo';
            else if (diasRestantes <= 7) semaforo = 'amarillo';
            else semaforo = 'verde';
        }

        const totalFinanciado = Number(c?.plan?.total || 0);
        const enganche = Number(c.engancheRecibido || c.enganche || 0);
        const capitalContado = Math.max(0, importeContado(c) - enganche);
        const ventaEsNueva = folioEsConsecutivoNuevo(c.folio);
        const esPlan1Mes = meses === 1;
        const cupon = (aunEnPlazo && ventaEsNueva && !esPlan1Mes)
            ? cuponTopadoParaPlazo(meses, capitalContado, c.periodicidad || 'semanal', totalFinanciado, cfg) : 0;
        const fechaLimite = new Date(fechaVenta.getTime() + Math.round(diasPlazo) * MS_DIA);

        return {
            folio: c.folio, saldoActual, mesesPlan: meses, diasDesdeVenta, diasRestantes, aunEnPlazo, semaforo,
            ventaEsNueva, esPlan1Mes, totalFinanciado,
            porcentajeCupon: totalFinanciado > 0 ? Math.round((cupon / totalFinanciado) * 1000) / 10 : 0,
            cuponSiLiquidaHoy: cupon, fechaLimite,
            mesesNuevoSiBrinca: meses < 6 ? meses + 1 : null
        };
    }

    // ------------------------------------------------------------------
    // _cxcEvaluarPoliticaPagoAnticipado (qué paga hoy quien liquida)
    // ------------------------------------------------------------------
    function evaluarPoliticaPagoAnticipado(c, estado, pagado, cfg, hoy, montoAbono) {
        hoy = hoy || new Date();
        montoAbono = Number(montoAbono || 0);
        const moratorios = Number(estado?.saldoMoratorios || 0);
        const saldoActual = Number(estado?.saldoTotal ?? c.saldoActual ?? 0) - moratorios;
        const enganche = Number(c.engancheRecibido || c.enganche || 0);
        const totalContado = importeContado(c);
        const capitalContado = Math.max(0, totalContado - enganche);
        const fechaVenta = fechaVentaDate(c);
        const diasDesdeVenta = Math.max(0, Math.floor((hoy - fechaVenta) / MS_DIA));
        const periodicidad = c.periodicidad || 'semanal';

        const base = {
            saldoActual, moratoriosPendientesMonto: moratorios, enganche, totalContado, capitalContado,
            totalPagado: pagado, diasDesdeVenta, periodicidad, montoAbono,
            aplica: false, liquidaria: false, beneficio: 0,
            montoLiquidacion: Math.max(0, saldoActual),
            faltante: Math.max(0, saldoActual - montoAbono),
            tipo: 'saldo', porcentajeCupon: 0,
            mensaje: 'Debe liquidar el saldo total vigente.'
        };

        if (saldoActual <= 0.01) return { ...base, liquidaria: true, faltante: 0, mensaje: 'La cuenta ya está liquidada.' };

        const meses = mesesPlan(c);
        const diasPlazoOriginal = meses > 0 ? meses * 30.44 : Infinity;
        const aunEnPlazo = diasDesdeVenta < diasPlazoOriginal;
        const liquidaria = montoAbono >= saldoActual - 0.01;

        if (!aunEnPlazo) {
            return { ...base, liquidaria, faltante: Math.max(0, saldoActual - montoAbono),
                tipo: 'fuera_de_plazo',
                mensaje: 'Ya pasó su plazo pactado: se liquida con el saldo vigente, sin cupón.' };
        }

        if (meses === 1) {
            const montoContado = Math.max(0, capitalContado - pagado);
            const montoLiquidacion = Math.min(montoContado, saldoActual);
            return { ...base,
                aplica: montoLiquidacion < saldoActual - 0.01,
                liquidaria: montoAbono >= montoLiquidacion - 0.01,
                beneficio: 0, montoLiquidacion,
                faltante: Math.max(0, montoLiquidacion - montoAbono),
                tipo: 'contado_1_mes', porcentajeCupon: 0,
                mensaje: `Plan de 1 mes: no genera cupón; se cobra el precio de contado real (${dinero(montoLiquidacion)}).` };
        }

        const totalFinanciado = Number(c?.plan?.total || 0);
        // Igual que el sistema: el beneficio se calcula siempre; el cupón solo se EMITE si la
        // venta es "nueva" (folio VTA-00000) -- ver emiteCupon abajo.
        const beneficio = cuponTopadoParaPlazo(meses, capitalContado, periodicidad, totalFinanciado, cfg);
        const porcentajeCupon = totalFinanciado > 0 ? Math.round((beneficio / totalFinanciado) * 1000) / 10 : 0;
        return { ...base,
            aplica: liquidaria && beneficio > 0.01,
            liquidaria, beneficio, montoLiquidacion: saldoActual,
            faltante: Math.max(0, saldoActual - montoAbono),
            tipo: 'pronto_pago_flat', porcentajeCupon,
            // cuponDisponible: el cupón que ganaría si liquida (venta nueva y con beneficio);
            // emiteCupon: se emitiría con ESTE abono (solo si además liquida).
            cuponDisponible: beneficio > 0.01 && folioEsConsecutivoNuevo(c.folio),
            emiteCupon: liquidaria && beneficio > 0.01 && folioEsConsecutivoNuevo(c.folio),
            mensaje: beneficio > 0.01 && folioEsConsecutivoNuevo(c.folio)
                ? `Dentro del plazo pactado: al liquidar recibe ${porcentajeCupon}% del total financiado como cupón.`
                : 'Dentro del plazo pactado: se liquida con el saldo vigente (esta venta no genera cupón).' };
    }

    // ------------------------------------------------------------------
    // Salto de plazo (_cxcDetectarSaltoPlazo): lo que pasa al CAMBIAR de escalón.
    // proyectarSaltoPlazo() calcula el escalón siguiente aunque todavía no se
    // venza (para mostrarlo como aviso); detectarSaltoPlazo() solo lo regresa
    // cuando de verdad ya pasó el plazo, igual que el sistema principal.
    // ------------------------------------------------------------------
    function escaleraPlanes(c, cfg) {
        const enganche = Number(c.engancheRecibido || c.enganche || 0);
        const capitalContado = Math.max(0, importeContado(c) - enganche);
        const periodicidad = c.periodicidad || 'semanal';
        const congelada = Array.isArray(c?.saldosPorMes) ? c.saldosPorMes.slice() : [];
        const sana = congelada.length > 0 && congelada.slice()
            .sort((a, b) => Number(a.meses || 0) - Number(b.meses || 0))
            .every((p, i, arr) => i === 0 || Number(p.total || 0) >= Number(arr[i - 1].total || 0) - 0.01);
        const CS = calc();
        const planes = sana ? congelada
            : ((CS && CS.calcularCreditoConPeriodicidad) ? CS.calcularCreditoConPeriodicidad(capitalContado, periodicidad, cfg || null) : []);
        return planes.slice().sort((a, b) => Number(a.meses || 0) - Number(b.meses || 0));
    }

    function proyectarSaltoPlazo(c, estado, cfg, hoy) {
        hoy = hoy || new Date();
        if (!c || cuentaCancelada(c) || esIncobrable(c)) return null;
        const saldoActual = Number(estado?.saldoTotal ?? c.saldoActual ?? 0) - Number(estado?.saldoMoratorios || 0);
        if (saldoActual <= 0.01) return null;
        const meses = mesesPlan(c);
        if (meses <= 0 || meses >= 6) return null;

        const fechaVenta = fechaVentaDate(c);
        const diasDesdeVenta = Math.max(0, Math.floor((hoy - fechaVenta) / MS_DIA));
        const yaPaso = diasDesdeVenta >= meses * 30.44;

        const mesesNuevo = meses + 1;
        const planNuevo = escaleraPlanes(c, cfg).find(p => Number(p.meses || 0) === mesesNuevo);
        if (!planNuevo) return null;
        // 🛡️ El sistema principal usa plan.total; en cuentas migradas ese campo no existe y su
        // "diferencia" sale igual al total completo. Aquí, para no mostrar un cargo falso al
        // cobrador, se parte de plan.totalTeorico cuando falta plan.total (diferenciaSistema
        // conserva el valor que calcularía el sistema principal).
        const totalSistema = Number(c?.plan?.total || 0);
        const totalActual = totalSistema || Number(c?.plan?.totalTeorico || 0);
        const totalNuevo = Number(planNuevo.total || 0);
        const diferencia = totalNuevo - totalActual;
        const diferenciaSistema = totalNuevo - totalSistema;
        if (diferenciaSistema <= 0.01) return null;
        if (diferencia <= 0.01) return null;

        return { folio: c.folio, mesesActual: meses, mesesNuevo, totalActual, totalNuevo, diferencia, diferenciaSistema, estimadoDesdeTeorico: !totalSistema,
            saldoActual, nuevoSaldoEstimado: saldoActual + diferencia, diasDesdeVenta, yaPaso };
    }

    function detectarSaltoPlazo(c, estado, cfg, hoy) {
        const s = proyectarSaltoPlazo(c, estado, cfg, hoy);
        return s && s.yaPaso ? s : null;
    }

    // Tabla del visor: todos los plazos del escalón, marcando el actual y el siguiente
    function escaleraVisor(c, cfg) {
        const meses = mesesPlan(c);
        const totalActual = Number(c?.plan?.total || 0);
        return escaleraPlanes(c, cfg).map(p => ({
            meses: Number(p.meses), total: Number(p.total || 0),
            esActual: Number(p.meses) === meses,
            esSiguiente: Number(p.meses) === meses + 1,
            diferencia: Number(p.total || 0) - totalActual
        }));
    }

    // ------------------------------------------------------------------
    // Resumen de una cuenta para la lista y la ficha
    // ------------------------------------------------------------------
    function resumenCuenta(c, pagaresFolio, ctx) {
        const hoy = ctx?.hoy || new Date();
        const cfg = ctx?.cfg || null;
        const estado = estadoCuenta(c, pagaresFolio, hoy, ctx?.riesgo);
        const pendientes = estado.pagaresPendientes;
        const prox = pendientes[0] || null;
        const proximoMonto = prox ? (prox.estado === 'Parcial' ? Math.max(0, prox.monto - (prox.montoAbonado || 0)) : prox.monto) : 0;
        const pagado = ctx?.totalPagadoOverride != null ? ctx.totalPagadoOverride : totalPagado(c, pagaresFolio);
        const plazo = estadoPlazoCuenta(c, estado, cfg, hoy);
        return {
            folio: c.folio,
            cliente: nombreCliente(c),
            producto: productoCuenta(c),
            estado,
            saldo: estado.saldoTotal,
            saldoNominal: estado.saldoPagares,
            moratorios: estado.saldoMoratorios,
            vencido: estado.montoVencido,
            diasAtraso: estado.diasMaxAtraso,
            nVencidos: estado.pagaresVencidos.length,
            proximo: prox ? { fecha: prox.fechaVencimiento, monto: proximoMonto, vencido: !!(fechaExacta(prox.fechaVencimiento) && fechaExacta(prox.fechaVencimiento) < hoy) } : null,
            riesgo: estado.analisis,
            plazo,
            politica: evaluarPoliticaPagoAnticipado(c, estado, pagado, cfg, hoy, 0),
            salto: proyectarSaltoPlazo(c, estado, cfg, hoy),
            pagado
        };
    }

    // ------------------------------------------------------------------
    // Abono -> Bóveda de autorizaciones (misma estructura que "cuarentena" en cxc.js)
    // ------------------------------------------------------------------
    function construirAbonoBoveda(p) {
        const ahora = p.ahora || new Date();
        const fechaObj = p.fechaAbonoRaw ? new Date(p.fechaAbonoRaw + 'T12:00:00') : ahora;
        const medioPago = p.medioPago === 'transferencia' ? 'transferencia' : 'efectivo';
        const referencia = medioPago === 'transferencia' ? String(p.referencia || '').trim() : '';
        const grupoConciliacion = referencia
            ? `TRANSF-${referencia.toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9_-]/g, '')}` : '';
        return {
            id: Date.now() + Math.random(),
            folioCXC: p.folio,
            fechaCaptura: fechaCorta(ahora),
            fechaCapturaIso: localISO(ahora),
            clienteNombre: p.clienteNombre,
            montoAbonado: Number(p.monto),
            estado: 'Pendiente',
            status: 'Pendiente',
            estatus: 'Pendiente',
            montoAbonoInput: Number(p.monto),
            fechaAbonoRaw: p.fechaAbonoRaw || fechaInputHoy(ahora),
            cuentaId: p.cuentaId,
            etiquetaCuenta: p.etiquetaCuenta,
            medioPago,
            referenciaBancaria: referencia,
            grupoConciliacion,
            liquidacionPorPolitica: false,
            fechaAbonoIso: localISO(fechaObj),
            fechaAbonoStr: fechaCorta(fechaObj),
            vendedorId: p.vendedorId || null,
            cuponEmitidoId: null,
            montoCondonadoPolitica: 0,
            motivoCondonacionPolitica: '',
            // Trazabilidad propia de la app de cobranza (el sistema principal ignora estos campos)
            origen: 'cobranza-movil',
            capturadoPorUid: p.usuario?.uid || null,
            capturadoPorNombre: p.usuario?.nombre || null,
            capturadoPorRol: p.usuario?.rol || null
        };
    }

    root.CobranzaMotor = {
        esc, dinero, parseFecha, fechaCorta, fechaVisible, localISO, fechaInputHoy,
        limpiarParaFirestore, restaurarDesdeFirestore,
        cuentaCancelada, esIncobrable, cuentaSaldada, esActiva, folioEsConsecutivoNuevo,
        nombreCliente, productoCuenta, fechaVentaDate, importeContado, mesesPlan,
        moratoriosPendientes, abonosValidos, totalPagado,
        estadoCuenta, calcularCuponPronto, planesConCuponTopado, cuponTopadoParaPlazo,
        estadoPlazoCuenta, evaluarPoliticaPagoAnticipado,
        escaleraPlanes, escaleraVisor, proyectarSaltoPlazo, detectarSaltoPlazo,
        resumenCuenta, construirAbonoBoveda
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = root.CobranzaMotor;
})(typeof window !== 'undefined' ? window : globalThis);
