# 实施计划：复盘页面改版V2

## 概述

本实施计划将设计文档中的8个需求模块转化为可执行的编码任务。采用增量实现策略：先完成纯函数层（可测试逻辑），再修改API层，最后调整前端UI组件。每个任务构建在前一步基础上，确保无孤立代码。

## Tasks

- [x] 1. 实现纯函数层 - sheet选择逻辑
  - [x] 1.1 创建 `web/src/lib/sheet-selector.ts`，实现 `selectTargetSheet` 函数
    - 定义 `SheetSelectionResult` 接口（success, sheetName, error）
    - 实现逻辑：单sheet直接返回；多sheet查找"已发布达人"；未找到返回错误
    - _Requirements: 2.2, 2.3, 2.4_

  - [x] 1.2 创建属性测试 `web/src/lib/sheet-selector.property.test.ts`
    - **Property 2: 多sheet文件目标sheet选择**
    - **Property 3: 单sheet文件直接解析**
    - **Property 4: 多sheet缺失目标sheet错误**
    - **Validates: Requirements 2.2, 2.3, 2.4**

- [x] 2. 实现纯函数层 - 区间输入验证逻辑
  - [x] 2.1 创建 `web/src/lib/range-validator.ts`，实现区间验证函数
    - 定义 `RangeValidationResult` 接口（valid, sanitizedValue, error）
    - 实现 `validateRangeInput(value: string)` — 验证并截断到两位小数
    - 实现 `validateRange(min: string, max: string)` — 验证 min ≤ max
    - _Requirements: 5.2, 5.3, 5.4_

  - [x] 2.2 创建属性测试 `web/src/lib/range-validator.property.test.ts`
    - **Property 5: 区间输入小数位验证**
    - **Validates: Requirements 5.2, 5.3**

- [x] 3. 实现纯函数层 - 项目日期筛选逻辑更新
  - [x] 3.1 修改 `web/src/lib/project-filter.ts`
    - 将 `ProjectRecord.startDate` 改为 `executionStartDate` 和 `endDate`
    - 将 `ProjectFilters` 中的 `dateFrom/dateTo` 改为 `executionStartDateFrom/executionStartDateTo` 和 `endDateFrom/endDateTo`
    - 更新 `filterProjects` 函数逻辑：基于 executionStartDate 和 endDate 分别筛选
    - _Requirements: 1.4, 1.5, 1.6_

  - [x] 3.2 更新属性测试 `web/src/lib/project-filter.property.test.ts`
    - **Property 1: 项目日期筛选正确性**
    - **Validates: Requirements 1.4, 1.5, 1.6**

- [x] 4. 实现纯函数层 - 模块配置逻辑更新
  - [x] 4.1 修改 `web/src/lib/module-toggle.ts`
    - 从 `REPORT_MODULE_KEYS` 中移除 `audienceAnalysis` 和 `competitorAnalysis`
    - 新增 `selectAllModules(state: ModuleState): ModuleState` 函数
    - 新增 `deselectAllModules(state: ModuleState): ModuleState` 函数
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 4.2 更新属性测试 `web/src/lib/module-toggle.property.test.ts`
    - **Property 6: 模块列表排除已移除模块**
    - **Property 7: 全选操作完备性**
    - **Property 8: 取消全选操作完备性**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.6, 7.7**

- [x] 5. 实现纯函数层 - 日期时间格式化
  - [x] 5.1 修改 `web/src/lib/project-meta.ts`，新增 `formatDateTime` 函数
    - 输出格式：`YYYY-MM-DD HH:mm:ss`（精确到秒）
    - 处理时区和边界情况
    - _Requirements: 8.2_

  - [x] 5.2 创建属性测试 `web/src/lib/date-formatter.property.test.ts`
    - **Property 9: 日期时间格式化精度**
    - **Validates: Requirements 8.2**

- [x] 6. 检查点 - 纯函数层验证
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. 修改API层 - 业务底表上传接口
  - [x] 7.1 修改 `web/src/app/api/upload/note-base/[projectId]/route.ts`
    - 引入 `selectTargetSheet` 函数替换原有的 `workbook.SheetNames[0]` 逻辑
    - 多sheet文件时调用 `selectTargetSheet` 选择目标sheet
    - 失败时返回 400 错误码和 `SHEET_NOT_FOUND` 错误代码
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 8. 修改API层 - 项目列表筛选接口
  - [x] 8.1 修改 `web/src/app/api/projects` 相关路由
    - 将日期筛选参数从 `dateFrom/dateTo` 改为 `executionStartDateFrom/executionStartDateTo` 和 `endDateFrom/endDateTo`
    - 更新 Prisma 查询条件，基于 `executionStartDate` 和 `endDate` 字段筛选
    - _Requirements: 1.4, 1.5, 1.6_

