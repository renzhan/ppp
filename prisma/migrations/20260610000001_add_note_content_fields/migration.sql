-- Add content fields to notes table for fillNotesFromNoteBase two-step logic
ALTER TABLE "notes" ADD COLUMN "content_direction" VARCHAR(100);
ALTER TABLE "notes" ADD COLUMN "cooperation_form" VARCHAR(100);
ALTER TABLE "notes" ADD COLUMN "total_cost" DECIMAL(12, 2);
