-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "series" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(220) NOT NULL,
    "description" TEXT,
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "series_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "series_slug_key" ON "series"("slug");

-- CreateIndex
CREATE INDEX "series_status_created_at_id_idx" ON "series"("status", "created_at" DESC, "id" DESC);

ALTER TABLE "series"
RENAME COLUMN "status" TO "publication_status";

ALTER TABLE "series"
ADD COLUMN "cover_asset_id" UUID;

ALTER INDEX "series_status_created_at_id_idx"
RENAME TO "series_publication_status_created_at_id_idx";