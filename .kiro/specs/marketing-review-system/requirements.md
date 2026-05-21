# Requirements Document

## Introduction

本系统为小红书（Xiaohongshu/RED）营销项目复盘报告自动生成系统。系统支持完整的项目管理生命周期（创建→上传数据→生成报告→审校→终版导出），从多个数据源（派查查API、底表上传、策划报告AI解析）汇集数据，通过标准化计算引擎进行指标派生与分析，由AI Agent自动组装复盘报告，并提供审校台供用户进行富文本编辑、图表渲染和AI辅助问答修改。系统覆盖项目管理、数据采集、计算引擎、报告生成、审校编辑等完整复盘链路。

## Glossary

- **System**: 小红书营销项目复盘数据系统整体
- **Project_Manager**: 项目管理模块，负责项目创建、列表展示、状态流转
- **Data_Ingestion_Module**: 数据采集模块，负责从各数据源获取原始数据（底表上传、策划报告解析、派查查同步）
- **Calculation_Engine**: 计算引擎，负责基于原始数据派生计算指标
- **Report_Generator**: 报告生成模块，负责由AI Agent自动组装复盘报告
- **Review_Desk**: 审校台，三栏布局的报告审校编辑界面（左侧大纲+中间编辑区+右侧AI助手）
- **AI_Agent**: AI复盘代理，根据项目类型执行特定复盘逻辑，自动组装报告
- **Note**: 小红书笔记，包含图文笔记和视频笔记两种类型
- **Viral_Note**: 爆文，互动量（点赞+收藏+评论）≥1000的笔记
- **Engagement**: 互动量，默认口径为点赞+收藏+评论+分享+关注，可配置
- **Engagement_Fixed**: 固定互动量，仅用于爆文判定，口径为点赞+收藏+评论（不可配置）
- **CPE**: Cost Per Engagement，每互动成本 = 项目总费用 / 互动量总和
- **CPM**: Cost Per Mille，千次曝光成本 = 项目总费用 / 曝光量总和 × 1000
- **CPC**: Cost Per Click，每阅读成本 = 项目总费用 / 阅读量总和
- **CTR**: Click Through Rate，点击率 = 阅读量 / 曝光量
- **KOL**: Key Opinion Leader，关键意见领袖（达人）
- **KOC**: Key Opinion Consumer，关键意见消费者（粉丝量<10000的达人）
- **Pugongying**: 蒲公英平台，小红书品牌合作平台
- **Juguang**: 聚光平台，小红书广告投放平台
- **Paichacha**: 派查查，第三方数据服务商，提供蒲公英和聚光平台数据（含灵犀、千瓜数据）
- **Lingxi**: 灵犀平台，小红书品牌数据分析平台（数据通过派查查同步获取）
- **Qiangua**: 千瓜平台，小红书第三方数据分析平台（数据通过派查查同步获取）
- **AIPS**: 小红书人群资产模型（Awareness-Interest-Purchase-Share）
- **SOC**: Share of Content，内容份额占比
- **SOV**: Share of Voice，声量份额占比
- **Underwater_Cooperation**: 水下合作，非通过蒲公英平台的达人合作
- **Above_Water_Cooperation**: 水上合作，通过蒲公英平台的达人合作
- **Benchmark**: 大盘基准值，行业平均水平数据
- **KOL_Tier**: 达人层级，基于粉丝量划分（KOC/尾部/腰尾部/腰部/头部）
- **Natural_Exposure**: 自然曝光，蒲公英总曝光减去聚光展现量
- **Project_Total_Cost**: 项目总费用，包含博主报价、服务费、折扣、水下报价和聚光消耗的总和
- **Cooperation_Policy**: 合作政策，包含统一折扣系数和特殊达人返点规则
- **Project_Status**: 项目状态，包含：待复盘、生成中、待审校、终版
- **Project_Type**: 项目类型，包含：新品上市、日常种草、节点营销、竞品防御
- **Propagation_Phase**: 传播周期阶段，包含：预热期、爆发期、持续期（各有独立起止日期）
- **Report_Version**: 报告版本，每次生成产生一个新版本，包含版本号、生成时间、数据评级等
- **SPU**: Standard Product Unit，标准产品单元

## Requirements

### Requirement 1: 项目创建

**User Story:** As a 项目运营人员, I want 创建营销复盘项目并录入基础信息, so that 系统能够关联所有数据到正确的项目上下文中。

#### Acceptance Criteria

