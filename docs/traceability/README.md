# 复盘报告数据溯源文档

> 本目录按章节分解复盘报告中所有数据和AI生成文本的来源，包括原始数据的数据库SQL查询、计算公式、以及AI文本生成的输入数据和提示词文件。

## 目录结构

- `chapter-01-cover.md` — 第1章：项目管理（封面）
- `chapter-02-project-review.md` — 第2章：项目回顾
- `chapter-03-data-overview.md` — 第3章：数据总览
- `chapter-04-highlights.md` — 第4章：项目亮点
- `chapter-05-quadrant-analysis.md` — 第5章：综合分析（四象限）
- `chapter-06-content-analysis.md` — 第6章：内容分析
- `chapter-07-traffic-analysis.md` — 第7章：投流分析
- `chapter-08-audience-assets.md` — 第8章：人群资产
- `chapter-09-optimization.md` — 第9章：优化建议
- `chapter-10-end-page.md` — 第10章：尾页

## 总体架构

```
报告生成流水线
├─ 数据加载 (src/pipeline/loaders/chapter-XX-*.ts)
│   └─ 每章独立 DataLoader，通过 Prisma 查询数据库
├─ 提示词模板 (src/prompts/chapters/chapter-XX-*.md)
│   └─ 包含变量占位符 {{variable_name}}
├─ 变量替换 (src/pipeline/template-loader.ts)
│   └─ 将 DataLoader 返回的 variables 填入模板
├─ LLM 调用 (OpenAI)
│   └─ system prompt + user prompt → HTML 输出
└─ 存储 (review_configs.reportContent)
    └─ JSON: { type: 'chapters', chapters: [...] }
```

## 溯源原则

每个章节文档包含：
1. **原始数据来源** — 涉及哪些数据库表、具体SQL查询
2. **计算公式** — 派生指标的计算逻辑和代码位置
3. **AI文本输入** — 传给LLM的完整数据上下文
4. **提示词文件** — 对应的 prompt 模板路径
