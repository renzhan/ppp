# Requirements Document

## Introduction

审校页面（Review Page）重新设计。当前审校页面采用三栏布局（左侧模块导航、中间内容编辑、右侧 AI 助手/PPT 面板），嵌入的 presenton 编辑器以 iframe 形式加载。本次重设计旨在简化 ppp_pi 审校页面布局（移除冗余工具栏和右侧面板），同时改造 presenton 编辑器的左侧面板（将幻灯片缩略图替换为章节目录导航）。

涉及两个项目：
- **ppp_pi**：营销复盘审校系统主项目
- **presenton**：嵌入式 PPT 编辑器项目

## Glossary

- **Review_Page**: ppp_pi 中的审校页面，路径为 `projects/[id]/review/[versionId]/page.tsx`
- **ReviewToolbar**: 审校页面顶部工具栏组件，包含项目名称、语气切换、列管理、导出等功能
- **PptPanel**: ppp_pi 中的 PPT 面板组件，fullWidth 模式下显示工具栏（含"下载 PPTX"和"重新生成"按钮）及 iframe
- **Right_Sidebar**: 审校页面右侧面板，包含"AI 助手"和"PPT"两个 tab
- **Presenton_Iframe**: 嵌入审校页面的 presenton 编辑器 iframe
- **Presenton_Editor**: presenton 项目中的演示文稿编辑器页面
- **SidePanel**: presenton 编辑器左侧面板组件，当前显示幻灯片缩略图
- **Chapter_Directory**: 替换 SidePanel 的章节目录导航组件

## Requirements

### Requirement 1: 移除审校页面顶部工具栏

**User Story:** As a 审校人员, I want 审校页面不再显示包含"下载 PPTX"和"重新生成"按钮的工具栏行, so that 页面更简洁且不与 presenton 编辑器内置功能重复。

#### Acceptance Criteria

1. WHEN the Review_Page loads, THE Review_Page SHALL NOT render the PptPanel fullWidth toolbar row containing "下载 PPTX" and "重新生成" buttons.
2. WHEN the Review_Page loads, THE Review_Page SHALL NOT render the ReviewToolbar component at the top of the page.
3. THE Review_Page SHALL retain the ability to display the presenton iframe without any intermediary toolbar above it.

### Requirement 2: 移除审校页面右侧面板

**User Story:** As a 审校人员, I want 审校页面不再显示右侧的"AI 助手"和"PPT"tab 面板, so that 页面空间完全留给 presenton 编辑器（其已内置 AI 助手功能）。

#### Acceptance Criteria

1. WHEN the Review_Page loads, THE Review_Page SHALL NOT render the Right_Sidebar containing "AI 助手" and "PPT" tabs.
2. THE Review_Page SHALL NOT render the AIChatPanel component.
3. THE Review_Page SHALL NOT render the PptPanel component in sidebar mode.
4. THE Review_Page SHALL use the freed right-side space to expand the Presenton_Iframe display area.

### Requirement 3: 直接加载 Presenton Iframe

**User Story:** As a 审校人员, I want 进入审校页面时直接看到 presenton 编辑器, so that 无需额外点击"PPT"tab 即可开始工作。

#### Acceptance Criteria

1. WHEN the Review_Page loads and a presentationId is available, THE Review_Page SHALL immediately render the Presenton_Iframe in the main content area.
2. THE Presenton_Iframe SHALL occupy the full width of the area to the right of the left module navigation panel.
3. THE Presenton_Iframe SHALL occupy the full remaining height of the viewport.
4. IF no presentationId is available, THEN THE Review_Page SHALL display a prompt to generate the PPT.

### Requirement 4: 审校页面保留左侧模块导航

**User Story:** As a 审校人员, I want 左侧模块导航面板保持不变, so that 我仍然可以在不同模块之间切换查看内容。

#### Acceptance Criteria

1. THE Review_Page SHALL continue to render the left module navigation panel (ModuleNavTree).
2. THE Review_Page SHALL allow collapsing and expanding the left module navigation panel.
3. WHEN a module is selected in the left navigation, THE Review_Page SHALL communicate the selected module to the Presenton_Iframe (for future chapter navigation synchronization).

### Requirement 5: Presenton 左侧面板替换为章节目录

**User Story:** As a 审校人员, I want presenton 编辑器左侧显示章节目录而非幻灯片缩略图, so that 我可以按报告章节结构快速导航到对应幻灯片。

#### Acceptance Criteria

1. WHEN the Presenton_Editor loads, THE SidePanel SHALL display a Chapter_Directory instead of slide thumbnails.
2. THE Chapter_Directory SHALL display chapter names in Chinese.
3. WHEN a chapter item in the Chapter_Directory is clicked, THE Presenton_Editor SHALL scroll to the first slide belonging to that chapter.
4. THE Chapter_Directory SHALL visually indicate which chapter corresponds to the currently viewed slide.

### Requirement 6: 章节目录遵循指定顺序

**User Story:** As a 审校人员, I want 章节目录按照固定的报告结构顺序排列, so that 导航顺序与复盘报告逻辑一致。

#### Acceptance Criteria

1. THE Chapter_Directory SHALL display chapters in the following fixed order:
   - 1. 项目背景
     - 1.1 传播目的
     - 1.2 策略回顾
   - 2. 数据总揽
   - 3. 项目亮点
   - 4. 综合分析
   - 5. 内容分析
   - 6. 人群资产分析
   - 7. 投流分析
   - 8. 竞品分析
   - 9. 优化建议
2. THE Chapter_Directory SHALL support hierarchical display with parent chapters and sub-chapters (indented).
3. WHEN a parent chapter with sub-chapters is clicked, THE Chapter_Directory SHALL expand to show its sub-chapters.

### Requirement 7: Presenton 界面中文化

**User Story:** As a 审校人员, I want presenton 编辑器界面使用中文, so that 与 ppp_pi 系统语言保持一致。

#### Acceptance Criteria

1. THE Presenton_Editor SHALL display all UI labels, buttons, and tooltips in Chinese.
2. THE SidePanel "Add Slide" button label SHALL display as "添加幻灯片".
3. THE Chapter_Directory SHALL display all chapter names in Chinese as specified in Requirement 6.
4. THE Presenton_Editor error messages and loading states SHALL display in Chinese.
