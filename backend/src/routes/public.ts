import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import path from "node:path";
import fs from "node:fs";
import multer from "multer";
import { prisma } from "../db";
import crypto from 'node:crypto';

export const publicRouter = Router();
// Endpoint público para crear un admin inicial (solo para bootstrap local).
// En producción, elimínalo o protégelo con una secret de entorno.
publicRouter.post('/bootstrap/admin', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { correo, contrasena, nombre_usuario, rol } = z.object({
      correo: z.string().email(),
      contrasena: z.string().min(6),
      nombre_usuario: z.string().min(3).optional(),
      rol: z.string().optional(),
    }).parse(req.body);
    const bcrypt = await import('bcryptjs');
    const existente = await (prisma as any).usuarios.findUnique({ where: { correo_electronico: correo } });
    if (existente) return res.json({ ok: true });
    const hash = await bcrypt.default.hash(contrasena, 10);
    const u = await (prisma as any).usuarios.create({ data: { correo_electronico: correo, contrasena_hash: hash, rol: rol || 'admin', nombre_usuario: nombre_usuario || 'admin' } });
    res.json({ ok: true, usuario: { id: u.id, correo: u.correo_electronico } });
  } catch (e) { next(e); }
});
// Solicitar código de verificación de correo
publicRouter.post('/verificaciones/solicitar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { correo_electronico } = z.object({ correo_electronico: z.string().email() }).parse(req.body);
    const codigo = String(Math.floor(100 + Math.random() * 900)); // 3 dígitos
    const expiracion = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    const record = await (prisma as any).verificaciones_correo.create({
      data: { correo_electronico, codigo, expiracion },
    });

    let mailOk = false;
    let mailError = null;
    try {
      const { sendMail } = await import('../utils/mailer');
  const { correoVerificacion } = await import('../emails/templates');
  const html = correoVerificacion({ codigo, minutos: 10, logoUrl: process.env.BRAND_LOGO_URL || null, year: new Date().getFullYear() });
  await sendMail({ to: correo_electronico, subject: 'Tu código de verificación', html });
      mailOk = true;
    } catch (err) {
      console.error('Error enviando correo de verificación:', err);
      mailError = err instanceof Error ? err.message : 'Error desconocido al enviar correo';
    }

    // Siempre devolver JSON, incluso si el correo falló
    res.json({ 
      verification_id: record.id, 
      mail_sent: mailOk,
      mail_error: mailError,
      message: mailOk ? 'Código enviado exitosamente' : 'Código generado pero no se pudo enviar el correo'
    });
  } catch (e) {
    // Asegurar que siempre devolvemos JSON
    console.error('Error en verificación de correo:', e);
    res.status(400).json({ 
      error: e instanceof Error ? e.message : 'Error inesperado',
      mail_sent: false 
    });
  }
});

