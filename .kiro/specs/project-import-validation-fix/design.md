# 项目导入校验修复 Bugfix Design

## Overview

本次修复涉及项目导入和保存流程中的三大类 Bug：
1. **底表预览/模版表头不一致**：NoteBasePreview 组件显示的是旧版列名（博主昵称、合作形式、达人金额等），模版下载文件表头也不是最终版规范
2. **保存校验过于严格**：新建/编辑项目保存时要求填写开始日期、灵犀ID、底表等字段，但业务需求是这些只在"发起复盘"时才是必填
3. **蒲公英/灵犀同步触发条件不当**：底表上传后无条件触发蒲公英+灵犀同步，未检查底表是否解析出笔记ID、灵犀是否配置完整

修复策略：调整前端校验逻辑（仅保留5个必填字段），将同步触发条件判断移至后端 API 层，更新预览组件表头和模版文件。

## Glossary

- **Bug_Condition (C)**: 三种条件之一触发 Bug：(1) 预览表头与最终版不一致 (2) 保存时对非必填字段进行了强制校验 (3) 同步触发时未检查前置条件
- **Property (P)**: 期望行为 — 预览表头与最终版一致、保存仅校验5个必填字段、同步触发需满足完整前置条件
- **Preservation**: 文件格式校验、必填列校验、项目名称唯一性校验、复盘时的完整性校验等现有行为不受影响
- **NoteBasePreview**: `web/src/components/form/note-base-preview.tsx` 中的预览表格组件，当前使用旧版列名
- **parseNoteBaseExcel**: `web/src/lib/note-base-parser.ts` 中的解析函数，已支持最终版表头
- **ingestBaseData**: `src/ingestion/index.ts` 中的数据拉取服务，负责蒲公英+灵犀同步
- **noteCount**: Project 表中记录已上传底表笔记数量的字段

## Bug Details

### Bug Condition

Bug 由三种独立条件触发：

**条件 A - 预览表头不一致**：用户上传底表后 NoteBasePreview 展示旧版列名（博主昵称、是否报备、合作形式、达人金额、投流金额、总消耗）

**条件 B - 保存校验过严**：前端 `validate()` 函数强制要求 executionStartDate、endDate、lingxiTaxonomy.accountId、pendingNoteFile

**条件 C - 同步无条件触发**：`/api/upload/note-base/[projectId]` 路由在底表写入后直接调用 `ingestBaseData()`，未判断是否有笔记ID和灵犀配置是否完整

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { action: 'preview' | 'save' | 'uploadNoteBase', context: ProjectContext }
  OUTPUT: boolean

  IF input.action == 'preview' THEN
    RETURN previewHeaders != FINAL_SPEC_HEADERS
  END IF

  IF input.action == 'save' THEN
    RETURN validationRequires(executionStartDate)
           OR validationRequires(endDate)
           OR validationRequires(lingxiAccountId)
           OR validationRequires(noteBase)
  END IF

  IF input.action == 'uploadNoteBase' THEN
    RETURN triggersPugongyingSync(WITHOUT checkingNoteIdsExist)
           OR triggersLingxiSync(WITHOUT checkingAllConditions)
  END IF

  RETURN false
