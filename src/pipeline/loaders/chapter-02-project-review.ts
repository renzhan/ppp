import { PrismaClient } from '../../../generated/prisma';
import { BaseChapterDataLoader, ChapterDataContext } from './types';

/**
 * Chapter 2 (Project Review) Data Loader
 * Loads plan_parse from ai_generated_content and launchPhases from review_configs.
 */
export class ProjectReviewDataLoader extends BaseChapterDataLoader {
  chapterNumber = 2;
  chapterName = '项目回顾';
  requiredDataSources = ['ai_generated_content', 'review_configs'];
  requiredFields = ['project_objective', 'strategy', 'target_audience', 'core_message', 'launch_phases'];

  constructor(prisma: InstanceType<typeof PrismaClient>) {
    super(prisma);
  }

  async load(projectId: string): Promise<ChapterDataContext> {
    const variables: Record<string, string> = {};

    try {
      // Load plan_parse from ai_generated_content
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

    try {
      // Load launchPhases from review_configs
      const reviewConfig = await this.prisma.reviewConfig.findFirst({
        where: { projectId },
        select: { launchPhases: true },
        orderBy: { createdAt: 'desc' },
      });

      if (reviewConfig && reviewConfig.launchPhases) {
        const phases = reviewConfig.launchPhases;
        if (Array.isArray(phases) && phases.length > 0) {
          variables['launch_phases'] = JSON.stringify(phases);
        }
      }
    } catch (error) {
      console.warn(`[ProjectReviewDataLoader] Failed to load review_configs: ${error}`);
    }

    return this.buildContext(variables);
  }
}
