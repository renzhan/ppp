import { PrismaClient } from '../../../generated/prisma';
import { BaseChapterDataLoader, ChapterDataContext, TraceItem } from './types';

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

    // 构建溯源数据 — 展示灵犀原始数据
    const traceItems: TraceItem[] = [];

    // 获取灵犀原始记录用于溯源
    let lingxiRawRows: Record<string, unknown>[] = [];
    try {
      const allLingxi = await this.prisma.lingxiData.findMany({
        where: { projectId, dataType: 'aips' },
        select: { dataContent: true, periodStart: true, periodEnd: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      });
      lingxiRawRows = allLingxi.map(r => ({
        periodStart: r.periodStart?.toISOString().split('T')[0] || '-',
        periodEnd: r.periodEnd?.toISOString().split('T')[0] || '-',
        dataContent: JSON.stringify(r.dataContent),
        createdAt: r.createdAt?.toISOString().split('T')[0] || '-',
      }));
    } catch { /* already loaded above */ }

    if (lingxiRawRows.length > 0) {
      traceItems.push({
        traceId: 'ch8_aips_population',
        chapterNumber: 8,
        label: 'AIPS人群数据(灵犀原始)',
        sourceTable: 'lingxi_data',
        sourceQuery: `SELECT data_content, period_start, period_end, created_at FROM lingxi_data WHERE project_id = '${projectId}' AND data_type = 'aips' ORDER BY created_at DESC;`,
        totalRows: lingxiRawRows.length,
        columns: [
          { key: 'periodStart', label: '周期开始', type: 'date' },
          { key: 'periodEnd', label: '周期结束', type: 'date' },
          { key: 'dataContent', label: '原始数据(JSON)', type: 'string' },
          { key: 'createdAt', label: '录入时间', type: 'date' },
        ],
        dataRows: lingxiRawRows,
        calculations: variables['aips_flow_rates'] ? [
          { metric: '流转率计算', formula: '(当期值 - 上期值) / 上期值 * 100', inputs: { '数据周期数': lingxiRawRows.length }, result: '按各层级分别计算增长率' },
        ] : undefined,
      });
    }

    return this.buildContext(variables, traceItems);
  }
}
