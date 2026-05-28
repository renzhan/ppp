import { PrismaClient } from '../../../generated/prisma';
import { BaseChapterDataLoader, ChapterDataContext } from './types';

/**
 * Chapter 2 (项目回顾) Data Loader
 *
 * 数据来源：
 * - ai_generated_content (content_type='plan_parse')：项目背景（客户期待）、传播目的、策略回顾
 * - review_configs.launchPhases：传播节奏/投放阶段
 * - notes + business_annotations：各阶段发布篇数、内容方向分布、达人层级分布
 *
 * 二级模块：
 * 1. 项目背景（客户期待） → 来源：策划案
 * 2. 传播目的             → 来源：策划案
 * 3. 策略回顾             → 来源：策划案
 * 4. 数据解读             → 来源：AI生成（基于上述3项 + 执行数据）
 */
export class ProjectReviewDataLoader extends BaseChapterDataLoader {
  chapterNumber = 2;
  chapterName = '项目回顾';
  requiredDataSources = ['ai_generated_content', 'review_configs', 'notes', 'business_annotations'];
  requiredFields = [
    'project_objective',
    'strategy',
    'target_audience',
    'core_message',
    'launch_phases',
    'note_count',
    'phase_note_counts',
    'content_directions',
    'kol_tier_distribution',
  ];

  constructor(prisma: InstanceType<typeof PrismaClient>) {
    super(prisma);
  }

  async load(projectId: string): Promise<ChapterDataContext> {
    const variables: Record<string, string> = {};

    // ── 1. 策划案解析数据 (ai_generated_content, content_type='plan_parse') ──
    try {
      const aiContent = await this.prisma.aiGeneratedContent.findFirst({
        where: {
          projectId,
          contentType: 'plan_parse',
        },
        select: {
          generatedContent: true,
          editedContent: true,
          isEdited: true,
        },
      });

      if (aiContent) {
        const content = aiContent.isEdited && aiContent.editedContent
          ? aiContent.editedContent
          : aiContent.generatedContent;

        if (content) {
          try {
            const parsed = JSON.parse(content);
            if (parsed.projectObjective) variables['project_objective'] = parsed.projectObjective;
            if (parsed.strategy) variables['strategy'] = parsed.strategy;
            if (parsed.targetAudience) variables['target_audience'] = parsed.targetAudience;
            if (parsed.coreMessage) variables['core_message'] = parsed.coreMessage;
          } catch {
            // Content is not JSON, use as-is for project_objective
            variables['project_objective'] = content;
          }
        }
      }
    } catch (error) {
      console.warn(`[ProjectReviewDataLoader] Failed to load ai_generated_content: ${error}`);
    }

    // ── 2. 传播节奏 (review_configs.launchPhases) ──
    let launchPhases: Array<{ name: string; startDate?: string; endDate?: string; noteCount?: number }> = [];
    try {
      const reviewConfig = await this.prisma.reviewConfig.findFirst({
        where: { projectId },
        select: { launchPhases: true },
        orderBy: { createdAt: 'desc' },
      });

      if (reviewConfig && reviewConfig.launchPhases) {
        const phases = reviewConfig.launchPhases;
        if (Array.isArray(phases) && phases.length > 0) {
          launchPhases = phases as typeof launchPhases;
          const phasesText = launchPhases
            .map((p) => `- ${p.name}：${p.startDate ?? ''} ~ ${p.endDate ?? ''}${p.noteCount != null ? `，计划${p.noteCount}篇` : ''}`)
            .join('\n');
          variables['launch_phases'] = phasesText;
        }
      }
    } catch (error) {
      console.warn(`[ProjectReviewDataLoader] Failed to load review_configs: ${error}`);
    }

    // ── 3. 项目执行数据 (notes + business_annotations) ──
    try {
      // 总笔记数
      const noteCount = await this.prisma.note.count({
        where: { projectId },
      });
      variables['note_count'] = String(noteCount);

      // 各阶段发布篇数（通过 business_annotations.launchPhase 分组）
      const annotations = await this.prisma.businessAnnotation.findMany({
        where: { projectId },
        select: {
          noteId: true,
          contentDirection: true,
          launchPhase: true,
        },
      });

      // 按投放阶段统计篇数
      const phaseCountMap = new Map<string, number>();
      for (const ann of annotations) {
        if (ann.launchPhase) {
          phaseCountMap.set(ann.launchPhase, (phaseCountMap.get(ann.launchPhase) ?? 0) + 1);
        }
      }
      if (phaseCountMap.size > 0) {
        const phaseCountsText = Array.from(phaseCountMap.entries())
          .map(([phase, count]) => `${phase}：${count}篇`)
          .join('、');
        variables['phase_note_counts'] = phaseCountsText;
      }

      // 内容方向分布
      const directionCountMap = new Map<string, number>();
      for (const ann of annotations) {
        if (ann.contentDirection) {
          directionCountMap.set(ann.contentDirection, (directionCountMap.get(ann.contentDirection) ?? 0) + 1);
        }
      }
      if (directionCountMap.size > 0) {
        const directionsText = Array.from(directionCountMap.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([dir, count]) => `${dir}(${count}篇)`)
          .join('、');
        variables['content_directions'] = directionsText;
      }

      // 达人层级分布（按粉丝量分层）
      const notes = await this.prisma.note.findMany({
        where: { projectId },
        select: { kolFanNum: true },
      });

      const tierCountMap = new Map<string, number>();
      for (const note of notes) {
        const tier = classifyTier(note.kolFanNum ?? 0);
        tierCountMap.set(tier, (tierCountMap.get(tier) ?? 0) + 1);
      }
      if (tierCountMap.size > 0) {
        const tierText = Array.from(tierCountMap.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([tier, count]) => `${tier}(${count}篇)`)
          .join('、');
        variables['kol_tier_distribution'] = tierText;
      }
    } catch (error) {
      console.warn(`[ProjectReviewDataLoader] Failed to load notes/annotations: ${error}`);
    }

    return this.buildContext(variables);
  }
}

/**
 * 简单的达人层级分类（与 kol-tier.ts 保持一致）
 */
function classifyTier(fanCount: number): string {
  if (fanCount >= 500000) return '头部';
  if (fanCount >= 100000) return '腰部';
  if (fanCount >= 50000) return '腰尾部';
  if (fanCount >= 10000) return '尾部';
  return 'KOC';
}
