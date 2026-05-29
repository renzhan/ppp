import { PrismaClient } from '../../../generated/prisma';
import { BaseChapterDataLoader, ChapterDataContext } from './types';

/**
 * Chapter 5 (综合分析 / 四象限分析) Data Loader
 *
 * 按笔记维度计算质量评分和投流评分，进行四象限分类。
 *
 * 数据来源：
 * - notes: 蒲公英数据（imp_num, read_num, engage_num, kol_nick_name, note_type）
 * - note_base: 笔记底表（content_cost, content_direction）
 * - juguang_data: 聚光数据（fee, impression, click, interaction）按note_id关联
 * - review_configs: 大盘均值（作为象限分界线）
 *
 * 计算逻辑：
 * - 笔记CPM = (note_base.content_cost + juguang.fee) / notes.imp_num * 1000
 * - 笔记CPC = (note_base.content_cost + juguang.fee) / notes.read_num
 * - 笔记CPE = (note_base.content_cost + juguang.fee) / 互动量
 * - 笔记CTR = notes.read_num / notes.imp_num
 * - 投流CPM = juguang.fee / juguang.impression * 1000
 * - 投流CPC = juguang.fee / juguang.click
 * - 投流CPE = juguang.fee / juguang.interaction
 * - 投流CTR = juguang.click / juguang.impression
 *
 * 象限分界线：大盘均值（benchmark）
 * 没有投流数据的笔记不参与象限分析
 */
export class QuadrantAnalysisDataLoader extends BaseChapterDataLoader {
  chapterNumber = 5;
  chapterName = '综合分析';
  requiredDataSources = ['notes', 'note_base', 'juguang_data', 'review_configs'];
  requiredFields = [
    'quadrant_notes_table', 'quadrant_summary',
    'high_quality_high_traffic', 'high_quality_low_traffic',
    'low_quality_high_traffic', 'low_quality_low_traffic',
    'total_analyzed_notes', 'excluded_notes',
  ];

  constructor(prisma: InstanceType<typeof PrismaClient>) {
    super(prisma);
  }

