-- Add real_name, permission_level, reports_to fields to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "real_name" VARCHAR(100);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "permission_level" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reports_to" UUID;

-- Update existing role values: 投手 → AE, 执行 → AE
UPDATE "users" SET "role" = 'AE' WHERE "role" IN ('投手', '执行', 'user');

-- Set permission_level based on existing roles
UPDATE "users" SET "permission_level" = 0 WHERE "role" = 'admin';
UPDATE "users" SET "permission_level" = 1 WHERE "role" = 'VP';
UPDATE "users" SET "permission_level" = 2 WHERE "role" = 'AD';
UPDATE "users" SET "permission_level" = 3 WHERE "role" = 'AM';
UPDATE "users" SET "permission_level" = 4 WHERE "role" = '组长';
UPDATE "users" SET "permission_level" = 5 WHERE "role" = 'AE';