1. THE Project_Manager SHALL 提供新建项目界面，支持录入以下信息：品牌名称、项目主题（项目名称）、项目类型、传播周期、涉及SPU
2. WHEN 用户创建新项目时, THE Project_Manager SHALL 要求填写品牌名称、项目主题、项目类型和传播周期作为必填字段
3. THE Project_Manager SHALL 支持选择项目类型，可选值为：新品上市、日常种草、节点营销、竞品防御
4. THE Project_Manager SHALL 支持配置传播周期，分为预热期、爆发期、持续期三个阶段，每个阶段各有独立的开始日期和结束日期
5. THE Project_Manager SHALL 支持选择或录入涉及的SPU（产品）信息
6. WHEN 项目创建成功时, THE Project_Manager SHALL 将项目状态初始化为"待复盘"
7. THE Project_Manager SHALL 在项目创建阶段不要求上传策划方案（策划方案在复盘阶段上传）

### Requirement 2: 项目列表与查询

**User Story:** As a 项目运营人员, I want 查看和筛选所有营销复盘项目, so that 能够快速找到目标项目并了解项目状态。

#### Acceptance Criteria

1. THE Project_Manager SHALL 以卡片式列表展示所有项目，每个卡片显示：品牌、项目类型、项目状态、项目时间、最新报告版本
2. THE Project_Manager SHALL 支持按以下条件筛选项目：品类、品牌、项目名称、项目时间范围、项目类型
3. THE Project_Manager SHALL 对所有用户开放项目列表查看权限，无需额外权限控制
4. THE Project_Manager SHALL 展示项目的当前状态标签，状态包括：待复盘、生成中、待审校、终版

### Requirement 3: 项目状态流转与详情

**User Story:** As a 项目运营人员, I want 查看项目详情并根据状态执行对应操作, so that 能够推进项目复盘流程。

#### Acceptance Criteria

1. THE Project_Manager SHALL 在项目详情页展示项目进度条：创建项目 → 上传数据 → 生成报告 → 审校报告 → 终版导出
2. WHEN 项目状态为"待复盘"时, THE Project_Manager SHALL 显示"上传数据"按钮和"开始生成"按钮
3. WHEN 项目状态为"生成中"时, THE Project_Manager SHALL 显示生成进度，生成完成后自动转为"待审校"状态
4. WHEN 项目状态为"待审校"时, THE Project_Manager SHALL 显示"确认终版"按钮，点击后将项目状态变更为"终版"
5. THE Project_Manager SHALL 在项目详情页展示复盘报告管理表格，包含：版本号、生成时间、数据评级、模块图表、生成进度、操作按钮
6. THE Project_Manager SHALL 支持为项目配置统一合作政策（折扣系数），同时允许为特定达人设置特殊返点规则
7. WHEN 用户标记某笔记为水下合作时, THE Project_Manager SHALL 将该笔记的费用计入水下报价而非蒲公英报价

### Requirement 4: 数据上传 - 策划报告

**User Story:** As a 项目运营人员, I want 上传策划报告文档, so that 系统能够通过AI解析提取项目背景和策略信息。

#### Acceptance Criteria

1. THE Data_Ingestion_Module SHALL 在数据上传流程中将策划报告作为第一步上传
2. THE Data_Ingestion_Module SHALL 支持上传PDF、WORD、PPT格式的策划报告文件
3. WHEN 策划报告上传成功时, THE Data_Ingestion_Module SHALL 使用AI解读策划报告，提取特定内容并入库（项目背景、传播目的、策略回顾等）
4. IF 策划报告格式无法解析, THEN THE Data_Ingestion_Module SHALL 返回错误提示并允许用户重新上传

### Requirement 5: 数据上传 - 执行底表与投流底表

**User Story:** As a 项目运营人员, I want 上传执行底表和投流底表, so that 系统能够获取笔记投放数据和投流效果数据。

#### Acceptance Criteria

1. THE Data_Ingestion_Module SHALL 在策划报告上传之后，支持上传执行底表（第二步）和投流底表（第三步）
2. THE Data_Ingestion_Module SHALL 支持xlsx、xls、csv格式的底表文件上传
3. WHEN 执行底表上传时, THE Data_Ingestion_Module SHALL 根据字段名直接解析底表内容入库，未预设的字段暂不处理
4. WHEN 投流底表上传时, THE Data_Ingestion_Module SHALL 根据字段名直接解析投流数据入库，未预设的字段暂不处理
5. THE Data_Ingestion_Module SHALL 将所有金额字段从"分"单位转换为"元"单位（除以100）后存储
6. IF 底表格式错误或字段缺失, THEN THE Data_Ingestion_Module SHALL 返回详细错误位置（行列信息），允许部分导入并列出缺失字段
7. THE Data_Ingestion_Module SHALL 在数据上传完成后提供"确认入库"步骤，用户确认后正式写入数据库

