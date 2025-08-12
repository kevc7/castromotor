import "dotenv/config";
import express from "express";
import cors from "cors";
import { adminRouter } from "./routes/admin";
import path from "node:path";
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


