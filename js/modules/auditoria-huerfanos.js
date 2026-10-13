// =====================================================================
// 🔎 AUDITORÍA DE MOVIMIENTOS HUÉRFANOS
// ---------------------------------------------------------------------
// Casi toda operación del sistema deja DOS huellas:
//   (1) el REGISTRO de negocio  (abono en la cuenta, gasto, anticipo en la OC,
//       pago de tarjeta, préstamo...) y
//   (2) el MOVIMIENTO de caja   (entrada/salida en movimientosCaja).
// Si una de las dos se queda sin la otra, el saldo del banco/caja deja de
// cuadrar con lo que dicen los registros. Esta pantalla revisa, por tipo de
// movimiento y con el filtro que se elija (rango de fechas), cuáles están
// COMPLETOS y cuáles HUÉRFANOS.
//
// Solo LEE datos — nunca modifica nada. Para corregir un caso hay que ir al
// módulo de origen (o al Visor de Movimientos).
//
// Cómo se agrega un tipo nuevo: escribir una función revisarXxx(ctx) que
// regrese un arreglo de renglones (ver `fila()`) y darla de alta en TIPOS.
//
// Estados de cada renglón:
//   ok            → registro y movimiento de caja coinciden
//   sin-caja      → hay REGISTRO pero no salió/entró dinero en caja
//   sin-registro  → hay MOVIMIENTO de caja pero no existe el registro
//   falta-entrada / falta-salida → transferencia a la que le falta una pata
//   monto         → ambos existen pero el importe no coincide
//   unico         → por diseño NO lleva complemento (p. ej. préstamo histórico)
// =====================================================================
(function () {
    'use strict';

    // ── Utilidades ───────────────────────────────────────────────────
    const leer = (tabla) => {
        try {
            const v = StorageService.get(tabla, []);
            return Array.isArray(v) ? v : [];
        } catch (e) { return []; }
    };
    const num = (v) => {
        const n = Number(String(v === undefined || v === null ? 0 : v).replace(/[$,]/g, ''));
        return Number.isFinite(n) ? n : 0;
    };
    const aFecha = (v) => {
        if (v === undefined || v === null || v === '') return null;
        if (typeof window.parseFechaMXOrNull === 'function') return window.parseFechaMXOrNull(v);
        const d = new Date(v);
        return isNaN(d.getTime()) ? null : d;
    };
    const txtFecha = (d) => {
        if (!d) return '—';
        const p = (n) => String(n).padStart(2, '0');
        return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
    };
    const esc = (s) => String(s === undefined || s === null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const dinero$ = (v) => (typeof window.dinero === 'function')
        ? window.dinero(v)
        : '$' + num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const esIngreso = (m) => String(m.tipo || '').toLowerCase() === 'ingreso';
    const esEgreso = (m) => String(m.tipo || '').toLowerCase() === 'egreso';
    const suma = (arr) => arr.reduce((s, m) => s + num(m.monto), 0);
    const cerca = (a, b, dias) => !a || !b || Math.abs(a - b) <= dias * 86400000;

    const ESTADOS = {
        'ok':            { txt: 'Completo',                  ic: '✅', bg: '#dcfce7', fg: '#166534' },
        'sin-caja':      { txt: 'Registro sin caja',         ic: '🔴', bg: '#fee2e2', fg: '#991b1b' },
        'sin-registro':  { txt: 'Caja sin registro',         ic: '🔴', bg: '#fee2e2', fg: '#991b1b' },
        'falta-entrada': { txt: 'Falta la entrada',          ic: '🔴', bg: '#fee2e2', fg: '#991b1b' },
        'falta-salida':  { txt: 'Falta la salida',           ic: '🔴', bg: '#fee2e2', fg: '#991b1b' },
        'monto':         { txt: 'Monto distinto',            ic: '🟠', bg: '#ffedd5', fg: '#9a3412' },
        'unico':         { txt: 'Único por diseño',          ic: '⚪', bg: '#f1f5f9', fg: '#475569' }
    };
    const HUERFANOS = new Set(['sin-caja', 'sin-registro', 'falta-entrada', 'falta-salida']);

    // ── Contexto compartido (índices sobre movimientosCaja) ──────────
    function crearCtx() {
        const movs = leer('movimientosCaja');
        const porRef = new Map();
        movs.forEach((m) => {
            const r = String(m.referencia || '');
            if (!r) return;
            if (!porRef.has(r)) porRef.set(r, []);
            porRef.get(r).push(m);
        });
        return {
            movs,
            porRef,
            usados: new Set(),                 // movimientos ya emparejados (cada uno se usa una sola vez)
            opciones: {}
        };
    }

    // Renglón de resultado
    function fila(tipo, o) {
        return Object.assign({
            tipo, estado: 'ok', fecha: null, ref: '', desc: '', monto: 0, detalle: ''
        }, o);
    }

    // Empareja registros con movimientos de caja, uno a uno:
    //   1) por idOperacion exacta, 2) por monto + fecha cercana (≤5 días),
    //   3) por monto con cualquier fecha. Regresa un arreglo paralelo a
    //   `registros` con el movimiento encontrado (o null).
    function parear(registros, candidatos, ctx) {
        const res = new Array(registros.length).fill(null);
        const libre = (m) => !ctx.usados.has(m);
        const tomar = (i, m) => { res[i] = m; ctx.usados.add(m); };
        registros.forEach((r, i) => {
            if (!r.idOp) return;
            const m = candidatos.find((x) => libre(x) && String(x.idOperacion || '') === r.idOp);
            if (m) tomar(i, m);
        });
        registros.forEach((r, i) => {
            if (res[i]) return;
            const m = candidatos.find((x) => libre(x) && Math.abs(num(x.monto) - r.monto) < 0.01 && cerca(aFecha(x.fecha), r.fecha, 5));
            if (m) tomar(i, m);
        });
        registros.forEach((r, i) => {
            if (res[i]) return;
            const m = candidatos.find((x) => libre(x) && Math.abs(num(x.monto) - r.monto) < 0.01);
            if (m) tomar(i, m);
        });
        return res;
    }

    // Movimientos que sobraron (sin registro). Se ignoran los que tienen un
    // movimiento contrario del mismo importe en el mismo grupo (reversa normal).
    function sobrantes(candidatos, contrarios, ctx) {
        const cont = contrarios.slice();
        return candidatos.filter((m) => {
            if (ctx.usados.has(m)) return false;
            const k = cont.findIndex((c) => !ctx.usados.has(c) && Math.abs(num(c.monto) - num(m.monto)) < 0.01);
            if (k !== -1) { ctx.usados.add(cont[k]); ctx.usados.add(m); cont.splice(k, 1); return false; }
            return true;
        });
    }

    // ── 1) ABONOS A CRÉDITO (cuentas por cobrar) ─────────────────────
    function revisarAbonosCredito(ctx) {
        const out = [];
        const cuentas = leer('cuentasPorCobrar');
        const folios = new Set();
        const vigente = (a) => a && !a.cancelado && !a.canceladoPorVenta && !a.canceladoPorApartado && !a.eliminadoAuditoria;
        const exentarMig = ctx.opciones.exentarMig !== false;

        cuentas.forEach((c) => {
            const folio = String(c.folio || '');
            if (!folio) return;
            folios.add(folio);
            const ref = `ABONO-${folio}`;
            const movs = ctx.porRef.get(ref) || [];
            const ingresos = movs.filter(esIngreso);
            const egresos = movs.filter(esEgreso);
            const abonos = Array.isArray(c.abonos) ? c.abonos : [];
            const reg = (a) => ({
                monto: num(a.monto),
                fecha: aFecha(a.fechaAbonoIso || a.fechaAbonoStr || a.fecha),
                idOp: String(a.idOperacion || a.idCuarentena || a.id || '')
            });
            const vig = abonos.filter(vigente);
            const noVig = abonos.filter((a) => !vigente(a));
            const regs = vig.map(reg);
            const pares = parear(regs, ingresos, ctx);
            // Abonos cancelados: solo consumen su movimiento original para que no salga como huérfano.
            parear(noVig.map(reg), ingresos, ctx);
            const cliente = c.clienteNombre || (typeof c.cliente === 'string' ? c.cliente : '') || '';
            const esMig = folio.toUpperCase().startsWith('MIG-');

            regs.forEach((r, i) => {
                const m = pares[i];
                const base = { fecha: r.fecha, ref: folio, desc: `Abono a crédito${cliente ? ' — ' + cliente : ''}`, monto: r.monto };
                if (m) {
                    const dif = Math.abs(num(m.monto) - r.monto) > 0.01;
                    out.push(fila('abono_credito', Object.assign(base, dif
                        ? { estado: 'monto', detalle: `Abono ${dinero$(r.monto)} vs caja ${dinero$(m.monto)}` }
                        : { estado: 'ok', detalle: `Caja: ${m.etiquetaCuenta || m.cuenta || ''}` })));
                } else if (esMig && exentarMig) {
                    out.push(fila('abono_credito', Object.assign(base, { estado: 'unico', detalle: 'Cuenta migrada (MIG-): abono histórico sin movimiento de caja' })));
                } else {
                    out.push(fila('abono_credito', Object.assign(base, { estado: 'sin-caja', detalle: 'El abono está en la cuenta pero no entró dinero a ninguna caja/banco' })));
                }
            });
            sobrantes(ingresos, egresos, ctx).forEach((m) => {
                out.push(fila('abono_credito', {
                    estado: 'sin-registro', fecha: aFecha(m.fecha), ref: folio, monto: num(m.monto),
                    desc: `Ingreso en caja de abono${cliente ? ' — ' + cliente : ''}`,
                    detalle: 'Entró dinero a caja pero la cuenta no tiene ese abono (¿abono eliminado o no aplicado?)'
                }));
            });
        });

        // Ingresos ABONO-<folio> cuyo folio ya no existe en cuentasPorCobrar
        ctx.porRef.forEach((movs, ref) => {
            if (!ref.startsWith('ABONO-')) return;
            const resto = ref.slice(6);
            if (/^(PROV-|OC-|PRESTAMO-)/.test(resto) || folios.has(resto)) return;
            movs.filter((m) => esIngreso(m) && !ctx.usados.has(m)).forEach((m) => {
                out.push(fila('abono_credito', {
                    estado: 'sin-registro', fecha: aFecha(m.fecha), ref: resto, monto: num(m.monto),
                    desc: 'Ingreso en caja de abono', detalle: 'El folio no existe en cuentas por cobrar'
                }));
            });
        });
        return out;
    }

    // ── 2) ABONOS A APARTADOS ────────────────────────────────────────
    function revisarAbonosApartado(ctx) {
        const out = [];
        const aps = leer('apartados');
        const folios = new Set();
        const vigente = (a) => a && !a.cancelado && !a.canceladoPorVenta && !a.canceladoPorApartado;

        aps.forEach((ap) => {
            const folio = String(ap.folio || '');
            if (!folio) return;
            folios.add(folio);
            const movs = ctx.porRef.get(`ABN-APT-${folio}`) || [];
            const ingresos = movs.filter(esIngreso);
            const egresos = movs.filter(esEgreso);
            const abonos = Array.isArray(ap.abonos) ? ap.abonos : [];
            const reg = (a) => ({
                monto: num(a.monto),
                fecha: aFecha(a.fechaAbono || a.fecha),
                idOp: String(a.idOperacion || a.idCuarentena || a.id || '')
            });
            const vig = abonos.filter(vigente);
            const regs = vig.map(reg);
            const pares = parear(regs, ingresos, ctx);
            parear(abonos.filter((a) => !vigente(a)).map(reg), ingresos, ctx);
            const cliente = ap.clienteNombre || '';

            regs.forEach((r, i) => {
                const m = pares[i];
                const base = { fecha: r.fecha, ref: folio, desc: `Abono a apartado${cliente ? ' — ' + cliente : ''}`, monto: r.monto };
                if (m) {
                    const dif = Math.abs(num(m.monto) - r.monto) > 0.01;
                    out.push(fila('abono_apartado', Object.assign(base, dif
                        ? { estado: 'monto', detalle: `Abono ${dinero$(r.monto)} vs caja ${dinero$(m.monto)}` }
                        : { estado: 'ok', detalle: `Caja: ${m.etiquetaCuenta || m.cuenta || ''}` })));
                } else {
                    out.push(fila('abono_apartado', Object.assign(base, { estado: 'sin-caja', detalle: 'El abono está en el apartado pero no entró dinero a caja/banco' })));
                }
            });
            sobrantes(ingresos, egresos, ctx).forEach((m) => {
                out.push(fila('abono_apartado', {
                    estado: 'sin-registro', fecha: aFecha(m.fecha), ref: folio, monto: num(m.monto),
                    desc: `Ingreso en caja de apartado${cliente ? ' — ' + cliente : ''}`,
                    detalle: 'Entró dinero a caja pero el apartado no tiene ese abono'
                }));
            });
        });
        ctx.porRef.forEach((movs, ref) => {
            if (!ref.startsWith('ABN-APT-')) return;
            const folio = ref.slice(8);
            if (folios.has(folio)) return;
            movs.filter((m) => esIngreso(m) && !ctx.usados.has(m)).forEach((m) => {
                out.push(fila('abono_apartado', {
                    estado: 'sin-registro', fecha: aFecha(m.fecha), ref: folio, monto: num(m.monto),
                    desc: 'Ingreso en caja de apartado', detalle: 'El folio no existe en apartados'
                }));
            });
        });
        return out;
    }

    // ── 3) ÓRDENES DE COMPRA: anticipos, abonos y pagos ──────────────
    function revisarOrdenesCompra(ctx) {
        const out = [];
        const ocs = leer('ordenesCompra');
        const porId = new Map();
        const porFolio = new Map();
        ocs.forEach((oc) => {
            porId.set(String(oc.id), oc);
            if (oc.folio) porFolio.set(String(oc.folio), oc);
        });

        // A qué OC pertenece cada movimiento de caja
        const grupos = new Map();            // ocId → { oc, egresos: [], ingresos: [] }
        const huerfanosSinOC = [];
        const claveOC = (m) => {
            const op = String(m.idOperacion || '');
            const ref = String(m.referencia || '');
            let r;
            if ((r = (op || ref).match(/^ANTICIPO-OC-(\d+)/))) return { id: r[1] };
            if ((r = (op || ref).match(/^OC-REC-(\d+)/))) return { id: r[1], recepcion: true };
            if ((r = (op || ref).match(/^ABONO-OC-(\d+)-/))) return { id: r[1] };
            if ((r = ref.match(/^OC-PAGO-(\d+)/))) return { id: r[1] };
            if (porFolio.has(ref)) return { id: String(porFolio.get(ref).id) };
            if ((r = ref.match(/^Cancelaci[oó]n\s+(.+)$/)) && porFolio.has(r[1].trim())) return { id: String(porFolio.get(r[1].trim()).id) };
            return null;
        };
        ctx.movs.forEach((m) => {
            const k = claveOC(m);
            if (!k) return;
            const oc = porId.get(k.id);
            if (!oc) { if (esEgreso(m)) huerfanosSinOC.push(m); return; }
            if (!grupos.has(k.id)) grupos.set(k.id, { oc, egresos: [], ingresos: [], recepcion: [] });
            const g = grupos.get(k.id);
            if (k.recepcion && esEgreso(m)) g.recepcion.push(m);
            else if (esEgreso(m)) g.egresos.push(m);
            else g.ingresos.push(m);
        });

        ocs.forEach((oc) => {
            const g = grupos.get(String(oc.id)) || { egresos: [], ingresos: [], recepcion: [] };
            const pagos = Array.isArray(oc.pagos) ? oc.pagos : [];
            const regs = pagos.map((p) => ({
                monto: num(p.monto),
                fecha: aFecha(p.fecha),
                idOp: String(p.idOperacion || p.referencia || '')
            }));
            const pares = parear(regs, g.egresos.concat(g.recepcion), ctx);
            const prov = oc.proveedorNombre || '';
            regs.forEach((r, i) => {
                const m = pares[i];
                const esAnticipo = /^ANTICIPO-OC-/.test(r.idOp);
                const base = {
                    fecha: r.fecha, ref: oc.folio || String(oc.id), monto: r.monto,
                    desc: `${esAnticipo ? 'Anticipo' : 'Pago/abono'} de OC${prov ? ' — ' + prov : ''}`
                };
                if (m) {
                    const dif = Math.abs(num(m.monto) - r.monto) > 0.01;
                    out.push(fila('oc', Object.assign(base, dif
                        ? { estado: 'monto', detalle: `Pago ${dinero$(r.monto)} vs caja ${dinero$(m.monto)}` }
                        : { estado: 'ok', detalle: `Salió de: ${m.etiquetaCuenta || m.cuenta || ''}` })));
                } else {
                    out.push(fila('oc', Object.assign(base, { estado: 'sin-caja', detalle: 'La OC muestra el pago pero no salió dinero de ninguna caja/banco' })));
                }
            });
            // Pagado declarado en la OC que no está documentado en pagos[]
            const documentado = regs.reduce((s, r) => s + r.monto, 0);
            const declarado = num(oc.anticipo_pagado);
            if (declarado - documentado > 0.01) {
                out.push(fila('oc', {
                    estado: 'monto', fecha: aFecha(oc.fechaEmision), ref: oc.folio || String(oc.id), monto: declarado - documentado,
                    desc: `Pagado sin detalle${prov ? ' — ' + prov : ''}`,
                    detalle: `La OC dice ${dinero$(declarado)} pagado pero solo ${dinero$(documentado)} tiene registro de pago`
                }));
            }
            // Egresos de caja ligados a la OC que no están en pagos[]
            const sobra = sobrantes(g.egresos, g.ingresos, ctx);
            sobra.forEach((m) => {
                out.push(fila('oc', {
                    estado: 'sin-registro', fecha: aFecha(m.fecha), ref: oc.folio || String(oc.id), monto: num(m.monto),
                    desc: `Salida de caja ligada a OC${prov ? ' — ' + prov : ''}`,
                    detalle: 'Salió dinero pero la OC no tiene ese pago registrado'
                }));
            });
            // Pago hecho al recibir mercancía: se acepta si la OC ya aparece recibida
            g.recepcion.filter((m) => !ctx.usados.has(m)).forEach((m) => {
                const recibida = /recib/i.test(String(oc.estado || '')) || oc.fechaRecepcion || (Array.isArray(oc.recepciones) && oc.recepciones.length);
                out.push(fila('oc', {
                    estado: recibida ? 'ok' : 'sin-registro', fecha: aFecha(m.fecha), ref: oc.folio || String(oc.id), monto: num(m.monto),
                    desc: `Pago al recibir OC${prov ? ' — ' + prov : ''}`,
                    detalle: recibida ? 'Pago hecho en la recepción de la OC' : 'Salió dinero por recepción pero la OC no aparece recibida'
                }));
                ctx.usados.add(m);
            });
        });
        huerfanosSinOC.forEach((m) => {
            out.push(fila('oc', {
                estado: 'sin-registro', fecha: aFecha(m.fecha), ref: String(m.referencia || m.idOperacion || ''), monto: num(m.monto),
                desc: 'Salida de caja de OC', detalle: 'La orden de compra ya no existe'
            }));
        });
        return out;
    }

    // ── 4) GASTOS ────────────────────────────────────────────────────
    function revisarGastos(ctx) {
        const out = [];
        const gastos = leer('gastosOperativos');
        const ids = new Set();
        gastos.forEach((g) => {
            const ref = `GASTO-${g.id}`;
            ids.add(ref);
            let movs = ctx.porRef.get(ref) || [];
            if (!movs.length && g.movimientoCajaId !== undefined) {
                movs = ctx.movs.filter((m) => String(m.id) === String(g.movimientoCajaId));
            }
            movs.forEach((m) => ctx.usados.add(m));
            const eg = movs.filter(esEgreso);
            const ing = movs.filter(esIngreso);
            const neto = suma(eg) - suma(ing);
            const base = {
                fecha: aFecha(g.fecha), ref: String(g.id), monto: num(g.monto),
                desc: `Gasto: ${g.categoria || ''}${g.descripcion ? ' — ' + g.descripcion : ''}`
            };
            if (!eg.length) {
                out.push(fila('gasto', Object.assign(base, { estado: 'sin-caja', detalle: 'El gasto está registrado pero no salió dinero de ninguna caja/banco' })));
            } else if (Math.abs(neto - num(g.monto)) > 0.01) {
                out.push(fila('gasto', Object.assign(base, { estado: 'monto', detalle: `Gasto ${dinero$(g.monto)} vs salida neta en caja ${dinero$(neto)}` })));
            } else {
                out.push(fila('gasto', Object.assign(base, { estado: 'ok', detalle: `Salió de: ${eg[0].etiquetaCuenta || eg[0].cuenta || ''}` })));
            }
        });
        // Salidas GASTO-<id> sin gasto (si hay reversa que las cancela, no cuentan)
        ctx.porRef.forEach((movs, ref) => {
            if (!ref.startsWith('GASTO-') || ids.has(ref)) return;
            const neto = suma(movs.filter(esEgreso)) - suma(movs.filter(esIngreso));
            if (neto <= 0.01) return;
            const m = movs.filter(esEgreso)[0];
            out.push(fila('gasto', {
                estado: 'sin-registro', fecha: aFecha(m.fecha), ref: ref.slice(6), monto: neto,
                desc: m.concepto || 'Salida de caja de gasto',
                detalle: 'Salió dinero pero el gasto ya no existe en Gastos'
            }));
        });
        return out;
    }

    // ── 5) PAGOS DE CORTE DE TARJETA DE CRÉDITO ──────────────────────
    function revisarPagosTarjeta(ctx) {
        const out = [];
        const logs = leer('pagosCorteTarjeta');
        const refs = new Set();
        logs.forEach((l) => {
            const ref = String(l.ref || '');
            if (!ref) return;
            refs.add(ref);
            const movs = ctx.porRef.get(ref) || [];
            movs.forEach((m) => ctx.usados.add(m));
            const eg = movs.filter(esEgreso);
            const ing = movs.filter(esIngreso);
            const base = {
                fecha: aFecha(l.fecha), ref, monto: num(l.monto),
                desc: `Pago de corte tarjeta — ${l.banco || ''}`
            };
            if (!eg.length) {
                out.push(fila('tarjeta', Object.assign(base, { estado: 'sin-caja', detalle: 'El pago está en la bitácora de la tarjeta pero no salió dinero de ninguna cuenta' })));
            } else if (Math.abs(num(eg[0].monto) - num(l.monto)) > 0.01) {
                out.push(fila('tarjeta', Object.assign(base, { estado: 'monto', detalle: `Pago ${dinero$(l.monto)} vs salida ${dinero$(eg[0].monto)}` })));
            } else if (l.deshecho && !ing.length) {
                out.push(fila('tarjeta', Object.assign(base, { estado: 'falta-entrada', detalle: 'El pago se marcó como deshecho pero el dinero no regresó a la cuenta' })));
            } else {
                out.push(fila('tarjeta', Object.assign(base, { estado: 'ok', detalle: l.deshecho ? 'Pago deshecho: salida y reversa en caja' : `Salió de: ${l.cuentaOrigenEtiqueta || eg[0].etiquetaCuenta || ''}` })));
            }
        });
        ctx.porRef.forEach((movs, ref) => {
            if (!ref.startsWith('PAGO-TC-') || refs.has(ref)) return;
            movs.filter(esEgreso).forEach((m) => {
                out.push(fila('tarjeta', {
                    estado: 'sin-registro', fecha: aFecha(m.fecha), ref, monto: num(m.monto),
                    desc: m.concepto || 'Pago de tarjeta',
                    detalle: 'Salió dinero pero no hay pago en la bitácora de cortes de tarjeta (¿se borró el registro?)'
                }));
            });
        });
        return out;
    }

    // ── 6) PRÉSTAMOS OTORGADOS (y sus abonos) ────────────────────────
    function revisarPrestamos(ctx) {
        const out = [];
        const prestamos = leer('prestamosOtorgados');
        const idsRef = new Set();
        prestamos.forEach((p) => {
            const ref = `PRESTAMO-${p.id}`;
            idsRef.add(ref);
            const historico = p.origen === 'historico' || /hist[oó]rico/i.test(String(p.cuentaEtiqueta || ''));
            const base = { fecha: aFecha(p.fecha), ref: String(p.id), monto: num(p.monto), desc: `Préstamo otorgado — ${p.deudor || ''}` };
            const movs = (ctx.porRef.get(ref) || []).filter(esEgreso);
            movs.forEach((m) => ctx.usados.add(m));
            if (historico) {
                out.push(fila('prestamo', Object.assign(base, { estado: 'unico', detalle: 'Préstamo histórico: el dinero ya había salido antes, por diseño no genera salida de caja' })));
            } else if (!movs.length) {
                out.push(fila('prestamo', Object.assign(base, { estado: 'sin-caja', detalle: 'El préstamo está registrado pero no salió dinero de ninguna caja/banco' })));
            } else if (Math.abs(suma(movs) - num(p.monto)) > 0.01) {
                out.push(fila('prestamo', Object.assign(base, { estado: 'monto', detalle: `Préstamo ${dinero$(p.monto)} vs salida ${dinero$(suma(movs))}` })));
            } else {
                out.push(fila('prestamo', Object.assign(base, { estado: 'ok', detalle: `Salió de: ${movs[0].etiquetaCuenta || movs[0].cuenta || ''}` })));
            }
            (Array.isArray(p.abonos) ? p.abonos : []).forEach((a) => {
                const refA = `ABONO-PRESTAMO-${p.id}-${a.id}`;
                idsRef.add(refA);
                const ms = (ctx.porRef.get(refA) || []).filter(esIngreso);
                ms.forEach((m) => ctx.usados.add(m));
                const b2 = { fecha: aFecha(a.fecha), ref: String(p.id), monto: num(a.monto), desc: `Abono de préstamo — ${p.deudor || ''}` };
                if (!ms.length) out.push(fila('prestamo', Object.assign(b2, { estado: 'sin-caja', detalle: 'El abono está en el préstamo pero no entró dinero a caja/banco' })));
                else if (Math.abs(suma(ms) - num(a.monto)) > 0.01) out.push(fila('prestamo', Object.assign(b2, { estado: 'monto', detalle: `Abono ${dinero$(a.monto)} vs caja ${dinero$(suma(ms))}` })));
                else out.push(fila('prestamo', Object.assign(b2, { estado: 'ok', detalle: `Entró a: ${ms[0].etiquetaCuenta || ms[0].cuenta || ''}` })));
            });
        });
        ctx.porRef.forEach((movs, ref) => {
            if (!(ref.startsWith('PRESTAMO-') || ref.startsWith('ABONO-PRESTAMO-')) || idsRef.has(ref)) return;
            movs.filter((m) => !ctx.usados.has(m)).forEach((m) => {
                out.push(fila('prestamo', {
                    estado: 'sin-registro', fecha: aFecha(m.fecha), ref, monto: num(m.monto),
                    desc: m.concepto || 'Movimiento de préstamo', detalle: 'Hay movimiento de caja pero el préstamo/abono ya no existe'
                }));
            });
        });
        return out;
    }

    // ── 7) TRANSFERENCIAS ENTRE CUENTAS (entrada ↔ salida) ───────────
    function revisarTransferencias(ctx) {
        const out = [];
        ctx.porRef.forEach((movs, ref) => {
            if (!/^TR-/i.test(ref)) return;
            const eg = movs.filter(esEgreso);
            const ing = movs.filter(esIngreso);
            const E = suma(eg);
            const I = suma(ing);
            const ref0 = (eg[0] || ing[0]);
            const base = {
                fecha: aFecha(ref0.fecha), ref, monto: Math.max(E, I),
                desc: String((eg[0] || ing[0]).concepto || 'Transferencia interna')
            };
            if (Math.abs(E - I) <= 0.01 && eg.length && ing.length) {
                out.push(fila('transferencia', Object.assign(base, { estado: 'ok', detalle: 'Salida y entrada por el mismo importe' })));
            } else if (E - I > 0.01) {
                out.push(fila('transferencia', Object.assign(base, { monto: E - I, estado: 'falta-entrada', detalle: `Salieron ${dinero$(E)} y solo entraron ${dinero$(I)}: el dinero no llegó a la cuenta destino` })));
            } else if (I - E > 0.01) {
                out.push(fila('transferencia', Object.assign(base, { monto: I - E, estado: 'falta-salida', detalle: `Entraron ${dinero$(I)} y solo salieron ${dinero$(E)}: el dinero no salió de la cuenta origen` })));
            }
        });
        return out;
    }

    const TIPOS = [
        { id: 'abono_credito', ic: '💰', label: 'Abonos a crédito (CxC)',          fn: revisarAbonosCredito },
        { id: 'abono_apartado', ic: '📦', label: 'Abonos a apartados',             fn: revisarAbonosApartado },
        { id: 'oc',            ic: '🧾', label: 'Órdenes de compra (anticipos/pagos)', fn: revisarOrdenesCompra },
        { id: 'gasto',         ic: '💸', label: 'Gastos',                           fn: revisarGastos },
        { id: 'tarjeta',       ic: '💳', label: 'Pagos de tarjeta de crédito',      fn: revisarPagosTarjeta },
        { id: 'prestamo',      ic: '🤝', label: 'Préstamos otorgados',              fn: revisarPrestamos },
        { id: 'transferencia', ic: '🔁', label: 'Transferencias entre cuentas',     fn: revisarTransferencias }
    ];

    // ── Motor: corre los tipos elegidos y filtra por fecha ───────────
    function ejecutarRevision(filtros) {
        const ctx = crearCtx();
        ctx.opciones = { exentarMig: filtros.exentarMig };
        const desde = filtros.desde ? new Date(filtros.desde + 'T00:00:00') : null;
        const hasta = filtros.hasta ? new Date(filtros.hasta + 'T23:59:59') : null;
        const resultado = [];
        TIPOS.forEach((t) => {
            if (!filtros.tipos.includes(t.id)) return;
            let filas = [];
            try { filas = t.fn(ctx); } catch (e) {
                console.error('Auditoría de huérfanos — error en', t.id, e);
                filas = [fila(t.id, { estado: 'monto', desc: 'No se pudo revisar este tipo', detalle: String(e && e.message || e) })];
            }
            filas.forEach((f) => {
                // El emparejamiento se hizo con TODO el historial; el rango solo recorta lo que se muestra.
                if (f.fecha && ((desde && f.fecha < desde) || (hasta && f.fecha > hasta))) return;
                resultado.push(f);
            });
        });
        resultado.sort((a, b) => (b.fecha ? b.fecha.getTime() : 0) - (a.fecha ? a.fecha.getTime() : 0));
        return resultado;
    }

    // ── Interfaz ─────────────────────────────────────────────────────
    let _ultimo = [];

    function hoyISO() {
        return (typeof window.obtenerHoyInputMX === 'function') ? window.obtenerHoyInputMX() : new Date().toISOString().slice(0, 10);
    }
    function haceDiasISO(n) {
        const d = new Date(hoyISO() + 'T12:00:00');
        d.setDate(d.getDate() - n);
        const p = (x) => String(x).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    }

    function abrir() {
        document.querySelector('[data-modal="auditoria-huerfanos"]')?.remove();
        const checks = TIPOS.map((t) => `
            <label style="display:flex;align-items:center;gap:6px;font-size:13px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:6px 10px;cursor:pointer;">
                <input type="checkbox" class="ah-tipo" value="${t.id}" checked> ${t.ic} ${esc(t.label)}
            </label>`).join('');
        document.body.insertAdjacentHTML('beforeend', `
        <div data-modal="auditoria-huerfanos" style="position:fixed;inset:0;background:rgba(15,23,42,0.75);z-index:9999;display:flex;justify-content:center;align-items:flex-start;overflow:auto;padding:20px;">
            <div style="background:white;border-radius:12px;width:100%;max-width:1100px;padding:22px;box-shadow:0 20px 25px rgba(0,0,0,0.25);">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
                    <h2 style="margin:0;color:#0f766e;">🔎 Movimientos huérfanos</h2>
                    <button onclick="document.querySelector('[data-modal=&quot;auditoria-huerfanos&quot;]').remove()" style="border:none;background:#f1f5f9;border-radius:8px;padding:8px 14px;cursor:pointer;font-weight:bold;">✕ Cerrar</button>
                </div>
                <p style="color:#64748b;font-size:13px;margin:6px 0 14px;">Revisa que cada registro (abono, gasto, anticipo, pago de tarjeta…) tenga su movimiento de caja, y que cada movimiento de caja tenga su registro. Solo consulta: no modifica nada.</p>

                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;align-items:end;">
                    <div><label style="font-size:12px;font-weight:bold;color:#475569;">DESDE</label>
                        <input type="date" id="ahDesde" value="${haceDiasISO(30)}" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:6px;box-sizing:border-box;"></div>
                    <div><label style="font-size:12px;font-weight:bold;color:#475569;">HASTA</label>
                        <input type="date" id="ahHasta" value="${hoyISO()}" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:6px;box-sizing:border-box;"></div>
                    <div><label style="font-size:12px;font-weight:bold;color:#475569;">MOSTRAR</label>
                        <select id="ahMostrar" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:6px;box-sizing:border-box;">
                            <option value="problemas">Solo problemas (huérfanos + monto distinto)</option>
                            <option value="huerfanos">Solo huérfanos</option>
                            <option value="todos">Todo (incluye completos)</option>
                        </select></div>
                    <button onclick="ejecutarAuditoriaHuerfanos()" style="padding:10px;background:#0f766e;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">🔎 Revisar</button>
                </div>

                <div style="margin-top:12px;">
                    <div style="font-size:12px;font-weight:bold;color:#475569;margin-bottom:6px;">TIPOS DE MOVIMIENTO A REVISAR</div>
                    <div style="display:flex;flex-wrap:wrap;gap:8px;">${checks}</div>
                    <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#475569;margin-top:10px;cursor:pointer;">
                        <input type="checkbox" id="ahExentarMig" checked>
                        Tratar abonos de cuentas migradas (folio MIG-) sin movimiento de caja como "único por diseño"
                    </label>
                </div>

                <div id="ahResultado" style="margin-top:16px;color:#64748b;font-size:13px;">Elige el rango y toca <strong>Revisar</strong>.</div>
            </div>
        </div>`);
    }

    function ejecutar() {
        const tipos = Array.from(document.querySelectorAll('.ah-tipo')).filter((c) => c.checked).map((c) => c.value);
        const cont = document.getElementById('ahResultado');
        if (!cont) return;
        if (!tipos.length) { cont.innerHTML = '⚠️ Marca al menos un tipo de movimiento.'; return; }
        const filtros = {
            desde: document.getElementById('ahDesde')?.value || '',
            hasta: document.getElementById('ahHasta')?.value || '',
            tipos,
            exentarMig: !!document.getElementById('ahExentarMig')?.checked
        };
        if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) { cont.innerHTML = '⚠️ La fecha "desde" es posterior a "hasta".'; return; }
        cont.innerHTML = 'Revisando…';
        setTimeout(() => {
            _ultimo = ejecutarRevision(filtros);
            pintar();
        }, 20);
    }

    function pintar() {
        const cont = document.getElementById('ahResultado');
        if (!cont) return;
        const mostrar = document.getElementById('ahMostrar')?.value || 'problemas';
        const tiposSel = Array.from(document.querySelectorAll('.ah-tipo')).filter((c) => c.checked).map((c) => c.value);

        const resumen = TIPOS.filter((t) => tiposSel.includes(t.id)).map((t) => {
            const fs = _ultimo.filter((f) => f.tipo === t.id);
            const huer = fs.filter((f) => HUERFANOS.has(f.estado)).length;
            const mon = fs.filter((f) => f.estado === 'monto').length;
            const uni = fs.filter((f) => f.estado === 'unico').length;
            const ok = fs.filter((f) => f.estado === 'ok').length;
            const color = huer ? '#b91c1c' : (mon ? '#c2410c' : '#15803d');
            return `<div style="border:1px solid #e2e8f0;border-left:5px solid ${color};border-radius:8px;padding:10px 12px;background:#fff;">
                <div style="font-weight:bold;font-size:13px;">${t.ic} ${esc(t.label)}</div>
                <div style="font-size:12px;color:#475569;margin-top:4px;">
                    ✅ ${ok} completos · <strong style="color:${huer ? '#b91c1c' : '#475569'};">🔴 ${huer} huérfanos</strong>${mon ? ` · 🟠 ${mon} monto distinto` : ''}${uni ? ` · ⚪ ${uni} únicos` : ''}
                </div></div>`;
        }).join('');

        let filas = _ultimo.filter((f) => tiposSel.includes(f.tipo));
        if (mostrar === 'huerfanos') filas = filas.filter((f) => HUERFANOS.has(f.estado));
        else if (mostrar === 'problemas') filas = filas.filter((f) => HUERFANOS.has(f.estado) || f.estado === 'monto');

        const nombreTipo = (id) => (TIPOS.find((t) => t.id === id) || {}).label || id;
        const icTipo = (id) => (TIPOS.find((t) => t.id === id) || {}).ic || '';
        const cuerpo = filas.length ? filas.map((f) => {
            const e = ESTADOS[f.estado] || ESTADOS.monto;
            return `<tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:8px;white-space:nowrap;font-size:12px;">${txtFecha(f.fecha)}</td>
                <td style="padding:8px;font-size:12px;">${icTipo(f.tipo)} ${esc(nombreTipo(f.tipo))}</td>
                <td style="padding:8px;font-size:12px;"><div style="font-weight:600;">${esc(f.desc)}</div><div style="color:#94a3b8;font-size:11px;">${esc(f.ref)}</div></td>
                <td style="padding:8px;text-align:right;white-space:nowrap;font-weight:600;">${dinero$(f.monto)}</td>
                <td style="padding:8px;"><span style="display:inline-block;background:${e.bg};color:${e.fg};border-radius:9999px;padding:2px 9px;font-size:11px;font-weight:bold;white-space:nowrap;">${e.ic} ${e.txt}</span></td>
                <td style="padding:8px;font-size:12px;color:#475569;">${esc(f.detalle)}</td>
            </tr>`;
        }).join('') : `<tr><td colspan="6" style="padding:24px;text-align:center;color:#15803d;font-weight:bold;">✅ Nada que mostrar con este filtro.</td></tr>`;

        cont.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;">${resumen}</div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin:14px 0 6px;gap:10px;flex-wrap:wrap;">
                <div style="font-size:13px;color:#475569;">${filas.length} renglón(es) mostrado(s)</div>
                <button onclick="exportarAuditoriaHuerfanosCSV()" style="padding:8px 14px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:8px;cursor:pointer;font-weight:bold;">⬇️ Exportar CSV</button>
            </div>
            <div style="overflow-x:auto;border:1px solid #e2e8f0;border-radius:8px;">
                <table style="width:100%;border-collapse:collapse;min-width:820px;">
                    <thead><tr style="background:#f8fafc;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;">
                        <th style="padding:8px;">Fecha</th><th style="padding:8px;">Tipo</th><th style="padding:8px;">Movimiento / Folio</th>
                        <th style="padding:8px;text-align:right;">Monto</th><th style="padding:8px;">Estado</th><th style="padding:8px;">Qué pasó</th>
                    </tr></thead>
                    <tbody>${cuerpo}</tbody>
                </table>
            </div>`;
        const sel = document.getElementById('ahMostrar');
        if (sel && !sel._ahBound) { sel._ahBound = true; sel.addEventListener('change', pintar); }
    }

    function exportarCSV() {
        const mostrar = document.getElementById('ahMostrar')?.value || 'problemas';
        let filas = _ultimo.slice();
        if (mostrar === 'huerfanos') filas = filas.filter((f) => HUERFANOS.has(f.estado));
        else if (mostrar === 'problemas') filas = filas.filter((f) => HUERFANOS.has(f.estado) || f.estado === 'monto');
        const q = (v) => `"${String(v === undefined || v === null ? '' : v).replace(/"/g, '""')}"`;
        const nombreTipo = (id) => (TIPOS.find((t) => t.id === id) || {}).label || id;
        const lineas = [['Fecha', 'Tipo', 'Folio/Ref', 'Descripción', 'Monto', 'Estado', 'Detalle'].map(q).join(',')];
        filas.forEach((f) => lineas.push([
            txtFecha(f.fecha), nombreTipo(f.tipo), f.ref, f.desc, num(f.monto).toFixed(2), (ESTADOS[f.estado] || {}).txt || f.estado, f.detalle
        ].map(q).join(',')));
        const blob = new Blob(['\ufeff' + lineas.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `auditoria-huerfanos-${hoyISO()}.csv`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }

    window.abrirAuditoriaHuerfanos = function () {
        if (typeof window.requireAdmin === 'function') window.requireAdmin(abrir);
        else abrir();
    };
    window.ejecutarAuditoriaHuerfanos = ejecutar;
    window.exportarAuditoriaHuerfanosCSV = exportarCSV;
    // Para pruebas / consola: window._auditoriaHuerfanos({desde:'2026-10-01', hasta:'2026-10-13', tipos:['gasto'], exentarMig:true})
    window._auditoriaHuerfanos = function (f) {
        const filtros = Object.assign({ desde: '', hasta: '', tipos: TIPOS.map((t) => t.id), exentarMig: true }, f || {});
        return ejecutarRevision(filtros);
    };
})();
