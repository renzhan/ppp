import { PrismaClient } from '../../../generated/prisma';
import { BaseChapterDataLoader, ChapterDataContext } from './types';

/**
 * Chapter 3 (Data Overview / 数据总览) Data Loader
 *
 * 按字段映射表收集数据，涉及以下表：
 * - note_base: 笔记底表（总篇数、内容费用）
 * - notes: 蒲公英数据（曝光、阅读、互动、爆文）
 * - juguang_data: 聚光数据（投流消耗、展现、点击、互动）
 * - review_configs: 复盘配置（KPI目标、大盘均值、互动率口径）
 * - lingxi_data: 灵犀数据（AIPS人群、TI人群）
 */
export class DataOverviewDataLoader extends BaseChapterDataLoader {
  chapterNumber = 3;
  chapterName = '数据总览';
  requiredDataSources = ['note_base', 'notes', 'juguang_data', 'review_configs', 'lingxi_data'];
  requiredFields = [
    'project_name', 'brand',
    'note_count', 'total_content_cost', 'total_ad_spend', 'total_cost',
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
    'aips_brand', 'ti_brand', 'aips_spu', 'ti_spu',
    'engagement_metric', 'benchmark_ctr', 'benchmark_cpm', 'benchmark_cpc', 'benchmark_cpe',
  ];

  constructor(prisma: InstanceType<typeof PrismaClient>) {
    super(prisma);
  }

