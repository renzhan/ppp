import OpenAI from 'openai';
import type { ChatMessage, LLMOptions } from '../shared/types.js';

/**
 * LLM客户端配置
 */
export interface LLMConfig {
  baseURL: string;
  model: string;
  apiKey: string;
}

export type LLMProvider = 'openai' | 'qwen';

/**
 * LLM客户端接口
 */
export interface LLMClient {
  chat(messages: ChatMessage[], options?: LLMOptions): Promise<string>;
}

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const FALLBACK_MESSAGE = 'AI生成失败，请稍后重试';

/**
 * 从环境变量创建 LLMClient，支持 OpenAI / Qwen 切换。
 * Qwen DashScope 使用 OpenAI 兼容接口，复用 OpenAILLMClient。
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

    return new OpenAILLMClient({ baseURL, apiKey, model });
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
 * - 默认30秒超时（可通过options.timeout配置）
 */
export class OpenAILLMClient implements LLMClient {
  private client: OpenAI;
  private model: string;

  constructor(config: LLMConfig) {
    this.client = new OpenAI({
      baseURL: config.baseURL,
      apiKey: config.apiKey,
    });
    this.model = config.model;
  }

  async chat(messages: ChatMessage[], options?: LLMOptions): Promise<string> {
    const timeout = options?.timeout ?? DEFAULT_TIMEOUT;

    // First attempt
    try {
      return await this.callLLM(messages, options, timeout);
    } catch {
      // Retry once on failure
      try {
        return await this.callLLM(messages, options, timeout);
      } catch {
        // Both attempts failed, return fallback
        return FALLBACK_MESSAGE;
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
      },
      {
        timeout,
      },
    );

    const content = response.choices[0]?.message?.content;
    if (content === null || content === undefined || content === '') {
      throw new Error('LLM returned empty response');
    }
    return content;
  }
}
