-- AlterTable: Add lingxi account ID and taxonomy fields to projects
ALTER TABLE "projects" ADD COLUMN "lingxi_account_id" VARCHAR(100);
ALTER TABLE "projects" ADD COLUMN "lingxi_taxonomy_code" VARCHAR(100);
ALTER TABLE "projects" ADD COLUMN "lingxi_taxonomy_path" VARCHAR(500);
