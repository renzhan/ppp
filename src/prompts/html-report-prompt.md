---
name: "html-report-full"
version: "1.0.0"
description: "直接生成完整可编辑HTML复盘报告的提示词模板"
output_format: "html"
required_cdn:
  - echarts: "https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"
  - html2canvas: "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"
  - jspdf: "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"
  - html-docx: "https://cdn.jsdelivr.net/npm/html-docx-js@0.3.1/dist/html-docx.js"
---

# HTML复盘报告生成提示词

## 使用说明

本提示词用于指导大模型直接生成一个完整的、可独立在浏览器中运行的HTML复盘报告页面。

### 核心特性
1. **独立运行**：生成的HTML文件可直接在浏览器中打开，无需服务器
2. **可视化图表**：使用ECharts渲染柱状图、饼图等数据可视化
3. **内容可编辑**：所有文字区域支持直接点击编辑（contenteditable）
4. **导出功能**：支持导出为PDF和DOCX格式
5. **数据一致性**：表格数据与图表数据完全一致

### 提示词示例

```
生成完整独立HTML页面，浏览器直接运行，规则严格遵守：

1. 引入资源：ECharts CDN、html2canvas、jsPDF、html-docx-js CDN；
2. 页面元素：页面标题、原生数据表格、ECharts柱状图、ECharts饼图；
3. 功能按钮：两个按钮，分别实现【导出PDF】、【导出DOCX】；
4. 逻辑要求：表格与图表数据统一，图表正常渲染，导出功能可用；
5. 样式：简单CSS排版，布局清晰；
6. 输出：仅返回完整HTML代码，无多余文字。

以下是项目数据：
[数据内容由系统自动填充]
```

### 自定义扩展

可通过 `HtmlReportOptions.additionalInstructions` 传入额外指令，例如：
- 添加特定品牌色彩
- 调整图表类型（折线图、雷达图等）
- 增加特定章节
- 修改导出格式要求

### 数据格式

系统会自动将以下数据组装为Markdown表格格式传入提示词：
- 项目基本信息
- KPI完成情况
- 大盘对比
- 内容方向/达人层级/内容形式分析
- 投流分析（总览、广告类型、人群定向）
- 项目亮点
- 优化建议
