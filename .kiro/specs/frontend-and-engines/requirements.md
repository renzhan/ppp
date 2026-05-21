# Requirements Document

## Introduction

本系统为小红书营销项目复盘系统的前端Web应用及智能引擎层。在已有后端基础设施（数据采集层、计算引擎、报告组装器、Prisma ORM + PostgreSQL）之上，构建完整的用户交互界面和三大智能引擎：数据评级引擎（Data Rating Engine）、模块决策引擎（Module Decision Engine）、叙事策略引擎（Narrative Strategy Engine）。系统支持4种项目类型（新品上市、日常种草、节点营销、竞品防御），提供从项目创建、数据上传、报告生成到审校编辑的全流程操作体验。

## Glossary

- **Frontend_App**: 前端Web应用，基于Next.js (React) + TypeScript构建
- **Rating_Engine**: 数据评级引擎，对所有指标进行S/A/B/C/D五级评级
- **Decision_Engine**: 模块决策引擎，决定8个报告模块的显示/隐藏/降级
- **Narrative_Engine**: 叙事策略引擎，AI驱动的叙事文案生成与策略管理
- **Review_Platform**: 审校台，用户对生成报告进行审阅、编辑、调整的交互平台
- **Project_Wizard**: 项目创建向导，3步引导式项目创建流程
- **Module**: 报告模块，复盘报告中的独立内容单元（共8个模块）
- **Rating**: 数据评级，S/A/B/C/D五级评分
- **Tone_Intensity**: 叙事语气强度，分为积极版/标准版/保守版三档
- **Attribution_Strategy**: 归因策略，将数据表现归因到具体原因的叙事方法
- **Project_Type**: 项目类型，决定叙事策略的项目分类（新品上市/日常种草/节点营销/竞品防御）
- **Degraded_Module**: 降级模块，因数据不足而简化展示的模块
- **Platform_Data**: 平台数据，来自蒲公英/聚光/千瓜/灵犀四个平台的数据
- **Report_Version**: 报告版本，同一项目可生成多个版本的报告
- **Existing_Backend**: 已有后端系统，包含Prisma ORM、计算引擎纯函数、数据采集层、报告组装器和LLM客户端

## Requirements

### Requirement 1: 项目列表与管理页面

**User Story:** As a 项目运营人员, I want 在项目列表页面查看、筛选和管理所有营销复盘项目, so that 能够快速定位和访问目标项目。

#### Acceptance Criteria

1. THE Frontend_App SHALL 展示项目列表页面，包含以下字段：项目名称、品牌、品类、项目类型、项目周期、创建时间、报告状态
2. THE Frontend_App SHALL 提供按品牌、品类、项目类型、项目状态进行筛选的过滤器
3. THE Frontend_App SHALL 提供按项目名称进行模糊搜索的搜索框
4. WHEN 用户点击项目列表中的某个项目时, THE Frontend_App SHALL 导航到该项目的详情页面
5. THE Frontend_App SHALL 支持项目列表的分页展示，每页默认20条记录
6. THE Frontend_App SHALL 通过Next.js API路由从Existing_Backend的Prisma数据库读取项目数据

### Requirement 2: 项目创建向导

**User Story:** As a 项目运营人员, I want 通过3步引导式向导创建新项目, so that 能够结构化地录入项目基础信息并上传策划案。

#### Acceptance Criteria

1. THE Project_Wizard SHALL 包含3个步骤：基本信息填写 → 上传策划案 → 确认创建
2. WHEN 用户进入第1步时, THE Project_Wizard SHALL 要求填写：项目名称（必填）、品牌（必填）、品类（必填）、SPU/产品名称（选填）、项目周期开始日期（必填）、项目周期结束日期（必填）、项目类型（必填，从4种类型中选择）
3. THE Project_Wizard SHALL 提供4种项目类型选项：新品上市、日常种草、节点营销、竞品防御
4. WHEN 用户进入第2步时, THE Project_Wizard SHALL 提供策划案文件上传区域，支持PDF和Word格式
5. WHEN 用户上传策划案后, THE Frontend_App SHALL 调用Existing_Backend的AI解析接口提取项目背景信息（传播目的、策略回顾、目标人群、核心传播信息）
6. WHEN 用户进入第3步时, THE Project_Wizard SHALL 展示所有已填写信息的确认摘要
7. WHEN 用户确认创建时, THE Frontend_App SHALL 通过Next.js API路由将项目数据写入Existing_Backend的PostgreSQL数据库
8. IF 必填字段未填写, THEN THE Project_Wizard SHALL 在对应字段下方显示红色错误提示且阻止进入下一步