// Payphone INIT: crea orden pendiente con reservas y devuelve configuración para la cajita
publicRouter.post('/payments/payphone/init', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z.object({
      nombres: z.string(),
      apellidos: z.string().optional(),
      cedula: z.string().optional(),
      correo_electronico: z.string().email(),
      telefono: z.string().optional(),
      direccion: z.string().optional(),
      sorteo_id: z.coerce.bigint(),
      paquete_id: z.coerce.number().int().optional(),
      cantidad_numeros: z.coerce.number().int().min(1).optional(),
    }).parse(req.body);

    console.log('🔍 [Payphone INIT] Datos recibidos:', body);

    // Cliente: reutiliza por correo si existe, sino crea básico
    let cliente = await prisma.clientes.findFirst({ where: { correo_electronico: body.correo_electronico } });
    if (!cliente) {
      cliente = await prisma.clientes.create({ data: {
        nombres: body.nombres,
        apellidos: body.apellidos ?? '',
        cedula: body.cedula ?? '',
        correo_electronico: body.correo_electronico,
        telefono: body.telefono ?? '',
        direccion: body.direccion ?? '',
      } as any });
    }

    const sorteo = await prisma.sorteos.findUnique({ where: { id: body.sorteo_id } });
    if (!sorteo) return res.status(404).json({ error: 'Sorteo no encontrado' });

    let cantidad = body.cantidad_numeros ?? 0;
    let monto_total = 0;
    if (body.paquete_id) {
      const paquete: any = await (prisma as any).paquetes.findUnique({ where: { id: BigInt(body.paquete_id) } });
      if (!paquete || paquete.sorteo_id !== body.sorteo_id || paquete.estado !== 'publicado') return res.status(400).json({ error: 'Paquete inválido' });
      cantidad = Number(paquete.cantidad_numeros || 0);
      monto_total = Number(paquete.precio_total || 0);
    } else if (cantidad > 0) {
      monto_total = Number(sorteo.precio_por_numero) * cantidad;
    } else {
      return res.status(400).json({ error: 'Debe indicar cantidad_numeros o paquete_id' });
    }

    const disponibles = await prisma.numeros_sorteo.count({ where: { sorteo_id: body.sorteo_id, estado: 'disponible' } });
    if (disponibles < cantidad) return res.status(400).json({ error: `No hay suficientes números disponibles. Quedan ${disponibles}.` });

    const mpPayphone: any = await (prisma as any).metodos_pago.findFirst({ where: { nombre: 'Payphone' } });
    if (!mpPayphone) return res.status(400).json({ error: 'Método Payphone no configurado' });

    const codigo = `OR-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const orden = await prisma.ordenes.create({
      data: {
        codigo,
        cliente_id: cliente.id,
        sorteo_id: body.sorteo_id,
        metodo_pago_id: mpPayphone.id,
        metodo_pago: 'Payphone',
        estado_pago: 'pendiente',
        monto_total,
        cantidad_numeros: cantidad,
      } as any,
    });

    // Reservar números
    await prisma.$transaction(async (tx) => {
      const seleccion = await (tx as any).$queryRaw<{ id: bigint }[]>`
        SELECT id FROM numeros_sorteo
        WHERE sorteo_id = ${body.sorteo_id} AND estado = 'disponible'
        ORDER BY random()
        LIMIT ${cantidad}
        FOR UPDATE SKIP LOCKED
      `;
      if (seleccion.length < cantidad) throw new Error('Stock insuficiente');
      const ids = seleccion.map((s: { id: bigint }) => s.id);
      await tx.numeros_sorteo.updateMany({ where: { id: { in: ids } }, data: { estado: 'reservado', orden_id: orden.id } });
    });

    const clientTxnId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + (Number(process.env.PAYPHONE_TIMEOUT_MIN || 10) * 60 * 1000));
    await (prisma as any).pagos_payphone.create({ 
      data: { 
        orden_id: orden.id, 
        client_txn_id: clientTxnId, 
        status: 'INIT', 
        amount: monto_total, 
        expires_at: expiresAt 
      } 
    });

    // Correo de orden recibida (Payphone)
    try {
      if (cliente?.correo_electronico) {
        const { sendMail } = await import('../utils/mailer');
        const { correoOrdenRecibida } = await import('../emails/templates');
        const sorteoNombre = sorteo?.nombre || '';
        const html = correoOrdenRecibida({
          clienteNombre: cliente.nombres || '',
          codigo,
          sorteoNombre,
          cantidad,
          monto: `$${monto_total.toFixed(2)}`,
          metodoPago: 'Payphone',
          logoUrl: process.env.BRAND_LOGO_URL || null,
          year: new Date().getFullYear()
        });
        await sendMail({ to: cliente.correo_electronico, subject: `Orden recibida ${codigo}`, html });
      }
    } catch (e) { console.error('Error enviando correo orden recibida (Payphone):', e); }

    // --- CONFIGURACIÓN PARA LA CAJITA DE PAGOS DE PAYPHONE ---
    const token = process.env.PAYPHONE_TOKEN;
    if (!token) {
      console.error('❌ PAYPHONE_TOKEN no está configurado en las variables de entorno.');
      return res.status(500).json({ error: 'Error de configuración del servidor de pagos.' });
    }

    // Convertir a centavos como requiere Payphone
    const amountCents = Math.round(monto_total * 100);
    const amountWithoutTaxCents = Math.round(amountCents / 1.12); // Asumiendo 12% IVA
    const taxCents = amountCents - amountWithoutTaxCents;

    // Configuración para la Cajita de Pagos (según documentación oficial)
    const payphoneConfig = {
      token: token,
      clientTransactionId: clientTxnId,
      amount: amountCents,
      amountWithoutTax: amountWithoutTaxCents,
      amountWithTax: amountWithoutTaxCents, // Base gravable
      tax: taxCents,
      service: 0,
      tip: 0,
      currency: "USD",
      storeId: process.env.PAYPHONE_STORE_ID || undefined, // Opcional según documentación
      reference: `Orden ${codigo} - ${sorteo.nombre}`,
      lang: "es",
      defaultMethod: "card",
      timeZone: -5,
      // Datos del cliente (obligatorios según documentación)
      phoneNumber: body.telefono ? `+593${body.telefono.replace(/[^0-9]/g, '')}` : undefined,
      email: body.correo_electronico,
      documentId: body.cedula || undefined,
      identificationType: 1, // Cédula
      // URLs de respuesta
      responseUrl: `${process.env.FRONTEND_URL}/payphone/response`,
      cancellationUrl: `${process.env.FRONTEND_URL}/sorteos/${body.sorteo_id}`
    };

    console.log('✅ [Payphone INIT] Configuración generada:', {
      orden_id: orden.id,
      codigo,
      clientTransactionId: clientTxnId,
      amount: amountCents,
      storeId: payphoneConfig.storeId
    });

    // Devolver configuración para la cajita de pagos
    res.json({ 
      ok: true, 
      orden_id: orden.id,
      codigo,
      payphoneConfig
    });

  } catch (e) { 
    console.error('❌ Error general en /payments/payphone/init:', e);
    next(e); 
  }
});

// Receptor de respuesta de Payphone (GET - redirección desde cajita)
publicRouter.get('/payphone/response', async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('🔍 [Payphone Response] Parámetros recibidos:', req.query);
    
    const { id, clientTransactionId } = req.query as { id?: string; clientTransactionId?: string };
    
    if (!id || !clientTransactionId) {
      console.log('❌ [Payphone Response] Parámetros faltantes');
      return res.redirect(`${process.env.FRONTEND_URL}/?error=payphone_params_missing`);
    }

    // Buscar el pago en nuestra base de datos
    const pago: any = await (prisma as any).pagos_payphone.findUnique({ 
      where: { client_txn_id: clientTransactionId },
      include: { orden: true }
    });
    
    if (!pago) {
      console.log('❌ [Payphone Response] Pago no encontrado:', clientTransactionId);
      return res.redirect(`${process.env.FRONTEND_URL}/?error=payphone_payment_not_found`);
    }

    // Confirmar con la API de Payphone
    const token = process.env.PAYPHONE_TOKEN;
    const confirmUrl = 'https://pay.payphonetodoesposible.com/api/button/V2/Confirm';
    
    console.log('🔍 [Payphone Response] Confirmando transacción con Payphone API');
    
    try {
      const confirmResponse = await fetch(confirmUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: parseInt(id),
          clientTxId: clientTransactionId
        }),
      });

      const confirmData = await confirmResponse.json();
      console.log('🔍 [Payphone Response] Respuesta de confirmación:', confirmData);

      // Type assertion for confirmData
      const confirmDataTyped = confirmData as { transactionStatus?: string; [key: string]: any };

      if (confirmResponse.ok && confirmDataTyped.transactionStatus === 'Approved') {
        // Pago aprobado - procesar como orden aprobada
        await procesarPagoAprobado(pago, confirmDataTyped);
        
        // Redirigir a página de éxito
        return res.redirect(`${process.env.FRONTEND_URL}/payphone/success?orden=${pago.orden.codigo}&clientTxnId=${clientTransactionId}`);
      } else {
        // Pago no aprobado - liberar reservas
        await liberarReservas(pago.orden_id);
        
        console.log('❌ [Payphone Response] Pago no aprobado:', confirmDataTyped);
        return res.redirect(`${process.env.FRONTEND_URL}/payphone/error?reason=payment_declined&orden=${pago.orden.codigo}`);
      }
    } catch (apiError: any) {
      console.error('❌ [Payphone Response] Error llamando API confirm:', apiError);
      return res.redirect(`${process.env.FRONTEND_URL}/payphone/error?reason=api_error&orden=${pago.orden.codigo}`);
    }

  } catch (e) {
    console.error('❌ Error en respuesta Payphone:', e);
    return res.redirect(`${process.env.FRONTEND_URL}/?error=payphone_response_error`);
  }
});

// Función auxiliar para procesar pago aprobado (igual que el flujo de admin approve)
async function procesarPagoAprobado(pago: any, payphoneData: any) {
  const ordenId = pago.orden_id;
  
  await prisma.$transaction(async (tx) => {
    // Convertir números reservados a vendidos
    const reservados = await tx.numeros_sorteo.findMany({ 
      where: { orden_id: ordenId, estado: 'reservado' } 
    });
    
    const ids = reservados.map(r => r.id);
    await tx.numeros_sorteo.updateMany({ 
      where: { id: { in: ids } }, 
      data: { estado: 'vendido' } 
    });

    // Crear items de orden
    const orden = await tx.ordenes.findUnique({ where: { id: ordenId } });
    const unit = Math.round(Number(orden?.monto_total || 0) / Math.max(1, Number(orden?.cantidad_numeros || 1)) * 100) / 100;
    
    for (const n of reservados) {
      await tx.ordenes_items.create({ 
        data: { orden_id: ordenId, numero_sorteo_id: n.id, precio: unit as any } as any 
      });
    }

    // Marcar orden como aprobada
    await tx.ordenes.update({ 
      where: { id: ordenId }, 
      data: { estado_pago: 'aprobado' } 
    });
  });

  // Actualizar pago Payphone
  await (prisma as any).pagos_payphone.update({ 
    where: { id: pago.id }, 
    data: { 
      status: 'APPROVED', 
      payphone_txn_id: String(payphoneData?.transactionId || ''), 
      raw: payphoneData, 
      confirmed_at: new Date() 
    } 
  });

  // Enviar correo de aprobación y factura
  await enviarCorreoAprobacion(ordenId);
}

// Función auxiliar para liberar reservas
async function liberarReservas(ordenId: bigint) {
  await prisma.$transaction(async (tx) => {
    await tx.numeros_sorteo.updateMany({ 
      where: { orden_id: ordenId, estado: 'reservado' }, 
      data: { estado: 'disponible', orden_id: null } 
    });
    await tx.ordenes.update({ 
      where: { id: ordenId }, 
      data: { estado_pago: 'rechazado' } 
    });
  });
}

// Función auxiliar para enviar correo de aprobación (reutiliza lógica del admin)
async function enviarCorreoAprobacion(ordenId: bigint) {
  try {
    const aprobada: any = await prisma.ordenes.findUnique({ 
      where: { id: ordenId }, 
      include: { items: true, metodo_pago_ref: true, cliente: true, sorteo: true } as any 
    });
    
    if (aprobada?.cliente?.correo_electronico && aprobada?.items) {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const { sendMail } = await import('../utils/mailer');
      const PDFDocument = (await import('pdfkit')).default;
      
      const itemIds = (aprobada.items as any[]).map((i: any) => i.numero_sorteo_id as bigint);
      const numeros = itemIds.length ? await prisma.numeros_sorteo.findMany({ 
        where: { id: { in: itemIds } }, 
        select: { id: true, numero_texto: true } 
      }) : [];
      
      const numeroMap = new Map(numeros.map((n) => [String(n.id), n.numero_texto]));
      const lista = (aprobada.items as any[]).map((i: any) => 
        `#${numeroMap.get(String(i.numero_sorteo_id)) ?? String(i.numero_sorteo_id)}`
      ).join(', ');
      
      // Generar PDF
      const dir = path.resolve(process.cwd(), 'uploads', 'facturas');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      
      const pdfPath = path.resolve(dir, `${aprobada.codigo}.pdf`);
      const doc = new PDFDocument();
      doc.pipe(fs.createWriteStream(pdfPath));
      
      doc.fontSize(16).text('Factura / Comprobante', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Orden: ${aprobada.codigo}`);
      doc.text(`Sorteo: ${aprobada.sorteo?.nombre ?? ''}`);
      doc.text(`Cliente: ${aprobada.cliente?.nombres ?? ''}`);
      doc.text(`Método de pago: ${aprobada?.metodo_pago_ref?.nombre ?? aprobada?.metodo_pago ?? ''}`);
      doc.text(`Monto: $${String(aprobada.monto_total ?? '')}`);
      doc.moveDown();
      doc.text(`Números: ${lista}`);
      doc.end();
      
      // Guardar factura en BD
      try {
        const adminUser = await (prisma as any).usuarios?.findFirst?.({}).catch(() => null);
        const dataFactura: any = { 
          orden_id: ordenId, 
          ruta_factura: path.relative(process.cwd(), pdfPath).replace(/\\/g, '/'), 
          datos_factura: { orden_id: String(ordenId) } 
        };
        if (adminUser?.id) dataFactura.usuario_admin_id = adminUser.id;
        await prisma.facturas.create({ data: dataFactura });
      } catch {}
      
      // Enviar correo de aprobación
      const { correoAprobacion, correoGanador } = await import('../emails/templates');
      const htmlAprobacion = correoAprobacion({
        clienteNombre: aprobada.cliente.nombres || '',
        codigo: aprobada.codigo,
        sorteoNombre: aprobada.sorteo?.nombre,
        numeros: (aprobada.items as any[]).map(i => `#${numeroMap.get(String(i.numero_sorteo_id)) ?? String(i.numero_sorteo_id)}`),
        metodoPago: aprobada?.metodo_pago_ref?.nombre ?? aprobada?.metodo_pago ?? '',
        monto: aprobada.monto_total ? `$${aprobada.monto_total}` : undefined,
        logoUrl: process.env.BRAND_LOGO_URL || null,
        year: new Date().getFullYear()
      });
      
      await sendMail({ 
        to: aprobada.cliente.correo_electronico, 
        subject: `Orden ${aprobada?.codigo} aprobada`, 
        html: htmlAprobacion, 
        attachments: [{ filename: `${aprobada.codigo}.pdf`, path: pdfPath }] 
      });
      
      // Verificar premios ganados
      const itemIdsBigInt = itemIds.map(id => BigInt(String(id)));
      if (itemIdsBigInt.length) {
        const premiosGanados: any[] = await (prisma as any).premios.findMany({
          where: { numero_sorteo_id: { in: itemIdsBigInt } },
          include: { numero_sorteo: true, sorteo: true }
        });
        
        if (premiosGanados.length) {
          const premiosData = premiosGanados.map(p => ({ 
            numero: p.numero_sorteo?.numero_texto || '', 
            premio: p.descripcion || 'Premio' 
          }));
          
          const htmlGanador = correoGanador({
            clienteNombre: aprobada.cliente.nombres || '',
            codigo: aprobada.codigo,
            sorteoNombre: aprobada.sorteo?.nombre,
            premios: premiosData,
            linkSorteo: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/sorteos/${aprobada.sorteo?.id}` : undefined,
            logoUrl: process.env.BRAND_LOGO_URL || null,
            year: new Date().getFullYear()
          });
          
          await sendMail({
            to: aprobada.cliente.correo_electronico,
            subject: `🎉 ¡Has ganado ${premiosGanados.length > 1 ? 'premios' : 'un premio'} en ${aprobada.sorteo?.nombre || 'un sorteo'}!`,
            html: htmlGanador
          });
        }
      }
    }
  } catch (emailError) {
    console.error('⚠️ Error enviando correo de aprobación:', emailError);
  }
}

// Confirmación Payphone: cierra orden
publicRouter.post('/payments/payphone/confirm', async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('🔍 Payphone confirm request received:', { body: req.body, query: req.query });
    
    const { clientTransactionId } = z.object({ clientTransactionId: z.string().min(8) }).parse(req.body);
    console.log('🔍 Client Transaction ID:', clientTransactionId);
    
    const pago: any = await (prisma as any).pagos_payphone.findUnique({ where: { client_txn_id: clientTransactionId } });
    if (!pago) {
      console.log('❌ Transacción no encontrada en BD:', clientTransactionId);
      return res.status(404).json({ error: 'Transacción no encontrada' });
    }
    
    console.log('🔍 Pago encontrado:', { id: pago.id, status: pago.status, orden_id: pago.orden_id });

    // Idempotencia: si ya aprobado, regresar
    if (pago.status === 'APPROVED') {
      console.log('✅ Pago ya aprobado, retornando orden existente');
      const orden = await prisma.ordenes.findUnique({ where: { id: pago.orden_id }, include: { items: true } });
      return res.json({ ok: true, orden, message: 'Pago ya confirmado anteriormente' });
    }

    // Llamar a API de confirmación Payphone
    const token = process.env.PAYPHONE_TOKEN || '';
    const storeId = process.env.PAYPHONE_STORE_ID || '';
    
    console.log('🔍 Payphone config:', { 
      storeId, 
      tokenLength: token.length, 
      tokenPreview: token.substring(0, 10) + '...',
      mock: process.env.PAYPHONE_MOCK 
    });
    
    let success = false;
    let data: any = {};
    
    if (process.env.PAYPHONE_MOCK === '1' || String((req.query as any)?.mock || (req.body as any)?.mock) === '1') {
      // Modo mock para desarrollo local: aprobar sin llamar a Payphone
      console.log('🧪 Modo MOCK activado - aprobando sin llamar a Payphone');
      success = true;
      data = { transactionId: 'MOCK', transactionStatus: 'Approved' };
    } else {
      if (!token || !storeId) {
        console.log('❌ Payphone no configurado:', { hasToken: !!token, hasStoreId: !!storeId });
        return res.status(500).json({ error: 'Payphone no configurado', details: { hasToken: !!token, hasStoreId: !!storeId } });
      }
      
      const confirmUrl = 'https://pay.payphonetodoesposible.com/api/Sale/Confirm';
      const requestBody = { storeId, clientTransactionId };
      
      console.log('🔍 Llamando a Payphone API:', { url: confirmUrl, body: requestBody });
      
      try {
        const resp = await fetch(confirmUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });
        
        console.log('🔍 Payphone API response status:', resp.status);
        console.log('🔍 Payphone API response headers:', Object.fromEntries(resp.headers.entries()));
        
        const responseText = await resp.text();
        console.log('🔍 Payphone API response text:', responseText);
        
        try {
          data = JSON.parse(responseText);
          console.log('🔍 Payphone API response parsed:', data);
        } catch (parseError: any) {
          console.log('⚠️ Error parsing Payphone response as JSON:', parseError);
          data = { rawResponse: responseText, parseError: parseError.message };
        }
        
        // Validación más robusta del éxito
        const transactionStatus = String(data?.transactionStatus || data?.status || data?.message || '').toLowerCase();
        const isApproved = transactionStatus.includes('approved') || transactionStatus.includes('success') || transactionStatus.includes('completed');
        
        success = resp.ok && isApproved;
        
        console.log('🔍 Payphone success validation:', { 
          respOk: resp.ok, 
          transactionStatus, 
          isApproved, 
          success,
          dataKeys: Object.keys(data || {})
        });
        
      } catch (apiError: any) {
        console.error('❌ Error llamando a Payphone API:', apiError);
        data = { apiError: apiError.message, stack: apiError.stack };
        success = false;
      }
    }

    // Validaciones negocio
    const orden = await prisma.ordenes.findUnique({ where: { id: pago.orden_id } });
    if (!orden) {
      console.log('❌ Orden no encontrada:', pago.orden_id);
      return res.status(404).json({ error: 'Orden no encontrada' });
    }
    
    console.log('🔍 Orden encontrada:', { id: orden.id, estado_pago: orden.estado_pago, monto_total: orden.monto_total });
    
    if (!success) {
      console.log('❌ Pago no aprobado, liberando reservas y marcando orden rechazada');
      // liberar reservas y marcar orden rechazada si falló
      await prisma.$transaction(async (tx) => {
        await tx.numeros_sorteo.updateMany({ 
          where: { orden_id: orden.id, estado: 'reservado' }, 
          data: { estado: 'disponible', orden_id: null } 
        });
        await tx.ordenes.update({ 
          where: { id: orden.id }, 
          data: { estado_pago: 'rechazado' } 
        });
      });
      
      await (prisma as any).pagos_payphone.update({ 
        where: { id: pago.id }, 
        data: { status: 'FAILED', raw: data, failed_at: new Date() } 
      });
      
      console.log('❌ Pago fallido - detalles:', data);
      return res.status(400).json({ 
        error: 'Pago no aprobado', 
        detalle: data,
        message: 'El pago no pudo ser confirmado con Payphone'
      });
    }

    console.log('✅ Pago aprobado, procesando orden...');
    
    // Aprobar: pasar reservados a vendidos y crear items (precio unitario = monto_total / cantidad)
    await prisma.$transaction(async (tx) => {
      const reservados = await tx.numeros_sorteo.findMany({ where: { orden_id: orden.id, estado: 'reservado' } });
      console.log('🔍 Números reservados encontrados:', reservados.length);
      
      const ids = reservados.map(r => r.id);
      await tx.numeros_sorteo.updateMany({ where: { id: { in: ids } }, data: { estado: 'vendido' } });

      const unit = Math.round(Number(orden.monto_total || 0) / Math.max(1, Number(orden.cantidad_numeros || 1)) * 100) / 100;
      console.log('🔍 Precio unitario calculado:', unit);
      
      for (const n of reservados) {
        await tx.ordenes_items.create({ 
          data: { orden_id: orden.id, numero_sorteo_id: n.id, precio: unit as any } as any 
        });
      }

      await tx.ordenes.update({ where: { id: orden.id }, data: { estado_pago: 'aprobado' } });
      console.log('✅ Orden marcada como aprobada');
    });

    await (prisma as any).pagos_payphone.update({ 
      where: { id: pago.id }, 
      data: { 
        status: 'APPROVED', 
        payphone_txn_id: String((data as any)?.transactionId || data?.id || ''), 
        raw: data, 
        confirmed_at: new Date() 
      } 
    });
    
    console.log('✅ Pago Payphone marcado como aprobado');

    // Generar factura y enviar correo (similar a approve)
    try {
      console.log('🔍 Generando factura y enviando correo...');
      const aprobada: any = await prisma.ordenes.findUnique({ 
        where: { id: pago.orden_id }, 
        include: { items: true, metodo_pago_ref: true, cliente: true, sorteo: true } as any 
      });
      
      if (aprobada?.cliente?.correo_electronico && aprobada?.items) {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const { sendMail } = await import('../utils/mailer');
        const PDFDocument = (await import('pdfkit')).default;
        
        const itemIds = (aprobada.items as any[]).map((i: any) => i.numero_sorteo_id as bigint);
        const numeros = itemIds.length ? await prisma.numeros_sorteo.findMany({ 
          where: { id: { in: itemIds } }, 
          select: { id: true, numero_texto: true } 
        }) : [];
        
        const numeroMap = new Map(numeros.map((n) => [String(n.id), n.numero_texto]));
        const lista = (aprobada.items as any[]).map((i: any) => 
          `#${numeroMap.get(String(i.numero_sorteo_id)) ?? String(i.numero_sorteo_id)}`
        ).join(', ');
        
        const dir = path.resolve(process.cwd(), 'uploads', 'facturas');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        
        const pdfPath = path.resolve(dir, `${aprobada.codigo}.pdf`);
        const doc = new PDFDocument();
        doc.pipe(fs.createWriteStream(pdfPath));
        
        doc.fontSize(16).text('Factura / Comprobante', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Orden: ${aprobada.codigo}`);
        doc.text(`Sorteo: ${aprobada.sorteo?.nombre ?? ''}`);
        doc.text(`Cliente: ${aprobada.cliente?.nombres ?? ''}`);
        doc.text(`Método de pago: ${aprobada?.metodo_pago_ref?.nombre ?? aprobada?.metodo_pago ?? ''}`);
        doc.text(`Monto: $${String(aprobada.monto_total ?? '')}`);
        doc.moveDown();
        doc.text(`Números: ${lista}`);
        doc.end();
        
        try {
          const adminUser = await (prisma as any).usuarios?.findFirst?.({}).catch(() => null);
          const dataFactura: any = { 
            orden_id: pago.orden_id, 
            ruta_factura: path.relative(process.cwd(), pdfPath).replace(/\\/g, '/'), 
            datos_factura: { orden_id: String(pago.orden_id) } 
          };
          if (adminUser?.id) dataFactura.usuario_admin_id = adminUser.id;
          await prisma.facturas.create({ data: dataFactura });
        } catch {}
        
        const { correoAprobacion } = await import('../emails/templates');
        const htmlAprobacion = correoAprobacion({
          clienteNombre: aprobada.cliente.nombres || '',
            codigo: aprobada.codigo,
            sorteoNombre: aprobada.sorteo?.nombre,
            numeros: (aprobada.items as any[]).map(i => `#${numeroMap.get(String(i.numero_sorteo_id)) ?? String(i.numero_sorteo_id)}`),
            metodoPago: aprobada?.metodo_pago_ref?.nombre ?? aprobada?.metodo_pago ?? '',
            monto: aprobada.monto_total ? `$${aprobada.monto_total}` : undefined,
            logoUrl: process.env.BRAND_LOGO_URL || null,
            year: new Date().getFullYear()
        });
        await sendMail({ 
          to: aprobada.cliente.correo_electronico, 
          subject: `Orden ${aprobada?.codigo} aprobada`, 
          html: htmlAprobacion, 
          attachments: [{ filename: `${aprobada.codigo}.pdf`, path: pdfPath }] 
        });
        
        console.log('✅ Factura generada y correo enviado');
      }
    } catch (emailError) {
      console.error('⚠️ Error generando factura/enviando correo:', emailError);
      // No fallar la transacción por errores de email
    }

    const updated = await prisma.ordenes.findUnique({ where: { id: pago.orden_id }, include: { items: true } });
    console.log('✅ Confirmación Payphone completada exitosamente');
    
    res.json({ ok: true, orden: updated, message: 'Pago confirmado exitosamente' });
  } catch (e) { 
    console.error('❌ Error en confirmación Payphone:', e);
    next(e); 
  }
});

