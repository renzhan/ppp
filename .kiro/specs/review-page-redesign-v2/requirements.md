# Requirements Document

## Introduction

本文档定义复盘系统页面改版V2的功能改进需求。改版涵盖四个核心改进方向：项目日期字段精简与筛选条件调整、业务底表多sheet上传识别、复盘新建/编辑页面全面优化、以及复盘列表页字段顺序调整。目标是简化操作流程、提升数据录入准确性、并使页面信息展示更加合理。

## Glossary

- **Project_Form**: 新建/编辑项目表单页面，用于创建和修改项目基本信息
- **Project_List_Page**: 项目列表页，展示所有项目并支持筛选和操作
- **Note_Base_Upload**: 业务底表上传功能，支持Excel文件上传并解析达人数据
- **Review_Form**: 复盘新建/编辑表单页面，配置复盘参数（项目信息、背景数据、KPI、报告模块等）
- **Review_List_Page**: 复盘系统列表页，展示所有复盘记录
- **Market_Data_Section**: 大盘数据区域，复盘表单中录入行业基准指标的板块
- **KPI_Target_Section**: 复盘目标(KPI)区域，配置复盘KPI目标值的板块
- **Module_Config_Section**: 报告模块配置区域，控制复盘报告包含哪些模块的板块
- **Execution_Start_Date**: 开始执行日期，项目实际开始执行的日期
- **Project_End_Date**: 项目结束日期，项目计划结束的日期
- **Range_Input**: 区间输入组件，支持输入最小值和最大值的双输入框组件
- **Published_Influencer_Sheet**: 名为"已发布达人"的Excel sheet，系统识别业务底表数据的目标sheet

## Requirements

### Requirement 1: 项目日期字段精简

**User Story:** As a 项目运营人员, I want 项目表单中只保留"开始执行日期"和"项目结束日期"两个日期字段, so that 日期信息更加精简明确，避免"立项开始日期"带来的混淆。

#### Acceptance Criteria

1. THE Project_Form SHALL 在新建项目页面提供"开始执行日期"和"项目结束日期"两个日期选择器，移除原有的"立项开始日期"字段
2. THE Project_Form SHALL 在编辑项目页面提供"开始执行日期"和"项目结束日期"两个日期选择器，移除原有的"立项开始日期"字段
3. WHEN 项目详情展示时, THE Project_Form SHALL 展示"开始执行日期"和"项目结束日期"，不展示"立项开始日期"
4. THE Project_List_Page SHALL 将筛选条件中的"立项开始日期"改为"开始执行日期"
5. THE Project_List_Page SHALL 将筛选条件中的"立项结束日期"改为"项目结束日期"
6. WHEN 用户使用日期范围筛选时, THE Project_List_Page SHALL 基于"开始执行日期"和"项目结束日期"字段进行过滤

### Requirement 2: 业务底表多sheet上传识别

**User Story:** As a 项目运营人员, I want 上传包含多个sheet的业务底表时系统能自动识别正确的数据sheet, so that 不需要手动整理Excel文件格式即可完成数据导入。

#### Acceptance Criteria

1. THE Note_Base_Upload SHALL 支持上传包含多个sheet的.xlsx格式文件
2. WHEN 上传的Excel文件包含多个sheet时, THE Note_Base_Upload SHALL 仅识别并解析名为"已发布达人"的Published_Influencer_Sheet
3. WHEN 上传的Excel文件仅包含单个sheet时, THE Note_Base_Upload SHALL 直接解析该sheet的数据，不考虑sheet名称
4. IF 上传的多sheet文件中不存在名为"已发布达人"的sheet, THEN THE Note_Base_Upload SHALL 显示错误提示"未找到名为【已发布达人】的工作表，请检查文件格式"
5. WHEN 成功识别到目标sheet时, THE Note_Base_Upload SHALL 按照现有字段映射规则解析该sheet中的达人数据

### Requirement 3: 复盘表单-项目信息只读展示

**User Story:** As a 项目运营人员, I want 复盘表单中的项目信息从关联项目自动带入且不可编辑, so that 复盘数据与项目信息保持一致，避免手动选择导致的数据不一致。

#### Acceptance Criteria

