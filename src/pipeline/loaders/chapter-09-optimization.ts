import { PrismaClient } from '../../../generated/prisma';
import { BaseChapterDataLoader, ChapterDataContext } from './types';

/**
 * Chapter 9 (Optimization Suggestions) Data Loader
 * Loads underperforming data for optimization recommendations.
 */
export class OptimizationDataLoader extends BaseChapterDataLoader {
  chapterNumber = 9;
  chapterName = '优化建议';
  requiredDataSources = ['notes', 'kpi_targets', 'business_annotations', 'juguang_data'];
  requiredFields = ['underperforming_metrics', 'content_direction_performance', 'traffic_efficiency'];

  constructor(prisma: InstanceType<typeof PrismaClient>) {
    super(prisma);
  }

  async load(projectId: string): Promise<ChapterDataContext> {
    const variables: Record<string, string> = {};

    try {
      // Load notes for aggregation
      const notes = await this.prisma.note.findMany({
        where: { projectId },
        select: {
          noteId: true,
          impNum: true,
          readNum: true,
          engageNum: true,
          kolPrice: true,
          serviceFee: true,
        },
      });

      // Load KPI targets
      const kpiTargets = await this.prisma.kpiTarget.findMany({
        where: { projectId },
        select: { metricName: true, targetValue: true },
      });

      if (notes.length > 0 && kpiTargets.length > 0) {
        const totalImpressions = notes.reduce((sum, n) => sum + n.impNum, 0);
        const totalReads = notes.reduce((sum, n) => sum + n.readNum, 0);
        const totalEngagement = notes.reduce((sum, n) => sum + n.engageNum, 0);

        const targetMap = new Map(kpiTargets.map((k) => [k.metricName, Number(k.targetValue)]));

        // Find underperforming metrics (completion < 100%)
        const underperforming: Array<{ metric: string; actual: number; target: number; completion: string }> = [];

        const impressionTarget = targetMap.get('impression');
        if (impressionTarget && totalImpressions < impressionTarget) {
          underperforming.push({ metric: '曝光', actual: totalImpressions, target: impressionTarget, completion: ((totalImpressions / impressionTarget) * 100).toFixed(1) });
        }
        const readTarget = targetMap.get('read');
        if (readTarget && totalReads < readTarget) {
          underperforming.push({ metric: '阅读', actual: totalReads, target: readTarget, completion: ((totalReads / readTarget) * 100).toFixed(1) });
        }
        const engagementTarget = targetMap.get('engagement');
        if (engagementTarget && totalEngagement < engagementTarget) {
          underperforming.push({ metric: '互动', actual: totalEngagement, target: engagementTarget, completion: ((totalEngagement / engagementTarget) * 100).toFixed(1) });
        }

        if (underperforming.length > 0) {
          variables['underperforming_metrics'] = JSON.stringify(underperforming);
        }
      }
    } catch (error) {
      console.warn(`[OptimizationDataLoader] Failed to load notes/kpi data: ${error}`);
    }

    try {
      // Load content direction performance
      const notes = await this.prisma.note.findMany({
        where: { projectId },
        select: { noteId: true, engageNum: true, kolPrice: true, serviceFee: true },
      });

      const annotations = await this.prisma.businessAnnotation.findMany({
        where: { projectId },
        select: { noteId: true, contentDirection: true },
      });

      if (notes.length > 0 && annotations.length > 0) {
        const annotationMap = new Map(annotations.map((a) => [a.noteId, a]));
        const byDirection = new Map<string, { count: number; engage: number; cost: number }>();

        for (const note of notes) {
          const annotation = annotationMap.get(note.noteId);
          const direction = annotation?.contentDirection || '未分类';
          const cost = Number(note.kolPrice) + Number(note.serviceFee);

          if (!byDirection.has(direction)) {
            byDirection.set(direction, { count: 0, engage: 0, cost: 0 });
          }
          const group = byDirection.get(direction)!;
          group.count++;
          group.engage += note.engageNum;
          group.cost += cost;
        }

        const directionPerformance = Array.from(byDirection.entries()).map(([name, data]) => ({
          name,
          count: data.count,
          avgEngagement: data.count > 0 ? (data.engage / data.count).toFixed(0) : '0',
          cpe: data.engage > 0 ? (data.cost / data.engage).toFixed(2) : '0',
        }));

        variables['content_direction_performance'] = JSON.stringify(directionPerformance);
      }
    } catch (error) {
      console.warn(`[OptimizationDataLoader] Failed to load content direction data: ${error}`);
    }

    try {
      // Load traffic efficiency
      const juguangData = await this.prisma.juguangData.findMany({
        where: { projectId },
        select: { fee: true, impression: true, click: true, interaction: true },
      });

      if (juguangData.length > 0) {
        const totalFee = juguangData.reduce((sum, j) => sum + Number(j.fee), 0);
        const totalClick = juguangData.reduce((sum, j) => sum + j.click, 0);
        const totalInteraction = juguangData.reduce((sum, j) => sum + j.interaction, 0);

        variables['traffic_efficiency'] = JSON.stringify({
          totalFee: totalFee.toFixed(2),
          totalNotes: juguangData.length,
          avgCpc: totalClick > 0 ? (totalFee / totalClick).toFixed(2) : '0',
          avgCpe: totalInteraction > 0 ? (totalFee / totalInteraction).toFixed(2) : '0',
        });
      }
    } catch (error) {
      console.warn(`[OptimizationDataLoader] Failed to load juguang_data: ${error}`);
    }

    return this.buildContext(variables);
  }
}