  async load(projectId: string): Promise<ChapterDataContext> {
    const variables: Record<string, string> = {};

    // ── 0. 加载大盘均值（象限分界线） ──
    let benchmarkCpm = 0;
    let benchmarkCpc = 0;
    let benchmarkCpe = 0;
    let benchmarkCtr = 0;
    let engagementMetric = 'exclude_follow';

    try {
      const reviewConfig = await this.prisma.reviewConfig.findFirst({
        where: { projectId },
        select: { benchmark: true, engagementMetric: true },
        orderBy: { createdAt: 'desc' },
      });

      if (reviewConfig) {
        if (reviewConfig.engagementMetric) engagementMetric = reviewConfig.engagementMetric as string;
        const bm = reviewConfig.benchmark as Record<string, number> | null;
        if (bm) {
          benchmarkCpm = bm.cpm || 0;
          benchmarkCpc = bm.cpc || 0;
          benchmarkCpe = bm.cpe || 0;
          benchmarkCtr = bm.ctr || 0;
        }
      }
    } catch (error) {
      console.warn(`[QuadrantAnalysisDataLoader] Failed to load review_configs: ${error}`);
    }

    variables['benchmark_cpm'] = benchmarkCpm.toFixed(2);
    variables['benchmark_cpc'] = benchmarkCpc.toFixed(2);
    variables['benchmark_cpe'] = benchmarkCpe.toFixed(2);
    variables['benchmark_ctr'] = benchmarkCtr.toFixed(2);

    // ── 1. 加载蒲公英笔记数据 ──
    let notes: Array<{
      noteId: string;
      kolNickName: string | null;
      noteType: string | null;
      impNum: number;
      readNum: number;
      engageNum: number;
      likeNum: number;
      favNum: number;
      cmtNum: number;
      shareNum: number;
    }> = [];

    try {
      notes = await this.prisma.note.findMany({
        where: { projectId },
        select: {
          noteId: true,
          kolNickName: true,
          noteType: true,
          impNum: true,
          readNum: true,
          engageNum: true,
          likeNum: true,
          favNum: true,
          cmtNum: true,
          shareNum: true,
        },
      });
    } catch (error) {
      console.warn(`[QuadrantAnalysisDataLoader] Failed to load notes: ${error}`);
    }

    // ── 2. 加载笔记底表（content_cost, content_direction） ──
    const noteBaseMap = new Map<string, { contentCost: number; contentDirection: string | null }>();

    try {
      const noteBaseResult = await this.prisma.$queryRaw<Array<{ note_id: string; content_cost: number; content_direction: string | null }>>`
        SELECT note_id, content_cost::float, content_direction
        FROM note_base WHERE project_id = ${projectId}::uuid
      `;
      for (const row of noteBaseResult) {
        noteBaseMap.set(row.note_id, {
          contentCost: row.content_cost ?? 0,
          contentDirection: row.content_direction,
        });
      }
    } catch (error) {
      console.warn(`[QuadrantAnalysisDataLoader] Failed to load note_base: ${error}`);
    }

    // ── 3. 加载聚光数据（按note_id关联） ──
    const juguangMap = new Map<string, { fee: number; impression: number; click: number; interaction: number }>();

    try {
      const juguangData = await this.prisma.juguangData.findMany({
        where: { projectId, noteId: { not: null } },
        select: { noteId: true, fee: true, impression: true, click: true, interaction: true },
      });

      for (const j of juguangData) {
        if (!j.noteId) continue;
        const existing = juguangMap.get(j.noteId);
        if (existing) {
          // 同一笔记可能有多条聚光记录，累加
          existing.fee += Number(j.fee);
          existing.impression += j.impression;
          existing.click += j.click;
          existing.interaction += j.interaction;
        } else {
          juguangMap.set(j.noteId, {
            fee: Number(j.fee),
            impression: j.impression,
            click: j.click,
            interaction: j.interaction,
          });
        }
      }
    } catch (error) {
      console.warn(`[QuadrantAnalysisDataLoader] Failed to load juguang_data: ${error}`);
    }

    // ── 4. 按笔记维度计算指标 + 象限分类 ──
    interface NoteMetricRow {
      noteId: string;
      kolNickName: string;
      noteType: string;
      contentDirection: string;
      contentCost: number;
      juguangFee: number;
      totalCost: number;
      impNum: number;
      readNum: number;
      engagement: number;
      noteCpm: number;
      noteCpc: number;
      noteCpe: number;
      noteCtr: number;
      trafficCpm: number;
      trafficCpc: number;
      trafficCpe: number;
      trafficCtr: number;
      quadrant: string;
    }

    const analyzedNotes: NoteMetricRow[] = [];
    let excludedCount = 0;

    for (const note of notes) {
      const juguang = juguangMap.get(note.noteId);

      // 没有投流数据的笔记不参与象限分析
      if (!juguang || juguang.fee <= 0) {
        excludedCount++;
        continue;
      }

      const noteBase = noteBaseMap.get(note.noteId);
      const contentCost = noteBase?.contentCost ?? 0;
      const contentDirection = noteBase?.contentDirection ?? '';
      const juguangFee = juguang.fee;
      const totalCost = contentCost + juguangFee;

      // 互动量（按口径）
      const engagement = engagementMetric === 'include_follow'
        ? note.engageNum
        : note.likeNum + note.favNum + note.cmtNum + note.shareNum;

      // 笔记维度指标
      const noteCpm = note.impNum > 0 ? (totalCost / note.impNum) * 1000 : 0;
      const noteCpc = note.readNum > 0 ? totalCost / note.readNum : 0;
      const noteCpe = engagement > 0 ? totalCost / engagement : 0;
      const noteCtr = note.impNum > 0 ? (note.readNum / note.impNum) * 100 : 0;

      // 投流维度指标
      const trafficCpm = juguang.impression > 0 ? (juguangFee / juguang.impression) * 1000 : 0;
      const trafficCpc = juguang.click > 0 ? juguangFee / juguang.click : 0;
      const trafficCpe = juguang.interaction > 0 ? juguangFee / juguang.interaction : 0;
      const trafficCtr = juguang.impression > 0 ? (juguang.click / juguang.impression) * 100 : 0;

      // 象限分类（用大盘均值作为分界线）
      // 笔记质量：CPM/CPC/CPE 越低越好 → 低于大盘=高质量；CTR 越高越好 → 高于大盘=高质量
      const noteQualityGood = (benchmarkCpm > 0 && noteCpm < benchmarkCpm)
        || (benchmarkCpe > 0 && noteCpe < benchmarkCpe)
        || (benchmarkCtr > 0 && noteCtr > benchmarkCtr);

      // 投流质量：CPM/CPC/CPE 越低越好 → 低于大盘=高质量
      const trafficQualityGood = (benchmarkCpm > 0 && trafficCpm < benchmarkCpm)
        || (benchmarkCpe > 0 && trafficCpe < benchmarkCpe);

      let quadrant: string;
      if (noteQualityGood && trafficQualityGood) {
        quadrant = '高质高投';
      } else if (noteQualityGood && !trafficQualityGood) {
        quadrant = '高质低投';
      } else if (!noteQualityGood && trafficQualityGood) {
        quadrant = '低质高投';
      } else {
        quadrant = '低质低投';
      }

      analyzedNotes.push({
        noteId: note.noteId,
        kolNickName: note.kolNickName ?? '',
        noteType: note.noteType === '1' || note.noteType === 'image' ? '图文' : '视频',
        contentDirection,
        contentCost,
        juguangFee,
        totalCost,
        impNum: note.impNum,
        readNum: note.readNum,
        engagement,
        noteCpm: Math.round(noteCpm * 100) / 100,
        noteCpc: Math.round(noteCpc * 100) / 100,
        noteCpe: Math.round(noteCpe * 100) / 100,
        noteCtr: Math.round(noteCtr * 100) / 100,
        trafficCpm: Math.round(trafficCpm * 100) / 100,
        trafficCpc: Math.round(trafficCpc * 100) / 100,
        trafficCpe: Math.round(trafficCpe * 100) / 100,
        trafficCtr: Math.round(trafficCtr * 100) / 100,
        quadrant,
      });
    }

    // ── 5. 汇总各象限 ──
    const quadrantGroups: Record<string, NoteMetricRow[]> = {
      '高质高投': [],
      '高质低投': [],
      '低质高投': [],
      '低质低投': [],
    };

    for (const n of analyzedNotes) {
      quadrantGroups[n.quadrant]?.push(n);
    }

    const quadrantSummary = Object.entries(quadrantGroups).map(([name, items]) => ({
      quadrant: name,
      count: items.length,
      totalCost: items.reduce((s, n) => s + n.totalCost, 0).toFixed(2),
      avgNoteCpm: items.length > 0 ? (items.reduce((s, n) => s + n.noteCpm, 0) / items.length).toFixed(2) : '0',
      avgNoteCpe: items.length > 0 ? (items.reduce((s, n) => s + n.noteCpe, 0) / items.length).toFixed(2) : '0',
      avgTrafficCpm: items.length > 0 ? (items.reduce((s, n) => s + n.trafficCpm, 0) / items.length).toFixed(2) : '0',
      avgTrafficCpe: items.length > 0 ? (items.reduce((s, n) => s + n.trafficCpe, 0) / items.length).toFixed(2) : '0',
    }));

    variables['total_analyzed_notes'] = String(analyzedNotes.length);
    variables['excluded_notes'] = String(excludedCount);
    variables['quadrant_summary'] = quadrantSummary
      .map((q) => `${q.quadrant}：${q.count}篇，总费用${q.totalCost}元，笔记均CPM=${q.avgNoteCpm}，笔记均CPE=${q.avgNoteCpe}，投流均CPM=${q.avgTrafficCpm}，投流均CPE=${q.avgTrafficCpe}`)
      .join('\n');

    // 各象限代表笔记（取每象限前3）
    for (const [quadrant, items] of Object.entries(quadrantGroups)) {
      const key = quadrant === '高质高投' ? 'high_quality_high_traffic'
        : quadrant === '高质低投' ? 'high_quality_low_traffic'
        : quadrant === '低质高投' ? 'low_quality_high_traffic'
        : 'low_quality_low_traffic';

      const top3 = items.slice(0, 3).map((n) =>
        `${n.kolNickName}（${n.noteType}/${n.contentDirection}）：笔记CPM=${n.noteCpm}, CPE=${n.noteCpe}, CTR=${n.noteCtr}%, 投流CPM=${n.trafficCpm}, CPE=${n.trafficCpe}`
      );
      variables[key] = top3.length > 0 ? top3.join('\n') : '无';
    }

    // 完整笔记表格数据（供提示词使用，限制前20条避免token过长）
    const tableRows = analyzedNotes.slice(0, 20).map((n) =>
      `| ${n.kolNickName} | ${n.noteType} | ${n.contentDirection} | ${n.contentCost.toFixed(0)} | ${n.juguangFee.toFixed(0)} | ${n.noteCpm} | ${n.noteCpc} | ${n.noteCpe} | ${n.noteCtr}% | ${n.trafficCpm} | ${n.trafficCpc} | ${n.trafficCpe} | ${n.trafficCtr}% | ${n.quadrant} |`
    );
    variables['quadrant_notes_table'] = tableRows.join('\n');

    return this.buildContext(variables);
  }
}
