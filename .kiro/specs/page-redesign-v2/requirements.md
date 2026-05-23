# Requirements Document

## Introduction

本文档定义"派盘盘"数字营销AI交付与资产沉淀平台的页面改版V2需求。改版涵盖登录页完善、项目管理首页、系统设置、新建项目、复盘系统、舆情系统、审校台等核心模块的全面升级。系统基于现有后端（Node.js + TypeScript + Prisma + PostgreSQL）构建前端交互界面，支持从项目底表导入、项目创建、复盘生成到舆情分析的完整业务流程。

## Glossary

- **Login_Page**: 登录页面，用户认证入口，展示品牌标识和登录表单
- **Navigation_Sidebar**: 左侧导航栏，全局统一的功能模块导航组件
- **Project_List_Page**: 项目列表页，展示所有项目并支持筛选和操作
- **System_Settings_Page**: 系统设置页面，管理员专属，用于导入项目底表和管理系统配置
- **Project_Form**: 新建项目表单，支持级联选择和笔记底表上传
- **Review_System**: 复盘系统，管理复盘创建、配置和报告生成的完整流程
- **Review_Form**: 新建复盘表单，配置复盘参数（背景数据、KPI、报告模块等）
- **Review_Detail_Page**: 复盘查看页面，展示已完成复盘的完整信息
- **Proofreading_Platform**: 审校台，三栏布局的报告编辑和审阅平台
- **Sentiment_System**: 舆情系统，提供评论分析、关键词统计和负向评论管理
- **Project_Base_Table**: 项目底表，.xlsx格式的项目基础数据文件，包含品类、品牌、业务线等字段
- **Note_Base_Table**: 笔记底表，包含博主信息、笔记数据、投流数据等40+字段的Excel文件
- **Cascade_Selector**: 级联选择器，品类→品牌→业务线的三级联动选择组件
- **Tree_Structure**: 树结构数据，由项目底表去重后生成的品类-品牌-业务线层级数据
- **Admin_User**: 管理员用户，拥有系统设置、账户管理和全部数据查看权限的角色
- **Regular_User**: 普通用户（含组长、AD、AM、投手、执行5种角色），只能查看自己创建或参与的项目
- **User_Role**: 用户角色类型，包含 admin、组长、AD、AM、投手、执行 共6种
- **Influencer_Tier**: 达人层级，按粉丝量划分的达人分类（默认：头部/腰部/尾部）
- **Launch_Phase**: 投流周期，按时间划分的投放阶段（默认：预热期/爆发期/持续期）
- **Report_Module**: 报告模块，复盘报告中可开关的独立内容单元（共9项）

## Requirements

### Requirement 1: 登录页展示与品牌标识

**User Story:** As a 平台用户, I want 在登录页看到清晰的品牌标识和专业的视觉设计, so that 能够快速识别平台身份并获得良好的第一印象。

#### Acceptance Criteria

1. THE Login_Page SHALL 展示主标题"派盘盘"和副标题"数字营销AI 交付与资产沉淀平台"
2. THE Login_Page SHALL 在页面底部展示以下链接和信息：帮助、隐私、条款、版权声明"copyright © 2026 派芽技术部出品"
3. THE Login_Page SHALL 采用居中卡片式布局，配合科技感背景设计
4. THE Login_Page SHALL 提供账户密码登录表单，包含用户名输入框和密码输入框
5. THE Login_Page SHALL 提供"自动登录"复选框选项
6. THE Login_Page SHALL 提供"修改密码"链接入口

### Requirement 2: 用户认证与登录

**User Story:** As a 平台用户, I want 通过账户密码安全登录系统, so that 能够访问授权的功能模块。

#### Acceptance Criteria

1. WHEN 用户输入正确的用户名和密码并点击登录时, THE Login_Page SHALL 验证凭据并跳转到项目管理首页
2. IF 用户输入的用户名或密码不正确, THEN THE Login_Page SHALL 显示"用户名或密码错误"的提示信息
3. WHEN 用户勾选"自动登录"后成功登录时, THE Login_Page SHALL 在本地存储登录状态，下次访问时自动跳转到首页
4. IF 用户未填写用户名或密码就点击登录, THEN THE Login_Page SHALL 在对应字段下方显示"此字段为必填项"的错误提示
5. WHEN 用户点击"修改密码"链接时, THE Login_Page SHALL 导航到密码修改页面

