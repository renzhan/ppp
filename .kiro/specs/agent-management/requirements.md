# 需求文档：Agent 管理系统

## 简介

基于 Pi Agent 框架构建一套独立的 Agent 管理功能。系统采用主 Agent（管家）+ 工作区 Agent 的架构，主 Agent 可调度各工作区 Agent，各工作区 Agent 也可独立被调度。系统支持 Skill 的公用与工作区专属配置、知识库按工作区上传文档、系统内置原生 Tool，并提供 Model 配置、Agent、Skill、Knowledge 四个管理频道的页面交互。

## 术语表

- **Agent_Management_System**：Agent 管理系统，负责管理所有 Agent、Skill、Knowledge 和 Model 配置的核心系统
- **Master_Agent**：主 Agent（管家），负责调度各工作区 Agent 的顶层 Agent
- **Workspace_Agent**：工作区 Agent，隶属于某个工作区的专属 Agent，执行该工作区的具体任务
- **Workspace**：工作区，代表一个业务领域（如复盘文档生成、复盘内容审校、舆情系统、派芽知识库、策划系统）
- **Skill**：技能，Agent 可引用的能力模块，可以是公用的或工作区专属的
- **Knowledge_Base**：知识库，按工作区组织的文档存储，支持公共工作区
- **Native_Tool**：原生工具，系统内置的基础工具（如 Web 搜索、文件操作等）
- **Model_Config**：模型配置，管理 LLM 模型的连接参数（API Key、Base URL、模型选择等）
- **Dispatch**：调度，Master_Agent 向 Workspace_Agent 发送任务指令的行为
- **Public_Workspace**：公共工作区，不属于任何特定工作区的共享空间，用于存放公用 Skill 和公共知识库文档

## 需求

### 需求 1：Model 配置管理

**用户故事：** 作为系统管理员，我希望能够配置和管理 LLM 模型的连接参数，以便 Agent 能够正确调用 AI 能力。

#### 验收标准

1. THE Agent_Management_System SHALL 提供 Model 配置的 CRUD 接口，包含 API Key、Base URL、模型名称、超时时间等字段
2. WHEN 管理员创建一个新的 Model 配置时，THE Agent_Management_System SHALL 将配置持久化到数据库并返回配置 ID
3. WHEN 管理员更新 Model 配置时，THE Agent_Management_System SHALL 验证 Base URL 格式合法性后保存更新
4. THE Agent_Management_System SHALL 对 API Key 字段进行加密存储，且在读取时仅返回脱敏后的部分内容
5. IF Model 配置的必填字段（API Key、Base URL、模型名称）缺失，THEN THE Agent_Management_System SHALL 返回明确的校验错误信息
6. THE Agent_Management_System SHALL 支持设置一个默认 Model 配置，供未指定模型的 Agent 使用
7. WHEN 管理员删除一个正在被 Agent 引用的 Model 配置时，THE Agent_Management_System SHALL 阻止删除并返回引用该配置的 Agent 列表

### 需求 2：Agent 管理（主 Agent 与工作区 Agent）

**用户故事：** 作为系统管理员，我希望能够创建和管理主 Agent 及各工作区 Agent，以便实现多层级的任务调度。

#### 验收标准

1. THE Agent_Management_System SHALL 在系统初始化时自动创建一个 Master_Agent 实例，且系统中有且仅有一个 Master_Agent
2. WHEN 管理员在某个 Workspace 下创建 Workspace_Agent 时，THE Agent_Management_System SHALL 将该 Agent 关联到指定 Workspace 并持久化
3. THE Agent_Management_System SHALL 为每个 Agent 存储以下属性：名称、描述、所属工作区、关联的 Model 配置、系统提示词、关联的 Skill 列表
4. WHEN 管理员更新 Agent 的系统提示词时，THE Agent_Management_System SHALL 保存新的提示词并在下次调用时生效
5. THE Agent_Management_System SHALL 支持启用和禁用 Workspace_Agent，禁用后该 Agent 不响应调度请求
6. IF 管理员尝试删除一个 Workspace 下唯一的 Workspace_Agent，THEN THE Agent_Management_System SHALL 允许删除但给出警告提示

### 需求 3：Agent 调度机制

