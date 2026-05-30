/**
 * Sentiment Analyzer - 舆情分析引擎
 *
 * 从 Comment 表读取原始评论，使用 QWEN_MODEL_LITE (轻量小模型) 进行：
 * - 情感分类（正向/中性/负向）
 * - 关键词提取
 *
 * 趋势数据通过聚合计算生成，处理日期不连续的情况。
 * 分析结果写入 SentimentData 表。
 */

import OpenAI from 'openai';
import { prisma } from '../shared/db.js';
import { getEnvConfig } from '../config/env.js';

// ── Types ──

interface CommentRow {
  id: string;
  noteId: string;
  content: string | null;
  nickname: string | null;
  likes: number;
  commentTime: string | null;
  isActive: boolean;
}

interface SentimentLabel {
  commentId: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  keywords: string[];
}

interface TrendPoint {
  date: string;       // YYYY-MM-DD
  count: number;      // 当日评论数
  positive: number;
  neutral: number;
  negative: number;
}

// ── Constants ──

/** 单次批量标注的最大 token 预估上限（按评论总字符数控制） */
const MAX_BATCH_CHARS = 6000;
/** 单批最大评论条数 */
const MAX_BATCH_SIZE = 50;

// ── Main Entry ──

/**
 * 对指定项目执行完整舆情分析流程：
 * 1. 加载活跃评论
 * 2. 批量调用 LLM 进行情感分类 + 关键词提取
 * 3. 聚合趋势数据（处理日期不连续）
 * 4. 写入 SentimentData 表
 */
export async function analyzeSentiment(projectId: string): Promise<void> {
  const env = getEnvConfig();

  // 创建轻量模型客户端
  const client = new OpenAI({
    baseURL: env.QWEN_BASE_URL,
    apiKey: env.QWEN_MODEL_API_KEY,
  });
  const model = env.QWEN_MODEL_LITE;

  if (!model) {
    throw new Error('QWEN_MODEL_LITE 未配置，无法执行舆情分析');
  }

  // 1. 加载评论
  const comments = await loadComments(projectId);
  if (comments.length === 0) {
    console.log(`[SentimentAnalyzer] 项目 ${projectId} 无活跃评论，跳过分析`);
    return;
  }

  console.log(`[SentimentAnalyzer] 项目 ${projectId} 共 ${comments.length} 条活跃评论，开始分析...`);

  // 2. 批量情感分类 + 关键词提取
  const labels = await batchClassify(client, model, comments);

  // 3. 聚合各维度数据
  const distribution = aggregateDistribution(labels);
  const keywords = aggregateKeywords(labels);
  const allComments = extractAllComments(comments, labels);
  const trend = aggregateTrend(comments, labels);

  console.log(`[SentimentAnalyzer] 聚合结果: distribution=${JSON.stringify(distribution)}, keywords=${keywords.keywords.length}个, comments=${allComments.length}条, trend=${trend.length}个日期点`);
  if (trend.length > 0) {
    console.log(`[SentimentAnalyzer] trend 示例:`, JSON.stringify(trend.slice(0, 3)));
  } else {
    console.log(`[SentimentAnalyzer] ⚠️ trend 为空！检查 commentTime 格式`);
    // 打印前5条评论的 commentTime 用于调试
    const sampleTimes = comments.slice(0, 5).map((c) => ({ id: c.id.slice(-8), commentTime: c.commentTime }));
    console.log(`[SentimentAnalyzer] 评论 commentTime 样本:`, JSON.stringify(sampleTimes));
  }

  // 4. 写入 SentimentData 表（先清除旧数据再写入）
  await persistResults(projectId, distribution, trend, keywords, allComments);

  console.log(`[SentimentAnalyzer] 项目 ${projectId} 舆情分析完成`);
}

// ── Data Loading ──

async function loadComments(projectId: string): Promise<CommentRow[]> {
  const rows = await prisma.comment.findMany({
    where: { projectId, isActive: true },
    select: {
      id: true,
      noteId: true,
      content: true,
      nickname: true,
      likes: true,
      commentTime: true,
      isActive: true,
    },
    orderBy: { commentTime: 'asc' },
  });
  return rows;
}

