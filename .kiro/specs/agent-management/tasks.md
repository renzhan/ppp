# Implementation Plan: Agent 管理系统

## Overview

基于现有项目结构，按照 Prisma Schema → 后端服务层 → API 路由 → 前端页面的顺序逐步实现 Agent 管理系统。每个步骤在前一步基础上递增构建，确保代码始终可集成。使用 TypeScript 实现，与现有项目技术栈一致。

## Tasks

- [x] 1. 数据库 Schema 与基础设施
  - [x] 1.1 扩展 Prisma Schema，添加 Agent 管理系统数据模型
    - 在 `ppp/prisma/schema.prisma` 中添加 Workspace、ModelConfig、Agent、Skill、SkillVersion、AgentSkill、KnowledgeDocument、NativeTool、DispatchLog 模型
    - 定义所有关系、索引和约束（参照设计文档中的 Prisma Schema）
    - 运行 `npx prisma generate` 确保 client 生成成功
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.6_

  - [x] 1.2 创建 CryptoUtil 加密工具模块
    - 创建 `ppp/src/agent-management/crypto-util.ts`
    - 实现 AES-256-GCM 加密/解密函数，密钥从环境变量 `ENCRYPTION_KEY` 读取
    - 实现 mask 函数，返回 "sk-****xxxx" 格式的脱敏字符串
    - 加密输出格式：`iv:authTag:ciphertext`（base64 编码）
    - _Requirements: 1.4_

  - [x] 1.3 编写 CryptoUtil 属性测试
    - **Property 1: API Key 加密往返一致性** — 任意字符串加密后解密应等于原始值，密文不含明文
    - **Property 2: API Key 脱敏不暴露完整密钥** — mask 后的字符串不包含原始完整 Key
    - 测试文件：`ppp/tests/agent-management/crypto-util.test.ts`
    - **Validates: Requirements 1.4**

  - [x] 1.4 创建数据库 seed 脚本，初始化预置工作区和原生工具
    - 创建 `ppp/src/agent-management/seed.ts`
    - 预置 5 个工作区：复盘文档生成、复盘内容审校、舆情系统、派芽知识库、策划系统
    - 预置 4 个原生工具：web_search、file_read、file_write、http_request
    - 实现幂等逻辑（upsert），多次执行不产生重复记录
    - _Requirements: 7.1, 7.2, 7.3, 6.1, 6.2_

  - [x] 1.5 编写工作区初始化幂等性属性测试
    - **Property 18: 工作区初始化幂等性** — 多次调用 seed 后预置工作区数量始终为 5
    - 测试文件：`ppp/tests/agent-management/workspace.test.ts`
    - **Validates: Requirements 7.3**

- [x] 2. Checkpoint - 确保 Schema 生成和 seed 脚本正常
  - 运行 `npx prisma generate` 确认无错误
  - 运行 seed 脚本确认预置数据正确写入
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. 后端服务层 - Model 配置与工作区
  - [x] 3.1 实现 ModelConfigService
    - 创建 `ppp/src/agent-management/model-config-service.ts`
    - 实现 create：校验必填字段（apiKey、baseUrl、modelName）、校验 URL 格式、加密 API Key 后存储
    - 实现 update：校验 URL 格式、若更新 apiKey 则重新加密
    - 实现 delete：检查是否被 Agent 引用，有引用则阻止删除并返回引用列表
    - 实现 findAll：返回列表时 API Key 使用 mask 脱敏
    - 实现 setDefault：确保同一时刻只有一个 isDefault=true
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 3.2 编写 ModelConfigService 属性测试
    - **Property 3: 必填字段校验** — 缺失任一必填字段时创建应失败
    - **Property 4: Base URL 格式校验** — 非法 URL 应被拒绝
    - **Property 5: 默认配置唯一性** — 任意时刻最多一个 isDefault=true
    - 测试文件：`ppp/tests/agent-management/model-config.test.ts`
    - **Validates: Requirements 1.3, 1.5, 1.6**

  - [x] 3.3 实现 WorkspaceService
    - 创建 `ppp/src/agent-management/workspace-service.ts`
    - 实现 findAll、create（自定义工作区）、update、delete（检查关联 Agent 和文档）
    - 实现 initPresets 方法供 seed 调用
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 4. 后端服务层 - Agent 与 Skill 管理
  - [x] 4.1 实现 AgentManagementService
    - 创建 `ppp/src/agent-management/agent-management-service.ts`
    - 实现 initMasterAgent：确保系统中有且仅有一个 type="master" 的 Agent
    - 实现 createWorkspaceAgent：关联 workspace、modelConfig、可选 skillIds
    - 实现 update、delete、findById、findAll、findByWorkspace
    - 实现 toggleEnabled：启用/禁用 Agent
    - 实现 attachSkill/detachSkill：关联/取消关联 Skill（检查作用域权限）
    - 实现 buildSystemPrompt：组装 Agent 自身 systemPrompt + 所有关联 Skill 的 content
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 4.2 编写 AgentManagementService 属性测试
    - **Property 7: Master Agent 单例不变量** — 多次 initMasterAgent 后 master 记录数始终为 1
    - **Property 8: Agent 创建持久化往返** — 创建后查询应返回一致属性
    - **Property 9: 禁用 Agent 拒绝调度** — isEnabled=false 的 Agent 不应被成功调度
    - 测试文件：`ppp/tests/agent-management/agent-management.test.ts`
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.5**

  - [x] 4.3 实现 SkillManagementService
    - 创建 `ppp/src/agent-management/skill-management-service.ts`
    - 实现 create：创建 Skill 并同时创建 v1 的 SkillVersion 记录
    - 实现 update：递增 version 号，创建新 SkillVersion 记录，更新 Skill 主记录
    - 实现 delete：检查是否被 Agent 引用，有引用则阻止
    - 实现 findAll（支持 scope/workspaceId 筛选）、getVersionHistory
    - 实现 getAvailableForAgent：返回公用 Skill + Agent 所属工作区的专属 Skill
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 4.4 编写 SkillManagementService 属性测试
    - **Property 13: Skill 作用域访问控制** — public Skill 任何 Agent 可关联，workspace Skill 仅同工作区 Agent 可关联
    - **Property 14: Skill 注入系统提示词** — buildSystemPrompt 应包含所有关联 Skill 的 content
    - **Property 15: Skill 版本历史保留** — N 次更新后应有 N 条版本记录，version 递增
    - 测试文件：`ppp/tests/agent-management/skill-management.test.ts`
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5**

