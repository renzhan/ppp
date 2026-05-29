import { PrismaClient } from '../../../generated/prisma';
import { BaseChapterDataLoader, ChapterDataContext } from './types';

/**
 * Chapter 7 (投流分析) Data Loader
 *
 * 数据来源：
 * - juguang_data: 聚光数据（fee, impression, click, interaction, ti_user_num, i_user_num, 回搜相关, placement, targets_detail, keyword）
 * - notes: 蒲公英数据（用于笔记维度投流分析）
 * - note_base: 笔记底表（content_direction, kol_type）
 * - review_configs: 大盘均值（用于对比）
 *
 * 子模块：
 * - 投流总览（总消耗/总曝光/总点击/总互动/CPM/CPC/CPE/CTR/TI/CPTI）
 * - 按笔记维度的投流分析（每篇笔记的投流数据）
 * - 回搜数据（搜索组件点击、搜后阅读）
 * - 新增种草人群成本（I人群/TI人群/CPI/CPTI）
 * - 大盘对比
 * - 按广告类型分析（信息流/视频流/搜索）— GROUP BY placement
 * - 按人群定向分析 — GROUP BY targets_detail
 * - 按关键词分析（搜索主题名称）— GROUP BY keyword
 */
export class TrafficAnalysisDataLoader extends BaseChapterDataLoader {
  chapterNumber = 7;
  chapterName = '投流分析';
  requiredDataSources = ['juguang_data', 'notes', 'note_base', 'review_configs'];
  requiredFields = [
    'traffic_overview', 'traffic_by_note', 'search_data',
    'audience_growth', 'benchmark_comparison',
    'ad_type_analysis', 'targeting_analysis', 'keyword_analysis',
  ];

  constructor(prisma: InstanceType<typeof PrismaClient>) {
    super(prisma);
  }

