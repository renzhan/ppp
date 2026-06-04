# 实现计划：项目管理和笔记底表管理

## 概述

基于需求文档和设计文档，将功能拆分为增量开发步骤。每个步骤构建在前一步基础之上，最终完成完整功能集成。核心路径：解析模块提取 → 写入端点修正 → 仅解析端点 → 读取端点 → 前端显示 → 项目列表优化 → 导出功能 → 唯一约束与数据清理。

笔记底表数据**仅**写入 `note_base` 表，不写入 `notes` 表。`NOTE_BASE_COLUMN_MAP` 使用 `note_base` 表字段名（cooperationForm、isRegistered、contentCost、contentSettlement、adSpend、totalCost）。数据指标列（曝光量、阅读量等）通过 `DISPLAY_ONLY_COLUMN_MAP` 仅前端展示，不入库。

## 任务

- [ ] 1. 提取 NoteBaseParser 解析模块
  - [x] 1.1 创建 `web/src/lib/note-base-parser.ts` 模块
    - 从现有 `web/src/app/api/upload/note-base/[projectId]/route.ts` 提取解析逻辑为独立模块
    - 定义 `ParsedNoteBaseRow` 接口（字段：noteId, noteLink, kolNickName, kolFanNum, cooperationForm, isRegistered, contentDirection, kolType, spuName, contentCost, contentSettlement, adSpend, totalCost）
    - 定义 `ParseResult` 接口（records, warnings, skippedRows）
    - 实现 `NOTE_BASE_COLUMN_MAP`：使用 note_base 表字段名映射（cooperationForm、isRegistered、contentCost、contentSettlement、adSpend、totalCost），而非 notes 表字段名
    - 实现 `DISPLAY_ONLY_COLUMN_MAP`：数据指标列（曝光量→impNum、阅读量→readNum、互动量→engageNum、点赞量→likeNum、收藏量→favNum、评论量→cmtNum、分享量→shareNum、关注量→followNum）仅用于前端展示，不入库
    - 实现 `normalizeHeader` 函数（去 emoji 前缀、去中文括号后缀，如"🔴笔记连接（必填）"→"笔记连接"）
    - 实现 `extractNoteIdFromLink` 函数（从 URL path 中 `explore/` 后 `?` 前提取 noteId；格式异常时用行号生成备用ID并记录 warning）
    - 实现 `parseNoteBaseExcel` 纯函数：过滤 noteLink 为空的行（而非 kolNickName 为空），跳过无效行记录 warnings，返回 ParseResult
    - 导出 `DISPLAY_ONLY_COLUMN_MAP` 供前端展示组件使用
    - _需求: 2.3, 4.1, 4.2, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 6.4_

  - [x] 1.2 编写 normalizeHeader 属性测试
    - **Property 4: 列名标准化去除装饰字符**
    - **验证: 需求 6.1**

  - [x] 1.3 编写 extractNoteIdFromLink 属性测试
    - **Property 3: 笔记ID从链接中正确提取**
    - **验证: 需求 5.1**

  - [x] 1.4 编写无笔记链接行过滤属性测试
    - **Property 2: 无笔记链接的行被过滤**
    - **验证: 需求 4.1, 4.2**

  - [x] 1.5 编写字段映射完整性属性测试
    - **Property 5: 字段映射完整性**
    - **验证: 需求 6.3, 7.2**

- [x] 2. 新增数据库迁移（note_base 表添加字段）
  - 创建迁移文件添加 `kol_nick_name` VARCHAR(200) 和 `kol_fan_num` INTEGER 字段到 note_base 表
  - 更新 `prisma/schema.prisma` 中 NoteBase 模型添加 kolNickName 和 kolFanNum 字段
  - _需求: 3.1_

