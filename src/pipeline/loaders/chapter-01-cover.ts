import { PrismaClient } from '../../../generated/prisma';
import { BaseChapterDataLoader, ChapterDataContext } from './types';

/**
 * Chapter 1 (项目管理 / Cover) Data Loader
 *
 * 按字段映射表收集数据，涉及以下表：
 * - projects: 品类、合作品牌、品牌业务线、项目名称、投放时间
 * - review_configs: 大盘均值（CTR/CPM/CPC/CPE）、互动率口径
 */
export class CoverDataLoader extends BaseChapterDataLoader {
  chapterNumber = 1;
  chapterName = '项目管理';
  requiredDataSources = ['projects', 'review_configs'];
  requiredFields = [
    'category', 'brand', 'business_line', 'project_name', 'start_date', 'end_date',
    'benchmark_ctr', 'benchmark_cpm', 'benchmark_cpc', 'benchmark_cpe',
    'engagement_metric',
  ];

  constructor(prisma: InstanceType<typeof PrismaClient>) {
    super(prisma);
  }

  async load(projectId: string): Promise<ChapterDataContext> {
    const variables: Record<string, string> = {};

    // ── 1. 项目基本信息 (projects) ──
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

    // ── 2. 复盘配置 (review_configs) → 大盘均值、互动率口径 ──
    try {
      const reviewConfig = await this.prisma.reviewConfig.findFirst({
        where: { projectId },
        select: {
          benchmark: true,
          engagementMetric: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (reviewConfig) {
        // 互动率口径
        if (reviewConfig.engagementMetric) {
          variables['engagement_metric'] = reviewConfig.engagementMetric as string;
        }

        // 大盘均值
        const benchmark = reviewConfig.benchmark as Record<string, number> | null;
        if (benchmark) {
          if (benchmark['ctr'] !== undefined) variables['benchmark_ctr'] = String(benchmark['ctr']);
          if (benchmark['cpm'] !== undefined) variables['benchmark_cpm'] = String(benchmark['cpm']);
          if (benchmark['cpc'] !== undefined) variables['benchmark_cpc'] = String(benchmark['cpc']);
          if (benchmark['cpe'] !== undefined) variables['benchmark_cpe'] = String(benchmark['cpe']);
        }
      }
    } catch (error) {
      console.warn(`[CoverDataLoader] Failed to load review_configs: ${error}`);
    }

    return this.buildContext(variables);
  }
}
