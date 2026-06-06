import OpenAI from 'openai';
import type { ChatMessage, LLMOptions } from '../shared/types.js';

/**
 * LLM客户端配置
 */
export interface LLMConfig {
  baseURL: string;
  model: string;
  apiKey: string;
  /** 额外的请求参数（如 Qwen 的 enable_thinking） */
  extraBody?: Record<string, unknown>;
}

export type LLMProvider = 'openai' | 'qwen';

/**
 * LLM客户端接口
 */
export interface LLMClient {
  chat(messages: ChatMessage[], options?: LLMOptions): Promise<string>;
}

const DEFAULT_TIMEOUT = 120000; // 120 seconds default (Qwen models need more time for complex outputs)
const FALLBACK_MESSAGE = 'AI生成失败，请稍后重试';

/**
 * Strip <think>...</think> blocks from Qwen3 responses.
 * Even with enable_thinking=false, some edge cases may still include thinking blocks.
 */
function stripThinkingBlocks(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
}

/**
 * 从环境变量创建 LLMClient，支持 OpenAI / Qwen 切换。
 * Qwen DashScope 使用 OpenAI 兼容接口，复用 OpenAILLMClient。
 *
 * 注意：Qwen3 系列模型默认开启"思考模式"（thinking），会大幅增加响应时间。
 * 这里通过 extra_body 传入 enable_thinking=false 来关闭思考模式，确保生成速度。
 */
export function createLLMClientFromEnv(): LLMClient {
  const provider = (process.env.LLM_PROVIDER || 'openai') as LLMProvider;

  if (provider === 'qwen') {
    const baseURL = process.env.QWEN_BASE_URL || process.env.LLM_BASE_URL || '';
    const apiKey = process.env.QWEN_MODEL_API_KEY || process.env.LLM_API_KEY || '';
    const model = process.env.QWEN_MODEL_CHAT || process.env.LLM_MODEL || 'qwen3.6-plus';

    if (!baseURL || !apiKey) {
      throw new Error('Qwen 配置缺失: 请设置 QWEN_BASE_URL 和 QWEN_MODEL_API_KEY');
    }

    // Qwen3 系列默认开启 thinking 模式，会导致响应极慢（30-60s 思考 + 生成时间）
    // 通过 enable_thinking: false 关闭，或通过环境变量 QWEN_ENABLE_THINKING=true 手动开启
    const enableThinking = process.env.QWEN_ENABLE_THINKING === 'true';

    return new OpenAILLMClient({
      baseURL,
      apiKey,
      model,
      extraBody: enableThinking ? undefined : { enable_thinking: false },
    });
  }

  // Default: OpenAI
  const baseURL = process.env.LLM_BASE_URL || process.env.OPENAI_BASE_URL || '';
  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '';
  const model = process.env.LLM_MODEL || 'gpt-4.1';

  if (!baseURL || !apiKey) {
    throw new Error('LLM 配置缺失: 请设置 LLM_BASE_URL 和 LLM_API_KEY');
  }

  return new OpenAILLMClient({ baseURL, apiKey, model });
}

/**
 * OpenAI-compatible LLM客户端实现
 * - 失败时重试1次
 * - 两次均失败时返回模板文案
 * - 默认60秒超时（Qwen模型响应较慢，从30s提升到60s）
 */
export class OpenAILLMClient implements LLMClient {
  private client: OpenAI;
  private model: string;
  private extraBody?: Record<string, unknown>;

  constructor(config: LLMConfig) {
    this.client = new OpenAI({
      baseURL: config.baseURL,
      apiKey: config.apiKey,
    });
    this.model = config.model;
    this.extraBody = config.extraBody;
  }

  async chat(messages: ChatMessage[], options?: LLMOptions): Promise<string> {
    const timeout = options?.timeout ?? DEFAULT_TIMEOUT;

    // First attempt
    let lastError: Error | undefined;
    try {
      return await this.callLLM(messages, options, timeout);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Retry once on failure
      try {
        return await this.callLLM(messages, options, timeout);
      } catch (retryErr) {
        lastError = retryErr instanceof Error ? retryErr : new Error(String(retryErr));
        // Both attempts failed - throw with details instead of returning silent fallback
        throw new Error(`LLM调用失败(重试后仍失败): ${lastError.message}`);
      }
    }
  }

  private async callLLM(
    messages: ChatMessage[],
    options: LLMOptions | undefined,
    timeout: number,
  ): Promise<string> {
    const response = await this.client.chat.completions.create(
      {
        model: this.model,
        messages: messages as any,
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
        ...(this.extraBody || {}),
      } as any,
      {
        timeout,
      },
    );

    const content = response.choices[0]?.message?.content;
    if (content === null || content === undefined || content === '') {
      throw new Error('LLM returned empty response');
    }

    // Strip <think>...</think> blocks if present (Qwen3 thinking mode residual)
    return stripThinkingBlocks(content);
  }
}
