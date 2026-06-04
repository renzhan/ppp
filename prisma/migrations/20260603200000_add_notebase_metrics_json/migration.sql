-- Add metrics JSON column to note_base table for storing all extra data columns from Excel
ALTER TABLE "note_base" ADD COLUMN IF NOT EXISTS "metrics" JSONB;
