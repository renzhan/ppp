# Requirements Document — MVP 功能差距分析

## Introduction

本文档基于 MVP 功能清单与当前代码实现的对比分析，识别出已实现、部分实现、未实现和有差异的功能模块。针对未完成或有差异的功能，编写详细的需求描述，以指导后续开发补齐 MVP 功能。

系统为小红书营销复盘报告自动生成平台，核心流程为：项目创建 → 数据采集 → 计算分析 → 智能决策 → 叙事生成 → 审校编辑 → 报告导出。

## Glossary

- **System**: 小红书营销复盘报告生成系统
- **Export_Engine**: 报告导出引擎，负责将报告内容转换为 PDF/Word 格式文件
- **Plan_Parser**: 策划案解析器，负责从上传的策划案文件中提取项目背景信息
- **Filter_Service**: 筛选服务，负责从数据库动态加载品牌/品类选项供前端筛选使用
- **OCR_Service**: OCR 数据采集服务，负责从灵犀平台截图中提取结构化数据
- **Chart_Renderer**: 图表渲染器，负责在导出文件中正确呈现可视化图表
- **Data_Validator**: 数据校验器，负责在数据上传时进行完整性和格式校验
- **Notification_Service**: 通知服务，负责在报告生成完成或失败时通知用户
- **Template_Engine**: 模板引擎，负责管理和渲染报告的排版模板

## 功能状态总览

| 模块 | 状态 | 说明 |
|------|------|------|
| 项目管理（CRUD） | ✅ 已实现 | 项目创建、列表、详情、筛选、分页 |
| 数据采集 - 执行底表上传 | ✅ 已实现 | Excel 解析、蒲公英+业务标注 |
| 数据采集 - 广告投放上传 | ✅ 已实现 | 聚光数据解析入库 |
| 数据采集 - 外部平台上传 | ✅ 已实现 | 灵犀 Excel 数据解析 |
| 数据采集 - 人工录入 | ✅ 已实现 | KPI目标、Benchmark、搜索指数 |
| 数据采集 - 派查查 API | ✅ 已实现 | 蒲公英+聚光 API 拉取 |
| 计算引擎 | ✅ 已实现 | 全部核心指标计算 |
| 评级引擎 | ✅ 已实现 | S/A/B/C/D 五级评级 |
| 决策引擎 | ✅ 已实现 | 8模块显示/隐藏/降级 |
| 叙事引擎 | ✅ 已实现 | YAML模板+LLM生成+问题转机会 |
| 报告生成管线 | ✅ 已实现 | 评级→决策→叙事→组装 |
| 审校台 | ✅ 已实现 | 三栏布局、段落编辑、AI问答 |
| 版本管理 | ✅ 已实现 | 版本列表、对比、复制 |
| 报告导出 - Word | ⚠️ 部分实现 | 基础 docx 生成已实现，但缺少图表嵌入和排版模板 |
| 报告导出 - PDF | ❌ 未实现 | 返回 501 错误 |
| 策划案 AI 解析 | ⚠️ 部分实现 | 后端解析逻辑已实现，前端未调用接口 |
| 品牌/品类动态筛选 | ⚠️ 部分实现 | 前端下拉框存在但选项为空 |
| OCR 数据采集 | ❌ 未实现 | 灵犀截图 OCR 提取未实现 |
| 图表导出嵌入 | ❌ 未实现 | 导出文件中无图表 |
| 数据完整性校验提示 | ⚠️ 部分实现 | 上传有基础校验，但缺少全局数据完整性仪表盘 |
| 多用户协作 | ❌ 未实现 | 无用户认证和权限管理 |

## Requirements

### Requirement 1: PDF 报告导出

**User Story:** As a 营销策划人员, I want 将复盘报告导出为 PDF 格式, so that 我可以直接发送给客户或用于内部汇报。

**状态：❌ 未实现** — 当前 PDF 导出返回 501 错误，仅有 JSON 导出和基础 Word 导出。

#### Acceptance Criteria

1. WHEN 用户在审校台点击"导出PDF"按钮, THE Export_Engine SHALL 生成包含完整报告内容的 PDF 文件并触发浏览器下载。
2. THE Export_Engine SHALL 在 PDF 文件中保留报告的标题层级、段落格式和表格布局。
3. WHEN 报告包含图表数据, THE Export_Engine SHALL 将图表渲染为静态图片嵌入 PDF 文件中。
4. THE Export_Engine SHALL 在 PDF 首页包含项目名称、品牌、品类、项目类型和生成日期。
5. IF PDF 生成过程中发生错误, THEN THE Export_Engine SHALL 返回包含错误原因的提示信息，并标记为可重试。
6. THE Export_Engine SHALL 在 30 秒内完成单份报告的 PDF 生成。

