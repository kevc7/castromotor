import "dotenv/config";
import express from "express";
import cors from "cors";
import { adminRouter } from "./routes/admin";
import path from "node:path";
import fs from "node:fs";
import { prisma } from "./db";
import { publicRouter } from "./routes/public";

const app = express();
app.use(express.json());

// ==== CORS CONFIG (extensible en producción) ====
const DEFAULT_ALLOWED = ["http://localhost:3000", "https://castromotor.com.ec", "http://castromotor.com.ec"];
// Permitir override por env (comma separated)
const extraOrigins = (process.env.CORS_EXTRA_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const allowedOrigins = Array.from(new Set([...DEFAULT_ALLOWED, ...extraOrigins]));

app.use((req, _res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`➡️  ${req.method} ${req.originalUrl} origin=${req.headers.origin || 'n/a'}`);
  }
  next();
});

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // SSR / curl
    if (allowedOrigins.includes(origin)) return cb(null, true);
    console.warn('🚫 CORS bloqueado para origin:', origin);
    return cb(new Error('CORS not allowed'));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true
}));

// Serializar BigInt a string en todas las respuestas JSON
app.set(
  "json replacer",
  (_key: string, value: unknown) =>
    typeof value === "bigint" ? value.toString() : value
);

// Crear carpetas de uploads si no existen
function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}
const uploadsRoot = path.resolve(process.cwd(), "uploads");
ensureDir(uploadsRoot);
ensureDir(path.resolve(uploadsRoot, "comprobantes"));
ensureDir(path.resolve(uploadsRoot, "facturas"));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString(), pid: process.pid });
});

// Middleware de tiempo de inicio request para medir duración
app.use((req, res, next) => {
  (req as any)._startAt = process.hrtime.bigint();
  res.on('finish', () => {
    const start = (req as any)._startAt as bigint | undefined;
    if (start) {
      const durMs = Number((process.hrtime.bigint() - start) / 1_000_000n);
      if (req.originalUrl.startsWith('/api')) {
        console.log(`✅ ${req.method} ${req.originalUrl} -> ${res.statusCode} (${durMs}ms)`);
      }
    }
  });
  next();
});

app.use("/api", publicRouter);
app.use("/api/admin", adminRouter);

// Servir archivos subidos (comprobantes)
app.use(
  "/uploads",
  express.static(path.resolve(process.cwd(), "uploads"))
);

// Log para debug
console.log('📁 Static files served from:', path.resolve(process.cwd(), "uploads"));
console.log('📂 Uploads directory exists:', fs.existsSync(path.resolve(process.cwd(), "uploads")));
console.log('🌐 Allowed origins:', allowedOrigins);
console.log('🔐 Payphone token presente:', !!process.env.PAYPHONE_TOKEN);

// Manejador de errores global: responder siempre JSON
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = Number(err?.status || err?.statusCode || 400);
  const msg = err?.message || 'Error inesperado';
  const stack = err?.stack;
  console.error(`❌ Error handler -> ${status} ${msg}`);
  if (stack) console.error(stack.split('\n').slice(0,6).join('\n')); // primeras líneas
  res.status(status).json({ error: msg, code: err?.code || undefined });
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`🚀 API listening on port ${port} (pid=${process.pid}) env=${process.env.NODE_ENV}`);
});

// ==== Captura de errores no controlados para evitar caídas silenciosas ====
process.on('unhandledRejection', (r: any) => {
  console.error('🧨 UnhandledRejection:', r);
});
process.on('uncaughtException', (e: any) => {
  console.error('🧨 UncaughtException:', e);
});

// Cron ligero: liberar reservas vencidas de Payphone (cada 60s)
setInterval(async () => {
  try {
    const now = new Date();
    const vencidos: any[] = await (prisma as any).pagos_payphone.findMany({ where: { status: 'INIT', expires_at: { lt: now } } });
    for (const p of vencidos) {
      await prisma.$transaction(async (tx: any) => {
        await tx.numeros_sorteo.updateMany({ where: { orden_id: p.orden_id, estado: 'reservado' }, data: { estado: 'disponible', orden_id: null } });
        await tx.ordenes.update({ where: { id: p.orden_id }, data: { estado_pago: 'rechazado' } });
        await (tx as any).pagos_payphone.update({ where: { id: p.id }, data: { status: 'EXPIRED' } });
      });
    }
    if (vencidos.length > 0) console.log(`Payphone TTL: liberadas ${vencidos.length} reservas vencidas`);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('Cron TTL error:', err);
  }
}, 60_000);