### Requirement 3: 数据上传页面

**User Story:** As a 项目运营人员, I want 通过数据上传页面导入各类项目数据, so that 系统能够获取完整的数据用于计算和报告生成。

#### Acceptance Criteria

1. THE Frontend_App SHALL 提供4种数据上传入口：执行底表上传、广告投放底表上传、外部平台数据上传、人工录入
2. WHEN 用户上传执行底表时, THE Frontend_App SHALL 接受xlsx/csv格式文件，调用Existing_Backend的SpreadsheetParser解析蒲公英笔记数据和业务标注数据
3. WHEN 用户上传广告投放底表时, THE Frontend_App SHALL 接受xlsx/csv格式文件，解析聚光平台投放数据
4. WHEN 用户上传外部平台数据时, THE Frontend_App SHALL 接受灵犀平台底表（AIPS、品牌排名、SOC/SOV、SPU排名）
5. THE Frontend_App SHALL 提供人工录入表单，支持录入：KPI目标值、大盘Benchmark数据、品牌搜索指数、话题曝光量
6. WHEN 数据上传成功后, THE Frontend_App SHALL 显示上传结果摘要（成功条数、失败条数、失败原因）
7. IF 上传文件格式不正确或字段缺失, THEN THE Frontend_App SHALL 显示具体的错误位置（行号、列名）和错误原因
8. THE Frontend_App SHALL 通过Next.js API路由调用Existing_Backend的DataPersistenceService进行数据持久化

### Requirement 4: 数据评级引擎

**User Story:** As a 项目运营人员, I want 系统对所有指标进行S/A/B/C/D五级评级, so that 能够直观了解各指标的表现水平并驱动模块决策和叙事策略。

#### Acceptance Criteria

1. THE Rating_Engine SHALL 对每个指标从三个维度进行评级：vs KPI目标（来自策划案）、vs 行业基准（平台内置Benchmark）、vs 投前数据（历史对比）
2. THE Rating_Engine SHALL 输出S/A/B/C/D五个等级，其中S为最优、D为最差
3. WHEN 指标的KPI完成率 >= 150%时, THE Rating_Engine SHALL 将该维度评为S级
4. WHEN 指标的KPI完成率 >= 120%且 < 150%时, THE Rating_Engine SHALL 将该维度评为A级
5. WHEN 指标的KPI完成率 >= 100%且 < 120%时, THE Rating_Engine SHALL 将该维度评为B级
6. WHEN 指标的KPI完成率 >= 80%且 < 100%时, THE Rating_Engine SHALL 将该维度评为C级
7. WHEN 指标的KPI完成率 < 80%时, THE Rating_Engine SHALL 将该维度评为D级
8. THE Rating_Engine SHALL 对行业基准维度使用相同的百分比阈值（实际值/基准值的比率）
9. THE Rating_Engine SHALL 对投前数据维度使用相同的百分比阈值（投后值/投前值的比率）
10. WHEN 某个维度的对比数据缺失时, THE Rating_Engine SHALL 将该维度标记为"无数据"而非给出评级
11. THE Rating_Engine SHALL 计算综合评级，取三个维度中最高的评级作为该指标的最终评级
12. THE Rating_Engine SHALL 对成本类指标（CPE、CPM、CPC）进行反向评级（目标值/实际值，越低越好）

### Requirement 5: 模块决策引擎

