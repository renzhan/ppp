/**
 * Script to generate web/public/down/projects-template.xlsx
 * with the final spec 14-column headers.
 *
 * Usage: npx tsx scripts/generate-template.ts
 */
import * as XLSX from 'xlsx';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HEADERS = [
  '发布链接（必须是长链接）',
  '内容形式',
  '内容方向',
  '笔记类型',
  '资源含税成本价',
  '资源含税售价',
  '曝光量',
  '阅读量',
  '点赞量',
  '收藏量',
  '评论量',
  '分享量',
  '关注量',
  '互动量',
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([HEADERS]);

// Set reasonable column widths
ws['!cols'] = HEADERS.map((h) => ({ wch: Math.max(h.length * 2, 12) }));

XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

const outputPath = path.resolve(__dirname, '../web/public/down/projects-template.xlsx');
XLSX.writeFile(wb, outputPath);

console.log(`Template generated at: ${outputPath}`);
console.log(`Headers (${HEADERS.length} columns): ${HEADERS.join(', ')}`);
