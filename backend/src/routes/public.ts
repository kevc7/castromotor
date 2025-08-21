
// ...existing code...

import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import path from "node:path";
import fs from "node:fs";
import multer from "multer";
import { prisma } from "../db";
import crypto from 'node:crypto';
import https from 'node:https';
import http from 'node:http';
import dns from 'node:dns';

/**
 * Obtiene el token Payphone estático desde las variables de entorno
 * La cajita de pagos usa tokens estáticos del panel, no tokens dinámicos
 */
async function getPayphoneToken(): Promise<string> {
  const token = process.env.PAYPHONE_TOKEN;
  if (!token?.trim()) {
    throw new Error('PAYPHONE_TOKEN no está configurado en las variables de entorno');
  }
  return token.trim();
}


const RAW_PAYPHONE_BASE = process.env.PAYPHONE_BASE_URL || 'https://pay.payphonetodoesposible.com';
// Sanitizar: si alguien dejó sandbox.*, forzamos a pay.* para entorno productivo
const PAYPHONE_BASE_URL = RAW_PAYPHONE_BASE.includes('sandbox.')
  ? RAW_PAYPHONE_BASE.replace('sandbox.', 'pay.')
  : RAW_PAYPHONE_BASE;
if (RAW_PAYPHONE_BASE !== PAYPHONE_BASE_URL) {
  console.warn('⚠️  PAYPHONE_BASE_URL contenía sandbox, se reemplazó por:', PAYPHONE_BASE_URL);
}
console.log('🔧 PAYPHONE_BASE_URL activo:', PAYPHONE_BASE_URL);

// Forzar IPv4 en VPS que presenten problemas con IPv6/TLS
const PAYPHONE_FORCE_IPV4 = String(process.env.PAYPHONE_FORCE_IPV4 || 'true').toLowerCase() === 'true';
// Nota: no usar el tipo 'typeof dns.lookup' porque exige __promisify__; para https.RequestOptions basta con esta firma
const ipv4Lookup = (hostname: string, options: any, callback: any) => {
  const opts = typeof options === 'function' ? {} : (options || {});
  return dns.lookup(hostname, { ...opts, family: 4 }, callback);
};

// Helper: POST JSON con IPv4 forzado y timeout
async function postJson(urlStr: string, headers: Record<string,string>, bodyStr: string, timeoutMs = 12_000): Promise<{ status: number; ok: boolean; text: string; }> {
  const u = new URL(urlStr);
  const isHttps = u.protocol === 'https:';
  const options: https.RequestOptions = {
    method: 'POST',
    hostname: u.hostname,
    port: u.port ? Number(u.port) : (isHttps ? 443 : 80),
    path: `${u.pathname}${u.search}`,
    headers,
    // lookup permite forzar IPv4
    lookup: PAYPHONE_FORCE_IPV4 ? (ipv4Lookup as any) : undefined,
  };
  return await new Promise((resolve, reject) => {
    const req = (isHttps ? https : http).request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (d) => chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        const status = res.statusCode || 0;
        resolve({ status, ok: status >= 200 && status < 300, text });
      });
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('ETIMEDOUT'));
    });
    req.on('error', (err) => reject(err));
    req.write(bodyStr);
    req.end();
  });
}

export const publicRouter = Router();

