// 🧮 CALCULADORA RÁPIDA GLOBAL
// ---------------------------------------------------------------------
// Roberto pidió un acceso directo para sumar/multiplicar sin salir de la
// app cuando está capturando un importe (pasa sobre todo en campos de
// pesos; en cantidades es mucho menos frecuente, pero funciona igual).
//
// Por qué NO se hizo "escribe la operación dentro del mismo campo":
// casi todos los campos de importe/cantidad en la app son
// <input type="number">, y ese tipo de campo bloquea a nivel de teclado
// los caracteres +, -, *, / — el navegador simplemente no los deja
// teclear ahí. Interceptar eso campo por campo habría significado tocar
// decenas de inputs en todos los módulos.
//
// Por qué NO es un botón flotante siempre visible: a Roberto le pareció
// invasivo tener un botón fijo en pantalla todo el tiempo. En vez de eso,
// un icono (🧮) aparece PEGADO al campo justo cuando lo seleccionas —
// ahí mismo, sin ocupar espacio el resto del tiempo — y desaparece al
// salir de ese campo (a menos que estés usando la calculadora).
//
// Autocontenido: no depende de StorageService ni de ningún otro módulo,
// así que puede cargarse en cualquier punto del <body>.
(function () {

    let campoDestino = null;   // <input> actualmente enfocado y elegible

    function esCampoElegible(el) {
        // 🛡️ Solo type="number": es el único caso real que motivó esta
        // calculadora (el navegador bloquea +-*/ ahí, ver comentario arriba).
        // Antes también enganchaba type="text" y type="tel", así que el
        // icono aparecía en CUALQUIER campo de texto de la app -incluido
        // el usuario del login (#loginEmail es type="text")- y estorbaba
        // al escribir nombre, dirección, notas, teléfono, etc. Ningún campo
        // de dinero/cantidad en la app usa type="text", así que restringir
        // aquí no deja ningún campo de importe sin calculadora.
        return el && el.tagName === 'INPUT' && el.type === 'number';
    }

    function esParteDeLaCalculadora(el) {
        return !!(el && el.closest && (el.closest('#calcRapidaIcono') || el.closest('#calcRapidaPanel')));
    }

    // ===== Evaluador seguro de expresiones (sin eval/Function) =====
    // Soporta + - * / % y paréntesis, con precedencia normal. Cualquier
    // caracter fuera de dígitos/operadores/paréntesis hace que se rechace
    // la expresión completa.
    function tokenizar(s) {
        const tokens = [];
        let i = 0;
        while (i < s.length) {
            const c = s[i];
            if (/\s/.test(c)) { i++; continue; }
            if (/[0-9.]/.test(c)) {
                let j = i;
                while (j < s.length && /[0-9.]/.test(s[j])) j++;
                const numStr = s.slice(i, j);
                if ((numStr.match(/\./g) || []).length > 1) throw new Error('número inválido');
                tokens.push({ t: 'num', v: parseFloat(numStr) });
                i = j;
                continue;
            }
            if ('+-*/().%'.includes(c)) { tokens.push({ t: c }); i++; continue; }
            throw new Error('carácter inválido: ' + c);
        }
        return tokens;
    }

    function parseExpr(tokens, pos) {
        let r = parseTerm(tokens, pos);
        let valor = r.valor; pos = r.pos;
        while (tokens[pos] && (tokens[pos].t === '+' || tokens[pos].t === '-')) {
            const op = tokens[pos].t; pos++;
            const r2 = parseTerm(tokens, pos);
            valor = op === '+' ? valor + r2.valor : valor - r2.valor;
            pos = r2.pos;
        }
        return { valor, pos };
    }

    function parseTerm(tokens, pos) {
        let r = parseFactor(tokens, pos);
        let valor = r.valor; pos = r.pos;
        while (tokens[pos] && (tokens[pos].t === '*' || tokens[pos].t === '/' || tokens[pos].t === '%')) {
            const op = tokens[pos].t; pos++;
            const r2 = parseFactor(tokens, pos);
            if (op === '*') valor = valor * r2.valor;
            else if (op === '/') { if (r2.valor === 0) throw new Error('división por cero'); valor = valor / r2.valor; }
            else valor = valor % r2.valor;
            pos = r2.pos;
        }
        return { valor, pos };
    }

    function parseFactor(tokens, pos) {
        if (tokens[pos] && tokens[pos].t === '-') {
            const r = parseFactor(tokens, pos + 1);
            return { valor: -r.valor, pos: r.pos };
        }
        if (tokens[pos] && tokens[pos].t === '+') {
            return parseFactor(tokens, pos + 1);
        }
        if (tokens[pos] && tokens[pos].t === '(') {
            const r = parseExpr(tokens, pos + 1);
            if (!tokens[r.pos] || tokens[r.pos].t !== ')') throw new Error('falta paréntesis');
            return { valor: r.valor, pos: r.pos + 1 };
        }
        if (tokens[pos] && tokens[pos].t === 'num') {
            return { valor: tokens[pos].v, pos: pos + 1 };
        }
        throw new Error('expresión inválida');
    }

    function evaluarExpresion(expr) {
        const limpio = String(expr || '').replace(/,/g, '').replace(/×/g, '*').replace(/÷/g, '/').trim();
        if (!limpio) return null;
        if (!/^[0-9+\-*/().%\s]+$/.test(limpio)) return null;
        try {
            const tokens = tokenizar(limpio);
            if (tokens.length === 0) return null;
            const { valor, pos } = parseExpr(tokens, 0);
            if (pos !== tokens.length) return null;
            return Number.isFinite(valor) ? valor : null;
        } catch (e) {
            return null;
        }
    }

    // ===== Construcción de la interfaz (una sola vez) =====
    let icono, panel, expr, resDiv, btnInsertar, resultadoActual = null;

    function crearUI() {
        if (document.getElementById('calcRapidaIcono')) return;

        icono = document.createElement('button');
        icono.id = 'calcRapidaIcono';
        icono.type = 'button';
        icono.title = 'Calculadora rápida';
        icono.textContent = '🧮';
        icono.style.cssText = 'position:fixed;display:none;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;background:#1e40af;color:white;border:none;font-size:15px;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.3);z-index:999999;padding:0;';
        // Evita que el input pierda el foco al tocar el icono (si no, el
        // campo hace blur antes del click y el icono se ocultaría solo).
        icono.addEventListener('mousedown', e => e.preventDefault());
        icono.addEventListener('click', togglePanel);
        document.body.appendChild(icono);

        panel = document.createElement('div');
        panel.id = 'calcRapidaPanel';
        panel.style.cssText = 'position:fixed;display:none;width:260px;max-width:calc(100vw - 24px);background:white;border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,0.32);z-index:999999;overflow:hidden;';
        panel.innerHTML = `
          <div style="background:#1e40af;color:white;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;">
            <strong style="font-size:14px;">🧮 Calculadora rápida</strong>
            <button id="calcRapidaCerrar" type="button" style="background:none;border:none;color:white;font-size:16px;cursor:pointer;line-height:1;">✕</button>
          </div>
          <div style="padding:12px;">
            <input id="calcRapidaExpr" type="text" inputmode="decimal" autocomplete="off" placeholder="Ej. 1500+320*2" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #d1d5db;border-radius:8px;font-size:16px;text-align:right;">
            <div id="calcRapidaResultado" style="min-height:20px;text-align:right;font-size:13px;color:#6b7280;margin-top:4px;">&nbsp;</div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px;">
              ${['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '-', '0', '.', 'C', '+'].map(t =>
                `<button type="button" class="calcRapidaTecla" data-val="${t}" style="padding:10px 0;border:1px solid #e5e7eb;border-radius:6px;background:#f9fafb;cursor:pointer;font-size:15px;font-weight:bold;color:${t === 'C' ? '#dc2626' : '#111827'};">${t}</button>`
              ).join('')}
              <button type="button" id="calcRapidaBorrar" style="padding:10px 0;border:1px solid #e5e7eb;border-radius:6px;background:#f9fafb;cursor:pointer;font-size:14px;">⌫</button>
              <button type="button" id="calcRapidaIgual" style="grid-column:span 3;padding:10px 0;border:none;border-radius:6px;background:#7c3aed;color:white;cursor:pointer;font-size:15px;font-weight:bold;">=</button>
            </div>
            <button type="button" id="calcRapidaInsertar" disabled style="width:100%;margin-top:10px;padding:11px;border:none;border-radius:8px;background:#16a34a;color:white;font-weight:bold;cursor:pointer;font-size:14px;opacity:0.5;">📥 Insertar en el campo</button>
          </div>`;
        document.body.appendChild(panel);
        // Igual que el icono: no se debe robar el foco del campo destino
        // al interactuar con la calculadora (salvo el input de expresión,
        // que sí necesita foco propio para escribir con el teclado).
        panel.addEventListener('mousedown', function (e) {
            if (e.target.id !== 'calcRapidaExpr') e.preventDefault();
        });

        expr = panel.querySelector('#calcRapidaExpr');
        resDiv = panel.querySelector('#calcRapidaResultado');
        btnInsertar = panel.querySelector('#calcRapidaInsertar');

        panel.querySelectorAll('.calcRapidaTecla').forEach(btn => {
            btn.addEventListener('click', function () {
                const val = this.getAttribute('data-val');
                expr.value = (val === 'C') ? '' : expr.value + val;
                actualizarResultado();
            });
        });

        panel.querySelector('#calcRapidaBorrar').addEventListener('click', function () {
            expr.value = expr.value.slice(0, -1);
            actualizarResultado();
        });

        panel.querySelector('#calcRapidaIgual').addEventListener('click', function () {
            if (resultadoActual !== null) { expr.value = String(resultadoActual); actualizarResultado(); }
        });

        expr.addEventListener('input', actualizarResultado);
        expr.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (resultadoActual !== null) { expr.value = String(resultadoActual); actualizarResultado(); }
            }
        });

        btnInsertar.addEventListener('click', function () {
            if (resultadoActual === null || !campoDestino) return;
            const redondeado = Math.round(resultadoActual * 100) / 100;
            campoDestino.value = (redondeado % 1 === 0) ? String(redondeado) : redondeado.toFixed(2);
            campoDestino.dispatchEvent(new Event('input', { bubbles: true }));
            campoDestino.dispatchEvent(new Event('change', { bubbles: true }));
            expr.value = '';
            resDiv.innerHTML = '&nbsp;';
            ocultarTodo();
        });

        panel.querySelector('#calcRapidaCerrar').addEventListener('click', cerrarPanel);
    }

    function actualizarResultado() {
        resultadoActual = evaluarExpresion(expr.value);
        if (resultadoActual === null) {
            resDiv.innerHTML = expr.value.trim() ? '⚠️ Operación no válida' : '&nbsp;';
            resDiv.style.color = '#dc2626';
            btnInsertar.disabled = true;
            btnInsertar.style.opacity = '0.5';
        } else {
            resDiv.textContent = '= ' + resultadoActual.toLocaleString('es-MX', { maximumFractionDigits: 2 });
            resDiv.style.color = '#16a34a';
            btnInsertar.disabled = false;
            btnInsertar.style.opacity = '1';
        }
    }

    // ===== Posicionamiento (junto al campo, sin salirse de la pantalla) =====
    // 🛡️ El icono NO se pone encima del área de texto del campo (antes se
    // superponía al borde derecho por dentro, y aunque se le sumaba padding
    // al input para compensar, en tablet terminaba tapando los últimos
    // dígitos capturados). Ahora flota como una insignia FUERA del
    // recuadro, pegada arriba del borde superior derecho; si no hay
    // espacio arriba (el campo está pegado al tope de la pantalla), se
    // pone abajo del borde inferior derecho en su lugar. Nunca cubre el
    // contenido del campo.
    function posicionarIcono() {
        if (!campoDestino) return;
        const r = campoDestino.getBoundingClientRect();
        const tam = 28, margen = 3;
        let left = r.right - tam;
        let top = (r.top - tam - margen >= margen) ? (r.top - tam - margen) : (r.bottom + margen);
        left = Math.min(Math.max(left, margen), window.innerWidth - tam - margen);
        top = Math.min(Math.max(top, margen), window.innerHeight - tam - margen);
        icono.style.left = left + 'px';
        icono.style.top = top + 'px';
    }

    function posicionarPanel() {
        const r = icono.getBoundingClientRect();
        const margen = 8;
        const anchoPanel = Math.min(260, window.innerWidth - margen * 2);
        panel.style.width = anchoPanel + 'px';
        let left = r.right - anchoPanel;
        left = Math.min(Math.max(left, margen), window.innerWidth - anchoPanel - margen);
        const altoEstimado = 330;
        let top;
        const espacioAbajo = window.innerHeight - r.bottom;
        if (espacioAbajo >= altoEstimado + margen || espacioAbajo >= r.top) {
            top = r.bottom + margen;
        } else {
            top = Math.max(margen, r.top - altoEstimado - margen);
        }
        panel.style.left = left + 'px';
        panel.style.top = top + 'px';
    }

    function mostrarIcono(input) {
        campoDestino = input;
        icono.style.display = 'flex';
        posicionarIcono();
    }

    function ocultarIcono() {
        icono.style.display = 'none';
        campoDestino = null;
    }

    function ocultarTodo() {
        cerrarPanel();
        ocultarIcono();
    }

    function togglePanel() {
        if (panel.style.display === 'block') { cerrarPanel(); return; }
        posicionarPanel();
        panel.style.display = 'block';
        expr.focus();
    }

    function cerrarPanel() {
        panel.style.display = 'none';
    }

    // ===== Enganche a los campos de la app =====
    document.addEventListener('focusin', function (e) {
        const el = e.target;
        if (esParteDeLaCalculadora(el)) return;
        if (esCampoElegible(el)) mostrarIcono(el);
        else if (campoDestino) ocultarTodo();
    });

    document.addEventListener('focusout', function (e) {
        if (e.target !== campoDestino) return;
        // Si el foco se va hacia el icono o el panel, no ocultar — ahí es
        // donde Roberto va a seguir interactuando.
        setTimeout(function () {
            const activo = document.activeElement;
            if (esParteDeLaCalculadora(activo)) return;
            ocultarTodo();
        }, 0);
    });

    // Reposicionar si la página hace scroll (incluye scroll dentro de
    // modales) o si cambia el tamaño de la ventana/teclado virtual.
    window.addEventListener('scroll', function () {
        if (campoDestino) { posicionarIcono(); if (panel.style.display === 'block') posicionarPanel(); }
    }, true);
    window.addEventListener('resize', function () {
        if (campoDestino) { posicionarIcono(); if (panel.style.display === 'block') posicionarPanel(); }
    });

    // Tocar fuera del campo/icono/panel cierra todo.
    document.addEventListener('mousedown', function (e) {
        if (!campoDestino) return;
        const el = e.target;
        if (el === campoDestino || esParteDeLaCalculadora(el)) return;
        ocultarTodo();
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', crearUI);
    } else {
        crearUI();
    }
})();
