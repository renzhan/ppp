-- AlterTable: Add review_config_id to juguang_data for linking juguang records to specific review configs
ALTER TABLE "juguang_data" ADD COLUMN "review_config_id" UUID;

-- CreateIndex
CREATE INDEX "juguang_data_review_config_id_idx" ON "juguang_data"("review_config_id");

-- AddForeignKey
ALTER TABLE "juguang_data" ADD CONSTRAINT "juguang_data_review_config_id_fkey" FOREIGN KEY ("review_config_id") REFERENCES "review_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
