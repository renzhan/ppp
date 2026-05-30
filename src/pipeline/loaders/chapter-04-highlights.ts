import { PrismaClient } from '../../../generated/prisma';
import { BaseChapterDataLoader, ChapterDataContext, TraceItem } from './types';

/**
 * Chapter 4 (项目亮点) Data Loader
 *
 * 数据来源：
 * - review_configs: KPI目标、大盘均值、互动口径、爆文口径、金额口径
 * - notes: 蒲公英数据（曝光、阅读、互动、爆文、费用）
 * - note_base: 笔记底表（总篇数、结算金额）
 * - juguang_data: 聚光数据（投流费用）
 * - lingxi_data: 灵犀数据（AIPS人群、TI人群、搜索指数）
 *
 * 亮点维度（AIPS框架）：
 * - KPI完成率亮点：完成率>100%的指标
 * - 与大盘对比亮点：优于大盘的CPM/CPC/CPE/CTR
 * - 人群资产亮点：AIPS人群总数、变化率、TI人群增长
 * - 搜索指数亮点：搜索量变化、排名变化、品牌热度
 * - 内容传播亮点：爆文率、爆文数
 */
export class HighlightsDataLoader extends BaseChapterDataLoader {
  chapterNumber = 4;
  chapterName = '项目亮点';
  requiredDataSources = ['notes', 'note_base', 'juguang_data', 'review_configs', 'lingxi_data'];
  requiredFields = [
    'kpi_highlights', 'benchmark_highlights',
    'aips_highlights', 'search_highlights',
    'viral_highlights', 'brand_data_summary',
  ];

  constructor(prisma: InstanceType<typeof PrismaClient>) {
    super(prisma);
  }