  async load(projectId: string): Promise<ChapterDataContext> {
    const variables: Record<string, string> = {};

    // ── 0. 加载大盘均值 ──
    let benchmark: Record<string, number> = {};
    try {
      const reviewConfig = await this.prisma.reviewConfig.findFirst({
        where: { projectId },
        select: { benchmark: true },
        orderBy: { createdAt: 'desc' },
      });
      if (reviewConfig?.benchmark && typeof reviewConfig.benchmark === 'object') {
        benchmark = reviewConfig.benchmark as Record<string, number>;
      }
    } catch (error) {
      console.warn(`[TrafficAnalysisDataLoader] Failed to load review_configs: ${error}`);
    }

    // ── 1. 聚光数据汇总 ──
    let totalFee = 0;
    let totalImpression = 0;
    let totalClick = 0;
    let totalInteraction = 0;
    let totalIUserNum = 0;
    let totalTiUserNum = 0;
    let totalSearchCmtClick = 0;
    let totalSearchCmtAfterRead = 0;

    interface JuguangRecord {
      noteId: string | null;
      placement: string | null;
      targetsDetail: string | null;
      keyword: string | null;
      fee: any;
      impression: number;
      click: number;
      interaction: number;
      iUserNum: number;
      tiUserNum: number;
      iUserPrice: any;
      tiUserPrice: any;
      searchCmtClick: number;
      searchCmtAfterRead: number;
      searchCmtAfterReadAvg: any;
      searchCmtClickCvr: any;
    }

    let juguangRecords: JuguangRecord[] = [];

    try {
      juguangRecords = await this.prisma.juguangData.findMany({
        where: { projectId },
        select: {
          noteId: true,
          placement: true,
          targetsDetail: true,
          keyword: true,
          fee: true,
          impression: true,
          click: true,
          interaction: true,
          iUserNum: true,
          tiUserNum: true,
          iUserPrice: true,
          tiUserPrice: true,
          searchCmtClick: true,
          searchCmtAfterRead: true,
          searchCmtAfterReadAvg: true,
          searchCmtClickCvr: true,
        },
      });

      for (const j of juguangRecords) {
        totalFee += Number(j.fee);
        totalImpression += j.impression;
        totalClick += j.click;
        totalInteraction += j.interaction;
        totalIUserNum += j.iUserNum;
        totalTiUserNum += j.tiUserNum;
        totalSearchCmtClick += j.searchCmtClick;
        totalSearchCmtAfterRead += j.searchCmtAfterRead;
      }
    } catch (error) {
      console.warn(`[TrafficAnalysisDataLoader] Failed to load juguang_data: ${error}`);
    }

    // ── 2. 投流总览 ──
    const paidCpm = totalImpression > 0 ? (totalFee / totalImpression) * 1000 : 0;
    const paidCpc = totalClick > 0 ? totalFee / totalClick : 0;
    const paidCpe = totalInteraction > 0 ? totalFee / totalInteraction : 0;
    const paidCtr = totalImpression > 0 ? (totalClick / totalImpression) * 100 : 0;
    const cpti = totalTiUserNum > 0 ? totalFee / totalTiUserNum : 0;
    const cpi = totalIUserNum > 0 ? totalFee / totalIUserNum : 0;

    variables['traffic_overview'] = [
      `总消耗：${totalFee.toFixed(2)}元`,
      `总曝光（展现量）：${totalImpression}`,
      `总点击：${totalClick}`,
      `总互动：${totalInteraction}`,
      `CPM：${paidCpm.toFixed(2)}`,
      `CPC：${paidCpc.toFixed(2)}`,
      `CPE：${paidCpe.toFixed(2)}`,
      `CTR：${paidCtr.toFixed(2)}%`,
      `新增种草人群（I）：${totalIUserNum}`,
      `新增深度种草人群（TI）：${totalTiUserNum}`,
      `CPI（种草人群成本）：${cpi.toFixed(2)}`,
      `CPTI（深度种草人群成本）：${cpti.toFixed(2)}`,
    ].join('\n');

    // 单独输出关键指标（供模板引用）
    variables['total_fee'] = totalFee.toFixed(2);
    variables['total_impression'] = String(totalImpression);
    variables['total_click'] = String(totalClick);
    variables['total_interaction'] = String(totalInteraction);
    variables['paid_cpm'] = paidCpm.toFixed(2);
    variables['paid_cpc'] = paidCpc.toFixed(2);
    variables['paid_cpe'] = paidCpe.toFixed(2);
    variables['paid_ctr'] = paidCtr.toFixed(2);
    variables['total_ti_user_num'] = String(totalTiUserNum);
    variables['total_i_user_num'] = String(totalIUserNum);
    variables['cpti'] = cpti.toFixed(2);
    variables['cpi'] = cpi.toFixed(2);

    // ── 3. 大盘对比 ──
    const comparisons: string[] = [];
    if (benchmark.cpm && paidCpm > 0) {
      const diff = ((1 - paidCpm / benchmark.cpm) * 100).toFixed(0);
      comparisons.push(`CPM：实际${paidCpm.toFixed(2)} vs 大盘${benchmark.cpm}（${paidCpm < benchmark.cpm ? '优于' : '劣于'}大盘${Math.abs(Number(diff))}%）`);
    }
    if (benchmark.cpc && paidCpc > 0) {
      const diff = ((1 - paidCpc / benchmark.cpc) * 100).toFixed(0);
      comparisons.push(`CPC：实际${paidCpc.toFixed(2)} vs 大盘${benchmark.cpc}（${paidCpc < benchmark.cpc ? '优于' : '劣于'}大盘${Math.abs(Number(diff))}%）`);
    }
    if (benchmark.cpe && paidCpe > 0) {
      const diff = ((1 - paidCpe / benchmark.cpe) * 100).toFixed(0);
      comparisons.push(`CPE：实际${paidCpe.toFixed(2)} vs 大盘${benchmark.cpe}（${paidCpe < benchmark.cpe ? '优于' : '劣于'}大盘${Math.abs(Number(diff))}%）`);
    }
    if (benchmark.ctr && paidCtr > 0) {
      const diff = ((paidCtr / benchmark.ctr - 1) * 100).toFixed(0);
      comparisons.push(`CTR：实际${paidCtr.toFixed(2)}% vs 大盘${benchmark.ctr}%（${paidCtr > benchmark.ctr ? '优于' : '劣于'}大盘${Math.abs(Number(diff))}%）`);
    }
    variables['benchmark_comparison'] = comparisons.length > 0 ? comparisons.join('\n') : '暂无大盘对比数据';

    // ── 4. 回搜数据 ──
    variables['search_data'] = [
      `搜索组件总点击：${totalSearchCmtClick}`,
      `搜后总阅读量：${totalSearchCmtAfterRead}`,
      `回搜率（搜索组件点击/总点击）：${totalClick > 0 ? ((totalSearchCmtClick / totalClick) * 100).toFixed(2) : '0'}%`,
    ].join('\n');

    // ── 5. 新增种草人群分析 ──
    variables['audience_growth'] = [
      `新增种草人群（I）：${totalIUserNum}`,
      `新增深度种草人群（TI）：${totalTiUserNum}`,
      `CPI（种草人群成本）：${cpi.toFixed(2)}元/人`,
      `CPTI（深度种草人群成本）：${cpti.toFixed(2)}元/人`,
    ].join('\n');

    // ── 6. 按笔记维度的投流数据（TOP10 投流笔记） ──
    try {
      // 加载笔记底表信息
      const noteBaseMap = new Map<string, { contentDirection: string; kolType: string }>();
      const noteBaseResult = await this.prisma.$queryRaw<Array<{ note_id: string; content_direction: string | null; kol_type: string | null }>>`
        SELECT note_id, content_direction, kol_type FROM note_base WHERE project_id = ${projectId}::uuid
      `;
      for (const row of noteBaseResult) {
        noteBaseMap.set(row.note_id, {
          contentDirection: row.content_direction || '',
          kolType: row.kol_type || '',
        });
      }

      // 加载笔记基本信息
      const notesMap = new Map<string, { kolNickName: string; noteType: string }>();
      const notes = await this.prisma.note.findMany({
        where: { projectId },
        select: { noteId: true, kolNickName: true, noteType: true },
      });
      for (const n of notes) {
        notesMap.set(n.noteId, {
          kolNickName: n.kolNickName || '',
          noteType: (n.noteType === '1' || n.noteType === 'image') ? '图文' : '视频',
        });
      }

      // 按note_id聚合聚光数据
      const byNote = new Map<string, { fee: number; impression: number; click: number; interaction: number; tiUserNum: number; iUserNum: number }>();
      for (const j of juguangRecords) {
        if (!j.noteId) continue;
        const existing = byNote.get(j.noteId);
        if (existing) {
          existing.fee += Number(j.fee);
          existing.impression += j.impression;
          existing.click += j.click;
          existing.interaction += j.interaction;
          existing.tiUserNum += j.tiUserNum;
          existing.iUserNum += j.iUserNum;
        } else {
          byNote.set(j.noteId, {
            fee: Number(j.fee),
            impression: j.impression,
            click: j.click,
            interaction: j.interaction,
            tiUserNum: j.tiUserNum,
            iUserNum: j.iUserNum,
          });
        }
      }

      // 按消耗降序取TOP10
      const sortedNotes = Array.from(byNote.entries())
        .sort((a, b) => b[1].fee - a[1].fee)
        .slice(0, 10);

      const noteRows = sortedNotes.map(([noteId, data]) => {
        const noteInfo = notesMap.get(noteId);
        const baseInfo = noteBaseMap.get(noteId);
        const noteCpm = data.impression > 0 ? ((data.fee / data.impression) * 1000).toFixed(2) : '-';
        const noteCpc = data.click > 0 ? (data.fee / data.click).toFixed(2) : '-';
        const noteCpe = data.interaction > 0 ? (data.fee / data.interaction).toFixed(2) : '-';
        const noteCtr = data.impression > 0 ? ((data.click / data.impression) * 100).toFixed(2) + '%' : '-';
        const noteCpti = data.tiUserNum > 0 ? (data.fee / data.tiUserNum).toFixed(2) : '-';

        return `| ${noteInfo?.kolNickName || noteId} | ${noteInfo?.noteType || '-'} | ${baseInfo?.contentDirection || '-'} | ${data.fee.toFixed(0)} | ${data.impression} | ${data.click} | ${data.interaction} | ${noteCpm} | ${noteCpc} | ${noteCpe} | ${noteCtr} | ${data.tiUserNum} | ${noteCpti} |`;
      });

      variables['traffic_by_note'] = noteRows.length > 0 ? noteRows.join('\n') : '暂无笔记维度投流数据';
    } catch (error) {
      console.warn(`[TrafficAnalysisDataLoader] Failed to load note-level traffic: ${error}`);
      variables['traffic_by_note'] = '数据加载失败';
    }

    // ── 7. 按广告类型（投放位置）分析 ──
    variables['ad_type_analysis'] = this.buildGroupAnalysis(juguangRecords, 'placement', '广告类型');

    // ── 8. 按人群定向分析 ──
    variables['targeting_analysis'] = this.buildGroupAnalysis(juguangRecords, 'targetsDetail', '精准定向');

    // ── 9. 按关键词（搜索主题名称）分析 ──
    variables['keyword_analysis'] = this.buildGroupAnalysis(juguangRecords, 'keyword', '关键词');

    return this.buildContext(variables);
  }

