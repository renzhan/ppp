/**
 * 舆情定时任务 - 进程内调度器
 *
 * 每天早上7:00 自动执行：
 * 1. 查找所有复盘中的项目（status != finalized）
 * 2. 获取每个项目的笔记 noteId 列表
 * 3. 增量爬取评论（upsert 合入）
 * 4. 执行情感分析和关键词提取
 *
 * 结果直接写入 SentimentData 表，前端页面通过 GET API 从数据库加载显示。
 */

import { prisma } from './prisma';
import { DataIngestionService } from '@/ingestion/index';
import { analyzeSentiment } from '@/ingestion/sentiment-analyzer';

// 从环境变量读取定时时间，默认每天早上7:00
// 配置方式：SENTIMENT_CRON_HOUR=7  SENTIMENT_CRON_MINUTE=0
const CRON_HOUR = parseInt(process.env.SENTIMENT_CRON_HOUR || '7', 10);
const CRON_MINUTE = parseInt(process.env.SENTIMENT_CRON_MINUTE || '0', 10);

let cronTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 启动定时任务调度器
 */
export function startSentimentCron(): void {
  if (process.env.DISABLE_SENTIMENT_CRON === 'true') {
    console.log('[SentimentCron] 定时任务已禁用 (DISABLE_SENTIMENT_CRON=true)');
    return;
  }

  console.log(`[SentimentCron] 定时任务已注册，每天 ${String(CRON_HOUR).padStart(2, '0')}:${String(CRON_MINUTE).padStart(2, '0')} 执行`);
  scheduleNext();
}

function scheduleNext(): void {
  const now = new Date();
  const target = new Date(now);
  target.setHours(CRON_HOUR, CRON_MINUTE, 0, 0);

  // 如果今天的时间已过，设为明天
  if (now >= target) {
    target.setDate(target.getDate() + 1);
  }

  const waitMs = target.getTime() - now.getTime();
  console.log(`[SentimentCron] 下次执行: ${target.toLocaleString('zh-CN')} (${Math.round(waitMs / 60000)} 分钟后)`);

  cronTimer = setTimeout(async () => {
    await runSentimentJob();
    scheduleNext(); // 执行完后调度下一次
  }, waitMs);

  // 确保不阻止进程退出
  if (cronTimer.unref) {
    cronTimer.unref();
  }
}

/**
 * 执行一次完整的舆情爬取 + 分析任务
 */
async function runSentimentJob(): Promise<void> {
  const startTime = Date.now();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[SentimentCron] 舆情定时任务开始 | ${new Date().toLocaleString('zh-CN')}`);
  console.log(`${'='.repeat(60)}`);

  try {
    // 查找所有复盘中的项目
    const activeProjects = await prisma.project.findMany({
      where: { status: { not: 'finalized' } },
      select: { id: true, projectName: true },
    });

    if (activeProjects.length === 0) {
      console.log('[SentimentCron] 无复盘中的项目，跳过');
      return;
    }

    console.log(`[SentimentCron] 找到 ${activeProjects.length} 个复盘中的项目`);

    // 使用 DataIngestionService 统一接口
    const ingestionService = new DataIngestionService();

    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    let totalComments = 0;
    let totalNotes = 0;

    for (const project of activeProjects) {
      try {
        // 获取项目所有笔记的 noteId
        const notes = await prisma.note.findMany({
          where: { projectId: project.id },
          select: { noteId: true },
        });

        const noteIds = notes.map((n) => n.noteId);
        if (noteIds.length === 0) {
          skippedCount++;
          continue;
        }

        totalNotes += noteIds.length;

        // 通过 ingestion service 增量爬取评论
        const { count, errors } = await ingestionService.ingestComments(project.id, noteIds);
        if (errors.length > 0) {
          console.warn(`  [${project.projectName}] 评论爬取部分失败: ${errors.join('; ')}`);
        }

        totalComments += count;

        // 异步后台执行情感分析，不阻塞爬取任务
        analyzeSentiment(project.id).catch((sentimentErr) => {
          const sentimentMsg = sentimentErr instanceof Error ? sentimentErr.message : String(sentimentErr);
          console.error(`  [${project.projectName}] 情感分析失败: ${sentimentMsg}`);
        });

        successCount++;
        console.log(`  ✓ [${project.projectName}] ${noteIds.length} 篇笔记, ${count} 条评论`);
      } catch (err) {
        failedCount++;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  ✗ [${project.projectName}] 失败: ${msg}`);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`[SentimentCron] 舆情定时任务结束 | ${new Date().toLocaleString('zh-CN')}`);
    console.log(`  项目总数: ${activeProjects.length} | 成功: ${successCount} | 跳过(无笔记): ${skippedCount} | 失败: ${failedCount}`);
    console.log(`  爬取笔记: ${totalNotes} 篇 | 爬取评论: ${totalComments} 条`);
    console.log(`  总耗时: ${elapsed}s`);
    console.log(`${'─'.repeat(60)}\n`);
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[SentimentCron] 任务执行异常 (${elapsed}s):`, err);
  }
}

/**
 * 停止定时任务（用于测试或优雅关闭）
 */
export function stopSentimentCron(): void {
  if (cronTimer) {
    clearTimeout(cronTimer);
    cronTimer = null;
    console.log('[SentimentCron] 定时任务已停止');
  }
}