// ── Batch Classification ──

/**
 * 根据评论长短动态分批，一次批量标注一批评论。
 * 短评论可以多条一起处理，长评论则少量一批。
 */
async function batchClassify(
  client: OpenAI,
  model: string,
  comments: CommentRow[],
): Promise<SentimentLabel[]> {
  const results: SentimentLabel[] = [];
  const batches = createBatches(comments);

  console.log(`[SentimentAnalyzer] 分为 ${batches.length} 批进行标注`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    try {
      const batchLabels = await classifyBatch(client, model, batch);
      results.push(...batchLabels);
    } catch (err) {
      console.error(`[SentimentAnalyzer] 第 ${i + 1} 批标注失败，使用中性兜底:`, err);
      // 失败时兜底为中性
      for (const c of batch) {
        results.push({ commentId: c.id, sentiment: 'neutral', keywords: [] });
      }
    }
  }

  return results;
}

/**
 * 根据评论内容长度动态分批：
 * - 累计字符数不超过 MAX_BATCH_CHARS
 * - 单批条数不超过 MAX_BATCH_SIZE
 */
function createBatches(comments: CommentRow[]): CommentRow[][] {
  const batches: CommentRow[][] = [];
  let currentBatch: CommentRow[] = [];
  let currentChars = 0;

  for (const comment of comments) {
    const contentLen = (comment.content || '').length;

    if (currentBatch.length > 0 &&
        (currentChars + contentLen > MAX_BATCH_CHARS || currentBatch.length >= MAX_BATCH_SIZE)) {
      batches.push(currentBatch);
      currentBatch = [];
      currentChars = 0;
    }

    currentBatch.push(comment);
    currentChars += contentLen;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

/**
 * 调用 QWEN_MODEL_LITE 对一批评论进行情感分类和关键词提取。
 */
async function classifyBatch(
  client: OpenAI,
  model: string,
  batch: CommentRow[],
): Promise<SentimentLabel[]> {
  const commentList = batch.map((c, idx) => ({
    idx: idx + 1,
    id: c.id,
    text: (c.content || '').slice(0, 500), // 截断过长评论
  }));

  const systemPrompt = `你是一个评论情感分析助手。对每条评论进行：
1. 情感分类：positive（正向）、neutral（中性）、negative（负向）
2. 关键词提取：提取1-3个核心关键词（名词或短语）

规则：
- 表达满意、喜欢、推荐、好用等为 positive
- 表达不满、差评、退货、难用等为 negative
- 无明显情感倾向、纯提问、无意义内容为 neutral
- 空内容或无法判断的标记为 neutral，关键词为空数组

请严格按以下JSON数组格式返回，不要包含其他内容：
[{"id":"评论ID","s":"positive|neutral|negative","k":["关键词1","关键词2"]}]`;

  const userContent = commentList
    .map((c) => `[${c.idx}] id=${c.id} | ${c.text || '(空)'}`)
    .join('\n');

  const response = await client.chat.completions.create(
    {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.1,
      max_tokens: 4000,
    },
    { timeout: 60000 },
  );

  const content = response.choices[0]?.message?.content || '';
  console.log(`[SentimentAnalyzer] LLM 模型: ${model}`);
  console.log(`[SentimentAnalyzer] LLM 原始返回 (前500字):`, content.slice(0, 500));
  return parseBatchResponse(content, batch);
}

/**
 * 解析 LLM 返回的 JSON 数组，容错处理。
 */
function parseBatchResponse(raw: string, batch: CommentRow[]): SentimentLabel[] {
  // 尝试提取 JSON 数组
  let jsonStr = raw;
  const arrayMatch = raw.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    jsonStr = arrayMatch[0];
  }

  try {
    const parsed: Array<{ id: string; s: string; k: string[] }> = JSON.parse(jsonStr);
    const idSet = new Set(batch.map((c) => c.id));

    const results = parsed
      .filter((item) => idSet.has(item.id))
      .map((item) => ({
        commentId: item.id,
        sentiment: normalizeSentiment(item.s),
        keywords: Array.isArray(item.k) ? item.k.filter((k) => typeof k === 'string' && k.length > 0) : [],
      }));

    console.log(`[SentimentAnalyzer] 解析成功: ${parsed.length} 条结果, 匹配到 ${results.length} 条 (batch ${batch.length} 条)`);
    if (results.length === 0 && parsed.length > 0) {
      console.log(`[SentimentAnalyzer] ⚠️ ID 不匹配! batch IDs 样本:`, batch.slice(0, 2).map((c) => c.id));
      console.log(`[SentimentAnalyzer] ⚠️ LLM 返回 IDs 样本:`, parsed.slice(0, 2).map((p) => p.id));
    }
    return results;
  } catch (err) {
    // JSON 解析失败，全部兜底为中性
    console.error(`[SentimentAnalyzer] ⚠️ JSON 解析失败:`, err);
    console.log(`[SentimentAnalyzer] 尝试解析的内容 (前200字):`, jsonStr.slice(0, 200));
    return batch.map((c) => ({ commentId: c.id, sentiment: 'neutral' as const, keywords: [] }));
  }
}

function normalizeSentiment(s: string): 'positive' | 'neutral' | 'negative' {
  const lower = (s || '').toLowerCase().trim();
  if (lower === 'positive' || lower === 'pos') return 'positive';
  if (lower === 'negative' || lower === 'neg') return 'negative';
  return 'neutral';
}

// ── Aggregation ──

/**
 * 聚合情感分布
 */
function aggregateDistribution(labels: SentimentLabel[]): Record<string, number> {
  const dist = { positive: 0, neutral: 0, negative: 0 };
  for (const l of labels) {
    dist[l.sentiment]++;
  }
  return dist;
}

/**
 * 聚合关键词频次（取 Top 30）
 */
function aggregateKeywords(labels: SentimentLabel[]): { keywords: Array<{ word: string; count: number }> } {
  const freq = new Map<string, number>();
  for (const l of labels) {
    for (const kw of l.keywords) {
      const normalized = kw.trim().toLowerCase();
      if (normalized.length > 0) {
        freq.set(normalized, (freq.get(normalized) || 0) + 1);
      }
    }
  }

  const keywords = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([word, count]) => ({ word, count }));

  return { keywords };
}

