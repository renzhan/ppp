-- Add kol_nick_name and kol_fan_num columns to note_base table
ALTER TABLE "note_base" ADD COLUMN IF NOT EXISTS "kol_nick_name" VARCHAR(200);
ALTER TABLE "note_base" ADD COLUMN IF NOT EXISTS "kol_fan_num" INTEGER;
