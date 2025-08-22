import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { asignarNumerosAPremios } from "../services/premios";
import { Prisma } from "@prisma/client";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';
// Social posts: CRUD simple

export const adminRouter = Router();

// Auth: login admin -> JWT
adminRouter.post('/auth/login', async (req, res, next) => {
  try {
    const body = z.object({ usuario: z.string().min(3), contrasena: z.string().min(4) }).parse(req.body);
    const user: any = await (prisma as any).usuarios.findFirst({
      where: {
        OR: [
          { nombre_usuario: body.usuario },
          { correo_electronico: body.usuario },
        ],
      },
    });
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });
    const ok = await bcrypt.compare(body.contrasena, user.contrasena_hash);
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });
    const token = jwt.sign({ uid: String(user.id), rol: user.rol || 'admin' }, process.env.JWT_SECRET || 'secret', { expiresIn: '12h' });
    res.json({ token, usuario: { id: user.id, correo_electronico: user.correo_electronico, nombre_usuario: user.nombre_usuario } });
  } catch (e) { next(e); }
});

function requireAuth(req: any, res: any, next: any) {
  try {
    const header = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'No autorizado' });
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    next();
  } catch { return res.status(401).json({ error: 'Token inválido' }); }
}

// Helpers para almacenamiento de imágenes de sorteos
function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

const uploadsRoot = path.resolve(process.cwd(), 'uploads');
ensureDir(uploadsRoot);

const sorteosRoot = path.resolve(uploadsRoot, 'sorteos');
ensureDir(sorteosRoot);

const storageSorteos = multer.diskStorage({
  destination: (req, _file, cb) => {
    const id = String((req.params as any)?.id || 'tmp');
    const dir = path.resolve(sorteosRoot, id);
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const name = `${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`;
    cb(null, name);
  }
});
const uploadSorteos = multer({
  storage: storageSorteos,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const ok = /image\/(jpeg|png|webp)/.test(file.mimetype);
    if (!ok) return (cb as unknown as (err: any, acceptFile?: boolean) => void)(new Error('Tipo de archivo inválido'));
    (cb as unknown as (err: any, acceptFile?: boolean) => void)(null, true);
  }
});
// Estadísticas generales de órdenes/ventas
adminRouter.get('/stats', requireAuth, async (_req, res, next) => {
  try {
    const [sumAprobadas, sumTickets, pendientes, aprobadas] = await Promise.all([
      prisma.ordenes.aggregate({ _sum: { monto_total: true }, where: { estado_pago: 'aprobado' } }) as any,
      prisma.ordenes.aggregate({ _sum: { cantidad_numeros: true }, where: { estado_pago: 'aprobado' } }) as any,
      prisma.ordenes.count({ where: { estado_pago: 'pendiente' } }),
      prisma.ordenes.count({ where: { estado_pago: 'aprobado' } }),
    ]);

    // Totales teóricos para sorteos publicados (ignorar promociones)
    const sorteosPublicados = await prisma.sorteos.findMany({ where: { estado: 'publicado' } as any });
    const [totalNumerosPublicado, vendidosPublicado] = await Promise.all([
      prisma.numeros_sorteo.count({ where: { sorteo_id: { in: sorteosPublicados.map(s => s.id) } } }),
      prisma.numeros_sorteo.count({ where: { sorteo_id: { in: sorteosPublicados.map(s => s.id) }, estado: 'vendido' } }),
    ]);
    const totalGananciaTeorica = sorteosPublicados.reduce((acc, s) => acc + Number(s.precio_por_numero) * Math.pow(10, Number(s.cantidad_digitos)), 0);

    // Método de pago más usado
    const metodoTop: any[] = await (prisma as any).$queryRaw`
      SELECT metodo_pago, COUNT(*)::bigint AS c
      FROM ordenes
      WHERE estado_pago = 'aprobado'
      GROUP BY metodo_pago
      ORDER BY c DESC NULLS LAST
      LIMIT 1
    `;

    // Sorteo con mayores ingresos
    const sorteoTop: any[] = await (prisma as any).$queryRaw`
      SELECT sorteo_id, SUM(monto_total)::numeric AS total
      FROM ordenes
      WHERE estado_pago = 'aprobado'
      GROUP BY sorteo_id
      ORDER BY total DESC NULLS LAST
      LIMIT 1
    `;

    // Paquete promocional más comprado (match por cantidad y precio)
    const paquetes: any[] = await (prisma as any).paquetes.findMany({});
    let paqueteMasComprado: any = null;
    let maxCompras = 0;
    for (const p of paquetes) {
      const c = await prisma.ordenes.count({
        where: {
          estado_pago: 'aprobado',
          sorteo_id: p.sorteo_id,
          cantidad_numeros: p.cantidad_numeros,
          monto_total: p.precio_total,
        } as any,
      });
      if (c > maxCompras) {
        maxCompras = c;
        paqueteMasComprado = p;
      }
    }

    res.json({
      total_ganancias: Number(sumAprobadas?._sum?.monto_total ?? 0),
      tickets_vendidos: Number(sumTickets?._sum?.cantidad_numeros ?? 0),
      ordenes_pendientes: pendientes,
      ordenes_aprobadas: aprobadas,
      metodo_pago_top: metodoTop?.[0]?.metodo_pago ?? null,
      sorteo_top_ingresos: sorteoTop?.[0] ?? null,
      paquete_mas_comprado: paqueteMasComprado ? { id: paqueteMasComprado.id, nombre: paqueteMasComprado.nombre, sorteo_id: paqueteMasComprado.sorteo_id, cantidad_numeros: paqueteMasComprado.cantidad_numeros, precio_total: paqueteMasComprado.precio_total, compras: maxCompras } : null,
      grafica: {
        total_ganancia_teorica: totalGananciaTeorica,
        total_numeros_publicados: totalNumerosPublicado,
        vendidos_publicados: vendidosPublicado,
        disponibles_publicados: totalNumerosPublicado - vendidosPublicado,
      },
    });
  } catch (e) {
    next(e);
  }
});