  async load(projectId: string): Promise<ChapterDataContext> {
    const variables: Record<string, string> = {};

    // ── 1. 项目基本信息 (projects) ──
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

    // ── 2. 笔记底表 (note_base) → 总篇数、内容费用 ──
    try {
      const noteBaseAgg = await this.prisma.noteBase.aggregate({
        where: { projectId },
        _count: { noteId: true },
        _sum: {
          contentCost: true,
          contentSettlement: true,
          adSpend: true,
          totalCost: true,
        },
      });

      const noteCount = noteBaseAgg._count.noteId || 0;
      const totalContentCost = Number(noteBaseAgg._sum.contentCost || 0);
      const totalContentSettlement = Number(noteBaseAgg._sum.contentSettlement || 0);
      const totalAdSpend = Number(noteBaseAgg._sum.adSpend || 0);
      const totalCostFromBase = Number(noteBaseAgg._sum.totalCost || 0);

      variables['note_count'] = String(noteCount);
      variables['total_content_cost'] = totalContentCost.toFixed(2);
      variables['total_content_settlement'] = totalContentSettlement.toFixed(2);
      variables['total_ad_spend'] = totalAdSpend.toFixed(2);
      variables['total_cost_from_base'] = totalCostFromBase.toFixed(2);
    } catch (error) {
      console.warn(`[DataOverviewDataLoader] Failed to load note_base: ${error}`);
    }

    // ── 3. 蒲公英数据 (notes) → 曝光、阅读、互动、爆文 ──
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
          originImpNum: true,
          originReadNum: true,
        },
      });

      if (notes.length > 0) {
        const totalImpressions = notes.reduce((s, n) => s + n.impNum, 0);
        const totalReads = notes.reduce((s, n) => s + n.readNum, 0);
        const totalEngagement = notes.reduce((s, n) => s + n.engageNum, 0);
        const totalLikes = notes.reduce((s, n) => s + n.likeNum, 0);
        const totalFavs = notes.reduce((s, n) => s + n.favNum, 0);
        const totalComments = notes.reduce((s, n) => s + n.cmtNum, 0);
        const totalShares = notes.reduce((s, n) => s + n.shareNum, 0);
        const totalFollows = notes.reduce((s, n) => s + n.followNum, 0);
        const originImpTotal = notes.reduce((s, n) => s + n.originImpNum, 0);
        const originReadTotal = notes.reduce((s, n) => s + n.originReadNum, 0);

        variables['total_impressions'] = String(totalImpressions);
        variables['total_reads'] = String(totalReads);
        variables['total_engagement'] = String(totalEngagement);
        variables['total_likes'] = String(totalLikes);
        variables['total_favs'] = String(totalFavs);
        variables['total_comments'] = String(totalComments);
        variables['total_shares'] = String(totalShares);
        variables['total_follows'] = String(totalFollows);
        variables['origin_imp_total'] = String(originImpTotal);
        variables['origin_read_total'] = String(originReadTotal);

        // 爆文统计（阈值：互动量>=1000）
        const viralThreshold = 1000;
        const viralCount = notes.filter((n) => n.engageNum >= viralThreshold).length;
        const viralRate = notes.length > 0 ? (viralCount / notes.length) * 100 : 0;
        variables['viral_count'] = String(viralCount);
        variables['viral_rate'] = viralRate.toFixed(1);

        // CTR
        variables['ctr'] = totalImpressions > 0
          ? ((totalReads / totalImpressions) * 100).toFixed(2)
          : '0';
      }
    } catch (error) {
      console.warn(`[DataOverviewDataLoader] Failed to load notes: ${error}`);
    }

    // ── 4. 聚光数据 (juguang_data) → 投流消耗、展现、点击、互动 ──
    try {
      const juguangAgg = await this.prisma.juguangData.aggregate({
        where: { projectId },
        _sum: {
          fee: true,
          impression: true,
          click: true,
          interaction: true,
          iUserNum: true,
          tiUserNum: true,
        },
      });

      const jgFee = Number(juguangAgg._sum.fee || 0);
      const jgImpression = Number(juguangAgg._sum.impression || 0);
      const jgClick = Number(juguangAgg._sum.click || 0);
      const jgInteraction = Number(juguangAgg._sum.interaction || 0);
      const jgIUserNum = Number(juguangAgg._sum.iUserNum || 0);
      const jgTiUserNum = Number(juguangAgg._sum.tiUserNum || 0);

      variables['juguang_fee'] = jgFee.toFixed(2);
      variables['juguang_impression'] = String(jgImpression);
      variables['juguang_click'] = String(jgClick);
      variables['juguang_interaction'] = String(jgInteraction);
      variables['juguang_i_user_num'] = String(jgIUserNum);
      variables['juguang_ti_user_num'] = String(jgTiUserNum);

      // 聚光衍生指标
      variables['juguang_cpm'] = jgImpression > 0 ? ((jgFee / jgImpression) * 1000).toFixed(2) : '0';
      variables['juguang_cpc'] = jgClick > 0 ? (jgFee / jgClick).toFixed(2) : '0';
      variables['juguang_cpe'] = jgInteraction > 0 ? (jgFee / jgInteraction).toFixed(2) : '0';
      variables['juguang_ctr'] = jgImpression > 0 ? ((jgClick / jgImpression) * 100).toFixed(2) : '0';
    } catch (error) {
      console.warn(`[DataOverviewDataLoader] Failed to load juguang_data: ${error}`);
    }

    // ── 5. 计算总费用和综合指标 ──
    {
      const contentCost = Number(variables['total_content_cost'] || '0');
      const adSpend = Number(variables['juguang_fee'] || '0');
      const totalCost = contentCost + adSpend;
      const totalImpressions = Number(variables['total_impressions'] || '0');
      const totalReads = Number(variables['total_reads'] || '0');
      const totalEngagement = Number(variables['total_engagement'] || '0');

      variables['total_cost'] = totalCost.toFixed(2);

      // 综合CPM/CPC/CPE（总费用 / 蒲公英指标）
      variables['cpm'] = totalImpressions > 0 ? ((totalCost / totalImpressions) * 1000).toFixed(2) : '0';
      variables['cpc'] = totalReads > 0 ? (totalCost / totalReads).toFixed(2) : '0';
      variables['cpe'] = totalEngagement > 0 ? (totalCost / totalEngagement).toFixed(2) : '0';

      // 自然流指标 = 总指标 - 聚光指标
      const jgImpression = Number(variables['juguang_impression'] || '0');
      const jgClick = Number(variables['juguang_click'] || '0');
      const jgInteraction = Number(variables['juguang_interaction'] || '0');
      const naturalImp = totalImpressions - jgImpression;
      const naturalRead = totalReads - jgClick; // 聚光click≈阅读
      const naturalEng = totalEngagement - jgInteraction;

      variables['natural_impressions'] = String(Math.max(0, naturalImp));
      variables['natural_reads'] = String(Math.max(0, naturalRead));
      variables['natural_engagement'] = String(Math.max(0, naturalEng));

      // 自然流CPX（内容费用 / 自然流指标）
      variables['natural_cpm'] = naturalImp > 0 ? ((contentCost / naturalImp) * 1000).toFixed(2) : '0';
      variables['natural_cpc'] = naturalRead > 0 ? (contentCost / naturalRead).toFixed(2) : '0';
      variables['natural_cpe'] = naturalEng > 0 ? (contentCost / naturalEng).toFixed(2) : '0';
      variables['natural_ctr'] = naturalImp > 0 ? ((naturalRead / naturalImp) * 100).toFixed(2) : '0';
    }

    // ── 6. 复盘配置 (review_configs) → KPI目标、大盘均值、互动率口径 ──
    try {
      const reviewConfig = await this.prisma.reviewConfig.findFirst({
        where: { projectId },
        select: {
          kpiTargets: true,
          benchmark: true,
          engagementMetric: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (reviewConfig) {
        // 互动率口径
        if (reviewConfig.engagementMetric) {
          variables['engagement_metric'] = reviewConfig.engagementMetric as string;
        }

        // KPI目标
        const kpi = reviewConfig.kpiTargets as Record<string, number> | null;
        if (kpi) {
          if (kpi['KPI-总曝光']) variables['kpi_impression'] = String(kpi['KPI-总曝光']);
          if (kpi['KPI-总阅读']) variables['kpi_read'] = String(kpi['KPI-总阅读']);
          if (kpi['KPI-总互动']) variables['kpi_engagement'] = String(kpi['KPI-总互动']);
          if (kpi['KPI-爆文率']) variables['kpi_viral_rate'] = String(kpi['KPI-爆文率']);
          if (kpi['KPI-CPM']) variables['kpi_cpm'] = String(kpi['KPI-CPM']);
          if (kpi['KPI-CPC']) variables['kpi_cpc'] = String(kpi['KPI-CPC']);
          if (kpi['KPI-CPE']) variables['kpi_cpe'] = String(kpi['KPI-CPE']);
          if (kpi['KPI-CTR']) variables['kpi_ctr'] = String(kpi['KPI-CTR']);

          // 计算完成率
          const totalImp = Number(variables['total_impressions'] || '0');
          const totalRead = Number(variables['total_reads'] || '0');
          const totalEng = Number(variables['total_engagement'] || '0');
          const viralRate = Number(variables['viral_rate'] || '0');
          const cpm = Number(variables['cpm'] || '0');
          const cpc = Number(variables['cpc'] || '0');
          const cpe = Number(variables['cpe'] || '0');
          const ctr = Number(variables['ctr'] || '0');

          if (kpi['KPI-总曝光'] && kpi['KPI-总曝光'] > 0) {
            variables['impression_completion'] = ((totalImp / kpi['KPI-总曝光']) * 100).toFixed(1);
          }
          if (kpi['KPI-总阅读'] && kpi['KPI-总阅读'] > 0) {
            variables['read_completion'] = ((totalRead / kpi['KPI-总阅读']) * 100).toFixed(1);
          }
          if (kpi['KPI-总互动'] && kpi['KPI-总互动'] > 0) {
            variables['engagement_completion'] = ((totalEng / kpi['KPI-总互动']) * 100).toFixed(1);
          }
          if (kpi['KPI-爆文率'] && kpi['KPI-爆文率'] > 0) {
            variables['viral_rate_completion'] = ((viralRate / kpi['KPI-爆文率']) * 100).toFixed(1);
          }
          // 成本类指标：KPI/实际*100（越低越好）
          if (kpi['KPI-CPM'] && cpm > 0) {
            variables['cpm_completion'] = ((kpi['KPI-CPM'] / cpm) * 100).toFixed(1);
          }
          if (kpi['KPI-CPC'] && cpc > 0) {
            variables['cpc_completion'] = ((kpi['KPI-CPC'] / cpc) * 100).toFixed(1);
          }
          if (kpi['KPI-CPE'] && cpe > 0) {
            variables['cpe_completion'] = ((kpi['KPI-CPE'] / cpe) * 100).toFixed(1);
          }
          if (kpi['KPI-CTR'] && kpi['KPI-CTR'] > 0) {
            variables['ctr_completion'] = ((ctr / kpi['KPI-CTR']) * 100).toFixed(1);
          }
        }

        // 大盘均值
        const benchmark = reviewConfig.benchmark as Record<string, number> | null;
        if (benchmark) {
          if (benchmark['ctr']) variables['benchmark_ctr'] = String(benchmark['ctr']);
          if (benchmark['cpm']) variables['benchmark_cpm'] = String(benchmark['cpm']);
          if (benchmark['cpc']) variables['benchmark_cpc'] = String(benchmark['cpc']);
          if (benchmark['cpe']) variables['benchmark_cpe'] = String(benchmark['cpe']);
        }
      }
    } catch (error) {
      console.warn(`[DataOverviewDataLoader] Failed to load review_configs: ${error}`);
    }

    // ── 7. 灵犀数据 (lingxi_data) → AIPS/TI人群 ──
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
