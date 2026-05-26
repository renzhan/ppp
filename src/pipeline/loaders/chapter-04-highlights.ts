import { PrismaClient } from '../../../generated/prisma';
import { BaseChapterDataLoader, ChapterDataContext } from './types';

/**
 * Chapter 4 (Highlights) Data Loader
 * Loads KPI exceeded metrics, above-benchmark metrics, AIPS data, viral note details.
 */
export class HighlightsDataLoader extends BaseChapterDataLoader {
  chapterNumber = 4;
  chapterName = '项目亮点';
  requiredDataSources = ['notes', 'kpi_targets', 'lingxi_data', 'review_configs'];
  requiredFields = [
    'kpi_exceeded_metrics', 'above_benchmark_metrics',
    'aips_data', 'viral_notes_details',
  ];

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
          kolNickName: true,
          noteType: true,
          impNum: true,
          readNum: true,
          engageNum: true,
          likeNum: true,
          favNum: true,
          cmtNum: true,
          shareNum: true,
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

        // KPI exceeded metrics
        const exceededMetrics: Array<{ metric: string; actual: number; target: number; rate: string }> = [];
        const impressionTarget = targetMap.get('impression');
        if (impressionTarget && totalImpressions > impressionTarget) {
          exceededMetrics.push({ metric: '曝光', actual: totalImpressions, target: impressionTarget, rate: ((totalImpressions / impressionTarget) * 100).toFixed(1) });
        }
        const readTarget = targetMap.get('read');
        if (readTarget && totalReads > readTarget) {
          exceededMetrics.push({ metric: '阅读', actual: totalReads, target: readTarget, rate: ((totalReads / readTarget) * 100).toFixed(1) });
        }
        const engagementTarget = targetMap.get('engagement');
        if (engagementTarget && totalEngagement > engagementTarget) {
          exceededMetrics.push({ metric: '互动', actual: totalEngagement, target: engagementTarget, rate: ((totalEngagement / engagementTarget) * 100).toFixed(1) });
        }

        if (exceededMetrics.length > 0) {
          variables['kpi_exceeded_metrics'] = JSON.stringify(exceededMetrics);
        }

        // Viral notes (readNum >= 1000)
        const viralNotes = notes
          .filter((n) => n.readNum >= 1000)
          .map((n) => ({
            noteId: n.noteId,
            kolNickName: n.kolNickName,
            noteType: n.noteType,
            readNum: n.readNum,
            engageNum: n.engageNum,
          }));

        if (viralNotes.length > 0) {
          variables['viral_notes_details'] = JSON.stringify(viralNotes);
        }
      }
    } catch (error) {
      console.warn(`[HighlightsDataLoader] Failed to load notes/kpi data: ${error}`);
    }

    try {
      // Load benchmark data from review_configs
      const reviewConfig = await this.prisma.reviewConfig.findFirst({
        where: { projectId },
        select: { benchmark: true },
        orderBy: { createdAt: 'desc' },
      });

      if (reviewConfig && reviewConfig.benchmark) {
        const benchmark = reviewConfig.benchmark as Record<string, unknown>;
        if (Object.keys(benchmark).length > 0) {
          variables['above_benchmark_metrics'] = JSON.stringify(benchmark);
        }
      }
    } catch (error) {
      console.warn(`[HighlightsDataLoader] Failed to load benchmark: ${error}`);
    }

    try {
      // Load AIPS data from lingxi_data
      const lingxiData = await this.prisma.lingxiData.findFirst({
        where: { projectId, dataType: 'aips' },
        select: { dataContent: true },
        orderBy: { createdAt: 'desc' },
      });

      if (lingxiData && lingxiData.dataContent) {
        variables['aips_data'] = JSON.stringify(lingxiData.dataContent);
      }
    } catch (error) {
      console.warn(`[HighlightsDataLoader] Failed to load lingxi_data: ${error}`);
    }

    return this.buildContext(variables);
  }
}