### Requirement 6: 数据上传 - 外部数据（派查查同步）

**User Story:** As a 项目运营人员, I want 系统根据项目基础信息同步派查查外部数据, so that 获取灵犀和千瓜平台的行业数据。

#### Acceptance Criteria

1. THE Data_Ingestion_Module SHALL 根据项目基础信息（品牌、品类、时间范围）从派查查获取灵犀和千瓜平台数据
2. WHEN 派查查数据同步触发时, THE Data_Ingestion_Module SHALL 获取品牌排名、SOC/SOV、SPU排名、AIPS人群数据等
3. IF 派查查数据同步API不可用, THEN THE Data_Ingestion_Module SHALL 使用mock数据作为占位，并标记数据来源为"模拟数据"
4. THE Data_Ingestion_Module SHALL 将派查查同步作为数据上传流程的第四步（外部数据）

### Requirement 7: 开始复盘 - 派查查蒲公英与聚光数据

**User Story:** As a 项目运营人员, I want 录入小红书笔记ID并获取派查查蒲公英和聚光数据, so that 系统能够获取笔记的投放效果数据。

#### Acceptance Criteria

1. WHEN 用户点击"开始生成"时, THE System SHALL 提供界面录入小红书笔记ID列表
2. THE Data_Ingestion_Module SHALL 根据笔记ID从派查查获取蒲公英平台数据，包括：brand_user_name、spu_name、kol_nick_name、kol_id、kol_fan_num、note_id、note_type、note_link、imp_num、read_num、engage_num、like_num、fav_num、cmt_num、share_num、kol_price（单位：分）、total_platform_price（单位：分）、heat_imp_num、heat_read_num及各类组件数据
3. THE Data_Ingestion_Module SHALL 根据笔记ID从派查查获取聚光平台数据，包括：fee（消耗）、impression（展现量）、click（点击量）、interaction（互动量）、i_user_num（新增种草人群）、ti_user_num（新增深度种草人群）、i_user_price、ti_user_price、search_cmt_click（搜索组件点击量）、search_cmt_after_read、search_cmt_after_read_avg、search_cmt_click_cvr
4. IF 派查查蒲公英/聚光API不可用, THEN THE Data_Ingestion_Module SHALL 使用mock数据作为占位，并标记数据来源为"模拟数据"
5. IF 数据采集过程中API调用失败, THEN THE Data_Ingestion_Module SHALL 记录错误日志并通知用户具体失败的数据源和字段

### Requirement 8: 复盘任务执行（AI Agent）

**User Story:** As a 项目运营人员, I want 系统根据项目类型自动执行AI复盘任务, so that 能够自动生成结构化的复盘报告。

#### Acceptance Criteria

1. WHEN 数据采集完成后, THE AI_Agent SHALL 根据项目类型（新品上市/日常种草/节点营销/竞品防御）选择对应的复盘逻辑执行
2. THE AI_Agent SHALL 在后台异步执行复盘任务，前台实时显示AI反馈内容和生成进度
3. THE AI_Agent SHALL 调用计算引擎获取所有指标计算结果，并结合AI分析组装复盘报告
4. WHEN 复盘任务执行完成时, THE AI_Agent SHALL 生成一个新的报告版本，包含版本号和生成时间
5. IF 复盘任务执行失败, THEN THE AI_Agent SHALL 记录错误信息并通知用户，允许重新触发生成
6. THE AI_Agent SHALL 支持配置生成模式（如完整生成、增量更新等），并在生成完成后展示结果摘要

### Requirement 9: 审校台 - 报告展示与编辑

**User Story:** As a 项目运营人员, I want 在审校台中查看和编辑复盘报告内容, so that 能够对AI生成的报告进行人工审校和修改。

#### Acceptance Criteria

