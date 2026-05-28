/**
 * HTML Report Prompt Builder - 构建生成HTML复盘报告的大模型提示词
 *
 * 将项目数据组装为结构化提示词，指导大模型生成完整的独立HTML页面。
 */

import type { HtmlReportData } from './html-report-data-assembler.js';

export interface PromptBuildOptions {
  /** 是否包含编辑功能 */
  editable?: boolean;
  /** 是否包含导出按钮 */
  exportButtons?: boolean;
  /** 额外指令 */
  additionalInstructions?: string;
}

export interface BuiltPrompt {
  systemPrompt: string;
  userPrompt: string;
}

/**
 * 构建HTML报告生成的完整提示词
 */
export function buildHtmlReportPrompt(
  data: HtmlReportData,
  options?: PromptBuildOptions,
): BuiltPrompt {
  const editable = options?.editable ?? true;
  const exportButtons = options?.exportButtons ?? true;

  const systemPrompt = buildSystemPrompt(editable, exportButtons, options?.additionalInstructions);
  const userPrompt = buildUserPrompt(data);

  return { systemPrompt, userPrompt };
}

/**
 * 构建系统提示词 - 定义HTML生成规则
 */
function buildSystemPrompt(
  editable: boolean,
  exportButtons: boolean,
  additionalInstructions?: string,
): string {
  const parts: string[] = [];

  parts.push(`你是一位专业的小红书营销复盘报告生成专家，同时精通前端开发。
请根据提供的项目数据，生成一个完整的、可独立运行的HTML页面作为复盘报告。`);

  parts.push(`
## 严格遵守以下规则：

### 1. 引入资源（通过CDN）
- ECharts: https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js
- html2canvas: https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js
- jsPDF: https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js
- html-docx-js: https://cdn.jsdelivr.net/npm/html-docx-js@0.3.1/dist/html-docx.js

### 2. 页面结构（按以下章节顺序）
1. **报告封面**：项目名称、品牌、品类、执行周期
2. **数据总览**：KPI完成情况数据表格 + ECharts柱状图（KPI完成率对比）
3. **大盘对比**：实际值vs大盘对比表格
4. **内容分析**：
   - 内容方向分析表格 + ECharts饼图（各方向曝光占比）
   - 达人层级分析表格 + ECharts柱状图（各层级爆文率对比）
   - 内容形式分析表格
5. **投流分析**：投流总览 + 广告类型分析表格 + ECharts饼图（各类型消耗占比）
6. **项目亮点**：亮点列表
7. **优化建议**：分维度的建议列表

### 3. 图表要求
- 使用ECharts渲染所有图表
- 至少包含：1个柱状图（KPI完成率）、1个饼图（内容方向曝光占比）、1个柱状图（达人层级爆文率）
- 图表容器使用固定高度（如400px），确保正常渲染
- 图表数据必须与表格数据一致
- 图表配色使用专业商务风格

### 4. 表格要求
- 使用原生HTML table标签
- 表格样式清晰，有边框和斑马纹
- 表头固定背景色
- 数据对齐：文字左对齐，数字右对齐`);

  if (exportButtons) {
    parts.push(`
### 5. 功能按钮
- 页面顶部固定工具栏，包含两个按钮：
  - 【导出PDF】：使用html2canvas截图整个报告区域，然后用jsPDF生成PDF文件下载
  - 【导出DOCX】：使用html-docx-js将报告区域的HTML转换为DOCX文件下载
- 导出时需要隐藏工具栏本身
- PDF导出需要处理分页（按章节分页）
- DOCX导出需要保留表格格式`);
  }

  if (editable) {
    parts.push(`
### 6. 编辑功能
- 所有文字内容区域（标题、段落、列表项）添加 contenteditable="true" 属性
- 表格单元格也可编辑
- 编辑时显示淡蓝色边框提示
- 添加CSS样式：[contenteditable]:focus { outline: 2px solid #4A90D9; border-radius: 2px; }
- 编辑后的内容在导出时会被包含`);
  }

  parts.push(`
### 7. 样式要求
- 使用简洁专业的CSS排版
- 页面最大宽度1200px，居中显示
- 字体：-apple-system, "Microsoft YaHei", sans-serif
- 主色调：#1a73e8（蓝色系）
- 章节之间有明显分隔
- 响应式布局，移动端可阅读
- 打印友好（@media print 隐藏工具栏和编辑边框）

### 8. 输出要求
- 仅返回完整的HTML代码，不要包含任何解释文字
- HTML必须是完整的文档（从<!DOCTYPE html>开始到</html>结束）
- 所有JavaScript代码内联在<script>标签中
- 所有CSS代码内联在<style>标签中
- 确保页面可以直接在浏览器中打开运行
- 图表必须在页面加载后正确渲染（使用DOMContentLoaded或window.onload）`);

  if (additionalInstructions) {
    parts.push(`
### 附加要求
${additionalInstructions}`);
  }

  return parts.join('\n');
}

/**
 * 构建用户提示词 - 包含所有项目数据
 */
