import { PrismaClient } from '../../../generated/prisma';
import { BaseChapterDataLoader, ChapterDataContext } from './types';

/**
 * Chapter 3 (Data Overview / 数据总览) Data Loader
 *
 * 按字段映射表收集数据，涉及以下表：
 * - note_base: 笔记底表（总篇数、内容结算金额、投流结算金额）
 * - notes: 蒲公英数据（曝光、阅读、互动、爆文、博主报价、平台服务费）
 * - juguang_data: 聚光数据（投流消耗fee、展现impression、点击click、互动interaction）
 * - review_configs: 复盘配置（KPI目标、大盘均值、互动口径、爆文口径、金额口径）
 * - lingxi_data: 灵犀数据（AIPS人群、TI人群）
 *
 * 关键计算公式：
 * - 总费用 = IF(内容金额口径='消耗', SUM(kol_price+service_fee), SUM(content_settlement))
 *          + IF(投流金额口径='消耗', SUM(fee), SUM(ad_spend))
 * - 总互动 = IF(互动口径='含关注量', SUM(engage_num), SUM(like+fav+cmt+share))
 * - 爆文 = IF(爆文计算方式='千互', COUNT(like+fav+cmt>=1000), COUNT(like>=1000))
 * - 自然流指标 = 蒲公英指标 - 聚光指标
 * - 自然流CPX = 总费用 / 自然流指标
 */
export class DataOverviewDataLoader extends BaseChapterDataLoader {
  chapterNumber = 3;
  chapterName = '数据总览';
  requiredDataSources = ['note_base', 'notes', 'juguang_data', 'review_configs', 'lingxi_data'];
  requiredFields = [
    'project_name', 'brand',
    'note_count', 'total_cost', 'content_cost', 'traffic_cost',
    'total_impressions', 'total_reads', 'total_engagement',
    'total_likes', 'total_favs', 'total_comments', 'total_shares',
    'viral_count', 'viral_rate',
    'cpm', 'cpc', 'cpe', 'ctr',
    'juguang_fee', 'juguang_impression', 'juguang_click', 'juguang_interaction',
    'natural_impressions', 'natural_reads', 'natural_engagement',
    'natural_cpm', 'natural_cpc', 'natural_cpe', 'natural_ctr',
    'kpi_impression', 'kpi_read', 'kpi_engagement', 'kpi_viral_rate',
    'kpi_cpm', 'kpi_cpc', 'kpi_cpe', 'kpi_ctr',
    'impression_completion', 'read_completion', 'engagement_completion',
    'viral_rate_completion', 'cpm_completion', 'cpc_completion', 'cpe_completion', 'ctr_completion',
  ];

  constructor(prisma: InstanceType<typeof PrismaClient>) {
    super(prisma);
  }

