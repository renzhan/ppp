# 第4章：项目亮点

> 数据加载器: `src/pipeline/loaders/chapter-04-highlights.ts`
> 提示词模板: `src/prompts/chapters/chapter-04-highlights.md`
> 生成方式: LLM生成（temperature=0.3）

---

## 4.1 KPI超额完成亮点

### 原始数据

与第3章相同的数据源，重新计算：

```sql
-- 蒲公英笔记数据
SELECT imp_num, read_num, engage_num, like_num, fav_num, cmt_num, share_num, kol_price, service_fee
FROM notes WHERE project_id = :projectId;

-- 笔记底表
SELECT COUNT(*)::bigint AS cnt,
       COALESCE(SUM(content_settlement), 0)::float AS cs,
       COALESCE(SUM(ad_spend), 0)::float AS ads
FROM note_base WHERE project_id = :projectId::uuid;

-- 聚光费用
SELECT COALESCE(SUM(fee), 0) AS total_fee
FROM juguang_data WHERE project_id = :projectId;

-- KPI目标
SELECT kpi_targets, benchmark, engagement_metric, viral_metric
FROM review_configs WHERE project_id = :projectId ORDER BY created_at DESC LIMIT 1;
```

### 计算公式（亮点判定）

```
对每个KPI指标:
  非成本类(曝光/阅读/互动/爆文率/CTR):
    completion = actual / target * 100
    IF completion > 100 → 标记为亮点
  
  成本类(CPM/CPC/CPE):
    completion = target / actual * 100  (目标是上限，实际越低越好)
    IF completion > 100 → 标记为亮点（实际成本低于目标）
```

---

## 4.2 大盘对比亮点

### 计算公式

```
成本类指标(CPM/CPC/CPE):
  IF actual < benchmark → 亮点
  优于幅度 = (1 - actual/benchmark) * 100%

效率类指标(CTR):
  IF actual > benchmark → 亮点
  优于幅度 = (actual/benchmark - 1) * 100%
```

---

## 4.3 爆文亮点

### 原始数据

```sql
SELECT like_num, fav_num, cmt_num FROM notes WHERE project_id = :projectId;
```

### 计算公式

```
IF viral_metric = 'like_only':
  viralCount = COUNT(notes WHERE like_num >= 1000)
ELSE:
  viralCount = COUNT(notes WHERE like_num + fav_num + cmt_num >= 1000)

viralRate = viralCount / noteCount(from note_base) * 100
```

---

## 4.4 人群资产亮点（灵犀AIPS）

### 原始数据

```sql
SELECT data_type, data_content, period_start, period_end
FROM lingxi_data
WHERE project_id = :projectId
ORDER BY created_at DESC;
```

### 提取字段

| data_type | JSON路径 | 展示字段 |
|-----------|---------|---------|
| brand / spu | content.aips | AIPS人群总数 |
| brand / spu | content.ti | TI深度兴趣人群 |
| brand / spu | content.aipsChange | AIPS变化率 |
| brand / spu | content.tiChange | TI变化率 |
| brand / spu | content.newAssets | 新增资产数 |
| aips | content.total | AIPS总数 |
| aips | content.awareness | A(被看见) |
| aips | content.interest | I(被互动) |
| aips | content.trueInterest | TI(被种草) |
| aips | content.share | S(被分享) |
| aips | content.conversionRate | 流转率 |

---

## 4.5 搜索指数亮点

### 原始数据

```sql
SELECT data_content
FROM lingxi_data
WHERE project_id = :projectId
  AND data_type IN ('search', 'brand_search');
```

### 提取字段

| JSON路径 | 展示字段 |
|---------|---------|
| content.searchVolumeBefore | 搜索量（投前） |
| content.searchVolumeAfter | 搜索量（投后） |
| content.searchRankBefore | 搜索排名（投前） |
| content.searchRankAfter | 搜索排名（投后） |
| content.brandHeat | 品牌热度变化 |

---

## AI文本生成

### 输入变量

| 变量 | 来源 |
|------|------|
| `{{kpi_highlights}}` | 4.1 KPI超额完成列表 |
| `{{benchmark_highlights}}` | 4.2 大盘对比亮点列表 |
| `{{viral_highlights}}` | 4.3 爆文数据 |
| `{{aips_highlights}}` | 4.4 灵犀AIPS数据 |
| `{{search_highlights}}` | 4.5 搜索指数数据 |
| `{{brand_data_summary}}` | 品牌核心数据摘要 |

### LLM输出结构（AIPS框架）

1. KPI完成率亮点（必展示）
2. 与大盘对比亮点（必展示）
3. 人群资产亮点（有数据时展示）
4. 搜索指数亮点（有数据时展示）
5. 内容传播亮点（必展示）
6. 数据解读（综合分析）
