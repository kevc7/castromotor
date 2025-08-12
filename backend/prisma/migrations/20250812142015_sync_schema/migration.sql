-- AlterTable
ALTER TABLE "ordenes" ADD COLUMN     "cantidad_numeros" INTEGER,
ADD COLUMN     "metodo_pago_id" BIGINT;

-- AlterTable
ALTER TABLE "paquetes" ADD COLUMN     "estado" TEXT NOT NULL DEFAULT 'borrador';

-- CreateTable
CREATE TABLE "metodos_pago" (
    "id" BIGSERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "detalles" JSONB,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metodos_pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verificaciones_correo" (
    "id" BIGSERIAL NOT NULL,
    "correo_electronico" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "verificado" BOOLEAN NOT NULL DEFAULT false,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "expiracion" TIMESTAMP(3) NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verificaciones_correo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "verificaciones_correo_correo_electronico_verificado_usado_idx" ON "verificaciones_correo"("correo_electronico", "verificado", "usado");

-- AddForeignKey
ALTER TABLE "ordenes" ADD CONSTRAINT "ordenes_metodo_pago_id_fkey" FOREIGN KEY ("metodo_pago_id") REFERENCES "metodos_pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;
