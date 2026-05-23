-- AlterTable: Add new columns to projects table for page-redesign-v2
ALTER TABLE "projects" ADD COLUMN "business_line" VARCHAR(200);
ALTER TABLE "projects" ADD COLUMN "created_by" UUID;
ALTER TABLE "projects" ADD COLUMN "participants" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "projects" ADD COLUMN "is_imported" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "projects" ADD COLUMN "note_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable: project_tree_nodes (级联选择器数据源)
CREATE TABLE "project_tree_nodes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category" VARCHAR(200) NOT NULL,
    "brand" VARCHAR(200) NOT NULL,
    "business_line" VARCHAR(200) NOT NULL,
    "import_batch_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_tree_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable: review_configs (复盘配置表)
CREATE TABLE "review_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "benchmark" JSONB NOT NULL DEFAULT '{}',
    "influencer_tiers" JSONB NOT NULL DEFAULT '[]',
    "kpi_targets" JSONB NOT NULL DEFAULT '{}',
    "engagement_metric" VARCHAR(30) NOT NULL DEFAULT 'exclude_follow',
    "viral_metric" VARCHAR(30) NOT NULL DEFAULT 'like_comment_share',
    "modules" JSONB NOT NULL DEFAULT '{}',
    "launch_phases" JSONB NOT NULL DEFAULT '[]',
    "plan_file_url" TEXT,
    "plan_file_name" VARCHAR(500),
    "report_content" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: sentiment_data (舆情数据表)
CREATE TABLE "sentiment_data" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "data_type" VARCHAR(50) NOT NULL,
    "data_content" JSONB NOT NULL,
    "period_start" DATE,
    "period_end" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sentiment_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable: export_records (导出记录表)
CREATE TABLE "export_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "export_type" VARCHAR(50) NOT NULL,
    "file_name" VARCHAR(500) NOT NULL,
    "file_url" TEXT,
    "exported_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "export_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: project_tree_nodes indexes
CREATE INDEX "project_tree_nodes_category_idx" ON "project_tree_nodes"("category");
CREATE INDEX "project_tree_nodes_category_brand_idx" ON "project_tree_nodes"("category", "brand");
CREATE UNIQUE INDEX "project_tree_nodes_category_brand_business_line_key" ON "project_tree_nodes"("category", "brand", "business_line");

-- CreateIndex: review_configs indexes
CREATE INDEX "review_configs_project_id_idx" ON "review_configs"("project_id");
CREATE INDEX "review_configs_created_by_idx" ON "review_configs"("created_by");

-- CreateIndex: sentiment_data indexes
CREATE INDEX "sentiment_data_project_id_idx" ON "sentiment_data"("project_id");
CREATE INDEX "sentiment_data_project_id_data_type_idx" ON "sentiment_data"("project_id", "data_type");

-- CreateIndex: export_records indexes
CREATE INDEX "export_records_project_id_idx" ON "export_records"("project_id");
CREATE INDEX "export_records_exported_by_idx" ON "export_records"("exported_by");

-- AddForeignKey: review_configs -> projects
ALTER TABLE "review_configs" ADD CONSTRAINT "review_configs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
