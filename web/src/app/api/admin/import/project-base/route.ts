import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import { isValidProjectBaseFile } from '@/lib/file-validation';

/**
 * Column header mapping: Chinese headers → field names
 * Supports multiple possible column names for each field (实际表格列名可能不同)
 * Order matters: earlier entries have higher priority for the same field
 */
const COLUMN_MAP: Record<string, string> = {
  // 品类 (category)
  '品牌行业类目': 'category',
  '品类': 'category',
  // 品牌 (brand)
  '品牌简称': 'brand',
  '品牌简称（必填）': 'brand',
  '品牌': 'brand',
  // 业务线 (businessLine)
  '品牌业务线': 'businessLine',
  '品牌业务线（必填）': 'businessLine',
  // 项目名称 (projectName) - 优先用元派实际立项名称，其次飞书项目名称，最后客户名称
  '元派实际立项名称': 'projectName',
  '飞书项目名称': 'projectName',
  '项目名称': 'projectName',
  '客户名称': 'projectName',
  // 立项时间 (startDate)
  '立项时间': 'startDate',
  // 创建者 (createdBy)
  'AD': 'createdBy',
  '创建者': 'createdBy',
  // 灵犀账号ID
  '灵犀ID': 'lingxiAccountId',
};

const REQUIRED_FIELDS = ['category', 'brand', 'businessLine', 'projectName'];

interface ParsedRow {
  category: string;
  brand: string;
  businessLine: string;
  projectName: string;
  startDate: string | null;
  createdBy: string | null;
  lingxiAccountId: string | null;
}

