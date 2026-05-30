# 第10章：尾页

> 数据加载器: `src/pipeline/loaders/chapter-10-end-page.ts`
> 提示词模板: `src/prompts/chapters/chapter-10-end-page.md`
> 生成方式: 静态模板（无LLM调用）

---

## 10.1 项目日期

### 原始数据

| 展示字段 | 数据库表 | 列名 |
|---------|---------|------|
| 开始日期 | projects | start_date |
| 结束日期 | projects | end_date |

### SQL查询

```sql
SELECT start_date, end_date
FROM projects
WHERE id = :projectId;
```

---

## 文本生成

本章为静态模板，不调用LLM：

```
# THANKS
{{start_date}}—{{end_date}}
```