---

### Requirement 2: Word 报告导出增强（图表嵌入与排版模板）

**User Story:** As a 营销策划人员, I want Word 导出文件包含图表和专业排版, so that 导出的文件可以直接用于客户提案而无需手动排版。

**状态：⚠️ 部分实现** — 基础 docx 文本导出已实现，但缺少图表嵌入和排版模板。

#### Acceptance Criteria

1. WHEN 用户导出 Word 格式报告, THE Export_Engine SHALL 将报告中的图表（饼图、柱状图、折线图、雷达图、漏斗图）渲染为图片嵌入 docx 文件。
2. THE Export_Engine SHALL 应用预定义的排版模板，包含统一的字体、字号、行距和页边距设置。
3. THE Export_Engine SHALL 在 Word 文件中正确渲染数据表格，包含表头样式和交替行背景色。
4. WHEN 模块状态为"隐藏", THE Export_Engine SHALL 在导出文件中排除该模块内容。
5. WHEN 模块状态为"降级", THE Export_Engine SHALL 在导出文件中标注该模块数据不完整。

---

### Requirement 3: 策划案 AI 解析前端集成

**User Story:** As a 项目经理, I want 上传策划案后系统自动提取项目背景信息, so that 我不需要手动填写项目目标、策略和目标人群等信息。

**状态：⚠️ 部分实现** — 后端 `parsePlanDocument` 已实现 LLM 解析逻辑，但前端创建向导第2步上传策划案后未调用解析接口。

#### Acceptance Criteria

1. WHEN 用户在项目创建向导第2步上传策划案文件, THE Plan_Parser SHALL 自动调用 AI 解析接口提取项目背景信息。
2. WHEN AI 解析完成, THE System SHALL 在确认页面展示提取的项目目标、策略、目标人群和核心传播信息。
3. THE Plan_Parser SHALL 支持 PDF 和 Word（docx）格式的策划案文件解析。
4. IF AI 解析失败或超时, THEN THE System SHALL 显示"解析失败"提示，并允许用户手动填写项目背景信息。
5. WHEN 用户确认创建项目, THE System SHALL 将解析得到的项目背景信息保存到数据库。
6. THE Plan_Parser SHALL 在 60 秒内完成单份策划案文件的解析。

---

### Requirement 4: 品牌/品类动态筛选器

**User Story:** As a 项目经理, I want 在项目列表页通过品牌和品类筛选项目, so that 我可以快速找到特定品牌或品类的项目。

**状态：⚠️ 部分实现** — 前端筛选下拉框 UI 已存在，但选项列表为空（硬编码空 `<option>` 标签），未从数据库动态加载。

#### Acceptance Criteria

1. WHEN 项目列表页加载时, THE Filter_Service SHALL 从数据库查询所有已存在的品牌名称并填充品牌筛选下拉框。
2. WHEN 项目列表页加载时, THE Filter_Service SHALL 从数据库查询所有已存在的品类名称并填充品类筛选下拉框。
3. WHEN 用户选择某个品牌筛选条件, THE System SHALL 仅显示属于该品牌的项目。
4. WHEN 用户选择某个品类筛选条件, THE System SHALL 仅显示属于该品类的项目。
5. WHEN 新项目创建后, THE Filter_Service SHALL 在下次加载时包含新项目的品牌和品类选项。
6. THE Filter_Service SHALL 对品牌和品类选项进行去重和按字母/拼音排序。

---

### Requirement 5: 灵犀平台 OCR 数据采集

**User Story:** As a 数据分析师, I want 通过上传灵犀平台截图自动提取数据, so that 我不需要手动从截图中抄录数据到 Excel 再上传。

**状态：❌ 未实现** — 当前仅支持灵犀 Excel 底表上传，无截图 OCR 功能。

#### Acceptance Criteria

