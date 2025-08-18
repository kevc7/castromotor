-- CreateTable
CREATE TABLE "sorteos_imagenes" (
    "id" BIGSERIAL NOT NULL,
    "sorteo_id" BIGINT NOT NULL,
    "url" TEXT NOT NULL,
    "url_thumb" TEXT,
    "alt" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "es_portada" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sorteos_imagenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_posts" (
    "id" BIGSERIAL NOT NULL,
    "platform" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sorteos_imagenes_sorteo_id_orden_idx" ON "sorteos_imagenes"("sorteo_id", "orden");

-- CreateIndex
CREATE INDEX "social_posts_activo_orden_idx" ON "social_posts"("activo", "orden");

-- AddForeignKey
ALTER TABLE "sorteos_imagenes" ADD CONSTRAINT "sorteos_imagenes_sorteo_id_fkey" FOREIGN KEY ("sorteo_id") REFERENCES "sorteos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
