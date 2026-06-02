import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { prisma, Prisma } from '@/lib/prisma';
import { selectTargetSheet } from '@/lib/sheet-selector';

/**
 * Column header mapping: Chinese headers → Note model field names.
 * Fields that don't map to a direct column are stored in the `components` JSON field.
 */
const COLUMN_MAP: Record<string, string> = {
  '序号': '_index',
  '博主昵称': 'kolNickName',
  '博主粉丝量': 'kolFanNum',
  '笔记链接': 'noteLink',
  '笔记id': 'noteId',
  '合作形式': 'noteType',
  '是否报备': 'isUnderwater',
  '内容方向': 'contentDirection',
  '达人类型': 'kolType',
  '对应SPU': 'spuName',
  '内容实际消耗金额': 'kolPrice',
  '内容实际结算金额': 'serviceFee',
  '投流实际消耗': 'underwaterPrice',
  '总费用': 'totalPlatformPrice',
  '曝光量': 'impNum',
  '阅读量': 'readNum',
  '互动量': 'engageNum',
  '点赞量': 'likeNum',
  '收藏量': 'favNum',
  '评论量': 'cmtNum',
  '分享量': 'shareNum',
  '关注量': 'followNum',
  '总CPM': 'totalCpm',
  '总CPE': 'totalCpe',
  '总CPC': 'totalCpc',
  '自然曝光量': 'organicImpNum',
  '自然阅读量': 'organicReadNum',
  '自然互动': 'organicEngageNum',
  '自然CTR': 'organicCtr',
  '自然流CPM': 'organicCpm',
  '自然流CPE': 'organicCpe',
  '自然流CPC': 'organicCpc',
  '展现量': 'heatImpNum',
  '点击量': 'heatReadNum',
  '投流互动量': 'heatEngageNum',
  '投流CTR': 'heatCtr',
  '投流CPM': 'heatCpm',
  '投流CPE': 'heatCpe',
  '投流CPC': 'heatCpc',
  '投流新增TI': 'heatNewTi',
  '投流CPTI': 'heatCpti',
  '回搜数': 'searchCount',
  '回搜率': 'searchRate',
};

/** Fields that map directly to Note model columns */
const DIRECT_FIELDS = new Set([
  'noteId', 'kolNickName', 'kolFanNum', 'noteLink', 'noteType',
  'spuName', 'impNum', 'readNum', 'engageNum', 'likeNum',
  'favNum', 'cmtNum', 'shareNum', 'followNum', 'kolPrice',
  'serviceFee', 'totalPlatformPrice', 'heatImpNum', 'heatReadNum',
  'isUnderwater', 'underwaterPrice',
]);

/** Fields that are integers in the Note model */
const INT_FIELDS = new Set([
  'kolFanNum', 'impNum', 'readNum', 'engageNum', 'likeNum',
  'favNum', 'cmtNum', 'shareNum', 'followNum', 'heatImpNum', 'heatReadNum',
]);

/** Fields that are decimals in the Note model */
const DECIMAL_FIELDS = new Set([
  'kolPrice', 'serviceFee', 'totalPlatformPrice', 'underwaterPrice',
]);

/**
 * Parse a numeric value from a cell, returning 0 for invalid/empty values.
 */
