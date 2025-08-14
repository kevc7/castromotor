-- CreateTable
CREATE TABLE "pagos_payphone" (
    "id" BIGSERIAL NOT NULL,
    "orden_id" BIGINT NOT NULL,
    "client_txn_id" TEXT NOT NULL,
    "payphone_txn_id" TEXT,
    "status" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "raw" JSONB,
    "expires_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_payphone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pagos_payphone_orden_id_key" ON "pagos_payphone"("orden_id");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_payphone_client_txn_id_key" ON "pagos_payphone"("client_txn_id");

-- AddForeignKey
ALTER TABLE "pagos_payphone" ADD CONSTRAINT "pagos_payphone_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "ordenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
