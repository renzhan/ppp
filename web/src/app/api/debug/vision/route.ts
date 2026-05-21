import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Load root .env (Next.js only auto-loads web/.env)
dotenvConfig({ path: resolve(process.cwd(), '..', '.env') });

/**
 * POST /api/debug/vision
 * Debug endpoint: upload PNG images and call LLM Vision with the same prompt
 * used in plan document parsing. Returns raw LLM response.
 *
 * Accepts multipart form data:
 *   - images: multiple image files (PNG)
 *
 * Returns the LLM's raw response for inspection.
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const images = formData.getAll('images') as File[];

    if (!images || images.length === 0) {
      return NextResponse.json({ error: '请上传至少一张图片' }, { status: 400 });
    }

    // Build content with standard OpenAI vision format (image_url)
    const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
      { type: 'text', text: `请分析以下策划案页面（共${images.length}页）：\n\n` },
    ];
    for (let i = 0; i < images.length; i++) {
      const file = images[i];
      const buffer = Buffer.from(await file.arrayBuffer());
      const base64 = buffer.toString('base64');
      content.push({ type: 'text', text: `\n--- 第${i + 1}页 ---\n` });
      content.push({ type: 'image_url', image_url: { url: `data:image/${file.type === 'image/png' ? 'png' : 'jpeg'};base64,${base64}` } });
    }

    const SYSTEM_PROMPT = `你是一个营销策划案分析助手。请从以下策划案页面图片中提取项目背景信息。

请提取以下字段（如果页面中包含相关信息）：
- projectObjective: 传播目的/项目目标
- strategy: 策略回顾/营销策略
- targetAudience: 目标人群
- coreMessage: 核心传播信息
- kpiTargets: KPI目标值（键值对）

请严格按照以下JSON格式返回：
{
  "projectObjective": "...",
  "strategy": "...",
  "targetAudience": "...",
  "coreMessage": "...",
  "kpiTargets": { "指标名": 数值 },
  "confidence": 0-100,
  "pageSummary": "本页内容摘要",
  "extractedFields": ["已提取的字段名列表"]
}

如果某页不包含相关信息，返回：
{ "confidence": 0, "pageSummary": "本页无相关信息", "extractedFields": [] }`;

    // Read LLM config from env
    const provider = process.env.LLM_PROVIDER || 'openai';
    const baseURL = provider === 'qwen'
      ? (process.env.QWEN_BASE_URL || '')
      : (process.env.LLM_BASE_URL || '');
    const apiKey = provider === 'qwen'
      ? (process.env.QWEN_MODEL_API_KEY || '')
      : (process.env.LLM_API_KEY || '');
    const model = provider === 'qwen'
      ? (process.env.QWEN_MODEL_CHAT || 'qwen3.6-plus')
      : (process.env.LLM_MODEL || 'gpt-4.1');

    console.log(`[Vision调试] provider=${provider}, model=${model}, baseURL=${baseURL}`);

    const client = new OpenAI({ baseURL, apiKey });

    const completion = await client.chat.completions.create(
      {
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content },
        ],
        temperature: 0.3,
        max_tokens: 4096,
      },
      { timeout: 120000 },
    );

    const reply = completion.choices[0]?.message?.content || '';

    return NextResponse.json({
      success: true,
      imageCount: images.length,
      model: completion.model,
      usage: completion.usage,
      response: reply,
    });
  } catch (error) {
    console.error('POST /api/debug/vision error:', error);
    // Return the actual error message instead of swallowing it
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
