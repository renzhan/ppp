/**
 * 数据预爬定时任务 - 进程内调度器
 *
 * 每天下午 16:00 自动遍历所有复盘中的项目，预爬蒲公英 + 灵犀（T-1）数据。
 * 用户使用时数据已在库中，直接做增量即可。
 */

import { prisma } from './prisma';
import { DataIngestionService } from '@/ingestion/index';

const CRON_HOUR = parseInt(process.env.INGESTION_CRON_HOUR || '16', 10);
const CRON_MINUTE = parseInt(process.env.INGESTION_CRON_MINUTE || '0', 10);

let cronTimer: ReturnType<typeof setTimeout> | null = null;

export function startIngestionCron(): void {
  console.log(`[IngestionCron] 定时任务已注册，每天 ${String(CRON_HOUR).padStart(2, '0')}:${String(CRON_MINUTE).padStart(2, '0')} 执行`);
  scheduleNext();
}

function scheduleNext(): void {
  const now = new Date();
  const target = new Date(now);
  target.setHours(CRON_HOUR, CRON_MINUTE, 0, 0);

  if (now >= target) {
    target.setDate(target.getDate() + 1);
  }

  const waitMs = target.getTime() - now.getTime();
  console.log(`[IngestionCron] 下次执行: ${target.toLocaleString('zh-CN')} (${Math.round(waitMs / 60000)} 分钟后)`);

  cronTimer = setTimeout(async () => {
    await runIngestionJob();
    scheduleNext();
  }, waitMs);

  if (cronTimer.unref) {
    cronTimer.unref();
  }
}

async function runIngestionJob(): Promise<void> {
  const startTime = Date.now();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[IngestionCron] 数据预爬定时任务开始 | ${new Date().toLocaleString('zh-CN')}`);
  console.log(`${'='.repeat(60)}`);

  try {
    const activeProjects = await prisma.project.findMany({
      where: { status: { not: 'finalized' } },
      select: { id: true, projectName: true },
    });

    if (activeProjects.length === 0) {
      console.log('[IngestionCron] 无复盘中的项目，跳过');
      return;
    }

    console.log(`[IngestionCron] 找到 ${activeProjects.length} 个复盘中的项目`);

    const ingestionService = new DataIngestionService();

    let successCount = 0;
    let failedCount = 0;

    for (const project of activeProjects) {
      try {
        const result = await ingestionService.ingestBaseData(project.id);
        if (result.errors.length > 0) {
          console.warn(`  ⚠ [${project.projectName}] 部分失败: ${result.errors.join('; ')}`);
        }
        successCount++;
        console.log(`  ✓ [${project.projectName}] 笔记 ${result.pugongyingNotes.length} 篇`);
      } catch (err) {
        failedCount++;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  ✗ [${project.projectName}] 失败: ${msg}`);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`[IngestionCron] 数据预爬定时任务结束 | ${new Date().toLocaleString('zh-CN')}`);
    console.log(`  项目总数: ${activeProjects.length} | 成功: ${successCount} | 失败: ${failedCount}`);
    console.log(`  总耗时: ${elapsed}s`);
    console.log(`${'─'.repeat(60)}\n`);
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[IngestionCron] 任务执行异常 (${elapsed}s):`, err);
  }
}

export function stopIngestionCron(): void {
  if (cronTimer) {
    clearTimeout(cronTimer);
    cronTimer = null;
    console.log('[IngestionCron] 定时任务已停止');
  }
}
