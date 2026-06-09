# Requirements Document

## Introduction

本次需求变更涉及系统三大核心数据模型的表头/字段重构：用户模型增加手机号字段并以手机号登录、项目底表精简为5列新表头、笔记底表（业务底表）更新为18列新表头。变更需覆盖数据库Schema、API接口、前端展示、导入解析、报告生成等全链路。

## Glossary

- **System**: PPP复盘报告系统（小红书营销项目复盘报告系统）
- **User_Model**: 用户数据模型（对应 Prisma `User` 表及 `users` 数据库表）
- **Project_Model**: 项目数据模型（对应 Prisma `Project` 表及 `projects` 数据库表）
- **NoteBase_Model**: 笔记底表数据模型（对应 Prisma `NoteBase` 表及 `note_base` 数据库表，业务底表Excel导入）
- **Auth_Service**: 认证服务（登录/登出/JWT生成，对应 `web/src/lib/auth.ts` 和 `/api/auth/login` 路由）
- **NoteBase_Parser**: 笔记底表解析器（对应 `web/src/lib/note-base-parser.ts`，将Excel列映射为结构化数据）
- **Project_Import_Service**: 项目导入服务（对应 `/api/admin/import/project-base` 路由，从Excel批量导入项目）
- **User_Import_Service**: 用户导入服务（对应 `/api/admin/import/users` 路由，从Excel批量导入用户）
- **Review_Report**: 复盘报告（基于笔记底表数据生成的AI分析报告）
- **Phone_Number**: 手机号（中国大陆11位手机号码）
- **Real_Name**: 真实姓名（用户的真名，用于关联项目创建者）
- **fillNotesFromNoteBase**: 笔记回填函数（将 note_base 表数据拷贝到 notes 表的核心函数，位于 `src/ingestion/persistence-service.ts`）
- **Official_Cooperation**: 官方合作笔记（蒲公英平台可爬取数据的笔记）
- **Unofficial_Cooperation**: 非官方合作笔记（蒲公英平台无法爬取数据、指标来自 NoteBase Excel 的笔记）

## Requirements

### Requirement 1: 用户模型增加手机号字段

**User Story:** As a 系统管理员, I want 为每个用户记录手机号, so that 系统可以通过手机号识别用户身份并支持手机号登录。

#### Acceptance Criteria

1. THE User_Model SHALL 包含一个唯一的手机号字段（phone），类型为VarChar(20)，且不可重复
2. WHEN 创建新用户时未提供手机号, THE System SHALL 允许手机号为空（nullable），但在用户首次登录前必须补填
3. THE User_Model SHALL 保留原有的 username（花名）字段用于系统内部显示，但不再作为登录凭证

### Requirement 2: 登录方式变更为手机号

**User Story:** As a 用户, I want 使用手机号和密码登录系统, so that 登录凭证更加统一且易于记忆。

#### Acceptance Criteria

1. WHEN 用户提交登录请求, THE Auth_Service SHALL 接受 phone 字段（而非 username）作为身份标识进行认证
2. WHEN 提交的手机号在系统中不存在或账号已禁用, THE Auth_Service SHALL 返回错误提示"手机号或密码错误"
3. WHEN 登录成功, THE Auth_Service SHALL 在JWT payload中同时包含 phone 和 username 信息
4. IF 用户使用旧版客户端发送 username 字段登录, THEN THE Auth_Service SHALL 兼容处理，尝试用 username 匹配后降级查询

### Requirement 3: 用户导入增加手机号列

**User Story:** As a 系统管理员, I want 在批量导入用户时包含手机号列, so that 新导入的用户可以直接使用手机号登录。

#### Acceptance Criteria

1. THE User_Import_Service SHALL 在Excel模板中增加"手机号"列
2. WHEN 解析用户导入Excel时, THE User_Import_Service SHALL 识别列名"手机号"或"phone"并映射到 phone 字段
3. IF 导入的手机号格式不符合11位中国手机号规则, THEN THE User_Import_Service SHALL 记录该行错误并跳过
4. IF 导入的手机号已存在于系统中, THEN THE User_Import_Service SHALL 记录该行错误"手机号已存在"并跳过

