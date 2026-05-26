import { PrismaClient } from '../../../generated/prisma';
import { BaseChapterDataLoader, ChapterDataContext } from './types';

/**
 * Chapter 10 (End Page) Data Loader
 * Loads project dates for the closing page.
 */
export class EndPageDataLoader extends BaseChapterDataLoader {
  chapterNumber = 10;
  chapterName = '尾页';
  requiredDataSources = ['projects'];
  requiredFields = ['start_date', 'end_date'];

  constructor(prisma: InstanceType<typeof PrismaClient>) {
    super(prisma);
  }

  async load(projectId: string): Promise<ChapterDataContext> {
    const variables: Record<string, string> = {};

    try {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: {
          startDate: true,
          endDate: true,
        },
      });

      if (project) {
        if (project.startDate) variables['start_date'] = project.startDate.toISOString().split('T')[0];
        if (project.endDate) variables['end_date'] = project.endDate.toISOString().split('T')[0];
      }
    } catch (error) {
      console.warn(`[EndPageDataLoader] Failed to load project dates: ${error}`);
    }

    return this.buildContext(variables);
  }
}