1. THE Review_Form SHALL 移除品类、品牌、业务线的下拉选择组件
2. THE Review_Form SHALL 移除"选择项目"搜索框组件
3. THE Review_Form SHALL 以只读文本方式展示关联项目的项目名称、品类、品牌、业务线信息
4. WHEN 从项目列表页点击"复盘"按钮进入复盘表单时, THE Review_Form SHALL 自动从该项目获取并展示项目名称、品类、品牌、业务线
5. WHEN 编辑已有复盘记录时, THE Review_Form SHALL 以只读方式展示该复盘关联项目的项目名称、品类、品牌、业务线

### Requirement 4: 复盘表单-字段删除与合并

**User Story:** As a 项目运营人员, I want 复盘表单中去除冗余字段并合理归类, so that 表单结构更加清晰简洁。

#### Acceptance Criteria

1. THE Review_Form SHALL 将"是否有（非官方）合作"选项从原位置移入"复盘目标"板块
2. THE Review_Form SHALL 在前端移除"执行周期"配置区域（后端保留数据，可直接从项目信息拷贝）
3. THE Review_Form SHALL 删除"历史项目拉新成本基准值"输入字段
4. THE Review_Form SHALL 在复盘目标(KPI)区域保留"是否有（非官方）合作"选项，作为该板块的配置项之一

### Requirement 5: 复盘表单-大盘数据改为区间输入

**User Story:** As a 项目运营人员, I want 大盘数据指标使用区间输入而非固定值, so that 能够更准确地反映行业基准的波动范围。

#### Acceptance Criteria

1. THE Market_Data_Section SHALL 将标题从"复盘背景（大盘数据）"改为"大盘数据"
2. THE Market_Data_Section SHALL 将所有指标（CTR、CPM、CPC、CPE、互动率）的输入方式从单一固定值改为Range_Input区间输入
3. THE Range_Input SHALL 包含最小值和最大值两个输入框，支持最多两位小数的数值输入
4. IF 用户输入的数值超过两位小数, THEN THE Market_Data_Section SHALL 自动截断或提示"最多支持两位小数"
5. THE Market_Data_Section SHALL 对每个指标展示"最小值"和"最大值"标签以区分两个输入框

### Requirement 6: 复盘表单-KPI目标指标精简与重命名

**User Story:** As a 项目运营人员, I want KPI目标区域去除不需要的指标并修正命名, so that KPI配置更加聚焦核心业务指标。

#### Acceptance Criteria

1. THE KPI_Target_Section SHALL 移除"搜索指数"指标输入项
2. THE KPI_Target_Section SHALL 移除"SOC/SOV"指标输入项
3. THE KPI_Target_Section SHALL 移除"人群资产-总-SPU"指标输入项
4. THE KPI_Target_Section SHALL 移除"人群资产-TI-SPU"指标输入项
5. THE KPI_Target_Section SHALL 将"千爆文数"指标重命名为"爆文数"
6. THE KPI_Target_Section SHALL 将"万爆文数"指标重命名为"爆文率"

### Requirement 7: 复盘表单-报告模块配置优化

**User Story:** As a 项目运营人员, I want 报告模块配置去除不需要的模块并支持全选操作, so that 模块配置更加高效便捷。

#### Acceptance Criteria

1. THE Module_Config_Section SHALL 移除"人群资产分析"模块选项
2. THE Module_Config_Section SHALL 移除"竞对分析"模块选项
3. THE Module_Config_Section SHALL 提供"全选"按钮，点击后选中所有可用模块
4. THE Module_Config_Section SHALL 提供"取消全选"按钮，点击后取消所有模块的选中状态
5. THE Module_Config_Section SHALL 默认状态为全选（所有可用模块均为选中状态）
6. WHEN 用户点击"全选"按钮时, THE Module_Config_Section SHALL 将所有模块设置为选中状态
7. WHEN 用户点击"取消全选"按钮时, THE Module_Config_Section SHALL 将所有模块设置为未选中状态

### Requirement 8: 复盘列表页字段顺序调整

**User Story:** As a 项目运营人员, I want 复盘列表页的字段顺序调整为更合理的排列, so that 能够更快速地获取关键信息。

#### Acceptance Criteria

1. THE Review_List_Page SHALL 按以下顺序展示列表字段：项目名称、更新时间、创建者、操作
2. THE Review_List_Page SHALL 将"更新时间"字段展示精确到时分秒（格式如：2025-01-15 14:30:25）
3. THE Review_List_Page SHALL 将"更新时间"列排在"创建者"列之前（原顺序为创建者在前、更新时间在后）