// Endpoint de debugging para Payphone
publicRouter.post('/payments/payphone/debug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('🔍 Payphone debug request received');
    
    const token = process.env.PAYPHONE_TOKEN || '';
    const storeId = process.env.PAYPHONE_STORE_ID || '';
    
    console.log('🔍 Payphone credentials check:', {
      hasToken: !!token,
      hasStoreId: !!storeId,
      tokenLength: token.length,
      tokenPreview: token.substring(0, 20) + '...',
      storeId
    });
    
    if (!token || !storeId) {
      return res.status(400).json({
        error: 'Credenciales incompletas',
        details: { hasToken: !!token, hasStoreId: !!storeId }
      });
    }
    
    // Probar conexión básica con Payphone
    try {
      const testUrl = 'https://pay.payphonetodoesposible.com/api/Sale/Confirm';
      const testBody = { 
        storeId, 
        clientTransactionId: 'DEBUG_TEST_' + Date.now() 
      };
      
      console.log('🔍 Testing Payphone connection:', { url: testUrl, body: testBody });
      
      const resp = await fetch(testUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testBody),
      });
      
      const responseText = await resp.text();
      let responseData;
      
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { rawResponse: responseText };
      }
      
      console.log('🔍 Payphone test response:', {
        status: resp.status,
        statusText: resp.statusText,
        headers: Object.fromEntries(resp.headers.entries()),
        data: responseData
      });
      
      return res.json({
        ok: true,
        connection: 'success',
        response: {
          status: resp.status,
          statusText: resp.statusText,
          data: responseData
        },
        credentials: {
          storeId,
          tokenLength: token.length,
          tokenPreview: token.substring(0, 20) + '...'
        }
      });
      
    } catch (apiError: any) {
      console.error('❌ Payphone connection test failed:', apiError);
      return res.status(500).json({
        error: 'Error de conexión con Payphone',
        details: {
          message: apiError.message,
          stack: apiError.stack
        }
      });
    }
    
  } catch (e) {
    console.error('❌ Error en debug Payphone:', e);
    next(e);
  }
});

