// ===== AGENDA DE COBROS =====

let _agendaMesOffset = 0;

function renderAgendaCobros() {
    const cont = document.getElementById('contenidoAgenda');
    if (!cont) return;
    const hoy = new Date();
    const ref = new Date(hoy.getFullYear(), hoy.getMonth() + _agendaMesOffset, 1);
    const año = ref.getFullYear();
    const mes = ref.getMonth();
    const label = ref.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    const primerDia = new Date(año, mes, 1).getDay(); // 0=domingo
    const diasEnMes = new Date(año, mes + 1, 0).getDate();
    const pagares = StorageService.get('pagaresSistema', []);

    // Agrupar pagarés por día del mes
    const porDia = {};
    pagares.filter(p => p.estado !== 'Pagado').forEach(p => {
        const fv = new Date(p.fechaVencimiento);
        if (fv.getFullYear() === año && fv.getMonth() === mes) {
            const d = fv.getDate();
            if (!porDia[d]) porDia[d] = [];
            porDia[d].push(p);
        }
    });

    const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    const en7dias = new Date(hoy.getTime() + 7 * 24 * 3600 * 1000);

    // Encabezados de días
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const cabeceras = dias.map(d => `<div style="background:#1e40af;color:white;text-align:center;padding:8px;font-size:13px;font-weight:bold;">${d}</div>`).join('');

    // Celdas vacías iniciales
    let celdas = '';
    for (let i = 0; i < primerDia; i++) {
        celdas += `<div style="min-height:80px;background:#f9fafb;"></div>`;
    }

    for (let dia = 1; dia <= diasEnMes; dia++) {
        const fStr = `${año}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        const esHoy = fStr === hoyStr;
        const fDia = new Date(año, mes, dia);
        const lista = porDia[dia] || [];
        const total = lista.reduce((s, p) => s + (p.monto || 0), 0);
        let bgColor = '#fff';
        let borderColor = '#e5e7eb';
        if (lista.length > 0) {
            if (fDia < hoy) { bgColor = '#fef2f2'; borderColor = '#dc2626'; }
            else if (fDia.toDateString() === hoy.toDateString()) { bgColor = '#fff7ed'; borderColor = '#d97706'; }
            else if (fDia <= en7dias) { bgColor = '#f0fdf4'; borderColor = '#16a34a'; }
        }
        if (esHoy) { bgColor = '#eff6ff'; borderColor = '#1e40af'; }
        const badge = lista.length > 0
            ? `<div style="margin-top:6px;font-size:11px;"><div style="background:${borderColor};color:white;border-radius:10px;padding:2px 7px;display:inline-block;">${lista.length} pag. ${dinero(total)}</div></div>`
            : '';
        celdas += `<div onclick="abrirDiaAgenda('${fStr}')" style="min-height:80px;border:2px solid ${borderColor};background:${bgColor};border-radius:6px;padding:8px;cursor:${lista.length > 0 ? 'pointer' : 'default'};transition:box-shadow 0.15s;" ${lista.length > 0 ? `onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'" onmouseout="this.style.boxShadow=''"` : ''}>
          <div style="font-weight:bold;color:${esHoy ? '#1e40af' : '#374151'};font-size:14px;">${dia}</div>
          ${badge}
        </div>`;
    }

    cont.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <button onclick="_agendaMesOffset--;renderAgendaCobros();" style="padding:8px 16px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;font-size:18px;">◀</button>
        <h3 style="margin:0;color:#1e40af;text-transform:capitalize;">${label}</h3>
        <button onclick="_agendaMesOffset++;renderAgendaCobros();" style="padding:8px 16px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;font-size:18px;">▶</button>
      </div>
      <div style="background:white;padding:16px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px;">${cabeceras}</div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">${celdas}</div>
        <div style="margin-top:12px;display:flex;gap:16px;font-size:12px;">
          <span style="color:#dc2626;">🔴 Vencidos</span>
          <span style="color:#d97706;">🟠 Hoy</span>
          <span style="color:#16a34a;">🟢 Próximos 7 días</span>
        </div>
      </div>`;
}

function abrirDiaAgenda(fechaStr) {
    const pagares = StorageService.get('pagaresSistema', []);
    const cxc = StorageService.get('cuentasPorCobrar', []);
    const fecha = new Date(fechaStr + 'T00:00:00');
    const lista = pagares.filter(p => {
        const fv = new Date(p.fechaVencimiento);
        return fv.getFullYear() === fecha.getFullYear() &&
               fv.getMonth() === fecha.getMonth() &&
               fv.getDate() === fecha.getDate() &&
               p.estado !== 'Pagado';
    });
    if (lista.length === 0) return;
    const rows = lista.map(p => {
        const cuenta = cxc.find(c => c.folio === p.folio);
        return `<tr>
          <td style="padding:10px;">${p.folio}</td>
          <td style="padding:10px;">${cuenta ? cuenta.nombre : '-'}</td>
          <td style="padding:10px;text-align:right;">${dinero(p.monto || 0)}</td>
          <td style="padding:10px;text-align:center;"><span style="color:${p.estado==='Vencido'?'#dc2626':'#d97706'};font-weight:bold;">${p.estado}</span></td>
          <td style="padding:10px;text-align:center;">${cuenta ? `<button onclick="abrirModalAbonoAvanzado('${p.folio}')" style="padding:4px 10px;background:#16a34a;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">💰 Abonar</button>` : ''}</td>
        </tr>`;
    }).join('');
    const html = `
    <div data-modal="dia-agenda" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;">
      <div style="background:white;border-radius:12px;width:100%;max-width:700px;padding:28px;max-height:85vh;overflow-y:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h2 style="margin:0;color:#1e40af;">📅 Pagarés al ${fecha.toLocaleDateString('es-MX')}</h2>
          <button onclick="document.querySelector('[data-modal=dia-agenda]')?.remove()" style="background:none;border:none;font-size:22px;cursor:pointer;">✕</button>
        </div>
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead><tr style="background:#f3f4f6;">
              <th style="padding:10px;text-align:left;">Folio</th>
              <th style="padding:10px;text-align:left;">Cliente</th>
              <th style="padding:10px;text-align:right;">Monto</th>
              <th style="padding:10px;text-align:center;">Estado</th>
              <th style="padding:10px;text-align:center;">Acción</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

window.renderAgendaCobros = renderAgendaCobros;
window.abrirDiaAgenda = abrirDiaAgenda;
window._agendaMesOffset = _agendaMesOffset;
