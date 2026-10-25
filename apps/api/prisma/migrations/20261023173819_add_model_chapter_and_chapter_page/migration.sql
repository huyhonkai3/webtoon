-- CreateTable
CREATE TABLE "chapters" (
    "id" UUID NOT NULL,
    "series_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "publication_status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapter_pages" (
    "id" UUID NOT NULL,
    "chapter_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "image_url" VARCHAR(2048) NOT NULL,

    CONSTRAINT "chapter_pages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chapters_series_id_publication_status_number_idx" ON "chapters"("series_id", "publication_status", "number");

-- CreateIndex
CREATE UNIQUE INDEX "chapters_series_id_number_key" ON "chapters"("series_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "chapter_pages_chapter_id_position_key" ON "chapter_pages"("chapter_id", "position");

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_pages" ADD CONSTRAINT "chapter_pages_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
