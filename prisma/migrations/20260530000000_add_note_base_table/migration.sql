-- CreateTable
CREATE TABLE IF NOT EXISTS "note_base" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "note_id" VARCHAR(100) NOT NULL,
    "note_link" TEXT,
    "cooperation_form" VARCHAR(50),
    "is_registered" BOOLEAN NOT NULL DEFAULT false,
    "content_direction" VARCHAR(100),
    "kol_type" VARCHAR(100),
    "spu_name" VARCHAR(200),
    "content_cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "content_settlement" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ad_spend" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_base_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "note_base_project_id_note_id_key" ON "note_base"("project_id", "note_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "note_base_project_id_idx" ON "note_base"("project_id");

-- AddForeignKey
ALTER TABLE "note_base" ADD CONSTRAINT "note_base_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