1. THE Review_Desk SHALL 采用三栏布局：左侧为复盘报告大纲导航，中间为AI生成产物的预览及编辑区，右侧为AI助手辅助沟通区
2. THE Review_Desk SHALL 在左侧大纲中展示报告的完整模块结构，支持点击跳转到对应模块
3. THE Review_Desk SHALL 在中间编辑区支持富文本编辑，包括文字格式化、段落调整等
4. THE Review_Desk SHALL 在中间编辑区支持图表渲染，包括柱状图、饼图等数据可视化图表
5. THE Review_Desk SHALL 在中间编辑区支持图片展示
6. THE Review_Desk SHALL 支持对报告内容进行勾选、引用展示操作
7. WHEN 用户编辑报告内容后, THE Review_Desk SHALL 保存编辑后的版本，保留原始AI生成版本作为对照

### Requirement 10: 审校台 - AI问答与局部重新生成

**User Story:** As a 项目运营人员, I want 通过AI助手针对报告内容进行问答和局部修改, so that 能够高效地优化报告质量。

#### Acceptance Criteria

1. THE Review_Desk SHALL 在右侧AI助手区域提供对话式问答界面
2. WHEN 用户在AI助手中提问时, THE Review_Desk SHALL 基于当前复盘报告内容进行针对性回答
3. WHEN 用户通过AI助手指定某个板块需要重新生成时, THE Review_Desk SHALL 仅对该板块内容进行局部重新生成，不影响其他板块
4. THE Review_Desk SHALL 支持用户通过自然语言指令修改报告中的特定内容
5. WHEN AI助手重新生成内容后, THE Review_Desk SHALL 在编辑区实时更新对应板块的内容

### Requirement 11: 项目费用计算

**User Story:** As a 项目运营人员, I want 系统自动计算项目总费用, so that 所有成本指标的计算基于准确的费用数据。

#### Acceptance Criteria

1. THE Calculation_Engine SHALL 按以下公式计算项目总费用：Project_Total_Cost = SUM((博主报价 + 服务费) × 折扣系数) + SUM(水下报价) + SUM(聚光消耗)
2. WHEN 项目存在统一合作政策时, THE Calculation_Engine SHALL 对所有水上合作达人应用统一折扣系数
3. WHEN 特定达人存在特殊返点规则时, THE Calculation_Engine SHALL 优先使用该达人的特殊折扣系数覆盖统一折扣系数
4. THE Calculation_Engine SHALL 将水下合作笔记的报价单独累加，不应用折扣系数
5. THE Calculation_Engine SHALL 将聚光平台fee字段（转换为元后）累加为聚光消耗总额

### Requirement 12: 核心效果指标计算

**User Story:** As a 项目运营人员, I want 系统自动计算CPE、CPM、CPC、CTR等核心效果指标, so that 能够快速评估项目投放效率。

#### Acceptance Criteria

1. THE Calculation_Engine SHALL 按以下公式计算CPE：CPE = Project_Total_Cost / SUM(Engagement)
2. THE Calculation_Engine SHALL 按以下公式计算CPM：CPM = Project_Total_Cost / SUM(imp_num) × 1000
3. THE Calculation_Engine SHALL 按以下公式计算CPC：CPC = Project_Total_Cost / SUM(read_num)
4. THE Calculation_Engine SHALL 按以下公式计算CTR：CTR = SUM(read_num) / SUM(imp_num)
5. THE Calculation_Engine SHALL 支持配置Engagement的计算口径，默认口径为：点赞 + 收藏 + 评论 + 分享 + 关注，可配置去掉分享和/或关注
6. WHEN 计算投流CTR时, THE Calculation_Engine SHALL 使用聚光平台的click/impression作为投流CTR，区别于对客CTR（read_num/imp_num）

### Requirement 13: 爆文判定与统计

**User Story:** As a 项目运营人员, I want 系统自动识别爆文并计算爆文率, so that 能够评估内容质量表现。

#### Acceptance Criteria

1. THE Calculation_Engine SHALL 按以下规则判定爆文：Viral_Note = IF(like_num + fav_num + cmt_num >= 1000, TRUE, FALSE)
2. THE Calculation_Engine SHALL 使用固定口径（点赞+收藏+评论）进行爆文判定，该口径不受Engagement配置影响
3. THE Calculation_Engine SHALL 按以下公式计算爆文率：爆文率 = COUNT(Viral_Note为TRUE的笔记) / COUNT(全部笔记)
4. THE Calculation_Engine SHALL 输出爆文总数和爆文率两个指标

### Requirement 14: KPI完成率计算

**User Story:** As a 项目运营人员, I want 系统自动对比实际效果与KPI目标, so that 能够直观看到各指标的达成情况。

#### Acceptance Criteria