/**
 * POST /api/admin/import/project-base
 *
 * Accepts multipart/form-data with an .xlsx file.
 * Parses the project base table and:
 * 1. Batch upserts projects (isImported=true)
 * 2. Deduplicates and upserts project_tree_nodes
 * Returns { imported, treeNodesCreated, errors }
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: '请上传文件', code: 'NO_FILE' },
        { status: 400 }
      );
    }

    // Validate file extension
    if (!isValidProjectBaseFile(file.name)) {
      return NextResponse.json(
        { error: '仅支持.xlsx格式文件', code: 'INVALID_FILE_FORMAT' },
        { status: 400 }
      );
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse xlsx
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json(
        { error: '文件中没有工作表', code: 'PARSE_FAILED' },
        { status: 400 }
      );
    }

    const sheet = workbook.Sheets[sheetName];
    let rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rawRows.length === 0) {
      return NextResponse.json(
        { error: '文件中没有数据行', code: 'PARSE_FAILED' },
        { status: 400 }
      );
    }

    // Check if the first row's keys match any known column headers
    // If not, the actual header might be on row 2 (row 1 is a title row)
    const firstRowKeys = Object.keys(rawRows[0] || {});
    const knownHeaders = Object.keys(COLUMN_MAP);
    const hasKnownHeader = firstRowKeys.some((key) => knownHeaders.includes(key));

    if (!hasKnownHeader) {
      // Try parsing with header on row 2 (skip first row)
      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
      range.s.r = 1; // Start from row 2 (0-indexed)
      const rawRowsRetry: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
        defval: '',
        range,
      });
      if (rawRowsRetry.length > 0) {
        const retryKeys = Object.keys(rawRowsRetry[0] || {});
        const retryHasKnownHeader = retryKeys.some((key) => knownHeaders.includes(key));
        if (retryHasKnownHeader) {
          rawRows = rawRowsRetry;
        }
      }
    }

    // Parse rows with column mapping
    const parsedRows: ParsedRow[] = [];
    const errors: string[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const raw = rawRows[i];
      const rowNum = i + 2; // Excel row number (1-indexed header + 1-indexed data)

      const mapped: Record<string, string | null> = {};
      for (const [chineseHeader, fieldName] of Object.entries(COLUMN_MAP)) {
        const value = raw[chineseHeader];
        const trimmed = value != null && String(value).trim() !== '' ? String(value).trim() : null;
        // Only set if not already set (first match wins for priority)
        if (trimmed && !mapped[fieldName]) {
          mapped[fieldName] = trimmed;
        } else if (!mapped[fieldName]) {
          mapped[fieldName] = mapped[fieldName] ?? null;
        }
      }

      // Validate required fields
      const missingFields = REQUIRED_FIELDS.filter(f => !mapped[f]);
      if (missingFields.length > 0) {
        errors.push(`第${rowNum}行缺少必填字段: ${missingFields.join(', ')}`);
        continue;
      }

      parsedRows.push({
        category: mapped.category!,
        brand: mapped.brand!,
        businessLine: mapped.businessLine!,
        projectName: mapped.projectName!,
        startDate: mapped.startDate || null,
        createdBy: mapped.createdBy || null,
        lingxiAccountId: mapped.lingxiAccountId || null,
      });
    }

    if (parsedRows.length === 0) {
      return NextResponse.json(
        { error: '没有有效的数据行', code: 'PARSE_FAILED', errors },
        { status: 400 }
      );
    }

    // Batch upsert projects
    let importedCount = 0;
    for (const row of parsedRows) {
      try {
        // Parse startDate
        let startDate: Date;
        if (row.startDate) {
          const parsed = new Date(row.startDate);
          startDate = isNaN(parsed.getTime()) ? new Date() : parsed;
        } else {
          startDate = new Date();
        }

        await prisma.project.upsert({
          where: {
            // Use a composite approach: find by projectName + brand + category
            // Since there's no unique constraint on these, we use a workaround
            id: await findProjectId(row.category, row.brand, row.projectName),
          },
          update: {
            businessLine: row.businessLine,
            isImported: true,
            lingxiAccountId: row.lingxiAccountId || undefined,
          },
          create: {
            category: row.category,
            brand: row.brand,
            businessLine: row.businessLine,
            projectName: row.projectName,
            startDate: startDate,
            endDate: startDate, // Default endDate same as startDate for imported projects
            isImported: true,
            lingxiAccountId: row.lingxiAccountId || null,
          },
        });
        importedCount++;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`导入项目"${row.projectName}"失败: ${message}`);
      }
    }

    // Deduplicate and upsert project_tree_nodes
    const uniqueTuples = new Map<string, { category: string; brand: string; businessLine: string }>();
    for (const row of parsedRows) {
      const key = `${row.category}|${row.brand}|${row.businessLine}`;
      if (!uniqueTuples.has(key)) {
        uniqueTuples.set(key, {
          category: row.category,
          brand: row.brand,
          businessLine: row.businessLine,
        });
      }
    }

    let treeNodesCreated = 0;
    for (const tuple of uniqueTuples.values()) {
      try {
        await prisma.projectTreeNode.upsert({
          where: {
            category_brand_businessLine: {
              category: tuple.category,
              brand: tuple.brand,
              businessLine: tuple.businessLine,
            },
          },
          update: {}, // No update needed, just ensure it exists
          create: {
            category: tuple.category,
            brand: tuple.brand,
            businessLine: tuple.businessLine,
          },
        });
        treeNodesCreated++;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`创建树节点"${tuple.category}/${tuple.brand}/${tuple.businessLine}"失败: ${message}`);
      }
    }

    return NextResponse.json({
      imported: importedCount,
      treeNodesCreated,
      errors,
    });
  } catch (error) {
    console.error('POST /api/admin/import/project-base error:', error);
    return NextResponse.json(
      { error: '导入失败，请稍后重试', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * Helper: Find existing project ID by category + brand + projectName.
 * If not found, returns a non-existent UUID to trigger create in upsert.
 */
async function findProjectId(category: string, brand: string, projectName: string): Promise<string> {
  const existing = await prisma.project.findFirst({
    where: {
      category,
      brand,
      projectName,
    },
    select: { id: true },
  });
  return existing?.id ?? '00000000-0000-0000-0000-000000000000';
}
