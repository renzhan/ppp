-- ============================================================
-- 派盘盘 (ppp) 数据库初始化脚本
-- 在 PostgreSQL 中执行此脚本创建所有表
-- ============================================================

-- 确保 uuid 扩展可用
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 0. 用户表
-- ============================================================
CREATE TABLE IF NOT EXISTS "users" (
  "id"                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "username"             VARCHAR(50) NOT NULL UNIQUE,
  "password_hash"        VARCHAR(200) NOT NULL,
  "display_name"         VARCHAR(100),
  "real_name"            VARCHAR(100),
  "role"                 VARCHAR(20) NOT NULL DEFAULT 'AE',
  "permission_level"     INTEGER NOT NULL DEFAULT 5,
  "reports_to"           UUID,
  "must_change_password" BOOLEAN NOT NULL DEFAULT true,
  "is_active"            BOOLEAN NOT NULL DEFAULT true,
  "last_login_at"        TIMESTAMPTZ,
  "created_at"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 默认管理员 admin / ppp666
INSERT INTO "users" ("username", "password_hash", "role", "permission_level", "must_change_password", "display_name")
VALUES ('admin', '$2b$10$8EDP6o5pmKjm2sGbfTW00umtZEXI3HrUzYghnL0/7YHqY48dd8OsC', 'admin', 0, false, '管理员')
ON CONFLICT ("username") DO NOTHING;

-- 确保 uuid 扩展可用
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. 项目表
-- ============================================================
CREATE TABLE IF NOT EXISTS "projects" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "category"            VARCHAR(100) NOT NULL,
  "brand"               VARCHAR(200) NOT NULL,
  "spu_name"            VARCHAR(200),
  "project_name"        VARCHAR(200) NOT NULL,
  "project_type"        VARCHAR(50) NOT NULL DEFAULT '日常种草',
  "start_date"          DATE NOT NULL,
  "end_date"            DATE NOT NULL,
  "engagement_config"   JSONB NOT NULL DEFAULT '{"includeShare": true, "includeFollow": true}',
  "cooperation_policy"  JSONB NOT NULL DEFAULT '{"defaultDiscount": 1, "specialRules": []}',
  "created_at"          TIMESTAMPTZ DEFAULT now(),
  "status"              VARCHAR(20) NOT NULL DEFAULT 'draft',
  "updated_at"          TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2. 笔记表（蒲公英数据）
-- ============================================================
CREATE TABLE IF NOT EXISTS "notes" (
  "id"                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id"           UUID NOT NULL REFERENCES "projects"("id"),
  "note_id"              VARCHAR(100) NOT NULL,
  "brand_user_name"      VARCHAR(200),
  "spu_name"             VARCHAR(200),
  "kol_nick_name"        VARCHAR(200),
  "kol_id"               VARCHAR(100),
  "kol_fan_num"          INTEGER,
  "note_type"            VARCHAR(20),
  "note_link"            TEXT,
  "imp_num"              INTEGER NOT NULL DEFAULT 0,
  "read_num"             INTEGER NOT NULL DEFAULT 0,
  "engage_num"           INTEGER NOT NULL DEFAULT 0,
  "like_num"             INTEGER NOT NULL DEFAULT 0,
  "fav_num"              INTEGER NOT NULL DEFAULT 0,
  "cmt_num"              INTEGER NOT NULL DEFAULT 0,
  "share_num"            INTEGER NOT NULL DEFAULT 0,
  "follow_num"           INTEGER NOT NULL DEFAULT 0,
  "kol_price"            DECIMAL(12,2) NOT NULL DEFAULT 0,
  "service_fee"          DECIMAL(12,2) NOT NULL DEFAULT 0,
  "total_platform_price" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "heat_imp_num"         INTEGER NOT NULL DEFAULT 0,
  "heat_read_num"        INTEGER NOT NULL DEFAULT 0,
  "is_underwater"        BOOLEAN NOT NULL DEFAULT false,
  "underwater_price"     DECIMAL(12,2) NOT NULL DEFAULT 0,
  "components"           JSONB,
  "created_at"           TIMESTAMPTZ DEFAULT now(),
  UNIQUE("project_id", "note_id")
);
CREATE INDEX IF NOT EXISTS "idx_notes_project_id" ON "notes"("project_id");

-- ============================================================
-- 3. 聚光数据表
-- ============================================================
CREATE TABLE IF NOT EXISTS "juguang_data" (
  "id"                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id"               UUID NOT NULL REFERENCES "projects"("id"),
  "note_id"                  VARCHAR(100),
  "fee"                      DECIMAL(12,2) NOT NULL DEFAULT 0,
  "impression"               INTEGER NOT NULL DEFAULT 0,
  "click"                    INTEGER NOT NULL DEFAULT 0,
  "interaction"              INTEGER NOT NULL DEFAULT 0,
  "i_user_num"               INTEGER NOT NULL DEFAULT 0,
  "ti_user_num"              INTEGER NOT NULL DEFAULT 0,
  "i_user_price"             DECIMAL(12,4) NOT NULL DEFAULT 0,
  "ti_user_price"            DECIMAL(12,4) NOT NULL DEFAULT 0,
  "search_cmt_click"         INTEGER NOT NULL DEFAULT 0,
  "search_cmt_after_read"    INTEGER NOT NULL DEFAULT 0,
  "search_cmt_after_read_avg" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "search_cmt_click_cvr"     DECIMAL(8,4) NOT NULL DEFAULT 0,
  "created_at"               TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_juguang_project_id" ON "juguang_data"("project_id");

-- ============================================================
-- 4. 业务标注表
-- ============================================================
CREATE TABLE IF NOT EXISTS "business_annotations" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id"        UUID NOT NULL REFERENCES "projects"("id"),
  "note_id"           VARCHAR(100) NOT NULL,
  "content_direction" VARCHAR(100),
  "account_type"      VARCHAR(100),
  "kol_type"          VARCHAR(100),
  "launch_phase"      VARCHAR(100),
  "is_underwater"     BOOLEAN NOT NULL DEFAULT false,
  "created_at"        TIMESTAMPTZ DEFAULT now(),
  UNIQUE("project_id", "note_id")
);
CREATE INDEX IF NOT EXISTS "idx_annotations_project_id" ON "business_annotations"("project_id");

-- ============================================================
-- 5. 灵犀数据表
-- ============================================================
CREATE TABLE IF NOT EXISTS "lingxi_data" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id"   UUID NOT NULL REFERENCES "projects"("id"),
  "data_type"    VARCHAR(50) NOT NULL,
  "data_content" JSONB NOT NULL,
  "period_start" DATE,
  "period_end"   DATE,
  "created_at"   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_lingxi_project_id" ON "lingxi_data"("project_id");

-- ============================================================
-- 6. 人工录入数据表
-- ============================================================
CREATE TABLE IF NOT EXISTS "manual_inputs" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id"   UUID NOT NULL REFERENCES "projects"("id"),
  "input_type"   VARCHAR(50) NOT NULL,
  "data_content" JSONB NOT NULL,
  "created_at"   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_manual_project_id" ON "manual_inputs"("project_id");

-- ============================================================
-- 7. KPI 目标表
-- ============================================================
CREATE TABLE IF NOT EXISTS "kpi_targets" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id"    UUID NOT NULL REFERENCES "projects"("id"),
  "metric_name"   VARCHAR(50) NOT NULL,
  "target_value"  DECIMAL(15,4) NOT NULL,
  "is_cost_metric" BOOLEAN NOT NULL DEFAULT false,
  UNIQUE("project_id", "metric_name")
);
CREATE INDEX IF NOT EXISTS "idx_kpi_project_id" ON "kpi_targets"("project_id");

