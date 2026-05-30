# 第5章：综合分析（四象限）

> 数据加载器: `src/pipeline/loaders/chapter-05-quadrant-analysis.ts`
> 提示词模板: `src/prompts/chapters/chapter-05-quadrant-analysis.md`
> 生成方式: LLM生成（temperature=0.3）

---

## 5.1 大盘均值（象限分界线）

### SQL查询

```sql
SELECT benchmark, engagement_metric
FROM review_configs
WHERE project_id = :projectId
ORDER BY created_at DESC
LIMIT 1;
-- benchmark JSON: {cpm, cpc, cpe, ctr}
```

---

## 5.2 蒲公英笔记数据

### SQL查询

```sql
SELECT note_id, kol_nick_name, note_type,
       imp_num, read_num, engage_num,
       like_num, fav_num, cmt_num, share_num
FROM notes
WHERE project_id = :projectId;
```

---

## 5.3 笔记底表（内容费用、内容方向）

### SQL查询

```sql
SELECT note_id, content_cost::float, content_direction
FROM note_base
WHERE project_id = :projectId::uuid;
```

---

## 5.4 聚光数据（按笔记关联）

### SQL查询

```sql
SELECT note_id, fee, impression, click, interaction
FROM juguang_data
WHERE project_id = :projectId
  AND note_id IS NOT NULL;
-- 同一笔记多条记录需累加
```

---

## 5.5 笔记维度指标计算

### 计算公式

对每篇有投流数据的笔记：

```
-- 费用
contentCost = note_base.content_cost (该笔记)
juguangFee  = SUM(juguang_data.fee WHERE note_id = X)
totalCost   = contentCost + juguangFee

-- 互动量（按口径）
IF engagement_metric = 'include_follow':
  engagement = engage_num
ELSE:
  engagement = like_num + fav_num + cmt_num + share_num

-- 笔记维度指标（分子=内容费+投流费）
noteCPM = totalCost / imp_num * 1000
noteCPC = totalCost / read_num
noteCPE = totalCost / engagement
noteCTR = read_num / imp_num * 100

-- 投流维度指标（分子=仅投流费）
trafficCPM = juguangFee / juguang.impression * 1000
trafficCPC = juguangFee / juguang.click
trafficCPE = juguangFee / juguang.interaction
trafficCTR = juguang.click / juguang.impression * 100
```

---

## 5.6 象限分类逻辑

### 计算公式

```
-- 笔记质量判定（任一指标优于大盘即为"高质"）
noteQualityGood = (noteCPM < benchmark.cpm)
               OR (noteCPE < benchmark.cpe)
               OR (noteCTR > benchmark.ctr)

-- 投流质量判定
trafficQualityGood = (trafficCPM < benchmark.cpm)
                  OR (trafficCPE < benchmark.cpe)

-- 四象限
高质高投: noteQualityGood AND trafficQualityGood
高质低投: noteQualityGood AND NOT trafficQualityGood
低质高投: NOT noteQualityGood AND trafficQualityGood
低质低投: NOT noteQualityGood AND NOT trafficQualityGood

-- 无投流数据的笔记不参与分析
excluded = notes WHERE note_id NOT IN juguang_data.note_id
```

---

## AI文本生成

### 输入变量

| 变量 | 来源 |
|------|------|
| `{{total_analyzed_notes}}` | 参与分析的笔记数 |
| `{{excluded_notes}}` | 未参与分析的笔记数 |
| `{{benchmark_cpm/cpc/cpe/ctr}}` | 大盘均值 |
| `{{quadrant_summary}}` | 各象限汇总统计 |
| `{{high_quality_high_traffic}}` | 高质高投代表笔记(前3) |
| `{{high_quality_low_traffic}}` | 高质低投代表笔记(前3) |
| `{{low_quality_high_traffic}}` | 低质高投代表笔记(前3) |
| `{{low_quality_low_traffic}}` | 低质低投代表笔记(前3) |
| `{{quadrant_notes_table}}` | 完整笔记明细表(前20条) |

### LLM输出结构

1. 四象限分布概述（各象限笔记数量占比、费用占比）
2. 各象限分析（特征总结、代表笔记、核心发现）
3. 象限分析结论
4. 投放建议
