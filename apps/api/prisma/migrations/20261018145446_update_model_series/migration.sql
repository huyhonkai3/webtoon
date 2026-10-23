/*
  Warnings:

  - You are about to drop the column `status` on the `series` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "series_status_created_at_id_idx";

-- AlterTable
ALTER TABLE "series" DROP COLUMN "status",
ADD COLUMN     "cover_asset_id" UUID,
ADD COLUMN     "publication_status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateIndex
CREATE INDEX "series_publication_status_created_at_id_idx" ON "series"("publication_status", "created_at" DESC, "id" DESC);
