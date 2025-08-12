-- CreateTable
CREATE TABLE "usuarios" (
    "id" BIGSERIAL NOT NULL,
    "correo_electronico" TEXT NOT NULL,
    "nombre_usuario" TEXT,
    "contrasena_hash" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" BIGSERIAL NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT,
    "cedula" TEXT,
    "correo_electronico" TEXT,
    "telefono" TEXT,
    "direccion" TEXT,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sorteos" (
    "id" BIGSERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "cantidad_digitos" INTEGER NOT NULL,
    "precio_por_numero" DECIMAL(65,30) NOT NULL,
    "cantidad_premios" INTEGER NOT NULL DEFAULT 1,
    "fecha_inicio" TIMESTAMP(3),
    "fecha_fin" TIMESTAMP(3),
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sorteos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordenes" (
    "id" BIGSERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "cliente_id" BIGINT,
    "metodo_pago" TEXT,
    "estado_pago" TEXT NOT NULL DEFAULT 'pendiente',
    "ruta_comprobante" TEXT,
    "monto_total" DECIMAL(65,30),
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sorteo_id" BIGINT,

    CONSTRAINT "ordenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "numeros_sorteo" (
    "id" BIGSERIAL NOT NULL,
    "sorteo_id" BIGINT NOT NULL,
    "numero_texto" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'disponible',
    "orden_id" BIGINT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "numeros_sorteo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "premios" (
    "id" BIGSERIAL NOT NULL,
    "sorteo_id" BIGINT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "numero_sorteo_id" BIGINT,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "premios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paquetes" (
    "id" BIGSERIAL NOT NULL,
    "sorteo_id" BIGINT NOT NULL,
    "nombre" TEXT,
    "descripcion" TEXT,
    "cantidad_numeros" INTEGER,
    "porcentaje_descuento" DECIMAL(65,30),
    "precio_total" DECIMAL(65,30),

    CONSTRAINT "paquetes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ordenes_items" (
    "id" BIGSERIAL NOT NULL,
    "orden_id" BIGINT NOT NULL,
    "numero_sorteo_id" BIGINT NOT NULL,
    "precio" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "ordenes_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facturas" (
    "id" BIGSERIAL NOT NULL,
    "orden_id" BIGINT NOT NULL,
    "usuario_admin_id" BIGINT NOT NULL,
    "ruta_factura" TEXT,
    "datos_factura" JSONB,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facturas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_correo_electronico_key" ON "usuarios"("correo_electronico");

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_codigo_key" ON "ordenes"("codigo");

-- CreateIndex
CREATE INDEX "idx_numeros_estado" ON "numeros_sorteo"("sorteo_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "numeros_sorteo_sorteo_id_numero_texto_key" ON "numeros_sorteo"("sorteo_id", "numero_texto");

-- CreateIndex
CREATE INDEX "premios_sorteo_id_idx" ON "premios"("sorteo_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_premios_numero_unico_por_sorteo" ON "premios"("sorteo_id", "numero_sorteo_id");

-- CreateIndex
CREATE UNIQUE INDEX "facturas_orden_id_key" ON "facturas"("orden_id");

-- AddForeignKey
ALTER TABLE "ordenes" ADD CONSTRAINT "ordenes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes" ADD CONSTRAINT "ordenes_sorteo_id_fkey" FOREIGN KEY ("sorteo_id") REFERENCES "sorteos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "numeros_sorteo" ADD CONSTRAINT "numeros_sorteo_sorteo_id_fkey" FOREIGN KEY ("sorteo_id") REFERENCES "sorteos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "numeros_sorteo" ADD CONSTRAINT "numeros_sorteo_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "ordenes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "premios" ADD CONSTRAINT "premios_sorteo_id_fkey" FOREIGN KEY ("sorteo_id") REFERENCES "sorteos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "premios" ADD CONSTRAINT "premios_numero_sorteo_id_fkey" FOREIGN KEY ("numero_sorteo_id") REFERENCES "numeros_sorteo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paquetes" ADD CONSTRAINT "paquetes_sorteo_id_fkey" FOREIGN KEY ("sorteo_id") REFERENCES "sorteos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_items" ADD CONSTRAINT "ordenes_items_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "ordenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_items" ADD CONSTRAINT "ordenes_items_numero_sorteo_id_fkey" FOREIGN KEY ("numero_sorteo_id") REFERENCES "numeros_sorteo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "ordenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_usuario_admin_id_fkey" FOREIGN KEY ("usuario_admin_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