- [x] 5. 后端服务层 - Knowledge 与 Dispatch
  - [x] 5.1 实现 KnowledgeService
    - 创建 `ppp/src/agent-management/knowledge-service.ts`
    - 实现 validateFile：校验 MIME 类型（PDF、Word、Markdown、TXT）和文件大小（≤20MB）
    - 实现 upload：保存文件到 `uploads/knowledge/{workspaceId}/{uuid}-{filename}`，写入 DB 元数据
    - 实现 delete：删除文件和 DB 记录
    - 实现 findByWorkspace、findAll（支持 workspaceId 筛选）
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 5.2 编写 KnowledgeService 属性测试
    - **Property 16: 文件格式与大小校验** — 非法格式或超大文件应被拒绝，合法文件应通过
    - **Property 17: 文档可见性按工作区隔离** — 公共文档所有工作区可见，专属文档仅所属工作区可见
    - 测试文件：`ppp/tests/agent-management/knowledge.test.ts`
    - **Validates: Requirements 5.2, 5.4, 5.5, 5.7**

  - [x] 5.3 实现 DispatchService
    - 创建 `ppp/src/agent-management/dispatch-service.ts`
    - 实现 dispatch：根据 workspaceId/targetAgentId 路由任务，组装 systemPrompt，调用 pi-ai completeSimple
    - 直接调用模式：指定 targetAgentId 时绕过 Master，sourceAgentId 为 null
    - Master 路由模式：未指定时通过 Master Agent 分析任务确定目标工作区
    - 检查目标 Agent 启用状态，禁用则返回错误
    - 创建 DispatchLog 记录（pending → running → success/error），记录耗时
    - 实现 getLogs 查询接口
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 5.4 编写 DispatchService 属性测试
    - **Property 10: 任务路由正确性** — 带 workspaceId 的任务应路由到该工作区的 Agent
    - **Property 11: 直接调度绕过 Master** — 指定 targetAgentId 时 sourceAgentId 应为 null
    - **Property 12: 调度日志完整性** — 每次调度应创建包含必要字段的日志记录
    - 测试文件：`ppp/tests/agent-management/dispatch.test.ts`
    - **Validates: Requirements 3.1, 3.2, 3.3**

- [x] 6. Checkpoint - 后端服务层完整性验证
  - Ensure all tests pass, ask the user if questions arise.
  - 确认所有 Service 的引用完整性检查正常工作

  - [x] 6.1 编写引用完整性属性测试
    - **Property 6: 引用完整性阻止删除** — 被引用的 ModelConfig/Skill/Workspace 删除应被阻止并返回引用列表
    - 测试文件：`ppp/tests/agent-management/referential-integrity.test.ts`
    - **Validates: Requirements 1.7, 4.6, 7.5**

