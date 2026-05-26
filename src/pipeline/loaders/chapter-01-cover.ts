import { PrismaClient } from '../../../generated/prisma';
import { BaseChapterDataLoader, ChapterDataContext } from './types';

/**
 * Chapter 1 (Cover) Data Loader
 * Loads project category, brand, businessLine, projectName, startDate, endDate.
 */
export class CoverDataLoader extends BaseChapterDataLoader {
  chapterNumber = 1;
  chapterName = '封面';
  requiredDataSources = ['projects'];
  requiredFields = ['category', 'brand', 'business_line', 'project_name', 'start_date', 'end_date'];

  constructor(prisma: InstanceType<typeof PrismaClient>) {
    super(prisma);
  }

  async load(projectId: string): Promise<ChapterDataContext> {
    const variables: Record<string, string> = {};

    try {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: {
          category: true,
          brand: true,
          businessLine: true,
          projectName: true,
          startDate: true,
          endDate: true,
        },
      });

      if (project) {
        if (project.category) variables['category'] = project.category;
        if (project.brand) variables['brand'] = project.brand;
        if (project.businessLine) variables['business_line'] = project.businessLine;
        if (project.projectName) variables['project_name'] = project.projectName;
        if (project.startDate) variables['start_date'] = project.startDate.toISOString().split('T')[0];
        if (project.endDate) variables['end_date'] = project.endDate.toISOString().split('T')[0];
      }
    } catch (error) {
      console.warn(`[CoverDataLoader] Failed to load project data: ${error}`);
    }

    return this.buildContext(variables);
  }
}
