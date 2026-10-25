// ============================================================================
// 📱 ImagenService — motor ÚNICO para toda imagen que sale del sistema.
//
// Todas las imágenes de rev-main tienen el mismo destino: WhatsApp, vistas en
// un celular. Este servicio concentra lo que antes estaba repetido en ~10
// lugares (cxc, compras, oc-pagos, estadoCuentaCliente, ticket-service):
//
//   1) RENDER  -> renderDocumento(html, opts): dibuja el documento en un
//      iframe oculto de 390px y lo captura con html2canvas a escala 3.
//        - opts.tarjeta = true  : el html YA es una tarjeta diseñada para
//                                 celular (ver `ui`), solo se pule y captura.
//        - opts.tarjeta = false : documento "de hoja" (carta/tablas): se
//                                 reacomoda en automático a una columna
//                                 (tablas -> tarjetas, rejillas -> 1 columna,
//                                 tipografía mínima, sin sombras).
//   2) ENTREGA -> entregar(canvas|blob, nombre, opts): en celular/tablet abre
//      el menú de compartir (WhatsApp); en escritorio guarda en la carpeta de
//      documentos si está activa (CarpetaRaizService); si nada de eso aplica,
//      descarga el PNG. Nunca descarga cuando el usuario cancela compartir.
//   3) DISEÑO  -> ui: bloques para armar tarjetas (cabecera, dato grande,
//      filas, artículos, notas, pie) con la misma jerarquía en todo el sistema.
//
// El PDF y el ticket térmico NO pasan por aquí: siguen igual que siempre.
// ============================================================================
(function () {
    'use strict';

    const ANCHO = 390;               // px lógicos (ancho de un celular)
    const ESCALA = 3;                // nitidez (igual que el recibo de abono)
    const MAX_PX_ALTO = 14000;       // límite seguro de canvas en celulares
    const VENDOR_H2C = new URL('js/vendor/html2canvas.min.js', document.baseURI).href;

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

    function nombreSeguro(v) {
        return String(v || 'imagen')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/\.(png|jpe?g)$/i, '')
            .replace(/[^a-zA-Z0-9_-]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 80) || 'imagen';
    }

    function esMovil() {
        const ua = navigator.userAgent || '';
        return /Android|iPhone|iPad|iPod/i.test(ua) ||
            (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
    }

    function baseHref() {
        // document.baseURI respeta <base href> (la app de /cobranza/ lo usa); en el resto es igual a la URL de la página.
        return (document.baseURI || window.location.href).split('?')[0].split('#')[0];
    }

    function cargarHtml2Canvas() {
        return new Promise((resolve, reject) => {
            if (typeof window.html2canvas === 'function') return resolve();
            const existente = document.getElementById('mmp-html2canvas-loader');
            if (existente) {
                existente.addEventListener('load', () => resolve(), { once: true });
                existente.addEventListener('error', () => reject(new Error('html2canvas')), { once: true });
                return;
            }
            const s = document.createElement('script');
            s.id = 'mmp-html2canvas-loader';
            s.src = VENDOR_H2C;
            s.onload = () => resolve();
            s.onerror = () => reject(new Error('No se pudo cargar el motor de imagen'));
            document.head.appendChild(s);
        });
    }

    async function esperarRecursos(doc) {
        await Promise.all(Array.from(doc.images || []).map(img => img.complete
            ? Promise.resolve()
            : new Promise(res => {
                img.addEventListener('load', res, { once: true });
                img.addEventListener('error', res, { once: true });
            })));
        if (doc.fonts && doc.fonts.ready) {
            try { await doc.fonts.ready; } catch (e) { /* sin fuentes especiales */ }
        }
    }

    // ------------------------------------------------------------------
    // Estilos de tarjeta (clases mc-*) y de tablas convertidas (mt-*)
    // ------------------------------------------------------------------
    const CSS_TARJETA = `
html,body{margin:0;padding:0;background:#fff;}
.mc-root{width:${ANCHO}px;box-sizing:border-box;background:#fff;color:#0f172a;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.35;padding:18px 16px 22px;}
.mc-root *{box-sizing:border-box;}
.mc-head{text-align:center;}
.mc-head img{width:46px;height:46px;object-fit:contain;}
.mc-emp{font-size:15px;font-weight:700;color:#475569;margin-top:4px;}
.mc-tipo{font-size:13px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:#64748b;text-align:center;margin-top:12px;}
.mc-folio{font-size:27px;font-weight:900;color:#1e3a8a;text-align:center;line-height:1.15;margin-top:2px;word-break:break-word;}
.mc-badge-w{text-align:center;margin-top:8px;}
.mc-badge{display:inline-block;padding:4px 14px;border-radius:999px;font-size:13px;font-weight:800;}
.mc-hero{text-align:center;border-radius:18px;padding:16px 12px;margin:16px 0 6px;background:#eff6ff;}
.mc-hero-l{font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#1e40af;}
.mc-hero-v{font-size:36px;font-weight:900;line-height:1.1;margin-top:3px;color:#1e3a8a;word-break:break-word;}
.mc-hero-n{font-size:13.5px;color:#475569;margin-top:5px;}
.mc-sec{font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin:20px 2px 8px;}
.mc-fila{display:flex;justify-content:space-between;align-items:baseline;gap:14px;padding:9px 2px;border-bottom:1px solid #eef2f7;font-size:15px;}
.mc-fila>span:first-child{color:#64748b;flex-shrink:0;}
.mc-fila>b,.mc-fila>span:last-child{text-align:right;word-break:break-word;}
.mc-fila b{font-weight:800;}
.mc-item{background:#f8fafc;border-radius:14px;padding:12px 14px;margin-bottom:8px;}
.mc-item-t{font-size:16px;font-weight:800;color:#0f172a;word-break:break-word;}
.mc-item-d{font-size:13.5px;color:#64748b;margin-top:2px;word-break:break-word;}
.mc-item-m{display:inline-block;margin-top:6px;padding:2px 10px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:12.5px;font-weight:800;}
.mc-item-r{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-top:8px;}
.mc-item-q{font-size:14px;color:#475569;}
.mc-item-v{font-size:19px;font-weight:900;color:#0f172a;white-space:nowrap;}
.mc-nota{border-radius:14px;padding:12px 14px;margin:12px 0;font-size:14px;line-height:1.4;}
.mc-nota b{display:block;font-size:13px;letter-spacing:.03em;margin-bottom:2px;}
.mc-pie{text-align:center;font-size:13px;color:#94a3b8;margin-top:20px;}
`;

    const CSS_TABLAS = `
.mt-wrap{margin:6px 0 10px;}
.mt-card{background:#f8fafc;border-radius:14px;padding:11px 13px;margin-bottom:8px;}
.mt-t{font-size:16px;font-weight:800;color:#0f172a;word-break:break-word;}
.mt-f{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-top:5px;font-size:14px;}
.mt-f>span:first-child{color:#64748b;flex-shrink:0;}
.mt-f>span:last-child{text-align:right;word-break:break-word;}
.mt-k{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-top:8px;padding-top:8px;border-top:1px solid #e2e8f0;}
.mt-k>span:first-child{font-size:13px;font-weight:700;color:#475569;}
.mt-k>b{font-size:19px;font-weight:900;text-align:right;}
.mt-tot{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:10px 4px;border-top:2px solid #cbd5e1;font-weight:800;font-size:16px;}
.mt-tot>b{font-size:20px;font-weight:900;text-align:right;}
.mt-sec{font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:#475569;margin:14px 2px 6px;}
.mt-card img{max-width:72px;height:auto;border-radius:8px;}
`;

    // ------------------------------------------------------------------
    // Reacomodo automático de documentos "de hoja" a formato celular
    // ------------------------------------------------------------------
    const RE_CLAVE_FUERTE = /(^|\s)(sub)?total|importe|monto|saldo/i;
    const RE_CLAVE = /total|importe|monto|saldo|abono|pago|precio|costo|adeudo|cargo|ingreso|egreso|utilidad/i;

    function textoCelda(c) {
        return (c.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function tablaATarjetas(doc, tabla) {
        const filas = Array.from(tabla.rows);
        if (!filas.length) return;

        const encabezado = (tabla.tHead && tabla.tHead.rows[0])
            ? tabla.tHead.rows[0]
            : (filas[0].cells.length && Array.from(filas[0].cells).every(c => c.tagName === 'TH') ? filas[0] : null);
        const etiquetas = encabezado ? Array.from(encabezado.cells).map(textoCelda) : [];
        const columnas = Math.max(0, ...filas.map(f => f.cells.length));

        // Tablas de 1-2 columnas (clave/valor) ya caben en un celular.
        if (columnas <= 2 && !encabezado) {
            tabla.style.width = '100%';
            return;
        }

        const enTfoot = f => f.parentElement && f.parentElement.tagName === 'TFOOT';
        const cuerpo = filas.filter(f => f !== encabezado && !(f.parentElement && f.parentElement.tagName === 'THEAD'));

        let idxClave = -1;
        for (let i = etiquetas.length - 1; i >= 1; i--) {
            if (RE_CLAVE_FUERTE.test(etiquetas[i])) { idxClave = i; break; }
        }
        if (idxClave < 0) {
            for (let i = etiquetas.length - 1; i >= 1; i--) {
                if (RE_CLAVE.test(etiquetas[i])) { idxClave = i; break; }
            }
        }

        const wrap = doc.createElement('div');
        wrap.className = 'mt-wrap';

        cuerpo.forEach(fila => {
            const celdas = Array.from(fila.cells);
            if (!celdas.length) return;

            // Fila de sección (una sola celda ancha)
            if (celdas.length === 1) {
                const t = textoCelda(celdas[0]);
                if (!t) return;
                const d = doc.createElement('div');
                d.className = 'mt-sec';
                d.innerHTML = celdas[0].innerHTML;
                wrap.appendChild(d);
                return;
            }

            // Fila de total (pie de tabla, o "TOTAL:" abarcando varias columnas)
            const esTotal = enTfoot(fila) || (celdas.length === 2 && celdas[0].colSpan > 1);
            if (esTotal) {
                const d = doc.createElement('div');
                d.className = 'mt-tot';
                const ultimo = celdas[celdas.length - 1];
                const etiqueta = celdas.slice(0, -1).map(textoCelda).filter(Boolean).join(' ');
                d.innerHTML = `<span>${esc(etiqueta)}</span><b>${ultimo.innerHTML}</b>`;
                wrap.appendChild(d);
                return;
            }

            // Fila normal -> tarjeta
            let inicio = 0;
            if (celdas.length > 2 && /^\d{1,3}$/.test(textoCelda(celdas[0]))) inicio = 1; // columna "#"
            const card = doc.createElement('div');
            card.className = 'mt-card';
            if (fila.style && fila.style.background && /fef|fff7|fde|fee/i.test(fila.style.background)) {
                card.style.background = fila.style.background;
            }
            let html = `<div class="mt-t">${celdas[inicio].innerHTML}</div>`;
            celdas.forEach((c, i) => {
                if (i <= inicio) return;
                const t = textoCelda(c);
                const tieneImg = !!c.querySelector('img');
                if (!t && !tieneImg) return;
                if (i === idxClave) return;
                const etq = etiquetas[i] || '';
                html += etq
                    ? `<div class="mt-f"><span>${esc(etq)}</span><span>${c.innerHTML}</span></div>`
                    : `<div class="mt-f"><span>${c.innerHTML}</span></div>`;
            });
            if (idxClave > 0 && celdas[idxClave] && textoCelda(celdas[idxClave])) {
                html += `<div class="mt-k"><span>${esc(etiquetas[idxClave] || '')}</span><b>${celdas[idxClave].innerHTML}</b></div>`;
            }
            card.innerHTML = html;
            wrap.appendChild(card);
        });

        tabla.parentNode.replaceChild(wrap, tabla);
    }

    function adaptarMovil(doc, { tablas = true } = {}) {
        const win = doc.defaultView;
        const body = doc.body;

        // 1) Fuera lo que solo sirve en escritorio / pantalla
        body.querySelectorAll('script,noscript,button,.no-print,.mmp-document-toolbar,.mmp-print-toolbar,[data-no-imagen]')
            .forEach(e => e.remove());

        // 2) Estilos de apoyo
        const st = doc.createElement('style');
        st.textContent = CSS_TABLAS;
        (doc.head || doc.documentElement).appendChild(st);

        // 3) Tablas -> tarjetas (de adentro hacia afuera)
        if (tablas) {
            Array.from(body.querySelectorAll('table')).reverse().forEach(t => {
                try { tablaATarjetas(doc, t); } catch (e) { console.warn('ImagenService: tabla sin convertir', e); }
            });
        }

        // 4) Anchos fijos de hoja -> fluidos
        body.querySelectorAll('[style]').forEach(el => {
            const s = el.style;
            if (s.width && /px$/.test(s.width) && parseFloat(s.width) > ANCHO - 40 && el.tagName !== 'IMG') s.width = '100%';
            if (s.minWidth && /px$/.test(s.minWidth) && parseFloat(s.minWidth) > ANCHO - 60) s.minWidth = '0';
            if (s.maxWidth && /px$|in$|mm$/.test(s.maxWidth)) s.maxWidth = '100%';
        });

        // 5) Rejillas y filas flex
        body.querySelectorAll('*').forEach(el => {
            const cs = win.getComputedStyle(el);
            if (cs.display === 'grid' || cs.display === 'inline-grid') {
                const hijos = Array.from(el.children);
                const largo = hijos.some(h => textoCelda(h).length > 26);
                el.style.gridTemplateColumns = (largo || hijos.length <= 1) ? '1fr' : 'repeat(2,minmax(0,1fr))';
                el.style.gap = '10px';
            } else if (cs.display === 'flex' && cs.flexDirection.indexOf('row') === 0) {
                el.style.flexWrap = 'wrap';
            }
        });

        // 6) Tipografía mínima legible y sin sombras decorativas
        body.querySelectorAll('*').forEach(el => {
            if (el.tagName === 'svg' || el.closest('svg')) return;
            const cs = win.getComputedStyle(el);
            const fs = parseFloat(cs.fontSize);
            if (fs && fs < 13) el.style.fontSize = '13px';
            if (cs.boxShadow && cs.boxShadow !== 'none') el.style.boxShadow = 'none';
        });
    }

    // ------------------------------------------------------------------
    // Render
    // ------------------------------------------------------------------
    function documentoCompleto(html, titulo) {
        let out = String(html || '');
        if (!/<html[\s>]/i.test(out)) {
            out = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${esc(titulo || 'Documento')}</title></head><body>${out}</body></html>`;
        }
        if (!/<base\s/i.test(out)) {
            out = out.replace(/<head[^>]*>/i, m => `${m}\n<base href="${esc(baseHref())}">`);
        }
        return out;
    }

    // Devuelve un canvas listo para entregar().
    async function renderDocumento(html, opts = {}) {
        await cargarHtml2Canvas();

        const iframe = document.createElement('iframe');
        iframe.setAttribute('aria-hidden', 'true');
        iframe.style.cssText = `position:fixed;left:-100000px;top:0;width:${ANCHO}px;height:1000px;border:0;opacity:0;pointer-events:none;`;
        document.body.appendChild(iframe);

        try {
            const doc = iframe.contentDocument;
            doc.open();
            doc.write(documentoCompleto(html, opts.titulo));
            doc.close();

            await new Promise(res => {
                if (doc.readyState === 'complete') res();
                else iframe.addEventListener('load', res, { once: true });
            });
            await esperarRecursos(doc);

            const estilosBase = doc.createElement('style');
            estilosBase.textContent = CSS_TARJETA;
            (doc.head || doc.documentElement).appendChild(estilosBase);

            // Raíz de captura
            let raiz = doc.querySelector('.mc-root');
            // raizPropia: el html ya trae su contenedor de 390px (p. ej. la imagen
            // de celular de Estado de Cuenta Cliente) -> se captura tal cual.
            if (!raiz && opts.raizPropia) raiz = doc.body.firstElementChild;
            if (!raiz) {
                raiz = doc.createElement('div');
                raiz.className = 'mc-root';
                while (doc.body.firstChild) raiz.appendChild(doc.body.firstChild);
                doc.body.appendChild(raiz);
            }
            doc.documentElement.style.cssText = `width:${ANCHO}px;background:#fff;`;
            doc.body.style.setProperty('margin', '0', 'important');
            doc.body.style.setProperty('padding', '0', 'important');
            doc.body.style.setProperty('width', ANCHO + 'px', 'important');
            doc.body.style.setProperty('max-width', 'none', 'important');
            doc.body.style.setProperty('background', '#fff', 'important');

            // Tarjeta diseñada: solo se pule. Documento de hoja: se reacomoda completo.
            if (opts.pulir !== false) {
                adaptarMovil(doc, { tablas: !opts.tarjeta });
                await esperarRecursos(doc);
            }

            const alto = Math.max(raiz.scrollHeight, raiz.offsetHeight, 1);
            const escala = Math.max(1.5, Math.min(opts.escala || ESCALA, MAX_PX_ALTO / alto));

            return await window.html2canvas(raiz, {
                scale: escala,
                useCORS: true,
                allowTaint: false,
                backgroundColor: '#ffffff',
                logging: false,
                width: ANCHO,
                windowWidth: ANCHO,
                windowHeight: alto
            });
        } finally {
            iframe.remove();
        }
    }

    // ------------------------------------------------------------------
    // Entrega: compartir (celular) -> carpeta de documentos -> descarga
    // ------------------------------------------------------------------
    function aBlob(fuente) {
        if (fuente instanceof Blob) return Promise.resolve(fuente);
        return new Promise(res => fuente.toBlob(res, 'image/png'));
    }

    function descargarBlob(blob, nombre) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = nombre;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }

    // Devuelve 'compartido' | 'cancelado' | 'carpeta' | 'descargado'
    async function entregar(fuente, nombreBase, opts = {}) {
        const nombre = nombreSeguro(nombreBase) + '.png';
        const blob = await aBlob(fuente);
        if (!blob) throw new Error('No se pudo generar el PNG');

        // 1) Celular / tablet: menú de compartir (WhatsApp). `ventana` permite
        //    usar la activación del usuario de una ventana emergente.
        const nav = (opts.ventana && opts.ventana.navigator) || navigator;
        if (esMovil() && nav.canShare && typeof nav.share === 'function') {
            try {
                const archivo = new File([blob], nombre, { type: 'image/png' });
                if (nav.canShare({ files: [archivo] })) {
                    const datos = { files: [archivo], title: opts.titulo || nombreBase };
                    if (opts.texto) datos.text = opts.texto;
                    await nav.share(datos);
                    return 'compartido';
                }
            } catch (e) {
                if (e && e.name === 'AbortError') return 'cancelado'; // cerrar el menú no descarga
                console.warn('ImagenService: no se pudo compartir, se continúa', e);
            }
        }

        // 2) Escritorio con carpeta de documentos activa
        try {
            const svc = window.CarpetaRaizService;
            if (svc) {
                const r = await svc.guardarArchivo(blob, nombre, opts.categoria || opts.titulo || nombreBase);
                if (r && r.guardado) return 'carpeta';
            }
        } catch (e) {
            console.warn('ImagenService: carpeta no disponible, se descarga', e);
        }

        // 3) Descarga normal
        descargarBlob(blob, nombre);
        return 'descargado';
    }

    // ------------------------------------------------------------------
    // Bloques de diseño para armar tarjetas
    // ------------------------------------------------------------------
    const TONOS = {
        azul:    { bg: '#eff6ff', fg: '#1e40af', borde: '#bfdbfe' },
        verde:   { bg: '#f0fdf4', fg: '#166534', borde: '#bbf7d0' },
        ambar:   { bg: '#fffbeb', fg: '#92400e', borde: '#fde68a' },
        violeta: { bg: '#f5f3ff', fg: '#5b21b6', borde: '#ddd6fe' },
        rojo:    { bg: '#fef2f2', fg: '#991b1b', borde: '#fecaca' },
        gris:    { bg: '#f8fafc', fg: '#334155', borde: '#e2e8f0' }
    };

    function tono(n) { return TONOS[n] || TONOS.azul; }

    const ui = {
        esc, dinero, tonos: TONOS,

        // Documento completo listo para renderDocumento(..., { tarjeta: true })
        envolver(contenido, titulo) {
            return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${esc(titulo || 'Documento')}</title></head>` +
                `<body><div class="mc-root">${contenido}</div></body></html>`;
        },

        cabecera({ empresa, tipo, folio, badge } = {}) {
            const b = badge && badge.texto
                ? `<div class="mc-badge-w"><span class="mc-badge" style="background:${badge.bg || '#e2e8f0'};color:${badge.fg || '#334155'};">${esc(badge.texto)}</span></div>`
                : '';
            return `<div class="mc-head"><img src="img/Logo.svg" alt="" onerror="this.style.display='none'">` +
                `<div class="mc-emp">${esc(empresa || 'Mueblería Mi Pueblito')}</div></div>` +
                (tipo ? `<div class="mc-tipo">${esc(tipo)}</div>` : '') +
                (folio ? `<div class="mc-folio">${esc(folio)}</div>` : '') + b;
        },

        // El dato importante, grande
        hero({ etiqueta, valor, nota, tono: t } = {}) {
            const c = tono(t);
            return `<div class="mc-hero" style="background:${c.bg};">` +
                `<div class="mc-hero-l" style="color:${c.fg};">${esc(etiqueta)}</div>` +
                `<div class="mc-hero-v" style="color:${c.fg};">${esc(valor)}</div>` +
                (nota ? `<div class="mc-hero-n">${esc(nota)}</div>` : '') + `</div>`;
        },

        seccion(texto) { return `<div class="mc-sec">${esc(texto)}</div>`; },

        // pares [etiqueta, valor] ; valor puede ser { texto, color, fuerte }
        filas(pares) {
            return (pares || []).filter(Boolean).map(([l, v]) => {
                const o = (v && typeof v === 'object') ? v : { texto: v };
                if (o.texto == null || o.texto === '') return '';
                const estilo = o.color ? ` style="color:${o.color};"` : '';
                return `<div class="mc-fila"><span>${esc(l)}</span>` +
                    (o.fuerte ? `<b${estilo}>${esc(o.texto)}</b>` : `<span${estilo}>${esc(o.texto)}</span>`) + `</div>`;
            }).join('');
        },

        item({ titulo, detalle, marca, izquierda, derecha } = {}) {
            return `<div class="mc-item"><div class="mc-item-t">${esc(titulo)}</div>` +
                (detalle ? `<div class="mc-item-d">${esc(detalle)}</div>` : '') +
                (marca ? `<span class="mc-item-m">${esc(marca)}</span>` : '') +
                `<div class="mc-item-r"><span class="mc-item-q">${esc(izquierda || '')}</span>` +
                `<span class="mc-item-v">${esc(derecha || '')}</span></div></div>`;
        },

        nota({ titulo, texto, tono: t } = {}) {
            const c = tono(t || 'ambar');
            return `<div class="mc-nota" style="background:${c.bg};color:${c.fg};">` +
                (titulo ? `<b>${esc(titulo)}</b>` : '') + `${esc(texto)}</div>`;
        },

        // HTML ya armado por otro módulo (p. ej. bloque de bodega con QR)
        bloque(html) { return html || ''; },

        pie(texto) { return `<div class="mc-pie">${esc(texto)}</div>`; }
    };

    window.ImagenService = {
        ANCHO, ESCALA,
        renderDocumento,
        entregar,
        esMovil,
        nombreSeguro,
        ui
    };
})();
