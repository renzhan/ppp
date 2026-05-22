# Implementation Plan: 页面改版V2 (page-redesign-v2)

## Overview

本实现计划将页面改版V2设计拆分为可执行的编码任务，按照数据库变更→后端API→前端共享组件→前端页面的依赖顺序组织。每个任务引用具体需求条款，确保完整覆盖。

## Tasks

- [ ] 1. 数据库Schema变更与迁移
  - [ ] 1.1 扩展 Project 表，新增字段
    - 在 `prisma/schema.prisma` 的 Project model 中添加 `businessLine`、`createdBy`、`participants`、`isImported`、`noteCount` 字段
    - 添加 `reviewConfigs ReviewConfig[]` 关系
    - _Requirements: 4.1, 5.2, 7.3, 7.4, 8.4_

  - [ ] 1.2 新增 ProjectTreeNode 表
    - 在 `prisma/schema.prisma` 中创建 `ProjectTreeNode` model，包含 `category`、`brand`、`businessLine`、`importBatchId` 字段
    - 添加 `@@unique([category, brand, businessLine])` 约束和索引
    - _Requirements: 5.3, 5.6, 7.1_

  - [ ] 1.3 新增 ReviewConfig 表
    - 在 `prisma/schema.prisma` 中创建 `ReviewConfig` model，包含 benchmark、influencerTiers、kpiTargets、modules、launchPhases 等 JSON 字段
    - 添加与 Project 的关系和索引
    - _Requirements: 10.1, 10.2, 10.3, 11.1, 12.1, 12.4, 13.1_

  - [ ] 1.4 新增 SentimentData 表
    - 在 `prisma/schema.prisma` 中创建 `SentimentData` model，包含 `dataType`、`dataContent`、`periodStart`、`periodEnd` 字段
    - 添加 `@@index([projectId, dataType])` 复合索引
    - _Requirements: 17.3, 18.1, 18.2, 18.3, 18.4_

  - [ ] 1.5 新增 ExportRecord 表
    - 在 `prisma/schema.prisma` 中创建 `ExportRecord` model，包含 `exportType`、`fileName`、`fileUrl`、`exportedBy` 字段
    - _Requirements: 19.2, 19.4_

  - [ ] 1.6 生成并运行数据库迁移
    - 运行 `npx prisma migrate dev --name page_redesign_v2` 生成迁移文件
    - 验证迁移成功执行，Prisma Client 重新生成
    - _Requirements: 1.1-19.4 (所有数据模型基础)_

- [ ] 2. Checkpoint - 确认数据库迁移成功
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. 后端API - 树结构与项目底表导入
  - [ ] 3.1 实现树结构查询 API
    - 创建 `web/src/app/api/tree-structure/route.ts`
    - 查询 `project_tree_nodes` 表，构建嵌套树结构 `[{category, children: [{brand, children: [{businessLine}]}]}]`
    - 返回供级联选择器使用的数据
    - _Requirements: 7.1, 5.3_

  - [ ] 3.2 实现树结构构建工具函数
    - 创建 `web/src/lib/tree-builder.ts`
    - 实现 `buildTreeStructure(rows)` 函数：将扁平行数据转换为嵌套树
    - 实现 `flattenTreeToTuples(tree)` 函数：将树结构展平为元组集合
    - _Requirements: 5.3, 5.6_

  - [ ]* 3.3 Property test: 树结构生成正确性
    - **Property 3: Tree structure generation from project base table**
    - 使用 fast-check 验证：任意 (category, brand, businessLine) 元组集合生成的树结构包含且仅包含去重后的唯一组合
    - **Validates: Requirements 5.3, 5.4, 5.6**

  - [ ] 3.4 实现项目底表导入 API
    - 创建 `web/src/app/api/admin/import/project-base/route.ts`
    - 接受 multipart/form-data 上传 .xlsx 文件
    - 使用 xlsx 库解析品类、品牌、业务线、项目名称、立项时间、创建者字段
    - 批量 upsert projects 表（标记 isImported=true）
    - 去重后 upsert project_tree_nodes 表
    - 返回 `{ imported, treeNodesCreated, errors }`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ]* 3.5 Property test: 文件格式校验
    - **Property 7: File type validation for project base table**
    - 使用 fast-check 验证：任意非 .xlsx 扩展名的文件应被拒绝并返回错误
    - **Validates: Requirements 5.1, 5.7**