// =========================
//  Social posts (Facebook / Instagram)
// =========================
const socialPostSchema = z.object({
  platform: z.enum(['facebook', 'instagram']),
  url: z.string().url(),
  tipo: z.enum(['social', 'ganador']).optional().default('social'),
  orden: z.number().int().optional(),
  activo: z.boolean().optional()
});

// Listar todos (con filtro opcional por tipo)
adminRouter.get('/social-posts', requireAuth, async (req, res, next) => {
  try {
    const { tipo } = req.query;
    const where = tipo ? { tipo: String(tipo) } : {};
    const posts = await (prisma as any).social_posts.findMany({ 
      where, 
      orderBy: [{ orden: 'asc' }, { id: 'asc' }] 
    });
    res.json({ posts });
  } catch (e) { next(e); }
});

// Crear
adminRouter.post('/social-posts', requireAuth, async (req, res, next) => {
  try {
    const body = socialPostSchema.parse(req.body);
    // Calcular orden máximo dentro del mismo tipo
    const maxOrden = await (prisma as any).social_posts.aggregate({ 
      _max: { orden: true },
      where: { tipo: body.tipo ?? 'social' }
    });
    const orden = body.orden ?? (Number(maxOrden?._max?.orden ?? 0) + 1);
    const created = await (prisma as any).social_posts.create({ 
      data: { 
        platform: body.platform, 
        url: body.url, 
        tipo: body.tipo ?? 'social',
        orden, 
        activo: body.activo ?? true 
      } 
    });
    res.json({ post: created });
  } catch (e) { next(e); }
});

// Actualizar (parcial)
adminRouter.patch('/social-posts/:id', requireAuth, async (req, res, next) => {
  try {
    const params = z.object({ id: z.string() }).parse(req.params);
    const partial = socialPostSchema.partial().parse(req.body);
    const updated = await (prisma as any).social_posts.update({ where: { id: BigInt(params.id) }, data: partial });
    res.json({ post: updated });
  } catch (e) { next(e); }
});

