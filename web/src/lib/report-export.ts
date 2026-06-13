/**
 * Report Export Utility
 *
 * 将章节 HTML 片段组装为 Word / PDF 导出用的 HTML 结构。
 */

export interface ChapterData {
  id: string;
  title: string;
  number: number;
  content: string;
}

const EXPORT_CONTENT_STYLES = `
h2 { font-size: 18px; color: #334155; margin: 20px 0 10px; text-align: left; font-weight: 600; }
h3 { font-size: 16px; color: #334155; margin: 20px 0 10px; text-align: left; font-weight: 600; }
p { margin: 8px 0; font-size: 14px; }
.report-table, table {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
  font-size: 13px;
}
.report-table th, .report-table td, th, td {
  border: 1px solid #e2e8f0;
  padding: 8px 12px;
  text-align: left;
}
.report-table th, th {
  background: #f1f5f9;
  font-weight: 600;
  color: #475569;
}
.report-table tr:nth-child(even), tr:nth-child(even) { background: #f8fafc; }
.report-table td:last-child { text-align: right; }
.highlight { color: #F5A623; font-weight: 600; }
.text-green { color: #16a34a; font-weight: 600; }
.text-red { color: #dc2626; font-weight: 600; }
ul, ol { margin: 8px 0 8px 24px; font-size: 14px; }
li { margin: 4px 0; }
.chart-placeholder { display: none; }
.chart-image { text-align: center; margin: 16px 0; }
.chart-image img { max-width: 100%; height: auto; }
`;

/**
 * 构建 PDF 导出用的 HTML body（图表需预先转为 base64 图片）
 */
export function buildPdfExportBody(chapters: ChapterData[], title: string): string {
  const header = `
<div class="pdf-section" style="text-align:center;padding-bottom:32px;border-bottom:2px solid #e2e8f0;margin-bottom:32px;">
  <style>${EXPORT_CONTENT_STYLES}</style>
  <h1 style="font-size:28px;color:#0f172a;margin-bottom:8px;">${title}</h1>
  <p style="font-size:14px;color:#64748b;">小红书种草项目复盘报告</p>
</div>`;

  const chaptersHtml = chapters
    .map(
      (c, idx) => `
<div class="pdf-section" style="margin-bottom:40px;">
  <h2 style="font-size:22px;color:#1e40af;text-align:center;margin-bottom:20px;padding-bottom:8px;border-bottom:2px solid #e2e8f0;">
    ${idx + 1}. ${c.title}
  </h2>
  ${c.content}
</div>`,
    )
    .join('\n');

  return header + chaptersHtml;
}

/**
 * 构建 Word 导出用的 HTML
 * 图表占位符会被保留并通过 ECharts 渲染为 canvas，
 * 然后在导出前转为 base64 图片嵌入 Word。
 */
export function buildWordExportHtml(chapters: ChapterData[], title: string): string {
  const chaptersHtml = chapters
    .map((c) => {
      return `<h1 style="color:#1e40af;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">${c.number}. ${c.title}</h1>${c.content}`;
    })
    .join('');

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${title}</title>
<style>
body { font-family: "Microsoft YaHei", sans-serif; font-size: 12pt; color: #1e293b; }
table { width: 100%; border-collapse: collapse; margin: 10px 0; }
th, td { border: 1px solid #ccc; padding: 6px 10px; }
th { background: #f1f5f9; }
h1 { font-size: 16pt; margin-top: 20px; }
h2 { font-size: 14pt; }
h3 { font-size: 12pt; }
.highlight { color: #1e40af; font-weight: bold; }
.text-green { color: #16a34a; }
.text-red { color: #dc2626; }
.chart-placeholder { display: none; }
.chart-image { text-align: center; margin: 16px 0; }
.chart-image img { max-width: 100%; }
</style>
</head>
<body>
<div style="text-align:center;margin-bottom:30px;">
<h1 style="font-size:22pt;color:#0f172a;">${title}</h1>
<p style="color:#64748b;">小红书种草项目复盘报告</p>
</div>
${chaptersHtml}
</body></html>`;
}
