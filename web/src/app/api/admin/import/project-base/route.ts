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
  '品牌名称': 'brand',
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

const REQUIRED_FIELDS = ['category', 'brand', 'projectName'];

interface ParsedRow {
  category: string;
  brand: string;
  businessLine: string | null;
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
        } else {
          // Neither row 1 nor row 2 contains known headers — this is likely the wrong file type
          const allFoundHeaders = [...new Set([...firstRowKeys, ...retryKeys])];
          const requiredFieldNames = REQUIRED_FIELDS.map(f => {
            const names = Object.entries(COLUMN_MAP).filter(([, v]) => v === f).map(([k]) => k);
            return `${f}(${names.join('/')})`;
          });
          const diagnostic = `文件列名无法识别，请确认上传的是项目底表文件。需要的列: ${requiredFieldNames.join(', ')}。文件中找到的列名: [${allFoundHeaders.join(', ')}]`;
          console.error(`[project-base import] ${diagnostic}`);
          return NextResponse.json(
            { error: '文件列名无法识别，请确认上传的是项目底表', code: 'COLUMN_MISMATCH', errors: [diagnostic] },
            { status: 400 }
          );
        }
      } else {
        // No data in retry either — wrong file type
        const requiredFieldNames = REQUIRED_FIELDS.map(f => {
          const names = Object.entries(COLUMN_MAP).filter(([, v]) => v === f).map(([k]) => k);
          return `${f}(${names.join('/')})`;
        });
        const diagnostic = `文件列名无法识别，请确认上传的是项目底表文件。需要的列: ${requiredFieldNames.join(', ')}。文件中找到的列名: [${firstRowKeys.join(', ')}]`;
        console.error(`[project-base import] ${diagnostic}`);
        return NextResponse.json(
          { error: '文件列名无法识别，请确认上传的是项目底表', code: 'COLUMN_MISMATCH', errors: [diagnostic] },
          { status: 400 }
        );
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
        businessLine: mapped.businessLine ?? null,
        projectName: mapped.projectName!,
        startDate: mapped.startDate || null,
        createdBy: mapped.createdBy || null,
        lingxiAccountId: mapped.lingxiAccountId || null,
      });
    }

    if (parsedRows.length === 0) {
      // Build diagnostic info: show which columns were found vs expected
      const foundHeaders = Object.keys(rawRows[0] || {});
      const mappedFields = new Set<string>();
      for (const header of foundHeaders) {
        if (COLUMN_MAP[header]) {
          mappedFields.add(COLUMN_MAP[header]);
        }
      }
      const unmappedRequired = REQUIRED_FIELDS.filter(f => !mappedFields.has(f));
      const fieldToChineseNames: Record<string, string[]> = {};
      for (const [cn, field] of Object.entries(COLUMN_MAP)) {
        if (!fieldToChineseNames[field]) fieldToChineseNames[field] = [];
        fieldToChineseNames[field].push(cn);
      }

      if (unmappedRequired.length > 0) {
        const details = unmappedRequired.map(f => {
          const acceptedNames = fieldToChineseNames[f]?.join('、') || f;
          return `"${f}"(可接受列名: ${acceptedNames})`;
        });
        const diagnostic = `文件缺少必填列映射: ${details.join('; ')}。文件中的列名: [${foundHeaders.join(', ')}]`;
        errors.unshift(diagnostic);
        console.error(`[project-base import] ${diagnostic}`);
      }

      console.error(`[project-base import] 没有有效的数据行。共${rawRows.length}行数据，全部校验失败。前5条错误:`, errors.slice(0, 5));
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

        // Resolve createdBy realName to UUID
        let resolvedCreatedBy: string | null = null;
        if (row.createdBy) {
          const resolution = await resolveCreatedBy(row.createdBy);
          resolvedCreatedBy = resolution.userId;
          if (resolution.warning) {
            errors.push(`项目"${row.projectName}": ${resolution.warning}`);
          }
        }

        await prisma.project.upsert({
          where: {
            // Use a composite approach: find by category + brand + businessLine + projectName
            // Since PostgreSQL treats NULL != NULL in unique constraints, we use findFirst workaround
            id: await findProjectId(row.category, row.brand, row.businessLine, row.projectName),
          },
          update: {
            businessLine: row.businessLine ?? undefined,
            isImported: true,
            lingxiAccountId: row.lingxiAccountId || undefined,
            createdBy: resolvedCreatedBy,
          },
          create: {
            category: row.category,
            brand: row.brand,
            businessLine: row.businessLine ?? null,
            projectName: row.projectName,
            startDate: startDate,
            endDate: startDate, // Default endDate same as startDate for imported projects
            isImported: true,
            lingxiAccountId: row.lingxiAccountId || null,
            createdBy: resolvedCreatedBy,
          },
        });
        importedCount++;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`导入项目"${row.projectName}"失败: ${message}`);
      }
    }

    // Deduplicate and upsert project_tree_nodes
    const uniqueTuples = new Map<string, { category: string; brand: string; businessLine: string | null }>();
    for (const row of parsedRows) {
      const key = `${row.category}|${row.brand}|${row.businessLine ?? ''}`;
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
        // Skip tree node upsert if businessLine is null (unique constraint requires non-null)
        if (tuple.businessLine === null) {
          // Create tree node at brand level only (no businessLine)
          await prisma.projectTreeNode.upsert({
            where: {
              category_brand_businessLine: {
                category: tuple.category,
                brand: tuple.brand,
                businessLine: '',
              },
            },
            update: {},
            create: {
              category: tuple.category,
              brand: tuple.brand,
              businessLine: '',
            },
          });
        } else {
          await prisma.projectTreeNode.upsert({
            where: {
              category_brand_businessLine: {
                category: tuple.category,
                brand: tuple.brand,
                businessLine: tuple.businessLine,
              },
            },
            update: {},
            create: {
              category: tuple.category,
              brand: tuple.brand,
              businessLine: tuple.businessLine,
            },
          });
        }
        treeNodesCreated++;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`创建树节点"${tuple.category}/${tuple.brand}/${tuple.businessLine ?? ''}"失败: ${message}`);
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
 * Helper: Find existing project ID by the full composite unique key
 * (category, brand, businessLine, projectName).
 *
 * Handles PostgreSQL NULL semantics: NULL != NULL in unique constraints,
 * so we use findFirst with explicit `businessLine: null` when businessLine is null.
 * This ensures correct upsert behavior for the @@unique([category, brand, businessLine, projectName]) constraint.
 *
 * If not found, returns a non-existent UUID to trigger create in upsert.
 */
async function findProjectId(
  category: string,
  brand: string,
  businessLine: string | null,
  projectName: string
): Promise<string> {
  const existing = await prisma.project.findFirst({
    where: {
      category,
      brand,
      businessLine: businessLine ?? null,
      projectName,
    },
    select: { id: true },
  });
  return existing?.id ?? '00000000-0000-0000-0000-000000000000';
}

/**
 * Helper: Resolve a real name (创建者) to a user UUID.
 * - If exactly 1 user matches the realName → return their UUID
 * - If 0 matches → return null + warning "未找到用户"
 * - If >1 matches → return null + warning "姓名重复，请手动指定创建者"
 */
async function resolveCreatedBy(realName: string): Promise<{ userId: string | null; warning?: string }> {
  const users = await prisma.user.findMany({
    where: { realName },
    select: { id: true },
  });
  if (users.length === 1) return { userId: users[0].id };
  if (users.length > 1) return { userId: null, warning: `姓名"${realName}"重复，请手动指定创建者` };
  return { userId: null, warning: `未找到用户"${realName}"` };
}
