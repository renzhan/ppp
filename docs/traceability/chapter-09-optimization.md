# 第9章：优化建议

> 数据加载器: `src/pipeline/loaders/chapter-09-optimization.ts`
> 提示词模板: `src/prompts/chapters/chapter-09-optimization-suggestions.md`
> 生成方式: LLM生成（temperature=0.7）

---

## 9.1 未达标指标

### 原始数据

```sql
-- 笔记数据
SELECT note_id, imp_num, read_num, engage_num, kol_price, service_fee
FROM notes WHERE project_id = :projectId;

-- KPI目标
SELECT metric_name, target_value
FROM kpi_targets WHERE project_id = :projectId;
```

### 计算公式

```
totalImpressions = SUM(imp_num)
totalReads       = SUM(read_num)
totalEngagement  = SUM(engage_num)

-- 对每个KPI目标判断是否未达标
IF actual < target:
  underperforming.push({
    metric: metricName,
    actual: actual,
    target: target,
    completion: (actual / target * 100).toFixed(1)
  })
```

---

## 9.2 内容方向表现

### 原始数据

```sql
-- 笔记互动和费用
SELECT note_id, engage_num, kol_price, service_fee
FROM notes WHERE project_id = :projectId;

-- 业务标注（内容方向）
SELECT note_id, content_direction
FROM business_annotations WHERE project_id = :projectId;
```

### 计算公式

```
-- 按内容方向分组
GROUP BY content_direction:
  count          = COUNT(notes)
  avgEngagement  = SUM(engage_num) / count
  cpe            = SUM(kol_price + service_fee) / SUM(engage_num)
```

---

## 9.3 投放效率

### 原始数据

```sql
SELECT fee, impression, click, interaction
FROM juguang_data WHERE project_id = :projectId;
```

### 计算公式

```
totalFee         = SUM(fee)
totalNotes       = COUNT(records)
avgCpc           = totalFee / SUM(click)
avgCpe           = totalFee / SUM(interaction)
```

---

## AI文本生成

### 输入变量

| 变量 | 来源 |
|------|------|
| `{{underperforming_metrics}}` | 9.1 未达标指标JSON |
| `{{content_direction_performance}}` | 9.2 内容方向表现JSON |
| `{{traffic_efficiency}}` | 9.3 投放效率JSON |

### LLM调用参数

- temperature: **0.7**（生成类，需要创造性建议）
- system prompt: "你是一位资深的小红书营销优化顾问..."

### LLM输出结构

1. 内容优化建议（基于表现较差的内容方向）
2. 投放优化建议（基于投放效率数据）
3. 人群策略优化建议
4. 下一阶段重点行动项（3-5条）