// Helper: confirm Payphone transaction with multiple strategies and better diagnostics
async function confirmarPayphoneMulti(opts: { token: string; storeId?: string; id?: number; clientTx: string; loggerPrefix: string; }): Promise<{ approved: boolean; pending: boolean; terminal: boolean; statusNorm: string; data: any; source: string; htmlBody?: boolean; attempts: any[]; }> {
  const attempts: any[] = [];
  const headers = {
    'Authorization': `Bearer ${opts.token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'Castromotor-Server/1.0 (+https://castromotor.com.ec)'
  } as any;
  type FetchResp = any; // evitar conflicto con tipo Response de Express
  const recordAttempt = (label: string, resp: FetchResp | null, raw: string | null, parsed: any, error?: any, meta?: Record<string, any>) => {
    attempts.push({ label, status: (resp as any)?.status, ok: !!(resp as any)?.ok, rawSnippet: raw ? raw.slice(0,180) : null, parsedKeys: parsed && typeof parsed === 'object' ? Object.keys(parsed) : null, error: error ? (error.message || String(error)) : undefined, ...(meta || {}) });
  };
  const decode = (raw: string) => { try { return JSON.parse(raw); } catch { return { raw }; } };
  // Strategy A: button/V2/Confirm with clientTxId
  try {
    const body = JSON.stringify({ id: opts.id, clientTxId: opts.clientTx });
  const url = `${PAYPHONE_BASE_URL}/api/button/V2/Confirm`;
  const resp = await postJson(url, headers, body);
  const raw = resp.text;
  const parsed = decode(raw);
  recordAttempt('button:clientTxId', resp as any, raw, parsed, undefined, { url });
    const statusNorm = String(parsed?.transactionStatus || parsed?.status || '').toLowerCase();
    if (resp.ok && statusNorm === 'approved') return { approved: true, pending: false, terminal: true, statusNorm, data: parsed, source: 'button:clientTxId', htmlBody: raw.trim().startsWith('<'), attempts };
    if (['pending','processing','created'].includes(statusNorm)) return { approved: false, pending: true, terminal: false, statusNorm, data: parsed, source: 'button:clientTxId', htmlBody: raw.trim().startsWith('<'), attempts };
    if (['rejected','canceled','cancelled','failed','declined','error'].includes(statusNorm)) return { approved: false, pending: false, terminal: true, statusNorm, data: parsed, source: 'button:clientTxId', htmlBody: raw.trim().startsWith('<'), attempts };
    // Fallthrough to next strategy
  } catch (e:any) { recordAttempt('button:clientTxId', null, null, null, e); }
  // Strategy B: button/V2/Confirm with clientTransactionId (alternative naming)
  try {
    const body = JSON.stringify({ id: opts.id, clientTransactionId: opts.clientTx });
  const url = `${PAYPHONE_BASE_URL}/api/button/V2/Confirm`;
  const resp = await postJson(url, headers, body);
  const raw = resp.text;
  const parsed = decode(raw);
  recordAttempt('button:clientTransactionId', resp as any, raw, parsed, undefined, { url });
    const statusNorm = String(parsed?.transactionStatus || parsed?.status || '').toLowerCase();
    if (resp.ok && statusNorm === 'approved') return { approved: true, pending: false, terminal: true, statusNorm, data: parsed, source: 'button:clientTransactionId', htmlBody: raw.trim().startsWith('<'), attempts };
    if (['pending','processing','created'].includes(statusNorm)) return { approved: false, pending: true, terminal: false, statusNorm, data: parsed, source: 'button:clientTransactionId', htmlBody: raw.trim().startsWith('<'), attempts };
    if (['rejected','canceled','cancelled','failed','declined','error'].includes(statusNorm)) return { approved: false, pending: false, terminal: true, statusNorm, data: parsed, source: 'button:clientTransactionId', htmlBody: raw.trim().startsWith('<'), attempts };
  } catch (e:any) { recordAttempt('button:clientTransactionId', null, null, null, e); }
  // Strategy C: Sale/Confirm (requiere storeId)
  if (opts.storeId) {
    try {
      const body = JSON.stringify({ storeId: opts.storeId, clientTransactionId: opts.clientTx });
  const url = `${PAYPHONE_BASE_URL}/api/Sale/Confirm`;
  const resp = await postJson(url, headers, body);
  const raw = resp.text;
  const parsed = decode(raw);
  recordAttempt('sale:clientTransactionId', resp as any, raw, parsed, undefined, { url });
      const statusNorm = String(parsed?.transactionStatus || parsed?.status || '').toLowerCase();
      if (resp.ok && statusNorm === 'approved') return { approved: true, pending: false, terminal: true, statusNorm, data: parsed, source: 'sale:clientTransactionId', htmlBody: raw.trim().startsWith('<'), attempts };
      if (['pending','processing','created'].includes(statusNorm)) return { approved: false, pending: true, terminal: false, statusNorm, data: parsed, source: 'sale:clientTransactionId', htmlBody: raw.trim().startsWith('<'), attempts };
      if (['rejected','canceled','cancelled','failed','declined','error'].includes(statusNorm)) return { approved: false, pending: false, terminal: true, statusNorm, data: parsed, source: 'sale:clientTransactionId', htmlBody: raw.trim().startsWith('<'), attempts };
    } catch (e:any) { recordAttempt('sale:clientTransactionId', null, null, null, e); }
  }
  // Unknown situation
  // Clasificación adicional para diagnósticos cuando no se obtuvo estado claro
  const anyResp = attempts.some(a => typeof a.status === 'number');
  const htmlBody = attempts.some(a => a.rawSnippet && a.rawSnippet.trim().startsWith('<'));
  const authErr = attempts.some(a => a.status === 401 || a.status === 403);
  const notFound = attempts.some(a => a.status === 404);
  const serverErr = attempts.some(a => a.status && a.status >= 500);
  // Ampliamos patrón para detectar más errores típicos de fetch / red
  const networkErr = attempts.some(a => a.error && /(ENOTFOUND|ECONNREFUSED|EAI_AGAIN|ECONNRESET|ETIMEDOUT|fetch failed|socket hang up|request aborted)/i.test(a.error));
  let classified = !anyResp ? 'no_response' : 'unknown';
  if (authErr) classified = 'auth_error';
  else if (networkErr) classified = 'network_error';
  else if (htmlBody) classified = 'html_error';
  else if (notFound) classified = 'endpoint_not_found';
  else if (serverErr) classified = 'remote_5xx';
  const data = { attempts, classified };
  if (classified === 'no_response' || classified === 'network_error') {
    console.error(`[Payphone Confirm Debug][${opts.loggerPrefix}] Clasificación: ${classified}. Attempts detallados:`, attempts);
  }
  return { approved: false, pending: false, terminal: true, statusNorm: classified, data, source: 'none', htmlBody, attempts };
}
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
    let token: string;
    try {
      token = await getPayphoneToken();
    } catch (tokenError) {
      console.error('❌ Error obteniendo token Payphone:', tokenError);
      return res.status(500).json({ error: 'Error de configuración del servidor de pagos.' });
    }

    // Convertir a centavos como requiere Payphone
    const amountCents = Math.round(monto_total * 100); // total en centavos
    const baseCents = Math.round(amountCents / 1.12);  // base gravada aproxima
    const taxCents = amountCents - baseCents;          // IVA calculado
    const amountWithTaxCents = baseCents;              // base gravada
    const amountWithoutTaxCents = 0;                   // no hay parte 0% IVA
    const reconstructed = amountWithTaxCents + amountWithoutTaxCents + taxCents; // sin tip/service
    if (reconstructed !== amountCents) {
      console.warn('⚠️  Discrepancia en suma montos Payphone', { amountCents, reconstructed, amountWithTaxCents, amountWithoutTaxCents, taxCents });
    }
    console.log('💰 [Payphone INIT] Breakdown:', { amountCents, amountWithTaxCents, amountWithoutTaxCents, taxCents });

    // Configuración para la Cajita de Pagos (según documentación oficial)
    // Truncar reference a máximo 60 caracteres (límite habitual en gateways)
    const fullRef = `Orden ${codigo} - ${sorteo.nombre}`;
    const reference = fullRef.length > 60 ? fullRef.slice(0,57) + '...' : fullRef;

    const payphoneConfig = {
      token: token,
      clientTransactionId: clientTxnId,
      amount: amountCents,
      amountWithoutTax: amountWithoutTaxCents,
      amountWithTax: amountWithTaxCents,
      tax: taxCents,
      service: 0,
      tip: 0,
      currency: "USD",
      storeId: process.env.PAYPHONE_STORE_ID || undefined, // Opcional según documentación
      reference,
      lang: "es",
      defaultMethod: "card",
      timeZone: -5,
      // Datos del cliente (obligatorios según documentación)
      phoneNumber: body.telefono ? `+593${body.telefono.replace(/[^0-9]/g, '')}` : undefined,
      email: body.correo_electronico,
      documentId: body.cedula || undefined,
      identificationType: 1, // Cédula
      // URLs de respuesta
    // URL configurada en el panel de Payphone para recibir notificaciones de estado
    responseUrl: `https://castromotor.com.ec/api/checkout/payphone/webhook`,
    // Si el usuario cierra o cancela desde Payphone, lo enviamos de vuelta al checkout para que pueda reintentar
    cancellationUrl: `${process.env.FRONTEND_URL}/checkout/${body.sorteo_id}?resultado=payphone_fail&reason=cancelado_usuario`,
    };

    console.log('✅ [Payphone INIT] Configuración generada:', {
      orden_id: orden.id,
      codigo,
      clientTransactionId: clientTxnId,
      amount: amountCents,
      amountWithTax: amountWithTaxCents,
      amountWithoutTax: amountWithoutTaxCents,
      tax: taxCents,
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

    const q: any = req.query || {};
    const clientTransactionId = q.clientTransactionId || q.clientTxId || q.clientTxID || q.clientTxid;
    const id = q.id || q.transactionId;

    if (!id || !clientTransactionId) {
      console.log('❌ [Payphone Response] Parámetros faltantes (id o clientTx)');
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

    const storeId = process.env.PAYPHONE_STORE_ID || undefined;
    let token: string;
    try {
      token = await getPayphoneToken();
    } catch (tokenError) {
      console.error('❌ [Payphone Response] Error obteniendo token:', tokenError);
      return res.redirect(`${process.env.FRONTEND_URL}/checkout/${(pago.orden as any).sorteo_id}?resultado=payphone_fail&orden=${pago.orden.codigo}&reason=conf_no_token`);
    }
    const cid = parseInt(id);
    const confirm = await confirmarPayphoneMulti({ token, storeId, id: isNaN(cid) ? undefined : cid, clientTx: clientTransactionId, loggerPrefix: 'response' });
    console.log('🔍 [Payphone Response] Resultado multi-confirm:', confirm.statusNorm, 'source:', confirm.source, 'approved:', confirm.approved, 'pending:', confirm.pending, 'htmlBody:', confirm.htmlBody);
    if (confirm.approved) {
      await procesarPagoAprobado(pago, confirm.data);
      const sorteoId = (pago.orden as any).sorteo_id;
      return res.redirect(`${process.env.FRONTEND_URL}/checkout/${sorteoId}?resultado=payphone_ok&orden=${pago.orden.codigo}&ordenId=${pago.orden.id}`);
    }
    if (confirm.pending) {
      const sorteoId = (pago.orden as any).sorteo_id;
      return res.redirect(`${process.env.FRONTEND_URL}/checkout/${sorteoId}?resultado=payphone_pending&orden=${pago.orden.codigo}&ordenId=${pago.orden.id}&clientTx=${encodeURIComponent(clientTransactionId)}`);
    }
    // Terminal negativo o desconocido
    if (['rejected','canceled','cancelled','failed','declined','error'].includes(confirm.statusNorm)) {
      await liberarReservas(pago.orden_id);
    } else if (confirm.statusNorm === 'unknown' || confirm.statusNorm === 'no_response') {
      // No liberar aún si queremos permitir un reintento de confirm manual. Por ahora liberamos para evitar bloqueo.
      await liberarReservas(pago.orden_id);
    }
    const sorteoId = (pago.orden as any).sorteo_id;
  // Guardar raw diagnóstico en pago para soporte
  try { await (prisma as any).pagos_payphone.update({ where: { id: pago.id }, data: { status: confirm.statusNorm.toUpperCase(), raw: confirm.data } }); } catch {}
  return res.redirect(`${process.env.FRONTEND_URL}/checkout/${sorteoId}?resultado=payphone_fail&orden=${pago.orden.codigo}&reason=${encodeURIComponent(confirm.statusNorm)}`);

  } catch (e) {
    console.error('❌ Error en respuesta Payphone:', e);
    return res.redirect(`${process.env.FRONTEND_URL}/?error=payphone_response_error`);
  }
});

// Webhook Payphone (POST) - para compatibilidad si Payphone envía notificaciones server->server
// Documentación usual envía campos: id (int), clientTxId (string) / transactionStatus, amount, etc.
// Asegura idempotencia buscando pago existente y su estado.
publicRouter.post('/payphone/webhook', async (req: Request, res: Response) => {
  console.log('🛰️  [Payphone Webhook] Payload recibido:', req.body);
  try {
    const schema = z.object({
      id: z.number().int().optional(),          // id transacción Payphone
      transactionId: z.number().int().optional(),
      clientTxId: z.string().min(5),            // nuestro UUID
      transactionStatus: z.string().optional(),
      status: z.string().optional(),            // a veces usan 'status'
      amount: z.number().optional(),
    });
    const data = schema.parse(req.body);

    const clientTx = data.clientTxId;
    const pago: any = await (prisma as any).pagos_payphone.findUnique({ where: { client_txn_id: clientTx }, include: { orden: true } });
    if (!pago) {
      console.warn('⚠️  [Payphone Webhook] Pago no encontrado para clientTxId', clientTx);
      return res.status(404).json({ ok: false, error: 'Pago no encontrado' });
    }
    if (pago.status === 'APPROVED') {
      console.log('ℹ️  [Payphone Webhook] Pago ya aprobado (idempotente)');
      return res.json({ ok: true, alreadyApproved: true });
    }

    // Confirmar con API oficial si aún no tenemos certeza de estado
    let token: string;
    try {
      token = await getPayphoneToken();
    } catch (tokenError) {
      console.error('❌ [Payphone Webhook] Error obteniendo token:', tokenError);
      return res.status(500).json({ ok: false, error: 'Error obteniendo token Payphone' });
    }

    const multi = await confirmarPayphoneMulti({ token, storeId: process.env.PAYPHONE_STORE_ID, id: data.id ?? data.transactionId, clientTx, loggerPrefix: 'webhook' });
    console.log('🔎 [Payphone Webhook] Multi-confirm status:', multi.statusNorm, 'approved:', multi.approved, 'pending:', multi.pending);
    if (multi.approved) {
      await procesarPagoAprobado(pago, multi.data);
      return res.json({ ok: true, approved: true });
    } else if (['rejected','canceled','cancelled','failed','declined','error'].includes(multi.statusNorm)) {
      await liberarReservas(pago.orden_id);
      await (prisma as any).pagos_payphone.update({ where: { id: pago.id }, data: { status: multi.statusNorm.toUpperCase(), raw: multi.data } });
      return res.json({ ok: true, approved: false, status: multi.statusNorm });
    } else {
      console.log('ℹ️  [Payphone Webhook] Estado no final o desconocido:', multi.statusNorm);
      return res.json({ ok: true, pending: true, status: multi.statusNorm });
    }
  } catch (e) {
    console.error('❌ [Payphone Webhook] Error procesando payload:', e);
    return res.status(400).json({ ok: false, error: e instanceof Error ? e.message : 'Error' });
  }
});

// Ruta legacy que podría estar configurada externamente
publicRouter.post('/checkout/payphone/webhook', async (req: Request, res: Response) => {
  console.log('🛰️  [Legacy Webhook] Redirigiendo a /payphone/webhook');
  // Reutilizamos la lógica anterior llamando internamente
  (req as any).url = '/payphone/webhook';
  (publicRouter as any).handle(req, res, () => { res.status(500).json({ ok: false, error: 'Fallback interno falló' }); });
});

// Legacy GET redirect (Payphone puede redirigir al endpoint viejo con query params ?id= & clientTransactionId= )
publicRouter.get('/checkout/payphone/webhook', async (req: Request, res: Response) => {
  try {
    console.log('🛰️  [Legacy GET Redirect] Reenviando a /payphone/response con query:', req.query);
    // Preservar query string al reenviar internamente
    const originalQsIndex = req.originalUrl.indexOf('?');
    const qs = originalQsIndex >= 0 ? req.originalUrl.substring(originalQsIndex) : '';
    (req as any).url = '/payphone/response' + qs; // reutiliza el handler existente
  (publicRouter as any).handle(req, res, () => {
      console.error('❌ [Legacy GET Redirect] Fallback interno falló');
      res.redirect(`${process.env.FRONTEND_URL}/payphone/error?reason=legacy_forward_error`);
    });
  } catch (e) {
    console.error('❌ [Legacy GET Redirect] Error reenviando:', e);
    res.redirect(`${process.env.FRONTEND_URL}/payphone/error?reason=legacy_exception`);
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
    let token: string;
    const storeId = process.env.PAYPHONE_STORE_ID || '';
    
    try {
      token = await getPayphoneToken();
      console.log('🔍 Payphone config:', { 
        storeId, 
        tokenLength: token.length, 
        tokenPreview: token.substring(0, 10) + '...',
        mock: process.env.PAYPHONE_MOCK 
      });
    } catch (tokenError) {
      console.error('❌ [Payphone Confirm] Error obteniendo token:', tokenError);
      return res.status(500).json({ error: 'Error obteniendo token Payphone' });
    }
    
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
      
  const confirmUrl = `${PAYPHONE_BASE_URL}/api/Sale/Confirm`;
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
    
    let token: string;
    const storeId = process.env.PAYPHONE_STORE_ID || '';
    
    try {
      token = await getPayphoneToken();
      console.log('🔍 Payphone credentials check:', {
        tokenOk: true,
        hasStoreId: !!storeId,
        tokenLength: token.length,
        tokenPreview: token.substring(0, 20) + '...',
        storeId,
        clientIdLength: process.env.PAYPHONE_CLIENT_ID?.length || 0,
        clientSecretLength: process.env.PAYPHONE_CLIENT_SECRET?.length || 0
      });
    } catch (tokenError) {
      console.error('❌ [Payphone Debug] Error obteniendo token:', tokenError);
      return res.status(400).json({
        error: 'Error obteniendo token Payphone',
        details: tokenError instanceof Error ? tokenError.message : String(tokenError)
      });
    }
    
    if (!storeId) {
      return res.status(400).json({
        error: 'StoreId no configurado'
      });
    }
    
    // Probar conexión básica con Payphone
    try {
  const testUrl = `${PAYPHONE_BASE_URL}/api/Sale/Confirm`;
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

// Endpoint adicional para diagnóstico exclusivo del token
publicRouter.get('/payments/payphone/token-check', async (_req: Request, res: Response) => {
  try {
    let token: string;
    try {
      token = await getPayphoneToken();
      return res.json({
        ok: true,
        tokenLength: token.length,
        tokenSource: 'env_static',
        tokenConfigured: !!process.env.PAYPHONE_TOKEN,
        tokenPreview: token.substring(0, 20) + '...',
        message: 'Cajita de pagos usa token estático del panel'
      });
    } catch (e) {
      return res.status(500).json({
        ok: false,
        error: e instanceof Error ? e.message : String(e)
      });
    }
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: 'Error interno al verificar token'
    });
  }
});

// Endpoint para diagnóstico profundo de conectividad
publicRouter.get('/payments/payphone/connectivity-check', async (_req: Request, res: Response) => {
  try {
    const results: Record<string, any> = {
      tests: {},
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        env: {
          hasHttpProxy: !!process.env.http_proxy || !!process.env.HTTP_PROXY,
          hasHttpsProxy: !!process.env.https_proxy || !!process.env.HTTPS_PROXY,
          payphone: {
            baseUrl: PAYPHONE_BASE_URL,
            hasStoreId: !!process.env.PAYPHONE_STORE_ID,
            hasClientId: !!process.env.PAYPHONE_CLIENT_ID,
            hasClientSecret: !!process.env.PAYPHONE_CLIENT_SECRET,
            hasStaticToken: !!process.env.PAYPHONE_TOKEN
          }
        }
      }
    };
    
    // Test 1: Basic HTTPS request to Google (verify general connectivity)
    try {
      console.log('🔍 Prueba conectividad a Google...');
      const googleResp = await fetch('https://www.google.com/robots.txt', { 
        method: 'GET',
        headers: { 'User-Agent': 'PayphoneConnectivityTest/1.0' }
      });
      results.tests.google = {
        ok: googleResp.ok,
        status: googleResp.status,
        statusText: googleResp.statusText
      };
    } catch (e: any) {
      results.tests.google = {
        ok: false,
        error: e.message || String(e),
        type: e.name || 'Unknown',
        code: e.code
      };
    }
    
    // Test 2: DNS lookup (using fetch to domain with invalid path)
    try {
      console.log('🔍 Prueba DNS para Payphone...');
      const dnsTestResp = await fetch(`${PAYPHONE_BASE_URL}/dns-test-${Date.now()}`, { 
        method: 'GET',
        headers: { 'User-Agent': 'PayphoneConnectivityTest/1.0' }
      });
      results.tests.dns = {
        ok: true, // Si llegamos aquí, el DNS resolvió
        status: dnsTestResp.status,
        statusText: dnsTestResp.statusText
      };
    } catch (e: any) {
      results.tests.dns = {
        ok: false,
        error: e.message || String(e),
        type: e.name || 'Unknown',
        code: e.code,
        // Diferenciamos entre error DNS vs. otros errores
        isDnsError: e.message?.includes('getaddrinfo') || e.message?.includes('ENOTFOUND')
      };
    }
    
    // Test 3: Conexión básica a Payphone (robots.txt o similar)
    try {
      console.log('🔍 Prueba conectividad básica a Payphone...');
      const baseResp = await fetch(`${PAYPHONE_BASE_URL}/robots.txt`, { 
        method: 'GET',
        headers: { 'User-Agent': 'PayphoneConnectivityTest/1.0' }
      });
      results.tests.payphone = {
        ok: baseResp.ok,
        status: baseResp.status,
        statusText: baseResp.statusText
      };
    } catch (e: any) {
      results.tests.payphone = {
        ok: false,
        error: e.message || String(e),
        type: e.name || 'Unknown',
        code: e.code
      };
    }
    
    // Test 4: Intento GetToken directo (API)
    try {
      console.log('🔍 Prueba API GetToken...');
      const clientId = process.env.PAYPHONE_CLIENT_ID;
      const clientSecret = process.env.PAYPHONE_CLIENT_SECRET;
      
      if (!clientId || !clientSecret) {
        results.tests.getToken = {
          ok: false,
          error: 'Faltan credenciales CLIENT_ID/SECRET'
        };
      } else {
        const url = `${PAYPHONE_BASE_URL}/api/GetToken`;
        const getTokenResp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, clientSecret })
        });
        
        const text = await getTokenResp.text();
        results.tests.getToken = {
          ok: getTokenResp.ok,
          status: getTokenResp.status,
          statusText: getTokenResp.statusText,
          response: text.substring(0, 200) // Limitar por seguridad
        };
      }
    } catch (e: any) {
      results.tests.getToken = {
        ok: false,
        error: e.message || String(e),
        type: e.name || 'Unknown',
        code: e.code
      };
    }
    
    // Diagnóstico final
    let diagnosis = 'unknown';
    if (!results.tests.google.ok) {
      diagnosis = 'no_internet';
    } else if (!results.tests.dns.ok && results.tests.dns.isDnsError) {
      diagnosis = 'dns_failure';
    } else if (!results.tests.payphone.ok) {
      diagnosis = 'payphone_connection_error';
    } else if (!results.tests.getToken.ok) {
      diagnosis = 'api_error';
    } else {
      diagnosis = 'seems_ok';
    }
    
    results.diagnosis = diagnosis;
    
    console.log('✅ Diagnóstico completado:', diagnosis);
    return res.json(results);
    
  } catch (e) {
    console.error('❌ Error en prueba de conectividad:', e);
    return res.status(500).json({
      ok: false,
      error: e instanceof Error ? e.message : String(e)
    });
  }
});

