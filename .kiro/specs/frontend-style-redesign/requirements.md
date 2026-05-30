# Requirements Document

## Introduction

本需求文档描述"派盘盘"AI数字营销平台前端页面风格重构的视觉设计要求。重构范围仅限于前端页面展示风格（CSS/组件样式/布局），后端 API 和功能逻辑完全不变。目标是将现有的深色科技风格（slate-900/blue 色调）替换为设计稿中的橙黄色暖色调现代扁平化风格。

## Glossary

- **Design_System**: 全局设计系统，定义色彩、字体、间距、圆角等基础设计变量
- **Login_Page**: 用户登录页面组件
- **Sidebar**: 左侧垂直导航栏组件
- **Page_Header**: 页面顶部面包屑与标题区域组件
- **Data_Table**: 数据表格展示组件（项目列表、复盘列表等）
- **Form_Component**: 表单输入组件集合（输入框、下拉框、日期选择器、文件上传区等）
- **Button_Component**: 按钮组件（主按钮、次按钮、文字链接按钮）
- **Filter_Bar**: 筛选条件栏组件
- **Pagination**: 分页器组件
- **Upload_Zone**: 文件拖拽上传区域组件

## Requirements

### Requirement 1: 全局设计系统色彩变量

**User Story:** As a 用户, I want 页面整体色调统一为橙黄色暖色调, so that 视觉体验与品牌形象一致。

#### Acceptance Criteria