  async load(projectId: string): Promise<ChapterDataContext> {
    const variables: Record<string, string> = {};

    // ── 0. 加载复盘配置 ──
    let engagementMetric = 'exclude_follow';
    let viralMetric = 'like_comment_share';
    let contentCostCaliber = 'consumption';
    let trafficCostCaliber = 'consumption';
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
        },
        orderBy: { createdAt: 'desc' },
      });

      if (reviewConfig) {
        if (reviewConfig.engagementMetric) engagementMetric = reviewConfig.engagementMetric as string;
        if (reviewConfig.viralMetric) viralMetric = reviewConfig.viralMetric as string;
        if ((reviewConfig as any).contentCostCaliber) contentCostCaliber = (reviewConfig as any).contentCostCaliber;
        if ((reviewConfig as any).trafficCostCaliber) trafficCostCaliber = (reviewConfig as any).trafficCostCaliber;
        if (reviewConfig.kpiTargets && typeof reviewConfig.kpiTargets === 'object') {
          kpi = reviewConfig.kpiTargets as Record<string, number>;
        }
        if (reviewConfig.benchmark && typeof reviewConfig.benchmark === 'object') {
          benchmark = reviewConfig.benchmark as Record<string, number>;
        }
      }
    } catch (error) {
      console.warn(`[HighlightsDataLoader] Failed to load review_configs: ${error}`);
    }

    // ── 1. 蒲公英数据 → 曝光/阅读/互动/爆文/费用 ──
    let totalImpressions = 0;
    let totalReads = 0;
    let totalEngagement = 0;
    let totalLikes = 0;
    let totalFavs = 0;
    let totalComments = 0;
    let totalShares = 0;
    let kolPriceSum = 0;
    let serviceFeeSum = 0;
    let viralCount = 0;
    let noteCount = 0;

    try {
      const notes = await this.prisma.note.findMany({
        where: { projectId },
        select: {
          impNum: true, readNum: true, engageNum: true,
          likeNum: true, favNum: true, cmtNum: true, shareNum: true,
          kolPrice: true, serviceFee: true,
        },
      });

      for (const n of notes) {
        totalImpressions += n.impNum;
        totalReads += n.readNum;
        totalLikes += n.likeNum;
        totalFavs += n.favNum;
        totalComments += n.cmtNum;
        totalShares += n.shareNum;
        kolPriceSum += Number(n.kolPrice);
        serviceFeeSum += Number(n.serviceFee);

        // 爆文判断
        if (viralMetric === 'like_only') {
          if (n.likeNum >= 1000) viralCount++;
        } else {
          if (n.likeNum + n.favNum + n.cmtNum >= 1000) viralCount++;
        }
      }

      // 总互动
      if (engagementMetric === 'include_follow') {
        totalEngagement = notes.reduce((s, n) => s + n.engageNum, 0);
      } else {
        totalEngagement = totalLikes + totalFavs + totalComments + totalShares;
      }
    } catch (error) {
      console.warn(`[HighlightsDataLoader] Failed to load notes: ${error}`);
    }

    // ── 2. 笔记底表 → 总篇数、结算金额 ──
    let contentSettlement = 0;
    let adSpendSettlement = 0;

    try {
      const noteBaseResult = await this.prisma.$queryRaw<[{ cnt: bigint; cs: number; ads: number }]>`
        SELECT COUNT(*)::bigint AS cnt,
               COALESCE(SUM(content_settlement), 0)::float AS cs,
               COALESCE(SUM(ad_spend), 0)::float AS ads
        FROM note_base WHERE project_id = ${projectId}::uuid
      `;
      noteCount = Number(noteBaseResult[0]?.cnt ?? 0);
      contentSettlement = noteBaseResult[0]?.cs ?? 0;
      adSpendSettlement = noteBaseResult[0]?.ads ?? 0;
    } catch (error) {
      console.warn(`[HighlightsDataLoader] Failed to load note_base: ${error}`);
    }

    // ── 3. 聚光数据 ──
    let jgFee = 0;

    try {
      const juguangAgg = await this.prisma.juguangData.aggregate({
        where: { projectId },
        _sum: { fee: true },
      });
      jgFee = Number(juguangAgg._sum.fee || 0);
    } catch (error) {
      console.warn(`[HighlightsDataLoader] Failed to load juguang_data: ${error}`);
    }

    // ── 4. 计算总费用和综合指标 ──
    const contentCost = contentCostCaliber === 'settlement' ? contentSettlement : (kolPriceSum + serviceFeeSum);
    const trafficCost = trafficCostCaliber === 'settlement' ? adSpendSettlement : jgFee;
    const totalCost = contentCost + trafficCost;

    const cpm = totalImpressions > 0 ? (totalCost / totalImpressions) * 1000 : 0;
    const cpc = totalReads > 0 ? totalCost / totalReads : 0;
    const cpe = totalEngagement > 0 ? totalCost / totalEngagement : 0;
    const ctr = totalImpressions > 0 ? (totalReads / totalImpressions) * 100 : 0;
    const viralRate = noteCount > 0 ? (viralCount / noteCount) * 100 : 0;

    // ── 5. KPI亮点（完成率>100%的指标） ──
    const kpiHighlights: string[] = [];

    const kpiChecks: Array<{ key: string; label: string; actual: number; isCost: boolean }> = [
      { key: 'totalImpression', label: '总曝光', actual: totalImpressions, isCost: false },
      { key: 'totalRead', label: '总阅读', actual: totalReads, isCost: false },
      { key: 'totalEngagement', label: '总互动', actual: totalEngagement, isCost: false },
      { key: 'viralPosts1k', label: '爆文率', actual: viralRate, isCost: false },
      { key: 'cpm', label: 'CPM', actual: cpm, isCost: true },
      { key: 'cpc', label: 'CPC', actual: cpc, isCost: true },
      { key: 'cpe', label: 'CPE', actual: cpe, isCost: true },
      { key: 'ctr', label: 'CTR', actual: ctr, isCost: false },
    ];

    for (const check of kpiChecks) {
      const target = kpi[check.key];
      if (target != null && target > 0) {
        const completion = check.isCost
          ? (target / check.actual) * 100
          : (check.actual / target) * 100;
        if (completion > 100) {
          kpiHighlights.push(`${check.label}：KPI ${target}，实际 ${check.actual.toFixed(check.isCost ? 2 : 0)}，完成率 ${completion.toFixed(0)}%`);
        }
      }
    }

    variables['kpi_highlights'] = kpiHighlights.length > 0
      ? kpiHighlights.join('\n')
      : '暂无超额完成的KPI指标';

    // ── 6. 大盘对比亮点（优于大盘的指标） ──
    const benchmarkHighlights: string[] = [];

    if (benchmark.cpm && cpm > 0 && cpm < benchmark.cpm) {
      benchmarkHighlights.push(`CPM：实际${cpm.toFixed(2)}，大盘${benchmark.cpm}，优于大盘${((1 - cpm / benchmark.cpm) * 100).toFixed(0)}%`);
    }
    if (benchmark.cpc && cpc > 0 && cpc < benchmark.cpc) {
      benchmarkHighlights.push(`CPC：实际${cpc.toFixed(2)}，大盘${benchmark.cpc}，优于大盘${((1 - cpc / benchmark.cpc) * 100).toFixed(0)}%`);
    }
    if (benchmark.cpe && cpe > 0 && cpe < benchmark.cpe) {
      benchmarkHighlights.push(`CPE：实际${cpe.toFixed(2)}，大盘${benchmark.cpe}，优于大盘${((1 - cpe / benchmark.cpe) * 100).toFixed(0)}%`);
    }
    if (benchmark.ctr && ctr > 0 && ctr > benchmark.ctr) {
      benchmarkHighlights.push(`CTR：实际${ctr.toFixed(2)}%，大盘${benchmark.ctr}%，优于大盘${((ctr / benchmark.ctr - 1) * 100).toFixed(0)}%`);
    }

    variables['benchmark_highlights'] = benchmarkHighlights.length > 0
      ? benchmarkHighlights.join('\n')
      : '暂无大盘对比数据';

    // ── 7. 爆文亮点 ──
    variables['viral_highlights'] = `爆文数：${viralCount}篇，爆文率：${viralRate.toFixed(1)}%（总笔记${noteCount}篇）\n爆文口径：${viralMetric === 'like_only' ? '赞≥1000' : '赞+藏+评≥1000'}`;

    // ── 8. 灵犀数据 → 人群资产亮点 + 搜索指数亮点 ──
    try {
      const lingxiRecords = await this.prisma.lingxiData.findMany({
        where: { projectId },
        select: { dataType: true, dataContent: true, periodStart: true, periodEnd: true },
        orderBy: { createdAt: 'desc' },
      });

      const aipsHighlights: string[] = [];
      const searchHighlights: string[] = [];

      for (const record of lingxiRecords) {
        const content = record.dataContent as Record<string, unknown>;
        if (!content) continue;

        if (record.dataType === 'brand' || record.dataType === 'spu') {
          const prefix = record.dataType === 'brand' ? '品牌' : 'SPU';
          if (content.aips) aipsHighlights.push(`${prefix} AIPS人群总数：${content.aips}`);
          if (content.ti) aipsHighlights.push(`${prefix} TI深度兴趣人群：${content.ti}`);
          if (content.aipsChange) aipsHighlights.push(`${prefix} AIPS变化率：${content.aipsChange}`);
          if (content.tiChange) aipsHighlights.push(`${prefix} TI变化率：${content.tiChange}`);
          if (content.newAssets) aipsHighlights.push(`${prefix} 新增资产数：${content.newAssets}`);
        }

        if (record.dataType === 'search' || record.dataType === 'brand_search') {
          if (content.searchVolumeBefore) searchHighlights.push(`搜索量（投前）：${content.searchVolumeBefore}`);
          if (content.searchVolumeAfter) searchHighlights.push(`搜索量（投后）：${content.searchVolumeAfter}`);
          if (content.searchRankBefore) searchHighlights.push(`搜索排名（投前）：${content.searchRankBefore}`);
          if (content.searchRankAfter) searchHighlights.push(`搜索排名（投后）：${content.searchRankAfter}`);
          if (content.brandHeat) searchHighlights.push(`品牌热度变化：${content.brandHeat}`);
        }

        if (record.dataType === 'aips') {
          // 通用AIPS数据
          if (content.total) aipsHighlights.push(`AIPS人群总数：${content.total}`);
          if (content.awareness) aipsHighlights.push(`A(被看见)：${content.awareness}`);
          if (content.interest) aipsHighlights.push(`I(被互动)：${content.interest}`);
          if (content.trueInterest) aipsHighlights.push(`TI(被种草)：${content.trueInterest}`);
          if (content.share) aipsHighlights.push(`S(被分享)：${content.share}`);
          if (content.conversionRate) aipsHighlights.push(`流转率：${content.conversionRate}`);
        }
      }

      variables['aips_highlights'] = aipsHighlights.length > 0
        ? aipsHighlights.join('\n')
        : '暂无人群资产数据（灵犀）';

      variables['search_highlights'] = searchHighlights.length > 0
        ? searchHighlights.join('\n')
        : '暂无搜索指数数据';

    } catch (error) {
      console.warn(`[HighlightsDataLoader] Failed to load lingxi_data: ${error}`);
      variables['aips_highlights'] = '灵犀数据加载失败';
      variables['search_highlights'] = '搜索指数数据加载失败';
    }

    // ── 9. 品牌核心数据摘要（供AI综合分析） ──
    variables['brand_data_summary'] = [
      `总费用：${totalCost.toFixed(0)}元`,
      `总曝光：${totalImpressions}，总阅读：${totalReads}，总互动：${totalEngagement}`,
      `CPM：${cpm.toFixed(2)}，CPC：${cpc.toFixed(2)}，CPE：${cpe.toFixed(2)}，CTR：${ctr.toFixed(2)}%`,
      `爆文：${viralCount}篇（${viralRate.toFixed(1)}%）`,
    ].join('\n');

    // ── 10. 构建溯源数据 ──
    const traceItems: TraceItem[] = [];

    if (kpiHighlights.length > 0) {
      traceItems.push({
        traceId: 'ch4_kpi_highlights',
        chapterNumber: 4,
        label: 'KPI超额完成亮点',
        sourceTable: 'notes + review_configs.kpi_targets',
        sourceQuery: `SELECT kpi_targets FROM review_configs WHERE project_id = '${projectId}' ORDER BY created_at DESC LIMIT 1;`,
        totalRows: kpiHighlights.length,
        columns: [
          { key: 'detail', label: '亮点详情', type: 'string' },
        ],
        dataRows: kpiHighlights.map((h) => ({ detail: h })),
        calculations: kpiChecks.filter((c) => {
          const target = kpi[c.key];
          if (!target || target <= 0) return false;
          const completion = c.isCost ? (target / c.actual) * 100 : (c.actual / target) * 100;
          return completion > 100;
        }).map((c) => {
          const target = kpi[c.key]!;
          const completion = c.isCost ? (target / c.actual) * 100 : (c.actual / target) * 100;
          return {
            metric: c.label,
            formula: c.isCost ? 'target / actual * 100' : 'actual / target * 100',
            inputs: { actual: Number(c.actual.toFixed(2)), target },
            result: Number(completion.toFixed(1)),
          };
        }),
      });
    }

    if (benchmarkHighlights.length > 0) {
      traceItems.push({
        traceId: 'ch4_benchmark_highlights',
        chapterNumber: 4,
        label: '大盘对比亮点',
        sourceTable: 'review_configs.benchmark',
        sourceQuery: `SELECT benchmark FROM review_configs WHERE project_id = '${projectId}' ORDER BY created_at DESC LIMIT 1;`,
        totalRows: benchmarkHighlights.length,
        columns: [
          { key: 'detail', label: '亮点详情', type: 'string' },
        ],
        dataRows: benchmarkHighlights.map((h) => ({ detail: h })),
      });
    }

    traceItems.push({
      traceId: 'ch4_viral_highlights',
      chapterNumber: 4,
      label: '爆文数据',
      sourceTable: 'notes',
      sourceQuery: `SELECT like_num, fav_num, cmt_num FROM notes WHERE project_id = '${projectId}';`,
      totalRows: 3,
      columns: [
        { key: 'metric', label: '指标', type: 'string' },
        { key: 'value', label: '数值', type: 'string' },
      ],
      dataRows: [
        { metric: '爆文数', value: String(viralCount) },
        { metric: '爆文率', value: viralRate.toFixed(1) + '%' },
        { metric: '总笔记数', value: String(noteCount) },
      ],
      calculations: [
        { metric: '爆文率', formula: 'viralCount / noteCount * 100', inputs: { viralCount, noteCount }, result: Number(viralRate.toFixed(1)) },
      ],
    });

    return this.buildContext(variables, traceItems);
  }
}