1. THE Calculation_Engine SHALL 按以下公式计算各指标的KPI完成率：KPI完成率 = 实际值 / KPI目标值
2. THE Calculation_Engine SHALL 为以下指标分别计算KPI完成率：曝光量、阅读量、互动量、爆文数、CPM、CPC、CPE、CTR
3. WHEN KPI目标值为零或未设置时, THE Calculation_Engine SHALL 将该指标的完成率标记为"未设定目标"而非产生除零错误
4. THE Calculation_Engine SHALL 对成本类指标（CPM、CPC、CPE）的完成率进行反向计算：KPI完成率 = KPI目标值 / 实际值（目标越低越好）

### Requirement 15: 达人层级分类

**User Story:** As a 项目运营人员, I want 系统自动根据粉丝量对达人进行层级分类, so that 能够按层级分析投放效果。

#### Acceptance Criteria

1. THE Calculation_Engine SHALL 按以下规则划分达人层级：IF(kol_fan_num < 10000, 'KOC', IF(kol_fan_num < 50000, '尾部', IF(kol_fan_num < 100000, '腰尾部', IF(kol_fan_num < 500000, '腰部', '头部'))))
2. THE Calculation_Engine SHALL 为每个达人层级分别计算聚合指标：笔记数、总曝光、总阅读、总互动、平均CPE、爆文数、爆文率

### Requirement 16: 自然流量与投流分析

**User Story:** As a 项目运营人员, I want 系统区分自然流量和付费流量的效果, so that 能够评估投流的增量价值。

#### Acceptance Criteria

1. THE Calculation_Engine SHALL 按以下公式计算自然曝光：Natural_Exposure = SUM(蒲公英.imp_num) - SUM(聚光.impression)
2. THE Calculation_Engine SHALL 分别计算投流效果指标：投流展现量（聚光.impression）、投流点击量（聚光.click）、投流CTR（聚光.click / 聚光.impression）、投流CPC（聚光.fee / 聚光.click）、投流CPM（聚光.fee / 聚光.impression × 1000）、投流CPE（聚光.fee / 聚光.interaction）
3. WHEN 聚光平台数据中click字段来自视频流场景时, THE Calculation_Engine SHALL 将该click值视为阅读量口径进行计算
4. THE Calculation_Engine SHALL 计算种草效率指标：新增种草人群数（i_user_num）、新增深度种草人群数（ti_user_num）、种草单价（i_user_price）、深度种草单价（ti_user_price）
5. THE Calculation_Engine SHALL 计算搜索效果指标：搜索组件点击量（search_cmt_click）、搜索后阅读量（search_cmt_after_read）、搜索后平均阅读量（search_cmt_after_read_avg）、搜索点击转化率（search_cmt_click_cvr）

### Requirement 17: 内容分析

**User Story:** As a 项目运营人员, I want 系统对投放内容进行多维度分析, so that 能够识别高效内容策略。

#### Acceptance Criteria

1. THE Calculation_Engine SHALL 统计内容概览数据：总笔记数、图文笔记数、视频笔记数、水上笔记数、水下笔记数
2. THE Calculation_Engine SHALL 按以下维度分别聚合计算效果指标（曝光、阅读、互动、CPE、爆文率）：笔记类型（图文/视频）、内容方向、账号类型、KOL类型、投放阶段
3. THE Calculation_Engine SHALL 对各维度下的分组进行效果排序，识别表现最优和最差的分组
4. THE Calculation_Engine SHALL 进行内容分层分析，将笔记按效果指标分为高/中/低三层，计算各层的平均指标值

### Requirement 18: 品牌声量分析

**User Story:** As a 项目运营人员, I want 系统展示品牌声量变化和竞品对比, so that 能够评估营销活动对品牌影响力的提升效果。

#### Acceptance Criteria

1. THE System SHALL 展示品牌搜索指数数据（人工录入或派查查同步）
2. THE System SHALL 展示话题声量数据，包括话题曝光量
3. THE System SHALL 展示品牌排名数据（派查查同步获取）
4. THE System SHALL 展示SOC（内容份额）和SOV（声量份额）数据（派查查同步获取）
5. THE System SHALL 展示SPU排名数据（派查查同步获取）

### Requirement 19: 人群资产分析

**User Story:** As a 项目运营人员, I want 系统展示人群资产变化情况, so that 能够评估营销活动对品牌人群资产的积累效果。

#### Acceptance Criteria