END FUNCTION
```

### Examples

- 用户上传含"发布链接、内容形式、内容方向、笔记类型"的底表 → 预览表头显示"博主昵称、是否报备、合作形式"等旧名 **（Bug A）**
- 用户新建项目只填写品类=美妆、品牌=XX、业务线=护肤、项目名称=Q1种草、创建者=当前用户 → 点击保存 → 报错"请选择开始执行日期" **（Bug B）**
- 用户上传底表但所有行发布链接为空（解析出0条笔记ID）→ 系统仍尝试调用蒲公英API **（Bug C1）**
- 用户填写了灵犀ID但未选择行业或未填开始日期 → 系统仍尝试灵犀同步导致异常 **（Bug C2）**

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 上传非 .xlsx 文件时系统提示"仅支持.xlsx格式文件"
- 底表缺少必填列（发布链接、内容形式、内容方向、笔记类型）时解析失败并显示错误
- 保存时未填写品类、品牌、项目名称仍需校验失败
- 项目名称重复时返回409冲突错误
- 底表中发布链接为空的行仍跳过不解析
- 复盘创建时如果 noteCount=0 仍返回错误
- 用户填写广告主ID时仍触发聚光数据爬取

**Scope:**
所有不涉及预览表头、保存校验规则、同步触发条件的功能应完全不受本次修复影响。

## Hypothesized Root Cause

1. **预览表头硬编码旧版列名**：`NoteBasePreview` 中 `CORE_COLUMNS` 和 `COST_COLUMNS` 使用了旧版中文列名（"博主昵称"、"合作形式"、"达人金额"等），parser 已升级但展示组件未同步更新

2. **前端 validate() 过度校验**：`web/src/app/projects/new/page.tsx` 中 `validate()` 函数把 executionStartDate、endDate、lingxiTaxonomy.accountId、pendingNoteFile 作为必填项校验，但业务需求是"保存"只需5个字段

3. **同步触发缺少条件判断**：`/api/upload/note-base/[projectId]` 路由在写入底表后直接调用 `ingestBaseData(projectId)`，没有检查：
   - 蒲公英同步：是否有解析出的笔记ID（noteIds.length > 0）
   - 灵犀同步：是否本次填写了灵犀ID + 是否选择了行业 + 是否填写了开始/结束日期 + 是否已上传过底表

4. **模版文件未更新**：`web/public/down/projects-template.xlsx` 文件的表头仍为旧版规范

## Correctness Properties

Property 1: Bug Condition - 预览表头与最终版底表规范一致

_For any_ 成功解析的底表数据，NoteBasePreview 组件 SHALL 显示最终版表头名称（笔记Id、内容形式、内容方向、笔记类型、资源含税成本价、资源含税售价），而非旧版名称（博主昵称、是否报备、合作形式、达人金额、投流金额、总消耗）。

**Validates: Requirements 2.1**

Property 2: Bug Condition - 保存仅校验5个必填字段

_For any_ 项目保存请求（新建或编辑），系统 SHALL 仅校验品类、品牌、业务线、项目名称、创建者这5个字段为必填，其余字段（开始执行日期、结束日期、灵犀ID、业务底表）均为非必填。

**Validates: Requirements 2.3, 2.4**

Property 3: Bug Condition - 蒲公英同步条件判断

_For any_ 底表上传请求，系统后端 SHALL 仅在底表解析出有效笔记ID（noteIds.length > 0）时触发蒲公英数据同步，否则跳过。

**Validates: Requirements 2.6, 2.7**

Property 4: Bug Condition - 灵犀同步条件判断

_For any_ 项目保存请求，系统后端 SHALL 仅在同时满足以下条件时触发灵犀同步：本次填写了灵犀ID + 已选择行业（lingxiTaxonomyPath非空）+ 已填写开始执行日期 + 已填写结束日期 + 已上传过底表（noteCount > 0）。缺一不可。

**Validates: Requirements 2.8, 2.9, 2.10**

Property 5: Preservation - 非保存场景校验不变

_For any_ 复盘创建请求（POST /api/reviews），系统 SHALL 继续校验项目必须有笔记数据（noteCount > 0），保持现有行为不变。原有文件格式校验、必填列校验、唯一性约束均不受影响。

**Validates: Requirements 3.1, 3.2, 3.3, 3.5, 3.6, 3.7**

## Fix Implementation

### Changes Required

**File 1**: `web/src/components/form/note-base-preview.tsx`

**Function**: CORE_COLUMNS, COST_COLUMNS 常量定义

**Specific Changes**:
1. **更新 CORE_COLUMNS**：将列定义从旧版（博主昵称、笔记ID、是否报备、合作形式、内容方向）改为最终版（笔记Id、内容形式、内容方向、笔记类型）
2. **更新 COST_COLUMNS**：将列定义从旧版（达人金额、投流金额、总消耗）改为最终版（资源含税成本价、资源含税售价）
3. **调整数据访问逻辑**：确保 getValue 函数正确对应新的字段名

---

**File 2**: `web/src/app/projects/new/page.tsx`

**Function**: `validate()`

**Specific Changes**:
1. **移除非必填字段校验**：删除对 executionStartDate、endDate、lingxiTaxonomy.accountId、pendingNoteFile 的必填校验
2. **增加业务线必填校验**：根据需求2.3，新增 businessLine 必填校验
3. **保留日期范围校验**：如果用户填写了两个日期，仍保留结束日期 > 开始日期的逻辑校验

---

**File 3**: `web/src/app/api/upload/note-base/[projectId]/route.ts`

**Function**: POST handler（同步触发逻辑）

**Specific Changes**:
1. **蒲公英同步条件判断**：在调用 `ingestBaseData` 前检查解析出的 noteIds 数量，如果为0则跳过蒲公英同步
2. **灵犀同步条件判断**：检查项目的 lingxiAccountId 是否在本次请求中被设置、lingxiTaxonomyPath 是否非空、executionStartDate/endDate 是否已填写、noteCount > 0
3. **拆分同步逻辑**：将蒲公英和灵犀同步分开处理，各自独立判断条件

---

**File 4**: `web/public/down/projects-template.xlsx`

**Specific Changes**:
1. **重新生成模版文件**：表头改为最终版规范："发布链接（必须是长链接）、内容形式、内容方向、笔记类型、资源含税成本价、资源含税售价、曝光量、阅读量、点赞量、收藏量、评论量、分享量、关注量、互动量"

---

**File 5**: `web/src/app/api/reviews/route.ts`（新增校验）

**Function**: POST handler

**Specific Changes**:
1. **增加复盘前置校验**：在创建 ReviewConfig 前，查询 Project 的 executionStartDate、endDate、lingxiAccountId 字段，如果缺少则返回错误提示用户先编辑项目补充字段

---

**File 6**: `web/src/app/api/projects/route.ts` & `web/src/app/api/projects/[id]/route.ts`

**Specific Changes**:
1. **后端保存校验调整**：确保 POST/PUT 接口只要求 category、brand、businessLine、projectName、createdBy 为必填
2. **增加同步触发条件判断**：在保存完成后，如果本次请求中包含 lingxiAccountId 且满足全部前置条件，则触发灵犀同步

## Testing Strategy

### Validation Approach

测试策略分两阶段：先在未修复代码上验证 Bug 存在（观察旧行为），再验证修复后的正确性和保留行为。

### Exploratory Bug Condition Checking

**Goal**: 在修复前确认 Bug 存在，理解根本原因。

**Test Plan**: 编写单元测试验证当前预览表头输出、validate 函数行为、同步触发条件。

**Test Cases**:
1. **预览表头测试**：渲染 NoteBasePreview 组件，验证当前显示"博主昵称"而非"笔记Id"（将在未修复代码上失败）
2. **保存校验测试**：模拟仅填写品类+品牌+项目名称，验证 validate() 返回非空错误（将在未修复代码上观察到多余校验）
3. **蒲公英同步测试**：上传空底表（0条笔记），验证 ingestBaseData 仍被调用（将在未修复代码上观察到无条件触发）
4. **灵犀同步测试**：填写灵犀ID但不填日期，验证灵犀同步仍被触发（将在未修复代码上观察到不完整条件触发）

**Expected Counterexamples**:
- NoteBasePreview CORE_COLUMNS[0].label === '博主昵称'（应为'笔记Id'）
- validate() 对缺少 executionStartDate 返回错误
- ingestBaseData 在 noteIds=[] 时仍被调用

### Fix Checking

**Goal**: 验证所有 Bug 条件修复后系统产生正确行为。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedSystem(input)
  ASSERT expectedBehavior(result)
END FOR
```

