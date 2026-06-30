(function () {
    const MS_DIA = 24 * 60 * 60 * 1000;

    function parseFecha(valor) {
        if (!valor) return null;
        if (typeof window.parseFechaMXOrNull === 'function') {
            try {
                const d = window.parseFechaMXOrNull(valor);
                if (d && !isNaN(d.getTime())) return d;
            } catch (e) {}
        }
        if (typeof window.parseFechaMX === 'function') {
            try {
                const d = window.parseFechaMX(valor);
                if (d && !isNaN(d.getTime())) return d;
            } catch (e) {}
        }
        if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor;
        if (typeof valor === 'number') {
            const d = new Date(valor);
            return isNaN(d.getTime()) ? null : d;
        }

        const raw = String(valor).trim();
        if (!raw || raw === 'null' || raw === 'undefined') return null;
        if (/^\d+$/.test(raw)) {
            const d = new Date(Number(raw));
            return isNaN(d.getTime()) ? null : d;
        }

        const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12, 0, 0);

        const mx = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
        if (mx) return new Date(Number(mx[3]), Number(mx[2]) - 1, Number(mx[1]), 12, 0, 0);

        const d = new Date(raw);
        return isNaN(d.getTime()) ? null : d;
    }

    function inicioDia(fecha) {
        if (!fecha) return null;
        return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 12, 0, 0);
    }

    function diasEntre(desde, hasta) {
        const a = inicioDia(desde);
        const b = inicioDia(hasta || new Date());
        if (!a || !b) return 9999;
        return Math.max(0, Math.floor((b - a) / MS_DIA));
    }

    function cuentaCancelada(cuenta) {
        return String(cuenta?.estado || cuenta?.estatus || '').toLowerCase().includes('cancel');
    }

    function cuentaIncobrable(cuenta) {
        return cuenta?.incobrable === true;
    }

    function abonoValido(abono) {
        if (!abono) return false;
        const estado = String(abono.estado || abono.estatus || '').toLowerCase();
        if (estado.includes('cancel') || estado.includes('anulad')) return false;
        if (abono.cancelado || abono.canceladoPorVenta || abono.canceladoPorApartado) return false;
        return Number(abono.monto || abono.abono || abono.importe || abono.montoAbonado || 0) > 0;
    }

    function fechaAbono(abono) {
        return parseFecha(abono?.fechaAbonoIso || abono?.fechaIso || abono?.fechaAbonoRaw || abono?.fechaAbono || abono?.fechaPago || abono?.fecha || abono?.createdAt);
    }

    function obtenerAbonos(cuenta) {
        return (Array.isArray(cuenta?.abonos) ? cuenta.abonos : [])
            .filter(abonoValido)
            .map(a => ({ abono: a, fecha: fechaAbono(a), monto: Number(a.monto || a.abono || a.importe || a.montoAbonado || 0) }))
            .filter(x => x.fecha)
            .sort((a, b) => a.fecha - b.fecha);
    }

    function obtenerFechaVenta(cuenta) {
        return parseFecha(cuenta?.fechaVenta || cuenta?.fechaVentaIso || cuenta?.fechaIso || cuenta?.fecha || cuenta?.fechaRegistro || cuenta?.createdAt);
    }

    function saldoDesdePagares(cuenta, pagaresSistema) {
        const folio = String(cuenta?.folio || cuenta?.folioVenta || '');
        return (Array.isArray(pagaresSistema) ? pagaresSistema : [])
            .filter(p => String(p.folio || p.folioVenta || '') === folio)
            .filter(p => !['pagado', 'cancelado'].includes(String(p.estado || '').toLowerCase()))
            .reduce((s, p) => s + Math.max(0, Number(p.monto || 0) - Number(p.montoAbonado || p.abonado || 0)), 0);
    }

    function saldoCuenta(cuenta, opciones) {
        if (Number(opciones?.saldoPreferente || 0) > 0) return Number(opciones.saldoPreferente);
        if (opciones?.estadoCuenta) {
            const saldo = Number(opciones.estadoCuenta.saldoTotal ?? opciones.estadoCuenta.saldoActual ?? 0);
            if (saldo > 0) return saldo;
        }
        const directo = Number(cuenta?.saldoActual ?? cuenta?.saldoPendiente ?? cuenta?.saldo ?? 0);
        if (directo > 0) return directo;
        const pagares = opciones?.pagaresSistema || (typeof StorageService !== 'undefined' ? StorageService.get('pagaresSistema', []) : []);
        return saldoDesdePagares(cuenta, pagares);
    }

    function promesaInfo(cuenta, hoy) {
        const fecha = parseFecha(cuenta?.promesaPago?.fecha || cuenta?.fechaPromesaPago || cuenta?.promesaFecha);
        if (!fecha) return { tiene: false, vigente: false, vencida: false, fecha: null };
        const dias = Math.floor((inicioDia(fecha) - inicioDia(hoy || new Date())) / MS_DIA);
        return { tiene: true, vigente: dias >= 0, vencida: dias < 0, fecha, diasRestantes: dias };
    }

    function clasificar(dias, sinPrimerPago) {
        if (dias <= 30) {
            let subnivel = 'Al dia';
            if (dias > 20) subnivel = 'Seguimiento 21-30 dias';
            else if (dias > 15) subnivel = 'Recordatorio 16-20 dias';
            else if (dias > 8) subnivel = 'Seguimiento suave 9-15 dias';
            return {
                key: 'bajo',
                nivel: 'Bajo riesgo',
                estado: sinPrimerPago ? 'Sin primer pago' : 'Bajo riesgo',
                subnivel,
                prioridad: sinPrimerPago && dias > 15 ? 1 : 0,
                color: '#166534',
                bg: '#dcfce7',
                borde: '#22c55e',
                accion: sinPrimerPago ? 'Confirmar primer abono' : 'Mantener seguimiento normal'
            };
        }
        if (dias <= 60) {
            return { key: 'riesgo', nivel: 'Riesgo', estado: 'Riesgo', subnivel: '31-60 dias', prioridad: 1, color: '#92400e', bg: '#fef3c7', borde: '#f59e0b', accion: 'Contactar y acordar fecha de abono' };
        }
        if (dias <= 120) {
            return { key: 'alto', nivel: 'Alto riesgo', estado: 'Alto riesgo', subnivel: '61-120 dias', prioridad: 2, color: '#991b1b', bg: '#fee2e2', borde: '#ef4444', accion: 'Priorizar cobranza y registrar promesa' };
        }
        return { key: 'alerta', nivel: 'Alerta total', estado: 'Alerta total', subnivel: '121+ dias', prioridad: 3, color: '#581c87', bg: '#f3e8ff', borde: '#7e22ce', accion: 'Escalar seguimiento de recuperacion' };
    }

    function analizarCuenta(cuenta, opciones = {}) {
        const hoy = inicioDia(opciones.hoy || new Date());
        const saldo = saldoCuenta(cuenta, opciones);
        const abonos = obtenerAbonos(cuenta);
        const ultimo = abonos.length ? abonos[abonos.length - 1] : null;
        const fechaVenta = obtenerFechaVenta(cuenta);
        const fechaReferencia = ultimo?.fecha || fechaVenta || hoy;
        const sinPrimerPago = !ultimo;
        const diasSinPago = diasEntre(fechaReferencia, hoy);
        const totalAbonado = abonos.reduce((s, a) => s + a.monto, 0);
        const promesa = promesaInfo(cuenta, hoy);
        const base = clasificar(diasSinPago, sinPrimerPago);

        const estadoCuenta = opciones.estadoCuenta || null;
        const pagaresVencidos = Array.isArray(estadoCuenta?.pagaresVencidos) ? estadoCuenta.pagaresVencidos : [];
        const liquidada = saldo <= 0.01 || String(cuenta?.estado || '').toLowerCase() === 'saldado';

        if (liquidada) {
            return {
                cuenta,
                key: 'saldado',
                nivelRiesgo: 'Saldado',
                estadoGeneral: 'Saldado',
                subnivel: 'Sin saldo',
                prioridad: 0,
                color: '#64748b',
                bg: '#f1f5f9',
                borde: '#94a3b8',
                saldo: 0,
                totalAbonado,
                fechaUltimoPago: ultimo?.fecha || null,
                fechaReferencia,
                diasSinPago: 0,
                sinPrimerPago,
                promesa,
                pagaresVencidos,
                accion: 'Sin accion'
            };
        }

        const estadoGeneral = promesa.vigente ? 'Promesa' : base.estado;
        return {
            cuenta,
            key: base.key,
            nivelRiesgo: base.nivel,
            estadoGeneral,
            subnivel: base.subnivel,
            prioridad: base.prioridad,
            color: base.color,
            bg: base.bg,
            borde: base.borde,
            saldo,
            totalAbonado,
            fechaUltimoPago: ultimo?.fecha || null,
            fechaReferencia,
            diasSinPago,
            sinPrimerPago,
            promesa,
            pagaresVencidos,
            accion: promesa.vigente ? 'Dar seguimiento a promesa vigente' : base.accion
        };
    }

    function analizarCartera(cuentas, pagaresSistema, opciones = {}) {
        const items = (Array.isArray(cuentas) ? cuentas : [])
            .filter(c => c && !cuentaCancelada(c) && !cuentaIncobrable(c))
            .map(cuenta => analizarCuenta(cuenta, { ...opciones, pagaresSistema }))
            .filter(r => r.key !== 'saldado')
            .sort((a, b) => {
                if (b.prioridad !== a.prioridad) return b.prioridad - a.prioridad;
                if (b.diasSinPago !== a.diasSinPago) return b.diasSinPago - a.diasSinPago;
                return b.saldo - a.saldo;
            });

        const grupos = { bajo: [], riesgo: [], alto: [], alerta: [] };
        items.forEach(r => {
            if (grupos[r.key]) grupos[r.key].push(r);
        });

        const resumenGrupo = lista => ({
            cuentas: lista.length,
            saldo: lista.reduce((s, r) => s + Number(r.saldo || 0), 0)
        });

        const alertas = items.filter(r => r.prioridad > 0 || r.promesa.vencida);
        return {
            items,
            alertas,
            grupos,
            resumen: {
                total: resumenGrupo(items),
                bajo: resumenGrupo(grupos.bajo),
                riesgo: resumenGrupo(grupos.riesgo),
                alto: resumenGrupo(grupos.alto),
                alerta: resumenGrupo(grupos.alerta),
                sinPrimerPago: resumenGrupo(items.filter(r => r.sinPrimerPago))
            }
        };
    }

    function formatearFecha(fecha) {
        if (!fecha) return 'Sin pago';
        if (typeof window.formatearFechaCortaMX === 'function') return window.formatearFechaCortaMX(fecha);
        return fecha.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    window.CobranzaRiskService = {
        parseFecha,
        inicioDia,
        analizarCuenta,
        analizarCartera,
        formatearFecha
    };
})();