-- ============================================================
-- 8. 计算结果缓存表
-- ============================================================
CREATE TABLE IF NOT EXISTS "calculated_metrics" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id"    UUID NOT NULL REFERENCES "projects"("id"),
  "metric_type"   VARCHAR(100) NOT NULL,
  "metric_value"  JSONB NOT NULL,
  "calculated_at" TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_calc_project_id" ON "calculated_metrics"("project_id");

-- ============================================================
-- 9. AI 生成内容表
-- ============================================================
CREATE TABLE IF NOT EXISTS "ai_generated_content" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id"        UUID NOT NULL REFERENCES "projects"("id"),
  "content_type"      VARCHAR(50) NOT NULL,
  "generated_content" TEXT,
  "edited_content"    TEXT,
  "is_edited"         BOOLEAN NOT NULL DEFAULT false,
  "created_at"        TIMESTAMPTZ DEFAULT now(),
  "updated_at"        TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 10. 竞品数据表
-- ============================================================
CREATE TABLE IF NOT EXISTS "competitor_data" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id"      UUID NOT NULL REFERENCES "projects"("id"),
  "competitor_name" VARCHAR(200) NOT NULL,
  "metrics"         JSONB NOT NULL,
  "created_at"      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 11. 报告版本表
-- ============================================================
CREATE TABLE IF NOT EXISTS "report_versions" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id"     UUID NOT NULL REFERENCES "projects"("id"),
  "version_number" INTEGER NOT NULL,
  "generated_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "config"         JSONB NOT NULL DEFAULT '{}',
  "content"        JSONB NOT NULL DEFAULT '{}',
  "status"         VARCHAR(20) NOT NULL DEFAULT 'draft',
  "created_by"     VARCHAR(100),
  UNIQUE("project_id", "version_number")
);
CREATE INDEX IF NOT EXISTS "idx_versions_project_id" ON "report_versions"("project_id");

