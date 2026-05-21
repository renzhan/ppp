# Implementation Plan: MVP 功能差距分析

## Overview

本实现计划覆盖 13 项 MVP 待补齐功能，按功能依赖关系和复用程度分组。核心策略是先构建底层基础设施（模板引擎、图表渲染器、状态机），再逐步实现各业务功能，最后进行集成联调。

实现语言：TypeScript（Next.js 前端 + Node.js 后端）

## Tasks

- [x] 1. 基础设施 — 模板引擎与图表渲染器
  - [x] 1.1 创建模板引擎和默认模板配置
    - 创建 `src/export/templates/default.json` 默认模板配置文件
    - 创建 `src/export/template-engine.ts`，实现 `loadTemplate(templateId?)` 和 `listTemplates()` 函数
    - 当 templateId 未提供或不存在时回退到默认模板
    - _Requirements: 11.1, 11.2, 11.5_

  - [x] 1.2 实现服务端图表渲染器
    - 创建 `src/export/chart-renderer.ts`
    - 使用 `@napi-rs/canvas` 实现 `renderChartToImage()` 函数，支持 pie/bar/line/radar/funnel 图表类型
    - 实现 `renderModuleCharts()` 批量渲染函数
    - 确保输出 PNG 分辨率 ≥ 150 DPI，宽度不超过页面可用宽度
    - 无图表数据的模块返回空数组
    - _Requirements: 6.1, 6.4, 6.5, 6.6_

  - [ ]* 1.3 Property test: 图表尺寸与 DPI 约束
    - **Property 7: Chart rendering respects dimension and DPI constraints**
    - **Validates: Requirements 6.4, 6.5**

  - [ ]* 1.4 Property test: 无图表数据模块跳过渲染
    - **Property 8: Chart rendering skips modules without chart data**
    - **Validates: Requirements 6.6**

- [x] 2. 基础设施 — 项目状态机
  - [x] 2.1 实现项目状态机
    - 创建 `src/project/status-machine.ts`
    - 定义 `VALID_TRANSITIONS` 常量和 `transitionStatus(projectId, trigger)` 函数
    - 实现乐观锁防止并发状态更新冲突
    - 无效转换静默拒绝（返回 success: false）
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [ ]* 2.2 Property test: 状态机转换正确性
    - **Property 15: Project status machine transitions**
    - **Validates: Requirements 12.2, 12.3, 12.4, 12.5**

  - [x] 2.3 在 Prisma schema 中添加 Project.status 字段
    - 在 `prisma/schema.prisma` 的 Project 模型中添加 `status String @default("draft") @db.VarChar(20)`
    - 运行 `prisma migrate` 生成迁移
    - _Requirements: 12.1, 12.6_

- [x] 3. Checkpoint — 基础设施验证
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. 报告导出 — PDF 导出与 Word 增强
  - [x] 4.1 实现 PDF 导出器
    - 创建 `src/export/pdf-exporter.ts`
    - 使用 `@react-pdf/renderer` 实现 `exportToPDF()` 函数
    - 支持标题层级、段落格式、表格布局
    - 首页包含项目名称、品牌、品类、项目类型和生成日期
    - 嵌入图表 PNG 图片
    - 应用模板配置（字体、颜色、边距）
    - 排除隐藏模块内容，标注降级模块
    - 30 秒超时限制
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.4, 2.5_

  - [ ]* 4.2 Property test: PDF 输出包含项目元数据
    - **Property 1: PDF export produces valid output containing project metadata**
    - **Validates: Requirements 1.1, 1.4**

  - [ ]* 4.3 Property test: 隐藏模块排除
    - **Property 2: Hidden modules excluded from export**
    - **Validates: Requirements 2.4**

  - [ ]* 4.4 Property test: 降级模块标注
    - **Property 3: Degraded modules annotated in export**
    - **Validates: Requirements 2.5**

  - [x] 4.5 增强 Word 导出器
    - 修改现有 `src/report/exporter.ts` 或创建 `src/export/word-exporter.ts`
    - 使用 `docx` 库实现图表 PNG 嵌入
    - 应用模板配置（字体、字号、行距、页边距）
    - 实现数据表格渲染（表头样式 + 交替行背景色）
    - 排除隐藏模块内容，标注降级模块
    - 排除被隐藏的列（根据 ReviewEdit column_hide 记录）
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 9.5_

  - [ ]* 4.6 Property test: 隐藏列排除
    - **Property 12: Hidden columns excluded from export**
    - **Validates: Requirements 9.5**

  - [x] 4.7 创建导出 API 路由
    - 更新 `web/src/app/api/export/[versionId]/route.ts`
    - 接受 `format` (pdf/docx) 和 `templateId` 参数
    - 加载 ReportVersion + ModuleDecisions + ReviewEdits
    - 调用 ChartRenderer → TemplateEngine → ExportEngine 管线
    - 返回文件下载响应（Content-Disposition）
    - 错误时返回包含原因的 JSON 响应（retryable 标记）
    - _Requirements: 1.1, 1.5, 2.2_