### Requirement 3: 全局左侧导航栏

**User Story:** As a 平台用户, I want 通过统一的左侧导航栏快速切换功能模块, so that 能够高效地在不同功能之间导航。

#### Acceptance Criteria

1. THE Navigation_Sidebar SHALL 展示以下导航项：项目管理、复盘系统、策划系统、舆情系统
2. THE Navigation_Sidebar SHALL 对Admin_User额外展示：账户管理、系统设置
3. IF 当前用户角色为Regular_User（组长/AD/AM/投手/执行）, THEN THE Navigation_Sidebar SHALL 隐藏"账户管理"和"系统设置"导航项
4. WHEN 用户点击导航项时, THE Navigation_Sidebar SHALL 高亮当前选中项并导航到对应页面
5. THE Navigation_Sidebar SHALL 采用深蓝色背景的固定侧边栏设计，在所有页面保持一致

### Requirement 3.5: 用户角色体系与数据权限

**User Story:** As a 平台管理员, I want 系统支持多种业务角色并限制数据可见范围, so that 每个用户只能看到与自己相关的项目数据。

#### Acceptance Criteria

1. THE System SHALL 支持以下6种用户角色：admin、组长、AD、AM、投手、执行
2. WHEN Admin_User查看项目列表时, THE System SHALL 展示所有项目（无数据权限限制）
3. WHEN Regular_User（组长/AD/AM/投手/执行）查看项目列表时, THE System SHALL 仅展示该用户创建的项目或该用户作为参与者的项目
4. THE System SHALL 对复盘系统、舆情系统等模块同样应用数据权限过滤规则
5. WHEN Admin_User通过Excel批量导入用户时, THE System SHALL 为每个用户分配角色（组长/AD/AM/投手/执行之一）
6. THE System SHALL 在账户管理页面支持Admin_User上传用户Excel批量创建账户，Excel包含用户名、显示名、角色字段

### Requirement 4: 项目列表页展示与筛选

**User Story:** As a 项目运营人员, I want 在项目列表页查看所有项目并通过多维度筛选快速定位目标项目, so that 能够高效管理和访问项目。

#### Acceptance Criteria

1. THE Project_List_Page SHALL 展示项目列表，包含以下字段：品类、品牌、业务线、项目名称、创建者、笔记数量、立项时间、参与者、操作
2. THE Project_List_Page SHALL 在操作列提供以下按钮：编辑、复盘、策划、舆情监控
3. THE Project_List_Page SHALL 提供品类、品牌、产品线、项目名称的筛选器
4. THE Project_List_Page SHALL 提供立项日期范围筛选器，支持选择开始日期和结束日期
5. WHEN 用户设置筛选条件时, THE Project_List_Page SHALL 实时过滤列表数据并展示匹配结果
6. THE Project_List_Page SHALL 提供"新建项目"按钮入口
7. WHEN Regular_User访问项目列表时, THE Project_List_Page SHALL 仅展示该用户创建或参与的项目
8. WHEN Admin_User访问项目列表时, THE Project_List_Page SHALL 展示所有项目

### Requirement 5: 系统设置-项目底表导入

**User Story:** As a Admin_User, I want 通过导入.xlsx格式的项目底表来初始化系统基础数据, so that 项目级联选择器和项目列表拥有完整的数据源。

#### Acceptance Criteria

1. THE System_Settings_Page SHALL 提供项目底表上传区域，仅接受.xlsx格式文件
2. WHEN Admin_User上传项目底表时, THE System_Settings_Page SHALL 解析出品类、品牌、品牌业务线、项目名称、立项时间、创建者字段并写入项目表
3. WHEN Admin_User上传项目底表时, THE System_Settings_Page SHALL 解析出品类、品牌、品牌业务线、项目名称，去重后生成Tree_Structure作为Cascade_Selector的数据源
4. THE System_Settings_Page SHALL 支持增量合并导入，新数据与已有数据合并而非覆盖
5. THE System_Settings_Page SHALL 只解析项目底表中的有效数据部分，导入后的数据标记为不可修改
6. IF 导入的底表中包含新的品类、品牌或品牌业务线, THEN THE System_Settings_Page SHALL 自动更新Tree_Structure并允许基于新数据创建对应项目
7. IF 上传的文件格式不是.xlsx, THEN THE System_Settings_Page SHALL 显示"仅支持.xlsx格式文件"的错误提示

