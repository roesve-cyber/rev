(function() {
    // html2canvas y jsPDF viven localmente en js/vendor (ya no dependen de un CDN externo).
    // Se resuelven a una URL absoluta porque estos scripts también se inyectan dentro de
    // ventanas emergentes (about:blank) para imprimir tickets/documentos, y ahí una ruta
    // relativa podría no resolver contra el archivo correcto.
    const VENDOR_HTML2CANVAS = new URL('js/vendor/html2canvas.min.js', document.baseURI).href;
    const VENDOR_JSPDF = new URL('js/vendor/jspdf.umd.min.js', document.baseURI).href;

    function esc(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[ch]));
    }

    function safeName(value) {
        return String(value || 'ticket')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9_-]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 80) || 'ticket';
    }

    function baseHref() {
        return window.location.href.split('?')[0].split('#')[0];
    }

    function thermalCss() {
        return `
<style id="mmp-thermal-80-style">
@page { size: 80mm auto; margin: 0; }
html, body {
    width: 80mm !important;
    max-width: 80mm !important;
    margin: 0 auto !important;
    padding: 0 !important;
    background: #fff !important;
    color: #000 !important;
    font-family: "Courier New", Courier, monospace !important;
    font-size: 11px !important;
    line-height: 1.22 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}
body { box-sizing: border-box !important; }
#ticket-contenido, .ticket-contenido, .mmp-ticket-body {
    width: 72mm !important;
    max-width: 72mm !important;
    margin: 0 auto !important;
    padding: 4mm 0 8mm !important;
    background: #fff !important;
    box-sizing: border-box !important;
}
* { box-sizing: border-box !important; }
#ticket-contenido > .no-print,
.ticket-contenido > .no-print,
.mmp-ticket-body > .no-print,
#ticket-contenido > .controles,
.ticket-contenido > .controles,
.mmp-ticket-body > .controles {
    display: none !important;
}
img { max-width: 22mm !important; max-height: 18mm !important; object-fit: contain !important; }
table { width: 100% !important; border-collapse: collapse !important; font-size: 10px !important; }
th, td { padding: 2px 1px !important; word-break: break-word !important; }
h1, h2, h3 { font-size: 13px !important; margin: 4px 0 !important; color: #000 !important; }
p { margin: 3px 0 !important; }
.no-print, .mmp-print-toolbar {
    width: 100% !important;
    background: #f1f5f9 !important;
    padding: 10px !important;
    margin: 0 0 8px !important;
    display: flex !important;
    justify-content: center !important;
    gap: 8px !important;
    flex-wrap: wrap !important;
}
.mmp-print-toolbar button, .no-print button {
    padding: 9px 12px !important;
    border: 0 !important;
    border-radius: 6px !important;
    font-weight: 700 !important;
    cursor: pointer !important;
}
.mmp-btn-print { background: #1e40af !important; color: #fff !important; }
.mmp-btn-image { background: #047857 !important; color: #fff !important; }
.mmp-cut { border-top: 1px dashed #000 !important; margin: 8px 0 !important; }
@media print {
    html, body { width: 80mm !important; margin: 0 !important; background: #fff !important; }
    .no-print, .mmp-print-toolbar { display: none !important; }
    #ticket-contenido, .ticket-contenido, .mmp-ticket-body { padding: 0 3mm 6mm !important; width: 80mm !important; max-width: 80mm !important; }
}
</style>`;
    }

    function imageScript(filename) {
        const file = safeName(filename);
        return `
<script>
function mmpCargarHtml2Canvas(cb){
    if (typeof html2canvas !== 'undefined') return cb();
    var existente = document.getElementById('mmp-html2canvas-loader');
    if (existente) { existente.addEventListener('load', cb, { once: true }); return; }
    var s = document.createElement('script');
    s.id = 'mmp-html2canvas-loader';
    s.src = VENDOR_HTML2CANVAS;
    s.onload = cb;
    s.onerror = function(){ alert('No se pudo cargar el motor de imagen. Usa Imprimir / Guardar como PDF.'); };
    document.head.appendChild(s);
}
function mmpGuardarTicketImagen(){
    mmpCargarHtml2Canvas(function(){
        var node = document.getElementById('ticket-contenido') || document.querySelector('.ticket-contenido') || document.querySelector('.mmp-ticket-body') || document.body;
        var btn = document.getElementById('mmp-btn-imagen');
        var old = btn ? btn.textContent : '';
        if (btn) { btn.disabled = true; btn.textContent = 'Generando...'; }
        html2canvas(node, { scale: 3, useCORS: true, allowTaint: false, backgroundColor: '#ffffff', logging: false }).then(function(canvas){
            var a = document.createElement('a');
            a.download = '${file}.png';
            a.href = canvas.toDataURL('image/png');
            a.click();
        }).catch(function(err){
            console.error(err);
            alert('No se pudo generar la imagen. Intenta imprimirlo a PDF.');
        }).finally(function(){
            if (btn) { btn.disabled = false; btn.textContent = old || 'Guardar imagen'; }
        });
    });
}
function mmpCargarJsPdf(cb){
    if (window.jspdf && window.jspdf.jsPDF) return cb();
    var existente = document.getElementById('mmp-jspdf-loader');
    if (existente) { existente.addEventListener('load', cb, { once: true }); return; }
    var s = document.createElement('script');
    s.id = 'mmp-jspdf-loader';
    s.src = VENDOR_JSPDF;
    s.onload = cb;
    s.onerror = function(){ alert('No se pudo cargar el motor PDF. Revisa tu conexion.'); };
    document.head.appendChild(s);
}
function mmpGuardarTicketPdf(){
    mmpCargarHtml2Canvas(function(){
        mmpCargarJsPdf(function(){
            var node = document.getElementById('ticket-contenido') || document.querySelector('.ticket-contenido') || document.querySelector('.mmp-ticket-body') || document.body;
            html2canvas(node, { scale: 3, useCORS: true, allowTaint: false, backgroundColor: '#ffffff', logging: false }).then(function(canvas){
                var width = 226.77;
                var margin = 8;
                var imgWidth = width - margin * 2;
                var imgHeight = canvas.height * imgWidth / canvas.width;
                var pdf = new window.jspdf.jsPDF({ unit:'pt', format:[width, Math.max(300, imgHeight + margin * 2)], orientation:'portrait' });
                pdf.addImage(canvas.toDataURL('image/jpeg', .94), 'JPEG', margin, margin, imgWidth, imgHeight, undefined, 'FAST');
                pdf.save('${file}.pdf');
            }).catch(function(err){ console.error(err); alert('No se pudo generar el PDF.'); });
        });
    });
}
function mmpBase64Url(text){
    var utf8 = unescape(encodeURIComponent(text || ''));
    return btoa(utf8).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/g, '');
}
function mmpTextoTicket(){
    var node = document.getElementById('ticket-contenido') || document.querySelector('.ticket-contenido') || document.querySelector('.mmp-ticket-body') || document.body;
    var clone = node.cloneNode(true);
    clone.querySelectorAll('script,style,button,.no-print,.mmp-print-toolbar').forEach(function(el){ el.remove(); });
    return (clone.innerText || clone.textContent || '').replace(/\\n{3,}/g, '\\n\\n').trim();
}
function mmpImprimirBluetooth(){
    var text = mmpTextoTicket();
    if (!text) { alert('No se encontro texto imprimible.'); return; }
    if (text.length > 7000 && !confirm('El ticket es largo y Android puede rechazar el envio por enlace. ¿Intentar de todos modos?')) return;
    window.location.href = 'mmpprinter://print?b64=' + mmpBase64Url(text);
}
<\/script>`;
    }

    function toolbar() {
        return `
<div class="mmp-print-toolbar no-print">
    <button class="mmp-btn-print" onclick="window.print()">Imprimir ticket</button>
    <button class="mmp-btn-print" onclick="mmpImprimirBluetooth()">Imprimir Bluetooth</button>
    <button class="mmp-btn-print" onclick="mmpGuardarTicketPdf()">Descargar PDF</button>
    <button id="mmp-btn-imagen" class="mmp-btn-image" onclick="mmpGuardarTicketImagen()">Guardar imagen</button>
</div>`;
    }

    function documentCss(options = {}) {
        const pageSize = options.pageSize === 'half-letter' ? '5.5in 8.5in' : 'letter portrait';
        const maxWidth = options.pageSize === 'half-letter' ? '5.2in' : '8in';
        return `
<style id="mmp-document-print-style">
@page { size: ${pageSize}; margin: ${options.margin || '12mm'}; }
html, body {
    margin: 0;
    padding: 0;
    background: #f1f5f9;
    color: #0f172a;
    font-family: Arial, Helvetica, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}
body { box-sizing: border-box; }
* { box-sizing: border-box; }
.mmp-document-body {
    width: 100%;
    max-width: ${maxWidth};
    margin: 0 auto;
    padding: 18px;
    background: #fff;
}
.mmp-document-toolbar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    justify-content: center;
    gap: 10px;
    flex-wrap: wrap;
    padding: 12px;
    background: #e2e8f0;
    border-bottom: 1px solid #cbd5e1;
}
.mmp-document-toolbar button {
    padding: 10px 16px;
    border: 0;
    border-radius: 7px;
    font-weight: 700;
    cursor: pointer;
}
.mmp-btn-print { background: #1e40af; color: #fff; }
.mmp-btn-image { background: #047857; color: #fff; }
.mmp-document-body .no-print,
.mmp-document-body .controles,
.mmp-document-body button[onclick="window.print()"],
.mmp-document-body button[onclick='window.print()'] {
    display: none !important;
}
table { max-width: 100%; }
img { max-width: 100%; }
@media print {
    html, body { background: #fff; }
    .no-print, .mmp-document-toolbar { display: none !important; }
    .mmp-document-body { max-width: none; padding: 0; margin: 0; }
}
</style>`;
    }

    function documentImageScript(filename) {
        const file = safeName(filename || 'documento');
        return `
<script>
function mmpCargarHtml2CanvasDocumento(cb){
    if (typeof html2canvas !== 'undefined') return cb();
    var existente = document.getElementById('mmp-html2canvas-loader');
    if (existente) { existente.addEventListener('load', cb, { once: true }); return; }
    var s = document.createElement('script');
    s.id = 'mmp-html2canvas-loader';
    s.src = VENDOR_HTML2CANVAS;
    s.onload = cb;
    s.onerror = function(){ alert('No se pudo cargar el motor de imagen. Usa Imprimir / Guardar como PDF.'); };
    document.head.appendChild(s);
}
function mmpGuardarDocumentoImagen(){
    mmpCargarHtml2CanvasDocumento(function(){
        var node = document.querySelector('.mmp-document-body') || document.body;
        var btn = document.getElementById('mmp-doc-btn-imagen');
        var old = btn ? btn.textContent : '';
        if (btn) { btn.disabled = true; btn.textContent = 'Generando...'; }
        html2canvas(node, { scale: 2, useCORS: true, allowTaint: false, backgroundColor: '#ffffff', logging: false }).then(function(canvas){
            var a = document.createElement('a');
            a.download = '${file}.png';
            a.href = canvas.toDataURL('image/png');
            a.click();
        }).catch(function(err){
            console.error(err);
            alert('No se pudo generar la imagen. Intenta imprimirlo a PDF.');
        }).finally(function(){
            if (btn) { btn.disabled = false; btn.textContent = old || 'Guardar imagen'; }
        });
    });
}
function mmpCargarJsPdfDocumento(cb){
    if (window.jspdf && window.jspdf.jsPDF) return cb();
    var existente = document.getElementById('mmp-jspdf-loader');
    if (existente) { existente.addEventListener('load', cb, { once: true }); return; }
    var s = document.createElement('script');
    s.id = 'mmp-jspdf-loader';
    s.src = VENDOR_JSPDF;
    s.onload = cb;
    s.onerror = function(){ alert('No se pudo cargar el motor PDF. Revisa tu conexion.'); };
    document.head.appendChild(s);
}
function mmpBloquesDePagina(root){
    var rectRoot = root.getBoundingClientRect();
    var bloques = [];
    function agregar(el){
        var r = el.getBoundingClientRect();
        if (r.height <= 0) return;
        bloques.push({ top: r.top - rectRoot.top, bottom: r.bottom - rectRoot.top });
    }
    Array.prototype.forEach.call(root.children, function(hijo){
        if (hijo.tagName === 'TABLE') {
            Array.prototype.forEach.call(hijo.querySelectorAll('tr'), agregar);
            return;
        }
        var tablas = hijo.querySelectorAll ? hijo.querySelectorAll('table') : [];
        if (tablas.length) {
            Array.prototype.forEach.call(tablas, function(t){
                Array.prototype.forEach.call(t.querySelectorAll('tr'), agregar);
            });
        } else {
            agregar(hijo);
        }
    });
    bloques.sort(function(a, b){ return a.bottom - b.bottom; });
    return bloques;
}
function mmpPuntosDeCorte(bloques, alturaTotal, capacidad){
    if (capacidad <= 0) return [0, alturaTotal];
    if (!bloques.length) {
        var cortes0 = [0], y0 = 0;
        while (y0 + capacidad < alturaTotal) { y0 += capacidad; cortes0.push(y0); }
        cortes0.push(alturaTotal);
        return cortes0;
    }
    var cortes = [0], inicio = 0, finValido = 0;
    for (var i = 0; i < bloques.length; i++) {
        var b = bloques[i];
        if (b.bottom - inicio > capacidad) {
            if (finValido > inicio) {
                cortes.push(finValido);
                inicio = finValido;
            }
            while (b.bottom - inicio > capacidad) {
                inicio += capacidad;
                cortes.push(inicio);
            }
        }
        finValido = b.bottom;
    }
    if (cortes[cortes.length - 1] < alturaTotal) cortes.push(alturaTotal);
    return cortes;
}
function mmpGuardarDocumentoPdf(){
    mmpCargarHtml2CanvasDocumento(function(){
        mmpCargarJsPdfDocumento(function(){
            var node = document.querySelector('.mmp-document-body') || document.body;
            var headerNode = node.querySelector('[data-pdf-header]');
            var pageWidth = 612, pageHeight = 792, margin = 24, gapEncabezado = 10;
            var usableWidth = pageWidth - margin * 2;

            function continuar(headerCanvas, headerAlturaPt){
                html2canvas(node, { scale: 2, useCORS: true, allowTaint: false, backgroundColor: '#ffffff', logging: false }).then(function(bodyCanvas){
                    var alturaTotalCss = node.scrollHeight;
                    var escalaCanvasPorCss = bodyCanvas.height / alturaTotalCss;
                    var ptPorCanvasPx = usableWidth / bodyCanvas.width;
                    var capacidadPt = pageHeight - margin * 2 - (headerCanvas ? headerAlturaPt + gapEncabezado : 0);
                    var capacidadCss = capacidadPt * (node.scrollWidth / usableWidth);
                    var bloques = mmpBloquesDePagina(node);
                    var cortes = mmpPuntosDeCorte(bloques, alturaTotalCss, Math.max(capacidadCss, 40));

                    var pdf = new window.jspdf.jsPDF({ unit:'pt', format:'letter', orientation:'portrait', compress:true });
                    for (var i = 0; i < cortes.length - 1; i++) {
                        if (i > 0) pdf.addPage('letter', 'portrait');
                        var cursorY = margin;
                        if (headerCanvas) {
                            pdf.addImage(headerCanvas.toDataURL('image/jpeg', .94), 'JPEG', margin, margin, usableWidth, headerAlturaPt, undefined, 'FAST');
                            cursorY = margin + headerAlturaPt + gapEncabezado;
                        }
                        var syCss = cortes[i], eyCss = cortes[i + 1];
                        var sy = Math.max(0, Math.round(syCss * escalaCanvasPorCss));
                        var sh = Math.max(1, Math.min(bodyCanvas.height - sy, Math.round((eyCss - syCss) * escalaCanvasPorCss)));
                        var recorte = document.createElement('canvas');
                        recorte.width = bodyCanvas.width; recorte.height = sh;
                        recorte.getContext('2d').drawImage(bodyCanvas, 0, sy, bodyCanvas.width, sh, 0, 0, bodyCanvas.width, sh);
                        var segAlturaPt = sh * ptPorCanvasPx;
                        pdf.addImage(recorte.toDataURL('image/jpeg', .94), 'JPEG', margin, cursorY, usableWidth, segAlturaPt, undefined, 'FAST');
                    }
                    var totalPaginas = pdf.internal.getNumberOfPages();
                    if (totalPaginas > 1) {
                        for (var p = 1; p <= totalPaginas; p++) {
                            pdf.setPage(p);
                            pdf.setFontSize(8);
                            pdf.setTextColor(120);
                            pdf.text('Pagina ' + p + ' de ' + totalPaginas, pageWidth - margin, pageHeight - 10, { align: 'right' });
                        }
                    }
                    pdf.save('${file}.pdf');
                }).catch(function(err){ console.error(err); alert('No se pudo generar el PDF.'); });
            }

            if (headerNode) {
                html2canvas(headerNode, { scale: 2, useCORS: true, allowTaint: false, backgroundColor: '#ffffff', logging: false }).then(function(headerCanvas){
                    var headerAlturaPt = headerCanvas.height * usableWidth / headerCanvas.width;
                    headerNode.style.display = 'none';
                    continuar(headerCanvas, headerAlturaPt);
                }).catch(function(err){ console.error(err); continuar(null, 0); });
            } else {
                continuar(null, 0);
            }
        });
    });
}

function mmpAbrirDocumentoTermico(){
    var source = document.querySelector('.mmp-document-body') || document.body;
    var clone = source.cloneNode(true);
    clone.querySelectorAll('script,style,button,.no-print,.mmp-document-toolbar,.mmp-print-toolbar').forEach(function(el){ el.remove(); });
    var titulo = document.title || 'Ticket termico';
    var css = ${JSON.stringify(thermalCss())};
    var file = '${file}_termico';
    var script = '<script>' +
        'function mmpCargarHtml2Canvas(cb){if(typeof html2canvas!==\"undefined\")return cb();var s=document.createElement(\"script\");s.src=\"' + VENDOR_HTML2CANVAS + '\";s.onload=cb;s.onerror=function(){alert(\"No se pudo cargar el motor de imagen. Usa Imprimir / Guardar como PDF.\");};document.head.appendChild(s);}' +
        'function mmpGuardarTicketImagen(){mmpCargarHtml2Canvas(function(){var node=document.getElementById(\"ticket-contenido\")||document.body;html2canvas(node,{scale:3,useCORS:true,allowTaint:false,backgroundColor:\"#ffffff\",logging:false}).then(function(canvas){var a=document.createElement(\"a\");a.download=\"' + file + '.png\";a.href=canvas.toDataURL(\"image/png\");a.click();}).catch(function(){alert(\"No se pudo generar la imagen. Intenta imprimirlo a PDF.\");});});}' +
        'function mmpCargarJsPdf(cb){if(window.jspdf&&window.jspdf.jsPDF)return cb();var s=document.createElement(\"script\");s.src=\"' + VENDOR_JSPDF + '\";s.onload=cb;s.onerror=function(){alert(\"No se pudo cargar el motor PDF.\");};document.head.appendChild(s);}' +
        'function mmpGuardarTicketPdf(){mmpCargarHtml2Canvas(function(){mmpCargarJsPdf(function(){var node=document.getElementById(\"ticket-contenido\")||document.body;html2canvas(node,{scale:3,useCORS:true,allowTaint:false,backgroundColor:\"#ffffff\",logging:false}).then(function(canvas){var w=226.77,m=8,iw=w-m*2,ih=canvas.height*iw/canvas.width;var pdf=new window.jspdf.jsPDF({unit:\"pt\",format:[w,Math.max(300,ih+m*2)],orientation:\"portrait\"});pdf.addImage(canvas.toDataURL(\"image/jpeg\",.94),\"JPEG\",m,m,iw,ih,undefined,\"FAST\");pdf.save(\"' + file + '.pdf\");}).catch(function(){alert(\"No se pudo generar el PDF.\");});});});}' +
        'function mmpBase64Url(text){var utf8=unescape(encodeURIComponent(text||\"\"));return btoa(utf8).replace(/\\\\+/g,\"-\").replace(/\\\\//g,\"_\").replace(/=+$/g,\"\");}' +
        'function mmpTextoTicket(){var node=document.getElementById(\"ticket-contenido\")||document.body;var c=node.cloneNode(true);c.querySelectorAll(\"script,style,button,.no-print,.mmp-print-toolbar\").forEach(function(el){el.remove();});return (c.innerText||c.textContent||\"\").replace(/\\\\n{3,}/g,\"\\\\n\\\\n\").trim();}' +
        'function mmpImprimirBluetooth(){var text=mmpTextoTicket();if(!text){alert(\"No se encontro texto imprimible.\");return;}if(text.length>7000&&!confirm(\"El ticket es largo y Android puede rechazar el envio por enlace. Intentar de todos modos?\"))return;window.location.href=\"mmpprinter://print?b64=\"+mmpBase64Url(text);}' +
        '<\\/script>';
    var win = window.open('', '_blank');
    if (!win) { alert('Habilita las ventanas emergentes para abrir el ticket termico.'); return; }
    win.document.write('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>' + titulo + ' termico</title>' + css + script + '</head><body><div class="mmp-print-toolbar no-print"><button class="mmp-btn-print" onclick="window.print()">Imprimir ticket</button><button class="mmp-btn-print" onclick="mmpImprimirBluetooth()">Imprimir Bluetooth</button><button class="mmp-btn-print" onclick="mmpGuardarTicketPdf()">Descargar PDF</button><button id="mmp-btn-imagen" class="mmp-btn-image" onclick="mmpGuardarTicketImagen()">Guardar imagen</button></div><div id="ticket-contenido" class="mmp-ticket-body">' + clone.innerHTML + '</div></body></html>');
    win.document.close();
    win.focus();
}
<\/script>`;
    }