- [ ] 3. 修正上传写入端点（写入 note_base 表）
  - [x] 3.1 修改 `web/src/app/api/upload/note-base/[projectId]/route.ts`
    - 引入 `NoteBaseParser` 模块替代内联解析逻辑
    - 写入目标从 `prisma.note` 改为 `prisma.noteBase`（仅写入 note_base 表，不写入 notes 表）
    - 字段映射使用 NOTE_BASE_COLUMN_MAP（cooperationForm、contentCost 等 note_base 表字段名）
    - 过滤条件改为：跳过 noteLink 为空的行（而非 kolNickName 为空）
    - 事务中先 deleteMany 该项目旧 note_base 数据再 createMany 插入新数据
    - 更新 project.noteCount
    - 返回写入记录数作为确认
    - _需求: 7.1, 7.2, 7.3, 8.1, 8.2, 8.3_

  - [x] 3.2 编写覆盖幂等性属性测试
    - **Property 6: 笔记底表按项目覆盖（幂等性）**
    - **验证: 需求 3.7, 8.1, 8.2**

- [ ] 4. 新增仅解析端点（新建项目用）
  - [x] 4.1 创建 `web/src/app/api/upload/note-base/parse/route.ts`
    - 接受 multipart/form-data（file 字段）
    - 使用 NoteBaseParser 解析文件
    - 返回 `{ success, records, warnings, skippedRows }`，不写入数据库
    - records 中包含 DISPLAY_ONLY_COLUMN_MAP 对应的数据指标字段（仅展示用）
    - _需求: 2.2, 2.3_

- [ ] 5. 新增 note_base 数据读取端点
  - [x] 5.1 创建 `web/src/app/api/projects/[id]/note-base/route.ts`
    - GET 方法从数据库查询该项目的 note_base 记录
    - 返回 `{ records, count }`
    - _需求: 3.6_

- [x] 6. Checkpoint - 确保后端 API 测试通过
  - 确保所有测试通过，ask the user if questions arise.

- [ ] 7. 项目列表排序优化
  - [x] 7.1 修改 `web/src/app/api/projects/route.ts` GET 方法
    - 排序规则改为 `orderBy: { endDate: 'desc' }`
    - _需求: 1.2_

  - [x] 7.2 修改前端项目列表页
    - 将"立项时间"列替换为"项目结束日期"列
    - endDate 为空时显示占位符 "-"
    - _需求: 1.1, 1.3_

  - [x] 7.3 编写排序属性测试
    - **Property 1: 项目列表按 endDate 降序排列**
    - **验证: 需求 1.2**

- [ ] 8. 前端笔记底表显示组件
  - [x] 8.1 创建笔记底表展示表格组件 Note_Display_Table
    - 展示所有解析字段：笔记ID、博主昵称、粉丝量、合作形式、是否报备、内容方向、达人类型、对应SPU、各类费用（内容消耗、内容结算、投流消耗、总费用）
    - 展示 DISPLAY_ONLY_COLUMN_MAP 中的数据指标列（曝光量、阅读量、互动量、点赞量、收藏量、评论量、分享量、关注量）——仅展示不入库
    - 支持横向滚动条，允许左右滑动查看所有列
    - 序号列和笔记ID列固定在最左侧，横向滚动时始终可见
    - 笔记链接作为笔记ID单元格的超链接展示（点击跳转），不单独显示笔记链接列
    - _需求: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 8.2 集成到项目表单页
    - 新建项目时：调用仅解析端点，立即展示解析结果，暂存数据，项目保存后调用写入端点写入 note_base 表
    - 编辑项目时：调用读取端点加载已有 note_base 数据展示
    - 重新上传时：用新解析结果覆盖当前显示内容
    - _需求: 2.1, 2.2, 2.3, 3.6, 3.7_

