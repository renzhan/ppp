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

/** @deprecated Provider routing is no longer used; keep the type for compatibility. */
export type LLMProvider = string;

/**
 * LLM客户端接口
 */
export interface LLMClient {
  chat(messages: ChatMessage[], options?: LLMOptions): Promise<string>;
}

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const FALLBACK_MESSAGE = 'AI生成失败，请稍后重试';

/**
 * 从环境变量创建 LLMClient。
 * 优先使用统一的 OpenAI 兼容网关配置（LLM_BASE_URL / LLM_API_KEY / LLM_MODEL）。
 * 为兼容旧配置，仍会回退到 OPENAI_* / QWEN_* 变量。
 */
export function createLLMClientFromEnv(): LLMClient {
  const baseURL =
    process.env.LLM_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    process.env.QWEN_BASE_URL ||
    '';
  const apiKey =
    process.env.LLM_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.QWEN_MODEL_API_KEY ||
    '';
  const model =
    process.env.LLM_MODEL ||
    process.env.QWEN_MODEL_CHAT ||
    'gpt-4.1';

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