function documentToolbar(options = {}) {
        const imageButton = options.image === false ? '' : `<button id="mmp-doc-btn-imagen" class="mmp-btn-image" onclick="mmpGuardarDocumentoImagen()">Guardar imagen</button>`;
        const thermalButton = options.thermal === false ? '' : `<button class="mmp-btn-print" onclick="mmpAbrirDocumentoTermico()">Ticket termico</button>`;
        return `
<div class="mmp-document-toolbar no-print">
    <button id="mmp-doc-btn-pdf" class="mmp-btn-print" onclick="mmpGuardarDocumentoPdf()">Descargar PDF</button>
    ${imageButton}
    ${thermalButton}
</div>`;
    }

    function cargarScriptGlobal(id, src, disponible) {
        if (disponible()) return Promise.resolve();
        // Si ya existe una etiqueta <script> con este id, es de un intento anterior. Los eventos
        // load/error de un <script> sólo se disparan UNA vez: si ese intento ya falló (por
        // ejemplo, sin conexión), volver a escuchar esos mismos eventos aquí nunca se cumple y
        // la promesa se queda colgada para siempre ("Generando PDF..." pasmado). Por eso siempre
        // partimos de una etiqueta nueva en cada intento.
        document.getElementById(id)?.remove();
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                script.remove();
                reject(new Error(`Tiempo de espera agotado al cargar ${src}`));
            }, 15000);
            const script = document.createElement('script');
            script.id = id;
            script.src = src;
            script.onload = () => { clearTimeout(timeout); resolve(); };
            script.onerror = () => { clearTimeout(timeout); script.remove(); reject(new Error(`No se pudo cargar ${src}`)); };
            document.head.appendChild(script);
        });
    }

    // ===== PAGINACIÓN CORRECTA PARA PDF MULTI-HOJA =====
    // En vez de rebanar la captura completa cada X puntos fijos (lo cual puede partir una
    // fila de tabla o un párrafo justo a la mitad), buscamos los límites reales de los
    // bloques del documento (hijos directos, y filas de tabla a detalle) y solo cortamos
    // de hoja en los límites entre bloques, nunca dentro de uno.
    function _bloquesDePagina(root) {
        const rectRoot = root.getBoundingClientRect();
        const bloques = [];
        function agregar(el) {
            const r = el.getBoundingClientRect();
            if (r.height <= 0) return;
            bloques.push({ top: r.top - rectRoot.top, bottom: r.bottom - rectRoot.top });
        }
        Array.from(root.children).forEach(hijo => {
            if (hijo.tagName === 'TABLE') {
                Array.from(hijo.querySelectorAll('tr')).forEach(agregar);
                return;
            }
            const tablas = hijo.querySelectorAll ? Array.from(hijo.querySelectorAll('table')) : [];
            if (tablas.length) {
                tablas.forEach(t => Array.from(t.querySelectorAll('tr')).forEach(agregar));
            } else {
                agregar(hijo);
            }
        });
        bloques.sort((a, b) => a.bottom - b.bottom);
        return bloques;
    }

    function _puntosDeCorte(bloques, alturaTotal, capacidad) {
        if (capacidad <= 0) return [0, alturaTotal];
        if (!bloques.length) {
            // Sin bloques identificables: corte uniforme clásico (nunca perdemos contenido)
            const cortes = [0];
            let y = 0;
            while (y + capacidad < alturaTotal) { y += capacidad; cortes.push(y); }
            cortes.push(alturaTotal);
            return cortes;
        }
        const cortes = [0];
        let inicio = 0;
        let finValido = 0;
        for (let i = 0; i < bloques.length; i++) {
            const b = bloques[i];
            if (b.bottom - inicio > capacidad) {
                if (finValido > inicio) {
                    cortes.push(finValido);
                    inicio = finValido;
                }
                // Si el bloque sigue sin caber solo (es más alto que una hoja completa),
                // lo partimos a la fuerza cada "capacidad" para nunca perder contenido.
                while (b.bottom - inicio > capacidad) {
                    inicio += capacidad;
                    cortes.push(inicio);
                }
            }
            finValido = b.bottom;
        }
        if (cortes[cortes.length - 1] < alturaTotal) cortes.push(alturaTotal);
        return cortes;
    }

    async function _renderCanvas(node) {
        return await window.html2canvas(node, {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#ffffff',
            logging: false,
            windowWidth: Math.max(node.scrollWidth, 800),
            windowHeight: Math.max(node.scrollHeight, 1000)
        });
    }

    async function _prepararDomParaPdf(html, options = {}) {
        await cargarScriptGlobal(
            'mmp-html2canvas-global',
            VENDOR_HTML2CANVAS,
            () => typeof window.html2canvas === 'function'
        );

        const iframe = document.createElement('iframe');
        iframe.setAttribute('aria-hidden', 'true');
        iframe.style.cssText = 'position:fixed;left:-100000px;top:0;width:900px;height:1200px;border:0;opacity:0;pointer-events:none;';
        document.body.appendChild(iframe);

        const doc = iframe.contentDocument;
        const contenido = normalizeDocumentHtml(html, {
            ...options,
            autoPrint: false,
            autoImage: false,
            thermal: false,
            image: false
        });
        doc.open();
        doc.write(contenido);
        doc.close();

        await new Promise(resolve => {
            if (doc.readyState === 'complete') resolve();
            else iframe.addEventListener('load', resolve, { once: true });
        });
        doc.querySelectorAll('.mmp-document-toolbar,.mmp-print-toolbar,.no-print,script').forEach(el => el.remove());
        await Promise.all(Array.from(doc.images || []).map(img => img.complete
            ? Promise.resolve()
            : new Promise(resolve => {
                img.addEventListener('load', resolve, { once: true });
                img.addEventListener('error', resolve, { once: true });
            })));
        if (doc.fonts?.ready) {
            try { await doc.fonts.ready; } catch {}
        }

        const node = doc.querySelector('.mmp-document-body') ||
            doc.getElementById('ticket-contenido') ||
            doc.querySelector('.ticket-contenido,.mmp-ticket-body') ||
            doc.body;
        const headerNode = node.querySelector('[data-pdf-header]');
        return { iframe, doc, node, headerNode };
    }

    async function prepararCanvasDocumento(html, options = {}) {
        await cargarScriptGlobal(
            'mmp-html2canvas-global',
            VENDOR_HTML2CANVAS,
            () => typeof window.html2canvas === 'function'
        );

        const iframe = document.createElement('iframe');
        iframe.setAttribute('aria-hidden', 'true');
        iframe.style.cssText = 'position:fixed;left:-100000px;top:0;width:900px;height:1200px;border:0;opacity:0;pointer-events:none;';
        document.body.appendChild(iframe);

        const doc = iframe.contentDocument;
        const contenido = normalizeDocumentHtml(html, {
            ...options,
            autoPrint: false,
            autoImage: false,
            thermal: false,
            image: false
        });
        doc.open();
        doc.write(contenido);
        doc.close();

        await new Promise(resolve => {
            if (doc.readyState === 'complete') resolve();
            else iframe.addEventListener('load', resolve, { once: true });
        });
        doc.querySelectorAll('.mmp-document-toolbar,.mmp-print-toolbar,.no-print,script').forEach(el => el.remove());
        await Promise.all(Array.from(doc.images || []).map(img => img.complete
            ? Promise.resolve()
            : new Promise(resolve => {
                img.addEventListener('load', resolve, { once: true });
                img.addEventListener('error', resolve, { once: true });
            })));
        if (doc.fonts?.ready) {
            try { await doc.fonts.ready; } catch {}
        }

        const node = doc.querySelector('.mmp-document-body') ||
            doc.getElementById('ticket-contenido') ||
            doc.querySelector('.ticket-contenido,.mmp-ticket-body') ||
            doc.body;
        const canvas = await window.html2canvas(node, {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#ffffff',
            logging: false,
            windowWidth: Math.max(node.scrollWidth, 800),
            windowHeight: Math.max(node.scrollHeight, 1000)
        });
        iframe.remove();
        return canvas;
    }

    function mostrarGenerando(texto) {
        document.querySelector('[data-mmp-generando-documento]')?.remove();
        document.body.insertAdjacentHTML('beforeend', `<div data-mmp-generando-documento style="position:fixed;inset:0;background:rgba(15,23,42,.48);z-index:130000;display:flex;align-items:center;justify-content:center;"><div style="background:white;border-radius:8px;padding:18px 24px;color:#0f172a;font-weight:900;box-shadow:0 18px 45px rgba(15,23,42,.25);">${esc(texto)}</div></div>`);
    }

    function ocultarGenerando() {
        document.querySelector('[data-mmp-generando-documento]')?.remove();
    }

    async function descargarImagen(html, options = {}) {
        mostrarGenerando('Generando imagen...');
        try {
            const canvas = await prepararCanvasDocumento(html, options);
            const a = document.createElement('a');
            a.download = `${safeName(options.filename || options.title || 'documento')}.png`;
            a.href = canvas.toDataURL('image/png');
            a.click();
            return true;
        } catch (err) {
            console.error('No se pudo generar la imagen:', err);
            alert('No se pudo generar la imagen. Revisa tu conexion e intenta de nuevo.');
            return false;
        } finally {
            ocultarGenerando();
        }
    }

    async function descargarPdf(html, options = {}) {
        mostrarGenerando('Generando PDF...');
        let iframe = null;
        try {
            await cargarScriptGlobal(
                'mmp-jspdf-global',
                VENDOR_JSPDF,
                () => !!window.jspdf?.jsPDF
            );
            const prep = await _prepararDomParaPdf(html, options);
            iframe = prep.iframe;
            const jsPDF = window.jspdf.jsPDF;
            const half = options.pageSize === 'half-letter';
            const pageWidth = half ? 396 : 612;
            const pageHeight = half ? 612 : 792;
            const margin = 24;
            const gapEncabezado = 10;
            const usableWidth = pageWidth - margin * 2;

            // Si el documento marca un bloque con [data-pdf-header], lo capturamos aparte
            // y lo repetimos arriba de cada hoja; el cuerpo se captura sin él.
            let headerCanvas = null, headerImgHeightPt = 0;
            if (prep.headerNode) {
                headerCanvas = await _renderCanvas(prep.headerNode);
                headerImgHeightPt = headerCanvas.height * usableWidth / headerCanvas.width;
                prep.headerNode.style.display = 'none';
            }

            const bodyCanvas = await _renderCanvas(prep.node);
            const alturaTotalCss = prep.node.scrollHeight;
            const escalaCanvasPorCss = bodyCanvas.height / alturaTotalCss;
            const ptPorCanvasPx = usableWidth / bodyCanvas.width;

            const capacidadPt = pageHeight - margin * 2 - (headerCanvas ? headerImgHeightPt + gapEncabezado : 0);
            const capacidadCss = capacidadPt * (prep.node.scrollWidth / usableWidth);

            const bloques = _bloquesDePagina(prep.node);
            const cortesCss = _puntosDeCorte(bloques, alturaTotalCss, Math.max(capacidadCss, 40));

            const pdf = new jsPDF({ unit: 'pt', format: half ? [pageWidth, pageHeight] : 'letter', orientation: 'portrait', compress: true });

            for (let i = 0; i < cortesCss.length - 1; i++) {
                if (i > 0) pdf.addPage(half ? [pageWidth, pageHeight] : 'letter', 'portrait');
                let cursorY = margin;
                if (headerCanvas) {
                    const headerData = headerCanvas.toDataURL('image/jpeg', 0.94);
                    pdf.addImage(headerData, 'JPEG', margin, margin, usableWidth, headerImgHeightPt, undefined, 'FAST');
                    cursorY = margin + headerImgHeightPt + gapEncabezado;
                }
                const syCss = cortesCss[i], eyCss = cortesCss[i + 1];
                const sy = Math.max(0, Math.round(syCss * escalaCanvasPorCss));
                const sh = Math.max(1, Math.min(bodyCanvas.height - sy, Math.round((eyCss - syCss) * escalaCanvasPorCss)));
                const recorte = document.createElement('canvas');
                recorte.width = bodyCanvas.width;
                recorte.height = sh;
                recorte.getContext('2d').drawImage(bodyCanvas, 0, sy, bodyCanvas.width, sh, 0, 0, bodyCanvas.width, sh);
                const segData = recorte.toDataURL('image/jpeg', 0.94);
                const segAlturaPt = sh * ptPorCanvasPx;
                pdf.addImage(segData, 'JPEG', margin, cursorY, usableWidth, segAlturaPt, undefined, 'FAST');
            }

            const totalPaginas = pdf.internal.getNumberOfPages();
            if (totalPaginas > 1) {
                for (let i = 1; i <= totalPaginas; i++) {
                    pdf.setPage(i);
                    pdf.setFontSize(8);
                    pdf.setTextColor(120);
                    pdf.text(`Página ${i} de ${totalPaginas}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
                }
            }

            pdf.save(`${safeName(options.filename || options.title || 'documento')}.pdf`);
            return true;
        } catch (err) {
            console.error('No se pudo generar el PDF:', err);
            alert('No se pudo generar el PDF. Revisa tu conexion e intenta de nuevo.');
            return false;
        } finally {
            iframe?.remove();
            ocultarGenerando();
        }
    }

    function elegirFormato({ html = '', title = 'Documento', filename = '', source = 'document', pageSize = 'letter' } = {}) {
        const modalId = `mmp-formato-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const config = { html: String(html || ''), title, filename: filename || title, source, pageSize };
        window._mmpDocumentosPendientes = window._mmpDocumentosPendientes || {};
        window._mmpDocumentosPendientes[modalId] = config;
        document.querySelector('[data-modal="mmp-formato-documento"]')?.remove();
        document.body.insertAdjacentHTML('beforeend', `
            <div data-modal="mmp-formato-documento" data-id="${esc(modalId)}" style="position:fixed;inset:0;background:rgba(15,23,42,.72);z-index:120000;display:flex;align-items:center;justify-content:center;padding:18px;">
                <div style="width:100%;max-width:520px;background:white;border-radius:8px;padding:24px;box-shadow:0 24px 55px rgba(15,23,42,.3);">
                    <h3 style="margin:0;color:#0f172a;">Emitir documento</h3>
                    <p style="margin:6px 0 20px;color:#64748b;font-size:13px;">${esc(title)}</p>
                    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;">
                        <button onclick="TicketService.abrirFormato('${esc(modalId)}','pdf')" style="padding:16px 8px;border:0;border-radius:7px;background:#1e40af;color:white;font-weight:900;cursor:pointer;">PDF</button>
                        <button onclick="TicketService.abrirFormato('${esc(modalId)}','ticket')" style="padding:16px 8px;border:0;border-radius:7px;background:#7c3aed;color:white;font-weight:900;cursor:pointer;">Ticket</button>
                        <button onclick="TicketService.abrirFormato('${esc(modalId)}','imagen')" style="padding:16px 8px;border:0;border-radius:7px;background:#047857;color:white;font-weight:900;cursor:pointer;">Imagen</button>
                    </div>
                    <button onclick="TicketService.cerrarSelectorFormato('${esc(modalId)}')" style="width:100%;margin-top:12px;padding:10px;border:0;border-radius:7px;background:#e2e8f0;color:#334155;font-weight:bold;cursor:pointer;">Cancelar</button>
                </div>
            </div>`);
        return true;
    }

    function cerrarSelectorFormato(id) {
        document.querySelector('[data-modal="mmp-formato-documento"]')?.remove();
        if (window._mmpDocumentosPendientes) delete window._mmpDocumentosPendientes[id];
    }

    function abrirFormato(id, formato) {
        const cfg = window._mmpDocumentosPendientes?.[id];
        if (!cfg) return false;
        document.querySelector('[data-modal="mmp-formato-documento"]')?.remove();
        let resultado = false;
        if (formato === 'ticket') {
            resultado = openHtml(cfg.html, { title: cfg.title, filename: cfg.filename });
        } else if (formato === 'pdf') {
            resultado = descargarPdf(cfg.html, cfg);
        } else if (formato === 'imagen') {
            resultado = descargarImagen(cfg.html, cfg);
        }
        delete window._mmpDocumentosPendientes[id];
        return resultado;
    }

    function normalizeHtml(html, options = {}) {
        let out = String(html || '');
        const title = esc(options.title || 'Ticket');
        const filename = options.filename || title;

        if (!/<html[\s>]/i.test(out)) {
            out = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${title}</title></head><body><div id="ticket-contenido">${out}</div></body></html>`;
        }

        if (!/<base\s/i.test(out)) {
            out = out.replace(/<head[^>]*>/i, match => `${match}\n<base href="${esc(baseHref())}">`);
        }
        if (!/<title>/i.test(out)) {
            out = out.replace(/<head[^>]*>/i, match => `${match}\n<title>${title}</title>`);
        }
        if (!/mmp-thermal-80-style/.test(out)) {
            out = out.replace(/<\/head>/i, `${thermalCss()}\n${imageScript(filename)}\n</head>`);
        }
        if (!/class=["'][^"']*\bmmp-print-toolbar\b/i.test(out)) {
            out = out.replace(/<body[^>]*>/i, match => `${match}\n${toolbar()}`);
        }
        return out;
    }

    function openHtml(html, options = {}) {
        const w = window.open('', '_blank');
        if (!w) {
            alert('Habilita las ventanas emergentes para imprimir el ticket.');
            return false;
        }
        w.document.write(normalizeHtml(html, options));
        w.document.close();
        w.focus();
        return true;
    }

    function normalizeDocumentHtml(html, options = {}) {
        let out = String(html || '');
        const title = esc(options.title || 'Documento');
        const filename = options.filename || title;

        if (!/<html[\s>]/i.test(out)) {
            out = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${title}</title></head><body><div class="mmp-document-body">${out}</div></body></html>`;
        }

        if (!/<base\s/i.test(out)) {
            out = out.replace(/<head[^>]*>/i, match => `${match}\n<base href="${esc(baseHref())}">`);
        }
        if (!/<title>/i.test(out)) {
            out = out.replace(/<head[^>]*>/i, match => `${match}\n<title>${title}</title>`);
        }
        if (!/mmp-document-print-style/.test(out)) {
            out = out.replace(/<\/head>/i, `${documentCss(options)}\n${documentImageScript(filename)}\n</head>`);
        }
        if (!/mmp-document-body/.test(out)) {
            out = out.replace(/<body([^>]*)>/i, '<body$1><div class="mmp-document-body">')
                     .replace(/<\/body>/i, '</div></body>');
        }
        if (!/class=["'][^"']*\bmmp-document-toolbar\b/i.test(out)) {
            out = out.replace(/<body[^>]*>/i, match => `${match}\n${documentToolbar(options)}`);
        }
        if (options.autoPrint && !/mmp-auto-print/.test(out)) {
            out = out.replace(/<\/body>/i, `<script id="mmp-auto-print">window.addEventListener('load',function(){setTimeout(function(){if(typeof mmpGuardarDocumentoPdf==='function')mmpGuardarDocumentoPdf();},650);});<\/script></body>`);
        }
        if (options.autoImage && !/mmp-auto-image/.test(out)) {
            out = out.replace(/<\/body>/i, `<script id="mmp-auto-image">window.addEventListener('load',function(){setTimeout(function(){if(typeof mmpGuardarDocumentoImagen==='function')mmpGuardarDocumentoImagen();},650);});<\/script></body>`);
        }
        return out;
    }

    function openDocument(html, options = {}) {
        if (options.autoPrint) {
            return descargarPdf(html, options);
        }
        if (options.autoImage) {
            return descargarImagen(html, options);
        }
        const w = window.open('', '_blank');
        if (!w) {
            alert('Habilita las ventanas emergentes para imprimir el documento.');
            return false;
        }
        w.document.write(normalizeDocumentHtml(html, options));
        w.document.close();
        w.focus();
        return true;
    }

    function openThermal({ title = 'Ticket', filename = '', body = '' } = {}) {
        const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${esc(title)}</title></head><body><div id="ticket-contenido" class="mmp-ticket-body">${body}</div></body></html>`;
        return openHtml(html, { title, filename: filename || title });
    }

    window.TicketService = {
        esc,
        safeName,
        openHtml,
        openDocument,
        openThermal,
        descargarPdf,
        descargarImagen,
        elegirFormato,
        abrirFormato,
        cerrarSelectorFormato,
        normalizeHtml,
        normalizeDocumentHtml,
        thermalCss
    };
})();