- [ ] 4. 后端API - 项目列表扩展与笔记底表
  - [ ] 4.1 扩展项目列表 API
    - 修改 `web/src/app/api/projects/route.ts`
    - 新增查询参数：`businessLine`、`dateFrom`、`dateTo`、`createdBy`
    - 返回新增字段：`businessLine`、`createdBy`(displayName)、`noteCount`、`participants`
    - _Requirements: 4.1, 4.3, 4.4, 4.5_

  - [ ]* 4.2 Property test: 项目列表筛选正确性
    - **Property 5: Project list filter correctness**
    - 使用 fast-check 验证：任意筛选条件组合下，返回的项目均满足所有筛选条件
    - **Validates: Requirements 4.5**

  - [ ] 4.3 实现笔记底表上传 API
    - 创建 `web/src/app/api/upload/note-base/[projectId]/route.ts`
    - 接受 .xlsx 文件，解析 40+ 字段（序号、博主昵称、博主粉丝量、笔记链接等）
    - 事务操作：删除该项目所有 notes → 批量写入新数据 → 更新 project.noteCount
    - 返回 `{ success: true, noteCount }`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 4.4 Property test: 笔记底表全量覆盖
    - **Property 4: Note base table full overwrite**
    - 使用 fast-check 验证：上传新笔记底表后，数据库中该项目的笔记数量等于新文件的行数，旧数据完全清除
    - **Validates: Requirements 8.3**

- [ ] 5. 后端API - 复盘系统
  - [ ] 5.1 实现复盘列表与创建 API
    - 创建 `web/src/app/api/reviews/route.ts`
    - GET: 查询 review_configs 列表，关联 project 信息，返回项目名称、复盘者、更新时间
    - POST: 创建 ReviewConfig 记录，检查关联项目 noteCount > 0
    - _Requirements: 9.1, 9.2, 13.4, 13.5, 13.7_

  - [ ] 5.2 实现复盘详情与更新 API
    - 创建 `web/src/app/api/reviews/[id]/route.ts`
    - GET: 返回完整复盘配置信息
    - PUT: 更新复盘配置
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

  - [ ] 5.3 实现策划方案上传 API
    - 创建 `web/src/app/api/reviews/[id]/plan-upload/route.ts`
    - 接受 .pdf/.docx/.doc/.pptx/.ppt 格式文件
    - 存储文件并更新 ReviewConfig 的 planFileUrl 和 planFileName
    - _Requirements: 13.1, 13.2, 13.3_

  - [ ] 5.4 实现复盘报告内容 API
    - 创建 `web/src/app/api/reviews/[id]/report/route.ts`
    - GET: 获取报告内容
    - PUT: 保存编辑后的报告内容
    - _Requirements: 14.7, 15.5_

- [ ] 6. 后端API - 舆情系统与导出
  - [ ] 6.1 实现舆情数据查询 API
    - 创建 `web/src/app/api/sentiment/[projectId]/route.ts`
    - 查询 sentiment_data 表，按 dataType 分组返回情感分布、趋势、关键词、负向评论数据
    - _Requirements: 17.2, 17.3, 18.1, 18.2, 18.3, 18.4_

  - [ ] 6.2 实现舆情导出 API
    - 创建 `web/src/app/api/sentiment/[projectId]/export/route.ts`
    - 生成导出文件，创建 ExportRecord 记录
    - _Requirements: 19.1, 19.3, 19.4_

  - [ ] 6.3 实现导出记录查询 API
    - 创建 `web/src/app/api/sentiment/export-records/route.ts`
    - 查询 export_records 表，返回历史导出记录列表
    - _Requirements: 19.2, 19.4_

