import * as XLSX from 'xlsx';
import { RawPugongyingNote, getMockRawNotes } from './mock-raw-notes';

/**
 * Fetch raw notes data for export.
 * During development, uses mock data.
 * In production, this will call the real fetchRawNotes API.
 */
export async function fetchRawNotesData(noteIds: string[]): Promise<RawPugongyingNote[]> {
  // Development mode: use mock data
  return getMockRawNotes(noteIds);
}

/**
 * Convert raw Pugongying notes data to an Excel buffer.
 * Creates a worksheet with Chinese column headers and formatted data.
 */
export function rawNotesToExcelBuffer(data: RawPugongyingNote[]): Buffer {
  // Define column headers mapping
  const headers = [
    { key: 'noteId', label: '笔记ID' },
    { key: 'noteTitle', label: '笔记标题' },
    { key: 'noteLink', label: '笔记链接' },
    { key: 'kolNickName', label: '博主昵称' },
    { key: 'kolId', label: '博主ID' },
    { key: 'kolFanNum', label: '粉丝量' },
    { key: 'noteType', label: '笔记类型' },
    { key: 'publishTime', label: '发布时间' },
    { key: 'impNum', label: '曝光量' },
    { key: 'readNum', label: '阅读量' },
    { key: 'engageNum', label: '互动量' },
    { key: 'likeNum', label: '点赞量' },
    { key: 'favNum', label: '收藏量' },
    { key: 'cmtNum', label: '评论量' },
    { key: 'shareNum', label: '分享量' },
    { key: 'followNum', label: '关注量' },
    { key: 'kolPrice', label: '达人报价' },
    { key: 'serviceFee', label: '服务费' },
    { key: 'totalPlatformPrice', label: '总平台价格' },
    { key: 'cpm', label: 'CPM' },
    { key: 'cpe', label: 'CPE' },
    { key: 'engageRate', label: '互动率' },
  ];

  // Build rows array with Chinese header labels as keys
  const rows = data.map((note) => {
    const row: Record<string, unknown> = {};
    for (const h of headers) {
      row[h.label] = (note as unknown as Record<string, unknown>)[h.key];
    }
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '蒲公英原始数据');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

/**
 * Generate the export filename in format: {projectName}_{YYYYMMDD_HHmmss}.xlsx
 */
export function generateExportFilename(projectName: string, date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${projectName}_${yyyy}${mm}${dd}_${hh}${mi}${ss}.xlsx`;
}
