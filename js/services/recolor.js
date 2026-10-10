/* =====================================================================
 * RecolorService -- cambia el color de la madera/pintura de una foto de
 * mueble directamente en el navegador (canvas), sin subir otra imagen.
 *
 * Idea: el producto trae UNA foto (ej. recámara en nogal) y un "color
 * base" (el tono real de esa foto, muestreado con un toque). Para pintar
 * la foto en otro color se buscan los pixeles cuyo tono/saturación se
 * parezcan al color base (la madera) y SOLO a esos se les cambia el color,
 * conservando las sombras, brillos y veta (el "relieve" de luz de cada
 * pixel). Paredes, sábanas, piso y reflejos casi no se tocan porque su
 * color no se parece al del mueble.
 *
 * Es una VISTA APROXIMADA: no sustituye una foto real del color.
 *
 * Requisito: la imagen debe poder leerse en canvas (mismo dominio, o un
 * servidor con CORS: Firebase Storage con CORS, raw.githubusercontent.com,
 * Vercel del mismo sitio). Si el servidor no manda CORS, cargarImagen()
 * rechaza con { code: 'cors' } y el catálogo simplemente no ofrece colores.
 * ===================================================================== */
(function (global) {
    'use strict';

    var MAX_LADO = 1000; // px del lado mayor al procesar (suficiente para el modal)

    function _clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }

    function hexARgb(hex) {
        var h = String(hex || '').trim().replace('#', '');
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
        return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
    }

    function rgbAHex(r, g, b) {
        function p(n) { var s = Math.round(_clamp(n, 0, 255)).toString(16); return s.length < 2 ? '0' + s : s; }
        return '#' + p(r) + p(g) + p(b);
    }

    // r,g,b 0..255 -> [h 0..1, s 0..1, v 0..1]
    function rgbAHsv(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
        if (d > 0) {
            if (mx === r) h = ((g - b) / d) % 6;
            else if (mx === g) h = (b - r) / d + 2;
            else h = (r - g) / d + 4;
            h /= 6;
            if (h < 0) h += 1;
        }
        return [h, mx === 0 ? 0 : d / mx, mx];
    }

    // h,s,v 0..1 -> [r,g,b] 0..255
    function hsvARgb(h, s, v) {
        h = ((h % 1) + 1) % 1;
        var i = Math.floor(h * 6), f = h * 6 - i;
        var p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s), r, g, b;
        switch (i % 6) {
            case 0: r = v; g = t; b = p; break;
            case 1: r = q; g = v; b = p; break;
            case 2: r = p; g = v; b = t; break;
            case 3: r = p; g = q; b = v; break;
            case 4: r = t; g = p; b = v; break;
            default: r = v; g = p; b = q; break;
        }
        return [r * 255, g * 255, b * 255];
    }

    // Evita que los brillos se "quemen" al aclarar mucho el color.
    function _suavizarLuz(v) {
        if (v <= 0.88) return v < 0.02 ? 0.02 : v;
        return 0.88 + 0.105 * Math.tanh((v - 0.88) / 0.105);
    }

    /**
     * Núcleo puro (sin DOM): modifica `data` (Uint8ClampedArray RGBA) en sitio.
     * cfg = { base:'#hex', destino:'#hex', tolerancia: 5..100,
     *         ancho: px de la imagen (necesario solo si hay zona),
     *         zona: {x,y,w,h} opcional, en 0..1 -- solo se recolorea dentro }
     * Devuelve el porcentaje (0..1) de pixeles que se consideraron "mueble",
     * útil para avisar en el admin si la tolerancia no atrapó casi nada
     * (o si atrapó casi todo, señal de que el color base es muy parecido
     * a la pared/sábanas y conviene marcar una zona).
     */
    function recolorPixeles(data, cfg) {
        var rgbB = hexARgb(cfg.base), rgbD = hexARgb(cfg.destino);
        if (!rgbB || !rgbD) return 0;
        var B = rgbAHsv(rgbB[0], rgbB[1], rgbB[2]);
        var D = rgbAHsv(rgbD[0], rgbD[1], rgbD[2]);
        var tol = _clamp((Number(cfg.tolerancia) || 50), 5, 100) / 100;

        // Radios de la "membresía": dentro de r0 es 100% mueble, fuera de r1 es 0%.
        var r0 = 0.05 + 0.15 * tol;
        var r1 = r0 + 0.10 + 0.22 * tol;

        var sB = Math.max(B[1], 0.04);
        var vB = Math.max(B[2], 0.05);

        // Cuánto del contraste de luz (veta/sombras) se conserva al cambiar de claridad:
        // mezcla entre la curva gamma (conserva extremos) y la diferencia lineal (conserva contraste).
        var vBg = _clamp(B[2], 0.06, 0.96), vDg = _clamp(D[2], 0.06, 0.96);
        var pendGamma = Math.log(vDg) / Math.log(vBg) * vDg / vBg; // pendiente local de v^g en el punto base
        var kappa = _clamp(pendGamma * 0.4 + 0.6, 0.45, 1.25);

        var total = 0, tocados = 0, n = data.length;
        var ancho = Number(cfg.ancho) || 0, zona = (cfg.zona && ancho) ? cfg.zona : null;
        var zx0 = 0, zx1 = 0, zy0 = 0, zy1 = 0;
        if (zona) {
            var alto = n / 4 / ancho;
            zx0 = zona.x * ancho; zx1 = (zona.x + zona.w) * ancho;
            zy0 = zona.y * alto; zy1 = (zona.y + zona.h) * alto;
        }
        for (var i = 0; i < n; i += 4) {
            if (data[i + 3] < 8) continue;
            total++;
            if (zona) {
                var pxi = i / 4, py = Math.floor(pxi / ancho), px = pxi - py * ancho;
                if (px < zx0 || px > zx1 || py < zy0 || py > zy1) continue;
            }
            var r = data[i], g = data[i + 1], b = data[i + 2];

            // --- RGB -> HSV inline (rápido) ---
            var rr = r / 255, gg = g / 255, bb = b / 255;
            var mx = rr > gg ? (rr > bb ? rr : bb) : (gg > bb ? gg : bb);
            var mn = rr < gg ? (rr < bb ? rr : bb) : (gg < bb ? gg : bb);
            var dlt = mx - mn, h = 0;
            if (dlt > 0) {
                if (mx === rr) h = ((gg - bb) / dlt) % 6;
                else if (mx === gg) h = (bb - rr) / dlt + 2;
                else h = (rr - gg) / dlt + 4;
                h /= 6; if (h < 0) h += 1;
            }
            var s = mx === 0 ? 0 : dlt / mx, v = mx;
            if (v < 0.03) continue; // negro puro: no tiene color que cambiar

            // --- ¿Qué tanto se parece al color base? ---
            var dh = Math.abs(h - B[0]); if (dh > 0.5) dh = 1 - dh; // 0..0.5
            // El tono solo es confiable si ambos son saturados y no es sombra muy oscura.
            var pesoH = Math.min(s, B[1]) * Math.min(1, v * 5);
            var dHue = dh * 2 * pesoH * 2.6;
            var dS = s - B[1];
            var dV = (v - B[2]) * 0.30;
            var dist = Math.sqrt(dHue * dHue + dS * dS + dV * dV);

            var w;
            if (dist <= r0) w = 1;
            else if (dist >= r1) continue;
            else { var x = (dist - r0) / (r1 - r0); w = 1 - x * x * (3 - 2 * x); }

            // --- Nuevo color: tono y saturación del destino, luz relativa del pixel ---
            var dHueFirma = h - B[0]; if (dHueFirma > 0.5) dHueFirma -= 1; else if (dHueFirma < -0.5) dHueFirma += 1;
            var nh = D[0] + dHueFirma * 0.5; // conserva un poco de variación natural de la veta
            var nsR = _clamp(s / sB, 0.5, 1.6);
            var ns = _clamp(D[1] * nsR, 0, 1);
            var nv = _suavizarLuz(D[2] + (v - B[2]) * kappa);

            var rgb = hsvARgb(nh, ns, nv);
            data[i] = r + (rgb[0] - r) * w;
            data[i + 1] = g + (rgb[1] - g) * w;
            data[i + 2] = b + (rgb[2] - b) * w;
            tocados += w;
        }
        return total ? tocados / total : 0;
    }

    // ------------------------------------------------------------------
    // Capa de navegador
    // ------------------------------------------------------------------

    /** Carga la imagen con CORS para poder leer sus pixeles. */
    function cargarImagen(url) {
        return new Promise(function (resolve, reject) {
            if (!url) return reject({ code: 'sin-imagen' });
            var img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = function () {
                // Prueba real: un canvas "contaminado" (sin CORS) lanza SecurityError al leer.
                try {
                    var c = document.createElement('canvas'); c.width = 2; c.height = 2;
                    var x = c.getContext('2d'); x.drawImage(img, 0, 0, 2, 2); x.getImageData(0, 0, 1, 1);
                    resolve(img);
                } catch (e) { reject({ code: 'cors' }); }
            };
            img.onerror = function () { reject({ code: 'cors' }); };
            img.src = url;
        });
    }

    function _lienzoEscalado(img) {
        var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        var esc = Math.min(1, MAX_LADO / Math.max(w, h));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w * esc));
        c.height = Math.max(1, Math.round(h * esc));
        c.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0, c.width, c.height);
        return c;
    }

    /**
     * Devuelve { dataUrl, cobertura } con la imagen recoloreada.
     * cfg = { base, destino, tolerancia }
     */
    function recolorear(img, cfg) {
        var c = _lienzoEscalado(img);
        var ctx = c.getContext('2d', { willReadFrequently: true });
        var datos = ctx.getImageData(0, 0, c.width, c.height);
        var cfgPx = { base: cfg.base, destino: cfg.destino, tolerancia: cfg.tolerancia, zona: cfg.zona, ancho: c.width };
        var cobertura = recolorPixeles(datos.data, cfgPx);
        ctx.putImageData(datos, 0, 0);
        return { dataUrl: c.toDataURL('image/jpeg', 0.9), cobertura: cobertura };
    }

    /** Color promedio (hex) de un círculo pequeño de la foto. xN,yN en 0..1 sobre la imagen completa. */
    function muestrearColor(img, xN, yN, radioPx) {
        var c = _lienzoEscalado(img);
        var ctx = c.getContext('2d', { willReadFrequently: true });
        var rad = radioPx || 6;
        var x0 = Math.round(_clamp(xN * c.width - rad, 0, c.width - 1));
        var y0 = Math.round(_clamp(yN * c.height - rad, 0, c.height - 1));
        var w = Math.min(rad * 2, c.width - x0), h = Math.min(rad * 2, c.height - y0);
        var d = ctx.getImageData(x0, y0, Math.max(1, w), Math.max(1, h)).data;
        var rs = [], gs = [], bs = [];
        for (var i = 0; i < d.length; i += 4) { rs.push(d[i]); gs.push(d[i + 1]); bs.push(d[i + 2]); }
        function med(a) { a.sort(function (p, q) { return p - q; }); return a[Math.floor(a.length / 2)]; }
        return rgbAHex(med(rs), med(gs), med(bs));
    }

    global.RecolorService = {
        hexARgb: hexARgb,
        rgbAHex: rgbAHex,
        recolorPixeles: recolorPixeles, // núcleo puro, útil para pruebas
        cargarImagen: cargarImagen,
        recolorear: recolorear,
        muestrearColor: muestrearColor
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = global.RecolorService;
})(typeof window !== 'undefined' ? window : globalThis);