**User Story:** As a 项目运营人员, I want 系统根据数据评级和项目类型自动决定报告中各模块的显示状态, so that 报告内容与项目实际数据匹配，避免展示无意义的空模块。

#### Acceptance Criteria

1. THE Decision_Engine SHALL 管理8个报告模块的显示状态：M1数据总览、M2项目回顾、M3项目亮点、M4未达预期项、M5内容分析、M6竞品洞察、M7投流分析、M8问题诊断与建议
2. THE Decision_Engine SHALL 始终显示M1数据总览模块
3. WHEN 项目存在2个及以上S级或A级评级的指标时, THE Decision_Engine SHALL 显示M3项目亮点模块
4. IF 项目不存在2个及以上S级或A级评级的指标, THEN THE Decision_Engine SHALL 隐藏M3项目亮点模块
5. WHEN 品牌在竞品对比中存在S级或A级表现时, THE Decision_Engine SHALL 显示M6竞品洞察模块
6. IF 品牌在竞品对比中不存在S级或A级表现, THEN THE Decision_Engine SHALL 隐藏M6竞品洞察模块
7. WHEN 项目广告投放费用占比超过总费用20%时, THE Decision_Engine SHALL 显示M7投流分析模块
8. IF 项目广告投放费用占比不超过总费用20%, THEN THE Decision_Engine SHALL 隐藏M7投流分析模块
9. THE Decision_Engine SHALL 根据项目类型调整模块优先级和展示策略
10. WHEN 模块所需数据不完整但部分可用时, THE Decision_Engine SHALL 将该模块标记为"降级"状态并简化展示内容
11. THE Decision_Engine SHALL 将决策结果（显示/隐藏/降级）存储到数据库，支持用户在审校台手动覆盖

### Requirement 6: 叙事策略引擎

**User Story:** As a 项目运营人员, I want 系统根据数据评级和项目类型自动生成合适的叙事文案, so that 报告文案专业、有说服力且符合项目定位。

#### Acceptance Criteria

1. THE Narrative_Engine SHALL 维护归因策略库（Attribution Strategy Library），包含多种将数据表现归因到具体原因的叙事模板
2. THE Narrative_Engine SHALL 支持3种语气强度：积极版（强调成就）、标准版（客观陈述）、保守版（谨慎表达）
3. WHEN 指标评级为S或A时, THE Narrative_Engine SHALL 使用积极版语气生成叙事文案
4. WHEN 指标评级为B时, THE Narrative_Engine SHALL 使用标准版语气生成叙事文案
5. WHEN 指标评级为C或D时, THE Narrative_Engine SHALL 使用保守版语气并应用"问题转机会"叙事转换策略
6. THE Narrative_Engine SHALL 根据项目类型（新品上市/日常种草/节点营销/竞品防御）选择对应的归因策略集
7. THE Narrative_Engine SHALL 使用YAML格式管理所有Prompt模板，支持版本控制
8. WHEN 生成叙事文案时, THE Narrative_Engine SHALL 调用Existing_Backend的LLM客户端（gpt-5.1）进行文案生成
9. THE Narrative_Engine SHALL 对未达预期的指标（C/D级）自动应用"问题转机会"转换，将负面数据重新框架为改进方向
10. IF LLM调用失败, THEN THE Narrative_Engine SHALL 降级使用YAML模板中的预设文案

### Requirement 7: 报告生成页面

**User Story:** As a 项目运营人员, I want 在报告生成页面配置和触发报告生成, so that 能够按需生成定制化的复盘报告。

#### Acceptance Criteria

1. THE Frontend_App SHALL 提供报告生成配置页面，展示8个模块的开关状态（由Decision_Engine预设）
2. THE Frontend_App SHALL 允许用户手动覆盖Decision_Engine的模块显示/隐藏决策
3. THE Frontend_App SHALL 提供语气强度全局设置（积极版/标准版/保守版）
4. WHEN 用户点击"生成报告"时, THE Frontend_App SHALL 依次调用Rating_Engine、Decision_Engine、Narrative_Engine，最终通过Existing_Backend的报告组装器生成完整报告
5. THE Frontend_App SHALL 展示报告生成进度（数据评级中 → 模块决策中 → 文案生成中 → 组装完成）
6. WHEN 报告生成完成后, THE Frontend_App SHALL 自动跳转到审校台页面
7. THE Frontend_App SHALL 支持报告版本管理，每次生成创建新版本
8. THE Frontend_App SHALL 展示历史版本列表，支持版本间对比