### Requirement 6: 系统设置-密码管理

**User Story:** As a 平台用户, I want 在系统设置中修改自己的登录密码, so that 能够维护账户安全。

#### Acceptance Criteria

1. THE System_Settings_Page SHALL 提供个人密码修改功能，包含当前密码、新密码、确认新密码三个输入框
2. WHEN 用户提交密码修改时, THE System_Settings_Page SHALL 验证当前密码是否正确
3. IF 当前密码验证失败, THEN THE System_Settings_Page SHALL 显示"当前密码不正确"的错误提示
4. IF 新密码与确认密码不一致, THEN THE System_Settings_Page SHALL 显示"两次输入的密码不一致"的错误提示
5. WHEN 密码修改成功时, THE System_Settings_Page SHALL 显示成功提示并要求用户重新登录

### Requirement 7: 新建项目-基本信息

**User Story:** As a 项目运营人员, I want 通过级联选择器和表单创建新项目, so that 能够快速录入项目基础信息并关联到正确的品类品牌体系。

#### Acceptance Criteria

1. THE Project_Form SHALL 提供品类、品牌、产品线的Cascade_Selector，数据来源为System_Settings_Page导入的项目底表生成的Tree_Structure
2. THE Project_Form SHALL 提供项目名称输入框，支持从已导入项目中候选选择，也支持自定义输入
3. THE Project_Form SHALL 自动将当前登录用户设置为创建者，不可修改
4. THE Project_Form SHALL 提供参与者选择器，可从公司所有用户中选择一个或多个参与者
5. THE Project_Form SHALL 提供立项时间选择器，默认值为当前时间，支持手动修改
6. WHEN 用户填写完必填信息并提交时, THE Project_Form SHALL 创建项目记录并跳转到项目列表页

### Requirement 8: 新建项目-笔记底表管理

**User Story:** As a 项目运营人员, I want 为项目上传和管理笔记底表数据, so that 复盘系统能够基于笔记数据进行分析和报告生成。

#### Acceptance Criteria

1. THE Project_Form SHALL 提供笔记底表上传区域，创建项目时可不填，后续通过编辑上传
2. WHEN 用户上传笔记底表时, THE Project_Form SHALL 接受.xlsx格式文件并解析以下字段：序号、博主昵称、博主粉丝量、笔记链接、笔记id、合作形式、是否报备、内容方向、达人类型、对应SPU、内容实际消耗金额、内容实际结算金额、投流实际消耗、总费用、曝光量、阅读量、互动量、点赞量、收藏量、评论量、分享量、关注量、总CPM、总CPE、总CPC、自然曝光量、自然阅读量、自然互动、自然CTR、自然流CPM、自然流CPE、自然流CPC、展现量、点击量、互动量、投流CTR、投流CPM、投流CPE、投流CPC、投流新增TI、投流CPTI、回搜数、回搜率
3. WHEN 用户上传新的笔记底表时, THE Project_Form SHALL 完全覆盖该项目之前的笔记数据（先删除旧数据再写入新数据）
4. WHEN 笔记底表上传成功时, THE Project_Form SHALL 显示上传成功提示和解析的笔记数量
5. IF 笔记底表解析失败, THEN THE Project_Form SHALL 显示上传失败提示和具体错误原因

### Requirement 9: 复盘列表页

**User Story:** As a 项目运营人员, I want 在复盘列表页查看所有已完成的复盘记录并发起新复盘, so that 能够管理复盘工作流程。

#### Acceptance Criteria

1. THE Review_System SHALL 展示复盘列表页，顶部提供"开始新的复盘"按钮
2. THE Review_System SHALL 展示已完成复盘的列表，包含以下字段：项目名称、复盘者、更新时间、操作
3. THE Review_System SHALL 在操作列提供"编辑"和"审校台"按钮
4. WHEN 用户点击"开始新的复盘"按钮时, THE Review_System SHALL 导航到新建复盘表单页面
5. WHEN 用户点击"编辑"按钮时, THE Review_System SHALL 导航到该复盘的编辑页面
6. WHEN 用户点击"审校台"按钮时, THE Review_System SHALL 导航到该复盘的审校台页面