- [x] 5. Checkpoint — 导出功能验证
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. 数据采集 — OCR 服务与 API 拉取前端
  - [x] 6.1 实现 OCR 服务（复用 Vision Document Parser）
    - 创建 `src/ingestion/ocr-service.ts`
    - 委托给 `vision-document-parser.ts` 的 `recognizeLingxiScreenshot()` 函数
    - 使用 LLM Vision API (gpt-4.1) 识别灵犀平台截图
    - 支持 PNG/JPG 格式输入
    - 返回结构化数据（dataType + data + confidence）
    - 对置信度 < 80% 的字段标记为低置信度
    - 注意：与策划案解析共享同一 Vision 管线，仅切换 prompt
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.7_

  - [ ]* 6.2 Property test: OCR 低置信度字段标记
    - **Property 6: OCR low-confidence field highlighting**
    - **Validates: Requirements 5.5**

  - [x] 6.3 创建 OCR 上传 API 路由
    - 创建 `web/src/app/api/upload/ocr/route.ts`
    - 接受图片文件上传（multipart/form-data）
    - 调用 OCR 服务并返回识别结果
    - 提供确认保存端点将数据写入 lingxi_data 表
    - _Requirements: 5.1, 5.4, 5.6_

  - [x] 6.4 实现笔记 ID 解析器
    - 创建 `web/src/lib/note-id-parser.ts`
    - 实现 `parseNoteIds(input: string): string[]` 函数
    - 支持逗号分隔、换行分隔、混合分隔
    - 去除空白、去重
    - _Requirements: 10.2_

  - [ ]* 6.5 Property test: 笔记 ID 批量解析
    - **Property 13: Note ID batch parsing**
    - **Validates: Requirements 10.2**

  - [x] 6.6 创建 API 拉取前端页面与路由
    - 创建 `web/src/app/api/upload/api-fetch/route.ts`
    - 接受 projectId 和 noteIds 数组
    - 调用已有的 `DataIngestionService.ingestFromAPI()`
    - 返回成功/失败笔记数量汇总和失败详情
    - _Requirements: 10.3, 10.5, 10.6, 10.7_

  - [ ]* 6.7 Property test: 失败笔记 ID 报告
    - **Property 14: Failed note IDs reported**
    - **Validates: Requirements 10.6**

  - [x] 6.8 实现 API 拉取前端 UI
    - 在 `web/src/app/projects/[id]/upload/` 中添加"API 拉取"模式 Tab
    - 包含笔记 ID 文本输入区域（支持批量输入）
    - 显示拉取进度和结果汇总
    - 列出失败笔记 ID 和原因
    - _Requirements: 10.1, 10.2, 10.4, 10.5, 10.6_

