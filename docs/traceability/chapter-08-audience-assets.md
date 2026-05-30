# 第8章：人群资产

> 数据加载器: `src/pipeline/loaders/chapter-08-audience-assets.ts`
> 提示词模板: `src/prompts/chapters/chapter-08-audience-assets.md`
> 生成方式: LLM生成（temperature=0.3）

---

## 8.1 AIPS人群数据

### 原始数据

| 展示字段 | 数据库表 | 列名 | 筛选条件 | JSON路径 |
|---------|---------|------|---------|---------|
| A(被看见)人群 | lingxi_data | data_content | data_type='aips' | content.awareness |
| I(被互动)人群 | lingxi_data | data_content | data_type='aips' | content.interest |
| P(被购买)人群 | lingxi_data | data_content | data_type='aips' | content.purchase |
| S(被分享)人群 | lingxi_data | data_content | data_type='aips' | content.share |

### SQL查询

```sql
SELECT data_content, period_start, period_end
FROM lingxi_data
WHERE project_id = :projectId
  AND data_type = 'aips'
ORDER BY created_at DESC;
```

---

## 8.2 人群流转率

### 计算公式

```
-- 需要至少2个时间段的数据
IF lingxi_data记录数 >= 2:
  current  = lingxi_data[0].data_content  (最新)
  previous = lingxi_data[1].data_content  (上一期)

  awareness_growth = (current.awareness - previous.awareness) / previous.awareness * 100%
  interest_growth  = (current.interest - previous.interest) / previous.interest * 100%
  purchase_growth  = (current.purchase - previous.purchase) / previous.purchase * 100%
  share_growth     = (current.share - previous.share) / previous.share * 100%
ELSE:
  所有growth = 0（单期数据无法计算流转率）
```

---

## AI文本生成

### 输入变量

| 变量 | 来源 |
|------|------|
| `{{aips_population_data}}` | 8.1 各层级人群规模 |
| `{{aips_flow_rates}}` | 8.2 人群流转率JSON |

### LLM输出结构

1. 各层级人群规模概述（A-认知、I-兴趣、P-购买、S-忠诚）
2. 人群流转效率分析
3. 人群资产健康度评估
4. 人群运营优化建议
