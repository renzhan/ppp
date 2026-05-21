import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { transitionStatus } from '@/project/status-machine';

const VALID_INPUT_TYPES = ['kpi_targets', 'benchmark', 'brand_search_index', 'topic_exposure'] as const;
type InputType = (typeof VALID_INPUT_TYPES)[number];

/**
 * POST /api/upload/manual
 * Manual data input (人工录入: KPI目标值, 大盘Benchmark, 品牌搜索指数, 话题曝光量).
 *
 * Accepts JSON body with:
 *   - projectId: UUID of the project
 *   - inputType: 'kpi_targets' | 'benchmark' | 'brand_search_index' | 'topic_exposure'
 *   - data: object containing the input data
 *
 * For inputType 'kpi_targets', data should be:
 *   { metrics: [{ metricName: string, targetValue: number, isCostMetric?: boolean }] }
 *
 * For other inputTypes, data is stored as JSON in ManualInput table.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectId, inputType, data } = body;

    // Validate required fields
    const missingFields: Record<string, string> = {};
    if (!projectId) missingFields.projectId = 'projectId is required';
    if (!inputType) missingFields.inputType = 'inputType is required';
    if (!data || typeof data !== 'object') missingFields.data = 'data is required and must be an object';

    if (Object.keys(missingFields).length > 0) {
      return NextResponse.json(
        { error: 'Missing required fields', fields: missingFields },
        { status: 400 }
      );
    }

    // Validate inputType
    if (!VALID_INPUT_TYPES.includes(inputType as InputType)) {
      return NextResponse.json(
        {
          error: `Invalid inputType: "${inputType}"`,
          fields: { inputType: `inputType must be one of: ${VALID_INPUT_TYPES.join(', ')}` },
        },
        { status: 400 }
      );
    }

    // Verify project exists
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    let successCount = 0;
    let failedCount = 0;
    const errors: { row: number; column: string; reason: string }[] = [];

    if (inputType === 'kpi_targets') {
      // KPI targets are stored in the KpiTarget table
      const metrics = data.metrics;
      if (!Array.isArray(metrics) || metrics.length === 0) {
        return NextResponse.json(
          {
            error: 'data.metrics must be a non-empty array',
            fields: { data: 'data.metrics must be a non-empty array of { metricName, targetValue, isCostMetric? }' },
          },
          { status: 400 }
        );
      }

      for (let i = 0; i < metrics.length; i++) {
        const metric = metrics[i];
        if (!metric.metricName || typeof metric.metricName !== 'string') {
          errors.push({ row: i + 1, column: 'metricName', reason: 'metricName is required and must be a string' });
          failedCount++;
          continue;
        }
        if (metric.targetValue === undefined || metric.targetValue === null || typeof metric.targetValue !== 'number') {
          errors.push({ row: i + 1, column: 'targetValue', reason: 'targetValue is required and must be a number' });
          failedCount++;
          continue;
        }

        try {
          await prisma.kpiTarget.upsert({
            where: {
              projectId_metricName: {
                projectId,
                metricName: metric.metricName,
              },
            },
            create: {
              projectId,
              metricName: metric.metricName,
              targetValue: metric.targetValue,
              isCostMetric: metric.isCostMetric ?? false,
            },
            update: {
              targetValue: metric.targetValue,
              isCostMetric: metric.isCostMetric ?? false,
            },
          });
          successCount++;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push({ row: i + 1, column: 'metricName', reason: `Failed to save: ${message}` });
          failedCount++;
        }
      }
    } else {
      // Other input types are stored in the ManualInput table
      try {
        await prisma.manualInput.create({
          data: {
            projectId,
            inputType,
            dataContent: data as object,
          },
        });
        successCount = 1;
        // Trigger status transition: draft → uploading (silently ignored if already past draft)
        await transitionStatus(projectId, 'first_upload');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json(
          { error: `Failed to persist data: ${message}` },
          { status: 500 }
        );
      }
    }

    // For KPI targets, trigger status transition after successful saves
    if (inputType === 'kpi_targets' && successCount > 0) {
      await transitionStatus(projectId, 'first_upload');
    }

    return NextResponse.json({
      success: successCount,
      failed: failedCount,
      errors,
    });
  } catch (error) {
    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }
    console.error('POST /api/upload/manual error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
