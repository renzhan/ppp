/**
 * Report Export Utility
 *
 * 将章节 HTML 片段组装为完整的独立 HTML 文件，
 * 包含 ECharts 图表渲染（从 data-chart-* 属性自动生成）、
 * 样式、导出 PDF/DOCX 功能。
 */

interface ChapterData {
  id: string;
  title: string;
  number: number;
  content: string;
}

/**
 * 构建完整的可导出 HTML 文件
 * - 包含 ECharts CDN，自动将 .chart-placeholder 转为图表
 * - 包含 html2canvas + jsPDF 用于 PDF 导出
 * - 包含打印友好样式
 */
export function buildFullExportHtml(chapters: ChapterData[], title: string): string {
  const chaptersHtml = chapters
    .map((c) => `<section class="chapter" id="chapter-${c.id}"><h2 class="chapter-title">${c.number}. ${c.title}</h2>${c.content}</section>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"><\/script>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, "Microsoft YaHei", "PingFang SC", sans-serif;
  color: #1e293b;
  line-height: 1.7;
  background: #f8fafc;
  padding: 40px 20px;
}
.report-container {
  max-width: 900px;
  margin: 0 auto;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  padding: 48px 56px;
}
.report-header {
  text-align: center;
  padding-bottom: 32px;
  border-bottom: 2px solid #e2e8f0;
  margin-bottom: 32px;
}
.report-header h1 { font-size: 28px; color: #0f172a; margin-bottom: 8px; }
.report-header p { font-size: 14px; color: #64748b; }
.chapter { margin-bottom: 40px; page-break-inside: avoid; }
.chapter-title {
  font-size: 20px;
  color: #1e40af;
  border-left: 4px solid #1e40af;
  padding-left: 12px;
  margin-bottom: 16px;
}
h3 { font-size: 16px; color: #334155; margin: 20px 0 10px; }
p { margin: 8px 0; font-size: 14px; }
.report-table {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
  font-size: 13px;
}
.report-table th, .report-table td {
  border: 1px solid #e2e8f0;
  padding: 8px 12px;
  text-align: left;
}
.report-table th {
  background: #f1f5f9;
  font-weight: 600;
  color: #475569;
}
.report-table tr:nth-child(even) { background: #f8fafc; }
.report-table td:last-child { text-align: right; }
.highlight { color: #1e40af; font-weight: 600; }
.text-green { color: #16a34a; font-weight: 600; }
.text-red { color: #dc2626; font-weight: 600; }
ul, ol { margin: 8px 0 8px 24px; font-size: 14px; }
li { margin: 4px 0; }
.chart-container { width: 100%; height: 360px; margin: 16px 0; }
.chart-placeholder { display: none; }
@media print {
  body { background: #fff; padding: 0; }
  .report-container { box-shadow: none; padding: 20px; }
  .chart-container { page-break-inside: avoid; }
}
</style>
</head>
<body>
<div class="report-container">
  <div class="report-header">
    <h1>${title}</h1>
    <p>小红书种草项目复盘报告</p>
  </div>
  ${chaptersHtml}
</div>
<script>
// Auto-render ECharts from data-chart-* placeholders
document.addEventListener('DOMContentLoaded', function() {
  const placeholders = document.querySelectorAll('.chart-placeholder');
  placeholders.forEach(function(el, idx) {
    const chartType = el.getAttribute('data-chart-type') || 'bar';
    const chartTitle = el.getAttribute('data-chart-title') || '';
    let chartData;
    try { chartData = JSON.parse(el.getAttribute('data-chart-data') || '{}'); } catch(e) { return; }

    // Create chart container
    const container = document.createElement('div');
    container.className = 'chart-container';
    container.id = 'chart-' + idx;
    el.parentNode.insertBefore(container, el);

    const chart = echarts.init(container);
    let option = {};

    if (chartType === 'bar') {
      option = {
        title: { text: chartTitle, left: 'center', textStyle: { fontSize: 14, color: '#334155' } },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: chartData.labels || [], axisLabel: { fontSize: 11 } },
        yAxis: { type: 'value' },
        series: [{ type: 'bar', data: chartData.values || [], itemStyle: { color: '#3b82f6' } }],
        grid: { left: 60, right: 20, bottom: 40, top: 50 },
      };
    } else if (chartType === 'pie') {
      option = {
        title: { text: chartTitle, left: 'center', textStyle: { fontSize: 14, color: '#334155' } },
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        series: [{
          type: 'pie', radius: ['30%', '60%'],
          data: chartData.items || (chartData.labels || []).map(function(l, i) { return { name: l, value: (chartData.values || [])[i] }; }),
          label: { fontSize: 11 },
        }],
      };
    } else if (chartType === 'line') {
      option = {
        title: { text: chartTitle, left: 'center', textStyle: { fontSize: 14, color: '#334155' } },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: chartData.labels || [] },
        yAxis: { type: 'value' },
        series: [{ type: 'line', data: chartData.values || [], smooth: true, itemStyle: { color: '#3b82f6' } }],
        grid: { left: 60, right: 20, bottom: 40, top: 50 },
      };
    }

    chart.setOption(option);
    window.addEventListener('resize', function() { chart.resize(); });
  });
});
<\/script>
</body>
</html>`;
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