- [ ] 9. 导出功能实现
  - [x] 9.1 创建 Mock 数据模块 `web/src/lib/mock-raw-notes.ts`
    - 定义 `RawPugongyingNote` 接口（模拟 fetchRawNotes 返回的数据结构）
    - 实现 `getMockRawNotes` 函数，返回多条笔记记录
    - 包含各类字段典型值，确保导出文件格式正确
    - _需求: 10.1, 10.2, 10.4_

  - [x] 9.2 创建 ExportService `web/src/lib/export-raw-notes.ts`
    - 实现 `fetchRawNotesData` 函数（开发期调用 mock 数据）
    - 实现 `rawNotesToExcelBuffer` 函数（数据转 Excel Buffer，使用 xlsx 库）
    - 实现 `generateExportFilename` 函数（`{projectName}_{YYYYMMDD_HHmmss}.xlsx` 格式）
    - _需求: 9.2, 9.3, 9.4, 10.1, 10.3_

  - [x] 9.3 创建导出 API 端点 `web/src/app/api/export/raw-notes/[projectId]/route.ts`
    - POST 方法调用 ExportService 生成 Excel 并返回文件流
    - 设置 Content-Disposition: attachment; filename="{projectName}_{时间}.xlsx"
    - 错误时返回明确提示信息
    - _需求: 9.2, 9.3, 9.5_

  - [x] 9.4 前端项目列表页添加"导出"按钮
    - 在操作列"编辑"按钮右侧增加"导出"按钮
    - 点击触发 POST 请求并下载 Excel 文件
    - 错误时展示提示信息给用户
    - _需求: 9.1, 9.5_

  - [x] 9.5 编写导出 Excel round-trip 属性测试
    - **Property 7: Excel 导出数据完整性（Round-Trip）**
    - **验证: 需求 9.3**

  - [x] 9.6 编写导出文件名格式属性测试
    - **Property 8: 导出文件名格式正确**
    - **验证: 需求 9.4**

- [x] 10. Checkpoint - 确保所有功能测试通过
  - 确保所有测试通过，ask the user if questions arise.

- [ ] 11. 项目唯一性约束
  - [x] 11.1 创建数据库迁移添加唯一索引
    - 在 projects 表添加 `(category, brand, business_line, project_name)` 唯一约束
    - 更新 prisma schema 添加 `@@unique([category, brand, businessLine, projectName])` 声明
    - _需求: 11.1_

  - [x] 11.2 修改项目创建/编辑 API 捕获唯一约束冲突
    - 捕获 Prisma P2002 UniqueConstraintViolation 错误
    - 返回 HTTP 409 + "该品类+品牌+业务线+项目名称组合已存在" 错误消息
    - 创建和编辑场景均需处理
    - _需求: 11.2, 11.3_

  - [x] 11.3 编写唯一约束属性测试
    - **Property 9: 项目唯一性约束拒绝重复组合**
    - **验证: 需求 11.2, 11.3**

- [ ] 12. 重复数据清理 SQL 文档
  - [x] 12.1 创建 `docs/cleanup-duplicate-projects.sql` 文档
    - 包含识别 (category, brand, business_line, project_name) 组合重复的项目记录的查询语句
    - 包含保留 created_at 最新记录、标记/删除较旧记录的操作语句
    - 包含删除重复项目关联的 ReviewConfig 及其关联 ReportTraceItem 的操作语句
    - 包含删除重复项目关联的 Note、NoteBase 数据的操作语句
    - 包含清晰的执行顺序说明和中文注释，供管理员手动审核后执行
    - 此为 SQL 文档，**非**迁移脚本，不自动执行
    - _需求: 12.1, 12.2, 12.3, 12.4, 12.5_

- [x] 13. Final checkpoint - 确保所有测试通过
  - 确保所有测试通过，ask the user if questions arise.

## 说明

- 标记 `*` 的子任务为可选测试任务，可跳过以加快 MVP 进度
- 每个任务引用具体需求编号以保证可追溯性
- Checkpoint 确保增量验证
- 属性测试使用 `fast-check` 库，验证设计文档中的正确性属性
- 唯一约束相关任务（11、12）排在最后，先完成功能开发
- 重复数据清理是提供 SQL 文档供手动执行，不是迁移脚本
- 笔记底表数据仅写入 note_base 表，不写入 notes 表
- NOTE_BASE_COLUMN_MAP 使用 note_base 表正确字段名（cooperationForm、isRegistered、contentCost、contentSettlement、adSpend、totalCost）
- DISPLAY_ONLY_COLUMN_MAP 用于前端展示数据指标列（曝光量、阅读量等），不入库
- 导出功能使用 mock 数据自测，fetchRawNotes 接口由其他同事开发
- 所有 12 个需求均已覆盖