1. THE System SHALL 展示AIPS各层级总人数（派查查同步获取）
2. THE System SHALL 展示AIPS人群结构占比分布
3. THE System SHALL 展示人群流转效率数据（各层级间的转化率）
4. THE System SHALL 展示行业渗透率数据
5. THE System SHALL 展示种草人群数据，包括新增种草人群和深度种草人群

### Requirement 20: 小程序与转化分析

**User Story:** As a 项目运营人员, I want 系统分析笔记中各类组件的转化效果, so that 能够优化组件配置策略。

#### Acceptance Criteria

1. THE System SHALL 统计正文组件的点击和转化数据
2. THE System SHALL 统计互动组件的点击和转化数据
3. THE System SHALL 统计评论区组件的点击和转化数据
4. THE Calculation_Engine SHALL 为每类组件分别计算点击率和转化率

### Requirement 21: 竞品与行业对标

**User Story:** As a 项目运营人员, I want 系统将项目数据与竞品和行业基准进行对比, so that 能够客观评估项目在行业中的表现水平。

#### Acceptance Criteria

1. THE System SHALL 支持录入竞品数据用于对比分析
2. THE System SHALL 支持录入行业Benchmark数据
3. THE Calculation_Engine SHALL 将项目实际CPM、CPC、CPE、CTR、爆文率与大盘Benchmark进行对比，计算优于/劣于大盘的百分比差异
4. WHEN 项目指标优于大盘Benchmark时, THE System SHALL 标记该指标为"优于大盘"

### Requirement 22: 亮点自动识别

**User Story:** As a 项目运营人员, I want 系统自动识别项目亮点, so that 复盘报告能够突出项目的优秀表现。

#### Acceptance Criteria

1. THE Calculation_Engine SHALL 按以下规则自动识别项目亮点：KPI完成率 > 100%的指标、实际效果优于大盘Benchmark的指标、投后数据优于投前数据的指标、分层分析中显著优于均值的内容分组
2. WHEN 识别到亮点时, THE Report_Generator SHALL 为每个亮点生成描述性文案
3. THE Report_Generator SHALL 将所有识别到的亮点汇总到亮点总结模块

### Requirement 23: 复盘报告组装

**User Story:** As a 项目运营人员, I want 系统将所有分析结果组装为完整的复盘报告, so that 能够输出标准化的项目复盘文档。

#### Acceptance Criteria

1. THE Report_Generator SHALL 按以下模块顺序组装复盘报告：客户信息 → 项目回顾 → 数据总览 → 项目亮点 → 内容分析 → 品牌声量分析 → 人群资产分析 → 投流分析 → 小程序/转化分析 → 竞品/行业对标 → 亮点总结 → 优化建议
2. THE Report_Generator SHALL 在数据总览模块中展示：KPI目标值、实际效果数据、完成率、与大盘Benchmark的对比
3. WHEN 报告中存在未采集到的数据时, THE Report_Generator SHALL 在对应位置标注"数据待补充"而非显示空白或零值
4. THE System SHALL 支持将生成的复盘报告导出为可交付格式

### Requirement 24: 互动量口径配置

**User Story:** As a 项目运营人员, I want 能够按项目配置互动量的计算口径, so that 满足不同客户对互动量定义的差异化需求。

#### Acceptance Criteria

1. THE System SHALL 提供项目级别的互动量口径配置，默认口径为：点赞 + 收藏 + 评论 + 分享 + 关注
2. THE System SHALL 支持从默认口径中去掉"分享"和/或"关注"
3. WHEN 互动量口径配置变更时, THE Calculation_Engine SHALL 重新计算所有依赖互动量的派生指标（CPE、互动量总和、KPI完成率等）
4. THE Calculation_Engine SHALL 确保爆文判定始终使用固定口径（点赞+收藏+评论），不受互动量口径配置影响

### Requirement 25: 数据校验与异常处理

**User Story:** As a 项目运营人员, I want 系统对采集和计算的数据进行校验, so that 确保复盘报告数据的准确性。

#### Acceptance Criteria

1. WHEN 金额字段从API获取时, THE Data_Ingestion_Module SHALL 验证原始值为整数（分）并正确转换为元（除以100，保留两位小数）
2. IF 计算指标时分母为零, THEN THE Calculation_Engine SHALL 返回"N/A"标记而非产生除零错误
3. IF 底表解析时发现数据格式异常, THEN THE Data_Ingestion_Module SHALL 标记该数据为"待人工确认"并提示具体行列位置
4. WHEN 自然曝光计算结果为负数时, THE Calculation_Engine SHALL 将自然曝光设为零并标记数据异常提醒用户核查
