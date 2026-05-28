-- 创建 note_base 表（笔记底表，业务底表Excel导入）
-- 记录运营标注与费用数据，蒲公英API不提供这些字段
-- notes 表仅存蒲公英API爬取的数据

CREATE TABLE "note_base" (
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

-- 创建索引
CREATE INDEX "note_base_project_id_idx" ON "note_base"("project_id");
CREATE UNIQUE INDEX "note_base_project_id_note_id_key" ON "note_base"("project_id", "note_id");

-- 添加外键
ALTER TABLE "note_base" ADD CONSTRAINT "note_base_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
