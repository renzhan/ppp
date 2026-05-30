import { PrismaClient } from '../../../generated/prisma';
import { BaseChapterDataLoader, ChapterDataContext, TraceItem } from './types';

/**
 * Chapter 6 (内容分析) Data Loader
 *
 * 按多个维度分组聚合笔记数据，生成标准表格：
 * - 内容方向分析（按 note_base.content_direction 分组）
 * - 达人类型分析（按 note_base.kol_type 分组）
 * - 达人层级分析（按 notes.kol_fan_num + review_configs.influencerTiers 分类）
 * - 内容形式分析（按 notes.note_type 图文/视频 分组）
 * - 优质笔记TOP5（按爆文口径排序取前5）
 *
 * 表格标准列：维度 | 篇数 | 曝光量 | 阅读量 | 互动量 | TI人群 | CPTI | CPE | 爆文篇数 | 爆文率
 *
 * 数据来源：
 * - notes: imp_num, read_num, like_num, fav_num, cmt_num, share_num, engage_num, kol_fan_num, note_type, kol_nick_name
 * - note_base: content_direction, kol_type, content_cost
 * - juguang_data: fee, ti_user_num（按note_id关联）
 * - review_configs: influencerTiers, engagementMetric, viralMetric, contentCostCaliber, trafficCostCaliber
 */
