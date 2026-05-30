# 第3章：数据总览

> 数据加载器: `src/pipeline/loaders/chapter-03-data-overview.ts`
> 提示词模板: `src/prompts/chapters/chapter-03-data-overview.md`
> 生成方式: LLM生成（temperature=0.3）

---

## 3.1 复盘配置（口径设置）

### 原始数据

| 配置项 | 数据库表 | 列名/JSON路径 | 影响范围 |
|--------|---------|-------------|---------|
| 互动口径 | review_configs | engagement_metric | 总互动量计算 |
| 爆文口径 | review_configs | viral_metric | 爆文判定 |
| 内容金额口径 | review_configs | modules.contentCostCaliber | 内容费用计算 |
| 投流金额口径 | review_configs | modules.trafficCostCaliber | 投流费用计算 |
| KPI目标 | review_configs | kpi_targets | KPI完成率 |
| 大盘均值 | review_configs | benchmark | 大盘对比 |

### SQL查询

```sql
SELECT kpi_targets, benchmark, engagement_metric, viral_metric, modules
FROM review_configs
WHERE project_id = :projectId
ORDER BY created_at DESC
LIMIT 1;
```

---

## 3.2 笔记底表（总篇数、结算金额）

### 原始数据

| 展示字段 | 数据库表 | 列名 | 说明 |
|---------|---------|------|------|
| 总笔记篇数 | note_base | — | COUNT(*) |
| 内容结算金额 | note_base | content_settlement | 结算口径时使用 |
| 投流结算金额 | note_base | ad_spend | 结算口径时使用 |

### SQL查询

```sql
SELECT
  COUNT(*)::bigint AS cnt,
  COALESCE(SUM(content_settlement), 0)::float AS content_settlement_sum,
  COALESCE(SUM(ad_spend), 0)::float AS ad_spend_sum
FROM note_base
WHERE project_id = :projectId::uuid;
```

---

## 3.3 蒲公英数据（曝光/阅读/互动/费用）

### 原始数据

| 展示字段 | 数据库表 | 列名 | 聚合方式 |
|---------|---------|------|---------|
| 总曝光量 | notes | imp_num | SUM(imp_num) |
| 总阅读量 | notes | read_num | SUM(read_num) |
| 总互动量(含关注) | notes | engage_num | SUM(engage_num) |
| 点赞量 | notes | like_num | SUM(like_num) |
| 收藏量 | notes | fav_num | SUM(fav_num) |
| 评论量 | notes | cmt_num | SUM(cmt_num) |
| 分享量 | notes | share_num | SUM(share_num) |
| 关注量 | notes | follow_num | SUM(follow_num) |
| 博主报价合计 | notes | kol_price | SUM(kol_price) |
| 服务费合计 | notes | service_fee | SUM(service_fee) |

### SQL查询

```sql
SELECT
  imp_num, read_num, engage_num,
  like_num, fav_num, cmt_num, share_num, follow_num,
  kol_price, service_fee
FROM notes
WHERE project_id = :projectId;
```

### 计算公式

```
-- 总互动量（根据口径）
IF engagement_metric = 'include_follow':
  totalEngagement = SUM(engage_num)
ELSE:
  totalEngagement = SUM(like_num) + SUM(fav_num) + SUM(cmt_num) + SUM(share_num)

-- 爆文判定（逐条笔记）
IF viral_metric = 'like_only':
  isViral = (like_num >= 1000)
ELSE:
  isViral = (like_num + fav_num + cmt_num >= 1000)

-- 爆文率
viralRate = viralCount / noteCount * 100

-- CTR
ctr = totalReads / totalImpressions * 100
```

---

## 3.4 聚光数据（投流汇总）

### 原始数据

| 展示字段 | 数据库表 | 列名 | 聚合方式 |
|---------|---------|------|---------|
| 投流总消费 | juguang_data | fee | SUM(fee) |
| 投流展现量 | juguang_data | impression | SUM(impression) |
| 投流点击量 | juguang_data | click | SUM(click) |
| 投流互动量 | juguang_data | interaction | SUM(interaction) |
| TI深度种草人群 | juguang_data | ti_user_num | SUM(ti_user_num) |

### SQL查询

```sql
SELECT
  COALESCE(SUM(fee), 0) AS total_fee,
  COALESCE(SUM(impression), 0) AS total_impression,
  COALESCE(SUM(click), 0) AS total_click,
  COALESCE(SUM(interaction), 0) AS total_interaction,
  COALESCE(SUM(ti_user_num), 0) AS total_ti_user_num
FROM juguang_data
WHERE project_id = :projectId;
```

---

## 3.5 总费用计算

### 计算公式

```
-- 内容费用（根据口径）
IF contentCostCaliber = 'settlement':
  contentCost = note_base.SUM(content_settlement)
ELSE:
  contentCost = notes.SUM(kol_price) + notes.SUM(service_fee)

-- 投流费用（根据口径）
IF trafficCostCaliber = 'settlement':
  trafficCost = note_base.SUM(ad_spend)
ELSE:
  trafficCost = juguang_data.SUM(fee)

-- 总费用
totalCost = contentCost + trafficCost
```

---

## 3.6 综合效率指标

### 计算公式