### Requirement 4: 用户管理界面增加手机号

**User Story:** As a 系统管理员, I want 在用户列表和新建/编辑表单中看到手机号字段, so that 管理员可以管理用户的手机号信息。

#### Acceptance Criteria

1. THE System SHALL 在用户列表表格中显示手机号列
2. WHEN 新建用户, THE System SHALL 提供手机号输入框，并标注为必填项
3. WHEN 编辑用户, THE System SHALL 允许修改手机号，但需验证唯一性
4. THE System SHALL 对手机号输入执行前端格式校验（11位数字，以1开头）

### Requirement 5: 项目底表表头重构

**User Story:** As a 系统管理员, I want 项目底表简化为"项目名称 | 品牌名称 | 品牌业务线 | 品牌行业类目 | 创建者"五列, so that 项目信息更加精简且聚焦核心维度。

#### Acceptance Criteria

1. THE Project_Model SHALL 保留以下字段作为核心显示列：projectName（项目名称）、brand（品牌名称）、businessLine（品牌业务线）、category（品牌行业类目）、createdBy（创建者）
2. THE System SHALL 在项目列表页按新表头顺序展示：项目名称 → 品牌名称 → 品牌业务线 → 品牌行业类目 → 创建者
3. WHEN businessLine为空值, THE System SHALL 允许该项目仅挂在"品牌"层级下，不强制要求业务线
4. THE Project_Import_Service SHALL 更新Excel列名映射，将"品牌简称"映射为brand、"品牌行业类目"映射为category、"品牌业务线"映射为businessLine、"项目名称"映射为projectName、"创建者"映射为createdBy

### Requirement 6: 项目创建者通过真实姓名关联账号

**User Story:** As a 系统管理员, I want 导入项目时通过创建者的真实姓名自动关联到系统中的用户账号, so that 项目与责任人建立正确的关联关系。

#### Acceptance Criteria

1. WHEN 导入项目底表时"创建者"列提供了真实姓名, THE Project_Import_Service SHALL 在 User_Model 中按 realName 字段匹配对应用户的UUID
2. IF 匹配到唯一用户, THEN THE Project_Import_Service SHALL 将该用户的UUID写入 Project 的 createdBy 字段
3. IF 真实姓名匹配到多个用户, THEN THE Project_Import_Service SHALL 记录警告"姓名重复，请手动指定创建者"并将 createdBy 置空
4. IF 真实姓名未匹配到任何用户, THEN THE Project_Import_Service SHALL 记录警告"未找到用户"并将 createdBy 置空
5. THE System SHALL 在项目列表中将 createdBy UUID 解析为对应用户的真实姓名进行展示

### Requirement 7: 项目底表已删除字段的引用分析与清理

**User Story:** As a 开发者, I want 系统正确处理项目底表中被删除的字段（spuName、projectType、startDate、endDate、executionStartDate、launchPhases、engagementConfig、cooperationPolicy、noteCount、participants等非核心展示字段）, so that 删除字段不会导致功能异常。

#### Acceptance Criteria

1. THE System SHALL 保留 Project_Model 中 spuName、projectType、startDate、endDate、executionStartDate 等字段在数据库层面，但将其标记为deprecated并从项目列表展示中移除
2. WHEN 报告生成模块引用 projectType 字段, THE System SHALL 继续正常工作（使用数据库中已存储的值）
3. THE Project_Import_Service SHALL 不再要求 projectType、launchPhases 等字段为必填，允许新导入的项目不含这些信息
4. THE System SHALL 在项目列表前端移除"笔记数量"、"项目结束日期"、"参与者"列的展示

### Requirement 8: 笔记底表表头重构