1. WHEN 用户在外部平台数据上传页面选择"截图上传"模式, THE OCR_Service SHALL 接受 PNG/JPG 格式的灵犀平台截图。
2. WHEN 截图上传完成, THE OCR_Service SHALL 识别截图中的表格结构和数值数据。
3. THE OCR_Service SHALL 从灵犀截图中提取 AIPS 人群流转数据、品牌排名数据、SOC/SOV 数据和 SPU 排名数据。
4. WHEN OCR 识别完成, THE System SHALL 展示识别结果供用户确认或修正。
5. IF OCR 识别置信度低于 80%, THEN THE System SHALL 高亮标记低置信度字段并提示用户人工核验。
6. WHEN 用户确认识别结果, THE System SHALL 将数据保存到灵犀数据表中。
7. THE OCR_Service SHALL 在 30 秒内完成单张截图的识别处理。

---

### Requirement 6: 图表在导出文件中的正确呈现

**User Story:** As a 营销策划人员, I want 导出的报告文件中包含与审校台一致的图表, so that 客户可以直观地看到数据可视化结果。

**状态：❌ 未实现** — 前端有图表组件（饼图、漏斗图、柱状图、雷达图、折线图），但导出文件中无图表。

#### Acceptance Criteria

1. THE Chart_Renderer SHALL 将前端图表组件渲染为 PNG 图片格式。
2. WHEN 导出 Word 格式时, THE Chart_Renderer SHALL 将图表图片以内联方式嵌入 docx 文件对应模块位置。
3. WHEN 导出 PDF 格式时, THE Chart_Renderer SHALL 将图表图片嵌入 PDF 文件对应模块位置。
4. THE Chart_Renderer SHALL 保持图表在导出文件中的宽度不超过页面可用宽度。
5. THE Chart_Renderer SHALL 确保图表图片分辨率不低于 150 DPI 以保证打印清晰度。
6. WHEN 某模块无图表数据时, THE Chart_Renderer SHALL 跳过该模块的图表渲染。

---

### Requirement 7: 数据完整性校验与仪表盘

**User Story:** As a 项目经理, I want 在生成报告前看到数据完整性状态, so that 我知道哪些数据还需要补充才能生成完整的报告。

**状态：⚠️ 部分实现** — 上传时有基础格式校验，决策引擎有数据完整性判断，但缺少面向用户的数据完整性仪表盘。

#### Acceptance Criteria

1. WHEN 用户进入项目详情页, THE Data_Validator SHALL 展示各数据源的上传状态（已上传/未上传/部分上传）。
2. THE Data_Validator SHALL 检查以下数据源完整性：执行底表、广告投放底表、外部平台数据、KPI 目标值、Benchmark 数据。
3. WHEN 某数据源未上传, THE System SHALL 以黄色警告标记该数据源并提示"缺少此数据将导致相关模块降级或隐藏"。
4. THE Data_Validator SHALL 计算整体数据完整度百分比并在项目详情页显示。
5. WHEN 数据完整度低于 50%, THE System SHALL 在报告生成按钮旁显示警告提示。
6. WHEN 用户点击某个未完成的数据源, THE System SHALL 跳转到对应的数据上传页面。

---

### Requirement 8: 报告生成完成通知

**User Story:** As a 项目经理, I want 报告生成完成后收到通知, so that 我不需要一直停留在生成页面等待。

**状态：❌ 未实现** — 当前仅有轮询进度条，无主动通知机制。

#### Acceptance Criteria

1. WHEN 报告生成完成, THE Notification_Service SHALL 在浏览器中发送桌面通知（如用户已授权）。
2. WHEN 报告生成完成, THE Notification_Service SHALL 在页面顶部显示成功提示横幅。
3. IF 报告生成失败, THEN THE Notification_Service SHALL 在页面顶部显示错误提示横幅并包含失败原因。
4. WHEN 用户不在生成页面时, THE Notification_Service SHALL 通过浏览器标签页标题闪烁提示生成完成。

---

### Requirement 9: 审校台列管理功能

**User Story:** As a 营销策划人员, I want 在审校台中控制数据表格的列显示, so that 我可以隐藏不需要展示给客户的数据列。

**状态：⚠️ 部分实现** — 审校台有编辑功能，ReviewEdit 模型支持 `column_hide` 类型，但前端列管理 UI 交互需要验证完整性。

#### Acceptance Criteria