### Requirement 8: 审校台布局与导航

**User Story:** As a 项目运营人员, I want 在审校台中通过三栏布局高效审阅和编辑报告内容, so that 能够快速定位、预览和修改报告各模块。

#### Acceptance Criteria

1. THE Review_Platform SHALL 采用三栏布局：左侧模块导航树、中间内容预览区、右侧AI问答面板
2. THE Review_Platform SHALL 在左侧导航树中展示所有已启用模块的层级结构
3. WHEN 用户点击左侧导航树中的模块时, THE Review_Platform SHALL 在中间预览区滚动到对应模块内容
4. THE Review_Platform SHALL 在中间预览区以富文本格式展示报告内容，包含文字段落和数据图表
5. THE Review_Platform SHALL 在右侧提供AI问答面板，支持用户就报告内容进行提问
6. THE Review_Platform SHALL 支持响应式布局，在不同屏幕尺寸下保持可用性

### Requirement 9: 审校台编辑功能

**User Story:** As a 项目运营人员, I want 在审校台中对报告内容进行精细化编辑和调整, so that 最终输出的报告完全符合客户需求。

#### Acceptance Criteria

1. THE Review_Platform SHALL 支持对每个模块执行三种操作：确认（保持当前内容）、重新生成（调用Narrative_Engine重新生成）、手动编辑（进入富文本编辑模式）
2. THE Review_Platform SHALL 支持模块级别的开关切换（显示/隐藏模块）
3. THE Review_Platform SHALL 支持段落级别的语气强度切换（积极版/标准版/保守版）
4. WHEN 用户切换段落语气强度时, THE Narrative_Engine SHALL 使用新语气重新生成该段落文案
5. THE Review_Platform SHALL 支持归因角度切换，为同一数据提供不同的归因解释
6. THE Review_Platform SHALL 支持数据列选择，允许隐藏C/D级评级的指标列
7. THE Review_Platform SHALL 支持"问题转机会"一键转换，将负面表述转换为改进建议
8. THE Review_Platform SHALL 支持图表重新渲染，用户可调整图表类型和展示维度
9. WHEN 用户进行任何编辑操作后, THE Review_Platform SHALL 自动保存编辑状态到数据库

### Requirement 10: AI问答侧边栏

**User Story:** As a 项目运营人员, I want 在审校台中通过AI问答获取数据解读和优化建议, so that 能够深入理解数据含义并获得专业的修改建议。

#### Acceptance Criteria

1. THE Review_Platform SHALL 在右侧面板提供AI对话界面，支持多轮对话
2. THE Review_Platform SHALL 支持以下类型的AI问答：归因分析（为什么某指标表现好/差）、数据查询（查询特定维度的详细数据）、优化建议（针对特定模块的改进方向）
3. WHEN 用户提出归因分析问题时, THE Narrative_Engine SHALL 结合项目数据和评级结果生成归因解释
4. WHEN 用户提出数据查询时, THE Frontend_App SHALL 从数据库检索相关数据并以结构化格式展示
5. WHEN 用户提出优化建议请求时, THE Narrative_Engine SHALL 基于当前数据评级生成针对性建议
6. THE Review_Platform SHALL 支持将AI回答中的文案片段一键插入到报告对应位置
7. THE Review_Platform SHALL 保留对话历史，支持上下文关联的多轮对话

### Requirement 11: 平台数据策略

**User Story:** As a 项目运营人员, I want 系统根据各平台数据的评级自动决定是否展示该平台数据, so that 报告中只展示有价值的平台数据，避免展示表现不佳的数据。

