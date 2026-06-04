# 需求文档：项目管理和笔记底表管理

## 简介

本功能涵盖项目列表排序优化、笔记底表（业务底表）上传解析与入库至 note_base 表、前端显示优化、项目导出操作、以及项目唯一性约束与历史数据清理等改进。目标是确保笔记底表解析完整可靠、导出流程闭环、项目数据唯一性。

## 术语表

- **系统（System）**: 本项目管理Web应用的后端服务
- **项目列表页（Project_List_Page）**: 首页展示所有项目的列表视图
- **项目表单（Project_Form）**: 新建/编辑项目的表单页面
- **笔记底表（Note_Base）**: 业务方提供的 Excel 文件，包含笔记链接、博主、内容方向、费用等运营标注信息
- **Note_Base_Parser**: 笔记底表 Excel 文件解析模块
- **Note_Base_Table**: note_base 数据库表，存储笔记底表解析后的结构化数据
- **Note_Display_Table**: 前端显示笔记底表数据的表格组件
- **Export_Service**: 项目数据导出服务
- **fetchRawNotes**: 其他同事开发的蒲公英原始笔记数据获取接口，本需求中假设该接口已存在
- **唯一索引（Unique_Index）**: 品类 + 品牌 + 业务线 + 项目名称的组合唯一约束
- **笔记ID（Note_ID）**: 从小红书笔记链接中提取的唯一标识符，位于 URL path 的 `explore/` 之后、`?` 之前

## 需求

### 需求 1：项目列表排序优化

**用户故事：** 作为项目运营人员，我希望项目列表按项目结束日期倒序排列并显示结束日期列，以便快速查看最近结束的项目。

#### 验收标准

1. THE 项目列表页 SHALL 将"立项时间"列替换为"项目结束日期"列，显示项目的 endDate 字段值
2. THE 项目列表页 SHALL 以项目结束日期（endDate）倒序作为默认排序规则
3. WHEN endDate 为空时，THE 项目列表页 SHALL 在"项目结束日期"列显示占位符"-"

### 需求 2：笔记底表上传即时解析

**用户故事：** 作为项目运营人员，我希望上传笔记底表后立即看到解析结果，无论项目是否已创建。

#### 验收标准

1. WHEN 用户在已创建的项目中上传笔记底表时，THE Note_Base_Parser SHALL 立即解析文件并将数据写入 Note_Base_Table
2. WHEN 用户在新建项目表单中上传笔记底表（项目尚未创建）时，THE 系统 SHALL 暂存解析结果，待项目保存成功后将数据写入 Note_Base_Table
3. WHEN 用户在新建项目表单中上传笔记底表时，THE 系统 SHALL 立即解析文件并在前端展示解析后的所有字段数据

### 需求 3：笔记底表显示所有字段

**用户故事：** 作为项目运营人员，我希望在前端查看笔记底表的所有字段数据，以便完整了解每条笔记的信息。

#### 验收标准

1. THE Note_Display_Table SHALL 展示笔记底表中解析出的所有字段（包括但不限于：笔记ID、博主昵称、粉丝量、合作形式、内容方向、达人类型、对应SPU、各类费用、各类数据指标）
2. THE Note_Display_Table SHALL 支持横向滚动条，允许用户左右滑动查看所有列
3. THE Note_Display_Table SHALL 将序号列和笔记ID列固定在最左侧，确保横向滚动时始终可见
4. THE Note_Display_Table SHALL 将笔记链接作为笔记ID单元格的超链接展示（用户点击笔记ID可跳转到对应笔记链接），不单独显示笔记链接列
5. THE 系统 SHALL 在数据库中存储笔记链接字段（noteLink），即使前端不单独显示该列
6. WHEN 编辑已有项目时，IF 数据库中已有该项目的笔记底表数据，THEN THE 系统 SHALL 从数据库加载并展示现有数据
7. WHEN 用户在编辑项目时重新上传笔记底表，THE 系统 SHALL 使用新上传的数据覆盖原有显示内容

### 需求 4：笔记底表解析规则——忽略无链接行

**用户故事：** 作为项目运营人员，我希望系统忽略没有笔记链接的行，以确保导入的数据都是有效的笔记记录。

#### 验收标准

1. WHEN 笔记底表中某行的笔记链接字段为空时，THE Note_Base_Parser SHALL 跳过该行不予导入
2. THE Note_Base_Parser SHALL 仅导入笔记链接非空的有效行

### 需求 5：从笔记链接提取笔记ID

**用户故事：** 作为项目运营人员，我希望系统自动从笔记链接中提取笔记ID，不依赖手动填写。

#### 验收标准

1. WHEN 笔记底表中存在笔记链接时，THE Note_Base_Parser SHALL 从链接 URL 中提取笔记ID，规则为：取 URL path 中 `explore/` 之后、`?` 之前的部分
2. WHEN 笔记链接为 `https://www.xiaohongshu.com/explore/6973179a000000002203aac5?xsec_token=xxx` 时，THE Note_Base_Parser SHALL 提取笔记ID为 `6973179a000000002203aac5`
3. IF 笔记链接格式不符合预期（无法提取笔记ID）时，THEN THE Note_Base_Parser SHALL 使用行号生成备用ID并记录警告

### 需求 6：修复笔记链接和内容方向解析为空的问题