1. WHEN 用户在审校台查看包含数据表格的模块, THE System SHALL 提供"列管理"按钮。
2. WHEN 用户点击"列管理"按钮, THE System SHALL 显示所有可用列的复选框列表。
3. WHEN 用户取消勾选某列, THE System SHALL 立即在预览中隐藏该列。
4. THE System SHALL 将列隐藏操作记录为 ReviewEdit（editType='column_hide'）。
5. WHEN 导出报告时, THE Export_Engine SHALL 排除被隐藏的列。
6. WHEN 用户重新勾选已隐藏的列, THE System SHALL 恢复该列的显示。

---

### Requirement 10: 派查查 API 数据自动拉取触发

**User Story:** As a 数据分析师, I want 在项目详情页一键触发派查查 API 数据拉取, so that 我不需要手动导出再上传蒲公英和聚光数据。

**状态：⚠️ 部分实现** — 后端 `DataIngestionService.ingestFromAPI` 已实现，但前端缺少触发入口和笔记 ID 输入界面。

#### Acceptance Criteria

1. WHEN 用户在数据上传页面选择"API 拉取"模式, THE System SHALL 显示笔记 ID 输入区域。
2. THE System SHALL 支持批量输入笔记 ID（每行一个或逗号分隔）。
3. WHEN 用户点击"开始拉取"按钮, THE System SHALL 调用派查查 API 获取蒲公英和聚光数据。
4. WHILE API 数据拉取进行中, THE System SHALL 显示拉取进度和已完成数量。
5. WHEN API 拉取完成, THE System SHALL 显示成功/失败笔记数量汇总。
6. IF 部分笔记拉取失败, THEN THE System SHALL 列出失败的笔记 ID 和失败原因。
7. THE System SHALL 将成功拉取的数据自动保存到数据库。

---

### Requirement 11: 报告排版模板管理

**User Story:** As a 营销策划人员, I want 选择不同的报告排版模板, so that 导出的报告可以匹配不同客户的品牌风格。

**状态：❌ 未实现** — 当前导出使用硬编码的基础样式，无模板选择功能。

#### Acceptance Criteria

1. THE Template_Engine SHALL 提供至少一套默认报告排版模板。
2. WHEN 用户在导出前选择排版模板, THE Export_Engine SHALL 按照所选模板的样式生成导出文件。
3. THE Template_Engine SHALL 定义模板中的字体、颜色方案、Logo 位置和页眉页脚样式。
4. THE Template_Engine SHALL 确保模板样式在 Word 和 PDF 导出中保持一致。
5. WHERE 用户未选择模板, THE Export_Engine SHALL 使用默认模板生成导出文件。

---

### Requirement 12: 项目状态流转自动化

**User Story:** As a 项目经理, I want 项目状态随操作自动流转, so that 我可以在项目列表中直观看到每个项目的当前阶段。

**状态：⚠️ 部分实现** — 前端有状态标签显示（draft/uploading/generating/reviewing/finalized），但状态流转逻辑未完全自动化。

#### Acceptance Criteria

1. WHEN 项目创建完成, THE System SHALL 将项目状态设置为"draft"。
2. WHEN 用户首次上传数据, THE System SHALL 将项目状态从"draft"更新为"uploading"。
3. WHEN 用户触发报告生成, THE System SHALL 将项目状态更新为"generating"。
4. WHEN 报告生成完成, THE System SHALL 将项目状态更新为"reviewing"。
5. WHEN 用户在审校台点击"定稿"按钮, THE System SHALL 将项目状态更新为"finalized"。
6. THE System SHALL 在项目列表页以不同颜色标签展示各状态。

---

### Requirement 13: 竞品数据录入与对比

**User Story:** As a 数据分析师, I want 录入竞品数据并与本项目进行对比分析, so that 报告中可以展示竞品对比洞察。

**状态：⚠️ 部分实现** — 数据库有 CompetitorData 模型，决策引擎有竞品评级逻辑，但缺少前端竞品数据录入界面。

#### Acceptance Criteria

1. WHEN 用户在数据上传页面选择"竞品数据"Tab, THE System SHALL 显示竞品数据录入表单。
2. THE System SHALL 支持录入竞品品牌名称和核心指标（曝光量、互动量、CPE、爆文率等）。
3. THE System SHALL 支持录入多个竞品品牌的数据。
4. WHEN 竞品数据录入完成, THE System SHALL 将数据保存到 CompetitorData 表。
5. WHEN 报告生成时, THE System SHALL 将竞品数据纳入评级引擎进行对比分析。
6. IF 竞品数据中存在 S/A 级表现, THEN THE System SHALL 在报告中显示竞品洞察模块（M6）。

