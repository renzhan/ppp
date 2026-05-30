/**
 * 舆情定时任务脚本
 * 每天早上7点执行一次：爬取评论 + 情感分析
 *
 * 使用方式：
 *   npx tsx scripts/sentiment-cron.ts          # 立即执行一次
 *   npx tsx scripts/sentiment-cron.ts --daemon  # 常驻进程，每天7点自动执行
 *
 * 也可通过系统 cron 调度：
 *   0 7 * * * curl -X POST http://localhost:3000/api/sentiment/cron -H "Authorization: Bearer $CRON_SECRET"
 */

import 'dotenv/config';

const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET || '';

async function runOnce(): Promise<void> {
  console.log(`[${new Date().toISOString()}] 开始执行舆情定时任务...`);

  try {
    const res = await fetch(`${BASE_URL}/api/sentiment/cron`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(CRON_SECRET ? { Authorization: `Bearer ${CRON_SECRET}` } : {}),
      },
    });

    const body = await res.json();

    if (!res.ok) {
      console.error(`[SentimentCron] 请求失败 (${res.status}):`, body);
      return;
    }

    console.log(`[SentimentCron] ${body.message}`);
    if (body.results) {
      for (const r of body.results) {
        const status = r.analyzed ? '✓' : '✗';
        const detail = r.error || `${r.commentCount} 条评论`;
        console.log(`  ${status} ${r.projectName}: ${detail}`);
      }
    }
  } catch (err) {
    console.error('[SentimentCron] 网络错误:', err);
  }
}

function msUntilNext7am(): number {
  const now = new Date();
  const target = new Date(now);
  target.setHours(7, 0, 0, 0);

  // 如果今天7点已过，设为明天7点
  if (now >= target) {
    target.setDate(target.getDate() + 1);
  }

  return target.getTime() - now.getTime();
}

async function daemon(): Promise<void> {
  console.log('[SentimentCron] 守护模式启动，每天早上7点执行');

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const waitMs = msUntilNext7am();
    const nextRun = new Date(Date.now() + waitMs);
    console.log(`[SentimentCron] 下次执行: ${nextRun.toLocaleString('zh-CN')}`);

    await new Promise((resolve) => setTimeout(resolve, waitMs));
    await runOnce();
  }
}

// ── Entry ──

const isDaemon = process.argv.includes('--daemon');

if (isDaemon) {
  daemon().catch(console.error);
} else {
  runOnce().then(() => process.exit(0)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