- [ ] 7. Checkpoint - 确认后端API完成
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. 前端共享组件 - 导航栏重构
  - [ ] 8.1 重构 Sidebar 组件
    - 修改 `web/src/components/layout/sidebar.tsx`
    - 更新导航项：项目管理、复盘系统、策划系统、舆情系统、账户管理(admin)、系统设置(admin)
    - 样式变更：`bg-white` → `bg-slate-900`，文字 `text-slate-300`，高亮 `bg-white/10 text-white`
    - Logo 区域显示"派盘盘"品牌名
    - 更新图标：FolderKanban, BarChart3, Lightbulb, MessageCircle, Users, Settings
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 8.2 Property test: 角色权限导航可见性
    - **Property 1: Role-based sidebar visibility**
    - 使用 fast-check 验证：admin 角色可见所有导航项，user 角色不可见"账户管理"和"系统设置"
    - **Validates: Requirements 3.2, 3.3**

- [ ] 9. 前端共享组件 - 级联选择器
  - [ ] 9.1 实现 CascadeSelector 组件
    - 创建 `web/src/components/form/cascade-selector.tsx`
    - 实现三级联动：品类→品牌→业务线
    - 选择上级时过滤下级选项，上级变更时清空下级选择
    - 从 `/api/tree-structure` 获取数据源
    - _Requirements: 7.1_

  - [ ]* 9.2 Property test: 级联选择器父子过滤
    - **Property 2: Cascade selector parent-child filtering**
    - 使用 fast-check 验证：选择品类后品牌选项仅包含该品类下的品牌，选择品牌后业务线选项仅包含该品牌下的业务线
    - **Validates: Requirements 7.1**

- [ ] 10. 前端共享组件 - 笔记底表上传
  - [ ] 10.1 实现 NoteBaseUploader 组件
    - 创建 `web/src/components/form/note-base-uploader.tsx`
    - 仅接受 .xlsx 格式文件
    - 上传成功显示笔记数量，失败显示错误原因
    - 支持 projectId 参数（编辑时使用）
    - _Requirements: 8.1, 8.4, 8.5_

- [ ] 11. 前端页面 - 登录页品牌升级
  - [ ] 11.1 重构登录页
    - 修改 `web/src/app/login/page.tsx`
    - 主标题改为"派盘盘"，副标题改为"数字营销AI 交付与资产沉淀平台"
    - 添加页面底部链接：帮助、隐私、条款、版权声明"copyright © 2026 派芽技术部出品"
    - 保留科技感背景设计（居中卡片式布局）
    - 添加"自动登录"复选框（复用现有 rememberMe）
    - 添加"修改密码"链接入口
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 12. 前端页面 - 项目列表表格化
  - [ ] 12.1 重构项目列表页为表格布局
    - 修改 `web/src/app/page.tsx`
    - 将卡片布局改为表格布局，展示字段：品类、品牌、业务线、项目名称、创建者、笔记数量、立项时间、参与者、操作
    - 操作列按钮：编辑、复盘、策划、舆情监控
    - 更新筛选器：品类、品牌、产品线、项目名称、立项日期范围
    - 保留"新建项目"按钮入口
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [ ] 13. 前端页面 - 系统设置
  - [ ] 13.1 创建系统设置页面
    - 创建 `web/src/app/admin/settings/page.tsx`
    - 实现项目底表上传区域（仅 .xlsx），调用 `/api/admin/import/project-base`
    - 显示导入结果（导入数量、树节点创建数量、错误信息）
    - 实现个人密码修改功能（当前密码、新密码、确认新密码）
    - _Requirements: 5.1, 5.2, 5.7, 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 14. 前端页面 - 新建项目
  - [ ] 14.1 重构新建项目页面
    - 修改 `web/src/app/projects/new/page.tsx`
    - 使用 CascadeSelector 替换现有品类/品牌输入框
    - 项目名称支持从已导入项目中候选选择 + 自定义输入
    - 自动设置当前用户为创建者（不可修改）
    - 添加参与者选择器（多选，从用户列表中选择）
    - 添加立项时间选择器（默认当前时间）
    - 集成 NoteBaseUploader 组件（可选，创建时可不填）
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.1_

