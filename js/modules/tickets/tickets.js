// ===== GENERADOR DE TICKETS =====
function generarTicketMediaHoja(datosVenta) {
    const folio = datosVenta.folio;
    const fechaActual = datosVenta.fecha;
    
    let tablaProductos = '';
    datosVenta.articulos.forEach(art => {
        const cantidad = art.cantidad || 1;
        const subtotal = (art.precioContado || 0) * cantidad;
        tablaProductos += `
            <tr>
                <td style="border: 1px solid #333; padding: 8px; text-align: center;">${cantidad}</td>
                <td style="border: 1px solid #333; padding: 8px;">${art.nombre}</td>
                <td style="border: 1px solid #333; padding: 8px; text-align: right;">${dinero(art.precioContado)}</td>
                <td style="border: 1px solid #333; padding: 8px; text-align: right;">${dinero(subtotal)}</td>
            </tr>
        `;
    });

    let tablaPagares = '';
    let totalAPagar = 0;

    if (datosVenta.metodo === "credito" && datosVenta.plan) {
        const pagares = StorageService.get("pagaresSistema", []);
        const pagaresDelFolio = pagares.filter(p => p.folio === folio);

        pagaresDelFolio.forEach((pagar, index) => {
            const fechaPago = new Date(pagar.fechaVencimiento);
            const fechaFormato = fechaPago.toLocaleDateString('es-MX');
            totalAPagar += pagar.monto;
            
            tablaPagares += `
                <tr>
                    <td style="border: 1px solid #333; padding: 6px; text-align: center; font-weight: bold;">${index + 1}</td>
                    <td style="border: 1px solid #333; padding: 6px; text-align: center;">${fechaFormato}</td>
                    <td style="border: 1px solid #333; padding: 6px; text-align: right; font-weight: bold;">${dinero(pagar.monto)}</td>
                    <td style="border: 1px solid #333; padding: 6px; text-align: center;">__________</td>
                    <td style="border: 1px solid #333; padding: 6px; text-align: center;">__________</td>
                    <td style="border: 1px solid #333; padding: 6px; text-align: center;">__________</td>
                </tr>
            `;
        });
    }

    const planesDisponibles = CalculatorService.calcularCredito(datosVenta.total);
    let tablaPlanes = '';
    planesDisponibles.forEach(plan => {
        const textoMeses = plan.meses === 1 ? `${plan.meses} MES (Contado)` : `${plan.meses} MESES`;
        const textoInteres = plan.meses === 1 ? '(Sin interés)' : '(Total)';
        tablaPlanes += `
            <td style="border: 1px solid #333; padding: 8px; text-align: center;">
                <strong>${textoMeses}</strong><br>
                ${dinero(plan.total)}<br>
                <small>${textoInteres}</small>
            </td>
        `;
    });

    const ticketHTML = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>TICKET DE VENTA - ${folio}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Arial', sans-serif; background: white; padding: 20px; line-height: 1.4; }
                .ticket { width: 100%; max-width: 900px; margin: 0 auto; background: white; border: 3px solid #1a3a70; padding: 20px; }
                .encabezado { display: grid; grid-template-columns: 100px 1fr 150px; gap: 20px; align-items: center; border-bottom: 3px solid #333; padding-bottom: 15px; margin-bottom: 15px; }
                .logo { width: 100px; height: 100px; background: radial-gradient(circle at 30% 30%, #87ceeb, #4a90e2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 60px; border: 3px solid #1a3a70; }
                .titulo { text-align: center; }
                .titulo h1 { color: #1a3a70; font-size: 28px; margin: 0; }
                .titulo p { color: #333; font-size: 12px; margin: 5px 0 0 0; }
                .folio-box { border: 2px solid #333; padding: 10px; text-align: center; font-weight: bold; }
                .folio-number { color: #dc2626; font-size: 24px; }
                .subtitulo { text-align: center; font-size: 18px; font-weight: bold; margin: 15px 0; color: #1a3a70; }
                .fecha { text-align: right; font-weight: bold; margin-bottom: 15px; }
                .seccion-titulo { background: #1a3a70; color: white; padding: 10px 15px; font-weight: bold; margin: 15px 0 10px 0; border-radius: 4px; }
                .datos-cliente { border: 2px solid #333; padding: 15px; margin-bottom: 15px; }
                .datos-cliente p { margin: 8px 0; font-size: 13px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
                th { background: #e8f0fe; border: 1px solid #333; padding: 10px; text-align: left; font-weight: bold; color: #1a3a70; }
                td { border: 1px solid #333; padding: 8px; }
                .total-row { background: #f0f0f0; font-weight: bold; }
                .enganche-box { background: #fffbeb; border: 2px solid #f59e0b; padding: 15px; margin: 15px 0; display: grid; grid-template-columns: 1fr 200px; gap: 20px; }
                .enganche-texto { font-size: 14px; color: #92400e; }
                .enganche-monto { background: white; border: 2px solid #f59e0b; padding: 10px; text-align: center; font-size: 18px; font-weight: bold; color: #f59e0b; }
                .tabla-pagares { margin-top: 20px; }
                .tabla-pagares-titulo { background: #1a3a70; color: white; padding: 10px; text-align: center; font-weight: bold; border-radius: 4px; margin-bottom: 10px; }
                .planes-resumen { background: #1a3a70; color: white; padding: 15px; margin: 20px 0; border-radius: 4px; text-align: center; }
                .planes-titulo { font-weight: bold; margin-bottom: 15px; font-size: 14px; }
                .planes-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; }
                .plan-item { background: #0f2847; padding: 10px; border-radius: 4px; font-size: 11px; text-align: center; }
                .firma-section { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 30px; text-align: center; }
                .linea-firma { border-top: 2px solid #333; padding-top: 10px; font-weight: bold; font-size: 12px; }
                .notas-legales { background: #f0f0f0; padding: 15px; margin-top: 20px; font-size: 10px; line-height: 1.6; border: 1px solid #333; text-align: justify; }
                @media print { body { padding: 0; } .ticket { border: none; max-width: 100%; } }
            </style>
        </head>
        <body>
            <div class="ticket">
                <div class="encabezado">
                    <div class="logo">🏛️</div>
                    <div class="titulo">
                        <h1>MUEBLERÍA<br>MI PUEBLITO</h1>
                        <p>"Calidad, Estilo y Precio que te hacen sentir en casa"</p>
                        <p style="margin-top: 8px;">Santiago Cuaula, Tlaxcala • Tel. 228 123 4567</p>
                    </div>
                    <div class="folio-box">
                        FOLIO:<br>
                        <div class="folio-number">${folio}</div>
                    </div>
                </div>

                <div style="text-align: center; margin-bottom: 10px;">
                    <div class="subtitulo">TICKET DE VENTA</div>
                    <div class="fecha">FECHA: ${fechaActual}</div>
                </div>

                <div class="seccion-titulo">DATOS DEL CLIENTE</div>
                <div class="datos-cliente">
                    <p><strong>NOMBRE:</strong> ${datosVenta.cliente.nombre}</p>
                    <p><strong>TELÉFONO:</strong> ${datosVenta.cliente.telefono || '_______________________'}</p>
                    <p><strong>DOMICILIO:</strong> ${datosVenta.cliente.direccion || '_______________________'}</p>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 60px; text-align: center;">CANT.</th>
                            <th>DESCRIPCIÓN DEL PRODUCTO</th>
                            <th style="width: 120px; text-align: right;">PRECIO UNIT.</th>
                            <th style="width: 120px; text-align: right;">IMPORTE</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tablaProductos}
                        <tr class="total-row">
                            <td colspan="3" style="text-align: right;">TOTAL DE LA VENTA:</td>
                            <td style="text-align: right; color: #dc2626; font-size: 16px;">${dinero(datosVenta.total)}</td>
                        </tr>
                    </tbody>
                </table>

                ${datosVenta.enganche > 0 ? `
                    <div class="enganche-box">
                        <div class="enganche-texto">
                            <strong>ENGANCHE RECIBIDO:</strong><br>
                            Se descuenta del total y el saldo restante se financia.
                        </div>
                        <div class="enganche-monto">
                            ${dinero(datosVenta.enganche)}
                        </div>
                    </div>
                ` : ''}

                ${datosVenta.metodo === "credito" && datosVenta.plan ? `
                    <div class="tabla-pagares">
                        <div class="tabla-pagares-titulo">PAGARÉS (TABLA DE AMORTIZACIONES)</div>
                        <table>
                            <thead>
                                <tr>
                                    <th style="width: 50px;">No.</th>
                                    <th>FECHA DE ABONO (PAGARÉ)</th>
                                    <th style="width: 120px;">IMPORTE DE ABONO</th>
                                    <th>FECHA REAL DE ABONO (LLENAR)</th>
                                    <th>SALDO (LLENAR)</th>
                                    <th>FIRMA</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tablaPagares}
                                <tr class="total-row">
                                    <td colspan="2" style="text-align: right;">TOTAL A PAGAR:</td>
                                    <td style="text-align: right; color: #dc2626; font-size: 14px;">${dinero(totalAPagar)}</td>
                                    <td colspan="3"></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                ` : ''}

                <div class="planes-resumen">
                    <div class="planes-titulo">RESUMEN DE SU PLAN DE PAGOS (SEGÚN SU COTIZACIÓN)</div>
                    <table style="background: transparent; margin: 0; border: none;">
                        <tr>
                            ${tablaPlanes}
                        </tr>
                    </table>
                </div>

                <div class="notas-legales">
                    <strong>TÉRMINOS Y CONDICIONES:</strong>
                    <br><br>
                    Al firmar este ticket, acepto los términos de pago y me comprometo a cubrir cada pagaré en la fecha indicada.
                    <br><br>
                    <strong>Este pagaré se otorga en los términos del Art. 170 de la Ley General de Títulos y Operaciones de Crédito.</strong> El suscriptor se obliga incondicionalmente a pagar esta cantidad en la fecha indicada. El incumplimiento en el pago, ya sea total o parcial, causará intereses moratorios a razón de la tasa establecida (2% mensual). En caso de juicio, el deudor será responsable de los gastos de cobro que se generen.
                    <br><br>
                    Por lo relativo a la interpretación, cumplimiento y ejecución de este pagaré, las partes se someten a la jurisdicción de los tribunales del domicilio del acreedor (Santiago Cuaula, Tlaxcala), renunciando a cualquier otro fuero que pudiera corresponderle.
                </div>

                <div class="firma-section">
                    <div>
                        <div style="margin-bottom: 40px;"></div>
                        <div class="linea-firma">FIRMA DEL CLIENTE</div>
                    </div>
                    <div>
                        <div style="margin-bottom: 40px;"></div>
                        <div class="linea-firma">VENDEDOR / EMPRESA</div>
                    </div>
                </div>

                <div style="text-align: center; margin-top: 20px; color: #666; font-size: 11px;">
                    <p><strong>Mueblería Mi Pueblito</strong></p>
                    <p>Roberto Escobedo Vega</p>
                    <p>Santiago Cuaula, Tlaxcala • Tel. 228 123 4567</p>
                    <p style="margin-top: 10px; color: #999;">Documento emitido: ${new Date().toLocaleString('es-MX')}</p>
                </div>
            </div>
        </body>
        </html>
    `;

    const ventanaImpresion = window.open('', '_blank');
    if (!ventanaImpresion) {
        alert("⚠️ Habilita las ventanas emergentes para imprimir el ticket");
        return;
    }
    
    ventanaImpresion.document.write(ticketHTML);
    ventanaImpresion.document.close();
    ventanaImpresion.focus();
    
    setTimeout(() => {
        ventanaImpresion.print();
    }, 500);
    guardarTicketEnRegistro(datosVenta, folio);
}

function guardarTicketEnRegistro(datosVenta, folio) {
    let registroTickets = StorageService.get("registroTickets", []);
    
    const pagares = StorageService.get("pagaresSistema", []);
    const pagaresDelFolio = pagares.filter(p => p.folio === folio);

    const ticketRegistro = {
        id: Date.now(),
        folio: folio,
        fechaEmision: datosVenta.fechaIso,
        cliente: {
            id: datosVenta.cliente.id,
            nombre: datosVenta.cliente.nombre,
            telefono: datosVenta.cliente.telefono,
            direccion: datosVenta.cliente.direccion,
            referencia: datosVenta.cliente.referencia
        },
        venta: {
            total: datosVenta.total,
            enganche: datosVenta.enganche,
            saldoPendiente: datosVenta.saldoPendiente,
            metodoPago: datosVenta.metodo,
            plan: datosVenta.plan,
            articulos: datosVenta.articulos
        },
        pagares: pagaresDelFolio.map(p => ({
            numeroPagere: p.numeroPagere,
            fechaVencimiento: p.fechaVencimiento,
            monto: p.monto,
            estado: p.estado,
            fechaAbonada: null,
            montoAbonado: 0,
            saldoRestante: p.monto
        })),
        planesDisponibles: CalculatorService.calcularCredito(datosVenta.total),
        estado: "Activo",
        abonos: [],
        ultimaActualizacion: new Date().toISOString()
    };

    registroTickets.push(ticketRegistro);
    if (!StorageService.set("registroTickets", registroTickets)) {
        console.error("❌ Error guardando ticket en registro");
    }
}

window.generarTicketMediaHoja = generarTicketMediaHoja;
window.guardarTicketEnRegistro = guardarTicketEnRegistro;
