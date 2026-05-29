---
chapter_number: 4
chapter_name: "项目亮点"
required_data_sources:
  - notes
  - note_base
  - juguang_data
  - review_configs
  - lingxi_data
output_format: bullets
system_prompt: |
  你是一位资深的小红书营销复盘专家。请基于提供的数据总结项目亮点。
  采用AIPS模型框架组织亮点：
  - Awareness（被看见）：品牌声量增长、搜索指数、话题曝光
  - Interest（被互动）：爆文率、互动数据、CTR
  - True Interest（被种草）：TI人群增长、赛道占位、SOC/SOV
  - Share（被分享）：用户口碑、UGC内容涌现
  要求：语言积极正面，突出超额完成的KPI和优于行业基准的指标。
  每个亮点必须配具体数据支撑，使用"优于大盘XX%"等量化对比表达。
fallback_text: "项目亮点内容生成失败，请重试。"
---

请基于以下数据总结「项目亮点」章节内容：

## 一、KPI超额完成亮点
{{kpi_highlights}}

## 二、与大盘对比亮点（优于行业基准）
大盘指标：CPM/CPC/CPE/CTR
{{benchmark_highlights}}

## 三、人群资产亮点（灵犀AIPS数据）
{{aips_highlights}}

## 四、搜索指数亮点
搜索量（投前/投后）、搜索排名变化、品牌热度
{{search_highlights}}

## 五、内容传播亮点（爆文情况）
{{viral_highlights}}

## 六、品牌核心数据摘要
{{brand_data_summary}}

请按以下结构输出：

### 1. KPI完成率亮点（必展示）
基于各KPI完成情况由AI生成解读：向客户说明哪些指标超额完成、哪些未达到及原因，用具体数字表达结果效果。

### 2. 与大盘对比亮点（必展示）
=IF(实际值<大盘均值,"亮点","") 标记优于大盘的指标（成本类：实际<大盘=优；效率类：实际>大盘=优）。
基于实际值与大盘对比由AI生成解读：说明优于大盘XX%，结合行业背景。

### 3. 人群资产亮点（有数据时展示）
- AIPS人群总数及变化
- TI深度兴趣人群增长
- 新增资产数
- 流转率变化
- AIPS人群地域/行业排名

### 4. 搜索指数亮点（有数据时展示）
- 搜索量（投前 vs 投后）
- 搜索量排名变化
- 品牌热度变化趋势

### 5. 内容传播亮点（必展示）
- 爆文数量和爆文率
- 代表性爆文简要说明

### 6. 数据解读
基于本模块所有亮点数据由AI生成综合解读，向客户说明本次项目最值得关注的大亮点是什么，整体效果如何。
