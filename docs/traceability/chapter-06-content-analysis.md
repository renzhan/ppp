# 第6章：内容分析

> 数据加载器: `src/pipeline/loaders/chapter-06-content-analysis.ts`
> 提示词模板: `src/prompts/chapters/chapter-06-content-analysis.md`
> 生成方式: LLM生成（temperature=0.3）

---

## 6.1 蒲公英笔记数据

### SQL查询

```sql
SELECT note_id, kol_nick_name, kol_fan_num, note_type, note_title,
       imp_num, read_num, engage_num,
       like_num, fav_num, cmt_num, share_num,
       kol_price, service_fee
FROM notes
WHERE project_id = :projectId;
```

---

## 6.2 笔记底表（内容方向、达人类型、费用）

### SQL查询

```sql
SELECT note_id, content_direction, kol_type, content_cost::float
FROM note_base
WHERE project_id = :projectId::uuid;
```

---

## 6.3 聚光数据（TI人群、费用）

### SQL查询

```sql
SELECT note_id, fee, ti_user_num
FROM juguang_data
WHERE project_id = :projectId
  AND note_id IS NOT NULL;
-- 同一笔记多条记录需累加
```

---

## 6.4 复盘配置（达人层级定义）

### SQL查询

```sql
SELECT engagement_metric, viral_metric, influencer_tiers
FROM review_configs
WHERE project_id = :projectId
ORDER BY created_at DESC
LIMIT 1;
```

### influencerTiers 结构

```json
[
  {"name": "头部", "fanRangeMin": 500000, "fanRangeMax": 99999999},
  {"name": "腰部", "fanRangeMin": 100000, "fanRangeMax": 499999},
  {"name": "尾部", "fanRangeMin": 10000, "fanRangeMax": 99999},
  {"name": "KOC", "fanRangeMin": 0, "fanRangeMax": 9999}
]
```

---

## 6.5 每篇笔记完整数据构建

### 计算公式

```
对每篇笔记:
  -- 互动量（按口径）
  IF engagement_metric = 'include_follow':
    engagement = engage_num
  ELSE:
    engagement = like_num + fav_num + cmt_num + share_num

  -- 费用
  contentCost = note_base.content_cost ?? (kol_price + service_fee)
  juguangFee  = SUM(juguang_data.fee WHERE note_id = X)
  totalCost   = contentCost + juguangFee

  -- TI人群
  tiUserNum = SUM(juguang_data.ti_user_num WHERE note_id = X)

  -- CPE / CPTI
  cpe  = totalCost / engagement  (engagement > 0)
  cpti = totalCost / tiUserNum   (tiUserNum > 0)

  -- 爆文判定
  IF viral_metric = 'like_only':
    isViral = (like_num >= 1000)
  ELSE:
    isViral = (like_num + fav_num + cmt_num >= 1000)

  -- 达人层级
  kolTier = MATCH kol_fan_num IN influencerTiers[].fanRange

  -- 内容形式
  noteType = IF(note_type='1' OR 'image') THEN '图文' ELSE '视频'
```

---

## 6.6 分组聚合（4个维度）

### 聚合公式（每个维度相同）

```
对每个分组值:
  篇数      = COUNT(notes)
  曝光量    = SUM(imp_num)
  阅读量    = SUM(read_num)
  互动量    = SUM(engagement)
  TI人群    = SUM(tiUserNum)
  CPTI      = SUM(totalCost) / SUM(tiUserNum)
  CPE       = SUM(totalCost) / SUM(engagement)
  爆文篇数  = COUNT(WHERE isViral)
  爆文率    = 爆文篇数 / 篇数 * 100%
```

### 分组维度

| 维度 | 分组字段来源 | 分组键 |
|------|------------|--------|
| 内容方向 | note_base.content_direction | GROUP BY content_direction |
| 达人类型 | note_base.kol_type | GROUP BY kol_type |
| 达人层级 | notes.kol_fan_num → classifyTier | GROUP BY kolTier |
| 内容形式 | notes.note_type → 图文/视频 | GROUP BY noteType |

---

## 6.7 优质笔记TOP5

### 计算公式

```
-- 按爆文得分降序排列取前5
IF viral_metric = 'like_only':
  viralScore = like_num
ELSE:
  viralScore = like_num + fav_num + cmt_num

TOP5 = notes ORDER BY viralScore DESC LIMIT 5
```

---

## AI文本生成

### 输入变量

| 变量 | 来源 |
|------|------|
| `{{total_notes}}` | 总笔记数 |
| `{{total_viral}}` | 总爆文数 |
| `{{viral_metric}}` | 爆文口径说明 |
| `{{by_content_direction}}` | 6.6 内容方向聚合表 |
| `{{by_kol_type}}` | 6.6 达人类型聚合表 |
| `{{by_kol_tier}}` | 6.6 达人层级聚合表 |
| `{{by_content_form}}` | 6.6 内容形式聚合表 |
| `{{top5_notes}}` | 6.7 TOP5笔记 |

### LLM输出结构

1. 内容方向分析（表格 + AI解读）
2. 达人类型分析（表格 + AI解读）
3. 达人层级分析（表格 + AI解读）
4. 内容形式分析（表格 + AI解读）
5. 优质笔记TOP5分析
6. 数据解读（综合评价）
