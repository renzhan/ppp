import { PrismaClient } from '../../../generated/prisma';
import { BaseChapterDataLoader, ChapterDataContext } from './types';

/**
 * Chapter 3 (Data Overview) Data Loader
 * Loads aggregated metrics (totalImpressions, totalReads, totalEngagement, totalCost,
 * viralCount, viralRate, cpm, cpc, cpe, ctr) and KPI completion rates
 * from notes, juguang_data, kpi_targets.
 */
export class DataOverviewDataLoader extends BaseChapterDataLoader {
  chapterNumber = 3;
  chapterName = '数据总览';
  requiredDataSources = ['notes', 'juguang_data', 'kpi_targets', 'review_configs'];
  requiredFields = [
    'note_count', 'total_impressions', 'total_reads', 'total_engagement',
    'total_cost', 'viral_count', 'viral_rate', 'cpm', 'cpc', 'cpe', 'ctr',
    'impression_completion', 'read_completion', 'engagement_completion',
    'project_name', 'brand',
  ];

  constructor(prisma: InstanceType<typeof PrismaClient>) {
    super(prisma);
  }

  async load(projectId: string): Promise<ChapterDataContext> {
    const variables: Record<string, string> = {};

    try {
      // Load project info
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { projectName: true, brand: true },
      });
      if (project) {
        if (project.projectName) variables['project_name'] = project.projectName;
        if (project.brand) variables['brand'] = project.brand;
      }
    } catch (error) {
      console.warn(`[DataOverviewDataLoader] Failed to load project: ${error}`);
    }

    try {
      // Load notes and aggregate metrics
      const notes = await this.prisma.note.findMany({
        where: { projectId },
        select: {
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

      if (notes.length > 0) {
        const totalImpressions = notes.reduce((sum, n) => sum + n.impNum, 0);
        const totalReads = notes.reduce((sum, n) => sum + n.readNum, 0);
        const totalEngagement = notes.reduce((sum, n) => sum + n.engageNum, 0);
        const totalCost = notes.reduce((sum, n) => sum + Number(n.kolPrice) + Number(n.serviceFee), 0);

        // Viral notes: readNum >= 1000 (common threshold for XHS)
        const viralThreshold = 1000;
        const viralCount = notes.filter((n) => n.readNum >= viralThreshold).length;
        const viralRate = notes.length > 0 ? (viralCount / notes.length) * 100 : 0;

        variables['note_count'] = String(notes.length);
        variables['total_impressions'] = String(totalImpressions);
        variables['total_reads'] = String(totalReads);
        variables['total_engagement'] = String(totalEngagement);
        variables['total_cost'] = totalCost.toFixed(2);
        variables['viral_count'] = String(viralCount);
        variables['viral_rate'] = viralRate.toFixed(1);

        // Derived metrics
        if (totalCost > 0) {
          variables['cpm'] = totalImpressions > 0 ? ((totalCost / totalImpressions) * 1000).toFixed(2) : '0';
          variables['cpc'] = totalReads > 0 ? (totalCost / totalReads).toFixed(2) : '0';
          variables['cpe'] = totalEngagement > 0 ? (totalCost / totalEngagement).toFixed(2) : '0';
        } else {
          variables['cpm'] = '0';
          variables['cpc'] = '0';
          variables['cpe'] = '0';
        }
        variables['ctr'] = totalImpressions > 0 ? ((totalReads / totalImpressions) * 100).toFixed(2) : '0';
      }
    } catch (error) {
      console.warn(`[DataOverviewDataLoader] Failed to load notes: ${error}`);
    }

    try {
      // Load KPI targets for completion rates
      const kpiTargets = await this.prisma.kpiTarget.findMany({
        where: { projectId },
        select: { metricName: true, targetValue: true },
      });

      if (kpiTargets.length > 0) {
        const targetMap = new Map(kpiTargets.map((k) => [k.metricName, Number(k.targetValue)]));

        const impressionTarget = targetMap.get('impression');
        const readTarget = targetMap.get('read');
        const engagementTarget = targetMap.get('engagement');

        const totalImpressions = Number(variables['total_impressions'] || '0');
        const totalReads = Number(variables['total_reads'] || '0');
        const totalEngagement = Number(variables['total_engagement'] || '0');

        if (impressionTarget && impressionTarget > 0) {
          variables['impression_completion'] = ((totalImpressions / impressionTarget) * 100).toFixed(1);
        }
        if (readTarget && readTarget > 0) {
          variables['read_completion'] = ((totalReads / readTarget) * 100).toFixed(1);
        }
        if (engagementTarget && engagementTarget > 0) {
          variables['engagement_completion'] = ((totalEngagement / engagementTarget) * 100).toFixed(1);
        }
      }
    } catch (error) {
      console.warn(`[DataOverviewDataLoader] Failed to load kpi_targets: ${error}`);
    }

    return this.buildContext(variables);
  }
}
