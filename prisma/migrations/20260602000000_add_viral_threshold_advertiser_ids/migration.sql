-- AlterTable: Add viralThreshold and advertiserIds to review_configs
ALTER TABLE "review_configs" ADD COLUMN "viral_threshold" INTEGER;
ALTER TABLE "review_configs" ADD COLUMN "advertiser_ids" JSONB NOT NULL DEFAULT '[]'::jsonb;
