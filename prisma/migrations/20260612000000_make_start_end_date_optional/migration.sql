-- AlterTable: make start_date and end_date optional (nullable)
-- start_date is deprecated in favor of execution_start_date
ALTER TABLE "projects" ALTER COLUMN "start_date" DROP NOT NULL;
ALTER TABLE "projects" ALTER COLUMN "end_date" DROP NOT NULL;