export class ContentAnalysisDataLoader extends BaseChapterDataLoader {
  chapterNumber = 6;
  chapterName = '内容分析';
  requiredDataSources = ['notes', 'note_base', 'juguang_data', 'review_configs'];
  requiredFields = [
    'by_content_direction', 'by_kol_type', 'by_kol_tier', 'by_content_form',
    'top5_notes',
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
    let influencerTiers: Array<{ name: string; fanRangeMin: number; fanRangeMax: number }> = [
      { name: '头部', fanRangeMin: 500000, fanRangeMax: 99999999 },
      { name: '腰部', fanRangeMin: 100000, fanRangeMax: 499999 },
      { name: '尾部', fanRangeMin: 10000, fanRangeMax: 99999 },
      { name: 'KOC', fanRangeMin: 0, fanRangeMax: 9999 },
    ];

    try {
      const reviewConfig = await this.prisma.reviewConfig.findFirst({
        where: { projectId },
        select: { engagementMetric: true, viralMetric: true, influencerTiers: true },
        orderBy: { createdAt: 'desc' },
      });
      if (reviewConfig) {
        if (reviewConfig.engagementMetric) engagementMetric = reviewConfig.engagementMetric as string;
        if (reviewConfig.viralMetric) viralMetric = reviewConfig.viralMetric as string;
        if ((reviewConfig as any).contentCostCaliber) contentCostCaliber = (reviewConfig as any).contentCostCaliber;
        if ((reviewConfig as any).trafficCostCaliber) trafficCostCaliber = (reviewConfig as any).trafficCostCaliber;
        const tiers = reviewConfig.influencerTiers as any[];
        if (Array.isArray(tiers) && tiers.length > 0) {
          influencerTiers = tiers.map((t) => ({
            name: t.name || '未命名',
            fanRangeMin: t.fanRangeMin || 0,
            fanRangeMax: t.fanRangeMax || 99999999,
          }));
        }
      }
    } catch (error) {
      console.warn(`[ContentAnalysisDataLoader] Failed to load review_configs: ${error}`);
    }

    // ── 1. 加载蒲公英笔记 ──
    interface NoteRow {
      noteId: string;
      kolNickName: string | null;
      kolFanNum: number | null;
      noteType: string | null;
      noteTitle: string | null;
      impNum: number;
      readNum: number;
      engageNum: number;
      likeNum: number;
      favNum: number;
      cmtNum: number;
      shareNum: number;
      kolPrice: any;
      serviceFee: any;
    }

    let notes: NoteRow[] = [];
    try {
      notes = await this.prisma.note.findMany({
        where: { projectId },
        select: {
          noteId: true,
          kolNickName: true,
          kolFanNum: true,
          noteType: true,
          noteTitle: true,
          impNum: true,
          readNum: true,
          engageNum: true,
          likeNum: true,
          favNum: true,
          cmtNum: true,
          shareNum: true,
          kolPrice: true,
          serviceFee: true,
        },
      });
    } catch (error) {
      console.warn(`[ContentAnalysisDataLoader] Failed to load notes: ${error}`);
    }

    // ── 2. 加载笔记底表（content_direction, kol_type, content_cost） ──
    const noteBaseMap = new Map<string, { contentDirection: string; kolType: string; contentCost: number }>();
    try {
      const noteBaseResult = await this.prisma.$queryRaw<Array<{ note_id: string; content_direction: string | null; kol_type: string | null; content_cost: number }>>`
        SELECT note_id, content_direction, kol_type, content_cost::float
        FROM note_base WHERE project_id = ${projectId}::uuid
      `;
      for (const row of noteBaseResult) {
        noteBaseMap.set(row.note_id, {
          contentDirection: row.content_direction || '未分类',
          kolType: row.kol_type || '未分类',
          contentCost: row.content_cost ?? 0,
        });
      }
    } catch (error) {
      console.warn(`[ContentAnalysisDataLoader] Failed to load note_base: ${error}`);
    }

    // ── 3. 加载聚光数据（fee, ti_user_num 按note_id） ──
    const juguangMap = new Map<string, { fee: number; tiUserNum: number }>();
    try {
      const juguangData = await this.prisma.juguangData.findMany({
        where: { projectId, noteId: { not: null } },
        select: { noteId: true, fee: true, tiUserNum: true },
      });
      for (const j of juguangData) {
        if (!j.noteId) continue;
        const existing = juguangMap.get(j.noteId);
        if (existing) {
          existing.fee += Number(j.fee);
          existing.tiUserNum += j.tiUserNum;
        } else {
          juguangMap.set(j.noteId, { fee: Number(j.fee), tiUserNum: j.tiUserNum });
        }
      }
    } catch (error) {
      console.warn(`[ContentAnalysisDataLoader] Failed to load juguang_data: ${error}`);
    }

    // ── 4. 构建每篇笔记的完整数据 ──
    interface EnrichedNote {
      noteId: string;
      kolNickName: string;
      kolFanNum: number;
      noteType: string; // 图文/视频
      noteTitle: string;
      contentDirection: string;
      kolType: string;
      kolTier: string;
      impNum: number;
      readNum: number;
      engagement: number;
      likeNum: number;
      favNum: number;
      cmtNum: number;
      shareNum: number;
      tiUserNum: number;
      totalCost: number;
      cpe: number;
      cpti: number;
      isViral: boolean;
      viralScore: number; // 用于排序
    }

    const enrichedNotes: EnrichedNote[] = [];

    for (const note of notes) {
      const noteBase = noteBaseMap.get(note.noteId);
      const juguang = juguangMap.get(note.noteId);

      // 互动量（按口径）
      const engagement = engagementMetric === 'include_follow'
        ? note.engageNum
        : note.likeNum + note.favNum + note.cmtNum + note.shareNum;

      // 费用
      const contentCost = noteBase?.contentCost ?? (Number(note.kolPrice) + Number(note.serviceFee));
      const juguangFee = juguang?.fee ?? 0;
      const totalCost = contentCost + juguangFee;

      // TI人群
      const tiUserNum = juguang?.tiUserNum ?? 0;

      // CPE / CPTI
      const cpe = engagement > 0 ? totalCost / engagement : 0;
      const cpti = tiUserNum > 0 ? totalCost / tiUserNum : 0;

      // 爆文判断
      let isViral: boolean;
      let viralScore: number;
      if (viralMetric === 'like_only') {
        isViral = note.likeNum >= 1000;
        viralScore = note.likeNum;
      } else {
        const interactionSum = note.likeNum + note.favNum + note.cmtNum;
        isViral = interactionSum >= 1000;
        viralScore = interactionSum;
      }

      // 达人层级
      const fanNum = note.kolFanNum ?? 0;
      let kolTier = '未分类';
      for (const tier of influencerTiers) {
        if (fanNum >= tier.fanRangeMin && fanNum <= tier.fanRangeMax) {
          kolTier = tier.name;
          break;
        }
      }

      // 内容形式
      const noteTypeLabel = (note.noteType === '1' || note.noteType === 'image') ? '图文' : '视频';

      enrichedNotes.push({
        noteId: note.noteId,
        kolNickName: note.kolNickName ?? '',
        kolFanNum: fanNum,
        noteType: noteTypeLabel,
        noteTitle: note.noteTitle ?? '',
        contentDirection: noteBase?.contentDirection ?? '未分类',
        kolType: noteBase?.kolType ?? '未分类',
        kolTier,
        impNum: note.impNum,
        readNum: note.readNum,
        engagement,
        likeNum: note.likeNum,
        favNum: note.favNum,
        cmtNum: note.cmtNum,
        shareNum: note.shareNum,
        tiUserNum,
        totalCost,
        cpe,
        cpti,
        isViral,
        viralScore,
      });
    }

    // ── 5. 分组聚合函数 ──
    interface GroupAgg {
      count: number;
      impNum: number;
      readNum: number;
      engagement: number;
      tiUserNum: number;
      totalCost: number;
      viralCount: number;
    }

    function aggregate(grouped: Map<string, EnrichedNote[]>): string {
      const rows: string[] = [];
      for (const [name, items] of grouped) {
        const agg: GroupAgg = {
          count: items.length,
          impNum: items.reduce((s, n) => s + n.impNum, 0),
          readNum: items.reduce((s, n) => s + n.readNum, 0),
          engagement: items.reduce((s, n) => s + n.engagement, 0),
          tiUserNum: items.reduce((s, n) => s + n.tiUserNum, 0),
          totalCost: items.reduce((s, n) => s + n.totalCost, 0),
          viralCount: items.filter((n) => n.isViral).length,
        };
        const cpe = agg.engagement > 0 ? (agg.totalCost / agg.engagement).toFixed(2) : '-';
        const cpti = agg.tiUserNum > 0 ? (agg.totalCost / agg.tiUserNum).toFixed(2) : '-';
        const viralRate = agg.count > 0 ? ((agg.viralCount / agg.count) * 100).toFixed(1) + '%' : '0%';

        rows.push(`| ${name} | ${agg.count} | ${agg.impNum} | ${agg.readNum} | ${agg.engagement} | ${agg.tiUserNum} | ${cpti} | ${cpe} | ${agg.viralCount} | ${viralRate} |`);
      }
      return rows.join('\n');
    }

    // ── 6. 按内容方向分组 ──
    const byDirection = new Map<string, EnrichedNote[]>();
    for (const n of enrichedNotes) {
      if (!byDirection.has(n.contentDirection)) byDirection.set(n.contentDirection, []);
      byDirection.get(n.contentDirection)!.push(n);
    }
    variables['by_content_direction'] = aggregate(byDirection);

    // ── 7. 按达人类型分组 ──
    const byKolType = new Map<string, EnrichedNote[]>();
    for (const n of enrichedNotes) {
      if (!byKolType.has(n.kolType)) byKolType.set(n.kolType, []);
      byKolType.get(n.kolType)!.push(n);
    }
    variables['by_kol_type'] = aggregate(byKolType);

    // ── 8. 按达人层级分组 ──
    const byKolTier = new Map<string, EnrichedNote[]>();
    for (const n of enrichedNotes) {
      if (!byKolTier.has(n.kolTier)) byKolTier.set(n.kolTier, []);
      byKolTier.get(n.kolTier)!.push(n);
    }
    variables['by_kol_tier'] = aggregate(byKolTier);

    // ── 9. 按内容形式分组 ──
    const byForm = new Map<string, EnrichedNote[]>();
    for (const n of enrichedNotes) {
      if (!byForm.has(n.noteType)) byForm.set(n.noteType, []);
      byForm.get(n.noteType)!.push(n);
    }
    variables['by_content_form'] = aggregate(byForm);

    // ── 10. 优质笔记TOP5 ──
    const sortedNotes = [...enrichedNotes].sort((a, b) => b.viralScore - a.viralScore);
    const top5 = sortedNotes.slice(0, 5).map((n, i) =>
      `${i + 1}. ${n.kolNickName}（${n.noteType}/${n.contentDirection}）：曝光${n.impNum}, 互动${n.engagement}, CPE=${n.cpe.toFixed(2)}, 赞${n.likeNum}/藏${n.favNum}/评${n.cmtNum}`
    );
    variables['top5_notes'] = top5.join('\n');

    // 统计信息
    variables['total_notes'] = String(enrichedNotes.length);
    variables['total_viral'] = String(enrichedNotes.filter((n) => n.isViral).length);
    variables['viral_metric'] = viralMetric === 'like_only' ? '千赞（赞≥1000）' : '千互（赞+藏+评≥1000）';

    // ── 11. 构建溯源数据 ──
    const traceItems: TraceItem[] = [];

    // 内容方向分析表溯源
    const directionRows = Array.from(byDirection.entries()).map(([name, items]) => {
      const agg = { count: items.length, impNum: items.reduce((s, n) => s + n.impNum, 0), engagement: items.reduce((s, n) => s + n.engagement, 0), tiUserNum: items.reduce((s, n) => s + n.tiUserNum, 0), totalCost: items.reduce((s, n) => s + n.totalCost, 0), viralCount: items.filter((n) => n.isViral).length };
      return { direction: name, count: agg.count, impressions: agg.impNum, engagement: agg.engagement, ti: agg.tiUserNum, cpe: agg.engagement > 0 ? (agg.totalCost / agg.engagement).toFixed(2) : '-', viralCount: agg.viralCount, viralRate: agg.count > 0 ? ((agg.viralCount / agg.count) * 100).toFixed(1) + '%' : '0%' };
    });
    traceItems.push({
      traceId: 'ch6_by_direction',
      chapterNumber: 6,
      label: '内容方向分析',
      sourceTable: 'notes + note_base + juguang_data',
      sourceQuery: `SELECT note_id, content_direction FROM note_base WHERE project_id = '${projectId}';\nSELECT note_id, imp_num, like_num, fav_num, cmt_num FROM notes WHERE project_id = '${projectId}';`,
      totalRows: directionRows.length,
      columns: [
        { key: 'direction', label: '内容方向', type: 'string' },
        { key: 'count', label: '篇数', type: 'number' },
        { key: 'impressions', label: '曝光量', type: 'number' },
        { key: 'engagement', label: '互动量', type: 'number' },
        { key: 'ti', label: 'TI人群', type: 'number' },
        { key: 'cpe', label: 'CPE', type: 'string' },
        { key: 'viralCount', label: '爆文数', type: 'number' },
        { key: 'viralRate', label: '爆文率', type: 'string' },
      ],
      dataRows: directionRows,
    });

    // 达人层级分析表溯源
    const tierRows = Array.from(byKolTier.entries()).map(([name, items]) => {
      const agg = { count: items.length, impNum: items.reduce((s, n) => s + n.impNum, 0), engagement: items.reduce((s, n) => s + n.engagement, 0), totalCost: items.reduce((s, n) => s + n.totalCost, 0), viralCount: items.filter((n) => n.isViral).length };
      return { tier: name, count: agg.count, impressions: agg.impNum, engagement: agg.engagement, cpe: agg.engagement > 0 ? (agg.totalCost / agg.engagement).toFixed(2) : '-', viralCount: agg.viralCount, viralRate: agg.count > 0 ? ((agg.viralCount / agg.count) * 100).toFixed(1) + '%' : '0%' };
    });
    traceItems.push({
      traceId: 'ch6_by_kol_tier',
      chapterNumber: 6,
      label: '达人层级分析',
      sourceTable: 'notes + review_configs.influencer_tiers',
      sourceQuery: `SELECT note_id, kol_fan_num FROM notes WHERE project_id = '${projectId}';\nSELECT influencer_tiers FROM review_configs WHERE project_id = '${projectId}';`,
      totalRows: tierRows.length,
      columns: [
        { key: 'tier', label: '达人层级', type: 'string' },
        { key: 'count', label: '篇数', type: 'number' },
        { key: 'impressions', label: '曝光量', type: 'number' },
        { key: 'engagement', label: '互动量', type: 'number' },
        { key: 'cpe', label: 'CPE', type: 'string' },
        { key: 'viralCount', label: '爆文数', type: 'number' },
        { key: 'viralRate', label: '爆文率', type: 'string' },
      ],
      dataRows: tierRows,
    });

    return this.buildContext(variables, traceItems);
  }
}
