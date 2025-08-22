-- DropIndex
DROP INDEX "social_posts_activo_orden_idx";

-- AlterTable
ALTER TABLE "social_posts" ADD COLUMN     "tipo" TEXT NOT NULL DEFAULT 'social';

-- CreateIndex
CREATE INDEX "social_posts_activo_orden_tipo_idx" ON "social_posts"("activo", "orden", "tipo");
