import { PrismaClient } from '../../../generated/prisma';
import { BaseChapterDataLoader, ChapterDataContext, TraceItem } from './types';
import { normalizeBenchmarkValue, BenchmarkRange } from '../../shared/types';

/**
 * Chapter 3 (Data Overview / 数据总览) Data Loader
 *
 * ═══ 重构版 ═══
 *
 * 核心变更：根据业务底表(note_base)的「内容形式」字段区分报备/非报备笔记，
 * 分别使用不同数据源计算指标，然后合并。
 *
 * 报备笔记 = note_base.cooperation_form IN ('视频报备', '图文报备')
 *   - 数据指标（曝光、阅读、互动等）：从蒲公英API(notes表)获取
 *   - 费用：IF(内容金额口径='资源含税成本价', kol_price + total_platform_price, 资源含税售价)
 *     其中 kol_price, total_platform_price 来自蒲公英(notes表)
 *     资源含税售价 来自 note_base.content_settlement
 *
 * 非报备笔记 = note_base.cooperation_form IN ('视频软文', '图文软文')
 *   - 数据指标（曝光、阅读、互动等）：完全从业务底表(note_base.metrics)获取
 *   - 费用：IF(内容金额口径='资源含税成本价', 资源含税成本价, 资源含税售价)
 *     资源含税成本价 = note_base.content_cost
 *     资源含税售价 = note_base.content_settlement
 *
 * 合并逻辑：
 *   合并消费 = 报备消费 + 非报备消费
 *   合并曝光 = 报备曝光 + 非报备曝光
 *   合并阅读 = 报备阅读 + 非报备阅读
 *   合并互动 = 报备互动 + 非报备互动
 *   合并发布数 = 报备发布数 + 非报备发布数
 *   合并爆文数 = 报备爆文数 + 非报备爆文数
 *   整体CPM = 合并消费 / 合并曝光 × 1000
 *   整体CPC = 合并消费 / 合并阅读
 *   整体CPE = 合并消费 / 合并互动
 *   整体CTR = 合并阅读 / 合并曝光 × 100%
 *   整体爆文率 = 合并爆文数 / 合并发布数 × 100%
 *
 * 数据源：
 * - note_base: 业务底表（内容形式、内容方向、笔记类型、费用、非报备指标）
 * - notes: 蒲公英数据（报备笔记的数据指标）
 * - juguang_data: 聚光数据（投流消耗、展现、点击、互动、TI人群）
 * - review_configs: 复盘配置（KPI目标、大盘均值、互动口径、爆文口径、内容金额口径）
 * - lingxi_data: 灵犀数据（AIPS人群、TI人群）
 */
export class DataOverviewDataLoader extends BaseChapterDataLoader {
  chapterNumber = 3;
  chapterName = '数据总览';
  requiredDataSources = ['note_base', 'notes', 'juguang_data', 'review_configs', 'lingxi_data'];
  requiredFields = [
    'project_name', 'brand',
    'note_count', 'total_cost', 'content_cost',
    'registered_cost', 'unregistered_cost',
    'registered_note_count', 'unregistered_note_count',
    'total_impressions', 'total_reads', 'total_engagement',
    'total_likes', 'total_favs', 'total_comments', 'total_shares',
    'viral_count', 'viral_rate',
    'cpm', 'cpc', 'cpe', 'ctr',
    'kpi_impression', 'kpi_read', 'kpi_engagement', 'kpi_viral_rate',
    'kpi_cpm', 'kpi_cpc', 'kpi_cpe', 'kpi_ctr',
    'impression_completion', 'read_completion', 'engagement_completion',
    'viral_rate_completion', 'cpm_completion', 'cpc_completion', 'cpe_completion', 'ctr_completion',
  ];

  /** 报备内容形式 */
  private static REGISTERED_FORMS = ['视频报备', '图文报备'];
  /** 非报备内容形式 */
  private static UNREGISTERED_FORMS = ['视频软文', '图文软文'];

  constructor(prisma: InstanceType<typeof PrismaClient>) {
    super(prisma);
  }