#### Acceptance Criteria

1. THE Decision_Engine SHALL 对蒲公英平台数据执行以下展示规则：WHEN 爆文率评级为S/A且CPE评级为S/A/B时显示，否则隐藏
2. THE Decision_Engine SHALL 对聚光平台数据执行以下展示规则：WHEN 搜索率评级为S/A且CTR评级为S/A/B且CPE对比优于行业时显示，否则隐藏
3. THE Decision_Engine SHALL 对千瓜平台数据执行以下展示规则：WHEN 品牌排名进入前10时显示，否则隐藏
4. THE Decision_Engine SHALL 对灵犀平台数据执行以下展示规则：WHEN 搜索增长评级为S/A且人群增长评级为S/A/B且CPTI优于行业时显示，否则隐藏
5. WHEN 某平台数据被决定隐藏时, THE Decision_Engine SHALL 在报告中完全移除该平台相关段落
6. THE Review_Platform SHALL 允许用户在审校台手动覆盖平台数据的显示/隐藏决策

### Requirement 12: 项目类型与叙事策略映射

**User Story:** As a 项目运营人员, I want 系统根据项目类型自动选择合适的叙事策略, so that 报告文案风格与项目定位一致。

#### Acceptance Criteria

1. WHEN 项目类型为"新品上市"时, THE Narrative_Engine SHALL 侧重"市场突破"和"用户认知建立"的归因策略
2. WHEN 项目类型为"日常种草"时, THE Narrative_Engine SHALL 侧重"持续渗透"和"口碑积累"的归因策略
3. WHEN 项目类型为"节点营销"时, THE Narrative_Engine SHALL 侧重"节点爆发"和"流量转化"的归因策略
4. WHEN 项目类型为"竞品防御"时, THE Narrative_Engine SHALL 侧重"份额保卫"和"差异化优势"的归因策略
5. THE Narrative_Engine SHALL 在YAML策略库中为每种项目类型维护独立的Prompt模板集
6. THE Narrative_Engine SHALL 支持在审校台中切换项目类型以预览不同叙事风格的效果

### Requirement 13: 报告导出

**User Story:** As a 项目运营人员, I want 将审校完成的报告导出为Word或PDF格式, so that 能够交付给客户标准化的复盘文档。

#### Acceptance Criteria

1. THE Frontend_App SHALL 支持将报告导出为Word(.docx)格式
2. THE Frontend_App SHALL 支持将报告导出为PDF格式
3. THE Frontend_App SHALL 在导出文件中保留所有图表、表格和格式
4. WHEN 用户点击导出时, THE Frontend_App SHALL 使用docx/pptx生成库在服务端生成文件并提供下载
5. THE Frontend_App SHALL 在导出前应用审校台中的所有编辑（模块开关、语气调整、手动修改）
6. IF 导出过程中发生错误, THEN THE Frontend_App SHALL 显示错误提示并建议用户重试

### Requirement 14: 报告版本管理

**User Story:** As a 项目运营人员, I want 管理同一项目的多个报告版本, so that 能够追踪报告的修改历史并在需要时回退到之前的版本。

#### Acceptance Criteria

1. THE Frontend_App SHALL 为每次报告生成创建独立的版本记录，包含版本号、生成时间、生成配置
2. THE Frontend_App SHALL 展示版本列表，按生成时间倒序排列
3. WHEN 用户选择某个历史版本时, THE Frontend_App SHALL 在审校台中加载该版本的完整报告内容
4. THE Frontend_App SHALL 支持两个版本之间的差异对比，高亮显示变更内容
5. THE Frontend_App SHALL 支持基于历史版本创建新版本（复制后修改）
6. THE Frontend_App SHALL 将版本数据存储到Existing_Backend的PostgreSQL数据库中

### Requirement 15: 图表渲染

**User Story:** As a 项目运营人员, I want 报告中的数据以专业的图表形式展示, so that 数据可视化效果清晰直观。

#### Acceptance Criteria