// Sorteos con números ganadores y métricas (para landing)
publicRouter.get('/sorteos_con_ganadores', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const sorteos = await prisma.sorteos.findMany({ where: { estado: 'publicado' } as any, orderBy: { fecha_creacion: 'desc' } });
    const resultado = [] as any[];
    for (const s of sorteos) {
      const [total, vendidos] = await Promise.all([
        prisma.numeros_sorteo.count({ where: { sorteo_id: s.id } }),
        prisma.numeros_sorteo.count({ where: { sorteo_id: s.id, estado: 'vendido' } }),
      ]);

      // Premios con su número y posible cliente
      const filas: any[] = await (prisma as any).$queryRaw`
        SELECT p.id AS premio_id,
               p.descripcion,
               ns.id AS numero_id,
               ns.numero_texto,
               CASE WHEN o.id IS NOT NULL THEN true ELSE false END AS vendido,
               c.nombres,
               c.apellidos
        FROM premios p
        JOIN numeros_sorteo ns ON ns.id = p.numero_sorteo_id
        LEFT JOIN ordenes_items oi ON oi.numero_sorteo_id = ns.id
        LEFT JOIN ordenes o ON o.id = COALESCE(oi.orden_id, ns.orden_id) AND o.estado_pago = 'aprobado'
        LEFT JOIN clientes c ON c.id = o.cliente_id
        WHERE p.sorteo_id = ${s.id}
        ORDER BY p.id
      `;

      resultado.push({
        id: s.id,
        nombre: s.nombre,
        descripcion: (s as any).descripcion ?? null,
        conteos: { total, vendidos, disponibles: total - vendidos },
        premios: filas.map((f) => ({
          id: f.premio_id,
          descripcion: f.descripcion,
          numero_id: f.numero_id,
          numero_texto: f.numero_texto,
          vendido: Boolean(f.vendido),
          cliente: f.nombres ? { nombres: f.nombres, apellidos: f.apellidos } : null,
        })),
      });
    }
    res.json({ sorteos: resultado });
  } catch (e) {
    next(e);
  }
});

