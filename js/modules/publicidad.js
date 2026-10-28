// ============================================================================
// 📣 PUBLICIDAD — prepara información de producto y genera anuncios (imagen)
//
//  1) INFORMACIÓN: eliges productos (por categoría) y el módulo te da la ficha, un brief listo
//     para pegar en tu IA de diseño y textos para WhatsApp / Facebook / Instagram.
//  2) DISEÑO: el propio sistema genera el anuncio en PNG (cuadrado, vertical o historia) con
//     la foto del producto, precio de contado, abono semanal y tu WhatsApp.
//
// Los números (enganche, abono semanal) se calculan con LA MISMA regla que catalogo.html, para
// que el anuncio diga lo mismo que ve el cliente. NUNCA se usan ni se muestran costo ni margen.
// Solo lee: no modifica productos ni ninguna otra tabla.
// ============================================================================
(function () {
    'use strict';

    const FORMATOS = {
        cuadrado: { w: 1080, h: 1080, et: 'Cuadrado 1080×1080 (publicación)' },
        vertical: { w: 1080, h: 1350, et: 'Vertical 1080×1350 (Facebook / Instagram)' },
        historia: { w: 1080, h: 1920, et: 'Historia 1080×1920 (estados / reels)' }
    };
    const PLANTILLAS = {
        clasico: { et: 'Clásico (verde)', acento: '#0e8f6f', fondo: 'linear-gradient(160deg,#eef8f5 0%,#ffffff 60%)', tinta: '#10221f', tenue: '#5c746c', tarjeta: '#ffffff', precio: '#0b6e56', cta: '#0e8f6f', ctaTxt: '#ffffff' },
        oferta: { et: 'Oferta (rojo)', acento: '#dc2626', fondo: 'linear-gradient(160deg,#fff1f0 0%,#ffffff 60%)', tinta: '#1f1111', tenue: '#7a5252', tarjeta: '#ffffff', precio: '#b91c1c', cta: '#dc2626', ctaTxt: '#ffffff' },
        oscuro: { et: 'Elegante (oscuro)', acento: '#f5c451', fondo: 'linear-gradient(160deg,#0b1220 0%,#17233b 100%)', tinta: '#ffffff', tenue: '#a9b4c8', tarjeta: '#ffffff', precio: '#f5c451', cta: '#f5c451', ctaTxt: '#0b1220' }
    };
    const CFG_KEY = 'publicidad_cfg_v1';
    const CFG_DEF = {
        negocio: 'Mueblería Mi Pueblito', whatsapp: '522411081657',
        catalogo: 'https://rev-tau.vercel.app/catalogo.html', ubicacion: 'Santiago Cuaula, Tlaxcala', slogan: ''
    };

    const PUB = {
        sel: new Set(), categoria: '', busqueda: '', soloStock: true, soloFoto: true,
        tab: 'info', activo: null, formato: 'cuadrado', plantilla: 'clasico', acento: '',
        op: { precio: true, abono: true, enganche: true, existencia: true, categoria: true },
        promo: '', promocionId: '', estilo: '', fotoLocal: {}, textos: {}, generando: false,
        cfg: Object.assign({}, CFG_DEF)
    };
    try { Object.assign(PUB.cfg, JSON.parse(localStorage.getItem(CFG_KEY) || '{}')); } catch (e) { /* configuración por defecto */ }

    // ------------------------------------------------------------------ utilidades
    const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const dinero = n => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(n) || 0);
    const sinAcentos = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const $ = id => document.getElementById(id);
    const norm = v => String(v == null ? '' : v);

    function toast(t) {
        let el = $('pubToast');
        if (!el) { el = document.createElement('div'); el.id = 'pubToast'; el.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#0f172a;color:#fff;padding:11px 20px;border-radius:999px;font-size:14px;font-weight:700;z-index:99999;opacity:0;transition:.2s;pointer-events:none;max-width:90vw;text-align:center'; document.body.appendChild(el); }
        el.textContent = t; el.style.opacity = '1'; clearTimeout(el._t); el._t = setTimeout(() => { el.style.opacity = '0'; }, 2400);
    }
    async function copiar(texto, aviso) {
        try { await navigator.clipboard.writeText(texto); }
        catch (e) { const ta = document.createElement('textarea'); ta.value = texto; ta.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e2) { /* sin portapapeles */ } ta.remove(); }
        toast(aviso || 'Copiado ✔');
    }
    function guardarCfg() { try { localStorage.setItem(CFG_KEY, JSON.stringify(PUB.cfg)); } catch (e) { /* sin localStorage */ } }
    function telVisible() {
        const d = String(PUB.cfg.whatsapp || '').replace(/\D/g, '').replace(/^52/, '');
        return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : String(PUB.cfg.whatsapp || '');
    }
    function linkWA(p) {
        const msg = encodeURIComponent(`Hola, me interesa ${p.nombre || 'este producto'} (${dinero(p.precio)}).`);
        return `https://wa.me/${String(PUB.cfg.whatsapp || '').replace(/\D/g, '')}?text=${msg}`;
    }

    // ------------------------------------------------------------------ productos
    function todosLosProductos() {
        const l = (typeof StorageService !== 'undefined') ? StorageService.get('productos', []) : [];
        return Array.isArray(l) ? l : [];
    }
    function categorias() {
        return [...new Set(todosLosProductos().map(p => p.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es-MX'));
    }
    function productosFiltrados() {
        const q = sinAcentos(PUB.busqueda).trim();
        return todosLosProductos().filter(p => {
            if (PUB.soloStock && !(Number(p.stock) > 0)) return false;
            if (PUB.soloFoto && !p.imagen) return false;
            if (PUB.categoria && p.categoria !== PUB.categoria) return false;
            if (q && !sinAcentos([p.nombre, p.marca, p.modelo, p.color, p.categoria, p.subcategoria].join(' ')).includes(q)) return false;
            return true;
        }).sort((a, b) => String(a.categoria).localeCompare(String(b.categoria), 'es-MX') || String(a.subcategoria).localeCompare(String(b.subcategoria), 'es-MX') || String(a.nombre).localeCompare(String(b.nombre), 'es-MX'));
    }
    function productoPorId(id) { return todosLosProductos().find(p => String(p.id) === String(id)); }
    function seleccionados() { return todosLosProductos().filter(p => PUB.sel.has(String(p.id))); }

    // Misma regla que catalogo.html (LogicaCredito): enganche 10% redondeado a 10, abono semanal por plazo
    function planesCatalogo(p, o) {
        o = o || {};
        const precio = Number(p.precio) || 0;
        const enganche = (o.enganchePct == null)
            ? Math.ceil((precio * 0.10) / 10) * 10                               // regla del catálogo: 10%
            : (Number(o.enganchePct) <= 0 ? 0 : Math.ceil((precio * (Number(o.enganchePct) / 100)) / 10) * 10);   // promoción de crédito
        const saldo = Math.max(0, precio - enganche);
        let cfg = null;
        try { cfg = (typeof StorageService !== 'undefined') ? StorageService.get('configCreditoGlobal', null) : null; } catch (e) { cfg = null; }
        let plazos = [];
        if (!cfg || !Array.isArray(cfg.plazos) || cfg.plazos.length === 0) { for (let i = 1; i <= 6; i++) plazos.push({ meses: i, tasa: i <= 3 ? 2 : 2.5 }); }
        else plazos = cfg.plazos.map(x => ({ meses: x.meses, tasa: x.tasa }));
        if (p.configCredito && p.configCredito.usaReglaGlobal === false) {
            if (p.configCredito.permitirCredito === false) return [];
            plazos = Array.isArray(p.configCredito.plazos) ? p.configCredito.plazos.map(x => ({ meses: x.meses, tasa: x.tasa })) : [];
        }
        if (o.tasaMensual != null) plazos = plazos.map(x => ({ meses: x.meses, tasa: Number(o.tasaMensual) }));
        plazos.sort((a, b) => (Number(a.meses) || 0) - (Number(b.meses) || 0));
        const res = []; let totalAnterior = 0;
        plazos.forEach(pl => {
            const meses = Number(pl.meses) || 1, tasa = (Number(pl.tasa) || 0) / 100, semanas = meses * 4;
            let abono = Math.ceil((saldo * (1 + tasa * meses) / semanas) / 10) * 10;
            let total = abono * semanas + enganche, intentos = 0;
            while (total <= totalAnterior && intentos++ < 100) { abono += 5; total = abono * semanas + enganche; }
            if (intentos < 100) { totalAnterior = total; res.push({ meses, pagos: semanas, abono, total, enganche }); }
        });
        return res;
    }
    // El plan que muestra el catálogo en cada tarjeta: el de 6 meses (o el más largo disponible)
    function planPrincipal(p) { const pl = planesCatalogo(p); return pl[5] || pl[pl.length - 1] || null; }

    function colores(p) {
        const v = Array.isArray(p.variantes) ? p.variantes : [];
        const c = [...new Set(v.filter(x => Number(x.stock) > 0).map(x => String(x.color || '').trim()).filter(x => x && !/^(general|sin color)$/i.test(x)))];
        return c;
    }
    function existencia(p) {
        const s = Number(p.stock) || 0;
        const ultima = p.esUnicaCompra && s > 0 && s <= 3;
        return { stock: s, ultima, texto: ultima ? `Última${s > 1 ? 's ' + s : ''} pieza${s > 1 ? 's' : ''}` : (s > 0 ? 'Disponible' : 'Sobre pedido') };
    }
    // Promoción seleccionada en pantalla y su resultado para un producto (null si el producto no entra)
    function promocionActiva() { return (PUB.promocionId && window.PromocionesService) ? PromocionesService.obtener(PUB.promocionId) : null; }
    function promoDe(p) { const pr = promocionActiva(); return (pr && PromocionesService.aplicaA(pr, p)) ? PromocionesService.calcular(p, pr) : null; }
    function lineasPromo(pm) {
        if (!pm) return [];
        const l = [`🔥 PROMOCIÓN "${pm.nombre}": ${pm.tipo === 'contado' ? pm.etiqueta : pm.etiquetas.join(' + ')}`];
        if (pm.tipo === 'contado') l.push(`Precio promocional de contado: ${dinero(pm.precioPromo)} (antes ${dinero(pm.precioNormal)}; ahorras ${dinero(pm.ahorro)}, ${pm.pct}%). Válida solo de contado.`);
        else l.push(`Con la promoción: ${dinero(pm.principal.abono)} semanales (${pm.principal.pagos} pagos, ${pm.principal.meses} ${pm.principal.meses === 1 ? 'mes' : 'meses'}), enganche desde ${dinero(pm.enganche)}${pm.msi ? `; total a pagar ${dinero(pm.msi.total)}` : ''}.`);
        if (pm.vigencia) l.push(`Vigencia: ${pm.vigencia}`);
        if (pm.condiciones) l.push(`Condiciones: ${pm.condiciones}`);
        return l;
    }
    function lineasCaracteristicas(p) {
        return norm(p.caracteristicas).split(/\r?\n/).map(l => l.replace(/\uFFFD/g, 'Ó').replace(/^[\s"“”']+|[\s"“”']+$/g, '').trim()).filter(Boolean);
    }

    // ------------------------------------------------------------------ textos: ficha, brief para IA y publicaciones
    function fichaTexto(p) {
        const pl = planesCatalogo(p), pr = planPrincipal(p), ex = existencia(p), col = colores(p);
        const l = [];
        l.push(`PRODUCTO: ${p.nombre}`);
        l.push(`Categoría: ${[p.categoria, p.subcategoria].filter(Boolean).join(' / ')}`);
        const datos = [p.marca && `Marca: ${p.marca}`, p.modelo && `Modelo: ${p.modelo}`, p.color && `Color: ${p.color}`].filter(Boolean);
        if (datos.length) l.push(datos.join(' · '));
        if (col.length) l.push(`Colores disponibles: ${col.join(', ')}`);
        l.push(`Precio de contado: ${dinero(p.precio)}`);
        if (pr) {
            l.push(`Crédito: enganche desde ${dinero(pr.enganche)} y ${dinero(pr.abono)} semanales (${pr.pagos} pagos, ${pr.meses} ${pr.meses === 1 ? 'mes' : 'meses'}).`);
            if (pl.length > 1) l.push('Planes semanales: ' + pl.map(x => `${x.meses} ${x.meses === 1 ? 'mes' : 'meses'}: ${dinero(x.abono)}`).join(' | '));
        } else l.push('Crédito: consultar plan.');
        lineasPromo(promoDe(p)).forEach(x => l.push(x));
        l.push(`Existencia: ${ex.texto}${ex.stock > 0 ? ` (${ex.stock} en inventario)` : ''}`);
        const car = lineasCaracteristicas(p);
        if (car.length) { l.push('Características:'); car.forEach(c => l.push('  - ' + c)); }
        l.push(`Foto: ${p.imagen || '(sin foto)'}`);
        l.push(`Catálogo: ${PUB.cfg.catalogo}`);
        l.push(`WhatsApp: ${telVisible()}  →  ${linkWA(p)}`);
        return l.join('\n');
    }
    function datosExactos(p) {
        const pr = planPrincipal(p), ex = existencia(p), pm = promoDe(p), l = [];
        if (pm && pm.tipo === 'contado') {
            l.push(`- PROMOCIÓN "${pm.nombre}": ${pm.etiqueta}`);
            l.push(`- Precio normal (mostrar tachado): ${dinero(pm.precioNormal)}`);
            l.push(`- Precio promocional de contado: ${dinero(pm.precioPromo)}`);
            l.push(`- Ahorro: ${dinero(pm.ahorro)} (${pm.pct}%)`);
            l.push('- Aclaración obligatoria: precio válido solo de contado');
        } else if (pm) {
            l.push(`- PROMOCIÓN "${pm.nombre}": ${pm.etiquetas.join(' + ')}`);
            l.push(`- Precio de contado: ${dinero(p.precio)}`);
            l.push(`- Abono semanal con la promoción: ${dinero(pm.principal.abono)} (${pm.principal.meses} ${pm.principal.meses === 1 ? 'mes' : 'meses'})`);
            l.push(`- Enganche desde: ${dinero(pm.enganche)}`);
            if (pm.msi) l.push(`- Total a pagar a ${pm.msi.meses} meses: ${dinero(pm.msi.total)} (sin intereses)`);
        } else {
            l.push(`- Precio de contado: ${dinero(p.precio)}`);
            if (pr) { l.push(`- Abono semanal: ${dinero(pr.abono)} (${pr.meses} ${pr.meses === 1 ? 'mes' : 'meses'})`); l.push(`- Enganche desde: ${dinero(pr.enganche)}`); }
        }
        if (pm && pm.vigencia) l.push(`- Vigencia (mostrar): ${pm.vigencia}`);
        if (pm && pm.condiciones) l.push(`- Letra chica: ${pm.condiciones}`);
        if (ex.ultima) l.push(`- Aviso de existencia: ${ex.texto}`);
        return l.join('\n');
    }
    function briefIA(prods) {
        const lista = Array.isArray(prods) ? prods : [prods];
        const multi = lista.length > 1;
        const estilo = PUB.estilo.trim() || 'Moderno, limpio y fácil de leer en el celular; fondo claro, colores verdes de marca, tipografía grande y legible.';
        const l = [];
        l.push(`Actúa como diseñador publicitario. Crea ${multi ? `un anuncio para cada uno de los ${lista.length} productos` : 'un anuncio'} para redes sociales (Facebook, Instagram y estados de WhatsApp) de una mueblería.`);
        l.push('');
        l.push(`NEGOCIO: ${PUB.cfg.negocio}${PUB.cfg.ubicacion ? ' · ' + PUB.cfg.ubicacion : ''}${PUB.cfg.slogan ? ' · ' + PUB.cfg.slogan : ''}`);
        l.push(`LLAMADO A LA ACCIÓN: "Pide informes por WhatsApp ${telVisible()}"`);
        l.push('');
        lista.forEach((p, i) => {
            if (multi) l.push(`=== PRODUCTO ${i + 1} DE ${lista.length} ===`);
            l.push(`PRODUCTO: ${p.nombre}${p.marca ? ' · ' + p.marca : ''}${p.modelo ? ' · ' + p.modelo : ''}`);
            l.push(`CATEGORÍA: ${[p.categoria, p.subcategoria].filter(Boolean).join(' / ')}`);
            l.push('DATOS EXACTOS QUE DEBEN APARECER (no los cambies):');
            l.push(datosExactos(p));
            const car = lineasCaracteristicas(p);
            if (car.length) { l.push('CARACTERÍSTICAS:'); car.forEach(c => l.push('  - ' + c)); }
            const col = colores(p); if (col.length) l.push(`COLORES DISPONIBLES: ${col.join(', ')}`);
            l.push(`FOTO DEL PRODUCTO: usa la imagen adjunta (original en: ${p.imagen || 'sin foto'})`);
            l.push('');
        });
        l.push('FORMATOS A ENTREGAR: 1080×1080 (publicación), 1080×1350 (vertical) y 1080×1920 (historia).');
        l.push(`ESTILO: ${estilo}`);
        l.push('REGLAS: escribe en español de México; usa EXACTAMENTE los precios y datos de arriba; no inventes descuentos, promociones, garantías ni plazos; deja márgenes seguros para que no se corte el texto en el celular.');
        return l.join('\n');
    }
    function hashtags(p) {
        const base = '#' + sinAcentos(PUB.cfg.negocio).replace(/[^a-z0-9]+/g, '');
        const cat = '#' + sinAcentos(p.categoria).replace(/[^a-z0-9]+/g, '');
        const lug = PUB.cfg.ubicacion ? '#' + sinAcentos(PUB.cfg.ubicacion.split(',').pop()).replace(/[^a-z0-9]+/g, '') : '';
        return [base, cat, lug, '#Muebles', '#Abonos'].filter(x => x.length > 2).join(' ');
    }
    function textoPublicacion(p, estilo) {
        const pr = planPrincipal(p), ex = existencia(p), col = colores(p), pm = promoDe(p);
        const credito = pr ? `📆 A crédito: ${dinero(pr.abono)} semanales (${pr.meses} ${pr.meses === 1 ? 'mes' : 'meses'}) con enganche desde ${dinero(pr.enganche)}` : '📆 Pregunta por tu plan de abonos';
        const car = lineasCaracteristicas(p).slice(0, 4).map(c => '• ' + c).join('\n');
        const datos = [p.marca, p.modelo].filter(Boolean).join(' · ');
        if (pm) {
            const gancho = `🔥 *${pm.nombre.toUpperCase()}* 🔥`;
            const oferta = pm.tipo === 'contado'
                ? [`💰 Antes ${dinero(pm.precioNormal)} → *AHORA ${dinero(pm.precioPromo)}* (ahorras ${dinero(pm.ahorro)})`, '_Precio válido solo de contado._']
                : [`💰 Contado: ${dinero(p.precio)}`, `📆 ${pm.etiquetas.join(' + ')}: *${dinero(pm.principal.abono)} semanales* (${pm.principal.meses} ${pm.principal.meses === 1 ? 'mes' : 'meses'}), enganche desde ${dinero(pm.enganche)}`];
            const cierre = [pm.vigencia ? `🗓️ ${pm.vigencia}` : '', pm.condiciones ? `_${pm.condiciones}_` : ''].filter(Boolean);
            if (estilo === 'wa') return [gancho, `*${p.nombre}*${datos ? '\n' + datos : ''}`, ...oferta, ex.ultima ? `⚡ ${ex.texto}` : '', ...cierre, `📲 Informes: ${linkWA(p)}`, `🖼️ Más modelos: ${PUB.cfg.catalogo}`].filter(Boolean).join('\n');
            if (estilo === 'urgencia') return [ex.ultima ? `⚡ ¡${ex.texto}! ${gancho}` : gancho, `*${p.nombre}*`, ...oferta, ...cierre, `Escríbenos ahora: ${linkWA(p)}`].join('\n');
            return [gancho, `✨ ${p.nombre}${datos ? ' — ' + datos : ''}`, '', car, col.length ? `🎨 Colores: ${col.join(', ')}` : '', '', ...oferta, ex.ultima ? `⚡ ${ex.texto}` : '', ...cierre, '', `📲 Pide informes por WhatsApp: ${telVisible()}`, PUB.cfg.ubicacion ? `📍 ${PUB.cfg.negocio} · ${PUB.cfg.ubicacion}` : '', `🖼️ Catálogo: ${PUB.cfg.catalogo}`, '', hashtags(p)].filter((x, i, a) => x !== '' || (a[i - 1] !== '')).join('\n');
        }
        if (estilo === 'wa') {
            return [`*${p.nombre}*${datos ? '\n' + datos : ''}`, `💰 Contado: *${dinero(p.precio)}*`, credito, ex.ultima ? `⚡ ${ex.texto}` : '', `📲 Informes: ${linkWA(p)}`, `🖼️ Más modelos: ${PUB.cfg.catalogo}`].filter(Boolean).join('\n');
        }
        if (estilo === 'urgencia') {
            const gancho = ex.ultima ? `⚡ ¡${ex.texto}!` : '⚡ ¡Aprovecha, disponible por tiempo limitado en inventario!';
            return [gancho, `*${p.nombre}*`, `💰 ${dinero(p.precio)} de contado`, credito, `Escríbenos ahora: ${linkWA(p)}`].join('\n');
        }
        return [`✨ ${p.nombre}${datos ? ' — ' + datos : ''}`, '', car, col.length ? `🎨 Colores: ${col.join(', ')}` : '', '', `💰 Contado: ${dinero(p.precio)}`, credito, ex.ultima ? `⚡ ${ex.texto}` : '', '', `📲 Pide informes por WhatsApp: ${telVisible()}`, PUB.cfg.ubicacion ? `📍 ${PUB.cfg.negocio} · ${PUB.cfg.ubicacion}` : '', `🖼️ Catálogo: ${PUB.cfg.catalogo}`, '', hashtags(p)].filter((x, i, a) => x !== '' || (a[i - 1] !== '')).join('\n');
    }

    // ------------------------------------------------------------------ diseño del anuncio (HTML a tamaño real)
    function fuente(p) { return PUB.fotoLocal[String(p.id)] || p.imagen || 'img/Logo.svg'; }

    function htmlAnuncio(p, o) {
        const F = FORMATOS[o.formato], T = Object.assign({}, PLANTILLAS[o.plantilla]);
        if (o.acento) { T.acento = o.acento; if (o.plantilla !== 'oscuro') { T.cta = o.acento; T.precio = o.acento; } }
        const W = F.w, H = F.h, u = W / 1080;
        const px = n => Math.round(n * u) + 'px';
        const pr = planPrincipal(p), ex = existencia(p), col = colores(p), pm = o.promoCalc || null;
        // el cuadrado tiene menos alto: textos más compactos (y aún más con promoción) para dejar espacio a la foto
        const c = o.formato === 'cuadrado' ? (pm ? 0.76 : 0.86) : 1;
        const nombreFs = Math.round(Math.max(44, Math.min(78, 1500 / Math.max(14, norm(p.nombre).length))) * c);
        const sub = [p.marca, p.modelo, p.color].filter(Boolean).join(' · ') + (col.length ? (p.color || p.marca || p.modelo ? ' · ' : '') + col.join(' / ') : '');
        const oscuro = o.plantilla === 'oscuro';
        const rojo = '#dc2626';
        // etiquetas sobre la foto: la promoción manda; la existencia pasa a la esquina derecha
        const pill = (txt, bg, fg, pos, fs) => `<div style="position:absolute;${pos};background:${bg};color:${fg};font-weight:900;font-size:${px(fs)};padding:${px(10)} ${px(22)};border-radius:${px(999)};letter-spacing:.01em;max-width:${px(620)};line-height:1.15">${esc(txt)}</div>`;
        const posIzq = `left:${px(24)};top:${px(24)}`, posDer = `right:${px(24)};top:${px(24)}`;
        let insignias = '';
        if (pm) {
            insignias += pill('🔥 ' + pm.etiqueta, rojo, '#fff', posIzq, 34);
            if (o.op.existencia && ex.ultima) insignias += pill('⚡ ' + ex.texto, '#0f172a', '#fff', posDer, 28);
        } else if (o.op.existencia && ex.ultima) insignias += pill('⚡ ' + ex.texto, rojo, '#fff', posIzq, 34);
        else if (o.op.existencia && ex.stock > 0) insignias += pill(ex.texto, T.acento, oscuro ? '#0b1220' : '#fff', posIzq, 30);
        const cat = o.op.categoria && p.categoria ? `<div style="background:${oscuro ? 'rgba(255,255,255,.12)' : T.acento + '1f'};color:${oscuro ? '#fff' : T.acento};font-weight:800;font-size:${px(28)};padding:${px(8)} ${px(22)};border-radius:${px(999)};white-space:nowrap">${esc(p.categoria)}</div>` : '';
        const lbl = t => `<div style="font-size:${px(28)};font-weight:800;letter-spacing:.08em;color:${T.tenue}">${t}</div>`;
        const col1 = [];
        if (pm && pm.tipo === 'contado') {
            if (o.op.precio) col1.push(`<div style="flex:1 1 0;min-width:0">${lbl('AHORA · CONTADO')}<div style="font-size:${px(118 * c)};font-weight:900;line-height:1;color:${T.precio};letter-spacing:-.02em">${dinero(pm.precioPromo)}</div><div style="font-size:${px(34)};color:${T.tenue};font-weight:700;margin-top:${px(4)}">antes <span style="text-decoration:line-through">${dinero(pm.precioNormal)}</span></div></div>`);
            if (o.op.abono) col1.push(`<div style="flex:1 1 0;min-width:0;text-align:${o.op.precio ? 'right' : 'left'}">${lbl('TÚ AHORRAS')}<div style="font-size:${px(84 * c)};font-weight:900;line-height:1.05;color:${T.tinta}">${dinero(pm.ahorro)}</div><div style="font-size:${px(28)};color:${T.tenue};font-weight:700;margin-top:${px(4)}">${pct1(pm.pct)}% de descuento</div></div>`);
        } else if (pm) {
            if (o.op.precio) col1.push(`<div style="flex:1 1 0;min-width:0">${lbl('CONTADO')}<div style="font-size:${px(118 * c)};font-weight:900;line-height:1;color:${T.precio};letter-spacing:-.02em">${dinero(p.precio)}</div></div>`);
            if (o.op.abono) col1.push(`<div style="flex:1 1 0;min-width:0;text-align:${o.op.precio ? 'right' : 'left'}">${lbl('ABONO SEMANAL')}<div style="font-size:${px(84 * c)};font-weight:900;line-height:1.05;color:${T.tinta}">${dinero(pm.principal.abono)}</div><div style="font-size:${px(28)};color:${T.tenue};font-weight:700;margin-top:${px(4)}">${pm.principal.meses} ${pm.principal.meses === 1 ? 'mes' : 'meses'}${o.op.enganche && !pm.etiquetas.some(t => /ENGANCHE/.test(t)) ? ` · enganche desde ${dinero(pm.enganche)}` : ''}${pm.msi ? ` · total ${dinero(pm.msi.total)}` : ''}</div></div>`);
        } else {
            if (o.op.precio) col1.push(`<div style="flex:1 1 0;min-width:0">${lbl('CONTADO')}<div style="font-size:${px(118 * c)};font-weight:900;line-height:1;color:${T.precio};letter-spacing:-.02em">${dinero(p.precio)}</div></div>`);
            if (o.op.abono) col1.push(`<div style="flex:1 1 0;min-width:0;text-align:${o.op.precio ? 'right' : 'left'}">${lbl(pr ? 'ABONO SEMANAL' : 'A CRÉDITO')}<div style="font-size:${px((pr ? 84 : 50) * c)};font-weight:900;line-height:1.05;color:${T.tinta}">${pr ? dinero(pr.abono) : 'Pregunta tu plan'}</div>${pr ? `<div style="font-size:${px(28)};color:${T.tenue};font-weight:700;margin-top:${px(4)}">${pr.meses} ${pr.meses === 1 ? 'mes' : 'meses'}${o.op.enganche ? ` · enganche desde ${dinero(pr.enganche)}` : ''}</div>` : ''}</div>`);
        }
        const extras = pm && pm.tipo === 'credito' && pm.etiquetas.length > 1
            ? `<div style="display:flex;gap:${px(12)};flex-wrap:wrap">${pm.etiquetas.slice(1).map(t => `<span style="background:${T.acento};color:${oscuro ? '#0b1220' : '#fff'};font-weight:900;font-size:${px(28)};padding:${px(8)} ${px(20)};border-radius:${px(999)}">${esc(t)}</span>`).join('')}</div>` : '';
        const cintaTxt = pm ? `${pm.nombre}${pm.vigencia ? ' · ' + pm.vigencia : ''}` : norm(o.promo).trim();
        const cinta = cintaTxt ? `<div style="background:${pm ? rojo : T.acento};color:#fff;font-weight:900;font-size:${px(pm ? 32 : 40)};line-height:1.15;text-align:center;padding:${px(14)} ${px(20)};border-radius:${px(18)}">${pm ? '🔥 ' : ''}${esc(cintaTxt)}</div>` : '';
        const logo = `<img src="img/Logo.svg" crossorigin="anonymous" alt="" style="width:${px(78)};height:${px(78)};object-fit:contain;${oscuro ? 'filter:invert(1);' : ''}">`;
        const letraChica = [pm && pm.tipo === 'contado' ? 'Precio promocional válido solo de contado.' : '', pm && pm.condiciones ? pm.condiciones : ''].filter(Boolean).join(' ');
        const lugar = (o.formato === 'cuadrado' && pm) ? '' : `${PUB.cfg.ubicacion ? '📍 ' + esc(PUB.cfg.ubicacion) + ' · ' : ''}${esc(PUB.cfg.catalogo.replace(/^https?:\/\//, ''))}`;
        return `<div style="width:${W}px;height:${H}px;position:relative;overflow:hidden;box-sizing:border-box;padding:${px(52 * c)} ${px(52)};display:flex;flex-direction:column;gap:${px(22 * c)};font-family:'Segoe UI',Arial,Helvetica,sans-serif;background:${T.fondo};color:${T.tinta}">
  <div style="display:flex;align-items:center;gap:${px(18)};min-height:${px(78)}">${logo}
    <div style="flex:1;min-width:0"><div style="font-size:${px(36)};font-weight:900;line-height:1.1">${esc(PUB.cfg.negocio)}</div>${PUB.cfg.slogan ? `<div style="font-size:${px(24)};color:${T.tenue};font-weight:600">${esc(PUB.cfg.slogan)}</div>` : ''}</div>${cat}</div>
  <div style="flex:1 1 0;min-height:0;position:relative;background:${T.tarjeta};border-radius:${px(40)};border:${px(3)} solid ${oscuro ? 'rgba(255,255,255,.18)' : 'rgba(15,23,42,.10)'};overflow:hidden">
    <div style="position:absolute;inset:${px(22)};background-image:url('${esc(fuente(p)).replace(/'/g, '%27')}');background-size:contain;background-position:center;background-repeat:no-repeat"></div>${insignias}</div>
  <div><div style="font-size:${px(nombreFs)};font-weight:900;line-height:1.08;max-height:${px(nombreFs * 2.3)};overflow:hidden">${esc(p.nombre)}</div>${sub && !(o.formato === 'cuadrado' && pm) ? `<div style="font-size:${px(32)};color:${T.tenue};font-weight:700;margin-top:${px(6)}">${esc(sub)}</div>` : ''}</div>
  ${col1.length ? `<div style="display:flex;gap:${px(24)};align-items:flex-end">${col1.join('')}</div>` : ''}
  ${extras}
  ${cinta}
  <div style="background:${T.cta};color:${T.ctaTxt};border-radius:${px(24)};padding:${px(20)} ${px(28)};display:flex;align-items:center;gap:${px(22)}">
    <div style="font-size:${px(58)};line-height:1">📲</div>
    <div style="flex:1;min-width:0"><div style="font-size:${px(30)};font-weight:700;opacity:.92">Pide informes por WhatsApp</div><div style="font-size:${px(62 * c)};font-weight:900;line-height:1.05;letter-spacing:.01em">${esc(telVisible())}</div></div></div>
  <div style="font-size:${px(22)};color:${T.tenue};font-weight:600;text-align:center;line-height:1.3">${letraChica ? esc(letraChica) + (lugar ? '<br>' : '') : ''}${lugar}</div>
</div>`;
    }
    const pct1 = n => (Math.round(Number(n) * 10) / 10).toString().replace(/\.0$/, '');

    function opcionesDiseno(p) {
        return { formato: PUB.formato, plantilla: PUB.plantilla, acento: PUB.acento, op: PUB.op, promo: PUB.promo, promoCalc: p ? promoDe(p) : null };
    }

    // Prueba si la foto se puede usar en un canvas (necesario para descargar el PNG)
    function probarFoto(url) {
        return new Promise(res => {
            if (!url || url.startsWith('data:') || url.startsWith('img/') || url.startsWith('/')) return res(true);
            const im = new Image(); im.crossOrigin = 'anonymous';
            im.onload = () => res(true); im.onerror = () => res(false); im.src = url;
            setTimeout(() => res(false), 12000);
        });
    }
    function cargarHtml2Canvas() {
        return new Promise((resolve, reject) => {
            if (typeof window.html2canvas === 'function') return resolve();
            const s = document.createElement('script'); s.src = 'js/vendor/html2canvas.min.js';
            s.onload = () => resolve(); s.onerror = () => reject(new Error('No se pudo cargar el motor de imágenes')); document.head.appendChild(s);
        });
    }
    async function renderAnuncio(p, o) {
        await cargarHtml2Canvas();
        const F = FORMATOS[o.formato];
        const host = document.createElement('div');
        host.style.cssText = `position:fixed;left:-200000px;top:0;width:${F.w}px;height:${F.h}px;pointer-events:none`;
        host.innerHTML = htmlAnuncio(p, o);
        document.body.appendChild(host);
        try {
            // espera a que carguen la foto y el logo antes de capturar
            const imgs = Array.from(host.querySelectorAll('img'));
            await Promise.all(imgs.map(im => im.complete ? 1 : new Promise(r => { im.onload = im.onerror = r; })));
            const url = fuente(p);
            if (!url.startsWith('data:')) await new Promise(r => { const t = new Image(); t.crossOrigin = 'anonymous'; t.onload = t.onerror = r; t.src = url; setTimeout(r, 12000); });
            return await window.html2canvas(host.firstElementChild, { scale: 1, width: F.w, height: F.h, useCORS: true, allowTaint: false, backgroundColor: null, logging: false });
        } finally { host.remove(); }
    }
    function nombreArchivo(p, o) {
        const base = sinAcentos(p.nombre).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'producto';
        return `anuncio_${base}_${o.formato}${o.promoCalc ? '_promo' : ''}`;
    }
    async function entregarCanvas(canvas, nombre, titulo) {
        if (window.ImagenService && typeof window.ImagenService.entregar === 'function') return window.ImagenService.entregar(canvas, nombre, { titulo, categoria: 'Publicidad' });
        const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = nombre + '.png'; document.body.appendChild(a); a.click(); a.remove(); return 'descargado';
    }
    async function crearAnuncio(id) {
        const p = productoPorId(id || PUB.activo); if (!p) return toast('Elige un producto.');
        if (PUB.generando) return; PUB.generando = true;
        const btn = $('pubBtnDescargar'); const t0 = btn ? btn.textContent : '';
        if (btn) { btn.disabled = true; btn.textContent = 'Generando…'; }
        try {
            if (!PUB.fotoLocal[String(p.id)] && !(await probarFoto(p.imagen))) {
                if (!confirm('La foto de este producto no permite exportarse (restricción del servidor de imágenes).\n\n¿Generar el anuncio SIN foto? Mejor cancela y usa "Subir otra foto".')) return;
                PUB.fotoLocal[String(p.id)] = 'img/Logo.svg';
            }
            const o = opcionesDiseno(p);
            const canvas = await renderAnuncio(p, o);
            const r = await entregarCanvas(canvas, nombreArchivo(p, o), 'Anuncio ' + p.nombre);
            toast(r === 'compartido' ? 'Compartido ✔' : r === 'cancelado' ? 'Cancelado' : 'Anuncio listo ✔');
        } catch (e) { console.error('Publicidad:', e); toast('No se pudo generar el anuncio.'); }
        finally { PUB.generando = false; if (btn) { btn.disabled = false; btn.textContent = t0; } }
    }
    async function crearTodos() {
        const lista = seleccionados(); if (!lista.length) return toast('Selecciona productos primero.');
        if (PUB.generando) return; PUB.generando = true;
        const btn = $('pubBtnTodos'); const t0 = btn ? btn.textContent : '';
        try {
            for (let i = 0; i < lista.length; i++) {
                const p = lista[i];
                if (btn) { btn.disabled = true; btn.textContent = `Generando ${i + 1} de ${lista.length}…`; }
                if (!PUB.fotoLocal[String(p.id)] && !(await probarFoto(p.imagen))) { toast(`Se omitió "${p.nombre}": su foto no permite exportarse. Súbela a mano.`); continue; }
                const o = opcionesDiseno(p);
                const canvas = await renderAnuncio(p, o);
                await entregarCanvas(canvas, nombreArchivo(p, o), 'Anuncio ' + p.nombre);
            }
            toast('Anuncios listos ✔');
        } catch (e) { console.error('Publicidad:', e); toast('No se pudieron generar todos.'); }
        finally { PUB.generando = false; if (btn) { btn.disabled = false; btn.textContent = t0; } }
    }

    // ------------------------------------------------------------------ interfaz
    function estilos() {
        if ($('pubEstilos')) return;
        const st = document.createElement('style'); st.id = 'pubEstilos';
        st.textContent = `
#publicidadContenido{font-family:inherit}
.pub-grid{display:grid;grid-template-columns:minmax(300px,420px) 1fr;gap:16px;align-items:start}
@media(max-width:900px){.pub-grid{grid-template-columns:1fr}}
.pub-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:14px}
.pub-card h3{margin:0 0 10px;font-size:15px;color:#0f172a}
.pub-in{width:100%;padding:9px 10px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;box-sizing:border-box}
.pub-lbl{display:block;font-size:11.5px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.03em;margin:10px 0 4px}
.pub-fila{display:flex;gap:10px;align-items:center;padding:8px 6px;border-bottom:1px solid #f1f5f9;cursor:pointer}
.pub-fila:hover{background:#f8fafc}
.pub-fila img{width:46px;height:46px;object-fit:contain;border-radius:8px;background:#f1f5f9;flex:none}
.pub-fila .t{flex:1;min-width:0;font-size:13.5px;line-height:1.25}
.pub-fila .t small{display:block;color:#64748b;font-size:12px}
.pub-lista{max-height:460px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:10px;margin-top:8px}
.pub-btn{padding:9px 13px;border:none;border-radius:8px;font-weight:800;font-size:13px;cursor:pointer;background:#e2e8f0;color:#0f172a}
.pub-btn.p{background:#0e8f6f;color:#fff}.pub-btn.az{background:#2563eb;color:#fff}.pub-btn.mo{background:#7c3aed;color:#fff}
.pub-btn:disabled{opacity:.6;cursor:default}
.pub-tabs{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}
.pub-tab{padding:9px 16px;border-radius:999px;border:1.5px solid #cbd5e1;background:#fff;font-weight:800;font-size:13.5px;cursor:pointer}
.pub-tab.on{background:#0e8f6f;border-color:#0e8f6f;color:#fff}
.pub-pre{white-space:pre-wrap;font-size:12.5px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:10px;max-height:240px;overflow:auto;margin:6px 0 0}
.pub-prod{display:flex;gap:12px;margin-bottom:14px}
.pub-prod img{width:92px;height:92px;object-fit:contain;border-radius:10px;background:#f1f5f9;flex:none}
.pub-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.pub-chip{padding:3px 10px;border-radius:999px;background:#e8f5f0;color:#0b6e56;font-size:12px;font-weight:800}
.pub-chip.r{background:#fee2e2;color:#991b1b}`;
        document.head.appendChild(st);
    }

    function tarjetaFila(p) {
        const ex = existencia(p), on = PUB.sel.has(String(p.id));
        return `<label class="pub-fila"><input type="checkbox" ${on ? 'checked' : ''} onchange="pubToggle('${esc(p.id)}', this.checked)">
            <img src="${esc(p.imagen || 'img/Logo.svg')}" loading="eager" alt="" onerror="this.src='img/Logo.svg'">
            <div class="t"><b>${esc(p.nombre)}</b><small>${esc([p.categoria, p.subcategoria].filter(Boolean).join(' / '))}${p.marca ? ' · ' + esc(p.marca) : ''}</small></div>
            <div style="text-align:right;font-size:13px;white-space:nowrap"><b>${dinero(p.precio)}</b><small style="display:block;color:${ex.ultima ? '#dc2626' : '#64748b'}">${esc(ex.stock > 0 ? ex.stock + ' en inv.' : 'sin existencia')}</small></div></label>`;
    }

    function panelProductos() {
        const cats = categorias(), filtrados = productosFiltrados();
        return `<div class="pub-card"><h3>1. Elige los productos</h3>
            <label class="pub-lbl">Categoría</label>
            <select class="pub-in" onchange="PUB_.categoria=this.value; renderPublicidad(true)"><option value="">Todas las categorías</option>${cats.map(c => `<option value="${esc(c)}" ${PUB.categoria === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
            <label class="pub-lbl">Buscar</label>
            <input class="pub-in" id="pubBuscar" placeholder="Nombre, marca, modelo…" value="${esc(PUB.busqueda)}" oninput="PUB_.busqueda=this.value; pubRefrescarLista()">
            <div style="display:flex;gap:14px;margin-top:8px;font-size:13px;flex-wrap:wrap">
              <label><input type="checkbox" ${PUB.soloStock ? 'checked' : ''} onchange="PUB_.soloStock=this.checked; renderPublicidad(true)"> Solo con existencia</label>
              <label><input type="checkbox" ${PUB.soloFoto ? 'checked' : ''} onchange="PUB_.soloFoto=this.checked; renderPublicidad(true)"> Solo con foto</label></div>
            <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="pub-btn" onclick="pubSeleccionarVisibles()">☑ Seleccionar los ${filtrados.length} visibles</button><button class="pub-btn" onclick="pubLimpiar()">Limpiar</button></div>
            <div class="pub-lista" id="pubLista">${filtrados.length ? filtrados.map(tarjetaFila).join('') : '<div style="padding:18px;text-align:center;color:#94a3b8">No hay productos con este filtro.</div>'}</div>
            <p style="font-size:12px;color:#64748b;margin:8px 0 0"><b id="pubContSel">${PUB.sel.size}</b> producto(s) seleccionado(s)</p></div>`;
    }

    function panelConfig() {
        const c = PUB.cfg;
        return `<details class="pub-card" style="margin-top:12px"><summary style="cursor:pointer;font-weight:800;font-size:14px">⚙️ Datos del negocio para los anuncios</summary>
            <label class="pub-lbl">Nombre</label><input class="pub-in" value="${esc(c.negocio)}" onchange="pubCfg('negocio',this.value)">
            <label class="pub-lbl">WhatsApp (con 52)</label><input class="pub-in" value="${esc(c.whatsapp)}" onchange="pubCfg('whatsapp',this.value)">
            <label class="pub-lbl">Ubicación</label><input class="pub-in" value="${esc(c.ubicacion)}" onchange="pubCfg('ubicacion',this.value)">
            <label class="pub-lbl">Liga del catálogo</label><input class="pub-in" value="${esc(c.catalogo)}" onchange="pubCfg('catalogo',this.value)">
            <label class="pub-lbl">Eslogan (opcional)</label><input class="pub-in" value="${esc(c.slogan)}" placeholder="Déjalo vacío si no quieres eslogan" onchange="pubCfg('slogan',this.value)">
            <p style="font-size:12px;color:#64748b;margin:8px 0 0">Se guardan en este navegador.</p></details>`;
    }

    function tabInfo() {
        const sel = seleccionados();
        if (!sel.length) return '<div class="pub-card" style="text-align:center;color:#94a3b8;padding:36px">Selecciona uno o más productos para ver su información.</div>';
        const global = `<div class="pub-card" style="margin-bottom:12px"><h3>2. Información para tu IA de diseño</h3>
            <label class="pub-lbl">Estilo que quieres (opcional; va dentro del brief)</label>
            <textarea class="pub-in" rows="2" placeholder="Ej.: moderno, fondo claro, colores verdes, estilo catálogo de tienda departamental…" oninput="PUB_.estilo=this.value">${esc(PUB.estilo)}</textarea>
            <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
              <button class="pub-btn mo" onclick="pubCopiarBrief()">🤖 Copiar brief para IA (${sel.length})</button>
              <button class="pub-btn az" onclick="pubCopiarFichas()">📋 Copiar fichas (${sel.length})</button>
              <button class="pub-btn" onclick="pubDescargarTxt()">⬇️ Descargar .txt</button></div></div>`;
        const cards = sel.map(p => {
            const ex = existencia(p), pr = planPrincipal(p), id = esc(p.id);
            if (PUB.textos[id] == null) PUB.textos[id] = textoPublicacion(p, 'fb');
            return `<div class="pub-card" style="margin-bottom:12px"><div class="pub-prod"><img src="${esc(p.imagen || 'img/Logo.svg')}" alt="" onerror="this.src='img/Logo.svg'">
                <div style="flex:1;min-width:0"><b style="font-size:15px">${esc(p.nombre)}</b>
                <div style="font-size:12.5px;color:#64748b">${esc([p.categoria, p.subcategoria].filter(Boolean).join(' / '))}${p.marca ? ' · ' + esc(p.marca) : ''}${p.modelo ? ' · ' + esc(p.modelo) : ''}</div>
                <div class="pub-chips"><span class="pub-chip">Contado ${dinero(p.precio)}</span>${pr ? `<span class="pub-chip">${dinero(pr.abono)} semanal · ${pr.meses} ${pr.meses === 1 ? 'mes' : 'meses'}</span><span class="pub-chip">Enganche ${dinero(pr.enganche)}</span>` : '<span class="pub-chip">Sin plan de crédito</span>'}<span class="pub-chip ${ex.ultima ? 'r' : ''}">${esc(ex.texto)}${ex.stock > 0 ? ' · ' + ex.stock + ' pz' : ''}</span></div></div></div>
              <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="pub-btn az" onclick="pubCopiarFicha('${id}')">📋 Ficha</button><button class="pub-btn mo" onclick="pubCopiarBrief('${id}')">🤖 Brief IA</button><button class="pub-btn p" onclick="pubDisenar('${id}')">🎨 Diseñar aquí</button></div>
              <details style="margin-top:10px"><summary style="cursor:pointer;font-size:13px;font-weight:800">✍️ Texto para publicar</summary>
                <div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0"><button class="pub-btn" onclick="pubTexto('${id}','wa')">WhatsApp / estado</button><button class="pub-btn" onclick="pubTexto('${id}','fb')">Facebook / Instagram</button><button class="pub-btn" onclick="pubTexto('${id}','urgencia')">Urgencia</button></div>
                <textarea class="pub-in" id="pubTxt_${id}" rows="9" oninput="PUB_.textos['${id}']=this.value">${esc(PUB.textos[id])}</textarea>
                <button class="pub-btn p" style="margin-top:6px" onclick="pubCopiarTexto('${id}')">📋 Copiar texto</button></details>
              <details style="margin-top:8px"><summary style="cursor:pointer;font-size:13px;font-weight:800">Ver ficha completa</summary><pre class="pub-pre">${esc(fichaTexto(p))}</pre></details></div>`;
        }).join('');
        return global + cards;
    }

    function tabDiseno() {
        const sel = seleccionados();
        if (!sel.length) return '<div class="pub-card" style="text-align:center;color:#94a3b8;padding:36px">Selecciona al menos un producto para diseñar su anuncio.</div>';
        if (!PUB.activo || !sel.some(p => String(p.id) === String(PUB.activo))) PUB.activo = String(sel[0].id);
        const p = productoPorId(PUB.activo), F = FORMATOS[PUB.formato];
        const anchoPrev = PUB.formato === 'historia' ? 300 : 400, k = anchoPrev / F.w;
        const opt = (obj, cur) => Object.keys(obj).map(k2 => `<option value="${k2}" ${cur === k2 ? 'selected' : ''}>${esc(obj[k2].et)}</option>`).join('');
        const chk = (k2, t) => `<label style="font-size:13px;display:block;margin:4px 0"><input type="checkbox" ${PUB.op[k2] ? 'checked' : ''} onchange="PUB_.op.${k2}=this.checked; pubPreview()"> ${t}</label>`;
        return `<div class="pub-card"><h3>2. Diseña el anuncio</h3>
            <div style="display:grid;grid-template-columns:minmax(240px,1fr) auto;gap:18px;align-items:start">
              <div>
                <label class="pub-lbl">Producto</label><select class="pub-in" onchange="PUB_.activo=this.value; renderPublicidad(true)">${sel.map(x => `<option value="${esc(x.id)}" ${String(x.id) === PUB.activo ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select>
                <label class="pub-lbl">Formato</label><select class="pub-in" onchange="PUB_.formato=this.value; renderPublicidad(true)">${opt(FORMATOS, PUB.formato)}</select>
                <label class="pub-lbl">Estilo</label><select class="pub-in" onchange="PUB_.plantilla=this.value; PUB_.acento=''; renderPublicidad(true)">${opt(PLANTILLAS, PUB.plantilla)}</select>
                <label class="pub-lbl">Color de acento</label><div style="display:flex;gap:8px;align-items:center"><input type="color" value="${esc(PUB.acento || PLANTILLAS[PUB.plantilla].acento)}" oninput="PUB_.acento=this.value; pubPreview()" style="width:52px;height:36px;border:none;background:none"><button class="pub-btn" onclick="PUB_.acento=''; renderPublicidad(true)">Restablecer</button></div>
                <label class="pub-lbl">Mostrar</label>${chk('precio', 'Precio de contado')}${chk('abono', 'Abono semanal')}${chk('enganche', 'Enganche')}${chk('existencia', 'Existencia / últimas piezas')}${chk('categoria', 'Etiqueta de categoría')}
                <label class="pub-lbl">Texto de promoción (opcional)</label><input class="pub-in" value="${esc(PUB.promo)}" ${PUB.promocionId ? 'disabled title="Hay una promoción elegida: se usa su nombre y vigencia"' : ''} placeholder="${PUB.promocionId ? 'Usa el nombre y la vigencia de la promoción' : 'Ej.: Aparta con tu enganche'}" oninput="PUB_.promo=this.value; pubPreview()">
                <label class="pub-lbl">Foto</label>
                <div style="display:flex;gap:8px;flex-wrap:wrap"><label class="pub-btn" style="display:inline-block">📷 Subir otra foto<input type="file" accept="image/*" style="display:none" onchange="pubSubirFoto(this)"></label>${PUB.fotoLocal[String(p.id)] ? '<button class="pub-btn" onclick="delete PUB_.fotoLocal[PUB_.activo]; renderPublicidad(true)">Usar la del producto</button>' : ''}</div>
                <p style="font-size:12px;color:#64748b;margin:6px 0 0">Si la foto del producto no se deja exportar, sube una aquí.</p>
              </div>
              <div><div id="pubPreviewWrap" style="width:${anchoPrev}px;height:${Math.round(F.h * k)}px;overflow:hidden;border:1px solid #d1d5db;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.12)"><div id="pubPreview" style="width:${F.w}px;height:${F.h}px;transform:scale(${k});transform-origin:top left">${htmlAnuncio(p, opcionesDiseno(p))}</div></div>
                <div style="font-size:12px;color:#64748b;margin-top:6px;text-align:center">Vista previa · se descarga a ${F.w}×${F.h}</div></div></div>
            <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap"><button class="pub-btn p" id="pubBtnDescargar" onclick="pubCrear()">⬇️ Descargar / compartir este anuncio</button>
              ${sel.length > 1 ? `<button class="pub-btn az" id="pubBtnTodos" onclick="pubCrearTodos()">⬇️ Generar los ${sel.length} seleccionados</button>` : ''}</div></div>`;
    }

    function selectorPromocion() {
        if (!window.PromocionesService) return '';
        const lista = PromocionesService.listar().filter(pr => ['Vigente', 'Programada'].includes(PromocionesService.estado(pr)) || String(pr.id) === String(PUB.promocionId));
        const sel = seleccionados(), pr = promocionActiva();
        const entran = pr ? sel.filter(p => PromocionesService.calcular(p, pr)).length : 0;
        return `<div class="pub-card" style="margin-bottom:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>🔥 Promoción:</b>
            <select class="pub-in" style="width:auto;min-width:240px;flex:1" onchange="PUB_.promocionId=this.value; renderPublicidad(true)"><option value="">Sin promoción (precios normales)</option>${lista.map(x => `<option value="${esc(x.id)}" ${String(x.id) === String(PUB.promocionId) ? 'selected' : ''}>${esc(x.nombre)} · ${x.tipo === 'contado' ? 'contado' : 'crédito'} · ${esc(PromocionesService.estado(x))}</option>`).join('')}</select>
            ${pr ? `<span class="pub-chip">${entran} de ${sel.length} seleccionados entran</span><button class="pub-btn" onclick="navA('promociones'); if (typeof renderPromociones === 'function') renderPromociones();">Ver promoción</button>` : '<span style="font-size:12px;color:#64748b">Elige una para anunciar con su precio o condiciones.</span>'}</div>`;
    }
    function panelDerecho() {
        return selectorPromocion() + `<div class="pub-tabs"><button class="pub-tab ${PUB.tab === 'info' ? 'on' : ''}" onclick="PUB_.tab='info'; renderPublicidad(true)">📋 Información y textos</button><button class="pub-tab ${PUB.tab === 'diseno' ? 'on' : ''}" onclick="PUB_.tab='diseno'; renderPublicidad(true)">🎨 Diseño en el sistema</button></div>${PUB.tab === 'info' ? tabInfo() : tabDiseno()}`;
    }
    window.renderPublicidad = function (soloSeleccion) {
        const cont = $('publicidadContenido'); if (!cont) return;
        estilos();
        const izq = panelProductos() + panelConfig();
        const der = `<div>${panelDerecho()}</div>`;
        cont.innerHTML = `<div class="pub-grid"><div>${izq}</div>${der}</div>`;
    };
    window.PUB_ = PUB;
    window.pubRefrescarLista = function () {
        const f = productosFiltrados(), el = $('pubLista');
        if (el) el.innerHTML = f.length ? f.map(tarjetaFila).join('') : '<div style="padding:18px;text-align:center;color:#94a3b8">No hay productos con este filtro.</div>';
    };
    window.pubToggle = function (id, on) { if (on) PUB.sel.add(String(id)); else PUB.sel.delete(String(id)); if ($('pubContSel')) $('pubContSel').textContent = PUB.sel.size; window.renderPublicidadDer(); };
    window.renderPublicidadDer = function () {
        const cont = $('publicidadContenido'); if (!cont) return;
        const grid = cont.querySelector('.pub-grid'); if (!grid || grid.children.length < 2) return window.renderPublicidad(true);
        grid.children[1].innerHTML = panelDerecho();
    };
    window.pubSeleccionarVisibles = function () { productosFiltrados().forEach(p => PUB.sel.add(String(p.id))); window.renderPublicidad(true); };
    window.pubLimpiar = function () { PUB.sel.clear(); PUB.activo = null; window.renderPublicidad(true); };
    window.pubCfg = function (k, v) { PUB.cfg[k] = String(v).trim(); guardarCfg(); if (PUB.tab === 'diseno') window.pubPreview(); };
    window.pubPreview = function () {
        const p = productoPorId(PUB.activo), el = $('pubPreview'); if (p && el) el.innerHTML = htmlAnuncio(p, opcionesDiseno(p));
    };
    window.pubDisenar = function (id) { PUB.activo = String(id); PUB.tab = 'diseno'; window.renderPublicidad(true); };
    window.pubCopiarFicha = function (id) { const p = productoPorId(id); if (p) copiar(fichaTexto(p), 'Ficha copiada ✔'); };
    window.pubCopiarFichas = function () { const s = seleccionados(); copiar(s.map(fichaTexto).join('\n\n' + '─'.repeat(30) + '\n\n'), `${s.length} ficha(s) copiada(s) ✔`); };
    window.pubCopiarBrief = function (id) { const s = id ? [productoPorId(id)].filter(Boolean) : seleccionados(); if (s.length) copiar(briefIA(s), 'Brief para IA copiado ✔'); };
    window.pubTexto = function (id, estilo) { const p = productoPorId(id); if (!p) return; PUB.textos[String(id)] = textoPublicacion(p, estilo); const t = $('pubTxt_' + id); if (t) t.value = PUB.textos[String(id)]; };
    window.pubCopiarTexto = function (id) { const t = $('pubTxt_' + id); copiar(t ? t.value : (PUB.textos[String(id)] || ''), 'Texto copiado ✔'); };
    window.pubDescargarTxt = function () {
        const s = seleccionados(); if (!s.length) return;
        const blob = new Blob([briefIA(s) + '\n\n' + '═'.repeat(40) + '\nFICHAS\n' + '═'.repeat(40) + '\n\n' + s.map(fichaTexto).join('\n\n' + '─'.repeat(30) + '\n\n')], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'publicidad_productos.txt'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    };
    window.pubSubirFoto = function (input) {
        const f = input.files && input.files[0]; if (!f || !PUB.activo) return;
        const r = new FileReader(); r.onload = () => { PUB.fotoLocal[String(PUB.activo)] = r.result; window.renderPublicidad(true); toast('Foto cargada ✔'); }; r.readAsDataURL(f);
    };
    window.pubCrear = function () { crearAnuncio(PUB.activo); };
    window.pubCrearTodos = function () { crearTodos(); };

    // Para pruebas y para reutilizar desde otros módulos
    window.PublicidadService = { planesCatalogo, planPrincipal, fichaTexto, briefIA, textoPublicacion, htmlAnuncio, renderAnuncio, opcionesDiseno, promoDe, FORMATOS, PLANTILLAS };
})();
