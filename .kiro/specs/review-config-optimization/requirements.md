# Requirements Document

## Introduction

本需求涵盖复盘配置（ReviewConfig）创建/编辑页面的优化改造，包括：UI 字段标签修正、金额口径展示逻辑调整、爆文统计口径配置化、报告模块裁剪、新增广告主 ID 输入及聚光数据自动拉取、以及达人层次分析逻辑改为基于曝光率与配置层级的分类方式。

## Glossary

- **Review_Config_Page**: 复盘新建/编辑页面，用户在此配置复盘参数
- **Viral_Detector**: 爆文判定模块，根据配置阈值判定笔记是否为爆文
- **KOL_Tier_Classifier**: 达人层级分类模块，根据配置层级和曝光率对达人进行分层
- **Ingestion_Service**: 数据采集服务，负责调用外部 API 拉取聚光投流数据
- **ReviewConfig**: 复盘配置数据模型，存储复盘所需的所有参数
- **Advertiser_ID**: 广告主 ID，聚光平台用于标识投放账户的长数字串
- **Exposure_Rate**: 曝光率，笔记曝光量与达人粉丝数的比值
- **Viral_Threshold**: 爆文阈值，用于判定笔记是否为爆文的点赞数量门槛
- **Proofread_Page**: 审校台页面，展示报告生成进度与最终内容
- **Chapter_Nav**: 左侧章节导航面板，显示所有章节及其生成状态

## Requirements

### Requirement 1: KPI 字段标签修正

**User Story:** As a 运营人员, I want KPI 目标中的"爆文率"字段显示为"爆文率(%)", so that 我能明确该字段的单位为百分比。

#### Acceptance Criteria

1. THE Review_Config_Page SHALL display the viral rate KPI field label as "爆文率(%)"

### Requirement 2: 金额口径展示调整

**User Story:** As a 运营人员, I want 金额口径区域同时展示"内容金额口径"和"投流金额口径"两个独立选项, so that 我可以分别为内容和投流设置消耗/结算口径。

#### Acceptance Criteria

1. THE Review_Config_Page SHALL display "内容金额口径" and "投流金额口径" as two simultaneously visible independent sections under the "金额口径" area
2. THE Review_Config_Page SHALL provide "消耗" and "结算" radio options within each of the two cost caliber sections independently
3. THE Review_Config_Page SHALL remove the "总费用（实时计算）" display section entirely
4. THE Review_Config_Page SHALL rename the section title from "金额口径与总费用" to "金额口径"

### Requirement 3: 报告模块裁剪

**User Story:** As a 运营人员, I want 报告模块列表中去掉"人群资产分析"章节, so that 生成的报告不再包含不需要的章节。

#### Acceptance Criteria

1. THE Review_Config_Page SHALL remove "audienceAnalysis"（人群资产分析）from the selectable report module list
2. THE Review_Config_Page SHALL remove "projectManagement"（项目管理）from the selectable report module list if it exists
3. THE Review_Config_Page SHALL remove "endPage"（尾页）from the selectable report module list if it exists

### Requirement 4: 爆文统计口径配置化

**User Story:** As a 运营人员, I want 配置一个点赞数量阈值来统一判定爆文, so that 无论选择"转评赞"还是"赞"口径，系统都按照我设定的点赞数进行爆文判定。

#### Acceptance Criteria

1. THE Review_Config_Page SHALL display a numeric input field for the viral threshold (点赞数量) in the viral metric configuration section
2. WHEN the user enters a viral threshold value, THE Review_Config_Page SHALL save this value as part of the ReviewConfig
3. THE Viral_Detector SHALL use the configured viral threshold value from ReviewConfig to determine if a note is viral
4. THE Viral_Detector SHALL classify a note as viral WHEN the note's engagement sum (likeNum + favNum + cmtNum) is greater than or equal to the configured viral threshold
5. IF no viral threshold is configured, THEN THE Viral_Detector SHALL use a default threshold of 1000
6. THE ReviewConfig SHALL store the viral threshold value as a numeric field named "viralThreshold"

### Requirement 5: 新增广告主 ID 输入