具体验证：
- 修复后 NoteBasePreview 显示最终版表头
- 修复后 validate() 仅对品类/品牌/业务线/项目名称/创建者返回错误
- 修复后 noteIds.length === 0 时不调用蒲公英同步
- 修复后灵犀同步仅在完整条件下触发

### Preservation Checking

**Goal**: 验证对非 Bug 输入，修复不改变原有行为。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalSystem(input) = fixedSystem(input)
END FOR
```

**Testing Approach**: 属性测试适合保留行为验证，因为它能自动生成大量测试用例覆盖边界情况。

**Test Plan**: 观察未修复代码中正常工作的行为（文件格式校验、必填列缺失检测、唯一性约束），确保修复后这些行为保持不变。

**Test Cases**:
1. **文件格式保留**：验证非 .xlsx 文件仍被拒绝
2. **必填列保留**：验证底表缺少必填列时仍返回解析错误
3. **品类/品牌必填保留**：验证保存时缺少品类或品牌仍返回校验错误
4. **唯一性保留**：验证重复项目名称仍返回409
5. **复盘校验保留**：验证 noteCount=0 时创建复盘仍返回错误

### Unit Tests

- 测试 NoteBasePreview 组件渲染的表头列名
- 测试前端 validate() 函数在不同填写组合下的行为
- 测试后端 API 保存校验逻辑（仅5字段必填）
- 测试蒲公英同步条件判断逻辑（有noteIds vs 无noteIds）
- 测试灵犀同步条件判断逻辑（满足全部条件 vs 缺少任一条件）
- 测试复盘创建时的前置校验（缺少开始日期、结束日期、灵犀ID）

### Property-Based Tests

- 生成随机 ProjectContext（有/无各字段组合），验证同步触发条件判断的正确性
- 生成随机 ParsedNoteBaseRow 数据，验证 NoteBasePreview 表头始终为最终版规范
- 生成随机表单状态组合，验证 validate() 仅对5个必填字段返回错误

### Integration Tests

- 完整项目创建流程：仅填写5个必填字段 → 保存成功 → 不触发任何同步
- 完整项目创建流程：填写所有字段+上传底表 → 保存成功 → 蒲公英和灵犀同步均触发
- 项目编辑后触发灵犀同步：编辑项目填写灵犀ID+行业+日期+已有底表 → 保存 → 灵犀同步触发
- 复盘创建前置校验：项目缺少开始日期 → 创建复盘 → 返回错误提示补充字段