**用户故事：** 作为系统用户，我希望 Master_Agent 能够根据任务类型自动调度对应的 Workspace_Agent，同时各 Workspace_Agent 也能被直接调用。

#### 验收标准

1. WHEN Master_Agent 接收到一个任务请求时，THE Agent_Management_System SHALL 根据任务的工作区标识将任务路由到对应的 Workspace_Agent
2. WHEN 用户直接向某个 Workspace_Agent 发送请求时，THE Agent_Management_System SHALL 绕过 Master_Agent 直接执行该 Workspace_Agent 的处理逻辑
3. THE Agent_Management_System SHALL 为每次调度记录调度日志，包含发起方、目标 Agent、任务摘要、执行状态和耗时
4. IF 目标 Workspace_Agent 处于禁用状态，THEN THE Agent_Management_System SHALL 返回该 Agent 不可用的错误信息，不执行任务
5. WHILE Master_Agent 正在调度某个 Workspace_Agent 执行任务时，THE Agent_Management_System SHALL 支持并发调度其他 Workspace_Agent 执行不同任务

### 需求 4：Skill 管理

**用户故事：** 作为系统管理员，我希望能够创建和管理 Skill，并将其分配为公用或工作区专属，以便 Agent 灵活引用所需能力。

#### 验收标准

1. THE Agent_Management_System SHALL 支持创建 Skill，包含名称、描述、Skill 内容（Markdown 格式）、作用域（公用/工作区专属）字段
2. WHEN Skill 的作用域设置为公用时，THE Agent_Management_System SHALL 允许所有 Workspace_Agent 和 Master_Agent 引用该 Skill
3. WHEN Skill 的作用域设置为工作区专属时，THE Agent_Management_System SHALL 仅允许该工作区下的 Workspace_Agent 引用该 Skill
4. WHEN 管理员将一个 Skill 关联到某个 Agent 时，THE Agent_Management_System SHALL 在该 Agent 的系统提示词中注入该 Skill 的内容
5. THE Agent_Management_System SHALL 支持 Skill 的版本管理，更新 Skill 内容时保留历史版本
6. IF 管理员删除一个正在被 Agent 引用的 Skill，THEN THE Agent_Management_System SHALL 阻止删除并返回引用该 Skill 的 Agent 列表

### 需求 5：Knowledge 知识库管理

**用户故事：** 作为系统管理员，我希望能够按工作区上传和管理文档，以便 Agent 在执行任务时能够检索相关知识。

#### 验收标准

1. THE Agent_Management_System SHALL 支持按 Workspace 上传文档，每个文档关联到一个特定 Workspace 或 Public_Workspace
2. WHEN 用户上传文档时，THE Agent_Management_System SHALL 验证文件格式（支持 PDF、Word、Markdown、TXT）和文件大小（单文件不超过 20MB）
3. THE Agent_Management_System SHALL 为每个上传的文档存储元数据：文件名、文件大小、上传时间、所属工作区、上传者
4. WHEN 文档上传到 Public_Workspace 时，THE Agent_Management_System SHALL 使该文档对所有 Workspace_Agent 可见
5. WHEN 文档上传到特定 Workspace 时，THE Agent_Management_System SHALL 仅使该文档对该 Workspace 下的 Agent 可见
6. THE Agent_Management_System SHALL 支持文档的列表查询、按工作区筛选和删除操作
7. IF 用户上传的文件格式不在支持列表中，THEN THE Agent_Management_System SHALL 拒绝上传并返回支持的文件格式列表

### 需求 6：原生 Tool 管理

**用户故事：** 作为系统管理员，我希望系统内置一些原生工具，以便 Agent 在执行任务时能够调用基础能力。

#### 验收标准

1. THE Agent_Management_System SHALL 内置以下原生工具：Web 搜索、文件读取、文件写入、HTTP 请求
2. THE Agent_Management_System SHALL 为每个 Native_Tool 提供名称、描述、输入参数 Schema、输出格式的定义
3. WHEN Agent 执行任务需要调用 Native_Tool 时，THE Agent_Management_System SHALL 根据 Tool 名称匹配并执行对应的工具逻辑
4. THE Agent_Management_System SHALL 在管理界面展示所有可用的 Native_Tool 列表及其描述，但不允许用户修改原生工具的定义
5. IF Agent 调用一个不存在的 Tool 名称，THEN THE Agent_Management_System SHALL 返回工具未找到的错误信息