### Requirement 10: 新建复盘-项目信息与背景数据

**User Story:** As a 项目运营人员, I want 在新建复盘时从已创建的项目中选择关联项目并录入大盘背景数据, so that 复盘报告能够基于正确的项目上下文和行业基准进行分析。

#### Acceptance Criteria

1. THE Review_Form SHALL 提供项目选择器，数据来源为当前用户有权限访问的已创建项目列表（而非直接选择品类/品牌/业务线），支持按项目名称搜索筛选
2. THE Review_Form SHALL 提供复盘背景（大盘数据）录入区域，包含以下指标：CTR、CPM、CPC、CPE、互动率
3. THE Review_Form SHALL 提供达人层级配置区域，默认包含3项（头部/腰部/尾部），每项包含名称和粉丝范围
4. THE Review_Form SHALL 支持达人层级的增加和删除操作
5. WHEN 用户选择项目时, THE Review_Form SHALL 自动回填展示该项目的品类、品牌、业务线信息（只读，不可修改）

### Requirement 11: 新建复盘-KPI目标配置

**User Story:** As a 项目运营人员, I want 配置复盘的KPI目标和统计口径, so that 系统能够基于目标值进行达成率分析和评级。

#### Acceptance Criteria

1. THE Review_Form SHALL 提供复盘目标(KPI)配置区域，包含以下指标：总曝光、总阅读、总互动、千爆文数、万爆文数
2. THE Review_Form SHALL 提供互动统计口径选择：不含关注、含关注
3. THE Review_Form SHALL 提供爆文统计口径选择：转评赞、赞
4. THE Review_Form SHALL 提供以下效率指标KPI输入：CPM、CPC、CPE、CTR、搜索指数、SOC/SOV
5. THE Review_Form SHALL 提供人群资产KPI输入：人群资产-总-品牌、人群资产-总-SPU、人群资产-TI-品牌、人群资产-TI-SPU

### Requirement 12: 新建复盘-报告模块与投流周期配置

**User Story:** As a 项目运营人员, I want 配置复盘报告包含的模块和投流周期, so that 生成的报告结构符合项目实际情况。

#### Acceptance Criteria

1. THE Review_Form SHALL 提供9个报告模块的开关控制：项目回顾、数据总揽、项目亮点、综合分析、内容分析（笔记侧）、人群资产分析、投流分析、竞对分析、优化建议
2. THE Review_Form SHALL 允许用户独立开启或关闭每个Report_Module
3. WHEN 用户开启"投流分析"模块时, THE Review_Form SHALL 显示投流周期配置区域
4. THE Review_Form SHALL 提供投流周期配置，默认包含3项（预热期/爆发期/持续期），每项包含名称和时间范围
5. THE Review_Form SHALL 支持投流周期的增加和删除操作

### Requirement 13: 新建复盘-策划方案上传与提交

**User Story:** As a 项目运营人员, I want 上传策划方案文件并提交复盘, so that 系统能够参考策划方案生成复盘报告。

#### Acceptance Criteria

1. THE Review_Form SHALL 提供策划方案上传区域，支持.pdf、.docx、.doc、.pptx、.ppt格式文件
2. WHEN 策划方案上传成功时, THE Review_Form SHALL 显示上传成功提示和文件名称
3. IF 策划方案上传失败, THEN THE Review_Form SHALL 显示上传失败提示和错误原因
4. WHEN 用户点击"开始复盘"按钮时, THE Review_Form SHALL 检查关联项目是否已上传笔记底表
5. IF 关联项目未上传笔记底表, THEN THE Review_Form SHALL 提示用户需要先上传笔记底表，并提供跳转到笔记上传页面的链接
6. WHEN 用户从笔记上传页面返回时, THE Review_Form SHALL 保留之前已填写的所有复盘配置内容
7. WHEN 所有必要条件满足且用户确认提交时, THE Review_Form SHALL 创建复盘记录并开始复盘报告生成流程

### Requirement 14: 复盘查看页面

