-- AlterTable: Add dimension fields to juguang_data for GROUP BY analysis
-- placement: 广告类型/投放位置（1-信息流、2-搜索、4-全站智投、7-视频流）
-- targets_detail: 精准定向/人群定向名称
-- keyword: 关键词/搜索主题名称

ALTER TABLE "juguang_data" ADD COLUMN "placement" VARCHAR(50);
ALTER TABLE "juguang_data" ADD COLUMN "targets_detail" VARCHAR(200);
ALTER TABLE "juguang_data" ADD COLUMN "keyword" VARCHAR(200);