- [x] 7. Checkpoint — 数据采集功能验证
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. 前端交互 — 筛选器、通知、策划案解析
  - [x] 8.1 实现动态筛选 API 路由
    - 创建 `web/src/app/api/projects/filters/route.ts`
    - 查询数据库中所有 distinct brand 和 category
    - 去重并按升序排序返回
    - _Requirements: 4.1, 4.2, 4.6_

  - [ ]* 8.2 Property test: 筛选器返回完整去重排序选项
    - **Property 4: Filter service returns complete, deduplicated, sorted options**
    - **Validates: Requirements 4.1, 4.2, 4.6**

  - [ ]* 8.3 Property test: 筛选正确限制结果
    - **Property 5: Filter correctly restricts results**
    - **Validates: Requirements 4.3, 4.4**

  - [x] 8.4 前端集成动态筛选器
    - 修改 `web/src/app/page.tsx` 项目列表页
    - 页面加载时调用 `/api/projects/filters` 获取品牌和品类选项
    - 填充品牌和品类下拉框选项
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 8.5 实现通知服务
    - 创建 `web/src/lib/notification.ts`
    - 实现 `sendDesktopNotification()` 浏览器桌面通知（需用户授权）
    - 实现 `showToast()` 页面内 Toast 通知
    - 实现 `flashTabTitle()` 标签页标题闪烁
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 8.6 集成通知到报告生成流程
    - 修改报告生成页面，生成完成时调用通知服务
    - 成功时发送桌面通知 + 成功 Toast
    - 失败时显示错误 Toast 并包含失败原因
    - 用户不在当前页面时触发标签页标题闪烁
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 8.7 实现文档转图片转换器
    - 创建 `src/ingestion/document-converter.ts`
    - 使用 `pdf-to-img`（基于 pdfium）实现 PDF 逐页渲染为 PNG
    - 使用 LibreOffice headless 实现 PPT/PPTX/DOC/DOCX → PDF 转换
    - 实现 `convertDocumentToImages()` 统一入口，自动检测格式并走对应管线
    - 支持配置 DPI（默认 150）、最大页数（默认 50）
    - 安装依赖：`pdf-to-img`
    - _Requirements: 3.3_

  - [x] 8.8 实现多模态文档解析器（Vision Document Parser）
    - 创建 `src/ingestion/vision-document-parser.ts`
    - 实现 `parsePlanDocumentVision(pages, llmClient)` 函数
    - 将页面图片分批（每批 5 页）发送给 LLM Vision API
    - 使用结构化提取 prompt 要求 LLM 输出 JSON（项目目标、策略、目标人群、核心传播信息、KPI目标）
    - 合并多批次结果，去重并取置信度最高的字段值
    - 超时 60 秒，失败时返回空结果并标记错误
    - _Requirements: 3.1, 3.2, 3.6_

  - [x] 8.9 创建策划案解析 API 路由
    - 创建 `web/src/app/api/upload/plan-parse/route.ts`
    - 接受文件上传（multipart/form-data），支持 PDF/PPT/PPTX/DOC/DOCX
    - 调用 DocumentConverter → VisionParser 管线
    - 返回解析结果（项目目标、策略、目标人群、核心传播信息）
    - 解析失败时返回 `{ success: false, error: "..." }` 允许前端降级为手动填写
    - _Requirements: 3.1, 3.3, 3.4_

  - [x] 8.10 策划案解析前端集成
    - 修改 `web/src/app/projects/new/page.tsx` 项目创建向导第2步
    - 上传策划案后自动调用 `/api/upload/plan-parse` 接口
    - 显示解析进度（"正在解析策划案..."）
    - 解析完成后在确认页面展示提取的项目背景信息（可编辑）
    - 解析失败时显示"解析失败"提示并允许手动填写
    - 确认创建时将解析结果保存到 AiGeneratedContent 表
    - _Requirements: 3.1, 3.2, 3.4, 3.5_