- [x] 7. API 路由层 - Model 配置与工作区
  - [x] 7.1 实现 Model 配置 API 路由
    - 创建 `ppp/web/src/app/api/agent-mgmt/models/route.ts`（GET 列表、POST 创建）
    - 创建 `ppp/web/src/app/api/agent-mgmt/models/[id]/route.ts`（GET 详情、PUT 更新、DELETE 删除）
    - 创建 `ppp/web/src/app/api/agent-mgmt/models/[id]/set-default/route.ts`（POST 设为默认）
    - 统一错误响应格式：`{ error, message, details?, references? }`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 7.2 实现工作区 API 路由
    - 创建 `ppp/web/src/app/api/agent-mgmt/workspaces/route.ts`（GET 列表、POST 创建）
    - 创建 `ppp/web/src/app/api/agent-mgmt/workspaces/[id]/route.ts`（PUT 更新、DELETE 删除）
    - _Requirements: 7.1, 7.4, 7.5_

- [x] 8. API 路由层 - Agent、Skill、Knowledge、Dispatch
  - [x] 8.1 实现 Agent API 路由
    - 创建 `ppp/web/src/app/api/agent-mgmt/agents/route.ts`（GET 列表、POST 创建）
    - 创建 `ppp/web/src/app/api/agent-mgmt/agents/[id]/route.ts`（GET 详情、PUT 更新、DELETE 删除）
    - 创建 `ppp/web/src/app/api/agent-mgmt/agents/[id]/toggle/route.ts`（POST 启用/禁用）
    - 创建 `ppp/web/src/app/api/agent-mgmt/agents/[id]/skills/route.ts`（POST 关联 Skill）
    - 创建 `ppp/web/src/app/api/agent-mgmt/agents/[id]/skills/[skillId]/route.ts`（DELETE 取消关联）
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 8.2 实现 Skill API 路由
    - 创建 `ppp/web/src/app/api/agent-mgmt/skills/route.ts`（GET 列表、POST 创建）
    - 创建 `ppp/web/src/app/api/agent-mgmt/skills/[id]/route.ts`（GET 详情、PUT 更新、DELETE 删除）
    - 创建 `ppp/web/src/app/api/agent-mgmt/skills/[id]/versions/route.ts`（GET 版本历史）
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6_

  - [x] 8.3 实现 Knowledge API 路由
    - 创建 `ppp/web/src/app/api/agent-mgmt/knowledge/route.ts`（GET 文档列表）
    - 创建 `ppp/web/src/app/api/agent-mgmt/knowledge/upload/route.ts`（POST 上传文档，处理 multipart/form-data）
    - 创建 `ppp/web/src/app/api/agent-mgmt/knowledge/[id]/route.ts`（DELETE 删除文档）
    - _Requirements: 5.1, 5.2, 5.3, 5.6, 5.7_

  - [x] 8.4 实现 Dispatch API 路由
    - 创建 `ppp/web/src/app/api/agent-mgmt/dispatch/route.ts`（POST 发起调度）
    - 创建 `ppp/web/src/app/api/agent-mgmt/dispatch/logs/route.ts`（GET 调度日志）
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 9. Checkpoint - API 路由层验证
  - Ensure all tests pass, ask the user if questions arise.
  - 确认所有 API 端点返回正确的 HTTP 状态码和错误格式

- [x] 10. 前端页面 - 管理主页面与 Tab 组件
  - [x] 10.1 创建管理主页面框架与 Tab 导航
    - 创建 `ppp/web/src/app/admin/agents/page.tsx`
    - 实现四 Tab 导航：Model 配置、Agent、Skill、Knowledge
    - 使用 URL searchParams 管理当前 Tab 状态
    - 页面布局与现有 admin 页面风格一致
    - _Requirements: 8.1_

  - [x] 10.2 实现 Model 配置频道组件
    - 创建 `ppp/web/src/app/admin/agents/components/model-config-tab.tsx`
    - 展示 Model 配置列表，标注默认配置
    - 实现创建/编辑弹窗（FormModal），包含 API Key、Base URL、模型名称等字段
    - 实现删除确认（引用冲突时展示引用列表）
    - 实现设为默认操作
    - 使用 TanStack Query 管理数据获取和缓存失效
    - _Requirements: 8.5, 1.1, 1.6_

  - [x] 10.3 实现 Agent 频道组件
    - 创建 `ppp/web/src/app/admin/agents/components/agent-tab.tsx`
    - 展示 Master_Agent 和按工作区分组的 Workspace_Agent 列表
    - 实现创建 Agent 弹窗：选择工作区、Model 配置、输入名称和描述
    - 实现启用/禁用切换
    - 点击 Agent 名称跳转到详情编辑页
    - _Requirements: 8.2, 8.6_

  - [x] 10.4 实现 Skill 频道组件
    - 创建 `ppp/web/src/app/admin/agents/components/skill-tab.tsx`
    - 展示公用 Skill 和按工作区分组的专属 Skill 列表
    - 实现创建/编辑弹窗：名称、描述、Markdown 内容编辑器、作用域选择
    - 实现删除确认（引用冲突时展示引用列表）
    - 展示版本号，支持查看版本历史
    - _Requirements: 8.3, 4.1, 4.5_

  - [x] 10.5 实现 Knowledge 频道组件
    - 创建 `ppp/web/src/app/admin/agents/components/knowledge-tab.tsx`
    - 展示按工作区分组的文档列表（含公共工作区分组）
    - 实现文件上传组件：拖拽上传、格式校验提示、大小限制提示
    - 展示文档元数据：文件名、大小、上传时间、上传者
    - 实现删除操作
    - _Requirements: 8.4, 5.1, 5.2, 5.3, 5.6_