function buildUserPrompt(data: HtmlReportData): string {
  const sections: string[] = [];

  // 项目信息
  sections.push(`## 项目信息
- 项目名称：${data.project.projectName}
- 品牌：${data.project.brand}
- 品类：${data.project.category}
${data.project.spuName ? `- 产品：${data.project.spuName}` : ''}
- 执行周期：${data.project.period}`);

  // 费用概览
  if (data.costOverview) {
    sections.push(`
## 费用概览
- 总费用：${data.costOverview.totalCost}元
- 达人费用：${data.costOverview.talentCost}元
- 投流费用：${data.costOverview.trafficCost}元
- 总笔记数：${data.costOverview.noteCount}篇`);
  }

  // KPI完成情况
  if (data.kpiCompletion.length > 0) {
    sections.push(`
## KPI完成情况数据
| 指标 | KPI目标 | 实际达成 | 完成率 |
|------|---------|----------|--------|
${data.kpiCompletion.map((k) => `| ${k.metric} | ${k.kpiTarget} | ${k.actual} | ${k.completionRate} |`).join('\n')}`);
  }

  // 大盘对比
  if (data.benchmark.length > 0) {
    sections.push(`
## 大盘对比数据
| 指标 | 实际值 | 大盘范围 | 对比结果 | 差异 |
|------|--------|----------|----------|------|
${data.benchmark.map((b) => `| ${b.metric} | ${b.actual} | ${b.benchmarkRange} | ${b.status} | ${b.diff} |`).join('\n')}`);
  }

  // 内容方向分析
  if (data.contentByDirection.length > 0) {
    sections.push(`
## 内容方向分析数据
| 内容方向 | 篇数 | 曝光量 | 阅读量 | 互动量 | CPE | 爆文数 | 爆文率 |
|----------|------|--------|--------|--------|-----|--------|--------|
${data.contentByDirection.map((c) => `| ${c.direction} | ${c.count} | ${c.impressions} | ${c.reads} | ${c.engagement} | ${c.cpe} | ${c.viralCount} | ${c.viralRate} |`).join('\n')}`);
  }

  // 达人层级分析
  if (data.contentByTier.length > 0) {
    sections.push(`
## 达人层级分析数据
| 达人层级 | 篇数 | 曝光量 | 阅读量 | 互动量 | CPE | 爆文数 | 爆文率 |
|----------|------|--------|--------|--------|-----|--------|--------|
${data.contentByTier.map((t) => `| ${t.tier} | ${t.count} | ${t.impressions} | ${t.reads} | ${t.engagement} | ${t.cpe} | ${t.viralCount} | ${t.viralRate} |`).join('\n')}`);
  }

  // 内容形式分析
  if (data.contentByForm.length > 0) {
    sections.push(`
## 内容形式分析数据
| 内容形式 | 篇数 | 曝光量 | 阅读量 | 互动量 | CPE | 爆文数 | 爆文率 |
|----------|------|--------|--------|--------|-----|--------|--------|
${data.contentByForm.map((f) => `| ${f.type} | ${f.count} | ${f.impressions} | ${f.reads} | ${f.engagement} | ${f.cpe} | ${f.viralCount} | ${f.viralRate} |`).join('\n')}`);
  }

  // 投流分析
  if (data.trafficOverview) {
    sections.push(`
## 投流总览数据
- 总消耗：${data.trafficOverview.totalSpend}元
- 总曝光：${data.trafficOverview.totalImpressions}
- 总点击：${data.trafficOverview.totalClicks}
- 总互动：${data.trafficOverview.totalEngagement}
- CTR：${data.trafficOverview.ctr}
- CPC：${data.trafficOverview.cpc}
- CPM：${data.trafficOverview.cpm}
- CPE：${data.trafficOverview.cpe}`);
  }

  if (data.trafficByType && data.trafficByType.length > 0) {
    sections.push(`
## 投流-广告类型分析数据
| 广告类型 | 消耗 | 曝光量 | 点击量 | 互动量 | CPM | CPC | CPE | CTR |
|----------|------|--------|--------|--------|-----|-----|-----|-----|
${data.trafficByType.map((t) => `| ${t.type} | ${t.spend} | ${t.impressions} | ${t.clicks} | ${t.engagement} | ${t.cpm} | ${t.cpc} | ${t.cpe} | ${t.ctr} |`).join('\n')}`);
  }

  if (data.trafficByTargeting && data.trafficByTargeting.length > 0) {
    sections.push(`
## 投流-人群定向分析数据
| 人群定向 | 消耗 | CPM | CPC | CPE | CTR |
|----------|------|-----|-----|-----|-----|
${data.trafficByTargeting.map((t) => `| ${t.targeting} | ${t.spend} | ${t.cpm} | ${t.cpc} | ${t.cpe} | ${t.ctr} |`).join('\n')}`);
  }

  // 项目亮点
  if (data.highlights.length > 0) {
    sections.push(`
## 项目亮点
${data.highlights.map((h) => `- ${h}`).join('\n')}`);
  }

  // 优化建议
  if (Object.keys(data.optimization).length > 0) {
    const optParts = Object.entries(data.optimization).map(([section, items]) =>
      `### ${section}\n${items.map((item) => `- ${item}`).join('\n')}`,
    );
    sections.push(`
## 优化建议
${optParts.join('\n\n')}`);
  }

  return `请根据以下项目数据生成完整的HTML复盘报告页面：\n\n${sections.join('\n\n')}`;
}
