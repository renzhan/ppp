import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DataIngestionService } from '@/ingestion/index';
import { analyzeSentiment } from '@/ingestion/sentiment-analyzer';

/**
 * POST /api/sentiment/cron
 * 定时任务入口：每天早上7点由 cron 触发
 *
 * 流程：
 * 1. 查找所有"复盘中"的项目（status 不是 finalized）
 * 2. 对每个项目：获取其所有 noteId，增量爬取评论
 * 3. 爬取完成后执行情感分析和关键词提取
 *
 * 安全：通过 CRON_SECRET 环境变量验证请求来源
 */
export async function POST(request: NextRequest) {
  try {
    // 验证 cron 密钥（防止外部随意触发）
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'INVALID_CRON_SECRET' },
        { status: 401 },
      );
    }

    // 1. 查找所有复盘中的项目（未终版的项目）
    const activeProjects = await prisma.project.findMany({
      where: {
        status: { not: 'finalized' },
      },
      select: { id: true, projectName: true },
    });

    if (activeProjects.length === 0) {
      return NextResponse.json({
        success: true,
        message: '无复盘中的项目',
        results: [],
      });
    }

    // 初始化 ingestion service
    const ingestionService = new DataIngestionService();

    const results: Array<{
      projectId: string;
      projectName: string;
      noteCount: number;
      commentCount: number;
      analyzed: boolean;
      error?: string;
    }> = [];

    // 2. 逐项目处理
    for (const project of activeProjects) {
      try {
        // 获取项目所有笔记的 noteId
        const notes = await prisma.note.findMany({
          where: { projectId: project.id },
          select: { noteId: true },
        });

        const noteIds = notes.map((n) => n.noteId);

        if (noteIds.length === 0) {
          results.push({
            projectId: project.id,
            projectName: project.projectName,
            noteCount: 0,
            commentCount: 0,
            analyzed: false,
            error: '无笔记数据',
          });
          continue;
        }

        // 通过 ingestion service 增量爬取评论
        const { count, errors } = await ingestionService.ingestComments(project.id, noteIds);
        if (errors.length > 0) {
          console.warn(`[SentimentCron] ${project.projectName} 评论爬取部分失败:`, errors);
        }

        // 3. 执行情感分析
        await analyzeSentiment(project.id);

        results.push({
          projectId: project.id,
          projectName: project.projectName,
          noteCount: noteIds.length,
          commentCount: count,
          analyzed: true,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[SentimentCron] 项目 ${project.projectName} 处理失败:`, message);
        results.push({
          projectId: project.id,
          projectName: project.projectName,
          noteCount: 0,
          commentCount: 0,
          analyzed: false,
          error: message,
        });
      }
    }

    const successCount = results.filter((r) => r.analyzed).length;
    console.log(
      `[SentimentCron] 完成: ${successCount}/${activeProjects.length} 个项目分析成功`,
    );

    return NextResponse.json({
      success: true,
      message: `处理完成: ${successCount}/${activeProjects.length} 个项目`,
      results,
    });
  } catch (error) {
    console.error('[SentimentCron] 定时任务执行失败:', error);
    return NextResponse.json(
      { error: '定时任务执行失败', code: 'CRON_FAILED' },
      { status: 500 },
    );
  }
}
