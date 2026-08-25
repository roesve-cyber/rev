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
// En vez de eso: un botón flotante (🧮, siempre visible, por encima de
// cualquier modal) abre una calculadora aparte donde SÍ se puede escribir
// la operación completa. El resultado se inserta con un botón en el
// último campo numérico donde Roberto haya estado escribiendo — sin
// tener que salir de la app ni cambiar de ventana.
//
// Autocontenido: no depende de StorageService ni de ningún otro módulo,
// así que puede cargarse en cualquier punto del <body>.
(function () {

    // ===== Rastreo del último campo numérico enfocado =====
    let campoDestino = null;

    document.addEventListener('focusin', function (e) {
        const el = e.target;
        if (!el || !el.closest) return;
        if (el.closest('#calcRapidaPanel') || el.id === 'calcRapidaFab') return;
        if (el.tagName === 'INPUT' && (el.type === 'number' || el.type === 'text' || el.type === 'tel')) {
            campoDestino = el;
        }
    });

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

    // ===== Interfaz =====
    function crearUI() {
        if (document.getElementById('calcRapidaFab')) return;

        const fab = document.createElement('button');
        fab.id = 'calcRapidaFab';
        fab.type = 'button';
        fab.title = 'Calculadora rápida';
        fab.textContent = '🧮';
        fab.style.cssText = 'position:fixed;bottom:20px;right:20px;width:52px;height:52px;border-radius:50%;background:#1e40af;color:white;border:none;font-size:24px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.28);z-index:999999;display:flex;align-items:center;justify-content:center;';
        fab.addEventListener('click', abrirPanel);
        document.body.appendChild(fab);

        const panel = document.createElement('div');
        panel.id = 'calcRapidaPanel';
        panel.style.cssText = 'position:fixed;bottom:82px;right:20px;width:260px;max-width:calc(100vw - 24px);background:white;border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,0.32);z-index:999999;display:none;overflow:hidden;';
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
            <div id="calcRapidaHint" style="font-size:11px;color:#9ca3af;margin-top:6px;text-align:center;min-height:14px;"></div>
          </div>`;
        document.body.appendChild(panel);

        const expr = panel.querySelector('#calcRapidaExpr');
        const resDiv = panel.querySelector('#calcRapidaResultado');
        const btnInsertar = panel.querySelector('#calcRapidaInsertar');
        let resultadoActual = null;

        function actualizar() {
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

        panel.querySelectorAll('.calcRapidaTecla').forEach(btn => {
            btn.addEventListener('click', function () {
                const val = this.getAttribute('data-val');
                expr.value = (val === 'C') ? '' : expr.value + val;
                actualizar();
                expr.focus();
            });
        });

        panel.querySelector('#calcRapidaBorrar').addEventListener('click', function () {
            expr.value = expr.value.slice(0, -1);
            actualizar();
            expr.focus();
        });

        panel.querySelector('#calcRapidaIgual').addEventListener('click', function () {
            if (resultadoActual !== null) { expr.value = String(resultadoActual); actualizar(); }
        });

        expr.addEventListener('input', actualizar);
        expr.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (resultadoActual !== null) { expr.value = String(resultadoActual); actualizar(); }
            }
        });

        btnInsertar.addEventListener('click', function () {
            if (resultadoActual === null) return;
            if (!campoDestino || !document.body.contains(campoDestino)) {
                alert('Primero toca el campo donde quieres poner el resultado, y luego abre la calculadora de nuevo.');
                return;
            }
            const redondeado = Math.round(resultadoActual * 100) / 100;
            campoDestino.value = (redondeado % 1 === 0) ? String(redondeado) : redondeado.toFixed(2);
            campoDestino.dispatchEvent(new Event('input', { bubbles: true }));
            campoDestino.dispatchEvent(new Event('change', { bubbles: true }));
            cerrarPanel();
            expr.value = '';
            resDiv.innerHTML = '&nbsp;';
        });

        panel.querySelector('#calcRapidaCerrar').addEventListener('click', cerrarPanel);
    }

    function abrirPanel() {
        crearUI();
        const panel = document.getElementById('calcRapidaPanel');
        const hint = document.getElementById('calcRapidaHint');
        if (hint) hint.textContent = campoDestino ? '' : 'Toca un campo, luego abre la calculadora para poder insertar el resultado ahí.';
        panel.style.display = 'block';
        document.getElementById('calcRapidaExpr')?.focus();
    }

    function cerrarPanel() {
        const panel = document.getElementById('calcRapidaPanel');
        if (panel) panel.style.display = 'none';
    }

    // Cerrar al tocar fuera del panel/botón.
    document.addEventListener('click', function (e) {
        const panel = document.getElementById('calcRapidaPanel');
        if (!panel || panel.style.display === 'none') return;
        if (e.target.closest && (e.target.closest('#calcRapidaPanel') || e.target.closest('#calcRapidaFab'))) return;
        cerrarPanel();
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', crearUI);
    } else {
        crearUI();
    }
})();