### 需求 7：工作区管理

**用户故事：** 作为系统管理员，我希望系统预置固定的工作区列表，并支持后续扩展自定义工作区。

#### 验收标准

1. THE Agent_Management_System SHALL 预置以下工作区：复盘文档生成、复盘内容审校、舆情系统、派芽知识库、策划系统
2. THE Agent_Management_System SHALL 为每个 Workspace 存储名称、描述、图标标识、排序权重、启用状态
3. WHEN 系统首次启动时，THE Agent_Management_System SHALL 自动创建预置工作区记录（如果不存在）
4. THE Agent_Management_System SHALL 支持管理员创建自定义 Workspace，自定义 Workspace 与预置 Workspace 具有相同的功能
5. IF 管理员尝试删除一个包含 Agent 或知识库文档的 Workspace，THEN THE Agent_Management_System SHALL 阻止删除并提示需先清理关联资源

### 需求 8：管理界面 - 四频道页面

**用户故事：** 作为系统管理员，我希望有一个统一的管理界面，包含 Model 配置、Agent、Skill、Knowledge 四个频道，以便集中管理所有 Agent 相关资源。

#### 验收标准

1. THE Agent_Management_System SHALL 提供一个独立的管理页面，包含 Model 配置、Agent、Skill、Knowledge 四个 Tab 频道
2. WHEN 用户切换到 Agent 频道时，THE Agent_Management_System SHALL 展示 Master_Agent 和按工作区分组的 Workspace_Agent 列表
3. WHEN 用户切换到 Skill 频道时，THE Agent_Management_System SHALL 展示公用 Skill 和按工作区分组的专属 Skill 列表
4. WHEN 用户切换到 Knowledge 频道时，THE Agent_Management_System SHALL 展示按工作区分组的文档列表，包含公共工作区分组
5. WHEN 用户切换到 Model 配置频道时，THE Agent_Management_System SHALL 展示所有 Model 配置列表，标注默认配置
6. THE Agent_Management_System SHALL 在 Agent 频道中支持点击某个 Agent 进入详情编辑页面，可配置系统提示词、关联 Skill、关联 Model

### 需求 9：现有页面入口集成

**用户故事：** 作为系统用户，我希望在复盘文档生成和复盘内容审校页面能够快速跳转到 Agent 配置页面，以便调整 Agent 行为。

#### 验收标准

1. THE Agent_Management_System SHALL 在复盘文档生成页面（/projects/[id]/generate）添加一个跳转到 Agent 配置页面的入口按钮
2. THE Agent_Management_System SHALL 在复盘内容审校页面（/projects/[id]/review）添加一个跳转到 Agent 配置页面的入口按钮
3. WHEN 用户点击入口按钮时，THE Agent_Management_System SHALL 导航到 Agent 管理页面，并自动定位到对应工作区的 Agent 配置
4. THE Agent_Management_System SHALL 将入口按钮放置在页面头部区域，使用图标和文字标识，不影响现有页面布局

### 需求 10：数据模型与持久化

**用户故事：** 作为开发者，我希望系统使用 Prisma ORM 管理数据模型，确保 Agent 管理相关数据的完整性和一致性。

#### 验收标准

1. THE Agent_Management_System SHALL 使用 Prisma Schema 定义以下数据模型：ModelConfig、Agent、Skill、Workspace、KnowledgeDocument、AgentSkill（关联表）、DispatchLog
2. THE Agent_Management_System SHALL 为 Agent 与 Skill 之间建立多对多关系，通过 AgentSkill 关联表实现
3. THE Agent_Management_System SHALL 为 Agent 与 Workspace 之间建立多对一关系（Master_Agent 的 workspaceId 为 null）
4. THE Agent_Management_System SHALL 为 KnowledgeDocument 与 Workspace 之间建立多对一关系，workspaceId 为 null 表示属于 Public_Workspace
5. WHEN 数据库 Schema 变更时，THE Agent_Management_System SHALL 通过 Prisma Migration 管理变更历史
6. THE Agent_Management_System SHALL 为所有数据模型包含 createdAt 和 updatedAt 时间戳字段