- [x] 9. 修改前端 - 项目表单页面
  - [x] 9.1 修改 `web/src/app/projects/new/page.tsx`
    - 移除"立项开始日期"(startDate) 日期选择器
    - 保留"开始执行日期"(executionStartDate) 和"项目结束日期"(endDate) 日期选择器
    - _Requirements: 1.1_

  - [x] 9.2 修改 `web/src/app/projects/[id]/edit/page.tsx`
    - 同步移除"立项开始日期"字段，保留 executionStartDate 和 endDate
    - _Requirements: 1.2, 1.3_

- [x] 10. 修改前端 - 项目列表页筛选条件
  - [x] 10.1 修改项目列表页的筛选组件
    - 将"立项开始日期"筛选改为"开始执行日期"筛选
    - 将"立项结束日期"筛选改为"项目结束日期"筛选
    - 更新筛选请求参数名称
    - _Requirements: 1.4, 1.5, 1.6_

- [x] 11. 修改前端 - 复盘表单项目信息只读展示
  - [x] 11.1 修改 `web/src/app/review/new/page.tsx` 项目信息区域
    - 移除品类、品牌、业务线下拉选择器
    - 移除"选择项目"搜索框
    - 新增只读项目信息卡片组件，展示：项目名称、品类、品牌、业务线
    - 从 URL 参数 `projectId` 获取项目信息并展示
    - 编辑模式下从 ReviewConfig 关联的 project 获取信息
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 12. 修改前端 - 复盘表单字段删除与合并
  - [x] 12.1 修改 `web/src/app/review/new/page.tsx` 执行配置和KPI区域
    - 移除"执行周期"配置区域（executionPeriodStart/End 相关UI）
    - 删除"历史项目拉新成本基准值"输入框
    - 将"是否有（非官方）合作"选项从原位置移入"复盘目标（KPI）"板块
    - 清理相关状态变量
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 13. 修改前端 - 大盘数据改为区间输入
  - [x] 13.1 修改 `web/src/app/review/new/page.tsx` 大盘数据区域
    - 将标题从"复盘背景（大盘数据）"改为"大盘数据"
    - 创建 RangeInput 组件（包含最小值和最大值两个输入框）
    - 将 CTR、CPM、CPC、CPE、互动率的单值输入替换为 RangeInput 区间输入
    - 集成 `validateRangeInput` 进行输入验证和小数截断
    - 更新状态结构从 `BenchmarkData` 到 `BenchmarkRangeData`
    - 实现向后兼容：加载旧格式单值数据时自动转换为 `{ min: value, max: value }`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 14. 修改前端 - KPI目标指标精简与重命名
  - [x] 14.1 修改 `web/src/app/review/new/page.tsx` KPI区域
    - 移除"搜索指数"(searchIndex) 输入项
    - 移除"SOC/SOV"(socSov) 输入项
    - 移除"人群资产-总-SPU"(audienceSpuTotal) 输入项
    - 移除"人群资产-TI-SPU"(audienceSpuTi) 输入项
    - 将"千爆文数"标签重命名为"爆文数"
    - 将"万爆文数"标签重命名为"爆文率"
    - 编辑模式加载含已移除字段的数据时忽略这些字段
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 15. 修改前端 - 报告模块配置优化
  - [x] 15.1 修改 `web/src/app/review/new/page.tsx` 模块配置区域
    - 移除"人群资产分析"模块选项
    - 移除"竞对分析"模块选项
    - 在模块列表上方添加"全选"和"取消全选"按钮
    - 集成 `selectAllModules` 和 `deselectAllModules` 函数
    - 默认状态设为全选
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [x] 16. 修改前端 - 复盘列表页字段顺序调整
  - [x] 16.1 修改 `web/src/app/review/page.tsx`
    - 调整列顺序为：项目名称 → 更新时间 → 创建者 → 操作
    - 移除"状态"列和"复盘者"列（如存在）
    - 更新时间列使用 `formatDateTime` 函数展示精确到时分秒
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 17. 修改报告生成 - 大盘数据区间对比逻辑
  - [x] 17.1 修改 `src/calculation/pipeline.ts` 中的 benchmark comparison 逻辑
    - 适配新的区间格式 `{ min: number, max: number }`，对比时判断实际值是否落在区间内
    - 实际值 < min → 劣于大盘（对于非成本指标）/ 优于大盘（对于成本指标）
    - 实际值在 [min, max] 之间 → 持平大盘
    - 实际值 > max → 优于大盘（对于非成本指标）/ 劣于大盘（对于成本指标）
    - 向后兼容：检测旧格式单值 benchmark 自动转为 `{ min: value, max: value }`
    - _Requirements: 5.1, 5.2_

  - [x] 17.2 修改 `src/report/assembler.ts` 中 benchmark 数据组装
    - 更新 `competitor_benchmark` 和 `data_overview` 模块的 benchmark 数据结构
    - 将区间数据传入章节模板（如 `{{benchmark_ctr_min}}~{{benchmark_ctr_max}}`）
    - _Requirements: 5.1_

  - [x] 17.3 修改 `src/prompts/chapters/chapter-07-traffic-analysis.md` 大盘对比部分
    - 更新模板中的 benchmark 占位符，支持区间展示格式（如 "大盘CTR: 10.59%~15.36%"）
    - _Requirements: 5.1, 5.5_

