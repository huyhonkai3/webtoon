ALTER TABLE "series"
RENAME COLUMN "status" TO "publication_status";

ALTER TABLE "series"
ADD COLUMN "cover_asset_id" UUID;

ALTER INDEX "series_status_created_at_id_idx"
RENAME TO "series_publication_status_created_at_id_idx";