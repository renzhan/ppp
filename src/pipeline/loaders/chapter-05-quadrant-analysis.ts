import { PrismaClient } from '../../../generated/prisma';
import { BaseChapterDataLoader, ChapterDataContext, TraceItem } from './types';

/**
 * Chapter 5 (综合分析 / 四象限分析) Data Loader
 *
 * 按笔记维度使用 engageRate（互动率，Y轴）和 投流CPE（X轴）进行四象限分类。
 *
 * 数据来源：
 * - notes: 统一笔记表（engageRate, kol_nick_name, kolPrice）
 * - juguang_data: 聚光数据（fee, interaction）按note_id关联
 *
 * 计算逻辑：
 * - Y轴：engageRate（内容质量/互动率），归一化到 [0,1]
 * - X轴：投流CPE = juguang.fee / juguang.interaction（投放效率），归一化到 [0,1]，反转（CPE越低越好）
 * - 分界线：Y_avg = MEAN(Y_scores), X_avg = MEAN(X_scores)
 * - 象限：核心资产(Y≥avg,X≥avg) / 潜力内容(Y≥avg,X<avg) / 流量消耗(Y<avg,X≥avg) / 淘汰候选(Y<avg,X<avg)
 *
 * 边界条件：
 * - interaction=0 → 排除（视为无投流数据）
 * - 仅1条投流笔记 → X_score=0.5, Y_score=0.5，不分配象限
 * - 所有笔记engageRate相同 → Y_score全部为0.5
 * - 所有笔记CPE相同 → X_score全部为0.5
 * - 没有投流数据的笔记不参与象限分析
 */
export class QuadrantAnalysisDataLoader extends BaseChapterDataLoader {
  chapterNumber = 5;
  chapterName = '综合分析';
  requiredDataSources = ['notes', 'juguang_data'];
  requiredFields = [
    'quadrant_cards', 'scatter_data', 'detail_table', 'quadrant_summary',
    'total_analyzed_notes', 'excluded_notes',
  ];

  constructor(prisma: InstanceType<typeof PrismaClient>) {
    super(prisma);
  }