  async load(projectId: string): Promise<ChapterDataContext> {
    const variables: Record<string, string> = {};

    // ── 0. 加载复盘配置（需要先读取口径设置） ──
    let engagementMetric = 'exclude_follow'; // 默认不含关注
    let viralMetric = 'like_comment_share';  // 默认千互（赞+藏+评）
    let contentCostCaliber = 'consumption';  // 默认消耗口径
    let trafficCostCaliber = 'consumption';  // 默认消耗口径
    let kpi: Record<string, number> = {};
    let benchmark: Record<string, number> = {};

    try {
      const reviewConfig = await this.prisma.reviewConfig.findFirst({
        where: { projectId },
        select: {
          kpiTargets: true,
          benchmark: true,
          engagementMetric: true,
          viralMetric: true,
          modules: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (reviewConfig) {
        if (reviewConfig.engagementMetric) {
          engagementMetric = reviewConfig.engagementMetric as string;
        }
        if (reviewConfig.viralMetric) {
          viralMetric = reviewConfig.viralMetric as string;
        }
        // contentCostCaliber / trafficCostCaliber stored in modules JSON
        const modules = reviewConfig.modules as Record<string, unknown> | null;
        if (modules?.contentCostCaliber) {
          contentCostCaliber = modules.contentCostCaliber as string;
        }
        if (modules?.trafficCostCaliber) {
          trafficCostCaliber = modules.trafficCostCaliber as string;
        }
        if (reviewConfig.kpiTargets && typeof reviewConfig.kpiTargets === 'object') {
          kpi = reviewConfig.kpiTargets as Record<string, number>;
        }
        if (reviewConfig.benchmark && typeof reviewConfig.benchmark === 'object') {
          benchmark = reviewConfig.benchmark as Record<string, number>;
        }
      }
    } catch (error) {
      console.warn(`[DataOverviewDataLoader] Failed to load review_configs: ${error}`);
    }

    variables['engagement_metric'] = engagementMetric;
    variables['viral_metric'] = viralMetric;
    variables['content_cost_caliber'] = contentCostCaliber;
    variables['traffic_cost_caliber'] = trafficCostCaliber;

    // ── 1. 项目基本信息 ──
    try {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { projectName: true, brand: true, startDate: true, endDate: true },
      });
      if (project) {
        if (project.projectName) variables['project_name'] = project.projectName;
        if (project.brand) variables['brand'] = project.brand;
        if (project.startDate) variables['start_date'] = project.startDate.toISOString().split('T')[0];
        if (project.endDate) variables['end_date'] = project.endDate.toISOString().split('T')[0];
      }
    } catch (error) {
      console.warn(`[DataOverviewDataLoader] Failed to load project: ${error}`);
    }

    // ── 2. 笔记底表 (note_base) → 总篇数、结算金额 ──
    let noteCount = 0;
    let contentSettlement = 0;
    let adSpendSettlement = 0;

    try {
      const noteBaseResult = await this.prisma.$queryRaw<[{ cnt: bigint; content_settlement_sum: number; ad_spend_sum: number }]>`
        SELECT
          COUNT(*)::bigint AS cnt,
          COALESCE(SUM(content_settlement), 0)::float AS content_settlement_sum,
          COALESCE(SUM(ad_spend), 0)::float AS ad_spend_sum
        FROM note_base
        WHERE project_id = ${projectId}::uuid
      `;
      noteCount = Number(noteBaseResult[0]?.cnt ?? 0);
      contentSettlement = noteBaseResult[0]?.content_settlement_sum ?? 0;
      adSpendSettlement = noteBaseResult[0]?.ad_spend_sum ?? 0;
    } catch (error) {
      console.warn(`[DataOverviewDataLoader] Failed to load note_base: ${error}`);
    }

    variables['note_count'] = String(noteCount);

    // ── 3. 蒲公英数据 (notes) → 曝光、阅读、互动、爆文、博主报价 ──
    let totalImpressions = 0;
    let totalReads = 0;
    let totalLikes = 0;
    let totalFavs = 0;
    let totalComments = 0;
    let totalShares = 0;
    let totalFollows = 0;
    let totalEngageNum = 0; // engage_num 原始字段
    let kolPriceSum = 0;
    let serviceFeeSum = 0;
    let viralCount = 0;

    try {
      const notes = await this.prisma.note.findMany({
        where: { projectId },
        select: {
          impNum: true,
          readNum: true,
          engageNum: true,
          likeNum: true,
          favNum: true,
          cmtNum: true,
          shareNum: true,
          followNum: true,
          kolPrice: true,
          serviceFee: true,
        },
      });

      for (const n of notes) {
        totalImpressions += n.impNum;
        totalReads += n.readNum;
        totalEngageNum += n.engageNum;
        totalLikes += n.likeNum;
        totalFavs += n.favNum;
        totalComments += n.cmtNum;
        totalShares += n.shareNum;
        totalFollows += n.followNum;
        kolPriceSum += Number(n.kolPrice);
        serviceFeeSum += Number(n.serviceFee);

        // 爆文判断
        if (viralMetric === 'like_only') {
          // 千赞：like >= 1000
          if (n.likeNum >= 1000) viralCount++;
        } else {
          // 千互（默认）：like + fav + cmt >= 1000
          if (n.likeNum + n.favNum + n.cmtNum >= 1000) viralCount++;
        }
      }
    } catch (error) {
      console.warn(`[DataOverviewDataLoader] Failed to load notes: ${error}`);
    }

    // 总互动（根据口径）
    let totalEngagement: number;
    if (engagementMetric === 'include_follow') {
      totalEngagement = totalEngageNum; // engage_num 已含关注
    } else {
      totalEngagement = totalLikes + totalFavs + totalComments + totalShares;
    }

    variables['total_impressions'] = String(totalImpressions);
    variables['total_reads'] = String(totalReads);
    variables['total_engagement'] = String(totalEngagement);
    variables['total_likes'] = String(totalLikes);
    variables['total_favs'] = String(totalFavs);
    variables['total_comments'] = String(totalComments);
    variables['total_shares'] = String(totalShares);
    variables['total_follows'] = String(totalFollows);

    // 爆文率 = 爆文数 / 总笔记篇数(note_base)
    const viralRate = noteCount > 0 ? (viralCount / noteCount) * 100 : 0;
    variables['viral_count'] = String(viralCount);
    variables['viral_rate'] = viralRate.toFixed(1);

    // CTR = 总阅读 / 总曝光 * 100
    const ctr = totalImpressions > 0 ? (totalReads / totalImpressions) * 100 : 0;
    variables['ctr'] = ctr.toFixed(2);

    // ── 4. 聚光数据 (juguang_data) ──
    let jgFee = 0;
    let jgImpression = 0;
    let jgClick = 0;
    let jgInteraction = 0;

    try {
      const juguangAgg = await this.prisma.juguangData.aggregate({
        where: { projectId },
        _sum: {
          fee: true,
          impression: true,
          click: true,
          interaction: true,
          tiUserNum: true,
        },
      });

      jgFee = Number(juguangAgg._sum.fee || 0);
      jgImpression = Number(juguangAgg._sum.impression || 0);
      jgClick = Number(juguangAgg._sum.click || 0);
      jgInteraction = Number(juguangAgg._sum.interaction || 0);

      variables['juguang_fee'] = jgFee.toFixed(2);
      variables['juguang_impression'] = String(jgImpression);
      variables['juguang_click'] = String(jgClick);
      variables['juguang_interaction'] = String(jgInteraction);
      variables['juguang_ti_user_num'] = String(Number(juguangAgg._sum.tiUserNum || 0));
    } catch (error) {
      console.warn(`[DataOverviewDataLoader] Failed to load juguang_data: ${error}`);
    }

    // ── 5. 计算总费用（根据口径） ──
    let contentCost: number;
    let trafficCost: number;

    if (contentCostCaliber === 'settlement') {
      contentCost = contentSettlement; // 业务底表.content_settlement
    } else {
      contentCost = kolPriceSum + serviceFeeSum; // 蒲公英.kol_price + service_fee
    }

    if (trafficCostCaliber === 'settlement') {
      trafficCost = adSpendSettlement; // 业务底表.ad_spend
    } else {
      trafficCost = jgFee; // 聚光.fee
    }

    const totalCost = contentCost + trafficCost;

    variables['content_cost'] = contentCost.toFixed(2);
    variables['traffic_cost'] = trafficCost.toFixed(2);
    variables['total_cost'] = totalCost.toFixed(2);

    // ── 6. 综合CPM/CPC/CPE（总费用 / 蒲公英指标） ──
    const cpm = totalImpressions > 0 ? (totalCost / totalImpressions) * 1000 : 0;
    const cpc = totalReads > 0 ? totalCost / totalReads : 0;
    const cpe = totalEngagement > 0 ? totalCost / totalEngagement : 0;

    variables['cpm'] = cpm.toFixed(2);
    variables['cpc'] = cpc.toFixed(2);
    variables['cpe'] = cpe.toFixed(2);

    // ── 7. 自然流指标 = 蒲公英 - 聚光 ──
    const naturalImp = Math.max(0, totalImpressions - jgImpression);
    const naturalRead = Math.max(0, totalReads - jgClick);
    const naturalEng = Math.max(0, totalEngagement - jgInteraction);

    variables['natural_impressions'] = String(naturalImp);
    variables['natural_reads'] = String(naturalRead);
    variables['natural_engagement'] = String(naturalEng);

    // 自然流CPX = 总费用 / 自然流指标（分子用总费用）
    variables['natural_cpm'] = naturalImp > 0 ? ((totalCost / naturalImp) * 1000).toFixed(2) : '0';
    variables['natural_cpc'] = naturalRead > 0 ? (totalCost / naturalRead).toFixed(2) : '0';
    variables['natural_cpe'] = naturalEng > 0 ? (totalCost / naturalEng).toFixed(2) : '0';
    variables['natural_ctr'] = naturalImp > 0 ? ((naturalRead / naturalImp) * 100).toFixed(2) : '0';

    // ── 8. KPI目标与完成率 ──
    // KPI字段映射（前端传入的key → 变量名）
    const kpiMapping: Record<string, { varKey: string; actual: number; isCost: boolean }> = {
      totalImpression: { varKey: 'impression', actual: totalImpressions, isCost: false },
      totalRead: { varKey: 'read', actual: totalReads, isCost: false },
      totalEngagement: { varKey: 'engagement', actual: totalEngagement, isCost: false },
      viralPosts1k: { varKey: 'viral_rate', actual: viralRate, isCost: false },
      cpm: { varKey: 'cpm', actual: cpm, isCost: true },
      cpc: { varKey: 'cpc', actual: cpc, isCost: true },
      cpe: { varKey: 'cpe', actual: cpe, isCost: true },
      ctr: { varKey: 'ctr', actual: ctr, isCost: false },
    };

    for (const [kpiKey, config] of Object.entries(kpiMapping)) {
      const kpiValue = kpi[kpiKey];
      if (kpiValue != null && kpiValue > 0) {
        variables[`kpi_${config.varKey}`] = String(kpiValue);

        // 完成率计算
        let completion: number;
        if (config.isCost) {
          // 成本类：KPI/实际*100（越低越好，KPI是上限）
          completion = config.actual > 0 ? (kpiValue / config.actual) * 100 : 0;
        } else {
          // 量级类：实际/KPI*100
          completion = (config.actual / kpiValue) * 100;
        }
        variables[`${config.varKey}_completion`] = completion.toFixed(1);
      }
    }

    // ── 9. 大盘均值 ──
    if (benchmark.ctr) variables['benchmark_ctr'] = String(benchmark.ctr);
    if (benchmark.cpm) variables['benchmark_cpm'] = String(benchmark.cpm);
    if (benchmark.cpc) variables['benchmark_cpc'] = String(benchmark.cpc);
    if (benchmark.cpe) variables['benchmark_cpe'] = String(benchmark.cpe);
    if (benchmark.engagementRate) variables['benchmark_engagement_rate'] = String(benchmark.engagementRate);

    // ── 10. 灵犀数据 (lingxi_data) → AIPS/TI人群 ──
    try {
      const lingxiRecords = await this.prisma.lingxiData.findMany({
        where: { projectId },
        select: { dataType: true, dataContent: true },
      });

      for (const record of lingxiRecords) {
        const content = record.dataContent as Record<string, unknown>;
        if (record.dataType === 'brand' && content) {
          if (content.aips) variables['aips_brand'] = String(content.aips);
          if (content.ti) variables['ti_brand'] = String(content.ti);
        }
        if (record.dataType === 'spu' && content) {
          if (content.aips) variables['aips_spu'] = String(content.aips);
          if (content.ti) variables['ti_spu'] = String(content.ti);
        }
      }
    } catch (error) {
      console.warn(`[DataOverviewDataLoader] Failed to load lingxi_data: ${error}`);
    }

    return this.buildContext(variables);
  }
}