  /**
   * 通用分组聚合分析方法。
   * 按指定字段 GROUP BY，计算每组的消耗/曝光/点击/互动/CPM/CPC/CPE/CTR/I人群/CPTI 等指标。
   * 输出 Markdown 表格。
   *
   * 对应图片中的数据规范：
   * - 投放位置（广告类型）：GROUP BY 广告类型（分组维度） → placement 字段
   * - 人群定向分析：GROUP BY 精准定向（分组维度） → targets_detail 字段
   * - 关键词定向分析：GROUP BY 关键词（分组维度） → keyword 字段
   *
   * 每组计算指标：
   * - 消耗: SUM(fee)
   * - 展现量: SUM(impression)
   * - 点击量: SUM(click)
   * - 互动量: SUM(interaction)
   * - CTR: SUM(click)/SUM(impression)*100
   * - CPM: SUM(fee)/SUM(impression)*1000
   * - CPC: SUM(fee)/SUM(click)
   * - CPE: SUM(fee)/SUM(interaction)
   * - 新增种草人群: SUM(i_user_num)
   * - 新增种草人群成本: SUM(fee)/SUM(i_user_num)
   * - 新增深度种草人群: SUM(ti_user_num)
   * - 新增深度种草人群成本: SUM(fee)/SUM(ti_user_num)
   */
  private buildGroupAnalysis(
    records: Array<{
      placement: string | null;
      targetsDetail: string | null;
      keyword: string | null;
      fee: any;
      impression: number;
      click: number;
      interaction: number;
      iUserNum: number;
      tiUserNum: number;
    }>,
    groupField: 'placement' | 'targetsDetail' | 'keyword',
    groupLabel: string,
  ): string {
    // 按分组字段聚合
    const groups = new Map<string, {
      fee: number;
      impression: number;
      click: number;
      interaction: number;
      iUserNum: number;
      tiUserNum: number;
    }>();

    for (const record of records) {
      const key = record[groupField];
      if (!key) continue; // 跳过没有该字段的记录

      const existing = groups.get(key);
      if (existing) {
        existing.fee += Number(record.fee);
        existing.impression += record.impression;
        existing.click += record.click;
        existing.interaction += record.interaction;
        existing.iUserNum += record.iUserNum;
        existing.tiUserNum += record.tiUserNum;
      } else {
        groups.set(key, {
          fee: Number(record.fee),
          impression: record.impression,
          click: record.click,
          interaction: record.interaction,
          iUserNum: record.iUserNum,
          tiUserNum: record.tiUserNum,
        });
      }
    }

    if (groups.size === 0) {
      return `暂无${groupLabel}维度数据`;
    }

    // 按消耗降序排列
    const sorted = Array.from(groups.entries()).sort((a, b) => b[1].fee - a[1].fee);

    // 构建 Markdown 表格
    const header = `| ${groupLabel} | 消耗 | 展现量 | 点击量 | 互动量 | CPM | CPC | CPE | CTR | 新增种草人群 | 新增种草人群成本 | 新增深度种草人群 | 新增深度种草人群成本 |`;
    const separator = '|---|---|---|---|---|---|---|---|---|---|---|---|---|';

    const rows = sorted.map(([name, data]) => {
      const grpCpm = data.impression > 0 ? ((data.fee / data.impression) * 1000).toFixed(2) : '-';
      const grpCpc = data.click > 0 ? (data.fee / data.click).toFixed(2) : '-';
      const grpCpe = data.interaction > 0 ? (data.fee / data.interaction).toFixed(2) : '-';
      const grpCtr = data.impression > 0 ? ((data.click / data.impression) * 100).toFixed(2) + '%' : '-';
      const grpIUserCost = data.iUserNum > 0 ? (data.fee / data.iUserNum).toFixed(2) : '-';
      const grpTiUserCost = data.tiUserNum > 0 ? (data.fee / data.tiUserNum).toFixed(2) : '-';

      return `| ${name} | ${data.fee.toFixed(0)} | ${data.impression} | ${data.click} | ${data.interaction} | ${grpCpm} | ${grpCpc} | ${grpCpe} | ${grpCtr} | ${data.iUserNum} | ${grpIUserCost} | ${data.tiUserNum} | ${grpTiUserCost} |`;
    });

    return [header, separator, ...rows].join('\n');
  }
}