  async load(projectId: string): Promise<ChapterDataContext> {
    const variables: Record<string, string> = {};

    // ── 1. 加载笔记数据 ──
    let notes: Array<{
      noteId: string;
      kolNickName: string | null;
      engageRate: number | null;
      kolPrice: unknown; // Decimal type from Prisma
    }> = [];

    try {
      notes = await this.prisma.note.findMany({
        where: { projectId },
        select: {
          noteId: true,
          kolNickName: true,
          engageRate: true,
          kolPrice: true,
        },
      });
    } catch (error) {
      console.warn(`[QuadrantAnalysisDataLoader] Failed to load notes: ${error}`);
    }

    // ── 2. 加载聚光数据（按note_id关联，累加同笔记多条记录） ──
    const juguangMap = new Map<string, { fee: number; interaction: number }>();

    try {
      const juguangData = await this.prisma.juguangData.findMany({
        where: { projectId, noteId: { not: null } },
        select: { noteId: true, fee: true, interaction: true },
      });

      for (const j of juguangData) {
        if (!j.noteId) continue;
        const existing = juguangMap.get(j.noteId);
        if (existing) {
          existing.fee += Number(j.fee);
          existing.interaction += j.interaction;
        } else {
          juguangMap.set(j.noteId, {
            fee: Number(j.fee),
            interaction: j.interaction,
          });
        }
      }
    } catch (error) {
      console.warn(`[QuadrantAnalysisDataLoader] Failed to load juguang_data: ${error}`);
    }

    // ── 3. 筛选有效笔记（有投流数据且interaction>0） ──
    interface QuadrantNote {
      noteId: string;
      kolNickName: string;
      engageRate: number;
      kolPrice: number;
      juguangFee: number;
      trafficCpe: number; // juguang.fee / juguang.interaction
    }

    const validNotes: QuadrantNote[] = [];
    let excludedCount = 0;

    for (const note of notes) {
      const juguang = juguangMap.get(note.noteId);

      // 没有投流数据的笔记不参与象限分析
      if (!juguang || juguang.fee <= 0) {
        excludedCount++;
        continue;
      }

      // interaction=0 → 排除（视为无投流数据）
      if (juguang.interaction <= 0) {
        excludedCount++;
        continue;
      }

      // engageRate 为 null 的笔记也排除
      if (note.engageRate === null || note.engageRate === undefined) {
        excludedCount++;
        continue;
      }

      const trafficCpe = juguang.fee / juguang.interaction;

      validNotes.push({
        noteId: note.noteId,
        kolNickName: note.kolNickName ?? '',
        engageRate: note.engageRate,
        kolPrice: Number(note.kolPrice) || 0,
        juguangFee: juguang.fee,
        trafficCpe,
      });
    }

    // ── 4. 归一化 + 象限分类 ──
    interface ClassifiedNote extends QuadrantNote {
      yScore: number;
      xScore: number;
      quadrant: string;
    }

    const classifiedNotes: ClassifiedNote[] = [];

    if (validNotes.length === 0) {
      // 无有效数据
      variables['total_analyzed_notes'] = '0';
      variables['excluded_notes'] = String(excludedCount);
      variables['quadrant_cards'] = '';
      variables['scatter_data'] = '';
      variables['detail_table'] = '';
      variables['quadrant_summary'] = '无有效投流数据，无法进行四象限分析';
      return this.buildContext(variables, []);
    }

    if (validNotes.length === 1) {
      // 仅1条投流笔记 → X_score=0.5, Y_score=0.5，不分配象限（数据不足）
      const note = validNotes[0];
      classifiedNotes.push({
        ...note,
        yScore: 0.5,
        xScore: 0.5,
        quadrant: '数据不足',
      });
    } else {
      // 多条笔记：归一化计算
      const engageRates = validNotes.map((n) => n.engageRate);
      const cpes = validNotes.map((n) => n.trafficCpe);

      const minEngageRate = Math.min(...engageRates);
      const maxEngageRate = Math.max(...engageRates);
      const minCpe = Math.min(...cpes);
      const maxCpe = Math.max(...cpes);

      // 归一化Y（engageRate）
      const engageRateRange = maxEngageRate - minEngageRate;
      // 归一化X（投流CPE，反转：CPE越低X_score越高）
      const cpeRange = maxCpe - minCpe;

      // 计算归一化分数
      const yScores: number[] = [];
      const xScores: number[] = [];

      for (const note of validNotes) {
        // Y: engageRate归一化，如果所有值相同则为0.5
        const yScore = engageRateRange === 0 ? 0.5 : (note.engageRate - minEngageRate) / engageRateRange;
        // X: CPE归一化（反转），如果所有值相同则为0.5
        const xScore = cpeRange === 0 ? 0.5 : 1 - (note.trafficCpe - minCpe) / cpeRange;

        yScores.push(yScore);
        xScores.push(xScore);
      }

      // 动态分界线：均值
      const yAvg = yScores.reduce((sum, v) => sum + v, 0) / yScores.length;
      const xAvg = xScores.reduce((sum, v) => sum + v, 0) / xScores.length;

      // 象限分配
      for (let i = 0; i < validNotes.length; i++) {
        const note = validNotes[i];
        const yScore = yScores[i];
        const xScore = xScores[i];

        let quadrant: string;
        if (yScore >= yAvg && xScore >= xAvg) {
          quadrant = '核心资产';
        } else if (yScore >= yAvg && xScore < xAvg) {
          quadrant = '潜力内容';
        } else if (yScore < yAvg && xScore >= xAvg) {
          quadrant = '流量消耗';
        } else {
          quadrant = '淘汰候选';
        }

        classifiedNotes.push({
          ...note,
          yScore,
          xScore,
          quadrant,
        });
      }
    }

    // ── 5. 构建输出变量 ──
    variables['total_analyzed_notes'] = String(classifiedNotes.length);
    variables['excluded_notes'] = String(excludedCount);

    // quadrant_cards: 4象限统计卡片
    const quadrantNames = ['核心资产', '潜力内容', '流量消耗', '淘汰候选'];
    const quadrantGroups: Record<string, ClassifiedNote[]> = {};
    for (const name of quadrantNames) {
      quadrantGroups[name] = [];
    }
    for (const n of classifiedNotes) {
      if (quadrantGroups[n.quadrant]) {
        quadrantGroups[n.quadrant].push(n);
      }
    }

    const quadrantCards = quadrantNames.map((name) => {
      const items = quadrantGroups[name];
      const count = items.length;
      const avgEngageRate = count > 0
        ? (items.reduce((s, n) => s + n.engageRate, 0) / count).toFixed(4)
        : '0';
      const avgCpe = count > 0
        ? (items.reduce((s, n) => s + n.trafficCpe, 0) / count).toFixed(2)
        : '0';
      return `${name}：${count}篇，平均互动率=${avgEngageRate}，平均投流CPE=${avgCpe}`;
    });
    variables['quadrant_cards'] = quadrantCards.join('\n');

    // scatter_data: 编号 + 坐标
    const scatterData = classifiedNotes.map((n, i) => {
      const idx = i + 1;
      return `${idx}. ${n.kolNickName}（X=${n.xScore.toFixed(3)}, Y=${n.yScore.toFixed(3)}, 象限=${n.quadrant}）`;
    });
    variables['scatter_data'] = scatterData.join('\n');

    // detail_table: 编号|创作者昵称|互动率|投流CPE|资源含税成本价|投流消耗|象限归属
    const tableHeader = '| 编号 | 创作者昵称 | 互动率 | 投流CPE | 资源含税成本价 | 投流消耗 | 象限归属 |';
    const tableSep = '| --- | --- | --- | --- | --- | --- | --- |';
    const tableRows = classifiedNotes.map((n, i) => {
      const idx = i + 1;
      return `| ${idx} | ${n.kolNickName} | ${(n.engageRate * 100).toFixed(2)}% | ${n.trafficCpe.toFixed(2)} | ${n.kolPrice.toFixed(0)} | ${n.juguangFee.toFixed(0)} | ${n.quadrant} |`;
    });
    variables['detail_table'] = [tableHeader, tableSep, ...tableRows].join('\n');

    // quadrant_summary: 文字总结
    const summaryParts = quadrantNames.map((name) => {
      const items = quadrantGroups[name];
      if (items.length === 0) return `${name}：0篇`;
      const avgEngageRate = (items.reduce((s, n) => s + n.engageRate, 0) / items.length * 100).toFixed(2);
      const avgCpe = (items.reduce((s, n) => s + n.trafficCpe, 0) / items.length).toFixed(2);
      return `${name}：${items.length}篇，平均互动率${avgEngageRate}%，平均投流CPE=${avgCpe}元`;
    });
    variables['quadrant_summary'] = summaryParts.join('\n');

    // ── 6. 构建溯源数据 ──
    const traceItems: TraceItem[] = [];

    if (classifiedNotes.length > 0) {
      traceItems.push({
        traceId: 'ch5_quadrant_summary',
        chapterNumber: 5,
        label: '四象限笔记分类数据',
        sourceTable: 'notes + juguang_data',
        sourceQuery: `SELECT n.note_id, n.kol_nick_name, n.engage_rate, n.kol_price, j.fee AS juguang_fee, j.interaction AS juguang_interaction\nFROM notes n\nINNER JOIN (SELECT note_id, SUM(fee) fee, SUM(interaction) interaction FROM juguang_data WHERE project_id = '${projectId}' AND interaction > 0 GROUP BY note_id) j ON n.note_id = j.note_id\nWHERE n.project_id = '${projectId}' AND n.engage_rate IS NOT NULL;`,
        totalRows: classifiedNotes.length,
        columns: [
          { key: 'noteId', label: 'note_id', type: 'string' },
          { key: 'kolNickName', label: 'kol_nick_name', type: 'string' },
          { key: 'engageRate', label: 'engage_rate', type: 'number' },
          { key: 'kolPrice', label: 'kol_price', type: 'number' },
          { key: 'juguangFee', label: 'juguang_fee', type: 'number' },
          { key: 'trafficCpe', label: '投流CPE', type: 'number' },
          { key: 'yScore', label: 'Y_score(归一化互动率)', type: 'number' },
          { key: 'xScore', label: 'X_score(归一化投流效率)', type: 'number' },
          { key: 'quadrant', label: '象限归属', type: 'string' },
        ],
        dataRows: classifiedNotes.slice(0, 200).map((n) => ({
          noteId: n.noteId,
          kolNickName: n.kolNickName,
          engageRate: n.engageRate,
          kolPrice: n.kolPrice,
          juguangFee: n.juguangFee,
          trafficCpe: Math.round(n.trafficCpe * 100) / 100,
          yScore: Math.round(n.yScore * 1000) / 1000,
          xScore: Math.round(n.xScore * 1000) / 1000,
          quadrant: n.quadrant,
        })) as unknown as Record<string, unknown>[],
        calculations: [
          { metric: '投流CPE', formula: 'juguang_fee / juguang_interaction', inputs: { '分析笔记数': classifiedNotes.length }, result: '每篇笔记单独计算' },
          { metric: 'Y归一化(互动率)', formula: '(engageRate - MIN) / (MAX - MIN)，全部相同时=0.5', inputs: {}, result: '每篇笔记单独计算' },
          { metric: 'X归一化(投流CPE，反转)', formula: '1 - (CPE - MIN) / (MAX - MIN)，全部相同时=0.5', inputs: {}, result: '每篇笔记单独计算' },
          { metric: '象限判定', formula: 'Y≥Yavg AND X≥Xavg→核心资产; Y≥Yavg AND X<Xavg→潜力内容; Y<Yavg AND X≥Xavg→流量消耗; Y<Yavg AND X<Xavg→淘汰候选', inputs: { '分析笔记数': classifiedNotes.length, '排除笔记数': excludedCount }, result: `核心资产${quadrantGroups['核心资产'].length}篇, 潜力内容${quadrantGroups['潜力内容'].length}篇, 流量消耗${quadrantGroups['流量消耗'].length}篇, 淘汰候选${quadrantGroups['淘汰候选'].length}篇` },
        ],
      });
    }

    return this.buildContext(variables, traceItems);
  }
}
