-- AlterTable: Add execution_start_date to projects
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "execution_start_date" DATE;
