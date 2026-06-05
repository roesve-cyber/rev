(function() {
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
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
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
function mmpGuardarDocumentoProfesionalImagen(){
    mmpCargarHtml2Canvas(function(){
        var node = document.querySelector('.mmp-professional-page') || document.body;
        var btn = document.getElementById('mmp-prof-btn-imagen');
        var old = btn ? btn.textContent : '';
        if (btn) { btn.disabled = true; btn.textContent = 'Generando...'; }
        html2canvas(node, { scale: 2, useCORS: true, allowTaint: false, backgroundColor: '#ffffff', logging: false }).then(function(canvas){
            var a = document.createElement('a');
            a.download = '${file}_profesional.png';
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
function mmpAbrirComprobanteProfesional(){
    var source = document.getElementById('ticket-contenido') || document.querySelector('.ticket-contenido') || document.querySelector('.mmp-ticket-body') || document.body;
    var clone = source.cloneNode(true);
    clone.querySelectorAll('script,style,button,.no-print,.mmp-print-toolbar').forEach(function(el){ el.remove(); });
    var titulo = document.title || 'Comprobante profesional';
    var css = '<style>' +
        '@page{size:letter portrait;margin:12mm}' +
        'html,body{margin:0;padding:0;background:#e2e8f0;color:#0f172a;font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
        '*{box-sizing:border-box}' +
        '.mmp-prof-toolbar{position:sticky;top:0;z-index:10;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;background:#e2e8f0;border-bottom:1px solid #cbd5e1;padding:12px}' +
        '.mmp-prof-toolbar button{border:0;border-radius:7px;padding:10px 15px;font-weight:800;cursor:pointer}' +
        '.mmp-professional-page{max-width:8in;margin:18px auto;background:white;padding:26px 32px;border-radius:10px;box-shadow:0 14px 28px rgba(15,23,42,.12)}' +
        '.mmp-prof-header{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;border-bottom:3px solid #1e40af;padding-bottom:14px;margin-bottom:18px}' +
        '.mmp-prof-brand{font-size:20px;font-weight:900;color:#0f172a;letter-spacing:.02em}.mmp-prof-sub{font-size:12px;color:#64748b;margin-top:4px}.mmp-prof-badge{background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;border-radius:999px;padding:7px 12px;font-size:12px;font-weight:900;text-align:right}' +
        '.mmp-prof-content{font-size:12px;line-height:1.45;color:#0f172a}.mmp-prof-content *{font-family:Arial,Helvetica,sans-serif!important;color:#0f172a!important;font-size:12px!important;line-height:1.42!important}.mmp-prof-content .centro{text-align:center!important}.mmp-prof-content .negrita,.mmp-prof-content b,.mmp-prof-content strong{font-weight:900!important}.mmp-prof-content table{width:100%!important;border-collapse:collapse!important;margin:10px 0!important}.mmp-prof-content th{background:#f8fafc!important;color:#475569!important;border-bottom:1px solid #cbd5e1!important;padding:7px!important}.mmp-prof-content td{border-bottom:1px solid #e2e8f0!important;padding:7px!important}.mmp-prof-content img{max-width:80px!important;max-height:70px!important;object-fit:contain!important}.mmp-prof-content .separador,.mmp-prof-content .sep{border-top:1px solid #cbd5e1!important;margin:14px 0!important}.mmp-prof-content .total-box{border:2px solid #0f172a!important;border-radius:8px!important;padding:12px!important;margin:14px 0!important;background:#f8fafc!important;text-align:center!important}' +
        '.mmp-prof-footer{margin-top:24px;display:grid;grid-template-columns:1fr 1fr;gap:18px;font-size:11px;color:#64748b}.mmp-sign{border-top:1px solid #0f172a;text-align:center;padding-top:8px;color:#0f172a;font-weight:800}' +
        '@media print{html,body{background:white}.mmp-prof-toolbar{display:none!important}.mmp-professional-page{box-shadow:none;border-radius:0;margin:0;max-width:none;padding:0}}' +
        '</style>';
    var script = '<script>' + mmpCargarHtml2Canvas.toString() + mmpGuardarDocumentoProfesionalImagen.toString() + '<\\/script>';
    var win = window.open('', '_blank');
    if (!win) { alert('Habilita las ventanas emergentes para abrir el comprobante profesional.'); return; }
    win.document.write('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>' + titulo + ' profesional</title>' + css + '</head><body>' +
        '<div class="mmp-prof-toolbar no-print"><button style="background:#1e40af;color:white" onclick="window.print()">Imprimir / PDF</button><button id="mmp-prof-btn-imagen" style="background:#047857;color:white" onclick="mmpGuardarDocumentoProfesionalImagen()">Guardar imagen</button></div>' +
        '<main class="mmp-professional-page"><header class="mmp-prof-header"><div><div class="mmp-prof-brand">Muebleria Mi Pueblito</div><div class="mmp-prof-sub">Comprobante documental generado desde el sistema</div></div><div class="mmp-prof-badge">Formato profesional</div></header><section class="mmp-prof-content">' + clone.innerHTML + '</section><footer class="mmp-prof-footer"><div>El contenido corresponde al mismo comprobante emitido en formato ticket.</div><div class="mmp-sign">Firma / Recibe</div></footer></main>' + script + '</body></html>');
    win.document.close();
    win.focus();
}
<\/script>`;
    }

    function toolbar() {
        return `
<div class="mmp-print-toolbar no-print">
    <button class="mmp-btn-print" onclick="window.print()">Imprimir / PDF</button>
    <button class="mmp-btn-print" onclick="mmpImprimirBluetooth()">Imprimir Bluetooth</button>
    <button class="mmp-btn-print" onclick="mmpAbrirComprobanteProfesional()">Comprobante profesional</button>
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
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
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
<\/script>`;
    }

    function documentToolbar(options = {}) {
        const imageButton = options.image === false ? '' : `<button id="mmp-doc-btn-imagen" class="mmp-btn-image" onclick="mmpGuardarDocumentoImagen()">Guardar imagen</button>`;
        return `
<div class="mmp-document-toolbar no-print">
    <button class="mmp-btn-print" onclick="window.print()">Imprimir / PDF</button>
    ${imageButton}
</div>`;
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
        if (!/mmp-print-toolbar/.test(out)) {
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
        if (!/mmp-document-toolbar/.test(out)) {
            out = out.replace(/<body[^>]*>/i, match => `${match}\n${documentToolbar(options)}`);
        }
        return out;
    }

    function openDocument(html, options = {}) {
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
        normalizeHtml,
        normalizeDocumentHtml,
        thermalCss
    };
})();
