import { PrismaClient } from '../../../generated/prisma';
import { BaseChapterDataLoader, ChapterDataContext, TraceItem } from './types';
import { normalizeBenchmarkValue, BenchmarkRange } from '../../shared/types';

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
    let benchmark: Record<string, unknown> = {};

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
          benchmark = reviewConfig.benchmark as Record<string, unknown>;
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

    // 保留原始行数据用于溯源
    let rawNoteRows: Array<Record<string, unknown>> = [];

    try {
      const notes = await this.prisma.note.findMany({
        where: { projectId },
        select: {
          noteId: true,
          impNum: true, readNum: true, engageNum: true,
          likeNum: true, favNum: true, cmtNum: true, shareNum: true,
          kolPrice: true, serviceFee: true,
        },
      });

      rawNoteRows = notes.map(n => ({
        noteId: n.noteId,
        impNum: n.impNum,
        readNum: n.readNum,
        engageNum: n.engageNum,
        likeNum: n.likeNum,
        favNum: n.favNum,
        cmtNum: n.cmtNum,
        shareNum: n.shareNum,
        kolPrice: Number(n.kolPrice),
        serviceFee: Number(n.serviceFee),
      }));

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

    const bmCpm = normalizeBenchmarkValue(benchmark.cpm as number | BenchmarkRange | undefined);
    const bmCpc = normalizeBenchmarkValue(benchmark.cpc as number | BenchmarkRange | undefined);
    const bmCpe = normalizeBenchmarkValue(benchmark.cpe as number | BenchmarkRange | undefined);
    const bmCtr = normalizeBenchmarkValue(benchmark.ctr as number | BenchmarkRange | undefined);

    if (bmCpm && cpm > 0 && cpm < bmCpm.min) {
      benchmarkHighlights.push(`CPM：实际${cpm.toFixed(2)}，大盘${bmCpm.min}~${bmCpm.max}，优于大盘${((1 - cpm / bmCpm.min) * 100).toFixed(0)}%`);
    }
    if (bmCpc && cpc > 0 && cpc < bmCpc.min) {
      benchmarkHighlights.push(`CPC：实际${cpc.toFixed(2)}，大盘${bmCpc.min}~${bmCpc.max}，优于大盘${((1 - cpc / bmCpc.min) * 100).toFixed(0)}%`);
    }
    if (bmCpe && cpe > 0 && cpe < bmCpe.min) {
      benchmarkHighlights.push(`CPE：实际${cpe.toFixed(2)}，大盘${bmCpe.min}~${bmCpe.max}，优于大盘${((1 - cpe / bmCpe.min) * 100).toFixed(0)}%`);
    }
    if (bmCtr && ctr > 0 && ctr > bmCtr.max) {
      benchmarkHighlights.push(`CTR：实际${ctr.toFixed(2)}%，大盘${bmCtr.min}%~${bmCtr.max}%，优于大盘${((ctr / bmCtr.max - 1) * 100).toFixed(0)}%`);
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
    // 溯源展示数据库原始行数据 + 计算公式
    const traceItems: TraceItem[] = [];

    // KPI亮点溯源 — 展示 notes 原始行数据
    traceItems.push({
      traceId: 'ch4_kpi_highlights',
      chapterNumber: 4,
      label: 'KPI亮点(原始数据)',
      sourceTable: 'notes + review_configs.kpi_targets',
      sourceQuery: `SELECT id AS note_id, imp_num, read_num, engage_num, like_num, fav_num, cmt_num, share_num, kol_price, service_fee FROM notes WHERE project_id = '${projectId}';\nSELECT kpi_targets FROM review_configs WHERE project_id = '${projectId}' ORDER BY created_at DESC LIMIT 1;`,
      totalRows: rawNoteRows.length,
      columns: [
        { key: 'noteId', label: 'note_id', type: 'string' },
        { key: 'impNum', label: 'imp_num', type: 'number' },
        { key: 'readNum', label: 'read_num', type: 'number' },
        { key: 'engageNum', label: 'engage_num', type: 'number' },
        { key: 'likeNum', label: 'like_num', type: 'number' },
        { key: 'favNum', label: 'fav_num', type: 'number' },
        { key: 'cmtNum', label: 'cmt_num', type: 'number' },
        { key: 'shareNum', label: 'share_num', type: 'number' },
        { key: 'kolPrice', label: 'kol_price', type: 'number' },
        { key: 'serviceFee', label: 'service_fee', type: 'number' },
      ],
      dataRows: rawNoteRows,
      calculations: [
        ...kpiChecks.filter((c) => {
          const target = kpi[c.key];
          if (!target || target <= 0) return false;
          const completion = c.isCost ? (target / c.actual) * 100 : (c.actual / target) * 100;
          return completion > 100;
        }).map((c) => {
          const target = kpi[c.key]!;
          const completion = c.isCost ? (target / c.actual) * 100 : (c.actual / target) * 100;
          return {
            metric: `${c.label}完成率`,
            formula: c.isCost ? 'KPI目标 / 实际值 * 100' : '实际值 / KPI目标 * 100',
            inputs: { '实际值': Number(c.actual.toFixed(2)), 'KPI目标': target },
            result: Number(completion.toFixed(1)),
          };
        }),
      ],
    });

    // 大盘对比亮点溯源 — 展示 notes 原始行 + 大盘配置
    if (benchmarkHighlights.length > 0) {
      traceItems.push({
        traceId: 'ch4_benchmark_highlights',
        chapterNumber: 4,
        label: '大盘对比(原始数据)',
        sourceTable: 'notes + review_configs.benchmark',
        sourceQuery: `SELECT id AS note_id, imp_num, read_num, engage_num, like_num, fav_num, cmt_num, share_num, kol_price, service_fee FROM notes WHERE project_id = '${projectId}';\nSELECT benchmark FROM review_configs WHERE project_id = '${projectId}' ORDER BY created_at DESC LIMIT 1;`,
        totalRows: rawNoteRows.length,
        columns: [
          { key: 'noteId', label: 'note_id', type: 'string' },
          { key: 'impNum', label: 'imp_num', type: 'number' },
          { key: 'readNum', label: 'read_num', type: 'number' },
          { key: 'engageNum', label: 'engage_num', type: 'number' },
          { key: 'likeNum', label: 'like_num', type: 'number' },
          { key: 'favNum', label: 'fav_num', type: 'number' },
          { key: 'cmtNum', label: 'cmt_num', type: 'number' },
          { key: 'shareNum', label: 'share_num', type: 'number' },
          { key: 'kolPrice', label: 'kol_price', type: 'number' },
          { key: 'serviceFee', label: 'service_fee', type: 'number' },
        ],
        dataRows: rawNoteRows,
        calculations: [
          { metric: 'CPM', formula: '总费用 / SUM(imp_num) * 1000', inputs: { '总费用': totalCost, 'SUM(imp_num)': totalImpressions, '大盘CPM': bmCpm ? `${bmCpm.min}~${bmCpm.max}` : 0 }, result: Number(cpm.toFixed(2)) },
          { metric: 'CPC', formula: '总费用 / SUM(read_num)', inputs: { '总费用': totalCost, 'SUM(read_num)': totalReads, '大盘CPC': bmCpc ? `${bmCpc.min}~${bmCpc.max}` : 0 }, result: Number(cpc.toFixed(2)) },
          { metric: 'CPE', formula: '总费用 / SUM(互动)', inputs: { '总费用': totalCost, 'SUM(互动)': totalEngagement, '大盘CPE': bmCpe ? `${bmCpe.min}~${bmCpe.max}` : 0 }, result: Number(cpe.toFixed(2)) },
          { metric: 'CTR', formula: 'SUM(read_num) / SUM(imp_num) * 100', inputs: { 'SUM(read_num)': totalReads, 'SUM(imp_num)': totalImpressions, '大盘CTR': bmCtr ? `${bmCtr.min}~${bmCtr.max}` : 0 }, result: Number(ctr.toFixed(2)) },
        ],
      });
    }

    // 爆文数据溯源 — 展示 notes 原始行（like_num, fav_num, cmt_num 用于判定爆文）
    traceItems.push({
      traceId: 'ch4_viral_highlights',
      chapterNumber: 4,
      label: '爆文判定(原始数据)',
      sourceTable: 'notes + note_base',
      sourceQuery: `SELECT id AS note_id, like_num, fav_num, cmt_num, share_num FROM notes WHERE project_id = '${projectId}';\nSELECT COUNT(*) FROM note_base WHERE project_id = '${projectId}';`,
      totalRows: rawNoteRows.length,
      columns: [
        { key: 'noteId', label: 'note_id', type: 'string' },
        { key: 'likeNum', label: 'like_num', type: 'number' },
        { key: 'favNum', label: 'fav_num', type: 'number' },
        { key: 'cmtNum', label: 'cmt_num', type: 'number' },
        { key: 'shareNum', label: 'share_num', type: 'number' },
      ],
      dataRows: rawNoteRows.map(n => ({ noteId: n.noteId, likeNum: n.likeNum, favNum: n.favNum, cmtNum: n.cmtNum, shareNum: n.shareNum })),
      calculations: [
        { metric: '爆文判定标准', formula: viralMetric === 'like_only' ? 'like_num >= 1000' : 'like_num + fav_num + cmt_num >= 1000', inputs: { '口径': viralMetric }, result: viralMetric === 'like_only' ? '千赞' : '千互' },
        { metric: '爆文率', formula: 'COUNT(满足条件) / note_base.COUNT(*) * 100', inputs: { '爆文数': viralCount, '总篇数(note_base)': noteCount }, result: Number(viralRate.toFixed(1)) },
      ],
    });

    return this.buildContext(variables, traceItems);
  }
}