**User Story:** As a 项目运营人员, I want 查看已完成复盘的完整信息和报告内容, so that 能够回顾复盘配置和生成结果。

#### Acceptance Criteria

1. THE Review_Detail_Page SHALL 展示项目信息：品类、品牌、业务线、项目名称
2. THE Review_Detail_Page SHALL 展示复盘背景（大盘数据）：CTR、CPM、CPC、CPE、互动率
3. THE Review_Detail_Page SHALL 展示复盘目标(KPI)配置信息
4. THE Review_Detail_Page SHALL 展示各Report_Module的开关状态
5. THE Review_Detail_Page SHALL 展示投流周期配置信息
6. THE Review_Detail_Page SHALL 提供策划方案的下载按钮
7. THE Review_Detail_Page SHALL 展示复盘报告的完整内容

### Requirement 15: 审校台布局与导航

**User Story:** As a 项目运营人员, I want 在审校台中通过三栏布局高效审阅和编辑复盘报告, so that 能够快速定位、预览和修改报告各章节。

#### Acceptance Criteria

1. THE Proofreading_Platform SHALL 采用三栏布局：左侧章节目录导航、中间富文本编辑区、右侧AI助手面板
2. THE Proofreading_Platform SHALL 在左侧展示报告章节目录树，支持点击导航到对应章节
3. THE Proofreading_Platform SHALL 在中间区域提供富文本编辑功能，支持文字编辑和格式调整
4. THE Proofreading_Platform SHALL 在右侧提供AI助手面板，支持对报告内容进行AI辅助问答
5. THE Proofreading_Platform SHALL 提供保存按钮，将编辑内容持久化到数据库
6. THE Proofreading_Platform SHALL 提供下载功能，支持导出为PDF和Word格式

### Requirement 16: 审校台-源数据对照

**User Story:** As a 项目运营人员, I want 在审校台中查看报告内容对应的源数据, so that 能够验证报告数据的准确性。

#### Acceptance Criteria

1. THE Proofreading_Platform SHALL 提供"查看源数据对照"功能入口
2. WHEN 用户点击"查看源数据对照"时, THE Proofreading_Platform SHALL 展示当前章节对应的原始数据表格
3. THE Proofreading_Platform SHALL 支持源数据与报告内容的并排对照查看

### Requirement 17: 舆情系统-数据筛选与查看

**User Story:** As a 项目运营人员, I want 通过筛选条件查看特定项目的舆情分析数据, so that 能够了解项目在社交媒体上的口碑表现。

#### Acceptance Criteria

1. THE Sentiment_System SHALL 提供品类、品牌、业务线、项目名称的筛选器
2. THE Sentiment_System SHALL 提供"查看舆情"按钮，点击后加载对应项目的舆情数据
3. WHEN 用户点击"查看舆情"按钮时, THE Sentiment_System SHALL 展示该项目的评论分析图表和统计数据

### Requirement 18: 舆情系统-评论分析与可视化

**User Story:** As a 项目运营人员, I want 通过图表直观了解项目评论的情感分布和趋势变化, so that 能够快速把握舆情态势。

#### Acceptance Criteria

1. THE Sentiment_System SHALL 展示情感倾向分布饼图，区分正向、中性、负向评论占比
2. THE Sentiment_System SHALL 展示评论数变化趋势折线图，按时间维度展示评论量变化
3. THE Sentiment_System SHALL 展示关键词高频分布统计，包含词云图和关键词频次表格
4. THE Sentiment_System SHALL 展示负向评论列表，包含评论内容和来源信息

### Requirement 19: 舆情系统-数据导出

**User Story:** As a 项目运营人员, I want 导出舆情分析数据并查看历史导出记录, so that 能够将舆情数据用于线下汇报和存档。

#### Acceptance Criteria

1. THE Sentiment_System SHALL 提供"导出"按钮，支持将当前舆情分析结果导出为文件
2. THE Sentiment_System SHALL 提供"查看导出记录"功能，展示历史导出记录列表
3. WHEN 用户点击"导出"按钮时, THE Sentiment_System SHALL 生成包含图表和数据的导出文件并提供下载
4. WHEN 导出完成时, THE Sentiment_System SHALL 在导出记录列表中新增一条记录，包含导出时间和文件信息
