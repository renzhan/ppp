/**
 * Next.js Instrumentation Hook
 * 在服务端启动时注册定时任务。
 *
 * 舆情定时任务：每天早上7点自动爬取评论并执行情感分析。
 */

export async function register() {
  // 只在 Node.js 运行时执行（不在 Edge 运行时）
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startSentimentCron } = await import('./lib/sentiment-cron');
    startSentimentCron();
  }
}