// Verificar código de verificación
publicRouter.post('/verificaciones/verificar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { verification_id, codigo } = z.object({ verification_id: z.coerce.bigint(), codigo: z.string().length(3) }).parse(req.body);
    const rec: any = await (prisma as any).verificaciones_correo.findUnique({ where: { id: verification_id } });
    if (!rec) return res.status(404).json({ error: 'Solicitud no encontrada' });
    if (rec.usado) return res.status(400).json({ error: 'Código ya usado' });
    if (rec.verificado) return res.json({ ok: true });
    if (new Date(rec.expiracion).getTime() < Date.now()) return res.status(400).json({ error: 'Código expirado' });
    if (String(rec.codigo) !== String(codigo)) return res.status(400).json({ error: 'Código inválido' });
    await (prisma as any).verificaciones_correo.update({ where: { id: verification_id }, data: { verificado: true } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
// Listar sorteos publicados con métricas básicas
publicRouter.get("/sorteos", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const sorteos = await prisma.sorteos.findMany({
      where: { estado: 'publicado' } as any,
      orderBy: { fecha_creacion: "desc" },
    });
    // Adjuntar conteos
    const enriched = await Promise.all(
      sorteos.map(async (s: any) => {
        const total = await prisma.numeros_sorteo.count({ where: { sorteo_id: s.id } });
        const vendidos = await prisma.numeros_sorteo.count({ where: { sorteo_id: s.id, estado: "vendido" } });
        return { ...s, conteos: { total, vendidos, disponibles: total - vendidos } };
      })
    );
    res.json({ sorteos: enriched });
  } catch (e) {
    next(e);
  }
});

// Paquetes publicados (para landing)
publicRouter.get('/paquetes_publicados', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const paquetes = await prisma.paquetes.findMany({
      where: { 
        estado: 'publicado',
        sorteo: {
          estado: 'publicado' // Solo paquetes de sorteos publicados
        }
      } as any,
      include: { sorteo: true },
      orderBy: [{ sorteo_id: 'desc' }, { cantidad_numeros: 'asc' }]
    } as any);
    res.json({ paquetes });
  } catch (e) {
    next(e);
  }
});