1. THE Frontend_App SHALL 使用ECharts或Recharts渲染数据图表
2. THE Frontend_App SHALL 支持以下图表类型：柱状图（KPI对比）、折线图（趋势数据）、饼图（占比分布）、雷达图（多维度对比）、漏斗图（转化分析）
3. THE Frontend_App SHALL 在图表中使用评级对应的颜色编码（S=深绿、A=浅绿、B=蓝色、C=橙色、D=红色）
4. WHEN 用户在审校台调整图表配置时, THE Frontend_App SHALL 实时重新渲染图表
5. THE Frontend_App SHALL 确保图表在导出的Word/PDF文件中正确呈现

### Requirement 16: 前端技术架构

**User Story:** As a 开发人员, I want 前端应用采用现代化技术栈和最佳实践, so that 系统具备良好的可维护性和性能。

#### Acceptance Criteria

1. THE Frontend_App SHALL 使用Next.js框架（App Router）构建，采用TypeScript作为开发语言
2. THE Frontend_App SHALL 使用Tailwind CSS和shadcn/ui组件库构建用户界面
3. THE Frontend_App SHALL 使用React Query管理服务端状态（数据获取、缓存、同步）
4. THE Frontend_App SHALL 通过Next.js API路由（Route Handlers）连接Existing_Backend的Prisma数据库和计算引擎
5. THE Frontend_App SHALL 实现页面级别的加载状态和错误边界处理
6. THE Frontend_App SHALL 对所有API请求实现乐观更新和错误回滚机制

### Requirement 17: YAML Prompt管理

**User Story:** As a 开发人员, I want 所有AI Prompt模板以YAML格式管理并支持版本控制, so that Prompt的迭代和维护有据可查。

#### Acceptance Criteria

1. THE Narrative_Engine SHALL 将所有Prompt模板存储为YAML文件，按项目类型和模块分类组织
2. THE Narrative_Engine SHALL 在YAML文件中包含：模板名称、版本号、适用项目类型、语气强度、Prompt正文、变量占位符列表
3. WHEN 加载Prompt模板时, THE Narrative_Engine SHALL 根据项目类型、模块ID和语气强度匹配对应的YAML模板
4. THE Narrative_Engine SHALL 支持Prompt模板的热更新，无需重启应用即可生效
5. THE Narrative_Engine SHALL 在YAML文件中记录每次修改的变更日志

### Requirement 18: 数据评级引擎对成本类指标的处理

**User Story:** As a 项目运营人员, I want 成本类指标的评级逻辑正确反转, so that CPE/CPM/CPC等越低越好的指标能获得正确的评级。

#### Acceptance Criteria

1. THE Rating_Engine SHALL 识别成本类指标（CPE、CPM、CPC）并应用反向评级逻辑
2. WHEN 对成本类指标进行vs KPI评级时, THE Rating_Engine SHALL 使用 KPI目标值/实际值 作为评级比率（目标越低越好，实际低于目标为优）
3. WHEN 对成本类指标进行vs行业基准评级时, THE Rating_Engine SHALL 使用 行业基准值/实际值 作为评级比率
4. WHEN 对成本类指标进行vs投前数据评级时, THE Rating_Engine SHALL 使用 投前值/投后值 作为评级比率（投后更低为优）

### Requirement 19: 审校台数据列管理

**User Story:** As a 项目运营人员, I want 在审校台中选择性隐藏表现不佳的数据列, so that 交付给客户的报告只展示有利的数据维度。

#### Acceptance Criteria

1. THE Review_Platform SHALL 在数据表格中标注每列数据的评级（S/A/B/C/D）
2. THE Review_Platform SHALL 提供"隐藏C/D级指标"的一键操作
3. WHEN 用户隐藏某数据列时, THE Review_Platform SHALL 从预览和导出中移除该列，同时更新相关图表
4. THE Review_Platform SHALL 允许用户逐列选择显示或隐藏
5. THE Review_Platform SHALL 在隐藏操作后重新计算相关的汇总数据和图表