-- ============================================================
-- 12. 模块决策表
-- ============================================================
CREATE TABLE IF NOT EXISTS "module_decisions" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id"      UUID NOT NULL REFERENCES "projects"("id"),
  "version_id"      UUID NOT NULL REFERENCES "report_versions"("id"),
  "module_id"       VARCHAR(10) NOT NULL,
  "module_name"     VARCHAR(100) NOT NULL,
  "status"          VARCHAR(20) NOT NULL,
  "reason"          TEXT,
  "degraded_fields" JSONB,
  "is_overridden"   BOOLEAN NOT NULL DEFAULT false,
  "overridden_at"   TIMESTAMPTZ,
  UNIQUE("version_id", "module_id")
);
CREATE INDEX IF NOT EXISTS "idx_decisions_project_id" ON "module_decisions"("project_id");
CREATE INDEX IF NOT EXISTS "idx_decisions_version_id" ON "module_decisions"("version_id");

-- ============================================================
-- 13. 指标评级表
-- ============================================================
CREATE TABLE IF NOT EXISTS "metric_ratings" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id"          UUID NOT NULL REFERENCES "projects"("id"),
  "metric_name"         VARCHAR(50) NOT NULL,
  "is_cost_metric"      BOOLEAN NOT NULL DEFAULT false,
  "vs_kpi_ratio"        DECIMAL(10,4),
  "vs_kpi_rating"       VARCHAR(5),
  "vs_benchmark_ratio"  DECIMAL(10,4),
  "vs_benchmark_rating" VARCHAR(5),
  "vs_pre_ratio"        DECIMAL(10,4),
  "vs_pre_rating"       VARCHAR(5),
  "final_rating"        VARCHAR(5) NOT NULL,
  "calculated_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE("project_id", "metric_name")
);
CREATE INDEX IF NOT EXISTS "idx_ratings_project_id" ON "metric_ratings"("project_id");

-- ============================================================
-- 14. 审校编辑记录表
-- ============================================================
CREATE TABLE IF NOT EXISTS "review_edits" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id"       UUID NOT NULL REFERENCES "projects"("id"),
  "version_id"       UUID NOT NULL REFERENCES "report_versions"("id"),
  "module_id"        VARCHAR(10) NOT NULL,
  "edit_type"        VARCHAR(50) NOT NULL,
  "previous_content" JSONB,
  "new_content"      JSONB,
  "edited_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "edited_by"        VARCHAR(100)
);
CREATE INDEX IF NOT EXISTS "idx_edits_version_id" ON "review_edits"("version_id");
CREATE INDEX IF NOT EXISTS "idx_edits_project_id" ON "review_edits"("project_id");

-- ============================================================
-- 15. 用户表
-- ============================================================
CREATE TABLE IF NOT EXISTS "users" (
  "id"                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "username"             VARCHAR(50) NOT NULL UNIQUE,
  "password_hash"        VARCHAR(200) NOT NULL,
  "display_name"         VARCHAR(100),
  "role"                 VARCHAR(20) NOT NULL DEFAULT 'user',
  "must_change_password" BOOLEAN NOT NULL DEFAULT true,
  "is_active"            BOOLEAN NOT NULL DEFAULT true,
  "last_login_at"        TIMESTAMPTZ,
  "created_at"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 完成
-- ============================================================