// Reordenar (batch) [{id, orden}]
adminRouter.post('/social-posts/reordenar', requireAuth, async (req, res, next) => {
  try {
    const arr = z.array(z.object({ id: z.coerce.bigint(), orden: z.number().int() })).parse(req.body);
    await prisma.$transaction(arr.map(a => (prisma as any).social_posts.update({ where: { id: a.id }, data: { orden: a.orden } })));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Eliminar
adminRouter.delete('/social-posts/:id', requireAuth, async (req, res, next) => {
  try {
    const params = z.object({ id: z.string() }).parse(req.params);
    await (prisma as any).social_posts.delete({ where: { id: BigInt(params.id) } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// =========================
//  Ganadores (premios instantáneos)
// =========================

// Listado agregado por cliente y sorteo con números/premios
adminRouter.get('/ganadores', requireAuth, async (req, res, next) => {
  try {
    const q = ((req.query.q as string) || '').trim();
    const limit = Math.min(500, Math.max(1, Number((req.query.limit as string) || 200)));
    const offset = Math.max(0, Number((req.query.offset as string) || 0));

    const rows: any[] = await (prisma as any).$queryRaw`
      SELECT 
        c.id               AS cliente_id,
        COALESCE(c.nombres,'')  AS nombres,
        COALESCE(c.apellidos,'') AS apellidos,
        c.correo_electronico    AS correo,
        c.telefono              AS telefono,
        s.id               AS sorteo_id,
        s.nombre           AS sorteo_nombre,
  ARRAY_AGG(DISTINCT ns.numero_texto ORDER BY ns.numero_texto)  AS numeros,
  ARRAY_AGG(DISTINCT p.descripcion ORDER BY p.descripcion)      AS premios,
        JSON_AGG(DISTINCT JSONB_BUILD_OBJECT('numero', ns.numero_texto, 'premio', p.descripcion)) AS aciertos,
        COUNT(DISTINCT p.id) AS premios_count,
        MAX(p.id) AS any_premio_id
      FROM ordenes o
      JOIN clientes c ON c.id = o.cliente_id
      JOIN ordenes_items oi ON oi.orden_id = o.id
      JOIN numeros_sorteo ns ON ns.id = oi.numero_sorteo_id
      JOIN premios p ON p.numero_sorteo_id = ns.id
      JOIN sorteos s ON s.id = p.sorteo_id
      WHERE o.estado_pago = 'aprobado'
      ${q ? Prisma.sql`AND (
        c.nombres ILIKE ${'%' + q + '%'} OR c.apellidos ILIKE ${'%' + q + '%'} OR c.correo_electronico ILIKE ${'%' + q + '%'} OR 
        s.nombre ILIKE ${'%' + q + '%'} OR ns.numero_texto ILIKE ${'%' + q + '%'} OR p.descripcion ILIKE ${'%' + q + '%'}
      )` : Prisma.empty}
      GROUP BY c.id, c.nombres, c.apellidos, c.correo_electronico, c.telefono, s.id, s.nombre
      ORDER BY any_premio_id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    res.json({ ganadores: rows.map(r => ({
      cliente_id: String(r.cliente_id),
      nombres: r.nombres,
      apellidos: r.apellidos,
      correo: r.correo,
      telefono: r.telefono,
      sorteo_id: String(r.sorteo_id),
      sorteo_nombre: r.sorteo_nombre,
      numeros: (r.numeros || []).map((n: any) => String(n)),
      premios: (r.premios || []).map((p: any) => String(p)),
      aciertos: Array.isArray(r.aciertos) ? r.aciertos.map((a: any) => ({ numero: String(a.numero), premio: String(a.premio) })) : [],
      premios_count: Number(r.premios_count || 0)
    })) });
  } catch (e) { next(e); }
});

// Enviar correo a un ganador
adminRouter.post('/ganadores/enviar_correo', requireAuth, async (req, res, next) => {
  try {
    const body = z.object({ to: z.string().email(), subject: z.string().min(1), message: z.string().min(1) }).parse(req.body);
    const { sendMail } = await import('../utils/mailer');
    const info = await sendMail({ to: body.to, subject: body.subject, html: `<p>${body.message.replace(/\n/g,'<br/>')}</p>` });
    res.json({ ok: true, id: info?.messageId || null });
  } catch (e) { next(e); }
});
// Seed métodos de pago básicos (idempotente)
adminRouter.post('/metodos_pago/seed', requireAuth, async (_req, res, next) => {
  try {
    const métodos: any[] = [
      { nombre: 'Banco Pichincha', tipo: 'transferencia', activo: true, detalles: { numero_cuenta: '2201778598', tipo_cuenta: 'Ahorros', titular: 'Castro Baque Aladino Teodoro' } },
      { nombre: 'Cooperativa JEP', tipo: 'transferencia', activo: true, detalles: { numero_cuenta: '406036032100', tipo_cuenta: 'Ahorros', titular: 'Castro Baque  Aladino Teodoro' } },
    ];
    for (const m of métodos) {
      const existente = await (prisma as any).metodos_pago.findFirst({ where: { nombre: m.nombre } });
      if (existente) {
        await (prisma as any).metodos_pago.update({ where: { id: existente.id }, data: { activo: true, tipo: m.tipo, detalles: m.detalles } });
      } else {
        await (prisma as any).metodos_pago.create({ data: m });
      }
    }
    const todos = await (prisma as any).metodos_pago.findMany({ orderBy: { nombre: 'asc' } });
    res.json({ metodos: todos });
  } catch (e) {
    next(e);
  }
});

// =========================
//  Galería de sorteos (admin)
// =========================

// Listar imágenes de un sorteo
adminRouter.get('/sorteos/:id/imagenes', requireAuth, async (req, res, next) => {
  try {
    const id = BigInt(String((req.params as any)?.id));
    const imagenes = await (prisma as any).sorteos_imagenes.findMany({ where: { sorteo_id: id }, orderBy: [{ es_portada: 'desc' }, { orden: 'asc' }, { id: 'asc' }] });
    res.json({ imagenes });
  } catch (e) { next(e); }
});

// Subir 1..n imágenes
adminRouter.post('/sorteos/:id/imagenes', requireAuth, uploadSorteos.array('files', 10), async (req: any, res, next) => {
  try {
    const id = BigInt(String((req.params as any)?.id));
    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length === 0) return res.status(400).json({ error: 'Archivo(s) requerido(s) en campo files[]' });

    const created: any[] = [];
    for (const f of files) {
      const dir = path.dirname(f.path);
      const base = path.parse(f.path).name;
      const thumbPath = path.resolve(dir, `${base}-thumb.webp`);
      const heroPath = path.resolve(dir, `${base}-hero.webp`);

      // Normalización: 16:9, grande y miniatura (sin dependencia de sharp en tipado)
      // @ts-ignore – declaramos dinámico para evitar tipos en build
      const sharpLib = (await import('sharp')).default as any;
      await sharpLib(f.path).resize(1600, 900, { fit: 'cover', position: 'centre' }).webp({ quality: 80 }).toFile(heroPath);
      await sharpLib(f.path).resize(800, 450, { fit: 'cover', position: 'centre' }).webp({ quality: 70 }).toFile(thumbPath);
      try { fs.unlinkSync(f.path); } catch {}

      const relHero = path.relative(process.cwd(), heroPath).replace(/\\/g, '/');
      const relThumb = path.relative(process.cwd(), thumbPath).replace(/\\/g, '/');

      const count = await (prisma as any).sorteos_imagenes.count({ where: { sorteo_id: id } });
      const row = await (prisma as any).sorteos_imagenes.create({ data: { sorteo_id: id, url: `/${relHero}`, url_thumb: `/${relThumb}`, orden: count, es_portada: count === 0 } });
      created.push(row);
    }
    res.json({ imagenes: created });
  } catch (e) { next(e); }
});

// Actualizar orden masivo
adminRouter.patch('/sorteos/:id/imagenes/orden', requireAuth, async (req, res, next) => {
  try {
    const id = BigInt(String((req.params as any)?.id));
    const body = z.array(z.object({ id: z.coerce.bigint(), orden: z.number().int().min(0) })).parse(req.body);
    await prisma.$transaction(body.map((b: any) => (prisma as any).sorteos_imagenes.update({ where: { id: b.id, sorteo_id: id } as any, data: { orden: Number(b.orden) } })) as any);
    const imagenes = await (prisma as any).sorteos_imagenes.findMany({ where: { sorteo_id: id }, orderBy: [{ es_portada: 'desc' }, { orden: 'asc' }, { id: 'asc' }] });
    res.json({ imagenes });
  } catch (e) { next(e); }
});

// Marcar portada o editar alt
adminRouter.patch('/sorteos/:id/imagenes/:imgId', requireAuth, async (req, res, next) => {
  try {
    const id = BigInt(String((req.params as any)?.id));
    const imgId = BigInt(String((req.params as any)?.imgId));
    const body = z.object({ es_portada: z.boolean().optional(), alt: z.string().optional() }).parse(req.body);
    if (body.es_portada) {
      await (prisma as any).sorteos_imagenes.updateMany({ where: { sorteo_id: id }, data: { es_portada: false } });
    }
    const updated = await (prisma as any).sorteos_imagenes.update({ where: { id: imgId }, data: body as any });
    res.json({ imagen: updated });
  } catch (e) { next(e); }
});

// Eliminar imagen (borra archivos del disco)
adminRouter.delete('/sorteos/:id/imagenes/:imgId', requireAuth, async (req, res, next) => {
  try {
    const imgId = BigInt(String((req.params as any)?.imgId));
    const row: any = await (prisma as any).sorteos_imagenes.findUnique({ where: { id: imgId } });
    if (!row) return res.status(404).json({ error: 'Imagen no encontrada' });
    const toRemove = [row.url, row.url_thumb].filter(Boolean).map((p: string) => path.resolve(process.cwd(), p.replace(/^\//, '')));
    for (const p of toRemove) { try { fs.unlinkSync(p); } catch {} }
    await (prisma as any).sorteos_imagenes.delete({ where: { id: imgId } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Asegurar método de pago Payphone presente (idempotente)
adminRouter.post('/metodos_pago/seed-payphone', requireAuth, async (_req, res, next) => {
  try {
    const storeId = process.env.PAYPHONE_STORE_ID || null;
    const existente = await (prisma as any).metodos_pago.findFirst({ where: { nombre: 'Payphone' } });
    if (existente) {
      await (prisma as any).metodos_pago.update({ where: { id: existente.id }, data: { tipo: 'gateway', activo: true, detalles: { storeId } } });
      return res.json({ metodo: { ...existente, detalles: { storeId } } });
    }
    const creado = await (prisma as any).metodos_pago.create({ data: { nombre: 'Payphone', tipo: 'gateway', activo: true, detalles: { storeId } } });
    res.json({ metodo: creado });
  } catch (e) { next(e); }
});
// Listar números vendidos con filtro por sorteo y búsqueda por número
adminRouter.get('/numeros_vendidos', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sorteoIdParam = (req.query.sorteo_id as string) || '';
    const q = ((req.query.q as string) || '').trim();
    const limit = Math.min(2000, Math.max(1, Number((req.query.limit as string) || 500)));
    const offset = Math.max(0, Number((req.query.offset as string) || 0));

    const rows: any[] = await (prisma as any).$queryRaw(
      Prisma.sql`
      SELECT ns.id,
             ns.numero_texto,
             ns.sorteo_id,
             s.nombre AS sorteo_nombre,
             c.nombres AS cliente_nombres,
             c.apellidos AS cliente_apellidos,
             c.correo_electronico AS cliente_correo,
             c.telefono AS cliente_telefono,
             c.cedula AS cliente_cedula,
             c.direccion AS cliente_direccion
      FROM numeros_sorteo ns
      JOIN sorteos s ON s.id = ns.sorteo_id
      LEFT JOIN ordenes_items oi ON oi.numero_sorteo_id = ns.id
      LEFT JOIN ordenes o ON o.id = COALESCE(oi.orden_id, ns.orden_id)
      LEFT JOIN clientes c ON c.id = o.cliente_id
      WHERE ns.estado = 'vendido'
      ${sorteoIdParam ? Prisma.sql`AND ns.sorteo_id = ${BigInt(sorteoIdParam)}` : Prisma.empty}
      ${q ? Prisma.sql`AND ns.numero_texto ILIKE ${'%' + q + '%'}` : Prisma.empty}
      ORDER BY ns.sorteo_id DESC, ns.numero_texto ASC
      LIMIT ${limit} OFFSET ${offset}
      `
    );

    res.json({ numeros: rows });
  } catch (e) {
    next(e);
  }
});

// Crear método de pago (admin)
adminRouter.post('/metodos_pago', requireAuth, async (req, res, next) => {
  try {
    const body = z.object({
      nombre: z.string().min(1),
      tipo: z.string().default('transferencia'),
      activo: z.boolean().default(true),
      detalles: z.any().optional(),
    }).parse(req.body);
    const creado = await (prisma as any).metodos_pago.create({ data: body as any });
    res.json({ metodo: creado });
  } catch (e) {
    next(e);
  }
});

// Listar métodos de pago (admin)
adminRouter.get('/metodos_pago', requireAuth, async (_req, res, next) => {
  try {
    const metodos = await (prisma as any).metodos_pago.findMany({ orderBy: { nombre: 'asc' } });
    res.json({ metodos });
  } catch (e) {
    next(e);
  }
});

// Crear sorteo
adminRouter.post("/sorteos", requireAuth, async (req, res, next) => {
  try {
    const bodySchema = z.object({
      nombre: z.string().min(1),
      descripcion: z.string().optional(),
      cantidad_digitos: z.number().int().min(1).max(10),
      precio_por_numero: z.number().positive(),
      cantidad_premios: z.number().int().min(1).max(100),
      fecha_inicio: z.string().datetime().optional(),
      fecha_fin: z.string().datetime().optional(),
      generar_numeros: z.boolean().optional()
    });
    const body = bodySchema.parse(req.body);

    // Validación adicional: verificar que no se exceda el máximo de números posibles
    const maxNumeros = Math.pow(10, body.cantidad_digitos);
    if (body.cantidad_premios > maxNumeros) {
      return res.status(400).json({ 
        error: `No puede haber más premios (${body.cantidad_premios}) que números disponibles (${maxNumeros})` 
      });
    }

    // Validación adicional: verificar que el total de números no sea excesivo
    if (body.generar_numeros && maxNumeros > 1000000) {
      return res.status(400).json({ 
        error: `Demasiados números para generar (${maxNumeros}). Máximo permitido: 1,000,000` 
      });
    }

    const sorteo = await prisma.sorteos.create({
      data: {
        nombre: body.nombre,
        descripcion: body.descripcion,
        cantidad_digitos: body.cantidad_digitos,
        precio_por_numero: body.precio_por_numero,
        cantidad_premios: body.cantidad_premios,
        fecha_inicio: body.fecha_inicio ? new Date(body.fecha_inicio) : null,
        fecha_fin: body.fecha_fin ? new Date(body.fecha_fin) : null,
        estado: "borrador"
      }
    });

    if (body.generar_numeros) {
      const total = Math.pow(10, body.cantidad_digitos);
      const inserts = Array.from({ length: total }, (_, i) =>
        i.toString().padStart(body.cantidad_digitos, "0")
      );
      const chunkSize = 5000;
      for (let i = 0; i < inserts.length; i += chunkSize) {
        const chunk = inserts.slice(i, i + chunkSize);
        await prisma.numeros_sorteo.createMany({
          data: chunk.map((numero) => ({
            sorteo_id: sorteo.id,
            numero_texto: numero
          })),
          skipDuplicates: true
        });
      }
    }

    res.json({ sorteo });
  } catch (e) {
    next(e);
  }
});

// Listar sorteos básicos (para selects en admin)
adminRouter.get("/sorteos", requireAuth, async (_req, res, next) => {
  try {
    const sorteos = await prisma.sorteos.findMany({
      select: { id: true, nombre: true, cantidad_digitos: true, cantidad_premios: true, precio_por_numero: true, estado: true },
      orderBy: { fecha_creacion: "desc" },
    });
    res.json({ sorteos });
  } catch (e) {
    next(e);
  }
});

// Estado del sorteo: conteos (total, vendidos, reservados, disponibles, premios definidos, premios asignados)
adminRouter.get("/sorteos/:id/estado", requireAuth, async (req, res, next) => {
  try {
    const params = z.object({ id: z.string() }).parse(req.params);
    const sorteoId = BigInt(params.id);

    const sorteo = await prisma.sorteos.findUnique({ where: { id: sorteoId } });
    if (!sorteo) return res.status(404).json({ error: "Sorteo no encontrado" });

    const [totalNumeros, vendidos, reservados, disponibles, premiosDefinidos, premiosAsignados] = await Promise.all([
      prisma.numeros_sorteo.count({ where: { sorteo_id: sorteoId } }),
      prisma.numeros_sorteo.count({ where: { sorteo_id: sorteoId, estado: "vendido" } }),
      prisma.numeros_sorteo.count({ where: { sorteo_id: sorteoId, estado: "reservado" } }),
      prisma.numeros_sorteo.count({ where: { sorteo_id: sorteoId, estado: "disponible" } }),
      prisma.premios.count({ where: { sorteo_id: sorteoId } }),
      prisma.premios.count({ where: { sorteo_id: sorteoId, numero_sorteo_id: { not: null } } }),
    ]);

    const restantesPremios = Math.max(0, Number(sorteo.cantidad_premios) - premiosDefinidos);

    res.json({
      sorteo: {
        id: sorteo.id,
        cantidad_premios: sorteo.cantidad_premios,
      },
      numeros: { total: totalNumeros, vendidos, reservados, disponibles },
      premios: { definidos: premiosDefinidos, asignados: premiosAsignados, restantes: restantesPremios },
    });
  } catch (e) {
    next(e);
  }
});

// Listar órdenes (por estado) con detalles de cliente y sorteo
adminRouter.get("/orders", requireAuth, async (req, res, next) => {
  try {
    const estadoParam = ((req.query.estado as string) || '').trim().toLowerCase();
    const all = !estadoParam || estadoParam === 'all' || estadoParam === 'todos';
    const where: any = all ? {} : { estado_pago: estadoParam };
    const ordenes = await prisma.ordenes.findMany({
      where,
      orderBy: { fecha_creacion: 'desc' },
      include: { cliente: true, sorteo: true, metodo_pago_ref: true },
    });
    res.json({ ordenes });
  } catch (e) {
    next(e);
  }
});

// Paquetes: listar por sorteo
adminRouter.get("/sorteos/:id/paquetes", requireAuth, async (req, res, next) => {
  try {
    const params = z.object({ id: z.string() }).parse(req.params);
    const sorteoId = BigInt(params.id);
    const paquetes = await prisma.paquetes.findMany({ where: { sorteo_id: sorteoId }, orderBy: { cantidad_numeros: "asc" } });
    res.json({ paquetes });
  } catch (e) {
    next(e);
  }
});

// Paquetes: crear para un sorteo
adminRouter.post("/sorteos/:id/paquetes", requireAuth, async (req, res, next) => {
  try {
    const params = z.object({ id: z.string() }).parse(req.params);
    const sorteoId = BigInt(params.id);
    const body = z
      .object({
        nombre: z.string().optional(),
        descripcion: z.string().optional(),
        cantidad_numeros: z.number().int().min(1),
        porcentaje_descuento: z.number().min(0).max(100).optional(),
        precio_total: z.number().positive().optional(),
      })
      .parse(req.body);

    // Calcular precio_total automáticamente: precio_unitario * cantidad * (1 - desc%)
    const sorteo = await prisma.sorteos.findUnique({ where: { id: sorteoId } });
    if (!sorteo) return res.status(404).json({ error: "Sorteo no encontrado" });
    const unit = Number(sorteo.precio_por_numero);
    const desc = Number(body.porcentaje_descuento || 0) / 100;
    const calc = Math.round(unit * body.cantidad_numeros * (1 - desc) * 100) / 100;

    const paquete = await prisma.paquetes.create({
      data: { ...body, precio_total: calc, sorteo_id: sorteoId } as any,
    });
    res.json({ paquete });
  } catch (e) {
    next(e);
  }
});

// Paquetes: eliminar
adminRouter.delete("/paquetes/:id", requireAuth, async (req, res, next) => {
  try {
    const params = z.object({ id: z.string() }).parse(req.params);
    const paquete = await prisma.paquetes.delete({ where: { id: BigInt(params.id) } as any });
    res.json({ paquete });
  } catch (e) {
    next(e);
  }
});

// Aprobar orden: confirma números reservados -> vendidos, genera items y aprueba
adminRouter.post("/orders/:id/approve", requireAuth, async (req, res, next) => {
  try {
    const params = z.object({ id: z.string() }).parse(req.params);
    const ordenId = BigInt(params.id);

    const orden = await prisma.ordenes.findUnique({ where: { id: ordenId } });
    if (!orden) return res.status(404).json({ error: "Orden no encontrada" });
    if (!orden.sorteo_id) return res.status(400).json({ error: "Orden sin sorteo asociado" });
    if (!orden.ruta_comprobante) return res.status(400).json({ error: "La orden no tiene comprobante de pago" });

    const cantidadSolicitada = Number(orden.cantidad_numeros || 1);

    await (prisma as any).$transaction(async (tx: typeof prisma) => {
      // Confirmar/Completar reserva para esta orden
      let reservados = await tx.numeros_sorteo.findMany({ where: { orden_id: ordenId, estado: "reservado" }, select: { id: true } });
      const faltantes = Math.max(0, cantidadSolicitada - reservados.length);
      if (faltantes > 0) {
        const selec = await (tx as any).$queryRaw<{ id: bigint }[]>`
          SELECT id FROM numeros_sorteo
          WHERE sorteo_id = ${orden.sorteo_id as bigint} AND estado = 'disponible'
          ORDER BY random()
          LIMIT ${faltantes}
          FOR UPDATE SKIP LOCKED
        `;
        if (selec.length < faltantes) {
          throw new Error(`No hay suficientes números disponibles para completar la orden (${reservados.length}+${selec.length}/${cantidadSolicitada}).`);
        }
        const idsSel = selec.map((s: { id: bigint }) => s.id);
        await tx.numeros_sorteo.updateMany({ where: { id: { in: idsSel } }, data: { estado: 'reservado', orden_id: ordenId } });
        reservados = [...reservados, ...idsSel.map((id: bigint) => ({ id }))];
      }
      const ids = reservados.slice(0, cantidadSolicitada).map((r) => r.id);
      // Cuando se marcan como vendidos, aseguramos que mantengan el orden_id
      await tx.numeros_sorteo.updateMany({ where: { id: { in: ids } }, data: { estado: "vendido", orden_id: ordenId } });

      const precio = await tx.sorteos.findUnique({ where: { id: orden.sorteo_id as bigint } }).then((s) => s?.precio_por_numero ?? 0);
      for (const id of ids) {
        await tx.ordenes_items.create({ data: { orden_id: ordenId, numero_sorteo_id: id, precio } as any });
      }

      await tx.ordenes.update({ where: { id: ordenId }, data: { estado_pago: "aprobado" } });
    });

    const aprobada: any = await prisma.ordenes.findUnique({ where: { id: ordenId }, include: { items: true, metodo_pago_ref: true, cliente: true, sorteo: true } as any });
    // Email de aprobación con números
    try {
      const { sendMail } = await import('../utils/mailer');
      const fs = await import('node:fs');
      const path = await import('node:path');
      const PDFDocument = (await import('pdfkit')).default;

  if (aprobada?.cliente?.correo_electronico && aprobada?.items) {
        const itemIds = (aprobada.items as any[]).map((i: any) => i.numero_sorteo_id as bigint);
        const numeros = itemIds.length
          ? await prisma.numeros_sorteo.findMany({
              where: { id: { in: itemIds } },
              select: { id: true, numero_texto: true },
            })
          : [];
        const numeroMap = new Map(numeros.map((n) => [String(n.id), n.numero_texto]));
        const lista = (aprobada.items as any[])
          .map((i: any) => `#${numeroMap.get(String(i.numero_sorteo_id)) ?? String(i.numero_sorteo_id)}`)
          .join(', ');

        // Generar PDF simple
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

        // Guardar registro factura (no bloquear envío de correo si falla)
        try {
          const adminUser = await (prisma as any).usuarios?.findFirst?.({})
            .catch(() => null);
          const dataFactura: any = {
            orden_id: ordenId,
            ruta_factura: path.relative(process.cwd(), pdfPath).replace(/\\/g, '/'),
            datos_factura: { orden_id: String(ordenId) } as any,
          };
          if (adminUser?.id) dataFactura.usuario_admin_id = adminUser.id;
          await prisma.facturas.create({ data: dataFactura });
        } catch (ferr) {
          console.error('No se pudo crear la factura (se enviará el correo igualmente):', ferr);
        }

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

        // -----------------------------------------------------------
        // Notificación de premios ganados (si alguno de los números asignados
        // coincide con un número premiado ya definido en la tabla premios)
        // -----------------------------------------------------------
        try {
          const itemIdsBigInt = itemIds.map(id => BigInt(String(id)));
          if (itemIdsBigInt.length) {
            const premiosGanados: any[] = await (prisma as any).premios.findMany({
              where: { numero_sorteo_id: { in: itemIdsBigInt } },
              include: { numero_sorteo: true, sorteo: true }
            });
            if (premiosGanados.length && aprobada?.cliente?.correo_electronico) {
              const rowsHtml = premiosGanados.map(p => `<li><strong>${p.descripcion}</strong> — Número: #${p.numero_sorteo?.numero_texto ?? ''} (Sorteo: ${p.sorteo?.nombre ?? ''})</li>`).join('');
              const premiosData = premiosGanados.map(p => ({ numero: p.numero_sorteo?.numero_texto || '', premio: p.descripcion || 'Premio' }));
              const htmlGanador = correoGanador({
                clienteNombre: aprobada.cliente.nombres || '',
                codigo: aprobada.codigo,
                sorteoNombre: aprobada.sorteo?.nombre,
                premios: premiosData,
                linkSorteo: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/sorteos/${aprobada.sorteo?.id}/info` : undefined,
                logoUrl: process.env.BRAND_LOGO_URL || null,
                year: new Date().getFullYear()
              });
              await sendMail({
                to: aprobada.cliente.correo_electronico,
                subject: `🎉 ¡Has ganado ${premiosGanados.length > 1 ? 'premios' : 'un premio'} en ${aprobada.sorteo?.nombre || 'un sorteo'}!`,
                html: htmlGanador
              });

              // Notificación a administradores
              try {
                const adminMails = await (prisma as any).usuarios.findMany({ where: { rol: { in: ['admin','superadmin','root'] } } });
                const toAdmins = adminMails.map((u: any) => u.correo_electronico).filter(Boolean).join(',');
                const htmlAdmin = `<p>Se ha aprobado la orden <strong>${aprobada.codigo}</strong> y contiene número(s) ganador(es).</p>
                  <p>Cliente: ${aprobada.cliente.nombres} (${aprobada.cliente.correo_electronico})</p>
                  <ul>${rowsHtml}</ul>`;
                if (toAdmins) {
                  await sendMail({
                    to: toAdmins,
                    subject: `🔔 Cliente ganador en ${aprobada.sorteo?.nombre || 'sorteo'}`,
                    html: htmlAdmin
                  });
                }
              } catch (admErr) {
                console.error('No se pudo notificar administradores de premio ganado:', admErr);
              }
            }
          }
        } catch (premioErr) {
          console.error('Error evaluando premios ganados:', premioErr);
        }
      }
    } catch (mailErr) {
      console.error('Error enviando correo de aprobación:', mailErr);
    }
    res.json({ orden: aprobada });
  } catch (e: any) {
    next(e);
  }
});

// Rechazar orden
adminRouter.post("/orders/:id/reject", requireAuth, async (req, res, next) => {
  try {
    const params = z.object({ id: z.string() }).parse(req.params);
    const ordenId = BigInt(params.id);
    const orden = await prisma.ordenes.update({ where: { id: ordenId }, data: { estado_pago: "rechazado" } });
    // Liberar números reservados
    await prisma.numeros_sorteo.updateMany({ where: { orden_id: ordenId, estado: "reservado" }, data: { estado: "disponible", orden_id: null } });
    // Email de rechazo
    try {
      const { sendMail } = await import('../utils/mailer');
      const cliente = await prisma.clientes.findUnique({ where: { id: orden.cliente_id as any } });
      if (cliente?.correo_electronico) {
        const { correoRechazo } = await import('../emails/templates');
        const htmlRechazo = correoRechazo({
          clienteNombre: cliente.nombres || '',
          codigo: orden.codigo,
          sorteoNombre: '',
          motivo: (req as any).body?.motivo || 'No cumple validación',
          logoUrl: process.env.BRAND_LOGO_URL || null,
          year: new Date().getFullYear()
        });
        await sendMail({
          to: cliente.correo_electronico,
          subject: `Orden ${orden.codigo} rechazada`,
          html: htmlRechazo
        });
      }
    } catch {}
    res.json({ orden });
  } catch (e) {
    next(e);
  }
});

// Crear premios y asignar números aleatorios del universo
adminRouter.post("/sorteos/:id/premios", requireAuth, async (req, res, next) => {
  try {
    const params = z.object({ id: z.string() }).parse(req.params);
    const body = z.array(z.object({ descripcion: z.string().min(1) })).parse(req.body);

    const sorteoId = BigInt(params.id);

    // Validar que el sorteo exista
    const sorteo = await prisma.sorteos.findUnique({ where: { id: sorteoId } });
    if (!sorteo) return res.status(404).json({ error: "Sorteo no encontrado" });

    // Asegurar que existan numeros_sorteo para este sorteo; si no existen, generarlos automáticamente
    const existeNumeracion = await prisma.numeros_sorteo.count({ where: { sorteo_id: sorteoId } });
    if (existeNumeracion === 0) {
      const total = Math.pow(10, Number(sorteo.cantidad_digitos));
      const inserts = Array.from({ length: total }, (_, i) =>
        i.toString().padStart(Number(sorteo.cantidad_digitos), "0")
      );
      const chunkSize = 5000;
      for (let i = 0; i < inserts.length; i += chunkSize) {
        const chunk = inserts.slice(i, i + chunkSize);
        await prisma.numeros_sorteo.createMany({
          data: chunk.map((numero) => ({ sorteo_id: sorteoId, numero_texto: numero })),
          skipDuplicates: true,
        });
      }
    }
    // NOTA: nunca recreamos números si ya existen (para no “regenerar antiguos”).

    await (prisma as any).$transaction(async (tx: typeof prisma) => {
      // Bloquear la fila del sorteo para evitar condiciones de carrera al contar/crear premios
      await (tx as any).$executeRaw`SELECT id FROM sorteos WHERE id = ${sorteoId} FOR UPDATE`;

      // Validar cupos disponibles según cantidad_premios del sorteo
      const existentes = await tx.premios.count({ where: { sorteo_id: sorteoId } });
      const restantes = Number(sorteo.cantidad_premios) - existentes;
      if (restantes <= 0) {
        return res.status(400).json({
          error: "No quedan cupos de premios para este sorteo",
          cantidad_permitida_restante: 0,
        });
      }
      if (body.length > restantes) {
        return res.status(400).json({
          error: `La cantidad solicitada de premios excede el máximo permitido para este sorteo`,
          cantidad_permitida_restante: restantes,
        });
      }

      await tx.premios.createMany({
        data: body.map((p) => ({ sorteo_id: sorteoId, descripcion: p.descripcion }))
      });

      await asignarNumerosAPremios(tx, sorteoId);
    });

    const premios = await prisma.premios.findMany({
      where: { sorteo_id: sorteoId },
      include: { numero_sorteo: true }
    });
    res.json({ premios });
  } catch (e) {
    next(e);
  }
});

// Asignar números a premios pendientes (numero_sorteo_id IS NULL) para un sorteo
adminRouter.post("/sorteos/:id/asignar_pendientes", requireAuth, async (req, res, next) => {
  try {
    const params = z.object({ id: z.string() }).parse(req.params);
    const sorteoId = BigInt(params.id);

    const sorteo = await prisma.sorteos.findUnique({ where: { id: sorteoId } });
    if (!sorteo) return res.status(404).json({ error: "Sorteo no encontrado" });

    await (prisma as any).$transaction(async (tx: typeof prisma) => {
      await asignarNumerosAPremios(tx, sorteoId);
    });

    const premios = await prisma.premios.findMany({ where: { sorteo_id: sorteoId }, include: { numero_sorteo: true } });
    res.json({ premios });
  } catch (e) {
    next(e);
  }
});


// Paquetes: publicar
adminRouter.patch("/paquetes/:id/publicar", requireAuth, async (req, res, next) => {
  try {
    const params = z.object({ id: z.string() }).parse(req.params);
    const paquete = await prisma.paquetes.update({
      where: { id: BigInt(params.id) } as any,
      data: { estado: "publicado" },
    });
    res.json({ paquete });
  } catch (e) {
    next(e);
  }
});

// Paquetes: volver a borrador
adminRouter.patch("/paquetes/:id/borrador", requireAuth, async (req, res, next) => {
  try {
    const params = z.object({ id: z.string() }).parse(req.params);
    const paquete = await prisma.paquetes.update({
      where: { id: BigInt(params.id) } as any,
      data: { estado: "borrador" },
    });
    res.json({ paquete });
  } catch (e) {
    next(e);
  }
});

// Eliminar sorteo (y cascada números) - precaución
adminRouter.delete('/sorteos/:id', requireAuth, async (req, res, next) => {
  try {
    const params = z.object({ id: z.string() }).parse(req.params);
    const sorteoId = BigInt(params.id);
    // Reversión: no borramos datos, solo marcamos en borrador para preservar métricas
    const sorteo = await prisma.sorteos.update({ where: { id: sorteoId }, data: { estado: 'borrador' } });
    res.json({ ok: true, sorteo });
  } catch (e) {
    next(e);
  }
});

// Publicar/Borrador sorteo
adminRouter.patch('/sorteos/:id/publicar', requireAuth, async (req, res, next) => {
  try {
    const params = z.object({ id: z.string() }).parse(req.params);
    const sorteo = await prisma.sorteos.update({ where: { id: BigInt(params.id) }, data: { estado: 'publicado' } });
    res.json({ sorteo });
  } catch (e) { next(e); }
});

adminRouter.patch('/sorteos/:id/borrador', requireAuth, async (req, res, next) => {
  try {
    const params = z.object({ id: z.string() }).parse(req.params);
    const sorteo = await prisma.sorteos.update({ where: { id: BigInt(params.id) }, data: { estado: 'borrador' } });
    res.json({ sorteo });
  } catch (e) { next(e); }
});

// Endpoint para crear un usuario admin inicial (bootstrap)
adminRouter.post("/bootstrap/admin", async (req, res, next) => {
  try {
    // Validar payload
    const body = z.object({
      correo: z.string().email(),
      contrasena: z.string().min(4),
      nombre_usuario: z.string().min(3),
      rol: z.enum(['admin', 'superadmin', 'root']).default('admin')
    }).parse(req.body);

    // Verificar si ya existen usuarios (para limitar este endpoint)
    const countExistentes = await prisma.usuarios.count();
    if (countExistentes > 0) {
      return res.status(403).json({ error: "Ya existen usuarios en el sistema" });
    }

    // Crear el usuario admin
    const hashedPassword = await bcrypt.hash(body.contrasena, 10);
    const admin = await prisma.usuarios.create({
      data: {
        correo_electronico: body.correo,
        contrasena_hash: hashedPassword,
        nombre_usuario: body.nombre_usuario,
        rol: body.rol
      }
    });

    res.json({ 
      mensaje: "Usuario administrador creado correctamente",
      usuario: {
        id: admin.id,
        correo_electronico: admin.correo_electronico,
        nombre_usuario: admin.nombre_usuario,
        rol: admin.rol
      }
    });
  } catch (e) {
    next(e);
  }
});