**User Story:** As a 运营人员, I want 笔记底表（业务底表）更新为新的18列表头结构, so that 底表数据与实际业务需求一致。

#### Acceptance Criteria

**必带字段（所有笔记必填）：**

1. THE NoteBase_Parser SHALL 识别"发布链接"列并映射为 noteLink 字段（必填列），并从中提取 noteId
2. THE NoteBase_Parser SHALL 识别"内容方向"列并映射为 contentDirection 字段（必填列）
3. THE NoteBase_Parser SHALL 识别"笔记类型"列并映射为 kolType 字段（必填列，图文/视频）
4. THE NoteBase_Parser SHALL 识别"资源含税成本价"列并映射为 contentCost 字段（必填列）
5. THE NoteBase_Parser SHALL 识别"资源含税售价"列并映射为 contentSettlement 字段（必填列）

**非官方合作才需要的字段（可选列）：**

6. THE NoteBase_Parser SHALL 识别"内容形式"列并映射为 cooperationForm 字段（可选列）
7. THE NoteBase_Parser SHALL 识别"总消耗"列并映射为 totalCost 字段（可选列）
8. THE NoteBase_Parser SHALL 将曝光量、阅读量、点赞量、收藏量、评论量、转发量、互动量、CPM、CPC、CPE、CTR 存入 metrics JSON字段（可选列，仅非官方合作笔记填写）
9. IF 必填列（发布链接、内容方向、笔记类型、资源含税成本价、资源含税售价）缺失, THEN THE NoteBase_Parser SHALL 返回解析错误提示缺少必填列

### Requirement 9: 笔记底表已删除字段兼容处理

**User Story:** As a 开发者, I want 确认笔记底表中被移除的旧列不会影响系统正常运行, so that 新旧版本底表都能正确解析。

#### Acceptance Criteria

1. THE NoteBase_Parser SHALL 继续兼容旧版表头（博主昵称、博主粉丝量、合作形式、是否报备、达人类型、对应SPU、内容实际消耗金额、投流实际消耗等），如果Excel中存在这些列仍可正确解析
2. WHEN 新版底表不包含"博主昵称"和"博主粉丝量"列, THE NoteBase_Parser SHALL 将 kolNickName 和 kolFanNum 字段置为空/零值
3. WHEN 新版底表不包含"是否报备"列, THE NoteBase_Parser SHALL 将 isRegistered 默认为 false
4. WHEN 新版底表不包含"对应SPU"列, THE NoteBase_Parser SHALL 将 spuName 置为 null
5. WHEN 新版底表不包含"投流实际消耗"列, THE NoteBase_Parser SHALL 将 adSpend 默认为 0

### Requirement 10: 笔记底表表头行识别

**User Story:** As a 运营人员, I want 系统能自动识别表头在第1行还是第2行, so that 即使Excel顶部有标题行也能正确解析数据。

#### Acceptance Criteria

1. WHEN Excel第1行包含已知列名（如"发布链接"、"内容方向"等）, THE NoteBase_Parser SHALL 将第1行视为表头
2. WHEN Excel第1行不包含已知列名但第2行包含, THE NoteBase_Parser SHALL 跳过第1行，将第2行视为表头
3. IF Excel前两行都不包含已知列名, THEN THE NoteBase_Parser SHALL 返回解析错误"未识别到有效表头"

### Requirement 11: 复盘报告适配新笔记底表

**User Story:** As a 复盘人员, I want 复盘报告能基于 notes 表的统一数据正确生成各项分析, so that 报告内容准确反映数据，无需区分数据来源。

#### Acceptance Criteria

