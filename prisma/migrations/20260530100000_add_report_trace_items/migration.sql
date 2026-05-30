-- CreateTable
CREATE TABLE "report_trace_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "review_config_id" UUID NOT NULL,
    "trace_id" VARCHAR(100) NOT NULL,
    "chapter_number" INTEGER NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "source_table" VARCHAR(100) NOT NULL,
    "source_query" TEXT NOT NULL,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "columns" JSONB NOT NULL,
    "data_rows" JSONB NOT NULL,
    "calculations" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "report_trace_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_trace_items_review" ON "report_trace_items"("review_config_id");

-- CreateIndex
CREATE UNIQUE INDEX "report_trace_items_review_config_id_trace_id_key" ON "report_trace_items"("review_config_id", "trace_id");

-- AddForeignKey
ALTER TABLE "report_trace_items" ADD CONSTRAINT "report_trace_items_review_config_id_fkey" FOREIGN KEY ("review_config_id") REFERENCES "review_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