- [x] 11. 前端页面 - Agent 详情与入口集成
  - [x] 11.1 实现 Agent 详情编辑页
    - 创建 `ppp/web/src/app/admin/agents/[id]/page.tsx`
    - 展示 Agent 基本信息（名称、描述、类型、所属工作区）
    - 实现系统提示词编辑（Markdown/文本编辑器）
    - 实现关联 Model 配置选择
    - 实现关联 Skill 管理：展示已关联列表、添加/移除 Skill
    - 保存时调用 PUT API 更新
    - _Requirements: 8.6, 2.3, 2.4_

  - [x] 11.2 在生成页面和审校页面添加 Agent 配置入口按钮
    - 修改 `ppp/web/src/app/projects/[id]/generate/page.tsx`，在页面头部添加跳转按钮
    - 修改 `ppp/web/src/app/projects/[id]/review/page.tsx`，在页面头部添加跳转按钮
    - 按钮点击跳转到 `/admin/agents`，通过 query 参数定位到对应工作区
    - 使用图标 + 文字标识，不影响现有页面布局
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 11.3 创建共享组件：WorkspaceSelector
    - 创建 `ppp/web/src/app/admin/agents/components/workspace-selector.tsx`
    - 下拉选择工作区，支持"公共"选项
    - 在 Agent 创建、Skill 创建、Knowledge 上传等场景复用
    - _Requirements: 7.1, 7.4_

- [x] 12. 前端页面 - 原生工具展示与 NativeTool 管理
  - [x] 12.1 在管理界面展示原生工具列表
    - 在 Agent 详情页或独立区域展示所有 NativeTool 的名称、描述、输入参数 Schema
    - 标注为"系统内置"，不允许编辑或删除
    - _Requirements: 6.2, 6.4_

- [x] 13. Checkpoint - 前端页面完整性验证
  - Ensure all tests pass, ask the user if questions arise.
  - 确认所有页面正常渲染，Tab 切换流畅，表单提交正确

- [x] 14. 集成与收尾
  - [x] 14.1 创建 Agent 管理模块入口文件，统一导出所有 Service
    - 创建 `ppp/src/agent-management/index.ts`
    - 导出 ModelConfigService、AgentManagementService、SkillManagementService、KnowledgeService、DispatchService、CryptoUtil
    - 确保模块可被 API 路由正确引用
    - _Requirements: 10.1_

  - [x] 14.2 添加 ENCRYPTION_KEY 环境变量配置
    - 在 `ppp/.env.example` 中添加 `ENCRYPTION_KEY` 说明
    - 在 `ppp/src/config/env.ts` 中添加 ENCRYPTION_KEY 读取逻辑
    - _Requirements: 1.4_

  - [x] 14.3 编写资源分组正确性和时间戳属性测试
    - **Property 19: 资源按工作区分组正确性** — 每个实体应出现在且仅出现在其所属工作区分组中
    - **Property 20: 时间戳自动填充** — 新记录的 createdAt/updatedAt 应自动填充且 createdAt ≤ updatedAt
    - 测试文件：`ppp/tests/agent-management/workspace.test.ts`（追加）
    - **Validates: Requirements 8.2, 8.3, 8.4, 10.6**

  - [x] 14.4 编写 API 集成测试
    - 测试 Model 配置 API 的完整 CRUD 流程
    - 测试 Agent API 的创建、关联 Skill、启用/禁用流程
    - 测试 Skill API 的版本管理流程
    - 测试 Knowledge API 的文件上传和格式校验
    - 测试 Dispatch API 的调度和日志记录
    - 测试文件：`ppp/tests/agent-management/integration/` 目录下
    - _Requirements: 1.1, 2.2, 3.3, 4.5, 5.2_

- [x] 15. Final checkpoint - 全部测试通过
  - Ensure all tests pass, ask the user if questions arise.
  - 确认 Prisma Schema 无冲突，所有 API 端点可用，前端页面正常交互

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 每个 Task 引用了具体的需求条款，确保需求全覆盖
- Checkpoints 确保增量验证，避免后期大规模返工
- 属性测试验证核心业务逻辑的通用正确性，单元测试验证具体场景
- 前端使用 TanStack Query 管理服务端状态，与现有项目风格一致
- 文件存储使用本地文件系统，后续可迁移到对象存储
