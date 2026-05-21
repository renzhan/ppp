import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { renderModuleCharts } from '@/export/chart-renderer';
import { loadTemplate } from '@/export/template-engine';
import { exportToPDF } from '@/export/pdf-exporter';
import { exportToWord } from '@/export/word-exporter';
import type {
  ReportContent,
  ReportModule,
  ModuleStatus,
} from '@/export/types';
import type { ChartImage } from '@/export/chart-renderer';

/**
 * POST /api/export/[versionId]
 *
 * Export report as PDF or Word (DOCX).
 * Pipeline: Load data → ChartRenderer → TemplateEngine → ExportEngine → file download
 *
 * Request body:
 *   - format: 'pdf' | 'docx' (required)
 *   - templateId?: string (optional, falls back to default template)
 *
 * Success: Binary file download with Content-Disposition header
 * Error: JSON response with { error, retryable } fields
 *
 * Requirements: 1.1, 1.5, 2.2
 */
export async function POST(
  request: Request,
  { params }: { params: { versionId: string } },
) {
  try {
    const { versionId } = params;

    // Parse request body
    let body: { format?: string; templateId?: string } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body', retryable: false },
        { status: 400 },
      );
    }

    const { format, templateId } = body;

    // Validate format parameter
    if (!format || !['pdf', 'docx'].includes(format)) {
      return NextResponse.json(
        { error: 'format must be "pdf" or "docx"', retryable: false },
        { status: 400 },
      );
    }

    // Step 1: Load ReportVersion + ModuleDecisions + ReviewEdits
    const version = await prisma.reportVersion.findUnique({
      where: { id: versionId },
      include: {
        project: true,
        moduleDecisions: {
          orderBy: { moduleId: 'asc' },
        },
        reviewEdits: true,
      },
    });

    if (!version) {
      return NextResponse.json(
        { error: '报告版本不存在', retryable: false },
        { status: 404 },
      );
    }

    const reportContentRaw = version.content as Record<string, unknown>;

    // Build hidden columns map from ReviewEdits (editType = 'column_hide')
    const hiddenColumns: Record<string, string[]> = {};
    for (const edit of version.reviewEdits) {
      if (edit.editType === 'column_hide' && edit.newContent) {
        const content = edit.newContent as Record<string, unknown>;
        const columnKey = content.columnKey as string | undefined;
        if (columnKey) {
          if (!hiddenColumns[edit.moduleId]) {
            hiddenColumns[edit.moduleId] = [];
          }
          hiddenColumns[edit.moduleId].push(columnKey);
        }
      }
    }

    // Build ReportContent structure from version data
    const modules: ReportModule[] = version.moduleDecisions.map((decision) => {
      const moduleData = reportContentRaw[decision.moduleId] as Record<string, unknown> | undefined;

      // Extract narrative text
      let narrative: string | undefined;
      if (moduleData) {
        if (typeof moduleData.narrative === 'string') {
          narrative = moduleData.narrative;
        } else if (Array.isArray(moduleData.paragraphs)) {
          narrative = (moduleData.paragraphs as Array<{ content?: string }>)
            .map((p) => p.content || '')
            .filter(Boolean)
            .join('\n\n');
        }
      }

      // Extract tables
      const tables = moduleData?.tables as ReportModule['tables'] | undefined;

      return {
        moduleId: decision.moduleId,
        title: decision.moduleName,
        status: decision.status as ModuleStatus,
        narrative,
        tables,
      };
    });

    const reportContent: ReportContent = {
      metadata: {
        projectName: version.project.projectName,
        brand: version.project.brand,
        category: version.project.category,
        projectType: version.project.projectType,
        generatedAt: version.generatedAt,
      },
      modules,
    };

    // Step 2: Render charts for visible modules
    const charts: ChartImage[] = [];
    for (const module of modules) {
      if (module.status === 'hide') continue;

      const moduleData = reportContentRaw[module.moduleId] as Record<string, unknown> | undefined;
      if (moduleData) {
        try {
          const moduleCharts = await renderModuleCharts(module.moduleId, moduleData);
          charts.push(...moduleCharts);
        } catch {
          // Skip chart rendering failures per error handling spec
          continue;
        }
      }
    }

    // Step 3: Load template configuration
    const template = await loadTemplate(templateId);

    // Step 4: Generate export file
    let buffer: Buffer;
    let mimeType: string;
    let fileExtension: string;

    if (format === 'pdf') {
      buffer = await exportToPDF(reportContent, charts, template, { hiddenColumns });
      mimeType = 'application/pdf';
      fileExtension = 'pdf';
    } else {
      buffer = await exportToWord(reportContent, charts, template, { hiddenColumns });
      mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      fileExtension = 'docx';
    }

    // Step 5: Return file download response
    const filename = `${version.project.projectName}_v${version.versionNumber}.${fileExtension}`;
    const uint8 = new Uint8Array(buffer);

    return new NextResponse(uint8, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': String(uint8.byteLength),
      },
    });
  } catch (error) {
    console.error('POST /api/export/[versionId] error:', error);

    const message = error instanceof Error ? error.message : 'Export generation failed';

    // Determine if the error is retryable
    const retryable = isRetryableError(error);

    return NextResponse.json(
      { error: message, retryable },
      { status: 500 },
    );
  }
}

/**
 * Determine if an export error is retryable.
 * Timeout errors and transient failures are retryable.
 * Validation errors and missing data are not.
 */
function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return true;

  const message = error.message.toLowerCase();

  // Non-retryable: data not found, validation errors
  if (message.includes('不存在') || message.includes('not found')) {
    return false;
  }
  if (message.includes('invalid') || message.includes('must be')) {
    return false;
  }

  // Retryable: timeouts, generation failures
  if (message.includes('超时') || message.includes('timeout')) {
    return true;
  }

  // Default to retryable for unknown errors
  return true;
}
