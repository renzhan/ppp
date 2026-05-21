import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { transitionStatus } from '@/project/status-machine';

/**
 * Request body for confirming OCR results.
 */
interface ConfirmOCRRequest {
  projectId: string;
  dataType: 'aips' | 'brand_ranking' | 'soc_sov' | 'spu_ranking';
  data: Record<string, unknown>;
}

/**
 * POST /api/upload/ocr/confirm
 * Confirm and save OCR recognition results to the lingxi_data table.
 *
 * Accepts JSON body with:
 *   - projectId: UUID of the project
 *   - dataType: type of lingxi data (aips, brand_ranking, soc_sov, spu_ranking)
 *   - data: the confirmed/corrected data object
 *
 * The user may have corrected low-confidence fields before confirming.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ConfirmOCRRequest;

    const { projectId, dataType, data } = body;

    // Validate required fields
    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId 为必填项' },
        { status: 400 }
      );
    }
    if (!dataType) {
      return NextResponse.json(
        { error: 'dataType 为必填项' },
        { status: 400 }
      );
    }
    if (!data || typeof data !== 'object') {
      return NextResponse.json(
        { error: 'data 为必填项且必须为对象' },
        { status: 400 }
      );
    }

    // Validate dataType
    const validDataTypes = ['aips', 'brand_ranking', 'soc_sov', 'spu_ranking'];
    if (!validDataTypes.includes(dataType)) {
      return NextResponse.json(
        { error: `无效的 dataType，支持: ${validDataTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json(
        { error: '项目不存在' },
        { status: 404 }
      );
    }

    // Remove internal metadata fields (e.g., _fieldConfidences) before saving
    const cleanData = { ...data };
    delete cleanData['_fieldConfidences'];

    // Save to lingxi_data table
    const record = await prisma.lingxiData.create({
      data: {
        projectId,
        dataType,
        dataContent: cleanData as object,
      },
    });

    // Trigger status transition: draft → uploading (silently ignored if already past draft)
    await transitionStatus(projectId, 'first_upload');

    return NextResponse.json({
      success: true,
      id: record.id,
      projectId,
      dataType,
      message: '数据已保存',
    });
  } catch (error) {
    console.error('POST /api/upload/ocr/confirm error:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