- [x] 9. Checkpoint — 前端交互功能验证
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. 数据校验与审校台增强
  - [x] 10.1 实现数据完整性校验器
    - 创建 `src/validation/data-completeness.ts`
    - 实现 `checkDataCompleteness(projectId)` 函数
    - 检查 5 个数据源（执行底表、广告投放、外部平台、KPI目标、Benchmark）
    - 计算完整度百分比
    - 返回各数据源状态和跳转路径
    - _Requirements: 7.1, 7.2, 7.4_

  - [ ]* 10.2 Property test: 数据完整度百分比计算
    - **Property 9: Data completeness percentage calculation**
    - **Validates: Requirements 7.1, 7.4**

  - [x] 10.3 创建数据完整性 API 路由与前端展示
    - 创建 `web/src/app/api/projects/[id]/completeness/route.ts`
    - 在项目详情页展示数据完整性仪表盘
    - 未上传数据源以黄色警告标记
    - 完整度 < 50% 时在报告生成按钮旁显示警告
    - 点击未完成数据源跳转到对应上传页面
    - _Requirements: 7.1, 7.3, 7.4, 7.5, 7.6_

  - [x] 10.4 实现审校台列管理功能
    - 在审校台数据表格模块中添加"列管理"按钮
    - 显示所有可用列的复选框列表
    - 取消勾选时立即隐藏该列
    - 将操作记录为 ReviewEdit（editType='column_hide'）
    - 重新勾选时恢复列显示
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.6_

  - [ ]* 10.5 Property test: 列可见性往返一致性
    - **Property 10: Column visibility round-trip**
    - **Validates: Requirements 9.3, 9.6**

  - [ ]* 10.6 Property test: 列隐藏持久化为 ReviewEdit
    - **Property 11: Column hide persisted as ReviewEdit**
    - **Validates: Requirements 9.4**

- [x] 11. 竞品数据与 OCR 前端
  - [x] 11.1 实现竞品数据录入 API 路由
    - 创建 `web/src/app/api/upload/competitor/route.ts`
    - 接受竞品品牌名称和核心指标（曝光量、互动量、CPE、爆文率等）
    - 支持批量录入多个竞品
    - 保存到 CompetitorData 表
    - _Requirements: 13.2, 13.3, 13.4_

  - [ ]* 11.2 Property test: 竞品数据持久化
    - **Property 16: Competitor data persistence**
    - **Validates: Requirements 13.3, 13.4**

  - [ ]* 11.3 Property test: 竞品 S/A 评级触发 M6 可见
    - **Property 17: Competitor S/A rating triggers M6 visibility**
    - **Validates: Requirements 13.6**

  - [x] 11.4 实现竞品数据录入前端 UI
    - 在数据上传页面添加"竞品数据"Tab
    - 提供竞品品牌名称和指标录入表单
    - 支持动态添加多个竞品
    - 录入完成后保存并显示成功提示
    - _Requirements: 13.1, 13.2, 13.3_

  - [x] 11.5 实现 OCR 截图上传前端 UI
    - 在外部平台数据上传页面添加"截图上传"模式
    - 支持 PNG/JPG 文件选择和上传
    - 展示 OCR 识别结果供用户确认或修正
    - 高亮低置信度字段
    - 确认后保存到灵犀数据表
    - _Requirements: 5.1, 5.4, 5.5, 5.6_

- [x] 12. 状态流转集成与排版模板管理
  - [x] 12.1 集成状态机到 API 路由
    - 在数据上传 API 路由中触发 `first_upload` 转换
    - 在报告生成 API 路由中触发 `generate_triggered` 转换
    - 在报告生成完成回调中触发 `generation_complete` 转换
    - 在审校台添加"定稿"按钮，触发 `finalize` 转换
    - _Requirements: 12.2, 12.3, 12.4, 12.5_

  - [x] 12.2 实现排版模板选择 UI
    - 在导出对话框中添加模板选择下拉框
    - 调用 `listTemplates()` 获取可用模板列表
    - 选择模板后传递 templateId 到导出 API
    - 未选择时使用默认模板
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 13. Final checkpoint — 全功能集成验证
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (17 properties total)
- 基础设施（模板引擎、图表渲染器、状态机）优先实现，因为后续多个功能依赖它们
- 导出功能（PDF/Word）是最高优先级业务功能，依赖模板引擎和图表渲染器
- 前端 UI 任务可在对应后端 API 完成后并行开发
- **文档转图片依赖**：PPT/Word 转 PDF 需要系统安装 LibreOffice（`apt-get install libreoffice-core`），Docker 部署时需在镜像中预装。PDF 转图片使用 `pdf-to-img` 库（基于 pdfium，纯 Node.js binding，无额外系统依赖）
- **LLM Vision 成本控制**：策划案解析按每批 5 页发送，20 页策划案约需 4 次 API 调用。建议在开发阶段使用 `maxPages: 10` 限制以控制成本