**用户故事：** 作为项目运营人员，我希望笔记底表的笔记链接和内容方向等字段正确解析，不再出现为空的情况。

#### 验收标准

1. THE Note_Base_Parser SHALL 正确解析"笔记链接"列（包括列名含有emoji前缀或括号后缀的情况，如"🔴笔记连接（必填）"）
2. THE Note_Base_Parser SHALL 正确解析"内容方向"列的值并存入对应字段
3. THE Note_Base_Parser SHALL 正确解析笔记底表中所有新增映射字段（达人类型、合作形式、对应SPU等），确保不出现解析为空的情况
4. WHEN 解析完成后，THE 系统 SHALL 确保 noteLink 和 contentDirection 字段在数据库中有值（前提是 Excel 原始数据中对应单元格非空）

### 需求 7：note_base 表数据持久化

**用户故事：** 作为系统管理员，我希望笔记底表上传后数据正确写入 note_base 表，解决当前 note_base 表总是为空的问题。

#### 验收标准

1. WHEN 笔记底表上传成功后，THE 系统 SHALL 将解析后的数据写入 note_base 表（仅写入 note_base 表，不写入 notes 表）
2. THE 系统 SHALL 确保每次上传笔记底表时，解析的 noteLink、contentDirection、cooperationForm、kolType、spuName、contentCost、contentSettlement、adSpend、totalCost 等字段正确映射并写入 note_base 表
3. WHEN note_base 表写入完成后，THE 系统 SHALL 返回写入记录数作为确认

### 需求 8：note_base 表按项目覆盖

**用户故事：** 作为项目运营人员，我希望同一项目重新导入笔记底表时覆盖旧数据，避免数据重复。

#### 验收标准

1. WHEN 同一个项目重新导入新的笔记底表时，THE 系统 SHALL 标记删除该项目在 note_base 表中的所有旧数据
2. WHEN 旧数据被标记删除后，THE 系统 SHALL 插入新导入的笔记底表数据
3. THE 系统 SHALL 使用事务操作确保旧数据删除和新数据插入的原子性

### 需求 9：项目导出操作

**用户故事：** 作为项目运营人员，我希望在项目列表的操作列中直接导出项目的蒲公英原始数据为 Excel 文件。

#### 验收标准

1. THE 项目列表页 SHALL 在每行操作列的"编辑"按钮右侧增加"导出"按钮
2. WHEN 用户点击"导出"按钮时，THE Export_Service SHALL 调用 fetchRawNotes 接口获取该项目的原始笔记数据
3. WHEN 数据获取成功时，THE Export_Service SHALL 将数据生成 Excel 文件并触发浏览器下载
4. THE Export_Service SHALL 使用"项目名_{当前时间}.xlsx"格式命名导出文件（当前时间格式为 YYYYMMDD_HHmmss）
5. IF 导出过程中发生错误，THEN THE 系统 SHALL 向用户展示明确的错误提示信息

### 需求 10：导出功能 Mock 数据自测

**用户故事：** 作为开发人员，我希望通过 mock 数据完成导出功能的开发和自测，因为 fetchRawNotes 接口由其他同事开发。

#### 验收标准

1. THE 系统 SHALL 假设 fetchRawNotes 接口已存在，使用 mock 数据完成导出 Excel 功能的开发
2. THE Export_Service SHALL 提供 mock 数据模块，模拟 fetchRawNotes 接口返回的原始笔记数据结构
3. WHEN 处于开发自测阶段时，THE Export_Service SHALL 使用 mock 数据替代真实接口调用，验证导出 Excel 文件的完整流程
4. THE mock 数据 SHALL 包含多条笔记记录，覆盖各类字段的典型值，确保导出文件格式正确

### 需求 11：项目唯一性约束

**用户故事：** 作为项目管理员，我希望系统阻止创建重复项目，以保证项目数据的唯一性和一致性。

#### 验收标准

1. THE 系统 SHALL 对项目的（品类、品牌、业务线、项目名称）组合施加唯一约束
2. WHEN 用户尝试创建与已有项目相同（品类、品牌、业务线、项目名称）组合的新项目时，THE 系统 SHALL 返回明确的重复错误提示并阻止创建
3. WHEN 用户尝试编辑项目使其（品类、品牌、业务线、项目名称）组合与其他已有项目冲突时，THE 系统 SHALL 返回明确的重复错误提示并阻止保存

### 需求 12：旧重复数据清理 SQL 文档

**用户故事：** 作为项目管理员，我希望有现成的 SQL 文档来识别和清理历史遗留的重复项目数据，以确保添加唯一约束前数据库一致性。

#### 验收标准

1. THE 系统 SHALL 提供 SQL 文档（而非迁移脚本），包含识别（品类、品牌、业务线、项目名称）组合重复的项目记录的查询语句
2. THE SQL 文档 SHALL 包含保留创建日期最新的记录、删除创建日期较旧记录的操作语句
3. THE SQL 文档 SHALL 包含删除重复项目关联的所有复盘数据（ReviewConfig 及其关联的 ReportTraceItem）的操作语句
4. THE SQL 文档 SHALL 包含删除重复项目关联的所有笔记数据（Note、NoteBase）的操作语句
5. THE SQL 文档 SHALL 提供清晰的执行顺序说明和注释，供管理员手动审核后执行