  async load(projectId: string): Promise<ChapterDataContext> {
    const variables: Record<string, string> = {};

    // ── 0. 加载复盘配置（需要先读取口径设置） ──
    let engagementMetric = 'exclude_follow'; // 默认不含关注
    let viralMetric = 'like_comment_share';  // 默认千互（赞+藏+评）
    let viralThreshold = 1000;               // 默认爆文阈值
    let contentCostCaliber = '资源含税成本价';  // 内容金额口径，默认资源含税成本价
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
          viralThreshold: true,
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
        if (reviewConfig.viralThreshold != null && reviewConfig.viralThreshold > 0) {
          viralThreshold = reviewConfig.viralThreshold;
        }
        const modules = reviewConfig.modules as Record<string, unknown> | null;
        if (modules?.contentCostCaliber) {
          contentCostCaliber = modules.contentCostCaliber as string;
        }
        if (reviewConfig.kpiTargets && typeof reviewConfig.kpiTargets === 'object') {
          kpi = reviewConfig.kpiTargets as Record<string, number>;
        }
        if (reviewConfig.benchmark && typeof reviewConfig.benchmark === 'object') {
          benchmark = reviewConfig.benchmark as Record<string, unknown>;
        }
      }
    } catch (error) {
      console.warn(`[DataOverviewDataLoader] Failed to load review_configs: ${error}`);
    }

    variables['engagement_metric'] = engagementMetric === 'include_follow' ? '含关注' : '不含关注';
    variables['viral_metric'] = viralMetric === 'like_only' ? `千赞（赞≥${viralThreshold}）` : `千互（赞+藏+评≥${viralThreshold}）`;
    variables['viral_threshold'] = String(viralThreshold);
    variables['content_cost_caliber'] = contentCostCaliber;

    // ── 1. 项目基本信息 ──
    try {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { projectName: true, brand: true, startDate: true, endDate: true, executionStartDate: true },
      });
      if (project) {
        if (project.projectName) variables['project_name'] = project.projectName;
        if (project.brand) variables['brand'] = project.brand;
        if (project.executionStartDate) variables['start_date'] = project.executionStartDate.toISOString().split('T')[0];
        else if (project.startDate) variables['start_date'] = project.startDate.toISOString().split('T')[0];
        if (project.endDate) variables['end_date'] = project.endDate.toISOString().split('T')[0];
      }
    } catch (error) {
      console.warn(`[DataOverviewDataLoader] Failed to load project: ${error}`);
    }

    // ── 2. 加载业务底表 (note_base) ──
    interface NoteBaseRow {
      noteId: string;
      cooperationForm: string | null;
      contentDirection: string | null;
      kolType: string | null;
      contentCost: number;         // 资源含税成本价
      contentSettlement: number;   // 资源含税售价
      metrics: Record<string, number> | null;
    }

    let noteBaseRows: NoteBaseRow[] = [];
    try {
      const raw = await this.prisma.noteBase.findMany({
        where: { projectId },
        select: {
          noteId: true,
          cooperationForm: true,
          contentDirection: true,
          kolType: true,
          contentCost: true,
          contentSettlement: true,
          metrics: true,
        },
      });
      noteBaseRows = raw.map(r => ({
        noteId: r.noteId,
        cooperationForm: r.cooperationForm,
        contentDirection: r.contentDirection,
        kolType: r.kolType,
        contentCost: Number(r.contentCost),
        contentSettlement: Number(r.contentSettlement),
        metrics: r.metrics as Record<string, number> | null,
      }));
    } catch (error) {
      console.warn(`[DataOverviewDataLoader] Failed to load note_base: ${error}`);
    }

    // 分类：报备 vs 非报备
    const registeredNoteBase = noteBaseRows.filter(
      r => r.cooperationForm && DataOverviewDataLoader.REGISTERED_FORMS.includes(r.cooperationForm)
    );
    const unregisteredNoteBase = noteBaseRows.filter(
      r => r.cooperationForm && DataOverviewDataLoader.UNREGISTERED_FORMS.includes(r.cooperationForm)
    );

    const registeredNoteIds = new Set(registeredNoteBase.map(r => r.noteId));

    // ── 3. 加载蒲公英笔记数据 (notes) — 仅用于报备笔记的指标 ──
    interface PugongyingRow {
      noteId: string;
      impNum: number;
      readNum: number;
      engageNum: number;
      likeNum: number;
      favNum: number;
      cmtNum: number;
      shareNum: number;
      followNum: number;
      kolPrice: number;
      totalPlatformPrice: number;
    }

    let pugongyingNotes: PugongyingRow[] = [];
    try {
      const notes = await this.prisma.note.findMany({
        where: { projectId },
        select: {
          noteId: true,
          impNum: true,
          readNum: true,
          engageNum: true,
          likeNum: true,
          favNum: true,
          cmtNum: true,
          shareNum: true,
          followNum: true,
          kolPrice: true,
          totalPlatformPrice: true,
        },
      });
      pugongyingNotes = notes.map(n => ({
        noteId: n.noteId,
        impNum: n.impNum,
        readNum: n.readNum,
        engageNum: n.engageNum,
        likeNum: n.likeNum,
        favNum: n.favNum,
        cmtNum: n.cmtNum,
        shareNum: n.shareNum,
        followNum: n.followNum,
        kolPrice: Number(n.kolPrice),
        totalPlatformPrice: Number(n.totalPlatformPrice),
      }));
    } catch (error) {
      console.warn(`[DataOverviewDataLoader] Failed to load notes: ${error}`);
    }

    // 只保留报备笔记的蒲公英数据
    const registeredPugongying = pugongyingNotes.filter(n => registeredNoteIds.has(n.noteId));
    // 创建 noteId → PugongyingRow 映射
    const pugongyingMap = new Map(pugongyingNotes.map(n => [n.noteId, n]));

    // ── 4. 计算报备笔记的指标 ──
    let regImpressions = 0, regReads = 0, regEngagement = 0;
    let regLikes = 0, regFavs = 0, regComments = 0, regShares = 0, regFollows = 0;
    let regViralCount = 0;
    let regCost = 0;

    for (const note of registeredPugongying) {
      regImpressions += note.impNum;
      regReads += note.readNum;
      regLikes += note.likeNum;
      regFavs += note.favNum;
      regComments += note.cmtNum;
      regShares += note.shareNum;
      regFollows += note.followNum;

      // 互动量（按口径）
      if (engagementMetric === 'include_follow') {
        regEngagement += note.engageNum; // engage_num含关注
      } else {
        regEngagement += note.likeNum + note.favNum + note.cmtNum + note.shareNum;
      }

      // 爆文判断（报备用蒲公英 like_num/cmt_num/fav_num）
      if (viralMetric === 'like_only') {
        if (note.likeNum >= viralThreshold) regViralCount++;
      } else {
        if (note.likeNum + note.cmtNum + note.favNum >= viralThreshold) regViralCount++;
      }
    }

    // 报备费用计算：
    // IF(内容金额口径='资源含税成本价', SUM(kol_price + total_platform_price), SUM(资源含税售价))
    if (contentCostCaliber === '资源含税成本价') {
      for (const note of registeredPugongying) {
        regCost += note.kolPrice + note.totalPlatformPrice;
      }
    } else {
      // 资源含税售价 来自 note_base.content_settlement
      for (const nb of registeredNoteBase) {
        regCost += nb.contentSettlement;
      }
    }

    // ── 5. 计算非报备笔记的指标（完全来自业务底表 metrics） ──
    let unregImpressions = 0, unregReads = 0, unregEngagement = 0;
    let unregLikes = 0, unregFavs = 0, unregComments = 0, unregShares = 0, unregFollows = 0;
    let unregViralCount = 0;
    let unregCost = 0;

    for (const nb of unregisteredNoteBase) {
      const m = nb.metrics || {};
      const impNum = Number(m.impNum || 0);
      const readNum = Number(m.readNum || 0);
      const likeNum = Number(m.likeNum || 0);
      const favNum = Number(m.favNum || 0);
      const cmtNum = Number(m.cmtNum || 0);
      const shareNum = Number(m.shareNum || 0);
      const followNum = Number(m.followNum || 0);
      const engageNum = Number(m.engageNum || 0);

      unregImpressions += impNum;
      unregReads += readNum;
      unregLikes += likeNum;
      unregFavs += favNum;
      unregComments += cmtNum;
      unregShares += shareNum;
      unregFollows += followNum;

      // 非报备互动量
      if (engagementMetric === 'include_follow') {
        // 含关注：点赞+收藏+评论+分享+关注
        unregEngagement += likeNum + favNum + cmtNum + shareNum + followNum;
      } else {
        // 不含关注：点赞+收藏+评论+分享
        unregEngagement += likeNum + favNum + cmtNum + shareNum;
      }

      // 非报备爆文判断（用业务底表的 点赞量/收藏量/评论量）
      if (viralMetric === 'like_only') {
        if (likeNum >= viralThreshold) unregViralCount++;
      } else {
        if (likeNum + favNum + cmtNum >= viralThreshold) unregViralCount++;
      }
    }

    // 非报备费用计算：
    // IF(内容金额口径='资源含税成本价', SUM(资源含税成本价), SUM(资源含税售价))
    for (const nb of unregisteredNoteBase) {
      if (contentCostCaliber === '资源含税成本价') {
        unregCost += nb.contentCost;
      } else {
        unregCost += nb.contentSettlement;
      }
    }

    // ── 6. 合并指标 ──
    const totalNoteCount = registeredNoteBase.length + unregisteredNoteBase.length;
    const totalImpressions = regImpressions + unregImpressions;
    const totalReads = regReads + unregReads;
    const totalEngagement = regEngagement + unregEngagement;
    const totalLikes = regLikes + unregLikes;
    const totalFavs = regFavs + unregFavs;
    const totalComments = regComments + unregComments;
    const totalShares = regShares + unregShares;
    const totalFollows = regFollows + unregFollows;
    const totalViralCount = regViralCount + unregViralCount;
    const totalContentCost = regCost + unregCost;

    // ── 7. 聚光数据 (juguang_data) — 需要在计算CPM/CPC/CPE之前加载 ──
    let jgFee = 0, jgImpression = 0, jgClick = 0, jgInteraction = 0, jgTiUserNum = 0;
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
      jgTiUserNum = Number(juguangAgg._sum.tiUserNum || 0);
    } catch (error) {
      console.warn(`[DataOverviewDataLoader] Failed to load juguang_data: ${error}`);
    }

    // ── 8. 计算总消费（内容费用 + 投流费用）和效率指标 ──
    // 总消费 = 内容费用（报备+非报备） + 投流费用（聚光fee）
    const totalCost = totalContentCost + jgFee;

    // 整体效率指标（消费=内容+投流，合并分子÷合并分母）
    const viralRate = totalNoteCount > 0 ? (totalViralCount / totalNoteCount) * 100 : 0;
    const ctr = totalImpressions > 0 ? (totalReads / totalImpressions) * 100 : 0;
    const cpm = totalImpressions > 0 ? (totalCost / totalImpressions) * 1000 : 0;
    const cpc = totalReads > 0 ? totalCost / totalReads : 0;
    const cpe = totalEngagement > 0 ? totalCost / totalEngagement : 0;

    // 设置变量
    variables['note_count'] = String(totalNoteCount);
    variables['registered_note_count'] = String(registeredNoteBase.length);
    variables['unregistered_note_count'] = String(unregisteredNoteBase.length);
    variables['total_cost'] = totalCost.toFixed(2);
    variables['content_cost'] = totalContentCost.toFixed(2);
    variables['traffic_cost'] = jgFee.toFixed(2);
    variables['registered_cost'] = regCost.toFixed(2);
    variables['unregistered_cost'] = unregCost.toFixed(2);

    variables['total_impressions'] = String(totalImpressions);
    variables['total_reads'] = String(totalReads);
    variables['total_engagement'] = String(totalEngagement);
    variables['total_likes'] = String(totalLikes);
    variables['total_favs'] = String(totalFavs);
    variables['total_comments'] = String(totalComments);
    variables['total_shares'] = String(totalShares);
    variables['total_follows'] = String(totalFollows);

    // 报备拆分
    variables['reg_impressions'] = String(regImpressions);
    variables['reg_reads'] = String(regReads);
    variables['reg_engagement'] = String(regEngagement);
    variables['reg_viral_count'] = String(regViralCount);
    // 非报备拆分
    variables['unreg_impressions'] = String(unregImpressions);
    variables['unreg_reads'] = String(unregReads);
    variables['unreg_engagement'] = String(unregEngagement);
    variables['unreg_viral_count'] = String(unregViralCount);

    variables['viral_count'] = String(totalViralCount);
    variables['viral_rate'] = viralRate.toFixed(1);
    variables['ctr'] = ctr.toFixed(2);
    variables['cpm'] = cpm.toFixed(2);
    variables['cpc'] = cpc.toFixed(2);
    variables['cpe'] = cpe.toFixed(2);

    variables['juguang_fee'] = jgFee.toFixed(2);
    variables['juguang_impression'] = String(jgImpression);
    variables['juguang_click'] = String(jgClick);
    variables['juguang_interaction'] = String(jgInteraction);
    variables['juguang_ti_user_num'] = String(jgTiUserNum);

    // ── 9. 自然流指标（仅对报备笔记有意义） ──
    const naturalImp = Math.max(0, regImpressions - jgImpression);
    const naturalRead = Math.max(0, regReads - jgClick);
    const naturalEng = Math.max(0, regEngagement - jgInteraction);

    variables['natural_impressions'] = String(naturalImp);
    variables['natural_reads'] = String(naturalRead);
    variables['natural_engagement'] = String(naturalEng);
    variables['natural_cpm'] = naturalImp > 0 ? ((totalCost / naturalImp) * 1000).toFixed(2) : '0';
    variables['natural_cpc'] = naturalRead > 0 ? (totalCost / naturalRead).toFixed(2) : '0';
    variables['natural_cpe'] = naturalEng > 0 ? (totalCost / naturalEng).toFixed(2) : '0';
    variables['natural_ctr'] = naturalImp > 0 ? ((naturalRead / naturalImp) * 100).toFixed(2) : '0';

    // ── 9. KPI目标与完成率 ──
    const kpiMapping: Record<string, { varKey: string; actual: number; isCost: boolean }> = {
      totalImpression: { varKey: 'impression', actual: totalImpressions, isCost: false },
      totalRead: { varKey: 'read', actual: totalReads, isCost: false },
      totalEngagement: { varKey: 'engagement', actual: totalEngagement, isCost: false },
      viralPosts1k: { varKey: 'viral_count', actual: totalViralCount, isCost: false },
      cpm: { varKey: 'cpm', actual: cpm, isCost: true },
      cpc: { varKey: 'cpc', actual: cpc, isCost: true },
      cpe: { varKey: 'cpe', actual: cpe, isCost: true },
      ctr: { varKey: 'ctr', actual: ctr, isCost: false },
    };

    for (const [kpiKey, config] of Object.entries(kpiMapping)) {
      const kpiValue = kpi[kpiKey];
      if (kpiValue != null && kpiValue > 0) {
        variables[`kpi_${config.varKey}`] = String(kpiValue);
        let completion: number;
        if (config.isCost) {
          completion = config.actual > 0 ? (kpiValue / config.actual) * 100 : 0;
        } else {
          completion = (config.actual / kpiValue) * 100;
        }
        variables[`${config.varKey}_completion`] = completion.toFixed(1);
      }
    }

    // 爆文率完成率
    const kpiViralRate = kpi.viralRate;
    if (kpiViralRate != null && kpiViralRate > 0) {
      variables['kpi_viral_rate'] = String(kpiViralRate);
      variables['viral_rate_completion'] = ((viralRate / kpiViralRate) * 100).toFixed(1);
    }

    // ── 10. 大盘均值 ──
    // benchmark values may be stored as { min, max } range objects or plain numbers
    const formatBenchmarkValue = (val: unknown): string => {
      if (val == null) return '';
      if (typeof val === 'number') return String(val);
      if (typeof val === 'object' && val !== null && 'min' in val && 'max' in val) {
        const range = val as { min: number; max: number };
        return range.min === range.max ? String(range.min) : `${range.min}~${range.max}`;
      }
      return String(val);
    };

    if (benchmark.ctr) variables['benchmark_ctr'] = formatBenchmarkValue(benchmark.ctr);
    if (benchmark.cpm) variables['benchmark_cpm'] = formatBenchmarkValue(benchmark.cpm);
    if (benchmark.cpc) variables['benchmark_cpc'] = formatBenchmarkValue(benchmark.cpc);
    if (benchmark.cpe) variables['benchmark_cpe'] = formatBenchmarkValue(benchmark.cpe);
    if (benchmark.engagementRate) variables['benchmark_engagement_rate'] = formatBenchmarkValue(benchmark.engagementRate);

    // ── 11. 灵犀数据 (lingxi_data) → AIPS/TI人群 ──
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

    // ── 12. 构建溯源数据 (traceItems) ──
    const traceItems: TraceItem[] = [];

    // 报备+非报备合并数据溯源
    traceItems.push({
      traceId: 'ch3_overview_stats',
      chapterNumber: 3,
      label: '数据总览（报备+非报备合并）',
      sourceTable: 'note_base + notes(蒲公英)',
      sourceQuery: `-- 报备笔记指标来自 notes 表（蒲公英API）\nSELECT note_id, imp_num, read_num, like_num, fav_num, cmt_num, share_num, kol_price, total_platform_price FROM notes WHERE project_id = '${projectId}' AND note_id IN (报备noteId列表);\n-- 非报备笔记指标来自 note_base.metrics JSON\nSELECT note_id, cooperation_form, content_cost, content_settlement, metrics FROM note_base WHERE project_id = '${projectId}' AND cooperation_form IN ('视频软文','图文软文');`,
      totalRows: totalNoteCount,
      columns: [
        { key: 'category', label: '分类', type: 'string' },
        { key: 'noteCount', label: '篇数', type: 'number' },
        { key: 'cost', label: '消费', type: 'number' },
        { key: 'impressions', label: '曝光', type: 'number' },
        { key: 'reads', label: '阅读', type: 'number' },
        { key: 'engagement', label: '互动', type: 'number' },
        { key: 'viralCount', label: '爆文数', type: 'number' },
      ],
      dataRows: [
        { category: '报备', noteCount: registeredNoteBase.length, cost: Number(regCost.toFixed(2)), impressions: regImpressions, reads: regReads, engagement: regEngagement, viralCount: regViralCount },
        { category: '非报备', noteCount: unregisteredNoteBase.length, cost: Number(unregCost.toFixed(2)), impressions: unregImpressions, reads: unregReads, engagement: unregEngagement, viralCount: unregViralCount },
        { category: '合并', noteCount: totalNoteCount, cost: Number(totalCost.toFixed(2)), impressions: totalImpressions, reads: totalReads, engagement: totalEngagement, viralCount: totalViralCount },
      ],
      calculations: [
        { metric: '内容金额口径', formula: `当前口径: ${contentCostCaliber}`, inputs: { '报备费用公式': contentCostCaliber === '资源含税成本价' ? 'SUM(kol_price+total_platform_price)' : 'SUM(note_base.content_settlement)', '非报备费用公式': contentCostCaliber === '资源含税成本价' ? 'SUM(note_base.content_cost)' : 'SUM(note_base.content_settlement)' }, result: `内容费用${totalContentCost.toFixed(2)}元` },
        { metric: '总消费(含投流)', formula: '内容费用 + 投流费用(聚光fee)', inputs: { '内容费用': totalContentCost, '投流费用': jgFee }, result: `${totalCost.toFixed(2)}元` },
        { metric: '互动口径', formula: engagementMetric === 'include_follow' ? '含关注(赞+藏+评+分享+关注)' : '不含关注(赞+藏+评+分享)', inputs: { '报备互动': regEngagement, '非报备互动': unregEngagement }, result: totalEngagement },
        { metric: '爆文口径', formula: viralMetric === 'like_only' ? `赞≥${viralThreshold}` : `赞+藏+评≥${viralThreshold}`, inputs: { '报备爆文': regViralCount, '非报备爆文': unregViralCount }, result: totalViralCount },
        { metric: '整体CPM', formula: '总消费(内容+投流) / 合并曝光 × 1000', inputs: { '总消费': totalCost, '合并曝光': totalImpressions }, result: Number(cpm.toFixed(2)) },
        { metric: '整体CPC', formula: '总消费(内容+投流) / 合并阅读', inputs: { '总消费': totalCost, '合并阅读': totalReads }, result: Number(cpc.toFixed(2)) },
        { metric: '整体CPE', formula: '总消费(内容+投流) / 合并互动', inputs: { '总消费': totalCost, '合并互动': totalEngagement }, result: Number(cpe.toFixed(2)) },
        { metric: '整体CTR', formula: '合并阅读 / 合并曝光 × 100%', inputs: { '合并阅读': totalReads, '合并曝光': totalImpressions }, result: Number(ctr.toFixed(2)) },
        { metric: '整体爆文率', formula: '合并爆文数 / 合并发布数 × 100%', inputs: { '合并爆文数': totalViralCount, '合并发布数': totalNoteCount }, result: Number(viralRate.toFixed(1)) },
      ],
    });

    // KPI达成表溯源
    if (Object.keys(kpi).length > 0) {
      traceItems.push({
        traceId: 'ch3_kpi_table',
        chapterNumber: 3,
        label: 'KPI达成数据',
        sourceTable: 'review_configs.kpi_targets',
        sourceQuery: `SELECT kpi_targets FROM review_configs WHERE project_id = '${projectId}' ORDER BY created_at DESC LIMIT 1;`,
        totalRows: 1,
        columns: [
          { key: 'metric', label: '指标', type: 'string' },
          { key: 'target', label: 'KPI目标', type: 'number' },
          { key: 'actual', label: '实际达成', type: 'number' },
          { key: 'completion', label: '完成率%', type: 'number' },
        ],
        dataRows: Object.entries(kpiMapping).filter(([k]) => kpi[k] != null).map(([kpiKey, config]) => ({
          metric: config.varKey,
          target: kpi[kpiKey],
          actual: Number(config.actual.toFixed(2)),
          completion: Number(variables[`${config.varKey}_completion`] || '0'),
        })),
        calculations: [
          { metric: '量级类完成率', formula: '实际值 / KPI目标 × 100', inputs: {}, result: '见表格' },
          { metric: '成本类完成率', formula: 'KPI目标 / 实际值 × 100（越低越好）', inputs: {}, result: '见表格' },
        ],
      });
    }

    // 大盘对比溯源
    if (Object.keys(benchmark).length > 0) {
      const bmCtrR = normalizeBenchmarkValue(benchmark.ctr as number | BenchmarkRange | undefined);
      const bmCpmR = normalizeBenchmarkValue(benchmark.cpm as number | BenchmarkRange | undefined);
      const bmCpcR = normalizeBenchmarkValue(benchmark.cpc as number | BenchmarkRange | undefined);
      const bmCpeR = normalizeBenchmarkValue(benchmark.cpe as number | BenchmarkRange | undefined);

      const benchmarkRawRows: Record<string, unknown>[] = [];
      if (bmCtrR) benchmarkRawRows.push({ metric: 'CTR', benchmarkValue: `${bmCtrR.min}~${bmCtrR.max}`, actual: ctr.toFixed(2), unit: '%' });
      if (bmCpmR) benchmarkRawRows.push({ metric: 'CPM', benchmarkValue: `${bmCpmR.min}~${bmCpmR.max}`, actual: cpm.toFixed(2), unit: '元' });
      if (bmCpcR) benchmarkRawRows.push({ metric: 'CPC', benchmarkValue: `${bmCpcR.min}~${bmCpcR.max}`, actual: cpc.toFixed(2), unit: '元' });
      if (bmCpeR) benchmarkRawRows.push({ metric: 'CPE', benchmarkValue: `${bmCpeR.min}~${bmCpeR.max}`, actual: cpe.toFixed(2), unit: '元' });

      traceItems.push({
        traceId: 'ch3_benchmark',
        chapterNumber: 3,
        label: '大盘对比',
        sourceTable: 'review_configs.benchmark',
        sourceQuery: `SELECT benchmark FROM review_configs WHERE project_id = '${projectId}' ORDER BY created_at DESC LIMIT 1;`,
        totalRows: benchmarkRawRows.length,
        columns: [
          { key: 'metric', label: '指标', type: 'string' },
          { key: 'benchmarkValue', label: '大盘均值', type: 'string' },
          { key: 'actual', label: '实际值', type: 'number' },
          { key: 'unit', label: '单位', type: 'string' },
        ],
        dataRows: benchmarkRawRows,
      });
    }

    return this.buildContext(variables, traceItems);
  }
}