/**
 * 提取所有评论列表（带情感标签，用于前端分页展示和 tab 筛选）
 */
function extractAllComments(
  comments: CommentRow[],
  labels: SentimentLabel[],
): Array<{ content: string; author: string; noteId: string; date: string; sentiment: string; likes: number }> {
  const labelMap = new Map<string, SentimentLabel>();
  for (const l of labels) {
    labelMap.set(l.commentId, l);
  }

  return comments
    .filter((c) => c.content)
    .map((c) => {
      const label = labelMap.get(c.id);
      return {
        content: c.content!,
        author: c.nickname || '匿名用户',
        noteId: c.noteId,
        date: c.commentTime || '',
        sentiment: label?.sentiment || 'neutral',
        likes: c.likes,
      };
    });
}

/**
 * 聚合趋势数据。
 * 注意：时间不是连续的，有的日期没有评论。
 * 只输出有评论的日期，不做日期填充，前端展示时按实际日期点连线。
 */
function aggregateTrend(comments: CommentRow[], labels: SentimentLabel[]): TrendPoint[] {
  // 建立 commentId -> sentiment 映射
  const sentimentMap = new Map<string, 'positive' | 'neutral' | 'negative'>();
  for (const l of labels) {
    sentimentMap.set(l.commentId, l.sentiment);
  }

  // 按日期聚合
  const dateMap = new Map<string, TrendPoint>();
  let nullDateCount = 0;
  let parsedDateCount = 0;

  for (const c of comments) {
    const date = extractDate(c.commentTime);
    if (!date) {
      nullDateCount++;
      continue;
    }
    parsedDateCount++;

    if (!dateMap.has(date)) {
      dateMap.set(date, { date, count: 0, positive: 0, neutral: 0, negative: 0 });
    }

    const point = dateMap.get(date)!;
    point.count++;

    const sentiment = sentimentMap.get(c.id) || 'neutral';
    point[sentiment]++;
  }

  console.log(`[SentimentAnalyzer] aggregateTrend: ${comments.length} 条评论, ${parsedDateCount} 条解析出日期, ${nullDateCount} 条日期为空/无法解析, ${dateMap.size} 个不同日期`);

  // 按日期排序返回（只包含有评论的日期）
  return [...dateMap.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 从 commentTime 字符串中提取日期部分 (YYYY-MM-DD)。
 * commentTime 格式可能是：
 * - "2025-03-15 14:30:00"
 * - "2025-03-15"
 * - "2025/03/15 14:30"
 * - "1742025600" (unix timestamp as string)
 * - "03-15" (不含年份，无法使用)
 */
function extractDate(commentTime: string | null): string | null {
  if (!commentTime) return null;

  // 尝试匹配 YYYY-MM-DD 格式
  const isoMatch = commentTime.match(/(\d{4}[-/]\d{2}[-/]\d{2})/);
  if (isoMatch) {
    return isoMatch[1].replace(/\//g, '-');
  }

  // 尝试解析为 unix timestamp（纯数字，10位或13位）
  if (/^\d{10,13}$/.test(commentTime.trim())) {
    const ts = parseInt(commentTime.trim(), 10);
    const date = new Date(ts > 9999999999 ? ts : ts * 1000);
    if (!isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }

  // 尝试直接 new Date 解析
  const parsed = new Date(commentTime);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 2000) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

// ── Persistence ──

/**
 * 将分析结果写入 SentimentData 表。
 * 策略：先删除该项目的旧数据，再插入新数据（全量替换）。
 *
 * 趋势数据每个日期点存一条记录（periodStart = 该日期），方便前端按 periodStart 排序展示。
 * 评论列表存储所有评论（带情感标签），前端通过 tab 筛选。
 */
async function persistResults(
  projectId: string,
  distribution: Record<string, number>,
  trend: TrendPoint[],
  keywords: { keywords: Array<{ word: string; count: number }> },
  allComments: Array<{ content: string; author: string; noteId: string; date: string; sentiment: string; likes: number }>,
): Promise<void> {
  // 计算趋势的时间范围
  const periodStart = trend.length > 0 ? new Date(trend[0].date) : null;
  const periodEnd = trend.length > 0 ? new Date(trend[trend.length - 1].date) : null;

  // 不使用事务，避免远程数据库连接超时
  // 先清除旧数据
  await prisma.sentimentData.deleteMany({ where: { projectId } });

  // 写入情感分布
  await prisma.sentimentData.create({
    data: {
      projectId,
      dataType: 'sentiment_distribution',
      dataContent: distribution,
      periodStart,
      periodEnd,
    },
  });

  // 写入趋势数据：每个日期点一条记录
  if (trend.length > 0) {
    await prisma.sentimentData.createMany({
      data: trend.map((point) => ({
        projectId,
        dataType: 'trend',
        dataContent: { count: point.count, positive: point.positive, neutral: point.neutral, negative: point.negative },
        periodStart: new Date(point.date),
        periodEnd: new Date(point.date),
      })),
    });
  }

  // 写入关键词
  await prisma.sentimentData.create({
    data: {
      projectId,
      dataType: 'keywords',
      dataContent: keywords,
      periodStart,
      periodEnd,
    },
  });

  // 写入所有评论（带情感标签，分批写入）
  if (allComments.length > 0) {
    const BATCH = 50;
    for (let i = 0; i < allComments.length; i += BATCH) {
      const batch = allComments.slice(i, i + BATCH);
      await prisma.sentimentData.createMany({
        data: batch.map((comment) => ({
          projectId,
          dataType: 'comments',
          dataContent: comment as unknown as object,
          periodStart,
          periodEnd,
        })),
      });
    }
  }
}