1. THE Review_Report SHALL 仅从 notes 表读取笔记维度数据生成报告，不直接读取 note_base 表（Ch3/Ch5/Ch6/Ch9 中所有对 note_base 的直接查询均需改为从 notes 表读取）
2. WHEN 生成复盘报告数据概览章节（Ch3）, THE Review_Report SHALL 使用 notes 表中的 impNum、readNum、engageNum（互动量）、likeNum、favNum、cmtNum、shareNum 字段
3. WHEN 生成内容分析章节（Ch6）, THE Review_Report SHALL 使用 notes 表中的 contentDirection（内容方向）和 cooperationForm（内容形式）字段进行维度聚合
4. THE Review_Report SHALL 使用 notes 表中的 kolPrice（资源含税成本价）作为单篇笔记的内容成本
5. THE Review_Report SHALL 使用 notes 表中的 serviceFee（资源含税售价）作为单篇笔记的售价
6. WHEN 计算效率指标, THE Review_Report SHALL 基于 notes 表中的 totalCost 和曝光/阅读/互动量字段自行计算 CPM、CPC、CPE、CTR
7. WHEN 生成四象限分析章节（Ch5）, THE Review_Report SHALL 从 notes 表读取 contentDirection 和 kolPrice（内容成本）用于每篇笔记的成本计算和内容方向标注
8. THE Review_Report SHALL 使用 notes 表的 COUNT(*) 替代 note_base 的 COUNT(*) 获取笔记总篇数
9. WHEN 计算内容结算口径金额, THE Review_Report SHALL 使用 notes 表中 SUM(serviceFee) 替代 note_base 的 SUM(content_settlement)
10. ⚠️ **已知限制（见 ISSUE-007）**：投流结算口径（`trafficCostCaliber = 'settlement'`）依赖已删除的 `adSpend` 字段，新导入的项目暂无法使用此口径。消耗口径（从聚光数据取值）不受影响。

### Requirement 12: 项目底表唯一约束更新

**User Story:** As a 开发者, I want 项目底表的唯一约束适配新的表头结构, so that 支持 businessLine 为空时的项目去重。

#### Acceptance Criteria

1. WHEN businessLine 为空, THE Project_Model SHALL 使用（category, brand, null, projectName）组合作为唯一标识
2. THE Project_Model SHALL 确保同一品牌下不同业务线可创建同名项目
3. WHEN 导入项目时唯一约束冲突, THE Project_Import_Service SHALL 执行 upsert 更新而非报错

### Requirement 13: fillNotesFromNoteBase 两步回填逻辑

**User Story:** As a 开发者, I want fillNotesFromNoteBase 按两步逻辑将 NoteBase 数据拷贝到 notes 表, so that 官方合作和非官方合作笔记都能在 notes 表中获取正确的基础信息和指标数据。

#### Acceptance Criteria

**Step 1 — 所有笔记（无论官方/非官方合作）：**

1. WHEN 调用 fillNotesFromNoteBase, THE System SHALL 对所有笔记从 note_base 拷贝以下必带字段到 notes 表：noteLink、contentDirection、kolType、contentCost（映射为 kolPrice）、contentSettlement（映射为 serviceFee）
2. THE System SHALL 对所有笔记执行 Step 1 拷贝，包括蒲公英已爬取数据的官方合作笔记

**Step 2 — 仅非官方合作笔记（蒲公英未爬取数据的）：**

3. WHEN 蒲公英未返回某笔记的数据, THE System SHALL 额外从 note_base 拷贝 metrics 数据（曝光量、阅读量、点赞量、收藏量、评论量、转发量、互动量）到 notes 表
4. IF notes 表中该笔记已有蒲公英爬取的指标数据（dataSource 非 'note_base'）, THEN THE System SHALL 不覆盖已有指标数据，仅补充 Step 1 的必带字段
5. THE System SHALL 同时拷贝 totalCost（总消耗）和 cooperationForm（内容形式）字段到 notes 表，仅针对非官方合作笔记

**数据源标记：**

6. WHEN 仅执行 Step 1（官方合作笔记）, THE System SHALL 不改变 notes 表中已有记录的 dataSource 标记
7. WHEN 执行 Step 1 + Step 2（非官方合作笔记）, THE System SHALL 将 notes 表中对应记录的 dataSource 标记为 'note_base'
