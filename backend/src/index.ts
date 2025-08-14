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
app.use(
  cors({
    origin: ["http://localhost:3000"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);

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

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api", publicRouter);
app.use("/api/admin", adminRouter);

// Servir archivos subidos (comprobantes)
app.use(
  "/uploads",
  express.static(path.resolve(process.cwd(), "uploads"))
);

// Manejador de errores global: responder siempre JSON
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = Number(err?.status || err?.statusCode || 400);
  const msg = err?.message || 'Error inesperado';
  if (process.env.NODE_ENV !== 'production') {
    console.error('API error:', err);
  }
  res.status(status).json({ error: msg });
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
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