function parseNumber(value: unknown): number {
  if (value == null || value === '') return 0;
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

/**
 * Parse a boolean-like value from Chinese text (是/否).
 */
function parseBoolean(value: unknown): boolean {
  if (value == null) return false;
  const str = String(value).trim();
  return str === '是' || str === 'true' || str === '1' || str === 'yes';
}

/**
 * POST /api/upload/note-base/[projectId]
 *
 * Accepts multipart/form-data with an .xlsx file containing note base table data.
 * Transaction operation:
 * 1. Delete all existing notes for this project
 * 2. Bulk insert new notes from parsed data
 * 3. Update project.noteCount
 *
 * Returns { success: true, noteCount: number }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    // Validate projectId exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: '项目不存在', code: 'PROJECT_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: '请上传文件', code: 'NO_FILE' },
        { status: 400 }
      );
    }

    // Validate file extension
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
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
    if (workbook.SheetNames.length === 0) {
      return NextResponse.json(
        { error: '文件中没有工作表', code: 'PARSE_FAILED' },
        { status: 400 }
      );
    }

    // Use selectTargetSheet to pick the correct sheet (handles multi-sheet files)
    const sheetResult = selectTargetSheet(workbook.SheetNames);
    if (!sheetResult.success) {
      return NextResponse.json(
        { error: sheetResult.error, code: 'SHEET_NOT_FOUND' },
        { status: 400 }
      );
    }

    const sheet = workbook.Sheets[sheetResult.sheetName!];
    const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rawRows.length === 0) {
      return NextResponse.json(
        { error: '文件中没有数据行', code: 'PARSE_FAILED' },
        { status: 400 }
      );
    }

    // Parse rows and build note records
    const noteRecords: Array<{
      projectId: string;
      noteId: string;
      kolNickName: string | null;
      kolFanNum: number;
      noteLink: string | null;
      noteType: string | null;
      spuName: string | null;
      impNum: number;
      readNum: number;
      engageNum: number;
      likeNum: number;
      favNum: number;
      cmtNum: number;
      shareNum: number;
      followNum: number;
      kolPrice: number;
      serviceFee: number;
      totalPlatformPrice: number;
      heatImpNum: number;
      heatReadNum: number;
      isUnderwater: boolean;
      underwaterPrice: number;
      components: Prisma.InputJsonValue | typeof Prisma.JsonNull;
    }> = [];

    const errors: string[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const raw = rawRows[i];
      const rowNum = i + 2; // Excel row number (1-indexed header + 1-indexed data)

      // Map Chinese headers to field names
      const mapped: Record<string, unknown> = {};
      for (const [chineseHeader, fieldName] of Object.entries(COLUMN_MAP)) {
        if (raw[chineseHeader] !== undefined) {
          mapped[fieldName] = raw[chineseHeader];
        }
      }

      // Generate noteId if not present (use row index as fallback)
      const noteId = mapped.noteId
        ? String(mapped.noteId).trim()
        : `row_${rowNum}`;

      if (!noteId) {
        errors.push(`第${rowNum}行缺少笔记id`);
        continue;
      }

      // Collect extra fields into components JSON
      const components: Record<string, unknown> = {};
      for (const [fieldName, value] of Object.entries(mapped)) {
        if (!DIRECT_FIELDS.has(fieldName) && fieldName !== '_index') {
          components[fieldName] = value;
        }
      }

      noteRecords.push({
        projectId,
        noteId,
        kolNickName: mapped.kolNickName ? String(mapped.kolNickName).trim() : null,
        kolFanNum: Math.round(parseNumber(mapped.kolFanNum)),
        noteLink: mapped.noteLink ? String(mapped.noteLink).trim() : null,
        noteType: mapped.noteType ? String(mapped.noteType).trim() : null,
        spuName: mapped.spuName ? String(mapped.spuName).trim() : null,
        impNum: Math.round(parseNumber(mapped.impNum)),
        readNum: Math.round(parseNumber(mapped.readNum)),
        engageNum: Math.round(parseNumber(mapped.engageNum)),
        likeNum: Math.round(parseNumber(mapped.likeNum)),
        favNum: Math.round(parseNumber(mapped.favNum)),
        cmtNum: Math.round(parseNumber(mapped.cmtNum)),
        shareNum: Math.round(parseNumber(mapped.shareNum)),
        followNum: Math.round(parseNumber(mapped.followNum)),
        kolPrice: parseNumber(mapped.kolPrice),
        serviceFee: parseNumber(mapped.serviceFee),
        totalPlatformPrice: parseNumber(mapped.totalPlatformPrice),
        heatImpNum: Math.round(parseNumber(mapped.heatImpNum)),
        heatReadNum: Math.round(parseNumber(mapped.heatReadNum)),
        isUnderwater: parseBoolean(mapped.isUnderwater),
        underwaterPrice: parseNumber(mapped.underwaterPrice),
        components: Object.keys(components).length > 0 ? (components as Prisma.InputJsonValue) : Prisma.JsonNull,
      });
    }

    if (noteRecords.length === 0) {
      return NextResponse.json(
        { error: '没有有效的数据行', code: 'PARSE_FAILED', errors },
        { status: 400 }
      );
    }

    // Deduplicate by noteId (keep last occurrence)
    const deduped = new Map<string, (typeof noteRecords)[0]>();
    for (const record of noteRecords) {
      deduped.set(record.noteId, record);
    }
    const uniqueRecords = Array.from(deduped.values());

    // Transaction: delete all → bulk insert → update noteCount
    const result = await prisma.$transaction(async (tx) => {
      // 1. Delete all existing notes for this project
      await tx.note.deleteMany({
        where: { projectId },
      });

      // 2. Bulk insert new notes
      await tx.note.createMany({
        data: uniqueRecords,
      });

      // 3. Update project.noteCount
      const noteCount = uniqueRecords.length;
      await tx.project.update({
        where: { id: projectId },
        data: { noteCount },
      });

      return noteCount;
    }, { timeout: 30000 });

    return NextResponse.json({
      success: true,
      noteCount: result,
    });
  } catch (error) {
    console.error('POST /api/upload/note-base error:', error);
    return NextResponse.json(
      { error: '上传失败，请稍后重试', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
