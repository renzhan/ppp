# 第7章：投流分析

> 数据加载器: `src/pipeline/loaders/chapter-07-traffic-analysis.ts`
> 提示词模板: `src/prompts/chapters/chapter-07-traffic-analysis.md`
> 生成方式: LLM生成（temperature=0.3）

---

## 7.1 聚光数据全量加载

### SQL查询

```sql
SELECT note_id, placement, targets_detail, keyword,
       fee, impression, click, interaction,
       i_user_num, ti_user_num, i_user_price, ti_user_price,
       search_cmt_click, search_cmt_after_read,
       search_cmt_after_read_avg, search_cmt_click_cvr
FROM juguang_data
WHERE project_id = :projectId;
```

---

## 7.2 投流总览

### 计算公式

```
totalFee         = SUM(fee)
totalImpression  = SUM(impression)
totalClick       = SUM(click)
totalInteraction = SUM(interaction)
totalIUserNum    = SUM(i_user_num)
totalTiUserNum   = SUM(ti_user_num)
totalSearchCmtClick     = SUM(search_cmt_click)
totalSearchCmtAfterRead = SUM(search_cmt_after_read)

-- 效率指标
paidCPM = totalFee / totalImpression * 1000
paidCPC = totalFee / totalClick
paidCPE = totalFee / totalInteraction
paidCTR = totalClick / totalImpression * 100

-- 种草成本
CPI  = totalFee / totalIUserNum
CPTI = totalFee / totalTiUserNum
```

---

## 7.3 大盘对比

### 原始数据

```sql
SELECT benchmark FROM review_configs
WHERE project_id = :projectId ORDER BY created_at DESC LIMIT 1;
```

### 计算公式

```
成本类(CPM/CPC/CPE):
  优于幅度 = (1 - actual/benchmark) * 100%
  IF actual < benchmark → "优于大盘"

效率类(CTR):
  优于幅度 = (actual/benchmark - 1) * 100%
  IF actual > benchmark → "优于大盘"
```

---

## 7.4 回搜数据

### 计算公式

```
搜索组件总点击 = SUM(search_cmt_click)
搜后总阅读量   = SUM(search_cmt_after_read)
回搜率         = totalSearchCmtClick / totalClick * 100%
```

---

## 7.5 新增种草人群

### 原始数据

直接来自 7.1 聚合：`SUM(i_user_num)`, `SUM(ti_user_num)`

---

## 7.6 按笔记维度投流分析（TOP10）

### 额外SQL查询

```sql
-- 笔记底表信息
SELECT note_id, content_direction, kol_type
FROM note_base WHERE project_id = :projectId::uuid;

-- 笔记基本信息
SELECT note_id, kol_nick_name, note_type
FROM notes WHERE project_id = :projectId;
```

### 计算公式

```
-- 按note_id聚合聚光数据
byNote[noteId] = {
  fee: SUM(fee WHERE note_id=X),
  impression: SUM(impression WHERE note_id=X),
  click: SUM(click WHERE note_id=X),
  interaction: SUM(interaction WHERE note_id=X),
  tiUserNum: SUM(ti_user_num WHERE note_id=X)
}

-- 按消耗降序取TOP10
TOP10 = byNote ORDER BY fee DESC LIMIT 10

-- 每篇笔记的投流指标
noteCPM  = fee / impression * 1000
noteCPC  = fee / click
noteCPE  = fee / interaction
noteCTR  = click / impression * 100%
noteCPTI = fee / tiUserNum
```

---

## 7.7 按广告类型（投放位置）分析

### 分组字段

`juguang_data.placement` — 编码映射：
- `1` → 信息流
- `2` → 搜索
- `4` → 全站智投
- `7` → 视频流

### 聚合公式（每组相同）

```sql
-- 等效SQL
SELECT placement,
  SUM(fee) AS fee,
  SUM(impression) AS impression,
  SUM(click) AS click,
  SUM(interaction) AS interaction,
  SUM(i_user_num) AS i_user_num,
  SUM(ti_user_num) AS ti_user_num
FROM juguang_data
WHERE project_id = :projectId AND placement IS NOT NULL
GROUP BY placement
ORDER BY SUM(fee) DESC;
```

### 每组计算指标

```
CPM = fee / impression * 1000
CPC = fee / click
CPE = fee / interaction
CTR = click / impression * 100%
新增种草人群成本 = fee / i_user_num
新增深度种草人群成本 = fee / ti_user_num
```

---

## 7.8 按人群定向分析

### 分组字段

`juguang_data.targets_detail`

### 等效SQL

```sql
SELECT targets_detail,
  SUM(fee), SUM(impression), SUM(click), SUM(interaction),
  SUM(i_user_num), SUM(ti_user_num)
FROM juguang_data
WHERE project_id = :projectId AND targets_detail IS NOT NULL
GROUP BY targets_detail
ORDER BY SUM(fee) DESC;
```

---

## 7.9 按关键词（搜索主题名称）分析

### 分组字段

`juguang_data.keyword`

### 等效SQL

```sql
SELECT keyword,
  SUM(fee), SUM(impression), SUM(click), SUM(interaction),
  SUM(i_user_num), SUM(ti_user_num)
FROM juguang_data
WHERE project_id = :projectId AND keyword IS NOT NULL
GROUP BY keyword
ORDER BY SUM(fee) DESC;
```

---

## AI文本生成

### 输入变量

| 变量 | 来源 |
|------|------|
| `{{traffic_overview}}` | 7.2 投流总览文本 |
| `{{benchmark_comparison}}` | 7.3 大盘对比文本 |
| `{{audience_growth}}` | 7.5 种草人群文本 |
| `{{search_data}}` | 7.4 回搜数据文本 |
| `{{ad_type_analysis}}` | 7.7 广告类型表格 |
| `{{targeting_analysis}}` | 7.8 人群定向表格 |
| `{{keyword_analysis}}` | 7.9 关键词表格 |
| `{{traffic_by_note}}` | 7.6 TOP10笔记表格 |

### LLM输出结构

1. 投流总览（核心数据卡片 + 大盘对比）
2. 新增种草人群分析
3. 投放位置（广告类型）分析
4. 人群定向分析
5. 关键词定向分析
6. 回搜分析
7. 笔记维度投流分析
8. 综合数据解读
