-- AlterTable: Add data_source to notes (marks whether data came from API or note_base)
ALTER TABLE "notes" ADD COLUMN "data_source" VARCHAR(20) NOT NULL DEFAULT 'api';

-- AlterTable: Add ad_settlement to note_base (投流结算金额)
ALTER TABLE "note_base" ADD COLUMN "ad_settlement" DECIMAL(12,2) NOT NULL DEFAULT 0;