| 指标 | 公式 | 分子来源 | 分母来源 |
|------|------|---------|---------|
| CPM | totalCost / totalImpressions * 1000 | 3.5 总费用 | 3.3 notes.SUM(imp_num) |
| CPC | totalCost / totalReads | 3.5 总费用 | 3.3 notes.SUM(read_num) |
| CPE | totalCost / totalEngagement | 3.5 总费用 | 3.3 互动量(按口径) |
| CTR | totalReads / totalImpressions * 100 | 3.3 notes.SUM(read_num) | 3.3 notes.SUM(imp_num) |

---

## 3.7 自然流指标

### 计算公式

```
-- 自然流 = 蒲公英总量 - 聚光总量
naturalImpressions = MAX(0, notes.SUM(imp_num) - juguang.SUM(impression))
naturalReads       = MAX(0, notes.SUM(read_num) - juguang.SUM(click))
naturalEngagement  = MAX(0, totalEngagement - juguang.SUM(interaction))

-- 自然流CPX（分子用总费用）
naturalCPM = totalCost / naturalImpressions * 1000
naturalCPC = totalCost / naturalReads
naturalCPE = totalCost / naturalEngagement
naturalCTR = naturalReads / naturalImpressions * 100
```

---

## 3.8 KPI完成率

### 原始数据

```sql
-- KPI目标值来自 review_configs.kpi_targets JSON
-- 示例结构: {"totalImpression": 5000000, "cpm": 50, "cpe": 30, ...}
```

### 计算公式

| KPI指标 | JSON key | 实际值来源 | 完成率公式 |
|---------|----------|-----------|-----------|
| 总曝光 | totalImpression | notes.SUM(imp_num) | actual / target * 100 |
| 总阅读 | totalRead | notes.SUM(read_num) | actual / target * 100 |
| 总互动 | totalEngagement | 3.3 互动量(按口径) | actual / target * 100 |
| 爆文率 | viralPosts1k | 3.3 viralRate | actual / target * 100 |
| CPM | cpm | 3.6 cpm | **target / actual * 100** (成本类反转) |
| CPC | cpc | 3.6 cpc | **target / actual * 100** (成本类反转) |
| CPE | cpe | 3.6 cpe | **target / actual * 100** (成本类反转) |
| CTR | ctr | 3.6 ctr | actual / target * 100 |

---

## 3.9 灵犀数据（AIPS人群）

### 原始数据

| 展示字段 | 数据库表 | 列名 | 筛选条件 | JSON路径 |
|---------|---------|------|---------|---------|
| 品牌AIPS人群 | lingxi_data | data_content | data_type='brand' | content.aips |
| 品牌TI人群 | lingxi_data | data_content | data_type='brand' | content.ti |
| SPU AIPS人群 | lingxi_data | data_content | data_type='spu' | content.aips |
| SPU TI人群 | lingxi_data | data_content | data_type='spu' | content.ti |

### SQL查询

```sql
SELECT data_type, data_content
FROM lingxi_data
WHERE project_id = :projectId;
```

---

## 3.10 大盘对比

### 原始数据

```sql
-- 大盘均值来自 review_configs.benchmark JSON
-- 示例结构: {"ctr": 3.5, "cpm": 45, "cpc": 2.5, "cpe": 25, "engagementRate": 5}
```

---

## AI文本生成

### 输入变量完整列表

| 变量 | 来源节 | 说明 |
|------|--------|------|
| `{{project_name}}` | 3.1 projects | 项目名称 |
| `{{brand}}` | 3.1 projects | 品牌 |
| `{{start_date}}` / `{{end_date}}` | 3.1 projects | 执行周期 |
| `{{note_count}}` | 3.2 note_base | 总篇数 |
| `{{total_cost}}` | 3.5 计算 | 总费用 |
| `{{content_cost}}` / `{{traffic_cost}}` | 3.5 计算 | 内容/投流费用 |
| `{{total_impressions}}` | 3.3 notes | 总曝光 |
| `{{total_reads}}` | 3.3 notes | 总阅读 |
| `{{total_engagement}}` | 3.3 计算 | 总互动(按口径) |
| `{{total_likes/favs/comments/shares/follows}}` | 3.3 notes | 互动明细 |
| `{{viral_count}}` / `{{viral_rate}}` | 3.3 计算 | 爆文数/率 |
| `{{cpm/cpc/cpe/ctr}}` | 3.6 计算 | 综合效率指标 |
| `{{juguang_fee/impression/click/interaction}}` | 3.4 juguang | 投流数据 |
| `{{natural_impressions/reads/engagement}}` | 3.7 计算 | 自然流量 |
| `{{natural_cpm/cpc/cpe/ctr}}` | 3.7 计算 | 自然流效率 |
| `{{kpi_*}}` / `{{*_completion}}` | 3.8 计算 | KPI目标与完成率 |
| `{{benchmark_ctr/cpm/cpc/cpe}}` | 3.10 review_configs | 大盘均值 |
| `{{aips_brand/ti_brand/aips_spu/ti_spu}}` | 3.9 lingxi | 人群资产 |

### LLM输出要求

1. 整体数据表现概述（80-120字）
2. 核心亮点指标（完成率>100%）
3. 需关注指标（完成率<100%）
4. 自然流vs投流效率对比解读
5. 大盘对比解读
6. 综合评价（50字内）
