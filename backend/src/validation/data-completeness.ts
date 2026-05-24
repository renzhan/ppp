/**
 * Data Completeness Validator
 *
 * Checks the upload status of 5 data sources for a given project
 * and calculates an overall completeness percentage.
 *
 * Data sources:
 * - 执行底表 (notes)
 * - 广告投放底表 (juguangData)
 * - 外部平台数据 (lingxiData)
 * - KPI目标值 (kpiTargets)
 * - Benchmark数据 (manualInputs where inputType = 'benchmark')
 */

import { getPrismaClient } from '../shared/db.js';

export interface DataSourceStatus {
  source: string;               // 'execution' | 'ad_spend' | 'external' | 'kpi' | 'benchmark'
  label: string;                // 中文标签
  status: 'uploaded' | 'not_uploaded' | 'partial';
  recordCount?: number;
  uploadPath: string;           // 跳转路径
}

export interface CompletenessResult {
  sources: DataSourceStatus[];
  percentage: number;           // 0-100
  canGenerate: boolean;         // percentage >= 50
}

interface DataSourceConfig {
  source: string;
  table: string;
  label: string;
  filter?: Record<string, unknown>;
  uploadPath: string;
}

const DATA_SOURCES: DataSourceConfig[] = [
  {
    source: 'execution',
    table: 'note',
    label: '执行底表',
    uploadPath: '/projects/{projectId}/upload?tab=execution',
  },
  {
    source: 'ad_spend',
    table: 'juguangData',
    label: '广告投放底表',
    uploadPath: '/projects/{projectId}/upload?tab=ad-spend',
  },
  {
    source: 'external',
    table: 'lingxiData',
    label: '外部平台数据',
    uploadPath: '/projects/{projectId}/upload?tab=external',
  },
  {
    source: 'kpi',
    table: 'kpiTarget',
    label: 'KPI目标值',
    uploadPath: '/projects/{projectId}/upload?tab=manual&type=kpi',
  },
  {
    source: 'benchmark',
    table: 'manualInput',
    label: 'Benchmark数据',
    filter: { inputType: 'benchmark' },
    uploadPath: '/projects/{projectId}/upload?tab=manual&type=benchmark',
  },
];

/**
 * Check data completeness for a project.
 * Queries each of the 5 data sources and returns their upload status.
 *
 * @param projectId - The UUID of the project to check
 * @returns CompletenessResult with source statuses, percentage, and canGenerate flag
 */
export async function checkDataCompleteness(projectId: string): Promise<CompletenessResult> {
  const prisma = getPrismaClient();

  const sources: DataSourceStatus[] = await Promise.all(
    DATA_SOURCES.map(async (config) => {
      const count = await countRecords(prisma, config, projectId);
      const status = count > 0 ? 'uploaded' : 'not_uploaded';
      const uploadPath = config.uploadPath.replace('{projectId}', projectId);

      return {
        source: config.source,
        label: config.label,
        status,
        recordCount: count,
        uploadPath,
      };
    })
  );

  const uploadedCount = sources.filter((s) => s.status === 'uploaded').length;
  const percentage = Math.round((uploadedCount / DATA_SOURCES.length) * 100);
  const canGenerate = percentage >= 50;

  return {
    sources,
    percentage,
    canGenerate,
  };
}

/**
 * Count records for a specific data source.
 * Handles the special case of manualInputs with a filter on inputType.
 */
async function countRecords(
  prisma: ReturnType<typeof getPrismaClient>,
  config: DataSourceConfig,
  projectId: string
): Promise<number> {
  const where: Record<string, unknown> = { projectId };

  if (config.filter) {
    Object.assign(where, config.filter);
  }

  // Use dynamic model access via prisma[table].count()
  const model = prisma[config.table as keyof typeof prisma] as unknown as {
    count: (args: { where: Record<string, unknown> }) => Promise<number>;
  };

  return model.count({ where });
}