// Social posts públicos activos
publicRouter.get('/social_posts', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const posts = await (prisma as any).social_posts.findMany({ where: { activo: true }, orderBy: [{ orden: 'asc' }, { id: 'asc' }] });
    res.json({ posts });
  } catch (e) { next(e); }
});

// Detalle de sorteo con paquetes, conteos e imágenes
publicRouter.get("/sorteos/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = z.object({ id: z.string() }).parse(req.params);
    if (!/^\d+$/.test(params.id)) {
      console.warn('⚠️  /sorteos/:id id no numérico recibido:', params.id);
      return res.status(400).json({ error: 'ID inválido' });
    }
    let sorteoId: bigint;
    try {
      sorteoId = BigInt(params.id);
    } catch (convErr) {
      console.error('❌ Error convirtiendo a BigInt el id:', params.id, convErr);
      return res.status(400).json({ error: 'ID inválido' });
    }
    const sorteo = await prisma.sorteos.findUnique({ where: { id: sorteoId } });
    if (!sorteo) return res.status(404).json({ error: "Sorteo no encontrado" });
    // Solo paquetes publicados para clientes
    const paquetes = await (prisma as any).paquetes.findMany({ where: { sorteo_id: sorteoId, estado: 'publicado' }, orderBy: { cantidad_numeros: 'asc' } });
    const total = await prisma.numeros_sorteo.count({ where: { sorteo_id: sorteoId } });
    const vendidos = await prisma.numeros_sorteo.count({ where: { sorteo_id: sorteoId, estado: "vendido" } });
    const imagenes = (prisma as any)?.sorteos_imagenes?.findMany
      ? await (prisma as any).sorteos_imagenes.findMany({ where: { sorteo_id: sorteoId }, orderBy: [{ es_portada: 'desc' }, { orden: 'asc' }, { id: 'asc' }] })
      : [];
    res.json({ sorteo, paquetes, imagenes, conteos: { total, vendidos, disponibles: total - vendidos } });
  } catch (e) {
    next(e);
  }
});

