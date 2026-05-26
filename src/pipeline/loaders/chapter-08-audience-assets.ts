import { PrismaClient } from '../../../generated/prisma';
import { BaseChapterDataLoader, ChapterDataContext } from './types';

/**
 * Chapter 8 (Audience Assets) Data Loader
 * Loads AIPS population data and flow rates from lingxi_data where dataType='aips'.
 */
export class AudienceAssetsDataLoader extends BaseChapterDataLoader {
  chapterNumber = 8;
  chapterName = '人群资产';
  requiredDataSources = ['lingxi_data'];
  requiredFields = ['aips_awareness', 'aips_interest', 'aips_purchase', 'aips_share', 'aips_flow_rates'];

  constructor(prisma: InstanceType<typeof PrismaClient>) {
    super(prisma);
  }

  async load(projectId: string): Promise<ChapterDataContext> {
    const variables: Record<string, string> = {};

    try {
      const lingxiData = await this.prisma.lingxiData.findMany({
        where: { projectId, dataType: 'aips' },
        select: { dataContent: true, periodStart: true, periodEnd: true },
        orderBy: { createdAt: 'desc' },
      });

      if (lingxiData.length > 0) {
        // Use the most recent AIPS data
        const latestData = lingxiData[0];
        const content = latestData.dataContent as Record<string, unknown>;

        if (content.awareness !== undefined) variables['aips_awareness'] = String(content.awareness);
        if (content.interest !== undefined) variables['aips_interest'] = String(content.interest);
        if (content.purchase !== undefined) variables['aips_purchase'] = String(content.purchase);
        if (content.share !== undefined) variables['aips_share'] = String(content.share);

        // Calculate flow rates if multiple periods exist
        if (lingxiData.length >= 2) {
          const previousData = lingxiData[1].dataContent as Record<string, unknown>;
          const flowRates: Record<string, string> = {};

          const calcFlowRate = (current: unknown, previous: unknown): string => {
            const curr = Number(current) || 0;
            const prev = Number(previous) || 0;
            if (prev === 0) return '0';
            return (((curr - prev) / prev) * 100).toFixed(1);
          };

          flowRates['awareness_growth'] = calcFlowRate(content.awareness, previousData.awareness);
          flowRates['interest_growth'] = calcFlowRate(content.interest, previousData.interest);
          flowRates['purchase_growth'] = calcFlowRate(content.purchase, previousData.purchase);
          flowRates['share_growth'] = calcFlowRate(content.share, previousData.share);

          variables['aips_flow_rates'] = JSON.stringify(flowRates);
        } else {
          // Single period - no flow rates available
          variables['aips_flow_rates'] = JSON.stringify({
            awareness_growth: '0',
            interest_growth: '0',
            purchase_growth: '0',
            share_growth: '0',
          });
        }
      }
    } catch (error) {
      console.warn(`[AudienceAssetsDataLoader] Failed to load lingxi_data: ${error}`);
    }

    return this.buildContext(variables);
  }
}
