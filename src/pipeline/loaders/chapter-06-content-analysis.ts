import { PrismaClient } from '../../../generated/prisma';
import { BaseChapterDataLoader, ChapterDataContext, TraceItem } from './types';

/**
 * Chapter 6 (内容分析) Data Loader
 *
 * ═══ 重构版 ═══
 *
 * 核心变更：根据业务底表(note_base)的「内容形式」字段区分报备/非报备笔记，
 * 分别使用不同数据源计算指标，然后在每个维度内合并。
 *
 * 报备笔记 = note_base.cooperation_form IN ('视频报备', '图文报备')
 *   - 数据指标：从蒲公英API(notes表)获取
 *   - 费用：IF(内容金额口径='资源含税成本价', kol_price+total_platform_price, 资源含税售价)
 *
 * 非报备笔记 = note_base.cooperation_form IN ('视频软文', '图文软文')
 *   - 数据指标：完全从业务底表(note_base.metrics)获取
 *   - 费用：IF(内容金额口径='资源含税成本价', 资源含税成本价, 资源含税售价)
 *
 * 按多维度分组聚合，每个维度内合并报备+非报备数据：
 * - 内容方向分析（按 note_base.content_direction 分组）
 * - 内容形式分析（按 note_base.cooperation_form 聚合为 视频/图文 分组）
 * - 笔记类型分析（按 note_base.kol_type 分组）
 * - 达人层级分析（按 notes.kol_fan_num + review_configs.influencerTiers 分类）
 *
 * 表格标准列：维度 | 消费 | 发布数量 | 爆文数 | 爆文率 | 曝光量 | 阅读量 | 互动量 | CTR | CPM | CPC | CPE
 */