// Cancelar orden (usuario cierra o cancela el flujo antes de completar Payphone o decide abortar)
publicRouter.post('/orders/:id/cancel', async (req: Request, res: Response) => {
  try {
    const ordenId = BigInt(req.params.id);
    const orden: any = await prisma.ordenes.findUnique({ where: { id: ordenId }, include: { cliente: true, sorteo: true } });
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });
    if (['aprobado','cancelado'].includes(orden.estado_pago)) {
      return res.status(400).json({ error: 'La orden ya no se puede cancelar' });
    }
    // Liberar reservas y marcar cancelado
    await prisma.$transaction(async (tx) => {
      await tx.numeros_sorteo.updateMany({ where: { orden_id: ordenId, estado: 'reservado' }, data: { estado: 'disponible', orden_id: null } });
      await tx.ordenes.update({ where: { id: ordenId }, data: { estado_pago: 'cancelado' } });
    });
    // Enviar correo (best-effort)
    if (orden?.cliente?.correo_electronico) {
      try {
        const { sendMail } = await import('../utils/mailer');
        const { correoCancelacion } = await import('../emails/templates');
        const html = correoCancelacion({ clienteNombre: orden.cliente.nombres || '', codigo: orden.codigo, sorteoNombre: orden.sorteo?.nombre, motivo: 'Pago cancelado por usuario', logoUrl: process.env.BRAND_LOGO_URL || null, year: new Date().getFullYear() });
        await sendMail({ to: orden.cliente.correo_electronico, subject: `Orden ${orden.codigo} cancelada`, html });
      } catch (mailErr) {
        console.error('⚠️  Error enviando correo cancelación:', mailErr);
      }
    }
    res.json({ ok: true, orden_id: ordenId });
  } catch (e) {
    console.error('❌ Error en cancelación de orden:', e);
    res.status(500).json({ error: 'Error cancelando orden' });
  }
});

