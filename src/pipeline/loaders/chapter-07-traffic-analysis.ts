import { PrismaClient } from '../../../generated/prisma';
import { BaseChapterDataLoader, ChapterDataContext } from './types';

/**
 * Chapter 7 (Traffic Analysis) Data Loader
 * Loads paid traffic metrics (totalFee, totalImpression, totalClick, totalInteraction,
 * iUserNum, tiUserNum, derived CPM/CPC/CPE/CTR) from juguang_data.
 */
export class TrafficAnalysisDataLoader extends BaseChapterDataLoader {
  chapterNumber = 7;
  chapterName = '投流分析';
  requiredDataSources = ['juguang_data'];
  requiredFields = [
    'total_fee', 'total_impression', 'total_click', 'total_interaction',
    'total_i_user_num', 'total_ti_user_num',
    'paid_cpm', 'paid_cpc', 'paid_cpe', 'paid_ctr',
  ];

  constructor(prisma: InstanceType<typeof PrismaClient>) {
    super(prisma);
  }

  async load(projectId: string): Promise<ChapterDataContext> {
    const variables: Record<string, string> = {};

    try {
      const juguangData = await this.prisma.juguangData.findMany({
        where: { projectId },
        select: {
          fee: true,
          impression: true,
          click: true,
          interaction: true,
          iUserNum: true,
          tiUserNum: true,
        },
      });

      if (juguangData.length > 0) {
        const totalFee = juguangData.reduce((sum, j) => sum + Number(j.fee), 0);
        const totalImpression = juguangData.reduce((sum, j) => sum + j.impression, 0);
        const totalClick = juguangData.reduce((sum, j) => sum + j.click, 0);
        const totalInteraction = juguangData.reduce((sum, j) => sum + j.interaction, 0);
        const totalIUserNum = juguangData.reduce((sum, j) => sum + j.iUserNum, 0);
        const totalTiUserNum = juguangData.reduce((sum, j) => sum + j.tiUserNum, 0);

        variables['total_fee'] = totalFee.toFixed(2);
        variables['total_impression'] = String(totalImpression);
        variables['total_click'] = String(totalClick);
        variables['total_interaction'] = String(totalInteraction);
        variables['total_i_user_num'] = String(totalIUserNum);
        variables['total_ti_user_num'] = String(totalTiUserNum);

        // Derived metrics
        variables['paid_cpm'] = totalImpression > 0 ? ((totalFee / totalImpression) * 1000).toFixed(2) : '0';
        variables['paid_cpc'] = totalClick > 0 ? (totalFee / totalClick).toFixed(2) : '0';
        variables['paid_cpe'] = totalInteraction > 0 ? (totalFee / totalInteraction).toFixed(2) : '0';
        variables['paid_ctr'] = totalImpression > 0 ? ((totalClick / totalImpression) * 100).toFixed(2) : '0';
      }
    } catch (error) {
      console.warn(`[TrafficAnalysisDataLoader] Failed to load juguang_data: ${error}`);
    }

    return this.buildContext(variables);
  }
}