export class ContentAnalysisDataLoader extends BaseChapterDataLoader {
  chapterNumber = 6;
  chapterName = '内容分析';
  requiredDataSources = ['note_base', 'notes', 'juguang_data', 'review_configs'];
  requiredFields = [
    'by_content_direction', 'by_content_form', 'by_note_type', 'by_kol_tier',
    'top5_notes', 'total_notes', 'total_viral', 'viral_metric',
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

    // ── 0. 加载复盘配置 ──
    let engagementMetric = 'exclude_follow';
    let viralMetric = 'like_comment_share';
    let viralThreshold = 1000;
    let contentCostCaliber = '资源含税成本价';
    let influencerTiers: Array<{ name: string; fanRangeMin: number; fanRangeMax: number }> = [
      { name: '头部', fanRangeMin: 500000, fanRangeMax: 99999999 },
      { name: '腰部', fanRangeMin: 100000, fanRangeMax: 499999 },
      { name: '尾部', fanRangeMin: 10000, fanRangeMax: 99999 },
      { name: 'KOC', fanRangeMin: 0, fanRangeMax: 9999 },
    ];

    try {
      const reviewConfig = await this.prisma.reviewConfig.findFirst({
        where: { projectId },
        select: { engagementMetric: true, viralMetric: true, viralThreshold: true, influencerTiers: true, modules: true },
        orderBy: { createdAt: 'desc' },
      });
      if (reviewConfig) {
        if (reviewConfig.engagementMetric) engagementMetric = reviewConfig.engagementMetric as string;
        if (reviewConfig.viralMetric) viralMetric = reviewConfig.viralMetric as string;
        if (reviewConfig.viralThreshold != null && reviewConfig.viralThreshold > 0) {
          viralThreshold = reviewConfig.viralThreshold;
        }
        const modules = reviewConfig.modules as Record<string, unknown> | null;
        if (modules?.contentCostCaliber) {
          contentCostCaliber = modules.contentCostCaliber as string;
        }
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

    // ── 1. 加载业务底表 (note_base) ──
    interface NoteBaseRow {
      noteId: string;
      cooperationForm: string | null;
      contentDirection: string | null;
      kolType: string | null;
      contentCost: number;
      contentSettlement: number;
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
      console.warn(`[ContentAnalysisDataLoader] Failed to load note_base: ${error}`);
    }

    // 创建 noteId → NoteBaseRow 映射
    const noteBaseMap = new Map(noteBaseRows.map(r => [r.noteId, r]));
    const registeredNoteIds = new Set(
      noteBaseRows
        .filter(r => r.cooperationForm && ContentAnalysisDataLoader.REGISTERED_FORMS.includes(r.cooperationForm))
        .map(r => r.noteId)
    );

    // ── 2. 加载蒲公英笔记数据 (notes) — 报备笔记的指标 ──
    interface PugongyingRow {
      noteId: string;
      kolNickName: string | null;
      kolFanNum: number;
      noteType: string | null;
      noteTitle: string | null;
      noteLink: string | null;
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
      coverImages: any;
    }

    let pugongyingNotes: PugongyingRow[] = [];
    try {
      const notes = await this.prisma.note.findMany({
        where: { projectId },
        select: {
          noteId: true,
          kolNickName: true,
          kolFanNum: true,
          noteType: true,
          noteTitle: true,
          noteLink: true,
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
          coverImages: true,
        },
      });
      pugongyingNotes = notes.map(n => ({
        noteId: n.noteId,
        kolNickName: n.kolNickName,
        kolFanNum: n.kolFanNum ?? 0,
        noteType: n.noteType,
        noteTitle: n.noteTitle,
        noteLink: n.noteLink,
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
        coverImages: n.coverImages,
      }));
    } catch (error) {
      console.warn(`[ContentAnalysisDataLoader] Failed to load notes: ${error}`);
    }

    const pugongyingMap = new Map(pugongyingNotes.map(n => [n.noteId, n]));

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

    // ── 4. 构建每篇笔记的统一数据模型 ──
    interface EnrichedNote {
      noteId: string;
      kolNickName: string;
      kolFanNum: number;
      cooperationForm: string;  // 原始内容形式
      contentFormDisplay: string; // 前端展示：视频/图文
      contentDirection: string;
      kolType: string;          // 笔记类型
      kolTier: string;          // 达人层级
      isRegistered: boolean;
      impNum: number;
      readNum: number;
      engagement: number;
      likeNum: number;
      favNum: number;
      cmtNum: number;
      shareNum: number;
      tiUserNum: number;
      cost: number;
      cpe: number;
      cpti: number;
      isViral: boolean;
      viralScore: number;
      coverImage: string | null;
      noteLink: string | null;
      noteTitle: string;
    }

    const enrichedNotes: EnrichedNote[] = [];

    for (const nb of noteBaseRows) {
      const isRegistered = nb.cooperationForm != null && ContentAnalysisDataLoader.REGISTERED_FORMS.includes(nb.cooperationForm);
      const pugongying = pugongyingMap.get(nb.noteId);
      const juguang = juguangMap.get(nb.noteId);

      let impNum: number, readNum: number, likeNum: number, favNum: number, cmtNum: number, shareNum: number, followNum: number;
      let engagement: number;
      let cost: number;
      let kolFanNum: number;
      let kolNickName: string;
      let noteTitle: string;
      let coverImage: string | null;
      let noteLink: string | null;

      if (isRegistered && pugongying) {
        // ═══ 报备笔记：指标来自蒲公英 ═══
        impNum = pugongying.impNum;
        readNum = pugongying.readNum;
        likeNum = pugongying.likeNum;
        favNum = pugongying.favNum;
        cmtNum = pugongying.cmtNum;
        shareNum = pugongying.shareNum;
        followNum = pugongying.followNum;
        kolFanNum = pugongying.kolFanNum;
        kolNickName = pugongying.kolNickName || '';
        noteTitle = pugongying.noteTitle || '';
        coverImage = Array.isArray(pugongying.coverImages) && pugongying.coverImages.length > 0 ? pugongying.coverImages[0] : null;
        noteLink = pugongying.noteLink;

        // 互动量（按口径）
        if (engagementMetric === 'include_follow') {
          engagement = pugongying.engageNum;
        } else {
          engagement = likeNum + favNum + cmtNum + shareNum;
        }

        // 报备费用
        if (contentCostCaliber === '资源含税成本价') {
          cost = pugongying.kolPrice + pugongying.totalPlatformPrice;
        } else {
          cost = nb.contentSettlement;
        }
      } else {
        // ═══ 非报备笔记：指标完全来自业务底表 metrics ═══
        const m = nb.metrics || {};
        impNum = Number(m.impNum || 0);
        readNum = Number(m.readNum || 0);
        likeNum = Number(m.likeNum || 0);
        favNum = Number(m.favNum || 0);
        cmtNum = Number(m.cmtNum || 0);
        shareNum = Number(m.shareNum || 0);
        followNum = Number(m.followNum || 0);
        kolFanNum = pugongying?.kolFanNum || 0;
        kolNickName = pugongying?.kolNickName || '';
        noteTitle = pugongying?.noteTitle || '';
        coverImage = pugongying && Array.isArray(pugongying.coverImages) && pugongying.coverImages.length > 0 ? pugongying.coverImages[0] : null;
        noteLink = pugongying?.noteLink || null;

        // 非报备互动量
        if (engagementMetric === 'include_follow') {
          engagement = likeNum + favNum + cmtNum + shareNum + followNum;
        } else {
          engagement = likeNum + favNum + cmtNum + shareNum;
        }

        // 非报备费用
        if (contentCostCaliber === '资源含税成本价') {
          cost = nb.contentCost;
        } else {
          cost = nb.contentSettlement;
        }
      }

      // TI人群（来自聚光）
      const tiUserNum = juguang?.tiUserNum ?? 0;
      // 投流费用（聚光fee）加入总消费
      const juguangFee = juguang?.fee ?? 0;
      cost += juguangFee;

      // CPE / CPTI（消费 = 内容费用 + 投流费用）
      const cpe = engagement > 0 ? cost / engagement : 0;
      const cpti = tiUserNum > 0 ? cost / tiUserNum : 0;

      // 爆文判断
      let isViral: boolean;
      let viralScore: number;
      if (isRegistered) {
        // 报备用蒲公英数据 (like_num, cmt_num, fav_num)
        if (viralMetric === 'like_only') {
          isViral = likeNum >= viralThreshold;
          viralScore = likeNum;
        } else {
          const sum = likeNum + favNum + cmtNum;
          isViral = sum >= viralThreshold;
          viralScore = sum;
        }
      } else {
        // 非报备用业务底表数据 (点赞量, 收藏量, 评论量)
        if (viralMetric === 'like_only') {
          isViral = likeNum >= viralThreshold;
          viralScore = likeNum;
        } else {
          const sum = likeNum + favNum + cmtNum;
          isViral = sum >= viralThreshold;
          viralScore = sum;
        }
      }

      // 达人层级（按粉丝数）
      let kolTier = '未分类';
      for (const tier of influencerTiers) {
        if (kolFanNum >= tier.fanRangeMin && kolFanNum <= tier.fanRangeMax) {
          kolTier = tier.name;
          break;
        }
      }

      // 内容形式前端展示：视频报备/视频软文 → 视频, 图文报备/图文软文 → 图文
      let contentFormDisplay = '未分类';
      if (nb.cooperationForm) {
        if (nb.cooperationForm.startsWith('视频')) contentFormDisplay = '视频';
        else if (nb.cooperationForm.startsWith('图文')) contentFormDisplay = '图文';
      }

      enrichedNotes.push({
        noteId: nb.noteId,
        kolNickName,
        kolFanNum,
        cooperationForm: nb.cooperationForm || '未分类',
        contentFormDisplay,
        contentDirection: nb.contentDirection || '未分类',
        kolType: nb.kolType || '未分类',
        kolTier,
        isRegistered,
        impNum,
        readNum,
        engagement,
        likeNum,
        favNum,
        cmtNum,
        shareNum,
        tiUserNum,
        cost,
        cpe,
        cpti,
        isViral,
        viralScore,
        coverImage,
        noteLink,
        noteTitle,
      });
    }

    // ── 5. 分组聚合函数 ──
    function aggregate(grouped: Map<string, EnrichedNote[]>): string {
      const rows: string[] = [];
      for (const [name, items] of grouped) {
        const count = items.length;
        const totalCost = items.reduce((s, n) => s + n.cost, 0);
        const totalImp = items.reduce((s, n) => s + n.impNum, 0);
        const totalRead = items.reduce((s, n) => s + n.readNum, 0);
        const totalEng = items.reduce((s, n) => s + n.engagement, 0);
        const viralCount = items.filter(n => n.isViral).length;
        const viralRate = count > 0 ? ((viralCount / count) * 100).toFixed(1) + '%' : '0%';
        const ctr = totalImp > 0 ? ((totalRead / totalImp) * 100).toFixed(2) + '%' : '-';
        const cpm = totalImp > 0 ? ((totalCost / totalImp) * 1000).toFixed(2) : '-';
        const cpc = totalRead > 0 ? (totalCost / totalRead).toFixed(2) : '-';
        const cpe = totalEng > 0 ? (totalCost / totalEng).toFixed(2) : '-';

        rows.push(`| ${name} | ${totalCost.toFixed(0)} | ${count} | ${viralCount} | ${viralRate} | ${totalImp} | ${totalRead} | ${totalEng} | ${ctr} | ${cpm} | ${cpc} | ${cpe} |`);
      }
      return rows.join('\n');
    }

    // ── 6. 按内容方向分组（合并报备+非报备同维度数据） ──
    const byDirection = new Map<string, EnrichedNote[]>();
    for (const n of enrichedNotes) {
      if (!byDirection.has(n.contentDirection)) byDirection.set(n.contentDirection, []);
      byDirection.get(n.contentDirection)!.push(n);
    }
    variables['by_content_direction'] = aggregate(byDirection);

    // ── 7. 按内容形式分组（视频/图文，合并报备和非报备） ──
    const byForm = new Map<string, EnrichedNote[]>();
    for (const n of enrichedNotes) {
      if (!byForm.has(n.contentFormDisplay)) byForm.set(n.contentFormDisplay, []);
      byForm.get(n.contentFormDisplay)!.push(n);
    }
    variables['by_content_form'] = aggregate(byForm);

    // ── 8. 按笔记类型分组 ──
    const byNoteType = new Map<string, EnrichedNote[]>();
    for (const n of enrichedNotes) {
      if (!byNoteType.has(n.kolType)) byNoteType.set(n.kolType, []);
      byNoteType.get(n.kolType)!.push(n);
    }
    variables['by_note_type'] = aggregate(byNoteType);

    // ── 9. 按达人层级分组 ──
    const byKolTier = new Map<string, EnrichedNote[]>();
    for (const n of enrichedNotes) {
      if (!byKolTier.has(n.kolTier)) byKolTier.set(n.kolTier, []);
      byKolTier.get(n.kolTier)!.push(n);
    }
    variables['by_kol_tier'] = aggregate(byKolTier);

    // ── 10. 优质笔记TOP5 ──
    const sortedNotes = [...enrichedNotes].sort((a, b) => b.viralScore - a.viralScore);
    const top5 = sortedNotes.slice(0, 5).map((n, i) => {
      const coverHtml = n.coverImage
        ? `[封面图: ${n.coverImage}]`
        : '[无封面图]';
      const regLabel = n.isRegistered ? '报备' : '非报备';
      return `${i + 1}. ${n.kolNickName}（${n.contentFormDisplay}/${n.contentDirection}/${regLabel}）：曝光${n.impNum}, 互动${n.engagement}, CPE=${n.cpe.toFixed(2)}, 赞${n.likeNum}/藏${n.favNum}/评${n.cmtNum}\n   标题: ${n.noteTitle || '无标题'}\n   封面: ${coverHtml}\n   链接: ${n.noteLink || '无'}`;
    });
    variables['top5_notes'] = top5.join('\n\n');

    // 结构化TOP5数据
    const top5Structured = sortedNotes.slice(0, 5).map((n) => ({
      noteId: n.noteId,
      kolNickName: n.kolNickName,
      contentFormDisplay: n.contentFormDisplay,
      contentDirection: n.contentDirection,
      kolType: n.kolType,
      isRegistered: n.isRegistered,
      noteTitle: n.noteTitle,
      impNum: n.impNum,
      readNum: n.readNum,
      engagement: n.engagement,
      likeNum: n.likeNum,
      favNum: n.favNum,
      cmtNum: n.cmtNum,
      cost: Number(n.cost.toFixed(2)),
      cpe: Number(n.cpe.toFixed(2)),
      coverImage: n.coverImage,
      noteLink: n.noteLink,
    }));
    variables['top5_notes_json'] = JSON.stringify(top5Structured);

    // 统计信息
    variables['total_notes'] = String(enrichedNotes.length);
    variables['total_viral'] = String(enrichedNotes.filter((n) => n.isViral).length);
    variables['viral_metric'] = viralMetric === 'like_only' ? `千赞（赞≥${viralThreshold}）` : `千互（赞+藏+评≥${viralThreshold}）`;

    // ── 11. 构建溯源数据 ──
    const traceItems: TraceItem[] = [];

    // 内容方向分析表溯源
    const directionRawRows = enrichedNotes.slice(0, 200).map(n => ({
      noteId: n.noteId,
      kolNickName: n.kolNickName,
      contentDirection: n.contentDirection,
      isRegistered: n.isRegistered ? '报备' : '非报备',
      impNum: n.impNum,
      readNum: n.readNum,
      engagement: n.engagement,
      cost: Number(n.cost.toFixed(2)),
      isViral: n.isViral ? '是' : '否',
    }));
    traceItems.push({
      traceId: 'ch6_by_direction',
      chapterNumber: 6,
      label: '内容方向分析(原始笔记数据)',
      sourceTable: 'note_base + notes(报备) + note_base.metrics(非报备)',
      sourceQuery: `-- 报备笔记指标来源\nSELECT n.note_id, n.imp_num, n.read_num, n.like_num, n.fav_num, n.cmt_num, n.share_num, n.kol_price, n.total_platform_price\nFROM notes n\nWHERE n.project_id = '${projectId}' AND n.note_id IN (SELECT note_id FROM note_base WHERE project_id = '${projectId}' AND cooperation_form IN ('视频报备','图文报备'));\n\n-- 非报备笔记指标来源\nSELECT note_id, cooperation_form, content_cost, content_settlement, metrics\nFROM note_base WHERE project_id = '${projectId}' AND cooperation_form IN ('视频软文','图文软文');`,
      totalRows: enrichedNotes.length,
      columns: [
        { key: 'kolNickName', label: '达人', type: 'string' },
        { key: 'contentDirection', label: '内容方向', type: 'string' },
        { key: 'isRegistered', label: '报备/非报备', type: 'string' },
        { key: 'impNum', label: '曝光', type: 'number' },
        { key: 'readNum', label: '阅读', type: 'number' },
        { key: 'engagement', label: '互动', type: 'number' },
        { key: 'cost', label: '费用', type: 'number' },
        { key: 'isViral', label: '是否爆文', type: 'string' },
      ],
      dataRows: directionRawRows as unknown as Record<string, unknown>[],
      calculations: [
        { metric: '分组聚合', formula: 'GROUP BY content_direction（合并报备+非报备）', inputs: { '分组数': byDirection.size }, result: `${byDirection.size}个内容方向` },
        { metric: '费用口径', formula: `内容金额口径=${contentCostCaliber}`, inputs: { '报备费用': contentCostCaliber === '资源含税成本价' ? 'kol_price+total_platform_price' : 'note_base.content_settlement', '非报备费用': contentCostCaliber === '资源含税成本价' ? 'note_base.content_cost' : 'note_base.content_settlement' }, result: '按口径计算' },
        { metric: 'CPE(每组)', formula: '合并消费 / 合并互动量', inputs: {}, result: '按组聚合后计算' },
        { metric: '爆文率(每组)', formula: '合并爆文数 / 合并发布数 × 100%', inputs: { '爆文标准': viralMetric === 'like_only' ? `赞≥${viralThreshold}` : `赞+藏+评≥${viralThreshold}` }, result: '按组统计' },
      ],
    });

    // 达人层级分析表溯源
    const tierRawRows = enrichedNotes.slice(0, 200).map(n => ({
      noteId: n.noteId,
      kolNickName: n.kolNickName,
      kolFanNum: n.kolFanNum,
      kolTier: n.kolTier,
      isRegistered: n.isRegistered ? '报备' : '非报备',
      impNum: n.impNum,
      engagement: n.engagement,
      cost: Number(n.cost.toFixed(2)),
      isViral: n.isViral ? '是' : '否',
    }));
    traceItems.push({
      traceId: 'ch6_by_kol_tier',
      chapterNumber: 6,
      label: '达人层级分析(原始笔记数据)',
      sourceTable: 'note_base + notes + review_configs.influencer_tiers',
      sourceQuery: `SELECT n.note_id, n.kol_fan_num FROM notes n WHERE n.project_id = '${projectId}';\nSELECT influencer_tiers FROM review_configs WHERE project_id = '${projectId}' ORDER BY created_at DESC LIMIT 1;`,
      totalRows: enrichedNotes.length,
      columns: [
        { key: 'kolNickName', label: '达人', type: 'string' },
        { key: 'kolFanNum', label: '粉丝数', type: 'number' },
        { key: 'kolTier', label: '层级', type: 'string' },
        { key: 'isRegistered', label: '报备/非报备', type: 'string' },
        { key: 'impNum', label: '曝光', type: 'number' },
        { key: 'engagement', label: '互动', type: 'number' },
        { key: 'cost', label: '费用', type: 'number' },
        { key: 'isViral', label: '是否爆文', type: 'string' },
      ],
      dataRows: tierRawRows as unknown as Record<string, unknown>[],
      calculations: [
        { metric: '层级划分规则', formula: '按粉丝数区间分类', inputs: Object.fromEntries(influencerTiers.map(t => [t.name, `${t.fanRangeMin}~${t.fanRangeMax}`])), result: `${influencerTiers.length}个层级` },
        { metric: '分组聚合', formula: 'GROUP BY kol_tier（合并报备+非报备）', inputs: { '分组数': byKolTier.size }, result: `${byKolTier.size}个层级` },
      ],
    });

    return this.buildContext(variables, traceItems);
  }
}