// Polling de estado Payphone por clientTxId (frontend puede consultar mientras está pendiente)
publicRouter.get('/payments/payphone/status/:clientTxId', async (req: Request, res: Response) => {
  try {
    const clientTxId = req.params.clientTxId;
    const pago: any = await (prisma as any).pagos_payphone.findUnique({ where: { client_txn_id: clientTxId }, include: { orden: true } });
    if (!pago) return res.status(404).json({ ok: false, error: 'No encontrado' });
    // Estados ya determinados localmente
    if (pago.status === 'APPROVED') return res.json({ ok: true, status: 'approved', orden: pago.orden });
    if (['FAILED','REJECTED','CANCELED','CANCELLED','DECLINED','ERROR'].includes(pago.status)) return res.json({ ok: true, status: 'failed' });
    let token: string;
    try {
      token = await getPayphoneToken();
    } catch (tokenError) {
      console.error('❌ [Payphone Status] Error obteniendo token:', tokenError);
      return res.json({ ok: true, status: 'pending', error: 'token_error' });
    }
    const multi = await confirmarPayphoneMulti({ token, storeId: process.env.PAYPHONE_STORE_ID, id: pago.payphone_txn_id ? Number(pago.payphone_txn_id) : undefined, clientTx: clientTxId, loggerPrefix: 'poll' });
    if (multi.approved) {
      await procesarPagoAprobado(pago, multi.data);
      return res.json({ ok: true, status: 'approved', orden: pago.orden });
    }
    if (['rejected','canceled','cancelled','failed','declined','error'].includes(multi.statusNorm)) {
      await liberarReservas(pago.orden_id);
      await (prisma as any).pagos_payphone.update({ where: { id: pago.id }, data: { status: multi.statusNorm.toUpperCase(), raw: multi.data } });
      return res.json({ ok: true, status: 'failed' });
    }
    return res.json({ ok: true, status: 'pending' });
  } catch (e) {
    console.error('❌ Error polling estado Payphone:', e);
    res.status(500).json({ ok: false, error: 'Error interno' });
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


