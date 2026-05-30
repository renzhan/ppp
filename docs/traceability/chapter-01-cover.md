# 第1章：项目管理（封面）

> 数据加载器: `src/pipeline/loaders/chapter-01-cover.ts`
> 提示词模板: `src/prompts/chapters/chapter-01-cover.md`
> 生成方式: 静态模板（无LLM调用）

---

## 1.1 项目基本信息

### 原始数据

| 展示字段 | 数据库表 | 列名 | Prisma字段 |
|---------|---------|------|-----------|
| 品类 | projects | category | project.category |
| 合作品牌 | projects | brand | project.brand |
| 品牌业务线 | projects | business_line | project.businessLine |
| 项目名称 | projects | project_name | project.projectName |
| 投放开始日期 | projects | start_date | project.startDate |
| 投放结束日期 | projects | end_date | project.endDate |

### SQL查询

```sql
SELECT category, brand, business_line, project_name, start_date, end_date
FROM projects
WHERE id = :projectId;
```

---

## 1.2 复盘配置（大盘均值）

### 原始数据

| 展示字段 | 数据库表 | 列名 | JSON路径 |
|---------|---------|------|---------|
| 互动率口径 | review_configs | engagement_metric | engagementMetric |
| 大盘CTR | review_configs | benchmark | benchmark.ctr |
| 大盘CPM | review_configs | benchmark | benchmark.cpm |
| 大盘CPC | review_configs | benchmark | benchmark.cpc |
| 大盘CPE | review_configs | benchmark | benchmark.cpe |

### SQL查询

```sql
SELECT engagement_metric, benchmark
FROM review_configs
WHERE project_id = :projectId
ORDER BY created_at DESC
LIMIT 1;
```

---

## 文本生成

本章为静态模板，不调用LLM。直接将上述字段填入模板变量：

```
# {{brand}} {{project_name}}
小红书种草项目复盘
- 品类：{{category}}
- 合作品牌：{{brand}}
- 品牌业务线：{{business_line}}
- 项目名称：{{project_name}}
- 投放周期：{{start_date}} — {{end_date}}
- 互动率口径：{{engagement_metric}}
- 大盘-CTR：{{benchmark_ctr}}%
- 大盘-CPM：{{benchmark_cpm}}
- 大盘-CPC：{{benchmark_cpc}}
- 大盘-CPE：{{benchmark_cpe}}
```
