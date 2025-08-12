import { Prisma, PrismaClient } from "@prisma/client";

export async function asignarNumerosAPremios(
  tx: Omit<PrismaClient, "$connect" | "$disconnect">,
  sorteoId: bigint
) {
  // Asignación robusta: usa solo números no usados por otros premios del sorteo
  // y mapea aleatoriamente a los premios con numero_sorteo_id IS NULL
  const query = Prisma.sql`
WITH premios_target AS (
  SELECT id, row_number() OVER () rn
  FROM premios
  WHERE sorteo_id = ${sorteoId} AND numero_sorteo_id IS NULL
),
numeros_disponibles AS (
  SELECT ns.id
  FROM numeros_sorteo ns
  WHERE ns.sorteo_id = ${sorteoId}
  EXCEPT
  SELECT COALESCE(p.numero_sorteo_id, -1)
  FROM premios p
  WHERE p.sorteo_id = ${sorteoId} AND p.numero_sorteo_id IS NOT NULL
),
numeros_aleatorios AS (
  SELECT id, row_number() OVER () rn
  FROM (SELECT id FROM numeros_disponibles ORDER BY random() LIMIT (SELECT COUNT(*) FROM premios_target)) x
)
UPDATE premios p
SET numero_sorteo_id = na.id
FROM numeros_aleatorios na
JOIN premios_target pt ON pt.rn = na.rn
WHERE p.id = pt.id;`;

  await (tx as any).$executeRaw(query);
}