// Helpers
function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

// Crear cliente
publicRouter.post("/clients", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = z
      .object({
        nombres: z.string().min(1),
        apellidos: z.string().optional(),
        cedula: z.string().optional(),
        correo_electronico: z.string().email().optional(),
        telefono: z.string().optional(),
        direccion: z.string().optional(),
      })
      .parse(req.body);

    const cliente = await prisma.clientes.create({ data: body as any });
    res.json({ cliente });
  } catch (e) {
    next(e);
  }
});

// Crear orden (pendiente) - DEPRECADO
publicRouter.post("/orders", async (_req: Request, res: Response) => {
  return res.status(410).json({
    error: "Endpoint /orders deprecado. Usa /orders/complete (multipart con comprobante) o el flujo Payphone.",
    deprecated: true,
    replacement: ["POST /orders/complete", "POST /payphone/init"],
  });
});

// Upload comprobante
const uploadDir = path.resolve(process.cwd(), "uploads", "comprobantes");
ensureDir(uploadDir);
const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb: Function) => cb(null, uploadDir),
  filename: (req: Request, file: Express.Multer.File, cb: Function) => {
    const id = (req.params as any)?.id || "unknown";
    const ext = path.extname(file.originalname || "");
    const fname = `${id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, fname);
  },
});
const upload = multer({ storage });

publicRouter.post("/orders/:id/comprobante", upload.single("file"), async (_req: Request, res: Response) => {
  return res.status(410).json({
    error: "Endpoint /orders/:id/comprobante deprecado. Usa /orders/complete que crea la orden y adjunta comprobante en un solo paso.",
    deprecated: true,
    replacement: "POST /orders/complete",
  });
});

// Lista de métodos de pago públicos (activos)
publicRouter.get('/metodos_pago', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const metodos = await (prisma as any).metodos_pago.findMany({ where: { activo: true } });
    res.json({ metodos });
  } catch (e) {
    next(e);
  }
});

// Crear orden completa con comprobante (multipart/form-data)
// Campos esperados: nombres, correo_electronico, sorteo_id, paquete_id? o cantidad_numeros?, metodo_pago_id, file(comprobante)
publicRouter.post('/orders/complete', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as any;
    const parsed = z.object({
      nombres: z.string().min(1),
      apellidos: z.string().min(1),
      cedula: z.string().min(1),
      correo_electronico: z.string().email(),
      telefono: z.string().min(1),
      direccion: z.string().min(1),
      verification_id: z.coerce.bigint(),
      verification_code: z.string().length(3),
      sorteo_id: z.coerce.bigint(),
      paquete_id: z.coerce.number().int().optional(),
      cantidad_numeros: z.coerce.number().int().min(1).optional(),
      metodo_pago_id: z.coerce.number().int(),
    }).parse(body);

    // Validar verificación
    const verif: any = await (prisma as any).verificaciones_correo.findUnique({ where: { id: parsed.verification_id } });
    if (!verif || verif.correo_electronico !== parsed.correo_electronico) return res.status(400).json({ error: 'Verificación inválida' });
    if (verif.usado) return res.status(400).json({ error: 'La verificación ya fue usada' });
    if (!verif.verificado || String(verif.codigo) !== String(parsed.verification_code)) return res.status(400).json({ error: 'Código no verificado' });
    if (new Date(verif.expiracion).getTime() < Date.now()) return res.status(400).json({ error: 'Verificación expirada' });

    if (!req.file) return res.status(400).json({ error: 'Archivo comprobante requerido' });

    // Reutilizar cliente solo si TODOS los campos coinciden exactamente
    const existente = await prisma.clientes.findFirst({
      where: {
        nombres: parsed.nombres,
        apellidos: parsed.apellidos,
        cedula: parsed.cedula,
        correo_electronico: parsed.correo_electronico,
        telefono: parsed.telefono,
        direccion: parsed.direccion,
      },
    });

    const cliente =
      existente ??
      (await prisma.clientes.create({
        data: {
          nombres: parsed.nombres,
          apellidos: parsed.apellidos,
          cedula: parsed.cedula,
          correo_electronico: parsed.correo_electronico,
          telefono: parsed.telefono,
          direccion: parsed.direccion,
        } as any,
      }));

    // Calcular monto/cantidad igual que en /orders
    const sorteo = await prisma.sorteos.findUnique({ where: { id: parsed.sorteo_id } });
    if (!sorteo) return res.status(404).json({ error: 'Sorteo no encontrado' });
    let cantidad = parsed.cantidad_numeros ?? 0;
    let monto_total = 0;
    if (parsed.paquete_id) {
      const paquete: any = await (prisma as any).paquetes.findUnique({ where: { id: BigInt(parsed.paquete_id) } });
      if (!paquete || paquete.sorteo_id !== parsed.sorteo_id || paquete.estado !== 'publicado') return res.status(400).json({ error: 'Paquete inválido' });
      cantidad = Number(paquete.cantidad_numeros || 0);
      monto_total = Number(paquete.precio_total || 0);
    } else if (cantidad > 0) {
      monto_total = Number(sorteo.precio_por_numero) * cantidad;
    } else {
      return res.status(400).json({ error: 'Debe indicar cantidad_numeros o paquete_id' });
    }

    const codigo = `OR-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ruta = path.relative(process.cwd(), req.file.path).replace(/\\/g, "/");
    const metodoPago = await (prisma as any).metodos_pago.findUnique({ where: { id: BigInt(parsed.metodo_pago_id) } });

    // Validación previa de stock disponible
    const disponibles = await prisma.numeros_sorteo.count({ where: { sorteo_id: parsed.sorteo_id, estado: 'disponible' } });
    if (disponibles < cantidad) {
      return res.status(400).json({ error: `No hay suficientes números disponibles para este sorteo. Quedan ${disponibles} y solicitaste ${cantidad}.` });
    }
    const orden = await prisma.ordenes.create({
      data: {
        codigo,
        cliente_id: cliente.id,
        sorteo_id: parsed.sorteo_id,
        metodo_pago_id: BigInt(parsed.metodo_pago_id),
        metodo_pago: (metodoPago?.nombre as string) ?? null,
        estado_pago: 'pendiente',
        monto_total,
        cantidad_numeros: cantidad,
        ruta_comprobante: ruta,
      } as any
    });

    // Reservar números disponibles para esta orden (igual que /orders)
    await prisma.$transaction(async (tx) => {
      const seleccion = await (tx as any).$queryRaw<{ id: bigint }[]>`
        SELECT id FROM numeros_sorteo
        WHERE sorteo_id = ${parsed.sorteo_id} AND estado = 'disponible'
        ORDER BY random()
        LIMIT ${cantidad}
        FOR UPDATE SKIP LOCKED
      `;
      if (seleccion.length < cantidad) {
        throw new Error(`No hay suficientes números disponibles para reservar (${seleccion.length}/${cantidad}).`);
      }
      const ids = seleccion.map((s: { id: bigint }) => s.id);
      await tx.numeros_sorteo.updateMany({ where: { id: { in: ids } }, data: { estado: 'reservado', orden_id: orden.id } });
    });

    // Marcar verificación como usada
    await (prisma as any).verificaciones_correo.update({ where: { id: parsed.verification_id }, data: { usado: true } });

    res.json({ cliente, orden });
    // Correo orden recibida (upload comprobante)
    try {
      if (cliente?.correo_electronico) {
        const { sendMail } = await import('../utils/mailer');
        const { correoOrdenRecibida } = await import('../emails/templates');
        const sorteoNombre = sorteo?.nombre || '';
        const html = correoOrdenRecibida({
          clienteNombre: cliente.nombres || '',
          codigo,
          sorteoNombre,
          cantidad,
          monto: `$${monto_total.toFixed(2)}`,
          metodoPago: metodoPago?.nombre || undefined,
          logoUrl: process.env.BRAND_LOGO_URL || null,
          year: new Date().getFullYear()
        });
        await sendMail({ to: cliente.correo_electronico, subject: `Orden recibida ${codigo}`, html });
      }
    } catch (e) { console.error('Error correo orden recibida upload:', e); }
  } catch (e) {
    next(e);
  }
});

// Ver orden (si no está aprobada, ocultar items)
publicRouter.get("/orders/:id", async (req, res, next) => {
  try {
    const params = z.object({ id: z.string() }).parse(req.params);
    const ordenId = BigInt(params.id);

    const orden = await prisma.ordenes.findUnique({
      where: { id: ordenId },
      include: {
        items: true,
        metodo_pago_ref: true,
      },
    });
    if (!orden) return res.status(404).json({ error: "Orden no encontrada" });

    if (orden.estado_pago !== "aprobado") {
      const { items, ...rest } = orden as any;
      return res.json({ orden: rest });
    }
    res.json({ orden });
  } catch (e) {
    next(e);
  }
});


