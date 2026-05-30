# 第2章：项目回顾

> 数据加载器: `src/pipeline/loaders/chapter-02-project-review.ts`
> 提示词模板: `src/prompts/chapters/chapter-02-project-review.md`
> 生成方式: LLM生成（temperature=0.3）

---

## 2.1 项目背景（客户期待）

### 原始数据

| 展示字段 | 数据库表 | 列名 | 取值方式 |
|---------|---------|------|---------|
| 项目背景 | ai_generated_content | generated_content / edited_content | JSON.projectObjective |
| 传播目的 | ai_generated_content | generated_content / edited_content | JSON.strategy |
| 目标人群 | ai_generated_content | generated_content / edited_content | JSON.targetAudience |
| 核心传播信息 | ai_generated_content | generated_content / edited_content | JSON.coreMessage |

### SQL查询

```sql
-- 策划案解析结果（优先使用编辑后版本）
SELECT generated_content, edited_content, is_edited
FROM ai_generated_content
WHERE project_id = :projectId
  AND content_type = 'plan_parse'
LIMIT 1;
```

### 数据处理逻辑

```
content = is_edited && edited_content ? edited_content : generated_content
parsed = JSON.parse(content)
project_objective = parsed.projectObjective
strategy = parsed.strategy
target_audience = parsed.targetAudience
core_message = parsed.coreMessage
```

---

## 2.2 传播节奏/投放阶段

### 原始数据

| 展示字段 | 数据库表 | 列名 | JSON结构 |
|---------|---------|------|---------|
| 阶段列表 | review_configs | launch_phases | [{name, startDate, endDate, noteCount}] |

### SQL查询

```sql
SELECT launch_phases
FROM review_configs
WHERE project_id = :projectId
ORDER BY created_at DESC
LIMIT 1;
```

---

## 2.3 各阶段发布篇数

### 原始数据

| 展示字段 | 数据库表 | 列名 | 聚合方式 |
|---------|---------|------|---------|
| 各阶段篇数 | business_annotations | launch_phase | GROUP BY launch_phase, COUNT(*) |

### SQL查询

```sql
-- 按投放阶段统计篇数
SELECT launch_phase, COUNT(*) AS note_count
FROM business_annotations
WHERE project_id = :projectId
  AND launch_phase IS NOT NULL
GROUP BY launch_phase;
```

---

## 2.4 内容方向分布

### 原始数据

| 展示字段 | 数据库表 | 列名 | 聚合方式 |
|---------|---------|------|---------|
| 各方向篇数 | business_annotations | content_direction | GROUP BY content_direction, COUNT(*) |

### SQL查询

```sql
SELECT content_direction, COUNT(*) AS note_count
FROM business_annotations
WHERE project_id = :projectId
  AND content_direction IS NOT NULL
GROUP BY content_direction
ORDER BY note_count DESC;
```

---

## 2.5 达人层级分布

### 原始数据

| 展示字段 | 数据库表 | 列名 | 计算方式 |
|---------|---------|------|---------|
| 各层级篇数 | notes | kol_fan_num | classifyTier(fanCount) 后 GROUP BY |

### SQL查询

```sql
SELECT kol_fan_num FROM notes WHERE project_id = :projectId;
```

### 计算公式

```
classifyTier(fanCount):
  fanCount >= 500000 → '头部'
  fanCount >= 100000 → '腰部'
  fanCount >= 50000  → '腰尾部'
  fanCount >= 10000  → '尾部'
  其余              → 'KOC'
```

---

## 2.6 总笔记数

### SQL查询

```sql
SELECT COUNT(*) AS note_count
FROM notes
WHERE project_id = :projectId;
```

---

## AI文本生成

### 输入变量

| 变量名 | 来源 |
|--------|------|
| `{{project_objective}}` | 2.1 策划案解析 |
| `{{strategy}}` | 2.1 策划案解析 |
| `{{target_audience}}` | 2.1 策划案解析 |
| `{{core_message}}` | 2.1 策划案解析 |
| `{{launch_phases}}` | 2.2 传播节奏 |
| `{{note_count}}` | 2.6 总笔记数 |
| `{{phase_note_counts}}` | 2.3 各阶段篇数 |
| `{{content_directions}}` | 2.4 内容方向分布 |
| `{{kol_tier_distribution}}` | 2.5 达人层级分布 |

### LLM调用参数

- model: 环境变量 `OPENAI_MODEL`
- temperature: 0.3
- system prompt: "你是一位资深的小红书营销复盘专家..."

### 输出结构（4个子模块）

1. **项目背景（客户期待）** — 80-150字
2. **传播目的** — 50-100字
3. **策略回顾** — 100-200字
4. **数据解读** — 80-150字（承上启下）