- [ ] 15. Checkpoint - 确认基础页面完成
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. 前端页面 - 复盘列表
  - [ ] 16.1 创建复盘列表页面
    - 创建 `web/src/app/review/page.tsx`
    - 顶部"开始新的复盘"按钮
    - 表格展示：项目名称、复盘者、更新时间、操作（编辑、审校台）
    - 点击按钮导航到对应页面
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [ ] 17. 前端页面 - 新建复盘
  - [ ] 17.1 创建新建复盘页面
    - 创建 `web/src/app/review/new/page.tsx`
    - 项目信息区域：CascadeSelector + 项目名称选择器
    - 复盘背景（大盘数据）：CTR、CPM、CPC、CPE、互动率输入
    - 达人层级配置：默认3项（头部/腰部/尾部），支持增删
    - KPI目标配置：总曝光、总阅读、总互动、千爆文数、万爆文数、效率指标、人群资产
    - 统计口径选择：互动统计口径、爆文统计口径
    - 报告模块开关：9个模块独立开关
    - 投流周期配置：默认3项（预热期/爆发期/持续期），支持增删
    - 策划方案上传：支持 .pdf/.docx/.doc/.pptx/.ppt
    - "开始复盘"按钮：检查笔记底表，提交创建
    - _Requirements: 10.1-10.5, 11.1-11.5, 12.1-12.5, 13.1-13.7_

  - [ ]* 17.2 Property test: 报告模块开关独立性
    - **Property 6: Report module toggle independence**
    - 使用 fast-check 验证：切换任一模块开关只影响该模块状态，其他模块状态不变
    - **Validates: Requirements 12.1, 12.2**

- [ ] 18. 前端页面 - 复盘详情
  - [ ] 18.1 创建复盘详情页面
    - 创建 `web/src/app/review/[id]/page.tsx`
    - 展示项目信息、大盘数据、KPI配置、模块开关状态、投流周期
    - 提供策划方案下载按钮
    - 展示复盘报告完整内容
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7_

- [ ] 19. 前端页面 - 审校台
  - [ ] 19.1 创建审校台页面
    - 创建 `web/src/app/review/[id]/proofread/page.tsx`
    - 实现三栏布局：左侧章节目录、中间富文本编辑区、右侧AI助手面板
    - 左侧：章节目录树，点击导航到对应章节
    - 中间：富文本编辑器，支持文字编辑和格式调整
    - 右侧：AI助手面板，支持对报告内容进行问答
    - 提供保存按钮和下载功能（PDF/Word）
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_

  - [ ] 19.2 实现源数据对照功能
    - 在审校台中添加"查看源数据对照"入口
    - 展示当前章节对应的原始数据表格
    - 支持源数据与报告内容并排对照
    - _Requirements: 16.1, 16.2, 16.3_

- [ ] 20. Checkpoint - 确认复盘系统完成
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 21. 前端页面 - 舆情系统
  - [ ] 21.1 创建舆情系统页面
    - 创建 `web/src/app/sentiment/page.tsx`
    - 筛选器：品类、品牌、业务线、项目名称 + "查看舆情"按钮
    - 情感倾向分布饼图（正向/中性/负向）使用 Recharts PieChart
    - 评论数变化趋势折线图使用 Recharts LineChart
    - 关键词高频分布：词云图 + 关键词频次表格
    - 负向评论列表：评论内容和来源信息
    - _Requirements: 17.1, 17.2, 17.3, 18.1, 18.2, 18.3, 18.4_

  - [ ] 21.2 实现舆情导出与记录功能
    - 添加"导出"按钮，调用导出 API 生成文件
    - 添加"查看导出记录"功能，展示历史导出列表
    - _Requirements: 19.1, 19.2, 19.3, 19.4_

- [ ] 22. 前端页面 - 策划系统占位页
  - [ ] 22.1 创建策划系统占位页面
    - 创建 `web/src/app/planning/page.tsx`
    - 展示"策划系统即将上线"占位内容
    - _Requirements: 3.1 (导航项存在)_

- [ ] 23. 密码管理API与页面集成
  - [ ] 23.1 实现密码修改 API（如不存在）
    - 确认 `/api/auth/change-password` 支持当前密码验证 + 新密码设置
    - 验证失败返回对应错误信息
    - 成功后清除 session，要求重新登录
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 24. Final checkpoint - 全部功能验证
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The project uses TypeScript throughout (Next.js App Router + Prisma + PostgreSQL)
- Existing libraries: xlsx (SheetJS), Recharts, TanStack React Query, lucide-react, Tailwind CSS
- 策划系统为占位页面，后续迭代实现