**User Story:** As a 运营人员, I want 在报告模块选择包含"投流分析"时输入广告主 ID, so that 系统能拉取对应的聚光投流数据用于报告生成。

#### Acceptance Criteria

1. WHEN the user enables the "launchAnalysis"（投流分析）module, THE Review_Config_Page SHALL display an "广告主ID" input section below the "投流周期" configuration
2. THE Review_Config_Page SHALL allow the user to input up to 5 advertiser IDs (长数字串)
3. IF the user enters more than 5 advertiser IDs, THEN THE Review_Config_Page SHALL display a validation error message indicating the maximum is 5
4. THE ReviewConfig SHALL store advertiser IDs as a JSON array field named "advertiserIds"
5. WHEN the "launchAnalysis" module is disabled, THE Review_Config_Page SHALL hide the advertiser ID input section

### Requirement 6: 聚光数据自动拉取触发

**User Story:** As a 运营人员, I want 保存复盘时自动触发聚光数据拉取, so that 投流分析数据能自动关联到复盘配置。

#### Acceptance Criteria

1. WHEN a new ReviewConfig is created with advertiser IDs, THE Ingestion_Service SHALL trigger juguang data ingestion using the provided advertiser IDs and the new ReviewConfig ID
2. WHEN an existing ReviewConfig is updated and the advertiser IDs have changed, THE Ingestion_Service SHALL trigger juguang data ingestion using the updated advertiser IDs and the ReviewConfig ID
3. WHEN an existing ReviewConfig is updated and the advertiser IDs have not changed, THE Ingestion_Service SHALL skip juguang data ingestion
4. THE Ingestion_Service SHALL pass the ReviewConfig ID to the ingestJuguangData method so that fetched data is associated with the correct ReviewConfig

### Requirement 7: 达人层次分析基于曝光率分类

**User Story:** As a 运营人员, I want 达人层次分析根据曝光率和我配置的层级范围来分类达人, so that 分类结果更符合实际业务场景而非仅依据粉丝数。

#### Acceptance Criteria

1. THE KOL_Tier_Classifier SHALL read the influencer tier configuration from ReviewConfig.influencerTiers
2. THE KOL_Tier_Classifier SHALL calculate the exposure rate for each note as: note impression count divided by the KOL's fan count
3. THE KOL_Tier_Classifier SHALL classify each KOL into a tier based on which configured tier range the calculated exposure rate falls into
4. IF a KOL's exposure rate does not fall into any configured tier range, THEN THE KOL_Tier_Classifier SHALL classify the KOL as "未分类"
5. THE KOL_Tier_Classifier SHALL support the tier configuration format containing: tier name, exposure rate lower bound, and exposure rate upper bound


### Requirement 8: 章节生成进度实时展示

**User Story:** As a 运营人员, I want 在审校台生成报告时左侧导航面板实时显示所有章节及其生成状态, so that 我能清晰了解每个章节的生成进度而非只看到已完成的章节。

#### Acceptance Criteria

1. WHEN report generation starts, THE Chapter_Nav SHALL display all chapter entries (based on the predefined chapter definitions) immediately, regardless of whether they have finished generating
2. WHILE a chapter is being generated, THE Chapter_Nav SHALL display a spinning loader icon next to the chapter title to indicate the in-progress state
3. WHILE a chapter is being generated, THE Chapter_Nav SHALL display the token count consumed so far for that chapter next to the spinner
4. WHEN the user clicks on a chapter that is still generating, THE Proofread_Page SHALL display a waiting/loading state in the main content area indicating the chapter is being generated
5. WHEN a chapter finishes generating, THE Chapter_Nav SHALL replace the spinning loader with a checkmark (√) icon to indicate completion
6. WHEN report generation starts, THE SSE stream SHALL emit a progress event (type: 'progress') containing the chapter ID and the cumulative token count consumed for that chapter during generation
7. THE SSE progress event SHALL follow the format: { type: 'progress', chapterId: string, tokensUsed: number }
8. WHILE a chapter is generating, THE SSE stream SHALL emit progress events at a reasonable interval to provide token consumption updates without overwhelming the client