- [x] 18. 修改报告生成 - KPI指标变更适配
  - [x] 18.1 修改 `src/calculation/pipeline.ts` 中的 KPI 完成率计算
    - "爆文率"(原万爆文数)：数据类型从数量改为百分比，计算逻辑改为 `viralCount / totalNotes * 100`
    - "爆文数"(原千爆文数)：保持数量类型，但移除千赞阈值概念，改为通用爆文数
    - 移除 `searchIndex`、`socSov`、`audienceSpuTotal`、`audienceSpuTi` 的 KPI 完成率计算分支
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 18.2 修改 `src/prompts/chapters/chapter-03-data-overview.md` KPI表格
    - 将"千爆文数"改为"爆文数"，"万爆文数"改为"爆文率"
    - 移除搜索指数、SOC/SOV、人群资产-总-SPU、人群资产-TI-SPU 相关行
    - 爆文率展示为百分比格式
    - _Requirements: 6.5, 6.6_

  - [x] 18.3 修改 `src/shared/types.ts` 中的 KPI 相关类型定义
    - 更新 KpiTargets 接口，移除已删除字段，调整 viralPosts1k/viralPosts10k 的语义注释
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 19. 修改报告生成 - 模块开关与报告组装
  - [x] 19.1 修改 `src/report/assembler.ts` 中的 `REPORT_MODULE_ORDER`
    - 移除 `audience_assets`（人群资产分析）模块
    - 移除 `competitor_benchmark`（竞对分析）模块
    - 确保报告组装时跳过这两个模块
    - _Requirements: 7.1, 7.2_

  - [x] 19.2 修改报告导出逻辑（如有 PDF/PPTX 导出）
    - 确保导出时不包含已移除模块的章节
    - _Requirements: 7.1, 7.2_

- [x] 20. 修改报告生成 - "是否有非官方合作"数据读取路径
  - [x] 20.1 确认 `hasUnofficialCooperation` 字段在报告组装中的读取路径
    - 该字段从"项目执行配置"移入"复盘目标"板块，确保后端存储位置不变（ReviewConfig JSON中）
    - 如果报告组装从 ReviewConfig 读取该字段，确认 JSON key 路径未变
    - 如果字段存储路径有变化，更新 `assembleModuleData` 中对应的读取逻辑
    - _Requirements: 4.1, 4.4_

- [x] 21. 检查点 - 报告生成流程验证
  - Ensure all tests pass, ask the user if questions arise.
  - 验证修改后的报告生成流程能正确处理新格式数据
  - 验证旧格式数据的向后兼容性

- [x] 22. 复盘表单编辑模式兼容性处理
  - [x] 22.1 确保编辑模式下的向后兼容
    - 加载旧格式 benchmark 数据（单值）时自动转换为区间格式
    - 加载含已移除 KPI 字段的数据时忽略这些字段
    - 加载含已移除模块（audienceAnalysis、competitorAnalysis）的数据时忽略
    - 在 `web/src/app/review/new/page.tsx` 或 `web/src/app/review/[id]` 编辑页面中实现数据迁移逻辑
    - _Requirements: 3.5, 5.2, 6.5, 6.6, 7.1, 7.2_

- [x] 23. 最终检查点 - 确保所有测试通过
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- 标记 `*` 的任务为可选任务，可跳过以加速MVP交付
- 每个任务引用具体需求编号以确保可追溯性
- 检查点确保增量验证
- 属性测试验证通用正确性属性（使用 fast-check 库）
- 单元测试验证具体示例和边界情况
- 纯函数层优先实现，确保核心逻辑可独立测试
- **报告生成影响**：任务17-20专门处理字段变更对报告生成流程的影响：
  - 大盘数据区间化 → benchmark comparison 计算逻辑需适配区间格式
  - 爆文率类型变更 → KPI完成率计算从数量对比改为百分比对比
  - 移除KPI字段 → 计算管道和章节模板需同步清理
  - 移除报告模块 → 报告组装和导出需跳过对应章节
  - 字段位置移动 → 确认后端存储路径不变，报告组装读取不受影响