1. THE Design_System SHALL define the primary color as orange-yellow (HSL approximately 36 80% 55%, hex range #F5A623 to #FF9500)
2. THE Design_System SHALL define the background color as white (#FFFFFF) for content areas
3. THE Design_System SHALL define the sidebar background as white (#FFFFFF) with a right border separator
4. THE Design_System SHALL define the text primary color as dark gray (#1F2937) for body text
5. THE Design_System SHALL define the text secondary color as medium gray (#6B7280) for labels and descriptions
6. THE Design_System SHALL define the border color as light gray (#E5E7EB) for dividers and input borders
7. THE Design_System SHALL define the success color as green (#10B981) for the "新建" button variant
8. THE Design_System SHALL define the error/destructive color as red (#EF4444) for error states
9. THE Design_System SHALL define the hover state for primary buttons as a slightly darker shade of the primary orange

### Requirement 2: 全局字体与排版规范

**User Story:** As a 用户, I want 页面使用清晰易读的中文无衬线字体, so that 内容阅读体验良好。

#### Acceptance Criteria

1. THE Design_System SHALL use a Chinese sans-serif font stack ("PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif) as the base font family
2. THE Design_System SHALL set the base font size to 14px for body text
3. THE Design_System SHALL set heading font weights to 600 (semibold) for section titles
4. THE Design_System SHALL set the default line-height to 1.5 for body text
5. THE Design_System SHALL set the default border-radius to 8px for cards and containers, 6px for buttons, and 4px for input fields

### Requirement 3: 登录页布局重构

**User Story:** As a 用户, I want 登录页采用左右分栏布局展示品牌信息和登录表单, so that 登录体验更加专业和美观。

#### Acceptance Criteria

1. THE Login_Page SHALL display a left-right split layout with approximately 55:45 width ratio
2. THE Login_Page SHALL display the left panel with a light yellow/beige gradient background (from #FFF8E1 to #FFECB3 range)
3. THE Login_Page SHALL display the brand logo "派盘盘" and subtitle "AI数字营销平台" centered vertically in the left panel
4. THE Login_Page SHALL display decorative 3D cube icons in the left panel as brand visual elements
5. THE Login_Page SHALL display the right panel with a white or very light background
6. THE Login_Page SHALL display "欢迎登录" as the form title and "你的小盘 盯着每一盘" as the subtitle in the right panel
7. THE Login_Page SHALL display the username input field with a placeholder "请输入" and a left-aligned label
8. THE Login_Page SHALL display the password input field with a placeholder "请输入" and a left-aligned label
9. THE Login_Page SHALL display an "自动登录" checkbox and a "修改密码" link below the form fields
10. THE Login_Page SHALL display the login button as a full-width orange-yellow rounded button with text "登 录"
11. THE Login_Page SHALL display footer links (帮助、隐私、条款) and copyright text centered at the bottom
12. IF the viewport width is less than 768px, THEN THE Login_Page SHALL stack the left and right panels vertically with the form panel on top

### Requirement 4: 侧边导航栏样式重构

**User Story:** As a 用户, I want 侧边导航栏采用白色背景和橙色高亮风格, so that 导航清晰且与整体设计风格一致。

#### Acceptance Criteria

1. THE Sidebar SHALL display a white background (#FFFFFF) with a right border (1px solid #E5E7EB)
2. THE Sidebar SHALL display the brand logo "派盘盘" at the top with an orange icon and black text
3. THE Sidebar SHALL display navigation items with an icon (20px) and label text (14px) in dark gray (#374151) for inactive state
4. WHEN a navigation item is active, THE Sidebar SHALL highlight the item with orange text color (#F5A623) and a left orange vertical bar (3px width)
5. THE Sidebar SHALL display the user avatar and username in the top-right corner of the main content area (not inside the sidebar)
6. THE Sidebar SHALL display a logout icon at the bottom of the navigation list
7. THE Sidebar SHALL maintain a fixed width of 220px in expanded state and 64px in collapsed state
8. WHILE the Sidebar is in collapsed state, THE Sidebar SHALL display only icons without labels

### Requirement 5: 按钮组件样式规范

**User Story:** As a 用户, I want 按钮样式统一为圆角设计并使用品牌色, so that 操作入口清晰可辨。

#### Acceptance Criteria

1. THE Button_Component SHALL display primary buttons with orange-yellow background (#F5A623), white text, 6px border-radius, and 12px 24px padding
2. THE Button_Component SHALL display secondary buttons with white background, gray border (1px solid #D1D5DB), dark gray text, 6px border-radius
3. THE Button_Component SHALL display text-link buttons as orange text (#F5A623) without background or border, with underline on hover
4. THE Button_Component SHALL display the "新建" button variant with green background (#10B981) and white text
5. WHEN a primary button is hovered, THE Button_Component SHALL darken the background color by 10%
6. WHEN a button is in disabled state, THE Button_Component SHALL reduce opacity to 0.5 and show a not-allowed cursor
7. THE Button_Component SHALL display a height of 40px for standard buttons and 44px for form submit buttons

### Requirement 6: 输入框与表单组件样式规范

**User Story:** As a 用户, I want 表单输入框采用简洁线框样式, so that 表单填写体验清晰直观。

#### Acceptance Criteria

1. THE Form_Component SHALL display input fields with 1px solid border (#D1D5DB), 4px border-radius, 40px height, and 12px horizontal padding
2. THE Form_Component SHALL display placeholder text in gray (#9CA3AF) with text "请输入" as default
3. WHEN an input field is focused, THE Form_Component SHALL change the border color to orange (#F5A623) and display a 2px orange outline ring
4. THE Form_Component SHALL display form labels in 14px font-weight-500 dark gray text, positioned to the left of or above the input field
5. THE Form_Component SHALL display select/dropdown fields with the same border and sizing as text inputs, with a down-arrow indicator
6. THE Form_Component SHALL display date range pickers with the same styling as standard inputs
7. THE Form_Component SHALL display checkbox items with orange fill color when checked
8. THE Form_Component SHALL display multi-select tags as orange-outlined pills with a close icon

### Requirement 7: 数据表格样式规范

**User Story:** As a 用户, I want 数据表格简洁清晰, so that 数据浏览高效。

#### Acceptance Criteria

1. THE Data_Table SHALL display table headers with light gray background (#F9FAFB), 14px font-weight-500 text, and bottom border
2. THE Data_Table SHALL display table rows with white background, 14px regular text, and bottom border separator
3. WHEN a table row is hovered, THE Data_Table SHALL display a light gray background (#F9FAFB)
4. THE Data_Table SHALL display action links in orange text (#F5A623) with hover underline effect
5. THE Data_Table SHALL display cell padding of 12px vertical and 16px horizontal
6. THE Data_Table SHALL display the table container with white background, 8px border-radius, and 1px border (#E5E7EB)

### Requirement 8: 筛选栏样式规范

**User Story:** As a 用户, I want 筛选栏布局清晰且操作便捷, so that 数据筛选效率高。

#### Acceptance Criteria

1. THE Filter_Bar SHALL display filter controls in a horizontal row with 16px gap between items
2. THE Filter_Bar SHALL display the "查询" button as a primary orange button
3. THE Filter_Bar SHALL display the "重置" button as a secondary white button with gray border
4. THE Filter_Bar SHALL display filter labels above each control in 12px gray text
5. THE Filter_Bar SHALL wrap filter controls to the next line on smaller viewports while maintaining the gap

### Requirement 9: 分页器样式规范

**User Story:** As a 用户, I want 分页器样式与整体设计一致, so that 翻页操作直观。

#### Acceptance Criteria

1. THE Pagination SHALL display page number buttons as 32px square with 4px border-radius
2. WHEN a page number is active, THE Pagination SHALL display it with orange background (#F5A623) and white text
3. THE Pagination SHALL display inactive page numbers with white background and gray border
4. THE Pagination SHALL display previous/next arrow buttons with the same sizing as page numbers
5. THE Pagination SHALL display total record count and current page info in 14px gray text on the left side

### Requirement 10: 文件上传区域样式规范

**User Story:** As a 用户, I want 文件上传区域有明确的视觉提示, so that 上传操作清晰易懂。

#### Acceptance Criteria

1. THE Upload_Zone SHALL display a dashed border (2px dashed #D1D5DB) container with 8px border-radius and centered content
2. THE Upload_Zone SHALL display an upload icon, instructional text, and supported file format hint
3. WHEN a file is dragged over the Upload_Zone, THE Upload_Zone SHALL change the border color to orange (#F5A623) and background to light orange (#FFF8E1)
4. WHEN a file upload is in progress, THE Upload_Zone SHALL display the filename and an orange progress bar
5. WHEN a file upload succeeds, THE Upload_Zone SHALL display a green success indicator with the filename
6. IF a file upload fails, THEN THE Upload_Zone SHALL display a red error indicator with an error message

### Requirement 11: 页面头部与面包屑导航

**User Story:** As a 用户, I want 页面头部显示面包屑导航和操作按钮, so that 页面层级清晰且操作入口明确。

#### Acceptance Criteria

1. THE Page_Header SHALL display breadcrumb navigation in 14px gray text with "/" separator
2. THE Page_Header SHALL display the current page name as the last breadcrumb item in dark text without link
3. THE Page_Header SHALL display primary action buttons (e.g., "+ 开始新的复盘") centered or right-aligned below the breadcrumb
4. THE Page_Header SHALL display section divider titles (e.g., "已完成的复盘") as 16px semibold text with a bottom border

### Requirement 12: 新建复盘表单布局

**User Story:** As a 用户, I want 新建复盘表单分区清晰且布局合理, so that 复杂表单填写不会感到混乱。

#### Acceptance Criteria

1. THE Form_Component SHALL display form sections with bold black section titles (e.g., "项目信息"、"复盘背景(大盘数据)"、"复盘目标(kpi)"、"复盘报告模块")
2. THE Form_Component SHALL display form fields in a multi-column grid layout (2-3 columns) where appropriate
3. THE Form_Component SHALL display the "达人层级" section with name input and range slider/input, with a "+" button to add more levels
4. THE Form_Component SHALL display the "报告模块" section as a checkbox list with select-all/deselect-all functionality
5. THE Form_Component SHALL display the "投流周期" section with phase name and date range picker, with a "+" button to add more phases
6. THE Form_Component SHALL display the "策划方案上传" section as a dashed-border drag-and-drop area
7. THE Form_Component SHALL display the submit button "开始复盘" as a primary orange rounded button at the bottom

### Requirement 13: 响应式适配

**User Story:** As a 用户, I want 页面在不同屏幕尺寸下都能正常使用, so that 在不同设备上都有良好体验。

#### Acceptance Criteria

1. WHILE the viewport width is 1280px or above, THE Design_System SHALL display the full sidebar and multi-column layouts
2. WHILE the viewport width is between 768px and 1279px, THE Design_System SHALL collapse the sidebar to icon-only mode and reduce table columns as needed
3. WHILE the viewport width is below 768px, THE Design_System SHALL hide the sidebar behind a hamburger menu and stack form fields vertically
4. THE Data_Table SHALL enable horizontal scrolling when table content exceeds the viewport width
5. THE Filter_Bar SHALL wrap filter controls to multiple rows on viewports below 1024px

### Requirement 14: 全局过渡动画与交互反馈

**User Story:** As a 用户, I want 页面交互有平滑的过渡效果, so that 操作体验流畅自然。

#### Acceptance Criteria

1. THE Design_System SHALL apply a 200ms ease transition to all color and background-color changes on interactive elements
2. THE Design_System SHALL apply a 200ms ease transition to sidebar expand/collapse width changes
3. WHEN a button or link is clicked, THE Design_System SHALL provide visual feedback within 100ms (e.g., slight scale or opacity change)
4. THE Design_System SHALL apply a fade-in transition (200ms) to dropdown menus and modal overlays when they appear
